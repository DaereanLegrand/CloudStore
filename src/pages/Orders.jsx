import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Orders() {
  const [orders, setOrders] = useState([])

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('comprador_id', session.user.id).order('created_at', { ascending: false })
    setOrders(data || [])
  }

  if (orders.length === 0) return <div><h2>Mis Órdenes</h2><p>No tienes órdenes aún.</p></div>

  return (
    <div>
      <h2>Mis Órdenes</h2>
      {orders.map(order => (
        <div key={order.id} className="order-card">
          <div className="order-header">
            <strong>Orden #{order.id.slice(0, 8)}</strong>
            <span className="order-status">{order.estado}</span>
            <span>{new Date(order.created_at).toLocaleDateString()}</span>
          </div>
          <div className="order-items">
            {order.order_items.map(item => (
              <div key={item.id} className="order-item">
                <span>{item.titulo} x{item.cantidad}</span>
                <span>${(item.precio * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="order-total"><strong>Total: ${order.total}</strong></div>
        </div>
      ))}
    </div>
  )
}
