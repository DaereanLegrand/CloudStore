import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const OLLAMA_URL = "http://host.docker.internal:11434/api/embeddings"
const EMBED_MODEL = "bge-m3"
const JSON_HEADERS = { "Content-Type": "application/json" }

interface Expansion {
  keywords: string[]
  replacement: string
}

const EXPANSIONS: Expansion[] = [
  // === ALCOHOL / DRINKING ===
  { keywords: ["olvidar a mi ex", "olvidar", "superar", "despechado", "despecho", "corazon roto", "triste por amor"], replacement: "cerveza OR vino OR pisco OR licor OR ron OR vodka OR whisky OR champagne" },
  { keywords: ["triste", "deprimido", "solo", "melancolico", "aburrido"], replacement: "helado OR chocolate OR dulce OR pastel OR snack OR cerveza OR galleta OR golosina" },
  { keywords: ["resaca", "cruda", "guayabo", "chuchaqui"], replacement: "agua OR gatorade OR hidratante OR energizante OR limon OR jengibre OR rehidratante" },
  { keywords: ["fiesta", "party", "reunion", "junta", "celebrar", "celebracion", "farra"], replacement: "cerveza OR vino OR pisco OR gaseosa OR snack OR botana OR galleta OR pastel OR globos OR decoracion" },
  { keywords: ["romantico", "romance", "cena romantica", "pareja", "san valentin", "enamorado", "vela"], replacement: "vino OR rosado OR chocolate OR fresa OR champagne OR licor OR fondue" },

  // === CINE / TV / ENTRETENIMIENTO ===
  { keywords: ["noche de cine", "cine", "pelicula", "maraton", "ver serie", "netflix"], replacement: "palomitas OR canchita OR gaseosa OR snack OR cerveza OR chocolate OR botana OR galleta" },
  { keywords: ["jugar", "videojuego", "gaming", "game", "viciar"], replacement: "gaseosa OR snack OR papas OR cerveza OR energizante OR golosina" },

  // === BBQ / PARRILLA ===
  { keywords: ["bbq", "barbacoa", "parrillada", "hacer bbq", "parrilla", "asado", "asar"], replacement: "carne OR parrilla OR carbon OR asado OR chorizo OR hamburguesa OR salchicha OR pollo OR parrillero OR marinada" },

  // === PICNIC / AIRE LIBRE ===
  { keywords: ["picnic", "campo", "paseo", "aire libre", "lonchera"], replacement: "jugo OR agua OR fruta OR snack OR galleta OR pan OR bebida OR sandwich OR canasta" },

  // === DEPORTE / EJERCICIO ===
  { keywords: ["deporte", "ejercicio", "gym", "entrenar", "entrenamiento", "crossfit", "correr", "running"], replacement: "agua OR energizante OR proteina OR barra OR fruta OR bebida OR deporte OR isotonica" },

  // === COCINA / COMIDA ===
  { keywords: ["cocinar", "preparar", "receta", "chef", "cocina"], replacement: "aceite OR especias OR condimento OR harina OR arroz OR fideo OR verdura OR sal OR ingrediente" },
  { keywords: ["desayuno", "desayunar", "breakfast"], replacement: "pan OR leche OR cereal OR mermelada OR huevo OR cafe OR jugo OR yogurt OR avena" },
  { keywords: ["almuerzo", "almorzar", "comida"], replacement: "arroz OR carne OR pollo OR fideo OR papa OR menestra OR aceite OR verdura OR menestra" },
  { keywords: ["cena", "cenar"], replacement: "carne OR pollo OR pescado OR vino OR verdura OR arroz OR ensalada OR queso OR pasta" },

  // === MASCOTAS ===
  { keywords: ["perro", "cachorro"], replacement: "alimento OR perro OR hueso OR mascota OR galleta" },
  { keywords: ["gato", "gatito"], replacement: "alimento OR gato OR arena OR mascota OR gatito" },
  { keywords: ["mascota", "mascotas"], replacement: "alimento OR perro OR gato OR mascota OR hueso OR galleta" },

  // === BEBE ===
  { keywords: ["bebe", "bebe", "recien nacido", "embarazada", "embarazo"], replacement: "pañales OR toallitas OR humedas OR bebe OR babero OR chupete OR biberon OR formula" },

  // === HOGAR / LIMPIEZA ===
  { keywords: ["limpiar", "limpieza", "ordenar", "aseo"], replacement: "detergente OR lavandina OR escoba OR trapeador OR limpiatodo OR jabon OR desinfectante OR limpia" },
  { keywords: ["lavar", "ropa", "lavanderia"], replacement: "detergente OR jabon OR suavizante OR quitamanchas OR lavar OR ropa" },

  // === SALUD / BIENESTAR ===
  { keywords: ["enfermo", "gripe", "tos", "fiebre", "dolor", "malestar", "resfriado", "resfrio", "catarro", "congestionado"], replacement: "jarabe OR pastilla OR analgesico OR vitamina OR miel OR limon OR jengibre OR panadol OR paracetamol OR eucalipto OR menta" },
  { keywords: ["vitamina", "suplemento", "proteinas"], replacement: "vitamina OR suplemento OR proteina OR colageno OR magnesio OR calcio OR multivitaminico" },

  // === CUIDADO PERSONAL ===
  { keywords: ["cuidado personal", "higiene", "banio", "ducha"], replacement: "jabon OR shampoo OR desodorante OR crema OR pasta OR dientes OR cepillo OR dental" },
  { keywords: ["cabello", "pelo", "shampoo"], replacement: "shampoo OR acondicionador OR tratamiento OR capilar OR cepillo OR gel OR tinte" },

  // === HAMBRE / SED ===
  { keywords: ["hambre", "tengo hambre", "hambriento", "quiero comer"], replacement: "comida OR snack OR pan OR arroz OR carne OR pollo OR fideo OR papa OR menestra OR verdura OR fruta" },
  { keywords: ["sed", "tengo sed", "sediento"], replacement: "agua OR gaseosa OR jugo OR refresco OR bebida OR hidratante" },

  // === DOLOR / ENFERMEDAD ===
  { keywords: ["duele", "dolor", "me duele", "dolor de cabeza", "dolor de estomago", "dolor muscular"], replacement: "analgesico OR panadol OR paracetamol OR ibuprofeno OR pastilla OR jarabe OR vitamina" },

  // === VISITAS / INVITADOS ===
  { keywords: ["visita", "invitados", "invitar", "recibir", "visitas inesperadas", "llega visita"], replacement: "gaseosa OR snack OR galleta OR pastel OR cerveza OR vino OR cafe OR te OR pan" },

  // === DIETA / BAJAR DE PESO ===
  { keywords: ["bajar de peso", "dieta", "adelgazar", "perder peso", "light", "saludable"], replacement: "light OR dieta OR saludable OR integral OR fruta OR verdura OR proteina OR ensalada OR sin azucar OR cero" },

  // === ENGORDAR / SUBIR DE PESO ===
  { keywords: ["engordar", "subir de peso", "aumentar masa", "ganar peso"], replacement: "carne OR pollo OR leche OR huevo OR queso OR avena OR proteina OR chocolate OR harina" },

  // === ANTOJOS ===
  { keywords: ["antoja", "antojo", "antojos", "se me antoja", "craving", "quiero algo"], replacement: "chocolate OR dulce OR galleta OR snack OR helado OR pastel OR gomitas OR caramelo OR fruta" },
  { keywords: ["dulce", "algo dulce", "golosina", "caramelo", "postre"], replacement: "chocolate OR dulce OR galleta OR helado OR pastel OR gomitas OR caramelo OR snack" },
  { keywords: ["salado", "algo salado"], replacement: "papas OR snack OR canchita OR galleta salada OR mani OR aceituna OR botana" },

  // === CLIMA ===
  { keywords: ["calor", "hace calor", "caluroso", "verano"], replacement: "helado OR agua OR gaseosa OR cerveza OR refresco OR jugo OR hielo OR bebida" },
  { keywords: ["frio", "hace frio", "invierno"], replacement: "cafe OR te OR chocolate caliente OR sopa OR caldo OR avena" },

  // === RELAJARSE ===
  { keywords: ["relajar", "relajarse", "descansar", "ocio", "estres", "estresado"], replacement: "te OR cafe OR vino OR chocolate OR musica OR pelicula OR snack OR libro OR bebida" },

  // === COMPARTIR ===
  { keywords: ["compartir", "reunirse", "amigos", "pasar el rato"], replacement: "snack OR cerveza OR gaseosa OR galleta OR papas OR vino OR pisco OR botana OR chocolate" },

  // === PLATOS PERUANOS (dish names → ingredients) ===
  { keywords: ["papa rellena"], replacement: "papa OR carne molida OR cebolla OR aceituna OR pasas OR harina OR aceite OR ajo OR sal OR pimienta OR huevo" },
  { keywords: ["lomo saltado"], replacement: "carne OR cebolla OR tomate OR ajo OR culantro OR arroz OR papa OR vinagre OR sillao OR pimienta OR comino OR aceite OR aji amarillo OR maicena" },
  { keywords: ["lomo montado"], replacement: "carne OR arroz OR huevo OR platano OR cebolla OR tomate OR aceite OR sal OR lechuga" },
  { keywords: ["lomo a lo pobre"], replacement: "carne OR papa OR huevo OR cebolla OR aceite OR arroz OR sal OR tomate" },
  { keywords: ["aji de gallina"], replacement: "pollo OR pan OR leche OR queso OR ají OR nuez OR arroz OR papa OR huevo OR aceite OR ajo OR cebolla" },
  { keywords: ["ceviche", "cebiche", "causa", "tiradito"], replacement: "pescado OR limon OR cebolla OR ají OR camote OR cancha OR lechuga OR sal" },
  { keywords: ["arroz con pollo"], replacement: "arroz OR pollo OR cebolla OR ajo OR culantro OR cerveza OR papa OR zanahoria OR alverja OR aceite" },
  { keywords: ["seco", "seco de pollo", "seco de carne"], replacement: "carne OR pollo OR cilantro OR culantro OR cebolla OR ajo OR arroz OR frejol ORaceite OR cerveza" },
  { keywords: ["carapulcra"], replacement: "papa seca OR carne OR cerdo OR mani OR cebolla OR ajo OR ají OR chocolate OR comino OR aceite" },
  { keywords: ["cau cau"], replacement: "mondongo OR pollo OR papa OR cebolla OR ajo OR ají OR hierbabuena OR arroz OR vinagre OR sal" },
  { keywords: ["tacu tacu"], replacement: "frejol OR arroz OR cebolla OR ajo OR ají OR aceite OR huevo OR camote OR salsa" },
  { keywords: ["pollo a la brasa"], replacement: "pollo OR cerveza OR sillao OR ajo OR comino OR pimienta OR papa OR ensalada OR aceite OR sal" },
  { keywords: ["anticucho"], replacement: "corazon OR carne OR ají OR panca OR vinagre OR ajo OR comino OR cerveza OR papa OR choclo" },
  { keywords: ["causa"], replacement: "papa OR ají OR limon OR atun OR pollo OR palta OR mayonesa OR aceituna OR huevo OR sal" },
  { keywords: ["estofado", "estofado de pollo", "estofado de carne"], replacement: "carne OR pollo OR papa OR zanahoria OR cebolla OR ajo OR arveja OR vino OR aceite OR caldo" },
  { keywords: ["saltado", "salteado"], replacement: "carne OR pollo OR verduras OR cebolla OR tomate OR ajo OR sillao OR arroz OR papa OR aceite" },
  { keywords: ["sopa"], replacement: "fideo OR verdura OR pollo OR caldo OR papa OR zanahoria OR apio OR cebolla OR ajo OR sal" },
  { keywords: ["caldo", "caldo de gallina", "caldo de pollo"], replacement: "pollo OR gallina OR fideo OR papa OR zanahoria OR apio OR cebolla OR ajo OR huevo OR sal" },
  { keywords: ["chaufa", "arroz chaufa"], replacement: "arroz OR pollo OR huevo OR sillao OR cebolla OR ajo OR aceite OR sal OR verduras" },
  { keywords: ["adobo", "adobo de cerdo"], replacement: "cerdo OR cebolla OR ajo OR ají OR vinagre OR chicha OR camote OR arroz OR comino OR sal" },
  { keywords: ["tamal", "humita", "tamales"], replacement: "maiz OR harina OR manteca OR pollo OR cebolla OR ajo OR ají OR aceituna OR huevo OR sal" },
  { keywords: ["picante", "picante de pollo", "picante de carne"], replacement: "carne OR pollo OR papa OR arroz OR cebolla OR ajo OR ají OR aceite OR sal OR comino" },
  { keywords: ["crocante", "chicharron"], replacement: "cerdo OR pescado OR pollo OR limon OR camote OR salsa OR cebolla OR sal OR aceite OR yuca" },
  { keywords: ["sudado", "sudado de pescado", "pescado sudado"], replacement: "pescado OR cebolla OR tomate OR ajo OR ají OR cilantro OR limon OR arroz OR camote OR sal" },
  { keywords: ["jalea", "jalea de pescado", "jalea mixta"], replacement: "pescado OR mariscos OR yuca OR limon OR cebolla OR salsa OR sal OR aceite" },
  { keywords: ["rocoto relleno"], replacement: "rocoto OR carne OR queso OR cebolla OR ajo OR leche OR huevo OR aceite OR pasas OR arroz OR sal" },
  { keywords: ["pachamanca"], replacement: "carne OR cerdo OR pollo OR camote OR papa OR choclo OR haba OR sal OR aceite OR hierbabuena" },
  { keywords: ["olluquito"], replacement: "olluco OR carne OR cebolla OR ajo OR ají OR queso OR leche OR arroz OR hierbabuena OR aceite" },
  { keywords: ["frejol", "frejoles", "frijol", "tacu tacu", "frejol colado"], replacement: "frejol OR frijol OR cebolla OR ajo OR aceite OR azucar OR leche OR canela OR pan OR arroz" },
  { keywords: ["crema", "crema de zapallo", "crema de esparrago"], replacement: "zapallo OR esparrago OR verdura OR leche OR mantequilla OR pan OR pollo OR caldo OR sal" },

  // === OFICINA / ESTUDIO ===
  { keywords: ["oficina", "escritorio", "trabajo", "estudiar", "estudio", "universidad"], replacement: "cuaderno OR lapicero OR computadora OR escritorio OR silla OR utiles OR papel OR impresora OR oficina" },
  { keywords: ["escuela", "colegio", "clases", "utiles escolares"], replacement: "cuaderno OR lapicero OR mochila OR colores OR carpeta OR papel OR tijera OR escolar" },
]

const NO_EXPANSION_WORDS = new Set([
  "leche", "pan", "arroz", "fideo", "carne", "pollo", "cerveza", "gaseosa",
  "agua", "jabon", "shampoo", "detergente", "papel", "vino", "pisco", "ron",
  "whisky", "chocolate", "galleta", "snack", "papa", "huevo", "queso",
  "yogurt", "cafe", "te", "azucar", "sal", "aceite", "harina", "verdura",
  "fruta", "manzana", "platano", "naranja", "limon", "tomate", "cebolla",
  "ajo", "pasta", "atun", "sardina", "mantequilla", "margarina",
  "comida", "alimento", "bebida", "bebida", "refresco", "jugo",
  "perro", "gato", "mascota", "mascotas",
  "ropa", "zapatos", "camisa", "pantalon",
  "medicina", "pastilla", "jarabe", "vitamina",
  "cerveza", "licor", "whisky", "vodka", "pisco",
  "detergente", "lavandina", "suavizante", "limpiatodo",
  "shampoo", "acondicionador", "desodorante", "crema",
  "cuaderno", "lapicero", "mochila", "computadora",
  "televisor", "celular", "audifonos", "cargador",
  "carne", "pollo", "pescado", "chancho", "res",
  "verdura", "fruta", "hortaliza", "legumbre",
  "bebe", "pañales", "toallitas", "humedas",
  "cerveza", "vino", "pisco", "licor", "ron",
  "palomitas", "canchita", "botana", "snack",
  "aceite", "harina", "azucar", "sal", "especia",
  "yuca", "camote", "ocopa", "rocoto", "aji",
])

function expandQuery(query: string): string | null {
  const lower = query.toLowerCase().trim()

  const words = lower.split(/\s+/)
  const allSimple = words.every(w => NO_EXPANSION_WORDS.has(w))
  if (allSimple) return null

  for (const exp of EXPANSIONS) {
    for (const kw of exp.keywords) {
      if (lower.includes(kw)) return exp.replacement
    }
  }

  return null
}

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

    const expandedQuery = expandQuery(query)

    const embedPrompt = expandedQuery ? `${query} ${expandedQuery.replace(/ OR /g, " ")}` : query

    const embRes = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: embedPrompt }),
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

    const textQuery = expandedQuery || query

    const { data: products, error: dbError } = await supabase.rpc("hybrid_search", {
      query_embedding: queryEmbedding,
      text_query: textQuery,
      match_count: 20,
      vector_threshold: 0.15,
      keyword_boost: 0.3,
    })

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), { status: 500, headers: JSON_HEADERS })
    }

    let matchedRecipe: any[] | null = null
    try {
      const STOP_WORDS = new Set(["quiero","hacer","una","para","el","la","los","las","un","unas","del","con","en","por","y","o","pero","mas","muy","al","lo","tu","su","mis","sus","este","esta","esto","ese","esa","eso","todo","cada","mismo","propio","otros","otra","otro","como","que","de","se","no","a","e","es","ser","tener","haber","estar","poder","preparar","aprende","aprender","decir","ir","ver","saber","dar","querer","llegar","pasar","deber","creer","llevar","comprar","buscar","necesitar","tengo","tiene","puedo","puede","hago","hace","soy","eres","somos"])
      const words = [...new Set(query.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2 && !STOP_WORDS.has(w)))]
      const seenSlugs = new Set<string>()

      const addResults = (rows: any[], max: number) => {
        for (const r of rows) {
          if (!seenSlugs.has(r.slug) && matchedRecipe && matchedRecipe.length < max) {
            seenSlugs.add(r.slug)
            matchedRecipe.push(r)
          }
        }
      }

      matchedRecipe = []

      const { data: phraseResults } = await supabase
        .from("recipes")
        .select("slug, titulo, descripcion, dificultad, tiempo_preparacion, porciones, calorias, imagen_url, categoria")
        .or(`titulo.ilike.%${query}%,descripcion.ilike.%${query}%`)
        .limit(3)
      if (phraseResults) {
        phraseResults.sort((a: any, b: any) => {
          const aT = a.titulo.toLowerCase(), bT = b.titulo.toLowerCase()
          const aExact = aT === query.toLowerCase() ? 0 : aT.startsWith(query.toLowerCase()) ? 1 : 2
          const bExact = bT === query.toLowerCase() ? 0 : bT.startsWith(query.toLowerCase()) ? 1 : 2
          return aExact - bExact
        })
        addResults(phraseResults, 3)
      }

      for (const kw of words) {
        if (matchedRecipe.length >= 3) break
        const { data } = await supabase
          .from("recipes")
          .select("slug, titulo, descripcion, dificultad, tiempo_preparacion, porciones, calorias, imagen_url, categoria")
          .or(`titulo.ilike.%${kw}%,descripcion.ilike.%${kw}%,categoria.ilike.%${kw}%`)
          .limit(10)
        if (data && data.length > 0) {
          data.sort((a: any, b: any) => {
            const aT = a.titulo.toLowerCase(), bT = b.titulo.toLowerCase()
            return (aT.includes(kw) ? 0 : 1) - (bT.includes(kw) ? 0 : 1)
          })
          addResults(data, 3)
        }
      }
      if (matchedRecipe.length === 0) matchedRecipe = null
    } catch {
      // Silently ignore recipe search errors
    }

    const expanded = expandedQuery !== null
    return new Response(JSON.stringify({ products: products || [], recipes: matchedRecipe, expanded }), { headers: JSON_HEADERS })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: JSON_HEADERS })
  }
})
