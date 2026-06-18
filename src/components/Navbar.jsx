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
        <Link to="/" className="logo">☁️ CloudStore</Link>
        <div className="nav-links">
          <Link to="/products">Productos</Link>
          <Link to="/cart">Carrito ({cartCount})</Link>
          <Link to="/orders">Mis Órdenes</Link>
          {user ? (
            <span>
              {profile?.nombre}
              {profile?.rol === 'vendedor' && <Link to="/new-product" style={{ marginLeft: '0.8rem' }}>Vender</Link>}
              <button id="logout-btn" onClick={handleLogout} style={{ marginLeft: '0.8rem' }}>Cerrar Sesión</button>
            </span>
          ) : (
            <span>
              <Link to="/login">Iniciar Sesión</Link>
              <Link to="/register" style={{ marginLeft: '0.8rem' }}>Registrarse</Link>
            </span>
          )}
        </div>
      </div>
    </nav>
  )
}
