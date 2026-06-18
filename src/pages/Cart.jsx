import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  const { fetchCartCount } = useCart()

  useEffect(() => { loadCart() }, [])

  async function loadCart() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setItems([]); setLoading(false); return }
    const { data } = await supabase.from('cart_items').select('*, products(*)').eq('comprador_id', session.user.id)
    setItems(data || [])
    setLoading(false)
  }

  async function updateQty(id, newQty) {
    if (newQty <= 0) { await removeItem(id); return }
    await supabase.from('cart_items').update({ cantidad: newQty }).eq('id', id)
    loadCart(); fetchCartCount()
  }

  async function removeItem(id) {
    await supabase.from('cart_items').delete().eq('id', id)
    loadCart(); fetchCartCount()
  }

  async function checkout() {
    setError(''); setSuccess('')
    const payload = items.map(i => ({ product_id: i.product_id, cantidad: i.cantidad }))
    const { data, error } = await supabase.functions.invoke('checkout', { body: { items: payload } })
    if (error) {
      let errorMsg = error.message
      try {
        const context = JSON.parse(error.context || '{}')
        if (context.error) errorMsg = context.error
      } catch {
        try {
          if (typeof error.context === 'string') errorMsg = error.context
        } catch {}
      }
      setError(errorMsg)
      return
    }
    setSuccess(`¡Orden #${data.order_id.slice(0, 8)} creada! Total pagado: $${data.total}`)
    setItems([])
    fetchCartCount()
  }

  function effectivePrice(p) {
    return Number(p.precio_promocion || p.precio)
  }
  const total = items.reduce((sum, i) => sum + effectivePrice(i.products) * i.cantidad, 0)

  if (loading) return (
    <div className="page">
      <h2>Tu Carrito</h2>
      <div className="skeleton-cart">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-cart-item" />)}
      </div>
    </div>
  )

  return (
    <div className="page">
      <h2>Tu Carrito</h2>
      {items.length === 0 && !success && (
        <div className="empty-state">
          <span className="empty-icon">🛒</span>
          <p>Tu carrito está vacío.</p>
        </div>
      )}
      {items.map(i => (
        <div key={i.id} className="cart-item">
          <img src={i.products.imagen_url} alt={i.products.titulo} />
          <div className="cart-item-info">
            <h4>{i.products.titulo}</h4>
            <p className="cart-item-price">
              {i.products.precio_promocion != null ? (
                <><span className="price-original" style={{ fontSize: '0.8125rem' }}>${i.products.precio}</span> ${i.products.precio_promocion} c/u</>
              ) : (
                <>${i.products.precio} c/u</>
              )}
            </p>
          </div>
          <div className="cart-item-actions">
            <button onClick={() => updateQty(i.id, i.cantidad - 1)} disabled={i.cantidad <= 1}>−</button>
            <span className="cart-qty">{i.cantidad}</span>
            <button onClick={() => updateQty(i.id, i.cantidad + 1)}>+</button>
            <span className="cart-subtotal">${(effectivePrice(i.products) * i.cantidad).toFixed(2)}</span>
            <button onClick={() => removeItem(i.id)} className="btn-remove">Eliminar</button>
          </div>
        </div>
      ))}
      {items.length > 0 && (
        <div className="cart-summary">
          <div className="cart-total">
            <span>Total</span>
            <span className="cart-total-amount">${total.toFixed(2)}</span>
          </div>
          <button className="btn btn-lg btn-block" onClick={checkout}>Pagar</button>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
    </div>
  )
}
