import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const OLLAMA_URL = "http://host.docker.internal:11434/api/embeddings"
const EMBED_MODEL = "bge-m3"
const JSON_HEADERS = { "Content-Type": "application/json" }

Deno.serve(async (req) => {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: "Cuerpo inválido" }), { status: 400, headers: JSON_HEADERS })
    }

    const query = body?.query?.trim()
    if (!query) {
      return new Response(JSON.stringify({ error: "Query requerida" }), { status: 400, headers: JSON_HEADERS })
    }

    const embRes = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: query }),
    })

    if (!embRes.ok) {
      const text = await embRes.text()
      return new Response(JSON.stringify({ error: `Error de embedding: ${text}` }), { status: 502, headers: JSON_HEADERS })
    }

    const embData = await embRes.json()
    const queryEmbedding = embData.embedding

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuración incompleta" }), { status: 500, headers: JSON_HEADERS })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: products, error: dbError } = await supabase.rpc("match_products", {
      query_embedding: queryEmbedding,
      match_count: 20,
    })

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: JSON_HEADERS })
    }

    return new Response(JSON.stringify({ products: products || [] }), { headers: JSON_HEADERS })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS })
  }
})
