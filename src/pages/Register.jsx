import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'comprador' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password })
    if (error) { setError(error.message); return }
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id, nombre: form.nombre, email: form.email, rol: form.rol,
    })
    if (profileError) setError(profileError.message)
    else navigate('/')
  }

  return (
    <div className="page">
      <div className="auth-form">
        <span className="hero-eyebrow" aria-hidden="true">CloudStore</span>
        <h2>Crear cuenta</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre completo</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Correo electrónico</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Contraseña (mín. 6 caracteres)</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} />
          </div>
          <div className="form-group">
            <label>Tipo de cuenta</label>
            <select name="rol" value={form.rol} onChange={handleChange}>
              <option value="comprador">Comprador</option>
              <option value="vendedor">Vendedor</option>
            </select>
          </div>
          <button type="submit" className="btn btn-block">Registrarse</button>
          {error && <p className="error">{error}</p>}
          <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
        </form>
      </div>
    </div>
  )
}
