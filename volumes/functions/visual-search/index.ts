import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const GEMMA_API = "http://192.168.0.121:8001/model/chat/completions"
const OLLAMA_URL = "http://host.docker.internal:11434/api/embeddings"
const EMBED_MODEL = "bge-m3"
const JSON_HEADERS = { "Content-Type": "application/json" }

const VISION_PROMPT = `Eres un clasificador de productos para un supermercado online.
Describe esta imagen ÚNICAMENTE con el nombre exacto del producto y su categoría.
Formato: "PRODUCTO: [nombre preciso] | CATEGORIA: [categoría]"
NO añadas descripciones, colores, marcas o texto adicional.
Ejemplos:
- Una imagen de spaghetti → "PRODUCTO: Fideos spaghetti | CATEGORIA: abarrotes"
- Una imagen de pasta dental → "PRODUCTO: Pasta dental | CATEGORIA: cuidado-personal"
- Una imagen de un jabón → "PRODUCTO: Jabon de lavar | CATEGORIA: cuidado-personal"`

function sanitize(text: string): string {
  return text
    .replace(/[*_`~#]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512)
}

function extractProductName(description: string): string {
  const match = description.match(/PRODUCTO:\s*([^|]+)/i)
  if (match) return match[1].trim()
  return description.replace(/CATEGORIA:\s*\S+/gi, "").trim() || description
}

function extractCategory(description: string): string | null {
  const match = description.match(/CATEGORIA:\s*(\S+)/i)
  return match ? match[1].trim().toLowerCase() : null
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
        max_tokens: 80,
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
    const productName = extractProductName(description)
    const detectedCategory = extractCategory(description)

    const embedText = productName || description
    const queryEmbedding = await getEmbedding(embedText)
    if (!queryEmbedding) return new Response(JSON.stringify({ error: "No se pudo generar el embedding" }), { status: 502, headers: JSON_HEADERS })

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) return new Response(JSON.stringify({ error: "Configuración incompleta" }), { status: 500, headers: JSON_HEADERS })
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: products, error: dbError } = await supabase.rpc("hybrid_search", {
      query_embedding: queryEmbedding,
      text_query: productName,
      match_count: 20,
      vector_threshold: 0.15,
      keyword_boost: 0.3,
    })
    if (dbError) return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: JSON_HEADERS })

    let results = products || []
    if (detectedCategory && results.length > 1) {
      const catBoosted = results.filter((p: any) => p.categoria === detectedCategory)
      const catRest = results.filter((p: any) => p.categoria !== detectedCategory)
      results = [...catBoosted, ...catRest]
    }

    return new Response(JSON.stringify({ products: results, description, productName, detectedCategory }), { headers: JSON_HEADERS })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS })
  }
})
