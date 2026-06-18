import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Media', dificil: 'Difícil' }
const DIFFICULTY_CLASSES = { facil: 'text-emerald/60', medio: 'text-amber/60', dificil: 'text-rose/60' }

export default function RecipeCard({ recipe }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 180, damping: 22, mass: 0.6 }}
      className="rounded-2xl bg-white/[0.03] p-4 group"
    >
      <Link to={`/recipe/${recipe.slug}`}>
        <div className="aspect-[16/10] rounded-xl bg-white/[0.04] mb-3 overflow-hidden relative">
          {recipe.imagen_url ? (
            <img src={recipe.imagen_url} alt={recipe.titulo} loading="lazy" className="w-full h-full object-cover transition-all duration-700 group-hover:scale-[1.03]" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" opacity="0.3"/></svg>
            </div>
          )}
          {recipe.dificultad && (
            <span className={`absolute top-2 left-2 text-[0.45rem] font-medium ${DIFFICULTY_CLASSES[recipe.dificultad] || 'text-emerald/60'}`}>
              {DIFFICULTY_LABELS[recipe.dificultad] || recipe.dificultad}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-white/75 leading-snug group-hover:text-white transition-colors duration-300">{recipe.titulo}</h3>
          <div className="flex gap-2.5 text-[0.5rem] text-white/30">
            {recipe.tiempo_preparacion > 0 && <span>{recipe.tiempo_preparacion} min</span>}
            {recipe.porciones > 0 && <span>{recipe.porciones} porc</span>}
          </div>
          {recipe.categoria && <span className="text-[0.5rem] text-emerald/60">{recipe.categoria}</span>}
          {recipe.descripcion && (
            <p className="text-[0.55rem] text-white/30 line-clamp-2">{recipe.descripcion.substring(0, 100)}</p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
