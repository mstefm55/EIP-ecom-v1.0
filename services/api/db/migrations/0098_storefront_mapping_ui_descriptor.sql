-- Register reusable storefront Mapping Studio metadata on every dashboard surface.
-- Existing and future tenant dashboards use the same ECOM widget descriptor.

CREATE OR REPLACE FUNCTION pg_temp.patch_storefront_mapping_node(node jsonb, mapping_ui jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  next_node jsonb := node;
  patched_children jsonb;
BEGIN
  IF jsonb_typeof(node) <> 'object' THEN
    RETURN node;
  END IF;

  IF node->>'type' = 'EcomProductWorkspace'
     AND node->'props'->>'mode' = 'content-studio' THEN
    next_node := jsonb_set(
      next_node,
      '{props}',
      COALESCE(next_node->'props', '{}'::jsonb) || jsonb_build_object('storefrontMapping', mapping_ui),
      true
    );
  END IF;

  IF jsonb_typeof(next_node->'children') = 'array' THEN
    SELECT jsonb_agg(
      pg_temp.patch_storefront_mapping_node(child.value, mapping_ui)
      ORDER BY child.ordinality
    )
    INTO patched_children
    FROM jsonb_array_elements(next_node->'children') WITH ORDINALITY AS child(value, ordinality);

    next_node := jsonb_set(next_node, '{children}', COALESCE(patched_children, '[]'::jsonb), true);
  END IF;

  RETURN next_node;
END;
$$;

DO $$
DECLARE
  mapping_ui jsonb := $json$
  {
    "title": "Storefront mapping",
    "scanButtonLabel": "Scan",
    "scanningLabel": "Scanning...",
    "connectionLabel": "Scan connection",
    "modeLabel": "Scan mode",
    "connectionLoadingLabel": "Loading connections...",
    "connectionEmptyLabel": "No connected frontend",
    "structureLoadingLabel": "Loading structure...",
    "structureEmptyLabel": "No structure map yet. Run scan.",
    "zoneMappingLabel": "Zone mapping",
    "viewMapLabel": "View map",
    "scanModes": [
      { "value": "auto", "label": "Auto scan" },
      { "value": "rendered", "label": "Rendered DOM scan" },
      { "value": "generic", "label": "Static generic scan" },
      { "value": "tagged", "label": "Tagged fallback scan" }
    ],
    "rendererOptions": [
      "hero_slider",
      "product_carousel",
      "product_grid",
      "editorial_card_grid",
      "rich_text_block",
      "cta_block",
      "newsletter_form",
      "media_gallery",
      "testimonial_grid",
      "feature_block"
    ],
    "productSourceModes": [
      { "value": "", "label": "Editorial content" },
      { "value": "manual_products", "label": "Manual product codes" },
      { "value": "product_tag", "label": "Product tag" },
      { "value": "collection_or_drop", "label": "Collection or drop" },
      { "value": "hybrid_tag_overrides", "label": "Tag with manual overrides" }
    ],
    "slotPresets": [
      { "slot": "home.hero", "title": "Home hero", "page": "home", "mode": "hero", "description": "Main landing slider for the storefront home page." },
      { "slot": "pages.hero", "title": "Pages hero", "page": "pages", "mode": "hero", "description": "Hero band for the Pages tab." },
      { "slot": "pages.cards", "title": "Pages cards", "page": "pages", "mode": "cards", "description": "Card content shown inside Pages tab." },
      { "slot": "sizes.hero", "title": "Sizes hero", "page": "sizes", "mode": "hero", "description": "Intro copy and hero art for Sizes tab." },
      { "slot": "blog.hero", "title": "Blog hero", "page": "blog", "mode": "hero", "description": "Hero copy for the Blog tab." },
      { "slot": "line.hero", "title": "Line hero", "page": "line", "mode": "hero", "description": "Collection planning hero section." },
      { "slot": "line.cards", "title": "Line cards", "page": "line", "mode": "cards", "description": "Capsule cards for Line tab." },
      { "slot": "learning.hero", "title": "Learning hero", "page": "learning", "mode": "hero", "description": "Learning tab hero section." },
      { "slot": "learning.cards", "title": "Learning cards", "page": "learning", "mode": "cards", "description": "Training track/session cards." },
      { "slot": "collab.hero", "title": "Collab hero", "page": "collab", "mode": "hero", "description": "Collab shop hero section." },
      { "slot": "collab.cards", "title": "Collab cards", "page": "collab", "mode": "cards", "description": "Program cards for Collab tab." }
    ],
    "requiredFieldsByRenderer": {
      "hero_slider": ["slides"],
      "product_carousel": ["source_mode"],
      "product_grid": ["source_mode"],
      "editorial_card_grid": ["slides"],
      "rich_text_block": ["slides"],
      "cta_block": ["slides"],
      "newsletter_form": ["slides"]
    },
    "modal": {
      "eyebrow": "Storefront structure",
      "title": "Detected zone mapping",
      "subtitle": "Review inferred website zones, approve slots, then create governed content.",
      "closeLabel": "Close"
    },
    "actions": {
      "approve": "Approve",
      "edit": "Edit",
      "ignore": "Ignore",
      "reset": "Reset",
      "openContent": "Open content",
      "createContent": "Create content"
    }
  }
  $json$::jsonb;
BEGIN
  UPDATE eip_core.ui_surface
  SET tree = pg_temp.patch_storefront_mapping_node(tree, mapping_ui),
      updated_at = now()
  WHERE code = 'dashboard'
    AND is_active = true
    AND is_published = true
    AND tree::text LIKE '%EcomProductWorkspace%';
END;
$$;
