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
    const pages = []; const start = Math.max(1, page - 2); const end = Math.min(totalPages, page + 2)
    for (let i = start; i <= end; i++) pages.push(i)
    return (
      <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
        <button className="btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom"><path d="m15 18-6-6 6-6" /></svg> Anterior
        </button>
        <div className="flex items-center gap-1">
          {start > 1 && <span className="text-xs text-white/20">...</span>}
          {pages.map(p => (
            <button key={p} className={`w-7 h-7 rounded-lg text-xs font-medium transition-all duration-300 ${p === page ? 'text-white bg-white/[0.06]' : 'text-white/30 hover:text-white/60'}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          {end < totalPages && <span className="text-xs text-white/20">...</span>}
        </div>
        <button className="btn-ghost text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
          Siguiente <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block align-text-bottom"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white/[0.03] p-5">
        <h1 className="text-lg font-medium text-white/85 mb-2">Recetas</h1>
        <p className="text-sm text-white/35 mb-4">Encuentra recetas y agrega ingredientes a tu carrito.</p>
        <div className="flex gap-3 flex-col sm:flex-row">
          <input placeholder="Buscar recetas..." value={search} onChange={e => setSearch(e.target.value)} className="glass-input flex-1 text-sm" />
          <select value={dificultad} onChange={e => setDificultad(e.target.value)} className="glass-select text-sm sm:w-36">
            <option value="">Dificultad</option>
            <option value="facil">Fácil</option>
            <option value="medio">Media</option>
            <option value="dificil">Difícil</option>
          </select>
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className="glass-select text-sm sm:w-36">
            <option value="">Categoría</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[16/10] rounded-2xl bg-white/[0.02]" />)}
        </div>
      ) : recipes.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/30">No se encontraron recetas.</p>
        </div>
      ) : (
        <>
          <Pagination />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
          </div>
          <Pagination />
        </>
      )}
    </div>
  )
}
