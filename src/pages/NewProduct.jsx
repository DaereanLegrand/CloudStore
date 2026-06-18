import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { CATEGORIES } from '../categories'

export default function NewProduct() {
  const [form, setForm] = useState({ titulo: '', descripcion: '', precio: '', stock: '', categoria: 'electronica' })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess(''); setSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }

    const fileExt = file.name.split('.').pop()
    const fileName = `${session.user.id}/${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('productos').upload(fileName, file)
    if (uploadError) { setError('Error al subir imagen: ' + uploadError.message); setSubmitting(false); return }

    const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('products').insert({
      vendedor_id: session.user.id, titulo: form.titulo, descripcion: form.descripcion,
      precio: parseFloat(form.precio), stock: parseInt(form.stock), categoria: form.categoria, imagen_url: publicUrl,
    })

    setSubmitting(false)
    if (insertError) setError(insertError.message)
    else { setSuccess('Producto publicado.'); setForm({ titulo: '', descripcion: '', precio: '', stock: '', categoria: 'electronica' }); setFile(null) }
  }

  return (
    <div className="max-w-md mx-auto pt-8">
      <div className="rounded-2xl bg-white/[0.03] p-6">
        <h1 className="text-lg font-medium text-white/85 mb-6">Publicar Producto</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="titulo" className="glass-label">Título</label>
            <input id="titulo" name="titulo" value={form.titulo} onChange={handleChange} required className="glass-input text-sm" />
          </div>
          <div>
            <label htmlFor="descripcion" className="glass-label">Descripción</label>
            <textarea id="descripcion" name="descripcion" rows={3} value={form.descripcion} onChange={handleChange} className="glass-input text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="precio" className="glass-label">Precio</label>
              <input id="precio" name="precio" type="number" step="0.01" min="0.01" value={form.precio} onChange={handleChange} required className="glass-input text-sm" />
            </div>
            <div>
              <label htmlFor="stock" className="glass-label">Stock</label>
              <input id="stock" name="stock" type="number" min="1" value={form.stock} onChange={handleChange} required className="glass-input text-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="categoria" className="glass-label">Categoría</label>
            <select id="categoria" name="categoria" value={form.categoria} onChange={handleChange} className="glass-select text-sm">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="foto" className="glass-label">Foto</label>
            <input id="foto" type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} required className="text-xs text-white/30 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:bg-[#15966a] file:text-white file:text-xs file:font-medium hover:file:bg-[#0f7a57] cursor-pointer" />
          </div>
          {error && <p className="text-xs text-rose-400/60">{error}</p>}
          {success && <p className="text-xs text-emerald/60">{success}</p>}
          <button type="submit" className="btn-primary w-full text-sm py-3" disabled={submitting}>
            {submitting ? 'Publicando...' : 'Publicar'}
          </button>
        </form>
      </div>
    </div>
  )
}
