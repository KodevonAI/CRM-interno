# KodevonCRM — Contexto Completo del Proyecto

> Documento actualizado el 2026-03-06. Cubre todas las fases completadas: 1 al 7 inclusive.

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
11. [Fase 3 — EspoCRM Bridge + Canales base](#11-fase-3--espocrm-bridge--canales-base)
12. [Fase 4 — Webhooks + Gmail OAuth + Mensajes](#12-fase-4--webhooks--gmail-oauth--mensajes)
13. [Fase 5 — Worker: handlers de colas](#13-fase-5--worker-handlers-de-colas)
14. [Fase 6 — Dedup + Notificaciones](#14-fase-6--dedup--notificaciones)
15. [Fase 7 — Frontend completo](#15-fase-7--frontend-completo)
16. [API Reference completa](#16-api-reference-completa)
17. [Guía para levantar el proyecto en local](#17-guía-para-levantar-el-proyecto-en-local)
18. [Guía de despliegue en producción (EasyPanel)](#18-guía-de-despliegue-en-producción-easypanel)
19. [Credenciales externas pendientes](#19-credenciales-externas-pendientes)
20. [Roadmap de fases](#20-roadmap-de-fases)
21. [Decisiones técnicas y su razonamiento](#21-decisiones-técnicas-y-su-razonamiento)
22. [Reglas de negocio importantes](#22-reglas-de-negocio-importantes)

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
- Labels: **COLD** (1–3), **WARM** (4–7), **HOT** (8–10).
- **Score ≥ 8:** notificación automática al agente + resumen de IA generado.
- Factores de calificación: keywords de alta intención, cantidad de interacciones, velocidad de respuesta, preguntas del lead.

### Keywords de alta intención definidas (en shared/src/index.ts)
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

### Notificaciones (implementadas en Fase 6, Web Push en Fase 8)
- Registros en DB (`notifications` table) con tipo y payload.
- Fase 8: Web Push API + email + sonido in-app via Socket.io.

### Deduplicación de leads
- Match por **teléfono OR email**.
- Al detectar duplicado: notificar al agente con ambos leads.
- Opciones: fusión automática (une conversaciones, conserva score más alto) o fusión manual.

---

## 4. Stack tecnológico

| Capa | Herramienta | Versión | Justificación |
|------|-------------|---------|---------------|
| Frontend | Next.js | 14.2.18 | SSR, App Router, ecosistema robusto |
| UI State | Zustand | 5.0.2 | Store global ligero con persistencia |
| Data fetching | SWR | 2.3.0 | Cache inteligente, revalidación automática |
| Icons | lucide-react | 0.468.0 | Iconos consistentes, tree-shakeable |
| Utilidades CSS | clsx | 2.1.1 | Classnames condicionales |
| Fechas | date-fns | 3.6.0 | Formateo de fechas sin dependencias pesadas |
| Backend/API | Fastify | 4.29.0 | Más rápido que Express, tipado nativo |
| ORM | Prisma | 5.22.0 | Type-safe, migraciones automáticas |
| Base de datos | PostgreSQL | 16 | Robusta, self-hosted, gratuita |
| Cola de trabajos | BullMQ | 5.28.0 | Redis-based, retry automático |
| Cache/Cola | Redis | 7 | Base de BullMQ, max 512MB en prod |
| Tiempo real | Socket.io | (Fase 8) | Notificaciones en tiempo real |
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
Webhook/Poll → Backend (POST /webhooks/meta) o Worker (Gmail poll cada 2min)
        ↓
BullMQ: inbound-message job
        ↓
Worker procesa (inbound-message.handler.ts):
  1. Deduplica por externalId (evita procesar dos veces)
  2. Busca/crea lead por canal+from (teléfono o email)
  3. Busca/crea conversación OPEN
  4. Guarda mensaje en DB
  5. Encola ai-score job
  6. Encola notify(NEW_MESSAGE) job
  7. Si lead es nuevo: encola dedup-check + espocrm-sync + notify(NEW_LEAD)
        ↓
ai-score handler (Ollama):
  - Toma últimos 20 mensajes del lead
  - Prompt en español: califica 1-10 con criterios COLD/WARM/HOT
  - Parser 3 niveles: JSON directo → regex bloque JSON → regex score solo
  - Guarda AiScore en DB
  - Actualiza lead.score y lead.scoreLabel
  - Si score cruza umbral HOT (≥8) por primera vez:
      → Encola ai-summary job
      → Encola notify(HOT_LEAD) job
        ↓
ai-summary handler (Ollama):
  - Genera resumen ejecutivo en español (3 oraciones)
  - Qué necesita el lead, nivel de interés, próximo paso
  - Guarda/actualiza en AiScore.summary
        ↓
notify handler:
  - Crea registros en tabla notifications para todos los agentes/admins activos
  - TODO Fase 8: Web Push + email + sonido in-app via Socket.io
        ↓
Frontend recibe via polling SWR (cada 5-30s según endpoint)
```

### Flujo de autenticación
```
Login → accessToken (JWT 15min, en body) + refreshToken (7 días, httpOnly cookie)
Request autenticada → Authorization: Bearer <accessToken>
Token expirado → lib/api.ts auto-retry: POST /api/auth/refresh → nuevo accessToken (rota el refreshToken)
Logout → invalida refreshToken en DB + limpia cookie → redirect /login
```

### Gmail polling
```
Worker arranque → upsertJobScheduler('gmail-poll-recurring', { every: 2min })
                ↓
gmailPoll handler cada 2 minutos:
  1. Lee channel_configs de DB (Gmail activo)
  2. Descifra credenciales con ENCRYPTION_KEY
  3. Google OAuth2 client con refresh_token
  4. Busca emails no leídos (unread, not sent-by-us)
  5. Por cada email → encola inbound-message job
  6. Marca emails como leídos
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

### Enums definidos
```prisma
enum UserRole        { ADMIN AGENT AI_AGENT }
enum LeadStage       { NUEVO CONTACTADO CALIFICADO PROPUESTA NEGOCIACION CERRADO_GANADO CERRADO_PERDIDO }
enum ScoreLabel      { COLD WARM HOT }
enum Channel         { WHATSAPP INSTAGRAM FACEBOOK EMAIL FORM API }
enum MessageDirection{ INBOUND OUTBOUND }
enum ConversationStatus { OPEN CLOSED PENDING }
enum NotificationType   { NEW_LEAD HOT_LEAD NEW_MESSAGE DUPLICATE_DETECTED MERGE_SUGGESTION }
```

### Modelos

#### `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| name | String | Nombre completo |
| email | String unique | Email de login |
| password_hash | String | bcrypt hash |
| role | UserRole | ADMIN \| AGENT \| AI_AGENT |
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
| source_channel | Channel | Canal de entrada |
| stage | LeadStage | Etapa del pipeline |
| score | Int (0-10) | Score de calificación actual |
| score_label | ScoreLabel | COLD \| WARM \| HOT |
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
| channel | Channel | Canal de esta conversación |
| external_id | String? | ID externo del chat en el canal |
| status | ConversationStatus | OPEN \| CLOSED \| PENDING |
| created_at / updated_at | DateTime | Timestamps |

#### `messages`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| conversation_id | UUID | FK → conversations |
| direction | MessageDirection | INBOUND \| OUTBOUND |
| content | String | Texto del mensaje |
| content_type | String | text, image, audio, document |
| metadata | Json? | Datos originales del canal |
| external_id | String? | ID del mensaje en el canal (para dedup) |
| sent_at | DateTime | Timestamp real del mensaje |

#### `ai_scores`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| lead_id | UUID | FK → leads |
| score | Int | Score 1-10 |
| label | ScoreLabel | COLD \| WARM \| HOT |
| summary | String? | Resumen ejecutivo generado por IA (3 oraciones) |
| factors | Json? | Factores: `{reason, messageCount}` |
| trigger_msg | String? | Mensaje que disparó el recálculo (max 200 chars) |
| created_at | DateTime | Timestamp |

#### `api_keys`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| key_hash | String unique | SHA-256 del token |
| name | String | Nombre descriptivo |
| last_used | DateTime? | Última vez usada |
| created_at | DateTime | Timestamp |

#### `notifications`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| lead_id | UUID? | FK → leads |
| type | NotificationType | Tipo de evento |
| payload | Json | Datos de la notificación (lead name, score, etc.) |
| read | Boolean | Estado de lectura |
| created_at | DateTime | Timestamp |

#### `channel_configs`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| channel | Channel unique | Un registro por canal |
| credentials | Json | Credenciales **cifradas con AES-256** (ENCRYPTION_KEY) |
| active | Boolean | Canal habilitado/deshabilitado |
| created_at / updated_at | DateTime | Timestamps |

> Nota: Las credenciales de Gmail (refresh_token) se almacenan aquí después de completar el flujo OAuth2. No en variables de entorno.

#### `refresh_tokens`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| token_hash | String unique | SHA-256 del token |
| expires_at | DateTime | Expiración (7 días) |
| created_at | DateTime | Timestamp |

---

## 7. Variables de entorno

Archivo real: `.env` (en la raíz del monorepo)

```env
# ─── Server ───────────────────────────────────────────────────
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=info

# ─── Auth ─────────────────────────────────────────────────────
# generar con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64+ chars>
COOKIE_SECRET=<64+ chars, diferente al anterior>

# ─── Database ─────────────────────────────────────────────────
POSTGRES_PASSWORD=KodevonDB2024!
DATABASE_URL=postgresql://postgres:KodevonDB2024!@localhost:5432/kodevoncrm

# ─── Redis ────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Ollama ───────────────────────────────────────────────────
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# ─── EspoCRM (red interna Docker en producción) ───────────────
ESPOCRM_URL=http://localhost:80          # en prod: http://espocrm:80
ESPOCRM_API_KEY=                         # desde EspoCRM Admin → API Keys

# ─── Cifrado de credenciales de canales ───────────────────────
ENCRYPTION_KEY=<64 hex chars>

# ─── Producción ───────────────────────────────────────────────
DOMAIN=crm.kodevon.com

# ─── WhatsApp Cloud API ───────────────────────────────────────
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_WABA_ID=
WA_WEBHOOK_VERIFY_TOKEN=

# ─── Meta (Instagram + Facebook) ─────────────────────────────
META_APP_ID=
META_APP_SECRET=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_IG_ACCOUNT_ID=

# ─── Gmail OAuth2 ─────────────────────────────────────────────
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_EMAIL=

# ─── Frontend (Next.js public) ────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**En producción:** `FRONTEND_URL=https://crm.kodevon.com`, `DATABASE_URL` apunta a `kodevon-db:5432`, `REDIS_URL` a `kodevon-redis:6379`, `OLLAMA_URL` a `kodevon-ollama:11434`, `ESPOCRM_URL` al nombre del contenedor EspoCRM.

---

## 8. Estructura de archivos

```
CRM-interno/
├── .env                              ← variables de entorno (no subir a git)
├── .env.example                      ← plantilla sin valores
├── .gitignore
├── package.json                      ← raíz del monorepo, scripts globales
├── pnpm-workspace.yaml               ← apps/* y packages/*
│
├── apps/
│   ├── backend/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── src/
│   │       ├── index.ts              ← Fastify app, plugins, todas las rutas
│   │       ├── lib/
│   │       │   ├── prisma.ts         ← re-export @kodevon/db
│   │       │   ├── redis.ts          ← IORedis (redis + bullConnection)
│   │       │   ├── queues.ts         ← 6 Queue instances BullMQ con retry config
│   │       │   ├── utils.ts          ← scoreToLabel, paginate, paginatedResponse
│   │       │   ├── espocrm.ts        ← cliente HTTP EspoCRM (createLead, updateLead, ping...)
│   │       │   └── channels/
│   │       │       ├── whatsapp.ts   ← sendWhatsAppMessage(to, text) → messageId
│   │       │       ├── meta-messenger.ts ← sendInstagramMessage, sendFacebookMessage
│   │       │       └── gmail.ts      ← getOAuth2Client, getAuthUrl, fetchUnreadEmails, sendEmail
│   │       ├── middleware/
│   │       │   └── authenticate.ts   ← authenticate(), authorize(), authenticateApiKey()
│   │       ├── routes/
│   │       │   ├── auth.ts           ← login, refresh, logout, me
│   │       │   ├── users.ts          ← CRUD usuarios (ADMIN full, AGENT solo propio)
│   │       │   ├── leads.ts          ← CRUD + assign + merge + filtros + paginación
│   │       │   ├── api-keys.ts       ← generate kv_<96hex>, revoke, list
│   │       │   ├── espocrm.ts        ← status ping, sync-all, sync/:id
│   │       │   ├── gmail-auth.ts     ← OAuth flow: /gmail redirect, /gmail/callback, /gmail/status, /gmail/disconnect
│   │       │   ├── messages.ts       ← POST /send (por canal), GET /:conversationId
│   │       │   ├── inbox.ts          ← GET /inbox (conversaciones + último mensaje paginado)
│   │       │   ├── notifications.ts  ← GET /, PATCH /:id/read, PATCH /read-all
│   │       │   └── webhooks/
│   │       │       └── meta.ts       ← GET verificación hub.challenge, POST procesa WA/IG/FB
│   │       ├── scripts/
│   │       │   └── seed.ts           ← crea admin@kodevon.com / KodevonCRM@2024!
│   │       └── types/
│   │           └── fastify.d.ts      ← augmentación tipos JWT en request.user
│   │
│   ├── frontend/
│   │   ├── Dockerfile
│   │   ├── next.config.js            ← output: 'standalone'
│   │   ├── package.json              ← next, zustand, swr, lucide-react, clsx, date-fns, socket.io-client
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts        ← colores custom: surface, brand, channel, score
│   │   ├── postcss.config.js
│   │   ├── middleware.ts             ← protección de rutas (cookie refreshToken)
│   │   └── app/
│   │       ├── globals.css           ← @tailwind + .card, .btn-primary, .btn-ghost, .input, .badge-*
│   │       ├── layout.tsx            ← RootLayout + Providers (SWR)
│   │       ├── providers.tsx         ← SWRConfig global (revalidateOnFocus: false)
│   │       ├── page.tsx              ← redirect → /inbox
│   │       ├── (auth)/
│   │       │   └── login/
│   │       │       └── page.tsx      ← login form con estado de error
│   │       └── (app)/
│   │           ├── layout.tsx        ← shell: Sidebar + children
│   │           ├── inbox/
│   │           │   └── page.tsx      ← lista conversaciones + ChatWindow en split view
│   │           ├── leads/
│   │           │   ├── page.tsx      ← tabla + pipeline kanban, búsqueda, paginación
│   │           │   ├── new/
│   │           │   │   └── page.tsx  ← form crear lead manual
│   │           │   └── [id]/
│   │           │       └── page.tsx  ← detalle: editar, asignar, AI score history, sync EspoCRM
│   │           └── settings/
│   │               └── page.tsx      ← EspoCRM status+sync, Gmail OAuth, canales, usuarios (admin)
│   │
│   ├── lib/
│   │   ├── api.ts                    ← cliente HTTP tipado, auto-refresh 401, todos los endpoints
│   │   └── hooks.ts                  ← SWR hooks: useLeads, useLead, useInbox, useMessages, useNotifications...
│   ├── store/
│   │   └── auth.store.ts             ← Zustand store (user, setUser, logout) con persist localStorage
│   └── components/
│       ├── layout/
│       │   ├── Sidebar.tsx           ← nav colapsable (w-16/w-56), avatar, logout
│       │   └── Header.tsx            ← título + campana notificaciones con badge
│       ├── inbox/
│       │   └── ChatWindow.tsx        ← burbujas de chat, scroll automático, textarea Enter/shift+Enter
│       ├── leads/
│       │   └── PipelineBoard.tsx     ← kanban horizontal con 7 columnas por stage
│       └── ui/
│           └── Badge.tsx             ← badge COLD/WARM/HOT con variantes
│
│   └── worker/
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts
│       └── src/
│           ├── index.ts              ← 7 Workers + Gmail scheduler + graceful shutdown
│           ├── lib/
│           │   ├── prisma.ts         ← PrismaClient standalone (proceso separado)
│           │   ├── redis.ts          ← IORedis connection para BullMQ
│           │   ├── queues.ts         ← 7 Queue instances para re-encolar desde handlers
│           │   ├── espocrm.ts        ← copia del cliente EspoCRM (proceso separado)
│           │   ├── ollama.ts         ← generate(prompt, maxTokens) + isAvailable() con timeout
│           │   ├── gmail-reader.ts   ← fetchUnreadEmails + markAsRead desde channel_configs DB
│           │   └── utils.ts          ← scoreToLabel()
│           └── handlers/
│               ├── inbound-message.handler.ts  ← dedup externalId, find/create lead+conv+msg, encola jobs
│               ├── espocrm.handler.ts          ← create or update lead en EspoCRM, guarda espocrmId
│               ├── gmail-poll.handler.ts        ← fetch unread emails → inbound-message jobs
│               ├── dedup-check.handler.ts       ← busca duplicados por email/phone, encola DUPLICATE_DETECTED
│               ├── notify.handler.ts            ← crea Notification records para todos agents/admins activos
│               ├── ai-score.handler.ts          ← Ollama scoring con 3-level parser, actualiza Lead+AiScore
│               └── ai-summary.handler.ts        ← Ollama summary 3 oraciones, actualiza/crea AiScore.summary
│
├── packages/
│   ├── db/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   └── schema.prisma         ← schema completo con todos los modelos, enums e índices
│   │   └── src/
│   │       └── index.ts              ← PrismaClient singleton con global cache (hot reload safe)
│   │
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts              ← tipos, constantes, QUEUE_NAMES, HOT_LEAD_THRESHOLD=8, keywords IA, payloads
│
├── docker/
│   ├── docker-compose.dev.yml        ← solo PostgreSQL + Redis + Ollama (dev local)
│   ├── docker-compose.prod.yml       ← stack completo con Traefik labels, mem_limit Ollama 3g
│   └── init-ollama.sh                ← script post-start para descargar llama3.2:3b
│
└── docs/
    └── CONTEXTO-COMPLETO.md          ← este archivo
```

---

## 9. Fase 1 — Infraestructura

**Estado:** ✅ Completa

### Qué se construyó
- Monorepo con `pnpm workspaces` (apps: backend, frontend, worker / packages: db, shared).
- `docker-compose.dev.yml`: PostgreSQL 16 + Redis 7 + Ollama con volúmenes persistentes y healthchecks.
- `docker-compose.prod.yml`: stack completo con Traefik labels para EasyPanel, límite de 3GB RAM para Ollama, redes separadas (easypanel pública + internal privada).
- Prisma schema completo con todos los modelos, enums e índices.
- `packages/shared/src/index.ts`: tipos TypeScript, constantes (SCORE_THRESHOLDS, HOT_LEAD_THRESHOLD=8, HIGH_INTENT_KEYWORDS, QUEUE_NAMES, tipos de payloads de jobs BullMQ).
- Backend Fastify arranca con health check en `/api/health`.
- Frontend Next.js con tema oscuro (surface/brand/channel/score colors), output standalone para Docker.
- Worker BullMQ skeleton con 7 workers y graceful shutdown (SIGTERM/SIGINT).
- Dockerfiles de cada servicio copiando el monorepo completo como contexto (evita problemas de hoisting de pnpm).

### Colores del tema (Tailwind)
```
surface.DEFAULT:  #0F1117  (fondo principal)
surface.raised:   #161B27  (cards, sidebar)
surface.2:        #161B27  (alias de raised)
surface.overlay:  #1E2536  (inputs, overlays)
surface.border:   #2A3347  (bordes)
brand.DEFAULT:    #3B82F6  (azul primario)
brand.hover:      #2563EB
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

### Clases CSS globales (globals.css)
```css
.card         → bg-surface-raised border border-surface-border rounded-lg p-4
.btn-primary  → inline-flex items-center gap-1.5 bg-brand ... disabled:opacity-50
.btn-ghost    → inline-flex items-center gap-1.5 text-gray-400 ... disabled:opacity-50
.input        → bg-surface-overlay border border-surface-border ... focus:border-brand
.badge        → inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full
.badge-cold   → bg-gray-700 text-gray-300
.badge-warm   → bg-amber-900/50 text-amber-400
.badge-hot    → bg-red-900/50 text-red-400
```

---

## 10. Fase 2 — Backend Core

**Estado:** ✅ Completa

### Autenticación (`/api/auth`)
- Login con email/password → `accessToken` (JWT 15min) en body + `refreshToken` (httpOnly cookie, 7 días).
- Refresh token con **rotación automática** — cada uso invalida el anterior y emite uno nuevo.
- Logout invalida el refresh token en DB.
- `GET /api/auth/me` devuelve perfil del usuario autenticado.
- Rate limiter diferenciado para `/auth/login` (anti-fuerza-bruta).

### Usuarios (`/api/users`)
- CRUD completo. Solo ADMIN puede crear/listar todos/eliminar.
- Agentes solo pueden ver y editar su propio perfil.
- Solo ADMIN puede cambiar `role` o `isActive`.
- Contraseñas hasheadas con **bcrypt factor 12**.

### Leads (`/api/leads`)
- Listado con paginación + filtros: stage, channel, scoreLabel, assignedToId, search.
- Creación: encola automáticamente `dedup-check` y `espocrm-sync`.
- Actualización: recalcula `scoreLabel` al cambiar score. Si cruza HOT (≥8) por primera vez, encola `ai-summary` + notificación `HOT_LEAD`.
- `POST /api/leads/:id/assign`: asigna agente (solo ADMIN).
- `POST /api/leads/:id/merge`: fusión de duplicados. Mueve conversaciones y messages, conserva score más alto, marca el fusionado como `isDuplicate: true`.
- Agentes solo ven leads asignados a ellos.

### API Keys (`/api/api-keys`)
- Formato: `kv_<96 hex chars>`. Mostrado **solo al crear** (solo se guarda hash SHA-256).
- Límite: 10 por usuario.
- `authenticateApiKey` middleware: acepta JWT o API key con `Authorization: Bearer`.

### Middlewares (`apps/backend/src/middleware/authenticate.ts`)
```typescript
authenticate           // verifica JWT, pone request.user
authorize(...roles)    // verifica JWT + rol requerido
authenticateApiKey     // acepta JWT o API key indistintamente
```

### Seed
- `admin@kodevon.com` / `KodevonCRM@2024!` — **cambiar inmediatamente en producción**.

---

## 11. Fase 3 — EspoCRM Bridge + Canales base

**Estado:** ✅ Completa

### EspoCRM client (`apps/backend/src/lib/espocrm.ts` y duplicado en worker)

```typescript
// Funciones principales:
createLead(data)          → POST /api/v1/Lead
updateLead(id, data)      → PATCH /api/v1/Lead/:id
getLead(id)               → GET /api/v1/Lead/:id
ping()                    → GET /api/v1/App/user (test de conexión)
isConfigured()            → true si ESPOCRM_URL y ESPOCRM_API_KEY están definidos
toEspoCRMLead(lead)       → mapea campos del CRM al formato EspoCRM

// Mapeo de stages al campo "status" de EspoCRM:
NUEVO           → 'New'
CONTACTADO      → 'Assigned'
CALIFICADO      → 'In Process'
PROPUESTA       → 'In Process'
NEGOCIACION     → 'In Process'
CERRADO_GANADO  → 'Converted'
CERRADO_PERDIDO → 'Recycled'

// Mapeo de canales al campo "source" de EspoCRM:
WHATSAPP   → 'Call'
INSTAGRAM  → 'Web Site'
FACEBOOK   → 'Web Site'
EMAIL      → 'Email'
FORM       → 'Web Site'
API        → 'Other'
```

### Canal WhatsApp (`apps/backend/src/lib/channels/whatsapp.ts`)
```typescript
sendWhatsAppMessage(to: string, text: string): Promise<string>
// POST https://graph.facebook.com/v18.0/${WA_PHONE_NUMBER_ID}/messages
// Devuelve message ID de la API de Meta
```

### Canal Instagram/Facebook (`apps/backend/src/lib/channels/meta-messenger.ts`)
```typescript
sendInstagramMessage(to: string, text: string): Promise<string>
sendFacebookMessage(to: string, text: string): Promise<string>
// Usa META_IG_ACCOUNT_ID / META_PAGE_ID + META_PAGE_ACCESS_TOKEN
```

### Canal Gmail (`apps/backend/src/lib/channels/gmail.ts`)
```typescript
getOAuth2Client()                        → OAuth2 client con credenciales del canal
getAuthUrl(client)                       → URL de consentimiento OAuth2
fetchUnreadEmails(auth)                  → emails no leídos del inbox
markAsRead(auth, messageId)              → marca email como leído
sendEmail(to, subject, body, replyToId?) → envía email via Gmail API
```

### Rutas EspoCRM (`/api/espocrm`)
```
GET  /api/espocrm/status      → ping a EspoCRM, retorna { connected, version }
POST /api/espocrm/sync-all    → sincroniza todos los leads sin espocrmId
POST /api/espocrm/sync/:id    → sincroniza un lead específico
```

---

## 12. Fase 4 — Webhooks + Gmail OAuth + Mensajes

**Estado:** ✅ Completa

### Webhook Meta unificado (`/webhooks/meta`)

```typescript
// GET /webhooks/meta — verificación de webhook de Meta
// Params: hub.mode, hub.verify_token, hub.challenge
// Verifica contra WA_WEBHOOK_VERIFY_TOKEN, responde con hub.challenge

// POST /webhooks/meta — procesa mensajes entrantes
// Soporta: WhatsApp, Instagram, Facebook Messenger en el mismo endpoint
// Detecta el canal por el tipo de objeto en el body
// Para cada mensaje → encola inbound-message job en BullMQ:
{
  channel:         'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK',
  from:            'número o psid del emisor',
  messageContent:  'texto del mensaje',
  externalId:      'id único del mensaje en el canal',
  metadata:        { objeto original del canal }
}
```

### Gmail OAuth flow (`/api/auth/gmail/*`)
```
GET  /api/auth/gmail             → genera URL de autorización Google, redirige
GET  /api/auth/gmail/callback    → recibe code, intercambia por tokens, guarda en channel_configs
GET  /api/auth/gmail/status      → { connected: bool, email?: string }
DELETE /api/auth/gmail/disconnect → elimina channel_config de Gmail, desactiva polling
```

> Las credenciales (refresh_token) se almacenan **cifradas** en la tabla `channel_configs` con AES-256 usando `ENCRYPTION_KEY`.

### Envío y lectura de mensajes (`/api/messages`)
```
POST /api/messages/send
  Body: { conversationId, content, channel, to }
  → Según channel: sendWhatsAppMessage | sendInstagramMessage | sendFacebookMessage | sendEmail
  → Guarda mensaje OUTBOUND en DB
  → Si es primera respuesta del agente: actualiza lead.stage NUEVO → CONTACTADO
  → Retorna { message }

GET /api/messages/:conversationId
  → Historial de mensajes de la conversación
  → Retorna { messages: [] }
```

---

## 13. Fase 5 — Worker: handlers de colas

**Estado:** ✅ Completa

### Worker index (`apps/worker/src/index.ts`)
- 7 Workers BullMQ instanciados con handlers reales.
- Gmail poll recurrente via `upsertJobScheduler` cada 2 minutos.
- Logging de completed/failed por cada worker.
- Graceful shutdown en SIGTERM/SIGINT: cierra workers + desconecta Redis.

### `inbound-message.handler.ts`
1. Verifica `externalId` — si ya existe en messages, descarta (deduplicación).
2. Busca lead por canal + `from` (teléfono o email). Si no existe, crea con stage NUEVO, score 0.
3. Busca conversación OPEN del lead en ese canal. Si no existe, crea una.
4. Guarda el mensaje como INBOUND en DB.
5. Encola: `ai-score` + `notify(NEW_MESSAGE)`.
6. Si el lead es recién creado: encola `dedup-check` + `espocrm-sync` + `notify(NEW_LEAD)`.

### `espocrm.handler.ts`
- Si lead tiene `espocrmId` → `updateLead()`.
- Si no tiene → `createLead()` → guarda el ID devuelto en `lead.espocrmId`.
- Si EspoCRM no está configurado (`isConfigured()` = false) → skip silencioso.

### `gmail-poll.handler.ts`
- Lee `channel_configs` donde `channel = EMAIL` y `active = true`.
- Descifra credenciales con `ENCRYPTION_KEY`.
- Crea OAuth2 client con `refresh_token` guardado.
- Llama `fetchUnreadEmails()` de `lib/gmail-reader.ts`.
- Por cada email: encola `inbound-message` job con `channel: EMAIL`, `from: sender email`, `externalId: email message id`.
- Llama `markAsRead()` para cada email procesado.

### `ai-score.handler.ts`
```typescript
// Flujo completo:
1. isAvailable() → si Ollama no responde en 3s → skip
2. Carga lead con últimas 20 mensajes (flatMap de todas las conversaciones)
3. Cuenta mensajes INBOUND
4. buildScoringPrompt() → prompt en español con criterios COLD/WARM/HOT
5. generate(prompt, 200 tokens) → respuesta JSON del modelo
6. parseScore() con 3 niveles de fallback:
   - JSON.parse directo
   - regex /\{[\s\S]*?\}/ + JSON.parse
   - regex score:\d → construir objeto manual
7. Crea AiScore en DB con score, label, factors, triggerMsg
8. Actualiza lead.score y lead.scoreLabel
9. Si score >= HOT_LEAD_THRESHOLD (8) y previousScore < 8:
   → Encola ai-summary
   → Encola notify(HOT_LEAD) con payload {leadName, score, reason, channel}
```

**Prompt de scoring (español):**
```
Eres un experto en ventas de tecnología para Kodevon...
Criterios:
- 1-3 (COLD): Curiosidad general, sin intención clara de comprar
- 4-7 (WARM): Interés moderado, pregunta sobre servicios o precios
- 8-10 (HOT): Alta intención: menciona presupuesto, fechas, quiere empezar...
Responde ÚNICAMENTE con JSON válido: {"score": <1-10>, "label": "...", "reason": "..."}
```

### `ai-summary.handler.ts`
```typescript
// Flujo:
1. isAvailable() → skip si Ollama no disponible
2. Carga lead con TODOS los mensajes (sin límite) + último AiScore
3. buildSummaryPrompt() → prompt en español, máximo 3 oraciones:
   - Qué necesita/busca el lead
   - Su nivel de interés
   - Siguiente paso recomendado para cerrar la venta
4. generate(prompt, 300 tokens)
5. Si lead tiene AiScore previo → UPDATE con summary
   Si no tiene → CREATE nuevo AiScore con score actual + summary
```

### `lib/ollama.ts`
```typescript
isAvailable(): Promise<boolean>
// GET /api/tags con AbortSignal timeout de 3 segundos

generate(prompt: string, maxTokens: number): Promise<string>
// POST /api/generate con model de OLLAMA_MODEL env
// stream: false → retorna texto completo
```

---

## 14. Fase 6 — Dedup + Notificaciones

**Estado:** ✅ Completa

### `dedup-check.handler.ts`
```typescript
// Si email o phone están presentes:
// Busca leads con mismo email OR teléfono:
//   - excluyendo el lead actual (id: { not: leadId })
//   - excluyendo ya marcados como duplicados (isDuplicate: false)
// Si hay duplicados → encola notify(DUPLICATE_DETECTED) con:
{
  type: 'DUPLICATE_DETECTED',
  leadId,
  payload: {
    duplicates: [{ id, name, email, phone, channel, stage, score }],
    matchField: 'email' | 'phone',
    matchValue: string
  }
}
```

### `notify.handler.ts`
```typescript
// Determina destinatarios:
//   - Si targetUserIds viene en el payload → usa esos
//   - Si no → busca todos los users con isActive=true y role IN [ADMIN, AGENT]
// Crea Notification records en DB para cada usuario (createMany + skipDuplicates)
// Log: "[notify] TIPO → N usuario(s) | lead: ID"
// TODO Fase 8: Web Push + email + sonido in-app via Socket.io
```

### Tipos de notificaciones
| Tipo | Cuándo se genera |
|------|-----------------|
| NEW_LEAD | Al crear un lead (inbound-message handler, primer mensaje) |
| NEW_MESSAGE | Por cada mensaje nuevo entrante |
| HOT_LEAD | Cuando el score cruza ≥ 8 por primera vez |
| DUPLICATE_DETECTED | Cuando dedup-check encuentra coincidencia de email/teléfono |
| MERGE_SUGGESTION | Disponible en payload de DUPLICATE_DETECTED |

---

## 15. Fase 7 — Frontend completo

**Estado:** ✅ Completa

### Nuevas dependencias en `apps/frontend/package.json`
```json
"zustand": "^5.0.2",
"swr": "^2.3.0",
"lucide-react": "^0.468.0",
"clsx": "^2.1.1",
"date-fns": "^3.6.0",
"socket.io-client": "^4.8.1"
```

### `middleware.ts` (Next.js route protection)
- Rutas públicas: `/login`
- Todas las demás rutas verifican la cookie `refreshToken` (httpOnly, seteada por el backend)
- Si no hay cookie → redirect a `/login`

### `app/providers.tsx`
- Wrapper `'use client'` que aplica `SWRConfig` global con `revalidateOnFocus: false` y `shouldRetryOnError: false`.

### `lib/api.ts` — Cliente HTTP tipado
```typescript
// Base URL: process.env.NEXT_PUBLIC_API_URL
// Todas las requests: credentials: 'include' (para cookies)
// Auto-refresh en 401:
//   1. POST /api/auth/refresh
//   2. Si OK → retry request original
//   3. Si falla → redirect /login
// Módulos:
api.auth.login(email, password)
api.auth.logout()
api.auth.me()
api.leads.list(params?)    // con paginación y filtros
api.leads.get(id)
api.leads.create(data)
api.leads.update(id, data)
api.leads.delete(id)
api.leads.assign(id, userId)
api.leads.merge(id, duplicateId)
api.inbox.list(params?)    // conversaciones + último mensaje
api.messages.list(conversationId)
api.messages.send(payload)
api.notifications.list()
api.notifications.markRead(id)
api.notifications.markAllRead()
api.users.list()
api.users.update(id, data)
api.espocrm.status()
api.espocrm.syncAll()
api.gmail.status()
api.gmail.getAuthUrl()
api.gmail.disconnect()
```

### `store/auth.store.ts`
```typescript
// Zustand con persist en localStorage (key: 'kodevon-auth')
interface AuthState {
  user: User | null
  setUser(user)
  logout()
}
```

### `lib/hooks.ts` — SWR hooks
```typescript
useLeads(params?)          // revalidateOnFocus: false
useLead(id)                // revalidateOnFocus: false
useInbox(params?)          // refreshInterval: 15_000
useMessages(conversationId) // refreshInterval: 5_000
useNotifications()          // refreshInterval: 30_000
useUsers()
useEspocrmStatus()          // refreshInterval: 60_000
useGmailStatus()            // refreshInterval: 60_000
```

### Páginas y componentes

#### `app/(auth)/login/page.tsx`
- Form con email + password, feedback de error en rojo.
- Al hacer login: `api.auth.login()` → `setUser()` en store → redirect `/inbox`.

#### `app/(app)/layout.tsx`
- Shell: `flex h-screen` con `<Sidebar />` a la izquierda y `children` a la derecha.

#### `components/layout/Sidebar.tsx`
- 3 items de nav: Inbox (`/inbox`), Leads (`/leads`), Ajustes (`/settings`).
- Colapsable: w-16 (mobile) / w-56 (lg+).
- Avatar del usuario con inicial.
- Badge de notificaciones no leídas en el ícono de Bell.
- Botón logout que llama `api.auth.logout()` + limpia store + redirect.

#### `components/layout/Header.tsx`
- Props: `title: string`.
- Bell icon con punto rojo si hay notificaciones no leídas.
- Click en Bell → `markAllRead()` + `mutate('notifications')`.

#### `app/(app)/inbox/page.tsx`
- Split: lista conversaciones izquierda (w-72/xl:w-80) + ChatWindow derecha.
- Lista: buscador local por nombre de lead.
- Cada item: avatar con inicial, icono de canal (emoji), nombre, último mensaje truncado, badge score, tiempo relativo (date-fns es).
- Al seleccionar: monta `<ChatWindow key={conv.id} conversation={conv} />`.
- Si no hay selección: placeholder "Selecciona una conversación".

#### `components/inbox/ChatWindow.tsx`
- Header: avatar, nombre, badge score, canal+teléfono, score numérico, stage.
- Burbujas: INBOUND izquierda (bg-surface-2), OUTBOUND derecha (bg-brand).
- Timestamps con `formatDistanceToNow` en español.
- Scroll automático al último mensaje (`useEffect` con `ref.scrollIntoView`).
- Textarea expandible (min 40px, max 32px rows). Enter envía, Shift+Enter nueva línea.
- `api.messages.send()` → `mutate(['messages', id])` + `mutate(['inbox', undefined])`.

#### `app/(app)/leads/page.tsx`
- Toolbar: buscador, toggle tabla/pipeline, botón "Nuevo lead".
- Vista tabla: columnas Lead, Canal, Etapa, Score, Asignado, Creado. Click fila → `/leads/:id`.
- Vista pipeline: `<PipelineBoard leads={filtered} />`.
- Paginación inferior cuando hay más de 1 página.

#### `components/leads/PipelineBoard.tsx`
- 7 columnas (una por stage), overflow-x-auto.
- Cada columna con borde superior de color por stage (gray/blue/purple/yellow/orange/green/red).
- Cards: nombre, empresa, badge score, score numérico, avatar del agente asignado.
- Click en card → `router.push('/leads/:id')`.

#### `app/(app)/leads/[id]/page.tsx`
- Grid 2/3 + 1/3 en lg.
- Izquierda: form editable (nombre, email, teléfono, empresa, stage, asignado). Toggle edición con botón Editar/Guardar/Cancelar.
- Derecha: score gauge (número grande + barra de progreso + summary de IA), historial de scores (tabla compacta).
- Botón "Sync EspoCRM" que llama `api.espocrm.syncAll()` con spinner.

#### `app/(app)/leads/new/page.tsx`
- Form: nombre (requerido), email, teléfono, empresa, canal de origen.
- `api.leads.create()` → redirect a `/leads/:newId`.

#### `app/(app)/settings/page.tsx`
- **EspoCRM:** status badge conectado/desconectado. Botón "Sincronizar todos" (solo ADMIN).
- **Gmail:** status conectado/desconectado, email conectado. Botón "Conectar Gmail" (abre OAuth en nueva pestaña). Botón "Desconectar" (solo si conectado y ADMIN).
- **Canales activos:** grid de 6 canales con estado.
- **Usuarios:** solo ADMIN ve esta sección. Lista de usuarios con avatar, nombre, email, rol, estado activo. Formulario expandible para crear nuevo usuario.
- **Sistema:** info de versión, stack, modelo IA.

### Nuevas rutas de backend creadas en Fase 7

#### `apps/backend/src/routes/inbox.ts` → `GET /api/inbox`
```typescript
// Query params: page, limit, status (OPEN|ALL)
// Retorna: conversaciones con lead (assignedTo incluido) + lastMessage + unreadCount
// Ordenadas por updatedAt desc
```

#### `apps/backend/src/routes/notifications.ts`
```typescript
GET    /api/notifications         → lista 50 más recientes del usuario actual
PATCH  /api/notifications/:id/read  → marca una como leída
PATCH  /api/notifications/read-all  → marca todas como leídas
```

---

## 16. API Reference completa

### Auth
| Método | Endpoint | Auth | Body | Descripción |
|--------|----------|------|------|-------------|
| POST | `/api/auth/login` | — | `{email, password}` | Login → accessToken + cookie |
| POST | `/api/auth/refresh` | cookie | — | Rota refresh token |
| POST | `/api/auth/logout` | JWT | — | Cierra sesión |
| GET | `/api/auth/me` | JWT | — | Perfil actual |
| GET | `/api/auth/gmail` | JWT ADMIN | — | URL OAuth Gmail |
| GET | `/api/auth/gmail/callback` | — | query params OAuth | Callback OAuth → guarda token |
| GET | `/api/auth/gmail/status` | JWT | — | `{connected, email?}` |
| DELETE | `/api/auth/gmail/disconnect` | JWT ADMIN | — | Desconecta Gmail |

### Usuarios
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/users` | ADMIN | Listar todos los usuarios |
| POST | `/api/users` | ADMIN | Crear usuario |
| GET | `/api/users/:id` | JWT | Ver usuario |
| PATCH | `/api/users/:id` | JWT | Editar usuario |
| DELETE | `/api/users/:id` | ADMIN | Eliminar usuario |

### Leads
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/leads` | JWT | Listar con filtros y paginación |
| POST | `/api/leads` | JWT | Crear lead |
| GET | `/api/leads/:id` | JWT | Lead + conversaciones + aiScores |
| PATCH | `/api/leads/:id` | JWT | Actualizar lead |
| DELETE | `/api/leads/:id` | ADMIN | Eliminar lead |
| POST | `/api/leads/:id/assign` | ADMIN | Asignar agente |
| POST | `/api/leads/:id/merge` | ADMIN | Fusionar duplicado |

#### Query params de `GET /api/leads`
```
?page=1&limit=20&search=texto&stage=NUEVO&channel=WHATSAPP&scoreLabel=HOT&assignedToId=<uuid>
```

### Inbox
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/inbox` | JWT | Conversaciones con lastMessage, paginadas |

#### Query params de `GET /api/inbox`
```
?page=1&limit=30&status=OPEN   (status: OPEN | CLOSED | PENDING | ALL)
```

### Mensajes
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/messages/send` | JWT | Enviar mensaje por canal |
| GET | `/api/messages/:conversationId` | JWT | Historial de mensajes |

#### Body de `POST /api/messages/send`
```json
{
  "conversationId": "uuid",
  "content": "texto del mensaje",
  "channel": "WHATSAPP|INSTAGRAM|FACEBOOK|EMAIL",
  "to": "+521234567890 o email@ejemplo.com"
}
```

### Notificaciones
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/notifications` | JWT | Últimas 50 del usuario |
| PATCH | `/api/notifications/:id/read` | JWT | Marcar una como leída |
| PATCH | `/api/notifications/read-all` | JWT | Marcar todas como leídas |

### API Keys
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/api-keys` | JWT | Listar mis API keys |
| POST | `/api/api-keys` | JWT | Crear key (retorna raw UNA sola vez) |
| DELETE | `/api/api-keys/:id` | JWT | Revocar key |

### EspoCRM
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/api/espocrm/status` | JWT | Ping a EspoCRM |
| POST | `/api/espocrm/sync-all` | ADMIN | Sincroniza todos los leads |
| POST | `/api/espocrm/sync/:id` | ADMIN | Sincroniza un lead |

### Webhooks
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/webhooks/meta` | — | Verificación Meta (hub.challenge) |
| POST | `/webhooks/meta` | — | Mensajes WA/IG/FB entrantes |

### Health
```
GET /api/health → { status: "ok", version, environment, timestamp }
```

---

## 17. Guía para levantar el proyecto en local

### Requisitos
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Docker Desktop corriendo (o Docker Engine en Linux)

### Pasos completos

```bash
# 1. Entrar al proyecto (bash / Git Bash en Windows)
cd '/c/Users/MACC PC/Documents/GitHub/CRM-interno'

# 2. Instalar dependencias
pnpm install

# 3. Verificar .env (ya fue creado con valores generados)
# NEXT_PUBLIC_API_URL=http://localhost:3001 ya está agregado

# 4. Levantar infraestructura (DB + Redis + Ollama)
docker compose -f docker/docker-compose.dev.yml up -d

# 5. Esperar que PostgreSQL esté listo (~10s) y correr migraciones
pnpm db:migrate
# Nombre de migración sugerido: "init"

# 6. Generar cliente Prisma
pnpm db:generate

# 7. Crear primer usuario admin
npx tsx apps/backend/src/scripts/seed.ts
# → admin@kodevon.com / KodevonCRM@2024!

# 8. Descargar modelo de IA (solo la primera vez, ~2GB)
docker exec kodevon-ollama ollama pull llama3.2:3b

# 9. Levantar los 3 servicios (3 terminales separadas)
pnpm dev:backend    # http://localhost:3001/api/health
pnpm dev:frontend   # http://localhost:3000
pnpm dev:worker     # procesa jobs en background
```

### Verificación rápida

```bash
# Health check del backend
curl http://localhost:3001/api/health

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kodevon.com","password":"KodevonCRM@2024!"}'

# Frontend: abrir http://localhost:3000
# → redirige a /login → inicia sesión → inbox
```

### Scripts del monorepo

| Comando | Acción |
|---------|--------|
| `pnpm dev:backend` | Backend Fastify en modo watch (tsx watch) |
| `pnpm dev:frontend` | Next.js en modo dev en puerto 3000 |
| `pnpm dev:worker` | Worker BullMQ en modo watch |
| `pnpm db:migrate` | Nueva migración Prisma |
| `pnpm db:generate` | Regenerar cliente Prisma |
| `pnpm db:push` | Push schema sin migración (dev rápido) |
| `pnpm db:studio` | Abrir Prisma Studio GUI en puerto 5555 |
| `pnpm build` | Build de producción (tsup + next build) |

---

## 18. Guía de despliegue en producción (EasyPanel)

### Prerrequisitos
1. Repositorio subido a GitHub.
2. EasyPanel instalado en el VPS con Docker.
3. DNS de `crm.kodevon.com` apuntando al VPS.
4. `.env` de producción listo con todos los secrets.
5. Contener EspoCRM existente en el mismo Docker (nombre de red conocido).

### Variables de entorno clave para producción
```env
NODE_ENV=production
FRONTEND_URL=https://crm.kodevon.com
NEXT_PUBLIC_API_URL=https://crm.kodevon.com
DATABASE_URL=postgresql://postgres:<PASS>@kodevon-db:5432/kodevoncrm
REDIS_URL=redis://kodevon-redis:6379
OLLAMA_URL=http://kodevon-ollama:11434
ESPOCRM_URL=http://<nombre-contenedor-espocrm>:80
```

### Pasos

```bash
# En el VPS, clonar el repo
git clone https://github.com/<tu-org>/CRM-interno.git
cd CRM-interno

# Copiar y editar .env de producción
cp .env.example .env
nano .env  # completar todos los valores

# Crear app en EasyPanel → tipo "Docker Compose"
# Apuntar al archivo: docker/docker-compose.prod.yml
# O ejecutar directamente:
docker compose -f docker/docker-compose.prod.yml up -d --build

# Correr migraciones en el contenedor backend
docker exec crm-backend npx prisma migrate deploy

# Crear admin inicial
docker exec crm-backend node dist/scripts/seed.js

# Descargar modelo Ollama en el contenedor (~2GB)
docker exec crm-ollama ollama pull llama3.2:3b
```

### Red Traefik en EasyPanel
- EasyPanel usa la red externa `easypanel` para Traefik.
- Los labels del `docker-compose.prod.yml` ya están configurados para `crm.kodevon.com`.
- SSL se gestiona automáticamente via Let's Encrypt.
- Backend expuesto en `/api` y `/webhooks`. Frontend en `/`.

---

## 19. Credenciales externas pendientes

### Meta (WhatsApp + Instagram + Facebook)

Para usar los 3 canales se necesita **una sola Meta App** de tipo Business.

**Pasos:**
1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear Meta App → tipo Business
3. Agregar producto **WhatsApp** → conectar número de WhatsApp Business
4. Agregar producto **Messenger** → conectar página de Facebook
5. Agregar producto **Instagram Graph API** → conectar cuenta IG
6. Generar Access Token permanente (no temporal)
7. Configurar webhook URL en Meta: `https://crm.kodevon.com/webhooks/meta`
8. Verificar con el token: el valor de `WA_WEBHOOK_VERIFY_TOKEN` del `.env`

**Variables a completar en `.env`:**
```
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_WABA_ID=
WA_WEBHOOK_VERIFY_TOKEN=   ← inventar string único
META_APP_ID=
META_APP_SECRET=
META_PAGE_ID=
META_PAGE_ACCESS_TOKEN=
META_IG_ACCOUNT_ID=
```

### Gmail — Parcialmente listo

Las credenciales OAuth2 ya fueron descargadas como JSON (tipo **Web Application**).

**Pendiente:** Ejecutar el flujo OAuth desde el panel de admin del CRM en producción:
1. Ir a `https://crm.kodevon.com/settings`
2. Sección Gmail → botón "Conectar Gmail"
3. Autorizar en la pantalla de Google
4. El `refresh_token` se guarda automáticamente en `channel_configs` (cifrado)

**Variables a completar en `.env`:**
```
GMAIL_CLIENT_ID=     ← del JSON descargado
GMAIL_CLIENT_SECRET= ← del JSON descargado
GMAIL_EMAIL=         ← la cuenta de Gmail
```
> `GMAIL_REFRESH_TOKEN` en `.env` ya no es necesario — se guarda en DB después del OAuth.

**URL de callback configurada en Google Cloud Console:**
```
https://crm.kodevon.com/api/auth/gmail/callback
```

### EspoCRM
```
ESPOCRM_URL=http://<nombre-contenedor-espocrm>:80
ESPOCRM_API_KEY=   ← EspoCRM Admin → API Keys → generar nueva
```

---

## 20. Roadmap de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Infraestructura Docker, monorepo, Prisma schema, skeleton de apps | ✅ Completa |
| 2 | Backend core: Auth JWT+bcrypt, CRUD usuarios, CRUD leads, API keys | ✅ Completa |
| 3 | Bridge EspoCRM + senders de canales (WA, IG, FB, Gmail) | ✅ Completa |
| 4 | Webhooks Meta unificado + Gmail OAuth flow + envío de mensajes | ✅ Completa |
| 5 | Worker handlers: inbound-message, espocrm-sync, gmail-poll, ai-score, ai-summary | ✅ Completa |
| 6 | Dedup check + notify handler + tipos de notificaciones | ✅ Completa |
| 7 | Frontend completo: login, inbox con chat, leads tabla+pipeline, detail, settings | ✅ Completa |
| 8 | Notificaciones real-time: Web Push API + Socket.io + sonido in-app | ⏳ Pendiente |
| 9 | API HTTP pública: endpoint para leads desde sistemas externos con API key | ⏳ Pendiente |
| 10 | Widget formulario web embebible (script JS + endpoint) | ⏳ Pendiente |

---

## 21. Decisiones técnicas y su razonamiento

| Decisión | Alternativas consideradas | Razón elegida |
|----------|--------------------------|---------------|
| Fastify vs Express | Express, Hono | Fastify es 2x más rápido, tipado nativo, plugins oficiales |
| PostgreSQL vs MySQL | MySQL (EspoCRM usa MySQL) | PostgreSQL más robusto para JSON, arrays, full-text search |
| pnpm vs npm/yarn | npm workspaces, yarn berry | pnpm más eficiente en disco, workspace hoisting más predecible |
| Llama 3.2 3B vs 7B | Mistral 7B, Llama 3.1 8B | 3B cabe en 2GB dejando margen en el VPS de 8GB |
| JWT vs sesiones | Sessions con Redis, Supabase Auth | JWT sin dependencias externas, mínimo recurso |
| BullMQ vs simple async | Kafka, RabbitMQ, simple await | BullMQ sobre Redis ya existente, retry automático, simple |
| tsup vs tsc | tsc, esbuild directo | tsup wrapper de esbuild, configuración mínima |
| Next.js standalone | Docker con node_modules completo | reduce imagen Docker de ~1GB a ~200MB |
| Refresh token rotation | Token fijo | Rotación previene replay attacks |
| SWR vs React Query | React Query, Apollo | SWR más ligero, sin boilerplate, suficiente para este caso |
| Zustand vs Redux | Redux Toolkit, Jotai, Context | Zustand mínimo boilerplate, persist integrado |
| Credenciales Gmail en DB | Variables de entorno | Permite gestión desde UI sin redeployar, cifrado AES-256 |
| Dedup por email OR phone | solo email, solo phone | Mayor cobertura de duplicados reales |
| Ollama en mismo VPS | API OpenAI, Groq | 100% gratuito y privado, sin datos saliendo del VPS |
| Gmail polling vs IMAP push | IMAP IDLE, Google Pub/Sub | Polling simple, sin infraestructura extra, suficiente a 2min |

---

## 22. Reglas de negocio importantes

1. **Score ≥ 8** → automáticamente se dispara: notificación `HOT_LEAD` a todos los agentes + resumen IA generado. Solo se dispara cuando **cruza** el umbral (previousScore < 8 AND newScore ≥ 8).

2. **Deduplicación** → match por email OR teléfono. Al detectar: notificar agentes con datos de ambos leads. Fusión: todas las conversaciones y mensajes pasan al lead principal. Lead fusionado queda `isDuplicate: true`.

3. **Agentes** solo ven leads asignados a ellos. **Admins** ven todos.

4. **API keys** formato: `kv_<96 hex chars>`. Se muestran **UNA SOLA VEZ** al crearse. Límite: 10 por usuario. Solo se almacena el SHA-256.

5. **Refresh tokens** se rotan en cada uso — el token anterior se invalida automáticamente.

6. **scoreLabel** se recalcula automáticamente:
   - 0–3 → COLD
   - 4–7 → WARM
   - 8–10 → HOT

7. **Primer admin** se crea con `seed.ts`: `admin@kodevon.com` / `KodevonCRM@2024!`. **Cambiar inmediatamente en producción.**

8. **EspoCRM** nunca se expone públicamente. Solo el backend y el worker le hacen requests via HTTP a la red Docker interna.

9. **Ollama** tiene límite de 3GB RAM en Docker para no afectar la estabilidad del VPS.

10. **Score por lead** (no por conversación). Si el mismo lead tiene conversaciones en múltiples canales, el score considera los últimos 20 mensajes del historial completo entre todos los canales.

11. **Gmail polling** — cada 2 minutos, solo emails no leídos. Los emails se marcan como leídos después de procesarlos para no procesarlos dos veces.

12. **Deduplicación de mensajes** — en `inbound-message.handler.ts`, si el `externalId` del mensaje ya existe en la tabla `messages`, el job se descarta silenciosamente.

13. **Primer mensaje outbound** → actualiza stage del lead de `NUEVO` a `CONTACTADO` automáticamente.

14. **Notificaciones** — se crean como registros en DB. El badge de notificaciones en el frontend se actualiza cada 30 segundos via SWR. Click en campana marca todas como leídas.

15. **Cifrado de credenciales** de canales (Gmail refresh_token, etc.) — AES-256 con la `ENCRYPTION_KEY` del `.env`. Si esta key cambia, las credenciales almacenadas quedan ilegibles.

---

*Documento mantenido por Claude Code — actualizado en cada fase completada.*
*Última actualización: Fase 7 — Frontend completo.*
