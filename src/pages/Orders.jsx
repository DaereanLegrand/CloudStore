import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('comprador_id', session.user.id).order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  if (loading) return (
    <div className="page">
      <h2>Mis Órdenes</h2>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-body">
            <div className="skeleton skeleton-line lg"></div>
            <div className="skeleton skeleton-line full"></div>
            <div className="skeleton skeleton-line full"></div>
            <div className="skeleton skeleton-line sm"></div>
          </div>
        </div>
      ))}
    </div>
  )

  if (orders.length === 0) return (
    <div className="page">
      <h2>Mis Órdenes</h2>
      <div className="empty-state">
        <span className="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 20V3Z" fill="currentColor" fillOpacity="0.12" /><path d="M6 3h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 20V3Z" /><path d="m9.4 11 1.9 1.9L15 9.2" /></svg></span>
        <h3>No tienes órdenes aún</h3>
        <p>Cuando completes una compra, tus órdenes aparecerán aquí.</p>
      </div>
    </div>
  )

  return (
    <div className="page">
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
