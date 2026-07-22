import { supabase } from './supabase-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, string>;
}

export interface WorkflowRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  trigger: WorkflowNode | Record<string, unknown>;
  actions: WorkflowNode[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkflowExecutionRow {
  id: string;
  user_id: string;
  workflow_id: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  trigger_data: Record<string, unknown>;
  node_results: Array<Record<string, unknown>>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  retry_count: number;
  created_at: string;
}

export interface WorkflowVersionRow {
  id: string;
  user_id: string;
  workflow_id: string;
  version_number: number;
  name: string;
  description: string;
  trigger: WorkflowNode | Record<string, unknown>;
  actions: WorkflowNode[];
  change_note: string | null;
  created_at: string;
}

export interface AIAgentRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string;
  config: Record<string, unknown>;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'error';
  current_task: string | null;
  progress: number;
  schedule: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunRow {
  id: string;
  user_id: string;
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  task: string | null;
  logs: Array<{ time: string; level: string; message: string }>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ScheduledJobRow {
  id: string;
  user_id: string;
  name: string;
  workflow_id: string | null;
  agent_id: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
}

export interface WebhookRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  event_types: string[];
  secret: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  last_status: string | null;
  last_response_code: number | null;
  delivery_count: number;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRow {
  id: string;
  user_id: string;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  level: 'info' | 'warning' | 'error' | 'success';
  created_at: string;
}

export interface ApiIntegrationRow {
  id: string;
  user_id: string;
  provider: string;
  name: string;
  status: 'connected' | 'not_configured' | 'error' | 'disconnected';
  credentials: Record<string, unknown>;
  quota_used: number;
  quota_limit: number | null;
  rate_limit_remaining: number | null;
  last_sync_at: string | null;
  health_status: 'healthy' | 'degraded' | 'down' | 'unknown';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface TeamMemberRow {
  id: string;
  user_id: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'member';
  status: 'active' | 'pending' | 'suspended';
  invited_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: string | null;
  created_at: string;
}

export interface AssetRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  url: string;
  size_bytes: number;
  category: string;
  storage_path: string | null;
  thumbnail_url: string | null;
  is_favorite: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export async function fetchWorkflows(): Promise<WorkflowRow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkflowRow[];
}

export async function insertWorkflow(row: {
  name: string;
  description?: string;
  trigger?: WorkflowNode | Record<string, unknown>;
  actions?: WorkflowNode[];
  enabled?: boolean;
}): Promise<WorkflowRow> {
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      name: row.name,
      description: row.description ?? '',
      trigger: row.trigger ?? {},
      actions: row.actions ?? [],
      enabled: row.enabled ?? false,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WorkflowRow;
}

export async function updateWorkflow(
  id: string,
  updates: Partial<WorkflowRow>,
): Promise<WorkflowRow> {
  const { data, error } = await supabase
    .from('workflows')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WorkflowRow;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase.from('workflows').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function duplicateWorkflow(id: string): Promise<WorkflowRow> {
  const { data: orig, error: fetchErr } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  const { data, error } = await supabase
    .from('workflows')
    .insert({
      name: `${orig.name} (copy)`,
      description: orig.description,
      trigger: orig.trigger,
      actions: orig.actions,
      enabled: false,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WorkflowRow;
}

// ─── Workflow Executions ─────────────────────────────────────────────────────

export async function fetchExecutions(
  workflowId?: string,
  limit = 50,
): Promise<WorkflowExecutionRow[]> {
  let query = supabase
    .from('workflow_executions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (workflowId) query = query.eq('workflow_id', workflowId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkflowExecutionRow[];
}

export async function insertExecution(row: {
  workflow_id?: string;
  status?: string;
  trigger_data?: Record<string, unknown>;
  started_at?: string;
}): Promise<WorkflowExecutionRow> {
  const { data, error } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: row.workflow_id ?? null,
      status: row.status ?? 'pending',
      trigger_data: row.trigger_data ?? {},
      started_at: row.started_at ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WorkflowExecutionRow;
}

export async function updateExecution(
  id: string,
  updates: Partial<WorkflowExecutionRow>,
): Promise<WorkflowExecutionRow> {
  const { data, error } = await supabase
    .from('workflow_executions')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WorkflowExecutionRow;
}

export async function deleteExecution(id: string): Promise<void> {
  const { error } = await supabase.from('workflow_executions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Workflow Versions ──────────────────────────────────────────────────────

export async function fetchVersions(workflowId: string): Promise<WorkflowVersionRow[]> {
  const { data, error } = await supabase
    .from('workflow_versions')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('version_number', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkflowVersionRow[];
}

export async function insertVersion(row: {
  workflow_id: string;
  version_number: number;
  name: string;
  description: string;
  trigger: WorkflowNode | Record<string, unknown>;
  actions: WorkflowNode[];
  change_note?: string;
}): Promise<WorkflowVersionRow> {
  const { data, error } = await supabase
    .from('workflow_versions')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WorkflowVersionRow;
}

export async function deleteVersion(id: string): Promise<void> {
  const { error } = await supabase.from('workflow_versions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── AI Agents ───────────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<AIAgentRow[]> {
  const { data, error } = await supabase
    .from('ai_agents')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AIAgentRow[];
}

export async function insertAgent(row: {
  name: string;
  type: string;
  description?: string;
  config?: Record<string, unknown>;
  schedule?: string;
}): Promise<AIAgentRow> {
  const { data, error } = await supabase
    .from('ai_agents')
    .insert({
      name: row.name,
      type: row.type,
      description: row.description ?? '',
      config: row.config ?? {},
      schedule: row.schedule ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AIAgentRow;
}

export async function updateAgent(
  id: string,
  updates: Partial<AIAgentRow>,
): Promise<AIAgentRow> {
  const { data, error } = await supabase
    .from('ai_agents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AIAgentRow;
}

export async function deleteAgent(id: string): Promise<void> {
  const { error } = await supabase.from('ai_agents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Agent Runs ──────────────────────────────────────────────────────────────

export async function fetchAgentRuns(agentId?: string, limit = 50): Promise<AgentRunRow[]> {
  let query = supabase
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (agentId) query = query.eq('agent_id', agentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRunRow[];
}

export async function insertAgentRun(row: {
  agent_id: string;
  status?: string;
  task?: string;
  started_at?: string;
}): Promise<AgentRunRow> {
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      agent_id: row.agent_id,
      status: row.status ?? 'pending',
      task: row.task ?? null,
      started_at: row.started_at ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AgentRunRow;
}

export async function updateAgentRun(
  id: string,
  updates: Partial<AgentRunRow>,
): Promise<AgentRunRow> {
  const { data, error } = await supabase
    .from('agent_runs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AgentRunRow;
}

export async function deleteAgentRun(id: string): Promise<void> {
  const { error } = await supabase.from('agent_runs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Scheduled Jobs ──────────────────────────────────────────────────────────

export async function fetchJobs(status?: string, limit = 100): Promise<ScheduledJobRow[]> {
  let query = supabase
    .from('scheduled_jobs')
    .select('*')
    .order('scheduled_for', { ascending: false })
    .limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ScheduledJobRow[];
}

export async function insertJob(row: {
  name: string;
  workflow_id?: string;
  agent_id?: string;
  scheduled_for?: string;
  priority?: number;
  max_retries?: number;
}): Promise<ScheduledJobRow> {
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .insert({
      name: row.name,
      workflow_id: row.workflow_id ?? null,
      agent_id: row.agent_id ?? null,
      scheduled_for: row.scheduled_for ?? new Date().toISOString(),
      priority: row.priority ?? 5,
      max_retries: row.max_retries ?? 3,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ScheduledJobRow;
}

export async function updateJob(
  id: string,
  updates: Partial<ScheduledJobRow>,
): Promise<ScheduledJobRow> {
  const { data, error } = await supabase
    .from('scheduled_jobs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ScheduledJobRow;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from('scheduled_jobs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export async function fetchWebhooks(): Promise<WebhookRow[]> {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WebhookRow[];
}

export async function insertWebhook(row: {
  name: string;
  url: string;
  event_types?: string[];
  secret?: string;
}): Promise<WebhookRow> {
  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      name: row.name,
      url: row.url,
      event_types: row.event_types ?? [],
      secret: row.secret ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WebhookRow;
}

export async function updateWebhook(
  id: string,
  updates: Partial<WebhookRow>,
): Promise<WebhookRow> {
  const { data, error } = await supabase
    .from('webhooks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as WebhookRow;
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await supabase.from('webhooks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Activity Logs ───────────────────────────────────────────────────────────

export async function fetchActivityLogs(
  module?: string,
  limit = 100,
): Promise<ActivityLogRow[]> {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (module) query = query.eq('module', module);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLogRow[];
}

export async function insertActivityLog(row: {
  module: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  level?: string;
}): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    module: row.module,
    action: row.action,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    details: row.details ?? {},
    level: row.level ?? 'info',
  });
  if (error) throw new Error(error.message);
}

export async function deleteActivityLog(id: string): Promise<void> {
  const { error } = await supabase.from('activity_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── API Integrations ────────────────────────────────────────────────────────

export async function fetchIntegrations(): Promise<ApiIntegrationRow[]> {
  const { data, error } = await supabase
    .from('api_integrations')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiIntegrationRow[];
}

export async function upsertIntegration(row: {
  provider: string;
  name: string;
  status?: string;
  credentials?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<ApiIntegrationRow> {
  const { data: existing } = await supabase
    .from('api_integrations')
    .select('*')
    .eq('provider', row.provider)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('api_integrations')
      .update({
        name: row.name,
        status: row.status ?? existing.status,
        credentials: row.credentials ?? existing.credentials,
        metadata: row.metadata ?? existing.metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as ApiIntegrationRow;
  }

  const { data, error } = await supabase
    .from('api_integrations')
    .insert({
      provider: row.provider,
      name: row.name,
      status: row.status ?? 'not_configured',
      credentials: row.credentials ?? {},
      metadata: row.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ApiIntegrationRow;
}

export async function updateIntegration(
  id: string,
  updates: Partial<ApiIntegrationRow>,
): Promise<ApiIntegrationRow> {
  const { data, error } = await supabase
    .from('api_integrations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ApiIntegrationRow;
}

export async function deleteIntegration(id: string): Promise<void> {
  const { error } = await supabase.from('api_integrations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export async function fetchAuditLogs(limit = 100): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLogRow[];
}

export async function insertAuditLog(row: {
  action: string;
  entity_type?: string;
  entity_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    action: row.action,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    before_state: row.before_state ?? null,
    after_state: row.after_state ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Team Members ────────────────────────────────────────────────────────────

export async function fetchTeamMembers(): Promise<TeamMemberRow[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('invited_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMemberRow[];
}

export async function insertTeamMember(row: {
  email: string;
  role?: string;
}): Promise<TeamMemberRow> {
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      email: row.email,
      role: row.role ?? 'member',
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TeamMemberRow;
}

export async function updateTeamMember(
  id: string,
  updates: Partial<TeamMemberRow>,
): Promise<TeamMemberRow> {
  const { data, error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as TeamMemberRow;
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export async function fetchApiKeys(): Promise<ApiKeyRow[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiKeyRow[];
}

export async function insertApiKey(name: string): Promise<{ key: string; row: ApiKeyRow }> {
  const rawKey = `cko_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = await hashString(rawKey);

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ name, key_prefix: keyPrefix, key_hash: keyHash })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return { key: rawKey, row: data as ApiKeyRow };
}

export async function deleteApiKey(id: string): Promise<void> {
  const { error } = await supabase.from('api_keys').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export async function fetchAssets(category?: string, includeDeleted = false): Promise<AssetRow[]> {
  let query = supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false });
  if (!includeDeleted) query = query.eq('is_deleted', false);
  if (category && category !== 'all') query = query.eq('category', category);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AssetRow[];
}

export async function insertAsset(row: {
  name: string;
  type: string;
  url: string;
  size_bytes?: number;
  category?: string;
  storage_path?: string;
  thumbnail_url?: string;
}): Promise<AssetRow> {
  const { data, error } = await supabase
    .from('assets')
    .insert({
      name: row.name,
      type: row.type,
      url: row.url,
      size_bytes: row.size_bytes ?? 0,
      category: row.category ?? 'general',
      storage_path: row.storage_path ?? null,
      thumbnail_url: row.thumbnail_url ?? null,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AssetRow;
}

export async function updateAsset(
  id: string,
  updates: Partial<AssetRow>,
): Promise<AssetRow> {
  const { data, error } = await supabase
    .from('assets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AssetRow;
}

export async function deleteAsset(id: string, permanent = false): Promise<void> {
  if (permanent) {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('assets')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}

export async function restoreAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from('assets')
    .update({ is_deleted: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

const BUCKET = 'creatoros-assets';

export async function uploadAssetFile(
  file: File,
  subdir: string = 'assets',
): Promise<{ url: string; path: string }> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${userId}/${subdir}/${Date.now()}-${file.name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteStorageFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

export async function getStorageUsage(): Promise<{
  totalBytes: number;
  fileCount: number;
  byCategory: Record<string, number>;
}> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const { data, error } = await supabase.storage.from(BUCKET).list(`${userId}/`, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error) throw new Error(error.message);

  const files = data ?? [];
  const totalBytes = files.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);
  return {
    totalBytes,
    fileCount: files.length,
    byCategory: {},
  };
}
