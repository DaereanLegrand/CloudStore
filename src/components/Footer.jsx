import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="logo">
            <svg className="logo-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" fill="currentColor" />
              <g fill="#fff">
                <circle cx="9.9" cy="14.3" r="1.5" />
                <circle cx="12" cy="12.9" r="2" />
                <circle cx="14.1" cy="14.4" r="1.4" />
                <rect x="9.8" y="13.5" width="4.4" height="1.9" rx="0.95" />
              </g>
            </svg>
            CloudStore
          </span>
          <p>El marketplace en la nube. Compra y vende de forma simple, rápida y segura.</p>
        </div>
        <nav className="footer-links">
          <span className="footer-links-title">Explorar</span>
          <Link to="/products">Productos</Link>
          <Link to="/cart">Carrito</Link>
          <Link to="/orders">Mis Órdenes</Link>
        </nav>
        <nav className="footer-links">
          <span className="footer-links-title">Cuenta</span>
          <Link to="/login">Iniciar Sesión</Link>
          <Link to="/register">Registrarse</Link>
        </nav>
      </div>
      <div className="footer-bottom container">
        <span>© 2026 CloudStore — Proyecto Cloud Computing, UCSP</span>
      </div>
    </footer>
  )
}
