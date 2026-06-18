import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('comprador_id', session.user.id).order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="page">
      <h2>Mis Órdenes</h2>
      <div className="skeleton-list">
        {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton-order" />)}
      </div>
    </div>
  )

  if (orders.length === 0) return (
    <div className="page">
      <h2>Mis Órdenes</h2>
      <div className="empty-state">
        <span className="empty-icon">📋</span>
        <p>No tienes órdenes aún.</p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <h2>Mis Órdenes</h2>
      {orders.map(order => (
        <div key={order.id} className="order-card">
          <div className="order-header">
            <div>
              <strong>Orden #{order.id.slice(0, 8)}</strong>
              <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            <span className={`order-status status-${order.estado}`}>{order.estado}</span>
          </div>
          <div className="order-items">
            {order.order_items.map(item => (
              <div key={item.id} className="order-item">
                <span>{item.titulo} × {item.cantidad}</span>
                <span>${(item.precio * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span>Total</span>
            <strong>${order.total}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}
