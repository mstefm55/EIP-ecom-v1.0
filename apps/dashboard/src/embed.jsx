import React from "react";
import { createRoot } from "react-dom/client";
import { EngineRenderer } from "./engine/renderer";
import { registry } from "./engine/registry.jsx";
import { translateData } from "./engine/bindings";

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response.json();
}

function buildUrl(base, path, apiKey, useQueryKey) {
  const url = new URL(path, base);
  if (useQueryKey && apiKey) {
    url.searchParams.set("api_key", apiKey);
  }
  return url.toString();
}

async function loadManifest(context) {
  const {
    serverUrl,
    templateCode,
    objectId,
    apiKey,
    apiKeyMode,
  } = context;

  const useQueryKey = apiKeyMode === "query";
  const headers = !useQueryKey && apiKey ? { "X-API-Key": apiKey } : undefined;

  const bootstrapUrl = buildUrl(
    serverUrl,
    `/api/public/gateway/bootstrap?template_code=${encodeURIComponent(templateCode || "")}`,
    apiKey,
    useQueryKey
  );
  const bootstrap = await fetchJson(bootstrapUrl, { headers, credentials: "omit" });

  const manifestPath = objectId
    ? `/api/public/gateway/manifest/${encodeURIComponent(templateCode)}/${encodeURIComponent(objectId)}`
    : `/api/public/gateway/manifest/${encodeURIComponent(templateCode)}`;
  const manifestUrl = buildUrl(serverUrl, manifestPath, apiKey, useQueryKey);
  const manifest = await fetchJson(manifestUrl, { headers, credentials: "omit" });

  return { bootstrap, manifest };
}

function renderEmbed(context, payload) {
  const mount = context.mount;
  if (!mount) return;
  const rawData = {
    tenant: payload.manifest?.tenant || payload.bootstrap?.tenant || null,
    object: payload.manifest?.data?.object || null,
  };
  const dictionary =
    payload.manifest?.dictionary ||
    payload.bootstrap?.dictionary ||
    {};
  const translated = translateData(rawData, dictionary);

  const ctx = {
    data: {
      context: translated,
      raw: rawData,
      dictionary,
    },
    tenant: rawData.tenant,
  };

  const surface = payload.manifest?.surface;
  if (!surface?.tree) {
    mount.innerHTML = "<div style='padding:16px;font-family:sans-serif'>No template found.</div>";
    return;
  }

  createRoot(mount).render(
    <EngineRenderer surface={surface} registry={registry} ctx={ctx} />
  );
}

async function boot() {
  const context = window.__EIP_CONTEXT__ || {};
  if (!context.mount || !context.serverUrl || !context.templateCode) return;

  try {
    const payload = await loadManifest(context);
    renderEmbed(context, payload);
  } catch (error) {
    const mount = context.mount;
    if (mount) {
      mount.innerHTML = `<div style="padding:16px;font-family:sans-serif;color:#b91c1c;">${error.message || "Embed failed"}</div>`;
    }
  }
}

boot();
