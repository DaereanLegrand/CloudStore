import { readFileSync, writeFileSync } from "fs"

const REST_URL = "http://localhost:3333/rest/v1"
const SERVICE_KEY = process.env.SERVICE_KEY
const OLLAMA_URL = process.env.OLLAMA_URL || "http://172.17.0.1:11434/api/embeddings"
const HEADERS = { "apikey": SERVICE_KEY, "Authorization": "Bearer " + SERVICE_KEY }

const UNIT_WORDS = new Set([
  "rebanada","rebanadas","cucharada","cucharadas","cucharadita","cucharaditas",
  "taza","tazas","unidad","unidades","kilo","kilos","gramo","gramos",
  "litro","litros","mililitro","mililitros","sobre","sobres","paquete","paquetes",
  "lata","latas","botella","botellas","diente","dientes","pizca","pizcas",
  "gota","gotas","rueda","ruedas","rama","ramas","hoja","hojas",
  "trocito","trocitos","pedazo","pedazos","cocido","cocida","molido","molidos",
  "mediana","mediano","grande","pequeno","pequena","en","polvo","fresco","fresca",
])

const PREFERRED_CATEGORIES = {
  "papa": "frutas-verduras", "papas": "frutas-verduras",
  "cebolla": "frutas-verduras", "tomate": "frutas-verduras",
  "zanahoria": "frutas-verduras", "zanahorias": "frutas-verduras",
  "ajo": "frutas-verduras", "ají": "frutas-verduras",
  "limon": "frutas-verduras", "naranja": "frutas-verduras",
  "platano": "frutas-verduras", "manzana": "frutas-verduras",
  "perejil": "frutas-verduras", "culantro": "frutas-verduras",
  "albahaca": "frutas-verduras", "hierbabuena": "frutas-verduras",
  "espinaca": "frutas-verduras", "lechuga": "frutas-verduras",
  "brocoli": "frutas-verduras", "coliflor": "frutas-verduras",
  "zapallo": "frutas-verduras", "camote": "frutas-verduras",
  "yuca": "frutas-verduras", "choclo": "frutas-verduras",
  "frejol": "frutas-verduras", "frijol": "frutas-verduras",
  "arveja": "frutas-verduras", "haba": "frutas-verduras",
  "palta": "frutas-verduras", "fresa": "frutas-verduras",
  "carne": "carnes", "pollo": "carnes", "res": "carnes",
  "cerdo": "carnes", "pescado": "carnes", "atun": "carnes",
  "pavo": "carnes", "chancho": "carnes",
  "leche": "lacteos", "queso": "lacteos", "yogurt": "lacteos",
  "huevo": "lacteos", "mantequilla": "lacteos",
  "pan": "panaderia", "panes": "panaderia",
}

function cleanIngredientName(raw) {
  return raw
    .replace(/^[\d\/\.\s]+/, "")
    .replace(/^(rebanadas?|cucharadas?|cucharaditas?|tazas?|unidades?|kilos?|gramos?|litros?|mililitros?|sobres?|paquetes?|latas?|botellas?|dientes?|pizcas?|gotas?|ruedas?|ramas?|hojas?|trocitos?|pedazos?)\s+(de\s+)?/i, "")
    .replace(/^(pasta|puré|pure|salsa|crema|caldo|polvo|jugo|concentrado)\s+de\s+/i, "")
    .replace(/^(cocid[ao]|molid[ao]s?|fresc[ao]s?)\s+/i, "")
    .trim()
}

function getSearchWords(cleaned) {
  return cleaned.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !UNIT_WORDS.has(w))
}

function scoreProduct(preferredWords, productTitle, productCategory) {
  const lower = productTitle.toLowerCase()
  let score = 0
  for (const w of preferredWords) {
    if (lower.startsWith(w)) score += 2
    else if (lower.includes(" " + w)) score += 1.5
    else if (lower.includes(w)) score += 0.5
  }
  // Category bonus: if the ingredient has a preferred category and product matches it, +1
  for (const w of preferredWords) {
    const prefCat = PREFERRED_CATEGORIES[w]
    if (prefCat && productCategory === prefCat) {
      score += 1
      break
    }
  }
  return score
}

async function findBestProduct(ingredientRaw) {
  const cleaned = cleanIngredientName(ingredientRaw)
  const preferredWords = getSearchWords(cleaned)
  if (preferredWords.length === 0) return null

  // Try semantic search (only for multi-word ingredients to save time)
  if (preferredWords.length >= 2) {
    try {
      const embResp = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "bge-m3", prompt: cleaned.substring(0, 300) })
      })
      if (embResp.ok) {
        const embData = await embResp.json()
        if (embData.embedding && !embData.embedding.some(v => Number.isNaN(v))) {
          const rpcResp = await fetch(REST_URL + "/rpc/hybrid_search", {
            method: "POST",
            headers: { ...HEADERS, "Content-Type": "application/json" },
            body: JSON.stringify({
              query_embedding: embData.embedding,
              text_query: cleaned,
              match_count: 10,
              vector_threshold: 0.05,
              keyword_boost: 0.4
            })
          })
          if (rpcResp.ok) {
            const results = await rpcResp.json()
            if (results && results.length > 0) {
              for (const p of results) {
                p._positionScore = scoreProduct(preferredWords, p.titulo, p.categoria)
              }
              results.sort((a, b) => {
                if (b._positionScore !== a._positionScore) return b._positionScore - a._positionScore
                return b.similarity - a.similarity
              })
              const best = results[0]
              if (best._positionScore >= 1 || (best.similarity >= 0.3 && best._positionScore >= 0.5)) {
                return { product: best, method: "semantic" }
              }
            }
          }
        }
      }
    } catch {}
  }

  // Fallback: direct ILIKE, then re-rank
  for (let len = Math.min(preferredWords.length, 3); len >= 1; len--) {
    const searchTerms = preferredWords.slice(0, len)
    try {
      const resp = await fetch(
        REST_URL + "/products?select=id,titulo,precio,categoria&titulo=ilike.*" +
        encodeURIComponent(searchTerms.join(" ")) + "*&limit=10&order=precio.asc",
        { headers: HEADERS }
      )
      if (resp.ok) {
        const data = await resp.json()
        if (data && data.length > 0) {
          for (const p of data) {
            p._positionScore = scoreProduct(preferredWords, p.titulo, p.categoria)
          }
          data.sort((a, b) => b._positionScore - a._positionScore)
          if (data[0]._positionScore >= 1) {
            return { product: data[0], method: "ilike" }
          }
        }
      }
    } catch {}
  }
  return null
}

async function main() {
  // Get ALL recipe ingredients that are mapped
  const resp = await fetch(REST_URL + "/recipe_ingredients?select=id,recipe_id,ingredient_raw,mapeado,product_id&order=id&limit=5000", {
    headers: HEADERS
  })
  const allIngredients = await resp.json()

  console.log(`Total ingredients: ${allIngredients.length}`)

  let fixed = 0
  let skipped = 0

  for (let i = 0; i < allIngredients.length; i++) {
    const ing = allIngredients[i]
    // Only re-map ingredients that already have a product (check for bad mappings)
    // We'll re-map ALL of them with the improved scoring
    const result = await findBestProduct(ing.ingredient_raw)

    const oldPid = ing.product_id
    const newPid = result?.product?.id || null

    if (newPid && newPid !== oldPid) {
      // Update the mapping
      await fetch(REST_URL + "/recipe_ingredients?id=eq." + ing.id, {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({
          product_id: newPid,
          mapeado: true,
          notas: result?.product?.titulo || "1 unidad",
          cantidad_producto: 1
        })
      })
      fixed++
      process.stdout.write("✓")
    } else if (!newPid && oldPid) {
      // Was mapped, now unmapped (better than wrong mapping)
      await fetch(REST_URL + "/recipe_ingredients?id=eq." + ing.id, {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({
          product_id: null,
          mapeado: false,
          notas: "No encontrado (remapping)"
        })
      })
      fixed++
      process.stdout.write("✗")
    } else {
      skipped++
    }

    if ((i + 1) % 50 === 0) {
      process.stdout.write(` [${i + 1}/${allIngredients.length} fixed=${fixed}]\n`)
    }
  }

  console.log(`\n\nDone: ${fixed} fixed, ${skipped} unchanged`)
}

main().catch(console.error)
