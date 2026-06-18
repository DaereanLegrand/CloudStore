import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import ProductCard from './ProductCard'
import { logLLM } from '../utils/llm-logger'

export default function SmartSearch() {
  const [mode, setMode] = useState('text')
  const [query, setQuery] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [products, setProducts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { fetchCartCount } = useCart()
  const [toast, setToast] = useState(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (mode === 'text' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [mode])

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

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1]
      setImage(base64)
      setImagePreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImage(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleVisualSearch() {
    if (!image) return

    setLoading(true)
    setError('')
    setProducts(null)
    const startTime = performance.now()

    try {
      const { data, error: fnError } = await supabase.functions.invoke('visual-search', {
        body: { image },
      })

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

      const results = data?.products || []
      logLLM({ query: `[imagen] ${data?.description || ''}`, response: `${results.length} productos encontrados`, timing, image: true })
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
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: '6px' }}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          Buscar con IA
        </h2>
        <p className="smart-search-subtitle">Describe o sube una imagen para encontrar productos al instante</p>
      </div>

      <div className="smart-search-tabs">
        <button className={`smart-search-tab${mode === 'text' ? ' active' : ''}`} onClick={() => setMode('text')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          Texto
        </button>
        <button className={`smart-search-tab${mode === 'image' ? ' active' : ''}`} onClick={() => setMode('image')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>
          Imagen
        </button>
      </div>

      {mode === 'text' ? (
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
      ) : (
        <div className="smart-search-image-section">
          {!imagePreview ? (
            <div className="smart-search-image-upload" onClick={() => fileInputRef.current?.click()}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <circle cx="8.5" cy="9.5" r="1.5" />
                <path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" />
              </svg>
              <p>Haz clic para subir una imagen de producto</p>
              <span className="smart-search-image-hint">JPG, PNG • Máx 5MB</span>
            </div>
          ) : (
            <div className="smart-search-image-preview">
              <img src={imagePreview} alt="Preview" />
              <button className="smart-search-image-remove" onClick={removeImage}>×</button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} hidden />
          <button className="btn btn-lg" onClick={handleVisualSearch} disabled={loading || !image} style={{ marginTop: '0.75rem' }}>
            {loading ? 'Buscando...' : 'Buscar con imagen'}
          </button>
        </div>
      )}

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
              <span className="empty-icon">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.12" />
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="M8 10.5h5" />
                  <path d="m20.5 20.5-4-4" />
                </svg>
              </span>
              <p>No se encontraron productos. Intenta con otra imagen o términos diferentes.</p>
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
