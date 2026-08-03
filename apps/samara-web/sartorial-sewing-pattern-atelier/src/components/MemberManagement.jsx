import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Mail, Lock, Shield, CreditCard, DollarSign, PlusCircle,
  Trash2, Search, CheckCircle, Tag, ShoppingBag, Eye, LogIn,
  Sparkles, Award, FileText, ChevronRight, Check, Key,
  Camera, UploadCloud, Image, MapPin, Phone
} from 'lucide-react';
import CollaboratorSalesDashboard from './CollaboratorSalesDashboard';
import ErpSyncDashboard from './ErpSyncDashboard';

// Pre-seeded account states for a fluid interactive demonstration
const INITIAL_COLLABORATOR = {
  fullName: 'Margot Leone',
  email: 'margot@atelier.com',
  role: 'collaborator',
  tier: 'Gold Artisan Seller',
  payoutMethod: 'PayPal (leone.atelier@design.com)',
  phone: '+33 6 45 92 01',
  location: 'Paris, France',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80',
  bio: 'High-fashion custom dressmaker with 12 years of pattern draping experience. Focused on eco-responsible fabrics, organic linen, and historical French reconstructions.',
  creationGallery: [
    { id: 'cg-1', url: 'https://images.unsplash.com/photo-1566207274740-0f8cf6b7d5a5?auto=format&fit=crop&w=300&q=80', caption: 'Linen Aurelia wrap dress in emerald sage' },
    { id: 'cg-2', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80', caption: 'Fitted Bodice sample in soft cotton toile' }
  ],
  patterns: [
    { id: 'collab-p1', name: 'Renaissance Pleated Bodice', pricePDF: 15.0, pricePrinted: 25.0, salesCount: 19, isListed: true },
    { id: 'collab-p2', name: 'Aurelia Wrap Dress (Atelier Mod)', pricePDF: 14.0, pricePrinted: 24.0, salesCount: 24, isListed: true },
    { id: 'collab-p3', name: 'Chantilly Silk Slip Dress', pricePDF: 12.0, pricePrinted: 21.0, salesCount: 8, isListed: false }
  ],
  salesHistory: [
    { id: 'TXN-901', date: '2026-06-28', buyer: 'Julien Sorel', patternName: 'Aurelia Wrap Dress (Atelier Mod)', format: 'PDF', gross: 14.00, commission: 2.10, net: 11.90 },
    { id: 'TXN-902', date: '2026-06-25', buyer: 'Eleanor Vance', patternName: 'Renaissance Pleated Bodice', format: 'Printed', gross: 25.00, commission: 3.75, net: 21.25 },
    { id: 'TXN-903', date: '2026-06-20', buyer: 'Julien Sorel', patternName: 'Renaissance Pleated Bodice', format: 'PDF', gross: 15.00, commission: 2.25, net: 12.75 },
    { id: 'TXN-904', date: '2026-06-18', buyer: 'Thérèse Raquin', patternName: 'Aurelia Wrap Dress (Atelier Mod)', format: 'Printed', gross: 24.00, commission: 3.60, net: 20.40 },
    { id: 'TXN-905', date: '2026-06-10', buyer: 'Genevieve Vane', patternName: 'Chantilly Silk Slip Dress', format: 'PDF', gross: 12.00, commission: 1.80, net: 10.20 },
    { id: 'TXN-906', date: '2026-06-03', buyer: 'Clara Oswald', patternName: 'Renaissance Pleated Bodice', format: 'PDF', gross: 15.00, commission: 2.25, net: 12.75 }
  ]
};

const INITIAL_BUYER = {
  fullName: 'Arthur Dent',
  email: 'arthur.dent@galaxy.com',
  role: 'buyer',
  tier: 'Atelier Gold Member',
  discountPercent: 15,
  couponCode: 'ARTISAN15',
  shippingAddress: '42 Heart of Gold Way, London, UK',
  phone: '+44 7911 123456',
  location: 'London, UK',
  avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
  bio: 'Amateur tailoring enthusiast, learning to stitch structured coats and trousers. Inspired by mid-century European designs and sustainable slow-fashion guides.',
  creationGallery: [
    { id: 'cg-3', url: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=300&q=80', caption: 'My first Palazzo wide-leg trousers finished in soft grey wool!' }
  ],
  sizingProfile: { bust: 36, waist: 28, hips: 38 },
  purchaseHistory: [
    { id: 'ORD-701', date: '2026-05-15', patternName: 'Palazzo Wide-Leg Trouser', format: 'PDF', price: 13.00, status: 'Downloaded' },
    { id: 'ORD-702', date: '2026-05-20', patternName: 'Aurelia Wrap Dress', format: 'Printed', price: 24.00, status: 'Shipped (Tracking: #SART-98402)' }
  ]
};

const INITIAL_ADMINISTRATOR = {
  fullName: 'Executive Administrator',
  email: 'admin@atelier.com',
  role: 'administrator',
  tier: 'System Chief Admin',
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
  bio: 'Atelier Core Operations Director. Authorized privileges to modify metadata rendering models, alter database layouts, and configure strict login walls.',
  creationGallery: []
};

export default function MemberManagement({
  onLoginSuccess,
  onLogout,
  currentUser,
  setCurrentUser,
  isOpen,
  onClose,
  patterns = []
}) {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState('buyer'); // 'buyer' or 'collaborator'

  // Tab within Dashboard
  const [dashboardTab, setDashboardTab] = useState('overview'); // 'overview' | 'listings' | 'sales' | 'profile'

  // New Listing creation form
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternPDFPrice, setNewPatternPDFPrice] = useState('12.00');
  const [newPatternPrintedPrice, setNewPatternPrintedPrice] = useState('22.00');
  const [newPatternCategory, setNewPatternCategory] = useState('Dresses');
  const [newPatternDescription, setNewPatternDescription] = useState('');

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
        const saved = localStorage.getItem('sartorial_newsletter_subscribers');
        if (saved) {
          setSubscribers(JSON.parse(saved));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  const handleDeleteSubscriber = (indexToDelete) => {
    const subToDelete = subscribers[indexToDelete];
    if (window.confirm(`Are you sure you want to retract "${subToDelete.email}" from the Atelier mailing registry?`)) {
      const updated = subscribers.filter((_, idx) => idx !== indexToDelete);
      setSubscribers(updated);
      try {
        localStorage.setItem('sartorial_newsletter_subscribers', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Load user status or sync
  const handleSignIn = (e) => {
    e.preventDefault();
    if (!email || !password) return;

    // Direct demonstration credentials bypass or custom logins
    if (email.toLowerCase().includes('admin')) {
      setCurrentUser(INITIAL_ADMINISTRATOR);
      onLoginSuccess && onLoginSuccess(INITIAL_ADMINISTRATOR);
    } else if (email.toLowerCase().includes('atelier') || email.toLowerCase().includes('margot')) {
      // Login as Margot Leone (Collaborator)
      setCurrentUser(INITIAL_COLLABORATOR);
      onLoginSuccess && onLoginSuccess(INITIAL_COLLABORATOR);
    } else {
      // Login as Arthur Dent (Regular Buyer)
      const user = {
        ...INITIAL_BUYER,
        email: email,
        fullName: fullName || email.split('@')[0].toUpperCase()
      };
      setCurrentUser(user);
      onLoginSuccess && onLoginSuccess(user);
    }
    // reset form
    setEmail('');
    setPassword('');
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    if (!email || !fullName) return;

    let newUser = {};
    if (selectedRole === 'collaborator') {
      newUser = {
        ...INITIAL_COLLABORATOR,
        fullName: fullName,
        email: email,
        role: 'collaborator'
      };
    } else {
      newUser = {
        ...INITIAL_BUYER,
        fullName: fullName,
        email: email,
        role: 'buyer'
      };
    }

    setCurrentUser(newUser);
    onLoginSuccess && onLoginSuccess(newUser);
    setIsSignUpMode(false);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  const switchDemoAccount = (role) => {
    if (role === 'administrator') {
      setCurrentUser(INITIAL_ADMINISTRATOR);
      onLoginSuccess && onLoginSuccess(INITIAL_ADMINISTRATOR);
    } else if (role === 'collaborator') {
      setCurrentUser(INITIAL_COLLABORATOR);
      onLoginSuccess && onLoginSuccess(INITIAL_COLLABORATOR);
    } else {
      setCurrentUser(INITIAL_BUYER);
      onLoginSuccess && onLoginSuccess(INITIAL_BUYER);
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

  // Add customized pattern
  const handleAddPattern = (e) => {
    e.preventDefault();
    if (!newPatternName) return;

    const newPattern = {
      id: `collab-p${Date.now()}`,
      name: newPatternName,
      pricePDF: parseFloat(newPatternPDFPrice) || 12.0,
      pricePrinted: parseFloat(newPatternPrintedPrice) || 22.0,
      salesCount: 0,
      isListed: true
    };

    const updatedUser = {
      ...currentUser,
      patterns: [newPattern, ...(currentUser.patterns || [])]
    };

    setCurrentUser(updatedUser);
    setNewPatternName('');
    setNewPatternDescription('');

    // Alert nicely
    if (window.showToast) {
      window.showToast(`Successfully listed "${newPatternName}" in the Atelier Catalog! It is now active for sales.`, "success", "Design Listed");
    } else {
      alert(`Successfully listed "${newPatternName}" in the Atelier Catalog! It is now active for sales.`);
    }
  };

  const toggleListingActive = (id) => {
    const updatedPatterns = currentUser.patterns.map(p =>
      p.id === id ? { ...p, isListed: !p.isListed } : p
    );
    setCurrentUser({
      ...currentUser,
      patterns: updatedPatterns
    });
  };

  const deleteListing = (id) => {
    if (window.confirm("Are you sure you want to retract this garment blueprint from the public platform?")) {
      const updatedPatterns = currentUser.patterns.filter(p => p.id !== id);
      setCurrentUser({
        ...currentUser,
        patterns: updatedPatterns
      });
    }
  };

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
        <div className="fixed inset-0 bg-bark-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto" id="auth-modal-overlay">

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white border border-sand-300 w-full max-w-4xl rounded-[4px] overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            id="auth-modal-frame"
          >
            {/* Sidebar Branding and Demo helper */}
            <div className="md:w-72 bg-gradient-to-br from-bark-900 to-bark-950 text-sand-50 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-sand-800/30" id="auth-modal-left">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-clay-400 font-mono">Atelier Portal</span>
                  <h3 className="text-xl font-serif text-white font-medium tracking-wide mt-1">Atelier Membership</h3>
                  <p className="text-[11px] text-sand-300/80 leading-relaxed mt-2">
                    Access premium tailor gazettes, calibration templates, and professional pattern creator dashboards.
                  </p>
                </div>

                {!currentUser && (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-[4px] space-y-2.5" id="demo-quick-login">
                    <span className="text-[10px] font-mono uppercase text-clay-300 font-bold block tracking-wider">✦ Interactive Demo Bypass ✦</span>
                    <p className="text-[10px] text-sand-300 leading-normal">
                      Click below to instant-login with fully pre-seeded dashboards representing actual users.
                    </p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        onClick={() => switchDemoAccount('administrator')}
                        className="bg-bark-900 hover:bg-bark-850 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-left flex items-center justify-between border border-white/20"
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-clay-500"></span>
                          <span>Login: System Administrator</span>
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
                        <span>Login: Regular Buyer</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[9px] text-sand-400/80 leading-normal pt-4 border-t border-sand-800/20">
                Authorized secure authentication environment. Perfect Fit Bureau strictly respects privacy, layout accuracy, and organic slow-fashion guidelines.
              </div>
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
                        <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">Full Name</label>
                        <div className="relative border border-sand-250 rounded-xl bg-white flex items-center px-3 py-2.5 focus-within:border-clay-550 transition-colors">
                          <User className="w-4 h-4 text-bark-400 mr-2" />
                          <input
                            type="text"
                            required
                            placeholder="Margot Leone"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">Email Address</label>
                      <div className="relative border border-sand-250 rounded-xl bg-white flex items-center px-3 py-2.5 focus-within:border-clay-550 transition-colors">
                        <Mail className="w-4 h-4 text-bark-400 mr-2" />
                        <input
                          type="email"
                          required
                          placeholder="name@atelier.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">Secure Password</label>
                      <div className="relative border border-sand-250 rounded-xl bg-white flex items-center px-3 py-2.5 focus-within:border-clay-550 transition-colors">
                        <Lock className="w-4 h-4 text-bark-400 mr-2" />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800"
                        />
                      </div>
                    </div>

                    {isSignUpMode && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-bark-500 font-bold block">Account Privilege Profile</label>
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
                            <span className="text-xs font-bold text-bark-900 block">Regular Buyer</span>
                            <span className="text-[9px] text-bark-500 block leading-tight mt-1">
                              Get 15% discount, view orders, and unlock VIP tailoring contents.
                            </span>
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
                            <span className="text-xs font-bold text-bark-900 block">Collaborator / Seller</span>
                            <span className="text-[9px] text-bark-500 block leading-tight mt-1">
                              Post own patterns for sales, manage payouts, and track earnings with 15% fee.
                            </span>
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
                      onClick={() => setIsSignUpMode(!isSignUpMode)}
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
                    >
                      Workspace Overview
                    </button>

                    {currentUser.role === 'collaborator' ? (
                      <>
                        <button
                          onClick={() => setDashboardTab('listings')}
                          className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            dashboardTab === 'listings' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                          }`}
                        >
                          My Displayed Patterns
                        </button>
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
                        >
                          Mailing Register
                        </button>
                        <button
                          onClick={() => setDashboardTab('erp-sync')}
                          className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                            dashboardTab === 'erp-sync' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                          }`}
                          id="tab-erp-sync-btn"
                        >
                          ERP Content Sync
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDashboardTab('sales')}
                        className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                          dashboardTab === 'sales' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                        }`}
                      >
                        My Order History
                      </button>
                    )}

                    <button
                      onClick={() => setDashboardTab('profile')}
                      className={`pb-2.5 text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                        dashboardTab === 'profile' ? 'text-bark-900 border-b-2 border-bark-900 font-bold' : 'text-bark-450 hover:text-bark-900'
                      }`}
                    >
                      Account Settings
                    </button>
                  </div>

                  {/* TAB 1: OVERVIEW */}
                  {dashboardTab === 'overview' && (
                    <div className="space-y-6" id="tab-overview-content">
                      {currentUser.role === 'collaborator' ? (
                        /* COLLABORATOR FINANCIAL METRICS */
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                            <div className="p-4 bg-clay-50/50 border border-clay-100 rounded-[4px] space-y-1.5" id="metric-gross">
                              <span className="text-[10px] font-mono text-bark-450 uppercase tracking-widest font-bold block">Gross Money Made</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold text-clay-700">${totalSalesGross.toFixed(2)}</span>
                                <span className="text-[10px] text-bark-400 font-mono">USD</span>
                              </div>
                              <span className="text-[9px] text-bark-500 block">From total listed garments</span>
                            </div>

                            <div className="p-4 bg-sand-100/30 border border-sand-200 rounded-[4px] space-y-1.5" id="metric-referral">
                              <span className="text-[10px] font-mono text-bark-450 uppercase tracking-widest font-bold block">Referral/Platform Fee</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold text-bark-800">${totalCommission.toFixed(2)}</span>
                                <span className="text-[10px] text-bark-400 font-mono">15% Fee</span>
                              </div>
                              <span className="text-[9px] text-bark-500 block">Deducted on checkout referral</span>
                            </div>

                            <div className="p-4 bg-emerald-50/30 border border-emerald-100 rounded-[4px] space-y-1.5" id="metric-net">
                              <span className="text-[10px] font-mono text-bark-450 uppercase tracking-widest font-bold block">Net Income</span>
                              <div className="flex items-baseline gap-1">
                                <span className="font-serif text-2xl font-bold text-emerald-800">${totalNetEarnings.toFixed(2)}</span>
                                <span className="text-[10px] text-bark-400 font-mono">Payout Ready</span>
                              </div>
                              <span className="text-[9px] text-emerald-700 font-medium block">✦ Sent to PayPal automatically</span>
                            </div>

                          </div>

                          {/* Quick details */}
                          <div className="bg-white border border-sand-200 rounded-[4px] p-5 space-y-3">
                            <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider">Seller Portfolio Stats</h5>
                            <div className="grid grid-cols-2 gap-4 text-xs font-sans text-bark-600">
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">Total Created Blueprints</span>
                                <strong className="text-bark-950 font-semibold">{currentUser.patterns?.length || 0} Listed Items</strong>
                              </div>
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">Guild Connection Rank</span>
                                <strong className="text-clay-700 font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Award className="w-3.5 h-3.5" /> Gold Artisan Partner
                                </strong>
                              </div>
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">Primary Payout Method</span>
                                <span className="font-mono text-[11px] text-bark-800">{currentUser.payoutMethod || 'None registered'}</span>
                              </div>
                              <div>
                                <span className="text-bark-400 block text-[10px] uppercase font-mono">Atelier Referral Rating</span>
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
                                <span className="text-[10px] uppercase tracking-widest text-clay-300 font-mono font-bold">
                                  System Operations Centre
                                </span>
                              </div>

                              <h3 className="text-xl font-serif text-white font-medium leading-tight">
                                Administrator Privilege Level Activated
                              </h3>

                              <p className="text-xs text-sand-300 max-w-md leading-relaxed">
                                Welcome, {currentUser.fullName}! You have complete administrative credentials over the Perfect Fit Bureau. Toggle rendering modes, edit layout metadata database models, and enforce login constraints instantly.
                              </p>
                            </div>
                          </div>

                          <div className="p-4 bg-clay-50 border border-clay-200 rounded-[4px] space-y-2">
                            <span className="text-[10px] font-mono text-clay-800 uppercase font-bold block">✦ Administrative Instructions ✦</span>
                            <p className="text-xs text-bark-650 leading-relaxed">
                              Use the main **Dynamic Layout Hub** displayed on the workspace homepage to configure live layout schemas and manage application state parameters in real time.
                            </p>
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

                              <h3 className="text-xl font-serif text-white font-medium leading-tight">
                                Privileged Buyer Club Active
                              </h3>

                              <p className="text-xs text-sand-300 max-w-md leading-relaxed">
                                Welcome back, {currentUser.fullName}! As a regular buyer, you enjoy **{currentUser.discountPercent}% off all pattern purchases**, instant access to premium tutorials, and seasonal sewing handbook directories.
                              </p>

                              <div className="pt-2 flex items-center gap-2">
                                <span className="text-[10px] font-mono bg-white/10 text-white border border-white/20 px-3 py-1 rounded-lg">
                                  Active Checkout Code: <b className="font-mono text-amber-300">{currentUser.couponCode}</b>
                                </span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(currentUser.couponCode);
                                    alert('Discount promo copied!');
                                  }}
                                  className="bg-sand-50 hover:bg-sand-100 text-bark-950 text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                                >
                                  Copy Code
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Sizing Integration connection */}
                          <div className="bg-clay-50/40 border border-clay-100 rounded-[4px] p-5 space-y-3">
                            <h5 className="text-xs font-bold text-clay-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-clay-605" /> Personalized Calibration Metrics
                            </h5>
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

                  {/* TAB 2: MY LISTED PATTERNS (COLLABORATORS ONLY) */}
                  {dashboardTab === 'listings' && currentUser.role === 'collaborator' && (
                    <div className="space-y-6" id="tab-listings-content">

                      {/* Form to Post New Pattern */}
                      <div className="bg-white border border-sand-250 rounded-[4px] p-5 space-y-4">
                        <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-2">
                          <PlusCircle className="w-4 h-4 text-clay-605" /> List a New Garment Pattern for Sale
                        </h5>

                        <form onSubmit={handleAddPattern} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Pattern Name</label>
                            <input
                              type="text"
                              required
                              placeholder="Renaissance Pleated Bodice"
                              value={newPatternName}
                              onChange={(e) => setNewPatternName(e.target.value)}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Category</label>
                            <select
                              value={newPatternCategory}
                              onChange={(e) => setNewPatternCategory(e.target.value)}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-white"
                            >
                              <option>Dresses</option>
                              <option>Outerwear</option>
                              <option>Trousers</option>
                              <option>Tops</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">PDF Price ($ USD)</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="12.00"
                              value={newPatternPDFPrice}
                              onChange={(e) => setNewPatternPDFPrice(e.target.value)}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Printed Pattern Price ($ USD)</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="22.00"
                              value={newPatternPrintedPrice}
                              onChange={(e) => setNewPatternPrintedPrice(e.target.value)}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30"
                            />
                          </div>

                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Short Design Description</label>
                            <textarea
                              rows={2}
                              placeholder="Describe the fabric requirements, pleats structure, or seam styles..."
                              value={newPatternDescription}
                              onChange={(e) => setNewPatternDescription(e.target.value)}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                            />
                          </div>

                          <div className="sm:col-span-2 pt-2">
                            <button
                              type="submit"
                              className="bg-clay-650 hover:bg-clay-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors"
                            >
                              Publish to Perfect Fit Shop (15% Referral Fee)
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Displayed patterns list */}
                      <div className="space-y-3">
                        <h6 className="text-xs font-bold text-bark-900 uppercase tracking-wider">Active Pattern Sales Catalog</h6>
                        <div className="space-y-3" id="active-patterns-catalog">
                          {currentUser.patterns?.map((pat) => (
                            <div
                              key={pat.id}
                              className={`p-4 rounded-[4px] border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                                pat.isListed ? 'bg-white border-sand-200' : 'bg-sand-100/50 border-sand-150 opacity-70'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <strong className="text-xs font-bold text-bark-900 block">{pat.name}</strong>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                                    pat.isListed ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-sand-200 text-bark-500'
                                  }`}>
                                    {pat.isListed ? 'Listed/Active' : 'Retracted/Draft'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-bark-500 font-mono">
                                  PDF: ${pat.pricePDF.toFixed(2)} | Printed: ${pat.pricePrinted.toFixed(2)} | <b>{pat.salesCount} purchases registered</b>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleListingActive(pat.id)}
                                  className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                    pat.isListed
                                      ? 'bg-sand-50 hover:bg-sand-100 text-bark-750 border-sand-200'
                                      : 'bg-bark-900 hover:bg-bark-850 text-sand-50 border-bark-900'
                                  }`}
                                >
                                  {pat.isListed ? 'Deactivate' : 'Activate Sale'}
                                </button>

                                <button
                                  onClick={() => deleteListing(pat.id)}
                                  className="p-1.5 text-bark-400 hover:text-clay-650 hover:bg-clay-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-clay-100"
                                  title="Delete Listing"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
                          <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider">My Sewing Blueprint Purchases</h5>

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
                                    <span>Status: <b>{ord.status}</b></span>
                                  </div>

                                  <div className="flex gap-2">
                                    {ord.format === 'PDF' ? (
                                      <button
                                        onClick={() => alert(`Initiating direct high-resolution secure download for "${ord.patternName}" blueprint pack (contains A0, A4, Sizing guides).`)}
                                        className="bg-bark-900 hover:bg-bark-800 text-sand-50 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                      >
                                        Download PDF Pack
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => alert(`Redirecting to Perfect Fit Postal Tracking Portal for signature tissue-paper parcel #SART-98402.`)}
                                        className="bg-sand-100 hover:bg-sand-200 text-bark-800 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors border border-sand-250 cursor-pointer"
                                      >
                                        Track Parcel Shipments
                                      </button>
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
                              <Mail className="w-4 h-4 text-clay-605" /> Captured Newsletter Mailing Registry
                            </h5>
                            <p className="text-[10px] text-bark-450 mt-1">
                              View sewing enthusiasts who joined the newsletter register across the desktop footer and mobile app mockups.
                            </p>
                          </div>

                          {/* Total count badge */}
                          <div className="bg-clay-50 border border-clay-200/50 rounded-md px-2.5 py-1 text-center shrink-0">
                            <span className="text-[9px] font-mono text-clay-505 block uppercase">Total Subscribers</span>
                            <span className="text-xs font-bold font-mono text-clay-705">
                              {subscribers.length} Active
                            </span>
                          </div>
                        </div>

                        {/* Subscribers list */}
                        {subscribers.length === 0 ? (
                          <p className="text-xs text-bark-450 italic py-8 text-center">No active newsletter subscribers registered yet.</p>
                        ) : (
                          <div className="space-y-3" id="subscribers-list-records">
                            <div className="border border-sand-200 rounded-[4px] overflow-hidden bg-white shadow-3xs overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                                <thead>
                                  <tr className="bg-sand-50 border-b border-sand-200 text-bark-500 font-mono text-[9px] uppercase tracking-wider">
                                    <th className="p-3 font-semibold">Subscriber Email</th>
                                    <th className="p-3 font-semibold">Registered Timestamp</th>
                                    <th className="p-3 font-semibold">Capture Source</th>
                                    <th className="p-3 font-semibold text-right">Actions</th>
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
                                        >
                                          Remove
                                        </button>
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

                  {/* TAB: ERP CONTENT SYNC DASHBOARD */}
                  {dashboardTab === 'erp-sync' && currentUser.role === 'collaborator' && (
                    <div className="space-y-6" id="tab-erp-sync-content">
                      <ErpSyncDashboard patterns={patterns} />
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
                            <span className="text-[9px] font-mono uppercase text-bark-400">Current Avatar</span>
                          </div>

                          {/* Right: Upload controls & presets */}
                          <div className="flex-1 space-y-3 w-full">
                            <div className="flex flex-wrap gap-2 items-center">
                              {/* Direct File input button */}
                              <label className="bg-bark-900 hover:bg-bark-850 text-sand-50 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-3xs active:scale-[0.98]">
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>Upload Custom Portrait</span>
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
                                >
                                  Remove Photo
                                </button>
                              )}
                            </div>

                            {/* Preset Avatar Pickers */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-mono text-bark-450 uppercase font-bold block">Or select an Atelier Classic Sketch:</span>
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
                          <User className="w-4 h-4 text-clay-605" /> Personal Atelier Details
                        </h5>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Display Full Name</label>
                            <input
                              type="text"
                              value={currentUser.fullName || ''}
                              onChange={(e) => setCurrentUser({...currentUser, fullName: e.target.value})}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                              placeholder="Full Name"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Billing / Contact Email</label>
                            <input
                              type="email"
                              value={currentUser.email || ''}
                              onChange={(e) => setCurrentUser({...currentUser, email: e.target.value})}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                              placeholder="name@atelier.com"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Phone Number</label>
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
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Location / Region</label>
                            <div className="relative border border-sand-200 rounded-xl bg-sand-50/30 flex items-center px-3 py-2 focus-within:border-clay-550 focus-within:bg-white transition-colors">
                              <MapPin className="w-3.5 h-3.5 text-bark-400 mr-2" />
                              <input
                                type="text"
                                value={currentUser.location || ''}
                                onChange={(e) => setCurrentUser({...currentUser, location: e.target.value})}
                                className="bg-transparent border-none text-xs w-full focus:outline-none text-bark-800 font-sans"
                                placeholder="Paris, France"
                              />
                            </div>
                          </div>

                          {currentUser.role === 'collaborator' ? (
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">PayPal / Bank Payout Address</label>
                              <input
                                type="text"
                                value={currentUser.payoutMethod || ''}
                                onChange={(e) => setCurrentUser({...currentUser, payoutMethod: e.target.value})}
                                className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-mono"
                                placeholder="payout.email@domain.com"
                              />
                            </div>
                          ) : (
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Shipping Delivery Address</label>
                              <input
                                type="text"
                                value={currentUser.shippingAddress || ''}
                                onChange={(e) => setCurrentUser({...currentUser, shippingAddress: e.target.value})}
                                className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans"
                                placeholder="Full street address for printed pattern deliveries"
                              />
                            </div>
                          )}

                          <div className="sm:col-span-2 space-y-1">
                            <label className="text-[10px] font-mono text-bark-500 uppercase tracking-wider font-bold">Creative Biography / Statement</label>
                            <textarea
                              rows={3}
                              value={currentUser.bio || ''}
                              onChange={(e) => setCurrentUser({...currentUser, bio: e.target.value})}
                              className="border border-sand-200 rounded-xl px-3 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-sand-50/30 font-sans leading-relaxed"
                              placeholder="Write a few lines about your tailoring level, fabric favorites, or sewing machine setups..."
                            />
                          </div>
                        </div>

                        {/* Sizing Integration connection for buyers only */}
                        {currentUser.role === 'buyer' && (
                          <div className="border-t border-sand-150 pt-4 space-y-2.5">
                            <h6 className="text-[11px] font-bold text-clay-700 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-clay-605" /> Calibration Metrics (Inches)
                            </h6>
                            <p className="text-[10px] text-bark-500 leading-normal">
                              Adjusting these parameters will update the interactive size advisor database for all blueprint catalog previews.
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <span className="text-[9px] font-mono text-bark-450 block uppercase">Bust Width</span>
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
                                <span className="text-[9px] font-mono text-bark-450 block uppercase">Waist Width</span>
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
                                <span className="text-[9px] font-mono text-bark-450 block uppercase">Hips Width</span>
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
                          >
                            Save Core Account Details
                          </button>
                        </div>
                      </div>

                      {/* Creation Showcase Gallery & Project Photo Showcases */}
                      <div className="bg-white border border-sand-250 rounded-[4px] p-5 space-y-4">
                        <div className="flex justify-between items-center border-b border-sand-100 pb-3">
                          <div>
                            <h5 className="text-xs font-bold text-bark-900 uppercase tracking-wider flex items-center gap-1.5">
                              <Image className="w-4 h-4 text-clay-605" /> Atelier Creations Showcase
                            </h5>
                            <p className="text-[10px] text-bark-450 mt-1">
                              Post completed garment photographs to build your public tailor catalog portfolio.
                            </p>
                          </div>
                        </div>

                        {/* Upload project photo form */}
                        <form onSubmit={handleAddProject} className="bg-sand-50/50 border border-sand-200 rounded-[4px] p-4 space-y-3">
                          <span className="text-[10px] font-mono text-bark-500 uppercase font-bold block">✦ Add a New Finished Project Photo:</span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-bark-450 uppercase block">Project Caption / Title</label>
                              <input
                                type="text"
                                value={newProjectCaption}
                                onChange={(e) => setNewProjectCaption(e.target.value)}
                                placeholder="My Linen Aurelia Dress in Olive Sage"
                                className="border border-sand-250 rounded-lg px-2.5 py-2 text-xs w-full focus:outline-none focus:border-clay-500 bg-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-mono text-bark-450 uppercase block">Select Garment Photo File</label>
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
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {newProjectImage && (
                            <div className="p-2 border border-dashed border-sand-200 rounded-lg max-w-[120px]">
                              <img src={newProjectImage} alt="Preview" className="w-24 h-24 object-cover rounded" />
                              <span className="text-[8px] text-center text-bark-400 block mt-1">Ready to post</span>
                            </div>
                          )}

                          <button
                            type="submit"
                            className="bg-clay-650 hover:bg-clay-600 text-white px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors"
                          >
                            Publish Photo to Showcase
                          </button>
                        </form>

                        {/* Gallery List of projects */}
                        <div className="space-y-3 pt-2">
                          <h6 className="text-[10px] font-mono text-bark-500 uppercase font-bold">My Portfolio Photos:</h6>
                          {(!currentUser.creationGallery || currentUser.creationGallery.length === 0) ? (
                            <p className="text-xs text-bark-450 italic py-4">No portfolio images posted yet. Upload your first dress/coat finished project above!</p>
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
                                      title="Delete Photo"
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
                        >
                          Sign Out of Atelier
                        </button>
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
