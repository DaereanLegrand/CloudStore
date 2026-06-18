import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Products() {
  const [products, setProducts] = useState([])
  const [categoria, setCategoria] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadProducts() }, [categoria, search])

  async function loadProducts() {
    setLoading(true)
    let query = supabase.from('products').select('*').order('created_at', { ascending: false })
    if (categoria) query = query.eq('categoria', categoria)
    if (search) query = query.ilike('titulo', `%${search}%`)
    const { data } = await query
    setProducts(data || [])
    setLoading(false)
  }

  async function addToCart(productId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).single()
    if (existing) await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    else await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad: 1 })
  }

  return (
    <div className="page">
      <h2>Productos</h2>
      <div className="filters">
        <input placeholder="Buscar productos..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          <option value="electronica">Electrónica</option>
          <option value="ropa">Ropa</option>
          <option value="hogar">Hogar</option>
          <option value="deportes">Deportes</option>
          <option value="libros">Libros</option>
          <option value="otros">Otros</option>
        </select>
      </div>
      {loading ? (
        <div className="products-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton-thumb"></div>
              <div className="skeleton-body">
                <div className="skeleton skeleton-line full"></div>
                <div className="skeleton skeleton-line lg"></div>
                <div className="skeleton skeleton-line sm"></div>
                <div className="skeleton skeleton-btn"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="6.5" fill="currentColor" fillOpacity="0.12" /><circle cx="10.5" cy="10.5" r="6.5" /><path d="M8 10.5h5" /><path d="m20.5 20.5-4-4" /></svg></span>
          <h3>Sin resultados</h3>
          <p>No hay productos disponibles con estos filtros. Prueba con otra búsqueda o categoría.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
            <div key={p.id} className="product-card">
              <img src={p.imagen_url} alt={p.titulo} loading="lazy" />
              <div className="product-info">
                <h3>{p.titulo}</h3>
                <p className="price">${p.precio}</p>
                <p className="stock">Stock: {p.stock}</p>
                <span className="category">{p.categoria}</span>
                <button className="btn" onClick={() => addToCart(p.id)}>Agregar al carrito</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
