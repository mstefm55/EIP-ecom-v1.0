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
  { id: "hero", label: "Hero", type: "hero", category: "Popular", childType: "slide", childLabel: "Slide" },
  { id: "hero_slider", label: "Hero Slider", type: "hero_slider", category: "Popular", childType: "slide", childLabel: "Slide" },
  { id: "banner", label: "Banner", type: "banner", category: "Content", childType: "banner", childLabel: "Banner" },
  { id: "text_block", label: "Text Block", type: "rich_text_block", category: "Content", childType: "block", childLabel: "Block" },
  { id: "text_image", label: "Text + Image", type: "text_image", category: "Content", childType: "block", childLabel: "Block" },
  { id: "product_grid", label: "Product Grid", type: "product_grid", category: "E-commerce", childType: "product_collection", childLabel: "Collection" },
  { id: "product_carousel", label: "Product Carousel", type: "product_carousel", category: "E-commerce", childType: "product_collection", childLabel: "Collection" },
  { id: "product_detail", label: "Product Detail Block", type: "product_detail", category: "E-commerce", childType: "product", childLabel: "Product" },
  { id: "image_gallery", label: "Image Gallery", type: "media_gallery", category: "Media", childType: "image", childLabel: "Image" },
  { id: "video", label: "Video Section", type: "video_section", category: "Media", childType: "video", childLabel: "Video" },
  { id: "testimonials", label: "Testimonials", type: "testimonial_grid", category: "Engagement", childType: "testimonial", childLabel: "Testimonial" },
  { id: "benefits", label: "Benefits", type: "feature_block", category: "Popular", childType: "benefit", childLabel: "Benefit" },
  { id: "faq", label: "FAQ", type: "faq", category: "Engagement", childType: "question", childLabel: "Question" },
  { id: "newsletter", label: "Newsletter", type: "newsletter_form", category: "Engagement", childType: "form", childLabel: "Form" },
  { id: "cta", label: "CTA", type: "cta_block", category: "Popular", childType: "cta", childLabel: "CTA" },
  { id: "custom", label: "Custom Section", type: "custom", category: "Custom", childType: "block", childLabel: "Block" }
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
