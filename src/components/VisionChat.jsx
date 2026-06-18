import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import { motion } from 'framer-motion'
import NeuralGlassCard from './NeuralGlassCard'

const SUGGESTIONS = [
  "Describe esta imagen",
  "¿Qué ves en esta foto?",
  "Haz un análisis detallado",
  "¿Qué colores predominan?",
]

export default function VisionChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const chatEnd = useRef(null)
  const fileInput = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
    })
  }, [])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImage(ev.target.result)
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImage(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function sendMessage(suggestionText) {
    const text = suggestionText || input.trim()
    if (!text && !image) return

    if (!user) {
      window.location.href = '/login'
      return
    }

    const userMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError('')
    setLoading(true)

    let base64Image = null
    if (image) {
      base64Image = image.split(',')[1]
      removeImage()
    }

    try {
      const openaiMessages = newMessages.map(m => ({ ...m }))

      if (base64Image) {
        for (let i = openaiMessages.length - 1; i >= 0; i--) {
          if (openaiMessages[i].role === 'user') {
            openaiMessages[i] = {
              role: 'user',
              content: [
                { type: 'text', text: openaiMessages[i].content },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              ],
            }
            break
          }
        }
      }

      const res = await fetch('/model/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mlx-community/gemma-4-12B-it-8bit',
          messages: openaiMessages,
          stream: false,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text.slice(0, 200))
      }

      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.choices[0].message.content }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <NeuralGlassCard className="flex flex-col h-[600px]">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-white/70">Asistente Vision</h2>
        <p className="text-[0.6rem] text-white/30 mt-0.5">Sube una imagen o escribe una pregunta para Gemma 4</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4 scrollbar-thin">
        {messages.length === 0 && !image && (
          <div className="text-center py-12">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-white/15">
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m20.5 20.5-4-4" />
            </svg>
            <p className="text-xs text-white/30 mb-4">Pregúntame sobre cualquier imagen o escribe un mensaje</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="btn-ghost text-[0.55rem]" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3.5 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-emerald/10 text-white/80 rounded-2xl rounded-br-sm'
                : 'bg-white/[0.04] text-white/60 rounded-2xl rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 bg-white/[0.04] rounded-2xl rounded-bl-sm">
              <span className="inline-flex gap-1">
                <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" />
                <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1 h-1 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0.2s' }} />
              </span>
            </div>
          </div>
        )}

        {error && <div className="px-3.5 py-2 bg-rose-500/8 text-rose-400/60 text-xs">{error}</div>}
        <div ref={chatEnd} />
      </div>

      {image && (
        <div className="relative w-16 h-16 rounded-xl overflow-hidden mb-3 flex-shrink-0">
          <img src={image} alt="Preview" className="w-full h-full object-cover" />
          <button className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white text-[0.4rem] flex items-center justify-center hover:bg-black/70" onClick={removeImage}>×</button>
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="w-8 h-8 rounded-xl bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all flex-shrink-0" onClick={() => fileInput.current?.click()} title="Adjuntar imagen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m4 17 4.5-4.5 3 3L16 11l4 4.5" /></svg>
        </button>
        <input ref={fileInput} type="file" accept="image/*" onChange={handleImageSelect} hidden />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={image ? "Describe esta imagen..." : "Escribe un mensaje..."}
          rows={1}
          className="glass-input flex-1 text-xs resize-none py-2"
        />
        <button
          className="w-8 h-8 rounded-xl bg-emerald text-white flex items-center justify-center hover:bg-emerald-dark transition-all disabled:opacity-25 flex-shrink-0"
          onClick={() => sendMessage()}
          disabled={loading || (!input.trim() && !image)}
        >
          {loading ? (
            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
            </svg>
          )}
        </button>
      </div>
    </NeuralGlassCard>
  )
}
