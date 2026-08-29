import { clientPreferences } from '../../lib/clientPreferences';
import React, { useState, useEffect } from 'react';
import { useRuntimeCollectionState } from '../../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../../lib/runtimeDomainContracts';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { useRole } from '../../context/RoleContext';
import PermissionsGuideModal from '../PermissionsGuideModal';
import { UI_LAYERS } from '../../lib/uiLayers';
import {
  TrendingUp, Layers, Clock, Coins, Sparkles, Activity, FileText,
  Plus, Search, ShieldCheck, Award, Briefcase, ChevronRight,
  Trash2, Scale, BarChart2, PlusCircle, CheckCircle2, AlertTriangle, HelpCircle,
  Shield, XCircle, UserCheck, Mail
} from 'lucide-react';

export default function ProfessionalDashboard() {
  const [projects, setProjects] = useRuntimeCollectionState(RUNTIME_DOMAINS.PROJECTS, []);
  const [inventory, setInventory] = useRuntimeCollectionState(RUNTIME_DOMAINS.INVENTORY, []);
  const [timeLogs, setTimeLogs] = useRuntimeCollectionState(RUNTIME_DOMAINS.TIME_LOGS, []);

  // Local helper states
  const { role, setRole } = useRole();
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);

  const handleResetRules = () => {
    try {
      const initial = {
        gallery: ['visitor', 'member', 'partner', 'professional'],
        projectManagement: ['member', 'partner', 'professional'],
        inventory: ['partner', 'professional'],
        professionalDashboard: ['partner', 'professional'],
        permissionsOverview: ['visitor', 'member', 'partner', 'professional'],
        analytics: ['professional']
      };
      clientPreferences.setItem('sartorial_layout_rules', JSON.stringify(initial));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('sartorial_layout_rules_updated'));
    } catch {}
  };

  const [accessRequests, setAccessRequests] = useRuntimeCollectionState(RUNTIME_DOMAINS.ACCESS_REQUESTS, []);

  useEffect(() => {
    const handleSync = () => {
      try {
        setAccessRequests((current) => [...current]);
      } catch {}
    };
    window.addEventListener('sartorial_requests_updated', handleSync);
    return () => {
      window.removeEventListener('sartorial_requests_updated', handleSync);
    };
  }, []);

  const handleProcessRequest = (id, action) => {
    const updated = accessRequests.map(req => {
      if (req.id === id) {
        return { ...req, status: action === 'approve' ? 'Approved' : 'Rejected' };
      }
      return req;
    });
    setAccessRequests(updated);
    window.dispatchEvent(new Event('sartorial_requests_updated'));

    const req = accessRequests.find(r => r.id === id);
    if (action === 'approve' && req) {
      setRole(req.requestedRole);
      if (window.showToast) {
        window.showToast(
          `Upgraded simulated persona to ${req.requestedRole.toUpperCase()} credentials successfully.`,
          'success',
          'Access Granted'
        );
      }
    } else {
      if (window.showToast) {
        window.showToast(
          `Request for ${req?.name || 'user'} has been declined.`,
          'warning',
          'Access Denied'
        );
      }
    }
  };

  const [activeProjectTab, setActiveProjectTab] = useState('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState(null);

  // Quick-Add log state
  const [logPatternName, setLogPatternName] = useState('Aurelia Wrap Dress');
  const [logStepName, setLogStepName] = useState('Fuse Front Facings');
  const [logMinutes, setLogMinutes] = useState('15');
  const [logNotes, setLogNotes] = useState('');

  // Sync back to local storage helper
  const syncProjects = (updated) => {
    setProjects(updated);
  };

  const syncInventory = (updated) => {
    setInventory(updated);
  };

  const syncTimeLogs = (updated) => {
    setTimeLogs(updated);
  };

  // Calculations
  const totalProjectsCount = projects.length;
  const completedProjectsCount = projects.filter(p => p.status === 'Completed' || p.progress === 100).length;
  const activeProjectsCount = projects.filter(p => p.status !== 'Completed' && p.progress < 100).length;
  const avgProgress = totalProjectsCount > 0
    ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / totalProjectsCount)
    : 0;

  const totalYards = inventory.reduce((sum, item) => sum + (parseFloat(item.stock) || 0), 0);
  const totalInventoryCost = inventory.reduce((sum, item) => sum + ((parseFloat(item.stock) || 0) * (parseFloat(item.cost) || 0)), 0);
  const lowStockCount = inventory.filter(i => i.status === 'Low Stock' || i.status === 'Critically Low' || i.stock <= i.threshold).length;

  const totalSecondsSewed = timeLogs.reduce((sum, log) => sum + (parseInt(log.durationSeconds) || 0), 0);
  const totalHoursSewed = (totalSecondsSewed / 3600).toFixed(1);
  const avgSessionMins = timeLogs.length > 0
    ? Math.round((totalSecondsSewed / timeLogs.length) / 60)
    : 0;

  // Add Time Log Handler
  const handleAddManualLog = (e) => {
    e.preventDefault();
    const durationSeconds = (parseInt(logMinutes) || 0) * 60;
    const newLog = {
      id: `log-manual-${Date.now()}`,
      patternId: 'custom-manual',
      patternName: logPatternName,
      stepName: logStepName,
      durationSeconds,
      date: new Date().toISOString(),
      notes: logNotes || 'Manual session log updated via Professional Dashboard.'
    };

    const updated = [newLog, ...timeLogs];
    syncTimeLogs(updated);
    setShowLogModal(false);
    setLogNotes('');

    // Also notify if toast is present in UI
    if (window.showToast) {
      window.showToast("Successfully logged manual tailoring session.", "success", "Time Registered");
    }
  };

  // Adjust material price or stock level from dashboard to showcase active real-time ledger binding
  const adjustInventoryStock = (id, delta) => {
    const updated = inventory.map(item => {
      if (item.id === id) {
        const nextStock = Math.max(0, parseFloat((item.stock + delta).toFixed(2)));
        let nextStatus = 'In Stock';
        if (nextStock === 0) nextStatus = 'Out of Stock';
        else if (nextStock <= item.threshold / 2) nextStatus = 'Critically Low';
        else if (nextStock <= item.threshold) nextStatus = 'Low Stock';
        return { ...item, stock: nextStock, status: nextStatus };
      }
      return item;
    });
    syncInventory(updated);
  };

  const deleteTimeLog = (id) => {
    const updated = timeLogs.filter(log => log.id !== id);
    syncTimeLogs(updated);
  };

  return (
    <div className="space-y-8" id="professional-dashboard-wrapper">
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-sand-200 shadow-ux">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg border border-amber-200">
              <Briefcase className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-clay-700 font-bold">{pfUiT("ui.components.subcomponents.professionaldashboard.afddbfb7a3")}</span>
          </div>
          <h2 className="text-2xl font-serif text-bark-950 font-light">{pfUiT("ui.components.subcomponents.professionaldashboard.0fbf2bf81e")}</h2>
          <p className="text-xs text-bark-550 max-w-xl">{pfUiT("ui.components.subcomponents.professionaldashboard.234ff1884a")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          {role === 'professional' && (
            <button
              onClick={() => setShowPermissionsGuide(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-mono font-bold uppercase tracking-wider px-4.5 py-2.5 rounded-xl transition-all cursor-pointer border border-indigo-200 shadow-4xs animate-fadeIn"
              title={pfUiT("ui.components.subcomponents.professionaldashboard.288c9b092c")}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
              <span>{pfUiT("ui.components.subcomponents.professionaldashboard.a24d54a871")}</span>
            </button>
          )}
          <button
            onClick={() => setShowLogModal(true)}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-850 text-white text-xs font-mono font-bold uppercase tracking-wider px-4.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-3xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{pfUiT("ui.components.subcomponents.professionaldashboard.57df5eb6c1")}</span>
          </button>
        </div>
      </div>

      {/* THREE PILLAR SUMMARY KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* PILLAR 1: PROJECTS & COMMISSIONS */}
        <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-ux space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.subcomponents.professionaldashboard.21d1600446")}</span>
              <h3 className="text-xl font-serif font-light text-bark-900">{pfUiT("ui.components.subcomponents.professionaldashboard.2040a1dab1")}</h3>
            </div>
            <div className="p-2.5 bg-clay-50/70 border border-clay-150 rounded-xl text-clay-705">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="bg-sand-50/50 p-3 rounded-xl border border-sand-150/60 text-center">
              <span className="text-[10px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.7abd2b1e49")}</span>
              <strong className="text-2xl font-serif text-bark-900">{activeProjectsCount}</strong>
            </div>
            <div className="bg-sand-50/50 p-3 rounded-xl border border-sand-150/60 text-center">
              <span className="text-[10px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.c195778dac")}</span>
              <strong className="text-2xl font-serif text-emerald-800">{completedProjectsCount}</strong>
            </div>
          </div>

          <div className="space-y-1.5 pt-1.5">
            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-bark-600 font-sans">{pfUiT("ui.components.subcomponents.professionaldashboard.6dfb36f11e")}</span>
              <span className="font-mono font-bold text-clay-700">{avgProgress}%</span>
            </div>
            <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden">
              <div className="h-full bg-clay-605 rounded-full" style={{ width: `${avgProgress}%` }} />
            </div>
          </div>
        </div>

        {/* PILLAR 2: TEXTILE CAPITAL EXPENDITURE */}
        <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-ux space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.subcomponents.professionaldashboard.9ff49cb628")}</span>
              <h3 className="text-xl font-serif font-light text-bark-900">{pfUiT("ui.components.subcomponents.professionaldashboard.21223981a9")}</h3>
            </div>
            <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
              <Coins className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="bg-indigo-50/20 p-3 rounded-xl border border-indigo-100 text-center">
              <span className="text-[10px] font-mono text-indigo-800 font-semibold block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.0c1ef6b9de")}</span>
              <strong className="text-xl font-mono text-indigo-950">${totalInventoryCost.toFixed(2)}</strong>
            </div>
            <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-150 text-center">
              <span className="text-[10px] font-mono text-amber-800 font-semibold block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.af105afcb5")}</span>
              <strong className={`text-xl font-mono ${lowStockCount > 0 ? 'text-amber-700 animate-pulse' : 'text-bark-800'}`}>
                {lowStockCount} Rolls
              </strong>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10.5px] pt-1">
            <span className="text-bark-600">{pfUiT("ui.components.subcomponents.professionaldashboard.4fb5cb0e38")}</span>
            <span className="font-mono font-bold text-bark-850 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-bark-400" />
              {totalYards.toFixed(1)} Yards
            </span>
          </div>
        </div>

        {/* PILLAR 3: WORKSHOP LABOR PRODUCTIVITY */}
        <div className="bg-white p-6 rounded-2xl border border-sand-200 shadow-ux space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.subcomponents.professionaldashboard.e2b143856d")}</span>
              <h3 className="text-xl font-serif font-light text-bark-900">{pfUiT("ui.components.subcomponents.professionaldashboard.d892fb44c7")}</h3>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-150 rounded-xl text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <div className="bg-amber-50/20 p-3 rounded-xl border border-amber-100 text-center">
              <span className="text-[10px] font-mono text-amber-900 block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.8dbbea4930")}</span>
              <strong className="text-2xl font-serif text-bark-900">{totalHoursSewed}h</strong>
            </div>
            <div className="bg-sand-50/50 p-3 rounded-xl border border-sand-150/60 text-center">
              <span className="text-[10px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.8293f3d2bc")}</span>
              <strong className="text-2xl font-serif text-bark-900">{avgSessionMins}m</strong>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10.5px] pt-1">
            <span className="text-bark-600">{pfUiT("ui.components.subcomponents.professionaldashboard.27219f63dc")}</span>
            <span className="font-mono font-bold text-bark-850 bg-sand-100/60 px-2 py-0.5 rounded border border-sand-200">
              {timeLogs.length} Sessions
            </span>
          </div>
        </div>

      </div>

      {/* DETAILS BREAKDOWN SEGMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN (COL-SPAN-7): ACTIVE COMMISSIONS + LEDGER REALTIME MODIFICATIONS */}
        <div className="lg:col-span-7 space-y-8">

          {/* COMMISSION FLOW */}
          <div className="bg-white border border-sand-200 rounded-2xl shadow-ux overflow-hidden">
            <div className="p-5 border-b border-sand-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sand-50/10">
              <div className="space-y-0.5">
                <h4 className="text-sm font-serif font-semibold text-bark-950">{pfUiT("ui.components.subcomponents.professionaldashboard.2f946e212e")}</h4>
                <p className="text-[11px] text-bark-500 font-sans">{pfUiT("ui.components.subcomponents.professionaldashboard.a6d8ff4ec0")}</p>
              </div>

              <div className="flex items-center gap-1.5 border border-sand-250 bg-white px-2 py-1 rounded-lg text-xs">
                <button
                  onClick={() => setActiveProjectTab('all')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase cursor-pointer transition-all ${
                    activeProjectTab === 'all' ? 'bg-stone-900 text-white shadow-3xs' : 'text-bark-600 hover:text-bark-900'
                  }`}
                >{pfUiT("ui.components.subcomponents.professionaldashboard.667e82fd8e")}</button>
                <button
                  onClick={() => setActiveProjectTab('active')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase cursor-pointer transition-all ${
                    activeProjectTab === 'active' ? 'bg-stone-900 text-white shadow-3xs' : 'text-bark-600 hover:text-bark-900'
                  }`}
                >{pfUiT("ui.components.subcomponents.professionaldashboard.7abd2b1e49")}</button>
                <button
                  onClick={() => setActiveProjectTab('completed')}
                  className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold uppercase cursor-pointer transition-all ${
                    activeProjectTab === 'completed' ? 'bg-stone-900 text-white shadow-3xs' : 'text-bark-600 hover:text-bark-900'
                  }`}
                >{pfUiT("ui.components.subcomponents.professionaldashboard.91c4ee2703")}</button>
              </div>
            </div>

            <div className="divide-y divide-sand-100 p-2.5">
              {projects
                .filter(p => {
                  if (activeProjectTab === 'active') return p.progress < 100 && p.status !== 'Completed';
                  if (activeProjectTab === 'completed') return p.progress === 100 || p.status === 'Completed';
                  return true;
                })
                .map(proj => {
                  const isSelected = selectedProjectForDetail?.id === proj.id;
                  return (
                    <div
                      key={proj.id}
                      className={`p-3.5 rounded-xl transition-all cursor-pointer ${
                        isSelected ? 'bg-clay-50/40 border border-clay-200/50 shadow-4xs' : 'hover:bg-sand-50/30'
                      }`}
                      onClick={() => setSelectedProjectForDetail(isSelected ? null : proj)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-bark-900">{proj.name}</h5>
                            <span className="text-[8px] font-mono text-bark-450 bg-sand-100 border border-sand-200 px-1.5 py-0.2 rounded uppercase">
                              {proj.id}
                            </span>
                          </div>
                          <p className="text-[10px] text-bark-500 font-mono italic">
                            Template: {proj.patternName}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right space-y-0.5">
                            <span className="text-[10px] font-mono text-bark-500">{pfUiT("ui.components.subcomponents.professionaldashboard.6ce60f4dca")}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-sand-200 rounded-full overflow-hidden">
                                <div className="h-full bg-clay-605 rounded-full" style={{ width: `${proj.progress}%` }} />
                              </div>
                              <span className="text-[10.5px] font-mono font-bold text-bark-800">{proj.progress}%</span>
                            </div>
                          </div>

                          <ChevronRight className={`w-4 h-4 text-bark-400 transition-transform ${isSelected ? 'rotate-90 text-clay-600' : ''}`} />
                        </div>
                      </div>

                      {/* Detail Expansion: Checklist audit */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mt-3.5 pt-3.5 border-t border-sand-150 space-y-2.5"
                          >
                            <span className="text-[9px] font-mono uppercase font-bold text-clay-700 block">
                              Workshop Tasks Check-off List ({proj.tasks?.length || 0} steps)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                              {proj.tasks && proj.tasks.map(task => (
                                <div
                                  key={task.id}
                                  className={`p-2 rounded border flex items-center gap-2 ${
                                    task.completed ? 'bg-stone-50/60 border-sand-150 text-bark-450 line-through' : 'bg-white border-sand-200 text-bark-800'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Let partner toggle task directly from dashboard to simulate collaboration
                                    const updatedTasks = proj.tasks.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t);
                                    const compCount = updatedTasks.filter(t => t.completed).length;
                                    const nextProgress = Math.round((compCount / updatedTasks.length) * 100);
                                    const updatedProjList = projects.map(p => p.id === proj.id ? {
                                      ...p,
                                      tasks: updatedTasks,
                                      progress: nextProgress,
                                      status: nextProgress === 100 ? 'Completed' : nextProgress > 0 ? 'In Progress' : 'Planning'
                                    } : p);
                                    syncProjects(updatedProjList);
                                    setSelectedProjectForDetail(updatedProjList.find(p => p.id === proj.id));
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={task.completed}
                                    readOnly
                                    className="rounded border-sand-300 text-clay-605"
                                  />
                                  <span className="truncate">{task.text}</span>
                                </div>
                              ))}
                            </div>
                            <div className="text-[9.5px] text-bark-550 flex items-center gap-1 italic">
                              <Sparkles className="w-3 h-3 text-clay-500" />
                              <span>{pfUiT("ui.components.subcomponents.professionaldashboard.6e1b549b31")}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

              {projects.length === 0 && (
                <div className="p-8 text-center text-bark-500 text-xs">{pfUiT("ui.components.subcomponents.professionaldashboard.f63327a2ae")}</div>
              )}
            </div>
          </div>

          {/* CAPITAL LEDGER INTERACTION CONTAINER */}
          <div className="bg-white border border-sand-200 rounded-2xl shadow-ux p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-sand-150">
              <div className="space-y-0.5">
                <h4 className="text-sm font-serif font-semibold text-bark-950">{pfUiT("ui.components.subcomponents.professionaldashboard.80a0e85cb5")}</h4>
                <p className="text-[11px] text-bark-500">{pfUiT("ui.components.subcomponents.professionaldashboard.a722737761")}</p>
              </div>

              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-bark-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={pfUiT("ui.components.subcomponents.professionaldashboard.aab12a0a8e")}
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-sand-50/50 border border-sand-250 rounded-lg text-[11.5px] focus:ring-1 focus:ring-clay-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventory
                .filter(item => item.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                .map(item => {
                  const estValue = (item.stock * item.cost).toFixed(2);
                  return (
                    <div key={item.id} className="p-4 bg-sand-50/40 border border-sand-200 rounded-xl space-y-3 shadow-4xs">
                      <div className="flex justify-between items-start">
                        <div className="space-y-0.5">
                          <strong className="text-xs text-bark-900 block font-bold">{item.name}</strong>
                          <span className="text-[10px] text-bark-450 block font-mono">Roll Ref: {item.color}</span>
                        </div>
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                          item.status === 'In Stock' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' : 'bg-amber-50 text-amber-700 border border-amber-250'
                        }`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono py-1.5 bg-white px-2.5 border border-sand-150 rounded-lg">
                        <div>
                          <span className="text-bark-400 block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.70c38538eb")}</span>
                          <strong className="text-xs text-bark-900 font-bold">{item.stock} Yds</strong>
                        </div>
                        <div>
                          <span className="text-bark-400 block uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.b2f1c6c439")}</span>
                          <strong className="text-xs text-clay-700 font-bold">${estValue}</strong>
                        </div>
                      </div>

                      {/* Stock quick-adjusters */}
                      <div className="flex items-center justify-between gap-2.5 pt-1 border-t border-sand-150/60">
                        <span className="text-[10.5px] text-bark-550 italic font-sans">
                          Price: ${item.cost.toFixed(2)}/yd
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => adjustInventoryStock(item.id, -2)}
                            className="bg-white hover:bg-sand-100 text-bark-750 text-[10px] font-mono font-bold px-2 py-1 rounded border border-sand-250 cursor-pointer shadow-4xs"
                            title={pfUiT("ui.components.subcomponents.professionaldashboard.4d55fad6ca")}
                          >{pfUiT("ui.components.subcomponents.professionaldashboard.540e18940a")}</button>
                          <button
                            onClick={() => adjustInventoryStock(item.id, 2)}
                            className="bg-stone-900 hover:bg-stone-850 text-white text-[10px] font-mono font-bold px-2 py-1 rounded cursor-pointer shadow-4xs"
                            title={pfUiT("ui.components.subcomponents.professionaldashboard.4838a762bb")}
                          >{pfUiT("ui.components.subcomponents.professionaldashboard.6a0a19e1ef")}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (COL-SPAN-5): TIMELOG HISTORY & EFFICIENCY GRAPH */}
        <div className="lg:col-span-5 space-y-8">

          {/* PENDING ACCESS REQUESTS SECTION */}
          <div className="bg-white border border-sand-200 rounded-2xl shadow-ux p-5 space-y-4 animate-fadeIn" id="admin-access-requests-panel">
            <div className="flex justify-between items-center pb-2 border-b border-sand-150">
              <div className="space-y-0.5">
                <h4 className="text-sm font-serif font-semibold text-bark-950">{pfUiT("ui.components.subcomponents.professionaldashboard.1669f87a72")}</h4>
                <p className="text-[11px] text-bark-500 font-sans">{pfUiT("ui.components.subcomponents.professionaldashboard.44e6a47a0a")}</p>
              </div>
              <span className="text-[9px] font-mono bg-indigo-50 text-indigo-800 border border-indigo-250 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                <Shield className="w-3 h-3 text-indigo-600" />{pfUiT("ui.components.subcomponents.professionaldashboard.4d85893bf6")}</span>
            </div>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {accessRequests.map(req => {
                const dateStr = new Date(req.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={req.id} className="p-3.5 bg-sand-50/40 border border-sand-200 rounded-xl space-y-3 relative transition-all group hover:border-sand-300">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${req.status === 'pending' ? 'bg-amber-400' : req.status === 'Approved' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <strong className="text-xs text-bark-900 font-bold">{req.name}</strong>
                        </div>
                        <span className="text-[10px] font-mono text-bark-550 block">
                          Email: {req.email}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase border ${
                        req.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        req.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-250' :
                        'bg-rose-50 text-rose-700 border-rose-250'
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-sand-150 rounded-lg space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-sand-100 pb-1">
                        <span className="text-bark-450 uppercase font-bold">{pfUiT("ui.components.subcomponents.professionaldashboard.1ded64dae4")}</span>
                        <strong className="text-indigo-900 font-bold uppercase">{req.requestedRole}</strong>
                      </div>
                      <p className="text-[10.5px] text-bark-600 leading-relaxed font-sans italic">
                        "{req.justification}"
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-mono text-bark-400">
                      <span>Submitted: {dateStr}</span>

                      {req.status === 'pending' && (
                        <div className="flex gap-1.5 relative z-10">
                          <button
                            onClick={() => handleProcessRequest(req.id, 'reject')}
                            className="bg-white hover:bg-rose-50 text-rose-600 text-[10px] font-mono font-bold px-2 py-1 rounded border border-rose-200 cursor-pointer shadow-4xs transition-all"
                          >{pfUiT("ui.components.subcomponents.professionaldashboard.168c07d96b")}</button>
                          <button
                            onClick={() => handleProcessRequest(req.id, 'approve')}
                            className="bg-stone-900 hover:bg-stone-850 text-white text-[10px] font-mono font-bold px-2 py-1 rounded cursor-pointer shadow-4xs transition-all"
                          >{pfUiT("ui.components.subcomponents.professionaldashboard.16f6381293")}</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {accessRequests.length === 0 && (
                <div className="text-center p-8 bg-sand-50/20 border border-dashed border-sand-250 rounded-xl text-bark-500 text-xs flex flex-col items-center justify-center gap-1.5">
                  <Shield className="w-5 h-5 text-bark-300" />
                  <span>{pfUiT("ui.components.subcomponents.professionaldashboard.cb79cf002d")}</span>
                </div>
              )}
            </div>
          </div>

          {/* PRODUCTIVITY DURATION LOGS */}
          <div className="bg-white border border-sand-200 rounded-2xl shadow-ux p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-sand-150">
              <div className="space-y-0.5">
                <h4 className="text-sm font-serif font-semibold text-bark-950">{pfUiT("ui.components.subcomponents.professionaldashboard.b975501ac7")}</h4>
                <p className="text-[11px] text-bark-500 font-sans">{pfUiT("ui.components.subcomponents.professionaldashboard.4b5138866d")}</p>
              </div>
              <span className="text-[9px] font-mono bg-amber-50 text-amber-800 border border-amber-250 px-2 py-0.5 rounded font-bold uppercase">{pfUiT("ui.components.subcomponents.professionaldashboard.a99c15aa8c")}</span>
            </div>

            {/* Time efficiency simple vector graph */}
            <div className="p-4 bg-stone-950 rounded-xl border border-stone-850 space-y-2 relative overflow-hidden shadow-ux">
              <div className="flex justify-between items-center relative z-10 text-sand-100/90 text-[10.5px]">
                <span className="font-mono uppercase font-bold text-[9px] tracking-wider text-clay-400">{pfUiT("ui.components.subcomponents.professionaldashboard.1ff1154fd7")}</span>
                <span className="text-[10px] font-mono">{pfUiT("ui.components.subcomponents.professionaldashboard.c441cd8250")}</span>
              </div>

              <div className="h-20 flex items-end justify-between gap-1.5 pt-4 border-b border-stone-800 relative z-10">
                {timeLogs.slice().reverse().map((log, index) => {
                  const durationMins = Math.round((log.durationSeconds || 0) / 60);
                  const maxVal = Math.max(...timeLogs.map(l => l.durationSeconds / 60), 60);
                  const percentage = Math.max(8, Math.min(100, (durationMins / maxVal) * 100));
                  return (
                    <div key={log.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full bg-clay-500/20 group-hover:bg-clay-500/40 rounded-t-xs h-full absolute bottom-0 left-0 transition-all"></div>
                      <div
                        className="w-full bg-clay-505 group-hover:bg-amber-500 rounded-t-xs transition-all relative z-10"
                        style={{ height: `${percentage}%` }}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-stone-900 border border-stone-800 text-white text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                          {durationMins}m on {log.patternName.split(' ')[0]}
                        </div>
                      </div>
                      <span className="text-[8px] font-mono text-stone-500 relative z-10">S{index + 1}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[9px] font-mono text-stone-500 relative z-10">
                <span>{pfUiT("ui.components.subcomponents.professionaldashboard.900d2b0c29")}</span>
                <span>{pfUiT("ui.components.subcomponents.professionaldashboard.67e464e4fc")}</span>
              </div>
            </div>

            {/* Timelog checklist list */}
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {timeLogs.map(log => {
                const durationMins = Math.round((log.durationSeconds || 0) / 60);
                const readableDate = new Date(log.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div key={log.id} className="p-3 bg-[#FAF8F5] border border-sand-200 hover:border-sand-300 rounded-xl flex justify-between gap-3 relative transition-all group">
                    <div className="space-y-1 max-w-[80%]">
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-clay-605" />
                        <strong className="text-xs text-bark-900 font-bold leading-none">{log.patternName}</strong>
                      </div>
                      <span className="text-[10px] font-mono text-bark-550 block">
                        Op: {log.stepName}
                      </span>
                      {log.notes && (
                        <p className="text-[10.5px] font-sans text-bark-500 leading-relaxed italic border-l-2 border-sand-300 pl-2">
                          {log.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col justify-between items-end text-right shrink-0">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-mono text-clay-700 font-bold block">{durationMins} min</span>
                        <span className="text-[9px] font-mono text-bark-400 block">{readableDate}</span>
                      </div>

                      <button
                        onClick={() => deleteTimeLog(log.id)}
                        className="p-1 text-bark-300 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title={pfUiT("ui.components.subcomponents.professionaldashboard.71844e8bd7")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {timeLogs.length === 0 && (
                <div className="text-center p-6 text-bark-500 text-xs">{pfUiT("ui.components.subcomponents.professionaldashboard.f953be43e7")}</div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MANUAL LOG MODAL POPUP */}
      {showLogModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
          id="manual-timelog-modal"
        >
          <div
            className="fixed inset-0 bg-stone-900/55 backdrop-blur-xs"
            onClick={() => setShowLogModal(false)}
          />

          <div
            className="relative bg-white border border-sand-250 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-fadeIn"
            style={{ zIndex: UI_LAYERS.modal }}
          >
            <div className="space-y-1">
              <span className="text-[9px] font-mono uppercase tracking-widest text-clay-700 font-bold block">{pfUiT("ui.components.subcomponents.professionaldashboard.9e4c70443a")}</span>
              <h3 className="text-lg font-serif text-bark-950">{pfUiT("ui.components.subcomponents.professionaldashboard.ff3df72e75")}</h3>
              <p className="text-xs text-bark-550">{pfUiT("ui.components.subcomponents.professionaldashboard.801e9eab86")}</p>
            </div>

            <form onSubmit={handleAddManualLog} className="space-y-4 pt-1 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.professionaldashboard.6d44e92f79")}</label>
                <input
                  type="text"
                  value={logPatternName}
                  onChange={(e) => setLogPatternName(e.target.value)}
                  placeholder={pfUiT("ui.components.subcomponents.professionaldashboard.10f8e77b14")}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.professionaldashboard.a2b9e7fc28")}</label>
                  <input
                    type="text"
                    value={logStepName}
                    onChange={(e) => setLogStepName(e.target.value)}
                    placeholder={pfUiT("ui.components.subcomponents.professionaldashboard.18deb2b242")}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-bark-600 block">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="480"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(e.target.value)}
                    className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-bark-600 block">{pfUiT("ui.components.subcomponents.professionaldashboard.c7fcb55dd0")}</label>
                <textarea
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder={pfUiT("ui.components.subcomponents.professionaldashboard.59a69f512e")}
                  rows={3}
                  className="w-full px-3 py-2 bg-sand-50 border border-sand-250 rounded-lg focus:ring-1 focus:ring-clay-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 bg-sand-100 hover:bg-sand-150 text-bark-800 font-mono font-bold uppercase tracking-wider py-2.5 rounded-xl border border-sand-200 cursor-pointer"
                >{pfUiT("ui.components.subcomponents.professionaldashboard.a9fcb93c1c")}</button>
                <button
                  type="submit"
                  className="flex-1 bg-stone-900 hover:bg-stone-850 text-white font-mono font-bold uppercase tracking-wider py-2.5 rounded-xl cursor-pointer"
                >{pfUiT("ui.components.subcomponents.professionaldashboard.487e0805fe")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN-ONLY PERMISSIONS GUIDE MATRIX MODAL */}
      <PermissionsGuideModal
        isOpen={showPermissionsGuide}
        onClose={() => setShowPermissionsGuide(false)}
        currentRole={role}
        onResetRules={handleResetRules}
      />

    </div>
  );
}
