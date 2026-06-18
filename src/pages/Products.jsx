import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Products() {
  const [products, setProducts] = useState([])
  const [categoria, setCategoria] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => { loadProducts() }, [categoria, search])

  async function loadProducts() {
    let query = supabase.from('products').select('*').order('created_at', { ascending: false })
    if (categoria) query = query.eq('categoria', categoria)
    if (search) query = query.ilike('titulo', `%${search}%`)
    const { data } = await query
    setProducts(data || [])
  }

  async function addToCart(productId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const { data: existing } = await supabase.from('cart_items').select('*').eq('comprador_id', session.user.id).eq('product_id', productId).single()
    if (existing) await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    else await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: productId, cantidad: 1 })
  }

  return (
    <div>
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
      {products.length === 0 && <p>No hay productos disponibles.</p>}
    </div>
  )
}
