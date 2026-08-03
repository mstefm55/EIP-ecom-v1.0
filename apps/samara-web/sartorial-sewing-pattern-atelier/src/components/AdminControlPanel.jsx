import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '../context/RoleContext';
import { useDynamicLayout } from '../context/DynamicLayoutContext';
import { useLayoutAnalytics } from '../hooks/useLayoutAnalytics';
import { ComponentRegistry } from './ComponentRegistry';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
let activeWorkspaceTab;
import {
  ShieldCheck, Settings, Users, Key, Database, BarChart3,
  Sliders, RefreshCw, Save, Trash2, Mail, ShieldAlert, Check, X,
  AlertTriangle, Lock, Unlock, HelpCircle, Eye, Info, Plus, Layers,
  Activity, Sparkles, FolderKanban, ClipboardList, TrendingUp, User, Briefcase
} from 'lucide-react';

import CollaboratorWorkspace from './subcomponents/CollaboratorWorkspace';
import ProfessionalDashboard from './subcomponents/ProfessionalDashboard';
import PermissionsOverview from './subcomponents/PermissionsOverview';
import DynamicInventory from './subcomponents/DynamicInventory';
import PerfectFitLayoutController from './PerfectFitLayoutController';

const DEFAULT_UI_METADATA = {
  profile: {
    theme: {
      primaryColor: '#8c6239',
      secondaryColor: '#556b2f',
      fontFamily: 'font-serif',
      strikeFontSize: 'text-5xl font-serif font-black tracking-tight leading-none text-bark-950',
      proFontSize: 'text-lg font-sans font-semibold tracking-wide text-bark-800',
      backgroundColor: 'bg-[#FAF8F5]',
      accentColor: 'clay-605'
    },
    sections: [
      {
        id: "sec-header",
        type: "hero-header",
        title: "PERFECT FIT BUREAU COUTURE",
        subtitle: "Curated Slow-Fashion & Custom Draping Blueprints",
        image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
        badge: "ESTABLISHED 2026",
        details: "A premium design collective dedicated to historic reconstructions, zero-waste cutting grids, and luxury French seam finishes.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-metrics",
        type: "stats-grid",
        heading: "Global Perfect Fit Impact",
        subtitle: "Real-time measurements of our sustainable fashion community",
        stats: [
          { label: "Active Tailors", value: "14,820", detail: "Registered makers drafting blueprints" },
          { label: "Sewn Garments", value: "48,200+", detail: "Finished client pieces posted globally" },
          { label: "Sustainability Score", value: "98.4%", detail: "Zero-waste linen & cotton fabric layouts" }
        ],
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-casual-welcome",
        type: "text-block",
        heading: "✨ Welcome, Slow-Fashion Enthusiast!",
        content: "We believe beautiful garments should have clean origins and custom-grade fit. Register a Perfect Fit Member Account to unlock the dynamic 3D-adjacent sizing generator, direct stitch tutorial overlays, and free PDF pattern templates for casual sewers.",
        callout: "Exclusive Visitor Offer: Sign up today and get your first digital tailoring pattern graded for free.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer"],
          description: "Casual Visitors Only"
        }
      },
      {
        id: "sec-partner-perks",
        type: "checklists",
        heading: "🤝 B2B Professional Partnership Benefits",
        subtitle: "Specialist privileges for commercial design houses & master tailors",
        items: [
          "Commercial licensing rights to resell tailored physically finished products.",
          "Bulk linen and organic gabardine textile discounts directly from our verified French mills.",
          "API endpoint access for nested vector cutting grid generation systems.",
          "Co-branding features on public curated masterwork galleries."
        ],
        visibilityRule: {
          allowedRoles: ["collaborator", "administrator"],
          description: "Professional Partners Only"
        }
      }
    ]
  }
};

export default function AdminControlPanel({ appLayout, setAppLayout, onResetLayout }) {
  const { role, setRole, availableRoles, simulationActive, resetRoleToActual, actualRole } = useRole();
  const { logs, clearAnalytics, refreshLogs, trackInteraction } = useLayoutAnalytics();

  // Load from context safely if wrapped, otherwise mock
  let layoutCtx = null;
  try {
    layoutCtx = useDynamicLayout();
  } catch (err) {}

  const rules = layoutCtx?.rules || {};
  const handleToggleRule = layoutCtx?.handleToggleRule;
  const handleResetRules = layoutCtx?.handleResetRules;
  const gatedRenderMode = layoutCtx?.gatedRenderMode || 'hide';
  const setGatedRenderMode = layoutCtx?.setGatedRenderMode;

  // Tabs: 'access', 'telemetry', 'config'
  const [activeTab, setActiveTab] = useState('access');
  const [layoutSubTab, setLayoutSubTab] = useState('visibility'); // 'visibility', 'homepage', 'metadata'

  // --- Dynamic UI Metadata State ---
  const [metadata, setMetadata] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_ui_metadata');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.profile?.sections) return parsed;
      }
      return DEFAULT_UI_METADATA;
    } catch {
      return DEFAULT_UI_METADATA;
    }
  });

  const [rawJsonText, setRawJsonText] = useState(() => JSON.stringify(metadata, null, 2));
  const [jsonError, setJsonError] = useState(null);

  // Quick form state to add/edit sections in metadata database
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editSectionId, setEditSectionId] = useState(null);
  const [formSecType, setFormSecType] = useState('text-block');
  const [formSecTitle, setFormSecTitle] = useState('');
  const [formSecSubtitle, setFormSecSubtitle] = useState('');
  const [formSecContent, setFormSecContent] = useState('');
  const [formSecImage, setFormSecImage] = useState('');
  const [formSecBadge, setFormSecBadge] = useState('');
  const [formAllowedGuests, setFormAllowedGuests] = useState(true);
  const [formAllowedBuyers, setFormAllowedBuyers] = useState(true);
  const [formAllowedCollaborators, setFormAllowedCollaborators] = useState(true);
  const [formAllowedAdmins, setFormAllowedAdmins] = useState(true);

  // --- Login Strict Gating State ---
  const [isLoginDependent, setIsLoginDependent] = useState(() => {
    return localStorage.getItem('sartorial_ui_login_dependent') === 'true';
  });

  // --- Global Hover specifications state ---
  const [hoverEnabled, setHoverEnabled] = useState(() => {
    return localStorage.getItem('atelier_hover_info_enabled') !== 'false';
  });

  // --- Render visual density modes ---
  const [renderMode, setRenderMode] = useState(() => {
    return localStorage.getItem('sartorial_ui_render_mode') || 'pro-detailed';
  });

  // --- Credential Upgrade Petitions Queue ---
  const [petitions, setPetitions] = useState([]);

  // Fetch access petitions on load
  const loadPetitions = () => {
    try {
      const saved = localStorage.getItem('sartorial_access_requests');
      setPetitions(saved ? JSON.parse(saved) : []);
    } catch {
      setPetitions([]);
    }
  };

  useEffect(() => {
    loadPetitions();
    const handlePetitionsUpdate = () => loadPetitions();
    window.addEventListener('sartorial_requests_updated', handlePetitionsUpdate);
    return () => window.removeEventListener('sartorial_requests_updated', handlePetitionsUpdate);
  }, []);

  // Sync hoverEnabled state when global event fires
  useEffect(() => {
    const handleHoverSync = () => {
      setHoverEnabled(localStorage.getItem('atelier_hover_info_enabled') !== 'false');
    };
    window.addEventListener('atelier_hover_config_changed', handleHoverSync);
    return () => window.removeEventListener('atelier_hover_config_changed', handleHoverSync);
  }, []);

  // Sync JSON text when metadata changes
  useEffect(() => {
    setRawJsonText(JSON.stringify(metadata, null, 2));
  }, [metadata]);

  // Handle Strict Login Gates toggling
  const handleToggleLoginGate = () => {
    const nextVal = !isLoginDependent;
    setIsLoginDependent(nextVal);
    localStorage.setItem('sartorial_ui_login_dependent', String(nextVal));
    window.dispatchEvent(new Event('sartorial_ui_login_dependent_updated'));
    if (window.showToast) {
      window.showToast(
        `System Security Enforced: ${nextVal ? 'Strict Login Gated' : 'Public Access Permitted'}.`,
        "success",
        "Security Mode Triggered"
      );
    }
    if (trackInteraction) {
      trackInteraction('admin_toggle_login_dependent', { loginDependent: nextVal });
    }
  };

  // Handle Global Hover Spec Switcher
  const handleToggleHoverSpecs = (enable) => {
    setHoverEnabled(enable);
    localStorage.setItem('atelier_hover_info_enabled', String(enable));
    window.dispatchEvent(new Event('atelier_hover_config_changed'));
    if (window.showToast) {
      window.showToast(
        `Hover Specifications ${enable ? 'ENABLED' : 'DISABLED'} globally for all workspace users.`,
        enable ? "success" : "info",
        "Global Hover Configuration"
      );
    }
    if (trackInteraction) {
      trackInteraction('admin_toggle_hover_specs', { enabled: enable });
    }
  };

  // Handle Global Render Density mode
  const handleToggleRenderMode = (mode) => {
    setRenderMode(mode);
    localStorage.setItem('sartorial_ui_render_mode', mode);
    window.dispatchEvent(new Event('sartorial_ui_render_mode_updated'));
    if (window.showToast) {
      window.showToast(
        `Active Render Density set to: ${mode === 'pro-detailed' ? 'Professional Technical' : 'Visual Strike'}.`,
        "success",
        "Layout Mode Applied"
      );
    }
    if (trackInteraction) {
      trackInteraction('admin_toggle_render_mode', { renderMode: mode });
    }
  };

  // Reset UI Metadata Database to Factory defaults
  const handleResetMetadataDb = () => {
    if (window.confirm("Are you sure you want to reset the UI Metadata Database back to factory defaults? This clears all custom sections.")) {
      localStorage.setItem('sartorial_ui_metadata', JSON.stringify(DEFAULT_UI_METADATA));
      setMetadata(DEFAULT_UI_METADATA);
      window.dispatchEvent(new Event('sartorial_ui_metadata_updated'));
      if (window.showToast) {
        window.showToast("Metadata database restored to factory configuration.", "success", "Database Reset");
      }
      if (trackInteraction) {
        trackInteraction('admin_metadata_reset', { success: true });
      }
    }
  };

  // Commit changes from raw JSON editor
  const handleSaveRawJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      if (!parsed.profile || !parsed.profile.sections) {
        throw new Error("Missing required root node: 'profile.sections'");
      }
      localStorage.setItem('sartorial_ui_metadata', JSON.stringify(parsed));
      setMetadata(parsed);
      setJsonError(null);
      window.dispatchEvent(new Event('sartorial_ui_metadata_updated'));
      if (window.showToast) {
        window.showToast("Metadata JSON written to cache database successfully.", "success", "DB Transaction Completed");
      }
      if (trackInteraction) {
        trackInteraction('admin_metadata_raw_saved', { success: true });
      }
    } catch (err) {
      setJsonError(err.message);
      if (window.showToast) {
        window.showToast(`Transaction failed: ${err.message}`, "error", "Rollback Triggered");
      }
    }
  };

  // Save layout section form
  const handleSaveSectionForm = (e) => {
    e.preventDefault();
    const allowedRoles = [];
    if (formAllowedGuests) allowedRoles.push('guest');
    if (formAllowedBuyers) allowedRoles.push('buyer');
    if (formAllowedCollaborators) allowedRoles.push('collaborator');
    if (formAllowedAdmins) allowedRoles.push('administrator');

    const desc = allowedRoles.length === 4
      ? 'Visible to all visitors'
      : `Restricted: [${allowedRoles.join(', ')}]`;

    const sectionData = {
      id: editSectionId || `sec-${Date.now()}`,
      type: formSecType,
      title: formSecTitle,
      subtitle: formSecSubtitle,
      content: formSecContent,
      image: formSecImage,
      badge: formSecBadge,
      visibilityRule: {
        allowedRoles,
        description: desc
      }
    };

    let updatedSections = [...metadata.profile.sections];
    if (editSectionId) {
      updatedSections = updatedSections.map(s => s.id === editSectionId ? sectionData : s);
    } else {
      updatedSections.push(sectionData);
    }

    const nextMetadata = {
      ...metadata,
      profile: {
        ...metadata.profile,
        sections: updatedSections
      }
    };

    localStorage.setItem('sartorial_ui_metadata', JSON.stringify(nextMetadata));
    setMetadata(nextMetadata);
    setShowSectionForm(false);
    setEditSectionId(null);
    setFormSecTitle('');
    setFormSecSubtitle('');
    setFormSecContent('');
    setFormSecImage('');
    setFormSecBadge('');
    window.dispatchEvent(new Event('sartorial_ui_metadata_updated'));

    if (window.showToast) {
      window.showToast("Dynamic layout node written successfully.", "success", "Schema Updated");
    }
    if (trackInteraction) {
      trackInteraction('admin_section_form_saved', { sectionId: sectionData.id });
    }
  };

  // Delete section from metadata
  const handleDeleteSection = (secId) => {
    if (window.confirm("Are you sure you want to delete this layout block?")) {
      const nextSections = metadata.profile.sections.filter(s => s.id !== secId);
      const nextMetadata = {
        ...metadata,
        profile: {
          ...metadata.profile,
          sections: nextSections
        }
      };
      localStorage.setItem('sartorial_ui_metadata', JSON.stringify(nextMetadata));
      setMetadata(nextMetadata);
      window.dispatchEvent(new Event('sartorial_ui_metadata_updated'));
      if (window.showToast) {
        window.showToast("Block removed from dynamic configuration.", "success", "Segment Deleted");
      }
      if (trackInteraction) {
        trackInteraction('admin_section_deleted', { sectionId: secId });
      }
    }
  };

  // Populate form to edit section
  const handleStartEditSection = (sec) => {
    setEditSectionId(sec.id);
    setFormSecType(sec.type || 'text-block');
    setFormSecTitle(sec.title || '');
    setFormSecSubtitle(sec.subtitle || '');
    setFormSecContent(sec.content || '');
    setFormSecImage(sec.image || '');
    setFormSecBadge(sec.badge || '');

    const allowed = sec.visibilityRule?.allowedRoles || ["guest", "buyer", "collaborator", "administrator"];
    setFormAllowedGuests(allowed.includes('guest'));
    setFormAllowedBuyers(allowed.includes('buyer'));
    setFormAllowedCollaborators(allowed.includes('collaborator'));
    setFormAllowedAdmins(allowed.includes('administrator'));
    setShowSectionForm(true);
  };

  // Handle Petition actions
  const handlePetitionDecision = (id, approved) => {
    const updated = petitions.map(p => {
      if (p.id === id) {
        return { ...p, status: approved ? 'approved' : 'denied' };
      }
      return p;
    });
    localStorage.setItem('sartorial_access_requests', JSON.stringify(updated));
    setPetitions(updated);
    window.dispatchEvent(new Event('sartorial_requests_updated'));

    const petition = petitions.find(p => p.id === id);
    if (approved && petition) {
      const requested = petition.requestedRole;
      let targetSimRole = 'visitor';
      if (requested === 'professional') targetSimRole = 'professional';
      else if (requested === 'partner') targetSimRole = 'partner';
      else if (requested === 'member') targetSimRole = 'member';

      setRole(targetSimRole);

      if (window.showToast) {
        window.showToast(
          `Upgrade petition APPROVED. System role upgraded to ${targetSimRole.toUpperCase()}!`,
          "success",
          "Credential Overruled"
        );
      }
    } else {
      if (window.showToast) {
        window.showToast("Petition rejected and status updated to denied.", "info", "Privilege Denied");
      }
    }
    if (trackInteraction) {
      trackInteraction('admin_petition_processed', { petitionId: id, approved });
    }
  };

  const handleClearPetitions = () => {
    if (window.confirm("Do you want to clear the request petition archives?")) {
      localStorage.setItem('sartorial_access_requests', '[]');
      setPetitions([]);
      window.dispatchEvent(new Event('sartorial_requests_updated'));
      if (window.showToast) {
        window.showToast("Petition archives cleared successfully.", "info", "Archives Pruned");
      }
    }
  };

  // --- RECHARTS TELEMETRY DATA PREPARATION ---

  // 1. Real-Time User Activity: Group interactions by actionType or timestamp
  const realTimeActivityData = useMemo(() => {
    // Baseline metrics
    const baseDays = [
      { day: 'Mon', interactions: 45, accessDenials: 2, updates: 5 },
      { day: 'Tue', interactions: 68, accessDenials: 4, updates: 8 },
      { day: 'Wed', interactions: 110, accessDenials: 8, updates: 12 },
      { day: 'Thu', interactions: 85, accessDenials: 3, updates: 7 },
      { day: 'Fri', interactions: 135, accessDenials: 14, updates: 15 },
      { day: 'Sat', interactions: 165, accessDenials: 18, updates: 22 },
      { day: 'Sun', interactions: 125, accessDenials: 6, updates: 10 },
    ];

    // Merge actual log statistics if logs are populated
    if (logs.length > 0) {
      const totalActual = logs.length;
      const actualDenials = logs.filter(l => l.actionType === 'access_denied').length;
      const actualUpdates = logs.filter(l => l.actionType === 'rule_toggled').length;
      const actualAccesses = logs.filter(l => l.actionType === 'feature_accessed').length;

      // Augment the last data point with actual live logs
      baseDays[6] = {
        day: 'Sun (Live)',
        interactions: 125 + actualAccesses + totalActual,
        accessDenials: 6 + actualDenials,
        updates: 10 + actualUpdates
      };
    }

    return baseDays;
  }, [logs]);

  // 2. Pattern Interest Tracking: Aggregated measurements
  const patternInterestData = useMemo(() => {
    return [
      { name: 'Aurelia Wrap Dress', views: 245, cartAdditions: 72, wishlist: 45 },
      { name: 'Perfect Fit Utility Trench', views: 198, cartAdditions: 38, wishlist: 64 },
      { name: 'French Dart Chemise', views: 164, cartAdditions: 49, wishlist: 30 },
      { name: 'Origami Zero-Waste Vest', views: 310, cartAdditions: 94, wishlist: 82 },
      { name: 'Perfect Fit Linen Blazer', views: 142, cartAdditions: 25, wishlist: 38 },
      { name: 'Draped Silk Camisole', views: 120, cartAdditions: 40, wishlist: 22 }
    ];
  }, []);

  // 3. Visitor Metrics: Session distribution by active persona
  const visitorMetricsData = useMemo(() => {
    const rolesCount = { visitor: 0, member: 0, partner: 0, professional: 0 };
    logs.forEach(l => {
      if (rolesCount[l.role] !== undefined) {
        rolesCount[l.role]++;
      }
    });

    return [
      { name: 'Casual Visitors', value: 45 + (rolesCount.visitor * 3), color: '#64748b' },
      { name: 'Perfect Fit Members', value: 30 + (rolesCount.member * 4), color: '#8c6239' },
      { name: 'Creative Partners', value: 18 + (rolesCount.partner * 5), color: '#556b2f' },
      { name: 'Super Admins', value: 7 + (rolesCount.professional * 2), color: '#ba6446' }
    ];
  }, [logs]);

  const totalVisitorWeight = useMemo(() => {
    return visitorMetricsData.reduce((acc, curr) => acc + curr.value, 0);
  }, [visitorMetricsData]);

  return (
    <div className="bg-[#FAF8F5] border border-clay-150/75 rounded-2xl shadow-lux overflow-hidden text-left" id="centralized-admin-control-panel">

      {/* PROFESSIONAL TITLE HEADER */}
      <div className="bg-gradient-to-r from-bark-950 via-bark-900 to-[#4a3625] px-6 py-6 text-sand-50 border-b border-sand-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-6">
          <Settings className="w-64 h-64 animate-spin-slow" />
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-clay-605 text-[9px] font-bold text-white px-3 py-0.5 rounded-full uppercase tracking-widest font-mono">
                ✦ CENTRALIZED ADMIN EXECUTIVE CORE ✦
              </span>
              <span className="text-[10px] text-sand-300 font-mono">Active Secure Console</span>
            </div>
            <h3 className="text-2xl font-serif text-white font-medium tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-clay-400" /> Admin Workspace &amp; Controls
            </h3>
            <p className="text-[11.5px] text-sand-300/85 leading-relaxed max-w-2xl font-sans">
              Consolidated command suite. Control audience simulation, monitor system analytics using Recharts, audit permissions, build dynamic layouts, and authorize credential applications.
            </p>
          </div>

          <div className="bg-black/20 p-2.5 rounded-lg border border-white/10 text-[10.5px] font-mono space-y-1 text-sand-200">
            <div className="flex justify-between gap-4">
              <span>Actual User:</span>
              <span className="font-bold text-amber-400 uppercase">{actualRole}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Simulated Persona:</span>
              <span className="font-bold text-emerald-400 uppercase">{role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* THREE MAIN NAVIGATION TABS FOR WEBSITE ADMINISTRATION */}
      <div className="bg-[#FAF8F5] border-b border-sand-200/65 px-4 overflow-x-auto scrollbar-none flex gap-1 select-none py-1.5">
        {[
          { id: 'access', label: '🛡️ Access Control & Permissions', icon: Users },
          { id: 'telemetry', label: '📊 System Telemetry & Analytics', icon: BarChart3 },
          { id: 'config', label: '🧱 Dynamic Layout Configuration', icon: Sliders }
        ].map(tab => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (trackInteraction) {
                  trackInteraction('admin_tab_switched', { tabId: tab.id });
                }
              }}
              className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 border-b-2 shrink-0 whitespace-nowrap ${
                isActive
                  ? 'border-clay-700 text-clay-700 font-black bg-white/50 rounded-t-lg'
                  : 'border-transparent text-bark-450 hover:text-bark-900'
              }`}
              id={`admin-tab-btn-${tab.id}`}
            >
              <IconComponent className={`w-4 h-4 ${isActive ? 'text-clay-650' : 'text-bark-400'}`} />
              <span>{tab.label}</span>
              {tab.id === 'access' && petitions.filter(p => p.status === 'pending').length > 0 && (
                <span className="bg-rose-600 text-white text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0">
                  {petitions.filter(p => p.status === 'pending').length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB DISPLAY WORKSPACE */}
      <div className="p-6 md:p-8 bg-white min-h-[420px]" id="centralized-admin-tab-container">
        <AnimatePresence mode="wait">

          {/* ==================== TAB 1: ACCESS CONTROL ==================== */}
          {activeTab === 'access' && (
            <motion.div
              key="access-tab-content"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-8 text-xs text-bark-800"
            >
              {/* Audience Simulation Block */}
              <div className="space-y-6 pb-6 border-b border-sand-150">
                <div className="border border-sand-250 rounded-2xl p-6 bg-[#FAF8F5]/40 text-left" id="perfectfit-simulation-sandbox-container">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1 bg-sand-200/60 text-clay-700 rounded border border-sand-250 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[10px] text-clay-750 font-mono uppercase tracking-[0.25em] font-bold" id="simulation-sandbox-tag">
                      Perfect Fit Simulation Sandbox
                    </span>
                  </div>
                  <h3 className="text-xl font-serif text-bark-950 font-normal tracking-tight">
                    Perspective Test Controller
                  </h3>
                  <p className="text-xs text-bark-650 mt-1 max-w-4xl leading-relaxed font-sans">
                    Toggle the credentials below to simulate different user personas. Watch the custom blocks in the workspace below automatically render, restrict, or render lock cards in real-time.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {availableRoles.map(r => {
                      const isActive = role === r.id;

                      // Map icons and colors beautifully
                      let IconComponent = User;
                      let activeBg = "bg-stone-800 text-stone-100 border-stone-800";
                      let iconBoxInactive = "bg-[#FAF8F5]/90 text-stone-600 border border-sand-250";
                      let iconBoxActive = "bg-stone-700/60 text-stone-100";

                      if (r.id === 'member') {
                        IconComponent = Eye;
                        activeBg = "bg-clay-800 text-white border-clay-800";
                        iconBoxInactive = "bg-[#FAF8F5]/90 text-clay-750 border border-sand-250";
                        iconBoxActive = "bg-clay-700/60 text-white";
                      } else if (r.id === 'partner') {
                        IconComponent = Briefcase;
                        activeBg = "bg-indigo-950 text-white border-indigo-950";
                        iconBoxInactive = "bg-[#FAF8F5]/90 text-indigo-750 border border-sand-250";
                        iconBoxActive = "bg-indigo-900/60 text-white";
                      } else if (r.id === 'professional') {
                        IconComponent = ShieldCheck;
                        activeBg = "bg-[#8c6239] text-white border-[#8c6239]"; // This exact brown from the screenshot
                        iconBoxInactive = "bg-[#FAF8F5]/90 text-amber-850 border border-sand-250";
                        iconBoxActive = "bg-[#734e2c] text-white";
                      }

                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            setRole(r.id);
                            if (trackInteraction) {
                              trackInteraction('admin_role_simulated', { roleId: r.id });
                            }
                          }}
                          className={`p-5 rounded-2xl border text-left flex flex-col justify-between gap-4 transition-all cursor-pointer group hover:shadow-sm ${
                            isActive
                              ? `${activeBg} shadow-md`
                              : 'bg-white/45 hover:bg-white border-sand-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 w-full">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              isActive ? iconBoxActive : iconBoxInactive
                            }`}>
                              <IconComponent className="w-4 h-4" />
                            </span>
                            <span className="font-mono text-[10.5px] uppercase font-bold tracking-wider truncate">
                              {r.name}
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed font-sans ${
                            isActive ? 'text-white/85' : 'text-bark-600'
                          }`}>
                            {r.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {simulationActive && (
                    <div className="mt-5 flex justify-end">
                      <button
                        onClick={() => {
                          resetRoleToActual();
                          if (trackInteraction) {
                            trackInteraction('admin_role_reset', { actual: actualRole });
                          }
                        }}
                        className="flex items-center gap-1.5 bg-sand-100 hover:bg-sand-200 text-bark-800 text-[10.5px] font-mono font-bold uppercase px-4 py-2.5 rounded-xl border border-sand-250 transition-all cursor-pointer shadow-4xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-clay-605 animate-pulse" />
                        <span>Deactivate Sandbox: Revert to Actual Role ({actualRole})</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Gating Config inside a clean sub-box */}
                <div className="bg-[#FAF8F5] border border-sand-200 p-6 rounded-2xl text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="p-0.5 bg-rose-50 text-rose-700 rounded border border-rose-200 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <strong className="text-[10px] font-mono uppercase text-bark-600 tracking-wider">
                          Strict System Login Enforcement
                        </strong>
                      </div>
                      <h4 className="text-xs font-serif text-bark-900 block font-bold mt-1">Require Member Login Authentication</h4>
                      <p className="text-[11px] text-bark-550 leading-relaxed font-sans">
                        When active, visitors are completely locked out of pattern details, fabric calculators, or cart transactions unless signed into an active member profile. Turn off to allow public access.
                      </p>
                    </div>

                    <button
                      onClick={handleToggleLoginGate}
                      className={`px-4 py-2.5 rounded-xl text-[10.5px] font-mono font-bold uppercase border cursor-pointer transition-all flex items-center gap-2 self-start sm:self-center flex-shrink-0 ${
                        isLoginDependent
                          ? 'bg-rose-50 text-rose-700 border-rose-250 hover:bg-rose-100/80 shadow-3xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 shadow-3xs'
                      }`}
                    >
                      {isLoginDependent ? <Lock className="w-3.5 h-3.5 text-rose-600 animate-pulse" /> : <Unlock className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{isLoginDependent ? 'Gating Active' : 'Public Access'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Access Petitions Area */}
              <div className="space-y-4 pb-6 border-b border-sand-150 text-left">
                <div className="flex flex-col sm:flex-row justify-between sm:items-end gap-3">
                  <div className="space-y-1">
                    <strong className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                      ✦ Guest Credential Upgrade Petitions ({petitions.length} Total)
                    </strong>
                    <p className="text-bark-550 text-[11px]">
                      Approve or deny visitor requests to gain special workspace clearances.
                    </p>
                  </div>

                  {petitions.length > 0 && (
                    <button
                      onClick={handleClearPetitions}
                      className="bg-sand-100 hover:bg-sand-200 text-bark-700 text-[10.5px] font-mono font-bold uppercase px-3 py-2 rounded-xl border border-sand-250 cursor-pointer transition-all flex items-center gap-1.5 self-start"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-clay-605" />
                      <span>Clear Archive</span>
                    </button>
                  )}
                </div>

                {petitions.length === 0 ? (
                  <div className="bg-[#FAF8F5] border border-dashed border-sand-300 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-2 min-h-[140px]">
                    <div className="w-8 h-8 bg-sand-100 text-bark-400 rounded-full flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <h5 className="text-[11px] font-bold text-bark-900 uppercase font-mono">No Upgrade Petitions</h5>
                      <p className="text-[10.5px] text-bark-500 font-sans">
                        Visitor upgrade requests will queue here automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {petitions.map(p => (
                      <div key={p.id} className="bg-white border border-sand-200 p-4 rounded-xl shadow-4xs space-y-3 relative overflow-hidden">
                        <div className="flex justify-between items-start gap-2 pb-2 border-b border-sand-100">
                          <div>
                            <span className="text-[8px] font-mono text-bark-400 block">{p.timestamp ? new Date(p.timestamp).toLocaleDateString() : 'Recent'}</span>
                            <strong className="text-xs font-semibold text-bark-950 font-sans block truncate max-w-[200px]">{p.name}</strong>
                            <span className="text-[10px] text-bark-500 font-mono block truncate max-w-[200px]">{p.email}</span>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded font-mono text-[8px] uppercase font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                              {p.requestedRole}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono uppercase font-bold ${
                              p.status === 'approved' ? 'bg-emerald-50 text-emerald-800' :
                              p.status === 'denied' ? 'bg-red-50 text-red-800' :
                              'bg-amber-50 text-amber-800'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[8.5px] font-mono text-bark-400 uppercase font-bold">Justification:</span>
                          <p className="text-bark-700 text-[10.5px] leading-relaxed italic font-sans bg-[#FAF8F5] p-2 rounded">
                            "{p.justification}"
                          </p>
                        </div>

                        {p.status === 'pending' && (
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => handlePetitionDecision(p.id, false)}
                              className="bg-sand-100 hover:bg-sand-200 text-bark-800 text-[9.5px] font-mono font-bold uppercase px-2.5 py-1.5 rounded border border-sand-250 cursor-pointer flex items-center gap-1"
                            >
                              <X className="w-3 h-3 text-clay-605" />
                              <span>Deny</span>
                            </button>
                            <button
                              onClick={() => handlePetitionDecision(p.id, true)}
                              className="bg-bark-900 hover:bg-stone-850 text-white text-[9.5px] font-mono font-bold uppercase px-2.5 py-1.5 rounded cursor-pointer flex items-center gap-1 shadow-3xs"
                            >
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Approve</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Consolidated Professional Workspaces */}
              <div className="space-y-4 text-left">
                <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-3 pb-2 border-b border-sand-150">
                  <div className="space-y-1">
                    <strong className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                      ✦ Consolidated Professional Operations Center
                    </strong>
                    <p className="text-bark-550 text-[11px]">
                      Access drafting cards, fiber stock records, and B2B partner stats.
                    </p>
                  </div>

                  <div className="flex bg-sand-150 p-1 rounded-xl border border-sand-200 gap-1 overflow-x-auto">
                    {[
                      { id: 'workspace', label: '💼 Collaborator Workspace', icon: ClipboardList },
                      { id: 'inventory', label: '🧵 Fabric Inventory', icon: Layers },
                      { id: 'operations', label: '📊 Partner KPI', icon: BarChart3 },
                      { id: 'audit', label: '🔑 Role Matrix', icon: Key }
                    ].map(subTab => (
                      <button
                        key={subTab.id}
                        type="button"
                        onClick={() => {
                          setActiveWorkspaceTab(subTab.id);
                          if (trackInteraction) {
                            trackInteraction('admin_workspace_switched', { workspaceId: subTab.id });
                          }
                        }}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                          activeWorkspaceTab === subTab.id
                            ? 'bg-white text-clay-700 shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                      >
                        <subTab.icon className="w-3.5 h-3.5" />
                        <span>{subTab.label.split(' ').slice(1).join(' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-1">
                  {activeWorkspaceTab === 'workspace' && <CollaboratorWorkspace />}
                  {activeWorkspaceTab === 'inventory' && <DynamicInventory />}
                  {activeWorkspaceTab === 'operations' && <ProfessionalDashboard />}
                  {activeWorkspaceTab === 'audit' && <PermissionsOverview />}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== TAB 2: SYSTEM TELEMETRY ==================== */}
          {activeTab === 'telemetry' && (
            <motion.div
              key="telemetry-tab-content"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6 text-xs text-bark-800"
            >
              <div className="space-y-1 text-left pb-3 border-b border-sand-150 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <strong className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                    ✦ Real-Time Diagnostic Telemetry
                  </strong>
                  <p className="text-bark-550 text-[11px]">
                    Interactive charting built with Recharts capturing database events, block hits, and visitor behaviors.
                  </p>
                </div>

                <div className="flex gap-2 self-start sm:self-auto">
                  <button
                    onClick={refreshLogs}
                    className="bg-white hover:bg-sand-50 text-bark-700 text-[10px] font-mono font-bold uppercase px-3.5 py-2 rounded-xl border border-sand-250 cursor-pointer transition-all flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-clay-605" />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={() => {
                      if (clearAnalytics) {
                        clearAnalytics();
                        if (window.showToast) {
                          window.showToast("Telemetry metrics and logs successfully flushed.", "info", "Logs Cleaned");
                        }
                      }
                    }}
                    className="bg-clay-50 hover:bg-clay-100 text-clay-800 text-[10px] font-mono font-bold uppercase px-3.5 py-2 rounded-xl border border-clay-200 cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-clay-605" />
                    <span>Purge Logs</span>
                  </button>
                </div>
              </div>

              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                <div className="bg-[#FAF8F5] border border-sand-200 rounded-xl p-4 space-y-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block font-bold">Transactions Logged</span>
                  <div className="flex items-baseline gap-1">
                    <strong className="text-2xl font-serif text-bark-900">{logs.length}</strong>
                    <span className="text-[9px] font-mono text-bark-500">Events</span>
                  </div>
                  <div className="text-[9.5px] text-bark-500 font-sans truncate">Active stream logging enabled</div>
                </div>

                <div className="bg-[#FAF8F5] border border-sand-200 rounded-xl p-4 space-y-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block font-bold">Access Gated Denials</span>
                  <div className="flex items-baseline gap-1">
                    <strong className={`text-2xl font-serif ${logs.filter(l => l.actionType === 'access_denied').length > 0 ? 'text-rose-700 animate-pulse' : 'text-bark-900'}`}>
                      {logs.filter(l => l.actionType === 'access_denied').length}
                    </strong>
                    <span className="text-[9px] font-mono text-rose-600">Interceptions</span>
                  </div>
                  <div className="text-[9.5px] text-bark-500 font-sans">Blocks protected with shields</div>
                </div>

                <div className="bg-[#FAF8F5] border border-sand-200 rounded-xl p-4 space-y-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block font-bold">Rule Mutations</span>
                  <div className="flex items-baseline gap-1">
                    <strong className="text-2xl font-serif text-bark-900">
                      {logs.filter(l => l.actionType === 'rule_toggled').length}
                    </strong>
                    <span className="text-[9px] font-mono text-indigo-600">Altered</span>
                  </div>
                  <div className="text-[9.5px] text-bark-500 font-sans">Component permissions modified</div>
                </div>

                <div className="bg-[#FAF8F5] border border-sand-200 rounded-xl p-4 space-y-2">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-bark-400 block font-bold">Security Integrity Code</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                    <strong className="text-sm font-mono text-emerald-800 font-bold">ISO_PERFECT_FIT_OK</strong>
                  </div>
                  <div className="text-[9.5px] text-bark-500 font-sans">Diagnostic sandboxing secured</div>
                </div>
              </div>

              {/* THREE RECHARTS VISUALIZATION GRAPHS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">

                {/* Graph 1: Real-Time User Activity */}
                <div className="lg:col-span-8 bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-ux">
                  <div className="border-b border-sand-150 pb-2">
                    <h5 className="text-xs font-serif font-bold text-bark-900 uppercase tracking-wide flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-clay-605" /> Real-Time User Activity &amp; Denials Ledger
                    </h5>
                    <p className="text-[10px] text-bark-450">Monitors active accesses, reconfigurations and blocked attempts over a 7-day trailing span.</p>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={realTimeActivityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorInteractions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8c6239" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#8c6239" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDenials" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ba6446" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ba6446" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" stroke="#a3a3a3" fontSize={10} fontFamily="monospace" />
                        <YAxis stroke="#a3a3a3" fontSize={10} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: '#FAF8F5', border: '1px solid #d4d4d4', fontSize: '11px', fontFamily: 'sans-serif' }} />
                        <Area type="monotone" dataKey="interactions" stroke="#8c6239" strokeWidth={2} fillOpacity={1} fill="url(#colorInteractions)" name="Operations" />
                        <Area type="monotone" dataKey="accessDenials" stroke="#ba6446" strokeWidth={2} fillOpacity={1} fill="url(#colorDenials)" name="Access Denials" />
                        <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Graph 2: Visitor Session Weights */}
                <div className="lg:col-span-4 bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-ux flex flex-col justify-between">
                  <div>
                    <div className="border-b border-sand-150 pb-2">
                      <h5 className="text-xs font-serif font-bold text-bark-900 uppercase tracking-wide flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-clay-605" /> Visitor Persona Metrics
                      </h5>
                      <p className="text-[10px] text-bark-450">Active simulated sessions weight distribution.</p>
                    </div>

                    <div className="h-44 w-full relative flex items-center justify-center mt-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={visitorMetricsData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {visitorMetricsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#FAF8F5', fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="absolute text-center">
                        <strong className="text-xl font-mono text-bark-900 block">{totalVisitorWeight}</strong>
                        <span className="text-[8.5px] font-mono uppercase tracking-widest text-bark-400 block font-bold">Weight Index</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-sand-100">
                    {visitorMetricsData.map(v => (
                      <div key={v.name} className="flex items-center justify-between font-mono text-[9.5px]">
                        <span className="flex items-center gap-1.5 text-bark-600">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: v.color }} />
                          {v.name}
                        </span>
                        <strong className="text-bark-900 font-bold">{v.value} ({Math.round((v.value / totalVisitorWeight) * 100)}%)</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Graph 3: Pattern Interest Tracking */}
                <div className="lg:col-span-12 bg-white border border-sand-200 rounded-xl p-5 space-y-4 shadow-ux">
                  <div className="border-b border-sand-150 pb-2">
                    <h5 className="text-xs font-serif font-bold text-bark-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-clay-605" /> Pattern Interest Tracking &amp; Catalog Cart Metrics
                    </h5>
                    <p className="text-[10px] text-bark-450">Displays views, cart additions, and wishlist counts for custom garments.</p>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={patternInterestData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#a3a3a3" fontSize={9.5} fontFamily="sans-serif" tickFormatter={(v) => v.split(' ')[1] || v} />
                        <YAxis stroke="#a3a3a3" fontSize={10} fontFamily="monospace" />
                        <Tooltip contentStyle={{ backgroundColor: '#FAF8F5', border: '1px solid #e2e2e2', fontSize: '11px' }} />
                        <Bar dataKey="views" fill="#8c6239" name="Page Views" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="cartAdditions" fill="#556b2f" name="Cart Additions" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="wishlist" fill="#ba6446" name="In Wishlists" radius={[3, 3, 0, 0]} />
                        <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '10px' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* LIVE DIAGNOSTICS AUDIT REGISTRY */}
              <div className="border border-sand-200 rounded-xl overflow-hidden bg-white text-left">
                <div className="p-3 bg-[#FAF8F5] border-b border-sand-200 flex justify-between items-center text-[10px] font-mono uppercase text-bark-500">
                  <span>Audited Diagnostic Transactions stream</span>
                  <span className="text-emerald-700 font-bold animate-pulse">● SECURE LOGS ACTIVE</span>
                </div>

                {logs.length === 0 ? (
                  <div className="p-8 text-center text-bark-400 italic">
                    No logs recorded. Select different roles or edit components visibility rules to generate live diagnostic updates.
                  </div>
                ) : (
                  <div className="divide-y divide-sand-150 max-h-[220px] overflow-y-auto pr-1 font-mono text-[10.5px]">
                    {logs.slice().reverse().map((log, index) => {
                      const dateStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Recent';
                      return (
                        <div key={log.id || index} className="p-3 hover:bg-sand-50/50 transition-colors flex justify-between items-start gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-bark-400">{dateStr}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                log.actionType === 'access_denied' ? 'bg-red-50 text-red-700 border border-red-200' :
                                log.actionType === 'rule_toggled' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              }`}>
                                {log.actionType}
                              </span>
                              <span className="text-bark-800 uppercase font-bold text-[9px]">👥 {log.role}</span>
                            </div>
                            <p className="text-bark-600 leading-relaxed font-sans text-[11px]">
                              <strong>Event:</strong> {
                                log.actionType === 'role_switched' ? `Sandbox persona modified to ${log.details?.nextRole}` :
                                log.actionType === 'rule_toggled' ? `Gated visibility of component "${log.details?.componentKey}" updated` :
                                log.actionType === 'access_denied' ? `Intercepted blocked view attempt for "${log.details?.componentKey}"` :
                                log.actionType === 'feature_accessed' ? `Granted workspace display of "${log.details?.componentName}"` :
                                JSON.stringify(log.details)
                              }
                            </p>
                          </div>

                          <span className="text-[9px] text-bark-350 select-none">#{logs.length - index}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ==================== TAB 3: DYNAMIC LAYOUT CONFIGURATION ==================== */}
          {activeTab === 'config' && (
            <motion.div
              key="config-tab-content"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-6 text-xs text-bark-800"
            >
              {/* Global Blueprint Hover Info Admin Switch */}
              <div className="bg-[#FAF8F5] border border-sand-250 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-3xs" id="admin-console-hover-control">
                <div className="flex items-start gap-3">
                  <span className="p-2 bg-clay-700 text-white rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider shrink-0 flex items-center justify-center shadow-3xs">
                    <ShieldCheck className="w-4 h-4 text-sand-100" />
                  </span>
                  <div className="space-y-0.5 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-serif text-bark-950 font-bold text-sm">Blueprint Card Hover Specification Info</h4>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border ${
                        hoverEnabled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-clay-50 text-clay-800 border-clay-200'
                      }`}>
                        Status: {hoverEnabled ? 'ACTIVE / ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-bark-600 font-sans leading-relaxed">
                      Master Admin Toggle: Enable or disable interactive garment specification overlays and hover reveals for all items in the catalog.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleToggleHoverSpecs(true)}
                    disabled={hoverEnabled}
                    className={`px-3.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase border transition-all cursor-pointer flex items-center gap-1.5 ${
                      hoverEnabled
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-3xs cursor-not-allowed font-black'
                        : 'bg-white text-bark-700 border-sand-250 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300'
                    }`}
                    id="admin-console-enable-hover-btn"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enable Hover Overlay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleHoverSpecs(false)}
                    disabled={!hoverEnabled}
                    className={`px-3.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase border transition-all cursor-pointer flex items-center gap-1.5 ${
                      !hoverEnabled
                        ? 'bg-clay-650 text-white border-clay-650 shadow-3xs cursor-not-allowed font-black'
                        : 'bg-white text-bark-700 border-sand-250 hover:bg-clay-50 hover:text-clay-800 hover:border-clay-300'
                    }`}
                    id="admin-console-disable-hover-btn"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Disable Hover Overlay</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-sand-150 pb-3 flex flex-col md:flex-row justify-between md:items-end gap-3 text-left">
                <div>
                  <strong className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                    ✦ Component Permissions &amp; Layout configuration
                  </strong>
                  <p className="text-bark-550 text-[11px]">
                    Arrange visibility matrices, toggles, static templates, or custom layout segments dynamically.
                  </p>
                </div>

                {/* Configurations sub-tabs */}
                <div className="flex bg-sand-150 p-1 rounded-xl border border-sand-200 gap-1 shrink-0 overflow-x-auto">
                  {[
                    { id: 'visibility', label: '🛡️ Role Permissions' },
                    { id: 'homepage', label: '🏠 Homepage Sections' },
                    { id: 'metadata', label: '🧱 DB Segments' }
                  ].map(subTab => (
                    <button
                      key={subTab.id}
                      type="button"
                      onClick={() => setLayoutSubTab(subTab.id)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        layoutSubTab === subTab.id
                          ? 'bg-white text-clay-700 shadow-3xs'
                          : 'text-bark-500 hover:text-bark-900'
                      }`}
                    >
                      {subTab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3A: Role permissions checklist matrix */}
              {layoutSubTab === 'visibility' && (
                <div className="space-y-6 animate-fadeIn text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-sand-50 p-4 border border-sand-200 rounded-xl">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase text-bark-600 block font-bold">Rules matrix configuration</span>
                      <p className="text-[11px] text-bark-500 font-sans">Check roles to grant immediate access to subcomponents across the client application.</p>
                    </div>

                    <button
                      onClick={() => {
                        if (handleResetRules) {
                          handleResetRules();
                          if (window.showToast) {
                            window.showToast("All visibility matrices restored to system defaults.", "info", "Reset Completed");
                          }
                        }
                      }}
                      className="bg-white hover:bg-sand-50 text-bark-800 text-[10px] font-mono font-bold uppercase px-3.5 py-2 rounded-xl border border-sand-250 cursor-pointer transition-all flex items-center gap-1.5 shadow-4xs self-start"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-clay-605" />
                      <span>Reset Rules Matrix</span>
                    </button>
                  </div>

                  {/* Matrix table representation */}
                  <div className="border border-sand-200 rounded-xl overflow-hidden bg-[#FAF8F5]/30">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#FAF8F5] border-b border-sand-200 text-bark-900 text-[10px] font-mono uppercase">
                            <th className="p-3.5 pl-5 font-bold">Workspace Component Block Name</th>
                            <th className="p-3.5 font-bold text-center">Guest Visitor</th>
                            <th className="p-3.5 font-bold text-center">Perfect Fit Member</th>
                            <th className="p-3.5 font-bold text-center">Creative Partner</th>
                            <th className="p-3.5 font-bold text-center">Master Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sand-150 text-[11px]">
                          {Object.values(ComponentRegistry).map(item => {
                            const componentKey = item.id;
                            const ruleList = rules[componentKey] || [];
                            return (
                              <tr key={componentKey} className="hover:bg-sand-50/50 transition-colors bg-white">
                                <td className="p-3.5 pl-5">
                                  <div className="flex items-center gap-2">
                                    <item.icon className="w-4 h-4 text-clay-650 shrink-0" />
                                    <div>
                                      <strong className="text-bark-900 font-bold uppercase tracking-wide block font-mono text-[10px]">{item.name}</strong>
                                      <span className="text-[10px] text-bark-450 font-sans block">{item.description}</span>
                                    </div>
                                  </div>
                                </td>
                                {['visitor', 'member', 'partner', 'professional'].map(roleId => {
                                  const isChecked = ruleList.includes(roleId);
                                  return (
                                    <td key={roleId} className="p-3.5 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (handleToggleRule) handleToggleRule(componentKey, roleId);
                                        }}
                                        className="w-4 h-4 rounded border-sand-300 text-clay-605 focus:ring-clay-500 cursor-pointer"
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Gated display mode selector */}
                  <div className="p-4 bg-[#FAF8F5] border border-sand-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase text-bark-600 block font-bold">Unauthorized Component Behavior</span>
                      <p className="text-[11px] text-bark-500 font-sans">Choose representation when components are locked or gated from simulated user scopes.</p>
                    </div>

                    <div className="flex bg-sand-150 p-1 rounded-xl border border-sand-200 shrink-0">
                      <button
                        onClick={() => {
                          if (setGatedRenderMode) setGatedRenderMode('lock-screen');
                        }}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                          gatedRenderMode === 'lock-screen'
                            ? 'bg-white text-clay-700 shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                      >
                        Lock Screen
                      </button>
                      <button
                        onClick={() => {
                          if (setGatedRenderMode) setGatedRenderMode('hide');
                        }}
                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                          gatedRenderMode === 'hide'
                            ? 'bg-white text-clay-700 shadow-3xs'
                            : 'text-bark-500 hover:text-bark-900'
                        }`}
                      >
                        Hide Completely
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3B: Perfect Fit Homepage layouts controllers */}
              {layoutSubTab === 'homepage' && (
                <div className="animate-fadeIn">
                  <PerfectFitLayoutController
                    appLayout={appLayout}
                    setAppLayout={setAppLayout}
                    onReset={onResetLayout}
                  />
                </div>
              )}

              {/* 3C: Dynamic Database segments build */}
              {layoutSubTab === 'metadata' && (
                <div className="space-y-6 animate-fadeIn text-left">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <strong className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                      ✦ Database segments list &amp; creator
                    </strong>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetMetadataDb}
                        className="bg-white hover:bg-sand-50 text-bark-700 text-[10.5px] font-mono font-bold uppercase px-3 py-2 rounded-xl border border-sand-250 cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-clay-605" />
                        <span>Factory Reset DB</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditSectionId(null);
                          setFormSecType('text-block');
                          setFormSecTitle('New Custom Pattern Section');
                          setFormSecSubtitle('Slow-Fashion Craftsmanship');
                          setFormSecContent('Enter visual descriptions, checklists or specs separated by commas.');
                          setFormSecImage('');
                          setFormSecBadge('');
                          setFormAllowedGuests(true);
                          setFormAllowedBuyers(true);
                          setFormAllowedCollaborators(true);
                          setFormAllowedAdmins(true);
                          setShowSectionForm(true);
                        }}
                        className="bg-clay-650 hover:bg-clay-600 text-white text-[10.5px] font-mono font-bold uppercase px-4 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-3xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Segment</span>
                      </button>
                    </div>
                  </div>

                  {/* Segment Create / Edit Form Overlay */}
                  {showSectionForm && (
                    <form onSubmit={handleSaveSectionForm} className="bg-sand-50/50 border border-sand-250 p-5 rounded-xl space-y-4 text-left animate-fadeIn">
                      <div className="flex justify-between items-center pb-2 border-b border-sand-200">
                        <h5 className="text-xs font-bold uppercase text-bark-900 font-mono tracking-wide">
                          {editSectionId ? `⚙️ Edit Block Segment [ID: ${editSectionId}]` : '🧱 Create Custom Database Segment'}
                        </h5>
                        <button
                          type="button"
                          onClick={() => setShowSectionForm(false)}
                          className="p-1 rounded-full hover:bg-sand-200 text-bark-450 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Segment Layout Style</label>
                          <select
                            value={formSecType}
                            onChange={(e) => setFormSecType(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg"
                          >
                            <option value="hero-header">hero-header (Large banner with image background)</option>
                            <option value="text-block">text-block (Elegant prose & blockquote callout)</option>
                            <option value="stats-grid">stats-grid (Sustainability stats and measurements grid)</option>
                            <option value="showcase-cards">showcase-cards (Product highlight showcase grids)</option>
                            <option value="checklists">checklists (Technical stitch checkpoints guidelines)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Main Title Header</label>
                          <input
                            type="text"
                            value={formSecTitle}
                            onChange={(e) => setFormSecTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Subtitle / Status Label</label>
                          <input
                            type="text"
                            value={formSecSubtitle}
                            onChange={(e) => setFormSecSubtitle(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <label className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Segment Content Prose / Comma-separated Guidelines</label>
                        <textarea
                          value={formSecContent}
                          onChange={(e) => setFormSecContent(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg leading-relaxed font-sans"
                          placeholder="Provide descriptive narratives. If choosing checklists, separate each bullet point with a comma..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Optional Background Image Link</label>
                          <input
                            type="text"
                            value={formSecImage}
                            onChange={(e) => setFormSecImage(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg font-mono"
                            placeholder="https://images.unsplash.com/..."
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Display Badge Label</label>
                          <input
                            type="text"
                            value={formSecBadge}
                            onChange={(e) => setFormSecBadge(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-sand-250 rounded-lg"
                            placeholder="e.g. COUTURE SPEC"
                          />
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-sand-150 text-xs">
                        <span className="text-[10px] font-mono text-bark-600 uppercase block font-bold">Target Persona Clearance Rights</span>
                        <div className="flex flex-wrap gap-4 bg-white p-3 border border-sand-200 rounded-lg">
                          <label className="flex items-center gap-1.5 select-none cursor-pointer">
                            <input type="checkbox" checked={formAllowedGuests} onChange={(e) => setFormAllowedGuests(e.target.checked)} className="rounded border-sand-300 text-clay-605" />
                            <span>Guests</span>
                          </label>
                          <label className="flex items-center gap-1.5 select-none cursor-pointer">
                            <input type="checkbox" checked={formAllowedBuyers} onChange={(e) => setFormAllowedBuyers(e.target.checked)} className="rounded border-sand-300 text-clay-605" />
                            <span>Members</span>
                          </label>
                          <label className="flex items-center gap-1.5 select-none cursor-pointer">
                            <input type="checkbox" checked={formAllowedCollaborators} onChange={(e) => setFormAllowedCollaborators(e.target.checked)} className="rounded border-sand-300 text-clay-605" />
                            <span>Partners</span>
                          </label>
                          <label className="flex items-center gap-1.5 select-none cursor-pointer">
                            <input type="checkbox" checked={formAllowedAdmins} onChange={(e) => setFormAllowedAdmins(e.target.checked)} className="rounded border-sand-300 text-clay-605" />
                            <span>Admins</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setShowSectionForm(false)}
                          className="px-4 py-2 bg-sand-200 hover:bg-sand-250 text-bark-800 font-mono font-bold uppercase rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#2e261f] hover:bg-stone-850 text-white font-mono font-bold uppercase rounded-lg cursor-pointer shadow-3xs"
                        >
                          Save Segment
                        </button>
                      </div>
                    </form>
                  )}

                  {/* List of registered segments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">

                    {/* Active Registry */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                        ✦ Registered Live Segments Database ({metadata.profile.sections.length} total)
                      </span>

                      <div className="space-y-3 max-h-[360px] overflow-y-auto border border-sand-200/70 p-3 bg-[#FAF8F5]/30 rounded-xl">
                        {metadata.profile.sections.map((sec, index) => (
                          <div key={sec.id} className="bg-white border border-sand-200 rounded-lg p-3.5 space-y-2 relative group shadow-4xs">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-[8px] font-mono bg-sand-150 text-bark-600 px-1.5 py-0.5 rounded font-bold uppercase">{sec.type}</span>
                                <h5 className="font-serif font-bold text-bark-900 mt-1 text-xs">
                                  {index + 1}. {sec.title}
                                </h5>
                              </div>

                              <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditSection(sec)}
                                  className="p-1 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded transition-all cursor-pointer"
                                  title="Edit Segment"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSection(sec.id)}
                                  className="p-1 text-clay-605 hover:bg-clay-50 border border-transparent hover:border-clay-100 rounded transition-all cursor-pointer"
                                  title="Delete Segment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {sec.subtitle && <p className="text-[10px] text-bark-500 italic font-sans">{sec.subtitle}</p>}

                            <div className="flex items-center justify-between text-[9px] font-mono text-bark-400 pt-1.5 border-t border-sand-100 mt-1">
                              <span>ID: {sec.id}</span>
                              <span className="text-clay-605 font-bold uppercase">
                                👥 {sec.visibilityRule?.allowedRoles?.join(', ') || 'all'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Raw JSON DB field */}
                    <div className="space-y-3">
                      <span className="text-[10px] font-mono text-clay-750 font-bold uppercase block tracking-wider">
                        ✦ Live JSON Metadata field override
                      </span>

                      <div className="space-y-3">
                        <textarea
                          value={rawJsonText}
                          onChange={(e) => setRawJsonText(e.target.value)}
                          rows={13}
                          className="w-full font-mono text-[10px] p-3 bg-bark-950 text-emerald-400 rounded-xl leading-relaxed shadow-inner border border-bark-900 focus:outline-none"
                        />

                        {jsonError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[9.5px] text-red-600 font-mono flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Syntax Error: {jsonError}</span>
                          </div>
                        )}

                        <button
                          onClick={handleSaveRawJson}
                          className="bg-bark-900 hover:bg-stone-850 text-white text-[10.5px] font-mono font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-1.5 shadow-3xs"
                        >
                          <Save className="w-4 h-4" />
                          <span>Commit Raw JSON Transaction</span>
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
