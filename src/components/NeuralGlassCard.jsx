import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export default function NeuralGlassCard({ children, className, hover = true, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -1 } : undefined}
      transition={{ type: 'spring', stiffness: 200, damping: 24, mass: 0.5 }}
      className={twMerge(clsx('rounded-2xl bg-white/[0.03] p-5', className))}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function NeuralGlassPanel({ children, className, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className={twMerge(clsx('rounded-xl bg-white/[0.02] p-4', className))}
      {...props}
    >
      {children}
    </motion.div>
  )
}
