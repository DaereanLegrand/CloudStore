import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const MODEL_API = "http://192.168.0.121:8000/v1/chat/completions"
const MODEL_NAME = "mlx-community/gemma-4-12B-it-8bit"
const JSON_HEADERS = { "Content-Type": "application/json" }

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: JSON_HEADERS })
    }

    const jwt = authHeader.replace("Bearer ", "")
    const encoder = new TextEncoder()
    const jwtSecret = Deno.env.get("JWT_SECRET")
    if (!jwtSecret) {
      return new Response(JSON.stringify({ error: "JWT_SECRET no configurado" }), { status: 500, headers: JSON_HEADERS })
    }
    const secret = encoder.encode(jwtSecret)

    try {
      await jose.jwtVerify(jwt, secret)
    } catch {
      return new Response(JSON.stringify({ error: "JWT inválido" }), { status: 401, headers: JSON_HEADERS })
    }

    let body
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: "Error al leer el cuerpo de la solicitud" }), { status: 400, headers: JSON_HEADERS })
    }

    const { messages, image } = body
    if (!messages || !messages.length) {
      return new Response(JSON.stringify({ error: "Mensaje requerido" }), { status: 400, headers: JSON_HEADERS })
    }

    const openaiMessages = [...messages]

    if (image) {
      const lastUserIdx = openaiMessages.length - 1
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

    const modelResp = await fetch(MODEL_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: openaiMessages,
        stream: false,
      }),
    })

    if (!modelResp.ok) {
      const text = await modelResp.text()
      return new Response(JSON.stringify({ error: `Error del modelo: ${text}` }), { status: 502, headers: JSON_HEADERS })
    }

    const data = await modelResp.json()
    const responseText = data.choices?.[0]?.message?.content || ""

    return new Response(JSON.stringify({ response: responseText }), { headers: JSON_HEADERS })
  } catch (err) {
    return new Response(JSON.stringify({ error: `Error interno: ${err.message}` }), { status: 500, headers: JSON_HEADERS })
  }
})
