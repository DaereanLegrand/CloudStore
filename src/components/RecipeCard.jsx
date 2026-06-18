import { Link } from 'react-router-dom'

const DIFFICULTY_LABELS = { facil: 'Fácil', medio: 'Media', dificil: 'Difícil' }
const DIFFICULTY_CLASSES = { facil: 'badge-green', medio: 'badge-yellow', dificil: 'badge-red' }

export default function RecipeCard({ recipe }) {
  const catLabel = recipe.categoria || ''

  return (
    <Link to={`/recipe/${recipe.slug}`} className="recipe-card">
      <div className="recipe-card-image">
        {recipe.imagen_url ? (
          <img src={recipe.imagen_url} alt={recipe.titulo} loading="lazy" />
        ) : (
          <div className="recipe-card-image-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" opacity="0.3"/></svg>
          </div>
        )}
        {recipe.dificultad && (
          <span className={`recipe-card-badge ${DIFFICULTY_CLASSES[recipe.dificultad] || 'badge-green'}`}>
            {DIFFICULTY_LABELS[recipe.dificultad] || recipe.dificultad}
          </span>
        )}
      </div>
      <div className="recipe-card-body">
        <h3 className="recipe-card-title">{recipe.titulo}</h3>
        <div className="recipe-card-meta">
          {recipe.tiempo_preparacion > 0 && (
            <span className="recipe-card-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              {recipe.tiempo_preparacion} min
            </span>
          )}
          {recipe.porciones > 0 && (
            <span className="recipe-card-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {recipe.porciones} porc
            </span>
          )}
        </div>
        {catLabel && <span className="recipe-card-category">{catLabel}</span>}
        {recipe.descripcion && (
          <p className="recipe-card-desc">{recipe.descripcion.substring(0, 100)}</p>
        )}
      </div>
    </Link>
  )
}
