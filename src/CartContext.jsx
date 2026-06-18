import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0)

  async function fetchCartCount() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setCartCount(0); return }
    const { count } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('comprador_id', session.user.id)
    setCartCount(count || 0)
  }

  useEffect(() => {
    fetchCartCount()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCartCount()
    })
    return () => subscription?.unsubscribe()
  }, [])

  return (
    <CartContext.Provider value={{ cartCount, fetchCartCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
