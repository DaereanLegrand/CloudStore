import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import NewProduct from './pages/NewProduct'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import Promotions from './pages/Promotions'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/new-product" element={<NewProduct />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipe/:slug" element={<RecipeDetail />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
