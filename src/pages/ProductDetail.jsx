import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

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
        setProduct(data)
        setLoading(false)
      })
  }, [id, navigate])

  async function addToCart() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const { data: existing } = await supabase.from('cart_items').select('*')
      .eq('comprador_id', session.user.id).eq('product_id', id).single()
    if (existing) {
      await supabase.from('cart_items').update({ cantidad: existing.cantidad + 1 }).eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: id, cantidad: 1 })
    }
    fetchCartCount()
    setAdded(true)
  }

  if (loading) return (
    <div className="page">
      <div className="skeleton-detail">
        <div className="skeleton-detail-img" />
        <div className="skeleton-detail-info">
          <div className="skeleton-line w-20" />
          <div className="skeleton-line w-60" />
          <div className="skeleton-line w-30" />
          <div className="skeleton-line w-40" />
          <div className="skeleton-line w-80" />
        </div>
      </div>
    </div>
  )

  if (!product) return null

  return (
    <div className="page product-detail">
      <Link to="/products" className="back-link">← Volver a productos</Link>
      <div className="product-detail-content">
        <div className="product-detail-image">
          <img src={product.imagen_url} alt={product.titulo} />
        </div>
        <div className="product-detail-info">
          <span className="category-badge">{product.categoria}</span>
          <h1>{product.titulo}</h1>
          <p className="price">${product.precio}</p>
          <p className="stock-label">{product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}</p>
          <p className="seller">Vendido por {product.profiles?.nombre || 'CloudStore'}</p>
          {product.descripcion && (
            <div className="product-detail-description">
              <h3>Descripción</h3>
              <p>{product.descripcion}</p>
            </div>
          )}
          <button className="btn btn-lg" onClick={addToCart} disabled={product.stock < 1}>
            {product.stock < 1 ? 'Agotado' : added ? '✓ Agregado al carrito' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    </div>
  )
}
