import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { motion, AnimatePresence } from 'framer-motion'

const DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Media', dificil: 'Difícil' }

export default function RecipeDetail() {
  const { slug } = useParams()
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(null)
  const { fetchCartCount } = useCart()

  useEffect(() => { loadRecipe() }, [slug])

  async function loadRecipe() {
    setLoading(true)
    const { data: recipeData } = await supabase.from('recipes').select('*').eq('slug', slug).single()
    if (recipeData) {
      setRecipe(recipeData)
      const { data: ingData } = await supabase.from('recipe_ingredients').select('*, products:product_id(id, titulo, precio, imagen_url, categoria)').eq('recipe_id', recipeData.id).order('id')
      setIngredients(ingData || [])
    }
    setLoading(false)
  }

  async function addToCart(productId, cantidad) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).maybeSingle()
    if (existing) {
      await supabase.from('cart_items').update({ cantidad: existing.cantidad + cantidad }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad })
    }
    fetchCartCount()
  }

  async function addAllToCart() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    setAdding(true)
    let count = 0
    for (const ing of ingredients) {
      if (!ing.mapeado || !ing.product_id) continue
      try {
        const qty = Math.max(1, Math.round(ing.cantidad_producto))
        const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', ing.product_id).maybeSingle()
        if (existing) {
          await supabase.from('cart_items').update({ cantidad: existing.cantidad + qty }).eq('id', existing.id)
        } else {
          await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: ing.product_id, cantidad: qty })
        }
        count++
      } catch {}
    }
    fetchCartCount(); setAdding(false)
    setToast(`${count} productos agregados`)
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) return <div className="aspect-[16/6] rounded-2xl bg-white/[0.03]" />

  if (!recipe) return (
    <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
      <p className="text-sm text-white/30 mb-4">Receta no encontrada.</p>
      <Link to="/recipes" className="btn-primary text-xs">Ver todas</Link>
    </div>
  )

  const mappedCount = ingredients.filter(i => i.mapeado).length

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="toast">{toast}</motion.div>}
      </AnimatePresence>

      <Link to="/recipes" className="inline-flex items-center gap-1 text-xs text-white/35 hover:text-white/70 transition-colors">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        Volver
      </Link>

      <div className="rounded-2xl bg-white/[0.03] p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-[380px] aspect-[16/10] rounded-xl bg-white/[0.04] overflow-hidden flex-shrink-0">
            {recipe.imagen_url ? (
              <img src={recipe.imagen_url} alt={recipe.titulo} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" opacity="0.3"/></svg>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <h1 className="text-2xl font-medium text-white/85">{recipe.titulo}</h1>
            {recipe.descripcion && <p className="text-sm text-white/50 leading-relaxed">{recipe.descripcion}</p>}
            <div className="flex flex-wrap gap-2 text-xs text-white/35">
              {recipe.tiempo_preparacion > 0 && <span>{recipe.tiempo_preparacion} min</span>}
              {recipe.porciones > 0 && <span>{recipe.porciones} porciones</span>}
              {recipe.dificultad && <span>{DIFFICULTY_LABELS[recipe.dificultad]}</span>}
              {recipe.calorias > 0 && <span>{recipe.calorias} cal</span>}
            </div>
            {recipe.categoria && <span className="text-xs text-emerald/60">{recipe.categoria}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/[0.03] p-5 flex flex-col" style={{ maxHeight: '70vh' }}>
          <div className="flex-shrink-0">
            <h3 className="text-sm font-medium text-white/75 mb-3">Ingredientes</h3>
            {mappedCount > 0 && (
              <button className="btn-primary text-xs mb-4" onClick={addAllToCart} disabled={adding}>
                {adding ? 'Agregando...' : `Agregar ${mappedCount} al carrito`}
              </button>
            )}
          </div>
          <div className="space-y-1 overflow-y-auto scrollbar-thin flex-1 pr-1">
            {ingredients.map(ing => (
              <div key={ing.id} className={`flex items-center justify-between gap-3 py-2 ${!ing.mapeado ? 'opacity-40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white/65">{ing.ingredient_raw}</span>
                  {ing.mapeado && ing.products && (
                    <div className="mt-0.5 space-y-0.5">
                      <span className="text-xs text-emerald/50">→ {ing.products.titulo}</span>
                      <span className="text-xs text-white/25 block">
                        {ing.cantidad_producto} {Math.round(ing.cantidad_producto) === 1 ? 'unidad' : 'unidades'}
                        {ing.notas && <span className="italic"> ({ing.notas})</span>}
                      </span>
                    </div>
                  )}
                  {!ing.mapeado && <span className="text-xs text-rose-400/40 italic block">No disponible</span>}
                </div>
                {ing.mapeado && ing.products && (
                  <button className="btn-primary text-xs px-3 py-1.5 flex-shrink-0" onClick={() => addToCart(ing.product_id, Math.max(1, Math.round(ing.cantidad_producto)))}>
                    +1
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] p-5 overflow-y-auto scrollbar-thin" style={{ maxHeight: '70vh' }}>
          <h3 className="text-sm font-medium text-white/75 mb-3">Preparación</h3>
          {recipe.instrucciones && typeof recipe.instrucciones === 'string' && (
            (() => {
              try {
                const parsed = JSON.parse(recipe.instrucciones)
                return parsed.map((section, si) => (
                  <div key={si} className="mb-4">
                    {section.section && <h4 className="text-xs font-medium text-white/45 mb-2">{section.section}</h4>}
                    <ol className="space-y-2">
                      {section.steps?.map((step, spi) => (
                        <li key={spi} className="flex gap-2 text-sm text-white/40 leading-relaxed">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.05] text-xs font-medium flex items-center justify-center text-white/30">{spi + 1}</span>
                          <span className="pt-0.5">{step.text}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))
              } catch { return <p className="text-sm text-white/40">{recipe.instrucciones}</p> }
            })()
          )}
          {recipe.instrucciones && Array.isArray(recipe.instrucciones) && (
            recipe.instrucciones.map((section, si) => (
              <div key={si} className="mb-4">
                {section.section && <h4 className="text-xs font-medium text-white/45 mb-2">{section.section}</h4>}
                <ol className="space-y-2">
                  {section.steps?.map((step, spi) => (
                    <li key={spi} className="flex gap-2 text-sm text-white/40 leading-relaxed">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.05] text-xs font-medium flex items-center justify-center text-white/30">{spi + 1}</span>
                      <span className="pt-0.5">{step.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
          {recipe.calorias > 0 && (
            <div className="pt-3 mt-3 border-t border-white/[0.04]">
              <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-1">Nutrición</p>
              <p className="text-sm text-white/40">{recipe.calorias} calorías por porción</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
