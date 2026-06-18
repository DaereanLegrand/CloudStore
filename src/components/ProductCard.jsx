import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function ProductCard({ product, onAddToCart }) {
  const onSale = product.precio_promocion != null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 22, mass: 0.6 }}
      className="rounded-2xl bg-white/[0.03] p-4 group"
    >
      <Link to={`/product/${product.id}`}>
        <div className="aspect-square rounded-xl bg-white/[0.04] mb-3 flex items-center justify-center p-4 overflow-hidden">
          <img src={product.imagen_url} alt={product.titulo} loading="lazy" className="max-w-full max-h-full object-contain transition-all duration-700 group-hover:scale-[1.03]" />
        </div>
      </Link>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.5rem] font-semibold text-white/35 uppercase tracking-[0.08em]">{product.categoria}</span>
          {onSale && <span className="text-[0.5rem] font-bold text-emerald/60">-20%</span>}
        </div>
        <h3 className="text-xs font-medium leading-snug">
          <Link to={`/product/${product.id}`} className="text-white/75 hover:text-white transition-colors duration-300">{product.titulo}</Link>
        </h3>
        <p className="text-sm font-medium text-white/85">
          {onSale ? (
            <><span className="text-[0.6rem] text-white/30 line-through mr-1">S/{product.precio}</span> S/{product.precio_promocion}</>
          ) : (
            <>S/{product.precio}</>
          )}
        </p>
        <p className="text-[0.5rem] text-white/30">{product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}</p>
        <button
          className="btn-primary w-full text-[0.55rem] py-1.5"
          onClick={() => onAddToCart(product.id, product.titulo)}
          disabled={product.stock < 1}
        >
          {product.stock < 1 ? 'Agotado' : 'Agregar'}
        </button>
      </div>
    </motion.div>
  )
}
