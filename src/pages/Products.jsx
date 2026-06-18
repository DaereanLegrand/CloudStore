import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { CATEGORIES_DICT } from '../categories'
import ProductCard from '../components/ProductCard'
import { motion, AnimatePresence } from 'framer-motion'

const PAGE_SIZE = 25

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoria, setCategoria] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState([])
  const [toast, setToast] = useState(null)
  const { fetchCartCount } = useCart()

  useEffect(() => { loadProducts() }, [categoria, search, page])
  useEffect(() => { setPage(1) }, [categoria, search])

  useEffect(() => {
    supabase.from('products').select('categoria').then(({ data }) => {
      if (data) {
        const seen = new Set()
        data.forEach(d => { if (d.categoria) seen.add(d.categoria) })
        setCategories([...seen].sort())
      }
    })
  }, [])

  async function loadProducts() {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (categoria) query = query.eq('categoria', categoria)
    if (search) query = query.ilike('titulo', `%${search}%`)
    const { data, count } = await query.range(from, to)
    setProducts(data || [])
    setTotalPages(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)))
    setLoading(false)
  }

  async function addToCart(productId, titulo) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).maybeSingle()
    if (existing) {
      await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad: 1 })
    }
    fetchCartCount()
    setToast(titulo)
    setTimeout(() => setToast(null), 2000)
  }

  function Pagination() {
    if (totalPages <= 1) return null
    const pages = []; const start = Math.max(1, page - 2); const end = Math.min(totalPages, page + 2)
    for (let i = start; i <= end; i++) pages.push(i)
    return (
      <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
        <button className="btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom"><path d="m15 18-6-6 6-6" /></svg> Anterior
        </button>
        <div className="flex items-center gap-1">
          {start > 1 && <span className="text-xs text-white/20">...</span>}
          {pages.map(p => (
            <button key={p} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all duration-300 ${p === page ? 'text-white bg-white/[0.06]' : 'text-white/30 hover:text-white/60'}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          {end < totalPages && <span className="text-xs text-white/20">...</span>}
        </div>
        <button className="btn-ghost text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
          Siguiente <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="toast">✓ {toast}</motion.div>}
      </AnimatePresence>

      <div className="rounded-2xl bg-white/[0.03] p-5">
        <h1 className="text-lg font-medium text-white/85 mb-4">Productos</h1>
        <div className="flex gap-3 flex-col sm:flex-row">
          <input placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} className="glass-input flex-1 text-sm" />
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className="glass-select text-sm sm:w-44">
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{CATEGORIES_DICT[c] || c}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-white/[0.02]" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/30">No hay productos disponibles.</p>
        </div>
      ) : (
        <>
          <Pagination />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
          </div>
          <Pagination />
        </>
      )}
    </div>
  )
}
