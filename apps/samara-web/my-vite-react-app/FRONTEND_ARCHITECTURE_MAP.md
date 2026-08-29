# Samara / Perfect Fit Bureau Frontend Architecture Map

Discovery date: 2026-08-11  
Project path: `D:\Projects\EIP\eip-core\apps\samara-web\my-vite-react-app`

This is a discovery-only map of the current React/Vite frontend. It does not propose a refactor as the default action; it names the current structure so future prompts can target the exact module, component, state key, or UI area without accidental rewrites.

## 1. Executive overview

The Samara / Perfect Fit Bureau frontend is a Vite + React 19 single-page application. It does not currently use a route library; navigation is driven primarily by `activeView` state in `src\App.jsx`.

The app is organized around three overlapping layers:

1. **Storefront/customer layer**
   - Homepage hero and signature carousel.
   - Pattern catalogue/gallery.
   - Quick view, cart, wishlist, checkout, order tracking, consultation booking, testimonials, FAQ, academy/blog.

2. **Dynamic workspace / role-gated layer**
   - `DynamicLayout`, `DynamicLayoutContext`, `RoleContext`, `ComponentRegistry`, and `rolePermissions.json`.
   - This layer decides which workspace modules are visible to visitors, members, partners, professionals, and administrators.

3. **Local mock/metadata persistence layer**
   - Large parts of the app persist to browser `localStorage` / `sessionStorage`.
   - Several modules use metadata keys such as `perfectfit_app_layout_metadata`, `sartorial_ui_metadata`, and `sartorial_layout_rules`.
   - This app is currently frontend-heavy; many workflows are simulated locally rather than backed by a server API.

The most important file is `src\App.jsx`. It owns:

- global navigation state;
- desktop/mobile view mode;
- cart, favorites, guest orders, current user, reviews, ERP-imported patterns;
- layout metadata and visible section ordering;
- the main renderer for landing-page/workspace sections;
- modal orchestration.

The second most important group is the dynamic workspace system:

- `src\components\DynamicLayout.jsx`
- `src\context\DynamicLayoutContext.jsx`
- `src\context\RoleContext.jsx`
- `src\components\ComponentRegistry.jsx`
- `src\rolePermissions.json`

The storefront visual identity is defined mostly in:

- `src\index.css`
- Tailwind utility classes inside component JSX
- local image assets in `src\assets\images`

## 2. Project tree

Source and public files discovered:

```text
public\
  sw.js

src\
  App.jsx
  main.jsx
  index.css
  data.js
  data_positions.js
  googleAuth.js
  rolePermissions.json
  eip-core-v2.code-workspace

  assets\
    images\
      atelier_backdrop_1783112535415.jpg
      couture_mannequin_1783113201566.jpg
      couture_mannequin_transparent.png
      couture_mannequin_transparent_1783114547480.jpg
      pattern_blouse_1782223531046.jpg
      pattern_dress_1782223486101.jpg
      pattern_trench_1782223501914.jpg
      pattern_trouser_1782223515288.jpg

  components\
    AdminControlPanel.jsx
    ArOverlayVisualizer.jsx
    CatalogCategoryNavigator.jsx
    CatalogSidebarNavigator.jsx
    CheckoutDrawer.jsx
    CollaboratorSalesDashboard.jsx
    ComponentRegistry.jsx
    ConsultationBookingModal.jsx
    CreationsAndFeedback.jsx
    CreatorBlog.jsx
    CustomerGalleryAndReviews.jsx
    DeveloperIntegrationModal.jsx
    DynamicLayout.jsx
    DynamicUiEngine.jsx
    EditorialAcademy.jsx
    ErpSyncDashboard.jsx
    FabricStashModal.jsx
    FabricYardageCalculator.jsx
    HeroCarousel.jsx
    IndustrialTechPack.jsx
    InstructionsPdfModal.jsx
    MannequinGuide.jsx
    MemberManagement.jsx
    MobileAppView.jsx
    MyOrdersSection.jsx
    OrbitCarousel.jsx
    PatternCard.jsx
    PatternImageGallery.jsx
    PatternQuickViewModal.jsx
    PatternSEO.jsx
    PerfectFitFaq.jsx
    PerfectFitLayoutController.jsx
    PerfectFitStandards.jsx
    PermissionsGuideModal.jsx
    PrintingGuide.jsx
    RoleDocumentationModal.jsx
    SewingSessionTimer.jsx
    SignatureOrbitCarouselA.jsx
    SignaturePerspectiveStackCarouselB.jsx
    SkeletonLoader.jsx
    StayInspiredNewsletter.jsx
    TestimonialCarousel.jsx
    TrackOrderModal.jsx
    WishlistDrawer.jsx

    subcomponents\
      CheckoutStore.jsx
      CollaboratorWorkspace.jsx
      DynamicGallery.jsx
      DynamicInventory.jsx
      DynamicProjectManager.jsx
      OnboardingWalkthrough.jsx
      PermissionsOverview.jsx
      ProductDevelopmentMediaGallery.jsx
      ProfessionalDashboard.jsx
      TimeAndMotionStudy.jsx
      WorkspaceAnalyticsPanel.jsx

  context\
    DynamicLayoutContext.jsx
    RoleContext.jsx

  data\
    catalogTaxonomy.js

  hooks\
    useLayoutAnalytics.js

  lib\
    patternMediaManager.js
```

Root-level files relevant to the frontend:

```text
package.json
vite.config.js
```

## 3. Application entry flow

### 3.1 Runtime entry

`src\main.jsx` is the browser entry point.

Flow:

```text
src\main.jsx
  imports React StrictMode
  imports createRoot
  imports App from src\App.jsx
  imports global CSS from src\index.css
  defines ErrorBoundary
  unregisters existing service workers
  clears Cache Storage
  renders <App />
```

Important details:

- `ErrorBoundary` is a class component wrapping the entire app.
- If rendering fails, it shows **Perfect Fit Engine Recovery Mode**.
- The recovery button clears both `localStorage` and `sessionStorage`, then reloads the page.
- `main.jsx` also unregisters service workers and deletes browser caches. This is relevant because `public\sw.js` still exists, but the runtime deliberately removes service workers on load.

### 3.2 Build/runtime config

`vite.config.js`:

- Uses `@vitejs/plugin-react`.
- Uses Tailwind v4 through `@tailwindcss/vite`.
- Defines alias `@` as the project root.
- Supports an environment flag `DISABLE_HMR=true` to disable HMR and file watching.
- This HMR disable behavior is documented in comments as an AI Studio stabilization setting.

`package.json`:

- `npm run dev` starts Vite on port `3000` and host `0.0.0.0`.
- `npm run build` runs `vite build`.
- `npm run lint` currently echoes a checklist message instead of running a real linter.
- Important dependencies include React 19, `motion`, `lucide-react`, `recharts`, `jspdf`, Firebase, Google GenAI, Vite, and Tailwind.

## 4. `App.jsx` map

`src\App.jsx` is the command center.

### 4.1 Main imported modules

Major UI imports:

- `CatalogSidebarNavigator`
- `PatternCard`
- `PatternImageGallery`
- `PatternQuickViewModal`
- `CheckoutDrawer`
- `WishlistDrawer`
- `TrackOrderModal`
- `ConsultationBookingModal`
- `HeroCarousel`
- `OrbitCarousel`
- `MannequinGuide`
- `CreatorBlog`
- `EditorialAcademy`
- `MemberManagement`
- `MyOrdersSection`
- `SewingSessionTimer`
- `CreationsAndFeedback`
- `MobileAppView`
- `DynamicUiEngine`
- `DynamicLayout`
- `RoleProvider`
- `DeveloperIntegrationModal`
- `StayInspiredNewsletter`
- `SkeletonGrid`
- `OrbitCarouselSkeleton`
- `PerfectFitStandards`
- `DynamicGallery`
- `PerfectFitLayoutController`
- `TestimonialCarousel`
- `PerfectFitFaq`
- `FabricStashModal`
- `AdminControlPanel`
- `SignatureOrbitCarouselA`
- `SignaturePerspectiveStackCarouselB`

Data imports:

- `SEWING_PATTERNS`
- `MASTER_SIZING_TABLE`
- `slugifyCatalogValue`

Animation/icon imports:

- `motion`, `AnimatePresence` from `motion/react`
- many icons from `lucide-react`

### 4.2 Layout metadata system

`App.jsx` defines:

- `APP_LAYOUT_METADATA_VERSION`
- `APP_LAYOUT_METADATA_KEY`
- `APP_LAYOUT_METADATA_VERSION_KEY`
- `DEFAULT_APP_LAYOUT_METADATA`

Current metadata key names:

```text
perfectfit_app_layout_metadata
perfectfit_app_layout_metadata_version
sartorial_ui_metadata
sartorial_layout_rules
```

When `APP_LAYOUT_METADATA_VERSION` changes, `App.jsx` resets:

- `perfectfit_app_layout_metadata`
- `sartorial_ui_metadata`
- `sartorial_layout_rules`

This means a layout metadata version bump can discard user-customized layout/permission metadata from local storage.

### 4.3 Current default section metadata

The default app layout metadata defines these known section IDs:

| Section ID | Component name | View | Order | Enabled | Purpose |
|---|---|---:|---:|---:|---|
| `hero-carousel` | `HeroCarousel` | `home` | 10 | yes | Homepage hero carousel |
| `orbital-featured` | `SignatureOrbitCarouselA` | `home` | 20 | yes | Signature collection carousel |
| `home-maker-transition` | `HomeMakerTransition` | `home` | 25 | yes | Placeholder transition; renderer returns `null` |
| `customer-testimonials` | `TestimonialCarousel` | `home` | 30 | yes | Testimonials section |
| `gallery` | `DynamicGallery` | `patterns` | 10 | yes | Pattern catalogue/gallery |
| `my-orders` | `MyOrdersSection` | `orders` | 10 | yes | Customer orders |
| `creations-feedback` | `CreationsAndFeedback` | `community feedback` | n/a | yes | Community/reviews; has potential view mismatch with nav target `community` |
| `creator-community-blog` | `CreatorBlog` | `blog` | n/a | yes | Blog/community board |
| `dynamic-metadata-ui` | `DynamicUiEngine` | `workspace` | 10 | yes | Metadata UI engine |
| `calculator` | `MannequinGuide` | `workspace` | 20 | no | Size/fitting workspace; currently disabled in metadata |
| `perfectfit-specification` | `PerfectFitStandards` | `about` | 10 | yes | Size/standard guide |
| `perfectfit-library` | `EditorialAcademy` | `academy` | 10 | yes | Academy/library |
| `perfectfit-faq` | `PerfectFitFaq` | `faq` | 10 | yes | FAQ |
| `role-based-dynamic-layout` | `DynamicLayout` | `workspace` | 30 | yes | Role-gated workspace layout |
| `sewing-timer` | `SewingSessionTimer` | `workspace` | 40 | no | Sewing timer; currently disabled |
| `administrator-console` | `AdminControlPanel` | `admin` | 10 | yes | Admin console; requires administrator role |

### 4.4 Main state groups

`App.jsx` owns these major state areas:

| State group | Representative state | Storage key / source |
|---|---|---|
| View mode | `viewMode` | `perfectfit_view_mode` |
| Active page/view | `activeView` | in-memory only |
| Authentication/profile | `currentUser` | `perfectfit_bureau_user` |
| Layout metadata | `appLayout` | `perfectfit_app_layout_metadata` |
| Cart | `cartItems` | `perfectfit_bureau_cart` |
| Guest orders | `guestOrders` | `perfectfit_bureau_guest_orders` |
| Pattern catalogue | `patterns` | `perfectfit_erp_patterns` or `SEWING_PATTERNS` |
| Reviews | `reviews` | `perfectfit_bureau_reviews` |
| Favorites/wishlist | `favorites` | `perfectfit_bureau_favorites` |
| UI modals | cart, wishlist, order tracking, auth, consultation, fabric stash, developer modal, quick view | in-memory booleans |
| Catalogue filters | category, difficulty, sort, search, audience, category, designer | mixed in-memory state |
| Loading skeletons | `isCatalogLoading`, `isCarouselLoading` | simulated timers |
| Online/toast state | `isOnline`, `toasts` | browser online events + in-memory |

### 4.5 Navigation model

The app does not use `react-router`.

Navigation is based on:

```text
activeView
goToView(view)
visibleSections
exploreMenuGroups
```

`goToView(view)`:

- changes `activeView`;
- scrolls the page to top.

`visibleSections`:

- filters `appLayout` by `section.isEnabled`;
- filters by `section.view === activeView`;
- filters admin-only sections by role;
- sorts by `section.order`.

`exploreMenuGroups`:

- groups enabled sections that contain `section.nav`;
- builds the Explore menu from metadata.

### 4.6 Rendering model

There are two rendering paths to keep in mind:

1. `SECTION_RENDERERS` object near the upper-middle of `App.jsx`.
2. A later `switch(section.component)` style rendering block inside the main JSX.

This duplication is a fragile area because one renderer path can be updated while the other remains stale.

For future prompts, be explicit:

- "Update the `SECTION_RENDERERS` entry for `SignatureOrbitCarouselA` in `src\App.jsx`."
- Or: "Update the later `visibleSections.map` switch case for `DynamicGallery` in `src\App.jsx`."

## 5. Landing page sections map

The current home landing sequence is metadata-driven from `DEFAULT_APP_LAYOUT_METADATA`.

### 5.1 Hero section

Canonical name: **Homepage Hero Carousel**  
Metadata ID: `hero-carousel`  
Component: `src\components\HeroCarousel.jsx`  
Renderer name: `HeroCarousel`  
View: `home`

Purpose:

- Top homepage hero.
- Uses local pattern/atelier images.
- Receives callbacks from `App.jsx`:
  - `onExploreCatalog={() => goToView("patterns")}`
  - `onOpenSizingCalculator={() => goToView("workspace")}`

### 5.2 Signature collections carousel

Canonical name: **Signature Orbit Carousel A**  
Metadata ID: `orbital-featured`  
Component: `src\components\SignatureOrbitCarouselA.jsx`  
Renderer name: `SignatureOrbitCarouselA`  
View: `home`

Purpose:

- Main premium/orbit featured pattern section.
- Receives a sliced pattern list from `App.jsx`.
- Supports quick-view and focus callbacks.

Alternative/legacy components:

- `src\components\SignaturePerspectiveStackCarouselB.jsx`
- `src\components\OrbitCarousel.jsx`

Important distinction:

- If a prompt says “the homepage carousel with orbit/3D cards,” target `SignatureOrbitCarouselA.jsx`.
- If a prompt says “old featured carousel,” target `OrbitCarousel.jsx`.

### 5.3 Home maker transition

Canonical name: **Home Maker Transition Title**  
Metadata ID: `home-maker-transition`  
Renderer name: `HomeMakerTransition`  
View: `home`

Current behavior:

- Metadata says this section is enabled.
- The renderer returns `null`.
- This is a placeholder, not a visible section.

### 5.4 Customer testimonials

Canonical name: **Customer Testimonials**  
Metadata ID: `customer-testimonials`  
Component: `src\components\TestimonialCarousel.jsx`  
Renderer name: `TestimonialCarousel`  
View: `home`

Purpose:

- Testimonial carousel.
- Uses local storage key `sartorial_testimonials`.

## 6. Component inventory table

This table maps 67 current frontend modules under `src`.

| # | File | Canonical name | Role |
|---:|---|---|---|
| 1 | `src\App.jsx` | App Shell / Root Orchestrator | Global state, view navigation, layout metadata, section rendering, modals |
| 2 | `src\main.jsx` | React Runtime Entry | Error boundary, service worker unregister, app mount |
| 3 | `src\index.css` | Global Theme Tokens | Fonts, Tailwind theme colors, scrollbar styling |
| 4 | `src\data.js` | Pattern Seed Data | `SEWING_PATTERNS`, `MASTER_SIZING_TABLE`, generated catalogue data |
| 5 | `src\data_positions.js` | Measurement Position Data | Measurement marker positions for fitting/mannequin UI |
| 6 | `src\googleAuth.js` | Google Auth / Drive Helper | Firebase Google login and Drive file helpers |
| 7 | `src\rolePermissions.json` | Role Permission Matrix | Role-to-component permission defaults |
| 8 | `src\data\catalogTaxonomy.js` | Catalogue Taxonomy | Audiences, categories, designer metadata, slug helpers |
| 9 | `src\hooks\useLayoutAnalytics.js` | Layout Analytics Hook | Tracks admin/workspace interactions to local storage |
| 10 | `src\lib\patternMediaManager.js` | Pattern Media Manager | Local media gallery and fabric swatch persistence |
| 11 | `src\context\RoleContext.jsx` | Role Context | Maps user profile to visitor/member/partner/professional |
| 12 | `src\context\DynamicLayoutContext.jsx` | Dynamic Layout Context | Applies role rules to `ComponentRegistry` modules |
| 13 | `src\components\ComponentRegistry.jsx` | Workspace Component Registry | Registers dynamic workspace modules |
| 14 | `src\components\DynamicLayout.jsx` | Dynamic Workspace Layout | Renders role-gated workspace modules |
| 15 | `src\components\DynamicUiEngine.jsx` | Dynamic UI Metadata Engine | UI metadata/admin behavior controls |
| 16 | `src\components\AdminControlPanel.jsx` | Admin Control Panel | Admin metadata, permission, analytics, layout settings |
| 17 | `src\components\PerfectFitLayoutController.jsx` | Layout Controller | Layout metadata control surface |
| 18 | `src\components\PermissionsGuideModal.jsx` | Permissions Guide Modal | Explains dynamic layout/permission rules |
| 19 | `src\components\RoleDocumentationModal.jsx` | Role Documentation Modal | Explains role model |
| 20 | `src\components\subcomponents\PermissionsOverview.jsx` | Permissions Overview Matrix | Live permission matrix |
| 21 | `src\components\subcomponents\WorkspaceAnalyticsPanel.jsx` | Workspace Analytics Panel | Layout analytics visualization |
| 22 | `src\components\subcomponents\ProfessionalDashboard.jsx` | Professional Dashboard | Partner/professional operational dashboard |
| 23 | `src\components\subcomponents\CollaboratorWorkspace.jsx` | Collaborator Workspace | Projects, suppliers, inventory, submissions, timer integration |
| 24 | `src\components\subcomponents\DynamicInventory.jsx` | Dynamic Inventory | Inventory ledger and PDF/export-style tools |
| 25 | `src\components\subcomponents\DynamicProjectManager.jsx` | Dynamic Project Manager | Local project manager module |
| 26 | `src\components\subcomponents\CheckoutStore.jsx` | Mock Checkout Store | Local store/cart checkout module |
| 27 | `src\components\subcomponents\OnboardingWalkthrough.jsx` | Onboarding Walkthrough | Guided walkthrough for workspace/timer |
| 28 | `src\components\subcomponents\ProductDevelopmentMediaGallery.jsx` | Product Development Media Gallery | Media gallery, swatches, lightbox/editor-like views |
| 29 | `src\components\subcomponents\TimeAndMotionStudy.jsx` | Time & Motion Study | Operation timing, simulation, motion study notes |
| 30 | `src\components\HeroCarousel.jsx` | Homepage Hero Carousel | Home hero/CTA carousel |
| 31 | `src\components\SignatureOrbitCarouselA.jsx` | Signature Orbit Carousel A | Current featured orbit carousel |
| 32 | `src\components\SignaturePerspectiveStackCarouselB.jsx` | Signature Perspective Stack Carousel B | Alternate featured carousel |
| 33 | `src\components\OrbitCarousel.jsx` | Legacy Orbit Carousel | Older featured/orbit carousel with quick view support |
| 34 | `src\components\TestimonialCarousel.jsx` | Customer Testimonial Carousel | Testimonials with local persistence |
| 35 | `src\components\CatalogSidebarNavigator.jsx` | Catalogue Sidebar Navigator | Audience/category/designer sidebar filters |
| 36 | `src\components\CatalogCategoryNavigator.jsx` | Catalogue Category Navigator | Category filter/navigation UI |
| 37 | `src\components\subcomponents\DynamicGallery.jsx` | Dynamic Pattern Gallery | Main pattern catalogue/gallery |
| 38 | `src\components\PatternCard.jsx` | Pattern Card | Pattern display card used by gallery/catalogue |
| 39 | `src\components\PatternImageGallery.jsx` | Pattern Image Gallery | Pattern image gallery with hover/admin behavior |
| 40 | `src\components\PatternQuickViewModal.jsx` | Pattern Quick View Modal | Pattern details modal |
| 41 | `src\components\PatternSEO.jsx` | Pattern SEO Block | Pattern SEO/metadata UI |
| 42 | `src\components\CustomerGalleryAndReviews.jsx` | Customer Gallery & Reviews Adapter | Wraps community/review display |
| 43 | `src\components\CreationsAndFeedback.jsx` | Creations & Feedback | Community posts, reviews, customer creations |
| 44 | `src\components\CheckoutDrawer.jsx` | Checkout Drawer | Cart checkout panel |
| 45 | `src\components\WishlistDrawer.jsx` | Wishlist Drawer | Favorites/wishlist panel |
| 46 | `src\components\TrackOrderModal.jsx` | Track Order Modal | Order lookup/tracking modal |
| 47 | `src\components\MyOrdersSection.jsx` | My Orders Section | Customer order list/details |
| 48 | `src\components\ConsultationBookingModal.jsx` | Consultation Booking Modal | Consultation scheduling form |
| 49 | `src\components\StayInspiredNewsletter.jsx` | Newsletter Signup | Newsletter signup persistence |
| 50 | `src\components\MemberManagement.jsx` | Member Management | Newsletter/member/admin management |
| 51 | `src\components\DeveloperIntegrationModal.jsx` | ERP Developer Integration Modal | Import/sync local ERP patterns |
| 52 | `src\components\MobileAppView.jsx` | Mobile App View | Alternate mobile-specific application shell |
| 53 | `src\components\MannequinGuide.jsx` | Mannequin Guide / Sizing Workspace | Size calculator, mannequin, fitting support |
| 54 | `src\components\FabricYardageCalculator.jsx` | Fabric Yardage Calculator | Yardage/fabric calculation |
| 55 | `src\components\FabricStashModal.jsx` | Fabric Stash Modal | Fabric stash/inventory modal |
| 56 | `src\components\ArOverlayVisualizer.jsx` | AR Overlay Visualizer | Mannequin/image overlay visualization |
| 57 | `src\components\SewingSessionTimer.jsx` | Sewing Session Timer | Timer, project companion, stash/shopping helpers |
| 58 | `src\components\IndustrialTechPack.jsx` | Industrial Tech Pack | Technical pack/workflow module |
| 59 | `src\components\InstructionsPdfModal.jsx` | Instructions PDF Modal | PDF/instructions modal |
| 60 | `src\components\PrintingGuide.jsx` | Printing Guide | Print/tile/assembly guide |
| 61 | `src\components\EditorialAcademy.jsx` | Editorial Academy | Educational/library section |
| 62 | `src\components\CreatorBlog.jsx` | Creator Blog | Blog/community board posts |
| 63 | `src\components\PerfectFitStandards.jsx` | Perfect Fit Standards | Sizing and standards page |
| 64 | `src\components\PerfectFitFaq.jsx` | Perfect Fit FAQ | FAQ page |
| 65 | `src\components\SkeletonLoader.jsx` | Skeleton Loaders | Pattern and carousel skeleton states |
| 66 | `src\components\CollaboratorSalesDashboard.jsx` | Collaborator Sales Dashboard | Local sales history dashboard |
| 67 | `src\components\ErpSyncDashboard.jsx` | ERP Sync Dashboard | ERP sync/status dashboard |

## 7. Component dependency graph

High-level graph:

```text
main.jsx
  -> App.jsx
      -> RoleProvider
      -> Header / navigation / desktop shell
      -> MobileAppView when viewMode === "mobile"
      -> DEFAULT_APP_LAYOUT_METADATA
      -> visibleSections renderer

App.jsx
  -> HeroCarousel
  -> SignatureOrbitCarouselA
  -> SignaturePerspectiveStackCarouselB
  -> OrbitCarousel
  -> TestimonialCarousel
  -> DynamicGallery
  -> MyOrdersSection
  -> CreationsAndFeedback
  -> CreatorBlog
  -> DynamicUiEngine
  -> DynamicLayout
  -> MannequinGuide
  -> PerfectFitStandards
  -> EditorialAcademy
  -> PerfectFitFaq
  -> AdminControlPanel
  -> CheckoutDrawer
  -> WishlistDrawer
  -> TrackOrderModal
  -> ConsultationBookingModal
  -> PatternQuickViewModal
  -> FabricStashModal
  -> DeveloperIntegrationModal
  -> MemberManagement
```

Dynamic workspace graph:

```text
RoleProvider
  -> RoleContext

DynamicLayout
  -> DynamicLayoutContext
  -> RoleContext
  -> ComponentRegistry
  -> RoleDocumentationModal
  -> PermissionsGuideModal
  -> AdminControlPanel

DynamicLayoutContext
  -> ComponentRegistry
  -> rolePermissions.json
  -> useLayoutAnalytics

ComponentRegistry
  -> DynamicGallery
  -> CheckoutStore
  -> CollaboratorWorkspace
  -> DynamicInventory
  -> ProfessionalDashboard
  -> PermissionsOverview
  -> WorkspaceAnalyticsPanel
```

Workspace subgraph:

```text
CollaboratorWorkspace
  -> SewingSessionTimer
  -> MannequinGuide
  -> IndustrialTechPack
  -> ProductDevelopmentMediaGallery
  -> OnboardingWalkthrough
  -> catalogTaxonomy
  -> data.js

SewingSessionTimer
  -> TimeAndMotionStudy

MannequinGuide
  -> FabricYardageCalculator
  -> ArOverlayVisualizer
  -> googleAuth
  -> data.js
  -> data_positions.js

ProductDevelopmentMediaGallery
  -> patternMediaManager
```

Catalogue/product graph:

```text
App.jsx
  -> data.js
  -> catalogTaxonomy
  -> CatalogSidebarNavigator
  -> DynamicGallery
      -> PatternCard
      -> StayInspired/newsletter-style modal behavior
      -> yardage calculator modal behavior
  -> PatternQuickViewModal
      -> CustomerGalleryAndReviews
      -> patternMediaManager
  -> PatternImageGallery
```

Customer commerce graph:

```text
App.jsx
  -> CheckoutDrawer
  -> WishlistDrawer
  -> TrackOrderModal
  -> MyOrdersSection
  -> ConsultationBookingModal
  -> StayInspiredNewsletter
```

## 8. Data sources and mock data

### 8.1 Seed catalogue

File: `src\data.js`

Exports:

- `SEWING_PATTERNS`
- `MASTER_SIZING_TABLE`

Purpose:

- Defines initial pattern data.
- Imports local pattern images.
- Generates a larger catalogue from seed patterns.
- Contains sizing data used by fitting/calculator components.

Important consumer modules:

- `src\App.jsx`
- `src\components\MannequinGuide.jsx`
- `src\components\FabricYardageCalculator.jsx`
- `src\components\MobileAppView.jsx`
- `src\components\subcomponents\CheckoutStore.jsx`
- `src\components\subcomponents\CollaboratorWorkspace.jsx`

### 8.2 Catalogue taxonomy

File: `src\data\catalogTaxonomy.js`

Exports:

- `PRODUCT_STATUS`
- `CATEGORY_REQUEST_STATUS`
- `CATALOG_AUDIENCES`
- `DEFAULT_COLLECTION_TAGS`
- `DEFAULT_DESIGNER_BRANDS`
- `slugifyCatalogValue`
- `getAudienceById`
- `getCategoriesForAudience`
- `getCategoryLabel`
- `getAudienceLabel`

Purpose:

- Gives the catalogue a structured taxonomy for audience/category/designer filters.
- Used by the catalogue sidebar and collaborator/product workflows.

Important consumers:

- `src\App.jsx`
- `src\components\CatalogSidebarNavigator.jsx`
- `src\components\CatalogCategoryNavigator.jsx`
- `src\components\subcomponents\CollaboratorWorkspace.jsx`

### 8.3 Measurement positions

File: `src\data_positions.js`

Exports:

- `MEASUREMENT_POSITIONS`

Purpose:

- Stores visual coordinates/metadata for body measurement markers.
- Used by fitting/mannequin components.

### 8.4 Media gallery and swatches

File: `src\lib\patternMediaManager.js`

Exports:

- `MEDIA_TYPES`
- `DEFAULT_MEDIA_GALLERY`
- `DEFAULT_FABRIC_SWATCHES`
- `getAllPatternSwatches`
- `getPatternSwatches`
- `savePatternSwatches`
- `addPatternSwatchItem`
- `deletePatternSwatchItem`
- `getAllPatternMedia`
- `getPatternMedia`
- `savePatternMedia`
- `toggleMediaVisibility`
- `addPatternMediaItem`
- `deletePatternMediaItem`

Storage keys:

- `sartorial_pattern_media_gallery`
- `sartorial_pattern_swatch_library`

Important consumers:

- `src\components\PatternQuickViewModal.jsx`
- `src\components\subcomponents\ProductDevelopmentMediaGallery.jsx`

### 8.5 Google/Firebase helper

File: `src\googleAuth.js`

Exports:

- `initAuth`
- `googleSignIn`
- `getAccessToken`
- `logout`
- `saveJsonToDrive`
- `saveTextToDrive`
- `listAppFilesFromDrive`
- `readJsonFromDrive`
- `deleteFileFromDrive`

Uses:

- Firebase app/auth.
- `firebase-applet-config.json` one level above `src`.

Important consumers:

- `src\components\MannequinGuide.jsx`
- `src\components\MobileAppView.jsx`

## 9. LocalStorage/cache map

This app relies heavily on browser storage. This is useful for demos but is also a key fragile area for production-like behavior.

### 9.1 Global/app shell keys

| Key | Owner | Purpose |
|---|---|---|
| `perfectfit_view_mode` | `src\App.jsx` | Desktop/mobile mode |
| `perfectfit_bureau_user` | `src\App.jsx` | Current user profile |
| `perfectfit_app_layout_metadata` | `src\App.jsx` | App section metadata |
| `perfectfit_app_layout_metadata_version` | `src\App.jsx` | Metadata reset version |
| `perfectfit_bureau_cart` | `src\App.jsx` | Cart items |
| `perfectfit_bureau_guest_orders` | `src\App.jsx` | Guest order history |
| `perfectfit_erp_patterns` | `src\App.jsx`, `DeveloperIntegrationModal.jsx` | Imported/synced pattern catalogue |
| `perfectfit_bureau_reviews` | `src\App.jsx` | Pattern reviews |
| `perfectfit_bureau_favorites` | `src\App.jsx` | Wishlist/favorites |
| `perfectfit_ui_login_dependent` | `src\App.jsx`, `AdminControlPanel.jsx`, `DynamicUiEngine.jsx` | Whether UI requires login |

### 9.2 Dynamic UI/admin keys

| Key | Owner | Purpose |
|---|---|---|
| `sartorial_ui_metadata` | `AdminControlPanel.jsx`, `DynamicUiEngine.jsx`, reset by `App.jsx` | Dynamic UI metadata |
| `sartorial_layout_rules` | `DynamicLayoutContext.jsx`, `PermissionsOverview.jsx`, `ProfessionalDashboard.jsx`, reset by `App.jsx` | Role-based layout permission rules |
| `sartorial_access_requests` | `AdminControlPanel.jsx`, `DynamicLayout.jsx`, `ProfessionalDashboard.jsx` | Permission/access requests |
| `sartorial_ui_render_mode` | `AdminControlPanel.jsx`, `DynamicUiEngine.jsx` | UI render mode |
| `atelier_hover_info_enabled` | `AdminControlPanel.jsx`, `PatternImageGallery.jsx` | Hover/helper information toggle |
| `perfectfit_layout_analytics_logs` | `useLayoutAnalytics.js` | Last 500 analytics events |

### 9.3 Catalogue/media keys

| Key | Owner | Purpose |
|---|---|---|
| `sartorial_pattern_media_gallery` | `patternMediaManager.js` | Pattern media entries |
| `sartorial_pattern_swatch_library` | `patternMediaManager.js` | Fabric swatches |
| `sartorial_atelier_fav_patterns` | `DynamicGallery.jsx` | Gallery-level favorites |
| `perfectfit_newsletter_modal_subscribed` | `DynamicGallery.jsx` | Newsletter modal subscribed flag |
| `perfectfit_newsletter_modal_dismissed` | `DynamicGallery.jsx` via `sessionStorage` | Newsletter modal dismissed for session |

### 9.4 Community/content keys

| Key | Owner | Purpose |
|---|---|---|
| `sartorial_showroom_posts` | `CreationsAndFeedback.jsx` | Community posts/customer creations |
| `sartorial_atelier_blog_posts` | `CreatorBlog.jsx` | Blog posts |
| `sartorial_testimonials` | `TestimonialCarousel.jsx` | Testimonials |
| `sartorial_newsletter_subscribers` | `StayInspiredNewsletter.jsx`, `MemberManagement.jsx`, `DynamicGallery.jsx` | Newsletter/member list |
| `perfectfit_newsletter_subscribers` | `MobileAppView.jsx` | Mobile newsletter list |

### 9.5 Workspace/project/inventory keys

| Key | Owner | Purpose |
|---|---|---|
| `sartorial_atelier_projects` | `CollaboratorWorkspace.jsx`, `DynamicProjectManager.jsx`, `ProfessionalDashboard.jsx` | Projects |
| `perfectfit_product_submissions` | `CollaboratorWorkspace.jsx` | Product submissions |
| `sartorial_atelier_inventory` | `CollaboratorWorkspace.jsx`, `ProfessionalDashboard.jsx` | Inventory |
| `sartorial_atelier_suppliers` | `CollaboratorWorkspace.jsx` | Suppliers |
| `sartorial_supply_orders` | `CollaboratorWorkspace.jsx` | Supply orders |
| `sartorial_collaborator_secrets` | `CollaboratorWorkspace.jsx` | Local collaborator secret/token-like data |
| `perfectfit_bureau_inventory` | `DynamicInventory.jsx` | Inventory ledger |
| `sartorial_erp_sales_history` | `CollaboratorSalesDashboard.jsx` | Sales history |
| `sartorial_atelier_imported_patterns` | `MyOrdersSection.jsx` | Imported pattern refs |
| `sartorial_atelier_saved_pattern_tags` | `MyOrdersSection.jsx` | Saved order/pattern tags |

### 9.6 Timer/motion/fabric keys

| Key | Owner | Purpose |
|---|---|---|
| `sartorial_sizing_profile` | `MannequinGuide.jsx` | User size/fitting profile |
| `sartorial_atelier_fabric_stash` | `FabricYardageCalculator.jsx` | Fabric stash |
| `sartorial_fabric_stash` | `SewingSessionTimer.jsx` | Fabric stash used by timer/project companion |
| `sartorial_fabric_stash_threshold` | `SewingSessionTimer.jsx` | Stash threshold |
| `sartorial_user_projects` | `SewingSessionTimer.jsx` | User projects |
| `sartorial_project_companion_data` | `SewingSessionTimer.jsx` | Project companion state |
| `sartorial_active_session_photo` | `SewingSessionTimer.jsx` | Active session photo |
| `sartorial_active_timer_notes` | `SewingSessionTimer.jsx` | Active timer notes |
| `sartorial_active_timer_pattern` | `SewingSessionTimer.jsx` | Active timer pattern |
| `sartorial_active_timer_running` | `SewingSessionTimer.jsx` | Timer running flag |
| `sartorial_active_timer_seconds` | `SewingSessionTimer.jsx` | Timer seconds |
| `sartorial_active_timer_step` | `SewingSessionTimer.jsx` | Active timer step |
| `sartorial_archived_projects` | `SewingSessionTimer.jsx` | Archived projects |
| `sartorial_shopping_notions` | `SewingSessionTimer.jsx` | Shopping list notions |
| `sartorial_shopping_patterns` | `SewingSessionTimer.jsx` | Shopping list patterns |
| `sartorial_shopping_widths` | `SewingSessionTimer.jsx` | Shopping fabric widths |
| `sartorial_timer_history_logs` | `SewingSessionTimer.jsx`, `ProfessionalDashboard.jsx` | Timer history |
| `perfectfit_pattern_tags` | `SewingSessionTimer.jsx` | Pattern tags |
| `sartorial_study_ops_${activePatternId}` | `TimeAndMotionStudy.jsx` | Per-pattern motion study operations |
| `sartorial_time_study_notes_${activePatternId}` | `TimeAndMotionStudy.jsx` | Per-pattern motion study notes |
| `sartorial_motion_tour_done_v1` | `TimeAndMotionStudy.jsx` | Motion study tour completion |

### 9.7 Browser cache/service worker behavior

`src\main.jsx`:

- clears `localStorage` and `sessionStorage` only when the recovery button is clicked;
- unregisters all service workers on startup;
- deletes all Cache Storage entries on startup.

`public\sw.js`:

- Exists in `public`, but the app runtime currently unregisters service workers.

## 10. UI lexicon / canonical naming dictionary

Use these exact names in future prompts to reduce ambiguity:

| Human wording | Canonical target |
|---|---|
| “whole app shell”, “root”, “navigation”, “desktop/mobile switch” | `src\App.jsx` |
| “homepage hero”, “top hero carousel” | `src\components\HeroCarousel.jsx` and metadata ID `hero-carousel` |
| “signature carousel”, “3D orbit cards”, “featured orbit” | `src\components\SignatureOrbitCarouselA.jsx` and metadata ID `orbital-featured` |
| “old orbit carousel” | `src\components\OrbitCarousel.jsx` |
| “alternative stack carousel” | `src\components\SignaturePerspectiveStackCarouselB.jsx` |
| “pattern catalogue”, “pattern gallery”, “library grid” | `src\components\subcomponents\DynamicGallery.jsx` |
| “catalogue sidebar filters” | `src\components\CatalogSidebarNavigator.jsx` |
| “category taxonomy” | `src\data\catalogTaxonomy.js` |
| “pattern card” | `src\components\PatternCard.jsx` |
| “quick view modal” | `src\components\PatternQuickViewModal.jsx` |
| “cart drawer”, “checkout panel” | `src\components\CheckoutDrawer.jsx` |
| “wishlist” | `src\components\WishlistDrawer.jsx` |
| “track order” | `src\components\TrackOrderModal.jsx` |
| “my orders page” | `src\components\MyOrdersSection.jsx` |
| “consultation booking” | `src\components\ConsultationBookingModal.jsx` |
| “workspace dashboard” | `src\components\DynamicLayout.jsx` |
| “dynamic workspace registry” | `src\components\ComponentRegistry.jsx` |
| “workspace permissions” | `src\rolePermissions.json` plus `DynamicLayoutContext.jsx` |
| “admin panel” | `src\components\AdminControlPanel.jsx` |
| “metadata UI engine” | `src\components\DynamicUiEngine.jsx` |
| “sizing/mannequin” | `src\components\MannequinGuide.jsx` |
| “sewing timer” | `src\components\SewingSessionTimer.jsx` |
| “time and motion” | `src\components\subcomponents\TimeAndMotionStudy.jsx` |
| “product media gallery” | `src\components\subcomponents\ProductDevelopmentMediaGallery.jsx` |
| “media persistence” | `src\lib\patternMediaManager.js` |
| “global theme/colors/fonts” | `src\index.css` |

## 11. Navigation and user flows

### 11.1 Homepage to catalogue

```text
Home view
  -> HeroCarousel CTA
  -> App.goToView("patterns")
  -> visibleSections selects metadata where view === "patterns"
  -> DynamicGallery renders
```

Target files:

- `src\App.jsx`
- `src\components\HeroCarousel.jsx`
- `src\components\subcomponents\DynamicGallery.jsx`

### 11.2 Catalogue filtering

```text
App catalogue filter state
  -> CatalogSidebarNavigator
  -> catalogTaxonomy
  -> DynamicGallery / PatternCard display
```

Target files:

- `src\App.jsx`
- `src\components\CatalogSidebarNavigator.jsx`
- `src\components\CatalogCategoryNavigator.jsx`
- `src\data\catalogTaxonomy.js`
- `src\components\subcomponents\DynamicGallery.jsx`
- `src\components\PatternCard.jsx`

### 11.3 Pattern quick view

```text
PatternCard or SignatureOrbitCarouselA
  -> App.setQuickViewPattern(pattern)
  -> PatternQuickViewModal
  -> patternMediaManager for media/swatches
```

Target files:

- `src\App.jsx`
- `src\components\PatternCard.jsx`
- `src\components\SignatureOrbitCarouselA.jsx`
- `src\components\PatternQuickViewModal.jsx`
- `src\lib\patternMediaManager.js`

### 11.4 Cart and checkout

```text
Pattern card / quick view add-to-cart
  -> App.handleAddToCart
  -> localStorage perfectfit_bureau_cart
  -> CheckoutDrawer
  -> App.handleOrderSuccess
  -> guestOrders / cart clear
```

Target files:

- `src\App.jsx`
- `src\components\CheckoutDrawer.jsx`
- `src\components\MyOrdersSection.jsx`
- `src\components\TrackOrderModal.jsx`

### 11.5 Wishlist

```text
Pattern favorite action
  -> App favorites state
  -> localStorage perfectfit_bureau_favorites
  -> WishlistDrawer
```

Target files:

- `src\App.jsx`
- `src\components\WishlistDrawer.jsx`
- `src\components\PatternCard.jsx`

### 11.6 Workspace/role-gated flow

```text
App currentUser
  -> RoleProvider
  -> RoleContext maps to visitor/member/partner/professional
  -> DynamicLayoutContext applies sartorial_layout_rules
  -> ComponentRegistry chooses modules
  -> DynamicLayout renders allowed workspace blocks
```

Target files:

- `src\App.jsx`
- `src\context\RoleContext.jsx`
- `src\context\DynamicLayoutContext.jsx`
- `src\components\ComponentRegistry.jsx`
- `src\components\DynamicLayout.jsx`
- `src\rolePermissions.json`

### 11.7 Admin console flow

```text
App currentUser.role administrator/admin/professional
  -> goToView("admin")
  -> administrator-console metadata
  -> AdminControlPanel
  -> DynamicUiEngine / layout permissions / analytics controls
```

Target files:

- `src\App.jsx`
- `src\components\AdminControlPanel.jsx`
- `src\components\DynamicUiEngine.jsx`
- `src\components\PerfectFitLayoutController.jsx`
- `src\components\subcomponents\PermissionsOverview.jsx`

## 12. Styling system map

### 12.1 Global CSS/theme

File: `src\index.css`

Fonts:

- Sans: `Outfit`
- Serif: `Cormorant Garamond`
- Mono: `JetBrains Mono`

Color token families:

- `sand`
- `clay`
- `sage`
- `bark`

Token examples:

- `--color-sand-50`
- `--color-clay-500`
- `--color-sage-700`
- `--color-bark-900`

Shadow tokens:

- `--shadow-bento`
- `--shadow-lux`

Radius tokens:

- `--radius-xs` through `--radius-4xl`

Other global styling:

- `html { scroll-behavior: smooth; }`
- `body` background uses `sand-50`; text uses `bark-900`.
- Custom webkit scrollbar styling.
- `.catalog-sidebar-scroll` custom scrollbar styling.
- `@keyframes shimmer`.

### 12.2 Styling model

Most component styling is inline Tailwind utility classes inside JSX.

Primary aesthetic:

- premium natural palette;
- warm neutral background;
- serif editorial headings;
- dense but polished Tailwind UI surfaces;
- motion-heavy transitions.

### 12.3 Styling fragility

Because most styling is inline in components, global harmonization requires touching many JSX files unless a shared component/token abstraction is introduced.

Future prompt target:

> “Harmonize only the visual utility classes in `src\components\SignatureOrbitCarouselA.jsx`; do not touch interaction logic.”

That phrasing is safer than “make the carousel better.”

## 13. Animation and interaction map

Animation libraries:

- Most files import from `motion/react`.
- `CatalogSidebarNavigator.jsx` imports from `framer-motion`, while `package.json` lists `motion`. This should be verified before relying on that component in clean installs.

Important motion-heavy components:

- `src\App.jsx`
- `src\components\AdminControlPanel.jsx`
- `src\components\ArOverlayVisualizer.jsx`
- `src\components\CheckoutDrawer.jsx`
- `src\components\CreationsAndFeedback.jsx`
- `src\components\DynamicLayout.jsx`
- `src\components\DynamicUiEngine.jsx`
- `src\components\FabricStashModal.jsx`
- `src\components\HeroCarousel.jsx`
- `src\components\MannequinGuide.jsx`
- `src\components\MobileAppView.jsx`
- `src\components\OrbitCarousel.jsx`
- `src\components\PatternCard.jsx`
- `src\components\PatternImageGallery.jsx`
- `src\components\PatternQuickViewModal.jsx`
- `src\components\SewingSessionTimer.jsx`
- `src\components\SignatureOrbitCarouselA.jsx`
- `src\components\SignaturePerspectiveStackCarouselB.jsx`
- `src\components\TestimonialCarousel.jsx`
- `src\components\subcomponents\DynamicGallery.jsx`
- `src\components\subcomponents\TimeAndMotionStudy.jsx`

Timer/async interaction hotspots:

- `App.jsx` uses multiple `setTimeout` calls for simulated loading, toast expiry, import/loading transitions, search blur handling, and modal transitions.
- `CreationsAndFeedback.jsx` uses intervals/timeouts for carousel behavior and post/review UI flows.
- `SewingSessionTimer.jsx` uses persistent timer state.
- `TimeAndMotionStudy.jsx` uses intervals/timeouts for live/simulated timing and onboarding.
- `TestimonialCarousel.jsx` uses carousel timing and local testimonial state.
- `CheckoutDrawer.jsx` uses simulated checkout timing.

Current carousel-specific note:

- `SignatureOrbitCarouselA.jsx` is the current “Signature Orbit Carousel A”.
- It is the correct target for arrow/click/quick-view behavior in the homepage featured carousel.
- `OrbitCarousel.jsx` is legacy/alternate and should not be changed for the current home orbit unless metadata is switched back to it.

## 14. Known warnings/errors and fragile areas

### 14.1 Dirty/untracked worktree

The repository already contains many modified, deleted, and untracked files. This report is based on the filesystem as discovered, not on a clean `git` baseline.

Future implementation prompts should begin with:

```text
First inspect git status. Preserve existing user changes. Do not revert unrelated modified or untracked files.
```

### 14.2 Duplicate section rendering logic in `App.jsx`

`App.jsx` contains both:

- `SECTION_RENDERERS`
- a later rendering switch inside `visibleSections.map`

This can create inconsistent behavior when a section is changed in one place but not the other.

### 14.3 Metadata reset can discard local layout/admin settings

Changing `APP_LAYOUT_METADATA_VERSION` triggers deletion of:

- `perfectfit_app_layout_metadata`
- `sartorial_ui_metadata`
- `sartorial_layout_rules`

This is useful for forcing new layouts, but risky if the user expects local admin layout changes to persist.

### 14.4 View naming mismatch risk

`creations-feedback` metadata has view text resembling `community feedback`, while navigation target references `community`. This should be checked before changing community navigation.

### 14.5 Service worker contradiction

`public\sw.js` exists, but `src\main.jsx` unregisters all service workers and clears browser caches on app load.

If future work expects offline/cache behavior, `main.jsx` is the first place to inspect.

### 14.6 LocalStorage is acting as a database

Many user, order, inventory, project, media, permission, and admin states are stored only in browser storage. This makes demos easy but can cause:

- stale UI after schema changes;
- cross-feature key collisions;
- behavior differences between users/browsers;
- hidden state that survives code changes;
- difficulty reproducing bugs.

### 14.7 Potential dependency mismatch

`CatalogSidebarNavigator.jsx` imports `framer-motion`, while `package.json` lists `motion`. This is worth verifying during a clean build/install.

### 14.8 Very large components

Several components are very large and carry multiple responsibilities:

- `SewingSessionTimer.jsx`
- `MannequinGuide.jsx`
- `CreationsAndFeedback.jsx`
- `PatternCard.jsx`
- `MobileAppView.jsx`
- `CollaboratorWorkspace.jsx`
- `AdminControlPanel.jsx`

For safe future edits, target small behavior changes and avoid broad rewrites.

### 14.9 Simulated async states can look like real backend operations

Some UI flows use timers and local storage rather than backend calls. This matters for bug reports that mention hanging/spinners or “working forever.”

## 15. Intervention guide

Use this section as a targeting guide for future prompts.

### 15.1 Change the homepage hero

Target:

- `src\components\HeroCarousel.jsx`
- `src\App.jsx` metadata ID `hero-carousel`

Avoid:

- `DynamicGallery.jsx`
- `OrbitCarousel.jsx`
- checkout/order files.

### 15.2 Change the signature orbit carousel

Target:

- `src\components\SignatureOrbitCarouselA.jsx`
- `src\App.jsx` metadata ID `orbital-featured`

If changing which patterns appear:

- inspect the pattern slice passed from `App.jsx`;
- inspect `SEWING_PATTERNS` / `perfectfit_erp_patterns`.

### 15.3 Change catalogue/sidebar filters

Target:

- `src\App.jsx`
- `src\components\CatalogSidebarNavigator.jsx`
- `src\components\CatalogCategoryNavigator.jsx`
- `src\data\catalogTaxonomy.js`
- `src\components\subcomponents\DynamicGallery.jsx`

### 15.4 Change pattern card visual/details

Target:

- `src\components\PatternCard.jsx`

If the same field appears in quick view:

- also target `src\components\PatternQuickViewModal.jsx`.

### 15.5 Change quick view behavior

Target:

- `src\App.jsx` quick view state and callbacks
- `src\components\PatternQuickViewModal.jsx`
- carousel/card components that call `onQuickView`

### 15.6 Change checkout/cart flow

Target:

- `src\App.jsx`
- `src\components\CheckoutDrawer.jsx`
- `src\components\MyOrdersSection.jsx`
- `src\components\TrackOrderModal.jsx`

### 15.7 Change workspace permissions

Target:

- `src\rolePermissions.json`
- `src\context\DynamicLayoutContext.jsx`
- `src\components\ComponentRegistry.jsx`
- `src\components\DynamicLayout.jsx`
- `src\components\subcomponents\PermissionsOverview.jsx`

### 15.8 Change admin UI metadata behavior

Target:

- `src\components\AdminControlPanel.jsx`
- `src\components\DynamicUiEngine.jsx`
- `src\components\PerfectFitLayoutController.jsx`
- `src\App.jsx` layout metadata constants

### 15.9 Change global colors/fonts/scrollbar

Target:

- `src\index.css`

If changing full visual style:

- expect many Tailwind class edits across component JSX.

### 15.10 Change data seed or generated products

Target:

- `src\data.js`
- `src\data\catalogTaxonomy.js`

If imported ERP data is overriding seeds:

- inspect `perfectfit_erp_patterns` localStorage behavior in `App.jsx`.

## 16. Architecture observations

1. **The app is metadata-aware but not fully metadata-driven.**  
   Section ordering/visibility is metadata-driven, but many component layouts, labels, and workflows are still hardcoded in JSX.

2. **`App.jsx` is doing too much.**  
   It owns routing, persistence, catalogue filtering, layout metadata, cart/order state, modal state, admin entry, and render dispatch.

3. **The dynamic workspace system is the most reusable architecture unit.**  
   `ComponentRegistry` + `RoleContext` + `DynamicLayoutContext` is a real framework for role-aware modules.

4. **The storefront and workspace share state mostly through `App.jsx` and localStorage.**  
   There is no central server-backed domain model in this frontend.

5. **The current UI is visually cohesive but implementation is spread out.**  
   Global theme tokens exist, but most visual decisions live in Tailwind utility classes inside components.

6. **LocalStorage keys need governance before production hardening.**  
   Many keys use `perfectfit_*` and `sartorial_*` naming mixed together.

7. **Future work should separate “which component renders” from “how the component renders.”**  
   Metadata can determine visible sections, but each component should still own its local presentation.

## 17. Recommended naming for future prompts

Top 20 canonical names:

1. `App Shell / Root Orchestrator` — `src\App.jsx`
2. `Homepage Hero Carousel` — `src\components\HeroCarousel.jsx`
3. `Signature Orbit Carousel A` — `src\components\SignatureOrbitCarouselA.jsx`
4. `Signature Perspective Stack Carousel B` — `src\components\SignaturePerspectiveStackCarouselB.jsx`
5. `Legacy Orbit Carousel` — `src\components\OrbitCarousel.jsx`
6. `Dynamic Pattern Gallery` — `src\components\subcomponents\DynamicGallery.jsx`
7. `Catalogue Sidebar Navigator` — `src\components\CatalogSidebarNavigator.jsx`
8. `Catalogue Taxonomy` — `src\data\catalogTaxonomy.js`
9. `Pattern Card` — `src\components\PatternCard.jsx`
10. `Pattern Quick View Modal` — `src\components\PatternQuickViewModal.jsx`
11. `Checkout Drawer` — `src\components\CheckoutDrawer.jsx`
12. `Wishlist Drawer` — `src\components\WishlistDrawer.jsx`
13. `My Orders Section` — `src\components\MyOrdersSection.jsx`
14. `Dynamic Workspace Layout` — `src\components\DynamicLayout.jsx`
15. `Workspace Component Registry` — `src\components\ComponentRegistry.jsx`
16. `Dynamic Layout Context` — `src\context\DynamicLayoutContext.jsx`
17. `Role Context` — `src\context\RoleContext.jsx`
18. `Admin Control Panel` — `src\components\AdminControlPanel.jsx`
19. `Mannequin Guide / Sizing Workspace` — `src\components\MannequinGuide.jsx`
20. `Sewing Session Timer` — `src\components\SewingSessionTimer.jsx`

Example safe prompt:

```text
In D:\Projects\EIP\eip-core\apps\samara-web\my-vite-react-app, update only the Signature Orbit Carousel A interaction logic in src\components\SignatureOrbitCarouselA.jsx. Do not modify App.jsx, styling outside that component, catalogue/sidebar files, or data files.
```

Example safe prompt for metadata:

```text
In src\App.jsx, update only DEFAULT_APP_LAYOUT_METADATA for the section ID orbital-featured. Do not change component implementation files.
```

Example safe prompt for catalogue:

```text
Update the catalogue taxonomy in src\data\catalogTaxonomy.js and the filter UI in src\components\CatalogSidebarNavigator.jsx. Do not change PatternCard, checkout, or homepage carousel files.
```

## 18. ChatGPT handoff summary

The frontend at `D:\Projects\EIP\eip-core\apps\samara-web\my-vite-react-app` is a React 19 + Vite app. The entry point is `src\main.jsx`, which wraps `src\App.jsx` in an error boundary, unregisters service workers, and clears Cache Storage. Global theme tokens live in `src\index.css` using Tailwind v4, Google fonts, and natural color families `sand`, `clay`, `sage`, and `bark`.

`src\App.jsx` is the main orchestrator. It manages view navigation through `activeView`, not through a router. It stores cart, favorites, guest orders, user profile, reviews, layout metadata, and imported ERP patterns in localStorage. It defines `DEFAULT_APP_LAYOUT_METADATA`, which controls visible sections such as `hero-carousel`, `orbital-featured`, `gallery`, `my-orders`, `dynamic-metadata-ui`, `role-based-dynamic-layout`, and `administrator-console`.

The current homepage hero is `src\components\HeroCarousel.jsx`. The current premium featured carousel is `src\components\SignatureOrbitCarouselA.jsx`, not the old `OrbitCarousel.jsx`. Pattern catalogue UI is mostly `src\components\subcomponents\DynamicGallery.jsx`, with filters in `src\components\CatalogSidebarNavigator.jsx` and taxonomy in `src\data\catalogTaxonomy.js`. Pattern quick view is `src\components\PatternQuickViewModal.jsx`.

The role-gated workspace is built from `src\components\ComponentRegistry.jsx`, `src\context\RoleContext.jsx`, `src\context\DynamicLayoutContext.jsx`, `src\components\DynamicLayout.jsx`, and `src\rolePermissions.json`. Registered workspace modules include gallery, checkout store, collaborator workspace, inventory, professional dashboard, permissions overview, and analytics.

Major fragile areas: `App.jsx` contains duplicated section rendering logic; many flows use localStorage as a mock database; service worker file exists but is unregistered by `main.jsx`; metadata version bumps delete stored layout and permission rules; some components are very large; `CatalogSidebarNavigator.jsx` imports `framer-motion` while dependencies list `motion`.

For future prompts, always name exact files and say what must not be touched. The worktree was already dirty before this report, so future implementation should inspect `git status` first and preserve unrelated user changes.

