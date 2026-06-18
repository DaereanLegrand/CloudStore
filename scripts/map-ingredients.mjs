import { readFileSync, writeFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:3333'
const SERVICE_KEY = process.env.SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODE3NTgxMTgsImV4cCI6MjA5NzExODExOH0.1kr05HglaLLweQp-cXUy3NnA1vCf7ImoTQPAfk2sLjo'
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://172.17.0.1:11434/api/embeddings'
const REST_URL = `${SUPABASE_URL}/rest/v1`

const UNIT_CONVERSIONS = {
  'unidad': { base: 'unidad', factor: 1 },
  'unidades': { base: 'unidad', factor: 1 },
  'unidades de': { base: 'unidad', factor: 1 },
  'cucharada': { base: 'ml', factor: 15 },
  'cucharadas': { base: 'ml', factor: 15 },
  'cucharadas de': { base: 'ml', factor: 15 },
  'cucharadita': { base: 'ml', factor: 5 },
  'cucharaditas': { base: 'ml', factor: 5 },
  'cucharaditas de': { base: 'ml', factor: 5 },
  'taza': { base: 'ml', factor: 240 },
  'tazas': { base: 'ml', factor: 240 },
  'tazas de': { base: 'ml', factor: 240 },
  'rebanada': { base: 'unidad', factor: 1 },
  'rebanadas': { base: 'unidad', factor: 1 },
  'rebanadas de': { base: 'unidad', factor: 1 },
  'kilo': { base: 'kg', factor: 1 },
  'kilos': { base: 'kg', factor: 1 },
  'kilos de': { base: 'kg', factor: 1 },
  'gramo': { base: 'kg', factor: 0.001 },
  'gramos': { base: 'kg', factor: 0.001 },
  'gramos de': { base: 'kg', factor: 0.001 },
  'mililitro': { base: 'ml', factor: 1 },
  'mililitros': { base: 'ml', factor: 1 },
  'mililitros de': { base: 'ml', factor: 1 },
  'litro': { base: 'ml', factor: 1000 },
  'litros': { base: 'ml', factor: 1000 },
  'litros de': { base: 'ml', factor: 1000 },
  'diente': { base: 'unidad', factor: 1 },
  'dientes': { base: 'unidad', factor: 1 },
  'dientes de': { base: 'unidad', factor: 1 },
  'sobre': { base: 'unidad', factor: 1 },
  'sobres': { base: 'unidad', factor: 1 },
  'sobres de': { base: 'unidad', factor: 1 },
  'paquete': { base: 'unidad', factor: 1 },
  'paquetes': { base: 'unidad', factor: 1 },
  'paquetes de': { base: 'unidad', factor: 1 },
  'lata': { base: 'unidad', factor: 1 },
  'latas': { base: 'unidad', factor: 1 },
  'latas de': { base: 'unidad', factor: 1 },
  'botella': { base: 'unidad', factor: 1 },
  'botellas': { base: 'unidad', factor: 1 },
  'botellas de': { base: 'unidad', factor: 1 },
  'pizca': { base: 'unidad', factor: 0.001 },
  'pizcas': { base: 'unidad', factor: 0.001 },
  'pizcas de': { base: 'unidad', factor: 0.001 },
  'gota': { base: 'unidad', factor: 0.001 },
  'gotas': { base: 'unidad', factor: 0.001 },
  'gotas de': { base: 'unidad', factor: 0.001 },
}

const COMMON_PRODUCT_WEIGHTS = {
  'cebolla': 150,
  'cebolla roja': 150,
  'tomate': 120,
  'papa': 200,
  'papa amarilla': 200,
  'huevo': 60,
  'limon': 80,
  'naranja': 200,
  'platano': 150,
  'manzana': 180,
  'zanahoria': 80,
  'diente ajo': 5,
}

async function getEmbedding(text) {
  const resp = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'bge-m3', prompt: text.substring(0, 512) })
  })
  if (!resp.ok) throw new Error(`Ollama error: ${await resp.text()}`)
  const data = await resp.json()
  return data.embedding
}

async function searchProduct(query, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const embedding = await getEmbedding(query)

      const resp = await fetch(`${REST_URL}/rpc/hybrid_search`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_embedding: embedding,
          text_query: query,
          match_count: 5,
          vector_threshold: 0.1,
          keyword_boost: 0.3,
        })
      })
      if (!resp.ok) throw new Error(`Search error: ${resp.status} ${await resp.text()}`)
      return await resp.json()
    } catch (err) {
      if (attempt < retries) await new Promise(r => setTimeout(r, 1000))
      else throw err
    }
  }
}

function extractProductSize(titulo) {
  const match = titulo.match(/(\d+\.?\d*)\s*(kg|g|ml|l|lt|lb|oz|un|und)\b/i)
  if (!match) return null
  let value = parseFloat(match[1])
  const unit = match[2].toLowerCase()
  if (unit === 'g') value = value / 1000
  if (unit === 'ml') value = value / 1000
  if (unit === 'lb') value = value * 0.453
  if (unit === 'oz') value = value * 0.028
  return { value, unit: (unit === 'kg' || unit === 'g') ? 'kg' : (unit === 'ml' || unit === 'l' || unit === 'lt') ? 'ml' : 'unidad' }
}

function convertAndRound(cantidad, unidadOrigen, targetPrice) {
  const conv = UNIT_CONVERSIONS[unidadOrigen.toLowerCase()]
  if (!conv) return { cantidad_producto: Math.ceil(cantidad), nota: 'unidad estimada' }

  const baseAmount = cantidad * conv.factor

  if (conv.base === 'unidad') return { cantidad_producto: Math.ceil(cantidad), nota: `${cantidad} ${unidadOrigen}` }

  if (conv.base === 'ml') {
    if (baseAmount <= 250) return { cantidad_producto: 1, nota: `${baseAmount}ml (producto individual)` }
    if (baseAmount <= 1000) return { cantidad_producto: 1, nota: `~${baseAmount}ml (1 botella/paquete)` }
    return { cantidad_producto: Math.ceil(baseAmount / 1000), nota: `~${baseAmount}ml (~${Math.ceil(baseAmount / 1000)} unidades)` }
  }

  if (conv.base === 'kg') {
    if (baseAmount <= 0.5) return { cantidad_producto: 1, nota: `~${(baseAmount * 1000).toFixed(0)}g` }
    if (baseAmount <= 2) return { cantidad_producto: 1, nota: `~${baseAmount.toFixed(2)}kg` }
    return { cantidad_producto: Math.ceil(baseAmount), nota: `~${baseAmount.toFixed(2)}kg (${Math.ceil(baseAmount)} paquetes)` }
  }

  return { cantidad_producto: Math.ceil(cantidad), nota: `${cantidad} ${unidadOrigen}` }
}

const embeddingCache = new Map()
const DIRECT_PRODUCT_CACHE = new Map()

async function fastSearchProduct(query) {
  const lower = query.toLowerCase()
  if (DIRECT_PRODUCT_CACHE.has(lower)) return DIRECT_PRODUCT_CACHE.get(lower)
  try {
    const resp = await fetch(`${REST_URL}/products?select=id,titulo,precio,categoria&or=(titulo.ilike.*${encodeURIComponent(lower)}*,descripcion.ilike.*${encodeURIComponent(lower)}*)&limit=5&order=precio.asc`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    })
    if (resp.ok) {
      const data = await resp.json()
      if (data && data.length > 0) {
        DIRECT_PRODUCT_CACHE.set(lower, data)
        return data
      }
    }
  } catch {}
  return null
}

async function main() {
  const recipes = JSON.parse(readFileSync('scripts/output/nestle-recipes.json', 'utf-8'))
  console.log(`Mapping ingredients for ${recipes.length} recipes...`)

  const allIngredients = []
  let totalMapped = 0
  let totalUnmapped = 0

  for (let ri = 0; ri < recipes.length; ri++) {
    const recipe = recipes[ri]
    const pct = ((ri + 1) / recipes.length * 100).toFixed(1)
    process.stdout.write(`\r  [${pct}%] Recipe ${ri + 1}/${recipes.length}: ${recipe.titulo.substring(0, 40).padEnd(42)} `)

    const mappedIngredients = []

    for (const ing of recipe.ingredients || []) {
      const lowerName = ing.nombre.toLowerCase()

      let bestMatch = null
      let bestScore = 0
      let products = null

      const keyWords = lowerName.split(/\s+/).filter(w => w.length > 2)
      const simpleIngredient = keyWords.length <= 3

      if (simpleIngredient) {
        products = await fastSearchProduct(keyWords.slice(0, 2).join(' '))
      }

      if (!products) {
        try {
          products = await searchProduct(ing.nombre, 1)
        } catch {
          products = await fastSearchProduct(ing.nombre)
        }
      }

      if (products && products.length > 0) {
        // Filter by relevance: prefer products where the ingredient name appears in the title
        for (const p of products) {
          const titleLower = p.titulo.toLowerCase()
          const nameWords = lowerName.split(/\s+/).filter(w => w.length > 2)
          const matchCount = nameWords.filter(w => titleLower.includes(w)).length
          const relevanceScore = (p.similarity || 0) + (matchCount / Math.max(nameWords.length, 1)) * 0.3
          if (relevanceScore > bestScore) {
            bestScore = relevanceScore
            bestMatch = p
          }
        }
      }

      if (bestMatch && bestScore > 0.15) {
        const conversion = convertAndRound(ing.cantidad, ing.unidad, bestMatch.precio)
        mappedIngredients.push({
          recipe_slug: recipe.slug,
          product_id: bestMatch.id,
          ingredient_raw: ing.raw,
          cantidad_recipe: ing.cantidad,
          unidad_recipe: ing.unidad,
          cantidad_producto: conversion.cantidad_producto,
          es_opcional: false,
          mapeado: true,
          notas: conversion.nota
        })
        totalMapped++
      } else {
        mappedIngredients.push({
          recipe_slug: recipe.slug,
          product_id: null,
          ingredient_raw: ing.raw,
          cantidad_recipe: ing.cantidad,
          unidad_recipe: ing.unidad,
          cantidad_producto: 0,
          es_opcional: false,
          mapeado: false,
          notas: `No se encontró producto para: ${ing.nombre}`
        })
        totalUnmapped++
      }

      if ((totalMapped + totalUnmapped) % 20 === 0) await new Promise(r => setTimeout(r, 10))
    }

    allIngredients.push(...mappedIngredients)

    if ((ri + 1) % 20 === 0) {
      const reportPath = `scripts/output/ingredient-mapping.json`
      writeFileSync(reportPath, JSON.stringify({
        total_recipes: recipes.length,
        total_mapped: totalMapped,
        total_unmapped: totalUnmapped,
        ingredients: allIngredients
      }, null, 2))
    }
  }

  const reportPath = `scripts/output/ingredient-mapping.json`
  writeFileSync(reportPath, JSON.stringify({
    total_recipes: recipes.length,
    total_mapped: totalMapped,
    total_unmapped: totalUnmapped,
    ingredients: allIngredients
  }, null, 2))

  console.log(`\n\nMapping complete:`)
  console.log(`  Total ingredients: ${totalMapped + totalUnmapped}`)
  console.log(`  Mapped: ${totalMapped}`)
  console.log(`  Unmapped: ${totalUnmapped}`)
  console.log(`  Report: ${reportPath}`)
}

main().catch(console.error)
