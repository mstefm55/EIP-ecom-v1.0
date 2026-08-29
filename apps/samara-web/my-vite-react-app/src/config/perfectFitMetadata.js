import {
  buildCanonicalAvatarAreas,
  buildCanonicalDefaultViewConfig,
  buildCanonicalMeasurementDefinitions
} from '../lib/metadataDerivations';

import adultFemaleFront from '../assets/find-my-size/Adult_Female_Front.png';

import adultFemaleSide from '../assets/find-my-size/Adult_Female_Side.png';

import adultFemaleBack from '../assets/find-my-size/Adult_Female_Back.png';

import adultMaleFront from '../assets/find-my-size/Adult_Male_Front.png';

import adultMaleSide from '../assets/find-my-size/Adult_Male_Side.png';

import adultMaleBack from '../assets/find-my-size/Adult_Male_Back.png';

import teenFemaleFront from '../assets/find-my-size/Teen_Female_Front.png';

import teenFemaleSide from '../assets/find-my-size/Teen_Female_Side.png';

import teenFemaleBack from '../assets/find-my-size/Teen_Female_Back.png';

import teenMaleFront from '../assets/find-my-size/Teen_Male_Front.png';

import teenMaleSide from '../assets/find-my-size/Teen_Male_Side.png';

import teenMaleBack from '../assets/find-my-size/Teen_Male_Back.png';

import kidFemaleFront from '../assets/find-my-size/Kid_Female_Front.png';

import kidFemaleSide from '../assets/find-my-size/Kid_Female_Side.png';

import kidFemaleBack from '../assets/find-my-size/Kid_Female_Back.png';

import kidMaleFront from '../assets/find-my-size/Kid_Male_Front.png';

import kidMaleSide from '../assets/find-my-size/Kid_Male_Side.png';

import kidMaleBack from '../assets/find-my-size/Kid_Male_Back.png';


// Canonical static role/permission fallback metadata
const rolePermissions = {
  "roles": {
    "visitor": {
      "name": "Casual Visitor",
      "description": "Public spectator browsing catalog designs and digital patterns.",
      "permissions": {
        "gallery": "allowed",
        "checkoutStore": "allowed",
        "projectManagement": "denied",
        "inventory": "denied",
        "professionalDashboard": "denied",
        "permissionsOverview": "allowed",
        "analytics": "denied"
      }
    },
    "member": {
      "name": "Perfect Fit Member",
      "description": "Active enthusiast drafting custom projects and coordinating garments.",
      "permissions": {
        "gallery": "allowed",
        "checkoutStore": "allowed",
        "projectManagement": "allowed",
        "inventory": "denied",
        "professionalDashboard": "denied",
        "permissionsOverview": "allowed",
        "analytics": "denied"
      }
    },
    "partner": {
      "name": "Creative Partner",
      "description": "Authorized partner managing fabric inventories and production timelines.",
      "permissions": {
        "gallery": "allowed",
        "checkoutStore": "allowed",
        "projectManagement": "allowed",
        "inventory": "allowed",
        "professionalDashboard": "allowed",
        "permissionsOverview": "allowed",
        "analytics": "denied"
      }
    },
    "professional": {
      "name": "Master Professional",
      "description": "Super administrator possessing comprehensive system overrides and telemetry tracking.",
      "permissions": {
        "gallery": "allowed",
        "checkoutStore": "allowed",
        "projectManagement": "allowed",
        "inventory": "allowed",
        "professionalDashboard": "allowed",
        "permissionsOverview": "allowed",
        "analytics": "allowed"
      }
    }
  },
  "meta": {
    "version": "1.0.0",
    "lastUpdated": "2026-07-12",
    "engine": "DynamicLayout Engine V2",
    "authStandard": "ISO-27001 Perfect Fit Log Integrity"
  }
};

const PRODUCT_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  CATEGORY_REVIEW_REQUIRED: "CATEGORY_REVIEW_REQUIRED",
  PRODUCT_REVIEW: "PRODUCT_REVIEW",
  NEEDS_CHANGES: "NEEDS_CHANGES",
  APPROVED: "APPROVED",
  RELEASED: "RELEASED",
  REJECTED: "REJECTED"
};

const CATEGORY_REQUEST_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  MERGED: "MERGED"
};

const CATALOG_AUDIENCES = [
  {
    id: "women",
    label: "Women",
    description: "Women’s sewing patterns and fashion blueprints",
    categories: [
      { id: "dresses", label: "Dresses" },
      { id: "tops", label: "Tops" },
      { id: "corsets", label: "Corsets" },
      { id: "pants-shorts", label: "Pants & Shorts" },
      { id: "skirts", label: "Skirts" },
      { id: "jumpsuits", label: "Jumpsuits" },
      { id: "jackets-vests", label: "Jackets & Vests" },
      { id: "coats-capes", label: "Coats & Capes" },
      { id: "evening-party", label: "Evening & Party Looks" },
      { id: "pattern-of-the-day", label: "Pattern of the Day" },
      { id: "free-patterns", label: "Free Patterns" },
      { id: "accessories", label: "Accessories" },
      { id: "curve-plus", label: "Curve & Plus Sizes" },
      { id: "best-sellers", label: "Best Sellers" },
      { id: "lingerie", label: "Lingerie" }
    ]
  },
  {
    id: "men",
    label: "Men",
    description: "Men’s sewing patterns and tailored garments",
    categories: [
      { id: "swimwear-activewear", label: "Swimwear & Activewear" },
      { id: "homewear-sleepwear", label: "Homewear & Sleepwear" }
    ]
  },
  {
    id: "kids",
    label: "Kids",
    description: "Children’s, baby and junior sewing patterns",
    categories: [
      { id: "infants-toddlers", label: "Infants & Toddlers" },
      { id: "children", label: "Children" },
      { id: "girls", label: "Girls" },
      { id: "boys", label: "Boys" }
    ]
  }
];

const DEFAULT_COLLECTION_TAGS = [
  { id: "new-release", label: "New Release" },
  { id: "best-seller", label: "Best Seller" },
  { id: "free-pattern", label: "Free Pattern" },
  { id: "pattern-of-the-day", label: "Pattern of the Day" },
  { id: "premium-blueprint", label: "Premium Blueprint" },
  { id: "beginner-friendly", label: "Beginner Friendly" },
  { id: "editorial-pick", label: "Editorial Pick" }
];

const DEFAULT_DESIGNER_BRANDS = [
  { id: "perfect-fit-bureau", label: "Perfect Fit Bureau" },
  { id: "viki-sews", label: "Viki Sews" },
  { id: "independent-designer", label: "Independent Designer" }
];

const FLOATING_TOOL_LAYOUT_VERSION = '2026-08-25-floating-stack-v1';

const FLOATING_TOOL_LAUNCHER = {
  width: 220,
  compactWidth: 56,
  height: 56,
  edge: 16,
  gap: 12
};

const STACK_INDEX_BY_TOOL = {
  messages: 0,
  sizeConversion: 1
};

const UI_LAYERS = Object.freeze({
  content: 0,
  localEditor: 60,

  floatingLauncher: 3000,

  navigation: 4000,
  navigationMenu: 4200,

  utilityPanel: 4500,

  modalBackdrop: 5100,
  modal: 5200,
  criticalDialog: 5800,

  toast: 6000
});

const USERNAME_REGISTRY_STORAGE_KEY = 'perfectfit_username_registry_v1';

const USER_PROFILE_STORAGE_KEY = 'perfectfit_bureau_user';

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'moderator',
  'support',
  'system',
  'perfectfit',
  'perfect_fit',
  'root',
  'api',
  'security'
]);

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;

const SHOW_CATALOGUE_VIEW_MODE_TOGGLES = false;

const DEFAULT_LEGACY_PATTERN_SIZE = '8';

const CART_IMAGE_FIELDS = [
  'image',
  'primaryImage',
  'coverImage',
  'thumbnail',
  'thumbnailUrl',
  'mainImage',
  'imageUrl'
];

const APP_LAYOUT_METADATA_VERSION = '2026-08-25-cleanup-wave-1';

const APP_LAYOUT_METADATA_KEY = 'perfectfit_app_layout_metadata';

const APP_LAYOUT_METADATA_VERSION_KEY = 'perfectfit_app_layout_metadata_version';

const TRACK_SHIPMENT_FEATURE_KEY = 'perfectfit_enable_track_shipment';

const DISABLED_LAYOUT_SURFACE_IDS = new Set([
  'role-based-dynamic-layout',
  'perfectfit-specification'
]);

const PAGE_SHELL_CLASS = 'mx-auto w-full max-w-[1920px] px-2 sm:px-3 lg:px-4';

const MAIN_PAGE_SHELL_CLASS = `${PAGE_SHELL_CLASS} pt-[3mm] pb-10 sm:pb-12 space-y-14 sm:space-y-16`;

const NAV_GROUP_LABEL_KEYS = {
  'SHOWROOM & PATTERNS': 'nav.group.showroomPatterns',
  'FIT & SIZING': 'nav.group.fitSizing',
  'DESIGN SANDBOX': 'nav.group.designSandbox',
  'SUPPORT & GUIDANCE': 'nav.group.supportGuidance',
  MORE: 'nav.group.more'
};

const NAV_ITEM_LABEL_KEYS = {
  gallery: {
    labelKey: 'nav.item.patterns.label',
    descriptionKey: 'nav.item.patterns.description'
  },
  'my-orders': {
    labelKey: 'nav.item.orders.label',
    descriptionKey: 'nav.item.orders.description'
  },
  'creations-feedback': {
    labelKey: 'nav.item.community.label',
    descriptionKey: 'nav.item.community.description'
  },
  'creator-community-blog': {
    labelKey: 'nav.item.blog.label',
    descriptionKey: 'nav.item.blog.description'
  },
  calculator: {
    labelKey: 'nav.item.fit.label',
    descriptionKey: 'nav.item.fit.description'
  },
  workspace: {
    labelKey: 'nav.item.workspace.label',
    descriptionKey: 'nav.item.workspace.description'
  },
  'materials-action': {
    labelKey: 'nav.item.materials.label',
    descriptionKey: 'nav.item.materials.description'
  },
  'perfectfit-library': {
    labelKey: 'nav.item.academy.label',
    descriptionKey: 'nav.item.academy.description'
  },
  'perfectfit-faq': {
    labelKey: 'nav.item.faq.label',
    descriptionKey: 'nav.item.faq.description'
  },
  'design-consultation-action': {
    labelKey: 'nav.item.consultation.label',
    descriptionKey: 'nav.item.consultation.description'
  }
};

const DEFAULT_APP_LAYOUT_METADATA = [
  {
    id: "hero-carousel",
    component: "HeroCarousel",
    name: "Homepage Hero Carousel",
    view: "home",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "BUREAU HOME",
      groupOrder: 5,
      label: "Home",
      description: "Return to the front page",
      order: 10,
      targetView: "home"
    }
  },
  {
  id: "orbital-featured",
  component: "SignatureOrbitCarouselA",
  name: "Our Signature Collections",
  title: "Our Signature Collections",
  subtitle: "Let Your Uniqueness Take Shape",
  view: "home",
  order: 20,
  isEnabled: true
},
//{
//  id: "orbital-featured",
//  component: "SignaturePerspectiveStackCarouselB",
//  name: "Our Signature Collections",
//  title: "Our Signature Collections",
//  subtitle: "Let Your Uniqueness Take Shape",
//  view: "home",
//  order: 20,
//  isEnabled: true
//},
//  {
//    id: "orbital-featured",
//    component: "OrbitCarousel",
//    name: "Orbital Featured Patterns",
//    view: "home",
//    order: 20,
//    isEnabled: true
//  },
  {
  id: "home-maker-transition",
  component: "HomeMakerTransition",
  name: "Home Maker Transition Title",
  view: "home",
  order: 25,
  isEnabled: true
},
  {
    id: "customer-testimonials",
    component: "TestimonialCarousel",
    name: "Customer Testimonials",
    view: "home",
    order: 30,
    isEnabled: true
  },

  {
    id: "gallery",
    component: "DynamicGallery",
    name: "Dynamic Pattern Gallery",
    view: "patterns",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "SHOWROOM & PATTERNS",
      groupOrder: 10,
      label: "Pattern Library",
      description: "Browse premium design booklets",
      order: 10,
      targetView: "patterns"
    }
  },
  {
    id: "my-orders",
    component: "MyOrdersSection",
    name: "My Orders",
    view: "orders",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "SHOWROOM & PATTERNS",
      groupOrder: 10,
      label: "My Orders",
      description: "Access PDF patterns & downloads",
      order: 20,
      targetView: "orders"
    }
  },
  {
    id: "creations-feedback",
    component: "CreationsAndFeedback",
    name: "Creations And Feedback",
    view: "community",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "SHOWROOM & PATTERNS",
      groupOrder: 10,
      label: "Community feedback",
      description: "Finished garments, reviews & maker inspiration",
      order: 30,
      targetView: "community"
    }
  },
  {
    id: "creator-community-blog",
    component: "CreatorBlog",
    name: "Community Board",
    view: "blog",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "SHOWROOM & PATTERNS",
      groupOrder: 10,
      label: "Community Board",
      description: "Posts & articles",
      order: 40,
      targetView: "blog"
    }
  },
{
  id: "workspace",
  component: "Workspace",
  name: "Workspace",
  view: "workspace",
  order: 10,
  isEnabled: true,
  nav: {
    show: true,
    group: "DESIGN SANDBOX",
    groupOrder: 20,
    label: "Workspace",
    description: "Projects, styles and design development",
    order: 10,
    targetView: "workspace"
  }
},
{
  id: "materials-action",
  component: "ActionOnly",
  name: "Materials",
  view: "__action__",
  order: 20,
  isEnabled: true,
  nav: {
    show: true,
    group: "DESIGN SANDBOX",
    groupOrder: 20,
    label: "Materials",
    description: "Fabric stash, swatches and sourcing",
    order: 20,
    action: "openMaterials"
  }
},
//  {
//    id: "dynamic-metadata-ui",
//   component: "DynamicUiEngine",
//    name: "Sewing Room",
//    view: "workspace2",
//    order: 10,
//    isEnabled: true,
//    nav: {
//      show: true,
//      group: "DESIGN SANDBOX",
//     groupOrder: 20,
//      label: "Sewing Room",
//      description: "Track sewing sessions & drafting work",
//     order: 10,
//     targetView: "workspace2"
//    }
//  },
  {
    id: "calculator",
    component: "MannequinGuide",
    name: "Find My Size",
    view: "fit",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "FIT & SIZING",
      groupOrder: 15,
      label: "Find My Size",
      description: "Measurement guide and garment-specific size recommendation",
      order: 10,
      targetView: "fit",
      targetTool: "fitting-room-sizer"
    }
  },
  {
    id: "perfectfit-specification",
    component: "PerfectFitStandards",
    name: "Size Guide",
    view: "about",
    order: 10,
    isEnabled: false,
    nav: {
      show: false,
      group: "FIT & SIZING",
      groupOrder: 15,
      label: "Size Guide",
      description: "Standard size references, measurements and fit guidance",
      order: 20,
      targetView: "about"
    }
  },
  {
    id: "perfectfit-library",
    component: "EditorialAcademy",
    name: "Perfect Fit Library",
    view: "academy",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "DESIGN SANDBOX",
      groupOrder: 20,
      label: "Perfect Fit Library",
      description: "Articles, guides & sewing resources",
      order: 40,
      targetView: "academy"
    }
  },

  {
    id: "perfectfit-faq",
    component: "PerfectFitFaq",
    name: "Perfect Fit FAQ",
    view: "faq",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "SUPPORT & GUIDANCE",
      groupOrder: 30,
      label: "Fit & Pattern FAQ",
      description: "Answers about sizing, downloads & pattern use",
      order: 10,
      targetView: "faq"
    }
  },
  {
    id: "design-consultation-action",
    component: "ActionOnly",
    name: "Design Consultation",
    view: "__action__",
    order: 10,
    isEnabled: true,
    nav: {
      show: true,
      group: "SUPPORT & GUIDANCE",
      groupOrder: 30,
      label: "Design Consultation",
      description: "Book fit, pattern or design support",
      order: 20,
      action: "openConsultation"
    }
  },

  {
    id: "role-based-dynamic-layout",
    component: "DynamicLayout",
    name: "Role Based Dynamic Layout",
    view: "workspace2",
    order: 10,
    isEnabled: false,
    nav: {
      show: false,
      group: "DESIGN SANDBOX",
      groupOrder: 20,
      label: "Workspace 2",
      description: "Legacy workspace reference",
      order: 15,
      targetView: "workspace2"
    }
  },
  {
    id: "sewing-timer",
    component: "SewingSessionTimer",
    name: "Legacy Sewing Session Timer",
    view: "workspace2",
    order: 40,
    isEnabled: false
  },
  {
  id: "administrator-console",
  component: "AdminControlPanel",
  name: "Administrator Console",
  view: "admin",
  order: 10,
  isEnabled: true,
  roles: ["administrator"]
}
];


// Tech Pack static fallback metadata
const techPackMetadata = {
  ui: {
    tabs: [
      {
        code: 'TECHNICAL_DRAWINGS',
        label: 'Technical Drawings',
        icon: 'drawing'
      },
      {
        code: 'INDUSTRIAL_PACK',
        label: 'Industrial Pack',
        icon: 'factory'
      },
      {
        code: 'RELEASES',
        label: 'Releases',
        icon: 'release'
      }
    ],

    companionPanels: [
      {
        code: 'CONSTRUCTION_OPERATIONS',
        label: 'Construction & Operations',
        shortLabel: 'Construction',
        icon: 'construction',
        nodeType: 'sewing'
      },
      {
        code: 'MEASUREMENT_CHART',
        label: 'Measurement Chart',
        shortLabel: 'Measurements',
        icon: 'measurement',
        nodeType: 'sizeSet'
      },
      {
        code: 'PROJECT_JOURNAL',
        label: 'Project Journal',
        shortLabel: 'Journal',
        icon: 'journal',
        nodeType: 'projectJournal'
      }
    ]
  },

  drawingStudio: {
    technicalSketchTypeCode: 'TECHNICAL_SKETCH',

    canvas: {
      viewBoxWidth: 1000,
      viewBoxHeight: 1400,
      imageX: 80,
      imageY: 90,
      imageWidth: 840,
      imageHeight: 1190,
      minimumZoom: 0.5,
      maximumZoom: 1.6,
      zoomStep: 0.1
    },

    tools: [
      {
        code: 'SELECT',
        label: 'Select',
        icon: 'select'
      },
      {
        code: 'CALLOUT',
        label: 'Callout',
        icon: 'callout'
      },
      {
        code: 'DIMENSION',
        label: 'Dimension',
        icon: 'dimension'
      },
      {
        code: 'ARROW',
        label: 'Arrow',
        icon: 'arrow'
      },
      {
        code: 'TEXT',
        label: 'Text',
        icon: 'text'
      }
    ],

    sequenceModes: [
      {
        code: 'NUMERIC',
        label: '1 2 3'
      },
      {
        code: 'ALPHA',
        label: 'A B C'
      }
    ],

    referenceTypes: [
      {
        code: 'NONE',
        label: 'No linked reference',
        source: null
      },
      {
        code: 'CONSTRUCTION_STEP',
        label: 'Construction step',
        source: 'sewing.constructionSteps'
      },
      {
        code: 'OPERATION',
        label: 'Manufacturing operation',
        source: 'sewing.operations'
      },
      {
        code: 'MEASUREMENT',
        label: 'Measurement / POM',
        source: 'measurement.measurements'
      }
    ],

    defaults: {
      activeTool: 'SELECT',
      sequenceMode: 'NUMERIC',
      calloutWidth: 360,
      calloutHeight: 82,
      shortText: 'New callout',
      dimensionText: 'Dimension',
      textValue: 'Technical note'
    },

    print: {
      paper: 'A4',
      orientation: 'landscape',
      drawingColumnPercent: 72,
      notesColumnPercent: 28
    }
  },

  release: {
    workflowKey: 'TECH_PACK'
  }
};


// Workspace static fallback metadata
const workspaceMetadata = {
  version: '2026-08-22-workspace-metadata-v3.3-fit-spec-governance',

  storageKey: 'perfectfit_workspace_data_v1',
  
  defaultLocale: 'en',

  supportedLocales: [
    'en'
  ],

  localePacks: {
    en: {
      'workspace.kicker': 'Design Sandbox',

      'workspace.title': 'Workspace',

      'workspace.subtitle':
        'Manage projects, styles, variants, project journals, pattern files, sizing, sewing, technical packs and revision history.',

      'approval.center.title':
        'Approval & Release',

      'approval.publication.title':
        'Publication release',

      'approval.publication.notReady':
        'Not ready',

      'approval.publication.ready':
        'Ready for moderator review',

      'approval.publication.awaiting':
        'Awaiting moderator release',

      'approval.publication.returned':
        'Returned by moderator',

      'approval.publication.published':
        'Released for publication',

      'approval.publication.unpublished':
        'Unpublished',

      'approval.action.requestModerator':
        'Request moderator release',

      'approval.action.resubmitModerator':
        'Resubmit to moderator',

      'approval.action.moderatorReturn':
        'Return to designer',

      'approval.action.moderatorPublish':
        'Approve & publish',

      'approval.action.unpublish':
        'Unpublish',

      'approval.action.republish':
        'Republish',

      'approval.action.messageModerator':
        'Message moderator',

      'approval.status.draft':
        'Draft',

      'approval.status.inReview':
        'In review',

      'approval.status.approved':
        'Approved',

      'approval.status.released':
        'Released',

      'approval.status.active':
        'Active',

      'approval.status.superseded':
        'Superseded',

      'approval.resource.project':
        'Project',

      'approval.resource.techPack':
        'Tech Pack',

      'approval.resource.patternFile':
        'Pattern file',

      'approval.resource.sewingStandard':
        'Sewing standard',

      'approval.resource.fitSpecification':
        'Fit specification',

      'approval.action.submit':
        'Submit for review',

      'approval.action.returnDraft':
        'Return to draft',

      'approval.action.approve':
        'Approve',

      'approval.action.approveRelease':
        'Approve & release',

      'approval.action.activate':
        'Approve & activate',

      'workspace.tree.title': 'Projects',

      'node.project': 'Project',
      'node.product': 'Style',
      'node.variant': 'Variant',
      'node.projectJournal': 'Project Journal',
      'node.media': 'Media',
      'node.patternLibrary': 'Pattern Library',
      'node.sizeSet': 'Measurement Chart',
      'node.sewing': 'Sewing',
      'node.techpack': 'Tech Pack',
      'node.changeHistory': 'Change History',

      'nav.variantOverview': 'Overview',

      'module.projectJournal.description':
        'Track project-development time, task progress, notes and session photos for this variant.',

      'module.media.description':
        'Manage product images and visual assets for this variant.',

      'module.patternLibrary.description':
        'Manage the base pattern, graded patterns and generated output files.',

      'module.sizeSet.description':
        'Manage canonical garment sizes, size-system references and the POM measurement matrix for this variant.',

      'module.sewing.description':
        'Define garment construction, manufacturing operations, industrial time standards and quality requirements.',

      'sewing.context.variant': 'Variant',
      'sewing.context.pattern': 'Active pattern',
      'sewing.tab.construction': 'Construction',
      'sewing.tab.operations': 'Operations',
      'sewing.tab.constructionOperations': 'Construction & Operations',
      'sewing.tab.timeMotion': 'Time & Motion',
      'sewing.tab.quality': 'Quality',
      'sewing.construction.title': 'Garment construction',
      'sewing.construction.subtitle': 'Define the assembly sequence once so operations, time study and Tech Pack can reuse it.',
      'sewing.construction.empty': 'No construction steps yet.',
      'sewing.requirements.title': 'Sewing requirements',
      'sewing.allowance.title': 'Seam allowance rule',
      'sewing.operations.title': 'Manufacturing operations',
      'sewing.operations.subtitle': 'Decompose construction into the operations that can be studied, standardized and reused downstream.',
      'sewing.operations.sync': 'Sync from construction',
      'sewing.operations.add': 'Add operation',
      'sewing.quality.title': 'Quality checkpoints',
      'sewing.quality.subtitle': 'Record what must be checked during sample review or manufacturing.',
      'sewing.quality.add': 'Add checkpoint',
      'sewing.quality.empty': 'No quality checkpoints yet.',
      'sewing.quality.checkpoint': 'Checkpoint',
      'sewing.quality.tolerance': 'Tolerance / requirement',
      'sewing.quality.notes': 'General quality / sample notes',
      'sewing.field.step': 'Step',
      'sewing.field.instruction': 'Instruction',
      'sewing.field.seamFinish': 'Seam / finish',
      'sewing.field.seamAllowance': 'Seam allowance',
      'sewing.field.technicalNote': 'Technical note',
      'sewing.field.item': 'Item',
      'sewing.field.quantity': 'Specification / quantity',
      'sewing.field.note': 'Note',
      'sewing.field.operation': 'Operation',
      'sewing.field.machine': 'Machine',
      'sewing.field.qualityCheckpoint': 'Quality checkpoint',
      'sewing.field.method': 'Method / seam',
      'sewing.field.status': 'Status',
      'sewing.action.addStep': 'Add step',
      'sewing.action.addRequirement': 'Add requirement',
      'sewing.action.remove': 'Remove',

      'sewing.timeMotion.title': 'Time & Motion Study',
      'sewing.timeMotion.help': 'Help',
      'sewing.timeMotion.help.title': 'Time study workflow',
      'sewing.timeMotion.mode.video': 'Video study',
      'sewing.timeMotion.mode.stopwatch': 'Live stopwatch',
      'sewing.timeMotion.sequence.sequence': 'Sequence study',
      'sewing.timeMotion.sequence.repeat': 'Repeated cycle study',
      'sewing.timeMotion.source.title': 'Study source',
      'sewing.timeMotion.source.upload': 'Upload video',
      'sewing.timeMotion.source.empty': 'Upload a recorded study or turn on the desktop camera.',
      'sewing.timeMotion.playback': 'Playback',
      'sewing.timeMotion.capture.start': 'Start operation',
      'sewing.timeMotion.capture.end': 'End operation',
      'sewing.timeMotion.camera.on': 'Camera on',
      'sewing.timeMotion.camera.off': 'Camera off',
      'sewing.timeMotion.camera.error': 'Camera access is unavailable. Check browser permission and camera availability.',
      'sewing.timeMotion.camera.recordingMode': 'Recording mode',
      'sewing.timeMotion.camera.fullStudy': 'One full study recording',
      'sewing.timeMotion.camera.operationClips': 'Clip per operation',
      'sewing.timeMotion.camera.startRecording': 'Start full recording',
      'sewing.timeMotion.camera.stopRecording': 'Stop recording',
      'sewing.timeMotion.annotations': 'Study annotations',
      'sewing.timeMotion.annotation.placeholder': 'Record setup, handling, delay, inspection or other context...',
      'sewing.timeMotion.annotation.add': 'Add note',
      'sewing.timeMotion.annotation.productive': 'Productive work',
      'sewing.timeMotion.annotation.handling': 'Handling',
      'sewing.timeMotion.annotation.preparation': 'Preparation / setup',
      'sewing.timeMotion.annotation.inspection': 'Inspection',
      'sewing.timeMotion.annotation.delay': 'Delay',
      'sewing.timeMotion.annotation.personal': 'Personal',
      'sewing.timeMotion.annotation.machine': 'Machine delay',
      'sewing.timeMotion.annotation.material': 'Material delay',
      'sewing.timeMotion.annotation.other': 'Other',
      'sewing.timeMotion.stopwatch.help': 'Use this mode when observing the operator directly without recording video. Record each completed cycle; sequence mode advances automatically while repeated-cycle mode stays on the same operation.',
      'sewing.timeMotion.stopwatch.running': 'Timing',
      'sewing.timeMotion.stopwatch.ready': 'Ready',
      'sewing.timeMotion.stopwatch.start': 'Start timer',
      'sewing.timeMotion.stopwatch.pause': 'Pause timer',
      'sewing.timeMotion.stopwatch.recordAdvance': 'Record cycle & advance',
      'sewing.timeMotion.stopwatch.recordRepeat': 'Record cycle',
      'sewing.timeMotion.operation.none': 'Select an operation',
      'sewing.timeMotion.operations.title': 'Operation study sheet',
      'sewing.timeMotion.operations.subtitle': 'All capture methods write observations to the same canonical operation.',
      'sewing.timeMotion.col.step': 'Step',
      'sewing.timeMotion.col.operation': 'Operation',
      'sewing.timeMotion.col.cycles': 'Cycles',
      'sewing.timeMotion.col.avg': 'Average',
      'sewing.timeMotion.cycles': 'cycles',
      'sewing.timeMotion.rating': 'Performance rating',
      'sewing.timeMotion.allowance': 'PF&D allowance',
      'sewing.timeMotion.clips': 'Recorded study clips',
      'sewing.timeMotion.evidence.private': 'Private sewing evidence',
      'sewing.timeMotion.evidence.privateHelp': 'Study recordings stay inside Sewing and are never surfaced in Catalogue Media or Quick View.',
      'sewing.timeMotion.evidence.download': 'Download private study clip',

      'sewing.timeMotion.summary': 'Engineered standard summary',
      'sewing.timeMotion.kpi.sam': 'Total SAM',
      'sewing.timeMotion.kpi.cycles': 'Cycles',
      'sewing.timeMotion.kpi.coverage': 'Studied ops',
      'sewing.timeMotion.approve': 'Approve standards',
      'sewing.timeMotion.export': 'Export CSV',
      'sewing.timeMotion.chart.samContribution': 'SAM contribution by operation',
      'sewing.timeMotion.chart.empty': 'Capture observations to build the SAM contribution view.',
      'sewing.timeMotion.practice.kicker': 'Training',
      'sewing.timeMotion.practice.title': 'Practice study',
      'sewing.timeMotion.practice.description': 'Practice the timing controls with a synthetic sewing station. Practice data is never treated as production evidence.',
      'sewing.timeMotion.practice.open': 'Open practice study',
      'sewing.timeMotion.practice.play': 'Play practice',
      'sewing.timeMotion.practice.pause': 'Pause practice',
      'sewing.timeMotion.help.selectOperation.title': 'Select an operation',
      'sewing.timeMotion.help.selectOperation.description': 'Choose the manufacturing operation being studied. All video, camera and stopwatch observations attach to that operation.',
      'sewing.timeMotion.help.chooseSource.title': 'Choose a capture method',
      'sewing.timeMotion.help.chooseSource.description': 'Use uploaded video for precise frame analysis, live camera for floor capture, or stopwatch when no recording is required.',
      'sewing.timeMotion.help.capture.title': 'Capture observations',
      'sewing.timeMotion.help.capture.description': 'For recorded video, Start Operation reads the playhead and resumes playback; End Operation reads the playhead, pauses playback and records the duration.',
      'sewing.timeMotion.help.approve.title': 'Review and approve',
      'sewing.timeMotion.help.approve.description': 'Multiple observations are averaged before rating and PF&D are applied. Approve only when the standard is ready for downstream use.',
      'sewing.timeMotion.toast.videoTooLarge': 'This video exceeds the configured study upload limit.',
      'sewing.timeMotion.toast.invalidRange': 'End time must be later than start time.',
      'sewing.timeMotion.toast.clipSaveFailed': 'The recorded study clip could not be saved locally.',
      'sewing.timeMotion.toast.approved': 'Operation standards approved. Save the Workspace to commit the revision to Change History.',

      'module.techpack.description':
        'Compile technical drawings, manufacturing information and controlled production releases for this variant.',

      'module.changeHistory.description':
        'Review technical changes, revisions and retained reference versions.',

      'group.projectIdentity.title':
        'Project details',

      'group.styleIdentity.title':
        'Style details',

      'group.styleDevelopment.title':
        'Development',

      'group.variantIdentity.title':
        'Variant details',

      'group.variantReference.title':
        'Base reference',

      'fields.project.name.label':
        'Project name',

      'fields.project.designerCode.label':
        'Designer code',

      'fields.project.designerCode.help':
        'Stable abbreviation derived from the designer name and used in technical reference codes.',

      'fields.project.season.label':
        'Season',

      'fields.project.status.label':
        'Project status',

      'fields.product.styleName.label':
        'Style name',

      'fields.product.styleCode.label':
        'Style code',

      'fields.product.category.label':
        'Garment category',

      'fields.product.developmentStage.label':
        'Development stage',

      'fields.product.difficulty.label':
        'Difficulty level',

      'fields.product.fitSilhouette.label':
        'Fit / Silhouette',

      'fields.product.description.label':
        'Style description',

      'fields.variant.name.label':
        'Variant name',

      'fields.variant.code.label':
        'Variant code',

      'fields.variant.status.label':
        'Variant status',

      'fields.variant.sizeSystem.label':
        'Default display size system',

      'fields.variant.baseReferenceSize.label':
        'Base reference size',

      'fields.variant.baseReferenceSize.help':
        'The single physical garment size used as the technical base reference; its displayed label depends on the active sizing system.',

      'fields.variant.notes.label':
        'Variant notes',

      'dropdown.projectStatus.draft':
        'Draft',

      'dropdown.projectStatus.active':
        'Active',

      'dropdown.projectStatus.archived':
        'Archived',

      'dropdown.developmentStage.idea':
        'Idea',

      'dropdown.developmentStage.drafting':
        'Drafting',

      'dropdown.developmentStage.sampleReview':
        'Sample review',

      'dropdown.developmentStage.approved':
        'Approved',

      'dropdown.developmentStage.archived':
        'Archived',

      'dropdown.garmentCategory.dress':
        'Dress',

      'dropdown.garmentCategory.coat':
        'Coat',

      'dropdown.garmentCategory.top':
        'Top',

      'dropdown.garmentCategory.skirt':
        'Skirt',

      'dropdown.garmentCategory.trouser':
        'Trouser',

      'dropdown.difficulty.beginner':
        'Beginner',

      'dropdown.difficulty.intermediate':
        'Intermediate',

      'dropdown.difficulty.advanced':
        'Advanced',

      'dropdown.fitSilhouette.fitted':
        'Fitted',

      'dropdown.fitSilhouette.semiFitted':
        'Semi-fitted',

      'dropdown.fitSilhouette.regular':
        'Regular',

      'dropdown.fitSilhouette.relaxed':
        'Relaxed',

      'dropdown.fitSilhouette.oversized':
        'Oversized',

      'dropdown.fitSilhouette.aLine':
        'A-line',

      'dropdown.standardFitCategory.dress':
        'Dress',
      'dropdown.standardFitCategory.topBlouseShirt':
        'Top / blouse / shirt',
      'dropdown.standardFitCategory.jacketCoat':
        'Jacket / coat',
      'dropdown.standardFitCategory.skirt':
        'Skirt',
      'dropdown.standardFitCategory.trouserShorts':
        'Trouser / shorts',
      'dropdown.standardFitCategory.onePiece':
        'Jumpsuit / one-piece',

      'dropdown.fitPriority.critical':
        'Critical',
      'dropdown.fitPriority.important':
        'Important',
      'dropdown.fitPriority.secondary':
        'Secondary',
      'dropdown.fitPriority.notRelevant':
        'Not relevant',

      'dropdown.fitResult.unassessed':
        'Not assessed',
      'dropdown.fitResult.tooTight':
        'Too tight',
      'dropdown.fitResult.slightlyTight':
        'Slightly tight',
      'dropdown.fitResult.good':
        'Good',
      'dropdown.fitResult.slightlyLoose':
        'Slightly loose',
      'dropdown.fitResult.tooLoose':
        'Too loose',

      'dropdown.fitIssue.none':
        'None',
      'dropdown.fitIssue.pulling':
        'Pulling',
      'dropdown.fitIssue.gaping':
        'Gaping',
      'dropdown.fitIssue.restriction':
        'Restriction',
      'dropdown.fitIssue.excessEase':
        'Excess ease',
      'dropdown.fitIssue.dragLines':
        'Drag lines',
      'dropdown.fitIssue.balance':
        'Balance',
      'dropdown.fitIssue.length':
        'Length',
      'dropdown.fitIssue.other':
        'Other',

      'dropdown.fitSeverity.none':
        'None',
      'dropdown.fitSeverity.minor':
        'Minor',
      'dropdown.fitSeverity.moderate':
        'Moderate',
      'dropdown.fitSeverity.critical':
        'Critical',

      'dropdown.sizeSystem.us':
        'US',

      'dropdown.sizeSystem.uk':
        'UK',

      'dropdown.sizeSystem.eu':
        'EU',

      'dropdown.sizeSystem.alpha':
        'Alpha',

      'dropdown.variantStatus.development':
        'In development',

      'dropdown.variantStatus.fitReview':
        'Fit review',

      'dropdown.variantStatus.approved':
        'Approved',

      'dropdown.variantStatus.archived':
        'Archived',

      'dropdown.baseSize.xs':
        'XS',

      'dropdown.baseSize.s':
        'S',

      'dropdown.baseSize.m':
        'M',

      'dropdown.baseSize.l':
        'L',

      'dropdown.baseSize.xl':
        'XL',

      'dropdown.baseSize.34':
        '34',

      'dropdown.baseSize.36':
        '36',

      'dropdown.baseSize.38':
        '38',

      'dropdown.baseSize.40':
        '40',

      'dropdown.baseSize.42':
        '42',

      'dropdown.baseSize.44':
        '44',

      'dropdown.baseSize.8':
        '8',

      'dropdown.baseSize.10':
        '10',

      'dropdown.baseSize.12':
        '12',

      'dropdown.baseSize.14':
        '14',

      'dropdown.baseSize.16':
        '16',

      'dropdown.changeInitiator.designer':
        'Designer',

      'dropdown.changeInitiator.garmentTechnician':
        'Garment technician',

      'dropdown.changeInitiator.patternMaker':
        'Pattern maker',

      'dropdown.changeInitiator.productionTeam':
        'Production team',

      'dropdown.changeInitiator.quality':
        'Quality',

      'dropdown.changeInitiator.fitTest':
        'Fit test',

      'dropdown.changeInitiator.customerFeedback':
        'Customer feedback',

      'dropdown.changeInitiator.sampleReview':
        'Sample review',

      'dropdown.changeInitiator.supplier':
        'Supplier',

      'dropdown.changeInitiator.compliance':
        'Compliance',

      'dropdown.changeInitiator.other':
        'Other',

      'dropdown.changeOperation.create':
        'Created',

      'dropdown.changeOperation.update':
        'Changed',

      'dropdown.changeOperation.delete':
        'Deleted',

      'collaboration.action.share':
        'Share',

      'collaboration.title':
        'Project Collaboration',

      'collaboration.subtitle':
        'Delegate access to designer-owned work without transferring ownership.',

      'collaboration.field.collaboratorName':
        'Collaborator name',

      'collaboration.field.collaboratorLogin':
        'Login or email',

      'collaboration.field.scope':
        'Share scope',

      'collaboration.field.duration':
        'Duration',

      'collaboration.field.expiresAt':
        'Access until',

      'collaboration.field.role':
        'Collaboration role',

      'collaboration.field.policy':
        'Change policy',

      'collaboration.modules':
        'Module access',

      'collaboration.grants':
        'Active shares',

      'collaboration.role.coDesigner':
        'Co-designer',

      'collaboration.role.contributor':
        'Contributor',

      'collaboration.role.reviewer':
        'Reviewer',

      'collaboration.role.viewer':
        'Viewer',

      'collaboration.duration.permanent':
        'Permanent until revoked',

      'collaboration.duration.fixed':
        'Fixed duration',

      'collaboration.policy.direct':
        'Direct editing',

      'collaboration.policy.approval':
        'Changes require approval',

      'collaboration.policy.review':
        'Review / comment only',

      'collaboration.permission.edit':
        'Edit',

      'collaboration.permission.view':
        'View',

      'collaboration.permission.none':
        'No access',

      'audit.tab.activity':
        'Activity',

      'audit.tab.revisions':
        'Revisions',

      'audit.source.workspaceSave':
        'Workspace save',

      'audit.source.collaboration':
        'Collaboration',

      'media.kicker':
        'Upload Catalogue And Technical Media',

    //  'media.title':
    //    'Technical Media & Catalogue Assets',

    //  'media.subtitle':
    //    'Prepare, classify and publish product imagery, technical sketches and visual pattern references.',

      'media.action.add':
        'Add Media',

      'media.action.select':
        'Select Image',

      'media.action.editCrop':
        'Edit / Crop',

      'media.action.enlarge':
        'Enlarge',

      'media.action.close':
        'Close',

      'media.action.delete':
        'Delete image',

      'media.metric.total':
        'Total Assets',

      'media.metric.visible':
        'Customer Visible',

      'media.metric.internal':
        'Internal Only',

      'media.metric.variantReference':
        'Variant Reference',

      'media.empty.kicker':
        'Media Library',

      'media.empty.title':
        'Build the visual record for this variant',

      'media.empty.description':
        'Add the main catalogue image, product photos, technical sketches, construction details and pattern previews.',

      'media.selectedSpecification':
        'Selected Asset Specification',

      'media.assetCategory':
        'Media Category',

      'media.technicalNotes':
        'Technical Notes / Description',

      'media.technicalNotes.placeholder':
        'Describe the view, construction detail, material, fit point or technical purpose...',

      'media.placement.title':
        'Asset Placement',

      'media.placement.assigned':
        'Assigned',

      'media.role.primary.label':
        'Primary',

      'media.role.primary.description':
        'Main catalogue card and default product image.',

      'media.role.technicalSketch.label':
        'Technical Sketch',

      'media.role.technicalSketch.description':
        'Technical drawing available to the Tech Pack. Customer-facing publication remains optional and is controlled separately.',

      'media.role.patternPreview.label':
        'Pattern Preview',

      'media.role.patternPreview.description':
        'Visual pattern preview only. Technical pattern files remain in Pattern Library.',

      'media.visibility.title':
        'Customer Visibility',

      'media.visibility.visible.title':
        'Visible to Customer',

      'media.visibility.visible.description':
        'Published to customer-facing catalogue and Quick View surfaces.',

      'media.visibility.internal.title':
        'Workspace Internal',

      'media.visibility.internal.description':
        'Protected inside the designer workspace and hidden from customer surfaces.',

      'media.visibility.makeInternal':
        'Keep Picture Internal',

      'media.visibility.publish':
        'Publish to Customer',

      'media.visibility.locked':
        'Remove its customer-facing placement before making this asset internal.',

      'media.thumbnail.title':
        'Thumbnail Selector ({count})',

      'media.thumbnail.hint':
        'Click to slide',

      'media.thumbnail.add':
        'Add',

      'media.slideCounter':
        'Slide {current} of {total}',

      'media.defaultTitle':
        '{style} · Media {number}',

      'media.defaultTitle.noStyle':
        'Media {number}',

      'media.editor.addTitle':
        'Prepare Media Asset',

      'media.editor.editTitle':
        'Edit Media Asset',

      'media.assetType.garmentSample':
        'Garment Sample',

      'media.assetType.technicalSketch':
        'Technical Sketch',

      'media.assetType.patternPreview':
        'Pattern Preview',

      'media.assetType.detail':
        'Construction Detail',

      'media.assetType.prototype':
        'Prototype',

      'media.assetType.reference':
        'Reference',

      'media.profile.productCard':
        'Product card',

      'media.profile.productCard.description':
        'Catalogue cards and primary product media.',

      'media.profile.productGallery':
        'Product gallery',

      'media.profile.productGallery.description':
        'Detailed portrait imagery for the product gallery.',

      'media.profile.heroBanner':
        'Hero banner',

      'media.profile.heroBanner.description':
        'Wide promotional and hero presentation imagery.',

      'media.profile.blogCover':
        'Blog cover',

      'media.profile.blogCover.description':
        'Editorial lead image for articles and features.',

      'media.profile.contentBlock':
        'Content block',

      'media.profile.contentBlock.description':
        'Flexible imagery for cards and rich content sections.',

      'media.toast.unsupported':
        'Please select a JPEG, PNG or WEBP image.',

      'media.toast.added':
        'Image added to the media gallery.',

      'media.toast.updated':
        'Image updated.',

      'media.toast.processingError':
        'The image could not be processed.',

      'media.toast.visibilityLocked':
        'This image is used on a customer-facing surface. Remove that placement first.',
      'media.compactTitle':
  'Upload Catalogue and Technical Media',

'media.summary.help':
  'Media summary help',

'media.summary.helpText':
  'The icons show total media assets, customer-visible assets, internal assets and the current variant reference.',

'media.placement.help':
  'Asset placement help',

'media.visibility.help':
  'Customer visibility help',

      'patternLibrary.tab.master':
        'Master Pattern',

      'patternLibrary.tab.sizeSets':
        'Pattern Outputs',

      'patternLibrary.tab.supporting':
        'Supporting Files',

      'patternLibrary.provider.manual':
        'Manual / Unspecified',

      'patternLibrary.provider.clo':
        'CLO',

      'patternLibrary.provider.gerber':
        'Gerber / AccuMark',

      'patternLibrary.provider.richpeace':
        'Richpeace',

      'patternLibrary.provider.optitex':
        'Optitex',

      'patternLibrary.provider.lectra':
        'Lectra',

      'patternLibrary.provider.other':
        'Other',

      'patternLibrary.type.cloProject':
        'CLO Project .zprj',

      'patternLibrary.type.cloGarment':
        'CLO Garment .zpac',

      'patternLibrary.type.cloPattern':
        'CLO Pattern .pacx',

      'patternLibrary.type.dxfAama':
        'DXF-AAMA',

      'patternLibrary.type.dxfAstm':
        'DXF-ASTM',

      'patternLibrary.type.ai':
        'Adobe Illustrator .ai',

      'patternLibrary.type.pdfA0':
        'PDF · A0',

      'patternLibrary.type.pdfA4':
        'PDF · A4 tiled',

      'patternLibrary.type.pdfLetter':
        'PDF · Letter tiled',

      'patternLibrary.type.pdfProjector':
        'PDF · Projector',

      'patternLibrary.type.pngReference':
        'PNG 1:1 reference',

      'patternLibrary.type.zip':
        'ZIP',

      'patternLibrary.type.other':
        'Other',

      'patternLibrary.status.draft':
        'Draft',

      'patternLibrary.status.inReview':
        'In Review',

      'patternLibrary.status.approved':
        'Approved',

      'patternLibrary.status.superseded':
        'Superseded',
      }
  },

  dropdowns: {
    PROJECT_STATUS: [
      {
        code: 'DRAFT',
        labelKey:
          'dropdown.projectStatus.draft',
        eipV1Value: 'Draft'
      },
      {
        code: 'ACTIVE',
        labelKey:
          'dropdown.projectStatus.active',
        eipV1Value: 'Active'
      },
      {
        code: 'ARCHIVED',
        labelKey:
          'dropdown.projectStatus.archived',
        eipV1Value: 'Archived'
      }
    ],

    PRODUCT_DEVELOPMENT_STAGE: [
      {
        code: 'IDEA',
        labelKey:
          'dropdown.developmentStage.idea',
        eipV1Value: 'Idea'
      },
      {
        code: 'DRAFTING',
        labelKey:
          'dropdown.developmentStage.drafting',
        eipV1Value: 'Drafting'
      },
      {
        code: 'SAMPLE_REVIEW',
        labelKey:
          'dropdown.developmentStage.sampleReview',
        eipV1Value:
          'Sample review'
      },
      {
        code: 'APPROVED',
        labelKey:
          'dropdown.developmentStage.approved',
        eipV1Value:
          'Approved'
      },
      {
        code: 'ARCHIVED',
        labelKey:
          'dropdown.developmentStage.archived',
        eipV1Value:
          'Archived'
      }
    ],

    GARMENT_CATEGORY: [
      {
        code: 'DRESS',
        labelKey:
          'dropdown.garmentCategory.dress',
        eipV1Value: 'Dress'
      },
      {
        code: 'COAT',
        labelKey:
          'dropdown.garmentCategory.coat',
        eipV1Value: 'Coat'
      },
      {
        code: 'TOP',
        labelKey:
          'dropdown.garmentCategory.top',
        eipV1Value: 'Top'
      },
      {
        code: 'SKIRT',
        labelKey:
          'dropdown.garmentCategory.skirt',
        eipV1Value: 'Skirt'
      },
      {
        code: 'TROUSER',
        labelKey:
          'dropdown.garmentCategory.trouser',
        eipV1Value: 'Trouser'
      }
    ],

    DIFFICULTY_LEVEL: [
      {
        code: 'BEGINNER',
        labelKey:
          'dropdown.difficulty.beginner',
        eipV1Value:
          'Beginner'
      },
      {
        code: 'INTERMEDIATE',
        labelKey:
          'dropdown.difficulty.intermediate',
        eipV1Value:
          'Intermediate'
      },
      {
        code: 'ADVANCED',
        labelKey:
          'dropdown.difficulty.advanced',
        eipV1Value:
          'Advanced'
      }
    ],

    FIT_SILHOUETTE: [
      {
        code: 'FITTED',
        labelKey:
          'dropdown.fitSilhouette.fitted',
        eipV1Value:
          'Fitted'
      },
      {
        code: 'SEMI_FITTED',
        labelKey:
          'dropdown.fitSilhouette.semiFitted',
        eipV1Value:
          'Semi-fitted'
      },
      {
        code: 'REGULAR',
        labelKey:
          'dropdown.fitSilhouette.regular',
        eipV1Value:
          'Regular'
      },
      {
        code: 'RELAXED',
        labelKey:
          'dropdown.fitSilhouette.relaxed',
        eipV1Value:
          'Relaxed'
      },
      {
        code: 'OVERSIZED',
        labelKey:
          'dropdown.fitSilhouette.oversized',
        eipV1Value:
          'Oversized'
      },
      {
        code: 'A_LINE',
        labelKey:
          'dropdown.fitSilhouette.aLine',
        eipV1Value:
          'A-line'
      }
    ],

    STANDARD_FIT_CATEGORY: [
      { code: 'DRESS', labelKey: 'dropdown.standardFitCategory.dress', eipV1Value: 'Dress' },
      { code: 'TOP_BLOUSE_SHIRT', labelKey: 'dropdown.standardFitCategory.topBlouseShirt', eipV1Value: 'Top / blouse / shirt' },
      { code: 'JACKET_COAT', labelKey: 'dropdown.standardFitCategory.jacketCoat', eipV1Value: 'Jacket / coat' },
      { code: 'SKIRT', labelKey: 'dropdown.standardFitCategory.skirt', eipV1Value: 'Skirt' },
      { code: 'TROUSER_SHORTS', labelKey: 'dropdown.standardFitCategory.trouserShorts', eipV1Value: 'Trouser / shorts' },
      { code: 'ONE_PIECE', labelKey: 'dropdown.standardFitCategory.onePiece', eipV1Value: 'Jumpsuit / one-piece' }
    ],

    FIT_PRIORITY: [
      { code: 'CRITICAL', labelKey: 'dropdown.fitPriority.critical', eipV1Value: 'Critical' },
      { code: 'IMPORTANT', labelKey: 'dropdown.fitPriority.important', eipV1Value: 'Important' },
      { code: 'SECONDARY', labelKey: 'dropdown.fitPriority.secondary', eipV1Value: 'Secondary' },
      { code: 'NOT_RELEVANT', labelKey: 'dropdown.fitPriority.notRelevant', eipV1Value: 'Not relevant' }
    ],

    FIT_RESULT: [
      { code: 'UNASSESSED', labelKey: 'dropdown.fitResult.unassessed', eipV1Value: 'Not assessed' },
      { code: 'TOO_TIGHT', labelKey: 'dropdown.fitResult.tooTight', eipV1Value: 'Too tight' },
      { code: 'SLIGHTLY_TIGHT', labelKey: 'dropdown.fitResult.slightlyTight', eipV1Value: 'Slightly tight' },
      { code: 'GOOD', labelKey: 'dropdown.fitResult.good', eipV1Value: 'Good' },
      { code: 'SLIGHTLY_LOOSE', labelKey: 'dropdown.fitResult.slightlyLoose', eipV1Value: 'Slightly loose' },
      { code: 'TOO_LOOSE', labelKey: 'dropdown.fitResult.tooLoose', eipV1Value: 'Too loose' }
    ],

    FIT_ISSUE: [
      { code: 'NONE', labelKey: 'dropdown.fitIssue.none', eipV1Value: 'None' },
      { code: 'PULLING', labelKey: 'dropdown.fitIssue.pulling', eipV1Value: 'Pulling' },
      { code: 'GAPING', labelKey: 'dropdown.fitIssue.gaping', eipV1Value: 'Gaping' },
      { code: 'RESTRICTION', labelKey: 'dropdown.fitIssue.restriction', eipV1Value: 'Restriction' },
      { code: 'EXCESS_EASE', labelKey: 'dropdown.fitIssue.excessEase', eipV1Value: 'Excess ease' },
      { code: 'DRAG_LINES', labelKey: 'dropdown.fitIssue.dragLines', eipV1Value: 'Drag lines' },
      { code: 'BALANCE', labelKey: 'dropdown.fitIssue.balance', eipV1Value: 'Balance' },
      { code: 'LENGTH', labelKey: 'dropdown.fitIssue.length', eipV1Value: 'Length' },
      { code: 'OTHER', labelKey: 'dropdown.fitIssue.other', eipV1Value: 'Other' }
    ],

    FIT_SEVERITY: [
      { code: 'NONE', labelKey: 'dropdown.fitSeverity.none', eipV1Value: 'None' },
      { code: 'MINOR', labelKey: 'dropdown.fitSeverity.minor', eipV1Value: 'Minor' },
      { code: 'MODERATE', labelKey: 'dropdown.fitSeverity.moderate', eipV1Value: 'Moderate' },
      { code: 'CRITICAL', labelKey: 'dropdown.fitSeverity.critical', eipV1Value: 'Critical' }
    ],

    SIZE_SYSTEM: [
      {
        code: 'US',
        labelKey:
          'dropdown.sizeSystem.us',
        eipV1Value: 'US'
      },
      {
        code: 'UK',
        labelKey:
          'dropdown.sizeSystem.uk',
        eipV1Value: 'UK'
      },
      {
        code: 'EU',
        labelKey:
          'dropdown.sizeSystem.eu',
        eipV1Value: 'EU'
      },
      {
        code: 'ALPHA',
        labelKey:
          'dropdown.sizeSystem.alpha',
        eipV1Value: 'Alpha'
      }
    ],

    VARIANT_STATUS: [
      {
        code: 'DEVELOPMENT',
        labelKey:
          'dropdown.variantStatus.development',
        eipV1Value:
          'In development'
      },
      {
        code: 'FIT_REVIEW',
        labelKey:
          'dropdown.variantStatus.fitReview',
        eipV1Value:
          'Fit review'
      },
      {
        code: 'APPROVED',
        labelKey:
          'dropdown.variantStatus.approved',
        eipV1Value:
          'Approved'
      },
      {
        code: 'ARCHIVED',
        labelKey:
          'dropdown.variantStatus.archived',
        eipV1Value:
          'Archived'
      }
    ],

    BASE_REFERENCE_SIZE: [
      {
        code: 'XS',
        labelKey:
          'dropdown.baseSize.xs',
        eipV1Value: 'XS'
      },
      {
        code: 'S',
        labelKey:
          'dropdown.baseSize.s',
        eipV1Value: 'S'
      },
      {
        code: 'M',
        labelKey:
          'dropdown.baseSize.m',
        eipV1Value: 'M'
      },
      {
        code: 'L',
        labelKey:
          'dropdown.baseSize.l',
        eipV1Value: 'L'
      },
      {
        code: 'XL',
        labelKey:
          'dropdown.baseSize.xl',
        eipV1Value: 'XL'
      },

      {
        code: '34',
        labelKey:
          'dropdown.baseSize.34',
        eipV1Value: '34'
      },
      {
        code: '36',
        labelKey:
          'dropdown.baseSize.36',
        eipV1Value: '36'
      },
      {
        code: '38',
        labelKey:
          'dropdown.baseSize.38',
        eipV1Value: '38'
      },
      {
        code: '40',
        labelKey:
          'dropdown.baseSize.40',
        eipV1Value: '40'
      },
      {
        code: '42',
        labelKey:
          'dropdown.baseSize.42',
        eipV1Value: '42'
      },
      {
        code: '44',
        labelKey:
          'dropdown.baseSize.44',
        eipV1Value: '44'
      },

      {
        code: '8',
        labelKey:
          'dropdown.baseSize.8',
        eipV1Value: '8'
      },
      {
        code: '10',
        labelKey:
          'dropdown.baseSize.10',
        eipV1Value: '10'
      },
      {
        code: '12',
        labelKey:
          'dropdown.baseSize.12',
        eipV1Value: '12'
      },
      {
        code: '14',
        labelKey:
          'dropdown.baseSize.14',
        eipV1Value: '14'
      },
      {
        code: '16',
        labelKey:
          'dropdown.baseSize.16',
        eipV1Value: '16'
      }
    ],

    CHANGE_INITIATOR: [
      {
        code: 'DESIGNER',
        labelKey:
          'dropdown.changeInitiator.designer',
        eipV1Value:
          'Designer'
      },
      {
        code:
          'GARMENT_TECHNICIAN',
        labelKey:
          'dropdown.changeInitiator.garmentTechnician',
        eipV1Value:
          'Garment technician'
      },
      {
        code:
          'PATTERN_MAKER',
        labelKey:
          'dropdown.changeInitiator.patternMaker',
        eipV1Value:
          'Pattern maker'
      },
      {
        code:
          'PRODUCTION_TEAM',
        labelKey:
          'dropdown.changeInitiator.productionTeam',
        eipV1Value:
          'Production team'
      },
      {
        code: 'QUALITY',
        labelKey:
          'dropdown.changeInitiator.quality',
        eipV1Value:
          'Quality'
      },
      {
        code: 'FIT_TEST',
        labelKey:
          'dropdown.changeInitiator.fitTest',
        eipV1Value:
          'Fit test'
      },
      {
        code:
          'CUSTOMER_FEEDBACK',
        labelKey:
          'dropdown.changeInitiator.customerFeedback',
        eipV1Value:
          'Customer feedback'
      },
      {
        code:
          'SAMPLE_REVIEW',
        labelKey:
          'dropdown.changeInitiator.sampleReview',
        eipV1Value:
          'Sample review'
      },
      {
        code: 'SUPPLIER',
        labelKey:
          'dropdown.changeInitiator.supplier',
        eipV1Value:
          'Supplier'
      },
      {
        code: 'COMPLIANCE',
        labelKey:
          'dropdown.changeInitiator.compliance',
        eipV1Value:
          'Compliance'
      },
      {
        code: 'OTHER',
        labelKey:
          'dropdown.changeInitiator.other',
        eipV1Value:
          'Other'
      }
    ],

    CHANGE_OPERATION: [
      {
        code: 'CREATE',
        labelKey:
          'dropdown.changeOperation.create',
        eipV1Value:
          'Created'
      },
      {
        code: 'UPDATE',
        labelKey:
          'dropdown.changeOperation.update',
        eipV1Value:
          'Changed'
      },
      {
        code: 'DELETE',
        labelKey:
          'dropdown.changeOperation.delete',
        eipV1Value:
          'Deleted'
      }
    ],

    PATTERN_SOURCE_PROVIDER: [
      {
        code: 'MANUAL_UNSPECIFIED',
        labelKey:
          'patternLibrary.provider.manual'
      },
      {
        code: 'CLO',
        labelKey:
          'patternLibrary.provider.clo'
      },
      {
        code: 'GERBER_ACCUMARK',
        labelKey:
          'patternLibrary.provider.gerber'
      },
      {
        code: 'RICHPEACE',
        labelKey:
          'patternLibrary.provider.richpeace'
      },
      {
        code: 'OPTITEX',
        labelKey:
          'patternLibrary.provider.optitex'
      },
      {
        code: 'LECTRA',
        labelKey:
          'patternLibrary.provider.lectra'
      },
      {
        code: 'OTHER',
        labelKey:
          'patternLibrary.provider.other'
      }
    ],

    PATTERN_TECHNICAL_TYPE: [
      {
        code: 'CLO_PROJECT_ZPRJ',
        labelKey:
          'patternLibrary.type.cloProject',
        format: 'CLO',
        outputProfile: ''
      },
      {
        code: 'CLO_GARMENT_ZPAC',
        labelKey:
          'patternLibrary.type.cloGarment',
        format: 'CLO',
        outputProfile: ''
      },
      {
        code: 'CLO_PATTERN_PACX',
        labelKey:
          'patternLibrary.type.cloPattern',
        format: 'CLO',
        outputProfile: ''
      },
      {
        code: 'DXF_AAMA',
        labelKey:
          'patternLibrary.type.dxfAama',
        format: 'DXF',
        outputProfile: 'AAMA'
      },
      {
        code: 'DXF_ASTM',
        labelKey:
          'patternLibrary.type.dxfAstm',
        format: 'DXF',
        outputProfile: 'ASTM'
      },
      {
        code: 'AI',
        labelKey:
          'patternLibrary.type.ai',
        format: 'AI',
        outputProfile: ''
      },
      {
        code: 'PDF_A0',
        labelKey:
          'patternLibrary.type.pdfA0',
        format: 'PDF',
        outputProfile: 'A0'
      },
      {
        code: 'PDF_A4_TILED',
        labelKey:
          'patternLibrary.type.pdfA4',
        format: 'PDF',
        outputProfile: 'A4 tiled'
      },
      {
        code: 'PDF_LETTER_TILED',
        labelKey:
          'patternLibrary.type.pdfLetter',
        format: 'PDF',
        outputProfile: 'Letter tiled'
      },
      {
        code: 'PDF_PROJECTOR',
        labelKey:
          'patternLibrary.type.pdfProjector',
        format: 'PDF',
        outputProfile: 'Projector'
      },
      {
        code: 'PNG_1_TO_1_REFERENCE',
        labelKey:
          'patternLibrary.type.pngReference',
        format: 'PNG',
        outputProfile: '1:1 reference'
      },
      {
        code: 'ZIP',
        labelKey:
          'patternLibrary.type.zip',
        format: 'ZIP',
        outputProfile: ''
      },
      {
        code: 'OTHER',
        labelKey:
          'patternLibrary.type.other',
        format: 'Other',
        outputProfile: ''
      }
    ],

    PATTERN_FILE_STATUS: [
      {
        code: 'DRAFT',
        labelKey:
          'patternLibrary.status.draft'
      },
      {
        code: 'IN_REVIEW',
        labelKey:
          'patternLibrary.status.inReview'
      },
      {
        code: 'APPROVED',
        labelKey:
          'patternLibrary.status.approved'
      },
      {
        code: 'SUPERSEDED',
        labelKey:
          'patternLibrary.status.superseded'
      }
    ]
  },

  structure: {
    rootType: 'workspace',

    treeTypes: {
      project: {
        labelKey:
          'node.project',
        icon:
          'project',
        titleField:
          'project.name',
        children: [
          'product'
        ]
      },

      product: {
        labelKey:
          'node.product',
        icon:
          'product',
        titleField:
          'product.style_name',
        children: [
          'variant'
        ]
      },

      variant: {
        labelKey:
          'node.variant',
        navigationLabelKey:
          'nav.variantOverview',
        icon:
          'variant',
        titleField:
          'variant.name',

        children: [
          'projectJournal',
          'media',
          'patternLibrary',
          'sizeSet',
          'sewing',
          'techpack',
          'changeHistory'
        ]
      },

      projectJournal: {
        labelKey:
          'node.projectJournal',

        descriptionKey:
          'module.projectJournal.description',

        icon:
          'projectJournal',

        componentKey:
          'projectJournal',

        showInTree:
          false,

        children: []
      },

      media: {
        labelKey:
          'node.media',

        descriptionKey:
          'module.media.description',

        icon:
          'media',

        componentKey:
          'media',

        showInTree:
          false,

        children: []
      },

      patternLibrary: {
        labelKey:
          'node.patternLibrary',

        descriptionKey:
          'module.patternLibrary.description',

        icon:
          'patternLibrary',

        componentKey:
          'patternLibrary',

        showInTree:
          false,

        children: []
      },

      sizeSet: {
        labelKey:
          'node.sizeSet',

        descriptionKey:
          'module.sizeSet.description',

        icon:
          'sizeSet',

        componentKey:
          'sizeSet',

        showInTree:
          false,

        children: []
      },

      sewing: {
        labelKey:
          'node.sewing',

        descriptionKey:
          'module.sewing.description',

        icon:
          'sewing',

        componentKey:
          'sewing',

        showInTree:
          false,

        children: []
      },

      techpack: {
        labelKey:
          'node.techpack',

        descriptionKey:
          'module.techpack.description',

        icon:
          'techpack',

        componentKey:
          'techPack',

        showInTree:
          false,

        children: []
      },

      changeHistory: {
        labelKey:
          'node.changeHistory',

        descriptionKey:
          'module.changeHistory.description',

        icon:
          'changeHistory',

        componentKey:
          'changeHistory',

        showInTree:
          false,

        children: []
      }
    },

    panels: {
      project: {
        fieldGroups: [
          'projectIdentity'
        ]
      },

      product: {
        fieldGroups: [
          'styleIdentity',
          'styleDevelopment'
        ]
      },

      variant: {
        fieldGroups: [
          'variantIdentity',
          'variantReference'
        ]
      }
    }
  },

  fieldGroups: {
    projectIdentity: {
      labelKey:
        'group.projectIdentity.title',

      fields: [
        'project.name',
        'project.designer_code',
        'project.season',
        'project.status'
      ]
    },

    styleIdentity: {
      labelKey:
        'group.styleIdentity.title',

      fields: [
        'product.style_name',
        'product.style_code',
        'product.category',
        'product.description'
      ]
    },

    styleDevelopment: {
      labelKey:
        'group.styleDevelopment.title',

      fields: [
        'product.development_stage',
        'product.difficulty',
        'product.fit_silhouette'
      ]
    },

    variantIdentity: {
      labelKey:
        'group.variantIdentity.title',

      fields: [
        'variant.name',
        'variant.code',
        'variant.status',
        'variant.notes'
      ]
    },

    variantReference: {
      labelKey:
        'group.variantReference.title',

      fields: [
        'variant.size_system',
        'variant.base_reference_size'
      ]
    }
  },

  fields: {
    'project.name': {
      key:
        'project.name',

      labelKey:
        'fields.project.name.label',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'project.name'
    },

    'project.designer_code': {
      key:
        'project.designer_code',

      labelKey:
        'fields.project.designerCode.label',

      helpKey:
        'fields.project.designerCode.help',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'attrs.designer_code'
    },

    'project.season': {
      key:
        'project.season',

      labelKey:
        'fields.project.season.label',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'attrs.project_season'
    },

    'project.status': {
      key:
        'project.status',

      labelKey:
        'fields.project.status.label',

      type:
        'select',

      governanceList:
        'PROJECT_STATUS',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.project_status'
    },

    'product.style_name': {
      key:
        'product.style_name',

      labelKey:
        'fields.product.styleName.label',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'product.name'
    },

    'product.style_code': {
      key:
        'product.style_code',

      labelKey:
        'fields.product.styleCode.label',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'product.code'
    },

    'product.category': {
      key:
        'product.category',

      labelKey:
        'fields.product.category.label',

      type:
        'select',

      governanceList:
        'GARMENT_CATEGORY',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'product.category'
    },

    'product.development_stage': {
      key:
        'product.development_stage',

      labelKey:
        'fields.product.developmentStage.label',

      type:
        'select',

      governanceList:
        'PRODUCT_DEVELOPMENT_STAGE',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.development_stage'
    },

    'product.difficulty': {
      key:
        'product.difficulty',

      labelKey:
        'fields.product.difficulty.label',

      type:
        'select',

      governanceList:
        'DIFFICULTY_LEVEL',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.difficulty'
    },

    'product.fit_silhouette': {
      key:
        'product.fit_silhouette',

      labelKey:
        'fields.product.fitSilhouette.label',

      type:
        'select',

      governanceList:
        'FIT_SILHOUETTE',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.fit_silhouette'
    },

    'product.description': {
      key:
        'product.description',

      labelKey:
        'fields.product.description.label',

      type:
        'textarea',

      rows:
        5,

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'attrs.product_description'
    },

    'variant.name': {
      key:
        'variant.name',

      labelKey:
        'fields.variant.name.label',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'attrs.variant_name'
    },

    'variant.code': {
      key:
        'variant.code',

      labelKey:
        'fields.variant.code.label',

      type:
        'text',

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'attrs.variant_code'
    },

    'variant.status': {
      key:
        'variant.status',

      labelKey:
        'fields.variant.status.label',

      type:
        'select',

      governanceList:
        'VARIANT_STATUS',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.variant_status'
    },

    'variant.size_system': {
      key:
        'variant.size_system',

      labelKey:
        'fields.variant.sizeSystem.label',

      type:
        'select',

      governanceList:
        'SIZE_SYSTEM',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.size_system'
    },

    'variant.base_reference_size': {
      key:
        'variant.base_reference_size',

      labelKey:
        'fields.variant.baseReferenceSize.label',

      helpKey:
        'fields.variant.baseReferenceSize.help',

      type:
        'select',

      governanceList:
        'BASE_REFERENCE_SIZE',

      allowFreeText:
        false,

      usedAsEipParameter:
        true,

      eipV1Target:
        'attrs.base_reference_size'
    },

    'variant.notes': {
      key:
        'variant.notes',

      labelKey:
        'fields.variant.notes.label',

      type:
        'textarea',

      rows:
        4,

      allowFreeText:
        true,

      usedAsEipParameter:
        false,

      eipV1Target:
        'attrs.variant_notes'
    }
  },

  referenceConvention: {
    designerCodeField:
      'project.designer_code',

    styleCodeField:
      'product.style_code',

    variantCodeField:
      'variant.code',

    separator:
      '-'
  },

  media: {
    defaultProfileId:
      'product-gallery',

    acceptedTypes: [
      'image/jpeg',
      'image/png',
      'image/webp'
    ],

    reference: {
      assetPrefix:
        'MED',

      sequencePadding:
        3
    },

    assetTypes: [
      {
        code:
          'GARMENT_SAMPLE',

        labelKey:
          'media.assetType.garmentSample'
      },
      {
        code:
          'TECHNICAL_SKETCH',

        labelKey:
          'media.assetType.technicalSketch'
      },
      {
        code:
          'PATTERN_PREVIEW',

        labelKey:
          'media.assetType.patternPreview'
      },
      {
        code:
          'DETAIL',

        labelKey:
          'media.assetType.detail'
      },
      {
        code:
          'PROTOTYPE',

        labelKey:
          'media.assetType.prototype'
      },
      {
        code:
          'REFERENCE',

        labelKey:
          'media.assetType.reference'
      }
    ],

    assetRoles: [
      {
        code:
          'PRIMARY',

        slotKey:
          'primaryAssetId',

        icon:
          'star',

        labelKey:
          'media.role.primary.label',

        descriptionKey:
          'media.role.primary.description',

        allowClear:
          false,

        forcesCustomerVisible:
          true
      },

      {
        code:
          'TECHNICAL_SKETCH',

        slotKey:
          'technicalSketchAssetId',

        icon:
          'technicalSketch',

        labelKey:
          'media.role.technicalSketch.label',

        descriptionKey:
          'media.role.technicalSketch.description',

        allowClear:
          true,

        forcesCustomerVisible:
          false,

        forceType:
          'TECHNICAL_SKETCH'
      },

      {
        code:
          'PATTERN_PREVIEW',

        slotKey:
          'patternAssetId',

        icon:
          'pattern',

        labelKey:
          'media.role.patternPreview.label',

        descriptionKey:
          'media.role.patternPreview.description',

        allowClear:
          true,

        forcesCustomerVisible:
          true,

        forceType:
          'PATTERN_PREVIEW'
      }
    ],

    profiles: [
      {
        id:
          'product-card',

        labelKey:
          'media.profile.productCard',

        descriptionKey:
          'media.profile.productCard.description',

        width:
          1200,

        height:
          1500,

        fitMode:
          'cover',

        mimeType:
          'image/jpeg',

        quality:
          92,

        backgroundColor:
          '#f4f1eb'
      },

      {
        id:
          'product-gallery',

        labelKey:
          'media.profile.productGallery',

        descriptionKey:
          'media.profile.productGallery.description',

        width:
          1400,

        height:
          1750,

        fitMode:
          'cover',

        mimeType:
          'image/jpeg',

        quality:
          92,

        backgroundColor:
          '#f4f1eb'
      },

      {
        id:
          'hero-banner',

        labelKey:
          'media.profile.heroBanner',

        descriptionKey:
          'media.profile.heroBanner.description',

        width:
          1920,

        height:
          1080,

        fitMode:
          'cover',

        mimeType:
          'image/jpeg',

        quality:
          90,

        backgroundColor:
          '#f4f1eb'
      },

      {
        id:
          'blog-cover',

        labelKey:
          'media.profile.blogCover',

        descriptionKey:
          'media.profile.blogCover.description',

        width:
          1800,

        height:
          1200,

        fitMode:
          'cover',

        mimeType:
          'image/jpeg',

        quality:
          90,

        backgroundColor:
          '#f4f1eb'
      },

      {
        id:
          'content-block',

        labelKey:
          'media.profile.contentBlock',

        descriptionKey:
          'media.profile.contentBlock.description',

        width:
          1600,

        height:
          1200,

        fitMode:
          'cover',

        mimeType:
          'image/jpeg',

        quality:
          90,

        backgroundColor:
          '#f4f1eb'
      }
    ]
  },


  fitProfile: {
    version: 'fit-profile-v1',

    baseline: {
      code: 'ISO_INDUSTRY_BASELINE',
      label: 'ISO / industry baseline',
      reference:
        'Body-dimension priorities follow the ISO 8559 sizing framework and common apparel fit practice. Garment ease remains product-specific and may be refined by the designer from fit-session evidence.'
    },

    defaultStandardCategory: 'DRESS',

    categoryMappings: {
      DRESS: 'DRESS',
      COAT: 'JACKET_COAT',
      TOP: 'TOP_BLOUSE_SHIRT',
      SKIRT: 'SKIRT',
      TROUSER: 'TROUSER_SHORTS'
    },

    bodyAreas: {
      BUST: { label: 'Bust / chest' },
      HIGH_BUST: { label: 'High bust' },
      UNDERBUST: { label: 'Underbust' },
      WAIST: { label: 'Waist' },
      HIP: { label: 'Hip / seat' },
      SHOULDER: { label: 'Shoulder' },
      THIGH: { label: 'Thigh' },
      INSEAM: { label: 'Inseam' },
      HEIGHT: { label: 'Height' },
      BACK_LENGTH: { label: 'Back length' },
      SLEEVE_LENGTH: { label: 'Sleeve length' },
      TORSO_LENGTH: { label: 'Torso length' }
    },

    standardCategories: {
      DRESS: {
        label: 'Dress',
        rules: [
          { measurementCode: 'BUST', priority: 'CRITICAL' },
          { measurementCode: 'WAIST', priority: 'IMPORTANT' },
          { measurementCode: 'HIP', priority: 'IMPORTANT' },
          { measurementCode: 'SHOULDER', priority: 'IMPORTANT' },
          { measurementCode: 'HEIGHT', priority: 'SECONDARY' }
        ]
      },

      TOP_BLOUSE_SHIRT: {
        label: 'Top / blouse / shirt',
        rules: [
          { measurementCode: 'BUST', priority: 'CRITICAL' },
          { measurementCode: 'SHOULDER', priority: 'IMPORTANT' },
          { measurementCode: 'WAIST', priority: 'SECONDARY' },
          { measurementCode: 'SLEEVE_LENGTH', priority: 'SECONDARY' }
        ]
      },

      JACKET_COAT: {
        label: 'Jacket / coat',
        rules: [
          { measurementCode: 'BUST', priority: 'CRITICAL' },
          { measurementCode: 'SHOULDER', priority: 'CRITICAL' },
          { measurementCode: 'HIP', priority: 'IMPORTANT' },
          { measurementCode: 'WAIST', priority: 'SECONDARY' },
          { measurementCode: 'SLEEVE_LENGTH', priority: 'IMPORTANT' }
        ]
      },

      SKIRT: {
        label: 'Skirt',
        rules: [
          { measurementCode: 'HIP', priority: 'CRITICAL' },
          { measurementCode: 'WAIST', priority: 'IMPORTANT' },
          { measurementCode: 'HEIGHT', priority: 'SECONDARY' }
        ]
      },

      TROUSER_SHORTS: {
        label: 'Trouser / shorts',
        rules: [
          { measurementCode: 'HIP', priority: 'CRITICAL' },
          { measurementCode: 'WAIST', priority: 'IMPORTANT' },
          { measurementCode: 'THIGH', priority: 'IMPORTANT' },
          { measurementCode: 'INSEAM', priority: 'SECONDARY' }
        ]
      },

      ONE_PIECE: {
        label: 'Jumpsuit / one-piece',
        rules: [
          { measurementCode: 'BUST', priority: 'CRITICAL' },
          { measurementCode: 'HIP', priority: 'CRITICAL' },
          { measurementCode: 'WAIST', priority: 'IMPORTANT' },
          { measurementCode: 'TORSO_LENGTH', priority: 'IMPORTANT' },
          { measurementCode: 'INSEAM', priority: 'SECONDARY' }
        ]
      }
    },

    silhouetteModifiers: {
      FITTED: {
        byCategory: {
          DRESS: {
            HIP: { priority: 'CRITICAL' },
            WAIST: { priority: 'IMPORTANT' }
          },
          TOP_BLOUSE_SHIRT: {
            WAIST: { priority: 'IMPORTANT' }
          },
          SKIRT: {
            HIP: { priority: 'CRITICAL' }
          },
          TROUSER_SHORTS: {
            THIGH: { priority: 'IMPORTANT' }
          }
        }
      },

      SEMI_FITTED: {
        byCategory: {
          DRESS: {
            HIP: { priority: 'IMPORTANT' }
          }
        }
      },

      A_LINE: {
        byCategory: {
          DRESS: {
            HIP: { priority: 'SECONDARY' }
          },
          SKIRT: {
            HIP: { priority: 'IMPORTANT' }
          }
        }
      },

      RELAXED: {
        byCategory: {
          DRESS: {
            WAIST: { priority: 'SECONDARY' },
            HIP: { priority: 'SECONDARY' }
          },
          TOP_BLOUSE_SHIRT: {
            WAIST: { priority: 'NOT_RELEVANT' }
          },
          JACKET_COAT: {
            WAIST: { priority: 'NOT_RELEVANT' }
          }
        }
      },

      OVERSIZED: {
        byCategory: {
          DRESS: {
            BUST: { priority: 'IMPORTANT' },
            WAIST: { priority: 'NOT_RELEVANT' },
            HIP: { priority: 'SECONDARY' }
          },
          TOP_BLOUSE_SHIRT: {
            BUST: { priority: 'IMPORTANT' },
            WAIST: { priority: 'NOT_RELEVANT' }
          },
          JACKET_COAT: {
            BUST: { priority: 'IMPORTANT' },
            WAIST: { priority: 'NOT_RELEVANT' }
          }
        }
      }
    }
  },


  techPack: techPackMetadata,

  sewing: {
  tabs: [
  {
    code: 'CONSTRUCTION',
    labelKey: 'sewing.tab.constructionOperations'
  },
  {
    code: 'TIME_MOTION',
    labelKey: 'sewing.tab.timeMotion'
  },
  {
    code: 'QUALITY',
    labelKey: 'sewing.tab.quality'
  }
],

  construction: {
    actionColumnWidth: '32px',
    minGridWidth: '1080px',
    gridFields: [
      {
        key: 'order',
        labelKey: 'sewing.field.step',
        type: 'number',
        width: '48px',
        min: 1,
        align: 'center'
      },
      {
        key: 'title',
        labelKey: 'sewing.field.instruction',
        type: 'text',
        width: 'minmax(180px, 1.35fr)'
      },
      {
        key: 'seamType',
        labelKey: 'sewing.field.seamFinish',
        type: 'text',
        width: 'minmax(130px, 0.85fr)'
      },
      {
        key: 'seamAllowance',
        labelKey: 'sewing.field.seamAllowance',
        type: 'text',
        width: '110px'
      },
      {
        key: 'machine',
        labelKey: 'sewing.field.machine',
        type: 'text',
        width: 'minmax(140px, 0.9fr)'
      },
      {
        key: 'qualityCheckpoint',
        labelKey: 'sewing.field.qualityCheckpoint',
        type: 'text',
        width: 'minmax(170px, 1fr)'
      }
    ],

    detailFields: [
      {
        key: 'notes',
        labelKey: 'sewing.field.technicalNote',
        type: 'textarea',
        rows: 3
      }
    ],

    requirementFields: [
  {
    key: 'item',
    labelKey: 'sewing.field.item',
    type: 'text',
    width: 'minmax(160px, 1fr)'
  },
  {
    key: 'quantity',
    labelKey: 'sewing.field.quantity',
    type: 'text',
    width: '100px'
  },
  {
    key: 'notes',
    labelKey: 'sewing.field.note',
    type: 'text',
    width: 'minmax(180px, 1fr)'
  }
],

    operationFields: [
  {
    key: 'step',
    labelKey: 'sewing.field.step',
    type: 'text',
    width: '70px'
  },
  {
    key: 'op',
    labelKey: 'sewing.field.operation',
    type: 'text',
    width: 'minmax(180px, 1.3fr)'
  },
  {
    key: 'machine',
    labelKey: 'sewing.field.machine',
    type: 'text',
    width: 'minmax(120px, 0.8fr)'
  },
  {
    key: 'method',
    labelKey: 'sewing.field.method',
    type: 'text',
    width: 'minmax(140px, 0.9fr)'
  },
  {
    key: 'notes',
    labelKey: 'sewing.field.note',
    type: 'text',
    width: 'minmax(160px, 1fr)'
  },
  {
    key: 'standardStatus',
    labelKey: 'sewing.field.status',
    type: 'status',
    width: '90px',
    readOnly: true
  }
]
    
  },

  defaults: {
    constructionSteps: [],
    notions: [],
    seamAllowances: '',
    qualityNotes: '',
    qualityChecks: [],
    operations: [],

    timeMotion: {
      annotations: [],
      clips: [],
      approvedRevision: 0,
      approvedAt: null
    }
  },

  sessionTimer: {
    patternSteps: {
  'sartorial-01': [
    { step: '01', op: 'Fuse Front Facings & Waistline Stabilizers', sam: 1.8 },
    { step: '02', op: 'Staystitch Front Neckline & Armholes', sam: 1.5 },
    { step: '03', op: 'Stitch Bust Darts', sam: 2.2 },
    { step: '04', op: 'Construct & Turn Waist Belt Ties', sam: 3.0 },
    { step: '05', op: 'Stitch Back Bodice Center Seam & Press', sam: 2.8 },
    { step: '06', op: 'Assemble In-Seam Pockets to Skirt Panels', sam: 4.5 },
    { step: '07', op: 'Assemble Shoulders & Sides with French Seams', sam: 6.2 },
    { step: '08', op: 'Join Bodice Waistline to Skirt', sam: 3.5 },
    { step: '09', op: 'Double Rolled Baby Hem', sam: 4.8 },
    { step: '10', op: 'Final Trimming, Inspection & Steam Pressing', sam: 2.7 }
  ],
  'sartorial-02': [
    { step: '01', op: 'Fuse Front Panels, Collar, and Sleeve Cuffs', sam: 3.5 },
    { step: '02', op: 'Assemble Epaulettes, Sleeve Tabs, and Belt Carriers', sam: 4.8 },
    { step: '03', op: 'Prepare & Stitch Back Storm Shield with Overhangs', sam: 5.5 },
    { step: '04', op: 'Construct Front Double Welt Pockets with Flaps', sam: 9.5 },
    { step: '05', op: 'Assemble & Attach Double-Breasted Collar & Stand', sam: 7.2 },
    { step: '06', op: 'Join Side & Shoulder Seams (Flat-Felled)', sam: 6.8 },
    { step: '07', op: 'Construct & Set Two-Piece Raglan Sleeves', sam: 5.8 },
    { step: '08', op: 'Machine Sew Keyhole Buttonholes', sam: 4.2 },
    { step: '09', op: 'Attach Horn Buttons with Counter-Buttons', sam: 3.0 },
    { step: '10', op: 'Stitch Bottom Hem with Clean Facings', sam: 4.2 },
    { step: '11', op: 'Final Hand QC Inspection & Steam Pressing', sam: 4.5 }
  ],
  'sartorial-03': [
    { step: '01', op: 'Overlock Seam Edges of all Leg Panels', sam: 3.8 },
    { step: '02', op: 'Sew Front Pleats & Back Waist Darts', sam: 2.8 },
    { step: '03', op: 'Assemble & Topstitch Front Slant Side Pockets', sam: 5.2 },
    { step: '04', op: 'Stitch and Set Back Double Welt Pockets', sam: 6.8 },
    { step: '05', op: 'Assemble Left/Right Outseams and Inseams', sam: 4.2 },
    { step: '06', op: 'Assemble and Stitch Front Crotch Fly Zipper', sam: 4.8 },
    { step: '07', op: 'Construct Waistband with Interfaced Ban-Rol Core', sam: 3.5 },
    { step: '08', op: 'Stitch waistband ends & Attach Hook and Eye', sam: 1.5 },
    { step: '09', op: 'Blindstitch Bottom Leg Hems', sam: 2.6 },
    { step: '10', op: 'Final Crease Pressing, Thread QC & Tagging', sam: 3.2 }
  ],
  'sartorial-04': [
    { step: '01', op: 'Fuse Neckline Curves and Bias Stay-tape strips', sam: 1.2 },
    { step: '02', op: 'Stitch Asymmetrical Neckline Gather Pleats', sam: 2.8 },
    { step: '03', op: 'Assemble Side Seams and Shoulders (French Seams)', sam: 5.5 },
    { step: '04', op: 'Bias Bind Armholes & Finished Neck Facings', sam: 4.2 },
    { step: '05', op: 'Machine Stitch Rolled Bottom Micro-Hem', sam: 2.8 },
    { step: '06', op: 'Steaming, Thread Trimming & Tagging', sam: 1.7 }
  ]
},
    defaultProjectSteps: [
  { step: '01', op: 'Pattern Prep & Fabric Cutting', sam: 15.0 },
  { step: '02', op: 'Staystitching & Interfacing', sam: 10.0 },
  { step: '03', op: 'Seam Prep & Overlocking', sam: 15.0 },
  { step: '04', op: 'Main Assembly', sam: 45.0 },
  { step: '05', op: 'Detail Sewing (Neck, Collars, Cuffs)', sam: 30.0 },
  { step: '06', op: 'Hemming & Closures', sam: 20.0 },
  { step: '07', op: 'Final Pressing & Thread Trimming', sam: 10.0 }
]
  },

  timeMotion: {
    studyModes: [
      { code: 'VIDEO', labelKey: 'sewing.timeMotion.mode.video' },
      { code: 'STOPWATCH', labelKey: 'sewing.timeMotion.mode.stopwatch' }
    ],

    sequenceModes: [
      { code: 'SEQUENCE', labelKey: 'sewing.timeMotion.sequence.sequence' },
      { code: 'REPEAT', labelKey: 'sewing.timeMotion.sequence.repeat' }
    ],

    recordingModes: [
      { code: 'FULL_STUDY', labelKey: 'sewing.timeMotion.camera.fullStudy' },
      { code: 'OPERATION_CLIPS', labelKey: 'sewing.timeMotion.camera.operationClips' }
    ],

    annotationTypes: [
      { code: 'PRODUCTIVE', labelKey: 'sewing.timeMotion.annotation.productive' },
      { code: 'HANDLING', labelKey: 'sewing.timeMotion.annotation.handling' },
      { code: 'PREPARATION', labelKey: 'sewing.timeMotion.annotation.preparation' },
      { code: 'INSPECTION', labelKey: 'sewing.timeMotion.annotation.inspection' },
      { code: 'DELAY', labelKey: 'sewing.timeMotion.annotation.delay' },
      { code: 'PERSONAL', labelKey: 'sewing.timeMotion.annotation.personal' },
      { code: 'MACHINE_DELAY', labelKey: 'sewing.timeMotion.annotation.machine' },
      { code: 'MATERIAL_DELAY', labelKey: 'sewing.timeMotion.annotation.material' },
      { code: 'OTHER', labelKey: 'sewing.timeMotion.annotation.other' }
    ],

    playbackRates: [0.25, 0.5, 1, 1.5, 2],

    defaults: {
      ratingDefault: 100,
      ratingMin: 60,
      ratingMax: 140,
      ratingStep: 5,
      allowanceDefault: 12,
      allowanceMin: 5,
      allowanceMax: 25,
      allowanceStep: 1
    },

    mediaLimits: {
      maxUploadMb: 250,
      recommendedResolution: '720p',
      recommendedStudyMinutes: 15
    },

    evidencePolicy: {
      assetClass: 'SEWING_STUDY',
      storageScope: 'SHARED_MEDIA_BACKEND',
      frontendSurface: 'SEWING_ONLY',
      defaultVisibility: 'PRIVATE',
      customerEligible: false,
      mediaTabVisible: false,
      shareableFromMediaTab: false,
      derivedPublicationAllowed: true
    },

    helpSteps: [
      {
        code: 'SELECT_OPERATION',
        titleKey: 'sewing.timeMotion.help.selectOperation.title',
        descriptionKey: 'sewing.timeMotion.help.selectOperation.description'
      },
      {
        code: 'CHOOSE_SOURCE',
        titleKey: 'sewing.timeMotion.help.chooseSource.title',
        descriptionKey: 'sewing.timeMotion.help.chooseSource.description'
      },
      {
        code: 'CAPTURE',
        titleKey: 'sewing.timeMotion.help.capture.title',
        descriptionKey: 'sewing.timeMotion.help.capture.description'
      },
      {
        code: 'APPROVE',
        titleKey: 'sewing.timeMotion.help.approve.title',
        descriptionKey: 'sewing.timeMotion.help.approve.description'
      }
    ]
  }
},



  approval: {
    statuses: [
      {
        code: 'DRAFT',
        label: 'Draft',
        labelKey: 'approval.status.draft'
      },
      {
        code: 'IN_REVIEW',
        label: 'In review',
        labelKey: 'approval.status.inReview'
      },
      {
        code: 'APPROVED',
        label: 'Approved',
        labelKey: 'approval.status.approved'
      },
      {
        code: 'RELEASED',
        label: 'Released',
        labelKey: 'approval.status.released'
      },
      {
        code: 'ACTIVE',
        label: 'Active',
        labelKey: 'approval.status.active'
      },
      {
        code: 'NOT_READY',
        label: 'Not ready',
        labelKey: 'approval.publication.notReady'
      },
      {
        code: 'READY_FOR_REVIEW',
        label: 'Ready for moderator review',
        labelKey: 'approval.publication.ready'
      },
      {
        code: 'AWAITING_MODERATOR_RELEASE',
        label: 'Awaiting moderator release',
        labelKey: 'approval.publication.awaiting'
      },
      {
        code: 'RETURNED_BY_MODERATOR',
        label: 'Returned by moderator',
        labelKey: 'approval.publication.returned'
      },
      {
        code: 'PUBLISHED',
        label: 'Released for publication',
        labelKey: 'approval.publication.published'
      },
      {
        code: 'UNPUBLISHED',
        label: 'Unpublished',
        labelKey: 'approval.publication.unpublished'
      },
      {
        code: 'SUPERSEDED',
        label: 'Superseded',
        labelKey: 'approval.status.superseded'
      }
    ],

    workflows: {
      PROJECT: {
        resourceLabel: 'Project',
        resourceLabelKey: 'approval.resource.project',
        transitions: [
          {
            code: 'ACTIVATE',
            from: ['DRAFT'],
            to: 'ACTIVE',
            label: 'Approve & activate',
            labelKey: 'approval.action.activate',
            intent: 'release'
          }
        ]
      },

      TECH_PACK: {
        resourceLabel: 'Tech Pack',
        resourceLabelKey: 'approval.resource.techPack',
        transitions: [
          {
            code: 'SUBMIT',
            from: ['DRAFT'],
            to: 'IN_REVIEW',
            label: 'Submit for review',
            labelKey: 'approval.action.submit',
            intent: 'primary'
          },
          {
            code: 'RETURN',
            from: ['IN_REVIEW'],
            to: 'DRAFT',
            label: 'Return to draft',
            labelKey: 'approval.action.returnDraft',
            intent: 'secondary'
          },
          {
            code: 'APPROVE_RELEASE',
            from: ['IN_REVIEW'],
            to: 'RELEASED',
            label: 'Approve & release',
            labelKey: 'approval.action.approveRelease',
            intent: 'release'
          }
        ]
      },

      PATTERN_FILE: {
        resourceLabel: 'Pattern file',
        resourceLabelKey: 'approval.resource.patternFile',
        transitions: [
          {
            code: 'SUBMIT',
            from: ['DRAFT'],
            to: 'IN_REVIEW',
            label: 'Submit for review',
            labelKey: 'approval.action.submit',
            intent: 'primary'
          },
          {
            code: 'RETURN',
            from: ['IN_REVIEW'],
            to: 'DRAFT',
            label: 'Return to draft',
            labelKey: 'approval.action.returnDraft',
            intent: 'secondary'
          },
          {
            code: 'APPROVE',
            from: ['IN_REVIEW'],
            to: 'APPROVED',
            label: 'Approve',
            labelKey: 'approval.action.approve',
            intent: 'release'
          }
        ]
      },

      FIT_SPECIFICATION: {
        resourceLabel: 'Fit specification',
        resourceLabelKey: 'approval.resource.fitSpecification',
        transitions: [
          {
            code: 'SUBMIT',
            from: ['DRAFT'],
            to: 'IN_REVIEW',
            label: 'Submit for review',
            labelKey: 'approval.action.submit',
            intent: 'primary'
          },
          {
            code: 'RETURN',
            from: ['IN_REVIEW'],
            to: 'DRAFT',
            label: 'Return to draft',
            labelKey: 'approval.action.returnDraft',
            intent: 'secondary'
          },
          {
            code: 'APPROVE',
            from: ['IN_REVIEW'],
            to: 'APPROVED',
            label: 'Approve',
            labelKey: 'approval.action.approve',
            intent: 'release'
          }
        ]
      },

      SEWING_STANDARD: {
        resourceLabel: 'Sewing standard',
        resourceLabelKey: 'approval.resource.sewingStandard',
        transitions: [
          {
            code: 'SUBMIT',
            from: ['DRAFT'],
            to: 'IN_REVIEW',
            label: 'Submit for review',
            labelKey: 'approval.action.submit',
            intent: 'primary'
          },
          {
            code: 'RETURN',
            from: ['IN_REVIEW'],
            to: 'DRAFT',
            label: 'Return to draft',
            labelKey: 'approval.action.returnDraft',
            intent: 'secondary'
          },
          {
            code: 'APPROVE',
            from: ['IN_REVIEW'],
            to: 'APPROVED',
            label: 'Approve',
            labelKey: 'approval.action.approve',
            intent: 'release'
          }
        ]
      },

      CATALOGUE_RELEASE: {
        resourceLabel: 'Publication release',
        resourceLabelKey: 'approval.publication.title',
        requestReferencePrefix: 'PUB',
        moderatorRoleLabel: 'Moderator',
        transitions: [
          {
            code: 'REQUEST_MODERATOR_RELEASE',
            from: ['READY_FOR_REVIEW'],
            to: 'AWAITING_MODERATOR_RELEASE',
            label: 'Request moderator release',
            labelKey: 'approval.action.requestModerator',
            intent: 'primary',
            surface: 'DESIGNER_WORKSPACE'
          },
          {
            code: 'RESUBMIT_MODERATOR_RELEASE',
            from: ['RETURNED_BY_MODERATOR'],
            to: 'AWAITING_MODERATOR_RELEASE',
            label: 'Resubmit to moderator',
            labelKey: 'approval.action.resubmitModerator',
            intent: 'primary',
            surface: 'DESIGNER_WORKSPACE'
          },
          {
            code: 'MODERATOR_RETURN',
            from: ['AWAITING_MODERATOR_RELEASE'],
            to: 'RETURNED_BY_MODERATOR',
            label: 'Return to designer',
            labelKey: 'approval.action.moderatorReturn',
            intent: 'secondary',
            surface: 'MODERATOR_CONTROL'
          },
          {
            code: 'MODERATOR_PUBLISH',
            from: ['AWAITING_MODERATOR_RELEASE'],
            to: 'PUBLISHED',
            label: 'Approve & publish',
            labelKey: 'approval.action.moderatorPublish',
            intent: 'release',
            surface: 'MODERATOR_CONTROL'
          },
          {
            code: 'UNPUBLISH',
            from: ['PUBLISHED'],
            to: 'UNPUBLISHED',
            label: 'Unpublish',
            labelKey: 'approval.action.unpublish',
            intent: 'secondary',
            surface: 'MODERATOR_CONTROL'
          },
          {
            code: 'REPUBLISH',
            from: ['UNPUBLISHED'],
            to: 'PUBLISHED',
            label: 'Republish',
            labelKey: 'approval.action.republish',
            intent: 'release',
            surface: 'MODERATOR_CONTROL'
          }
        ]
      }
    }
  },

  collaboration: {
    ownershipModel:
      'DESIGNER_OWNED',

    adminContentBypass:
      false,

    shareScopes: [
      {
        code: 'PROJECT',
        nodeType: 'project'
      },
      {
        code: 'STYLE',
        nodeType: 'product'
      },
      {
        code: 'VARIANT',
        nodeType: 'variant'
      }
    ],

    durations: [
      {
        code: 'PERMANENT',
        labelKey: 'collaboration.duration.permanent'
      },
      {
        code: 'FIXED',
        labelKey: 'collaboration.duration.fixed'
      }
    ],

    policies: [
      {
        code: 'DIRECT',
        labelKey: 'collaboration.policy.direct'
      },
      {
        code: 'APPROVAL_REQUIRED',
        labelKey: 'collaboration.policy.approval'
      },
      {
        code: 'REVIEW_ONLY',
        labelKey: 'collaboration.policy.review'
      }
    ],

    roles: [
      {
        code: 'CO_DESIGNER',
        labelKey: 'collaboration.role.coDesigner',
        defaultPermission: 'EDIT'
      },
      {
        code: 'CONTRIBUTOR',
        labelKey: 'collaboration.role.contributor',
        defaultPermission: 'EDIT'
      },
      {
        code: 'REVIEWER',
        labelKey: 'collaboration.role.reviewer',
        defaultPermission: 'VIEW'
      },
      {
        code: 'VIEWER',
        labelKey: 'collaboration.role.viewer',
        defaultPermission: 'VIEW'
      }
    ],

    permissions: [
      {
        code: 'EDIT',
        labelKey: 'collaboration.permission.edit'
      },
      {
        code: 'VIEW',
        labelKey: 'collaboration.permission.view'
      },
      {
        code: 'NONE',
        labelKey: 'collaboration.permission.none'
      }
    ],

    delegableModules: [
      {
        nodeType: 'projectJournal',
        labelKey: 'node.projectJournal'
      },
      {
        nodeType: 'media',
        labelKey: 'node.media'
      },
      {
        nodeType: 'patternLibrary',
        labelKey: 'node.patternLibrary'
      },
      {
        nodeType: 'sizeSet',
        labelKey: 'node.sizeSet'
      },
      {
        nodeType: 'sewing',
        labelKey: 'node.sewing'
      },
      {
        nodeType: 'techpack',
        labelKey: 'node.techpack'
      },
      {
        nodeType: 'changeHistory',
        labelKey: 'node.changeHistory'
      }
    ]
  },

  audit: {
    initiatorList:
      'CHANGE_INITIATOR',

    operationList:
      'CHANGE_OPERATION',

    retainedReferences: [
      'baseSketch',
      'basePattern'
    ]
  },

  patternLibrary: {
    sections: [
      'masterPattern',
      'patternOutputs',
      'supportingFiles'
    ]
  },

};


// Find My Size static fallback metadata
const findMySizeMetadata = {
  version: '2026-08-23-find-my-size-ui-final',
  defaultLocale: workspaceMetadata.defaultLocale || 'en',
  localePacks: {
    en: {
      'fit.header.kicker': 'Find my size',
      'fit.header.title': 'Measure once. Use the right fit guidance for what you are wearing.',
      'fit.header.subtitle': 'Use the full-body guide to record your measurements, then choose a garment category or open Find My Size from a product for product-specific sizing.',
      'fit.action.tour': 'Guided tour',
      'fit.action.sizeConversion': 'Size conversion',
      'fit.action.reset': 'Reset',
      'fit.action.close': 'Close',
      'fit.action.back': 'Back',
      'fit.action.next': 'Next',
      'fit.action.done': 'Done',
      'fit.action.useSize': 'Use size {size}',
      'fit.action.editMeasurement': 'Edit measurement',
      'fit.action.openGuide': 'Open measurement guide',

      'fit.tab.guide': 'Measurement guide',
      'fit.tab.recommendation': 'Find my size',
      'fit.tab.guide.step': '1 · Measure',
      'fit.tab.recommendation.step': '2 · Find my size',

      'fit.guide.avatar.kicker': 'Full-body measurement guide',
      'fit.guide.avatar.subtitle': 'Select a numbered point to see where to measure.',
      'fit.guide.avatar.badge': 'Front view',
      'fit.guide.avatar.aria': 'Interactive full-body measurement avatar',
      'fit.guide.active.kicker': 'How to measure',
      'fit.guide.input.label': 'Your measurement',
      'fit.guide.input.helper': 'Enter the value or use the fine adjuster.',
      'fit.guide.input.placeholder': '—',
      'fit.guide.example.helper': 'The slider shows an example until you enter your own measurement.',
      'fit.guide.progress': '{complete} of {total} measurements saved',
      'fit.guide.saved': 'Saved for reuse on this device.',
      'fit.guide.moreHelp': 'Measurement help',
      'fit.guide.selectedPoint': 'Selected point',
      'fit.guide.tipsTitle': 'Tips',
      'fit.guide.needHelpTitle': 'Need help?',
      'fit.guide.needHelpBody': 'Use the guided tour to learn how each measurement is taken.',
      'fit.guide.startTour': 'Start guided tour',
      'fit.guide.howToMeasure': 'How to measure',
      'fit.guide.tapePlacement': 'Tape placement',
      'fit.guide.commonMistake': 'Common mistake',

      'fit.recommend.title': 'Size guidance',
      'fit.recommend.subtitle': 'Complete the required measurements. We exclude sizes that fail critical areas, then recommend the best remaining size.',
      'fit.recommend.context.general': 'General category guidance',
      'fit.recommend.context.product': 'Sizing this product',
      'fit.recommend.context.generalHelp': 'Choose the garment category and fit that best match what you are sizing.',
      'fit.recommend.context.productHelp': 'This product is locked from Quick View and uses its released fit specification when available.',
      'fit.recommend.category': 'Garment category',
      'fit.recommend.silhouette': 'Fit / silhouette',
      'fit.recommend.generalBadge': 'Standard category baseline',
      'fit.recommend.releasedBadge': 'Released product fit profile',
      'fit.recommend.required': 'Required measurements',
      'fit.recommend.requiredHelp': 'Enter or edit the measurements used for this fit check.',
      'fit.recommend.optional': 'Additional measurements',
      'fit.recommend.unit': 'Unit',
      'fit.recommend.completeCritical.title': 'Complete the required measurements',
      'fit.recommend.completeCritical.body': 'Add {measurements} before we can give a final size recommendation.',
      'fit.recommend.noMatch.title': 'No good standard-size match',
      'fit.recommend.noMatch.body': 'No available size passes every critical fit requirement. Try another cut or plan an alteration.',
      'fit.recommend.closest': 'Closest available size: {size}',
      'fit.recommend.bestSize': 'Best viable size',
      'fit.recommend.confidence': 'Fit confidence · {confidence}',
      'fit.recommend.controlling': 'Controlling measurement',
      'fit.recommend.controllingBody': '{measurement} is the critical area limiting the size choice.',
      'fit.recommend.profile': 'Your body-part size profile',
      'fit.recommend.expectedFit': 'Expected fit in {size}',
      'fit.recommend.aboveRange': 'Above range',
      'fit.recommend.empty': 'Enter your measurements to calculate the best viable size.',
      'fit.recommend.currentShoppingSize': 'Current shopping size: {size}',
      'fit.recommend.applied': 'Size {size} selected. This accepted fit result was saved to your fit history.',
      'fit.recommend.generalNotice': 'Category mode gives general size guidance. Open Find My Size from a product to use that product’s released fit specification.',
      'fit.recommend.productNotice': 'This recommendation uses the product’s released fit specification when available.',

      'fit.priority.CRITICAL': 'Critical',
      'fit.priority.IMPORTANT': 'Important',
      'fit.priority.SECONDARY': 'Secondary',
      'fit.priority.NOT_RELEVANT': 'Not relevant',
      'fit.priority.DEFAULT': 'Fit input',

      'fit.confidence.HIGH': 'High',
      'fit.confidence.MEDIUM': 'Medium',
      'fit.confidence.BASELINE': 'Baseline',
      'fit.confidence.LOW': 'Low',

      'fit.breakdown.Not assessed': 'Not assessed',
      'fit.breakdown.Too small': 'Too small',
      'fit.breakdown.Too loose': 'Too loose',
      'fit.breakdown.Close / snug': 'Close / snug',
      'fit.breakdown.Relaxed': 'Relaxed',
      'fit.breakdown.Best fit': 'Best fit',
      'fit.breakdown.Snug': 'Snug',
      'fit.breakdown.Comfortable': 'Comfortable',

      'fit.bodyArea.THIGH': 'Thigh',
      'fit.bodyArea.BACK_LENGTH': 'Back length',
      'fit.bodyArea.TORSO_LENGTH': 'Torso length',
      'fit.bodyArea.SLEEVE_LENGTH': 'Sleeve length',
      'fit.bodyArea.OUTSEAM': 'Full leg / outseam',

      'fit.tour.title': 'Find My Size guided tour',
      'fit.tour.counter': 'Step {current} of {total}',
      'fit.tour.1.title': 'Choose a measurement point',
      'fit.tour.1.body': 'Use the numbered full-body avatar. It includes torso, sleeve and full-leg measurements.',
      'fit.tour.2.title': 'Check the close-up',
      'fit.tour.2.body': 'Use the selected-point panel to see the measurement area clearly, then follow the placement tip before recording the value in Find My Size.',
      'fit.tour.3.title': 'Choose what you are sizing',
      'fit.tour.3.body': 'For general guidance, choose a garment category and fit. From Quick View, the product is selected automatically.',
      'fit.tour.4.title': 'Get the best viable size',
      'fit.tour.4.body': 'Complete the required measurements. Sizes that fail critical areas are excluded before the remaining sizes are ranked.',
      'fit.tour.measurementDetail': 'Current measurement help',

      'measurement.NECK.label': 'Neck girth',
      'measurement.NECK.short': 'Neck',
      'measurement.NECK.instruction': 'Measure around the base of the neck with the tape level and comfortably close.',
      'measurement.NECK.tape': 'Keep one finger under the tape and stay at the neck base.',
      'measurement.NECK.mistake': 'Do not measure high on the throat or pull the tape tight.',

      'measurement.SHOULDER.label': 'Shoulder length',
      'measurement.SHOULDER.short': 'Shoulder',
      'measurement.SHOULDER.instruction': 'Measure from the neck point to the outer shoulder joint.',
      'measurement.SHOULDER.tape': 'Follow the natural shoulder line from the neck/shoulder junction to the shoulder bone.',
      'measurement.SHOULDER.mistake': 'Do not use the sleeve seam of a loose top as the endpoint.',

      'measurement.HIGH_BUST.label': 'High bust',
      'measurement.HIGH_BUST.short': 'High bust',
      'measurement.HIGH_BUST.instruction': 'Measure around the upper chest, above the fullest part of the bust and under the arms.',
      'measurement.HIGH_BUST.tape': 'Keep the tape horizontal across the back and above the bust apex.',
      'measurement.HIGH_BUST.mistake': 'Do not let the tape drop over the fullest part of the bust.',

      'measurement.BUST.label': 'Full bust / chest girth',
      'measurement.BUST.short': 'Bust',
      'measurement.BUST.instruction': 'Measure around the fullest part of the bust or chest, keeping the tape level.',
      'measurement.BUST.tape': 'Pass over the fullest point, under the arms and straight across the back.',
      'measurement.BUST.mistake': 'Do not compress the bust or lift the chest to change the number.',

      'measurement.UNDERBUST.label': 'Underbust',
      'measurement.UNDERBUST.short': 'Underbust',
      'measurement.UNDERBUST.instruction': 'Measure directly under the bust around the rib cage.',
      'measurement.UNDERBUST.tape': 'Keep the tape horizontal at the bra-band line.',
      'measurement.UNDERBUST.mistake': 'Do not measure over the bust or pull the tape into the ribs.',

      'measurement.FRONT_WAIST_LENGTH.label': 'Front waist length',
      'measurement.FRONT_WAIST_LENGTH.short': 'Front waist',
      'measurement.FRONT_WAIST_LENGTH.instruction': 'Measure from the high-point shoulder, over the bust, to the natural waist.',
      'measurement.FRONT_WAIST_LENGTH.tape': 'Let the tape follow the body contour over the bust.',
      'measurement.FRONT_WAIST_LENGTH.mistake': 'Do not stop at a low trouser waistband instead of the natural waist.',

      'measurement.WAIST.label': 'Natural waist girth',
      'measurement.WAIST.short': 'Waist',
      'measurement.WAIST.instruction': 'Measure around the natural waist between the lower ribs and hip bones.',
      'measurement.WAIST.tape': 'Keep the tape level and relaxed around the natural waist.',
      'measurement.WAIST.mistake': 'Do not use the position of your jeans or pull the tape inward.',

      'measurement.HIP.label': 'Hip / seat girth',
      'measurement.HIP.short': 'Hip',
      'measurement.HIP.instruction': 'Measure around the fullest part of the hips and seat.',
      'measurement.HIP.tape': 'Stand naturally and keep the tape horizontal all around.',
      'measurement.HIP.mistake': 'Do not measure only across the hip bones; include the fullest seat point.',

      'measurement.THIGH.label': 'Thigh girth',
      'measurement.THIGH.short': 'Thigh',
      'measurement.THIGH.instruction': 'Measure around the fullest part of the upper thigh.',
      'measurement.THIGH.tape': 'Keep the tape horizontal and close to the body without compressing the leg.',
      'measurement.THIGH.mistake': 'Do not measure too low on the thigh or pull the tape tight.',

      'measurement.SLEEVE_LENGTH.label': 'Sleeve length',
      'measurement.SLEEVE_LENGTH.short': 'Sleeve',
      'measurement.SLEEVE_LENGTH.instruction': 'Measure from the shoulder point down the outside of the arm to the wrist.',
      'measurement.SLEEVE_LENGTH.tape': 'Keep the arm slightly bent and follow the arm from shoulder to wrist.',
      'measurement.SLEEVE_LENGTH.mistake': 'Do not measure with the arm locked straight or from the neck instead of the shoulder point.',

      'measurement.INSEAM.label': 'Inside leg / inseam',
      'measurement.INSEAM.short': 'Inseam',
      'measurement.INSEAM.instruction': 'Measure from the crotch point down the inside leg to the floor or desired length.',
      'measurement.INSEAM.tape': 'Keep the leg straight and the tape close to the inside leg.',
      'measurement.INSEAM.mistake': 'Do not start below the crotch. Ask for help or use a well-fitting trouser if needed.',

      'measurement.OUTSEAM.label': 'Full leg / outseam',
      'measurement.OUTSEAM.short': 'Full leg',
      'measurement.OUTSEAM.instruction': 'Measure from the natural waist down the outside leg to the floor or desired length.',
      'measurement.OUTSEAM.tape': 'Run the tape vertically from the waist over the outer hip and down the leg.',
      'measurement.OUTSEAM.mistake': 'Do not start at a low-rise waistband unless that is the intended garment reference.',

      'measurement.HEIGHT.label': 'Body height',
      'measurement.HEIGHT.short': 'Height',
      'measurement.HEIGHT.instruction': 'Stand without shoes and measure from the floor to the top of the head.',
      'measurement.HEIGHT.tape': 'Use a wall and a flat book placed level on the head.',
      'measurement.HEIGHT.mistake': 'Do not include shoe height or stretch upward unnaturally.',

      'conversion.launcher': 'Size conversion',
      'conversion.openAria': 'Open standard size conversion matrix',
      'conversion.openTitle': 'Open size conversion matrix',
      'conversion.panelAria': 'Standard size conversion matrix',
      'conversion.title': 'Standard size conversion matrix',
      'conversion.subtitle': 'Measurement-point reference · EU · UK · US · FR',
      'conversion.minimize': 'Minimize',
      'conversion.restore': 'Restore',
      'conversion.maximize': 'Maximize',
      'conversion.close': 'Close',
      'conversion.measurementPoint': 'Measurement point',
      'conversion.yourMeasurement': 'Your measurement',
      'conversion.notEntered': 'Not entered',
      'conversion.size': 'Size',
      'conversion.matched': 'Matched',
      'conversion.empty': 'No conversion matrix for this measurement point.',
      'conversion.footer': 'Reference matrix only. Find My Size uses the active category baseline or the selected product’s released fit specification for the final recommendation.',
      'conversion.resize': 'Resize'
    },
    views: [
  { code: 'FRONT', label: 'Front view' },
  { code: 'SIDE', label: 'Side view' }
],

measurementPointsByView: {
  FRONT: [
    { id: 'neck', marker: '1', label: 'Neck', x: 40, y: 9 },
    { id: 'shoulder', marker: '2', label: 'Shoulder', x: 69, y: 17 },
    { id: 'highBust', marker: '3', label: 'High bust', x: 17, y: 24 },
    { id: 'bust', marker: '4', label: 'Bust', x: 77, y: 34 },
    { id: 'underbust', marker: '5', label: 'Underbust', x: 17, y: 46 },
    { id: 'frontWaist', marker: '6', label: 'Front waist', x: 52, y: 50 },
    { id: 'waist', marker: '7', label: 'Waist', x: 22, y: 60 },
    { id: 'hip', marker: '8', label: 'Hip', x: 78, y: 74 },
    { id: 'thigh', marker: '9', label: 'Thigh', x: 19, y: 91 },
    { id: 'sleeve', marker: '10', label: 'Sleeve', x: 91, y: 51 },
    { id: 'inseam', marker: '11', label: 'Inseam', x: 43, y: 108 },
    { id: 'fullLeg', marker: '12', label: 'Full leg', x: 63, y: 108 },
    { id: 'height', marker: '13', label: 'Height', x: 94, y: 81 }
  ],

  SIDE: [
    { id: 'neck', marker: '1', label: 'Neck', x: 52, y: 10 },
    { id: 'shoulder', marker: '2', label: 'Shoulder', x: 61, y: 18 },
    { id: 'highBust', marker: '3', label: 'High bust', x: 54, y: 27 },
    { id: 'bust', marker: '4', label: 'Bust', x: 61, y: 34 },
    { id: 'underbust', marker: '5', label: 'Underbust', x: 54, y: 42 },
    { id: 'frontWaist', marker: '6', label: 'Front waist', x: 56, y: 50 },
    { id: 'waist', marker: '7', label: 'Waist', x: 49, y: 56 },
    { id: 'hip', marker: '8', label: 'Hip', x: 56, y: 67 },
    { id: 'thigh', marker: '9', label: 'Thigh', x: 51, y: 83 },
    { id: 'sleeve', marker: '10', label: 'Sleeve', x: 67, y: 46 },
    { id: 'inseam', marker: '11', label: 'Inseam', x: 46, y: 107 },
    { id: 'fullLeg', marker: '12', label: 'Full leg', x: 60, y: 107 },
    { id: 'height', marker: '13', label: 'Height', x: 86, y: 78 }
  ]
},
    
  },
  measurements: [
    { code: 'NECK', legacyId: 1, order: 1, minCm: 29, maxCm: 42, stepCm: 0.25, exampleCm: 34.3 },
    { code: 'SHOULDER', legacyId: 2, order: 2, minCm: 10, maxCm: 16.5, stepCm: 0.25, exampleCm: 11.9 },
    { code: 'HIGH_BUST', order: 3, minCm: 72, maxCm: 132, stepCm: 0.5, exampleCm: 86 },
    { code: 'BUST', legacyId: 3, order: 4, minCm: 76, maxCm: 132, stepCm: 0.5, exampleCm: 91.4 },
    { code: 'UNDERBUST', order: 5, minCm: 65, maxCm: 120, stepCm: 0.5, exampleCm: 76 },
    { code: 'FRONT_WAIST_LENGTH', legacyId: 4, order: 6, minCm: 37, maxCm: 52, stepCm: 0.25, exampleCm: 41.1 },
    { code: 'WAIST', legacyId: 5, order: 7, minCm: 56, maxCm: 112, stepCm: 0.5, exampleCm: 71.1 },
    { code: 'HIP', legacyId: 6, order: 8, minCm: 81, maxCm: 137, stepCm: 0.5, exampleCm: 96.5 },
    { code: 'THIGH', order: 9, minCm: 42, maxCm: 82, stepCm: 0.5, exampleCm: 56 },
    { code: 'SLEEVE_LENGTH', order: 10, minCm: 48, maxCm: 72, stepCm: 0.5, exampleCm: 60 },
    { code: 'INSEAM', legacyId: 7, order: 11, minCm: 60, maxCm: 100, stepCm: 0.5, exampleCm: 78.7 },
    { code: 'OUTSEAM', order: 12, minCm: 85, maxCm: 120, stepCm: 0.5, exampleCm: 103 },
    { code: 'HEIGHT', order: 13, minCm: 140, maxCm: 205, stepCm: 0.5, exampleCm: 165.1 }
  ]
};


// Materials static fallback metadata
const materialsMetadata = {
  version: '2026-08-24-materials-card-hybrid-v4',

  storage: {
    materials: 'perfectfit_bureau_fabric_stash',
    modalLayout: 'perfectfit_materials_modal_layout',
    fabricFinishOptions: 'perfectfit_fabric_finish_options',
    yarnFinishOptions: 'perfectfit_yarn_finish_options',
    suppliers: 'perfectfit_material_suppliers',
    legacySuppliers: 'sartorial_atelier_suppliers',
    incoming: 'perfectfit_material_purchase_requirements',
    goodsReceipts: 'perfectfit_material_goods_receipts',
    materialIssues: 'perfectfit_material_issues'
  },

  workspaceTabs: [
    { id: 'inventory', label: 'Materials Inventory' },
    { id: 'suppliers', label: 'Supplier Directory' },
    { id: 'incoming', label: 'Incoming Materials' }
  ],

  uoms: [
    { code: 'meters', label: 'metres', shortLabel: 'm', family: 'length', toBase: 1 },
    { code: 'yards', label: 'yards', shortLabel: 'yd', family: 'length', toBase: 0.9144 },
    { code: 'pieces', label: 'pieces', shortLabel: 'pc', family: 'count', toBase: 1 }
  ],

  currencies: [
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'GBP', symbol: '£' }
  ],

  incomingStatuses: [
    { code: 'ORDERED', label: 'Ordered' },
    { code: 'IN_TRANSIT', label: 'In transit' },
    { code: 'RECEIVED', label: 'Received', terminal: true },
    { code: 'CANCELLED', label: 'Cancelled', terminal: true }
  ],

  replenishment: {
    targetMultiplier: 2,
    preventDuplicateOpenIncoming: true,
    allowSupplierChangeBeforeReceipt: true,
    allowQtyChangeBeforeReceipt: true,
    allowUomChangeBeforeReceipt: true,
    allowWidthChangeBeforeReceipt: true,
    allowUnitCostChangeBeforeReceipt: true
  },

  valuation: {
    method: 'WEIGHTED_AVERAGE',
    deriveInventoryValue: true,
    updateUnitPriceOnReceipt: true
  },

  stockIssue: {
    transactionTypes: [
      { code: 'ISSUE', label: 'Issue' },
      { code: 'CONSUME', label: 'Consume' }
    ],
    allowUomConversion: true,
    preventNegativeStock: true,
    recordInventoryValue: true
  },

  pantone: {
    provider: 'PANTONE',
    system: 'TCX',
    integrationMode: 'EXTERNAL_VERIFY',
    codePattern: /^\d{2}-\d{4}-TCX$/i,
    verificationBaseUrl: 'https://www.pantone.com/color-finder/'
  },

  eip: {
    ready: true,
    materialEntity: 'eip_core.material',
    supplierEntity: 'eip_core.agent',
    incomingObjectType: 'MATERIAL_INCOMING',
    goodsReceiptObjectType: 'GOODS_RECEIPT',
    materialIssueObjectType: 'MATERIAL_ISSUE',
    note: 'Current persistence remains local. Replace storage access with the EIP V1 adapter without changing UI metadata or workflow.'
  }
};


// Messaging static fallback metadata
const messageMetadata = {
  version: '2026-08-24-message-center-v3-global',

  storage: {
    directMessages: 'perfectfit_direct_messages_v1',
    directory: 'perfectfit_message_directory_v1',
    widgetLayout: 'perfectfit_message_widget_layout_v1'
  },

  messageTypes: [
    { code: 'DIRECT', label: 'Direct message', editable: true },
    { code: 'WORKFLOW', label: 'Workflow', editable: false, systemManaged: true }
  ],

  recipientPicker: {
    mode: 'TYPEAHEAD_MULTI',
    minQueryLength: 1,
    maxVisibleSuggestions: 8,
    allowMultiple: true
  },

  widget: {
    global: true,
    draggable: true,
    launcherCollapsible: true,
    defaultCompact: false,
    edgePadding: 12,
    panelWidth: 470,
    panelHeight: 590
  },

  defaultDirectory: [
    {
      id: 'user-id:margot-leone',
      username: 'margotleone',
      brandName: 'Atelier Margot',
      role: 'collaborator',
      roleLabel: 'Designer',
      label: 'Atelier Margot · @margotleone'
    },
    {
      id: 'role:moderator',
      username: 'moderator',
      role: 'moderator',
      label: 'Publication Moderator'
    },
    {
      id: 'user-id:administrator',
      username: 'executiveadmin',
      role: 'administrator',
      label: 'Executive Administrator'
    }
  ],

  workflow: {
    source: 'publicationMessageStorageKey',
    readOnlyInGeneralInbox: true,
    preserveDedicatedMessenger: true,
    labels: {
      moderator: 'Moderator',
      designer: 'Designer / Owner',
      automatic: 'Automatic workflow'
    }
  },

  eip: {
    ready: true,
    directMessageObjectType: 'MESSAGE',
    workflowMessageObjectType: 'WORKFLOW_MESSAGE',
    recipientEntity: 'eip_core.agent',
    multiRecipientModel: 'MESSAGE_RECIPIENTS',
    note:
      'Recipient typeahead should later resolve EIP V1 agents/users. ' +
      'Workflow messages stay linked to approval/release process instances.'
  }
};

const AVATAR_TAXONOMY = Object.freeze({
  ADULT_FEMALE: 'ADULT_FEMALE',
  ADULT_MALE: 'ADULT_MALE',
  TEEN_FEMALE: 'TEEN_FEMALE',
  TEEN_MALE: 'TEEN_MALE',
  KID_FEMALE: 'KID_FEMALE',
  KID_MALE: 'KID_MALE'
});

const LEGACY_TO_CANONICAL = Object.freeze({
  adult_female: AVATAR_TAXONOMY.ADULT_FEMALE,
  adult_male: AVATAR_TAXONOMY.ADULT_MALE,
  teen_female: AVATAR_TAXONOMY.TEEN_FEMALE,
  teen_male: AVATAR_TAXONOMY.TEEN_MALE,
  child_female: AVATAR_TAXONOMY.KID_FEMALE,
  child_male: AVATAR_TAXONOMY.KID_MALE,
  kid_female: AVATAR_TAXONOMY.KID_FEMALE,
  kid_male: AVATAR_TAXONOMY.KID_MALE,
  FEMALE_ADULT: AVATAR_TAXONOMY.ADULT_FEMALE,
  MALE_ADULT: AVATAR_TAXONOMY.ADULT_MALE,
  FEMALE_TEEN: AVATAR_TAXONOMY.TEEN_FEMALE,
  MALE_TEEN: AVATAR_TAXONOMY.TEEN_MALE,
  FEMALE_KID: AVATAR_TAXONOMY.KID_FEMALE,
  MALE_KID: AVATAR_TAXONOMY.KID_MALE
});

const CANONICAL_TO_LEGACY = Object.freeze({
  [AVATAR_TAXONOMY.ADULT_FEMALE]: ['adult_female'],
  [AVATAR_TAXONOMY.ADULT_MALE]: ['adult_male'],
  [AVATAR_TAXONOMY.TEEN_FEMALE]: ['teen_female'],
  [AVATAR_TAXONOMY.TEEN_MALE]: ['teen_male'],
  [AVATAR_TAXONOMY.KID_FEMALE]: ['child_female', 'kid_female'],
  [AVATAR_TAXONOMY.KID_MALE]: ['child_male', 'kid_male']
});

const AVATAR_GENDERS = Object.freeze([
  { code: 'FEMALE', label: 'Female' },
  { code: 'MALE', label: 'Male' }
]);

const AVATAR_AGE_GROUPS = Object.freeze([
  { code: 'ADULT', label: 'Adult', ageRange: '18+' },
  { code: 'TEEN', label: 'Teen (13–17)', ageRange: '13–17' },
  { code: 'KID', label: 'Child (5–12)', ageRange: '5–12' }
]);

const AVATAR_PROFILES = Object.freeze({
  [AVATAR_TAXONOMY.ADULT_FEMALE]: {
    id: AVATAR_TAXONOMY.ADULT_FEMALE,
    gender: 'FEMALE',
    ageGroup: 'ADULT',
    taxonomyFamily: 'ADULT_FEMALE',
    label: 'Adult woman',
    assetPrefix: 'Adult_Female',
    images: { FRONT: adultFemaleFront, SIDE: adultFemaleSide, BACK: adultFemaleBack }
  },
  [AVATAR_TAXONOMY.ADULT_MALE]: {
    id: AVATAR_TAXONOMY.ADULT_MALE,
    gender: 'MALE',
    ageGroup: 'ADULT',
    taxonomyFamily: 'ADULT_MALE',
    label: 'Adult man',
    assetPrefix: 'Adult_Male',
    images: { FRONT: adultMaleFront, SIDE: adultMaleSide, BACK: adultMaleBack }
  },
  [AVATAR_TAXONOMY.TEEN_FEMALE]: {
    id: AVATAR_TAXONOMY.TEEN_FEMALE,
    gender: 'FEMALE',
    ageGroup: 'TEEN',
    taxonomyFamily: 'TEEN_FEMALE',
    label: 'Teen girl',
    assetPrefix: 'Teen_Female',
    images: { FRONT: teenFemaleFront, SIDE: teenFemaleSide, BACK: teenFemaleBack }
  },
  [AVATAR_TAXONOMY.TEEN_MALE]: {
    id: AVATAR_TAXONOMY.TEEN_MALE,
    gender: 'MALE',
    ageGroup: 'TEEN',
    taxonomyFamily: 'TEEN_MALE',
    label: 'Teen boy',
    assetPrefix: 'Teen_Male',
    images: { FRONT: teenMaleFront, SIDE: teenMaleSide, BACK: teenMaleBack }
  },
  [AVATAR_TAXONOMY.KID_FEMALE]: {
    id: AVATAR_TAXONOMY.KID_FEMALE,
    gender: 'FEMALE',
    ageGroup: 'KID',
    taxonomyFamily: 'KID_FEMALE',
    label: 'Girl',
    assetPrefix: 'Kid_Female',
    images: { FRONT: kidFemaleFront, SIDE: kidFemaleSide, BACK: kidFemaleBack }
  },
  [AVATAR_TAXONOMY.KID_MALE]: {
    id: AVATAR_TAXONOMY.KID_MALE,
    gender: 'MALE',
    ageGroup: 'KID',
    taxonomyFamily: 'KID_MALE',
    label: 'Boy',
    assetPrefix: 'Kid_Male',
    images: { FRONT: kidMaleFront, SIDE: kidMaleSide, BACK: kidMaleBack }
  }
});

const RUSSIAN_MEASUREMENT_SOURCE = Object.freeze({
  titleRu: 'Основные измерения женских фигур',
  titleEn: 'Basic measurements of female figures',
  sourceLanguage: 'ru',
  sourceValueConvention:
    'Rows described as полуобхват are traditionally recorded as one-half of the full tape circumference.'
});

const RUSSIAN_MEASUREMENT_GUIDE = Object.freeze([
  {
    no: '1',
    symbolRu: 'Сш',
    nameRu: 'Полуобхват шеи',
    nameEn: 'Neck semi-girth',
    normalizedCode: 'NECK',
    normalizedLabel: 'Neck circumference',
    type: 'circumference',
    sourceRecording: 'HALF_GIRTH',
    appRecording: 'FULL_CIRCUMFERENCE',
    status: 'EXISTING_OK',
    views: ['FRONT', 'SIDE', 'BACK'],
    descriptionEn:
      'Pass the tape around the base of the neck: at the back over the prominent seventh cervical vertebra and at the front above the jugular notch.'
  },
  {
    no: '2',
    symbolRu: 'Сг1',
    nameRu: 'Полуобхват груди первый',
    nameEn: 'First bust semi-girth',
    normalizedCode: 'HIGH_BUST',
    normalizedLabel: 'Upper bust / first bust circumference',
    type: 'circumference',
    sourceRecording: 'HALF_GIRTH',
    appRecording: 'FULL_CIRCUMFERENCE',
    status: 'EXISTING_ADJUST',
    views: ['FRONT', 'SIDE'],
    appliesTo: ['adult_female', 'teen_female'],
    descriptionEn:
      'Run the tape across the shoulder-blade line, touching the upper edge of the tape to the rear corners of the armpits; at the front pass above the base of the breasts.'
  },
  {
    no: '3',
    symbolRu: 'Сг2',
    nameRu: 'Полуобхват груди второй',
    nameEn: 'Second bust semi-girth',
    normalizedCode: 'BUST_2',
    normalizedLabel: 'Bust circumference 2',
    type: 'circumference',
    sourceRecording: 'HALF_GIRTH',
    appRecording: 'FULL_CIRCUMFERENCE',
    status: 'NEW',
    views: ['FRONT', 'SIDE'],
    appliesTo: ['adult_female', 'teen_female'],
    descriptionEn:
      'Run the tape across the shoulder-blade line, touching the rear armpit corners, and at the front pass through the most prominent points of the breasts.'
  },
  {
    no: '4',
    symbolRu: 'Сг3',
    nameRu: 'Полуобхват груди третий',
    nameEn: 'Third bust semi-girth',
    normalizedCode: 'BUST',
    normalizedLabel: 'Bust / chest circumference',
    type: 'circumference',
    sourceRecording: 'HALF_GIRTH',
    appRecording: 'FULL_CIRCUMFERENCE',
    status: 'EXISTING_ADJUST',
    views: ['FRONT', 'SIDE'],
    descriptionEn:
      'Measure strictly horizontally through the most prominent bust/chest points.'
  },
  {
    no: '5',
    symbolRu: 'Ст',
    nameRu: 'Полуобхват талии',
    nameEn: 'Waist semi-girth',
    normalizedCode: 'WAIST',
    normalizedLabel: 'Waist circumference',
    type: 'circumference',
    sourceRecording: 'HALF_GIRTH',
    appRecording: 'FULL_CIRCUMFERENCE',
    status: 'EXISTING_OK',
    views: ['FRONT', 'SIDE', 'BACK'],
    descriptionEn:
      'Measure horizontally over the elastic or thin cord tied at the natural waist.'
  },
  {
    no: '6',
    symbolRu: 'Сб',
    nameRu: 'Полуобхват бедер',
    nameEn: 'Hip semi-girth',
    normalizedCode: 'HIP',
    normalizedLabel: 'Hip circumference',
    type: 'circumference',
    sourceRecording: 'HALF_GIRTH',
    appRecording: 'FULL_CIRCUMFERENCE',
    status: 'EXISTING_ADJUST',
    views: ['FRONT', 'SIDE', 'BACK'],
    descriptionEn:
      'Measure horizontally over the fullest points of the buttocks at the back and allow for the abdominal projection at the front.'
  },
  {
    no: '7',
    symbolRu: 'Шг1',
    nameRu: 'Ширина груди первая',
    nameEn: 'Chest width 1',
    normalizedCode: 'UPPER_CHEST',
    normalizedLabel: 'Chest width 1 / upper chest width',
    type: 'width',
    sourceRecording: 'HALF_VALUE',
    appRecording: 'FULL_MEASURED_DISTANCE',
    status: 'EXISTING_ADJUST',
    views: ['FRONT'],
    descriptionEn:
      'Measure horizontally above the base of the breasts between the front corners of the armpits. The original system records half the measured value.'
  },
  {
    no: '8',
    symbolRu: 'Шг2',
    nameRu: 'Ширина груди вторая',
    nameEn: 'Chest width 2',
    normalizedCode: 'CHEST_WIDTH_2',
    normalizedLabel: 'Chest width 2',
    type: 'width',
    sourceRecording: 'HALF_VALUE',
    appRecording: 'FULL_MEASURED_DISTANCE',
    status: 'NEW',
    views: ['FRONT'],
    appliesTo: ['adult_female', 'teen_female'],
    descriptionEn:
      'Measure horizontally through the bust points to imaginary vertical lines dropped from the front corners of the armpits. The original system records half the measured value.'
  },
  {
    no: '9',
    symbolRu: 'Цг',
    nameRu: 'Расстояние между центрами груди',
    nameEn: 'Distance between bust centres',
    normalizedCode: 'BUST_POINT_DISTANCE',
    normalizedLabel: 'Bust-point distance',
    type: 'width',
    sourceRecording: 'HALF_VALUE',
    appRecording: 'FULL_MEASURED_DISTANCE',
    status: 'NEW',
    views: ['FRONT'],
    appliesTo: ['adult_female', 'teen_female'],
    descriptionEn:
      'Measure horizontally between the centres / bust apex points. The original system records half the measured value.'
  },
  {
    no: '10',
    symbolRu: 'Шс',
    nameRu: 'Ширина спины',
    nameEn: 'Back width',
    normalizedCode: 'ACROSS_BACK',
    normalizedLabel: 'Across back / back width',
    type: 'width',
    sourceRecording: 'HALF_VALUE',
    appRecording: 'FULL_MEASURED_DISTANCE',
    status: 'EXISTING_ADJUST',
    views: ['BACK'],
    descriptionEn:
      'Measure horizontally across the shoulder-blade line between the rear corners of the armpits. The original system records half the measured value.'
  },
  {
    no: '11',
    symbolRu: 'Дтс',
    nameRu: 'Длина спины до линии талии',
    nameEn: 'Back length to waist',
    normalizedCode: 'BACK_WAIST_LENGTH',
    normalizedLabel: 'Back neck-to-waist length',
    type: 'length',
    status: 'EXISTING_ADJUST',
    views: ['BACK'],
    descriptionEn:
      'Measure vertically from the natural waist line to the shoulder seam at the base of the neck.'
  },
  {
    no: '12',
    symbolRu: 'Дтсо',
    nameRu: 'Длина спины до линии талии по отвесу',
    nameEn: 'Back length to waist by plumb line',
    normalizedCode: 'BACK_WAIST_LENGTH_PLUMB',
    normalizedLabel: 'Back waist length — plumb',
    type: 'length',
    status: 'NEW',
    views: ['BACK'],
    descriptionEn:
      'Measure vertically by plumb line from the shoulder seam at the base of the neck to the horizontal waist level, parallel to the spine and allowing for shoulder-blade projection.'
  },
  {
    no: '13',
    symbolRu: 'Дтп',
    nameRu: 'Длина переда до линии талии',
    nameEn: 'Front length to waist',
    normalizedCode: 'FRONT_WAIST_LENGTH',
    normalizedLabel: 'Front waist length',
    type: 'length',
    status: 'EXISTING_OK',
    views: ['FRONT'],
    descriptionEn:
      'Measure from the shoulder seam at the base of the neck down to the horizontal natural-waist line.'
  },
  {
    no: '14',
    symbolRu: 'Вг',
    nameRu: 'Высота груди',
    nameEn: 'Bust height',
    normalizedCode: 'SHOULDER_TO_BUST_APEX',
    normalizedLabel: 'Shoulder / neck point to bust apex',
    type: 'length',
    status: 'EXISTING_ADJUST',
    views: ['FRONT'],
    appliesTo: ['adult_female', 'teen_female'],
    descriptionEn:
      'Measure through the highest / most prominent bust point, marking the position of the bust apex.'
  },
  {
    no: '15',
    symbolRu: 'Впрз',
    nameRu: 'Высота заднего угла подмышечной впадины',
    nameEn: 'Height of rear armpit corner',
    normalizedCode: 'BACK_ARMHOLE_HEIGHT',
    normalizedLabel: 'Back armhole height',
    type: 'length',
    status: 'NEW',
    views: ['BACK'],
    descriptionEn:
      'Measure from the shoulder seam at the base of the neck to the horizontal level through the lower rear corner of the armpit, parallel to the spine and allowing for shoulder-blade projection.'
  },
  {
    no: '16',
    symbolRu: 'Впк',
    nameRu: 'Высота плеча косая',
    nameEn: 'Oblique shoulder height',
    normalizedCode: 'SHOULDER_HEIGHT_OBLIQUE',
    normalizedLabel: 'Oblique shoulder height',
    type: 'length',
    status: 'NEW',
    views: ['BACK'],
    descriptionEn:
      'Measure from the intersection of the waist line and spine, across the shoulder blade, to the shoulder joint / outer shoulder point.'
  },
  {
    no: '17',
    symbolRu: 'Вппк',
    nameRu: 'Высота плеча переда косая',
    nameEn: 'Front oblique shoulder height',
    normalizedCode: 'FRONT_SHOULDER_HEIGHT_OBLIQUE',
    normalizedLabel: 'Front oblique shoulder height',
    type: 'length',
    status: 'NEW',
    views: ['FRONT'],
    appliesTo: ['adult_female', 'teen_female'],
    descriptionEn:
      'Measure from the bust apex / highest bust point to the shoulder joint.'
  },
  {
    no: '18',
    symbolRu: 'Впс',
    nameRu: 'Высота плеча спинки',
    nameEn: 'Back shoulder height',
    normalizedCode: 'BACK_SHOULDER_HEIGHT',
    normalizedLabel: 'Back shoulder height',
    type: 'length',
    status: 'NEW',
    views: ['BACK'],
    descriptionEn:
      'Measure from the horizontal waist line, parallel to the spine, to the outer shoulder point without allowing for shoulder-blade projection.'
  },
  {
    no: '19',
    symbolRu: 'Впп',
    nameRu: 'Высота плеча полочки',
    nameEn: 'Front shoulder height',
    normalizedCode: 'FRONT_SHOULDER_HEIGHT',
    normalizedLabel: 'Front shoulder height',
    type: 'length',
    status: 'NEW',
    views: ['FRONT'],
    descriptionEn:
      'Measure vertically from the outer shoulder point down the front to the horizontal natural-waist line.'
  },
  {
    no: '20',
    symbolRu: 'Ди',
    nameRu: 'Длина изделия',
    nameEn: 'Garment length',
    normalizedCode: 'GARMENT_LENGTH',
    normalizedLabel: 'Garment / body reference length',
    type: 'length',
    status: 'NEW',
    views: ['BACK'],
    descriptionEn:
      'Measure from the prominent seventh cervical vertebra along the longitudinal contour of the body to the desired garment length.'
  },
  {
    no: '21a',
    symbolRu: 'Дисп',
    nameRu: 'Расстояние от линии талии до пола — спереди',
    nameEn: 'Waist to floor — front',
    normalizedCode: 'WAIST_TO_FLOOR_FRONT',
    normalizedLabel: 'Waist-to-floor front',
    type: 'length',
    status: 'NEW',
    views: ['FRONT'],
    descriptionEn:
      'Measure at centre front from the natural waist line vertically to the floor.'
  },
  {
    no: '21b',
    symbolRu: 'Дисб',
    nameRu: 'Расстояние от линии талии до пола — сбоку',
    nameEn: 'Waist to floor — side',
    normalizedCode: 'OUTSEAM',
    normalizedLabel: 'Waist-to-floor side / outseam',
    type: 'length',
    status: 'EXISTING_ADJUST',
    views: ['SIDE'],
    descriptionEn:
      'Measure at the side from the natural waist line vertically to the floor.'
  },
  {
    no: '21c',
    symbolRu: 'Дисз',
    nameRu: 'Расстояние от линии талии до пола — сзади',
    nameEn: 'Waist to floor — back',
    normalizedCode: 'WAIST_TO_FLOOR_BACK',
    normalizedLabel: 'Waist-to-floor back',
    type: 'length',
    status: 'NEW',
    views: ['BACK'],
    descriptionEn:
      'Measure at centre back from the natural waist line vertically to the floor.'
  },
  {
    no: '22',
    symbolRu: 'Шп',
    nameRu: 'Ширина плеча',
    nameEn: 'Shoulder width',
    normalizedCode: 'SHOULDER',
    normalizedLabel: 'Shoulder length / width',
    type: 'length',
    status: 'EXISTING_OK',
    views: ['FRONT', 'BACK'],
    descriptionEn:
      'Measure from the base of the neck to the shoulder joint / outer shoulder point.'
  },
  {
    no: '23',
    symbolRu: 'Др',
    nameRu: 'Длина рукава',
    nameEn: 'Sleeve length',
    normalizedCode: 'SLEEVE_LENGTH',
    normalizedLabel: 'Sleeve / arm length',
    type: 'length',
    status: 'EXISTING_OK',
    views: ['SIDE'],
    descriptionEn:
      'Measure from the shoulder joint along the freely lowered arm to the desired sleeve length.'
  },
  {
    no: '24',
    symbolRu: 'Оп',
    nameRu: 'Обхват плеча',
    nameEn: 'Upper-arm circumference',
    normalizedCode: 'UPPER_ARM_CIRC',
    normalizedLabel: 'Upper-arm circumference',
    type: 'circumference',
    status: 'EXISTING_ADJUST',
    views: ['SIDE'],
    descriptionEn:
      'Measure strictly horizontally around the upper arm so the upper edge of the tape touches the rear corner of the armpit.'
  },
  {
    no: '25',
    symbolRu: 'Вб',
    nameRu: 'Высота бочка',
    nameEn: 'Side height',
    normalizedCode: 'SIDE_HEIGHT',
    normalizedLabel: 'Waist-to-underarm side height',
    type: 'length',
    status: 'NEW',
    views: ['SIDE'],
    descriptionEn:
      'Measure vertically from the waist line to the lower corner of the armpit. This measurement helps establish the bust/chest line.'
  },
  {
    no: '26',
    symbolRu: 'Об',
    nameRu: 'Обхват бедра',
    nameEn: 'Thigh circumference',
    normalizedCode: 'THIGH',
    normalizedLabel: 'Upper-thigh circumference',
    type: 'circumference',
    status: 'EXISTING_ADJUST',
    views: ['FRONT', 'SIDE', 'BACK'],
    descriptionEn:
      'Measure horizontally around the upper thigh at the sub-gluteal fold.'
  },
  {
    no: '27',
    symbolRu: 'Ок',
    nameRu: 'Обхват колена',
    nameEn: 'Knee circumference',
    normalizedCode: 'KNEE_CIRC',
    normalizedLabel: 'Knee circumference',
    type: 'circumference',
    status: 'NEW',
    views: ['FRONT', 'SIDE', 'BACK'],
    descriptionEn:
      'Measure horizontally around the knee through the centre of the kneecap.'
  },
  {
    no: '28',
    symbolRu: 'Ои',
    nameRu: 'Обхват икры',
    nameEn: 'Calf circumference',
    normalizedCode: 'CALF_CIRC',
    normalizedLabel: 'Calf circumference',
    type: 'circumference',
    status: 'NEW',
    views: ['FRONT', 'SIDE', 'BACK'],
    descriptionEn:
      'Measure horizontally around the fullest part of the calf.'
  },
  {
    no: '29',
    symbolRu: 'Ос',
    nameRu: 'Обхват стопы',
    nameEn: 'Foot circumference',
    normalizedCode: 'FOOT_CIRC',
    normalizedLabel: 'Foot / instep circumference',
    type: 'circumference',
    status: 'NEW',
    views: ['SIDE'],
    descriptionEn:
      'Measure around the most projecting lower point of the heel and the deepest point of the instep bend.'
  },
  {
    no: '30',
    symbolRu: 'Вс',
    nameRu: 'Высота сидения',
    nameEn: 'Sitting height',
    normalizedCode: 'SITTING_HEIGHT',
    normalizedLabel: 'Sitting height',
    type: 'length',
    status: 'NEW',
    views: ['SIDE'],
    descriptionEn:
      'While seated, measure vertically at the side from the natural waist line down to the seat surface.'
  }
]);

const IMAGE_SIZE = { width: 1024, height: 1536 };

const STAGE_ASPECT = `${IMAGE_SIZE.width}/${IMAGE_SIZE.height}`;

const CALIBRATION_STORAGE_KEY = 'perfectfit_avatar_calibration_v1';

const MEASUREMENT_ADMIN_STORAGE_KEY = 'perfectfit_measurement_avatar_admin_v1';

const MEASUREMENT_PERSISTENCE = Object.freeze({
  entityType: 'MEASUREMENT_AVATAR_CONFIGURATION',
  visibility: 'ALL_USERS',
  writeRoles: ['administrator'],
  calibrationObjectType: 'MEASUREMENT_AVATAR_CALIBRATION'
});

const CALIBRATION_EDITOR_VERSION = 'dynamic-avatar-state-v9.2';

const ANCHOR_COLORS = Object.freeze({
  start: '#16A34A',
  middle: '#F59E0B',
  end: '#DC2626'
});

const VIEW_MEASUREMENT_ORDER = Object.freeze({
  // Display order only. It MUST NOT decide whether a measurement exists on a
  // view. Existence is resolved dynamically by avatarAreaMetadata.js.
  FRONT: [
    // Official Russian source points for the front view.
    'NECK', 'HIGH_BUST', 'BUST_2', 'BUST', 'WAIST', 'HIP',
    'UPPER_CHEST', 'CHEST_WIDTH_2', 'BUST_POINT_DISTANCE',
    'FRONT_WAIST_LENGTH', 'SHOULDER_TO_BUST_APEX',
    'FRONT_SHOULDER_HEIGHT_OBLIQUE', 'FRONT_SHOULDER_HEIGHT',
    'WAIST_TO_FLOOR_FRONT', 'SHOULDER', 'THIGH', 'KNEE_CIRC', 'CALF_CIRC',
    // Perfect Fit supplementary measurements with a front starter layout.
    'UNDERBUST', 'ELBOW_CIRC', 'WRIST_CIRC', 'INSEAM', 'HEIGHT'
  ],
  SIDE: [
    // Official Russian source points for the side view.
    'NECK', 'HIGH_BUST', 'BUST_2', 'BUST', 'WAIST', 'HIP',
    'OUTSEAM', 'SLEEVE_LENGTH', 'UPPER_ARM_CIRC', 'SIDE_HEIGHT',
    'THIGH', 'KNEE_CIRC', 'CALF_CIRC', 'FOOT_CIRC', 'SITTING_HEIGHT',
    // Perfect Fit supplementary measurements with a side starter layout.
    'UNDERBUST', 'ARMHOLE_DEPTH', 'ELBOW_CIRC', 'WRIST_CIRC', 'INSEAM', 'HEIGHT'
  ],
  BACK: [
    // Official Russian source points for the back view.
    'NECK', 'WAIST', 'HIP', 'ACROSS_BACK', 'BACK_WAIST_LENGTH',
    'BACK_WAIST_LENGTH_PLUMB', 'BACK_ARMHOLE_HEIGHT',
    'SHOULDER_HEIGHT_OBLIQUE', 'BACK_SHOULDER_HEIGHT', 'GARMENT_LENGTH',
    'WAIST_TO_FLOOR_BACK', 'SHOULDER', 'THIGH', 'KNEE_CIRC', 'CALF_CIRC',
    // Perfect Fit supplementary measurements with a back starter layout.
    'SHOULDER_TO_SHOULDER', 'ARMHOLE_DEPTH', 'ELBOW_CIRC', 'WRIST_CIRC', 'HEIGHT'
  ]
});

const MEASUREMENT_INPUT_SPECS = Object.freeze({
  UPPER_CHEST: {
    minCm: 28, maxCm: 50, stepCm: 0.25, exampleCm: 36,
    instruction: 'Measure horizontally across the upper chest just above the upper-bust line.',
    tapeHelp: 'Keep the tape level across the upper chest without dropping onto the bust.',
    mistake: 'Do not measure across the fullest part of the bust.'
  },
  SHOULDER_TO_BUST_APEX: {
    minCm: 20, maxCm: 42, stepCm: 0.25, exampleCm: 28,
    instruction: 'Measure from the high shoulder point to the bust apex.',
    tapeHelp: 'Let the tape follow the body naturally from shoulder to bust apex.',
    mistake: 'Do not start from the neck centre or stop above the bust apex.'
  },
  UPPER_ARM_CIRC: {
    minCm: 20, maxCm: 52, stepCm: 0.25, exampleCm: 30,
    instruction: 'Measure around the fullest part of the upper arm.',
    tapeHelp: 'Keep the arm relaxed and the tape level without compression.',
    mistake: 'Do not flex the arm or pull the tape tight.'
  },
  ELBOW_CIRC: {
    minCm: 18, maxCm: 42, stepCm: 0.25, exampleCm: 27,
    instruction: 'Measure around the elbow with the arm slightly bent.',
    tapeHelp: 'Pass the tape around the elbow joint at its fullest point.',
    mistake: 'Do not measure with the arm locked straight.'
  },
  WRIST_CIRC: {
    minCm: 12, maxCm: 26, stepCm: 0.25, exampleCm: 16,
    instruction: 'Measure around the wrist at the wrist bone.',
    tapeHelp: 'Keep the tape comfortably close around the wrist bone.',
    mistake: 'Do not measure up the forearm.'
  },
  SHOULDER_TO_SHOULDER: {
    minCm: 30, maxCm: 52, stepCm: 0.25, exampleCm: 39,
    instruction: 'From the back, measure from one shoulder point to the other.',
    tapeHelp: 'Follow the natural upper-back curve between the outer shoulder points.',
    mistake: 'Do not measure straight across the front or from sleeve seams.'
  },
  ACROSS_BACK: {
    minCm: 28, maxCm: 52, stepCm: 0.25, exampleCm: 36,
    instruction: 'Measure horizontally across the back between the armhole folds.',
    tapeHelp: 'Keep the tape level across the shoulder-blade area.',
    mistake: 'Do not wrap the tape around the body; this is a back width.'
  },
  BACK_WAIST_LENGTH: {
    minCm: 34, maxCm: 58, stepCm: 0.25, exampleCm: 42,
    instruction: 'Measure from the prominent bone at the back neck down to the natural waist.',
    tapeHelp: 'Keep the tape centred along the spine to the natural waistline.',
    mistake: 'Do not stop at a low trouser waistband.'
  },
  ARMHOLE_DEPTH: {
    minCm: 15, maxCm: 32, stepCm: 0.25, exampleCm: 21,
    instruction: 'Measure vertically from the shoulder level to the underarm level.',
    tapeHelp: 'Keep the measurement vertical and identify the true underarm level.',
    mistake: 'Do not follow the arm curve as a circumference.'
  }
});

const view = (marker, guide, focus) => ({ marker, guide, focus });

const BASE_MEASUREMENTS = [
  {
    code: 'NECK', marker: '1', label: 'Neck circumference', shortLabel: 'Neck', type: 'circumference',
    layout: {
      FRONT: view({ x: 382, y: 304 }, 'M430 303 C470 318 554 318 595 303', { x: 50, y: 21, scale: 3.0 }),
      SIDE: view({ x: 420, y: 300 }, 'M474 300 C502 306 535 307 563 300', { x: 51, y: 20, scale: 3.0 }),
      BACK: view({ x: 360, y: 303 }, 'M432 302 C470 315 552 315 590 302', { x: 50, y: 21, scale: 3.0 })
    }
  },
  {
    code: 'SHOULDER', marker: '22', label: 'Shoulder length', shortLabel: 'Shoulder', type: 'length',
    layout: {
      FRONT: view({ x: 700, y: 350 }, 'M523 319 C585 323 646 337 699 351', { x: 63, y: 23, scale: 2.7 }),
      // Starter only. This is intentionally independent from FRONT and must be
      // calibrated against the selected BACK avatar image by the administrator.
      BACK: view({ x: 700, y: 350 }, 'M523 319 C585 323 646 337 699 351', { x: 63, y: 23, scale: 2.7 })
    }
  },
  {
    code: 'UPPER_CHEST', marker: '14', label: 'Upper chest / across chest', shortLabel: 'Upper chest', type: 'width',
    layout: {
      FRONT: view({ x: 300, y: 370 }, 'M370 372 C438 362 580 362 650 372', { x: 50, y: 24.5, scale: 2.65 })
    }
  },
  {
    code: 'HIGH_BUST', marker: '3', label: 'Upper bust / first bust circumference', shortLabel: 'Upper bust', type: 'circumference', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 338, y: 407 }, 'M351 406 C420 395 600 395 672 406', { x: 50, y: 27, scale: 2.55 }),
      SIDE: view({ x: 690, y: 412 }, 'M450 410 C507 403 583 407 640 421', { x: 58, y: 27, scale: 2.55 })
    }
  },
  {
    code: 'BUST', marker: '4', label: 'Bust circumference', shortLabel: 'Bust', type: 'circumference', profileLabels: { adult_male: 'Chest circumference', teen_male: 'Chest circumference', child_male: 'Chest circumference', child_female: 'Chest circumference' }, profileShortLabels: { adult_male: 'Chest', teen_male: 'Chest', child_male: 'Chest', child_female: 'Chest' },
    layout: {
      FRONT: view({ x: 716, y: 462 }, 'M341 461 C427 452 598 452 688 461', { x: 50, y: 31, scale: 2.45 }),
      SIDE: view({ x: 710, y: 468 }, 'M438 463 C500 452 603 455 666 468', { x: 61, y: 31, scale: 2.45 })
    }
  },
  {
    code: 'UNDERBUST', marker: '5', label: 'Underbust circumference', shortLabel: 'Underbust', type: 'circumference', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 340, y: 518 }, 'M354 517 C430 511 590 511 667 517', { x: 50, y: 35, scale: 2.45 }),
      SIDE: view({ x: 685, y: 520 }, 'M447 518 C500 511 585 513 638 522', { x: 58, y: 35, scale: 2.45 })
    }
  },
  {
    code: 'SHOULDER_TO_BUST_APEX', marker: '15', label: 'Shoulder / neck point to bust apex', shortLabel: 'Bust height', type: 'length', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 720, y: 410 }, 'M626 334 C618 372 608 421 596 462', { x: 60, y: 27, scale: 2.55 })
    }
  },
  {
    code: 'FRONT_WAIST_LENGTH', marker: '6', label: 'Front waist length', shortLabel: 'Front waist', type: 'length',
    layout: {
      FRONT: view({ x: 672, y: 584 }, 'M655 345 C646 420 642 511 634 632', { x: 58, y: 39, scale: 2.35 }),
      SIDE: view({ x: 670, y: 585 }, 'M585 349 C600 431 601 520 580 630', { x: 57, y: 40, scale: 2.35 })
    }
  },
  {
    code: 'WAIST', marker: '7', label: 'Waist circumference', shortLabel: 'Waist', type: 'circumference',
    layout: {
      FRONT: view({ x: 340, y: 635 }, 'M382 630 C458 619 570 619 645 630', { x: 50, y: 42, scale: 2.35 }),
      SIDE: view({ x: 410, y: 630 }, 'M438 626 C492 618 550 620 594 629', { x: 52, y: 42, scale: 2.35 }),
      BACK: view({ x: 340, y: 635 }, 'M382 630 C456 619 568 619 644 630', { x: 50, y: 42, scale: 2.35 })
    }
  },
  {
    code: 'HIP', marker: '8', label: 'Hip circumference', shortLabel: 'Hip', type: 'circumference',
    layout: {
      FRONT: view({ x: 730, y: 760 }, 'M350 754 C448 770 579 770 678 754', { x: 50, y: 50, scale: 2.25 }),
      SIDE: view({ x: 380, y: 752 }, 'M398 744 C455 761 527 764 585 750', { x: 45, y: 50, scale: 2.2 }),
      BACK: view({ x: 720, y: 760 }, 'M354 754 C448 768 578 768 674 754', { x: 50, y: 50, scale: 2.25 })
    }
  },
  {
    code: 'THIGH', marker: '9', label: 'Thigh circumference', shortLabel: 'Thigh', type: 'circumference',
    layout: {
      FRONT: view({ x: 300, y: 860 }, 'M341 857 C388 850 443 850 489 857', { x: 42, y: 57, scale: 2.15 }),
      SIDE: view({ x: 385, y: 865 }, 'M421 858 C466 850 523 855 563 866', { x: 48, y: 57, scale: 2.1 }),
      BACK: view({ x: 300, y: 860 }, 'M350 858 C395 850 449 850 493 858', { x: 42, y: 57, scale: 2.15 })
    }
  },
  {
    code: 'UPPER_ARM_CIRC', marker: '16', label: 'Upper arm circumference', shortLabel: 'Upper arm', type: 'circumference',
    layout: {
      FRONT: view({ x: 775, y: 455 }, 'M700 452 C726 447 752 449 775 456', { x: 72, y: 30, scale: 2.45 }),
      SIDE: view({ x: 730, y: 455 }, 'M622 451 C646 446 671 449 692 456', { x: 65, y: 30, scale: 2.45 }),
      BACK: view({ x: 780, y: 455 }, 'M690 451 C716 447 744 449 770 456', { x: 70, y: 30, scale: 2.45 })
    }
  },
  {
    code: 'ELBOW_CIRC', marker: '17', label: 'Elbow circumference', shortLabel: 'Elbow', type: 'circumference',
    layout: {
      FRONT: view({ x: 800, y: 585 }, 'M726 585 C745 580 765 581 783 587', { x: 74, y: 39, scale: 2.35 }),
      SIDE: view({ x: 745, y: 585 }, 'M630 584 C650 579 671 581 689 587', { x: 66, y: 39, scale: 2.35 }),
      BACK: view({ x: 795, y: 585 }, 'M711 584 C731 579 752 581 772 587', { x: 73, y: 39, scale: 2.35 })
    }
  },
  {
    code: 'WRIST_CIRC', marker: '18', label: 'Wrist circumference', shortLabel: 'Wrist', type: 'circumference',
    layout: {
      FRONT: view({ x: 790, y: 747 }, 'M707 742 C723 738 739 739 753 744', { x: 72, y: 49, scale: 2.3 }),
      SIDE: view({ x: 720, y: 748 }, 'M595 744 C611 740 626 741 640 746', { x: 62, y: 49, scale: 2.3 }),
      BACK: view({ x: 790, y: 746 }, 'M700 742 C716 738 733 739 748 744', { x: 72, y: 49, scale: 2.3 })
    }
  },
  {
    code: 'SLEEVE_LENGTH', marker: '10', label: 'Sleeve / arm length', shortLabel: 'Sleeve length', type: 'length',
    layout: {
      FRONT: view({ x: 787, y: 585 }, 'M692 351 C728 458 754 575 717 754', { x: 70, y: 39, scale: 2.35 }),
      SIDE: view({ x: 710, y: 585 }, 'M592 352 C620 457 634 577 601 754', { x: 61, y: 39, scale: 2.3 }),
      BACK: view({ x: 790, y: 585 }, 'M690 350 C724 458 748 575 714 754', { x: 70, y: 39, scale: 2.35 })
    }
  },
  {
    code: 'SHOULDER_TO_SHOULDER', marker: '19', label: 'Shoulder to shoulder', shortLabel: 'Shoulder width', type: 'width',
    layout: {
      BACK: view({ x: 710, y: 350 }, 'M352 350 C437 335 585 335 674 350', { x: 50, y: 23, scale: 2.7 })
    }
  },
  {
    code: 'ACROSS_BACK', marker: '20', label: 'Across back / back width', shortLabel: 'Across back', type: 'width',
    layout: {
      BACK: view({ x: 322, y: 420 }, 'M365 418 C438 408 584 408 657 418', { x: 50, y: 27, scale: 2.55 })
    }
  },
  {
    code: 'BACK_WAIST_LENGTH', marker: '21', label: 'Back neck to waist', shortLabel: 'Back waist length', type: 'length',
    layout: {
      BACK: view({ x: 700, y: 510 }, 'M515 315 C514 405 512 516 510 630', { x: 50, y: 34, scale: 2.4 })
    }
  },
  {
    code: 'ARMHOLE_DEPTH', marker: '22', label: 'Armhole depth', shortLabel: 'Armhole depth', type: 'length',
    layout: {
      BACK: view({ x: 735, y: 430 }, 'M672 350 C682 380 684 410 678 438', { x: 66, y: 28, scale: 2.55 }),
      SIDE: view({ x: 705, y: 430 }, 'M602 352 C612 380 615 411 610 440', { x: 61, y: 28, scale: 2.55 })
    }
  },
  {
    code: 'INSEAM', marker: '11', label: 'Inseam', shortLabel: 'Inseam', type: 'length',
    layout: {
      FRONT: view({ x: 490, y: 1036 }, 'M511 796 C508 997 505 1210 496 1392', { x: 50, y: 69, scale: 1.9 }),
      SIDE: view({ x: 575, y: 1035 }, 'M520 797 C520 1001 517 1211 511 1390', { x: 51, y: 69, scale: 1.9 })
    }
  },
  {
    code: 'OUTSEAM', marker: '12', label: 'Outside leg / waist to floor', shortLabel: 'Outseam', type: 'length',
    layout: {
      FRONT: view({ x: 658, y: 1036 }, 'M646 634 C675 846 657 1134 624 1392', { x: 63, y: 69, scale: 1.9 }),
      SIDE: view({ x: 382, y: 1035 }, 'M449 631 C424 850 438 1137 466 1391', { x: 44, y: 69, scale: 1.9 }),
      BACK: view({ x: 660, y: 1035 }, 'M650 634 C674 846 658 1134 626 1392', { x: 63, y: 69, scale: 1.9 })
    }
  },
  {
    code: 'HEIGHT', marker: '13', label: 'Full height', shortLabel: 'Height', type: 'length',
    layout: {
      FRONT: view({ x: 915, y: 772 }, 'M900 80 L900 1475', { x: 50, y: 50, scale: 1.05 }),
      SIDE: view({ x: 810, y: 770 }, 'M802 80 L802 1470', { x: 50, y: 50, scale: 1.05 }),
      BACK: view({ x: 905, y: 770 }, 'M895 80 L895 1475', { x: 50, y: 50, scale: 1.05 })
    }
  }
];

const RUSSIAN_GUIDE_ADDITIONS = [
  {
    code: 'BUST_2', marker: '23', label: 'Bust circumference 2', shortLabel: 'Bust 2',
    type: 'circumference', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 720, y: 438 }, 'M345 438 C430 430 595 430 682 438', { x: 50, y: 29, scale: 2.5 }),
      SIDE: view({ x: 710, y: 442 }, 'M440 440 C500 432 605 434 666 444', { x: 60, y: 29, scale: 2.5 })
    }
  },
  {
    code: 'CHEST_WIDTH_2', marker: '24', label: 'Chest width 2', shortLabel: 'Chest width 2',
    type: 'width', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 720, y: 454 }, 'M410 454 L620 454', { x: 50, y: 30, scale: 2.5 })
    }
  },
  {
    code: 'BUST_POINT_DISTANCE', marker: '25', label: 'Bust-point distance', shortLabel: 'Bust centres',
    type: 'width', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 702, y: 465 }, 'M455 462 L568 462', { x: 50, y: 31, scale: 2.55 })
    }
  },
  {
    code: 'BACK_WAIST_LENGTH_PLUMB', marker: '26', label: 'Back waist length — plumb', shortLabel: 'Back waist plumb',
    type: 'length',
    layout: {
      BACK: view({ x: 702, y: 505 }, 'M545 320 L545 630', { x: 52, y: 34, scale: 2.35 })
    }
  },
  {
    code: 'BACK_ARMHOLE_HEIGHT', marker: '27', label: 'Back armhole height', shortLabel: 'Back armhole height',
    type: 'length',
    layout: {
      BACK: view({ x: 740, y: 420 }, 'M650 332 L650 470', { x: 64, y: 28, scale: 2.55 })
    }
  },
  {
    code: 'SHOULDER_HEIGHT_OBLIQUE', marker: '28', label: 'Oblique shoulder height', shortLabel: 'Shoulder height oblique',
    type: 'length',
    layout: {
      BACK: view({ x: 720, y: 505 }, 'M510 630 L675 350', { x: 59, y: 34, scale: 2.35 })
    }
  },
  {
    code: 'FRONT_SHOULDER_HEIGHT_OBLIQUE', marker: '29', label: 'Front oblique shoulder height', shortLabel: 'Front shoulder oblique',
    type: 'length', appliesTo: ['adult_female', 'teen_female'],
    layout: {
      FRONT: view({ x: 735, y: 420 }, 'M590 462 L690 350', { x: 63, y: 28, scale: 2.55 })
    }
  },
  {
    code: 'BACK_SHOULDER_HEIGHT', marker: '30', label: 'Back shoulder height', shortLabel: 'Back shoulder height',
    type: 'length',
    layout: {
      BACK: view({ x: 730, y: 500 }, 'M512 630 L675 350', { x: 59, y: 34, scale: 2.35 })
    }
  },
  {
    code: 'FRONT_SHOULDER_HEIGHT', marker: '31', label: 'Front shoulder height', shortLabel: 'Front shoulder height',
    type: 'length',
    layout: {
      FRONT: view({ x: 735, y: 505 }, 'M690 350 L690 630', { x: 66, y: 34, scale: 2.35 })
    }
  },
  {
    code: 'GARMENT_LENGTH', marker: '32', label: 'Garment / body reference length', shortLabel: 'Garment length',
    type: 'length',
    layout: {
      BACK: view({ x: 760, y: 900 }, 'M510 310 L510 1420', { x: 50, y: 58, scale: 1.65 })
    }
  },
  {
    code: 'WAIST_TO_FLOOR_FRONT', marker: '33', label: 'Waist-to-floor front', shortLabel: 'Waist-floor front',
    type: 'length',
    layout: {
      FRONT: view({ x: 730, y: 1030 }, 'M510 630 L510 1460', { x: 50, y: 67, scale: 1.8 })
    }
  },
  {
    code: 'WAIST_TO_FLOOR_BACK', marker: '34', label: 'Waist-to-floor back', shortLabel: 'Waist-floor back',
    type: 'length',
    layout: {
      BACK: view({ x: 730, y: 1030 }, 'M510 630 L510 1460', { x: 50, y: 67, scale: 1.8 })
    }
  },
  {
    code: 'SIDE_HEIGHT', marker: '35', label: 'Waist-to-underarm side height', shortLabel: 'Side height',
    type: 'length',
    layout: {
      SIDE: view({ x: 700, y: 535 }, 'M585 625 L615 450', { x: 59, y: 36, scale: 2.4 })
    }
  },
  {
    code: 'KNEE_CIRC', marker: '36', label: 'Knee circumference', shortLabel: 'Knee',
    type: 'circumference',
    layout: {
      FRONT: view({ x: 300, y: 1040 }, 'M350 1040 C395 1034 448 1034 490 1040', { x: 42, y: 68, scale: 2.0 }),
      SIDE: view({ x: 380, y: 1040 }, 'M420 1040 C465 1034 520 1035 558 1042', { x: 48, y: 68, scale: 2.0 }),
      BACK: view({ x: 300, y: 1040 }, 'M355 1040 C400 1034 450 1034 492 1040', { x: 42, y: 68, scale: 2.0 })
    }
  },
  {
    code: 'CALF_CIRC', marker: '37', label: 'Calf circumference', shortLabel: 'Calf',
    type: 'circumference',
    layout: {
      FRONT: view({ x: 300, y: 1215 }, 'M355 1215 C395 1209 438 1209 475 1215', { x: 41, y: 79, scale: 1.85 }),
      SIDE: view({ x: 380, y: 1215 }, 'M430 1215 C465 1209 507 1210 540 1216', { x: 47, y: 79, scale: 1.85 }),
      BACK: view({ x: 300, y: 1215 }, 'M360 1215 C400 1209 440 1209 478 1215', { x: 41, y: 79, scale: 1.85 })
    }
  },
  {
    code: 'FOOT_CIRC', marker: '38', label: 'Foot / instep circumference', shortLabel: 'Foot',
    type: 'circumference',
    layout: {
      SIDE: view({ x: 690, y: 1405 }, 'M470 1405 C500 1398 545 1400 575 1408', { x: 52, y: 91, scale: 1.7 })
    }
  },
  {
    code: 'SITTING_HEIGHT', marker: '39', label: 'Sitting height', shortLabel: 'Sitting height',
    type: 'length',
    layout: {
      SIDE: view({ x: 690, y: 780 }, 'M450 630 L450 900', { x: 45, y: 51, scale: 2.1 })
    }
  }
];

const MEASUREMENT_DISPLAY_CODES = Object.freeze({
  NECK: 'NC',
  SHOULDER: 'SH',

  // Related bust-circumference series: first / second / third bust.
  HIGH_BUST: 'BC1',
  BUST_2: 'BC2',
  BUST: 'BC3',

  // Related chest-width series.
  UPPER_CHEST: 'CW1',
  CHEST_WIDTH_2: 'CW2',

  UNDERBUST: 'UB',
  BUST_POINT_DISTANCE: 'BP',
  SHOULDER_TO_BUST_APEX: 'BH',

  FRONT_WAIST_LENGTH: 'FW',
  WAIST: 'WC',
  HIP: 'HC',
  THIGH: 'TC',
  KNEE_CIRC: 'KC',
  CALF_CIRC: 'CC',
  FOOT_CIRC: 'FC',

  UPPER_ARM_CIRC: 'UA',
  ELBOW_CIRC: 'EC',
  WRIST_CIRC: 'WR',
  SLEEVE_LENGTH: 'SL',

  SHOULDER_TO_SHOULDER: 'SW',
  ACROSS_BACK: 'BW',

  // Related back-waist-length variants.
  BACK_WAIST_LENGTH: 'BL1',
  BACK_WAIST_LENGTH_PLUMB: 'BL2',

  ARMHOLE_DEPTH: 'AD',
  BACK_ARMHOLE_HEIGHT: 'AH',

  // Related oblique shoulder-height variants.
  SHOULDER_HEIGHT_OBLIQUE: 'OH1',
  FRONT_SHOULDER_HEIGHT_OBLIQUE: 'OH2',

  BACK_SHOULDER_HEIGHT: 'SB',
  FRONT_SHOULDER_HEIGHT: 'SF',

  GARMENT_LENGTH: 'GL',

  // Related waist-to-floor series: front / side / back.
  WAIST_TO_FLOOR_FRONT: 'WF1',
  OUTSEAM: 'WF2',
  WAIST_TO_FLOOR_BACK: 'WF3',

  SIDE_HEIGHT: 'SI',
  INSEAM: 'IN',
  HEIGHT: 'HT',
  SITTING_HEIGHT: 'ST'
});

const MEASUREMENT_VIEWS = Object.freeze(['FRONT', 'SIDE', 'BACK']);

const MEASUREMENT_GUIDE_DEFAULTS = Object.freeze({
  transform: Object.freeze({ dx: 0, dy: 0, sx: 1, sy: 1 }),
  curveOffset: Object.freeze({ x: 0, y: 0 })
});

const DEFAULT_MEASUREMENTS = buildCanonicalMeasurementDefinitions({
  baseMeasurements: BASE_MEASUREMENTS,
  russianGuideAdditions: RUSSIAN_GUIDE_ADDITIONS,
  displayCodes: MEASUREMENT_DISPLAY_CODES,
  russianGuide: RUSSIAN_MEASUREMENT_GUIDE
});

const DEFAULT_VIEW_CONFIG = buildCanonicalDefaultViewConfig({
  definitions: DEFAULT_MEASUREMENTS,
  avatarProfiles: AVATAR_PROFILES,
  defaultProfileId: AVATAR_TAXONOMY.ADULT_FEMALE
});

const AVATAR_AREAS = buildCanonicalAvatarAreas({
  definitions: DEFAULT_MEASUREMENTS,
  avatarProfiles: AVATAR_PROFILES,
  avatarTaxonomy: AVATAR_TAXONOMY,
  legacyToCanonical: LEGACY_TO_CANONICAL,
  canonicalToLegacy: CANONICAL_TO_LEGACY,
  viewOrder: VIEW_MEASUREMENT_ORDER,
  views: MEASUREMENT_VIEWS,
  guideDefaults: MEASUREMENT_GUIDE_DEFAULTS
});

const MEASUREMENT_POSITIONS = [
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

const MEASUREMENT_CHART_VERSION = 'measurement-chart-v2-governed';

const DEFAULT_MEASUREMENT_SIZE_SYSTEMS = [
  { code: 'ALPHA', label: 'Alpha' },
  { code: 'UK', label: 'UK' },
  { code: 'US', label: 'US' },
  { code: 'EU', label: 'EU' }
];

const DEFAULT_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'];

const FIT_PROFILE_VERSION = 'fit-profile-v1';

const FIT_PRIORITY_CODES = [
  'CRITICAL',
  'IMPORTANT',
  'SECONDARY',
  'NOT_RELEVANT'
];

const MEASUREMENT_CHART_APPROVAL_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SUPERSEDED'
];

const SYSTEM_ALIASES = {
  ALPHA: 'ALPHA',
  LETTER: 'ALPHA',
  INTERNATIONAL: 'ALPHA',
  WORKSPACEVARIANT: 'ALPHA',
  UKREFERENCE: 'UK',
  USREFERENCE: 'US',
  EUREFERENCE: 'EU',
  UK: 'UK',
  US: 'US',
  EU: 'EU',
  FR: 'FR'
};

const SURFACE_VISIBILITY_VERSION = '2026-08-25-cleanup-wave-2';

const SURFACE_VISIBILITY_STORAGE_KEY = 'perfectfit_surface_visibility_registry_v1';

const SURFACE_VISIBILITY_REGISTRY = [
  { page: 'Home', view: 'home', id: 'hero-carousel', label: 'Homepage Hero Carousel', componentKey: 'HeroCarousel' },
  { page: 'Home', view: 'home', id: 'orbital-featured', label: 'Signature Collections Carousel', componentKey: 'SignatureOrbitCarouselA' },
  { page: 'Home', view: 'home', id: 'home-maker-transition', label: 'Home Maker Transition', componentKey: 'HomeMakerTransition' },
  { page: 'Home', view: 'home', id: 'customer-testimonials', label: 'Customer Testimonials', componentKey: 'TestimonialCarousel' },
  { page: 'Patterns', view: 'patterns', id: 'gallery', label: 'Pattern Library / Catalogue', componentKey: 'DynamicGallery' },
  { page: 'Orders', view: 'orders', id: 'my-orders', label: 'My Orders', componentKey: 'MyOrdersSection' },
  { page: 'Community', view: 'community', id: 'creations-feedback', label: 'Creations And Feedback', componentKey: 'CreationsAndFeedback' },
  { page: 'Blog', view: 'blog', id: 'creator-community-blog', label: 'Community Board / Blog', componentKey: 'CreatorBlog' },
  { page: 'Fit / Find My Size', view: 'fit', id: 'calculator', label: 'Find My Size', componentKey: 'MannequinGuide' },
  { page: 'Workspace', view: 'workspace', id: 'workspace', label: 'Workspace Shell', componentKey: 'Workspace' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.overview', label: 'Overview', componentKey: 'OverviewModule' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.projectJournal', label: 'Project Journal', componentKey: 'ProjectJournalModule' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.media', label: 'Media', componentKey: 'WorkspaceMedia' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.patternLibrary', label: 'Pattern Library', componentKey: 'PatternLibraryModule' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.measurementChart', label: 'Measurement Chart', componentKey: 'MeasurementChartModule' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.sewing', label: 'Sewing', componentKey: 'SewingModule' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.techPack', label: 'Tech Pack', componentKey: 'TechPackModule' },
  { page: 'Workspace', view: 'workspace', id: 'workspace.changeHistory', label: 'Change History', componentKey: 'ChangeHistoryModule' },
  { page: 'Academy', view: 'academy', id: 'perfectfit-library', label: 'Perfect Fit Library', componentKey: 'EditorialAcademy' },
  { page: 'About', view: 'about', id: 'perfectfit-specification', label: 'Legacy Size Guide', componentKey: 'PerfectFitStandards', lockedDisabled: true },
  { page: 'FAQ', view: 'faq', id: 'perfectfit-faq', label: 'Perfect Fit FAQ', componentKey: 'PerfectFitFaq' },
  { page: 'Global', view: 'global', id: 'global.messages', label: 'Messages Floating Launcher', componentKey: 'MessageCenterWidget' },
  { page: 'Global', view: 'global', id: 'global.sizeConversion', label: 'Size Conversion Floating Launcher', componentKey: 'SizeConversionMatrixWidget' },
  { page: 'Global', view: 'global', id: 'global.footer', label: 'Footer', componentKey: 'Footer' },
  { page: 'Global', view: 'global', id: 'global.newsletter', label: 'Footer Newsletter', componentKey: 'StayInspiredNewsletter' },
  { page: 'Global', view: 'global', id: 'materials-action', label: 'Materials Explore Action', componentKey: 'ActionOnly' },
  { page: 'Global', view: 'global', id: 'design-consultation-action', label: 'Design Consultation Action', componentKey: 'ActionOnly' },
  { page: 'Global', view: 'global', id: 'role-based-dynamic-layout', label: 'Workspace2 Legacy Reference', componentKey: 'DynamicLayout', lockedDisabled: true },
  { page: 'Global', view: 'admin', id: 'administrator-console', label: 'Administrator Console', componentKey: 'AdminControlPanel' }
];

const DEFAULT_HIDDEN_IDS = new Set([
  'role-based-dynamic-layout',
  'perfectfit-specification'
]);

const WORKSPACE_NODE_SURFACE_IDS = {
  variant: 'workspace.overview',
  projectJournal: 'workspace.projectJournal',
  media: 'workspace.media',
  patternLibrary: 'workspace.patternLibrary',
  sizeSet: 'workspace.measurementChart',
  sewing: 'workspace.sewing',
  techPack: 'workspace.techPack',
  techpack: 'workspace.techPack',
  changeHistory: 'workspace.changeHistory'
};

export const PERFECTFIT_LOCALE_STORAGE_KEY = 'perfectfit_locale';

const toArray = (value) => (Array.isArray(value) ? value : []);

const keyToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

const withEnglish = (target, key, value) => {
  if (!key || value === undefined || value === null || target[key]) return;
  target[key] = String(value);
};

const mergeLocalePacks = (...packs) => {
  const merged = {};

  packs.forEach((pack) => {
    Object.entries(pack || {}).forEach(([locale, values]) => {
      merged[locale] = {
        ...(merged[locale] || {}),
        ...(values || {})
      };
    });
  });

  return merged;
};

const navigationGroups = [
  { code: 'SHOWROOM_PATTERNS', labelKey: 'nav.group.showroomPatterns', order: 10 },
  { code: 'FIT_SIZING', labelKey: 'nav.group.fitSizing', order: 15 },
  { code: 'DESIGN_SANDBOX', labelKey: 'nav.group.designSandbox', order: 20 },
  { code: 'SUPPORT_GUIDANCE', labelKey: 'nav.group.supportGuidance', order: 30 }
];

const navigationItems = [
  {
    id: 'patterns',
    groupCode: 'SHOWROOM_PATTERNS',
    labelKey: 'nav.item.patterns.label',
    descriptionKey: 'nav.item.patterns.description',
    targetView: 'patterns',
    order: 10
  },
  {
    id: 'orders',
    groupCode: 'SHOWROOM_PATTERNS',
    labelKey: 'nav.item.orders.label',
    descriptionKey: 'nav.item.orders.description',
    targetView: 'orders',
    order: 20
  },
  {
    id: 'community',
    groupCode: 'SHOWROOM_PATTERNS',
    labelKey: 'nav.item.community.label',
    descriptionKey: 'nav.item.community.description',
    targetView: 'community',
    order: 30
  },
  {
    id: 'blog',
    groupCode: 'SHOWROOM_PATTERNS',
    labelKey: 'nav.item.blog.label',
    descriptionKey: 'nav.item.blog.description',
    targetView: 'blog',
    order: 40
  },
  {
    id: 'fit',
    groupCode: 'FIT_SIZING',
    labelKey: 'nav.item.fit.label',
    descriptionKey: 'nav.item.fit.description',
    targetView: 'fit',
    targetTool: 'fitting-room-sizer',
    order: 10
  },
  {
    id: 'workspace',
    groupCode: 'DESIGN_SANDBOX',
    labelKey: 'nav.item.workspace.label',
    descriptionKey: 'nav.item.workspace.description',
    targetView: 'workspace',
    order: 10
  },
  {
    id: 'materials',
    groupCode: 'DESIGN_SANDBOX',
    labelKey: 'nav.item.materials.label',
    descriptionKey: 'nav.item.materials.description',
    action: 'openMaterials',
    order: 20
  },
  {
    id: 'academy',
    groupCode: 'DESIGN_SANDBOX',
    labelKey: 'nav.item.academy.label',
    descriptionKey: 'nav.item.academy.description',
    targetView: 'academy',
    order: 40
  },
  {
    id: 'faq',
    groupCode: 'SUPPORT_GUIDANCE',
    labelKey: 'nav.item.faq.label',
    descriptionKey: 'nav.item.faq.description',
    targetView: 'faq',
    order: 10
  },
  {
    id: 'consultation',
    groupCode: 'SUPPORT_GUIDANCE',
    labelKey: 'nav.item.consultation.label',
    descriptionKey: 'nav.item.consultation.description',
    action: 'openConsultation',
    order: 20
  }
];

const COMPONENT_UI_METADATA = {
  catalogSidebar: {
    accessoryCategories: [
  { id: 'accessories', label: 'All Accessories' },
  { id: 'bags', label: 'Bags' },
  { id: 'belts', label: 'Belts' },
  { id: 'hats', label: 'Hats' },
  { id: 'scarves', label: 'Scarves' },
  { id: 'fabric-tools', label: 'Fabric Tools' }
],
    difficultyFilters: [
  { id: 'Beginner', label: 'Beginner' },
  { id: 'Intermediate', label: 'Intermediate' },
  { id: 'Advanced', label: 'Advanced' }
],
    priceRangeFilters: [
  { id: 'under-15', label: 'Under $15' },
  { id: '15-20', label: '$15–$20' },
  { id: 'over-20', label: 'Over $20' }
],
    ratingFilters: [
  { id: '5-star', label: '5 stars' },
  { id: '4-5-up', label: '4.5+ stars' },
  { id: '4-up', label: '4+ stars' }
],
  },
  fabricYardage: {
    fabricWidthPresets: [
  { value: 36, label: '36" (90cm)', desc: 'Narrow lace, silks, or vintage loom' },
  { value: 44, label: '44" (110cm)', desc: 'Standard quilting cotton, silks & satins' },
  { value: 54, label: '54" (137cm)', desc: 'Standard wools, velvets & heavy linens' },
  { value: 60, label: '60" (150cm)', desc: 'Aviation wools, coating & wide knits' },
],
  },
  onboarding: {
    walkthroughSteps: [
  {
    title: "✨ Perfect Fit Operations Onboarding",
    desc: "Welcome to the Perfect Fit Bureau guided tour! We'll show you how to master our core professional features: the Video Time & Motion Study (Industrial SAM calculation) and the Fabric Inventory Stock Ledger.",
    tab: "projects",
    highlightId: "consolidated-collaborator-workspace"
  },
  {
    title: "📊 Step 1: Video Time & Motion Study",
    desc: "We are switching to the Sewing Timer tab. Here you will find the advanced Time & Motion Study workspace used by tailoring industrial engineers to analyze stitching speed and operator efficiency.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "sewing-room-view-tabs"
  },
  {
    title: "🎥 Step 2: Telemetry Footage Sources",
    desc: "Use this dropdown selector to load high-definition footage of actual tailoring motions. You can select different operations like sleeve set-ins, hems, or pocket constructions to begin analysis.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "video-source-selector"
  },
  {
    title: "⏱️ Step 3: Playhead & Slow-Motion Precision",
    desc: "Examine complex stitch joins frame-by-frame. Adjust the playback speed to 0.25x or 0.5x slow-motion to pinpoint operator hand delay nodes or alignment bottlenecks.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "player-viewport-container"
  },
  {
    title: "🎯 Step 4: Instant Timestamp Triggers",
    desc: "Capture cycle timestamps with precision. Click the T1 (Start) and T2 (Finish) hotkey-buttons as you watch the footage to record the raw cycle durations of the stitching element.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "timestamp-shortcut-triggers"
  },
  {
    title: "🧮 Step 5: Industrial SAM Calculator",
    desc: "Enter the Performance Rating (%) and Personal, Fatigue & Delay (PF&D) Allowance (%) to compute the Standard Allowed Minutes (SAM) instantly. This syncs with our live production database.",
    tab: "timer",
    viewMode: "motionStudy",
    highlightId: "ops-study-grid-scroller"
  },
  {
    title: "🧵 Step 6: Textile Stock Ledger",
    desc: "Let's head over to the Supplies & Suppliers tab. This is where you manage textile rolls, fabric weights (GSM), in-stock levels, and supplier lead times.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "tab-ctrl-supply"
  },
  {
    title: "📊 Step 7: Fiber Stock Metrics",
    desc: "At a glance, monitor Total Active Rolls, critical Low Stock Warnings, and Consolidated Yardage across all organic wool, silk, linen, and denim fabrics in the warehouse.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "inventory-metrics-cards"
  },
  {
    title: "📝 Step 8: Active Roll Stock Ledger",
    desc: "View detailed specifications of each active roll. Adjust stock levels instantly by clicking +5 or -5 yard deltas, or check which fabrics have critical warnings.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "inventory-ledger-table"
  },
  {
    title: "📥 Step 9: Receiving Dock",
    desc: "When new textile shipments arrive, use the Receiving Dock form to scan or register newly received material names, swatch colors, yardage, and cost-per-yard directly.",
    tab: "supply",
    subTab: "inventory",
    highlightId: "receiving-dock-sidebar"
  },
  {
    title: "🏆 Walkthrough Complete!",
    desc: "Congratulations! You have successfully completed the Perfect Fit Operator onboarding guide. You are now fully prepared to manage sewing operations, audit B2B supply lines, and conduct video time studies.",
    tab: "projects",
    highlightId: "consolidated-collaborator-workspace"
  }
],
  },
  sewingSession: {
    predefinedColors: [
  { name: 'Sage Green', hex: '#8A9A86' },
  { name: 'Goldenrod Yellow', hex: '#E3A857' },
  { name: 'Indigo Blue', hex: '#1E293B' },
  { name: 'Blush Pink', hex: '#E8C3C9' },
  { name: 'Crimson Red', hex: '#991B1B' },
  { name: 'Forest Green', hex: '#064E3B' },
  { name: 'Oatmeal Natural', hex: '#eae1d4' },
  { name: 'Ivory Pearl', hex: '#FDFBF7' },
  { name: 'Midnight Black', hex: '#111827' },
  { name: 'Slate Gray', hex: '#4B5563' },
  { name: 'Warm Brown', hex: '#78350F' },
  { name: 'Plum Purple', hex: '#581C87' }
],
    materialPresets: [
  'Linen', 'Cotton', 'Silk', 'Wool', 'Denim',
  'Satin', 'Velvet', 'Rayon', 'Corduroy', 'Gabardine'
],
  },
  imageAssetStudio: {
    sizePresets: [
  { id: "product", label: "Product 4:5", width: 1200, height: 1500 },
  { id: "hero", label: "Hero 16:9", width: 1920, height: 1080 },
  { id: "article", label: "Article 3:2", width: 1800, height: 1200 },
  { id: "landscape", label: "Landscape 4:3", width: 1600, height: 1200 },
  { id: "square", label: "Square 1:1", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait 9:16", width: 1080, height: 1920 },
],
    formatOptions: [
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png", label: "PNG" },
  { value: "image/webp", label: "WEBP" },
],
    defaultWorkflowProfiles: [
  {
    id: "product-card",
    label: "Product card",
    description: "Catalog cards and primary product media.",
    width: 1200,
    height: 1500,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 92,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "product-gallery",
    label: "Product gallery",
    description: "Detail gallery image with portrait crop.",
    width: 1400,
    height: 1750,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 92,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "hero-banner",
    label: "Hero banner",
    description: "Home hero and section sliders.",
    width: 1920,
    height: 1080,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "blog-cover",
    label: "Blog cover",
    description: "Blog article lead image.",
    width: 1800,
    height: 1200,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90,
    backgroundColor: "#f4f1eb",
  },
  {
    id: "content-block",
    label: "Content block",
    description: "Cards, promos, and rich content sections.",
    width: 1600,
    height: 1200,
    fitMode: "cover",
    mimeType: "image/jpeg",
    quality: 90,
    backgroundColor: "#f4f1eb",
  },
],
  },
  patternQuickView: {
    fabricTextures: [
  {
    id: 'original',
    name: 'Original Blueprint',
    type: 'Stock Design',
    colorClass: 'bg-sand-100 border border-sand-300',
    overlayBackground: 'none',
    blendMode: 'normal',
    opacity: 0,
    filter: 'none',
    description: 'The standard curated aesthetic template from our designers.'
  },
  {
    id: 'linen',
    name: 'Belgian Woven Linen',
    type: 'Oatmeal Tweed',
    colorClass: 'bg-[#EAE1D4] border border-sand-400',
    overlayBackground: 'repeating-linear-gradient(0deg, rgba(139,115,85,0.08) 0px, rgba(139,115,85,0.08) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(90deg, rgba(139,115,85,0.08) 0px, rgba(139,115,85,0.08) 1px, transparent 1px, transparent 3px)',
    blendMode: 'multiply',
    opacity: 0.85,
    filter: 'sepia(0.18) contrast(1.05) brightness(0.98)',
    description: 'Crisp woven Belgian flax with signature linen crosshatch grain.'
  },
  {
    id: 'denim',
    name: 'Raw Indigo Twill',
    type: '11oz Denim',
    colorClass: 'bg-[#2A3E5C] border border-[#1E2E44]',
    overlayBackground: 'repeating-linear-gradient(45deg, rgba(0,40,120,0.15) 0px, rgba(0,40,120,0.15) 2px, rgba(255,255,255,0.06) 2px, rgba(255,255,255,0.06) 4px)',
    blendMode: 'color-burn',
    opacity: 0.9,
    filter: 'hue-rotate(190deg) saturate(1.4) contrast(1.15) brightness(0.85)',
    description: 'Heavy diagonal-ridge denim twill, optimal for structured seams.'
  },
  {
    id: 'crepe',
    name: 'Terracotta Crinkle Crepe',
    type: 'Double Gauze',
    colorClass: 'bg-[#C96C4E] border border-[#B3583C]',
    overlayBackground: 'radial-gradient(circle, rgba(184,80,48,0.1) 0%, transparent 60%), repeating-radial-gradient(circle, rgba(184,80,48,0.08) 0px, rgba(184,80,48,0.08) 1px, transparent 1px, transparent 4px)',
    blendMode: 'multiply',
    opacity: 0.85,
    filter: 'hue-rotate(345deg) saturate(1.3) brightness(0.95)',
    description: 'Flowy crinkled cotton crepe with organic puckers and airy drape.'
  },
  {
    id: 'satin',
    name: 'Emerald Silk Satin',
    type: 'Mulberry Silk',
    colorClass: 'bg-[#184F35] border border-[#0F3824]',
    overlayBackground: 'linear-gradient(135deg, rgba(16,124,65,0.15) 0%, rgba(255,255,255,0.3) 45%, rgba(16,65,30,0.25) 70%, rgba(255,255,255,0.1) 100%)',
    blendMode: 'overlay',
    opacity: 0.95,
    filter: 'hue-rotate(100deg) saturate(1.6) brightness(0.8) contrast(1.2)',
    description: 'High-luster mulberry silk satin with fluid shine and sleek light folds.'
  },
  {
    id: 'velvet',
    name: 'Burgundy Royal Velvet',
    type: 'Plush Pile',
    colorClass: 'bg-[#581825] border border-[#3A1018]',
    overlayBackground: 'linear-gradient(90deg, rgba(88,24,37,0.1) 0%, rgba(255,255,255,0.15) 30%, rgba(0,0,0,0.3) 75%, rgba(88,24,37,0.1) 100%)',
    blendMode: 'multiply',
    opacity: 0.9,
    filter: 'hue-rotate(320deg) saturate(1.1) brightness(0.85) contrast(1.1)',
    description: 'Rich deep-red velvet with a smooth, short pile and luxurious, light-catching sheen.'
  },
  {
    id: 'plaid',
    name: 'Highland Tartan Plaid',
    type: 'Flannel Wool',
    colorClass: 'bg-[#9B2C2C] border border-[#7B1F1F]',
    overlayBackground: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 8px, transparent 8px, transparent 16px), repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0px, rgba(0,0,0,0.1) 8px, transparent 8px, transparent 16px), repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 4px, transparent 4px, transparent 8px)',
    blendMode: 'multiply',
    opacity: 0.9,
    filter: 'hue-rotate(350deg) saturate(1.2) contrast(1.1)',
    description: 'Traditional brushed wool flannel with overlapping checkered red and dark hunter lines.'
  },
  {
    id: 'stripe',
    name: 'Classic Breton Stripe',
    type: 'Interlock Knit',
    colorClass: 'bg-[#F7F5F0] border border-[#CCCCCC]',
    overlayBackground: 'repeating-linear-gradient(0deg, #1E2E44 0px, #1E2E44 6px, transparent 6px, transparent 14px)',
    blendMode: 'multiply',
    opacity: 0.88,
    filter: 'contrast(1.05) brightness(1.02)',
    description: 'Medium-weight maritime jersey cotton displaying timeless alternating horizontal navy bars.'
  }
],
    sizeSystems: {
  patternNumericCore: {
    label: 'Pattern numeric',
    type: 'pattern',
    sizes: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22'],
    displayRange: '0-22',
    basis: 'Pattern size based on body and finished garment measurements'
  },
  patternNumericCurve: {
    label: 'Pattern numeric curve',
    type: 'pattern',
    sizes: ['14', '16', '18', '20', '22', '24', '26', '28', '30', '32'],
    displayRange: '14-32',
    basis: 'Curve pattern range based on body and finished garment measurements'
  },
  alpha: {
    label: 'Alpha',
    type: 'pattern',
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '1X', '2X', '3X', '4X', '5X', '6X'],
    displayRange: 'XXS-6X',
    basis: 'Alpha pattern size based on measurement bands'
  },
  ukReference: {
    label: 'UK reference',
    type: 'retail-reference',
    sizes: ['UK 4', 'UK 6', 'UK 8', 'UK 10', 'UK 12', 'UK 14', 'UK 16', 'UK 18', 'UK 20', 'UK 22', 'UK 24', 'UK 26', 'UK 28', 'UK 30'],
    displayRange: 'UK 4-30',
    basis: 'Retail reference only'
  },
  usReference: {
    label: 'US reference',
    type: 'retail-reference',
    sizes: ['US 0', 'US 2', 'US 4', 'US 6', 'US 8', 'US 10', 'US 12', 'US 14', 'US 16', 'US 18', 'US 20', 'US 22', 'US 24', 'US 26', 'US 28'],
    displayRange: 'US 0-28',
    basis: 'Retail reference only'
  },
  euReference: {
    label: 'EU reference',
    type: 'retail-reference',
    sizes: ['EU 32', 'EU 34', 'EU 36', 'EU 38', 'EU 40', 'EU 42', 'EU 44', 'EU 46', 'EU 48', 'EU 50', 'EU 52', 'EU 54', 'EU 56'],
    displayRange: 'EU 32-56',
    basis: 'Retail reference only'
  }
},
  },
  productDevelopmentMedia: {
    pantonePresets: [
  { name: 'Oatmeal', code: '#DBCCB5', border: 'border-sand-300', pantoneName: 'White Sand', pantoneCode: '13-0002-TCX' },
  { name: 'Burgundy', code: '#5C1A2E', border: 'border-rose-950', pantoneName: 'Biking Red', pantoneCode: '19-1650-TCX' },
  { name: 'Forest', code: '#18413B', border: 'border-emerald-950', pantoneName: 'Forest Biome', pantoneCode: '19-5414-TCX' },
  { name: 'Slate', code: '#717378', border: 'border-slate-800', pantoneName: 'Steel Gray', pantoneCode: '18-4005-TCX' },
  { name: 'Rose', code: '#B96D76', border: 'border-rose-300', pantoneName: 'Dusty Rose', pantoneCode: '18-1630-TCX' },
  { name: 'Prussian', code: '#1E243A', border: 'border-slate-900', pantoneName: 'Dress Blues', pantoneCode: '19-4024-TCX' },
  { name: 'Charcoal', code: '#1A1A1E', border: 'border-neutral-900', pantoneName: 'Dark Slate', pantoneCode: '19-3906-TCX' }
],
  },
  dynamicUiEngine: {
    defaultUiMetadata: {
  profile: {
    theme: {
      primaryColor: '#8c6239', // clay-colored bark
      secondaryColor: '#556b2f', // olive sage
      fontFamily: 'font-serif', // serif heading feel
      strikeFontSize: 'text-5xl font-serif font-black tracking-tight leading-none text-bark-950',
      proFontSize: 'text-lg font-sans font-semibold tracking-wide text-bark-800',
      backgroundColor: 'bg-[#FAF8F5]',
      accentColor: 'clay-605'
    },
    sections: [
      {
        id: "sec-header",
        type: "hero-header",
        title: "PERFECT FIT BUREAU",
        subtitle: "Curated Slow-Fashion & Custom Draping Blueprints",
        image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
        badge: "ESTABLISHED 2026",
        details: "A premium design collective dedicated to historic reconstructions, zero-waste cutting grids, and luxury French seam finishes.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-metrics",
        type: "stats-grid",
        heading: "Global Perfect Fit Impact",
        subtitle: "Real-time measurements of our sustainable fashion community",
        stats: [
          { label: "Active Tailors", value: "14,820", detail: "Registered makers drafting blueprints" },
          { label: "Sewn Garments", value: "48,200+", detail: "Finished client pieces posted globally" },
          { label: "Sustainability Score", value: "98.4%", detail: "Zero-waste linen & cotton fabric layouts" }
        ],
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-casual-welcome",
        type: "text-block",
        heading: "✨ Welcome, Slow-Fashion Enthusiast!",
        content: "We believe beautiful garments should have clean origins and custom-grade fit. Register an Account to unlock the dynamic 3D-adjacent sizing generator, direct stitch tutorial overlays, and free PDF pattern templates for casual sewers.",
        callout: "Exclusive Visitor Offer: Sign up today and get your first digital tailoring pattern graded for free.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer"],
          description: "Casual Visitors Only"
        }
      },
      {
        id: "sec-partner-perks",
        type: "checklists",
        heading: "🤝 B2B Professional Partnership Benefits",
        subtitle: "Specialist privileges for commercial design houses & master tailors",
        items: [
          "Commercial licensing rights to resell tailored physically finished products.",
          "Bulk linen and organic gabardine textile discounts directly from our verified French mills.",
          "API endpoint access for nested vector cutting grid generation systems.",
          "Co-branding features on public curated masterwork galleries."
        ],
        visibilityRule: {
          allowedRoles: ["collaborator", "administrator"],
          description: "Professional Partners Only"
        }
      },
      {
        id: "sec-bio",
        type: "text-block",
        heading: "The Artisan Creed",
        content: "Atelier is engineered for makers who believe garments should be built with architectural integrity, worn for generations, and mended with pride. Our interactive 3D-adjacent mannequin calibration ensures all listed patterns scale flawlessly across sizes 0 to 22, removing the cognitive load from pattern grading.",
        callout: "Did you know? Traditional pattern sizing wastes 20% of premium fabrics. Our dynamic nesting algorithm lowers waste to less than 4%.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-showcase",
        type: "showcase-cards",
        heading: "Perfect Fit Masterpieces",
        subtitle: "Highlighting our highest-rated blueprints this season",
        items: [
          {
            title: "Aurelia Wrap Dress",
            subtitle: "Asymmetric linen wrap with dolman sleeves",
            image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80",
            badge: "INTERMEDIATE",
            difficulty: "Medium",
            timeToSew: "6-8 Hours"
          },
          {
            title: "Perfect Fit Utility Trench",
            subtitle: "Double-breasted gabardine structured jacket",
            image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80",
            badge: "ADVANCED",
            difficulty: "High",
            timeToSew: "14-16 Hours"
          }
        ],
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-standards",
        type: "checklists",
        heading: "Our Production Quality Standards",
        subtitle: "What defines an official Perfect Fit design pattern",
        items: [
          "Interactive yardage calculator calibrated to fabric width thresholds.",
          "Complete French-seamed interior finishes with no exposed raw edges.",
          "Digital vector file layout mapping alongside printed blueprint shipping.",
          "Direct step-by-step masterclass video integrations with certified tailors."
        ],
        visibilityRule: {
          allowedRoles: ["collaborator", "administrator"],
          description: "Professional Partners Only"
        }
      }
    ]
  }
},
  },
  adminControl: {
    defaultUiMetadata: {
  profile: {
    theme: {
      primaryColor: '#8c6239',
      secondaryColor: '#556b2f',
      fontFamily: 'font-serif',
      strikeFontSize: 'text-5xl font-serif font-black tracking-tight leading-none text-bark-950',
      proFontSize: 'text-lg font-sans font-semibold tracking-wide text-bark-800',
      backgroundColor: 'bg-[#FAF8F5]',
      accentColor: 'clay-605'
    },
    sections: [
      {
        id: "sec-header",
        type: "hero-header",
        title: "PERFECT FIT BUREAU COUTURE",
        subtitle: "Curated Slow-Fashion & Custom Draping Blueprints",
        image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80",
        badge: "ESTABLISHED 2026",
        details: "A premium design collective dedicated to historic reconstructions, zero-waste cutting grids, and luxury French seam finishes.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-metrics",
        type: "stats-grid",
        heading: "Global Perfect Fit Impact",
        subtitle: "Real-time measurements of our sustainable fashion community",
        stats: [
          { label: "Active Tailors", value: "14,820", detail: "Registered makers drafting blueprints" },
          { label: "Sewn Garments", value: "48,200+", detail: "Finished client pieces posted globally" },
          { label: "Sustainability Score", value: "98.4%", detail: "Zero-waste linen & cotton fabric layouts" }
        ],
        visibilityRule: {
          allowedRoles: ["guest", "buyer", "collaborator", "administrator"],
          description: "Visible to all visitors"
        }
      },
      {
        id: "sec-casual-welcome",
        type: "text-block",
        heading: "✨ Welcome, Slow-Fashion Enthusiast!",
        content: "We believe beautiful garments should have clean origins and custom-grade fit. Register a Perfect Fit Member Account to unlock the dynamic 3D-adjacent sizing generator, direct stitch tutorial overlays, and free PDF pattern templates for casual sewers.",
        callout: "Exclusive Visitor Offer: Sign up today and get your first digital tailoring pattern graded for free.",
        visibilityRule: {
          allowedRoles: ["guest", "buyer"],
          description: "Casual Visitors Only"
        }
      },
      {
        id: "sec-partner-perks",
        type: "checklists",
        heading: "🤝 B2B Professional Partnership Benefits",
        subtitle: "Specialist privileges for commercial design houses & master tailors",
        items: [
          "Commercial licensing rights to resell tailored physically finished products.",
          "Bulk linen and organic gabardine textile discounts directly from our verified French mills.",
          "API endpoint access for nested vector cutting grid generation systems.",
          "Co-branding features on public curated masterwork galleries."
        ],
        visibilityRule: {
          allowedRoles: ["collaborator", "administrator"],
          description: "Professional Partners Only"
        }
      }
    ]
  }
},
  },
};



COMPONENT_UI_METADATA.patternDifficulty = {
  patternCard: {
    Beginner: { label: 'Beginner Friendly', description: 'Ideal for new sewists. Simple, rewarding construction.' },
    Intermediate: { label: 'Intermediate', description: 'Some shaping, curves, or detail work.' },
    Advanced: { label: 'Advanced', description: 'Sophisticated lining, precision tailoring, or complex seams.' },
    default: { label: 'Intermediate', description: 'Perfect for building core garment assembly skills.' }
  },
  quickView: {
    Beginner: { label: 'Beginner Friendly', description: 'Ideal for new sewists. Simple, rewarding construction.' },
    Intermediate: { label: 'Intermediate Draft', description: 'Requires collar assembly, curves, or clean finishes.' },
    Advanced: { label: 'Advanced Couture', description: 'Sophisticated lining, precision tailoring, or complex seams.' },
    default: { label: 'Intermediate', description: 'Perfect for building core garment assembly skills.' }
  },
  gallery: {
    Beginner: { label: 'Beginner Friendly', description: 'Perfect for beginners. Simple straight seams, direct assembly, and easy-to-sew fabrics.' },
    Intermediate: { label: 'Intermediate Draft', description: 'Requires handling curves, tailored necklines, collars, or precise seam finishes.' },
    Advanced: { label: 'Advanced Couture', description: 'Intricate couture tailoring, full body lining, hidden closures, and delicate finishes.' },
    default: { label: 'Intermediate', description: 'Refined tailoring draft that elevates core garment construction and fitting assembly.' }
  }
};

// Component registry presentation copy. Kept in canonical UI metadata so the
// registry can initialize before any dynamic workspace surfaces are rendered.
COMPONENT_UI_METADATA.componentRegistry = {
  gallery: {
    name: 'Curated Gallery Interface',
    description: 'Public design catalog displaying available patterns, difficulty grading, and interactive sewing specs.'
  },
  checkoutStore: {
    name: 'Atelier Seamless Checkout & Store Center',
    description: 'An interactive premium store experience with a live mock cart state, dynamic pattern selection summaries, and a seamless multi-stage checkout wizard.'
  },
  projectManagement: {
    name: 'Consolidated Collaborator Workspace',
    description: 'A fully operational workspace to manage projects, drafting checklists, B2B textile supplies, suppliers, and real-time sewing timers.'
  },
  inventory: {
    name: 'B2B Material & Textile Inventory Ledger',
    description: 'Premium supply chain dashboard with automatic GSM weight specs, live receiving docks, and low-yardage warnings.'
  },
  professionalDashboard: {
    name: 'Professional Partner Operations Dashboard',
    description: 'High-level aggregated portal summarizing commissioned projects, fabric expenditure metrics, and sewing session time logs.'
  },
  permissionsOverview: {
    name: 'Permissions & Access Overview Matrix',
    description: 'Comprehensive interactive security audit interface tracking authorized credential tiers, gate criteria, and sandbox policy overrides.'
  },
  analytics: {
    name: 'Workspace Auditing & Telemetry Analytics',
    description: 'Provides deep diagnostic graphs, security access denial tracing, and workflow optimization audits for administrators.'
  }
};

// Batch 05 — rendering metadata stays canonical while runtime records move behind repositories.
COMPONENT_UI_METADATA.patternMedia = {
  mediaTypes: [
    { id: 'sample', label: '📸 Finished Sample Photo', shortLabel: 'Sample Photo' },
    { id: 'sketch', label: '🎨 Technical Sketch / Flat Drawing', shortLabel: 'Technical Sketch' },
    { id: 'pattern_layout', label: '📐 Quick Pattern Draft & Layout View', shortLabel: 'Pattern Draft Layout' },
    { id: 'detail', label: '🔍 Seam & Construction Detail', shortLabel: 'Detail View' },
    { id: 'prototype', label: '🔒 Confidential Fitting Prototype', shortLabel: 'Secret Prototype' }
  ]
};

COMPONENT_UI_METADATA.catalogueRendering = {
  productCard: {
    fields: {
      title: { source: 'name', fallback: 'Perfect Fit Garment' },
      category: { source: 'category', fallback: 'Dress' },
      difficulty: { source: 'difficulty', fallback: 'Intermediate' },
      tagline: { source: 'tagline', fallback: 'Exquisite tailoring pattern' },
      description: { source: 'description', fallback: 'A timeless addition to any handmade wardrobe.' },
      primaryImage: { sources: ['primaryAsset.previewUrl', 'primaryAsset.url', 'image'] },
      technicalSketch: { sources: ['technicalSketchUrl', 'technicalSketchAsset.previewUrl', 'technicalSketchAsset.url'] }
    },
    pricing: {
      pdfField: 'pricePDF',
      printedField: 'pricePrinted',
      fallbackPdf: 14,
      printedMarkupFallback: 8
    },
    defaultFabricSuggestions: ['Linen', 'Silk', 'Wool'],
    defaultYardage: { width60: '2.5 yards', width45: '3.2 yards' }
  }
};

COMPONENT_UI_METADATA.patternCardRendering = {
  fabricDescriptions: {
    Linen: { description: 'Classic flax fiber woven with organic slub textures. Exceptional breathability with a beautifully relaxed, structural drape and organic wrinkles.' },
    'Silk Satin': { description: 'Luxurious filament silk weave featuring a high-luster finish. Offers an elegant, liquid-like drape, lightweight airiness, and a supreme hand feel.' },
    'Wool Crepe': { description: 'Pebbled texture woven from premium spun wool. Features high elasticity, bounce, excellent shape recovery, and crisp tailoring memory.' },
    Cotton: { description: 'Crisp, matte-finish combed cotton. High breathability and everyday durability with structural softness perfect for precise stitching.' },
    'Linen Blend': { description: 'A curated blend matching the crisp slub appearance of flax with performance yarns for enhanced drape stability and wrinkle-resistance.' },
    Silk: { description: 'Luxurious filament silk weave featuring a high-luster finish. Offers an elegant, liquid-like drape, lightweight airiness, and a supreme hand feel.' },
    Wool: { description: 'Dense, structured weave with rich natural loft, excellent warmth, and crisp tailoring memory.' },
    Denim: { description: 'Rugged twill weave with high structural durability and rich indigo depth.' },
    Tencel: { description: 'Eco-friendly filament with peach-skin softness and high luster.' },
    Chambray: { description: 'Plain-weave variation offering lightweight breathability and contrast warp.' },
    Crepe: { description: 'Pebbled texture with high drape recovery, soft matte finish, and bouncy tailoring body.' },
    Satin: { description: 'High-luster plain weave with liquid-like drape and smooth face.' },
    Gabardine: { description: 'Steep twill structure providing superb shape definition, high wear resistance, and clean lines.' },
    'Boiled Wool': { description: 'Felted texture with rich body, warmth, and raw edge stability.' }
  },
  colorways: [
    { id: 'oatmeal', name: 'Oatmeal', displayName: 'Alabaster Oatmeal (13-0002 TCX)', code: '#DBCCB5', border: 'border-sand-300', pantoneName: 'White Sand', pantoneCode: '13-0002-TCX' },
    { id: 'burgundy', name: 'Burgundy', displayName: 'Bordeaux Burgundy (19-1650 TCX)', code: '#5C1A2E', border: 'border-rose-950', pantoneName: 'Biking Red', pantoneCode: '19-1650-TCX' },
    { id: 'forest', name: 'Forest', displayName: 'Veridian Forest (19-5414 TCX)', code: '#18413B', border: 'border-emerald-950', pantoneName: 'Forest Biome', pantoneCode: '19-5414-TCX' },
    { id: 'slate', name: 'Slate', displayName: 'Steel Slate (18-4005 TCX)', code: '#717378', border: 'border-slate-800', pantoneName: 'Steel Gray', pantoneCode: '18-4005-TCX' },
    { id: 'rose', name: 'Rose', displayName: 'Rosewood Pink (18-1630 TCX)', code: '#B96D76', border: 'border-rose-300', pantoneName: 'Dusty Rose', pantoneCode: '18-1630-TCX' },
    { id: 'prussian', name: 'Prussian', displayName: 'Prussian Navy (19-4024 TCX)', code: '#1E243A', border: 'border-slate-900', pantoneName: 'Dress Blues', pantoneCode: '19-4024-TCX' },
    { id: 'charcoal', name: 'Charcoal', displayName: 'Charcoal Black (19-3906 TCX)', code: '#1A1A1E', border: 'border-neutral-900', pantoneName: 'Dark Slate', pantoneCode: '19-3906-TCX' }
  ]
};

COMPONENT_UI_METADATA.printingGuide = {
  steps: [
    { id: 'settings', title: 'Settings & Setup', icon: 'settings', description: 'Configure print scale & select blueprint layout standard.' },
    { id: 'calibration', title: 'Calibration Check', icon: 'ruler', description: 'Verify the 2-inch test square with absolute physical precision.' },
    { id: 'trim', title: 'Trim Borders', icon: 'scissors', description: 'Slice boundaries along alignment lines to ensure accurate overlap.' },
    { id: 'mapping', title: 'Grid & Piece Mapping', icon: 'grid', description: 'Interactive visual coordinate table to align your printed pattern pages.' },
    { id: 'assembly', title: 'Seaming & Assembly', icon: 'layers', description: 'Tape and slice individual master components for fabric pinning.' }
  ]
};

COMPONENT_UI_METADATA.fabricYardage.cuttingPiecesByPattern = {
  'sartorial-01': [
    { id: 'front-bodice', name: 'Front Bodice', count: 'x2', wClass: 'w-[20%]', hClass: 'h-[80%]', color: 'border-clay-300 bg-clay-50/40 text-clay-800' },
    { id: 'back-bodice', name: 'Back Bodice', count: 'x1 Fold', wClass: 'w-[18%]', hClass: 'h-[80%]', color: 'border-clay-400 bg-clay-100/30 text-clay-800' },
    { id: 'skirt-front', name: 'Skirt Front', count: 'x2', wClass: 'w-[28%]', hClass: 'h-[90%]', color: 'border-amber-300 bg-amber-50/30 text-amber-950' },
    { id: 'skirt-back', name: 'Skirt Back', count: 'x1 Fold', wClass: 'w-[24%]', hClass: 'h-[90%]', color: 'border-amber-400 bg-amber-100/20 text-amber-950' },
    { id: 'sleeves', name: 'Sleeves', count: 'x2', wClass: 'w-[14%]', hClass: 'h-[60%]', color: 'border-stone-300 bg-stone-100/40 text-stone-700' }
  ],
  'sartorial-02': [
    { id: 'front-coat', name: 'Front Coat', count: 'x2', wClass: 'w-[25%]', hClass: 'h-[95%]', color: 'border-clay-400 bg-clay-50/40 text-clay-850' },
    { id: 'back-coat', name: 'Back Coat', count: 'x1 Fold', wClass: 'w-[24%]', hClass: 'h-[95%]', color: 'border-clay-500 bg-clay-100/30 text-clay-850' },
    { id: 'sleeves', name: 'Sleeves', count: 'x2', wClass: 'w-[18%]', hClass: 'h-[75%]', color: 'border-amber-300 bg-amber-50/30 text-amber-900' },
    { id: 'storm-shield', name: 'Storm Shield', count: 'x1', wClass: 'w-[15%]', hClass: 'h-[55%]', color: 'border-stone-400 bg-stone-100/45 text-stone-800' },
    { id: 'belt-straps', name: 'Belt & Straps', count: 'x3', wClass: 'w-[12%]', hClass: 'h-[90%]', color: 'border-stone-300 bg-stone-50/30 text-stone-750' }
  ],
  'sartorial-03': [
    { id: 'leg-front', name: 'Leg Front', count: 'x2', wClass: 'w-[28%]', hClass: 'h-[92%]', color: 'border-clay-300 bg-clay-50/40 text-clay-800' },
    { id: 'leg-back', name: 'Leg Back', count: 'x2', wClass: 'w-[28%]', hClass: 'h-[92%]', color: 'border-clay-400 bg-clay-100/30 text-clay-800' },
    { id: 'contour-band', name: 'Contour Band', count: 'x2', wClass: 'w-[22%]', hClass: 'h-[40%]', color: 'border-amber-400 bg-amber-50/40 text-amber-950' },
    { id: 'pocket-bags', name: 'Pocket Bags', count: 'x4', wClass: 'w-[16%]', hClass: 'h-[50%]', color: 'border-stone-300 bg-stone-50/30 text-stone-750' }
  ],
  'sartorial-04': [
    { id: 'drape-front', name: 'Drape Front', count: 'x1 Bias', wClass: 'w-[32%]', hClass: 'h-[85%]', color: 'border-clay-400 bg-clay-50/30 text-clay-850' },
    { id: 'back-body', name: 'Back Body', count: 'x1 Fold', wClass: 'w-[24%]', hClass: 'h-[80%]', color: 'border-clay-300 bg-clay-50/40 text-clay-800' },
    { id: 'sleeves', name: 'Sleeves', count: 'x2', wClass: 'w-[20%]', hClass: 'h-[65%]', color: 'border-amber-300 bg-amber-50/30 text-amber-950' },
    { id: 'collar-facing', name: 'Collar Facing', count: 'x2', wClass: 'w-[18%]', hClass: 'h-[45%]', color: 'border-stone-300 bg-stone-50/30 text-stone-750' }
  ],
  default: [
    { id: 'main-panels', name: 'Main Panels', count: 'x2', wClass: 'w-[35%]', hClass: 'h-[85%]', color: 'border-clay-350 bg-clay-50/30 text-clay-800' },
    { id: 'facings', name: 'Facings', count: 'x2', wClass: 'w-[25%]', hClass: 'h-[50%]', color: 'border-amber-300 bg-amber-50/30 text-amber-950' },
    { id: 'pocket-liners', name: 'Pocket Liners', count: 'x2', wClass: 'w-[20%]', hClass: 'h-[40%]', color: 'border-stone-300 bg-stone-50/30 text-stone-700' }
  ]
};

COMPONENT_UI_METADATA.fabricYardage.layoutComplexityOptions = [
  { value: 'simple', label: 'Simple / Economic', desc: 'High nesting density. Straight vertical grain lines, rectangular blocks, or minimal parts.', rate: '-8% fabric' },
  { value: 'standard', label: 'Standard Atelier', desc: 'Standard professional nesting. Average pieces, traditional sleeves, and standard collars.', rate: 'Baseline (0%)' },
  { value: 'complex', label: 'Complex / Couture', desc: 'Advanced drapes, asymmetrical wrap pieces, bias cuts, deep pleats, or extreme flares.', rate: '+18% buffer' }
];

COMPONENT_UI_METADATA.instructionsPdf = {
  patternPiecesByCategory: {
    Dresses: [
      { id: 'front-bodice', name: 'Front Bodice', count: 'Cut 1 on Fold', size: 'w-[40%] h-[35%]', x: 'left-4 top-4' },
      { id: 'back-bodice', name: 'Back Bodice', count: 'Cut 2', size: 'w-[25%] h-[35%]', x: 'left-[46%] top-4' },
      { id: 'skirt-front', name: 'Skirt Front', count: 'Cut 1 on Fold', size: 'w-[50%] h-[45%]', x: 'left-4 bottom-4' },
      { id: 'skirt-back', name: 'Skirt Back', count: 'Cut 2', size: 'w-[35%] h-[45%]', x: 'left-[56%] bottom-4' }
    ],
    Outerwear: [
      { id: 'coat-front', name: 'Coat Front', count: 'Cut 2', size: 'w-[30%] h-[60%]', x: 'left-4 top-4' },
      { id: 'coat-back', name: 'Coat Back', count: 'Cut 1 on Fold', size: 'w-[35%] h-[60%]', x: 'left-[36%] top-4' },
      { id: 'sleeve', name: 'Sleeve', count: 'Cut 2', size: 'w-[25%] h-[45%]', x: 'right-4 top-4' },
      { id: 'storm-flap', name: 'Storm Flap', count: 'Cut 2 Collar', size: 'w-[20%] h-[20%]', x: 'right-4 bottom-4' }
    ],
    Trousers: [
      { id: 'pant-front', name: 'Pant Front', count: 'Cut 2', size: 'w-[35%] h-[75%]', x: 'left-6 top-6' },
      { id: 'pant-back', name: 'Pant Back', count: 'Cut 2', size: 'w-[40%] h-[75%]', x: 'left-[45%] top-6' },
      { id: 'waistband', name: 'Waistband', count: 'Cut 1 Interfaced', size: 'w-[80%] h-[12%]', x: 'left-6 bottom-4' }
    ],
    default: [
      { id: 'front-panel', name: 'Front Panel', count: 'Cut 1 on Fold', size: 'w-[45%] h-[45%]', x: 'left-4 top-4' },
      { id: 'back-panel', name: 'Back Panel', count: 'Cut 2', size: 'w-[40%] h-[45%]', x: 'left-[52%] top-4' },
      { id: 'sleeve-facing', name: 'Sleeve / Facing', count: 'Cut 2', size: 'w-[30%] h-[35%]', x: 'left-4 bottom-4' }
    ]
  },
  sewingSteps: [
    { num: '01', title: 'STABILIZATION & PIECE PREPARATION', desc: 'Apply fine weft interfacing to all facing pieces, collars, or waistband elements. Run a fine stay-stitch (stitch length 1.5mm) 1/8 inch within the seam allowance of all curves, especially collars and armholes, to prevent stretching.' },
    { num: '02', title: 'SHAPING CORDS, DARTS, AND SEWING TIES', desc: "Mark all darts precisely on the wrong side of the fabric using tailor's chalk. Stitch darts from the wide edge toward the point, leaving long threads at the tip. Tie threads by hand to prevent puckering. Press all bust/waist darts downward or toward the center line." },
    { num: '03', title: 'COUTURE FLAT FRENCH SEAM JOINING', desc: 'With wrong sides of the front and back panels facing, stitch the side and shoulder seams at 1/4 inch. Trim the seam allowance down to an even 1/8 inch. Press seam flat to set the stitches, then open. Turn fabric right sides together, crease sharply along the seam line, and stitch at 3/8 inch. This securely encases the raw edges inside.' },
    { num: '04', title: 'FACINGS, WRAP FASTENERS & ATTACHING COLLARS', desc: 'Sew facing segments together at the shoulders. Pin facings to the bodice edges, matching collar markers and shoulder seams. Stitch using a consistent 3/8 inch seam allowance. Clip curves, grade allowances to reduce bulk, turn facings inside and understitch 1/16 inch from seam.' },
    { num: '05', title: 'BABY HEMMING & COUTURE CLAPPER FINISH', desc: 'To hem delicate silks or linens beautifully, turn raw hem up by 1/4 inch and press. Stitch close to the edge. Trim excess allowance down to the stitching. Turn up again 1/8 inch to completely enclose raw edge, press and stitch again. Finish with a heavy wood clapper and high steam.' }
  ]
};

COMPONENT_UI_METADATA.sewingSession.projectChecklistDefaults = [
  { id: 'cutting', label: 'Cutting Fabric & Pattern Prep', completed: false },
  { id: 'staystitching', label: 'Staystitching & Interfacing', completed: false },
  { id: 'sewing-seams', label: 'Sewing Seams & Main Assembly', completed: false },
  { id: 'detail-sewing', label: 'Detail Sewing (Collars, Cuffs, Hemming)', completed: false },
  { id: 'final-pressing', label: 'Final Pressing & Finishing touch', completed: false }
];

COMPONENT_UI_METADATA.sewingSession.quickColorPalette = [
  { id: 'sage', name: 'Sage', color: '#8fa89b' },
  { id: 'navy', name: 'Navy', color: '#2b3a4a' },
  { id: 'rose', name: 'Rose', color: '#e5b3b3' },
  { id: 'charcoal', name: 'Charcoal', color: '#3a3a3a' },
  { id: 'mustard', name: 'Mustard', color: '#d9a043' },
  { id: 'cream', name: 'Cream', color: '#f5f2eb' },
  { id: 'crimson', name: 'Crimson', color: '#8b2635' },
  { id: 'olive', name: 'Olive', color: '#556b2f' }
];



Object.assign(COMPONENT_UI_METADATA, {
  creationsAndFeedback: {
    reviewFilters: [
      { id: 'all', label: 'All Reviews' },
      { id: '5', label: '5 Stars' },
      { id: '4', label: '4 Stars' },
      { id: 'photo', label: 'With Photos' }
    ],
    entryFilters: [
      { id: 'all', label: 'All Entries' },
      { id: 'creations', label: 'Sewn Makes' },
      { id: 'atelier-feedback', label: 'Feedback' }
    ]
  },
  developerIntegration: {
    invalidPayloadMessage: 'Invalid payload format. Must be an array or a single pattern object.'
  },
  dynamicUiEngineRuntime: {
    defaultStats: [
      { id: 'community', label: 'Community', value: '14,800+', detail: 'Makers sewing active pieces' },
      { id: 'sewn-rate', label: 'Sewn Rate', value: '98%', detail: 'Zero-waste efficiency index' },
      { id: 'satisfaction', label: 'Satisfaction', value: '4.9/5', detail: 'Rating from real couturiers' }
    ]
  },
  heroCarousel: {
    slideCopy: [
      { id: 0, description: 'Premium sewing patterns with intelligent sizing guidance for a refined handmade fit.', ctaPrimary: 'Explore Patterns', ctaSecondary: 'Find My Size' },
      { id: 1, description: 'Discover elegant silhouettes, clear pattern details, and designs made for confident sewing.', ctaPrimary: 'Shop the Collection', ctaSecondary: 'View Size Guide' },
      { id: 2, description: 'Bring each garment to life with patterns, sizing support, and atelier-inspired guidance.', ctaPrimary: 'Explore Patterns', ctaSecondary: 'Find My Size' }
    ]
  },
  memberManagement: {
    avatarPresets: [
      { id: 'model-sketch', name: 'Model Sketch', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80' },
      { id: 'modern-maker', name: 'Modern Maker', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80' },
      { id: 'atelier-room', name: 'Atelier Room', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80' },
      { id: 'embroiderer', name: 'Embroiderer', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80' }
    ]
  },
  cataloguePriceFilters: [
    { id: 'All', label: 'All' },
    { id: 'under-15', label: 'Under $15' },
    { id: '15-20', label: '$15 - $20' },
    { id: 'over-20', label: 'Over $20' }
  ],
  patternSeo: {
    schemaLabels: {
      digitalOffer: 'Digital PDF Pattern Download',
      printedOffer: 'Physical Printed Multi-size Tissue',
      difficulty: 'Sewing Difficulty',
      fabricRequirements: 'Fabric Requirements',
      yardage60: 'Yardage (60" width)'
    }
  },
  sewingSessionRuntime: {
    customProjectName: 'Custom Tailoring Project',
    customProjectShortName: 'Custom Tailoring',
    genericProjectName: 'Project',
    customStepName: 'Custom Tailoring Step',
    unassignedName: 'Unassigned',
    activeDesignName: 'Active Design'
  },
  dynamicGallery: {
    defaultPatternPieces: [
      { id: 'front-bodice', name: 'Front Bodice', width: '80px', height: '110px', x: '10%', y: '15%', color: 'bg-[#ba6446]/10 border-[#ba6446]/40 text-stone-200' },
      { id: 'back-bodice', name: 'Back Bodice', width: '80px', height: '110px', x: '40%', y: '15%', color: 'bg-amber-500/10 border-amber-500/40 text-stone-200' },
      { id: 'sleeve-layout', name: 'Sleeve Layout', width: '70px', height: '80px', x: '70%', y: '25%', color: 'bg-emerald-500/10 border-emerald-500/40 text-stone-200' }
    ]
  },
  permissionsOverview: {
    unregisteredComponentDescription: 'Component not registered in workspace registry.'
  },
  productDevelopmentMedia: {
    ...(COMPONENT_UI_METADATA.productDevelopmentMedia || {}),
    sampleTexturePresets: [
      { id: 'belgian-organic-linen', label: 'Belgian Organic Linen', url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=800&q=80' },
      { id: 'mulberry-silk-satin', label: 'Mulberry Silk Satin', url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=800&q=80' },
      { id: 'wool-crepe-suiting', label: 'Wool Crepe Suiting', url: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80' },
      { id: 'combed-cotton-gabardine', label: 'Combed Cotton Gabardine', url: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?auto=format&fit=crop&w=800&q=80' },
      { id: 'tencel-lyocell-denim', label: 'Tencel Lyocell Denim', url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80' }
    ]
  },
  workspaceAnalytics: {
    actionTypes: {
      role_switched: { label: 'Role Switch' },
      rule_altered: { label: 'Rule Altered' },
      access_denied: { label: 'Access Denied' },
      feature_accessed: { label: 'Feature Accessed' },
      config_pane_toggled: { label: 'Config Pane Toggle' },
      guidelines_viewed: { label: 'Guidelines Viewed' }
    }
  },
  projectJournal: {
    subTabs: [
      { id: 'session', label: 'Session' },
      { id: 'progress', label: 'Project Progress' },
      { id: 'measurements', label: 'Fit Session' },
      { id: 'templates', label: 'Task Templates' }
    ]
  },
  googleDriveIntegration: {
    measurementsLedgerDescription: 'Perfect Fit Bureau custom sewing measurements ledger',
    patternSizingReportDescription: 'Perfect Fit Bureau pattern and sizing report'
  }
});


// Batch 07 — final hidden UI/configuration metadata used by localized component renderers.
Object.assign(COMPONENT_UI_METADATA, {
  collaboratorSalesDashboard: {
    syncSuccess: { message: 'Sales history synchronized with ERP' }
  },
    mobileAppView: {
    measurementHotspots: [
      { id: 1, name: 'Neck Girth', desc: 'Base of the neck, level at the back.' },
      { id: 2, name: 'Shoulder', desc: 'From neck point to shoulder socket.' },
      { id: 3, name: 'Bust/Chest', desc: 'Horizontal line at fullest chest point.' },
      { id: 4, name: 'Front Waist', desc: 'High shoulder down to natural waist.' },
      { id: 5, name: 'Waist Girth', desc: 'Natural narrow line above hip bones.' },
      { id: 6, name: 'Hip Girth', desc: 'Widest circumference at full seat.' },
      { id: 7, name: 'Inside Leg', desc: 'Inner crotch down to the floor level.' }
    ]
  },
  workspaceEntity: {
    project: { label: 'Project' },
    style: { label: 'Style' },
    variant: { label: 'Variant' }
  },
  fitRecommendation: {
    legacyMeasurements: [
      { id: 'legacy-bust', code: 'BUST', label: 'Bust', bodyAreaCode: 'BUST' },
      { id: 'legacy-waist', code: 'WAIST', label: 'Waist', bodyAreaCode: 'WAIST' },
      { id: 'legacy-hip', code: 'HIP', label: 'Hip', bodyAreaCode: 'HIP' }
    ]
  }
});

COMPONENT_UI_METADATA.dynamicUiEngineRuntime.showcaseItems = [
  {
    id: 'aurelia-wrap-dress',
    title: 'Aurelia Wrap Dress',
    subtitle: 'Belgian washed linen favorite',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=400&q=80',
    badge: 'INTERMEDIATE'
  },
  {
    id: 'atelier-utility-trench',
    title: 'Atelier Utility Trench',
    subtitle: 'Structured cotton gabardine outerwear',
    image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=400&q=80',
    badge: 'ADVANCED'
  }
];

const COMPONENT_METADATA_TRANSLATABLE_FIELDS = new Set([
  'label', 'title', 'description', 'subtitle', 'help', 'helpText',
  'placeholder', 'tooltip', 'emptyText', 'emptyState', 'message',
  'caption', 'heading', 'subheading', 'ariaLabel', 'alt', 'name',
  'desc', 'detail', 'details', 'content', 'callout', 'badge', 'basis'
]);

const COMPONENT_METADATA_STRING_ARRAY_FIELDS = new Set([
  'items', 'tips', 'features', 'notions', 'instructions'
]);

const COMPONENT_METADATA_TECHNICAL_STRING = /^(?:https?:\/\/|data:|blob:|#(?:[0-9a-f]{3,8})$|(?:bg|text|border|ring|shadow|font|tracking|leading|rounded|grid|flex|items|justify|w|h|min|max|aspect|opacity|overflow|absolute|relative|fixed|sticky|z)-|[A-Z][A-Z0-9_./:+-]*$|\d+(?:\.\d+)?(?:px|cm|mm|in|%|x)?$)/i;

const componentMetadataToken = (value) =>
  String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

const componentMetadataItemSegment = (value, index) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['id', 'code', 'value', 'key']) {
      const candidate = value[key];
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        return componentMetadataToken(candidate);
      }
    }
  }
  return String(index);
};

const componentMetadataTranslationKey = (namespace, path = [], field = '') =>
  ['metadata', namespace, ...path, field]
    .filter(Boolean)
    .map(componentMetadataToken)
    .join('.');

const collectComponentMetadataEnglish = (target, namespace, value, path = [], parentField = '') => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (
        typeof entry === 'string' &&
        COMPONENT_METADATA_STRING_ARRAY_FIELDS.has(parentField) &&
        /[A-Za-z]{2,}/.test(entry) &&
        !COMPONENT_METADATA_TECHNICAL_STRING.test(entry.trim())
      ) {
        withEnglish(target, componentMetadataTranslationKey(namespace, [...path, String(index)]), entry);
        return;
      }
      collectComponentMetadataEnglish(target, namespace, entry, [...path, componentMetadataItemSegment(entry, index)], parentField);
    });
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([field, fieldValue]) => {
    if (
      typeof fieldValue === 'string' &&
      COMPONENT_METADATA_TRANSLATABLE_FIELDS.has(field) &&
      /[A-Za-z]{2,}/.test(fieldValue) &&
      !COMPONENT_METADATA_TECHNICAL_STRING.test(fieldValue.trim())
    ) {
      withEnglish(target, componentMetadataTranslationKey(namespace, path, field), fieldValue);
      return;
    }
    collectComponentMetadataEnglish(target, namespace, fieldValue, [...path, componentMetadataToken(field)], field);
  });
};

const baseEnglish = {
  'language.en': 'English',
  'language.selector.label': 'Language',
  'header.brandHomeAria': 'Go to Perfect Fit Bureau home',
  'header.searchCatalogTitle': 'Search Catalog',
  'header.searchPlaceholder': 'Search patterns...',
  'header.mobileSearchPlaceholder': 'Search by name, category, level...',
  'header.clearSearch': 'Clear Search',
  'header.suggestedBlueprints': 'Suggested Blueprints',
  'header.clickToOpenQuickView': 'Click to Open Quick View',
  'header.matchingPatterns': 'Matching Patterns',
  'header.tapToView': 'Tap to View',
  'header.viewAllMatches': 'View all {count} matches in catalog →',
  'header.manageMembership': 'Manage Perfect Fit Membership',
  'header.pdfSpec': 'PDF Spec',
  'nav.explore': 'Explore',
  'nav.wishlist': 'Wishlist',
  'nav.cart': 'Cart',
  'nav.cartWithCount': 'Cart ({count})',
  'nav.toggleMenu': 'Toggle Menu',
  'auth.signIn': 'Sign In',
  'auth.username.required': 'Username is required',
  'auth.username.format': 'Use 3-30 letters, numbers, . or _',
  'auth.username.reserved': 'This username is reserved',
  'auth.username.taken': 'Username is already taken',
  'nav.group.showroomPatterns': 'SHOWROOM & PATTERNS',
  'nav.group.fitSizing': 'FIT & SIZING',
  'nav.group.designSandbox': 'DESIGN SANDBOX',
  'nav.group.supportGuidance': 'SUPPORT & GUIDANCE',
  'nav.item.patterns.label': 'Pattern Library',
  'nav.item.patterns.description': 'Browse premium design booklets',
  'nav.item.orders.label': 'My Orders',
  'nav.item.orders.description': 'Access PDF patterns & downloads',
  'nav.item.community.label': 'Community feedback',
  'nav.item.community.description': 'Finished garments, reviews & maker inspiration',
  'nav.item.blog.label': 'Community Board',
  'nav.item.blog.description': 'Posts & articles',
  'nav.item.fit.label': 'Find My Size',
  'nav.item.fit.description': 'Measurement guide and garment-specific size recommendation',
  'nav.item.workspace.label': 'Workspace',
  'nav.item.workspace.description': 'Projects, styles and design development',
  'nav.item.materials.label': 'Materials',
  'nav.item.materials.description': 'Fabric stash, swatches and sourcing',
  'nav.item.academy.label': 'Perfect Fit Library',
  'nav.item.academy.description': 'Articles, guides & sewing resources',
  'nav.item.faq.label': 'Fit & Pattern FAQ',
  'nav.item.faq.description': 'Answers about sizing, downloads & pattern use',
  'nav.item.consultation.label': 'Design Consultation',
  'nav.item.consultation.description': 'Book fit, pattern or design support'
};

const generatedEnglish = {};

collectComponentMetadataEnglish(generatedEnglish, 'component', COMPONENT_UI_METADATA);

SURFACE_VISIBILITY_REGISTRY.forEach((surface) => {
  withEnglish(generatedEnglish, `surface.${keyToken(surface.id)}.label`, surface.label);
  withEnglish(generatedEnglish, `surface.${keyToken(surface.id)}.page`, surface.page);
});

toArray(techPackMetadata?.ui?.tabs).forEach((tab) => {
  withEnglish(generatedEnglish, `techPack.tab.${keyToken(tab.code)}`, tab.label);
});

toArray(techPackMetadata?.ui?.companionPanels).forEach((panel) => {
  withEnglish(generatedEnglish, `techPack.panel.${keyToken(panel.code)}.label`, panel.label);
  withEnglish(generatedEnglish, `techPack.panel.${keyToken(panel.code)}.shortLabel`, panel.shortLabel);
});

toArray(techPackMetadata?.drawingStudio?.tools).forEach((tool) => {
  withEnglish(generatedEnglish, `techPack.tool.${keyToken(tool.code)}`, tool.label);
});

toArray(techPackMetadata?.drawingStudio?.sequenceModes).forEach((mode) => {
  withEnglish(generatedEnglish, `techPack.sequenceMode.${keyToken(mode.code)}`, mode.label);
});

toArray(techPackMetadata?.drawingStudio?.referenceTypes).forEach((type) => {
  withEnglish(generatedEnglish, `techPack.referenceType.${keyToken(type.code)}`, type.label);
});

toArray(messageMetadata?.messageTypes).forEach((type) => {
  withEnglish(generatedEnglish, `messaging.type.${keyToken(type.code)}`, type.label);
});

Object.entries(messageMetadata?.workflow?.labels || {}).forEach(([code, label]) => {
  withEnglish(generatedEnglish, `messaging.workflow.${keyToken(code)}`, label);
});

toArray(materialsMetadata?.workspaceTabs).forEach((tab) => {
  withEnglish(generatedEnglish, `materials.tab.${keyToken(tab.id)}`, tab.label);
});

toArray(materialsMetadata?.uoms).forEach((uom) => {
  withEnglish(generatedEnglish, `materials.uom.${keyToken(uom.code)}.label`, uom.label);
  withEnglish(generatedEnglish, `materials.uom.${keyToken(uom.code)}.shortLabel`, uom.shortLabel);
});

toArray(materialsMetadata?.incomingStatuses).forEach((status) => {
  withEnglish(generatedEnglish, `materials.incomingStatus.${keyToken(status.code)}`, status.label);
});

toArray(AVATAR_GENDERS).forEach((item) => {
  withEnglish(generatedEnglish, `avatar.gender.${keyToken(item.code)}`, item.label);
});

toArray(AVATAR_AGE_GROUPS).forEach((item) => {
  withEnglish(generatedEnglish, `avatar.ageGroup.${keyToken(item.code)}`, item.label);
});

Object.values(AVATAR_PROFILES || {}).forEach((profile) => {
  withEnglish(generatedEnglish, `avatar.profile.${keyToken(profile.id)}`, profile.label);
});

toArray(DEFAULT_MEASUREMENTS).forEach((definition) => {
  withEnglish(generatedEnglish, `measurement.${definition.code}.label`, definition.label);
  withEnglish(generatedEnglish, `measurement.${definition.code}.short`, definition.shortLabel);
});

toArray(DEFAULT_MEASUREMENT_SIZE_SYSTEMS).forEach((system) => {
  withEnglish(generatedEnglish, `sizing.system.${keyToken(system.code)}`, system.label);
});
['FR', 'RU'].forEach((code) => {
  withEnglish(generatedEnglish, `sizing.system.${keyToken(code)}`, code);
});

Object.entries(rolePermissions?.roles || {}).forEach(([roleCode, role]) => {
  withEnglish(generatedEnglish, `role.${keyToken(roleCode)}.name`, role.name);
  withEnglish(generatedEnglish, `role.${keyToken(roleCode)}.description`, role.description);
});

const autoEnglish = {
  "ui.app.0a7b4a5b4c": "Tailored Tailcoat Jackets",
  "ui.app.0aa0352292": "Authentication Required. This system has been configured by the",
  "ui.app.13a6e689db": "Timeless wearable styling built on structural elegance. We celebrate the luxury of slow-fashion constructing, providing beautifully organized, fully accurate blueprint packets for sewing enthusiasts around the globe.",
  "ui.app.1653c69999": "PERFECT FIT MOBILE WORKSPACE",
  "ui.app.20e2afc99b": "Blueprint Licensing",
  "ui.app.3f9a5ea288": "✦ Dynamic Administrator Credentials ✦",
  "ui.app.416a232118": "Privacy Principles",
  "ui.app.47f324475d": "Asymmetric Slips Series",
  "ui.app.4f7be347b8": "Classic Grid",
  "ui.app.570ce950bf": "to restrict public catalog operations. Please log in or use the interactive demo bypass to authorize access.",
  "ui.app.5b910b6a4a": "• Category:",
  "ui.app.5bd2305857": "Read-Only Session",
  "ui.app.6980d33b3c": "THE PERFECT FIT BLUEPRINTS",
  "ui.app.6c41c3acc1": "One-Time Token Grant Verified",
  "ui.app.6c876d7c1c": "Classic Grid View with Left Specification Panel",
  "ui.app.751a77e31e": "Showcase",
  "ui.app.8390124044": "Bypass: Sign In as Administrator",
  "ui.app.844ff4decc": "📱 MOBILE APP VIEW ACTIVE",
  "ui.app.89757e2e56": "© 2026 Perfect Fit Bureau Inc. Executed with premium slow-fashion guidelines.",
  "ui.app.8a0151dbf0": "Close Spec Viewer",
  "ui.app.8e47431088": "• Recommended Yardage:",
  "ui.app.9483462540": "1-Time Grant Active",
  "ui.app.95adda62fd": "Modern Showcase View with Specs on Hover",
  "ui.app.a10df72f47": "Wrap Dresses Series",
  "ui.app.a7e9d03d53": "Executive Administrator",
  "ui.app.a81feb4bab": "You have been granted one-time collaborator access to inspect private technical specifications, seam allowance notes, and industrial assembly sequences for this garment.",
  "ui.app.aff665cf7d": "Wide Leg Palazzos",
  "ui.app.b197caa11b": "Perfect Fit Terms",
  "ui.app.b311a4d421": "🖥️ SWITCH TO DESKTOP BLUEPRINT",
  "ui.app.b464528b65": "• Secret Tip: Pre-wash fabric with neutral textile enzyme wash prior to cutting for zero shrinkage.",
  "ui.app.b60311bb13": "View Member Login Options",
  "ui.app.b66fd2670e": "Garment Technical Overview",
  "ui.app.ec7688cdfc": "• Skill Level:",
  "ui.app.f3b08bcdde": "Developer Integration",
  "ui.app.fd5e6476a6": "Authentic Gated Workspace",
  "ui.components.admincontrolpanel.09050841b6": "Segment Content Prose / Comma-separated Guidelines",
  "ui.components.admincontrolpanel.0c76b3fd14": "Message Designer",
  "ui.components.admincontrolpanel.0cb63d9d50": "Moderator note",
  "ui.components.admincontrolpanel.11f8785754": "● SECURE LOGS ACTIVE",
  "ui.components.admincontrolpanel.12003f47ab": "Active Secure Console",
  "ui.components.admincontrolpanel.151a8c6ddc": "Provide descriptive narratives. If choosing checklists, separate each bullet point with a comma...",
  "ui.components.admincontrolpanel.16a85aeac0": "Transactions Logged",
  "ui.components.admincontrolpanel.18abe2b1a5": "Purge Logs",
  "ui.components.admincontrolpanel.1fe92bf067": "Unauthorized Component Behavior",
  "ui.components.admincontrolpanel.200f648d37": "Submitted",
  "ui.components.admincontrolpanel.226a56ae22": "No logs recorded. Select different roles or edit components visibility rules to generate live diagnostic updates.",
  "ui.components.admincontrolpanel.249b261cf7": "Moderator Catalogue Review",
  "ui.components.admincontrolpanel.24b4878fd8": "Audited Diagnostic Transactions stream",
  "ui.components.admincontrolpanel.261e5dfdee": "Cancel",
  "ui.components.admincontrolpanel.291f268f17": "Optional Background Image Link",
  "ui.components.admincontrolpanel.2c32f96a42": "Page / section visibility registry",
  "ui.components.admincontrolpanel.2c4a4b816d": "Delete Segment",
  "ui.components.admincontrolpanel.2f870c9d1c": "Master Admin Toggle: Enable or disable interactive garment specification overlays and hover reveals for all items in the catalog.",
  "ui.components.admincontrolpanel.327050deb3": "Events",
  "ui.components.admincontrolpanel.347e4b2e87": "Perfect Fit Simulation Sandbox",
  "ui.components.admincontrolpanel.35a43bd8a5": "Target Persona Clearance Rights",
  "ui.components.admincontrolpanel.35aec6e801": "Visitor upgrade requests will queue here automatically.",
  "ui.components.admincontrolpanel.392a45c970": "Commit Raw JSON Transaction",
  "ui.components.admincontrolpanel.3a39596faf": "Workspace Component Block Name",
  "ui.components.admincontrolpanel.4324dacee1": "Check roles to grant immediate access to subcomponents across the client application.",
  "ui.components.admincontrolpanel.4525d611f3": "Blocks protected with shields",
  "ui.components.admincontrolpanel.48da7509a1": "Enables physical shipment tracking UI for future printed/physical orders.",
  "ui.components.admincontrolpanel.4f64a1b99d": "Strict System Login Enforcement",
  "ui.components.admincontrolpanel.50cea8175c": "Toggle public pages, Workspace internal surfaces, and global launchers from one metadata-driven registry. Hidden surfaces are not rendered. Workspace2 and the legacy Size Guide remain locked off.",
  "ui.components.admincontrolpanel.53817517fc": "Access Gated Denials",
  "ui.components.admincontrolpanel.5638adcf71": "Admins",
  "ui.components.admincontrolpanel.5767debf4e": "Last checked:",
  "ui.components.admincontrolpanel.57bc2cd75e": "Simulated Persona:",
  "ui.components.admincontrolpanel.58db030435": "Add Segment",
  "ui.components.admincontrolpanel.591591b1d1": "Security Integrity Code",
  "ui.components.admincontrolpanel.5a3cb90293": "Choose representation when components are locked or gated from simulated user scopes.",
  "ui.components.admincontrolpanel.615b16686b": "App connection/browser status:",
  "ui.components.admincontrolpanel.62603472f1": "Perfect Fit Member",
  "ui.components.admincontrolpanel.630e6087bc": "Partners",
  "ui.components.admincontrolpanel.69b334f932": "Perspective Test Controller",
  "ui.components.admincontrolpanel.6aeac69687": "Deny",
  "ui.components.admincontrolpanel.6c05048946": "Interactive charting built with Recharts capturing database events, block hits, and visitor behaviors.",
  "ui.components.admincontrolpanel.6daa31141d": "Reset Rules Matrix",
  "ui.components.admincontrolpanel.6eba6fef4b": "Approve",
  "ui.components.admincontrolpanel.6f2e09b959": "Segment Layout Style",
  "ui.components.admincontrolpanel.730c92cc91": "Clear Archive",
  "ui.components.admincontrolpanel.763b5f173c": "Designer",
  "ui.components.admincontrolpanel.78c03fc39e": "Visitor Persona Metrics",
  "ui.components.admincontrolpanel.7cdbd69e9f": "Approve or deny visitor requests to gain special workspace clearances.",
  "ui.components.admincontrolpanel.7d35fe000e": "Lock Screen",
  "ui.components.admincontrolpanel.870bf3c984": "Diagnostic sandboxing secured",
  "ui.components.admincontrolpanel.89151b82f9": "Enable Hover Overlay",
  "ui.components.admincontrolpanel.8b2881f12c": "Hide Completely",
  "ui.components.admincontrolpanel.8c25267268": "Returned",
  "ui.components.admincontrolpanel.8d94927fd0": "Event:",
  "ui.components.admincontrolpanel.8e632e7966": "Moderator sees public projection only",
  "ui.components.admincontrolpanel.8ed7b70710": "Main Title Header",
  "ui.components.admincontrolpanel.90fb60db9e": "Consolidated command suite. Control audience simulation, monitor system analytics using Recharts, audit permissions, build dynamic layouts, and authorize credential applications.",
  "ui.components.admincontrolpanel.96754caf8a": "Published",
  "ui.components.admincontrolpanel.9b8b1f053e": "Guest Visitor",
  "ui.components.admincontrolpanel.9bf96075d3": "Save Segment",
  "ui.components.admincontrolpanel.9cdafd53f9": "Enable track shipment",
  "ui.components.admincontrolpanel.a3aa91873d": "Rules matrix configuration",
  "ui.components.admincontrolpanel.a6e849704d": "When active, visitors are completely locked out of pattern details, fabric calculators, or cart transactions unless signed into an active member profile. Turn off to allow public access.",
  "ui.components.admincontrolpanel.a8ef734c67": "Actual User:",
  "ui.components.admincontrolpanel.ad9ab59cb2": "Weight Index",
  "ui.components.admincontrolpanel.b0a5bea052": "Arrange visibility matrices, toggles, static templates, or custom layout segments dynamically.",
  "ui.components.admincontrolpanel.b231eaa9e7": "Displays views, cart additions, and wishlist counts for custom garments.",
  "ui.components.admincontrolpanel.b49d1dd101": "e.g. COUTURE SPEC",
  "ui.components.admincontrolpanel.bb35e1ec4f": "Toggle the credentials below to simulate different user personas. Watch the custom blocks in the workspace below automatically render, restrict, or render lock cards in real-time.",
  "ui.components.admincontrolpanel.bc24e9e1aa": "Require Member Login Authentication",
  "ui.components.admincontrolpanel.cdbf20e73c": "Designer requests appear here only after their technical release workflow is complete and they explicitly request moderator release.",
  "ui.components.admincontrolpanel.cf5d4c1bc7": "Creative Partner",
  "ui.components.admincontrolpanel.cf68618498": "Subtitle / Status Label",
  "ui.components.admincontrolpanel.cf6e4e2326": "Factory Reset DB",
  "ui.components.admincontrolpanel.d0459e87f0": "✦ Real-Time Diagnostic Telemetry",
  "ui.components.admincontrolpanel.d08d779441": "Altered",
  "ui.components.admincontrolpanel.dc6e459d2d": "Master Admin",
  "ui.components.admincontrolpanel.de7bd79977": "Rule Mutations",
  "ui.components.admincontrolpanel.dfbe13fc95": "Component permissions modified",
  "ui.components.admincontrolpanel.e05c9ddad7": "Guests",
  "ui.components.admincontrolpanel.e30b540ebb": "Active simulated sessions weight distribution.",
  "ui.components.admincontrolpanel.e439817680": "✦ CENTRALIZED ADMIN EXECUTIVE CORE ✦",
  "ui.components.admincontrolpanel.e7cd6cf5aa": "Disable Hover Overlay",
  "ui.components.admincontrolpanel.e7eb7119e5": "Sync",
  "ui.components.admincontrolpanel.eb49e096a1": "Blueprint Card Hover Specification Info",
  "ui.components.admincontrolpanel.f06eaacc70": "Pending",
  "ui.components.admincontrolpanel.f094b57bc9": "Edit Segment",
  "ui.components.admincontrolpanel.f5c2833646": "Members",
  "ui.components.admincontrolpanel.f6c530d90e": "✦ Live JSON Metadata field override",
  "ui.components.admincontrolpanel.f8251a32c4": "No Upgrade Petitions",
  "ui.components.admincontrolpanel.faf245d08a": "✦ Customer Publication Release Queue",
  "ui.components.admincontrolpanel.fb04a36462": "Display Badge Label",
  "ui.components.admincontrolpanel.fb1be1a55b": "Interceptions",
  "ui.components.admincontrolpanel.fbfcfbc301": "Active stream logging enabled",
  "ui.components.admincontrolpanel.fe8953e30a": "Monitors active accesses, reconfigurations and blocked attempts over a 7-day trailing span.",
  "ui.components.admincontrolpanel.fefcfce9eb": "Justification:",
  "ui.components.aroverlayvisualizer.04dba84d0e": "Pro-Tip:",
  "ui.components.aroverlayvisualizer.11fb447ead": "Brightness Contrast",
  "ui.components.aroverlayvisualizer.19ff0bbea0": "Draft Placement Controls",
  "ui.components.aroverlayvisualizer.267b52a748": "Isolate blueprint outline only",
  "ui.components.aroverlayvisualizer.31254f0676": "Set scale and horizontal offsets first. Drag the sliders slowly to map the shoulders of the pattern silhouette directly over the mannequin or your custom photo's alignment lines.",
  "ui.components.aroverlayvisualizer.3cffc9c7fc": "Click to Instant composition template:",
  "ui.components.aroverlayvisualizer.45a2141432": "Perfect Fit AR Overlay Instructions",
  "ui.components.aroverlayvisualizer.53c7d90516": "Reset Alignment",
  "ui.components.aroverlayvisualizer.55b734d273": "Blueprint Isolated",
  "ui.components.aroverlayvisualizer.55fa8de2aa": "Stand against a solid, neutral-colored background.",
  "ui.components.aroverlayvisualizer.5ae53568ee": "Blueprint Opacity",
  "ui.components.aroverlayvisualizer.5cbbea4969": "Recommended Photo Layout:",
  "ui.components.aroverlayvisualizer.65e69edc1d": "Photographic Filters",
  "ui.components.aroverlayvisualizer.66ff592d98": "Understood, Let's Fit",
  "ui.components.aroverlayvisualizer.68a070ce84": "Fine-Tuning CSS Filters",
  "ui.components.aroverlayvisualizer.6b9d7d0074": "Overlay Guidelines",
  "ui.components.aroverlayvisualizer.779ed39e45": "Rotation Angle",
  "ui.components.aroverlayvisualizer.7f142a8028": "Troubleshooting Composition Scales:",
  "ui.components.aroverlayvisualizer.93c5d66f04": "Alignment",
  "ui.components.aroverlayvisualizer.9999fa8783": "Or use standard studio backdrop:",
  "ui.components.aroverlayvisualizer.9a282fab2a": "How the Overlay Engine Works:",
  "ui.components.aroverlayvisualizer.9aacc2dc59": "Custom Photo Active",
  "ui.components.aroverlayvisualizer.a21f66a188": "Drag and drop your own fitting photo",
  "ui.components.aroverlayvisualizer.a47dcb1926": "This module utilizes client-side hardware-accelerated CSS composition layers. By combining multiple alpha channels and blending filters together, dressmakers can test garment silhouettes directly on top of real fitting photographs without requiring heavy server computing.",
  "ui.components.aroverlayvisualizer.a685926deb": "Reset Filters",
  "ui.components.aroverlayvisualizer.a8e3eee7c9": "Compose and align atelier sewing outlines, patterns, or garment blueprints directly onto your physical photo or studio mannequins. Fine-tune material fits and visual grains with detailed CSS filters and blend modes.",
  "ui.components.aroverlayvisualizer.ab6362dae5": "1. Choose Fitting Photo Backdrop",
  "ui.components.aroverlayvisualizer.ab942dea50": "If the blueprint appears too small or rotated incorrectly, use the **Alignment Tab** to scale the layer between 20% and 300%. Setting the Blend Mode to **\"Difference\"** or **\"Screen\"** is highly recommended to inspect fabric grain alignments.",
  "ui.components.aroverlayvisualizer.ac2d87117a": "Ensure high-key, even lighting from the front so the shadows blend perfectly.",
  "ui.components.aroverlayvisualizer.b3ca1e971c": "2. Select Atelier Pattern Silhouette",
  "ui.components.aroverlayvisualizer.bbb1ed769e": "Remove uploaded photo",
  "ui.components.aroverlayvisualizer.c0883d4369": "Active CSS Blend Mode",
  "ui.components.aroverlayvisualizer.c4afb88e8c": "Outlines Contrast",
  "ui.components.aroverlayvisualizer.ca5ceb1e96": "AR-Inspired Overlay Fitting Studio",
  "ui.components.aroverlayvisualizer.cd015bd692": "Color Saturation",
  "ui.components.aroverlayvisualizer.ce4960d46a": "Fitting Backdrop",
  "ui.components.aroverlayvisualizer.d0319d0896": "Reset coordinates",
  "ui.components.aroverlayvisualizer.d5dd5a012d": "Reset",
  "ui.components.aroverlayvisualizer.d9695d1275": "Fabric Hue Shifting",
  "ui.components.aroverlayvisualizer.dc8657fbfd": "Invert Color Curve",
  "ui.components.aroverlayvisualizer.e7409170d0": "Virtual fitting room",
  "ui.components.aroverlayvisualizer.eadfc91064": "Avoid heavy, loose clothing to ensure the silhouette lines match your true body curvature.",
  "ui.components.aroverlayvisualizer.f27a7852f0": "Style Presets",
  "ui.components.aroverlayvisualizer.f3b854d6f9": "Composition Canvas Stage",
  "ui.components.aroverlayvisualizer.ffafe1f5b4": "Blueprint Scale",
  "ui.components.catalogcategorynavigator.081f6d45dc": "Browse by category, designer and collection",
  "ui.components.catalogcategorynavigator.2401a85bd4": "All",
  "ui.components.catalogcategorynavigator.487ec07273": "Use the catalog tree to browse Women, Men and Kids patterns, then refine by designer brand.",
  "ui.components.catalogcategorynavigator.562906170e": "Reset filters",
  "ui.components.catalogcategorynavigator.7ab1e966f4": "✦ Pattern Catalog Navigator",
  "ui.components.catalogcategorynavigator.7bbc62470b": "Selected filter:",
  "ui.components.catalogcategorynavigator.a5c670f7b4": "All designers",
  "ui.components.catalogcategorynavigator.aa9194cba2": "Designer / Brand",
  "ui.components.catalogcategorynavigator.c9f9fea586": "Category",
  "ui.components.catalogsidebarnavigator.0938b2a20b": "Close catalogue filters",
  "ui.components.catalogsidebarnavigator.452b27d000": "Price range",
  "ui.components.catalogsidebarnavigator.46b5412972": "Difficulty",
  "ui.components.catalogsidebarnavigator.8070309070": "Favorites",
  "ui.components.catalogsidebarnavigator.8828f254f6": "Catalogue filters and categories",
  "ui.components.catalogsidebarnavigator.90a361c580": "Rating",
  "ui.components.catalogsidebarnavigator.9d55c61dd2": "Active filters",
  "ui.components.catalogsidebarnavigator.aba4d2e30a": "Wishlist / favorites",
  "ui.components.catalogsidebarnavigator.ad4cf2d4d6": "Browse Categories",
  "ui.components.catalogsidebarnavigator.b236842427": "Clear",
  "ui.components.catalogsidebarnavigator.ccdee4ca23": "Refine results",
  "ui.components.catalogsidebarnavigator.cfe6f6dfad": "Filters & categories",
  "ui.components.catalogsidebarnavigator.d47c0f42b8": "Choose one or more filters below to refine the pattern collection.",
  "ui.components.checkoutdrawer.0088656797": "Expires",
  "ui.components.checkoutdrawer.00e639c013": "Browse the pattern collection to add a digital pattern.",
  "ui.components.checkoutdrawer.019e2bb2a9": "Leone",
  "ui.components.checkoutdrawer.02b65c912a": "Delivered To:",
  "ui.components.checkoutdrawer.0416ba169e": "Cardholder",
  "ui.components.checkoutdrawer.0a413efb20": "Last Name",
  "ui.components.checkoutdrawer.0c5de71777": "\"Actual Size\" / 100% scale",
  "ui.components.checkoutdrawer.0d0005ffca": "Continue to payment",
  "ui.components.checkoutdrawer.102a714427": "Download invoice PDF",
  "ui.components.checkoutdrawer.104fb63b6c": "Back to cart",
  "ui.components.checkoutdrawer.1199c2578d": "United States",
  "ui.components.checkoutdrawer.13ed9d9242": "State/Prov",
  "ui.components.checkoutdrawer.1c94a028de": "Subtotal",
  "ui.components.checkoutdrawer.1f8110e404": "02 Details",
  "ui.components.checkoutdrawer.236b892fed": "Grand Total",
  "ui.components.checkoutdrawer.293571e5f0": "Australia",
  "ui.components.checkoutdrawer.2a24d96885": "Expiration Date",
  "ui.components.checkoutdrawer.2ed9f5b51a": "France",
  "ui.components.checkoutdrawer.2f858a3649": "MM/YY",
  "ui.components.checkoutdrawer.35c62cb2f7": "Measure the 2\" / 5cm scaling reference square on the first page before assembling the tiled pattern.",
  "ui.components.checkoutdrawer.3904abbeba": "Security CVC",
  "ui.components.checkoutdrawer.39b65452bf": "Format:",
  "ui.components.checkoutdrawer.3ad4df46db": "Example: BEGINNER50",
  "ui.components.checkoutdrawer.42bd7666d2": "Order Reference:",
  "ui.components.checkoutdrawer.4325f8e562": "Required for order records",
  "ui.components.checkoutdrawer.4841e4eb79": "Download pattern",
  "ui.components.checkoutdrawer.4968b1299d": "Remove",
  "ui.components.checkoutdrawer.49e71ce55f": "Remove pattern item",
  "ui.components.checkoutdrawer.55957c56a4": "Apply",
  "ui.components.checkoutdrawer.5bdaaa09fc": "Print PDF pattern pages at",
  "ui.components.checkoutdrawer.5cbef1d2b9": "Margot",
  "ui.components.checkoutdrawer.6be7c4a9eb": "Back to contact details",
  "ui.components.checkoutdrawer.6c40513a4c": "sewing.enthusiast@atelier.com",
  "ui.components.checkoutdrawer.7a9b4e3c99": "Digital delivery",
  "ui.components.checkoutdrawer.7cfa90d280": "Browse patterns",
  "ui.components.checkoutdrawer.7d08231038": "Printing Tips",
  "ui.components.checkoutdrawer.7dca94392a": "Date Processed:",
  "ui.components.checkoutdrawer.809e1ce075": "Continue to details",
  "ui.components.checkoutdrawer.8264516338": "Perfect Fit Couture",
  "ui.components.checkoutdrawer.897f585934": "Contact and billing details",
  "ui.components.checkoutdrawer.899ace48ef": "Japan",
  "ui.components.checkoutdrawer.89c5aa866d": "Secure checkout",
  "ui.components.checkoutdrawer.8b4ae0e7aa": "Payment details",
  "ui.components.checkoutdrawer.8b9edb7816": "Promo code",
  "ui.components.checkoutdrawer.8e3ce84000": "Canada",
  "ui.components.checkoutdrawer.8f0d160001": "03 Payment",
  "ui.components.checkoutdrawer.941ff6edf4": "First Name",
  "ui.components.checkoutdrawer.9477b9c3c1": "Return to the pattern collection & continue browsing",
  "ui.components.checkoutdrawer.a02f68141a": "For help, email customer support or consult the illustrated instructions handbook.",
  "ui.components.checkoutdrawer.a378c332bc": "Your payment and personal details are protected using secure checkout controls. We collect only the information needed to process your digital order and support your account.",
  "ui.components.checkoutdrawer.a9d77f43b2": "Billing address",
  "ui.components.checkoutdrawer.aa0ee63f7a": "Subtotal:",
  "ui.components.checkoutdrawer.afdd04560d": "Total Invoice Amount:",
  "ui.components.checkoutdrawer.b5a3b0229a": "Downloaded",
  "ui.components.checkoutdrawer.b94a9a50a4": "ZIP/Post",
  "ui.components.checkoutdrawer.b9a30a1ea8": "THREAD & PERFECT FIT",
  "ui.components.checkoutdrawer.c54c43bce9": "United Kingdom",
  "ui.components.checkoutdrawer.c5f2e5b036": "Cardholder Name",
  "ui.components.checkoutdrawer.c7c382b622": "Digital delivery:",
  "ui.components.checkoutdrawer.cdf454532f": "City",
  "ui.components.checkoutdrawer.cf5118387a": "Street Address",
  "ui.components.checkoutdrawer.d6227bc859": "Artisan Discount:",
  "ui.components.checkoutdrawer.dd53a6fab6": "Margot Leone",
  "ui.components.checkoutdrawer.e0e504752d": "Your cart is empty.",
  "ui.components.checkoutdrawer.e752c37d3c": "Email address",
  "ui.components.checkoutdrawer.ef96dfe4a8": "01 Cart",
  "ui.components.checkoutdrawer.f0e9e5070f": "· Size preference:",
  "ui.components.checkoutdrawer.f4636bd5cb": "Payment successful",
  "ui.components.checkoutdrawer.fc87597780": "Credit Card Number",
  "ui.components.collaboratorsalesdashboard.043fe80209": "Blueprint Name",
  "ui.components.collaboratorsalesdashboard.0b6fc8c3b0": "Settlement",
  "ui.components.collaboratorsalesdashboard.137f305dc1": "Load Mock ERP Set:",
  "ui.components.collaboratorsalesdashboard.147d2b3a7d": "PDF Only",
  "ui.components.collaboratorsalesdashboard.1a880c2692": "Gross Rev",
  "ui.components.collaboratorsalesdashboard.1c56c5bc66": "Txn ID",
  "ui.components.collaboratorsalesdashboard.1d8888fd73": "Exposing class tags and data anchors for direct scanner mappings.",
  "ui.components.collaboratorsalesdashboard.1f45da6d71": "Search by Txn ID, buyer, or blueprint...",
  "ui.components.collaboratorsalesdashboard.20740c3c96": "Gross Min:",
  "ui.components.collaboratorsalesdashboard.214df98cf7": "Zero State",
  "ui.components.collaboratorsalesdashboard.2dfb97151b": "15% platform share",
  "ui.components.collaboratorsalesdashboard.356e220dac": "Printed Paper",
  "ui.components.collaboratorsalesdashboard.4f8724083c": "Net Income",
  "ui.components.collaboratorsalesdashboard.7882e18037": "Method:",
  "ui.components.collaboratorsalesdashboard.7ee25b4758": "All formats",
  "ui.components.collaboratorsalesdashboard.86841ad4ce": "Date",
  "ui.components.collaboratorsalesdashboard.a83f09f2cf": "ERP Data Connector",
  "ui.components.collaboratorsalesdashboard.a98a0ae9ae": "Artisan Standard",
  "ui.components.collaboratorsalesdashboard.abeebcec6a": "No limit",
  "ui.components.collaboratorsalesdashboard.b4508db59d": "Referral Fees",
  "ui.components.collaboratorsalesdashboard.c05b81f114": "Platform Fee",
  "ui.components.collaboratorsalesdashboard.c3659e7300": "Fixed rate:",
  "ui.components.collaboratorsalesdashboard.c6e5b678ba": "Format:",
  "ui.components.collaboratorsalesdashboard.c8ae57c2c8": "No sales logs matched your filter requirements.",
  "ui.components.collaboratorsalesdashboard.ccc0dcd97e": "Pending Settlement",
  "ui.components.collaboratorsalesdashboard.cf6971d02f": "Gross Revenue",
  "ui.components.collaboratorsalesdashboard.d4fc39e26c": "✦ Ready for instant payouts",
  "ui.components.collaboratorsalesdashboard.e49503f8a7": "Reload from static config",
  "ui.components.collaboratorsalesdashboard.ea45d166bd": "Buyer",
  "ui.components.collaboratorsalesdashboard.fccac83699": "Format",
  "ui.components.consultationbookingmodal.028347d03c": "Scheduled Hour",
  "ui.components.consultationbookingmodal.039c8f2ed3": "Date Assigned",
  "ui.components.consultationbookingmodal.0a59de0f22": "Close Consultation Panel",
  "ui.components.consultationbookingmodal.0db2c53187": "Focus Topic",
  "ui.components.consultationbookingmodal.17f107b5af": "Haute Couture / Professional",
  "ui.components.consultationbookingmodal.1fc4a3bb38": "Awaiting Date Selection",
  "ui.components.consultationbookingmodal.2049e166c7": "Sewing skill:",
  "ui.components.consultationbookingmodal.2271d25563": "Confirm 15-Minute Consultation Session",
  "ui.components.consultationbookingmodal.23780f55d7": "Fr",
  "ui.components.consultationbookingmodal.2540374854": "You have not booked any live 15-minute briefings with Madame Elena's pattern cutting staff yet.",
  "ui.components.consultationbookingmodal.2a017e9f87": "Mo",
  "ui.components.consultationbookingmodal.2c2fabf9c4": "Schedule a 1-on-1 virtual drafting briefing",
  "ui.components.consultationbookingmodal.2c3f4fc673": "Su",
  "ui.components.consultationbookingmodal.30849a620d": "Selected Date:",
  "ui.components.consultationbookingmodal.3fe4c7cb09": "Step 1: Choose Your Atelier Expert",
  "ui.components.consultationbookingmodal.42b26ebdda": "Step 2: Select Consultation Date",
  "ui.components.consultationbookingmodal.435bff609d": "Hosted securely on encrypted Google Meet server.",
  "ui.components.consultationbookingmodal.459b8d6f3b": "We will send the calendar invite and Google Meet room instructions to this address instantly.",
  "ui.components.consultationbookingmodal.45c93a47b1": "Available Slot",
  "ui.components.consultationbookingmodal.487fff9269": "Booking ID",
  "ui.components.consultationbookingmodal.4ee2bbb7b5": "Cancel consultation briefing",
  "ui.components.consultationbookingmodal.4fe8bb9211": "Appointment Secured",
  "ui.components.consultationbookingmodal.53da8ec49c": "Sa",
  "ui.components.consultationbookingmodal.581d40ba5a": "View Active Sessions List",
  "ui.components.consultationbookingmodal.5b2baf7a07": "Step 4: Align Briefing Parameters",
  "ui.components.consultationbookingmodal.5b3f7d97c5": "We",
  "ui.components.consultationbookingmodal.6d1e2e81f5": "Previous Month",
  "ui.components.consultationbookingmodal.73660e5eed": "Book Session",
  "ui.components.consultationbookingmodal.7a8c625b55": "Meeting Link Room:",
  "ui.components.consultationbookingmodal.8163d7ab8e": "Fabric Sourcing & Grainlines advice",
  "ui.components.consultationbookingmodal.854903f97d": "Garment / Blueprint Focus:",
  "ui.components.consultationbookingmodal.8686024544": "Next Month",
  "ui.components.consultationbookingmodal.86cbc61b1d": "Book Another Briefing",
  "ui.components.consultationbookingmodal.88d6e2496f": "Cancel Session",
  "ui.components.consultationbookingmodal.8b0a0b10fc": "Focus:",
  "ui.components.consultationbookingmodal.91cb839754": "A confirmation docket has been registered inside our local workshop registry file. Madam Elena's team is looking forward to the call!",
  "ui.components.consultationbookingmodal.95e36b9efd": "Wide Leg Palazzo Trousers",
  "ui.components.consultationbookingmodal.9f34569d1d": "Atelier Consultation Scheduled",
  "ui.components.consultationbookingmodal.a2cc10defd": "Get 15 minutes of live guidance with a senior pattern cutter. We will review your measurements, alignment parameters, yardage calculations, or customized bodice sizing grids directly.",
  "ui.components.consultationbookingmodal.a71f238c26": "Th",
  "ui.components.consultationbookingmodal.a9332947b0": "mstefm55@gmail.com",
  "ui.components.consultationbookingmodal.abb441fb03": "My Consultations",
  "ui.components.consultationbookingmodal.ac07107547": "Step 3: Select Available 15-Min Slot",
  "ui.components.consultationbookingmodal.ad9058e5ab": "Pick an active date from the calendar widget to reveal Madame Elena and her team's consultation availability matrix.",
  "ui.components.consultationbookingmodal.b5ab877b4f": "e.g. I am running into trouble aligning the lapel notches for the tailored jacket. I would like to show you my current Muslin pattern draft on camera...",
  "ui.components.consultationbookingmodal.b90dcca4bb": "Tailored Tailcoat Jacket",
  "ui.components.consultationbookingmodal.bb36dff41d": "Aurelia Wrap Dress Series",
  "ui.components.consultationbookingmodal.bd1804f60b": "No Active Consultations",
  "ui.components.consultationbookingmodal.c1dff2b6cd": "Asymmetric Slip Dress Series",
  "ui.components.consultationbookingmodal.c2f22b7bf9": "Sessions are hosted via Google Meet video conference.",
  "ui.components.consultationbookingmodal.cc67294bc5": "Tu",
  "ui.components.consultationbookingmodal.d0e9f882f5": "Schedule Now",
  "ui.components.consultationbookingmodal.d63bc7ae8c": "Sewing Skill Level:",
  "ui.components.consultationbookingmodal.d910dfbe65": "Close Desk",
  "ui.components.consultationbookingmodal.e6f7b16bfc": "Selected",
  "ui.components.consultationbookingmodal.e7dfcf66ba": "Live Briefing Room Link:",
  "ui.components.consultationbookingmodal.e9700be5e4": "Bespoke Bodice Sloper adjustments",
  "ui.components.consultationbookingmodal.f4e1d88135": "Time slot:",
  "ui.components.consultationbookingmodal.fae649d402": "Design Consultations Desk",
  "ui.components.consultationbookingmodal.fc27059093": "Your Contact Email Address:",
  "ui.components.creationsandfeedback.00cf0c1725": "In-House Couturier Reply",
  "ui.components.creationsandfeedback.06c7495413": "Show:",
  "ui.components.creationsandfeedback.0771f41151": "Your stars rating, comment tips, and specifications have been added to the guestbook records.",
  "ui.components.creationsandfeedback.0b231f9af8": "Review Title Summary",
  "ui.components.creationsandfeedback.0de9d20cf4": "Size:",
  "ui.components.creationsandfeedback.0e4bf5fc60": "Remove Photo",
  "ui.components.creationsandfeedback.11a6e1eddb": "No entries match your search query",
  "ui.components.creationsandfeedback.15d0aaec5b": "General Feedback",
  "ui.components.creationsandfeedback.1729719ba3": "Helpful Likes",
  "ui.components.creationsandfeedback.191413bc67": "Difficulty Experienced",
  "ui.components.creationsandfeedback.1aa4aeb386": "Next Spotlight",
  "ui.components.creationsandfeedback.1d028977b5": "Atelier Exhibition",
  "ui.components.creationsandfeedback.2136f56251": "Most Recent",
  "ui.components.creationsandfeedback.2572ab78e2": "Feedback",
  "ui.components.creationsandfeedback.2845658007": "Fabric Specification",
  "ui.components.creationsandfeedback.2863f5d5bc": "Supports PNG, JPG. Persistent in local session cache.",
  "ui.components.creationsandfeedback.2ccac6170d": "Share star ratings, fabric choices, and photos for a specific design.",
  "ui.components.creationsandfeedback.2d64c616fc": "Filter by:",
  "ui.components.creationsandfeedback.313fc75cc8": "Atelier Staff",
  "ui.components.creationsandfeedback.323b0f3035": "Publish your sewing feedback, fitting details, and photo to the showcase.",
  "ui.components.creationsandfeedback.34bc6ddf87": "Easy / Beginner",
  "ui.components.creationsandfeedback.353869e47b": "Verified Atelier User",
  "ui.components.creationsandfeedback.35d20ca22d": "Write a Review",
  "ui.components.creationsandfeedback.3836718ee6": "Explore sewing results, custom fabric choices, and grading tips shared by couturiers worldwide. Leave your own star rating to guide our drafting team.",
  "ui.components.creationsandfeedback.3972132a6b": "Document Your Finished Make",
  "ui.components.creationsandfeedback.3f652b5822": "Logging to Memory Vault...",
  "ui.components.creationsandfeedback.438504901e": "Size Crafted",
  "ui.components.creationsandfeedback.4d4a8c9f27": "Publish Entry",
  "ui.components.creationsandfeedback.4db557e3d6": "e.g. washed linen, silk satin",
  "ui.components.creationsandfeedback.4edb497ddf": "Post Another Entry",
  "ui.components.creationsandfeedback.50f7b4e376": "Previous Spotlight",
  "ui.components.creationsandfeedback.535d436bd2": "e.g. GenevieveSews",
  "ui.components.creationsandfeedback.5644052f75": "Pattern Creation / Review",
  "ui.components.creationsandfeedback.581f0c5ab0": "Atelier Verified Make",
  "ui.components.creationsandfeedback.5d7962288d": "Feature / Design Pattern Request",
  "ui.components.creationsandfeedback.5eaf347f94": "Highest Rated",
  "ui.components.creationsandfeedback.5fdf5006a9": "Maker Fitting Tip:",
  "ui.components.creationsandfeedback.61beeb0684": "Attached project snapshot",
  "ui.components.creationsandfeedback.6247ba091c": "No customer photos loaded for this pattern yet.",
  "ui.components.creationsandfeedback.6552573870": "Inspiration Board",
  "ui.components.creationsandfeedback.69cbf95cda": "e.g. yourname@example.com",
  "ui.components.creationsandfeedback.69ce41f9e8": "Size Sewed",
  "ui.components.creationsandfeedback.79c2731b02": "Your Name",
  "ui.components.creationsandfeedback.7a187b0268": "Supports PNG, JPEG. Persisted in dynamic cache state.",
  "ui.components.creationsandfeedback.7b2139e61a": "Purchased this pattern blueprint?",
  "ui.components.creationsandfeedback.7d7776357d": "Headline Title",
  "ui.components.creationsandfeedback.7f1545b433": "Fabric Used:",
  "ui.components.creationsandfeedback.7f59ba51fb": "Creation Published to Atelier Vault!",
  "ui.components.creationsandfeedback.83cbf187e7": "Fabric:",
  "ui.components.creationsandfeedback.84ad39d52e": "No reviews found matching these filter credentials.",
  "ui.components.creationsandfeedback.891cf66866": "Atelier Verified Sewist",
  "ui.components.creationsandfeedback.8994d78b8c": "Craft yours first and upload a photo above to display it here!",
  "ui.components.creationsandfeedback.946c9a38d3": "Share your experience, length alterations, or special techniques you liked...",
  "ui.components.creationsandfeedback.954702c736": "Designer / Maker Username",
  "ui.components.creationsandfeedback.980c00caf9": "e.g. Beautiful drape, clear French seam guide",
  "ui.components.creationsandfeedback.9bccbe9d62": "Overall Rating",
  "ui.components.creationsandfeedback.9f75b826e3": "e.g. Dream dress to style, fits true to standard chart sizing",
  "ui.components.creationsandfeedback.a105ff0918": "Write a comment or ask a question about their fabric...",
  "ui.components.creationsandfeedback.a2611203e4": "Click to upload",
  "ui.components.creationsandfeedback.a2ba273657": "Inspiration Spotlight • Community Showcase",
  "ui.components.creationsandfeedback.a68f96e466": "or drag and drop a beautiful finished garment snapshot",
  "ui.components.creationsandfeedback.ac04c1d62b": "Headline Summary Title",
  "ui.components.creationsandfeedback.afc05f0667": "Verified Maker",
  "ui.components.creationsandfeedback.b64b11826f": "View attached photo",
  "ui.components.creationsandfeedback.b65274c401": "Fabric Selection",
  "ui.components.creationsandfeedback.bdd8c5e422": "Challenging / Advanced",
  "ui.components.creationsandfeedback.beda14089a": "Try typing generic terms like \"wrap dress\", \"linen\", \"sizing\" or adjust filters.",
  "ui.components.creationsandfeedback.bf8b713852": "Real finished garments made by our talented global community of makers. Browse fabric choices, fit reviews, and finished project snapshots.",
  "ui.components.creationsandfeedback.c166d7d53d": "Detailed Review Comments / Fitting Tips / Sizing advice",
  "ui.components.creationsandfeedback.c6808ad127": "Authentic projects and fitting diagnostics for the",
  "ui.components.creationsandfeedback.cbb7158a7b": "Star Rating",
  "ui.components.creationsandfeedback.ce8363ae6f": "Click to browse file",
  "ui.components.creationsandfeedback.cf906ac0cc": "Sort by:",
  "ui.components.creationsandfeedback.df638fa153": "View Showroom Feed",
  "ui.components.creationsandfeedback.e03383344b": "Just Right / Intermediate",
  "ui.components.creationsandfeedback.e399f2f1d9": "Publish Review",
  "ui.components.creationsandfeedback.e850f32878": "Rate instruction booklets, website features, or request new drafts.",
  "ui.components.creationsandfeedback.e9ac653b33": "Atelier Creations in the Wild",
  "ui.components.creationsandfeedback.ee01305714": "e.g. GenevieveSews or Clara_M",
  "ui.components.creationsandfeedback.f05ec1773e": "Cancel",
  "ui.components.creationsandfeedback.f4ca0998a4": "Instruction Booklets Clarity",
  "ui.components.creationsandfeedback.f829fcaafb": "Primary Feedback Category",
  "ui.components.creationsandfeedback.f9229f4e32": "Document Your Make",
  "ui.components.creationsandfeedback.fb9d26010f": "e.g. Mediumweight Washed Belgian Linen",
  "ui.components.creationsandfeedback.fcdea15db4": "What would you like to post?",
  "ui.components.creationsandfeedback.fd5d8f8df0": "Your uploaded make draft",
  "ui.components.creationsandfeedback.feb3a3b760": "by",
  "ui.components.creationsandfeedback.ff1687a824": "Select Sewing Pattern Crafted",
  "ui.components.creationsandfeedback.ff893fc455": "Close",
  "ui.components.creatorblog.084698a4d1": "Story / Tip Content *",
  "ui.components.creatorblog.0c56905662": "No comment has been registered for this entry.",
  "ui.components.creatorblog.1997a0d9b7": "Leave a remark",
  "ui.components.creatorblog.1b85f2b7da": "#samaradrop",
  "ui.components.creatorblog.2b5f1b66a8": "12 posts",
  "ui.components.creatorblog.33bc8738c2": "Atelier Designer",
  "ui.components.creatorblog.35bcc60551": "Post Title / Entry Subject *",
  "ui.components.creatorblog.405060b9af": "Trending topics",
  "ui.components.creatorblog.4da7209af1": "Atelier Conduct Code",
  "ui.components.creatorblog.5083a3b8dd": "e.g. Margot Leone",
  "ui.components.creatorblog.544fd13c8d": "8 posts",
  "ui.components.creatorblog.56b96a1805": "Encouraging high quality sizing discussions, construction diaries, and supportive feedback. No commercial self-promotions.",
  "ui.components.creatorblog.5b65b7f2d5": "My Saved Blueprints",
  "ui.components.creatorblog.60d35e7d89": "Atelier Guild Groups",
  "ui.components.creatorblog.6b1ded5b9b": "28 posts",
  "ui.components.creatorblog.736e2f0c10": "Seasonal Guild Events",
  "ui.components.creatorblog.73a2034b1e": "Active Creators:",
  "ui.components.creatorblog.73dc4b8dd0": "Publish Post",
  "ui.components.creatorblog.762de0d4cc": "Gold Artisan",
  "ui.components.creatorblog.847e1ab56e": "19 posts",
  "ui.components.creatorblog.85f370014f": "Guild connection level",
  "ui.components.creatorblog.87447d5299": "#patternlab",
  "ui.components.creatorblog.92bc7b5a35": "Views of your post",
  "ui.components.creatorblog.97a77e83ca": "Publish to Atelier Community Feed",
  "ui.components.creatorblog.9983962eef": "Engagement:",
  "ui.components.creatorblog.9de7033c9c": "Start a post",
  "ui.components.creatorblog.9f1f22c5d7": "#fit-notes",
  "ui.components.creatorblog.ad7dcc233a": "Community mentor",
  "ui.components.creatorblog.b37648245a": "A social-style space for studio updates, behind-the-scenes process posts, and comments. Share your sartorial journey with fellow crafters.",
  "ui.components.creatorblog.b387d43e37": "e.g. fit-notes, palazzo, linen",
  "ui.components.creatorblog.b55e9cbb52": "Margot Leone",
  "ui.components.creatorblog.ba504adba4": "Your Name *",
  "ui.components.creatorblog.c05167b3a0": "Share a fitting note, production tip, or launch update with your audience in the Atelier Feed.",
  "ui.components.creatorblog.c6a0b455a2": "Posts This Week:",
  "ui.components.creatorblog.cab7bf7ee8": "Attach Pattern Sample Image",
  "ui.components.creatorblog.cd3abcdc4e": "Hobbyist Maker",
  "ui.components.creatorblog.d3e812f402": "Who viewed your profile",
  "ui.components.creatorblog.d83714aa44": "#makerstories",
  "ui.components.creatorblog.d9f9285978": "Create post",
  "ui.components.creatorblog.db1b92664a": "No articles are currently published. Be the first to start a thread!",
  "ui.components.creatorblog.df23e3a312": "Cancel",
  "ui.components.creatorblog.e3d439fe7e": "Type your comment...",
  "ui.components.creatorblog.e7b45efe45": "Send",
  "ui.components.creatorblog.e7c7b7d5ac": "Guild Role",
  "ui.components.creatorblog.eed0629070": "Review Comments",
  "ui.components.creatorblog.ef4ae5f396": "e.g. Adjusting the back waist curve on wide palazzo",
  "ui.components.creatorblog.f060a54bc2": "Write your sewing tips or custom fitting observations here...",
  "ui.components.creatorblog.fa6698a97b": "Copy Link to Post",
  "ui.components.creatorblog.fc01694eeb": "Pattern maker",
  "ui.components.developerintegrationmodal.02eacb7e5b": "Target CSS Selector",
  "ui.components.developerintegrationmodal.039f1cccc0": "If loading this store application inside an ERP portal iframe or auxiliary dashboard, transmit real-time payloads securely using standard HTML5 message brokers.",
  "ui.components.developerintegrationmodal.061d022149": ". When you click",
  "ui.components.developerintegrationmodal.09e1deff19": "Reset Catalog",
  "ui.components.developerintegrationmodal.0eaae08268": "Pattern Card Item",
  "ui.components.developerintegrationmodal.15921e4da2": "Load Active",
  "ui.components.developerintegrationmodal.1807b40c4a": "Main outer container representing a singular pattern blueprint.",
  "ui.components.developerintegrationmodal.194cc27c7d": "Close Console",
  "ui.components.developerintegrationmodal.205b2ba745": "Data Attributes Exposed",
  "ui.components.developerintegrationmodal.29d994e327": "Metadata Roles FAQ",
  "ui.components.developerintegrationmodal.2a09d1df54": "\"Reset Catalog\"",
  "ui.components.developerintegrationmodal.2b564e7e2f": ".erp-pattern-yardage",
  "ui.components.developerintegrationmodal.2ea51a6f38": "Fabric Suggestions",
  "ui.components.developerintegrationmodal.35ccdc0b65": "Option A: Global Namespace Injection",
  "ui.components.developerintegrationmodal.39ce527096": "ERP API Specs",
  "ui.components.developerintegrationmodal.3bcfd6aa02": "Will update main catalog view instantaneously.",
  "ui.components.developerintegrationmodal.4b609198b6": "Changes reset on browser refresh or with the",
  "ui.components.developerintegrationmodal.4df73773ad": "Clear storage override and reload original templates",
  "ui.components.developerintegrationmodal.53b2be0869": ".erp-pattern-price",
  "ui.components.developerintegrationmodal.57b2a95157": "Couture Element Snabbing Map",
  "ui.components.developerintegrationmodal.58652e2b18": "Expand the accordion items below to understand how specific sewing pattern properties mapped to dataset tags are structured for easy extraction, verification, and update loops by ERP systems.",
  "ui.components.developerintegrationmodal.5912eb6685": "data-erp-id, data-erp-category, data-erp-difficulty",
  "ui.components.developerintegrationmodal.5d7ca9235e": "Pattern Description",
  "ui.components.developerintegrationmodal.5ee81e690b": ".erp-pattern-fabrics",
  "ui.components.developerintegrationmodal.6e162cbf33": "Your ERP script can execute window-level injections. The store updates state instantly, keeping sizes, carts, and filters fully synchronized.",
  "ui.components.developerintegrationmodal.706f203e0d": "Copy to clipboard",
  "ui.components.developerintegrationmodal.719db7c5e3": "Our front-end utilizes standardized, hardcoded class names and semantic data attributes. This allows external crawlers, web extension plugins, and head-end scraper engines to read, audit, and assert pattern inventory states.",
  "ui.components.developerintegrationmodal.724f7642da": "Yardage requirements at standard 60-inch width.",
  "ui.components.developerintegrationmodal.7c2bdd330e": "// Enter custom pattern object or list array...",
  "ui.components.developerintegrationmodal.89c0b522ee": "Live ERP Simulation Panel",
  "ui.components.developerintegrationmodal.98ff6d114a": "Comma-delimited string representing suitable material structures.",
  "ui.components.developerintegrationmodal.9c4c88943c": "Dynamic JSON Payload",
  "ui.components.developerintegrationmodal.a3c4572eef": ", the store's React states will immediately repopulate, showing your newly integrated pattern live on the main Catalog grid and Orbit Carousel!",
  "ui.components.developerintegrationmodal.a93561d776": "window",
  "ui.components.developerintegrationmodal.a9a1dde083": "ERP Metadata Accordion Engine",
  "ui.components.developerintegrationmodal.aab0138872": "Push Dynamic Payload",
  "ui.components.developerintegrationmodal.b1eb97fddf": "Interactive ERP Simulator",
  "ui.components.developerintegrationmodal.b1f1e3a71e": "data-erp-price-pdf",
  "ui.components.developerintegrationmodal.b3c36d62b5": "Pattern Current Price",
  "ui.components.developerintegrationmodal.b42acf1841": "Target Field",
  "ui.components.developerintegrationmodal.b498bf30b9": "namespace as well as cross-frame message brokers. Your ERP can push fresh collections, modify existing price indices, or introduce single products dynamically without any system downtime or manual redeploys.",
  "ui.components.developerintegrationmodal.b9a30608a1": "Exposes raw floating-point pricing parameters for PDF / printed patterns.",
  "ui.components.developerintegrationmodal.ba43aaffca": "Option B: Cross-Document postMessage Dispatcher",
  "ui.components.developerintegrationmodal.c8d69f7382": "This frontend exposes two state-bound listeners on the global",
  "ui.components.developerintegrationmodal.c99662210b": "Specifications and mapping markers for real-time dynamic inventory catalog injections.",
  "ui.components.developerintegrationmodal.cdcb2e3cdf": "Catalog Engine Settings",
  "ui.components.developerintegrationmodal.d483ef21ca": "Pattern Display Title",
  "ui.components.developerintegrationmodal.d83b0fe6ee": "Yardage Specs",
  "ui.components.developerintegrationmodal.d8cc7dcd36": "Exposes the primary and secondary aesthetic description block.",
  "ui.components.developerintegrationmodal.d911012f61": "\"Generate Sample\"",
  "ui.components.developerintegrationmodal.da6a168e20": "Standard Class / Marker",
  "ui.components.developerintegrationmodal.de559a18f8": "Resolves clean, lowercase formatted couture title name of design.",
  "ui.components.developerintegrationmodal.e6388b636e": ".erp-pattern-title",
  "ui.components.developerintegrationmodal.e85ed919a8": "Scannable Data Attribute",
  "ui.components.developerintegrationmodal.e9ef2cd67b": "Zero-Block Real-Time Binding",
  "ui.components.developerintegrationmodal.ec4fdd4800": "Active",
  "ui.components.developerintegrationmodal.f1a3664d97": ".erp-pattern-card",
  "ui.components.developerintegrationmodal.f37b79c062": ".erp-pattern-description",
  "ui.components.developerintegrationmodal.f3bb60f700": "Purpose / Purpose-fit",
  "ui.components.developerintegrationmodal.f71e7ba6a2": "data-erp-price-printed",
  "ui.components.developerintegrationmodal.f7e4287236": "ERP Mapping Use-Case:",
  "ui.components.developerintegrationmodal.fb113e5e66": "\"Push Dynamic Catalog Payload\"",
  "ui.components.developerintegrationmodal.fdfb057e87": "Modify the payload JSON below or hit",
  "ui.components.developerintegrationmodal.ffa89f04c4": "handler.",
  "ui.components.dynamiclayout.062cceb574": "View administrative roles and component permissions matrix",
  "ui.components.dynamiclayout.0cdc48a7c0": "Full Name / Designer Alias",
  "ui.components.dynamiclayout.0e5495ab33": "Super Admin Executive Core",
  "ui.components.dynamiclayout.0efe266824": "Tell the administrator how these tools support your tailoring commissions or textile supply chains...",
  "ui.components.dynamiclayout.12deb4b05e": "Drafting custom blueprints or coordinating fabric supplies?",
  "ui.components.dynamiclayout.1bc4b8ae58": "Apply for Workspace Access",
  "ui.components.dynamiclayout.2162d0ac7c": "Security Privilege Upgrade",
  "ui.components.dynamiclayout.227ea68549": "Permissions Guide",
  "ui.components.dynamiclayout.23502c0154": "e.g. Jean-Luc Atelier",
  "ui.components.dynamiclayout.2bdfb9f563": "Submit Petition",
  "ui.components.dynamiclayout.3dd72f2ee8": "Accepts JSON-styled conditional visibility rules to morph the available workspace in real time based on active client credentials.",
  "ui.components.dynamiclayout.5d2bbbdd61": "Data-Driven Interface Architecture",
  "ui.components.dynamiclayout.5fc5225701": "Role-Based Dynamic Layout Workspace",
  "ui.components.dynamiclayout.662e2b6176": "credentials. Activate a higher role or modify the rules matrix to render this panel.",
  "ui.components.dynamiclayout.735f80e9df": "Request Access",
  "ui.components.dynamiclayout.7e32d1ccf5": "e.g. luc@ateliersartorial.com",
  "ui.components.dynamiclayout.81795648cb": "Professional Email",
  "ui.components.dynamiclayout.901087d2e2": "Target Role Privilege",
  "ui.components.dynamiclayout.996ac82901": "Consolidating all professional workspaces, layout block controllers, permissions configuration, and diagnostic telemetry into one unified ergonomic panel.",
  "ui.components.dynamiclayout.9d19f19dbe": "View dynamic layout documentation ledger",
  "ui.components.dynamiclayout.a569e619f1": "Comprehensive Administrator Console",
  "ui.components.dynamiclayout.ac3f2e49ac": "Access Guidelines",
  "ui.components.dynamiclayout.c15a4e8add": "Locked",
  "ui.components.dynamiclayout.c943e09314": "Access Restricted",
  "ui.components.dynamiclayout.cd59e865bb": "Submit an authorization credential request to the system administrator.",
  "ui.components.dynamiclayout.d283ebfd41": "Justification / Project Goals",
  "ui.components.dynamiclayout.dca8349afd": "Cancel",
  "ui.components.dynamiclayout.e2792e0874": "Authorized Workspace Upgrades",
  "ui.components.dynamiclayout.fe54a02130": "Granted",
  "ui.components.dynamicuiengine.08334c5852": "Partner",
  "ui.components.dynamicuiengine.0c5ead765f": "DIFFICULTY:",
  "ui.components.dynamicuiengine.0cdde1876e": "Add Dynamic Layout Block",
  "ui.components.dynamicuiengine.127b7264fd": "Block Rendering Component",
  "ui.components.dynamicuiengine.1f79da746d": "Atelier Banner Portrait",
  "ui.components.dynamicuiengine.2936d67359": "Casual Visitor",
  "ui.components.dynamicuiengine.2d3b0feec5": "Cancel",
  "ui.components.dynamicuiengine.2d8983e63d": "Atelier Reference Image ID #SART-228",
  "ui.components.dynamicuiengine.2edc720e5e": "Subtitle / Callout/ Badge",
  "ui.components.dynamicuiengine.3b3eabe0f4": "Professional Technical",
  "ui.components.dynamicuiengine.408039be88": "✦ Active Layout Block List",
  "ui.components.dynamicuiengine.44a5f4d0f3": "Technical Core Header",
  "ui.components.dynamicuiengine.4d02ac8fe2": "Public / Guest",
  "ui.components.dynamicuiengine.533b724a01": "✦ Dynamic Audience Perspective Simulator ✦",
  "ui.components.dynamicuiengine.54a47af7f0": "Administrator Core Control Panel",
  "ui.components.dynamicuiengine.5f9ac879b4": "Reset DB",
  "ui.components.dynamicuiengine.756c624880": "Header/Title Text",
  "ui.components.dynamicuiengine.7d2bc3cbf5": "PRO-TIP CORE ACCELERATOR",
  "ui.components.dynamicuiengine.7e173c21f2": "Raw Metadata JSON DB",
  "ui.components.dynamicuiengine.7f88d03ab1": "Atelier Highlight Note:",
  "ui.components.dynamicuiengine.7fcc05ab5b": "Save Segment",
  "ui.components.dynamicuiengine.85230ddb64": "Ver 1.4-DynamicDB",
  "ui.components.dynamicuiengine.86dab83208": "Active View Filter:",
  "ui.components.dynamicuiengine.86dc14f007": "Logged in:",
  "ui.components.dynamicuiengine.87d1a3f4ff": "Full detailed statistics, technical parameters, and structured grids",
  "ui.components.dynamicuiengine.8ebfacec39": "Reset metadata database to factory state",
  "ui.components.dynamicuiengine.90889915be": "Remove Node from database",
  "ui.components.dynamicuiengine.9ad7cbd5d3": "Custom Photo URL",
  "ui.components.dynamicuiengine.9da9bdf6e3": "Dynamic UI Engine",
  "ui.components.dynamicuiengine.b067c3592c": "Guest / Public",
  "ui.components.dynamicuiengine.b47c773846": "Perfect Fit Craftsmanship Captured",
  "ui.components.dynamicuiengine.b6c573817b": "Pro Partner",
  "ui.components.dynamicuiengine.ba32d95711": "Live Layout Nodes",
  "ui.components.dynamicuiengine.c657513a13": "Atelier Portrait Sketch",
  "ui.components.dynamicuiengine.cb9d69bfea": "Format: Standard JSON Object",
  "ui.components.dynamicuiengine.d1910ba3d3": "Administrator",
  "ui.components.dynamicuiengine.d87939ce01": "The layout list below morphs instantly. Visibility gates filter out sections lacking authorized credentials.",
  "ui.components.dynamicuiengine.de570db3fd": "This workspace utilizes a metadata-driven UI engine rendering profile and overview cards 100% based on active JSON stored in the local cache. Toggle views below.",
  "ui.components.dynamicuiengine.e0a0bb47ba": "DYNAMIC PORTRAIT MATRIX",
  "ui.components.dynamicuiengine.e834d383fd": "Less details, huge visual fonts, quick assimilation layouts",
  "ui.components.dynamicuiengine.e8b14f69c8": "Edit Node details",
  "ui.components.dynamicuiengine.f2a40ed7ad": "Insert dynamic UI layout JSON metadata here...",
  "ui.components.dynamicuiengine.f4102d1b01": "Commit Metaprogramming Changes",
  "ui.components.dynamicuiengine.fa24404e50": "EST. TIME:",
  "ui.components.dynamicuiengine.fef884f0cb": "Authorized privileges active. Modify profile metadata, enforce login gates, or live-edit UI codeblocks.",
  "ui.components.editorialacademy.0322079ac2": "Interactive Size Calculator",
  "ui.components.editorialacademy.1c5d054663": "This article matches standard specifications within the Aurelia and Atelier Trench garments. Be sure to link your sizing metrics in the",
  "ui.components.editorialacademy.2463afa9ae": "Timeless tailoring literature, step-by-step masterclasses, and textile directories curated for the sartorial mind.",
  "ui.components.editorialacademy.27f5bc408c": "✦ Sign Up for a Free Account in seconds ✦",
  "ui.components.editorialacademy.530dffdec0": "for automatic seam allowance calibrations.",
  "ui.components.editorialacademy.668cf9a699": "and",
  "ui.components.editorialacademy.736ce2b134": "Close Reader",
  "ui.components.editorialacademy.7668282934": "By understanding fiber drapes, cutter blueprints, and tension dynamics, we elevate amateur sewing projects to authentic heirloom garments. Practice these step-by-step layouts, source real organic fibers, and build confidence in your slowly constructed capsule wardrobe.",
  "ui.components.editorialacademy.89d6e044a3": "Atelier Library",
  "ui.components.editorialacademy.a0b1dccd7e": "Sign In / Create Account",
  "ui.components.editorialacademy.ae7c242c45": "Atelier Collaborators",
  "ui.components.editorialacademy.aeaee177dd": "Saved Material:",
  "ui.components.editorialacademy.bd1a68396f": "Premium Atelier Content Locked",
  "ui.components.editorialacademy.c2839c94fb": "Artisan Sizing Integration",
  "ui.components.editorialacademy.d2519f9c12": "Regular Buyers",
  "ui.components.editorialacademy.d38038c6d1": "This sizing layout adjustment blueprint or sewing tutorial is reserved exclusively for our registered",
  "ui.components.erpsyncdashboard.00f90e801a": "API Interface",
  "ui.components.erpsyncdashboard.0f1d6689fe": "Scanning active viewport nodes, searching for matching `data-erp-id` metadata tags and document structured scripts...",
  "ui.components.erpsyncdashboard.1242d6ef7c": "[WARN] Checked size matrix target [data-erp-patt-sizes] - found 1 unresolved node reference.",
  "ui.components.erpsyncdashboard.16584fad4a": "window.setSartorialPatterns",
  "ui.components.erpsyncdashboard.2dc1e77a11": "* Simulating backend warning state. Code anchors are safe.",
  "ui.components.erpsyncdashboard.470dd5e703": "[2026-07-04T16:04:30] Initiating background listener socket on port 3000...",
  "ui.components.erpsyncdashboard.494ae5867e": "Pending",
  "ui.components.erpsyncdashboard.55011065f6": "Selector target",
  "ui.components.erpsyncdashboard.62c331748a": "Dynamic Scraper Verification Failure",
  "ui.components.erpsyncdashboard.63fbbebc58": "Mapping Error",
  "ui.components.erpsyncdashboard.6927d651d8": "Integration Rate",
  "ui.components.erpsyncdashboard.6dcf818ffb": "Anchor class:",
  "ui.components.erpsyncdashboard.707a07aa68": "This interactive dashboard charts and audits elements of the Perfect Fit Bureau storefront mapped directly to backend systems. Use the scanner below to verify DOM bindings, class markers, and metadata integrations in real-time.",
  "ui.components.erpsyncdashboard.710d08d6f7": "Major App Component Mapping Ledger",
  "ui.components.erpsyncdashboard.74d150a361": "Hot-Patch Connection",
  "ui.components.erpsyncdashboard.8e6fec8865": "Verified:",
  "ui.components.erpsyncdashboard.9b81b476fc": "* Click Status Badge on any row to toggle state and test pipeline fallback alerts.",
  "ui.components.erpsyncdashboard.b866d8f7c6": "[OK] Registered postMessage HTML5 cross-origin event receiver.",
  "ui.components.erpsyncdashboard.c3f9807429": "[OK] Registered window.setSartorialPatterns API in window global namespace.",
  "ui.components.erpsyncdashboard.c4d4237773": "ERP Content Sync Dashboard",
  "ui.components.erpsyncdashboard.d4e653c737": "Last Scraper Run",
  "ui.components.erpsyncdashboard.f6c5748303": "Synced",
  "ui.components.erpsyncdashboard.f6dcc7d509": "Click to toggle simulated connection state",
  "ui.components.fabricstashmodal.05ba86e654": "Qty / Length",
  "ui.components.fabricstashmodal.0a7dabcc5d": "Receive material",
  "ui.components.fabricstashmodal.0f5e7b1f56": "Replenish at",
  "ui.components.fabricstashmodal.14244f2891": "PANTONE® TCX specification",
  "ui.components.fabricstashmodal.1472691028": "Derived status",
  "ui.components.fabricstashmodal.1543a15d01": "Issue / consume material",
  "ui.components.fabricstashmodal.17858fc64a": "No suppliers registered yet. Add one from Supplier Directory.",
  "ui.components.fabricstashmodal.18fe3f8502": "No yarn finishes selected.",
  "ui.components.fabricstashmodal.191718b511": "Qty / UOM",
  "ui.components.fabricstashmodal.1bc165702a": "Cancel",
  "ui.components.fabricstashmodal.1d4dde979c": "White Sand",
  "ui.components.fabricstashmodal.1f030d13d2": "Yarn quality",
  "ui.components.fabricstashmodal.20b3267cae": "Linked suppliers",
  "ui.components.fabricstashmodal.23c16dfc56": "Selected yarn special finishes",
  "ui.components.fabricstashmodal.24c6e76a41": "Total materials",
  "ui.components.fabricstashmodal.2534e53b32": "No special finishes selected.",
  "ui.components.fabricstashmodal.26fc9a9200": "Status",
  "ui.components.fabricstashmodal.295c4c4b1d": "Optional project, style or job reference",
  "ui.components.fabricstashmodal.2b7bbb3fb5": "Width",
  "ui.components.fabricstashmodal.2e07e6e6b9": "The transaction reduces the material's active quantity immediately. Inventory value falls using the material's current weighted-average unit price.",
  "ui.components.fabricstashmodal.2eab0caeed": "Note",
  "ui.components.fabricstashmodal.30570074f8": "Email:",
  "ui.components.fabricstashmodal.3091774c09": "Primary supplier",
  "ui.components.fabricstashmodal.30e3bdbdca": "Add special yarn finish",
  "ui.components.fabricstashmodal.3161141d75": "Provider-ready reference for EIP V1.",
  "ui.components.fabricstashmodal.335a825c91": "Colour",
  "ui.components.fabricstashmodal.369a653ce4": "Upload",
  "ui.components.fabricstashmodal.36d0107c2e": "Swatch only",
  "ui.components.fabricstashmodal.3735c8652a": "Back",
  "ui.components.fabricstashmodal.3d9c61ed1a": "Unit price:",
  "ui.components.fabricstashmodal.3de3f184cf": "Leave quantity blank/0 for swatch-only. Enter quantity or enable inventory tracking for stock control.",
  "ui.components.fabricstashmodal.3eccf987c7": "If changed, the material master width is updated when the receipt is posted.",
  "ui.components.fabricstashmodal.409cdd9bd6": "Add yarn type",
  "ui.components.fabricstashmodal.4629260f67": "Post transaction",
  "ui.components.fabricstashmodal.4932538286": "Pantone",
  "ui.components.fabricstashmodal.499b5d289d": "Phone:",
  "ui.components.fabricstashmodal.4a1e81c6f5": "Save supplier",
  "ui.components.fabricstashmodal.4b55a2e90f": "Add material",
  "ui.components.fabricstashmodal.4c4d59e4d5": "Floating quick-access workspace",
  "ui.components.fabricstashmodal.4cb2407793": "No suppliers registered yet.",
  "ui.components.fabricstashmodal.4d2c0d4904": "Create new yarn finish",
  "ui.components.fabricstashmodal.4daa6d3c09": "Close materials modal",
  "ui.components.fabricstashmodal.4e0e1b2e99": "Quantity × unit price in the selected inventory UOM.",
  "ui.components.fabricstashmodal.51b78c6439": "Ordered",
  "ui.components.fabricstashmodal.5223058c5d": "Delete supplier",
  "ui.components.fabricstashmodal.5286f6bb08": "Yarn composition",
  "ui.components.fabricstashmodal.533fd9b4bf": "Colour category",
  "ui.components.fabricstashmodal.58565143eb": "Register supplier",
  "ui.components.fabricstashmodal.5cdf2d1663": "Material colour",
  "ui.components.fabricstashmodal.5f5a576587": "Received width",
  "ui.components.fabricstashmodal.62d20f1361": "Resize materials modal",
  "ui.components.fabricstashmodal.6647880956": "Stock synced",
  "ui.components.fabricstashmodal.6835768ba6": "Fabric specs",
  "ui.components.fabricstashmodal.6a95041cbb": "Optional",
  "ui.components.fabricstashmodal.6b59215fa1": "Received quantity",
  "ui.components.fabricstashmodal.6ba124c271": "No incoming materials. Use the replenish action from a low-stock material.",
  "ui.components.fabricstashmodal.6e7bcd4aaa": "Search material, colour, Pantone, supplier, finish, location...",
  "ui.components.fabricstashmodal.6e86bdefdd": "Replenish stock",
  "ui.components.fabricstashmodal.70a9432d9a": "Issue / Consume",
  "ui.components.fabricstashmodal.732c35d33e": "Incoming value",
  "ui.components.fabricstashmodal.745ef95121": "Quantity / length",
  "ui.components.fabricstashmodal.7671a9629f": "Save",
  "ui.components.fabricstashmodal.767a92a734": "Stock transaction",
  "ui.components.fabricstashmodal.786ff927ca": "Material",
  "ui.components.fabricstashmodal.7a81380cea": "Take photo",
  "ui.components.fabricstashmodal.7d65a553b6": "Actions",
  "ui.components.fabricstashmodal.7ed793d224": "Stop / retake later",
  "ui.components.fabricstashmodal.7f24d55b1f": "Open supplier directory",
  "ui.components.fabricstashmodal.84406e048c": "Materials modal minimized. Restore to edit swatches and active inventory.",
  "ui.components.fabricstashmodal.848198146f": "Receipt note",
  "ui.components.fabricstashmodal.8992cd6cdb": "Track as inventory item",
  "ui.components.fabricstashmodal.8af38ebf17": "No materials match the current search/filter.",
  "ui.components.fabricstashmodal.8b0b4e3299": "Swatch/category only",
  "ui.components.fabricstashmodal.8b85666bf7": "Delivery reference",
  "ui.components.fabricstashmodal.8d54f3cede": "Delete",
  "ui.components.fabricstashmodal.8d8c240a22": "Reference / project",
  "ui.components.fabricstashmodal.8db70d17ed": "Transaction",
  "ui.components.fabricstashmodal.9367fdb097": "View incoming",
  "ui.components.fabricstashmodal.93966ad789": "Location:",
  "ui.components.fabricstashmodal.93d6e5750d": "Active inventory",
  "ui.components.fabricstashmodal.947639d316": "Capture",
  "ui.components.fabricstashmodal.97566f5823": "Close material issue",
  "ui.components.fabricstashmodal.97a46151f2": "Lead time:",
  "ui.components.fabricstashmodal.9893ee3528": "Yarn count",
  "ui.components.fabricstashmodal.a15130782b": "Incoming:",
  "ui.components.fabricstashmodal.a1fe8af318": "Keep enabled if zero quantity should mean out of stock instead of swatch-only.",
  "ui.components.fabricstashmodal.a28ddd5036": "Inventory location",
  "ui.components.fabricstashmodal.ae1b243b2e": "Cancelled",
  "ui.components.fabricstashmodal.ae6d08206a": "Currency",
  "ui.components.fabricstashmodal.af303afe92": "All material states",
  "ui.components.fabricstashmodal.af35992511": "Unit price",
  "ui.components.fabricstashmodal.b2a7b54c87": "Confirm receipt",
  "ui.components.fabricstashmodal.b4fa557686": "Incoming / date",
  "ui.components.fabricstashmodal.b6ac7d6d4d": "Notes",
  "ui.components.fabricstashmodal.bb9a90e60d": "Stock is synchronized only after confirming this receipt.",
  "ui.components.fabricstashmodal.bbcafa0254": "Quantity issued / consumed",
  "ui.components.fabricstashmodal.bc7ac38ab9": "No replenishment",
  "ui.components.fabricstashmodal.bd06c46fd5": "Low stock threshold",
  "ui.components.fabricstashmodal.be6b392469": "Select supplier",
  "ui.components.fabricstashmodal.c0be77dbe9": "Close goods receipt",
  "ui.components.fabricstashmodal.c4dc08c6d5": "Available",
  "ui.components.fabricstashmodal.c59a0d965b": "No yarn children yet. Add yarn types if this fabric requires separate yarn-level detail.",
  "ui.components.fabricstashmodal.c6b5808956": "Amount",
  "ui.components.fabricstashmodal.c9f115531d": "Inventory",
  "ui.components.fabricstashmodal.d073c99a30": "Pick from image/screen",
  "ui.components.fabricstashmodal.d0a40efcfe": "Inventory value",
  "ui.components.fabricstashmodal.d3306fa2e4": "Add yarn finish",
  "ui.components.fabricstashmodal.d347d5c470": "Orange / Rust",
  "ui.components.fabricstashmodal.d3df98c5a8": "Receive",
  "ui.components.fabricstashmodal.d41c3e3f41": "Supplier:",
  "ui.components.fabricstashmodal.d45703c28c": "Unit price / order value",
  "ui.components.fabricstashmodal.d485bbe6fb": "No photo uploaded",
  "ui.components.fabricstashmodal.d9a820847f": "Confirm what physically arrived. Received quantity and width may differ from the incoming order.",
  "ui.components.fabricstashmodal.e213d6eace": "Goods receipt",
  "ui.components.fabricstashmodal.e2580d8fbb": "Supplier",
  "ui.components.fabricstashmodal.e41cb0f853": "Reorder point",
  "ui.components.fabricstashmodal.e6e17abe75": "Fabric finish",
  "ui.components.fabricstashmodal.e925c46244": "View / Edit",
  "ui.components.fabricstashmodal.eea8d22870": "Swatch + active inventory",
  "ui.components.fabricstashmodal.efc3bdb984": "Contact:",
  "ui.components.fabricstashmodal.f373ca9597": "Yarn specs",
  "ui.components.fabricstashmodal.f4f32f306b": "Material detail editor",
  "ui.components.fabricstashmodal.fad63eab45": "e.g. 150 cm",
  "ui.components.fabricstashmodal.fc1473dc23": "Close material editor",
  "ui.components.fabricstashmodal.fd2ea2b170": "Create new finish",
  "ui.components.fabricstashmodal.fdf5ed5d7f": "Add special finish",
  "ui.components.fabricyardagecalculator.1158e2693d": "Nesting Grain Complexity:",
  "ui.components.fabricyardagecalculator.17c35e6c90": "Bespoke Yardage Sidebar",
  "ui.components.fabricyardagecalculator.1c3118187c": "Estimated Fabric Requirement",
  "ui.components.fabricyardagecalculator.23b86cf0c9": "Yards",
  "ui.components.fabricyardagecalculator.30078f30a7": "3. Design Layout Complexity",
  "ui.components.fabricyardagecalculator.30c63b2ee2": "Lining Backing:",
  "ui.components.fabricyardagecalculator.30e6332f53": "Garment Size:",
  "ui.components.fabricyardagecalculator.35fc2da77f": "Fusible Interfacing:",
  "ui.components.fabricyardagecalculator.40eace2275": "Fabric Fibers:",
  "ui.components.fabricyardagecalculator.461467c9fb": "1. Active Pattern / Variant",
  "ui.components.fabricyardagecalculator.4b6778485a": "Shell Fabric:",
  "ui.components.fabricyardagecalculator.4e110b5911": "Yds",
  "ui.components.fabricyardagecalculator.579d077113": "Adjust Parameters on the fly:",
  "ui.components.fabricyardagecalculator.6034bc97be": "Adjust fabric requirement calculations based on piece shape complexity and cut directions.",
  "ui.components.fabricyardagecalculator.68d5a19f83": "5. Canonical Garment Size",
  "ui.components.fabricyardagecalculator.7a1b4b45ec": "2. Fabric Bolt Width",
  "ui.components.fabricyardagecalculator.7b9151da1b": "Connected to design canvas",
  "ui.components.fabricyardagecalculator.967b69be6b": "4. Fabric Print Repeat or Nap",
  "ui.components.fabricyardagecalculator.9e53075056": "Copy Spec Sheet",
  "ui.components.fabricyardagecalculator.a3a36924a1": "Include Lining Fabric",
  "ui.components.fabricyardagecalculator.a92b90e6eb": "Nesting Bolt Preview",
  "ui.components.fabricyardagecalculator.aa0ea973ab": "Standard Grade",
  "ui.components.fabricyardagecalculator.acab8761ac": "Not included",
  "ui.components.fabricyardagecalculator.b055e8a47e": "Estimates adhesive tailoring structure canvas",
  "ui.components.fabricyardagecalculator.b8e346bdc8": "Apply to Active Session",
  "ui.components.fabricyardagecalculator.bdd538f7b7": "Open Interactive Yardage Sidebar",
  "ui.components.fabricyardagecalculator.bedc4cb6f6": "Include Fusible Interfacing",
  "ui.components.fabricyardagecalculator.c3a7eb668c": "Live Result Sidebar",
  "ui.components.fabricyardagecalculator.c56eb2c418": "Component Materials Breakdown",
  "ui.components.fabricyardagecalculator.d6f7f94cc0": "Meters",
  "ui.components.fabricyardagecalculator.d7f5d2ddc8": "Complexity:",
  "ui.components.fabricyardagecalculator.e0608e468a": "Mtrs",
  "ui.components.fabricyardagecalculator.e08ba059a8": "Estimate shell material, lining and interfacing needs from the active pattern, Measurement Chart size and fabric layout settings.",
  "ui.components.fabricyardagecalculator.e18ece6ad3": "Estimates backing silk / acetate yards",
  "ui.components.fabricyardagecalculator.f233320bbe": "Live calculations pinned to your fitting room",
  "ui.components.fabricyardagecalculator.f2e73c6fe6": "Pin Sidebar",
  "ui.components.fabricyardagecalculator.f85f2f81a1": "Dynamic estimate factoring seam allowance & grain layout buffers.",
  "ui.components.femalemeasurementavatar.00e9857f3b": "+ Add measurement point",
  "ui.components.femalemeasurementavatar.07e4bd5384": "Resolved avatar-area metadata JSON",
  "ui.components.femalemeasurementavatar.0cfa764e97": "Delete",
  "ui.components.femalemeasurementavatar.250d5a0392": "Line style",
  "ui.components.femalemeasurementavatar.27d9efc092": "Metadata JSON",
  "ui.components.femalemeasurementavatar.4c2ee978f1": "Close",
  "ui.components.femalemeasurementavatar.689dfb730a": "Edit layout",
  "ui.components.femalemeasurementavatar.6e138040a8": "Cancel",
  "ui.components.femalemeasurementavatar.78ae41b3a7": "Guide line style",
  "ui.components.femalemeasurementavatar.823a874653": "Close guide line style editor",
  "ui.components.femalemeasurementavatar.84e7fb6980": "Reset view",
  "ui.components.femalemeasurementavatar.85bbe74032": "Points",
  "ui.components.femalemeasurementavatar.8b4c381362": "Freeze",
  "ui.components.femalemeasurementavatar.8b8d109bdc": "Close line style editor",
  "ui.components.femalemeasurementavatar.a853e06491": "Measurement name",
  "ui.components.femalemeasurementavatar.b239c2950d": "Measurement points",
  "ui.components.femalemeasurementavatar.b5abf938bd": "Start point · green",
  "ui.components.femalemeasurementavatar.b86befc8da": "Add",
  "ui.components.femalemeasurementavatar.c530d1b2c1": "Drag measurement tape middle shape point",
  "ui.components.femalemeasurementavatar.caff1ff7f8": "Open curve",
  "ui.components.femalemeasurementavatar.e904906f0c": "End point · red",
  "ui.components.femalemeasurementavatar.e971be2b5d": "Horizontal width",
  "ui.components.femalemeasurementavatar.e9c61975cf": "Vertical / point-to-point",
  "ui.components.femalemeasurementavatar.fbf9d1e8a9": "Drag measurement tape start point",
  "ui.components.femalemeasurementavatar.fc53cfa7b5": "Closed circumference",
  "ui.components.femalemeasurementavatar.fd6d32d8ea": "Drag measurement tape end point",
  "ui.components.herocarousel.056382390e": "Perfect Fit lookbook background",
  "ui.components.herocarousel.1c2db4b675": "Next slide",
  "ui.components.herocarousel.4e51f53005": "Previous slide",
  "ui.components.herocarousel.7e701cd8f0": "Patterns Refined",
  "ui.components.herocarousel.84fe93b5a3": "For Modern Makers",
  "ui.components.herocarousel.c566fb7dc5": "Takes Shape",
  "ui.components.herocarousel.ca638e6222": "Where Fashion",
  "ui.components.herocarousel.e0098a0ea1": "Fit Perfectly.",
  "ui.components.herocarousel.f2df228bd0": "Sew Beautifully.",
  "ui.components.imageassetstudiomodal.0609bbddb7": "Editable source",
  "ui.components.imageassetstudiomodal.09e9e4edb1": "Brightness",
  "ui.components.imageassetstudiomodal.2049ee17ba": "Saturation",
  "ui.components.imageassetstudiomodal.2653fd1636": "Format",
  "ui.components.imageassetstudiomodal.2d2808da83": "Match ratio",
  "ui.components.imageassetstudiomodal.37a7c13168": "Select an image file to start editing.",
  "ui.components.imageassetstudiomodal.39eb99559e": "Reset",
  "ui.components.imageassetstudiomodal.3c715eebaa": "Cancel",
  "ui.components.imageassetstudiomodal.4819b067c3": "Size preset",
  "ui.components.imageassetstudiomodal.586a60ab4e": "Flip Y",
  "ui.components.imageassetstudiomodal.595041c223": "Contrast",
  "ui.components.imageassetstudiomodal.5c35979535": "Close",
  "ui.components.imageassetstudiomodal.6a88f09bae": "Rotation",
  "ui.components.imageassetstudiomodal.730a3995ed": "Apply crop",
  "ui.components.imageassetstudiomodal.7c8ebe23d1": "Width",
  "ui.components.imageassetstudiomodal.8156bf2e01": "Photo toolkit",
  "ui.components.imageassetstudiomodal.852b63c680": "Resize, crop, rotate, retouch, and export before upload.",
  "ui.components.imageassetstudiomodal.9d99da495e": "Workflow profiles",
  "ui.components.imageassetstudiomodal.ada64bb196": "Crop source",
  "ui.components.imageassetstudiomodal.b35a1af5e6": "Height",
  "ui.components.imageassetstudiomodal.cd6675e9a4": "Drag on image to reposition. Use zoom for crop precision.",
  "ui.components.imageassetstudiomodal.cf7ff75342": "Background",
  "ui.components.imageassetstudiomodal.d66ed5036d": "Flip X",
  "ui.components.imageassetstudiomodal.d7e67b2f29": "Zoom",
  "ui.components.imageassetstudiomodal.dfe1412d96": "Real crop tool",
  "ui.components.imageassetstudiomodal.e671467c7d": "Fit mode",
  "ui.components.imageassetstudiomodal.f1f32d7f7f": "Quality",
  "ui.components.imageassetstudiomodal.ff3a443680": "Blur",
  "ui.components.industrialtechpack.0df70b1e67": "for a production batch size of",
  "ui.components.industrialtechpack.194c3485b0": "• ERP Feed Active",
  "ui.components.industrialtechpack.23bec20e74": "At Efficiency Adjusted:",
  "ui.components.industrialtechpack.2687a33f3a": "Spec Qty / Pc",
  "ui.components.industrialtechpack.2c04122b07": "Industrial Quality Standard:",
  "ui.components.industrialtechpack.37859148a3": "Total Line Hours:",
  "ui.components.industrialtechpack.3a33a3e2d5": "Estimated Material Cost Per Unit:",
  "ui.components.industrialtechpack.3e8f77787b": "Precision engineering specs, industrial bill of materials, and production-line assembly times optimized for apparel manufacturing and commercial procurement.",
  "ui.components.industrialtechpack.456b954c18": "Manufacturing Logistics",
  "ui.components.industrialtechpack.48cb3af849": "Total SAM required:",
  "ui.components.industrialtechpack.4de333367c": "Unit Price",
  "ui.components.industrialtechpack.4de4af17fe": "Custom...",
  "ui.components.industrialtechpack.4ef23ce3df": "Assembly Operation Description",
  "ui.components.industrialtechpack.52665a76a4": "Standard Machine Class",
  "ui.components.industrialtechpack.5acf9e63ba": "Per Unit:",
  "ui.components.industrialtechpack.62d772d3cd": "Total Material Cost",
  "ui.components.industrialtechpack.695e24e386": "Line Assembly Throughput",
  "ui.components.industrialtechpack.69c5789691": "Assembly Line Operations:",
  "ui.components.industrialtechpack.7560e0ef88": "Total Factory Sewing Labor:",
  "ui.components.industrialtechpack.793e1ea433": "Material / Spec",
  "ui.components.industrialtechpack.81a0937d6e": "FOB Target Price",
  "ui.components.industrialtechpack.8bfce6709f": "Supplier Network",
  "ui.components.industrialtechpack.92234bb39d": "Standardized material spec codes linked with direct suppliers.",
  "ui.components.industrialtechpack.93b6401730": "Industrial Grade Specs",
  "ui.components.industrialtechpack.94d5add003": "Total Raw Materials:",
  "ui.components.industrialtechpack.97050d2dc8": "Est. Batch Cost:",
  "ui.components.industrialtechpack.ac8186a006": "Total Sewing Labor SAM:",
  "ui.components.industrialtechpack.af57bed378": "Stitch ISO Standard Compliant",
  "ui.components.industrialtechpack.b162c8a69b": "Sewing Class",
  "ui.components.industrialtechpack.b2623546e6": "Est. Cost / Pc",
  "ui.components.industrialtechpack.b60009fc90": "Critical Path Stage:",
  "ui.components.industrialtechpack.bd025c41ee": "Production Line Target Efficiency:",
  "ui.components.industrialtechpack.c0f741ffd5": "Garment SAM",
  "ui.components.industrialtechpack.c31a0d64c1": "Total Batch Labor",
  "ui.components.industrialtechpack.d286a8ab93": "Unit Sewing Labor Cost:",
  "ui.components.industrialtechpack.d6b5e95260": "Seq",
  "ui.components.industrialtechpack.dba399c4e4": "Per Unit Est:",
  "ui.components.industrialtechpack.dcc6c66665": "Total Manufacturing Cost:",
  "ui.components.industrialtechpack.e09424e0aa": "This analysis simulates the logistics requirements for",
  "ui.components.industrialtechpack.e2c779efea": "Yield Efficiency Rate",
  "ui.components.industrialtechpack.e3b265a4aa": "Manufacturing Routing sequence",
  "ui.components.industrialtechpack.f4477799cc": "Active Target Quantity:",
  "ui.components.industrialtechpack.f697f2a815": "Batch Size:",
  "ui.components.industrialtechpack.f8e2994f0d": "1. Production Batch Configurator",
  "ui.components.instructionspdfmodal.01e4e8436c": "Required Notions",
  "ui.components.instructionspdfmodal.036b46bb07": "III. Step-by-Step Construction Guide",
  "ui.components.instructionspdfmodal.04a4dac4c6": "1.5m",
  "ui.components.instructionspdfmodal.063835ad30": "EST. CONSTRUCTION:",
  "ui.components.instructionspdfmodal.086e601b49": "Hips",
  "ui.components.instructionspdfmodal.0a602b99e5": "© 2026 ALL RIGHTS RESERVED",
  "ui.components.instructionspdfmodal.0c689cb5f2": "2.0m",
  "ui.components.instructionspdfmodal.2249a61e88": "Formatting vector sheets to active page scale...",
  "ui.components.instructionspdfmodal.30e3445f9d": "2.5m",
  "ui.components.instructionspdfmodal.330b54ed02": "PREPARING ATELIER SPOOL DIALOGUE...",
  "ui.components.instructionspdfmodal.376bbc39c0": "0.5m",
  "ui.components.instructionspdfmodal.3c44116387": "Yardage",
  "ui.components.instructionspdfmodal.511128844b": "Atelier Masterclass Pro-Tips",
  "ui.components.instructionspdfmodal.52b1a8c2ed": "DIFFICULTY:",
  "ui.components.instructionspdfmodal.52f91d50cf": "Print Specimen",
  "ui.components.instructionspdfmodal.537266b71f": "3.0m",
  "ui.components.instructionspdfmodal.55e9aa062e": "Selvage Edge",
  "ui.components.instructionspdfmodal.5abdc1330e": "DESIGNER SAMPLE ONLY • NOT FOR REPRODUCTION",
  "ui.components.instructionspdfmodal.5b5765e72e": "PERFECT FIT BUREAU COUTURE SYSTEMS",
  "ui.components.instructionspdfmodal.63d36933dc": "Size",
  "ui.components.instructionspdfmodal.67c8d19c61": "DETAILED ASSEMBLY INSTRUCTION BOOKLET • SPECIMEN EDITION",
  "ui.components.instructionspdfmodal.6a23afe391": "Bust",
  "ui.components.instructionspdfmodal.71b70b90c4": "A wooden clapper locks raw tailoring folds infinitely better than iron pressure alone.",
  "ui.components.instructionspdfmodal.762fd42abe": "Full instruction booklets contain 12 additional sizing schematics and direct CAD files.",
  "ui.components.instructionspdfmodal.93a7017b18": "Generating high-fidelity 2-page print layout package...",
  "ui.components.instructionspdfmodal.95db4a3967": "0m",
  "ui.components.instructionspdfmodal.992480c67c": "Next Page",
  "ui.components.instructionspdfmodal.9946713355": "Always stitch sample seam scraps before assembly to tune tension for delicate fibers.",
  "ui.components.instructionspdfmodal.ab5b31723a": "PERFECT FIT BUREAU • PATTERN BLUEPRINT SYSTEM",
  "ui.components.instructionspdfmodal.ad3ed322b2": "Side-by-Side Dual Page View",
  "ui.components.instructionspdfmodal.b0deb735f8": "Specimen ID:",
  "ui.components.instructionspdfmodal.b287b99956": "Fabric Width Required:",
  "ui.components.instructionspdfmodal.b29c358cc2": "Close PDF Specimen",
  "ui.components.instructionspdfmodal.ba07c78e54": "COMPILING PDF BLUEPRINT VECTOR METADATA...",
  "ui.components.instructionspdfmodal.c432f3d451": "Waist",
  "ui.components.instructionspdfmodal.d06da95613": "1.0m",
  "ui.components.instructionspdfmodal.d2de11d5c9": "Zoom In",
  "ui.components.instructionspdfmodal.d4d7e107cf": "Previous Page",
  "ui.components.instructionspdfmodal.d99faa7753": "Single Page View",
  "ui.components.instructionspdfmodal.e387c67dfd": "Sent 2 vector pattern sheets directly to your default system spooler!",
  "ui.components.instructionspdfmodal.fab3f57083": "Zoom Out",
  "ui.components.mannequinguide.346546a745": "Age group",
  "ui.components.mannequinguide.652bd71582": "Avatar & profile",
  "ui.components.mannequinguide.666e9d0177": "Select a measurement relevant to the active avatar view.",
  "ui.components.mannequinguide.9d6cefa228": "Record the measured value for this point.",
  "ui.components.mannequinguide.a1c573ca5b": "Gender",
  "ui.components.mannequinguide.c2f37fbbae": "Measurement guide",
  "ui.components.mannequinguide.copy.0090979e1f": "Enter Your Measurements",
  "ui.components.mannequinguide.copy.022912fbb5": "Waist Girth",
  "ui.components.mannequinguide.copy.025943e7b2": "Securely sign in with Google to enable cloud backups, restore saved measurement ledgers, and export print-ready markdown specifications directly to your Drive workspace.",
  "ui.components.mannequinguide.copy.02b75ac9a8": "6. Hip Girth",
  "ui.components.mannequinguide.copy.03f894f377": "Restore",
  "ui.components.mannequinguide.copy.057c0ee645": "Cloud Active",
  "ui.components.mannequinguide.copy.08f99afa8b": "5. Waist Girth",
  "ui.components.mannequinguide.copy.0c314b1476": "Quick Sizing Presets",
  "ui.components.mannequinguide.copy.0f424d8488": "Dynamic couture measurement blueprint calculated in real-time.",
  "ui.components.mannequinguide.copy.10d935a032": "Ideal Pattern Size:",
  "ui.components.mannequinguide.copy.14e5df8790": "Active:",
  "ui.components.mannequinguide.copy.14f726651b": "Select a garment style above to overlay a 3D couture simulation and inspect draping ease tolerances based on your live measurement values.",
  "ui.components.mannequinguide.copy.18e78936b6": "7. Inseam Leg",
  "ui.components.mannequinguide.copy.1b8ca75e40": "Measure around your natural narrowest waistline, between ribs and hip bones.",
  "ui.components.mannequinguide.copy.1dbf924e40": "2. Shoulder Length",
  "ui.components.mannequinguide.copy.240030bef0": "No Perfect Fit Bureau backups found on your Drive.",
  "ui.components.mannequinguide.copy.27ab2aeef7": "Style Visualizer Engine",
  "ui.components.mannequinguide.copy.2e44e10567": "Connect to Google Drive to backup your bespoke fitting sheets and download custom tailoring reports.",
  "ui.components.mannequinguide.copy.2f6194b4e0": "Custom Paper Fitting Adjustments:",
  "ui.components.mannequinguide.copy.3032eee4c0": "1. Neck Girth",
  "ui.components.mannequinguide.copy.35175cc91b": "Sync List",
  "ui.components.mannequinguide.copy.38dd7429a4": "Bust/Chest Girth",
  "ui.components.mannequinguide.copy.398949c0e0": "Standard Size Conversion Matrix",
  "ui.components.mannequinguide.copy.421766c2cd": "Measure around the fullest point of your hips and seat standing naturally.",
  "ui.components.mannequinguide.copy.42dad040a1": "Saved Workspace Files on Google Drive",
  "ui.components.mannequinguide.copy.42ff7463e7": "Quickly backup these size dimensions to your Google Drive directory workspace.",
  "ui.components.mannequinguide.copy.4a2acde739": "Hip Girth",
  "ui.components.mannequinguide.copy.4a62f67443": "Bespoke Fitting Sheet",
  "ui.components.mannequinguide.copy.4ac01da91d": "Waist",
  "ui.components.mannequinguide.copy.4afdec29e7": "Perfect Fit Analysis",
  "ui.components.mannequinguide.copy.5086f0adeb": "Workspace Standard",
  "ui.components.mannequinguide.copy.5863c2af53": "Height is used to calculate lengthening or shortening slash lines on your pattern.",
  "ui.components.mannequinguide.copy.58ab401f7d": "Standard Sewing Sizing Chart",
  "ui.components.mannequinguide.copy.5ae5ed81e2": "Your Cloud connection is currently active.",
  "ui.components.mannequinguide.copy.5e0b72a081": "Size Range:",
  "ui.components.mannequinguide.copy.60be96a860": "Backup Sizing Ledger",
  "ui.components.mannequinguide.copy.61d0335ab5": "Updating your sizes automatically scales the material requirements under the Fabric panel below.",
  "ui.components.mannequinguide.copy.6778f1cf78": "Google Drive Offline",
  "ui.components.mannequinguide.copy.6f9c077812": "Precision Grading:",
  "ui.components.mannequinguide.copy.772d37ece5": "Garment Style Overlay & Sizing Fit-Check",
  "ui.components.mannequinguide.copy.7911a5df39": "Garment Blueprint Style Focus",
  "ui.components.mannequinguide.copy.7aa34d860a": "Fabric Yardage Calculator Link",
  "ui.components.mannequinguide.copy.7b98ac6db8": "Click hotspots to inspect",
  "ui.components.mannequinguide.copy.8027631855": "2. Bespoke Sizing Calculator",
  "ui.components.mannequinguide.copy.802fc6a7d6": "Colorway",
  "ui.components.mannequinguide.copy.840b21798d": "Matched",
  "ui.components.mannequinguide.copy.8777e15782": "Standard Grade",
  "ui.components.mannequinguide.copy.8b2ea3bc35": "Cloud Vault Synchronization",
  "ui.components.mannequinguide.copy.8dee165048": "Markdown",
  "ui.components.mannequinguide.copy.9037053a89": "Atelier Studio Stand",
  "ui.components.mannequinguide.copy.9a3a6be205": "Perfect Fit Assessment:",
  "ui.components.mannequinguide.copy.9c623b7e82": "Body Height",
  "ui.components.mannequinguide.copy.9d19303ad2": "Standard Size Fit Index",
  "ui.components.mannequinguide.copy.a0635a9a61": "Sign in with Google Workspace",
  "ui.components.mannequinguide.copy.a7c306056f": "Sub-Centimeter",
  "ui.components.mannequinguide.copy.a7c4c642f6": "Hips",
  "ui.components.mannequinguide.copy.a968692e37": "Standard Fit Zone",
  "ui.components.mannequinguide.copy.ab13c2edc8": "Disconnect",
  "ui.components.mannequinguide.copy.ad91ea7b62": "Interactive Fine Adjuster",
  "ui.components.mannequinguide.copy.af50cdaab0": "Disconnect Account",
  "ui.components.mannequinguide.copy.b0a11e9174": "Generate Tailoring Report",
  "ui.components.mannequinguide.copy.b0b587cdef": "Cross-referenced matching rows highlighted below based on your measurements.",
  "ui.components.mannequinguide.copy.b3f3ee5442": "A comprehensive fitting experience. Click numbered markers on the technical drawing to check standard conversion tables, or shift the sliders to calculate custom graded sizes simultaneously.",
  "ui.components.mannequinguide.copy.b49318d4ca": "4. Front Waist",
  "ui.components.mannequinguide.copy.b8c9932677": "Target Draft",
  "ui.components.mannequinguide.copy.b940d1bc64": "Method reference: EN 13402 / ISO 8559 measurement alignment standard. Inputs dynamically sync size matching algorithms with the mannequin hotspot markers to suggest real-time paper adjustments.",
  "ui.components.mannequinguide.copy.bdbf33e5c8": "Configure Yardage Now",
  "ui.components.mannequinguide.copy.be1d183a83": "Size",
  "ui.components.mannequinguide.copy.c049572f34": "Quick Cloud Save",
  "ui.components.mannequinguide.copy.c27da18e84": "3. Bust Girth",
  "ui.components.mannequinguide.copy.c5de9460bd": "Textile Fabric",
  "ui.components.mannequinguide.copy.c7adbac73e": "Reset Intake Form",
  "ui.components.mannequinguide.copy.c8f4f960c4": "Delete file from Google Drive",
  "ui.components.mannequinguide.copy.c98723a688": "3. AR Fitting Overlay",
  "ui.components.mannequinguide.copy.cf9ec351b2": "Restore custom measurements from this backup",
  "ui.components.mannequinguide.copy.dc2c33e06a": "Tailoring Instruction:",
  "ui.components.mannequinguide.copy.df306fca56": "Bust",
  "ui.components.mannequinguide.copy.df9002c8ae": "Provide your core anatomical dimensions below. Our sizing algorithm cross-references standard sewing charts to map your ideal paper draft size.",
  "ui.components.mannequinguide.copy.e7eeab48fc": "Best Match",
  "ui.components.mannequinguide.copy.eabd5a7003": "Bust Girth",
  "ui.components.mannequinguide.copy.eb29d26638": "Atelier Cloud Vault",
  "ui.components.mannequinguide.copy.ef63c29196": "Measure over the fullest part of your chest, keeping tape level across back.",
  "ui.components.mannequinguide.copy.f5bd577306": "Graded Sizing Advice",
  "ui.components.mannequinguide.copy.fe180b125c": "Click \"Backup Sizing Ledger\" to save your first cloud record.",
  "ui.components.mannequinguide.copy.ffd2df2ebb": "1. Dress Form & Drafting Sheets",
  "ui.components.mannequinguide.e7ad2312cc": "Customer measurement",
  "ui.components.membermanagement.0348b3157a": "List a New Garment Pattern for Sale",
  "ui.components.membermanagement.0508f9d08b": "From total listed garments",
  "ui.components.membermanagement.067d2f15e3": "Dresses",
  "ui.components.membermanagement.0705890b4e": "Write a few lines about your tailoring level, fabric favorites, or sewing machine setups...",
  "ui.components.membermanagement.070f628340": "Account Privilege Profile",
  "ui.components.membermanagement.09bd04e6ce": "Workspace Overview",
  "ui.components.membermanagement.0a2c4bc19a": "Email Address",
  "ui.components.membermanagement.0aacbce8f8": "Billing / Contact Email",
  "ui.components.membermanagement.0d916ea4fa": "Outerwear",
  "ui.components.membermanagement.0fcf7a8b71": "Secure Password",
  "ui.components.membermanagement.11b4d367e9": "Use the main **Dynamic Layout Hub** displayed on the workspace homepage to configure live layout schemas and manage application state parameters in real time.",
  "ui.components.membermanagement.150575fab7": "Describe the fabric requirements, pleats structure, or seam styles...",
  "ui.components.membermanagement.152ff4789e": "Username",
  "ui.components.membermanagement.16b08cf9c2": "miguelm",
  "ui.components.membermanagement.1836952364": "Sign Out of Atelier",
  "ui.components.membermanagement.1881f77c2c": "Collaborator / Seller",
  "ui.components.membermanagement.196d167a71": "Shipping Delivery Address",
  "ui.components.membermanagement.1a69ae8979": "Hips Width",
  "ui.components.membermanagement.1d0f83074e": "Short Design Description",
  "ui.components.membermanagement.1e6520e3a2": "Full Name",
  "ui.components.membermanagement.1ee889c5e7": "My Sewing Blueprint Purchases",
  "ui.components.membermanagement.20da443f1f": "Adjusting these parameters will update the interactive size advisor database for all blueprint catalog previews.",
  "ui.components.membermanagement.215fb09eba": "Public Username",
  "ui.components.membermanagement.2232b82035": "Select Garment Photo File",
  "ui.components.membermanagement.255e0074ac": "Tops",
  "ui.components.membermanagement.2a945ba3bb": "Capture Source",
  "ui.components.membermanagement.2c319289a0": "Subscriber Email",
  "ui.components.membermanagement.2cc408e2a7": "Personalized Calibration Metrics",
  "ui.components.membermanagement.2d30ee9fbc": "System Operations Centre",
  "ui.components.membermanagement.3b6ac37e2e": "Download PDF Pack",
  "ui.components.membermanagement.3f670b4b0d": "No active newsletter subscribers registered yet.",
  "ui.components.membermanagement.4072a58439": "Display Full Name",
  "ui.components.membermanagement.412e2d0b88": "✦ Administrative Instructions ✦",
  "ui.components.membermanagement.426b89f123": "Referral/Platform Fee",
  "ui.components.membermanagement.45997fd5e2": "Registered Timestamp",
  "ui.components.membermanagement.49c06f7493": "Administrator Privilege Level Activated",
  "ui.components.membermanagement.49e0886706": "My Order History",
  "ui.components.membermanagement.4a570f903f": "Administrator Console",
  "ui.components.membermanagement.52805a88a4": "Track Parcel Shipments",
  "ui.components.membermanagement.53785d26b4": "Access premium tailor gazettes, calibration templates, and professional pattern creator dashboards.",
  "ui.components.membermanagement.5450893649": "Total Subscribers",
  "ui.components.membermanagement.550659cdfb": "Location / Region",
  "ui.components.membermanagement.573ac31f30": "Captured Newsletter Mailing Registry",
  "ui.components.membermanagement.5f01981625": "No portfolio images posted yet. Upload your first dress/coat finished project above!",
  "ui.components.membermanagement.60e6169774": "Primary Payout Method",
  "ui.components.membermanagement.628ab37794": "Remove",
  "ui.components.membermanagement.661d021800": "✦ Add a New Finished Project Photo:",
  "ui.components.membermanagement.683ae13eb8": "Save Core Account Details",
  "ui.components.membermanagement.68f721192d": "Renaissance Pleated Bodice",
  "ui.components.membermanagement.691174f9b9": "Payout Ready",
  "ui.components.membermanagement.69f34af8a4": "Login: Regular Buyer",
  "ui.components.membermanagement.6a57dd06a6": "Authorized secure authentication environment. Perfect Fit Bureau strictly respects privacy, layout accuracy, and organic slow-fashion guidelines.",
  "ui.components.membermanagement.6d0de358cb": "Phone Number",
  "ui.components.membermanagement.6f6e5f2708": "Remove Photo",
  "ui.components.membermanagement.7532a2a5c4": "Publish Photo to Showcase",
  "ui.components.membermanagement.7626e13e25": "Bust Width",
  "ui.components.membermanagement.771f5f35da": "Actions",
  "ui.components.membermanagement.7945277074": "name@atelier.com",
  "ui.components.membermanagement.7a628e9f7d": "Deducted on checkout referral",
  "ui.components.membermanagement.7e0afba98a": "Active Checkout Code:",
  "ui.components.membermanagement.7fd738fb02": "••••••••",
  "ui.components.membermanagement.800f0a9d33": "ERP Content Sync",
  "ui.components.membermanagement.824a864fb7": "Guild Connection Rank",
  "ui.components.membermanagement.83b4bd2691": "Personal Atelier Details",
  "ui.components.membermanagement.84a5964334": "Gold Artisan Partner",
  "ui.components.membermanagement.84c630bb17": "My Portfolio Photos:",
  "ui.components.membermanagement.8ea27fb97b": "Gross Money Made",
  "ui.components.membermanagement.9261ff6b6c": "Active Pattern Sales Catalog",
  "ui.components.membermanagement.92de6f025a": "Full Name",
  "ui.components.membermanagement.94480c0437": "Delete Listing",
  "ui.components.membermanagement.983cfb9d26": "Or select an Atelier Classic Sketch:",
  "ui.components.membermanagement.98644c0348": "Atelier Creations Showcase",
  "ui.components.membermanagement.9af0877b1f": "Post completed garment photographs to build your public tailor catalog portfolio.",
  "ui.components.membermanagement.9d3e57f31e": "Ready to post",
  "ui.components.membermanagement.9f56b033a8": "Project Caption / Title",
  "ui.components.membermanagement.a46071d88c": "Regular Buyer",
  "ui.components.membermanagement.a4ef619afd": "Get 15% discount, view orders, and unlock VIP tailoring contents.",
  "ui.components.membermanagement.a51a5a586b": "Atelier Portal",
  "ui.components.membermanagement.a528a95dd3": "Mailing Register",
  "ui.components.membermanagement.a875f25091": "Current Avatar",
  "ui.components.membermanagement.ac38b6201d": "Full street address for printed pattern deliveries",
  "ui.components.membermanagement.b034bcb0d7": "Reset",
  "ui.components.membermanagement.b0ae39f268": "✦ Sent to PayPal automatically",
  "ui.components.membermanagement.b337cb3052": "Delete Photo",
  "ui.components.membermanagement.b3f5709f14": "Net Income",
  "ui.components.membermanagement.b4c1a0791f": "My Displayed Patterns",
  "ui.components.membermanagement.bc71857400": "✦ Interactive Demo Bypass ✦",
  "ui.components.membermanagement.bcbb2298c0": "Privileged Buyer Club Active",
  "ui.components.membermanagement.c16ad8bf47": "Upload Custom Portrait",
  "ui.components.membermanagement.c26a2728c1": "Login: System Administrator",
  "ui.components.membermanagement.c2f32e50f4": "Category",
  "ui.components.membermanagement.c40e7e9e12": "My Linen Aurelia Dress in Olive Sage",
  "ui.components.membermanagement.c5ecdcc0b4": "Account Settings",
  "ui.components.membermanagement.c70895ae44": "Pattern Name",
  "ui.components.membermanagement.c787294804": "Paris, France",
  "ui.components.membermanagement.c90a6b8fa2": "15% Fee",
  "ui.components.membermanagement.c9ce86e8eb": "Seller Portfolio Stats",
  "ui.components.membermanagement.cda79b065c": "Preview",
  "ui.components.membermanagement.d1f96b4e23": "Click below to instant-login with fully pre-seeded dashboards representing actual users.",
  "ui.components.membermanagement.d37283503b": "Waist Width",
  "ui.components.membermanagement.d62e49b2c9": "Post own patterns for sales, manage payouts, and track earnings with 15% fee.",
  "ui.components.membermanagement.d6db4cb4b5": "Margot Leone",
  "ui.components.membermanagement.d6f62303cc": "PayPal / Bank Payout Address",
  "ui.components.membermanagement.d76644afd4": "payout.email@domain.com",
  "ui.components.membermanagement.e11f0e5ba3": "Atelier Membership",
  "ui.components.membermanagement.e8f9cf7b23": "Creative Biography / Statement",
  "ui.components.membermanagement.ec075f52ec": "username",
  "ui.components.membermanagement.ed1a676ee4": "Atelier Referral Rating",
  "ui.components.membermanagement.f0555b92ed": "Status:",
  "ui.components.membermanagement.f3fbc03f41": "Trousers",
  "ui.components.membermanagement.f47cb3ba76": "Total Created Blueprints",
  "ui.components.membermanagement.f494737f1c": "Copy Code",
  "ui.components.membermanagement.ffa9954643": "View sewing enthusiasts who joined the newsletter register across the desktop footer and mobile app mockups.",
  "ui.components.messagecenterwidget.1291a98508": "Minimize",
  "ui.components.messagecenterwidget.14e9d74581": "Subject",
  "ui.components.messagecenterwidget.21098e4372": "Message",
  "ui.components.messagecenterwidget.25843c072f": "Direct + workflow messages",
  "ui.components.messagecenterwidget.3ede265f0d": "Drag Messages",
  "ui.components.messagecenterwidget.3fcc8d16cb": "Minimize messages",
  "ui.components.messagecenterwidget.4462cb6bad": "Messages",
  "ui.components.messagecenterwidget.48b7857dd1": "Inbox",
  "ui.components.messagecenterwidget.4ed9e64755": "Subject",
  "ui.components.messagecenterwidget.4eef2cecd0": "Direct messages are separate from protected approval/release workflow messages. Sending here does not change approval or publication status.",
  "ui.components.messagecenterwidget.5fe49821c0": "Type a name, email or role · multiple recipients allowed",
  "ui.components.messagecenterwidget.6d0b8599b4": "This message was created by the approval/release workflow. Reply through the existing workflow Message action so the conversation stays attached to its publication request.",
  "ui.components.messagecenterwidget.76491a7ef7": "To",
  "ui.components.messagecenterwidget.7785135b72": "Open messages",
  "ui.components.messagecenterwidget.7a03ff2144": "New message",
  "ui.components.messagecenterwidget.7d698d10a0": "Drag to reposition Messages",
  "ui.components.messagecenterwidget.83e7d2721a": "No matching recipient",
  "ui.components.messagecenterwidget.84e94fee8e": "Write your message...",
  "ui.components.messagecenterwidget.8d74068f27": "Drag to reposition",
  "ui.components.messagecenterwidget.8d90058f66": "Open messages",
  "ui.components.messagecenterwidget.9daa2c3774": "Send message",
  "ui.components.messagecenterwidget.afc49870f5": "Automatic",
  "ui.components.messagecenterwidget.c2cb4da4ee": "Reply",
  "ui.components.messagecenterwidget.d004eb4a81": "Drag Messages button",
  "ui.components.messagecenterwidget.d53e20f5bb": "Messages",
  "ui.components.messagecenterwidget.e636544a58": "No messages yet",
  "ui.components.messagecenterwidget.f4c8a0ce02": "Start a direct conversation, or workflow messages from approval and release will appear here automatically.",
  "ui.components.mobileappview.0012a87709": "12 Min Read",
  "ui.components.mobileappview.03342bea96": "Step-by-step assembly timers, real-time stopwatch logs, fabric inventory management, and video motion study.",
  "ui.components.mobileappview.0ddf7c28ae": "Save Report",
  "ui.components.mobileappview.0fa7b8d832": "Hip Size",
  "ui.components.mobileappview.19a8e49729": "Rating",
  "ui.components.mobileappview.1c37c3b01b": "Mailing Registry",
  "ui.components.mobileappview.1c8bc49f73": "All Metrics",
  "ui.components.mobileappview.1d6edbfa23": "Gold Club Member",
  "ui.components.mobileappview.1e1175b9cf": "Pattern Blueprint",
  "ui.components.mobileappview.20a8a7d381": "Add physical printed copy",
  "ui.components.mobileappview.239921d3ee": "5. Waist Girth",
  "ui.components.mobileappview.26f4871fbf": "Search curated pattern blueprints...",
  "ui.components.mobileappview.28c2ce9150": "Suggested Textiles",
  "ui.components.mobileappview.2c06e618c4": "Join our seasonal registry to receive instant alerts on collection drops, tailoring handbooks, and styling workshops.",
  "ui.components.mobileappview.2dd1d2083b": "Fitting Hacks",
  "ui.components.mobileappview.32c20d2fd8": "for 15% off blueprints.",
  "ui.components.mobileappview.357d9bf8d7": "Per Page:",
  "ui.components.mobileappview.359e1d1834": "Print",
  "ui.components.mobileappview.35e6c79783": "Secure Checkout",
  "ui.components.mobileappview.36008d8111": "Finishing Finishes",
  "ui.components.mobileappview.36e26aaaff": "Fitting Room",
  "ui.components.mobileappview.3c9ef1b2ab": "*Taxes and physical copy shipping rates are calculated at checkout. Curated orders are packed in signature craft paper catalogs.",
  "ui.components.mobileappview.3f2d1b0acf": "Overview",
  "ui.components.mobileappview.3f3204d631": "Couture Masterclass Academy",
  "ui.components.mobileappview.3ffec4981a": "Perfect Fit Sizing Advisor",
  "ui.components.mobileappview.40a392971f": "Connect your Google account to back up custom sizing ledger profiles and download print-ready specifications directly from your phone.",
  "ui.components.mobileappview.4807752b80": "First Page",
  "ui.components.mobileappview.4837fb50d4": "Remove",
  "ui.components.mobileappview.4975a2c45f": "4. Front Waist Length",
  "ui.components.mobileappview.4bf08950d0": "Add PDF Blueprint",
  "ui.components.mobileappview.4e4441d6be": "No app files discovered in Drive.",
  "ui.components.mobileappview.5248471db0": "Sewing Room",
  "ui.components.mobileappview.55ba8ec4df": "Write a bespoke review",
  "ui.components.mobileappview.56033f55bc": "Target Height",
  "ui.components.mobileappview.5b8c60423d": "Mannequin",
  "ui.components.mobileappview.611bf3877c": "Perfect Fit Sewing Handbook",
  "ui.components.mobileappview.620c9d79cd": "Restore",
  "ui.components.mobileappview.62a64429ff": "Saved Sizing Profile",
  "ui.components.mobileappview.62df82abc1": "3. Bust/Chest Girth",
  "ui.components.mobileappview.63e1d0161d": "Be the first to add a review of this curated blueprint.",
  "ui.components.mobileappview.64b9b2ffdf": "Review Headline",
  "ui.components.mobileappview.6ba326a8d4": "Submit Perfect Fit Review",
  "ui.components.mobileappview.7316fbe79e": "Clear Items",
  "ui.components.mobileappview.731e8619ce": "Academy",
  "ui.components.mobileappview.731f1c702f": "Tap numbered markers to adjust measurements",
  "ui.components.mobileappview.7c76bbcc68": "Disconnect",
  "ui.components.mobileappview.7e5009ba88": "Refine your tailoring techniques with our masterclasses, sewing principles, and bespoke guidelines.",
  "ui.components.mobileappview.7eddcdfcb6": "Last Page",
  "ui.components.mobileappview.81573b268d": "Backup Ledger",
  "ui.components.mobileappview.83984e03e7": "Unlock Perfect Fit Gold Club",
  "ui.components.mobileappview.8446641c27": "e.g. Stunning drape, easy assembly",
  "ui.components.mobileappview.894bda0e0b": "Share your custom garment building experience...",
  "ui.components.mobileappview.8c0ce5d2eb": "Hips Line",
  "ui.components.mobileappview.8c92f8f5b6": "Body Height",
  "ui.components.mobileappview.8e32259cce": "Club Portal",
  "ui.components.mobileappview.9263314806": "Back",
  "ui.components.mobileappview.93a604b277": "Details",
  "ui.components.mobileappview.986c9c3016": "Format:",
  "ui.components.mobileappview.9a4212fe01": "Your shopping cart is currently empty.",
  "ui.components.mobileappview.9cec33e228": "Perfecting the French Seam Contour",
  "ui.components.mobileappview.9ffd9d8ba7": "Explore Guidelines",
  "ui.components.mobileappview.a21f85c0b7": "Perfect Fit Proportions Ledger",
  "ui.components.mobileappview.aa6c0cd862": "No patterns fit selection",
  "ui.components.mobileappview.aa95b793c7": "name@perfectfit.com",
  "ui.components.mobileappview.ab35034098": "Perfect Fit Subtotal:",
  "ui.components.mobileappview.ad62561cea": "Couture Textiles",
  "ui.components.mobileappview.ad95e2a2e6": "Learn to compile neat, enclosed double stitching on light silks and cotton voiles to ensure luxury shop quality.",
  "ui.components.mobileappview.b005b808f6": "Waist Line",
  "ui.components.mobileappview.b2202c58c7": "Previous Page",
  "ui.components.mobileappview.b2df33a126": "Waist Size",
  "ui.components.mobileappview.b3b5d0e4a6": "Your Comments",
  "ui.components.mobileappview.b3b63e9d6f": "Fabric Specs",
  "ui.components.mobileappview.b5999daaa9": "Perfect Fit Seller",
  "ui.components.mobileappview.b8ee7cc1aa": "Refresh List",
  "ui.components.mobileappview.b9a21cf76e": "Couture Sewing Room",
  "ui.components.mobileappview.b9eeb9e776": "6. Hip Girth",
  "ui.components.mobileappview.bc1adc5d71": "Mobile Cloud Vault",
  "ui.components.mobileappview.be01891f98": "Reviews",
  "ui.components.mobileappview.bf629b56f2": "Catalog",
  "ui.components.mobileappview.bfe2b09a33": "Register / Sign In",
  "ui.components.mobileappview.c3a2e8e81b": "Saved Backups",
  "ui.components.mobileappview.c40dc9b994": "e.g. Marie S.",
  "ui.components.mobileappview.c7edd60f45": "Sign In with Google",
  "ui.components.mobileappview.c84e7aa8ea": "Welcome to Perfect Fit Bureau Sizing Studio, crafting elegance with absolute precision.",
  "ui.components.mobileappview.c9b11459e4": "Sign in to your private Perfect Fit member account to manage orders, customize sizing profiles, and save design specifications.",
  "ui.components.mobileappview.cbb5c3944d": "Your Name",
  "ui.components.mobileappview.cbd06d017a": "Perfect Fit Cart",
  "ui.components.mobileappview.cc6583799a": "A comprehensive walkthrough regarding waist and chest custom grading using tissue pivots to customize patterns for high-contrast figures.",
  "ui.components.mobileappview.d0a0d5f312": "Registered! Use code",
  "ui.components.mobileappview.d2601f9d1a": "Try resetting category or search criteria.",
  "ui.components.mobileappview.d5966020e6": "Sizes: 0 - 22",
  "ui.components.mobileappview.d9f4f581f9": "Estimated Cost",
  "ui.components.mobileappview.db031c29a7": "Handling Sandwashed Silk and Cupro",
  "ui.components.mobileappview.dcc23c9863": "Key Pattern Features",
  "ui.components.mobileappview.e0f042bc27": "Bust Line",
  "ui.components.mobileappview.e222085bea": "Tweak all measurements directly in one continuous ledger form.",
  "ui.components.mobileappview.e24884ae55": "Cloud Vault",
  "ui.components.mobileappview.e29a9ae984": "18 Min Read",
  "ui.components.mobileappview.e2f82222fe": "Required Sewing Notions",
  "ui.components.mobileappview.ebc0bc2f73": "Google Drive Offline",
  "ui.components.mobileappview.ec9680601d": "2. Shoulder Length",
  "ui.components.mobileappview.eca86375ab": "Working with fluid bias fabrics. Learn how stay-tape applications prevent underarm wraps from warping.",
  "ui.components.mobileappview.f78084dc92": "Next Page",
  "ui.components.mobileappview.f864670135": "Bust Size",
  "ui.components.mobileappview.faadb9c207": "9 Min Read",
  "ui.components.moderatorpublicationmessenger.27e8736e26": "Message the designer...",
  "ui.components.moderatorpublicationmessenger.2f8e56e910": "Message Designer",
  "ui.components.moderatorpublicationmessenger.7cf93ee957": "Close moderator messages",
  "ui.components.moderatorpublicationmessenger.8638fae1f6": "No messages yet",
  "ui.components.moderatorpublicationmessenger.9c2f3188e3": "Send",
  "ui.components.moderatorpublicationmessenger.9f80ddf992": "This conversation is linked only to the publication request. It does not grant access to the designer Workspace.",
  "ui.components.moderatorpublicationreviewbar.0683f52939": "Return",
  "ui.components.moderatorpublicationreviewbar.06e80d654b": "Cancel",
  "ui.components.moderatorpublicationreviewbar.096660aaf1": "Explain what must be corrected before resubmission.",
  "ui.components.moderatorpublicationreviewbar.132cbe1e4f": "This is the customer-facing projection only.",
  "ui.components.moderatorpublicationreviewbar.28d44625d8": "Short moderator note...",
  "ui.components.moderatorpublicationreviewbar.35e7d66df3": "Close moderator review",
  "ui.components.moderatorpublicationreviewbar.4172eb8f22": "Private Workspace modules remain inaccessible.",
  "ui.components.moderatorpublicationreviewbar.4bd5284bd7": "Approve & Publish",
  "ui.components.moderatorpublicationreviewbar.c2f4d39295": "Return to Designer",
  "ui.components.moderatorpublicationreviewbar.c9923fc1d5": "Message Designer",
  "ui.components.moderatorpublicationreviewbar.d869a8633e": "Customer Quick View",
  "ui.components.moderatorpublicationreviewbar.fbedd5b300": "MODERATOR RELEASE REVIEW",
  "ui.components.myorderssection.02e794b79e": "Dresses",
  "ui.components.myorderssection.0536eab064": "Tailoring Notes",
  "ui.components.myorderssection.0d0c1f967e": "Atelier Purchases",
  "ui.components.myorderssection.11d4a9cf55": "e.g. Linen, Silk, Denim",
  "ui.components.myorderssection.148c6722c8": "Easy",
  "ui.components.myorderssection.170ea5d284": "Grainline Studio",
  "ui.components.myorderssection.19741e374f": "No matching imported patterns found in your library.",
  "ui.components.myorderssection.21147a8926": "Etsy",
  "ui.components.myorderssection.2332ec8bb2": "Other / Independent",
  "ui.components.myorderssection.2538db6b61": "All Fabrics",
  "ui.components.myorderssection.279b7deacf": "No completed transactions detected",
  "ui.components.myorderssection.2cdaca491b": "Color Name",
  "ui.components.myorderssection.3083267ac1": "Outerwear",
  "ui.components.myorderssection.30e28b60ef": "Import PDF Order Receipts",
  "ui.components.myorderssection.318996d8bb": "All Colors",
  "ui.components.myorderssection.31beaa97b3": "Digital pattern ready",
  "ui.components.myorderssection.3210f8999c": "Purchase Date",
  "ui.components.myorderssection.35901f83c3": "Intermediate",
  "ui.components.myorderssection.38a38d869f": "Invoice:",
  "ui.components.myorderssection.3af6fabcc9": "No orders match your active search terms.",
  "ui.components.myorderssection.4128d507f3": "Format:",
  "ui.components.myorderssection.440a5f2589": "Verify Extracted Fields",
  "ui.components.myorderssection.4bbfb83198": "e.g. Sage Green, Rust",
  "ui.components.myorderssection.50f6403515": "e.g. Linen, Denim",
  "ui.components.myorderssection.583078ffd3": "Clear",
  "ui.components.myorderssection.5b66af181c": "Scanning digital receipt",
  "ui.components.myorderssection.5ca5cf5334": "Upload digital receipts from Etsy, The Fold Line, Style Arc, Seamwork, or other popular pattern houses to automatically index them.",
  "ui.components.myorderssection.5e9a689963": "Tops",
  "ui.components.myorderssection.64f517574d": "Download invoice PDF",
  "ui.components.myorderssection.6a84198f2b": "Color Tag",
  "ui.components.myorderssection.6f4fface4b": "Difficulty",
  "ui.components.myorderssection.711b333fb7": "Price Paid",
  "ui.components.myorderssection.73132614d0": "Download PDF Package",
  "ui.components.myorderssection.749f63ceef": "Try Demo Orders List",
  "ui.components.myorderssection.76cedb7f34": "Imported Atelier Library",
  "ui.components.myorderssection.775b66d81b": "Pants",
  "ui.components.myorderssection.78a32c2d51": "Cancel",
  "ui.components.myorderssection.7c8645cc27": "Keep track of your digital pattern purchases, download your files, and manage your library imported from other platforms.",
  "ui.components.myorderssection.8321dd26de": "Merchant & Mills",
  "ui.components.myorderssection.83e16f48a1": "Edit fabric and color tags",
  "ui.components.myorderssection.8a2affb8a4": "Log In to Sync Saved Orders",
  "ui.components.myorderssection.8db8cd4712": "Order Reference",
  "ui.components.myorderssection.903d927d85": "Fabric Type",
  "ui.components.myorderssection.92b69b1eef": "Fabric Type Tag",
  "ui.components.myorderssection.94b70c6d67": "Advanced",
  "ui.components.myorderssection.9d263fe70b": "Category",
  "ui.components.myorderssection.9ef1b2c905": "Search imported library by name or platform...",
  "ui.components.myorderssection.aca3c3643f": "Save Tags",
  "ui.components.myorderssection.ace63f9fd6": "e.g. Sage, Burgundy",
  "ui.components.myorderssection.adc7577dff": "Seed Demo Orders",
  "ui.components.myorderssection.ae6993f2b6": "Style Arc",
  "ui.components.myorderssection.b53e72a728": "My Purchased Patterns",
  "ui.components.myorderssection.b5d28e3985": "Delete imported record",
  "ui.components.myorderssection.b78eb154b9": "Set printer scaling to 100% / Actual Size.",
  "ui.components.myorderssection.bedbe6e8b0": "Configure Card Tags",
  "ui.components.myorderssection.c95ed6dd39": "Seamwork",
  "ui.components.myorderssection.d028efabea": "Need adjustments? Consult the included 12-page tailoring manual.",
  "ui.components.myorderssection.d2f9dd7990": "Delete tags",
  "ui.components.myorderssection.d4cc9c5f75": "Explore Curated Catalog",
  "ui.components.myorderssection.d7081bcf78": "Pattern Name",
  "ui.components.myorderssection.e820d5fe67": "Color:",
  "ui.components.myorderssection.e90c889745": "Source Platform",
  "ui.components.myorderssection.e99942d636": "The Fold Line",
  "ui.components.myorderssection.eb1c263753": "Skirts",
  "ui.components.myorderssection.ec903c9725": "Instantly see previously completed orders for a detailed tour",
  "ui.components.myorderssection.f34d8a2018": "You haven't purchased any digital patterns in this session. Complete a checkout in the Cart or load demo orders to try it out.",
  "ui.components.myorderssection.f7d68afdb7": "Fabric:",
  "ui.components.myorderssection.fa7665d31e": "Copy Order ID",
  "ui.components.myorderssection.ff1f442492": "Search by Order ID or pattern name...",
  "ui.components.orbitcarousel.0acaa84962": "Next garment in orbit",
  "ui.components.orbitcarousel.1d003d542e": "Previous garment in orbit",
  "ui.components.orbitcarousel.41abed0d1c": "Signature Collections",
  "ui.components.orbitcarousel.6a84bc96ff": "Let Your Uniqueness Take Shape",
  "ui.components.orbitcarousel.bd3627b3b8": "Our",
  "ui.components.patterncard.015f169d4f": "Generative AI Textile Swatch Room",
  "ui.components.patterncard.0289293dd8": "Pattern",
  "ui.components.patterncard.0387477596": "Course Curriculum",
  "ui.components.patterncard.0467c9aa80": "Senior Pattern Drafter",
  "ui.components.patterncard.046c2325cf": "Explore Technical Drawings & AI Fabric Swatches",
  "ui.components.patterncard.0cd235601a": "Key Structural Elements",
  "ui.components.patterncard.0e096dd85a": "AI TEXTURE SYNTHESIS MODULE RUNNING...",
  "ui.components.patterncard.0f729d8570": "Your Instructor",
  "ui.components.patterncard.13347604cc": "Hover swatches to swap",
  "ui.components.patterncard.16cd44c327": "Verify Specs",
  "ui.components.patterncard.1ad2ad7e4b": "Close Swatch Room",
  "ui.components.patterncard.1e64d1414d": "Step Stitching Progress",
  "ui.components.patterncard.2b9d3b367f": "French Seams",
  "ui.components.patterncard.3293398870": "View Maker Gallery & Reviews",
  "ui.components.patterncard.3c9508c96a": "Synthesize",
  "ui.components.patterncard.453e09a296": "DRAFT DATE: 2026-07",
  "ui.components.patterncard.486973d0f9": "Blueprint Requirements:",
  "ui.components.patterncard.4a9ea78c97": "Cad Draft Approved",
  "ui.components.patterncard.4b70dad3c5": "Sewing Demonstration",
  "ui.components.patterncard.4d740eacc6": "GRID CORE: ACTIVE",
  "ui.components.patterncard.50d927b45b": "Specs Blueprint",
  "ui.components.patterncard.519ddee2c3": "Inspecting",
  "ui.components.patterncard.52e78c7bcf": "Sew Active Chapter",
  "ui.components.patterncard.6950cf8321": "Added",
  "ui.components.patterncard.6f3d6a54ab": "Reset Class",
  "ui.components.patterncard.750cdbd4bc": "Pause Stitching",
  "ui.components.patterncard.78a1981510": "Atelier CAD Engine v2.4",
  "ui.components.patterncard.7fa379246f": "PANTONE®",
  "ui.components.patterncard.87f322d653": "AI Custom Texture Synthesizer",
  "ui.components.patterncard.8c7bca8cc8": "Recommended Seam Finishing:",
  "ui.components.patterncard.8eb126cbbd": "Type custom weave, e.g. 'heavy tweed with golden lurex thread'...",
  "ui.components.patterncard.8f23ae4d20": "II. Recommended Textile Weaves",
  "ui.components.patterncard.90824d1771": "I. Technical Specification",
  "ui.components.patterncard.94b993fbc8": "Active Step Guidelines",
  "ui.components.patterncard.992b256449": "Class Video Stream",
  "ui.components.patterncard.9ffe354b0b": "Interactive Simulator",
  "ui.components.patterncard.b42ce8981f": "Construction Profile & Notions",
  "ui.components.patterncard.c1a2e98d06": "Favored Fabrics:",
  "ui.components.patterncard.c3c99b1cee": "Digital Swatch Room",
  "ui.components.patterncard.c5d5abe72a": "Quick View",
  "ui.components.patterncard.c76df9fd04": "THREAD WEIGHT PARSED: 98%",
  "ui.components.patterncard.c94163a97c": "Grade:",
  "ui.components.patterncard.cbaf01251c": "Close Modal",
  "ui.components.patterncard.d074b8cfc5": "View Product Details",
  "ui.components.patterncard.d49ba053c9": "Studio Perfect Fit Secrets",
  "ui.components.patterncard.ed0d29028a": "Inspect Swatch Room",
  "ui.components.patterncard.f9e8aa2d15": "4.0x",
  "ui.components.patternimagegallery.0bd69b0e0f": "Search designs or fabrics...",
  "ui.components.patternimagegallery.212aad4068": "Bureau",
  "ui.components.patternimagegallery.2ea9d2f46f": "Tailoring Difficulty Level",
  "ui.components.patternimagegallery.46c805308d": "Fine-Tune Atelier Blueprints",
  "ui.components.patternimagegallery.47f8bf9c8d": "Inspect Interactive Specs",
  "ui.components.patternimagegallery.560b9cddfb": "Price Range Selection",
  "ui.components.patternimagegallery.56b6278d58": "PDF & Print Ready",
  "ui.components.patternimagegallery.572ed9a31e": "of",
  "ui.components.patternimagegallery.5d67286d96": "Size Range",
  "ui.components.patternimagegallery.5eb0383d40": "No showcased blueprints found matching the filters",
  "ui.components.patternimagegallery.63ab6dd4a6": "Sizes 0 – 22",
  "ui.components.patternimagegallery.6ce010a2de": "Hover over any design cover below to reveal professional specifications, construction features, recommended fabrics, and tailoring complexity in real-time.",
  "ui.components.patternimagegallery.71e9aa9a64": "Garment Style / Category",
  "ui.components.patternimagegallery.79aa0c29a7": "Fabric Sug.",
  "ui.components.patternimagegallery.7e6bdd8c97": "Showing",
  "ui.components.patternimagegallery.89d8e5d2e1": "Last Page",
  "ui.components.patternimagegallery.9caa29b6ed": "First Page",
  "ui.components.patternimagegallery.a8a50aa926": "Previous Page",
  "ui.components.patternimagegallery.abce5718ee": "Details",
  "ui.components.patternimagegallery.b15a57b6b5": "Add PDF",
  "ui.components.patternimagegallery.b7e48e8744": "Blueprint:",
  "ui.components.patternimagegallery.ba93586faa": "Quick View Details",
  "ui.components.patternimagegallery.c6faa80fa2": "Next Page",
  "ui.components.patternimagegallery.cb074130eb": "Reset All Filters",
  "ui.components.patternimagegallery.cdd30c3e04": "Quick View",
  "ui.components.patternimagegallery.e14135e83c": "View Product Details",
  "ui.components.patternimagegallery.e7c4c5f35b": "Reset Filters",
  "ui.components.patternimagegallery.f4a443ccd9": "Quick Add PDF to Queue",
  "ui.components.patternimagegallery.ffd4969ae1": "luxury blueprints",
  "ui.components.patternquickviewmodal.01bb62333f": "Share on Twitter / X",
  "ui.components.patternquickviewmodal.02105e3f32": "Measurement basis",
  "ui.components.patternquickviewmodal.0421876b93": "Favored Fabrics",
  "ui.components.patternquickviewmodal.05762a86b6": "Select Fabric Texture:",
  "ui.components.patternquickviewmodal.0e93ab655d": "Video Masterclass Room",
  "ui.components.patternquickviewmodal.11536ba128": "Inspire the sewing community",
  "ui.components.patternquickviewmodal.177bb1a0c7": "Zoom factor",
  "ui.components.patternquickviewmodal.1cba446467": "Product category",
  "ui.components.patternquickviewmodal.1d75e08d21": "Recommendation uses the selected product's released fit profile when available.",
  "ui.components.patternquickviewmodal.1fb17f6ec0": "Atelier Design Lab",
  "ui.components.patternquickviewmodal.2250fecf07": "Perfect for raw-edge protection. Stitch wrong sides together at 1/4\", trim close, press flat, then stitch right sides together to trap raw fringe inside.",
  "ui.components.patternquickviewmodal.294595bea9": "X / Tweet",
  "ui.components.patternquickviewmodal.2a7e90f84a": "v2026.1",
  "ui.components.patternquickviewmodal.2e92796697": "Pinterest",
  "ui.components.patternquickviewmodal.2fe3541b12": "Atelier Masterclass Tips:",
  "ui.components.patternquickviewmodal.328776b2a0": "Standard zip assembly requires precise basting. Mark sewing guides clearly and baste secure hook loops inside face bands before turning raw seams.",
  "ui.components.patternquickviewmodal.3614141e10": "Verify seam layouts against structured textures. Check draping line flows, tension lines, and grainline indicators.",
  "ui.components.patternquickviewmodal.362e224c3b": "Share on Facebook",
  "ui.components.patternquickviewmodal.39628cebf6": "Atelier Quick View",
  "ui.components.patternquickviewmodal.3c86028c8a": "Interactive Sewing Instruction Studio:",
  "ui.components.patternquickviewmodal.3cd1472483": "1. Pressing vs Ironing Secrets",
  "ui.components.patternquickviewmodal.3f5efebf1f": "Zoom out",
  "ui.components.patternquickviewmodal.438866801e": "44\" Width Yardage",
  "ui.components.patternquickviewmodal.43a78badd1": "Sewing Tips",
  "ui.components.patternquickviewmodal.4a47222bd7": "1. French Seaming Techniques",
  "ui.components.patternquickviewmodal.4cd839c6ab": "Share on Instagram",
  "ui.components.patternquickviewmodal.4e01b392bd": "Use Find My Size for a garment-specific recommendation, or choose a size manually.",
  "ui.components.patternquickviewmodal.4e1ed9feff": "Difficulty level",
  "ui.components.patternquickviewmodal.53e65f18ad": "2. Flawless Pocket Double-Welts",
  "ui.components.patternquickviewmodal.5b082c6d4a": "Required Materials Checklist:",
  "ui.components.patternquickviewmodal.5c5df8b68c": "Show Alignment Notches",
  "ui.components.patternquickviewmodal.5d919dd75f": "Back to Quick View",
  "ui.components.patternquickviewmodal.5dfb32bb67": "Next technical image",
  "ui.components.patternquickviewmodal.6085616ec8": "Size system",
  "ui.components.patternquickviewmodal.6e0092a666": "Instagram",
  "ui.components.patternquickviewmodal.71ba7dbf28": "Press every seam flat and then open immediately after sewing for an impeccable drape.",
  "ui.components.patternquickviewmodal.7370919474": "2. Flawless Front J-Flys",
  "ui.components.patternquickviewmodal.741bbe2d48": "Watch Technique Video",
  "ui.components.patternquickviewmodal.774ce266ea": "Copy Pattern Link",
  "ui.components.patternquickviewmodal.789cb07394": "Zoom in",
  "ui.components.patternquickviewmodal.79b581bf13": "Find My Size · Customer fit",
  "ui.components.patternquickviewmodal.7ad26d3f80": "Media thumbnails",
  "ui.components.patternquickviewmodal.7b3639eeb0": "Previous Photo / Technical Sketch",
  "ui.components.patternquickviewmodal.7f3ace3d8c": "Recommended Needles:",
  "ui.components.patternquickviewmodal.80079bcda1": "Digital pattern formats",
  "ui.components.patternquickviewmodal.80699f6ba4": "Always perform a test stitch on a scrap piece of your fabric to calibrate machine tension.",
  "ui.components.patternquickviewmodal.813fd35a50": "60\" Width Yardage",
  "ui.components.patternquickviewmodal.86765be4bf": "CAD v2.5",
  "ui.components.patternquickviewmodal.87cfdfdacf": "Pin on Pinterest",
  "ui.components.patternquickviewmodal.9304913ab9": "Zoom",
  "ui.components.patternquickviewmodal.9e3c5556ce": "Show Seam Allowances",
  "ui.components.patternquickviewmodal.a0ca2b85a0": "Or select swatch directly:",
  "ui.components.patternquickviewmodal.a0f3f2f422": "Find My Size",
  "ui.components.patternquickviewmodal.a606702b3e": "No reviews yet",
  "ui.components.patternquickviewmodal.a96176c4be": "Close Quick View Modal",
  "ui.components.patternquickviewmodal.aaae95d63e": "Print Prep Blueprint",
  "ui.components.patternquickviewmodal.ae12af7f96": "This fitting session is locked to the product currently open in Quick View.",
  "ui.components.patternquickviewmodal.b721afecb8": "Key Features",
  "ui.components.patternquickviewmodal.ba3929ddda": "Choose Target Size",
  "ui.components.patternquickviewmodal.bdc1b526c8": "For thick materials like wool gabardine. Steam seams heavily, then apply the hardwood clapper with downward pressure. Traps heat for razor-sharp collar folds.",
  "ui.components.patternquickviewmodal.c05f0cba9e": "Technical sketch",
  "ui.components.patternquickviewmodal.c306d82f10": "Successfully Added!",
  "ui.components.patternquickviewmodal.c31df96433": "Reset",
  "ui.components.patternquickviewmodal.c3791a4b5c": "Technical notes",
  "ui.components.patternquickviewmodal.cc13db50cb": "Reviews",
  "ui.components.patternquickviewmodal.cd0be4a25f": "Facebook",
  "ui.components.patternquickviewmodal.d288904ebd": "1. The Tailor's Clapper Secrets",
  "ui.components.patternquickviewmodal.d47dabcd89": "The selected cart size is linked to the recommended canonical garment size.",
  "ui.components.patternquickviewmodal.d691de50f6": "Previous technical image",
  "ui.components.patternquickviewmodal.d8164af87f": "Write a review",
  "ui.components.patternquickviewmodal.d97097beb8": "Weave Detail Inspection:",
  "ui.components.patternquickviewmodal.def6906860": "Interactive Blueprint CAD Mode",
  "ui.components.patternquickviewmodal.e1f5f75d18": "Close Find My Size",
  "ui.components.patternquickviewmodal.e42ef82702": "Staystitch necklines immediately at 1/8\" within the seam allowances before pin-basting to prevent delicate fabric bias lines from distortion.",
  "ui.components.patternquickviewmodal.e811875234": "Message designer",
  "ui.components.patternquickviewmodal.ea6021e7a9": "2. Accurate Staystitching",
  "ui.components.patternquickviewmodal.ed05ed1da8": "Next Photo / Technical Sketch",
  "ui.components.patternquickviewmodal.ee6a8a24b5": "Share Pattern Blueprint",
  "ui.components.patternquickviewmodal.f35671c6a1": "Size range",
  "ui.components.patternquickviewmodal.f5922d89d5": "Beta Visualizer",
  "ui.components.patternquickviewmodal.fd08c42151": "Interactive Fabric Lab",
  "ui.components.patternquickviewmodal.fd99a7c6b2": "Copy Link",
  "ui.components.patternquickviewmodal.ffe20397fe": "Grab and drag to view details",
  "ui.components.patternseo.08fa5d8c16": "In Stock",
  "ui.components.patternseo.0dc4fcb5dc": "SEO Synced",
  "ui.components.patternseo.2bc7a82f95": "Price range:",
  "ui.components.patternseo.31856164b1": "Tag / Property",
  "ui.components.patternseo.39a5f662a8": "summary_large_image",
  "ui.components.patternseo.55cb89774a": "Dynamic Head Metadata Status",
  "ui.components.patternseo.68c4a7378a": "Rating:",
  "ui.components.patternseo.93e9480ec0": "Copy schema string to clipboard",
  "ui.components.patternseo.a58970e55f": "* The dynamic aggregate rating and pricing offers are parsed by googlebot crawlers using the injected JSON-LD schema below, showing a rich search product snippet in SERPs.",
  "ui.components.patternseo.a9db8c513a": "Injected Content Value",
  "ui.components.patternseo.c68d1632c6": "Head Metadata Table",
  "ui.components.patternseo.cdfe374d8f": "product",
  "ui.components.patternseo.e127e925da": "Google Snippet Mockup",
  "ui.components.patternseo.f44af34990": "JSON-LD Structured Schema",
  "ui.components.patternseo.feaa1f8746": "★★★★★",
  "ui.components.perfectfitfaq.0c896e5316": "Knowledge Categories",
  "ui.components.perfectfitfaq.0de08d029a": "Your Question Description",
  "ui.components.perfectfitfaq.15c76084e6": "e.g. Can I use stretch denim for the Trench Coat pattern?",
  "ui.components.perfectfitfaq.247bb8203a": "Garment Topic",
  "ui.components.perfectfitfaq.3064ae4bf2": "Ask Our Perfect Fit Specialists",
  "ui.components.perfectfitfaq.34076919b4": "Digital Pattern Printing",
  "ui.components.perfectfitfaq.51c2a61ce0": "\"Measure twice, print once.\" Always print only the first page containing the calibration block before rolling out the full layout to save precious fibers and inks.",
  "ui.components.perfectfitfaq.56de4a9ccf": "Filter by Keyword",
  "ui.components.perfectfitfaq.59b3155343": "Get instant professional answers about premium fabric handling, digital printing calibration standards, and global shipping parameters.",
  "ui.components.perfectfitfaq.95b976dd54": "Reset all filters",
  "ui.components.perfectfitfaq.a51fcfb651": "Fabric Weights",
  "ui.components.perfectfitfaq.a5d5be8561": "Submit Question",
  "ui.components.perfectfitfaq.ac44d15749": "Success! Your custom inquiry has been loaded into your local view and is awaiting review.",
  "ui.components.perfectfitfaq.b2ee100cde": "Can't find the exact technical answer? Submit your custom fabric drape or printing calibration inquiry.",
  "ui.components.perfectfitfaq.b39485eb67": "Search drapery, A0, tracking...",
  "ui.components.perfectfitfaq.b42ba7e1c4": "Tailor's Golden Rule",
  "ui.components.perfectfitfaq.c175e6cc3e": "All Curated Topics",
  "ui.components.perfectfitfaq.f4f107d773": "PDF Printing",
  "ui.components.perfectfitfaq.f61cdcfc6e": "Shipping Policy",
  "ui.components.perfectfitlayoutcontroller.033d985d36": "Adaptive Rendering Active",
  "ui.components.perfectfitlayoutcontroller.1e7d9e60f1": "Save",
  "ui.components.perfectfitlayoutcontroller.22f5945667": "Shift, toggle, or customize the entire homepage section structure in real-time. No code changes required.",
  "ui.components.perfectfitlayoutcontroller.2351c5fd6c": "Master Metadata Layout Controller",
  "ui.components.perfectfitlayoutcontroller.24937abf5f": "Perfect Fit UI Engine Core",
  "ui.components.perfectfitlayoutcontroller.36d01468e5": "Shift Section Down",
  "ui.components.perfectfitlayoutcontroller.3cd15a663f": "Our page architecture implements a",
  "ui.components.perfectfitlayoutcontroller.6293ffea73": "Reset to Master Default Layout",
  "ui.components.perfectfitlayoutcontroller.6868f41b22": "Cancel",
  "ui.components.perfectfitlayoutcontroller.7222400b76": "Display Section",
  "ui.components.perfectfitlayoutcontroller.73a3e60098": "Direct sync to LocalStorage database.",
  "ui.components.perfectfitlayoutcontroller.7a4ea609f6": "Decouples layout positioning from the hardcoded main tree",
  "ui.components.perfectfitlayoutcontroller.8cc0cea6bd": "Do not display this section on website",
  "ui.components.perfectfitlayoutcontroller.9e872d92a1": ". By transforming sections from hardcoded static nodes into metadata schema declarations, the applet:",
  "ui.components.perfectfitlayoutcontroller.af0c6ef9c3": "Layout Engine System",
  "ui.components.perfectfitlayoutcontroller.af6fd3025c": "Do Not Display",
  "ui.components.perfectfitlayoutcontroller.b094c31154": "Display this section on website",
  "ui.components.perfectfitlayoutcontroller.bfc01a8c5d": "Edit Section Metadata",
  "ui.components.perfectfitlayoutcontroller.c1d3468e08": "Enables persistent state styling across page refreshes",
  "ui.components.perfectfitlayoutcontroller.e8e066a0f4": "Subtitle Label Override",
  "ui.components.perfectfitlayoutcontroller.f02adaaf4e": "Live Metadata Database",
  "ui.components.perfectfitlayoutcontroller.f6b446e187": "Shift Section Up",
  "ui.components.perfectfitlayoutcontroller.f84d53b6dd": "Title Label Override",
  "ui.components.perfectfitlayoutcontroller.fadee856a6": "Instantly renders widgets via dynamic element registry",
  "ui.components.perfectfitlayoutcontroller.ff2b68f33b": "Exposes granular permission tuning per viewport block",
  "ui.components.perfectfitstandards.168040e7b0": "Inspect finishes",
  "ui.components.perfectfitstandards.27882bd5cf": "Enter your exact chest/waist/hip metrics on our dynamic sizing calculator page to find your line. Easily draw custom slashes using the designated shortening/lengthening marks pre-drawn.",
  "ui.components.perfectfitstandards.5583a121a2": "Download blueprints",
  "ui.components.perfectfitstandards.57af246166": "Bespoke Construction",
  "ui.components.perfectfitstandards.6d20c23427": "How Perfect Fit Patterns are Assembled",
  "ui.components.perfectfitstandards.8df0389f1b": "We design modern blueprints accompanied by pristine illustration booklets to ensure your construct results in a glorious wearable masterpiece.",
  "ui.components.perfectfitstandards.d95b4c7bb2": "Follow our step-by-step assembly diagrams. Standard sewing blueprints are paired with advice regarding custom bias binders, pocket installations, buttonhole setups, and perfect French lining seams.",
  "ui.components.perfectfitstandards.dbea75738c": "Calculate proportions",
  "ui.components.permissionsguidemodal.0d8f99881f": "App Component",
  "ui.components.permissionsguidemodal.141dfc3377": "Override",
  "ui.components.permissionsguidemodal.226c853447": "Component Permissions & Access Guide",
  "ui.components.permissionsguidemodal.2302089d18": "Allowed",
  "ui.components.permissionsguidemodal.4601b2ea68": "Access Level Verification Matrix",
  "ui.components.permissionsguidemodal.5278cf8f8f": "This matrix outlines standard vs active real-time access roles configured under",
  "ui.components.permissionsguidemodal.59c721e05b": "Security Model Version",
  "ui.components.permissionsguidemodal.618da847ef": "Revert modified layout rule overrides to standard definitions",
  "ui.components.permissionsguidemodal.7516a39750": "Layout permissions are compiled server-side. Access rules are re-validated upon every API route execution.",
  "ui.components.permissionsguidemodal.76520f199f": "This access permission has been overridden live in the active workspace",
  "ui.components.permissionsguidemodal.79c68accd7": "Close Audit Logs",
  "ui.components.permissionsguidemodal.8394f36f39": "Dismiss Permissions Matrix",
  "ui.components.permissionsguidemodal.88a3b43c3b": "Designated Role Behavior",
  "ui.components.permissionsguidemodal.8adbfca5c5": "Component Rationale",
  "ui.components.permissionsguidemodal.93104c7449": "Operational Inspector",
  "ui.components.permissionsguidemodal.9c1647ef04": "ISO-27001 Certified Cryptography",
  "ui.components.permissionsguidemodal.a00da0b5c9": "Engine Build Version",
  "ui.components.permissionsguidemodal.af1ff6cfbd": "Denied",
  "ui.components.permissionsguidemodal.c791b39439": "Authorized Admin",
  "ui.components.permissionsguidemodal.cdf175ce32": ". Green checks represent functional access levels. Click any component row to view full privilege declarations.",
  "ui.components.permissionsguidemodal.d5d1a85dcf": "Reset Defaults",
  "ui.components.permissionsguidemodal.ef81114355": "Atelier Security Protocol Standard",
  "ui.components.permissionsguidemodal.efdc37062b": "Administrative Transparency Policy",
  "ui.components.printingguide.008853bac6": "Always align the printed solid arrows with the grainline direction of your fabric before slicing the textile. Biased drapes, as seen on the **Aurelia Dress**, must hang at 45 degrees to preserve the designer's structural drop.",
  "ui.components.printingguide.013c3c0caf": "Empty border margin sheet",
  "ui.components.printingguide.0cccd09d36": "To join pages without gaps, standard blueprints print with a 1/2\" margin border around all pages. Choose a cutting template:",
  "ui.components.printingguide.0cd3066fac": "Letter Perfect",
  "ui.components.printingguide.115c57c946": "Inches",
  "ui.components.printingguide.1df0ac3ade": "Metric Calibration Simulator",
  "ui.components.printingguide.26066f35b2": "Reset assembly progress",
  "ui.components.printingguide.28c9293deb": "Scale error detected:",
  "ui.components.printingguide.2a93a61c42": "Once taped, locate the solid black outline corresponding to your size. Cut along the size lines, lay flat on your grainline aligned fabric, and pin or weigh for cutting.",
  "ui.components.printingguide.2c4aec91ab": "Overlaps:",
  "ui.components.printingguide.2e4a15e565": "Taped Check",
  "ui.components.printingguide.2fcea72a37": "Step-by-step mastercalibrations and visual grids mapped to your local device.",
  "ui.components.printingguide.349da0dbf7": "Layout Map View",
  "ui.components.printingguide.37e33dacc0": ". Yellow panels show overlapping fabric blueprints.",
  "ui.components.printingguide.3a9106b69d": "Garment Pieces Key",
  "ui.components.printingguide.3b2f3af27f": "Hover or tap any page cell in the interactive right grid map. Each cell highlights which paper coordinate matches which custom garment panel!",
  "ui.components.printingguide.40bb6721e8": "Fold along the crop indicators and overlay directly. Avoids scissors, but builds thickness at corners.",
  "ui.components.printingguide.4193f64c22": "Inspect Coordinate",
  "ui.components.printingguide.46ee66dfb2": "Always open PDF blueprints in **Adobe Reader** or your system native PDF viewer. Avoiding mobile browser quick-previews which often compress scaling factors.",
  "ui.components.printingguide.4a1f706dce": "A0 Roll",
  "ui.components.printingguide.4b1ce03ade": "Now tape adjacent edges using high-quality matte finish clear tape. Tape along the lines first, then secure corner intersections.",
  "ui.components.printingguide.54858f145c": "Layout all pages in rows and columns according to their coordinates. Row 1 starts with Page 1A, 1B, 1C etc. Row 2 is 2A, 2B...",
  "ui.components.printingguide.5ad3ec9e95": "Tape All Pages",
  "ui.components.printingguide.68b377a9b6": "Est. Assemble:",
  "ui.components.printingguide.69537bf21a": "Slice off the **top** and **right** margins of every page. Leave the bottom and left intact to act as pasting anchors.",
  "ui.components.printingguide.7367cc62fb": "Ensure your print settings select **Custom Scale: 100%** or **Actual Size**. Do not use \"Fit to Page\" or \"Shrink oversized pages\" under any circumstances.",
  "ui.components.printingguide.7c8ce7dd59": "Taped sheets:",
  "ui.components.printingguide.80d3b4ba53": "No cutting or taping required.",
  "ui.components.printingguide.81ba4709f6": "Select Sewing Pattern:",
  "ui.components.printingguide.8fc4310a0b": "Previous Step",
  "ui.components.printingguide.914f74e698": "and reprint Page 1.",
  "ui.components.printingguide.9502700fa0": "Mock ERP:",
  "ui.components.printingguide.966620ac50": "Level:",
  "ui.components.printingguide.973b2ffe28": "Interactive PDF Sewing Pattern Assembly Guide",
  "ui.components.printingguide.979b1e496b": "A0 Copyshop Format",
  "ui.components.printingguide.979d3f7211": "Your printer aligns to 100% precision. Proceed to printing remainder pages.",
  "ui.components.printingguide.983c7731a2": "Taped Pages Progress",
  "ui.components.printingguide.99f1b0c10a": "Tap a coordinate page cell to toggle the",
  "ui.components.printingguide.c049d7848c": "Tailoring Advice: Grainline Precision",
  "ui.components.printingguide.c3e742814b": "🔍 Visual Print Preview",
  "ui.components.printingguide.c900f52a6f": "Your Measured Square Size:",
  "ui.components.printingguide.ca53d42679": "Simply unroll the paper directly onto your cutting table, weigh down the corners, and place pattern weights directly over your fabric.",
  "ui.components.printingguide.cf3c063b6a": "Select Paper Output Format:",
  "ui.components.printingguide.d3391975df": "Scale Err",
  "ui.components.printingguide.e0343037e4": "Next Step",
  "ui.components.printingguide.e93bef436a": "Every professional blueprint has a calibration square on page one. Print only **Page 1** first, and check its physical dimensions with a wooden or plastic tailor's ruler.",
  "ui.components.printingguide.ea2adebb36": "💡",
  "ui.components.printingguide.ea829f7ea8": "Fabric Pinning Ready",
  "ui.components.printingguide.fba61109c5": "Atelier Technical Library",
  "ui.components.printingguide.fde88c9891": "Perfect Scale!",
  "ui.components.roledocumentationmodal.0db10f2616": "Registered clientele with customized sizing specifications. Unlocks private workshops for drafting personal designs.",
  "ui.components.roledocumentationmodal.1321373542": "Toggle JSON Routing",
  "ui.components.roledocumentationmodal.17529e4c07": "Supply Collaborator",
  "ui.components.roledocumentationmodal.33dc3913ec": "Direct Sandbox Override",
  "ui.components.roledocumentationmodal.35bad16b83": "Drafting Checklists Gated",
  "ui.components.roledocumentationmodal.454497995b": "Contracted supply partners and fabric brokers. Allows direct tracking of yarn counts, yardages, and shipment arrivals.",
  "ui.components.roledocumentationmodal.4cd1daeec6": "Assigned to anonymous, non-registered site guests. Restricts high-IP features to guarantee data integrity.",
  "ui.components.roledocumentationmodal.4fcb9e6c9c": "Adjust Yardage Quantities",
  "ui.components.roledocumentationmodal.6cb895f307": "Close Ledger",
  "ui.components.roledocumentationmodal.723ed11bfe": "Atelier Role Access Ledger",
  "ui.components.roledocumentationmodal.74764148e9": "Global Matrix Lock Control",
  "ui.components.roledocumentationmodal.7df8909677": "View Public Designs",
  "ui.components.roledocumentationmodal.897aff7411": "Atelier managers and system operators. Possesses sovereign administrative permissions to modify authorization schemas globally.",
  "ui.components.roledocumentationmodal.8f3f04fabf": "Credential Tiers & System Permissions",
  "ui.components.roledocumentationmodal.9059aceaf6": "Read Security Telemetry",
  "ui.components.roledocumentationmodal.948063458f": "Track Sewing Checklists",
  "ui.components.roledocumentationmodal.a46adf4ce5": "Security & Authorization Masterclass",
  "ui.components.roledocumentationmodal.a739b73b80": "Active Drafting Workspace",
  "ui.components.roledocumentationmodal.ac114cc11b": "Dismiss modal",
  "ui.components.roledocumentationmodal.b4da5620c2": "Public Access",
  "ui.components.roledocumentationmodal.c472fe9136": "Textile Roll Ledger Sync",
  "ui.components.roledocumentationmodal.c8e208199e": "Administrative Security Advisory",
  "ui.components.roledocumentationmodal.d0d9818de7": "Inventory Controls Restricted",
  "ui.components.roledocumentationmodal.e4fd53e690": "Client Workspace",
  "ui.components.roledocumentationmodal.e75762180f": "Super Administrator",
  "ui.components.roledocumentationmodal.f292ab838e": "Any override applied inside the live Workspace is isolated to the current client cache. To propagate permissions changes permanent to all ateliers globally, deploy the security blueprint inside your Firestore configuration console.",
  "ui.components.roledocumentationmodal.f9bb9fe645": "This ledger acts as a dynamic source of truth for the Atelier's access policies. Components are compiled and served conditionally to prevent unauthorized client execution. Use this guide to audit public vs enterprise boundaries.",
  "ui.components.roledocumentationmodal.ff9810ec74": "Inventory Ledger Hidden",
  "ui.components.sewingsessiontimer.0080055cee": "Export CSV",
  "ui.components.sewingsessiontimer.018314dfdf": "Sample Notes.txt",
  "ui.components.sewingsessiontimer.01bb3e2d9d": "All Tags",
  "ui.components.sewingsessiontimer.01d8c25742": "Linen",
  "ui.components.sewingsessiontimer.023d2c325c": "For upcoming",
  "ui.components.sewingsessiontimer.0273ef6722": "Understocked",
  "ui.components.sewingsessiontimer.034ced6448": "Remove reminder",
  "ui.components.sewingsessiontimer.034e0986a6": "\"Patience and precision are the thread and needle of masterpiece tailoring.\"",
  "ui.components.sewingsessiontimer.04110cf1d7": "Total Adjusted Needed:",
  "ui.components.sewingsessiontimer.04703e2da1": "This duration is the professional industrial benchmark for the",
  "ui.components.sewingsessiontimer.061ffb5d87": "Seconds Spent",
  "ui.components.sewingsessiontimer.064ad542c0": "Your stash is short by",
  "ui.components.sewingsessiontimer.067f8af76d": "Leather",
  "ui.components.sewingsessiontimer.06948f5f55": "Shorten hem by 3cm, increase sleeve width, or make shoulder dart modifications...",
  "ui.components.sewingsessiontimer.0a8298e8e2": "e.g. 88",
  "ui.components.sewingsessiontimer.0bbb3026b2": "Live Feed",
  "ui.components.sewingsessiontimer.0bc7004613": "Add Fabric Specimen",
  "ui.components.sewingsessiontimer.0c1349225f": "Assign to Project / Pattern",
  "ui.components.sewingsessiontimer.0c7a35e3ac": "Dynamic Material Planner",
  "ui.components.sewingsessiontimer.0d5cb942ba": "Measuring Rules:",
  "ui.components.sewingsessiontimer.0e7d2681ff": "Download shopping list as Text File",
  "ui.components.sewingsessiontimer.117f2b0bf5": "required.",
  "ui.components.sewingsessiontimer.122ae6e992": "4. Planned Fabric Width",
  "ui.components.sewingsessiontimer.134d6212e8": "Low Stock",
  "ui.components.sewingsessiontimer.171645d11a": "Reset File",
  "ui.components.sewingsessiontimer.18f5dd7b3c": "Assigned",
  "ui.components.sewingsessiontimer.190bfea801": "Sample Specs.csv",
  "ui.components.sewingsessiontimer.197dddfa27": "Exit Focus",
  "ui.components.sewingsessiontimer.199fd895e0": "Select sewing patterns from your list to automatically scan your fabric inventory. The planner will compare the yardage you need with fabrics you have assigned, highlight any shortages, and compile a notions shopping checklist.",
  "ui.components.sewingsessiontimer.1aa7376051": "Denim",
  "ui.components.sewingsessiontimer.1acf8873b8": "Sample Specs.json",
  "ui.components.sewingsessiontimer.1b5ad84f1e": "or choose file",
  "ui.components.sewingsessiontimer.1ccebf3cc7": "Target Industrial SAM:",
  "ui.components.sewingsessiontimer.1de233284c": "Couture Focus Mode",
  "ui.components.sewingsessiontimer.1e345cac6d": "Unassigned",
  "ui.components.sewingsessiontimer.1e41abf22f": "Fabric Swatch Photo / Colorway Card",
  "ui.components.sewingsessiontimer.1efac077ff": "Filter progress photos and view cumulative sewing hours.",
  "ui.components.sewingsessiontimer.204fa36e84": "Stash is Sufficient!",
  "ui.components.sewingsessiontimer.208170e7d5": "1. Select Pattern Blueprint",
  "ui.components.sewingsessiontimer.208b509ebe": "Attached Session Photo",
  "ui.components.sewingsessiontimer.21eb806b3c": "Add Photo",
  "ui.components.sewingsessiontimer.225ba04b8f": "Sync Pattern to Active Planner",
  "ui.components.sewingsessiontimer.22e1883feb": "3. Target Body Size",
  "ui.components.sewingsessiontimer.23df396dd3": "Monitor project budgets by aggregating the cost per yard of fabrics currently assigned to that project. Link additional stash fabrics, update their cost details in-line, and forecast fabric expenses.",
  "ui.components.sewingsessiontimer.251bf203c2": "Take your measurements snugly against your body. This allows Perfect Fit Bureau to sync fabric requirements automatically with the sizing advisor grid.",
  "ui.components.sewingsessiontimer.2535e8507a": "Active Blueprint Design",
  "ui.components.sewingsessiontimer.2664044195": "Total Time",
  "ui.components.sewingsessiontimer.26fea7d581": "Construction Log by Design",
  "ui.components.sewingsessiontimer.279b949a26": "Pattern / PDF Display Name",
  "ui.components.sewingsessiontimer.28fd95fff1": "Remove item",
  "ui.components.sewingsessiontimer.29015cc5a9": "Step 2: Select Pattern Size",
  "ui.components.sewingsessiontimer.29e2b5e448": "Your fabric stash is currently empty.",
  "ui.components.sewingsessiontimer.2aaa39aec9": "My Tailoring Projects Portfolio",
  "ui.components.sewingsessiontimer.2b86064c46": "💡 Suggestion: Link your unassigned stash items to this pattern in the Stash list to avoid buying new material! Otherwise, buy",
  "ui.components.sewingsessiontimer.2dc5828ead": "phase. Set a balanced rhythm for custom couture work.",
  "ui.components.sewingsessiontimer.2dff4677f1": ", but you have",
  "ui.components.sewingsessiontimer.2ededdac5c": "44\" Width",
  "ui.components.sewingsessiontimer.2f26b332f9": "Fabric Type / Fiber",
  "ui.components.sewingsessiontimer.2f282a2fe6": "60\"",
  "ui.components.sewingsessiontimer.31ab789988": "e.g. linen drape fabric, lining silk",
  "ui.components.sewingsessiontimer.33163462cc": "Want to test our real-time metadata parser?",
  "ui.components.sewingsessiontimer.34a1d2dd20": "✓ Photo Attached",
  "ui.components.sewingsessiontimer.352f78febe": "Minutes Spent",
  "ui.components.sewingsessiontimer.354968a8d4": "Overall tracking analytics of your tailoring journey.",
  "ui.components.sewingsessiontimer.3614c7323a": "Sessions Logged",
  "ui.components.sewingsessiontimer.3625295184": "View",
  "ui.components.sewingsessiontimer.36cefda385": "Step 1: Choose Pattern",
  "ui.components.sewingsessiontimer.36eb8e7cd5": "Select Project or Design",
  "ui.components.sewingsessiontimer.38424e6849": "Bust:",
  "ui.components.sewingsessiontimer.3850e080c2": "Custom Design Project",
  "ui.components.sewingsessiontimer.3868ab87cc": "Completed",
  "ui.components.sewingsessiontimer.39bf9d67f8": "Add a new quick reminder...",
  "ui.components.sewingsessiontimer.3a9157bb3e": "📁 Digital File Import",
  "ui.components.sewingsessiontimer.3b0f9cdbc8": "Need to buy:",
  "ui.components.sewingsessiontimer.3d8db0d784": "Leather / Suede",
  "ui.components.sewingsessiontimer.3de26e3a1e": "Assigned Fabrics Details:",
  "ui.components.sewingsessiontimer.3e67351a03": "Assign",
  "ui.components.sewingsessiontimer.3e708ac9ef": "Decrypting layer guidelines, size tables, and fabric requirements...",
  "ui.components.sewingsessiontimer.3f6ed69886": "Assigned Yardage",
  "ui.components.sewingsessiontimer.3fcc6af7d4": "Remove from stash",
  "ui.components.sewingsessiontimer.4038d35042": "Softness, weave, pattern, source shop, stretch percentage, pre-washing completed...",
  "ui.components.sewingsessiontimer.40fb138d45": "Or Choose a Palette Fallback",
  "ui.components.sewingsessiontimer.4213f330bb": "Currently tagging:",
  "ui.components.sewingsessiontimer.4315c7f5ad": "Wool",
  "ui.components.sewingsessiontimer.4410fdd74a": "Yardage Calc",
  "ui.components.sewingsessiontimer.44ea5bc8e3": "Session thumbnail",
  "ui.components.sewingsessiontimer.4660bbb078": "Active Sewing Progress",
  "ui.components.sewingsessiontimer.46822d20c4": "Stash Size",
  "ui.components.sewingsessiontimer.4702229928": "Shortage Detected",
  "ui.components.sewingsessiontimer.475b0bff63": "Knits / Jersey",
  "ui.components.sewingsessiontimer.47810da394": "Time Logged",
  "ui.components.sewingsessiontimer.479670b138": "Your session journal is currently empty.",
  "ui.components.sewingsessiontimer.47a74054df": "Materials",
  "ui.components.sewingsessiontimer.480747fdc9": "Active Timer",
  "ui.components.sewingsessiontimer.485176a640": "e.g., 3.5 yards",
  "ui.components.sewingsessiontimer.4a65d2d53d": "Accumulated Time",
  "ui.components.sewingsessiontimer.4b45aff7e2": "Forgot to start the active timer? Record your completed time and sewing comments below.",
  "ui.components.sewingsessiontimer.4c4b9db8ef": "e.g. 68",
  "ui.components.sewingsessiontimer.4f8a58dc42": "Interactive Construction Phases:",
  "ui.components.sewingsessiontimer.51149c6ab8": "60\" Width",
  "ui.components.sewingsessiontimer.5260c0a897": "Velvet / Corduroy",
  "ui.components.sewingsessiontimer.52c65f9063": "Details / Notes",
  "ui.components.sewingsessiontimer.534ba9ab84": "Progress Photo Gallery",
  "ui.components.sewingsessiontimer.539307e5c6": "e.g., Drapey, Summer, Structured, Lining",
  "ui.components.sewingsessiontimer.54511a1078": "e.g. Lengthen hem by 2 inches, using high-drape viscose linen blend, adding side slit...",
  "ui.components.sewingsessiontimer.556ec68927": "Cost Estimator",
  "ui.components.sewingsessiontimer.558d4cb890": "All Fibers / Types",
  "ui.components.sewingsessiontimer.5711161164": "Total Photos",
  "ui.components.sewingsessiontimer.57da5d4d5b": "Compatible Fabrics:",
  "ui.components.sewingsessiontimer.57f89c3be3": "Potential Match in Stash",
  "ui.components.sewingsessiontimer.587109100e": "Click to expand visual milestone",
  "ui.components.sewingsessiontimer.59401c2531": "Synthetic / Poly",
  "ui.components.sewingsessiontimer.5986372200": "Filter by Use Case / Tag:",
  "ui.components.sewingsessiontimer.5a8152e3a7": "Active Couture Session",
  "ui.components.sewingsessiontimer.5a9be8a872": "Measurements",
  "ui.components.sewingsessiontimer.5c7f0e56dd": "My Fabric Stash",
  "ui.components.sewingsessiontimer.5d4c14521b": "Construction Progress",
  "ui.components.sewingsessiontimer.5e458f1cac": "Quick edit cost per yard",
  "ui.components.sewingsessiontimer.5f125d8ff0": "Full-size progress preview",
  "ui.components.sewingsessiontimer.5f6a0263fc": "Track bespoke sizing and auto-fill yardage for linked designs.",
  "ui.components.sewingsessiontimer.610180c070": "Recommended Fabric Width",
  "ui.components.sewingsessiontimer.615aa5de69": "You have",
  "ui.components.sewingsessiontimer.61d9b76114": "Custom Tailoring Project",
  "ui.components.sewingsessiontimer.62cf417437": "e.g. My Autumn Aurelia Dress",
  "ui.components.sewingsessiontimer.65bd005983": "Delete record",
  "ui.components.sewingsessiontimer.6761ba0d0c": "Manual Log",
  "ui.components.sewingsessiontimer.6923e3e3ef": "No reminders added for this design yet. Log notes below.",
  "ui.components.sewingsessiontimer.6abef46cab": "yds",
  "ui.components.sewingsessiontimer.6d202f56b3": "Click to upload fabric swatch photo",
  "ui.components.sewingsessiontimer.6f3e4e9ffb": "Record Log",
  "ui.components.sewingsessiontimer.706732215d": "Photos",
  "ui.components.sewingsessiontimer.70b517fcab": "No active completion records found. Active timers will render stats here.",
  "ui.components.sewingsessiontimer.71fd9f0a9c": "Duration:",
  "ui.components.sewingsessiontimer.7400fe0f87": "Assigned:",
  "ui.components.sewingsessiontimer.74240553dd": "Verify Extracted Metadata",
  "ui.components.sewingsessiontimer.743157a445": "Hips:",
  "ui.components.sewingsessiontimer.749cb4fc30": "Click to toggle completion status",
  "ui.components.sewingsessiontimer.74c0990b70": "Synthetic",
  "ui.components.sewingsessiontimer.7503bd3695": "Requirement Invoice",
  "ui.components.sewingsessiontimer.756ca6b636": "✍️ Manual Entry",
  "ui.components.sewingsessiontimer.7692fdce12": "e.g. 2.5 meters",
  "ui.components.sewingsessiontimer.769b302a09": "Total Value",
  "ui.components.sewingsessiontimer.7778a1a4e6": "Accumulated",
  "ui.components.sewingsessiontimer.779b75c798": "44\"",
  "ui.components.sewingsessiontimer.77ae7e5b01": "Snap Photo",
  "ui.components.sewingsessiontimer.77f7cd241f": "Attachment",
  "ui.components.sewingsessiontimer.787504a0da": "No time logs recorded yet. Start working with the timer to track progress.",
  "ui.components.sewingsessiontimer.7929b33e9c": "Assign fabrics from your stash list, register a new fabric specimen above, or choose a recommended material below!",
  "ui.components.sewingsessiontimer.792fef5dd4": "Custom Pattern Name",
  "ui.components.sewingsessiontimer.79362f7ed5": "or upload file",
  "ui.components.sewingsessiontimer.79a5845c4c": "Fabric Notes / Intended Care / Features",
  "ui.components.sewingsessiontimer.7aa9930d26": "Silk",
  "ui.components.sewingsessiontimer.7c245aa7c1": "Tailored Project",
  "ui.components.sewingsessiontimer.80845d5cef": "Total cost of assigned materials",
  "ui.components.sewingsessiontimer.808bc67d1c": "Cotton",
  "ui.components.sewingsessiontimer.810130dbc8": "Click \"Log Fabric\" above to record your first piece.",
  "ui.components.sewingsessiontimer.812dd6394f": "2. Project Display Name",
  "ui.components.sewingsessiontimer.8141583d2b": "of compatible unassigned fabric!",
  "ui.components.sewingsessiontimer.8230ef1510": "Pattern-Specific Adjustments",
  "ui.components.sewingsessiontimer.86d05c0e63": "Fully Stocked",
  "ui.components.sewingsessiontimer.8792741bbd": "Fabric Requirement",
  "ui.components.sewingsessiontimer.88284180e7": "Selected Swatch Preview",
  "ui.components.sewingsessiontimer.8b416c8934": "Visual Progress Gallery",
  "ui.components.sewingsessiontimer.8dbe79c185": "Pause Session",
  "ui.components.sewingsessiontimer.8e23b5fe75": "✓ You have enough fabric assigned in your inventory to begin cutting!",
  "ui.components.sewingsessiontimer.8e42fc1b6e": "⏱️ Couture Sewing Timer",
  "ui.components.sewingsessiontimer.8f77d74c30": "💡 Matching Fabrics Found in Stash",
  "ui.components.sewingsessiontimer.9055a7b055": "Blueprint:",
  "ui.components.sewingsessiontimer.90e361cb04": "Capture Project Progress",
  "ui.components.sewingsessiontimer.9193a91f25": "Sewing Activity Journal",
  "ui.components.sewingsessiontimer.91bc362b1d": "Milestones",
  "ui.components.sewingsessiontimer.91cedb8120": "All Sessions",
  "ui.components.sewingsessiontimer.92a84ebed1": "✨ Recommended yardage requirements will auto-adjust based on width selection.",
  "ui.components.sewingsessiontimer.92b0ec527b": "e.g., 54 inches or 140 cm",
  "ui.components.sewingsessiontimer.94b16aa869": "Log Fabric",
  "ui.components.sewingsessiontimer.955c31213b": "Clear All",
  "ui.components.sewingsessiontimer.9623a3762c": "+ Add Fabric Requirement",
  "ui.components.sewingsessiontimer.9ad1883469": "Edit specimen record",
  "ui.components.sewingsessiontimer.9c8b0c5782": "Ready to Log",
  "ui.components.sewingsessiontimer.9cf4ccd42f": "Est. Yardage",
  "ui.components.sewingsessiontimer.9eaf4e97fb": "Avg Cost / Yard",
  "ui.components.sewingsessiontimer.a043ca6c04": "Cancel",
  "ui.components.sewingsessiontimer.a0464d09a0": "Tag Pattern Card",
  "ui.components.sewingsessiontimer.a133065ccf": "Tailoring Notes",
  "ui.components.sewingsessiontimer.a182199415": "for this pattern",
  "ui.components.sewingsessiontimer.a18e8ffaf9": "Describe construction findings, thread used, or machine tensions...",
  "ui.components.sewingsessiontimer.a30834d9c1": "e.g. Outerwear, Drapey, Warm-weather",
  "ui.components.sewingsessiontimer.a532f58808": "Download List",
  "ui.components.sewingsessiontimer.a534b021a6": "Aggregated Fabric Cost",
  "ui.components.sewingsessiontimer.a615678bb5": "e.g., Indigo Washed Herringbone Denim",
  "ui.components.sewingsessiontimer.a6263a2849": "e.g., Bias Binding, Pocket Assembly, Zipper Set",
  "ui.components.sewingsessiontimer.a6963109cb": "e.g. 168",
  "ui.components.sewingsessiontimer.a8db5de763": "Fabric Type",
  "ui.components.sewingsessiontimer.aa9915fb0e": "Step / Operation Name",
  "ui.components.sewingsessiontimer.acfdfe6677": "Sewing progress",
  "ui.components.sewingsessiontimer.ad86361764": "Delete photo",
  "ui.components.sewingsessiontimer.addf2706f7": "Compatible Stash",
  "ui.components.sewingsessiontimer.ae7874fcc4": "e.g. Vintage Blazer",
  "ui.components.sewingsessiontimer.aeeec80eca": "Close Form",
  "ui.components.sewingsessiontimer.af1bde76e7": "Pause",
  "ui.components.sewingsessiontimer.af215c0bd3": "e.g. 94",
  "ui.components.sewingsessiontimer.afc147b467": "Captured Milestones",
  "ui.components.sewingsessiontimer.b07fd59e5e": "⚠️ You need to purchase",
  "ui.components.sewingsessiontimer.b09b61afd6": "Progress",
  "ui.components.sewingsessiontimer.b234ecc6ee": "Waist:",
  "ui.components.sewingsessiontimer.b29d4c2c8f": "unassigned matches",
  "ui.components.sewingsessiontimer.b41801b88e": "Showing filtered results",
  "ui.components.sewingsessiontimer.b6d68f8c88": "Save Tags",
  "ui.components.sewingsessiontimer.b6e82ad4c9": "No progress photos captured yet. Document your sewing milestones!",
  "ui.components.sewingsessiontimer.b7a9e94ed0": "Custom Pattern...",
  "ui.components.sewingsessiontimer.bd6fdf93a5": "Unassign fabric from this project",
  "ui.components.sewingsessiontimer.be452becb7": "Fabric Name *",
  "ui.components.sewingsessiontimer.c082d0300e": "No fabrics are currently assigned to this project.",
  "ui.components.sewingsessiontimer.c19b9f4068": "/yd",
  "ui.components.sewingsessiontimer.c3040efea5": "Link to Catalog Design",
  "ui.components.sewingsessiontimer.c3c16eae5b": "Remove",
  "ui.components.sewingsessiontimer.c4b351254c": "Clear Filters",
  "ui.components.sewingsessiontimer.c5cc9da158": "No patterns selected",
  "ui.components.sewingsessiontimer.c624a5b700": "Color Swatch",
  "ui.components.sewingsessiontimer.c7ab68e95f": "of compatible fabric.",
  "ui.components.sewingsessiontimer.c8a1ccb2b3": "Sessions",
  "ui.components.sewingsessiontimer.cb2a3b8657": "No specific notions listed for this design.",
  "ui.components.sewingsessiontimer.cc538a396d": "Click \"Link New Project\" to link a design from the gallery, auto-fill dimensions, and track progress.",
  "ui.components.sewingsessiontimer.cf66e49493": "of assigned fabric, which fully covers the estimated",
  "ui.components.sewingsessiontimer.d0f50c883c": "Target Sizing Selection",
  "ui.components.sewingsessiontimer.d19372d9ed": "No fabrics spec requirements stored. Enter elements below.",
  "ui.components.sewingsessiontimer.d2dcee7848": "Other / Blend",
  "ui.components.sewingsessiontimer.d3b40560f1": "Min",
  "ui.components.sewingsessiontimer.d494995147": "Tweed / Coating",
  "ui.components.sewingsessiontimer.d65e46cdb9": "Close",
  "ui.components.sewingsessiontimer.d850fb3cd5": "Describe fit, needle tension, sewing speed observations...",
  "ui.components.sewingsessiontimer.d8eadeed35": "Download time logs as CSV",
  "ui.components.sewingsessiontimer.d8f616be57": "Current Construction Phase",
  "ui.components.sewingsessiontimer.da95801929": "Catalog and track your textiles for upcoming sewing projects.",
  "ui.components.sewingsessiontimer.dac7d1617e": "Narrow Fold / Single Fold Lay",
  "ui.components.sewingsessiontimer.dbd170fa9f": "Swatch Preview",
  "ui.components.sewingsessiontimer.dcab3f7a87": "Custom Tailoring Pattern",
  "ui.components.sewingsessiontimer.dd1f727610": "No compatible unassigned fabrics detected in your stash.",
  "ui.components.sewingsessiontimer.de51a56b02": "Sec",
  "ui.components.sewingsessiontimer.dfc3c5ae77": "Delete Project",
  "ui.components.sewingsessiontimer.e213d3ee94": "Cancel",
  "ui.components.sewingsessiontimer.e235353942": "Thumbnail",
  "ui.components.sewingsessiontimer.e3ab06abd7": "Select one or more patterns above to compile your custom fabric yardage calculation and notions checklist.",
  "ui.components.sewingsessiontimer.e3f97c4046": "Save cost",
  "ui.components.sewingsessiontimer.e46167e00a": "Custom Tailoring",
  "ui.components.sewingsessiontimer.e4a5688233": "Alert Threshold:",
  "ui.components.sewingsessiontimer.e4eaabd3c6": "Log Sewing Session Manually",
  "ui.components.sewingsessiontimer.e6ab756649": "Snap Progress Photo",
  "ui.components.sewingsessiontimer.e9056b1901": "Assigned Fabric",
  "ui.components.sewingsessiontimer.ea5f048267": "Design Blueprint",
  "ui.components.sewingsessiontimer.eaf2850a71": "Calculate your exact fabric yardage based on pattern sizing and fabric width. The estimator automatically adjusts requirements for size variations and checks your stash for assigned or compatible fabrics to recommend what to buy.",
  "ui.components.sewingsessiontimer.ebce300c6b": "Wide Fold / Double Fold Lay",
  "ui.components.sewingsessiontimer.ecb9e04abb": "Review, modify, or add notes before adding design to your bespoke portfolio.",
  "ui.components.sewingsessiontimer.ed66433c66": "Garments",
  "ui.components.sewingsessiontimer.eef1575837": "Add",
  "ui.components.sewingsessiontimer.efe89e8d8c": "No fabrics match your active filters.",
  "ui.components.sewingsessiontimer.f050db3e87": "Resume / Start",
  "ui.components.sewingsessiontimer.f0aba15b2d": "Project Reminders",
  "ui.components.sewingsessiontimer.f14601c85d": "Tag fabric properties",
  "ui.components.sewingsessiontimer.f1f7f201f8": "Remove Swatch Photo",
  "ui.components.sewingsessiontimer.f451263b83": "Step 1: Choose Patterns to Plan",
  "ui.components.sewingsessiontimer.f5ff9a9942": "Step 3: Select Fabric Width",
  "ui.components.sewingsessiontimer.f6bebc6edb": "Duration Counter",
  "ui.components.sewingsessiontimer.f90a180594": "Upload from Device instead",
  "ui.components.sewingsessiontimer.fb4ac5d777": "Resume Timer",
  "ui.components.sewingsessiontimer.fb51384af9": "Save Fit Measurements",
  "ui.components.sewingsessiontimer.fc0a95030e": "Active Projects",
  "ui.components.sewingsessiontimer.fd9389dc22": "Enter Immersive Focus Mode",
  "ui.components.sewingsessiontimer.fe042995ff": "Required:",
  "ui.components.sewingsessiontimer.fe9ae466b1": "No progress photos found for this view. Use the \"Snap Progress Photo\" buttons under Notes or active session timer to log visuals!",
  "ui.components.sewingsessiontimer.ff852961f1": "Download fabric inventory as CSV",
  "ui.components.signatureorbitcarousela.0ee5bb573d": "Collections",
  "ui.components.signatureorbitcarousela.48a39b902c": "Next signature pattern",
  "ui.components.signatureorbitcarousela.6100ac2018": "Previous signature pattern",
  "ui.components.signatureorbitcarousela.6b5d85351e": "Our",
  "ui.components.signatureorbitcarousela.c64b027470": "Signature",
  "ui.components.signatureperspectivestackcarouselb.4889c7f791": "Previous signature pattern",
  "ui.components.signatureperspectivestackcarouselb.57afea2eef": "Signature",
  "ui.components.signatureperspectivestackcarouselb.c243e94318": "Next signature pattern",
  "ui.components.signatureperspectivestackcarouselb.f2fc44ed4f": "Collections",
  "ui.components.signatureperspectivestackcarouselb.fa4e9f2983": "Our",
  "ui.components.stayinspirednewsletter.01644973f8": "Select Your Desired Inspiration:",
  "ui.components.stayinspirednewsletter.02294664b2": "for",
  "ui.components.stayinspirednewsletter.045a07fa93": "15% off",
  "ui.components.stayinspirednewsletter.0db771155e": "YOU ARE ON THE REGISTER!",
  "ui.components.stayinspirednewsletter.2ccc642076": "Subscribe to receive monthly sewing pattern releases, bespoke design guides, and exclusive updates sent straight to your creative workbench.",
  "ui.components.stayinspirednewsletter.555c025d18": "Welcome to the Perfect Fit Community. Use code",
  "ui.components.stayinspirednewsletter.5f45f9c250": "Monthly Sewing Pattern Updates",
  "ui.components.stayinspirednewsletter.84e5e7d9e1": "your next purchased pattern.",
  "ui.components.stayinspirednewsletter.932a821c29": "Subscribe",
  "ui.components.stayinspirednewsletter.bde5a8b7c5": "Perfect Fit News",
  "ui.components.stayinspirednewsletter.bfac95637d": "tailor@atelier.com",
  "ui.components.stayinspirednewsletter.da68683d32": "← Manage Preferences / Add Another",
  "ui.components.stayinspirednewsletter.f7e36c96d7": "Pattern Updates",
  "ui.components.subcomponents.checkoutstore.070413783b": "Add To Mock Cart",
  "ui.components.subcomponents.checkoutstore.0b4c6d03ea": "Store Cart Value",
  "ui.components.subcomponents.checkoutstore.117917881a": "maker@atelier.com",
  "ui.components.subcomponents.checkoutstore.1888bb2e08": "State",
  "ui.components.subcomponents.checkoutstore.1c7b159e44": "Back to Summary",
  "ui.components.subcomponents.checkoutstore.218fca46b7": "Courier Delivery Option:",
  "ui.components.subcomponents.checkoutstore.29042dd401": "Street Address",
  "ui.components.subcomponents.checkoutstore.29d88c0cf7": "Margot Leone",
  "ui.components.subcomponents.checkoutstore.2b25a100b9": "Sandbox Mode Security:",
  "ui.components.subcomponents.checkoutstore.30be11db3a": "Proceed to Customer Address",
  "ui.components.subcomponents.checkoutstore.31ad4ead17": "Back to Address",
  "ui.components.subcomponents.checkoutstore.332c956689": "Secure Code",
  "ui.components.subcomponents.checkoutstore.33cbad147d": "Bust",
  "ui.components.subcomponents.checkoutstore.37f4491acb": "*All patterns include 1.5cm standard seam allowances on drafting templates.",
  "ui.components.subcomponents.checkoutstore.3a2a969c3b": "Remove item",
  "ui.components.subcomponents.checkoutstore.3c898faca0": "\"Actual Size\" / 100% scale",
  "ui.components.subcomponents.checkoutstore.3e62e15e58": "Clear",
  "ui.components.subcomponents.checkoutstore.456bb13941": "Detailed step-by-step assembly tips are nested in the illustrated digital handbook.",
  "ui.components.subcomponents.checkoutstore.456f0ec63f": "Waist",
  "ui.components.subcomponents.checkoutstore.45fe945afb": "Expiration Date",
  "ui.components.subcomponents.checkoutstore.496fd773e6": "Payment Methods",
  "ui.components.subcomponents.checkoutstore.49a097666f": "Cart Items Subtotal:",
  "ui.components.subcomponents.checkoutstore.4dc0b4ac23": "Verifying Card...",
  "ui.components.subcomponents.checkoutstore.504e2a42dd": "Pick Curated Blueprints",
  "ui.components.subcomponents.checkoutstore.5796375641": "Date Handled:",
  "ui.components.subcomponents.checkoutstore.5b77be0bce": "Cardholder",
  "ui.components.subcomponents.checkoutstore.5f8834f0fa": "SECURE SIMULATION WORKSPACE FOR COUTURE DEVS. NO TRANSFERS ACTIVE. CLICK CARD TO FLIP.",
  "ui.components.subcomponents.checkoutstore.5fa0b0e016": "Verify the 2-inch calibration reference block on page 1 of drawings prior to pinning fabrics.",
  "ui.components.subcomponents.checkoutstore.6bc06520bf": "03 Payment",
  "ui.components.subcomponents.checkoutstore.6c8d343765": "Leone",
  "ui.components.subcomponents.checkoutstore.7d9b281aef": "Pick premium patterns from the curated showroom catalog on the left to initialize a dynamic checkout run.",
  "ui.components.subcomponents.checkoutstore.7e8b2069a9": "Card Number",
  "ui.components.subcomponents.checkoutstore.8197449b06": "First Name",
  "ui.components.subcomponents.checkoutstore.82e14a035e": "Grand Total Net Invoice:",
  "ui.components.subcomponents.checkoutstore.88e5c56caf": "Authorized To:",
  "ui.components.subcomponents.checkoutstore.8b0a3366a9": "Retrieve Files",
  "ui.components.subcomponents.checkoutstore.8c1fa018cd": "Invoice Net Paid:",
  "ui.components.subcomponents.checkoutstore.8e0f20283d": "01 Summary",
  "ui.components.subcomponents.checkoutstore.93f0934bf5": "04 Download",
  "ui.components.subcomponents.checkoutstore.99d66f9b31": "Hips",
  "ui.components.subcomponents.checkoutstore.9c91c5b8b4": "Printed Tissue",
  "ui.components.subcomponents.checkoutstore.9e4719b7f9": "Courier Address:",
  "ui.components.subcomponents.checkoutstore.a3c2026304": "MM/YY",
  "ui.components.subcomponents.checkoutstore.a4785ac499": "Margot",
  "ui.components.subcomponents.checkoutstore.ad8a2d9279": "Draft, choose, and securely buy patterns. Test checkout validation flows, virtual credit card flipping, and retrieve live blueprint PDF downloads.",
  "ui.components.subcomponents.checkoutstore.afb4e6cbda": "Authorized Pattern Downloads",
  "ui.components.subcomponents.checkoutstore.b05889d3f9": "Last Name",
  "ui.components.subcomponents.checkoutstore.bc7710deec": "Pattern Printing Guidelines",
  "ui.components.subcomponents.checkoutstore.c12c32da10": "Perfect Fit Couture",
  "ui.components.subcomponents.checkoutstore.c29393d51a": "ZIP Code",
  "ui.components.subcomponents.checkoutstore.ceed5719f7": "02 Address",
  "ui.components.subcomponents.checkoutstore.cf43f5f43f": "This storefront runs entirely on client local state. No real money is transferred, and card authorization details are simulated locally.",
  "ui.components.subcomponents.checkoutstore.cff95accb1": "Cardholder Name",
  "ui.components.subcomponents.checkoutstore.d2fce8c7d7": "Expires",
  "ui.components.subcomponents.checkoutstore.d3aa9e4a1a": "Always print PDF drafting schematics at",
  "ui.components.subcomponents.checkoutstore.d4c18a8e38": "City",
  "ui.components.subcomponents.checkoutstore.da0bc79e5a": "Order Reference:",
  "ui.components.subcomponents.checkoutstore.da54ba9f70": "Package",
  "ui.components.subcomponents.checkoutstore.dc2524400d": "Digital delivery is instant and free",
  "ui.components.subcomponents.checkoutstore.e5b9105aba": "Size",
  "ui.components.subcomponents.checkoutstore.e77f64d18e": "Apply Code",
  "ui.components.subcomponents.checkoutstore.ec2f2fadd1": "Your store cart is currently empty",
  "ui.components.subcomponents.checkoutstore.f0f54b41fd": "PDF Blueprint",
  "ui.components.subcomponents.checkoutstore.f4c8da2372": "Security Code CVC",
  "ui.components.subcomponents.checkoutstore.f5f4a8beb3": "PRINTED ITEMS REQUIRE SHIPPING",
  "ui.components.subcomponents.checkoutstore.f6079fcfaf": "Format",
  "ui.components.subcomponents.collaboratorworkspace.000e877b39": "My Submitted Products",
  "ui.components.subcomponents.collaboratorworkspace.03b208b3b0": "Intermediate",
  "ui.components.subcomponents.collaboratorworkspace.0b906b923d": "Save measurements & study progress anytime",
  "ui.components.subcomponents.collaboratorworkspace.107c3ae6d4": "Verified Supplier",
  "ui.components.subcomponents.collaboratorworkspace.12bac35153": "Avg Lead Time:",
  "ui.components.subcomponents.collaboratorworkspace.15df123656": "Describe the pattern, style, fit, and ideal use.",
  "ui.components.subcomponents.collaboratorworkspace.173e3abaac": "Restock",
  "ui.components.subcomponents.collaboratorworkspace.185d131f95": "One-Time Shareable Token Link",
  "ui.components.subcomponents.collaboratorworkspace.18ffa6076d": "Enabled",
  "ui.components.subcomponents.collaboratorworkspace.1becff2a1f": "Material Details",
  "ui.components.subcomponents.collaboratorworkspace.1cf0a8ed56": "Designer / Brand",
  "ui.components.subcomponents.collaboratorworkspace.1fd150cae5": "Color / Swatch name",
  "ui.components.subcomponents.collaboratorworkspace.22c22d6443": "Full Tech Pack Specs",
  "ui.components.subcomponents.collaboratorworkspace.230d36f399": "The French Draped Trench",
  "ui.components.subcomponents.collaboratorworkspace.27b131695c": "Share One-Time Token Link",
  "ui.components.subcomponents.collaboratorworkspace.28065f7e64": "Restock Warning",
  "ui.components.subcomponents.collaboratorworkspace.291bfcd8bb": "for a single session without gallery exposure.",
  "ui.components.subcomponents.collaboratorworkspace.34c10311fe": "Admin approval required",
  "ui.components.subcomponents.collaboratorworkspace.374a299a68": "Atelier Stock Registry",
  "ui.components.subcomponents.collaboratorworkspace.37b7db0fbd": "Close",
  "ui.components.subcomponents.collaboratorworkspace.39ec702647": "e.g. Maria Rossi",
  "ui.components.subcomponents.collaboratorworkspace.3c3fb458e4": "Contact Representative",
  "ui.components.subcomponents.collaboratorworkspace.3c7adf5fa1": "Register B2B Partner",
  "ui.components.subcomponents.collaboratorworkspace.3d280f112f": "No active projects. Start a bespoke design from the left sidebar to activate.",
  "ui.components.subcomponents.collaboratorworkspace.3e9082bdde": "Download Assembly PDF",
  "ui.components.subcomponents.collaboratorworkspace.3ea1583de7": "Register Supplier",
  "ui.components.subcomponents.collaboratorworkspace.403ad22ebf": "Fabric Roll",
  "ui.components.subcomponents.collaboratorworkspace.406cbd2ed6": "Type / Weight",
  "ui.components.subcomponents.collaboratorworkspace.434b8ca738": "Comma-separated",
  "ui.components.subcomponents.collaboratorworkspace.471674b07d": "In Stock",
  "ui.components.subcomponents.collaboratorworkspace.4c84e03d80": "Mill Specialty / Raw Fiber",
  "ui.components.subcomponents.collaboratorworkspace.4d8d6e3e23": "Email Address",
  "ui.components.subcomponents.collaboratorworkspace.5188b6de36": "e.g. Organic, Linen, Premium",
  "ui.components.subcomponents.collaboratorworkspace.52830cc330": "Actions",
  "ui.components.subcomponents.collaboratorworkspace.5360bf92f9": "Heavy Wool Crepe",
  "ui.components.subcomponents.collaboratorworkspace.5764970a69": "Printed Price",
  "ui.components.subcomponents.collaboratorworkspace.59eb036660": "Create Project Space",
  "ui.components.subcomponents.collaboratorworkspace.5a45a6f86d": "Pattern Template:",
  "ui.components.subcomponents.collaboratorworkspace.5a83cd326b": "Archive project",
  "ui.components.subcomponents.collaboratorworkspace.5e882283f9": "Recommended Fabrics",
  "ui.components.subcomponents.collaboratorworkspace.5e95241c1a": "Atelier Collaborator Hub",
  "ui.components.subcomponents.collaboratorworkspace.5ef58e1903": "Unit Cost",
  "ui.components.subcomponents.collaboratorworkspace.5f21463429": "e.g. Italian Crepe, Linen Weaves",
  "ui.components.subcomponents.collaboratorworkspace.6469fcca55": "Fabric Tags",
  "ui.components.subcomponents.collaboratorworkspace.65fd7e3a8e": "Advanced",
  "ui.components.subcomponents.collaboratorworkspace.6618e23f33": "Perfect Fit Hourglass Blazer",
  "ui.components.subcomponents.collaboratorworkspace.667f9cde13": "Reason for request",
  "ui.components.subcomponents.collaboratorworkspace.6886056ec4": "i.stock",
  "ui.components.subcomponents.collaboratorworkspace.lowStock": "Low Stock",
  "ui.components.subcomponents.collaboratorworkspace.6a0df7fced": "Record fitting adjustments, proprietary seam finishes, and confidential notes for",
  "ui.components.subcomponents.collaboratorworkspace.6a5c2a0d8f": "Textile Spec Type",
  "ui.components.subcomponents.collaboratorworkspace.6afbcff7ca": "Request a new category / subcategory",
  "ui.components.subcomponents.collaboratorworkspace.6c2789a300": "Total Yardage",
  "ui.components.subcomponents.collaboratorworkspace.6d93a195c4": "Save Secrets Journal",
  "ui.components.subcomponents.collaboratorworkspace.700e129fd7": "Collaborator Development Secrets Journal",
  "ui.components.subcomponents.collaboratorworkspace.7257a1c687": "Consolidated Atelier Workspace",
  "ui.components.subcomponents.collaboratorworkspace.7538bffea8": "Start Feature Walkthrough",
  "ui.components.subcomponents.collaboratorworkspace.76d19c01dd": "Order Code / Date",
  "ui.components.subcomponents.collaboratorworkspace.7820400c89": "Material Ordered",
  "ui.components.subcomponents.collaboratorworkspace.787a755f23": "e.g. +39 031 12345",
  "ui.components.subcomponents.collaboratorworkspace.787fc44c83": "Phone Line",
  "ui.components.subcomponents.collaboratorworkspace.78c80cb669": "Ctrl",
  "ui.components.subcomponents.collaboratorworkspace.7a90a5179b": "Submit Product for Admin Review",
  "ui.components.subcomponents.collaboratorworkspace.7b008f9644": "Subtract 5 yards",
  "ui.components.subcomponents.collaboratorworkspace.82f7f95df9": "Collection Tags",
  "ui.components.subcomponents.collaboratorworkspace.86a200ef3d": "Add to Inventory",
  "ui.components.subcomponents.collaboratorworkspace.89776e3cb4": "Shortcut: Press Ctrl+S anywhere",
  "ui.components.subcomponents.collaboratorworkspace.8a39fd2007": "Enter secret seam allowance modifications, fitting adjustments, or fabric testing notes...",
  "ui.components.subcomponents.collaboratorworkspace.8b46f59b10": "✦ Product Release Workflow",
  "ui.components.subcomponents.collaboratorworkspace.8b908fe56c": "This technical profile is restricted to active atelier collaborators. Unlinked from customer-facing galleries to protect confidential drafting methods.",
  "ui.components.subcomponents.collaboratorworkspace.8b9e10b396": "Token Sharing:",
  "ui.components.subcomponents.collaboratorworkspace.8beb392233": "Interfacing Mesh",
  "ui.components.subcomponents.collaboratorworkspace.8c74ebd60f": "Requested category name",
  "ui.components.subcomponents.collaboratorworkspace.8e30fa6ab8": "One-Time Access Grant Link",
  "ui.components.subcomponents.collaboratorworkspace.8ffcb37f77": "Anyone with this token link can view the confidential development journey and technical specs for",
  "ui.components.subcomponents.collaboratorworkspace.903c58326c": "e.g. Organic Hemp Crepe",
  "ui.components.subcomponents.collaboratorworkspace.9060a5adec": "Download fabric inventory and tags report",
  "ui.components.subcomponents.collaboratorworkspace.933ecb581d": "1-Time View Limit",
  "ui.components.subcomponents.collaboratorworkspace.9934b10718": "Collaborator Secret Vault",
  "ui.components.subcomponents.collaboratorworkspace.9a5240c7d2": "Products created by collaborators are submitted for administrator review before being released to the public catalog.",
  "ui.components.subcomponents.collaboratorworkspace.9c18ad10a8": "Premium Lining",
  "ui.components.subcomponents.collaboratorworkspace.9c8ea2d9da": "Mark Received",
  "ui.components.subcomponents.collaboratorworkspace.9f276170be": "Status:",
  "ui.components.subcomponents.collaboratorworkspace.9fd56aec28": "Collaborator Access Info",
  "ui.components.subcomponents.collaboratorworkspace.a05f13b31f": "Secure Token Link Ready",
  "ui.components.subcomponents.collaboratorworkspace.a4c80cb449": "Unlinked from Gallery",
  "ui.components.subcomponents.collaboratorworkspace.a6099d55ef": "Pipeline Action",
  "ui.components.subcomponents.collaboratorworkspace.a62e61e019": "Material Name",
  "ui.components.subcomponents.collaboratorworkspace.a9dc64ab64": "Copied!",
  "ui.components.subcomponents.collaboratorworkspace.aa63c9e087": "Grading Grid:",
  "ui.components.subcomponents.collaboratorworkspace.adb990155d": "Stock Synced",
  "ui.components.subcomponents.collaboratorworkspace.ae43418e4f": "Export PDF Report",
  "ui.components.subcomponents.collaboratorworkspace.af114edf33": "Logistics Status",
  "ui.components.subcomponents.collaboratorworkspace.b2078d091c": "Active Development",
  "ui.components.subcomponents.collaboratorworkspace.b2b5d4aa68": "Selected Pattern",
  "ui.components.subcomponents.collaboratorworkspace.b3b4af4bdb": "Rep:",
  "ui.components.subcomponents.collaboratorworkspace.b4d5b05529": "Total Materials",
  "ui.components.subcomponents.collaboratorworkspace.b5ab572a82": "e.g. Silk Autumn Dress",
  "ui.components.subcomponents.collaboratorworkspace.b6cf529333": "e.g. Lavender Dusk",
  "ui.components.subcomponents.collaboratorworkspace.bc9f1d30f0": "to save progress",
  "ui.components.subcomponents.collaboratorworkspace.c3f94a3ebe": "Target Pattern",
  "ui.components.subcomponents.collaboratorworkspace.c6e0d30b6f": "Local draft queue awaiting administrator approval.",
  "ui.components.subcomponents.collaboratorworkspace.c78b8d458e": "Standard Seam Allowances",
  "ui.components.subcomponents.collaboratorworkspace.c9913019cf": "✦ Start Bespoke Design ✦",
  "ui.components.subcomponents.collaboratorworkspace.ca2c482c7c": "Copy Link",
  "ui.components.subcomponents.collaboratorworkspace.cabcfe7c4e": "Qty & Cost",
  "ui.components.subcomponents.collaboratorworkspace.cb5e9e5448": "A fully operational workspace to manage your drafting lifecycle, supply chain pipelines, B2B partner directories, and live production tools.",
  "ui.components.subcomponents.collaboratorworkspace.cc3dd8dd01": "PDF Price",
  "ui.components.subcomponents.collaboratorworkspace.cd82ed35f6": "Private workspace for atelier collaborators to store development journeys, seam allowance secrets, and industrial tech packs. Share via encrypted one-time access tokens.",
  "ui.components.subcomponents.collaboratorworkspace.ce986f4b70": "Category",
  "ui.components.subcomponents.collaboratorworkspace.d21564e798": "e.g. Como Silk Weaving",
  "ui.components.subcomponents.collaboratorworkspace.d2db0c9de9": "Company Name",
  "ui.components.subcomponents.collaboratorworkspace.d303101fad": "Expires in 24 Hours",
  "ui.components.subcomponents.collaboratorworkspace.dbe46c9129": "Project Name",
  "ui.components.subcomponents.collaboratorworkspace.dc05a3123a": "Partner Mill",
  "ui.components.subcomponents.collaboratorworkspace.dd25c66fbf": "Classic Linen Perfect Fit Smock",
  "ui.components.subcomponents.collaboratorworkspace.ddaf1f7ba6": "Test Token Link Access",
  "ui.components.subcomponents.collaboratorworkspace.ddf6e7677f": "Beginner",
  "ui.components.subcomponents.collaboratorworkspace.e18e279afd": "Difficulty",
  "ui.components.subcomponents.collaboratorworkspace.e21ee5a25b": "Add textile Swatch",
  "ui.components.subcomponents.collaboratorworkspace.e60a96bf5a": "Add 5 yards",
  "ui.components.subcomponents.collaboratorworkspace.e778b602e2": "French Mill Supplier",
  "ui.components.subcomponents.collaboratorworkspace.e90e2308f7": "Auto-saves to your local collaborator vault.",
  "ui.components.subcomponents.collaboratorworkspace.ea25f44467": "Short Product Description",
  "ui.components.subcomponents.collaboratorworkspace.eaad4d04b6": "Total Workshop Progress",
  "ui.components.subcomponents.collaboratorworkspace.ef4fa976ea": "Submit a New Pattern Product",
  "ui.components.subcomponents.collaboratorworkspace.f0eea2958c": "e.g. orders@comosilk.it",
  "ui.components.subcomponents.collaboratorworkspace.f5b3b32113": "No product submissions yet.",
  "ui.components.subcomponents.collaboratorworkspace.f6565ea58b": "Audience",
  "ui.components.subcomponents.collaboratorworkspace.f88ec3c920": "This workshop automatically syncs with your digital mannequin and sizers.",
  "ui.components.subcomponents.collaboratorworkspace.f98a9ddaa6": "Custom Grading & Drafting Steps",
  "ui.components.subcomponents.collaboratorworkspace.f9b2d08641": "Minimalist Zero-Waste Skirt",
  "ui.components.subcomponents.collaboratorworkspace.f9d2706fbf": "Pattern / Product Name",
  "ui.components.subcomponents.collaboratorworkspace.fa1fd3f35b": "Garment Life Cycle",
  "ui.components.subcomponents.collaboratorworkspace.fa9e69b7ee": "Internal Technical Specs",
  "ui.components.subcomponents.collaboratorworkspace.feb8e07c37": "e.g. Aurelia Wrap Dress",
  "ui.components.subcomponents.dynamicgallery.00e571bd05": "⚙ Difficulty: Easy to Hard",
  "ui.components.subcomponents.dynamicgallery.07165bd0b9": "of",
  "ui.components.subcomponents.dynamicgallery.075b4bc011": "Garment Style / Category",
  "ui.components.subcomponents.dynamicgallery.0e69cd44b2": "No pattern blueprints found",
  "ui.components.subcomponents.dynamicgallery.runtime.loading": "Loading pattern catalogue…",
  "ui.components.subcomponents.dynamicgallery.runtime.error": "The pattern catalogue could not be loaded",
  "ui.components.subcomponents.dynamicgallery.runtime.errorHelp": "Check the repository connection and try again.",
  "ui.components.subcomponents.dynamicgallery.runtime.empty": "No patterns are available yet",
  "ui.components.subcomponents.dynamicgallery.runtime.emptyHelp": "Create or publish a pattern to make it available in the catalogue.",
  "ui.components.industrialtechpack.runtime.empty": "No industrial tech pack is available",
  "ui.components.industrialtechpack.runtime.emptyHelp": "Add manufacturing data to this product before opening its industrial pack.",
  "ui.components.testimonialcarousel.runtime.empty": "No community creations have been shared yet",
  "ui.components.testimonialcarousel.runtime.emptyHelp": "Be the first maker to add a finished project and review.",
  "ui.components.subcomponents.dynamicgallery.19abfef504": "Grainline Layout Matcher",
  "ui.components.subcomponents.dynamicgallery.1f851fadb8": "✦ Alphabetical",
  "ui.components.subcomponents.dynamicgallery.1fc1c3c512": "You are now registered for high-precision design updates. Use this welcome code at checkout to receive",
  "ui.components.subcomponents.dynamicgallery.2531eb968b": "Copy",
  "ui.components.subcomponents.dynamicgallery.2825e98573": "Atelier Craft Registry",
  "ui.components.subcomponents.dynamicgallery.2848f09453": "Filter by your saved wishlist",
  "ui.components.subcomponents.dynamicgallery.2b3e914635": "Curated Sewing Pattern Catalog",
  "ui.components.subcomponents.dynamicgallery.2b7f025861": "We couldn't find any designs matching your parameters. Adjust your search or clear filters to reset.",
  "ui.components.subcomponents.dynamicgallery.391708fad4": "tailor@atelier.com",
  "ui.components.subcomponents.dynamicgallery.4a0788d8ff": "Sort:",
  "ui.components.subcomponents.dynamicgallery.4e39138e51": "Fabric Requirements & Textiles",
  "ui.components.subcomponents.dynamicgallery.5bb2e96e49": "Return to Gallery",
  "ui.components.subcomponents.dynamicgallery.5c116e96b7": "beautiful designs",
  "ui.components.subcomponents.dynamicgallery.6116b818df": "Per Page:",
  "ui.components.subcomponents.dynamicgallery.6b150f63a1": "Based on your tailored measurements.",
  "ui.components.subcomponents.dynamicgallery.717cf3d3d0": "15% off",
  "ui.components.subcomponents.dynamicgallery.71e3aec2b6": "\"Slow-Fashion Guide: Pre-wash pure linen or cotton twill with lukewarm water to let fibers shrink before laying out pattern blocks.\"",
  "ui.components.subcomponents.dynamicgallery.74788ea294": "Since you've been active in our blueprint gallery, join our private list of makers. You'll receive instant alerts for fresh pattern releases, monthly slow-fashion assembly guides, and exclusive sizing studies.",
  "ui.components.subcomponents.dynamicgallery.75efcfe533": "Rating:",
  "ui.components.subcomponents.dynamicgallery.76a1c4ff28": "Print specs",
  "ui.components.subcomponents.dynamicgallery.77f48b68b9": "Expected Length:",
  "ui.components.subcomponents.dynamicgallery.7948dd9c95": "ATELIER BLUEPRINT NOTICES",
  "ui.components.subcomponents.dynamicgallery.7b10e1635d": "Modern View with Specs on Hover",
  "ui.components.subcomponents.dynamicgallery.7c3c97d2d8": "Next Page",
  "ui.components.subcomponents.dynamicgallery.7dbc925881": "Last Page",
  "ui.components.subcomponents.dynamicgallery.8081145bb8": "🪙 Price: Low to High",
  "ui.components.subcomponents.dynamicgallery.83ff1a51b3": "Difficulty Grading",
  "ui.components.subcomponents.dynamicgallery.8889b55aaa": "Fabric Bolt Width:",
  "ui.components.subcomponents.dynamicgallery.8bb9dd5b5a": "Subscribe",
  "ui.components.subcomponents.dynamicgallery.8c2e712270": "Fold line",
  "ui.components.subcomponents.dynamicgallery.8d282872b1": "Stay in the Pattern Loop",
  "ui.components.subcomponents.dynamicgallery.90fa23040e": "Close modal",
  "ui.components.subcomponents.dynamicgallery.93664d3698": "Selvage Edge",
  "ui.components.subcomponents.dynamicgallery.93f01492e6": "Perfect Fit Sizing & Yardage Estimator",
  "ui.components.subcomponents.dynamicgallery.979cc3a7cb": "Tailoring Difficulty Level",
  "ui.components.subcomponents.dynamicgallery.9a970bfc67": "★ Active Atelier Tip",
  "ui.components.subcomponents.dynamicgallery.9b4b669b78": "Classic",
  "ui.components.subcomponents.dynamicgallery.9caebcd0ca": "Wishlist:",
  "ui.components.subcomponents.dynamicgallery.9de082caef": "✨ Newest Releases",
  "ui.components.subcomponents.dynamicgallery.a09dd61172": "Welcome to the Slow-Fashion Circle",
  "ui.components.subcomponents.dynamicgallery.a6c5d7fea8": "⚙ Difficulty: Hard to Easy",
  "ui.components.subcomponents.dynamicgallery.aa0bff52d2": "Bolt Fold:",
  "ui.components.subcomponents.dynamicgallery.aaab530880": "This interactive diagram represents the placement of template pieces on a single fabric fold. Toggle width or customize sizing to preview nesting density.",
  "ui.components.subcomponents.dynamicgallery.aca1f532fd": "Download PDF Pattern",
  "ui.components.subcomponents.dynamicgallery.ae20f3d939": "Modern",
  "ui.components.subcomponents.dynamicgallery.b05f502abf": "Classic View",
  "ui.components.subcomponents.dynamicgallery.b27fa98707": "🪙 Price: High to Low",
  "ui.components.subcomponents.dynamicgallery.b68076579a": "Atelier Preparation Checklist",
  "ui.components.subcomponents.dynamicgallery.b7a4d45de4": "60\" Fashion Width",
  "ui.components.subcomponents.dynamicgallery.b9c11967fe": "Welcome Promo Code",
  "ui.components.subcomponents.dynamicgallery.ba6718d8e4": "Couture Tutorials",
  "ui.components.subcomponents.dynamicgallery.bba8a4f110": "Select Your Atelier Interests:",
  "ui.components.subcomponents.dynamicgallery.bfbd058947": "Cut 2",
  "ui.components.subcomponents.dynamicgallery.c057fd76d7": "your next structural blueprint package:",
  "ui.components.subcomponents.dynamicgallery.c48918c42e": "Previous Page",
  "ui.components.subcomponents.dynamicgallery.cd79376659": "Search designs or fabrics...",
  "ui.components.subcomponents.dynamicgallery.ddbbabb3bf": "★ Highest Rating",
  "ui.components.subcomponents.dynamicgallery.dfa34619b6": "⏱ Crafting Hours",
  "ui.components.subcomponents.dynamicgallery.ece49c40d0": "Showing",
  "ui.components.subcomponents.dynamicgallery.edd650a7f2": "First Page",
  "ui.components.subcomponents.dynamicgallery.efaaaca85a": "Reset All Filters",
  "ui.components.subcomponents.dynamicgallery.f0b1c3496c": "Required Yardage",
  "ui.components.subcomponents.dynamicgallery.f1e466628c": "Price Range Selection",
  "ui.components.subcomponents.dynamicgallery.f2c0e2ed66": "Zero spam. Only hand-drafted pattern releases and atelier tailoring guides.",
  "ui.components.subcomponents.dynamicgallery.f443521167": "Reset Filters",
  "ui.components.subcomponents.dynamicgallery.f6eb3f5479": "45\" Narrow Width",
  "ui.components.subcomponents.dynamicgallery.f75e6373ac": "New Releases",
  "ui.components.subcomponents.dynamicgallery.fdda8ff3f7": "SUBSCRIPTION VERIFIED",
  "ui.components.subcomponents.dynamicgallery.ff5b50ce57": "A responsive grid of digital garment blueprints. Hover to reveal bespoke sewing specs, difficulty grades, and fabric metrics. Click any blueprint to generate layout yardages and drafting guidelines.",
  "ui.components.subcomponents.dynamicgallery.ffa93a5d6a": "Print Specs",
  "ui.components.subcomponents.dynamicinventory.03465776e0": "Premium Lining",
  "ui.components.subcomponents.dynamicinventory.0bc0f2d6d2": "e.g. Organic Hemp Crepe",
  "ui.components.subcomponents.dynamicinventory.18c59db137": "e.g. Sage Green",
  "ui.components.subcomponents.dynamicinventory.19b2e0eced": "Download comprehensive PDF inventory report",
  "ui.components.subcomponents.dynamicinventory.22ae3047b3": "Total Materials",
  "ui.components.subcomponents.dynamicinventory.2a53600ba1": "Fabric Roll",
  "ui.components.subcomponents.dynamicinventory.2e81179eb7": "Add 5 yards",
  "ui.components.subcomponents.dynamicinventory.375f8a3e83": "Est. Cost",
  "ui.components.subcomponents.dynamicinventory.37f1c9a567": "Add Textile Roll",
  "ui.components.subcomponents.dynamicinventory.40ed8e7149": "Total Yardage",
  "ui.components.subcomponents.dynamicinventory.41781e0810": "Inventory Actions",
  "ui.components.subcomponents.dynamicinventory.443caab042": "Receiving Dock",
  "ui.components.subcomponents.dynamicinventory.45bf02b531": "Export PDF Report",
  "ui.components.subcomponents.dynamicinventory.662b8fad5a": "Material Details",
  "ui.components.subcomponents.dynamicinventory.73647a6e62": "Status",
  "ui.components.subcomponents.dynamicinventory.74d4f2db84": "Stock Level",
  "ui.components.subcomponents.dynamicinventory.76f60aa3e1": "Type & Spec",
  "ui.components.subcomponents.dynamicinventory.81da886bc8": "Low Stock Warn",
  "ui.components.subcomponents.dynamicinventory.8acf2794aa": "Subtract 5 yards",
  "ui.components.subcomponents.dynamicinventory.8f5fe4921b": "Material Name",
  "ui.components.subcomponents.dynamicinventory.9187d459c6": "Comma-separated",
  "ui.components.subcomponents.dynamicinventory.9c13cbd0e2": "Lace & Trim",
  "ui.components.subcomponents.dynamicinventory.aaec80c4f6": "Textile Stock Ledger",
  "ui.components.subcomponents.dynamicinventory.cb17e3f292": "Fabric Tags",
  "ui.components.subcomponents.dynamicinventory.cb9e54d525": "Swatch / Color",
  "ui.components.subcomponents.dynamicinventory.d04da94364": "ERP Synced",
  "ui.components.subcomponents.dynamicinventory.d0e60bbeee": "Heavy Wool Crepe",
  "ui.components.subcomponents.dynamicinventory.eb51d8517c": "e.g. Organic, Linen, Sustainable",
  "ui.components.subcomponents.dynamicinventory.edf726cea9": "Textile Category",
  "ui.components.subcomponents.dynamicinventory.efa1865975": "Receive Shipment",
  "ui.components.subcomponents.dynamicinventory.f7687344d2": "Remove textile roll",
  "ui.components.subcomponents.dynamicprojectmanager.102432bfa2": "e.g. Silk Autumn Dress",
  "ui.components.subcomponents.dynamicprojectmanager.15b47fa81d": "The French Draped Trench",
  "ui.components.subcomponents.dynamicprojectmanager.2313147239": "Active Projects",
  "ui.components.subcomponents.dynamicprojectmanager.33e5978d93": "Custom Grading & Drafting Steps",
  "ui.components.subcomponents.dynamicprojectmanager.3969605480": "Atelier Workspace",
  "ui.components.subcomponents.dynamicprojectmanager.402ee1b803": "Classic Linen Perfect Fit Smock",
  "ui.components.subcomponents.dynamicprojectmanager.41c5b15e49": "Target Pattern",
  "ui.components.subcomponents.dynamicprojectmanager.5ea5e41e44": "Archive project",
  "ui.components.subcomponents.dynamicprojectmanager.7323fe9776": "Perfect Fit Hourglass Blazer",
  "ui.components.subcomponents.dynamicprojectmanager.7b63111e1e": "Create Workspace",
  "ui.components.subcomponents.dynamicprojectmanager.a159ae7ad6": "Tailoring measurements automatically integrate with the online Mannequin calibrator.",
  "ui.components.subcomponents.dynamicprojectmanager.bc59e87bea": "Minimalist Zero-Waste Skirt",
  "ui.components.subcomponents.dynamicprojectmanager.c2342cee7f": "Pattern Template Ref:",
  "ui.components.subcomponents.dynamicprojectmanager.c23c026870": "✦ Start Bespoke Design ✦",
  "ui.components.subcomponents.dynamicprojectmanager.cc2b5895b8": "Total Workshop Progress",
  "ui.components.subcomponents.dynamicprojectmanager.db649d6ee4": "No projects available. Start a bespoke design to manage your workspace.",
  "ui.components.subcomponents.dynamicprojectmanager.e1fac87668": "Project Name",
  "ui.components.subcomponents.onboardingwalkthrough.75e17d4218": "Guide Assistant",
  "ui.components.subcomponents.onboardingwalkthrough.afe8693805": "End walkthrough",
  "ui.components.subcomponents.onboardingwalkthrough.c77ae1ddbb": "Back",
  "ui.components.subcomponents.permissionsoverview.0e70619934": "Atelier Permissions & Access Overview",
  "ui.components.subcomponents.permissionsoverview.1067a8d715": "Last policy seed audit signed on:",
  "ui.components.subcomponents.permissionsoverview.1811fe8f1b": "Security Standard JSON Definition",
  "ui.components.subcomponents.permissionsoverview.1a126bf024": "Search components or keys...",
  "ui.components.subcomponents.permissionsoverview.20c1b24c2e": "perfectFitMetadata.js",
  "ui.components.subcomponents.permissionsoverview.2601024089": "This gate rule has been altered in the live workspace",
  "ui.components.subcomponents.permissionsoverview.377da2897b": "Configured Roles",
  "ui.components.subcomponents.permissionsoverview.4626077ccd": "Workspace Component Block",
  "ui.components.subcomponents.permissionsoverview.542f3825e3": "Dynamic Security Protocol Engine",
  "ui.components.subcomponents.permissionsoverview.5811831495": "No modules allowed for this credential tier.",
  "ui.components.subcomponents.permissionsoverview.671d8615c2": "Audit high-contrast functional access gates dynamically matched to role credentials. Real-time local overrides are highlighted in amber when altered by the control panel.",
  "ui.components.subcomponents.permissionsoverview.683fbe2168": "Try clearing the search string or disabling the override filter to view cataloged system permissions.",
  "ui.components.subcomponents.permissionsoverview.6bbc0a01a0": "Legend:",
  "ui.components.subcomponents.permissionsoverview.752f3f141f": "Active Overrides",
  "ui.components.subcomponents.permissionsoverview.87beb5525d": "No workspace elements match filters",
  "ui.components.subcomponents.permissionsoverview.8c258b2486": "Matrix Table",
  "ui.components.subcomponents.permissionsoverview.a1a83c298c": "Show Overrides Only",
  "ui.components.subcomponents.permissionsoverview.a7a684be73": "Standard permissions defined in",
  "ui.components.subcomponents.permissionsoverview.bbb6ff9d11": "Security Standard",
  "ui.components.subcomponents.permissionsoverview.bbcb7a240d": "Interactive Units",
  "ui.components.subcomponents.permissionsoverview.c0cf8c9e66": "The JSON structure is evaluated by the DynamicLayout gate compilation algorithm. Administrators can audit version control headers and hard-coded fallbacks directly in the compiled asset file.",
  "ui.components.subcomponents.permissionsoverview.c69267cad2": "ISO-27001 Secure",
  "ui.components.subcomponents.permissionsoverview.d89bbcd04f": "Active Policy matched to standard build",
  "ui.components.subcomponents.permissionsoverview.f1c2717fd9": "Config JSON",
  "ui.components.subcomponents.permissionsoverview.f587bb6ce8": "Role Cards",
  "ui.components.subcomponents.productdevelopmentmediagallery.009fd1c842": "Cancel",
  "ui.components.subcomponents.productdevelopmentmediagallery.01dcc61ac5": "Delete photo",
  "ui.components.subcomponents.productdevelopmentmediagallery.0e7f4497b8": "e.g. White Sand / Oatmeal",
  "ui.components.subcomponents.productdevelopmentmediagallery.0ed1652934": "Textile Mill / Supplier",
  "ui.components.subcomponents.productdevelopmentmediagallery.104ba6550e": "PANTONE® TCX Specification",
  "ui.components.subcomponents.productdevelopmentmediagallery.12008c4fa0": "e.g., Relaxation pre-wash required, use Microtex 60/8 needle...",
  "ui.components.subcomponents.productdevelopmentmediagallery.13f5b279a5": "HD Inspect",
  "ui.components.subcomponents.productdevelopmentmediagallery.1828abc01a": "👁️ Visible",
  "ui.components.subcomponents.productdevelopmentmediagallery.19d8d48bcd": "Roll Stock Availability",
  "ui.components.subcomponents.productdevelopmentmediagallery.2384993397": "3x HD Macro Lens",
  "ui.components.subcomponents.productdevelopmentmediagallery.255d7b23bb": "Customer Visibility Toggle",
  "ui.components.subcomponents.productdevelopmentmediagallery.2e644ba376": "e.g., Solbiati Linen Mill, Italy",
  "ui.components.subcomponents.productdevelopmentmediagallery.3018e0b368": "PANTONE®",
  "ui.components.subcomponents.productdevelopmentmediagallery.30f8566dbd": "Secret Status",
  "ui.components.subcomponents.productdevelopmentmediagallery.32e9d18fa3": "HD Magnifying Glass",
  "ui.components.subcomponents.productdevelopmentmediagallery.359170e57c": "Colorway Name",
  "ui.components.subcomponents.productdevelopmentmediagallery.48e61c37ac": "Paste image URL or click a preset below...",
  "ui.components.subcomponents.productdevelopmentmediagallery.4d162ad668": "Title / Drawing Label *",
  "ui.components.subcomponents.productdevelopmentmediagallery.4eb4cb37af": "Roll Stock Meters in Inventory",
  "ui.components.subcomponents.productdevelopmentmediagallery.504688d0a7": "Click to slide",
  "ui.components.subcomponents.productdevelopmentmediagallery.506649162f": "Save Custom Swatch",
  "ui.components.subcomponents.productdevelopmentmediagallery.50fdb5a49b": "HD Zoom",
  "ui.components.subcomponents.productdevelopmentmediagallery.51f37defce": "Previous Photo",
  "ui.components.subcomponents.productdevelopmentmediagallery.632d323c4e": "Atelier Notes:",
  "ui.components.subcomponents.productdevelopmentmediagallery.636cd07d18": "Secret",
  "ui.components.subcomponents.productdevelopmentmediagallery.6c68a18342": "tool!",
  "ui.components.subcomponents.productdevelopmentmediagallery.719dd178f2": "Official TCX Swatch Spec",
  "ui.components.subcomponents.productdevelopmentmediagallery.74652745d8": "👁️",
  "ui.components.subcomponents.productdevelopmentmediagallery.74da45852a": "Technical Notes / Description:",
  "ui.components.subcomponents.productdevelopmentmediagallery.785e6d0770": "PANTONE® Color Name",
  "ui.components.subcomponents.productdevelopmentmediagallery.7e123ccb1e": "Verify Spec on Pantone.com",
  "ui.components.subcomponents.productdevelopmentmediagallery.7eeeb8d816": "Photo URL",
  "ui.components.subcomponents.productdevelopmentmediagallery.7f0159c9c4": "Pattern ID:",
  "ui.components.subcomponents.productdevelopmentmediagallery.87a22cca91": "Fabric Swatches in Library",
  "ui.components.subcomponents.productdevelopmentmediagallery.88f6e5e699": "Sample Textures:",
  "ui.components.subcomponents.productdevelopmentmediagallery.892da78cd6": "e.g. Heavyweight Organic Linen 300gsm, Silk Crepe de Chine",
  "ui.components.subcomponents.productdevelopmentmediagallery.906d2d62eb": "Hover cursor to magnify fiber slub",
  "ui.components.subcomponents.productdevelopmentmediagallery.932b819cd3": "switch to decide which images are published to the customer Quick View summary.",
  "ui.components.subcomponents.productdevelopmentmediagallery.95d17bdcae": "Media Category",
  "ui.components.subcomponents.productdevelopmentmediagallery.97188c0981": "Fiber Composition",
  "ui.components.subcomponents.productdevelopmentmediagallery.9f9826c838": "Technical Description Notes",
  "ui.components.subcomponents.productdevelopmentmediagallery.a124217a86": "Total Roll Stock Inventory",
  "ui.components.subcomponents.productdevelopmentmediagallery.a1a650af6f": "Use the slider controls below to review sample photos, technical CAD flats, and pattern draft markers. Toggle the",
  "ui.components.subcomponents.productdevelopmentmediagallery.b00afe8d78": "Next Photo",
  "ui.components.subcomponents.productdevelopmentmediagallery.b20e59cc80": "Delete swatch",
  "ui.components.subcomponents.productdevelopmentmediagallery.b29399ede9": "e.g. White Sand",
  "ui.components.subcomponents.productdevelopmentmediagallery.b2ae8fe19f": "Workspace Internal Only",
  "ui.components.subcomponents.productdevelopmentmediagallery.b44c766bf9": "Fabric Swatch Title *",
  "ui.components.subcomponents.productdevelopmentmediagallery.b8c7d452ea": "e.g., 100% Belgian Flax, Plain Weave",
  "ui.components.subcomponents.productdevelopmentmediagallery.b90fd1279b": "🔒",
  "ui.components.subcomponents.productdevelopmentmediagallery.baea23933a": "Create a new fabric entry with weave texture photo, stock length, and PANTONE® color code.",
  "ui.components.subcomponents.productdevelopmentmediagallery.c0478aab71": "Make Picture Visible in Quick View",
  "ui.components.subcomponents.productdevelopmentmediagallery.c0943cd1b2": "PANTONE® TCX Code",
  "ui.components.subcomponents.productdevelopmentmediagallery.c55ab78f00": "Color Hex Code",
  "ui.components.subcomponents.productdevelopmentmediagallery.c638a85519": "Total Media Assets",
  "ui.components.subcomponents.productdevelopmentmediagallery.c86bb27909": "e.g., Grainline direction, seam allowance...",
  "ui.components.subcomponents.productdevelopmentmediagallery.cab187607f": "PANTONE® Color Standard",
  "ui.components.subcomponents.productdevelopmentmediagallery.d0c67458f9": "Add Custom Fabric Swatch to Library",
  "ui.components.subcomponents.productdevelopmentmediagallery.d1d51fb4db": "🔒 Secret",
  "ui.components.subcomponents.productdevelopmentmediagallery.d8a9ef7742": "Selected Asset Specification",
  "ui.components.subcomponents.productdevelopmentmediagallery.ddb5131b8d": "Enlarge Zoom",
  "ui.components.subcomponents.productdevelopmentmediagallery.decdd07c14": "Add Photo or Technical CAD Sketch",
  "ui.components.subcomponents.productdevelopmentmediagallery.e038d5db48": "Standard TCX Reference",
  "ui.components.subcomponents.productdevelopmentmediagallery.ed5726bcb3": "e.g. 13-0002-TCX",
  "ui.components.subcomponents.productdevelopmentmediagallery.ef8088ae3e": "Add Photo to Slider",
  "ui.components.subcomponents.productdevelopmentmediagallery.efb8ec41d4": "Fabric Texture Image URL or Texture Presets",
  "ui.components.subcomponents.productdevelopmentmediagallery.f130f4b622": "Browse, inspect, or add custom fabric swatches for this pattern design. Hover over any swatch photo to inspect the weave slub texture up close with the",
  "ui.components.subcomponents.productdevelopmentmediagallery.f77029112f": "Published in Quick View Modal",
  "ui.components.subcomponents.professionaldashboard.0c1ef6b9de": "Stash Value",
  "ui.components.subcomponents.professionaldashboard.0fbf2bf81e": "Professional Partner Insights",
  "ui.components.subcomponents.professionaldashboard.10f8e77b14": "e.g. Aurelia Wrap Dress",
  "ui.components.subcomponents.professionaldashboard.1669f87a72": "Access Applications",
  "ui.components.subcomponents.professionaldashboard.168c07d96b": "Deny",
  "ui.components.subcomponents.professionaldashboard.16f6381293": "Approve",
  "ui.components.subcomponents.professionaldashboard.18deb2b242": "e.g. Construct Waist Belt",
  "ui.components.subcomponents.professionaldashboard.1ded64dae4": "Requested Role",
  "ui.components.subcomponents.professionaldashboard.1ff1154fd7": "Labor Intensity Curve",
  "ui.components.subcomponents.professionaldashboard.2040a1dab1": "Project Operations",
  "ui.components.subcomponents.professionaldashboard.21223981a9": "Capital Ledger",
  "ui.components.subcomponents.professionaldashboard.21d1600446": "Commissions",
  "ui.components.subcomponents.professionaldashboard.234ff1884a": "Real-time telemetry aggregator for active commissions, materials capital expenditure, and tailoring productivity metrics.",
  "ui.components.subcomponents.professionaldashboard.27219f63dc": "Registered History Blocks",
  "ui.components.subcomponents.professionaldashboard.288c9b092c": "View administrative roles and component permissions matrix",
  "ui.components.subcomponents.professionaldashboard.2f946e212e": "Active Commissions Progress",
  "ui.components.subcomponents.professionaldashboard.44e6a47a0a": "Approve or deny visitor credential upgrade petitions",
  "ui.components.subcomponents.professionaldashboard.4838a762bb": "Add 2 yards",
  "ui.components.subcomponents.professionaldashboard.487e0805fe": "Register Log",
  "ui.components.subcomponents.professionaldashboard.4b5138866d": "Chronological labor logs",
  "ui.components.subcomponents.professionaldashboard.4d55fad6ca": "Subtract 2 yards",
  "ui.components.subcomponents.professionaldashboard.4d85893bf6": "Security Log",
  "ui.components.subcomponents.professionaldashboard.4fb5cb0e38": "Total Materials On Dock",
  "ui.components.subcomponents.professionaldashboard.540e18940a": "-2 Yd",
  "ui.components.subcomponents.professionaldashboard.57df5eb6c1": "Log Sewing Session",
  "ui.components.subcomponents.professionaldashboard.59a69f512e": "Enter custom observations, material stiffness, or seam grading anomalies...",
  "ui.components.subcomponents.professionaldashboard.667e82fd8e": "All",
  "ui.components.subcomponents.professionaldashboard.67e464e4fc": "Latest Active Session",
  "ui.components.subcomponents.professionaldashboard.6a0a19e1ef": "+2 Yd",
  "ui.components.subcomponents.professionaldashboard.6ce60f4dca": "Progress",
  "ui.components.subcomponents.professionaldashboard.6d44e92f79": "Commission Project Name",
  "ui.components.subcomponents.professionaldashboard.6dfb36f11e": "Avg Commission Progress",
  "ui.components.subcomponents.professionaldashboard.6e1b549b31": "Click steps to check them off directly. Progress percentage recalibrates automatically.",
  "ui.components.subcomponents.professionaldashboard.70c38538eb": "Stock",
  "ui.components.subcomponents.professionaldashboard.71844e8bd7": "Delete log",
  "ui.components.subcomponents.professionaldashboard.7abd2b1e49": "Active",
  "ui.components.subcomponents.professionaldashboard.801e9eab86": "Register a tailored session to keep production and efficiency spreadsheets updated.",
  "ui.components.subcomponents.professionaldashboard.80a0e85cb5": "Textile Capital Allocation",
  "ui.components.subcomponents.professionaldashboard.8293f3d2bc": "Avg Session",
  "ui.components.subcomponents.professionaldashboard.8dbbea4930": "Total Hours",
  "ui.components.subcomponents.professionaldashboard.900d2b0c29": "Earliest Session",
  "ui.components.subcomponents.professionaldashboard.91c4ee2703": "Done",
  "ui.components.subcomponents.professionaldashboard.9e4c70443a": "Partner Labor Adjustment",
  "ui.components.subcomponents.professionaldashboard.9ff49cb628": "Expenditure",
  "ui.components.subcomponents.professionaldashboard.a24d54a871": "Permissions Guide",
  "ui.components.subcomponents.professionaldashboard.a2b9e7fc28": "Operation / Step Name",
  "ui.components.subcomponents.professionaldashboard.a6d8ff4ec0": "Click on any project to load task audit checklists",
  "ui.components.subcomponents.professionaldashboard.a722737761": "Live inventory price specs & yardage adjusters",
  "ui.components.subcomponents.professionaldashboard.a99c15aa8c": "Productivity Tracked",
  "ui.components.subcomponents.professionaldashboard.a9fcb93c1c": "Cancel",
  "ui.components.subcomponents.professionaldashboard.aab12a0a8e": "Filter materials...",
  "ui.components.subcomponents.professionaldashboard.af105afcb5": "Low Warning",
  "ui.components.subcomponents.professionaldashboard.afddbfb7a3": "Secure Operations Console",
  "ui.components.subcomponents.professionaldashboard.b2f1c6c439": "Capital Value",
  "ui.components.subcomponents.professionaldashboard.b975501ac7": "Workshop Session Logs",
  "ui.components.subcomponents.professionaldashboard.c195778dac": "Completed",
  "ui.components.subcomponents.professionaldashboard.c441cd8250": "Daily Sessions",
  "ui.components.subcomponents.professionaldashboard.c7fcb55dd0": "Session Notes",
  "ui.components.subcomponents.professionaldashboard.cb79cf002d": "No custom access upgrade requests filed.",
  "ui.components.subcomponents.professionaldashboard.d892fb44c7": "Labor Session Time",
  "ui.components.subcomponents.professionaldashboard.e2b143856d": "Productivity",
  "ui.components.subcomponents.professionaldashboard.f63327a2ae": "No commissions currently registered.",
  "ui.components.subcomponents.professionaldashboard.f953be43e7": "No tailoring logs saved in workspace ledger.",
  "ui.components.subcomponents.professionaldashboard.ff3df72e75": "Log Manual Sewing Session",
  "ui.components.subcomponents.timeandmotionstudy.4ec0bebd02": "Reset timer",
  "ui.components.subcomponents.workspaceanalyticspanel.00a69f7a82": "DynamicLayout Auditing Telemetry",
  "ui.components.subcomponents.workspaceanalyticspanel.075d317898": "Tracks interface adjustments, credentials hopping, and unauthorized component rendering attempts to capture workflow dynamics.",
  "ui.components.subcomponents.workspaceanalyticspanel.0cd090195f": "Relative switch frequency metrics",
  "ui.components.subcomponents.workspaceanalyticspanel.1b956dfe62": "Most Active Persona",
  "ui.components.subcomponents.workspaceanalyticspanel.2d40bd10ff": "No telemetry events match active search queries or filters.",
  "ui.components.subcomponents.workspaceanalyticspanel.3653f01924": "No actions registered yet. Try changing filters or switching simulated personas!",
  "ui.components.subcomponents.workspaceanalyticspanel.3804e3796a": "Purge Logs",
  "ui.components.subcomponents.workspaceanalyticspanel.3c78a50193": "Search raw payload or role...",
  "ui.components.subcomponents.workspaceanalyticspanel.3cf93ad41b": "ISO-27001 Atelier Log Integrity: Active",
  "ui.components.subcomponents.workspaceanalyticspanel.432113412f": ". Requires:",
  "ui.components.subcomponents.workspaceanalyticspanel.5a4ca0785c": "Purge all logged interactions",
  "ui.components.subcomponents.workspaceanalyticspanel.612c4ce723": "Distribution across different tracked operations",
  "ui.components.subcomponents.workspaceanalyticspanel.7263f4f499": "Total Logs Captured",
  "ui.components.subcomponents.workspaceanalyticspanel.72b335db0b": "Simulated Persona Usage",
  "ui.components.subcomponents.workspaceanalyticspanel.73a711bed7": "Opened layout documentation guidelines for current role",
  "ui.components.subcomponents.workspaceanalyticspanel.87c542f644": "Security Denials",
  "ui.components.subcomponents.workspaceanalyticspanel.8e4e3b0758": "as",
  "ui.components.subcomponents.workspaceanalyticspanel.9268810272": "lock state updated for role",
  "ui.components.subcomponents.workspaceanalyticspanel.9ed0ff1229": "Events",
  "ui.components.subcomponents.workspaceanalyticspanel.a6ad4064a0": "Sync",
  "ui.components.subcomponents.workspaceanalyticspanel.aa833a6d6d": "Simulation sandbox persona changed to:",
  "ui.components.subcomponents.workspaceanalyticspanel.ac242b69c9": "Gated Hits",
  "ui.components.subcomponents.workspaceanalyticspanel.b846ea40b2": "Rejected view block",
  "ui.components.subcomponents.workspaceanalyticspanel.c2da1ae4b1": "Gated component",
  "ui.components.subcomponents.workspaceanalyticspanel.cc8b26b5d9": "Security & Interaction Analytics Ledger",
  "ui.components.subcomponents.workspaceanalyticspanel.d8b25aa892": "Refresh logs from local cache",
  "ui.components.subcomponents.workspaceanalyticspanel.de147e0a8e": "Workspace Action Breakdown",
  "ui.components.subcomponents.workspaceanalyticspanel.df19862a85": "Secure Telemetry Sandbox Session",
  "ui.components.subcomponents.workspaceanalyticspanel.f613ec52fc": "Rendered workspace block",
  "ui.components.subcomponents.workspaceanalyticspanel.f71f98dab8": "Toggles",
  "ui.components.subcomponents.workspaceanalyticspanel.fda5663ef8": "Gate Configurations",
  "ui.components.subcomponents.workspaceanalyticspanel.fe3d5d89dd": "Operations engine controller expanded state altered to:",
  "ui.components.testimonialcarousel.039c0a21f3": "Sewing Pattern *",
  "ui.components.testimonialcarousel.065e8e4bb2": "Palazzo Wide-Leg Trouser",
  "ui.components.testimonialcarousel.0c0a72279e": "Inspire other sewists around the globe. Share your completed projects, styling tips, and sizing advice.",
  "ui.components.testimonialcarousel.1288e8a273": "Share Your Masterpiece",
  "ui.components.testimonialcarousel.1875c86709": "Detailed Review & Fitting Advice *",
  "ui.components.testimonialcarousel.22d6e2c64b": "Overall Experience",
  "ui.components.testimonialcarousel.240c17102a": "Luminary Asymmetric Drape Blouse",
  "ui.components.testimonialcarousel.2516bd1ba1": "Submit Project",
  "ui.components.testimonialcarousel.2ccb53db42": "Back to Carousel",
  "ui.components.testimonialcarousel.35c33a09ac": "Atelier Utility Trench",
  "ui.components.testimonialcarousel.373c4371ba": "Thank You for Sharing!",
  "ui.components.testimonialcarousel.50cb35bb8f": "e.g. @AliceSews or Alice M.",
  "ui.components.testimonialcarousel.569b341add": "e.g. Aurelia wrap midi styled for beach weddings",
  "ui.components.testimonialcarousel.585df8ff11": "Describe how the assembly went. Any sizing adjustments made? How was the instruction manual?",
  "ui.components.testimonialcarousel.6339681ae4": "Cancel",
  "ui.components.testimonialcarousel.63af2f3f96": "e.g. Soft Oatmeal Linen",
  "ui.components.testimonialcarousel.6578a13c91": "Aurelia Wrap Dress",
  "ui.components.testimonialcarousel.6f02819301": "Fabric Material *",
  "ui.components.testimonialcarousel.711a318e8f": "Previous Testimonial",
  "ui.components.testimonialcarousel.7c165e3bb5": "Your finished pattern creation has been registered and added to our live social proof carousel slides!",
  "ui.components.testimonialcarousel.8e35ab2b98": "Size:",
  "ui.components.testimonialcarousel.a1bfcba61c": "e.g. 8",
  "ui.components.testimonialcarousel.ab97201ce7": "Finished Project Photo URL",
  "ui.components.testimonialcarousel.d30e2d3349": "Your Name or Instagram Handle *",
  "ui.components.testimonialcarousel.d35e35dfeb": "Size Crafted",
  "ui.components.testimonialcarousel.e510554256": "Fabric:",
  "ui.components.testimonialcarousel.e5a3709fcc": "Verified Maker",
  "ui.components.testimonialcarousel.f3fe6e3fce": "Next Testimonial",
  "ui.components.testimonialcarousel.f70e34bc9f": "Short Photo Caption",
  "ui.components.trackordermodal.02bb83a189": "Order Tracking Desk",
  "ui.components.trackordermodal.0666ba3728": "Ref:",
  "ui.components.trackordermodal.06b5b730f2": "Close Tracking Panel",
  "ui.components.trackordermodal.07db640f2f": "Instant Digital Blueprints Unlocked",
  "ui.components.trackordermodal.10d3dcc6d3": "Session Total:",
  "ui.components.trackordermodal.163af606b3": "Checkout Total",
  "ui.components.trackordermodal.1a9287496e": "Physical tissue blueprint parcels are plotted on-demand and handed over to DHL/FedEx within 24 hours of your verified request.",
  "ui.components.trackordermodal.1c4ce78997": "Securely processed through Atelier payment ledger.",
  "ui.components.trackordermodal.20071f32f2": "Order Reference Not Found",
  "ui.components.trackordermodal.25bda2f67a": "Delivery Estimate",
  "ui.components.trackordermodal.31a24b4235": "Digital Package Deliveries",
  "ui.components.trackordermodal.393d9472a2": "Go To Downloads Desk",
  "ui.components.trackordermodal.3d20a56ffa": "Tracking Logs",
  "ui.components.trackordermodal.4243d230ab": "Enter Order Reference Code:",
  "ui.components.trackordermodal.431e375180": "Shipping Status",
  "ui.components.trackordermodal.4cd81ee924": "Close Desk",
  "ui.components.trackordermodal.4ffb60e2d4": "Shipping Location",
  "ui.components.trackordermodal.50f80d2b68": "Blueprints Included in Order",
  "ui.components.trackordermodal.85d355d514": "Atelier Eco Express",
  "ui.components.trackordermodal.8b9e9efd98": "Example Codes:",
  "ui.components.trackordermodal.8dd742f381": "Track",
  "ui.components.trackordermodal.95d409a9f8": "Carrier:",
  "ui.components.trackordermodal.960cd6b150": "Courier Parcel Status",
  "ui.components.trackordermodal.d0ac94bd6f": "\" in your local active storage cabinet. Ensure spelling is correct, or try one of the example orders listed above.",
  "ui.components.trackordermodal.db88cf8008": "We couldn't locate any completed transaction under the ID \"",
  "ui.components.trackordermodal.ee477362d5": "Crafting slow-fashion with sustainable precision.",
  "ui.components.trackordermodal.f3eab6d387": "Search SRT-882041, SRT-409124...",
  "ui.components.wishlistdrawer.012c770f96": "Quick View Specs",
  "ui.components.wishlistdrawer.181e49f65b": "Actions",
  "ui.components.wishlistdrawer.1842a62b6a": "Remove from wishlist",
  "ui.components.wishlistdrawer.40a87c07f4": "Wander through our curated drafting cabinets and save your favorite pattern blueprints using the heart icons.",
  "ui.components.wishlistdrawer.42e11a9661": "Saved Blueprint References",
  "ui.components.wishlistdrawer.5ad1114ff7": "Your Wishlist is Empty",
  "ui.components.wishlistdrawer.621feca563": "Close Wishlist",
  "ui.components.wishlistdrawer.797f67145a": "Blueprint Spec",
  "ui.components.wishlistdrawer.8cfa1c2f4a": "Browse Catalog Cabinet",
  "ui.components.wishlistdrawer.99c398d95a": "Add to styling ledger",
  "ui.components.wishlistdrawer.a3153bc6cf": "Difficulty:",
  "ui.components.wishlistdrawer.b971b38fd8": "Total Saved Blueprints:",
  "ui.components.wishlistdrawer.f4a7e22341": "Continue Catalog Exploration",
  "ui.components.wishlistdrawer.f8f11e0d6e": "My Archive Wishlist",
  "ui.components.workspace.00369d6211": "Comma-separated. These sizes drive coverage checks below.",
  "ui.components.workspace.0050be9e51": "Technical type / format",
  "ui.components.workspace.02deaeb7c0": "No formal revisions recorded yet.",
  "ui.components.workspace.052d457e9e": "Target ease",
  "ui.components.workspace.053f9140de": "Measurements attach to canonical garment sizes. Changing the display system changes the column labels, not the measurement storage.",
  "ui.components.workspace.057ababd5e": "Apply to new revision",
  "ui.components.workspace.08606d976f": "Unit",
  "ui.components.workspace.0ae1e2e938": "Delete pattern file",
  "ui.components.workspace.0cf59a47cc": "No pending fit-session proposals.",
  "ui.components.workspace.0d4e5ceb97": "Critical body areas act as hard-fit gates downstream. Designer changes create a new Measurement Chart revision instead of silently changing the baseline.",
  "ui.components.workspace.0f31364f74": "Display sizing system",
  "ui.components.workspace.0f8423a29f": "Share workspace",
  "ui.components.workspace.0fba024bbf": "Archived prototype file area",
  "ui.components.workspace.1413ee80ae": "Close construction editor",
  "ui.components.workspace.16b69c9287": "No projects yet. Use the + button to create your first Project.",
  "ui.components.workspace.18f47dc285": "Finished garment measurements",
  "ui.components.workspace.1905d49b93": "Select a pattern file to inspect metadata.",
  "ui.components.workspace.19babac774": "Selected File",
  "ui.components.workspace.1c5c4bda7d": "Supporting",
  "ui.components.workspace.2058574bcf": "Close more modules",
  "ui.components.workspace.206d2d40a0": "Pending",
  "ui.components.workspace.23b236e131": "Reference / File",
  "ui.components.workspace.26c717824f": "Supporting Files",
  "ui.components.workspace.297fc80da3": "Close workspace navigation",
  "ui.components.workspace.2b72cc4f05": "No files in this view yet. Use Upload Pattern to add a manual technical file.",
  "ui.components.workspace.2ba050b648": "Status",
  "ui.components.workspace.2eaba241c2": "Select a Variant containing this Workspace module.",
  "ui.components.workspace.2f39e4512e": "Product Overview",
  "ui.components.workspace.35efe1eb1e": "Priority:",
  "ui.components.workspace.381b967aea": "Save garment revision",
  "ui.components.workspace.38f38214f4": "Re-enable it from Admin Console â†’ Page Surfaces.",
  "ui.components.workspace.3932b2cccd": "Construction step",
  "ui.components.workspace.3b4e3488d0": "Manage canonical sizes, body measurements, finished-garment dimensions and the governed Fit Profile used by downstream fit guidance.",
  "ui.components.workspace.3e708f4001": "Cancel",
  "ui.components.workspace.41bfa0a9b0": "Body area / ease rule",
  "ui.components.workspace.450cc633f1": "Source",
  "ui.components.workspace.45308a57ff": "Destination",
  "ui.components.workspace.465a7463b7": "Target ease:",
  "ui.components.workspace.466d498736": "Silhouette",
  "ui.components.workspace.48556d37d2": "Editable workspace data",
  "ui.components.workspace.4a2376f4a7": "Save workspace",
  "ui.components.workspace.4a65be85a1": "Updated",
  "ui.components.workspace.4ceca3bd41": "Change History",
  "ui.components.workspace.4e9bb758dc": "Master Pattern",
  "ui.components.workspace.50a9d54e88": "Minimum ease:",
  "ui.components.workspace.53090b0ff2": "Type / Format",
  "ui.components.workspace.536a080753": "Master role",
  "ui.components.workspace.53a9e5104f": "Measurement matrix",
  "ui.components.workspace.53ae024066": "Select a card on the left to edit its details here.",
  "ui.components.workspace.5424901296": "Close operation editor",
  "ui.components.workspace.54842de6f9": "Preferred max:",
  "ui.components.workspace.5679ff31c4": "Size references",
  "ui.components.workspace.56c6b2ea80": "Save Fit Profile revision",
  "ui.components.workspace.57bf8d11d2": "Base physical size",
  "ui.components.workspace.58db2b6a0b": "Share",
  "ui.components.workspace.5988a81f87": "Priority",
  "ui.components.workspace.5cfded6a46": "Fit Profile snapshots are retained together with canonical sizes and measurements.",
  "ui.components.workspace.5d5641e849": "Each row is one physical garment size. Alpha, UK, US, EU and any extra Sizer references describe that same size.",
  "ui.components.workspace.5e8fceeed1": "Body area",
  "ui.components.workspace.61571ef15e": "Measurement Chart revision history",
  "ui.components.workspace.6256cd0def": "Save",
  "ui.components.workspace.62ad5f9229": "Size Set",
  "ui.components.workspace.62cce1c1a3": "Source provider",
  "ui.components.workspace.640292792c": "Add size",
  "ui.components.workspace.682f66fd10": "Revoke",
  "ui.components.workspace.6aab790971": "Resize",
  "ui.components.workspace.6ceb0ec342": "Upload archived file",
  "ui.components.workspace.700cb1cd8b": "Pattern output / size coverage",
  "ui.components.workspace.713a241548": "Create a Project from the tree rail to start the Workspace.",
  "ui.components.workspace.73d98ab4c7": "Delete",
  "ui.components.workspace.7415277e60": "Open workspace navigation",
  "ui.components.workspace.772de861db": "Key Attributes",
  "ui.components.workspace.77d6291449": "Fit priorities & ease",
  "ui.components.workspace.790832a7e2": "Minimize",
  "ui.components.workspace.792d5ca643": "Add Style",
  "ui.components.workspace.795938fa89": "Measurement Chart",
  "ui.components.workspace.7a73577383": "Manufacturing operation",
  "ui.components.workspace.7ae090ae11": "Authoritative",
  "ui.components.workspace.7d68aa1cd2": "Upload Pattern",
  "ui.components.workspace.7fce3f6685": "Format",
  "ui.components.workspace.81760aff52": "No active shares.",
  "ui.components.workspace.851deb0d7a": "Every saved canonical change is attributed to the logged-in actor. Formal technical revisions remain separate.",
  "ui.components.workspace.879bdfb18c": "Delete graded file",
  "ui.components.workspace.8906fe07d3": "No requirements added for this construction step.",
  "ui.components.workspace.8a1af8e4d4": "Selected deliverable",
  "ui.components.workspace.8b3214b573": "Select a construction step or operation",
  "ui.components.workspace.8ba66c00fb": "The base size should match the approved master pattern reference.",
  "ui.components.workspace.90ccb50982": "More workspace modules",
  "ui.components.workspace.927b85fc7a": "No previous revisions retained yet.",
  "ui.components.workspace.92c919dac3": "New POM / measurement",
  "ui.components.workspace.9860542b3e": "Preferred max",
  "ui.components.workspace.9aa431fd07": "Designer reason",
  "ui.components.workspace.9bafb9a634": "Normal",
  "ui.components.workspace.9cbd2c7bfd": "Standard fit category",
  "ui.components.workspace.9ddda22302": "Confirm upload",
  "ui.components.workspace.9fdea67acb": "Create share",
  "ui.components.workspace.a0046146d6": "Base reference size",
  "ui.components.workspace.a144aff3fb": "Add row",
  "ui.components.workspace.a14fafa62b": "ISO/industry body-dimension priorities provide the default. Garment ease remains product-specific.",
  "ui.components.workspace.a2608103df": "Minimized Workspace companions",
  "ui.components.workspace.a364c47a55": "Download",
  "ui.components.workspace.a65065fff8": "Silhouette modifiers refine the standard category baseline.",
  "ui.components.workspace.aeae96b030": "Canonical size",
  "ui.components.workspace.b6d35a5868": "No saved activity recorded yet.",
  "ui.components.workspace.b8c4fd6186": "No manufacturing operations yet. Use Add operation on the construction card.",
  "ui.components.workspace.b977aed1af": "Create Project",
  "ui.components.workspace.badded275e": "This is the size source of truth. The deliverable files below prove which graded sizes have actual pattern outputs attached.",
  "ui.components.workspace.bb8e1df905": "Remove measurement row",
  "ui.components.workspace.bc271c45dd": "Replace",
  "ui.components.workspace.bf7006500c": "Open full Workspace module",
  "ui.components.workspace.c3328c7ac2": "Coverage",
  "ui.components.workspace.c3c69b9f9e": "Derived from the governed garment category mapping.",
  "ui.components.workspace.c5b8c54ffd": "POM / Measurement",
  "ui.components.workspace.c5c633badd": "This companion surface is not available yet.",
  "ui.components.workspace.c604306cc7": "Close",
  "ui.components.workspace.c6474d4c46": "Describe the style intent, construction direction or fit note...",
  "ui.components.workspace.c6b10b1f09": "Available sizes",
  "ui.components.workspace.c866815f3e": "Editable",
  "ui.components.workspace.c9248d2270": "No graded files attached yet. Upload the DXF/PDF/CLO/ZIP outputs that correspond to this Size Set.",
  "ui.components.workspace.c9358784cc": "Pattern Library",
  "ui.components.workspace.ca7d561745": "XS, S, M, L, XL",
  "ui.components.workspace.cf7bfaad99": "Reject",
  "ui.components.workspace.d190da2576": "Description",
  "ui.components.workspace.d4a69400e2": "Fit sessions create evidence and proposals only. Nothing changes the technical Fit Profile until accepted here.",
  "ui.components.workspace.d58a63c746": "Search projects...",
  "ui.components.workspace.deb6bb7041": "Size Set reference",
  "ui.components.workspace.debb861f75": "No Fit Profile body areas are available yet.",
  "ui.components.workspace.ded716bee6": "More",
  "ui.components.workspace.df6141c39a": "Technical notes",
  "ui.components.workspace.eb89a8bee8": "Reason for designer override...",
  "ui.components.workspace.ec0e104be4": "Remove canonical size",
  "ui.components.workspace.ec15a3ff67": "This Workspace surface is hidden by Admin visibility settings.",
  "ui.components.workspace.ed2ec198ab": "Baseline",
  "ui.components.workspace.ee1d33a21f": "Requirements for this construction step.",
  "ui.components.workspace.ef540fde9a": "Covered sizes",
  "ui.components.workspace.f23e80e710": "Record variant-specific fit, sample or construction notes...",
  "ui.components.workspace.f32ac791ca": "Min ease",
  "ui.components.workspace.f38cb05b80": "Select a graded file to inspect its coverage.",
  "ui.components.workspace.f900222939": "No measurements yet. Add a POM row to begin the size chart.",
  "ui.components.workspace.fccc50fffa": "Add Variant",
  "ui.components.workspace.fd662e5cf3": "Archived prototype retained for reference only. Active Size Set no longer stores pattern files.",
  "ui.components.workspace.ff20bb2824": "Pending fit-session proposals",
  "ui.components.workspace.projectjournal.0479f1fcf2": "Up",
  "ui.components.workspace.projectjournal.06dbc7ae7e": "Measurement Chart is not available for this variant yet.",
  "ui.components.workspace.projectjournal.0e6883f612": "Overall balance, movement, wearer comments, alteration notes...",
  "ui.components.workspace.projectjournal.0f6294a17c": "New version",
  "ui.components.workspace.projectjournal.164525932e": "Current project task",
  "ui.components.workspace.projectjournal.1a69ea4acd": "Previous",
  "ui.components.workspace.projectjournal.1f153840a7": "Session note...",
  "ui.components.workspace.projectjournal.20bf6da4a5": "Assess the relevant body areas for this garment. The current Fit Profile priority is shown beside each one.",
  "ui.components.workspace.projectjournal.2161a5639a": "Start",
  "ui.components.workspace.projectjournal.226a1c416d": "Fit session",
  "ui.components.workspace.projectjournal.2817b897e5": "Tested size",
  "ui.components.workspace.projectjournal.29de77a9f7": "Log session",
  "ui.components.workspace.projectjournal.3579b05939": "Templates are user-managed project metadata. Applying a version creates a project-specific task snapshot.",
  "ui.components.workspace.projectjournal.35d65659aa": "Finish",
  "ui.components.workspace.projectjournal.3b435a4b4d": "Tasks timed",
  "ui.components.workspace.projectjournal.3c19fa7e5b": "New template name",
  "ui.components.workspace.projectjournal.3f8dd393f0": "Size tested",
  "ui.components.workspace.projectjournal.40a3057eab": "Review in journal",
  "ui.components.workspace.projectjournal.4289b87cb4": "Close photo viewer",
  "ui.components.workspace.projectjournal.4dcbd0f8bb": "Task",
  "ui.components.workspace.projectjournal.50dc576504": "Finish session",
  "ui.components.workspace.projectjournal.5811130035": "Project progress",
  "ui.components.workspace.projectjournal.5be1504e21": "Version",
  "ui.components.workspace.projectjournal.5f7a84f261": "Template",
  "ui.components.workspace.projectjournal.657101b278": "Resize Project Focus",
  "ui.components.workspace.projectjournal.6603066ea9": "Display system",
  "ui.components.workspace.projectjournal.661cf54986": "Fit evidence capture",
  "ui.components.workspace.projectjournal.66fe0afc0e": "No project sessions logged yet.",
  "ui.components.workspace.projectjournal.6abc94a674": "Add project task",
  "ui.components.workspace.projectjournal.70df8c4946": "Fit comment for this body area...",
  "ui.components.workspace.projectjournal.731dbc6713": "Severity",
  "ui.components.workspace.projectjournal.75ce86be46": "Proposed priority",
  "ui.components.workspace.projectjournal.775072d344": "No task template exists yet. Create one here, then add tasks and apply a version to this project.",
  "ui.components.workspace.projectjournal.77862de8d6": "Next",
  "ui.components.workspace.projectjournal.7b7ca2f005": "No task template assigned",
  "ui.components.workspace.projectjournal.7be47eb829": "Use for this project",
  "ui.components.workspace.projectjournal.7f035462a5": "No Fit Profile rules are available. Open Measurement Chart → Fit Profile first.",
  "ui.components.workspace.projectjournal.806665464f": "Sessions",
  "ui.components.workspace.projectjournal.823977a5e5": "Project Focus",
  "ui.components.workspace.projectjournal.833f462577": "Task templates",
  "ui.components.workspace.projectjournal.912f91b2ef": "Style",
  "ui.components.workspace.projectjournal.92f65f44f7": "General fit notes",
  "ui.components.workspace.projectjournal.94f74fa757": "Template Editor",
  "ui.components.workspace.projectjournal.97081ea516": ". Add or amend notes/photos, then choose",
  "ui.components.workspace.projectjournal.99685a6413": "Minimise Project Focus",
  "ui.components.workspace.projectjournal.a37d85369e": "Resume",
  "ui.components.workspace.projectjournal.a7900c3062": "Variant",
  "ui.components.workspace.projectjournal.a98db1d442": "No tasks in this template version yet.",
  "ui.components.workspace.projectjournal.ae5359983e": "Project sessions",
  "ui.components.workspace.projectjournal.ae6caf4181": "Exit session without logging",
  "ui.components.workspace.projectjournal.b228de6579": "Save fit evidence",
  "ui.components.workspace.projectjournal.b73ebbf793": "Session Photos",
  "ui.components.workspace.projectjournal.ba676d6991": "Choose a task template version to instantiate project tasks.",
  "ui.components.workspace.projectjournal.c01b659abc": "Why should the Fit Profile change?",
  "ui.components.workspace.projectjournal.c048dc4ae0": "Fit result",
  "ui.components.workspace.projectjournal.c7231e9464": "Pause",
  "ui.components.workspace.projectjournal.d0bc654d21": "Prepare session photo",
  "ui.components.workspace.projectjournal.d510308d94": "Add photo",
  "ui.components.workspace.projectjournal.db91b64508": "Fit session history",
  "ui.components.workspace.projectjournal.dcef035510": "Add observations, decisions, fitting notes, or what changed during this session...",
  "ui.components.workspace.projectjournal.dec4b6a628": "Propose Fit Profile adjustment",
  "ui.components.workspace.projectjournal.e28f0a35d3": "Structured observations",
  "ui.components.workspace.projectjournal.e5b4e29062": "Time is frozen at",
  "ui.components.workspace.projectjournal.ea555ff9bf": "Observed issue",
  "ui.components.workspace.projectjournal.ec42690e9d": "Create template",
  "ui.components.workspace.projectjournal.f18e9b9305": "Session Notes",
  "ui.components.workspace.projectjournal.fc5877ba96": "Logged",
  "ui.components.workspace.projectjournal.fdbf5d7032": "Down",
  "ui.components.workspace.techpacktechnicaldrawingstudio.01393bc563": "Quick canonical access",
  "ui.components.workspace.techpacktechnicaldrawingstudio.02d4ee1435": "Redo",
  "ui.components.workspace.techpacktechnicaldrawingstudio.0ebb075025": "Measurements",
  "ui.components.workspace.techpacktechnicaldrawingstudio.11a1f22b4e": "Zoom in",
  "ui.components.workspace.techpacktechnicaldrawingstudio.1263420426": "Additional note",
  "ui.components.workspace.techpacktechnicaldrawingstudio.15344c99fb": "Upload or classify a Media asset as the governed Technical Sketch type.",
  "ui.components.workspace.techpacktechnicaldrawingstudio.1dddc8a8bf": "Delete annotation",
  "ui.components.workspace.techpacktechnicaldrawingstudio.1f5d163398": "No technical sketch",
  "ui.components.workspace.techpacktechnicaldrawingstudio.2b1854a9b4": "Select…",
  "ui.components.workspace.techpacktechnicaldrawingstudio.2b1d68ee82": "Technical drawing annotation canvas",
  "ui.components.workspace.techpacktechnicaldrawingstudio.2e5c4f61cc": "Open Media",
  "ui.components.workspace.techpacktechnicaldrawingstudio.33d39737eb": "Source",
  "ui.components.workspace.techpacktechnicaldrawingstudio.43c121f0e7": "Inspector",
  "ui.components.workspace.techpacktechnicaldrawingstudio.44c570e95d": "Variant",
  "ui.components.workspace.techpacktechnicaldrawingstudio.45ca28849c": "Sequence",
  "ui.components.workspace.techpacktechnicaldrawingstudio.4d49d453fb": "Technical drawing metadata is missing.",
  "ui.components.workspace.techpacktechnicaldrawingstudio.5d7478c38c": "Select a callout, dimension, arrow or text item on the drawing to edit its properties.",
  "ui.components.workspace.techpacktechnicaldrawingstudio.7d82d108af": "Text",
  "ui.components.workspace.techpacktechnicaldrawingstudio.8309166375": "Select an annotation",
  "ui.components.workspace.techpacktechnicaldrawingstudio.9033fed3d0": "Linked item",
  "ui.components.workspace.techpacktechnicaldrawingstudio.91c09945bc": "Choose Callout, then click the exact point on the technical sketch.",
  "ui.components.workspace.techpacktechnicaldrawingstudio.92f12783a8": "Call Out Properties",
  "ui.components.workspace.techpacktechnicaldrawingstudio.956d07d181": "Tech Pack",
  "ui.components.workspace.techpacktechnicaldrawingstudio.9a1b0f1efe": "Register",
  "ui.components.workspace.techpacktechnicaldrawingstudio.a80432b5c4": "Short callout",
  "ui.components.workspace.techpacktechnicaldrawingstudio.ae2ed47234": "Annotation Notes",
  "ui.components.workspace.techpacktechnicaldrawingstudio.af841986e2": "Undo",
  "ui.components.workspace.techpacktechnicaldrawingstudio.bfbd80c5ff": "Linked reference type",
  "ui.components.workspace.techpacktechnicaldrawingstudio.c18b00dc6f": "Zoom out",
  "ui.components.workspace.techpacktechnicaldrawingstudio.ca735791a0": "No technical sketch loaded",
  "ui.components.workspace.techpacktechnicaldrawingstudio.d799bfe53a": "Construction",
  "ui.components.workspace.techpacktechnicaldrawingstudio.dd32e7693d": "Drawing",
  "ui.components.workspace.techpacktechnicaldrawingstudio.e4273d8583": "Fit drawing",
  "ui.components.workspace.techpacktechnicaldrawingstudio.ea9ba32f6e": "Views & Assets",
  "ui.components.workspace.techpacktechnicaldrawingstudio.ed82ebf1c8": "No callout notes.",
  "ui.components.workspace.techpacktechnicaldrawingstudio.f8f95cacb4": "No callouts yet",
  "ui.components.workspace.techpackworkspace.0bdf662bb4": "Tech Pack metadata is not configured.",
  "ui.components.workspace.techpackworkspace.2634964add": "Releases",
  "ui.components.workspace.techpackworkspace.276bd25428": "Mount the migrated IndustrialTechPack content here while its hardcoded routing and pattern data are replaced by canonical Sewing and BOM sources.",
  "ui.components.workspace.techpackworkspace.2dea23bc80": "Workspace companion panels",
  "ui.components.workspace.techpackworkspace.463be851f9": "Industrial Pack",
  "ui.components.workspace.techpackworkspace.a393535e55": "Print / PDF",
  "ui.components.workspace.techpackworkspace.d7184bfbe0": "The central metadata must define the Tech Pack tabs.",
  "ui.components.workspace.techpackworkspace.d918cc4ebd": "Add the Tech Pack metadata extension to the central Workspace metadata before mounting this module.",
  "ui.components.workspace.techpackworkspace.da13c137c4": "No Tech Pack surfaces are configured.",
  "ui.components.workspace.techpackworkspace.fccef3a757": "Tech Pack sections",
  "ui.components.workspace.techpackworkspace.fd2f84b147": "This surface will freeze the technical sketch revision, annotation revision and canonical data references when a Tech Pack is released.",
  "ui.components.workspace.workspaceapprovalcenter.0783c0f83b": "CONTROLLED WORKFLOW",
  "ui.components.workspace.workspaceapprovalcenter.0d2f0d6c20": "Technical",
  "ui.components.workspace.workspaceapprovalcenter.1c22e8cc25": "Publication",
  "ui.components.workspace.workspaceapprovalcenter.1f9b014c94": "Technical approval and customer publication are controlled separately.",
  "ui.components.workspace.workspaceapprovalcenter.4b4aca5b32": "Publication workflow unavailable",
  "ui.components.workspace.workspaceapprovalcenter.5fc1866230": "Publication release",
  "ui.components.workspace.workspaceapprovalcenter.9c833e718c": "Project lifecycle",
  "ui.components.workspace.workspaceapprovalcenter.a2d0a6c507": "Approval & Release",
  "ui.components.workspace.workspaceapprovalcenter.af156d08ac": "Technical control",
  "ui.components.workspace.workspaceapprovalcenter.b729c1b490": "No controlled technical items yet",
  "ui.components.workspace.workspaceapprovalcenter.d01a98d51b": "Approval and release center",
  "ui.components.workspace.workspaceapprovalcenter.d995864631": "Moderator note",
  "ui.components.workspace.workspaceapprovalcenter.e3ae4039f8": "Message moderator",
  "ui.components.workspace.workspacemessagingwidget.054780e41b": "No conversations yet.",
  "ui.components.workspace.workspacemessagingwidget.0fb5495fe0": "Messages here are linked to this publication request. They do not grant access to private Workspace content.",
  "ui.components.workspace.workspacemessagingwidget.152fce86ae": "Message the moderator...",
  "ui.components.workspace.workspacemessagingwidget.2fe454ce33": "Messages",
  "ui.components.workspace.workspacemessagingwidget.5c20153c56": "Publication-review conversations will appear here.",
  "ui.components.workspace.workspacemessagingwidget.8083c04175": "Workspace messages",
  "ui.components.workspace.workspacemessagingwidget.9012922cff": "Close messages",
  "ui.components.workspace.workspacemessagingwidget.93f62add10": "Open Workspace messages",
  "ui.components.workspace.workspacemessagingwidget.d2224bfbdd": "Workspace messages",
  "ui.components.workspace.workspacemessagingwidget.d628da710c": "Start the conversation",
  "ui.components.workspace.workspacemessagingwidget.ed2319e12e": "Send",
  "ui.main.1435b3ef7d": "Perfect Fit Engine Recovery Mode",
  "ui.main.87ebafeeac": "Error details:",
  "ui.main.9def7025cc": "Something went wrong while rendering Perfect Fit Bureau\\'s blueprints. This is usually caused by a mismatch in local browser cache, storage, or temporary state parameters."
};

const nativeLanguageLabels = {
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
  es: 'Español',
  de: 'Deutsch',
  ky: 'Кыргызча'
};

const localePacks = {
  en: {
    ...baseEnglish,
    ...generatedEnglish,
    ...autoEnglish,
    ...(workspaceMetadata?.localePacks?.en || {}),
    ...(findMySizeMetadata?.localePacks?.en || {})
  }
};

const languages = [
  {
    code: 'en',
    labelKey: 'language.en',
    nativeLabel: nativeLanguageLabels.en
  }
];

const defaultSurfaceState = {
  version: SURFACE_VISIBILITY_VERSION,
  enabledById: Object.fromEntries(
    SURFACE_VISIBILITY_REGISTRY.map((surface) => [
      surface.id,
      !(surface.lockedDisabled || DEFAULT_HIDDEN_IDS.has(surface.id))
    ])
  )
};

const surfaceRegistry = SURFACE_VISIBILITY_REGISTRY.map((surface, order) => ({
  ...surface,
  order,
  labelKey: `surface.${keyToken(surface.id)}.label`,
  pageLabelKey: `surface.${keyToken(surface.id)}.page`,
  defaultEnabled: defaultSurfaceState.enabledById[surface.id] !== false
}));

const techPack = {
  ...techPackMetadata,
  ui: {
    ...(techPackMetadata.ui || {}),
    tabs: toArray(techPackMetadata?.ui?.tabs).map((tab) => ({
      ...tab,
      labelKey: `techPack.tab.${keyToken(tab.code)}`
    })),
    companionPanels: toArray(techPackMetadata?.ui?.companionPanels).map((panel) => ({
      ...panel,
      labelKey: `techPack.panel.${keyToken(panel.code)}.label`,
      shortLabelKey: `techPack.panel.${keyToken(panel.code)}.shortLabel`
    }))
  },
  drawingStudio: {
    ...(techPackMetadata.drawingStudio || {}),
    tools: toArray(techPackMetadata?.drawingStudio?.tools).map((tool) => ({
      ...tool,
      labelKey: `techPack.tool.${keyToken(tool.code)}`
    })),
    sequenceModes: toArray(techPackMetadata?.drawingStudio?.sequenceModes).map((mode) => ({
      ...mode,
      labelKey: `techPack.sequenceMode.${keyToken(mode.code)}`
    })),
    referenceTypes: toArray(techPackMetadata?.drawingStudio?.referenceTypes).map((type) => ({
      ...type,
      labelKey: `techPack.referenceType.${keyToken(type.code)}`
    }))
  }
};

const russianFemaleGuide = {
  sourceLocale: 'ru',
  source: RUSSIAN_MEASUREMENT_SOURCE,
  rawMeasurements: RUSSIAN_MEASUREMENT_GUIDE,
  measurements: RUSSIAN_MEASUREMENT_GUIDE.map((measurement) => ({
    ...measurement,
    code: measurement.normalizedCode,
    sourceNumber: measurement.no,
    sourceSymbol: measurement.symbolRu,
    sourceText: measurement.nameRu,
    labelKey: `measurement.${measurement.normalizedCode}.label`,
    instructionKey: `measurement.${measurement.normalizedCode}.instruction`
  }))
};


COMPONENT_UI_METADATA.arOverlayVisualizer = {
  modelPresets: [
    {
      id: 'studio-stand',
      name: 'Atelier Dress Form (Neutral)',
      desc: 'Classic wooden studio stand with sand-colored background',
      image: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'minimalist-model',
      name: 'Standard Model (Casual Silhouette)',
      desc: 'Neutral standing pose with minimalist room lighting',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'fabric-hanger',
      name: 'Artisan Wood Hanger Backdrop',
      desc: 'Rustic atelier background for raw fabric/outline checks',
      image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&q=80&w=600'
    }
  ],
  overlayBlueprints: [
    {
      id: 'aurelia-dress',
      name: 'Aurelia Wrap Dress',
      tagline: 'Asymmetrical wrap dress with dolman sleeves',
      image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
      blueprintOutline: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600',
      type: 'Dresses'
    },
    {
      id: 'utility-trench',
      name: 'Atelier Utility Trench',
      tagline: 'Structured double-breasted coat with storm flaps',
      image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600',
      blueprintOutline: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&q=80&w=600',
      type: 'Outerwear'
    },
    {
      id: 'palazzo-pants',
      name: 'Palazzo Wide Legs',
      tagline: 'High-waisted trousers with deep side pleats',
      image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&q=80&w=600',
      blueprintOutline: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=600',
      type: 'Trousers'
    },
    {
      id: 'dolman-blouse',
      name: 'Linen Dolman Blouse',
      tagline: 'Relaxed boatneck shirt with clean rolled cuffs',
      image: 'https://images.unsplash.com/photo-1548624149-f7b3e5cb365b?auto=format&fit=crop&q=80&w=600',
      blueprintOutline: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&q=80&w=600',
      type: 'Tops'
    }
  ],
  presets: [
    { id: 'blueprint', name: 'Studio Blueprint', desc: 'Blue cyanotype aesthetic for structural drafting looks', filters: { blendMode: 'screen', opacity: 85, brightness: 110, contrast: 130, saturation: 40, hueRotate: 200, invert: 10, grayscale: 0, sepia: 0 } },
    { id: 'xray', name: 'Couture X-Ray', desc: 'High contrast monochrome to trace drape flow outlines', filters: { blendMode: 'difference', opacity: 75, brightness: 120, contrast: 150, saturation: 0, hueRotate: 0, invert: 100, grayscale: 100, sepia: 0 } },
    { id: 'fusion', name: 'Textile Fusion', desc: 'Soft warm overlay that blends fabric grains elegantly', filters: { blendMode: 'overlay', opacity: 80, brightness: 100, contrast: 110, saturation: 120, hueRotate: 30, invert: 0, grayscale: 0, sepia: 30 } },
    { id: 'chalk', name: 'Chalk Outline', desc: 'Dark canvas backdrop with bright chalk sewing guidelines', filters: { blendMode: 'color-burn', opacity: 90, brightness: 90, contrast: 140, saturation: 10, hueRotate: 0, invert: 90, grayscale: 90, sepia: 10 } },
    { id: 'photomontage', name: 'Finished Garment', desc: 'Standard composition to visualize realistic texture matches', filters: { blendMode: 'normal', opacity: 75, brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, invert: 0, grayscale: 0, sepia: 0 } }
  ]
};


COMPONENT_UI_METADATA.adminControl.batch06 = {
  mainTabs: [
    { id: 'access', label: '🛡️ Access Control & Permissions' },
    { id: 'publication', label: '🛍️ Publication Moderation' },
    { id: 'telemetry', label: '📊 System Telemetry & Analytics' },
    { id: 'config', label: '🧱 Dynamic Layout Configuration' }
  ],
  layoutSubTabs: [
    { id: 'surfaces', label: 'Page Surfaces' },
    { id: 'visibility', label: '🛡️ Role Permissions' },
    { id: 'homepage', label: '🏠 Homepage Sections' },
    { id: 'metadata', label: '🧱 DB Segments' }
  ],
  catalogueInterestBaseline: [
    { productId: 'sartorial-01', views: 245, cartAdditions: 72, wishlist: 45 },
    { productId: 'sartorial-02', views: 198, cartAdditions: 38, wishlist: 64 },
    { productId: 'sartorial-03', views: 164, cartAdditions: 49, wishlist: 30 },
    { productId: 'sartorial-04', views: 310, cartAdditions: 94, wishlist: 82 },
    { productId: 'perfectfit-gen-005', views: 142, cartAdditions: 25, wishlist: 38 },
    { productId: 'perfectfit-gen-006', views: 120, cartAdditions: 40, wishlist: 22 }
  ],
  visitorSegments: [
    { id: 'visitor', name: 'Casual Visitors', baseValue: 45, multiplier: 3, color: '#64748b' },
    { id: 'member', name: 'Perfect Fit Members', baseValue: 30, multiplier: 4, color: '#8c6239' },
    { id: 'partner', name: 'Creative Partners', baseValue: 18, multiplier: 5, color: '#556b2f' },
    { id: 'professional', name: 'Super Admins', baseValue: 7, multiplier: 2, color: '#ba6446' }
  ]
};


COMPONENT_UI_METADATA.erpSyncDashboard = {
  sections: [
    { id: 'catalog_grid', name: 'Primary Product Catalog Grid', selector: '.erp-pattern-card[data-erp-id]', status: 'Synced', mappedFields: ['id', 'category', 'difficulty', 'name', 'pricePDF', 'pricePrinted'], description: 'Serves as the main catalog scraper endpoint. Scanners crawl this grid to audit dynamic retail offerings.', lastVerified: 'Just now', errorMessage: null, classMarker: 'erp-pattern-card' },
    { id: 'featured_carousel', name: 'Featured Orbital Exhibition Carousel', selector: '.orbit-presenter[data-active-id]', status: 'Synced', mappedFields: ['activePatternId', 'format', 'selectedSize', 'pricePDF', 'pricePrinted'], description: 'Monitors active exhibition cards. Validates that current on-stage layout sizes synchronize with pricing.', lastVerified: 'Just now', errorMessage: null, classMarker: 'orbit-presenter' },
    { id: 'size_advisement', name: 'Size Advisement Matrix', selector: '[data-erp-patt-sizes]', status: 'Pending', mappedFields: ['sizes', 'activeRecommendedSize', 'measurements'], description: 'Maps user-submitted body measurements to backend factory sizing templates for customized cuts.', lastVerified: '3 mins ago', errorMessage: null, classMarker: 'erp-size-btn' },
    { id: 'transaction_ledger', name: 'Direct Transaction Ledger', selector: 'table#erp-sales-table', status: 'Synced', mappedFields: ['gross_sales', 'net_income', 'commission_fees', 'erpStatus', 'txnId'], description: 'Direct bi-directional transaction logging feed. Injected transactions from ERP settle here instantly.', lastVerified: 'Just now', errorMessage: null, classMarker: 'erp-txn-row' },
    { id: 'seo_structured_data', name: 'SEO Meta & JSON-LD Head Script', selector: 'script#sartorial-pattern-jsonld', status: 'Synced', mappedFields: ['@context', 'Product Schema', 'AggregateRating', 'offers'], description: 'Injects dynamic JSON-LD structured product tags into the head tag to drive crawler indexing.', lastVerified: 'Just now', errorMessage: null, classMarker: 'sartorial-pattern-jsonld' }
  ]
};


COMPONENT_UI_METADATA.collaboratorWorkspace = {
  tabs: [
    { id: 'projects', label: '📐 Projects & Checklist' },
    { id: 'products', label: '🛍️ Product Submissions' },
    { id: 'techpacks', label: '🔒 Tech Packs & Secrets' },
    { id: 'timer', label: '⏱️ Sewing Timer' },
    { id: 'supply', label: '🧵 Supplies & Suppliers' },
    { id: 'measurements', label: '📏 Sizers & Guides' }
  ],
  techPackTabs: [
    { id: 'specs', label: '✂️ Atelier Construction Specs' },
    { id: 'flats', label: '🎨 Swatch Studio & Technical Drawings' },
    { id: 'industrial', label: '🏭 Industrial Tech Pack & BOM' },
    { id: 'secrets', label: '🔒 Development Secrets & Journal' }
  ],
  supplyTabs: [
    { id: 'inventory', label: '🧵 Materials Inventory' },
    { id: 'suppliers', label: '🤝 B2B Supplier Directory' },
    { id: 'orders', label: '📦 Restock Pipeline' }
  ]
};


COMPONENT_UI_METADATA.workspaceShell = {
  approval: {
    projectLifecycle: { subtitle: 'Project lifecycle' }
  },
  fitSourceLabels: {
    STANDARD_CATEGORY: { label: 'Standard category' },
    SILHOUETTE_MODIFIER: { label: 'Silhouette modifier' },
    DESIGNER_OVERRIDE: { label: 'Designer override' },
    DEFAULT: { label: 'Standard' }
  },
  fitTabs: [
    { code: 'measurements', label: 'Body measurements' },
    { code: 'garment', label: 'Finished garment' },
    { code: 'fitProfile', label: 'Fit Profile' },
    { code: 'history', label: 'Revision History' }
  ]
};


COMPONENT_UI_METADATA.fabricStash = {
  stockStates: {
    OUT_OF_STOCK: { label: 'Out of stock', description: 'Inventory tracked, no quantity available.' },
    SWATCH_ONLY: { label: 'Swatch only', description: 'Reference swatch/category record only.' },
    CRITICAL: { label: 'Critical', description: 'At or below reorder point.' },
    LOW_STOCK: { label: 'Low stock', description: 'Below low stock threshold.' },
    IN_STOCK: { label: 'In stock', description: 'Enough material available.' }
  },
  inventoryStatuses: {
    SWATCH_ONLY: { label: 'Swatch/category only' },
    ACTIVE: { label: 'Swatch + active inventory' }
  }
};


COMPONENT_UI_METADATA.trackOrder = {
  digital: {
    text: 'All Digital Blueprints Available',
    steps: [
      { id: 'transaction', name: 'Transaction Verified', desc: 'Secure payment cleared', dateMode: 'order-date' },
      { id: 'booklet', name: 'Drafting Booklet Compiled', desc: 'A0 and A4 vector pages rendered', dateMode: 'order-date' },
      { id: 'manual', name: 'Manual Attached', desc: 'Tailoring layout instructions bundled', dateMode: 'order-date' },
      { id: 'ready', name: 'Ready for Instant Download', desc: 'Secure links unlocked on ledger', date: 'Active Now' }
    ],
    logs: [
      { time: '10 mins after checkout', loc: 'Atelier Cloud Compiler', note: 'Secure package generation completed.' },
      { time: '2 mins after checkout', loc: 'Payment Server', note: 'Invoice generated & verification success.' },
      { time: '0 mins after checkout', loc: 'Atelier Portal', note: 'Order successfully registered.' }
    ]
  },
  physical: {
    defaultText: 'Atelier Packaging Queue',
    estimates: {
      calculating: 'Calculating...',
      delivered: 'Delivered',
      outForDelivery: 'Today (By 8:00 PM)',
      inTransit: 'Estimated 2-3 Business Days',
      processing: 'Estimated Dispatch Tomorrow'
    },
    steps: [
      { id: 'confirmed', name: 'Order Confirmed', desc: 'Garment specs loaded into system', dateMode: 'order-date' },
      { id: 'cutting', name: 'Blueprint Cutting', desc: 'Heavy weight drafting paper plotted & hand-cut', date: 'Within 24 Hours' },
      { id: 'dispatch', name: 'Courier Dispatch', desc: 'Dispatched via premium eco-freight courier', completedDate: 'Completed', pendingDate: 'Pending Queue', activeFromStep: 3 },
      { id: 'transit', name: 'In Transit', desc: 'Sorting center scan complete', completedDate: 'Active En Route', pendingDate: 'Pending Dispatch', activeFromStep: 3 },
      { id: 'delivery', name: 'Out for Delivery', desc: 'Delivery vehicle loaded', completedDate: 'Courier Assigned', pendingDate: 'Pending Arrival', activeFromStep: 4 }
    ],
    logs: {
      delivery: { time: 'Today, 8:40 AM', loc: 'Local Distribution Hub', note: 'Shipment loaded onto regional delivery truck.' },
      transit: { time: 'Yesterday, 4:15 PM', loc: 'Main Sorting Facility', note: 'Scanned en route. Cargo container seal verified.' },
      dispatch: { time: '2 days ago, 11:30 AM', loc: 'Atelier Dispatch Terminal', note: 'Parcel handed over to courier representative.' },
      cutting: { loc: 'Sartorial Cutting Room', note: 'Garment pattern dimensions plotted on sustainable Kraft paper.' },
      payment: { loc: 'Payment Server', note: 'Checkout completed & order logged successfully.' }
    }
  }
};

const RUNTIME_DATA_DOMAINS = Object.freeze({
  catalogProducts: {
    entity: 'catalogProduct',
    shape: 'collection',
    storageKey: 'perfectfit_erp_patterns',
    legacyKeys: ['sartorial_erp_patterns', 'sartorial_atelier_imported_patterns'],
    authority: 'EIP'
  },
  productReviews: {
    entity: 'productReviewMap',
    shape: 'document',
    storageKey: 'perfectfit_bureau_reviews',
    authority: 'EIP'
  },
  wishlist: {
    entity: 'wishlist',
    shape: 'document',
    storageKey: 'perfectfit_bureau_favorites',
    authority: 'EIP'
  },
  cart: {
    entity: 'cart',
    shape: 'document',
    storageKey: 'perfectfit_bureau_cart',
    legacyKeys: ['sartorial_mock_store_cart'],
    authority: 'EIP'
  },
  orders: {
    entity: 'order',
    shape: 'document',
    storageKey: 'perfectfit_bureau_guest_orders',
    authority: 'EIP'
  },
  blogPosts: {
    entity: 'blogPost',
    shape: 'collection',
    storageKey: 'sartorial_atelier_blog_posts',
    authority: 'EIP'
  },
  communityPosts: {
    entity: 'communityPost',
    shape: 'collection',
    storageKey: 'sartorial_showroom_posts',
    authority: 'EIP'
  },
  testimonials: {
    entity: 'testimonial',
    shape: 'collection',
    storageKey: 'sartorial_testimonials',
    authority: 'EIP'
  },
  editorialArticles: {
    entity: 'editorialArticle',
    shape: 'collection',
    storageKey: 'perfectfit_editorial_articles_v1',
    authority: 'EIP'
  },
  consultationExperts: {
    entity: 'consultationExpert',
    shape: 'collection',
    storageKey: 'perfectfit_consultation_experts_v1',
    authority: 'EIP'
  },
  consultationBookings: {
    entity: 'consultationBooking',
    shape: 'collection',
    storageKey: 'sartorial_atelier_design_consultations',
    authority: 'EIP'
  },
  newsletterSubscriptions: {
    entity: 'newsletterSubscription',
    shape: 'collection',
    storageKey: 'perfectfit_newsletter_subscribers',
    legacyKeys: ['sartorial_newsletter_subscribers'],
    authority: 'EIP'
  },
  memberDirectory: {
    entity: 'memberProfile',
    shape: 'collection',
    storageKey: 'perfectfit_member_directory_v1',
    authority: 'EIP'
  },
  userProfile: {
    entity: 'userProfile',
    shape: 'document',
    storageKey: USER_PROFILE_STORAGE_KEY,
    authority: 'EIP_AUTH'
  },
  productSubmissions: {
    entity: 'productSubmission',
    shape: 'collection',
    storageKey: 'perfectfit_product_submissions',
    authority: 'EIP'
  },
  accessRequests: {
    entity: 'accessRequest',
    shape: 'collection',
    storageKey: 'sartorial_access_requests',
    authority: 'EIP_AUTH'
  },
  projects: {
    entity: 'project',
    shape: 'collection',
    storageKey: 'sartorial_atelier_projects',
    legacyKeys: ['sartorial_user_projects'],
    authority: 'EIP'
  },
  archivedProjects: {
    entity: 'archivedProject',
    shape: 'collection',
    storageKey: 'sartorial_archived_projects',
    authority: 'EIP'
  },
  projectCompanion: {
    entity: 'projectCompanion',
    shape: 'document',
    storageKey: 'sartorial_project_companion_data',
    authority: 'EIP'
  },
  inventory: {
    entity: 'inventoryItem',
    shape: 'collection',
    storageKey: 'sartorial_atelier_inventory',
    legacyKeys: ['perfectfit_bureau_inventory'],
    authority: 'EIP'
  },
  suppliers: {
    entity: 'supplier',
    shape: 'collection',
    storageKey: materialsMetadata.storage.suppliers,
    legacyKeys: [materialsMetadata.storage.legacySuppliers],
    authority: 'EIP'
  },
  salesHistory: {
    entity: 'sale',
    shape: 'collection',
    storageKey: 'sartorial_erp_sales_history',
    authority: 'EIP'
  },
  supplyOrders: {
    entity: 'supplyOrder',
    shape: 'collection',
    storageKey: 'sartorial_supply_orders',
    authority: 'EIP'
  },
  timeLogs: {
    entity: 'timeLog',
    shape: 'collection',
    storageKey: 'sartorial_timer_logs',
    authority: 'EIP'
  },
  timerHistory: {
    entity: 'timerHistory',
    shape: 'collection',
    storageKey: 'sartorial_timer_history_logs',
    authority: 'EIP'
  },
  importedPatterns: {
    entity: 'importedPattern',
    shape: 'collection',
    storageKey: 'sartorial_atelier_imported_patterns',
    authority: 'EIP'
  },
  patternTags: {
    entity: 'patternTag',
    shape: 'document',
    storageKey: 'perfectfit_pattern_tags',
    legacyKeys: ['sartorial_atelier_saved_pattern_tags'],
    authority: 'EIP'
  },
  fabricStash: {
    entity: 'fabricStash',
    shape: 'collection',
    storageKey: materialsMetadata.storage.materials,
    legacyKeys: ['sartorial_atelier_fabric_stash', 'sartorial_fabric_stash'],
    authority: 'EIP'
  },
  materials: {
    entity: 'material',
    shape: 'collection',
    storageKey: materialsMetadata.storage.materials,
    authority: 'EIP'
  },
  messages: {
    entity: 'message',
    shape: 'collection',
    storageKey: messageMetadata.storage?.directMessages || 'perfectfit_direct_messages_v1',
    legacyKeys: [`${workspaceMetadata.storageKey}_messages_v1`],
    authority: 'EIP'
  },
  messageDirectory: {
    entity: 'messageDirectory',
    shape: 'document',
    storageKey: messageMetadata.storage?.directory || 'perfectfit_message_directory_v1',
    authority: 'EIP'
  },
  workspace: {
    entity: 'workspaceAggregate',
    shape: 'document',
    storageKey: workspaceMetadata.storageKey,
    authority: 'EIP'
  },
  workspacePublication: {
    entity: 'publicationWorkflow',
    shape: 'document',
    storageKey: 'perfectfit_workspace_publication_v1',
    authority: 'EIP'
  },
  media: {
    entity: 'mediaAsset',
    shape: 'collection',
    storageKey: 'perfectfit_media_records_v1',
    legacyKeys: ['sartorial_pattern_media_gallery', 'sartorial_pattern_swatch_library'],
    authority: 'EIP_ASSET'
  },
  notifications: {
    entity: 'notification',
    shape: 'collection',
    storageKey: 'perfectfit_notifications_v1',
    authority: 'EIP'
  },
  userSizingProfile: {
    entity: 'userSizingProfile',
    shape: 'document',
    storageKey: 'sartorial_sizing_profile',
    authority: 'EIP'
  },
  projectJournal: {
    entity: 'projectJournal',
    shape: 'document',
    storageKey: 'perfectfit_project_journal_v1',
    authority: 'EIP'
  },
  customerBodyProfile: {
    entity: 'customerBodyProfile',
    shape: 'document',
    storageKey: 'perfectfit_customer_body_profile_v1',
    authority: 'EIP'
  },
  customerFitHistory: {
    entity: 'customerFitHistory',
    shape: 'document',
    storageKey: 'perfectfit_customer_fit_history_v1',
    authority: 'EIP'
  },
  measurementCalibration: {
    entity: 'measurementCalibration',
    shape: 'document',
    storageKey: CALIBRATION_STORAGE_KEY,
    authority: 'EIP_OPTIONAL'
  },
  measurementAdminConfig: {
    entity: 'measurementAdminConfig',
    shape: 'document',
    storageKey: MEASUREMENT_ADMIN_STORAGE_KEY,
    authority: 'EIP_ADMIN'
  },
  usernameRegistry: {
    entity: 'usernameRegistry',
    shape: 'document',
    storageKey: USERNAME_REGISTRY_STORAGE_KEY,
    authority: 'EIP_AUTH'
  },
  materialPurchaseRequirements: {
    entity: 'materialPurchaseRequirement',
    shape: 'collection',
    storageKey: materialsMetadata.storage.incoming,
    authority: 'EIP'
  },
  materialGoodsReceipts: {
    entity: 'materialGoodsReceipt',
    shape: 'collection',
    storageKey: materialsMetadata.storage.goodsReceipts,
    authority: 'EIP'
  },
  materialIssues: {
    entity: 'materialIssue',
    shape: 'collection',
    storageKey: materialsMetadata.storage.materialIssues,
    authority: 'EIP'
  },
  shoppingPreferences: {
    entity: 'shoppingPreferences',
    shape: 'document',
    storageKey: 'sartorial_shopping_patterns',
    legacyKeys: ['sartorial_shopping_notions', 'sartorial_shopping_widths'],
    authority: 'EIP_OPTIONAL'
  },
  collaboratorSecrets: {
    entity: 'collaboratorSecret',
    shape: 'document',
    storageKey: 'sartorial_collaborator_secrets',
    authority: 'EIP_SECURE'
  },
  analyticsLogs: {
    entity: 'analyticsLog',
    shape: 'collection',
    storageKey: 'perfectfit_layout_analytics_logs',
    authority: 'EIP_OPTIONAL'
  },
  printingGuides: {
    entity: 'printingGuide',
    shape: 'document',
    storageKey: 'perfectfit_printing_guides_v1',
    authority: 'EIP'
  },
  industrialTechPacks: {
    entity: 'industrialTechPack',
    shape: 'document',
    storageKey: 'perfectfit_industrial_tech_packs_v1',
    authority: 'EIP'
  }
});

export const perfectFitMetadata = {
  version: '2026-08-metadata-unified-v1',

  runtimeData: {
    version: '2026-08-runtime-contract-v1',
    defaultAdapter: 'LOCAL',
    domains: RUNTIME_DATA_DOMAINS
  },

  componentUi: COMPONENT_UI_METADATA,

  i18n: {
    defaultLocale: 'en',
    storageKey: PERFECTFIT_LOCALE_STORAGE_KEY,
    nativeLanguageLabels,
    languages,
    localePacks
  },

  app: {
    storage: {
      locale: PERFECTFIT_LOCALE_STORAGE_KEY,
      surfaceVisibility: SURFACE_VISIBILITY_STORAGE_KEY,
      workspace: workspaceMetadata.storageKey,
      userProfile: USER_PROFILE_STORAGE_KEY
    },
    navigation: {
      groups: navigationGroups,
      items: navigationItems
    },
    layout: {
      shellMaxWidth: 1920,
      topContentGap: '3mm',
      pageShellClass: PAGE_SHELL_CLASS,
      mainPageShellClass: MAIN_PAGE_SHELL_CLASS
    },
    layoutMetadata: {
      version: APP_LAYOUT_METADATA_VERSION,
      storageKey: APP_LAYOUT_METADATA_KEY,
      versionStorageKey: APP_LAYOUT_METADATA_VERSION_KEY,
      trackShipmentFeatureKey: TRACK_SHIPMENT_FEATURE_KEY,
      disabledSurfaceIds: [...DISABLED_LAYOUT_SURFACE_IDS],
      navGroupLabelKeys: NAV_GROUP_LABEL_KEYS,
      navItemLabelKeys: NAV_ITEM_LABEL_KEYS,
      defaultSections: DEFAULT_APP_LAYOUT_METADATA,
      catalogue: {
        showViewModeToggles: SHOW_CATALOGUE_VIEW_MODE_TOGGLES,
        defaultLegacyPatternSize: DEFAULT_LEGACY_PATTERN_SIZE,
        cartImageFields: CART_IMAGE_FIELDS
      }
    },
    surfaces: {
      version: SURFACE_VISIBILITY_VERSION,
      registry: surfaceRegistry,
      defaultState: defaultSurfaceState,
      defaultHiddenIds: [...DEFAULT_HIDDEN_IDS],
      workspaceNodeSurfaceIds: WORKSPACE_NODE_SURFACE_IDS
    },
    floatingTools: {
      version: FLOATING_TOOL_LAYOUT_VERSION,
      launcher: FLOATING_TOOL_LAUNCHER,
      stackIndexByTool: STACK_INDEX_BY_TOOL
    },
    ui: {
      layers: UI_LAYERS
    }
  },

  auth: {
    usernamePolicy: {
      storageKey: USERNAME_REGISTRY_STORAGE_KEY,
      minLength: 3,
      maxLength: 30,
      pattern: USERNAME_PATTERN.source,
      reservedUsernames: [...RESERVED_USERNAMES],
      validationMessageKeys: {
        required: 'auth.username.required',
        format: 'auth.username.format',
        reserved: 'auth.username.reserved',
        taken: 'auth.username.taken'
      }
    },
    roles: rolePermissions?.roles || {},
    permissions: rolePermissions
  },

  catalog: {
    taxonomy: {
      audiences: CATALOG_AUDIENCES,
      collectionTags: DEFAULT_COLLECTION_TAGS,
      designerBrands: DEFAULT_DESIGNER_BRANDS,
      productStatus: PRODUCT_STATUS,
      categoryRequestStatus: CATEGORY_REQUEST_STATUS
    },
    filters: {},
    presentation: {}
  },

  messaging: {
    ...messageMetadata,
    messageTypes: toArray(messageMetadata?.messageTypes).map((type) => ({
      ...type,
      labelKey: `messaging.type.${keyToken(type.code)}`
    }))
  },

  materials: materialsMetadata,
  workspace: workspaceMetadata,
  techPack,
  findMySize: findMySizeMetadata,

  measurement: {
    version: CALIBRATION_EDITOR_VERSION,
    imageSize: IMAGE_SIZE,
    stageAspect: STAGE_ASPECT,
    calibrationStorageKey: CALIBRATION_STORAGE_KEY,
    adminStorageKey: MEASUREMENT_ADMIN_STORAGE_KEY,
    persistence: MEASUREMENT_PERSISTENCE,
    anchorColors: ANCHOR_COLORS,
    displayCodes: MEASUREMENT_DISPLAY_CODES,
    inputSpecs: MEASUREMENT_INPUT_SPECS,
    definitions: DEFAULT_MEASUREMENTS,
    baseDefinitions: BASE_MEASUREMENTS,
    russianGuideAdditions: RUSSIAN_GUIDE_ADDITIONS,
    viewOrder: VIEW_MEASUREMENT_ORDER,
    views: MEASUREMENT_VIEWS,
    guideDefaults: MEASUREMENT_GUIDE_DEFAULTS,
    defaultViewConfig: DEFAULT_VIEW_CONFIG,
    avatarTaxonomy: AVATAR_TAXONOMY,
    avatarLegacyToCanonical: LEGACY_TO_CANONICAL,
    avatarCanonicalToLegacy: CANONICAL_TO_LEGACY,
    avatarGenders: AVATAR_GENDERS,
    avatarAgeGroups: AVATAR_AGE_GROUPS,
    avatarProfiles: AVATAR_PROFILES,
    avatarAreas: AVATAR_AREAS,
    sourceGuides: {
      russianFemale: russianFemaleGuide
    },
    legacyPositions: MEASUREMENT_POSITIONS,
    fitProfile: {
      version: FIT_PROFILE_VERSION,
      priorityCodes: FIT_PRIORITY_CODES,
      approvalStatuses: MEASUREMENT_CHART_APPROVAL_STATUSES
    },
    calibration: {
      overridePrecedence: [
        'DB/API metadata override',
        'administrator runtime overrides',
        'local persisted calibration/config',
        'perfectFitMetadata.js fallback'
      ]
    }
  },

  sizing: {
    version: MEASUREMENT_CHART_VERSION,
    baseSystems: DEFAULT_MEASUREMENT_SIZE_SYSTEMS,
    defaultSizeLabels: DEFAULT_SIZE_LABELS,
    systemAliases: SYSTEM_ALIASES,
    systems: [
      ...DEFAULT_MEASUREMENT_SIZE_SYSTEMS,
      { code: 'FR', labelKey: 'sizing.system.fr', label: 'FR' },
      { code: 'RU', labelKey: 'sizing.system.ru', label: 'RU' }
    ],
    conversion: {}
  }
};

export default perfectFitMetadata;
