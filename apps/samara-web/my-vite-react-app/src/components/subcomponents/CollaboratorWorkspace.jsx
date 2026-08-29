import { runtimeDataStorage } from '../../lib/runtimeDataGateway';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, RotateCcw, Clock, Plus, Trash2, Scissors, Ruler,
  FolderKanban, ClipboardList, TrendingUp, User, Briefcase,
  ChevronLeft, ChevronRight, Sparkles, Phone, Mail, MapPin,
  CheckSquare, PlusCircle, Scale, AlertTriangle, Package, Calendar,
  ChevronDown, Check, Info, FileText, Save, RefreshCw, Calculator,
  DollarSign, ListTodo, ShieldCheck, Zap, ArrowRight, UserCheck, Eye, Layers,
  Download, Tag, Key, Lock, Share2, Copy, ExternalLink, CheckCircle2, Building2
} from 'lucide-react';
import {
  CATALOG_AUDIENCES,
  DEFAULT_DESIGNER_BRANDS,
  DEFAULT_COLLECTION_TAGS,
  PRODUCT_STATUS,
  CATEGORY_REQUEST_STATUS,
  getCategoriesForAudience,
  slugifyCatalogValue
} from '../../data/catalogTaxonomy';
import { UI_LAYERS } from '../../lib/uiLayers';
import { MASTER_SIZING_TABLE } from '../../data.js';
import { useRuntimeCollectionState } from '../../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../../lib/runtimeDomainContracts';
import SewingSessionTimer from '../SewingSessionTimer.jsx';
import MannequinGuide from '../MannequinGuide.jsx';
import IndustrialTechPack from '../IndustrialTechPack.jsx';
import ProductDevelopmentMediaGallery from './ProductDevelopmentMediaGallery.jsx';
import OnboardingWalkthrough from './OnboardingWalkthrough.jsx';
import { jsPDF } from 'jspdf';

// Static steps per pattern for the timer
const PATTERN_STEPS = {
  'Trench': [
    { step: '01', op: 'Fuse Front Facings & Waistline Stabilizers', sam: 12.0 },
    { step: '02', op: 'Staystitch Front Neckline & Armholes', sam: 8.5 },
    { step: '03', op: 'Stitch Bust Darts & Back Seams', sam: 15.0 },
    { step: '04', op: 'Construct French Seams & Side Pockets', sam: 35.0 },
    { step: '05', op: 'Assemble & Attach Double Collar', sam: 25.0 }
  ],
  'Skirt': [
    { step: '01', op: 'Map Zero-Waste Cutting Nodes', sam: 8.0 },
    { step: '02', op: 'Double Needle Lock Stitch Side Belts', sam: 10.0 },
    { step: '03', op: 'Stitch Bottom Rolled Hems', sam: 12.0 }
  ],
  'Smock': [
    { step: '01', op: 'Gather Sleeve Caps & Armhole Baselines', sam: 15.0 },
    { step: '02', op: 'Stitch Side Seams (Flat-Felled)', sam: 18.0 },
    { step: '03', op: 'Apply Bias Bound Neck Facing', sam: 10.0 }
  ],
  'Blazer': [
    { step: '01', op: 'Construct Canvas Interlining & Lapels', sam: 45.0 },
    { step: '02', op: 'Stitch Double-Welt Pockets with Flaps', sam: 30.0 },
    { step: '03', op: 'Set Shoulder Pads & Two-Piece Sleeves', sam: 40.0 }
  ]
};

export default function CollaboratorWorkspace() {
  const [catalogProducts] = useRuntimeCollectionState(RUNTIME_DOMAINS.CATALOG_PRODUCTS, []);
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'timer' | 'supply' | 'measurements' | 'techpacks'
  const [workspaceRecommendedSize, setWorkspaceRecommendedSize] = useState('8');

  // --- TECH PACKS & COLLABORATOR SECRETS STATE ---
  const [selectedTechPackPatternId, setSelectedTechPackPatternId] = useState('');
  const [techPackSubTab, setTechPackSubTab] = useState('specs'); // 'specs' | 'flats' | 'industrial' | 'secrets'
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenGenerated, setTokenGenerated] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);
  
  const [secretNotesMap, setSecretNotesMap] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_collaborator_secrets');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const selectedTechPackPattern = useMemo(() => {
    return catalogProducts.find(p => p.id === selectedTechPackPatternId) || catalogProducts[0] || null;
  }, [catalogProducts, selectedTechPackPatternId]);

  const handleSaveSecretNote = (patternId, text) => {
    const updated = { ...secretNotesMap, [patternId]: text };
    setSecretNotesMap(updated);
    try {
      runtimeDataStorage.setItem('sartorial_collaborator_secrets', JSON.stringify(updated));
    } catch {}
    if (window.showToast) {
      window.showToast("Collaborator secret development notes saved securely.", "success", "Secrets Journal Updated");
    }
  };

  const handleGenerateTokenLink = () => {
    const randomHash = Math.random().toString(36).substring(2, 10);
    const token = `pf_secret_${selectedTechPackPatternId}_${randomHash}`;
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?token=${token}&pattern=${selectedTechPackPatternId}`;
    setTokenGenerated(url);
    setTokenCopied(false);
    setShowTokenModal(true);
  };

  // Walkthrough / Tour Guide state
  const [walkthroughActive, setWalkthroughActive] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [sewingTimerForceViewMode, setSewingTimerForceViewMode] = useState(null);

  // --- PROJECTS WORKSPACE STATE ---
  const [projects, setProjects] = useRuntimeCollectionState(RUNTIME_DOMAINS.PROJECTS, []);
  const [newProjName, setNewProjName] = useState('');
  const [newProjPattern, setNewProjPattern] = useState('Trench');
  const [selectedProjectId, setSelectedProjectId] = useState('proj-1');

// Product / pattern submission workflow
const [productSubmissions, setProductSubmissions] = useState(() => {
  try {
    const saved = runtimeDataStorage.getItem('perfectfit_product_submissions');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
});

const [newProductName, setNewProductName] = useState('');
const [newProductDescription, setNewProductDescription] = useState('');
const [designerBrand, setDesignerBrand] = useState('Perfect Fit Bureau');
const [audience, setAudience] = useState('women');
const [mainCategory, setMainCategory] = useState('dresses');
const [productDifficulty, setProductDifficulty] = useState('Intermediate');
const [productPricePDF, setProductPricePDF] = useState('12.00');
const [productPricePrinted, setProductPricePrinted] = useState('22.00');
const [selectedCollectionTags, setSelectedCollectionTags] = useState([]);

const [isRequestingCategory, setIsRequestingCategory] = useState(false);
const [requestedCategoryName, setRequestedCategoryName] = useState('');
const [requestedCategoryReason, setRequestedCategoryReason] = useState('');
useEffect(() => {
  try {
    runtimeDataStorage.setItem('perfectfit_product_submissions',
      JSON.stringify(productSubmissions)
    );
  } catch {}
}, [productSubmissions]);



  const saveProjects = (updated) => {
    setProjects(updated);
    try {
      runtimeDataStorage.setItem('sartorial_atelier_projects', JSON.stringify(updated));
    } catch {}
  };

  // Global Keyboard Shortcut listener for Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if Ctrl+S or Cmd+S is pressed
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();

        // Dispatch the custom event to trigger save in other mounted components
        window.dispatchEvent(new CustomEvent('sartorial-save-shortcut'));

        // Show a nice toast indicating success
        if (window.showToast) {
          window.showToast(
            "Progress saved! Mannequin measurements and Time Study data successfully saved to local workspace ledger.",
            "success",
            "Atelier Progress Saved"
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

const availableProductCategories = getCategoriesForAudience(audience);

const handleAudienceChange = (nextAudience) => {
  setAudience(nextAudience);

  const firstCategory = getCategoriesForAudience(nextAudience)[0];

  if (firstCategory) {
    setMainCategory(firstCategory.id);
  }
};

const toggleCollectionTag = (tagId) => {
  setSelectedCollectionTags((prev) =>
    prev.includes(tagId)
      ? prev.filter((id) => id !== tagId)
      : [...prev, tagId]
  );
};

const handleSubmitProductForReview = (e) => {
  e.preventDefault();

  if (!newProductName.trim()) {
    alert('Please enter a product / pattern name.');
    return;
  }

  if (isRequestingCategory && !requestedCategoryName.trim()) {
    alert('Please enter the requested category name.');
    return;
  }

  const submission = {
    id: `product-sub-${Date.now()}`,
    name: newProductName,
    description: newProductDescription,

    designerBrand,
    designerSlug: slugifyCatalogValue(designerBrand),

    audience,
    mainCategory,
    category: mainCategory,
    subCategory: mainCategory,

    difficulty: productDifficulty,
    collectionTags: selectedCollectionTags,

    pricePDF: parseFloat(productPricePDF) || 12.0,
    pricePrinted: parseFloat(productPricePrinted) || 22.0,

    isListed: false,
    status: isRequestingCategory
      ? PRODUCT_STATUS.CATEGORY_REVIEW_REQUIRED
      : PRODUCT_STATUS.SUBMITTED,

    categoryRequest: isRequestingCategory
      ? {
          id: `cat-req-${Date.now()}`,
          parentAudience: audience,
          requestedCategoryName,
          requestedCategorySlug: slugifyCatalogValue(requestedCategoryName),
          reason: requestedCategoryReason,
          status: CATEGORY_REQUEST_STATUS.SUBMITTED,
          createdAt: new Date().toISOString()
        }
      : null,

    createdAt: new Date().toISOString()
  };

  setProductSubmissions((prev) => [submission, ...prev]);

  setNewProductName('');
  setNewProductDescription('');
  setDesignerBrand('Perfect Fit Bureau');
  setAudience('women');
  setMainCategory('dresses');
  setProductDifficulty('Intermediate');
  setProductPricePDF('12.00');
  setProductPricePrinted('22.00');
  setSelectedCollectionTags([]);
  setIsRequestingCategory(false);
  setRequestedCategoryName('');
  setRequestedCategoryReason('');

  if (window.showToast) {
    window.showToast(
      'Product submitted for administrator review.',
      'success',
      'Submission Created'
    );
  }
};

  const handleAddProject = (e) => {
    e.preventDefault();
    if (!newProjName.trim()) return;

    const newProj = {
      id: `proj-${Date.now()}`,
      name: newProjName,
      patternName: newProjPattern,
      status: 'Planning',
      progress: 0,
      startedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      tasks: [
        { id: `t-${Date.now()}-1`, text: 'Obtain precise body sizing measurements', completed: false },
        { id: `t-${Date.now()}-2`, text: 'Select appropriate linen/cotton textile yardage', completed: false },
        { id: `t-${Date.now()}-3`, text: 'Calibrate custom dummy posture settings', completed: false }
      ]
    };

    const updated = [newProj, ...projects];
    saveProjects(updated);
    setSelectedProjectId(newProj.id);
    setNewProjName('');
  };

  const handleDeleteProject = (id, e) => {
    e.stopPropagation();
    const updated = projects.filter(p => p.id !== id);
    saveProjects(updated);
    if (selectedProjectId === id && updated.length > 0) {
      setSelectedProjectId(updated[0].id);
    }
  };

  const toggleTask = (projId, taskId) => {
    const updated = projects.map(proj => {
      if (proj.id === projId) {
        const updatedTasks = proj.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        );
        const completedCount = updatedTasks.filter(t => t.completed).length;
        const totalCount = updatedTasks.length;
        const nextProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
          ...proj,
          tasks: updatedTasks,
          progress: nextProgress,
          status: nextProgress === 100 ? 'Completed' : nextProgress > 0 ? 'In Progress' : 'Planning'
        };
      }
      return proj;
    });
    saveProjects(updated);
  };

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0];
  }, [projects, selectedProjectId]);


  // --- SEWING SESSION TIMER STATE ---
  const [timerProjId, setTimerProjId] = useState('proj-1');
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const intervalRef = useRef(null);
  const [sessionLogs, setSessionLogs] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_timer_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [timerNotes, setTimerNotes] = useState('');

  const timerProject = useMemo(() => {
    return projects.find(p => p.id === timerProjId) || projects[0];
  }, [projects, timerProjId]);

  const activeSteps = useMemo(() => {
    if (!timerProject) return PATTERN_STEPS['Trench'];
    return PATTERN_STEPS[timerProject.patternName] || PATTERN_STEPS['Trench'];
  }, [timerProject]);

  useEffect(() => {
    if (isTimerRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning]);

  const handleStartPause = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setSecondsElapsed(0);
  };

  const handleLogSession = () => {
    if (secondsElapsed < 1) return;
    const minutes = parseFloat((secondsElapsed / 60).toFixed(2));
    const targetSAM = activeSteps[activeStepIdx]?.sam || 10;
    const efficiency = minutes > 0 ? Math.round((targetSAM / minutes) * 100) : 100;

    const newLog = {
      id: `log-${Date.now()}`,
      projectName: timerProject?.name || 'Bespoke Garment',
      patternName: timerProject?.patternName || 'Trench',
      operation: activeSteps[activeStepIdx]?.op || 'General sewing',
      durationMinutes: minutes,
      targetSAM: targetSAM,
      efficiencyPercent: Math.min(efficiency, 250), // Cap at 250%
      timestamp: new Date().toLocaleString(),
      notes: timerNotes || 'Standard craft pass'
    };

    const updated = [newLog, ...sessionLogs];
    setSessionLogs(updated);
    setTimerNotes('');
    setSecondsElapsed(0);
    setIsTimerRunning(false);

    try {
      runtimeDataStorage.setItem('sartorial_timer_logs', JSON.stringify(updated));
    } catch {}

    if (window.showToast) {
      window.showToast(`Logged ${minutes}m of sewing time. Efficiency: ${efficiency}%`, 'success', 'Session Recorded');
    }
  };

  const handleDeleteLog = (logId) => {
    const updated = sessionLogs.filter(l => l.id !== logId);
    setSessionLogs(updated);
    try {
      runtimeDataStorage.setItem('sartorial_timer_logs', JSON.stringify(updated));
    } catch {}
  };


  // --- MATERIALS, SUPPLIERS, & CONTACTS STATE ---
  const [inventory, setInventory] = useRuntimeCollectionState(RUNTIME_DOMAINS.INVENTORY, []);
  const [suppliers, setSuppliers] = useRuntimeCollectionState(RUNTIME_DOMAINS.SUPPLIERS, []);

  const [materialsTab, setMaterialsTab] = useState('inventory'); // 'inventory' | 'suppliers' | 'orders'

  // Restock order logs
  const [supplyOrders, setSupplyOrders] = useRuntimeCollectionState(RUNTIME_DOMAINS.SUPPLY_ORDERS, []);

  const saveInventory = (updated) => {
    setInventory(updated);
  };

  const saveSuppliers = (updated) => {
    setSuppliers(updated);
  };

  const saveSupplyOrders = (updated) => {
    setSupplyOrders(updated);
  };

  // Add material
  const [newMatName, setNewMatName] = useState('');
  const [newMatColor, setNewMatColor] = useState('');
  const [newMatStock, setNewMatStock] = useState(30);
  const [newMatCost, setNewMatCost] = useState(18.00);
  const [newMatType, setNewMatType] = useState('Fabric Roll');
  const [newMatSupplierId, setNewMatSupplierId] = useState('sup-1');
  const [newMatTags, setNewMatTags] = useState('Organic, Fabric');

  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (!newMatName.trim()) return;

    const parsedTags = newMatTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const newMaterial = {
      id: `inv-${Date.now()}`,
      name: newMatName,
      type: newMatType,
      color: newMatColor || 'N/A',
      stock: parseFloat(newMatStock) || 0,
      threshold: 15.0,
      cost: parseFloat(newMatCost) || 0,
      status: parseFloat(newMatStock) <= 15.0 ? 'Low Stock' : 'In Stock',
      weight: '230 GSM',
      supplierId: newMatSupplierId,
      tags: parsedTags.length > 0 ? parsedTags : ['Custom']
    };

    const updated = [...inventory, newMaterial];
    saveInventory(updated);
    setNewMatName('');
    setNewMatColor('');
    setNewMatStock(30);
    setNewMatCost(18.00);
    setNewMatTags('Organic, Fabric');

    if (window.showToast) {
      window.showToast(`Material "${newMatName}" added successfully.`, 'success', 'Inventory Updated');
    }
  };

  const exportToPdf = () => {
    const doc = new jsPDF();

    // Header Panel
    doc.setFillColor(250, 248, 245); // Sand background
    doc.rect(0, 0, 210, 45, 'F');

    // Title / Header Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(140, 98, 57); // Clay Theme Color #8c6239
    doc.text("PERFECT FIT BUREAU", 15, 20);

    doc.setFontSize(11);
    doc.setTextColor(80, 75, 70);
    doc.setFont("helvetica", "normal");
    doc.text("TEXTILE STOCK LED COMMERCE & FABRIC INVENTORY REPORT", 15, 27);

    // Metadata block
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.setFontSize(8.5);
    doc.setTextColor(130, 125, 120);
    doc.text(`Generated: ${today}`, 15, 34);

    const totalYardage = inventory.reduce((sum, item) => sum + item.stock, 0).toFixed(1);
    const totalValue = inventory.reduce((sum, item) => sum + (item.stock * item.cost), 0).toFixed(2);
    doc.text(`Total Active Swatches: ${inventory.length}   |   Total Yardage: ${totalYardage} Yds   |   Asset Valuation: $${totalValue}`, 15, 39);

    // Decorative clay line
    doc.setDrawColor(140, 98, 57);
    doc.setLineWidth(1.5);
    doc.line(15, 45, 195, 45);

    let y = 58;

    // Draw table headers
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(40, 40, 40);
    doc.text("Material Swatch Details", 15, y);
    doc.text("Category & Weight", 90, y);
    doc.text("Stock Level", 130, y);
    doc.text("Cost / Yd", 160, y);
    doc.text("Asset Value", 180, y);

    // Underline headers
    doc.setDrawColor(200, 195, 185);
    doc.setLineWidth(0.5);
    doc.line(15, y + 3, 195, y + 3);
    y += 12;

    inventory.forEach((item, index) => {
      // Manage page breaks
      if (y > 270) {
        doc.addPage();
        // Draw header repeating on next page
        doc.setFillColor(250, 248, 245);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(140, 98, 57);
        doc.text("PERFECT FIT BUREAU - TEXTILE STOCK LEDGER (Cont.)", 15, 15);

        doc.setDrawColor(140, 98, 57);
        doc.setLineWidth(1);
        doc.line(15, 25, 195, 25);

        y = 38;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        doc.text("Material Swatch Details", 15, y);
        doc.text("Category & Weight", 90, y);
        doc.text("Stock Level", 130, y);
        doc.text("Cost / Yd", 160, y);
        doc.text("Asset Value", 180, y);
        doc.setDrawColor(200, 195, 185);
        doc.setLineWidth(0.5);
        doc.line(15, y + 3, 195, y + 3);
        y += 12;
      }

      const supp = suppliers.find(s => s.id === item.supplierId) || suppliers[0];

      // Fabric Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(item.name || 'Unnamed Textile', 15, y);

      // Fabric specs (Color & Supplier)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 105, 100);
      doc.text(`Color: ${item.color || 'N/A'}  •  Supplier: ${supp?.name || 'Unknown'}`, 15, y + 4.5);

      // Fabric tags
      const currentTags = item.tags || ['Fabric'];
      doc.setTextColor(140, 98, 57);
      doc.setFont("helvetica", "bold");
      doc.text(`Tags: ${currentTags.map(t => '#' + t).join(' ')}`, 15, y + 8.5);

      // Category & Weight
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(60, 60, 60);
      doc.text(item.type || 'Fabric Roll', 90, y);
      doc.setTextColor(110, 105, 100);
      doc.setFontSize(7.5);
      doc.text(item.weight || '230 GSM', 90, y + 4.5);

      // Stock level with status indication
      doc.setFontSize(9);
      const isWarning = item.stock <= (item.threshold || 15);
      if (isWarning) {
        doc.setTextColor(210, 50, 50); // Red warn
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(45, 130, 75); // Green good
        doc.setFont("helvetica", "bold");
      }
      doc.text(`${item.stock} Yds`, 130, y);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(110, 105, 100);
      doc.text(item.status || 'In Stock', 130, y + 4);

      // Cost & Value
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`$${item.cost.toFixed(2)}`, 160, y);

      const currentVal = item.stock * item.cost;
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.text(`$${currentVal.toFixed(2)}`, 180, y);

      // Subtle bottom gridline
      doc.setDrawColor(242, 239, 235);
      doc.setLineWidth(0.5);
      doc.line(15, y + 11, 195, y + 11);

      y += 15;
    });

    // Footer decoration
    doc.setDrawColor(210, 205, 195);
    doc.setLineWidth(0.5);
    doc.line(15, 275, 195, 275);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 135, 130);
    doc.text("Perfect Fit Bureau ERP System • All stocks verified against local workstation ledger", 15, 281);
    doc.text("End of Textile Inventory Stock Report", 155, 281);

    doc.save("perfectfit_textile_inventory.pdf");

    if (window.showToast) {
      window.showToast("Successfully generated and downloaded premium fabric stock report PDF.", "success", "PDF Generated");
    }
  };

  const adjustStock = (id, delta) => {
    const updated = inventory.map(item => {
      if (item.id === id) {
        const nextStock = Math.max(0, parseFloat((item.stock + delta).toFixed(2)));
        let nextStatus = 'In Stock';
        if (nextStock === 0) {
          nextStatus = 'Out of Stock';
        } else if (nextStock <= item.threshold / 2) {
          nextStatus = 'Critically Low';
        } else if (nextStock <= item.threshold) {
          nextStatus = 'Low Stock';
        }
        return {
          ...item,
          stock: nextStock,
          status: nextStatus
        };
      }
      return item;
    });
    saveInventory(updated);
  };

  const handleDeleteItem = (id) => {
    const updated = inventory.filter(item => item.id !== id);
    saveInventory(updated);
  };

  // Add Supplier form
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supLeadTime, setSupLeadTime] = useState('5-7 Days');
  const [supSpecialty, setSupSpecialty] = useState('');

  const handleAddSupplier = (e) => {
    e.preventDefault();
    if (!supName.trim()) return;

    const newSup = {
      id: `sup-${Date.now()}`,
      name: supName,
      contact: supContact,
      email: supEmail,
      phone: supPhone,
      address: 'Main Office',
      leadTime: supLeadTime,
      specialty: supSpecialty || 'Raw materials'
    };

    const updated = [...suppliers, newSup];
    saveSuppliers(updated);
    setSupName('');
    setSupContact('');
    setSupEmail('');
    setSupPhone('');
    setSupSpecialty('');

    if (window.showToast) {
      window.showToast(`Supplier "${supName}" registered.`, 'success', 'Supplier Registered');
    }
  };

  // Restock action
  const triggerRestock = (item) => {
    const supplier = suppliers.find(s => s.id === item.supplierId) || suppliers[0];
    const qtyToOrder = Math.ceil(item.threshold * 2);
    const cost = qtyToOrder * item.cost;

    const newOrder = {
      id: `po-${Date.now()}`,
      materialName: item.name,
      supplierName: supplier?.name || 'Standard Mill',
      qty: qtyToOrder,
      totalCost: cost,
      status: 'Ordered',
      orderDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    const updatedOrders = [newOrder, ...supplyOrders];
    saveSupplyOrders(updatedOrders);

    // Adjust stock in anticipation or just mock log
    if (window.showToast) {
      window.showToast(`Restock order of ${qtyToOrder} yd created with ${newOrder.supplierName}`, 'success', 'PO Dispatched');
    }
    setMaterialsTab('orders');
  };

  const handleUpdateOrderStatus = (orderId, nextStatus) => {
    const updated = supplyOrders.map(o => {
      if (o.id === orderId) {
        // If received, we should add stock to inventory!
        if (nextStatus === 'Delivered') {
          const matchedItem = inventory.find(i => i.name === o.materialName);
          if (matchedItem) {
            adjustStock(matchedItem.id, o.qty);
          }
        }
        return { ...o, status: nextStatus };
      }
      return o;
    });
    saveSupplyOrders(updated);
  };


  // --- MEASUREMENT DUMMY & SIZER TOOL STATE ---
  const [sizerBust, setSizerBust] = useState(36.0);
  const [sizerWaist, setSizerWaist] = useState(28.0);
  const [sizerHips, setSizerHips] = useState(38.0);
  const [sizerUnit, setSizerUnit] = useState('in'); // 'in' | 'cm'

  // Yardage calculator nested state
  const [calcWidth, setCalcWidth] = useState('44'); // '44' | '60'
  const [calcGarmentType, setCalcGarmentType] = useState('Trench');

  const computedRecommendation = useMemo(() => {
    // Basic grading logic against MASTER_SIZING_TABLE
    const targetBust = sizerUnit === 'in' ? sizerBust : sizerBust / 2.54;
    const targetWaist = sizerUnit === 'in' ? sizerWaist : sizerWaist / 2.54;
    const targetHips = sizerUnit === 'in' ? sizerHips : sizerHips / 2.54;

    let bestSize = '8';
    let minDifference = Infinity;

    MASTER_SIZING_TABLE.forEach(row => {
      const diff = Math.abs(row.bust - targetBust) + Math.abs(row.waist - targetWaist) + Math.abs(row.hips - targetHips);
      if (diff < minDifference) {
        minDifference = diff;
        bestSize = row.size;
      }
    });

    return { size: bestSize, tableMatch: MASTER_SIZING_TABLE.find(r => r.size === bestSize) };
  }, [sizerBust, sizerWaist, sizerHips, sizerUnit]);

  const computedYardageNeeded = useMemo(() => {
    // Return approximate fabric yardage based on width and pattern
    const factor = calcWidth === '44' ? 1.3 : 1.0;
    let baseYardage = 2.5;

    if (calcGarmentType === 'Trench') baseYardage = 4.2;
    else if (calcGarmentType === 'Skirt') baseYardage = 2.0;
    else if (calcGarmentType === 'Smock') baseYardage = 3.0;
    else if (calcGarmentType === 'Blazer') baseYardage = 3.5;

    // Scale slightly with recommended size index
    const sizeIndex = MASTER_SIZING_TABLE.findIndex(r => r.size === computedRecommendation.size);
    const sizeScale = 1 + (sizeIndex !== -1 ? (sizeIndex - 4) * 0.05 : 0);

    return parseFloat((baseYardage * factor * sizeScale).toFixed(2));
  }, [calcWidth, calcGarmentType, computedRecommendation]);

  const applyRecommendedToProject = () => {
    if (!activeProject) return;
    const updated = projects.map(proj => {
      if (proj.id === activeProject.id) {
        // Add a task indicating fitting size has been synced
        const nextTasks = [...proj.tasks];
        if (!nextTasks.some(t => t.text.includes('Synced measurements'))) {
          nextTasks.push({ id: `t-sync-${Date.now()}`, text: `Synced measurements: Size ${computedRecommendation.size} fitted`, completed: true });
        }
        return { ...proj, tasks: nextTasks };
      }
      return proj;
    });
    saveProjects(updated);
    if (window.showToast) {
      window.showToast(`Calibrated ${activeProject.name} to Recommended Size ${computedRecommendation.size}`, 'success', 'Postural Sync Complete');
    }
  };


  return (
    <div className="bg-white border border-sand-200 rounded-2xl shadow-sm overflow-hidden text-left" id="consolidated-collaborator-workspace">

      {/* Workspace Hub Navigation */}
      <div className="bg-[#FAF8F5] border-b border-sand-200 px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-2 w-2 rounded-full bg-clay-605 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-clay-705">{pfUiT("ui.components.subcomponents.collaboratorworkspace.5e95241c1a")}</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-bark-450 bg-sand-100/80 border border-sand-200 px-2 py-0.5 rounded-lg select-none" title={pfUiT("ui.components.subcomponents.collaboratorworkspace.0b906b923d")}>
              <kbd className="font-sans bg-white px-1 py-0.5 rounded border border-sand-250 text-[10px] shadow-3xs font-semibold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.78c80cb669")}</kbd>+<kbd className="font-sans bg-white px-1 py-0.5 rounded border border-sand-250 text-[10px] shadow-3xs font-semibold">S</kbd>{pfUiT("ui.components.subcomponents.collaboratorworkspace.bc9f1d30f0")}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <h2 className="text-xl font-serif text-bark-950 font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#8c6239]" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.7257a1c687")}</h2>
            <button
              type="button"
              onClick={() => {
                setWalkthroughStep(0);
                setWalkthroughActive(true);
              }}
              className="bg-amber-50 hover:bg-amber-100/80 active:scale-95 text-amber-800 border border-amber-250 font-bold font-sans text-[11px] px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.7538bffea8")}</span>
            </button>
          </div>
          <p className="text-xs text-bark-500 max-w-xl">{pfUiT("ui.components.subcomponents.collaboratorworkspace.cb5e9e5448")}</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-sand-200/60 p-1 rounded-xl border border-sand-250/50 gap-1 overflow-x-auto self-stretch md:self-auto max-w-full">
          {[
  { id: 'projects', label: pfUiT('ui.collaborator.tabs.projects', {}, '📐 Projects & Checklist'), icon: FolderKanban },
  { id: 'products', label: pfUiT('ui.collaborator.tabs.products', {}, '🛍️ Product Submissions'), icon: ClipboardList },
  { id: 'techpacks', label: pfUiT('ui.collaborator.tabs.techpacks', {}, '🔒 Tech Packs & Secrets'), icon: Lock },
  { id: 'timer', label: pfUiT('ui.collaborator.tabs.timer', {}, '⏱️ Sewing Timer'), icon: Clock },
  { id: 'supply', label: pfUiT('ui.collaborator.tabs.supply', {}, '🧵 Supplies & Suppliers'), icon: ClipboardList },
  { id: 'measurements', label: pfUiT('ui.collaborator.tabs.measurements', {}, '📏 Sizers & Guides'), icon: Calculator }

          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-white text-clay-705 shadow-2xs border border-sand-150'
                  : 'text-bark-600 hover:text-bark-950 hover:bg-sand-100/50'
              }`}
              id={`tab-ctrl-${tab.id}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label.split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="p-6 md:p-8" id="workspace-viewport">
        <AnimatePresence mode="wait">

          {/* ==================== TAB 1: PROJECTS & LIFE CYCLE ==================== */}
          {activeTab === 'projects' && (
            <motion.div
              key="projects-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              id="projects-tab-viewport"
            >
              {/* Sidebar Left: Project List */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-sand-50/50 border border-sand-200/60 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold font-mono text-bark-800 uppercase tracking-wider">{pfUiT("ui.components.subcomponents.collaboratorworkspace.fa1fd3f35b")}</h3>

                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {projects.map(proj => (
                      <div
                        key={proj.id}
                        onClick={() => setSelectedProjectId(proj.id)}
                        className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all flex justify-between items-center ${
                          selectedProjectId === proj.id
                            ? 'bg-white border-clay-305 text-clay-950 shadow-sm'
                            : 'bg-[#FAF8F5] border-sand-200/70 hover:bg-white text-bark-800'
                        }`}
                      >
                        <div className="space-y-1.5 max-w-[80%]">
                          <h4 className="text-xs font-bold truncate text-bark-900">{proj.name}</h4>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono bg-sand-200 text-bark-700 px-1.5 py-0.5 rounded font-medium">
                              {proj.patternName}
                            </span>
                            <span className={`text-[8.5px] font-mono font-bold ${
                              proj.status === 'Completed' ? 'text-emerald-700' : 'text-clay-605'
                            }`}>
                              {proj.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            <div className="w-16 h-1 bg-sand-200 rounded-full overflow-hidden">
                              <div className="h-full bg-clay-605 rounded-full" style={{ width: `${proj.progress}%` }} />
                            </div>
                            <span className="text-[9px] font-mono text-bark-500">{proj.progress}%</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          className="p-1.5 hover:bg-red-50 text-bark-400 hover:text-red-600 rounded transition-colors cursor-pointer shrink-0"
                          title={pfUiT("ui.components.subcomponents.collaboratorworkspace.5a83cd326b")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Garment Form */}
                <form onSubmit={handleAddProject} className="bg-[#FAF8F5] border border-sand-200/60 rounded-xl p-5 space-y-4">
                  <span className="text-[9px] font-mono uppercase text-clay-700 font-bold block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.c9913019cf")}</span>
                  <div className="space-y-3 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.dbe46c9129")}</label>
                      <input
                        type="text"
                        placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.b5ab572a82")}
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.c3f94a3ebe")}</label>
                      <select
                        value={newProjPattern}
                        onChange={(e) => setNewProjPattern(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                      >
                        <option value="Trench">{pfUiT("ui.components.subcomponents.collaboratorworkspace.230d36f399")}</option>
                        <option value="Skirt">{pfUiT("ui.components.subcomponents.collaboratorworkspace.f9b2d08641")}</option>
                        <option value="Smock">{pfUiT("ui.components.subcomponents.collaboratorworkspace.dd25c66fbf")}</option>
                        <option value="Blazer">{pfUiT("ui.components.subcomponents.collaboratorworkspace.6618e23f33")}</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.59eb036660")}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Main Workspace Right: Drafting & Checklists */}
              <div className="lg:col-span-8">
                {activeProject ? (
                  <div className="bg-white border border-sand-200 rounded-xl p-6 md:p-8 space-y-6 h-full flex flex-col justify-between">
                    <div className="space-y-5">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-sand-150 pb-5">
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center gap-2 text-bark-500 font-mono text-[10px] uppercase">
                            <Calendar className="w-3.5 h-3.5 text-clay-505" />
                            <span>Started: {activeProject.startedDate}</span>
                          </div>
                          <h2 className="text-xl md:text-2xl font-serif text-bark-950 font-normal">{activeProject.name}</h2>
                          <p className="text-xs text-bark-600">{pfUiT("ui.components.subcomponents.collaboratorworkspace.5a45a6f86d")}<span className="font-mono bg-sand-100 px-2 py-0.5 rounded text-clay-707 font-bold text-[10px]">{activeProject.patternName}</span>
                          </p>
                        </div>

                        <span className={`px-2.5 py-1 text-[9.5px] font-mono uppercase font-bold rounded-full ${
                          activeProject.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          activeProject.status === 'In Progress' ? 'bg-clay-50 text-clay-700 border border-clay-200' :
                          'bg-sand-100 text-bark-600 border border-sand-200'
                        }`}>
                          {activeProject.status}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-2 p-4 bg-[#FAF8F5] rounded-lg border border-sand-150">
                        <div className="flex justify-between items-center text-xs">
                          <strong className="text-bark-800">{pfUiT("ui.components.subcomponents.collaboratorworkspace.eaad4d04b6")}</strong>
                          <span className="font-mono font-bold text-clay-700">{activeProject.progress}% Done</span>
                        </div>
                        <div className="w-full h-2 bg-sand-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#8c6239] to-clay-605 rounded-full transition-all duration-500"
                            style={{ width: `${activeProject.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Checklist */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-4 h-4 text-clay-500" />
                          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-bark-800">{pfUiT("ui.components.subcomponents.collaboratorworkspace.f98a9ddaa6")}</h3>
                        </div>

                        <div className="space-y-2">
                           {activeProject.tasks.map(task => (
                            <div
                              key={task.id}
                              onClick={() => toggleTask(activeProject.id, task.id)}
                              className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer select-none transition-all ${
                                task.completed
                                  ? 'bg-stone-50/40 border-sand-150 text-bark-400 line-through'
                                  : 'bg-white border-sand-200 hover:border-sand-300 text-[#2b1f13] hover:bg-sand-50/25 shadow-4xs'
                              }`}
                            >
                              <div className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-all duration-200 ${
                                task.completed
                                  ? 'bg-clay-605 border-clay-605 text-white shadow-sm'
                                  : 'bg-white border-sand-300 text-transparent hover:border-clay-505'
                              }`}>
                                <Check className="w-3 h-3 stroke-[3px]" />
                              </div>
                              <span className="text-xs font-sans leading-relaxed">{task.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-5 border-t border-sand-100 flex items-center gap-2 text-bark-500 text-[10.5px] font-sans italic">
                      <Sparkles className="w-4 h-4 text-[#8c6239] shrink-0" />
                      <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.f88ec3c920")}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FAF8F5] border border-dashed border-sand-300 rounded-xl p-12 text-center flex flex-col items-center justify-center h-full">
                    <ListTodo className="w-12 h-12 text-bark-300 mb-3" />
                    <p className="text-sm text-bark-500">{pfUiT("ui.components.subcomponents.collaboratorworkspace.3d280f112f")}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {/* ==================== TAB 2: PRODUCT SUBMISSIONS ==================== */}
          {activeTab === 'products' && (
            <motion.div
              key="products-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-left animate-fadeIn"
              id="product-submission-workspace"
            >
              <div className="bg-white border border-sand-200 rounded-2xl p-5 md:p-6 space-y-5 shadow-3xs">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-sand-150 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-clay-705 font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.8b46f59b10")}</span>
                    <h3 className="text-xl font-serif font-semibold text-bark-950">{pfUiT("ui.components.subcomponents.collaboratorworkspace.ef4fa976ea")}</h3>
                    <p className="text-xs text-bark-500 max-w-2xl leading-relaxed">{pfUiT("ui.components.subcomponents.collaboratorworkspace.9a5240c7d2")}</p>
                  </div>

                  <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold uppercase px-3 py-1 rounded-full">{pfUiT("ui.components.subcomponents.collaboratorworkspace.34c10311fe")}</span>
                </div>

                <form onSubmit={handleSubmitProductForReview} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.f9d2706fbf")}</label>
                    <input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.feb8e07c37")}
                      className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.1cf0a8ed56")}</label>
                    <select
                      value={designerBrand}
                      onChange={(e) => setDesignerBrand(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                    >
                      {DEFAULT_DESIGNER_BRANDS.map((brand) => (
                        <option key={brand.id} value={brand.label}>
                          {brand.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.f6565ea58b")}</label>
                    <select
                      value={audience}
                      onChange={(e) => handleAudienceChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                    >
                      {CATALOG_AUDIENCES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.ce986f4b70")}</label>
                    <select
                      value={mainCategory}
                      onChange={(e) => setMainCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                    >
                      {availableProductCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.e18e279afd")}</label>
                    <select
                      value={productDifficulty}
                      onChange={(e) => setProductDifficulty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                    >
                      <option value="Beginner">{pfUiT("ui.components.subcomponents.collaboratorworkspace.ddf6e7677f")}</option>
                      <option value="Intermediate">{pfUiT("ui.components.subcomponents.collaboratorworkspace.03b208b3b0")}</option>
                      <option value="Advanced">{pfUiT("ui.components.subcomponents.collaboratorworkspace.65fd7e3a8e")}</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.cc3dd8dd01")}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productPricePDF}
                        onChange={(e) => setProductPricePDF(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.5764970a69")}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productPricePrinted}
                        onChange={(e) => setProductPricePrinted(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.ea25f44467")}</label>
                    <textarea
                      value={newProductDescription}
                      onChange={(e) => setNewProductDescription(e.target.value)}
                      placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.15df123656")}
                      rows={3}
                      className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[9px] font-mono uppercase text-bark-500 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.82f7f95df9")}</label>

                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_COLLECTION_TAGS.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleCollectionTag(tag.id)}
                          className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer ${
                            selectedCollectionTags.includes(tag.id)
                              ? 'bg-clay-605 text-white border-clay-605 shadow-sm'
                              : 'bg-sand-50 text-bark-500 border-sand-200 hover:border-clay-400'
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-2 bg-[#FAF8F5] border border-sand-200 rounded-xl p-4 space-y-3">
                    <label className="flex items-center gap-2 text-xs text-bark-800 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequestingCategory}
                        onChange={(e) => setIsRequestingCategory(e.target.checked)}
                      />{pfUiT("ui.components.subcomponents.collaboratorworkspace.6afbcff7ca")}</label>

                    {isRequestingCategory && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <input
                          type="text"
                          value={requestedCategoryName}
                          onChange={(e) => setRequestedCategoryName(e.target.value)}
                          placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.8c74ebd60f")}
                          className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs"
                        />

                        <input
                          type="text"
                          value={requestedCategoryReason}
                          onChange={(e) => setRequestedCategoryReason(e.target.value)}
                          placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.667f9cde13")}
                          className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="md:col-span-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.7a90a5179b")}</span>
                  </button>
                </form>
              </div>

              <div className="bg-[#FAF8F5] border border-sand-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-serif font-bold text-bark-950">{pfUiT("ui.components.subcomponents.collaboratorworkspace.000e877b39")}</h4>
                    <p className="text-[11px] text-bark-500">{pfUiT("ui.components.subcomponents.collaboratorworkspace.c6e0d30b6f")}</p>
                  </div>

                  <span className="text-[10px] font-mono bg-white border border-sand-200 text-bark-600 px-2.5 py-1 rounded-full">
                    {productSubmissions.length} submission(s)
                  </span>
                </div>

                {productSubmissions.length === 0 ? (
                  <div className="border border-dashed border-sand-300 rounded-xl p-6 text-center text-xs text-bark-500">{pfUiT("ui.components.subcomponents.collaboratorworkspace.f5b3b32113")}</div>
                ) : (
                  <div className="space-y-3">
                    {productSubmissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="bg-white border border-sand-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm font-serif text-bark-950">
                              {submission.name}
                            </strong>

                            <span className="text-[9px] font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                              {submission.status}
                            </span>
                          </div>

                          <p className="text-[10px] text-bark-500 font-mono">
                            {submission.designerBrand} • {submission.audience} / {submission.mainCategory} • {submission.difficulty}
                          </p>

                          {submission.categoryRequest && (
                            <p className="text-[10px] text-clay-700 font-mono">
                              Requested category: {submission.categoryRequest.requestedCategoryName}
                            </p>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-bark-400">
                          PDF ${submission.pricePDF.toFixed(2)} / Printed ${submission.pricePrinted.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {/* ==================== TAB 2: TECH PACKS & DEVELOPMENT SECRETS ==================== */}
          {activeTab === 'techpacks' && (
            <motion.div
              key="techpacks-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-left animate-fadeIn"
              id="techpacks-tab-viewport"
            >
              {/* Pattern Selector & Token Share Header */}
              <div className="bg-stone-900 text-white p-5 md:p-6 rounded-2xl shadow-md border border-stone-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-clay-605/30 border border-clay-500/40 text-clay-200 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-3 h-3 text-clay-400" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.9934b10718")}</span>
                    <span className="text-stone-400 text-xs font-mono">{pfUiT("ui.components.subcomponents.collaboratorworkspace.fa9e69b7ee")}</span>
                  </div>
                  <h3 className="text-xl font-serif text-amber-50">Technical Specs &amp; Development Secrets</h3>
                  <p className="text-xs text-stone-300 leading-relaxed">{pfUiT("ui.components.subcomponents.collaboratorworkspace.cd82ed35f6")}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                  {/* Pattern Picker */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-stone-400 uppercase block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.b2b5d4aa68")}</label>
                    <select
                      value={selectedTechPackPatternId}
                      onChange={(e) => setSelectedTechPackPatternId(e.target.value)}
                      className="bg-stone-800 text-amber-100 border border-stone-700 px-3 py-2 rounded-xl text-xs font-sans focus:outline-none focus:border-clay-500 cursor-pointer"
                    >
                      {catalogProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category || 'Pattern'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* One-Time Token Share Button */}
                  <div className="space-y-1 self-end">
                    <button
                      type="button"
                      onClick={handleGenerateTokenLink}
                      className="bg-gradient-to-r from-clay-605 to-clay-705 hover:from-clay-705 hover:to-clay-805 text-white text-xs font-bold font-sans px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-clay-500/50"
                    >
                      <Key className="w-4 h-4 text-amber-200 animate-pulse" />
                      <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.27b131695c")}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-navigation bar inside Tech Packs */}
              <div className="flex border-b border-sand-200 gap-4 overflow-x-auto pb-1" id="techpack-navbar">
                {[
                  { id: 'specs', label: pfUiT('ui.collaborator.techpackTabs.specs', {}, '✂️ Atelier Construction Specs'), icon: Scissors },
                  { id: 'flats', label: pfUiT('ui.collaborator.techpackTabs.flats', {}, '🎨 Swatch Studio & Technical Drawings'), icon: Layers },
                  { id: 'industrial', label: pfUiT('ui.collaborator.techpackTabs.industrial', {}, '🏭 Industrial Tech Pack & BOM'), icon: Building2 },
                  { id: 'secrets', label: pfUiT('ui.collaborator.techpackTabs.secrets', {}, '🔒 Development Secrets & Journal'), icon: Lock }
                ].map(subTab => (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => setTechPackSubTab(subTab.id)}
                    className={`pb-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                      techPackSubTab === subTab.id
                        ? 'border-clay-605 text-clay-705'
                        : 'border-transparent text-bark-450 hover:text-bark-800'
                    }`}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: Atelier Construction Specs */}
              {techPackSubTab === 'specs' && (
                <div className="bg-white border border-sand-200 rounded-2xl p-6 space-y-6 shadow-3xs animate-fadeIn">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sand-150 pb-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-clay-700 font-bold bg-clay-50 px-2 py-0.5 rounded">
                        {selectedTechPackPattern.category} • {selectedTechPackPattern.difficulty}
                      </span>
                      <h4 className="text-xl font-serif text-bark-950 font-normal mt-1">{selectedTechPackPattern.name}</h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold text-bark-800">
                        Retail ${selectedTechPackPattern.price}
                      </span>
                      {selectedTechPackPattern.pdfInstructionsUrl && (
                        <a
                          href={selectedTechPackPattern.pdfInstructionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-sand-100 hover:bg-sand-200 text-bark-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border border-sand-250"
                        >
                          <Download className="w-3.5 h-3.5 text-clay-605" />
                          <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.3e9082bdde")}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <h5 className="text-xs font-mono uppercase font-bold text-bark-700 tracking-wider">Garment Description &amp; Technical Scope</h5>
                      <p className="text-sm text-bark-800 leading-relaxed font-sans bg-[#FAF8F5] p-4 rounded-xl border border-sand-200/80">
                        {selectedTechPackPattern.description || 'Precision engineered sartorial drafting pattern. Includes complete seam line baseline mapping, grainline indicators, and seam allowances.'}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="p-4 bg-sand-50/60 rounded-xl border border-sand-200 space-y-2">
                          <h6 className="text-[11px] font-mono uppercase font-bold text-clay-705 flex items-center gap-1.5">
                            <Scissors className="w-3.5 h-3.5" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.5e882283f9")}</h6>
                          <ul className="text-xs text-bark-700 space-y-1 list-disc list-inside">
                            {(selectedTechPackPattern.fabricSuggestions || ['European Linen', 'Cotton Twill', 'Wool Crepe']).map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 bg-sand-50/60 rounded-xl border border-sand-200 space-y-2">
                          <h6 className="text-[11px] font-mono uppercase font-bold text-clay-705 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.c78b8d458e")}</h6>
                          <p className="text-xs text-bark-700 font-mono">
                            • Major Seams: 5/8" (1.5 cm)<br />
                            • Enclosed Collar &amp; Facings: 3/8" (1.0 cm)<br />
                            • Lower Hem Allowance: 1.5" (3.8 cm)
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 bg-stone-900 text-stone-200 p-5 rounded-xl border border-stone-800">
                      <h5 className="text-xs font-mono uppercase font-bold text-amber-200 tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-clay-400" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.9fd56aec28")}</h5>
                      <p className="text-xs text-stone-300 leading-relaxed">{pfUiT("ui.components.subcomponents.collaboratorworkspace.8b908fe56c")}</p>
                      <div className="pt-2 border-t border-stone-800 space-y-2 text-[11px] font-mono text-stone-400">
                        <div className="flex justify-between">
                          <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.9f276170be")}</span>
                          <span className="text-emerald-400 font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.b2078d091c")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.8b9e10b396")}</span>
                          <span className="text-amber-300 font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.18ffa6076d")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.aa63c9e087")}</span>
                          <span className="text-stone-300">Sizes 0 - 24 (EU 32-52)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Swatch Studio, Multi-Media Photos & Technical Drawings */}
              {techPackSubTab === 'flats' && (
                <div className="animate-fadeIn">
                  <ProductDevelopmentMediaGallery pattern={selectedTechPackPattern} />
                </div>
              )}

              {/* Sub-tab 3: Industrial Tech Pack Component */}
              {techPackSubTab === 'industrial' && (
                <div className="animate-fadeIn">
                  <IndustrialTechPack pattern={selectedTechPackPattern} />
                </div>
              )}

              {/* Sub-tab 4: Development Secrets & Journal */}
              {techPackSubTab === 'secrets' && (
                <div className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl p-6 md:p-8 space-y-6 shadow-md animate-fadeIn">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400" />
                        <h4 className="text-lg font-serif text-amber-50">{pfUiT("ui.components.subcomponents.collaboratorworkspace.700e129fd7")}</h4>
                      </div>
                      <p className="text-xs text-stone-400 font-sans">{pfUiT("ui.components.subcomponents.collaboratorworkspace.6a0df7fced")}<strong className="text-amber-200">{selectedTechPackPattern.name}</strong>.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveSecretNote(selectedTechPackPatternId, secretNotesMap[selectedTechPackPatternId] || '')}
                      className="bg-clay-605 hover:bg-clay-705 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.6d93a195c4")}</span>
                    </button>
                  </div>

                  <div className="space-y-3 text-left">
                    <label className="text-xs font-mono uppercase font-bold text-amber-300 block">
                      Confidential Notes &amp; Alteration Secrets
                    </label>
                    <textarea
                      rows={10}
                      value={secretNotesMap[selectedTechPackPatternId] || ''}
                      onChange={(e) => setSecretNotesMap({ ...secretNotesMap, [selectedTechPackPatternId]: e.target.value })}
                      placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.8a39fd2007")}
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-xs font-mono text-amber-100 leading-relaxed focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                  </div>

                  <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.e90e2308f7")}</span>
                    <span className="text-[10px] text-stone-500">{pfUiT("ui.components.subcomponents.collaboratorworkspace.89776e3cb4")}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== TAB 3: SEWING TIMER & PRODUCTIVITY ==================== */}
          {activeTab === 'timer' && (
            <motion.div
              key="timer-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="animate-fadeIn"
              id="timer-tab-viewport"
            >
              <SewingSessionTimer patterns={catalogProducts} forceViewMode={sewingTimerForceViewMode} />
            </motion.div>
          )}

          {/* ==================== TAB 3: MATERIAL & SUPPLY CHAIN ==================== */}
          {activeTab === 'supply' && (
            <motion.div
              key="supply-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-left animate-fadeIn"
              id="supply-tab-viewport"
            >
              {/* Secondary Navigation bar inside Supply section */}
              <div className="flex border-b border-sand-150 gap-4" id="supply-navbar">
                {[
                  { id: 'inventory', label: pfUiT('ui.collaborator.supplyTabs.inventory', {}, '🧵 Materials Inventory'), icon: Layers },
                  { id: 'suppliers', label: pfUiT('ui.collaborator.supplyTabs.suppliers', {}, '🤝 B2B Supplier Directory'), icon: UserCheck },
                  { id: 'orders', label: pfUiT('ui.collaborator.supplyTabs.orders', {}, '📦 Restock Pipeline'), icon: Package }
                ].map(subTab => (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => setMaterialsTab(subTab.id)}
                    className={`pb-2.5 text-xs font-mono uppercase font-bold tracking-wider transition-all border-b-2 cursor-pointer ${
                      materialsTab === subTab.id
                        ? 'border-clay-605 text-clay-705'
                        : 'border-transparent text-bark-450 hover:text-bark-800'
                    }`}
                  >
                    {subTab.label}
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: Inventory */}
              {materialsTab === 'inventory' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Export Header */}
                  <div className="flex justify-between items-center bg-[#FAF8F5] border border-sand-200/60 p-3 rounded-xl flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-clay-605" />
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-clay-755">{pfUiT("ui.components.subcomponents.collaboratorworkspace.374a299a68")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={exportToPdf}
                      className="bg-clay-605 hover:bg-clay-705 active:scale-95 text-white font-sans text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-2xs"
                      title={pfUiT("ui.components.subcomponents.collaboratorworkspace.9060a5adec")}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.ae43418e4f")}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="inventory-subpanel">

                  {/* Inventory Grid Left */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5" id="inventory-metrics-cards">
                      <div className="bg-sand-50/50 border border-sand-200/70 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-clay-50 text-clay-700 rounded-lg flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.b4d5b05529")}</span>
                          <strong className="text-sm font-serif text-bark-900">{inventory.length} Active Swatches</strong>
                        </div>
                      </div>

                      <div className="bg-sand-50/50 border border-sand-200/70 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-rose-50 text-rose-700 rounded-lg flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.28065f7e64")}</span>
                          <strong className="text-sm font-serif text-bark-900">
                              {inventory.filter(i => i.stock <= i.threshold).length} {pfUiT("ui.components.subcomponents.collaboratorworkspace.lowStock")}
                          </strong>
                        </div>
                      </div>

                      <div className="bg-sand-50/50 border border-sand-200/70 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                          <Scale className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.6c2789a300")}</span>
                          <strong className="text-sm font-serif text-bark-900">
                            {inventory.reduce((sum, item) => sum + item.stock, 0).toFixed(1)} Yds
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Stock Table */}
                    <div className="bg-white rounded-xl border border-sand-200 overflow-hidden shadow-3xs" id="inventory-ledger-table">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-[#FAF8F5] border-b border-sand-200 text-[9px] font-mono uppercase text-bark-500 text-left">
                              <th className="p-3 pl-4">{pfUiT("ui.components.subcomponents.collaboratorworkspace.1becff2a1f")}</th>
                              <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.406cbd2ed6")}</th>
                              <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.471674b07d")}</th>
                              <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.5ef58e1903")}</th>
                              <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.52830cc330")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-sand-100 text-xs">
                            {inventory.map(item => {
                              const supp = suppliers.find(s => s.id === item.supplierId) || suppliers[0];
                              const isLow = item.stock <= item.threshold;
                              return (
                                <tr key={item.id} className="hover:bg-sand-50/30 transition-colors">
                                  <td className="p-3 pl-4 space-y-1.5">
                                    <div>
                                      <strong className="font-sans font-bold text-bark-900 block">{item.name}</strong>
                                      <span className="text-[10px] text-bark-500 font-mono">Color: {item.color} • Supplier: {supp?.name}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(item.tags || []).map((tag, tIdx) => (
                                        <span
                                          key={tIdx}
                                          className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-medium text-clay-705 bg-clay-50/80 border border-clay-150 px-1.5 py-0.5 rounded-md shadow-4xs"
                                        >
                                          <Tag className="w-2 h-2 text-clay-505 shrink-0" />
                                          <span>{tag}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="p-3 space-y-0.5">
                                    <span className="text-[9.5px] bg-sand-100 px-1.5 py-0.5 rounded font-mono font-medium">{item.type}</span>
                                    <span className="text-[9px] text-bark-450 block">{item.weight}</span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <strong className={`font-mono text-xs ${isLow ? 'text-rose-600' : 'text-bark-900'}`}>{item.stock} Yd</strong>
                                      <div className="flex flex-col gap-0.5">
                                        <button
                                          onClick={() => adjustStock(item.id, 5)}
                                          className="text-[8px] bg-sand-100 hover:bg-sand-200 font-mono font-bold px-1 rounded cursor-pointer"
                                          title={pfUiT("ui.components.subcomponents.collaboratorworkspace.e60a96bf5a")}
                                        >
                                          +5
                                        </button>
                                        <button
                                          onClick={() => adjustStock(item.id, -5)}
                                          className="text-[8px] bg-sand-100 hover:bg-sand-200 font-mono font-bold px-1 rounded cursor-pointer"
                                          title={pfUiT("ui.components.subcomponents.collaboratorworkspace.7b008f9644")}
                                        >
                                          -5
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-bark-750">${item.cost.toFixed(2)}/yd</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-1.5">
                                      {isLow && (
                                        <button
                                          type="button"
                                          onClick={() => triggerRestock(item)}
                                          className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[9px] font-bold px-2 py-1 rounded border border-rose-200 cursor-pointer"
                                        >
                                          <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                                          <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.173e3abaac")}</span>
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1 text-bark-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Add Swatch Right Sidebar */}
                  <div className="lg:col-span-4">
                    <form id="receiving-dock-sidebar" onSubmit={handleAddMaterial} className="bg-[#FAF8F5] border border-sand-200 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2">
                        <PlusCircle className="w-4 h-4 text-clay-605" />
                        <h4 className="text-xs font-bold font-mono text-bark-800 uppercase tracking-wider">{pfUiT("ui.components.subcomponents.collaboratorworkspace.e21ee5a25b")}</h4>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.a62e61e019")}</label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.903c58326c")}
                            value={newMatName}
                            onChange={(e) => setNewMatName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.1fd150cae5")}</label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.b6cf529333")}
                            value={newMatColor}
                            onChange={(e) => setNewMatColor(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-bark-500 block">Stock (Yd)</label>
                            <input
                              type="number"
                              min="1"
                              value={newMatStock}
                              onChange={(e) => setNewMatStock(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs font-mono"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-bark-500 block">Cost ($/Yd)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              value={newMatCost}
                              onChange={(e) => setNewMatCost(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs font-mono"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.6a5c2a0d8f")}</label>
                          <select
                            value={newMatType}
                            onChange={(e) => setNewMatType(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                          >
                            <option value="Fabric Roll">{pfUiT("ui.components.subcomponents.collaboratorworkspace.403ad22ebf")}</option>
                            <option value="Premium Lining">{pfUiT("ui.components.subcomponents.collaboratorworkspace.9c18ad10a8")}</option>
                            <option value="Heavy Wool Crepe">{pfUiT("ui.components.subcomponents.collaboratorworkspace.5360bf92f9")}</option>
                            <option value="Interfacing Mesh">{pfUiT("ui.components.subcomponents.collaboratorworkspace.8beb392233")}</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.e778b602e2")}</label>
                          <select
                            value={newMatSupplierId}
                            onChange={(e) => setNewMatSupplierId(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                          >
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.6469fcca55")}</label>
                            <span className="text-[8px] font-mono text-bark-400">{pfUiT("ui.components.subcomponents.collaboratorworkspace.434b8ca738")}</span>
                          </div>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.5188b6de36")}
                            value={newMatTags}
                            onChange={(e) => setNewMatTags(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                        >{pfUiT("ui.components.subcomponents.collaboratorworkspace.86a200ef3d")}</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              )}

              {/* Sub-tab 2: Suppliers Directory */}
              {materialsTab === 'suppliers' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="suppliers-subpanel">

                  {/* Left: Supplier Card Grid */}
                  <div className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {suppliers.map(sup => (
                        <div key={sup.id} className="bg-white border border-sand-200 p-5 rounded-2xl shadow-3xs space-y-4 text-left">
                          <div className="space-y-1">
                            <span className="text-[8px] font-mono uppercase bg-clay-50 border border-clay-100 text-clay-700 px-2 py-0.5 rounded inline-block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.107c3ae6d4")}</span>
                            <h4 className="font-serif font-bold text-base text-bark-900">{sup.name}</h4>
                            <p className="text-xs text-bark-500">{sup.specialty}</p>
                          </div>

                          <div className="space-y-2 border-t border-sand-100 pt-3.5 text-xs text-bark-750">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-clay-505" />
                              <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.b3b4af4bdb")}<strong>{sup.contact}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-clay-505" />
                              <span className="truncate">{sup.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-clay-505" />
                              <span>{sup.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-clay-505" />
                              <span>{sup.address}</span>
                            </div>
                          </div>

                          <div className="bg-sand-50/50 p-2.5 rounded border border-sand-150 flex justify-between items-center text-[11px]">
                            <span className="font-mono text-bark-500">{pfUiT("ui.components.subcomponents.collaboratorworkspace.12bac35153")}</span>
                            <strong className="font-mono text-clay-700">{sup.leadTime}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Register Supplier */}
                  <div className="lg:col-span-4">
                    <form onSubmit={handleAddSupplier} className="bg-[#FAF8F5] border border-sand-200 p-5 rounded-2xl space-y-4">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-clay-605" />
                        <h4 className="text-xs font-bold font-mono text-bark-800 uppercase tracking-wider">{pfUiT("ui.components.subcomponents.collaboratorworkspace.3ea1583de7")}</h4>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.d2db0c9de9")}</label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.d21564e798")}
                            value={supName}
                            onChange={(e) => setSupName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.3c3fb458e4")}</label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.39ec702647")}
                            value={supContact}
                            onChange={(e) => setSupContact(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.4d8d6e3e23")}</label>
                          <input
                            type="email"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.f0eea2958c")}
                            value={supEmail}
                            onChange={(e) => setSupEmail(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.787fc44c83")}</label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.787a755f23")}
                            value={supPhone}
                            onChange={(e) => setSupPhone(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">{pfUiT("ui.components.subcomponents.collaboratorworkspace.4c84e03d80")}</label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.subcomponents.collaboratorworkspace.5f21463429")}
                            value={supSpecialty}
                            onChange={(e) => setSupSpecialty(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                        >{pfUiT("ui.components.subcomponents.collaboratorworkspace.3c7adf5fa1")}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Supply Order Pipeline */}
              {materialsTab === 'orders' && (
                <div className="bg-white border border-sand-200 rounded-xl overflow-hidden shadow-3xs animate-fadeIn" id="orders-subpanel">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] border-b border-sand-200 text-[9px] font-mono uppercase text-bark-500 text-left">
                          <th className="p-3 pl-4">{pfUiT("ui.components.subcomponents.collaboratorworkspace.76d19c01dd")}</th>
                          <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.7820400c89")}</th>
                          <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.dc05a3123a")}</th>
                          <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.cabcfe7c4e")}</th>
                          <th className="p-3">{pfUiT("ui.components.subcomponents.collaboratorworkspace.af114edf33")}</th>
                          <th className="p-3 text-right pr-4">{pfUiT("ui.components.subcomponents.collaboratorworkspace.a6099d55ef")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sand-100 text-xs text-left">
                        {supplyOrders.map(o => (
                          <tr key={o.id} className="hover:bg-sand-50/20 transition-colors">
                            <td className="p-3 pl-4 font-mono">
                              <span className="text-[10px] text-bark-500 block">{o.orderDate}</span>
                              <strong className="text-stone-900 font-semibold uppercase">{o.id}</strong>
                            </td>
                            <td className="p-3">
                              <strong className="text-bark-900 block">{o.materialName}</strong>
                            </td>
                            <td className="p-3 text-bark-700">{o.supplierName}</td>
                            <td className="p-3 font-mono space-y-0.5">
                              <span className="block text-xs font-bold text-bark-900">{o.qty} Yards</span>
                              <span className="text-[10px] text-bark-450">${o.totalCost.toFixed(2)}</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                o.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                o.status === 'In Transit' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {o.status}
                              </span>
                            </td>
                            <td className="p-3 text-right pr-4">
                              {o.status !== 'Delivered' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(o.id, 'Delivered')}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] px-2.5 py-1 rounded font-bold border border-emerald-200 cursor-pointer"
                                >{pfUiT("ui.components.subcomponents.collaboratorworkspace.9c8ea2d9da")}</button>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center justify-end gap-1 font-mono">
                                  <Check className="w-3.5 h-3.5" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.adb990155d")}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ==================== TAB 4: SIZERS & CALIBRATORS ==================== */}
          {activeTab === 'measurements' && (
            <motion.div
              key="measurements-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="animate-fadeIn"
              id="measurements-tab-viewport"
            >
              <MannequinGuide
                activeRecommendedSize={workspaceRecommendedSize}
                onRecommendedSizeChange={setWorkspaceRecommendedSize}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Interactive Onboarding Walkthrough Tour */}
      <AnimatePresence>
        {walkthroughActive && (
          <OnboardingWalkthrough
            step={walkthroughStep}
            setStep={setWalkthroughStep}
            onClose={() => setWalkthroughActive(false)}
            setActiveTab={setActiveTab}
            setMaterialsTab={setMaterialsTab}
            setSewingTimerForceViewMode={setSewingTimerForceViewMode}
          />
        )}
      </AnimatePresence>

      {/* One-Time Access Token Generator Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <div
            className="fixed inset-0 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4"
            style={{ zIndex: UI_LAYERS.criticalDialog }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-left relative overflow-hidden"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="absolute top-4 right-4 text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-2 pr-6">
                <div className="flex items-center gap-2 text-amber-300 font-mono text-[10px] uppercase font-bold tracking-wider">
                  <Key className="w-4 h-4 text-amber-400" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.a05f13b31f")}</div>
                <h3 className="text-xl font-serif text-amber-50">{pfUiT("ui.components.subcomponents.collaboratorworkspace.8e30fa6ab8")}</h3>
                <p className="text-xs text-stone-300 leading-relaxed font-sans">{pfUiT("ui.components.subcomponents.collaboratorworkspace.8ffcb37f77")}<strong className="text-amber-200">{selectedTechPackPattern.name}</strong>{pfUiT("ui.components.subcomponents.collaboratorworkspace.291bfcd8bb")}</p>
              </div>

              {/* URL Input Box */}
              <div className="space-y-2 bg-stone-950 p-3 rounded-xl border border-stone-800">
                <label className="text-[9px] font-mono uppercase text-stone-400 block font-bold">{pfUiT("ui.components.subcomponents.collaboratorworkspace.185d131f95")}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tokenGenerated}
                    className="w-full bg-stone-900 text-amber-100 font-mono text-xs px-3 py-2 rounded-lg border border-stone-700/80 focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tokenGenerated);
                      setTokenCopied(true);
                      if (window.showToast) {
                        window.showToast("One-time token link copied to clipboard!", "success", "Token Grant Copied");
                      }
                      setTimeout(() => setTokenCopied(false), 3000);
                    }}
                    className={`px-3.5 py-2 text-xs font-bold font-sans rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      tokenCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-clay-605 hover:bg-clay-705 text-white active:scale-95'
                    }`}
                  >
                    {tokenCopied ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.a9dc64ab64")}</>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />{pfUiT("ui.components.subcomponents.collaboratorworkspace.ca2c482c7c")}</>
                    )}
                  </button>
                </div>
              </div>

              {/* Permissions & Security Flags */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-stone-300">
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.933ecb581d")}</span>
                </div>
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.d303101fad")}</span>
                </div>
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-clay-400 shrink-0" />
                  <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.a4c80cb449")}</span>
                </div>
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.22c22d6443")}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                >{pfUiT("ui.components.subcomponents.collaboratorworkspace.37b7db0fbd")}</button>
                <a
                  href={tokenGenerated}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-stone-800 hover:bg-stone-700 text-amber-100 text-xs font-bold px-4 py-2 rounded-xl border border-stone-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{pfUiT("ui.components.subcomponents.collaboratorworkspace.ddaf1f7ba6")}</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
