import { readFileSync, writeFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:3333'
const SERVICE_KEY = process.env.SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODE3NTgxMTgsImV4cCI6MjA5NzExODExOH0.1kr05HglaLLweQp-cXUy3NnA1vCf7ImoTQPAfk2sLjo'
const REST_URL = `${SUPA_URL}/rest/v1`

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
}

async function main() {
  const recipes = JSON.parse(readFileSync('scripts/output/nestle-recipes.json', 'utf-8'))
  let mappingData = { ingredients: [] }
  try {
    mappingData = JSON.parse(readFileSync('scripts/output/ingredient-mapping.json', 'utf-8'))
  } catch {}

  const ingBySlug = {}
  for (const ing of mappingData.ingredients || []) {
    if (!ingBySlug[ing.recipe_slug]) ingBySlug[ing.recipe_slug] = []
    ingBySlug[ing.recipe_slug].push(ing)
  }

  let inserted = 0
  let skipped = 0

  for (let i = 0; i < recipes.length; i++) {
    const r = recipes[i]
    const pct = ((i + 1) / recipes.length * 100).toFixed(1)
    process.stdout.write(`\r  [${pct}%] ${i + 1}/${recipes.length}: ${r.titulo.substring(0, 40).padEnd(42)} `)

    const body = {
      slug: r.slug,
      titulo: r.titulo,
      descripcion: r.descripcion || '',
      instrucciones: JSON.stringify(r.instrucciones || []),
      categoria: r.categoria || '',
      dificultad: r.dificultad || 'facil',
      tiempo_preparacion: r.tiempo_preparacion || 0,
      porciones: r.porciones || 1,
      calorias: r.calorias || 0,
      imagen_url: r.imagen_url || '',
      url_origen: r.url_origen || '',
    }

    try {
      const resp = await fetch(`${REST_URL}/recipes?slug=eq.${encodeURIComponent(r.slug)}`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      })
      const existing = await resp.json()

      if (existing && existing.length > 0) {
        skipped++
        process.stdout.write(`SKIPPED (exists)`)
        continue
      }

      const insertResp = await fetch(`${REST_URL}/recipes`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(body)
      })

      if (!insertResp.ok) {
        const text = await insertResp.text()
        process.stdout.write(`ERR: ${text.substring(0, 50)}`)
        continue
      }

      // Get the inserted recipe ID
      const getResp = await fetch(`${REST_URL}/recipes?select=id&slug=eq.${encodeURIComponent(r.slug)}`, {
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
      })
      const recipeData = await getResp.json()
      const recipeId = recipeData?.[0]?.id
      if (!recipeId) {
        process.stdout.write(`ERR: no ID returned`)
        continue
      }

      // Insert mapped ingredients
      const mappedIngs = ingBySlug[r.slug] || []
      for (const ing of mappedIngs) {
        const ingBody = {
          recipe_id: recipeId,
          product_id: ing.product_id,
          ingredient_raw: ing.ingredient_raw,
          cantidad_recipe: ing.cantidad_recipe,
          unidad_recipe: ing.unidad_recipe,
          cantidad_producto: ing.cantidad_producto,
          es_opcional: ing.es_opcional || false,
          mapeado: ing.mapeado || false,
          notas: ing.notas || '',
        }
        await fetch(`${REST_URL}/recipe_ingredients`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(ingBody)
        }).catch(() => {})
      }

      inserted++
      process.stdout.write(`OK (${mappedIngs.length} ingredientes)`)
    } catch (err) {
      process.stdout.write(`ERR: ${err.message.substring(0, 50)}`)
    }
  }

  console.log(`\n\nDone: ${inserted} inserted, ${skipped} skipped`)
}

main().catch(console.error)
