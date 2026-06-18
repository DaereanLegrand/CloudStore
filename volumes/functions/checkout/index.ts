import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts"

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 })
    }

    const jwt = authHeader.replace("Bearer ", "")
    const encoder = new TextEncoder()
    const secret = encoder.encode(Deno.env.get("JWT_SECRET") ?? "")
    const { payload } = await jose.jwtVerify(jwt, secret)
    const userId = payload.sub as string

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { items } = await req.json()
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "Carrito vacío" }), { status: 400 })
    }

    const productIds = items.map((i: any) => i.product_id)
    const { data: products, error: prodError } = await supabaseClient
      .from("products")
      .select("id, titulo, precio, stock")
      .in("id", productIds)

    if (prodError || !products) {
      return new Response(JSON.stringify({ error: "Error al leer productos" }), { status: 500 })
    }

    for (const item of items) {
      const product = products.find((p: any) => p.id === item.product_id)
      if (!product) {
        return new Response(JSON.stringify({ error: `Producto no encontrado` }), { status: 400 })
      }
      if (product.stock < item.cantidad) {
        return new Response(JSON.stringify({ error: `Stock insuficiente para ${product.titulo}` }), { status: 400 })
      }
    }

    let total = 0
    const orderItems = items.map((item: any) => {
      const product = products.find((p: any) => p.id === item.product_id)!
      const subtotal = Number(product.precio) * item.cantidad
      total += subtotal
      return {
        product_id: product.id,
        titulo: product.titulo,
        precio: Number(product.precio),
        cantidad: item.cantidad,
      }
    })

    const { data: order, error: orderError } = await supabaseClient
      .from("orders")
      .insert({ comprador_id: userId, total, estado: "pagado" })
      .select()
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Error al crear la orden" }), { status: 500 })
    }

    const orderItemsWithOrderId = orderItems.map((item: any) => ({ ...item, order_id: order.id }))

    const { error: itemsError } = await supabaseClient
      .from("order_items")
      .insert(orderItemsWithOrderId)

    if (itemsError) {
      await supabaseClient.from("orders").delete().eq("id", order.id)
      return new Response(JSON.stringify({ error: "Error al guardar items de la orden" }), { status: 500 })
    }

    for (const item of items) {
      const product = products.find((p: any) => p.id === item.product_id)!
      await supabaseClient.from("products").update({ stock: product.stock - item.cantidad }).eq("id", item.product_id)
    }

    await supabaseClient.from("cart_items").delete().eq("comprador_id", userId)

    return new Response(JSON.stringify({ success: true, order_id: order.id, total }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
