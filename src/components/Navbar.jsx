import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useCart } from '../CartContext'
import { motion } from 'framer-motion'

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
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 px-4 pt-4 pb-2"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-sm tracking-tight text-white/80 hover:text-white transition-colors">
          <svg className="w-5 h-5 text-emerald flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" />
            <g fill="#fff">
              <circle cx="9.9" cy="14.3" r="1.5" />
              <circle cx="12" cy="12.9" r="2" />
              <circle cx="14.1" cy="14.4" r="1.4" />
              <rect x="9.8" y="13.5" width="4.4" height="1.9" rx="0.95" />
            </g>
          </svg>
          CloudStore
        </Link>
        <div className="flex items-center gap-0.5">
          <Link to="/products" className="px-2.5 py-1.5 text-[0.7rem] font-medium text-white/40 hover:text-white/80 transition-colors">Productos</Link>
          <Link to="/recipes" className="px-2.5 py-1.5 text-[0.7rem] font-medium text-white/40 hover:text-white/80 transition-colors">Recetas</Link>
          <Link to="/cart" className="relative px-2.5 py-1.5 text-[0.7rem] font-medium text-white/40 hover:text-white/80 transition-colors">
            Carrito
            {cartCount > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-0.5 -right-0.5 bg-emerald text-white text-[0.4rem] font-bold min-w-[14px] h-3.5 rounded-full flex items-center justify-center px-[2px]">
                {cartCount}
              </motion.span>
            )}
          </Link>
          <Link to="/orders" className="px-2.5 py-1.5 text-[0.7rem] font-medium text-white/40 hover:text-white/80 transition-colors">Órdenes</Link>
          {user && (
            <Link to="/promotions" className="px-2.5 py-1.5 text-[0.7rem] font-medium text-white/40 hover:text-white/80 transition-colors">Promos</Link>
          )}
          {user ? (
            <span className="flex items-center gap-1.5 ml-2">
              <span className="text-[0.65rem] font-medium text-white/50 hidden sm:inline">{profile?.nombre}</span>
              {profile?.rol === 'vendedor' && (
                <Link to="/new-product" className="btn-primary text-[0.55rem] px-2.5 py-1">Vender</Link>
              )}
              <button onClick={handleLogout} className="text-[0.6rem] text-white/30 hover:text-white/60 transition-colors">Salir</button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 ml-2">
              <Link to="/login" className="text-[0.6rem] text-white/30 hover:text-white/60 transition-colors">Entrar</Link>
              <Link to="/register" className="btn-primary text-[0.55rem] px-2.5 py-1">Registro</Link>
            </span>
          )}
        </div>
      </div>
    </motion.nav>
  )
}
