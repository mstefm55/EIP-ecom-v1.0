BEGIN;

-- ============================================================
-- CRM statuses (reuse SERVICE_OBJECT_STATUS list; no new lists)
-- ============================================================
WITH so_list AS (
  SELECT id
  FROM eip_core.dropdown_list
  WHERE code = 'SERVICE_OBJECT_STATUS'
    AND is_active = true
  ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
  LIMIT 1
)
INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
SELECT so_list.id, v.code, v.label, v.sort_order, true, v.attrs::jsonb
FROM so_list
CROSS JOIN (
  VALUES
    -- CRM_CASE specific values (new/in_progress/on_hold/cancelled already exist in core)
    ('resolved',   'Resolved',   40,  '{"scope":"status","object_type":"CRM_CASE","stage":"done"}'),
    ('closed',     'Closed',     80,  '{"scope":"status","object_type":"CRM_CASE","stage":"done"}'),

    -- CRM_OPPORTUNITY values
    ('qualified',  'Qualified',  20,  '{"scope":"status","object_type":"CRM_OPPORTUNITY","stage":"open"}'),
    ('proposal',   'Proposal',   30,  '{"scope":"status","object_type":"CRM_OPPORTUNITY","stage":"open"}'),
    ('negotiation','Negotiation',40,  '{"scope":"status","object_type":"CRM_OPPORTUNITY","stage":"open"}'),
    ('won',        'Won',        80,  '{"scope":"status","object_type":"CRM_OPPORTUNITY","stage":"done"}'),
    ('lost',       'Lost',       90,  '{"scope":"status","object_type":"CRM_OPPORTUNITY","stage":"done"}')
) AS v(code,label,sort_order,attrs)
WHERE so_list.id IS NOT NULL
ON CONFLICT (list_id, code) DO NOTHING;

-- ============================================================
-- CRM indexes (service_object + task)
-- ============================================================
CREATE INDEX IF NOT EXISTS so_crm_type_status_created_idx
  ON eip_core.service_object (tenant_id, object_type, status, created_at DESC, id)
  WHERE object_type IN ('CRM_INTERACTION','CRM_CASE','CRM_OPPORTUNITY');

CREATE INDEX IF NOT EXISTS task_status_due_idx
  ON eip_core.task (tenant_id, status, due_at);

CREATE INDEX IF NOT EXISTS task_so_status_idx
  ON eip_core.task (tenant_id, service_object_id, status);

COMMIT;
