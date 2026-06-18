import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'

const SUGGESTIONS = [
  "Describe esta imagen",
  "¿Qué ves en esta foto?",
  "Haz un análisis detallado de la imagen",
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
    <div className="vision-chat">
      <div className="vision-chat-header">
        <div>
          <h2>Asistente Vision</h2>
          <p className="vision-chat-subtitle">Sube una imagen o escribe una pregunta para Gemma 4</p>
        </div>
      </div>

      <div className="vision-chat-messages">
        {messages.length === 0 && !image && (
          <div className="vision-chat-empty">
            <span className="vision-chat-empty-icon">🔍</span>
            <p>Pregúntame sobre cualquier imagen o escribe un mensaje</p>
            <div className="vision-chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="btn btn-sm btn-outline" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`vision-chat-msg ${msg.role}`}>
            <div className="vision-chat-bubble">
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="vision-chat-msg assistant">
            <div className="vision-chat-bubble vision-chat-thinking">
              <span className="vision-chat-dot" />
              <span className="vision-chat-dot" />
              <span className="vision-chat-dot" />
            </div>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}
        <div ref={chatEnd} />
      </div>

      {image && (
        <div className="vision-chat-preview">
          <img src={image} alt="Preview" />
          <button className="vision-chat-remove-img" onClick={removeImage}>×</button>
        </div>
      )}

      <div className="vision-chat-input">
        <button className="vision-chat-attach" onClick={() => fileInput.current?.click()} title="Adjuntar imagen">
          🖼️
        </button>
        <input ref={fileInput} type="file" accept="image/*" onChange={handleImageSelect} hidden />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={image ? "Describe esta imagen..." : "Escribe un mensaje... (Enter para enviar)"}
          rows={1}
        />
        <button
          className="btn vision-chat-send"
          onClick={() => sendMessage()}
          disabled={loading || (!input.trim() && !image)}
        >
          {loading ? '...' : '→'}
        </button>
      </div>
    </div>
  )
}
