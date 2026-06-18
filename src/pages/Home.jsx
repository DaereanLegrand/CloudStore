import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import VisionChat from '../components/VisionChat'

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

  function ProductCard(p) {
    const onSale = p.precio_promocion != null
    return (
      <div key={p.id} className="product-card">
        <Link to={`/product/${p.id}`}>
          <div className="product-card-img">
            <img src={p.imagen_url} alt={p.titulo} loading="lazy" />
          </div>
        </Link>
        <div className="product-info">
          <span className="category-badge">{p.categoria}</span>
          {onSale && <span className="sale-badge">-20%</span>}
          <h3><Link to={`/product/${p.id}`}>{p.titulo}</Link></h3>
          <p className="price">
            {onSale ? (
              <><span className="price-original">${p.precio}</span> ${p.precio_promocion}</>
            ) : (
              <>${p.precio}</>
            )}
          </p>
          <p className="stock">{p.stock > 0 ? `${p.stock} en stock` : 'Agotado'}</p>
          <button className="btn" onClick={() => addToCart(p.id, p.titulo)} disabled={p.stock < 1}>
            {p.stock < 1 ? 'Agotado' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <VisionChat />
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
                {promoted.slice(0, 4).map(p => <ProductCard key={p.id} {...p} />)}
              </div>
            </>
          )}
          <h2 style={promoted.length > 0 ? { marginTop: '2rem' } : {}}>Últimos productos</h2>
          <div className="products-grid">
            {products.map(p => <ProductCard key={p.id} {...p} />)}
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
