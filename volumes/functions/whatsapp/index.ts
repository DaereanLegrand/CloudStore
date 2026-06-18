import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Agente de WhatsApp para CloudStore.
// Recibe el webhook de Twilio (form-urlencoded) y responde con TwiML.
// No requiere JWT (Twilio no lo envia); la ruta /functions/v1 es publica en Kong.

const XML_HEADERS = { "Content-Type": "text/xml; charset=utf-8" }

function log(...a: unknown[]) { console.log("[whatsapp]", ...a) }

// Escapar caracteres especiales de XML en el texto de respuesta
function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function twiml(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(message)}</Message></Response>`,
    { headers: XML_HEADERS },
  )
}

const MENU = `🛒 *CloudStore* — tu marketplace en la nube
Escribe:
• El nombre de un producto para buscarlo (ej: *cafetera*)
• *categorias* — ver categorias disponibles
• *cat:ropa* — productos de una categoria
• *ayuda* — ver este menu`

function formatProduct(p: any): string {
  const promo = p.precio_promocion != null && Number(p.precio_promocion) > 0
  const precio = promo
    ? `~$${p.precio}~ *$${p.precio_promocion}* 🔥`
    : `$${p.precio}`
  const stock = p.stock > 0 ? `stock: ${p.stock}` : "AGOTADO"
  return `• *${p.titulo}* — ${precio} (${stock})`
}

Deno.serve(async (req) => {
  try {
    // Twilio envia application/x-www-form-urlencoded
    const raw = await req.text()
    const params = new URLSearchParams(raw)
    const from = params.get("From") ?? ""
    const bodyText = (params.get("Body") ?? "").trim()
    const profile = params.get("ProfileName") ?? ""
    log("From:", from, "Profile:", profile, "Body:", bodyText)

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const text = bodyText.toLowerCase()

    // --- Saludo / menu ---
    if (!text || ["hola", "hi", "buenas", "menu", "menú", "ayuda", "help", "start"].includes(text)) {
      const saludo = profile ? `¡Hola ${profile}! 👋\n\n` : ""
      return twiml(saludo + MENU)
    }

    // --- Listar categorias ---
    if (text === "categorias" || text === "categorías") {
      const { data } = await supabase.from("products").select("categoria")
      const cats = [...new Set((data ?? []).map((r: any) => r.categoria))]
      if (!cats.length) return twiml("Aun no hay categorias con productos.")
      return twiml(
        "📂 *Categorias disponibles:*\n" +
        cats.map((c) => `• ${c}`).join("\n") +
        "\n\nEscribe *cat:<nombre>* para ver sus productos.",
      )
    }

    // --- Filtrar por categoria: cat:ropa ---
    if (text.startsWith("cat:")) {
      const cat = text.slice(4).trim()
      const { data } = await supabase
        .from("products")
        .select("titulo, precio, precio_promocion, stock")
        .ilike("categoria", cat)
        .order("created_at", { ascending: false })
        .limit(5)
      if (!data || !data.length) return twiml(`No encontre productos en la categoria "${cat}".`)
      return twiml(`📂 *${cat}* (top ${data.length}):\n` + data.map(formatProduct).join("\n"))
    }

    // --- Busqueda por nombre ---
    const { data, error } = await supabase
      .from("products")
      .select("titulo, precio, precio_promocion, stock")
      .ilike("titulo", `%${bodyText}%`)
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) {
      log("query error", error)
      return twiml("Ups, hubo un error buscando productos. Intenta de nuevo.")
    }
    if (!data || !data.length) {
      return twiml(
        `No encontre productos para *"${bodyText}"*. 🔎\n\nEscribe *categorias* para ver que hay, o *ayuda* para el menu.`,
      )
    }

    return twiml(
      `🔎 Resultados para *"${bodyText}"*:\n` +
      data.map(formatProduct).join("\n") +
      `\n\nVe el catalogo completo en cloudstore.qallariy.lat`,
    )
  } catch (err) {
    log("ERROR", err)
    return twiml("Ocurrio un error inesperado. Intenta mas tarde.")
  }
})
