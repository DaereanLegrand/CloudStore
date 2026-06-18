import { writeFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:3333'
const SERVICE_KEY = process.env.SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODE3NTgxMTgsImV4cCI6MjA5NzExODExOH0.1kr05HglaLLweQp-cXUy3NnA1vCf7ImoTQPAfk2sLjo'
const OLLAMA_URL = 'http://localhost:11434/api/embeddings'
const EMBED_MODEL = 'bge-m3'
const BATCH_SIZE = 5

const restUrl = `${SUPABASE_URL}/rest/v1`

async function fetchAllProducts() {
  const allProducts = []
  let offset = 0
  const pageLimit = 500
  while (true) {
    const url = `${restUrl}/products?select=id,titulo,descripcion&order=id&limit=${pageLimit}&offset=${offset}`
    const res = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Failed to fetch products: ${res.status} ${await res.text()}`)
    const page = await res.json()
    if (page.length === 0) break
    allProducts.push(...page)
    offset += page.length
  }
  return allProducts
}

async function generateEmbedding(text, retries = 2) {
  const cleanText = text.replace(/[^\x20-\x7E\s]/g, '').substring(0, 512)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: cleanText }),
      })
      if (!res.ok) {
        const body = await res.text()
        if (res.status === 500 && body.includes('NaN')) {
          if (attempt < retries) {
            const shorter = cleanText.substring(0, 100 * (attempt + 1))
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
            return await generateEmbedding(shorter, retries - attempt - 1)
          }
          throw new Error(`NaN error after ${retries} retries`)
        }
        throw new Error(`Ollama error: ${res.status} ${body}`)
      }
      const data = await res.json()
      if (data.embedding && data.embedding.some(v => Number.isNaN(v))) {
        throw new Error('NaN values in embedding')
      }
      return data.embedding
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      throw err
    }
  }
}

async function updateProductEmbedding(id, embedding) {
  const res = await fetch(`${restUrl}/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ embedding }),
  })
  if (!res.ok) throw new Error(`Update failed for ${id}: ${res.status}`)
}

async function main() {
  console.log('1. Fetching products...')
  const products = await fetchAllProducts()
  console.log(`   ${products.length} products found`)

  const results = []
  const startTime = Date.now()

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map(async (p) => {
      const text = [p.titulo, p.descripcion].filter(Boolean).join(' ').slice(0, 512)
      try {
        const embedding = await generateEmbedding(text)
        await updateProductEmbedding(p.id, embedding)
        return { id: p.id, titulo: p.titulo, status: 'ok' }
      } catch (err) {
        console.error(`   Error on "${p.titulo}": ${err.message}`)
        return { id: p.id, titulo: p.titulo, status: 'error', error: err.message }
      }
    })

    const batchResults = await Promise.allSettled(batchPromises)
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value)
    }

    const done = Math.min(i + BATCH_SIZE, products.length)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    process.stdout.write(`\r   ${done}/${products.length} (${elapsed}s)`)
  }

  console.log('\n')
  const ok = results.filter(r => r.status === 'ok').length
  const errors = results.filter(r => r.status === 'error').length
  console.log(`2. Done: ${ok} ok, ${errors} errors`)

  const reportPath = 'scripts/output/embedding-report.json'
  writeFileSync(reportPath, JSON.stringify(results, null, 2))
  console.log(`   Report saved to ${reportPath}`)
}

main().catch(console.error)
