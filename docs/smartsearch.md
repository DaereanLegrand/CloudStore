# SmartSearch — Búsqueda Semántica con IA

## Arquitectura general

```
Usuario (Home page)
  │
  ├─ Escribe consulta en lenguaje natural
  │
  ▼
SmartSearch.jsx (componente React)
  │
  ├─ supabase.functions.invoke('semantic-search', { query })
  │    │
  │    ├─ Kong (http://localhost:3333/functions/v1/semantic-search)
  │    │    │
  │    │    ▼
  │    │  Edge Runtime (supabase-edge-functions)
  │    │    │
  │    │    ├─ main/index.ts (router, verifica JWT si VERIFY_JWT=true)
  │    │    │    │
  │    │    │    └─ Crea worker aislado para semantic-search/index.ts
  │    │    │         │
  │    │    │         ├─ POST http://host.docker.internal:11434/api/embeddings
  │    │    │         │    │
  │    │    │         │    └─ Ollama (local, host) → bge-m3 → vector(1024)
  │    │    │         │
  │    │    │         └─ supabase.rpc('match_products', { query_embedding })
  │    │    │              │
  │    │    │              └─ PostgreSQL + pgvector → HNSW index → top 20 productos
  │    │    │
  │    │    └─ Retorna { products: [...] }
  │    │
  │    └─ Recibe productos con campo similarity
  │
  └─ Renderiza grid de <ProductCard> con onAddToCart
```

## Flujo de datos detallado

### 1. Frontend: `src/components/SmartSearch.jsx`

**Input:** Campo de texto libre + botón "Buscar"

**Proceso:**
1. Usuario escribe `"Quiero organizar una BBQ"` y presiona Enter
2. `handleSearch()` envía POST a Edge Function `semantic-search`
3. Mientras carga, muestra skeleton grid (4 cards animadas)
4. Al recibir respuesta, renderiza `<ProductCard>` para cada resultado
5. Cada card tiene botón "Agregar al carrito" que usa `addToCart()` (misma lógica que Home/Products)

**Manejo de errores:**
- Error de red/edge function → `alert-error` con mensaje
- Sin resultados → empty state con icono de lupa y mensaje sugerente
- Toast de confirmación al agregar al carrito (desaparece a los 2s)

### 2. Edge Function: `volumes/functions/semantic-search/index.ts`

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
- `JWT_SECRET` → para verificación JWT por el router principal

**Modelo de embeddings:** `bge-m3` (multilingüe, 1024 dimensiones, ~567MB)

**Timeout:** 180s (configurado via `EDGE_RUNTIME_USER_WORKER_WALL_CLOCK_LIMIT_MS`)

### 3. Base de datos: pgvector

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

### 4. Pre-cómputo de embeddings: `scripts/generate-embeddings.mjs`

**Propósito:** Generar embeddings para todos los productos existentes y almacenarlos en la BD.

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
- Modelo: `bge-m3` (debe coincidir con el usado en semantic-search)
- Texto de embedding: `titulo + " " + descripcion` (máximo 512 caracteres)

**Flujo:**
1. Obtiene todos los productos vía `GET /rest/v1/products?select=id,titulo,descripcion`
2. Para cada producto, llama a Ollama `api/embeddings`
3. Actualiza columna `embedding` vía `PATCH /rest/v1/products?id=eq.{id}`
4. Genera reporte `scripts/output/embedding-report.json`

**Productos que fallaron (NaN):** Productos con descripciones que generan errores de encoding en bge-m3. No crítico — el producto simplemente no será encontrado por búsqueda semántica (seguirá apareciendo en /products y categorías).

### 5. Ollama local

```bash
# Estado
curl http://localhost:11434/api/tags

# Modelos instalados
# - bge-m3: embeddings multilingüe 1024d
# - nomic-embed-text: (anterior, ya no se usa)
# - hf.co/unsloth/Qwen2.5-VL-3B-Instruct-GGUF: (reservado para visión)

# Servir en todas las interfaces (requerido para Docker)
OLLAMA_HOST=0.0.0.0 ollama serve
```

Ollama escucha en `*:11434`. El contenedor `supabase-edge-functions` se conecta via `host.docker.internal:11434` (configurado con `extra_hosts` en docker-compose.yml).

## Modelos de embeddings evaluados

| Modelo | Dimensiones | Idiomas | Resultado |
|---|---|---|---|
| `nomic-embed-text` | 768 | Solo inglés | ❌ "algo para beber" → comida de perro |
| `bge-m3` | 1024 | 100+ idiomas (español incluido) | ✅ "algo para beber" → cerveza, gaseosas, agua |

## Rendimiento

| Etapa | Tiempo |
|---|---|
| Embedding de query (bge-m3, GPU) | ~150-300ms |
| Búsqueda pgvector (HNSW, 387 productos) | ~10-30ms |
| Round-trip total (edge function) | ~400-900ms |
| Pre-cómputo de 387 embeddings | ~41s (~106ms/producto) |

## Comandos de mantenimiento

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

# 3. Ver quality de productos con embedding más cercano a una query
curl -X POST http://localhost:3333/functions/v1/semantic-search \
  -H "Content-Type: application/json" \
  -d '{"query":"ejemplo de busqueda"}'

# 4. Verificar que bge-m3 responde
curl http://localhost:11434/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"bge-m3","prompt":"test"}'

# 5. Logs de edge function
docker compose logs functions | grep -E "\[semantic-search\]|Error"

# 6. Restaurar si algo falla
docker compose up -d --force-recreate --no-deps functions
```

## Troubleshooting

### "Connection refused: host.docker.internal:11434"
**Causa:** Ollama no está escuchando en todas las interfaces, o el `extra_hosts` no está configurado.

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

### Embedding falla con error NaN
**Causa:** Ciertos caracteres especiales o textos vacíos generan errores en el modelo bge-m3.

**Solución:** Los productos con error simplemente no serán encontrados por búsqueda semántica. Opcionalmente, limpiar el texto antes de enviar a Ollama:
```js
const text = [p.titulo, p.descripcion]
  .filter(Boolean)
  .join(' ')
  .replace(/[<>&]/g, '')  // limpiar HTML entities
  .slice(0, 512)
```

### Resultados irrelevantes
**Causa:** El modelo de embeddings no captura el significado semántico correctamente para el idioma o dominio.

**Soluciones:**
1. Cambiar a otro modelo multilingüe (`intfloat/multilingual-e5-large`, `jina-embeddings-v3`)
2. Aumentar `match_count` en `match_products()` (actual: 20)
3. Disminuir umbral de similitud (actual: sin umbral fijo)
4. Re-entrenar/ajustar embeddings con datos del dominio (avanzado)

## Dependencias

| Componente | Versión/Dependencia |
|---|---|
| **pgvector** | Extensión PostgreSQL incluida en `supabase/postgres:17.6.1.136` |
| **Ollama** | v0.24.0+ (local, host) |
| **bge-m3** | Modelo de embeddings Ollama (~567MB) |
| **Edge Runtime** | `supabase/edge-runtime:v1.74.0` |
| **@supabase/supabase-js** | v2.39.0 (importado vía esm.sh en Deno) |

## Archivos involucrados

| Archivo | Propósito |
|---|---|
| `volumes/functions/semantic-search/index.ts` | Edge Function que orquesta embedding + búsqueda pgvector |
| `volumes/db/vector.sql` | Migración: pgvector, columna embedding, índice HNSW, función RPC |
| `scripts/generate-embeddings.mjs` | Script Node.js para pre-computar embeddings de productos |
| `src/components/SmartSearch.jsx` | Componente React: input de búsqueda + resultados + add-to-cart |
| `src/utils/llm-logger.js` | Logger para requests LLM (console + sessionStorage) |
| `src/components/ProductCard.jsx` | Card de producto compartida (usada también por Home y Products) |
| `vite.config.js` | Proxy `/model/` → MLX (para futuro, actualmente no usado por SmartSearch) |
| `docker-compose.yml` | `extra_hosts` para functions, `EDGE_RUNTIME_USER_WORKER_WALL_CLOCK_LIMIT_MS` |
| `volumes/nginx/default.conf` | Proxy `/model/` con log_format `llm` (producción) |
