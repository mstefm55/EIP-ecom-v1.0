const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const SECTION_TEMPLATE_CATEGORIES = [
  "All",
  "Popular",
  "E-commerce",
  "Content",
  "Engagement",
  "Media",
  "Custom"
];

export const SECTION_TEMPLATES = [
  { id: "hero", label: "Hero", type: "hero", category: "Popular", childType: "slide", childLabel: "Slide", dataSupport: "Mixed", description: "Lead message, media, and actions." },
  { id: "hero_slider", label: "Hero Slider", type: "hero_slider", category: "Popular", childType: "slide", childLabel: "Slide", dataSupport: "Mixed", description: "Repeatable hero slides with media." },
  { id: "banner", label: "Banner", type: "banner", category: "Content", childType: "banner", childLabel: "Banner", dataSupport: "Static", description: "Compact promotional message." },
  { id: "text_block", label: "Text Block", type: "rich_text_block", category: "Content", childType: "block", childLabel: "Block", dataSupport: "Static", description: "Structured editorial copy." },
  { id: "text_image", label: "Text + Image", type: "text_image", category: "Content", childType: "block", childLabel: "Block", dataSupport: "Mixed", description: "Editorial media and copy split." },
  { id: "product_grid", label: "Product Grid", type: "product_grid", category: "E-commerce", childType: "product_collection", childLabel: "Collection", dataSupport: "Product Studio", description: "Responsive product card grid." },
  { id: "product_carousel", label: "Product Carousel", type: "product_carousel", category: "E-commerce", childType: "product_collection", childLabel: "Collection", dataSupport: "Product Studio", description: "Scrollable product collection." },
  { id: "product_detail", label: "Product Detail Block", type: "product_detail", category: "E-commerce", childType: "product", childLabel: "Product", dataSupport: "Product Studio", description: "Current or selected product details." },
  { id: "image_gallery", label: "Image Gallery", type: "media_gallery", category: "Media", childType: "image", childLabel: "Image", dataSupport: "Static", description: "Repeatable edited image collection." },
  { id: "video", label: "Video Section", type: "video_section", category: "Media", childType: "video", childLabel: "Video", dataSupport: "Mixed", description: "Video and supporting content." },
  { id: "testimonials", label: "Testimonials", type: "testimonial_grid", category: "Engagement", childType: "testimonial", childLabel: "Testimonial", dataSupport: "Mixed", description: "Repeatable social proof cards." },
  { id: "benefits", label: "Benefits", type: "feature_block", category: "Popular", childType: "benefit", childLabel: "Benefit", dataSupport: "Static", description: "Feature or benefit cards." },
  { id: "faq", label: "FAQ", type: "faq", category: "Engagement", childType: "question", childLabel: "Question", dataSupport: "Mixed", description: "Repeatable questions and answers." },
  { id: "newsletter", label: "Newsletter", type: "newsletter_form", category: "Engagement", childType: "form", childLabel: "Form", dataSupport: "Static", description: "Email signup call-to-action." },
  { id: "cta", label: "CTA", type: "cta_block", category: "Popular", childType: "cta", childLabel: "CTA", dataSupport: "Static", description: "Focused message and button group." },
  { id: "custom", label: "Custom Section", type: "custom", category: "Custom", childType: "block", childLabel: "Block", dataSupport: "Mixed", description: "Flexible mapped component shell." }
];

export function createButton(index = 0) {
  return {
    id: uid("button"),
    label: index === 0 ? "Explore" : `Button ${index + 1}`,
    url: "",
    style: index === 0 ? "primary" : "secondary",
    icon: "",
    newTab: false
  };
}

export function createChild(sectionType = "block", index = 0, labelPrefix = "Item") {
  return {
    sectionId: uid(sectionType),
    sectionType,
    label: `${labelPrefix} ${index + 1}`,
    order: (index + 1) * 10,
    visible: true,
    locked: false,
    content: {
      eyebrow: "",
      title: index === 0 ? "New section" : `${labelPrefix} ${index + 1}`,
      subtitle: "",
      body: "",
      buttons: [createButton(0)]
    },
    media: {
      image: "",
      assetId: "",
      alt: "",
      caption: "",
      backgroundColor: "#f4f1eb"
    },
    dataBinding: {
      source: "static",
      entity: "",
      reference: "",
      filter: "",
      sort: "sort_order asc",
      limit: 8,
      fieldMappings: {}
    },
    display: {
      height: "auto",
      overlay: 55,
      backgroundColor: "#ffffff",
      styleVariant: "default",
      layoutVariant: "default",
      spacing: "comfortable"
    }
  };
}

export function createSectionFromTemplate(templateId, index = 0) {
  const template = SECTION_TEMPLATES.find((entry) => entry.id === templateId) || SECTION_TEMPLATES.at(-1);
  const child = createChild(template.childType, 0, template.childLabel);
  if (template.type === "product_grid" || template.type === "product_carousel") {
    child.dataBinding.source = "product_studio";
    child.dataBinding.entity = "products_collection";
  }
  return {
    componentId: uid(template.id),
    componentType: template.type,
    label: template.label,
    slot: `custom.${template.id}_${index + 1}`,
    selector: "",
    mappingStatus: "draft",
    visible: true,
    locked: false,
    autoplay: template.type === "hero_slider" || template.type === "product_carousel",
    order: (index + 1) * 10,
    children: [child],
    publishStatus: "draft",
    source: child.dataBinding.source === "product_studio" ? "Product Studio" : "Static"
  };
}

export function addChild(section) {
  const template = SECTION_TEMPLATES.find((entry) => entry.type === section.componentType);
  const children = Array.isArray(section.children) ? section.children : [];
  return {
    ...section,
    children: [...children, createChild(template?.childType || "block", children.length, template?.childLabel || "Item")]
  };
}

export function deleteChild(section, childId) {
  return { ...section, children: (section.children || []).filter((child) => child.sectionId !== childId) };
}

export function duplicateChild(section, childId) {
  const children = [...(section.children || [])];
  const index = children.findIndex((child) => child.sectionId === childId);
  if (index < 0) return section;
  const source = children[index];
  const copy = {
    ...source,
    sectionId: uid(source.sectionType || "item"),
    label: `${source.label || "Item"} Copy`,
    content: {
      ...source.content,
      buttons: (source.content?.buttons || []).map((button, buttonIndex) => ({
        ...button,
        id: uid(`button-${buttonIndex + 1}`)
      }))
    },
    media: { ...source.media },
    dataBinding: sanitizeBindingReference(source.dataBinding),
    display: { ...source.display }
  };
  children.splice(index + 1, 0, copy);
  return {
    ...section,
    children: children.map((child, childIndex) => ({ ...child, order: (childIndex + 1) * 10 }))
  };
}

export function reorderChild(section, childId, direction) {
  const children = [...(section.children || [])];
  const index = children.findIndex((child) => child.sectionId === childId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= children.length) return section;
  [children[index], children[target]] = [children[target], children[index]];
  return {
    ...section,
    children: children.map((child, childIndex) => ({ ...child, order: (childIndex + 1) * 10 }))
  };
}

export function moveChildTo(section, childId, targetId) {
  const children = [...(section.children || [])];
  const from = children.findIndex((child) => child.sectionId === childId);
  const to = children.findIndex((child) => child.sectionId === targetId);
  if (from < 0 || to < 0 || from === to) return section;
  const [moved] = children.splice(from, 1);
  children.splice(to, 0, moved);
  return {
    ...section,
    children: children.map((child, index) => ({ ...child, order: (index + 1) * 10 }))
  };
}

export function addButton(child) {
  const buttons = Array.isArray(child?.content?.buttons) ? child.content.buttons : [];
  return { ...child, content: { ...child.content, buttons: [...buttons, createButton(buttons.length)] } };
}

export function deleteButton(child, buttonId) {
  return {
    ...child,
    content: {
      ...child.content,
      buttons: (child.content?.buttons || []).filter((button) => button.id !== buttonId)
    }
  };
}

export function sanitizeBindingReference(binding = {}) {
  const source = ["static", "product_studio", "category_data", "custom_api"].includes(binding.source)
    ? binding.source
    : "static";
  return {
    source,
    entity: String(binding.entity || ""),
    reference: String(binding.reference || ""),
    filter: String(binding.filter || ""),
    sort: String(binding.sort || ""),
    limit: Math.max(1, Math.min(100, Number(binding.limit) || 8)),
    fieldMappings: binding.fieldMappings && typeof binding.fieldMappings === "object"
      ? { ...binding.fieldMappings }
      : {}
  };
}

export function templateIdForRenderer(renderer = "") {
  const normalized = String(renderer || "").trim().toLowerCase();
  const aliases = {
    navigation: "custom",
    footer_block: "custom",
    editorial_card_grid: "text_image",
    testimonial_grid: "testimonials",
    feature_block: "benefits",
    media_gallery: "image_gallery",
    rich_text_block: "text_block",
    newsletter_form: "newsletter",
    cta_block: "cta"
  };
  return SECTION_TEMPLATES.find((template) => template.type === normalized)?.id
    || aliases[normalized]
    || "custom";
}

export function normalizeScannerZones(structure) {
  const candidates = Array.isArray(structure?.mapping_profile?.candidate_zones)
    ? structure.mapping_profile.candidate_zones
    : Array.isArray(structure?.mapping_profile?.candidates)
      ? structure.mapping_profile.candidates
      : [];
  const zones = Array.isArray(structure?.zones) ? structure.zones : [];
  const source = candidates.length ? candidates : zones;
  return source.map((zone, index) => ({
    id: String(zone.candidate_id || zone.id || zone.tag || `zone-${index + 1}`),
    parentId: zone.parent_candidate_id ? String(zone.parent_candidate_id) : null,
    depth: Math.max(0, Number(zone.dom_depth || 0)),
    order: Math.max(0, Number(zone.dom_order ?? index)),
    label: String(zone.label || zone.text_sample || zone.suggested_slot || zone.tag || `Scanned element ${index + 1}`),
    page: String(zone.page || zone.suggested_slot?.split?.(".")?.[0] || zone.tag?.split?.(".")?.[0] || "home"),
    tag: String(zone.suggested_slot || zone.tag || ""),
    selector: String(zone.selector || ""),
    type: String(zone.suggested_renderer || zone.renderer_type || "unknown"),
    nodeKind: String(zone.node_kind || "section"),
    status: String(zone.mapping_status || "proposed"),
    contentMode: String(zone.content_mode || (Number(zone.repeated_item_count || 0) > 1 ? "dynamic" : "static")),
    visibility: String(zone.visibility || "visible"),
    source: String(zone.source || structure?.scan_source || ""),
    pushAllowed: zone.push_allowed !== false,
    textSample: String(zone.text_sample || ""),
    counts: {
      images: Number(zone.image_count || 0),
      links: Number(zone.link_count || 0),
      buttons: Number(zone.button_count || 0),
      repeated: Number(zone.repeated_item_count || 0)
    },
    bounds: zone.bounds && typeof zone.bounds === "object" ? { ...zone.bounds } : { width: 0, height: 0 }
  })).sort((a, b) => a.order - b.order);
}

export function buildScannerTree(zones = []) {
  const nodes = new Map(zones.map((zone) => [zone.id, { ...zone, children: [] }]));
  const roots = [];
  for (const zone of zones) {
    const node = nodes.get(zone.id);
    const parent = zone.parentId ? nodes.get(zone.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (items) => items
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ ...item, children: sort(item.children) }));
  return sort(roots);
}

function legacyProductSource(binding) {
  const reference = String(binding.reference || "").trim().toLowerCase();
  const filterTag = String(binding.filter || "").match(/(?:^|[,;\s])tag\s*=\s*([^,;\s]+)/i)?.[1]?.toLowerCase() || "";
  if (binding.entity === "product_current" || binding.entity === "product_selected") {
    return {
      mode: "manual_products",
      product_codes: reference ? [reference] : [],
      include_product_codes: [],
      exclude_product_codes: [],
      limit: binding.limit
    };
  }
  if (binding.entity === "category") {
    return {
      mode: "product_tag",
      tag: reference || filterTag,
      tags: [reference || filterTag].filter(Boolean),
      product_codes: [],
      include_product_codes: [],
      exclude_product_codes: [],
      limit: binding.limit
    };
  }
  return {
    mode: reference ? "collection_or_drop" : filterTag ? "product_tag" : "manual_products",
    collection_code: reference,
    tag: filterTag || reference,
    tags: [filterTag || reference].filter(Boolean),
    product_codes: [],
    include_product_codes: [],
    exclude_product_codes: [],
    limit: binding.limit
  };
}

export function normalizeLegacySection(item = {}, index = 0) {
  const enhanced = item?.attrs?.content_studio_enhanced;
  if (enhanced?.componentId && Array.isArray(enhanced.children)) {
    return {
      ...enhanced,
      slot: item.slot || enhanced.slot,
      label: item.title || enhanced.label,
      publishStatus: item.status || enhanced.publishStatus || "draft"
    };
  }
  const slides = Array.isArray(item.slides) ? item.slides : [];
  const componentType = String(item?.attrs?.renderer_type || (slides.length > 1 ? "hero_slider" : "hero") || "custom");
  const children = (slides.length ? slides : [{}]).map((slide, childIndex) => {
    const child = createChild("slide", childIndex, "Slide");
    const legacyButton = slide.cta_label
      ? [{ ...createButton(0), label: slide.cta_label, url: slide.cta_target || slide.cta_url || "", newTab: slide.cta_new_tab === true }]
      : [];
    return {
      ...child,
      sectionId: String(slide.id || slide.sectionId || uid("slide")),
      label: String(slide.label || `Slide ${childIndex + 1}`),
      order: Number(slide.order) || (childIndex + 1) * 10,
      content: {
        ...child.content,
        eyebrow: String(slide.eyebrow || ""),
        title: String(slide.title || ""),
        subtitle: String(slide.subtitle || slide.body || ""),
        body: String(slide.body || ""),
        buttons: (Array.isArray(slide.buttons) ? slide.buttons : legacyButton).map((button, buttonIndex) => ({
          ...createButton(buttonIndex),
          ...button,
          id: String(button?.id || uid("button")),
          newTab: button?.newTab === true || button?.new_tab === true
        }))
      },
      media: { ...child.media, image: String(slide.image || ""), alt: String(slide.alt || "") },
      dataBinding: sanitizeBindingReference(
        slide.dataBinding
          || (item?.attrs?.product_source
            ? { ...item.attrs.product_source, source: "product_studio" }
            : {})
      ),
      display: {
        ...child.display,
        overlay: Number(slide.overlay_strength) || 55,
        styleVariant: String(slide.overlay || "default")
      }
    };
  });
  return {
    componentId: String(item.id || item.code || item.slot || uid("component")),
    componentType,
    label: String(item.title || item.slot || `Section ${index + 1}`),
    slot: String(item.slot || `custom.section_${index + 1}`),
    selector: String(item?.attrs?.selector || ""),
    mappingStatus: String(item?.attrs?.mapping_status || "mapped"),
    visible: item.is_active !== false,
    locked: false,
    order: Number(item?.attrs?.order) || (index + 1) * 10,
    children,
    publishStatus: String(item.status || "draft"),
    source: String(item?.attrs?.source_mode || "").trim() ? "Product Studio" : "Static"
  };
}

export function serializeEnhancedSection(section) {
  const children = (section.children || []).map((child, index) => {
    const buttons = Array.isArray(child.content?.buttons) ? child.content.buttons : [];
    const firstButton = buttons[0] || null;
    return {
      id: child.sectionId,
      label: child.label,
      order: (index + 1) * 10,
      visible: child.visible !== false,
      eyebrow: child.content?.eyebrow || "",
      title: child.content?.title || "",
      subtitle: child.content?.subtitle || "",
      body: child.content?.body || child.content?.subtitle || "",
      buttons,
      image: child.media?.image || "",
      alt: child.media?.alt || "",
      dataBinding: sanitizeBindingReference(child.dataBinding),
      overlay_strength: Number(child.display?.overlay) || 55,
      overlay: child.display?.styleVariant || "default",
      cta_label: firstButton?.label || "",
      cta_target: firstButton?.url || "",
      cta_url: firstButton?.url || "",
      cta_new_tab: firstButton?.newTab === true
    };
  });
  const bindings = children.map((child) => child.dataBinding).filter((binding) => binding.source !== "static");
  const productBinding = bindings.find((binding) => binding.source === "product_studio" || binding.source === "category_data");
  const productSource = productBinding ? legacyProductSource(productBinding) : null;
  return {
    title: section.label || "Content section",
    is_active: section.visible !== false,
    slides: children,
    attrs: {
      renderer_type: section.componentType,
      mapping_status: section.mappingStatus,
      selector: section.selector || "",
      order: section.order,
      ...(productSource ? { source_mode: productSource.mode, product_source: productSource } : {}),
      content_studio_enhanced: {
        ...section,
        children: (section.children || []).map((child) => ({
          ...child,
          dataBinding: sanitizeBindingReference(child.dataBinding)
        }))
      }
    }
  };
}

export function previewKind(componentType) {
  if (SECTION_TEMPLATES.some((entry) => entry.type === componentType)) return componentType;
  return "unknown";
}
