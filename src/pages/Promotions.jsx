import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

export default function Promotions() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { fetchCartCount } = useCart()

  useEffect(() => { loadPromotedProducts() }, [])

  async function loadPromotedProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .not('precio_promocion', 'is', null)
      .order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  async function activatePromotion() {
    setActivating(true)
    setError('')
    setSuccess('')
    const { data, error: fnError } = await supabase.functions.invoke('promotions', {})
    if (fnError) {
      let msg = fnError.message
      try { const c = JSON.parse(fnError.context || '{}'); if (c.error) msg = c.error } catch {}
      setError(msg)
      setActivating(false)
      return
    }
    setSuccess(`¡Promoción activada! ${data.count} productos con 20% de descuento.`)
    setActivating(false)
    loadPromotedProducts()
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
  }

  return (
    <div className="page">
      <h2>🔥 Promociones</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Activa una promoción del 20% de descuento en 20 productos seleccionados aleatoriamente.
      </p>
      <button className="btn btn-lg" onClick={activatePromotion} disabled={activating} style={{ marginBottom: '2rem' }}>
        {activating ? 'Activando...' : 'Iniciar Nueva Promoción'}
      </button>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🏷️</span>
          <p>No hay promociones activas.</p>
        </div>
      ) : (
        <>
          <h3 style={{ marginBottom: '1rem' }}>Productos en oferta ({products.length})</h3>
          <div className="products-grid">
            {products.map(p => (
              <div key={p.id} className="product-card">
                <Link to={`/product/${p.id}`}>
                  <div className="product-card-img">
                    <img src={p.imagen_url} alt={p.titulo} loading="lazy" />
                  </div>
                </Link>
                <div className="product-info">
                  <span className="category-badge">{p.categoria}</span>
                  <span className="sale-badge">-20%</span>
                  <h3><Link to={`/product/${p.id}`}>{p.titulo}</Link></h3>
                  <p className="price">
                    <span className="price-original">${p.precio}</span>
                    ${p.precio_promocion}
                  </p>
                  <p className="stock">{p.stock > 0 ? `${p.stock} en stock` : 'Agotado'}</p>
                  <button className="btn" onClick={() => addToCart(p.id, p.titulo)} disabled={p.stock < 1}>
                    {p.stock < 1 ? 'Agotado' : 'Agregar al carrito'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
