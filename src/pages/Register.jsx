import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'comprador' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) { setError(error.message); setSubmitting(false); return }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id, nombre: form.nombre, email: form.email, rol: form.rol,
    })
    setSubmitting(false)
    if (profileError) setError(profileError.message)
    else navigate('/')
  }

  return (
    <div className="page auth-page">
      <div className="auth-card">
        <h2>Crear Cuenta</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nombre">Nombre completo</label>
            <input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="reg-email">Correo electrónico</label>
            <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="reg-password">Contraseña (mín. 6 caracteres)</label>
            <input id="reg-password" name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <div className="form-group">
            <label htmlFor="rol">Tipo de cuenta</label>
            <select id="rol" name="rol" value={form.rol} onChange={handleChange}>
              <option value="comprador">Comprador</option>
              <option value="vendedor">Vendedor</option>
            </select>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn btn-lg btn-block" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        <p className="auth-footer">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </div>
    </div>
  )
}
