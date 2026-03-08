-- Migration: init
-- KodevonCRM — Schema completo

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT', 'AI_AGENT');
CREATE TYPE "LeadStage" AS ENUM ('NUEVO', 'CONTACTADO', 'CALIFICADO', 'PROPUESTA', 'NEGOCIACION', 'CERRADO_GANADO', 'CERRADO_PERDIDO');
CREATE TYPE "ScoreLabel" AS ENUM ('COLD', 'WARM', 'HOT');
CREATE TYPE "Channel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'EMAIL', 'FORM', 'API');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'PENDING');
CREATE TYPE "NotificationType" AS ENUM ('NEW_LEAD', 'HOT_LEAD', 'NEW_MESSAGE', 'DUPLICATE_DETECTED', 'MERGE_SUGGESTION');

-- CreateTable: users
CREATE TABLE "users" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role"          "UserRole" NOT NULL DEFAULT 'AGENT',
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "avatar_url"    TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: leads
CREATE TABLE "leads" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "email"          TEXT,
    "phone"          TEXT,
    "company"        TEXT,
    "source_channel" "Channel" NOT NULL,
    "stage"          "LeadStage" NOT NULL DEFAULT 'NUEVO',
    "score"          INTEGER NOT NULL DEFAULT 0,
    "score_label"    "ScoreLabel" NOT NULL DEFAULT 'COLD',
    "espocrm_id"     TEXT,
    "assigned_to_id" TEXT,
    "notes"          TEXT,
    "metadata"       JSONB,
    "is_duplicate"   BOOLEAN NOT NULL DEFAULT false,
    "merged_into_id" TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: conversations
CREATE TABLE "conversations" (
    "id"          TEXT NOT NULL,
    "lead_id"     TEXT NOT NULL,
    "channel"     "Channel" NOT NULL,
    "external_id" TEXT,
    "status"      "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: messages
CREATE TABLE "messages" (
    "id"              TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction"       "MessageDirection" NOT NULL,
    "content"         TEXT NOT NULL,
    "content_type"    TEXT NOT NULL DEFAULT 'text',
    "metadata"        JSONB,
    "external_id"     TEXT,
    "sent_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ai_scores
CREATE TABLE "ai_scores" (
    "id"          TEXT NOT NULL,
    "lead_id"     TEXT NOT NULL,
    "score"       INTEGER NOT NULL,
    "label"       "ScoreLabel" NOT NULL,
    "summary"     TEXT,
    "factors"     JSONB,
    "trigger_msg" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable: api_keys
CREATE TABLE "api_keys" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "key_hash"   TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "last_used"  TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "lead_id"    TEXT,
    "type"       "NotificationType" NOT NULL,
    "payload"    JSONB NOT NULL,
    "read"       BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: channel_configs
CREATE TABLE "channel_configs" (
    "id"          TEXT NOT NULL,
    "channel"     "Channel" NOT NULL,
    "credentials" JSONB NOT NULL,
    "active"      BOOLEAN NOT NULL DEFAULT false,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "token_hash"  TEXT NOT NULL,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: push_subscriptions
CREATE TABLE "push_subscriptions" (
    "id"         TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "endpoint"   TEXT NOT NULL,
    "p256dh"     TEXT NOT NULL,
    "auth"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "users_email_key"                   ON "users"("email");
CREATE UNIQUE INDEX "api_keys_key_hash_key"             ON "api_keys"("key_hash");
CREATE UNIQUE INDEX "channel_configs_channel_key"       ON "channel_configs"("channel");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key"     ON "refresh_tokens"("token_hash");
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key"   ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "leads_email_idx"                 ON "leads"("email");
CREATE INDEX "leads_phone_idx"                 ON "leads"("phone");
CREATE INDEX "leads_stage_idx"                 ON "leads"("stage");
CREATE INDEX "leads_score_label_idx"           ON "leads"("score_label");
CREATE INDEX "leads_assigned_to_id_idx"        ON "leads"("assigned_to_id");
CREATE INDEX "leads_created_at_idx"            ON "leads"("created_at");
CREATE INDEX "conversations_lead_id_idx"       ON "conversations"("lead_id");
CREATE INDEX "conversations_external_id_idx"   ON "conversations"("external_id");
CREATE INDEX "conversations_channel_idx"       ON "conversations"("channel");
CREATE INDEX "messages_conversation_id_idx"    ON "messages"("conversation_id");
CREATE INDEX "messages_sent_at_idx"            ON "messages"("sent_at");
CREATE INDEX "ai_scores_lead_id_idx"           ON "ai_scores"("lead_id");
CREATE INDEX "ai_scores_created_at_idx"        ON "ai_scores"("created_at");
CREATE INDEX "notifications_user_id_read_idx"  ON "notifications"("user_id", "read");
CREATE INDEX "notifications_created_at_idx"    ON "notifications"("created_at");
CREATE INDEX "refresh_tokens_user_id_idx"      ON "refresh_tokens"("user_id");
CREATE INDEX "push_subscriptions_user_id_idx"  ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "leads"
    ADD CONSTRAINT "leads_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leads"
    ADD CONSTRAINT "leads_merged_into_id_fkey"
    FOREIGN KEY ("merged_into_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_scores"
    ADD CONSTRAINT "ai_scores_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
