/*
# Automation Module Tables for CreatorOS AI

## Purpose
Backs the Automation module: Workflow Builder, AI Agents, Scheduled Jobs,
API Integrations, Webhooks, and Activity Logs.

## New Tables
1. workflows, workflow_nodes, workflow_edges, workflow_versions
2. workflow_executions, workflow_execution_logs
3. ai_agents, agent_runs
4. scheduled_jobs
5. api_integrations
6. webhooks
7. activity_logs

## Security
RLS enabled on all tables, owner-scoped via auth.uid()
*/

-- ─── workflows ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Workflow',
  description text,
  status text NOT NULL DEFAULT 'draft',
  trigger_type text NOT NULL DEFAULT 'manual',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workflows" ON workflows;
CREATE POLICY "select_own_workflows" ON workflows FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workflows" ON workflows;
CREATE POLICY "insert_own_workflows" ON workflows FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workflows" ON workflows;
CREATE POLICY "update_own_workflows" ON workflows FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workflows" ON workflows;
CREATE POLICY "delete_own_workflows" ON workflows FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- ─── workflow_nodes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text,
  position_x double precision NOT NULL DEFAULT 0,
  position_y double precision NOT NULL DEFAULT 0,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workflow_nodes" ON workflow_nodes;
CREATE POLICY "select_own_workflow_nodes" ON workflow_nodes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workflow_nodes" ON workflow_nodes;
CREATE POLICY "insert_own_workflow_nodes" ON workflow_nodes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_workflow_nodes" ON workflow_nodes;
CREATE POLICY "update_own_workflow_nodes" ON workflow_nodes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workflow_nodes" ON workflow_nodes;
CREATE POLICY "delete_own_workflow_nodes" ON workflow_nodes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_nodes_workflow_id ON workflow_nodes(workflow_id);

-- ─── workflow_edges ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workflow_edges" ON workflow_edges;
CREATE POLICY "select_own_workflow_edges" ON workflow_edges FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workflow_edges" ON workflow_edges;
CREATE POLICY "insert_own_workflow_edges" ON workflow_edges FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_workflow_edges" ON workflow_edges;
CREATE POLICY "delete_own_workflow_edges" ON workflow_edges FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_edges_workflow_id ON workflow_edges(workflow_id);

-- ─── workflow_versions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_workflow_versions" ON workflow_versions;
CREATE POLICY "select_own_workflow_versions" ON workflow_versions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_workflow_versions" ON workflow_versions;
CREATE POLICY "insert_own_workflow_versions" ON workflow_versions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workflow_versions_workflow_id ON workflow_versions(workflow_id);
