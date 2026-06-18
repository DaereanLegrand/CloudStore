import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) setError(error.message)
    else navigate('/')
  }

  return (
    <div className="max-w-sm mx-auto pt-12">
      <div className="rounded-2xl bg-white/[0.03] p-6">
        <h1 className="text-lg font-medium text-white/85 mb-6 text-center">Iniciar Sesión</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="glass-label">Correo electrónico</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="glass-input text-sm" />
          </div>
          <div>
            <label htmlFor="password" className="glass-label">Contraseña</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="glass-input text-sm" />
          </div>
          {error && <p className="text-xs text-rose-400/60">{error}</p>}
          <button type="submit" className="btn-primary w-full text-sm py-3" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-white/30">¿No tienes cuenta? <Link to="/register" className="text-emerald/60 hover:text-emerald/80 transition-colors">Regístrate</Link></p>
      </div>
    </div>
  )
}
