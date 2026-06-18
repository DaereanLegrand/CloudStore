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

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

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
      vendedor_id: session.user.id,
      titulo: form.titulo,
      descripcion: form.descripcion,
      precio: parseFloat(form.precio),
      stock: parseInt(form.stock),
      categoria: form.categoria,
      imagen_url: publicUrl,
    })

    setSubmitting(false)
    if (insertError) setError(insertError.message)
    else {
      setSuccess('Producto publicado exitosamente.')
      setForm({ titulo: '', descripcion: '', precio: '', stock: '', categoria: 'electronica' })
      setFile(null)
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h2>Publicar Producto</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="titulo">Título</label>
            <input id="titulo" name="titulo" value={form.titulo} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="descripcion">Descripción</label>
            <textarea id="descripcion" name="descripcion" rows={3} value={form.descripcion} onChange={handleChange} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="precio">Precio ($)</label>
              <input id="precio" name="precio" type="number" step="0.01" min="0.01" value={form.precio} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="stock">Stock</label>
              <input id="stock" name="stock" type="number" min="1" value={form.stock} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="categoria">Categoría</label>
            <select id="categoria" name="categoria" value={form.categoria} onChange={handleChange}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="foto">Foto del producto</label>
            <input id="foto" type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} required />
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <button type="submit" className="btn btn-lg btn-block" disabled={submitting}>
            {submitting ? 'Publicando...' : 'Publicar'}
          </button>
        </form>
      </div>
    </div>
  )
}
