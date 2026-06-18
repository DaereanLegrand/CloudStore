async function loadProducts(categoria = '', search = '') {
  const grid = document.getElementById('products-grid')
  if (!grid) return

  let query = supabase.from('products').select('*').order('created_at', { ascending: false })

  if (categoria) {
    query = query.eq('categoria', categoria)
  }

  if (search) {
    query = query.ilike('titulo', `%${search}%`)
  }

  const { data: products, error } = await query

  if (error) {
    grid.innerHTML = '<p>Error al cargar productos.</p>'
    return
  }

  if (!products || products.length === 0) {
    grid.innerHTML = '<p>No hay productos disponibles.</p>'
    return
  }

  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <img src="${p.imagen_url}" alt="${p.titulo}" loading="lazy">
      <div class="product-info">
        <h3>${p.titulo}</h3>
        <p class="price">$${p.precio}</p>
        <p class="stock">Stock: ${p.stock}</p>
        <span class="category">${p.categoria}</span>
        <button class="btn" onclick="addToCart('${p.id}')">Agregar al carrito</button>
      </div>
    </div>
  `).join('')
}

async function addToCart(productId) {
  const user = await getCurrentUser()
  if (!user) {
    window.location.href = 'pages/login.html'
    return
  }

  const { data: existing } = await supabase
    .from('cart_items')
    .select('*')
    .eq('comprador_id', user.id)
    .eq('product_id', productId)
    .single()

  if (existing) {
    await supabase
      .from('cart_items')
      .update({ cantidad: existing.cantidad + 1 })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('cart_items')
      .insert({ comprador_id: user.id, product_id: productId, cantidad: 1 })
  }

  updateCartCount()
}

document.addEventListener('DOMContentLoaded', () => {
  const categoryFilter = document.getElementById('category-filter')
  const searchInput = document.getElementById('search-input')

  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      loadProducts(categoryFilter.value, searchInput?.value || '')
    })
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      loadProducts(categoryFilter?.value || '', searchInput.value)
    })
  }

  loadProducts()
})
