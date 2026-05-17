function getPath(obj, path) {
  if (!path) return undefined;
  const parts = String(path).replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = obj;
  for (const part of parts) {
    if (part === "") continue;
    if (current && Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function applyFieldMap(input, mapping, opts = {}) {
  if (!mapping || typeof mapping !== "object") return input || {};
  const output = {};
  const defaults = opts.defaults && typeof opts.defaults === "object" ? opts.defaults : {};
  const dropEmpty = opts.dropEmpty === true;

  for (const [key, spec] of Object.entries(mapping)) {
    if (spec && typeof spec === "object" && !Array.isArray(spec)) {
      const nested = applyFieldMap(input, spec, opts);
      if (!dropEmpty || Object.keys(nested).length > 0) {
        output[key] = nested;
      }
      continue;
    }

    let value;
    if (typeof spec === "string") {
      value = getPath(input, spec);
    } else {
      value = spec;
    }

    if (value === undefined) {
      const def = defaults[key];
      if (def !== undefined) value = def;
    }

    if (value !== undefined || !dropEmpty) {
      output[key] = value;
    }
  }

  return output;
}

async function resolveFieldMap(client, tenantId, criteria) {
  const {
    kind,
    source,
    form,
    provider,
    messageType
  } = criteria || {};

  const params = [tenantId, kind];
  const filters = [
    "tenant_id=$1",
    "record_type='GATEWAY_MAPPING'",
    "payload->>'kind'=$2"
  ];

  if (source) {
    params.push(source);
    filters.push(`payload->>'source' = $${params.length}`);
  }
  if (form) {
    params.push(form);
    filters.push(`payload->>'form' = $${params.length}`);
  }
  if (provider) {
    params.push(provider);
    filters.push(`payload->>'provider' = $${params.length}`);
  }
  if (messageType) {
    params.push(messageType);
    filters.push(`payload->>'message_type' = $${params.length}`);
  }

  const r = await client.query(
    `
    SELECT id, payload
    FROM eip_core.info_record
    WHERE ${filters.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT 1
    `,
    params
  );
  if (r.rowCount === 0) return null;

  const payload = r.rows[0].payload || {};
  const map = payload.map || payload.mapping || null;
  if (!map) return null;

  return {
    id: r.rows[0].id,
    map,
    defaults: payload.defaults || {},
    dropEmpty: payload.drop_empty === true
  };
}

export { applyFieldMap, resolveFieldMap };
