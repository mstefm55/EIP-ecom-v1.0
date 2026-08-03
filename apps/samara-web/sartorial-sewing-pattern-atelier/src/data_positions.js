export const MEASUREMENT_POSITIONS = [
  {
    id: 1,
    label: 'NECK GIRTH (BASE)',
    name: 'Neck Girth (Base)',
    description: 'Tape runs around the neck base, level at the back, without tightening.',
    tapeHelp: 'A = START POINT, B = END POINT',
    matrix: [
      { size: 'XXS', range: '30-31 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '31-32 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '32-33 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '33-34 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '34-35 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '35-36 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '36-37 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  },
  {
    id: 2,
    label: 'SHOULDER LENGTH',
    name: 'Shoulder Length',
    description: 'Measure from neck point to shoulder/arm joint (acromion).',
    tapeHelp: 'MEASURE COUTURE SLOPE LENGTH',
    matrix: [
      { size: 'XXS', range: '11.0-11.3 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '11.3-11.6 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '11.6-11.9 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '11.9-12.2 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '12.2-12.5 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '12.5-12.8 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '12.8-13.1 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  },
  {
    id: 3,
    label: 'BUST/CHEST GIRTH',
    name: 'Bust/Chest Girth',
    description: 'Horizontal tape at fullest point, under arm, level around body.',
    tapeHelp: 'LEVEL WITH APEX OF PERFECT FIT CHEST',
    matrix: [
      { size: 'XXS', range: '76-80 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '80-84 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '84-88 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '88-92 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '92-96 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '96-100 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '100-104 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  },
  {
    id: 4,
    label: 'FRONT WAIST LENGTH (HPS TO WAIST)',
    name: 'Front Waist Length (HPS to Waist)',
    description: 'From high-point shoulder down over bust apex to natural waist.',
    tapeHelp: 'CRITICAL LENGTH METRIC FOR LENGTH ADJUSTMENTS',
    matrix: [
      { size: 'XXS', range: '39.5-40.0 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '40.0-40.5 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '40.5-41.0 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '41.0-41.5 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '41.5-42.0 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '42.0-42.5 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '42.5-43.0 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  },
  {
    id: 5,
    label: 'WAIST GIRTH',
    name: 'Waist Girth',
    description: 'Measure natural waist between lower ribs and top hip bones.',
    tapeHelp: 'TIGHT BUT BREATHABLE BIAS CONTOUR MEASURE',
    matrix: [
      { size: 'XXS', range: '58-62 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '62-66 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '66-70 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '70-74 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '74-78 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '78-82 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '82-86 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  },
  {
    id: 6,
    label: 'HIP GIRTH',
    name: 'Hip Girth',
    description: 'Measure horizontally around fullest seat/hip level.',
    tapeHelp: 'STAND NATURALLY WITH HEELS CLOSED',
    matrix: [
      { size: 'XXS', range: '82-86 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '86-90 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '90-94 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '94-98 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '98-102 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '102-106 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '106-110 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  },
  {
    id: 7,
    label: 'INSIDE LEG LENGTH (INSEAM)',
    name: 'Inside Leg Length (Inseam)',
    description: 'Measure from crotch point down to floor along inside leg.',
    tapeHelp: 'IDEAL FOR CONSTRUCTING HIGH-RISE TROUSERS',
    matrix: [
      { size: 'XXS', range: '75-76 cm', eu: 32, uk: 4, us: 0, fr: 34 },
      { size: 'XS', range: '76-77 cm', eu: 34, uk: 6, us: 2, fr: 36 },
      { size: 'S', range: '77-78 cm', eu: 36, uk: 8, us: 4, fr: 38 },
      { size: 'M', range: '78-79 cm', eu: 38, uk: 10, us: 6, fr: 40 },
      { size: 'L', range: '79-80 cm', eu: 40, uk: 12, us: 8, fr: 42 },
      { size: 'XL', range: '80-81 cm', eu: 42, uk: 14, us: 10, fr: 44 },
      { size: 'XXL', range: '81-82 cm', eu: 44, uk: 16, us: 12, fr: 46 }
    ]
  }
];
