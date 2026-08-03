import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star, ChevronLeft, ChevronRight, Quote, Sparkles,
  Camera, Heart, Plus, Check, Scissors, AlertCircle, RefreshCw
} from 'lucide-react';

const INITIAL_TESTIMONIALS = [
  {
    id: 'testi-1',
    author: '@GenevieveSews',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    patternName: 'Aurelia Wrap Dress',
    caption: 'My Aurelia Dress in washed emerald midweight linen. Fits like a glove!',
    comment: 'The French seam finish instructions are a absolute masterpiece. Sizing calculator recommended a size 8 and it fits beautifully without any modifications.',
    fabric: 'Belgian Emerald Linen',
    size: '8',
    rating: 5,
    likes: 54,
    liked: false
  },
  {
    id: 'testi-2',
    author: '@Arthur_Tailored',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
    patternName: 'Atelier Utility Trench',
    caption: 'Spent 25 hours on this utility trench in olive cotton gabardine.',
    comment: 'Take your time with the double welt pockets and collar stand! Basting first is key to getting crisp points. Hands down the most professional draft I have ever sewn.',
    fabric: 'Olive Cotton Gabardine',
    size: '12',
    rating: 5,
    likes: 89,
    liked: false
  },
  {
    id: 'testi-3',
    author: '@Beatrice_Loves_Linen',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80',
    image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=800&q=80',
    patternName: 'Palazzo Wide-Leg Trouser',
    caption: 'My navy suiting version of the Palazzo pants. So elegant for the office.',
    comment: 'The contour waistband drafting is perfect. No gaping at the back whatsoever! Added the 2-inch let-down hem for heels. Very flattering drape.',
    fabric: 'Worsted Wool Suiting Crepe',
    size: '10',
    rating: 5,
    likes: 73,
    liked: false
  },
  {
    id: 'testi-4',
    author: '@Sienna_V_Sews',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80',
    image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
    patternName: 'Luminary Asymmetric Drape Blouse',
    caption: 'Minimalist asymmetric drape collar in mulberry sandwashed silk.',
    comment: 'Be careful with the bias cut edges around the neckline—they stretch easily. Use stay tape as recommended! The visual steps were incredibly helpful.',
    fabric: 'Mulberry Silk Satin',
    size: '4',
    rating: 5,
    likes: 62,
    liked: false
  },
  {
    id: 'testi-5',
    author: '@Clara_M_Atelier',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
    patternName: 'Aurelia Wrap Dress',
    caption: 'Styled as a summer cover-up in semi-sheer cotton gauze.',
    comment: 'Omitted the interior secure button for a more relaxed, beachy throw-on feel. Beautifully drafted wrap ties that offer versatile styling options.',
    fabric: 'Double-crinkle Cotton Gauze',
    size: '6',
    rating: 4,
    likes: 41,
    liked: false
  }
];

export default function TestimonialCarousel() {
  const [testimonials, setTestimonials] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_testimonials');
      return saved ? JSON.parse(saved) : INITIAL_TESTIMONIALS;
    } catch {
      return INITIAL_TESTIMONIALS;
    }
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const autoPlayRef = useRef(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPattern, setFormPattern] = useState('Aurelia Wrap Dress');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [formFabric, setFormFabric] = useState('');
  const [formSize, setFormSize] = useState('8');
  const [formImage, setFormImage] = useState('');
  const [formCaption, setFormCaption] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('sartorial_testimonials', JSON.stringify(testimonials));
    } catch (e) {
      console.error(e);
    }
  }, [testimonials]);

  // Handle Autoplay timer
  useEffect(() => {
    if (isPlaying && !showAddForm) {
      autoPlayRef.current = setInterval(() => {
        handleNext();
      }, 6000);
    }
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isPlaying, currentIndex, showAddForm, testimonials.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleToggleLike = (id) => {
    setTestimonials((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            likes: t.liked ? t.likes - 1 : t.likes + 1,
            liked: !t.liked
          };
        }
        return t;
      })
    );
  };

  const handleAddTestimonial = (e) => {
    e.preventDefault();
    if (!formName || !formComment || !formFabric) {
      setFormError('Please fill in your name, comment, and fabric used.');
      return;
    }

    const defaultImg = 'https://images.unsplash.com/photo-1524250502761-1ac6f2e30d43?auto=format&fit=crop&w=800&q=80';
    const cleanImg = formImage.trim() || defaultImg;

    const newTestimonial = {
      id: `testi-${Date.now()}`,
      author: formName.startsWith('@') ? formName : `@${formName.replace(/\s+/g, '')}`,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
      image: cleanImg,
      patternName: formPattern,
      caption: formCaption.trim() || `My finished project in ${formFabric}`,
      comment: formComment,
      fabric: formFabric,
      size: formSize,
      rating: formRating,
      likes: 0,
      liked: false
    };

    setTestimonials((prev) => [newTestimonial, ...prev]);
    setCurrentIndex(0);
    setFormSuccess(true);
    setFormError('');

    // Reset form fields
    setFormName('');
    setFormComment('');
    setFormFabric('');
    setFormImage('');
    setFormCaption('');

    setTimeout(() => {
      setFormSuccess(false);
      setShowAddForm(false);
    }, 2500);
  };

  const activeTestimonial = testimonials[currentIndex] || testimonials[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full bg-sand-50/60 border border-sand-200/50 rounded-xl p-6 md:p-10 space-y-8"
      id="testimonials-carousel-container"
    >
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" id="testimonials-header">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-clay-600 font-mono text-[10px] uppercase tracking-widest font-bold">
            <Sparkles className="w-3.5 h-3.5 text-clay-500" />
            <span>Community Showroom & Social Proof</span>
          </div>
          <h3 className="font-serif text-2xl md:text-3xl text-bark-900 tracking-tight">
            Atelier Creations in the Wild
          </h3>
          <p className="text-xs text-bark-500 max-w-xl">
            Real finished garments made by our talented global community of makers. Browse fabric recommendations, fit reviews, and finished project snapshots.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setIsPlaying(showAddForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-clay-600 hover:bg-clay-700 text-sand-50 text-xs font-sans font-medium rounded-[4px] shadow-xs hover:shadow transition-all duration-300 self-start md:self-auto cursor-pointer"
          id="toggle-testimonial-form-btn"
        >
          {showAddForm ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Back to Carousel</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>Share Your Masterpiece</span>
            </>
          )}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!showAddForm ? (
          <motion.div
            key="carousel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
            onMouseEnter={() => setIsPlaying(false)}
            onMouseLeave={() => setIsPlaying(true)}
            id="testimonial-carousel-slide"
          >
            {/* Visual Column - Customer's garment */}
            <div className="lg:col-span-5 flex flex-col justify-between" id="testimonial-image-column">
              <div className="relative aspect-[3/4] w-full rounded-lg overflow-hidden shadow-md bg-sand-200 group border border-sand-200/50">
                <img
                  src={activeTestimonial.image}
                  alt={activeTestimonial.caption}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />

                {/* Image overlay details */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5">
                  <div className="space-y-1.5 text-white">
                    <span className="text-[10px] font-mono uppercase bg-clay-600/90 text-sand-100 px-2 py-0.5 rounded-full inline-block tracking-wider">
                      {activeTestimonial.patternName}
                    </span>
                    <p className="text-sm font-serif italic text-sand-100 leading-snug">
                      "{activeTestimonial.caption}"
                    </p>

                    <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2 text-[10px] text-sand-200 font-sans">
                      <div className="flex gap-4">
                        <span>Fabric: <strong className="text-white">{activeTestimonial.fabric}</strong></span>
                        <span>Size: <strong className="text-white">{activeTestimonial.size}</strong></span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleLike(activeTestimonial.id);
                        }}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                          activeTestimonial.liked ? 'text-rose-400' : 'text-sand-300 hover:text-rose-400'
                        }`}
                        id={`like-btn-${activeTestimonial.id}`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${activeTestimonial.liked ? 'fill-current' : ''}`} />
                        <span className="font-mono">{activeTestimonial.likes}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Testimonial detail & quote column */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6 lg:pl-4" id="testimonial-review-column">
              <div className="space-y-6">
                {/* Rating and quotes icon */}
                <div className="flex justify-between items-center" id="testimonial-rating-row">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < activeTestimonial.rating
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-sand-300'
                        }`}
                      />
                    ))}
                  </div>
                  <Quote className="w-10 h-10 text-clay-200 rotate-180" />
                </div>

                {/* Main feedback comment */}
                <blockquote className="space-y-3">
                  <p className="font-serif text-lg md:text-xl text-bark-900 leading-relaxed italic">
                    "{activeTestimonial.comment}"
                  </p>
                </blockquote>

                {/* Author profile and target */}
                <div className="flex items-center gap-3.5 pt-4 border-t border-sand-200" id="testimonial-author-row">
                  <img
                    src={activeTestimonial.avatar}
                    alt={activeTestimonial.author}
                    className="w-11 h-11 rounded-full object-cover border border-sand-300"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h5 className="font-sans font-semibold text-bark-900 text-sm">{activeTestimonial.author}</h5>
                    <div className="flex items-center gap-2 text-bark-500 text-[11px] font-sans mt-0.5">
                      <span>Verified Maker</span>
                      <span className="w-1 h-1 rounded-full bg-sand-300"></span>
                      <span className="flex items-center gap-0.5 text-clay-600">
                        <Scissors className="w-3 h-3" />
                        {activeTestimonial.patternName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation controls */}
              <div className="flex items-center justify-between pt-6 border-t border-sand-200" id="testimonial-controls">
                {/* Progress Indicators / Dots */}
                <div className="flex items-center gap-2" id="testimonial-dots">
                  {testimonials.map((t, idx) => (
                    <button
                      key={t.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-1.5 rounded-full transition-all duration-350 cursor-pointer ${
                        currentIndex === idx ? 'w-6 bg-clay-600' : 'w-1.5 bg-sand-300 hover:bg-sand-400'
                      }`}
                      title={`Go to testimonial ${idx + 1}`}
                      id={`dot-btn-${idx}`}
                    />
                  ))}
                </div>

                {/* Prev / Next buttons */}
                <div className="flex items-center gap-2" id="testimonial-arrows">
                  <button
                    onClick={handlePrev}
                    className="p-2 border border-sand-200 rounded-[4px] bg-white text-bark-700 hover:bg-sand-100 hover:text-bark-900 transition-colors shadow-xs hover:shadow-sm cursor-pointer"
                    aria-label="Previous Testimonial"
                    id="prev-testimonial-btn"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-2 border border-sand-200 rounded-[4px] bg-white text-bark-700 hover:bg-sand-100 hover:text-bark-900 transition-colors shadow-xs hover:shadow-sm cursor-pointer"
                    aria-label="Next Testimonial"
                    id="next-testimonial-btn"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto bg-white border border-sand-200 rounded-lg p-6 shadow-sm"
            id="share-masterpiece-form-container"
          >
            <div className="text-center space-y-2 mb-6" id="form-header-intro">
              <h4 className="font-serif text-lg text-bark-900">Share Your Masterpiece</h4>
              <p className="text-xs text-bark-500">
                Inspire other sewists around the globe. Share your completed projects, styling tips, and sizing advice.
              </p>
            </div>

            {formSuccess ? (
              <div className="py-8 text-center space-y-3" id="form-success-view">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto" id="success-icon-badge">
                  <Check className="w-6 h-6" />
                </div>
                <h5 className="font-sans font-semibold text-bark-950 text-sm">Thank You for Sharing!</h5>
                <p className="text-xs text-bark-500 max-w-sm mx-auto">
                  Your finished pattern creation has been registered and added to our live social proof carousel slides!
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddTestimonial} className="space-y-4" id="masterpiece-form">
                {formError && (
                  <div className="p-3 rounded bg-rose-50 border border-rose-100 text-rose-700 text-xs flex gap-2 items-start" id="form-error-banner">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4" id="form-row-1">
                  <div className="space-y-1.5" id="form-group-name">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                      Your Name or Instagram Handle *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. @AliceSews or Alice M."
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                      required
                    />
                  </div>

                  <div className="space-y-1.5" id="form-group-pattern">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                      Sewing Pattern *
                    </label>
                    <select
                      value={formPattern}
                      onChange={(e) => setFormPattern(e.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                    >
                      <option value="Aurelia Wrap Dress">Aurelia Wrap Dress</option>
                      <option value="Atelier Utility Trench">Atelier Utility Trench</option>
                      <option value="Palazzo Wide-Leg Trouser">Palazzo Wide-Leg Trouser</option>
                      <option value="Luminary Asymmetric Drape Blouse">Luminary Asymmetric Drape Blouse</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3" id="form-row-2">
                  <div className="space-y-1.5" id="form-group-fabric">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                      Fabric Material *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Soft Oatmeal Linen"
                      value={formFabric}
                      onChange={(e) => setFormFabric(e.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                      required
                    />
                  </div>

                  <div className="space-y-1.5" id="form-group-size">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                      Size Crafted
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 8"
                      value={formSize}
                      onChange={(e) => setFormSize(e.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                    />
                  </div>

                  <div className="space-y-1.5" id="form-group-rating">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                      Overall Experience
                    </label>
                    <div className="flex items-center gap-1 py-1.5" id="form-rating-stars">
                      {[1, 2, 3, 4, 5].map((starValue) => (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => setFormRating(starValue)}
                          className="text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                          id={`star-btn-${starValue}`}
                        >
                          <Star className={`w-4 h-4 ${starValue <= formRating ? 'fill-current' : 'text-sand-200'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5" id="form-group-image">
                  <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold flex justify-between">
                    <span>Finished Project Photo URL</span>
                    <span className="text-sand-400 normal-case italic font-normal">Optional (will use seed if empty)</span>
                  </label>
                  <div className="relative flex items-center" id="image-url-input-wrapper">
                    <Camera className="absolute left-3 w-4 h-4 text-bark-400" />
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/photo-..."
                      value={formImage}
                      onChange={(e) => setFormImage(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5" id="form-group-caption">
                  <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                    Short Photo Caption
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Aurelia wrap midi styled for beach weddings"
                    value={formCaption}
                    onChange={(e) => setFormCaption(e.target.value)}
                    className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                  />
                </div>

                <div className="space-y-1.5" id="form-group-comment">
                  <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">
                    Detailed Review & Fitting Advice *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe how the assembly went. Any sizing adjustments made? How was the instruction manual?"
                    value={formComment}
                    onChange={(e) => setFormComment(e.target.value)}
                    className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800 resize-none"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2" id="form-actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setIsPlaying(true);
                    }}
                    className="px-4 py-2 border border-sand-200 hover:bg-sand-50 text-bark-700 text-xs font-sans rounded cursor-pointer"
                    id="cancel-testimonial-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-clay-650 hover:bg-clay-700 text-sand-50 text-xs font-sans font-medium rounded shadow-xs hover:shadow-sm transition-all cursor-pointer"
                    id="submit-testimonial-btn"
                  >
                    Submit Project
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
