import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuración del servidor incompleta" }), { status: 500, headers: JSON_HEADERS })
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: oldPromos, error: oldError } = await supabase
      .from("products")
      .select("id")
      .not("precio_promocion", "is", null)

    if (oldError) {
      return new Response(JSON.stringify({ error: `Error al leer promociones: ${oldError.message}` }), { status: 500, headers: JSON_HEADERS })
    }

    if (oldPromos && oldPromos.length > 0) {
      const ids = oldPromos.map((p: any) => p.id)
      const { error: clearError } = await supabase
        .from("products")
        .update({ precio_promocion: null })
        .in("id", ids)
      if (clearError) {
        return new Response(JSON.stringify({ error: `Error al limpiar promociones: ${clearError.message}` }), { status: 500, headers: JSON_HEADERS })
      }
    }

    const { data: promoted, error: promoError } = await supabase
      .from("products")
      .select("id, precio")
      .order("created_at", { ascending: false })
      .limit(20)

    if (promoError) {
      return new Response(JSON.stringify({ error: `Error al seleccionar productos: ${promoError.message}` }), { status: 500, headers: JSON_HEADERS })
    }

    if (!promoted || promoted.length === 0) {
      return new Response(JSON.stringify({ error: "No hay productos para promocionar" }), { status: 400, headers: JSON_HEADERS })
    }

    const updates = promoted.map((p: any) => ({
      id: p.id,
      precio_promocion: Math.round(Number(p.precio) * 0.8 * 100) / 100,
    }))

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("products")
        .update({ precio_promocion: update.precio_promocion })
        .eq("id", update.id)
      if (updateError) {
        console.error(`Error updating product ${update.id}: ${updateError.message}`)
      }
    }

    return new Response(JSON.stringify({ success: true, count: updates.length }), {
      headers: JSON_HEADERS,
    })
  } catch (err) {
    console.error("[promotions ERROR]", err)
    return new Response(JSON.stringify({ error: `Error interno: ${err}` }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
})
