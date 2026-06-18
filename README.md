# CloudStore

Marketplace minimalista construido con Supabase self-hosted. Los compradores pueden explorar productos, agregarlos al carrito y realizar pedidos. Los vendedores pueden publicar productos con imágenes.

## Stack

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + Vite 5 + React Router DOM v6 |
| **Base de datos** | PostgreSQL 17 (Supabase) |
| **Auth** | GoTrue v2.189 (Supabase Auth) |
| **API REST** | PostgREST v14 |
| **API Gateway** | Kong 3.9 |
| **Edge Functions** | Deno / Supabase Edge Runtime |
| **Storage** | Supabase Storage API + imgproxy |
| **Realtime** | Supabase Realtime (Elixir/WebSocket) |
| **Connection Pooler** | Supavisor (Elixir) |
| **Orquestación** | Docker Compose |
| **Scraping** | Node.js (ESM) |

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
├── vite.config.js                  # Configuración de Vite (dev proxy a Kong)
├── package.json                    # Dependencias del frontend React
├── index.html                      # Entry point HTML del SPA
│
├── src/                            # Frontend React
│   ├── main.jsx                    # Punto de entrada React
│   ├── App.jsx                     # Componente raíz con rutas
│   ├── App.css                     # Estilos globales (indigo, skeletons, toast)
│   ├── supabase.js                 # Cliente Supabase
│   ├── CartContext.jsx             # Contexto de carrito (contador reactivo)
│   ├── components/
│   │   └── Navbar.jsx              # Barra de navegación con badge de carrito
│   └── pages/
│       ├── Home.jsx                # Landing page (últimos 8 productos)
│       ├── Products.jsx            # Listado con búsqueda y filtros
│       ├── ProductDetail.jsx       # Detalle de producto individual
│       ├── Login.jsx               # Inicio de sesión
│       ├── Register.jsx            # Registro (comprador/vendedor)
│       ├── Cart.jsx                # Carrito de compras
│       ├── NewProduct.jsx          # Publicar producto (solo vendedores)
│       └── Orders.jsx              # Historial de órdenes
│
├── scripts/                        # Scrapers de datos
│   ├── scraper.mjs                 # Scraper por API de categorías (Plazavea VTEX)
│   └── seed-products.mjs           # Scraper por sitemaps XML
│
└── volumes/                        # Configuración de servicios Docker
    ├── api/
    │   ├── kong.yml                # Configuración declarativa de Kong
    │   └── kong-entrypoint.sh      # Script de entrypoint con sustitución de vars
    ├── db/
    │   ├── cloudstore.sql          # Schema de la aplicación (tablas + RLS)
    │   ├── _supabase.sql           # Base de datos auxiliar _supabase
    │   ├── jwt.sql                 # Configuración JWT en PostgreSQL
    │   ├── roles.sql               # Passwords de roles de base de datos
    │   ├── realtime.sql            # Schema _realtime
    │   ├── webhooks.sql            # Infraestructura de webhooks
    │   ├── logs.sql                # Schema _analytics (Logflare)
    │   ├── pooler.sql              # Schema _supavisor
    │   └── data/                   # Datos persistentes (no versionado)
    ├── functions/
    │   ├── main/index.ts           # Router de Edge Functions (JWT + dispatch)
    │   └── checkout/index.ts       # Edge Function de checkout
    ├── nginx/
    │   └── default.conf            # Nginx (servir SPA + proxy reverso a Kong)
    ├── pooler/
    │   └── pooler.exs              # Configuración de Supavisor (Elixir)
    └── storage/                    # Archivos subidos (no versionado)
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

## Frontend (React)

### Rutas

| Ruta | Página | Acceso |
|---|---|---|
| `/` | Home | Público |
| `/products` | Products | Público |
| `/product/:id` | ProductDetail | Público |
| `/login` | Login | Público |
| `/register` | Register | Público |
| `/cart` | Cart | Requiere auth |
| `/orders` | Orders | Requiere auth |
| `/new-product` | NewProduct | Requiere rol `vendedor` |

### Componentes

- **CartContext:** Proveedor global que expone `cartCount` y `fetchCartCount`. Se actualiza automáticamente al cambiar sesión. Todas las páginas llaman `fetchCartCount` tras modificar el carrito.
- **Navbar:** Sticky, con badge circular en el link del carrito que refleja `cartCount` del contexto en tiempo real. Muestra nombre de perfil, enlace "Vender" (solo vendedores) y botón de logout. Detecta cambios de sesión via `onAuthStateChange`.
- **Home:** Carga los 8 productos más recientes. Muestra skeleton durante carga. Agregar al carrito muestra un toast animado. Botón deshabilitado si stock = 0.
- **Products:** Listado completo con búsqueda por título (`ilike`) y filtro por categoría. Skeleton grid, empty state con icono.
- **ProductDetail:** Página individual con imagen grande, precio, stock, vendedor, descripción y botón "Agregar al carrito". Skeleton durante carga.
- **Login/Register:** Formularios con botón de submit con estado "Entrando..."/"Registrando...". Errores mostrados como alertas. Register permite elegir entre `comprador` y `vendedor`.
- **Cart:** Items con controles de cantidad, subtotales y total. Botón "Pagar" invoca la Edge Function `checkout`. Skeleton durante carga, empty state con icono.
- **NewProduct:** Formulario con precio y stock en fila, subida de imagen a Storage.
- **Orders:** Historial de órdenes con estado coloreado (`pagado` verde, `pendiente` amarillo). Skeleton y empty state.

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

- **Paleta:** Indigo (`#6366f1`) como color primario, fondo gris claro, tarjetas blancas con sombras sutiles.
- **Esqueletos (skeletons):** Animaciones shimmer en Home, Products, ProductDetail, Cart y Orders mientras cargan datos.
- **Toast:** Notificación animada "✓ {producto} agregado al carrito" al hacer add-to-cart (desaparece a los 2s).
- **Estados vacíos:** Iconos grandes (📦, 🛒, 📋) y texto informativo cuando no hay datos.
- **Responsive:** Navbar compacto, layout de una columna en mobile para detail, filtros y carrito.
- **Transiciones:** Hover con elevación en cards, zoom en imágenes, focus ring en inputs.

## Seguridad

- Row-Level Security (RLS) en todas las tablas de PostgreSQL
- Autenticación JWT con verificación híbrida (HS256 simétrico o ES256/RS256 asimétrico via JWKS)
- Kong API Gateway con key-auth y ACL groups
- Las Edge Functions verifican JWT antes de procesar requests
- La función checkout decodifica el JWT internamente con `jose`, evita loop de auth contra Kong
- Los buckets de storage tienen políticas de acceso público/privado
- El dashboard de Studio está protegido con basic-auth
