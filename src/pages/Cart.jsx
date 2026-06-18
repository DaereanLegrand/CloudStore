import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { motion, AnimatePresence } from 'framer-motion'

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
    setItems(data || []); setLoading(false)
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
      try { const context = JSON.parse(error.context || '{}'); if (context.error) errorMsg = context.error } catch { try { if (typeof error.context === 'string') errorMsg = error.context } catch {} }
      setError(errorMsg); return
    }
    setSuccess(`Orden #${data.order_id.slice(0, 8)} creada · $${data.total}`)
    setItems([]); fetchCartCount()

    if (telefono.trim()) {
      const { data: notifyData, error: notifyErr } = await supabase.functions.invoke('notify', {
        body: { telefono: telefono.trim(), items: resumen, total: data.total, order_id: data.order_id },
      })
      if (notifyErr || notifyData?.error) setSuccess(prev => prev + ' (WhatsApp no enviado)')
      else if (notifyData?.enviados > 0) setSuccess(prev => prev + ' · Confirmación por WhatsApp')
    }
  }

  function effectivePrice(p) { return Number(p.precio_promocion || p.precio) }
  const total = items.reduce((sum, i) => sum + effectivePrice(i.products) * i.cantidad, 0)

  if (loading) return (
    <div className="space-y-3">
      <h1 className="text-lg font-medium text-white/85">Tu Carrito</h1>
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/[0.03]" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium text-white/85">Tu Carrito</h1>

      {items.length === 0 && !success && (
        <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/30">Tu carrito está vacío.</p>
        </div>
      )}

      {items.map((i, idx) => (
        <motion.div key={i.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="rounded-2xl bg-white/[0.03] p-4 flex items-center gap-3">
          <img src={i.products.imagen_url} alt={i.products.titulo} className="w-14 h-14 rounded-xl object-cover bg-white/[0.04] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-white/75 truncate">{i.products.titulo}</h4>
            <p className="text-xs text-white/35">
              {i.products.precio_promocion != null ? (
                <><span className="line-through text-white/20">${i.products.precio}</span> ${i.products.precio_promocion} c/u</>
              ) : <>${i.products.precio} c/u</>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/80 transition-all text-sm" onClick={() => updateQty(i.id, i.cantidad - 1)} disabled={i.cantidad <= 1}>−</button>
            <span className="text-sm font-medium text-white/70 w-5 text-center">{i.cantidad}</span>
            <button className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white/80 transition-all text-sm" onClick={() => updateQty(i.id, i.cantidad + 1)}>+</button>
            <span className="text-sm font-medium text-white/70 w-16 text-right">${(effectivePrice(i.products) * i.cantidad).toFixed(2)}</span>
            <button onClick={() => removeItem(i.id)} className="text-xs text-white/20 hover:text-rose-400/60 transition-colors ml-1">×</button>
          </div>
        </motion.div>
      ))}

      {items.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/50">Total</span>
            <span className="text-xl font-light text-white/85">${total.toFixed(2)}</span>
          </div>
          <div>
            <label htmlFor="wa-phone" className="glass-label">WhatsApp (opcional)</label>
            <input id="wa-phone" type="tel" placeholder="999888777" value={telefono} onChange={e => setTelefono(e.target.value)} className="glass-input text-sm" />
          </div>
          <button className="btn-primary w-full text-sm py-3" onClick={checkout}>Pagar</button>
        </div>
      )}

      <AnimatePresence>
        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-rose-400/60 text-center">{error}</motion.p>}
        {success && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-emerald/60 text-center">{success}</motion.p>}
      </AnimatePresence>
    </div>
  )
}
