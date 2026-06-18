import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setCartCount(0) }
    })
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('comprador_id', userId)
    setCartCount(count || 0)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="logo"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" /><g fill="#fff"><circle cx="9.9" cy="14.3" r="1.5" /><circle cx="12" cy="12.9" r="2" /><circle cx="14.1" cy="14.4" r="1.4" /><rect x="9.8" y="13.5" width="4.4" height="1.9" rx="0.95" /></g></svg> CloudStore</Link>
        <div className="nav-links">
          <Link to="/products">Productos</Link>
          <Link to="/cart">Carrito <span className="badge badge-neutral">{cartCount}</span></Link>
          <Link to="/orders">Mis Órdenes</Link>
          {user ? (
            <>
              <span>{profile?.nombre}</span>
              {profile?.rol === 'vendedor' && <Link to="/new-product">Vender</Link>}
              <button id="logout-btn" onClick={handleLogout}>Cerrar Sesión</button>
            </>
          ) : (
            <>
              <Link to="/login">Iniciar Sesión</Link>
              <Link to="/register">Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
