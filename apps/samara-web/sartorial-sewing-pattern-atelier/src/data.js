/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dressImg from './assets/images/pattern_dress_1782223486101.jpg';
import trenchImg from './assets/images/pattern_trench_1782223501914.jpg';
import trouserImg from './assets/images/pattern_trouser_1782223515288.jpg';
import blouseImg from './assets/images/pattern_blouse_1782223531046.jpg';

export const MASTER_SIZING_TABLE = [
  { size: '0', bust: 32, waist: 24, hips: 34 },
  { size: '2', bust: 33, waist: 25, hips: 35 },
  { size: '4', bust: 34, waist: 26, hips: 36 },
  { size: '6', bust: 35, waist: 27, hips: 37 },
  { size: '8', bust: 36, waist: 28, hips: 38 },
  { size: '10', bust: 37.5, waist: 29.5, hips: 39.5 },
  { size: '12', bust: 39, waist: 31, hips: 41 },
  { size: '14', bust: 41, waist: 33, hips: 43 },
  { size: '16', bust: 43, waist: 35, hips: 45 },
  { size: '18', bust: 45, waist: 37, hips: 47 },
  { size: '20', bust: 47, waist: 39, hips: 49 },
  { size: '22', bust: 49, waist: 41, hips: 51 },
];

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

export const SEWING_PATTERNS = generateExtendedPatterns(INITIAL_PATTERNS, 500);
