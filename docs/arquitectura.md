# CloudStore — Documento de Arquitectura

---

## 1. Introducción

CloudStore es un marketplace digital desarrollado como proyecto final del curso de Cloud Computing. La aplicación permite la compra y venta de productos de consumo masivo (abarrotes, carnes, bebidas, electrónicos, etc.) con capacidades de **búsqueda semántica por texto** e **búsqueda visual por imagen** impulsadas por inteligencia artificial.

El proyecto está completamente **self-hosted** sobre una arquitectura de microservicios basada en Supabase (código abierto), ejecutada sobre Docker Compose en un servidor local. Se complementa con modelos de IA locales (Ollama + bge-m3 para embeddings, Gemma 4 para visión) que permiten búsquedas inteligentes sin depender de APIs externas de pago.

El sistema se expone a internet mediante un túnel Cloudflare (cloudflared) bajo los dominios `cloudstore.qallariy.lat` (frontend) y `cloudstore-api.qallariy.lat` (API).

---

## 2. Problema a resolver

Los marketplaces tradicionales como Mercado Libre, Amazon o Rappi ofrecen búsqueda por palabras clave exactas, pero carecen de **comprensión semántica** del lenguaje natural del usuario. Por ejemplo, buscar *"algo para organizar una BBQ este fin de semana"* no encuentra automáticamente carnes, carbón, bebidas y ensaladas, sino que devuelve resultados literales. Además, un usuario que tiene una foto de un producto pero desconoce su nombre no puede encontrarlo fácilmente.

### Problemas específicos que aborda CloudStore:

1. **Búsqueda semántica limitada** — Los motores de búsqueda basados en `LIKE` o texto exacto no entienden intención, sinónimos ni contexto.
2. **Ausencia de búsqueda visual** — Ninguna búsqueda por imagen disponible en marketplaces pequeños/medianos locales.
3. **Dependencia de plataformas cloud** — Los marketplaces típicos dependen de SaaS costosos (AWS, GCP) o plataformas cerradas con comisiones elevadas.
4. **Notificaciones post-venta limitadas** — Los compradores no reciben confirmaciones de pedido por canales masivos como WhatsApp.
5. **Escalabilidad y costos** — Las soluciones comerciales tienen costos difíciles de proyectar para proyectos académicos o pequeños negocios.

### Solución propuesta:

CloudStore resuelve estos problemas mediante una arquitectura **self-hosted** que integra:
- **Búsqueda semántica** con embeddings generados por el modelo `bge-m3` (Ollama) y almacenados en PostgreSQL con la extensión `pgvector` para búsqueda por similitud coseno.
- **Búsqueda visual** que utiliza `Gemma 4` (modelo de visión local) para describir imágenes, cuyo texto resultante se embediza y busca en pgvector.
- **Notificaciones WhatsApp** usando la API de Twilio para confirmar pedidos.
- **Arquitectura de microservicios** con Supabase self-hosted, permitiendo control total sobre costos, datos y escalabilidad.

---

## 3. Arquitectura propuesta

### 3.1 Vista general de componentes

```
                    ┌──────────────────────────────────────┐
                    │          Cloudflare Tunnel            │
                    │  (cloudstore.qallariy.lat / *.lat)    │
                    └──────────────┬───────────────────────┘
                                   │ HTTPS :443
                    ┌──────────────▼───────────────────────┐
                    │         Frontend Nginx :8080          │
                    │  SPA (React) + Reverse Proxy          │
                    │  ┌─────────────────────────────────┐  │
                    │  │ Rutas:                           │  │
                    │  │ / → index.html (SPA)            │  │
                    │  │ /rest/* → Kong:8000             │  │
                    │  │ /auth/* → Kong:8000              │  │
                    │  │ /functions/* → Kong:8000         │  │
                    │  │ /storage/* → Kong:8000           │  │
                    │  │ /model/* → 192.168.0.121:8000   │  │
                    │  └─────────────────────────────────┘  │
                    └──────────────┬───────────────────────┘
                                   │
                    ┌──────────────▼───────────────────────┐
                    │      Kong API Gateway :3333           │
                    │  Autenticación (key-auth) + Ruteo     │
                    └──┬───┬───┬───┬───┬───┬───┬───┬───┬──┘
                       │   │   │   │   │   │   │   │   │
          ┌────────────┘   │   │   │   │   │   │   │   └──────────┐
          │                │   │   │   │   │   │   │              │
   ┌──────▼──────┐  ┌─────▼───▼┐  │   │   │   │   │  ┌───────────▼──┐
   │  Auth       │  │ PostgREST │  │   │   │   │   │  │  Studio     │
   │  GoTrue     │  │ REST API  │  │   │   │   │   │  │  Dashboard  │
   │  :9999      │  │ :3000     │  │   │   │   │   │  │  :3000      │
   └──────┬──────┘  └─────┬─────┘  │   │   │   │   │  └──────┬──────┘
          │               │        │   │   │   │   │         │
          └───────────────┼────────┼───┼───┼───┼───┼─────────┘
                          │        │   │   │   │   │
                    ┌─────▼────────▼───▼───▼───▼───▼──────┐
                    │        PostgreSQL 17 :5432            │
                    │  ┌──────────────────────────────┐    │
                    │  │ Extensiones: pgvector, pg_net │    │
                    │  │ Tablas: profiles, products,   │    │
                    │  │   cart_items, orders,         │    │
                    │  │   order_items                 │    │
                    │  │ RLS: Row Level Security       │    │
                    │  │ Indices: HNSW (embeddings),   │    │
                    │  │   B-tree (FKs, timestamps)    │    │
                    │  └──────────────────────────────┘    │
                    └──────────────────────────────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    │                 │                  │
           ┌────────▼────────┐  ┌─────▼──────┐  ┌───────▼────────┐
           │  Supavisor      │  │  Storage   │  │ Edge Functions  │
           │  Pooler :6543   │  │  S3/Fs     │  │  Edge Runtime   │
           └─────────────────┘  └────────────┘  │  :9000          │
                                                 └───────┬────────┘
                         ┌────────────────────────────────┼────────────┐
                         │           ┌────────────────────┘            │
                  ┌──────▼──────┐   │                     ┌────────────▼──┐
                  │  Ollama      │   │                     │  Gemma 4     │
                  │  bge-m3      │   │                     │  Visión      │
                  │  :11434      │   │                     │  :8001       │
                  └─────────────┘   │                     └───────────────┘
                                    │
                  ┌─────────────────▼──────────────────┐
                  │  Edge Functions Workers             │
                  │  ┌───────────────────────────────┐  │
                  │  │ semantic-search (text→embed)  │  │
                  │  │ visual-search  (img→desc→emb) │  │
                  │  │ checkout (orden + pago)       │  │
                  │  │ promotions (descuentos)       │  │
                  │  │ notify (WhatsApp Twilio)      │  │
                  │  │ whatsapp (Chatbot Twilio)     │  │
                  │  │ vision-chat (chat con imagen) │  │
                  │  └───────────────────────────────┘  │
                  └─────────────────────────────────────┘
```

### 3.2 Diagrama de secuencia — Registro de usuario

```
Usuario            Frontend            Auth/GoTrue          PostgreSQL
  │                    │                    │                    │
  │   Registro         │                    │                    │
  │──────────────────►│                    │                    │
  │ email+pass+rol    │                    │                    │
  │                    │  POST /auth/v1/signup                  │
  │                    │──────────────────►│                    │
  │                    │                    │  INSERT auth.users │
  │                    │                    │──────────────────►│
  │                    │                    │◄──────────────────│
  │                    │◄──────────────────│                    │
  │ ◄─────────────────│                    │                    │
  │                    │                    │                    │
  │   Crear perfil     │                    │                    │
  │   (automático)     │  POST /rest/v1/profiles                │
  │                    │───────────────────────────────────────►│
  │                    │  INSERT profiles                       │
  │                    │◄───────────────────────────────────────│
  │ ◄─────────────────│                    │                    │
```

### 3.3 Diagrama de secuencia — Búsqueda semántica por texto

```
Usuario       SmartSearch        Edge Runtime      Ollama         PostgreSQL
  │               │                    │               │               │
  │ "Quiero una   │                    │               │               │
  │  BBQ"         │                    │               │               │
  │──────────────►│                    │               │               │
  │               │ POST /functions/v1/semantic-search                 │
  │               │───────────────────►│               │               │
  │               │                    │  GET /api/embeddings          │
  │               │                    │──────────────►│               │
  │               │                    │  bge-m3       │               │
  │               │                    │◄──────────────│               │
  │               │                    │ embedding[1024]               │
  │               │                    │                               │
  │               │                    │  RPC match_products           │
  │               │                    │──────────────────────────────►│
  │               │                    │  HNSW cosine search           │
  │               │                    │◄──────────────────────────────│
  │               │                    │ top 20 productos              │
  │               │◄───────────────────│                               │
  │               │ { products }       │                               │
  │  Grid         │                    │                               │
  │  ProductCard  │                    │                               │
  │◄──────────────│                    │                               │
```

### 3.4 Diagrama de secuencia — Búsqueda visual por imagen

```
Usuario       SmartSearch        Edge Runtime       Gemma 4        Ollama     PostgreSQL
  │               │                    │               │             │            │
  │  Sube imagen  │                    │               │             │            │
  │──────────────►│                    │               │             │            │
  │               │ POST /functions/v1/visual-search                              │
  │               │───────────────────►│               │             │            │
  │               │                    │ POST /model/chat/completions             │
  │               │                    │──────────────►│             │            │
  │               │                    │ image[base64] │             │            │
  │               │                    │◄──────────────│             │            │
  │               │                    │ descripción   │             │            │
  │               │                    │                               │            │
  │               │                    │ sanitize(desc)                │            │
  │               │                    │                               │            │
  │               │                    │  GET /api/embeddings          │            │
  │               │                    │──────────────────────────────►│            │
  │               │                    │  bge-m3                       │            │
  │               │                    │◄──────────────────────────────│            │
  │               │                    │  embedding[1024]              │            │
  │               │                    │                                           │
  │               │                    │  RPC match_products                       │
  │               │                    │──────────────────────────────────────────►│
  │               │                    │  HNSW cosine search                       │
  │               │                    │◄──────────────────────────────────────────│
  │               │                    │  top 20 productos            │            │
  │               │◄───────────────────│                             │            │
  │               │ { products, desc } │                             │            │
  │  Grid         │                    │                             │            │
  │  ProductCard  │                    │                             │            │
  │◄──────────────│                    │                             │            │
```

### 3.5 Diagrama de secuencia — Checkout

```
Usuario          Cart Page         Edge Runtime       PostgreSQL       Twilio
  │                 │                    │                │               │
  │  Finalizar      │                    │                │               │
  │  compra         │                    │                │               │
  │────────────────►│                    │                │               │
  │                 │ POST /functions/v1/checkout                          │
  │                 │───────────────────►│                │               │
  │                 │                    │ Verificar JWT  │               │
  │                 │                    │ Obtener userId │               │
  │                 │                    │                │               │
  │                 │                    │ SELECT products                │
  │                 │                    │───────────────►│               │
  │                 │                    │ Validar stock  │               │
  │                 │                    │◄───────────────│               │
  │                 │                    │                │               │
  │                 │                    │ BEGIN TX      │               │
  │                 │                    │ INSERT orders  │               │
  │                 │                    │───────────────►│               │
  │                 │                    │ INSERT order_items             │
  │                 │                    │───────────────►│               │
  │                 │                    │ UPDATE products stock          │
  │                 │                    │───────────────►│               │
  │                 │                    │ DELETE cart_items              │
  │                 │                    │───────────────►│               │
  │                 │                    │ COMMIT         │               │
  │                 │                    │◄───────────────│               │
  │                 │                    │                │               │
  │                 │◄───────────────────│                │               │
  │                 │ { success, order } │                │               │
  │  Confirmación   │                    │                │               │
  │◄────────────────│                    │                │               │
  │                 │                    │                │               │
  │  (Opcional)     │                    │                │               │
  │  WhatsApp       │ POST /functions/v1/notify                          │
  │────────────────►│───────────────────►│                               │
  │                 │                    │  POST /Messages                │
  │                 │                    │──────────────────────────────►│
  │                 │                    │◄──────────────────────────────│
  │                 │◄───────────────────│                               │
  │◄────────────────│                    │                               │
```

---

## 4. Diagrama Cloud

El siguiente diagrama presenta la arquitectura en un formato análogo a los diagramas de AWS, con capas de red, servicios y conectividad externa.

```
                              ┌──────────────────────────────┐
                              │        Internet              │
                              └──────────┬───────────────────┘
                                         │
                              ┌──────────▼───────────────────┐
                              │     Cloudflare DNS           │
                              │  cloudstore.qallariy.lat     │
                              │  cloudstore-api.qallariy.lat │
                              │  (CNAME → túnel cloudflared) │
                              └──────────┬───────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
          ┌─────────▼─────────┐  ┌───────▼────────┐  ┌───────▼──────────────┐
          │  cloudflared      │  │  cloudflared    │  │  Twilio API          │
          │  Tunnel Frontend  │  │  Tunnel API     │  │  whatsapp:+1415...   │
          │  → :8080           │  │  → :3333        │  │  (notificaciones)    │
          └─────────┬─────────┘  └───────┬────────┘  └──────────────────────┘
                    │                    │
                    └────────┬───────────┘
                             │
                    ┌────────▼────────────────────────────┐
                    │      Host Local (Servidor Físico)    │
                    │      192.168.0.121                   │
                    │      Docker Engine  + Ollama         │
                    │      ┌────────────────────────┐     │
                    │      │  Docker Compose Stack   │     │
                    │      │  (12 contenedores)      │     │
                    │      └────────────────────────┘     │
                    └─────────────────────────────────────┘
```

### Capas de la arquitectura

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE PRESENTACIÓN                                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Frontend Nginx :8080                                              │    │
│  │  ┌────────────────────────────────────┐  ┌─────────────────────┐  │    │
│  │  │ React SPA (Vite)                   │  │  Nginx Reverse Proxy│  │    │
│  │  │ ─ SmartSearch (texto + imagen)     │  │  /rest → Kong       │  │    │
│  │  │ ─ Home, Products, ProductDetail   │  │  /auth → Kong       │  │    │
│  │  │ ─ Cart, Orders, Promotions         │  │  /functions → Kong  │  │    │
│  │  │ ─ Login, Register                  │  │  /storage → Kong    │  │    │
│  │  │ ─ VisionChat                       │  │  /model → LLM direct│  │    │
│  │  │ ─ Navbar + Footer                  │  │                     │  │    │
│  │  └────────────────────────────────────┘  └─────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE API GATEWAY                                  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Kong API Gateway :3333                                           │    │
│  │  ─ Autenticación key-auth (ANON_KEY / SERVICE_KEY)               │    │
│  │  ─ Rate limiting, CORS, ACL (anon / admin)                       │    │
│  │  ─ Ruteo a servicios internos                                    │    │
│  │  ─ 17 rutas configuradas (auth, rest, functions, storage...)     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE SERVICIOS                                     │
│                                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │  Auth    │ │PostgREST │ │ Storage  │ │Realtime  │ │ Edge Functions │   │
│  │  GoTrue  │ │ REST API │ │ S3/Fs    │ │ WebSocket│ │ Edge Runtime   │   │
│  │  :9999   │ │ :3000    │ │ :5000    │ │ :4000    │ │ :9000           │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘   │
│       │            │            │            │               │            │
│       └────────────┼────────────┼────────────┼───────────────┘            │
│                    │            │            │                            │
│              ┌─────▼────────────▼────────────▼────┐                       │
│              │      PostgreSQL 17 :5432             │                       │
│              │  ┌──────────────────────────────┐   │                       │
│              │  │ Extensiones: pgvector, pg_net │   │                       │
│              │  │ Tablas: profiles, products,   │   │                       │
│              │  │   cart_items, orders,          │   │                       │
│              │  │   order_items                  │   │                       │
│              │  │ Seguridad: RLS (Row Level)     │   │                       │
│              │  │ Indices: HNSW (embeddings),    │   │                       │
│              │  │   B-tree (FKs, created_at)     │   │                       │
│              │  └──────────────────────────────┘   │                       │
│              └─────────────────────────────────────┘                       │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Conexión a Base de Datos                                          │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                    │    │
│  │  │ Supavisor  │  │ Direct DB  │  │ pg_net     │                    │    │
│  │  │ Pooler:6543│  │ :5432      │  │ HTTP ext   │                    │    │
│  │  └────────────┘  └────────────┘  └────────────┘                    │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE INTELIGENCIA ARTIFICIAL                      │
│                                                                             │
│  ┌────────────────────────────────┐ ┌─────────────────────────────────┐   │
│  │  Ollama (Host)                 │ │  Gemma 4 E2B CoreML (Host)      │   │
│  │  http://host.docker.internal   │ │  http://192.168.0.121:8001      │   │
│  │  :11434                        │ │                                 │   │
│  │  ┌─────────────────────────┐   │ │  ┌──────────────────────────┐   │   │
│  │  │ bge-m3 (567MB)          │   │ │  │ gemma-4-E2B-coreml       │   │   │
│  │  │ Embeddings multilingüe  │   │ │  │ Visión + Texto           │   │   │
│  │  │ 1024 dimensiones        │   │ │  │ Responde en español      │   │   │
│  │  └─────────────────────────┘   │ │  └──────────────────────────┘   │   │
│  └────────────────────────────────┘ └─────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        CAPA DE INTEGRACIONES EXTERNAS                       │
│                                                                             │
│  ┌────────────────────────────────┐ ┌─────────────────────────────────┐   │
│  │  Twilio API                    │ │  Cloudflare                     │   │
│  │  ─ Notificaciones WhatsApp     │ │  ─ DNS (CNAME)                  │   │
│  │  ─ Chatbot WhatsApp            │ │  ─ Túnel cloudflared            │   │
│  │  ─ Cuenta verificada           │ │  ─ Sin proxy (solo DNS)         │   │
│  └────────────────────────────────┘ └─────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Servicios utilizados

### 5.1 Frontend

| Servicio | Tecnología | Propósito | ¿Por qué? |
|---|---|---|---|
| **React 18** | `react`, `react-dom` | UI interactiva | Framework con ecosistema maduro, fácil integración con Supabase JS |
| **Vite 5** | `vite`, `@vitejs/plugin-react` | Build tool y dev server | Extremadamente rápido (HMR instantáneo), configuración minimalista |
| **React Router 6** | `react-router-dom` | Ruteo SPA | Estándar en React, permite navegación sin recarga |
| **Supabase JS** | `@supabase/supabase-js` | Cliente Supabase | SDK oficial, soporte Auth, REST, Realtime, Functions |
| **Nginx** | `nginx:1.27-alpine` | Servir SPA + proxy inverso | Liviano (~5MB), alto rendimiento, fácil configuración |

### 5.2 API Gateway

| Servicio | Versión | Propósito | ¿Por qué? |
|---|---|---|---|
| **Kong** | `kong/kong:3.9.1` | API Gateway | Open source, alto rendimiento, plugin de key-auth nativo, declarativo via YAML |

### 5.3 Backend (Supabase Stack)

| Servicio | Imagen | Propósito | ¿Por qué Supabase? |
|---|---|---|---|
| **Auth (GoTrue)** | `supabase/gotrue:v2.189.0` | Autenticación de usuarios (registro, login, JWT, sesiones) | Alternativa open-source a Auth0/Cognito; integración directa con PostgreSQL |
| **PostgREST** | `postgrest/postgrest:v14.12` | API REST autogenerada desde el esquema PostgreSQL | Zero-config: crea endpoints REST desde las tablas; soporta RLS nativamente |
| **PostgreSQL** | `supabase/postgres:17.6.1.136` | Base de datos principal + pgvector | pgvector permite búsqueda semántica directamente en SQL; RLS para seguridad a nivel fila |
| **Storage** | `supabase/storage-api:v1.60.4` | Almacenamiento de imágenes de productos | API S3-compatible, integración con Supabase JS, buckets públicos/privados |
| **Realtime** | `supabase/realtime:v2.102.3` | WebSocket para cambios en tiempo real | Permite suscripciones a cambios en DB (útil para notificaciones en vivo) |
| **Edge Functions** | `supabase/edge-runtime:v1.74.0` | Ejecución serverless de funciones Deno | Aísla lógica de negocio en workers independientes; JIT compilation, 150MB RAM c/u |
| **Supavisor** | `supabase/supavisor:2.9.5` | Pooler de conexiones a PostgreSQL | Evita saturación de conexiones a la DB, maneja miles de conexiones concurrentes |
| **Studio** | `supabase/studio:2026.06.03` | Panel de administración web | UI gráfica para gestionar DB, Auth, Storage, Functions (alternativa a Adminer/pgAdmin) |
| **imgproxy** | `darthsim/imgproxy:v3.30.1` | Transformación de imágenes (redimensionamiento, WebP automático) | Optimiza imágenes servidas por Storage sin modificar originales |

### 5.4 Inteligencia Artificial

| Servicio | Modelo | Propósito | ¿Por qué local? |
|---|---|---|---|
| **Ollama** | `bge-m3` (567MB) | Embeddings multilingües 1024d para búsqueda semántica | Modelo gratuito, corre 100% local, sin límites de API, soporta español nativamente |
| **Gemma 4** | `mlboydaisuke/gemma-4-E2B-coreml` | Descripción de imágenes para búsqueda visual | Modelo multimodal local, sin costos de API, respeta privacidad de imágenes subidas |

### 5.5 Infraestructura

| Componente | Propósito | ¿Por qué? |
|---|---|---|
| **Docker Compose** | Orquestación de 12 contenedores | Define toda la infraestructura como código; reproducible en cualquier servidor |
| **Cloudflare** | DNS (CNAME) + Túnel cloudflared | DNS gratuito, túnel evita exponer puertos directos, seguridad adicional |
| **Twilio** | Notificaciones WhatsApp + Chatbot | API madura para WhatsApp Business, costo por mensaje (~$0.005/msg) |

---

## 6. Seguridad

### 6.1 Estrategia de seguridad en múltiples capas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPA 1: RED — Aislamiento de red Docker                                │
│                                                                         │
│  ┌───────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
│  │ Red interna   │  │ extra_hosts solo  │  │ Servicios expuestos    │  │
│  │ Docker        │  │ para functions →  │  │ solo en puertos        │  │
│  │ (bridge)      │  │ host.docker.int.  │  │ necesarios (3333,8080) │  │
│  └───────────────┘  └───────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPA 2: API GATEWAY — Kong con key-auth                                │
│                                                                         │
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ ANON_KEY para     │  │ SERVICE_KEY para  │  │ ACL: grupos anon/    │  │
│  │ endpoints públicos│  │ endpoints admin   │  │ admin controlan      │  │
│  │ (products, auth)  │  │ (insert/delete)   │  │ acceso a rutas       │  │
│  └───────────────────┘  └──────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPA 3: AUTENTICACIÓN — JWT con verificación híbrida                   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Los JWT se verifican en dos niveles:                           │   │
│  │  1. Kong valida la clave (apikey) antes de enrutar              │   │
│  │  2. Edge Functions verifican el JWT con jose (HS256 o JWKS)     │   │
│  │  3. El token contiene: { role, iss, sub (user_id), exp, iat }  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPA 4: BASE DE DATOS — Row Level Security (RLS)                       │
│                                                                         │
│  ┌───────────────────┐  ┌────────────────────┐  ┌────────────────────┐  │
│  │ profiles: cada    │  │ products:          │  │ cart_items/orders: │  │
│  │ usuario solo ve/  │  │ vendedor edita los │  │ comprador solo ve  │  │
│  │ edita su perfil   │  │ suyos; todos leen  │  │ y edita los suyos  │  │
│  └───────────────────┘  └────────────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPA 5: EDGE FUNCTIONS — Workers aislados                              │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Cada función se ejecuta en su propio worker Deno con:           │   │
│  │  - Límite de memoria: 150MB                                      │   │
│  │  - Timeout: 180s                                                 │   │
│  │  - Sin acceso al sistema de archivos del host                    │   │
│  │  - Variables de entorno inyectadas por docker-compose            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Medidas de seguridad específicas

| Aspecto | Implementación |
|---|---|
| **Autenticación** | JWT HS256 con `JWT_SECRET` de 32 caracteres; verificación en Kong (key-auth) + Edge Functions (jose) |
| **Autorización** | RLS de PostgreSQL: políticas por fila basadas en `auth.uid()` |
| **Secreto compartido** | `JWT_SECRET` inyectado como variable de entorno a los contenedores necesarios |
| **Aislamiento de red** | Contenedores en red Docker bridge interna; solo Kong y Frontend exponen puertos |
| **Validación de entrada** | Edge Functions validan body JSON; esquemas tipados en Deno/TypeScript |
| **Protección contra CSRF** | La SPA se sirve desde el mismo origen que la API (Nginx proxy inverso) |
| **HTTPS** | Cloudflare tunnel provee HTTPS de extremo a extremo |
| **Rate limiting** | Kong puede configurar rate limiting por consumer (no implementado actualmente) |
| **Sanitización de prompts** | La descripción de Gemma 4 se sanitiza (markdown, HTML entities) antes de enviar a bge-m3 |
| **JWT no expirables** | Las claves ANON_KEY y SERVICE_KEY tienen expiración a ~10 años (uso en desarrollo); usuarios reales obtienen JWT con expiración configurable (`JWT_EXPIRY`) |

---

## 7. Escalabilidad

### 7.1 Estrategia de escalamiento

CloudStore está diseñado con patrones que facilitan el escalamiento horizontal y vertical:

#### 7.1.1 Frontend (Escalamiento horizontal)

```
          ┌──────────────┐
          │  Cloudflare  │
          │  Load Balancer │
          └──────┬───────┘
          ┌──────┼───────┐
          │      │       │
     ┌────▼──┐ ┌─▼───┐ ┌─▼───┐
     │ Nginx │ │Nginx│ │Nginx│ → Múltiples instancias
     │ :8080 │ │:8080│ │:8080│    detrás de balanceador
     └───────┘ └─────┘ └─────┘
          │      │       │
          └──────┼───────┘
                 │
          ┌──────▼───────┐
          │  Kong (cluster) │
          └────────────────┘
```

- El frontend es una SPA estática (HTML+JS+CSS), sirve desde Nginx
- Escalar horizontalmente: solo requiere más instancias de Nginx sirviendo los mismos archivos
- El build de Vite genera archivos con hash en el nombre (cache busting)

#### 7.1.2 API Gateway (Escalamiento horizontal)

- Kong soporta clustering nativo mediante base de datos compartida (PostgreSQL o Cassandra)
- Múltiples instancias de Kong pueden compartir la misma configuración declarativa (`kong.yml`)
- Cada instancia es stateless; toda la configuración se carga desde el archivo YAML

#### 7.1.3 Edge Functions (Escalamiento horizontal)

```
          ┌────────────────────────────┐
          │  Edge Runtime Supervisor   │
          └──┬───────┬───────┬────────┘
          ┌──┴──┐ ┌──┴──┐ ┌──┴──┐
          │ Wkr1 │ │ Wkr2 │ │ WkrN │ → Workers aislados
          │150MB │ │150MB │ │150MB │     por solicitud
          └──────┘ └──────┘ └──────┘
```

- Cada solicitud crea un worker aislado; el runtime maneja el pool
- El límite de memoria por worker (150MB) y timeout (180s) evitan saturaciones
- Escalamiento vertical: aumentar recursos de la máquina host
- Escalamiento horizontal: múltiples instancias del stack detrás de Kong

#### 7.1.4 Base de Datos (Escalamiento vertical y horizontal)

| Estrategia | Implementación | Estado |
|---|---|---|
| **Pool de conexiones** | Supavisor maneja hasta miles de conexiones concurrentes multiplexadas a PostgreSQL | ✅ Actual |
| **Índices** | HNSW (embeddings), B-tree (FKs, timestamps) | ✅ Actual |
| **Particionamiento** | `orders` y `order_items` pueden particionarse por fecha | 🔄 Futuro |
| **Réplicas de lectura** | PostgreSQL soporta streaming replication para read replicas | 🔄 Futuro |
| **Sharding** | pgvector puede distribuir índices HNSW entre shards | 🔄 Futuro avanzado |
| **Caché de consultas** | Redis/Memcached para consultas frecuentes (categorías, productos populares) | 🔄 Futuro |

#### 7.1.5 Búsqueda Vectorial (pgvector HNSW)

El índice HNSW (Hierarchical Navigable Small World) proporciona:
- **Complejidad O(log n)** para búsqueda del vecino más cercano
- **10x más rápido** que IVFFlat para ~400 productos actuales
- Escala a millones de vectores sin degradación significativa
- Parámetros configurables: `m = 16` (conectividad), `ef_construction = 200` (precisión)

#### 7.1.6 IA Local (Escalamiento vertical)

| Modelo | Escalamiento |
|---|---|
| **Ollama (bge-m3)** | GPU local (NVIDIA CUDA) acelera embeddings ~10x vs CPU. Múltiples GPUs permiten procesamiento paralelo. |
| **Gemma 4** | CoreML aprovecha Apple Silicon (MPS). Modelo ~4B parámetros, responde en 10-60s. Para alta concurrencia, múltiples instancias del servidor. |

### 7.2 Limitantes actuales

| Aspecto | Limitación | Mitigación |
|---|---|---|
| **GPU única** | Solo una GPU para Ollama + Gemma 4 | Las requests son secuenciales por sesión; cola de procesamiento |
| **Almacenamiento local** | Imágenes en disco local (volumen Docker) | Migrar a S3 compatible (MinIO, AWS S3) |
| **Sin cluster Kong** | Una instancia de Kong | Agregar clustering Kong + base de datos compartida |
| **Sin balanceador de carga** | Cloudflare solo DNS | Agregar Cloudflare Load Balancer o Nginx upstream |

---

## 8. Costos estimados

### 8.1 Costos fijos mensuales

| Componente | Detalle | Costo Mensual (USD) |
|---|---|---|
| **Servidor local** | PC con GPU (costo energético estimado) | ~$15-25 |
| **Electricidad** | Servidor 24/7 ~300W | ~$20-30 |
| **Internet** | Plan residencial (ya existente) | ~$0 (incluido) |
| **Dominio** | `qallariy.lat` (~$10/año) | ~$0.83 |
| **Cloudflare** | Plan gratuito (DNS + Tunnel) | $0 |
| **Twilio WhatsApp** | ~1000 mensajes/mes a $0.005/msg | ~$5 |
| **Total fijos** | | **~$40-60/mes** |

### 8.2 Costos de infraestructura (si fuera cloud)

| Servicio | Equivalente Cloud | Costo Estimado (USD/mes) |
|---|---|---|
| Frontend SPA | AWS S3 + CloudFront | ~$2-5 |
| API Gateway | AWS API Gateway / Kong Konnect | ~$20-30 |
| Auth | AWS Cognito / Auth0 | ~$0-50 (free tier) |
| PostgreSQL + pgvector | AWS RDS / Supabase Managed | ~$15-50 (db.t3.medium) |
| Storage (imágenes) | AWS S3 (~1GB) | ~$0.10 |
| Edge Functions | AWS Lambda / Supabase Edge Functions | ~$0-10 |
| GPU para IA | AWS EC2 g4dn.xlarge (NVIDIA T4) | ~$100-200 |
| Balanceador de carga | AWS ALB | ~$20 |
| **Total cloud** | | **~$160-365/mes** |

### 8.3 Costos de desarrollo (one-time)

| Componente | Detalle | Costo (USD) |
|---|---|---|
| **Modelo bge-m3** | Gratuito (Ollama, MIT License) | $0 |
| **Modelo Gemma 4** | Gratuito (Google, Gemma License) | $0 |
| **Supabase Stack** | Open source (Apache 2.0) | $0 |
| **Licencias software** | Todas open source | $0 |
| **Desarrollo (estimado)** | ~200 horas-hombre | ~$0 (proyecto académico) |
| **Total desarrollo** | | **$0** |

### 8.4 Comparativa: Self-hosted vs Cloud

| Aspecto | Self-hosted (actual) | Cloud (AWS) |
|---|---|---|
| **Costo mensual** | ~$40-60 | ~$160-365 |
| **Control de datos** | Total | Depende del proveedor |
| **Personalización** | Total | Limitada por el servicio |
| **Mantenimiento** | Manual (actualizaciones, backups) | Automático (parcial) |
| **Alta disponibilidad** | Limitada (un servidor) | Nativa (multi-AZ) |
| **Escalabilidad** | Vertical (cambiar hardware) | Horizontal (automática) |
| **GPU para IA** | Local (ya incluido en servidor) | Costo adicional (~$100-200/mes) |

---

## 9. Conclusiones

### 9.1 Logros alcanzados

1. **Marketplace funcional** — CloudStore implementa un ciclo completo de compra-venta: registro de usuarios (comprador/vendedor), publicación de productos con imagen, carrito de compras, checkout con validación de stock y actualización en tiempo real, y seguimiento de órdenes.

2. **Búsqueda semántica con IA** — La integración de Ollama + bge-m3 + pgvector permite búsquedas en lenguaje natural que entienden contexto, sinónimos e intención. Un usuario puede escribir *"algo para una BBQ"* y obtener carnes, carbón, bebidas y ensaladas, no solo productos con "BBQ" en el nombre.

3. **Búsqueda visual por imagen** — La integración de Gemma 4 (visión local) permite buscar productos simplemente subiendo una foto. El sistema describe la imagen automáticamente y encuentra productos similares en el catálogo.

4. **Arquitectura self-hosted** — Todo el stack Supabase (12 servicios) corre en Docker Compose local, demostrando que es posible tener una plataforma cloud-grade sin depender de SaaS costosos.

5. **Notificaciones WhatsApp** — Integración con Twilio para confirmar pedidos y chatbot automatizado que permite consultar productos y categorías desde WhatsApp.

6. **Seguridad por capas** — JWT + Kong key-auth + RLS de PostgreSQL + workers aislados proveen seguridad defensiva en profundidad.

### 9.2 Lecciones aprendidas

1. **pgvector + bge-m3** — La combinación de embeddings multilingües con búsqueda por similitud coseno en PostgreSQL es extremadamente efectiva para búsqueda semántica. El modelo bge-m3 maneja bien español (a diferencia de nomic-embed-text), pero ocasionalmente produce NaN con ciertos patrones de entrada.

2. **Modelos de visión local** — Gemma 4 E2B CoreML responde bien en español y reconoce productos correctamente, pero la latencia (10-60s por imagen) es significativamente mayor que los modelos cloud (GPT-4V, Claude Vision). Para un marketplace con decenas de usuarios concurrentes, se necesitaría GPU dedicada o balanceo entre múltiples instancias.

3. **Supabase self-hosted** — La pila de Supabase es completa pero requiere mantenimiento: actualizaciones de imágenes, gestión de backups, monitoreo de logs. El archivo `docker-compose.yml` con 12 servicios es complejo pero manejable con scripts auxiliares (`run.sh`, `reset.sh`).

4. **Cloudflare Tunnel** — La exposición del servicio mediante cloudflared es simple y segura (no requiere abrir puertos en el router), pero añade latencia (~20-50ms) y depende de la disponibilidad del servicio de Cloudflare.

### 9.3 Tendencias futuras

| Tendencia | Descripción | Impacto en CloudStore |
|---|---|---|
| **Modelos multimodales locales** | Modelos como Gemma 3/4, Llama 4, Qwen2.5-VL permiten visión + texto en un solo modelo local | Eliminaría la necesidad de dos modelos separados (Gemma 4 para visión + bge-m3 para embeddings) |
| **RAG (Retrieval Augmented Generation)** | Combinar búsqueda vectorial con generación de texto (LLM) para respuestas contextuales | Permitiría un asistente de compras que recomiende productos con explicaciones en lenguaje natural |
| **Embeddings más densos** | Modelos como `intfloat/e5-mistral-7b-instruct` (4096d) mejoran precisión semántica | Mayor dimensión = mayor precisión, pero también mayor costo computacional y de almacenamiento |
| **Edge AI + Federated Learning** | Ejecutar modelos de IA en el borde (edge) y entrenar con datos locales sin centralizar | Ideal para marketplaces multi-tienda donde cada vendedor entrena modelos con sus productos |
| **WebGPU + WebAssembly** | Ejecutar modelos de IA directamente en el navegador | Permitiría búsqueda visual sin enviar imágenes al servidor (privacidad total) |
| **PostgreSQL + pgvector 0.8+** | Nuevos tipos de índice (ScaNN, DiskANN) y streaming de vectores | Búsqueda semántica a escala de millones de productos en milisegundos |

---

*Documento generado para el proyecto final del curso de Cloud Computing — Universidad Católica San Pablo (UCSP), 2026.*
