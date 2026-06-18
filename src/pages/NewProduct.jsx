import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function NewProduct() {
  const [form, setForm] = useState({ titulo: '', descripcion: '', precio: '', stock: '', categoria: 'electronica' })
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSuccess('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }

    const fileExt = file.name.split('.').pop()
    const fileName = `${session.user.id}/${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage.from('productos').upload(fileName, file)
    if (uploadError) { setError('Error al subir imagen: ' + uploadError.message); return }

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

    if (insertError) setError(insertError.message)
    else {
      setSuccess('Producto publicado exitosamente.')
      setForm({ titulo: '', descripcion: '', precio: '', stock: '', categoria: 'electronica' })
      setFile(null)
    }
  }

  return (
    <div className="page">
      <div className="auth-form">
        <h2>Publicar Producto</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Título</label>
            <input name="titulo" value={form.titulo} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea name="descripcion" rows={3} value={form.descripcion} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Precio ($)</label>
            <input name="precio" type="number" step="0.01" min="0.01" value={form.precio} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Stock</label>
            <input name="stock" type="number" min="1" value={form.stock} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Categoría</label>
            <select name="categoria" value={form.categoria} onChange={handleChange}>
              <option value="electronica">Electrónica</option>
              <option value="ropa">Ropa</option>
              <option value="hogar">Hogar</option>
              <option value="deportes">Deportes</option>
              <option value="libros">Libros</option>
              <option value="otros">Otros</option>
            </select>
          </div>
          <div className="form-group">
            <label>Foto del producto</label>
            <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} required />
          </div>
          <button type="submit" className="btn btn-block">Publicar</button>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
        </form>
      </div>
    </div>
  )
}
