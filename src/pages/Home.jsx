import { useState } from 'react'
import SmartSearch from '../components/SmartSearch'
import { motion } from 'framer-motion'

export default function Home() {
  const [toast, setToast] = useState(null)

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      {toast && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="toast">
          ✓ {toast}
        </motion.div>
      )}
      <SmartSearch standalone />
    </div>
  )
}
