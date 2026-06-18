import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

const DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Media', dificil: 'Difícil' }

export default function RecipeDetail() {
  const { slug } = useParams()
  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(null)
  const { fetchCartCount } = useCart()

  useEffect(() => {
    loadRecipe()
  }, [slug])

  async function loadRecipe() {
    setLoading(true)
    const { data: recipeData } = await supabase.from('recipes').select('*').eq('slug', slug).single()
    if (recipeData) {
      setRecipe(recipeData)
      const { data: ingData } = await supabase
        .from('recipe_ingredients')
        .select('*, products:product_id(id, titulo, precio, imagen_url, categoria)')
        .eq('recipe_id', recipeData.id)
        .order('id')
      setIngredients(ingData || [])
    }
    setLoading(false)
  }

  async function addToCart(productId, cantidad) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }
    const { data: existing } = await supabase.from('cart_items').select('*')
      .eq('comprador_id', session.user.id)
      .eq('product_id', productId)
      .maybeSingle()
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
        const { data: existing } = await supabase.from('cart_items').select('*')
          .eq('comprador_id', session.user.id)
          .eq('product_id', ing.product_id)
          .maybeSingle()
        if (existing) {
          await supabase.from('cart_items').update({ cantidad: existing.cantidad + qty }).eq('id', existing.id)
        } else {
          await supabase.from('cart_items').insert({ comprador_id: session.user.id, product_id: ing.product_id, cantidad: qty })
        }
        count++
      } catch {}
    }
    fetchCartCount()
    setAdding(false)
    setToast(`${count} productos agregados al carrito`)
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) return (
    <div className="page">
      <div className="skeleton-detail" />
    </div>
  )

  if (!recipe) return (
    <div className="page">
      <div className="empty-state">
        <span className="empty-icon">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" fillOpacity="0.12"/></svg>
        </span>
        <p>Receta no encontrada.</p>
        <Link to="/recipes" className="btn">Ver todas las recetas</Link>
      </div>
    </div>
  )

  const mappedCount = ingredients.filter(i => i.mapeado).length
  const unmappedCount = ingredients.filter(i => !i.mapeado).length

  return (
    <div className="page">
      {toast && <div className="toast">{toast}</div>}

      <Link to="/recipes" className="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        Volver a recetas
      </Link>

      <div className="recipe-detail-header">
        <div className="recipe-detail-image">
          {recipe.imagen_url ? (
            <img src={recipe.imagen_url} alt={recipe.titulo} />
          ) : (
            <div className="recipe-detail-image-placeholder">
              <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" opacity="0.3"/></svg>
            </div>
          )}
        </div>
        <div className="recipe-detail-info">
          <h2>{recipe.titulo}</h2>
          {recipe.descripcion && <p className="recipe-detail-desc">{recipe.descripcion}</p>}
          <div className="recipe-detail-meta">
            {recipe.tiempo_preparacion > 0 && (
              <span className="meta-chip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {recipe.tiempo_preparacion} min
              </span>
            )}
            {recipe.porciones > 0 && (
              <span className="meta-chip">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                {recipe.porciones} porciones
              </span>
            )}
            {recipe.dificultad && (
              <span className="meta-chip">{DIFFICULTY_LABELS[recipe.dificultad]}</span>
            )}
            {recipe.calorias > 0 && (
              <span className="meta-chip">{recipe.calorias} cal</span>
            )}
          </div>
          {recipe.categoria && <span className="recipe-detail-category">{recipe.categoria}</span>}
        </div>
      </div>

      <div className="recipe-detail-content">
        <div className="recipe-detail-ingredients">
          <h3>Ingredientes</h3>
          {mappedCount > 0 && (
            <button className="btn btn-lg" onClick={addAllToCart} disabled={adding} style={{ marginBottom: '1rem' }}>
              {adding ? 'Agregando...' : `Agregar ${mappedCount} productos al carrito`}
            </button>
          )}

          <ul className="ingredients-list">
            {ingredients.map(ing => (
              <li key={ing.id} className={`ingredient-item ${!ing.mapeado ? 'ingredient-unmapped' : ''}`}>
                <div className="ingredient-item-info">
                  <span className="ingredient-item-raw">{ing.ingredient_raw}</span>
                  {ing.mapeado && ing.products && (
                    <div className="ingredient-item-product">
                      <span className="ingredient-item-product-name">
                        → {ing.products.titulo}
                      </span>
                      <span className="ingredient-item-product-qty">
                        {ing.cantidad_producto} {Math.round(ing.cantidad_producto) === 1 ? 'unidad' : 'unidades'}
                        {ing.notas && <span className="ingredient-item-note"> ({ing.notas})</span>}
                      </span>
                      {ing.products.precio && (
                        <span className="ingredient-item-price">S/ {ing.products.precio.toFixed(2)}</span>
                      )}
                    </div>
                  )}
                  {!ing.mapeado && (
                    <span className="ingredient-item-unmapped">No disponible en la tienda</span>
                  )}
                </div>
                {ing.mapeado && ing.products && (
                  <button className="btn btn-sm" onClick={() => addToCart(ing.product_id, Math.max(1, Math.round(ing.cantidad_producto)))}>
                    Agregar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="recipe-detail-instructions">
          <h3>Preparación</h3>
          {recipe.instrucciones && typeof recipe.instrucciones === 'string' && (
            (() => {
              try {
                const parsed = JSON.parse(recipe.instrucciones)
                return parsed.map((section, si) => (
                  <div key={si} className="instruction-section">
                    {section.section && <h4>{section.section}</h4>}
                    <ol className="instruction-steps">
                      {section.steps?.map((step, spi) => (
                        <li key={spi} className="instruction-step">{step.text}</li>
                      ))}
                    </ol>
                  </div>
                ))
              } catch {
                return <p>{recipe.instrucciones}</p>
              }
            })()
          )}
          {recipe.instrucciones && Array.isArray(recipe.instrucciones) && (
            recipe.instrucciones.map((section, si) => (
              <div key={si} className="instruction-section">
                {section.section && <h4>{section.section}</h4>}
                <ol className="instruction-steps">
                  {section.steps?.map((step, spi) => (
                    <li key={spi} className="instruction-step">{step.text}</li>
                  ))}
                </ol>
              </div>
            ))
          )}

          {recipe.calorias > 0 && (
            <div className="recipe-detail-nutrition">
              <h4>Información Nutricional</h4>
              <p>{recipe.calorias} calorías por porción</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
