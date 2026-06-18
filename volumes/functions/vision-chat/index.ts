const MODEL_API = "http://192.168.0.121:8000/v1/chat/completions"
const MODEL_NAME = "mlx-community/gemma-4-12B-it-8bit"
const JSON_HEADERS = { "Content-Type": "application/json" }
const FETCH_TIMEOUT = 120000

Deno.serve(async (req) => {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: "Error al leer el cuerpo" }), { status: 400, headers: JSON_HEADERS })
    }

    const { messages, image } = body
    if (!messages || !messages.length) {
      return new Response(JSON.stringify({ error: "Mensaje requerido" }), { status: 400, headers: JSON_HEADERS })
    }

    const openaiMessages = messages.map(m => ({ ...m }))

    if (image) {
      for (let i = openaiMessages.length - 1; i >= 0; i--) {
        if (openaiMessages[i].role === "user") {
          openaiMessages[i] = {
            role: "user",
            content: [
              { type: "text", text: openaiMessages[i].content },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } },
            ],
          }
          break
        }
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    try {
      const modelResp = await fetch(MODEL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL_NAME, messages: openaiMessages, stream: false }),
        signal: controller.signal,
      })

      if (!modelResp.ok) {
        const text = await modelResp.text()
        return new Response(JSON.stringify({ error: `Error del modelo: ${text}` }), { status: 502, headers: JSON_HEADERS })
      }

      const data = await modelResp.json()
      return new Response(JSON.stringify({ response: data.choices?.[0]?.message?.content || "" }), { headers: JSON_HEADERS })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: `Error interno: ${err.message}` }), { status: 500, headers: JSON_HEADERS })
  }
})
