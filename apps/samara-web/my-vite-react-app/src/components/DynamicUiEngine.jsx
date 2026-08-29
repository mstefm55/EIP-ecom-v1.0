import { localizeMetadataTree } from '../lib/localizedMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import { clientPreferences } from '../lib/clientPreferences';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DynamicUiEngine - A metadata-driven UI renderer and administrator controller
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Settings, LayoutGrid, Eye, Sliders, Lock, Unlock,
  FileCode, Sparkles, Check, Play, Edit, Trash2, Plus,
  RefreshCw, Info, UserCheck, AlertTriangle, HelpCircle,
  FolderPlus, Save, Layout, Type, Image as ImageIcon, CheckSquare, BarChart
} from 'lucide-react';

// Default metadata stored in DB (represented as localStorage database)
export default function DynamicUiEngine({ currentUser, onForceLoginTrigger, isAdminWorkspace = false }) {
  const DEFAULT_UI_METADATA = localizeMetadataTree(perfectFitMetadata.componentUi.dynamicUiEngine.defaultUiMetadata, 'component.dynamicUiEngine.defaultUiMetadata', pfUiT);

  // Database State - 100% driven by JSON metadata
  const [metadata, setMetadata] = useState(() => {
    try {
      const saved = clientPreferences.getItem('sartorial_ui_metadata');
      // If cached data exists but lacks our new demo conditional sections, overwrite/merge or reset
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.profile && parsed.profile.sections && parsed.profile.sections.some(s => s.visibilityRule)) {
          return parsed;
        }
      }
      return DEFAULT_UI_METADATA;
    } catch {
      return DEFAULT_UI_METADATA;
    }
  });

  // Simulated role for testing conditional visibility rules: 'all', 'guest', 'buyer' (casual visitor), 'collaborator' (professional partner), 'administrator'
  const [simulatedRole, setSimulatedRole] = useState(() => {
    return currentUser ? currentUser.role : 'guest';
  });

  // Render Layout Mode: 'low-end-visual' (Visual Strike) or 'pro-detailed' (Professional looking)
  const [renderMode, setRenderMode] = useState(() => {
    return clientPreferences.getItem('sartorial_ui_render_mode') || 'pro-detailed';
  });

  // Login dependency setting toggled by Administrator
  const [isLoginDependent, setIsLoginDependent] = useState(() => {
    return clientPreferences.getItem('sartorial_ui_login_dependent') === 'true';
  });

  // Admin section view: 'preview' or 'raw-editor' or 'form-builder'
  const [adminTab, setAdminTab] = useState('preview');
  const [rawJsonText, setRawJsonText] = useState('');
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

  // Custom allowed roles checkboxes for the form
  const [formAllowedGuests, setFormAllowedGuests] = useState(true);
  const [formAllowedBuyers, setFormAllowedBuyers] = useState(true);
  const [formAllowedCollaborators, setFormAllowedCollaborators] = useState(true);
  const [formAllowedAdmins, setFormAllowedAdmins] = useState(true);

  // Sync simulated role if current user changes
  useEffect(() => {
    if (currentUser) {
      setSimulatedRole(currentUser.role);
    } else {
      setSimulatedRole('guest');
    }
  }, [currentUser]);

  // Synchronize layout mode to localStorage
  useEffect(() => {
    clientPreferences.setItem('sartorial_ui_render_mode', renderMode);
  }, [renderMode]);

  // Synchronize login dependent state
  useEffect(() => {
    clientPreferences.setItem('sartorial_ui_login_dependent', String(isLoginDependent));
    // Trigger global parent check if active
    if (onForceLoginTrigger) {
      onForceLoginTrigger(isLoginDependent);
    }
  }, [isLoginDependent, onForceLoginTrigger]);

  // Sync metadata change to localStorage
  useEffect(() => {
    try {
      clientPreferences.setItem('sartorial_ui_metadata', JSON.stringify(metadata));
    } catch (e) {
      console.error("Failed to write layout metadata to local state", e);
    }
  }, [metadata]);

  // Load JSON text on tab shift
  useEffect(() => {
    setRawJsonText(JSON.stringify(metadata, null, 2));
    setJsonError(null);
  }, [metadata, adminTab]);

  const handleSaveRawJson = () => {
    try {
      const parsed = JSON.parse(rawJsonText);
      if (!parsed.profile || !Array.isArray(parsed.profile.sections)) {
        throw new Error("Metadata must contain a 'profile' object with a 'sections' array.");
      }
      setMetadata(parsed);
      setJsonError(null);
      if (window.showToast) {
        window.showToast("Atelier UI Metadata successfully synchronized!", "profile", "DB Synced");
      } else {
        alert("Atelier UI Metadata successfully synchronized!");
      }
      setAdminTab('preview');
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm("Are you sure you want to revert all UI database configuration metadata back to standard defaults?")) {
      setMetadata(DEFAULT_UI_METADATA);
      setRawJsonText(JSON.stringify(DEFAULT_UI_METADATA, null, 2));
      setJsonError(null);
      if (window.showToast) {
        window.showToast("UI engine database restored to original state.", "profile", "DB Restored");
      }
    }
  };

  // Metadata Mutation Helpers
  const handleDeleteSection = (id) => {
    if (window.confirm("Remove this layout block from metadata database?")) {
      const updatedSections = metadata.profile.sections.filter(s => s.id !== id);
      setMetadata({
        ...metadata,
        profile: { ...metadata.profile, sections: updatedSections }
      });
      if (window.showToast) {
        window.showToast("Block removed from layout metadata.", "profile", "Block Deleted");
      }
    }
  };

  const handleOpenEditSection = (sec) => {
    setEditSectionId(sec.id);
    setFormSecType(sec.type);
    setFormSecTitle(sec.title || sec.heading || '');
    setFormSecSubtitle(sec.subtitle || '');
    setFormSecContent(sec.content || sec.details || '');
    setFormSecImage(sec.image || '');
    setFormSecBadge(sec.badge || '');

    // Read current visibility rule if any
    const allowed = sec.visibilityRule?.allowedRoles || ["guest", "buyer", "collaborator", "administrator"];
    setFormAllowedGuests(allowed.includes('guest'));
    setFormAllowedBuyers(allowed.includes('buyer'));
    setFormAllowedCollaborators(allowed.includes('collaborator'));
    setFormAllowedAdmins(allowed.includes('administrator'));

    setShowSectionForm(true);
  };

  const handleSaveSectionForm = (e) => {
    e.preventDefault();
    let updatedSections = [...metadata.profile.sections];

    // Build visibility rule
    const allowedRoles = [];
    if (formAllowedGuests) allowedRoles.push('guest');
    if (formAllowedBuyers) allowedRoles.push('buyer');
    if (formAllowedCollaborators) allowedRoles.push('collaborator');
    if (formAllowedAdmins) allowedRoles.push('administrator');

    const desc = allowedRoles.length === 4
      ? "Visible to all visitors"
      : allowedRoles.includes('collaborator') && allowedRoles.length <= 2
      ? "Professional Partners Only"
      : allowedRoles.includes('buyer') && allowedRoles.length <= 2
      ? "Casual Visitors Only"
      : `Restricted: [${allowedRoles.join(', ')}]`;

    const sectionData = {
      id: editSectionId || `sec-${Date.now()}`,
      type: formSecType,
      visibilityRule: {
        allowedRoles,
        description: desc
      }
    };

    // Populate according to types
    if (formSecType === 'hero-header') {
      sectionData.title = formSecTitle;
      sectionData.subtitle = formSecSubtitle;
      sectionData.image = formSecImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80';
      sectionData.badge = formSecBadge;
      sectionData.details = formSecContent;
    } else if (formSecType === 'text-block') {
      sectionData.heading = formSecTitle;
      sectionData.content = formSecContent;
      sectionData.callout = formSecSubtitle;
    } else if (formSecType === 'stats-grid') {
      sectionData.heading = formSecTitle;
      sectionData.subtitle = formSecSubtitle;
      sectionData.stats = [
        { label: "Community", value: "14,800+", detail: "Makers sewing active pieces" },
        { label: "Sewn Rate", value: "98%", detail: "Zero-waste efficiency index" },
        { label: "Satisfaction", value: "4.9/5", detail: "Rating from real couturiers" }
      ];
    } else if (formSecType === 'checklists') {
      sectionData.heading = formSecTitle;
      sectionData.subtitle = formSecSubtitle;
      sectionData.items = formSecContent.split('\n').filter(i => i.trim() !== '');
    } else if (formSecType === 'showcase-cards') {
      sectionData.heading = formSecTitle;
      sectionData.subtitle = formSecSubtitle;
      sectionData.items = [
        {
          title: "Aurelia Wrap Dress",
          subtitle: "Belgian washed linen favorite",
          image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=400&q=80",
          badge: "INTERMEDIATE"
        },
        {
          title: "Atelier Utility Trench",
          subtitle: "Structured cotton gabardine outerwear",
          image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=400&q=80",
          badge: "ADVANCED"
        }
      ];
    }

    if (editSectionId) {
      updatedSections = updatedSections.map(s => s.id === editSectionId ? sectionData : s);
    } else {
      updatedSections.push(sectionData);
    }

    setMetadata({
      ...metadata,
      profile: { ...metadata.profile, sections: updatedSections }
    });

    setShowSectionForm(false);
    setEditSectionId(null);
    setFormSecTitle('');
    setFormSecSubtitle('');
    setFormSecContent('');
    setFormSecImage('');
    setFormSecBadge('');

    if (window.showToast) {
      window.showToast("Layout database block saved successfully!", "profile", "Block Written");
    }
  };

  const isUserAdmin = isAdminWorkspace && currentUser && currentUser.role === 'administrator';
  const activeRole = isAdminWorkspace ? simulatedRole : (currentUser ? currentUser.role : 'guest');

  return (
    <div className={isAdminWorkspace ? "bg-[#FAF8F5] border border-sand-250 rounded-[4px] shadow-lux overflow-hidden" : ""} id="dynamic-ui-engine-root">
      {/* Dynamic engine header banner */}
      {isAdminWorkspace && (
        <div className="bg-bark-900 px-6 py-5 text-sand-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-sand-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-clay-605 text-[9px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">{pfUiT("ui.components.dynamicuiengine.9da9bdf6e3")}</span>
              <span className="text-[10px] text-sand-300 font-mono">{pfUiT("ui.components.dynamicuiengine.85230ddb64")}</span>
            </div>
            <h4 className="text-xl font-serif text-white font-medium tracking-wide mt-1.5 flex items-center gap-2">
              <Database className="w-5 h-5 text-clay-400" /> Dynamic Layout Hub &amp; Profile rendering
            </h4>
            <p className="text-[11px] text-sand-300/80 mt-1 max-w-xl">{pfUiT("ui.components.dynamicuiengine.de570db3fd")}</p>
          </div>

          {/* Global toggles bar for everyone (with admin controls highlighted) */}
          <div className="flex flex-wrap items-center gap-2 select-none">
            {/* Layout Render Mode switcher */}
            <div className="bg-black/15 p-1 rounded-xl border border-white/10 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRenderMode('low-end-visual')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  renderMode === 'low-end-visual'
                    ? 'bg-clay-650 text-white shadow-sm'
                    : 'text-sand-300 hover:text-white'
                }`}
                title={pfUiT("ui.components.dynamicuiengine.e834d383fd")}
              >
                <Layout className="w-3 h-3" />
                <span>Visual Strike (Low End Users)</span>
              </button>
              <button
                type="button"
                onClick={() => setRenderMode('pro-detailed')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  renderMode === 'pro-detailed'
                    ? 'bg-clay-650 text-white shadow-sm'
                    : 'text-sand-300 hover:text-white'
                }`}
                title={pfUiT("ui.components.dynamicuiengine.87d1a3f4ff")}
              >
                <Sliders className="w-3 h-3" />
                <span>{pfUiT("ui.components.dynamicuiengine.3b3eabe0f4")}</span>
              </button>
            </div>

            {/* Quick info if not admin */}
            {!isUserAdmin && (
              <div className="text-[9px] font-mono text-sand-400 px-2 py-1 bg-white/5 border border-white/5 rounded-lg">{pfUiT("ui.components.dynamicuiengine.86dc14f007")}<b>{currentUser ? currentUser.role : 'Guest'}</b>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Administrator Control Panel overlay (rendered if user is Administrator) */}
      {isUserAdmin && (
        <div className="bg-clay-50/50 border-b border-clay-150 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h5 className="text-xs font-bold text-clay-800 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-clay-605 animate-spin-slow" />{pfUiT("ui.components.dynamicuiengine.54a47af7f0")}</h5>
              <p className="text-[10px] text-bark-500 mt-0.5">{pfUiT("ui.components.dynamicuiengine.fef884f0cb")}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Login Dependency Control Toggle */}
              <button
                onClick={() => setIsLoginDependent(!isLoginDependent)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-3xs border ${
                  isLoginDependent
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {isLoginDependent ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>Requirement: {isLoginDependent ? 'Strict Login Gated' : 'Public Access Allowed'}</span>
              </button>

              <button
                onClick={handleResetDefaults}
                className="bg-white hover:bg-sand-100 text-bark-800 border border-sand-300 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                title={pfUiT("ui.components.dynamicuiengine.8ebfacec39")}
              >
                <RefreshCw className="w-3 h-3" />
                <span>{pfUiT("ui.components.dynamicuiengine.5f9ac879b4")}</span>
              </button>
            </div>
          </div>

          {/* Sub tabs inside administrator panel */}
          <div className="flex items-center gap-2 border-b border-sand-200 pb-2 select-none">
            <button
              onClick={() => setAdminTab('preview')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                adminTab === 'preview' ? 'text-clay-700 border-b-2 border-clay-600 pb-2' : 'text-bark-450 hover:text-bark-900'
              }`}
            >{pfUiT("ui.components.dynamicuiengine.ba32d95711")}</button>
            <button
              onClick={() => setAdminTab('raw-editor')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                adminTab === 'raw-editor' ? 'text-clay-700 border-b-2 border-clay-600 pb-2' : 'text-bark-450 hover:text-bark-900'
              }`}
            >{pfUiT("ui.components.dynamicuiengine.7e173c21f2")}</button>
          </div>

          {/* Admin Tab content: Raw Editor */}
          {adminTab === 'raw-editor' && (
            <div className="space-y-3" id="admin-raw-json-editor">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-bark-450 uppercase font-bold block">
                  ✦ Direct Metadata Mutation Field (100% database layout)
                </span>
                <span className="text-[9px] text-bark-400 font-mono">{pfUiT("ui.components.dynamicuiengine.cb9d69bfea")}</span>
              </div>
              <textarea
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                rows={12}
                className="w-full font-mono text-[11px] p-4 bg-bark-950 text-emerald-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-clay-500 leading-relaxed shadow-inner border border-bark-900"
                placeholder={pfUiT("ui.components.dynamicuiengine.f2a40ed7ad")}
              />
              {jsonError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-600 font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Metadata Error: {jsonError}</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveRawJson}
                  className="bg-clay-650 hover:bg-clay-600 text-white text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />{pfUiT("ui.components.dynamicuiengine.f4102d1b01")}</button>
              </div>
            </div>
          )}

          {/* Admin Tab content: Live Nodes / Block Manager */}
          {adminTab === 'preview' && (
            <div className="space-y-3" id="admin-layout-node-manager">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-bark-450 uppercase font-bold block">{pfUiT("ui.components.dynamicuiengine.408039be88")}</span>
                <button
                  onClick={() => {
                    setEditSectionId(null);
                    setFormSecType('text-block');
                    setFormSecTitle('New Custom Segment');
                    setFormSecSubtitle('Custom Callout Subtitle');
                    setFormSecContent('Enter content segments for the dynamic layout here.');
                    setShowSectionForm(true);
                  }}
                  className="bg-clay-605 hover:bg-clay-550 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />{pfUiT("ui.components.dynamicuiengine.0cdde1876e")}</button>
              </div>

              {showSectionForm && (
                <form onSubmit={handleSaveSectionForm} className="bg-white border border-sand-250 p-4 rounded-[4px] space-y-3">
                  <h6 className="text-xs font-bold text-bark-900 uppercase">
                    {editSectionId ? 'Edit Layout Segment' : 'Insert Layout Segment'}
                  </h6>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.dynamicuiengine.127b7264fd")}</label>
                      <select
                        value={formSecType}
                        onChange={(e) => setFormSecType(e.target.value)}
                        className="border border-sand-250 text-xs rounded-lg px-2.5 py-1.5 w-full bg-white focus:outline-none"
                      >
                        <option value="hero-header">hero-header (Large Title &amp; Portrait Banner)</option>
                        <option value="text-block">text-block (Narrative/Biographical segments)</option>
                        <option value="stats-grid">stats-grid (Metrics &amp; Stats panel)</option>
                        <option value="showcase-cards">showcase-cards (Visual Portfolio Spotlight)</option>
                        <option value="checklists">checklists (Standards checklist list)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.dynamicuiengine.756c624880")}</label>
                      <input
                        type="text"
                        value={formSecTitle}
                        onChange={(e) => setFormSecTitle(e.target.value)}
                        className="border border-sand-250 text-xs rounded-lg px-2.5 py-1.5 w-full focus:outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.dynamicuiengine.2edc720e5e")}</label>
                      <input
                        type="text"
                        value={formSecSubtitle}
                        onChange={(e) => setFormSecSubtitle(e.target.value)}
                        className="border border-sand-250 text-xs rounded-lg px-2.5 py-1.5 w-full focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-bark-450 block uppercase">
                      Core Content Description {formSecType === 'checklists' && '(One item per line)'}
                    </label>
                    <textarea
                      rows={3}
                      value={formSecContent}
                      onChange={(e) => setFormSecContent(e.target.value)}
                      className="border border-sand-250 text-xs rounded-lg px-2.5 py-1.5 w-full focus:outline-none"
                    />
                  </div>

                  {formSecType === 'hero-header' && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.dynamicuiengine.9ad7cbd5d3")}</label>
                      <input
                        type="text"
                        value={formSecImage}
                        onChange={(e) => setFormSecImage(e.target.value)}
                        placeholder="https://images.unsplash.com/photo-..."
                        className="border border-sand-250 text-xs rounded-lg px-2.5 py-1.5 w-full focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Dynamic Conditional Visibility Rules Configuration */}
                  <div className="p-3 bg-clay-50/55 border border-clay-150 rounded-lg space-y-2">
                    <span className="text-[9.5px] font-mono text-clay-800 uppercase font-bold block">
                      ✦ Conditional Visibility Rules (Data-driven Role Gate)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-bark-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formAllowedGuests}
                          onChange={(e) => setFormAllowedGuests(e.target.checked)}
                          className="rounded border-sand-300 text-clay-605 focus:ring-clay-500"
                        />
                        <span>{pfUiT("ui.components.dynamicuiengine.b067c3592c")}</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-bark-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formAllowedBuyers}
                          onChange={(e) => setFormAllowedBuyers(e.target.checked)}
                          className="rounded border-sand-300 text-clay-605 focus:ring-clay-500"
                        />
                        <span>{pfUiT("ui.components.dynamicuiengine.2936d67359")}</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-bark-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formAllowedCollaborators}
                          onChange={(e) => setFormAllowedCollaborators(e.target.checked)}
                          className="rounded border-sand-300 text-clay-605 focus:ring-clay-500"
                        />
                        <span>{pfUiT("ui.components.dynamicuiengine.08334c5852")}</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-bark-750 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={formAllowedAdmins}
                          onChange={(e) => setFormAllowedAdmins(e.target.checked)}
                          className="rounded border-sand-300 text-clay-605 focus:ring-clay-500"
                        />
                        <span>{pfUiT("ui.components.dynamicuiengine.d1910ba3d3")}</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-clay-650 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg cursor-pointer"
                    >{pfUiT("ui.components.dynamicuiengine.7fcc05ab5b")}</button>
                    <button
                      type="button"
                      onClick={() => setShowSectionForm(false)}
                      className="bg-sand-100 hover:bg-sand-200 text-bark-700 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-lg cursor-pointer"
                    >{pfUiT("ui.components.dynamicuiengine.2d3b0feec5")}</button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {metadata.profile.sections.map((sec, idx) => (
                  <div key={sec.id} className="p-3 bg-white border border-sand-200 rounded-lg flex flex-col justify-between gap-3 min-h-[120px]">
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono uppercase bg-sand-100 text-bark-600 px-1.5 py-0.5 rounded font-bold">
                            Block {idx + 1}
                          </span>
                          <span className="text-[9px] font-mono font-bold text-clay-700 uppercase">
                            {sec.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditSection(sec)}
                            className="p-1 hover:bg-sand-100 rounded text-bark-500 hover:text-bark-900 transition-colors"
                            title={pfUiT("ui.components.dynamicuiengine.e8b14f69c8")}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSection(sec.id)}
                            className="p-1 hover:bg-red-50 rounded text-bark-400 hover:text-red-600 transition-colors"
                            title={pfUiT("ui.components.dynamicuiengine.90889915be")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h6 className="text-[11px] font-bold text-bark-900 mt-1.5 truncate max-w-[180px]">
                        {sec.title || sec.heading || "Untitled Node"}
                      </h6>
                      <p className="text-[9px] text-bark-450 mt-0.5 truncate max-w-[180px]">
                        {sec.subtitle || sec.content || sec.details || "No secondary metadata"}
                      </p>
                    </div>

                    {sec.visibilityRule && (
                      <div className="text-[8.5px] font-mono px-2 py-0.5 bg-clay-50 text-clay-700 rounded border border-clay-100 self-start font-semibold">
                        👁️ {sec.visibilityRule.description || "Custom Rule"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RENDER MODE INJECTOR AND ENGINE VIEW */}
      <div className={isAdminWorkspace ? `p-6 md:p-10 ${metadata.profile.theme.backgroundColor}` : ""} id="dynamic-ui-engine-sandbox">

        {/* Dynamic Audience Role Filter Simulator Bar */}
        {isAdminWorkspace && (
          <div className="max-w-4xl mx-auto bg-stone-900 text-sand-50 p-5 rounded-xl shadow-lux border border-stone-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-widest text-clay-400 font-bold block">{pfUiT("ui.components.dynamicuiengine.533b724a01")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-300">{pfUiT("ui.components.dynamicuiengine.86dab83208")}</span>
                <strong className="text-xs text-white uppercase bg-clay-605/30 px-2 py-0.5 rounded border border-clay-550/50 font-mono">
                  {simulatedRole === 'guest' ? 'Guest / Public' : simulatedRole === 'buyer' ? 'Casual Visitor (Buyer)' : simulatedRole === 'collaborator' ? 'Professional Partner (Collaborator)' : 'Executive Administrator'}
                </strong>
              </div>
              <p className="text-[10px] text-stone-400 leading-normal max-w-md">{pfUiT("ui.components.dynamicuiengine.d87939ce01")}</p>
            </div>

            <div className="flex flex-wrap gap-1.5 self-stretch md:self-auto">
              <button
                type="button"
                onClick={() => setSimulatedRole('guest')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                  simulatedRole === 'guest' ? 'bg-clay-600 text-white shadow-xs' : 'bg-stone-800 text-stone-300 hover:text-white'
                }`}
              >{pfUiT("ui.components.dynamicuiengine.4d02ac8fe2")}</button>
              <button
                type="button"
                onClick={() => setSimulatedRole('buyer')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                  simulatedRole === 'buyer' ? 'bg-clay-600 text-white shadow-xs' : 'bg-stone-800 text-stone-300 hover:text-white'
                }`}
              >{pfUiT("ui.components.dynamicuiengine.2936d67359")}</button>
              <button
                type="button"
                onClick={() => setSimulatedRole('collaborator')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                  simulatedRole === 'collaborator' ? 'bg-clay-600 text-white shadow-xs' : 'bg-stone-800 text-stone-300 hover:text-white'
                }`}
              >{pfUiT("ui.components.dynamicuiengine.b6c573817b")}</button>
              <button
                type="button"
                onClick={() => setSimulatedRole('administrator')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                  simulatedRole === 'administrator' ? 'bg-clay-600 text-white shadow-xs' : 'bg-stone-800 text-stone-300 hover:text-white'
                }`}
              >{pfUiT("ui.components.dynamicuiengine.d1910ba3d3")}</button>
            </div>
          </div>
        )}

        {/* Rendered Dynamic Profile Frame */}
        <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
          {metadata.profile.sections
            .filter((sec) => {
              // Rule match evaluator
              if (!sec.visibilityRule || !sec.visibilityRule.allowedRoles) return true;
              return sec.visibilityRule.allowedRoles.includes(activeRole);
            })
            .map((sec) => {
            // Hero Header block
            if (sec.type === "hero-header") {
              return (
                <div key={sec.id} className="relative overflow-hidden" id={sec.id}>
                  {renderMode === 'low-end-visual' ? (
                    /* Low End Visual Strike View: Huge, visual-striking typography, bigger font, less detailed content */
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4">
                        {sec.badge && (
                          <span className="text-[11px] font-bold uppercase tracking-widest text-clay-605 font-mono">
                            ✦ {sec.badge} ✦
                          </span>
                        )}
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-black tracking-tight leading-tight text-bark-950 uppercase italic">
                          {sec.title}
                        </h1>
                        <p className="text-xl sm:text-2xl font-serif text-bark-600 leading-relaxed font-light border-l-4 border-clay-500 pl-4">
                          {sec.subtitle}
                        </p>
                      </div>

                      <div className="w-full h-[280px] sm:h-[400px] rounded-2xl overflow-hidden shadow-lux relative group">
                        <img
                          src={sec.image}
                          alt={pfUiT("ui.components.dynamicuiengine.1f79da746d")}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute bottom-6 left-6 right-6">
                          <span className="text-[10px] font-mono text-sand-200 uppercase tracking-widest font-bold">{pfUiT("ui.components.dynamicuiengine.e0a0bb47ba")}</span>
                          <h3 className="text-lg font-serif text-white font-medium mt-1">{pfUiT("ui.components.dynamicuiengine.b47c773846")}</h3>
                        </div>
                      </div>

                      {sec.details && (
                        <p className="text-lg text-bark-850 leading-relaxed max-w-2xl font-serif font-medium">
                          {sec.details}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Professional Detailed View: More technical, formal layout, structured specs */
                    <div className="bg-white border border-sand-250 p-6 md:p-8 rounded-[4px] grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                      <div className="md:col-span-7 space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="bg-bark-100 text-bark-850 text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold border border-sand-250">
                            {sec.badge || 'ATELIER ACTIVE'}
                          </span>
                          <span className="text-[10px] font-mono text-bark-450 uppercase">{pfUiT("ui.components.dynamicuiengine.44a5f4d0f3")}</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-bark-900 tracking-tight leading-snug">
                          {sec.title}
                        </h2>
                        <h4 className="text-xs font-mono text-clay-605 uppercase font-bold tracking-wider">
                          {sec.subtitle}
                        </h4>
                        <div className="h-px bg-sand-200 w-1/3" />
                        {sec.details && (
                          <p className="text-xs text-bark-600 leading-relaxed font-sans">
                            {sec.details}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-5">
                        <div className="aspect-[4/3] rounded-[4px] overflow-hidden border border-sand-300 shadow-3xs">
                          <img
                            src={sec.image}
                            alt={pfUiT("ui.components.dynamicuiengine.c657513a13")}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="text-[9px] font-mono text-bark-400 block text-center mt-2 uppercase">{pfUiT("ui.components.dynamicuiengine.2d8983e63d")}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Stats grid block
            if (sec.type === "stats-grid") {
              return (
                <div key={sec.id} className="space-y-4" id={sec.id}>
                  {renderMode === 'low-end-visual' ? (
                    /* Low End Visual Strike: Bold metrics, bigger values, high striking contrast */
                    <div className="bg-clay-655 text-white p-6 sm:p-10 rounded-2xl space-y-6">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-sand-300 font-bold block">COMMUNITY OVERVIEW</span>
                        <h2 className="text-3xl font-serif font-black tracking-tight">{sec.heading}</h2>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-white/10">
                        {sec.stats?.map((stat, idx) => (
                          <div key={idx} className="space-y-2">
                            <span className="text-xs text-sand-300 uppercase font-mono font-bold block tracking-wider">{stat.label}</span>
                            <div className="text-4xl sm:text-5xl font-serif font-black italic text-sand-50 tracking-tight leading-none">
                              {stat.value}
                            </div>
                            <p className="text-xs text-sand-200 leading-normal font-serif">
                              {stat.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Professional Detailed View: structured technical stats list */
                    <div className="bg-white border border-sand-250 p-6 rounded-[4px] space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                          <BarChart className="w-4 h-4 text-clay-605" /> {sec.heading}
                        </h4>
                        {sec.subtitle && <p className="text-[10px] text-bark-450 mt-1 font-mono">{sec.subtitle}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {sec.stats?.map((stat, idx) => (
                          <div key={idx} className="p-4 bg-[#FAF8F5] border border-sand-200 rounded-[4px] space-y-1">
                            <span className="text-[9px] font-mono text-bark-400 uppercase tracking-wider font-bold block">{stat.label}</span>
                            <strong className="text-xl font-serif font-bold text-bark-900 block">{stat.value}</strong>
                            <span className="text-[9px] text-bark-500 block leading-tight">{stat.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Text block (Narrative / Philosophy)
            if (sec.type === "text-block") {
              return (
                <div key={sec.id} className="space-y-4" id={sec.id}>
                  {renderMode === 'low-end-visual' ? (
                    /* Low End Visual Strike: large reading typography, high impact italic layouts */
                    <div className="space-y-6 py-4">
                      <h2 className="text-3xl font-serif font-black text-bark-950 uppercase italic tracking-tight border-b-2 border-clay-500 pb-2">
                        {sec.heading}
                      </h2>
                      <p className="text-xl sm:text-2xl font-serif text-bark-850 leading-relaxed font-light">
                        {sec.content}
                      </p>
                      {sec.callout && (
                        <div className="bg-clay-50 border-l-4 border-clay-605 p-6 rounded-r-2xl">
                          <span className="text-[10px] font-mono uppercase text-clay-700 tracking-wider font-bold block mb-1">{pfUiT("ui.components.dynamicuiengine.7d2bc3cbf5")}</span>
                          <p className="text-base font-serif italic text-bark-800 leading-relaxed">{sec.callout}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Professional Detailed: Clean regular text with layout columns */
                    <div className="bg-white border border-sand-250 p-6 rounded-[4px] space-y-4">
                      <h4 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Type className="w-4 h-4 text-clay-605" /> {sec.heading}
                      </h4>
                      <p className="text-xs text-bark-650 leading-relaxed font-sans">
                        {sec.content}
                      </p>
                      {sec.callout && (
                        <div className="p-3 bg-sand-100/40 border border-sand-200 rounded-[4px] text-[10px] text-bark-750 font-sans leading-relaxed">
                          <b>{pfUiT("ui.components.dynamicuiengine.7f88d03ab1")}</b> {sec.callout}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Showcase Portfolio cards
            if (sec.type === "showcase-cards") {
              return (
                <div key={sec.id} className="space-y-4" id={sec.id}>
                  <div className="flex justify-between items-end border-b border-sand-200 pb-2">
                    <div>
                      {renderMode === 'low-end-visual' ? (
                        <h2 className="text-3xl font-serif font-black uppercase text-bark-950">{sec.heading}</h2>
                      ) : (
                        <h4 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                          <LayoutGrid className="w-4 h-4 text-clay-605" /> {sec.heading}
                        </h4>
                      )}
                      {sec.subtitle && <p className="text-[10px] text-bark-450 mt-1 font-mono">{sec.subtitle}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {sec.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className={`overflow-hidden transition-all duration-350 ${
                          renderMode === 'low-end-visual'
                            ? 'bg-transparent space-y-3'
                            : 'bg-white border border-sand-250 rounded-[4px] p-4 flex flex-col justify-between hover:shadow-2xs'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className={`overflow-hidden relative ${renderMode === 'low-end-visual' ? 'rounded-2xl h-[260px]' : 'rounded-[4px] h-[160px] border border-sand-200'}`}>
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform hover:scale-103 duration-500"
                              referrerPolicy="no-referrer"
                            />
                            {item.badge && (
                              <span className="absolute top-3 left-3 bg-bark-900 text-sand-50 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {renderMode === 'low-end-visual' ? (
                              <h3 className="text-2xl font-serif font-black text-bark-950 uppercase italic tracking-tight">{item.title}</h3>
                            ) : (
                              <h5 className="text-xs font-bold text-bark-900 uppercase">{item.title}</h5>
                            )}
                            <p className={`${renderMode === 'low-end-visual' ? 'text-sm text-bark-600' : 'text-[11px] text-bark-500'} font-sans`}>
                              {item.subtitle}
                            </p>
                          </div>
                        </div>

                        {renderMode === 'pro-detailed' && (item.difficulty || item.timeToSew) && (
                          <div className="mt-4 pt-3 border-t border-sand-150 grid grid-cols-2 gap-2 text-[9px] font-mono text-bark-450">
                            <div>{pfUiT("ui.components.dynamicuiengine.0c5ead765f")}<strong className="text-bark-800">{item.difficulty || 'N/A'}</strong></div>
                            <div>{pfUiT("ui.components.dynamicuiengine.fa24404e50")}<strong className="text-bark-800">{item.timeToSew || 'N/A'}</strong></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Checklists block
            if (sec.type === "checklists") {
              return (
                <div key={sec.id} className="space-y-4" id={sec.id}>
                  {renderMode === 'low-end-visual' ? (
                    /* Low End Visual Strike: large stylized checks */
                    <div className="space-y-4">
                      <h2 className="text-3xl font-serif font-black text-bark-950 uppercase italic tracking-tight">
                        {sec.heading}
                      </h2>
                      <div className="space-y-3">
                        {sec.items?.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div className="w-7 h-7 bg-clay-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="w-4 h-4 text-clay-700 stroke-[3]" />
                            </div>
                            <span className="text-lg sm:text-xl font-serif text-bark-850 font-medium leading-relaxed">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Professional Detailed: Clean lists block */
                    <div className="bg-white border border-sand-250 p-6 rounded-[4px] space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckSquare className="w-4 h-4 text-clay-605" /> {sec.heading}
                        </h4>
                        {sec.subtitle && <p className="text-[10px] text-bark-450 mt-1 font-mono">{sec.subtitle}</p>}
                      </div>

                      <div className="space-y-2">
                        {sec.items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 text-xs text-bark-650 font-sans">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5] flex-shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
