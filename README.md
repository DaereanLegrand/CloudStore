# ☁️ CloudStore

Marketplace minimalista construido con Supabase self-hosted.

## Stack

- **Base de datos:** PostgreSQL (Supabase)
- **Auth:** GoTrue (Supabase Auth)
- **Storage:** Supabase Storage + imgproxy
- **Backend:** Edge Functions (Deno)
- **API Gateway:** Kong
- **Frontend:** HTML + CSS + JS vanilla

## Requisitos

- Docker y Docker Compose

## Inicio rápido

```bash
git clone <repo-url>
cd CloudStore

# Iniciar Supabase self-hosted
sh run.sh start

# Abrir Studio (Dashboard)
open http://localhost:3333
# Usuario: admin / Contraseña: admin123

# Aplicar migraciones de la app
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/cloudstore.sql

# O via el SQL Editor en Studio (http://localhost:3333)
```

## Estructura

```
CloudStore/
├── docker-compose.yml          # Stack oficial de Supabase
├── .env                        # Variables de entorno
├── run.sh                      # Script de gestión
├── reset.sh                    # Reset completo
├── volumes/
│   ├── api/
│   │   ├── kong.yml            # Configuración de Kong
│   │   └── kong-entrypoint.sh
│   ├── db/
│   │   ├── data/               # Datos persistentes de PostgreSQL
│   │   ├── realtime.sql
│   │   ├── webhooks.sql
│   │   ├── roles.sql
│   │   ├── jwt.sql
│   │   ├── _supabase.sql
│   │   ├── logs.sql
│   │   ├── pooler.sql
│   │   └── cloudstore.sql      # Migración de la app (tablas + RLS)
│   ├── storage/                # Archivos subidos
│   ├── pooler/pooler.exs
│   ├── functions/
│   │   ├── main/index.ts       # Router de funciones
│   │   └── checkout/index.ts   # Edge Function de checkout
│   └── snippets/
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/{config,auth,products,app}.js
│   └── pages/{login,register,products,new-product,cart,orders}.html
└── README.md
```

## Endpoints

| Servicio | URL |
|---|---|
| CloudStore App (Frontend) | `http://localhost:8080` |
| Studio (Dashboard) | `http://localhost:3333` |
| REST API | `http://localhost:8080/rest/v1/` |
| Auth | `http://localhost:8080/auth/v1/` |
| Storage | `http://localhost:8080/storage/v1/` |
| Edge Functions | `http://localhost:8080/functions/v1/` |
| Realtime | `ws://localhost:8080/realtime/v1/` |
| PostgreSQL (directo) | `localhost:5432` |

## Comandos útiles

```bash
sh run.sh start                 # Iniciar stack
sh run.sh stop                  # Detener stack
sh run.sh status                # Estado de servicios
sh run.sh logs                  # Ver logs
sh run.sh logs storage          # Logs de un servicio específico
sh run.sh recreate functions    # Recargar funciones después de cambios
sh run.sh secrets               # Ver credenciales
sh run.sh pull                  # Actualizar imágenes
```
