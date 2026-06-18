import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [products, setProducts] = useState([])
  const navigate = useNavigate()

  useEffect(() => { loadProducts() }, [])

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(8)
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
      <h1>Bienvenido a CloudStore</h1>
      <p>El marketplace más simple de la nube.</p>
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
      {products.length > 0 && <p style={{ marginTop: '1rem' }}><Link to="/products">Ver todos los productos →</Link></p>}
    </div>
  )
}
