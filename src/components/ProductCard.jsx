import { Link } from 'react-router-dom'

export default function ProductCard({ product, onAddToCart }) {
  const onSale = product.precio_promocion != null

  return (
    <div className="product-card">
      <Link to={`/product/${product.id}`}>
        <div className="product-card-img">
          <img src={product.imagen_url} alt={product.titulo} loading="lazy" />
        </div>
      </Link>
      <div className="product-info">
        <span className="category-badge">{product.categoria}</span>
        {onSale && <span className="sale-badge">-20%</span>}
        <h3><Link to={`/product/${product.id}`}>{product.titulo}</Link></h3>
        <p className="price">
          {onSale ? (
            <><span className="price-original">${product.precio}</span> ${product.precio_promocion}</>
          ) : (
            <>${product.precio}</>
          )}
        </p>
        <p className="stock">{product.stock > 0 ? `${product.stock} en stock` : 'Agotado'}</p>
        <button className="btn" onClick={() => onAddToCart(product.id, product.titulo)} disabled={product.stock < 1}>
          {product.stock < 1 ? 'Agotado' : 'Agregar al carrito'}
        </button>
      </div>
    </div>
  )
}
