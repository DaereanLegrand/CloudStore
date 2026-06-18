# CloudStore Testing Guide

## Environment

- JWT_SECRET=`jwt-secret-cloudstore-dev-32-chars-min!!`
- Anon key and service role key are generated from `JWT_SECRET` (see `.env`)
- Kong API Gateway: `http://localhost:3333`
- Edge Functions: `http://localhost:3333/functions/v1/`
- PostgREST (REST API): `http://localhost:3333/rest/v1/`
- Auth (GoTrue): `http://localhost:3333/auth/v1/`
- Frontend: `http://localhost:8080`

## Quick References

```bash
# Set keys as shell variables (from .env)
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzU4MTE4LCJleHAiOjIwOTcxMTgxMTh9._h-ey3emNeKEpHDVUvEKAdnuO385vQV6SBHNAOyEuD0"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODE3NTgxMTgsImV4cCI6MjA5NzExODExOH0.1kr05HglaLLweQp-cXUy3NnA1vCf7ImoTQPAfk2sLjo"
```

---

## 1. Key Verification Tests

### Verify JWT key is correctly signed

```bash
node -e "
const { createHmac } = require('crypto')

const JWT_SECRET = 'jwt-secret-cloudstore-dev-32-chars-min!!'
const SERVICE_KEY = process.env.SERVICE_KEY

function b64u(str) {
  return Buffer.from(str).toString('base64url')
}

function sign(payload, secret) {
  const headerB64 = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payloadB64 = b64u(JSON.stringify(payload))
  const sig = createHmac('sha256', secret)
    .update(headerB64 + '.' + payloadB64)
    .digest('base64url')
  return headerB64 + '.' + payloadB64 + '.' + sig
}

// Generate a fresh key
const fresh = sign({ role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 315360000 }, JWT_SECRET)
console.log('Fresh ANON_KEY:', fresh)
"
```

### Verify existing key matches JWT_SECRET

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzU4MTE4LCJleHAiOjIwOTcxMTgxMTh9._h-ey3emNeKEpHDVUvEKAdnuO385vQV6SBHNAOyEuD0"

# Decode JWT payload
echo $ANON_KEY | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
# Output: { "role": "anon", "iss": "supabase", "iat": 1781758118, "exp": 2097118118 }

# Verify with Node.js (returns 'Match: true' if correct)
node -e "
const { createHmac } = require('crypto')
const parts = '$ANON_KEY'.split('.')
const sig = createHmac('sha256', 'jwt-secret-cloudstore-dev-32-chars-min!!')
  .update(parts[0] + '.' + parts[1])
  .digest('base64url')
console.log('Match:', sig === parts[2])
"
```

---

## 2. Kong Gateway Tests

### Check Kong is reachable

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3333/
```

### Test REST API with anon key (should return 200 for public endpoints)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "apikey: $ANON_KEY" \
  "http://localhost:3333/rest/v1/products?limit=2"
```

### Test REST API with service role key (should return 200)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  "http://localhost:3333/rest/v1/products?limit=2"
```

### Test REST API with service role key — insert data

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3333/rest/v1/profiles" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"id":"00000000-0000-0000-0000-000000000001","nombre":"Test","email":"test@test.com","rol":"comprador"}'
```

### Test Auth health

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -H "apikey: $ANON_KEY" \
  "http://localhost:3333/auth/v1/health"
```

### Test Auth — Sign up a new user

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST http://localhost:3333/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@test.com","password":"test123456"}'
```

### Test Auth — Log in (get JWT)

```bash
USER_RESP=$(curl -s \
  -X POST "http://localhost:3333/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@test.com","password":"test123456"}')

USER_JWT=$(echo "$USER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
USER_ID=$(echo "$USER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))")

echo "JWT: ${USER_JWT:0:50}..."
echo "User ID: $USER_ID"
```

### Test Auth — Delete user (cleanup)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X DELETE "http://localhost:3333/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

---

## 3. Edge Function Tests

### Test checkout function with invalid JWT

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST http://localhost:3333/functions/v1/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-jwt" \
  -d '{"items":[{"product_id":"00000000-0000-0000-0000-000000000000","cantidad":1}]}'
```

### Test checkout function with service role key (for debugging)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST http://localhost:3333/functions/v1/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -d '{"items":[{"product_id":"00000000-0000-0000-0000-000000000000","cantidad":1}]}'
```

### Test checkout function with real user JWT (end-to-end)

```bash
# 1. Get user JWT (see section 2 above)
# 2. Create a profile for the user (needed after signup)
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3333/rest/v1/profiles" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"id\":\"$USER_ID\",\"nombre\":\"Test User\",\"email\":\"testuser@test.com\",\"rol\":\"comprador\"}"

# 3. Add item to cart
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3333/rest/v1/cart_items" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"comprador_id\":\"$USER_ID\",\"product_id\":\"a45c9d7a-936a-4d0a-ba0e-7d7a94ed34f5\",\"cantidad\":1}"

# 4. Checkout
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST http://localhost:3333/functions/v1/checkout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"items":[{"product_id":"a45c9d7a-936a-4d0a-ba0e-7d7a94ed34f5","cantidad":1}]}'
```

---

## 4. Database Query Tests

### List all products

```bash
curl -s "http://localhost:3333/rest/v1/products?select=id,titulo,precio,stock&limit=5" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | python3 -m json.tool
```

### List all profiles

```bash
curl -s "http://localhost:3333/rest/v1/profiles?select=id,nombre,email,rol" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | python3 -m json.tool
```

### List cart items for a user

```bash
curl -s "http://localhost:3333/rest/v1/cart_items?comprador_id=eq.$USER_ID&select=*,products(*)" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | python3 -m json.tool
```

### List orders for a user

```bash
curl -s "http://localhost:3333/rest/v1/orders?comprador_id=eq.$USER_ID&select=*,order_items(*)" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | python3 -m json.tool
```

---

## 5. Container Management

```bash
# View edge function logs (with checkout-specific filter)
docker compose logs functions | grep -E "\[checkout\]|Error|error|ERROR"

# Tail edge function logs live
docker compose logs -f functions

# Restart a service (picks up new env vars only if recreated)
docker compose up -d --force-recreate <service>

# Check env vars inside a container
docker compose exec <service> sh -c 'env | grep JWT'
docker compose exec <service> sh -c 'env | grep SUPABASE'
```

---

## 6. Full End-to-End Test Script

Save as `test-checkout.sh`:

```bash
#!/bin/bash
set -e

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzU4MTE4LCJleHAiOjIwOTcxMTgxMTh9._h-ey3emNeKEpHDVUvEKAdnuO385vQV6SBHNAOyEuD0"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODE3NTgxMTgsImV4cCI6MjA5NzExODExOH0.1kr05HglaLLweQp-cXUy3NnA1vCf7ImoTQPAfk2sLjo"
EMAIL="e2e-$(date +%s)@test.com"
PASS="test123456"

echo "=== 1. Sign up ==="
RESP=$(curl -s -X POST "http://localhost:3333/auth/v1/signup" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
USER_JWT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
USER_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('user',{}).get('id',''))")
echo "User: $USER_ID"

echo "=== 2. Create profile ==="
curl -s -o /dev/null -w "Profile: HTTP %{http_code}\n" \
  -X POST "http://localhost:3333/rest/v1/profiles" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d "{\"id\":\"$USER_ID\",\"nombre\":\"E2E Test\",\"email\":\"$EMAIL\",\"rol\":\"comprador\"}"

echo "=== 3. Get a product ID ==="
PRODUCT_ID=$(curl -s "http://localhost:3333/rest/v1/products?select=id&limit=1" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" | \
  python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)
echo "Product: $PRODUCT_ID"

echo "=== 4. Checkout ==="
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "http://localhost:3333/functions/v1/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_JWT" \
  -d "{\"items\":[{\"product_id\":\"$PRODUCT_ID\",\"cantidad\":1}]}"

echo "=== 5. Cleanup: delete profile and user ==="
curl -s -o /dev/null -X DELETE "http://localhost:3333/rest/v1/profiles?id=eq.$USER_ID" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
curl -s -o /dev/null -X DELETE "http://localhost:3333/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY"
echo "Done."
```

---

## 7. JWT Key Generation Script

Save as `scripts/generate-keys.mjs`:

```javascript
import { createHmac } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret-cloudstore-dev-32-chars-min!!'

function b64u(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

function sign(payload, secret) {
  const header = b64u({ alg: 'HS256', typ: 'JWT' })
  const body = b64u(payload)
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${sig}`
}

const now = Math.floor(Date.now() / 1000)
const tenYears = 315360000

console.log('ANON_KEY:', sign({ role: 'anon', iss: 'supabase', iat: now, exp: now + tenYears }, JWT_SECRET))
console.log('SERVICE_ROLE_KEY:', sign({ role: 'service_role', iss: 'supabase', iat: now, exp: now + tenYears }, JWT_SECRET))
```

Usage:
```bash
node scripts/generate-keys.mjs
```

---

## 8. Recipe System Tests

### 8.1. Database Verification

```bash
# Check recipe count and ingredient mapping stats
docker exec supabase-db psql -U postgres -d postgres -c "
  SELECT COUNT(*) as recetas FROM recipes;
  SELECT COUNT(*) as total_ingredientes,
         COUNT(*) FILTER (WHERE mapeado) as mapeados,
         COUNT(*) FILTER (WHERE NOT mapeado) as no_mapeados
  FROM recipe_ingredients;
"

# Check a specific recipe
docker exec supabase-db psql -U postgres -d postgres -c "
  SELECT r.titulo, COUNT(ri.id) as ingredientes,
         COUNT(*) FILTER (WHERE ri.mapeado) as mapeados
  FROM recipes r
  JOIN recipe_ingredients ri ON ri.recipe_id = r.id
  GROUP BY r.id, r.titulo ORDER BY random() LIMIT 5;
"
```

### 8.2. API Tests

```bash
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzU4MTE4LCJleHAiOjIwOTcxMTgxMTh9._h-ey3emNeKEpHDVUvEKAdnuO385vQV6SBHNAOyEuD0"

# Test recipe listing
curl -s "http://localhost:3333/rest/v1/recipes?select=slug,titulo,dificultad&limit=5" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | jq .

# Test recipe detail + ingredients
RECIPE_SLUG="papa-rellena"
RECIPE_ID=$(curl -s "http://localhost:3333/rest/v1/recipes?select=id&slug=eq.$RECIPE_SLUG" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | jq -r '.[0].id')

curl -s "http://localhost:3333/rest/v1/recipe_ingredients?select=ingredient_raw,mapeado,product_id:product_id(titulo,precio)&recipe_id=eq.$RECIPE_ID" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" | jq .

# Test semantic search returning recipes
curl -s -X POST "http://localhost:3333/functions/v1/semantic-search" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"papa rellena"}' | jq '{ products: [.products[0]?.titulo], recipes: [.recipes[0]?.titulo] }'
```

### 8.3. Full Scraping Pipeline Test

```bash
# Time the full pipeline (expect ~5-7 min)
time (
  # 1. Scrape
  node scripts/scraper-nestle-recipes.mjs

  # 2. Map ingredients
  SERVICE_KEY="<service_role_key>" \
    OLLAMA_URL=http://172.17.0.1:11434/api/embeddings \
    node scripts/map-ingredients.mjs

  # 3. Fix mappings
  SERVICE_KEY="<service_role_key>" \
    OLLAMA_URL=http://172.17.0.1:11434/api/embeddings \
    node scripts/fix-mappings.mjs

  # 4. Seed
  node scripts/seed-recipes.mjs

  echo "Pipeline complete."
)
```

### 8.4. Mapping Quality Check

Script to verify no bad mappings exist:

```bash
SERVICE_KEY="<service_role_key>"

# Check for known bad mapping patterns
echo "=== Bad mapping checks ==="
for pattern in \
  "papa.*chips" \
  "huevo.*fideo" \
  "aceite.*atun" \
  "pasta tomate.*dental"; do
  count=$(docker exec supabase-db psql -U postgres -d postgres -t -c "
    SELECT COUNT(*) FROM recipe_ingredients ri
    JOIN products p ON p.id = ri.product_id
    WHERE ri.ingredient_raw ~* '${pattern%%|*}'
      AND p.titulo ~* '${pattern##*|}';")
  echo "  ${pattern}: ${count} instances"
done

# Check for unmapped ingredients (these should be Nestlé-specific only)
echo ""
echo "=== Sample unmapped (should be Nestlé brands) ==="
docker exec supabase-db psql -U postgres -d postgres -c "
  SELECT ri.ingredient_raw, r.titulo as recipe
  FROM recipe_ingredients ri
  JOIN recipes r ON r.id = ri.recipe_id
  WHERE NOT ri.mapeado
  ORDER BY random() LIMIT 10;
"
```
