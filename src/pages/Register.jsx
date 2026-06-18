import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'comprador' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  function handleChange(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

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
    <div className="max-w-sm mx-auto pt-12">
      <div className="rounded-2xl bg-white/[0.03] p-6">
        <h1 className="text-lg font-medium text-white/85 mb-6 text-center">Crear Cuenta</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nombre" className="glass-label">Nombre completo</label>
            <input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required className="glass-input text-sm" />
          </div>
          <div>
            <label htmlFor="reg-email" className="glass-label">Correo electrónico</label>
            <input id="reg-email" name="email" type="email" value={form.email} onChange={handleChange} required className="glass-input text-sm" />
          </div>
          <div>
            <label htmlFor="reg-password" className="glass-label">Contraseña (mín. 6)</label>
            <input id="reg-password" name="password" type="password" value={form.password} onChange={handleChange} required minLength={6} className="glass-input text-sm" />
          </div>
          <div>
            <label htmlFor="rol" className="glass-label">Tipo</label>
            <select id="rol" name="rol" value={form.rol} onChange={handleChange} className="glass-select text-sm">
              <option value="comprador">Comprador</option>
              <option value="vendedor">Vendedor</option>
            </select>
          </div>
          {error && <p className="text-xs text-rose-400/60">{error}</p>}
          <button type="submit" className="btn-primary w-full text-sm py-3" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-white/30">¿Ya tienes cuenta? <Link to="/login" className="text-emerald/60 hover:text-emerald/80 transition-colors">Inicia sesión</Link></p>
      </div>
    </div>
  )
}
