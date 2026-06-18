import { writeFileSync, mkdirSync } from 'fs'

const BASE = 'https://www.radioshack.com'
const SITEMAP_URL = `${BASE}/media/google_sitemap_1.xml`

const CATEGORY_MAP = {
  'headphones': 'electronica',
  'speakers': 'electronica',
  'audio': 'electronica',
  'video': 'electronica',
  'gaming': 'electronica',
  'computer-accessories': 'electronica',
  'mobile-accessories': 'electronica',
  'storage-and-memory': 'electronica',
  'cables-connectivity': 'electronica',
  'batteries': 'electronica',
  'smart-home': 'hogar',
  'home-office': 'hogar',
  'travel-lifestyle': 'hogar',
  'apparel': 'ropa',
  'toys': 'otros',
  'drones': 'electronica',
}

function mapCategory(rsCat) {
  if (!rsCat) return 'electronica'
  const lower = rsCat.toLowerCase().replace(/\s+/g, '-')
  const parts = lower.split('/')
  for (const part of parts) {
    if (CATEGORY_MAP[part]) return CATEGORY_MAP[part]
    for (const [key, val] of Object.entries(CATEGORY_MAP)) {
      if (part.includes(key)) return val
    }
  }
  return 'electronica'
}

function extractCategoryPath(url) {
  const match = url.match(/\/c\/(.+)/)
  if (!match) return ''
  return match[1].replace(/\/$/, '')
}

async function fetchSitemapCategories() {
  console.log('1. Fetching sitemap...')
  const res = await fetch(SITEMAP_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  })
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`)
  const xml = await res.text()

  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
  const categories = urls
    .map(url => ({ url, path: extractCategoryPath(url) }))
    .filter(c => c.path && c.path !== 'collection' && !c.path.startsWith('collection/') && !c.path.startsWith('hotjar'))

  console.log(`   Found ${categories.length} category URLs (excluding collections)`)
  return categories
}

async function fetchProductUrls(categoryUrl) {
  const urls = []
  let page = 1
  while (true) {
    const url = `${categoryUrl}?p=${page}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    })
    if (!res.ok) break
    const html = await res.text()

    const productLinks = [...html.matchAll(/<a[^>]*class="product-item-link"[^>]*href="([^"]*)"[^>]*>/g)]
    if (productLinks.length === 0) break

    for (const m of productLinks) {
      const href = m[1]
      if (href && href.endsWith('/p')) urls.push(href.startsWith('http') ? href : `${BASE}${href}`)
    }

    const hasNext = html.includes(`?p=${page + 1}`) || html.includes(`p=${page + 1}"`)
    if (!hasNext) break
    page++
    await new Promise(r => setTimeout(r, 500))
  }
  return urls
}

async function fetchProductData(productUrl, categoryPath) {
  const res = await fetch(productUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  })
  if (!res.ok) return null
  const html = await res.text()

  const jsonldBlocks = [...html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>\s*(\{.*?\})\s*<\/script>/gs
  )]
  let productData = null
  for (const b of jsonldBlocks) {
    try {
      const d = JSON.parse(b[1])
      if (d['@type'] === 'Product') { productData = d; break }
    } catch { }
  }
  if (!productData) return null

  const offer = productData.offers?.[0] || {}
  const price = parseFloat(offer.price) || 0
  if (price <= 0) return null

  const inStock = offer.availability?.includes('InStock') || false
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
  const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/)
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)
  const priceMatch = html.match(/data-price-amount="([\d.]+)"/)

  const effectivePrice = parseFloat(priceMatch?.[1]) || price

  const catPath = categoryPath || extractCategoryPath(html.match(/\/c\/([^"']+)/)?.[1] || '')
  const categoria = mapCategory(catPath)

  function decodeEntities(s) {
    if (!s) return ''
    return s.replace(/&#x(\w+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  }
  return {
    titulo: decodeEntities(ogTitleMatch?.[1] || productData.name || '').trim(),
    descripcion: decodeEntities(productData.description || ogDescMatch?.[1] || '').substring(0, 500).trim(),
    precio: effectivePrice,
    precio_original: effectivePrice,
    stock: inStock ? 1 : 0,
    categoria,
    imagen_url: (productData.image || ogImageMatch?.[1] || '').split('?')[0],
    marca: productData.brand?.name || '',
    sku: productData.sku || '',
    link: productUrl,
  }
}

async function main() {
  const categories = await fetchSitemapCategories()
  const seenUrls = new Set()
  const allProductUrls = []

  console.log('2. Collecting product URLs from categories...')
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i]
    const urls = await fetchProductUrls(cat.url)
    const newUrls = urls.filter(u => !seenUrls.has(u))
    for (const u of newUrls) seenUrls.add(u)
    allProductUrls.push(...newUrls.map(u => ({ url: u, category: cat.path })))
    console.log(`   [${i + 1}/${categories.length}] ${cat.path}: ${urls.length} products (${newUrls.length} new, ${seenUrls.size} total unique)`)
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log(`\n3. Fetching product details for ${allProductUrls.length} products...`)
  const products = []
  const batchSize = 5
  const startTime = Date.now()

  for (let i = 0; i < allProductUrls.length; i += batchSize) {
    const batch = allProductUrls.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(p => fetchProductData(p.url, p.category))
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        products.push(r.value)
      }
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const done = Math.min(i + batchSize, allProductUrls.length)
    process.stdout.write(`\r   ${done}/${allProductUrls.length} products fetched (${elapsed}s, ${products.length} valid)`)
    if (i + batchSize < allProductUrls.length) {
      await new Promise(r => setTimeout(r, 800))
    }
  }

  console.log(`\n\n4. Done: ${products.length} products scraped`)

  if (products.length) {
    mkdirSync('scripts/output', { recursive: true })
    writeFileSync('scripts/output/radioshack-products.json', JSON.stringify(products, null, 2))
    console.log('   Saved to scripts/output/radioshack-products.json')
    console.log('   Sample:', JSON.stringify(products[0], null, 2).substring(0, 400))
  }
}

const thisFile = process.argv[1]
if (thisFile && (thisFile.endsWith('/scraper-radioshack.mjs') || thisFile.endsWith('\\scraper-radioshack.mjs'))) {
  main().catch(console.error)
}
