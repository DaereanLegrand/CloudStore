import { readFileSync, writeFileSync } from 'fs'

const chunkIndex = parseInt(process.argv[2])
const totalChunks = parseInt(process.argv[3])

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:3333'
const SERVICE_KEY = process.env.SERVICE_KEY
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://172.17.0.1:11434/api/embeddings'
const REST_URL = `${SUPABASE_URL}/rest/v1`

const recipes = JSON.parse(readFileSync('scripts/output/nestle-recipes.json', 'utf-8'))
const chunkSize = Math.ceil(recipes.length / totalChunks)
const myRecipes = recipes.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize)

const embeddingCache = new Map()
const productCache = new Map()

async function getEmbedding(text) {
  const key = text.substring(0, 200)
  if (embeddingCache.has(key)) return embeddingCache.get(key)
  try {
    const resp = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'bge-m3', prompt: text.substring(0, 512) })
    })
    if (!resp.ok) { console.error(`  [W${chunkIndex}] Ollama error: ${await resp.text()}`); return null }
    const data = await resp.json()
    if (!data.embedding || data.embedding.some(v => Number.isNaN(v))) { console.error(`  [W${chunkIndex}] NaN embedding for: ${text.substring(0, 40)}`); return null }
    embeddingCache.set(key, data.embedding)
    return data.embedding
  } catch { return null }
}

async function searchProduct(query) {
  const embedding = await getEmbedding(query)
  if (!embedding) return null
  try {
    const resp = await fetch(`${REST_URL}/rpc/hybrid_search`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query_embedding: embedding, text_query: query, match_count: 5, vector_threshold: 0.1, keyword_boost: 0.3 })
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch { return null }
}

async function directSearch(query) {
  if (productCache.has(query)) return productCache.get(query)
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 2)
  if (words.length === 0) return null
  try {
    const resp = await fetch(`${REST_URL}/products?select=id,titulo,precio,categoria&titulo=ilike.*${encodeURIComponent(words.join(' '))}*&limit=5`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    })
    if (resp.ok) { const data = await resp.json(); productCache.set(query, data); return data }
  } catch {}
  return null
}

const UNIT_MAP = {
  'unidad': 1, 'unidades': 1, 'unidades de': 1,
  'cucharada': 15, 'cucharadas': 15, 'cucharadas de': 15,
  'cucharadita': 5, 'cucharaditas': 5, 'cucharaditas de': 5,
  'taza': 240, 'tazas': 240, 'tazas de': 240,
  'kilo': 1000, 'kilos': 1000, 'kilos de': 1000,
  'gramo': 1, 'gramos': 1, 'gramos de': 1,
  'litro': 1000, 'litros': 1000, 'litros de': 1000,
  'mililitro': 1, 'mililitros': 1, 'mililitros de': 1,
  'sobre': 1, 'sobres': 1, 'sobres de': 1,
  'paquete': 1, 'paquetes': 1, 'paquetes de': 1,
  'lata': 1, 'latas': 1, 'latas de': 1,
  'botella': 1, 'botellas': 1, 'botellas de': 1,
  'diente': 1, 'dientes': 1, 'dientes de': 1,
  'rebanada': 1, 'rebanadas': 1, 'rebanadas de': 1,
  'pizca': 0.001, 'pizcas de': 0.001,
}

function calcProductQty(cantidad, unidad) {
  const factor = UNIT_MAP[unidad.toLowerCase()]
  if (!factor) return { cantidad_producto: 1, nota: 'unidad' }
  const base = cantidad * factor
  if (base <= 0) return { cantidad_producto: 1, nota: 'c/n' }
  if (factor === 1) return { cantidad_producto: Math.ceil(cantidad), nota: `${cantidad} und` }
  if (base < 250) return { cantidad_producto: 1, nota: `~${base}g/ml` }
  if (base < 1000) return { cantidad_producto: 1, nota: `~${base}ml` }
  return { cantidad_producto: Math.ceil(base / 1000), nota: `~${(base/1000).toFixed(1)}kg` }
}

async function main() {
  const results = []
  let mapped = 0, unmapped = 0

  for (let i = 0; i < myRecipes.length; i++) {
    const r = myRecipes[i]
    const pct = ((i + 1) / myRecipes.length * 100).toFixed(0)
    process.stdout.write(`\r  [W${chunkIndex} ${pct}%] ${r.titulo.substring(0, 40).padEnd(42)} `)

    for (const ing of r.ingredients || []) {
      let product = null
      let products = await directSearch(ing.nombre)
      if (!products || products.length === 0) products = await searchProduct(ing.nombre)
      if (products && products.length > 0) product = products[0]

      const conv = calcProductQty(ing.cantidad, ing.unidad)

      if (product) {
        results.push({
          recipe_slug: r.slug,
          product_id: product.id,
          ingredient_raw: ing.raw,
          cantidad_recipe: ing.cantidad,
          unidad_recipe: ing.unidad,
          cantidad_producto: conv.cantidad_producto,
          mapeado: true,
          notas: conv.nota,
        })
        mapped++
      } else {
        results.push({
          recipe_slug: r.slug,
          product_id: null,
          ingredient_raw: ing.raw,
          cantidad_recipe: ing.cantidad,
          unidad_recipe: ing.unidad,
          cantidad_producto: 0,
          mapeado: false,
          notas: `No encontrado: ${ing.nombre}`,
        })
        unmapped++
      }
    }
  }

  const outPath = `scripts/output/mapping-chunk-${chunkIndex}.json`
  writeFileSync(outPath, JSON.stringify(results, null, 2))
  console.log(`\n  [W${chunkIndex}] Done: ${mapped} mapped, ${unmapped} unmapped → ${outPath}`)
}

main().catch(e => { console.error(`Worker ${chunkIndex} error:`, e.message); process.exit(1) })
