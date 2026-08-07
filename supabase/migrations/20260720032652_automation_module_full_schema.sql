/*
# Automation Module: Complete Database Schema

## Overview
Creates the full database backend for the CreatorOS Automation module including
workflow executions, version history, AI agents, agent runs, scheduled jobs,
webhooks, activity logs, API integrations, and audit logs.

## New Tables

1. **workflow_executions** — Records each run of a workflow with status, node
   results, error info, and timing.
2. **workflow_versions** — Version history for workflows, storing snapshots of
   the full workflow definition (trigger + actions) at each save.
3. **ai_agents** — Persistent AI agent definitions with type, schedule, config,
   and current status.
4. **agent_runs** — Individual execution records for AI agents with logs,
   progress, and timing.
5. **scheduled_jobs** — Generic scheduler table for upcoming/completed/failed/
   running/queued jobs, linked to workflows or agents.
6. **webhooks** — Webhook endpoints (incoming and outgoing) with event types,
   URL, secret, and delivery logs.
7. **activity_logs** — Timeline of all automation activity for debugging and
   audit purposes.
8. **api_integrations** — Third-party API connection records with status,
   credentials metadata, quota, and health.
9. **audit_logs** — Security-relevant change records (who, what, when, before/
   after) for compliance.

## Modified Tables
- **assets** — Added `category`, `is_favorite`, `storage_path`, `updated_at`
  columns to support the Digital Asset Manager features.

## Security
- RLS enabled on every new table.
- 4 owner-scoped CRUD policies (SELECT/INSERT/UPDATE/DELETE) per table using
  `auth.uid() = user_id`.
- All `user_id` columns default to `auth.uid()`.
*/

-- ============================================================
-- 1. workflow_executions
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  trigger_data jsonb DEFAULT '{}'::jsonb,
  node_results jsonb DEFAULT '[]'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);

DROP POLICY IF EXISTS "select_own_workflow_executions" ON workflow_executions;
CREATE POLICY "select_own_workflow_executions" ON workflow_executions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workflow_executions" ON workflow_executions;
CREATE POLICY "insert_own_workflow_executions" ON workflow_executions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workflow_executions" ON workflow_executions;
CREATE POLICY "update_own_workflow_executions" ON workflow_executions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workflow_executions" ON workflow_executions;
CREATE POLICY "delete_own_workflow_executions" ON workflow_executions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 2. workflow_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  name text NOT NULL,
  description text DEFAULT '',
  trigger jsonb DEFAULT '{}'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  change_note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow ON workflow_versions(workflow_id);

DROP POLICY IF EXISTS "select_own_workflow_versions" ON workflow_versions;
CREATE POLICY "select_own_workflow_versions" ON workflow_versions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workflow_versions" ON workflow_versions;
CREATE POLICY "insert_own_workflow_versions" ON workflow_versions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workflow_versions" ON workflow_versions;
CREATE POLICY "update_own_workflow_versions" ON workflow_versions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workflow_versions" ON workflow_versions;
CREATE POLICY "delete_own_workflow_versions" ON workflow_versions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 3. ai_agents
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'research',
  description text DEFAULT '',
  config jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'idle',
  current_task text,
  progress integer NOT NULL DEFAULT 0,
  schedule text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);

DROP POLICY IF EXISTS "select_own_ai_agents" ON ai_agents;
CREATE POLICY "select_own_ai_agents" ON ai_agents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_ai_agents" ON ai_agents;
CREATE POLICY "insert_own_ai_agents" ON ai_agents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_ai_agents" ON ai_agents;
CREATE POLICY "update_own_ai_agents" ON ai_agents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_ai_agents" ON ai_agents;
CREATE POLICY "delete_own_ai_agents" ON ai_agents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 4. agent_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  task text,
  logs jsonb DEFAULT '[]'::jsonb,
  result jsonb,
  error_message text,
  progress integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);

DROP POLICY IF EXISTS "select_own_agent_runs" ON agent_runs;
CREATE POLICY "select_own_agent_runs" ON agent_runs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_agent_runs" ON agent_runs;
CREATE POLICY "insert_own_agent_runs" ON agent_runs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_agent_runs" ON agent_runs;
CREATE POLICY "update_own_agent_runs" ON agent_runs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_agent_runs" ON agent_runs;
CREATE POLICY "delete_own_agent_runs" ON agent_runs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 5. scheduled_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  workflow_id uuid REFERENCES workflows(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 5,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  error_message text,
  result jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_for ON scheduled_jobs(scheduled_for);

DROP POLICY IF EXISTS "select_own_scheduled_jobs" ON scheduled_jobs;
CREATE POLICY "select_own_scheduled_jobs" ON scheduled_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_scheduled_jobs" ON scheduled_jobs;
CREATE POLICY "insert_own_scheduled_jobs" ON scheduled_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_scheduled_jobs" ON scheduled_jobs;
CREATE POLICY "update_own_scheduled_jobs" ON scheduled_jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_scheduled_jobs" ON scheduled_jobs;
CREATE POLICY "delete_own_scheduled_jobs" ON scheduled_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 6. webhooks
-- ============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  event_types text[] DEFAULT '{}'::text[],
  secret text,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  last_status text,
  last_response_code integer,
  delivery_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_webhooks" ON webhooks;
CREATE POLICY "select_own_webhooks" ON webhooks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_webhooks" ON webhooks;
CREATE POLICY "insert_own_webhooks" ON webhooks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_webhooks" ON webhooks;
CREATE POLICY "update_own_webhooks" ON webhooks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_webhooks" ON webhooks;
CREATE POLICY "delete_own_webhooks" ON webhooks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 7. activity_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  module text NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb DEFAULT '{}'::jsonb,
  level text NOT NULL DEFAULT 'info',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);

DROP POLICY IF EXISTS "select_own_activity_logs" ON activity_logs;
CREATE POLICY "select_own_activity_logs" ON activity_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_activity_logs" ON activity_logs;
CREATE POLICY "insert_own_activity_logs" ON activity_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_activity_logs" ON activity_logs;
CREATE POLICY "update_own_activity_logs" ON activity_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_activity_logs" ON activity_logs;
CREATE POLICY "delete_own_activity_logs" ON activity_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 8. api_integrations
-- ============================================================
CREATE TABLE IF NOT EXISTS api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'not_configured',
  credentials jsonb DEFAULT '{}'::jsonb,
  quota_used integer DEFAULT 0,
  quota_limit integer,
  rate_limit_remaining integer,
  last_sync_at timestamptz,
  health_status text DEFAULT 'unknown',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE api_integrations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_api_integrations_provider ON api_integrations(provider);

DROP POLICY IF EXISTS "select_own_api_integrations" ON api_integrations;
CREATE POLICY "select_own_api_integrations" ON api_integrations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_api_integrations" ON api_integrations;
CREATE POLICY "insert_own_api_integrations" ON api_integrations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_api_integrations" ON api_integrations;
CREATE POLICY "update_own_api_integrations" ON api_integrations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_api_integrations" ON api_integrations;
CREATE POLICY "delete_own_api_integrations" ON api_integrations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 9. audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_audit_logs" ON audit_logs;
CREATE POLICY "insert_own_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_audit_logs" ON audit_logs;
CREATE POLICY "update_own_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_audit_logs" ON audit_logs;
CREATE POLICY "delete_own_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 10. Add columns to assets table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='category') THEN
    ALTER TABLE assets ADD COLUMN category text NOT NULL DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='is_favorite') THEN
    ALTER TABLE assets ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='storage_path') THEN
    ALTER TABLE assets ADD COLUMN storage_path text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='updated_at') THEN
    ALTER TABLE assets ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='thumbnail_url') THEN
    ALTER TABLE assets ADD COLUMN thumbnail_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='assets' AND column_name='is_deleted') THEN
    ALTER TABLE assets ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_assets_is_deleted ON assets(is_deleted);
CREATE INDEX IF NOT EXISTS idx_assets_is_favorite ON assets(is_favorite);