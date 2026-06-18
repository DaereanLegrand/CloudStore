import { writeFileSync, mkdirSync, existsSync } from 'fs'

const BASE = 'https://www.plazavea.com.pe'
const API = `${BASE}/api/catalog_system/pub/products/search`

async function getSitemapProductIds() {
  const seen = new Set()
  const ids = []
  for (let i = 1; i <= 20; i++) {
    const url = `${BASE}/sitemap/product-${i}.xml`
    try {
      const res = await fetch(url)
      if (!res.ok) { console.log(`  sitemap product-${i}.xml: ${res.status}`); continue }
      const xml = await res.text()
      const matches = xml.match(/<loc>([^<]+)<\/loc>/g)
      if (!matches) continue
      for (const loc of matches) {
        const slug = loc.replace(/<\/?loc>/g, '').trim().replace(/\/p$/, '').split('/').pop()
        if (slug && !seen.has(slug) && !slug.includes('sitemap')) {
          seen.add(slug)
          ids.push(slug)
        }
      }
      console.log(`  sitemap ${i}: ${matches.length} URLs, ${seen.size} unique`)
    } catch { break }
  }
  console.log(`Total unique product slugs: ${ids.length}`)
  return ids
}

async function fetchProductDetails(slug) {
  const url = `${API}?fq=linkText:${slug}&fq=productId:*`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!data || !data.length) return null
    return data[0]
  } catch { return null }
}

const CATEGORY_MAP = {
  'abarrotes': 'abarrotes',
  'aceite': 'abarrotes',
  'arroz': 'abarrotes',
  'azucar': 'abarrotes',
  'cafe': 'abarrotes',
  'cereales': 'abarrotes',
  'conservas': 'abarrotes',
  'especias': 'abarrotes',
  'harina': 'abarrotes',
  'menestras': 'abarrotes',
  'pasta': 'abarrotes',
  'sal': 'abarrotes',
  'salsas': 'abarrotes',
  'bebidas': 'bebidas',
  'aguas': 'bebidas',
  'gaseosas': 'bebidas',
  'jugos': 'bebidas',
  'lacteos': 'lacteos',
  'leches': 'lacteos',
  'yogurt': 'lacteos',
  'quesos': 'lacteos',
  'mantequilla': 'lacteos',
  'carnes': 'carnes',
  'pollo': 'carnes',
  'cerdo': 'carnes',
  'res': 'carnes',
  'pescados': 'carnes',
  'fiambres': 'fiambres',
  'jamon': 'fiambres',
  'salchichas': 'fiambres',
  'frutas': 'frutas-verduras',
  'verduras': 'frutas-verduras',
  'panaderia': 'panaderia',
  'pan': 'panaderia',
  'confiteria': 'snacks',
  'snacks': 'snacks',
  'galletas': 'snacks',
  'chocolates': 'snacks',
  'helados': 'congelados',
  'congelados': 'congelados',
  'mascotas': 'mascotas',
  'perros': 'mascotas',
  'gatos': 'mascotas',
  'cuidado personal': 'cuidado-personal',
  'shampoo': 'cuidado-personal',
  'jabones': 'cuidado-personal',
  'higiene': 'cuidado-personal',
  'hogar': 'hogar',
  'limpieza': 'hogar',
  'electronica': 'electronica',
  'electro': 'electronica',
  'televisores': 'electronica',
  'celulares': 'electronica',
  'deportes': 'deportes',
  'ropa': 'ropa',
  'bebes': 'bebes',
  'licores': 'licores',
  'cervezas': 'licores',
  'vinos': 'licores',
  'pisco': 'licores',
}

function mapCategory(catPath) {
  if (!catPath) return 'abarrotes'
  const lower = catPath.toLowerCase()
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value
  }
  const parts = catPath.split('/').filter(Boolean)
  if (parts.length) return parts[0].toLowerCase().replace(/\s+/g, '-')
  return 'abarrotes'
}

function extractProduct(p) {
  const item = p.items?.[0]
  const seller = item?.sellers?.[0]
  const offer = seller?.commertialOffer || {}
  const image = item?.images?.[0]?.imageUrl || ''
  const categoryPath = p.categories?.[0] || ''

  return {
    titulo: p.productName || '',
    descripcion: (p.description || p['Descripción del producto'] || '').substring(0, 500),
    precio: offer.Price || 0,
    precio_original: offer.ListPrice || offer.Price || 0,
    stock: Math.min(offer.AvailableQuantity || 0, 100),
    categoria: mapCategory(categoryPath),
    imagen_url: image,
    marca: p.brand || '',
    sku: item?.itemId || '',
    link: p.link || '',
    categoryPath,
  }
}

async function main() {
  console.log('1. Getting product slugs from sitemaps...')
  const slugs = await getSitemapProductIds()

  console.log(`\n2. Fetching product details for ${slugs.length} products...`)
  const products = []
  const batchSize = 5
  for (let i = 0; i < Math.min(slugs.length, 200); i += batchSize) {
    const batch = slugs.slice(i, i + batchSize)
    const results = await Promise.allSettled(batch.map(s => fetchProductDetails(s)))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const prod = extractProduct(r.value)
        if (prod.titulo && prod.precio > 0) {
          products.push(prod)
        }
      }
    }
    if ((i + batchSize) % 20 === 0 || i + batchSize >= 200) {
      console.log(`  processed ${Math.min(i + batchSize, 200)}/${Math.min(slugs.length, 200)}... ${products.length} valid products`)
    }
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n3. ${products.length} valid products extracted`)
  if (products.length) {
    const sample = products[0]
    console.log('Sample:', JSON.stringify(sample, null, 2).substring(0, 300))
  }

  mkdirSync('scripts/output', { recursive: true })
  writeFileSync('scripts/output/plazavea-products.json', JSON.stringify(products, null, 2))
  console.log('\nSaved to scripts/output/plazavea-products.json')
}

main().catch(console.error)
