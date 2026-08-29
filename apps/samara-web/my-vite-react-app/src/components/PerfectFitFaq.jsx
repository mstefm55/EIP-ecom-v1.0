import React, { useState, useMemo } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, HelpCircle, ChevronDown, Printer, Scissors,
  Truck, ThumbsUp, MessageSquare, Check, BookOpen,
  Info, Globe, Sparkles, Layers, Send
} from 'lucide-react';

const FAQ_DATA = [
  // Category: Fabric Choices
  {
    id: 'fab-1',
    category: 'fabric',
    question: 'How do I choose the correct fabric weight for my sewing pattern?',
    answer: 'Each pattern catalog card displays recommended fiber content and weights. In general, structured garments like trench coats require medium-to-heavyweight woven fabrics (such as double-sided wool, waxed canvas, or heavy linen), while cowl-neck slip dresses perform beautifully with lightweight fabrics featuring soft, fluid drapery (such as silk crepe de chine, cupro, or sandwashed viscose). Pairing structural designs with fluid fabrics or vice-versa will alter the silhouette entirely.',
    helpfulCount: 24,
    tags: ['Fabric Weight', 'Drape', 'Fiber Content']
  },
  {
    id: 'fab-2',
    category: 'fabric',
    question: 'Should I pre-wash my fabric before cutting into the pattern pieces?',
    answer: 'Absolutely. Almost all natural fibers (cotton, linen, wool, and silk) shrink upon their first exposure to heat and water. We advise washing and drying your fabric using the exact same cycle you intend to use for the finished garment. For premium silks and wools, steam-pressing with an iron is highly recommended as a gentler alternative if you intend to only dry-clean the final garment.',
    helpfulCount: 42,
    tags: ['Pre-washing', 'Shrinkage', 'Fabric Care']
  },
  {
    id: 'fab-3',
    category: 'fabric',
    question: 'How do I adjust the calculated yardage for plaid or directional nap prints?',
    answer: 'When working with velvets, satins, cords, or distinct plaid designs, you must layout all pattern pieces in a single direction (the "nap" direction) so the light reflects uniformly on the fibers. For plaids and stripes, you also need extra horizontal space to line up seams. Our Pattern Yardage & Bolt Calculator features an integrated option to automatically apply a +12% safety margin for directional nap fabrics and +22% for complex plaids.',
    helpfulCount: 19,
    tags: ['Pattern Matching', 'Plaids', 'Nap Layout']
  },
  {
    id: 'fab-4',
    category: 'fabric',
    question: 'What is the difference between knit and woven fabrics in sizing?',
    answer: 'Woven fabrics have negligible stretch and require ease built into the pattern for breathing room. Knit fabrics stretch and conform to the body, often requiring "negative ease" (the garment measurements are smaller than your physical body metrics). Woven patterns should not be substituted with high-stretch knits unless you plan to size down significantly, as this will lead to bagging and a loose silhouette.',
    helpfulCount: 15,
    tags: ['Knit vs Woven', 'Negative Ease', 'Sizing Adjustments']
  },

  // Category: Digital Pattern Printing
  {
    id: 'prt-1',
    category: 'printing',
    question: 'How do I print a digital PDF pattern so it remains 100% true to scale?',
    answer: 'When opening your PDF file (ideally in Adobe Acrobat Reader), navigate to the Print dialog. You must set the scaling to "Actual Size" or "Custom Scale: 100%". Never select "Fit to Page" or "Shrink Oversized Pages", as this will scale down your pattern. Every digital pattern download includes a 2-inch (or 5-cm) calibration test square on the first page—always print only Page 1 first, measure this square with a physical ruler, and verify calibration before printing the full blueprint stack.',
    helpfulCount: 56,
    tags: ['Calibration', 'Acrobat Reader', 'Printer Settings']
  },
  {
    id: 'prt-2',
    category: 'printing',
    question: 'What paper sizes are supported for the digital pattern files?',
    answer: 'Our digital pattern files are multi-format packages. Every download includes: 1) A nested US Letter & A4 print-at-home file (where page margins align perfectly for home printers), and 2) A large-format A0 Copyshop file. You can send the A0 file to local copy centers or online pattern printers (like PDFplotting or Patternsy) to have the entire layout printed on single continuous sheets of tissue, completely avoiding home assembly and taping.',
    helpfulCount: 31,
    tags: ['Paper Formats', 'A0 Copyshop', 'A4 / Letter']
  },
  {
    id: 'prt-3',
    category: 'printing',
    question: 'How do I assemble and tape my print-at-home pages together?',
    answer: 'Our print-at-home grids are framed by matching numbered circular alignment marks and crosshairs. Do not cut all margins. Instead, trim only the right and bottom margins of each page, then overlap them on top of the untrimmed left and top margins of the adjacent pages. Match up the crosshair targets precisely and secure with clear tape. Work row-by-row for the cleanest finish, then cut out the designated pattern pieces.',
    helpfulCount: 28,
    tags: ['PDF Assembly', 'Taping Pages', 'Crosshairs']
  },

  // Category: Perfect Fit Shipping Policies
  {
    id: 'shp-1',
    category: 'shipping',
    question: 'What are the delivery times and options for physical tissue pattern orders?',
    answer: 'We dispatch all physical pattern orders from our flagship bureau within 24–48 business hours. For domestic shipping, standard ground shipping takes 3–5 business days, while express courier shipping arrives in 1–2 business days. Physical orders are packaged with exquisite attention to detail inside archival cream cardboard boxes to ensure your blueprints are safe from elements.',
    helpfulCount: 18,
    tags: ['Shipping Times', 'Tissue Patterns', 'Packaging']
  },
  {
    id: 'shp-2',
    category: 'shipping',
    question: 'Do you ship internationally, and how are customs and import duties handled?',
    answer: 'Yes, we offer worldwide shipping. For international orders, duties and local taxes are dynamically calculated and fully paid at checkout (DDP - Delivered Duty Paid) for most regions (including the EU, UK, Canada, and Australia). This ensures your shipment is cleared through customs seamlessly without unexpected local courier fees upon delivery.',
    helpfulCount: 22,
    tags: ['International', 'Customs & Duties', 'DDP Shipping']
  },
  {
    id: 'shp-3',
    category: 'shipping',
    question: 'How can I track my physical delivery order?',
    answer: 'The moment your package is registered with the courier, an email containing your secure tracking link and SMS details will be automatically sent. You can also view the active shipping state and courier logs in the "My Purchased Orders" section of your client workspace whenever you are logged in.',
    helpfulCount: 14,
    tags: ['Order Tracking', 'Client Dashboard', 'Shipping Confirmation']
  },
  {
    id: 'shp-4',
    category: 'shipping',
    question: 'Do you offer carbon-neutral shipping options?',
    answer: 'Yes, 100% of our domestic and international shipments are carbon-neutral. We offset the transport emissions of every package through verified investments in forestry and renewable energy initiatives. Additionally, all pattern packaging utilizes FSC-certified recycled cardstock printed with eco-friendly soy-based inks.',
    helpfulCount: 37,
    tags: ['Sustainability', 'Carbon Neutral', 'Eco Packaging']
  }
];

export default function PerfectFitFaq() {
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'fabric' | 'printing' | 'shipping'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState(null);

  // Local state to track helpful feedback clicks
  const [clickedHelpful, setClickedHelpful] = useState({}); // { [faqId]: true }

  // Custom user-submitted questions list
  const [userQuestions, setUserQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionCategory, setNewQuestionCategory] = useState('fabric');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Filter FAQs based on active category and search input
  const filteredFaqs = useMemo(() => {
    // Combine standard FAQs with user-submitted ones
    const allFaqs = [...FAQ_DATA, ...userQuestions];

    return allFaqs.filter((faq) => {
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch =
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, userQuestions]);

  const handleHelpfulClick = (faqId) => {
    if (clickedHelpful[faqId]) return; // prevent multiple clicks
    setClickedHelpful(prev => ({
      ...prev,
      [faqId]: true
    }));

    // Show user feedback via global toast if available
    if (window.showToast) {
      window.showToast('Thank you for your feedback! Your rating makes our knowledge base better.', 'success');
    }
  };

  const handleToggleFaq = (id) => {
    setExpandedFaqId(prevId => prevId === id ? null : id);
  };

  const handleCustomQuestionSubmit = (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const newFaq = {
      id: `user-${Date.now()}`,
      category: newQuestionCategory,
      question: newQuestionText,
      answer: 'Our lead dressmakers and customer support specialists are reviewing this question. We typically post full technical resolutions here within 2 business hours!',
      helpfulCount: 0,
      tags: ['Pending Review', 'Community'],
      isUserSubmitted: true
    };

    setUserQuestions(prev => [newFaq, ...prev]);
    setNewQuestionText('');
    setSubmitSuccess(true);
    setExpandedFaqId(newFaq.id); // Expand the newly created question automatically to show pending state

    if (window.showToast) {
      window.showToast('Your custom question has been submitted to the Perfect Fit specialists!', 'success');
    }

    setTimeout(() => {
      setSubmitSuccess(false);
    }, 4000);
  };

  return (
    <section className="bg-white rounded-[4px] border border-sand-200 p-6 md:p-10 space-y-8 shadow-lux relative overflow-hidden text-left" id="perfect-fit-faq-section">
      {/* Background blueprint elements */}
      <div className="absolute right-0 top-0 w-48 h-48 opacity-[0.02] bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />
      <div className="absolute left-0 bottom-0 w-48 h-48 opacity-[0.02] bg-[radial-gradient(#887857_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

      {/* Title Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3 relative z-10" id="faq-header">
        <h2 className="text-2xl md:text-3xl font-serif text-bark-950 font-light leading-tight" id="faq-title">
          Curated Knowledge &amp; Tailoring FAQ
        </h2>
        <p className="text-xs text-bark-550 max-w-lg mx-auto" id="faq-desc">{pfUiT("ui.components.perfectfitfaq.59b3155343")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10" id="faq-layout-grid">

        {/* Left Interactive & Filter Panel (4 columns) */}
        <div className="lg:col-span-4 space-y-6" id="faq-sidebar">

          {/* Realtime Search Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest block">{pfUiT("ui.components.perfectfitfaq.56de4a9ccf")}</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-bark-400" />
              <input
                type="text"
                placeholder={pfUiT("ui.components.perfectfitfaq.b39485eb67")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-sand-200 rounded text-xs bg-white text-bark-800 focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-bark-400 hover:text-bark-700 font-mono"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-bark-500 uppercase tracking-widest block">{pfUiT("ui.components.perfectfitfaq.0c896e5316")}</label>
            <div className="flex flex-col gap-1.5" id="faq-categories-container">
              <button
                onClick={() => { setActiveCategory('all'); setExpandedFaqId(null); }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-[4px] border text-xs font-medium transition-all text-left cursor-pointer ${
                  activeCategory === 'all'
                    ? 'border-clay-500 bg-clay-50/10 text-bark-900 font-bold shadow-3xs'
                    : 'border-sand-200/65 bg-white text-bark-600 hover:bg-sand-50/40 hover:border-sand-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-bark-500" />{pfUiT("ui.components.perfectfitfaq.c175e6cc3e")}</span>
                <span className="text-[9px] font-mono bg-sand-100 px-1.5 py-0.2 rounded font-bold">
                  {FAQ_DATA.length + userQuestions.length}
                </span>
              </button>

              <button
                onClick={() => { setActiveCategory('fabric'); setExpandedFaqId(null); }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-[4px] border text-xs font-medium transition-all text-left cursor-pointer ${
                  activeCategory === 'fabric'
                    ? 'border-clay-500 bg-clay-50/10 text-bark-900 font-bold shadow-3xs'
                    : 'border-sand-200/65 bg-white text-bark-600 hover:bg-sand-50/40 hover:border-sand-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Scissors className="w-3.5 h-3.5 text-clay-605" /> Fabric Choices &amp; Prep
                </span>
                <span className="text-[9px] font-mono bg-sand-100 px-1.5 py-0.2 rounded font-bold">
                  {[...FAQ_DATA, ...userQuestions].filter(f => f.category === 'fabric').length}
                </span>
              </button>

              <button
                onClick={() => { setActiveCategory('printing'); setExpandedFaqId(null); }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-[4px] border text-xs font-medium transition-all text-left cursor-pointer ${
                  activeCategory === 'printing'
                    ? 'border-clay-500 bg-clay-50/10 text-bark-900 font-bold shadow-3xs'
                    : 'border-sand-200/65 bg-white text-bark-600 hover:bg-sand-50/40 hover:border-sand-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Printer className="w-3.5 h-3.5 text-[#e0a894]" />{pfUiT("ui.components.perfectfitfaq.34076919b4")}</span>
                <span className="text-[9px] font-mono bg-sand-100 px-1.5 py-0.2 rounded font-bold">
                  {[...FAQ_DATA, ...userQuestions].filter(f => f.category === 'printing').length}
                </span>
              </button>

              <button
                onClick={() => { setActiveCategory('shipping'); setExpandedFaqId(null); }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-[4px] border text-xs font-medium transition-all text-left cursor-pointer ${
                  activeCategory === 'shipping'
                    ? 'border-clay-500 bg-clay-50/10 text-bark-900 font-bold shadow-3xs'
                    : 'border-sand-200/65 bg-white text-bark-600 hover:bg-sand-50/40 hover:border-sand-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-bark-800" /> Delivery &amp; Shipping
                </span>
                <span className="text-[9px] font-mono bg-sand-100 px-1.5 py-0.2 rounded font-bold">
                  {[...FAQ_DATA, ...userQuestions].filter(f => f.category === 'shipping').length}
                </span>
              </button>
            </div>
          </div>

          {/* Quick Informational Tip Card */}
          <div className="bg-sand-50/40 border border-sand-200 rounded p-4 space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-clay-700 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />{pfUiT("ui.components.perfectfitfaq.b42ba7e1c4")}</div>
            <p className="text-[10.5px] text-bark-550 leading-relaxed font-sans">{pfUiT("ui.components.perfectfitfaq.51c2a61ce0")}</p>
          </div>

        </div>

        {/* Right Accordion & Custom Form (8 columns) */}
        <div className="lg:col-span-8 space-y-6" id="faq-content-area">

          {/* Main FAQ Accordion */}
          <div className="space-y-3" id="faq-accordion-list">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => {
                const isOpen = expandedFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`border rounded-[4px] overflow-hidden transition-all duration-300 ${
                      isOpen
                        ? 'border-clay-500 bg-white shadow-3xs'
                        : 'border-sand-200/80 bg-white hover:border-sand-350 hover:bg-sand-50/10'
                    }`}
                  >
                    {/* Accordion Trigger */}
                    <button
                      onClick={() => handleToggleFaq(faq.id)}
                      className="w-full flex items-center justify-between p-4 text-left transition-all cursor-pointer font-sans text-xs font-semibold text-bark-900 focus:outline-none"
                    >
                      <span className="flex items-start gap-3">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                          faq.category === 'fabric' ? 'bg-clay-550' : faq.category === 'printing' ? 'bg-amber-450' : 'bg-bark-850'
                        }`} />
                        <span className="leading-snug">{faq.question}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-bark-400 flex-shrink-0 ml-4 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-clay-605' : ''
                      }`} />
                    </button>

                    {/* Expandable Panel */}
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                        >
                          <div className="px-4 pb-4 pt-1 border-t border-sand-150 space-y-3">
                            {/* Tags section */}
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[8px] font-mono uppercase bg-sand-100 text-bark-600 px-1.5 py-0.2 rounded font-bold">
                                {faq.category}
                              </span>
                              {faq.tags.map((t, idx) => (
                                <span key={idx} className="text-[8px] font-mono uppercase bg-clay-50 text-clay-700 px-1.5 py-0.2 rounded font-medium">
                                  #{t}
                                </span>
                              ))}
                            </div>

                            {/* Answer Text */}
                            <p className="text-xs text-bark-700 leading-relaxed font-sans">
                              {faq.answer}
                            </p>

                            {/* Answer Rating Box */}
                            <div className="pt-3 border-t border-sand-150/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-bark-500 font-sans">
                              <span className="flex items-center gap-1.5">
                                <Info className="w-3 h-3 text-bark-400" />
                                {faq.isUserSubmitted
                                  ? 'This is a pending custom inquiry.'
                                  : 'Expert review verified by Master Perfect Fit Cutters.'}
                              </span>

                              <button
                                onClick={() => handleHelpfulClick(faq.id)}
                                className={`px-2 py-1 rounded-[3px] border transition-all flex items-center gap-1 cursor-pointer font-medium ${
                                  clickedHelpful[faq.id]
                                    ? 'bg-clay-50 border-clay-300 text-clay-700 font-bold'
                                    : 'border-sand-200 bg-white text-bark-600 hover:border-sand-300 hover:text-bark-900'
                                }`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                {clickedHelpful[faq.id] ? (
                                  <span>Helpful ({faq.helpfulCount + 1})</span>
                                ) : (
                                  <span>Was this helpful? ({faq.helpfulCount})</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 bg-sand-50/20 border border-dashed border-sand-250 rounded-[4px] space-y-2">
                <p className="text-xs text-bark-500 font-medium">No results matched your search query "{searchQuery}".</p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                  className="text-[10px] font-mono text-clay-650 hover:text-clay-605 font-bold uppercase tracking-wider underline cursor-pointer"
                >{pfUiT("ui.components.perfectfitfaq.95b976dd54")}</button>
              </div>
            )}
          </div>

          {/* Submit Custom Question Form */}
          <div className="bg-sand-50/35 border border-sand-200 rounded-[4px] p-5 space-y-4" id="faq-custom-form-container">
            <div className="space-y-1">
              <h4 className="text-sm font-serif font-semibold text-bark-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-clay-605" />{pfUiT("ui.components.perfectfitfaq.3064ae4bf2")}</h4>
              <p className="text-[10.5px] text-bark-550">{pfUiT("ui.components.perfectfitfaq.b2ee100cde")}</p>
            </div>

            <form onSubmit={handleCustomQuestionSubmit} className="space-y-3" id="faq-custom-form">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">

                {/* Category select */}
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider block">{pfUiT("ui.components.perfectfitfaq.247bb8203a")}</label>
                  <select
                    value={newQuestionCategory}
                    onChange={(e) => setNewQuestionCategory(e.target.value)}
                    className="w-full text-xs bg-white border border-sand-200 rounded-[4px] p-2 font-medium text-bark-800 focus:border-clay-400 focus:outline-hidden cursor-pointer h-9"
                  >
                    <option value="fabric">{pfUiT("ui.components.perfectfitfaq.a51fcfb651")}</option>
                    <option value="printing">{pfUiT("ui.components.perfectfitfaq.f4f107d773")}</option>
                    <option value="shipping">{pfUiT("ui.components.perfectfitfaq.f61cdcfc6e")}</option>
                  </select>
                </div>

                {/* Question input */}
                <div className="sm:col-span-8 space-y-1">
                  <label className="text-[9px] font-mono font-bold text-bark-500 uppercase tracking-wider block">{pfUiT("ui.components.perfectfitfaq.0de08d029a")}</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder={pfUiT("ui.components.perfectfitfaq.15c76084e6")}
                      value={newQuestionText}
                      onChange={(e) => setNewQuestionText(e.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded text-xs bg-white text-bark-800 focus:ring-1 focus:ring-clay-500 focus:border-clay-500 font-sans h-9 pr-10"
                    />
                    <button
                      type="submit"
                      className="absolute right-1 top-1 bg-bark-900 hover:bg-clay-605 text-sand-50 w-7 h-7 rounded flex items-center justify-center transition-colors cursor-pointer"
                      title={pfUiT("ui.components.perfectfitfaq.a5d5be8561")}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>

              {submitSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50 border border-emerald-200 rounded p-2 text-[10.5px] text-emerald-800 flex items-center gap-2"
                >
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{pfUiT("ui.components.perfectfitfaq.ac44d15749")}</span>
                </motion.div>
              )}
            </form>
          </div>

        </div>

      </div>

    </section>
  );
}
