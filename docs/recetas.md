# Recetas — Guía del Sistema de Recetas

## 1. Vista General

El sistema de recetas permite a los usuarios explorar ~450 recetas extraídas de
[Recetas Nestlé Perú](https://www.recetasnestle.com.pe/), ver sus ingredientes,
y agregar todos los productos necesarios al carrito de compras con un solo clic.

```
Usuario
  │
  ├─ /recipes → lista de recetas con filtros (categoría, dificultad, búsqueda)
  │
  ├─ /recipe/:slug → detalle de receta: ingredientes, instrucciones, add-to-cart
  │
  └─ SmartSearch (Home) → búsqueda semántica también retorna recetas
       si la consulta coincide con el título de una receta
```

---

## 2. Arquitectura

### 2.1 Base de Datos

Dos tablas nuevas en `volumes/db/cloudstore.sql`:

```sql
-- Recetas
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,              -- URL slug (e.g. 'papa-rellena')
  titulo TEXT NOT NULL,                    -- Título de la receta
  descripcion TEXT DEFAULT '',
  instrucciones JSONB NOT NULL DEFAULT '[]', -- Array de secciones con pasos
  categoria TEXT DEFAULT '',               -- 'Plato principal', 'Postre', etc.
  dificultad TEXT DEFAULT 'facil',          -- facil / medio / dificil
  tiempo_preparacion INTEGER DEFAULT 0,    -- minutos totales
  porciones INTEGER DEFAULT 1,
  calorias INTEGER DEFAULT 0,
  imagen_url TEXT DEFAULT '',
  url_origen TEXT DEFAULT '',               -- URL original de Nestlé
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ingredientes de recetas (mapeados a productos del catálogo)
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  ingredient_raw TEXT NOT NULL,              -- Texto original (e.g. "2 Cucharadas de Ajo Molido")
  cantidad_recipe NUMERIC(10,2) DEFAULT 1,  -- Cantidad en la receta
  unidad_recipe TEXT DEFAULT '',             -- Unidad en la receta
  cantidad_producto NUMERIC(10,2) DEFAULT 1, -- Unidades del producto a comprar
  es_opcional BOOLEAN DEFAULT FALSE,
  mapeado BOOLEAN DEFAULT FALSE,            -- True si se encontró producto en catálogo
  notas TEXT DEFAULT '',                     -- Nota de conversión
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Componentes del Frontend

| Archivo | Propósito |
|---------|-----------|
| `src/pages/Recipes.jsx` | Lista de recetas con búsqueda, filtros (dificultad, categoría), paginación |
| `src/pages/RecipeDetail.jsx` | Vista detalle: ingredientes con scroll propio, replace/skip/total S/., instrucciones |
| `src/components/RecipeCard.jsx` | Tarjeta de receta reutilizable |
| `src/components/SmartSearch.jsx` | Búsqueda semántica con extracción de keywords y búsqueda de recetas |

### 2.3 Scripts de Scraping y Mapping

| Script | Propósito |
|--------|-----------|
| `scripts/scraper-nestle-recipes.mjs` | Scraper de recetas desde Nestlé vía sitemap |
| `scripts/map-ingredients.mjs` | Mapeo ingredientes → productos mediante búsqueda semántica |
| `scripts/map-ingredients-worker.mjs` | Worker paralelo para mapeo rápido |
| `scripts/fix-mappings.mjs` | Corrector de mapeos con scoring por posición y categoría |
| `scripts/seed-recipes.mjs` | Inserta recetas + ingredientes mapeados en la BD |
| `scripts/generate-dish-expansions.mjs` | Genera expansiones de búsqueda para nombres de platos |

### 2.4 Integración con Búsqueda Semántica

El archivo `volumes/functions/semantic-search/index.ts` se modificó para:

1. **Ejecutar búsqueda de productos** vía `hybrid_search` (vector + texto)
2. **Ejecutar búsqueda de recetas** vía `ilike` sobre `recipes.titulo`
3. **Retornar ambos resultados**: `{ products: [...], recipes: [...] }`

El frontend `SmartSearch.jsx` muestra las recetas encontradas en una sección
separada sobre los resultados de productos.

---

## 3. Pipeline de Scraping

### 3.1 Descubrimiento de URLs

```
Sitemap de imágenes Nestlé
  ↓
google_image_sitemap_srh_recipe.xml
  ↓
Extraer <loc> tags → ~444 URLs de recetas
```

### 3.2 Extracción de Datos (JSON-LD)

Cada página de receta contiene datos estructurados en `<script type="application/ld+json">`:

```json
{
  "@type": "Recipe",
  "name": "Papa Rellena",
  "recipeYield": "4",
  "totalTime": "PT60M",
  "recipeIngredient": [
    "250 Gramos de Carne de Res Molida",
    "2 Papas Blancas",
    ...
  ],
  "recipeInstructions": [ ... ],
  "nutrition": { "calories": "380", ... },
  "image": { "url": "/sites/default/files/srh_recipes/..." }
}
```

El scraper extrae: título, descripción, ingredientes (parseados),
instrucciones (estructuradas en secciones + pasos), nutrición,
imagen, tiempo de preparación, porciones, categoría, dificultad.

### 3.3 Parseo de Ingredientes

Cada ingrediente se parsea con la regex:
```
^([\d\/\.]+)?\s*(Unidades? de|Cucharadas? de|...)?\s*(.+)$
```

Para manejar casos complejos como "1/2 Taza de Harina de Trigo Sin Preparar":
- cantidad = 0.5
- unidad = "taza de"
- nombre = "Harina de Trigo Sin Preparar"

### 3.4 Mapeo Ingrediente → Producto

El mapeo usa tres estrategias en orden:

1. **Búsqueda semántica** (Ollama bge-m3 + hybrid_search RPC)
   - Genera embedding del ingrediente limpio
   - Busca en catálogo por similitud de vector + texto
2. **ILIKE directo** — para ingredientes de 1-2 palabras
3. **ILIKE progresivo** — reduce palabras hasta encontrar match

**Limpieza del nombre del ingrediente** antes de buscar:

```
"2 Cucharadas Pasta De Tomate"
  → quitar cantidad: "Pasta De Tomate"
  → quitar unidad: "Pasta De Tomate"  (sin unidades conocidas)
  → quitar descriptor de forma: "Tomate"  ("pasta de" → forma)
  → buscar "Tomate" → encuentra "Pasta de Tomate ARO"
```

**Reglas de limpieza:**
- Unidades: `rebanadas?`, `cucharadas?`, `tazas?`, `kilos?`, etc.
- Descriptores de forma (solo seguidos de "de"): `pasta de`, `puré de`,
  `salsa de`, `crema de`, `caldo de`, `polvo de`, `jugo de`, `concentrado de`
- Estados: `cocid[ao]`, `molid[ao]s?`, `fresc[ao]s?`

### 3.5 Scoring con Preferencia de Categoría

Para evitar mapeos incorrectos (e.g., "Papas Amarillas" → papas fritas),
se usa un sistema de categorías preferidas:

```javascript
const PREFERRED_CATEGORIES = {
  "papa": "frutas-verduras", "cebolla": "frutas-verduras",
  "carne": "carnes", "pollo": "carnes",
  "leche": "lacteos", "queso": "lacteos",
  "pan": "panaderia", ...
}
```

El scoring combina:
- **Posición** (+2 si la palabra empieza el título, +1.5 si está después de espacio)
- **Categoría** (+1 si la categoría del producto coincide con la preferida)

El mapeo procesó 3992 ingredientes: 3079 mapeados (77.1%), 913 no mapeados
(son productos Nestlé específicos no existentes en el catálogo: "SUBLIME®",
"MAGGI® Crema de Hongos", "TRIANGULO®", etc.).

---

## 4. Expansiones de Búsqueda Semántica

El archivo `volumes/functions/semantic-search/index.ts` contiene un sistema
de expansión de consultas que mapea intenciones del usuario a términos de
búsqueda específicos del catálogo.

### 4.1 Expansiones por Intención

| Intención | Expansión |
|-----------|-----------|
| `"quiero olvidar a mi ex"` | `cerveza OR vino OR pisco OR licor OR ron OR vodka OR whisky OR champagne` |
| `"estoy triste"` | `helado OR chocolate OR dulce OR pastel OR snack` |
| `"resaca"` | `agua OR gatorade OR hidratante OR energizante OR limon` |
| `"tengo hambre"` | `comida OR snack OR pan OR arroz OR carne OR pollo` |
| `"noche de cine"` | `palomitas OR gaseosa OR snack OR cerveza OR chocolate` |
| `"romantico"` | `vino OR rosado OR chocolate OR fresa OR champagne` |
| `"calor"` | `helado OR agua OR gaseosa OR cerveza OR refresco` |
| `"tengo visita inesperada"` | `gaseosa OR snack OR galleta OR pastel OR cerveza` |
| `"quiero bajar de peso"` | `light OR dieta OR integral OR fruta OR verdura` |

### 4.2 Expansiones por Nombre de Plato

Se generan automáticamente desde las recetas scrapeadas (~444 expansiones),
mapeando el nombre del plato a sus ingredientes clave:

| Búsqueda | Expansión |
|----------|-----------|
| `"papa rellena"` | `carne OR papa OR cebolla OR ajo OR aceituna OR pasas OR harina OR aceite` |
| `"lomo saltado"` | `carne OR cebolla OR tomate OR ajo OR culantro OR arroz OR papa OR vinagre OR sillao OR pimienta OR comino OR aceite OR aji amarillo OR maicena` |
| `"aji de gallina"` | `pollo OR pan OR leche OR queso OR aji OR nuez OR arroz` |
| `"arroz con pollo"` | `arroz OR pollo OR cebolla OR ajo OR culantro OR cerveza` |

### 4.3 Lógica de Expansión

```
1. ¿Todas las palabras están en NO_EXPANSION_WORDS?
   Sí → no expandir (búsqueda directa de producto)
   No → continuar

2. ¿Alguna expansion keyword coincide con la consulta?
   Sí → reemplazar por términos expandidos
   embedPrompt = consulta_original + " " + términos_expandidos
   textQuery = términos_expandidos (para keyword boost)
   No → usar consulta original

3. Después de buscar productos, buscar también recetas:
   recipes.ilike("titulo", "%consulta%") → incluir en respuesta
```

---

## 5. Interacción del Usuario en RecipeDetail

### 5.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  Header: Imagen (380px) + Título + Metadatos         │
├──────────────────────────────┬──────────────────────┤
│  Ingredientes (scroll 70vh) │  Instrucciones        │
│                              │  (scroll 70vh)        │
│  ┌────────────────────────┐  │                       │
│  │ 1 Unidad de Cebolla    │  │  Masa                 │
│  │ → Cebolla Blanca x kg  │  │  1. Diluir levadura   │
│  │   S/.3.50              │  │  2. Colocar harina    │
│  │   [+ Carrito] [↻ Repl] │  │                       │
│  │   [✓ Ya tengo]         │  │  Salsa de Tomate      │
│  ├────────────────────────┤  │  1. Cortar cebolla    │
│  │ 2 Cucharadas de Ajo    │  │                       │
│  │ → Ajo Entero x kg      │  │                       │
│  │   S/.1.20              │  │                       │
│  │   [+ Carrito] [↻ Repl] │  │                       │
│  │   [✓ Ya tengo]         │  │                       │
│  ├────────────────────────┤  │                       │
│  │ Total: S/.24.80        │  │                       │
│  │ 12 prod (3 ya tienes)  │  │                       │
│  └────────────────────────┘  │                       │
└──────────────────────────────┴──────────────────────┘
```

### 5.2 Acciones por Ingrediente

Cada ingrediente muestra tres botones de acción:

| Botón | Acción | Comportamiento |
|-------|--------|----------------|
| **+ Carrito** | Agregar al carrito | Añade `cantidad_producto` unidades al carrito del usuario |
| **↻ Reemplazar** | Buscar otro producto | Abre buscador inline con imágenes de productos. Al seleccionar, muestra selector de cantidad + total parcial + confirmar. Persiste en BD vía PATCH. |
| **✓ Ya tengo** | Saltar ingrediente | Marca como `mapeado=false, notas="Ya tienes"`. Excluye del total y del "Agregar todo". |

### 5.3 Flujo de Reemplazo

```
Usuario hace clic en "↻ Reemplazar"
  │
  ▼
Se abre input de búsqueda inline (autofocus)
  │  Escribe nombre de producto
  ▼
Resultados de búsqueda (ILIKE sobre products):
  ┌─────────────────────────────────────┐
  │ [img] Producto sugerido  S/.9.30   │
  │ [img] Otro producto      S/.5.50   │  ← categoría
  └─────────────────────────────────────┘
  │  Selecciona un resultado
  ▼
Panel de confirmación:
  ┌─────────────────────────────────────┐
  │ [img grande] Nombre producto       │
  │              S/.9.30 c/u           │
  │  Cantidad: [−] 2 [+]              │
  │  Total: S/.18.60                   │
  │  [ Confirmar ]       [ Ya tengo ]  │
  └─────────────────────────────────────┘
  │  Confirma
  ▼
  PATCH recipe_ingredients con nuevo product_id + cantidad_producto
  Toast: "Producto reemplazado correctamente"
  Total de receta se actualiza dinámicamente
```

### 5.4 Total Dinámico de Receta

El total de la receta se calcula como:

```
total = Σ (cantidad_producto × products.precio)
  para cada ingrediente donde:
    mapeado = true
    AND notas != "Ya tienes"
    AND products IS NOT NULL
```

Se muestra en una barra fija sobre la lista de ingredientes:
```
Total: S/.24.80    12 productos (3 ya tienes)
```

Se actualiza automáticamente cuando:
- Se reemplaza un producto (nuevo precio)
- Se cambia la cantidad en el reemplazo
- Se marca "Ya tengo" (ingrediente excluido)

### 5.5 "Agregar todo al carrito"

El botón bulk recorre todos los ingredientes **mapeados y no saltados**:
- Por cada uno, busca si ya existe en `cart_items` del usuario
- Si existe: incrementa cantidad
- Si no existe: inserta con `cantidad = cantidad_producto`
- Muestra toast con total de productos agregados

### 5.6 Búsqueda de Recetas en SmartSearch

El SmartSearch ahora busca recetas junto con productos:

```
query → extraer keywords (remover stop words)
  ├─ Buscar productos semanticamente (hybrid_search RPC)
  └─ Buscar recetas:
      1. Intentar con frase exacta (ILIKE sobre titulo + descripcion)
      2. Por cada keyword: ILIKE sobre titulo, descripcion, categoria
      3. Deducar por slug
      4. Limitar a 4 resultados
      5. Ordenar: match exacto de título > título contiene keyword
```

Stop words incluyen: "quiero", "hacer", "preparar", "aprende", "como", "para", verbos comunes y sus conjugaciones. Esto evita que "preparar un ceviche" retorne recetas de frejoles solo porque contienen "preparar" en la descripción.

### 5.7 Corrección de Mappings (fix-mappings.mjs)

El script `fix-mappings.mjs` corrige mappings incorrectos con un sistema de scoring mejorado:

```javascript
function scoreProduct(preferredWords, productTitle, productCategory) {
  // Por cada palabra del ingrediente:
  //   +2 si el título EMPIEZA con la palabra
  //   +1.5 si la palabra aparece en límite de palabra
  //   +0.5 si aparece como substring
  // +1 si la categoría del producto coincide con la preferida
  // -3 si el ingrediente es comida y el producto es no-comida
  // -1 si <50% de palabras del ingrediente aparecen en el título
  // -1 si no hay match fuerte para ingredientes multi-palabra
  // Normaliza singular/plural: "manzanas" → "manzana"
  // Ignora palabras débiles (colores) como único match fuerte
}
```

Esto previene errores como:
- ❌ "2 Manzanas Verdes" → "Jabón Líquido ARO Frutos Verdes"
- ✅ "2 Manzanas Verdes" → "Manzana Verde Importada x kg"

El ILIKE fallback también normaliza plurales: "manzanas" → "manzana" para encontrar "Manzana Roja Importada x kg".

---

### 5.1 Función SQL `hybrid_search`

```sql
SELECT * FROM hybrid_search(
  query_embedding,     -- vector(1024) de bge-m3
  text_query,          -- texto original del usuario
  match_count => 20,
  vector_threshold => 0.15,
  keyword_boost => 0.3
);
```

**Algoritmo de scoring:**
```
Para cada producto con embedding:
  vec_sim = 1 - coseno_distancia(embedding, query_embedding)
  txt_sim = ts_rank(search_vector, websearch_to_tsquery(text_query))

  IF txt_sim > 0:
    similarity = keyword_boost + vec_sim * (1 - keyword_boost)
  ELSE:
    similarity = vec_sim

  WHERE vec_sim >= vector_threshold
  ORDER BY similarity DESC
  LIMIT match_count
```

El `keyword_boost` garantiza que los productos cuyas palabras coinciden
con la consulta siempre rankeen por encima de los que no, incluso cuando
la similitud vectorial es baja.

### 5.2 Índices

```sql
-- Índice HNSW para búsqueda vectorial rápida
CREATE INDEX products_embedding_idx ON products
  USING hnsw (embedding vector_cosine_ops);

-- Índice GIN para búsqueda de texto completo
CREATE INDEX products_search_idx ON products
  USING GIN (search_vector);

-- Índice GIN para búsqueda difusa (trigramas)
CREATE INDEX products_titulo_trgm_idx ON products
  USING GIN (titulo gin_trgm_ops);
```

---

## 6. Flujo de Compra desde Receta

```
/recipe/papa-rellena
  │
  ├─ Ingredientes mapeados (✓) → ver producto sugerido + precio
  ├─ Ingredientes no mapeados (✗) → ver texto gris (no disponible)
  │
  ├─ Botón "Agregar 1 unidad al carrito" (por ingrediente individual)
  │
  └─ Botón "Agregar N productos al carrito" → bulk add:
       │
       ├─ Por cada ingrediente mapeado:
       │   ├─ ¿Ya existe en cart_items? → aumentar cantidad
       │   └─ No existe → insertar con cantidad = cantidad_producto
       │
       └─ Toast: "8 productos agregados al carrito"
```

---

## 7. Scripts Disponibles

### Scraping y Mapeo

```bash
# 1. Scrapear recetas desde Nestlé (~5 min, 444 recetas)
node scripts/scraper-nestle-recipes.mjs

# 2. Mapear ingredientes a productos (~3-5 min con 16 workers paralelos)
OLLAMA_URL=http://172.17.0.1:11434/api/embeddings \
  SERVICE_KEY="<service_role_key>" \
  node scripts/map-ingredients.mjs

# 3. Corregir mapeos con scoring mejorado
SERVICE_KEY="<service_role_key>" \
  OLLAMA_URL=http://172.17.0.1:11434/api/embeddings \
  node scripts/fix-mappings.mjs

# 4. Sembrar en base de datos
node scripts/seed-recipes.mjs

# 5. Generar expansiones de búsqueda para nombres de platos
node scripts/generate-dish-expansions.mjs
```

### Verificación

```bash
# Contar recetas e ingredientes
docker exec supabase-db psql -U postgres -d postgres -c "
  SELECT COUNT(*) as recetas FROM recipes;
  SELECT COUNT(*) as total_ingredientes,
         COUNT(*) FILTER (WHERE mapeado) as mapeados
  FROM recipe_ingredients;
"

# Probar búsqueda semántica con recetas
curl -s -X POST "http://localhost:3333/functions/v1/semantic-search" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"papa rellena"}' | jq '.recipes'
```

---

## 8. Estadísticas de Mapeo

| Métrica | Valor |
|---------|-------|
| Recetas scrapeadas | 444 |
| Total ingredientes | 3992 |
| Mapeados correctamente | 3079 (77.1%) |
| No mapeados (Nestlé-specific) | 913 (22.9%) |
| Tasa de acierto en mapeados | ~98% |
| Errores sistemáticos corregidos | Papa→chips, Huevo→fideos, Aceite→atún, Pasta de Tomate→Dental |
