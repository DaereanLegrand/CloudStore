import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import ProductCard from './ProductCard'
import { logLLM } from '../utils/llm-logger'
import { motion, AnimatePresence } from 'framer-motion'

function ThinkingPill() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -2 }}
      className="thinking-pill"
    >
      <span className="thinking-dot animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="thinking-dot animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="thinking-dot animate-bounce" style={{ animationDelay: '300ms' }} />
      <span className="ml-1.5">Pensando</span>
    </motion.div>
  )
}

export default function SmartSearch({ standalone }) {
  const [query, setQuery] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [products, setProducts] = useState(null)
  const [recipeResults, setRecipeResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const { fetchCartCount } = useCart()
  const [toast, setToast] = useState(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    setToast(titulo)
    setTimeout(() => setToast(null), 2000)
  }

  const STOP_WORDS = new Set('quiero hacer una para el la los las un unos unas del con en por y o pero más muy al lo tu su mis tus sus este esta estos estas ese esa eso aquel aquella todo toda todos todas cada mismo propia propio otros otras otra otro'.split(' '))

  function extractKeywords(text) {
    return [...new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)))]
  }

  async function searchRecipes(text) {
    const keywords = extractKeywords(text)
    if (keywords.length === 0) return []

    const seen = new Set()
    const results = []
    const textLower = text.toLowerCase()

    const { data: exact } = await supabase
      .from('recipes')
      .select('slug, titulo, descripcion, dificultad, tiempo_preparacion, porciones, calorias, imagen_url, categoria')
      .or(`titulo.ilike.%${text}%,descripcion.ilike.%${text}%`)
      .limit(4)
    if (exact) {
      exact.sort((a, b) => {
        const aT = a.titulo.toLowerCase(), bT = b.titulo.toLowerCase()
        const aExact = aT === textLower ? 0 : aT.startsWith(textLower) ? 1 : 2
        const bExact = bT === textLower ? 0 : bT.startsWith(textLower) ? 1 : 2
        return aExact - bExact
      })
      exact.forEach(r => { if (!seen.has(r.slug)) { seen.add(r.slug); results.push(r) } })
    }
    if (results.length >= 4) return results

    for (const kw of keywords) {
      const { data } = await supabase
        .from('recipes')
        .select('slug, titulo, descripcion, dificultad, tiempo_preparacion, porciones, calorias, imagen_url, categoria')
        .or(`titulo.ilike.%${kw}%,descripcion.ilike.%${kw}%,categoria.ilike.%${kw}%`)
        .limit(10)
      if (data) {
        data.sort((a, b) => {
          const aT = a.titulo.toLowerCase(), bT = b.titulo.toLowerCase()
          const aKw = aT.includes(kw) ? 0 : 1
          const bKw = bT.includes(kw) ? 0 : 1
          return aKw - bKw
        })
        data.forEach(r => { if (!seen.has(r.slug)) { seen.add(r.slug); results.push(r) } })
      }
    }
    return results.slice(0, 4)
  }

  async function handleSearch(e) {
    e?.preventDefault()
    const text = query.trim()
    if (!text) return

    setHasSearched(true)
    setLoading(true)
    setError('')
    setProducts(null)
    setRecipeResults(null)
    const startTime = performance.now()

    let recipes = []
    try {
      const { data, error: fnError } = await supabase.functions.invoke('semantic-search', { body: { query: text } })
      const timing = (performance.now() - startTime) / 1000

      if (fnError) {
        let msg = fnError.message
        try { const c = JSON.parse(fnError.context || '{}'); if (c.error) msg = c.error } catch {}
        logLLM({ query: text, error: msg, timing })
        throw new Error(msg)
      }
      if (data?.error) {
        logLLM({ query: text, error: data.error, timing })
        throw new Error(data.error)
      }

      logLLM({ query: text, response: `${(data?.products || []).length} productos`, timing })
      setProducts(data?.products || [])

      recipes = data?.recipes || []
      if (recipes.length === 0) {
        recipes = await searchRecipes(text)
      }
    } catch (err) {
      recipes = await searchRecipes(text)
      if (!recipes.length) {
        setError(err.message)
        setLoading(false)
        return
      }
    }
    setRecipeResults(recipes)
    setLoading(false)
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImage(ev.target.result.split(',')[1])
      setImagePreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImage(null); setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleVisualSearch() {
    if (!image) return
    setHasSearched(true); setLoading(true); setError(''); setProducts(null)
    const startTime = performance.now()

    try {
      const { data, error: fnError } = await supabase.functions.invoke('visual-search', { body: { image } })
      const timing = (performance.now() - startTime) / 1000
      if (fnError) {
        let msg = fnError.message
        try { const c = JSON.parse(fnError.context || '{}'); if (c.error) msg = c.error } catch {}
        logLLM({ query: '[imagen]', error: msg, timing, image: true })
        throw new Error(msg)
      }
      if (data?.error) {
        logLLM({ query: '[imagen]', error: data.error, timing, image: true })
        throw new Error(data.error)
      }
      logLLM({ query: `[imagen] ${data?.description || ''}`, response: `${(data?.products || []).length} productos`, timing, image: true })
      setProducts(data?.products || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={standalone ? 'w-full max-w-2xl mx-auto' : ''}>
      {toast && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="toast">
          ✓ {toast}
        </motion.div>
      )}

      <div className="space-y-6">
        {standalone ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="text-center space-y-6"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl font-light text-white/70 tracking-tight">
                ¿Qué <span className="text-white font-normal">necesitas</span> hoy?
              </h1>
              <p className="text-sm text-white/30 mt-2">Describe lo que buscas con tus propias palabras</p>
            </div>

            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="glass-input w-full pl-11 pr-4 text-base h-12"
                  placeholder="Escribe algo..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query.trim() && !loading && (
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-[#15966a] text-white text-xs font-medium hover:bg-[#0f7a57] transition-all"
                  >
                    Buscar
                  </button>
                )}
              </div>
            </form>

            <div>
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/25 hover:text-white/50 transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="inline-block align-text-bottom mr-1"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>
                o sube una imagen
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} hidden />
            </div>

            <AnimatePresence>{loading && !imagePreview && <ThinkingPill />}</AnimatePresence>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={handleSearch}>
              <div className="relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="glass-input w-full pl-10 pr-10 text-sm h-11"
                  placeholder="Escribe algo..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                {query.trim() && !loading && (
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-[#15966a] text-white flex items-center justify-center hover:bg-[#0f7a57] transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-rose-400/60 text-xs text-center">
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {hasSearched && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {recipeResults !== null && (
                <div>
                  <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-3">
                    {recipeResults.length > 0 ? `Recetas (${recipeResults.length})` : 'Recetas'}
                  </p>
                  {recipeResults.length === 0 ? (
                    <p className="text-sm text-white/15 text-center py-6">No encontramos recetas relacionadas.</p>
                  ) : (
                    <div className="space-y-2">
                      {recipeResults.map(r => (
                        <a key={r.slug} href={`/recipe/${r.slug}`} className="rounded-2xl bg-white/[0.03] flex items-center justify-between gap-4 p-4 no-underline group">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-white/75 group-hover:text-white transition-colors">{r.titulo}</h4>
                            {r.descripcion && <p className="text-xs text-white/30 truncate mt-0.5">{r.descripcion.substring(0, 120)}</p>}
                            <div className="flex gap-3 mt-1.5 text-[0.55rem] text-white/25">
                              {r.tiempo_preparacion > 0 && <span>{r.tiempo_preparacion} min</span>}
                              {r.porciones > 0 && <span>{r.porciones} porciones</span>}
                              {r.dificultad && <span className="text-emerald/50">{r.dificultad}</span>}
                            </div>
                          </div>
                          <span className="btn-primary text-[0.55rem] px-3 py-1.5">Ver receta</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {products !== null && (
                <div>
                  <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-3">
                    {products.length > 0 ? `Productos (${products.length})` : 'Sin resultados'}
                  </p>
                  {products.length === 0 ? (
                    <p className="text-sm text-white/25 text-center py-8">No se encontraron productos. Intenta con otros términos.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
