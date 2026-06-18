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

  return (
    <div className="page">
      <SmartSearch />
      {toast && <div className="toast">✓ {toast} agregado al carrito</div>}
      <div className="hero">
        <h1>CloudStore</h1>
        <p>El marketplace más simple de la nube. Descubre productos únicos de vendedores verificados.</p>
      </div>
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : (
        <>
          {promoted.length > 0 && (
            <>
              <div className="promo-header">
                <h2>🔥 Promociones</h2>
                <Link to="/promotions" className="btn btn-sm btn-outline">Administrar</Link>
              </div>
              <div className="products-grid promo-grid">
                {promoted.slice(0, 4).map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
              </div>
            </>
          )}
          <h2 style={promoted.length > 0 ? { marginTop: '2rem' } : {}}>Últimos productos</h2>
          <div className="products-grid">
            {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
          </div>
          {products.length > 0 && (
            <div className="section-footer">
              <Link to="/products" className="btn btn-outline">Ver todos los productos →</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
