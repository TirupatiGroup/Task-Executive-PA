-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('PRIMARY_USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "task_type" AS ENUM ('PERSONAL', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "activity_entity_type" AS ENUM ('TASK', 'PERSON', 'FOLLOW_UP', 'CALENDAR', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "activity_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'COMPLETE', 'REOPEN', 'CANCEL', 'FOLLOW_UP_ADD', 'ARCHIVE', 'RESTORE', 'ASSIGN', 'LOGIN', 'SYNC');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('TASK_DEADLINE', 'FOLLOW_UP_DUE', 'MEETING_REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "notification_severity" AS ENUM ('INFO', 'WARNING', 'URGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "microsoft_oid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'PRIMARY_USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" "task_type" NOT NULL DEFAULT 'PERSONAL',
    "assignee_id" TEXT,
    "priority" "task_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "task_status" NOT NULL DEFAULT 'NOT_STARTED',
    "assigned_date" TIMESTAMP(3),
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "follow_up_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "next_follow_up_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "entity_type" "activity_entity_type" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "activity_action" NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "graph_calendar_id" TEXT,
    "owner_email_address" TEXT,
    "calendar_label" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sync_status" TEXT NOT NULL DEFAULT 'NEVER_SYNCED',
    "last_sync_attempt_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "graph_event_id" TEXT NOT NULL,
    "graph_calendar_id" TEXT,
    "subject" TEXT,
    "body_preview" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "time_zone" TEXT,
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "organizer_name" TEXT,
    "organizer_email" TEXT,
    "online_meeting_url" TEXT,
    "last_modified_at" TIMESTAMP(3),
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "severity" "notification_severity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "link_path" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "lead_minutes" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "snoozed_until" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "briefing_time" TEXT NOT NULL DEFAULT '08:00',
    "briefing_enabled" BOOLEAN NOT NULL DEFAULT true,
    "default_task_lead_hours" INTEGER NOT NULL DEFAULT 24,
    "default_follow_up_lead_hours" INTEGER NOT NULL DEFAULT 24,
    "default_meeting_lead_minutes" INTEGER NOT NULL DEFAULT 15,
    "browser_notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "voice_enabled" BOOLEAN NOT NULL DEFAULT true,
    "speech_rate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "speech_pitch" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_microsoft_oid_key" ON "users"("microsoft_oid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "people_is_active_idx" ON "people"("is_active");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_due_date_idx" ON "tasks"("due_date");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_task_type_idx" ON "tasks"("task_type");

-- CreateIndex
CREATE INDEX "tasks_created_by_id_idx" ON "tasks"("created_by_id");

-- CreateIndex
CREATE INDEX "follow_ups_task_id_idx" ON "follow_ups"("task_id");

-- CreateIndex
CREATE INDEX "follow_ups_next_follow_up_at_idx" ON "follow_ups"("next_follow_up_at");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_user_id_key" ON "calendar_connections"("user_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_start_at_idx" ON "calendar_events"("user_id", "start_at");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_user_id_graph_event_id_key" ON "calendar_events"("user_id", "graph_event_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "reminders_remind_at_is_enabled_idx" ON "reminders"("remind_at", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
