import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { motion } from 'framer-motion'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data } = await supabase.from('orders').select('*, order_items(*)').eq('comprador_id', session.user.id).order('created_at', { ascending: false })
    setOrders(data || []); setLoading(false)
  }

  if (loading) return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-white/85">Mis Órdenes</h1>
      {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.03]" />)}
    </div>
  )

  if (orders.length === 0) return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-white/85">Mis Órdenes</h1>
      <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
        <p className="text-sm text-white/30">No tienes órdenes aún.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-white/85">Mis Órdenes</h1>
      {orders.map((order, idx) => (
        <motion.div key={order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="rounded-2xl bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/75">#{order.id.slice(0, 8)}</span>
              <span className="text-xs text-white/30">{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            <span className={`text-xs font-medium ${
              order.estado === 'pagado' ? 'text-emerald/60' : order.estado === 'pendiente' ? 'text-amber/60' : 'text-rose/60'
            }`}>
              {order.estado}
            </span>
          </div>
          <div className="space-y-1 mb-3">
            {order.order_items.map(item => (
              <div key={item.id} className="flex justify-between text-xs text-white/40">
                <span>{item.titulo} × {item.cantidad}</span>
                <span>S/{(item.precio * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-3 border-t border-white/[0.04] text-sm">
            <span className="text-white/35">Total</span>
            <span className="font-medium text-white/75">S/{order.total}</span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
