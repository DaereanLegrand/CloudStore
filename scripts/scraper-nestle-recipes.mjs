import { writeFileSync, mkdirSync } from 'fs'

const SITEMAP_URL = 'https://www.recetasnestle.com.pe/sites/default/files/google_image_sitemap/google_image_sitemap_srh_recipe.xml'
const BASE = 'https://www.recetasnestle.com.pe'
const OUTPUT_DIR = 'scripts/output'
const OUTPUT_FILE = `${OUTPUT_DIR}/nestle-recipes.json`

const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchSitemapUrls() {
  const resp = await fetch(SITEMAP_URL)
  const xml = await resp.text()
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1].trim())
  const recipeUrls = urls.filter(u => u.includes('/recetas/'))
  console.log(`Found ${recipeUrls.length} recipe URLs in sitemap`)
  return [...new Set(recipeUrls)]
}

function parseDuration(iso) {
  if (!iso) return 0
  const match = iso.match(/PT(\d+H)?(\d+M)?/)
  if (!match) return 0
  const h = parseInt(match[1]) || 0
  const m = parseInt(match[2]) || 0
  return h * 60 + m
}

function parseIngredients(ingredients, servings) {
  return ingredients.map(raw => {
    const trimmed = raw.trim()
    const match = trimmed.match(/^([\d\s\/\.\,]+)?\s*(.+)$/)
    let cantidad = 1
    let unidad = ''
    let nombre = trimmed

    if (match) {
      const qtyStr = match[1]?.trim()
      nombre = match[2]?.trim() || trimmed
      if (qtyStr) {
        try {
          if (qtyStr.includes('/')) {
            const [num, den] = qtyStr.split('/')
            cantidad = parseFloat(num) / parseFloat(den)
          } else {
            cantidad = parseFloat(qtyStr.replace(',', '.'))
          }
        } catch { cantidad = 1 }
        if (isNaN(cantidad)) cantidad = 1
      }
      const unitMatch = nombre.match(/^(Unidades?\s+de|Cucharadas?\s+de|Cucharaditas?\s+de|Tazas?\s+de|Rebanadas?\s+de|Kilos?\s+de|Gramos?\s+de|Mililitros?\s+de|Litros?\s+de|Dientes?\s+de|Ramas?\s+de|Hojas?\s+de|Sobres?\s+de|Paquetes?\s+de|Latas?\s+de|Botellas?\s+de|Pizcas?\s+de|Gotas?\s+de|Ruedas?\s+de|Unidad|Cucharada|Cucharadita|Taza|Rebanada|Kilo|Gramo|Mililitro|Litro|Diente|Rama|Hoja|Sobre|Paquete|Lata|Botella|Pizca|Gota|Rueda)\s+(.+)$/i)
      if (unitMatch) {
        unidad = unitMatch[1].toLowerCase()
        nombre = unitMatch[2]
      }
    }

    return { raw: trimmed, cantidad, unidad, nombre: nombre.trim() }
  })
}

async function scrapeRecipe(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CloudStore/1.0)' }
    })
    if (!resp.ok) {
      console.error(`  HTTP ${resp.status} for ${url}`)
      return null
    }
    const html = await resp.text()

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)
    if (!jsonLdMatch) {
      console.error(`  No JSON-LD found for ${url}`)
      return null
    }

    let data
    try {
      data = JSON.parse(jsonLdMatch[1])
    } catch {
      console.error(`  Failed to parse JSON-LD for ${url}`)
      return null
    }

    const recipe = data['@graph'] ? data['@graph'].find(g => g['@type'] === 'Recipe') : data
    if (!recipe) {
      console.error(`  No Recipe type in JSON-LD for ${url}`)
      return null
    }

    const slug = url.replace(BASE, '').replace('/recetas/', '')
  const instructions = recipe.recipeInstructions || []
  if (instructions.length === 0 && recipe.recipeInstructionsRaw) {
    instructions.push({ text: recipe.recipeInstructionsRaw })
  }
  const instrucciones = instructions.map((section, si) => {
      if (section['@type'] === 'HowToSection' && section.itemListElement) {
        return {
          section: section.name,
          steps: section.itemListElement.map((step, i) => ({
            step: i + 1,
            text: step.text
          }))
        }
      }
      return {
        section: `Paso ${si + 1}`,
        steps: [{ step: 1, text: section.text || section }]
      }
    })

    const ingredients = parseIngredients(recipe.recipeIngredient || [], recipe.recipeYield || 1)

    return {
      slug,
      titulo: recipe.name,
      descripcion: recipe.description || '',
      instrucciones,
      categoria: recipe.recipeCategory || '',
      dificultad: mapDifficulty(recipe.keywords || ''),
      tiempo_preparacion: parseDuration(recipe.totalTime) || parseDuration(recipe.cookTime) + parseDuration(recipe.prepTime),
      porciones: parseInt(recipe.recipeYield) || 1,
      calorias: recipe.nutrition?.calories ? parseInt(recipe.nutrition.calories) : 0,
      imagen_url: (() => {
        const img = recipe.image
        if (!img) return ''
        let url = ''
        if (typeof img === 'string') url = img
        else if (Array.isArray(img.url)) url = img.url[0]
        else if (typeof img.url === 'string') url = img.url
        else if (typeof img === 'object') url = img.representativeOfPage ? (Array.isArray(img.url) ? img.url[0] : '') : ''
        if (!url) return ''
        return url.startsWith('http') ? url : `${BASE}${url}`
      })(),
      url_origen: url,
      ingredients
    }
  } catch (err) {
    console.error(`  Error scraping ${url}: ${err.message}`)
    return null
  }
}

function mapDifficulty(keywords) {
  const kw = (keywords || '').toLowerCase()
  if (kw.includes('intermedio')) return 'medio'
  if (kw.includes('dificil')) return 'dificil'
  return 'facil'
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const urls = await fetchSitemapUrls()
  const recipes = []
  const errors = []

  for (let i = 0; i < urls.length; i++) {
    const pct = ((i + 1) / urls.length * 100).toFixed(1)
    process.stdout.write(`\r  [${pct}%] ${i + 1}/${urls.length} scraping...`)

    const recipe = await scrapeRecipe(urls[i])
    if (recipe) {
      recipes.push(recipe)
    } else {
      errors.push(urls[i])
    }

    if ((i + 1) % 10 === 0) {
      writeFileSync(OUTPUT_FILE, JSON.stringify(recipes, null, 2))
      process.stdout.write(` (${recipes.length} saved)`)
    }

    await delay(500 + Math.random() * 500)
  }

  writeFileSync(OUTPUT_FILE, JSON.stringify(recipes, null, 2))
  console.log(`\n\nDone: ${recipes.length} recipes scraped, ${errors.length} errors`)
  if (errors.length > 0) {
    writeFileSync(`${OUTPUT_DIR}/nestle-recipes-errors.json`, JSON.stringify(errors, null, 2))
    console.log(`Errors saved to ${OUTPUT_DIR}/nestle-recipes-errors.json`)
  }
}

main().catch(console.error)
