# SmartSearch — Búsqueda Semántica con IA

SmartSearch permite buscar productos de dos formas: mediante **texto en lenguaje natural** (búsqueda semántica) o mediante **imagen** (búsqueda visual descriptiva). Ambos flujos convergen en el mismo pipeline de embeddings + pgvector para encontrar los productos más similares.

---

## Arquitectura general

```
Usuario (Home page)
  │
  ├─ Modo TEXTO: escribe consulta en lenguaje natural
  │
  ├─ Modo IMAGEN: sube foto de producto
  │
  ▼
SmartSearch.jsx (componente React con tabs Texto | Imagen)
  │
  ├─ [modo texto]
  │   └─ supabase.functions.invoke('semantic-search', { query })
  │
  ├─ [modo imagen]
  │   └─ supabase.functions.invoke('visual-search', { image: base64 })
  │
  ▼
Kong (http://localhost:3333/functions/v1/<function-name>)
  │
  ▼
Edge Runtime (supabase-edge-functions)
  │
  ├─ main/index.ts (router, verifica JWT si VERIFY_JWT=true)
  │   │
  │   └─ Crea worker aislado para semantic-search/index.ts (modo texto)
  │   │    │
  │   │    ├─ POST http://host.docker.internal:11434/api/embeddings
  │   │    │   └─ Ollama → bge-m3 → vector(1024)
  │   │    │
  │   │    └─ supabase.rpc('match_products', { query_embedding })
  │   │        └─ PostgreSQL + pgvector → HNSW index → top 20
  │   │
  │   └─ Crea worker aislado para visual-search/index.ts (modo imagen)
  │        │
  │        ├─ POST http://192.168.0.121:8001/model/chat/completions
  │        │   └─ Gemma 4 (E2B CoreML) → descripción textual
  │        │
  │        ├─ POST http://host.docker.internal:11434/api/embeddings
  │        │   └─ Ollama → bge-m3 → vector(1024)
  │        │
    │   ├─ Análisis de expansión de consulta (intent → keywords)
    │   ├─ supabase.rpc('hybrid_search', {
    │   │     query_embedding, text_query, keyword_boost: 0.3 })
    │   │   └─ PostgreSQL + pgvector + tsvector → HNSW index → top 20
    │   │   └─ Scoring = keyword_boost + vec_sim * (1-keyword_boost)
    │   │       si hay coincidencia de texto (ts_rank > 0)
    │   └─ supabase.from('recipes').ilike('titulo', query)
    │       └─ Retorna recetas que coinciden con la búsqueda
  │
  └─ Retorna { products: [...], description? }
      │
      └─ SmartSearch.jsx renderiza grid de <ProductCard> con onAddToCart
```

---

## Flujo de datos detallado

### 1. Frontend: `src/components/SmartSearch.jsx`

SmartSearch es un componente que integra **dos modos de búsqueda** mediante tabs:

#### Modo Texto
- **Input:** Campo de texto libre + botón "Buscar"
- **Proceso:**
  1. Usuario escribe texto (ej: `"Quiero organizar una BBQ"`) y presiona Enter
  2. `handleSearch()` envía POST a Edge Function `semantic-search` con `{ query }`
  3. Mientras carga, muestra skeleton grid (4 cards animadas)
  4. Al recibir respuesta, renderiza `<ProductCard>` para cada resultado
  5. Cada card tiene botón "Agregar al carrito" que usa `addToCart()`

#### Modo Imagen
- **Input:** Archivo de imagen (JPG/PNG) seleccionado por el usuario
- **Proceso:**
  1. Usuario hace clic en el área de upload o arrastra una imagen
  2. `handleImageSelect()` lee el archivo con `FileReader` y lo convierte a base64
  3. Se muestra preview de la imagen con botón × para eliminar
  4. Usuario hace clic en "Buscar con imagen"
  5. `handleVisualSearch()` envía POST a Edge Function `visual-search` con `{ image: base64 }`
  6. Mientras carga, muestra skeleton grid (4 cards animadas)
  7. Al recibir respuesta, renderiza `<ProductCard>` para cada resultado

#### Manejo de errores (compartido por ambos modos)
- Error de red/edge function → `alert-error` con mensaje descriptivo
- Sin resultados → empty state con icono de lupa y mensaje sugerente
- Toast de confirmación al agregar al carrito (desaparece a los 2s)

#### addToCart (compartido)
1. Obtiene sesión actual vía `supabase.auth.getSession()`
2. Si no hay sesión, redirige a `/login`
3. Busca si el producto ya existe en `cart_items` para el usuario
4. Si existe, incrementa `cantidad` en 1
5. Si no existe, inserta nuevo registro con `cantidad: 1`
6. Actualiza contador del carrito y muestra toast por 2 segundos

#### Logging
Ambos modos registran la operación via `logLLM()` con:
- `query`: texto de búsqueda o `"[imagen]"` para búsqueda visual
- `response`: cantidad de productos encontrados
- `timing`: tiempo total en segundos
- `error`: mensaje de error si ocurre
- `image: true` si fue búsqueda por imagen (incluye `description` generada por Gemma 4)

---

### 2. Edge Function: `volumes/functions/semantic-search/index.ts`

Orquesta la búsqueda por texto.

```typescript
// 1. Recibe { query: string }
// 2. Valida body
// 3. Llama a Ollama:
//    POST http://host.docker.internal:11434/api/embeddings
//    { model: "bge-m3", prompt: query }
// 4. Recibe embedding: [1024 floats]
// 5. Llama a PostgreSQL via RPC:
//    supabase.rpc('match_products', { query_embedding, match_count: 20 })
// 6. Retorna { products: [...] }
```

**Variables de entorno requeridas (inyectadas por docker-compose):**
- `SUPABASE_URL` → `http://kong:8000`
- `SUPABASE_SERVICE_ROLE_KEY` → clave con permisos de admin

**Modelo de embeddings:** `bge-m3` (multilingüe, 1024 dimensiones, ~567MB)

**Timeout:** 180s (configurado via `EDGE_RUNTIME_USER_WORKER_WALL_CLOCK_LIMIT_MS`)

---

### 3. Edge Function: `volumes/functions/visual-search/index.ts` (NUEVO)

Orquesta la búsqueda por imagen en tres etapas con reintentos ante fallos de embedding.

```typescript
// 1. Recibe { image: string (base64) }
// 2. Valida body
// 3. Llama a Gemma 4 (visión):
//    POST http://192.168.0.121:8001/model/chat/completions
//    { messages: [{ role: "user", content: prompt, image: base64 }],
//      max_tokens: 100, stream: false }
//    → Extrae descripción textual del producto
// 4. Sanitiza la descripción (elimina markdown, etiquetas HTML, normaliza espacios)
// 5. Llama a Ollama con reintento progresivo:
//    - Intenta con texto completo (máx 512 chars)
//    - Si falla (NaN), reintenta con primeros 120 caracteres
//    - Si falla, reintenta con primeros 80 caracteres
//    - Si falla, reintenta con primeros 40 caracteres
// 6. Llama a PostgreSQL via RPC:
//    supabase.rpc('match_products', { query_embedding, match_count: 20 })
// 7. Retorna { products: [...], description: "..." }
```

#### Sanitización de texto

La función `sanitize()` prepara la descripción para el modelo de embeddings:

```typescript
function sanitize(text: string): string {
  return text
    .replace(/[*_`~#]/g, "")       // elimina markdown
    .replace(/<[^>]*>/g, "")        // elimina etiquetas HTML
    .replace(/&[a-z]+;/g, " ")      // reemplaza HTML entities
    .replace(/\s+/g, " ")           // normaliza espacios
    .trim()
    .slice(0, 512)                  // límite de 512 caracteres
}
```

#### Reintento de embedding (NaN handling)

El modelo bge-m3 puede fallar generando valores NaN para ciertos patrones de texto (acentos, paréntesis, etc.). La función `getEmbedding()` implementa reintento con truncamiento progresivo:

```typescript
async function getEmbedding(text: string): Promise<number[] | null> {
  for (const prompt of [text, text.slice(0, 120), text.slice(0, 80), text.slice(0, 40)]) {
    try {
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ model: EMBED_MODEL, prompt }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.embedding) return data.embedding
      }
    } catch { /* siguiente intento */ }
  }
  return null
}
```

**Prompt de visión utilizado:**
```
Describe este producto en una oración concisa para búsqueda en un catálogo.
Menciona tipo, categoría y características clave.
```

**Variables de entorno requeridas (inyectadas por docker-compose):**
- `SUPABASE_URL` → `http://kong:8000`
- `SUPABASE_SERVICE_ROLE_KEY` → clave con permisos de admin

**Timeout:** 180s (Gemma 4 puede tomar 10-60s para procesar la imagen)

---

### 4. Base de datos: pgvector

Compartido por ambos modos de búsqueda.

**Migración:** `volumes/db/vector.sql`

```sql
-- Extensión vector (pgvector)
CREATE EXTENSION IF NOT EXISTS vector;

-- Columna embedding en products (1024 floats)
ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Índice HNSW para búsqueda por similitud coseno (~10x más rápido que IVFFlat)
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON products USING hnsw (embedding vector_cosine_ops);

-- Función RPC: match_products
-- Recibe vector de consulta + cantidad de resultados
-- Retorna productos ordenados por distancia coseno ascendente
-- similarity = 1 - cosine_distance (0..1, 1 = idéntico)
CREATE OR REPLACE FUNCTION match_products(
  query_embedding vector(1024),
  match_count int DEFAULT 20
) ...
```

**Operador `<=>`:** Distancia coseno (`cosine_distance`). `similarity = 1 - cosine_distance`, donde 1 = vectores idénticos (mismo significado semántico), 0 = ortogonales (sin relación), negativo = opuestos.

**Índice HNSW (Hierarchical Navigable Small World):**
- Construye un grafo multi-nivel para búsqueda aproximada del vecino más cercano (ANN)
- Parámetros por defecto: `m = 16`, `ef_construction = 200`
- Significativamente más rápido que IVFFlat para datasets medianos/grandes
- Trade-off: mayor uso de memoria, construcción más lenta

---

### 5. Pre-cómputo de embeddings: `scripts/generate-embeddings.mjs`

**Propósito:** Generar embeddings para todos los productos existentes y almacenarlos en la BD. Este paso es necesario tanto para búsqueda por texto como por imagen.

**Uso:**
```bash
SUPABASE_URL="http://localhost:3333" \
SERVICE_KEY="<service-role-key>" \
node scripts/generate-embeddings.mjs
```

**Variables de entorno:**
- `SUPABASE_URL` — URL del API (local: `http://localhost:3333`, prod: `https://...`)
- `SERVICE_KEY` — Service role key para autenticación

**Parámetros internos:**
- `BATCH_SIZE = 5` — Procesa 5 productos en paralelo
- Modelo: `bge-m3` (debe coincidir con el usado en semantic-search y visual-search)
- Texto de embedding: `titulo + " " + descripcion` (máximo 512 caracteres)

**Flujo:**
1. Obtiene todos los productos vía `GET /rest/v1/products?select=id,titulo,descripcion`
2. Para cada producto, llama a Ollama `api/embeddings`
3. Actualiza columna `embedding` vía `PATCH /rest/v1/products?id=eq.{id}`
4. Genera reporte `scripts/output/embedding-report.json`

**Productos que fallaron (NaN):** Productos con descripciones que generan errores de encoding en bge-m3. No crítico — el producto simplemente no será encontrado por búsqueda semántica (seguirá apareciendo en /products y categorías).

---

### 6. Gemma 4 — Modelo de Visión

La búsqueda por imagen utiliza **Gemma 4 E2B CoreML** (`mlboydaisuke/gemma-4-E2B-coreml`) ejecutándose en un servidor independiente en `192.168.0.121:8001`.

#### API

```bash
curl -X POST http://192.168.0.121:8001/model/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "Describe este producto...",
      "image": "<base64 de la imagen>"
    }],
    "max_tokens": 100,
    "stream": false
  }'
```

**Respuesta:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1781767519,
  "model": "mlboydaisuke/gemma-4-E2B-coreml",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Descripción textual del producto en la imagen"
    },
    "finish_reason": "stop"
  }]
}
```

**Características:**
- Modelo multimodal que acepta texto e imágenes
- El campo `image` recibe base64 **sin prefijo** `data:image/...` (solo el raw base64)
- Responde en el idioma del prompt (español en nuestro caso)
- Tiempo de respuesta típico: 10-60s dependiendo del tamaño de imagen

**Conexión desde edge functions:**
- El servidor corre en el host en `192.168.0.121:8001`
- El contenedor `supabase-edge-functions` se conecta directamente (no via `host.docker.internal`)
- Puerto 8001 (no confundir con el modelo anterior en puerto 8000 usado por `vision-chat`)

---

### 7. Ollama local

```bash
# Estado
curl http://localhost:11434/api/tags

# Modelos instalados
# - bge-m3: embeddings multilingüe 1024d (usado por semantic-search y visual-search)
# - nomic-embed-text: (anterior, ya no se usa)

# Servir en todas las interfaces (requerido para Docker)
OLLAMA_HOST=0.0.0.0 ollama serve
```

Ollama escucha en `*:11434`. El contenedor `supabase-edge-functions` se conecta via `host.docker.internal:11434` (configurado con `extra_hosts` en docker-compose.yml).

---

## Modelos de embeddings evaluados

| Modelo | Dimensiones | Idiomas | Resultado |
|---|---|---|---|
| `nomic-embed-text` | 768 | Solo inglés | ❌ "algo para beber" → comida de perro |
| `bge-m3` | 1024 | 100+ idiomas (español incluido) | ✅ "algo para beber" → cerveza, gaseosas, agua |

---

## Rendimiento

### Búsqueda por texto

| Etapa | Tiempo |
|---|---|
| Embedding de query (bge-m3, GPU) | ~150-300ms |
| Búsqueda pgvector (HNSW, ~400 productos) | ~10-30ms |
| Round-trip total (edge function) | ~400-900ms |
| Pre-cómputo de 387 embeddings | ~41s (~106ms/producto) |

### Búsqueda por imagen

| Etapa | Tiempo |
|---|---|
| Gemma 4 (visión, GPU) + descarga de imagen | ~10-60s |
| Embedding de descripción (bge-m3, GPU) | ~150-300ms |
| Búsqueda pgvector (HNSW, ~400 productos) | ~10-30ms |
| Round-trip total (edge function) | ~15-70s |

---

## Comandos de mantenimiento

### Búsqueda por texto

```bash
# Verificar quality con embedding más cercano a una query
curl -X POST http://localhost:3333/functions/v1/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query":"ejemplo de busqueda"}'
```

### Búsqueda por imagen

```bash
# Probar visual-search con una imagen local
python3 << 'PYEOF'
import base64, json, urllib.request

with open("/ruta/a/imagen.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNzU4MTE4LCJleHAiOjIwOTcxMTgxMTh9._h-ey3emNeKEpHDVUvEKAdnuO385vQV6SBHNAOyEuD0"

req = urllib.request.Request(
    "http://localhost:3333/functions/v1/visual-search",
    data=json.dumps({"image": b64}).encode(),
    headers={
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
    }
)
resp = urllib.request.urlopen(req, timeout=180)
result = json.loads(resp.read())
print(f"Descripción: {result.get('description', '')}")
print(f"Productos: {len(result.get('products', []))}")
for p in result.get("products", [])[:5]:
    print(f"  • {p['titulo']} — similitud: {p['similarity']:.3f}")
PYEOF

# Probar Gemma 4 directamente
curl -X POST http://192.168.0.121:8001/model/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Describe esta imagen","image":"<base64>"}],"max_tokens":100,"stream":false}'
```

### Generales

```bash
# 1. Generar/regenerar embeddings para todos los productos
SUPABASE_URL="http://localhost:3333" \
SERVICE_KEY="eyJh..." \
node scripts/generate-embeddings.mjs

# 2. Verificar embeddings almacenados
docker compose exec db psql -U postgres -d postgres -c "
  SELECT COUNT(*) total,
         COUNT(embedding) con_embedding,
         COUNT(*) - COUNT(embedding) sin_embedding
  FROM products;"

# 3. Verificar que bge-m3 responde
curl http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"bge-m3","prompt":"test"}'

# 4. Logs de edge functions
docker compose logs functions | grep -E "\[semantic-search\]|\[visual-search\]|Error"

# 5. Restaurar edge functions si algo falla
docker compose up -d --force-recreate --no-deps functions
```

---

## Troubleshooting

### "Connection refused: host.docker.internal:11434"

**Causa:** Ollama no está escuchando en todas las interfaces, o el `extra_hosts` no está configurado en docker-compose.yml.

**Solución:**
```bash
# Asegurar que Ollama escucha en 0.0.0.0
kill $(pgrep ollama)
OLLAMA_HOST=0.0.0.0 nohup ollama serve &

# Verificar
ss -tlnp | grep 11434  # Debe mostrar *:11434

# Verificar docker-compose tiene extra_hosts
docker compose exec functions sh -c "getent hosts host.docker.internal"
# Debe resolver a 172.x.0.1 (gateway de la red Docker)
```

### "Connection refused: 192.168.0.121:8001"

**Causa:** El servidor de Gemma 4 no está corriendo o no es accesible desde el contenedor de edge functions.

**Solución:**
```bash
# Verificar que Gemma 4 está corriendo en el host
curl -s http://192.168.0.121:8001/health
# Debe responder: {"status":"ok","backend_ready":true}

# Verificar conectividad desde el contenedor
docker compose exec functions sh -c "wget -q -O- http://192.168.0.121:8001/health || echo 'No reachable'"

# Si no es reachable, verificar que la IP y puerto son correctos
# y que no hay firewall bloqueando
```

### Embedding falla con error NaN

**Causa:** Ciertos caracteres especiales, texto muy largo o patrones específicos generan errores de encoding en el modelo bge-m3.

**Solución (automática en visual-search):** La edge function implementa reintento con truncamiento progresivo (texto completo → 120 → 80 → 40 caracteres). Para semantic-search (texto), el usuario puede reformular la consulta.

**Solución manual si persiste:**
```js
const text = descripcion
  .replace(/[*_`~#]/g, '')
  .replace(/<[^>]*>/g, '')
  .replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 120)
```

### Resultados irrelevantes

**Causa:** El modelo de embeddings no captura el significado semántico correctamente para el idioma o dominio. En búsqueda por imagen, puede deberse a que Gemma 4 no describió adecuadamente el producto.

**Soluciones:**
1. Cambiar el prompt de visión para obtener descripciones más precisas
2. Cambiar a otro modelo de embeddings multilingüe (`intfloat/multilingual-e5-large`, `jina-embeddings-v3`)
3. Aumentar `match_count` en `match_products()` (actual: 20)
4. Disminuir umbral de similitud (actual: sin umbral fijo)
5. Re-entrenar/ajustar embeddings con datos del dominio (avanzado)

### La imagen no se procesa (error del modelo de visión)

**Causa:** Imagen muy grande (>5MB), formato no soportado, o base64 corrupto.

**Solución:**
- Redimensionar la imagen a máx 1024×1024 píxeles antes de enviar
- Comprimir JPEG a calidad 80% (balance entre calidad y velocidad)
- Verificar formato: JPG o PNG
- El frontend ya limita a archivos de imagen con `accept="image/*"`

---

## Dependencias

| Componente | Versión/Dependencia |
|---|---|
| **pgvector** | Extensión PostgreSQL incluida en `supabase/postgres:17.6.1.136` |
| **Ollama** | v0.24.0+ (local, host) |
| **bge-m3** | Modelo de embeddings Ollama (~567MB) |
| **Gemma 4 E2B CoreML** | `mlboydaisuke/gemma-4-E2B-coreml` en `192.168.0.121:8001` |
| **Edge Runtime** | `supabase/edge-runtime:v1.74.0` |
| **@supabase/supabase-js** | v2.39.0 (importado vía esm.sh en Deno) |

---

## Archivos involucrados

### Frontend

| Archivo | Propósito |
|---|---|
| `src/components/SmartSearch.jsx` | Componente React con tabs Texto/Imagen, upload, preview y resultados |
| `src/utils/llm-logger.js` | Logger para requests LLM (console + sessionStorage) |
| `src/components/ProductCard.jsx` | Card de producto compartida (usada también por Home y Products) |

### Edge Functions

| Archivo | Propósito |
|---|---|
| `volumes/functions/semantic-search/index.ts` | Edge Function: texto → embedding → búsqueda pgvector |
| `volumes/functions/visual-search/index.ts` | Edge Function: imagen → Gemma 4 → descripción → embedding → búsqueda pgvector |
| `volumes/functions/main/index.ts` | Router principal que enruta a las funciones por nombre |

### Base de datos

| Archivo | Propósito |
|---|---|
| `volumes/db/vector.sql` | Migración: pgvector, columna embedding, índice HNSW + tsvector + GIN + pg_trgm, funciones RPC `match_products` y `hybrid_search` |

### Funciones RPC

**`match_products(query_embedding, match_count, match_threshold)`**
- Búsqueda puramente vectorial (cosine distance)
- Retorna productos con `similarity >= match_threshold`

**`hybrid_search(query_embedding, text_query, match_count, vector_threshold, keyword_boost)`**
- Combina similitud coseno + ranking de texto completo (`ts_rank`)
- Usa `websearch_to_tsquery('spanish', text_query)` para parsear la consulta
  con soporte de operador `OR` entre términos
- Scoring: si `txt_sim > 0` → `keyword_boost + vec_sim * (1-keyword_boost)`,
  si no → `vec_sim`
- Garantiza que productos con coincidencia de texto siempre superen a los que no

### Scripts

| Archivo | Propósito |
|---|---|
| `scripts/generate-embeddings.mjs` | Script Node.js para pre-computar embeddings de productos |

### Infraestructura

| Archivo | Propósito |
|---|---|
| `vite.config.js` | Proxy `/functions/` → Kong, `/model/` → MLX (dev) |
| `docker-compose.yml` | `extra_hosts` para functions, variables de entorno, timeout |
| `volumes/nginx/default.conf` | Proxy `/functions/` → Kong, `/model/` → MLX con log_format `llm` (producción) |
