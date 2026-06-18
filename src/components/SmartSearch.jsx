import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import ProductCard from './ProductCard'
import { logLLM } from '../utils/llm-logger'

export default function SmartSearch() {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { fetchCartCount } = useCart()
  const [toast, setToast] = useState(null)
  const inputRef = useRef(null)

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

  async function handleSearch(e) {
    e?.preventDefault()
    const text = query.trim()
    if (!text) return

    setLoading(true)
    setError('')
    setProducts(null)
    const startTime = performance.now()

    try {
      const { data, error: fnError } = await supabase.functions.invoke('semantic-search', {
        body: { query: text },
      })

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

      const results = data?.products || []
      logLLM({ query: text, response: `${results.length} productos encontrados`, timing })
      setProducts(results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="smart-search">
      {toast && <div className="toast">{toast} agregado al carrito</div>}
      <div className="smart-search-header">
        <h2><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: '6px' }}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>Buscar con IA</h2>
        <p className="smart-search-subtitle">Describe lo que buscas y encuentra productos al instante</p>
      </div>
      <form className="smart-search-form" onSubmit={handleSearch}>
        <input
          ref={inputRef}
          type="text"
          className="smart-search-input"
          placeholder='Ej: "Quiero organizar una BBQ", "Necesito pañales", "Comprar carne para el finde"'
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-lg" disabled={loading || !query.trim()}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="skeleton-grid" style={{ marginTop: '1.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      )}

      {products !== null && !loading && (
        <div className="smart-search-results">
          <h3>{products.length > 0 ? `Resultados (${products.length})` : 'Sin resultados'}</h3>
          {products.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.12" /><circle cx="10.5" cy="10.5" r="6.5" /><path d="M8 10.5h5" /><path d="m20.5 20.5-4-4" /></svg></span>
              <p>No se encontraron productos. Intenta con otros términos.</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map(p => <ProductCard key={p.id} product={p} onAddToCart={addToCart} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
