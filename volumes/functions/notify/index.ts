import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

// Envia una confirmacion de compra por WhatsApp via la API de Twilio.
// Outbound: requiere TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN en el entorno.
// En el Sandbox, el numero destino debe haber hecho "join <code>" antes.

const JSON_HEADERS = { "Content-Type": "application/json" }
function log(...a: unknown[]) { console.log("[notify]", ...a) }

// Normaliza a formato whatsapp:+<digitos>
function toWhatsApp(num: string): string | null {
  let n = String(num).trim().replace(/[\s()-]/g, "")
  if (n.startsWith("whatsapp:")) n = n.slice("whatsapp:".length)
  if (!n.startsWith("+")) {
    // si son 9 digitos asumimos Peru (+51); si no, exigimos +
    if (/^\d{9}$/.test(n)) n = "+51" + n
    else if (/^\d{10,15}$/.test(n)) n = "+" + n
    else return null
  }
  if (!/^\+\d{8,15}$/.test(n)) return null
  return "whatsapp:" + n
}

function buildMessage(body: any): string {
  const lineas = (body.items ?? [])
    .map((i: any) => `• ${i.titulo} x${i.cantidad}`)
    .join("\n")
  const total = body.total != null ? `\nTotal: $${body.total}` : ""
  const orden = body.order_id ? ` (Orden #${String(body.order_id).slice(0, 8)})` : ""
  return (
    `✅ ¡Gracias por tu compra en CloudStore!${orden}\n\n` +
    (lineas ? `Resumen:\n${lineas}${total}\n\n` : "") +
    `Te avisaremos cuando tu pedido esté en camino. 📦`
  )
}

Deno.serve(async (req) => {
  try {
    // --- Auth (mismo patron que checkout) ---
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: JSON_HEADERS })
    }
    const jwtSecret = Deno.env.get("JWT_SECRET")
    if (!jwtSecret) {
      return new Response(JSON.stringify({ error: "JWT_SECRET no configurado" }), { status: 500, headers: JSON_HEADERS })
    }
    try {
      await jose.jwtVerify(authHeader.replace("Bearer ", ""), new TextEncoder().encode(jwtSecret))
    } catch {
      return new Response(JSON.stringify({ error: "JWT inválido" }), { status: 401, headers: JSON_HEADERS })
    }

    const body = await req.json()

    // Acepta un numero (telefono) o varios (telefonos: [])
    const rawNums: string[] = body.telefonos ?? (body.telefono ? [body.telefono] : [])
    if (!rawNums.length) {
      return new Response(JSON.stringify({ error: "Falta el número de WhatsApp" }), { status: 400, headers: JSON_HEADERS })
    }

    // --- Credenciales Twilio ---
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")
    const from = Deno.env.get("TWILIO_WHATSAPP_FROM") ?? "whatsapp:+14155238886"
    if (!sid || !token) {
      log("Faltan credenciales Twilio")
      return new Response(JSON.stringify({ error: "Twilio no configurado (faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)" }), { status: 500, headers: JSON_HEADERS })
    }

    const mensaje = body.mensaje || buildMessage(body)
    const auth = btoa(`${sid}:${token}`)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`

    // --- Enviar a cada numero ---
    const results = []
    for (const raw of rawNums) {
      const to = toWhatsApp(raw)
      if (!to) {
        results.push({ to: raw, ok: false, error: "número inválido" })
        continue
      }
      log("Enviando a", to)
      const form = new URLSearchParams({ From: from, To: to, Body: mensaje })
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) {
        results.push({ to, ok: true, sid: data.sid, status: data.status })
      } else {
        log("Error Twilio", to, data)
        results.push({ to, ok: false, error: data.message || `HTTP ${resp.status}`, code: data.code })
      }
    }

    const enviados = results.filter((r) => r.ok).length
    return new Response(JSON.stringify({ enviados, total: results.length, results }), { headers: JSON_HEADERS })
  } catch (err) {
    log("ERROR", err)
    return new Response(JSON.stringify({ error: `Error interno: ${err}` }), { status: 500, headers: JSON_HEADERS })
  }
})
