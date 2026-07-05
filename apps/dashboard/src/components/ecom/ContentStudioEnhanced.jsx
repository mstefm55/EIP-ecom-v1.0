import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
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
import ImageAssetStudioModal from "../shared/ImageAssetStudioModal";
import {
  SECTION_TEMPLATE_CATEGORIES,
  SECTION_TEMPLATES,
  addButton,
  addChild,
  createSectionFromTemplate,
  deleteButton,
  deleteChild,
  normalizeLegacySection,
  moveChildTo,
  previewKind,
  reorderChild,
  sanitizeBindingReference,
  serializeEnhancedSection
} from "./contentStudioEnhancedModel";
import "./ContentStudioEnhanced.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const PREVIEW_BASE_URL = import.meta.env.VITE_ECOM_PREVIEW_BASE_URL || "http://localhost:5174";
const UPLOAD_TIMEOUT_MS = 120000;

const INSPECTOR_TABS = ["Content", "Data Binding", "Media", "Display", "Advanced"];

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
  return error?.userMessage || payload.message || error?.message || fallback;
}

function replaceAt(items, id, updater, key = "sectionId") {
  return items.map((item) => (item?.[key] === id ? updater(item) : item));
}

function normalizeScannerZones(structure) {
  const zones = Array.isArray(structure?.zones) ? structure.zones : [];
  const candidates = Array.isArray(structure?.mapping_profile?.candidates)
    ? structure.mapping_profile.candidates
    : [];
  const source = zones.length ? zones : candidates;
  return source.map((zone, index) => ({
    id: String(zone.candidate_id || zone.id || zone.tag || `zone-${index + 1}`),
    label: String(zone.label || zone.tag || `Scanned element ${index + 1}`),
    tag: String(zone.suggested_slot || zone.tag || ""),
    selector: String(zone.selector || ""),
    type: String(zone.suggested_renderer || zone.renderer_type || "unknown"),
    status: String(zone.mapping_status || "unmapped"),
    page: String(zone.page || "home")
  }));
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

export default function ContentStudioEnhanced() {
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
  const [inspectorTab, setInspectorTab] = useState("Content");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateCategory, setTemplateCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState({ tone: "", message: "" });
  const [autoDetect, setAutoDetect] = useState(true);
  const [editor, setEditor] = useState({ open: false, file: null, sourceUrl: "", childId: "", previousImage: "" });
  const fileInputRef = useRef(null);
  const previewObjectUrlRef = useRef("");
  const previewInteractionRef = useRef(null);

  const scannerZones = useMemo(() => normalizeScannerZones(structure), [structure]);
  const selectedSection = useMemo(
    () => sections.find((section) => section.componentId === selectedSectionId) || sections[0] || null,
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
      if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
    };
  }, []);

  function selectSection(section, child = null) {
    setSelectedSectionId(section.componentId);
    setSelectedChildId(child?.sectionId || section.children?.[0]?.sectionId || "");
    setExpanded((current) => new Set([...current, section.componentId]));
  }

  function addTemplate(templateId) {
    const section = createSectionFromTemplate(templateId, sections.length);
    setSections((current) => [...current, section]);
    setSelectedSectionId(section.componentId);
    setSelectedChildId(section.children[0]?.sectionId || "");
    setExpanded((current) => new Set([...current, section.componentId]));
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

  async function scanElements() {
    setScanning(true);
    setNotice({ tone: "", message: "" });
    try {
      const result = await apiFetch("/api/eip/ecom/storefront/structure/scan", {
        method: "POST",
        body: { ...(connectionCode ? { connection_code: connectionCode } : {}), scan_mode: autoDetect ? "auto" : "tagged" }
      });
      setStructure(result?.item || null);
      setNotice({ tone: "success", message: `Scan complete: ${Number(result?.item?.usable_candidate_count || 0)} usable elements.` });
    } catch (error) {
      setNotice({ tone: "error", message: messageFor(error, "Element scan failed.") });
    } finally {
      setScanning(false);
    }
  }

  function mapScannerZone(zone) {
    const existing = sections.find((section) => section.slot === zone.tag);
    if (existing) {
      selectSection(existing);
      return;
    }
    const template = SECTION_TEMPLATES.find((entry) => entry.type === zone.type) || SECTION_TEMPLATES.at(-1);
    const section = createSectionFromTemplate(template.id, sections.length);
    section.slot = zone.tag || section.slot;
    section.label = zone.label;
    section.selector = zone.selector;
    section.mappingStatus = "mapped";
    setSections((current) => [...current, section]);
    selectSection(section);
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
    try {
      const saved = await saveDraft({ quiet: true });
      if (!saved) return;
      for (const action of ["DRAFT_READY", "APPROVE", "PUBLISH"]) {
        try {
          await apiFetch(`/api/eip/ecom/storefront/content/${encodeURIComponent(selectedSection.slot)}/actions`, {
            method: "POST",
            body: { action }
          });
        } catch (error) {
          if (!String(error?.message || "").includes("INVALID_TRANSITION")) throw error;
        }
      }
      updateSection(selectedSection.componentId, (section) => ({ ...section, publishStatus: "published" }));
      setNotice({ tone: "success", message: "Section published." });
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
    return haystack.includes(search.trim().toLowerCase());
  });
  const previewChild = selectedChild || selectedSection?.children?.[0] || null;
  const previewImage = assetUrl(previewChild?.media?.image);
  const kind = previewKind(selectedSection?.componentType);
  const viewportClass = viewport === "mobile" ? "is-mobile" : viewport === "tablet" ? "is-tablet" : "is-desktop";
  const filteredTemplates = SECTION_TEMPLATES.filter(
    (template) => templateCategory === "All" || template.category === templateCategory || (templateCategory === "Popular" && ["hero", "hero_slider", "product_grid", "cta"].includes(template.id))
  );

  return (
    <div className="cse-root">
      <header className="cse-topbar">
        <div className="cse-brand"><Sparkles /><strong>EIP</strong><span>Content Studio Enhanced</span></div>
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
          <button type="button" onClick={() => window.open(`${frontendUrl}/?content_preview=1`, "_blank", "noopener,noreferrer")}><Eye /> Preview</button>
          <button type="button" onClick={() => saveDraft()} disabled={saving || !selectedSection}>{saving ? <Loader2 className="spin" /> : <Save />} Save Draft</button>
          <button type="button" className="primary" onClick={publish} disabled={publishing || !selectedSection}>{publishing ? <Loader2 className="spin" /> : <UploadCloud />} Publish <ChevronDown /></button>
          <button type="button" className="icon"><MoreHorizontal /></button>
          <button type="button" className="icon"><HelpCircle /></button>
        </div>
      </header>

      {notice.message ? <div className={`cse-notice ${notice.tone}`}>{notice.message}<button type="button" onClick={() => setNotice({ tone: "", message: "" })}><X /></button></div> : null}

      <div className="cse-workspace">
        <aside className="cse-left">
          <div className="cse-panel-head"><strong>PAGE STRUCTURE</strong><button type="button" onClick={() => setTemplateOpen(true)}><Plus /> Add</button></div>
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
              return (
                <div key={section.componentId} className="cse-tree-group">
                  <button type="button" className={`cse-tree-parent ${active ? "active" : ""}`} onClick={() => selectSection(section)}>
                    <span onClick={(event) => { event.stopPropagation(); setExpanded((current) => { const next = new Set(current); if (next.has(section.componentId)) next.delete(section.componentId); else next.add(section.componentId); return next; }); }}>
                      {isExpanded ? <ChevronDown /> : <ChevronRight />}
                    </span>
                    <ImageIcon /> <strong>{section.label}</strong>
                    <em className={section.source === "Product Studio" ? "linked" : "static"}>{section.source === "Product Studio" ? "Linked" : "Static"}</em>
                  </button>
                  {isExpanded ? (
                    <div className="cse-tree-children">
                      {(section.children || []).map((child) => (
                        <button type="button" key={child.sectionId} className={selectedChild?.sectionId === child.sectionId && active ? "active" : ""} onClick={() => selectSection(section, child)}>
                          <GripVertical /><ImageIcon /><span>{child.label}</span>{child.visible !== false ? <i /> : <EyeOff />}
                        </button>
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
            <div><button type="button" onClick={() => moveSection("up")}><ArrowUp /> Move Up</button><button type="button" onClick={() => moveSection("down")}><ArrowDown /> Move Down</button></div>
            <div><button type="button" onClick={duplicateSection}><Copy /> Duplicate</button><button type="button" onClick={() => updateSection(selectedSection.componentId, (section) => ({ ...section, visible: !section.visible }))}>{selectedSection?.visible === false ? <Eye /> : <EyeOff />} Hide / Show</button></div>
            <button type="button" className="danger" onClick={() => { if (!selectedSection) return; setSections((current) => current.filter((section) => section.componentId !== selectedSection.componentId)); setSelectedSectionId(""); }}><Trash2 /> Delete</button>
          </div>

          <div className="cse-scanner">
            <div className="cse-scanner-head"><div><strong>ELEMENT SCANNER & MAPPING</strong><span>{scannerZones.length ? `Scan complete · ${scannerZones.length} elements` : "Ready to scan connected site"}</span></div><button type="button" onClick={scanElements} disabled={scanning}>{scanning ? <Loader2 className="spin" /> : <RefreshCw />} Rescan</button></div>
            <Toggle label="Auto-detect" checked={autoDetect} onChange={setAutoDetect} />
            <div className="cse-scan-results">
              {scannerZones.slice(0, 12).map((zone) => (
                <button type="button" key={zone.id} onClick={() => mapScannerZone(zone)}>
                  <span><Code2 /><strong>{zone.label}</strong><small>{zone.type}</small></span>
                  <em className={zone.status === "approved" || zone.status === "mapped" ? "mapped" : "unmapped"}>{zone.status}</em>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="cse-center">
          <div className="cse-preview-head">
            <strong>LIVE PREVIEW</strong>
            <div className="cse-viewports">
              <button className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Monitor /></button>
              <button className={viewport === "tablet" ? "active" : ""} onClick={() => setViewport("tablet")}><Tablet /></button>
              <button className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone /></button>
            </div>
            <div><button type="button"><RotateCcw /></button><button type="button"><ArrowRight /></button><button type="button"><Code2 /></button></div>
          </div>
          <div className={`cse-preview-frame ${viewportClass}`}>
            <div className="cse-site-shell">
              <div className="cse-site-nav"><strong>SAMARA</strong><nav><span>Patterns</span><span>Courses</span><span>Blog</span><span>Reviews</span><span>Contacts</span></nav><div><ScanSearch /><HeartIcon /><span>EN</span></div></div>
              {!selectedSection ? <div className="cse-preview-empty">Select or add a section to begin.</div> : (
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
                >
                  <span className="cse-selection-label">{selectedSection.label}</span>
                  <div className="cse-element-toolbar"><button className="drag-handle" onPointerDown={(event) => beginPreviewInteraction("move", event)} title="Drag element"><GripVertical /></button><button onClick={() => moveSection("up")}><ArrowUp /></button><button onClick={() => moveSection("down")}><ArrowDown /></button><button onClick={duplicateSection}><Copy /></button><button onClick={() => updateSection(selectedSection.componentId, (section) => ({ ...section, locked: !section.locked }))}>{selectedSection.locked ? <Lock /> : <Unlock />}</button><button onClick={() => updateSection(selectedSection.componentId, (section) => ({ ...section, visible: !section.visible }))}><Eye /></button><button onClick={() => setInspectorTab("Advanced")}><Settings2 /></button></div>
                  {kind === "product_grid" || kind === "product_carousel" ? (
                    <div className="cse-product-preview"><div><small>PRODUCT STUDIO</small><h2>{previewChild?.content?.title || selectedSection.label}</h2><p>Live products resolve from the saved collection reference.</p></div><div className="cse-product-cards">{[1, 2, 3, 4].map((item) => <article key={item}><ImageIcon /><strong>Product {item}</strong><span>Dynamic price</span></article>)}</div></div>
                  ) : kind === "unknown" ? (
                    <div className="cse-unknown"><Code2 /><strong>Safe preview unavailable</strong><span>Unknown component type: {selectedSection.componentType}</span></div>
                  ) : (
                    <div className="cse-hero-preview" style={{ backgroundColor: previewChild?.media?.backgroundColor || "#c8b7a5" }}>
                      {previewImage ? <img src={previewImage} alt={previewChild?.media?.alt || previewChild?.content?.title || "Section media"} /> : null}
                      <div className="cse-hero-overlay" style={{ opacity: Math.max(.2, Number(previewChild?.display?.overlay || 55) / 100) }} />
                      <button type="button" className="cse-arrow left"><ArrowLeft /></button><button type="button" className="cse-arrow right"><ArrowRight /></button>
                      <div className="cse-hero-copy"><small>{previewChild?.content?.eyebrow || "SECTION EYEBROW"}</small><h1>{previewChild?.content?.title || selectedSection.label}</h1><p>{previewChild?.content?.subtitle || previewChild?.content?.body || "Add section copy in the inspector."}</p><div className="cse-preview-buttons">{(previewChild?.content?.buttons || []).map((button) => <span key={button.id} className={button.style}>{button.label || "Button"}</span>)}</div></div>
                    </div>
                  )}
                  <i className="resize nw" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /><i className="resize ne" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /><i className="resize sw" onPointerDown={(event) => beginPreviewInteraction("resize", event)} /><i className="resize se" onPointerDown={(event) => beginPreviewInteraction("resize", event)} />
                </section>
              )}
              <div className="cse-benefits"><span><Sparkles /><b>Premium Quality</b><small>Carefully crafted content</small></span><span><UploadCloud /><b>Instant Download</b><small>Start creating right away</small></span><span><Layers3 /><b>Step-by-Step Guides</b><small>Easy to follow instructions</small></span></div>
            </div>
          </div>

          {selectedSection?.children?.length ? (
            <div className="cse-child-manager">
              <div className="cse-child-manager-head"><strong>{childLabel(selectedSection).toUpperCase()} MANAGEMENT: {selectedSection.label}</strong><span>{selectedSection.children.length} items</span><Toggle label="Autoplay" checked={selectedSection.componentType === "hero_slider"} onChange={() => {}} /></div>
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
            <div><strong>COMPONENT LIBRARY</strong><span>Drag or add to page</span></div>
            {SECTION_TEMPLATES.slice(0, 10).map((template) => <button key={template.id} type="button" onClick={() => addTemplate(template.id)}><ImageIcon />{template.label}</button>)}
            <button type="button" className="view-all" onClick={() => setTemplateOpen(true)}>View all components <ArrowRight /></button>
          </div>
        </main>

        <aside className="cse-right">
          <div className="cse-inspector-head"><div><strong>SECTION INSPECTOR</strong><span>Selected: {selectedSection?.label || "None"} {selectedChild ? `› ${selectedChild.label}` : ""}</span></div><button type="button"><X /></button></div>
          <div className="cse-inspector-tabs">{INSPECTOR_TABS.map((tab) => <button type="button" key={tab} className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>)}</div>
          <div className="cse-inspector-body">
            {!selectedSection || !selectedChild ? <div className="cse-empty">Select a child section to edit.</div> : null}
            {selectedChild && inspectorTab === "Content" ? (
              <>
                <h4>{selectedChild.sectionType.toUpperCase()} SETTINGS</h4>
                <Field label="Title" value={selectedChild.content?.title} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, title: value } }))} />
                <Field label="Subtitle" value={selectedChild.content?.subtitle} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, subtitle: value } }))} />
                <Field label="Eyebrow / Small Title" value={selectedChild.content?.eyebrow} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, eyebrow: value } }))} />
                <Field label="Body / Rich text" type="textarea" rows={5} value={selectedChild.content?.body} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, body: value } }))} />
                <div className="cse-repeatable-head"><h4>BUTTONS</h4><button type="button" onClick={() => updateSelectedChild(addButton)}><Plus /> Add Button</button></div>
                <div className="cse-buttons-list">
                  {(selectedChild.content?.buttons || []).map((button, index) => (
                    <div className="cse-button-card" key={button.id}>
                      <div><GripVertical /><strong>Button {index + 1}</strong><button type="button" onClick={() => updateSelectedChild((child) => deleteButton(child, button.id))}><Trash2 /></button></div>
                      <div className="two"><Field label="Label" value={button.label} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, label: value }), "id") } }))} /><Field label="Link" value={button.url} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, url: value }), "id") } }))} /></div>
                      <div className="two"><Field label="Style" type="select" value={button.style} options={[{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "link", label: "Text link" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, style: value }), "id") } }))} /><Field label="Icon (optional)" value={button.icon} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, icon: value }), "id") } }))} /></div>
                      <Toggle label="Open in new tab" checked={button.newTab === true} onChange={(value) => updateSelectedChild((child) => ({ ...child, content: { ...child.content, buttons: replaceAt(child.content.buttons, button.id, (item) => ({ ...item, newTab: value }), "id") } }))} />
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            {selectedChild && inspectorTab === "Data Binding" ? (
              <>
                <h4>DATA SOURCE</h4>
                <Field label="Source" type="select" value={selectedChild.dataBinding?.source || "static"} options={[{ value: "static", label: "Static Content" }, { value: "product_studio", label: "Product Studio" }, { value: "category_data", label: "Category Data" }, { value: "custom_api", label: "Custom / Future API" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: sanitizeBindingReference({ ...child.dataBinding, source: value }) }))} />
                <Field label="Entity" type="select" value={selectedChild.dataBinding?.entity || ""} options={[{ value: "", label: "Select entity" }, { value: "product_current", label: "Product current" }, { value: "product_selected", label: "Product selected" }, { value: "products_collection", label: "Products collection" }, { value: "category", label: "Category" }, { value: "reviews", label: "Reviews" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, entity: value } }))} />
                <Field label="Reference / slug / ID" value={selectedChild.dataBinding?.reference || ""} placeholder="Product or collection reference" onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, reference: value } }))} />
                <Field label="Filter" value={selectedChild.dataBinding?.filter || ""} placeholder="featured=true, category=..." onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, filter: value } }))} />
                <div className="two"><Field label="Sort" value={selectedChild.dataBinding?.sort || ""} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, sort: value } }))} /><Field label="Limit" type="number" value={selectedChild.dataBinding?.limit || 8} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, limit: Number(value) } }))} /></div>
                <h4>FIELD MAPPING</h4>
                {["Image", "Eyebrow", "Title", "Description", "Price", "Button label"].map((field) => <Field key={field} label={field} value={selectedChild.dataBinding?.fieldMappings?.[field] || ""} placeholder={`${field.toLowerCase()} field path`} onChange={(value) => updateSelectedChild((child) => ({ ...child, dataBinding: { ...child.dataBinding, fieldMappings: { ...child.dataBinding.fieldMappings, [field]: value } } }))} />)}
                <p className="cse-help"><Link2 /> Only references and field mappings are stored. Product records remain in Product Studio.</p>
              </>
            ) : null}

            {selectedChild && inspectorTab === "Media" ? (
              <>
                <h4>BACKGROUND MEDIA</h4>
                <div className="cse-media-card">
                  <div>{selectedChild.media?.image ? <img src={assetUrl(selectedChild.media.image)} alt="" /> : <ImageIcon />}</div>
                  <section><strong>{selectedChild.media?.assetId || "No stored image"}</strong><span>{selectedChild.media?.image || "Choose an image to edit and upload"}</span><div><button type="button" className="primary" onClick={selectedChild.media?.image ? editCurrentImage : openFilePicker}><ImageIcon /> {selectedChild.media?.image ? "Edit Image" : "Choose Image"}</button><button type="button" onClick={openFilePicker}><UploadCloud /> Replace</button><button type="button" onClick={() => updateSelectedChild((child) => ({ ...child, media: { ...child.media, image: "", assetId: "" } }))}><Trash2 /></button></div></section>
                </div>
                {uploading ? <p className="cse-uploading"><Loader2 className="spin" /> Uploading edited image…</p> : null}
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFileSelected} />
                <Field label="Alt text" value={selectedChild.media?.alt || ""} onChange={(value) => updateSelectedChild((child) => ({ ...child, media: { ...child.media, alt: value } }))} />
                <Field label="Caption" value={selectedChild.media?.caption || ""} onChange={(value) => updateSelectedChild((child) => ({ ...child, media: { ...child.media, caption: value } }))} />
                <Field label="Background color" type="color" value={selectedChild.media?.backgroundColor || "#f4f1eb"} onChange={(value) => updateSelectedChild((child) => ({ ...child, media: { ...child.media, backgroundColor: value } }))} />
              </>
            ) : null}

            {selectedChild && inspectorTab === "Display" ? (
              <>
                <h4>DISPLAY</h4>
                <Toggle label="Visible" checked={selectedChild.visible !== false} onChange={(value) => updateSelectedChild((child) => ({ ...child, visible: value }))} />
                <Field label="Section height" value={selectedChild.display?.height || "auto"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, height: value } }))} />
                <Field label="Overlay %" type="number" value={selectedChild.display?.overlay || 55} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, overlay: Number(value) } }))} />
                <Field label="Background color" type="color" value={selectedChild.display?.backgroundColor || "#ffffff"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, backgroundColor: value } }))} />
                <Field label="Style variant" value={selectedChild.display?.styleVariant || "default"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, styleVariant: value } }))} />
                <Field label="Layout variant" value={selectedChild.display?.layoutVariant || "default"} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, layoutVariant: value } }))} />
                <Field label="Spacing" type="select" value={selectedChild.display?.spacing || "comfortable"} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }]} onChange={(value) => updateSelectedChild((child) => ({ ...child, display: { ...child.display, spacing: value } }))} />
              </>
            ) : null}

            {selectedChild && inspectorTab === "Advanced" ? (
              <>
                <h4>COMPONENT METADATA</h4>
                <Field label="Component ID" value={selectedSection.componentId} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, componentId: value }))} />
                <Field label="Selector" value={selectedSection.selector || ""} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, selector: value }))} />
                <Field label="Mapping status" type="select" value={selectedSection.mappingStatus || "draft"} options={[{ value: "draft", label: "Draft" }, { value: "mapped", label: "Mapped" }, { value: "approved", label: "Approved" }, { value: "broken", label: "Broken" }]} onChange={(value) => updateSection(selectedSection.componentId, (section) => ({ ...section, mappingStatus: value }))} />
                <pre>{JSON.stringify({ componentId: selectedSection.componentId, componentType: selectedSection.componentType, child: selectedChild }, null, 2)}</pre>
              </>
            ) : null}
          </div>
          {selectedChild ? <div className="cse-inspector-footer"><button type="button" onClick={() => updateSection(selectedSection.componentId, (section) => reorderChild(section, selectedChild.sectionId, "up"))}><ArrowUp /> Move</button><button type="button" onClick={() => updateSection(selectedSection.componentId, (section) => reorderChild(section, selectedChild.sectionId, "down"))}><ArrowDown /> Move</button><button type="button" className="danger" onClick={removeSelectedChild}><Trash2 /> Delete child</button></div> : null}
        </aside>
      </div>

      {templateOpen ? (
        <div className="cse-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTemplateOpen(false); }}>
          <div className="cse-template-modal">
            <div className="cse-modal-head"><div><strong>SECTION TEMPLATE LIBRARY</strong><span>Add a layout shell; content and repeatable children remain editable.</span></div><button type="button" onClick={() => setTemplateOpen(false)}><X /></button></div>
            <div className="cse-template-tabs">{SECTION_TEMPLATE_CATEGORIES.map((category) => <button type="button" key={category} className={templateCategory === category ? "active" : ""} onClick={() => setTemplateCategory(category)}>{category}</button>)}</div>
            <div className="cse-template-grid">{filteredTemplates.map((template) => <button type="button" key={template.id} onClick={() => addTemplate(template.id)}><div><ImageIcon /><Plus /></div><strong>{template.label}</strong><span>{template.category}</span></button>)}</div>
          </div>
        </div>
      ) : null}

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
