import { createClientRecordId } from '../lib/runtimeDataGateway';
import { useRuntimeCollectionState, useRuntimeState } from '../context/RuntimeDataContext';
import { RUNTIME_DOMAINS } from '../lib/runtimeDomainContracts';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Quote,
  RefreshCw,
  Scissors,
  Star,
  Trash2
} from 'lucide-react';
import ImageAssetStudioModal from './ImageAssetStudioModal';
import { eipCommunityApi, isEipApiConfigured } from '../lib/eipApiAdapter';

const FEEDBACK_IMAGE_STUDIO_PROFILES = Object.freeze([
  {
    id: 'community-feedback',
    label: 'Community feedback',
    description: 'Finished-project image used across Perfect Fit community surfaces.',
    width: 1600,
    height: 900,
    fitMode: 'cover',
    mimeType: 'image/jpeg',
    quality: 92,
    backgroundColor: '#f4f1eb'
  }
]);

const normalizeText = (value) => String(value || '').trim();

const slugify = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const initialsFor = (value) => {
  const parts = normalizeText(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
};

function legacyTestimonialToCommunityPost(item = {}) {
  const patternName = normalizeText(item.patternName || item.targetName) || 'Community creation';
  return {
    id: item.id || createClientRecordId('community-post'),
    type: 'creation',
    source: 'legacy-testimonial',
    targetId: item.targetId || `community:${slugify(patternName) || 'creation'}`,
    targetName: patternName,
    author: normalizeText(item.author) || '@PerfectFitMember',
    avatar: normalizeText(item.avatar),
    rating: Number(item.rating) || 5,
    title: normalizeText(item.caption || item.title) || `Made from ${patternName}`,
    caption: normalizeText(item.caption),
    comment: normalizeText(item.comment),
    fabric: normalizeText(item.fabric) || undefined,
    size: normalizeText(item.size) || undefined,
    difficulty: normalizeText(item.difficulty) || undefined,
    image: normalizeText(item.image) || undefined,
    date: item.date || item.createdAt || new Date().toISOString().split('T')[0],
    likes: Number(item.likes) || 0,
    liked: Boolean(item.liked),
    tips: normalizeText(item.tips || item.comment) || undefined,
    replies: Array.isArray(item.replies) ? item.replies : [],
    featured: false
  };
}

function communityPostToTestimonial(post = {}) {
  return {
    ...post,
    patternName: normalizeText(post.targetName || post.patternName) || 'Community creation',
    caption: normalizeText(post.caption || post.title) || 'Community finished project',
    comment: normalizeText(post.comment || post.tips),
    fabric: normalizeText(post.fabric),
    size: normalizeText(post.size),
    image: normalizeText(post.image),
    author: normalizeText(post.author) || '@PerfectFitMember',
    avatar: normalizeText(post.avatar),
    rating: Number(post.rating) || 5,
    likes: Number(post.likes) || 0,
    liked: Boolean(post.liked)
  };
}

export default function TestimonialCarousel({
  sectionId = 'testimonials-section',
  kicker = 'From Pattern Draft to Finished Garment',
  title = 'Our Creations in the Wild',
  subtitle = 'Brought to life by the meticulous hands of our community members.'
}) {
  const [communityPosts, setCommunityPosts] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.COMMUNITY_POSTS,
    []
  );
  const [legacyTestimonials, setLegacyTestimonials] = useRuntimeCollectionState(
    RUNTIME_DOMAINS.TESTIMONIALS,
    []
  );
  const [currentUser] = useRuntimeState(RUNTIME_DOMAINS.USER_PROFILE, null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const autoPlayRef = useRef(null);

  const [formName, setFormName] = useState('');
  const [formPattern, setFormPattern] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [formFabric, setFormFabric] = useState('');
  const [formSize, setFormSize] = useState('8');
  const [formCaption, setFormCaption] = useState('');
  const [formImageFile, setFormImageFile] = useState(null);
  const [formImagePreviewUrl, setFormImagePreviewUrl] = useState('');
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [imageStudioSourceFile, setImageStudioSourceFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const testimonials = useMemo(
    () => communityPosts
      .filter((post) => post?.type === 'creation' && normalizeText(post?.image))
      .map(communityPostToTestimonial),
    [communityPosts]
  );

  useEffect(() => {
    if (!legacyTestimonials.length) return;

    setCommunityPosts((current) => {
      const ids = new Set(current.map((item) => String(item?.id || '')));
      const migrated = legacyTestimonials
        .map(legacyTestimonialToCommunityPost)
        .filter((item) => !ids.has(String(item.id)));
      return migrated.length ? [...migrated, ...current] : current;
    });
    setLegacyTestimonials([]);
  }, [legacyTestimonials, setCommunityPosts, setLegacyTestimonials]);

  useEffect(() => {
    const memberName = normalizeText(
      currentUser?.fullName || currentUser?.username || currentUser?.email
    );
    if (memberName && !formName) setFormName(memberName);
  }, [currentUser, formName]);

  useEffect(() => {
    if (!formImageFile) {
      setFormImagePreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(formImageFile);
    setFormImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [formImageFile]);

  useEffect(() => {
    if (currentIndex >= testimonials.length) setCurrentIndex(0);
  }, [currentIndex, testimonials.length]);

  useEffect(() => {
    if (isPlaying && !showAddForm && testimonials.length > 1) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
      }, 6000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isPlaying, showAddForm, testimonials.length]);

  const handleNext = () => {
    if (testimonials.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    if (testimonials.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleToggleLike = (id) => {
    setCommunityPosts((current) =>
      current.map((post) => {
        if (String(post?.id) !== String(id)) return post;
        const liked = Boolean(post.liked);
        return {
          ...post,
          likes: Math.max(0, Number(post.likes || 0) + (liked ? -1 : 1)),
          liked: !liked
        };
      })
    );
  };

  const handleImageSelection = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!String(file.type || '').toLowerCase().startsWith('image/')) {
      setFormError('Choose a valid image file.');
      return;
    }
    setFormError('');
    setImageStudioSourceFile(file);
    setImageStudioOpen(true);
  };

  const handleImageStudioCancel = () => {
    setImageStudioOpen(false);
    setImageStudioSourceFile(null);
  };

  const handleImageStudioApply = (result, error) => {
    if (error) {
      setFormError(error?.message || 'Unable to prepare this image.');
      return;
    }
    if (!result?.file) return;
    setFormImageFile(result.file);
    setImageStudioOpen(false);
    setImageStudioSourceFile(null);
    setFormError('');
  };

  const handleEditImage = () => {
    if (!formImageFile) return;
    setImageStudioSourceFile(formImageFile);
    setImageStudioOpen(true);
  };

  const handleRemoveImage = () => {
    setFormImageFile(null);
    setImageStudioSourceFile(null);
    setImageStudioOpen(false);
  };

  const resetForm = () => {
    const memberName = normalizeText(
      currentUser?.fullName || currentUser?.username || currentUser?.email
    );
    setFormName(memberName);
    setFormPattern('');
    setFormRating(5);
    setFormComment('');
    setFormFabric('');
    setFormSize('8');
    setFormCaption('');
    setFormImageFile(null);
    setImageStudioSourceFile(null);
    setImageStudioOpen(false);
    setFormError('');
  };

  const handleAddTestimonial = async (event) => {
    event.preventDefault();
    if (!normalizeText(formName) || !normalizeText(formComment) || !normalizeText(formFabric)) {
      setFormError('Please fill in your name, comment, and fabric used.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      let imageUrl = '';
      if (formImageFile) {
        if (!isEipApiConfigured()) {
          throw new Error('The EIP image upload service is not configured.');
        }
        const upload = await eipCommunityApi.uploadBlogAsset(formImageFile);
        imageUrl = normalizeText(upload?.asset?.url || upload?.asset?.raw_url);
        if (!imageUrl) throw new Error('EIP did not return an image URL for this upload.');
      }

      const patternName = normalizeText(formPattern) || 'Community creation';
      const authorName = normalizeText(formName);
      const today = new Date().toISOString().split('T')[0];
      const caption = normalizeText(formCaption) || `My finished project in ${normalizeText(formFabric)}`;
      const avatar = normalizeText(currentUser?.avatarUrl || currentUser?.avatar || currentUser?.photoUrl);

      const newPost = {
        id: createClientRecordId('community-post'),
        type: 'creation',
        source: 'home-testimonial',
        targetId: `community:${slugify(patternName) || 'creation'}`,
        targetName: patternName,
        author: authorName.startsWith('@') ? authorName : `@${authorName.replace(/\s+/g, '')}`,
        avatar,
        rating: formRating,
        title: caption,
        caption,
        comment: normalizeText(formComment),
        fabric: normalizeText(formFabric),
        size: normalizeText(formSize) || undefined,
        image: imageUrl || undefined,
        date: today,
        likes: 0,
        liked: false,
        tips: normalizeText(formComment),
        replies: [],
        featured: false
      };

      setCommunityPosts((current) => [newPost, ...current]);
      setCurrentIndex(0);
      setFormSuccess(true);
      resetForm();
      window.setTimeout(() => {
        setFormSuccess(false);
        setShowAddForm(false);
      }, 2500);
    } catch (error) {
      setFormError(error?.message || error?.code || 'Unable to share this creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTestimonial = testimonials[currentIndex] || testimonials[0];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-sand-50/60 border border-sand-200/50 rounded-xl p-5 md:p-7 space-y-5"
        id={sectionId}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" id="testimonials-header">
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase tracking-[0.24em] text-clay-700 font-bold">
              {kicker}
            </span>
            <h3 className="font-serif text-2xl md:text-3xl lg:text-4xl text-bark-900 tracking-tight leading-tight">
              {title}
            </h3>
            <p className="text-sm md:text-base text-bark-500 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setIsPlaying(showAddForm);
              setFormError('');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-clay-600 hover:bg-clay-700 text-sand-50 text-xs font-sans font-medium rounded-[4px] shadow-xs hover:shadow transition-all duration-300 self-start md:self-auto cursor-pointer"
            id="toggle-testimonial-form-btn"
          >
            {showAddForm ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{pfUiT('ui.components.testimonialcarousel.2ccb53db42')}</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>{pfUiT('ui.components.testimonialcarousel.1288e8a273')}</span>
              </>
            )}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!showAddForm && !activeTestimonial ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-lg border border-dashed border-sand-300 bg-white px-6 py-14 text-center"
            >
              <Quote className="mx-auto mb-3 h-8 w-8 text-bark-300" />
              <p className="font-serif text-lg text-bark-900">{pfUiT('ui.components.testimonialcarousel.runtime.empty')}</p>
              <p className="mt-1 text-xs text-bark-500">{pfUiT('ui.components.testimonialcarousel.runtime.emptyHelp')}</p>
            </motion.div>
          ) : !showAddForm ? (
            <motion.div
              key="carousel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
              onMouseEnter={() => setIsPlaying(false)}
              onMouseLeave={() => setIsPlaying(true)}
              id="testimonial-carousel-slide"
            >
              <div className="lg:col-span-5 flex flex-col justify-between" id="testimonial-image-column">
                <div className="relative h-[300px] w-full rounded-lg overflow-hidden shadow-md bg-sand-200 group border border-sand-200/50 sm:h-[340px] lg:h-[380px] xl:h-[400px]">
                  <img
                    src={activeTestimonial.image}
                    alt={activeTestimonial.caption}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5">
                    <div className="space-y-1.5 text-white">
                      <span className="text-[10px] font-mono uppercase bg-clay-600/90 text-sand-100 px-2 py-0.5 rounded-full inline-block tracking-wider">
                        {activeTestimonial.patternName}
                      </span>
                      <p className="text-sm font-serif italic text-sand-100 leading-snug">
                        “{activeTestimonial.caption}”
                      </p>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2 text-[10px] text-sand-200 font-sans">
                        <div className="flex gap-4">
                          <span>{pfUiT('ui.components.testimonialcarousel.e510554256')}<strong className="text-white">{activeTestimonial.fabric}</strong></span>
                          {activeTestimonial.size && (
                            <span>{pfUiT('ui.components.testimonialcarousel.8e35ab2b98')}<strong className="text-white">{activeTestimonial.size}</strong></span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
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

              <div className="lg:col-span-7 flex flex-col justify-between space-y-6 lg:pl-4" id="testimonial-review-column">
                <div className="space-y-6">
                  <div className="flex justify-between items-center" id="testimonial-rating-row">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={index}
                          className={`w-4 h-4 ${
                            index < activeTestimonial.rating
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-sand-300'
                          }`}
                        />
                      ))}
                    </div>
                    <Quote className="w-10 h-10 text-clay-200 rotate-180" />
                  </div>

                  <blockquote className="space-y-3">
                    <p className="font-serif text-lg md:text-xl text-bark-900 leading-relaxed italic">
                      “{activeTestimonial.comment}”
                    </p>
                  </blockquote>

                  <div className="flex items-center gap-3.5 pt-4 border-t border-sand-200" id="testimonial-author-row">
                    {activeTestimonial.avatar ? (
                      <img
                        src={activeTestimonial.avatar}
                        alt={activeTestimonial.author}
                        className="w-11 h-11 rounded-full object-cover border border-sand-300"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full border border-sand-300 bg-sand-100 flex items-center justify-center text-xs font-bold text-bark-700">
                        {initialsFor(activeTestimonial.author.replace(/^@/, ''))}
                      </div>
                    )}
                    <div>
                      <h5 className="font-sans font-semibold text-bark-900 text-sm">{activeTestimonial.author}</h5>
                      <div className="flex items-center gap-2 text-bark-500 text-[11px] font-sans mt-0.5">
                        <span>{pfUiT('ui.components.testimonialcarousel.e5a3709fcc')}</span>
                        <span className="w-1 h-1 rounded-full bg-sand-300" />
                        <span className="flex items-center gap-0.5 text-clay-600">
                          <Scissors className="w-3 h-3" />
                          {activeTestimonial.patternName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-sand-200" id="testimonial-controls">
                  <div className="flex items-center gap-2" id="testimonial-dots">
                    {testimonials.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className={`h-1.5 rounded-full transition-all duration-350 cursor-pointer ${
                          currentIndex === index ? 'w-6 bg-clay-600' : 'w-1.5 bg-sand-300 hover:bg-sand-400'
                        }`}
                        title={`Go to testimonial ${index + 1}`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2" id="testimonial-arrows">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={testimonials.length <= 1}
                      className="p-2 border border-sand-200 rounded-[4px] bg-white text-bark-700 hover:bg-sand-100 hover:text-bark-900 transition-colors shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-40"
                      aria-label={pfUiT('ui.components.testimonialcarousel.711a318e8f')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={testimonials.length <= 1}
                      className="p-2 border border-sand-200 rounded-[4px] bg-white text-bark-700 hover:bg-sand-100 hover:text-bark-900 transition-colors shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-40"
                      aria-label={pfUiT('ui.components.testimonialcarousel.f3fe6e3fce')}
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
                <h4 className="font-serif text-lg text-bark-900">{pfUiT('ui.components.testimonialcarousel.1288e8a273')}</h4>
                <p className="text-xs text-bark-500">{pfUiT('ui.components.testimonialcarousel.0c0a72279e')}</p>
              </div>

              {formSuccess ? (
                <div className="py-8 text-center space-y-3" id="form-success-view">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <h5 className="font-sans font-semibold text-bark-950 text-sm">{pfUiT('ui.components.testimonialcarousel.373c4371ba')}</h5>
                  <p className="text-xs text-bark-500 max-w-sm mx-auto">{pfUiT('ui.components.testimonialcarousel.7c165e3bb5')}</p>
                </div>
              ) : (
                <form onSubmit={handleAddTestimonial} className="space-y-4" id="masterpiece-form">
                  {formError && (
                    <div className="p-3 rounded bg-rose-50 border border-rose-100 text-rose-700 text-xs flex gap-2 items-start" id="form-error-banner">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="form-row-1">
                    <div className="space-y-1.5" id="form-group-name">
                      <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">{pfUiT('ui.components.testimonialcarousel.d30e2d3349')}</label>
                      <input
                        type="text"
                        placeholder={pfUiT('ui.components.testimonialcarousel.50cb35bb8f')}
                        value={formName}
                        onChange={(event) => setFormName(event.target.value)}
                        className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                        required
                      />
                    </div>

                    <div className="space-y-1.5" id="form-group-pattern">
                      <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">Pattern / project name</label>
                      <input
                        type="text"
                        placeholder="e.g. NP-NS-001 or your project name"
                        value={formPattern}
                        onChange={(event) => setFormPattern(event.target.value)}
                        className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="form-row-2">
                    <div className="space-y-1.5" id="form-group-fabric">
                      <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">{pfUiT('ui.components.testimonialcarousel.6f02819301')}</label>
                      <input
                        type="text"
                        placeholder={pfUiT('ui.components.testimonialcarousel.63af2f3f96')}
                        value={formFabric}
                        onChange={(event) => setFormFabric(event.target.value)}
                        className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                        required
                      />
                    </div>

                    <div className="space-y-1.5" id="form-group-size">
                      <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">{pfUiT('ui.components.testimonialcarousel.d35e35dfeb')}</label>
                      <input
                        type="text"
                        placeholder={pfUiT('ui.components.testimonialcarousel.a1bfcba61c')}
                        value={formSize}
                        onChange={(event) => setFormSize(event.target.value)}
                        className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                      />
                    </div>

                    <div className="space-y-1.5" id="form-group-rating">
                      <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">{pfUiT('ui.components.testimonialcarousel.22d6e2c64b')}</label>
                      <div className="flex items-center gap-1 py-1.5" id="form-rating-stars">
                        {[1, 2, 3, 4, 5].map((starValue) => (
                          <button
                            key={starValue}
                            type="button"
                            onClick={() => setFormRating(starValue)}
                            className="text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                          >
                            <Star className={`w-4 h-4 ${starValue <= formRating ? 'fill-current' : 'text-sand-200'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5" id="form-group-image">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">Finished project photo</label>
                    {formImagePreviewUrl ? (
                      <div className="rounded-[4px] border border-sand-200 overflow-hidden bg-sand-50">
                        <div className="aspect-[16/9] overflow-hidden bg-sand-100">
                          <img src={formImagePreviewUrl} alt="Edited feedback preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-bark-800 truncate">{formImageFile?.name}</div>
                            <div className="text-[10px] text-bark-450">Prepared in Image Studio; this edited file is what EIP will receive.</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleEditImage}
                              className="inline-flex items-center gap-1.5 rounded border border-sand-250 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-bark-700 hover:bg-sand-50"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="inline-flex items-center gap-1.5 rounded border border-sand-250 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-bark-700 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="testimonial-image-file"
                        className="border border-dashed border-sand-300 rounded-[4px] p-4 flex items-center gap-3 cursor-pointer hover:bg-sand-50 transition-colors"
                      >
                        <ImageIcon className="w-5 h-5 text-clay-600" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-bark-800">Upload a photo from your device</div>
                          <div className="text-[10px] text-bark-450">The image opens in Image Studio before it is uploaded to EIP.</div>
                        </div>
                      </label>
                    )}
                    <input
                      id="testimonial-image-file"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageSelection}
                    />
                  </div>

                  <div className="space-y-1.5" id="form-group-caption">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">{pfUiT('ui.components.testimonialcarousel.f70e34bc9f')}</label>
                    <input
                      type="text"
                      placeholder={pfUiT('ui.components.testimonialcarousel.569b341add')}
                      value={formCaption}
                      onChange={(event) => setFormCaption(event.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800"
                    />
                  </div>

                  <div className="space-y-1.5" id="form-group-comment">
                    <label className="text-[10px] font-mono uppercase text-bark-600 tracking-wider font-bold">{pfUiT('ui.components.testimonialcarousel.1875c86709')}</label>
                    <textarea
                      rows={3}
                      placeholder={pfUiT('ui.components.testimonialcarousel.585df8ff11')}
                      value={formComment}
                      onChange={(event) => setFormComment(event.target.value)}
                      className="w-full px-3 py-2 border border-sand-200 rounded bg-sand-50/30 text-xs focus:ring-1 focus:ring-clay-500 focus:border-clay-500 text-bark-800 resize-none"
                      required
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2" id="form-actions-row">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        resetForm();
                        setShowAddForm(false);
                        setIsPlaying(true);
                      }}
                      className="px-4 py-2 border border-sand-200 hover:bg-sand-50 text-bark-700 text-xs font-sans rounded cursor-pointer disabled:opacity-50"
                    >
                      {pfUiT('ui.components.testimonialcarousel.6339681ae4')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || imageStudioOpen}
                      className="px-5 py-2 bg-clay-650 hover:bg-clay-700 disabled:bg-sand-300 text-sand-50 text-xs font-sans font-medium rounded shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                      {isSubmitting ? 'Sharing…' : pfUiT('ui.components.testimonialcarousel.2516bd1ba1')}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ImageAssetStudioModal
        open={imageStudioOpen}
        sourceFile={imageStudioSourceFile}
        sourceUrl=""
        title="Community feedback photo"
        presetProfiles={FEEDBACK_IMAGE_STUDIO_PROFILES}
        defaultProfileId="community-feedback"
        onCancel={handleImageStudioCancel}
        onApply={handleImageStudioApply}
      />
    </>
  );
}
