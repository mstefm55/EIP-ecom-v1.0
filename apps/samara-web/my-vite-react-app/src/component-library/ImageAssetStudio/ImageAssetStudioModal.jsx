import { useEffect, useMemo, useRef, useState } from "react";
import "./ImageAssetStudioModal.css";

const SIZE_PRESETS = [
  { id: "product", label: "Product 4:5", width: 1200, height: 1500 },
  { id: "hero", label: "Hero 16:9", width: 1920, height: 1080 },
  { id: "article", label: "Article 3:2", width: 1800, height: 1200 },
  { id: "landscape", label: "Landscape 4:3", width: 1600, height: 1200 },
  { id: "square", label: "Square 1:1", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait 9:16", width: 1080, height: 1920 },
];

const FORMAT_OPTIONS = [
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WEBP" },
];

const DEFAULT_WORKFLOW_PROFILES = [
  {
    id: "product-card",
    label: "Product card",
    description: "Catalog cards and primary product media.",
    width: 1200,
    height: 1500,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 92,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "product-gallery",
    label: "Product gallery",
    description: "Detail gallery image with portrait crop.",
    width: 1400,
    height: 1750,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 92,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "hero-banner",
    label: "Hero banner",
    description: "Home hero and section sliders.",
    width: 1920,
    height: 1080,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "blog-cover",
    label: "Blog cover",
    description: "Blog article lead image.",
    width: 1800,
    height: 1200,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "content-block",
    label: "Content block",
    description: "Cards, promos, and rich content sections.",
    width: 1600,
    height: 1200,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90,
    backgroundColor: "#f4f1eb",
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundedInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function aspectKey(width, height) {
  if (!width || !height) return "";
  return `${width}:${height}`;
}

function computeBounds(width, height, angleDeg) {
  const radians = (Number(angleDeg || 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    width: Math.abs(width * cos) + Math.abs(height * sin),
    height: Math.abs(width * sin) + Math.abs(height * cos),
  };
}

function deriveFileName(fileName = "image", mimeType = "image/jpeg") {
  const base = String(fileName || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
  const ext =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${base || "image"}-edited.${ext}`;
}

function toMimeType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "png" || normalized === "image/png") return "image/png";
  if (normalized === "webp" || normalized === "image/webp") return "image/webp";
  if (
    normalized === "jpeg" ||
    normalized === "jpg" ||
    normalized === "image/jpeg" ||
    normalized === "image/jpg"
  ) {
    return "image/jpeg";
  }
  return "";
}

function normalizeProfile(profile, index = 0) {
  if (!profile || typeof profile !== "object") return null;
  const width = roundedInt(profile.width, 0);
  const height = roundedInt(profile.height, 0);
  if (!width || !height) return null;
  const rawId = String(profile.id || profile.code || `profile_${index + 1}`).trim().toLowerCase();
  const id = rawId.replace(/[^a-z0-9_-]/g, "_") || `profile_${index + 1}`;
  const fitRaw = String(profile.fitMode || profile.fit || "").trim().toLowerCase();
  const fitMode = fitRaw === "contain" ? "contain" : "cover";
  const mimeType = toMimeType(profile.mimeType || profile.format) || "image/jpeg";
  const quality = clamp(roundedInt(profile.quality, 92), 45, 100);
  const backgroundColor =
    typeof profile.backgroundColor === "string" && profile.backgroundColor.trim()
      ? profile.backgroundColor.trim()
      : "#f4f1eb";

  return {
    id,
    label: String(profile.label || profile.name || `Profile ${index + 1}`).trim(),
    description: String(profile.description || "").trim(),
    width,
    height,
    fitMode,
    mimeType,
    quality,
    backgroundColor,
  };
}

function isImageFile(file) {
  return Boolean(file && String(file.type || "").toLowerCase().startsWith("image/"));
}

const INITIAL_STATE = {
  open: false,
  file: null,
  title: "Image studio",
  recommendedSize: null,
};

const INITIAL_SOURCE_CROP = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP_NORMALIZED = 0.05;

export default function ImageAssetStudioModal({
  open = false,
  sourceFile = null,
  sourceUrl = "",
  title = "Image studio",
  recommendedSize = null,
  presetProfiles = null,
  defaultProfileId = "",
  onCancel = () => {},
  onApply = () => {},
}) {
  const imgRef = useRef(null);
  const [imageReady, setImageReady] = useState(false);
  const [sourceObjectUrl, setSourceObjectUrl] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [presetId, setPresetId] = useState("product");
  const [outputWidth, setOutputWidth] = useState(1200);
  const [outputHeight, setOutputHeight] = useState(1500);
  const [fitMode, setFitMode] = useState("cover");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [angle, setAngle] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState("#f4f1eb");
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [quality, setQuality] = useState(92);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });
  const cropStageRef = useRef(null);
  const extraObjectUrlsRef = useRef(new Set());
  const cropPointerRef = useRef({
    mode: "",
    handle: "",
    startRect: { ...INITIAL_SOURCE_CROP },
    startU: 0,
    startV: 0,
  });
  const [sourceCrop, setSourceCrop] = useState({ ...INITIAL_SOURCE_CROP });
  const [cropDragging, setCropDragging] = useState(false);
  const [cropStageSize, setCropStageSize] = useState({ width: 360, height: 220 });

  const displaySource = sourceObjectUrl || sourceUrl || "";
  const sourceName = sourceFile?.name || "image";

  const profileOptions = useMemo(() => {
    const source =
      Array.isArray(presetProfiles) && presetProfiles.length
        ? presetProfiles
        : DEFAULT_WORKFLOW_PROFILES;
    const normalized = source.map((entry, index) => normalizeProfile(entry, index)).filter(Boolean);
    if (normalized.length) return normalized;
    return DEFAULT_WORKFLOW_PROFILES.map((entry, index) =>
      normalizeProfile(entry, index)
    ).filter(Boolean);
  }, [presetProfiles]);

  const activeProfile = useMemo(() => {
    if (!activeProfileId) return null;
    return profileOptions.find((profile) => profile.id === activeProfileId) || null;
  }, [activeProfileId, profileOptions]);

  const presetOptions = useMemo(() => {
    if (recommendedSize?.width && recommendedSize?.height) {
      const custom = {
        id: "recommended",
        label: String(recommendedSize.label || "Recommended"),
        width: roundedInt(recommendedSize.width, 1200),
        height: roundedInt(recommendedSize.height, 1500),
      };
      return [custom, ...SIZE_PRESETS];
    }
    return SIZE_PRESETS;
  }, [recommendedSize]);

  const cropMetrics = useMemo(() => {
    const stageW = Math.max(1, Number(cropStageSize.width) || 360);
    const stageH = Math.max(1, Number(cropStageSize.height) || 220);
    const sourceW = Math.max(1, Number(naturalSize.width) || 1);
    const sourceH = Math.max(1, Number(naturalSize.height) || 1);
    const scale = Math.min(stageW / sourceW, stageH / sourceH);
    const imageWidth = sourceW * scale;
    const imageHeight = sourceH * scale;
    const imageLeft = (stageW - imageWidth) / 2;
    const imageTop = (stageH - imageHeight) / 2;
    const left = imageLeft + sourceCrop.x * imageWidth;
    const top = imageTop + sourceCrop.y * imageHeight;
    const width = sourceCrop.width * imageWidth;
    const height = sourceCrop.height * imageHeight;
    return {
      stageW,
      stageH,
      imageWidth,
      imageHeight,
      imageLeft,
      imageTop,
      box: { left, top, width, height },
    };
  }, [cropStageSize.height, cropStageSize.width, naturalSize.height, naturalSize.width, sourceCrop]);

  function pointerToCropUV(clientX, clientY) {
    const rect = cropStageRef.current?.getBoundingClientRect();
    if (!rect) return { u: 0.5, v: 0.5 };
    const imageWidth = cropMetrics.imageWidth || 1;
    const imageHeight = cropMetrics.imageHeight || 1;
    const localX = clientX - rect.left - cropMetrics.imageLeft;
    const localY = clientY - rect.top - cropMetrics.imageTop;
    const u = clamp(localX / imageWidth, 0, 1);
    const v = clamp(localY / imageHeight, 0, 1);
    return { u, v };
  }

  function constrainCrop(nextRect) {
    const width = clamp(nextRect.width, MIN_CROP_NORMALIZED, 1);
    const height = clamp(nextRect.height, MIN_CROP_NORMALIZED, 1);
    const x = clamp(nextRect.x, 0, 1 - width);
    const y = clamp(nextRect.y, 0, 1 - height);
    return { x, y, width, height };
  }

  function resetAdjustments() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAngle(0);
    setFlipX(false);
    setFlipY(false);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBlur(0);
  }

  function applyProfile(profile, options = {}) {
    if (!profile) return;
    setActiveProfileId(profile.id);
    setPresetId("custom");
    setOutputWidth(profile.width);
    setOutputHeight(profile.height);
    setFitMode(profile.fitMode || "cover");
    setMimeType(profile.mimeType || "image/jpeg");
    setQuality(clamp(roundedInt(profile.quality, 92), 45, 100));
    setBackgroundColor(profile.backgroundColor || "#f4f1eb");
    if (options.resetView !== false) {
      resetAdjustments();
    }
  }

  const viewportScale = useMemo(() => {
    const w = roundedInt(outputWidth, 1200);
    const h = roundedInt(outputHeight, 1500);
    return clamp(Math.min(620 / w, 420 / h, 1), 0.08, 1);
  }, [outputHeight, outputWidth]);

  const previewSize = useMemo(() => {
    const w = roundedInt(outputWidth, 1200);
    const h = roundedInt(outputHeight, 1500);
    const scale = viewportScale;
    return {
      width: Math.max(220, Math.round(w * scale)),
      height: Math.max(160, Math.round(h * scale)),
      scale,
    };
  }, [outputHeight, outputWidth, viewportScale]);

  const transformed = useMemo(() => {
    const w = naturalSize.width || 1;
    const h = naturalSize.height || 1;
    const bounds = computeBounds(w, h, angle);
    const frameW = roundedInt(outputWidth, 1200);
    const frameH = roundedInt(outputHeight, 1500);
    const baseScale =
      fitMode === "contain"
        ? Math.min(frameW / bounds.width, frameH / bounds.height)
        : Math.max(frameW / bounds.width, frameH / bounds.height);
    const effectiveScale = Math.max(0.01, baseScale * Number(zoom || 1));
    const boundW = bounds.width * effectiveScale;
    const boundH = bounds.height * effectiveScale;
    const maxPanX = Math.max(0, (boundW - frameW) / 2);
    const maxPanY = Math.max(0, (boundH - frameH) / 2);
    return {
      frameW,
      frameH,
      sourceW: w,
      sourceH: h,
      bounds,
      scale: effectiveScale,
      maxPanX,
      maxPanY,
    };
  }, [angle, fitMode, naturalSize.height, naturalSize.width, outputHeight, outputWidth, zoom]);

  useEffect(() => {
    if (!open) return undefined;
    if (!sourceFile || !isImageFile(sourceFile)) {
      setSourceObjectUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(sourceFile);
    setSourceObjectUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setSourceObjectUrl("");
    };
  }, [open, sourceFile]);

  useEffect(() => {
    if (open) return;
    for (const url of extraObjectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    extraObjectUrlsRef.current.clear();
    setSourceCrop({ ...INITIAL_SOURCE_CROP });
    setCropDragging(false);
  }, [open]);

  useEffect(
    () => () => {
      for (const url of extraObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      extraObjectUrlsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const node = cropStageRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setCropStageSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const preferredProfile =
      profileOptions.find((profile) => profile.id === String(defaultProfileId || "").trim()) ||
      null;
    const preferred = presetOptions[0] || SIZE_PRESETS[0];
    const profileFromRecommended =
      preferredProfile ||
      profileOptions.find(
        (profile) =>
          aspectKey(profile.width, profile.height) ===
          aspectKey(preferred.width, preferred.height)
      ) ||
      profileOptions[0] ||
      null;

    if (profileFromRecommended) {
      applyProfile(profileFromRecommended, { resetView: true });
    } else {
      setActiveProfileId("");
      setPresetId(preferred.id);
      setOutputWidth(preferred.width);
      setOutputHeight(preferred.height);
      setFitMode("cover");
      resetAdjustments();
      setBackgroundColor("#f4f1eb");
      setMimeType(sourceFile?.type === "image/png" ? "image/png" : "image/jpeg");
      setQuality(92);
    }

    setImageReady(false);
    setNaturalSize({ width: 0, height: 0 });
    setSourceCrop({ ...INITIAL_SOURCE_CROP });
    setCropDragging(false);
  }, [open, sourceFile, presetOptions, defaultProfileId, profileOptions]);

  useEffect(() => {
    if (!open) return;
    setPan((prev) => ({
      x: clamp(prev.x, -transformed.maxPanX, transformed.maxPanX),
      y: clamp(prev.y, -transformed.maxPanY, transformed.maxPanY),
    }));
  }, [open, transformed.maxPanX, transformed.maxPanY]);

  const filterCss = useMemo(
    () =>
      `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`,
    [blur, brightness, contrast, saturation]
  );

  const previewImageStyle = useMemo(() => {
    const width = transformed.sourceW * transformed.scale * previewSize.scale;
    const height = transformed.sourceH * transformed.scale * previewSize.scale;
    return {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(calc(-50% + ${pan.x * previewSize.scale}px), calc(-50% + ${
        pan.y * previewSize.scale
      }px)) rotate(${angle}deg) scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
      filter: filterCss,
    };
  }, [
    angle,
    filterCss,
    flipX,
    flipY,
    pan.x,
    pan.y,
    previewSize.scale,
    transformed.scale,
    transformed.sourceH,
    transformed.sourceW,
  ]);

  function handlePresetChange(nextPresetId) {
    const target = presetOptions.find((item) => item.id === nextPresetId);
    setPresetId(nextPresetId);
    if (!target) return;
    setOutputWidth(target.width);
    setOutputHeight(target.height);
    const matchedProfile = profileOptions.find(
      (profile) => aspectKey(profile.width, profile.height) === aspectKey(target.width, target.height)
    );
    setActiveProfileId(matchedProfile?.id || "");
  }

  function beginDrag(event) {
    if (!imageReady) return;
    setDragging(true);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }

  function updateDrag(event) {
    if (!dragging) return;
    const deltaX = (event.clientX - dragRef.current.startX) / previewSize.scale;
    const deltaY = (event.clientY - dragRef.current.startY) / previewSize.scale;
    setPan({
      x: clamp(dragRef.current.panX + deltaX, -transformed.maxPanX, transformed.maxPanX),
      y: clamp(dragRef.current.panY + deltaY, -transformed.maxPanY, transformed.maxPanY),
    });
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
  }

  function startCropMove(event) {
    if (!imageReady) return;
    event.stopPropagation();
    const { u, v } = pointerToCropUV(event.clientX, event.clientY);
    cropPointerRef.current = {
      mode: "move",
      handle: "",
      startRect: { ...sourceCrop },
      startU: u,
      startV: v,
    };
    setCropDragging(true);
  }

  function startCropResize(handle, event) {
    if (!imageReady) return;
    event.stopPropagation();
    const { u, v } = pointerToCropUV(event.clientX, event.clientY);
    cropPointerRef.current = {
      mode: "resize",
      handle: String(handle || ""),
      startRect: { ...sourceCrop },
      startU: u,
      startV: v,
    };
    setCropDragging(true);
  }

  function updateCropFromPointer(clientX, clientY) {
    const interaction = cropPointerRef.current;
    if (!interaction?.mode) return;
    const { u, v } = pointerToCropUV(clientX, clientY);
    const deltaU = u - interaction.startU;
    const deltaV = v - interaction.startV;
    const startRect = interaction.startRect || INITIAL_SOURCE_CROP;

    if (interaction.mode === "move") {
      setSourceCrop(
        constrainCrop({
          x: startRect.x + deltaU,
          y: startRect.y + deltaV,
          width: startRect.width,
          height: startRect.height,
        })
      );
      return;
    }

    const right = startRect.x + startRect.width;
    const bottom = startRect.y + startRect.height;
    let nextRect = { ...startRect };
    switch (interaction.handle) {
      case "nw": {
        const x = clamp(u, 0, right - MIN_CROP_NORMALIZED);
        const y = clamp(v, 0, bottom - MIN_CROP_NORMALIZED);
        nextRect = { x, y, width: right - x, height: bottom - y };
        break;
      }
      case "ne": {
        const width = clamp(u - startRect.x, MIN_CROP_NORMALIZED, 1 - startRect.x);
        const y = clamp(v, 0, bottom - MIN_CROP_NORMALIZED);
        nextRect = { x: startRect.x, y, width, height: bottom - y };
        break;
      }
      case "se": {
        const width = clamp(u - startRect.x, MIN_CROP_NORMALIZED, 1 - startRect.x);
        const height = clamp(v - startRect.y, MIN_CROP_NORMALIZED, 1 - startRect.y);
        nextRect = { x: startRect.x, y: startRect.y, width, height };
        break;
      }
      case "sw": {
        const x = clamp(u, 0, right - MIN_CROP_NORMALIZED);
        const width = right - x;
        const height = clamp(v - startRect.y, MIN_CROP_NORMALIZED, 1 - startRect.y);
        nextRect = { x, y: startRect.y, width, height };
        break;
      }
      default:
        return;
    }
    setSourceCrop(constrainCrop(nextRect));
  }

  useEffect(() => {
    if (!cropDragging) return undefined;
    const onPointerMove = (event) => updateCropFromPointer(event.clientX, event.clientY);
    const onPointerUp = () => {
      setCropDragging(false);
      cropPointerRef.current = {
        mode: "",
        handle: "",
        startRect: { ...INITIAL_SOURCE_CROP },
        startU: 0,
        startV: 0,
      };
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [cropDragging]);

  async function applyCropToSource() {
    if (!imgRef.current || !imageReady) return;
    const sourceW = naturalSize.width || 0;
    const sourceH = naturalSize.height || 0;
    if (!sourceW || !sourceH) return;
    const cropX = Math.round(sourceCrop.x * sourceW);
    const cropY = Math.round(sourceCrop.y * sourceH);
    const cropW = Math.max(1, Math.round(sourceCrop.width * sourceW));
    const cropH = Math.max(1, Math.round(sourceCrop.height * sourceH));
    if (cropX <= 0 && cropY <= 0 && cropW >= sourceW && cropH >= sourceH) return;

    setWorking(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
      ctx.drawImage(imgRef.current, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      const cropMime = mimeType === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise((resolve) => {
        const q = cropMime === "image/png" ? undefined : 0.98;
        canvas.toBlob((nextBlob) => resolve(nextBlob), cropMime, q);
      });
      if (!blob) throw new Error("CROP_EXPORT_FAILED");
      const nextFile = new File([blob], deriveFileName(sourceName, cropMime), {
        type: cropMime,
        lastModified: Date.now(),
      });
      const nextUrl = URL.createObjectURL(nextFile);
      if (sourceObjectUrl && extraObjectUrlsRef.current.has(sourceObjectUrl)) {
        URL.revokeObjectURL(sourceObjectUrl);
        extraObjectUrlsRef.current.delete(sourceObjectUrl);
      }
      extraObjectUrlsRef.current.add(nextUrl);
      setImageReady(false);
      setSourceObjectUrl(nextUrl);
      setSourceCrop({ ...INITIAL_SOURCE_CROP });
      setPan({ x: 0, y: 0 });
      setZoom(1);
      setAngle(0);
      setFlipX(false);
      setFlipY(false);
    } catch (error) {
      console.error(error);
    } finally {
      setWorking(false);
    }
  }

  function fitCropToOutputRatio() {
    const sourceW = naturalSize.width || 0;
    const sourceH = naturalSize.height || 0;
    if (!sourceW || !sourceH) return;
    const outputRatio = Math.max(0.01, Number(outputWidth || 1) / Number(outputHeight || 1));
    const sourceRatio = sourceW / sourceH;
    let width = 1;
    let height = 1;
    if (sourceRatio > outputRatio) {
      width = clamp(outputRatio / sourceRatio, MIN_CROP_NORMALIZED, 1);
      height = 1;
    } else {
      width = 1;
      height = clamp(sourceRatio / outputRatio, MIN_CROP_NORMALIZED, 1);
    }
    const x = (1 - width) / 2;
    const y = (1 - height) / 2;
    setSourceCrop({ x, y, width, height });
  }

  async function handleApply() {
    if (!imageReady || !imgRef.current) return;
    setWorking(true);
    try {
      const canvas = document.createElement("canvas");
      const outW = roundedInt(outputWidth, transformed.frameW);
      const outH = roundedInt(outputHeight, transformed.frameH);
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) throw new Error("CANVAS_CONTEXT_UNAVAILABLE");

      ctx.fillStyle = backgroundColor || "#ffffff";
      ctx.fillRect(0, 0, outW, outH);

      ctx.save();
      ctx.translate(outW / 2 + pan.x, outH / 2 + pan.y);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.filter = filterCss;
      ctx.drawImage(
        imgRef.current,
        (-transformed.sourceW * transformed.scale) / 2,
        (-transformed.sourceH * transformed.scale) / 2,
        transformed.sourceW * transformed.scale,
        transformed.sourceH * transformed.scale
      );
      ctx.restore();

      const blob = await new Promise((resolve) => {
        const qualityValue = mimeType === "image/png" ? undefined : clamp(quality / 100, 0.1, 1);
        canvas.toBlob((nextBlob) => resolve(nextBlob), mimeType, qualityValue);
      });
      if (!blob) throw new Error("IMAGE_EXPORT_FAILED");

      const outputFile = new File([blob], deriveFileName(sourceName, mimeType), {
        type: mimeType,
        lastModified: Date.now(),
      });

      onApply({
        file: outputFile,
        blob,
        width: outW,
        height: outH,
        mime_type: mimeType,
      });
    } catch (error) {
      onApply(null, error);
    } finally {
      setWorking(false);
    }
  }

  const ratioText = `${roundedInt(outputWidth, 1200)} x ${roundedInt(outputHeight, 1500)}`;
  const canRender = open && (displaySource || sourceFile);

  if (!open) return null;

  return (
    <div className="image-studio-backdrop" onPointerMove={updateDrag} onPointerUp={endDrag}>
      <div className="image-studio-modal" onClick={(event) => event.stopPropagation()}>
        <header className="image-studio-header">
          <div>
            <p className="image-studio-label">Photo toolkit</p>
            <h3>{title || "Image studio"}</h3>
            <p>Resize, crop, rotate, retouch, and export before upload.</p>
          </div>
          <button type="button" className="image-studio-close" onClick={onCancel}>
            Close
          </button>
        </header>

        {canRender ? (
          <div className="image-studio-body">
            <div className="image-studio-canvas-wrap">
              <div
                className={`image-studio-viewport${dragging ? " is-dragging" : ""}`}
                style={{
                  width: `${previewSize.width}px`,
                  height: `${previewSize.height}px`,
                  background: backgroundColor,
                }}
                onPointerDown={beginDrag}
                onPointerLeave={endDrag}
              >
                <img
                  ref={imgRef}
                  src={displaySource}
                  alt="Editable source"
                  style={previewImageStyle}
                  onLoad={(event) => {
                    const nextWidth = event.currentTarget.naturalWidth || 0;
                    const nextHeight = event.currentTarget.naturalHeight || 0;
                    setNaturalSize({ width: nextWidth, height: nextHeight });
                    setImageReady(nextWidth > 0 && nextHeight > 0);
                    setSourceCrop({ ...INITIAL_SOURCE_CROP });
                    setCropDragging(false);
                  }}
                  draggable={false}
                />
                <div className="image-studio-overlay">
                  <span>{ratioText}</span>
                  <span>{fitMode === "cover" ? "Cover fit" : "Contain fit"}</span>
                </div>
              </div>
              <p className="image-studio-help">
                Drag on image to reposition. Use zoom for crop precision.
              </p>
            </div>

            <aside className="image-studio-controls">
              <div className="image-studio-profile-stack">
                <p className="image-studio-profile-title">Workflow profiles</p>
                <div className="image-studio-profile-list">
                  {profileOptions.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      className={`image-studio-profile${activeProfileId === profile.id ? " is-active" : ""}`}
                      onClick={() => applyProfile(profile, { resetView: true })}
                    >
                      <span className="image-studio-profile-name">{profile.label}</span>
                      <span className="image-studio-profile-meta">
                        {profile.width}x{profile.height}
                      </span>
                    </button>
                  ))}
                </div>
                {activeProfile?.description ? (
                  <p className="image-studio-profile-help">{activeProfile.description}</p>
                ) : null}
              </div>
              <div className="image-studio-crop-tool">
                <div className="image-studio-crop-head">
                  <p className="image-studio-crop-title">Real crop tool</p>
                  <div className="image-studio-crop-actions">
                    <button type="button" className="image-studio-toggle" onClick={fitCropToOutputRatio}>
                      Match ratio
                    </button>
                    <button type="button" className="image-studio-toggle" onClick={applyCropToSource} disabled={!imageReady || working}>
                      Apply crop
                    </button>
                  </div>
                </div>
                <div ref={cropStageRef} className="image-studio-crop-stage">
                  <img
                    src={displaySource}
                    alt="Crop source"
                    className="image-studio-crop-image"
                    style={{
                      left: `${cropMetrics.imageLeft}px`,
                      top: `${cropMetrics.imageTop}px`,
                      width: `${cropMetrics.imageWidth}px`,
                      height: `${cropMetrics.imageHeight}px`,
                    }}
                    draggable={false}
                  />
                  <div
                    className="image-studio-crop-box"
                    style={{
                      left: `${cropMetrics.box.left}px`,
                      top: `${cropMetrics.box.top}px`,
                      width: `${cropMetrics.box.width}px`,
                      height: `${cropMetrics.box.height}px`,
                    }}
                    onPointerDown={startCropMove}
                  >
                    <span className="crop-handle nw" onPointerDown={(event) => startCropResize("nw", event)} />
                    <span className="crop-handle ne" onPointerDown={(event) => startCropResize("ne", event)} />
                    <span className="crop-handle se" onPointerDown={(event) => startCropResize("se", event)} />
                    <span className="crop-handle sw" onPointerDown={(event) => startCropResize("sw", event)} />
                  </div>
                </div>
                <p className="image-studio-crop-meta">
                  Crop: {Math.round(sourceCrop.width * 100)}% x {Math.round(sourceCrop.height * 100)}%
                </p>
              </div>
              <div className="image-studio-control-grid">
                <label>
                  Size preset
                  <select value={presetId} onChange={(event) => handlePresetChange(event.target.value)}>
                    {presetOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} ({item.width}x{item.height})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Width
                  <input
                    type="number"
                    min={1}
                    max={6000}
                    value={outputWidth}
                    onChange={(event) => {
                      setActiveProfileId("");
                      setPresetId("custom");
                      setOutputWidth(roundedInt(event.target.value, outputWidth));
                    }}
                  />
                </label>
                <label>
                  Height
                  <input
                    type="number"
                    min={1}
                    max={6000}
                    value={outputHeight}
                    onChange={(event) => {
                      setActiveProfileId("");
                      setPresetId("custom");
                      setOutputHeight(roundedInt(event.target.value, outputHeight));
                    }}
                  />
                </label>
                <label>
                  Fit mode
                  <select value={fitMode} onChange={(event) => setFitMode(event.target.value === "contain" ? "contain" : "cover")}>
                    <option value="cover">Cover (crop)</option>
                    <option value="contain">Contain (pad)</option>
                  </select>
                </label>
                <label>
                  Format
                  <select value={mimeType} onChange={(event) => setMimeType(event.target.value)}>
                    {FORMAT_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Background
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                  />
                </label>
              </div>

              <div className="image-studio-slider-stack">
                <label>
                  Zoom
                  <input
                    type="range"
                    min={0.4}
                    max={3.5}
                    step={0.01}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                </label>
                <label>
                  Rotation
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={angle}
                    onChange={(event) => setAngle(Number(event.target.value))}
                  />
                </label>
                <label>
                  Brightness
                  <input
                    type="range"
                    min={40}
                    max={180}
                    step={1}
                    value={brightness}
                    onChange={(event) => setBrightness(Number(event.target.value))}
                  />
                </label>
                <label>
                  Contrast
                  <input
                    type="range"
                    min={40}
                    max={180}
                    step={1}
                    value={contrast}
                    onChange={(event) => setContrast(Number(event.target.value))}
                  />
                </label>
                <label>
                  Saturation
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={saturation}
                    onChange={(event) => setSaturation(Number(event.target.value))}
                  />
                </label>
                <label>
                  Blur
                  <input
                    type="range"
                    min={0}
                    max={8}
                    step={0.1}
                    value={blur}
                    onChange={(event) => setBlur(Number(event.target.value))}
                  />
                </label>
                {mimeType !== "image/png" ? (
                  <label>
                    Quality
                    <input
                      type="range"
                      min={45}
                      max={100}
                      step={1}
                      value={quality}
                      onChange={(event) => setQuality(Number(event.target.value))}
                    />
                  </label>
                ) : null}
              </div>

              <div className="image-studio-toggle-row">
                <button
                  type="button"
                  className={`image-studio-toggle${flipX ? " is-active" : ""}`}
                  onClick={() => setFlipX((prev) => !prev)}
                >
                  Flip X
                </button>
                <button
                  type="button"
                  className={`image-studio-toggle${flipY ? " is-active" : ""}`}
                  onClick={() => setFlipY((prev) => !prev)}
                >
                  Flip Y
                </button>
                <button
                  type="button"
                  className="image-studio-toggle"
                  onClick={resetAdjustments}
                >
                  Reset
                </button>
              </div>
            </aside>
          </div>
        ) : (
          <div className="image-studio-empty">Select an image file to start editing.</div>
        )}

        <footer className="image-studio-footer">
          <span>
            Source: {naturalSize.width || 0} x {naturalSize.height || 0}
          </span>
          <div className="image-studio-actions">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={handleApply} disabled={working || !imageReady}>
              {working ? "Processing..." : "Apply edit"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export { INITIAL_STATE as IMAGE_STUDIO_INITIAL_STATE };
