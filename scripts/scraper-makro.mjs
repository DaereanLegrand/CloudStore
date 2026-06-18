import { writeFileSync, mkdirSync } from 'fs'

const API = 'https://www.makro.plazavea.com.pe/api/catalog_system/pub/products/search'
const BATCH_SIZE = 50

const CATEGORY_MAP = {
  'abarrotes': 'abarrotes',
  'aceite': 'abarrotes', 'arroz': 'abarrotes', 'azucar': 'abarrotes',
  'cafe': 'abarrotes', 'cereales': 'abarrotes', 'conservas': 'abarrotes',
  'especias': 'abarrotes', 'harina': 'abarrotes', 'menestras': 'abarrotes',
  'pasta': 'abarrotes', 'sal': 'abarrotes', 'salsas': 'abarrotes',
  'snacks': 'snacks', 'galletas': 'snacks', 'chocolates': 'snacks',
  'golosinas': 'snacks', 'dulces': 'snacks',
  'bebidas': 'bebidas', 'aguas': 'bebidas', 'gaseosas': 'bebidas',
  'jugos': 'bebidas', 'bebidas funcionales': 'bebidas', 'bebidas deportivas': 'bebidas',
  'vinos': 'licores', 'licores': 'licores', 'cervezas': 'licores',
  'espumantes': 'licores', 'cigarros': 'licores',
  'lacteos': 'lacteos', 'leches': 'lacteos', 'yogurt': 'lacteos',
  'quesos': 'lacteos', 'mantequilla': 'lacteos', 'huevos': 'lacteos',
  'carnes': 'carnes', 'pollo': 'carnes', 'cerdo': 'carnes',
  'res': 'carnes', 'pescados': 'carnes', 'embutidos': 'carnes',
  'fiambres': 'fiambres', 'jamon': 'fiambres', 'salchichas': 'fiambres',
  'frutas': 'frutas-verduras', 'verduras': 'frutas-verduras',
  'panaderia': 'panaderia', 'pan': 'panaderia', 'pasteleria': 'panaderia',
  'congelados': 'congelados', 'helados': 'congelados',
  'mascotas': 'mascotas', 'perros': 'mascotas', 'gatos': 'mascotas',
  'cuidado personal': 'cuidado-personal', 'shampoo': 'cuidado-personal',
  'jabones': 'cuidado-personal', 'higiene': 'cuidado-personal',
  'cosmeticos': 'cuidado-personal', 'maquillaje': 'cuidado-personal',
  'perfumes': 'cuidado-personal', 'desodorante': 'cuidado-personal',
  'hogar': 'hogar', 'limpieza': 'hogar', 'muebles': 'hogar',
  'cocina': 'hogar', 'decoracion': 'hogar',
  'electronica': 'electronica', 'electro': 'electronica',
  'computacion': 'electronica', 'celulares': 'electronica',
  'televisores': 'electronica', 'audio': 'electronica',
  'deportes': 'deportes', 'ropa deportiva': 'deportes',
  'ropa': 'ropa', 'moda': 'ropa',
  'bebes': 'bebes', 'pañales': 'bebes',
  'juguetes': 'otros',
  'terraza': 'hogar', 'aire libre': 'hogar', 'camping': 'hogar',
  'parrillas': 'hogar',
  'automotriz': 'otros', 'llantas': 'otros', 'motos': 'otros',
  'mundo horeca': 'abarrotes',
}

function mapCategory(catPath) {
  if (!catPath) return 'abarrotes'
  const lower = catPath.toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val
  }
  const parts = catPath.split('/').filter(Boolean)
  return parts.length ? parts[0].toLowerCase().replace(/\s+/g, '-') : 'abarrotes'
}

function extractProduct(p) {
  const item = p.items?.[0]
  const seller = item?.sellers?.[0]
  const offer = seller?.commertialOffer || {}
  const images = item?.images || []
  const imageUrl = images[0]?.imageUrl || ''
  const categoryPath = p.categories?.[0] || ''

  const price = offer.Price || 0
  const listPrice = offer.ListPrice || price
  const stock = Math.min(offer.AvailableQuantity || 0, 9999)
  const descripcion = (p.description || '').substring(0, 500)

  if (!p.productName || price <= 0) return null

  return {
    titulo: p.productName,
    descripcion: descripcion,
    precio: price,
    precio_original: listPrice > price ? listPrice : price,
    stock,
    categoria: mapCategory(categoryPath),
    imagen_url: imageUrl.split('?')[0],
    marca: p.brand || '',
    sku: item?.itemId || '',
    link: p.link || '',
  }
}

async function fetchBatch(from, to) {
  const url = `${API}?_from=${from}&_to=${to}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return []
  return res.json()
}

async function main() {
  console.log('1. Getting product count...')
  const firstBatch = await fetchBatch(0, 0)
  if (!firstBatch.length) { console.error('No products found'); return }
  console.log(`   API works, sample: "${firstBatch[0].productName.substring(0, 50)}"`)

  const totalRes = await fetch(`https://www.makro.plazavea.com.pe/api/catalog_system/pub/products/search?_from=0&_to=0`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const resources = totalRes.headers.get('resources') || ''
  const match = resources.match(/\/(\d+)$/)
  const totalProducts = match ? parseInt(match[1]) : 8809
  console.log(`   Total products: ${totalProducts}`)

  console.log('\n2. Fetching products...')
  const allProducts = []
  const seenTitles = new Set()
  const startTime = Date.now()

  for (let from = 0; from < totalProducts; from += BATCH_SIZE) {
    const to = Math.min(from + BATCH_SIZE - 1, totalProducts - 1)
    const batch = await fetchBatch(from, to)

    for (const p of batch) {
      const prod = extractProduct(p)
      if (prod && !seenTitles.has(prod.titulo)) {
        seenTitles.add(prod.titulo)
        allProducts.push(prod)
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const pct = Math.min(100, ((from + BATCH_SIZE) / totalProducts * 100)).toFixed(1)
    process.stdout.write(`\r   ${Math.min(from + BATCH_SIZE, totalProducts)}/${totalProducts} (${pct}%) — ${allProducts.length} unique products (${elapsed}s)`)

    await new Promise(r => setTimeout(r, 400))
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n\n3. Done: ${allProducts.length} products in ${elapsed}s`)

  const cats = {}
  allProducts.forEach(p => { cats[p.categoria] = (cats[p.categoria] || 0) + 1 })
  console.log('   Categories:', JSON.stringify(cats))

  if (allProducts.length) {
    mkdirSync('scripts/output', { recursive: true })
    writeFileSync('scripts/output/makro-products.json', JSON.stringify(allProducts, null, 2))
    console.log('\n   Saved to scripts/output/makro-products.json')
    console.log('   Sample:', JSON.stringify(allProducts[0], null, 2).substring(0, 300))
  }
}

main().catch(console.error)
