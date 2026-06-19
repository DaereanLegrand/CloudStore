# CloudStore

Marketplace con búsqueda por IA construido con Supabase self-hosted. Los compradores exploran productos mediante búsqueda semántica (texto + imagen), siguen recetas con ingredientes mapeados al catálogo, y compran en un solo clic.

## Stack

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite 5 + React Router DOM v6 + Framer Motion + Tailwind CSS |
| **Base de datos** | PostgreSQL 17 (Supabase) + pgvector |
| **Auth** | GoTrue v2.189 (Supabase Auth) |
| **API REST** | PostgREST v14 |
| **API Gateway** | Kong 3.9 |
| **Edge Functions** | Deno / Supabase Edge Runtime |
| **Storage** | Supabase Storage API + imgproxy |
| **Realtime** | Supabase Realtime (Elixir/WebSocket) |
| **Connection Pooler** | Supavisor (Elixir) |
| **Orquestación** | Docker Compose |
| **Scraping** | Node.js (ESM) |
| **AI local** | Ollama (bge-m3) + Gemma 4 (visión) |
| **Túnel** | Cloudflare (cloudflared) |

## Requisitos

- Docker y Docker Compose
- Node.js 18+ (solo para desarrollo del frontend)

## Inicio rápido

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd CloudStore

# 2. Iniciar todo el stack de Supabase + frontend
sh run.sh start

# 3. Abrir Studio (dashboard admin de Supabase)
open http://localhost:3333
# Usuario: admin / Contraseña: admin123

# 4. Aplicar migraciones de la aplicación
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/cloudstore.sql

# 5. Abrir la aplicación
open http://localhost:8080
```

### Scripts de desarrollo del frontend

```bash
npm run dev      # Servidor de desarrollo Vite en :8080
npm run build    # Build de producción
npm run preview  # Vista previa del build
```

## Estructura del proyecto

```
CloudStore/
├── docker-compose.yml              # 12 servicios (Supabase + frontend)
├── .env                            # 85+ variables de entorno (no versionado)
├── run.sh                          # Script de gestión del stack
├── reset.sh                        # Reset destructivo del stack
├── vite.config.js                  # Configuración Vite (proxy + allowedHosts Cloudflare)
├── postcss.config.js               # PostCSS + Tailwind CSS
├── tailwind.config.js              # Tailwind (deep-forest, emerald, liquid-edge shadows)
├── package.json                    # Dependencias: React, Framer Motion, Supabase, Tailwind
├── index.html                      # Entry point SPA
│
├── src/                            # Frontend React
│   ├── main.jsx                    # Entry point React
│   ├── App.jsx                     # Layout: NeuralCanvas > flex > Navbar + Routes + Footer
│   ├── index.css                   # Tailwind + clases glass/btn custom (sin @apply)
│   ├── supabase.js                 # Cliente Supabase
│   ├── CartContext.jsx             # Contexto carrito (contador reactivo)
│   ├── categories.js              # Taxonomía categorías
│   ├── utils/
│   │   └── llm-logger.js          # Logger local para queries LLM
│   ├── components/
│   │   ├── NeuralCanvas.jsx       # Layout: fondo deep-forest + orbes cinéticos + glow
│   │   ├── NeuralGlassCard.jsx    # Panel vidrio con Spring Physics + highlight
│   │   ├── Navbar.jsx             # Sticky glass-sm nav + badge carrito animado
│   │   ├── Footer.jsx             # Glass-sm footer minimalista
│   │   ├── ProductCard.jsx        # Card producto con imagen, precio S/., oferta
│   │   ├── RecipeCard.jsx         # Card receta con dificultad, tiempo
│   │   ├── SmartSearch.jsx       # Búsqueda IA (texto + imagen), resultados + recetas
│   │   └── VisionChat.jsx         # Chat con Gemma 4 (imagen + texto)
│   └── pages/
│       ├── Home.jsx               # AI-first: solo SmartSearch en centro
│       ├── Products.jsx           # Grid + filtros + paginación
│       ├── ProductDetail.jsx      # Detalle producto + S/. precio
│       ├── Recipes.jsx            # Catálogo recetas + filtros + paginación
│       ├── RecipeDetail.jsx       # Ingredientes scrollables + replace + skip + total S/.
│       ├── Cart.jsx               # Carrito + Vaciar (con confirmación)
│       ├── Orders.jsx             # Historial órdenes
│       ├── Promotions.jsx         # Activar 20% descuento
│       ├── NewProduct.jsx         # Publicar producto (vendedor)
│       ├── Login.jsx              # Inicio sesión
│       └── Register.jsx           # Registro (comprador/vendedor)
│
├── scripts/                        # Scrapers + mapping + seeds
│   ├── scraper.mjs                 # Scraper Plazavea VTEX API
│   ├── seed-products.mjs           # Scraper por sitemaps XML
│   ├── scraper-nestle-recipes.mjs  # Scraper recetas Nestlé (444 recetas)
│   ├── map-ingredients.mjs         # Mapeo ingredientes → productos (semántico + ILIKE)
│   ├── map-ingredients-worker.mjs  # Worker paralelo para mapping rápido
│   ├── fix-mappings.mjs           # Corrector mappings con scoring mejorado
│   ├── seed-recipes.mjs           # Insertar recetas + ingredientes en BD
│   ├── generate-embeddings.mjs    # Pre-cómputo embeddings para pgvector
│   ├── generate-dish-expansions.mjs # Expansiones semánticas por plato
│   └── output/                    # Outputs generados (*.json, gitignored)
│
├── volumes/                        # Configuración servicios Docker
│   ├── api/
│   │   ├── kong.yml               # Config declarativa Kong
│   │   └── kong-entrypoint.sh     # Entrypoint con sustitución de vars
│   ├── db/
│   │   ├── cloudstore.sql         # Schema app: recipes, recipe_ingredients, + columnas
│   │   ├── vector.sql             # pgvector + hybrid_search RPC + índices HNSW/GIN
│   │   ├── _supabase.sql, jwt.sql, roles.sql, realtime.sql, webhooks.sql, logs.sql, pooler.sql
│   │   └── data/                  # Datos persistentes (no versionado)
│   ├── functions/
│   │   ├── main/index.ts          # Router Edge Functions (JWT + dispatch workers)
│   │   ├── checkout/index.ts      # Checkout (orden, stock, carrito)
│   │   ├── semantic-search/index.ts # Búsqueda semántica texto + expansión + recetas
│   │   ├── visual-search/index.ts # Búsqueda por imagen (Gemma 4 → embedding → pgvector + recetas)
│   │   ├── promotions/index.ts    # Promociones (descuento 20%)
│   │   ├── notify/index.ts        # Notificación WhatsApp (Twilio)
│   │   ├── whatsapp/index.ts      # Chatbot WhatsApp (Twilio)
│   │   └── vision-chat/index.ts   # Chat con imagen (Gemma 4 vía MLX)
│   ├── nginx/
│   │   └── default.conf           # Nginx (SPA + proxy Kong + log LLM)
│   ├── pooler/
│   │   └── pooler.exs             # Supavisor config
│   └── storage/                   # Archivos subidos (no versionado)
│
├── docs/                           # Documentación
│   ├── arquitectura.md            # Arquitectura completa + diagramas
│   ├── recetas.md                 # Sistema de recetas + mapping ingredientes
│   ├── smartsearch.md             # Búsqueda semántica + visual
│   └── testing.md                 # Guía de testing
│
└── public/                         # Build producción (nginx docker, no versionado)
```

## Endpoints

| Servicio | URL | Descripción |
|---|---|---|
| **CloudStore App** | `http://localhost:8080` | Frontend React |
| **Studio** | `http://localhost:3333` | Dashboard admin de Supabase |
| **REST API** | `http://localhost:8080/rest/v1/` | PostgREST |
| **Auth** | `http://localhost:8080/auth/v1/` | GoTrue Auth |
| **Storage** | `http://localhost:8080/storage/v1/` | Subida/descarga de archivos |
| **Edge Functions** | `http://localhost:8080/functions/v1/` | Deno Edge Functions |
| **Realtime** | `ws://localhost:8080/realtime/v1/` | WebSockets |
| **PostgreSQL** | `localhost:5432` | Conexión directa (pooler) |
| **PostgREST Admin** | `localhost:3001` | Health checks internos |

## Base de datos (PostgreSQL)

### Schema: `volumes/db/cloudstore.sql`

**Enums:**
- `user_role`: `comprador` | `vendedor`

**Tablas:**

| Tabla | Descripción | RLS |
|---|---|---|
| `profiles` | Perfiles de usuario (nombre, email, rol) | Lectura pública, inserción/edición propia |
| `products` | Productos (vendedor, título, precio, stock, categoría, imagen) | Lectura pública, solo vendedor crea/edita/elimina propios |
| `cart_items` | Items en carrito (comprador, producto, cantidad) | Solo el comprador dueño |
| `orders` | Órdenes de compra (comprador, total, estado) | Solo el comprador dueño |
| `order_items` | Items de una orden (snapshot de producto + precio) | Solo el comprador dueño |

**Storage bucket:** `productos` (público) para imágenes de productos.

**Seed data:** Los scripts en `scripts/` scrapean productos reales de Plazavea (Perú) y generan `scripts/output/plazavea-products.json`.

## Edge Functions (Deno)

### Router: `volumes/functions/main/index.ts`
- Verifica JWT (soporta HS256, ES256, RS256 via JWKS de Supabase Auth)
- Enruta requests a funciones hijas según el path (`/functions/v1/checkout` -> ejecuta `checkout/index.ts`)
- Crea workers aislados por función con límite de 150MB y timeout de 60s

### Checkout: `volumes/functions/checkout/index.ts`
- Recibe `{ items: [{ product_id, cantidad }] }`
- Decodifica JWT localmente con `jose` en vez de llamar `auth.getUser()` (evita loop de autenticación con Kong)
- Extrae `userId` del payload del JWT (el main router ya verificó la firma)
- Usa `SUPABASE_SERVICE_ROLE_KEY` para el cliente Supabase (Kong acepta la key)
- Verifica existencia de productos y stock suficiente
- Calcula total, crea orden con estado `pagado`
- Inserta items de orden (snapshot de título y precio)
- Descuenta stock de cada producto
- Limpia el carrito del comprador
- Rollback automático si falla la inserción de items

## API Gateway (Kong)

Kong actúa como puerta de enlace para todos los servicios de Supabase:

- **Autenticación:** key-auth con 3 consumidores (`anon`, `service_role`, `DASHBOARD`)
- **Control de acceso:** ACL groups (`anon` para usuarios anónimos, `admin` para service_role)
- **CORS:** Habilitado en todos los servicios
- **Transformación:** Inyección automática del header `Authorization` vía `request-transformer`
- **Dashboard:** Basic auth para el Studio
- **MCP:** Bloqueado con `request-termination`

### Consumidores

| Consumer | Credenciales | Grupos |
|---|---|---|
| `anon` | `ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` | `anon` |
| `service_role` | `SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` | `admin` |
| `DASHBOARD` | `DASHBOARD_USERNAME` + `DASHBOARD_PASSWORD` (basic-auth) | - |

### Entrypoint (`kong-entrypoint.sh`)
- Determina si usa claves simétricas o asimétricas
- Sustituye variables `$VAR` en `kong.yml` con valores de entorno via `awk`
- Remueve entradas `key:` vacías

## Frontend (React) — Diseño Liquid Glass

El frontend implementa un diseño **Neural Expressive + Liquid Glass** basado en Spring Physics Motion Tailwind.

### Paleta

- **Fondo:** `linear-gradient(145deg, #0a1a14 → #143028)` — verde bosque profundo
- **Primario:** `#15966a` — esmeralda
- **Hover:** `#0f7a57` — esmeralda oscuro
- **Vidrio:** `rgba(255,255,255,0.03)` con `backdrop-blur-xl`
- **Brillo especular:** Gradiente radial en esquina superior
- **Órbitas cinéticas:** 2 orbes animados con Framer Motion (movimiento perpetuo suave)

### Componentes de diseño

| Componente | Propósito |
|---|---|
| `NeuralCanvas.jsx` | Layout maestro: fondo deep-forest, orbes animados, capa de brillo |
| `NeuralGlassCard.jsx` | Panel de vidrio con Spring Physics (stiffness: 200, damping: 24) |
| `SmartSearch.jsx` | Búsqueda por IA con expansión semántica + keywords |

### Rutas

| Ruta | Página | Acceso |
|---|---|---|
| `/` | Home (AI-first: solo buscador) | Público |
| `/products` | Products | Público |
| `/product/:id` | ProductDetail | Público |
| `/recipes` | Recipes (catálogo con filtros) | Público |
| `/recipe/:slug` | RecipeDetail (ingredientes + replace) | Público |
| `/login` | Login | Público |
| `/register` | Register | Público |
| `/cart` | Cart | Requiere auth |
| `/orders` | Orders | Requiere auth |
| `/new-product` | NewProduct | Requiere rol `vendedor` |
| `/promotions` | Promotions | Requiere auth |

### Componentes

- **Navbar:** Barra glass-sm, sticky, con badge animado de carrito, enlace "Vender" solo para vendedores
- **Home:** AI-first — solo muestra el buscador SmartSearch con placeholder "Escribe algo..." y título "¿Qué necesitas hoy?".
- **SmartSearch:** Búsqueda semántica con expansión de consulta (intenciones del usuario mapeadas a productos). Extrae keywords eliminando stop words. También busca recetas relacionadas. Thinking pill animado durante carga.
- **ProductCard:** Card glass con hover elevación, imagen con zoom, precio S/., badge de categoría y oferta, botón "Agregar".
- **RecipeCard:** Card glass con imagen, dificultad, tiempo, porciones.
- **RecipeDetail:** Panel de ingredientes con scroll propio (max 70vh). Cada ingrediente muestra:
  - Nombre del ingrediente + cantidad
  - Producto asignado por IA (→ nombre + precio)
  - **Total parcial** S/. (cantidad × precio unitario) al lado
  - Botón **+ Carrito** (agrega 1 unidad)
  - Botón **↻ Reemplazar** (abre buscador con imágenes para re-asignar producto)
  - Botón **✓ Ya tengo** (marca como saltado, resta del total)
  - **Total general** de la receta (se actualiza dinámicamente al reemplazar/saltar)
  - Panel de instrucciones con scroll propio
- **Cart:** Items con controles de cantidad, subtotales por item, total general. Botón **Vaciar carrito** rojo con confirmación "¿Estás seguro? Todo el progreso será perdido."
- **Products:** Filtros por categoría + búsqueda ILIKE. Paginación con números.
- **ProductDetail:** Imagen grande, precio S/., stock, vendedor, descripción, botón "Agregar".
- **Orders:** Historial con estado coloreado, items snapshot.
- **Promotions:** Activar descuento del 20% en 20 productos aleatorios via Edge Function.
- **Footer:** Glass-sm minimalista con enlaces.

### Conexión a Supabase

El cliente se configura con URL y anon key desde variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, con fallbacks a valores por defecto.

### Proxy de desarrollo (Vite)

En desarrollo, Vite redirige `/rest/`, `/auth/`, `/storage/` y `/functions/` a Kong en `http://localhost:3333`.

### Proxy de producción (Nginx)

El contenedor `frontend` usa Nginx para servir los archivos estáticos y proxy reverso a Kong para todas las rutas de API.

## Servicios Docker

| Servicio | Imagen | Puerto | Propósito |
|---|---|---|---|
| `studio` | `supabase/studio:2026.06.03` | - | Dashboard web de Supabase |
| `kong` | `kong/kong:3.9.1` | 8000, 8443 | API Gateway |
| `auth` | `supabase/gotrue:v2.189.0` | - | Autenticación |
| `rest` | `postgrest/postgrest:v14.12` | - | REST API de PostgreSQL |
| `realtime` | `supabase/realtime:v2.102.3` | - | WebSocket Realtime |
| `storage` | `supabase/storage-api:v1.60.4` | - | File storage |
| `imgproxy` | `darthsim/imgproxy:v3.30.1` | - | Transformación de imágenes |
| `meta` | `supabase/postgres-meta:v0.96.6` | - | Metadatos de DB para Studio |
| `functions` | `supabase/edge-runtime:v1.74.0` | - | Deno Edge Runtime |
| `db` | `supabase/postgres:17.6.1.136` | - | PostgreSQL |
| `supavisor` | `supabase/supavisor:2.9.5` | 5432, 6543 | Connection pooler |
| `frontend` | `nginx:1.27-alpine` | 8080 | Frontend React + proxy |

## Comandos de gestión

```bash
sh run.sh start                    # Iniciar todo el stack
sh run.sh stop                     # Detener el stack
sh run.sh status                   # Estado de servicios
sh run.sh logs [servicio]          # Ver logs en tiempo real
sh run.sh restart [servicio]       # Reiniciar servicio(s)
sh run.sh recreate [servicio]      # Forzar recreación de contenedor(es)
sh run.sh inspect <servicio>       # Inspeccionar contenedor via docker inspect
sh run.sh printenv <servicio>      # Ver variables de entorno de un servicio
sh run.sh pull                     # Actualizar imágenes Docker
sh run.sh secrets                  # Mostrar credenciales clave
sh run.sh config                   # Mostrar configuración COMPOSE_FILE actual
sh run.sh config add <nombre>      # Agregar override a COMPOSE_FILE
sh run.sh config remove <nombre>   # Remover override de COMPOSE_FILE
sh run.sh compose-config           # Mostrar configuración resuelta de compose
sh run.sh help                     # Ayuda completa
```

```bash
sh reset.sh                        # Reset destructivo (confirma)
sh reset.sh -y                     # Reset destructivo (automático)
```

## Estructura de .env

El archivo `.env` (no versionado) contiene ~85 variables que configuran:

| Grupo | Variables clave |
|---|---|
| **PostgreSQL** | `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` |
| **JWT** | `JWT_SECRET`, `JWT_EXPIRY`, `ANON_KEY`, `SERVICE_ROLE_KEY` |
| **Auth** | `DISABLE_SIGNUP`, `ENABLE_EMAIL_SIGNUP`, `SITE_URL`, SMTP config |
| **Storage** | `STORAGE_BACKEND`, `FILE_SIZE_LIMIT`, `ENABLE_IMAGE_TRANSFORMATION` |
| **Pooler** | `POOLER_DEFAULT_POOL_SIZE`, `POOLER_MAX_CLIENT_CONN` |
| **Studio** | `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, `STUDIO_DEFAULT_ORGANIZATION` |
| **Funciones** | `FUNCTIONS_VERIFY_JWT` |
| **S3** | `S3_PROTOCOL_ACCESS_KEY_ID`, `S3_PROTOCOL_ACCESS_KEY_SECRET` |
| **URLs** | `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, `SITE_URL` |

## Scrapers

Dos scripts Node.js (ESM) para obtener datos de Plazavea (Perú):

### `scripts/scraper.mjs`
- Usa la API de catálogo VTEX de Plazavea
- Itera 19 categorías, obtiene hasta 30 productos por categoría
- Mapea categorías VTEX a una taxonomía normalizada
- Deduplica por título
- Guarda en `scripts/output/plazavea-products.json`

### `scripts/seed-products.mjs`
- Descubre slugs de productos desde 20 sitemaps XML
- Obtiene detalles de hasta 200 productos en batches de 5
- Mismo mapeo de categorías y formato de salida

```bash
node scripts/scraper.mjs
node scripts/seed-products.mjs
```

## UI/UX

### Sistema de Diseño: Neural Expressive + Liquid Glass

- **Backdrop:** Fondo `deep-forest` (gradiente verde oscuro 145°) con 2 orbes cinéticos animados (30-35s loop) y brillo radial emerald en la zona superior.
- **Superficies:** Vidrio translúcido `rgba(255,255,255,0.03)` con `backdrop-blur-xl`. Sin bordes — las tarjetas se funden con el canvas. La separación visual viene dada por opacidad y tipografía.
- **Botones:** Fondo sólido `#15966a` (emerald) con hover `#0f7a57`. Únicos elementos con fondo opaco.
- **Tipografía:** Inter, jerarquía por opacidad (15% → 90%). Sin decoraciones.
- **Moneda:** `S/.` (Sol Peruano con punto)
- **Motion:** Spring Physics de Framer Motion (`stiffness: 200, damping: 24, mass: 0.5`). Entradas con `opacity: 0, y: 6 → 1, 0`. Hover con `y: -1`.
- **Pensando:** Pill animado con dots "Pensando..." durante carga de búsqueda semántica.
- **Toast:** Fixed top, `rgba(255,255,255,0.06)` con `backdrop-blur-2xl`.
- **Scroll:** Custom thin scrollbar. Paneles de ingredientes/instrucciones con `max-height: 70vh` y scroll interno.
- **Responsive:** Una columna en mobile, 2-5 columnas en desktop según página.
- **Transiciones:** 300ms en colores, 700ms en escalas de imagen. Active scale 0.97 en botones.

## Seguridad

- Row-Level Security (RLS) en todas las tablas de PostgreSQL
- Autenticación JWT con verificación híbrida (HS256 simétrico o ES256/RS256 asimétrico via JWKS)
- Kong API Gateway con key-auth y ACL groups
- Las Edge Functions verifican JWT antes de procesar requests
- La función checkout decodifica el JWT internamente con `jose`, evita loop de auth contra Kong
- Los buckets de storage tienen políticas de acceso público/privado
- El dashboard de Studio está protegido con basic-auth
