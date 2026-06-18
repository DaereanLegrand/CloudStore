import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const { cartCount, fetchCartCount } = useCart()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); fetchCartCount() }
    })
    return () => subscription?.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    fetchCartCount()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="logo"><svg className="logo-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" /><g fill="#fff"><circle cx="9.9" cy="14.3" r="1.5" /><circle cx="12" cy="12.9" r="2" /><circle cx="14.1" cy="14.4" r="1.4" /><rect x="9.8" y="13.5" width="4.4" height="1.9" rx="0.95" /></g></svg>CloudStore</Link>
        <div className="nav-links">
          <Link to="/products">Productos</Link>
          <Link to="/cart" className="cart-link">
            Carrito
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          <Link to="/orders">Mis Órdenes</Link>
          {user && <Link to="/promotions">Promociones</Link>}
          {user ? (
            <span className="nav-user">
              <span className="nav-user-name">{profile?.nombre}</span>
              {profile?.rol === 'vendedor' && <Link to="/new-product" className="btn btn-sm">Vender</Link>}
              <button className="btn-logout" onClick={handleLogout}>Cerrar Sesión</button>
            </span>
          ) : (
            <span className="nav-auth">
              <Link to="/login">Iniciar Sesión</Link>
              <Link to="/register" className="btn btn-sm">Registrarse</Link>
            </span>
          )}
        </div>
      </div>
    </nav>
  )
}
