UPDATE eip_core.process_def pd
SET graph = jsonb_set(
      COALESCE(pd.graph, '{}'::jsonb),
      '{transitions}',
      COALESCE(pd.graph->'transitions', '[]'::jsonb) ||
        $json$[
          {
            "from": "content_published",
            "to": "content_draft",
            "action": "INTAKE",
            "edge_type": "DEFAULT",
            "effects": [
              { "type": "STATUS_SET", "to": "new" },
              { "type": "JSON_MERGE", "target": "service_object", "value": { "workflow": { "stage": "draft", "outcome": "pending_update", "republish_required": true } } }
            ]
          }
        ]$json$::jsonb,
      true
    ),
    updated_at = now()
WHERE pd.code = 'ECOM_STOREFRONT_CONTENT_FLOW'
  AND pd.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(pd.graph->'transitions', '[]'::jsonb)) AS transition
    WHERE transition->>'from' = 'content_published'
      AND transition->>'to' = 'content_draft'
      AND transition->>'action' = 'INTAKE'
  );
