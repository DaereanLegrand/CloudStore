import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import SmartSearch from '../components/SmartSearch'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const [products, setProducts] = useState([])
  const [promoted, setPromoted] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const { fetchCartCount } = useCart()

  useEffect(() => {
    Promise.all([loadProducts(), loadPromoted()])
      .finally(() => setLoading(false))
  }, [])

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(8)
    setProducts(data || [])
  }

  async function loadPromoted() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .not('precio_promocion', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setPromoted(data || [])
  }

  async function addToCart(productId, titulo) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId)    .maybeSingle()
    if (existing) {
      await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad: 1 })
    }
    fetchCartCount()
    setToast(titulo)
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <div className="page">
      <SmartSearch />
      {toast && <div className="toast">{toast} agregado al carrito</div>}
      <section className="hero">
        <div className="hero-content">
          <span className="hero-eyebrow">Marketplace en la nube</span>
          <h1>Compra y vende, <span className="hero-hl">en la nube</span></h1>
          <p>Miles de productos de vendedores verificados. Simple, rápido y seguro.</p>
          <div className="hero-actions">
            <Link to="/products" className="btn btn-lg">Explorar productos</Link>
            <Link to="/register" className="btn btn-lg btn-outline">Crear cuenta</Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" /><g fill="#fff"><circle cx="9.9" cy="14.3" r="1.5" /><circle cx="12" cy="12.9" r="2" /><circle cx="14.1" cy="14.4" r="1.4" /><rect x="9.8" y="13.5" width="4.4" height="1.9" rx="0.95" /></g></svg>
        </div>
      </section>
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : (
        <>
          {promoted.length > 0 && (
            <>
              <div className="promo-header">
                <h2 className="section-title">Promociones</h2>
                <Link to="/promotions" className="btn btn-sm btn-outline">Administrar</Link>
              </div>
              <div className="products-grid promo-grid">
                {promoted.slice(0, 4).map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
              </div>
            </>
          )}
          <h2 className="section-title" style={promoted.length > 0 ? { marginTop: '2.5rem' } : {}}>Últimos productos</h2>
          <div className="products-grid">
            {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
          </div>
          {products.length > 0 && (
            <div className="section-footer">
              <Link to="/products" className="btn btn-outline">Ver todos los productos</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
