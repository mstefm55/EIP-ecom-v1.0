import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Code2,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Layers3,
  Link2,
  Loader2,
  Lock,
  Monitor,
  MousePointer2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ScanSearch,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Unlock,
  UploadCloud,
  X
} from "lucide-react";
import { apiFetch } from "../../services/apiClient";
import EipMark from "../brand/EipMark";
import ImageAssetStudioModal from "../shared/ImageAssetStudioModal";
import {
  SECTION_TEMPLATE_CATEGORIES,
  SECTION_TEMPLATES,
  addButton,
  addChild,
  buildScannerTree,
  createSectionFromTemplate,
  deleteButton,
  deleteChild,
  duplicateChild,
  normalizeScannerZones,
  normalizeLegacySection,
  moveChildTo,
  previewKind,
  reorderChild,
  sanitizeBindingReference,
  serializeEnhancedSection,
  templateIdForRenderer
} from "./contentStudioEnhancedModel";
import "./ContentStudioEnhanced.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const PREVIEW_BASE_URL = import.meta.env.VITE_ECOM_PREVIEW_BASE_URL || "http://localhost:5174";
const UPLOAD_TIMEOUT_MS = 120000;
const TRANSLATION_CONFIRM_REQUIRED = "translation_unavailable_confirmation_required";

const INSPECTOR_TABS = ["Quick Edit", "Content", "Data Binding", "Media", "Display", "Advanced"];
const WORKFLOW_STEPS = ["Analyze Page", "Review Sections", "Map", "Edit", "Preview", "Publish"];
const CONTENT_SOURCE_OPTIONS = [
  { value: "static", label: "Manual Content" },
  { value: "product_studio", label: "Product Studio" },
  { value: "category_data", label: "Category Data" },
  { value: "custom_api", label: "Future API" }
];

function assetUrl(value) {
  const url = String(value || "").trim();
  if (!url || url.startsWith("blob:") || url.startsWith("data:") || /^https?:/i.test(url)) return url;
  const base = typeof window !== "undefined" ? new URL(API_BASE_URL, window.location.origin).origin : API_BASE_URL;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function messageFor(error, fallback) {
  const payload = error?.payload || {};
  const code = String(error?.code || payload.error || "").trim();
  if (code === "INVALID_IMAGE") return payload.message || "The selected image is invalid or unsupported.";
  if (code === "FILE_TOO_LARGE") return payload.message || "The selected image is too large.";
  if (code === "REQUEST_TIMEOUT") return "The upload took too long and was stopped. Please try again.";
  if (code === "UPLOAD_SCAN_PENDING") return "The image is waiting for scanner approval. Please try again shortly.";
  if (code === "UPLOAD_STORAGE_UNAVAILABLE" || code === "UPLOAD_STORAGE_WRITE_FAILED") return "Media storage is temporarily unavailable. The previous image was kept.";
  if (code === "RENDERED_DOM_BROWSER_NOT_FOUND" || code === "RENDERED_DOM_ADAPTER_NOT_INSTALLED") return "Rendered scanning is not available on the API service. Verify the Chromium scanner deployment.";
  if (code === "RENDERED_DOM_TIMEOUT" || code === "STRUCTURE_SCAN_TIMEOUT") return "The rendered page took too long to scan. Check the connected URL and try again.";
  if (code === "RENDERED_DOM_SCANNER_DISABLED") return "Rendered DOM scanning is disabled for this environment.";
  return error?.userMessage || payload.message || error?.message || fallback;
}

function replaceAt(items, id, updater, key = "sectionId") {
  return items.map((item) => (item?.[key] === id ? updater(item) : item));
}

function childLabel(section) {
  const type = section?.componentType;
  if (type === "hero_slider" || type === "hero") return "Slide";
  if (type === "faq") return "Question";
  if (type === "media_gallery") return "Image";
  if (type === "testimonial_grid") return "Testimonial";
  if (type === "product_grid" || type === "product_carousel") return "Collection";
  return "Item";
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="cse-toggle-row">
      <span>{label}</span>
      <button type="button" className={`cse-toggle ${checked ? "is-on" : ""}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}

function Field({ label, value, onChange, type = "text", options, placeholder, rows = 3 }) {
  return (
    <label className="cse-field">
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : type === "select" ? (
        <select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
          {(options || []).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : (
        <input type={type} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function scannerState(zone) {
  if (zone.visibility === "hidden" || zone.status === "ignored") return { code: "hidden", label: "Hidden" };
  if (zone.status === "approved") return { code: "ready", label: "Ready" };
  if (zone.status === "broken") return { code: "broken", label: "Broken" };
  if (zone.status === "needs_review") return { code: "review", label: "Needs Review" };
  return { code: "unmapped", label: "Needs Mapping" };
}

function reorderButton(child, buttonId, direction) {
  const buttons = [...(child?.content?.buttons || [])];
  const index = buttons.findIndex((button) => button.id === buttonId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= buttons.length) return child;
  [buttons[index], buttons[target]] = [buttons[target], buttons[index]];
  return { ...child, content: { ...child.content, buttons } };
}

function sectionState(section) {
  if (section?.visible === false) return { code: "hidden", label: "Hidden" };
  if (section?.mappingStatus === "broken") return { code: "broken", label: "Broken" };
  if (["approved", "mapped"].includes(section?.mappingStatus)) return { code: "ready", label: "Ready" };
  return { code: "review", label: "Needs Review" };
}

function defaultInspectorTab(section) {
  if (["product_grid", "product_carousel", "product_detail"].includes(section?.componentType)) return "Data Binding";
  if (section?.componentType === "media_gallery") return "Media";
  return "Quick Edit";
}

function ScannerTreeNode({ node, selectedId, onView, onMap, onIgnore }) {
  const state = scannerState(node);
  return (
    <div className="cse-dom-node" style={{ "--dom-depth": node.depth }}>
      <div className={`cse-dom-row ${selectedId === node.id ? "active" : ""}`}>
        <button type="button" className="cse-dom-view" onClick={() => onView(node)} title="View detected element in preview">
          {node.children.length ? <ChevronDown /> : <Code2 />}
          <span><strong>{node.label}</strong><small>{node.nodeKind} section</small></span>
        </button>
        <div className="cse-dom-badges">
          <em className={state.code}>{state.label}</em>
          <em className={node.contentMode}>{node.contentMode}</em>
        </div>
        <div className="cse-dom-actions">
          <button type="button" onClick={() => onMap(node)} disabled={!node.pushAllowed} title={node.pushAllowed ? "Choose the section type, fields, and content source" : "Mapping is disabled by this connection profile"}>{node.status === "approved" ? "Edit Mapping" : "Map This Section"}</button>
          <button type="button" onClick={() => onView(node)} title="Highlight this section in the live preview">View</button>
          <button type="button" onClick={() => onIgnore(node)} disabled={node.status === "ignored"} title={node.status === "ignored" ? "This section is already hidden" : "Hide this section from the editable structure"}>{node.status === "ignored" ? "Hidden" : "Hide"}</button>
        </div>
      </div>
      {node.children.length ? <div className="cse-dom-children">{node.children.map((child) => <ScannerTreeNode key={child.id} node={child} selectedId={selectedId} onView={onView} onMap={onMap} onIgnore={onIgnore} />)}</div> : null}
    </div>
  );
}

export default function ContentStudioEnhanced({ ctx }) {
  const [connections, setConnections] = useState([]);
  const [connectionCode, setConnectionCode] = useState("");
  const [sections, setSections] = useState([]);
  const [structure, setStructure] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [expanded, setExpanded] = useState(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState("home");
  const [viewport, setViewport] = useState("desktop");
  const [inspectorTab, setInspectorTab] = useState("Quick Edit");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateCategory, setTemplateCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState({ tone: "", message: "" });
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [mappingWizard, setMappingWizard] = useState({ open: false, step: 1, zoneId: "", templateId: "custom", slot: "", dataSource: "static", fieldMappings: {} });
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editor, setEditor] = useState({ open: false, file: null, sourceUrl: "", childId: "", previousImage: "" });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: "", message: "", confirmLabel: "", cancelLabel: "" });
  const fileInputRef = useRef(null);
  const previewObjectUrlRef = useRef("");
  const previewInteractionRef = useRef(null);
  const confirmResolverRef = useRef(null);

  const scannerZones = useMemo(() => normalizeScannerZones(structure), [structure]);
  const scannerTree = useMemo(() => buildScannerTree(scannerZones.filter((zone) => zone.page === page)), [page, scannerZones]);
  const selectedScannerZone = useMemo(
    () => scannerZones.find((zone) => zone.id === selectedZoneId) || null,
    [scannerZones, selectedZoneId]
  );
  const selectedSection = useMemo(
    () => selectedSectionId === "__none__" ? null : sections.find((section) => section.componentId === selectedSectionId) || sections[0] || null,
    [sections, selectedSectionId]
  );
  const selectedChild = useMemo(
    () => selectedSection?.children?.find((child) => child.sectionId === selectedChildId)
      || selectedSection?.children?.[0]
      || null,
    [selectedChildId, selectedSection]
  );
  const selectedConnection = useMemo(
    () => connections.find((connection) => String(connection.connection_code) === connectionCode) || connections[0] || null,
    [connectionCode, connections]
  );
  const frontendUrl = String(selectedConnection?.frontend_url || selectedConnection?.base_url || PREVIEW_BASE_URL || "").replace(/\/$/, "");
  const renderedPreviewUrl = useMemo(() => {
    if (!selectedScannerZone || !frontendUrl) return "";
    try {
      const url = new URL(frontendUrl, window.location.origin);
      url.searchParams.set("eip_content_preview", "1");
      url.searchParams.set("eip_selector", selectedScannerZone.selector || "body");
      return url.toString();
    } catch {
      return frontendUrl;
    }
  }, [frontendUrl, selectedScannerZone]);

  useEffect(() => {
    if (!frontendUrl) return undefined;
    let expectedOrigin = "";
    try { expectedOrigin = new URL(frontendUrl, window.location.origin).origin; } catch { return undefined; }
    const handlePreviewSelection = (event) => {
      if (event.origin !== expectedOrigin || event.data?.type !== "eip-content-preview-select") return;
      const selector = String(event.data?.selector || "").trim();
      const zone = scannerZones.find((item) => item.selector === selector);
      if (!zone) return;
      setSelectedZoneId(zone.id);
      const mapped = sections.find((section) => section.selector === selector);
      if (mapped) {
        setSelectedSectionId(mapped.componentId);
        setSelectedChildId(mapped.children?.[0]?.sectionId || "");
        setExpanded((current) => new Set([...current, mapped.componentId]));
        setInspectorTab(defaultInspectorTab(mapped));
      }
    };
    window.addEventListener("message", handlePreviewSelection);
    return () => window.removeEventListener("message", handlePreviewSelection);
  }, [frontendUrl, scannerZones, sections]);

  const updateSection = (sectionId, updater) => {
    setSections((current) => replaceAt(current, sectionId, updater, "componentId"));
  };
  const updateSelectedChild = (updater) => {
    if (!selectedSection || !selectedChild) return;
    updateSection(selectedSection.componentId, (section) => ({
      ...section,
      children: replaceAt(section.children || [], selectedChild.sectionId, updater)
    }));
  };

  function closeConfirmModal(confirmed) {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmModal({ open: false, title: "", message: "", confirmLabel: "", cancelLabel: "" });
    resolver?.(confirmed);
  }

  function confirmEnglishOnlyPublish() {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmModal({
        open: true,
        title: "Translation unavailable",
        message: "The translation service is unavailable. Publish this section in English only, or keep it as a draft until translation is available.",
        confirmLabel: "Publish in English only",
        cancelLabel: "Keep as draft"
      });
    });
  }

  async function loadWorkspace() {
    setLoading(true);
    setNotice({ tone: "", message: "" });
    try {
      const [connectionResult, contentResult, structureResult] = await Promise.all([
        apiFetch("/api/eip/ecom/storefront/structure/connections"),
        apiFetch("/api/eip/ecom/storefront/content/list?limit=100&offset=0&content_model=singleton"),
        apiFetch("/api/eip/ecom/storefront/structure").catch(() => ({ item: null }))
      ]);
      const nextConnections = Array.isArray(connectionResult?.items) ? connectionResult.items : [];
      const contentItems = Array.isArray(contentResult?.items) ? contentResult.items : [];
      const nextSections = contentItems.map(normalizeLegacySection).sort((a, b) => a.order - b.order);
      setConnections(nextConnections);
      setConnectionCode(String(connectionResult?.selected_connection_code || nextConnections[0]?.connection_code || ""));
      setStructure(structureResult?.item || null);
      setSections(nextSections);
      if (nextSections.length) {
        setSelectedSectionId(nextSections[0].componentId);
        setSelectedChildId(nextSections[0].children?.[0]?.sectionId || "");
        setExpanded(new Set([nextSections[0].componentId]));
      }
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Content Studio Enhanced could not load.") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => {
      window.clearTimeout(timer);
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
        confirmResolverRef.current = null;
      }
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    };
  }, []);

  function selectSection(section, child = null) {
    setSelectedZoneId("");
    setSelectedSectionId(section.componentId);
    setSelectedChildId(child?.sectionId || section.children?.[0]?.sectionId || "");
    setExpanded((current) => new Set([...current, section.componentId]));
    setInspectorTab(defaultInspectorTab(section));
  }

  function selectPreviewElement(child, tab = "Quick Edit") {
    if (!selectedSection || !child) return;
    setSelectedZoneId("");
    setSelectedSectionId(selectedSection.componentId);
    setSelectedChildId(child.sectionId);
    setExpanded((current) => new Set([...current, selectedSection.componentId]));
    setInspectorTab(tab);
  }

  function addTemplate(templateId) {
    const section = createSectionFromTemplate(templateId, sections.length);
    section.slot = `${page}.${templateId}_${sections.length + 1}`;
    setSections((current) => [...current, section]);
    setSelectedSectionId(section.componentId);
    setSelectedChildId(section.children[0]?.sectionId || "");
    setExpanded((current) => new Set([...current, section.componentId]));
    setSelectedZoneId("");
    setTemplateOpen(false);
    setNotice({ tone: "success", message: `${section.label} added as a draft section.` });
  }

  function addSectionChild() {
    if (!selectedSection) return;
    const next = addChild(selectedSection);
    updateSection(selectedSection.componentId, () => next);
    setSelectedChildId(next.children.at(-1)?.sectionId || "");
  }

  function removeSelectedChild() {
    if (!selectedSection || !selectedChild) return;
    const next = deleteChild(selectedSection, selectedChild.sectionId);
    updateSection(selectedSection.componentId, () => next);
    setSelectedChildId(next.children[0]?.sectionId || "");
  }

  function moveSection(direction) {
    if (!selectedSection) return;
    setSections((current) => {
      const list = [...current];
      const index = list.findIndex((section) => section.componentId === selectedSection.componentId);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return list.map((section, sectionIndex) => ({ ...section, order: (sectionIndex + 1) * 10 }));
    });
  }

  function beginPreviewInteraction(mode, event) {
    if (!selectedChild || selectedSection?.locked) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    previewInteractionRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: Number(selectedChild.display?.offsetX) || 0,
      offsetY: Number(selectedChild.display?.offsetY) || 0,
      widthPercent: Number(selectedChild.display?.widthPercent) || 100,
      heightPx: Number(selectedChild.display?.heightPx) || 330
    };
  }

  function updatePreviewInteraction(event) {
    const interaction = previewInteractionRef.current;
    if (!interaction) return;
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    if (interaction.mode === "move") {
      updateSelectedChild((child) => ({
        ...child,
        display: {
          ...child.display,
          offsetX: Math.round(interaction.offsetX + deltaX),
          offsetY: Math.round(interaction.offsetY + deltaY)
        }
      }));
    } else {
      updateSelectedChild((child) => ({
        ...child,
        display: {
          ...child.display,
          widthPercent: Math.max(35, Math.min(100, Math.round(interaction.widthPercent + deltaX / 5))),
          heightPx: Math.max(220, Math.min(720, Math.round(interaction.heightPx + deltaY)))
        }
      }));
    }
  }

  function endPreviewInteraction() {
    previewInteractionRef.current = null;
  }

  function duplicateSection() {
    if (!selectedSection) return;
    const copy = createSectionFromTemplate(
      SECTION_TEMPLATES.find((entry) => entry.type === selectedSection.componentType)?.id || "custom",
      sections.length
    );
    copy.label = `${selectedSection.label} Copy`;
    copy.children = selectedSection.children.map((child, index) => ({
      ...child,
      sectionId: `${copy.componentId}-child-${index + 1}`,
      label: `${child.label} Copy`
    }));
    setSections((current) => [...current, copy]);
    selectSection(copy);
  }

  function deleteSelectedSection() {
    if (!selectedSection) return;
    const remaining = sections.filter((section) => section.componentId !== selectedSection.componentId);
    setSections(remaining);
    setSelectedSectionId(remaining[0]?.componentId || "");
    setSelectedChildId(remaining[0]?.children?.[0]?.sectionId || "");
  }

  function selectPreviewSibling(direction) {
    if (!selectedSection?.children?.length || !selectedChild) return;
    const index = selectedSection.children.findIndex((child) => child.sectionId === selectedChild.sectionId);
    const delta = direction === "previous" ? -1 : 1;
    const nextIndex = (index + delta + selectedSection.children.length) % selectedSection.children.length;
    setSelectedChildId(selectedSection.children[nextIndex].sectionId);
  }

  function resetPreviewLayout() {
    if (!selectedSection || !selectedChild) return;
    updateSelectedChild((child) => ({
      ...child,
      display: { ...child.display, offsetX: 0, offsetY: 0, widthPercent: 100, heightPx: 330 }
    }));
    setNotice({ tone: "success", message: "Preview position and size reset." });
  }

  function viewScannerZone(zone) {
    setSelectedZoneId(zone.id);
    const mapped = sections.find((section) => section.selector === zone.selector || section.slot === zone.tag);
    if (mapped) {
      setSelectedSectionId(mapped.componentId);
      setSelectedChildId(mapped.children?.[0]?.sectionId || "");
      setExpanded((current) => new Set([...current, mapped.componentId]));
    }
    setNotice({ tone: "success", message: `Showing rendered DOM target: ${zone.selector || zone.tag}.` });
  }

  async function scanElements() {
    const allowedModes = Array.isArray(selectedConnection?.allowed_scan_modes) ? selectedConnection.allowed_scan_modes : [];
    if (allowedModes.length && !allowedModes.includes("rendered")) {
      setNotice({ tone: "error", message: "Rendered DOM scanning is not enabled for this Gateway Connection Profile. Enable the rendered scan mode, then retry." });
      return;
    }
    setScanning(true);
    setNotice({ tone: "", message: "" });
    try {
      const result = await apiFetch("/api/eip/ecom/storefront/structure/scan", {
        method: "POST",
        body: { ...(connectionCode ? { connection_code: connectionCode } : {}), scan_mode: "rendered" }
      });
      setStructure(result?.item || null);
      const candidates = normalizeScannerZones(result?.item || null);
      setSelectedZoneId(candidates[0]?.id || "");
      setNotice({ tone: "success", message: `Rendered DOM scan complete: ${candidates.length} detected elements.` });
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Element scan failed.") });
    } finally {
      setScanning(false);
    }
  }

  function reviewUnmapped() {
    const zone = scannerZones.find((item) => !["approved", "ignored"].includes(item.status));
    if (!zone) {
      setNotice({ tone: "success", message: "All detected sections have a mapping decision." });
      return;
    }
    viewScannerZone(zone);
    setNotice({ tone: "success", message: `${zone.label} needs a mapping decision.` });
  }

  function acceptSuggestedMapping() {
    const zone = scannerZones.find((item) => item.pushAllowed && !["approved", "ignored"].includes(item.status));
    if (!zone) {
      setNotice({ tone: "success", message: "No suggested mapping is waiting for confirmation." });
      return;
    }
    openMappingWizard(zone);
  }

  function openMappingWizard(zone) {
    const existing = sections.find((section) => section.selector === zone.selector || section.slot === zone.tag);
    const templateId = existing
      ? templateIdForRenderer(existing.componentType)
      : templateIdForRenderer(zone.type);
    setSelectedZoneId(zone.id);
    setMappingWizard({
      open: true,
      step: 1,
      zoneId: zone.id,
      templateId,
      slot: existing?.slot || zone.tag || `custom.${zone.nodeKind}`,
      dataSource: existing?.children?.[0]?.dataBinding?.source
        || (["product_grid", "product_carousel", "product_detail"].includes(zone.type) ? "product_studio" : "static"),
      fieldMappings: { ...(existing?.children?.[0]?.dataBinding?.fieldMappings || {}) }
    });
  }

  async function ignoreScannerZone(zone) {
    if (zone.status === "ignored") return;
    try {
      const result = await apiFetch(`/api/eip/ecom/storefront/structure/mappings/${encodeURIComponent(zone.id)}`, {
        method: "PUT",
        body: { mapping_status: "ignored", suggested_slot: zone.tag, suggested_renderer: zone.type, selector: zone.selector }
      });
      setStructure(result?.item || structure);
      if (selectedZoneId === zone.id) setSelectedZoneId("");
      setNotice({ tone: "success", message: `${zone.label} ignored. A later rescan will preserve this decision.` });
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Could not ignore the detected element.") });
    }
  }

  async function saveMapping() {
    const zone = scannerZones.find((item) => item.id === mappingWizard.zoneId);
    const template = SECTION_TEMPLATES.find((item) => item.id === mappingWizard.templateId);
    if (!zone || !template) return;
    setMappingSaving(true);
    try {
      const renderer = template.type;
      const result = await apiFetch(`/api/eip/ecom/storefront/structure/mappings/${encodeURIComponent(zone.id)}`, {
        method: "PUT",
        body: {
          mapping_status: "approved",
          suggested_slot: mappingWizard.slot,
          suggested_renderer: renderer,
          selector: zone.selector
        }
      });
      const existing = sections.find((section) => section.selector === zone.selector || section.slot === zone.tag || section.slot === mappingWizard.slot);
      const section = existing || createSectionFromTemplate(template.id, sections.length);
      const mappedSection = {
        ...section,
        componentType: template.type,
        label: zone.label || template.label,
        slot: mappingWizard.slot,
        selector: zone.selector,
        mappingStatus: "approved",
        source: mappingWizard.dataSource === "product_studio" ? "Product Studio" : "Static",
        children: (section.children?.length ? section.children : createSectionFromTemplate(template.id, 0).children).map((child, index) => ({
          ...child,
          label: index === 0 && zone.nodeKind ? zone.label : child.label,
          content: {
            ...child.content,
            title: child.content?.title === "New section" && zone.textSample ? zone.textSample.slice(0, 80) : child.content?.title
          },
          dataBinding: sanitizeBindingReference({ ...child.dataBinding, source: mappingWizard.dataSource, fieldMappings: mappingWizard.fieldMappings })
        }))
      };
      setStructure(result?.item || structure);
      setSections((current) => existing
        ? current.map((item) => item.componentId === existing.componentId ? mappedSection : item)
        : [...current, mappedSection]);
      setSelectedSectionId(mappedSection.componentId);
      setSelectedChildId(mappedSection.children?.[0]?.sectionId || "");
      setExpanded((current) => new Set([...current, mappedSection.componentId]));
      setMappingWizard((current) => ({ ...current, open: false }));
      setNotice({ tone: "success", message: `${zone.label} mapped to ${template.label}.` });
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Mapping could not be saved.") });
    } finally {
      setMappingSaving(false);
    }
  }

  async function saveDraft({ quiet = false } = {}) {
    if (!selectedSection) return false;
    setSaving(true);
    if (!quiet) setNotice({ tone: "", message: "" });
    try {
      const payload = serializeEnhancedSection(selectedSection);
      const result = await apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(selectedSection.slot)}`, {
        method: "PUT",
        body: payload
      });
      const normalized = normalizeLegacySection(result?.item || { ...payload, slot: selectedSection.slot });
      updateSection(selectedSection.componentId, () => ({ ...normalized, componentId: selectedSection.componentId }));
      if (!quiet) setNotice({ tone: "success", message: "Draft saved." });
      return true;
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Draft save failed.") });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!selectedSection) return;
    setPublishing(true);
    setNotice({ tone: "", message: "" });
    try {
      const saved = await saveDraft({ quiet: true });
      if (!saved) return;

      const callAction = (action, { publishEnglishOnly = false } = {}) =>
        apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(selectedSection.slot)}/actions`, {
          method: "POST",
          body: {
            action,
            ...(publishEnglishOnly ? { publish_english_only: true } : {})
          }
        });

      for (const action of ["DRAFT_READY", "APPROVE"]) {
        try {
          await callAction(action);
        } catch (error) {
          const code = String(error?.code || error?.payload?.error || error?.message || "");
          if (!code.includes("INVALID_TRANSITION")) throw error;
        }
      }

      let result = await callAction("PUBLISH");
      if (result?.publish_state === TRANSLATION_CONFIRM_REQUIRED) {
        const confirmed = await confirmEnglishOnlyPublish();
        if (!confirmed) {
          setNotice({
            tone: "error",
            message: "Publish paused. The section remains a draft until translation is available or English-only publishing is confirmed."
          });
          return;
        }
        result = await callAction("PUBLISH", { publishEnglishOnly: true });
      }

      const publishedStatus = String(result?.item?.status || "").trim().toLowerCase();
      const publishCompleted = publishedStatus === "published" || [
        "published_with_translation",
        "published_english_only"
      ].includes(result?.publish_state);
      if (!publishCompleted) {
        throw new Error("The server did not confirm publication. The section remains a draft.");
      }

      if (result?.item) {
        const normalized = normalizeLegacySection(result.item);
        updateSection(selectedSection.componentId, () => ({
          ...normalized,
          componentId: selectedSection.componentId,
          publishStatus: "published"
        }));
      } else {
        updateSection(selectedSection.componentId, (section) => ({ ...section, publishStatus: "published" }));
      }
      setNotice({
        tone: "success",
        message: result?.publish_state === "published_english_only"
          ? "Section published in English only."
          : "Section published."
      });
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Publish failed.") });
    } finally {
      setPublishing(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedChild) return;
    setEditor({
      open: true,
      file,
      sourceUrl: "",
      childId: selectedChild.sectionId,
      previousImage: selectedChild.media?.image || ""
    });
  }

  function editCurrentImage() {
    if (!selectedChild?.media?.image) return;
    setEditor({
      open: true,
      file: null,
      sourceUrl: assetUrl(selectedChild.media.image),
      childId: selectedChild.sectionId,
      previousImage: selectedChild.media.image
    });
  }

  async function uploadEditedImage(result) {
    const file = result?.file;
    const targetChildId = editor.childId;
    const previousImage = editor.previousImage || "";
    setEditor({ open: false, file: null, sourceUrl: "", childId: "", previousImage: "" });
    if (!file || !targetChildId) return;
    setUploading(true);
    setNotice({ tone: "", message: "" });
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = previewUrl;
    if (selectedSection) {
      updateSection(selectedSection.componentId, (section) => ({
        ...section,
        children: replaceAt(section.children || [], targetChildId, (child) => ({
          ...child,
          media: { ...child.media, image: previewUrl, uploadPending: true }
        }))
      }));
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asset_kind", "media");
      const payload = await apiFetch("/api/eip/ecom/uploads", { method: "POST", body: formData, timeoutMs: UPLOAD_TIMEOUT_MS });
      if (payload?.ok !== true || !(payload?.asset?.raw_url || payload?.asset?.url)) {
        const error = new Error(payload?.message || "Upload completed without an asset URL.");
        error.code = payload?.error || "UPLOAD_MISSING_URL";
        error.payload = payload;
        throw error;
      }
      const storedUrl = payload.asset.raw_url || payload.asset.url;
      if (selectedSection) {
        updateSection(selectedSection.componentId, (section) => ({
          ...section,
          children: replaceAt(section.children || [], targetChildId, (child) => ({
            ...child,
            media: {
              ...child.media,
              image: storedUrl,
              assetId: payload.asset.id || payload.asset.name || "",
              width: Number(result?.width || 0),
              height: Number(result?.height || 0),
              mimeType: String(result?.mime_type || file.type || ""),
              uploadPending: false
            }
          }))
        }));
      }
      setNotice({ tone: "success", message: "Edited image uploaded and bound to the selected section." });
    } catch (error) {
      if (selectedSection) {
        updateSection(selectedSection.componentId, (section) => ({
          ...section,
          children: replaceAt(section.children || [], targetChildId, (child) => ({
            ...child,
            media: { ...child.media, image: previousImage, uploadPending: false }
          }))
        }));
      }
      setNotice({ tone: "error", message: messageFor(error, "Image upload failed.") });
    } finally {
      setUploading(false);
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = "";
      }
    }
  }

  const visibleSections = sections.filter((section) => {
    const haystack = `${section.label} ${section.slot} ${section.componentType}`.toLowerCase();
    const sectionPage = String(section.slot || "").split(".")[0] || "home";
    return (sectionPage === page || sectionPage === "custom") && haystack.includes(search.trim().toLowerCase());
  });
  const previewChild = selectedChild || selectedSection?.children?.[0] || null;
  const previewImage = assetUrl(previewChild?.media?.image);
  const kind = previewKind(selectedSection?.componentType);
  const viewportClass = viewport === "mobile" ? "is-mobile" : viewport === "tablet" ? "is-tablet" : "is-desktop";
  const filteredTemplates = SECTION_TEMPLATES.filter(
    (template) => templateCategory === "All" || template.category === templateCategory || (templateCategory === "Popular" && ["hero", "hero_slider", "product_grid", "cta"].includes(template.id))
  );
  const mappingZone = scannerZones.find((zone) => zone.id === mappingWizard.zoneId) || null;
  const mappingTemplate = SECTION_TEMPLATES.find((template) => template.id === mappingWizard.templateId) || SECTION_TEMPLATES.at(-1);
  const canFreePosition = selectedSection?.componentType === "custom" && selectedSection?.locked !== true;
  const supportsMedia = ["hero", "hero_slider", "banner", "text_image", "media_gallery", "video_section", "product_detail", "custom"].includes(selectedSection?.componentType);
  const isProductTemplate = ["product_grid", "product_carousel", "product_detail"].includes(selectedSection?.componentType);
  const supportsButtons = !["media_gallery", "faq", "testimonial_grid", "feature_block", "product_grid", "product_carousel"].includes(selectedSection?.componentType);
  const selectedSectionIndex = selectedSection ? sections.findIndex((section) => section.componentId === selectedSection.componentId) : -1;
  const selectedChildIndex = selectedSection && selectedChild ? selectedSection.children.findIndex((child) => child.sectionId === selectedChild.sectionId) : -1;
  const unresolvedZones = scannerZones.filter((zone) => !["approved", "ignored"].includes(zone.status));
  const workflowStep = !structure || scanning ? 1 : unresolvedZones.length ? (selectedScannerZone ? 3 : 2) : selectedSection ? 4 : 2;

  return (
    <div className="cse-root">
      <div className="cse-topbar" role="toolbar" aria-label="Content Studio command bar">
        <div className="cse-brand cse-context-title">
          <span className="cse-mini-mark"><EipMark title="EIP" /></span>
          <span><small>Studio workspace</small><strong>Content workflow</strong></span>
        </div>
        <div className="cse-site-select">
          <span>Site:</span>
          <select value={connectionCode} onChange={(event) => setConnectionCode(event.target.value)}>
            {connections.length ? connections.map((connection) => (
              <option key={connection.connection_code} value={connection.connection_code}>
                {connection.connection_name || connection.connection_code}
              </option>
            )) : <option value="">No connected site</option>}
          </select>
          <span className={`cse-connected ${connections.length ? "is-connected" : ""}`}>{connections.length ? "Connected" : "Disconnected"}</span>
        </div>
        <div className="cse-top-actions">
          <button type="button" onClick={() => window.open(`${frontendUrl}/?content_preview=1`, "_blank", "noopener,noreferrer")} disabled={!frontendUrl} title={frontendUrl ? "Open the connected storefront preview" : "Choose a connected site first"}><Eye /> Preview</button>
          <button type="button" onClick={() => saveDraft()} disabled={saving || !selectedSection} title={!selectedSection ? "Select a section before saving" : saving ? "Saving draft" : "Save current changes as a draft"}>{saving ? <Loader2 className="spin" /> : <Save />} Save Draft</button>
          <button type="button" className="primary" onClick={publish} disabled={publishing || !selectedSection} title={!selectedSection ? "Select a section before publishing" : publishing ? "Publishing" : "Save and publish the selected content"}>{publishing ? <Loader2 className="spin" /> : <UploadCloud />} Publish <ChevronDown /></button>
          <div className="cse-more-wrap">
            <button type="button" className="icon" onClick={() => setMoreOpen((value) => !value)} aria-label="More actions"><MoreHorizontal /></button>
            {moreOpen ? <div className="cse-more-menu"><button type="button" onClick={() => { setMoreOpen(false); void scanElements(); }}><RefreshCw /> Scan rendered DOM</button><button type="button" onClick={() => { setMoreOpen(false); setInspectorTab("Advanced"); }}><Code2 /> Component metadata</button></div> : null}
          </div>
          <button type="button" className="icon" onClick={() => setHelpOpen(true)} aria-label="Open workflow help"><HelpCircle /></button>
        </div>
      </div>

      {notice.message ? <div className={`cse-notice ${notice.tone}`}>{notice.message}<button type="button" onClick={() => setNotice({ tone: "", message: "" })}><X /></button></div> : null}

      <div className="cse-workflow-strip" aria-label="Content Studio workflow">
        {WORKFLOW_STEPS.map((step, index) => <span key={step} className={workflowStep === index + 1 ? "active" : workflowStep > index + 1 ? "complete" : ""}><b>{index + 1}</b>{step}</span>)}
      </div>

      <div className="cse-workspace">
        <aside className="cse-left">
          <div className="cse-panel-head"><div><strong>PAGE STRUCTURE</strong><span>Generated from last scan</span></div><button type="button" onClick={() => setTemplateOpen(true)} title="Add a new section that does not exist on the scanned page"><Plus /> Add</button></div>
          <p className="cse-panel-help">Detected sections from the live page. Select a section to edit or map it.</p>
          <Field label="Page" value={page} onChange={setPage} type="select" options={[
            { value: "home", label: "Homepage" }, { value: "patterns", label: "Product page" }, { value: "pages", label: "Pages" }, { value: "blog", label: "Blog" }
          ]} />
          <div className="cse-search"><ScanSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search components..." /></div>
          <div className="cse-tree">
            <div className="cse-page-node"><Layers3 /> {page === "home" ? "Homepage" : page === "patterns" ? "Product Page" : page}</div>
            {loading ? <div className="cse-empty"><Loader2 className="spin" /> Loading structure…</div> : null}
            {!loading && !visibleSections.length ? <div className="cse-empty">No mapped sections yet. Add a template or map a scan result.</div> : null}
            {visibleSections.map((section) => {
              const isExpanded = expanded.has(section.componentId);
              const active = selectedSection?.componentId === section.componentId;
              const state = sectionState(section);
              return (
                <div key={section.componentId} className="cse-tree-group">
                  <button type="button" className={`cse-tree-parent ${active ? "active" : ""}`} onClick={() => selectSection(section)}>
                    <span onClick={(event) => { event.stopPropagation(); setExpanded((current) => { const next = new Set(current); if (next.has(section.componentId)) next.delete(section.componentId); else next.add(section.componentId); return next; }); }}>
                      {isExpanded ? <ChevronDown /> : <ChevronRight />}
                    </span>
                    <ImageIcon /> <strong>{section.label}</strong>
                    <span className="cse-tree-state"><em className={state.code}>{state.label}</em><em className={section.source === "Product Studio" ? "linked" : "static"}>{section.source === "Product Studio" ? "Product Studio" : "Manual"}</em></span>
                  </button>
                  {isExpanded ? (
                    <div className="cse-tree-children">
                      {(section.children || []).map((child) => (
                        <div key={child.sectionId} className="cse-tree-child-group">
                          <button type="button" className={selectedChild?.sectionId === child.sectionId && active ? "active" : ""} onClick={() => selectSection(section, child)}>
                            <GripVertical /><ImageIcon /><span>{child.label}</span>{child.visible !== false ? <i /> : <EyeOff />}
                          </button>
                          {(child.content?.buttons || []).length ? <div className="cse-tree-buttons"><button type="button" onClick={() => { selectSection(section, child); setInspectorTab("Content"); }}><Link2 /><span>Button group ({child.content.buttons.length})</span><i /></button></div> : null}
                        </div>
                      ))}
                      <button type="button" className="add-child" onClick={() => { selectSection(section); const next = addChild(section); updateSection(section.componentId, () => next); setSelectedChildId(next.children.at(-1)?.sectionId || ""); }}><Plus /> Add {childLabel(section)}</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="cse-actions-box">
            <strong>ACTIONS</strong><span>Reorder or manage selected section</span>
            <div><button type="button" onClick={() => moveSection("up")} disabled={selectedSectionIndex <= 0} title={selectedSectionIndex <= 0 ? "This section is already first" : "Move section up"}><ArrowUp /> Move Up</button><button type="button" onClick={() => moveSection("down")} disabled={selectedSectionIndex < 0 || selectedSectionIndex === sections.length - 1} title={selectedSectionIndex < 0 ? "Select a section first" : selectedSectionIndex === sections.length - 1 ? "This section is already last" : "Move section down"}><ArrowDown /> Move Down</button></div>
            <div><button type="button" onClick={duplicateSection} disabled={!selectedSection} title={selectedSection ? "Duplicate selected section" : "Select a section first"}><Copy /> Duplicate</button><button type="button" disabled={!selectedSection} title={selectedSection ? "Change section visibility" : "Select a section first"} onClick={() => selectedSection && updateSection(selectedSection.componentId, (section) => ({ ...section, visible: !section.visible }))}>{selectedSection?.visible === false ? <Eye /> : <EyeOff />} Hide / Show</button></div>
            <button type="button" className="danger" disabled={!selectedSection} title={selectedSection ? "Delete selected section" : "Select a section first"} onClick={deleteSelectedSection}><Trash2 /> Delete</button>
          </div>

          <div className="cse-scanner">
            <div className="cse-scanner-head"><div><strong>PAGE ANALYSIS</strong><span>{scannerZones.length ? `${scannerZones.length} detected sections · ${unresolvedZones.length} need review` : "Connect a site, then analyze its live page"}</span></div><button type="button" onClick={scanElements} disabled={scanning || !connectionCode} title={!connectionCode ? "Choose a connected site first" : scannerZones.length ? "Refresh Page Structure from the rendered page" : "Generate Page Structure from the rendered page"}>{scanning ? <Loader2 className="spin" /> : <RefreshCw />} {scannerZones.length ? "Rescan" : "Analyze Page"}</button></div>
            {scannerZones.length ? <div className="cse-analysis-actions"><button type="button" onClick={acceptSuggestedMapping} disabled={!unresolvedZones.length} title={!unresolvedZones.length ? "All detected sections have a mapping decision" : "Review and confirm the next suggested mapping"}><CheckCircle2 /> Accept Suggested Mapping</button><button type="button" onClick={reviewUnmapped} disabled={!unresolvedZones.length} title={!unresolvedZones.length ? "No unmapped sections remain" : "Select the next section that needs review"}><Eye /> Review Unmapped</button></div> : null}
            {structure?.rendered_dom_available === true ? <p className="cse-scan-source"><CheckCircle2 /> Chromium rendered DOM · {structure?.scan_source || "rendered_dom_scan"}</p> : null}
            <div className="cse-dom-tree">
              {scannerTree.length ? scannerTree.map((node) => <ScannerTreeNode key={node.id} node={node} selectedId={selectedZoneId} onView={viewScannerZone} onMap={openMappingWizard} onIgnore={ignoreScannerZone} />) : <div className="cse-empty"><ScanSearch /> No rendered DOM scan yet.</div>}
            </div>
          </div>
        </aside>

        <main className="cse-center">
          <div className="cse-preview-head">
            <div className="cse-preview-title"><strong>LIVE PREVIEW</strong><span>Click any highlighted area to edit it.</span></div>
            <div className="cse-viewports">
              <button className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Monitor /></button>
              <button className={viewport === "tablet" ? "active" : ""} onClick={() => setViewport("tablet")}><Tablet /></button>
              <button className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone /></button>
            </div>
            <div><button type="button" onClick={resetPreviewLayout} disabled={!selectedChild} title="Reset preview position and size"><RotateCcw /></button><button type="button" onClick={() => window.open(frontendUrl, "_blank", "noopener,noreferrer")} disabled={!frontendUrl} title="Open connected storefront"><ArrowRight /></button><button type="button" onClick={() => setInspectorTab("Advanced")} disabled={!selectedSection} title="Open component metadata"><Code2 /></button></div>
          </div>
          <div className={`cse-preview-frame ${viewportClass}`}>
            <div className="cse-site-shell">
              <div className="cse-site-nav"><strong>SAMARA</strong><nav><span>Patterns</span><span>Courses</span><span>Blog</span><span>Reviews</span><span>Contacts</span></nav><div><ScanSearch /><HeartIcon /><span>EN</span></div></div>
              {selectedScannerZone ? (
                <div className="cse-rendered-preview">
                  <div className="cse-rendered-target"><span>Detected Section</span><strong>{selectedScannerZone.label}</strong><small>{scannerState(selectedScannerZone).label} · {selectedScannerZone.nodeKind} · {selectedScannerZone.contentMode}</small></div>
                  {renderedPreviewUrl ? <iframe key={`${selectedScannerZone.id}:${renderedPreviewUrl}`} src={renderedPreviewUrl} title={`Rendered preview of ${selectedScannerZone.label}`} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" /> : <div className="cse-preview-empty">The connected storefront URL is unavailable.</div>}
                </div>
              ) : !selectedSection ? <div className="cse-preview-empty">Select a detected DOM node or add a section to begin.</div> : (
                <section
                  className={`cse-selected-preview kind-${kind} ${selectedSection.visible === false ? "is-hidden" : ""}`}
                  style={{
                    width: `${Number(previewChild?.display?.widthPercent) || 100}%`,
                    minHeight: `${Number(previewChild?.display?.heightPx) || 330}px`,
                    transform: `translate(${Number(previewChild?.display?.offsetX) || 0}px, ${Number(previewChild?.display?.offsetY) || 0}px)`
                  }}
                  onPointerMove={updatePreviewInteraction}
                  onPointerUp={endPreviewInteraction}
                  onPointerCancel={endPreviewInteraction}
                  onClick={(event) => { if (event.target === event.currentTarget) selectPreviewElement(previewChild); }}
                >
                  <span className="cse-selection-label">{selectedSection.label}</span>
                  <div className="cse-element-toolbar"><button className="drag-handle" disabled={!canFreePosition} onPointerDown={(event) => beginPreviewInteraction("move", event)} title={canFreePosition ? "Drag element" : "This section follows template layout."}><GripVertical /></button><button onClick={() => moveSection("up")} disabled={selectedSectionIndex <= 0} title={selectedSectionIndex <= 0 ? "This section is already first" : "Move section up"}><ArrowUp /></button><button onClick={() => moveSection("down")} disabled={selectedSectionIndex === sections.length - 1} title={selectedSectionIndex === sections.length - 1 ? "This section is already last" : "Move section down"}><ArrowDown /></button><button onClick={duplicateSection} title="Duplicate section"><Copy /></button><button onClick={() => updateSection(selectedSection.componentId, (section) => ({ ...section, locked: !section.locked }))} title={selectedSection.locked ? "Unlock" : "Lock"}>{selectedSection.locked ? <Lock /> : <Unlock />}</button><button onClick={() => updateSection(selectedSection.componentId, (section) => ({ ...section, visible: !section.visible }))} title="Hide or show"><Eye /></button><button onClick={() => setInspectorTab("Advanced")} title="Settings"><Settings2 /></button><button onClick={deleteSelectedSection} title="Delete section"><Trash2 /></button></div>
                  {kind === "product_grid" || kind === "product_carousel" || kind === "product_detail" ? (
                    <div className="cse-product-preview" onClick={() => selectPreviewElement(previewChild, "Data Binding")}><div><small>PRODUCT STUDIO</small><h2>{previewChild?.content?.title || selectedSection.label}</h2><p>Live products resolve from the saved collection reference.</p></div><div className="cse-product-cards">{[1, 2, 3, 4].map((item) => <article key={item}><ImageIcon /><strong>Product {item}</strong><span>Dynamic price</span></article>)}</div></div>
                  ) : kind === "media_gallery" ? (
                    <div className="cse-gallery-preview">{selectedSection.children.map((child) => <figure key={child.sectionId} className={child.sectionId === selectedChild?.sectionId ? "cse-preview-child-active" : ""} onClick={() => selectPreviewElement(child, "Media")}>{child.media?.image ? <img src={assetUrl(child.media.image)} alt={child.media?.alt || child.label} /> : <ImageIcon />}<figcaption>{child.media?.caption || child.content?.title || child.label}</figcaption></figure>)}</div>
                  ) : kind === "faq" ? (
                    <div className="cse-list-preview"><small>FAQ</small><h2>{selectedSection.label}</h2>{selectedSection.children.map((child) => <details key={child.sectionId} className={child.sectionId === selectedChild?.sectionId ? "cse-preview-child-active" : ""} open={child.sectionId === selectedChild?.sectionId} onClick={() => selectPreviewElement(child, "Quick Edit")}><summary>{child.content?.title || child.label}</summary><p>{child.content?.body || child.content?.subtitle || "Add an answer in the inspector."}</p></details>)}</div>
                  ) : kind === "testimonial_grid" || kind === "feature_block" ? (
                    <div className="cse-card-preview"><h2>{selectedSection.label}</h2><div>{selectedSection.children.map((child) => <article key={child.sectionId} className={child.sectionId === selectedChild?.sectionId ? "cse-preview-child-active" : ""} onClick={() => selectPreviewElement(child, "Quick Edit")}><Sparkles /><strong>{child.content?.title || child.label}</strong><p>{child.content?.body || child.content?.subtitle || "Add content in the inspector."}</p></article>)}</div></div>
                  ) : kind === "video_section" ? (
                    <div className="cse-video-preview" onClick={() => selectPreviewElement(previewChild, "Media")}><div><span>▶</span></div><h2>{previewChild?.content?.title || selectedSection.label}</h2><p>{previewChild?.content?.body || "Add the video details and supporting content."}</p></div>
                  ) : ["rich_text_block", "cta_block", "newsletter_form", "banner", "text_image"].includes(kind) ? (
                    <div className="cse-copy-preview" onClick={() => selectPreviewElement(previewChild, "Quick Edit")}><small>{previewChild?.content?.eyebrow || selectedSection.label}</small><h2>{previewChild?.content?.title || selectedSection.label}</h2><p>{previewChild?.content?.body || previewChild?.content?.subtitle || "Add content in the inspector."}</p><div className="cse-preview-buttons">{(previewChild?.content?.buttons || []).map((button) => <span key={button.id} className={button.style} onClick={(event) => { event.stopPropagation(); selectPreviewElement(previewChild, "Content"); }}>{button.label || "Button"}</span>)}</div></div>
                  ) : kind === "unknown" ? (
                    <div className="cse-unknown"><Code2 /><strong>Safe preview unavailable</strong><span>Unknown component type: {selectedSection.componentType}</span></div>
                  ) : (
                    <div className="cse-hero-preview" style={{ backgroundColor: previewChild?.media?.backgroundColor || "#c8b7a5" }}>
                      {previewImage ? <img src={previewImage} alt={previewChild?.media?.alt || previewChild?.content?.title || "Section media"} onClick={() => selectPreviewElement(previewChild, "Media")} /> : null}
                      <div className="cse-hero-overlay" style={{ opacity: Math.max(.2, Number(previewChild?.display?.overlay || 55) / 100) }} />
                      {selectedSection.children.length > 1 ? <><button type="button" className="cse-arrow left" onClick={() => selectPreviewSibling("previous")}><ArrowLeft /></button><button type="button" className="cse-arrow right" onClick={() => selectPreviewSibling("next")}><ArrowRight /></button></> : null}
                      <div className="cse-hero-copy" onClick={() => selectPreviewElement(previewChild, "Quick Edit")}><small>{previewChild?.content?.eyebrow || "SECTION EYEBROW"}</small><h1>{previewChild?.content?.title || selectedSection.label}</h1><p>{previewChild?.content?.subtitle || previewChild?.content?.body || "Add section copy in the inspector."}</p><div className="cse-preview-buttons">{(previewChild?.content?.buttons || []).map((button) => <span key={button.id} className={button.style} onClick={(event) => { event.stopPropagation(); selectPreviewElement(previewChild, "Content"); }}>{button.label || "Button"}</span>)}</div></div>
                    </div>
                  )}
                  {canFreePosition ? <><i className="resize nw" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /><i className="resize ne" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /><i className="resize sw" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /><i className="resize se" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /></> : <span className="cse-layout-note">This section follows template layout.</span>}
                </section>
              )}
            </div>
          </div>

          {!selectedScannerZone && selectedSection?.children?.length ? (
            <div className="cse-child-manager">
              <div className="cse-child-manager-head"><strong>{childLabel(selectedSection).toUpperCase()} MANAGEMENT: {selectedSection.label}</strong><span>{selectedSection.children.length} items</span>{["hero_slider", "product_carousel"].includes(selectedSection.componentType) ? <Toggle label="Autoplay" checked={selectedSection.autoplay === true} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, autoplay: value }))} /> : null}</div>
              <div className="cse-child-cards">
                {selectedSection.children.map((child, index) => (
                  <button type="button" draggable key={child.sectionId} className={selectedChild?.sectionId === child.sectionId ? "active" : ""} onClick={() => setSelectedChildId(child.sectionId)} onDragStart={(event) => event.dataTransfer.setData("text/plain", child.sectionId)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData("text/plain"); updateSection(selectedSection.componentId, (section) => moveChildTo(section, draggedId, child.sectionId)); }}>
                    <b>{index + 1}</b><div>{child.media?.image ? <img src={assetUrl(child.media.image)} alt="" /> : <ImageIcon />}</div><strong>{child.content?.title || child.label}</strong><small>{child.visible === false ? "Hidden" : "Active"}</small>
                  </button>
                ))}
                <button type="button" className="add-card" onClick={addSectionChild}><Plus /> Add New {childLabel(selectedSection)}</button>
              </div>
            </div>
          ) : null}

          <div className="cse-template-strip">
            <div><strong>COMPONENT LIBRARY</strong><span>Use templates to add a section that does not exist on the scanned page.</span></div>
            {SECTION_TEMPLATES.slice(0, 10).map((template) => <button key={template.id} type="button" onClick={() => addTemplate(template.id)}><ImageIcon />{template.label}</button>)}
            <button type="button" className="view-all" onClick={() => setTemplateOpen(true)}>View all components <ArrowRight /></button>
          </div>
        </main>

        <aside className="cse-right">
          <div className="cse-inspector-head"><div><strong>{selectedScannerZone ? "MAPPING STATUS" : "SECTION INSPECTOR"}</strong><span>Selected: {selectedScannerZone?.label || selectedSection?.label || "None"} {!selectedScannerZone && selectedChild ? `› ${selectedChild.label}` : ""}</span><small>Edit the selected section. Advanced settings are optional.</small></div><button type="button" onClick={() => { setSelectedZoneId(""); setSelectedSectionId("__none__"); setSelectedChildId(""); }} title="Clear selection"><X /></button></div>
          {!selectedScannerZone ? <div className="cse-inspector-tabs">{INSPECTOR_TABS.map((tab) => <button type="button" key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>)}</div> : null}
          <div className="cse-inspector-body">
            {selectedScannerZone ? <div className="cse-dom-inspector"><h4>DETECTED SECTION</h4><strong>{selectedScannerZone.label}</strong><div><span>{selectedScannerZone.nodeKind}</span><span>{selectedScannerZone.contentMode}</span><span className={scannerState(selectedScannerZone).code}>{scannerState(selectedScannerZone).label}</span></div>{selectedScannerZone.status !== "approved" ? <p className="cse-unmapped-message">This section was detected but not yet mapped.</p> : <p>This section is mapped and ready to edit.</p>}<dl><dt>Images</dt><dd>{selectedScannerZone.counts.images}</dd><dt>Buttons</dt><dd>{selectedScannerZone.counts.buttons}</dd><dt>Repeated items</dt><dd>{selectedScannerZone.counts.repeated}</dd></dl><button type="button" className="primary" onClick={() => openMappingWizard(selectedScannerZone)} disabled={!selectedScannerZone.pushAllowed} title={selectedScannerZone.pushAllowed ? "Open the guided mapping flow" : "Mapping is disabled by this connection profile"}>{selectedScannerZone.status === "approved" ? "Edit Mapping" : "Map This Section"}</button><button type="button" onClick={() => ignoreScannerZone(selectedScannerZone)} disabled={selectedScannerZone.status === "ignored"} title={selectedScannerZone.status === "ignored" ? "This section is already hidden" : "Hide this section from Page Structure"}>Hide Section</button><details className="cse-technical-details"><summary>Advanced technical details</summary><code>{selectedScannerZone.selector || selectedScannerZone.tag}</code><p>{selectedScannerZone.textSample || "No safe text sample was retained."}</p><small>Scanner confidence: {selectedScannerZone.confidence || "not reported"}</small></details></div> : null}
            {!selectedScannerZone && selectedChild ? <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFileSelected} /> : null}
            {!selectedScannerZone && (!selectedSection || !selectedChild) ? <div className="cse-empty">Select a child section to edit.</div> : null}
            {!selectedScannerZone && selectedChild && inspectorTab === "Quick Edit" ? (
              <>
                <h4>QUICK EDIT</h4>
                <p className="cse-inspector-tip">The most common fields for this {childLabel(selectedSection).toLowerCase()}.</p>
                <Field label="Title" value={selectedChild.content?.title} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, title: value } }))} />
                <Field label={selectedSection.componentType === "faq" ? "Answer" : "Subtitle"} value={selectedSection.componentType === "faq" ? selectedChild.content?.body : selectedChild.content?.subtitle} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, [selectedSection.componentType === "faq" ? "body" : "subtitle"]: value } }))} />
                {supportsMedia ? <div className="cse-quick-action"><ImageIcon /><span><strong>{selectedChild.media?.image ? "Image ready" : "No image selected"}</strong><small>Open the EIP photo toolkit to crop, resize, or replace it.</small></span><button type="button" onClick={selectedChild.media?.image ? editCurrentImage : openFilePicker}>{selectedChild.media?.image ? "Edit Image" : "Choose Image"}</button></div> : null}
                {isProductTemplate ? <div className="cse-quick-action"><Link2 /><span><strong>Product Studio source</strong><small>Products stay linked and are not copied.</small></span><button type="button" onClick={() => setInspectorTab("Data Binding")}>Configure</button></div> : null}
                {supportsButtons ? <div className="cse-quick-action"><MousePointer2 /><span><strong>{selectedChild.content?.buttons?.length || 0} buttons</strong><small>Edit labels, links, styles, and order.</small></span><button type="button" onClick={() => setInspectorTab("Content")}>Edit Buttons</button></div> : null}
                <Toggle label="Visible" checked={selectedChild.visible !== false} onChange={(value) => updateSelectedChild((child) => ({ ...child, visible: value }))} />
                <button type="button" className="cse-save-changes" onClick={() => saveDraft()} disabled={saving} title={saving ? "Saving changes" : "Save changes to this section"}>{saving ? <Loader2 className="spin" /> : <Save />} Save Changes</button>
              </>
            ) : null}
            {!selectedScannerZone && selectedChild && inspectorTab === "Content" ? (
              <>
                <h4>{selectedChild.sectionType.toUpperCase()} SETTINGS</h4>
                <Field label="Title" value={selectedChild.content?.title} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, title: value } }))} />
                <Field label={selectedSection.componentType === "faq" ? "Short answer" : "Subtitle"} value={selectedChild.content?.subtitle} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, subtitle: value } }))} />
                {["hero", "hero_slider", "banner", "cta_block"].includes(selectedSection.componentType) ? <Field label="Eyebrow / Small Title" value={selectedChild.content?.eyebrow} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, eyebrow: value } }))} /> : null}
                <Field label="Body / Rich text" type="textarea" rows={5} value={selectedChild.content?.body} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, body: value } }))} />
                {supportsButtons ? <><div className="cse-repeatable-head"><h4>BUTTONS</h4><button type="button" onClick={() => updateSelectedChild(addButton)}><Plus /> Add Button</button></div>
                <div className="cse-buttons-list">
                  {(selectedChild.content?.buttons || []).map((button, index) => (
                    <div className="cse-button-card" key={button.id}>
                      <div><strong>Button {index + 1}</strong><button type="button" onClick={() => updateSelectedChild((child) => reorderButton(child, button.id, "up"))} disabled={index === 0} title={index === 0 ? "This button is already first" : "Move button up"}><ArrowUp /></button><button type="button" onClick={() => updateSelectedChild((child) => reorderButton(child, button.id, "down"))} disabled={index === (selectedChild.content?.buttons || []).length - 1} title={index === (selectedChild.content?.buttons || []).length - 1 ? "This button is already last" : "Move button down"}><ArrowDown /></button><button type="button" onClick={() => updateSelectedChild((child) => deleteButton(child, button.id))} title="Delete this button"><Trash2 /></button></div>
                      <div className="two"><Field label="Label" value={button.label} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, label: value }), "id") } }))} /><Field label="Link" value={button.url} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, url: value }), "id") } }))} /></div>
                      <div className="two"><Field label="Style" type="select" value={button.style} options={[{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "link", label: "Text link" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, style: value }), "id") } }))} /><Field label="Icon (optional)" value={button.icon} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, icon: value }), "id") } }))} /></div>
                      <Toggle label="Open in new tab" checked={button.newTab === true} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, newTab: value }), "id") } }))} />
                    </div>
                  ))}
                </div></> : null}
              </>
            ) : null}

            {!selectedScannerZone && selectedChild && inspectorTab === "Data Binding" ? (
              <>
                <h4>CONTENT SOURCE</h4>
                <Field label="Content Source" type="select" value={selectedChild.dataBinding?.source || "static"} options={CONTENT_SOURCE_OPTIONS} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: sanitizeBindingReference({ ...child.dataBinding, source: value }) }))} />
                {selectedChild.dataBinding?.source === "product_studio" ? <p className="cse-help"><Link2 /> This section will display Product Studio data. Product data is not copied.</p> : null}
                {(selectedChild.dataBinding?.source || "static") !== "static" ? <>
                <Field label="Entity" type="select" value={selectedChild.dataBinding?.entity || ""} options={[{ value: "", label: "Select entity" }, { value: "product_current", label: "Product current" }, { value: "product_selected", label: "Product selected" }, { value: "products_collection", label: "Products collection" }, { value: "category", label: "Category" }, { value: "reviews", label: "Reviews" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, entity: value } }))} />
                <Field label="Reference / slug / ID" value={selectedChild.dataBinding?.reference || ""} placeholder="Product or collection reference" onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, reference: value } }))} />
                <Field label="Filter" value={selectedChild.dataBinding?.filter || ""} placeholder="featured=true, category=..." onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, filter: value } }))} />
                <div className="two"><Field label="Sort" value={selectedChild.dataBinding?.sort || ""} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, sort: value } }))} /><Field label="Limit" type="number" value={selectedChild.dataBinding?.limit || 8} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, limit: Number(value) } }))} /></div>
                <h4>FIELD MAPPING</h4>
                {["Image", "Eyebrow", "Title", "Description", "Price", "Button label"].map((field) => <Field key={field} label={field} value={selectedChild.dataBinding?.fieldMappings?.[field] || ""} placeholder={`${field.toLowerCase()} field path`} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, fieldMappings: { ...child.dataBinding.fieldMappings, [field]: value } } }))} />)}
                </> : <p className="cse-help"><CheckCircle2 /> Manual Content uses the fields in Quick Edit and Content. No external binding is required.</p>}
                {isProductTemplate || selectedChild.dataBinding?.source === "product_studio" ? <button type="button" className="cse-product-link" onClick={() => ctx?.user?.setActiveTab?.("catalog")}><ArrowRight /> View Source in Product Studio</button> : null}
              </>
            ) : null}

            {!selectedScannerZone && selectedChild && inspectorTab === "Media" ? (
              <>
                <h4>BACKGROUND MEDIA</h4>
                {!supportsMedia ? <p className="cse-help"><ImageIcon /> This template does not use section media. Choose a media-capable template to upload an image.</p> : null}
                {supportsMedia ? <>
                <div className="cse-media-card">
                  <div>{selectedChild.media?.image ? <img src={assetUrl(selectedChild.media.image)} alt="" /> : <ImageIcon />}</div>
                  <section><strong>{selectedChild.media?.assetId || "No stored image"}</strong><span>{selectedChild.media?.image || "Choose an image to edit and upload"}</span><div><button type="button" className="primary" onClick={selectedChild.media?.image ? editCurrentImage : openFilePicker}><ImageIcon /> {selectedChild.media?.image ? "Edit Image" : "Choose Image"}</button><button type="button" onClick={openFilePicker}><UploadCloud /> Replace</button><button type="button" onClick={() => updateSelectedChild((child) => ({ ...child, media: { ...child.media, image: "", assetId: "" } }))}><Trash2 /></button></div></section>
                </div>
                {uploading ? <p className="cse-uploading"><Loader2 className="spin" /> Uploading edited image…</p> : null}
                <Field label="Alt text" value={selectedChild.media?.alt || ""} onChange={(value) => updateSelectedChild((child) => ({ ...child, media: { ...child.media, alt: value } }))} />
                <Field label="Caption" value={selectedChild.media?.caption || ""} onChange={(value) => updateSelectedChild((child) => ({ ...child, media: { ...child.media, caption: value } }))} />
                <Field label="Background color" type="color" value={selectedChild.media?.backgroundColor || "#f4f1eb"} onChange={(value) => updateSelectedChild((child) => ({ ...child, media: { ...child.media, backgroundColor: value } }))} />
                </> : null}
              </>
            ) : null}

            {!selectedScannerZone && selectedChild && inspectorTab === "Display" ? (
              <>
                <h4>DISPLAY</h4>
                <Toggle label="Visible" checked={selectedChild.visible !== false} onChange={(value) => updateSelectedChild((child) => ({ ...child, visible: value }))} />
                <Field label="Section height" value={selectedChild.display?.height || "auto"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, height: value } }))} />
                {["hero", "hero_slider", "banner"].includes(selectedSection.componentType) ? <><Field label="Overlay %" type="number" value={selectedChild.display?.overlay || 55} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, overlay: Number(value) } }))} /><Field label="Content alignment" type="select" value={selectedChild.display?.alignment || "left"} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, alignment: value } }))} /></> : null}
                <Field label="Background color" type="color" value={selectedChild.display?.backgroundColor || "#ffffff"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, backgroundColor: value } }))} />
                <Field label="Style variant" value={selectedChild.display?.styleVariant || "default"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, styleVariant: value } }))} />
                <Field label="Layout variant" value={selectedChild.display?.layoutVariant || "default"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, layoutVariant: value } }))} />
                <Field label="Spacing" type="select" value={selectedChild.display?.spacing || "comfortable"} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, spacing: value } }))} />
                {!canFreePosition ? <p className="cse-help"><Lock /> This section follows template layout. Free drag and resize are disabled.</p> : null}
              </>
            ) : null}

            {!selectedScannerZone && selectedChild && inspectorTab === "Advanced" ? (
              <>
                <h4>COMPONENT METADATA</h4>
                <Field label="Component ID" value={selectedSection.componentId} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, componentId: value }))} />
                <Field label="Selector" value={selectedSection.selector || ""} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, selector: value }))} />
                <Field label="Mapping status" type="select" value={selectedSection.mappingStatus || "draft"} options={[{ value: "draft", label: "Draft" }, { value: "mapped", label: "Mapped" }, { value: "approved", label: "Approved" }, { value: "broken", label: "Broken" }]} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, mappingStatus: value }))} />
                <pre>{JSON.stringify({ componentId: selectedSection.componentId, componentType: selectedSection.componentType, child: selectedChild }, null, 2)}</pre>
              </>
            ) : null}
          </div>
          {!selectedScannerZone && selectedChild ? <div className="cse-inspector-footer"><button type="button" onClick={() => updateSection(selectedSection.componentId, (section) => reorderChild(section, selectedChild.sectionId, "up"))} disabled={selectedChildIndex <= 0} title={selectedChildIndex <= 0 ? `This ${childLabel(selectedSection).toLowerCase()} is already first` : `Move ${childLabel(selectedSection).toLowerCase()} up`}><ArrowUp /> Move</button><button type="button" onClick={() => updateSection(selectedSection.componentId, (section) => reorderChild(section, selectedChild.sectionId, "down"))} disabled={selectedChildIndex === selectedSection.children.length - 1} title={selectedChildIndex === selectedSection.children.length - 1 ? `This ${childLabel(selectedSection).toLowerCase()} is already last` : `Move ${childLabel(selectedSection).toLowerCase()} down`}><ArrowDown /> Move</button><button type="button" onClick={() => { const next = duplicateChild(selectedSection, selectedChild.sectionId); updateSection(selectedSection.componentId, () => next); setSelectedChildId(next.children.find((child) => child.label === `${selectedChild.label} Copy`)?.sectionId || selectedChild.sectionId); }} title={`Duplicate selected ${childLabel(selectedSection).toLowerCase()}`}><Copy /> Duplicate</button><button type="button" className="danger" onClick={removeSelectedChild} title={`Delete selected ${childLabel(selectedSection).toLowerCase()}`}><Trash2 /> Delete child</button></div> : null}
        </aside>
      </div>

      {templateOpen ? (
        <div className="cse-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplateOpen(false); }}>
          <div className="cse-template-modal">
            <div className="cse-modal-head"><div><strong>SECTION TEMPLATE LIBRARY</strong><span>Add a layout shell; content and repeatable children remain editable.</span></div><button type="button" onClick={() => setTemplateOpen(false)}><X /></button></div>
            <div className="cse-template-tabs">{SECTION_TEMPLATE_CATEGORIES.map((category) => <button type="button" key={category} className={templateCategory === category ? "active" : ""} onClick={() => setTemplateCategory(category)}>{category}</button>)}</div>
            <div className="cse-template-grid">{filteredTemplates.map((template) => <button type="button" key={template.id} onClick={() => addTemplate(template.id)}><div className={`template-${template.id}`}><ImageIcon /><Plus /></div><strong>{template.label}</strong><span>{template.description}</span><em>{template.dataSupport}</em></button>)}</div>
          </div>
        </div>
      ) : null}

      {mappingWizard.open && mappingZone ? (
        <div className="cse-modal-backdrop">
          <div className="cse-mapping-modal">
            <div className="cse-modal-head"><div><strong>MAP THIS SECTION</strong><span>{mappingZone.label} · guided mapping</span></div><button type="button" onClick={() => setMappingWizard((current) => ({ ...current, open: false }))} title="Close mapping"><X /></button></div>
            <div className="cse-wizard-steps">{["Choose Section Type", "Confirm Fields", "Content Source", "Save Mapping"].map((label, index) => <span key={label} className={mappingWizard.step >= index + 1 ? "active" : ""}><b>{index + 1}</b>{label}</span>)}</div>
            <div className="cse-wizard-body">
              {mappingWizard.step === 1 ? <div><h3>Choose what this section is</h3><p className="cse-wizard-intro">We detected “{mappingZone.label}”. Choose the template that best matches what the customer sees.</p><div className="cse-wizard-templates">{SECTION_TEMPLATES.map((template) => <button type="button" key={template.id} className={mappingWizard.templateId === template.id ? "active" : ""} onClick={() => setMappingWizard((current) => ({ ...current, templateId: template.id, dataSource: template.dataSupport === "Product Studio" ? "product_studio" : current.dataSource }))}><ImageIcon /><strong>{template.label}</strong><span>{template.description}</span></button>)}</div><details className="cse-technical-details"><summary>Advanced detected details</summary><code>{mappingZone.selector}</code><p>{mappingZone.nodeKind} · {mappingZone.contentMode}</p></details></div> : null}
              {mappingWizard.step === 2 ? <div><h3>Confirm detected fields</h3><div className="cse-detected-fields"><span><ImageIcon /> Images <b>{mappingZone.counts.images}</b></span><span><Link2 /> Links <b>{mappingZone.counts.links}</b></span><span><MousePointer2 /> Buttons <b>{mappingZone.counts.buttons}</b></span><span><Layers3 /> Repeated items <b>{mappingZone.counts.repeated}</b></span></div><Field label="Content slot" value={mappingWizard.slot} onChange={(value) => setMappingWizard((current) => ({ ...current, slot: value }))} /><div className="two"><Field label="Title field" value={mappingWizard.fieldMappings.title || ""} placeholder="Detected title" onChange={(value) => setMappingWizard((current) => ({ ...current, fieldMappings: { ...current.fieldMappings, title: value } }))} /><Field label="Image field" value={mappingWizard.fieldMappings.image || ""} placeholder="Detected image" onChange={(value) => setMappingWizard((current) => ({ ...current, fieldMappings: { ...current.fieldMappings, image: value } }))} /></div><Field label="Description field" value={mappingWizard.fieldMappings.description || ""} placeholder="Detected description" onChange={(value) => setMappingWizard((current) => ({ ...current, fieldMappings: { ...current.fieldMappings, description: value } }))} /></div> : null}
              {mappingWizard.step === 3 ? <div><h3>Choose Content Source</h3><Field label="Content Source" type="select" value={mappingWizard.dataSource} options={CONTENT_SOURCE_OPTIONS} onChange={(value) => setMappingWizard((current) => ({ ...current, dataSource: value }))} />{mappingWizard.dataSource === "product_studio" ? <p className="cse-help"><Link2 /> This section will display Product Studio data. Product data is not copied.</p> : <p className="cse-help"><CheckCircle2 /> Choose Manual Content for text and media managed directly in Content Studio.</p>}</div> : null}
              {mappingWizard.step === 4 ? <div className="cse-wizard-review"><CheckCircle2 /><h3>Ready to save mapping</h3><dl><dt>Detected section</dt><dd>{mappingZone.label}</dd><dt>Section type</dt><dd>{mappingTemplate.label}</dd><dt>Content slot</dt><dd>{mappingWizard.slot}</dd><dt>Content Source</dt><dd>{CONTENT_SOURCE_OPTIONS.find((option) => option.value === mappingWizard.dataSource)?.label || "Manual Content"}</dd></dl></div> : null}
            </div>
            <div className="cse-wizard-actions"><button type="button" onClick={() => setMappingWizard((current) => ({ ...current, step: Math.max(1, current.step - 1) }))} disabled={mappingWizard.step === 1} title={mappingWizard.step === 1 ? "You are at the first step" : "Return to the previous mapping step"}>Back</button>{mappingWizard.step < 4 ? <button type="button" className="primary" onClick={() => setMappingWizard((current) => ({ ...current, step: Math.min(4, current.step + 1) }))}>Continue</button> : <button type="button" className="primary" onClick={saveMapping} disabled={mappingSaving || !mappingWizard.slot.trim()} title={!mappingWizard.slot.trim() ? "Enter a Content slot before saving" : "Save this mapping"}>{mappingSaving ? <Loader2 className="spin" /> : <CheckCircle2 />} Save Mapping</button>}</div>
          </div>
        </div>
      ) : null}

      {confirmModal.open ? (
        <div className="cse-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirmModal(false); }}>
          <div className="cse-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="cse-confirm-title">
            <div className="cse-modal-head">
              <div><strong id="cse-confirm-title">{confirmModal.title}</strong><span>Content Studio confirmation</span></div>
              <button type="button" onClick={() => closeConfirmModal(false)} title="Close confirmation"><X /></button>
            </div>
            <p>{confirmModal.message}</p>
            <div className="cse-confirm-actions">
              <button type="button" onClick={() => closeConfirmModal(false)}>{confirmModal.cancelLabel || "Cancel"}</button>
              <button type="button" className="primary" onClick={() => closeConfirmModal(true)}>{confirmModal.confirmLabel || "Confirm"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {helpOpen ? <div className="cse-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}><div className="cse-help-modal"><div className="cse-modal-head"><div><strong>CONTENT STUDIO HELP</strong><span>A short guide from live page to published content.</span></div><button type="button" onClick={() => setHelpOpen(false)} title="Close help"><X /></button></div><ol><li><b>1</b><span><strong>What is Page Structure?</strong>It is the editable list generated when Analyze Page reads the live storefront.</span></li><li><b>2</b><span><strong>What is Mapping?</strong>Mapping tells EIP what a detected section is and which fields it contains.</span></li><li><b>3</b><span><strong>What is Product Studio Binding?</strong>It links a section to current Product Studio data without copying product records.</span></li><li><b>4</b><span><strong>How do I publish?</strong>Review highlighted sections, save changes, preview the page, then select Publish.</span></li></ol><button type="button" className="primary" onClick={() => { setHelpOpen(false); if (!scannerZones.length) void scanElements(); }}>Analyze Page</button></div></div> : null}

      <ImageAssetStudioModal
        open={editor.open}
        sourceFile={editor.file}
        sourceUrl={editor.sourceUrl}
        title="Edit section image"
        recommendedSize={{ width: 1920, height: 1080, label: "Section 16:9" }}
        defaultProfileId="hero-banner"
        applyLabel="Apply & Upload"
        onCancel={() => setEditor({ open: false, file: null, sourceUrl: "", childId: "", previousImage: "" })}
        onApply={uploadEditedImage}
      />
    </div>
  );
}

function HeartIcon() {
  return <span className="cse-heart">♡</span>;
}
