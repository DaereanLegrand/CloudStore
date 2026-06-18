import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import RecipeCard from '../components/RecipeCard'

const PAGE_SIZE = 24

export default function Recipes() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dificultad, setDificultad] = useState('')
  const [categoria, setCategoria] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categories, setCategories] = useState([])

  useEffect(() => { loadRecipes() }, [search, dificultad, categoria, page])
  useEffect(() => { setPage(1) }, [search, dificultad, categoria])

  useEffect(() => {
    supabase.from('recipes').select('categoria').then(({ data }) => {
      if (data) {
        const seen = new Set()
        data.forEach(d => { if (d.categoria) seen.add(d.categoria) })
        setCategories([...seen].sort())
      }
    })
  }, [])

  async function loadRecipes() {
    setLoading(true)
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabase.from('recipes').select('*', { count: 'exact' }).order('created_at', { ascending: false })
    if (dificultad) query = query.eq('dificultad', dificultad)
    if (categoria) query = query.ilike('categoria', `%${categoria}%`)
    if (search) query = query.ilike('titulo', `%${search}%`)
    const { data, count } = await query.range(from, to)
    setRecipes(data || [])
    setTotalPages(Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)))
    setLoading(false)
  }

  function Pagination() {
    if (totalPages <= 1) return null
    const pages = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, page + 2)
    for (let i = start; i <= end; i++) pages.push(i)

    return (
      <div className="pagination">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg> Anterior
        </button>
        <div className="pagination-pages">
          {start > 1 && <span className="pagination-ellipsis">...</span>}
          {pages.map(p => (
            <button key={p} className={`btn btn-sm ${p === page ? 'btn-active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          {end < totalPages && <span className="pagination-ellipsis">...</span>}
        </div>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
          Siguiente <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div className="page">
      <h2>Recetas</h2>
      <p className="page-subtitle">Encuentra recetas deliciosas y agrega todos los ingredientes a tu carrito</p>
      <div className="filters">
        <input placeholder="Buscar recetas..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={dificultad} onChange={e => setDificultad(e.target.value)}>
          <option value="">Todas las dificultades</option>
          <option value="facil">Fácil</option>
          <option value="medio">Media</option>
          <option value="dificil">Difícil</option>
        </select>
        <select value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton-card" />)}
        </div>
      ) : recipes.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" fillOpacity="0.12"/><path d="M3 6h18"/></svg>
          </span>
          <p>No se encontraron recetas. Intenta con otros filtros.</p>
        </div>
      ) : (
        <>
          <Pagination />
          <div className="recipes-grid">
            {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
          </div>
          <Pagination />
        </>
      )}
    </div>
  )
}
