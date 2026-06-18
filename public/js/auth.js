async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user || null
}

async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

function updateCartCount() {
  const spans = document.querySelectorAll('#cart-count')
  getCurrentUser().then(async (user) => {
    if (!user) {
      spans.forEach(el => el.textContent = '0')
      return
    }
    const { count } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('comprador_id', user.id)
    spans.forEach(el => el.textContent = count || 0)
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await getCurrentUser()
  const loginLink = document.getElementById('login-link')
  const registerLink = document.getElementById('register-link')
  const userInfo = document.getElementById('user-info')
  const userName = document.getElementById('user-name')
  const logoutBtn = document.getElementById('logout-btn')
  const sellLink = document.getElementById('sell-link')

  if (user && userInfo) {
    loginLink.style.display = 'none'
    registerLink.style.display = 'none'
    userInfo.style.display = 'inline'

    const profile = await getCurrentProfile()
    if (profile) {
      userName.textContent = profile.nombre
      if (profile.rol === 'vendedor' && sellLink) {
        sellLink.style.display = 'inline'
      }
    }
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut()
      window.location.href = '/'
    })
  }

  updateCartCount()
})
