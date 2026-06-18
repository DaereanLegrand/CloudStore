import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { motion } from 'framer-motion'

export default function ProductDetail() {
  const { id } = useParams()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState(false)
  const navigate = useNavigate()
  const { fetchCartCount } = useCart()

  useEffect(() => {
    supabase.from('products').select('*, profiles(nombre)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { navigate('/products'); return }
        setProduct(data); setLoading(false)
      })
  }, [id, navigate])

  async function addToCart() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', id).single()
    if (existing) {
      await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: id, cantidad: 1 })
    }
    fetchCartCount(); setAdded(true)
  }

  if (loading) return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-[380px] aspect-square rounded-2xl bg-white/[0.03]" />
      <div className="flex-1 space-y-3">
        {[20, 60, 30, 40, 80].map((w, i) => <div key={i} className={`h-4 rounded-2xl bg-white/[0.03] w-${w}`} />)}
      </div>
    </div>
  )

  if (!product) return null

  return (
    <div className="space-y-4">
      <Link to="/products" className="inline-flex items-center gap-1 text-xs text-white/35 hover:text-white/70 transition-colors">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Volver
      </Link>

      <div className="rounded-2xl bg-white/[0.03] p-6">
        <div className="flex flex-col md:flex-row gap-8">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="w-full md:w-[380px] flex-shrink-0">
            <div className="aspect-square rounded-xl bg-white/[0.04] flex items-center justify-center p-6">
              <img src={product.imagen_url} alt={product.titulo} className="max-w-full max-h-full object-contain" />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">{product.categoria}</span>
              {product.precio_promocion != null && (
                <span className="text-xs font-medium text-emerald/60">Oferta 20%</span>
              )}
            </div>
            <h1 className="text-2xl font-medium text-white/85 leading-tight">{product.titulo}</h1>
            <p className="text-3xl font-light text-white/90">
              {product.precio_promocion != null ? (
                <><span className="text-lg text-white/30 line-through mr-2">S/.{product.precio}</span> S/.{product.precio_promocion}</>
              ) : (
                <>S/.{product.precio}</>
              )}
            </p>
            <p className="text-sm text-white/40">{product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}</p>
            <p className="text-xs text-white/25">Vendido por {product.profiles?.nombre || 'CloudStore'}</p>
            {product.descripcion && (
              <div>
                <h3 className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-1">Descripción</h3>
                <p className="text-sm text-white/50 leading-relaxed">{product.descripcion}</p>
              </div>
            )}
            <button className="btn-primary text-sm px-8 py-3" onClick={addToCart} disabled={product.stock < 1}>
              {product.stock < 1 ? 'Agotado' : added ? 'Agregado' : 'Agregar al carrito'}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
