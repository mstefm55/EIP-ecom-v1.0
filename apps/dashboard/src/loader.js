(function () {
  const SCRIPT_ID = "eip-loader-script";
  const scriptTag = document.getElementById(SCRIPT_ID) || document.currentScript;
  if (!scriptTag) return;

  const tenantCode = scriptTag.getAttribute("data-tenant") || "";
  const templateCode = scriptTag.getAttribute("data-template") || "";
  const objectId = scriptTag.getAttribute("data-object") || "";
  const targetSelector = scriptTag.getAttribute("data-target") || "body";
  const serverUrl = scriptTag.getAttribute("data-server") || "";
  const apiKey = scriptTag.getAttribute("data-api-key") || "";
  const apiKeyMode = scriptTag.getAttribute("data-api-key-mode") || "header";
  const cssUrl = scriptTag.getAttribute("data-css") || `${serverUrl}/src/index.css`;
  const entryUrl = scriptTag.getAttribute("data-entry") || `${serverUrl}/src/embed.jsx`;

  if (!serverUrl || !templateCode) return;

  const hostElement = document.querySelector(targetSelector) || document.body;
  const shadowRoot = hostElement.attachShadow({ mode: "open" });

  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = cssUrl;
  shadowRoot.appendChild(styleLink);

  const mount = document.createElement("div");
  mount.id = "eip-embed-root";
  shadowRoot.appendChild(mount);

  window.__EIP_CONTEXT__ = {
    tenantCode,
    templateCode,
    objectId,
    serverUrl,
    apiKey,
    apiKeyMode,
    mount,
  };

  const existing = document.querySelector(`script[data-eip-entry="${entryUrl}"]`);
  if (existing) return;

  const mainScript = document.createElement("script");
  mainScript.type = "module";
  mainScript.src = entryUrl;
  mainScript.setAttribute("data-eip-entry", entryUrl);
  document.body.appendChild(mainScript);
})();
