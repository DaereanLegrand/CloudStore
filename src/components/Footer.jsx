import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="relative z-10 mt-24 px-4 pb-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between gap-8 py-8">
          <div className="max-w-xs">
            <span className="flex items-center gap-2 font-bold text-sm text-white/70">
              <svg className="w-4 h-4 text-emerald flex-none" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
            <p className="mt-2 text-[0.65rem] text-white/25 leading-relaxed">El marketplace en la nube. Compra y vende de forma simple, rápida y segura.</p>
          </div>
          <nav className="flex flex-col gap-1">
            <span className="text-[0.5rem] font-semibold text-white/25 uppercase tracking-[0.12em]">Explorar</span>
            <Link to="/products" className="text-[0.65rem] text-white/35 hover:text-white/70 transition-colors">Productos</Link>
            <Link to="/cart" className="text-[0.65rem] text-white/35 hover:text-white/70 transition-colors">Carrito</Link>
            <Link to="/orders" className="text-[0.65rem] text-white/35 hover:text-white/70 transition-colors">Órdenes</Link>
          </nav>
          <nav className="flex flex-col gap-1">
            <span className="text-[0.5rem] font-semibold text-white/25 uppercase tracking-[0.12em]">Cuenta</span>
            <Link to="/login" className="text-[0.65rem] text-white/35 hover:text-white/70 transition-colors">Entrar</Link>
            <Link to="/register" className="text-[0.65rem] text-white/35 hover:text-white/70 transition-colors">Registrarse</Link>
          </nav>
        </div>
        <div className="pt-3 text-[0.5rem] text-white/20 text-center">© 2026 CloudStore — Proyecto Cloud Computing, UCSP</div>
      </div>
    </footer>
  )
}
