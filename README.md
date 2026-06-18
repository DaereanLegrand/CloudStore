# ☁️ CloudStore

Marketplace minimalista construido con Supabase self-hosted.

## Stack

- **Base de datos:** PostgreSQL (Supabase)
- **Auth:** GoTrue (Supabase Auth)
- **Storage:** Supabase Storage
- **Backend:** Edge Functions (Deno)
- **Frontend:** HTML + CSS + JS vanilla

## Requisitos

- Docker y Docker Compose

## Inicio rápido

```bash
# Clonar
git clone <repo-url>
cd CloudStore

# Iniciar Supabase self-hosted
docker compose up -d

# Aplicar migraciones
docker compose exec db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/001_schema.sql

# Abrir Studio
open http://localhost:3333
```

## Estructura

```
CloudStore/
├── docker-compose.yml          # Stack Supabase self-hosted
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 001_schema.sql      # Tablas + RLS
│   └── functions/
│       └── checkout/
│           └── index.ts         # Edge Function de checkout
├── public/
│   ├── index.html
│   ├── css/style.css
│   ├── js/{config,auth,products,app}.js
│   └── pages/{login,register,products,new-product,cart,orders}.html
└── .env
```

## Endpoints

| Servicio | Puerto |
|---|---|
| Studio (UI) | 3333 |
| REST API (PostgREST) | 3001 |
| Auth (GoTrue) | 9999 |
| Storage | 5000 |
| Edge Functions | 9000 |
| PostgreSQL | 5432 |
