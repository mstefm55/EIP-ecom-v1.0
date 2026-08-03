/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star, MessageSquare, Heart, Camera, Upload, Send, Check, X,
  Search, MessageCircle, PenTool, HelpCircle, Sparkles, Filter,
  ChevronDown, MessageSquareMore, ThumbsUp, Scissors, Shirt,
  Image as ImageIcon, ChevronRight, ChevronLeft, Quote, Calendar, ArrowRight, User, Maximize2, Sparkle
} from 'lucide-react';

// Unified high-quality seed list combining all community creations & general feedback
const DEFAULT_SHOWROOM_POSTS = [
  {
    id: 'post-seed-1',
    type: 'creation',
    targetId: 'sartorial-01',
    targetName: 'Aurelia Wrap Dress',
    author: '@GenevieveSews',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    title: 'Emerald Aurelia in Washed Linen!',
    comment: 'I spent my weekend sewing up the Aurelia Wrap Dress using Belgian washed linen. The French seam finish instructions are a masterpiece. Sizing calculator recommended a size 8 and it fits absolutely like a glove!',
    fabric: 'Emerald Linen (230 gsm)',
    size: '8',
    difficulty: 'Just Right',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    date: '2026-06-18',
    likes: 42,
    liked: false,
    tips: 'I added 2 inches to the skirt length for a true ankle-grazing maxi silhouette. Basting the wrap band prior to stitching made the bodice finish perfectly flush.',
    replies: [
      {
        id: 'rep-seed-1',
        author: '@ClaraSews',
        comment: 'Stunning drape! Did you make any bodice length adjustments?',
        date: '2026-06-19'
      },
      {
        id: 'rep-seed-2',
        author: '@GenevieveSews',
        comment: '@ClaraSews No adjustments needed! The standard draft length is perfect for my 5\'6" frame.',
        date: '2026-06-19'
      }
    ]
  },
  {
    id: 'post-seed-2',
    type: 'creation',
    targetId: 'sartorial-01',
    targetName: 'Aurelia Wrap Dress',
    author: '@Clara_M_Atelier',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 4,
    title: 'Relaxed cover-up in semi-sheer cotton gauze',
    comment: 'Styled as a summer throw-on garment. Wrap ties are incredibly versatile. The pattern guide was exceptionally clear for bias binding seams.',
    fabric: 'Double-crinkle Cotton Gauze',
    size: '6',
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
    date: '2026-05-24',
    likes: 28,
    liked: false,
    tips: 'Omitted the interior secure button for a more relaxed, beachy drape. Sized down for less bulk.',
    replies: []
  },
  {
    id: 'post-seed-3',
    type: 'feedback',
    targetId: 'atelier',
    targetName: 'Perfect Fit Bureau Overall Support',
    topic: 'sizing-fit',
    topicLabel: 'Sizing & Proportions Fit',
    author: '@TailorMarked',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    title: 'Best Sizing Engine I have used',
    comment: 'Highly impressed with the dynamic 3D-adjacent mannequin sizing calculations. Usually, I have to grade heavily between bust and hip, but entering my numbers gave a flawless custom guideline. Highly recommend the Bureau!',
    date: '2026-07-01',
    likes: 18,
    liked: false,
    replies: [
      {
        id: 'rep-seed-3',
        author: 'Madame Geneviève (Couturier)',
        comment: 'Thank you Mark! Our team spent months testing across diverse body types to make grading lines accurate. Happy tailoring!',
        date: '2026-07-01'
      }
    ]
  },
  {
    id: 'post-seed-4',
    type: 'creation',
    targetId: 'sartorial-02',
    targetName: 'Utility Trench',
    author: '@Arthur_Tailored',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    title: '25 Hours well spent on this trench coat',
    comment: 'Spent 25 hours on this utility trench. Crafted in olive cotton gabardine. The storm flap alignment guides were incredibly precise.',
    fabric: 'Cotton Gabardine & Silk Satin lining',
    size: '12',
    difficulty: 'Challenging',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
    date: '2026-06-20',
    likes: 85,
    liked: false,
    tips: 'Take your time with the double welt pockets and collar stand! Basting first is key to getting crisp points.',
    replies: []
  },
  {
    id: 'post-seed-5',
    type: 'creation',
    targetId: 'sartorial-02',
    targetName: 'Utility Trench',
    author: '@ElenaCrafts',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    title: 'Heavy weather British dry oilskin version',
    comment: 'Perfect heavy weather coat in British dry oilskin. Completely waterproof! The tutorial booklet made pocket installation intuitive.',
    fabric: 'Tan Dry Oilskin / Waxed Canvas',
    size: '8',
    difficulty: 'Challenging',
    image: 'https://images.unsplash.com/photo-1548624149-f7b3e55c0219?auto=format&fit=crop&w=800&q=80',
    date: '2026-06-11',
    likes: 59,
    liked: false,
    tips: 'Use a heavy denim needle (90/14) and clapper to press the seams flat. Do not iron oilskin directly!',
    replies: []
  },
  {
    id: 'post-seed-6',
    type: 'creation',
    targetId: 'sartorial-03',
    targetName: 'Palazzo Wide-Leg Trouser',
    author: '@Beatrice_Loves_Linen',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    title: 'Perfect tailored trouser waist fitting!',
    comment: 'Absolutely love how flat the front waistband rests against the waist. Sized up to a 10 and used a navy suiting blend. Added 2 inches for wearing with platforms!',
    fabric: 'Worsted Wool Suiting Crepe',
    size: '10',
    difficulty: 'Just Right',
    image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=800&q=80',
    date: '2026-06-22',
    likes: 64,
    liked: false,
    tips: 'The contour waistband drafting is perfect. No gaping at the back whatsoever! Added the 2-inch let-down hem for heels.',
    replies: []
  },
  {
    id: 'post-seed-7',
    type: 'creation',
    targetId: 'sartorial-03',
    targetName: 'Palazzo Wide-Leg Trouser',
    author: '@IsabellaK_Design',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 4,
    title: 'Washed tencel trousers for everyday luxury',
    comment: 'High waisted and super comfortable. The front pocket bags are bound in bias tape for a luxury inside finish.',
    fabric: 'Washed Tencel Linen (Oatmeal)',
    size: '8',
    difficulty: 'Just Right',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    date: '2026-06-01',
    likes: 41,
    liked: false,
    tips: 'I sized down slightly based on the waist measurement. Bias bound the pocket bags with silk tape—feels wonderful inside!',
    replies: []
  },
  {
    id: 'post-seed-8',
    type: 'creation',
    targetId: 'sartorial-04',
    targetName: 'Asymmetric Drape Blouse',
    author: '@Sienna_V_Sews',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 5,
    title: 'Minimalist drape in mulberry silk',
    comment: 'The asymmetric pleat lines are a masterpiece. This blouse looks like a high-end designer piece. Highly recommend lightweight silk tencel.',
    fabric: 'Mulberry Silk Satin',
    size: '4',
    difficulty: 'Easy',
    image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
    date: '2026-06-15',
    likes: 72,
    liked: false,
    tips: 'Be careful with the bias cut edges around the neckline—they stretch easily. Use stay tape or lightweight fusible stabilizer.',
    replies: []
  },
  {
    id: 'post-seed-9',
    type: 'feedback',
    targetId: 'atelier',
    targetName: 'Perfect Fit Bureau Design Library',
    topic: 'pattern-request',
    topicLabel: 'Pattern Requests',
    author: '@Sienna_V',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80',
    rating: 4,
    title: 'Request: High-collar Victorian Blouse',
    comment: 'I am completely obsessed with the styling here. Would the designers consider drafting a dramatic high-collar bishop sleeve blouse next? Your clean instructions are exactly what beginner-intermediate couturiers need.',
    date: '2026-07-04',
    likes: 29,
    liked: false,
    replies: []
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.215, 0.61, 0.355, 1] },
  },
};

export default function CreationsAndFeedback({
  patterns = [],
  currentUser = null,
  onAddReview,
  // Added properties for Pattern Specific Mode integration
  pattern = null,
  reviews = []
}) {
  const isPatternMode = !!pattern;
  const currentPatternId = pattern?.id;

  // Active view tab state (Showroom feed vs leave feedback form)
  // For pattern mode: 'gallery' | 'reviews' | 'post'
  const [activeTab, setActiveTab] = useState(isPatternMode ? 'gallery' : 'showroom');
  const [showPatternReviewForm, setShowPatternReviewForm] = useState(false);

  // Filter / Sort States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'creations' | 'atelier-feedback' (Global mode only)
  const [filterRating, setFilterRating] = useState('all'); // 'all' | '5' | '4' | '3' | 'photo' (Pattern mode only)
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'highest' | 'helpful'

  // Showcase toggle in pattern mode to explore other creations
  const [showAllMakesInPatternMode, setShowAllMakesInPatternMode] = useState(false);

  // Form Field States
  const [creationTarget, setCreationTarget] = useState(isPatternMode ? currentPatternId : 'atelier');
  const [formRating, setFormRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [formName, setFormName] = useState(currentUser?.fullName || '');
  const [formEmail, setFormEmail] = useState(currentUser?.email || '');
  const [formTitle, setFormTitle] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formFabric, setFormFabric] = useState('');
  const [formSize, setFormSize] = useState(pattern?.sizes?.[3] || '8');
  const [formDifficulty, setFormDifficulty] = useState('Just Right'); // 'Easy' | 'Just Right' | 'Challenging'
  const [formTopic, setFormTopic] = useState('sizing-fit'); // 'sizing-fit' | 'instruction-clarity' | 'pattern-request' | 'general'

  // Image Upload States
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploadedImageFile, setUploadedImageFile] = useState(null);
  const fileInputRef = useRef(null);

  // Interaction States
  const [replyText, setReplyText] = useState({});
  const [activeReplyBox, setActiveReplyBox] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [atelierReply, setAtelierReply] = useState(null);
  const [activeLightbox, setActiveLightbox] = useState(null);

  // Retrieve posts from localStorage, backed by our consolidated seed list
  const [posts, setPosts] = useState(() => {
    try {
      const saved = localStorage.getItem('sartorial_showroom_posts');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SHOWROOM_POSTS;
  });

  // Sync posts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sartorial_showroom_posts', JSON.stringify(posts));
    } catch (e) {
      console.error(e);
    }
  }, [posts]);

  // Consolidated Spotlight Carousel Logic (Atelier Creations in the Wild)
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPlaying, setIsCarouselPlaying] = useState(true);
  const carouselPlayRef = useRef(null);

  const spotlightCreations = useMemo(() => {
    return posts.filter(post => post.type === 'creation' && post.image);
  }, [posts]);

  useEffect(() => {
    if (isCarouselPlaying && spotlightCreations.length > 0 && activeTab === 'showroom') {
      carouselPlayRef.current = setInterval(() => {
        setCarouselIndex((prev) => (prev + 1) % spotlightCreations.length);
      }, 7000);
    }
    return () => {
      if (carouselPlayRef.current) {
        clearInterval(carouselPlayRef.current);
      }
    };
  }, [isCarouselPlaying, spotlightCreations.length, activeTab]);

  const handleNextCarousel = () => {
    if (spotlightCreations.length > 0) {
      setCarouselIndex((prev) => (prev + 1) % spotlightCreations.length);
    }
  };

  const handlePrevCarousel = () => {
    if (spotlightCreations.length > 0) {
      setCarouselIndex((prev) => (prev - 1 + spotlightCreations.length) % spotlightCreations.length);
    }
  };

  // Sync profile name when user logs in or updates
  useEffect(() => {
    if (currentUser) {
      setFormName(currentUser.fullName || '');
      setFormEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Feedback / Creation Review Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim() || !formTitle.trim() || !formComment.trim()) return;

    setIsSubmitting(true);

    const targetIdToUse = isPatternMode ? currentPatternId : creationTarget;

    // Resolve target name
    let targetName = 'Perfect Fit Bureau Overall';
    if (targetIdToUse !== 'atelier') {
      const match = pattern || patterns.find(p => p.id === targetIdToUse);
      targetName = match ? match.name : 'Custom Pattern';
    }

    setTimeout(() => {
      const newPostId = `post-${Date.now()}`;
      const today = new Date().toISOString().split('T')[0];

      const topicsMap = {
        'sizing-fit': 'Sizing & Proportions Fit',
        'instruction-clarity': 'Instruction Booklets Clarity',
        'pattern-request': 'Pattern Requests',
        'general': 'General Bureau Feedback'
      };

      const isCreation = targetIdToUse !== 'atelier' || uploadedImage;

      // 1. If product-specific, trigger parent onAddReview callback to sync App state
      if (targetIdToUse !== 'atelier' && onAddReview) {
        const reviewObject = {
          id: `rev-central-${Date.now()}`,
          name: formName.trim(),
          rating: formRating,
          title: formTitle.trim(),
          comment: formComment.trim(),
          date: today,
          fabric: formFabric.trim() || undefined,
          size: formSize,
          image: uploadedImage || undefined
        };
        onAddReview(targetIdToUse, reviewObject);
      }

      // 2. Add into local consolidated memory feed
      const newPost = {
        id: newPostId,
        type: isCreation ? 'creation' : 'feedback',
        targetId: targetIdToUse,
        targetName,
        topic: targetIdToUse === 'atelier' ? formTopic : undefined,
        topicLabel: targetIdToUse === 'atelier' ? topicsMap[formTopic] : undefined,
        author: `@${formName.trim().replace(/\s+/g, '') || 'CreativeSewist'}`,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        rating: formRating,
        title: formTitle.trim(),
        comment: formComment.trim(),
        fabric: isCreation ? (formFabric.trim() || 'Couture Fabric') : undefined,
        size: isCreation ? formSize : undefined,
        difficulty: isCreation ? formDifficulty : undefined,
        image: uploadedImage || undefined,
        date: today,
        likes: 0,
        liked: false,
        tips: isCreation ? formComment.trim() : undefined,
        replies: []
      };

      setPosts(prev => [newPost, ...prev]);

      // 3. Set a tailored couture studio reply
      if (targetIdToUse === 'atelier') {
        const responses = {
          'sizing-fit': `Madame Geneviève has logged your sizing diagnostics! Our technical drafting team evaluates fit data across all digital mannequins.`,
          'instruction-clarity': `Thank you for sharing your feedback. The sewing handbook studio utilizes clear, visual illustration boards to demystify complex tailor operations.`,
          'pattern-request': `Bespoke request logged! Madame Geneviève loves adding draft ideas to our active creative archives.`,
          'general': `We are highly touched by your words! Inspiring creators like you is the heart of Perfect Fit Bureau.`
        };
        setAtelierReply(responses[formTopic] || responses['general']);
      } else {
        setAtelierReply(`What an elegant construct! Your review and fabric notes for "${targetName}" have been published to the showroom feed. Your fitting notes inspire sewers globally.`);
      }

      setIsSubmitting(false);
      setSubmitSuccess(true);

      // Clean up fields
      setFormTitle('');
      setFormComment('');
      setFormFabric('');
      setUploadedImage(null);
      setUploadedImageFile(null);

      if (window.showToast) {
        window.showToast('Your creation and feedback have been published!', 'success', 'Creation Registered');
      }

      // If in pattern mode, close form and redirect after a delay
      if (isPatternMode) {
        setTimeout(() => {
          setSubmitSuccess(false);
          setShowPatternReviewForm(false);
          setActiveTab('gallery');
        }, 3000);
      }

    }, 1500);
  };

  // Like / upvote post handler
  const handleLikePost = (postId) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const wasLiked = post.liked;
        return {
          ...post,
          likes: wasLiked ? post.likes - 1 : post.likes + 1,
          liked: !wasLiked
        };
      }
      return post;
    }));
  };

  // Nested commenting reply handler
  const handleAddReply = (postId) => {
    const text = replyText[postId];
    if (!text || !text.trim()) return;

    const authorName = currentUser?.fullName ? `@${currentUser.fullName.replace(/\s+/g, '')}` : '@GuestSewist';
    const newReply = {
      id: `rep-${Date.now()}`,
      author: authorName,
      comment: text.trim(),
      date: new Date().toISOString().split('T')[0]
    };

    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          replies: [...(post.replies || []), newReply]
        };
      }
      return post;
    }));

    setReplyText(prev => ({ ...prev, [postId]: '' }));
    setActiveReplyBox(null);

    if (window.showToast) {
      window.showToast('Comment reply added!', 'success', 'Reply Published');
    }
  };

  // MERGING STRATEGY FOR DYNAMIC PATTERN-SPECIFIC MODE
  // Combines static parent reviews state and localStorage showroom posts to offer the complete, verified list
  const patternReviews = useMemo(() => {
    if (!isPatternMode) return [];

    const propReviews = reviews || [];
    const localPostsForThisPattern = posts.filter(p => p.targetId === currentPatternId);

    const merged = [...propReviews];

    localPostsForThisPattern.forEach(post => {
      const isDuplicate = merged.some(r =>
        r.id === post.id ||
        (r.name && r.name.toLowerCase() === post.author.replace('@', '').toLowerCase() && r.title === post.title)
      );
      if (!isDuplicate) {
        merged.push({
          id: post.id,
          name: post.author.replace('@', ''),
          rating: post.rating,
          title: post.title,
          comment: post.comment,
          date: post.date,
          fabric: post.fabric,
          size: post.size,
          image: post.image,
          difficulty: post.difficulty || 'Just Right',
          likes: post.likes,
          liked: post.liked,
          tips: post.tips || post.comment,
          replies: post.replies || []
        });
      }
    });

    // Sorting of Pattern Reviews
    if (sortBy === 'highest') {
      merged.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'helpful') {
      merged.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else {
      merged.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Applying filters
    let filtered = merged;
    if (filterRating !== 'all') {
      if (filterRating === 'photo') {
        filtered = filtered.filter(r => r.image);
      } else {
        const starNum = parseInt(filterRating);
        filtered = filtered.filter(r => r.rating === starNum);
      }
    }

    return filtered;
  }, [reviews, posts, isPatternMode, currentPatternId, sortBy, filterRating]);

  // Aggregate stats in pattern mode
  const stats = useMemo(() => {
    if (!isPatternMode) return { count: 0, average: 5.0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

    const list = patternReviews;
    const count = list.length;
    const sum = list.reduce((acc, r) => acc + r.rating, 0);
    const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 5.0;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    list.forEach(r => {
      if (distribution[r.rating] !== undefined) distribution[r.rating]++;
    });

    return {
      count,
      average,
      distribution
    };
  }, [patternReviews, isPatternMode]);

  // Filter gallery makes inside pattern mode
  const patternGalleryMakes = useMemo(() => {
    if (!isPatternMode) return [];

    let list = posts.filter(p => p.type === 'creation');

    // Unless toggle is active, filter ONLY for this pattern
    if (!showAllMakesInPatternMode) {
      list = list.filter(p => p.targetId === currentPatternId);
    }

    // Sort makes
    if (sortBy === 'highest') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'helpful') {
      list.sort((a, b) => b.likes - a.likes);
    } else {
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    return list;
  }, [posts, isPatternMode, currentPatternId, showAllMakesInPatternMode, sortBy]);

  // Filter global showroom timeline posts
  const filteredGlobalPosts = useMemo(() => {
    if (isPatternMode) return [];

    return posts.filter(post => {
      // Showroom specific tab filter type
      if (filterType === 'creations' && post.type !== 'creation') return false;
      if (filterType === 'atelier-feedback' && post.type !== 'feedback') return false;

      // Live search filter query
      const s = searchQuery.toLowerCase();
      return (
        post.title.toLowerCase().includes(s) ||
        post.comment.toLowerCase().includes(s) ||
        post.author.toLowerCase().includes(s) ||
        (post.targetName && post.targetName.toLowerCase().includes(s)) ||
        (post.fabric && post.fabric.toLowerCase().includes(s))
      );
    });
  }, [posts, isPatternMode, filterType, searchQuery]);


  // RENDER PATTERN-SPECIFIC MODE (Used in Drawers, QuickViews, Modals)
  if (isPatternMode) {
    return (
      <div className="bg-white border border-sand-200/80 rounded-[4px] p-4 sm:p-5 space-y-6 shadow-3xs text-left" id={`customer-gallery-root-${currentPatternId}`}>

        {/* HEADER BLOCK WITH AGGREGATE STATS */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-sand-200/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-clay-700 font-bold font-mono uppercase tracking-[0.18em] bg-clay-50 border border-clay-100 px-2 py-0.5 rounded">
                Atelier Exhibition
              </span>
              <span className="flex items-center gap-1 text-xs text-[#ba6446] font-bold">
                ★ {stats.average.toFixed(1)} <span className="text-bark-400 font-normal">({stats.count} ratings)</span>
              </span>
            </div>
            <h3 className="text-base font-serif font-semibold text-bark-900 tracking-tight flex items-center gap-2">
              <Camera className="w-4 h-4 text-clay-605" /> Maker Gallery &amp; Reviews
            </h3>
            <p className="text-[11px] text-bark-500 leading-normal font-sans">
              Authentic projects and fitting diagnostics for the <span className="font-bold text-bark-850">{pattern.name}</span>.
            </p>
          </div>

          {/* Local Tab Switcher */}
          <div className="flex bg-sand-100 p-0.5 rounded-[4px] border border-sand-200/60 w-full sm:w-auto" id="pattern-tab-nav">
            <button
              onClick={() => { setActiveTab('gallery'); setShowPatternReviewForm(false); }}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-[3px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'gallery' && !showPatternReviewForm ? 'bg-white text-clay-700 shadow-3xs' : 'text-bark-500 hover:text-bark-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Photos ({patternGalleryMakes.length})
            </button>
            <button
              onClick={() => { setActiveTab('reviews'); setShowPatternReviewForm(false); }}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider rounded-[3px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'reviews' && !showPatternReviewForm ? 'bg-white text-clay-700 shadow-3xs' : 'text-bark-500 hover:text-bark-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Written Reviews ({stats.count})
            </button>
          </div>
        </div>

        {/* WORKSPACE CONTENT AREA */}
        <div className="min-h-[220px]" id="pattern-gallery-workspace">
          <AnimatePresence mode="wait">

            {/* VIEW A: MAKER GALLERY GRIDS */}
            {activeTab === 'gallery' && !showPatternReviewForm && (
              <motion.div
                key="pattern-gallery-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Showcase Option header block */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-sand-50/55 p-3.5 border border-sand-200 rounded-[4px]">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-bark-850 font-serif flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#ba6446]" /> Inspiration Board
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="toggle-other-makes"
                        checked={showAllMakesInPatternMode}
                        onChange={(e) => setShowAllMakesInPatternMode(e.target.checked)}
                        className="rounded border-sand-300 text-clay-605 focus:ring-clay-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <label htmlFor="toggle-other-makes" className="text-[10px] text-bark-600 font-sans cursor-pointer select-none">
                        Include projects crafted from other Atelier patterns
                      </label>
                    </div>
                  </div>

                  <button
                    onClick={() => { setShowPatternReviewForm(true); setFormRating(5); }}
                    className="bg-bark-900 hover:bg-[#ba6446] text-sand-50 px-3.5 py-2 rounded-[4px] text-[10px] font-bold font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                    id="add-make-photo-btn"
                  >
                    <Camera className="w-3.5 h-3.5" /> Document Your Make
                  </button>
                </div>

                {/* Grid layout */}
                {patternGalleryMakes.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-sand-200 rounded bg-sand-50/20" id="gallery-pattern-fallback">
                    <ImageIcon className="w-8 h-8 text-bark-300 mx-auto stroke-[1.25] mb-2" />
                    <p className="text-xs text-bark-450 italic font-medium">No customer photos loaded for this pattern yet.</p>
                    <p className="text-[10px] text-bark-400 mt-0.5">Craft yours first and upload a photo above to display it here!</p>
                  </div>
                ) : (
                  <motion.div
                    className="grid grid-cols-2 md:grid-cols-3 gap-4"
                    id="pattern-gallery-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-10px" }}
                  >
                    {patternGalleryMakes.map((make) => {
                      const isLiked = make.liked;
                      return (
                        <motion.div
                          key={make.id}
                          variants={itemVariants}
                          onClick={() => setActiveLightbox(make)}
                          className="group relative bg-sand-50/30 border border-sand-200 rounded-[4px] overflow-hidden cursor-pointer shadow-2xs hover:shadow-md hover:border-sand-300 transition-all"
                          id={`pattern-make-card-${make.id}`}
                        >
                          <div className="aspect-[3/4] relative overflow-hidden bg-sand-100">
                            <img
                              src={make.image}
                              alt={make.caption || make.title}
                              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                            {/* Star badge overlay */}
                            <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-[3px] border border-sand-200 flex items-center gap-0.5 text-[8.5px] font-bold text-[#ba6446]">
                              ★ {make.rating}
                            </div>

                            {/* Zoom indicators */}
                            <div className="absolute inset-0 bg-bark-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <div className="bg-white/95 p-2 rounded-full text-bark-800 shadow-3xs">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>

                            {/* Spec footer metadata */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-bark-950/80 via-bark-950/40 to-transparent p-2.5 flex flex-col justify-end text-white">
                              <span className="text-[10px] font-bold tracking-wide">{make.author}</span>
                              <span className="text-[8px] text-sand-100 leading-none mt-0.5 font-mono truncate">
                                {make.fabric || 'Premium weave'} {make.size ? `• Size ${make.size}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Like panel bottom */}
                          <div className="p-2.5 flex justify-between items-center text-[10.5px] border-t border-sand-200 font-sans bg-white" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => handleLikePost(make.id)}
                              className={`flex items-center gap-1 font-semibold cursor-pointer transition-colors ${
                                isLiked ? 'text-clay-605' : 'text-bark-500 hover:text-bark-800'
                              }`}
                            >
                              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current text-clay-605' : ''}`} />
                              <span>{make.likes}</span>
                            </button>
                            <span className="text-[8.5px] font-mono text-bark-400">{make.date}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* VIEW B: DETAILED WRITTEN REVIEWS */}
            {activeTab === 'reviews' && !showPatternReviewForm && (
              <motion.div
                key="pattern-reviews-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Aggregate Star statistics */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#FCFAF7] border border-sand-200 rounded-[4px] p-4" id="pattern-rating-analytics">

                  {/* Big Number score */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center text-center space-y-1 md:border-r md:border-sand-200/80 pr-2">
                    <span className="text-[8px] text-bark-450 uppercase tracking-widest font-mono font-bold">Overall Rating</span>
                    <span className="text-4xl font-serif font-black text-bark-900 leading-none">{stats.average.toFixed(1)}</span>
                    <div className="flex gap-0.5 text-[#ba6446]" id="review-aggregate-stars">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${i <= Math.round(stats.average) ? 'fill-current' : 'text-sand-250'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-bark-500 font-sans">Based on {stats.count} community ratings</span>
                  </div>

                  {/* Distribution stars bars */}
                  <div className="md:col-span-5 space-y-1.5 flex flex-col justify-center">
                    {[5, 4, 3, 2, 1].map((rating) => {
                      const count = stats.distribution[rating] || 0;
                      const percent = stats.count > 0 ? (count / stats.count) * 100 : 0;
                      return (
                        <div key={rating} className="flex items-center gap-2 text-[10px] font-sans">
                          <span className="w-3 font-bold font-mono text-right">{rating}</span>
                          <Star className="w-2.5 h-2.5 text-[#ba6446] fill-current" />
                          <div className="flex-1 h-1.5 bg-sand-150 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-clay-605 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-6 text-bark-450 font-mono text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Direct button */}
                  <div className="md:col-span-3 flex flex-col items-center justify-center space-y-2 text-center pl-2">
                    <span className="text-[10px] text-bark-500 font-sans leading-normal">Purchased this pattern blueprint?</span>
                    <button
                      onClick={() => { setShowPatternReviewForm(true); setFormRating(5); }}
                      className="w-full bg-bark-900 hover:bg-[#ba6446] text-sand-50 py-2 rounded-[4px] text-[10px] font-bold font-mono uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-3xs"
                      id="write-review-tab-trigger"
                    >
                      Write a Review
                    </button>
                  </div>
                </div>

                {/* Filter / Sorting Options */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-150 pb-3 text-xs font-sans text-bark-700">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-bark-400 uppercase tracking-widest flex items-center gap-1">
                      <Filter className="w-3 h-3 text-clay-605" /> Filter by:
                    </span>

                    <div className="flex gap-1" id="filter-rating-buttons">
                      {[
                        { id: 'all', label: 'All Reviews' },
                        { id: '5', label: '5 Stars' },
                        { id: '4', label: '4 Stars' },
                        { id: 'photo', label: 'With Photos' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setFilterRating(opt.id)}
                          className={`px-2.5 py-1 text-[9.5px] font-medium rounded-full border transition-all cursor-pointer ${
                            filterRating === opt.id
                              ? 'bg-clay-605 border-clay-605 text-white shadow-3xs'
                              : 'bg-white border-sand-200 text-bark-600 hover:border-sand-350 hover:bg-sand-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="text-bark-400">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent border border-sand-200 rounded px-2 py-0.5 font-medium text-bark-800 focus:outline-none focus:border-clay-500 cursor-pointer text-xs"
                    >
                      <option value="newest">Most Recent</option>
                      <option value="highest">Highest Rated</option>
                      <option value="helpful">Helpful Likes</option>
                    </select>
                  </div>
                </div>

                {/* List of reviews */}
                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1" id="pattern-reviews-feed">
                  {patternReviews.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-sand-200 rounded-[4px]">
                      <p className="text-xs text-bark-450 italic font-sans">No reviews found matching these filter credentials.</p>
                    </div>
                  ) : (
                    patternReviews.map((rev) => (
                      <div key={rev.id} className="bg-sand-50/20 border border-sand-150 p-4 rounded-[4px] space-y-3 transition-all hover:bg-sand-50/40" id={`pattern-review-card-${rev.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-serif font-semibold text-bark-950 leading-tight">{rev.title}</h4>
                            <p className="text-[10px] text-bark-400 font-sans mt-0.5">
                              by <span className="font-bold text-bark-700">{rev.name}</span> • <span>{rev.date}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex gap-[0.5px] text-[#ba6446]">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-2.5 h-2.5 ${s <= rev.rating ? 'fill-current' : 'text-sand-250'}`} />
                              ))}
                            </div>

                            {rev.size && (
                              <span className="text-[7.5px] font-bold font-mono bg-sand-100 border border-sand-200 px-1.5 py-0.2 rounded text-bark-650">
                                Size {rev.size}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-bark-650 leading-relaxed font-sans">{rev.comment}</p>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                          {rev.fabric && (
                            <div className="text-[9.5px] text-bark-500 font-sans flex items-center gap-1">
                              <span className="font-semibold text-bark-450 font-mono uppercase tracking-wider text-[8px]">Fabric Used:</span>
                              <span className="bg-sand-100/60 px-1.5 py-0.2 rounded border border-sand-150 text-bark-700">{rev.fabric}</span>
                            </div>
                          )}

                          {rev.image && (
                            <div
                              onClick={() => setActiveLightbox(rev)}
                              className="flex items-center gap-1 text-[9.5px] text-clay-700 hover:text-clay-605 cursor-pointer font-bold font-sans border border-clay-100 bg-clay-50/20 px-2 py-0.5 rounded"
                            >
                              <ImageIcon className="w-3 h-3" /> View attached photo
                            </div>
                          )}
                        </div>

                        <div className="border-t border-sand-150 pt-2 flex justify-between items-center text-[10px] text-bark-400 font-sans">
                          <button
                            onClick={() => handleLikePost(rev.id)}
                            className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                              rev.liked ? 'text-clay-705 font-bold' : 'hover:text-bark-700'
                            }`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                            <span>Was this review helpful? ({rev.likes || 0})</span>
                          </button>

                          <span className="text-[9px] font-mono text-bark-400">Atelier Verified Sewist</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* VIEW C: WRITE REVIEW FORM INSIDE PATTERN MODE */}
            {showPatternReviewForm && (
              <motion.form
                key="pattern-review-form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                onSubmit={handleSubmit}
                className="border border-sand-200 p-5 bg-[#FCFAF7] rounded-[4px] space-y-4 shadow-3xs"
                id="integrated-gallery-review-form"
              >
                <div className="flex justify-between items-center border-b border-sand-150 pb-2.5">
                  <div className="space-y-0.5">
                    <h4 className="font-serif text-sm font-semibold text-bark-900 flex items-center gap-1.5">
                      <Sparkle className="w-4 h-4 text-clay-650 animate-pulse" /> Document Your Finished Make
                    </h4>
                    <p className="text-[9.5px] text-bark-450 font-sans">
                      Publish your sewing feedback, fitting details, and photo to the showcase.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPatternReviewForm(false)}
                    className="p-1 text-bark-400 hover:text-bark-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {submitSuccess ? (
                  <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[4px] flex items-center gap-3.5 text-xs font-sans" id="make-success-alert">
                    <Check className="w-6 h-6 text-emerald-600 flex-shrink-0 bg-white rounded-full p-0.5 border border-emerald-200" />
                    <div>
                      <p className="font-bold">Creation Published to Atelier Vault!</p>
                      <p className="text-emerald-700 mt-0.5">{atelierReply || "Your finished garment photo and review tips have been securely logged to memory."}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">

                    {/* Drag & drop image uploader */}
                    <div className="space-y-1.5">
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block">
                        Attach Finished Garment Photo (Highly Recommended)
                      </label>

                      <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-[4px] p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 relative overflow-hidden ${
                          uploadedImage
                            ? 'border-clay-500 bg-clay-50/5'
                            : 'border-sand-250 hover:border-sand-400 bg-white hover:bg-sand-50/30'
                        }`}
                        id="photo-uploader-dragzone"
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/*"
                          className="hidden"
                        />

                        {uploadedImage ? (
                          <div className="relative w-full max-w-[260px] aspect-[4/3] rounded overflow-hidden shadow-2xs border border-sand-200">
                            <img
                              src={uploadedImage}
                              alt="Your uploaded make draft"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUploadedImage(null);
                                setUploadedImageFile(null);
                              }}
                              className="absolute top-1.5 right-1.5 bg-black/60 text-white p-1 rounded-full hover:bg-black/85 transition-all cursor-pointer"
                              title="Remove Photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-bark-900/80 text-white text-[8px] font-mono py-1 text-center font-bold">
                              {(uploadedImageFile?.name || 'attached_garment.png').slice(0, 30)}
                            </div>
                          </div>
                        ) : (
                          <div className="py-2 flex flex-col items-center space-y-1.5">
                            <div className="p-2.5 bg-sand-100 rounded-full text-bark-500">
                              <Upload className="w-5 h-5 text-clay-605" />
                            </div>
                            <div className="text-xs text-bark-800">
                              <span className="font-bold text-clay-700">Click to browse file</span> or drag &amp; drop photo here
                            </div>
                            <span className="text-[9px] text-bark-400 font-sans leading-none">Supports PNG, JPG. Persistent in local session cache.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="maker-name-input">
                          Your Name
                        </label>
                        <input
                          id="maker-name-input"
                          type="text"
                          required
                          placeholder="e.g. GenevieveSews"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full bg-white border border-sand-200 rounded-[4px] px-3 py-1.5 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans"
                        />
                      </div>

                      <div>
                        <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="maker-size-select">
                          Size Crafted
                        </label>
                        <select
                          id="maker-size-select"
                          value={formSize}
                          onChange={(e) => setFormSize(e.target.value)}
                          className="w-full bg-white border border-sand-200 rounded-[4px] px-2 py-1.5 text-xs text-bark-800 focus:outline-none focus:border-clay-500 cursor-pointer"
                        >
                          {(pattern.sizes || ['4','6','8','10','12','14','16']).map(sz => (
                            <option key={sz} value={sz}>Size {sz}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="maker-difficulty-select">
                          Difficulty Experienced
                        </label>
                        <select
                          id="maker-difficulty-select"
                          value={formDifficulty}
                          onChange={(e) => setFormDifficulty(e.target.value)}
                          className="w-full bg-white border border-sand-200 rounded-[4px] px-2 py-1.5 text-xs text-bark-800 focus:outline-none focus:border-clay-500 cursor-pointer"
                        >
                          <option value="Easy">Easy / Beginner</option>
                          <option value="Just Right">Just Right / Intermediate</option>
                          <option value="Challenging">Challenging / Advanced</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="maker-fabric-input">
                          Fabric Specification
                        </label>
                        <input
                          id="maker-fabric-input"
                          type="text"
                          placeholder="e.g. washed linen, silk satin"
                          value={formFabric}
                          onChange={(e) => setFormFabric(e.target.value)}
                          className="w-full bg-white border border-sand-200 rounded-[4px] px-3 py-1.5 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans"
                        />
                      </div>

                      <div>
                        <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1">
                          Star Rating
                        </label>
                        <div className="flex items-center gap-1.5 h-[34px]">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormRating(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="p-1 focus:outline-none transition-transform active:scale-90 cursor-pointer"
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  star <= (hoverRating || formRating)
                                    ? 'fill-current text-[#ba6446]'
                                    : 'text-sand-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="maker-title-input">
                        Review Title Summary
                      </label>
                      <input
                        id="maker-title-input"
                        type="text"
                        required
                        placeholder="e.g. Beautiful drape, clear French seam guide"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full bg-white border border-sand-200 rounded-[4px] px-3 py-1.5 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans"
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="maker-comment-input">
                        Review Comments &amp; Fitting Advice
                      </label>
                      <textarea
                        id="maker-comment-input"
                        required
                        rows={3}
                        placeholder="Share your experience, length alterations, or special techniques you liked..."
                        value={formComment}
                        onChange={(e) => setFormComment(e.target.value)}
                        className="w-full bg-white border border-sand-200 rounded-[4px] px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans leading-relaxed"
                      />
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowPatternReviewForm(false)}
                        className="flex-1 py-2 border border-sand-300 hover:border-sand-400 bg-white text-bark-750 text-xs font-semibold rounded-[4px] transition-colors cursor-pointer text-center"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-2 bg-bark-900 hover:bg-[#ba6446] text-sand-50 text-xs font-semibold rounded-[4px] transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <span className="w-4 h-4 border-2 border-sand-200 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5" /> Publish Review
                          </span>
                        )}
                      </button>
                    </div>

                  </div>
                )}
              </motion.form>
            )}

          </AnimatePresence>
        </div>

        {/* REUSABLE LIGHTBOX OVERLAY */}
        {renderLightboxOverlay()}
      </div>
    );
  }


  // RENDER MASTER COMPREHENSIVE GLOBAL SHOWROOM AND GUESTBOOK TIMELINE (Used in guestbook tab of workspace)
  return (
    <section className="bg-white rounded-[4px] border border-sand-200 p-6 md:p-10 space-y-8 shadow-lux relative overflow-hidden" id="atelier-showroom-feedback-section">
      <div className="absolute right-0 top-0 w-36 h-36 opacity-[0.03] bg-[radial-gradient(#ba6446_1px,transparent_1px)] [background-size:10px_10px] pointer-events-none" />

      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-sand-150/85">
        <div className="space-y-1 text-left">
          <h3 className="text-2xl md:text-3xl font-serif text-bark-950 font-light" id="creations-section-heading">
            Creations &amp; Feedback Board
          </h3>
          <p className="text-xs text-bark-550 max-w-xl leading-relaxed mt-1 font-sans">
            Explore sewing results, custom fabric choices, and grading tips shared by couturiers worldwide. Leave your own star rating to guide our drafting team.
          </p>
        </div>

        {/* Mode Toggles */}
        <div className="flex bg-sand-100 p-0.5 rounded-lg border border-sand-200/80 w-full md:w-auto shrink-0 self-start md:self-center" id="showroom-tab-nav">
          <button
            onClick={() => { setActiveTab('showroom'); setSubmitSuccess(false); }}
            className={`flex-1 md:flex-none px-4 py-2 text-[10px] font-bold font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'showroom' ? 'bg-white text-bark-900 shadow-3xs' : 'text-bark-500 hover:text-bark-800'
            }`}
          >
            <Shirt className="w-3.5 h-3.5 text-clay-605" /> Showroom ({posts.length})
          </button>

          <button
            onClick={() => { setActiveTab('leave-feedback'); setSubmitSuccess(false); }}
            className={`flex-1 md:flex-none px-4 py-2 text-[10px] font-bold font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'leave-feedback' ? 'bg-white text-bark-900 shadow-3xs' : 'text-bark-500 hover:text-bark-800'
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-clay-605" /> Post Creation &amp; Feedback
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* TAB 1: SHOWROOM GALLERY & FEEDBACK GRID */}
        {activeTab === 'showroom' && (
          <motion.div
            key="showroom-tab-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* INSPIRATION SPOTLIGHT: ATELIER CREATIONS IN THE WILD */}
            {spotlightCreations.length > 0 && (
              <div
                className="w-full bg-sand-50/50 border border-sand-200/60 rounded-lg p-6 md:p-8 space-y-6"
                id="spotlight-carousel-container"
                onMouseEnter={() => setIsCarouselPlaying(false)}
                onMouseLeave={() => setIsCarouselPlaying(true)}
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4" id="spotlight-header">
                  <div className="space-y-1 text-left">
                    <div className="flex items-center gap-2 text-clay-700 font-mono text-[10px] uppercase tracking-widest font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-clay-605" />
                      <span>Inspiration Spotlight • Community Showcase</span>
                    </div>
                    <h4 className="font-serif text-xl md:text-2xl text-bark-900 tracking-tight">
                      Atelier Creations in the Wild
                    </h4>
                    <p className="text-xs text-bark-500 max-w-xl">
                      Real finished garments made by our talented global community of makers. Browse fabric choices, fit reviews, and finished project snapshots.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-auto" id="spotlight-arrows">
                    <button
                      type="button"
                      onClick={handlePrevCarousel}
                      className="p-1.5 border border-sand-200 rounded-[4px] bg-white text-bark-700 hover:bg-sand-100 hover:text-bark-900 transition-colors shadow-2xs cursor-pointer"
                      aria-label="Previous Spotlight"
                      id="prev-spotlight-btn"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextCarousel}
                      className="p-1.5 border border-sand-200 rounded-[4px] bg-white text-bark-700 hover:bg-sand-100 hover:text-bark-900 transition-colors shadow-2xs cursor-pointer"
                      aria-label="Next Spotlight"
                      id="next-spotlight-btn"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main slide element */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-stretch" id="spotlight-slider-grid">
                  {/* Visual Column */}
                  <div className="lg:col-span-5 flex flex-col justify-between" id="spotlight-image-column">
                    <div
                      className="relative aspect-[4/3] sm:aspect-[16/10] lg:aspect-[3/4] w-full rounded-md overflow-hidden shadow-2xs bg-sand-200 group border border-sand-200/50 cursor-pointer"
                      onClick={() => setActiveLightbox(spotlightCreations[carouselIndex])}
                    >
                      <img
                        src={spotlightCreations[carouselIndex].image}
                        alt={spotlightCreations[carouselIndex].title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
                        referrerPolicy="no-referrer"
                      />

                      {/* Image overlay details */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-4 text-left">
                        <div className="space-y-1.5 text-white">
                          <span className="text-[9px] font-mono uppercase bg-clay-605/95 text-sand-100 px-2 py-0.5 rounded inline-block tracking-wider">
                            {spotlightCreations[carouselIndex].targetName}
                          </span>
                          <p className="text-xs font-serif italic text-sand-100 leading-snug truncate">
                            "{spotlightCreations[carouselIndex].title}"
                          </p>

                          <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2 text-[9px] text-sand-200 font-sans">
                            <div className="flex gap-3">
                              <span>Fabric: <strong className="text-white">{spotlightCreations[carouselIndex].fabric || 'Couture fabric'}</strong></span>
                              {spotlightCreations[carouselIndex].size && (
                                <span>Size: <strong className="text-white">{spotlightCreations[carouselIndex].size}</strong></span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLikePost(spotlightCreations[carouselIndex].id);
                              }}
                              className={`flex items-center gap-1 transition-colors cursor-pointer ${
                                spotlightCreations[carouselIndex].liked ? 'text-rose-405' : 'text-sand-300 hover:text-rose-405'
                              }`}
                              id={`spotlight-like-btn-${spotlightCreations[carouselIndex].id}`}
                            >
                              <Heart className={`w-3 h-3 ${spotlightCreations[carouselIndex].liked ? 'fill-current text-rose-405' : ''}`} />
                              <span className="font-mono">{spotlightCreations[carouselIndex].likes}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comment/Quote Details Column */}
                  <div className="lg:col-span-7 flex flex-col justify-between space-y-6 lg:pl-2 text-left" id="spotlight-review-column">
                    <div className="space-y-4 md:space-y-6">
                      {/* Rating and quotes icon */}
                      <div className="flex justify-between items-center" id="spotlight-rating-row">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < spotlightCreations[carouselIndex].rating
                                  ? 'text-[#ba6446] fill-[#ba6446]'
                                  : 'text-sand-300'
                              }`}
                            />
                          ))}
                        </div>
                        <Quote className="w-8 h-8 text-clay-200/80 rotate-180" />
                      </div>

                      {/* Main feedback comment */}
                      <blockquote className="space-y-2">
                        <h5 className="font-serif font-bold text-base text-bark-950 leading-snug">
                          "{spotlightCreations[carouselIndex].title}"
                        </h5>
                        <p className="font-serif text-sm md:text-base text-bark-850 leading-relaxed italic">
                          "{spotlightCreations[carouselIndex].comment}"
                        </p>
                        {spotlightCreations[carouselIndex].tips && spotlightCreations[carouselIndex].tips !== spotlightCreations[carouselIndex].comment && (
                          <div className="mt-3 bg-sand-100/50 p-3 rounded border border-sand-200/50 text-xs text-bark-750 font-sans">
                            <strong className="text-[10px] font-mono text-clay-705 uppercase tracking-wider block mb-1">Maker Fitting Tip:</strong>
                            {spotlightCreations[carouselIndex].tips}
                          </div>
                        )}
                      </blockquote>

                      {/* Author profile */}
                      <div className="flex items-center gap-3 pt-3 border-t border-sand-200/80" id="spotlight-author-row">
                        <img
                          src={spotlightCreations[carouselIndex].avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'}
                          alt={spotlightCreations[carouselIndex].author}
                          className="w-10 h-10 rounded-full object-cover border border-sand-250 shadow-3xs"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <h5 className="font-sans font-bold text-bark-900 text-xs">{spotlightCreations[carouselIndex].author}</h5>
                          <div className="flex items-center gap-2 text-bark-500 text-[10px] font-sans mt-0.5">
                            <span>Verified Maker</span>
                            <span className="w-1 h-1 rounded-full bg-sand-300"></span>
                            <span className="flex items-center gap-1 text-clay-705 font-bold">
                              <Scissors className="w-3 h-3" />
                              {spotlightCreations[carouselIndex].targetName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress indicators at bottom */}
                    <div className="flex items-center gap-1.5 pt-4 border-t border-sand-200/80" id="spotlight-progress-dots">
                      {spotlightCreations.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCarouselIndex(idx)}
                          className={`h-1.5 rounded-full transition-all duration-350 cursor-pointer ${
                            carouselIndex === idx ? 'w-5 bg-clay-605' : 'w-1.5 bg-sand-300 hover:bg-sand-400'
                          }`}
                          title={`Spotlight slide ${idx + 1}`}
                          id={`spotlight-dot-${idx}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search query box and type filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 bg-[#FAF8F5] border border-sand-200/80 p-3 rounded-lg" id="showroom-controls">

              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-bark-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter by designer, pattern name, fabrics (e.g. linen, tweed)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-sand-250 text-xs pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:border-clay-500 text-bark-800 placeholder-bark-400 font-sans shadow-3xs"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
                <span className="text-[10px] text-bark-450 font-bold font-mono uppercase tracking-wider hidden lg:inline">Show:</span>
                {[
                  { id: 'all', label: 'All Entries' },
                  { id: 'creations', label: 'Sewn Makes' },
                  { id: 'atelier-feedback', label: 'Atelier Feedback' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFilterType(opt.id)}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider font-sans border cursor-pointer transition-all ${
                      filterType === opt.id
                        ? 'bg-bark-900 text-white border-bark-900 shadow-3xs'
                        : 'bg-white text-bark-600 border-sand-200 hover:bg-sand-50/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Posts feed grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left" id="showroom-posts-grid">
              {filteredGlobalPosts.length === 0 ? (
                <div className="lg:col-span-2 text-center py-16 border border-dashed border-sand-200 rounded-lg bg-sand-50/25">
                  <MessageCircle className="w-12 h-12 text-bark-300 mx-auto stroke-[1.25] mb-2" />
                  <h4 className="font-serif text-base font-semibold text-bark-900">No entries match your search query</h4>
                  <p className="text-xs text-bark-450 max-w-sm mx-auto leading-normal font-sans mt-1">
                    Try typing generic terms like "wrap dress", "linen", "sizing" or adjust filters.
                  </p>
                </div>
              ) : (
                filteredGlobalPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    layout="position"
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
                    className="border border-sand-250 bg-white rounded-lg p-5 hover:shadow-lux hover:border-sand-300 transition-all duration-300 flex flex-col justify-between space-y-4 relative"
                    id={`showroom-card-${post.id}`}
                  >
                    {/* Creator Info Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={post.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'}
                          alt={post.author}
                          className="w-10 h-10 rounded-full object-cover border border-sand-250 shadow-3xs"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-serif font-bold text-bark-900 text-xs">{post.author}</span>
                            <span className="text-[9px] text-bark-400 font-mono">{post.date}</span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[8.5px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              post.type === 'creation'
                                ? 'bg-clay-50 text-clay-705 border border-clay-100/50'
                                : 'bg-sand-100 text-bark-750 border border-sand-200'
                            }`}>
                              {post.type === 'creation' ? 'Sewn Project' : 'Atelier Support'}
                            </span>
                            <span className="text-[10px] text-bark-500 font-sans italic max-w-[150px] truncate" title={post.targetName}>
                              {post.targetName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stars count */}
                      <div className="flex gap-[0.5px] text-[#ba6446]" id={`stars-post-${post.id}`}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3.5 h-3.5 ${star <= post.rating ? 'fill-current' : 'text-sand-250'}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Post Content */}
                    <div className="space-y-2 flex-1">
                      <h4 className="font-serif text-sm font-semibold text-bark-950 leading-tight">
                        {post.title}
                      </h4>
                      <p className="text-[11.5px] text-bark-650 leading-relaxed font-sans">
                        {post.comment}
                      </p>

                      {/* Pattern specific layout cards */}
                      {post.type === 'creation' && (
                        <div className="space-y-3 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[9.5px]">
                            {post.fabric && (
                              <span className="bg-[#FAF8F5] border border-sand-200 px-2.5 py-0.5 rounded text-bark-700 font-sans">
                                <strong className="text-[8px] font-mono text-bark-450 uppercase mr-1">Fabric:</strong>
                                {post.fabric}
                              </span>
                            )}
                            {post.size && (
                              <span className="bg-[#FAF8F5] border border-sand-200 px-2 py-0.5 rounded text-bark-700 font-mono font-bold">
                                Size {post.size}
                              </span>
                            )}
                          </div>

                          {post.image && (
                            <div
                              onClick={() => setActiveLightbox(post)}
                              className="relative rounded overflow-hidden aspect-[16/9] border border-sand-200/60 bg-sand-50 shadow-3xs max-h-[160px] cursor-pointer group"
                            >
                              <img
                                src={post.image}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="bg-white/95 text-bark-850 p-2 rounded-full shadow-3xs">
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {post.type === 'feedback' && post.topicLabel && (
                        <div className="pt-1.5">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold font-mono uppercase bg-sand-50 border border-sand-200 px-2 py-0.5 rounded text-bark-600">
                            Topic: {post.topicLabel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Social engagement panel */}
                    <div className="border-t border-sand-150 pt-3 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-bark-500 font-sans">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleLikePost(post.id)}
                            className={`flex items-center gap-1.5 font-bold transition-all hover:scale-103 cursor-pointer ${
                              post.liked ? 'text-clay-705' : 'hover:text-bark-800'
                            }`}
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 ${post.liked ? 'fill-current text-clay-705' : ''}`} />
                            <span>Helpful ({post.likes})</span>
                          </button>

                          <button
                            onClick={() => setActiveReplyBox(activeReplyBox === post.id ? null : post.id)}
                            className="flex items-center gap-1 hover:text-bark-800 font-medium cursor-pointer"
                          >
                            <MessageSquareMore className="w-3.5 h-3.5 text-bark-450" />
                            <span>Comments ({post.replies?.length || 0})</span>
                          </button>
                        </div>

                        <span className="text-[9.5px] text-bark-400 font-mono">Verified Atelier User</span>
                      </div>

                      {/* Nested comment threads */}
                      {post.replies && post.replies.length > 0 && (
                        <div className="bg-sand-50/50 rounded-md border border-sand-150 p-2.5 space-y-2.5 max-h-[180px] overflow-y-auto" id={`replies-container-${post.id}`}>
                          {post.replies.map((reply) => {
                            const isStaff = reply.author.includes('Madame') || reply.author.includes('Couturier');
                            return (
                              <div key={reply.id} className="text-[10.5px] leading-normal font-sans border-l-2 border-sand-200 pl-2.5 py-0.5 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <strong className={`font-serif text-[11px] ${isStaff ? 'text-clay-750 font-bold' : 'text-bark-800'}`}>
                                    {reply.author}
                                  </strong>
                                  {isStaff && (
                                    <span className="text-[7px] bg-clay-50 border border-clay-150/40 text-clay-705 font-bold font-mono px-1 rounded-full">
                                      Atelier Staff
                                    </span>
                                  )}
                                  <span className="text-[8px] font-mono text-bark-400">{reply.date}</span>
                                </div>
                                <p className="text-bark-600">{reply.comment}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Text field reply trigger */}
                      <AnimatePresence>
                        {activeReplyBox === post.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-2 flex items-center gap-2 overflow-hidden"
                            id={`reply-box-${post.id}`}
                          >
                            <input
                              type="text"
                              placeholder="Write a comment or ask a question about their fabric..."
                              value={replyText[post.id] || ''}
                              onChange={(e) => setReplyText(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddReply(post.id)}
                              className="flex-1 bg-sand-50/50 border border-sand-200 rounded px-2.5 py-1.5 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans placeholder-bark-400"
                            />
                            <button
                              onClick={() => handleAddReply(post.id)}
                              className="bg-bark-900 hover:bg-clay-605 text-white p-2 rounded transition-colors cursor-pointer shrink-0"
                            >
                              <Send className="w-3 h-3" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: GLOBAL WRITE REVIEW AND GUESTBOOK SUBMIT FORM */}
        {activeTab === 'leave-feedback' && (
          <motion.div
            key="leave-feedback-tab-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-2xl mx-auto text-left"
          >
            {submitSuccess ? (
              <div className="bg-sand-50/30 border border-sand-200 rounded-lg p-8 text-center space-y-6" id="feedback-success-card">
                <div className="w-16 h-16 bg-clay-50 border border-clay-100 rounded-full flex items-center justify-center mx-auto text-clay-700 shadow-3xs">
                  <Check className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-serif text-xl font-bold text-bark-900">Creation &amp; Review Securely Logged</h4>
                  <p className="text-xs text-bark-550 font-sans max-w-sm mx-auto">
                    Your stars rating, comment tips, and specifications have been added to the guestbook records.
                  </p>
                </div>

                {/* Madame Genevieve's Tailor Reply Block */}
                {atelierReply && (
                  <div className="bg-white border border-sand-150 p-4 rounded-md text-left relative overflow-hidden shadow-2xs max-w-lg mx-auto">
                    <div className="absolute top-1 right-2 opacity-[0.05] pointer-events-none">
                      <Scissors className="w-16 h-16 text-bark-950" />
                    </div>
                    <span className="text-[8px] font-bold font-mono tracking-wider text-clay-705 uppercase bg-clay-50 px-2 py-0.5 rounded inline-block mb-2">
                      In-House Couturier Reply
                    </span>
                    <p className="text-xs text-bark-750 font-serif leading-relaxed italic">
                      "{atelierReply}"
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-bark-900 flex items-center justify-center text-[10px] text-white font-serif font-bold">
                        G
                      </div>
                      <span className="text-[10px] font-bold text-bark-900 font-sans">Madame Geneviève &bull; Head Couturier</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-center gap-3 pt-3">
                  <button
                    onClick={() => { setSubmitSuccess(false); setActiveTab('showroom'); }}
                    className="bg-bark-900 hover:bg-bark-950 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                  >
                    View Showroom Feed
                  </button>
                  <button
                    onClick={() => { setSubmitSuccess(false); }}
                    className="bg-white hover:bg-sand-50 text-bark-800 border border-sand-250 text-xs font-semibold px-5 py-2.5 rounded-lg transition-all cursor-pointer shadow-3xs"
                  >
                    Post Another Entry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-sand-50/20 border border-sand-250 rounded-lg p-6 md:p-8 space-y-6" id="central-creation-feedback-form">

                {/* Mode toggle */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-bark-450 font-mono font-bold uppercase tracking-wider block">
                    What would you like to post?
                  </label>
                  <div className="grid grid-cols-2 gap-3" id="selection-target-btns">
                    <button
                      type="button"
                      onClick={() => { setCreationTarget('atelier'); setFormRating(5); }}
                      className={`py-3.5 px-4 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                        creationTarget === 'atelier'
                          ? 'border-clay-500 bg-clay-50/10 text-clay-705 shadow-3xs'
                          : 'border-sand-200 bg-white text-bark-700 hover:border-sand-300 shadow-3xs'
                      }`}
                    >
                      <strong className="text-xs font-serif font-bold">Atelier Feedback</strong>
                      <span className="text-[9.5px] leading-tight font-sans text-bark-500 mt-1">
                        Rate instruction booklets, website features, or request new drafts.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCreationTarget(patterns[0]?.id || 'sartorial-01');
                        setFormRating(5);
                      }}
                      className={`py-3.5 px-4 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                        creationTarget !== 'atelier'
                          ? 'border-clay-500 bg-clay-50/10 text-clay-705 shadow-3xs'
                          : 'border-sand-200 bg-white text-bark-700 hover:border-sand-300 shadow-3xs'
                      }`}
                    >
                      <strong className="text-xs font-serif font-bold">Pattern Creation / Review</strong>
                      <span className="text-[9.5px] leading-tight font-sans text-bark-500 mt-1">
                        Share star ratings, fabric choices, and photos for a specific design.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Sub dropdown option */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creationTarget !== 'atelier' ? (
                    <div className="space-y-1">
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="creation-pattern-select">
                        Select Sewing Pattern Crafted
                      </label>
                      <select
                        id="creation-pattern-select"
                        value={creationTarget}
                        onChange={(e) => setCreationTarget(e.target.value)}
                        className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 cursor-pointer shadow-3xs"
                      >
                        {patterns.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1" htmlFor="feedback-topic-select">
                        Primary Feedback Category
                      </label>
                      <select
                        id="feedback-topic-select"
                        value={formTopic}
                        onChange={(e) => setFormTopic(e.target.value)}
                        className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 cursor-pointer shadow-3xs"
                      >
                        <option value="sizing-fit">Sizing &amp; Proportions Fit</option>
                        <option value="instruction-clarity">Instruction Booklets Clarity</option>
                        <option value="pattern-request">Feature / Design Pattern Request</option>
                        <option value="general">General Atelier Feedback</option>
                      </select>
                    </div>
                  )}

                  {/* Rating stars */}
                  <div className="space-y-1">
                    <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block mb-1">
                      Star Rating
                    </label>
                    <div className="flex items-center gap-1 bg-white border border-sand-200 rounded-lg px-3 py-1 h-[38px] shadow-3xs">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 focus:outline-none transition-transform active:scale-90 cursor-pointer"
                        >
                          <Star
                            className={`w-5.5 h-5.5 ${
                              star <= (hoverRating || formRating)
                                ? 'fill-current text-[#ba6446]'
                                : 'text-sand-250'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Profile credentials */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block" htmlFor="designer-name-input">
                      Designer / Maker Username
                    </label>
                    <input
                      id="designer-name-input"
                      type="text"
                      required
                      placeholder="e.g. GenevieveSews or Clara_M"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans shadow-3xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block" htmlFor="designer-email-input">
                      Email Address (Optional)
                    </label>
                    <input
                      id="designer-email-input"
                      type="email"
                      placeholder="e.g. yourname@example.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans shadow-3xs"
                    />
                  </div>
                </div>

                {/* Creation specific fields */}
                {creationTarget !== 'atelier' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block" htmlFor="form-fabric-input">
                        Fabric Selection
                      </label>
                      <input
                        id="form-fabric-input"
                        type="text"
                        placeholder="e.g. Mediumweight Washed Belgian Linen"
                        value={formFabric}
                        onChange={(e) => setFormFabric(e.target.value)}
                        className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans shadow-3xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block" htmlFor="form-size-select">
                        Size Sewed
                      </label>
                      <select
                        id="form-size-select"
                        value={formSize}
                        onChange={(e) => setFormSize(e.target.value)}
                        className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 cursor-pointer shadow-3xs"
                      >
                        {['2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'].map(sz => (
                          <option key={sz} value={sz}>Size {sz} Draft</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Upload drag-zone for creations */}
                {creationTarget !== 'atelier' && (
                  <div className="space-y-1.5">
                    <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block">
                      Attach Creation Photo (Highly Recommended)
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 relative overflow-hidden ${
                        uploadedImage
                          ? 'border-clay-500 bg-clay-50/5'
                          : 'border-sand-250 hover:border-sand-400 bg-white hover:bg-sand-50/20 shadow-3xs'
                      }`}
                      id="creation-photo-dropzone"
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />

                      {uploadedImage ? (
                        <div className="relative w-full max-w-[280px] aspect-[16/9] rounded overflow-hidden shadow-xs border border-sand-200">
                          <img
                            src={uploadedImage}
                            alt="Attached project snapshot"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadedImage(null);
                              setUploadedImageFile(null);
                            }}
                            className="absolute top-1.5 right-1.5 bg-black/60 text-white p-1 rounded-full hover:bg-black/85 transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="py-1 flex flex-col items-center space-y-2">
                          <Upload className="w-6 h-6 text-clay-605" />
                          <div className="text-xs text-bark-800 font-sans">
                            <span className="font-bold text-clay-700">Click to upload</span> or drag and drop a beautiful finished garment snapshot
                          </div>
                          <span className="text-[9px] text-bark-400 leading-none">Supports PNG, JPEG. Persisted in dynamic cache state.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Text summary and detailed advice */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block" htmlFor="form-title-input">
                      Headline Summary Title
                    </label>
                    <input
                      id="form-title-input"
                      type="text"
                      required
                      placeholder="e.g. Dream dress to style, fits true to standard chart sizing"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans shadow-3xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9.5px] text-bark-450 font-mono font-bold uppercase tracking-wider block" htmlFor="form-comment-textarea">
                      Detailed Review Comments / Fitting Tips / Sizing advice
                    </label>
                    <textarea
                      id="form-comment-textarea"
                      rows={4}
                      required
                      placeholder={
                        creationTarget === 'atelier'
                          ? "Write your design feedback here. Madame Geneviève reads every entry!"
                          : "How clear were the technical guides? Share your seam finishing recommendations, length alterations, or grading advice."
                      }
                      value={formComment}
                      onChange={(e) => setFormComment(e.target.value)}
                      className="w-full bg-white border border-sand-200 rounded-lg px-3 py-2 text-xs text-bark-800 focus:outline-none focus:border-clay-500 font-sans placeholder-bark-400 shadow-3xs"
                    />
                  </div>
                </div>

                {/* Submitting buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('showroom')}
                    className="bg-white hover:bg-sand-50 text-bark-800 border border-sand-250 text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors cursor-pointer shadow-3xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-bark-900 hover:bg-bark-950 disabled:bg-sand-250 text-sand-50 disabled:text-bark-400 text-xs font-semibold px-6 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-sand-50 border-t-transparent rounded-full animate-spin" />
                        <span>Logging to Memory Vault...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Publish Entry</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* REUSABLE LIGHTBOX OVERLAY */}
      {renderLightboxOverlay()}
    </section>
  );

  // HELPER FUNCTION TO RENDER INTEGRATED PREMIUM LIGHTBOX ZOOM MODAL
  function renderLightboxOverlay() {
    return (
      <AnimatePresence id="lightbox-overlay-block">
        {activeLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveLightbox(null)}
            className="fixed inset-0 bg-bark-950/90 backdrop-blur-md z-150 flex items-center justify-center p-4 cursor-zoom-out"
            id="gallery-lightbox-modal"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[4px] overflow-hidden max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 max-h-[90vh] shadow-2xl relative cursor-default text-left"
              id="lightbox-card"
            >

              <button
                onClick={() => setActiveLightbox(null)}
                className="absolute top-3 right-3 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/85 transition-all z-10 cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Large image left column */}
              <div className="md:col-span-7 bg-black flex items-center justify-center h-[40vh] md:h-[650px] overflow-hidden relative">
                <img
                  src={activeLightbox.image}
                  alt={activeLightbox.title || activeLightbox.caption}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Specs detailed panel right column */}
              <div className="md:col-span-5 p-5 md:p-6 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-[650px] space-y-4" id="lightbox-details">
                <div className="space-y-4">

                  {/* Author avatar */}
                  <div className="flex items-center gap-3">
                    <img
                      src={activeLightbox.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'}
                      alt={activeLightbox.author}
                      className="w-10 h-10 rounded-full border border-sand-200 object-cover"
                    />
                    <div>
                      <h4 className="font-bold text-bark-900 text-sm leading-tight">{activeLightbox.author}</h4>
                      <p className="text-[10px] text-bark-450 font-mono">Published on {activeLightbox.date}</p>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-[0.5px] text-[#ba6446]" id="lightbox-stars">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= activeLightbox.rating ? 'fill-current' : 'text-sand-300'}`} />
                      ))}
                    </div>

                    {activeLightbox.size && (
                      <span className="text-[9px] font-bold font-mono bg-sand-100 border border-sand-200 px-2 py-0.5 rounded text-bark-800">
                        Size {activeLightbox.size}
                      </span>
                    )}

                    {activeLightbox.difficulty && (
                      <span className="text-[9px] font-bold font-mono bg-clay-50 border border-clay-150 px-2 py-0.5 rounded text-clay-850">
                        {activeLightbox.difficulty} Draft
                      </span>
                    )}
                  </div>

                  {/* Body description */}
                  <div className="space-y-2 border-t border-sand-200/80 pt-3 text-xs leading-relaxed text-bark-750">
                    <div>
                      <span className="font-bold font-mono text-[9px] text-bark-400 uppercase tracking-widest block mb-0.5">Headline Title</span>
                      <p className="italic font-sans text-bark-800 font-semibold text-[13px]">"{activeLightbox.title || 'Atelier Showcase'}"</p>
                    </div>

                    <div>
                      <span className="font-bold font-mono text-[9px] text-bark-400 uppercase tracking-widest block mb-0.5">Maker Review &amp; Fitting Advice</span>
                      <p className="font-sans text-bark-700 leading-relaxed">{activeLightbox.comment || activeLightbox.tips}</p>
                    </div>
                  </div>

                  {/* Fabric details */}
                  {activeLightbox.fabric && (
                    <div className="text-xs font-sans">
                      <span className="font-bold font-mono text-[9px] text-bark-400 uppercase tracking-widest block mb-1">Fabric Specification</span>
                      <span className="inline-block bg-sand-100 px-2.5 py-1 rounded-[4px] border border-sand-200 font-medium text-bark-800">
                        {activeLightbox.fabric}
                      </span>
                    </div>
                  )}

                </div>

                {/* Helpful Like Button */}
                <div className="border-t border-sand-200/80 pt-4 flex items-center justify-between">
                  <button
                    onClick={() => handleLikePost(activeLightbox.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold font-mono px-3.5 py-2 rounded border cursor-pointer transition-all ${
                      activeLightbox.liked
                        ? 'bg-clay-50 border-clay-200 text-clay-700 shadow-3xs'
                        : 'bg-white border-sand-250 text-bark-600 hover:bg-sand-50 hover:text-bark-850'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${activeLightbox.liked ? 'fill-current text-clay-605' : ''}`} />
                    <span>{activeLightbox.liked ? 'Helpful Vote Cast' : 'Vote Helpful'} ({activeLightbox.likes})</span>
                  </button>

                  <span className="text-[10px] text-bark-400 font-mono">Atelier Verified Make</span>
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
}
