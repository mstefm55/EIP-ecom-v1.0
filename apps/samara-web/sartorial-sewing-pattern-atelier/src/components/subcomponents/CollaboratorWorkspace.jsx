import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { MASTER_SIZING_TABLE, SEWING_PATTERNS } from '../../data.js';
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

const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Bespoke Tweed Coat',
    patternName: 'Trench',
    status: 'In Progress',
    progress: 60,
    startedDate: 'Jul 2, 2026',
    tasks: [
      { id: 't1', text: 'Calibrate custom dummy posture and height', completed: true },
      { id: 't2', text: 'Iron and steam organic wool warp fibers', completed: true },
      { id: 't3', text: 'Trace chalk cutting patterns on muslin shell', completed: true },
      { id: 't4', text: 'Construct interlining hair canvas stitch layers', completed: false },
      { id: 't5', text: 'Hand-sew wind flaps and collar back bias', completed: false }
    ]
  },
  {
    id: 'proj-2',
    name: 'Summer Wrap Skirt',
    patternName: 'Skirt',
    status: 'Completed',
    progress: 100,
    startedDate: 'Jul 9, 2026',
    tasks: [
      { id: 't2-1', text: 'Measure linen roll width alignment', completed: true },
      { id: 't2-2', text: 'Map pattern nodes for absolute zero cut-off', completed: true },
      { id: 't2-3', text: 'Double needle lock stitch side belts', completed: true }
    ]
  }
];

const INITIAL_INVENTORY = [
  {
    id: 'inv-1',
    name: 'French Flax Organic Linen',
    type: 'Fabric Roll',
    color: 'Oatmeal Natural',
    stock: 45.5,
    threshold: 15.0,
    cost: 16.50,
    status: 'In Stock',
    weight: '240 GSM',
    supplierId: 'sup-1',
    tags: ['Organic', 'Linen', 'Sustainable', 'Breathable']
  },
  {
    id: 'inv-2',
    name: 'Ivory Mulberry Silk Satin',
    type: 'Premium Lining',
    color: 'Soft Pearl',
    stock: 12.0,
    threshold: 15.0,
    cost: 32.00,
    status: 'Low Stock',
    weight: '80 GSM',
    supplierId: 'sup-2',
    tags: ['Luxury', 'Silk', 'Lining', 'Drape']
  },
  {
    id: 'inv-3',
    name: 'Belgian Organic Cotton Denim',
    type: 'Fabric Roll',
    color: 'Indigo Indigo',
    stock: 28.0,
    threshold: 10.0,
    cost: 14.80,
    status: 'In Stock',
    weight: '310 GSM',
    supplierId: 'sup-3',
    tags: ['Denim', 'Heavyweight', 'Indigo', 'Cotton']
  },
  {
    id: 'inv-4',
    name: 'British Fine Merino Tweed',
    type: 'Heavy Wool Crepe',
    color: 'Forest Herringbone',
    stock: 5.5,
    threshold: 10.0,
    cost: 29.50,
    status: 'Critically Low',
    weight: '380 GSM',
    supplierId: 'sup-4',
    tags: ['Wool', 'Tweed', 'Herringbone', 'Warm']
  }
];

const INITIAL_SUPPLIERS = [
  {
    id: 'sup-1',
    name: 'Maison de Lin (French Flax Co)',
    contact: 'Jean-Luc Picard',
    email: 'contact@maisondelin.fr',
    phone: '+33 4 90 12 34 56',
    address: 'Lille, France',
    leadTime: '5-7 Days',
    specialty: 'Certified Organic Belgian & French Flax'
  },
  {
    id: 'sup-2',
    name: 'Lyon Silk Weavers Ltd',
    contact: 'Amélie Laurent',
    email: 'info@lyonsilk.com',
    phone: '+33 4 72 00 99 88',
    address: 'Lyon, France',
    leadTime: '10-12 Days',
    specialty: 'High-Momme Mulberry Silk & Satin linings'
  },
  {
    id: 'sup-3',
    name: 'Belgian Denim Masters',
    contact: 'Dirk van Saene',
    email: 'sales@belgiandenim.be',
    phone: '+32 3 201 45 67',
    address: 'Antwerp, Belgium',
    leadTime: '3-5 Days',
    specialty: 'Heavyweight shuttle loom raw denim'
  },
  {
    id: 'sup-4',
    name: 'Merino & Tweed Heritage Mills',
    contact: 'Alistair Campbell',
    email: 'orders@heritagetweed.co.uk',
    phone: '+44 1851 700123',
    address: 'Isle of Harris, Scotland',
    leadTime: '14 Days',
    specialty: 'Handwoven Harris Tweed & Fine Merino Wool'
  }
];

export default function CollaboratorWorkspace() {
  const [activeTab, setActiveTab] = useState('projects'); // 'projects' | 'timer' | 'supply' | 'measurements' | 'techpacks'
  const [workspaceRecommendedSize, setWorkspaceRecommendedSize] = useState('8');

  // --- TECH PACKS & COLLABORATOR SECRETS STATE ---
  const [selectedTechPackPatternId, setSelectedTechPackPatternId] = useState(() => SEWING_PATTERNS[0]?.id || 'sartorial-01');
  const [techPackSubTab, setTechPackSubTab] = useState('specs'); // 'specs' | 'flats' | 'industrial' | 'secrets'
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenGenerated, setTokenGenerated] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);

  const [secretNotesMap, setSecretNotesMap] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_collaborator_secrets');
      return saved ? JSON.parse(saved) : {
        'sartorial-01': '• Seam Allowance Secret: Cut front waist ties with 1/2" extra length for adjustable knot tension.\n• Pattern Alteration: Grade bust dart by -2mm when constructing in heavy linen.\n• Secret Stitch Technique: Use 70/10 Microtex needle for French seam edge finishing.',
        'sartorial-02': '• Interfacing Secret: Fuse 2.5cm horsehair interlining in lapel collar to maintain crisp rolled lapel fold.\n• Trench Sleeve Notch: Shift armhole pitch notch forward by 3mm for better mobility.',
        'sartorial-03': '• Trouser Drape Secret: Add lightweight stay tape along biased front pocket opening to prevent sagging.\n• Hem Secret: Blind-stitch lower hem using silk thread to eliminate exterior stitches.',
        'sartorial-04': '• Sari Silk Secret: Stabilize neck curve with narrow tissue paper during lockstitching to avoid stretching.'
      };
    } catch {
      return {};
    }
  });

  const selectedTechPackPattern = useMemo(() => {
    return SEWING_PATTERNS.find(p => p.id === selectedTechPackPatternId) || SEWING_PATTERNS[0];
  }, [selectedTechPackPatternId]);

  const handleSaveSecretNote = (patternId, text) => {
    const updated = { ...secretNotesMap, [patternId]: text };
    setSecretNotesMap(updated);
    try {
      localStorage.setItem('sartorial_collaborator_secrets', JSON.stringify(updated));
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
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_atelier_projects');
      return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
    } catch {
      return INITIAL_PROJECTS;
    }
  });
  const [newProjName, setNewProjName] = useState('');
  const [newProjPattern, setNewProjPattern] = useState('Trench');
  const [selectedProjectId, setSelectedProjectId] = useState('proj-1');

  const saveProjects = (updated) => {
    setProjects(updated);
    try {
      localStorage.setItem('sartorial_atelier_projects', JSON.stringify(updated));
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
      const saved = localStorage.getItem('sartorial_timer_logs');
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
      localStorage.setItem('sartorial_timer_logs', JSON.stringify(updated));
    } catch {}

    if (window.showToast) {
      window.showToast(`Logged ${minutes}m of sewing time. Efficiency: ${efficiency}%`, 'success', 'Session Recorded');
    }
  };

  const handleDeleteLog = (logId) => {
    const updated = sessionLogs.filter(l => l.id !== logId);
    setSessionLogs(updated);
    try {
      localStorage.setItem('sartorial_timer_logs', JSON.stringify(updated));
    } catch {}
  };


  // --- MATERIALS, SUPPLIERS, & CONTACTS STATE ---
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_atelier_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(item => ({
          ...item,
          tags: item.tags || (item.name ? item.name.split(' ').slice(-2) : ['Fabric', 'Textile'])
        }));
      }
      return INITIAL_INVENTORY;
    } catch {
      return INITIAL_INVENTORY;
    }
  });

  const [suppliers, setSuppliers] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_atelier_suppliers');
      return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
    } catch {
      return INITIAL_SUPPLIERS;
    }
  });

  const [materialsTab, setMaterialsTab] = useState('inventory'); // 'inventory' | 'suppliers' | 'orders'

  // Restock order logs
  const [supplyOrders, setSupplyOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_supply_orders');
      return saved ? JSON.parse(saved) : [
        { id: 'po-1', materialName: 'British Fine Merino Tweed', supplierName: 'Merino & Tweed Heritage Mills', qty: 25, totalCost: 737.50, status: 'In Transit', orderDate: 'Jul 15, 2026' }
      ];
    } catch {
      return [];
    }
  });

  const saveInventory = (updated) => {
    setInventory(updated);
    try {
      localStorage.setItem('sartorial_atelier_inventory', JSON.stringify(updated));
    } catch {}
  };

  const saveSuppliers = (updated) => {
    setSuppliers(updated);
    try {
      localStorage.setItem('sartorial_atelier_suppliers', JSON.stringify(updated));
    } catch {}
  };

  const saveSupplyOrders = (updated) => {
    setSupplyOrders(updated);
    try {
      localStorage.setItem('sartorial_supply_orders', JSON.stringify(updated));
    } catch {}
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
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-clay-705">Atelier Collaborator Hub</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-mono text-bark-450 bg-sand-100/80 border border-sand-200 px-2 py-0.5 rounded-lg select-none" title="Save measurements & study progress anytime">
              <kbd className="font-sans bg-white px-1 py-0.5 rounded border border-sand-250 text-[10px] shadow-3xs font-semibold">Ctrl</kbd>+<kbd className="font-sans bg-white px-1 py-0.5 rounded border border-sand-250 text-[10px] shadow-3xs font-semibold">S</kbd> to save progress
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
            <h2 className="text-xl font-serif text-bark-950 font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#8c6239]" />
              Consolidated Atelier Workspace
            </h2>
            <button
              type="button"
              onClick={() => {
                setWalkthroughStep(0);
                setWalkthroughActive(true);
              }}
              className="bg-amber-50 hover:bg-amber-100/80 active:scale-95 text-amber-800 border border-amber-250 font-bold font-sans text-[11px] px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Start Feature Walkthrough</span>
            </button>
          </div>
          <p className="text-xs text-bark-500 max-w-xl">
            A fully operational workspace to manage your drafting lifecycle, supply chain pipelines, B2B partner directories, and live production tools.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-sand-200/60 p-1 rounded-xl border border-sand-250/50 gap-1 overflow-x-auto self-stretch md:self-auto max-w-full">
          {[
            { id: 'projects', label: '📐 Projects & Checklist', icon: FolderKanban },
            { id: 'techpacks', label: '🔒 Tech Packs & Secrets', icon: Lock },
            { id: 'timer', label: '⏱️ Sewing Timer', icon: Clock },
            { id: 'supply', label: '🧵 Supplies & Suppliers', icon: ClipboardList },
            { id: 'measurements', label: '📏 Sizers & Guides', icon: Calculator }
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
                  <h3 className="text-sm font-bold font-mono text-bark-800 uppercase tracking-wider">Garment Life Cycle</h3>

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
                          title="Archive project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Garment Form */}
                <form onSubmit={handleAddProject} className="bg-[#FAF8F5] border border-sand-200/60 rounded-xl p-5 space-y-4">
                  <span className="text-[9px] font-mono uppercase text-clay-700 font-bold block">✦ Start Bespoke Design ✦</span>
                  <div className="space-y-3 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-bark-600 block">Project Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Silk Autumn Dress"
                        value={newProjName}
                        onChange={(e) => setNewProjName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase text-bark-600 block">Target Pattern</label>
                      <select
                        value={newProjPattern}
                        onChange={(e) => setNewProjPattern(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                      >
                        <option value="Trench">The French Draped Trench</option>
                        <option value="Skirt">Minimalist Zero-Waste Skirt</option>
                        <option value="Smock">Classic Linen Perfect Fit Smock</option>
                        <option value="Blazer">Perfect Fit Hourglass Blazer</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Project Space</span>
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
                          <p className="text-xs text-bark-600">
                            Pattern Template: <span className="font-mono bg-sand-100 px-2 py-0.5 rounded text-clay-707 font-bold text-[10px]">{activeProject.patternName}</span>
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
                          <strong className="text-bark-800">Total Workshop Progress</strong>
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
                          <h3 className="text-xs font-bold uppercase font-mono tracking-wider text-bark-800">Custom Grading & Drafting Steps</h3>
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
                      <span>This workshop automatically syncs with your digital mannequin and sizers.</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#FAF8F5] border border-dashed border-sand-300 rounded-xl p-12 text-center flex flex-col items-center justify-center h-full">
                    <ListTodo className="w-12 h-12 text-bark-300 mb-3" />
                    <p className="text-sm text-bark-500">No active projects. Start a bespoke design from the left sidebar to activate.</p>
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
                      <Lock className="w-3 h-3 text-clay-400" /> Collaborator Secret Vault
                    </span>
                    <span className="text-stone-400 text-xs font-mono">Internal Technical Specs</span>
                  </div>
                  <h3 className="text-xl font-serif text-amber-50">Technical Specs &amp; Development Secrets</h3>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Private workspace for atelier collaborators to store development journeys, seam allowance secrets, and industrial tech packs. Share via encrypted one-time access tokens.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                  {/* Pattern Picker */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-stone-400 uppercase block font-bold">Selected Pattern</label>
                    <select
                      value={selectedTechPackPatternId}
                      onChange={(e) => setSelectedTechPackPatternId(e.target.value)}
                      className="bg-stone-800 text-amber-100 border border-stone-700 px-3 py-2 rounded-xl text-xs font-sans focus:outline-none focus:border-clay-500 cursor-pointer"
                    >
                      {SEWING_PATTERNS.map(p => (
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
                      <span>Share One-Time Token Link</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-navigation bar inside Tech Packs */}
              <div className="flex border-b border-sand-200 gap-4 overflow-x-auto pb-1" id="techpack-navbar">
                {[
                  { id: 'specs', label: '✂️ Atelier Construction Specs', icon: Scissors },
                  { id: 'flats', label: '🎨 Swatch Studio & Technical Drawings', icon: Layers },
                  { id: 'industrial', label: '🏭 Industrial Tech Pack & BOM', icon: Building2 },
                  { id: 'secrets', label: '🔒 Development Secrets & Journal', icon: Lock }
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
                          <span>Download Assembly PDF</span>
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
                            <Scissors className="w-3.5 h-3.5" /> Recommended Fabrics
                          </h6>
                          <ul className="text-xs text-bark-700 space-y-1 list-disc list-inside">
                            {(selectedTechPackPattern.fabricSuggestions || ['European Linen', 'Cotton Twill', 'Wool Crepe']).map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 bg-sand-50/60 rounded-xl border border-sand-200 space-y-2">
                          <h6 className="text-[11px] font-mono uppercase font-bold text-clay-705 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" /> Standard Seam Allowances
                          </h6>
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
                        <ShieldCheck className="w-4 h-4 text-clay-400" /> Collaborator Access Info
                      </h5>
                      <p className="text-xs text-stone-300 leading-relaxed">
                        This technical profile is restricted to active atelier collaborators. Unlinked from customer-facing galleries to protect confidential drafting methods.
                      </p>
                      <div className="pt-2 border-t border-stone-800 space-y-2 text-[11px] font-mono text-stone-400">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className="text-emerald-400 font-bold">Active Development</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Token Sharing:</span>
                          <span className="text-amber-300 font-bold">Enabled</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Grading Grid:</span>
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
                        <h4 className="text-lg font-serif text-amber-50">Collaborator Development Secrets Journal</h4>
                      </div>
                      <p className="text-xs text-stone-400 font-sans">
                        Record fitting adjustments, proprietary seam finishes, and confidential notes for <strong className="text-amber-200">{selectedTechPackPattern.name}</strong>.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSaveSecretNote(selectedTechPackPatternId, secretNotesMap[selectedTechPackPatternId] || '')}
                      className="bg-clay-605 hover:bg-clay-705 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Secrets Journal</span>
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
                      placeholder="Enter secret seam allowance modifications, fitting adjustments, or fabric testing notes..."
                      className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-xs font-mono text-amber-100 leading-relaxed focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                  </div>

                  <div className="p-4 bg-stone-950/60 rounded-xl border border-stone-800 flex items-center justify-between text-xs font-mono text-stone-400">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" /> Auto-saves to your local collaborator vault.
                    </span>
                    <span className="text-[10px] text-stone-500">Shortcut: Press Ctrl+S anywhere</span>
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
              <SewingSessionTimer patterns={SEWING_PATTERNS} forceViewMode={sewingTimerForceViewMode} />
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
                  { id: 'inventory', label: '🧵 Materials Inventory', icon: Layers },
                  { id: 'suppliers', label: '🤝 B2B Supplier Directory', icon: UserCheck },
                  { id: 'orders', label: '📦 Restock Pipeline', icon: Package }
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
                      <span className="text-xs font-mono uppercase tracking-wider font-bold text-clay-755">Atelier Stock Registry</span>
                    </div>
                    <button
                      type="button"
                      onClick={exportToPdf}
                      className="bg-clay-605 hover:bg-clay-705 active:scale-95 text-white font-sans text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-2xs"
                      title="Download fabric inventory and tags report"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export PDF Report</span>
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
                          <span className="text-[9px] font-mono text-bark-450 uppercase block">Total Materials</span>
                          <strong className="text-sm font-serif text-bark-900">{inventory.length} Active Swatches</strong>
                        </div>
                      </div>

                      <div className="bg-sand-50/50 border border-sand-200/70 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-rose-50 text-rose-700 rounded-lg flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-bark-450 uppercase block">Restock Warning</span>
                          <strong className="text-sm font-serif text-bark-900">
                            {inventory.filter(i => i.stock <= i.threshold).length} Low Stock
                          </strong>
                        </div>
                      </div>

                      <div className="bg-sand-50/50 border border-sand-200/70 p-4 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center shrink-0">
                          <Scale className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[9px] font-mono text-bark-450 uppercase block">Total Yardage</span>
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
                              <th className="p-3 pl-4">Material Details</th>
                              <th className="p-3">Type / Weight</th>
                              <th className="p-3">In Stock</th>
                              <th className="p-3">Unit Cost</th>
                              <th className="p-3">Actions</th>
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
                                          title="Add 5 yards"
                                        >
                                          +5
                                        </button>
                                        <button
                                          onClick={() => adjustStock(item.id, -5)}
                                          className="text-[8px] bg-sand-100 hover:bg-sand-200 font-mono font-bold px-1 rounded cursor-pointer"
                                          title="Subtract 5 yards"
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
                                          <span>Restock</span>
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
                        <h4 className="text-xs font-bold font-mono text-bark-800 uppercase tracking-wider">Add textile Swatch</h4>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Material Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Organic Hemp Crepe"
                            value={newMatName}
                            onChange={(e) => setNewMatName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Color / Swatch name</label>
                          <input
                            type="text"
                            placeholder="e.g. Lavender Dusk"
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
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Textile Spec Type</label>
                          <select
                            value={newMatType}
                            onChange={(e) => setNewMatType(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                          >
                            <option value="Fabric Roll">Fabric Roll</option>
                            <option value="Premium Lining">Premium Lining</option>
                            <option value="Heavy Wool Crepe">Heavy Wool Crepe</option>
                            <option value="Interfacing Mesh">Interfacing Mesh</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">French Mill Supplier</label>
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
                            <label className="text-[9px] font-mono uppercase text-bark-500 block">Fabric Tags</label>
                            <span className="text-[8px] font-mono text-bark-400">Comma-separated</span>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. Organic, Linen, Premium"
                            value={newMatTags}
                            onChange={(e) => setNewMatTags(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                        >
                          Add to Inventory
                        </button>
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
                            <span className="text-[8px] font-mono uppercase bg-clay-50 border border-clay-100 text-clay-700 px-2 py-0.5 rounded inline-block font-bold">
                              Verified Supplier
                            </span>
                            <h4 className="font-serif font-bold text-base text-bark-900">{sup.name}</h4>
                            <p className="text-xs text-bark-500">{sup.specialty}</p>
                          </div>

                          <div className="space-y-2 border-t border-sand-100 pt-3.5 text-xs text-bark-750">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-clay-505" />
                              <span>Rep: <strong>{sup.contact}</strong></span>
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
                            <span className="font-mono text-bark-500">Avg Lead Time:</span>
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
                        <h4 className="text-xs font-bold font-mono text-bark-800 uppercase tracking-wider">Register Supplier</h4>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Company Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Como Silk Weaving"
                            value={supName}
                            onChange={(e) => setSupName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Contact Representative</label>
                          <input
                            type="text"
                            placeholder="e.g. Maria Rossi"
                            value={supContact}
                            onChange={(e) => setSupContact(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Email Address</label>
                          <input
                            type="email"
                            placeholder="e.g. orders@comosilk.it"
                            value={supEmail}
                            onChange={(e) => setSupEmail(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Phone Line</label>
                          <input
                            type="text"
                            placeholder="e.g. +39 031 12345"
                            value={supPhone}
                            onChange={(e) => setSupPhone(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono uppercase text-bark-500 block">Mill Specialty / Raw Fiber</label>
                          <input
                            type="text"
                            placeholder="e.g. Italian Crepe, Linen Weaves"
                            value={supSpecialty}
                            onChange={(e) => setSupSpecialty(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-sand-250 rounded-lg text-xs"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                        >
                          Register B2B Partner
                        </button>
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
                          <th className="p-3 pl-4">Order Code / Date</th>
                          <th className="p-3">Material Ordered</th>
                          <th className="p-3">Partner Mill</th>
                          <th className="p-3">Qty & Cost</th>
                          <th className="p-3">Logistics Status</th>
                          <th className="p-3 text-right pr-4">Pipeline Action</th>
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
                                >
                                  Mark Received
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-bold uppercase flex items-center justify-end gap-1 font-mono">
                                  <Check className="w-3.5 h-3.5" /> Stock Synced
                                </span>
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
          <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
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
                  <Key className="w-4 h-4 text-amber-400" /> Secure Token Link Ready
                </div>
                <h3 className="text-xl font-serif text-amber-50">One-Time Access Grant Link</h3>
                <p className="text-xs text-stone-300 leading-relaxed font-sans">
                  Anyone with this token link can view the confidential development journey and technical specs for <strong className="text-amber-200">{selectedTechPackPattern.name}</strong> for a single session without gallery exposure.
                </p>
              </div>

              {/* URL Input Box */}
              <div className="space-y-2 bg-stone-950 p-3 rounded-xl border border-stone-800">
                <label className="text-[9px] font-mono uppercase text-stone-400 block font-bold">One-Time Shareable Token Link</label>
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
                        <CheckCircle2 className="w-4 h-4" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" /> Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Permissions & Security Flags */}
              <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono text-stone-300">
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>1-Time View Limit</span>
                </div>
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Expires in 24 Hours</span>
                </div>
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-clay-400 shrink-0" />
                  <span>Unlinked from Gallery</span>
                </div>
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Full Tech Pack Specs</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowTokenModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <a
                  href={tokenGenerated}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-stone-800 hover:bg-stone-700 text-amber-100 text-xs font-bold px-4 py-2 rounded-xl border border-stone-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Token Link Access</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
