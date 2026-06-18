import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const { fetchCartCount } = useCart()

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(8)
    setProducts(data || [])
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

  return (
    <div className="page">
      {toast && <div className="toast">✓ {toast} agregado al carrito</div>}
      <div className="hero">
        <h1>Bienvenido a CloudStore</h1>
        <p>El marketplace más simple de la nube.</p>
      </div>
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : (
        <>
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
                  <h3><Link to={`/product/${p.id}`}>{p.titulo}</Link></h3>
                  <p className="price">${p.precio}</p>
                  <p className="stock">{p.stock > 0 ? `${p.stock} en stock` : 'Agotado'}</p>
                  <button className="btn" onClick={() => addToCart(p.id, p.titulo)} disabled={p.stock < 1}>
                    {p.stock < 1 ? 'Agotado' : 'Agregar al carrito'}
                  </button>
                </div>
              </div>
            ))}
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
