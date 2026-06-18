import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Cart() {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  useEffect(() => { loadCart() }, [])

  async function loadCart() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setItems([]); return }
    const { data } = await supabase.from('cart_items').select('*, products(*)').eq('comprador_id', session.user.id)
    setItems(data || [])
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
    <div>
      <h2>Tu Carrito</h2>
      {items.map(i => (
        <div key={i.id} className="cart-item">
          <img src={i.products.imagen_url} alt={i.products.titulo} width={80} />
          <div className="cart-item-info">
            <h4>{i.products.titulo}</h4>
            <p>${i.products.precio} x {i.cantidad} = ${(Number(i.products.precio) * i.cantidad).toFixed(2)}</p>
          </div>
          <div className="cart-item-actions">
            <button onClick={() => updateQty(i.id, i.cantidad - 1)} disabled={i.cantidad <= 1}>-</button>
            <span>{i.cantidad}</span>
            <button onClick={() => updateQty(i.id, i.cantidad + 1)}>+</button>
            <button onClick={() => removeItem(i.id)} className="btn-danger">Eliminar</button>
          </div>
        </div>
      ))}
      {items.length === 0 && !success && <p>Tu carrito está vacío.</p>}
      {items.length > 0 && (
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
