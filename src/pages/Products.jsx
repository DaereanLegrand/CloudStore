import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { CATEGORIES_DICT } from '../categories'
import ProductCard from '../components/ProductCard'

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
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).single()
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
    const pages = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)
    for (let i = start; i <= end; i++) pages.push(i)

    return (
      <div className="pagination">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          ⬅ Anterior
        </button>
        <div className="pagination-pages">
          {start > 1 && <span className="pagination-ellipsis">...</span>}
          {pages.map(p => (
            <button key={p} className={`btn btn-sm ${p === page ? 'btn-active' : ''}`} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
          {end < totalPages && <span className="pagination-ellipsis">...</span>}
        </div>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
          Siguiente ➡
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      {toast && <div className="toast">✓ {toast} agregado al carrito</div>}
      <h2>Productos</h2>
      <div className="filters">
        <input placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORIES_DICT[c] || c}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <p>No hay productos disponibles.</p>
        </div>
      ) : (
        <>
          <Pagination />
          <div className="products-grid">
            {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
          </div>
          <Pagination />
        </>
      )}
    </div>
  )
}
