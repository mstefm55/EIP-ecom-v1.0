/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dressImg from '../assets/images/pattern_dress_1782223486101.jpg';
import trenchImg from '../assets/images/pattern_trench_1782223501914.jpg';
import trouserImg from '../assets/images/pattern_trouser_1782223515288.jpg';
import blouseImg from '../assets/images/pattern_blouse_1782223531046.jpg';

export const MEDIA_TYPES = [
  { id: 'sample', label: '📸 Finished Sample Photo', shortLabel: 'Sample Photo' },
  { id: 'sketch', label: '🎨 Technical Sketch / Flat Drawing', shortLabel: 'Technical Sketch' },
  { id: 'pattern_layout', label: '📐 Quick Pattern Draft & Layout View', shortLabel: 'Pattern Draft Layout' },
  { id: 'detail', label: '🔍 Seam & Construction Detail', shortLabel: 'Detail View' },
  { id: 'prototype', label: '🔒 Confidential Fitting Prototype', shortLabel: 'Secret Prototype' }
];

export const DEFAULT_MEDIA_GALLERY = {
  'sartorial-01': [
    {
      id: 'm-01-1',
      title: 'Aurelia Wrap Dress - Main Sample',
      type: 'sample',
      typeLabel: 'Finished Garment Photo',
      url: dressImg,
      isSecret: false,
      description: 'Front view of Aurelia Wrap Dress crafted in Belgian linen.'
    },
    {
      id: 'm-01-2',
      title: 'Technical Flat CAD Sketch (Front & Back)',
      type: 'sketch',
      typeLabel: 'Technical Sketch',
      url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Precision vector technical sketch showing wrap bodice seams and dolman sleeves.'
    },
    {
      id: 'm-01-3',
      title: 'Quick Pattern Draft & Piece Marker Layout',
      type: 'pattern_layout',
      typeLabel: 'Pattern Draft Layout',
      url: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: '2D pattern piece layout diagram showing grainlines, fold directions, and notch placement.'
    },
    {
      id: 'm-01-4',
      title: 'French Seam & Pocket Construction Detail',
      type: 'detail',
      typeLabel: 'Detail View',
      url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Close-up macro photo of French seam interior finishing and in-seam pocket stays.'
    },
    {
      id: 'm-01-5',
      title: 'Confidential Fitting Prototype & Bust Dart Alteration Sheet',
      type: 'prototype',
      typeLabel: 'Secret Development Drawing',
      url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
      isSecret: true, // SECRET (Hidden in Quick View, workspace only)
      description: 'Atelier prototype testing photo with redline notes for size 14-22 bust grading.'
    }
  ],
  'sartorial-02': [
    {
      id: 'm-02-1',
      title: 'Utility Trench - Main Sample',
      type: 'sample',
      typeLabel: 'Finished Garment Photo',
      url: trenchImg,
      isSecret: false,
      description: 'Double-breasted trench coat in water-resistant gabardine twill.'
    },
    {
      id: 'm-02-2',
      title: 'Technical CAD Sketch (Storm Flaps & Lapels)',
      type: 'sketch',
      typeLabel: 'Technical Sketch',
      url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Vector flat showing double-breasted button alignment, collar stand, and sleeve straps.'
    },
    {
      id: 'm-02-3',
      title: 'Quick Pattern Draft / Outerwear Cutting Layout',
      type: 'pattern_layout',
      typeLabel: 'Pattern Draft Layout',
      url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: '60" wide fabric marker showing storm shield, welt pockets, and sleeve cap pieces.'
    },
    {
      id: 'm-02-4',
      title: 'Confidential Pad-Stitching Collar Test & Interlining Spec',
      type: 'prototype',
      typeLabel: 'Secret Development Drawing',
      url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
      isSecret: true, // SECRET
      description: 'Internal atelier test photo for horsehair interlining in lapel roll.'
    }
  ],
  'sartorial-03': [
    {
      id: 'm-03-1',
      title: 'Drape Trouser - Main Sample',
      type: 'sample',
      typeLabel: 'Finished Garment Photo',
      url: trouserImg,
      isSecret: false,
      description: 'Wide-leg relaxed drape trouser in washed wool crepe.'
    },
    {
      id: 'm-03-2',
      title: 'Technical Sketch (Pleat & Pocket Spec)',
      type: 'sketch',
      typeLabel: 'Technical Sketch',
      url: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Vector flat of double front pleats and waistband extension.'
    },
    {
      id: 'm-03-3',
      title: 'Quick Pattern Draft / Trouser Block Layout',
      type: 'pattern_layout',
      typeLabel: 'Pattern Draft Layout',
      url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Trouser front/back legs, fly shield, and waistband pattern pieces.'
    },
    {
      id: 'm-03-4',
      title: 'Confidential Bias Stay Pocket Reinforcement Test',
      type: 'prototype',
      typeLabel: 'Secret Development Drawing',
      url: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=800&q=80',
      isSecret: true, // SECRET
      description: 'Atelier prototype testing bias tape binding inside front slash pocket openings.'
    }
  ],
  'sartorial-04': [
    {
      id: 'm-04-1',
      title: 'Sari Silk Blouse - Main Sample',
      type: 'sample',
      typeLabel: 'Finished Garment Photo',
      url: blouseImg,
      isSecret: false,
      description: 'Keyhole gathered blouse in upcycled sari silk.'
    },
    {
      id: 'm-04-2',
      title: 'Technical Flat Drawing (Raglan Gathers & Neck Binding)',
      type: 'sketch',
      typeLabel: 'Technical Sketch',
      url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Technical vector flat showing raglan sleeve seams and neckline gathers.'
    },
    {
      id: 'm-04-3',
      title: 'Quick Pattern Draft / Silk Cutting Layout',
      type: 'pattern_layout',
      typeLabel: 'Pattern Draft Layout',
      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Pattern layout for delicate sheer and slippery silk fabrics.'
    },
    {
      id: 'm-04-4',
      title: 'Confidential Tissue Paper Stay-Stitching Trial',
      type: 'prototype',
      typeLabel: 'Secret Development Drawing',
      url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
      isSecret: true, // SECRET
      description: 'Atelier trial photo for stabilizing silk neck curve with tissue paper.'
    }
  ]
};

const STORAGE_KEY = 'sartorial_pattern_media_gallery';
const SWATCH_STORAGE_KEY = 'sartorial_pattern_swatch_library';

export const DEFAULT_FABRIC_SWATCHES = {
  'sartorial-01': [
    {
      id: 'sw-01-1',
      name: 'Organic Belgic Flax Linen 280gsm',
      colorName: 'White Sand / Oatmeal',
      colorHex: '#DBCCB5',
      pantoneName: 'White Sand',
      pantoneCode: '13-0002-TCX',
      composition: '100% Belgian Flax (Slub Weave)',
      stockMeters: 148.5,
      supplier: 'Solbiati Linen Mill, Varese, Italy',
      imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
      notes: 'Pre-washed for soft hand feel. 3% relaxation shrinkage. Ideal for relaxed wrap dress bodice and soft gathers.'
    },
    {
      id: 'sw-01-2',
      name: 'Mulberry Silk Satin Filament 120gsm',
      colorName: 'Prussian / Dress Blues',
      colorHex: '#1E243A',
      pantoneName: 'Dress Blues',
      pantoneCode: '19-4024-TCX',
      composition: '100% Mulberry Filament Silk',
      stockMeters: 64.0,
      supplier: 'Mantero Seta, Como, Italy',
      imageUrl: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=800&q=80',
      notes: 'High luster liquid drape. Use Microtex 60/8 needle. Bias-cut neck binding required.'
    },
    {
      id: 'sw-01-3',
      name: 'Eco Tencel Lyocell Peachskin 210gsm',
      colorName: 'Forest / Forest Biome',
      colorHex: '#18413B',
      pantoneName: 'Forest Biome',
      pantoneCode: '19-5414-TCX',
      composition: '100% Lenzing Tencel Lyocell',
      stockMeters: 115.0,
      supplier: 'Lenzing AG, Austria',
      imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
      notes: 'Ultra-soft hand feel with matte luster. Wash cold, steam lightly.'
    }
  ],
  'sartorial-02': [
    {
      id: 'sw-02-1',
      name: 'Water-Resistant Cotton Gabardine 290gsm',
      colorName: 'Oatmeal / White Sand',
      colorHex: '#DBCCB5',
      pantoneName: 'White Sand',
      pantoneCode: '13-0002-TCX',
      composition: '100% Combed Cotton Steep Twill',
      stockMeters: 210.0,
      supplier: 'Tessitura Monti, Treviso, Italy',
      imageUrl: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80',
      notes: 'High density weave water repellency. Sharp crease retention for lapels and gun flaps.'
    },
    {
      id: 'sw-02-2',
      name: 'Heavyweight Biking Red Twill 320gsm',
      colorName: 'Burgundy / Biking Red',
      colorHex: '#5C1A2E',
      pantoneName: 'Biking Red',
      pantoneCode: '19-1650-TCX',
      composition: '98% Cotton, 2% Elastane',
      stockMeters: 88.0,
      supplier: 'Bevilacqua Weavers, Venice, Italy',
      imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
      notes: 'Rich deep color saturation. Tailors crisp double-breasted fronts.'
    }
  ],
  'sartorial-03': [
    {
      id: 'sw-03-1',
      name: 'Pebbled Wool Crepe Suiting 270gsm',
      colorName: 'Dark Slate / Charcoal',
      colorHex: '#1A1A1E',
      pantoneName: 'Dark Slate',
      pantoneCode: '19-3906-TCX',
      composition: '98% Virgin Wool, 2% Lycra',
      stockMeters: 92.5,
      supplier: 'Vitale Barberis Canonico, Biella, Italy',
      imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
      notes: 'High bounce elasticity with shape recovery. Ideal for wide-leg trouser pleats.'
    },
    {
      id: 'sw-03-2',
      name: 'Dusty Rose Washed Linen Twill 250gsm',
      colorName: 'Rose / Dusty Rose',
      colorHex: '#B96D76',
      pantoneName: 'Dusty Rose',
      pantoneCode: '18-1630-TCX',
      composition: '100% Linen',
      stockMeters: 130.0,
      supplier: 'Solbiati Linen Mill, Italy',
      imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
      notes: 'Structured yet breathable. Press with damp cloth.'
    }
  ],
  'sartorial-04': [
    {
      id: 'sw-04-1',
      name: 'Upcycled Sari Silk Habotai 90gsm',
      colorName: 'Dress Blues / Prussian',
      colorHex: '#1E243A',
      pantoneName: 'Dress Blues',
      pantoneCode: '19-4024-TCX',
      composition: '100% Reclaimed Vintage Silk',
      stockMeters: 45.0,
      supplier: 'Artisan Cooperative, Varanasi, India',
      imageUrl: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=800&q=80',
      notes: 'Weightless semi-sheer luster. Use French seams exclusively.'
    }
  ]
};

export function getAllPatternSwatches() {
  try {
    const saved = localStorage.getItem(SWATCH_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_FABRIC_SWATCHES, ...parsed };
      }
    }
  } catch (e) {
    console.error("Error loading pattern swatch library:", e);
  }
  return DEFAULT_FABRIC_SWATCHES;
}

export function getPatternSwatches(patternId) {
  const allSwatches = getAllPatternSwatches();
  if (allSwatches[patternId]) {
    return allSwatches[patternId];
  }
  return [
    {
      id: `sw-${patternId}-default`,
      name: 'Atelier Core Belgian Linen 280gsm',
      colorName: 'White Sand / Oatmeal',
      colorHex: '#DBCCB5',
      pantoneName: 'White Sand',
      pantoneCode: '13-0002-TCX',
      composition: '100% Organic Flax',
      stockMeters: 120.0,
      supplier: 'Atelier Stock Reserve',
      imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80',
      notes: 'Core fabric swatch for this pattern design.'
    }
  ];
}

export function savePatternSwatches(patternId, swatchList) {
  const allSwatches = getAllPatternSwatches();
  allSwatches[patternId] = swatchList;
  try {
    localStorage.setItem(SWATCH_STORAGE_KEY, JSON.stringify(allSwatches));
    window.dispatchEvent(new CustomEvent('pattern_swatches_updated', { detail: { patternId } }));
  } catch (e) {
    console.error("Error saving pattern swatches:", e);
  }
}

export function addPatternSwatchItem(patternId, newSwatch) {
  const swatchList = getPatternSwatches(patternId);
  const swatchWithId = {
    id: `sw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    stockMeters: 100,
    ...newSwatch
  };
  const updatedList = [swatchWithId, ...swatchList];
  savePatternSwatches(patternId, updatedList);
  return updatedList;
}

export function deletePatternSwatchItem(patternId, swatchId) {
  const swatchList = getPatternSwatches(patternId);
  const updatedList = swatchList.filter(s => s.id !== swatchId);
  savePatternSwatches(patternId, updatedList);
  return updatedList;
}

/**
 * Retrieves the full media gallery map for all patterns
 */
export function getAllPatternMedia() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_MEDIA_GALLERY, ...parsed };
      }
    }
  } catch (e) {
    console.error("Error loading pattern media gallery:", e);
  }
  return DEFAULT_MEDIA_GALLERY;
}

/**
 * Retrieves the media list for a specific pattern ID
 */
export function getPatternMedia(patternId) {
  const allMedia = getAllPatternMedia();
  if (allMedia[patternId]) {
    return allMedia[patternId];
  }
  // Generic fallback if pattern is dynamically generated
  return [
    {
      id: `m-${patternId}-default`,
      title: 'Primary Design Spec',
      type: 'sample',
      typeLabel: 'Finished Garment Photo',
      url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Default sample photo for this pattern.'
    },
    {
      id: `m-${patternId}-sketch`,
      title: 'Technical Flat CAD Sketch',
      type: 'sketch',
      typeLabel: 'Technical Sketch',
      url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
      isSecret: false,
      description: 'Vector technical drawing.'
    },
    {
      id: `m-${patternId}-secret`,
      title: 'Confidential Prototype Note',
      type: 'prototype',
      typeLabel: 'Secret Development Drawing',
      url: 'https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=800&q=80',
      isSecret: true,
      description: 'Confidential internal prototype photo.'
    }
  ];
}

/**
 * Saves the media list for a specific pattern ID
 */
export function savePatternMedia(patternId, mediaList) {
  const allMedia = getAllPatternMedia();
  allMedia[patternId] = mediaList;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allMedia));
    window.dispatchEvent(new CustomEvent('pattern_media_updated', { detail: { patternId } }));
  } catch (e) {
    console.error("Error saving pattern media:", e);
  }
}

/**
 * Toggles the secret/visible state of a specific media item
 */
export function toggleMediaVisibility(patternId, mediaId) {
  const mediaList = getPatternMedia(patternId);
  const updatedList = mediaList.map(item => {
    if (item.id === mediaId) {
      return { ...item, isSecret: !item.isSecret };
    }
    return item;
  });
  savePatternMedia(patternId, updatedList);
  return updatedList;
}

/**
 * Adds a new media item to a pattern
 */
export function addPatternMediaItem(patternId, newItem) {
  const mediaList = getPatternMedia(patternId);
  const itemWithId = {
    id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    isSecret: false,
    ...newItem
  };
  const updatedList = [...mediaList, itemWithId];
  savePatternMedia(patternId, updatedList);
  return updatedList;
}

/**
 * Deletes a media item from a pattern
 */
export function deletePatternMediaItem(patternId, mediaId) {
  const mediaList = getPatternMedia(patternId);
  const updatedList = mediaList.filter(item => item.id !== mediaId);
  savePatternMedia(patternId, updatedList);
  return updatedList;
}
