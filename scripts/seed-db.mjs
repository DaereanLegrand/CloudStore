import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:3333'
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SERVICE_KEY

const SOURCES = [
  { file: 'scripts/output/plazavea-products.json', label: 'PlazaVea' },
  { file: 'scripts/output/radioshack-products.json', label: 'RadioShack' },
  { file: 'scripts/output/makro-products.json', label: 'Makro' },
]

async function getOrCreateVendor(supabase, email, nombre) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) return existing.id

  // Create auth user first
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: 'vendor-password-' + Date.now(),
    email_confirm: true,
  })

  if (authError || !authUser?.user) {
    console.error(`  Failed to create vendor auth user: ${authError?.message}`)
    return null
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: authUser.user.id,
    nombre,
    email,
    rol: 'vendedor',
  })

  if (profileError) {
    console.error(`  Failed to create vendor profile: ${profileError.message}`)
    return null
  }

  return authUser.user.id
}

async function main() {
  if (!SERVICE_KEY) {
    console.error('ERROR: SUPABASE_SECRET_KEY or SERVICE_KEY env var required')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  // Create vendors for each source
  const vendors = {
    plazavea: await getOrCreateVendor(supabase, 'scraper-plazavea@cloudstore.local', 'Scraper PlazaVea'),
    radioshack: await getOrCreateVendor(supabase, 'scraper-radioshack@cloudstore.local', 'Scraper RadioShack'),
    makro: await getOrCreateVendor(supabase, 'scraper-makro@cloudstore.local', 'Scraper Makro'),
  }

  console.log('\nVendors:', JSON.stringify(vendors))

  for (const source of SOURCES) {
    console.log(`\n--- ${source.label} (${source.file}) ---`)
    const products = JSON.parse(readFileSync(source.file, 'utf8'))
    console.log(`  Loading ${products.length} products...`)

    const vendorKey = source.label === 'PlazaVea' ? 'plazavea'
      : source.label === 'RadioShack' ? 'radioshack' : 'makro'
    const vendedorId = vendors[vendorKey]

    if (!vendedorId) {
      console.error(`  SKIP: No vendor available for ${source.label}`)
      continue
    }

    let inserted = 0
    let errors = 0
    const batchSize = 50

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize).map(p => ({
        vendedor_id: vendedorId,
        titulo: p.titulo,
        descripcion: p.descripcion || '',
        precio: parseFloat(p.precio) || 0.01,
        stock: parseInt(p.stock) || 0,
        categoria: p.categoria || 'otros',
        imagen_url: p.imagen_url || '',
      }))

      const { error } = await supabase.from('products').insert(batch)
      if (error) {
        console.error(`  Batch ${i / batchSize + 1} error: ${error.message}`)
        errors += batch.length
      } else {
        inserted += batch.length
      }

      const pct = ((i + batchSize) / products.length * 100).toFixed(0)
      process.stdout.write(`\r  ${Math.min(i + batchSize, products.length)}/${products.length} (${pct}%) — ${inserted} inserted, ${errors} errors`)
    }

    console.log(`\n  Done: ${inserted} inserted, ${errors} errors`)
  }

  console.log('\n=== All products seeded ===')
}

main().catch(console.error)
