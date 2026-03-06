# KodevonCRM — Contexto Completo del Proyecto

> Documento generado el 2026-03-06. Contiene todo el contexto, decisiones, arquitectura y código producido hasta la Fase 2 inclusive.

---

## Índice

1. [Descripción del Negocio](#1-descripción-del-negocio)
2. [Qué es este proyecto](#2-qué-es-este-proyecto)
3. [Decisiones de producto (Q&A completo)](#3-decisiones-de-producto-qa-completo)
4. [Stack tecnológico](#4-stack-tecnológico)
5. [Arquitectura técnica](#5-arquitectura-técnica)
6. [Esquema de base de datos](#6-esquema-de-base-de-datos)
7. [Variables de entorno](#7-variables-de-entorno)
8. [Estructura de archivos](#8-estructura-de-archivos)
9. [Fase 1 — Infraestructura](#9-fase-1--infraestructura)
10. [Fase 2 — Backend Core](#10-fase-2--backend-core)
11. [API Reference](#11-api-reference)
12. [Guía para levantar el proyecto en local](#12-guía-para-levantar-el-proyecto-en-local)
13. [Guía de despliegue en producción (EasyPanel)](#13-guía-de-despliegue-en-producción-easypanel)
14. [Credenciales externas pendientes](#14-credenciales-externas-pendientes)
15. [Roadmap de fases](#15-roadmap-de-fases)
16. [Decisiones técnicas y su razonamiento](#16-decisiones-técnicas-y-su-razonamiento)
17. [Reglas de negocio importantes](#17-reglas-de-negocio-importantes)

---

## 1. Descripción del Negocio

**Empresa:** Kodevon
**Servicios:** Desarrollo de software, agentes de IA, automatizaciones y todo lo relacionado con tecnología.
**Dominio principal:** kodevon.com
**Dominio del CRM:** crm.kodevon.com
**Ciclo de venta estimado:** 2–6 semanas (contacto inicial → cierre)

---

## 2. Qué es este proyecto

KodevonCRM es un CRM personalizado construido **100% con herramientas open source y gratuitas**, que:

- Usa **EspoCRM** (ya instalado en el VPS) como backend de datos mediante su API oficial. El nuevo CRM es la **interfaz principal** — EspoCRM queda solo como motor de datos interno, sin URL pública.
- Centraliza todos los canales de comunicación en una **bandeja unificada**.
- Califica leads automáticamente con **IA local (Ollama)**.
- Está alojado en un **VPS propio** administrado con **EasyPanel**, bajo el subdominio `crm.kodevon.com`.

### Canales integrados (todos bidireccionales — recibir y responder)
| Canal | Tecnología |
|-------|-----------|
| WhatsApp | Meta Cloud API (coexiste con la app del celular) |
| Instagram DMs | Instagram Graph API |
| Facebook Messenger | Messenger API |
| Email | Gmail API (OAuth2 — IMAP + SMTP) |
| Formulario web | Endpoint POST en el backend |
| API HTTP pública | Endpoint con API key |

---

## 3. Decisiones de producto (Q&A completo)

### Infraestructura
- **EspoCRM:** versión 9.2.5-apache, tiene API key configurada, base de datos vacía, el nuevo CRM es la UI principal.
- **EspoCRM URL:** solo red interna Docker, sin URL pública expuesta.
- **VPS:** 8GB RAM, Docker instalado, EasyPanel como gestor.
- **Dominio:** `crm.kodevon.com` — redirigido al nuevo CRM (EspoCRM deja de tener URL pública).
- **SSL/Proxy:** Traefik gestionado automáticamente por EasyPanel.

### WhatsApp
- Tiene app de WhatsApp Business en el celular.
- Usará el método de **Meta Cloud API** que permite coexistencia con la app del celular.
- Necesita recibir **y** enviar mensajes.

### Instagram / Facebook
- Tiene cuenta y página de Facebook creadas pero las **Meta Apps no están configuradas aún**.
- Necesita recibir **y** responder desde el CRM.

### Email
- Proveedor: **Gmail** (por ahora).
- Necesita bandeja de entrada (leer) + envío.
- Usado para comunicación con leads **y** para notificaciones internas.

### Formulario web
- Existe en una web externa, se configurará después.
- Se hará como **endpoint POST** embebible.

### API HTTP pública
- Solo la usa el propio equipo.
- Autenticación por **API key** (`kv_...`).
- Campos mínimos del lead: nombre, email, teléfono, empresa, canal fuente, notas, metadata.

### IA (Ollama)
- Modelo: **Llama 3.2 3B** (~2GB RAM) — elegido por estabilidad sobre calidad dado el VPS de 8GB.
- Scoring **1–10** por cada mensaje nuevo (tiempo real).
- Labels: **cold** (1–3), **warm** (4–7), **hot** (8–10).
- **Score ≥ 8:** notificación automática al agente + resumen de IA generado.
- Factores de calificación: keywords de alta intención, cantidad de interacciones, velocidad de respuesta, preguntas del lead.

### Keywords de alta intención definidas
```
empecemos, quiero empezar, cuánto cuesta, cuanto cuesta, quiero contratar,
presupuesto, cotización, cotizacion, cuándo pueden empezar, cuando pueden empezar,
lo necesito para, tenemos urgencia, firma, contrato, necesito una propuesta,
cuál es el precio, cual es el precio, disponibilidad, cuando empezamos,
quiero el servicio, me interesa contratar, qué necesitan de mi parte,
que necesitan de mi parte
```

### Pipeline de ventas
| Etapa | Descripción |
|-------|-------------|
| NUEVO | Lead recién llegado, sin interacción |
| CONTACTADO | Se envió primera respuesta |
| CALIFICADO | Score ≥ 5, interés real mostrado |
| PROPUESTA | Cotización enviada |
| NEGOCIACION | Discusión activa de términos |
| CERRADO_GANADO | Venta cerrada |
| CERRADO_PERDIDO | Venta perdida |

### Bandeja de mensajes
- Vista **unificada** (todos los canales juntos) **Y** vista por canal — ambas disponibles.
- El agente puede **responder** desde la bandeja cuando está activada.

### Usuarios y roles
- Escalable hasta **100 usuarios**.
- Roles: **ADMIN**, **AGENT**, **AI_AGENT** (rol interno del sistema).
- Actualmente solo 2 usuarios + el agente de IA.
- Auth: **JWT propio + bcrypt** (sin dependencias externas, mínimo recurso).

### Notificaciones
- Push en navegador (Web Push API).
- Email al correo de la cuenta.
- Sonido en la app.

### Deduplicación de leads
- Match por **teléfono OR email**.
- Al detectar duplicado: notificar al agente con ambos leads.
- Opciones: fusión automática (une conversaciones, conserva score más alto) o fusión manual.

---

## 4. Stack tecnológico

| Capa | Herramienta | Versión | Justificación |
|------|-------------|---------|---------------|
| Frontend | Next.js | 14.2.18 | SSR, App Router, ecosistema robusto |
| Backend/API | Fastify | 4.29.0 | Más rápido que Express, ideal para APIs |
| ORM | Prisma | 5.22.0 | Type-safe, migraciones automáticas |
| Base de datos | PostgreSQL | 16 | Robusta, self-hosted, gratuita |
| Cola de trabajos | BullMQ | 5.28.0 | Redis-based, retry automático |
| Cache/Cola | Redis | 7 | Base de BullMQ, max 512MB en prod |
| Tiempo real | Socket.io | (Fase 7) | Notificaciones en tiempo real |
| IA scoring | Ollama + Llama 3.2 3B | latest | Self-hosted, ~2GB RAM |
| Auth | JWT + bcrypt | — | Sin dependencias externas |
| Proxy/SSL | Traefik (EasyPanel) | — | SSL automático via Let's Encrypt |
| Monorepo | pnpm workspaces | 9.14.2 | Más eficiente en disco que npm/yarn |
| Build | tsup | 8.3.5 | Bundler rápido para TypeScript |
| Dev server | tsx | 4.19.2 | Ejecuta TypeScript directamente |

**Todo 100% open source y gratuito.**

---

## 5. Arquitectura técnica

### Servicios Docker (producción)

```
crm-frontend    Next.js 14          puerto 3000  → traefik
crm-backend     Fastify Node.js     puerto 3001  → traefik
crm-worker      BullMQ worker       sin puerto
crm-db          PostgreSQL 16       puerto 5432  (solo red interna)
crm-redis       Redis 7             puerto 6379  (solo red interna)
crm-ollama      Ollama              puerto 11434 (solo red interna)
espocrm         EspoCRM existente   sin URL pública
traefik         EasyPanel           80/443
```

### Redes Docker
- `easypanel` (externa): conecta frontend y backend con Traefik para el dominio público.
- `internal` (bridge): comunicación entre todos los servicios sin exposición exterior.

### Rutas en producción
```
https://crm.kodevon.com/           → frontend (Next.js)
https://crm.kodevon.com/api/*      → backend (Fastify)
https://crm.kodevon.com/webhooks/* → backend (receptores de webhooks)
```

### Flujo de un mensaje entrante
```
Canal externo (WA/IG/FB/Email)
        ↓
Webhook → Backend (POST /webhooks/:canal)
        ↓
BullMQ: inbound-message job
        ↓
Worker procesa:
  1. Busca/crea lead y conversación en DB
  2. Guarda mensaje
  3. Encola ai-score job
  4. Encola dedup-check job
  5. Encola espocrm-sync job
  6. Encola notify job
        ↓
Ollama calcula score (1-10)
        ↓
Si score ≥ 8:
  → Encola ai-summary job
  → Encola notificación HOT_LEAD
        ↓
Frontend recibe actualización via Socket.io
```

### Flujo de autenticación
```
Login → accessToken (15min, en body) + refreshToken (7 días, httpOnly cookie)
Request autenticada → Authorization: Bearer <accessToken>
Token expirado → POST /api/auth/refresh → nuevo accessToken (rota el refreshToken)
Logout → invalida refreshToken en DB + limpia cookie
```

### Límites de RAM (VPS 8GB)
| Servicio | RAM asignada/estimada |
|----------|----------------------|
| EspoCRM | ~512MB |
| PostgreSQL | ~256MB |
| Redis | 512MB (límite configurado) |
| Ollama + modelo | ~2.5GB (límite 3GB) |
| Backend Fastify | ~128MB |
| Frontend Next.js | ~256MB |
| Worker BullMQ | ~64MB |
| Sistema operativo | ~512MB |
| **Total** | **~4.8GB (margen de ~3.2GB)** |

---

## 6. Esquema de base de datos

Ubicación del schema: `packages/db/prisma/schema.prisma`

### Modelos

#### `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | String | Nombre completo |
| email | String unique | Email de login |
| password_hash | String | bcrypt hash |
| role | Enum | ADMIN \| AGENT \| AI_AGENT |
| is_active | Boolean | Para desactivar sin borrar |
| avatar_url | String? | URL de foto de perfil |
| created_at / updated_at | DateTime | Timestamps |

#### `leads`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | String | Nombre del lead |
| email | String? | Email (para deduplicación) |
| phone | String? | Teléfono (para deduplicación) |
| company | String? | Empresa |
| source_channel | Enum | Canal de entrada |
| stage | Enum | Etapa del pipeline |
| score | Int (0-10) | Score de calificación actual |
| score_label | Enum | COLD \| WARM \| HOT |
| espocrm_id | String? | ID en EspoCRM para sincronización |
| assigned_to_id | UUID? | FK → users |
| notes | String? | Notas libres |
| metadata | Json? | Datos adicionales del canal |
| is_duplicate | Boolean | Marcado como duplicado fusionado |
| merged_into_id | UUID? | FK → leads (auto-referencial) |

#### `conversations`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| lead_id | UUID | FK → leads |
| channel | Enum | Canal de esta conversación |
| external_id | String? | ID externo del chat en el canal |
| status | Enum | OPEN \| CLOSED \| PENDING |

#### `messages`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| direction | Enum | INBOUND \| OUTBOUND |
| content | String | Texto del mensaje |
| content_type | String | text, image, audio, document |
| metadata | Json? | Datos originales del canal |
| external_id | String? | ID del mensaje en el canal |
| sent_at | DateTime | Timestamp real del mensaje |

#### `ai_scores`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| lead_id | UUID | FK → leads |
| score | Int | Score 1-10 |
| label | Enum | COLD \| WARM \| HOT |
| summary | String? | Resumen generado por IA |
| factors | Json? | Factores considerados |
| trigger_msg | String? | Mensaje que disparó el recálculo |

#### `api_keys`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| key_hash | String unique | SHA-256 del token |
| name | String | Nombre descriptivo |
| last_used | DateTime? | Última vez usada |

#### `notifications`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| lead_id | UUID? | FK → leads |
| type | Enum | NEW_LEAD \| HOT_LEAD \| NEW_MESSAGE \| DUPLICATE_DETECTED \| MERGE_SUGGESTION |
| payload | Json | Datos de la notificación |
| read | Boolean | Estado de lectura |

#### `channel_configs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| channel | Enum unique | Un registro por canal |
| credentials | Json | Credenciales cifradas del canal |
| active | Boolean | Canal habilitado/deshabilitado |

#### `refresh_tokens`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| token_hash | String unique | SHA-256 del token |
| expires_at | DateTime | Expiración (7 días) |

---

## 7. Variables de entorno

Archivo de referencia: `.env.example`

```env
# Servidor
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info

# Auth — generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=                    # min 64 chars
COOKIE_SECRET=                 # min 64 chars, diferente al anterior

# Base de datos
POSTGRES_PASSWORD=             # contraseña fuerte
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/kodevoncrm

# Redis
REDIS_URL=redis://localhost:6379

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# EspoCRM (red interna Docker en producción)
ESPOCRM_URL=http://espocrm:80
ESPOCRM_API_KEY=

# Cifrado de credenciales de canales
ENCRYPTION_KEY=                # 64 hex chars

# Producción (EasyPanel)
DOMAIN=crm.kodevon.com

# WhatsApp Cloud API (Fase 4)
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_WABA_ID=
WA_WEBHOOK_VERIFY_TOKEN=

# Meta — Instagram + Facebook (Fase 4)
META_APP_ID=
META_APP_SECRET=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_IG_ACCOUNT_ID=

# Gmail OAuth2 (Fase 4)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_EMAIL=
```

---

## 8. Estructura de archivos

```
CRM-interno/
├── .env.example
├── .gitattributes
├── .gitignore
├── package.json                    ← raíz del monorepo (pnpm workspaces)
├── pnpm-workspace.yaml
│
├── apps/
│   ├── backend/                    ← API Fastify (Node.js)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts            ← entrada principal, registro de plugins y rutas
│   │       ├── lib/
│   │       │   ├── prisma.ts       ← re-export del cliente Prisma
│   │       │   ├── queues.ts       ← instancias de todas las colas BullMQ
│   │       │   ├── redis.ts        ← conexión Redis (general + bullmq)
│   │       │   └── utils.ts        ← scoreToLabel, paginate, paginatedResponse
│   │       ├── middleware/
│   │       │   └── authenticate.ts ← authenticate(), authorize(), authenticateApiKey()
│   │       ├── routes/
│   │       │   ├── auth.ts         ← login, logout, refresh, me
│   │       │   ├── users.ts        ← CRUD usuarios
│   │       │   ├── leads.ts        ← CRUD leads + assign + merge
│   │       │   └── api-keys.ts     ← gestión de API keys
│   │       ├── schemas/
│   │       │   ├── auth.schema.ts
│   │       │   ├── user.schema.ts
│   │       │   └── lead.schema.ts
│   │       ├── scripts/
│   │       │   └── seed.ts         ← crea primer usuario ADMIN
│   │       └── types/
│   │           └── fastify.d.ts    ← augmentación de tipos JWT
│   │
│   ├── frontend/                   ← UI Next.js 14
│   │   ├── Dockerfile
│   │   ├── next.config.js          ← output: standalone (Docker)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts      ← tema oscuro personalizado Kodevon
│   │   ├── postcss.config.js
│   │   └── app/
│   │       ├── globals.css         ← Tailwind + clases utilitarias (.card, .btn-primary, etc.)
│   │       ├── layout.tsx          ← RootLayout HTML
│   │       └── page.tsx            ← placeholder Fase 1 (UI completa en Fase 7)
│   │
│   └── worker/                     ← Procesador de colas BullMQ
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── src/
│           └── index.ts            ← workers placeholder (handlers reales en Fase 5)
│
├── packages/
│   ├── db/                         ← Prisma ORM
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma       ← esquema completo de la DB
│   │   └── src/
│   │       └── index.ts            ← export del PrismaClient singleton
│   │
│   └── shared/                     ← Tipos y constantes compartidos
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts            ← tipos, constantes, queue names, keywords IA
│
├── docker/
│   ├── docker-compose.dev.yml      ← solo DB + Redis + Ollama (dev local)
│   ├── docker-compose.prod.yml     ← stack completo para EasyPanel
│   └── init-ollama.sh              ← script para descargar llama3.2:3b
│
└── docs/
    └── CONTEXTO-COMPLETO.md        ← este archivo
```

---

## 9. Fase 1 — Infraestructura

**Estado:** ✅ Completa

### Qué se construyó
- Monorepo con `pnpm workspaces` (apps: backend, frontend, worker / packages: db, shared).
- `docker-compose.dev.yml`: PostgreSQL 16 + Redis 7 + Ollama con volúmenes persistentes y healthchecks.
- `docker-compose.prod.yml`: stack completo con Traefik labels para EasyPanel, límite de 3GB RAM para Ollama, redes separadas (easypanel pública + internal privada).
- Prisma schema completo con todos los modelos, enums e índices.
- `packages/shared`: tipos TypeScript, constantes (SCORE_THRESHOLDS, HOT_LEAD_THRESHOLD=8, HIGH_INTENT_KEYWORDS, QUEUE_NAMES, tipos de payloads de jobs).
- Backend Fastify arranca con health check en `/api/health`.
- Frontend Next.js con tema oscuro (surface/brand/channel/score colors), output standalone para Docker.
- Worker BullMQ con 4 workers placeholder y graceful shutdown.
- Dockerfiles multi-stage para cada servicio.

### Colores del tema (Tailwind)
```
surface.DEFAULT:  #0F1117  (fondo principal)
surface.raised:   #161B27  (cards)
surface.overlay:  #1E2536  (modales, inputs)
surface.border:   #2A3347  (bordes)
brand.DEFAULT:    #3B82F6  (azul primario)
channel.whatsapp: #25D366
channel.instagram:#E1306C
channel.facebook: #1877F2
channel.email:    #6366F1
channel.form:     #F59E0B
channel.api:      #64748B
score.cold:       #64748B
score.warm:       #F59E0B
score.hot:        #EF4444
```

---

## 10. Fase 2 — Backend Core

**Estado:** ✅ Completa

### Qué se construyó

#### Autenticación (`/api/auth`)
- Login con email/password → devuelve `accessToken` (JWT 15min) en body + `refresh_token` (httpOnly cookie, 7 días).
- Refresh token con **rotación automática** — cada uso invalida el anterior y emite uno nuevo.
- Logout invalida el refresh token en DB.
- `GET /api/auth/me` devuelve perfil del usuario autenticado.
- **Protección bruta-fuerza:** rate limiter diferenciado para `/auth/login`.

#### Usuarios (`/api/users`)
- CRUD completo con roles: solo ADMIN puede crear/listar/eliminar.
- Agentes solo pueden ver y editar su propio perfil.
- Solo ADMIN puede cambiar `role` o `isActive`.
- Validación de email duplicado en creación y actualización.
- Contraseñas hasheadas con **bcrypt (factor 12)**.

#### Leads (`/api/leads`)
- Listado con paginación completa + filtros: stage, channel, scoreLabel, assignedToId, search (nombre/email/teléfono/empresa).
- Creación: encola automáticamente `dedup-check` y `espocrm-sync` en background.
- Actualización: recalcula `scoreLabel` si el score cambia. Si score cruza umbral HOT (≥8) por primera vez, encola `ai-summary` y notificación `HOT_LEAD`.
- `POST /api/leads/:id/assign`: asigna agente (solo ADMIN).
- `POST /api/leads/:id/merge`: fusión automática o manual de duplicados.
- Agentes solo ven leads asignados a ellos.

#### API Keys (`/api/api-keys`)
- Generación: formato `kv_<96 hex chars>` — se muestra **solo una vez** al crearse.
- Almacenamiento: solo el SHA-256 hash en DB.
- Límite: máximo 10 keys por usuario.
- `authenticateApiKey` middleware: acepta tanto JWT como API key con el mismo header `Authorization: Bearer`.

#### Middlewares
- `authenticate`: verifica JWT.
- `authorize(...roles)`: verifica JWT + rol requerido.
- `authenticateApiKey`: acepta JWT o API key indistintamente.

#### Utilidades
- `scoreToLabel(score)`: convierte número a COLD/WARM/HOT.
- `paginate(page, limit)`: devuelve skip/take para Prisma.
- `paginatedResponse(items, total, page, limit)`: formato estándar de respuesta paginada.

#### Seed
- Script `src/scripts/seed.ts`: crea el primer admin si no existe.
- Credenciales iniciales: `admin@kodevon.com` / `KodevonCRM@2024!`
- **Cambiar la contraseña inmediatamente después del primer login.**

---

## 11. API Reference

### Auth

| Método | Endpoint | Auth | Body | Descripción |
|--------|----------|------|------|-------------|
| POST | `/api/auth/login` | — | `{email, password}` | Login |
| POST | `/api/auth/refresh` | cookie | — | Rota refresh token |
| POST | `/api/auth/logout` | JWT | — | Cierra sesión |
| GET | `/api/auth/me` | JWT | — | Perfil actual |

### Usuarios

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/users` | ADMIN | Listar todos los usuarios |
| POST | `/api/users` | ADMIN | Crear usuario |
| GET | `/api/users/:id` | JWT | Ver usuario (agente solo el propio) |
| PUT | `/api/users/:id` | JWT | Editar usuario |
| DELETE | `/api/users/:id` | ADMIN | Eliminar usuario |

### Leads

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/leads` | JWT | Listar con filtros y paginación |
| POST | `/api/leads` | JWT | Crear lead |
| GET | `/api/leads/:id` | JWT | Lead completo con conversaciones y scores |
| PUT | `/api/leads/:id` | JWT | Actualizar lead |
| DELETE | `/api/leads/:id` | ADMIN | Eliminar lead |
| POST | `/api/leads/:id/assign` | ADMIN | Asignar agente |
| POST | `/api/leads/:id/merge` | ADMIN | Fusionar duplicado (`{duplicateId, auto: bool}`) |

#### Parámetros de listado de leads (`GET /api/leads`)
```
?page=1&limit=20           paginación
&search=texto              busca en nombre, email, teléfono, empresa
&stage=NUEVO               filtra por etapa
&channel=WHATSAPP          filtra por canal
&scoreLabel=HOT            filtra por label de score
&assignedToId=<uuid>       filtra por agente asignado
```

### API Keys

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/api-keys` | JWT | Listar mis API keys (sin la clave raw) |
| POST | `/api/api-keys` | JWT | Crear nueva key (retorna raw key UNA sola vez) |
| DELETE | `/api/api-keys/:id` | JWT | Revocar key |

### Health

```
GET /api/health → { status, version, environment, timestamp }
```

---

## 12. Guía para levantar el proyecto en local

### Requisitos
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker Desktop corriendo

### Pasos

```bash
# 1. Entrar al proyecto
cd 'C:/Users/MACC PC/Documents/GitHub/CRM-interno'

# 2. Instalar dependencias
pnpm install

# 3. Crear .env
cp .env.example .env
# Editar .env y completar JWT_SECRET, COOKIE_SECRET, ENCRYPTION_KEY
# Para generar cada uno:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 4. Levantar infraestructura (DB + Redis + Ollama)
docker compose -f docker/docker-compose.dev.yml up -d

# 5. Crear tablas en la base de datos
pnpm db:migrate
# Nombre sugerido para la migración: "init"

# 6. Generar cliente Prisma
pnpm db:generate

# 7. Crear primer usuario admin
npx tsx apps/backend/src/scripts/seed.ts
# → admin@kodevon.com / KodevonCRM@2024!

# 8. Descargar modelo de IA (~2GB, solo la primera vez)
docker exec kodevon-ollama ollama pull llama3.2:3b

# 9. Levantar servicios (3 terminales)
pnpm dev:backend    # http://localhost:3001/api/health
pnpm dev:frontend   # http://localhost:3000
pnpm dev:worker     # procesa jobs en background
```

### Verificación rápida

```bash
# Health check
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kodevon.com","password":"KodevonCRM@2024!"}'
```

### Scripts del monorepo

| Comando | Acción |
|---------|--------|
| `pnpm dev:backend` | Backend en modo watch |
| `pnpm dev:frontend` | Frontend Next.js en modo dev |
| `pnpm dev:worker` | Worker en modo watch |
| `pnpm db:migrate` | Nueva migración Prisma |
| `pnpm db:generate` | Regenerar cliente Prisma |
| `pnpm db:push` | Push schema sin migración (dev rápido) |
| `pnpm db:studio` | Abrir Prisma Studio (GUI de la DB) |
| `pnpm build` | Build de producción de todos los servicios |

---

## 13. Guía de despliegue en producción (EasyPanel)

### Prerrequisitos
1. Repositorio subido a GitHub.
2. EasyPanel instalado en el VPS con Docker.
3. DNS de `crm.kodevon.com` apuntando al VPS.
4. `.env` de producción listo con todos los secrets.

### Pasos

```bash
# En el VPS, clonar el repo
git clone https://github.com/<tu-org>/CRM-interno.git
cd CRM-interno

# Copiar y editar .env de producción
cp .env.example .env
# Editar con valores reales de producción

# Crear app en EasyPanel → tipo "Docker Compose"
# Pegar el contenido de docker/docker-compose.prod.yml
# O ejecutar directamente:
docker compose -f docker/docker-compose.prod.yml up -d --build

# Correr migraciones
docker exec <backend_container> npx prisma migrate deploy

# Crear admin
docker exec <backend_container> node dist/scripts/seed.js

# Descargar modelo Ollama (~2GB)
docker exec <ollama_container> ollama pull llama3.2:3b
```

### Red Traefik en EasyPanel
- EasyPanel usa la red externa `easypanel` para Traefik.
- Los labels del `docker-compose.prod.yml` ya están configurados para `crm.kodevon.com`.
- SSL se gestiona automáticamente via Let's Encrypt.

---

## 14. Credenciales externas pendientes

### Meta (WhatsApp + Instagram + Facebook) — TODO

Para usar los 3 canales se necesita **una sola Meta App** de tipo Business.

**Pasos:**
1. Crear cuenta en [developers.facebook.com](https://developers.facebook.com)
2. Crear Meta App → tipo Business
3. Agregar producto **WhatsApp** → conectar número de WhatsApp Business
4. Agregar producto **Messenger** → conectar página de Facebook
5. Agregar producto **Instagram Graph API** → conectar cuenta IG
6. Generar Access Token permanente

**Datos que necesitarás:**
- `WA_PHONE_NUMBER_ID`
- `WA_ACCESS_TOKEN` (token permanente, no temporal)
- `WA_WABA_ID`
- `WA_WEBHOOK_VERIFY_TOKEN` (string inventado por ti)
- `META_APP_ID`
- `META_APP_SECRET`
- `META_PAGE_ID`
- `META_PAGE_ACCESS_TOKEN`
- `META_IG_ACCOUNT_ID`

**Nota:** La URL del webhook para configurar en Meta será:
```
https://crm.kodevon.com/webhooks/meta
```

### Gmail — PARCIALMENTE LISTO

Las credenciales OAuth2 ya fueron descargadas como JSON (tipo Web Application).

**Pendiente:** Ejecutar el flujo OAuth una vez en producción para obtener el `refresh_token`:
- URL de callback configurada: `https://crm.kodevon.com/api/auth/gmail/callback`
- Se hace una sola vez en Fase 4, desde el panel de admin del CRM.

**Datos del JSON descargado:**
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN` (se obtiene en Fase 4)
- `GMAIL_EMAIL`

### EspoCRM — PENDIENTE CONFIRMAR

- `ESPOCRM_URL`: URL interna del contenedor (ej: `http://espocrm:80` o el nombre del contenedor en Docker)
- `ESPOCRM_API_KEY`: generada en EspoCRM → Admin → API Keys

---

## 15. Roadmap de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Infraestructura Docker, monorepo, Prisma schema, skeleton de apps | ✅ Completa |
| 2 | Backend core: Auth, CRUD usuarios, CRUD leads, API keys | ✅ Completa |
| 3 | Bridge EspoCRM: capa de sincronización con su API | 🔜 Siguiente |
| 4 | Canales: webhooks + senders (WhatsApp → IG/FB → Email) | ⏳ Pendiente |
| 5 | Worker: handlers reales de BullMQ (procesamiento de mensajes) | ⏳ Pendiente |
| 6 | IA: integración Ollama, scoring en tiempo real, summaries | ⏳ Pendiente |
| 7 | Frontend: UI completa (auth, inbox, leads, pipeline, settings) | ⏳ Pendiente |
| 8 | Notificaciones: Web Push + email + sonido in-app | ⏳ Pendiente |
| 9 | API HTTP pública: endpoint para leads desde sistemas externos | ⏳ Pendiente |
| 10 | Widget formulario web embebible | ⏳ Pendiente |

---

## 16. Decisiones técnicas y su razonamiento

| Decisión | Alternativas consideradas | Razón elegida |
|----------|--------------------------|---------------|
| Fastify vs Express | Express, Hono | Fastify es 2x más rápido, tipado nativo, plugins oficiales |
| PostgreSQL vs MySQL | MySQL (EspoCRM usa MySQL) | PostgreSQL más robusto para JSON, arrays, full-text search |
| pnpm vs npm/yarn | npm workspaces, yarn berry | pnpm es el más eficiente en disco para monorepos |
| Llama 3.2 3B vs 7B | Mistral 7B, Llama 3.1 8B | 3B cabe en 2GB dejando margen en el VPS de 8GB |
| JWT vs sesiones | Sessions con Redis, Supabase Auth | JWT sin dependencias externas, mínimo recurso |
| BullMQ vs simple async | Kafka, RabbitMQ, simple await | BullMQ sobre Redis ya existente, retry automático, simple |
| tsup vs tsc | tsc, esbuild directo | tsup wrapper de esbuild, configuración mínima, bundlea dependencias workspace |
| Next.js standalone | Docker con node_modules completo | standalone reduce la imagen de Docker de ~1GB a ~200MB |
| Refresh token rotation | Token fijo | Rotación previene replay attacks si el token es robado |

---

## 17. Reglas de negocio importantes

1. **Score ≥ 8** → automáticamente se dispara: notificación HOT_LEAD a todos los agentes + resumen IA generado.

2. **Deduplicación** → match por email OR teléfono. Al detectar: notificar al agente. Fusión automática conserva el score más alto y mueve todas las conversaciones al lead principal.

3. **Agentes** solo ven leads asignados a ellos. **Admins** ven todos.

4. **API keys** format: `kv_<96 hex chars>`. Se muestran UNA SOLA VEZ al crearse. Límite: 10 por usuario.

5. **Refresh tokens** se rotan en cada uso (el token anterior se invalida automáticamente).

6. **scoreLabel** se recalcula automáticamente cuando se actualiza el score:
   - 0–3 → COLD
   - 4–7 → WARM
   - 8–10 → HOT

7. **Primer admin** se crea con el script `seed.ts`. Credenciales iniciales: `admin@kodevon.com` / `KodevonCRM@2024!`. **Cambiar inmediatamente.**

8. **EspoCRM** nunca se expone públicamente. Solo el backend interno le hace requests via HTTP a la red Docker interna.

9. **Ollama** tiene límite de 3GB RAM en Docker para no afectar la estabilidad del VPS.

10. **Canales de scoring** — el score es por lead (no por conversación). Si el mismo lead tiene conversaciones en múltiples canales, el score considera el historial completo.

---

*Documento mantenido por Claude Code — actualizar con cada fase completada.*
