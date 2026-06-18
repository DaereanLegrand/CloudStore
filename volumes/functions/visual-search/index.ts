import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const GEMMA_API = "http://192.168.0.121:8001/model/chat/completions"
const OLLAMA_URL = "http://host.docker.internal:11434/api/embeddings"
const EMBED_MODEL = "bge-m3"
const JSON_HEADERS = { "Content-Type": "application/json" }

const VISION_PROMPT = "Describe este producto en una oración concisa para búsqueda en un catálogo. Menciona tipo, categoría y características clave."

function sanitize(text: string): string {
  return text
    .replace(/[*_`~#]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512)
}

async function getEmbedding(text: string): Promise<number[] | null> {
  for (const prompt of [text, text.slice(0, 120), text.slice(0, 80), text.slice(0, 40)]) {
    try {
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ model: EMBED_MODEL, prompt }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.embedding) return data.embedding
      }
    } catch {
      // fallback al siguiente intento
    }
  }
  return null
}

Deno.serve(async (req) => {
  try {
    let body
    try { body = await req.json() }
    catch { return new Response(JSON.stringify({ error: "Cuerpo inválido" }), { status: 400, headers: JSON_HEADERS }) }

    const image = body?.image?.trim()
    if (!image) return new Response(JSON.stringify({ error: "Imagen requerida" }), { status: 400, headers: JSON_HEADERS })

    const visionResp = await fetch(GEMMA_API, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        messages: [{ role: "user", content: VISION_PROMPT, image }],
        max_tokens: 100,
        stream: false,
      }),
    })
    if (!visionResp.ok) {
      const text = await visionResp.text()
      return new Response(JSON.stringify({ error: `Error del modelo de visión: ${text.slice(0, 200)}` }), { status: 502, headers: JSON_HEADERS })
    }

    const visionData = await visionResp.json()
    const rawDescription = visionData.choices?.[0]?.message?.content?.trim()
    if (!rawDescription) return new Response(JSON.stringify({ error: "El modelo no generó una descripción" }), { status: 502, headers: JSON_HEADERS })

    const description = sanitize(rawDescription)
    const queryEmbedding = await getEmbedding(description)
    if (!queryEmbedding) return new Response(JSON.stringify({ error: "No se pudo generar el embedding" }), { status: 502, headers: JSON_HEADERS })

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: "Configuración incompleta" }), { status: 500, headers: JSON_HEADERS })
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: products, error: dbError } = await supabase.rpc("match_products", {
      query_embedding: queryEmbedding,
      match_count: 20,
    })
    if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: JSON_HEADERS })

    return new Response(JSON.stringify({ products: products || [], description }), { headers: JSON_HEADERS })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS })
  }
})
