import { writeFileSync, mkdirSync } from 'fs'

const API = 'https://www.plazavea.com.pe/api/catalog_system/pub/products/search'

const CATEGORIES = {
  431: 'Abarrotes',
  2: 'Bebidas',
  845: 'Lácteos y Huevos',
  814: 'Carnes, Aves y Pescados',
  77: 'Frutas y Verduras',
  621: 'Quesos y Fiambres',
  210: 'Congelados',
  493: 'Panadería y Pastelería',
  478: 'Desayunos',
  399: 'Limpieza',
  620: 'Mascotas',
  297: 'Cuidado Personal y Salud',
  4180: 'Vinos, licores y cervezas',
}

const MAX_PER_CAT = 30

const CATEGORY_MAP = {
  'abarrotes': 'abarrotes', 'aceite': 'abarrotes', 'arroz': 'abarrotes',
  'azucar': 'abarrotes', 'cafe': 'abarrotes', 'cereales': 'abarrotes',
  'conservas': 'abarrotes', 'especias': 'abarrotes', 'harina': 'abarrotes',
  'menestras': 'abarrotes', 'pasta': 'abarrotes', 'sal': 'abarrotes',
  'salsas': 'abarrotes', 'bebidas': 'bebidas', 'aguas': 'bebidas',
  'gaseosas': 'bebidas', 'jugos': 'bebidas', 'lacteos': 'lacteos',
  'leches': 'lacteos', 'yogurt': 'lacteos', 'quesos': 'lacteos',
  'mantequilla': 'lacteos', 'carnes': 'carnes', 'pollo': 'carnes',
  'cerdo': 'carnes', 'res': 'carnes', 'pescados': 'carnes',
  'fiambres': 'fiambres', 'jamon': 'fiambres', 'salchichas': 'fiambres',
  'frutas': 'frutas-verduras', 'verduras': 'frutas-verduras',
  'panaderia': 'panaderia', 'pan': 'panaderia',
  'snacks': 'snacks', 'galletas': 'snacks', 'chocolates': 'snacks',
  'helados': 'congelados', 'congelados': 'congelados',
  'mascotas': 'mascotas', 'perros': 'mascotas', 'gatos': 'mascotas',
  'cuidado personal': 'cuidado-personal', 'shampoo': 'cuidado-personal',
  'jabones': 'cuidado-personal', 'higiene': 'cuidado-personal',
  'hogar': 'hogar', 'limpieza': 'hogar',
  'electronica': 'electronica', 'electro': 'electronica',
  'deportes': 'deportes', 'ropa': 'ropa',
  'bebes': 'bebes', 'licores': 'licores', 'cervezas': 'licores',
  'vinos': 'licores', 'pisco': 'licores',
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

async function fetchCategoryTotal(catId) {
  const res = await fetch(`${API}?fq=C:/${catId}/&_from=0&_to=0`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const resources = res.headers.get('resources') || ''
  const match = resources.match(/\/(\d+)$/)
  return match ? parseInt(match[1]) : 0
}

async function fetchCategoryProducts(catId, from, to) {
  const url = `${API}?fq=C:/${catId}/&_from=${from}&_to=${to}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return []
  return res.json()
}

function extractProduct(p, categoryLabel) {
  const item = p.items?.[0]
  const seller = item?.sellers?.[0]
  const offer = seller?.commertialOffer || {}
  const images = item?.images || []
  const imageUrl = images[0]?.imageUrl || ''
  const categoryPath = p.categories?.[0] || categoryLabel

  const price = offer.Price || 0
  const listPrice = offer.ListPrice || price
  const stock = Math.min(offer.AvailableQuantity || 0, 999)

  if (!p.productName || price <= 0) return null

  return {
    titulo: p.productName,
    descripcion: (p.description || p['Descripción del producto']?.[0] || '').substring(0, 500),
    precio: price,
    precio_original: listPrice,
    stock,
    categoria: mapCategory(categoryPath),
    imagen_url: imageUrl,
    marca: p.brand || '',
    sku: item?.itemId || '',
    link: p.link || '',
    categoryPath,
  }
}

async function main() {
  const allProducts = []
  const seenTitles = new Set()

  for (const [catId, catLabel] of Object.entries(CATEGORIES)) {
    const total = await fetchCategoryTotal(catId)
    const toFetch = Math.min(total, MAX_PER_CAT)
    console.log(`${catLabel} (${catId}): ${total} total, fetching ${toFetch}`)

    if (toFetch === 0) continue

    const res = await fetchCategoryProducts(catId, 0, toFetch - 1)
    for (const p of res) {
      const prod = extractProduct(p, catLabel)
      if (prod && !seenTitles.has(prod.titulo)) {
        seenTitles.add(prod.titulo)
        allProducts.push(prod)
      }
    }

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nTotal unique products scraped: ${allProducts.length}`)

  mkdirSync('scripts/output', { recursive: true })
  writeFileSync('scripts/output/plazavea-products.json', JSON.stringify(allProducts, null, 2))
  console.log('Saved to scripts/output/plazavea-products.json')
}

main().catch(console.error)
