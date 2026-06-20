import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

const JSON_HEADERS = { "Content-Type": "application/json" }

function log(...args: unknown[]) {
  console.log(`[checkout]`, ...args)
}

function logError(...args: unknown[]) {
  console.error(`[checkout ERROR]`, ...args)
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8)
  log(`[${requestId}] Request started`, req.method, req.url)

  try {
    // --- Auth: verify JWT ---
    const authHeader = req.headers.get("Authorization")
    log(`[${requestId}] Auth header present:`, !!authHeader)
    if (!authHeader) {
      logError(`[${requestId}] Missing Authorization header`)
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: JSON_HEADERS })
    }

    const jwt = authHeader.replace("Bearer ", "")
    const encoder = new TextEncoder()
    const jwtSecret = Deno.env.get("JWT_SECRET")
    log(`[${requestId}] JWT_SECRET available:`, !!jwtSecret)
    if (!jwtSecret) {
      logError(`[${requestId}] JWT_SECRET env var is empty or missing`)
      return new Response(JSON.stringify({ error: "JWT_SECRET no configurado" }), { status: 500, headers: JSON_HEADERS })
    }
    const secret = encoder.encode(jwtSecret)

    let userId: string
    try {
      const { payload } = await jose.jwtVerify(jwt, secret)
      userId = payload.sub as string
      log(`[${requestId}] JWT verified, userId:`, userId)
    } catch (jwtErr) {
      logError(`[${requestId}] JWT verification failed:`, jwtErr)
      return new Response(JSON.stringify({ error: `JWT inválido: ${jwtErr}` }), { status: 401, headers: JSON_HEADERS })
    }

    // --- Init Supabase client ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    log(`[${requestId}] SUPABASE_URL present:`, !!supabaseUrl)
    log(`[${requestId}] SUPABASE_SERVICE_ROLE_KEY present:`, !!serviceRoleKey)
    if (!supabaseUrl || !serviceRoleKey) {
      logError(`[${requestId}] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars`)
      return new Response(JSON.stringify({ error: "Configuración del servidor incompleta" }), { status: 500, headers: JSON_HEADERS })
    }
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

    // --- Parse request body ---
    let body: { items?: { product_id: string; cantidad: number }[] }
    try {
      body = await req.json()
      log(`[${requestId}] Body parsed, items count:`, body.items?.length ?? 0)
    } catch (parseErr) {
      logError(`[${requestId}] Failed to parse request body:`, parseErr)
      return new Response(JSON.stringify({ error: `Error al leer el cuerpo de la solicitud: ${parseErr}` }), { status: 400, headers: JSON_HEADERS })
    }

    const { items } = body
    if (!items || items.length === 0) {
      logError(`[${requestId}] Cart is empty`)
      return new Response(JSON.stringify({ error: "Carrito vacío" }), { status: 400, headers: JSON_HEADERS })
    }
    log(`[${requestId}] Items:`, JSON.stringify(items))

    // --- Fetch products ---
    const productIds = items.map((i: any) => i.product_id)
    log(`[${requestId}] Fetching products:`, productIds)

    const { data: products, error: prodError } = await supabaseClient
      .from("products")
      .select("id, titulo, precio, precio_promocion, stock")
      .in("id", productIds)

    if (prodError) {
      logError(`[${requestId}] Products query failed:`, prodError)
      return new Response(JSON.stringify({ error: "Error al leer productos" }), { status: 500, headers: JSON_HEADERS })
    }
    if (!products || products.length === 0) {
      logError(`[${requestId}] No products found for IDs:`, productIds)
      return new Response(JSON.stringify({ error: "No se encontraron productos" }), { status: 400, headers: JSON_HEADERS })
    }
    log(`[${requestId}] Products found:`, products.length)

    // --- Validate stock ---
    for (const item of items) {
      const product = products.find((p: any) => p.id === item.product_id)
      if (!product) {
        logError(`[${requestId}] Product not found:`, item.product_id)
        return new Response(JSON.stringify({ error: `Producto no encontrado: ${item.product_id}` }), { status: 400, headers: JSON_HEADERS })
      }
      if (product.stock < item.cantidad) {
        logError(`[${requestId}] Insufficient stock for`, product.titulo, `requested:`, item.cantidad, `available:`, product.stock)
        return new Response(JSON.stringify({ error: `Stock insuficiente para ${product.titulo}` }), { status: 400, headers: JSON_HEADERS })
      }
    }
    log(`[${requestId}] Stock validation passed`)

    // --- Calculate total and prepare order items ---
    let total = 0
    const orderItems = items.map((item: any) => {
      const product = products.find((p: any) => p.id === item.product_id)!
      const effectivePrice = Number(product.precio_promocion || product.precio)
      const subtotal = effectivePrice * item.cantidad
      total += subtotal
      return {
        product_id: product.id,
        titulo: product.titulo,
        precio: effectivePrice,
        cantidad: item.cantidad,
      }
    })
    log(`[${requestId}] Total calculated:`, total)

    // --- Insert order ---
    log(`[${requestId}] Creating order for userId:`, userId, `total:`, total)
    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({ comprador_id: userId, total, estado: "pagado" })
      .select()
      .single()

    if (orderError) {
      logError(`[${requestId}] Order insert failed:`, orderError)
      return new Response(JSON.stringify({ error: "Error al crear la orden" }), { status: 500, headers: JSON_HEADERS })
    }
    if (!order) {
      logError(`[${requestId}] Order insert returned no data`)
      return new Response(JSON.stringify({ error: "No se pudo crear la orden" }), { status: 500, headers: JSON_HEADERS })
    }
    log(`[${requestId}] Order created:`, order.id)

    // --- Insert order items ---
    const orderItemsWithOrderId = orderItems.map((item: any) => ({ ...item, order_id: order.id }))
    log(`[${requestId}] Inserting order items:`, orderItemsWithOrderId.length)

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItemsWithOrderId)

    if (itemsError) {
      logError(`[${requestId}] Order items insert failed:`, itemsError)
      log(`[${requestId}] Rolling back order:`, order.id)
      const { error: deleteError } = await supabaseClient.from("orders").delete().eq("id", order.id)
      if (deleteError) {
        logError(`[${requestId}] Rollback delete also failed:`, deleteError)
      }
      return new Response(JSON.stringify({ error: "Error al guardar items de la orden" }), { status: 500, headers: JSON_HEADERS })
    }
    log(`[${requestId}] Order items inserted successfully`)

    // --- Decrement stock with rollback on failure ---
    const stockUpdates: Array<{id: string; originalStock: number; decrement: number}> = items.map((item: any) => {
      const product = products.find((p: any) => p.id === item.product_id)!
      return { id: item.product_id, originalStock: product.stock, decrement: item.cantidad }
    })
    const updatedStockIds: string[] = []
    let stockErrorOccurred = false
    for (const update of stockUpdates) {
      log(`[${requestId}] Updating stock for product`, update.id, `:`, update.originalStock, `->`, update.originalStock - update.decrement)
      const { error: stockError } = await supabaseClient
        .from("products")
        .update({ stock: update.originalStock - update.decrement })
        .eq("id", update.id)
      if (stockError) {
        logError(`[${requestId}] Stock update failed for product`, update.id, `:`, stockError)
        stockErrorOccurred = true
        break
      }
      updatedStockIds.push(update.id)
    }
    if (stockErrorOccurred) {
      log(`[${requestId}] Rolling back stock updates for`, updatedStockIds.length, `products`)
      for (const rollbackId of updatedStockIds) {
        const rollbackUpdate = stockUpdates.find(u => u.id === rollbackId)!
        const { error: rollbackError } = await supabaseClient
          .from("products")
          .update({ stock: rollbackUpdate.originalStock })
          .eq("id", rollbackId)
        if (rollbackError) {
          logError(`[${requestId}] Stock rollback failed for product`, rollbackId, `:`, rollbackError)
        }
      }
      log(`[${requestId}] Rolling back order:`, order.id)
      await supabaseClient.from("orders").delete().eq("id", order.id)
      return new Response(JSON.stringify({ error: "Error al actualizar stock" }), { status: 500, headers: JSON_HEADERS })
    }
    log(`[${requestId}] Stock updated`)

    // --- Clear cart ---
    log(`[${requestId}] Clearing cart for userId:`, userId)
    const { error: cartError, count } = await supabaseClient
      .from("cart_items")
      .delete({ count: "exact" })
      .eq("comprador_id", userId)
    if (cartError) {
      logError(`[${requestId}] Cart clear failed:`, cartError)
    } else {
      log(`[${requestId}] Cart cleared, deleted:`, count, `items`)
    }

    log(`[${requestId}] Checkout complete, order:`, order.id)
    return new Response(JSON.stringify({ success: true, order_id: order.id, total }), {
      headers: JSON_HEADERS,
    })
  } catch (err) {
    logError(`[${requestId}] Unhandled exception:`, err)
    if (err instanceof Error) {
      logError(`[${requestId}] Stack:`, err.stack)
    }
    return new Response(JSON.stringify({ error: `Error interno: ${err}` }), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
})
