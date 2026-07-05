import crypto from "node:crypto";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
const CANDIDATE_TAGS = new Set([
  "header", "nav", "main", "section", "article", "aside", "footer", "form", "div",
  "ul", "ol", "li", "picture", "img", "video", "button", "a", "h1", "h2", "h3", "p"
]);
const SAFE_RENDERERS = new Set([
  "hero",
  "hero_slider",
  "banner",
  "product_carousel",
  "editorial_card_grid",
  "rich_text_block",
  "cta_block",
  "newsletter_form",
  "product_grid",
  "navigation",
  "footer_block",
  "media_gallery",
  "video_section",
  "product_detail",
  "text_image",
  "faq",
  "custom",
  "testimonial_grid",
  "feature_block",
  "unknown"
]);
const MAPPING_STATUSES = new Set(["proposed", "approved", "ignored", "needs_review"]);
const SINGLETON_SLOT_RENDERERS = new Set([
  "hero_slider",
  "product_carousel",
  "newsletter_form",
  "navigation",
  "footer_block",
  "media_gallery",
  "testimonial_grid"
]);
const SENSITIVE_TEXT = /\b(password|passwd|secret|token|api[-_ ]?key|authorization|cookie|session|credential|private[-_ ]?key)\b/gi;
const SENSITIVE_ZONE = /\b(login|log-in|signin|sign-in|account|profile|password|checkout|payment|card|billing|authentication|register|signup|sign-up)\b/i;
const SAFE_CLASS = /^[a-z_][a-z0-9_-]{1,80}$/i;

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSlot(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 80);
}

function normalizeRenderer(value, fallback = "unknown") {
  const renderer = normalizeText(value).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return SAFE_RENDERERS.has(renderer) ? renderer : fallback;
}

function normalizeMappingStatus(value, fallback = "proposed") {
  const status = normalizeText(value).toLowerCase();
  return MAPPING_STATUSES.has(status) ? status : fallback;
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function safeSample(value, maxLength = 160) {
  return normalizeText(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(SENSITIVE_TEXT, "[redacted]")
    .slice(0, maxLength);
}

function parseAttributes(raw) {
  const attrs = {};
  const regex = /([:@a-zA-Z_][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of String(raw || "").matchAll(regex)) {
    const key = normalizeText(match[1]).toLowerCase();
    if (!key) continue;
    attrs[key] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attrs;
}

function parseStaticHtml(html) {
  const root = { tag: "document", attrs: {}, children: [], text: "", parent: null, index: 0 };
  const clean = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ");
  const stack = [root];
  const token = /<\/?([a-z0-9-]+)\b([^>]*)>/gi;
  let cursor = 0;
  let sequence = 0;
  for (const match of clean.matchAll(token)) {
    const current = stack[stack.length - 1];
    if (current && match.index > cursor) current.text += ` ${clean.slice(cursor, match.index)}`;
    cursor = Number(match.index || 0) + match[0].length;
    const tag = normalizeText(match[1]).toLowerCase();
    const closing = /^<\//.test(match[0]);
    if (closing) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const parent = stack[stack.length - 1];
    const node = {
      tag,
      attrs: parseAttributes(match[2]),
      children: [],
      text: "",
      parent,
      index: sequence
    };
    sequence += 1;
    parent.children.push(node);
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(match[0])) stack.push(node);
  }
  const current = stack[stack.length - 1];
  if (current && cursor < clean.length) current.text += ` ${clean.slice(cursor)}`;
  return root;
}

function analyzeNode(node) {
  const metrics = {
    text: safeSample(node.text, 500),
    image_count: node.tag === "img" ? 1 : 0,
    link_count: node.tag === "a" ? 1 : 0,
    button_count: node.tag === "button" ? 1 : 0,
    input_count: node.tag === "input" ? 1 : 0,
    form_count: node.tag === "form" ? 1 : 0,
    repeated_item_count: 0
  };
  const childGroups = new Map();
  for (const child of node.children || []) {
    const childMetrics = analyzeNode(child);
    metrics.text = safeSample(`${metrics.text} ${childMetrics.text}`, 500);
    metrics.image_count += childMetrics.image_count;
    metrics.link_count += childMetrics.link_count;
    metrics.button_count += childMetrics.button_count;
    metrics.input_count += childMetrics.input_count;
    metrics.form_count += childMetrics.form_count;
    const classes = normalizeText(child.attrs?.class).split(/\s+/).filter((item) => SAFE_CLASS.test(item)).sort().slice(0, 2);
    const key = `${child.tag}.${classes.join(".")}`;
    childGroups.set(key, Number(childGroups.get(key) || 0) + 1);
  }
  metrics.repeated_item_count = Math.max(0, ...childGroups.values());
  node.metrics = metrics;
  return metrics;
}

function escapeSelectorValue(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function nodeClasses(node) {
  return normalizeText(node?.attrs?.class)
    .split(/\s+/)
    .filter((item) => SAFE_CLASS.test(item))
    .slice(0, 4);
}

function nthOfType(node) {
  if (!node?.parent) return 1;
  const siblings = node.parent.children.filter((child) => child.tag === node.tag);
  return Math.max(1, siblings.indexOf(node) + 1);
}

function buildSelector(node) {
  const id = normalizeText(node?.attrs?.id);
  if (id && SAFE_CLASS.test(id)) return `#${id}`;
  const parentTag = normalizeSlot(node?.attrs?.["data-eip-parent"]);
  if (parentTag) return `[data-eip-parent="${escapeSelectorValue(parentTag)}"]`;
  const classes = nodeClasses(node);
  if (classes.length) return `${node.tag}.${classes[0]}`;
  const parent = node?.parent;
  if (parent && parent.tag !== "document") {
    const parentId = normalizeText(parent.attrs?.id);
    if (parentId && SAFE_CLASS.test(parentId)) return `#${parentId} > ${node.tag}:nth-of-type(${nthOfType(node)})`;
    const parentClass = nodeClasses(parent)[0];
    if (parentClass) return `${parent.tag}.${parentClass} > ${node.tag}:nth-of-type(${nthOfType(node)})`;
  }
  return `${node.tag}:nth-of-type(${nthOfType(node)})`;
}

function inferNodeKind(node) {
  const attrs = node.attrs || {};
  const metrics = node.metrics || {};
  const hint = [node.tag, attrs.id, attrs.class, attrs.role, attrs["aria-label"], metrics.text]
    .map(normalizeText)
    .join(" ")
    .toLowerCase();
  if (node.tag === "header") return "header";
  if (node.tag === "nav") return "navigation";
  if (node.tag === "footer") return "footer";
  if (node.tag === "video") return "video";
  if (node.tag === "img" || node.tag === "picture") return "image";
  if (node.tag === "button" || (node.tag === "a" && /\b(button|btn|cta)\b/.test(hint))) return "button";
  if (["h1", "h2", "h3", "p"].includes(node.tag)) return "text_block";
  if (/\b(slide|swiper-slide|carousel-item)\b/.test(hint)) return "slide";
  if (/\b(product-card|product-tile|catalog-card|pattern-card)\b/.test(hint)) return "product_card";
  if (/\b(card|tile)\b/.test(hint)) return "card";
  if (/\b(gallery|lookbook|media-grid|image-grid)\b/.test(hint)) return "gallery";
  if (/\b(carousel|slider|swiper|coverflow)\b/.test(hint)) return "slider";
  if (node.tag === "form") return "form";
  if (["ul", "ol"].includes(node.tag) || metrics.repeated_item_count >= 2) return "repeater";
  if (metrics.button_count >= 2 && metrics.link_count >= 1) return "button_group";
  if (["main", "section", "article", "aside"].includes(node.tag)) return "section";
  return "container";
}

function candidateLabel(node, nodeKind, fallback) {
  const attrs = node.attrs || {};
  const explicit = safeSample(attrs["aria-label"] || attrs.id || "", 70);
  if (explicit) return explicit.replace(/[-_]+/g, " ");
  const classLabel = nodeClasses(node)[0];
  if (classLabel) return classLabel.replace(/[-_]+/g, " ");
  const sample = safeSample(node.metrics?.text || "", 54);
  if (sample) return sample;
  const labels = {
    header: "Header", navigation: "Navigation", footer: "Footer", image: "Image",
    video: "Video", button: "Button", text_block: "Text block", slide: "Slide",
    product_card: "Product card", card: "Card", gallery: "Gallery", slider: "Slider",
    form: "Form", repeater: "Repeater / list", button_group: "Button group",
    section: "Section", container: "Container"
  };
  return labels[nodeKind] || fallback || "Detected element";
}

function inferPage(node) {
  let current = node;
  while (current) {
    const explicit = normalizeSlot(current.attrs?.["data-eip-page"]);
    if (explicit) return explicit;
    current = current.parent;
  }
  const hint = `${normalizeText(node.attrs?.id)} ${normalizeText(node.attrs?.class)} ${node.metrics?.text || ""}`.toLowerCase();
  for (const page of ["sizes", "size", "blog", "pages", "account", "profile", "checkout", "collection", "shop"]) {
    if (hint.includes(page)) return page === "size" ? "sizes" : page;
  }
  return "home";
}

function inferKind(node) {
  const attrs = node.attrs || {};
  const metrics = node.metrics || {};
  const hint = [
    node.tag,
    attrs.id,
    attrs.class,
    attrs.role,
    attrs["aria-label"],
    attrs["data-eip-parent"],
    metrics.text
  ].map(normalizeText).join(" ").toLowerCase();
  const hasForm = metrics.form_count > 0 || metrics.input_count > 0;
  const nodeKind = inferNodeKind(node);
  if (hasForm && SENSITIVE_ZONE.test(hint)) return { renderer: "unknown", suffix: "sensitive_form", score: 0.2, reason: "sensitive form detected", pushAllowed: false };
  if (nodeKind === "video") return { renderer: "video_section", suffix: "video", score: 0.82, reason: "video element" };
  if (nodeKind === "image") return { renderer: "media_gallery", suffix: "image", score: 0.58, reason: "image element" };
  if (nodeKind === "button") return { renderer: "cta_block", suffix: "button", score: 0.62, reason: "interactive button" };
  if (nodeKind === "text_block") return { renderer: "rich_text_block", suffix: "text", score: 0.52, reason: "text element" };
  if (nodeKind === "slide") return { renderer: "hero_slider", suffix: "slide", score: 0.72, reason: "slider child" };
  if (nodeKind === "product_card") return { renderer: "product_detail", suffix: "product_card", score: 0.74, reason: "product card marker" };
  if (node.tag === "header" || /\b(site-header|page-header|masthead)\b/.test(hint)) return { renderer: "navigation", suffix: "header", score: 0.84, reason: "header semantics" };
  if (node.tag === "nav" || /\b(nav|navigation|menu)\b/.test(hint)) return { renderer: "navigation", suffix: "navigation", score: 0.86, reason: "navigation semantics" };
  if (node.tag === "footer" || /\bfooter\b/.test(hint)) return { renderer: "footer_block", suffix: "footer", score: 0.88, reason: "footer semantics" };
  if (/\b(hero|banner|masthead|jumbotron)\b/.test(hint)) return { renderer: "hero_slider", suffix: "hero", score: 0.9, reason: "hero or banner marker" };
  if (/\b(newsletter|subscribe|subscription|mailing-list)\b/.test(hint) && hasForm) return { renderer: "newsletter_form", suffix: "newsletter", score: 0.9, reason: "newsletter form marker" };
  if (/\b(testimonial|review|quote)\b/.test(hint)) return { renderer: "testimonial_grid", suffix: "testimonials", score: 0.76, reason: "testimonial or review marker" };
  if (/\b(gallery|lookbook|media-grid|image-grid)\b/.test(hint)) return { renderer: "media_gallery", suffix: "gallery", score: 0.79, reason: "media gallery marker" };
  if (/\b(carousel|slider|swiper|coverflow)\b/.test(hint) && /\b(product|shop|catalog|pattern|collection|drop|featured|worth)\b/.test(hint)) {
    return { renderer: "product_carousel", suffix: /\bworth\b/.test(hint) ? "worth_making" : "featured_products", score: 0.9, reason: "product carousel marker" };
  }
  if (/\b(product|shop|catalog|pattern|collection|drop|featured|worth)\b/.test(hint) && metrics.repeated_item_count >= 2) {
    return { renderer: "product_grid", suffix: /\bworth\b/.test(hint) ? "worth_making" : "products", score: 0.82, reason: "repeated product layout" };
  }
  if (/\b(article|blog|editorial|story|journal|news)\b/.test(hint) && metrics.repeated_item_count >= 2) {
    return { renderer: "editorial_card_grid", suffix: "editorial", score: 0.8, reason: "repeated editorial layout" };
  }
  if (/\b(cta|call-to-action|callout|promo|promotion)\b/.test(hint) || (metrics.button_count > 0 && metrics.link_count > 0)) {
    return { renderer: "cta_block", suffix: "cta", score: 0.68, reason: "call-to-action signals" };
  }
  if (/\b(feature|benefit|about|size-guide|guide|info)\b/.test(hint)) return { renderer: "feature_block", suffix: "feature", score: 0.62, reason: "feature or information marker" };
  if (metrics.repeated_item_count >= 3 && metrics.image_count >= 2) return { renderer: "editorial_card_grid", suffix: "cards", score: 0.58, reason: "repeated media card layout" };
  if (node.tag === "section" || node.tag === "main" || node.tag === "article") return { renderer: "rich_text_block", suffix: "content", score: 0.48, reason: "semantic content container" };
  return { renderer: "unknown", suffix: "section", score: 0.28, reason: "unclassified structural container" };
}

function shouldProposeNode(node) {
  if (!CANDIDATE_TAGS.has(node.tag)) return false;
  const metrics = node.metrics || {};
  const hint = `${normalizeText(node.attrs?.id)} ${normalizeText(node.attrs?.class)} ${normalizeText(node.attrs?.role)}`;
  if (["header", "nav", "main", "section", "article", "footer", "form"].includes(node.tag)) return true;
  if (["img", "picture", "video", "button"].includes(node.tag)) return true;
  if (node.tag === "a") return /\b(button|btn|cta)\b/i.test(hint) || normalizeText(node.attrs?.role).toLowerCase() === "button";
  if (["h1", "h2", "h3", "p"].includes(node.tag)) return Boolean(safeSample(metrics.text, 8));
  if (["ul", "ol", "li"].includes(node.tag)) return metrics.repeated_item_count >= 2 || Boolean(hint);
  return Boolean(hint || metrics.repeated_item_count >= 2 || metrics.image_count > 0 || metrics.button_count > 0 || metrics.form_count > 0);
}

function toGenericCandidate(node, context = {}) {
  const metrics = node.metrics || {};
  const page = inferPage(node);
  const kind = inferKind(node);
  const nodeKind = inferNodeKind(node);
  const explicitSlot = normalizeSlot(node.attrs?.["data-eip-parent"]);
  const suggestedSlot = explicitSlot || `${page}.${kind.suffix}`;
  const selector = buildSelector(node);
  const reasons = [kind.reason];
  if (explicitSlot) reasons.unshift("explicit data-eip-parent marker");
  if (metrics.repeated_item_count >= 2) reasons.push(`${metrics.repeated_item_count} repeated child items`);
  if (metrics.image_count) reasons.push(`${metrics.image_count} image(s)`);
  const confidence = Math.min(0.99, Number((kind.score + (explicitSlot ? 0.08 : 0)).toFixed(2)));
  const signatureSeed = [
    node.tag,
    normalizeText(node.attrs?.id),
    nodeClasses(node).sort().join("."),
    selector,
    metrics.image_count,
    metrics.link_count,
    metrics.button_count,
    metrics.repeated_item_count
  ].join("|");
  const domSignature = hashText(signatureSeed);
  return {
    candidate_id: `zone-${domSignature.slice(0, 12)}`,
    parent_candidate_id: context.parentCandidateId || null,
    dom_depth: Math.max(0, Number(context.depth || 0)),
    dom_order: Math.max(0, Number(context.order || node.index || 0)),
    node_kind: nodeKind,
    label: candidateLabel(node, nodeKind, kind.suffix),
    page,
    suggested_slot: normalizeSlot(suggestedSlot) || "home.content",
    suggested_renderer: normalizeRenderer(kind.renderer),
    selector,
    dom_signature: domSignature,
    text_sample: safeSample(metrics.text),
    image_count: Number(metrics.image_count || 0),
    link_count: Number(metrics.link_count || 0),
    button_count: Number(metrics.button_count || 0),
    repeated_item_count: Number(metrics.repeated_item_count || 0),
    confidence,
    confidence_reasons: reasons,
    mapping_status: confidence >= 0.45 ? "proposed" : "needs_review",
    source: "generic_scan",
    content_mode: metrics.repeated_item_count >= 2 || ["slider", "repeater", "product_card"].includes(nodeKind)
      ? "dynamic"
      : "static",
    visibility: normalizeText(node.attrs?.["data-eip-scan-visibility"] || "visible") === "hidden" ? "hidden" : "visible",
    bounds: {
      width: Math.max(0, Number(node.attrs?.["data-eip-scan-width"] || 0)),
      height: Math.max(0, Number(node.attrs?.["data-eip-scan-height"] || 0))
    },
    push_allowed: kind.pushAllowed !== false
  };
}

function dedupeCandidates(candidates) {
  const allById = new Map((candidates || []).map((candidate) => [candidate.candidate_id, candidate]));
  const bySignature = new Map();
  for (const candidate of candidates || []) {
    if (!candidate?.candidate_id || !candidate?.suggested_slot) continue;
    const key = SINGLETON_SLOT_RENDERERS.has(candidate.suggested_renderer) && !["slide", "image", "button", "text_block", "card", "product_card"].includes(candidate.node_kind)
      ? `${candidate.suggested_slot}|${candidate.suggested_renderer}`
      : `${candidate.dom_signature}|${candidate.suggested_slot}`;
    const existing = bySignature.get(key);
    if (!existing || Number(candidate.confidence || 0) > Number(existing.confidence || 0)) {
      bySignature.set(key, candidate);
    }
  }
  const selected = Array.from(bySignature.values())
    .sort((a, b) => Number(a.dom_order || 0) - Number(b.dom_order || 0))
    .slice(0, 120);
  const selectedIds = new Set(selected.map((candidate) => candidate.candidate_id));
  return selected.map((candidate) => {
    let parentId = candidate.parent_candidate_id || null;
    while (parentId && !selectedIds.has(parentId)) {
      parentId = allById.get(parentId)?.parent_candidate_id || null;
    }
    return { ...candidate, parent_candidate_id: parentId };
  });
}

function scanGenericStorefrontHtml(html) {
  const root = parseStaticHtml(html);
  analyzeNode(root);
  const queue = root.children.map((node) => ({ node, parentCandidateId: null, depth: 0 }));
  const candidates = [];
  while (queue.length) {
    const current = queue.shift();
    const node = current?.node;
    if (!node) continue;
    let parentCandidateId = current.parentCandidateId;
    if (shouldProposeNode(node)) {
      const candidate = toGenericCandidate(node, {
        parentCandidateId,
        depth: current.depth,
        order: node.index
      });
      candidates.push(candidate);
      parentCandidateId = candidate.candidate_id;
    }
    queue.push(...(node.children || []).map((child) => ({
      node: child,
      parentCandidateId,
      depth: current.depth + 1
    })));
  }
  if (!candidates.length) {
    const signature = hashText("body|fallback");
    candidates.push({
      candidate_id: `zone-${signature.slice(0, 12)}`,
      page: "home",
      suggested_slot: "home.content",
      suggested_renderer: "unknown",
      selector: "body",
      dom_signature: signature,
      text_sample: safeSample(root.metrics?.text || ""),
      image_count: Number(root.metrics?.image_count || 0),
      link_count: Number(root.metrics?.link_count || 0),
      button_count: Number(root.metrics?.button_count || 0),
      repeated_item_count: Number(root.metrics?.repeated_item_count || 0),
      confidence: 0.2,
      confidence_reasons: ["static page fallback candidate"],
      mapping_status: "needs_review",
      source: "generic_scan",
      parent_candidate_id: null,
      dom_depth: 0,
      dom_order: 0,
      node_kind: "container",
      label: "Page content",
      content_mode: "static",
      visibility: "visible",
      bounds: { width: 0, height: 0 },
      push_allowed: true
    });
  }
  return dedupeCandidates(candidates);
}

function isLikelyClientRenderedShell(html, candidates = []) {
  const source = String(html || "");
  const hasScript = /<script\b[^>]*\bsrc\s*=/i.test(source);
  const hasEmptyMount = /<(?:div|main)\b[^>]*(?:\bid\s*=\s*["'](?:root|app|__next)["']|\bdata-reactroot\b)[^>]*>\s*<\/(?:div|main)>/i.test(source);
  const hasUsableCandidate = (Array.isArray(candidates) ? candidates : [])
    .some((candidate) => Number(candidate?.confidence || 0) >= 0.45);
  return hasScript && hasEmptyMount && !hasUsableCandidate;
}

function taggedZoneToCandidate(zone = {}) {
  const tag = normalizeSlot(zone.tag || zone.slot || zone.parent);
  if (!tag) return null;
  const signature = hashText(`tagged|${tag}`);
  const configuredRenderer = normalizeText(zone.renderer_type || zone.renderer).toLowerCase();
  const renderer =
    configuredRenderer === "hero"
      ? "hero_slider"
      : configuredRenderer === "cards"
        ? /\b(product|worth|featured|drop|collection)\b/.test(tag)
          ? "product_carousel"
          : "editorial_card_grid"
        : configuredRenderer === "block"
          ? "rich_text_block"
          : configuredRenderer;
  return {
    candidate_id: `tag-${signature.slice(0, 12)}`,
    parent_candidate_id: null,
    dom_depth: 0,
    dom_order: 0,
    node_kind: "section",
    label: normalizeText(zone.label || tag),
    page: normalizeSlot(zone.page || tag.split(".")[0] || "home") || "home",
    suggested_slot: tag,
    suggested_renderer: normalizeRenderer(renderer, "rich_text_block"),
    selector: `[data-eip-parent="${escapeSelectorValue(tag)}"]`,
    dom_signature: signature,
    text_sample: "",
    image_count: Number(zone.image_count || 0),
    link_count: Number(zone.link_count || 0),
    button_count: Number(zone.button_count || 0),
    repeated_item_count: Number(zone.occurrences || 1),
    confidence: 0.99,
    confidence_reasons: ["explicit data-eip-parent or manifest mapping"],
    mapping_status: "approved",
    source: "tagged_scan",
    content_mode: Number(zone.occurrences || 1) > 1 ? "dynamic" : "static",
    visibility: "visible",
    bounds: { width: 0, height: 0 },
    push_allowed: true
  };
}

function mergeScanCandidates(genericCandidates = [], taggedZones = []) {
  const taggedCandidates = taggedZones.map(taggedZoneToCandidate).filter(Boolean);
  const bySlot = new Map();
  for (const candidate of genericCandidates) bySlot.set(candidate.suggested_slot, candidate);
  for (const candidate of taggedCandidates) bySlot.set(candidate.suggested_slot, candidate);
  return dedupeCandidates(Array.from(bySlot.values()));
}

function profileCode(connectionCode) {
  const normalized = normalizeSlot(connectionCode).replace(/[.]+/g, "_");
  return `${normalized || "storefront"}_default`;
}

function preserveMappingDecision(candidate, previousCandidates) {
  const prior = previousCandidates.find(
    (item) =>
      item?.candidate_id === candidate.candidate_id ||
      (item?.dom_signature && item.dom_signature === candidate.dom_signature)
  );
  if (!prior || candidate.source === "tagged_scan") return candidate;
  return {
    ...candidate,
    suggested_slot: normalizeSlot(prior.suggested_slot || candidate.suggested_slot) || candidate.suggested_slot,
    suggested_renderer: normalizeRenderer(prior.suggested_renderer || candidate.suggested_renderer),
    selector: normalizeText(prior.selector || candidate.selector).slice(0, 500),
    mapping_status: normalizeMappingStatus(prior.mapping_status, candidate.mapping_status)
  };
}

function mappingProfileZones(mappingProfile = {}) {
  const candidates = Array.isArray(mappingProfile.candidate_zones) ? mappingProfile.candidate_zones : [];
  return candidates
    .filter((candidate) => candidate?.mapping_status !== "ignored")
    .map((candidate) => ({
      tag: normalizeSlot(candidate.suggested_slot),
      page: normalizeSlot(candidate.page || candidate.suggested_slot?.split(".")[0] || "home") || "home",
      label: normalizeText(candidate.label || candidate.suggested_slot),
      renderer_type: normalizeRenderer(candidate.suggested_renderer, "rich_text_block"),
      occurrences: Math.max(1, Number(candidate.repeated_item_count || 1)),
      candidate_id: candidate.candidate_id,
      parent_candidate_id: candidate.parent_candidate_id || null,
      dom_depth: Math.max(0, Number(candidate.dom_depth || 0)),
      dom_order: Math.max(0, Number(candidate.dom_order || 0)),
      node_kind: normalizeText(candidate.node_kind || "section"),
      content_mode: normalizeText(candidate.content_mode || "static"),
      visibility: normalizeText(candidate.visibility || "visible"),
      bounds: candidate.bounds && typeof candidate.bounds === "object" ? candidate.bounds : { width: 0, height: 0 },
      selector: candidate.selector,
      dom_signature: candidate.dom_signature,
      text_sample: candidate.text_sample,
      image_count: Number(candidate.image_count || 0),
      link_count: Number(candidate.link_count || 0),
      button_count: Number(candidate.button_count || 0),
      repeated_item_count: Number(candidate.repeated_item_count || 0),
      confidence: Number(candidate.confidence || 0),
      confidence_reasons: Array.isArray(candidate.confidence_reasons) ? candidate.confidence_reasons : [],
      mapping_status: normalizeMappingStatus(candidate.mapping_status),
      source: normalizeText(candidate.source || ""),
      push_allowed: candidate.push_allowed !== false
    }))
    .filter((zone) => zone.tag);
}

function buildMappingProfile({
  tenantId,
  connectionCode,
  frontendUrl,
  scan,
  previous = {},
  nowIso = new Date().toISOString()
}) {
  const priorCandidates = Array.isArray(previous.candidate_zones) ? previous.candidate_zones : [];
  const candidateZones = (Array.isArray(scan?.candidate_zones) ? scan.candidate_zones : [])
    .map((candidate) => preserveMappingDecision(candidate, priorCandidates));
  const approvedMappings = candidateZones.filter((candidate) => candidate.mapping_status === "approved");
  const ignoredCandidates = candidateZones.filter((candidate) => candidate.mapping_status === "ignored");
  return {
    tenant_id: tenantId || null,
    connection_code: normalizeText(connectionCode) || null,
    frontend_url: normalizeText(frontendUrl) || null,
    scan_id: normalizeText(scan?.scan_id) || `scan-${hashText(`${connectionCode}|${nowIso}`).slice(0, 16)}`,
    scanned_at: scan?.scanned_at || nowIso,
    mapping_profile_code: normalizeText(previous.mapping_profile_code) || profileCode(connectionCode),
    mapping_version: Math.max(0, Number(previous.mapping_version || 0)) + 1,
    source_mode: normalizeText(scan?.scan_mode || "auto"),
    scan_source: normalizeText(scan?.scan_source || ""),
    candidate_zones: candidateZones,
    approved_mappings: approvedMappings,
    ignored_candidates: ignoredCandidates,
    slot_dom_mapping: Object.fromEntries(
      approvedMappings.map((candidate) => [
        candidate.suggested_slot,
        {
          selector: candidate.selector,
          renderer: candidate.suggested_renderer,
          candidate_id: candidate.candidate_id,
          dom_signature: candidate.dom_signature,
          source: candidate.source
        }
      ])
    ),
    last_scan_result: {
      usable_candidate_count: Number(scan?.usable_candidate_count || 0),
      generic_candidate_count: Number(scan?.generic_candidate_count || 0),
      tagged_candidate_count: Number(scan?.tagged_candidate_count || 0),
      rendered_dom_attempted: scan?.rendered_dom_attempted === true,
      rendered_dom_available: scan?.rendered_dom_available === true,
      rendered_dom_error: normalizeText(scan?.rendered_dom_error || "") || null,
      rendered_dom_candidate_count: Number(scan?.rendered_dom_candidate_count || 0),
      rendered_shell_detected: scan?.rendered_shell_detected === true,
      fallback_recommendation: normalizeText(scan?.fallback_recommendation || "") || null,
      files_scanned: Number(scan?.files_scanned || 0),
      scanned_at: scan?.scanned_at || nowIso
    }
  };
}

function updateMappingCandidate(profile = {}, patch = {}) {
  const candidateId = normalizeText(patch.candidate_id);
  if (!candidateId) throw new Error("CANDIDATE_ID_REQUIRED");
  const candidates = Array.isArray(profile.candidate_zones) ? profile.candidate_zones : [];
  let found = false;
  const nextCandidates = candidates.map((candidate) => {
    if (candidate?.candidate_id !== candidateId) return candidate;
    found = true;
    const status = normalizeMappingStatus(patch.mapping_status, candidate.mapping_status);
    if (status === "approved" && candidate.push_allowed === false) {
      throw new Error("SENSITIVE_ZONE_APPROVAL_FORBIDDEN");
    }
    return {
      ...candidate,
      suggested_slot: normalizeSlot(patch.suggested_slot || candidate.suggested_slot) || candidate.suggested_slot,
      suggested_renderer: normalizeRenderer(patch.suggested_renderer || candidate.suggested_renderer),
      selector: normalizeText(patch.selector || candidate.selector).slice(0, 500),
      mapping_status: status,
      updated_at: new Date().toISOString()
    };
  });
  if (!found) throw new Error("CANDIDATE_NOT_FOUND");
  return buildMappingProfile({
    tenantId: profile.tenant_id,
    connectionCode: profile.connection_code,
    frontendUrl: profile.frontend_url,
    scan: {
      ...profile.last_scan_result,
      scan_id: profile.scan_id,
      scanned_at: profile.scanned_at,
      scan_mode: profile.source_mode,
      scan_source: profile.scan_source,
      candidate_zones: nextCandidates
    },
    previous: { ...profile, candidate_zones: nextCandidates }
  });
}

export {
  buildMappingProfile,
  mappingProfileZones,
  mergeScanCandidates,
  normalizeMappingStatus,
  normalizeRenderer,
  isLikelyClientRenderedShell,
  scanGenericStorefrontHtml,
  taggedZoneToCandidate,
  updateMappingCandidate
};
