import { motion } from 'framer-motion'

const ORBS = [
  {
    className: 'fixed -top-48 -left-48 w-[400px] h-[400px] rounded-full bg-emerald/[0.04] blur-[120px] pointer-events-none',
    animate: { x: [0, 40, -20, 0], y: [0, -30, 15, 0] },
    transition: { duration: 30, repeat: Infinity, ease: 'linear' },
  },
  {
    className: 'fixed -bottom-48 -right-48 w-[500px] h-[500px] rounded-full bg-white/[0.015] blur-[140px] pointer-events-none',
    animate: { x: [0, -30, 20, 0], y: [0, 30, -15, 0] },
    transition: { duration: 35, repeat: Infinity, ease: 'linear' },
  },
]

export default function NeuralCanvas({ children }) {
  return (
    <div className="relative w-full bg-deep-forest" style={{ minHeight: '100dvh' }}>
      {ORBS.map((orb, i) => (
        <motion.div key={i} animate={orb.animate} transition={orb.transition} className={orb.className} />
      ))}
      <div className="relative z-10 w-full">
        <div className="fixed inset-0 pointer-events-none bg-emerald-glow" />
        {children}
      </div>
    </div>
  )
}
