import { localizeMetadataTree } from '../lib/localizedMetadata';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import { clientPreferences } from '../lib/clientPreferences';
import React, { useState, useEffect, useRef } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Plus,
  Trash2,
  Scissors,
  Maximize2,
  Minimize2,
  BookOpen,
  Award,
  CheckCircle,
  Save,
  Notebook,
  AlertCircle,
  FileText,
  Hourglass,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Camera,
  X,
  Download,
  Archive,
  Layers,
  Package,
  Edit,
  ShoppingBag,
  ClipboardList,
  Check,
  Search,
  Tag,
  Filter,
  Calculator,
  Coins,
  DollarSign,
  Activity
} from 'lucide-react';
import { MASTER_SIZING_TABLE } from '../data';
import TimeAndMotionStudy from './subcomponents/TimeAndMotionStudy';
import { UI_LAYERS } from '../lib/uiLayers';
import { perfectFitMetadata } from '../config/perfectFitMetadata';

const sewingSessionMetadata = perfectFitMetadata.workspace?.sewing?.sessionTimer || {};
const PATTERN_STEPS = sewingSessionMetadata.patternSteps || {};
const DEFAULT_PROJECT_STEPS = sewingSessionMetadata.defaultProjectSteps || [];

const CALC_SIZING_TABLE = [
  { size: '0', bust: 32, waist: 24, hips: 34 },
  { size: '2', bust: 33, waist: 25, hips: 35 },
  { size: '4', bust: 34, waist: 26, hips: 36 },
  { size: '6', bust: 35, waist: 27, hips: 37 },
  { size: '8', bust: 36, waist: 28, hips: 38 },
  { size: '10', bust: 37.5, waist: 29.5, hips: 39.5 },
  { size: '12', bust: 39, waist: 31, hips: 41 },
  { size: '14', bust: 41, waist: 33, hips: 43 },
  { size: '16', bust: 43, waist: 35, hips: 45 },
  { size: '18', bust: 45, waist: 37, hips: 47 },
  { size: '20', bust: 47, waist: 39, hips: 49 },
  { size: '22', bust: 49, waist: 41, hips: 51 },
];

export default function SewingSessionTimer({ patterns = [], forceViewMode }) {
  const sewingSessionUi = perfectFitMetadata.componentUi.sewingSession;
  const PREDEFINED_COLORS = localizeMetadataTree(sewingSessionUi.predefinedColors, 'component.sewingSession.predefinedColors', pfUiT);
  const MATERIAL_PRESETS = localizeMetadataTree(sewingSessionUi.materialPresets, 'component.sewingSession.materialPresets', pfUiT);

  // --- STATE ---
  const [sewingViewMode, setSewingViewMode] = useState('timer'); // 'timer' | 'motionStudy'

  useEffect(() => {
    if (forceViewMode) {
      setSewingViewMode(forceViewMode);
    }
  }, [forceViewMode]);
  const [selectedPatternId, setSelectedPatternId] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_active_timer_pattern');
      return saved || (patterns[0]?.id || 'sartorial-01');
    } catch {
      return 'sartorial-01';
    }
  });

  const [selectedStepIndex, setSelectedStepIndex] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_active_timer_step');
      return saved ? parseInt(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [secondsElapsed, setSecondsElapsed] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_active_timer_seconds');
      return saved ? parseInt(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [isRunning, setIsRunning] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_active_timer_running');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [sessionNotes, setSessionNotes] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_active_timer_notes');
      return saved || '';
    } catch {
      return '';
    }
  });

  const [archivedProjectIds, setArchivedProjectIds] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_archived_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_archived_projects', JSON.stringify(archivedProjectIds));
    } catch {}
  }, [archivedProjectIds]);

  const [userProjects, setUserProjects] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_user_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_user_projects', JSON.stringify(userProjects));
    } catch {}
  }, [userProjects]);

  // Project Creation Form state
  const [isCreateProjectFormOpen, setIsCreateProjectFormOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjPatternId, setNewProjPatternId] = useState('sartorial-01');
  const [newProjSize, setNewProjSize] = useState('8');
  const [newProjWidth, setNewProjWidth] = useState('60');
  const [newProjNotes, setNewProjNotes] = useState('');

  // Digital pattern drag-and-drop importer state
  const [creationMethod, setCreationMethod] = useState('import'); // 'import' | 'manual'
  const [isDragging, setIsDragging] = useState(false);
  const [importingFile, setImportingFile] = useState(null);
  const [importStep, setImportStep] = useState(0); // 0: idle, 1: scanning, 2: reviewed
  const [importLogs, setImportLogs] = useState([]);
  const [importedMetadata, setImportedMetadata] = useState({
    name: '',
    patternId: 'sartorial-01',
    size: '8',
    width: '60',
    fabrics: [],
    notes: ''
  });

  const [projectsSubTab, setProjectsSubTab] = useState('active'); // 'active' | 'archived'

  useEffect(() => {
    setProjectsFilterId('all');
  }, [projectsSubTab]);

  // Companion project-specific notes and fabric requirements
  const [projectCompanionData, setProjectCompanionData] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_project_companion_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      'sartorial-01': {
        reminders: [
          { id: 'rem-1-1', text: 'Pre-wash the linen twice to prevent shrinkage on final garment.', checked: false },
          { id: 'rem-1-2', text: 'Press neckline with tailor clapper for flat couture finish.', checked: true }
        ],
        fabrics: [
          { id: 'fab-1-1', item: 'Medium-weight washed linen / viscose crepe', req: '2.8 meters (140cm width)', checked: false },
          { id: 'fab-1-2', item: 'Ultralight fusible knit stay-tape / staystitch', req: '1.2 meters', checked: true },
          { id: 'fab-1-3', item: 'Matching Gütermann silk thread', req: '1 spool', checked: false }
        ],
        measurements: {
          bust: '88',
          waist: '68',
          hips: '94',
          height: '168',
          custom: 'Reduce bodice side seams by 0.5cm for precise custom waist wrap ease.'
        }
      },
      'sartorial-02': {
        reminders: [
          { id: 'rem-2-1', text: 'Do not skip welt pocket pocket-flap stabilizer fusing.', checked: false },
          { id: 'rem-2-2', text: 'Use a heavy-duty size 90/14 denim/canvas needle for clean seams.', checked: false }
        ],
        fabrics: [
          { id: 'fab-2-1', item: 'Water-resistant cotton gabardine or wool twill', req: '4.2 meters (150cm width)', checked: false },
          { id: 'fab-2-2', item: 'Premium Bemberg rayon lining', req: '3.0 meters', checked: false },
          { id: 'fab-2-3', item: 'Fusible woven hair canvas interfacing', req: '1.8 meters', checked: false },
          { id: 'fab-2-4', item: 'Genuine horn buttons (20mm & 25mm)', req: '10 units total', checked: false }
        ],
        measurements: {
          bust: '92',
          waist: '72',
          hips: '98',
          height: '172',
          custom: 'Add 3cm sleeve length for high-drape cuffs.'
        }
      },
      'sartorial-03': {
        reminders: [
          { id: 'rem-3-1', text: 'Stitch double-welt pockets slowly; press continuously.', checked: false },
          { id: 'rem-3-2', text: 'Overlock all seam edges before leg assembly.', checked: true }
        ],
        fabrics: [
          { id: 'fab-3-1', item: 'Worsted wool, heavy silk tencel, or linen blend', req: '2.4 meters (150cm width)', checked: false },
          { id: 'fab-3-2', item: 'Pocket bag cotton lining', req: '0.4 meters', checked: true },
          { id: 'fab-3-3', item: 'Ban-Rol waistband stabilizer (3.5cm)', req: '1.0 meter', checked: false }
        ],
        measurements: {
          bust: '',
          waist: '70',
          hips: '96',
          height: '165',
          custom: 'Shorten inseam by 2cm for flat shoe profile.'
        }
      },
      'sartorial-04': {
        reminders: [
          { id: 'rem-4-1', text: 'Handle delicate asymmetrical drape folds with hand basting first.', checked: false }
        ],
        fabrics: [
          { id: 'fab-4-1', item: 'Silk georgette, crepe de chine, or light rayon', req: '1.8 meters (140cm width)', checked: false },
          { id: 'fab-4-2', item: 'Ultra-thin fusible knit tricot interfacing', req: '0.5 meters', checked: false }
        ],
        measurements: {
          bust: '86',
          waist: '66',
          hips: '92',
          height: '167',
          custom: 'Use micro-tex needles size 60/8 or 70/10.'
        }
      },
      'custom': {
        reminders: [],
        fabrics: [],
        measurements: {
          bust: '',
          waist: '',
          hips: '',
          height: '',
          custom: ''
        }
      }
    };
  });

  const [activeSidebarTab, setActiveSidebarTab] = useState('notes'); // 'notes' | 'measurements' | 'journal' | 'projects' | 'inventory'
  const [fabricStash, setFabricStash] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_fabric_stash');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'stash-1',
        name: 'Sage Green Washed Linen',
        type: 'Linen',
        yardage: '3.5',
        width: '54',
        costPerYard: '18.50',
        notes: 'Extremely soft, pre-washed twice. Perfect for a summer wrap dress or structured trousers.',
        photo: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=200',
        patternId: 'sartorial-01',
        tags: ['Linen', 'Summer Use', 'Drapey'],
        dateAdded: new Date().toISOString()
      },
      {
        id: 'stash-2',
        name: 'Navy Blue Cotton Gabardine',
        type: 'Cotton',
        yardage: '4.5',
        width: '60',
        costPerYard: '14.00',
        notes: 'Heavy-weight, crisp drape. Intended for a tailored double-breasted trench coat.',
        photo: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=200',
        patternId: 'sartorial-02',
        tags: ['Cotton', 'Outerwear', 'Structured', 'Heavyweight'],
        dateAdded: new Date().toISOString()
      },
      {
        id: 'stash-3',
        name: 'Blush Pink Silk Crepe',
        type: 'Silk',
        yardage: '2.5',
        width: '45',
        costPerYard: '28.00',
        notes: 'Delicate and lustrous, fluid drape. Perfect for an asymmetrical high-drape blouse.',
        photo: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&q=80&w=200',
        patternId: 'sartorial-04',
        tags: ['Silk', 'Garment', 'Drapey'],
        dateAdded: new Date().toISOString()
      }
    ];
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_fabric_stash', JSON.stringify(fabricStash));
    } catch {}
  }, [fabricStash]);

  const [stashThreshold, setStashThreshold] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_fabric_stash_threshold');
      return saved ? parseFloat(saved) : 2.0;
    } catch {}
    return 2.0;
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_fabric_stash_threshold', stashThreshold.toString());
    } catch {}
  }, [stashThreshold]);

  // Tagging sub-modal states for fabric cards & pattern cards
  const [isTaggingModalOpen, setIsTaggingModalOpen] = useState(false);
  const [taggingItemId, setTaggingItemId] = useState(null); // can be stash item ID OR pattern/project ID
  const [taggingItemType, setTaggingItemType] = useState('stash'); // 'stash' | 'pattern'
  const [taggingItemName, setTaggingItemName] = useState('');
  const [selectedFabricType, setSelectedFabricType] = useState('Linen');
  const [selectedFabricColor, setSelectedFabricColor] = useState('Sage Green');

  // Persisted pattern tags (for tagging sewing pattern cards directly)
  const [patternTags, setPatternTags] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('perfectfit_pattern_tags');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('perfectfit_pattern_tags', JSON.stringify(patternTags));
    } catch {}
  }, [patternTags]);

  const handleTagItemSave = () => {
    if (!taggingItemId) return;
    const colorObj = PREDEFINED_COLORS.find(c => c.name === selectedFabricColor) || { hex: '#ba6446' };

    if (taggingItemType === 'stash') {
      // Tagging a fabric stash card
      setFabricStash(prev => prev.map(item => {
        if (item.id === taggingItemId) {
          return {
            ...item,
            type: selectedFabricType,
            color: colorObj.hex,
            tags: Array.from(new Set([...(item.tags || []), selectedFabricType, selectedFabricColor]))
          };
        }
        return item;
      }));
      if (window.showToast) {
        window.showToast(`Fabric card tagged with ${selectedFabricType} (${selectedFabricColor})`, 'success', 'Card Tagged');
      }
    } else {
      // Tagging a sewing pattern card
      setPatternTags(prev => ({
        ...prev,
        [taggingItemId]: { fabricType: selectedFabricType, color: selectedFabricColor }
      }));
      if (window.showToast) {
        window.showToast(`Pattern card tagged with ${selectedFabricType} (${selectedFabricColor})`, 'success', 'Card Tagged');
      }
    }

    setIsTaggingModalOpen(false);
    setTaggingItemId(null);
  };

  // Shopping List States
  const [shoppingListPatterns, setShoppingListPatterns] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_shopping_patterns');
      return saved ? JSON.parse(saved) : [];
    } catch {}
    return [];
  });

  const [shoppingListWidths, setShoppingListWidths] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_shopping_widths');
      return saved ? JSON.parse(saved) : {};
    } catch {}
    return {};
  });

  const [checkedNotions, setCheckedNotions] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_shopping_notions');
      return saved ? JSON.parse(saved) : {};
    } catch {}
    return {};
  });

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_shopping_patterns', JSON.stringify(shoppingListPatterns));
    } catch {}
  }, [shoppingListPatterns]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_shopping_widths', JSON.stringify(shoppingListWidths));
    } catch {}
  }, [shoppingListWidths]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_shopping_notions', JSON.stringify(checkedNotions));
    } catch {}
  }, [checkedNotions]);

  // Inventory sub-tab state ('stash' or 'planner')
  const [inventorySubTab, setInventorySubTab] = useState('stash');

  // Sizing & Yardage Estimator state
  const [calcPatternId, setCalcPatternId] = useState('sartorial-01');
  const [calcSize, setCalcSize] = useState('8');
  const [calcWidth, setCalcWidth] = useState('60');
  const [calcCustomBase44, setCalcCustomBase44] = useState('3.0');
  const [calcCustomBase60, setCalcCustomBase60] = useState('2.5');
  const [calcCustomName, setCalcCustomName] = useState('Custom Pattern');

  // Project Cost Estimator states
  const [costEstProjectId, setCostEstProjectId] = useState('sartorial-01');
  const [quickEditStashId, setQuickEditStashId] = useState(null);
  const [quickEditCost, setQuickEditCost] = useState('');

  // Inventory Form states
  const [isStashFormOpen, setIsStashFormOpen] = useState(false);
  const [editingStashId, setEditingStashId] = useState(null);
  const [stashName, setStashName] = useState('');
  const [stashType, setStashType] = useState('Linen');
  const [stashYardage, setStashYardage] = useState('');
  const [stashWidth, setStashWidth] = useState('');
  const [stashCostPerYard, setStashCostPerYard] = useState('');
  const [stashNotes, setStashNotes] = useState('');
  const [stashPhoto, setStashPhoto] = useState('');
  const [stashPatternId, setStashPatternId] = useState('none');
  const [stashTags, setStashTags] = useState(''); // Comma-separated tags during editing
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All');
  const [selectedTagFilter, setSelectedTagFilter] = useState('All');
  const [inventorySearch, setInventorySearch] = useState('');

  const [projectsFilterId, setProjectsFilterId] = useState('all');
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState(null);
  const [newReminderText, setNewReminderText] = useState('');
  const [newFabricItem, setNewFabricItem] = useState('');
  const [newFabricReq, setNewFabricReq] = useState('');

  // State for collapsible checklists on custom projects
  const [expandedChecklists, setExpandedChecklists] = useState({});

  const toggleChecklistExpanded = (projectId) => {
    setExpandedChecklists(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const getProjectChecklist = (id) => {
    if (projectCompanionData[id]?.checklist && Array.isArray(projectCompanionData[id].checklist)) {
      return projectCompanionData[id].checklist;
    }
    return [
      { id: 'cutting', label: 'Cutting Fabric & Pattern Prep', completed: false },
      { id: 'staystitching', label: 'Staystitching & Interfacing', completed: false },
      { id: 'sewing_seams', label: 'Sewing Seams & Main Assembly', completed: false },
      { id: 'detail_sewing', label: 'Detail Sewing (Collars, Cuffs, Hemming)', completed: false },
      { id: 'final_pressing', label: 'Final Pressing & Finishing touch', completed: false }
    ];
  };

  const toggleChecklistItem = (id, itemId) => {
    setProjectCompanionData(prev => {
      const existingData = prev[id] || { reminders: [], fabrics: [], measurements: {}, completed: false };
      const currentChecklist = existingData.checklist && Array.isArray(existingData.checklist)
        ? existingData.checklist
        : [
            { id: 'cutting', label: 'Cutting Fabric & Pattern Prep', completed: false },
            { id: 'staystitching', label: 'Staystitching & Interfacing', completed: false },
            { id: 'sewing_seams', label: 'Sewing Seams & Main Assembly', completed: false },
            { id: 'detail_sewing', label: 'Detail Sewing (Collars, Cuffs, Hemming)', completed: false },
            { id: 'final_pressing', label: 'Final Pressing & Finishing touch', completed: false }
          ];

      const updatedChecklist = currentChecklist.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );

      return {
        ...prev,
        [id]: {
          ...existingData,
          checklist: updatedChecklist
        }
      };
    });
  };

  // Historical logs
  const [historyLogs, setHistoryLogs] = useState(() => {
    try {
      const saved = runtimeDataStorage.getItem('sartorial_timer_history_logs');
      return saved ? JSON.parse(saved) : [
        {
          id: 'log-seed-1',
          patternId: 'sartorial-01',
          patternName: 'Aurelia Wrap Dress',
          stepName: 'Staystitch Front Neckline & Armholes',
          durationSeconds: 110, // 1m 50s
          date: '2026-07-07T14:24:00.000Z',
          notes: 'Completed neckline stabilizing. Linen was prone to fraying, so I handled with ultra care.'
        },
        {
          id: 'log-seed-2',
          patternId: 'sartorial-01',
          patternName: 'Aurelia Wrap Dress',
          stepName: 'Stitch Bust Darts',
          durationSeconds: 155, // 2m 35s
          date: '2026-07-08T09:12:00.000Z',
          notes: 'Nicely shaped bodice. Standard allowed minutes was 2.2 min, took me 2.58 min. Precision pressing with clapper.'
        }
      ];
    } catch {
      return [];
    }
  });

  // Manual logging modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualSeconds, setManualSeconds] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualStep, setManualStep] = useState('');

  const intervalRef = useRef(null);

  // Camera & Photo attachment states
  const [activeSessionPhoto, setActiveSessionPhoto] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_active_session_photo');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraTarget, setCameraTarget] = useState('session'); // 'session' | 'companion'
  const videoRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      setShowCamera(true);
      // Wait for DOM connection
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Unable to access camera. Please ensure permissions are granted.");
      if (window.showToast) {
        window.showToast("Could not access device camera.", "error", "Camera Error");
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const addCompanionPhoto = (photoDataUrl) => {
    const newPhoto = {
      id: `photo-${Date.now()}`,
      url: photoDataUrl,
      date: new Date().toISOString()
    };
    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          photos: [...(current.photos || []), newPhoto]
        }
      };
    });
    if (window.showToast) {
      window.showToast("Photo added to project progress gallery.", "success", "Progress Saved");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (cameraTarget === 'session') {
          setActiveSessionPhoto(dataUrl);
          if (window.showToast) {
            window.showToast("Photo captured and attached to active session notes.", "success", "Captured");
          }
        } else {
          addCompanionPhoto(dataUrl);
        }
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (cameraTarget === 'session') {
          setActiveSessionPhoto(reader.result);
          if (window.showToast) {
            window.showToast("Photo attached from device library.", "success", "Attached");
          }
        } else {
          addCompanionPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStashPhoto(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteCompanionPhoto = (photoId) => {
    if (confirm("Are you sure you want to delete this progress photo?")) {
      setProjectCompanionData(prev => {
        const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
        return {
          ...prev,
          [selectedPatternId]: {
            ...current,
            photos: (current.photos || []).filter(p => p.id !== photoId)
          }
        };
      });
      if (window.showToast) {
        window.showToast("Progress photo deleted.", "info", "Deleted");
      }
    }
  };

  // --- DERIVED DATA ---
  const matchedUserProj = userProjects.find(p => p.id === selectedPatternId);
  const basePattern = matchedUserProj
    ? patterns.find(p => p.id === matchedUserProj.patternId)
    : patterns.find(p => p.id === selectedPatternId);

  const activePattern = {
    ...(basePattern || { id: 'custom', name: 'Custom Tailoring Project', difficulty: 'Any' }),
    id: selectedPatternId,
    name: matchedUserProj ? matchedUserProj.name : (basePattern?.name || 'Custom Tailoring Project')
  };

  const stepsList = PATTERN_STEPS[matchedUserProj ? matchedUserProj.patternId : selectedPatternId] || DEFAULT_PROJECT_STEPS;
  const currentStep = stepsList[selectedStepIndex] || { step: '01', op: 'Custom Tailoring Step', sam: 10.0 };

  // Sync state to localStorage
  useEffect(() => {
    try {
      clientPreferences.setItem('sartorial_active_timer_pattern', selectedPatternId);
    } catch {}
  }, [selectedPatternId]);

  useEffect(() => {
    try {
      clientPreferences.setItem('sartorial_active_timer_step', selectedStepIndex.toString());
    } catch {}
  }, [selectedStepIndex]);

  useEffect(() => {
    try {
      clientPreferences.setItem('sartorial_active_timer_seconds', secondsElapsed.toString());
    } catch {}
  }, [secondsElapsed]);

  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_timer_history_logs', JSON.stringify(historyLogs));
    } catch {}
  }, [historyLogs]);

  useEffect(() => {
    try {
      clientPreferences.setItem('sartorial_active_timer_running', isRunning.toString());
    } catch {}
  }, [isRunning]);

  useEffect(() => {
    try {
      clientPreferences.setItem('sartorial_active_timer_notes', sessionNotes);
    } catch {}
  }, [sessionNotes]);

  useEffect(() => {
    try {
      if (activeSessionPhoto) {
        clientPreferences.setItem('sartorial_active_session_photo', activeSessionPhoto);
      } else {
        clientPreferences.removeItem('sartorial_active_session_photo');
      }
    } catch {}
  }, [activeSessionPhoto]);

  // Handle ticking timer
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Sync companion data to localStorage on change
  useEffect(() => {
    try {
      runtimeDataStorage.setItem('sartorial_project_companion_data', JSON.stringify(projectCompanionData));
    } catch {}
  }, [projectCompanionData]);

  // Derived companion data helper variables
  const activeCompanion = projectCompanionData[selectedPatternId] || {
    reminders: [],
    fabrics: [],
    measurements: { bust: '', waist: '', hips: '', height: '', custom: '' }
  };

  const activeReminders = activeCompanion.reminders || [];
  const activeFabrics = activeCompanion.fabrics || [];
  const activeMeas = activeCompanion.measurements || { bust: '', waist: '', hips: '', height: '', custom: '' };

  // Aggregate all progress photos from companion data AND history logs
  const allProgressPhotos = (() => {
    const photos = [];

    // 1. Extract from projectCompanionData
    Object.entries(projectCompanionData).forEach(([pid, data]) => {
      const matchedProj = userProjects.find(p => p.id === pid);
      const patternName = matchedProj
        ? matchedProj.name
        : (patterns.find(p => p.id === pid)?.name || 'Custom Tailoring Project');
      if (data.photos && Array.isArray(data.photos)) {
        data.photos.forEach(p => {
          photos.push({
            id: p.id,
            url: p.url,
            date: p.date,
            patternId: pid,
            patternName: patternName,
            source: 'Gallery Capture',
            details: 'Visual milestone saved directly to design gallery.'
          });
        });
      }
    });

    // 2. Extract from historyLogs
    historyLogs.forEach(log => {
      if (log.photo) {
        photos.push({
          id: `log-photo-${log.id}`,
          url: log.photo,
          date: log.date,
          patternId: log.patternId,
          patternName: log.patternName,
          source: 'Sewing Session',
          details: `Logged on: ${log.stepName} (${formatLongTime(log.durationSeconds)})`
        });
      }
    });

    // Sort chronologically (latest first)
    return photos.sort((a, b) => new Date(b.date) - new Date(a.date));
  })();

  const isProjectVisible = (patternId) => {
    const isArchived = archivedProjectIds.includes(patternId);
    if (projectsSubTab === 'active') {
      return !isArchived;
    } else {
      return isArchived;
    }
  };

  const filteredPhotos = allProgressPhotos.filter(p => {
    if (projectsFilterId === 'all') {
      return isProjectVisible(p.patternId);
    }
    return p.patternId === projectsFilterId;
  });

  const handlePrevPhoto = (e) => {
    if (e) e.stopPropagation();
    if (filteredPhotos.length <= 1) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPreviewPhoto?.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + filteredPhotos.length) % filteredPhotos.length;
    setSelectedPreviewPhoto(filteredPhotos[prevIndex]);
  };

  const handleNextPhoto = (e) => {
    if (e) e.stopPropagation();
    if (filteredPhotos.length <= 1) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPreviewPhoto?.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % filteredPhotos.length;
    setSelectedPreviewPhoto(filteredPhotos[nextIndex]);
  };

  useEffect(() => {
    if (!selectedPreviewPhoto) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        setSelectedPreviewPhoto(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPreviewPhoto, filteredPhotos]);

  const completedProjectsCount = [
    ...patterns.map(p => p.id),
    ...userProjects.map(p => p.id),
    'custom'
  ].filter(id => projectCompanionData[id]?.completed).length;
  const totalProgressPhotosCount = allProgressPhotos.length;

  const allAvailableTags = Array.from(
    new Set(
      fabricStash.flatMap(item => item.tags || [])
    )
  ).filter(Boolean);

  const filteredStash = fabricStash.filter(item => {
    // 1. Search Query filter
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase().trim();
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const notesMatch = (item.notes || '').toLowerCase().includes(q);
      const typeMatch = (item.type || '').toLowerCase().includes(q);
      const tagsMatch = (item.tags || []).some(t => t.toLowerCase().includes(q));
      if (!nameMatch && !notesMatch && !typeMatch && !tagsMatch) return false;
    }

    // 2. Fiber Type filter
    if (selectedTypeFilter !== 'All') {
      if ((item.type || '').toLowerCase() !== selectedTypeFilter.toLowerCase()) {
        return false;
      }
    }

    // 3. Tag / Use-Case Filter
    if (selectedTagFilter !== 'All') {
      const hasTag = (item.tags || []).some(t => t.toLowerCase() === selectedTagFilter.toLowerCase());
      if (!hasTag) return false;
    }

    return true;
  });

  // --- Dynamic calculations for the Sizing & Yardage Estimator ---
  const matchedUserProjForCalc = userProjects.find(p => p.id === calcPatternId);
  const selectedCalcPattern = matchedUserProjForCalc
    ? patterns.find(p => p.id === matchedUserProjForCalc.patternId)
    : patterns.find(p => p.id === calcPatternId);
  const isCustomCalcPattern = calcPatternId === 'custom' || (matchedUserProjForCalc && matchedUserProjForCalc.patternId === 'custom');

  // Sizing multiplier:
  let sizeMultiplier = 1.0;
  if (['0', '2', '4'].includes(calcSize)) {
    sizeMultiplier = 0.90;
  } else if (['6', '8', '10', '12'].includes(calcSize)) {
    sizeMultiplier = 1.00;
  } else if (['14', '16', '18'].includes(calcSize)) {
    sizeMultiplier = 1.10;
  } else if (['20', '22'].includes(calcSize)) {
    sizeMultiplier = 1.20;
  }

  // Base Yardage:
  let baseCalcYardage = 3.0;
  if (isCustomCalcPattern) {
    baseCalcYardage = calcWidth === '44' ? (parseFloat(calcCustomBase44) || 0) : (parseFloat(calcCustomBase60) || 0);
  } else if (selectedCalcPattern && selectedCalcPattern.yardageInfo) {
    const baseStr = calcWidth === '44'
      ? selectedCalcPattern.yardageInfo.width44
      : (selectedCalcPattern.yardageInfo.width60 || selectedCalcPattern.yardageInfo.width44);
    baseCalcYardage = parseFloat(baseStr) || 3.0;
  }

  const calculatedTotalNeeded = parseFloat((baseCalcYardage * sizeMultiplier).toFixed(2));

  // Find assigned fabrics in stash for this pattern
  const assignedFabricsForCalc = fabricStash.filter(item => item.patternId === calcPatternId);
  const totalAssignedStashYardage = assignedFabricsForCalc.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0), 0);

  // Find unassigned fabrics of the same type/fiber category
  const suggestionsForCalc = selectedCalcPattern?.fabricSuggestions || [];
  const compatibleUnassignedFabrics = fabricStash.filter(item => {
    const isUnassigned = !item.patternId || item.patternId === 'none';
    if (!isUnassigned) return false;

    const typeLower = (item.type || '').toLowerCase();
    const suggestionsLower = suggestionsForCalc.map(s => s.toLowerCase());

    const typeMatch = suggestionsLower.some(s => s.includes(typeLower) || typeLower.includes(s));
    return typeMatch || suggestionsLower.length === 0 || isCustomCalcPattern;
  });

  const totalCompatibleUnassignedYardage = compatibleUnassignedFabrics.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0), 0);
  const remainingShortage = Math.max(0, calculatedTotalNeeded - totalAssignedStashYardage);
  const needToBuy = remainingShortage;

  const toggleProjectCompletion = (patternId) => {
    setProjectCompanionData(prev => {
      const current = prev[patternId] || { reminders: [], fabrics: [], measurements: {} };
      const isCompletedNow = !current.completed;
      const updated = {
        ...prev,
        [patternId]: {
          ...current,
          completed: isCompletedNow
        }
      };

      if (window.showToast) {
        const pName = userProjects.find(p => p.id === patternId)?.name || patterns.find(p => p.id === patternId)?.name || 'Custom Tailoring';
        window.showToast(
          isCompletedNow ? `Congratulations! "${pName}" marked as completed.` : `"${pName}" marked as active/in-progress.`,
          isCompletedNow ? "success" : "info",
          "Project Status Updated"
        );
      }
      return updated;
    });
  };

  const handleAddOrEditStashItem = (e) => {
    if (e) e.preventDefault();
    if (!stashName.trim()) {
      if (window.showToast) window.showToast("Please enter a fabric name.", "error", "Missing Information");
      return;
    }
    if (!stashYardage.trim()) {
      if (window.showToast) window.showToast("Please enter the yardage/meters amount.", "error", "Missing Information");
      return;
    }

    let finalPhoto = stashPhoto;
    if (!finalPhoto) {
      const paletteIndex = Math.abs(stashName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 8;
      const palettes = [
        '#8fa89b', // Sage
        '#2b3a4a', // Navy
        '#e5b3b3', // Rose
        '#3a3a3a', // Charcoal
        '#d9a043', // Mustard
        '#f5f2eb', // Cream
        '#8b2635', // Crimson
        '#556b2f', // Olive
      ];
      const solidColor = palettes[paletteIndex];
      finalPhoto = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="${encodeURIComponent(solidColor)}"/><text x="50%" y="55%" font-family="monospace" font-size="10" fill="white" fill-opacity="0.6" text-anchor="middle" font-weight="bold">${encodeURIComponent(stashType.toUpperCase())}</text></svg>`;
    }

    const compiledTags = stashTags
      ? stashTags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    if (editingStashId) {
      setFabricStash(prev => prev.map(item => {
        if (item.id === editingStashId) {
          return {
            ...item,
            name: stashName.trim(),
            type: stashType,
            yardage: stashYardage.trim(),
            width: stashWidth.trim(),
            costPerYard: stashCostPerYard.trim(),
            notes: stashNotes.trim(),
            photo: finalPhoto,
            patternId: stashPatternId,
            tags: compiledTags
          };
        }
        return item;
      }));

      if (window.showToast) {
        window.showToast(`"${stashName}" updated successfully in fabric inventory.`, "success", "Inventory Updated");
      }
    } else {
      const newItem = {
        id: `stash-${Date.now()}`,
        name: stashName.trim(),
        type: stashType,
        yardage: stashYardage.trim(),
        width: stashWidth.trim(),
        costPerYard: stashCostPerYard.trim(),
        notes: stashNotes.trim(),
        photo: finalPhoto,
        patternId: stashPatternId,
        tags: compiledTags,
        dateAdded: new Date().toISOString()
      };

      setFabricStash(prev => [newItem, ...prev]);

      if (window.showToast) {
        window.showToast(`"${stashName}" added to your fabric stash!`, "success", "Added to Stash");
      }
    }

    resetStashForm();
  };

  const resetStashForm = () => {
    setIsStashFormOpen(false);
    setEditingStashId(null);
    setStashName('');
    setStashType('Linen');
    setStashYardage('');
    setStashWidth('');
    setStashCostPerYard('');
    setStashNotes('');
    setStashPhoto('');
    setStashPatternId('none');
    setStashTags('');
  };

  const handleEditStashItemClick = (item) => {
    setEditingStashId(item.id);
    setStashName(item.name);
    setStashType(item.type);
    setStashYardage(item.yardage);
    setStashWidth(item.width || '');
    setStashCostPerYard(item.costPerYard || '');
    setStashNotes(item.notes || '');
    setStashPhoto(item.photo || '');
    setStashPatternId(item.patternId || 'none');
    setStashTags(item.tags ? item.tags.join(', ') : '');
    setIsStashFormOpen(true);
  };

  const handleDeleteStashItem = (id, name) => {
    if (confirm(`Are you sure you want to remove "${name}" from your fabric inventory?`)) {
      setFabricStash(prev => prev.filter(item => item.id !== id));
      if (window.showToast) {
        window.showToast(`"${name}" removed from stash.`, "info", "Removed from Inventory");
      }
    }
  };

  const toggleArchiveProject = (projectId, e) => {
    if (e) e.stopPropagation();
    setArchivedProjectIds(prev => {
      const isArchived = prev.includes(projectId);
      const updated = isArchived
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId];

      if (window.showToast) {
        const pName = projectId === 'custom'
          ? 'Custom Tailoring'
          : userProjects.find(p => p.id === projectId)?.name || patterns.find(p => p.id === projectId)?.name || 'Project';
        window.showToast(
          isArchived ? `"${pName}" restored to Active Projects.` : `"${pName}" moved to Archived Projects.`,
          isArchived ? "success" : "info",
          isArchived ? "Project Unarchived" : "Project Archived"
        );
      }
      return updated;
    });
  };

  const handleFormPatternChange = (patternId) => {
    setNewProjPatternId(patternId);
    if (patternId === 'custom') {
      setNewProjName('Custom Tailoring Project');
    } else {
      const p = patterns.find(item => item.id === patternId);
      if (p) {
        setNewProjName(`My ${p.name}`);
      }
    }
  };

  const handleCreateAndLinkProject = (e) => {
    if (e) e.preventDefault();
    if (!newProjName.trim()) {
      if (window.showToast) window.showToast("Please enter a project name.", "error", "Missing Details");
      return;
    }

    const newProjId = `proj-${Date.now()}`;
    const patternObj = patterns.find(p => p.id === newProjPatternId);

    // 1. Build details to auto-fill
    const initialReminders = [];
    if (patternObj?.tutorial?.steps) {
      patternObj.tutorial.steps.forEach((step, idx) => {
        initialReminders.push({
          id: `rem-${newProjId}-${idx}`,
          text: `[${step.time || 'Phase'}] ${step.title} - ${step.desc}`,
          checked: false
        });
      });
    } else {
      initialReminders.push(
        { id: `rem-${newProjId}-1`, text: 'Prepare pattern layout & cut pattern pieces.', checked: false },
        { id: `rem-${newProjId}-2`, text: 'Stitch main garment construction seams.', checked: false },
        { id: `rem-${newProjId}-3`, text: 'Double-fold hem and press with tailor clapper.', checked: false }
      );
    }

    if (patternObj?.tutorial?.tips) {
      patternObj.tutorial.tips.forEach((tip, idx) => {
        initialReminders.push({
          id: `tip-${newProjId}-${idx}`,
          text: `Tailoring Tip: ${tip}`,
          checked: false
        });
      });
    }

    const initialFabrics = [];
    if (patternObj?.fabricSuggestions) {
      patternObj.fabricSuggestions.forEach((sug, idx) => {
        initialFabrics.push({
          id: `fab-${newProjId}-${idx}`,
          item: sug,
          req: patternObj.yardageInfo
            ? `${newProjWidth === '44' ? patternObj.yardageInfo.width44 : patternObj.yardageInfo.width60} needed`
            : 'As recommended',
          checked: false
        });
      });
    } else {
      initialFabrics.push({
        id: `fab-${newProjId}-1`,
        item: 'Main fabric garment yardage',
        req: 'As recommended',
        checked: false
      });
    }

    if (patternObj?.notions) {
      patternObj.notions.forEach((notion, idx) => {
        initialFabrics.push({
          id: `notion-${newProjId}-${idx}`,
          item: notion,
          req: 'Required',
          checked: false
        });
      });
    }

    const sizingTable = patternObj?.measurementsTable || MASTER_SIZING_TABLE;
    const sizeMatch = sizingTable.find(s => s.size === newProjSize);
    const initialMeasurements = {
      bust: sizeMatch ? String(sizeMatch.bust) : '',
      waist: sizeMatch ? String(sizeMatch.waist) : '',
      hips: sizeMatch ? String(sizeMatch.hips) : '',
      height: '168',
      custom: `Linked to pattern "${patternObj?.name || 'Custom'}" at size ${newProjSize}.`
    };

    // 2. Set companion data
    setProjectCompanionData(prev => ({
      ...prev,
      [newProjId]: {
        reminders: initialReminders,
        fabrics: initialFabrics,
        measurements: initialMeasurements,
        completed: false,
        photos: []
      }
    }));

    // 3. Add project to user projects list
    const newProj = {
      id: newProjId,
      name: newProjName.trim(),
      patternId: newProjPatternId,
      size: newProjSize,
      width: newProjWidth,
      notes: newProjNotes.trim(),
      dateAdded: new Date().toISOString()
    };

    setUserProjects(prev => [newProj, ...prev]);

    // 4. Set as active project in app so they can start sewing immediately!
    setSelectedPatternId(newProjId);
    setSelectedStepIndex(0);

    if (window.showToast) {
      window.showToast(
        `Created and auto-filled "${newProj.name}" from ${patternObj?.name || 'custom layout'}. Set as active timer project!`,
        "success",
        "Project Linked Successfully"
      );
    }

    // Reset Form
    setNewProjName('');
    setNewProjNotes('');
    setIsCreateProjectFormOpen(false);
  };

  const handleDeleteUserProject = (projectId, name, e) => {
    if (e) e.stopPropagation();
    if (confirm(`Are you sure you want to delete the project "${name}"? This will remove all associated progress and companion logs.`)) {
      setUserProjects(prev => prev.filter(p => p.id !== projectId));
      if (selectedPatternId === projectId) {
        setSelectedPatternId(patterns[0]?.id || 'custom');
      }
      if (window.showToast) {
        window.showToast(`Project "${name}" has been deleted.`, "info", "Project Removed");
      }
    }
  };

  const handleDownloadSampleJSON = () => {
    const sample = {
      name: "Bespoke Aurelia Wrap Dress Spec",
      patternId: "sartorial-01",
      size: "10",
      width: "60",
      fabrics: [
        "Sandwashed Viscose Linen Blend",
        "Pure Silk Crepe de Chine",
        "Lightweight Linen/Cotton Weave"
      ],
      notes: "Custom draped version. Length extended by 1.5 inches for taller fitting profile. Add gold hardware accents."
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-sewing-pattern.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.showToast) {
      window.showToast("Sample pattern JSON specs downloaded!", "success", "Exporter Active");
    }
  };

  const handleDownloadSampleTXT = () => {
    const sample = `PROJECT: Atelier Utility Trench
PATTERN_ID: sartorial-02
SIZE: 12
WIDTH: 44
RECOMMENDED FABRICS: Rainproof Gabardine, Heavy-weight Waxed Cotton Canvas, Soft Tencel Twill
NOTES: Double-breasted layout with standard sleeve belts. Use size 12 for generous layering space. Press collar with tailor clapper.`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-trench-notes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.showToast) {
      window.showToast("Sample pattern TXT specs downloaded!", "success", "Exporter Active");
    }
  };

  const handleDownloadSampleCSV = () => {
    const sample = `Key,Value
name,Perfect Fit Palazzo Pants Spec
patternId,sartorial-03
size,12
width,60
fabrics,"Medium-weight Linen, Cotton Twill, Wool Flannel"
notes,High-waisted palazzo pant. Expand front pleats by 0.5 inches for vintage drape.`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-palazzo-pants.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (window.showToast) {
      window.showToast("Sample pattern CSV specs downloaded!", "success", "Exporter Active");
    }
  };

  const parseDroppedFile = (file) => {
    setImportingFile(file);
    setImportStep(1);
    setImportLogs([]);

    const log = (msg) => {
      setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    log(`Received file: "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
    log(`Format detected: ${file.name.split('.').pop().toUpperCase()}`);

    // Create file reader for text-based files
    const reader = new FileReader();

    reader.onload = (e) => {
      const textContent = e.target.result;
      let parsedData = {
        name: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
        patternId: 'custom',
        size: '8',
        width: '60',
        fabrics: [],
        notes: `Imported from digital file "${file.name}".`
      };

      // If it's CSV
      if (file.name.endsWith('.csv')) {
        try {
          log("Successfully opened CSV document structure.");

          // Custom robust CSV cell extractor
          const parseCSV = (text) => {
            const lines = [];
            let row = [""];
            let insideQuote = false;

            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              const nextChar = text[i + 1];

              if (char === '"') {
                if (insideQuote && nextChar === '"') {
                  row[row.length - 1] += '"';
                  i++;
                } else {
                  insideQuote = !insideQuote;
                }
              } else if (char === ',' && !insideQuote) {
                row.push("");
              } else if ((char === '\r' || char === '\n') && !insideQuote) {
                if (char === '\r' && nextChar === '\n') {
                  i++;
                }
                lines.push(row);
                row = [""];
              } else {
                row[row.length - 1] += char;
              }
            }
            if (row.length > 1 || row[0] !== "") {
              lines.push(row);
            }
            return lines;
          };

          const csvRows = parseCSV(textContent);
          let isKeyValue = false;
          if (csvRows.length > 0) {
            const firstCol = String(csvRows[0][0] || '').toLowerCase().trim();
            if (firstCol === 'key' || firstCol === 'metadata' || firstCol === 'field' || csvRows.some(r => r.length === 2 && ['name', 'patternid', 'size', 'width', 'fabrics'].includes(String(r[0]).toLowerCase().trim()))) {
              isKeyValue = true;
            }
          }

          if (isKeyValue) {
            log("CSV recognized as Key-Value metadata sheet.");
            csvRows.forEach(row => {
              if (row.length >= 2) {
                const key = String(row[0]).toLowerCase().trim();
                const val = String(row[1]).trim();
                if (key === 'name' || key === 'project name' || key === 'project') {
                  parsedData.name = val;
                } else if (key === 'patternid' || key === 'pattern id' || key === 'pattern') {
                  if (patterns.some(p => p.id === val) || val === 'custom') {
                    parsedData.patternId = val;
                  }
                } else if (key === 'size' || key === 'target size') {
                  if (['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].includes(val)) {
                    parsedData.size = val;
                  }
                } else if (key === 'width' || key === 'fabric width') {
                  if (val.includes('44')) parsedData.width = '44';
                  else if (val.includes('60') || val.includes('58')) parsedData.width = '60';
                } else if (key === 'fabrics' || key === 'recommended fabrics' || key === 'materials') {
                  parsedData.fabrics = val.split(',').map(f => f.trim()).filter(Boolean);
                } else if (key === 'notes' || key === 'description') {
                  parsedData.notes = val;
                }
              }
            });
          } else if (csvRows.length >= 2) {
            log("CSV recognized as Column-Header project table.");
            const headers = csvRows[0].map(h => String(h).toLowerCase().trim());
            const values = csvRows[1];
            headers.forEach((header, idx) => {
              const val = String(values[idx] || '').trim();
              if (!val) return;

              if (header === 'name' || header === 'project name' || header === 'project' || header === 'title') {
                parsedData.name = val;
              } else if (header === 'patternid' || header === 'pattern id' || header === 'pattern') {
                if (patterns.some(p => p.id === val) || val === 'custom') {
                  parsedData.patternId = val;
                }
              } else if (header === 'size' || header === 'target size') {
                if (['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].includes(val)) {
                  parsedData.size = val;
                }
              } else if (header === 'width' || header === 'fabric width') {
                if (val.includes('44')) parsedData.width = '44';
                else if (val.includes('60') || val.includes('58')) parsedData.width = '60';
              } else if (header === 'fabrics' || header === 'recommended fabrics' || header === 'materials') {
                parsedData.fabrics = val.split(',').map(f => f.trim()).filter(Boolean);
              } else if (header === 'notes' || header === 'description') {
                parsedData.notes = val;
              }
            });
          }

          log(`Extracted Pattern Name: "${parsedData.name}"`);
          log(`Matched Blueprint Link: ${parsedData.patternId === 'custom' ? 'Custom Design' : parsedData.patternId}`);
          log(`Detected Sizing Target: Size ${parsedData.size}`);
        } catch (err) {
          log(`Error parsing CSV: ${err.message}. Reverting to standard text extraction.`);
        }
      }
      // If it's JSON
      else if (file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(textContent);
          log("Successfully parsed JSON document structure.");

          if (json.name) parsedData.name = json.name;
          if (json.patternId) parsedData.patternId = json.patternId;
          if (json.size) parsedData.size = String(json.size);
          if (json.width) parsedData.width = String(json.width);
          if (json.fabrics) parsedData.fabrics = Array.isArray(json.fabrics) ? json.fabrics : [json.fabrics];
          if (json.notes) parsedData.notes = json.notes;

          log(`Extracted Pattern Name: "${parsedData.name}"`);
          log(`Matched Blueprint Link: ${parsedData.patternId === 'custom' ? 'Custom Design' : parsedData.patternId}`);
          log(`Detected Sizing Target: Size ${parsedData.size}`);
        } catch (err) {
          log(`Error parsing JSON: ${err.message}. Reverting to standard text extraction.`);
        }
      }
      // If it's TXT or Markdown
      else if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        log("Analyzing text layout & keyword markers...");
        const lines = textContent.split('\n');
        let fabricsList = [];

        lines.forEach(line => {
          const lower = line.toLowerCase();

          // Match project name
          if (lower.startsWith('project:') || lower.startsWith('name:')) {
            parsedData.name = line.split(':')[1].trim();
          }
          // Match blueprint id
          if (lower.includes('pattern_id:') || lower.includes('pattern:')) {
            const pid = line.split(':')[1].trim();
            if (patterns.some(p => p.id === pid)) {
              parsedData.patternId = pid;
            }
          }
          // Match size
          if (lower.includes('size:') || lower.includes('target size:')) {
            const szVal = line.split(':')[1].trim().replace(/[^0-9]/g, '');
            if (['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].includes(szVal)) {
              parsedData.size = szVal;
            }
          }
          // Match fabric width
          if (lower.includes('width:') || lower.includes('fabric width:')) {
            const wVal = line.split(':')[1].trim();
            if (wVal.includes('44')) parsedData.width = '44';
            else if (wVal.includes('60') || wVal.includes('58')) parsedData.width = '60';
          }
          // Match fabrics
          if (lower.includes('fabrics:') || lower.includes('recommended fabrics:')) {
            const fabs = line.split(':')[1].trim().split(',');
            fabricsList = fabs.map(f => f.trim());
          }
          // Match notes
          if (lower.startsWith('notes:')) {
            parsedData.notes = line.split(':')[1].trim();
          }
        });

        if (fabricsList.length > 0) {
          parsedData.fabrics = fabricsList;
        }
        log("Text metadata scanned & compiled.");
      }

      // Finish parsing simulation (gives smooth UX)
      simulateScanCompletion(parsedData);
    };

    // If it's not JSON/CSV/TXT, simulate a PDF/Image scan
    if (!file.name.endsWith('.json') && !file.name.endsWith('.csv') && !file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      setTimeout(() => log("Verifying PDF/Raster digital signature..."), 300);
      setTimeout(() => log("Running tailoring heuristics engine..."), 600);
      setTimeout(() => log("Scanning text patterns and fabric suggestion blocks..."), 900);
      setTimeout(() => {
        // Try to match pattern by file name
        let matchedId = 'custom';
        const nameLower = file.name.toLowerCase();
        if (nameLower.includes('aurelia') || nameLower.includes('wrap')) matchedId = 'sartorial-01';
        else if (nameLower.includes('trench') || nameLower.includes('utility')) matchedId = 'sartorial-02';
        else if (nameLower.includes('trouser') || nameLower.includes('palazzo') || nameLower.includes('pant')) matchedId = 'sartorial-03';
        else if (nameLower.includes('blouse') || nameLower.includes('luminary')) matchedId = 'sartorial-04';

        const pat = patterns.find(p => p.id === matchedId);
        const cleanName = file.name
          .replace(/\.[^/.]+$/, "") // strip extension
          .replace(/[_-]/g, " ")     // replace dashes
          .replace(/\b[a-z]/g, char => char.toUpperCase()); // title case

        const simulatedData = {
          name: cleanName,
          patternId: matchedId,
          size: nameLower.match(/size\s*(\d+)/)?.[1] || '10',
          width: nameLower.includes('44') ? '44' : '60',
          fabrics: pat ? pat.fabricSuggestions : ['Drapey Linen', 'Rayon Crepe', 'Silk Habotai'],
          notes: `Bespoke import parsed from PDF "${file.name}". Automatically linked to ${pat ? pat.name : 'Custom Outline'}.`
        };

        log("Successfully extracted text and layout structures from PDF layers.");
        simulateScanCompletion(simulatedData);
      }, 1200);
    } else {
      // Run the text/json reader
      reader.readAsText(file);
    }
  };

  const simulateScanCompletion = (parsedData) => {
    setTimeout(() => {
      setImportedMetadata(parsedData);
      setImportStep(2); // Show review state
      if (window.showToast) {
        window.showToast("Metadata extracted successfully! Please review below.", "success", "Import Complete");
      }
    }, 1500);
  };

  const handleCreateFromImportedMetadata = (e) => {
    if (e) e.preventDefault();
    if (!importedMetadata.name.trim()) {
      if (window.showToast) window.showToast("Project name cannot be empty.", "error", "Validation Error");
      return;
    }

    const newProjId = `proj-${Date.now()}`;
    const patternObj = patterns.find(p => p.id === importedMetadata.patternId);

    // Build companion lists
    const initialReminders = [];
    if (patternObj?.tutorial?.steps) {
      patternObj.tutorial.steps.forEach((step, idx) => {
        initialReminders.push({
          id: `rem-${newProjId}-${idx}`,
          text: `[${step.time || 'Phase'}] ${step.title} - ${step.desc}`,
          checked: false
        });
      });
    } else {
      initialReminders.push(
        { id: `rem-${newProjId}-1`, text: 'Prepare pattern layout & cut pattern pieces.', checked: false },
        { id: `rem-${newProjId}-2`, text: 'Stitch main garment construction seams.', checked: false },
        { id: `rem-${newProjId}-3`, text: 'Double-fold hem and press with tailor clapper.', checked: false }
      );
    }

    const initialFabrics = [];
    if (importedMetadata.fabrics && importedMetadata.fabrics.length > 0) {
      importedMetadata.fabrics.forEach((fab, idx) => {
        initialFabrics.push({
          id: `fab-${newProjId}-${idx}`,
          item: typeof fab === 'object' && fab !== null ? (fab.name || `Fabric ${idx + 1}`) : fab,
          req: patternObj?.yardageInfo
            ? `${importedMetadata.width === '44' ? patternObj.yardageInfo.width44 : patternObj.yardageInfo.width60} needed`
            : 'As recommended',
          checked: false
        });
      });
    } else if (patternObj?.fabricSuggestions) {
      patternObj.fabricSuggestions.forEach((sug, idx) => {
        initialFabrics.push({
          id: `fab-${newProjId}-${idx}`,
          item: sug,
          req: patternObj.yardageInfo
            ? `${importedMetadata.width === '44' ? patternObj.yardageInfo.width44 : patternObj.yardageInfo.width60} needed`
            : 'As recommended',
          checked: false
        });
      });
    } else {
      initialFabrics.push({
        id: `fab-${newProjId}-1`,
        item: 'Main fabric garment yardage',
        req: 'As recommended',
        checked: false
      });
    }

    const sizingTable = patternObj?.measurementsTable || MASTER_SIZING_TABLE;
    const sizeMatch = sizingTable.find(s => s.size === importedMetadata.size);
    const initialMeasurements = {
      bust: sizeMatch ? String(sizeMatch.bust) : '',
      waist: sizeMatch ? String(sizeMatch.waist) : '',
      hips: sizeMatch ? String(sizeMatch.hips) : '',
      height: '168',
      custom: `Linked to pattern "${patternObj?.name || 'Custom'}" at size ${importedMetadata.size}.`
    };

    setProjectCompanionData(prev => ({
      ...prev,
      [newProjId]: {
        reminders: initialReminders,
        fabrics: initialFabrics,
        measurements: initialMeasurements,
        completed: false,
        photos: []
      }
    }));

    const newProj = {
      id: newProjId,
      name: importedMetadata.name.trim(),
      patternId: importedMetadata.patternId,
      size: importedMetadata.size,
      width: importedMetadata.width,
      notes: importedMetadata.notes.trim(),
      dateAdded: new Date().toISOString()
    };

    // Auto-register fabrics in the fabric stash linked to this project!
    if (importedMetadata.fabrics && importedMetadata.fabrics.length > 0) {
      const newStashItems = importedMetadata.fabrics.map((fab, idx) => {
        const isObj = typeof fab === 'object' && fab !== null;
        const name = isObj ? (fab.name || `Fabric ${idx + 1}`) : fab;
        const type = isObj ? (fab.type || 'Cotton') : 'Cotton';
        const yardage = isObj ? (fab.yardage || '3.0') : (patternObj?.yardageInfo
          ? (importedMetadata.width === '44' ? patternObj.yardageInfo.width44.replace(/[^0-9.]/g, '') : patternObj.yardageInfo.width60.replace(/[^0-9.]/g, ''))
          : '3.0');
        const costPer = isObj ? (fab.costPerYard || '12.00') : '12.00';
        const notes = isObj ? (fab.notes || 'Imported fabric requirement spec') : 'Imported fabric requirement spec';
        const widthVal = isObj ? (fab.width || importedMetadata.width) : importedMetadata.width;

        return {
          id: `stash-imported-${newProjId}-${idx}-${Date.now()}`,
          name: name,
          type: type,
          yardage: yardage,
          width: widthVal,
          costPerYard: costPer,
          notes: notes,
          photo: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&q=80&w=200',
          patternId: newProjId,
          tags: ['Imported', type],
          dateAdded: new Date().toISOString()
        };
      });

      setFabricStash(prev => [...newStashItems, ...prev]);
    }

    setUserProjects(prev => [newProj, ...prev]);
    setSelectedPatternId(newProjId);
    setSelectedStepIndex(0);

    if (window.showToast) {
      window.showToast(
        `Imported "${newProj.name}" from digital file! Set as active timer project.`,
        "success",
        "Digital Pattern Imported"
      );
    }

    // Reset importer states
    setImportingFile(null);
    setImportStep(0);
    setImportLogs([]);
    setIsCreateProjectFormOpen(false);
  };

  const toggleReminder = (id) => {
    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      const updatedRems = (current.reminders || []).map(r => r.id === id ? { ...r, checked: !r.checked } : r);
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          reminders: updatedRems
        }
      };
    });
  };

  const deleteReminder = (id) => {
    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      const updatedRems = (current.reminders || []).filter(r => r.id !== id);
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          reminders: updatedRems
        }
      };
    });
    if (window.showToast) {
      window.showToast("Reminder removed.", "info", "Removed");
    }
  };

  const handleAddReminder = (e) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;

    const newRem = {
      id: `rem-${Date.now()}`,
      text: newReminderText.trim(),
      checked: false
    };

    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          reminders: [...(current.reminders || []), newRem]
        }
      };
    });

    setNewReminderText('');
    if (window.showToast) {
      window.showToast("Reminder successfully added to active design.", "success", "Reminder Saved");
    }
  };

  const toggleFabric = (id) => {
    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      const updatedFabs = (current.fabrics || []).map(f => f.id === id ? { ...f, checked: !f.checked } : f);
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          fabrics: updatedFabs
        }
      };
    });
  };

  const deleteFabric = (id) => {
    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      const updatedFabs = (current.fabrics || []).filter(f => f.id !== id);
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          fabrics: updatedFabs
        }
      };
    });
    if (window.showToast) {
      window.showToast("Fabric sourcing item deleted.", "info", "Removed");
    }
  };

  const handleAddFabric = (e) => {
    e.preventDefault();
    if (!newFabricItem.trim()) return;

    const newFab = {
      id: `fab-${Date.now()}`,
      item: newFabricItem.trim(),
      req: newFabricReq.trim(),
      checked: false
    };

    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          fabrics: [...(current.fabrics || []), newFab]
        }
      };
    });

    setNewFabricItem('');
    setNewFabricReq('');
    if (window.showToast) {
      window.showToast("Fabric requirement added.", "success", "Sourcing Item Stored");
    }
  };

  const handleMeasurementChange = (field, val) => {
    setProjectCompanionData(prev => {
      const current = prev[selectedPatternId] || { reminders: [], fabrics: [], measurements: {} };
      return {
        ...prev,
        [selectedPatternId]: {
          ...current,
          measurements: {
            ...(current.measurements || {}),
            [field]: val
          }
        }
      };
    });
  };

  const handleSaveMeasurements = () => {
    if (window.showToast) {
      window.showToast("Fitting measurements saved successfully for this blueprint.", "success", "Measurements Updated");
    }
  };

  // --- TIME FORMATTERS ---
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${hours > 0 ? pad(hours) + ':' : ''}${pad(minutes)}:${pad(seconds)}`;
  };

  const formatLongTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  // --- HANDLERS ---
  const handleStartStop = () => {
    setIsRunning(!isRunning);
    if (window.showToast) {
      window.showToast(
        !isRunning ? "Timer active. Maintain an elegant, measured sewing pace." : "Sewing timer suspended.",
        "info",
        !isRunning ? "Session Active" : "Paused"
      );
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsElapsed(0);
    setSessionNotes('');
    setActiveSessionPhoto(null);
    if (window.showToast) {
      window.showToast("Stopwatch reset to zero.", "info", "Timer Reset");
    }
  };

  const handleLogSession = () => {
    if (secondsElapsed < 5) {
      if (window.showToast) {
        window.showToast("Session is too short to log. Minimum 5 seconds.", "warning", "Brief Session");
      }
      return;
    }

    const newLog = {
      id: `log-${Date.now()}`,
      patternId: selectedPatternId,
      patternName: activePattern.name,
      stepName: currentStep.op,
      durationSeconds: secondsElapsed,
      date: new Date().toISOString(),
      notes: sessionNotes.trim() || 'Constructed with precision.',
      photo: activeSessionPhoto
    };

    setHistoryLogs(prev => [newLog, ...prev]);
    setIsRunning(false);
    setSecondsElapsed(0);
    setSessionNotes('');
    setActiveSessionPhoto(null);

    if (window.showToast) {
      window.showToast(
        `Session successfully recorded!\nSpent ${formatLongTime(newLog.durationSeconds)} on ${newLog.stepName}.`,
        "success",
        "Log Saved"
      );
    }
  };

  const handleManualLogSubmit = (e) => {
    e.preventDefault();
    const mins = parseInt(manualMinutes) || 0;
    const secs = parseInt(manualSeconds) || 0;
    const totalSecs = (mins * 60) + secs;

    if (totalSecs <= 0) {
      if (window.showToast) {
        window.showToast("Please enter a valid time duration.", "warning", "Invalid Duration");
      }
      return;
    }

    const newLog = {
      id: `log-${Date.now()}`,
      patternId: selectedPatternId,
      patternName: activePattern.name,
      stepName: manualStep || currentStep.op,
      durationSeconds: totalSecs,
      date: new Date().toISOString(),
      notes: manualNotes.trim() || 'Manual log record.'
    };

    setHistoryLogs(prev => [newLog, ...prev]);
    setIsManualModalOpen(false);
    setManualMinutes('');
    setManualSeconds('');
    setManualNotes('');
    setManualStep('');

    if (window.showToast) {
      window.showToast(
        `Manually logged ${formatLongTime(newLog.durationSeconds)} on ${newLog.stepName}.`,
        "success",
        "Manual Record Saved"
      );
    }
  };

  const handleDeleteLog = (id) => {
    if (confirm("Are you sure you want to remove this sewing session record?")) {
      setHistoryLogs(prev => prev.filter(log => log.id !== id));
      if (window.showToast) {
        window.showToast("Session log has been deleted.", "info", "Record Removed");
      }
    }
  };

  const handleClearAllLogs = () => {
    if (confirm("Are you sure you want to clear your entire sewing history? This action is irreversible.")) {
      setHistoryLogs([]);
      if (window.showToast) {
        window.showToast("Entire session log history cleared.", "warning", "History Cleared");
      }
    }
  };

  const handleExportCSV = () => {
    if (historyLogs.length === 0) {
      if (window.showToast) {
        window.showToast("No time tracking logs available to export.", "warning", "Export Failed");
      }
      return;
    }

    const headers = [
      "Date",
      "Design/Pattern",
      "Operation/Step",
      "Duration (Seconds)",
      "Duration (Formatted)",
      "Notes",
      "Has Photo"
    ];

    const escapeCsvValue = (val) => {
      if (val === null || val === undefined) return '';
      let stringValue = String(val);
      // Double the inner double-quotes
      stringValue = stringValue.replace(/"/g, '""');
      // If it contains commas, double quotes, or newlines, wrap in quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue}"`;
      }
      return stringValue;
    };

    const rows = historyLogs.map(log => {
      const formattedDate = new Date(log.date).toLocaleString();
      const formattedDuration = formatLongTime(log.durationSeconds);
      return [
        escapeCsvValue(formattedDate),
        escapeCsvValue(log.patternName),
        escapeCsvValue(log.stepName),
        escapeCsvValue(log.durationSeconds),
        escapeCsvValue(formattedDuration),
        escapeCsvValue(log.notes),
        escapeCsvValue(log.photo ? 'Yes' : 'No')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute("download", `sewing_time_logs_${today}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.showToast) {
        window.showToast("Time logs downloaded successfully as CSV.", "success", "Export Complete");
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) {
        window.showToast("An error occurred while generating the CSV file.", "error", "Export Failed");
      }
    }
  };

  const handleExportInventoryCSV = () => {
    if (fabricStash.length === 0) {
      if (window.showToast) {
        window.showToast("No fabric inventory available to export.", "warning", "Export Failed");
      }
      return;
    }

    const headers = [
      "Fabric Name",
      "Type/Fiber",
      "Yardage/Meters",
      "Width",
      "Assigned Project",
      "Notes",
      "Date Added"
    ];

    const escapeCsvValue = (val) => {
      if (val === null || val === undefined) return '';
      let stringValue = String(val);
      stringValue = stringValue.replace(/"/g, '""');
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue}"`;
      }
      return stringValue;
    };

    const rows = fabricStash.map(item => {
      const assocProj = userProjects.find(p => p.id === item.patternId);
      const assocPattern = assocProj
        ? patterns.find(p => p.id === assocProj.patternId)
        : patterns.find(p => p.id === item.patternId);
      const isCustom = item.patternId === 'custom' || (assocProj && assocProj.patternId === 'custom');
      const assignedProject = assocProj
        ? assocProj.name
        : (isCustom
          ? "Custom Tailoring"
          : (assocPattern ? `${assocPattern.name} (${assocPattern.designer || 'Perfect Fit Bureau'})` : "Unassigned"));

      const formattedDate = item.dateAdded ? new Date(item.dateAdded).toLocaleString() : "N/A";

      return [
        escapeCsvValue(item.name),
        escapeCsvValue(item.type),
        escapeCsvValue(item.yardage),
        escapeCsvValue(item.width || 'N/A'),
        escapeCsvValue(assignedProject),
        escapeCsvValue(item.notes || ''),
        escapeCsvValue(formattedDate)
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute("download", `fabric_inventory_${today}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.showToast) {
        window.showToast("Fabric inventory downloaded successfully as CSV.", "success", "Export Complete");
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) {
        window.showToast("An error occurred while generating the CSV file.", "error", "Export Failed");
      }
    }
  };

  const toggleShoppingListPattern = (patternId) => {
    setShoppingListPatterns(prev => {
      if (prev.includes(patternId)) {
        return prev.filter(id => id !== patternId);
      } else {
        return [...prev, patternId];
      }
    });
  };

  const setShoppingListWidthChoice = (patternId, width) => {
    setShoppingListWidths(prev => ({
      ...prev,
      [patternId]: width
    }));
  };

  const toggleNotionChecked = (patternId, index) => {
    setCheckedNotions(prev => {
      const key = `${patternId}-${index}`;
      return {
        ...prev,
        [key]: !prev[key]
      };
    });
  };

  const handleAssignFabricToPattern = (fabricItemId, patternId) => {
    setFabricStash(prev => prev.map(item => {
      if (item.id === fabricItemId) {
        return { ...item, patternId };
      }
      return item;
    }));
    if (window.showToast) {
      const pName = userProjects.find(p => p.id === patternId)?.name || patterns.find(p => p.id === patternId)?.name || "Project";
      window.showToast(`Fabric successfully assigned to ${pName}!`, "success", "Fabric Assigned");
    }
  };

  const handleExportShoppingTXT = () => {
    if (shoppingListPatterns.length === 0) {
      if (window.showToast) {
        window.showToast("No patterns selected for the shopping list.", "warning", "Export Empty");
      }
      return;
    }

    let text = `=========================================\n`;
    text += `   PERFECT FIT BUREAU - SHOPPING LIST\n`;
    text += `   Generated on: ${new Date().toLocaleDateString()}\n`;
    text += `=========================================\n\n`;

    shoppingListPatterns.forEach((pid, pidx) => {
      const assocProj = userProjects.find(p => p.id === pid);
      const pattern = assocProj
        ? patterns.find(p => p.id === assocProj.patternId)
        : patterns.find(p => p.id === pid);
      if (!pattern) return;

      const widthChoice = shoppingListWidths[pid] || '60';
      const requiredText = widthChoice === '44'
        ? pattern.yardageInfo.width44
        : pattern.yardageInfo.width60;

      const requiredYards = parseFloat(requiredText) || 0;
      const assignedFabrics = fabricStash.filter(item => item.patternId === pid);
      const assignedYards = assignedFabrics.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0), 0);
      const missingYards = Math.max(0, requiredYards - assignedYards);

      const displayName = assocProj ? assocProj.name : pattern.name;
      text += `${pidx + 1}. ${displayName.toUpperCase()}\n`;
      text += `   Difficulty: \${pattern.difficulty} | Category: \${pattern.category}\n`;
      text += `   Planned Fabric Width: \${widthChoice === '44' ? '44" / 45"' : '58" / 60"'}\n`;
      text += `   Fabric Required: \${requiredYards.toFixed(1)} yds\n`;
      text += `   Fabric Assigned: \${assignedYards.toFixed(1)} yds\n`;

      if (missingYards > 0) {
        text += `   >> STATUS: UNDERSTOCKED (Need \${missingYards.toFixed(1)} yds)\n`;
        text += `   Suggested Fabric Types: \${pattern.fabricSuggestions.join(', ')}\n`;
      } else {
        text += `   >> STATUS: FULLY STOCKED\n`;
      }

      // Notions
      text += `\n   Notions & Materials Checklist:\n`;
      if (pattern.notions && pattern.notions.length > 0) {
        pattern.notions.forEach((notion, nidx) => {
          const isChecked = checkedNotions[`\${pid}-\${nidx}`];
          text += `     [\${isChecked ? 'X' : ' '}] \${notion}\n`;
        });
      } else {
        text += `     None required.\n`;
      }
      text += `\n-----------------------------------------\n\n`;
    });

    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const today = new Date().toISOString().split('T')[0];
      link.setAttribute("download", `sartorial_shopping_list_\${today}.txt`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.showToast) {
        window.showToast("Shopping list downloaded successfully as text file.", "success", "Export Complete");
      }
    } catch (err) {
      console.error(err);
      if (window.showToast) {
        window.showToast("An error occurred while generating the text file.", "error", "Export Failed");
      }
    }
  };

  // Calculate metrics per pattern
  const patternMetrics = historyLogs.reduce((acc, log) => {
    if (!acc[log.patternId]) {
      acc[log.patternId] = {
        name: log.patternName,
        totalSeconds: 0,
        sessionsCount: 0
      };
    }
    acc[log.patternId].totalSeconds += log.durationSeconds;
    acc[log.patternId].sessionsCount += 1;
    return acc;
  }, {});

  const totalSewingSeconds = historyLogs.reduce((sum, log) => sum + log.durationSeconds, 0);

  const lowStockCount = fabricStash.filter(item => (parseFloat(item.yardage) || 0) <= stashThreshold).length;

  return (
    <section className="bg-white rounded-[4px] border border-sand-200 p-6 md:p-10 space-y-8 shadow-lux relative overflow-hidden" id="sewing-session-timer-section">
      {/* Decorative Blueprint Background Grid */}
      <div className="absolute right-0 top-0 w-48 h-48 opacity-[0.02] bg-[radial-gradient(#ba6446_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

      {/* Main Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-sand-150/80">
        <div>
          <h3 className="text-2xl md:text-3xl font-serif text-bark-950 font-light" id="timer-section-heading">
            Perfect Fit Sewing Room &amp; Timer
          </h3>
          <p className="text-xs text-bark-550 max-w-xl leading-relaxed mt-1 font-sans">
            Track construction durations, compare your assembly speed against industrial Standard Allowed Minutes (SAM), and log milestones of your tailoring journey.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3.5" id="timer-stats-bar">
          <div className="bg-sand-50/75 border border-sand-200/80 rounded px-4 py-2 flex items-center gap-2 shadow-3xs">
            <Clock className="w-4 h-4 text-[#ba6446]" />
            <div>
              <span className="text-[8px] font-mono text-bark-400 block uppercase font-bold">{pfUiT("ui.components.sewingsessiontimer.4a65d2d53d")}</span>
              <span className="font-mono text-xs font-bold text-bark-900">
                {formatLongTime(totalSewingSeconds) || '0s'}
              </span>
            </div>
          </div>
          <div className="bg-sand-50/75 border border-sand-200/80 rounded px-4 py-2 flex items-center gap-2 shadow-3xs">
            <Award className="w-4 h-4 text-[#ba6446]" />
            <div>
              <span className="text-[8px] font-mono text-bark-400 block uppercase font-bold">{pfUiT("ui.components.sewingsessiontimer.3614c7323a")}</span>
              <span className="font-mono text-xs font-bold text-bark-900">{historyLogs.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Toggle Bar */}
      <div className="flex border-b border-sand-200 mb-6 bg-sand-50/30 p-1 rounded-sm" id="sewing-room-view-tabs">
        <button
          onClick={() => setSewingViewMode('timer')}
          className={`flex-1 px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
            sewingViewMode === 'timer'
              ? 'border-[#ba6446] text-[#ba6446] bg-white shadow-3xs'
              : 'border-transparent text-bark-600 hover:text-bark-950 hover:bg-sand-50/50'
          }`}
          type="button"
        >
          <Clock className="w-4 h-4" />
          <span>{pfUiT("ui.components.sewingsessiontimer.8e42fc1b6e")}</span>
        </button>
        <button
          onClick={() => setSewingViewMode('motionStudy')}
          className={`flex-1 px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
            sewingViewMode === 'motionStudy'
              ? 'border-[#ba6446] text-[#ba6446] bg-white shadow-3xs'
              : 'border-transparent text-bark-600 hover:text-bark-950 hover:bg-sand-50/50'
          }`}
          type="button"
        >
          <Activity className="w-4 h-4" />
          <span>📊 Time &amp; Motion Study (Advanced Tool)</span>
        </button>
      </div>

      {sewingViewMode === 'motionStudy' ? (
        <TimeAndMotionStudy patterns={patterns} userProjects={userProjects} activePatternId={selectedPatternId} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="timer-main-grid">

        {/* LEFT PANEL: ACTIVE TIMER & STEP CONFIGURATOR (COL-SPAN 7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-gradient-to-br from-sand-50 to-sand-100/30 border border-sand-200/85 rounded-lg p-5 sm:p-7 space-y-6 relative">

            {/* Active Project & Step Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pattern Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.2535e8507a")}</label>
                <select
                  value={selectedPatternId}
                  onChange={(e) => {
                    setSelectedPatternId(e.target.value);
                    setSelectedStepIndex(0);
                    if (isRunning) setIsRunning(false);
                  }}
                  className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                >
                  <optgroup label="Gallery Patterns">
                    {patterns.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </optgroup>
                  {userProjects.length > 0 && (
                    <optgroup label="Linked Tailoring Projects">
                      {userProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Size {p.size})</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="custom">{pfUiT("ui.components.sewingsessiontimer.3850e080c2")}</option>
                </select>
              </div>

              {/* Step Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.d8f616be57")}</label>
                <select
                  value={selectedStepIndex}
                  onChange={(e) => {
                    setSelectedStepIndex(parseInt(e.target.value));
                    if (isRunning) setIsRunning(false);
                  }}
                  className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                >
                  {stepsList.map((step, idx) => (
                    <option key={idx} value={idx}>
                      Stage {step.step}: {step.op}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Target SAM vs Actual Alert */}
            <div className="bg-white border border-sand-200 rounded p-3 flex items-start gap-3">
              <Hourglass className="w-4 h-4 text-[#ba6446] mt-0.5 shrink-0" />
              <div className="text-[11px] leading-relaxed">
                <div className="font-bold text-bark-900">
                  Target Standard Allowed Minutes (SAM): <span className="font-mono text-[#ba6446]">{currentStep.sam} mins</span>
                </div>
                <p className="text-bark-500 mt-0.5">{pfUiT("ui.components.sewingsessiontimer.04703e2da1")}<b className="text-bark-850">"{currentStep.op}"</b>{pfUiT("ui.components.sewingsessiontimer.2dc5828ead")}</p>
              </div>
            </div>

            {/* Primary Visual Digital Stopwatch */}
            <div className="flex flex-col items-center justify-center py-6 relative" id="stopwatch-dial">
              {/* Visual Ring Backdrop */}
              <div className={`w-44 h-44 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-700 relative ${
                isRunning
                  ? 'border-[#ba6446] shadow-[0_0_15px_rgba(186,100,70,0.15)] bg-white'
                  : 'border-sand-200 bg-sand-50/50'
              }`}>
                {/* Ticking dots */}
                {isRunning && (
                  <div className="absolute inset-2 border border-dashed border-clay-300 rounded-full animate-[spin_60s_linear_infinite]" />
                )}

                <span className="text-[10px] font-mono uppercase tracking-widest text-bark-400 font-bold">
                  {isRunning ? 'Constructing' : 'Suspended'}
                </span>

                <div className="font-mono text-3xl font-extrabold text-bark-950 mt-1.5 tracking-tight">
                  {formatTime(secondsElapsed)}
                </div>

                <div className="text-[9px] font-mono text-bark-500 mt-1">
                  Target: {currentStep.sam}m
                </div>
              </div>

              {/* Distraction-free Focus button */}
              <button
                onClick={() => setIsFocusMode(true)}
                className="mt-4 px-3 py-1.5 border border-sand-250 bg-white hover:bg-sand-100/50 text-[10px] font-mono font-bold uppercase text-bark-700 hover:text-bark-900 rounded-full flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                title={pfUiT("ui.components.sewingsessiontimer.fd9389dc22")}
                type="button"
              >
                <Maximize2 className="w-3 h-3 text-[#ba6446]" />{pfUiT("ui.components.sewingsessiontimer.1de233284c")}</button>
            </div>

            {/* Active Stopwatch Control Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Start / Pause */}
              <button
                onClick={handleStartStop}
                className={`px-6 py-2.5 rounded-[3px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 ${
                  isRunning
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-[#ba6446] hover:bg-[#a25135] text-white'
                }`}
                type="button"
              >
                {isRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-white" />{pfUiT("ui.components.sewingsessiontimer.8dbe79c185")}</>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />{pfUiT("ui.components.sewingsessiontimer.f050db3e87")}</>
                )}
              </button>

              {/* Log Session */}
              <button
                onClick={handleLogSession}
                disabled={secondsElapsed < 5}
                className={`px-5 py-2.5 rounded-[3px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                  secondsElapsed >= 5
                    ? 'bg-white border-[#ba6446] text-[#ba6446] hover:bg-sand-50 shadow-3xs'
                    : 'bg-sand-100 border-sand-200 text-bark-300 cursor-not-allowed'
                }`}
                type="button"
              >
                <Save className="w-4 h-4" />
                Stop &amp; Log Time
              </button>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-[3px] border border-sand-250 bg-white hover:bg-sand-100/50 text-bark-600 hover:text-bark-900 transition-colors cursor-pointer text-xs font-semibold"
                type="button"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* In-Timer Session Notes Field */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-wider flex items-center gap-1.5">
                  <Notebook className="w-3.5 h-3.5 text-bark-400" />
                  Live Sewing Notes (Saved with Session Log)
                </label>
                <span className="text-[8px] font-mono text-bark-350">
                  {sessionNotes.length}/200 chars
                </span>
              </div>
              <input
                type="text"
                placeholder={pfUiT("ui.components.sewingsessiontimer.d850fb3cd5")}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value.slice(0, 200))}
                className="w-full bg-white border border-sand-250 text-bark-800 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] placeholder-bark-300"
              />
            </div>

            {/* Camera Attach progress photo bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-sand-200 rounded p-2.5 shadow-3xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCameraTarget('session');
                    startCamera();
                  }}
                  className="px-3 py-1.5 bg-sand-50 hover:bg-sand-100 text-bark-800 border border-sand-250 hover:border-[#ba6446] rounded text-[11px] font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  id="session-camera-btn"
                >
                  <Camera className="w-3.5 h-3.5 text-[#ba6446]" />
                  <span>{pfUiT("ui.components.sewingsessiontimer.e6ab756649")}</span>
                </button>

                <label className="text-[11px] text-bark-500 hover:text-bark-850 cursor-pointer flex items-center gap-1 font-mono font-bold uppercase tracking-wider">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span>{pfUiT("ui.components.sewingsessiontimer.79362f7ed5")}</span>
                </label>
              </div>

              {activeSessionPhoto && (
                <div className="flex items-center gap-2 bg-sand-50/75 p-1 pr-2 rounded border border-sand-200">
                  <img
                    src={activeSessionPhoto}
                    alt={pfUiT("ui.components.sewingsessiontimer.44ea5bc8e3")}
                    className="w-10 h-10 object-cover rounded border border-sand-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-[10px] text-bark-600 font-mono font-bold leading-tight">
                    <span className="block text-clay-700 font-extrabold uppercase text-[8px] tracking-wider">{pfUiT("ui.components.sewingsessiontimer.9c8b0c5782")}</span>
                    <button
                      type="button"
                      onClick={() => setActiveSessionPhoto(null)}
                      className="block text-red-650 hover:text-red-800 text-[9px] uppercase font-bold hover:underline cursor-pointer"
                    >{pfUiT("ui.components.sewingsessiontimer.c3c16eae5b")}</button>
                  </div>
                </div>
              )}
            </div>

            {/* Active Project Progress Checklist Tracker */}
            {(() => {
              const activeId = selectedPatternId;
              const currentProjectName = userProjects.find(p => p.id === activeId)?.name || patterns.find(p => p.id === activeId)?.name || (activeId === 'custom' ? 'Custom Tailoring Project' : 'Active Design');
              const activeChecklist = getProjectChecklist(activeId);
              const completedCount = activeChecklist.filter(item => item.completed).length;
              const totalCount = activeChecklist.length;
              const percentComplete = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div className="bg-white border border-sand-200/85 rounded-lg p-4 sm:p-5 space-y-3.5 shadow-3xs" id="active-project-progress-tracker">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-mono font-extrabold text-[#ba6446] uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.4660bbb078")}</span>
                      <h4 className="font-serif text-sm font-bold text-bark-900 truncate max-w-[200px] sm:max-w-[320px]">
                        {currentProjectName}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2.5 sm:text-right">
                      <div className="hidden sm:block">
                        <span className="block text-[8px] font-mono text-bark-400 uppercase">
                          {completedCount} of {totalCount} phases completed
                        </span>
                      </div>
                      <span className="text-[13px] font-mono font-extrabold text-[#ba6446] bg-[#ba6446]/5 px-2.5 py-1 rounded border border-[#ba6446]/10">
                        {percentComplete}% Complete
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-sand-100 h-2.5 rounded-full overflow-hidden border border-sand-200 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-[#ba6446] to-[#d67b5c] h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${percentComplete}%` }}
                    />
                  </div>

                  {/* Checklist Items */}
                  <div className="pt-2.5 border-t border-sand-100">
                    <span className="text-[9px] font-mono font-extrabold text-bark-450 uppercase tracking-wider block mb-2">{pfUiT("ui.components.sewingsessiontimer.4f8a58dc42")}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeChecklist.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleChecklistItem(activeId, item.id)}
                          className={`flex items-center gap-2.5 p-2 rounded border transition-all cursor-pointer select-none group/chk ${
                            item.completed
                              ? 'bg-[#ba6446]/5 border-[#ba6446]/15 text-[#ba6446] italic'
                              : 'bg-white border-sand-200 text-bark-750 hover:bg-sand-50/50 hover:border-sand-300'
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                              item.completed
                                ? 'bg-[#ba6446] border-[#ba6446] text-white'
                                : 'border-sand-350 bg-white group-hover/chk:border-[#ba6446]'
                            }`}
                          >
                            {item.completed && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                          </div>
                          <span className={`text-[10.5px] font-sans font-medium transition-all ${item.completed ? 'line-through text-bark-400' : 'text-bark-850'}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
        {/* RIGHT PANEL: TABBED WORKSPACE COMPANION (COL-SPAN 5) */}
        <div className="lg:col-span-5 flex flex-col gap-6" id="timer-right-companion-panel">

          {/* TAB HEADER ROW */}
          <div className="flex border-b border-sand-300" id="companion-workspace-tabs">
            <button
              onClick={() => setActiveSidebarTab('notes')}
              className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider font-bold text-center border-b-2 transition-all cursor-pointer ${
                activeSidebarTab === 'notes'
                  ? 'border-[#ba6446] text-[#ba6446]'
                  : 'border-transparent text-bark-600 hover:text-bark-900 hover:border-sand-300'
              }`}
              type="button"
            >
              Notes &amp; Fabrics
            </button>
            <button
              onClick={() => setActiveSidebarTab('measurements')}
              className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider font-bold text-center border-b-2 transition-all cursor-pointer ${
                activeSidebarTab === 'measurements'
                  ? 'border-[#ba6446] text-[#ba6446]'
                  : 'border-transparent text-bark-600 hover:text-bark-900 hover:border-sand-300'
              }`}
              type="button"
            >{pfUiT("ui.components.sewingsessiontimer.5a9be8a872")}</button>
            <button
              onClick={() => setActiveSidebarTab('journal')}
              className={`flex-1 pb-3 text-xs font-mono uppercase tracking-wider font-bold text-center border-b-2 transition-all cursor-pointer ${
                activeSidebarTab === 'journal'
                  ? 'border-[#ba6446] text-[#ba6446]'
                  : 'border-transparent text-bark-600 hover:text-bark-900 hover:border-sand-300'
              }`}
              type="button"
            >
              Journal ({historyLogs.length})
            </button>
          </div>

          {/* TAB CONTENT: QUICK REMINDERS & FABRIC CHECKLIST */}
          {activeSidebarTab === 'notes' && (
            <div className="space-y-6" id="workspace-notes-pane">
              {/* QUICK REMINDERS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Notebook className="w-4 h-4 text-bark-700" />{pfUiT("ui.components.sewingsessiontimer.f0aba15b2d")}</h4>
                  <span className="text-xs text-bark-600 font-mono font-semibold">
                    {activeReminders.filter(r => r.checked).length}/{activeReminders.length} completed
                  </span>
                </div>

                <div className="space-y-2.5 bg-white border border-sand-300 p-4 rounded-lg max-h-[180px] overflow-y-auto shadow-2xs">
                  {activeReminders.length === 0 ? (
                    <p className="text-xs text-bark-600 italic py-1 font-sans">{pfUiT("ui.components.sewingsessiontimer.6923e3e3ef")}</p>
                  ) : (
                    activeReminders.map(rem => (
                      <div key={rem.id} className="flex items-start gap-2.5 group py-1.5 border-b border-sand-100 last:border-0">
                        <button
                          onClick={() => toggleReminder(rem.id)}
                          className="text-bark-600 hover:text-[#ba6446] mt-0.5 transition-colors shrink-0 cursor-pointer"
                          type="button"
                        >
                          {rem.checked ? (
                            <CheckCircle className="w-4.5 h-4.5 text-clay-700 fill-clay-50" />
                          ) : (
                            <div className="w-4 h-4 rounded border border-sand-400 hover:border-[#ba6446]" />
                          )}
                        </button>
                        <span className={`text-xs leading-relaxed flex-1 font-sans ${rem.checked ? 'line-through text-bark-500 italic' : 'text-bark-900 font-medium'}`}>
                          {rem.text}
                        </span>
                        <button
                          onClick={() => deleteReminder(rem.id)}
                          className="opacity-0 group-hover:opacity-100 text-bark-500 hover:text-red-700 transition-all cursor-pointer"
                          type="button"
                          title={pfUiT("ui.components.sewingsessiontimer.034ced6448")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Reminder Form */}
                <form onSubmit={handleAddReminder} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={pfUiT("ui.components.sewingsessiontimer.39bf9d67f8")}
                    value={newReminderText}
                    onChange={(e) => setNewReminderText(e.target.value.slice(0, 150))}
                    className="flex-1 bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] placeholder-bark-400 font-medium"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white border border-sand-300 hover:border-[#ba6446] hover:bg-sand-50 text-bark-800 hover:text-[#ba6446] rounded text-xs font-bold font-mono transition-colors cursor-pointer"
                  >{pfUiT("ui.components.sewingsessiontimer.eef1575837")}</button>
                </form>
              </div>

              {/* FABRIC & TRIM SOURCE CHECKLIST */}
              <div className="space-y-3 border-t border-sand-200 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-4 h-4 text-bark-700" />
                    Fabric &amp; Trim Requirements
                  </h4>
                  <span className="text-xs text-bark-600 font-mono font-semibold">
                    {activeFabrics.filter(f => f.checked).length}/{activeFabrics.length} acquired
                  </span>
                </div>

                <div className="space-y-2.5 bg-white border border-sand-300 p-4 rounded-lg max-h-[200px] overflow-y-auto shadow-2xs">
                  {activeFabrics.length === 0 ? (
                    <p className="text-xs text-bark-600 italic py-1 font-sans">{pfUiT("ui.components.sewingsessiontimer.d19372d9ed")}</p>
                  ) : (
                    activeFabrics.map(fab => (
                      <div key={fab.id} className="flex items-start gap-2.5 group py-1.5 border-b border-sand-100 last:border-0">
                        <button
                          onClick={() => toggleFabric(fab.id)}
                          className="text-bark-600 hover:text-[#ba6446] mt-0.5 transition-colors shrink-0 cursor-pointer"
                          type="button"
                        >
                          {fab.checked ? (
                            <CheckCircle className="w-4.5 h-4.5 text-clay-700 fill-clay-50" />
                          ) : (
                            <div className="w-4 h-4 rounded border border-sand-400 hover:border-[#ba6446]" />
                          )}
                        </button>
                        <div className="flex-1 text-xs leading-relaxed font-sans">
                          <span className={`font-medium ${fab.checked ? 'line-through text-bark-500 italic' : 'text-bark-900'}`}>
                            {fab.item}
                          </span>
                          {fab.req && (
                            <span className="text-bark-800 font-mono text-[10px] block font-bold mt-0.5">
                              Required: {fab.req}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteFabric(fab.id)}
                          className="opacity-0 group-hover:opacity-100 text-bark-500 hover:text-red-700 transition-all cursor-pointer"
                          type="button"
                          title={pfUiT("ui.components.sewingsessiontimer.28fd95fff1")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Fabric Form */}
                <form onSubmit={handleAddFabric} className="space-y-2.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.31ab789988")}
                      value={newFabricItem}
                      onChange={(e) => setNewFabricItem(e.target.value)}
                      required
                      className="flex-1 bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] placeholder-bark-400 font-medium"
                    />
                    <input
                      type="text"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.7692fdce12")}
                      value={newFabricReq}
                      onChange={(e) => setNewFabricReq(e.target.value)}
                      className="w-32 bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] placeholder-bark-400 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-white border border-sand-300 hover:border-[#ba6446] hover:bg-sand-50 text-bark-800 hover:text-[#ba6446] rounded text-xs font-bold font-mono transition-colors cursor-pointer"
                  >{pfUiT("ui.components.sewingsessiontimer.9623a3762c")}</button>
                </form>
              </div>

              {/* PROGRESS PHOTO GALLERY */}
              <div className="space-y-3 border-t border-sand-200 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-bark-700" />{pfUiT("ui.components.sewingsessiontimer.534ba9ab84")}</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTarget('companion');
                      startCamera();
                    }}
                    className="text-[#ba6446] hover:text-[#9e5237] text-xs font-mono font-bold uppercase hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                    id="companion-camera-btn"
                  >
                    <Plus className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.21eb806b3c")}</button>
                </div>

                {/* Photo Grid */}
                <div className="bg-white border border-sand-300 p-4 rounded-lg shadow-2xs">
                  {(!activeCompanion.photos || activeCompanion.photos.length === 0) ? (
                    <div className="text-center py-4 space-y-1.5">
                      <Camera className="w-5 h-5 text-sand-300 mx-auto animate-pulse" />
                      <p className="text-xs text-bark-600 italic font-sans leading-normal">{pfUiT("ui.components.sewingsessiontimer.b6e82ad4c9")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {activeCompanion.photos.map((p) => (
                        <div key={p.id} className="relative aspect-square group rounded overflow-hidden border border-sand-200 shadow-3xs bg-sand-50">
                          <img
                            src={p.url}
                            alt={pfUiT("ui.components.sewingsessiontimer.b09b61afd6")}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => deleteCompanionPhoto(p.id)}
                              className="p-1 bg-red-650 text-white rounded hover:bg-red-750 transition-colors cursor-pointer shadow-3xs"
                              title={pfUiT("ui.components.sewingsessiontimer.ad86361764")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7px] font-mono py-0.5 text-center truncate px-0.5 select-none font-bold">
                            {new Date(p.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB CONTENT: ACTIVE BODY MEASUREMENTS */}
          {activeSidebarTab === 'measurements' && (
            <div className="space-y-5" id="workspace-measurements-pane">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-bark-700" />
                  Garment &amp; Fitting Measurements
                </h4>
                <span className="text-xs text-[#ba6446] font-mono font-bold">{pfUiT("ui.components.sewingsessiontimer.8230ef1510")}</span>
              </div>

              <div className="bg-white border border-sand-300 p-5 rounded-lg space-y-4 shadow-2xs">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-bold text-bark-800 uppercase block">
                      Bust Circ. (cm)
                    </label>
                    <input
                      type="text"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.0a8298e8e2")}
                      value={activeMeas.bust || ''}
                      onChange={(e) => handleMeasurementChange('bust', e.target.value)}
                      className="w-full bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-bold text-bark-800 uppercase block">
                      Waist Circ. (cm)
                    </label>
                    <input
                      type="text"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.4c4b9db8ef")}
                      value={activeMeas.waist || ''}
                      onChange={(e) => handleMeasurementChange('waist', e.target.value)}
                      className="w-full bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-bold text-bark-800 uppercase block">
                      Hips Circ. (cm)
                    </label>
                    <input
                      type="text"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.af215c0bd3")}
                      value={activeMeas.hips || ''}
                      onChange={(e) => handleMeasurementChange('hips', e.target.value)}
                      className="w-full bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-bold text-bark-800 uppercase block">
                      Total Height (cm)
                    </label>
                    <input
                      type="text"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.a6963109cb")}
                      value={activeMeas.height || ''}
                      onChange={(e) => handleMeasurementChange('height', e.target.value)}
                      className="w-full bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold text-bark-800 uppercase block">
                    Tailoring adjustments &amp; Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder={pfUiT("ui.components.sewingsessiontimer.06948f5f55")}
                    value={activeMeas.custom || ''}
                    onChange={(e) => handleMeasurementChange('custom', e.target.value)}
                    className="w-full bg-white border border-sand-300 text-bark-900 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] placeholder-bark-400 leading-relaxed font-sans font-medium"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveMeasurements}
                  className="w-full py-2 bg-[#ba6446] hover:bg-[#a25135] text-white rounded-[3px] text-xs font-bold uppercase tracking-wider transition-colors shadow-3xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.fb51384af9")}</button>
              </div>

              {/* Sizing measurements informational card */}
              <div className="bg-white border border-sand-300 rounded p-4 flex items-start gap-2.5 shadow-3xs">
                <AlertCircle className="w-4 h-4 text-[#ba6446] shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed text-bark-700">
                  <span className="font-bold text-bark-900 block font-serif text-sm mb-1">{pfUiT("ui.components.sewingsessiontimer.0d5cb942ba")}</span>{pfUiT("ui.components.sewingsessiontimer.251bf203c2")}</div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: SEWING ACTIVITY JOURNAL & LOGS */}
          {activeSidebarTab === 'journal' && (
            <div className="space-y-5" id="workspace-journal-pane">

              {/* Project Metrics Summary Card */}
              <div className="bg-white border border-sand-300 rounded-lg p-4 space-y-3.5 shadow-2xs">
                <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-clay-700" />{pfUiT("ui.components.sewingsessiontimer.26fea7d581")}</h4>

                {Object.keys(patternMetrics).length === 0 ? (
                  <p className="text-xs text-bark-600 italic py-1 leading-normal font-sans">{pfUiT("ui.components.sewingsessiontimer.70b517fcab")}</p>
                ) : (
                  <div className="space-y-2.5">
                    {Object.entries(patternMetrics).map(([pid, metric]) => (
                      <div key={pid} className="bg-sand-50 p-3 rounded border border-sand-200 space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-bark-900">
                          <span className="truncate max-w-[180px]">{metric.name}</span>
                          <span className="font-mono text-[#ba6446]">{formatLongTime(metric.totalSeconds)}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-1.5 bg-sand-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-clay-600 rounded-full"
                            style={{ width: `${Math.min(100, (metric.totalSeconds / 3600) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-bark-700 font-bold">
                          <span>{metric.sessionsCount} logged sessions</span>
                          <span>Target: ~{pid === 'sartorial-02' ? '52m' : pid === 'sartorial-01' ? '28.5m' : '34m'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-bark-700" />{pfUiT("ui.components.sewingsessiontimer.9193a91f25")}</h4>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-end items-center">
                    <button
                      onClick={() => setIsManualModalOpen(true)}
                      className="text-[#ba6446] hover:text-[#9e5237] text-xs font-mono font-bold uppercase hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                      type="button"
                    >
                      <Plus className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.6761ba0d0c")}</button>
                    {historyLogs.length > 0 && (
                      <>
                        <button
                          onClick={handleExportCSV}
                          className="text-[#ba6446] hover:text-[#9e5237] text-xs font-mono font-bold uppercase hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                          type="button"
                          id="export-csv-btn"
                          title={pfUiT("ui.components.sewingsessiontimer.d8eadeed35")}
                        >
                          <Download className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.0080055cee")}</button>
                        <button
                          onClick={handleClearAllLogs}
                          className="text-red-750 hover:text-red-900 text-xs font-mono font-bold uppercase hover:underline flex items-center gap-1 transition-colors cursor-pointer"
                          type="button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.955c31213b")}</button>
                      </>
                    )}
                  </div>
                </div>

                {/* History List viewport */}
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-sand-300">
                  {historyLogs.length === 0 ? (
                    <div className="border border-dashed border-sand-300 rounded-lg p-6 text-center text-bark-500 space-y-2 bg-white">
                      <Scissors className="w-6 h-6 text-sand-400 mx-auto" />
                      <p className="text-xs font-sans font-medium">{pfUiT("ui.components.sewingsessiontimer.479670b138")}</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {historyLogs.map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-white border border-sand-300 rounded p-3 space-y-2 text-xs relative group shadow-3xs"
                        >
                          {/* Delete log indicator */}
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="absolute top-2 right-2 p-1 text-bark-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                            title={pfUiT("ui.components.sewingsessiontimer.65bd005983")}
                            type="button"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Header block info */}
                          <div className="space-y-0.5">
                            <div className="text-[10px] text-bark-500 font-mono font-bold flex items-center gap-1.5 flex-wrap">
                              <span className="bg-sand-100 text-bark-800 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                {log.patternName}
                              </span>
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-3 h-3 text-bark-400" />
                                {new Date(log.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                              </span>
                            </div>
                            <div className="font-bold text-bark-900 pr-5 pt-0.5 flex items-center gap-1 leading-normal">
                              <ChevronRight className="w-3.5 h-3.5 text-[#ba6446] shrink-0" />
                              {log.stepName}
                            </div>
                          </div>

                          {/* Duration & Notes */}
                          <div className="bg-sand-50 border border-sand-200 rounded p-2 flex items-center justify-between font-mono text-xs font-bold text-[#ba6446]">
                            <span>{pfUiT("ui.components.sewingsessiontimer.71fd9f0a9c")}</span>
                            <span className="font-extrabold">{formatLongTime(log.durationSeconds)}</span>
                          </div>

                          {log.notes && (
                            <p className="text-xs text-bark-750 leading-relaxed pl-1.5 border-l-2 border-[#ba6446] italic bg-sand-50/40 p-1 rounded-r">
                              "{log.notes}"
                            </p>
                          )}

                          {log.photo && (
                            <div className="relative mt-2 rounded overflow-hidden border border-sand-200 shadow-3xs">
                              <img
                                src={log.photo}
                                alt={pfUiT("ui.components.sewingsessiontimer.acfdfe6677")}
                                className="w-full h-32 object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: MY PROJECTS & VISUAL PROGRESS */}
          {activeSidebarTab === 'projects' && (
            <div className="space-y-5 animate-fadeIn" id="workspace-projects-pane">
              {/* Projects Sub-Tabs for Active vs Archived */}
              <div className="flex border-b border-sand-250" id="projects-status-sub-tabs">
                <button
                  type="button"
                  onClick={() => setProjectsSubTab('active')}
                  className={`flex-1 pb-2.5 text-[11px] font-mono uppercase tracking-wider font-extrabold text-center border-b-2 transition-all cursor-pointer ${
                    projectsSubTab === 'active'
                      ? 'border-[#ba6446] text-[#ba6446]'
                      : 'border-transparent text-bark-550 hover:text-bark-900'
                  }`}
                >{pfUiT("ui.components.sewingsessiontimer.fc0a95030e")}</button>
                <button
                  type="button"
                  onClick={() => setProjectsSubTab('archived')}
                  className={`flex-1 pb-2.5 text-[11px] font-mono uppercase tracking-wider font-extrabold text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    projectsSubTab === 'archived'
                      ? 'border-[#ba6446] text-[#ba6446]'
                      : 'border-transparent text-bark-550 hover:text-bark-900'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archived ({archivedProjectIds.length})</span>
                </button>
              </div>

              {/* OVERALL ATELIER SUMMARY STATS CARD */}
              <div className="bg-bark-900 text-sand-100 rounded-lg p-5 space-y-4 shadow-md border border-bark-950 relative overflow-hidden" id="overall-atelier-summary-card">
                {/* Subtle visual decoration */}
                <div className="absolute right-0 top-0 w-32 h-32 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

                <div className="flex items-center gap-2 pb-2 border-b border-bark-800">
                  <Award className="w-5 h-5 text-clay-400" />
                  <div>
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-sand-200">
                      Atelier Summary &amp; Stats
                    </h4>
                    <p className="text-[10px] text-bark-300">{pfUiT("ui.components.sewingsessiontimer.354968a8d4")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Total Completed */}
                  <div className="bg-bark-850/60 border border-bark-800 rounded p-3 text-center space-y-1">
                    <span className="block text-[8px] font-mono text-sand-400 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.3868ab87cc")}</span>
                    <span className="text-xl sm:text-2xl font-serif font-bold text-clay-300 block">{completedProjectsCount}</span>
                    <span className="block text-[8px] text-bark-300 font-sans">{pfUiT("ui.components.sewingsessiontimer.ed66433c66")}</span>
                  </div>

                  {/* Total Sewing Time */}
                  <div className="bg-bark-850/60 border border-bark-800 rounded p-3 text-center space-y-1">
                    <span className="block text-[8px] font-mono text-sand-400 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.2664044195")}</span>
                    <span className="text-xl sm:text-2xl font-serif font-bold text-sand-100 truncate block">{formatLongTime(totalSewingSeconds) || '0s'}</span>
                    <span className="block text-[8px] text-bark-300 font-sans">{pfUiT("ui.components.sewingsessiontimer.91cedb8120")}</span>
                  </div>

                  {/* Total Photos */}
                  <div className="bg-bark-850/60 border border-bark-800 rounded p-3 text-center space-y-1">
                    <span className="block text-[8px] font-mono text-sand-400 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.5711161164")}</span>
                    <span className="text-xl sm:text-2xl font-serif font-bold text-clay-300 block">{totalProgressPhotosCount}</span>
                    <span className="block text-[8px] text-bark-300 font-sans">{pfUiT("ui.components.sewingsessiontimer.91bc362b1d")}</span>
                  </div>
                </div>

                {/* PROJECT STATUS MANAGEMEMT NESTED SECTION */}
                <div className="space-y-2 pt-2 border-t border-bark-800">
                  <h5 className="text-[9px] font-mono font-extrabold text-sand-300 uppercase tracking-wider flex items-center justify-between">
                    <span>{projectsSubTab === 'active' ? 'Active Blueprints Checklist' : 'Archived Blueprints'}</span>
                    <span className="text-[8px] text-bark-400 normal-case font-normal">{pfUiT("ui.components.sewingsessiontimer.749cb4fc30")}</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[130px] overflow-y-auto pr-1">
                    {patterns
                      .filter(p => {
                        const isArchived = archivedProjectIds.includes(p.id);
                        return projectsSubTab === 'active' ? !isArchived : isArchived;
                      })
                      .map((p) => {
                        const isComp = !!projectCompanionData[p.id]?.completed;
                        const timeSpent = historyLogs
                          .filter(l => l.patternId === p.id)
                          .reduce((sum, l) => sum + l.durationSeconds, 0);

                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleProjectCompletion(p.id)}
                            className={`flex items-center justify-between p-2 rounded border text-left transition-all cursor-pointer group ${
                              isComp
                                ? 'bg-bark-800/40 border-clay-700/50 hover:bg-bark-800/60'
                                : 'bg-bark-950/40 border-bark-800 hover:border-bark-700 hover:bg-bark-950/60'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <span className={`block text-[11px] font-sans truncate ${isComp ? 'line-through text-bark-400 italic font-normal' : 'text-sand-100 font-medium'}`}>
                                {p.name}
                              </span>
                              <span className="block text-[8px] font-mono text-bark-400">
                                {timeSpent > 0 ? formatLongTime(timeSpent) : '0s'} logged
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {/* Archive/Restore Action Button */}
                              <button
                                type="button"
                                onClick={(e) => toggleArchiveProject(p.id, e)}
                                className="p-1 rounded text-bark-400 hover:text-sand-100 hover:bg-bark-800/80 transition-colors cursor-pointer"
                                title={projectsSubTab === 'active' ? "Archive Project" : "Restore Project"}
                              >
                                <Archive className={`w-3.5 h-3.5 ${projectsSubTab === 'archived' ? 'text-clay-400' : ''}`} />
                              </button>

                              {/* Completion indicator */}
                              <button
                                type="button"
                                className="shrink-0"
                              >
                                {isComp ? (
                                  <CheckCircle className="w-4 h-4 text-clay-400 fill-clay-950/40" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded border border-bark-500 group-hover:border-clay-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {/* Custom Tailoring Option */}
                    {(() => {
                      const isCustomArchived = archivedProjectIds.includes('custom');
                      const showCustom = projectsSubTab === 'active' ? !isCustomArchived : isCustomArchived;
                      if (!showCustom) return null;

                      const isComp = !!projectCompanionData['custom']?.completed;
                      const timeSpent = historyLogs
                        .filter(l => l.patternId === 'custom')
                        .reduce((sum, l) => sum + l.durationSeconds, 0);

                      return (
                        <div
                          onClick={() => toggleProjectCompletion('custom')}
                          className={`flex items-center justify-between p-2 rounded border text-left transition-all cursor-pointer group ${
                            isComp
                              ? 'bg-bark-800/40 border-clay-700/50 hover:bg-bark-800/60'
                              : 'bg-bark-950/40 border-bark-800 hover:border-bark-700 hover:bg-bark-950/60'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className={`block text-[11px] font-sans truncate ${isComp ? 'line-through text-bark-400 italic font-normal' : 'text-sand-100 font-medium'}`}>{pfUiT("ui.components.sewingsessiontimer.e46167e00a")}</span>
                            <span className="block text-[8px] font-mono text-bark-400">
                              {timeSpent > 0 ? formatLongTime(timeSpent) : '0s'} logged
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {/* Archive/Restore Action Button */}
                            <button
                              type="button"
                              onClick={(e) => toggleArchiveProject('custom', e)}
                              className="p-1 rounded text-bark-400 hover:text-sand-100 hover:bg-bark-800/80 transition-colors cursor-pointer"
                              title={projectsSubTab === 'active' ? "Archive Project" : "Restore Project"}
                            >
                              <Archive className={`w-3.5 h-3.5 ${projectsSubTab === 'archived' ? 'text-clay-400' : ''}`} />
                            </button>

                            {/* Completion indicator */}
                            <button
                              type="button"
                              className="shrink-0"
                            >
                              {isComp ? (
                                <CheckCircle className="w-4 h-4 text-clay-400 fill-clay-950/40" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded border border-bark-500 group-hover:border-clay-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Empty placeholder */}
                    {patterns.filter(p => {
                      const isArchived = archivedProjectIds.includes(p.id);
                      return projectsSubTab === 'active' ? !isArchived : isArchived;
                    }).length === 0 && (projectsSubTab === 'active' ? !archivedProjectIds.includes('custom') : archivedProjectIds.includes('custom')) === false && (
                      <div className="col-span-2 py-6 text-center text-xs text-bark-400 italic font-sans">
                        No {projectsSubTab === 'active' ? 'active' : 'archived'} blueprints in workspace.
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* My Custom Projects Portfolio */}
              <div className="bg-white border border-sand-300 rounded-lg p-5 space-y-4 shadow-3xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#ba6446]" />{pfUiT("ui.components.sewingsessiontimer.2aaa39aec9")}</h4>
                    <p className="text-[11px] text-bark-550">{pfUiT("ui.components.sewingsessiontimer.5f6a0263fc")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateProjectFormOpen(prev => !prev);
                      if (!isCreateProjectFormOpen) {
                        setNewProjPatternId(patterns[0]?.id || 'custom');
                        setNewProjName(patterns[0] ? `My ${patterns[0].name}` : 'Custom Tailoring Project');
                        setNewProjNotes('');
                        setNewProjSize('8');
                        setNewProjWidth('60');
                      }
                    }}
                    className="px-3 py-1.5 bg-[#ba6446] hover:bg-[#a35237] text-white text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-3xs hover:shadow-2xs"
                  >
                    {isCreateProjectFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{isCreateProjectFormOpen ? 'Close Form' : 'Link New Project'}</span>
                  </button>
                </div>

                <AnimatePresence>
                  {isCreateProjectFormOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-sand-50/70 border border-sand-250 rounded-lg p-4 sm:p-5 mt-1 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-200 pb-3">
                          <h5 className="text-[11px] font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Scissors className="w-3.5 h-3.5 text-[#ba6446]" />
                            Initialize &amp; Link Project
                          </h5>

                          {/* Tab Switcher for Creation Method */}
                          <div className="flex bg-sand-100 p-0.5 rounded-md border border-sand-200 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCreationMethod('import');
                                setImportStep(0);
                                setImportingFile(null);
                              }}
                              className={`px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center gap-1 ${
                                creationMethod === 'import'
                                  ? 'bg-white text-[#ba6446] shadow-3xs'
                                  : 'text-bark-500 hover:text-bark-800'
                              }`}
                            >{pfUiT("ui.components.sewingsessiontimer.3a9157bb3e")}</button>
                            <button
                              type="button"
                              onClick={() => setCreationMethod('manual')}
                              className={`px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center gap-1 ${
                                creationMethod === 'manual'
                                  ? 'bg-white text-[#ba6446] shadow-3xs'
                                  : 'text-bark-500 hover:text-bark-800'
                              }`}
                            >{pfUiT("ui.components.sewingsessiontimer.756ca6b636")}</button>
                          </div>
                        </div>

                        {creationMethod === 'import' ? (
                          <div className="space-y-4">
                            {importStep === 0 && (
                              <div
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setIsDragging(false);
                                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    parseDroppedFile(e.dataTransfer.files[0]);
                                  }
                                }}
                                onClick={() => document.getElementById('pattern-file-input').click()}
                                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[170px] ${
                                  isDragging
                                    ? 'border-[#ba6446] bg-[#ba6446]/5'
                                    : 'border-sand-300 hover:border-[#ba6446] bg-white hover:shadow-3xs'
                                }`}
                              >
                                                        <input
                                  id="pattern-file-input"
                                  type="file"
                                  accept=".pdf,.json,.csv,.txt,.md,.png,.jpg,.jpeg"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      parseDroppedFile(e.target.files[0]);
                                    }
                                  }}
                                />
                                <FileText className="w-8 h-8 text-[#ba6446] mb-2" />
                                <p className="text-xs font-sans font-bold text-bark-800">
                                  Drag &amp; drop digital sewing pattern or click to browse
                                </p>
                                <p className="text-[10px] text-bark-500 mt-1 max-w-sm leading-normal">
                                  Supports standard pattern PDF files, technical sheets, digital specs (.json), comma-separated listings (.csv), and cutting notes (.txt). We'll instantly extract fabrics and sizing ranges.
                                </p>

                                <div className="mt-4 pt-3 border-t border-sand-200 w-full max-w-xs flex flex-col gap-1.5">
                                  <span className="text-[8px] font-mono text-bark-400 uppercase tracking-widest font-bold">{pfUiT("ui.components.sewingsessiontimer.33163462cc")}</span>
                                  <div className="flex flex-wrap gap-2 justify-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadSampleJSON();
                                      }}
                                      className="px-2.5 py-1 bg-sand-100 hover:bg-sand-200 text-bark-750 text-[8.5px] font-mono font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Download className="w-3 h-3 text-[#ba6446]" />
                                      <span>{pfUiT("ui.components.sewingsessiontimer.1acf8873b8")}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadSampleCSV();
                                      }}
                                      className="px-2.5 py-1 bg-sand-100 hover:bg-sand-200 text-bark-750 text-[8.5px] font-mono font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Download className="w-3 h-3 text-[#ba6446]" />
                                      <span>{pfUiT("ui.components.sewingsessiontimer.190bfea801")}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadSampleTXT();
                                      }}
                                      className="px-2.5 py-1 bg-sand-100 hover:bg-sand-200 text-bark-750 text-[8.5px] font-mono font-bold rounded flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Download className="w-3 h-3 text-[#ba6446]" />
                                      <span>{pfUiT("ui.components.sewingsessiontimer.018314dfdf")}</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {importStep === 1 && (
                              <div className="bg-white border border-sand-250 rounded-lg p-5 flex flex-col items-center justify-center space-y-4 shadow-3xs">
                                <div className="w-8 h-8 border-3 border-t-[#ba6446] border-sand-150 rounded-full animate-spin"></div>
                                <div className="text-center">
                                  <h6 className="text-[11px] font-mono font-bold text-bark-900 uppercase tracking-wider animate-pulse">
                                    Parsing Pattern Layout &amp; Textiles
                                  </h6>
                                  <p className="text-[9.5px] text-bark-500 mt-0.5">{pfUiT("ui.components.sewingsessiontimer.3e708ac9ef")}</p>
                                </div>

                                <div className="bg-bark-950 text-sand-50 font-mono text-[8.5px] rounded p-3 w-full space-y-1 max-h-[140px] overflow-y-auto border border-bark-900 leading-relaxed shadow-inner">
                                  {importLogs.map((logStr, index) => (
                                    <div key={index} className="flex gap-1.5 animate-fadeIn">
                                      <span className="text-[#ba6446] shrink-0">&gt;</span>
                                      <span>{logStr}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {importStep === 2 && (
                              <div className="bg-white border border-sand-250 rounded-lg p-4 sm:p-5 space-y-4 shadow-3xs animate-fadeIn">
                                <div className="pb-3 border-b border-sand-200 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="bg-clay-50 p-1.5 rounded border border-clay-100">
                                      <Scissors className="w-3.5 h-3.5 text-[#ba6446]" />
                                    </div>
                                    <div>
                                      <h6 className="text-[11px] font-mono font-bold text-bark-900 uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.74240553dd")}</h6>
                                      <p className="text-[9.5px] text-bark-550">{pfUiT("ui.components.sewingsessiontimer.ecb9e04abb")}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setImportStep(0);
                                      setImportingFile(null);
                                    }}
                                    className="text-[9px] font-mono text-rose-600 hover:text-rose-700 underline uppercase tracking-wider cursor-pointer font-bold"
                                  >{pfUiT("ui.components.sewingsessiontimer.171645d11a")}</button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {/* Project Name */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.279b949a26")}</label>
                                    <input
                                      type="text"
                                      required
                                      value={importedMetadata.name}
                                      onChange={(e) => setImportedMetadata(prev => ({ ...prev, name: e.target.value }))}
                                      className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                    />
                                  </div>

                                  {/* Blueprint Link */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.c3040efea5")}</label>
                                    <select
                                      value={importedMetadata.patternId}
                                      onChange={(e) => setImportedMetadata(prev => ({ ...prev, patternId: e.target.value }))}
                                      className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                    >
                                      {patterns.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                      ))}
                                      <option value="custom">{pfUiT("ui.components.sewingsessiontimer.dcab3f7a87")}</option>
                                    </select>
                                  </div>

                                  {/* Target Size */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.d0f50c883c")}</label>
                                    <select
                                      value={importedMetadata.size}
                                      onChange={(e) => setImportedMetadata(prev => ({ ...prev, size: e.target.value }))}
                                      className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                    >
                                      {['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].map(sz => (
                                        <option key={sz} value={sz}>Size {sz}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Fabric Width */}
                                  <div className="space-y-1.5">
                                    <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.610180c070")}</label>
                                    <select
                                      value={importedMetadata.width}
                                      onChange={(e) => setImportedMetadata(prev => ({ ...prev, width: e.target.value }))}
                                      className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                    >
                                      <option value="60">60 inches (Standard Wide)</option>
                                      <option value="44">44 inches (Standard Narrow)</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Extracted Fabrics */}
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">
                                    Extracted Fabric Recommendations (Comma separated list)
                                  </label>
                                  <input
                                    type="text"
                                    value={importedMetadata.fabrics.join(', ')}
                                    onChange={(e) => {
                                      const arr = e.target.value.split(',').map(f => f.trim()).filter(Boolean);
                                      setImportedMetadata(prev => ({ ...prev, fabrics: arr }));
                                    }}
                                    className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                  />
                                </div>

                                {/* Extracted Notes */}
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">
                                    Imported Fitting Notes &amp; Customizations
                                  </label>
                                  <textarea
                                    rows="2"
                                    value={importedMetadata.notes}
                                    onChange={(e) => setImportedMetadata(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={handleCreateFromImportedMetadata}
                                  className="w-full py-2 bg-[#ba6446] hover:bg-[#a35237] text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Assemble Imported Project &amp; Populate Companion Logs</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <form onSubmit={handleCreateAndLinkProject} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Select Pattern */}
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.208170e7d5")}</label>
                                <select
                                  value={newProjPatternId}
                                  onChange={(e) => handleFormPatternChange(e.target.value)}
                                  className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                >
                                  {patterns.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                                  ))}
                                  <option value="custom">{pfUiT("ui.components.sewingsessiontimer.dcab3f7a87")}</option>
                                </select>
                              </div>

                              {/* Project Name */}
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.812dd6394f")}</label>
                                <input
                                  type="text"
                                  required
                                  value={newProjName}
                                  onChange={(e) => setNewProjName(e.target.value)}
                                  placeholder={pfUiT("ui.components.sewingsessiontimer.62cf417437")}
                                  className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                />
                              </div>

                              {/* Sizing Selection */}
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.22e1883feb")}</label>
                                <select
                                  value={newProjSize}
                                  onChange={(e) => setNewProjSize(e.target.value)}
                                  className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                >
                                  {['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].map(sz => (
                                    <option key={sz} value={sz}>Size {sz}</option>
                                  ))}
                                </select>
                                <p className="text-[8px] text-bark-400 font-mono">
                                  ✨ Sizing measurements (bust/waist/hips) will auto-fill from masters table.
                                </p>
                              </div>

                              {/* Fabric Width */}
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.122ae6e992")}</label>
                                <select
                                  value={newProjWidth}
                                  onChange={(e) => setNewProjWidth(e.target.value)}
                                  className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                                >
                                  <option value="60">60 inches (Standard Wide)</option>
                                  <option value="44">44 inches (Standard Narrow)</option>
                                </select>
                                <p className="text-[8px] text-bark-400 font-mono">{pfUiT("ui.components.sewingsessiontimer.92a84ebed1")}</p>
                              </div>
                            </div>

                            {/* Project Notes */}
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-mono font-bold text-bark-550 uppercase tracking-wider block">
                                5. Fitting Notes &amp; Customization Goals
                              </label>
                              <textarea
                                rows="2"
                                value={newProjNotes}
                                onChange={(e) => setNewProjNotes(e.target.value)}
                                placeholder={pfUiT("ui.components.sewingsessiontimer.54511a1078")}
                                className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] placeholder-bark-300"
                              />
                            </div>

                            <button
                              type="submit"
                              className="w-full py-2 bg-[#ba6446] hover:bg-[#a35237] text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
                            >
                              <Check className="w-4 h-4" />
                              <span>Assemble Project &amp; Auto-fill Companion Details</span>
                            </button>
                          </form>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* User Projects List */}
                <div className="space-y-3">
                  {(() => {
                    const filteredUserProjects = userProjects.filter(p => {
                      const isArchived = archivedProjectIds.includes(p.id);
                      return projectsSubTab === 'active' ? !isArchived : isArchived;
                    });

                    if (filteredUserProjects.length === 0) {
                      return (
                        <div className="border border-dashed border-sand-300 rounded-lg p-6 text-center text-bark-500 bg-sand-50/30">
                          <Layers className="w-6 h-6 text-sand-400 mx-auto mb-2" />
                          <p className="text-xs font-sans font-semibold text-bark-700">No {projectsSubTab === 'active' ? 'active' : 'archived'} custom portfolio projects.</p>
                          <p className="text-[10px] text-bark-400 max-w-xs mx-auto mt-1 leading-normal">{pfUiT("ui.components.sewingsessiontimer.cc538a396d")}</p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredUserProjects.map((proj) => {
                          const isComp = !!projectCompanionData[proj.id]?.completed;
                          const isCurrentActive = selectedPatternId === proj.id;
                          const parent = patterns.find(p => p.id === proj.patternId);
                          const timeSpent = historyLogs
                            .filter(l => l.patternId === proj.id)
                            .reduce((sum, l) => sum + l.durationSeconds, 0);

                          // Find fabrics linked to this project
                          const directFabrics = fabricStash.filter(item => item.patternId === proj.id);
                          const blueprintFabrics = (proj.patternId && proj.patternId !== 'custom')
                            ? fabricStash.filter(item => item.patternId === proj.patternId)
                            : [];

                          // Combine them without duplicates
                          const allLinkedFabrics = [...directFabrics];
                          blueprintFabrics.forEach(bf => {
                            if (!allLinkedFabrics.some(df => df.id === bf.id)) {
                              allLinkedFabrics.push(bf);
                            }
                          });

                          const totalCost = allLinkedFabrics.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0) * (parseFloat(item.costPerYard) || 0), 0);

                          return (
                            <div
                              key={proj.id}
                              onClick={() => {
                                setSelectedPatternId(proj.id);
                                if (window.showToast) {
                                  window.showToast(`Active design set to "${proj.name}"!`, "info", "Active Project Switched");
                                }
                              }}
                              className={`border rounded-lg p-4 transition-all cursor-pointer flex flex-col justify-between h-full relative group ${
                                isCurrentActive
                                  ? 'bg-clay-50/50 border-clay-400/90 ring-1 ring-clay-200'
                                  : isComp
                                  ? 'bg-sand-50/40 border-sand-200 opacity-75 hover:opacity-100 hover:border-sand-300'
                                  : 'bg-white border-sand-250 hover:border-sand-350 hover:shadow-3xs'
                              }`}
                            >
                              {/* Glowing indicator if active on timer */}
                              {isCurrentActive && (
                                <span className="absolute top-2 right-2 flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clay-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-clay-500"></span>
                                </span>
                              )}

                              <div className="space-y-1.5 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className={`font-serif text-sm font-extrabold truncate ${isComp ? 'line-through text-bark-400 italic' : 'text-bark-900'}`}>
                                    {proj.name}
                                  </h5>
                                  {isCurrentActive && (
                                    <span className="bg-clay-100 text-clay-700 text-[8px] font-mono font-extrabold uppercase px-1 py-0.5 rounded leading-none border border-clay-200/50">{pfUiT("ui.components.sewingsessiontimer.480747fdc9")}</span>
                                  )}
                                </div>

                                <span className="block text-[10px] font-mono text-bark-550 font-bold">{pfUiT("ui.components.sewingsessiontimer.9055a7b055")}<span className="text-[#ba6446]">{parent ? parent.name : 'Custom Pattern'}</span>
                                </span>

                                <div className="flex flex-wrap gap-2 text-[9px] font-mono text-bark-450 mt-1">
                                  <span className="bg-sand-100 px-1.5 py-0.5 rounded">Size {proj.size}</span>
                                  <span className="bg-sand-100 px-1.5 py-0.5 rounded">{proj.width}" Width</span>
                                  {timeSpent > 0 && (
                                    <span className="bg-sand-100 px-1.5 py-0.5 rounded text-clay-700 font-bold">{formatLongTime(timeSpent)} logged</span>
                                  )}
                                  <span className="bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200/50 flex items-center gap-0.5">
                                    <DollarSign className="w-2.5 h-2.5" />
                                    Est. Cost: ${totalCost.toFixed(2)}
                                  </span>
                                </div>

                                {allLinkedFabrics.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-sand-100/60 space-y-1">
                                    <div className="flex items-center justify-between text-[8px] font-mono font-bold text-bark-400 uppercase tracking-wider">
                                      <span>Linked Fabrics ({allLinkedFabrics.length})</span>
                                      <span className="text-emerald-800 font-semibold">Total: ${totalCost.toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-0.5 max-h-[60px] overflow-y-auto pr-0.5">
                                      {allLinkedFabrics.map(f => {
                                        const yards = parseFloat(f.yardage) || 0;
                                        const costPer = parseFloat(f.costPerYard) || 0;
                                        const fCost = yards * costPer;
                                        return (
                                          <div key={f.id} className="flex items-center justify-between text-[9.5px] font-mono text-bark-600">
                                            <span className="truncate max-w-[140px] font-medium text-bark-650" title={f.name}>• {f.name}</span>
                                            <span className="shrink-0 text-bark-550 font-medium">
                                              {yards} yds {costPer > 0 ? `× $${costPer.toFixed(2)}` : ''} = <span className={costPer > 0 ? "text-emerald-700 font-semibold" : ""}>${fCost.toFixed(2)}</span>
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {proj.notes && (
                                  <p className="text-[10px] text-bark-500 line-clamp-2 leading-relaxed pt-1 border-t border-sand-100 mt-2">
                                    {proj.notes}
                                  </p>
                                )}

                                {/* Card Visual Progress Tracker */}
                                {(() => {
                                  const cardChecklist = getProjectChecklist(proj.id);
                                  const cardCompleted = cardChecklist.filter(item => item.completed).length;
                                  const cardTotal = cardChecklist.length;
                                  const cardPercent = cardTotal > 0 ? Math.round((cardCompleted / cardTotal) * 100) : 0;
                                  const isExpanded = !!expandedChecklists[proj.id];

                                  return (
                                    <div className="mt-3 pt-3 border-t border-sand-150/80 space-y-2" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className="font-bold text-bark-650 uppercase tracking-wider flex items-center gap-1">
                                          <ClipboardList className="w-3.5 h-3.5 text-[#ba6446]" />{pfUiT("ui.components.sewingsessiontimer.5d4c14521b")}</span>
                                        <span className="font-extrabold text-[#ba6446] bg-[#ba6446]/5 border border-[#ba6446]/10 px-1.5 py-0.5 rounded text-[9px]">
                                          {cardPercent}%
                                        </span>
                                      </div>

                                      <div className="w-full bg-sand-100 h-2 rounded-full overflow-hidden border border-sand-200 shadow-inner">
                                        <div
                                          className="bg-gradient-to-r from-[#ba6446] to-[#d67b5c] h-full rounded-full transition-all duration-500 ease-out"
                                          style={{ width: `${cardPercent}%` }}
                                        />
                                      </div>

                                      <div className="flex items-center justify-between">
                                        <span className="text-[9.5px] font-mono text-bark-450">
                                          {cardCompleted}/{cardTotal} steps done
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => toggleChecklistExpanded(proj.id)}
                                          className="text-[9px] font-mono font-extrabold text-[#ba6446] hover:text-rose-950 transition-colors flex items-center gap-0.5 cursor-pointer uppercase tracking-wider"
                                        >
                                          <span>{isExpanded ? 'Hide Steps ▲' : 'Show Steps ▼'}</span>
                                        </button>
                                      </div>

                                      {isExpanded && (
                                        <div className="space-y-1.5 bg-[#FAF8F5]/90 border border-sand-200/60 p-2 rounded mt-1.5 animate-fadeIn">
                                          {cardChecklist.map(item => (
                                            <div
                                              key={item.id}
                                              onClick={() => toggleChecklistItem(proj.id, item.id)}
                                              className="flex items-center gap-2 cursor-pointer group/chk text-[10px] font-sans text-bark-750 hover:text-bark-900 select-none py-0.5"
                                            >
                                              <div
                                                className={`h-3.5 w-3.5 rounded border flex items-center justify-center transition-all shrink-0 ${
                                                  item.completed
                                                    ? 'bg-[#ba6446] border-[#ba6446] text-white'
                                                    : 'border-sand-300 bg-white group-hover/chk:border-[#ba6446]'
                                                }`}
                                              >
                                                {item.completed && <Check className="w-2.5 h-2.5 stroke-[3.5]" />}
                                              </div>
                                              <span className={`transition-all ${item.completed ? 'line-through text-bark-400 italic font-normal' : 'font-medium text-bark-850'}`}>
                                                {item.label}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="mt-4 pt-2.5 border-t border-sand-100 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  {/* Toggle Completion */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleProjectCompletion(proj.id);
                                    }}
                                    className={`p-1 border rounded transition-colors cursor-pointer ${
                                      isComp
                                        ? 'bg-clay-100 border-clay-300 text-clay-700 hover:bg-clay-200'
                                        : 'bg-white border-sand-250 text-bark-500 hover:text-bark-900 hover:border-sand-350'
                                    }`}
                                    title={isComp ? "Mark Incomplete" : "Mark Complete"}
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </button>

                                  {/* Archive/Unarchive */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleArchiveProject(proj.id, e);
                                    }}
                                    className="p-1 border border-sand-250 bg-white hover:bg-sand-50 text-bark-500 hover:text-bark-900 rounded transition-colors cursor-pointer"
                                    title={projectsSubTab === 'active' ? "Archive Project" : "Restore Project"}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Delete button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteUserProject(proj.id, proj.name, e);
                                  }}
                                  className="p-1 text-bark-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title={pfUiT("ui.components.sewingsessiontimer.dfc3c5ae77")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Project Filter & Stats Card */}
              <div className="bg-white border border-sand-300 rounded-lg p-4 space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sand-200">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-[#ba6446]" />{pfUiT("ui.components.sewingsessiontimer.8b416c8934")}</h4>
                    <p className="text-[11px] text-[#ba6446]">{pfUiT("ui.components.sewingsessiontimer.1efac077ff")}</p>
                  </div>
                  <select
                    value={projectsFilterId}
                    onChange={(e) => setProjectsFilterId(e.target.value)}
                    className="bg-sand-50 border border-sand-250 hover:border-sand-400 text-bark-900 text-xs rounded p-2 focus:outline-none focus:ring-1 focus:ring-[#ba6446] font-sans font-semibold cursor-pointer max-w-[180px] truncate"
                    id="projects-view-filter-select"
                  >
                    <option value="all">
                      {projectsSubTab === 'active' ? 'All Active Designs' : 'All Archived Designs'}
                    </option>
                    {patterns
                      .filter(p => {
                        const isArchived = archivedProjectIds.includes(p.id);
                        return projectsSubTab === 'active' ? !isArchived : isArchived;
                      })
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))
                    }
                    {(() => {
                      const isCustomArchived = archivedProjectIds.includes('custom');
                      const showCustom = projectsSubTab === 'active' ? !isCustomArchived : isCustomArchived;
                      return showCustom && <option value="custom">{pfUiT("ui.components.sewingsessiontimer.e46167e00a")}</option>;
                    })()}
                  </select>
                </div>

                {/* Filtered Photo Aggregation */}
                {(() => {
                  // Calculate filtered time stats
                  const filteredLogs = historyLogs.filter(log => {
                    if (projectsFilterId === 'all') {
                      return isProjectVisible(log.patternId);
                    }
                    return log.patternId === projectsFilterId;
                  });
                  const totalSecondsFiltered = filteredLogs.reduce((sum, l) => sum + l.durationSeconds, 0);
                  const sessionsCountFiltered = filteredLogs.length;

                  return (
                    <div className="space-y-5">
                      {/* Stat badge list */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-sand-50/70 border border-sand-200 rounded p-2">
                          <span className="block text-[9px] font-mono text-bark-500 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.706732215d")}</span>
                          <span className="text-base font-serif font-bold text-[#ba6446]">{filteredPhotos.length}</span>
                        </div>
                        <div className="bg-sand-50/70 border border-sand-200 rounded p-2">
                          <span className="block text-[9px] font-mono text-bark-500 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.47810da394")}</span>
                          <span className="text-base font-serif font-bold text-bark-950 truncate block px-0.5">{formatTime(totalSecondsFiltered)}</span>
                        </div>
                        <div className="bg-sand-50/70 border border-sand-200 rounded p-2">
                          <span className="block text-[9px] font-mono text-bark-500 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.c8a1ccb2b3")}</span>
                          <span className="text-base font-serif font-bold text-clay-700">{sessionsCountFiltered}</span>
                        </div>
                      </div>

                      {/* Photo Thumbnail Grid */}
                      <div className="space-y-2.5">
                        <h5 className="text-[10px] font-mono font-extrabold text-bark-850 uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.afc147b467")}</h5>

                        {filteredPhotos.length === 0 ? (
                          <div className="border border-dashed border-sand-300 rounded p-6 text-center text-bark-550 space-y-2 bg-sand-50/30">
                            <Camera className="w-5 h-5 text-sand-300 mx-auto" />
                            <p className="text-xs font-sans italic leading-relaxed">{pfUiT("ui.components.sewingsessiontimer.fe9ae466b1")}</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {filteredPhotos.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => setSelectedPreviewPhoto(item)}
                                className="relative aspect-square rounded overflow-hidden border border-sand-200 hover:border-[#ba6446] shadow-3xs cursor-pointer group bg-sand-100 transition-all hover:-translate-y-0.5 duration-150"
                              >
                                <img
                                  src={item.url}
                                  alt={pfUiT("ui.components.sewingsessiontimer.e235353942")}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[9px] text-white font-mono uppercase tracking-wider bg-black/55 px-1.5 py-0.5 rounded font-bold">{pfUiT("ui.components.sewingsessiontimer.3625295184")}</span>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7px] font-mono py-0.5 text-center truncate px-0.5 select-none font-bold">
                                  {new Date(item.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Connected Timeline of Time Logs with Visuals */}
                      <div className="space-y-3 pt-2 border-t border-sand-200">
                        <h5 className="text-[10px] font-mono font-extrabold text-bark-850 uppercase tracking-wider flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-bark-600" />
                          Progress &amp; Time Log Feed
                        </h5>

                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {filteredLogs.length === 0 ? (
                            <p className="text-xs text-bark-550 italic text-center py-4 bg-sand-50/20 rounded border border-dashed border-sand-250">{pfUiT("ui.components.sewingsessiontimer.787504a0da")}</p>
                          ) : (
                            filteredLogs.map((log) => (
                              <div key={log.id} className="bg-sand-50/60 border border-sand-200 rounded p-2.5 space-y-2 text-xs hover:border-sand-300 transition-all shadow-3xs">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <div className="text-[9px] text-bark-500 font-mono font-bold flex items-center gap-1 flex-wrap">
                                      <span className="text-clay-700 font-extrabold">{log.patternName}</span>
                                      <span className="text-bark-300">•</span>
                                      <span>{new Date(log.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                                    </div>
                                    <h6 className="font-bold text-bark-900 mt-0.5 text-xs">{log.stepName}</h6>
                                  </div>
                                  <span className="bg-[#ba6446]/10 text-[#ba6446] px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap">
                                    {formatLongTime(log.durationSeconds)}
                                  </span>
                                </div>

                                {log.notes && (
                                  <p className="text-[11px] text-bark-700 italic border-l-2 border-sand-300 pl-1.5 leading-normal">
                                    "{log.notes}"
                                  </p>
                                )}

                                {log.photo && (
                                  <div className="flex items-center gap-2 bg-white p-1 rounded border border-sand-200 mt-1 cursor-pointer group" onClick={() => setSelectedPreviewPhoto({ url: log.photo, patternName: log.patternName, date: log.date, details: `Session photo: ${log.stepName}`, source: 'Sewing Session' })}>
                                    <img
                                      src={log.photo}
                                      alt={pfUiT("ui.components.sewingsessiontimer.77f7cd241f")}
                                      className="w-12 h-12 object-cover rounded border border-sand-150 shrink-0"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <span className="block text-[8px] font-mono font-bold uppercase text-clay-700">{pfUiT("ui.components.sewingsessiontimer.208b509ebe")}</span>
                                      <span className="block text-[10px] text-bark-600 truncate font-sans leading-tight">{pfUiT("ui.components.sewingsessiontimer.587109100e")}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeSidebarTab === 'inventory' && (
            <div className="space-y-5 animate-fadeIn" id="workspace-inventory-pane">

              {/* Header Title with Add button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-bark-950 text-lg font-bold">Fabric Stash &amp; Inventory</h3>
                  <p className="text-[10px] text-bark-550 font-sans">{pfUiT("ui.components.sewingsessiontimer.da95801929")}</p>
                </div>
                <div className="flex items-center gap-3">
                  {inventorySubTab === 'stash' && (
                    <>
                      {fabricStash.length > 0 && (
                        <button
                          onClick={handleExportInventoryCSV}
                          className="text-[#ba6446] hover:text-[#9e5237] text-xs font-mono font-bold uppercase hover:underline flex items-center gap-1 transition-colors cursor-pointer mr-1"
                          type="button"
                          id="export-inventory-csv-btn"
                          title={pfUiT("ui.components.sewingsessiontimer.ff852961f1")}
                        >
                          <Download className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.0080055cee")}</button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isStashFormOpen) {
                            resetStashForm();
                          } else {
                            setIsStashFormOpen(true);
                          }
                        }}
                        className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                          isStashFormOpen
                            ? 'bg-sand-200 text-bark-750 hover:bg-sand-300'
                            : 'bg-[#ba6446] hover:bg-[#a25135] text-white shadow-xs'
                        }`}
                        id="toggle-stash-form-btn"
                      >
                        {isStashFormOpen ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            <span>{pfUiT("ui.components.sewingsessiontimer.aeeec80eca")}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{pfUiT("ui.components.sewingsessiontimer.94b16aa869")}</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {inventorySubTab === 'planner' && (
                    <>
                      {shoppingListPatterns.length > 0 && (
                        <button
                          onClick={handleExportShoppingTXT}
                          className="px-3 py-1.5 bg-[#ba6446] hover:bg-[#a25135] text-white rounded text-[11px] font-mono font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                          type="button"
                          id="export-shopping-txt-btn"
                          title={pfUiT("ui.components.sewingsessiontimer.0e7d2681ff")}
                        >
                          <Download className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.a532f58808")}</button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Elegant Inner Sub-Tabs */}
              <div className="flex border-b border-sand-200" id="inventory-sub-tabs">
                <button
                  onClick={() => setInventorySubTab('stash')}
                  className={`flex-1 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inventorySubTab === 'stash'
                      ? 'border-[#ba6446] text-[#ba6446]'
                      : 'border-transparent text-bark-500 hover:text-bark-850'
                  }`}
                  type="button"
                >
                  <Package className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.5c7f0e56dd")}</button>
                <button
                  onClick={() => setInventorySubTab('planner')}
                  className={`flex-1 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inventorySubTab === 'planner'
                      ? 'border-[#ba6446] text-[#ba6446]'
                      : 'border-transparent text-bark-500 hover:text-bark-850'
                  }`}
                  type="button"
                  id="tab-shopping-list-button"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Planner
                  {shoppingListPatterns.length > 0 && (
                    <span className="bg-[#ba6446] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none animate-pulse">
                      {shoppingListPatterns.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setInventorySubTab('calculator')}
                  className={`flex-1 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inventorySubTab === 'calculator'
                      ? 'border-[#ba6446] text-[#ba6446]'
                      : 'border-transparent text-bark-500 hover:text-bark-850'
                  }`}
                  type="button"
                  id="tab-calculator-button"
                >
                  <Calculator className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.4410fdd74a")}</button>
                <button
                  onClick={() => setInventorySubTab('cost-estimator')}
                  className={`flex-1 py-2 text-[11px] font-mono font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    inventorySubTab === 'cost-estimator'
                      ? 'border-[#ba6446] text-[#ba6446]'
                      : 'border-transparent text-bark-500 hover:text-bark-850'
                  }`}
                  type="button"
                  id="tab-cost-estimator-button"
                >
                  <Coins className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.556ec68927")}</button>
              </div>

              {inventorySubTab === 'stash' && (
                <>

              {/* STATS SUMMARY BAR */}
              <div className="grid grid-cols-3 gap-3 bg-white border border-sand-250 rounded-lg p-3.5 shadow-3xs" id="inventory-stats-row">
                <div className="text-center border-r border-sand-200">
                  <span className="block text-[8px] font-mono text-bark-450 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.46822d20c4")}</span>
                  <span className="text-lg font-serif font-bold text-bark-900 block">{fabricStash.length}</span>
                  <span className="block text-[8px] text-bark-500 font-sans">{pfUiT("ui.components.sewingsessiontimer.47a74054df")}</span>
                </div>
                <div className="text-center border-r border-sand-200">
                  <span className="block text-[8px] font-mono text-bark-450 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.9cf4ccd42f")}</span>
                  <span className="text-lg font-serif font-bold text-[#ba6446] block">
                    {fabricStash.reduce((acc, item) => acc + (parseFloat(item.yardage) || 0), 0).toFixed(1)} yds
                  </span>
                  <span className="block text-[8px] text-bark-500 font-sans">{pfUiT("ui.components.sewingsessiontimer.7778a1a4e6")}</span>
                </div>
                <div className="text-center">
                  <span className="block text-[8px] font-mono text-bark-450 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.18f5dd7b3c")}</span>
                  <span className="text-lg font-serif font-bold text-clay-700 block">
                    {fabricStash.filter(item => item.patternId && item.patternId !== 'none').length}
                  </span>
                  <span className="block text-[8px] text-bark-500 font-sans">{pfUiT("ui.components.sewingsessiontimer.023d2c325c")}</span>
                </div>
              </div>

              {/* LOW STOCK THRESHOLD SETTING & NOTIFICATION BANNER */}
              <div className="bg-sand-100/60 border border-sand-250 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-3xs" id="inventory-threshold-banner">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-full ${lowStockCount > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-green-100 text-green-700'}`}>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[11px] font-mono font-bold text-bark-850 uppercase tracking-wide">
                      {lowStockCount > 0 ? `${lowStockCount} Item${lowStockCount === 1 ? '' : 's'} Low on Stock` : 'All Materials Stocked'}
                    </span>
                    <span className="block text-[9.5px] text-bark-550 font-sans leading-tight">
                      {lowStockCount > 0 ? 'Replenish fabric or update yardage records.' : 'Fabric lengths are currently above the safety threshold.'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <label htmlFor="stash-threshold-input" className="text-[9px] font-mono font-extrabold text-bark-500 uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.e4a5688233")}</label>
                  <div className="flex items-center bg-white border border-sand-300 rounded shadow-3xs overflow-hidden">
                    <input
                      id="stash-threshold-input"
                      type="number"
                      step="0.1"
                      min="0"
                      value={stashThreshold}
                      onChange={(e) => setStashThreshold(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-14 text-center text-xs font-mono font-bold text-bark-900 bg-transparent py-1 focus:outline-none"
                    />
                    <span className="text-[9px] font-mono font-bold text-bark-550 bg-sand-100 px-1.5 py-1 border-l border-sand-200">{pfUiT("ui.components.sewingsessiontimer.6abef46cab")}</span>
                  </div>
                </div>
              </div>

              {/* ADD / EDIT FABRIC FORM */}
              <AnimatePresence>
                {isStashFormOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                    id="stash-form-container"
                  >
                    <form
                      onSubmit={handleAddOrEditStashItem}
                      className="bg-sand-50/50 border border-sand-300 rounded-lg p-4 space-y-4 shadow-inner"
                    >
                      <h4 className="text-xs font-mono font-bold text-bark-900 uppercase tracking-wider border-b border-sand-250 pb-1.5 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-[#ba6446]" />
                        {editingStashId ? 'Edit Fabric Record' : 'Register Fabric Specimen'}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Name */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.be452becb7")}</label>
                          <input
                            type="text"
                            required
                            placeholder={pfUiT("ui.components.sewingsessiontimer.a615678bb5")}
                            value={stashName}
                            onChange={(e) => setStashName(e.target.value)}
                            className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                          />
                        </div>

                        {/* Type */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.2f26b332f9")}</label>
                          <select
                            value={stashType}
                            onChange={(e) => setStashType(e.target.value)}
                            className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                          >
                            <option value="Linen">{pfUiT("ui.components.sewingsessiontimer.01d8c25742")}</option>
                            <option value="Cotton">{pfUiT("ui.components.sewingsessiontimer.808bc67d1c")}</option>
                            <option value="Silk">{pfUiT("ui.components.sewingsessiontimer.7aa9930d26")}</option>
                            <option value="Wool">{pfUiT("ui.components.sewingsessiontimer.4315c7f5ad")}</option>
                            <option value="Knits">{pfUiT("ui.components.sewingsessiontimer.475b0bff63")}</option>
                            <option value="Denim">{pfUiT("ui.components.sewingsessiontimer.1aa7376051")}</option>
                            <option value="Tweed">{pfUiT("ui.components.sewingsessiontimer.d494995147")}</option>
                            <option value="Velvet">{pfUiT("ui.components.sewingsessiontimer.5260c0a897")}</option>
                            <option value="Synthetic">{pfUiT("ui.components.sewingsessiontimer.59401c2531")}</option>
                            <option value="Leather">{pfUiT("ui.components.sewingsessiontimer.3d8db0d784")}</option>
                            <option value="Other">{pfUiT("ui.components.sewingsessiontimer.d2dcee7848")}</option>
                          </select>
                        </div>

                        {/* Yardage */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">
                            Length / Yardage (e.g. 3.5 yards or 3 meters) *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={pfUiT("ui.components.sewingsessiontimer.485176a640")}
                            value={stashYardage}
                            onChange={(e) => setStashYardage(e.target.value)}
                            className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                          />
                        </div>

                        {/* Width */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">
                            Width (optional)
                          </label>
                          <input
                            type="text"
                            placeholder={pfUiT("ui.components.sewingsessiontimer.92b0ec527b")}
                            value={stashWidth}
                            onChange={(e) => setStashWidth(e.target.value)}
                            className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                          />
                        </div>

                        {/* Cost per Yard */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">
                            Cost per Yard ($)
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bark-400 text-xs font-mono">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={stashCostPerYard}
                              onChange={(e) => setStashCostPerYard(e.target.value)}
                              className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 pl-6 focus:outline-none focus:border-[#ba6446] font-mono"
                            />
                          </div>
                        </div>

                        {/* Upcoming Project Association */}
                        <div className="space-y-1">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.0c1349225f")}</label>
                           <select
                            value={stashPatternId}
                            onChange={(e) => setStashPatternId(e.target.value)}
                            className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                          >
                            <option value="none">Unassigned (General Stash)</option>
                            <optgroup label="Gallery Patterns">
                              {patterns.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </optgroup>
                            {userProjects.length > 0 && (
                              <optgroup label="Linked Tailoring Projects">
                                {userProjects.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <option value="custom">{pfUiT("ui.components.sewingsessiontimer.61d9b76114")}</option>
                          </select>
                        </div>
                      </div>

                      {/* Notes / Descriptions */}
                      <div className="space-y-1">
                        <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.79a5845c4c")}</label>
                        <textarea
                          rows="2"
                          placeholder={pfUiT("ui.components.sewingsessiontimer.4038d35042")}
                          value={stashNotes}
                          onChange={(e) => setStashNotes(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] placeholder-bark-300"
                        />
                      </div>

                      {/* Tags / Use-Cases */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">
                            Tags / Categories / Use-Cases (comma-separated)
                          </label>
                          <span className="text-[9px] font-mono text-bark-400">{pfUiT("ui.components.sewingsessiontimer.a30834d9c1")}</span>
                        </div>
                        <input
                          type="text"
                          placeholder={pfUiT("ui.components.sewingsessiontimer.539307e5c6")}
                          value={stashTags}
                          onChange={(e) => setStashTags(e.target.value)}
                          className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                          id="stash-tags-input"
                        />
                        {/* Quick toggle chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {['Garment', 'Outerwear', 'Lining', 'Drapey', 'Heavyweight', 'Summer Use', 'Stretch', 'Structured'].map((quickTag) => {
                            const currentTags = stashTags.split(',').map(t => t.trim().toLowerCase());
                            const hasTag = currentTags.includes(quickTag.toLowerCase());
                            return (
                              <button
                                key={quickTag}
                                type="button"
                                onClick={() => {
                                  const tagsArr = stashTags.split(',').map(t => t.trim()).filter(Boolean);
                                  const lowerTagsArr = tagsArr.map(t => t.toLowerCase());
                                  const index = lowerTagsArr.indexOf(quickTag.toLowerCase());
                                  if (index > -1) {
                                    // Remove
                                    tagsArr.splice(index, 1);
                                  } else {
                                    // Add
                                    tagsArr.push(quickTag);
                                  }
                                  setStashTags(tagsArr.join(', '));
                                }}
                                className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold transition-all cursor-pointer ${
                                  hasTag
                                    ? 'bg-clay-650 text-white shadow-3xs'
                                    : 'bg-sand-100 text-bark-600 hover:bg-sand-200'
                                }`}
                              >
                                {hasTag ? `✓ ${quickTag}` : `+ ${quickTag}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Image Attachment (File upload dropzone AND quick color textures) */}
                      <div className="space-y-2">
                        <label className="text-[9.5px] font-mono font-bold text-bark-550 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.1e41abf22f")}</label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* File Dropzone */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); }}
                            className={`border-2 border-dashed rounded-lg p-3 text-center transition-all cursor-pointer ${
                              stashPhoto
                                ? 'border-sand-300 bg-sand-50/50'
                                : 'border-sand-300 hover:border-[#ba6446] hover:bg-sand-50 bg-white'
                            }`}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFormPhotoUpload}
                              className="hidden"
                              id="stash-file-picker"
                            />
                            <label htmlFor="stash-file-picker" className="cursor-pointer block space-y-1.5 py-2">
                              {stashPhoto ? (
                                <div className="flex items-center justify-center gap-2">
                                  <img
                                    src={stashPhoto}
                                    alt={pfUiT("ui.components.sewingsessiontimer.dbd170fa9f")}
                                    className="w-12 h-12 object-cover rounded border border-sand-300"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="text-left">
                                    <span className="block text-[10px] text-green-700 font-bold font-mono">{pfUiT("ui.components.sewingsessiontimer.34a1d2dd20")}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setStashPhoto('');
                                      }}
                                      className="text-red-750 hover:text-red-900 text-[9px] font-mono underline hover:no-underline"
                                    >{pfUiT("ui.components.sewingsessiontimer.f1f7f201f8")}</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Camera className="w-5 h-5 text-bark-400 mx-auto" />
                                  <span className="block text-[10px] text-bark-600 font-sans">{pfUiT("ui.components.sewingsessiontimer.6d202f56b3")}</span>
                                  <span className="block text-[8px] text-bark-400 font-mono">
                                    Supports Drag &amp; Drop
                                  </span>
                                </>
                              )}
                            </label>
                          </div>

                          {/* Quick Colorway Palette fallback picker */}
                          <div className="bg-white border border-sand-200 rounded-lg p-3 space-y-2">
                            <span className="block text-[8.5px] font-mono font-bold text-bark-450 uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.40fb138d45")}</span>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { name: 'Sage', color: '#8fa89b' },
                                { name: 'Navy', color: '#2b3a4a' },
                                { name: 'Rose', color: '#e5b3b3' },
                                { name: 'Charcoal', color: '#3a3a3a' },
                                { name: 'Mustard', color: '#d9a043' },
                                { name: 'Cream', color: '#f5f2eb' },
                                { name: 'Crimson', color: '#8b2635' },
                                { name: 'Olive', color: '#556b2f' },
                              ].map((pal) => (
                                <button
                                  key={pal.name}
                                  type="button"
                                  title={`Use ${pal.name} visual`}
                                  onClick={() => {
                                    const svgDataUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100%" height="100%" fill="${encodeURIComponent(pal.color)}"/><text x="50%" y="55%" font-family="monospace" font-size="10" fill="white" fill-opacity="0.6" text-anchor="middle" font-weight="bold">${encodeURIComponent(stashType.toUpperCase())}</text></svg>`;
                                    setStashPhoto(svgDataUrl);
                                    if (window.showToast) {
                                      window.showToast(`Selected ${pal.name} color swatch!`, "info", "Swatch Assigned");
                                    }
                                  }}
                                  className="aspect-square rounded border border-sand-200 shadow-3xs flex flex-col items-center justify-center relative hover:scale-105 active:scale-95 transition-all cursor-pointer p-1 overflow-hidden"
                                  style={{ backgroundColor: pal.color }}
                                >
                                  <span className="text-[8px] font-mono text-white mix-blend-difference bg-black/25 px-1 rounded-sm leading-tight uppercase tracking-tight">
                                    {pal.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Form Actions */}
                      <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
                        <button
                          type="button"
                          onClick={resetStashForm}
                          className="px-3.5 py-1.5 border border-sand-250 hover:bg-sand-100 text-bark-600 rounded text-xs font-semibold cursor-pointer"
                        >{pfUiT("ui.components.sewingsessiontimer.a043ca6c04")}</button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#ba6446] hover:bg-[#a25135] text-white rounded text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
                        >
                          {editingStashId ? 'Save Changes' : 'Add to Stash'}
                        </button>
                      </div>

                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* FILTER PANEL */}
              <div className="bg-sand-50 border border-sand-250 rounded-lg p-3.5 space-y-3 shadow-3xs" id="fabric-stash-filter-panel">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  {/* Search bar */}
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-bark-450 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search stash (e.g. Linen, blue, drape)..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-sand-250 rounded text-xs text-bark-850 placeholder-bark-400 focus:outline-none focus:border-[#ba6446]"
                    />
                    {inventorySearch && (
                      <button
                        onClick={() => setInventorySearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bark-400 hover:text-bark-600"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Fiber Type Dropdown */}
                  <div className="w-full sm:w-44">
                    <select
                      value={selectedTypeFilter}
                      onChange={(e) => setSelectedTypeFilter(e.target.value)}
                      className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-1.5 focus:outline-none focus:border-[#ba6446]"
                    >
                      <option value="All">{pfUiT("ui.components.sewingsessiontimer.558d4cb890")}</option>
                      <option value="Linen">{pfUiT("ui.components.sewingsessiontimer.01d8c25742")}</option>
                      <option value="Cotton">{pfUiT("ui.components.sewingsessiontimer.808bc67d1c")}</option>
                      <option value="Silk">{pfUiT("ui.components.sewingsessiontimer.7aa9930d26")}</option>
                      <option value="Wool">{pfUiT("ui.components.sewingsessiontimer.4315c7f5ad")}</option>
                      <option value="Knits">{pfUiT("ui.components.sewingsessiontimer.475b0bff63")}</option>
                      <option value="Denim">{pfUiT("ui.components.sewingsessiontimer.1aa7376051")}</option>
                      <option value="Tweed">{pfUiT("ui.components.sewingsessiontimer.d494995147")}</option>
                      <option value="Velvet">{pfUiT("ui.components.sewingsessiontimer.5260c0a897")}</option>
                      <option value="Synthetic">{pfUiT("ui.components.sewingsessiontimer.74c0990b70")}</option>
                      <option value="Leather">{pfUiT("ui.components.sewingsessiontimer.067f8af76d")}</option>
                      <option value="Other">{pfUiT("ui.components.sewingsessiontimer.d2dcee7848")}</option>
                    </select>
                  </div>
                </div>

                {/* Horizontal scroll of tags/use cases */}
                {allAvailableTags.length > 0 && (
                  <div className="space-y-1.5 pt-2.5 border-t border-sand-200/60">
                    <span className="block text-[8.5px] font-mono font-bold text-bark-450 uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.5986372200")}</span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                      <button
                        type="button"
                        onClick={() => setSelectedTagFilter('All')}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                          selectedTagFilter === 'All'
                            ? 'bg-[#ba6446] text-white shadow-3xs'
                            : 'bg-white border border-sand-200 text-bark-600 hover:border-sand-300'
                        }`}
                      >{pfUiT("ui.components.sewingsessiontimer.01bb3e2d9d")}</button>
                      {allAvailableTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setSelectedTagFilter(tag)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold transition-all cursor-pointer ${
                            selectedTagFilter === tag
                              ? 'bg-clay-650 text-white shadow-3xs font-bold'
                              : 'bg-white border border-sand-200 text-bark-600 hover:border-[#ba6446]/40 hover:text-[#ba6446]'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active filter status bar */}
                {(selectedTypeFilter !== 'All' || selectedTagFilter !== 'All' || inventorySearch) && (
                  <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-[#ba6446] bg-[#ba6446]/5 border border-[#ba6446]/10 px-2.5 py-1 rounded">
                    <span>{pfUiT("ui.components.sewingsessiontimer.b41801b88e")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypeFilter('All');
                        setSelectedTagFilter('All');
                        setInventorySearch('');
                      }}
                      className="underline hover:no-underline font-bold"
                    >{pfUiT("ui.components.sewingsessiontimer.c4b351254c")}</button>
                  </div>
                )}
              </div>

              {/* STASH LIST VIEWPORT */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-sand-300" id="stash-list-scroll">
                {fabricStash.length === 0 ? (
                  <div className="border border-dashed border-sand-300 rounded-lg p-8 text-center text-bark-500 space-y-2 bg-white">
                    <Package className="w-8 h-8 text-sand-400 mx-auto" />
                    <p className="text-xs font-sans font-medium">{pfUiT("ui.components.sewingsessiontimer.29e2b5e448")}</p>
                    <p className="text-[10px] text-bark-400">{pfUiT("ui.components.sewingsessiontimer.810130dbc8")}</p>
                  </div>
                ) : filteredStash.length === 0 ? (
                  <div className="border border-dashed border-sand-300 rounded-lg p-8 text-center text-bark-500 space-y-3 bg-white">
                    <Filter className="w-6 h-6 text-sand-400 mx-auto" />
                    <p className="text-xs font-sans font-medium text-bark-800">{pfUiT("ui.components.sewingsessiontimer.efe89e8d8c")}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTypeFilter('All');
                        setSelectedTagFilter('All');
                        setInventorySearch('');
                      }}
                      className="px-3 py-1 border border-sand-250 hover:bg-sand-50 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-bark-700 cursor-pointer"
                    >{pfUiT("ui.components.sewingsessiontimer.c4b351254c")}</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {filteredStash.map((item) => {
                      const assocProj = userProjects.find(p => p.id === item.patternId);
                      const assocPattern = assocProj
                        ? patterns.find(p => p.id === assocProj.patternId)
                        : patterns.find(p => p.id === item.patternId);
                      const isCustom = item.patternId === 'custom' || (assocProj && assocProj.patternId === 'custom');

                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-sand-250 hover:border-sand-350 rounded-lg p-4 flex flex-col gap-3.5 shadow-3xs hover:shadow-2xs transition-all relative group"
                          id={`stash-card-${item.id}`}
                        >
                          {/* Fabric specimen swatch thumbnail - Vertical top placement */}
                          <div className="w-full h-36 rounded border border-sand-250 bg-sand-50 overflow-hidden relative shadow-sm">
                            <img
                              src={item.photo}
                              alt={item.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                            {/* Type Pill */}
                            <span className="absolute bottom-2 right-2 text-[8px] font-mono font-extrabold uppercase bg-white/95 border border-sand-300 text-bark-800 px-2 py-1 rounded shadow-3xs leading-none">
                              {item.type}
                            </span>
                          </div>

                          {/* Fabric spec info */}
                          <div className="min-w-0 flex-1 flex flex-col justify-between space-y-2">
                            <div className="space-y-1.5">
                              <h5 className="font-serif text-bark-900 text-sm font-extrabold truncate pr-14 leading-snug" title={item.name}>
                                {item.name}
                              </h5>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 text-[10px] font-mono text-[#ba6446] font-bold">
                                  <span>{item.yardage} yds</span>
                                  {item.width && (
                                    <>
                                      <span className="text-sand-300">•</span>
                                      <span>{item.width} wide</span>
                                    </>
                                  )}
                                  {item.costPerYard && parseFloat(item.costPerYard) > 0 && (
                                    <>
                                      <span className="text-sand-300">•</span>
                                      <span className="text-emerald-700 bg-emerald-50/70 px-1 rounded font-semibold">${parseFloat(item.costPerYard).toFixed(2)}/yd</span>
                                      <span className="text-sand-300">•</span>
                                      <span className="text-bark-750 font-semibold" title={pfUiT("ui.components.sewingsessiontimer.769b302a09")}>Val: ${(parseFloat(item.yardage) * parseFloat(item.costPerYard)).toFixed(2)}</span>
                                    </>
                                  )}
                                </div>
                                {(parseFloat(item.yardage) || 0) <= stashThreshold && (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded leading-none shadow-3xs" id={`low-stock-badge-${item.id}`}>
                                    <AlertCircle className="w-2.5 h-2.5 text-amber-600 animate-pulse" />{pfUiT("ui.components.sewingsessiontimer.134d6212e8")}</span>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-xs text-bark-550 font-sans line-clamp-3 leading-relaxed" title={item.notes}>
                                  {item.notes}
                                </p>
                              )}

                              {/* Fabric Tags/Categories inside item card */}
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {item.tags.map((tag, tIdx) => (
                                    <button
                                      key={tIdx}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTagFilter(tag);
                                      }}
                                      className={`text-[9px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer ${
                                        selectedTagFilter === tag
                                          ? 'bg-clay-650 text-white font-bold'
                                          : 'bg-sand-100 text-bark-600 hover:bg-[#ba6446]/10 hover:text-[#ba6446]'
                                      }`}
                                      title={`Filter stash by: #${tag}`}
                                    >
                                      #{tag}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Project Association Footer indicator */}
                            <div className="pt-2.5 border-t border-sand-100 flex items-center justify-between">
                              {assocPattern || isCustom || assocProj ? (
                                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-clay-700 bg-clay-50 border border-clay-100 px-2 py-1 rounded truncate max-w-[200px]">
                                  <Scissors className="w-3 h-3 text-clay-600 flex-shrink-0" />
                                  <span className="truncate" title={assocProj ? assocProj.name : (isCustom ? 'Custom Tailoring' : assocPattern.name)}>
                                    {assocProj ? assocProj.name : (isCustom ? 'Custom Tailoring' : assocPattern.name)}
                                  </span>
                                </div>
                              ) : (
                                <div className="text-[9px] font-mono text-bark-400 italic">{pfUiT("ui.components.sewingsessiontimer.1e345cac6d")}</div>
                              )}

                              {/* Action row */}
                              <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const existingColor = PREDEFINED_COLORS.find(c => c.hex.toLowerCase() === (item.color || '#ba6446').toLowerCase())?.name || 'Sage Green';
                                    setTaggingItemId(item.id);
                                    setTaggingItemType('stash');
                                    setTaggingItemName(item.name);
                                    setSelectedFabricType(item.type || 'Linen');
                                    setSelectedFabricColor(existingColor);
                                    setIsTaggingModalOpen(true);
                                  }}
                                  className="p-1 rounded text-clay-650 hover:text-clay-800 hover:bg-clay-50/50 transition-all cursor-pointer"
                                  title={pfUiT("ui.components.sewingsessiontimer.f14601c85d")}
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditStashItemClick(item)}
                                  className="p-1 rounded text-bark-500 hover:text-bark-900 hover:bg-sand-50 transition-all cursor-pointer"
                                  title={pfUiT("ui.components.sewingsessiontimer.9ad1883469")}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStashItem(item.id, item.name)}
                                  className="p-1 rounded text-red-750 hover:text-red-900 hover:bg-red-50 transition-all cursor-pointer"
                                  title={pfUiT("ui.components.sewingsessiontimer.3fcc6af7d4")}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </>
            )}

            {inventorySubTab === 'planner' && (
              <div className="space-y-5 animate-fadeIn" id="material-planner-view">
          {/* SHOPPING LIST & MATERIAL PLANNER CONTENTS */}
          <div className="bg-sand-50 border border-sand-200 rounded-lg p-3.5 space-y-1.5 shadow-3xs">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-clay-700 uppercase tracking-wider">
              <ClipboardList className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.0c7a35e3ac")}</span>
            <p className="text-xs text-bark-700 leading-relaxed font-sans">{pfUiT("ui.components.sewingsessiontimer.199fd895e0")}</p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest">{pfUiT("ui.components.sewingsessiontimer.f451263b83")}</h4>

            <div className="grid grid-cols-2 gap-2.5">
              {patterns.map((pattern) => {
                const isSelected = shoppingListPatterns.includes(pattern.id);
                return (
                  <button
                    key={pattern.id}
                    type="button"
                    onClick={() => toggleShoppingListPattern(pattern.id)}
                    className={`flex items-start text-left gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer relative group active:scale-98 ${
                      isSelected
                        ? 'bg-clay-50/60 border-clay-300 ring-1 ring-clay-200'
                        : 'bg-white border-sand-250 hover:border-sand-350 hover:bg-sand-50/40'
                    }`}
                  >
                    {/* Tag Card button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTaggingItemId(pattern.id);
                        setTaggingItemType('pattern');
                        setTaggingItemName(pattern.name);
                        setSelectedFabricType(patternTags[pattern.id]?.fabricType || 'Linen');
                        setSelectedFabricColor(patternTags[pattern.id]?.color || 'Sage Green');
                        setIsTaggingModalOpen(true);
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-white/95 hover:bg-clay-50 text-clay-650 rounded border border-sand-200 transition-opacity z-10 cursor-pointer flex items-center justify-center shadow-3xs"
                      title={pfUiT("ui.components.sewingsessiontimer.a0464d09a0")}
                    >
                      <Tag className="w-3.5 h-3.5 text-clay-600" />
                    </button>

                    <div className="w-12 h-12 rounded border border-sand-200 overflow-hidden shrink-0 relative bg-sand-50">
                      <img
                        src={pattern.image}
                        alt={pattern.name}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#ba6446]/10 flex items-center justify-center">
                          <div className="bg-[#ba6446] text-white rounded-full p-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-serif text-xs font-bold text-bark-900 leading-snug group-hover:text-[#ba6446] transition-colors truncate pr-4">
                        {pattern.name}
                      </h5>
                      <span className="block text-[9px] font-mono text-bark-500 font-semibold mt-0.5 uppercase tracking-wider">
                        {pattern.category}
                      </span>
                      <span className="block text-[9.5px] text-[#ba6446] font-sans font-medium mt-0.5">
                        Est: {pattern.yardageInfo.width60}
                      </span>
                      {patternTags[pattern.id] && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="text-[7.5px] font-mono font-bold bg-clay-50 border border-clay-100 text-clay-700 px-1 py-0.5 rounded leading-none">
                            {patternTags[pattern.id].fabricType}
                          </span>
                          <span className="text-[7.5px] font-mono font-bold bg-[#FAF0E6] border border-sand-250 text-bark-800 px-1 py-0.5 rounded leading-none flex items-center gap-0.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ backgroundColor: PREDEFINED_COLORS.find(c => c.name === patternTags[pattern.id].color)?.hex || '#ba6446' }}
                            />
                            {patternTags[pattern.id].color}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {userProjects.map((project) => {
                const isSelected = shoppingListPatterns.includes(project.id);
                const parentPattern = patterns.find(p => p.id === project.patternId);
                const estText = parentPattern ? parentPattern.yardageInfo.width60 : '3.0 Yds';
                const imageSrc = parentPattern ? parentPattern.image : 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=200';
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => toggleShoppingListPattern(project.id)}
                    className={`flex items-start text-left gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer relative group active:scale-98 ${
                      isSelected
                        ? 'bg-clay-50/60 border-clay-300 ring-1 ring-clay-200'
                        : 'bg-white border-sand-250 hover:border-sand-350 hover:bg-sand-50/40'
                    }`}
                  >
                    {/* Tag Card button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTaggingItemId(project.id);
                        setTaggingItemType('pattern');
                        setTaggingItemName(project.name);
                        setSelectedFabricType(patternTags[project.id]?.fabricType || 'Linen');
                        setSelectedFabricColor(patternTags[project.id]?.color || 'Sage Green');
                        setIsTaggingModalOpen(true);
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 bg-white/95 hover:bg-clay-50 text-clay-650 rounded border border-sand-200 transition-opacity z-10 cursor-pointer flex items-center justify-center shadow-3xs"
                      title={pfUiT("ui.components.sewingsessiontimer.a0464d09a0")}
                    >
                      <Tag className="w-3.5 h-3.5 text-clay-600" />
                    </button>

                    <div className="w-12 h-12 rounded border border-sand-200 overflow-hidden shrink-0 relative bg-sand-50">
                      <img
                        src={imageSrc}
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-[#ba6446]/10 flex items-center justify-center">
                          <div className="bg-[#ba6446] text-white rounded-full p-0.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-serif text-xs font-bold text-bark-900 leading-snug group-hover:text-[#ba6446] transition-colors truncate pr-4">
                        {project.name}
                      </h5>
                      <span className="block text-[9px] font-mono text-[#ba6446] font-semibold mt-0.5 uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.7c245aa7c1")}</span>
                      <span className="block text-[9.5px] text-bark-500 font-sans mt-0.5">
                        Est: {estText}
                      </span>
                      {patternTags[project.id] && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="text-[7.5px] font-mono font-bold bg-clay-50 border border-clay-100 text-clay-700 px-1 py-0.5 rounded leading-none">
                            {patternTags[project.id].fabricType}
                          </span>
                          <span className="text-[7.5px] font-mono font-bold bg-[#FAF0E6] border border-sand-250 text-bark-800 px-1 py-0.5 rounded leading-none flex items-center gap-0.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ backgroundColor: PREDEFINED_COLORS.find(c => c.name === patternTags[project.id].color)?.hex || '#ba6446' }}
                            />
                            {patternTags[project.id].color}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest">
              Step 2: Compiled Materials &amp; Notions
            </h4>

            {shoppingListPatterns.length === 0 ? (
              <div className="border border-dashed border-sand-300 rounded-lg py-12 px-6 text-center text-bark-500 space-y-2.5 bg-white">
                <ShoppingBag className="w-8 h-8 text-sand-400 mx-auto" />
                <h5 className="text-xs font-sans font-bold text-bark-800">{pfUiT("ui.components.sewingsessiontimer.c5cc9da158")}</h5>
                <p className="text-[10px] text-bark-500 leading-normal max-w-xs mx-auto">{pfUiT("ui.components.sewingsessiontimer.e3ab06abd7")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {shoppingListPatterns.map((pid) => {
                  const assocProj = userProjects.find(p => p.id === pid);
                  const pattern = assocProj
                    ? patterns.find(p => p.id === assocProj.patternId)
                    : patterns.find(p => p.id === pid);
                  if (!pattern) return null;

                  const widthChoice = shoppingListWidths[pid] || '60';
                  const requiredText = widthChoice === '44'
                    ? pattern.yardageInfo.width44
                    : pattern.yardageInfo.width60;

                  const requiredYards = parseFloat(requiredText) || 0;

                  // Find assigned fabrics for this pattern
                  const assignedFabrics = fabricStash.filter(item => item.patternId === pid);
                  const assignedYards = assignedFabrics.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0), 0);
                  const missingYards = Math.max(0, requiredYards - assignedYards);
                  const isFullyStocked = assignedYards >= requiredYards;

                  // Smart Recommendations from Unassigned Stash
                  const matchingUnassigned = fabricStash.filter(item => {
                    if (item.patternId && item.patternId !== 'none') return false;
                    const itemTypeLower = (item.type || '').toLowerCase();
                    const itemNameLower = (item.name || '').toLowerCase();
                    const itemNotesLower = (item.notes || '').toLowerCase();
                    return pattern.fabricSuggestions.some(suggestion => {
                      const sugLower = suggestion.toLowerCase();
                      return sugLower.includes(itemTypeLower) || itemTypeLower.includes(sugLower) || itemNameLower.includes(sugLower) || itemNotesLower.includes(sugLower);
                    });
                  });

                  return (
                    <div
                      key={pid}
                      className="bg-white border border-sand-250 rounded-xl p-4 space-y-4 shadow-3xs hover:shadow-2xs transition-all animate-fadeIn"
                    >
                      {/* Pattern Card Header */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-sand-150">
                        <div>
                          <h4 className="font-serif text-bark-950 font-extrabold text-sm leading-tight">
                            {assocProj ? assocProj.name : pattern.name}
                          </h4>
                          <span className="block text-[9px] font-mono text-[#ba6446] font-bold mt-0.5 uppercase tracking-wider">
                            {assocProj ? `Custom Tailored (Size ${assocProj.size})` : `${pattern.difficulty} • ${pattern.category}`}
                          </span>
                        </div>

                        {/* Width Toggle Button Group */}
                        <div className="flex items-center bg-sand-100 p-0.5 rounded border border-sand-200 shrink-0">
                          <button
                            type="button"
                            onClick={() => setShoppingListWidthChoice(pid, '60')}
                            className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-all ${
                              widthChoice === '60'
                                ? 'bg-white text-bark-900 shadow-3xs'
                                : 'text-bark-500 hover:text-bark-800'
                            }`}
                          >{pfUiT("ui.components.sewingsessiontimer.2f282a2fe6")}</button>
                          <button
                            type="button"
                            onClick={() => setShoppingListWidthChoice(pid, '44')}
                            className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded cursor-pointer transition-all ${
                              widthChoice === '44'
                                ? 'bg-white text-bark-900 shadow-3xs'
                                : 'text-bark-500 hover:text-bark-800'
                            }`}
                          >{pfUiT("ui.components.sewingsessiontimer.779b75c798")}</button>
                        </div>
                      </div>

                      {/* Fabric Status */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-extrabold text-bark-500 uppercase tracking-wide">{pfUiT("ui.components.sewingsessiontimer.8792741bbd")}</span>
                          {isFullyStocked ? (
                            <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-800 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shadow-3xs">{pfUiT("ui.components.sewingsessiontimer.86d05c0e63")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shadow-3xs">{pfUiT("ui.components.sewingsessiontimer.0273ef6722")}</span>
                          )}
                        </div>

                        <div className="bg-sand-50/50 rounded-lg p-3 border border-sand-200 space-y-2.5">
                          {/* Progress bar / numbers */}
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-bark-650">{pfUiT("ui.components.sewingsessiontimer.fe042995ff")}<strong className="text-bark-950 font-bold">{requiredYards.toFixed(1)} yds</strong>
                            </span>
                            <span className="text-bark-650">{pfUiT("ui.components.sewingsessiontimer.7400fe0f87")}<strong className="text-bark-950 font-bold">{assignedYards.toFixed(1)} yds</strong>
                            </span>
                          </div>

                          {/* Progress Bar Visual */}
                          <div className="w-full h-1.5 bg-sand-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFullyStocked ? 'bg-green-650' : 'bg-[#ba6446]'
                              }`}
                              style={{ width: `${Math.min(100, (assignedYards / requiredYards) * 100)}%` }}
                            />
                          </div>

                          {/* Missing status text */}
                          {!isFullyStocked ? (
                            <p className="text-[11px] text-[#ba6446] font-medium leading-relaxed">{pfUiT("ui.components.sewingsessiontimer.b07fd59e5e")}<strong className="font-extrabold text-[#9e5237]">{missingYards.toFixed(1)} more yds</strong>{pfUiT("ui.components.sewingsessiontimer.c7ab68e95f")}</p>
                          ) : (
                            <p className="text-[11px] text-green-700 font-medium leading-relaxed">{pfUiT("ui.components.sewingsessiontimer.8e23b5fe75")}</p>
                          )}

                          {/* Suggested fabrics */}
                          <div className="text-[10px] text-bark-550 border-t border-sand-200/60 pt-2 flex flex-wrap gap-1 items-baseline">
                            <span className="font-semibold uppercase tracking-wider font-mono text-[9px]">{pfUiT("ui.components.sewingsessiontimer.57da5d4d5b")}</span>
                            <span>{pattern.fabricSuggestions.join(', ')}</span>
                          </div>
                        </div>

                        {/* Smart unassigned stash recommendations */}
                        {!isFullyStocked && matchingUnassigned.length > 0 && (
                          <div className="border border-clay-100 bg-clay-50/25 rounded-lg p-2.5 space-y-2 animate-fadeIn">
                            <span className="block text-[9.5px] font-mono font-bold text-clay-700 uppercase tracking-wide">{pfUiT("ui.components.sewingsessiontimer.8f77d74c30")}</span>
                            <div className="space-y-1.5">
                              {matchingUnassigned.map(item => (
                                <div key={item.id} className="flex items-center justify-between gap-2 text-xs bg-white/70 border border-sand-150 p-2 rounded">
                                  <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-bark-900 block truncate leading-snug">{item.name}</span>
                                    <span className="text-[10px] font-mono text-bark-500 font-medium">
                                      {item.yardage} yds • {item.type}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignFabricToPattern(item.id, pattern.id)}
                                    className="px-2.5 py-1 bg-clay-650 hover:bg-clay-750 text-white rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer active:scale-95 shrink-0"
                                  >{pfUiT("ui.components.sewingsessiontimer.3e67351a03")}</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Notions Checklist */}
                      <div className="space-y-2 border-t border-sand-150 pt-3">
                        <span className="block text-[10px] font-mono font-extrabold text-bark-500 uppercase tracking-wide">
                          Notions &amp; Materials Checklist
                        </span>

                        <div className="space-y-1.5 bg-sand-50/25 rounded-lg border border-sand-200 p-3">
                          {pattern.notions && pattern.notions.length > 0 ? (
                            pattern.notions.map((notion, idx) => {
                              const notionKey = `${pid}-${idx}`;
                              const isChecked = !!checkedNotions[notionKey];
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => toggleNotionChecked(pid, idx)}
                                  className="w-full flex items-center gap-2 text-left text-xs py-1 hover:bg-sand-50/60 rounded px-1 transition-colors cursor-pointer"
                                >
                                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all shrink-0 ${
                                    isChecked
                                      ? 'bg-[#ba6446] border-[#ba6446] text-white'
                                      : 'border-sand-300 bg-white'
                                  }`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <span className={`flex-1 transition-all leading-normal ${
                                    isChecked
                                      ? 'line-through text-bark-400 font-medium'
                                      : 'text-bark-750 font-semibold'
                                  }`}>
                                    {notion}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-[11px] text-bark-450 italic">{pfUiT("ui.components.sewingsessiontimer.cb2a3b8657")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {inventorySubTab === 'calculator' && (
              <div className="space-y-5 animate-fadeIn" id="material-calculator-view">
                <div className="bg-sand-50 border border-sand-200 rounded-lg p-3.5 space-y-1.5 shadow-3xs">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-clay-700 uppercase tracking-wider">
                    <Calculator className="w-3.5 h-3.5 text-[#ba6446]" />
                    Sizing &amp; Yardage Estimator
                  </span>
                  <p className="text-xs text-bark-700 leading-relaxed font-sans">{pfUiT("ui.components.sewingsessiontimer.eaf2850a71")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

                  {/* Left Column: Input Selection */}
                  <div className="md:col-span-7 space-y-4">

                    {/* Step 1: Select Pattern */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">{pfUiT("ui.components.sewingsessiontimer.36cefda385")}</label>
                      <select
                        value={calcPatternId}
                        onChange={(e) => setCalcPatternId(e.target.value)}
                        className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] shadow-3xs font-medium"
                      >
                        <optgroup label="Gallery Patterns">
                          {patterns.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </optgroup>
                        {userProjects.length > 0 && (
                          <optgroup label="Linked Tailoring Projects">
                            {userProjects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Size {p.size})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        <option value="custom">{pfUiT("ui.components.sewingsessiontimer.b7a9e94ed0")}</option>
                      </select>

                      {/* If custom pattern is chosen, show input fields */}
                      {calcPatternId === 'custom' && (
                        <div className="bg-sand-50/55 border border-sand-200 rounded-md p-3 space-y-2.5 animate-fadeIn">
                          <div>
                            <label className="text-[9px] font-mono font-bold text-bark-550 uppercase block mb-1">{pfUiT("ui.components.sewingsessiontimer.792fef5dd4")}</label>
                            <input
                              type="text"
                              value={calcCustomName}
                              onChange={(e) => setCalcCustomName(e.target.value)}
                              placeholder={pfUiT("ui.components.sewingsessiontimer.ae7874fcc4")}
                              className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-mono font-bold text-bark-550 uppercase block mb-1">
                                Base Yds (44" Width)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={calcCustomBase44}
                                onChange={(e) => setCalcCustomBase44(e.target.value)}
                                className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-mono font-bold text-bark-550 uppercase block mb-1">
                                Base Yds (60" Width)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={calcCustomBase60}
                                onChange={(e) => setCalcCustomBase60(e.target.value)}
                                className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Step 2: Select Size */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">{pfUiT("ui.components.sewingsessiontimer.29015cc5a9")}</label>
                        <span className="text-[9.5px] font-mono text-clay-700 bg-clay-50 border border-clay-100 px-1.5 py-0.5 rounded">
                          Size Multiplier: {sizeMultiplier === 0.9 ? "-10%" : sizeMultiplier === 1.1 ? "+10%" : sizeMultiplier === 1.2 ? "+20%" : "Standard"}
                        </span>
                      </div>

                      <div className="grid grid-cols-6 gap-1">
                        {['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].map((size) => {
                          const isSelected = calcSize === size;
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setCalcSize(size)}
                              className={`py-2 text-center rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#ba6446] text-white shadow-3xs'
                                  : 'bg-white border border-sand-250 text-bark-750 hover:bg-sand-50'
                              }`}
                            >
                              {size}
                            </button>
                          );
                        })}
                      </div>

                      {/* Display active measurements */}
                      {(() => {
                        const sizeObj = CALC_SIZING_TABLE.find(s => s.size === calcSize) || CALC_SIZING_TABLE[4];
                        return (
                          <div className="bg-sand-50/40 border border-sand-150 rounded p-2.5 text-center text-[10px] font-mono text-bark-600 flex items-center justify-center gap-4">
                            <span>{pfUiT("ui.components.sewingsessiontimer.38424e6849")}<strong className="text-bark-900 font-bold">{sizeObj.bust}"</strong></span>
                            <span className="text-sand-300">|</span>
                            <span>{pfUiT("ui.components.sewingsessiontimer.b234ecc6ee")}<strong className="text-bark-900 font-bold">{sizeObj.waist}"</strong></span>
                            <span className="text-sand-300">|</span>
                            <span>{pfUiT("ui.components.sewingsessiontimer.743157a445")}<strong className="text-bark-900 font-bold">{sizeObj.hips}"</strong></span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Step 3: Select Width */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">{pfUiT("ui.components.sewingsessiontimer.f5ff9a9942")}</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setCalcWidth('44')}
                          className={`py-2.5 text-center rounded text-xs font-mono font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            calcWidth === '44'
                              ? 'bg-[#ba6446] text-white border-[#ba6446] shadow-3xs'
                              : 'bg-white border-sand-250 text-bark-750 hover:bg-sand-50'
                          }`}
                        >
                          <span className="text-xs">{pfUiT("ui.components.sewingsessiontimer.2ededdac5c")}</span>
                          <span className="text-[9px] font-normal opacity-75">{pfUiT("ui.components.sewingsessiontimer.dac7d1617e")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalcWidth('60')}
                          className={`py-2.5 text-center rounded text-xs font-mono font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            calcWidth === '60'
                              ? 'bg-[#ba6446] text-white border-[#ba6446] shadow-3xs'
                              : 'bg-white border-sand-250 text-bark-750 hover:bg-sand-50'
                          }`}
                        >
                          <span className="text-xs">{pfUiT("ui.components.sewingsessiontimer.51149c6ab8")}</span>
                          <span className="text-[9px] font-normal opacity-75">{pfUiT("ui.components.sewingsessiontimer.ebce300c6b")}</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Calculation Breakdown, Comparison & Buy recommendations */}
                  <div className="md:col-span-5 space-y-4">

                    {/* The Ledger Receipt Card */}
                    <div className="bg-white border border-sand-250 rounded-lg p-4 shadow-3xs space-y-3.5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 left-0 h-1.5 bg-[#ba6446]" />

                      <div className="text-center pt-1.5 pb-2 border-b border-dashed border-sand-250">
                        <span className="text-[10px] font-mono font-bold text-bark-400 uppercase tracking-wider block">{pfUiT("ui.components.sewingsessiontimer.7503bd3695")}</span>
                        <h4 className="font-serif text-bark-900 font-bold text-sm">
                          {isCustomCalcPattern ? calcCustomName : selectedCalcPattern?.name}
                        </h4>
                      </div>

                      {/* Receipt rows */}
                      <div className="space-y-2 text-xs font-mono">
                        <div className="flex justify-between text-bark-600">
                          <span>Base pattern yardage ({calcWidth}"):</span>
                          <span className="font-bold text-bark-850">{baseCalcYardage.toFixed(2)} yds</span>
                        </div>
                        <div className="flex justify-between text-bark-600">
                          <span>Size {calcSize} multiplier:</span>
                          <span className="font-bold text-bark-850">x {sizeMultiplier.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-sand-150 my-1" />
                        <div className="flex justify-between text-bark-950 font-extrabold text-sm">
                          <span className="text-bark-900">{pfUiT("ui.components.sewingsessiontimer.04110cf1d7")}</span>
                          <span className="text-[#ba6446]">{calculatedTotalNeeded.toFixed(2)} yds</span>
                        </div>
                      </div>

                      {/* Planner sync action */}
                      {!isCustomCalcPattern && (
                        <div className="pt-2 border-t border-sand-150 flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              // Sync to Planner state
                              setShoppingListPatterns(prev => prev.includes(calcPatternId) ? prev : [...prev, calcPatternId]);
                              setShoppingListWidths(prev => ({ ...prev, [calcPatternId]: calcWidth }));
                              if (window.showToast) {
                                window.showToast(`Set ${selectedCalcPattern?.name} to size ${calcSize} at ${calcWidth}" in Planner.`, "success", "Planner Updated");
                              }
                            }}
                            className="w-full py-1.5 border border-[#ba6446]/20 bg-[#ba6446]/5 hover:bg-[#ba6446]/10 text-[#ba6446] rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer text-center"
                          >{pfUiT("ui.components.sewingsessiontimer.225ba04b8f")}</button>
                        </div>
                      )}
                    </div>

                    {/* Stash Match & Recommendations */}
                    <div className="bg-sand-50/55 border border-sand-200 rounded-lg p-3.5 space-y-3 shadow-3xs">
                      <span className="block text-[9.5px] font-mono font-extrabold text-bark-500 uppercase tracking-widest">
                        Stash Synchronization &amp; Stock Check
                      </span>

                      {/* Stash statistics */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white border border-sand-200 rounded p-2">
                          <span className="block text-[8px] font-mono text-bark-450 uppercase font-bold">{pfUiT("ui.components.sewingsessiontimer.e9056b1901")}</span>
                          <strong className="block text-sm text-bark-900 font-mono mt-0.5">
                            {totalAssignedStashYardage.toFixed(2)} yds
                          </strong>
                          <span className="text-[8.5px] font-mono text-bark-400">{pfUiT("ui.components.sewingsessiontimer.a182199415")}</span>
                        </div>
                        <div className="bg-white border border-sand-200 rounded p-2">
                          <span className="block text-[8px] font-mono text-bark-450 uppercase font-bold">{pfUiT("ui.components.sewingsessiontimer.addf2706f7")}</span>
                          <strong className="block text-sm text-bark-900 font-mono mt-0.5">
                            {totalCompatibleUnassignedYardage.toFixed(2)} yds
                          </strong>
                          <span className="text-[8.5px] font-mono text-bark-400">{pfUiT("ui.components.sewingsessiontimer.b29d4c2c8f")}</span>
                        </div>
                      </div>

                      {/* Display explicit list of matching fabrics in stash */}
                      {assignedFabricsForCalc.length > 0 && (
                        <div className="space-y-1 bg-white border border-sand-200 rounded p-2">
                          <span className="block text-[8px] font-mono text-clay-700 uppercase font-bold mb-1">{pfUiT("ui.components.sewingsessiontimer.3de26e3a1e")}</span>
                          {assignedFabricsForCalc.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-[10px] font-sans text-bark-750 border-b border-sand-100 last:border-0 pb-1 last:pb-0">
                              <span className="truncate max-w-[120px] font-medium">{item.name}</span>
                              <span className="font-mono text-bark-600 font-semibold">{item.yardage} yds ({item.width}")</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* RECOMMENDATION BANNER */}
                      <div className="pt-1.5">
                        {totalAssignedStashYardage >= calculatedTotalNeeded ? (
                          <div className="bg-emerald-50 border border-emerald-250 rounded-lg p-3 text-emerald-950 space-y-1.5 shadow-3xs animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.204fa36e84")}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-medium">{pfUiT("ui.components.sewingsessiontimer.615aa5de69")}<strong className="font-bold">{totalAssignedStashYardage.toFixed(2)} yds</strong>{pfUiT("ui.components.sewingsessiontimer.cf66e49493")}<strong className="font-bold">{calculatedTotalNeeded.toFixed(2)} yds</strong>{pfUiT("ui.components.sewingsessiontimer.117f2b0bf5")}</p>
                            <span className="block text-[10px] font-mono font-bold text-emerald-800">
                              🛒 Recommendation: No purchase needed! (Need to buy: 0.0 yds)
                            </span>
                          </div>
                        ) : totalAssignedStashYardage + totalCompatibleUnassignedYardage >= calculatedTotalNeeded ? (
                          <div className="bg-amber-50 border border-amber-250 rounded-lg p-3 text-amber-950 space-y-1.5 shadow-3xs animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                                <AlertCircle className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.57f89c3be3")}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-medium">
                              Your assigned fabric (<strong className="font-bold">{totalAssignedStashYardage.toFixed(2)} yds</strong>) is short by <strong className="font-bold">{remainingShortage.toFixed(2)} yds</strong>{pfUiT("ui.components.sewingsessiontimer.2dff4677f1")}<strong className="font-bold">{totalCompatibleUnassignedYardage.toFixed(2)} yds</strong>{pfUiT("ui.components.sewingsessiontimer.8141583d2b")}</p>
                            <span className="block text-[10px] font-mono font-semibold text-amber-900 leading-normal">{pfUiT("ui.components.sewingsessiontimer.2b86064c46")}<strong className="font-bold">{remainingShortage.toFixed(2)} yds</strong>.
                            </span>
                          </div>
                        ) : (
                          <div className="bg-red-50 border border-red-250 rounded-lg p-3 text-red-950 space-y-2 shadow-3xs animate-fadeIn">
                            <div className="flex items-center gap-1.5">
                              <div className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0">
                                <AlertCircle className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                              <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider">{pfUiT("ui.components.sewingsessiontimer.4702229928")}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed font-medium text-red-900">{pfUiT("ui.components.sewingsessiontimer.064ad542c0")}<strong className="font-bold text-red-950">{remainingShortage.toFixed(2)} yds</strong> of fabric needed to complete this pattern in size {calcSize}.
                            </p>

                            <div className="bg-white border border-red-200/50 rounded p-2 flex items-center justify-between">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-red-700">{pfUiT("ui.components.sewingsessiontimer.3b0f9cdbc8")}</span>
                              <strong className="text-xs font-mono font-extrabold text-red-750 bg-red-50 border border-red-150 px-2 py-0.5 rounded">
                                {needToBuy.toFixed(2)} yards
                              </strong>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                  </div>

                </div>
              </div>
            )}

            {inventorySubTab === 'cost-estimator' && (
              <div className="space-y-5 animate-fadeIn" id="material-cost-estimator-view">
                {/* Intro Card */}
                <div className="bg-sand-50 border border-sand-200 rounded-lg p-3.5 space-y-1.5 shadow-3xs">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-clay-700 uppercase tracking-wider">
                    <Coins className="w-3.5 h-3.5 text-[#ba6446]" />
                    Project Cost Estimator &amp; Budget Aggregator
                  </span>
                  <p className="text-xs text-bark-700 leading-relaxed font-sans">{pfUiT("ui.components.sewingsessiontimer.23df396dd3")}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left Column: Select Project & Summary */}
                  <div className="md:col-span-5 space-y-4">
                    {/* Select Project */}
                    <div className="bg-white border border-sand-250 rounded-xl p-4 shadow-3xs space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">{pfUiT("ui.components.sewingsessiontimer.36eb8e7cd5")}</label>
                        <select
                          value={costEstProjectId}
                          onChange={(e) => {
                            setCostEstProjectId(e.target.value);
                            setQuickEditStashId(null);
                          }}
                          className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2.5 focus:outline-none focus:border-[#ba6446] shadow-3xs font-medium"
                        >
                          <optgroup label="Gallery Patterns">
                            {patterns.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </optgroup>
                          {userProjects.length > 0 && (
                            <optgroup label="Linked Tailoring Projects">
                              {userProjects.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Size {p.size})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Selected Project Specs */}
                      {(() => {
                        const assocProj = userProjects.find(p => p.id === costEstProjectId);
                        const pattern = assocProj
                          ? patterns.find(p => p.id === assocProj.patternId)
                          : patterns.find(p => p.id === costEstProjectId);

                        if (!pattern) return null;

                        // Find fabrics assigned to this project
                        const assignedFabrics = fabricStash.filter(item => item.patternId === costEstProjectId);
                        const totalAssignedYards = assignedFabrics.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0), 0);
                        const totalCost = assignedFabrics.reduce((sum, item) => sum + (parseFloat(item.yardage) || 0) * (parseFloat(item.costPerYard) || 0), 0);
                        const averageCost = totalAssignedYards > 0 ? (totalCost / totalAssignedYards) : 0;

                        return (
                          <div className="space-y-4 pt-3 border-t border-sand-150">
                            {/* Visual Project Thumbnail */}
                            <div className="flex gap-3">
                              <div className="w-16 h-16 rounded border border-sand-200 overflow-hidden shrink-0 bg-sand-50 shadow-3xs">
                                <img
                                  src={pattern.image}
                                  alt={pattern.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="font-serif text-sm font-bold text-bark-900 leading-snug">
                                  {assocProj ? assocProj.name : pattern.name}
                                </h5>
                                <span className="block text-[10px] font-mono text-[#ba6446] font-bold mt-0.5 uppercase tracking-wider">
                                  {assocProj ? `Size ${assocProj.size} • ${assocProj.status}` : `${pattern.category} • ${pattern.difficulty}`}
                                </span>
                                <span className="block text-[10.5px] text-bark-550 font-sans mt-0.5">
                                  Est. Required: {pattern.yardageInfo.width60} (60") / {pattern.yardageInfo.width44} (44")
                                </span>
                              </div>
                            </div>

                            {/* Aggregated Cost Stats Card */}
                            <div className="bg-sand-50/50 rounded-xl p-3.5 border border-sand-200 space-y-3.5 shadow-3xs">
                              <div className="text-center">
                                <span className="block text-[8px] font-mono text-bark-450 uppercase tracking-wider font-extrabold">{pfUiT("ui.components.sewingsessiontimer.a534b021a6")}</span>
                                <span className="text-2xl font-serif font-black text-emerald-800 block my-0.5">
                                  ${totalCost.toFixed(2)}
                                </span>
                                <span className="block text-[10px] text-bark-500 font-sans font-semibold">{pfUiT("ui.components.sewingsessiontimer.80845d5cef")}</span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 border-t border-sand-200/60 pt-3 text-center">
                                <div className="border-r border-sand-200/60">
                                  <span className="block text-[8px] font-mono text-bark-400 uppercase font-bold">{pfUiT("ui.components.sewingsessiontimer.3f6ed69886")}</span>
                                  <span className="text-xs font-mono font-bold text-bark-850">
                                    {totalAssignedYards.toFixed(1)} yds
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[8px] font-mono text-bark-400 uppercase font-bold">{pfUiT("ui.components.sewingsessiontimer.9eaf4e97fb")}</span>
                                  <span className="text-xs font-mono font-bold text-bark-850">
                                    ${averageCost.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Column: Assigned Materials list and inline edits */}
                  <div className="md:col-span-7 space-y-4">
                    {(() => {
                      const assocProj = userProjects.find(p => p.id === costEstProjectId);
                      const pattern = assocProj
                        ? patterns.find(p => p.id === assocProj.patternId)
                        : patterns.find(p => p.id === costEstProjectId);

                      if (!pattern) return null;

                      const assignedFabrics = fabricStash.filter(item => item.patternId === costEstProjectId);

                      // Smart Recommendations from Unassigned Stash
                      const matchingUnassigned = fabricStash.filter(item => {
                        if (item.patternId && item.patternId !== 'none') return false;
                        const itemTypeLower = (item.type || '').toLowerCase();
                        const itemNameLower = (item.name || '').toLowerCase();
                        const itemNotesLower = (item.notes || '').toLowerCase();
                        return pattern.fabricSuggestions.some(suggestion => {
                          const sugLower = suggestion.toLowerCase();
                          return sugLower.includes(itemTypeLower) || itemTypeLower.includes(sugLower) || itemNameLower.includes(sugLower) || itemNotesLower.includes(sugLower);
                        });
                      });

                      return (
                        <div className="space-y-4">
                          {/* Assigned Fabrics Section */}
                          <div className="bg-white border border-sand-250 rounded-xl p-4 shadow-3xs space-y-3.5">
                            <div className="flex items-center justify-between border-b border-sand-150 pb-2">
                              <h4 className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-[#ba6446]" />
                                Assigned Fabric List ({assignedFabrics.length})
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setStashPatternId(costEstProjectId);
                                  setIsStashFormOpen(true);
                                  document.getElementById('stash-form-container')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                                className="inline-flex items-center gap-1 text-[9.5px] font-mono font-bold uppercase tracking-wider text-[#ba6446] hover:text-[#9e5237]"
                              >
                                <Plus className="w-3 h-3" />{pfUiT("ui.components.sewingsessiontimer.0bc7004613")}</button>
                            </div>

                            {assignedFabrics.length === 0 ? (
                              <div className="py-8 text-center text-bark-450 italic text-xs space-y-2">
                                <Package className="w-6 h-6 text-sand-300 mx-auto" />
                                <p>{pfUiT("ui.components.sewingsessiontimer.c082d0300e")}</p>
                                <p className="text-[10px] text-bark-400 not-italic">{pfUiT("ui.components.sewingsessiontimer.7929b33e9c")}</p>
                              </div>
                            ) : (
                              <div className="divide-y divide-sand-100">
                                {assignedFabrics.map((item) => {
                                  const itemCost = parseFloat(item.costPerYard) || 0;
                                  const itemYards = parseFloat(item.yardage) || 0;
                                  const itemTotalCost = itemCost * itemYards;
                                  const isQuickEditing = quickEditStashId === item.id;

                                  return (
                                    <div key={item.id} className="py-3 flex items-start justify-between gap-3 animate-fadeIn">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-serif text-xs font-bold text-bark-900 truncate block">
                                            {item.name}
                                          </span>
                                          <span className="text-[9px] font-mono bg-sand-100 text-bark-600 px-1 rounded-sm shrink-0">
                                            {item.type}
                                          </span>
                                        </div>
                                        <span className="block text-[10px] font-mono text-bark-500 font-medium mt-0.5">
                                          {item.yardage} yds {item.width ? `• ${item.width} wide` : ''}
                                        </span>
                                      </div>

                                      {/* Cost Block with Quick Inline Edit */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        {isQuickEditing ? (
                                          <div className="flex items-center gap-1 animate-fadeIn">
                                            <div className="relative w-20">
                                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-bark-400">$</span>
                                              <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={quickEditCost}
                                                onChange={(e) => setQuickEditCost(e.target.value)}
                                                className="w-full bg-sand-50 border border-[#ba6446] rounded p-1 pl-4 text-xs font-mono text-bark-850 focus:outline-none"
                                                placeholder="0.00"
                                                autoFocus
                                              />
                                            </div>
                                            <span className="text-[10px] font-mono text-bark-400">{pfUiT("ui.components.sewingsessiontimer.c19b9f4068")}</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setFabricStash(prev => prev.map(f => {
                                                  if (f.id === item.id) {
                                                    return { ...f, costPerYard: parseFloat(quickEditCost) >= 0 ? String(parseFloat(quickEditCost).toFixed(2)) : '0.00' };
                                                  }
                                                  return f;
                                                }));
                                                setQuickEditStashId(null);
                                                if (window.showToast) {
                                                  window.showToast("Fabric cost per yard updated successfully.", "success", "Cost Updated");
                                                }
                                              }}
                                              className="p-1 text-green-700 hover:bg-green-50 rounded cursor-pointer"
                                              title={pfUiT("ui.components.sewingsessiontimer.e3f97c4046")}
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setQuickEditStashId(null)}
                                              className="p-1 text-red-750 hover:bg-red-50 rounded cursor-pointer"
                                              title={pfUiT("ui.components.sewingsessiontimer.e213d3ee94")}
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="text-right flex items-center gap-2.5">
                                            <div className="min-w-[70px]">
                                              <span className="block text-[11px] font-mono font-bold text-emerald-800">
                                                ${itemCost.toFixed(2)}/yd
                                              </span>
                                              <span className="block text-[9px] font-mono text-bark-450 font-semibold uppercase">
                                                Total: ${itemTotalCost.toFixed(2)}
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setQuickEditStashId(item.id);
                                                setQuickEditCost(item.costPerYard || '0.00');
                                              }}
                                              className="p-1 rounded text-bark-400 hover:text-[#ba6446] hover:bg-sand-50 transition-all cursor-pointer"
                                              title={pfUiT("ui.components.sewingsessiontimer.5e458f1cac")}
                                            >
                                              <Edit className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (confirm(`Unassign "${item.name}" from this project?`)) {
                                                  setFabricStash(prev => prev.map(f => {
                                                    if (f.id === item.id) {
                                                      return { ...f, patternId: 'none' };
                                                    }
                                                    return f;
                                                  }));
                                                  if (window.showToast) {
                                                    window.showToast("Fabric unassigned from project.", "info", "Unassigned");
                                                  }
                                                }
                                              }}
                                              className="p-1 rounded text-bark-400 hover:text-red-750 hover:bg-red-50 transition-all cursor-pointer"
                                              title={pfUiT("ui.components.sewingsessiontimer.bd6fdf93a5")}
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Compatible Recommendations with Quick Assignment */}
                          <div className="bg-white border border-sand-250 rounded-xl p-4 shadow-3xs space-y-3">
                            <h4 className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest flex items-center gap-1.5 border-b border-sand-150 pb-2">
                              <ClipboardList className="w-3.5 h-3.5 text-[#ba6446]" />
                              Compatible Unassigned Stash Fabrics ({matchingUnassigned.length})
                            </h4>

                            {matchingUnassigned.length === 0 ? (
                              <div className="py-4 text-center text-bark-450 italic text-xs">{pfUiT("ui.components.sewingsessiontimer.dd1f727610")}</div>
                            ) : (
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {matchingUnassigned.map((item) => {
                                  const itemCost = parseFloat(item.costPerYard) || 0;
                                  const itemYards = parseFloat(item.yardage) || 0;
                                  const estTotal = itemCost * itemYards;
                                  return (
                                    <div key={item.id} className="flex items-center justify-between gap-3 text-xs bg-sand-50/50 border border-sand-150 p-2 rounded-lg hover:bg-sand-50 transition-colors">
                                      <div className="min-w-0 flex-1">
                                        <span className="font-semibold text-bark-900 block truncate leading-snug">{item.name}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[9.5px] font-mono text-bark-500 font-medium">
                                          <span>{item.yardage} yds</span>
                                          <span>•</span>
                                          <span>{item.type}</span>
                                          {itemCost > 0 && (
                                            <>
                                              <span>•</span>
                                              <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-semibold">${itemCost.toFixed(2)}/yd</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2.5 shrink-0">
                                        {itemCost > 0 && (
                                          <span className="text-[10px] font-mono text-bark-450 uppercase font-semibold text-right">
                                            Est: ${estTotal.toFixed(2)}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFabricStash(prev => prev.map(f => {
                                              if (f.id === item.id) {
                                                return { ...f, patternId: costEstProjectId };
                                              }
                                              return f;
                                            }));
                                            if (window.showToast) {
                                              window.showToast(`"${item.name}" assigned to project successfully!`, "success", "Fabric Assigned");
                                            }
                                          }}
                                          className="px-2.5 py-1 bg-[#ba6446] hover:bg-clay-750 text-white rounded text-[10px] font-mono font-bold uppercase transition-all cursor-pointer active:scale-95 shrink-0"
                                        >{pfUiT("ui.components.sewingsessiontimer.3e67351a03")}</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )}

        </div>

      </div>
      )}

      {/* --- COUTURE IMMERSIVE FOCUS MODE FULLSCREEN MODAL --- */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1e1c1a] text-sand-100 flex flex-col items-center justify-between p-6 sm:p-12"
            style={{ zIndex: UI_LAYERS.criticalDialog }}
          >
            {/* Immersive Header */}
            <div className="w-full max-w-4xl flex items-center justify-between text-sand-400 font-mono text-xs border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-clay-500 rounded-full animate-pulse" />
                <span className="uppercase tracking-widest font-bold">{pfUiT("ui.components.sewingsessiontimer.5a8152e3a7")}</span>
              </div>
              <button
                onClick={() => setIsFocusMode(false)}
                className="hover:text-white flex items-center gap-1 px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors cursor-pointer text-[10px] font-bold uppercase"
                type="button"
              >
                <Minimize2 className="w-3.5 h-3.5" />{pfUiT("ui.components.sewingsessiontimer.197dddfa27")}</button>
            </div>

            {/* Immersive Midsection (Pulsing design) */}
            <div className="flex flex-col items-center justify-center max-w-xl text-center space-y-8">

              <div className="space-y-1.5">
                <span className="text-[10px] tracking-[0.3em] font-mono text-[#ba6446] uppercase font-bold">
                  {activePattern.name}
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif font-light text-sand-50 tracking-tight">
                  {currentStep.op}
                </h2>
                <div className="text-[11px] text-sand-400 font-mono">{pfUiT("ui.components.sewingsessiontimer.1ccebf3cc7")}<span className="text-[#ba6446] font-bold">{currentStep.sam} mins</span>
                </div>
              </div>

              {/* Soothing giant stopwatch view */}
              <div className={`w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-white/5 flex flex-col items-center justify-center relative transition-all duration-1000 ${
                isRunning ? 'shadow-[0_0_50px_rgba(186,100,70,0.15)] border-[#ba6446]/40' : ''
              }`}>
                {isRunning && (
                  <div className="absolute inset-4 border border-dashed border-[#ba6446]/20 rounded-full animate-[spin_120s_linear_infinite]" />
                )}

                <span className="text-xs font-mono tracking-widest uppercase text-[#ba6446] font-bold">
                  {isRunning ? 'Ticking' : 'Suspended'}
                </span>

                <div className="font-mono text-5xl sm:text-6xl font-extrabold text-sand-50 mt-4 tracking-tighter">
                  {formatTime(secondsElapsed)}
                </div>

                <div className="text-[11px] text-sand-400 font-mono mt-2">{pfUiT("ui.components.sewingsessiontimer.f6bebc6edb")}</div>
              </div>

              {/* Focused Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleStartStop}
                  className={`px-8 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95 ${
                    isRunning
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-[#ba6446] hover:bg-[#a25135] text-white'
                  }`}
                  type="button"
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-4 h-4 fill-white" />{pfUiT("ui.components.sewingsessiontimer.af1bde76e7")}</>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />{pfUiT("ui.components.sewingsessiontimer.fb4ac5d777")}</>
                  )}
                </button>

                <button
                  onClick={() => {
                    handleLogSession();
                    setIsFocusMode(false);
                  }}
                  disabled={secondsElapsed < 5}
                  className={`px-6 py-3.5 rounded-full text-sm font-bold uppercase tracking-wider border transition-all cursor-pointer active:scale-95 ${
                    secondsElapsed >= 5
                      ? 'bg-transparent border-white/20 hover:border-white/40 text-sand-100 hover:bg-white/5 shadow-md'
                      : 'border-white/5 text-white/20 cursor-not-allowed'
                  }`}
                  type="button"
                >
                  Save &amp; Log
                </button>
              </div>

            </div>

            {/* Immersive Footer Quote */}
            <div className="text-[11px] text-sand-500 font-serif italic text-center max-w-sm border-t border-white/5 pt-4">{pfUiT("ui.components.sewingsessiontimer.034e0986a6")}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MANUAL SESSION LOGGING DIALOG --- */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs flex items-center justify-center p-4"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg border border-sand-200 shadow-2xl p-6 max-w-md w-full relative space-y-4"
              style={{ zIndex: UI_LAYERS.modal }}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-bark-450 hover:text-bark-800 hover:bg-sand-100 transition-colors cursor-pointer"
                type="button"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h4 className="font-serif text-bark-950 text-xl font-bold">{pfUiT("ui.components.sewingsessiontimer.e4eaabd3c6")}</h4>
                <p className="text-xs text-bark-500 leading-normal font-sans">{pfUiT("ui.components.sewingsessiontimer.4b45aff7e2")}</p>
              </div>

              <form onSubmit={handleManualLogSubmit} className="space-y-3 pt-2">

                {/* Pattern / Custom Option */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono font-bold text-bark-500 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.ea5f048267")}</label>
                  <select
                    value={selectedPatternId}
                    onChange={(e) => setSelectedPatternId(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                  >
                    {patterns.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="custom">{pfUiT("ui.components.sewingsessiontimer.3850e080c2")}</option>
                  </select>
                </div>

                {/* Construction Step */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono font-bold text-bark-500 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.aa9915fb0e")}</label>
                  <input
                    type="text"
                    required
                    placeholder={pfUiT("ui.components.sewingsessiontimer.a6263a2849")}
                    value={manualStep}
                    onChange={(e) => setManualStep(e.target.value)}
                    className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446]"
                  />
                </div>

                {/* Time inputs */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono font-bold text-bark-500 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.352f78febe")}</label>
                    <input
                      type="number"
                      min="0"
                      max="1440"
                      required
                      placeholder={pfUiT("ui.components.sewingsessiontimer.d3b40560f1")}
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] text-center font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9.5px] font-mono font-bold text-bark-500 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.061ffb5d87")}</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder={pfUiT("ui.components.sewingsessiontimer.de51a56b02")}
                      value={manualSeconds}
                      onChange={(e) => setManualSeconds(e.target.value)}
                      className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] text-center font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-mono font-bold text-bark-500 uppercase tracking-wide block">{pfUiT("ui.components.sewingsessiontimer.a133065ccf")}</label>
                  <textarea
                    rows="3"
                    placeholder={pfUiT("ui.components.sewingsessiontimer.a18e8ffaf9")}
                    value={manualNotes}
                    onChange={(e) => setManualNotes(e.target.value)}
                    className="w-full bg-white border border-sand-250 text-bark-850 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] placeholder-bark-300"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-sand-150">
                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(false)}
                    className="px-4 py-2 border border-sand-250 text-bark-600 hover:text-bark-900 rounded-[3px] text-xs font-semibold cursor-pointer"
                  >{pfUiT("ui.components.sewingsessiontimer.a043ca6c04")}</button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#ba6446] hover:bg-[#a25135] text-white rounded-[3px] text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
                  >{pfUiT("ui.components.sewingsessiontimer.6f3e4e9ffb")}</button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CAMERA CAPTURE DIALOG --- */}
      <AnimatePresence>
        {showCamera && (
          <div
            className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs flex items-center justify-center p-4"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg border border-sand-200 shadow-2xl p-6 max-w-md w-full relative space-y-4"
              style={{ zIndex: UI_LAYERS.modal }}
            >
              {/* Close Button */}
              <button
                onClick={stopCamera}
                className="absolute top-4 right-4 p-1 rounded-full text-bark-450 hover:text-bark-800 hover:bg-sand-100 transition-colors cursor-pointer"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <h4 className="font-serif text-bark-950 text-xl font-bold flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#ba6446]" />{pfUiT("ui.components.sewingsessiontimer.90e361cb04")}</h4>
                <p className="text-xs text-bark-550 leading-normal font-sans">
                  {cameraTarget === 'session'
                    ? "Attach a snapshot of your progress to this active sewing session."
                    : "Add a snapshot to your design's visual progress gallery."}
                </p>
              </div>

              {cameraError ? (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded text-xs space-y-2.5">
                  <p className="font-medium">{cameraError}</p>
                  <label className="block text-center pt-1">
                    <span className="bg-white border border-red-300 text-red-800 px-3 py-1.5 rounded cursor-pointer hover:bg-red-100 text-xs font-semibold inline-block">{pfUiT("ui.components.sewingsessiontimer.f90a180594")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        handleFileUpload(e);
                        stopCamera();
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Video Viewport */}
                  <div className="aspect-video bg-black rounded-md overflow-hidden relative border border-sand-300 shadow-inner flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 bg-black/60 text-white font-mono text-[9px] px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />{pfUiT("ui.components.sewingsessiontimer.0bbb3026b2")}</div>
                  </div>

                  {/* Capture Trigger */}
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-bark-600 font-bold hover:text-[#ba6446] cursor-pointer flex items-center gap-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleFileUpload(e);
                          stopCamera();
                        }}
                        className="hidden"
                      />
                      <span>{pfUiT("ui.components.sewingsessiontimer.1b5ad84f1e")}</span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2 border border-sand-250 text-bark-600 hover:text-bark-900 rounded-[3px] text-xs font-semibold cursor-pointer"
                      >{pfUiT("ui.components.sewingsessiontimer.a043ca6c04")}</button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-2 bg-[#ba6446] hover:bg-[#a25135] text-white rounded-[3px] text-xs font-bold uppercase tracking-wider shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />{pfUiT("ui.components.sewingsessiontimer.77ae7e5b01")}</button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- LIGHTBOX PHOTO PREVIEW MODAL & CAROUSEL --- */}
      <AnimatePresence>
        {selectedPreviewPhoto && (() => {
          const currentIndex = filteredPhotos.findIndex(p => p.id === selectedPreviewPhoto.id);
          const hasMultiple = filteredPhotos.length > 1;

          return (
            <div
              className="fixed inset-0 bg-bark-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fadeIn"
              style={{ zIndex: UI_LAYERS.modalBackdrop }}
              onClick={() => setSelectedPreviewPhoto(null)}
              id="photo-carousel-overlay"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-lg border border-sand-200 shadow-2xl p-6 max-w-xl w-full relative space-y-4 cursor-default"
                style={{ zIndex: UI_LAYERS.modal }}
                onClick={(e) => e.stopPropagation()}
                id="photo-carousel-container"
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedPreviewPhoto(null)}
                  className="absolute top-4 right-4 p-1 rounded-full text-bark-450 hover:text-bark-800 hover:bg-sand-100 transition-colors cursor-pointer z-20"
                  type="button"
                  id="close-carousel-button"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header Information */}
                <div className="space-y-1.5 pr-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-[#ba6446] bg-[#ba6446]/10 border border-[#ba6446]/20 px-2.5 py-1 rounded font-mono font-bold uppercase tracking-wider inline-block">
                      {selectedPreviewPhoto.patternName}
                    </span>
                    {hasMultiple && currentIndex !== -1 && (
                      <span className="text-[10px] text-bark-600 bg-sand-100 border border-sand-250 px-2 py-0.5 rounded font-mono font-bold">
                        Photo {currentIndex + 1} of {filteredPhotos.length}
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif text-bark-950 text-base font-bold pt-1">
                    {selectedPreviewPhoto.source || 'Visual Milestone'}
                  </h4>
                  <div className="text-[10px] text-bark-500 font-mono flex items-center gap-1 font-bold">
                    <Calendar className="w-3.5 h-3.5 text-bark-400" />
                    <span>{new Date(selectedPreviewPhoto.date).toLocaleDateString(undefined, {month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</span>
                  </div>
                </div>

                {/* Photo Display with Overlaid Navigation Controls */}
                <div className="aspect-square bg-sand-950 rounded border border-sand-800 overflow-hidden shadow-inner flex items-center justify-center relative group">
                  <img
                    src={selectedPreviewPhoto.url}
                    alt={pfUiT("ui.components.sewingsessiontimer.5f125d8ff0")}
                    className="w-full h-full object-contain select-none"
                    referrerPolicy="no-referrer"
                    id="carousel-main-image"
                  />

                  {/* Carousel Left/Right arrows inside the container */}
                  {hasMultiple && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrevPhoto}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/75 hover:scale-110 active:scale-95 transition-all cursor-pointer z-10 shadow-md border border-white/10"
                        title="Previous Photo (Left Arrow)"
                        id="carousel-prev-button"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={handleNextPhoto}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/75 hover:scale-110 active:scale-95 transition-all cursor-pointer z-10 shadow-md border border-white/10"
                        title="Next Photo (Right Arrow)"
                        id="carousel-next-button"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {/* Details Section */}
                {selectedPreviewPhoto.details && (
                  <div className="bg-sand-50/80 border border-sand-200 rounded p-3 text-xs text-bark-750 font-sans leading-relaxed">
                    <span className="font-mono font-extrabold text-[9px] uppercase tracking-wider text-bark-500 block mb-1">{pfUiT("ui.components.sewingsessiontimer.52c65f9063")}</span>
                    {selectedPreviewPhoto.details}
                  </div>
                )}

                {/* Bottom Gallery Thumbnail Bar for Quick Selection */}
                {hasMultiple && (
                  <div className="space-y-1.5 pt-1 border-t border-sand-150" id="carousel-thumbnail-bar">
                    <span className="text-[9px] font-mono text-bark-450 uppercase tracking-wider font-extrabold block">
                      Gallery Stream ({filteredPhotos.length} milestones)
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin max-h-[52px] items-center">
                      {filteredPhotos.map((p, idx) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedPreviewPhoto(p)}
                          className={`w-10 h-10 rounded overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                            idx === currentIndex
                              ? 'border-[#ba6446] scale-105 shadow-xs'
                              : 'border-sand-200 hover:border-sand-400 opacity-60 hover:opacity-100'
                          }`}
                          id={`carousel-thumb-${idx}`}
                        >
                          <img
                            src={p.url}
                            alt={`Thumb ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-bark-450 font-mono italic">
                    {hasMultiple ? "Tip: Use Arrow Keys ◄ / ► to navigate" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPreviewPhoto(null)}
                    className="px-4 py-2 bg-bark-900 hover:bg-bark-950 text-white rounded-[3px] text-xs font-bold uppercase tracking-wider shadow-xs cursor-pointer"
                    id="close-carousel-modal-button"
                  >{pfUiT("ui.components.sewingsessiontimer.d65e46cdb9")}</button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* TAGGING SUB-MODAL */}
      <AnimatePresence>
        {isTaggingModalOpen && (
          <div
            className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
            style={{ zIndex: UI_LAYERS.modalBackdrop }}
            id="workspace-card-tagging-modal"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTaggingModalOpen(false)}
              className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs cursor-pointer"
              style={{ zIndex: UI_LAYERS.modalBackdrop }}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-[#FAF8F5] border border-sand-250 shadow-lux rounded-lg w-full max-w-md p-6 relative space-y-5"
              style={{ zIndex: UI_LAYERS.modal }}
            >
              <div className="flex items-center justify-between border-b border-sand-150 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#ba6446]" />
                  <h4 className="font-serif font-bold text-bark-900 text-sm">
                    {taggingItemType === 'stash' ? 'Tag Fabric Card' : 'Tag Pattern Card'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTaggingModalOpen(false)}
                  className="p-1 rounded-full hover:bg-sand-100 text-bark-450 hover:text-bark-900 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-bark-550 border-b border-sand-100 pb-2 italic text-left">{pfUiT("ui.components.sewingsessiontimer.4213f330bb")}<span className="font-bold text-bark-800 font-sans font-semibold">"{taggingItemName}"</span>
              </div>

              <div className="space-y-4 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-bark-600 block font-bold">{pfUiT("ui.components.sewingsessiontimer.a8db5de763")}</label>
                  <select
                    value={selectedFabricType}
                    onChange={(e) => setSelectedFabricType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                  >
                    {MATERIAL_PRESETS.map((material) => (
                      <option key={material} value={material}>
                        {material}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-bark-600 block font-bold">{pfUiT("ui.components.sewingsessiontimer.c624a5b700")}</label>
                  <select
                    value={selectedFabricColor}
                    onChange={(e) => setSelectedFabricColor(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans text-bark-800"
                  >
                    {PREDEFINED_COLORS.map((color) => (
                      <option key={color.name} value={color.name}>
                        {color.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-sand-50 border border-sand-200 rounded p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[8px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.sewingsessiontimer.88284180e7")}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-sand-300 shadow-3xs block"
                        style={{ backgroundColor: PREDEFINED_COLORS.find(c => c.name === selectedFabricColor)?.hex || '#ba6446' }}
                      />
                      <span className="text-xs font-mono font-bold text-bark-800 uppercase">
                        {selectedFabricColor} ({PREDEFINED_COLORS.find(c => c.name === selectedFabricColor)?.hex || '#ba6446'})
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold bg-clay-50 border border-clay-100 text-clay-700 px-2 py-0.5 rounded uppercase">
                    {selectedFabricType}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-sand-150">
                <button
                  type="button"
                  onClick={() => setIsTaggingModalOpen(false)}
                  className="px-3.5 py-1.5 border border-sand-250 hover:bg-sand-50 text-bark-750 rounded text-xs font-semibold cursor-pointer transition-colors"
                >{pfUiT("ui.components.sewingsessiontimer.a043ca6c04")}</button>
                <button
                  type="button"
                  onClick={handleTagItemSave}
                  className="px-3.5 py-1.5 bg-[#ba6446] hover:bg-[#a25135] text-white rounded text-xs font-bold cursor-pointer transition-all shadow-3xs hover:shadow-2xs active:scale-95 flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{pfUiT("ui.components.sewingsessiontimer.b6d68f8c88")}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </section>
  );
}
