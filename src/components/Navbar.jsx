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
        <Link to="/" className="logo">CloudStore</Link>
        <div className="nav-links">
          <Link to="/products">Productos</Link>
          <Link to="/cart" className="cart-link">
            Carrito
            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>
          <Link to="/orders">Mis Órdenes</Link>
          {user && <Link to="/promotions">🔥 Promociones</Link>}
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
