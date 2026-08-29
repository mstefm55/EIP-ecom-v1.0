/**
 * Development/runtime fallback records.
 *
 * These are NOT UI metadata and NOT authoritative business data. They exist only
 * so the local adapter can render the prototype before an EIP repository is
 * connected. User-authored/runtime content stays in its source language.
 */

import dressImg from '../assets/images/pattern_dress_1782223486101.jpg';
import trenchImg from '../assets/images/pattern_trench_1782223501914.jpg';
import trouserImg from '../assets/images/pattern_trouser_1782223515288.jpg';
import blouseImg from '../assets/images/pattern_blouse_1782223531046.jpg';
import { MASTER_SIZING_TABLE } from './masterSizingTable.js';

// Local catalogue development seed. Runtime product authority belongs to the catalogue repository / EIP.
const INITIAL_PATTERNS = [
  {
    id: 'sartorial-01',
    name: 'Aurelia Wrap Dress',
    tagline: 'Modern Elegance in Flowing Silhouette',
    description: 'An elegant asymmetrical wrap dress featuring structured dolman sleeves, full midi-length skirt, and unique waist tie closures. Perfect for linen, silk crepes, or lightweight tencel. This pattern offers an easy-to-wear silhouette that adapts seamlessly from day to night, showcasing timeless design details and clean-finished seams.',
    category: 'Dresses',
    difficulty: 'Intermediate',
    pricePDF: 14.0,
    pricePrinted: 24.0,
    image: dressImg,
    sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
    fabricSuggestions: [
      'Midweight Linen',
      'Tencel Twill',
      'Silk Crepe de Chine',
      'Lightweight Wool Crepe',
      'Rayon Challis'
    ],
    yardageInfo: {
      width44: '3.8 Yards',
      width60: '3.0 Yards'
    },
    measurementsTable: MASTER_SIZING_TABLE,
    features: [
      'Self-lined wrap front bodice',
      'Interior secure button fastening',
      'Deep, elegant in-seam pockets',
      'French-seamed interior finishes',
      'Fitted waist with optional tie belt or slide-ring closure'
    ],
    notions: [
      '1x 15mm flat interior button',
      '0.5 yards lightweight fusible interfacing',
      'Matching all-purpose thread'
    ],
    tutorial: {
      videoUrl: "https://www.youtube.com/embed/gAnS9b_P04w",
      duration: "18:24",
      instructor: "Isabella Perfect Fit",
      difficulty: "Intermediate",
      steps: [
        { time: "00:00", title: "Introduction & Sizing Prep", desc: "Choosing your target size based on chest and waist metrics. Checking fabric layout rules." },
        { time: "02:15", title: "Cutting & Interfacing Bodice Facings", desc: "Applying featherweight stay-interfacing to front wrap facings to prevent any gaping or bias stretching." },
        { time: "04:50", title: "Assembling Dolman Sleeves", desc: "Stitching upper and lower sleeve seams with a luxurious French seam approach for raw-edge protection." },
        { time: "07:35", title: "Constructing Bodice and Side Pockets", desc: "Stitching side-entry secret pockets to the main skirt panel with reinforcement stays." },
        { time: "11:15", title: "Joining Waistbands & Hemming", desc: "Attaching the wrap-around ties. Narrow-double folding the lower curved dress hem for an immaculate finish." }
      ],
      tips: [
        "Staystitch the neckline immediately upon cutting to preserve shape.",
        "Always press seams twice: first flat to lock stitches, then open or side-pressed."
      ]
    }
  },
  {
    id: 'sartorial-02',
    name: 'Perfect Fit Utility Trench',
    tagline: 'A Masterclass in Structured Outerwear',
    description: 'A striking modern outerwear staple. Features a relaxed double-breasted closure, drop shoulders, deep storm flaps, adjustable wrist straps, and a dramatic storm shield back details. This pattern teaches fundamental tailoring skills, from constructing welt pockets to compiling clean collar stands.',
    category: 'Outerwear',
    difficulty: 'Advanced',
    pricePDF: 18.0,
    pricePrinted: 28.0,
    image: trenchImg,
    sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
    fabricSuggestions: [
      'Cotton Cotton Gabardine',
      'Water-resistant Twill',
      'Heavyweight Linen',
      'Waxed Canvas',
      'Dry Oilskin'
    ],
    yardageInfo: {
      width44: '5.2 Yards',
      width60: '4.1 Yards',
      lining: '3.2 Yards'
    },
    measurementsTable: MASTER_SIZING_TABLE,
    features: [
      'Fully lined interior with clean piping options',
      'Dual welt pockets with button-down flaps',
      'Angled epaulets on shoulders',
      'Detachable waist belt with thread loops',
      'Two-piece structured sleeves'
    ],
    notions: [
      '10x 25mm double-breasted buttons',
      '2x 20mm collar/epaulet buttons',
      '1x 50mm rectangular belt buckle',
      '2x 25mm sleeve buckles',
      '2.5 yards medium-weight woven fusible interfacing'
    ],
    tutorial: {
      videoUrl: "https://www.youtube.com/embed/Z0H-B9e_pao",
      duration: "28:45",
      instructor: "Charles Beauvoir",
      difficulty: "Advanced",
      steps: [
        { time: "00:00", title: "Trench Coat Construction Roadmap", desc: "Walking through tailoring stages. Interfacing collar stands, lapels, and pocket openings." },
        { time: "03:40", title: "Sewing Rear Storm Shield Flap", desc: "Stitching lining to shield, clean turning and topstitching. Pleating lower back skirt vents." },
        { time: "08:15", title: "Assembling Collar and Lapel Stands", desc: "Precision seam trimming and understitching to get crisp outer edge rolls on standard double-breasted collar." },
        { time: "14:50", title: "Dual Welt Pockets with Button Flaps", desc: "Marking welt rectangles, slashing fabric, turning pocket bags inside-out, and topstitching the flap borders." },
        { time: "21:10", title: "Tailored Sleeves, Shoulder Epaulets, & Linings", desc: "Inserting sleeve shoulder headers, adding adjustable sleeve buckle cuffs, and sewing outer coat to lining." }
      ],
      tips: [
        "Use a heavy-duty jeans/denim needle (90/14) to pierce multi-layer seams without missing stitches.",
        "A wooden clapper is your secret weapon: steam seam, press clapper firmly for 5 seconds to get razor-sharp collars."
      ]
    }
  },
  {
    id: 'sartorial-03',
    name: 'Palazzo Wide-Leg Trouser',
    tagline: 'Architectural Flow and Sophisticated Seaming',
    description: 'Refined trousers featuring a high waisted rise, sharp pressed front creases, elegant architectural front pleats, slant side pockets, and double welt back pockets. Engineered for beautiful movement and crisp drape. Perfect in high-quality wool suiting or structured heavy crepes.',
    category: 'Trousers',
    difficulty: 'Intermediate',
    pricePDF: 13.0,
    pricePrinted: 22.0,
    image: trouserImg,
    sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
    fabricSuggestions: [
      'Wool Suiting Crepe',
      'Structured Tencel / Linen Blends',
      'Heavyweight Cotton Twill',
      'Silk Bamboo Velvet',
      'Viscose Pique'
    ],
    yardageInfo: {
      width44: '2.8 Yards',
      width60: '2.2 Yards'
    },
    measurementsTable: MASTER_SIZING_TABLE,
    features: [
      'Clean contour waistband with fly zipper closure',
      'Fully bound pocket bags and clean crotch seams',
      'Asymmetrical side front pleats',
      'Back waist darts for customized contour shaping',
      'Generous 2-inch let-down blind hem'
    ],
    notions: [
      '1x 7-inch nylon zipper (matching color)',
      '1x heavy-duty trouser bar-closure/hook',
      '1x 15mm flat anchor button',
      '0.8 yards pocket lining fabric',
      '0.7 yards pocket stabilizer tencel tape'
    ],
    tutorial: {
      videoUrl: "https://www.youtube.com/embed/rP1p2C5q61w",
      duration: "21:10",
      instructor: "Lucia Moretti",
      difficulty: "Intermediate",
      steps: [
        { time: "00:00", title: "Trouser Construction & Fly Preparation", desc: "Applying stay-tape to front pocket diagonals. Choosing target size 0-22." },
        { time: "02:40", title: "Sewing Front Side Slant Pockets", desc: "Assembling pockets using lining fabric. Topstitching pocket entries with a 1/4 inch gauge line." },
        { time: "06:15", title: "Impeccable Trouser Fly Zipper", desc: "Constructing underlap guard, zipper shield, and topstitching front J-curve flawlessly." },
        { time: "12:50", title: "Architectural Front Pleats & Darts", desc: "Basting front asymmetrical pleats in place before joining the contour waistband." },
        { time: "17:30", title: "Contour Waistband & Blind Hemming", desc: "Attaching waistband with inside anchor button, followed by pressing professional front leg creases." }
      ],
      tips: [
        "Place trouser pieces face-to-face when cutting to ensure left/right asymmetry matches.",
        "Hang trousers by cuffs for 24 hours before hemming to let the bias drape settle completely."
      ]
    }
  },
  {
    id: 'sartorial-04',
    name: 'Luminary Asymmetric Drape Blouse',
    tagline: 'Minimalist Fluidity with Elegant Drapery',
    description: 'An elegant fluid camisole wrap top celebrating sculptural draping and asymmetry. Features single shoulder gather detail, asymmetrical neckline, and hidden bias binding finish. Simple to sew yet profoundly striking in design. Effortlessly luxurious in high-quality silk or tencel satin.',
    category: 'Tops',
    difficulty: 'Beginner',
    pricePDF: 11.0,
    pricePrinted: 19.0,
    image: blouseImg,
    sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
    fabricSuggestions: [
      'Silk Satin / Crepe back Satin',
      'Sandwashed Cupro',
      'Fluid Linen Viscose Satin',
      'Modal Jersey',
      'Crinkle Chiffon'
    ],
    yardageInfo: {
      width44: '1.9 Yards',
      width60: '1.4 Yards'
    },
    measurementsTable: MASTER_SIZING_TABLE,
    features: [
      'Unstructured modern silhouette',
      'Clean asymmetrical drape collar',
      'Seamless raw or narrow double hem',
      'Bias cut underarm wraps for active comfort',
      'Minimal stitching lines for premium aesthetic flow'
    ],
    notions: [
      'Matching silk thread',
      'Fine microtex sewing needles',
      '0.25 yards ultralight soluble stay tape'
    ],
    tutorial: {
      videoUrl: "https://www.youtube.com/embed/A9f9fD7Z79I",
      duration: "13:15",
      instructor: "Isabella Perfect Fit",
      difficulty: "Beginner",
      steps: [
        { time: "00:00", title: "Getting Started: Bias Cut Working", desc: "Understanding grainlines. Laying out fabric at a 45-degree angle to maximize beautiful cowl drapery." },
        { time: "01:50", title: "Shoulder Gathers & Facing Prep", desc: "Running basting stitches for shoulder gathers and applying soluble stabilizer stay tape." },
        { time: "04:30", title: "Joining Side Seams & Wraps", desc: "Sewing side-seam wraps with narrow seams. Finely turning underarm curves." },
        { time: "08:10", title: "Securing Asymmetrical Neckline", desc: "Turning the collar roll facing and securing it with micro-slashes to prevent pulling." },
        { time: "11:00", title: "Double-Fold Silk Hemming", desc: "Executing a premium baby hem on delicate silk/rayon satin fabric." }
      ],
      tips: [
        "Never stretch bias-cut edges while feeding them through your sewing machine.",
        "A tissue-paper backing under seams prevents delicate satins from puckering during construction."
      ]
    }
  }
];

// Procedurally expand to 500 unique patterns to showcase full scale pagination
const adjectives = [
  'Aurelia', 'Luminary', 'Perfect Fit', 'Palazzo', 'Seraphina', 'Meridian', 'Solstice', 'Gilded',
  'Verdant', 'Bespoke', 'Heirloom', 'Chiffon', 'Couture', 'Tweed', 'Vintage', 'Classic',
  'Modern', 'Renaissance', 'Riviera', 'Perfect Fit', 'Heritage', 'Nordic', 'Metropolitan', 'Imperial',
  'Vanguard', 'Ethereal', 'Saffron', 'Tuscan', 'Obsidian', 'Alabaster', 'Regal', 'Siren',
  'Opus', 'Zephyr', 'Valerie', 'Camille', 'Margaux', 'Elise', 'Genevieve', 'Adeline',
  'Isabella', 'Florence', 'Cynthia', 'Rosalie', 'Octavia', 'Beatrix', 'Evelyn', 'Vivienne'
];

const designStyles = [
  'Asymmetric', 'Structured', 'Fluid', 'Minimalist', 'Tailored', 'Relaxed', 'Contoured', 'Double-Breasted',
  'High-Waisted', 'Pleated', 'Draped', 'Reversible', 'Paneled', 'Tiered', 'Gathered', 'Geometric'
];

const categoriesData = [
  {
    category: 'Dresses',
    types: ['Dress', 'Gown', 'Midi Dress', 'Sun Dress', 'Slip Dress', 'Wrap Dress'],
    image: dressImg,
    fabrics: ['Midweight Linen', 'Tencel Twill', 'Silk Crepe', 'Rayon Challis', 'Cotton Voile'],
    features: ['Invisible side pocket entry', 'Self-faced hemline finishes', 'Adjustable sash closure', 'French-seamed interior seams'],
    notions: ['1x invisible zipper 22"', '1x small eye hook', 'Matching thread']
  },
  {
    category: 'Outerwear',
    types: ['Trench', 'Coat', 'Jacket', 'Cape', 'Blazer', 'Overcoat'],
    image: trenchImg,
    fabrics: ['Cotton Gabardine', 'Water-resistant Twill', 'Heavy Wool Coating', 'Waxed Canvas', 'Boiled Wool'],
    features: ['Double breasted front flap', 'Fully lined with satin lining', 'Two-piece tailored sleeves', 'Storm flap on back bodice'],
    notions: ['8x 25mm buttons', '1 yard fusible stabilizer', 'Matching heavy thread']
  },
  {
    category: 'Trousers',
    types: ['Trouser', 'Pants', 'Culottes', 'Slacks', 'Palazzo Pants', 'Chinos'],
    image: trouserImg,
    fabrics: ['Wool Suiting Crepe', 'Heavy Linen', 'Cotton Twill', 'Sateen', 'Corduroy'],
    features: ['Contoured high rise waistband', 'Slanted front side pockets', 'Double welt rear pockets', 'Curved back yoke shaping'],
    notions: ['1x brass fly zipper 7"', '1x trouser bar-closure clasp', '0.5 yards pocket lining']
  },
  {
    category: 'Tops',
    types: ['Blouse', 'Shirt', 'Top', 'Tunic', 'Cami', 'Bodice'],
    image: blouseImg,
    fabrics: ['Silk Satin', 'Sandwashed Cupro', 'Linen Viscose Blend', 'Cotton Lawn', 'Georgette'],
    features: ['Asymmetrical draped neck cowl', 'Bias cut underarm seams', 'Delicate keyhole back opening', 'Narrow double-fold hemlines'],
    notions: ['1x small button', 'Matching fine silk thread', 'Soluble stays stabilizer tape']
  }
];

const generateExtendedPatterns = (basePatterns, targetCount) => {
  const list = [...basePatterns];
  let currentIdNum = basePatterns.length + 1;

  while (list.length < targetCount) {
    const idx = list.length;
    const adj = adjectives[idx % adjectives.length];
    const style = designStyles[(idx + 3) % designStyles.length];
    const catObj = categoriesData[idx % categoriesData.length];
    const type = catObj.types[(idx + 7) % catObj.types.length];

    const name = `${adj} ${style} ${type}`;
    const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
    const difficulty = difficultyOptions[(idx + 1) % difficultyOptions.length];

    // Seed price realistically
    const pricePDF = parseFloat((10 + (idx % 11) + (idx % 3 === 0 ? 0.5 : 0)).toFixed(2));
    const pricePrinted = parseFloat((pricePDF + 8 + (idx % 5)).toFixed(2));

    list.push({
      id: `perfectfit-gen-${String(currentIdNum).padStart(3, '0')}`,
      name: name,
      tagline: `Elegant ${style.toLowerCase()} draft ideal for custom-made bespoke styling.`,
      description: `A masterfully designed ${name.toLowerCase()} tailored for modern sewists. Featuring clear guidelines, digital printing specifications, and full sizing layout parameters, this ${catObj.category.slice(0, -1).toLowerCase()} template promises an impeccable fit and exquisite drape. Perfect to expand your private perfect fit collection.`,
      category: catObj.category,
      difficulty: difficulty,
      pricePDF: pricePDF,
      pricePrinted: pricePrinted,
      image: catObj.image,
      sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
      fabricSuggestions: catObj.fabrics,
      yardageInfo: {
        width44: `${(2.2 + (idx % 4) * 0.4).toFixed(1)} Yards`,
        width60: `${(1.6 + (idx % 4) * 0.3).toFixed(1)} Yards`
      },
      measurementsTable: MASTER_SIZING_TABLE,
      features: catObj.features,
      notions: catObj.notions,
      tutorial: {
        videoUrl: "https://www.youtube.com/embed/gAnS9b_P04w",
        duration: "14:15",
        instructor: "Elena Vance",
        difficulty: difficulty,
        steps: [
          { time: "00:00", title: `Pattern Overview & Sizing for ${name}`, desc: `Walking through sizing guidelines for standard 0-22 and printing the blueprint pattern pages.` },
          { time: "01:45", title: `Fabric Layout & Cutting Advice`, desc: `Arranging your ${catObj.fabrics[0]} on the cutting table. Pinning pattern pieces aligned with the fabric grain.` },
          { time: "03:50", title: `Assembling Main Seams`, desc: `Stitching the primary panels together using professional seam-finishing techniques.` },
          { time: "07:20", title: `Attaching Professional Facings`, desc: `Installing facings or linings with precise corner trimming and understitching.` },
          { time: "11:10", title: `Finishing Touches & Hand Sewn Details`, desc: `Creating a narrow-folded hem and pressing the finished garment with hot steam.` }
        ],
        tips: [
          "Always perform a test stitch on a scrap piece of your fabric to calibrate machine tension.",
          "Press every seam flat and then open immediately after sewing for an impeccable drape."
        ]
      }
    });

    currentIdNum++;
  }

  return list;
};


export const CATALOG_PRODUCT_SEED = generateExtendedPatterns(INITIAL_PATTERNS, 500);

// Source snapshot: src/components/ConsultationBookingModal.jsx :: CONSULTATION_EXPERTS
export const CONSULTATION_EXPERT_SEED = [
  {
    id: 'elena',
    name: 'Madame Elena Vance',
    role: 'Lead Couture Draper',
    bio: 'Specialist in bias-cut gowns, tailored tailoring, and Renaissance pleated patterns.',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
    experience: '22+ Years in Haute Couture',
    tags: ['Bias-cut', 'Draping', 'Pleating']
  },
  {
    id: 'marcus',
    name: 'Marcus Sterling',
    role: 'Master Bespoke Tailor',
    bio: 'Expert in structured jackets, tailcoats, precision pattern matching, and complex fit metrics.',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
    experience: '18 Years Tailoring Masterclass',
    tags: ['Suits', 'Fit adjustments', 'Collars']
  },
  {
    id: 'soraya',
    name: 'Soraya Thorne',
    role: 'Sustainable Textile Curator',
    bio: 'Advisor on wool weights, linen draping properties, eco-dyes, and yardage optimizations.',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    experience: '12 Years Eco-Fashion',
    tags: ['Fabrics', 'Eco-sourcing', 'Yardage']
  }
];

// Source snapshot: src/components/CreationsAndFeedback.jsx :: DEFAULT_SHOWROOM_POSTS
export const COMMUNITY_POST_SEED = [
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

// Source snapshot: src/components/CreatorBlog.jsx :: PRESET_POSTS
export const BLOG_POST_SEED = [
  {
    id: 'blog-post-01',
    author: 'Mina Razak',
    role: 'Pattern maker',
    time: '2h ago',
    title: 'How we draft clean armhole curves for layered jackets',
    content: 'Today we refined the shoulder balance on the cropped jacket block. We tested three seam allowances and kept the version that behaves best in twill. When designing for medium-weight fabrics, adding exactly 1.2cm of ease under the armscye makes all the difference for active wear.',
    image: trenchImg,
    tags: ['fit-notes', 'jacket', 'pattern-lab'],
    likes: 86,
    dislikes: 2,
    comments: [
      {
        id: 'comment-01-01',
        author: 'Julien S.',
        role: 'Tailoring Enthusiast',
        text: 'This is brilliant! I struggled with sleeve bind on my previous tweed blazer, so adding ease makes total sense.',
        time: '1h ago'
      },
      {
        id: 'comment-01-02',
        author: 'Clara Hughes',
        role: 'Bespoke Atelier Designer',
        text: 'Do you also adjust the sleeve crown height when changing this balance?',
        time: '30m ago'
      }
    ]
  },
  {
    id: 'blog-post-02',
    author: 'Arielle Noor',
    role: 'Community mentor',
    time: 'Yesterday',
    title: 'Sleeve rotation checklist before publishing a pattern',
    content: 'If your sleeve pitch is off by even a few millimeters, mobility suffers. Here is the pre-publish checklist we now use in every sample review to ensure high armhole rotational comfort.',
    image: blouseImg,
    tags: ['fit-notes', 'sleeve-craft', 'maker-stories'],
    likes: 114,
    dislikes: 1,
    comments: [
      {
        id: 'comment-02-01',
        author: 'Marcus Vance',
        role: 'Slow Fashion Maker',
        text: 'I downloaded your checklist and it completely saved my latest silk wrap project! Absolute game-changer.',
        time: '18h ago'
      }
    ]
  }
];

// Source snapshot: src/components/EditorialAcademy.jsx :: EDITORIAL_ARTICLES
export const EDITORIAL_ARTICLE_SEED = [
  {
    id: 'edit-01',
    category: 'L\'Atelier Gazette',
    title: 'The Poetics of Grainline: Understanding Fabric Fall & Bias',
    excerpt: 'How aligning your patterns along the warp, weft, or true 45-degree bias changes the structural psychology of silk and heavy linens.',
    content: 'The grainline is the compass of the pattern cutter. To cut along the straight-of-grain (parallel to the selvage) yields stability; to cut on the cross-grain offers soft structure. But to cut on the true bias—at a perfect 45-degree angle—is to invite the fabric to dance. When wool or silk crepe is cut on the bias, the yarns stretch diagonally, conforming to the natural curves of the body with liquid grace. Master patterns, like the Aurelia Wrap Dress, rely heavily on this interaction to form their flowing skirts without bulky darts.',
    author: 'Margot Leone',
    role: 'Pattern Atelier Curator',
    readTime: '6 min read',
    isPremium: false,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=800',
    tags: ['Bias Cut', 'Fabric Behavior', 'Pattern Drafting']
  },
  {
    id: 'edit-02',
    category: 'Atelier Academy',
    title: 'Masterclass: Executing the Flawless French Seam',
    excerpt: 'The ultimate couture finish for sheer, lightweight, and luxury fabrics. Learn to stitch, trim, press, and enclose completely.',
    content: 'A French seam is a seam-within-a-seam, completely enclosing raw edges to prevent fraying while maintaining a clean, professional finish on sheer silk chiffons, organzas, and fine batiste linens. In this academy masterclass, we follow a simple four-step mantra: stitch wrong sides together first, press and trim to 1/8th inch, flip right-sides together, and stitch a slightly wider 1/4 inch line to capture the raw edge perfectly. The result is a featherlight tube of structural perfection.',
    author: 'Henri Du Pont',
    role: 'Senior Atelier Tailor',
    readTime: '12 min read',
    isPremium: true,
    image: 'https://images.unsplash.com/photo-1528570188404-e8153d51f8a2?auto=format&fit=crop&q=80&w=800',
    tags: ['Couture Seams', 'Stitching Techniques', 'Finishing Guide']
  },
  {
    id: 'edit-03',
    category: 'Textile Directory',
    title: 'A Critical Guide to Selecting High-Quality Italian Linens',
    excerpt: 'Not all flax is spun equal. How density, slub frequency, and weave tightness distinguish heirloom linen from common utility fiber.',
    content: 'True Italian heirloom linen is harvested from long-fiber flax plants, resulting in high tensile strength, exceptional moisture absorption, and a natural pearlescent luster that grows softer with every single wash cycle. Look for linen with a consistent weave and minimal large "slubs" (irregular thick knots), as excessive slubbing indicates cheaper short-fiber flax. Heirloom-quality linen feels surprisingly cool to the touch and carries a solid, satisfying weight that drapes beautifully without looking limp.',
    author: 'Margot Leone',
    role: 'Atelier Lead Curator',
    readTime: '8 min read',
    isPremium: false,
    image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=800',
    tags: ['Italian Linen', 'Fiber Science', 'Fabric Sourcing']
  },
  {
    id: 'edit-04',
    category: 'Atelier Academy',
    title: 'The Art of Slash & Spread: Full Bust Adjustments',
    excerpt: 'A comprehensive visual blueprint to adjusting bodice patterns for dynamic cup sizes without distorting shoulders or armscyes.',
    content: 'Most pattern blocks are designed for a standard B-cup. If your bust measurement exceeds this baseline compared to your upper chest, a Full Bust Adjustment (FBA) is essential to avoid horizontal pull wrinkles and riding-up hemlines. By using the classic "Slash & Spread" technique, we open up the bust area exactly where the volume is required while keeping the shoulder seam, neck opening, and armhole circumference absolutely identical to the original curated blueprint.',
    author: 'Clara Oswald',
    role: 'Bespoke Fit Consultant',
    readTime: '15 min read',
    isPremium: true,
    image: 'https://images.unsplash.com/photo-1556905200-279565513a2d?auto=format&fit=crop&q=80&w=800',
    tags: ['Pattern Fitting', 'FBA Adjustments', 'Custom Slashing']
  }
];

// Source snapshot: src/components/TestimonialCarousel.jsx :: INITIAL_TESTIMONIALS
export const TESTIMONIAL_SEED = [
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

// Source snapshot: src/components/FabricStashModal.jsx :: SAMPLE_MATERIALS
export const FABRIC_STASH_SEED = [
  {
    id: 'stash-1',
    name: 'Sage Green Washed Linen',
    category: 'Woven',
    fabricType: 'Linen',
    fabricComposition: '100% linen',
    quantity: 3.5,
    unit: 'yards',
    width: '58"',
    density: 'Medium',
    gsm: '185',
    unitCost: 16.50,
    currency: 'USD',
    colour: '#8A9A86',
    colourCategory: 'Green / Olive',
    fabricFinish: ['Softened', 'Pre-shrunk'],
    location: 'Atelier shelf A',
    notes: 'Soft drape. Planned for the Aurelia wrap dress.',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    yarns: [
      {
        id: 'yarn-1',
        yarnCount: '40s',
        yarnColour: '#8A9A86',
        yarnQuality: 'Combed flax yarn',
        yarnComposition: 'Linen',
        yarnSpecialFinish: ['Softened']
      }
    ]
  },
  {
    id: 'stash-2',
    name: 'Goldenrod Silk Habotai Swatch',
    category: 'Silk',
    fabricType: 'Habotai',
    fabricComposition: '100% silk',
    quantity: '',
    unit: 'yards',
    width: '45"',
    density: 'Light',
    gsm: '70',
    unitCost: 32.00,
    currency: 'USD',
    colour: '#E3A857',
    colourCategory: 'Yellow / Mustard',
    fabricFinish: ['Gloss finish'],
    location: '',
    notes: 'Swatch only. Candidate lining fabric.',
    image: 'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&w=600&q=80',
    yarns: []
  }
];

// Source snapshot: src/components/subcomponents/DynamicGallery.jsx :: SEWING_PATTERNS
export const DYNAMIC_GALLERY_PRODUCT_SEED = [
  {
    id: 'pat-1',
    name: 'The French Draped Trench',
    category: 'Outerwear',
    difficulty: 'Advanced',
    time: '18 hours',
    yardage60: '3.5 Yards',
    yardage45: '4.4 Yards',
    fabric: 'Wool gabardine, cotton twill, or heavy canvas with a premium silk satin lining.',
    difficultyDetail: 'Couture tailoring. Features hand-pad stitched lapels, authentic welt pockets, and sleeve cap easing.',
    notions: '8x 24mm buttons, stay tape, 2 yards fusible weft insertion interfacing, shoulder pads.',
    rating: 4.9,
    reviews: 42,
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80',
    description: 'Double-breasted classic featuring authentic bias-bound interior seams, custom wind flaps, and a storm collar.',
    price: 24.99,
    releaseDate: '2026-05-10',
    pieces: [
      { name: 'Front Bodice', width: '30%', height: '70%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Bodice', width: '30%', height: '70%', x: '38%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Left Sleeve', width: '22%', height: '50%', x: '72%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Right Sleeve', width: '22%', height: '50%', x: '72%', y: '65%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Storm Flaps', width: '15%', height: '25%', x: '5%', y: '85%', color: 'bg-amber-100 border-amber-300 text-amber-700' },
      { name: 'Collar & Belts', width: '48%', height: '12%', x: '22%', y: '85%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' }
    ]
  },
  {
    id: 'pat-2',
    name: 'Zero-Waste Wrap Skirt',
    category: 'Bottoms',
    difficulty: 'Easy',
    time: '4 hours',
    yardage60: '1.2 Yards',
    yardage45: '1.6 Yards',
    fabric: 'Washed Belgian linen, cotton drill, hemp canvas, or light wool crepe.',
    difficultyDetail: 'Beginner-friendly. No zipper required; uses side self-ties and clean French seams.',
    notions: '1x heavy-duty hook & bar eye, 2.5 yards of 1/2" bias binding.',
    rating: 4.7,
    reviews: 68,
    image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=600&q=80',
    description: 'A structural, adjustable wrap skirt engineered to consume 100% of fabric width with zero cut-off waste.',
    price: 14.99,
    releaseDate: '2026-06-20',
    pieces: [
      { name: 'Main Skirt Panel', width: '70%', height: '80%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Waistband Tie', width: '20%', height: '40%', x: '78%', y: '10%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Facing Strip', width: '20%', height: '35%', x: '78%', y: '55%', color: 'bg-sand-100 border-sand-300 text-sand-700' }
    ]
  },
  {
    id: 'pat-3',
    name: 'Atelier Linen Smock',
    category: 'Tops',
    difficulty: 'Medium',
    time: '7 hours',
    yardage60: '2.0 Yards',
    yardage45: '2.5 Yards',
    fabric: 'Light to medium weight linen, cotton chambray, or raw ramie canvas.',
    difficultyDetail: 'Intermediate drafting. Includes sleeve plackets, flat-felled shoulder seams, and structured collar stands.',
    notions: '6x 12mm buttons, 0.5 yards lightweight sew-in woven interfacing.',
    rating: 4.8,
    reviews: 51,
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    description: 'Relaxed utilitarian work blouse with oversized patch pockets and traditional continuous arm cuffs.',
    price: 18.99,
    releaseDate: '2026-04-15',
    pieces: [
      { name: 'Front Bodice', width: '32%', height: '65%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Bodice', width: '32%', height: '65%', x: '40%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Left Sleeve', width: '20%', height: '45%', x: '75%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Right Sleeve', width: '20%', height: '45%', x: '75%', y: '60%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Collar Stand', width: '15%', height: '15%', x: '5%', y: '80%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Patch Pockets', width: '18%', height: '15%', x: '22%', y: '80%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-4',
    name: 'Perfect Fit Hourglass Blazer',
    category: 'Outerwear',
    difficulty: 'Advanced',
    time: '24 hours',
    yardage60: '2.8 Yards',
    yardage45: '3.6 Yards',
    fabric: 'Savile Row wool flannel, cashmere blend tweed, or heavy silk crepe.',
    difficultyDetail: 'High tailoring complexity. Traditional hair canvas internal structure and double-welt flap pocket panels.',
    notions: '3x 20mm primary buttons, 8x 15mm cuff buttons, pure horsehair canvassing, shoulder pads.',
    rating: 5.0,
    reviews: 35,
    image: 'https://images.unsplash.com/photo-1548624149-f9b1859aa700?auto=format&fit=crop&w=600&q=80',
    description: 'Traditional sculptured fit jacket featuring rolled shawl lapels, tailored sleeve linings, and classic keyhole details.',
    price: 29.99,
    releaseDate: '2026-07-01',
    pieces: [
      { name: 'Front Panel', width: '25%', height: '75%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Side Panel', width: '18%', height: '70%', x: '32%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Panel', width: '22%', height: '75%', x: '52%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Two-Piece Sleeve', width: '18%', height: '60%', x: '77%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Shawl Facings', width: '22%', height: '12%', x: '5%', y: '88%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Pocket Welts', width: '45%', height: '12%', x: '30%', y: '88%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-5',
    name: 'A-Line Bias Silk Slip Dress',
    category: 'Dresses',
    difficulty: 'Medium',
    time: '6 hours',
    yardage60: '2.2 Yards',
    yardage45: '2.8 Yards',
    fabric: 'Sand-washed silk satin, heavyweight crepe-de-chine, or fluid bamboo rayon.',
    difficultyDetail: 'Requires careful handling. Cut on a 45-degree grainline. Includes fine rolled-hem edge finishes.',
    notions: 'Stay tape, high-grade fine silk thread, 1.5 yards of bias cord for loops and strap channels.',
    rating: 4.6,
    reviews: 29,
    image: 'https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?auto=format&fit=crop&w=600&q=80',
    description: 'Liquid-like drape silhouette clinging elegantly to form. Features cross-back straps and a self-lined V-neck.',
    price: 16.99,
    releaseDate: '2026-06-05',
    pieces: [
      { name: 'Front Dress Block (Bias)', width: '42%', height: '80%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Dress Block (Bias)', width: '42%', height: '80%', x: '50%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Facings', width: '20%', height: '12%', x: '5%', y: '92%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Underbust Binding', width: '60%', height: '6%', x: '28%', y: '92%', color: 'bg-sand-100 border-sand-300 text-sand-700' }
    ]
  },
  {
    id: 'pat-6',
    name: 'Bespoke Pleated Suit Trouser',
    category: 'Bottoms',
    difficulty: 'Advanced',
    time: '12 hours',
    yardage60: '2.4 Yards',
    yardage45: '3.0 Yards',
    fabric: 'Wool gabardine, worsted suitings, heavy weight linen, or dense cotton twill.',
    difficultyDetail: 'High detail density. Double welt back pocket slit, tailored waistband curtains, and brass zipper fly shield.',
    notions: '1x metal trouser clasp, 1x 7" brass trouser zipper, 1 yard of rigid stay tape, soft pocketing lining.',
    rating: 4.9,
    reviews: 47,
    image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=600&q=80',
    description: 'High-waisted double-pleated design with an internal pocket stay, adjustable brass side buckles, and hidden cuff hems.',
    price: 22.99,
    releaseDate: '2026-05-25',
    pieces: [
      { name: 'Front Leg Panel', width: '25%', height: '80%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Leg Panel', width: '25%', height: '80%', x: '32%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Pocket Bags (2x)', width: '18%', height: '35%', x: '59%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Waistband Curtains', width: '18%', height: '40%', x: '59%', y: '50%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Fly Shields & Tabs', width: '15%', height: '20%', x: '79%', y: '10%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-7',
    name: 'Edwardian Puff Sleeve Blouse',
    category: 'Tops',
    difficulty: 'Medium',
    time: '8 hours',
    yardage60: '1.8 Yards',
    yardage45: '2.4 Yards',
    fabric: 'Fine cotton voile, pure silk organza, sheer batiste, or heirloom linen.',
    difficultyDetail: 'Intermediate techniques. Inset cotton lace strips, micro pin-tucking front paneling, and button cuff plackets.',
    notions: '12x 8mm pearl dome buttons, 3 yards heirloom insert lace trim, premium fine basting thread.',
    rating: 4.8,
    reviews: 31,
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
    description: 'Dramatic vintage-inspired puff arm caps tapering to neat snug cuffs with intricate lace inserts.',
    price: 19.99,
    releaseDate: '2026-07-10',
    pieces: [
      { name: 'Front Bodice Panel', width: '30%', height: '70%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Back Bodice Panel', width: '30%', height: '70%', x: '38%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Left Puff Sleeve', width: '22%', height: '55%', x: '70%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Right Puff Sleeve', width: '22%', height: '55%', x: '70%', y: '68%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Collar Band & Cuffs', width: '28%', height: '12%', x: '5%', y: '85%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' },
      { name: 'Placket Facings', width: '28%', height: '12%', x: '35%', y: '85%', color: 'bg-amber-100 border-amber-300 text-amber-700' }
    ]
  },
  {
    id: 'pat-8',
    name: 'Atelier Hooded Duffle Cape',
    category: 'Outerwear',
    difficulty: 'Medium',
    time: '10 hours',
    yardage60: '3.0 Yards',
    yardage45: '3.8 Yards',
    fabric: 'Thick boiled wool, traditional loden coating, or luxury double-faced cashmere.',
    difficultyDetail: 'Intermediate coating. Flat-felled edge piping, leather latch reinforcing, and structured hood assembly.',
    notions: '3x genuine horn or wooden toggles, 1 yard of 4mm leather cord rope, reinforcing canvas panels.',
    rating: 4.7,
    reviews: 55,
    image: 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=600&q=80',
    description: 'Luxurious heavy drape silhouette with structured hand slits, leather patch duffle latches, and an elegant cowl hood.',
    price: 27.99,
    releaseDate: '2026-03-30',
    pieces: [
      { name: 'Main Cape Front', width: '32%', height: '75%', x: '5%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Main Cape Back', width: '32%', height: '75%', x: '40%', y: '10%', color: 'bg-clay-100 border-clay-300 text-clay-700' },
      { name: 'Three-Piece Hood', width: '20%', height: '50%', x: '75%', y: '10%', color: 'bg-sand-100 border-sand-300 text-sand-700' },
      { name: 'Pocket Facings (2x)', width: '20%', height: '25%', x: '75%', y: '65%', color: 'bg-amber-100 border-amber-300 text-amber-700' },
      { name: 'Leather Patch Welts', width: '67%', height: '8%', x: '5%', y: '88%', color: 'bg-emerald-100 border-emerald-300 text-emerald-700' }
    ]
  }
];

// Source snapshot: src/components/subcomponents/CollaboratorWorkspace.jsx :: INITIAL_PROJECTS
export const COLLABORATOR_PROJECT_SEED = [
  {
    id: 'proj-1',
    name: 'Bespoke Tweed Coat',
    patternName: 'Trench',
    status: 'In Progress',
    progress: 60,
    startedDate: 'Jul 2, 2026',
    tasks: [
      { id: 't1', text: 'Calibrate custom dummy posture and height', completed: true },
      { id: 't2', text: 'Iron and steam organic wool warp fibers', completed: true },
      { id: 't3', text: 'Trace chalk cutting patterns on muslin shell', completed: true },
      { id: 't4', text: 'Construct interlining hair canvas stitch layers', completed: false },
      { id: 't5', text: 'Hand-sew wind flaps and collar back bias', completed: false }
    ]
  },
  {
    id: 'proj-2',
    name: 'Summer Wrap Skirt',
    patternName: 'Skirt',
    status: 'Completed',
    progress: 100,
    startedDate: 'Jul 9, 2026',
    tasks: [
      { id: 't2-1', text: 'Measure linen roll width alignment', completed: true },
      { id: 't2-2', text: 'Map pattern nodes for absolute zero cut-off', completed: true },
      { id: 't2-3', text: 'Double needle lock stitch side belts', completed: true }
    ]
  }
];

// Source snapshot: src/components/subcomponents/CollaboratorWorkspace.jsx :: INITIAL_INVENTORY
export const COLLABORATOR_INVENTORY_SEED = [
  {
    id: 'inv-1',
    name: 'French Flax Organic Linen',
    type: 'Fabric Roll',
    color: 'Oatmeal Natural',
    stock: 45.5,
    threshold: 15.0,
    cost: 16.50,
    status: 'In Stock',
    weight: '240 GSM',
    supplierId: 'sup-1',
    tags: ['Organic', 'Linen', 'Sustainable', 'Breathable']
  },
  {
    id: 'inv-2',
    name: 'Ivory Mulberry Silk Satin',
    type: 'Premium Lining',
    color: 'Soft Pearl',
    stock: 12.0,
    threshold: 15.0,
    cost: 32.00,
    status: 'Low Stock',
    weight: '80 GSM',
    supplierId: 'sup-2',
    tags: ['Luxury', 'Silk', 'Lining', 'Drape']
  },
  {
    id: 'inv-3',
    name: 'Belgian Organic Cotton Denim',
    type: 'Fabric Roll',
    color: 'Indigo Indigo',
    stock: 28.0,
    threshold: 10.0,
    cost: 14.80,
    status: 'In Stock',
    weight: '310 GSM',
    supplierId: 'sup-3',
    tags: ['Denim', 'Heavyweight', 'Indigo', 'Cotton']
  },
  {
    id: 'inv-4',
    name: 'British Fine Merino Tweed',
    type: 'Heavy Wool Crepe',
    color: 'Forest Herringbone',
    stock: 5.5,
    threshold: 10.0,
    cost: 29.50,
    status: 'Critically Low',
    weight: '380 GSM',
    supplierId: 'sup-4',
    tags: ['Wool', 'Tweed', 'Herringbone', 'Warm']
  }
];

// Source snapshot: src/components/subcomponents/CollaboratorWorkspace.jsx :: INITIAL_SUPPLIERS
export const SUPPLIER_SEED = [
  {
    id: 'sup-1',
    name: 'Maison de Lin (French Flax Co)',
    contact: 'Jean-Luc Picard',
    email: 'contact@maisondelin.fr',
    phone: '+33 4 90 12 34 56',
    address: 'Lille, France',
    leadTime: '5-7 Days',
    specialty: 'Certified Organic Belgian & French Flax'
  },
  {
    id: 'sup-2',
    name: 'Lyon Silk Weavers Ltd',
    contact: 'Amélie Laurent',
    email: 'info@lyonsilk.com',
    phone: '+33 4 72 00 99 88',
    address: 'Lyon, France',
    leadTime: '10-12 Days',
    specialty: 'High-Momme Mulberry Silk & Satin linings'
  },
  {
    id: 'sup-3',
    name: 'Belgian Denim Masters',
    contact: 'Dirk van Saene',
    email: 'sales@belgiandenim.be',
    phone: '+32 3 201 45 67',
    address: 'Antwerp, Belgium',
    leadTime: '3-5 Days',
    specialty: 'Heavyweight shuttle loom raw denim'
  },
  {
    id: 'sup-4',
    name: 'Merino & Tweed Heritage Mills',
    contact: 'Alistair Campbell',
    email: 'orders@heritagetweed.co.uk',
    phone: '+44 1851 700123',
    address: 'Isle of Harris, Scotland',
    leadTime: '14 Days',
    specialty: 'Handwoven Harris Tweed & Fine Merino Wool'
  }
];

// Source snapshot: src/components/subcomponents/DynamicInventory.jsx :: INITIAL_INVENTORY
export const DYNAMIC_INVENTORY_SEED = [
  {
    id: 'inv-1',
    name: 'French Flax Organic Linen',
    type: 'Fabric Roll',
    color: 'Oatmeal Natural',
    stock: 45.5, // yards
    threshold: 15.0, // warning threshold
    cost: 16.50, // per yard
    status: 'In Stock',
    weight: '240 GSM',
    tags: ['Organic', 'Linen', 'Sustainable', 'Breathable']
  },
  {
    id: 'inv-2',
    name: 'Ivory Mulberry Silk Satin',
    type: 'Premium Lining',
    color: 'Soft Pearl',
    stock: 12.0,
    threshold: 15.0,
    cost: 32.00,
    status: 'Low Stock',
    weight: '80 GSM',
    tags: ['Luxury', 'Silk', 'Lining', 'Drape']
  },
  {
    id: 'inv-3',
    name: 'Belgian Organic Cotton Denim',
    type: 'Fabric Roll',
    color: 'Indigo Indigo',
    stock: 28.0,
    threshold: 10.0,
    cost: 14.80,
    status: 'In Stock',
    weight: '310 GSM',
    tags: ['Denim', 'Heavyweight', 'Indigo', 'Cotton']
  },
  {
    id: 'inv-4',
    name: 'British Fine Merino Tweed',
    type: 'Heavy Wool Crepe',
    color: 'Forest Herringbone',
    stock: 5.5,
    threshold: 10.0,
    cost: 29.50,
    status: 'Critically Low',
    weight: '380 GSM',
    tags: ['Wool', 'Tweed', 'Herringbone', 'Warm']
  }
];

// Source snapshot: src/components/subcomponents/DynamicProjectManager.jsx :: INITIAL_PROJECTS
export const DYNAMIC_PROJECT_SEED = [
  {
    id: 'proj-1',
    name: 'Bespoke Tweed Coat',
    patternName: 'The French Draped Trench',
    status: 'In Progress',
    progress: 65,
    startedDate: 'Jul 2, 2026',
    tasks: [
      { id: 't1', text: 'Calibrate custom dummy posture and height', completed: true },
      { id: 't2', text: 'Iron and steam organic wool warp fibers', completed: true },
      { id: 't3', text: 'Trace chalk cutting patterns on muslin shell', completed: true },
      { id: 't4', text: 'Construct interlining hair canvas stitch layers', completed: false },
      { id: 't5', text: 'Hand-sew wind flaps and collar back bias', completed: false }
    ]
  },
  {
    id: 'proj-2',
    name: 'Summer Wrap Skirt',
    patternName: 'Minimalist Zero-Waste Skirt',
    status: 'Completed',
    progress: 100,
    startedDate: 'Jul 9, 2026',
    tasks: [
      { id: 't2-1', text: 'Measure linen roll width alignment', completed: true },
      { id: 't2-2', text: 'Map pattern nodes for absolute zero cut-off', completed: true },
      { id: 't2-3', text: 'Double needle lock stitch side belts', completed: true }
    ]
  }
];

// Source snapshot: src/components/subcomponents/ProfessionalDashboard.jsx :: DEFAULT_PROJECTS
export const PROFESSIONAL_PROJECT_SEED = [
  {
    id: 'proj-1',
    name: 'Bespoke Tweed Coat',
    patternName: 'The French Draped Trench',
    status: 'In Progress',
    progress: 65,
    startedDate: 'Jul 2, 2026',
    tasks: [
      { id: 't1', text: 'Calibrate custom dummy posture and height', completed: true },
      { id: 't2', text: 'Iron and steam organic wool warp fibers', completed: true },
      { id: 't3', text: 'Trace chalk cutting patterns on muslin shell', completed: true },
      { id: 't4', text: 'Construct interlining hair canvas stitch layers', completed: false },
      { id: 't5', text: 'Hand-sew wind flaps and collar back bias', completed: false }
    ]
  },
  {
    id: 'proj-2',
    name: 'Summer Wrap Skirt',
    patternName: 'Minimalist Zero-Waste Skirt',
    status: 'Completed',
    progress: 100,
    startedDate: 'Jul 9, 2026',
    tasks: [
      { id: 't2-1', text: 'Measure linen roll width alignment', completed: true },
      { id: 't2-2', text: 'Map pattern nodes for absolute zero cut-off', completed: true },
      { id: 't2-3', text: 'Double needle lock stitch side belts', completed: true }
    ]
  }
];

// Source snapshot: src/components/subcomponents/ProfessionalDashboard.jsx :: DEFAULT_INVENTORY
export const PROFESSIONAL_INVENTORY_SEED = [
  {
    id: 'inv-1',
    name: 'French Flax Organic Linen',
    type: 'Fabric Roll',
    color: 'Oatmeal Natural',
    stock: 45.5,
    threshold: 15.0,
    cost: 16.50,
    status: 'In Stock',
    weight: '240 GSM'
  },
  {
    id: 'inv-2',
    name: 'Ivory Mulberry Silk Satin',
    type: 'Premium Lining',
    color: 'Soft Pearl',
    stock: 12.0,
    threshold: 15.0,
    cost: 32.00,
    status: 'Low Stock',
    weight: '80 GSM'
  },
  {
    id: 'inv-3',
    name: 'Belgian Organic Cotton Denim',
    type: 'Fabric Roll',
    color: 'Indigo Indigo',
    stock: 28.0,
    threshold: 10.0,
    cost: 14.80,
    status: 'In Stock',
    weight: '310 GSM'
  },
  {
    id: 'inv-4',
    name: 'British Fine Merino Tweed',
    type: 'Heavy Wool Crepe',
    color: 'Forest Herringbone',
    stock: 5.5,
    threshold: 10.0,
    cost: 29.50,
    status: 'Critically Low',
    weight: '380 GSM'
  }
];

// Source snapshot: src/components/subcomponents/ProfessionalDashboard.jsx :: DEFAULT_TIME_LOGS
export const TIME_LOG_SEED = [
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
    patternId: 'sartorial-02',
    patternName: 'Perfect Fit Hourglass Blazer',
    stepName: 'Stitch Bust Darts',
    durationSeconds: 155, // 2m 35s
    date: '2026-07-08T09:12:00.000Z',
    notes: 'Nicely shaped bodice. Standard allowed minutes was 2.2 min, took me 2.58 min. Precision pressing with clapper.'
  },
  {
    id: 'log-seed-3',
    patternId: 'sartorial-03',
    patternName: 'Classic Linen Atelier Smock',
    stepName: 'Assemble Shoulders & Sides',
    durationSeconds: 1200, // 20m
    date: '2026-07-10T11:45:00.000Z',
    notes: 'Constructed French seams for side panels to avoid bulky interior edges.'
  }
];

// Source snapshot: src/components/MemberManagement.jsx :: INITIAL_COLLABORATOR
export const DEMO_COLLABORATOR_ACCOUNT = {
  id: 'user-id:margot-leone',
  username: 'margotleone',
  fullName: 'Margot Leone',
  email: 'margot@atelier.com',
  role: 'collaborator',
  brandName: 'Atelier Margot',
  designerBrand: 'Atelier Margot',
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

// Source snapshot: src/components/MemberManagement.jsx :: INITIAL_BUYER
export const DEMO_BUYER_ACCOUNT = {
  id: 'user-id:arthur-dent',
  username: 'arthurdent',
  fullName: 'Arthur Dent',
  email: 'arthur.dent@galaxy.com',
  role: 'buyer',
  brandName: '',
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

// Source snapshot: src/components/MemberManagement.jsx :: INITIAL_ADMINISTRATOR
export const DEMO_ADMIN_ACCOUNT = {
  id: 'user-id:administrator',
  username: 'executiveadmin',
  fullName: 'Executive Administrator',
  email: 'admin@atelier.com',
  role: 'administrator',
  brandName: 'Perfect Fit Bureau',
  tier: 'System Chief Admin',
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
  bio: 'Atelier Core Operations Director. Authorized privileges to modify metadata rendering models, alter database layouts, and configure strict login walls.',
  creationGallery: []
};

// Source snapshot: src/App.jsx :: defaultReviews
export const PRODUCT_REVIEW_SEED = {
      'sartorial-01': [
        {
          id: 'rev-sartorial-01-1',
          name: 'Genevieve R.',
          rating: 5,
          title: 'Flawless Drape & Clear Guides',
          comment: 'The French seam instructions are exceptionally clear. I made this in a midweight washed linen and the drape is stunning. The sizing was spot-on according to the calculator!',
          date: '2026-06-18'
        },
        {
          id: 'rev-sartorial-01-2',
          name: 'Clara M.',
          rating: 4,
          title: 'Beautiful dress, watch the tie length',
          comment: 'Absolutely love the final look. I modified the waist tie to be slightly wider to style a bigger bow. Perfect beginner-intermediate challenge.',
          date: '2026-05-24'
        }
      ],
      'sartorial-02': [
        {
          id: 'rev-sartorial-02-1',
          name: 'Arthur P.',
          rating: 5,
          title: 'The ultimate bespoke experience',
          comment: 'An ambitious project but the results are absolute shop-quality. The storm flap alignment guides were incredibly precise. Crafted mine in organic heavyweight cotton twill.',
          date: '2026-06-20'
        },
        {
          id: 'rev-sartorial-02-2',
          name: 'Elena K.',
          rating: 5,
          title: 'A masterclass in coatmaking',
          comment: 'Excellent documentation, high quality booklet. The double-breasted layout is beautifully calculated. Take your time with the collar and welt pockets!',
          date: '2026-06-11'
        }
      ],
      'sartorial-03': [
        {
          id: 'rev-sartorial-03-1',
          name: 'Beatrice L.',
          rating: 5,
          title: 'Unbelievably comfortable trouser',
          comment: 'I have made three pairs of these Palazzo trousers already! The pocket drafting is pure genius—completely flat against the hips.',
          date: '2026-06-22'
        },
        {
          id: 'rev-sartorial-03-2',
          name: 'Isabella K.',
          rating: 4,
          title: 'Excellent width and drape',
          comment: 'Sized down slightly based on the waist measurement. Instructions were fantastic. High-fashion result!',
          date: '2026-06-01'
        }
      ],
      'sartorial-04': [
        {
          id: 'rev-sartorial-04-1',
          name: 'Sienna V.',
          rating: 5,
          title: 'Couture feel, draping masterclass',
          comment: 'The asymmetric pleat lines are a masterpiece. This blouse looks like a high-end designer piece. Highly recommend lightweight silk tencel.',
          date: '2026-06-15'
        }
      ]
    };

export const MEMBER_DEMO_ACCOUNTS = Object.freeze({
  collaborator: DEMO_COLLABORATOR_ACCOUNT,
  buyer: DEMO_BUYER_ACCOUNT,
  administrator: DEMO_ADMIN_ACCOUNT
});


// Source snapshot: former perfectFitMetadata.workspace.mockData.
// Runtime development fallback only; never authoritative UI metadata.
export const WORKSPACE_SEED = {
    selectedLocale:
      'en',

    collaboration: {
      grants: []
    },

    auditLog: [],

    projects: [
      {
        id:
          'project-summer-linen-2026',

        nodeType:
          'project',

        values: {
          'project.name':
            'Summer Linen 2026',

          'project.designer_code':
            'AM',

          'project.season':
            'SS26',

          'project.status':
            'ACTIVE'
        },

        children: [
          {
            id:
              'product-aurelia-wrap-dress',

            nodeType:
              'product',

            values: {
              'product.style_name':
                'Aurelia Wrap Dress',

              'product.style_code':
                'AM-AUR-001',

              'product.category':
                'DRESS',

              'product.development_stage':
                'DRAFTING',

              'product.difficulty':
                'INTERMEDIATE',

              'product.fit_silhouette':
                'A_LINE',

              'product.description':
                'A refined wrap dress with soft drape and clean finishing.'
            },

            children: [
              {
                id:
                  'variant-aurelia-original',

                nodeType:
                  'variant',

                values: {
                  'variant.name':
                    'Original',

                  'variant.code':
                    'AM-AUR-001-V01',

                  'variant.status':
                    'DEVELOPMENT',

                  'variant.size_system':
                    'ALPHA',

                  'variant.base_reference_size':
                    'M',

                  'variant.notes':
                    'Original development variant used as the primary technical reference.'
                },

                children: [
                  {
                    id:
                      'project-journal-aurelia-original',

                    nodeType:
                      'projectJournal',

                    title:
                      'Project Journal',

                    values: {
                      version:
                        'project-journal-v1'
                    },

                    children: []
                  },

                  {
                    id:
                      'media-aurelia-original',

                    nodeType:
                      'media',

                    title:
                      'Media',

                    values: {
                      assets: [],

                      slots: {
                        primaryAssetId:
                          null,

                        technicalSketchAssetId:
                          null,

                        patternAssetId:
                          null
                      }
                    },

                    children: []
                  },

                  {
                    id:
                      'pattern-library-aurelia-original',

                    nodeType:
                      'patternLibrary',

                    title:
                      'Pattern Library',

                    values: {
                      revision:
                        'R001',

                      files:
                        []
                    },

                    children: []
                  },

                  {
                    id:
                      'size-set-aurelia-original',

                    nodeType:
                      'sizeSet',

                    title:
                      'Measurement Chart',

                    values: {
                      version:
                        'measurement-chart-v1',

                      displaySystem:
                        'ALPHA',

                      unit:
                        'cm',

                      baseSizeId:
                        'size-03',

                      sizes: [
                        {
                          id: 'size-01',
                          sortOrder: 1,
                          references: { ALPHA: 'XS', UK: '6', US: '2', EU: '34', FR: '36' }
                        },
                        {
                          id: 'size-02',
                          sortOrder: 2,
                          references: { ALPHA: 'S', UK: '8', US: '4', EU: '36', FR: '38' }
                        },
                        {
                          id: 'size-03',
                          sortOrder: 3,
                          references: { ALPHA: 'M', UK: '10', US: '6', EU: '38', FR: '40' }
                        },
                        {
                          id: 'size-04',
                          sortOrder: 4,
                          references: { ALPHA: 'L', UK: '12', US: '8', EU: '40', FR: '42' }
                        },
                        {
                          id: 'size-05',
                          sortOrder: 5,
                          references: { ALPHA: 'XL', UK: '14', US: '10', EU: '42', FR: '44' }
                        }
                      ],

                      measurements: [
                        {
                          id: 'pom-bust',
                          code: 'POM-01',
                          label: 'Bust',
                          values: { 'size-01': '84', 'size-02': '88', 'size-03': '92', 'size-04': '96', 'size-05': '100' }
                        },
                        {
                          id: 'pom-waist',
                          code: 'POM-02',
                          label: 'Waist',
                          values: { 'size-01': '66', 'size-02': '70', 'size-03': '74', 'size-04': '78', 'size-05': '82' }
                        },
                        {
                          id: 'pom-hip',
                          code: 'POM-03',
                          label: 'Hip',
                          values: { 'size-01': '92', 'size-02': '96', 'size-03': '100', 'size-04': '104', 'size-05': '108' }
                        }
                      ]
                    },

                    children: []
                  },

                  {
                    id:
                      'sewing-aurelia-original',

                    nodeType:
                      'sewing',

                    title:
                      'Sewing',

                    values: {
                      constructionSteps: [
                        {
                          id: 'sewing-step-1',
                          order: 1,
                          title: 'Staystitch neckline and wrap edges',
                          seamType: 'Staystitch',
                          notes: 'Prevent stretching before assembly.'
                        },
                        {
                          id: 'sewing-step-2',
                          order: 2,
                          title: 'Assemble shoulders and side seams',
                          seamType: 'French seam',
                          notes: 'Use clean enclosed finish for linen sample.'
                        }
                      ],
                      notions: [
                        {
                          id: 'notion-thread',
                          item: 'Matching all-purpose thread',
                          quantity: '1 spool',
                          notes: ''
                        },
                        {
                          id: 'notion-needle',
                          item: 'Microtex needle',
                          quantity: '70/10',
                          notes: 'Recommended for crisp linen edge finishing.'
                        }
                      ],
                      seamAllowances: 'Use approved pattern seam allowance unless noted.',
                      qualityNotes: 'Check wrap overlap, tie tension and neckline stability after first sample.'
                    },

                    children: []
                  },

                  {
                    id:
                      'techpack-aurelia-original',

                    nodeType:
                      'techpack',

                    title:
                      'Tech Pack',

                    values: {
                      version: 'TP-001',
                      status: 'DRAFT',
                      notes: 'Compiled from canonical Overview, Media, Pattern Library, Measurement Chart and Sewing modules.',
                      exportHistory: []
                    },

                    children: []
                  },

                  {
                    id:
                      'change-history-aurelia-original',

                    nodeType:
                      'changeHistory',

                    title:
                      'Change History',

                    values: {
                      entries: [
                        {
                          id:
                            'change-aurelia-001',

                          version:
                            '1.0',

                          initiatedBy:
                            'DESIGNER',

                          changedBy: {
                            id:
                              'designer-demo',

                            name:
                              'Designer'
                          },

                          reason:
                            'Initial technical reference created.',

                          changes: [
                            {
                              field:
                                'variant.base_reference_size',

                              operation:
                                'CREATE',

                              previousValue:
                                null,

                              newValue:
                                'M'
                            }
                          ],

                          references: {
                            baseSketch:
                              null,

                            basePattern:
                              null
                          },

                          createdAt:
                            '2026-08-13T09:00:00'
                        }
                      ]
                    },

                    children: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

// Source snapshot: technical printing-guide fallback records.
// Runtime/EIP data, not UI metadata.
export const PRINTING_GUIDE_PATTERN_PATHS_SEED = {
  'Aurelia Wrap Dress': [
    {
      id: 'front-bodice',
      name: 'Front Bodice',
      path: 'M 120,40 Q 180,20 220,50 L 280,180 Q 250,240 180,240 L 120,240 Q 150,150 120,40 Z',
      grainline: 'M 180,90 L 180,190',
      label: 'Front Bodice - Cut 2',
      labelPos: { x: 180, y: 140 }
    },
    {
      id: 'sleeve-right',
      name: 'Sleeve Right',
      path: 'M 320,180 Q 350,50 410,50 Q 470,50 480,180 L 450,230 L 350,230 Z',
      grainline: 'M 410,100 L 410,200',
      label: 'Sleeve Right - Cut 1',
      labelPos: { x: 410, y: 150 }
    },
    {
      id: 'sleeve-left',
      name: 'Sleeve Left',
      path: 'M 20,280 Q 50,150 110,150 Q 170,150 180,280 L 150,330 L 50,330 Z',
      grainline: 'M 110,200 L 110,300',
      label: 'Sleeve Left - Cut 1',
      labelPos: { x: 110, y: 250 }
    },
    {
      id: 'skirt-back',
      name: 'Skirt Back Panel',
      path: 'M 250,280 Q 350,270 450,280 L 480,740 Q 350,760 220,740 Z',
      grainline: 'M 350,350 L 350,650',
      label: 'Skirt Back Panel - Fold',
      labelPos: { x: 350, y: 500 }
    },
    {
      id: 'waist-ties',
      name: 'Waist Ties',
      path: 'M 30,420 L 170,420 L 170,750 L 30,750 Z',
      grainline: 'M 100,480 L 100,680',
      label: 'Waist Ties - Cut 4',
      labelPos: { x: 100, y: 580 }
    }
  ],
  'Atelier Trench Coat': [
    {
      id: 'trench-front',
      name: 'Double Breasted Front',
      path: 'M 40,50 L 160,50 L 180,350 L 160,620 L 40,620 L 60,350 Z',
      grainline: 'M 110,150 L 110,500',
      label: 'Trench Front - Cut 2',
      labelPos: { x: 110, y: 300 }
    },
    {
      id: 'storm-flap',
      name: 'Storm Flap',
      path: 'M 220,40 L 380,40 L 380,180 Q 300,240 220,180 Z',
      grainline: 'M 300,80 L 300,160',
      label: 'Storm Flap - Cut 1',
      labelPos: { x: 300, y: 130 }
    },
    {
      id: 'back-shield',
      name: 'Back Storm Shield',
      path: 'M 420,40 L 580,40 L 580,200 L 420,200 Z',
      grainline: 'M 500,80 L 500,160',
      label: 'Back Storm Shield',
      labelPos: { x: 500, y: 120 }
    },
    {
      id: 'sleeve-a',
      name: 'Two-Piece Sleeve A',
      path: 'M 220,380 Q 300,280 380,380 L 360,620 L 240,620 Z',
      grainline: 'M 300,420 L 300,580',
      label: 'Sleeve Upper - Cut 2',
      labelPos: { x: 300, y: 500 }
    },
    {
      id: 'sleeve-b',
      name: 'Two-Piece Sleeve B',
      path: 'M 440,380 Q 500,310 560,380 L 540,620 L 460,620 Z',
      grainline: 'M 500,420 L 500,580',
      label: 'Sleeve Under - Cut 2',
      labelPos: { x: 500, y: 500 }
    },
    {
      id: 'coat-back',
      name: 'Coat Back Panel',
      path: 'M 180,680 L 420,680 L 480,1010 L 120,1010 Z',
      grainline: 'M 300,720 L 300,960',
      label: 'Coat Back - Fold',
      labelPos: { x: 300, y: 840 }
    },
    {
      id: 'collar-facing',
      name: 'Collar & Lapel facing',
      path: 'M 20,680 L 80,680 L 80,950 Q 50,1010 20,950 Z',
      grainline: 'M 50,720 L 50,900',
      label: 'Collar Facing - Cut 2',
      labelPos: { x: 50, y: 820 }
    }
  ],
  'Renaissance Pleated Bodice': [
    {
      id: 'bodice-front',
      name: 'Center Front Lace Panel',
      path: 'M 130,40 L 270,40 L 250,230 L 150,230 Z',
      grainline: 'M 200,80 L 200,190',
      label: 'CF Bodice - Cut 1',
      labelPos: { x: 200, y: 130 }
    },
    {
      id: 'bodice-side-front',
      name: 'Side Front Bodice',
      path: 'M 20,40 L 80,40 L 80,480 L 20,480 Z',
      grainline: 'M 50,100 L 50,420',
      label: 'Side Front - Cut 2',
      labelPos: { x: 50, y: 260 }
    },
    {
      id: 'bodice-side-back',
      name: 'Side Back Bodice',
      path: 'M 320,40 L 380,40 L 380,480 L 320,480 Z',
      grainline: 'M 350,100 L 350,420',
      label: 'Side Back - Cut 2',
      labelPos: { x: 350, y: 260 }
    },
    {
      id: 'bodice-strap',
      name: 'Strap & Darts facing',
      path: 'M 120,300 Q 200,280 280,300 L 260,480 L 140,480 Z',
      grainline: 'M 200,340 L 200,440',
      label: 'Strap Facing - Cut 4',
      labelPos: { x: 200, y: 390 }
    }
  ]
};

export const PRINTING_GUIDE_PATTERNS_SEED = {
  'Aurelia Wrap Dress': {
    cols: 5,
    rows: 6,
    pieces: [
      { name: 'Front Bodice', color: 'border-clay-400 bg-clay-50/40', coords: [[0, 1], [0, 2], [1, 1], [1, 2]] },
      { name: 'Sleeve Right', color: 'border-emerald-400 bg-emerald-50/40', coords: [[0, 3], [0, 4], [1, 3], [1, 4]] },
      { name: 'Sleeve Left', color: 'border-emerald-400 bg-emerald-50/40', coords: [[1, 0], [2, 0], [1, 1], [2, 1]] },
      { name: 'Skirt Back Panel', color: 'border-indigo-400 bg-indigo-50/40', coords: [[2, 2], [2, 3], [2, 4], [3, 2], [3, 3], [3, 4], [4, 2], [4, 3], [4, 4], [5, 2], [5, 3], [5, 4]] },
      { name: 'Waist Ties', color: 'border-amber-400 bg-amber-50/40', coords: [[3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1]] }
    ],
    difficulty: 'Intermediate',
    estTime: '45 mins'
  },
  'Atelier Trench Coat': {
    cols: 6,
    rows: 8,
    pieces: [
      { name: 'Double Breasted Front', color: 'border-clay-400 bg-clay-50/40', coords: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [4, 1]] },
      { name: 'Storm Flap', color: 'border-amber-400 bg-amber-50/40', coords: [[0, 2], [0, 3], [1, 2], [1, 3]] },
      { name: 'Back Storm Shield', color: 'border-indigo-400 bg-indigo-50/40', coords: [[0, 4], [0, 5], [1, 4], [1, 5]] },
      { name: 'Two-Piece Sleeve A', color: 'border-emerald-400 bg-emerald-50/40', coords: [[2, 2], [2, 3], [3, 2], [3, 3], [4, 2], [4, 3]] },
      { name: 'Two-Piece Sleeve B', color: 'border-teal-400 bg-teal-50/40', coords: [[2, 4], [2, 5], [3, 4], [3, 5], [4, 4], [4, 5]] },
      { name: 'Coat Back Panel', color: 'border-purple-400 bg-purple-50/40', coords: [[5, 1], [5, 2], [5, 3], [5, 4], [6, 1], [6, 2], [6, 3], [6, 4], [7, 1], [7, 2], [7, 3], [7, 4]] },
      { name: 'Collar & Lapel facing', color: 'border-rose-400 bg-rose-50/40', coords: [[5, 0], [6, 0], [7, 0], [5, 5], [6, 5], [7, 5]] }
    ],
    difficulty: 'Advanced',
    estTime: '1 hr 15 mins'
  },
  'Renaissance Pleated Bodice': {
    cols: 4,
    rows: 4,
    pieces: [
      { name: 'Center Front Lace Panel', color: 'border-rose-400 bg-rose-50/40', coords: [[0, 1], [0, 2], [1, 1], [1, 2]] },
      { name: 'Side Front Bodice', color: 'border-clay-400 bg-clay-50/40', coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
      { name: 'Side Back Bodice', color: 'border-indigo-400 bg-indigo-50/40', coords: [[0, 3], [1, 3], [2, 3], [3, 3]] },
      { name: 'Strap & Darts facing', color: 'border-amber-400 bg-amber-50/40', coords: [[2, 1], [2, 2], [3, 1], [3, 2]] }
    ],
    difficulty: 'Beginner',
    estTime: '25 mins'
  }
};

export const PRINTING_GUIDE_SEED = {
  patternPaths: PRINTING_GUIDE_PATTERN_PATHS_SEED,
  patterns: PRINTING_GUIDE_PATTERNS_SEED
};

// Source snapshot: IndustrialTechPack runtime BOM/routing development records.
// Runtime/EIP data, not UI metadata.
export const INDUSTRIAL_TECH_PACK_SEED = {
  'sartorial-01': {
    sam: 28.5,
    complexity: 'Medium-High',
    stitchClass: 'Stitch Class 504 (Overlock) & 301 (Lockstitch)',
    bom: [
      { id: 'mat-1', name: 'Primary: European Flax Linen (Washed)', spec: '185 GSM, 100% Linen, Yarn Count 14s', wasteFactor: 1.1, baseQty: 3, unit: 'm', cost: 14.5, supplier: 'Belgian Linen Guild' },
      { id: 'mat-2', name: 'Interfacing: Weft-Insertion Fusible', spec: 'Lightweight poly-viscose knit, 40 GSM', wasteFactor: 1.05, baseQty: 0.5, unit: 'm', cost: 3.2, supplier: 'Freudenberg Vlieseline' },
      { id: 'mat-3', name: 'Notion: Interior Flat Anchor Button', spec: '15mm, 4-hole urea composite, matte', wasteFactor: 1.02, baseQty: 1, unit: 'pc', cost: 0.35, supplier: 'YKK Fasteners' },
      { id: 'mat-4', name: 'Thread: Core-Spun Poly (Astra/Epic)', spec: 'Tex 27, 3-ply high-tenacity, matching dye', wasteFactor: 1.15, baseQty: 120, unit: 'm', cost: 0.02, supplier: 'Coats Thread' },
      { id: 'mat-5', name: 'Perfect Fit Woven Main Label', spec: 'Damask satin, 45mm x 25mm, hot cut', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.22, supplier: 'Avery Dennison' },
      { id: 'mat-6', name: 'Printed Nylon Care/Size Label', spec: 'Soft nylon taffeta, dual-fold print', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.08, supplier: 'Avery Dennison' }
    ],
    routing: [
      { step: '01', op: 'Fuse Front Facings & Waistline Stabilizers', machine: 'Industrial Continuous Fusing Press', sam: 1.8, rate: 0.35 },
      { step: '02', op: 'Staystitch Front Neckline & Armholes', machine: 'Single Needle Lockstitch (Class 301)', sam: 1.5, rate: 0.28 },
      { step: '03', op: 'Stitch Bust Darts (Lock-Stitched & Backtacked)', machine: 'Single Needle Lockstitch (Class 301)', sam: 2.2, rate: 0.4 },
      { step: '04', op: 'Construct & Turn Waist Belt Ties', machine: 'Single Needle Lockstitch + Turning Rod', sam: 3, rate: 0.55 },
      { step: '05', op: 'Stitch Back Bodice Center Seam & Press', machine: '3-Thread Overlock (Class 504) + SNLS', sam: 2.8, rate: 0.5 },
      { step: '06', op: 'Assemble In-Seam Pockets to Skirt Panels', machine: 'SNLS + 3-Thread Overlock Safety Seam', sam: 4.5, rate: 0.85 },
      { step: '07', op: 'Assemble Shoulders & Sides with French Seams', machine: 'Single Needle Lockstitch (Class 301) Precision', sam: 6.2, rate: 1.2 },
      { step: '08', op: 'Join Bodice Waistline to Skirt with Reinforcement', machine: '4-Thread Safety Stitch (Class 514)', sam: 3.5, rate: 0.65 },
      { step: '09', op: 'Double Rolled Baby Hem (Skirt Rim & Sleeves)', machine: 'Single Needle Lockstitch + Hemmer Foot', sam: 4.8, rate: 0.9 },
      { step: '10', op: 'Trimming, final thread QC inspection & Pressing', machine: 'Industrial Steam Utility Table + Clapper', sam: 2.7, rate: 0.5 }
    ]
  },
  'sartorial-02': {
    sam: 52,
    complexity: 'High (Advanced)',
    stitchClass: 'Heavy Duty 301 Lockstitch & Class 401 Chainstitch',
    bom: [
      { id: 'mat-1', name: 'Primary: Cotton Gabardine Twill', spec: '290 GSM, water-repellent long-staple cotton', wasteFactor: 1.12, baseQty: 3.5, unit: 'm', cost: 18, supplier: 'Halley Stevensons' },
      { id: 'mat-2', name: 'Lining: Premium Viscose Jacquard', spec: '85 GSM, anti-static breathable weave', wasteFactor: 1.1, baseQty: 2, unit: 'm', cost: 7.5, supplier: 'Bemberg Lining' },
      { id: 'mat-3', name: 'Interfacing: Heavy Woven Fusible', spec: 'Trubenized resin, 90 GSM wool-blend woven', wasteFactor: 1.08, baseQty: 1.2, unit: 'm', cost: 4.8, supplier: 'Lainiere de Picardie' },
      { id: 'mat-4', name: 'Notion: Premium Horn Buttons', spec: '22mm diameter, genuine laser-etched horn', wasteFactor: 1.03, baseQty: 10, unit: 'pcs', cost: 1.8, supplier: 'Gritti Group' },
      { id: 'mat-5', name: 'Notion: Buckles & Antique Brass D-Rings', spec: '40mm cast-brass slide buckles, set of 3', wasteFactor: 1.01, baseQty: 1, unit: 'set', cost: 4.5, supplier: 'Riri Group' },
      { id: 'mat-6', name: 'Thread: Coarse Topstitching & Core-Spun', spec: 'Tex 40 stitching and Tex 60 topstitching', wasteFactor: 1.18, baseQty: 250, unit: 'm', cost: 0.03, supplier: 'Coats Thread' }
    ],
    routing: [
      { step: '01', op: 'Fuse Front Panels, Collar Stands, and Sleeve Cuffs', machine: 'Industrial Continuous Fusing Press', sam: 3.5, rate: 0.65 },
      { step: '02', op: 'Assemble Epaulettes, Sleeve Tabs, and Belt Carriers', machine: 'Single Needle Lockstitch (Class 301) + Crease', sam: 4.8, rate: 0.9 },
      { step: '03', op: 'Prepare & Stitch Back Storm Shield with Overhangs', machine: 'SNLS + Multi-needle Topstitching', sam: 5.5, rate: 1 },
      { step: '04', op: 'Construct Front Double Welt Pockets with Facing Flaps', machine: 'Automatic Pocket Welter Machine (Class 301)', sam: 9.5, rate: 1.8 },
      { step: '05', op: 'Assemble & Attach Double-Breasted Collar & Stand', machine: 'SNLS + Precision Edge-Stitch', sam: 7.2, rate: 1.4 },
      { step: '06', op: 'Join Side & Shoulder Seams (Flat-Felled Finishes)', machine: 'Feed-off-the-Arm Twin Needle Chainstitch (401)', sam: 6.8, rate: 1.3 },
      { step: '07', op: 'Construct & Set Two-Piece Raglan Sleeves', machine: 'SNLS + Easing Feed Assembly', sam: 5.8, rate: 1.1 },
      { step: '08', op: 'Machine Sew Keyhole Buttonholes (Front & Cuffs)', machine: 'Automatic Eyelet Keyhole Buttonholer', sam: 4.2, rate: 0.85 },
      { step: '09', op: 'Attach Horn Buttons with Counter-Buttons & Shank', machine: 'Button Sewer with Thread Wrapper', sam: 3, rate: 0.6 },
      { step: '10', op: 'Final Hand QC Inspection, Pressing & Boarding', machine: 'Industrial Cabinet Form Press + Vacuum', sam: 4.5, rate: 0.9 }
    ]
  },
  'sartorial-03': {
    sam: 34.2,
    complexity: 'Medium',
    stitchClass: 'Stitch Class 504 (Overlock) & 301 (Lockstitch)',
    bom: [
      { id: 'mat-1', name: 'Primary: Fine Merino Wool Suiting', spec: '240 GSM, Super 110s wool twill', wasteFactor: 1.08, baseQty: 2.2, unit: 'm', cost: 22.5, supplier: 'Vitale Barberis Canonico' },
      { id: 'mat-2', name: 'Pocketing: Solid Cotton Lawn Lining', spec: '75 GSM, 100% cotton combed lawn', wasteFactor: 1.05, baseQty: 0.4, unit: 'm', cost: 3.5, supplier: 'Perfect Fit Mill Stock' },
      { id: 'mat-3', name: 'Interfacing: Structured Ban-Rol Waistband', spec: 'Non-roll woven waistband stabilizer, 80mm', wasteFactor: 1.02, baseQty: 1, unit: 'm', cost: 1.85, supplier: 'Ban-Rol Inc.' },
      { id: 'mat-4', name: 'Notion: Metal Fly Zipper #4', spec: 'YKK brass zipper with locking slider, 7 inch length', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.95, supplier: 'YKK Fasteners' },
      { id: 'mat-5', name: 'Thread: Core-Spun Poly (Astra/Epic)', spec: 'Tex 30, high tensile strength core-spun poly', wasteFactor: 1.12, baseQty: 140, unit: 'm', cost: 0.02, supplier: 'Coats Thread' }
    ],
    routing: [
      { step: '01', op: 'Overlock Seam Edges of all Leg Panels', machine: '3-Thread Overlock Edge-Serger (Class 504)', sam: 3.8, rate: 0.7 },
      { step: '02', op: 'Sew Front Architectural Pleats & Back Waist Darts', machine: 'Single Needle Lockstitch (Class 301)', sam: 2.8, rate: 0.5 },
      { step: '03', op: 'Assemble & Topstitch Front Slant Side Pockets', machine: 'SNLS + crease-press pocket facings', sam: 5.2, rate: 1 },
      { step: '04', op: 'Stitch and Set Back Double Welt Pockets', machine: 'Automatic Welter Machine + Pocket Bag Attachment', sam: 6.8, rate: 1.3 },
      { step: '05', op: 'Assemble Left/Right Outseams and Inseams', machine: 'Double Needle Lockstitch with edge-guide', sam: 4.2, rate: 0.8 },
      { step: '06', op: 'Assemble and Stitch Front Crotch Fly Zipper', machine: 'SNLS + precision zip-tape fold shield', sam: 4.8, rate: 0.9 },
      { step: '07', op: 'Construct Waistband with Interfaced Ban-Rol Core', machine: 'Waistband Folder Attachment + Twin Needle LS', sam: 3.5, rate: 0.65 },
      { step: '08', op: 'Blindstitch Bottom Leg Hems', machine: 'Single Thread Industrial Blindstitch Machine', sam: 2.6, rate: 0.5 }
    ]
  },
  default: {
    sam: 18.2,
    complexity: 'Low-Medium',
    stitchClass: 'Stitch Class 503 (Overedge) & Class 301 (Lockstitch)',
    bom: [
      { id: 'mat-1', name: 'Primary: Silk Crepe de Chine', spec: '16 Momme, 100% Mulberry Silk, sandwashed', wasteFactor: 1.15, baseQty: 2, unit: 'm', cost: 26, supplier: 'Shengzhou Silk Mills' },
      { id: 'mat-2', name: 'Interfacing: Fine Knit Fusible Strip', spec: 'Knit tricot polyamide stretch, 20 GSM', wasteFactor: 1.05, baseQty: 0.2, unit: 'm', cost: 1.5, supplier: 'Freudenberg Vlieseline' },
      { id: 'mat-3', name: 'Thread: fine spun polyester', spec: 'Tex 16 micro-fine garment thread', wasteFactor: 1.1, baseQty: 80, unit: 'm', cost: 0.02, supplier: 'Gütermann Industrial' },
      { id: 'mat-4', name: 'Perfect Fit Woven Main Label', spec: 'Damask satin, 45mm x 25mm, hot cut', wasteFactor: 1.01, baseQty: 1, unit: 'pc', cost: 0.22, supplier: 'Avery Dennison' }
    ],
    routing: [
      { step: '01', op: 'Fuse Neckline Curves and Bias Stay-tape strips', machine: 'Industrial Fusing Machine (Mini)', sam: 1.2, rate: 0.25 },
      { step: '02', op: 'Stitch & Secure Asymmetrical Neckline Gather Pleats', machine: 'Single Needle Lockstitch (Class 301) + Gather', sam: 2.8, rate: 0.55 },
      { step: '03', op: 'Assemble Side Seams and Shoulders (Micro-French)', machine: 'Single Needle Lockstitch + micro-trimmer foot', sam: 5.5, rate: 1.05 },
      { step: '04', op: 'Bias Bind Armholes & Finished Neck Facings', machine: 'SNLS + Bias Binder Attachment', sam: 4.2, rate: 0.8 },
      { step: '05', op: 'Machine Stitch Rolled Bottom Micro-Hem', machine: 'SNLS + Rolled Hemming Folder Foot (2mm)', sam: 2.8, rate: 0.55 },
      { step: '06', op: 'Steaming, Thread Trimming, QC Bagging & Tagging', machine: 'Industrial Hand Steam Iron + Soft form hanger', sam: 1.7, rate: 0.35 }
    ]
  }
};

export function createDemoOrderSeed(now = Date.now()) {
  const formatDate = (daysAgo) =>
    new Date(now - daysAgo * 24 * 3600 * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  return [
    {
      id: 'SRT-409124',
      date: formatDate(4),
      items: [
        {
          patternName: 'Palazzo Wide-Leg Trouser',
          format: 'PDF',
          price: 13.0,
          quantity: 1,
          sizePreference: '10',
          image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80'
        },
        {
          patternName: 'Renaissance Pleated Bodice',
          format: 'PDF',
          price: 15.0,
          quantity: 1,
          sizePreference: '8',
          image: 'https://images.unsplash.com/photo-1566207274740-0f8cf6b7d5a5?auto=format&fit=crop&w=120&q=80'
        }
      ],
      total: 28.0,
      status: 'Ready for Download',
      format: 'PDF'
    },
    {
      id: 'SRT-882041',
      date: formatDate(10),
      items: [
        {
          patternName: 'Aurelia Wrap Dress',
          format: 'DXF-AAMA',
          price: 24.0,
          quantity: 1,
          sizePreference: '12',
          image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=120&q=80'
        }
      ],
      total: 28.5,
      status: 'Digital files ready',
      format: 'DXF-AAMA'
    }
  ];
}
