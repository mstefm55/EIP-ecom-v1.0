import { getOptInDemoMemberAccounts, isDemoRuntimeDataEnabled } from '../lib/runtimeRepositoryBootstrap';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import React, { useState, useEffect } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Lock, Shield, CreditCard, DollarSign, PlusCircle,
  Trash2, Search, CheckCircle, Tag, ShoppingBag, Eye, LogIn,
  Sparkles, Award, FileText, ChevronRight, Check, Key,
  Camera, UploadCloud, Image, MapPin, Phone
} from 'lucide-react';
import CollaboratorSalesDashboard from './CollaboratorSalesDashboard';
import { UI_LAYERS } from '../lib/uiLayers';
import { resolveActivePromotion } from '../lib/commercialPromotions';
import {
  ensureUserPublicIdentity,
  formatPublicHandle,
  getStableUserId,
  normalizeUsername,
  registerUsernameForUser,
  validateUsername
} from '../lib/userIdentity';

export default function MemberManagement({
  onLoginSuccess,
  onLogout,
  currentUser,
  setCurrentUser,
  isOpen,
  onClose,
  onOpenAdminConsole,
  patterns = [],
  commercialPromotions = [],
  onUndisplayProduct
}) {
  const demoAccounts = getOptInDemoMemberAccounts();
  const INITIAL_COLLABORATOR = demoAccounts.collaborator || {};
  const INITIAL_BUYER = demoAccounts.buyer || {};
  const INITIAL_ADMINISTRATOR = demoAccounts.administrator || {};
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [selectedRole, setSelectedRole] = useState('buyer'); // 'buyer' or 'collaborator'

  // Tab within Dashboard
  const [dashboardTab, setDashboardTab] = useState('overview'); // 'overview' | 'listings' | 'sales' | 'profile'

  // Search/Filter states in sales history
  const [salesSearch, setSalesSearch] = useState('');
  const [salesFilterFormat, setSalesFilterFormat] = useState('All');

  // Custom Profile & Creations Gallery Showcase states
  const [newProjectCaption, setNewProjectCaption] = useState('');
  const [newProjectImage, setNewProjectImage] = useState('');

  // Subscribers list state for collaborator panel
  const [subscribers, setSubscribers] = useState([]);

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = runtimeDataStorage.getItem('sartorial_newsletter_subscribers');
        if (saved) {
          setSubscribers(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!currentUser || currentUser.username) return;
    const migratedUser = ensureUserPublicIdentity(currentUser, {
      persist: true,
      source: 'member-management-legacy-migration'
    });
    if (migratedUser?.username) {
      setCurrentUser(migratedUser);
    }
  }, [currentUser, setCurrentUser]);

  const handleDeleteSubscriber = (indexToDelete) => {
    const subToDelete = subscribers[indexToDelete];
    if (window.confirm(`Are you sure you want to retract "${subToDelete.email}" from the Atelier mailing registry?`)) {
      const updated = subscribers.filter((_, idx) => idx !== indexToDelete);
      setSubscribers(updated);
      try {
        runtimeDataStorage.setItem('sartorial_newsletter_subscribers', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Load user status or sync
  const handleSignIn = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    const completeLogin = (user) => {
      const publicUser = ensureUserPublicIdentity(user, {
        persist: true,
        source: 'member-management-sign-in'
      });
      setCurrentUser(publicUser);
      onLoginSuccess && onLoginSuccess(publicUser);
    };

    // Demo persona switching is available only through the explicit development flag.
    if (isDemoRuntimeDataEnabled() && email.toLowerCase().includes('admin')) {
      completeLogin(INITIAL_ADMINISTRATOR);
    } else if (isDemoRuntimeDataEnabled() && (email.toLowerCase().includes('atelier') || email.toLowerCase().includes('margot'))) {
      // Login as Margot Leone (Collaborator)
      completeLogin(INITIAL_COLLABORATOR);
    } else {
      const user = {
        email: email,
        fullName: fullName || email.split('@')[0],
        role: 'buyer'
      };
      completeLogin(user);
    }
    // reset form
    setEmail('');
    setPassword('');
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    const userId = getStableUserId({
      email,
      fullName,
      role: selectedRole
    });
    const usernameValidation = validateUsername(username, { currentUserId: userId });
    setUsernameError(usernameValidation.message);

    if (!email || !fullName || !usernameValidation.valid) return;

    let newUser = {};
    if (selectedRole === 'collaborator') {
      newUser = {
        ...INITIAL_COLLABORATOR,
        id: userId,
        username: usernameValidation.username,
        fullName: fullName,
        email: email,
        role: 'collaborator',
        brandName: INITIAL_COLLABORATOR.brandName,
        designerBrand: INITIAL_COLLABORATOR.designerBrand
      };
    } else {
      newUser = {
        ...INITIAL_BUYER,
        id: userId,
        username: usernameValidation.username,
        fullName: fullName,
        email: email,
        role: 'buyer'
      };
    }

    registerUsernameForUser(usernameValidation.username, userId, {
      ...newUser,
      source: 'member-management-sign-up'
    });

    const publicUser = ensureUserPublicIdentity(newUser, {
      persist: true,
      source: 'member-management-sign-up'
    });
    setCurrentUser(publicUser);
    onLoginSuccess && onLoginSuccess(publicUser);
    setIsSignUpMode(false);
    setEmail('');
    setPassword('');
    setFullName('');
    setUsername('');
    setUsernameError('');
  };

  const switchDemoAccount = (role) => {
    if (!isDemoRuntimeDataEnabled()) return;
    const completeLogin = (user) => {
      const publicUser = ensureUserPublicIdentity(user, {
        persist: true,
        source: 'member-management-demo'
      });
      setCurrentUser(publicUser);
      onLoginSuccess && onLoginSuccess(publicUser);
    };

    if (role === 'administrator') {
      completeLogin(INITIAL_ADMINISTRATOR);
    } else if (role === 'collaborator') {
      completeLogin(INITIAL_COLLABORATOR);
    } else {
      completeLogin(INITIAL_BUYER);
    }
  };

  // Profile picture & creations gallery helpers
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentUser(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProjectPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProjectImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProject = (e) => {
    e.preventDefault();
    if (!newProjectImage) {
      alert("Please select a photo of your finished sewing garment first.");
      return;
    }
    const newProject = {
      id: `proj-${Date.now()}`,
      url: newProjectImage,
      caption: newProjectCaption || 'Custom finished garment project'
    };
    setCurrentUser(prev => ({
      ...prev,
      creationGallery: [newProject, ...(prev.creationGallery || [])]
    }));
    setNewProjectCaption('');
    setNewProjectImage('');
  };

  const handleRemoveProject = (id) => {
    if (window.confirm("Remove this creation photo from your showcase?")) {
      setCurrentUser(prev => ({
        ...prev,
        creationGallery: (prev.creationGallery || []).filter(item => item.id !== id)
      }));
    }
  };

  // Sales calculations
  const totalSalesGross = currentUser?.salesHistory?.reduce((sum, item) => sum + item.gross, 0) || 0;
  const totalCommission = currentUser?.salesHistory?.reduce((sum, item) => sum + item.commission, 0) || 0;
  const totalNetEarnings = currentUser?.salesHistory?.reduce((sum, item) => sum + item.net, 0) || 0;

  const activePromotion = resolveActivePromotion(commercialPromotions, currentUser);

  // Filter sales history
  const filteredSales = currentUser?.salesHistory?.filter(txn => {
    const matchSearch = txn.buyer.toLowerCase().includes(salesSearch.toLowerCase()) ||
                        txn.patternName.toLowerCase().includes(salesSearch.toLowerCase());
    const matchFormat = salesFilterFormat === 'All' || txn.format === salesFilterFormat;
    return matchSearch && matchFormat;
  }) || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          style={{ zIndex: UI_LAYERS.modalBackdrop }}
          id="auth-modal-overlay"
        >

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white border border-sand-300 w-full max-w-4xl rounded-[4px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            style={{ zIndex: UI_LAYERS.modal }}
            id="auth-modal-frame"
          >
            {/* Sidebar Branding and Demo helper */}
            <div className="md:w-72 bg-gradient-to-br from-bark-900 to-bark-950 text-sand-50 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-sand-800/30" id="auth-modal-left">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-clay-400 font-mono">{pfUiT("ui.components.membermanagement.a51a5a586b")}</span>
                  <h3 className="text-xl font-serif text-white font-medium tracking-wide mt-1">{pfUiT("ui.components.membermanagement.e11f0e5ba3")}</h3>
                  <p className="text-[11px] text-sand-300/80 leading-relaxed mt-2">{pfUiT("ui.components.membermanagement.53785d26b4")}</p>
                </div>

                {!currentUser && isDemoRuntimeDataEnabled() && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-[4px] space-y-2.5" id="demo-quick-login">
                    <span className="text-[10px] font-mono uppercase text-clay-300 font-bold block tracking-wider">{pfUiT("ui.components.membermanagement.bc71857400")}</span>
                    <p className="text-[10px] text-sand-300 leading-normal">{pfUiT("ui.components.membermanagement.d1f96b4e23")}</p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        onClick={() => switchDemoAccount('administrator')}
                        className="bg-bark-900 hover:bg-bark-850 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left flex items-center justify-between border border-white/20"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-clay-500"></span>
                          <span>{pfUiT("ui.components.membermanagement.c26a2728c1")}</span>
                        </span>
                        <ChevronRight className="w-3 h-3 text-clay-400" />
                      </button>
                      <button
                        onClick={() => switchDemoAccount('collaborator')}
                        className="bg-clay-650 hover:bg-clay-600 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left flex items-center justify-between"
                      >
                        <span>Login: Collaborator (Seller)</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => switchDemoAccount('buyer')}
                        className="bg-sand-50/10 hover:bg-sand-50/20 text-sand-50 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left flex items-center justify-between"
                      >
                        <span>{pfUiT("ui.components.membermanagement.69f34af8a4")}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[9px] text-sand-400/80 leading-normal pt-4 border-t border-sand-800/20">{pfUiT("ui.components.membermanagement.6a57dd06a6")}</div>
            </div>

            {/* Main Interactive Form area */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-sand-50/10" id="auth-modal-right">

              {/* Header inside right */}
              <div className="flex justify-between items-center border-b border-sand-100 pb-4 mb-6">
                <div>
                  {currentUser ? (
                    <div className="flex items-center gap-2.5">
                      {currentUser.avatar ? (
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.fullName}
                          className="w-10 h-10 rounded-full object-cover border border-clay-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-clay-100 text-clay-700 flex items-center justify-center font-bold text-sm">
                          {currentUser.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-bark-900 leading-none">{currentUser.fullName}</h4>
                        {currentUser.username && (
                          <span className="mt-1 block text-[10px] font-semibold text-bark-500">
                            {formatPublicHandle(currentUser.username)}
                          </span>
                        )}
                        <span className="text-[9px] font-mono uppercase tracking-widest text-clay-605 mt-1 block">
                          {currentUser.role === 'collaborator' ? '✦ Atelier Collaborator / Seller' : '✦ Atelier Club Buyer'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <h4 className="text-base font-serif font-bold text-bark-900">
                      {isSignUpMode ? 'Create New Atelier Account' : 'Sign In to Your Workspace'}
                    </h4>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full hover:bg-sand-100 flex items-center justify-center text-bark-500 hover:text-bark-900 transition-colors cursor-pointer text-sm font-semibold border border-sand-200"
                >
                  ✕
                </button>
              </div>

              {/* GUEST VIEW: AUTHENTICATION FORMS */}
              {!currentUser ? (
                <div className="space-y-6" id="auth-guest-view">
                  <form onSubmit={isSignUpMode ? handleSignUp : handleSignIn} className="space-y-4">
                    {isSignUpMode && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">{pfUiT("ui.components.membermanagement.1e6520e3a2")}</label>
                        <div className="relative border border-sand-250 rounded-xl bg-white flex items-center px-3 py-2.5 focus-within:border-clay-550 transition-colors">
                          <User className="w-4 h-4 text-bark-400 mr-2" />
                          <input
                            type="text"
                            required
                            placeholder={pfUiT("ui.components.membermanagement.d6db4cb4b5")}
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                          />
                        </div>
                      </div>
                    )}

                    {isSignUpMode && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">{pfUiT("ui.components.membermanagement.152ff4789e")}</label>
                        <div
                          className={`relative border rounded-xl bg-white flex items-center px-3 py-2.5 transition-colors ${
                            usernameError ? 'border-rose-300' : 'border-sand-250 focus-within:border-clay-550'
                          }`}
                        >
                          <span className="mr-1.5 text-xs font-bold text-clay-650">@</span>
                          <input
                            type="text"
                            required
                            placeholder={pfUiT("ui.components.membermanagement.16b08cf9c2")}
                            value={username}
                            onChange={(e) => {
                              const nextUsername = normalizeUsername(e.target.value);
                              setUsername(nextUsername);
                              if (usernameError) {
                                setUsernameError(validateUsername(nextUsername).message);
                              }
                            }}
                            onBlur={() => setUsernameError(validateUsername(username).message)}
                            className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                          />
                        </div>
                        <p className={`text-[9px] leading-snug ${usernameError ? 'text-rose-600' : 'text-bark-450'}`}>
                          {usernameError || 'Used in messages and community interactions. 3-30 letters, numbers, . or _'}
                        </p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">{pfUiT("ui.components.membermanagement.0a2c4bc19a")}</label>
                      <div className="relative border border-sand-250 rounded-xl bg-white flex items-center px-3 py-2.5 focus-within:border-clay-550 transition-colors">
                        <Mail className="w-4 h-4 text-bark-400 mr-2" />
                        <input
                          type="email"
                          required
                          placeholder={pfUiT("ui.components.membermanagement.7945277074")}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">{pfUiT("ui.components.membermanagement.0fcf7a8b71")}</label>
                      <div className="relative border border-sand-250 rounded-xl bg-white flex items-center px-3 py-2.5 focus-within:border-clay-550 transition-colors">
                        <Lock className="w-4 h-4 text-bark-400 mr-2" />
                        <input
                          type="password"
                          required
                          placeholder={pfUiT("ui.components.membermanagement.7fd738fb02")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                        />
                      </div>
                    </div>

                    {isSignUpMode && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">{pfUiT("ui.components.membermanagement.070f628340")}</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedRole('buyer')}
                            className={`p-3 rounded-[4px] border text-left transition-all ${
                              selectedRole === 'buyer'
                                ? 'border-sage-600 bg-sage-50/30'
                                : 'border-sand-200 bg-white hover:border-sand-400'
                            }`}
                          >
                            <span className="text-xs font-bold text-bark-900 block">{pfUiT("ui.components.membermanagement.a46071d88c")}</span>
                            <span className="text-[9px] text-bark-500 block leading-tight mt-1">{pfUiT("ui.components.membermanagement.a4ef619afd")}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedRole('collaborator')}
                            className={`p-3 rounded-[4px] border text-left transition-all ${
                              selectedRole === 'collaborator'
                                ? 'border-clay-605 bg-clay-50/20'
                                : 'border-sand-200 bg-white hover:border-sand-400'
                            }`}
                          >
                            <span className="text-xs font-bold text-bark-900 block">{pfUiT("ui.components.membermanagement.1881f77c2c")}</span>
                            <span className="text-[9px] text-bark-500 block leading-tight mt-1">{pfUiT("ui.components.membermanagement.d62e49b2c9")}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-bark-900 hover:bg-bark-850 text-sand-50 py-3 rounded-xl text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer shadow-3xs"
                    >
                      {isSignUpMode ? 'Register Member Profile' : 'Authenticate Workspace'}
                    </button>
                  </form>

                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        setIsSignUpMode(!isSignUpMode);
                        setUsernameError('');
                      }}
                      className="text-xs text-clay-700 hover:text-clay-605 font-semibold underline cursor-pointer"
                    >
                      {isSignUpMode ? 'Already have a Perfect Fit account? Sign In' : 'New to Perfect Fit Bureau? Create free profile'}
                    </button>
                  </div>
                </div>
              ) : (
                /* LOGGED IN MEMBER VIEW: DASHBOARDS & ACCOUNTS */
                <div className="space-y-6" id="auth-member-view">

                  {/* Dashboard Nav Tabs */}
                  <div className="flex border-b border-sand-200 gap-6" id="dashboard-nav-tabs">
                    <button
                      onClick={() => setDashboardTab('overview')}
                      className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        dashboardTab === 'overview' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                      }`}
                    >{pfUiT("ui.components.membermanagement.09bd04e6ce")}</button>

                    {currentUser.role === 'collaborator' ? (
                      <>
                        <button
                          onClick={() => setDashboardTab('listings')}
                          className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            dashboardTab === 'listings' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                          }`}
                        >{pfUiT("ui.components.membermanagement.b4c1a0791f")}</button>
                        <button
                          onClick={() => setDashboardTab('sales')}
                          className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            dashboardTab === 'sales' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                          }`}
                        >
                          Sales &amp; Earnings Log
                        </button>
                        <button
                          onClick={() => setDashboardTab('subscribers')}
                          className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            dashboardTab === 'subscribers' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                          }`}
                        >{pfUiT("ui.components.membermanagement.a528a95dd3")}</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDashboardTab('sales')}
                        className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                          dashboardTab === 'sales' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                        }`}
                      >{pfUiT("ui.components.membermanagement.49e0886706")}</button>
                    )}
                    {currentUser.role === 'administrator' && (
  <button
    type="button"
    onClick={() => {
      if (onOpenAdminConsole) {
        onOpenAdminConsole();
      } else {
        console.warn("onOpenAdminConsole is not connected from App.jsx");
      }
      onClose();
    }}
    className="pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer text-bark-450 hover:text-bark-900"
  >{pfUiT("ui.components.membermanagement.4a570f903f")}</button>
)}
                    <button
                      onClick={() => setDashboardTab('profile')}
                      className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        dashboardTab === 'profile' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                      }`}
                    >{pfUiT("ui.components.membermanagement.c5ecdcc0b4")}</button>
                  </div>

                  {/* TAB 1: OVERVIEW */}
                  {dashboardTab === 'overview' && (
                    <div className="space-y-6" id="tab-overview-content">
                      {currentUser.role === 'collaborator' ? (
                        /* COLLABORATOR FINANCIAL METRICS */
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                            <div className="p-4 bg-clay-50/50 border border-clay-100 rounded-[4px] space-y-1.5" id="metric-gross">
                              <span className="text-[10px] font-mono text-bark-450 uppercase tracking-widest font-bold block">{pfUiT("ui.components.membermanagement.8ea27fb97b")}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold text-clay-700">${totalSalesGross.toFixed(2)}</span>
                                <span className="text-[10px] text-bark-400 font-mono">USD</span>
                              </div>
                              <span className="text-[9px] text-bark-500 block">{pfUiT("ui.components.membermanagement.0508f9d08b")}</span>
                            </div>

                            <div className="p-4 bg-sand-100/30 border border-sand-200 rounded-[4px] space-y-1.5" id="metric-referral">
                              <span className="text-[10px] font-mono text-bark-450 uppercase tracking-widest font-bold block">{pfUiT("ui.components.membermanagement.426b89f123")}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold text-bark-800">${totalCommission.toFixed(2)}</span>
                                <span className="text-[10px] text-bark-400 font-mono">{pfUiT("ui.components.membermanagement.c90a6b8fa2")}</span>
                              </div>
                              <span className="text-[9px] text-bark-500 block">{pfUiT("ui.components.membermanagement.7a628e9f7d")}</span>
                            </div>

                            <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-[4px] space-y-1.5" id="metric-net">
                              <span className="text-[10px] font-mono text-bark-450 uppercase tracking-widest font-bold block">{pfUiT("ui.components.membermanagement.b3f5709f14")}</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold text-emerald-800">${totalNetEarnings.toFixed(2)}</span>
                                <span className="text-[10px] text-bark-400 font-mono">{pfUiT("ui.components.membermanagement.691174f9b9")}</span>
                              </div>
                              <span className="text-[9px] text-emerald-700 font-medium block">{pfUiT("ui.components.membermanagement.b0ae39f268")}</span>
                            </div>

                          </div>

                          {/* Quick details */}
                          <div className="bg-white border border-sand-200 rounded-[4px] p-5 space-y-3">
                            <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider">{pfUiT("ui.components.membermanagement.c9ce86e8eb")}</h5>
                            <div className="grid grid-cols-2 gap-4 text-xs font-sans text-bark-600">
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">{pfUiT("ui.components.membermanagement.f47cb3ba76")}</span>
                                <strong className="text-bark-950 font-semibold">{patterns.length} Displayed Products</strong>
                              </div>
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">{pfUiT("ui.components.membermanagement.824a864fb7")}</span>
                                <strong className="text-clay-700 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5" />{pfUiT("ui.components.membermanagement.84a5964334")}</strong>
                              </div>
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">{pfUiT("ui.components.membermanagement.60e6169774")}</span>
                                <span className="font-mono text-[11px] text-bark-800">{currentUser.payoutMethod || 'None registered'}</span>
                              </div>
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">{pfUiT("ui.components.membermanagement.ed1a676ee4")}</span>
                                <span className="text-emerald-700 font-semibold">5.0 / 5.0 (Flawless blueprints)</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : currentUser.role === 'administrator' ? (
                        /* ADMINISTRATOR OPERATION CENTRE OVERVIEW */
                        <div className="space-y-6">
                          <div className="bg-[#1c1917] text-sand-50 rounded-[4px] p-6 relative overflow-hidden border border-sand-800">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-clay-400" />
                                <span className="text-[10px] uppercase tracking-widest text-clay-300 font-mono font-bold">{pfUiT("ui.components.membermanagement.2d30ee9fbc")}</span>
                              </div>

                              <h3 className="text-xl font-serif text-white font-medium leading-tight">{pfUiT("ui.components.membermanagement.49c06f7493")}</h3>

                              <p className="text-xs text-sand-300 max-w-md leading-relaxed">
                                Welcome, {currentUser.fullName}! You have complete administrative credentials over the Perfect Fit Bureau. Toggle rendering modes, edit layout metadata database models, and enforce login constraints instantly.
                              </p>
                            </div>
                          </div>

                          <div className="p-4 bg-clay-50 border border-clay-200 rounded-[4px] space-y-2">
                            <span className="text-[10px] font-mono text-clay-800 uppercase font-bold block">{pfUiT("ui.components.membermanagement.412e2d0b88")}</span>
                            <p className="text-xs text-bark-650 leading-relaxed">{pfUiT("ui.components.membermanagement.11b4d367e9")}</p>
                          </div>
                        </div>
                      ) : (
                        /* REGULAR BUYER OVERVIEW */
                        <div className="space-y-6">
                          <div className="bg-gradient-to-r from-sage-900 to-sage-950 text-sand-50 rounded-[4px] p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Award className="w-5 h-5 text-amber-300" />
                                <span className="text-[10px] uppercase tracking-widest text-amber-300 font-mono font-bold">
                                  {currentUser.tier || 'Atelier Gold Member'}
                                </span>
                              </div>

                              <h3 className="text-xl font-serif text-white font-medium leading-tight">{pfUiT("ui.components.membermanagement.bcbb2298c0")}</h3>

                              <p className="text-xs text-sand-300 max-w-md leading-relaxed">
                                Welcome back, {currentUser.fullName}! Your active membership provides access to premium tutorials and seasonal sewing handbook directories.
                                {activePromotion && ` The current member promotion provides ${activePromotion.discountPercent}% off eligible purchases.`}
                              </p>

                              {activePromotion?.code && (
                                <div className="pt-2 flex items-center gap-2">
                                  <span className="text-[10px] font-mono bg-white/10 text-white border border-white/20 px-3 py-1 rounded-lg">{pfUiT("ui.components.membermanagement.7e0afba98a")}<b className="font-mono text-amber-300">{activePromotion.code}</b></span>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(activePromotion.code)}
                                    className="bg-sand-50 hover:bg-sand-100 text-bark-950 text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                                  >{pfUiT("ui.components.membermanagement.f494737f1c")}</button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Sizing Integration connection */}
                          <div className="bg-clay-50/40 border border-clay-100 rounded-[4px] p-5 space-y-3">
                            <h5 className="text-xs font-bold text-clay-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-clay-605" />{pfUiT("ui.components.membermanagement.2cc408e2a7")}</h5>
                            <p className="text-xs text-bark-650 leading-relaxed">
                              Your active sizing metrics are pre-calibrated to recommend **Atelier Size {currentUser.sizingProfile ? '8' : 'Standard'}** across the entire curated catalog.
                            </p>
                            <div className="grid grid-cols-3 gap-3 text-center">
                              <div className="bg-white border border-sand-200 p-2.5 rounded-[4px]">
                                <span className="text-[10px] text-bark-400 block font-mono">BUST</span>
                                <strong className="text-xs text-bark-900 font-serif font-bold">{currentUser.sizingProfile?.bust || 36} inches</strong>
                              </div>
                              <div className="bg-white border border-sand-200 p-2.5 rounded-[4px]">
                                <span className="text-[10px] text-bark-400 block font-mono">WAIST</span>
                                <strong className="text-xs text-bark-900 font-serif font-bold">{currentUser.sizingProfile?.waist || 28} inches</strong>
                              </div>
                              <div className="bg-white border border-sand-200 p-2.5 rounded-[4px]">
                                <span className="text-[10px] text-bark-400 block font-mono">HIPS</span>
                                <strong className="text-xs text-bark-900 font-serif font-bold">{currentUser.sizingProfile?.hips || 38} inches</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Displayed Products is a projection of Workspace publication state. */}
                  {dashboardTab === 'listings' && currentUser.role === 'collaborator' && (
                    <div className="space-y-6" id="tab-listings-content">
                      <div className="space-y-3">
                        <div>
                          <h6 className="text-xs font-bold text-bark-900 uppercase tracking-wider">{pfUiT('ui.member.displayedProducts.title')}</h6>
                          <p className="mt-1 text-[10px] text-bark-500">{pfUiT('ui.member.displayedProducts.description')}</p>
                        </div>
                        <div className="space-y-3" id="active-patterns-catalog">
                          {patterns.length === 0 && (
                            <div className="rounded-[4px] border border-dashed border-sand-250 bg-sand-50/30 p-8 text-center text-xs text-bark-450">
                              {pfUiT('ui.member.displayedProducts.empty')}
                            </div>
                          )}
                          {patterns.map((pat) => (
                            <div
                              key={pat.id}
                              className="p-4 rounded-[4px] border border-sand-200 bg-white transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <strong className="text-xs font-bold text-bark-900 block">{pat.name}</strong>
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{pfUiT('ui.member.displayedProducts.status')}</span>
                                </div>
                                <p className="text-[10px] text-bark-500 font-mono">
                                  {pat.variantCode || pat.workspaceVariantCode || 'Workspace publication'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => onUndisplayProduct?.(pat)}
                                className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border bg-sand-50 hover:bg-sand-100 text-bark-750 border-sand-200 transition-colors cursor-pointer"
                              >{pfUiT('ui.member.displayedProducts.undisplay')}</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: SALES & EARNINGS LOG OR ORDER HISTORY */}
                  {dashboardTab === 'sales' && (
                    <div className="space-y-6" id="tab-sales-content">

                      {currentUser.role === 'collaborator' ? (
                        /* REFINDED COLLABORATOR SALES DASHBOARD FOR ERP SYSTEMS */
                        <CollaboratorSalesDashboard
                          salesHistory={currentUser.salesHistory || []}
                          payoutMethod={currentUser.payoutMethod}
                          onUpdateSalesHistory={(newSales) => {
                            setCurrentUser(prev => ({
                              ...prev,
                              salesHistory: newSales
                            }));
                          }}
                        />
                      ) : (
                        /* REGULAR BUYER ORDER HISTORY */
                        <div className="space-y-4">
                          <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider">{pfUiT("ui.components.membermanagement.1ee889c5e7")}</h5>

                          <div className="space-y-3" id="buyer-orders-history">
                            {currentUser.purchaseHistory?.map((ord) => (
                              <div key={ord.id} className="bg-white border border-sand-200 rounded-[4px] p-4 space-y-3" id={`order-card-${ord.id}`}>
                                <div className="flex justify-between items-start" id="order-meta">
                                  <div>
                                    <strong className="text-xs text-bark-900 block font-serif font-bold">{ord.patternName}</strong>
                                    <span className="text-[10px] text-bark-450 font-mono mt-0.5 block">
                                      Order {ord.id} • Purchased on {ord.date}
                                    </span>
                                  </div>
                                  <span className="text-xs font-mono font-bold text-bark-850">${ord.price.toFixed(2)}</span>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-sand-100" id="order-actions">
                                  <div className="flex items-center gap-1.5 text-[10px] text-bark-650">
                                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                                    <span>{pfUiT("ui.components.membermanagement.f0555b92ed")}<b>{ord.status}</b></span>
                                  </div>

                                  <div className="flex gap-2">
                                    {ord.format === 'PDF' ? (
                                      <button
                                        onClick={() => alert(`Initiating direct high-resolution secure download for "${ord.patternName}" blueprint pack (contains A0, A4, Sizing guides).`)}
                                        className="bg-bark-900 hover:bg-bark-800 text-sand-50 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                      >{pfUiT("ui.components.membermanagement.3b6ac37e2e")}</button>
                                    ) : (
                                      <button
                                        onClick={() => alert(`Redirecting to Perfect Fit Postal Tracking Portal for signature tissue-paper parcel #SART-98402.`)}
                                        className="bg-sand-100 hover:bg-sand-200 text-bark-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors border border-sand-250 cursor-pointer"
                                      >{pfUiT("ui.components.membermanagement.52805a88a4")}</button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: SUBSCRIBERS REGISTER */}
                  {dashboardTab === 'subscribers' && currentUser.role === 'collaborator' && (
                    <div className="space-y-6" id="tab-subscribers-content">
                      <div className="bg-white border border-sand-250 rounded-[4px] p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-sand-100 pb-3 gap-3">
                          <div>
                            <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Mail className="w-4 h-4 text-clay-605" />{pfUiT("ui.components.membermanagement.573ac31f30")}</h5>
                            <p className="text-[10px] text-bark-450 mt-1">{pfUiT("ui.components.membermanagement.ffa9954643")}</p>
                          </div>

                          {/* Total count badge */}
                          <div className="bg-clay-50 border border-clay-200/50 rounded-md px-2.5 py-1 text-center shrink-0">
                            <span className="text-[9px] font-mono text-clay-505 block uppercase">{pfUiT("ui.components.membermanagement.5450893649")}</span>
                            <span className="text-xs font-bold font-mono text-clay-705">
                              {subscribers.length} Active
                            </span>
                          </div>
                        </div>

                        {/* Subscribers list */}
                        {subscribers.length === 0 ? (
                          <p className="text-xs text-bark-450 italic py-8 text-center">{pfUiT("ui.components.membermanagement.3f670b4b0d")}</p>
                        ) : (
                          <div className="space-y-3" id="subscribers-list-records">
                            <div className="border border-sand-200 rounded-[4px] overflow-hidden bg-white shadow-3xs overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                                <thead>
                                  <tr className="bg-sand-50 border-b border-sand-200 text-bark-500 font-mono text-[9px] uppercase tracking-wider">
                                    <th className="p-3 font-semibold">{pfUiT("ui.components.membermanagement.2c319289a0")}</th>
                                    <th className="p-3 font-semibold">{pfUiT("ui.components.membermanagement.45997fd5e2")}</th>
                                    <th className="p-3 font-semibold">{pfUiT("ui.components.membermanagement.2a945ba3bb")}</th>
                                    <th className="p-3 font-semibold text-right">{pfUiT("ui.components.membermanagement.771f5f35da")}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-sand-100 font-sans">
                                  {subscribers.map((sub, idx) => (
                                    <tr key={idx} className="hover:bg-sand-50/40 transition-colors">
                                      <td className="p-3 font-semibold text-bark-900 font-mono text-[11px] select-all">{sub.email}</td>
                                      <td className="p-3 text-bark-500 text-[11px]">{new Date(sub.timestamp).toLocaleString()}</td>
                                      <td className="p-3">
                                        <span className={`text-[9.5px] font-mono px-2 py-0.5 rounded-full ${
                                          sub.source === 'Mobile App View'
                                            ? 'bg-clay-50 text-clay-750 border border-clay-100/50'
                                            : 'bg-sage-50 text-sage-750 border border-sage-100/50'
                                        }`}>
                                          {sub.source || 'Desktop Footer'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-right">
                                        <button
                                          onClick={() => handleDeleteSubscriber(idx)}
                                          className="text-clay-650 hover:text-clay-605 font-bold font-mono text-[10px] hover:underline cursor-pointer"
                                        >{pfUiT("ui.components.membermanagement.628ab37794")}</button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: PROFILE SETTINGS */}
                  {dashboardTab === 'profile' && (
                    <div className="space-y-6" id="tab-profile-content">

                      {/* Avatar & Profile Photo Management Section */}
                      <div className="bg-white border border-sand-250 rounded-[4px] p-5 space-y-4">
                        <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-clay-605" /> Profile Identity &amp; Portraits
                        </h5>

                        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                          {/* Left: Large Portrait display */}
                          <div className="flex flex-col items-center gap-2 select-none">
                            {currentUser.avatar ? (
                              <img
                                src={currentUser.avatar}
                                alt={currentUser.fullName}
                                className="w-20 h-20 rounded-full object-cover border-2 border-clay-550 shadow-md"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-20 h-20 bg-clay-100 text-clay-700 rounded-full flex items-center justify-center font-bold text-xl uppercase border-2 border-sand-300">
                                {currentUser.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-[9px] font-mono uppercase text-bark-400">{pfUiT("ui.components.membermanagement.a875f25091")}</span>
                          </div>

                          {/* Right: Upload controls & presets */}
                          <div className="flex-1 space-y-3 w-full">
                            <div className="flex flex-wrap gap-2 items-center">
                              {/* Direct File input button */}
                              <label className="bg-bark-900 hover:bg-bark-850 text-sand-50 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-3xs active:scale-[0.98]">
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>{pfUiT("ui.components.membermanagement.c16ad8bf47")}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleAvatarUpload}
                                  className="hidden"
                                />
                              </label>

                              {currentUser.avatar && (
                                <button
                                  onClick={() => setCurrentUser({ ...currentUser, avatar: '' })}
                                  className="text-clay-700 hover:text-clay-650 text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl border border-clay-200 bg-clay-50/30 cursor-pointer"
                                >{pfUiT("ui.components.membermanagement.6f6e5f2708")}</button>
                              )}
                            </div>

                            {/* Preset Avatar Pickers */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-mono text-bark-450 uppercase font-bold block">{pfUiT("ui.components.membermanagement.983cfb9d26")}</span>
                              <div className="flex gap-3">
                                {[
                                  { name: 'Model Sketch', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' },
                                  { name: 'Modern Maker', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80' },
                                  { name: 'Atelier Room', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80' },
                                  { name: 'Embroiderer', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80' }
                                ].map((preset, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCurrentUser({ ...currentUser, avatar: preset.url })}
                                    className={`relative group rounded-full overflow-hidden border-2 w-10 h-10 transition-all cursor-pointer ${
                                      currentUser.avatar === preset.url ? 'border-clay-605 ring-2 ring-clay-100' : 'border-sand-200 hover:border-sand-400'
                                    }`}
                                    title={preset.name}
                                  >
                                    <img
                                      src={preset.url}
                                      alt={preset.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      referrerPolicy="no-referrer"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Profile details management */}
                      <div className="bg-white border border-sand-250 rounded-[4px] p-5 space-y-4">
                        <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                          <User className="w-4 h-4 text-clay-605" />{pfUiT("ui.components.membermanagement.83b4bd2691")}</h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.4072a58439")}</label>
                            <input
                              type="text"
                              value={currentUser.fullName || ''}
                              onChange={(e) => setCurrentUser({...currentUser, fullName: e.target.value})}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                              placeholder={pfUiT("ui.components.membermanagement.92de6f025a")}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.215fb09eba")}</label>
                            <div className="relative border border-sand-200 rounded-xl bg-sand-50/30 flex items-center px-3 py-2 focus-within:border-clay-550 focus-within:bg-white transition-colors">
                              <span className="mr-1.5 text-xs font-bold text-clay-650">@</span>
                              <input
                                type="text"
                                value={currentUser.username || ''}
                                onChange={(e) => {
                                  const nextUsername = normalizeUsername(e.target.value);
                                  const validation = validateUsername(nextUsername, {
                                    currentUserId: currentUser.id || getStableUserId(currentUser)
                                  });
                                  if (!validation.valid && nextUsername) {
                                    setUsernameError(validation.message);
                                  } else {
                                    const nextUserId = currentUser.id || getStableUserId(currentUser);
                                    registerUsernameForUser(validation.username || nextUsername, nextUserId, {
                                      ...currentUser,
                                      source: 'member-management-profile'
                                    });
                                    setUsernameError('');
                                    setCurrentUser({
                                      ...currentUser,
                                      id: nextUserId,
                                      username: validation.username || nextUsername
                                    });
                                  }
                                }}
                                className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800 font-sans"
                                placeholder={pfUiT("ui.components.membermanagement.ec075f52ec")}
                              />
                            </div>
                            <p className={`text-[9px] ${usernameError ? 'text-rose-600' : 'text-bark-450'}`}>
                              {usernameError || 'Shown as your public messaging handle.'}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.0aacbce8f8")}</label>
                            <input
                              type="email"
                              value={currentUser.email || ''}
                              onChange={(e) => setCurrentUser({...currentUser, email: e.target.value})}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                              placeholder={pfUiT("ui.components.membermanagement.7945277074")}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.6d0de358cb")}</label>
                            <div className="relative border border-sand-200 rounded-xl bg-sand-50/30 flex items-center px-3 py-2 focus-within:border-clay-550 focus-within:bg-white transition-colors">
                              <Phone className="w-3.5 h-3.5 text-bark-400 mr-2" />
                              <input
                                type="text"
                                value={currentUser.phone || ''}
                                onChange={(e) => setCurrentUser({...currentUser, phone: e.target.value})}
                                className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800 font-sans"
                                placeholder="+33 6 45 92 01"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.550659cdfb")}</label>
                            <div className="relative border border-sand-200 rounded-xl bg-sand-50/30 flex items-center px-3 py-2 focus-within:border-clay-550 focus-within:bg-white transition-colors">
                              <MapPin className="w-3.5 h-3.5 text-bark-400 mr-2" />
                              <input
                                type="text"
                                value={currentUser.location || ''}
                                onChange={(e) => setCurrentUser({...currentUser, location: e.target.value})}
                                className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800 font-sans"
                                placeholder={pfUiT("ui.components.membermanagement.c787294804")}
                              />
                            </div>
                          </div>

                          {currentUser.role === 'collaborator' ? (
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.d6f62303cc")}</label>
                              <input
                                type="text"
                                value={currentUser.payoutMethod || ''}
                                onChange={(e) => setCurrentUser({...currentUser, payoutMethod: e.target.value})}
                                className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-mono"
                                placeholder={pfUiT("ui.components.membermanagement.d76644afd4")}
                              />
                            </div>
                          ) : (
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.196d167a71")}</label>
                              <input
                                type="text"
                                value={currentUser.shippingAddress || ''}
                                onChange={(e) => setCurrentUser({...currentUser, shippingAddress: e.target.value})}
                                className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                                placeholder={pfUiT("ui.components.membermanagement.ac38b6201d")}
                              />
                            </div>
                          )}

                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">{pfUiT("ui.components.membermanagement.e8f9cf7b23")}</label>
                            <textarea
                              rows={3}
                              value={currentUser.bio || ''}
                              onChange={(e) => setCurrentUser({...currentUser, bio: e.target.value})}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans leading-relaxed"
                              placeholder={pfUiT("ui.components.membermanagement.0705890b4e")}
                            />
                          </div>
                        </div>

                        {/* Sizing Integration connection for buyers only */}
                        {currentUser.role === 'buyer' && (
                          <div className="border-t border-sand-150 pt-4 space-y-2.5">
                            <h6 className="text-[11px] font-bold text-clay-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-clay-605" /> Calibration Metrics (Inches)
                            </h6>
                            <p className="text-[10px] text-bark-500 leading-normal">{pfUiT("ui.components.membermanagement.20da443f1f")}</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.membermanagement.7626e13e25")}</span>
                                <input
                                  type="number"
                                  value={currentUser.sizingProfile?.bust || 36}
                                  onChange={(e) => setCurrentUser({
                                    ...currentUser,
                                    sizingProfile: { ...currentUser.sizingProfile, bust: parseInt(e.target.value) || 0 }
                                  })}
                                  className="border border-sand-200 rounded-lg p-2 text-xs font-mono text-center w-full focus:outline-none focus:border-clay-550"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.membermanagement.d37283503b")}</span>
                                <input
                                  type="number"
                                  value={currentUser.sizingProfile?.waist || 28}
                                  onChange={(e) => setCurrentUser({
                                    ...currentUser,
                                    sizingProfile: { ...currentUser.sizingProfile, waist: parseInt(e.target.value) || 0 }
                                  })}
                                  className="border border-sand-200 rounded-lg p-2 text-xs font-mono text-center w-full focus:outline-none focus:border-clay-550"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono text-bark-450 block uppercase">{pfUiT("ui.components.membermanagement.1a69ae8979")}</span>
                                <input
                                  type="number"
                                  value={currentUser.sizingProfile?.hips || 38}
                                  onChange={(e) => setCurrentUser({
                                    ...currentUser,
                                    sizingProfile: { ...currentUser.sizingProfile, hips: parseInt(e.target.value) || 0 }
                                  })}
                                  className="border border-sand-200 rounded-lg p-2 text-xs font-mono text-center w-full focus:outline-none focus:border-clay-550"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <button
                            onClick={() => {
                              if (window.showToast) {
                                window.showToast("Your custom Atelier parameters have been successfully written to local cache!", "profile", "Profile Updated");
                              } else {
                                alert("Your custom Atelier parameters have been successfully written to local cache!");
                              }
                            }}
                            className="bg-bark-900 hover:bg-bark-850 text-sand-50 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer"
                          >{pfUiT("ui.components.membermanagement.683ae13eb8")}</button>
                        </div>
                      </div>

                      {/* Creation Showcase Gallery & Project Photo Showcases */}
                      <div className="bg-white border border-sand-250 rounded-[4px] p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-sand-100 pb-3">
                          <div>
                            <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Image className="w-4 h-4 text-clay-605" />{pfUiT("ui.components.membermanagement.98644c0348")}</h5>
                            <p className="text-[10px] text-bark-450 mt-1">{pfUiT("ui.components.membermanagement.9af0877b1f")}</p>
                          </div>
                        </div>

                        {/* Upload project photo form */}
                        <form onSubmit={handleAddProject} className="bg-sand-50/50 border border-sand-200 rounded-[4px] p-4 space-y-3">
                          <span className="text-[10px] font-mono text-bark-500 uppercase font-bold block">{pfUiT("ui.components.membermanagement.661d021800")}</span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.membermanagement.9f56b033a8")}</label>
                              <input
                                type="text"
                                value={newProjectCaption}
                                onChange={(e) => setNewProjectCaption(e.target.value)}
                                placeholder={pfUiT("ui.components.membermanagement.c40e7e9e12")}
                                className="border border-sand-250 rounded-lg px-2.5 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-bark-450 uppercase block">{pfUiT("ui.components.membermanagement.2232b82035")}</label>
                              <div className="flex items-center gap-2">
                                <label className="flex-1 bg-white border border-sand-250 hover:bg-sand-50 rounded-lg px-2.5 py-2 text-xs text-bark-650 cursor-pointer text-center truncate select-none">
                                  <span>{newProjectImage ? '✓ Photo selected!' : 'Browse image file...'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleProjectPhotoUpload}
                                    className="hidden"
                                  />
                                </label>

                                {newProjectImage && (
                                  <button
                                    type="button"
                                    onClick={() => setNewProjectImage('')}
                                    className="text-clay-650 font-bold text-xs hover:underline"
                                  >{pfUiT("ui.components.membermanagement.b034bcb0d7")}</button>
                                )}
                              </div>
                            </div>
                          </div>

                          {newProjectImage && (
                            <div className="p-2 border border-dashed border-sand-200 rounded-lg max-w-[120px]">
                              <img src={newProjectImage} alt={pfUiT("ui.components.membermanagement.cda79b065c")} className="w-24 h-24 object-cover rounded" />
                              <span className="text-[8px] text-center text-bark-400 block mt-1">{pfUiT("ui.components.membermanagement.9d3e57f31e")}</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            className="bg-clay-650 hover:bg-clay-600 text-white px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors"
                          >{pfUiT("ui.components.membermanagement.7532a2a5c4")}</button>
                        </form>

                        {/* Gallery List of projects */}
                        <div className="space-y-3 pt-2">
                          <h6 className="text-[10px] font-mono text-bark-500 uppercase font-bold">{pfUiT("ui.components.membermanagement.84c630bb17")}</h6>
                          {(!currentUser.creationGallery || currentUser.creationGallery.length === 0) ? (
                            <p className="text-xs text-bark-450 italic py-4">{pfUiT("ui.components.membermanagement.5f01981625")}</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {currentUser.creationGallery.map((imgItem) => (
                                <div key={imgItem.id} className="relative group border border-sand-200 rounded-[4px] overflow-hidden bg-white shadow-3xs hover:shadow-sm transition-all">
                                  <div className="aspect-square bg-sand-100 overflow-hidden relative">
                                    <img
                                      src={imgItem.url}
                                      alt={imgItem.caption}
                                      className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                                      referrerPolicy="no-referrer"
                                    />

                                    {/* Absolute delete button */}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveProject(imgItem.id)}
                                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-clay-50 text-bark-600 hover:text-clay-605 shadow-3xs cursor-pointer border border-sand-200"
                                      title={pfUiT("ui.components.membermanagement.b337cb3052")}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <div className="p-2 bg-sand-50/50">
                                    <p className="text-[10px] font-semibold text-bark-850 truncate leading-tight" title={imgItem.caption}>
                                      {imgItem.caption}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Logout option */}
                      <div className="pt-4 border-t border-sand-200 flex justify-end">
                        <button
                          onClick={() => {
                            setCurrentUser(null);
                            onLogout && onLogout();
                            onClose();
                          }}
                          className="bg-clay-50 hover:bg-clay-100 text-clay-700 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border border-clay-200/50 cursor-pointer"
                        >{pfUiT("ui.components.membermanagement.1836952364")}</button>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </motion.div>

        </div>
      )}
    </AnimatePresence>
  );
}
