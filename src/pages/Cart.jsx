import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Cart() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadCart() }, [])

  async function loadCart() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setItems([]); setLoading(false); return }
    const { data } = await supabase.from('cart_items').select('*, products(*)').eq('comprador_id', session.user.id)
    setItems(data || [])
    setLoading(false)
  }

  async function updateQty(id, newQty) {
    if (newQty <= 0) { await removeItem(id); return }
    await supabase.from('cart_items').update({ cantidad: newQty }).eq('id', id)
    loadCart()
  }

  async function removeItem(id) {
    await supabase.from('cart_items').delete().eq('id', id)
    loadCart()
  }

  async function checkout() {
    setError(''); setSuccess('')
    const payload = items.map(i => ({ product_id: i.product_id, cantidad: i.cantidad }))
    const { data, error } = await supabase.functions.invoke('checkout', { body: { items: payload } })
    if (error) { setError(error.message); return }
    if (data.error) { setError(data.error); return }
    setSuccess(`¡Orden #${data.order_id.slice(0, 8)} creada! Total pagado: $${data.total}`)
    setItems([])
  }

  const total = items.reduce((sum, i) => sum + Number(i.products.precio) * i.cantidad, 0)

  return (
    <div className="page">
      <h2>Tu Carrito</h2>

      {loading && (
        <>
          {[0, 1, 2].map(n => (
            <div key={n} className="cart-item" aria-hidden="true">
              <div className="skeleton" style={{ width: 80, height: 80, flexShrink: 0 }}></div>
              <div className="cart-item-info skeleton-body" style={{ padding: 0 }}>
                <div className="skeleton skeleton-line lg"></div>
                <div className="skeleton skeleton-line sm"></div>
              </div>
            </div>
          ))}
        </>
      )}

      {!loading && items.map(i => (
        <div key={i.id} className="cart-item">
          <img src={i.products.imagen_url} alt={i.products.titulo} width={80} />
          <div className="cart-item-info">
            <h4>{i.products.titulo}</h4>
            <p>${i.products.precio} x {i.cantidad} = ${(Number(i.products.precio) * i.cantidad).toFixed(2)}</p>
          </div>
          <div className="cart-item-actions">
            <button onClick={() => updateQty(i.id, i.cantidad - 1)} disabled={i.cantidad <= 1}>-</button>
            <span className="badge badge-neutral">{i.cantidad}</span>
            <button onClick={() => updateQty(i.id, i.cantidad + 1)}>+</button>
            <button onClick={() => removeItem(i.id)} className="btn-danger">Eliminar</button>
          </div>
        </div>
      ))}

      {!loading && items.length === 0 && !success && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 8h10.8l.8 10.4a2 2 0 0 1-2 2.1H7.8a2 2 0 0 1-2-2.1L6.6 8Z" fill="currentColor" fillOpacity="0.12" /><path d="M6.6 8h10.8l.8 10.4a2 2 0 0 1-2 2.1H7.8a2 2 0 0 1-2-2.1L6.6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg></span>
          <h3>Tu carrito está vacío</h3>
          <p>Aún no has agregado productos. Explora el catálogo y encuentra algo que te guste.</p>
          <Link to="/products" className="btn">Ver productos</Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div id="cart-summary">
          <h3>Total: ${total.toFixed(2)}</h3>
          <button className="btn" onClick={checkout}>Pagar (Simulado)</button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  )
}
