import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function Promotions() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { fetchCartCount } = useCart()

  useEffect(() => { loadPromotedProducts() }, [])

  async function loadPromotedProducts() {
    const { data } = await supabase.from('products').select('*').not('precio_promocion', 'is', null).order('created_at', { ascending: false })
    setProducts(data || []); setLoading(false)
  }

  async function activatePromotion() {
    setActivating(true); setError(''); setSuccess('')
    const { data, error: fnError } = await supabase.functions.invoke('promotions', {})
    if (fnError) {
      let msg = fnError.message
      try { const c = JSON.parse(fnError.context || '{}'); if (c.error) msg = c.error } catch {}
      setError(msg); setActivating(false); return
    }
    setSuccess(`${data.count} productos con 20% descuento.`)
    setActivating(false); loadPromotedProducts()
  }

  async function addToCart(productId, titulo) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).maybeSingle()
    if (existing) {
      await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad: 1 })
    }
    fetchCartCount()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/[0.03] p-5">
        <h1 className="text-lg font-medium text-white/85 mb-2">Promociones</h1>
        <p className="text-sm text-white/35 mb-4">Activa 20% de descuento en 20 productos aleatorios.</p>
        <button className="btn-primary text-sm" onClick={activatePromotion} disabled={activating}>
          {activating ? 'Activando...' : 'Nueva Promoción'}
        </button>
        <AnimatePresence>
          {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-rose-400/60 mt-3">{error}</motion.p>}
          {success && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-emerald/60 mt-3">{success}</motion.p>}
        </AnimatePresence>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-square rounded-2xl bg-white/[0.02]" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/30">No hay promociones activas.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-white/40">En oferta ({products.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map(p => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white/[0.03] p-4 group">
                <Link to={`/product/${p.id}`}>
                  <div className="aspect-square rounded-xl bg-white/[0.04] mb-3 flex items-center justify-center p-4 overflow-hidden">
                    <img src={p.imagen_url} alt={p.titulo} loading="lazy" className="max-w-full max-h-full object-contain transition-all duration-700 group-hover:scale-[1.03]" />
                  </div>
                </Link>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.5rem] font-semibold text-white/35 uppercase tracking-[0.08em]">{p.categoria}</span>
                    <span className="text-[0.5rem] font-medium text-emerald/60">-20%</span>
                  </div>
                  <h3 className="text-xs font-medium leading-snug">
                    <Link to={`/product/${p.id}`} className="text-white/75 hover:text-white transition-colors duration-300">{p.titulo}</Link>
                  </h3>
                  <p className="text-sm font-medium text-white/85">
                    <span className="text-[0.6rem] text-white/30 line-through mr-1">${p.precio}</span> ${p.precio_promocion}
                  </p>
                  <button className="btn-primary w-full text-[0.55rem] py-1.5" onClick={() => addToCart(p.id, p.titulo)} disabled={p.stock < 1}>
                    {p.stock < 1 ? 'Agotado' : 'Agregar'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
