import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [telefono, setTelefono] = useState('')
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
    const resumen = items.map(i => ({ titulo: i.products.titulo, cantidad: i.cantidad }))
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

    // Confirmacion por WhatsApp (opcional, si puso numero)
    if (telefono.trim()) {
      const { data: notifyData, error: notifyErr } = await supabase.functions.invoke('notify', {
        body: { telefono: telefono.trim(), items: resumen, total: data.total, order_id: data.order_id },
      })
      if (notifyErr || notifyData?.error) {
        setSuccess(prev => prev + ' (no se pudo enviar el WhatsApp)')
      } else if (notifyData?.enviados > 0) {
        setSuccess(prev => prev + ' 📲 Confirmación enviada por WhatsApp.')
      }
    }
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
          <span className="empty-icon"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 8h10.8l.8 10.4a2 2 0 0 1-2 2.1H7.8a2 2 0 0 1-2-2.1L6.6 8Z" fill="currentColor" fillOpacity="0.12" /><path d="M6.6 8h10.8l.8 10.4a2 2 0 0 1-2 2.1H7.8a2 2 0 0 1-2-2.1L6.6 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg></span>
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
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label htmlFor="wa-phone">📱 WhatsApp para confirmación (opcional)</label>
            <input
              id="wa-phone"
              type="tel"
              placeholder="Ej: 999888777"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
            />
          </div>
          <button className="btn btn-lg btn-block" onClick={checkout}>Confirmar compra</button>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
    </div>
  )
}
