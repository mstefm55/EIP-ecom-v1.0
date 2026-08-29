import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Archive, Ban, Building2, Camera, Check, CheckCircle2, ChevronDown, ChevronUp,
  Edit3, ExternalLink, Eye, Image as ImageIcon, Link2, Maximize2, Minimize2, Move,
  PackageMinus, PackagePlus, Palette, Plus, RefreshCw, Save, Search, Star, Trash2, Truck,
  Upload, Users, X
} from 'lucide-react';
import {
  canConvertUom,
  convertQuantity,
  convertUnitPrice,
  getCurrency,
  getUom
} from './materials/materialsMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { UI_LAYERS } from '../lib/uiLayers';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { clientPreferences } from '../lib/clientPreferences';

const materialsMetadata = perfectFitMetadata.materials;
const STORAGE_KEY = materialsMetadata.storage.materials;
const MODAL_LAYOUT_KEY = materialsMetadata.storage.modalLayout;
const FABRIC_FINISH_OPTIONS_KEY = materialsMetadata.storage.fabricFinishOptions;
const YARN_FINISH_OPTIONS_KEY = materialsMetadata.storage.yarnFinishOptions;
const SUPPLIERS_KEY = materialsMetadata.storage.suppliers;
const LEGACY_SUPPLIERS_KEY = materialsMetadata.storage.legacySuppliers;
const INCOMING_MATERIALS_KEY = materialsMetadata.storage.incoming;
const GOODS_RECEIPTS_KEY = materialsMetadata.storage.goodsReceipts;
const MATERIAL_ISSUES_KEY = materialsMetadata.storage.materialIssues;

// TODO: Replace these temporary local finish libraries with EIP governed dropdown metadata from the backend data model.
const DEFAULT_FABRIC_FINISH_OPTIONS = [
  'Singed', 'Calendered', 'Brushed', 'Napped / Raised', 'Peached', 'Sueded', 'Emerized',
  'Sheared', 'Sanforized / Pre-shrunk', 'Compacted', 'Heat-set', 'Embossed', 'Pleated',
  'Crushed', 'Stone-washed', 'Enzyme washed', 'Bio-polished', 'Softened',
  'All-over print', 'Digital print', 'Pigment print', 'Foil print', 'Flock print',
  'Coated', 'Laminated', 'PU coated', 'Waxed', 'Silicone finish', 'Resin finish',
  'Metallic finish', 'Matte finish', 'Gloss finish',
  'Water-repellent', 'Waterproof', 'Stain-resistant', 'Soil release', 'Anti-pilling',
  'Anti-static', 'Antimicrobial', 'Anti-odor', 'UV protection', 'Flame retardant',
  'Wrinkle-resistant / Easy-care', 'Crease-resistant', 'Shrink-resistant',
  'Moisture-wicking', 'Quick-dry', 'Cooling finish', 'Thermal finish',
  'Hydrophilic finish', 'Hydrophobic finish', 'Breathable membrane', 'Anti-slip'
];

const DEFAULT_YARN_FINISH_OPTIONS = [
  'Mercerized', 'Gassed / Singed', 'Waxed', 'Dyed', 'Space dyed', 'Mélange / Heather',
  'Slub effect', 'Brushed', 'Sueded', 'Silicone softened', 'Enzyme treated',
  'Anti-pilling', 'Anti-static', 'Antimicrobial', 'Flame retardant', 'Water-repellent',
  'Lubricated', 'Heat-set'
];

const blankYarn = () => ({
  id: `yarn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  yarnCount: '',
  yarnColour: '#ba6446',
  yarnQuality: '',
  yarnComposition: '',
  yarnSpecialFinish: []
});

const blankMaterial = () => ({
  id: `stash-${Date.now()}`,
  name: '',
  image: '',
  photoUrl: '',
  category: 'Woven',
  colour: '#ba6446',
  color: '#ba6446',
  colourCategory: 'Orange / Rust',
  colorCategory: 'Orange / Rust',
  fabricType: 'Linen',
  density: '',
  gsm: '',
  weight: '',
  width: '',
  fabricComposition: '',
  fabricFinish: [],
  quantity: '',
  unit: 'yards',
  hasInventory: false,
  reorderPoint: 1,
  lowStockThreshold: 3,
  unitCost: 0,
  currency: 'USD',
  pantoneCode: '',
  pantoneName: '',
  supplierIds: [],
  primarySupplierId: '',
  preferredSupplier: '',
  location: '',
  notes: '',
  yarns: []
});

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const numericQuantity = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInventoryValue = (material = {}) =>
  numericQuantity(material.quantity) * numericQuantity(material.unitCost);

const formatMoney = (value, currencyCode = 'USD') => {
  const currency = getCurrency(currencyCode);
  return `${currency.symbol}${numericQuantity(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const getStockState = (material = {}) => {
  const quantity = numericQuantity(material.quantity ?? material.inventoryQuantity);
  const hasInventory = Boolean(material.hasInventory) || quantity > 0;
  const reorderPoint = numericQuantity(material.reorderPoint ?? 0);
  const lowStockThreshold = numericQuantity(material.lowStockThreshold ?? 0);

  if (quantity <= 0) {
    return hasInventory
      ? {
          label: pfUiT('ui.fabricStash.stockStatus.outOfStock.label', {}, 'Out of stock'),
          tone: 'rose',
          needsReplenish: true,
          description: pfUiT('ui.fabricStash.stockStatus.outOfStock.description', {}, 'Inventory tracked, no quantity available.')
        }
      : {
          label: pfUiT('ui.fabricStash.stockStatus.swatchOnly.label', {}, 'Swatch only'),
          tone: 'clay',
          needsReplenish: false,
          description: pfUiT('ui.fabricStash.stockStatus.swatchOnly.description', {}, 'Reference swatch/category record only.')
        };
  }
  if (quantity <= reorderPoint) {
    return {
      label: pfUiT('ui.fabricStash.stockStatus.critical.label', {}, 'Critical'),
      tone: 'rose',
      needsReplenish: true,
      description: pfUiT('ui.fabricStash.stockStatus.critical.description', {}, 'At or below reorder point.')
    };
  }
  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) {
    return {
      label: pfUiT('ui.fabricStash.stockStatus.lowStock.label', {}, 'Low stock'),
      tone: 'amber',
      needsReplenish: true,
      description: pfUiT('ui.fabricStash.stockStatus.lowStock.description', {}, 'Below low stock threshold.')
    };
  }
  return {
    label: pfUiT('ui.fabricStash.stockStatus.inStock.label', {}, 'In stock'),
    tone: 'emerald',
    needsReplenish: false,
    description: pfUiT('ui.fabricStash.stockStatus.inStock.description', {}, 'Enough material available.')
  };
};

const getStockToneClass = (tone) => {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-800 border-emerald-100';
    case 'amber':
      return 'bg-amber-50 text-amber-800 border-amber-100';
    case 'rose':
      return 'bg-rose-50 text-rose-800 border-rose-100';
    default:
      return 'bg-clay-50 text-clay-800 border-clay-100';
  }
};

const inferInventoryStatus = (material) => {
  const stock = getStockState(material);
  return stock.label === 'Swatch only' ? 'Swatch/category only' : 'Swatch + active inventory';
};

const normalizeMaterial = (item = {}) => {
  const quantity = item.inventoryQuantity ?? item.quantity ?? '';
  const colour = item.colour || item.color || '#ba6446';
  const colourCategory = item.colourCategory || item.colorCategory || item.colorFamily || 'Orange / Rust';
  const image = item.image || item.photoUrl || item.photo || '';

  return {
    ...blankMaterial(),
    ...item,
    id: item.id || `stash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name || item.fabricName || item.materialName || 'Unnamed material',
    image,
    photoUrl: image,
    category: item.category || item.materialCategory || item.material || 'Woven',
    fabricType: item.fabricType || item.material || 'Linen',
    fabricComposition: item.fabricComposition || item.composition || '',
    fabricFinish: normalizeArray(item.fabricFinish || item.finishes || item.finish),
    density: item.density || '',
    gsm: item.gsm || '',
    weight: item.weight || '',
    width: item.width || '',
    colour,
    color: colour,
    colourCategory,
    colorCategory: colourCategory,
    quantity,
    unit: item.inventoryUnit || item.unit || 'yards',
    hasInventory: item.hasInventory ?? numericQuantity(quantity) > 0,
    reorderPoint: item.reorderPoint ?? 1,
    lowStockThreshold: item.lowStockThreshold ?? 3,
    unitCost: numericQuantity(item.unitCost ?? item.cost ?? 0),
    currency: item.currency || 'USD',
    pantoneCode: item.pantoneCode || item.pantone?.code || '',
    pantoneName: item.pantoneName || item.pantone?.name || '',
    supplierIds: normalizeArray(item.supplierIds || (item.supplierId ? [item.supplierId] : [])),
    primarySupplierId: item.primarySupplierId || item.supplierId || '',
    preferredSupplier: item.preferredSupplier || '',
    location: item.inventoryLocation || item.location || '',
    notes: item.notes || '',
    yarns: (item.yarns || item.yarnSpecs || []).map((yarn) => ({
      ...blankYarn(),
      ...yarn,
      id: yarn.id || `yarn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      yarnColour: yarn.yarnColour || yarn.yarnColor || yarn.colour || '#ba6446',
      yarnColor: yarn.yarnColour || yarn.yarnColor || yarn.colour || '#ba6446',
      yarnSpecialFinish: normalizeArray(yarn.yarnSpecialFinish || yarn.finishes || yarn.finish)
    }))
  };
};

const loadJson = (key, fallback, storage = runtimeDataStorage) => {
  try {
    const saved = storage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const normalizeSupplier = (item = {}) => ({
  id: item.id || `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: item.name || item.companyName || 'Unnamed supplier',
  contactName: item.contactName || item.contact || '',
  email: item.email || '',
  phone: item.phone || '',
  location: item.location || item.address || '',
  specialty: item.specialty || '',
  leadTimeDays: numericQuantity(
    item.leadTimeDays ??
    String(item.leadTime || '').match(/\d+/)?.[0] ??
    0
  ),
  status: item.status || 'ACTIVE'
});

const blankSupplier = () => ({
  id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  contactName: '',
  email: '',
  phone: '',
  location: '',
  specialty: '',
  leadTimeDays: 7,
  status: 'ACTIVE'
});

const normalizeIncoming = (item = {}) => {
  const legacyStatus = {
    draft: 'ORDERED',
    Ordered: 'ORDERED',
    'In Transit': 'IN_TRANSIT',
    Delivered: 'RECEIVED',
    Cancelled: 'CANCELLED'
  };

  return {
    id: item.id || `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    materialId: item.materialId || '',
    materialName: item.materialName || '',
    supplierId: item.supplierId || '',
    supplierName: item.supplierName || item.supplier || '',
    orderedQuantity: numericQuantity(item.orderedQuantity ?? item.requiredQuantity ?? item.qty ?? 0),
    unit: item.unit || item.orderedUom || 'yards',
    width: item.width || '',
    unitCost: numericQuantity(item.unitCost ?? 0),
    currency: item.currency || 'USD',
    reason: item.reason || 'replenishment',
    status: legacyStatus[item.status] || item.status || 'ORDERED',
    createdAt: item.createdAt || item.orderDate || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    receivedAt: item.receivedAt || '',
    goodsReceiptId: item.goodsReceiptId || ''
  };
};

const loadInitialSuppliers = () => {
  const current = loadJson(SUPPLIERS_KEY, null);
  if (Array.isArray(current)) return current.map(normalizeSupplier);

  const legacy = loadJson(LEGACY_SUPPLIERS_KEY, []);
  return Array.isArray(legacy) ? legacy.map(normalizeSupplier) : [];
};

const normalizeUnit = (unit) => {
  const value = String(unit || '').toLowerCase();
  if (value === 'metre' || value === 'metres' || value === 'meter' || value === 'meters' || value === 'm') return 'meters';
  if (value === 'yard' || value === 'yards' || value === 'yd' || value === 'yds') return 'yards';
  if (value === 'piece' || value === 'pieces' || value === 'pc' || value === 'pce') return 'pieces';
  if (value === 'swatch' || value === 'swatches') return 'pieces';
  return materialsMetadata.uoms.some((item) => item.code === value) ? value : 'yards';
};

const suggestedReplenishmentQuantity = (material) => {
  const current = numericQuantity(material.quantity);
  const reorderPoint = numericQuantity(material.reorderPoint || 0);
  const lowStockThreshold = numericQuantity(material.lowStockThreshold || reorderPoint || 1);
  const target = Math.max(
    reorderPoint * materialsMetadata.replenishment.targetMultiplier,
    lowStockThreshold * materialsMetadata.replenishment.targetMultiplier,
    1
  );
  const required = Math.max(0, target - current);

  return normalizeUnit(material.unit) === 'pieces'
    ? Math.max(1, Math.ceil(required))
    : Math.max(0.1, Number(required.toFixed(3)));
};

const normalizePantoneCode = (value) =>
  String(value || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/--+/g, '-');

const getInitialLayout = () => {
  const fallback = { x: 72, y: 88, width: 1120, height: 720 };
  try {
    const saved = clientPreferences.getItem(MODAL_LAYOUT_KEY);
    if (!saved) return fallback;
    return { ...fallback, ...JSON.parse(saved) };
  } catch {
    return fallback;
  }
};

export default function FabricStashModal({ isOpen, onClose, pantoneLookup = null }) {
  // MATERIALS_CARD_HYBRID_V4 — V3 preserved + explicit card width + stock issue/consume transactions.
  const [materials, setMaterials] = useState(() => loadJson(STORAGE_KEY, []).map((item) => normalizeMaterial({ ...item, unit: normalizeUnit(item.unit) })));
  const [suppliers, setSuppliers] = useState(loadInitialSuppliers);
  const [incomingMaterials, setIncomingMaterials] = useState(() => loadJson(INCOMING_MATERIALS_KEY, []).map(normalizeIncoming));
  const [goodsReceipts, setGoodsReceipts] = useState(() => loadJson(GOODS_RECEIPTS_KEY, []));
  const [materialIssues, setMaterialIssues] = useState(() => loadJson(MATERIAL_ISSUES_KEY, []));
  const [fabricFinishOptions, setFabricFinishOptions] = useState(() => loadJson(FABRIC_FINISH_OPTIONS_KEY, DEFAULT_FABRIC_FINISH_OPTIONS, clientPreferences));
  const [yarnFinishOptions, setYarnFinishOptions] = useState(() => loadJson(YARN_FINISH_OPTIONS_KEY, DEFAULT_YARN_FINISH_OPTIONS, clientPreferences));
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('inventory');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [layout, setLayout] = useState(getInitialLayout);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(blankMaterial);
  const [newFabricFinish, setNewFabricFinish] = useState('');
  const [newYarnFinish, setNewYarnFinish] = useState('');
  const fileInputRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [supplierDraft, setSupplierDraft] = useState(blankSupplier);
  const [receiveTargetId, setReceiveTargetId] = useState('');
  const [receiveDraft, setReceiveDraft] = useState({
    quantity: '',
    unit: 'yards',
    width: '',
    deliveryReference: '',
    notes: ''
  });
  const [pantoneBusy, setPantoneBusy] = useState(false);
  const [issueTargetId, setIssueTargetId] = useState('');
  const [issueDraft, setIssueDraft] = useState({
    transactionType: 'ISSUE',
    quantity: '',
    unit: 'yards',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
    } catch {}
  }, [materials]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
    } catch {}
  }, [suppliers]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem(INCOMING_MATERIALS_KEY, JSON.stringify(incomingMaterials));
    } catch {}
  }, [incomingMaterials]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem(GOODS_RECEIPTS_KEY, JSON.stringify(goodsReceipts));
    } catch {}
  }, [goodsReceipts]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem(MATERIAL_ISSUES_KEY, JSON.stringify(materialIssues));
    } catch {}
  }, [materialIssues]);

  useEffect(() => {
    try {
      clientPreferences.setItem(FABRIC_FINISH_OPTIONS_KEY, JSON.stringify(fabricFinishOptions));
      clientPreferences.setItem(YARN_FINISH_OPTIONS_KEY, JSON.stringify(yarnFinishOptions));
    } catch {}
  }, [fabricFinishOptions, yarnFinishOptions]);

  useEffect(() => {
    try {
      clientPreferences.setItem(MODAL_LAYOUT_KEY, JSON.stringify(layout));
    } catch {}
  }, [layout]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isCameraActive && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [isCameraActive]);

  const filteredMaterials = useMemo(() => {
    const normalQuery = query.trim().toLowerCase();
    return materials.filter((material) => {
      const status = inferInventoryStatus(material);
      const matchesFilter = filter === 'All' || status === filter;
      const linkedSupplierNames = (material.supplierIds || [])
        .map((supplierId) => suppliers.find((supplier) => supplier.id === supplierId)?.name || '')
        .filter(Boolean)
        .join(' ');

      const searchable = [
        material.name, material.category, material.fabricType, material.fabricComposition,
        material.colourCategory, material.width, material.density, material.gsm,
        material.location, material.notes, material.preferredSupplier,
        material.pantoneCode, material.pantoneName, linkedSupplierNames,
        getStockState(material).label, status
      ].join(' ').toLowerCase();
      return matchesFilter && (!normalQuery || searchable.includes(normalQuery));
    });
  }, [materials, query, filter, suppliers]);

  const activeCount = materials.filter((material) => getStockState(material).label !== 'Swatch only').length;
  const swatchOnlyCount = materials.filter((material) => getStockState(material).label === 'Swatch only').length;

  const beginDrag = (event) => {
    if (event.target.closest('button,input,select,textarea,label')) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLayout = { ...layout };

    const onMove = (moveEvent) => {
      setLayout((current) => ({
        ...current,
        x: Math.max(8, startLayout.x + moveEvent.clientX - startX),
        y: Math.max(8, startLayout.y + moveEvent.clientY - startY)
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const beginResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startLayout = { ...layout };
    const onMove = (moveEvent) => {
      setLayout((current) => ({
        ...current,
        width: Math.max(760, startLayout.width + moveEvent.clientX - startX),
        height: Math.max(460, startLayout.height + moveEvent.clientY - startY)
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const openEditor = (material = blankMaterial(), mode = 'edit') => {
    const nextDraft = normalizeMaterial(material);
    if (mode === 'material' && numericQuantity(nextDraft.quantity) <= 0) {
      nextDraft.hasInventory = false;
    }
    stopCamera();
    setDraft(nextDraft);
    setEditorOpen(true);
    setIsCollapsed(false);
    setIsMinimized(false);
  };

  const updateDraft = (field, value) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === 'colour') next.color = value;
      if (field === 'color') next.colour = value;
      if (field === 'colourCategory') next.colorCategory = value;
      if (field === 'image' || field === 'photoUrl') {
        next.image = value;
        next.photoUrl = value;
      }
      return next;
    });
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateDraft('image', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera capture is not available in this browser. Use upload instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch {
      setCameraError('Camera permission was denied or no camera is available. Use upload instead.');
    }
  };

  const captureCameraPhoto = () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    updateDraft('image', canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const pickColour = async () => {
    try {
      if (window.EyeDropper) {
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          updateDraft('colour', result.sRGBHex);
          return;
        }
      }
    } catch {
      // User cancellation is normal. Fall back to manual colour controls below.
    }
    if (window.showToast) {
      window.showToast('EyeDropper unavailable or cancelled. Use the colour input or hex field below.', 'info', 'Colour Picker');
    }
  };

  const toggleFabricFinish = (finish) => {
    setDraft((current) => {
      const existing = current.fabricFinish || [];
      return {
        ...current,
        fabricFinish: existing.includes(finish)
          ? existing.filter((item) => item !== finish)
          : [...existing, finish]
      };
    });
  };

  const addFabricFinishToDraft = (finish) => {
    if (!finish) return;
    setDraft((current) => ({
      ...current,
      fabricFinish: Array.from(new Set([...(current.fabricFinish || []), finish]))
    }));
  };

  const addFabricFinish = () => {
    const value = newFabricFinish.trim();
    if (!value) return;
    setFabricFinishOptions((current) => Array.from(new Set([...current, value])));
    setNewFabricFinish('');
    addFabricFinishToDraft(value);
  };

  const addYarnFinish = (index = null) => {
    const value = newYarnFinish.trim();
    if (!value) return;
    setYarnFinishOptions((current) => Array.from(new Set([...current, value])));
    setNewYarnFinish('');
    if (index !== null) {
      addYarnFinishToDraft(index, value);
    }
  };

  const updateYarn = (index, field, value) => {
    setDraft((current) => {
      const yarns = [...(current.yarns || [])];
      yarns[index] = { ...yarns[index], [field]: value };
      if (field === 'yarnColour') yarns[index].yarnColor = value;
      return { ...current, yarns };
    });
  };

  const toggleYarnFinish = (index, finish) => {
    setDraft((current) => {
      const yarns = [...(current.yarns || [])];
      const currentFinishes = yarns[index]?.yarnSpecialFinish || [];
      yarns[index] = {
        ...yarns[index],
        yarnSpecialFinish: currentFinishes.includes(finish)
          ? currentFinishes.filter((item) => item !== finish)
          : [...currentFinishes, finish]
      };
      return { ...current, yarns };
    });
  };

  const addYarnFinishToDraft = (index, finish) => {
    if (!finish) return;
    setDraft((current) => {
      const yarns = [...(current.yarns || [])];
      const currentFinishes = yarns[index]?.yarnSpecialFinish || [];
      yarns[index] = {
        ...yarns[index],
        yarnSpecialFinish: Array.from(new Set([...currentFinishes, finish]))
      };
      return { ...current, yarns };
    });
  };

  const saveDraft = () => {
    const primarySupplierName = getSupplierName(draft.primarySupplierId, draft.preferredSupplier || '');

    const normalized = normalizeMaterial({
      ...draft,
      name: draft.name?.trim() || 'Unnamed material',
      image: draft.image || draft.photoUrl,
      unit: normalizeUnit(draft.unit),
      preferredSupplier: primarySupplierName,
      hasInventory: Boolean(draft.hasInventory) || numericQuantity(draft.quantity) > 0
    });
    setMaterials((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists
        ? current.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...current];
    });
    setEditorOpen(false);
    stopCamera();
    if (window.showToast) {
      window.showToast(`${normalized.name} saved to Materials.`, 'success', 'Material Saved');
    }
  };

  const deleteMaterial = (id) => {
    const openIncoming = getOpenIncomingForMaterial(id);
    if (openIncoming) {
      if (window.showToast) {
        window.showToast(
          'This material has an open incoming record. Receive or cancel it before deleting the material.',
          'warning',
          'Incoming Material Open'
        );
      }
      return;
    }

    setMaterials((current) => current.filter((item) => item.id !== id));
    if (draft.id === id) setEditorOpen(false);
  };

  const getSupplierName = (supplierId, fallback = '') =>
    suppliers.find((supplier) => supplier.id === supplierId)?.name || fallback;

  const getOpenIncomingForMaterial = (materialId) =>
    incomingMaterials.find(
      (item) =>
        item.materialId === materialId &&
        !['RECEIVED', 'CANCELLED'].includes(item.status)
    );

  const openIssueModal = (material) => {
    if (!material || numericQuantity(material.quantity) <= 0) return;

    setIssueTargetId(material.id);
    setIssueDraft({
      transactionType: 'ISSUE',
      quantity: '',
      unit: normalizeUnit(material.unit),
      reference: '',
      notes: ''
    });
  };

  const closeIssueModal = () => {
    setIssueTargetId('');
    setIssueDraft({
      transactionType: 'ISSUE',
      quantity: '',
      unit: 'yards',
      reference: '',
      notes: ''
    });
  };

  const confirmMaterialIssue = () => {
    const material = materials.find((item) => item.id === issueTargetId);
    if (!material) return;

    const requestedQuantity = numericQuantity(issueDraft.quantity);
    if (requestedQuantity <= 0) {
      window.showToast?.(
        'Issue quantity must be greater than zero.',
        'warning',
        'Material Issue'
      );
      return;
    }

    const issueUnit = normalizeUnit(issueDraft.unit);
    const inventoryUnit = normalizeUnit(material.unit);

    if (!canConvertUom(issueUnit, inventoryUnit)) {
      window.showToast?.(
        `Cannot issue ${getUom(issueUnit).label} from stock tracked in ${getUom(inventoryUnit).label}.`,
        'error',
        'UOM Mismatch'
      );
      return;
    }

    let inventoryReduction = requestedQuantity;
    try {
      inventoryReduction = convertQuantity(
        requestedQuantity,
        issueUnit,
        inventoryUnit
      );
    } catch (error) {
      window.showToast?.(
        error.message,
        'error',
        'UOM Mismatch'
      );
      return;
    }

    const currentQuantity = numericQuantity(material.quantity);

    if (
      materialsMetadata.stockIssue.preventNegativeStock &&
      inventoryReduction > currentQuantity + 1e-9
    ) {
      window.showToast?.(
        `Only ${currentQuantity.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${getUom(inventoryUnit).shortLabel} is available.`,
        'warning',
        'Insufficient Stock'
      );
      return;
    }

    const nextQuantity = Math.max(
      0,
      Number((currentQuantity - inventoryReduction).toFixed(6))
    );

    const issueValue =
      inventoryReduction * numericQuantity(material.unitCost);

    const issueRecord = {
      id: `mi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      materialId: material.id,
      materialName: material.name,
      transactionType: issueDraft.transactionType || 'ISSUE',
      requestedQuantity,
      requestedUnit: issueUnit,
      inventoryReduction: Number(inventoryReduction.toFixed(6)),
      inventoryUnit,
      quantityBefore: currentQuantity,
      quantityAfter: nextQuantity,
      unitCost: numericQuantity(material.unitCost),
      currency: material.currency || 'USD',
      inventoryValue:
        materialsMetadata.stockIssue.recordInventoryValue
          ? Number(issueValue.toFixed(6))
          : 0,
      reference: issueDraft.reference.trim(),
      notes: issueDraft.notes.trim(),
      issuedAt: new Date().toISOString()
    };

    setMaterialIssues((current) => [issueRecord, ...current]);

    setMaterials((current) =>
      current.map((item) =>
        item.id === material.id
          ? normalizeMaterial({
              ...item,
              quantity: nextQuantity,
              hasInventory: true
            })
          : item
      )
    );

    closeIssueModal();

    const issueLabel =
      materialsMetadata.stockIssue.transactionTypes.find(
        (item) => item.code === issueRecord.transactionType
      )?.label || 'Issue';

    window.showToast?.(
      `${issueLabel}: ${requestedQuantity} ${getUom(issueUnit).shortLabel} removed from ${material.name}.`,
      'success',
      'Stock Updated'
    );
  };

  const createPurchaseRequirementDraft = (material) => {
    const existingOpen = getOpenIncomingForMaterial(material.id);
    if (materialsMetadata.replenishment.preventDuplicateOpenIncoming && existingOpen) {
      setActiveWorkspaceTab('incoming');
      if (window.showToast) {
        window.showToast(
          `An incoming record already exists for ${material.name}.`,
          'info',
          'Incoming Already Open'
        );
      }
      return existingOpen;
    }

    const unit = normalizeUnit(material.unit);
    const orderedQuantity = suggestedReplenishmentQuantity(material);
    const supplierId =
      material.primarySupplierId ||
      material.supplierIds?.[0] ||
      '';
    const supplierName =
      getSupplierName(supplierId) ||
      material.preferredSupplier?.trim() ||
      '';

    const requirement = normalizeIncoming({
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      materialId: material.id,
      materialName: material.name,
      supplierId,
      supplierName,
      orderedQuantity,
      unit,
      width: material.width || '',
      unitCost: numericQuantity(material.unitCost),
      currency: material.currency || 'USD',
      reason: 'replenishment',
      status: 'ORDERED',
      createdAt: new Date().toISOString()
    });

    setIncomingMaterials((current) => [requirement, ...current]);
    setActiveWorkspaceTab('incoming');

    if (window.showToast) {
      window.showToast(
        `Incoming material created for ${orderedQuantity} ${getUom(unit).shortLabel} of ${material.name}.`,
        'success',
        'Incoming Created'
      );
    }
    return requirement;
  };

  const updateIncoming = (incomingId, patch) => {
    setIncomingMaterials((current) =>
      current.map((item) => {
        if (item.id !== incomingId) return item;
        if (['RECEIVED', 'CANCELLED'].includes(item.status)) return item;
        return normalizeIncoming({
          ...item,
          ...patch,
          updatedAt: new Date().toISOString()
        });
      })
    );
  };

  const cancelIncoming = (incomingId) => {
    updateIncoming(incomingId, {
      status: 'CANCELLED',
      updatedAt: new Date().toISOString()
    });
    if (window.showToast) {
      window.showToast('Incoming material requirement cancelled.', 'info', 'Incoming Cancelled');
    }
  };

  const openReceiveModal = (incoming) => {
    const material = materials.find((item) => item.id === incoming.materialId);
    setReceiveTargetId(incoming.id);
    setReceiveDraft({
      quantity: incoming.orderedQuantity,
      unit: normalizeUnit(incoming.unit || material?.unit),
      width: incoming.width || material?.width || '',
      deliveryReference: '',
      notes: ''
    });
  };

  const closeReceiveModal = () => {
    setReceiveTargetId('');
    setReceiveDraft({
      quantity: '',
      unit: 'yards',
      width: '',
      deliveryReference: '',
      notes: ''
    });
  };

  const confirmReceive = () => {
    const incoming = incomingMaterials.find((item) => item.id === receiveTargetId);
    if (!incoming || incoming.status === 'RECEIVED' || incoming.goodsReceiptId) return;

    const material = materials.find((item) => item.id === incoming.materialId);
    if (!material) return;

    const receivedQuantity = numericQuantity(receiveDraft.quantity);
    if (receivedQuantity <= 0) {
      if (window.showToast) {
        window.showToast('Received quantity must be greater than zero.', 'warning', 'Goods Receipt');
      }
      return;
    }

    const receivedUnit = normalizeUnit(receiveDraft.unit);
    const inventoryUnit = normalizeUnit(material.unit);

    if (!canConvertUom(receivedUnit, inventoryUnit)) {
      if (window.showToast) {
        window.showToast(
          `Cannot receive ${getUom(receivedUnit).label} into stock tracked in ${getUom(inventoryUnit).label}.`,
          'error',
          'UOM Mismatch'
        );
      }
      return;
    }

    let inventoryAdjustment = receivedQuantity;
    try {
      inventoryAdjustment = convertQuantity(receivedQuantity, receivedUnit, inventoryUnit);
    } catch (error) {
      if (window.showToast) {
        window.showToast(error.message, 'error', 'UOM Mismatch');
      }
      return;
    }

    const incomingPriceUnit = normalizeUnit(incoming.unit);
    let receiptUnitPriceInInventoryUom = numericQuantity(incoming.unitCost);

    if (
      receiptUnitPriceInInventoryUom > 0 &&
      incomingPriceUnit !== inventoryUnit &&
      canConvertUom(incomingPriceUnit, inventoryUnit)
    ) {
      receiptUnitPriceInInventoryUom = convertUnitPrice(
        receiptUnitPriceInInventoryUom,
        incomingPriceUnit,
        inventoryUnit
      );
    }

    const existingQuantity = numericQuantity(material.quantity);
    const existingUnitPrice = numericQuantity(material.unitCost);
    const existingInventoryValue = existingQuantity * existingUnitPrice;
    const receivedInventoryValue = inventoryAdjustment * receiptUnitPriceInInventoryUom;
    const nextQuantity = existingQuantity + inventoryAdjustment;

    const nextWeightedUnitPrice =
      materialsMetadata.valuation.method === 'WEIGHTED_AVERAGE' &&
      numericQuantity(incoming.unitCost) > 0 &&
      (incoming.currency || material.currency || 'USD') === (material.currency || 'USD') &&
      nextQuantity > 0
        ? (existingInventoryValue + receivedInventoryValue) / nextQuantity
        : existingUnitPrice || receiptUnitPriceInInventoryUom;

    const receipt = {
      id: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      incomingId: incoming.id,
      materialId: material.id,
      supplierId: incoming.supplierId || '',
      orderedQuantity: incoming.orderedQuantity,
      orderedUnit: incomingPriceUnit,
      receivedQuantity,
      receivedUnit,
      inventoryAdjustment: Number(inventoryAdjustment.toFixed(6)),
      inventoryUnit,
      width: receiveDraft.width || incoming.width || material.width || '',
      unitCost: numericQuantity(incoming.unitCost),
      unitPriceUom: incomingPriceUnit,
      normalizedInventoryUnitPrice: Number(receiptUnitPriceInInventoryUom.toFixed(6)),
      receivedInventoryValue: Number(receivedInventoryValue.toFixed(6)),
      currency: incoming.currency || material.currency || 'USD',
      deliveryReference: receiveDraft.deliveryReference.trim(),
      notes: receiveDraft.notes.trim(),
      receivedAt: new Date().toISOString()
    };

    setGoodsReceipts((current) => [receipt, ...current]);

    setMaterials((current) =>
      current.map((item) => {
        if (item.id !== material.id) return item;
        return normalizeMaterial({
          ...item,
          quantity: Number(nextQuantity.toFixed(6)),
          unit: inventoryUnit,
          width: receipt.width || item.width,
          hasInventory: true,
          unitCost:
            materialsMetadata.valuation.updateUnitPriceOnReceipt
              ? Number(nextWeightedUnitPrice.toFixed(6))
              : item.unitCost
        });
      })
    );

    setIncomingMaterials((current) =>
      current.map((item) =>
        item.id === incoming.id
          ? normalizeIncoming({
              ...item,
              status: 'RECEIVED',
              goodsReceiptId: receipt.id,
              receivedAt: receipt.receivedAt,
              updatedAt: receipt.receivedAt
            })
          : item
      )
    );

    closeReceiveModal();

    if (window.showToast) {
      window.showToast(
        `${receivedQuantity} ${getUom(receivedUnit).shortLabel} received. Inventory has been synchronized.`,
        'success',
        'Goods Receipt Posted'
      );
    }
  };

  const saveSupplier = (event) => {
    event.preventDefault();
    if (!supplierDraft.name.trim()) return;

    const normalized = normalizeSupplier({
      ...supplierDraft,
      name: supplierDraft.name.trim()
    });

    setSuppliers((current) => {
      const exists = current.some((item) => item.id === normalized.id);
      return exists
        ? current.map((item) => (item.id === normalized.id ? normalized : item))
        : [...current, normalized];
    });

    setSupplierDraft(blankSupplier());
    if (window.showToast) {
      window.showToast(`${normalized.name} saved to Supplier Directory.`, 'success', 'Supplier Saved');
    }
  };

  const deleteSupplier = (supplierId) => {
    const linked = materials.some(
      (material) =>
        material.primarySupplierId === supplierId ||
        (material.supplierIds || []).includes(supplierId)
    );
    const incomingLinked = incomingMaterials.some(
      (item) =>
        item.supplierId === supplierId &&
        !['RECEIVED', 'CANCELLED'].includes(item.status)
    );

    if (linked || incomingLinked) {
      if (window.showToast) {
        window.showToast(
          'Supplier is linked to a material or open incoming record. Remove the link first.',
          'warning',
          'Supplier In Use'
        );
      }
      return;
    }

    setSuppliers((current) => current.filter((item) => item.id !== supplierId));
  };

  const toggleDraftSupplier = (supplierId) => {
    setDraft((current) => {
      const supplierIds = current.supplierIds || [];
      const exists = supplierIds.includes(supplierId);
      const nextSupplierIds = exists
        ? supplierIds.filter((id) => id !== supplierId)
        : [...supplierIds, supplierId];

      let primarySupplierId = current.primarySupplierId || '';
      if (!nextSupplierIds.includes(primarySupplierId)) {
        primarySupplierId = nextSupplierIds[0] || '';
      }

      return {
        ...current,
        supplierIds: nextSupplierIds,
        primarySupplierId,
        preferredSupplier: getSupplierName(primarySupplierId, current.preferredSupplier || '')
      };
    });
  };

  const setDraftPrimarySupplier = (supplierId) => {
    setDraft((current) => {
      const supplierIds = Array.from(
        new Set([...(current.supplierIds || []), supplierId].filter(Boolean))
      );
      return {
        ...current,
        supplierIds,
        primarySupplierId: supplierId,
        preferredSupplier: getSupplierName(supplierId, current.preferredSupplier || '')
      };
    });
  };

  const verifyPantoneDraft = async () => {
    const code = normalizePantoneCode(draft.pantoneCode);
    updateDraft('pantoneCode', code);

    if (!code || !materialsMetadata.pantone.codePattern.test(code)) {
      if (window.showToast) {
        window.showToast(
          'Enter a TCX code in the format 13-0002-TCX.',
          'warning',
          'Pantone Reference'
        );
      }
      return;
    }

    if (pantoneLookup) {
      setPantoneBusy(true);
      try {
        const result = await pantoneLookup({
          provider: materialsMetadata.pantone.provider,
          system: materialsMetadata.pantone.system,
          code
        });

        setDraft((current) => ({
          ...current,
          pantoneCode: code,
          pantoneName: result?.name || current.pantoneName,
          colour: result?.hex || current.colour,
          color: result?.hex || current.color
        }));
      } catch (error) {
        if (window.showToast) {
          window.showToast(error?.message || 'Pantone lookup failed.', 'error', 'Pantone');
        }
      } finally {
        setPantoneBusy(false);
      }
      return;
    }

    window.open(
      `${materialsMetadata.pantone.verificationBaseUrl}${encodeURIComponent(code)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const openIncomingCount = incomingMaterials.filter(
    (item) => !['RECEIVED', 'CANCELLED'].includes(item.status)
  ).length;

  const receiveTarget = incomingMaterials.find((item) => item.id === receiveTargetId);
  const receiveMaterial = materials.find((item) => item.id === receiveTarget?.materialId);

  if (!isOpen) return null;

  const draftStock = getStockState(draft);

  const modalStyle = isMinimized
    ? { left: layout.x, top: layout.y, width: Math.min(layout.width, 520) }
    : {
        left: layout.x,
        top: layout.y,
        width: `min(${layout.width}px, calc(100vw - 24px))`,
        height: `min(${layout.height}px, calc(100vh - 24px))`
      };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="fixed pointer-events-auto"
        style={{ ...modalStyle, zIndex: UI_LAYERS.modal }}
        id="fabric-stash-floating-modal"
      >
        <div className="relative flex h-full max-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-2xl border border-sand-200 bg-[#FAF8F5]/98 shadow-[0_30px_90px_rgba(45,30,21,0.22)] backdrop-blur-md">
          <div
            className="flex cursor-move items-center justify-between gap-3 border-b border-sand-200 bg-bark-950 px-4 py-3 text-sand-50"
            onMouseDown={beginDrag}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-500/20 text-clay-200 ring-1 ring-white/10">
                <Archive className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate font-serif text-lg font-semibold leading-tight">Materials, Swatches &amp; Fabric Inventory</h3>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-sand-300">{pfUiT("ui.components.fabricstashmodal.4c4d59e4d5")}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setIsCollapsed((value) => !value)} className="rounded-lg border border-white/10 p-2 text-sand-200 hover:bg-white/10" aria-label={isCollapsed ? 'Expand materials modal' : 'Collapse materials modal'}>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setIsMinimized((value) => !value)} className="rounded-lg border border-white/10 p-2 text-sand-200 hover:bg-white/10" aria-label={isMinimized ? 'Restore materials modal' : 'Minimize materials modal'}>
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>
              <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-sand-200 hover:bg-white/10" aria-label={pfUiT("ui.components.fabricstashmodal.4daa6d3c09")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!isMinimized && !isCollapsed && (
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-sand-200 bg-white px-3 py-2">
                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.24c6e76a41")}</span>
                    <strong className="font-serif text-2xl text-bark-950">{materials.length}</strong>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white px-3 py-2">
                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.93d6e5750d")}</span>
                    <strong className="font-serif text-2xl text-emerald-800">{activeCount}</strong>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white px-3 py-2">
                    <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.36d0107c2e")}</span>
                    <strong className="font-serif text-2xl text-clay-700">{swatchOnlyCount}</strong>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openEditor(blankMaterial(), 'material')} className="inline-flex items-center gap-1.5 rounded-full bg-bark-900 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-sand-50 hover:bg-bark-950">
                    <Plus className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.4b55a2e90f")}</button>
                </div>
              </div>

              {/* Metadata-driven workspace tabs. The existing inventory list remains the primary view. */}
              <div className="flex shrink-0 gap-5 overflow-x-auto border-b border-sand-200 px-1">
                {materialsMetadata.workspaceTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                    className={`relative inline-flex min-h-10 shrink-0 items-center gap-1.5 px-1 text-[10px] font-mono font-bold uppercase tracking-wider ${
                      activeWorkspaceTab === tab.id ? 'text-bark-950' : 'text-bark-450 hover:text-bark-700'
                    }`}
                  >
                    {tab.id === 'inventory' && <Archive className="h-3.5 w-3.5" />}
                    {tab.id === 'suppliers' && <Users className="h-3.5 w-3.5" />}
                    {tab.id === 'incoming' && <Truck className="h-3.5 w-3.5" />}
                    {tab.label}
                    {tab.id === 'incoming' && openIncomingCount > 0 && (
                      <span className="rounded-full bg-clay-700 px-1.5 py-0.5 text-[8px] text-white">
                        {openIncomingCount}
                      </span>
                    )}
                    {activeWorkspaceTab === tab.id && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-bark-900" />
                    )}
                  </button>
                ))}
              </div>

              {activeWorkspaceTab === 'inventory' && (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bark-350" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={pfUiT("ui.components.fabricstashmodal.6e7bcd4aaa")}
                        className="w-full rounded-xl border border-sand-200 bg-white py-2.5 pl-10 pr-3 text-sm text-bark-850 outline-none focus:border-clay-400"
                      />
                    </label>
                    <select
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                      className="rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm font-semibold text-bark-800 outline-none focus:border-clay-400"
                    >
                      <option value="All">{pfUiT("ui.components.fabricstashmodal.af303afe92")}</option>
                      <option value="Swatch + active inventory">{pfUiT("ui.components.fabricstashmodal.eea8d22870")}</option>
                      <option value="Swatch/category only">{pfUiT("ui.components.fabricstashmodal.8b0b4e3299")}</option>
                    </select>
                  </div>

                  {/* Keep the newer card presentation; enrich it with the missing stock/commercial data. */}
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    {filteredMaterials.map((material) => {
                      const status = inferInventoryStatus(material);
                      const stock = getStockState(material);
                      const materialUnit = normalizeUnit(material.unit);
                      const uom = getUom(materialUnit);
                      const currency = getCurrency(material.currency || 'USD');
                      const inventoryValue = getInventoryValue(material);
                      const openIncoming = getOpenIncomingForMaterial(material.id);
                      const primarySupplierName =
                        getSupplierName(material.primarySupplierId) ||
                        material.preferredSupplier ||
                        'No supplier set';

                      const linkedSuppliers = (material.supplierIds || [])
                        .map((supplierId) => suppliers.find((supplier) => supplier.id === supplierId))
                        .filter(Boolean);

                      return (
                        <article
                          key={material.id}
                          className="rounded-2xl border border-sand-200 bg-white px-4 py-3 shadow-[0_1px_0_rgba(61,43,32,0.02)]"
                        >
                          <div className="grid gap-4 lg:grid-cols-[82px_minmax(0,1fr)_170px] lg:items-start">
                            {/* Swatch */}
                            <div className="flex items-start gap-2 lg:block">
                              <div className="h-[76px] w-[76px] overflow-hidden rounded-xl border border-sand-200 bg-sand-100">
                                {material.image ? (
                                  <img
                                    src={material.image}
                                    alt={material.name}
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div
                                    className="flex h-full w-full items-center justify-center"
                                    style={{ backgroundColor: material.colour || '#ba6446' }}
                                  >
                                    <ImageIcon className="h-6 w-6 text-white/80" />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Main material + enriched stock information */}
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="h-4 w-4 shrink-0 rounded-full border border-sand-300"
                                  style={{ backgroundColor: material.colour || '#ba6446' }}
                                />
                                <h4 className="truncate text-sm font-bold text-bark-950">{material.name}</h4>
                                <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-bark-550">
                                  {material.fabricType || material.category || 'Material'}
                                </span>
                                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${getStockToneClass(stock.tone)}`}>
                                  {stock.label}
                                </span>
                                {openIncoming && (
                                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-indigo-800">
                                    Incoming · {materialsMetadata.incomingStatuses.find((item) => item.code === openIncoming.status)?.label || openIncoming.status}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1 line-clamp-1 text-[10px] text-bark-450">
                                {material.notes || `${material.category || ''}${material.fabricComposition ? ` · ${material.fabricComposition}` : ''}`}
                              </p>

                              {/* Requested operational data: length/qty, UOM, price and inventory value. */}
                              <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.05ba86e654")}</span>
                                  <strong className="mt-0.5 block text-[11px] text-bark-900">
                                    {numericQuantity(material.quantity) > 0
                                      ? numericQuantity(material.quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })
                                      : status === 'Swatch/category only'
                                        ? 'Swatch only'
                                        : '0'}
                                  </strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">
                                    UOM
                                  </span>
                                  <strong className="mt-0.5 block text-[11px] text-bark-900">{uom.label}</strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.2b7bbb3fb5")}</span>
                                  <strong className="mt-0.5 block text-[11px] text-bark-900">
                                    {material.width || '—'}
                                  </strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.af35992511")}</span>
                                  <strong className="mt-0.5 block text-[11px] text-bark-900">
                                    {formatMoney(material.unitCost, material.currency)} / {uom.shortLabel}
                                  </strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.d0a40efcfe")}</span>
                                  <strong className="mt-0.5 block text-[11px] text-emerald-800">
                                    {numericQuantity(material.quantity) > 0
                                      ? formatMoney(inventoryValue, material.currency)
                                      : '—'}
                                  </strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.0f5e7b1f56")}</span>
                                  <strong className="mt-0.5 block text-[11px] text-bark-900">
                                    {numericQuantity(material.lowStockThreshold).toLocaleString(undefined, { maximumFractionDigits: 3 })} {uom.shortLabel}
                                  </strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.3091774c09")}</span>
                                  <strong className="mt-0.5 block truncate text-[11px] text-bark-900">
                                    {primarySupplierName}
                                  </strong>
                                </div>

                                <div>
                                  <span className="block text-[8px] font-mono font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.4932538286")}</span>
                                  <strong className="mt-0.5 block text-[11px] text-bark-900">
                                    {material.pantoneCode || '—'}
                                  </strong>
                                </div>
                              </div>

                              {(() => {
                                const lastIssue = materialIssues.find(
                                  (issue) => issue.materialId === material.id
                                );
                                if (!lastIssue) return null;

                                return (
                                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-clay-100 bg-clay-50/50 px-3 py-2 text-[9px] text-clay-900">
                                    <span className="font-bold uppercase">
                                      Last {lastIssue.transactionType === 'CONSUME' ? 'consumption' : 'issue'}
                                    </span>
                                    <span>
                                      {numericQuantity(lastIssue.requestedQuantity).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      {' '}
                                      {getUom(normalizeUnit(lastIssue.requestedUnit)).shortLabel}
                                    </span>
                                    <span className="text-clay-700">
                                      {new Date(lastIssue.issuedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                );
                              })()}

                              {linkedSuppliers.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {linkedSuppliers.map((supplier) => (
                                    <span
                                      key={supplier.id}
                                      className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[8px] text-bark-550"
                                    >
                                      <Link2 className="h-2.5 w-2.5" />
                                      {supplier.name}
                                      {supplier.id === material.primarySupplierId && (
                                        <Star className="h-2.5 w-2.5 fill-clay-600 text-clay-600" />
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Make the replenishment flow visible on the material itself. */}
                              {openIncoming && (
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-[9px] text-indigo-900">
                                  <span>{pfUiT("ui.components.fabricstashmodal.a15130782b")}<strong className="ml-1">
                                      {numericQuantity(openIncoming.orderedQuantity).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                      {' '}
                                      {getUom(normalizeUnit(openIncoming.unit)).shortLabel}
                                    </strong>
                                  </span>
                                  <span>{pfUiT("ui.components.fabricstashmodal.d41c3e3f41")}<strong className="ml-1">
                                      {getSupplierName(openIncoming.supplierId, openIncoming.supplierName || 'Not selected')}
                                    </strong>
                                  </span>
                                  <span>{pfUiT("ui.components.fabricstashmodal.3d9c61ed1a")}<strong className="ml-1">
                                      {formatMoney(openIncoming.unitCost, openIncoming.currency || material.currency)} / {getUom(normalizeUnit(openIncoming.unit)).shortLabel}
                                    </strong>
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Actions preserve the card workflow. */}
                            <div className="flex flex-wrap gap-2 lg:flex-col">
                              <button
                                type="button"
                                onClick={() => openEditor(material, 'edit')}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-bark-650 hover:border-clay-300 hover:text-clay-700"
                              >
                                <Eye className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.e925c46244")}</button>

                              {numericQuantity(material.quantity) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openIssueModal(material)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-clay-200 bg-clay-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-clay-800 hover:bg-clay-100"
                                >
                                  <PackageMinus className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.70a9432d9a")}</button>
                              )}

                              {openIncoming ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveWorkspaceTab('incoming')}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-indigo-800 hover:bg-indigo-100"
                                >
                                  <Truck className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.9367fdb097")}</button>
                              ) : stock.needsReplenish ? (
                                <button
                                  type="button"
                                  onClick={() => createPurchaseRequirementDraft(material)}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-bark-900 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white hover:bg-bark-950"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.6e86bdefdd")}</button>
                              ) : (
                                <span className="inline-flex items-center justify-center rounded-xl bg-sand-50 px-3 py-2 text-[8px] font-bold uppercase tracking-wider text-bark-400">{pfUiT("ui.components.fabricstashmodal.bc7ac38ab9")}</span>
                              )}

                              <button
                                type="button"
                                onClick={() => deleteMaterial(material.id)}
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-sand-200 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.8d54f3cede")}</button>
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {filteredMaterials.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-10 text-center text-sm text-bark-500">{pfUiT("ui.components.fabricstashmodal.8af38ebf17")}</div>
                    )}
                  </div>
                </>
              )}

              {activeWorkspaceTab === 'suppliers' && (
                <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="min-h-0 overflow-y-auto">
                    <div className="grid gap-3 md:grid-cols-2">
                      {suppliers.map((supplier) => {
                        const linkedMaterials = materials.filter((material) =>
                          (material.supplierIds || []).includes(supplier.id)
                        );
                        return (
                          <article key={supplier.id} className="rounded-xl border border-sand-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-800">{pfUiT("ui.components.fabricstashmodal.e2580d8fbb")}</span>
                                <h4 className="mt-2 truncate font-serif text-lg font-semibold text-bark-950">{supplier.name}</h4>
                                <p className="mt-0.5 text-[10px] text-bark-500">{supplier.specialty || 'Raw materials'}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteSupplier(supplier.id)}
                                className="rounded-lg border border-sand-200 p-2 text-rose-600 hover:bg-rose-50"
                                title={pfUiT("ui.components.fabricstashmodal.5223058c5d")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="mt-3 space-y-1 border-t border-sand-100 pt-3 text-[11px] text-bark-650">
                              <div>{pfUiT("ui.components.fabricstashmodal.efc3bdb984")}<strong className="text-bark-900">{supplier.contactName || '—'}</strong></div>
                              <div>{pfUiT("ui.components.fabricstashmodal.30570074f8")}<strong className="text-bark-900">{supplier.email || '—'}</strong></div>
                              <div>{pfUiT("ui.components.fabricstashmodal.499b5d289d")}<strong className="text-bark-900">{supplier.phone || '—'}</strong></div>
                              <div>{pfUiT("ui.components.fabricstashmodal.93966ad789")}<strong className="text-bark-900">{supplier.location || '—'}</strong></div>
                              <div>{pfUiT("ui.components.fabricstashmodal.97a46151f2")}<strong className="text-bark-900">{supplier.leadTimeDays || 0} days</strong></div>
                            </div>

                            {linkedMaterials.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1">
                                {linkedMaterials.map((material) => (
                                  <span key={material.id} className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1 text-[8px] text-bark-600">
                                    {material.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {suppliers.length === 0 && (
                        <div className="md:col-span-2 rounded-xl border border-dashed border-sand-200 bg-white p-10 text-center text-sm text-bark-500">{pfUiT("ui.components.fabricstashmodal.4cb2407793")}</div>
                      )}
                    </div>
                  </div>

                  <form onSubmit={saveSupplier} className="self-start rounded-xl border border-sand-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-clay-700" />
                      <h4 className="font-mono text-[10px] font-bold uppercase tracking-wider text-bark-850">{pfUiT("ui.components.fabricstashmodal.58565143eb")}</h4>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        ['name', 'Company name', 'e.g. Maison de Lin'],
                        ['contactName', 'Contact representative', 'e.g. Jean-Luc Picard'],
                        ['email', 'Email address', 'contact@example.com'],
                        ['phone', 'Phone', '+33 ...'],
                        ['location', 'Location', 'Lille, France'],
                        ['specialty', 'Specialty / raw fibre', 'French flax / linen']
                      ].map(([field, label, placeholder]) => (
                        <label key={field} className="block">
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{label}</span>
                          <input
                            required={field === 'name'}
                            value={supplierDraft[field] || ''}
                            onChange={(event) => setSupplierDraft((current) => ({ ...current, [field]: event.target.value }))}
                            placeholder={placeholder}
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          />
                        </label>
                      ))}

                      <label className="block">
                        <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">Average lead time (days)</span>
                        <input
                          type="number"
                          min="0"
                          value={supplierDraft.leadTimeDays ?? 0}
                          onChange={(event) => setSupplierDraft((current) => ({ ...current, leadTimeDays: event.target.value }))}
                          className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                        />
                      </label>

                      <button type="submit" className="w-full rounded-xl bg-bark-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-bark-950">{pfUiT("ui.components.fabricstashmodal.4a1e81c6f5")}</button>
                    </div>
                  </form>
                </div>
              )}

              {activeWorkspaceTab === 'incoming' && (
                <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-sand-200 bg-white">
                  <table className="min-w-[1180px] w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-sand-50 text-[9px] font-mono uppercase tracking-wider text-bark-500">
                      <tr>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.b4fa557686")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.786ff927ca")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.e2580d8fbb")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.191718b511")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.2b7bbb3fb5")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.af35992511")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.732c35d33e")}</th>
                        <th className="px-3 py-2">{pfUiT("ui.components.fabricstashmodal.26fc9a9200")}</th>
                        <th className="px-3 py-2 text-right">{pfUiT("ui.components.fabricstashmodal.7d65a553b6")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-100">
                      {incomingMaterials.map((incoming) => {
                        const material = materials.find((item) => item.id === incoming.materialId);
                        const locked = ['RECEIVED', 'CANCELLED'].includes(incoming.status);
                        const availableSuppliers =
                          material?.supplierIds?.length > 0
                            ? suppliers.filter((supplier) => material.supplierIds.includes(supplier.id))
                            : suppliers;
                        const currency = getCurrency(incoming.currency || material?.currency || 'USD');

                        return (
                          <tr key={incoming.id} className="align-middle hover:bg-sand-50/50">
                            <td className="px-3 py-2">
                              <strong className="block font-mono text-[10px] text-bark-900">{incoming.id.slice(-10)}</strong>
                              <span className="text-[9px] text-bark-450">{new Date(incoming.createdAt).toLocaleDateString()}</span>
                            </td>
                            <td className="px-3 py-2">
                              <strong className="text-bark-950">{material?.name || incoming.materialName}</strong>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                disabled={locked || !materialsMetadata.replenishment.allowSupplierChangeBeforeReceipt}
                                value={incoming.supplierId || ''}
                                onChange={(event) =>
                                  updateIncoming(incoming.id, {
                                    supplierId: event.target.value,
                                    supplierName: getSupplierName(event.target.value)
                                  })
                                }
                                className="w-[190px] rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-[10px] outline-none disabled:bg-sand-50"
                              >
                                <option value="">{pfUiT("ui.components.fabricstashmodal.be6b392469")}</option>
                                {availableSuppliers.map((supplier) => (
                                  <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}{supplier.id === material?.primarySupplierId ? ' · Primary' : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1.5">
                                <input
                                  disabled={locked || !materialsMetadata.replenishment.allowQtyChangeBeforeReceipt}
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={incoming.orderedQuantity}
                                  onChange={(event) => updateIncoming(incoming.id, { orderedQuantity: event.target.value })}
                                  className="w-24 rounded-lg border border-sand-200 px-2 py-1.5 text-[10px] font-mono disabled:bg-sand-50"
                                />
                                <select
                                  disabled={locked || !materialsMetadata.replenishment.allowUomChangeBeforeReceipt}
                                  value={normalizeUnit(incoming.unit)}
                                  onChange={(event) => updateIncoming(incoming.id, { unit: event.target.value })}
                                  className="w-20 rounded-lg border border-sand-200 px-2 py-1.5 text-[10px] disabled:bg-sand-50"
                                >
                                  {materialsMetadata.uoms.map((uom) => (
                                    <option key={uom.code} value={uom.code}>{uom.shortLabel}</option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                disabled={locked || !materialsMetadata.replenishment.allowWidthChangeBeforeReceipt}
                                value={incoming.width || ''}
                                onChange={(event) => updateIncoming(incoming.id, { width: event.target.value })}
                                className="w-24 rounded-lg border border-sand-200 px-2 py-1.5 text-[10px] disabled:bg-sand-50"
                                placeholder={pfUiT("ui.components.fabricstashmodal.fad63eab45")}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span className="text-bark-500">{currency.symbol}</span>
                                <input
                                  disabled={locked || !materialsMetadata.replenishment.allowUnitCostChangeBeforeReceipt}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={incoming.unitCost ?? 0}
                                  onChange={(event) => updateIncoming(incoming.id, { unitCost: event.target.value })}
                                  className="w-20 rounded-lg border border-sand-200 px-2 py-1.5 text-[10px] font-mono disabled:bg-sand-50"
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <strong className="font-mono text-[10px] text-bark-900">
                                {formatMoney(
                                  numericQuantity(incoming.orderedQuantity) * numericQuantity(incoming.unitCost),
                                  incoming.currency || material?.currency || 'USD'
                                )}
                              </strong>
                            </td>
                            <td className="px-3 py-2">
                              {locked ? (
                                <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
                                  incoming.status === 'RECEIVED'
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                                    : 'border-sand-200 bg-sand-50 text-bark-500'
                                }`}>
                                  {materialsMetadata.incomingStatuses.find((item) => item.code === incoming.status)?.label || incoming.status}
                                </span>
                              ) : (
                                <select
                                  value={incoming.status}
                                  onChange={(event) => updateIncoming(incoming.id, { status: event.target.value })}
                                  className="rounded-lg border border-sand-200 px-2 py-1.5 text-[10px]"
                                >
                                  {materialsMetadata.incomingStatuses
                                    .filter((item) => !item.terminal)
                                    .map((status) => (
                                      <option key={status.code} value={status.code}>{status.label}</option>
                                    ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {incoming.status === 'RECEIVED' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.6647880956")}</span>
                              ) : incoming.status === 'CANCELLED' ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-bark-400">
                                  <Ban className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.ae1b243b2e")}</span>
                              ) : (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openReceiveModal(incoming)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[9px] font-bold uppercase text-emerald-800 hover:bg-emerald-100"
                                  >
                                    <Check className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.d3df98c5a8")}</button>
                                  <button
                                    type="button"
                                    onClick={() => cancelIncoming(incoming.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[9px] font-bold uppercase text-rose-700 hover:bg-rose-100"
                                  >
                                    <X className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.1bc165702a")}</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {incomingMaterials.length === 0 && (
                    <div className="p-10 text-center text-sm text-bark-500">{pfUiT("ui.components.fabricstashmodal.6ba124c271")}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {isMinimized && (
            <div className="px-4 py-3 text-xs text-bark-600">{pfUiT("ui.components.fabricstashmodal.84406e048c")}</div>
          )}

          {!isMinimized && !isCollapsed && (
            <button
              type="button"
              onMouseDown={beginResize}
              className="absolute bottom-2 right-2 flex h-8 w-8 cursor-nwse-resize items-center justify-center rounded-lg border border-sand-200 bg-white text-bark-500 shadow-sm"
              aria-label={pfUiT("ui.components.fabricstashmodal.62d20f1361")}
            >
              <Move className="h-4 w-4 rotate-45" />
            </button>
          )}

          {/* Medium goods-receipt modal. Actual receipt may differ from the incoming order. */}
          <AnimatePresence>
            {issueTargetId && (() => {
              const issueMaterial = materials.find((item) => item.id === issueTargetId);
              if (!issueMaterial) return null;

              const inventoryUnit = normalizeUnit(issueMaterial.unit);
              const availableQty = numericQuantity(issueMaterial.quantity);
              const currentValue = getInventoryValue(issueMaterial);

              return (
                <motion.div
                  key="material-issue-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[55] flex items-center justify-center bg-bark-950/45 p-4 backdrop-blur-[2px]"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: 10 }}
                    className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-sand-200 bg-sand-50 px-4 py-3">
                      <div>
                        <span className="block text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-clay-700">{pfUiT("ui.components.fabricstashmodal.767a92a734")}</span>
                        <h4 className="font-serif text-xl font-semibold text-bark-950">{pfUiT("ui.components.fabricstashmodal.1543a15d01")}</h4>
                        <p className="mt-0.5 text-[10px] text-bark-500">
                          {issueMaterial.name}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={closeIssueModal}
                        className="rounded-full border border-sand-200 p-2 text-bark-500 hover:bg-sand-100"
                        aria-label={pfUiT("ui.components.fabricstashmodal.97566f5823")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-4 p-4">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-sand-200 bg-[#FAF8F5] p-3">
                          <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.c4dc08c6d5")}</span>
                          <strong className="mt-1 block text-sm text-bark-950">
                            {availableQty.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                            {' '}
                            {getUom(inventoryUnit).shortLabel}
                          </strong>
                        </div>

                        <div className="rounded-xl border border-sand-200 bg-[#FAF8F5] p-3">
                          <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.2b7bbb3fb5")}</span>
                          <strong className="mt-1 block text-sm text-bark-950">
                            {issueMaterial.width || '—'}
                          </strong>
                        </div>

                        <div className="rounded-xl border border-sand-200 bg-[#FAF8F5] p-3">
                          <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.d0a40efcfe")}</span>
                          <strong className="mt-1 block text-sm text-emerald-800">
                            {formatMoney(currentValue, issueMaterial.currency)}
                          </strong>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[160px_1fr_120px]">
                        <label>
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.8db70d17ed")}</span>
                          <select
                            value={issueDraft.transactionType}
                            onChange={(event) =>
                              setIssueDraft((current) => ({
                                ...current,
                                transactionType: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          >
                            {materialsMetadata.stockIssue.transactionTypes.map((type) => (
                              <option key={type.code} value={type.code}>{type.label}</option>
                            ))}
                          </select>
                        </label>

                        <label>
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.c6b5808956")}</span>
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={issueDraft.quantity}
                            onChange={(event) =>
                              setIssueDraft((current) => ({
                                ...current,
                                quantity: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                            placeholder={pfUiT("ui.components.fabricstashmodal.bbcafa0254")}
                            autoFocus
                          />
                        </label>

                        <label>
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">
                            UOM
                          </span>
                          <select
                            value={normalizeUnit(issueDraft.unit)}
                            onChange={(event) =>
                              setIssueDraft((current) => ({
                                ...current,
                                unit: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          >
                            {materialsMetadata.uoms.map((uom) => (
                              <option key={uom.code} value={uom.code}>{uom.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.8d8c240a22")}</span>
                          <input
                            value={issueDraft.reference}
                            onChange={(event) =>
                              setIssueDraft((current) => ({
                                ...current,
                                reference: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                            placeholder={pfUiT("ui.components.fabricstashmodal.295c4c4b1d")}
                          />
                        </label>

                        <label>
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.2eab0caeed")}</span>
                          <input
                            value={issueDraft.notes}
                            onChange={(event) =>
                              setIssueDraft((current) => ({
                                ...current,
                                notes: event.target.value
                              }))
                            }
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                            placeholder={pfUiT("ui.components.fabricstashmodal.6a95041cbb")}
                          />
                        </label>
                      </div>

                      <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-[10px] text-bark-600">{pfUiT("ui.components.fabricstashmodal.2e07e6e6b9")}</div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-sand-200 bg-sand-50 px-4 py-3">
                      <button
                        type="button"
                        onClick={closeIssueModal}
                        className="rounded-full border border-sand-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-bark-600 hover:bg-sand-100"
                      >{pfUiT("ui.components.fabricstashmodal.1bc165702a")}</button>
                      <button
                        type="button"
                        onClick={confirmMaterialIssue}
                        className="inline-flex items-center gap-1.5 rounded-full bg-bark-900 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-bark-950"
                      >
                        <PackageMinus className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.4629260f67")}</button>
                    </div>
                  </motion.div>
                </motion.div>
              );
            })()}
          </AnimatePresence>

          <AnimatePresence>
            {receiveTarget && receiveMaterial && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[55] flex items-center justify-center bg-bark-950/45 p-4 backdrop-blur-[2px]"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeReceiveModal();
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="w-full max-w-xl overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-sand-200 bg-sand-50 px-4 py-3">
                    <div>
                      <span className="block text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-700">{pfUiT("ui.components.fabricstashmodal.e213d6eace")}</span>
                      <h4 className="font-serif text-xl font-semibold text-bark-950">{pfUiT("ui.components.fabricstashmodal.0a7dabcc5d")}</h4>
                      <p className="mt-0.5 text-[10px] text-bark-500">{pfUiT("ui.components.fabricstashmodal.d9a820847f")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeReceiveModal}
                      className="rounded-full border border-sand-200 p-2 text-bark-500 hover:bg-white"
                      aria-label={pfUiT("ui.components.fabricstashmodal.c0be77dbe9")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="grid gap-2 rounded-xl border border-sand-200 bg-[#FAF8F5] p-3 sm:grid-cols-4">
                      <div>
                        <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.786ff927ca")}</span>
                        <strong className="mt-1 block text-xs text-bark-900">{receiveMaterial.name}</strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.51b78c6439")}</span>
                        <strong className="mt-1 block text-xs text-bark-900">
                          {receiveTarget.orderedQuantity} {getUom(normalizeUnit(receiveTarget.unit)).shortLabel}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.e2580d8fbb")}</span>
                        <strong className="mt-1 block text-xs text-bark-900">
                          {getSupplierName(receiveTarget.supplierId, receiveTarget.supplierName || '—')}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[8px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.d45703c28c")}</span>
                        <strong className="mt-1 block text-xs text-bark-900">
                          {formatMoney(receiveTarget.unitCost, receiveTarget.currency || receiveMaterial.currency)}
                          {' / '}
                          {getUom(normalizeUnit(receiveTarget.unit)).shortLabel}
                        </strong>
                        <span className="block text-[9px] text-bark-450">
                          {formatMoney(
                            numericQuantity(receiveTarget.orderedQuantity) * numericQuantity(receiveTarget.unitCost),
                            receiveTarget.currency || receiveMaterial.currency
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.6b59215fa1")}</span>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={receiveDraft.quantity}
                          onChange={(event) => setReceiveDraft((current) => ({ ...current, quantity: event.target.value }))}
                          className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          autoFocus
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">UOM</span>
                        <select
                          value={normalizeUnit(receiveDraft.unit)}
                          onChange={(event) => setReceiveDraft((current) => ({ ...current, unit: event.target.value }))}
                          className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                        >
                          {materialsMetadata.uoms.map((uom) => (
                            <option key={uom.code} value={uom.code}>{uom.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.5f5a576587")}</span>
                      <input
                        value={receiveDraft.width || ''}
                        onChange={(event) => setReceiveDraft((current) => ({ ...current, width: event.target.value }))}
                        className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                        placeholder="e.g. 150 cm or 60&quot;"
                      />
                      <span className="mt-1 block text-[9px] text-bark-450">{pfUiT("ui.components.fabricstashmodal.3eccf987c7")}</span>
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.8b85666bf7")}</span>
                        <input
                          value={receiveDraft.deliveryReference}
                          onChange={(event) => setReceiveDraft((current) => ({ ...current, deliveryReference: event.target.value }))}
                          className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          placeholder={pfUiT("ui.components.fabricstashmodal.6a95041cbb")}
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.848198146f")}</span>
                        <input
                          value={receiveDraft.notes}
                          onChange={(event) => setReceiveDraft((current) => ({ ...current, notes: event.target.value }))}
                          className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          placeholder={pfUiT("ui.components.fabricstashmodal.6a95041cbb")}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-sand-200 bg-sand-50 px-4 py-3">
                    <span className="text-[9px] text-bark-450">{pfUiT("ui.components.fabricstashmodal.bb9a90e60d")}</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={closeReceiveModal}
                        className="rounded-full border border-sand-200 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-bark-600 hover:bg-sand-100"
                      >{pfUiT("ui.components.fabricstashmodal.3735c8652a")}</button>
                      <button
                        type="button"
                        onClick={confirmReceive}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-emerald-800"
                      >
                        <Check className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.b2a7b54c87")}</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {editorOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="absolute inset-4 md:inset-6 z-[40] overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-3">
                  <div>
                    <span className="block text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-clay-700">{pfUiT("ui.components.fabricstashmodal.f4f32f306b")}</span>
                    <h4 className="font-serif text-xl font-semibold text-bark-950">{draft.name || 'New material'}</h4>
                    <p className="text-[10px] text-bark-500">{pfUiT("ui.components.fabricstashmodal.3de3f184cf")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={saveDraft} className="inline-flex items-center gap-1.5 rounded-full bg-bark-900 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-bark-950">
                      <Save className="h-3.5 w-3.5" />{pfUiT("ui.components.fabricstashmodal.7671a9629f")}</button>
                    <button type="button" onClick={() => { stopCamera(); setEditorOpen(false); }} className="rounded-full border border-sand-200 p-2 text-bark-500 hover:bg-sand-100" aria-label={pfUiT("ui.components.fabricstashmodal.fc1473dc23")}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid h-[calc(100%-84px)] grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
                  <div className="overflow-y-auto border-b border-sand-200 bg-[#FAF8F5] p-4 lg:border-b-0 lg:border-r">
                    <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
                      <div className="aspect-[4/3] bg-sand-100">
                        {isCameraActive ? (
                          <video ref={cameraVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                        ) : draft.image ? (
                          <img src={draft.image} alt={draft.name || 'Material preview'} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-bark-350">
                            <ImageIcon className="h-10 w-10" />
                            <span className="text-xs font-semibold">{pfUiT("ui.components.fabricstashmodal.d485bbe6fb")}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 p-3">
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-bark-700 hover:border-clay-300 hover:text-clay-700">
                            <Upload className="h-4 w-4" />{pfUiT("ui.components.fabricstashmodal.369a653ce4")}</button>
                          {isCameraActive ? (
                            <button type="button" onClick={captureCameraPhoto} className="flex items-center justify-center gap-2 rounded-xl bg-bark-900 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-bark-950">
                              <Camera className="h-4 w-4" />{pfUiT("ui.components.fabricstashmodal.947639d316")}</button>
                          ) : (
                            <button type="button" onClick={startCamera} className="flex items-center justify-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-bark-700 hover:border-clay-300 hover:text-clay-700">
                              <Camera className="h-4 w-4" />{pfUiT("ui.components.fabricstashmodal.7a81380cea")}</button>
                          )}
                        </div>
                        {isCameraActive && (
                          <button type="button" onClick={stopCamera} className="flex w-full items-center justify-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-bark-700 hover:border-clay-300 hover:text-clay-700">
                            <RefreshCw className="h-4 w-4" />{pfUiT("ui.components.fabricstashmodal.7ed793d224")}</button>
                        )}
                        {cameraError && (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">{cameraError}</p>
                        )}

                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-500">{pfUiT("ui.components.fabricstashmodal.335a825c91")}</span>
                            <button type="button" onClick={pickColour} className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[9px] font-bold uppercase text-bark-650 hover:text-clay-700">
                              <Palette className="h-3 w-3" />{pfUiT("ui.components.fabricstashmodal.d073c99a30")}</button>
                          </div>
                          <div className="grid grid-cols-[44px_1fr] gap-2">
                            <input type="color" value={draft.colour || '#ba6446'} onChange={(event) => updateDraft('colour', event.target.value)} className="h-10 w-11 cursor-pointer rounded border border-sand-200 bg-white p-1" aria-label={pfUiT("ui.components.fabricstashmodal.5cdf2d1663")} />
                            <input value={draft.colour || ''} onChange={(event) => updateDraft('colour', event.target.value)} className="rounded-lg border border-sand-200 px-3 py-2 text-sm font-mono text-bark-800 outline-none focus:border-clay-400" placeholder="#ba6446" />
                          </div>
                          <label className="mt-2 block">
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.533fd9b4bf")}</span>
                            <input value={draft.colourCategory || ''} onChange={(event) => updateDraft('colourCategory', event.target.value)} className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm text-bark-800 outline-none focus:border-clay-400" placeholder={pfUiT("ui.components.fabricstashmodal.d347d5c470")} />
                          </label>
                        </div>

                        <div className="rounded-xl border border-sand-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-clay-700">{pfUiT("ui.components.fabricstashmodal.14244f2891")}</span>
                              <span className="mt-0.5 block text-[9px] text-bark-450">{pfUiT("ui.components.fabricstashmodal.3161141d75")}</span>
                            </div>
                            <span
                              className="h-8 w-8 rounded border border-sand-200"
                              style={{ backgroundColor: draft.colour || '#ba6446' }}
                            />
                          </div>

                          <div className="mt-3 grid gap-2">
                            <input
                              value={draft.pantoneCode || ''}
                              onChange={(event) => updateDraft('pantoneCode', event.target.value)}
                              className="rounded-lg border border-sand-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-clay-400"
                              placeholder="13-0002-TCX"
                            />
                            <input
                              value={draft.pantoneName || ''}
                              onChange={(event) => updateDraft('pantoneName', event.target.value)}
                              className="rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                              placeholder={pfUiT("ui.components.fabricstashmodal.1d4dde979c")}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={verifyPantoneDraft}
                            disabled={pantoneBusy}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-sand-250 bg-sand-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-bark-700 hover:border-clay-300 hover:text-clay-700 disabled:opacity-60"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {pantoneBusy ? 'Checking…' : 'Verify Pantone reference'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-y-auto p-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <section className="space-y-3 rounded-2xl border border-sand-200 bg-[#FAF8F5]/60 p-4">
                        <h5 className="flex items-center gap-2 font-serif text-lg font-semibold text-bark-950"><Edit3 className="h-4 w-4 text-clay-700" />{pfUiT("ui.components.fabricstashmodal.6835768ba6")}</h5>
                        {[
                          ['name', 'Material name'],
                          ['category', 'Category'],
                          ['fabricType', 'Fabric type'],
                          ['fabricComposition', 'Composition summary'],
                          ['width', 'Width'],
                          ['density', 'Density'],
                          ['gsm', 'GSM / weight']
                        ].map(([field, label]) => (
                          <label key={field} className="block">
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{label}</span>
                            <input value={draft[field] || ''} onChange={(event) => updateDraft(field, event.target.value)} className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-bark-850 outline-none focus:border-clay-400" />
                          </label>
                        ))}

                        <div>
                          <span className="mb-2 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.e6e17abe75")}</span>
                          <div className="rounded-xl border border-sand-200 bg-white p-3">
                            <div className="mb-2 flex min-h-8 flex-wrap gap-1.5">
                              {(draft.fabricFinish || []).length > 0 ? (
                                draft.fabricFinish.map((finish) => (
                                  <button key={finish} type="button" onClick={() => toggleFabricFinish(finish)} className="rounded-full border border-clay-500 bg-clay-50 px-2.5 py-1 text-[10px] font-semibold text-clay-800">
                                    {finish} <X className="ml-1 inline h-3 w-3" />
                                  </button>
                                ))
                              ) : (
                                <span className="text-xs text-bark-450">{pfUiT("ui.components.fabricstashmodal.2534e53b32")}</span>
                              )}
                            </div>
                            <select
                              value=""
                              onChange={(event) => {
                                addFabricFinishToDraft(event.target.value);
                                event.target.value = '';
                              }}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-xs font-semibold text-bark-800 outline-none focus:border-clay-400"
                            >
                              <option value="">{pfUiT("ui.components.fabricstashmodal.fdf5ed5d7f")}</option>
                              {fabricFinishOptions
                                .filter((finish) => !(draft.fabricFinish || []).includes(finish))
                                .map((finish) => <option key={finish} value={finish}>{finish}</option>)}
                            </select>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <input value={newFabricFinish} onChange={(event) => setNewFabricFinish(event.target.value)} className="flex-1 rounded-lg border border-sand-200 px-3 py-2 text-xs outline-none focus:border-clay-400" placeholder={pfUiT("ui.components.fabricstashmodal.fd2ea2b170")} />
                            <button type="button" onClick={addFabricFinish} className="rounded-lg bg-bark-900 px-3 py-2 text-xs font-bold text-white">{pfUiT("ui.components.fabricstashmodal.fdf5ed5d7f")}</button>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-3 rounded-2xl border border-sand-200 bg-white p-4">
                        <h5 className="flex items-center gap-2 font-serif text-lg font-semibold text-bark-950">
                          <PackagePlus className="h-4 w-4 text-emerald-700" />{pfUiT("ui.components.fabricstashmodal.c9f115531d")}</h5>

                        {/* Keep the established quantity + stock tracking model, with metadata-driven UOM. */}
                        <div className="grid grid-cols-2 gap-3">
                          <label>
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.745ef95121")}</span>
                            <input
                              value={draft.quantity ?? ''}
                              onChange={(event) => updateDraft('quantity', event.target.value)}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                              placeholder="0 = swatch only"
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">UOM</span>
                            <select
                              value={normalizeUnit(draft.unit)}
                              onChange={(event) => updateDraft('unit', event.target.value)}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                            >
                              {materialsMetadata.uoms.map((uom) => (
                                <option key={uom.code} value={uom.code}>{uom.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="flex items-start gap-2 rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm text-bark-700">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.hasInventory)}
                            onChange={(event) => updateDraft('hasInventory', event.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-sand-300 accent-clay-600"
                          />
                          <span>
                            <strong className="block text-bark-900">{pfUiT("ui.components.fabricstashmodal.8992cd6cdb")}</strong>{pfUiT("ui.components.fabricstashmodal.a1fe8af318")}</span>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label>
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.af35992511")}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft.unitCost ?? 0}
                              onChange={(event) => updateDraft('unitCost', event.target.value)}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.ae6d08206a")}</span>
                            <select
                              value={draft.currency || 'USD'}
                              onChange={(event) => updateDraft('currency', event.target.value)}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                            >
                              {materialsMetadata.currencies.map((currency) => (
                                <option key={currency.code} value={currency.code}>{currency.code}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                          <span className="block text-[9px] font-mono font-bold uppercase text-emerald-700">{pfUiT("ui.components.fabricstashmodal.d0a40efcfe")}</span>
                          <strong className="mt-1 block font-serif text-lg text-emerald-900">
                            {numericQuantity(draft.quantity) > 0
                              ? formatMoney(
                                  numericQuantity(draft.quantity) * numericQuantity(draft.unitCost),
                                  draft.currency || 'USD'
                                )
                              : '—'}
                          </strong>
                          <span className="block text-[9px] text-emerald-700/80">{pfUiT("ui.components.fabricstashmodal.4e0e1b2e99")}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label>
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.e41cb0f853")}</span>
                            <input
                              value={draft.reorderPoint ?? ''}
                              onChange={(event) => updateDraft('reorderPoint', event.target.value)}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                              placeholder="1"
                            />
                          </label>
                          <label>
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.bd06c46fd5")}</span>
                            <input
                              value={draft.lowStockThreshold ?? ''}
                              onChange={(event) => updateDraft('lowStockThreshold', event.target.value)}
                              className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                              placeholder="3"
                            />
                          </label>
                        </div>

                        {/* Supplier relationship: many suppliers may be linked, one is primary. */}
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.20b3267cae")}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditorOpen(false);
                                setActiveWorkspaceTab('suppliers');
                              }}
                              className="text-[9px] font-bold text-clay-700 hover:text-clay-800"
                            >{pfUiT("ui.components.fabricstashmodal.7f24d55b1f")}</button>
                          </div>

                          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-sand-200 bg-sand-50 p-2">
                            {suppliers.length === 0 ? (
                              <span className="block p-2 text-xs text-bark-450">{pfUiT("ui.components.fabricstashmodal.17858fc64a")}</span>
                            ) : (
                              suppliers.map((supplier) => {
                                const linked = (draft.supplierIds || []).includes(supplier.id);
                                const primary = draft.primarySupplierId === supplier.id;

                                return (
                                  <div key={supplier.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
                                    <input
                                      type="checkbox"
                                      checked={linked}
                                      onChange={() => toggleDraftSupplier(supplier.id)}
                                      className="h-4 w-4 rounded border-sand-300 accent-clay-600"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-bark-800">
                                      {supplier.name}
                                    </span>
                                    {linked && (
                                      <button
                                        type="button"
                                        onClick={() => setDraftPrimarySupplier(supplier.id)}
                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-bold uppercase ${
                                          primary
                                            ? 'bg-clay-100 text-clay-800'
                                            : 'bg-sand-100 text-bark-500 hover:text-clay-700'
                                        }`}
                                      >
                                        <Star className={`h-3 w-3 ${primary ? 'fill-current' : ''}`} />
                                        {primary ? 'Primary' : 'Make primary'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {draft.preferredSupplier && !draft.primarySupplierId && (
                            <p className="mt-1 text-[9px] text-bark-450">
                              Legacy preferred supplier: {draft.preferredSupplier}
                            </p>
                          )}
                        </div>

                        <label className="block">
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.a28ddd5036")}</span>
                          <input
                            value={draft.location || ''}
                            onChange={(event) => updateDraft('location', event.target.value)}
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          />
                        </label>

                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-3 text-sm">
                          <span className="block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.1472691028")}</span>
                          <strong className={draftStock.tone === 'emerald' ? 'text-emerald-800' : draftStock.tone === 'rose' ? 'text-rose-800' : draftStock.tone === 'amber' ? 'text-amber-800' : 'text-clay-800'}>
                            {draftStock.label}
                          </strong>
                          <span className="block text-[11px] text-bark-500">{draftStock.description}</span>
                        </div>

                        <label className="block">
                          <span className="mb-1 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.b6ac7d6d4d")}</span>
                          <textarea
                            value={draft.notes || ''}
                            onChange={(event) => updateDraft('notes', event.target.value)}
                            rows={5}
                            className="w-full rounded-lg border border-sand-200 px-3 py-2 text-sm outline-none focus:border-clay-400"
                          />
                        </label>
                      </section>

                      <section className="space-y-3 rounded-2xl border border-sand-200 bg-white p-4 xl:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <h5 className="font-serif text-lg font-semibold text-bark-950">{pfUiT("ui.components.fabricstashmodal.f373ca9597")}</h5>
                          <button type="button" onClick={() => setDraft((current) => ({ ...current, yarns: [...(current.yarns || []), blankYarn()] }))} className="rounded-full border border-sand-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-bark-700 hover:border-clay-300">{pfUiT("ui.components.fabricstashmodal.409cdd9bd6")}</button>
                        </div>

                        {(draft.yarns || []).length === 0 && (
                          <p className="rounded-xl border border-dashed border-sand-200 bg-sand-50 p-4 text-sm text-bark-500">{pfUiT("ui.components.fabricstashmodal.c59a0d965b")}</p>
                        )}

                        <div className="space-y-3">
                          {(draft.yarns || []).map((yarn, index) => (
                            <div key={yarn.id} className="rounded-xl border border-sand-200 bg-[#FAF8F5]/60 p-3">
                              <div className="mb-3 flex justify-between">
                                <strong className="text-xs uppercase tracking-wider text-bark-700">Yarn {index + 1}</strong>
                                <button type="button" onClick={() => setDraft((current) => ({ ...current, yarns: current.yarns.filter((_, i) => i !== index) }))} className="text-rose-600">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid gap-3 md:grid-cols-4">
                                <input value={yarn.yarnCount || ''} onChange={(event) => updateYarn(index, 'yarnCount', event.target.value)} className="rounded-lg border border-sand-200 px-3 py-2 text-sm" placeholder={pfUiT("ui.components.fabricstashmodal.9893ee3528")} />
                                <input type="color" value={yarn.yarnColour || '#ba6446'} onChange={(event) => updateYarn(index, 'yarnColour', event.target.value)} className="h-10 rounded-lg border border-sand-200 p-1" />
                                <input value={yarn.yarnQuality || ''} onChange={(event) => updateYarn(index, 'yarnQuality', event.target.value)} className="rounded-lg border border-sand-200 px-3 py-2 text-sm" placeholder={pfUiT("ui.components.fabricstashmodal.1f030d13d2")} />
                                <input value={yarn.yarnComposition || ''} onChange={(event) => updateYarn(index, 'yarnComposition', event.target.value)} className="rounded-lg border border-sand-200 px-3 py-2 text-sm" placeholder={pfUiT("ui.components.fabricstashmodal.5286f6bb08")} />
                              </div>
                              <div className="mt-3 rounded-xl border border-sand-200 bg-white p-3">
                                <span className="mb-2 block text-[9px] font-mono font-bold uppercase text-bark-400">{pfUiT("ui.components.fabricstashmodal.23c16dfc56")}</span>
                                <div className="mb-2 flex min-h-8 flex-wrap gap-1.5">
                                  {(yarn.yarnSpecialFinish || []).length > 0 ? (
                                    yarn.yarnSpecialFinish.map((finish) => (
                                      <button key={finish} type="button" onClick={() => toggleYarnFinish(index, finish)} className="rounded-full border border-clay-500 bg-clay-50 px-2.5 py-1 text-[10px] font-semibold text-clay-800">
                                        {finish} <X className="ml-1 inline h-3 w-3" />
                                      </button>
                                    ))
                                  ) : (
                                    <span className="text-xs text-bark-450">{pfUiT("ui.components.fabricstashmodal.18fe3f8502")}</span>
                                  )}
                                </div>
                                <select
                                  value=""
                                  onChange={(event) => {
                                    addYarnFinishToDraft(index, event.target.value);
                                    event.target.value = '';
                                  }}
                                  className="w-full rounded-lg border border-sand-200 px-3 py-2 text-xs font-semibold text-bark-800 outline-none focus:border-clay-400"
                                >
                                  <option value="">{pfUiT("ui.components.fabricstashmodal.30e3bdbdca")}</option>
                                  {yarnFinishOptions
                                    .filter((finish) => !(yarn.yarnSpecialFinish || []).includes(finish))
                                    .map((finish) => <option key={finish} value={finish}>{finish}</option>)}
                                </select>
                                <div className="mt-2 flex gap-2">
                                  <input value={newYarnFinish} onChange={(event) => setNewYarnFinish(event.target.value)} className="flex-1 rounded-lg border border-sand-200 px-3 py-2 text-xs outline-none focus:border-clay-400" placeholder={pfUiT("ui.components.fabricstashmodal.4d2c0d4904")} />
                                  <button type="button" onClick={() => addYarnFinish(index)} className="rounded-lg bg-bark-900 px-3 py-2 text-xs font-bold text-white">{pfUiT("ui.components.fabricstashmodal.d3306fa2e4")}</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
