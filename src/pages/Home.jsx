import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(8)
    setProducts(data || [])
    setLoading(false)
  }

  async function addToCart(productId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).single()
    if (existing) await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    else await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad: 1 })
  }

  return (
    <div className="page">
      <section className="hero">
        <span className="hero-eyebrow">Marketplace en la nube</span>
        <h1>Compra y vende, simple como el cielo.</h1>
        <p>Descubre electrónica, ropa, hogar y mucho más. El marketplace más simple de la nube, listo cuando lo necesites.</p>
        <div className="hero-actions">
          <Link to="/products" className="btn">Explorar productos</Link>
          <Link to="/register" className="btn btn-secondary">Crear cuenta</Link>
        </div>
      </section>

      <div className="section-head">
        <h2>Recién publicados</h2>
        {products.length > 0 && <Link to="/products" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Ver todos <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></Link>}
      </div>

      {loading ? (
        <div className="products-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-thumb"></div>
              <div className="skeleton-body">
                <div className="skeleton skeleton-line full"></div>
                <div className="skeleton skeleton-line lg"></div>
                <div className="skeleton skeleton-line sm"></div>
                <div className="skeleton skeleton-btn"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 10h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9Z" fill="currentColor" fillOpacity="0.12" /><path d="M4 6.5 5 4h14l1 2.5a2 2 0 0 1-1.85 2.95A2.4 2.4 0 0 1 16 8.2a2.4 2.4 0 0 1-2 1.25A2.4 2.4 0 0 1 12 8.2a2.4 2.4 0 0 1-2 1.25A2.4 2.4 0 0 1 8 8.2a2.4 2.4 0 0 1-2.15 1.25A2 2 0 0 1 4 6.5Z" /><path d="M5 9.3V20M19 9.3V20M9.5 20v-4.5h5V20" /></svg></span>
          <h3>Todavía no hay productos</h3>
          <p>Vuelve pronto o sé el primero en publicar algo increíble.</p>
          <Link to="/new-product" className="btn">Vender ahora</Link>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
            <div key={p.id} className="product-card">
              <img src={p.imagen_url} alt={p.titulo} loading="lazy" />
              <div className="product-info">
                <h3>{p.titulo}</h3>
                <p className="price">${p.precio}</p>
                <p className="stock">Stock: {p.stock}</p>
                <span className="category">{p.categoria}</span>
                <button className="btn" onClick={() => addToCart(p.id)}>Agregar al carrito</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
