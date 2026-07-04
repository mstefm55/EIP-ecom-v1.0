import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import "./App.css";
import "flag-icons/css/flag-icons.min.css";
import { getCountryCallingCode } from "libphonenumber-js";

import {
  createBlogPost,
  cancelCheckoutSession,
  deleteBlogPost,
  createCheckoutSession,
  confirmCheckoutSession,
  createOrder,
  createProductReview,
  createSubscriber,
  fetchBlogPosts,
  fetchCheckoutConfig,
  fetchCheckoutSession,
  fetchPaymentMethods,
  fetchMemberHistory,
  fetchMemberMe,
  fetchCatalog,
  fetchCountries,
  fetchTradeConditions,
  fetchProductByCode,
  fetchProductReviews,
  fetchStorefrontContent,
  fetchStorefrontContentList,
  fetchStorefrontFx,
  fetchStorefrontLocales,
  logoutMember,
  resolveAssetUrl,
  startMemberAuth,
  updateMemberProfile,
  uploadMemberBlogAsset,
  verifyMemberAuth,
} from "./services/api";
import { EIP_CONFIG } from "./config/eip";
import {
  ActionMiniModal,
  FeaturedCoverflow,
  HeroViewportSlider,
  ImageAssetStudioModal,
} from "./component-library";

import heroImage from "./assets/hero/slide1.jpg";
import dropMain from "./assets/hero/pexels-aydin-sefidi-41034179-12367369.jpg";
import dropSideA from "./assets/hero/pexels-olly-837140.jpg";
import dropSideB from "./assets/hero/pexels-eliasdecarvalho-1144834.jpg";
import dropSideC from "./assets/hero/pexels-alipazani-12513869.jpg";
import communityImg from "./assets/notebook_spread_real_01.png";
import searchIcon from "./assets/magnifying-glass-thin.svg";
import globeIcon from "./assets/globe.svg";
import paypalPaymentLogo from "./assets/fontawesome-free-6.6.0-web/svgs/brands/paypal.svg";
import googlePayPaymentLogo from "./assets/fontawesome-free-6.6.0-web/svgs/brands/google-pay.svg";
import applePayPaymentLogo from "./assets/fontawesome-free-6.6.0-web/svgs/brands/apple-pay.svg";
import cardPaymentLogo from "./assets/fontawesome-free-6.6.0-web/svgs/regular/credit-card.svg";

import pattern1 from "./assets/hero/slide3.jpg";
import pattern2 from "./assets/hero/slide2.jpg";
import pattern3 from "./assets/hero/slide1.jpg";
import pattern4 from "./assets/hero/pexels-olly-837140.jpg";
import pattern5 from "./assets/hero/pexels-aydin-sefidi-41034179-12367369.jpg";
import pattern6 from "./assets/hero/pexels-eliasdecarvalho-1144834.jpg";
import pattern7 from "./assets/ChatGPT Image Dec 14, 2025, 10_21_31 PM.png";
import pattern8 from "./assets/ChatGPT Image Dec 14, 2025, 10_21_49 PM.png";
import pattern9 from "./assets/ChatGPT Image Dec 14, 2025, 10_22_11 PM.png";
import pattern10 from "./assets/ChatGPT Image Oct 8, 2025, 11_04_27 PM.png";
import pattern11 from "./assets/ChatGPT Image Oct 8, 2025, 11_04_32 PM.png";
import pattern12 from "./assets/ChatGPT Image Oct 8, 2025, 11_04_37 PM.png";
import sizeDummy from "./assets/Dummy.png";

const DEFAULT_LANGUAGE_OPTIONS = [
  { code: "en", label: "EN" },
];
const DEFAULT_STOREFRONT_FX = {
  fx: {
    enabled: false,
    auto_sync: true,
    base_currency: "USD",
    status: "pending",
    last_sync_at: null,
    last_provider: null,
    last_error: null,
  },
  marketplaces: [],
};

function normalizeLocaleCode(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!normalized) return "";
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(normalized)) return "";
  return normalized;
}

function isLocaleCodeKey(value) {
  return Boolean(normalizeLocaleCode(value));
}

const translationPayloadCache = new WeakMap();

function parseStoredTranslationPayload(meta) {
  if (!meta || typeof meta !== "object") {
    return { sourceLocale: "en", byLocale: {} };
  }
  if (translationPayloadCache.has(meta)) {
    return translationPayloadCache.get(meta);
  }

  const sourceLocale =
    normalizeLocaleCode(meta.source_locale || meta.source_language || "en") || "en";
  const raw =
    meta.translations && typeof meta.translations === "object"
      ? meta.translations
      : meta;
  const byLocale = {};

  const assign = (locale, path, value) => {
    const localeCode = normalizeLocaleCode(locale);
    const key = String(path || "").trim();
    const text = String(value ?? "").trim();
    if (!localeCode || !key || !text) return;
    if (!byLocale[localeCode]) byLocale[localeCode] = {};
    byLocale[localeCode][key] = text;
  };

  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      if (isLocaleCodeKey(key)) {
        for (const [path, translated] of Object.entries(value)) {
          assign(key, path, translated);
        }
        continue;
      }
      for (const [locale, translated] of Object.entries(value)) {
        if (!isLocaleCodeKey(locale)) continue;
        assign(locale, key, translated);
      }
    }
  }

  const parsed = { sourceLocale, byLocale };
  translationPayloadCache.set(meta, parsed);
  return parsed;
}

function resolveTranslatedPath(meta, path, lang = "en") {
  const key = String(path || "").trim();
  if (!key || !meta || typeof meta !== "object") return "";
  const { sourceLocale, byLocale } = parseStoredTranslationPayload(meta);
  const normalized = normalizeLocaleCode(lang) || sourceLocale || "en";
  const base = normalized.split("-")[0];
  const candidates = [normalized, base, sourceLocale, "en"].filter(Boolean);
  for (const localeCode of candidates) {
    const localeBucket = byLocale[localeCode];
    const text = localeBucket && typeof localeBucket === "object" ? localeBucket[key] : "";
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return "";
}

function getItemTranslationMeta(item) {
  const attrs = item?.raw?.attrs && typeof item.raw.attrs === "object"
    ? item.raw.attrs
    : item?.attrs && typeof item.attrs === "object"
      ? item.attrs
      : {};
  if (attrs.translation && typeof attrs.translation === "object") {
    return attrs.translation;
  }
  if (item?.translation && typeof item.translation === "object") {
    return item.translation;
  }
  return null;
}

function normalizeLanguageOptions(input, fallback = DEFAULT_LANGUAGE_OPTIONS) {
  const seed = Array.isArray(fallback) ? fallback : [];
  const source = Array.isArray(input) ? input : [];
  const map = new Map();
  for (const item of [...source, ...seed]) {
    const code = normalizeLocaleCode(item?.code);
    if (!code || map.has(code)) continue;
    const shortCode = code.split("-")[0].toUpperCase();
    map.set(code, {
      code,
      label: shortCode || code.toUpperCase()
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function buildMarketplaceOptions(storefrontFx, countryOptions = [], languageOptions = []) {
  const marketplaces = Array.isArray(storefrontFx?.marketplaces) ? storefrontFx.marketplaces : [];
  if (!marketplaces.length) return [];

  const countriesByIso = new Map(
    (Array.isArray(countryOptions) ? countryOptions : [])
      .map((entry) => [normalizeIso(entry?.iso), String(entry?.name || "").trim()])
      .filter(([iso, name]) => iso && name)
  );
  const localeLabels = new Map(
    (Array.isArray(languageOptions) ? languageOptions : [])
      .map((entry) => [normalizeLocaleCode(entry?.code), String(entry?.label || "").trim()])
      .filter(([code, label]) => code && label)
  );

  return marketplaces
    .map((entry) => {
      const jurisdiction = normalizeIso(entry?.jurisdiction_code);
      if (!jurisdiction) return null;
      const locale =
        normalizeLocaleCode(entry?.primary_locale) ||
        normalizeLocaleCode(Array.isArray(entry?.allowed_locales) ? entry.allowed_locales[0] : "") ||
        "en";
      const localeShort = (localeLabels.get(locale) || locale.split("-")[0] || "EN").toUpperCase();
      const currency = normalizeCurrencyCode(entry?.currency || "USD", "USD");
      const countryName = countriesByIso.get(jurisdiction) || jurisdiction;
      return {
        code: jurisdiction,
        locale,
        currency,
        exchangeRate: Number(entry?.exchange_rate),
        label: `${countryName} (${jurisdiction}) - ${localeShort} - ${currency}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeIso(isoCode) {
  return String(isoCode || "").trim().toUpperCase();
}

function isValidIso(isoCode) {
  const iso = normalizeIso(isoCode);
  return /^[A-Z]{2}$/.test(iso);
}

function resolveDialCode(isoCode, fallbackDial = "") {
  const iso = normalizeIso(isoCode);
  if (!isValidIso(iso)) return fallbackDial || "";
  if (fallbackDial) return fallbackDial;
  try {
    const callingCode = getCountryCallingCode(iso);
    return callingCode ? `+${callingCode}` : "";
  } catch {
    return "";
  }
}

function FlagMark({ iso }) {
  if (!isValidIso(iso)) return null;
  const code = normalizeIso(iso).toLowerCase();
  return <span className={`fi fi-${code} flag-mark`} aria-hidden="true" />;
}

const FALLBACK_COUNTRY_OPTIONS = [
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "KG", name: "Kyrgyzstan", dial: "+996" },
  { iso: "RU", name: "Russia", dial: "+7" },
  { iso: "ES", name: "Spain", dial: "+34" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "US", name: "United States", dial: "+1" },
];

const DEFAULT_COUNTRY_OPTIONS = FALLBACK_COUNTRY_OPTIONS.map((item) => ({
  ...item,
  iso: normalizeIso(item.iso),
}));
const DEFAULT_COUNTRY_ISO = DEFAULT_COUNTRY_OPTIONS[0]?.iso || "US";
const DEFAULT_CHECKOUT_METHODS = [];
const DEFAULT_CHECKOUT_CONFIG = {
  payment: {
    methods: DEFAULT_CHECKOUT_METHODS,
    enabled_methods: [],
    ready_methods: [],
  },
};

function normalizePaymentMethodCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["card", "credit_card", "creditcard", "bank_card"].includes(normalized)) return "card";
  if (["paypal", "pay_pal"].includes(normalized)) return "paypal";
  if (["applepay", "apple_pay", "apple", "apple_wallet"].includes(normalized)) return "apple_pay";
  if (["app", "app_pay", "googlepay", "google_pay", "wallet"].includes(normalized)) return "google_pay";
  if (["manual", "manual_test", "test"].includes(normalized)) return "manual_test";
  return normalized;
}

function normalizeCheckoutConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  const payment = source.payment && typeof source.payment === "object" ? source.payment : {};
  const sourceMethods = Array.isArray(payment.methods) ? payment.methods : [];
  const defaultsByCode = new Map(DEFAULT_CHECKOUT_METHODS.map((item) => [item.code, item]));
  const methods = [];
  const seen = new Set();

  for (const item of sourceMethods) {
    if (!item || typeof item !== "object") continue;
    const code = normalizePaymentMethodCode(item.code || item.methodCode || item.method || item.id);
    const fallback = defaultsByCode.get(code) || {};
    const providerCode = String(
      item.provider_code || item.providerCode || fallback.provider_code || ""
    ).trim().toLowerCase();
    const optionKey = `${providerCode || "unassigned"}::${code}`;
    if (!code || seen.has(optionKey)) continue;
    seen.add(optionKey);
    methods.push({
      code,
      label: String(item.label || fallback.label || code.toUpperCase()).trim(),
      enabled: item.enabled !== false,
      available: item.available !== false,
      reason: item.reason || null,
      provider_code: providerCode || null,
      provider_label: item.provider_label || item.providerLabel || fallback.provider_label || null,
      provider_priority: Number(item.provider_priority ?? item.providerPriority ?? fallback.provider_priority ?? 0),
      priority: Number(item.priority ?? fallback.priority ?? 0),
      visible: item.visible !== false,
      mode: item.mode || item.environment || null,
      status: item.status || item.reason || null,
      readiness_state: item.readiness_state || item.readinessState || null,
      readiness_label: item.readiness_label || item.readinessLabel || null,
      status_label: item.status_label || item.statusLabel || item.readiness_label || item.readinessLabel || null,
    });
  }

  methods.sort((a, b) =>
    a.provider_priority - b.provider_priority || a.priority - b.priority || a.label.localeCompare(b.label)
  );

  const enabledMethods = Array.isArray(payment.enabled_methods) && payment.enabled_methods.length
    ? payment.enabled_methods.map(normalizePaymentMethodCode).filter(Boolean)
    : methods.filter((item) => item.enabled).map((item) => item.code);
  const readyMethods = Array.isArray(payment.ready_methods)
    ? payment.ready_methods.map(normalizePaymentMethodCode).filter(Boolean)
    : methods
        .filter((item) => item.enabled !== false && item.available !== false)
        .map((item) => item.code);

  return {
    payment: {
      methods: methods.filter((item) => item.visible !== false),
      enabled_methods: enabledMethods,
      ready_methods: readyMethods,
    },
  };
}

function humanizePaymentReason(reason) {
  const normalized = String(reason || "").trim().toLowerCase();
  if (normalized === "payment_method_disabled") return "disabled";
  if (normalized === "checkout_source_missing") return "checkout source missing";
  if (normalized === "browser_amount_not_accepted") return "server amount required";
  return normalized ? normalized.replace(/_/g, " ") : "not available";
}

function friendlyCheckoutError(error, fallback) {
  const message = String(error?.message || "");
  const match = message.match(/API Error \(\d+\):\s*(.*)$/);
  if (match) {
    try {
      const payload = JSON.parse(match[1]);
      return humanizePaymentReason(payload?.error || payload?.reason || fallback);
    } catch {
      return match[1] || fallback;
    }
  }
  return message || fallback;
}

function trustedPaypalRedirectUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && (hostname === "paypal.com" || hostname.endsWith(".paypal.com"))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

const PAYPAL_CHECKOUT_WINDOW_NAME = "samara-paypal-checkout";
const PAYPAL_CHECKOUT_MESSAGE_TYPE = "samara:paypal-checkout-complete";

function openPaypalCheckoutTab() {
  if (typeof window === "undefined") return null;
  const checkoutTab = window.open(
    "about:blank",
    PAYPAL_CHECKOUT_WINDOW_NAME,
    "popup=yes,width=560,height=760,resizable=yes,scrollbars=yes"
  );
  if (!checkoutTab) return null;
  try {
    checkoutTab.focus();
    checkoutTab.document.title = "Preparing PayPal checkout";
    checkoutTab.document.body.textContent = "";
    const message = checkoutTab.document.createElement("p");
    message.textContent = "Preparing PayPal checkout... Please keep this tab open.";
    message.style.cssText = "font-family:system-ui,sans-serif;padding:2rem;color:#2f261f";
    checkoutTab.document.body.appendChild(message);
  } catch {
    // The reserved tab can still be navigated if its placeholder cannot be styled.
  }
  return checkoutTab;
}

function notifyPaypalCheckoutOpener(payload = {}) {
  if (typeof window === "undefined" || !window.opener || window.opener.closed) return false;
  window.opener.postMessage(
    {
      type: PAYPAL_CHECKOUT_MESSAGE_TYPE,
      paymentCode: String(payload.paymentCode || ""),
      orderCode: String(payload.orderCode || ""),
      lifecycle: String(payload.lifecycle || "pending"),
    },
    window.location.origin
  );
  return true;
}

const PAYMENT_METHOD_LOGOS = Object.freeze({
  card: cardPaymentLogo,
  paypal: paypalPaymentLogo,
  google_pay: googlePayPaymentLogo,
  apple_pay: applePayPaymentLogo,
});

function PaymentMethodLogo({ methodCode, label }) {
  const normalized = normalizePaymentMethodCode(methodCode);
  const logo = PAYMENT_METHOD_LOGOS[normalized];
  if (logo) {
    return <img className="payment-method-logo" src={logo} alt="" aria-hidden="true" />;
  }
  const initials = String(label || normalized || "Pay")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <span className="payment-method-logo-fallback" aria-hidden="true">{initials || "P"}</span>;
}

function paymentMethodBrandClass(methodCode) {
  const normalized = normalizePaymentMethodCode(methodCode);
  if (["card", "paypal", "google_pay", "apple_pay"].includes(normalized)) return normalized.replace(/_/g, "-");
  return "provider";
}

function buildCheckoutFormDefaults(countryIso = DEFAULT_COUNTRY_ISO) {
  return {
    name: "",
    email: "",
    phone: "",
    delivery_country: countryIso,
    delivery_address1: "",
    delivery_address2: "",
    delivery_city: "",
    delivery_region: "",
    delivery_postcode: "",
    billing_same_as_delivery: true,
    billing_country: countryIso,
    billing_address1: "",
    billing_address2: "",
    billing_city: "",
    billing_region: "",
    billing_postcode: "",
    payment_method: "",
    payment_provider: "",
    app_handle: "",
  };
}

const PHONE_DIGITS_REGEX = /^[0-9]{7,15}$/;
const PHONE_ALLOWED_REGEX = /^[0-9+\s().-]*$/;

function sanitizePhoneWithOptionalPlus(value) {
  const raw = String(value || "");
  let cleaned = raw.replace(/[^0-9+\s().-]/g, "");
  if (cleaned.startsWith("+")) {
    cleaned = `+${cleaned.slice(1).replace(/\+/g, "")}`;
  } else {
    cleaned = cleaned.replace(/\+/g, "");
  }
  return cleaned.slice(0, 24);
}

function sanitizeLocalPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidPhone(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return true;
  if (!PHONE_ALLOWED_REGEX.test(normalized)) return false;
  return PHONE_DIGITS_REGEX.test(phoneDigits(normalized));
}

function toNumericAmount(...values) {
  for (const raw of values) {
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    const text = String(raw).trim();
    if (!text) continue;
    const normalized = text
      .replace(/[A-Za-z]/g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.\-]/g, "");
    if (!normalized) continue;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

const COPY = {
  en: {
    nav: {
      patterns: "Patterns",
      pages: "Pages",
      sizes: "Sizes",
      blog: "Blog",
      line: "Line",
      learning: "Learning",
      collab: "Collab Shop",
      search: "Search",
      cart: "Cart",
      account: "Account",
      signIn: "Sign in",
      signOut: "Sign out",
      language: "Language",
    },
    hero: {
      kicker: "Trend-Forward",
      title: "Patterns to Sew Your Style",
      subtitle: "Premium patterns for the new generation of makers.",
      shop: "Shop Patterns",
      lookbook: "View Lookbook",
    },
    drop: {
      kicker: "The Drop",
      title: "Featured Patterns",
      subtitle: "Explore our signature digital sewing patterns.",
      productTitle: "Oversized Cropped Jacket",
      productMeta: "PDF Pattern - Sizes XS-XL",
      cta: "Shop The Drop",
      tag: "4 New Patterns",
    },
    worth: {
      title: "Patterns Worth Making",
      subtitle: "Explore our signature digital sewing patterns.",
      cta: "Shop All Patterns",
    },
    process: {
      title: "Our Process",
      steps: {
        concept: { title: "Concept", desc: "Sketch to stitch" },
        grading: { title: "Modern grading", desc: "Inclusive sizing" },
        mockups: { title: "Mockups", desc: "Tested and refined" },
        finishing: { title: "Finishing", desc: "Ready to make" },
      },
    },
    community: {
      kicker: "Handcrafted and tested by real sewists.",
      title: "Join Our Creative Community",
      point1: "Exclusive patterns, in soberbie",
      point2: "Sewing tips and commuted",
      point3: "Close-knit community",
      lookbook: "Download Lookbook",
      subscribe: "Subscribe",
    },
    patterns: {
      title: "Patterns",
      subtitle: "Artfully crafted PDF and printed sewing patterns for modern makers.",
      view: "View Pattern",
      order: "Order",
      showing: "Showing 16 of 64 patterns",
      showingRange: "Showing {start}-{end} patterns",
      refreshing: "Refreshing catalogue…",
      empty: "No products available yet.",
    },
    product: {
      back: "Back to patterns",
      buyNow: "Buy now",
      orderNow: "Order now",
      docs: "Pattern files",
      details: "Product details",
      noDocs: "No downloadable files yet.",
      shipping: "Instant digital delivery after payment.",
      secure: "Secure checkout powered by EIP.",
      reviewCount: "{count} ratings",
    },
    reviews: {
      title: "Customer reviews",
      subtitle: "Verified makers share fit notes and sewing experience.",
      empty: "No reviews yet. Be the first to share your feedback.",
      writeTitle: "Write a review",
      writeHint: "Keep your review practical and respectful.",
      rating: "Rating",
      headline: "Headline",
      comment: "Comment",
      name: "Name",
      email: "Email (optional)",
      submit: "Submit review",
      submitting: "Submitting...",
      success: "Thanks. Your review was submitted.",
      pending: "Your review is pending moderation."
    },
    filters: {
      category: "Category",
      all: "All",
      dresses: "Dresses",
      tops: "Tops",
      bottoms: "Bottoms",
      difficulty: "Difficulty",
      beginner: "Beginner",
      intermediate: "Intermediate",
      advanced: "Advanced",
      sortBy: "Sort By",
      featured: "Featured",
      newest: "Newest",
      price: "Price",
    },
    pagination: {
      next: "Next",
    },
    footer: {
      concept: "Concept",
      rizes: "Rizes",
      blog: "Blog",
      faqs: "FAQs",
      learning: "Learning",
    },
    gateway: {
      connecting: "Gateway: connecting",
      connected: "Gateway: connected",
      manifestPending: "Gateway: connected (manifest pending)",
      offline: "Gateway: offline",
    },
    modals: {
      subscribe: {
        title: "Join the community",
        subtitle: "Get updates, drops, and pattern previews.",
        name: "Name",
        email: "Email",
        phone: "Phone (optional)",
        success: "Subscribed. Thank you!",
        submit: "Subscribe",
        submitting: "Submitting...",
        cancel: "Cancel",
      },
      order: {
        title: "Place order",
        quantity: "Quantity",
        name: "Name",
        email: "Email",
        phone: "Phone (optional)",
        success: "Order submitted. Reference: {code}",
        pending: "pending",
        submit: "Submit order",
        submitting: "Submitting...",
        cancel: "Cancel",
      },
    },
    cart: {
      title: "Your cart",
      empty: "Your cart is empty.",
      qty: "Qty",
      subtotal: "Subtotal",
      checkout: "Checkout",
      checkingOut: "Processing...",
      clear: "Clear cart",
      close: "Close",
      remove: "Remove",
      add: "Add to cart",
      checkoutNow: "Checkout now",
      success: "Order submitted. Reference: {code}",
      pending: "pending",
      details: "Buyer details",
      deliveryTitle: "Delivery address",
      billingTitle: "Billing address",
      sameAsDelivery: "Billing address is same as delivery",
      address1: "Address line 1",
      address2: "Address line 2",
      city: "City",
      region: "Region / State",
      postcode: "Postcode",
      country: "Country",
      paymentTitle: "Payment",
      paymentMethod: "Payment method",
      paymentMethodCard: "Credit card",
      paymentMethodPaypal: "PayPal",
      paymentMethodGooglePay: "Google Pay",
      paymentMethodApplePay: "Apple Pay",
      paymentMethodManualTest: "Sandbox manual test",
      paymentProviderNotice: "This method opens a governed checkout session. No raw card details are collected by EIP.",
      cardName: "Name on card",
      cardNumber: "Card number",
      cardExpiry: "Expiry (MM/YY)",
      cardCvc: "CVC",
      paypalEmail: "PayPal email",
      appHandle: "Wallet / app handle",
      paymentSuccess: "Payment registered. Reference: {code}",
      unknownPrice: "Final pricing will be confirmed at checkout.",
      mixedCurrency: "Cart contains mixed currencies. Use one currency per order.",
    },
    auth: {
      title: "Member sign in",
      subtitle: "Enter username or email plus password, then continue with secure magic link.",
      credential: "Username or email",
      password: "Password",
      email: "Email (optional, needed when registering by username)",
      name: "Name (optional)",
      submit: "Send magic link",
      submitting: "Sending...",
      close: "Close",
      sent: "Magic link sent. Check your inbox.",
      verifyFailed: "Sign-in link is invalid or expired.",
      sessionExpired: "Session expired. Sign in again.",
      statusReady: "Signed in as {name}",
    },
    account: {
      title: "Account activity",
      subtitle: "Track orders, creator activity, and account status.",
      orders: "Order history",
      noOrders: "No orders yet.",
      patterns: "My patterns",
      patternsHint: "Pattern submissions panel will be enabled next phase.",
      blogs: "Blog contributions",
      blogsHint: "Blog contribution workflow will be enabled next phase.",
      signInPrompt: "Sign in to open your account activity.",
      totalSpent: "Total spent",
      patternSales: "Pattern sales",
      commission: "Commission",
      comingSoonValue: "Coming soon",
      comingSoonHint: "This section is being prepared and will be connected to live content soon.",
    },
    errors: {
      subscribeRequiresConnection: "Connect EIP before subscribing.",
      subscribeMissing: "Add at least an email or phone.",
      orderMissing: "Select a live product to order.",
      subscribeFailed: "Subscription failed.",
      orderFailed: "Order failed.",
      paymentFailed: "Payment failed.",
      paymentMethodUnavailable: "Selected payment method is unavailable.",
      cartEmpty: "Add at least one product to cart.",
      checkoutRequiresConnection: "Connect EIP before checkout.",
      reviewMissing: "Add a rating and comment before submitting.",
      reviewFailed: "Review submission failed.",
    },
    alerts: {
      connectEip: "Connect EIP by setting VITE_EIP_ENDPOINT to enable live products.",
      refreshingFeatured: "Refreshing featured products…",
    },
    products: {
      worth: {
        checkeredTop: { name: "Checkered Top", meta: "PDF Pattern - 05-200" },
        cargoPants: { name: "Cargo Pants", meta: "PDF Pattern - 03-93" },
        sundress: { name: "Sundress", meta: "PDF Pattern - 05-52" },
        tieFrontTop: { name: "Tie-Front Top", meta: "PDF Pattern - 30" },
        midiDress: { name: "Midi Dress", meta: "PDF Pattern - 05-52" },
        wrapSkirt: { name: "Wrap Skirt", meta: "PDF Pattern - 200" },
      },
      list: {
        bohoBlouse: { name: "Boho Blouse", meta: "PDF - Sizes XS-XXL" },
        linenWrapDress: { name: "Linen Wrap Dress", meta: "PDF - A0 Formats" },
        oversizedShirt: { name: "Oversized Shirt", meta: "PDF - A0 Formats" },
        summerShorts: { name: "Summer Shorts", meta: "PDF - A0 Formats" },
        smockDress: { name: "Smock Dress", meta: "PDF - Sizes XS-XL" },
        croppedJacket: { name: "Cropped Jacket", meta: "PDF - A0 Formats" },
        midiSkirt: { name: "Midi Skirt", meta: "PDF - A0 Formats" },
        cottageBlouse: { name: "Cottage Blouse", meta: "PDF - Sizes XS-XL" },
        slipDress: { name: "Slip Dress", meta: "PDF - Sizes XS-XL" },
        bucketHat: { name: "Bucket Hat", meta: "Sewing Pattern" },
        prairieDress: { name: "Prairie Dress", meta: "PDF - A0 Formats" },
        wrapSkirt: { name: "Wrap Skirt", meta: "PDF - Sizes XS-XL" },
      },
    },
  },
  ru: {
    nav: {
      patterns: "Выкройки",
      pages: "Страницы",
      sizes: "Размеры",
      blog: "Блог",
      line: "Линия",
      learning: "Обучение",
      collab: "Коллаб шоп",
      search: "Поиск",
      language: "Язык",
    },
    hero: {
      kicker: "Трендовые",
      title: "Выкройки для вашего стиля",
      subtitle: "Премиальные выкройки для нового поколения мастеров.",
      shop: "Купить выкройки",
      lookbook: "Смотреть лукбук",
    },
    drop: {
      kicker: "Новая коллекция",
      title: "Избранные выкройки",
      subtitle: "Откройте наши фирменные цифровые выкройки.",
      productTitle: "Укороченная оверсайз-куртка",
      productMeta: "PDF выкройка - размеры XS-XL",
      cta: "Купить коллекцию",
      tag: "4 новые выкройки",
    },
    worth: {
      title: "Выкройки, которые стоит сшить",
      subtitle: "Откройте наши фирменные цифровые выкройки.",
      cta: "Все выкройки",
    },
    process: {
      title: "Наш процесс",
      steps: {
        concept: { title: "Идея", desc: "От эскиза к стежку" },
        grading: { title: "Современная градация", desc: "Инклюзивные размеры" },
        mockups: { title: "Макеты", desc: "Проверено и доработано" },
        finishing: { title: "Финиш", desc: "Готово к пошиву" },
      },
    },
    community: {
      kicker: "Создано вручную и протестировано настоящими швеями.",
      title: "Присоединяйтесь к нашему творческому сообществу",
      point1: "Эксклюзивные выкройки, в подборке",
      point2: "Швейные советы и общение",
      point3: "Дружное сообщество",
      lookbook: "Скачать лукбук",
      subscribe: "Подписаться",
    },
    patterns: {
      title: "Выкройки",
      subtitle: "Искусно созданные PDF и печатные выкройки для современных мастеров.",
      view: "Смотреть выкройку",
      order: "Заказать",
      showing: "Показано 16 из 64 выкроек",
      showingRange: "Показано {start}-{end} выкроек",
      refreshing: "Обновляем каталог…",
      empty: "Пока нет доступных выкроек.",
    },
    filters: {
      category: "Категория",
      all: "Все",
      dresses: "Платья",
      tops: "Топы",
      bottoms: "Низ",
      difficulty: "Сложность",
      beginner: "Новичок",
      intermediate: "Средний",
      advanced: "Продвинутый",
      sortBy: "Сортировать",
      featured: "Избранное",
      newest: "Новое",
      price: "Цена",
    },
    pagination: {
      next: "Далее",
    },
    footer: {
      concept: "Концепт",
      rizes: "Rizes",
      blog: "Блог",
      faqs: "Вопросы",
      learning: "Обучение",
    },
    gateway: {
      connecting: "Gateway: подключение",
      connected: "Gateway: подключено",
      manifestPending: "Gateway: подключено (ожидание манифеста)",
      offline: "Gateway: офлайн",
    },
    modals: {
      subscribe: {
        title: "Присоединяйтесь к сообществу",
        subtitle: "Получайте обновления, дропы и превью выкроек.",
        name: "Имя",
        email: "Email",
        phone: "Телефон (необязательно)",
        success: "Подписка оформлена. Спасибо!",
        submit: "Подписаться",
        submitting: "Отправляем...",
        cancel: "Отмена",
      },
      order: {
        title: "Оформить заказ",
        quantity: "Количество",
        name: "Имя",
        email: "Email",
        phone: "Телефон (необязательно)",
        success: "Заказ отправлен. Номер: {code}",
        pending: "в обработке",
        submit: "Отправить заказ",
        submitting: "Отправляем...",
        cancel: "Отмена",
      },
    },
    errors: {
      subscribeRequiresConnection: "Сначала подключите EIP.",
      subscribeMissing: "Укажите email или телефон.",
      orderMissing: "Выберите доступный продукт для заказа.",
      subscribeFailed: "Не удалось оформить подписку.",
      orderFailed: "Не удалось оформить заказ.",
    },
    alerts: {
      connectEip: "Подключите EIP, указав VITE_EIP_ENDPOINT, чтобы включить живые товары.",
      refreshingFeatured: "Обновляем избранные товары…",
    },
    products: {
      worth: {
        checkeredTop: { name: "Клетчатый топ", meta: "PDF выкройка - 05-200" },
        cargoPants: { name: "Карго брюки", meta: "PDF выкройка - 03-93" },
        sundress: { name: "Сарафан", meta: "PDF выкройка - 05-52" },
        tieFrontTop: { name: "Топ с завязками", meta: "PDF выкройка - 30" },
        midiDress: { name: "Платье миди", meta: "PDF выкройка - 05-52" },
        wrapSkirt: { name: "Юбка на запах", meta: "PDF выкройка - 200" },
      },
      list: {
        bohoBlouse: { name: "Бохо блуза", meta: "PDF - Размеры XS-XXL" },
        linenWrapDress: { name: "Льняное платье на запах", meta: "PDF - Формат A0" },
        oversizedShirt: { name: "Оверсайз рубашка", meta: "PDF - Формат A0" },
        summerShorts: { name: "Летние шорты", meta: "PDF - Формат A0" },
        smockDress: { name: "Платье-смок", meta: "PDF - Размеры XS-XL" },
        croppedJacket: { name: "Укороченная куртка", meta: "PDF - Формат A0" },
        midiSkirt: { name: "Юбка миди", meta: "PDF - Формат A0" },
        cottageBlouse: { name: "Блуза кантри", meta: "PDF - Размеры XS-XL" },
        slipDress: { name: "Платье-комбинация", meta: "PDF - Размеры XS-XL" },
        bucketHat: { name: "Панама", meta: "Швейный паттерн" },
        prairieDress: { name: "Платье прерий", meta: "PDF - Формат A0" },
        wrapSkirt: { name: "Юбка на запах", meta: "PDF - Размеры XS-XL" },
      },
    },
  },
  ky: {
    nav: {
      patterns: "Үлгүлөр",
      pages: "Барактар",
      sizes: "Өлчөмдөр",
      blog: "Блог",
      line: "Сызык",
      learning: "Окутуу",
      collab: "Коллаб дүкөнү",
      search: "Издөө",
      language: "Тил",
    },
    hero: {
      kicker: "Тренддүү",
      title: "Өз стилиңиз үчүн үлгүлөр",
      subtitle: "Жаңы муундагы усталар үчүн премиум үлгүлөр.",
      shop: "Үлгүлөрдү сатып алуу",
      lookbook: "Лукбукту көрүү",
    },
    drop: {
      kicker: "Жаңы чыгарылыш",
      title: "Өзгөчөлөнгөн үлгүлөр",
      subtitle: "Биздин фирмалык санарип үлгүлөрдү караңыз.",
      productTitle: "Кыска оверсайз куртка",
      productMeta: "PDF үлгү - өлчөмдөр XS-XL",
      cta: "Чыгарылышты сатып алуу",
      tag: "4 жаңы үлгү",
    },
    worth: {
      title: "Тигүүгө татыктуу үлгүлөр",
      subtitle: "Биздин фирмалык санарип үлгүлөрдү караңыз.",
      cta: "Бардык үлгүлөрдү сатып алуу",
    },
    process: {
      title: "Биздин процесс",
      steps: {
        concept: { title: "Идея", desc: "Эскизден тигүүгө" },
        grading: { title: "Заманбап градация", desc: "Камтылган өлчөмдөр" },
        mockups: { title: "Макеттер", desc: "Текшерилип жакшыртылган" },
        finishing: { title: "Аякталуу", desc: "Тигүүгө даяр" },
      },
    },
    community: {
      kicker: "Кол менен жасалып, чыныгы тигүүчүлөр тарабынан текшерилди.",
      title: "Биздин чыгармачыл коомчулукка кошулуңуз",
      point1: "Эксклюзивдүү үлгүлөр, тандап",
      point2: "Тигүү кеңештери жана баарлашуу",
      point3: "Ынтымактуу коомчулук",
      lookbook: "Лукбукту жүктөө",
      subscribe: "Жазылуу",
    },
    patterns: {
      title: "Үлгүлөр",
      subtitle: "Заманбап усталар үчүн кылдат даярдалган PDF жана басма үлгүлөр.",
      view: "Үлгүнү көрүү",
      order: "Буйрутма",
      showing: "64 үлгүдөн 16сы көрсөтүлдү",
      showingRange: "{start}-{end} үлгү көрсөтүлдү",
      refreshing: "Каталог жаңыланууда…",
      empty: "Азырынча үлгүлөр жок.",
    },
    filters: {
      category: "Категория",
      all: "Баары",
      dresses: "Көйнөктөр",
      tops: "Топтор",
      bottoms: "Төмөнкү кийимдер",
      difficulty: "Татаалдыгы",
      beginner: "Башталгыч",
      intermediate: "Орто",
      advanced: "Тажрыйбалуу",
      sortBy: "Сорттоо",
      featured: "Тандалган",
      newest: "Жаңы",
      price: "Баа",
    },
    pagination: {
      next: "Кийинки",
    },
    footer: {
      concept: "Концепция",
      rizes: "Rizes",
      blog: "Блог",
      faqs: "Суроолор",
      learning: "Окутуу",
    },
    gateway: {
      connecting: "Gateway: туташууда",
      connected: "Gateway: туташты",
      manifestPending: "Gateway: туташты (манифест күтүлүүдө)",
      offline: "Gateway: офлайн",
    },
    modals: {
      subscribe: {
        title: "Коомчулукка кошулуңуз",
        subtitle: "Жаңылыктар, дроптор жана үлгү алдын ала көрүүлөр.",
        name: "Аты",
        email: "Email",
        phone: "Телефон (милдеттүү эмес)",
        success: "Жазылуу ийгиликтүү. Рахмат!",
        submit: "Жазылуу",
        submitting: "Жөнөтүлүүдө...",
        cancel: "Жокко чыгаруу",
      },
      order: {
        title: "Буйрутма берүү",
        quantity: "Саны",
        name: "Аты",
        email: "Email",
        phone: "Телефон (милдеттүү эмес)",
        success: "Буйрутма жөнөтүлдү. Номери: {code}",
        pending: "иштетүүдө",
        submit: "Буйрутма жөнөтүү",
        submitting: "Жөнөтүлүүдө...",
        cancel: "Жокко чыгаруу",
      },
    },
    errors: {
      subscribeRequiresConnection: "Адегенде EIP туташтырыңыз.",
      subscribeMissing: "Email же телефонду көрсөтүңүз.",
      orderMissing: "Буйрутма үчүн продукт тандаңыз.",
      subscribeFailed: "Жазылуу ишке ашкан жок.",
      orderFailed: "Буйрутма ишке ашкан жок.",
    },
    alerts: {
      connectEip: "Жандуу продукттар үчүн VITE_EIP_ENDPOINT коюп, EIP туташтырыңыз.",
      refreshingFeatured: "Тандалган продукттар жаңыланууда…",
    },
    products: {
      worth: {
        checkeredTop: { name: "Текшерилген топ", meta: "PDF үлгү - 05-200" },
        cargoPants: { name: "Карго шым", meta: "PDF үлгү - 03-93" },
        sundress: { name: "Сарафан", meta: "PDF үлгү - 05-52" },
        tieFrontTop: { name: "Байланган топ", meta: "PDF үлгү - 30" },
        midiDress: { name: "Миди көйнөк", meta: "PDF үлгү - 05-52" },
        wrapSkirt: { name: "Жаап юбка", meta: "PDF үлгү - 200" },
      },
      list: {
        bohoBlouse: { name: "Бохо блуза", meta: "PDF - Өлчөмдөр XS-XXL" },
        linenWrapDress: { name: "Зыгыр көйнөк", meta: "PDF - A0 формат" },
        oversizedShirt: { name: "Оверсайз көйнөк", meta: "PDF - A0 формат" },
        summerShorts: { name: "Жайкы шорты", meta: "PDF - A0 формат" },
        smockDress: { name: "Смок көйнөк", meta: "PDF - Өлчөмдөр XS-XL" },
        croppedJacket: { name: "Кыска куртка", meta: "PDF - A0 формат" },
        midiSkirt: { name: "Миди юбка", meta: "PDF - A0 формат" },
        cottageBlouse: { name: "Кантри блуза", meta: "PDF - Өлчөмдөр XS-XL" },
        slipDress: { name: "Комбинация көйнөк", meta: "PDF - Өлчөмдөр XS-XL" },
        bucketHat: { name: "Панама", meta: "Тигүү үлгүсү" },
        prairieDress: { name: "Прерия көйнөк", meta: "PDF - A0 формат" },
        wrapSkirt: { name: "Жаап юбка", meta: "PDF - Өлчөмдөр XS-XL" },
      },
    },
  },
  fr: {
    nav: {
      patterns: "Patrons",
      pages: "Pages",
      sizes: "Tailles",
      blog: "Blog",
      line: "Ligne",
      learning: "Apprendre",
      collab: "Boutique collab",
      search: "Rechercher",
      language: "Langue",
    },
    hero: {
      kicker: "Tendance",
      title: "Des patrons pour votre style",
      subtitle: "Des patrons premium pour la nouvelle generation de createurs.",
      shop: "Acheter les patrons",
      lookbook: "Voir le lookbook",
    },
    drop: {
      kicker: "La selection",
      title: "Patrons en vedette",
      subtitle: "Decouvrez nos patrons numeriques signature.",
      productTitle: "Veste courte oversize",
      productMeta: "Patron PDF - Tailles XS-XL",
      cta: "Acheter la selection",
      tag: "4 nouveaux patrons",
    },
    worth: {
      title: "Patrons a coudre",
      subtitle: "Decouvrez nos patrons numeriques signature.",
      cta: "Voir tous les patrons",
    },
    process: {
      title: "Notre processus",
      steps: {
        concept: { title: "Concept", desc: "Du croquis a la couture" },
        grading: { title: "Gradation moderne", desc: "Tailles inclusives" },
        mockups: { title: "Maquettes", desc: "Teste et affine" },
        finishing: { title: "Finition", desc: "Pret a coudre" },
      },
    },
    community: {
      kicker: "Fait main et teste par de vraies couturieres.",
      title: "Rejoignez notre communaute creative",
      point1: "Patrons exclusifs, en edition",
      point2: "Conseils couture et echanges",
      point3: "Communaute soudee",
      lookbook: "Telecharger le lookbook",
      subscribe: "S'abonner",
    },
    patterns: {
      title: "Patrons",
      subtitle: "Patrons PDF et imprimes concus pour les createurs modernes.",
      view: "Voir le patron",
      order: "Commander",
      showing: "Affichage de 16 sur 64 patrons",
      showingRange: "Affichage de {start}-{end} patrons",
      refreshing: "Actualisation du catalogue…",
      empty: "Aucun patron disponible pour le moment.",
    },
    filters: {
      category: "Categorie",
      all: "Tous",
      dresses: "Robes",
      tops: "Hauts",
      bottoms: "Bas",
      difficulty: "Difficulte",
      beginner: "Debutant",
      intermediate: "Intermediaire",
      advanced: "Avance",
      sortBy: "Trier par",
      featured: "En vedette",
      newest: "Nouveautes",
      price: "Prix",
    },
    pagination: {
      next: "Suivant",
    },
    footer: {
      concept: "Concept",
      rizes: "Rizes",
      blog: "Blog",
      faqs: "FAQ",
      learning: "Apprendre",
    },
    gateway: {
      connecting: "Gateway: connexion",
      connected: "Gateway: connecté",
      manifestPending: "Gateway: connecté (manifest en attente)",
      offline: "Gateway: hors ligne",
    },
    modals: {
      subscribe: {
        title: "Rejoignez la communaute",
        subtitle: "Recevez des actus, des drops et des apercus.",
        name: "Nom",
        email: "Email",
        phone: "Telephone (optionnel)",
        success: "Abonnement confirme. Merci !",
        submit: "S'abonner",
        submitting: "Envoi...",
        cancel: "Annuler",
      },
      order: {
        title: "Passer commande",
        quantity: "Quantite",
        name: "Nom",
        email: "Email",
        phone: "Telephone (optionnel)",
        success: "Commande envoyee. Reference : {code}",
        pending: "en attente",
        submit: "Envoyer la commande",
        submitting: "Envoi...",
        cancel: "Annuler",
      },
    },
    errors: {
      subscribeRequiresConnection: "Connectez EIP avant de vous abonner.",
      subscribeMissing: "Ajoutez un email ou un telephone.",
      orderMissing: "Selectionnez un produit disponible.",
      subscribeFailed: "Echec de l'abonnement.",
      orderFailed: "Echec de la commande.",
    },
    alerts: {
      connectEip: "Connectez EIP en definissant VITE_EIP_ENDPOINT pour activer les produits.",
      refreshingFeatured: "Actualisation des produits en vedette…",
    },
    products: {
      worth: {
        checkeredTop: { name: "Top a carreaux", meta: "Patron PDF - 05-200" },
        cargoPants: { name: "Pantalon cargo", meta: "Patron PDF - 03-93" },
        sundress: { name: "Robe d'ete", meta: "Patron PDF - 05-52" },
        tieFrontTop: { name: "Top noue", meta: "Patron PDF - 30" },
        midiDress: { name: "Robe midi", meta: "Patron PDF - 05-52" },
        wrapSkirt: { name: "Jupe portefeuille", meta: "Patron PDF - 200" },
      },
      list: {
        bohoBlouse: { name: "Blouse boho", meta: "PDF - Tailles XS-XXL" },
        linenWrapDress: { name: "Robe portefeuille en lin", meta: "PDF - Formats A0" },
        oversizedShirt: { name: "Chemise oversize", meta: "PDF - Formats A0" },
        summerShorts: { name: "Short d'ete", meta: "PDF - Formats A0" },
        smockDress: { name: "Robe smock", meta: "PDF - Tailles XS-XL" },
        croppedJacket: { name: "Veste courte", meta: "PDF - Formats A0" },
        midiSkirt: { name: "Jupe midi", meta: "PDF - Formats A0" },
        cottageBlouse: { name: "Blouse cottage", meta: "PDF - Tailles XS-XL" },
        slipDress: { name: "Robe nuisette", meta: "PDF - Tailles XS-XL" },
        bucketHat: { name: "Bob", meta: "Patron de couture" },
        prairieDress: { name: "Robe prairie", meta: "PDF - Formats A0" },
        wrapSkirt: { name: "Jupe portefeuille", meta: "PDF - Tailles XS-XL" },
      },
    },
  },
  es: {
    nav: {
      patterns: "Patrones",
      pages: "Paginas",
      sizes: "Tallas",
      blog: "Blog",
      line: "Linea",
      learning: "Aprender",
      collab: "Tienda collab",
      search: "Buscar",
      language: "Idioma",
    },
    hero: {
      kicker: "En tendencia",
      title: "Patrones para coser tu estilo",
      subtitle: "Patrones premium para la nueva generacion de creadores.",
      shop: "Comprar patrones",
      lookbook: "Ver lookbook",
    },
    drop: {
      kicker: "La coleccion",
      title: "Patrones destacados",
      subtitle: "Explora nuestros patrones digitales emblematicos.",
      productTitle: "Chaqueta corta oversize",
      productMeta: "Patron PDF - Tallas XS-XL",
      cta: "Comprar la coleccion",
      tag: "4 patrones nuevos",
    },
    worth: {
      title: "Patrones que vale la pena hacer",
      subtitle: "Explora nuestros patrones digitales emblematicos.",
      cta: "Ver todos los patrones",
    },
    process: {
      title: "Nuestro proceso",
      steps: {
        concept: { title: "Concepto", desc: "Del boceto a la costura" },
        grading: { title: "Graduacion moderna", desc: "Tallas inclusivas" },
        mockups: { title: "Prototipos", desc: "Probado y mejorado" },
        finishing: { title: "Acabado", desc: "Listo para coser" },
      },
    },
    community: {
      kicker: "Hecho a mano y probado por costureras reales.",
      title: "Unete a nuestra comunidad creativa",
      point1: "Patrones exclusivos, en seleccion",
      point2: "Consejos de costura y comunidad",
      point3: "Comunidad unida",
      lookbook: "Descargar lookbook",
      subscribe: "Suscribirse",
    },
    patterns: {
      title: "Patrones",
      subtitle: "Patrones PDF e impresos para creadores modernos.",
      view: "Ver patron",
      order: "Ordenar",
      showing: "Mostrando 16 de 64 patrones",
      showingRange: "Mostrando {start}-{end} patrones",
      refreshing: "Actualizando catalogo…",
      empty: "No hay patrones disponibles todavia.",
    },
    filters: {
      category: "Categoria",
      all: "Todos",
      dresses: "Vestidos",
      tops: "Tops",
      bottoms: "Inferiores",
      difficulty: "Dificultad",
      beginner: "Principiante",
      intermediate: "Intermedio",
      advanced: "Avanzado",
      sortBy: "Ordenar por",
      featured: "Destacados",
      newest: "Novedades",
      price: "Precio",
    },
    pagination: {
      next: "Siguiente",
    },
    footer: {
      concept: "Concepto",
      rizes: "Rizes",
      blog: "Blog",
      faqs: "FAQs",
      learning: "Aprender",
    },
    gateway: {
      connecting: "Gateway: conectando",
      connected: "Gateway: conectado",
      manifestPending: "Gateway: conectado (manifiesto pendiente)",
      offline: "Gateway: sin conexion",
    },
    modals: {
      subscribe: {
        title: "Unete a la comunidad",
        subtitle: "Recibe novedades, lanzamientos y avances.",
        name: "Nombre",
        email: "Email",
        phone: "Telefono (opcional)",
        success: "Suscripcion completada. Gracias!",
        submit: "Suscribirse",
        submitting: "Enviando...",
        cancel: "Cancelar",
      },
      order: {
        title: "Realizar pedido",
        quantity: "Cantidad",
        name: "Nombre",
        email: "Email",
        phone: "Telefono (opcional)",
        success: "Pedido enviado. Referencia: {code}",
        pending: "pendiente",
        submit: "Enviar pedido",
        submitting: "Enviando...",
        cancel: "Cancelar",
      },
    },
    errors: {
      subscribeRequiresConnection: "Conecta EIP antes de suscribirte.",
      subscribeMissing: "Agrega un email o telefono.",
      orderMissing: "Selecciona un producto disponible.",
      subscribeFailed: "No se pudo suscribir.",
      orderFailed: "No se pudo realizar el pedido.",
    },
    alerts: {
      connectEip: "Conecta EIP configurando VITE_EIP_ENDPOINT para activar productos.",
      refreshingFeatured: "Actualizando productos destacados…",
    },
    products: {
      worth: {
        checkeredTop: { name: "Top a cuadros", meta: "Patron PDF - 05-200" },
        cargoPants: { name: "Pantalones cargo", meta: "Patron PDF - 03-93" },
        sundress: { name: "Vestido de verano", meta: "Patron PDF - 05-52" },
        tieFrontTop: { name: "Top con lazo", meta: "Patron PDF - 30" },
        midiDress: { name: "Vestido midi", meta: "Patron PDF - 05-52" },
        wrapSkirt: { name: "Falda cruzada", meta: "Patron PDF - 200" },
      },
      list: {
        bohoBlouse: { name: "Blusa boho", meta: "PDF - Tallas XS-XXL" },
        linenWrapDress: { name: "Vestido cruzado de lino", meta: "PDF - Formato A0" },
        oversizedShirt: { name: "Camisa oversize", meta: "PDF - Formato A0" },
        summerShorts: { name: "Pantalones cortos", meta: "PDF - Formato A0" },
        smockDress: { name: "Vestido smock", meta: "PDF - Tallas XS-XL" },
        croppedJacket: { name: "Chaqueta corta", meta: "PDF - Formato A0" },
        midiSkirt: { name: "Falda midi", meta: "PDF - Formato A0" },
        cottageBlouse: { name: "Blusa cottage", meta: "PDF - Tallas XS-XL" },
        slipDress: { name: "Vestido lencero", meta: "PDF - Tallas XS-XL" },
        bucketHat: { name: "Sombrero cubo", meta: "Patron de costura" },
        prairieDress: { name: "Vestido pradera", meta: "PDF - Formato A0" },
        wrapSkirt: { name: "Falda cruzada", meta: "PDF - Tallas XS-XL" },
      },
    },
  },
};

const HOME_NAV = ["patterns", "pages", "sizes", "blog", "line", "learning"];
const PATTERNS_NAV = ["patterns", "pages", "sizes", "blog", "line", "collab", "learning"];
const PAGE_CONTENT_SLOTS = {
  pages: { hero: "pages.hero", cards: "pages.cards" },
  sizes: { hero: "sizes.hero" },
  line: { hero: "line.hero", cards: "line.cards" },
  learning: { hero: "learning.hero", cards: "learning.cards" },
  collab: { hero: "collab.hero", cards: "collab.cards" },
  blog: { hero: "blog.hero" },
};
const HOME_PRODUCT_SLOTS = {
  featured: "home.featured",
  worth: "home.worth_making",
};
const LEGACY_HOME_PRODUCT_SLOTS = {
  worth: "home.worth",
};
const ALL_PAGE_CONTENT_SLOTS = Array.from(
  new Set(
    Object.values(PAGE_CONTENT_SLOTS)
      .flatMap((entry) => Object.values(entry))
      .filter(Boolean)
  )
);

const dropGallery = [dropSideA, dropSideB, dropSideC];

const WORTH_ITEMS = [
  { id: "checkeredTop", price: "EUR 14", image: pattern1 },
  { id: "cargoPants", price: "EUR 14", image: pattern2 },
  { id: "sundress", price: "EUR 14", image: pattern3 },
  { id: "tieFrontTop", price: "EUR 14", image: pattern4 },
  { id: "midiDress", price: "EUR 14", image: pattern5 },
  { id: "wrapSkirt", price: "EUR 14", image: pattern6 },
];

const PATTERN_ITEMS = [
  { id: "bohoBlouse", price: "EUR 14", rating: 4.5, image: pattern1 },
  { id: "linenWrapDress", price: "EUR 15", rating: 4.2, image: pattern2 },
  { id: "oversizedShirt", price: "EUR 18", rating: 4.8, image: pattern3 },
  { id: "summerShorts", price: "EUR 10", rating: 4.1, image: pattern4 },
  { id: "smockDress", price: "EUR 16", rating: 4.0, image: pattern5 },
  { id: "croppedJacket", price: "EUR 15", rating: 4.6, image: pattern6 },
  { id: "midiSkirt", price: "EUR 13", rating: 4.3, image: pattern7 },
  { id: "cottageBlouse", price: "EUR 14", rating: 4.4, image: pattern8 },
  { id: "slipDress", price: "EUR 12", rating: 4.1, image: pattern9 },
  { id: "bucketHat", price: "EUR 12", rating: 3.9, image: pattern10 },
  { id: "prairieDress", price: "EUR 16", rating: 4.7, image: pattern11 },
  { id: "wrapSkirt", price: "EUR 14", rating: 4.5, image: pattern12 },
];

const FILTER_OPTIONS = [
  { id: "all", key: "all" },
  { id: "dresses", key: "dresses" },
  { id: "tops", key: "tops" },
  { id: "bottoms", key: "bottoms" },
];

const DIFFICULTY_OPTIONS = [
  { id: "all", key: "all" },
  { id: "beginner", key: "beginner" },
  { id: "intermediate", key: "intermediate" },
  { id: "advanced", key: "advanced" },
];

const SORT_OPTIONS = [
  { id: "featured", key: "featured" },
  { id: "newest", key: "newest" },
  { id: "price", key: "price" },
];

const PROCESS_STEPS = ["concept", "grading", "mockups", "finishing"];
const CART_STORAGE_KEY = `eip-cart-${EIP_CONFIG.connectionKey || "default"}-v1`;
const FAVORITES_STORAGE_KEY_PREFIX = `eip-favorites-${EIP_CONFIG.connectionKey || "default"}-v1`;

const SIZE_MEASUREMENTS = [
  {
    key: "neck_girth",
    title: "Neck girth (base)",
    detail: "Tape runs around the neck base, level at the back, without tightening.",
    marker: { x: 49, y: 20 },
    zone: { top: 16.5, left: 40, width: 18, height: 5, radius: "999px", scale: 1.12 },
    guide: {
      start: { x: 42, y: 19 },
      end: { x: 56, y: 19 },
      segments: [{ x1: 42, y1: 19, x2: 56, y2: 19 }],
    },
  },
  {
    key: "shoulder_length",
    title: "Shoulder length",
    detail: "Measure from neck point to shoulder/arm joint (acromion).",
    marker: { x: 34.5, y: 20.5 },
    zone: { top: 18.5, left: 24.8, width: 18, height: 5, radius: "999px", rotate: -20, scale: 1.14 },
    guide: {
      start: { x: 41.0, y:19 },
      end: { x:27,y: 22.6 },
      segments: [{ x1: 41.0, y1: 19, x2: 27, y2: 22.6 }],
    },
  },
  {
    key: "bust_girth",
    title: "Bust/chest girth",
    detail: "Horizontal tape at fullest point, under arm, level around body.",
    marker: { x: 49, y: 35 },
    zone: { top: 31, left: 30, width: 40, height: 8, radius: "999px", scale: 1.1 },
    guide: {
      start: { x: 30, y: 35 },
      end: { x: 69, y: 35 },
      segments: [{ x1: 30, y1: 35, x2: 69, y2: 35 }],
    },
  },
  {
    key: "front_waist_length",
    title: "Front waist length (HPS to waist)",
    detail: "From high-point shoulder down over bust apex to natural waist.",
    marker: { x: 58, y: 45 },
    zone: { top: 19, left: 53, width: 8, height: 34, radius: "999px", scale: 1.1 },
    guide: {
      start: { x: 57, y: 19 },
      end: { x: 57, y: 52 },
      segments: [{ x1: 57, y1: 19, x2: 57, y2: 52 }],
    },
  },
  {
    key: "waist",
    title: "Waist girth",
    detail: "Measure natural waist between lower ribs and top hip bones.",
    marker: { x: 49, y: 53 },
    zone: { top: 49.5, left: 33, width: 33, height: 5, radius: "999px", scale: 1.1 },
    guide: {
      start: { x: 34, y: 52 },
      end: { x: 65, y: 52 },
      segments: [{ x1: 34, y1: 52, x2: 65, y2: 52 }],
    },
  },
  {
    key: "hip",
    title: "Hip girth",
    detail: "Measure horizontally around fullest seat/hip level.",
    marker: { x: 49, y: 67 },
    zone: { top: 62, left: 29.5, width: 40, height: 12, radius: "999px", scale: 1.1 },
    guide: {
      start: { x: 29, y: 67.5 },
      end: { x: 70, y: 67.5 },
      segments: [{ x1: 29, y1: 67.5, x2: 70, y2: 67.5 }],
    },
  },
  {
    key: "inseam",
    title: "Inside leg length (inseam)",
    detail: "Measure from crotch point down to floor along inside leg.",
    marker: { x: 49, y: 78 },
    zone: { top: 71, left: 45, width: 8.5, height: 14, radius: "999px", scale: 1.08 },
    guide: {
      start: { x: 49, y: 72 },
      end: { x: 49, y: 84 },
      segments: [{ x1: 49, y1: 72, x2: 49, y2: 84 }],
    },
  },
];

const SIZE_CONVERSION_ROWS = [
  { size: "XS", bust: "80-84", waist: "60-64", hip: "86-90", eu: "34", uk: "6", us: "2", fr: "36", jp: "7" },
  { size: "S", bust: "84-88", waist: "64-68", hip: "90-94", eu: "36", uk: "8", us: "4", fr: "38", jp: "9" },
  { size: "M", bust: "88-94", waist: "68-74", hip: "94-100", eu: "38", uk: "10", us: "6", fr: "40", jp: "11" },
  { size: "L", bust: "94-100", waist: "74-80", hip: "100-106", eu: "40", uk: "12", us: "8", fr: "42", jp: "13" },
  { size: "XL", bust: "100-106", waist: "80-86", hip: "106-112", eu: "42", uk: "14", us: "10", fr: "44", jp: "15" },
];

const SIZE_STANDARD_MATRIX = [
  { size: "XXS", eu: "32", uk: "4", us: "0", fr: "34", jp: "5" },
  { size: "XS", eu: "34", uk: "6", us: "2", fr: "36", jp: "7" },
  { size: "S", eu: "36", uk: "8", us: "4", fr: "38", jp: "9" },
  { size: "M", eu: "38", uk: "10", us: "6", fr: "40", jp: "11" },
  { size: "L", eu: "40", uk: "12", us: "8", fr: "42", jp: "13" },
  { size: "XL", eu: "42", uk: "14", us: "10", fr: "44", jp: "15" },
  { size: "XXL", eu: "44", uk: "16", us: "12", fr: "46", jp: "17" },
];

const SIZE_MEASUREMENT_VALUE_MATRIX = {
  neck_girth: {
    XXS: "30-31",
    XS: "31-32",
    S: "32-33",
    M: "33-34",
    L: "34-35",
    XL: "35-36",
    XXL: "36-37",
  },
  shoulder_length: {
    XXS: "11.4-11.8",
    XS: "11.8-12.2",
    S: "12.2-12.6",
    M: "12.6-13.0",
    L: "13.0-13.4",
    XL: "13.4-13.8",
    XXL: "13.8-14.2",
  },
  bust_girth: {
    XXS: "76-80",
    XS: "80-84",
    S: "84-88",
    M: "88-94",
    L: "94-100",
    XL: "100-106",
    XXL: "106-112",
  },
  front_waist_length: {
    XXS: "39-40",
    XS: "40-41",
    S: "41-42",
    M: "42-43",
    L: "43-44",
    XL: "44-45",
    XXL: "45-46",
  },
  waist: {
    XXS: "56-60",
    XS: "60-64",
    S: "64-68",
    M: "68-74",
    L: "74-80",
    XL: "80-86",
    XXL: "86-92",
  },
  hip: {
    XXS: "82-86",
    XS: "86-90",
    S: "90-94",
    M: "94-100",
    L: "100-106",
    XL: "106-112",
    XXL: "112-118",
  },
  inseam: {
    XXS: "74-75",
    XS: "75-76",
    S: "76-77",
    M: "77-78",
    L: "78-79",
    XL: "79-80",
    XXL: "80-81",
  },
};

function measurementMatrixRows(measurementKey) {
  const values = SIZE_MEASUREMENT_VALUE_MATRIX[measurementKey] || {};
  return SIZE_STANDARD_MATRIX.map((row) => ({
    ...row,
    value: values[row.size] || "-",
  }));
}

const PAGES_DIRECTORY = [
  {
    id: "atelier",
    title: "Atelier Story",
    summary: "Brand values, studio process, and sustainability commitments.",
    owner: "Editorial",
    status: "Live",
    cta: "Read page",
  },
  {
    id: "shipping",
    title: "Shipping & Returns",
    summary: "Digital delivery policy, refund windows, and support contacts.",
    owner: "Operations",
    status: "Live",
    cta: "View policy",
  },
  {
    id: "support",
    title: "Help Center",
    summary: "FAQs, sizing help, payment issues, and ticket intake links.",
    owner: "Support",
    status: "Draft",
    cta: "Prepare page",
  },
  {
    id: "lookbook",
    title: "Season Lookbook",
    summary: "Campaign visuals, drops calendar, and download-ready media kit.",
    owner: "Marketing",
    status: "Planned",
    cta: "Plan release",
  },
];

const BLOG_POSTS = [
  {
    id: "post-atelier-cuts",
    author: "Mina Razak",
    role: "Pattern maker",
    postedAt: "2h ago",
    title: "How we draft clean armhole curves for layered jackets",
    body:
      "Today we refined the shoulder balance on the cropped jacket block. We tested three seam allowances and kept the version that behaves best in twill.",
    image: pattern3,
    likes: 86,
    dislikes: 4,
    comments: 14,
    tags: ["fit-notes", "jacket", "pattern-lab"],
  },
  {
    id: "post-sleeve-playbook",
    author: "Arielle Noor",
    role: "Community mentor",
    postedAt: "Yesterday",
    title: "Sleeve rotation checklist before publishing a pattern",
    body:
      "If your sleeve pitch is off by even a few millimeters, mobility suffers. Here is the pre-publish checklist we now use in every sample review.",
    image: pattern8,
    likes: 59,
    dislikes: 2,
    comments: 9,
    tags: ["review", "quality", "mobility"],
  },
];

const LINE_CAPSULES = [
  {
    id: "line-resort",
    name: "Resort Edit",
    season: "Q2 2026",
    status: "In production",
    window: "April 14 - May 03",
    focus: "Lightweight tailoring and modular daywear.",
  },
  {
    id: "line-studio",
    name: "Studio Uniform",
    season: "Q3 2026",
    status: "Sampling",
    window: "June 02 - July 10",
    focus: "Core blocks for makers, updated grading and fit notes.",
  },
  {
    id: "line-evening",
    name: "Evening Structure",
    season: "Q4 2026",
    status: "Planned",
    window: "August kickoff",
    focus: "Architectural silhouettes and advanced construction guides.",
  },
];

const LEARNING_TRACKS = [
  {
    id: "track-beginner",
    title: "Starter Pattern Lab",
    level: "Beginner",
    duration: "4 weeks",
    outcome: "Build first sellable digital pattern pack.",
  },
  {
    id: "track-growth",
    title: "Commercial Pattern Ops",
    level: "Intermediate",
    duration: "6 weeks",
    outcome: "Run quality checks, pricing, and release workflow.",
  },
  {
    id: "track-pro",
    title: "Advanced Fit Engineering",
    level: "Advanced",
    duration: "8 weeks",
    outcome: "Handle complex grading and body-shape variance mapping.",
  },
];

const LEARNING_SCHEDULE = [
  {
    id: "slot-1",
    title: "Pattern QA Bootcamp",
    mode: "Live online",
    startsAt: "Mar 24, 2026",
    seats: "18 seats",
  },
  {
    id: "slot-2",
    title: "Digital Sewing Documentation",
    mode: "Hybrid",
    startsAt: "Apr 09, 2026",
    seats: "24 seats",
  },
  {
    id: "slot-3",
    title: "Creator Monetization Sprint",
    mode: "Live online",
    startsAt: "Apr 23, 2026",
    seats: "30 seats",
  },
];

const COLLAB_PROGRAMS = [
  {
    id: "collab-creator",
    title: "Creator Capsule",
    payout: "70/30 split",
    summary: "Publish your pattern under your signature while Samara handles checkout and fulfillment.",
  },
  {
    id: "collab-brand",
    title: "Brand Co-release",
    payout: "Negotiated split",
    summary: "Joint drops with fashion brands. Includes launch media and sales reporting.",
  },
  {
    id: "collab-mentor",
    title: "Mentor Circle",
    payout: "Per cohort",
    summary: "Run workshops and receive revenue share from paid training cohorts.",
  },
];

const getByPath = (obj, path) =>
  path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

function pickLocalizedValue(value, lang) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const normalized = normalizeLocaleCode(lang);
    const base = normalized.split("-")[0];
    const entries = Object.entries(value || {});
    const exact =
      value[normalized] ||
      value[normalized.toLowerCase()] ||
      value[normalized.toUpperCase()];
    if (exact) return exact;
    if (base) {
      const baseMatch =
        value[base] ||
        value[base.toLowerCase()] ||
        value[base.toUpperCase()] ||
        entries.find(([key]) => normalizeLocaleCode(key) === base)?.[1];
      if (baseMatch) return baseMatch;
    }
    return value.en || value.default || entries[0]?.[1] || null;
  }
  return null;
}

function stripHtmlToText(value) {
  const raw = String(value || "");
  if (!raw) return "";
  const decoded = raw
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
  return decoded
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveRenderableContent(value, lang = "en", depth = 0) {
  if (depth > 4 || value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => resolveRenderableContent(entry, lang, depth + 1))
      .filter(Boolean)
      .join(" ");
  }
  if (typeof value === "object") {
    const preferred = [
      value.html,
      value.text,
      value.value,
      value.description,
      value.summary,
      value.content,
    ];
    for (const candidate of preferred) {
      const resolved = resolveRenderableContent(candidate, lang, depth + 1);
      if (resolved) return resolved;
    }
    const localized = pickLocalizedValue(value, lang);
    if (localized && localized !== value) {
      return resolveRenderableContent(localized, lang, depth + 1);
    }
  }
  return "";
}

function parseApiErrorCode(error) {
  const raw = String(error?.message || "");
  if (!raw) return "";
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) return "";
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return String(parsed?.error || parsed?.code || "").trim().toUpperCase();
  } catch {
    return "";
  }
}

function resolveMemberAuthErrorMessage(code, t) {
  if (!code) return "";
  if (code === "EMAIL_ALREADY_USED") {
    return resolveCopy(t, "auth.emailUsed", "This email is already registered.");
  }
  if (code === "USERNAME_ALREADY_USED") {
    return resolveCopy(t, "auth.usernameUsed", "This username is already taken.");
  }
  if (code === "CREDENTIAL_ALREADY_USED") {
    return resolveCopy(t, "auth.credentialUsed", "This account already exists.");
  }
  if (code === "BAD_PASSWORD") {
    return resolveCopy(t, "auth.badPassword", "Invalid password.");
  }
  if (code === "MEMBER_NOT_FOUND") {
    return resolveCopy(t, "auth.memberNotFound", "No account found for these credentials.");
  }
  if (code === "MEMBER_AUTH_START_FAILED") {
    return resolveCopy(t, "auth.startFailed", "Unable to start authentication. Please retry.");
  }
  return "";
}

function extractTags(item) {
  const attrs = item?.attrs || {};
  const tags = [];
  if (Array.isArray(attrs?.taxonomy?.tags)) tags.push(...attrs.taxonomy.tags);
  if (Array.isArray(attrs?.tags)) tags.push(...attrs.tags);
  if (typeof attrs?.taxonomy?.category === "string") tags.push(attrs.taxonomy.category);
  return tags.map((tag) => String(tag || "").toLowerCase()).filter(Boolean);
}

function hasTag(item, tag) {
  if (!tag) return false;
  const match = String(tag).toLowerCase();
  return extractTags(item).includes(match);
}

function pickMedia(item) {
  const media = item?.attrs?.media || {};
  const galleryAssets = Array.isArray(media.gallery_assets)
    ? media.gallery_assets.map((asset) => asset?.url).filter(Boolean)
    : [];
  const galleryUrls = Array.isArray(media.gallery) ? media.gallery.filter(Boolean) : [];
  const documentAssets = Array.isArray(media.document_assets)
    ? media.document_assets.map((asset) => asset?.url).filter(Boolean)
    : [];
  const documentUrls = Array.isArray(media.documents) ? media.documents.filter(Boolean) : [];
  const hero =
    media.main_url ||
    media.main_asset?.url ||
    media.hero_url ||
    media.hero_asset?.url ||
    galleryAssets[0] ||
    galleryUrls[0] ||
    "";
  const gallery = [...galleryAssets, ...galleryUrls].filter(Boolean);
  const documents = [...documentAssets, ...documentUrls].filter(Boolean);
  return {
    hero: hero ? resolveAssetUrl(hero) : "",
    gallery: gallery.map((url) => resolveAssetUrl(url)),
    documents: documents.map((url) => resolveAssetUrl(url)),
  };
}

function formatPrice(attrs, priceContext = null) {
  const details = resolveDisplayPriceForAttrs(attrs, priceContext);
  const amount = details.amount;
  const currency = details.currency;
  if (amount === undefined || amount === null || amount === "") return null;
  return `${currency} ${amount}`;
}

function normalizeCurrencyCode(value, fallback = "USD") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return fallback;
  return normalized;
}

function resolveDisplayPriceForAttrs(attrs, priceContext = null) {
  const tiers = Array.isArray(attrs?.pricing?.tiers) ? attrs.pricing.tiers : [];
  const tier = tiers[0] || {};
  const sourceAmount = toNumericAmount(
    tier.amount,
    tier.unit_price,
    attrs?.pricing?.amount,
    attrs?.pricing?.price,
    attrs?.pricing?.unit_price,
    attrs?.price,
    attrs?.unit_price
  );
  const sourceCurrency = normalizeCurrencyCode(tier.currency || attrs?.pricing?.currency || "USD", "USD");
  if (!Number.isFinite(sourceAmount)) {
    return { amount: null, currency: sourceCurrency };
  }

  const context = priceContext && typeof priceContext === "object" ? priceContext : null;
  if (!context) return { amount: sourceAmount, currency: sourceCurrency };

  const targetCurrency = normalizeCurrencyCode(context.currency || sourceCurrency, sourceCurrency);
  if (targetCurrency === sourceCurrency) {
    return { amount: sourceAmount, currency: sourceCurrency };
  }

  const directTier = tiers.find((candidate) => {
    const currency = normalizeCurrencyCode(candidate?.currency || "", "");
    if (!currency || currency !== targetCurrency) return false;
    const amount = toNumericAmount(candidate?.amount, candidate?.unit_price);
    return Number.isFinite(amount);
  });
  if (directTier) {
    const directAmount = toNumericAmount(directTier.amount, directTier.unit_price);
    return { amount: directAmount, currency: targetCurrency };
  }

  const baseCurrency = normalizeCurrencyCode(context.baseCurrency || sourceCurrency, sourceCurrency);
  const exchangeRate = Number(context.exchangeRate);
  if (sourceCurrency !== baseCurrency || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    return { amount: sourceAmount, currency: sourceCurrency };
  }

  return {
    amount: Number((sourceAmount * exchangeRate).toFixed(2)),
    currency: targetCurrency,
  };
}

function resolvePriceDetails(item, priceContext = null) {
  const attrs = item?.raw?.attrs || item?.attrs || {};
  const details = resolveDisplayPriceForAttrs(attrs, priceContext);
  return {
    amount: Number.isFinite(details.amount) ? details.amount : null,
    currency: normalizeCurrencyCode(details.currency || "USD", "USD"),
  };
}

function formatCurrencyAmount(amount, currency) {
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function toCartItem(item, quantity = 1, priceContext = null) {
  const details = resolvePriceDetails(item, priceContext);
  const id = item?.code || item?.id;
  return {
    id,
    code: item?.code || "",
    title: item?.title || item?.code || "Product",
    image: item?.image || "",
    meta: item?.meta || "",
    quantity: Math.max(Number(quantity) || 1, 1),
    unitAmount: details.amount,
    currency: details.currency,
    priceLabel: item?.price || null,
  };
}

function buildProfileForm(user) {
  const data = user && typeof user === "object" ? user : {};
  const prefs = data.preferences && typeof data.preferences === "object" ? data.preferences : {};
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata : {};
  return {
    display_name: String(data.display_name || "").trim(),
    title: String(data.title || "").trim(),
    first_name: String(metadata.first_name || "").trim(),
    last_name: String(metadata.last_name || "").trim(),
    phone: String(data.phone || "").trim(),
    locale: String(data.locale || "").trim(),
    timezone: String(data.timezone || "").trim(),
    avatar_url: String(data.avatar_url || "").trim(),
    preferences: prefs,
  };
}

function loadStoredCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const code = String(entry.code || entry.id || "").trim();
        if (!code) return null;
        const quantity = Math.max(Number(entry.quantity) || 1, 1);
        const amount = Number(entry.unitAmount);
        return {
          id: String(entry.id || code),
          code,
          title: String(entry.title || code),
          image: String(entry.image || ""),
          meta: String(entry.meta || ""),
          quantity,
          unitAmount: Number.isFinite(amount) ? amount : null,
          currency: String(entry.currency || "EUR").toUpperCase(),
          priceLabel: entry.priceLabel ? String(entry.priceLabel) : null,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveTitle(item, lang) {
  const attrs = item?.attrs || {};
  const translation = getItemTranslationMeta(item);
  const candidates = [
    "content.title",
    "content.name",
    "display_name",
    "title",
  ];
  for (const path of candidates) {
    const translated = resolveTranslatedPath(translation, path, lang);
    if (translated) return translated;
    const candidate = getByPath(attrs, path);
    const resolved = pickLocalizedValue(candidate, lang);
    if (resolved) return resolved;
  }
  return item?.name || item?.code || "Untitled";
}

function resolveMeta(item, lang) {
  const attrs = item?.attrs || {};
  const translation = getItemTranslationMeta(item);
  const candidates = [
    "content.subtitle",
    "content.summary",
    "content.description",
    "summary",
  ];
  for (const path of candidates) {
    const translated = resolveTranslatedPath(translation, path, lang);
    if (translated) return stripHtmlToText(translated);
    const candidate = getByPath(attrs, path);
    const resolved = pickLocalizedValue(candidate, lang);
    if (resolved) return stripHtmlToText(resolved);
  }
  return "";
}

function resolveHeroCopy(item, lang) {
  const attrs = item?.attrs || {};
  const copy = attrs?.storefront?.hero || attrs?.hero || {};
  const kicker = pickLocalizedValue(copy.kicker, lang) || pickLocalizedValue(getByPath(attrs, "content.kicker"), lang);
  const title =
    pickLocalizedValue(copy.title, lang) ||
    pickLocalizedValue(getByPath(attrs, "content.hero_title"), lang) ||
    resolveTitle(item, lang);
  const subtitle =
    pickLocalizedValue(copy.subtitle, lang) ||
    pickLocalizedValue(getByPath(attrs, "content.hero_subtitle"), lang) ||
    pickLocalizedValue(getByPath(attrs, "content.tagline"), lang) ||
    resolveMeta(item, lang);
  return { kicker: kicker || "", title: title || "", subtitle: subtitle || "" };
}

function resolveRating(attrs) {
  const rating =
    attrs?.rating?.value ??
    attrs?.rating?.avg ??
    attrs?.reviews?.avg ??
    attrs?.review?.avg ??
    attrs?.rating_avg;
  return Number.isFinite(Number(rating)) ? Number(rating) : null;
}

function buildCard(item, lang, priceContext = null) {
  const attrs = item?.attrs || {};
  const media = pickMedia(item);
  const summaryRating = Number(item?.review_summary?.average_rating);
  const resolvedRating = Number.isFinite(summaryRating) && summaryRating > 0
    ? summaryRating
    : resolveRating(attrs);
  return {
    id: item?.id || item?.code,
    code: item?.code,
    title: resolveTitle(item, lang),
    meta: resolveMeta(item, lang),
    price: formatPrice(attrs, priceContext),
    rating: resolvedRating,
    image: media.hero,
    gallery: media.gallery,
    documents: media.documents,
    raw: item,
  };
}

function toVariantText(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
}

function humanizeVariantKey(key) {
  const text = String(key || "").trim();
  if (!text) return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildVariantTable(item) {
  const variants = item?.raw?.attrs?.variants || item?.attrs?.variants || {};
  const list = Array.isArray(variants?.items) ? variants.items : [];
  const reserved = new Set(["id", "active", "stock_qty", "price_delta", "hasData"]);
  const headerList = Array.isArray(variants?.headers) ? variants.headers : [];
  const columns = headerList
    .map((header) => {
      const key = String(header?.key || "").trim();
      if (!key || reserved.has(key)) return null;
      return {
        key,
        label: String(header?.label || "").trim() || humanizeVariantKey(key) || key
      };
    })
    .filter(Boolean);
  const columnSet = new Set();
  columns.forEach((column) => columnSet.add(column.key));

  const rows = list
    .map((entry, index) => {
      const active = entry?.active !== false;
      const stockQtyRaw = Number(entry?.stock_qty);
      const stockQty = Number.isFinite(stockQtyRaw) ? stockQtyRaw : null;
      const status = active && (stockQty === null || stockQty > 0) ? "in_stock" : "out_of_stock";
      const attrs = {};

      Object.entries(entry || {}).forEach(([key, value]) => {
        if (reserved.has(key)) return;
        if (value && typeof value === "object") return;
        const normalized = toVariantText(value);
        attrs[key] = normalized || "";
        if (!columnSet.has(key)) {
          columnSet.add(key);
          columns.push({ key, label: humanizeVariantKey(key) || key });
        }
      });

      const hasPayload =
        Object.values(attrs).some((value) => String(value || "").trim().length > 0) ||
        !active ||
        stockQty !== null;
      if (!hasPayload) return null;

      return {
        key: String(entry?.id || `variant-${index + 1}`),
        attrs,
        status,
      };
    })
    .filter(Boolean);

  return { columns, rows };
}

function getCategory(item) {
  const attrs = item?.attrs || {};
  return (
    attrs?.taxonomy?.category ||
    attrs?.category ||
    attrs?.content?.category ||
    ""
  );
}

function getDifficulty(item) {
  const attrs = item?.attrs || {};
  return (
    attrs?.content?.difficulty ||
    attrs?.difficulty ||
    attrs?.level ||
    ""
  );
}

function getPriceValue(item, priceContext = null) {
  const attrs = item?.attrs || {};
  const details = resolveDisplayPriceForAttrs(attrs, priceContext);
  return Number.isFinite(details.amount) ? details.amount : null;
}

function formatCopy(template, params) {
  if (!template || !params) return template;
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, String(template));
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const source = `; ${document.cookie || ""}`;
  const parts = source.split(`; ${name}=`);
  if (parts.length < 2) return "";
  return decodeURIComponent(parts.pop().split(";").shift() || "");
}

function resolveCopy(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

function resolveFavoriteOwner(member) {
  if (!member || typeof member !== "object") return "";
  const candidates = [
    member.identity_id,
    member.id,
    member.login,
    member.username,
    member.email,
    member.display_name,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim().toLowerCase();
    if (value) return value;
  }
  return "";
}

function buildFavoritesStorageKey(member) {
  const owner = resolveFavoriteOwner(member);
  if (!owner) return "";
  return `${FAVORITES_STORAGE_KEY_PREFIX}-${owner}`;
}

function loadStoredFavorites(storageKey) {
  if (!storageKey || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.reduce((acc, key) => {
        const normalized = String(key || "").trim();
        if (normalized) acc[normalized] = true;
        return acc;
      }, {});
    }
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).reduce((acc, [key, value]) => {
        const normalized = String(key || "").trim();
        if (normalized && value) acc[normalized] = true;
        return acc;
      }, {});
    }
    return {};
  } catch {
    return {};
  }
}

function resolveFavoriteKey(item) {
  return String(item?.code || item?.id || "").trim();
}

function getSlotItem(contentBySlot, slot) {
  if (!contentBySlot || typeof contentBySlot !== "object" || !slot) return null;
  const item = contentBySlot[slot];
  return item && typeof item === "object" ? item : null;
}

function getHomeProductSlotItem(contentBySlot, key) {
  return (
    getSlotItem(contentBySlot, HOME_PRODUCT_SLOTS[key]) ||
    getSlotItem(contentBySlot, LEGACY_HOME_PRODUCT_SLOTS[key])
  );
}

function getSlotSlides(contentBySlot, slot) {
  const item = getSlotItem(contentBySlot, slot);
  if (!item || !Array.isArray(item.slides)) return [];
  return item.slides.filter((slide) => slide && typeof slide === "object");
}

function resolveSlotTranslatedField(slotItem, path, lang, fallbackValue = "") {
  const translated = resolveTranslatedPath(slotItem?.translation, path, lang);
  if (translated) return translated;
  return String(fallbackValue || "").trim();
}

function resolveInfoHeroFromSlot(contentBySlot, slot, fallback = {}, lang = "en") {
  const slotItem = getSlotItem(contentBySlot, slot);
  const slides = getSlotSlides(contentBySlot, slot);
  const primaryIndex = slides.findIndex((slide) =>
    String(slide.title || "").trim() ||
    String(slide.subtitle || "").trim() ||
    String(slide.body || "").trim() ||
    String(slide.eyebrow || "").trim()
  );
  const primary = primaryIndex >= 0 ? slides[primaryIndex] : null;
  if (!primary) return { ...fallback };
  const imageRaw = String(primary.image || primary.image_url || "").trim();
  const ctaTarget = String(
    primary?.cta?.target ||
      primary?.cta_target ||
      primary?.cta_url ||
      ""
  ).trim();
  const ctaActionRaw = String(primary?.cta?.action || primary?.cta_action || "").trim().toLowerCase();
  const ctaAction = ["navigate_internal", "navigate_external", "scroll_to"].includes(ctaActionRaw)
    ? ctaActionRaw
    : /^https?:\/\//i.test(ctaTarget)
      ? "navigate_external"
      : ctaTarget.startsWith("#")
        ? "scroll_to"
        : "navigate_internal";
  const ctaNewTabRaw =
    primary?.cta?.new_tab ??
    primary?.cta_new_tab ??
    primary?.cta?.newTab ??
    primary?.cta_newTab;
  const eyebrow = resolveSlotTranslatedField(
    slotItem,
    `slides.${primaryIndex}.eyebrow`,
    lang,
    primary.eyebrow
  );
  const title = resolveSlotTranslatedField(
    slotItem,
    `slides.${primaryIndex}.title`,
    lang,
    primary.title
  );
  const subtitle = resolveSlotTranslatedField(
    slotItem,
    `slides.${primaryIndex}.subtitle`,
    lang,
    primary.subtitle
  ) || resolveSlotTranslatedField(slotItem, `slides.${primaryIndex}.body`, lang, primary.body);
  const ctaLabel = resolveSlotTranslatedField(
    slotItem,
    `slides.${primaryIndex}.cta_label`,
    lang,
    primary.cta_label || primary.ctaLabel
  );
  return {
    ...fallback,
    eyebrow: eyebrow || fallback.eyebrow || "",
    title: title || fallback.title || "",
    subtitle: subtitle || fallback.subtitle || "",
    image: imageRaw ? resolveAssetUrl(imageRaw) : fallback.image || "",
    ctaLabel: ctaLabel || fallback.ctaLabel || "",
    ctaTarget: ctaTarget || fallback.ctaTarget || "",
    ctaAction,
    ctaNewTab: ctaNewTabRaw === true || String(ctaNewTabRaw || "").toLowerCase() === "true",
  };
}

function mapStorefrontSlideToInfoCard(slide, index = 0, translationMeta = null, lang = "en") {
  const imageRaw = String(slide?.image || slide?.image_url || "").trim();
  const ctaTarget = String(
    slide?.cta?.target ||
      slide?.cta_target ||
      slide?.cta_url ||
      ""
  ).trim();
  const title = resolveTranslatedPath(translationMeta, `slides.${index}.title`, lang);
  const subtitle = resolveTranslatedPath(translationMeta, `slides.${index}.subtitle`, lang);
  const body = resolveTranslatedPath(translationMeta, `slides.${index}.body`, lang);
  const eyebrow = resolveTranslatedPath(translationMeta, `slides.${index}.eyebrow`, lang);
  const ctaLabel = resolveTranslatedPath(translationMeta, `slides.${index}.cta_label`, lang);
  return {
    id: slide?.id || `slot-card-${index + 1}`,
    title: String(title || slide?.title || eyebrow || slide?.eyebrow || `Content ${index + 1}`).trim(),
    summary: String(subtitle || slide?.subtitle || body || slide?.body || "").trim(),
    owner: String(eyebrow || slide?.eyebrow || "Editorial").trim(),
    status: "Live",
    cta: String(ctaLabel || slide?.cta_label || slide?.ctaLabel || "Open").trim(),
    ctaTarget,
    ctaAction: String(slide?.cta?.action || slide?.cta_action || "").trim().toLowerCase() || "navigate_internal",
    ctaNewTab:
      slide?.cta?.new_tab === true ||
      slide?.cta_new_tab === true ||
      String(slide?.cta?.newTab || slide?.cta_newTab || "").toLowerCase() === "true",
    image: imageRaw ? resolveAssetUrl(imageRaw) : "",
  };
}

function resolveInfoCardsFromSlot(contentBySlot, slot, fallbackCards = [], lang = "en") {
  const slotItem = getSlotItem(contentBySlot, slot);
  const slides = getSlotSlides(contentBySlot, slot);
  const cards = slides
    .map((slide, index) => mapStorefrontSlideToInfoCard(slide, index, slotItem?.translation, lang))
    .filter((card) => card.title || card.summary);
  return cards.length ? cards : fallbackCards;
}

function getSlotContentItems(contentListsBySlot, slot) {
  if (!contentListsBySlot || typeof contentListsBySlot !== "object" || !slot) return [];
  const items = contentListsBySlot[slot];
  return Array.isArray(items) ? items.filter((item) => item && typeof item === "object") : [];
}

function mapStorefrontArticleToInfoCard(item, index = 0, lang = "en") {
  const article = item?.article && typeof item.article === "object" ? item.article : {};
  const ctaTarget = String(article.cta_target || article.cta_url || article?.cta?.target || "").trim();
  const translationMeta = item?.translation && typeof item.translation === "object" ? item.translation : null;
  const title = resolveTranslatedPath(translationMeta, "article.title", lang);
  const excerpt = resolveTranslatedPath(translationMeta, "article.excerpt", lang);
  const body = resolveTranslatedPath(translationMeta, "article.body", lang);
  const eyebrow = resolveTranslatedPath(translationMeta, "article.eyebrow", lang);
  const ctaLabel = resolveTranslatedPath(translationMeta, "article.cta_label", lang);
  return {
    id: item?.id || item?.code || `article-${index + 1}`,
    title: String(title || article.title || item?.title || `Article ${index + 1}`).trim(),
    summary: String(excerpt || article.excerpt || body || article.body || "").trim(),
    owner: String(eyebrow || article.eyebrow || "Editorial").trim(),
    status: String(item?.status || "Live").trim(),
    cta: String(ctaLabel || article.cta_label || "Open").trim(),
    ctaTarget,
    ctaAction: String(article.cta_action || article?.cta?.action || "").trim().toLowerCase() || "navigate_internal",
    ctaNewTab:
      article.cta_new_tab === true ||
      article?.cta?.new_tab === true ||
      String(article?.cta?.newTab || "").toLowerCase() === "true",
    image: article.image ? resolveAssetUrl(article.image) : "",
  };
}

function normalizePublicBlogPost(post, index = 0) {
  if (!post || typeof post !== "object") return null;
  const imageCandidates = Array.isArray(post.image_urls)
    ? post.image_urls
    : Array.isArray(post.images)
      ? post.images
      : [];
  const images = imageCandidates
    .map((item) => resolveAssetUrl(item))
    .filter(Boolean);
  const primaryImage = post.image_url
    ? resolveAssetUrl(post.image_url)
    : post.image
      ? resolveAssetUrl(post.image)
      : "";
  if (primaryImage && !images.includes(primaryImage)) {
    images.unshift(primaryImage);
  }
  return {
    id: String(post.id || post.code || `blog-${index + 1}`),
    code: String(post.code || post.id || `blog-${index + 1}`),
    author: String(post.author?.name || "Creator").trim(),
    authorIdentityId: String(
      post.owner_identity_id ||
      post.author?.identity_id ||
      ""
    ).trim(),
    role: String(post.author?.role || "Member").trim(),
    postedAt: post.created_at ? new Date(post.created_at).toLocaleDateString() : "Now",
    title: String(post.title || "Untitled post").trim(),
    body: String(post.body || "").trim(),
    image: images[0] || "",
    images,
    likes: Number.isFinite(Number(post.metrics?.likes)) ? Number(post.metrics.likes) : 0,
    dislikes: Number.isFinite(Number(post.metrics?.dislikes)) ? Number(post.metrics.dislikes) : 0,
    comments: Number.isFinite(Number(post.metrics?.comments)) ? Number(post.metrics.comments) : 0,
    tags: Array.isArray(post.tags) ? post.tags.map((tag) => String(tag || "").trim()).filter(Boolean) : [],
  };
}

function useTranslator(lang) {
  return useMemo(() => {
    const dict = COPY[lang] || COPY.en;
    return (key) => {
      const value = getByPath(dict, key);
      if (value !== undefined) return value;
      const fallback = getByPath(COPY.en, key);
      return fallback !== undefined ? fallback : key;
    };
  }, [lang]);
}

function UiIcon({ name, className = "ui-icon" }) {
  const paths = {
    cart: "M3 4h2.2l1.2 8.4A2 2 0 0 0 8.4 14h8.8a2 2 0 0 0 2-1.6L21 7H7.1M9 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01",
    arrowRight: "M5 12h14M13 6l6 6-6 6",
    chevronLeft: "m15 18-6-6 6-6",
    chevronRight: "m9 18 6-6-6-6",
    bookOpen:
      "M3 5a2 2 0 0 1 2-2h4a4 4 0 0 1 4 4v12a4 4 0 0 0-4-4H5a2 2 0 0 1-2-2V5zm18 0a2 2 0 0 0-2-2h-4a4 4 0 0 0-4 4v12a4 4 0 0 1 4-4h4a2 2 0 0 0 2-2V5z",
    calendar: "M7 3v4M17 3v4M4 8h16M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1z",
    comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    eyeOff: "M3 3l18 18M9.9 4.6A11.2 11.2 0 0 1 12 4c6.5 0 10 8 10 8a19.6 19.6 0 0 1-4.4 5.5M14.1 14.1a3 3 0 0 1-4.2-4.2M6.5 6.5A20 20 0 0 0 2 12s3.5 8 10 8c1 0 2-.2 3-.5",
    checkout: "M3 7h18M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 6h4",
    close: "M6 6l12 12M18 6 6 18",
    send: "M3 11.5 21 3l-6.6 18-2.9-7.4L3 11.5zM11.5 13.6 21 3",
    save: "M5 4h12l3 3v13H4V4h1zm3 0v5h8V4M8 20v-6h8v6",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    playCircle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM10 8l6 4-6 4z",
    trash: "M3 6h18M8 6V4h8v2M7 6l1 14h8l1-14M10 10v7M14 10v7",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    back: "M19 12H5M11 18l-6-6 6-6",
    user: "M12 13.6a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 7.4a8 8 0 0 1 16 0",
    userPlus: "M12 13.6a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 7.4a8 8 0 0 1 12.8-6.2M20 9v6M17 12h6",
    thumbUp:
      "M14 9V5a2 2 0 0 0-2-2l-1 6-2.8 3v9h9.1a2 2 0 0 0 2-1.6l1.2-6a2 2 0 0 0-2-2.4H14zM7 12H4v9h3",
    thumbDown:
      "M10 15v4a2 2 0 0 0 2 2l1-6 2.8-3V3H6.7a2 2 0 0 0-2 1.6l-1.2 6a2 2 0 0 0 2 2.4H10zM17 3h3v9h-3",
    chevronDown: "m6 9 6 6 6-6",
    heart: "M20.8 5.8a5 5 0 0 0-7.1 0L12 7.5l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.7l8.8-8.8a5 5 0 0 0 0-7.1z",
  };
  const d = paths[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

function Header({
  activePage,
  onNavigate,
  marketplaceValue,
  marketplaceOptions,
  onMarketplaceChange,
  onOpenCart,
  memberUser,
  onOpenLoginPicker,
  onOpenAccount,
  onOpenProfile,
  onSignOut,
  cartCount,
  t,
}) {
  const navItems = activePage === "patterns" || activePage === "product" || activePage === "account" || activePage === "profile"
    ? PATTERNS_NAV
    : HOME_NAV;
  const memberLabel =
    memberUser?.username ||
    memberUser?.display_name ||
    memberUser?.login ||
    "";
  const accountLabel = resolveCopy(t, "nav.account", "Account");
  const profileLabel = resolveCopy(t, "account.profile", "Profile");
  const signInLabel = resolveCopy(t, "nav.signIn", "Sign in");
  const profileButtonLabel = memberUser ? profileLabel : signInLabel;
  const greetingLabel = memberUser ? `Hello ${memberLabel || profileButtonLabel}` : profileButtonLabel;
  const isActiveNav = (id) => {
    if (id === "patterns") return activePage === "patterns" || activePage === "product";
    return activePage === id;
  };

  return (
    <header className="samara-header">
      <div className="header-left">
        <button className="brand" type="button" onClick={() => onNavigate("home")}>
          Samara
        </button>
      </div>
      <nav className="samara-nav" aria-label="Primary navigation">
        {navItems.map((id) => (
          <button
            key={id}
            type="button"
            className={`nav-link ${isActiveNav(id) ? "is-active" : ""}`}
            onClick={() => onNavigate(id)}
          >
            {t(`nav.${id}`)}
          </button>
        ))}
      </nav>
      <div className="nav-controls">
        <label className="nav-lang">
          <img src={globeIcon} alt="" className="nav-lang-icon" />
          <select
            value={marketplaceValue}
            onChange={(event) => onMarketplaceChange(event.target.value)}
            disabled={!Array.isArray(marketplaceOptions) || marketplaceOptions.length === 0}
          >
            {(Array.isArray(marketplaceOptions) && marketplaceOptions.length
              ? marketplaceOptions
              : [{ code: "", label: "No marketplace configured" }]
            ).map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="nav-search" aria-label={t("nav.search")}>
          <img src={searchIcon} alt="" />
          <input type="search" placeholder={t("nav.search")} />
        </label>
        <button type="button" className="nav-cart" onClick={onOpenCart}>
          <UiIcon name="cart" />
          {t("nav.cart")}
          <span className="nav-cart-count">{cartCount}</span>
        </button>
        {memberUser ? (
          <details className="account-menu">
            <summary className="nav-profile-trigger">
              <UiIcon name="user" />
              <span>{greetingLabel}</span>
              <UiIcon name="chevronDown" className="ui-icon account-menu-caret" />
            </summary>
            <div className="account-menu-list">
              <button
                type="button"
                className="account-menu-item"
                onClick={(event) => {
                  onOpenAccount();
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                {accountLabel}
              </button>
              <button
                type="button"
                className="account-menu-item"
                onClick={(event) => {
                  onOpenProfile();
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                {profileLabel}
              </button>
              <button
                type="button"
                className="account-menu-item danger"
                onClick={(event) => {
                  onSignOut();
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                {t("nav.signOut")}
              </button>
            </div>
          </details>
        ) : (
          <button type="button" className="nav-profile-trigger" onClick={onOpenLoginPicker}>
            <UiIcon name="user" />
            <span>{profileButtonLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}

function Hero({ onCta, t, slides }) {
  return (
    <section data-eip-parent="home.hero" data-eip-page="home">
      <HeroViewportSlider
        className="home-hero-slider"
        slides={slides}
        intervalMs={6800}
        pauseAfterManualMs={11000}
        minHeight="clamp(440px, 74vh, 780px)"
        ariaLabel={t("hero.title")}
        onCta={onCta}
      />
    </section>
  );
}

function DropSection({ t, featuredItems, onShop, onOpenProduct, renderer }) {
  const fallback = {
    code: "",
    title: t("drop.productTitle"),
    meta: t("drop.productMeta"),
    price: "EUR 14",
    image: dropMain,
    gallery: dropGallery,
  };
  const items = Array.isArray(featuredItems) ? featuredItems.filter(Boolean) : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const featuredKey = useMemo(
    () => items.map((item) => item.id || item.code || item.title || "").join("|"),
    [items]
  );
  useEffect(() => {
    setActiveIndex(0);
  }, [featuredKey]);

  const hasManyFeatured = items.length > 1;
  const safeIndex = items.length ? ((activeIndex % items.length) + items.length) % items.length : 0;
  const product = items.length ? items[safeIndex] : fallback;
  const mainImage = product.image || dropMain;
  const maxDropGallery = Math.max(1, Number(EIP_CONFIG.dropGalleryMax) || 8);
  const gallery = product.gallery?.length ? product.gallery.slice(0, maxDropGallery) : dropGallery;
  const useCardCarousel =
    String(renderer || EIP_CONFIG.dropRenderer || "").toLowerCase() === "product_carousel";
  const carouselItems = [
    {
      id: "drop-main",
      title: product.title,
      subtitle: product.meta || t("drop.productMeta"),
      cover: mainImage,
    },
    ...gallery.map((image, index) => ({
      id: `drop-gallery-${index + 1}`,
      title: `${t("drop.kicker")} ${index + 1}`,
      subtitle: t("drop.subtitle"),
      cover: image,
    })),
  ];
  return (
    <section id="drop" className="drop" data-eip-parent="home.featured" data-eip-page="home">
      <div className="drop-image">
        {useCardCarousel ? (
          <FeaturedCoverflow
            compact
            autoPlay
            intervalMs={4600}
            items={carouselItems}
            ariaLabel="Featured pattern cards"
          />
        ) : (
          <img src={mainImage} alt="Featured pattern" />
        )}
      </div>
      <div className="drop-copy">
        <p className="drop-kicker">{t("drop.kicker")}</p>
        <h2>{t("drop.title")}</h2>
        <p className="drop-sub">{t("drop.subtitle")}</p>
        <div className="drop-feature">
          <h3>{product.title}</h3>
          {hasManyFeatured ? (
            <div className="drop-switcher">
              <button
                type="button"
                className="drop-switch-btn"
                onClick={() => setActiveIndex((prev) => (prev - 1 + items.length) % items.length)}
              >
                Prev
              </button>
              <span className="drop-switch-index">
                {safeIndex + 1}/{items.length}
              </span>
              <button
                type="button"
                className="drop-switch-btn"
                onClick={() => setActiveIndex((prev) => (prev + 1) % items.length)}
              >
                Next
              </button>
            </div>
          ) : null}
          <p>{product.meta || t("drop.productMeta")}</p>
          <span className="price">{product.price || "EUR 14"}</span>
          <button
            className="btn primary"
            type="button"
            onClick={() => {
              if (product?.code && typeof onOpenProduct === "function") {
                onOpenProduct(product);
                return;
              }
              if (typeof onShop === "function") onShop();
            }}
          >
            <UiIcon name="arrowRight" />
            {t("drop.cta")}
          </button>
        </div>
      </div>
      <div className="drop-collage">
        {gallery.map((image, index) => (
          <img
            key={image}
            src={image}
            alt="Pattern preview"
            className={`collage-img collage-${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function WorthMaking({ onShop, onOpenProduct, t, items, useFallback, renderer }) {
  const fallback = WORTH_ITEMS.map((item) => ({
    id: item.id,
    title: t(`products.worth.${item.id}.name`),
    meta: t(`products.worth.${item.id}.meta`),
    price: item.price,
    image: item.image,
  }));
  const list = items && items.length ? items : useFallback ? fallback : [];
  const maxWorthCards = Math.max(1, Number(EIP_CONFIG.worthMaxCards) || 24);
  const useWorthCarousel =
    String(renderer || EIP_CONFIG.worthRenderer || "").toLowerCase() === "product_carousel";
  const carouselItems = list.slice(0, maxWorthCards).map((item, index) => ({
    id: item.id || `worth-card-${index + 1}`,
    code: item.code || "",
    title: item.title,
    subtitle: item.meta || "",
    cover: item.image || pattern1,
    price: item.price || "EUR 14",
  }));
  return (
    <section id="worth" className="worth" data-eip-parent="home.worth_making" data-eip-page="home">
      <div className="section-head">
        <h2>{t("worth.title")}</h2>
        <p>{t("worth.subtitle")}</p>
      </div>
      {useWorthCarousel ? (
        carouselItems.length ? (
          <div className="worth-coverflow">
            <FeaturedCoverflow
              items={carouselItems}
              ariaLabel="Worth making patterns carousel"
              autoPlay
              intervalMs={5200}
              showActiveDetails
              theme="paper"
              onActiveClick={(item) => {
                if (item?.code && typeof onOpenProduct === "function") {
                  onOpenProduct(item);
                  return;
                }
                if (typeof onShop === "function") onShop();
              }}
            />
          </div>
        ) : (
          <p className="samara-alert">{t("patterns.empty")}</p>
        )
      ) : (
        <div className="worth-grid">
          {list.map((item, index) => (
            <article key={item.id || `worth-${index}`} className="worth-card">
              <button
                type="button"
                className="pattern-image-btn"
                onClick={() => {
                  if (item?.code && typeof onOpenProduct === "function") {
                    onOpenProduct(item);
                    return;
                  }
                  if (typeof onShop === "function") onShop();
                }}
              >
                <img src={item.image || pattern1} alt={item.title || "Pattern"} />
              </button>
              <div className="worth-body">
                <h3>{item.title}</h3>
                <p>{item.meta || t("drop.productMeta")}</p>
                <span>{item.price || "EUR 14"}</span>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-actions">
        <button className="btn primary" type="button" onClick={onShop}>
          <UiIcon name="arrowRight" />
          {t("worth.cta")}
        </button>
      </div>
    </section>
  );
}

function ProcessSection({ t }) {
  return (
    <section id="process" className="process" data-eip-parent="home.process" data-eip-page="home">
      <div className="process-left">
        <h2>{t("process.title")}</h2>
        <div className="process-steps">
          {PROCESS_STEPS.map((step) => (
            <div key={step} className="process-step">
              <span className="process-dot" />
              <div>
                <p className="process-title">{t(`process.steps.${step}.title`)}</p>
                <p className="process-desc">{t(`process.steps.${step}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="process-logos">
        <p>VOGUE</p>
        <p>WHO WHAT WEAR</p>
        <p>REFINERY29</p>
      </div>
    </section>
  );
}

function CommunitySection({ t, onSubscribe, onLookbook }) {
  return (
    <section
      id="community"
      className="community"
      style={{ backgroundImage: `url(${communityImg})` }}
      data-eip-parent="home.community"
      data-eip-page="home"
    >
      <div className="community-content">
        <p className="community-kicker">{t("community.kicker")}</p>
        <h2>{t("community.title")}</h2>
        <div className="community-points">
          <div>
            <span className="icon" aria-hidden="true" />
            <p>{t("community.point1")}</p>
          </div>
          <div>
            <span className="icon" aria-hidden="true" />
            <p>{t("community.point2")}</p>
          </div>
          <div>
            <span className="icon" aria-hidden="true" />
            <p>{t("community.point3")}</p>
          </div>
        </div>
        <div className="community-actions">
          <button className="btn ghost" type="button" onClick={onLookbook}>
            <UiIcon name="eye" />
            {t("community.lookbook")}
          </button>
          <button className="btn primary" type="button" onClick={onSubscribe}>
            <UiIcon name="send" />
            {t("community.subscribe")}
          </button>
        </div>
      </div>
    </section>
  );
}

function HomePage({
  onShop,
  onOpenProduct,
  onHeroCta,
  onLookbook,
  onSubscribe,
  t,
  heroSlides,
  featuredItems,
  worthItems,
  featuredRenderer,
  worthRenderer,
  loading,
  plugReady,
}) {
  return (
    <main className="page home">
      <Hero onCta={onHeroCta} t={t} slides={heroSlides} />
      <DropSection t={t} featuredItems={featuredItems} onShop={onShop} onOpenProduct={onOpenProduct} renderer={featuredRenderer} />
      <WorthMaking onShop={onShop} onOpenProduct={onOpenProduct} t={t} items={worthItems} useFallback={!plugReady} renderer={worthRenderer} />
      {!plugReady ? (
        <p className="samara-alert">{t("alerts.connectEip")}</p>
      ) : loading ? (
        <p className="samara-alert">{t("alerts.refreshingFeatured")}</p>
      ) : null}
      <ProcessSection t={t} />
      <CommunitySection t={t} onSubscribe={onSubscribe} onLookbook={onLookbook} />
    </main>
  );
}

function Star({ filled }) {
  return (
    <svg
      className={`rating-star ${filled ? "is-filled" : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.6l2.9 5.88 6.5.94-4.7 4.58 1.1 6.48L12 18.9l-5.8 3.06 1.1-6.48L2.6 10.4l6.5-.94L12 3.6z" />
    </svg>
  );
}

function Rating({ value }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const stars = Math.round(value * 2) / 2;
  return (
    <span className="rating">
      {[1, 2, 3, 4, 5].map((slot) => (
        <Star key={slot} filled={stars >= slot - 0.2} />
      ))}
      <span className="rating-count">({value.toFixed(1)})</span>
    </span>
  );
}

function PatternsPage({
  t,
  items,
  useFallback,
  loading,
  error,
  filters,
  onFilterChange,
  page,
  pages,
  onPageChange,
  canNext,
  showingText,
  onView,
  onAddToCart,
  onCheckout,
  onToggleFavorite,
  isFavorite,
  canOrder,
  previewCode,
}) {
  const fallback = PATTERN_ITEMS.map((item) => ({
    id: item.id,
    title: t(`products.list.${item.id}.name`),
    meta: t(`products.list.${item.id}.meta`),
    price: item.price,
    rating: item.rating,
    image: item.image,
  }));
  const list = items && items.length ? items : useFallback ? fallback : [];
  return (
    <main className="page patterns">
      <section className="patterns-hero">
        <h1>{t("patterns.title")}</h1>
        <p>{t("patterns.subtitle")}</p>
      </section>
      <section className="patterns-toolbar">
        <div className="filters">
          <label>
            {t("filters.category")}
            <select
              value={filters.category}
              onChange={(event) => onFilterChange({ category: event.target.value })}
            >
              {FILTER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`filters.${option.key}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filters.difficulty")}
            <select
              value={filters.difficulty}
              onChange={(event) => onFilterChange({ difficulty: event.target.value })}
            >
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`filters.${option.key}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("filters.sortBy")}
            <select
              value={filters.sortBy}
              onChange={(event) => onFilterChange({ sortBy: event.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`filters.${option.key}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="pagination">
          {pages.map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={pageNum === page ? "is-active" : ""}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}
          <button type="button" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
            {t("pagination.next")}
          </button>
        </div>
      </section>
      {error ? <p className="samara-alert">{error}</p> : null}
      {!error && loading ? <p className="samara-alert">{t("patterns.refreshing")}</p> : null}
      {!error && !loading && !list.length && !useFallback ? (
        <p className="samara-alert">{t("patterns.empty")}</p>
      ) : null}
      {previewCode ? (
        <p className="samara-alert">Preview mode: {previewCode}</p>
      ) : null}
      <section className="patterns-grid">
        {list.map((item, index) => {
          const favoriteActive = Boolean(isFavorite?.(item));
          return (
            <article
              key={item.id || `pattern-${index}`}
              className={`pattern-card ${
                previewCode && (item.code === previewCode || item.id === previewCode) ? "is-preview" : ""
              }`}
            >
            <button
              type="button"
              className={`pattern-favorite-btn ${favoriteActive ? "is-active" : ""}`}
              onClick={() => onToggleFavorite?.(item)}
              disabled={!resolveFavoriteKey(item)}
              aria-label={
                favoriteActive
                  ? resolveCopy(t, "patterns.favoriteRemove", "Remove from favourites")
                  : resolveCopy(t, "patterns.favoriteAdd", "Add to favourites")
              }
              data-tip={
                favoriteActive
                  ? resolveCopy(t, "patterns.favoriteRemove", "Remove from favourites")
                  : resolveCopy(t, "patterns.favoriteAdd", "Add to favourites")
              }
            >
              <UiIcon name="heart" />
            </button>
            <button
              type="button"
              className="pattern-image-btn"
              onClick={() => onView?.(item)}
              disabled={!item.code}
              aria-label={t("patterns.view")}
            >
              <img src={item.image || pattern1} alt={item.title || "Pattern"} />
            </button>
            <div className="pattern-body">
              <h3>{item.title}</h3>
              <p>{item.meta || t("drop.productMeta")}</p>
              {item.rating !== null ? <Rating value={item.rating} /> : null}
              <div className="pattern-footer">
                <span>{item.price || "EUR 14"}</span>
                <div className="pattern-actions">
                  <button
                    type="button"
                    className="btn small ghost icon-only"
                    onClick={() => onView?.(item)}
                    disabled={!item.code}
                    aria-label={t("patterns.view")}
                    data-tip={t("patterns.view")}
                  >
                    <UiIcon name="eye" />
                  </button>
                  <button
                    type="button"
                    className="btn small icon-only"
                    disabled={!canOrder || !item.code}
                    onClick={() => onAddToCart?.(item)}
                    aria-label={t("cart.add")}
                    data-tip={t("cart.add")}
                  >
                    <UiIcon name="cart" />
                  </button>
                  <button
                    type="button"
                    className="btn small ghost icon-only"
                    disabled={!canOrder || !item.code}
                    onClick={() => onCheckout?.(item)}
                    aria-label={t("cart.checkoutNow")}
                    data-tip={t("cart.checkoutNow")}
                  >
                    <UiIcon name="checkout" />
                  </button>
                </div>
              </div>
            </div>
            </article>
          );
        })}
      </section>
      <section className="patterns-footer">
        <p>{showingText || t("patterns.showing")}</p>
        <div className="pagination">
          {pages.map((pageNum) => (
            <button
              key={`footer-${pageNum}`}
              type="button"
              className={pageNum === page ? "is-active" : ""}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          ))}
          <button type="button" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
            {t("pagination.next")}
          </button>
        </div>
      </section>
    </main>
  );
}

function RatingInput({ value, onChange }) {
  const current = Number(value) || 0;
  return (
    <div className="rating-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={current === star}
          className={`rating-input-star ${current >= star ? "is-filled" : ""}`}
          onClick={() => onChange(star)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ProductDetailPage({
  t,
  language = "en",
  item,
  loading,
  error,
  onBack,
  canOrder,
  onAddToCart,
  onCheckout,
  reviews,
  summary,
  reviewsLoading,
  reviewsError,
  reviewForm,
  onReviewChange,
  onReviewSubmit,
  reviewSubmitState,
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const gallery = useMemo(() => {
    const source = [item?.image, ...(Array.isArray(item?.gallery) ? item.gallery : [])].filter(Boolean);
    return Array.from(new Set(source));
  }, [item]);
  const variantTable = useMemo(() => buildVariantTable(item), [item]);

  useEffect(() => {
    setActiveMediaIndex(0);
  }, [item?.code]);

  if (loading) {
    return (
      <main className="page product-detail">
        <p className="samara-alert">{t("patterns.refreshing")}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page product-detail">
        <button type="button" className="btn ghost" onClick={onBack}>
          {t("product.back")}
        </button>
        <p className="samara-alert">{error}</p>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="page product-detail">
        <button type="button" className="btn ghost" onClick={onBack}>
          {t("product.back")}
        </button>
        <p className="samara-alert">{t("patterns.empty")}</p>
      </main>
    );
  }

  const itemTranslation = getItemTranslationMeta(item);
  const descriptionValue =
    resolveTranslatedPath(itemTranslation, "content.description", language) ||
    resolveTranslatedPath(itemTranslation, "content.summary", language) ||
    item?.raw?.attrs?.content?.summary ||
    item?.raw?.attrs?.content?.description ||
    item?.meta ||
    "";
  const descriptionHtml = resolveRenderableContent(descriptionValue, language);
  const hasDescriptionMarkup = /<[^>]+>/.test(descriptionHtml);
  const reviewAverage = Number(summary?.average_rating || item.rating || 0);
  const reviewTotal = Number(summary?.total || 0);
  const distribution = summary?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return (
    <main className="page product-detail">
      <button type="button" className="product-back" onClick={onBack}>
        <UiIcon name="back" />
        {t("product.back")}
      </button>

      <section className="product-layout">
        <div className="product-media-panel">
          <div className="product-media-main">
            <img src={gallery[activeMediaIndex] || item.image || pattern1} alt={item.title || "Product"} />
          </div>
          {gallery.length > 1 ? (
            <div className="product-media-strip">
              {gallery.map((mediaUrl, index) => (
                <button
                  key={`${mediaUrl}-${index}`}
                  type="button"
                  className={`thumb-btn ${index === activeMediaIndex ? "is-active" : ""}`}
                  onClick={() => setActiveMediaIndex(index)}
                >
                  <img src={mediaUrl} alt={`${item.title} ${index + 1}`} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-main-panel">
          <h1>{item.title}</h1>
          <section className="product-description">
            {hasDescriptionMarkup ? (
              <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
            ) : (
              <p>{descriptionHtml || stripHtmlToText(item?.meta || "")}</p>
            )}
          </section>
          {variantTable.rows.length ? (
            <section className="product-variants">
              <h3>{resolveCopy(t, "product.variants", "Variants & stock")}</h3>
              <div className="product-variants-wrap">
                <table className="product-variants-table">
                  <thead>
                    <tr>
                      {variantTable.columns.map((column) => (
                        <th key={`col-${column.key}`}>{column.label}</th>
                      ))}
                      <th>{resolveCopy(t, "product.variantStatus", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variantTable.rows.map((variant) => (
                      <tr key={variant.key}>
                        {variantTable.columns.map((column) => (
                          <td key={`${variant.key}-${column.key}`}>
                            {variant.attrs[column.key] || "—"}
                          </td>
                        ))}
                        <td>
                          {variant.status === "in_stock"
                            ? resolveCopy(t, "product.variantInStock", "In stock")
                            : resolveCopy(t, "product.variantOutOfStock", "Out of stock")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="product-buy-panel">
          <p className="product-price">{item.price || "EUR 14"}</p>
          <p className="product-note">{t("product.shipping")}</p>
          <p className="product-note">{t("product.secure")}</p>
          <button
            type="button"
            className="btn primary product-order-btn"
            disabled={!canOrder || !item.code}
            onClick={() => onAddToCart?.(item)}
          >
            <UiIcon name="cart" />
            {t("cart.add")}
          </button>
          <button
            type="button"
            className="btn ghost product-order-btn"
            disabled={!canOrder || !item.code}
            onClick={() => onCheckout?.(item)}
          >
            <UiIcon name="checkout" />
            {t("cart.checkoutNow")}
          </button>
        </aside>
      </section>

      <section className="product-reviews-section">
        <div className="review-summary">
          <h2>{t("reviews.title")}</h2>
          <p>{t("reviews.subtitle")}</p>
          <div className="review-average">
            <span className="value">{reviewAverage ? reviewAverage.toFixed(1) : "0.0"}</span>
            <Rating value={reviewAverage || 0} />
          </div>
          <div className="review-bars">
            {[5, 4, 3, 2, 1].map((score) => {
              const count = Number(distribution[score] || 0);
              const pct = reviewTotal ? Math.round((count / reviewTotal) * 100) : 0;
              return (
                <div key={`bar-${score}`} className="review-bar-row">
                  <span>{score}★</span>
                  <div className="bar-track">
                    <span className="bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="review-list">
          {reviewsError ? <p className="samara-alert">{reviewsError}</p> : null}
          {reviewsLoading ? <p className="samara-alert">{t("patterns.refreshing")}</p> : null}
          {!reviewsLoading && !reviews.length ? <p>{t("reviews.empty")}</p> : null}
          {reviews.map((review) => (
            <article key={review.id} className="review-item">
              <header>
                <strong>{review.title || "Review"}</strong>
                <Rating value={Number(review.rating) || 0} />
              </header>
              <p>{review.comment}</p>
              <footer>
                <span>{review.reviewer?.name || "Anonymous"}</span>
                {review.reviewer?.verified_purchase ? <span>Verified purchase</span> : null}
              </footer>
            </article>
          ))}
        </div>

        <form className="review-form" onSubmit={onReviewSubmit}>
          <h3>{t("reviews.writeTitle")}</h3>
          <p>{t("reviews.writeHint")}</p>
          <label>
            {t("reviews.rating")}
            <RatingInput
              value={reviewForm.rating}
              onChange={(value) => onReviewChange("rating", value)}
            />
          </label>
          <label>
            {t("reviews.headline")}
            <input
              value={reviewForm.title}
              onChange={(event) => onReviewChange("title", event.target.value)}
            />
          </label>
          <label>
            {t("reviews.comment")}
            <textarea
              rows={5}
              value={reviewForm.comment}
              onChange={(event) => onReviewChange("comment", event.target.value)}
            />
          </label>
          <label>
            {t("reviews.name")}
            <input
              value={reviewForm.name}
              onChange={(event) => onReviewChange("name", event.target.value)}
            />
          </label>
          <label>
            {t("reviews.email")}
            <input
              value={reviewForm.email}
              onChange={(event) => onReviewChange("email", event.target.value)}
            />
          </label>
          {reviewSubmitState.error ? <p className="modal-alert error">{reviewSubmitState.error}</p> : null}
          {reviewSubmitState.success ? (
            <p className="modal-alert success">
              {reviewSubmitState.pending ? t("reviews.pending") : t("reviews.success")}
            </p>
          ) : null}
          <button type="submit" className="btn primary" disabled={reviewSubmitState.loading}>
            <UiIcon name="send" />
            {reviewSubmitState.loading ? t("reviews.submitting") : t("reviews.submit")}
          </button>
        </form>
      </section>
    </main>
  );
}

function AccountPage({ t, memberUser, historyItems, historyLoading, onOpenLogin }) {
  if (!memberUser) {
    return (
      <main className="page account-page">
        <section className="account-card">
          <h1>{t("account.title")}</h1>
          <p>{t("account.signInPrompt")}</p>
          <button type="button" className="btn" onClick={onOpenLogin}>
            {t("nav.signIn")}
          </button>
        </section>
      </main>
    );
  }

  const safeHistory = Array.isArray(historyItems) ? historyItems : [];
  const paidOrders = safeHistory.filter((item) => String(item.status || "").toLowerCase() === "paid");
  const totalSpent = paidOrders.reduce((sum, item) => {
    const amount = toNumericAmount(item.total);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const activityCards = [
    {
      key: "orders",
      label: t("account.orders"),
      value: String(safeHistory.length),
    },
    {
      key: "spent",
      label: resolveCopy(t, "account.totalSpent", "Total spent"),
      value: totalSpent > 0 ? totalSpent.toFixed(2) : "0.00",
    },
    {
      key: "sales",
      label: resolveCopy(t, "account.patternSales", "Pattern sales"),
      value: resolveCopy(t, "account.comingSoonValue", "Coming soon"),
    },
    {
      key: "commission",
      label: resolveCopy(t, "account.commission", "Commission"),
      value: resolveCopy(t, "account.comingSoonValue", "Coming soon"),
    },
  ];

  return (
    <main className="page account-page">
      <section className="account-card">
        <h1>{t("account.title")}</h1>
        <p>{t("account.subtitle")}</p>
      </section>

      <section className="account-metrics">
        {activityCards.map((card) => (
          <article key={card.key} className="account-metric-card">
            <p className="account-metric-label">{card.label}</p>
            <strong className="account-metric-value">{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="account-grid">
        <article className="account-panel">
          <h3>{t("account.orders")}</h3>
          {historyLoading ? <p className="samara-alert">{t("patterns.refreshing")}</p> : null}
          {!historyLoading && !historyItems.length ? <p>{t("account.noOrders")}</p> : null}
          <div className="account-order-list">
            {historyItems.map((item) => (
              <div key={item.id} className="account-order-row">
                <div>
                  <strong>{item.code || "Order"}</strong>
                  <p>{item.status || "new"}</p>
                </div>
                <div className="account-order-meta">
                  <span>{item.currency || ""}</span>
                  <span>{Number.isFinite(Number(item.total)) ? Number(item.total).toFixed(2) : "--"}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="account-panel">
          <h3>{t("account.patterns")}</h3>
          <p>{t("account.patternsHint")}</p>
        </article>

        <article className="account-panel">
          <h3>{t("account.blogs")}</h3>
          <p>{t("account.blogsHint")}</p>
        </article>
      </section>
    </main>
  );
}

function ProfilePage({ t, memberUser, form, onChange, onSubmit, status, onOpenLogin }) {
  if (!memberUser) {
    return (
      <main className="page account-page">
        <section className="account-card">
          <h1>{resolveCopy(t, "account.profile", "Profile")}</h1>
          <p>{t("account.signInPrompt")}</p>
          <button type="button" className="btn" onClick={onOpenLogin}>
            {t("nav.signIn")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page account-page">
      <section className="account-card">
        <h1>{resolveCopy(t, "account.profile", "Profile")}</h1>
        <p>{resolveCopy(t, "account.profileHint", "Manage your account details and preferences.")}</p>
      </section>
      <section className="account-panel">
        <form className="modal-body profile-form" onSubmit={onSubmit}>
          <div className="field-grid-equal">
            <label>
              {resolveCopy(t, "profile.displayName", "Display name")}
              <input value={form.display_name} onChange={(event) => onChange("display_name", event.target.value)} />
            </label>
            <label>
              {resolveCopy(t, "profile.title", "Title")}
              <input value={form.title} onChange={(event) => onChange("title", event.target.value)} />
            </label>
          </div>
          <div className="field-grid-equal">
            <label>
              {resolveCopy(t, "profile.email", "Email")}
              <input value={memberUser.login || ""} readOnly />
            </label>
            <label>
              {resolveCopy(t, "profile.username", "Username")}
              <input value={memberUser.username || ""} readOnly />
            </label>
          </div>
          <div className="field-grid-equal">
            <label>
              {resolveCopy(t, "profile.firstName", "First name")}
              <input value={form.first_name} onChange={(event) => onChange("first_name", event.target.value)} />
            </label>
            <label>
              {resolveCopy(t, "profile.lastName", "Second name")}
              <input value={form.last_name} onChange={(event) => onChange("last_name", event.target.value)} />
            </label>
          </div>
          <div className="field-grid-equal">
            <label>
              {resolveCopy(t, "profile.phone", "Phone")}
              <input value={form.phone} onChange={(event) => onChange("phone", event.target.value)} />
            </label>
            <label>
              {resolveCopy(t, "profile.avatar", "Avatar URL")}
              <input value={form.avatar_url} onChange={(event) => onChange("avatar_url", event.target.value)} />
            </label>
          </div>
          <div className="field-grid-equal">
            <label>
              {resolveCopy(t, "profile.locale", "Locale")}
              <input value={form.locale} onChange={(event) => onChange("locale", event.target.value)} />
            </label>
            <label>
              {resolveCopy(t, "profile.timezone", "Timezone")}
              <input value={form.timezone} onChange={(event) => onChange("timezone", event.target.value)} />
            </label>
          </div>
          {status?.error ? <p className="modal-alert error">{status.error}</p> : null}
          {status?.success ? <p className="modal-alert success">{status.success}</p> : null}
          <div className="modal-actions">
            <button type="submit" className="btn" disabled={status?.loading}>
              <UiIcon name="save" />
              {status?.loading
                ? resolveCopy(t, "profile.saving", "Saving...")
                : resolveCopy(t, "profile.save", "Save profile")}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function StatusPill({ value }) {
  const tone = String(value || "").toLowerCase();
  let toneClass = "";
  if (tone.includes("live") || tone.includes("production")) toneClass = "is-live";
  else if (tone.includes("draft") || tone.includes("sampling")) toneClass = "is-draft";
  else if (tone.includes("planned")) toneClass = "is-planned";
  return <span className={`status-pill ${toneClass}`.trim()}>{value}</span>;
}

function InfoHeroBadges({ items = [] }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div className="info-hero-badges">
      {items.map((item) => (
        <div key={item.label} className="info-hero-badge">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PagesHubPage({ t, language = "en", onNavigate, contentBySlot, contentListsBySlot, onContentCta }) {
  const hero = resolveInfoHeroFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.pages.hero, {
    eyebrow: "Content System",
    title: resolveCopy(t, "pages.title", "Editorial Pages"),
    subtitle: resolveCopy(
      t,
      "pages.subtitle",
      "Use this section for evergreen pages: brand story, policies, FAQs, and campaign microsites."
    ),
    image: "",
    ctaLabel: "Go to patterns",
    ctaTarget: "/patterns",
    ctaAction: "navigate_internal",
    ctaNewTab: false,
  }, language);
  const articleItems = getSlotContentItems(contentListsBySlot, PAGE_CONTENT_SLOTS.pages.cards)
    .map((item, index) => mapStorefrontArticleToInfoCard(item, index, language))
    .filter((item) => item.title || item.summary);
  const cards = articleItems.length
    ? articleItems
    : resolveInfoCardsFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.pages.cards, PAGES_DIRECTORY, language);
  return (
    <main className="page info-page info-page-pages">
      <section
        className={`info-hero${hero.image ? " has-media" : ""}`}
        data-eip-parent="pages.hero"
        data-eip-page="pages"
        style={hero.image ? { "--info-hero-image": `url('${hero.image}')` } : undefined}
      >
        <div>
          <p className="eyebrow">{hero.eyebrow || "Content System"}</p>
          <h1>{hero.title || resolveCopy(t, "pages.title", "Editorial Pages")}</h1>
          <p>{hero.subtitle || resolveCopy(t, "pages.subtitle", "Use this section for evergreen pages: brand story, policies, FAQs, and campaign microsites.")}</p>
          <InfoHeroBadges
            items={[
              { label: "Live pages", value: "12" },
              { label: "Draft queue", value: "4" },
              { label: "Avg. read time", value: "3m 40s" },
            ]}
          />
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            if (hero.ctaTarget) {
              onContentCta?.({
                cta: {
                  action: hero.ctaAction,
                  target: hero.ctaTarget,
                  new_tab: hero.ctaNewTab,
                },
              });
              return;
            }
            onNavigate("patterns");
          }}
        >
          <UiIcon name="arrowRight" />
          {hero.ctaLabel || "Go to patterns"}
        </button>
      </section>
      <section className="info-grid" data-eip-parent="pages.cards" data-eip-page="pages">
        {cards.map((item) => (
          <article key={item.id} className="info-card">
            <div className="info-card-head">
              <h3>{item.title}</h3>
              <StatusPill value={item.status} />
            </div>
            <p>{item.summary}</p>
            <div className="info-card-meta">
              <span>{item.owner}</span>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  if (!item.ctaTarget) return;
                  onContentCta?.({
                    cta: {
                      action: item.ctaAction || "navigate_internal",
                      target: item.ctaTarget,
                      new_tab: item.ctaNewTab === true,
                    },
                  });
                }}
              >
                <UiIcon name="bookOpen" />
                {item.cta}
              </button>
            </div>
          </article>
        ))}
      </section>
      <section className="insight-row" data-eip-parent="pages.insight" data-eip-page="pages">
        <article className="insight-card">
          <h3>Suggested use for “Pages” tab</h3>
          <ul>
            <li>Brand story and values</li>
            <li>Shipping, returns, and legal pages</li>
            <li>Support and contact center</li>
            <li>Seasonal campaign landing pages</li>
          </ul>
        </article>
        <article className="insight-card">
          <h3>Next connection</h3>
          <p>Wire this to EIP Content Studio as `page.*` slots so non-product content remains fully managed from EIP.</p>
        </article>
      </section>
    </main>
  );
}

function SizesGuidePage({ t, language = "en", contentBySlot, onContentCta }) {
  const [activeMeasurementKey, setActiveMeasurementKey] = useState(SIZE_MEASUREMENTS[0]?.key || "bust");
  const [expandedMeasurementKey, setExpandedMeasurementKey] = useState(null);
  const measurementEntryRefs = useRef({});
  const activeMeasurement = SIZE_MEASUREMENTS.find((item) => item.key === activeMeasurementKey) || SIZE_MEASUREMENTS[0];
  const hero = resolveInfoHeroFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.sizes.hero, {
    eyebrow: "Fit Intelligence",
    title: resolveCopy(t, "sizes.title", "Size & Measurement Guide"),
    subtitle: resolveCopy(
      t,
      "sizes.subtitle",
      "One source of truth for body measurements and country size conversion before checkout."
    ),
    image: "",
    ctaLabel: "",
    ctaTarget: "",
    ctaAction: "navigate_internal",
    ctaNewTab: false,
  }, language);

  const focusMeasurementEntry = useCallback((key) => {
    const node = measurementEntryRefs.current[key];
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }, []);

  const handleMarkerSelect = (key) => {
    setActiveMeasurementKey(key);
    setExpandedMeasurementKey(key);
    requestAnimationFrame(() => focusMeasurementEntry(key));
  };

  const handleMeasurementCardSelect = (key) => {
    setActiveMeasurementKey(key);
    setExpandedMeasurementKey((prev) => {
      const next = prev === key ? null : key;
      if (next) requestAnimationFrame(() => focusMeasurementEntry(key));
      return next;
    });
  };

  return (
    <main className="page info-page info-page-sizes">
      <section
        className={`info-hero${hero.image ? " has-media" : ""}`}
        data-eip-parent="sizes.hero"
        data-eip-page="sizes"
        style={hero.image ? { "--info-hero-image": `url('${hero.image}')` } : undefined}
      >
        <div>
          <p className="eyebrow">{hero.eyebrow || "Fit Intelligence"}</p>
          <h1>{hero.title || resolveCopy(t, "sizes.title", "Size & Measurement Guide")}</h1>
          <p>{hero.subtitle || resolveCopy(t, "sizes.subtitle", "One source of truth for body measurements and country size conversion before checkout.")}</p>
          <InfoHeroBadges
            items={[
              { label: "Size range", value: "XS - XL" },
              { label: "Regions", value: "EU / UK / US / FR / JP" },
              { label: "Fit updates", value: "Monthly" },
            ]}
          />
        </div>
        {hero.ctaLabel ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              onContentCta?.({
                cta: {
                  action: hero.ctaAction,
                  target: hero.ctaTarget,
                  new_tab: hero.ctaNewTab,
                },
              })
            }
          >
            <UiIcon name="arrowRight" />
            {hero.ctaLabel}
          </button>
        ) : null}
      </section>
      <section className="size-layout" data-eip-parent="sizes.guide" data-eip-page="sizes">
        <article className="size-panel">
          <h3>How to measure</h3>
          <div className="size-interactive-layout">
            <figure className="size-dummy-stage">
              <img src={sizeDummy} alt="Measurement mannequin with highlighted sections." />
              {activeMeasurement?.zone && (
                <span
                  className="size-highlight-zone"
                  style={{
                    top: `${activeMeasurement.zone.top}%`,
                    left: `${activeMeasurement.zone.left}%`,
                    width: `${activeMeasurement.zone.width}%`,
                    height: `${activeMeasurement.zone.height}%`,
                    borderRadius: activeMeasurement.zone.radius || "16px",
                    transform: `rotate(${activeMeasurement.zone.rotate || 0}deg) scale(${activeMeasurement.zone.scale || 1})`,
                  }}
                  aria-hidden="true"
                />
              )}
              {activeMeasurement?.guide?.segments?.length > 0 && (
                <svg className="size-guide-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {activeMeasurement.guide.segments.map((segment, index) => (
                    <line
                      key={`${activeMeasurement.key}-segment-${index}`}
                      className="size-guide-line"
                      x1={segment.x1}
                      y1={segment.y1}
                      x2={segment.x2}
                      y2={segment.y2}
                    />
                  ))}
                </svg>
              )}
              {activeMeasurement?.guide?.start && (
                <span
                  className="size-guide-point is-start"
                  style={{
                    left: `${activeMeasurement.guide.start.x}%`,
                    top: `${activeMeasurement.guide.start.y}%`,
                  }}
                  aria-hidden="true"
                >
                  A
                </span>
              )}
              {activeMeasurement?.guide?.end && (
                <span
                  className="size-guide-point is-end"
                  style={{
                    left: `${activeMeasurement.guide.end.x}%`,
                    top: `${activeMeasurement.guide.end.y}%`,
                  }}
                  aria-hidden="true"
                >
                  B
                </span>
              )}
              {activeMeasurement?.title && (
                <span
                  className="size-floating-label"
                  style={{ top: `${activeMeasurement.marker.y}%` }}
                  aria-hidden="true"
                >
                  {activeMeasurement.title}
                </span>
              )}
              {SIZE_MEASUREMENTS.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={`size-marker-dot${activeMeasurementKey === item.key ? " is-active" : ""}`}
                  style={{
                    "--point-x": `${item.marker.x}%`,
                    "--point-y": `${item.marker.y}%`,
                  }}
                  onClick={() => handleMarkerSelect(item.key)}
                  aria-label={`Highlight ${item.title} on mannequin`}
                >
                  <span>{index + 1}</span>
                </button>
              ))}
            </figure>
          </div>
        </article>
        <article className="size-panel">
          <h3>Measurement matrix explorer</h3>
          <div className="size-dummy-caption size-right-summary">
            <strong>{activeMeasurement?.title}</strong>
            <span>{activeMeasurement?.detail}</span>
            <small>A = start point, B = end point</small>
          </div>
          <div className="size-measure-grid">
            {SIZE_MEASUREMENTS.map((item) => (
              <div
                key={item.key}
                className="size-measure-entry"
                ref={(node) => {
                  if (node) measurementEntryRefs.current[item.key] = node;
                  else delete measurementEntryRefs.current[item.key];
                }}
              >
                <button
                  type="button"
                  className={`size-measure-card size-measure-card-button${activeMeasurementKey === item.key ? " is-active" : ""}`}
                  onClick={() => handleMeasurementCardSelect(item.key)}
                >
                  <p className="size-measure-title">{item.title}</p>
                  <p>{item.detail}</p>
                </button>
                {expandedMeasurementKey === item.key && (
                  <div className="size-inline-matrix">
                    <div className="size-table-wrap">
                      <table className="size-table">
                        <thead>
                          <tr>
                            <th>Size</th>
                            <th>{item.title} (cm)</th>
                            <th>EU</th>
                            <th>UK</th>
                            <th>US</th>
                            <th>FR</th>
                            <th>JP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {measurementMatrixRows(item.key).map((row) => (
                            <tr key={`${item.key}-${row.size}`}>
                              <td>{row.size}</td>
                              <td>{row.value}</td>
                              <td>{row.eu}</td>
                              <td>{row.uk}</td>
                              <td>{row.us}</td>
                              <td>{row.fr}</td>
                              <td>{row.jp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="size-method-note">
            Method reference: EN 13402 / ISO 8559 body-dimension points for girths and lengths, with HPS-to-waist
            convention used in apparel pattern drafting.
          </p>
        </article>
      </section>
    </main>
  );
}

function BlogFeedPage({
  t,
  language = "en",
  blogPosts,
  loading,
  error,
  onCreatePost,
  onDeletePost,
  memberUser,
  onOpenLogin,
  onContentCta,
  contentBySlot,
}) {
  const [postFeedback, setPostFeedback] = useState({});
  const [postExpanded, setPostExpanded] = useState({});
  const [postImageIndex, setPostImageIndex] = useState({});
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [compose, setCompose] = useState({ title: "", body: "", tags: "" });
  const [composeFiles, setComposeFiles] = useState([]);
  const [composeUploading, setComposeUploading] = useState(false);
  const composeFileInputRef = useRef(null);
  const [submitState, setSubmitState] = useState({ loading: false, error: "", success: "" });
  const [deletePostModal, setDeletePostModal] = useState(null);
  const blogImageStudioResolverRef = useRef(null);
  const [blogImageStudio, setBlogImageStudio] = useState({
    open: false,
    file: null,
    title: "Edit blog image",
    defaultProfileId: "blog-cover",
  });
  const hero = resolveInfoHeroFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.blog.hero, {
    eyebrow: "Community Feed",
    title: resolveCopy(t, "blog.title", "Creator Blog"),
    subtitle: resolveCopy(
      t,
      "blog.subtitle",
      "A social-style space for studio updates, behind-the-scenes process posts, and comments."
    ),
    image: "",
    ctaLabel: "",
    ctaTarget: "",
    ctaAction: "navigate_internal",
    ctaNewTab: false,
  }, language);
  const feedPosts = Array.isArray(blogPosts) && blogPosts.length ? blogPosts : BLOG_POSTS;

  const settleBlogImageStudio = (value = null) => {
    const resolver = blogImageStudioResolverRef.current;
    blogImageStudioResolverRef.current = null;
    setBlogImageStudio({
      open: false,
      file: null,
      title: "Edit blog image",
      defaultProfileId: "blog-cover",
    });
    if (resolver) resolver(value);
  };

  const openBlogImageStudio = (file) => {
    if (!file || !String(file.type || "").toLowerCase().startsWith("image/")) {
      return Promise.resolve(file || null);
    }
    return new Promise((resolve) => {
      blogImageStudioResolverRef.current = resolve;
      setBlogImageStudio({
        open: true,
        file,
        title: "Edit blog image",
        defaultProfileId: "blog-cover",
      });
    });
  };

  useEffect(() => {
    setPostFeedback((prev) => {
      const next = {};
      for (const post of feedPosts) {
        const existing = prev[post.id];
        next[post.id] = {
          vote: existing?.vote || null,
          likes: Number.isFinite(Number(existing?.likes)) ? Number(existing.likes) : Number(post.likes) || 0,
          dislikes:
            Number.isFinite(Number(existing?.dislikes)) ? Number(existing.dislikes) : Number(post.dislikes) || 0,
        };
      }
      return next;
    });
    setPostImageIndex((prev) => {
      const next = {};
      for (const post of feedPosts) {
        const images = Array.isArray(post.images) && post.images.length ? post.images : post.image ? [post.image] : [];
        const current = Number(prev[post.id] || 0);
        next[post.id] = images.length ? Math.max(0, Math.min(current, images.length - 1)) : 0;
      }
      return next;
    });
  }, [feedPosts]);

  useEffect(() => {
    return () => {
      if (blogImageStudioResolverRef.current) {
        blogImageStudioResolverRef.current(null);
        blogImageStudioResolverRef.current = null;
      }
    };
  }, []);

  const togglePostFeedback = (postId, vote) => {
    setPostFeedback((prev) => {
      const current = prev[postId] || { vote: null, likes: 0, dislikes: 0 };
      let next = { ...current };
      if (vote === "up") {
        if (current.vote === "up") {
          next = { ...next, vote: null, likes: Math.max(0, current.likes - 1) };
        } else if (current.vote === "down") {
          next = {
            ...next,
            vote: "up",
            likes: current.likes + 1,
            dislikes: Math.max(0, current.dislikes - 1),
          };
        } else {
          next = { ...next, vote: "up", likes: current.likes + 1 };
        }
      } else if (vote === "down") {
        if (current.vote === "down") {
          next = { ...next, vote: null, dislikes: Math.max(0, current.dislikes - 1) };
        } else if (current.vote === "up") {
          next = {
            ...next,
            vote: "down",
            likes: Math.max(0, current.likes - 1),
            dislikes: current.dislikes + 1,
          };
        } else {
          next = { ...next, vote: "down", dislikes: current.dislikes + 1 };
        }
      }
      return { ...prev, [postId]: next };
    });
  };

  const handleComposeFilesSelect = async (event) => {
    const files = Array.from(event.target.files || []).filter(
      (file) => file && String(file.type || "").startsWith("image/")
    );
    if (!files.length) return;
    const preparedFiles = [];
    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      const prepared = await openBlogImageStudio(file);
      if (!prepared) continue;
      preparedFiles.push(prepared);
      if (preparedFiles.length >= 10) break;
    }
    if (!preparedFiles.length) {
      event.target.value = "";
      return;
    }
    setComposeFiles((prev) => {
      const existing = new Set(prev.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const next = [...prev];
      for (const file of preparedFiles) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (existing.has(key)) continue;
        existing.add(key);
        next.push(file);
        if (next.length >= 10) break;
      }
      return next.slice(0, 10);
    });
    event.target.value = "";
  };

  const removeComposeFileAt = (indexToRemove) => {
    setComposeFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleComposeSubmit = async (event) => {
    event.preventDefault();
    if (!memberUser) {
      onOpenLogin?.();
      return;
    }
    const title = String(compose.title || "").trim();
    const body = String(compose.body || "").trim();
    if (!title || !body) {
      setSubmitState({
        loading: false,
        error: "Title and post content are required.",
        success: "",
      });
      return;
    }
    setSubmitState({ loading: true, error: "", success: "" });
    setComposeUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of composeFiles) {
        // eslint-disable-next-line no-await-in-loop
        const upload = await uploadMemberBlogAsset({
          csrf: readCookie("member_csrf"),
          file
        });
        const resolvedUrl = String(
          upload?.asset?.raw_url ||
            upload?.asset?.url ||
            ""
        ).trim();
        if (resolvedUrl) uploadedUrls.push(resolvedUrl);
      }
      await onCreatePost?.({
        title,
        body,
        tags: String(compose.tags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        image_url: uploadedUrls[0] || "",
        image_urls: uploadedUrls,
      });
      setCompose({ title: "", body: "", tags: "" });
      setComposeFiles([]);
      setSubmitState({ loading: false, error: "", success: "Post published." });
      setShowComposeModal(false);
    } catch (submitError) {
      setSubmitState({
        loading: false,
        error: submitError?.message || "Unable to publish post.",
        success: "",
      });
    } finally {
      setComposeUploading(false);
    }
  };

  const togglePostExpanded = (postId) => {
    setPostExpanded((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const cyclePostImage = (postId, direction, imageCount) => {
    if (!imageCount || imageCount < 2) return;
    setPostImageIndex((prev) => {
      const current = Number(prev[postId] || 0);
      const next = (current + direction + imageCount) % imageCount;
      return { ...prev, [postId]: next };
    });
  };

  const handleDeletePost = async (post) => {
    if (!post?.id || !memberUser?.identity_id) return;
    const ownerId = String(post.authorIdentityId || "").trim();
    if (!ownerId || ownerId !== String(memberUser.identity_id)) return;
    setDeletePostModal(post);
  };

  const confirmDeletePost = async () => {
    const post = deletePostModal;
    if (!post?.id) {
      setDeletePostModal(null);
      return;
    }
    setDeletePostModal(null);
    setSubmitState({ loading: true, error: "", success: "" });
    try {
      await onDeletePost?.(post.id);
      setSubmitState({ loading: false, error: "", success: "Post deleted." });
    } catch (deleteError) {
      setSubmitState({
        loading: false,
        error: deleteError?.message || "Unable to delete post.",
        success: "",
      });
    }
  };

  return (
    <main className="page info-page info-page-blog">
      <section
        className={`info-hero${hero.image ? " has-media" : ""}`}
        data-eip-parent="blog.hero"
        data-eip-page="blog"
        style={hero.image ? { "--info-hero-image": `url('${hero.image}')` } : undefined}
      >
        <div>
          <p className="eyebrow">{hero.eyebrow || "Community Feed"}</p>
          <h1>{hero.title || resolveCopy(t, "blog.title", "Creator Blog")}</h1>
          <p>{hero.subtitle || resolveCopy(t, "blog.subtitle", "A social-style space for studio updates, behind-the-scenes process posts, and comments.")}</p>
          <InfoHeroBadges
            items={[
              { label: "Posts this week", value: "9" },
              { label: "Active creators", value: "42" },
              { label: "Engagement", value: "+18%" },
            ]}
          />
        </div>
        {hero.ctaLabel ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              onContentCta?.({
                cta: {
                  action: hero.ctaAction,
                  target: hero.ctaTarget,
                  new_tab: hero.ctaNewTab,
                },
              })
            }
          >
            <UiIcon name="arrowRight" />
            {hero.ctaLabel}
          </button>
        ) : null}
      </section>
      <section className="blog-layout" data-eip-parent="blog.feed" data-eip-page="blog">
        <aside className="blog-side">
          <article className="info-card blog-compose-card">
            <h3>Start a post</h3>
            <p>Share a fitting note, production tip, or launch update with your audience in EIP.</p>
            <button
              type="button"
              className="btn small blog-compose-open"
              onClick={() => {
                setSubmitState({ loading: false, error: "", success: "" });
                setShowComposeModal(true);
              }}
            >
              <UiIcon name="plus" />
              Create post
            </button>
            {submitState.error ? <p className="blog-compose-alert error">{submitState.error}</p> : null}
            {submitState.success ? <p className="blog-compose-alert success">{submitState.success}</p> : null}
          </article>
          <article className="info-card">
            <h3>Trending topics</h3>
            <ul>
              <li>#patternlab</li>
              <li>#fit-notes</li>
              <li>#makerstories</li>
              <li>#samaradrop</li>
            </ul>
          </article>
        </aside>
        <div className="blog-feed">
          {loading ? <p className="samara-alert">Loading blog posts...</p> : null}
          {error ? <p className="samara-alert error">{error}</p> : null}
          {feedPosts.map((post) => (
            (() => {
              const feedback = postFeedback[post.id] || {
                vote: null,
                likes: Number(post.likes) || 0,
                dislikes: Number(post.dislikes) || 0,
              };
              const fullBody = String(post.body || "").trim();
              const isExpanded = postExpanded[post.id] === true;
              const canToggleBody = fullBody.length > 320;
              const bodyPreview = !canToggleBody || isExpanded
                ? fullBody
                : `${fullBody.slice(0, 320).trimEnd()}...`;
              const postImages = Array.isArray(post.images) && post.images.length
                ? post.images
                : post.image
                  ? [post.image]
                  : [];
              const activeImageIndex = Math.max(
                0,
                Math.min(Number(postImageIndex[post.id] || 0), Math.max(postImages.length - 1, 0))
              );
              const canDeletePost =
                Boolean(memberUser?.identity_id) &&
                String(post.authorIdentityId || "").trim() === String(memberUser?.identity_id || "").trim();
              return (
                <article key={post.id} className="blog-post">
                  <header className="blog-post-head">
                    <div>
                      <strong>{post.author}</strong>
                      <p>{post.role}</p>
                    </div>
                    <span>{post.postedAt}</span>
                  </header>
                  <h3>{post.title}</h3>
                  <p className="blog-post-body">{bodyPreview}</p>
                  {canToggleBody ? (
                    <button
                      type="button"
                      className="blog-see-toggle"
                      onClick={() => togglePostExpanded(post.id)}
                    >
                      {isExpanded ? "See less" : "See more"}
                    </button>
                  ) : null}
                  {postImages.length ? (
                    <div className="blog-post-media">
                      <img src={postImages[activeImageIndex]} alt={`${post.title} ${activeImageIndex + 1}`} />
                      {postImages.length > 1 ? (
                        <>
                          <button
                            type="button"
                            className="btn ghost icon-only blog-media-nav prev"
                            onClick={() => cyclePostImage(post.id, -1, postImages.length)}
                            aria-label="Previous photo"
                            title="Previous photo"
                          >
                            <UiIcon name="chevronLeft" />
                          </button>
                          <button
                            type="button"
                            className="btn ghost icon-only blog-media-nav next"
                            onClick={() => cyclePostImage(post.id, 1, postImages.length)}
                            aria-label="Next photo"
                            title="Next photo"
                          >
                            <UiIcon name="chevronRight" />
                          </button>
                          <div className="blog-media-dots">
                            {postImages.map((_, idx) => (
                              <button
                                key={`${post.id}-dot-${idx}`}
                                type="button"
                                className={`blog-media-dot${idx === activeImageIndex ? " active" : ""}`}
                                onClick={() =>
                                  setPostImageIndex((prev) => ({ ...prev, [post.id]: idx }))
                                }
                                aria-label={`Open photo ${idx + 1}`}
                              />
                            ))}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <footer className="blog-post-foot">
                    <span className="blog-metric" title="Likes">
                      <UiIcon name="thumbUp" />
                      {feedback.likes}
                    </span>
                    <span className="blog-metric" title="Dislikes">
                      <UiIcon name="thumbDown" />
                      {feedback.dislikes}
                    </span>
                    <span className="blog-metric" title="Comments">
                      <UiIcon name="comment" />
                      {post.comments}
                    </span>
                    <div className="blog-tag-list">
                      {post.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="blog-post-actions">
                      <button
                        type="button"
                        className={`btn ghost icon-only${feedback.vote === "up" ? " is-active" : ""}`}
                        onClick={() => togglePostFeedback(post.id, "up")}
                        aria-label="Like"
                        title="Like"
                      >
                        <UiIcon name="thumbUp" />
                      </button>
                      <button
                        type="button"
                        className={`btn ghost icon-only${feedback.vote === "down" ? " is-active is-negative" : ""}`}
                        onClick={() => togglePostFeedback(post.id, "down")}
                        aria-label="Dislike"
                        title="Dislike"
                      >
                        <UiIcon name="thumbDown" />
                      </button>
                      <button type="button" className="btn ghost icon-only" aria-label="Comment" title="Comment">
                        <UiIcon name="comment" />
                      </button>
                      <button type="button" className="btn ghost icon-only" aria-label="Share" title="Share">
                        <UiIcon name="send" />
                      </button>
                      {canDeletePost ? (
                        <button
                          type="button"
                          className="btn ghost icon-only is-negative"
                          aria-label="Delete post"
                          title="Delete post"
                          onClick={() => handleDeletePost(post)}
                        >
                          <UiIcon name="trash" />
                        </button>
                      ) : null}
                    </div>
                  </footer>
                </article>
              );
            })()
          ))}
        </div>
      </section>
      {showComposeModal ? (
        <div className="samara-modal-backdrop" onClick={() => !submitState.loading && setShowComposeModal(false)}>
          <div className="samara-modal blog-compose-modal" onClick={(event) => event.stopPropagation()}>
            <header className="modal-header">
              <h3>Create blog post</h3>
              <p>Write long-form article content and attach one or more images.</p>
            </header>
            <form className="blog-compose-form" onSubmit={handleComposeSubmit}>
              <label className="blog-compose-field">
                Title
                <input
                  value={compose.title}
                  onChange={(event) => setCompose((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Post title"
                  maxLength={160}
                />
              </label>
              <label className="blog-compose-field">
                Article
                <textarea
                  value={compose.body}
                  onChange={(event) => setCompose((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Write your article..."
                  rows={14}
                  maxLength={6000}
                />
              </label>
              <label className="blog-compose-field">
                Tags (comma-separated)
                <input
                  value={compose.tags}
                  onChange={(event) => setCompose((prev) => ({ ...prev, tags: event.target.value }))}
                  placeholder="patternlab, fit-notes"
                />
              </label>
              <label className="blog-compose-field">
                Images
                <div className="blog-compose-upload">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => composeFileInputRef.current?.click()}
                    disabled={submitState.loading || composeUploading}
                  >
                    <UiIcon name="plus" />
                    Upload image
                  </button>
                  <input
                    ref={composeFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleComposeFilesSelect}
                  />
                  {composeFiles.length ? (
                    <div className="blog-upload-list">
                      {composeFiles.map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}-${index}`} className="blog-upload-item">
                          <span title={file.name}>{file.name}</span>
                          <button
                            type="button"
                            className="btn ghost icon-only"
                            onClick={() => removeComposeFileAt(index)}
                            aria-label="Remove image"
                            title="Remove image"
                            disabled={submitState.loading || composeUploading}
                          >
                            <UiIcon name="close" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="blog-upload-hint">No images selected.</p>
                  )}
                </div>
              </label>
              {submitState.error ? <p className="blog-compose-alert error">{submitState.error}</p> : null}
              {submitState.success ? <p className="blog-compose-alert success">{submitState.success}</p> : null}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setShowComposeModal(false)}
                  disabled={submitState.loading || composeUploading}
                >
                  <UiIcon name="close" />
                  Close
                </button>
                <button type="submit" className="btn" disabled={submitState.loading || composeUploading}>
                  <UiIcon name="send" />
                  {submitState.loading || composeUploading ? "Publishing..." : "Publish post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ActionMiniModal
        open={Boolean(deletePostModal)}
        mode="confirm"
        title="Delete post"
        message="Delete this post?"
        confirmLabel="Delete"
        confirmTone="danger"
        busy={submitState.loading}
        onCancel={() => setDeletePostModal(null)}
        onConfirm={confirmDeletePost}
      />
      <ImageAssetStudioModal
        open={blogImageStudio.open}
        sourceFile={blogImageStudio.file}
        title={blogImageStudio.title}
        recommendedSize={{ width: 1800, height: 1200, label: "Blog article 3:2" }}
        defaultProfileId={blogImageStudio.defaultProfileId}
        onCancel={() => settleBlogImageStudio(null)}
        onApply={(result) => settleBlogImageStudio(result?.file || null)}
      />
    </main>
  );
}

function LineStudioPage({ t, language = "en", contentBySlot, onContentCta }) {
  const hero = resolveInfoHeroFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.line.hero, {
    eyebrow: "Collection Planning",
    title: resolveCopy(t, "line.title", "Line Plan"),
    subtitle: resolveCopy(
      t,
      "line.subtitle",
      "Use this tab for seasonal capsule planning, production windows, and launch readiness."
    ),
    image: "",
    ctaLabel: "",
    ctaTarget: "",
    ctaAction: "navigate_internal",
    ctaNewTab: false,
  }, language);
  const dynamicCards = resolveInfoCardsFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.line.cards, [], language);
  const lineCapsules = dynamicCards.length
    ? dynamicCards.map((card, index) => ({
        id: card.id || `line-${index + 1}`,
        name: card.title,
        season: card.owner || "Season",
        status: card.status || "Live",
        window: card.cta || "Open",
        focus: card.summary || "",
      }))
    : LINE_CAPSULES;
  return (
    <main className="page info-page info-page-line">
      <section
        className={`info-hero${hero.image ? " has-media" : ""}`}
        data-eip-parent="line.hero"
        data-eip-page="line"
        style={hero.image ? { "--info-hero-image": `url('${hero.image}')` } : undefined}
      >
        <div>
          <p className="eyebrow">{hero.eyebrow || "Collection Planning"}</p>
          <h1>{hero.title || resolveCopy(t, "line.title", "Line Plan")}</h1>
          <p>{hero.subtitle || resolveCopy(t, "line.subtitle", "Use this tab for seasonal capsule planning, production windows, and launch readiness.")}</p>
          <InfoHeroBadges
            items={[
              { label: "Capsules", value: "3 active" },
              { label: "On-time ratio", value: "92%" },
              { label: "Next launch", value: "14 Apr" },
            ]}
          />
        </div>
        {hero.ctaLabel ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              onContentCta?.({
                cta: {
                  action: hero.ctaAction,
                  target: hero.ctaTarget,
                  new_tab: hero.ctaNewTab,
                },
              })
            }
          >
            <UiIcon name="arrowRight" />
            {hero.ctaLabel}
          </button>
        ) : null}
      </section>
      <section className="line-grid" data-eip-parent="line.cards" data-eip-page="line">
        {lineCapsules.map((line) => (
          <article key={line.id} className="line-card">
            <div className="line-card-head">
              <h3>{line.name}</h3>
              <StatusPill value={line.status} />
            </div>
            <p>{line.focus}</p>
            <dl>
              <div>
                <dt>Season</dt>
                <dd>{line.season}</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>{line.window}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </main>
  );
}

function LearningPage({ t, language = "en", onOpenIntake, contentBySlot, onContentCta }) {
  const hero = resolveInfoHeroFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.learning.hero, {
    eyebrow: "Learning Hub",
    title: resolveCopy(t, "learning.title", "Learning & Training"),
    subtitle: resolveCopy(
      t,
      "learning.subtitle",
      "Publish training materials, upcoming sessions, and intake forms for new cohorts."
    ),
    image: "",
    ctaLabel: "Apply for intake",
    ctaTarget: "",
    ctaAction: "navigate_internal",
    ctaNewTab: false,
  }, language);
  const dynamicCards = resolveInfoCardsFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.learning.cards, [], language);
  const tracks = dynamicCards.length
    ? dynamicCards.map((card, index) => ({
        id: card.id || `track-${index + 1}`,
        title: card.title,
        level: card.owner || "Program",
        duration: card.cta || "Open schedule",
        outcome: card.summary || "",
      }))
    : LEARNING_TRACKS;
  return (
    <main className="page info-page info-page-learning">
      <section
        className={`info-hero${hero.image ? " has-media" : ""}`}
        data-eip-parent="learning.hero"
        data-eip-page="learning"
        style={hero.image ? { "--info-hero-image": `url('${hero.image}')` } : undefined}
      >
        <div>
          <p className="eyebrow">{hero.eyebrow || "Learning Hub"}</p>
          <h1>{hero.title || resolveCopy(t, "learning.title", "Learning & Training")}</h1>
          <p>{hero.subtitle || resolveCopy(t, "learning.subtitle", "Publish training materials, upcoming sessions, and intake forms for new cohorts.")}</p>
          <InfoHeroBadges
            items={[
              { label: "Tracks", value: "3" },
              { label: "Upcoming sessions", value: "3" },
              { label: "Placement rate", value: "88%" },
            ]}
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (hero.ctaTarget) {
              onContentCta?.({
                cta: {
                  action: hero.ctaAction,
                  target: hero.ctaTarget,
                  new_tab: hero.ctaNewTab,
                },
              });
              return;
            }
            onOpenIntake();
          }}
        >
          <UiIcon name="calendar" />
          {hero.ctaLabel || "Apply for intake"}
        </button>
      </section>
      <section className="learning-layout" data-eip-parent="learning.cards" data-eip-page="learning">
        <article className="size-panel">
          <h3>Training tracks</h3>
          <div className="learning-track-grid">
            {tracks.map((track) => (
              <div key={track.id} className="learning-track-card">
                <p className="learning-level">{track.level}</p>
                <h4>{track.title}</h4>
                <p>{track.outcome}</p>
                <span>{track.duration}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="size-panel">
          <h3>Upcoming sessions</h3>
          <div className="learning-schedule-list">
            {LEARNING_SCHEDULE.map((slot) => (
              <div key={slot.id} className="learning-slot">
                <div>
                  <strong>{slot.title}</strong>
                  <p>{slot.mode}</p>
                </div>
                <div className="learning-slot-meta">
                  <span>{slot.startsAt}</span>
                  <span>{slot.seats}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function CollabShopPage({ t, language = "en", contentBySlot, onContentCta }) {
  const hero = resolveInfoHeroFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.collab.hero, {
    eyebrow: "Creator Commerce",
    title: resolveCopy(t, "collab.title", "Collab Shop"),
    subtitle: resolveCopy(
      t,
      "collab.subtitle",
      "Partnership programs for creators, mentors, and fashion brands."
    ),
    image: "",
    ctaLabel: "",
    ctaTarget: "",
    ctaAction: "navigate_internal",
    ctaNewTab: false,
  }, language);
  const dynamicCards = resolveInfoCardsFromSlot(contentBySlot, PAGE_CONTENT_SLOTS.collab.cards, [], language);
  const programs = dynamicCards.length
    ? dynamicCards.map((card, index) => ({
        id: card.id || `collab-${index + 1}`,
        title: card.title,
        payout: card.status || "Program",
        summary: card.summary,
        cta: card.cta || "View details",
        ctaTarget: card.ctaTarget || "",
        ctaAction: card.ctaAction || "navigate_internal",
        ctaNewTab: card.ctaNewTab === true,
      }))
    : COLLAB_PROGRAMS;
  return (
    <main className="page info-page info-page-collab">
      <section
        className={`info-hero${hero.image ? " has-media" : ""}`}
        data-eip-parent="collab.hero"
        data-eip-page="collab"
        style={hero.image ? { "--info-hero-image": `url('${hero.image}')` } : undefined}
      >
        <div>
          <p className="eyebrow">{hero.eyebrow || "Creator Commerce"}</p>
          <h1>{hero.title || resolveCopy(t, "collab.title", "Collab Shop")}</h1>
          <p>{hero.subtitle || resolveCopy(t, "collab.subtitle", "Partnership programs for creators, mentors, and fashion brands.")}</p>
          <InfoHeroBadges
            items={[
              { label: "Active collabs", value: "7" },
              { label: "Avg payout", value: "70/30" },
              { label: "Open slots", value: "12" },
            ]}
          />
        </div>
        {hero.ctaLabel ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              onContentCta?.({
                cta: {
                  action: hero.ctaAction,
                  target: hero.ctaTarget,
                  new_tab: hero.ctaNewTab,
                },
              })
            }
          >
            <UiIcon name="arrowRight" />
            {hero.ctaLabel}
          </button>
        ) : null}
      </section>
      <section className="info-grid" data-eip-parent="collab.cards" data-eip-page="collab">
        {programs.map((program) => (
          <article key={program.id} className="info-card">
            <div className="info-card-head">
              <h3>{program.title}</h3>
              <StatusPill value={program.payout} />
            </div>
            <p>{program.summary}</p>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                if (!program.ctaTarget) return;
                onContentCta?.({
                  cta: {
                    action: program.ctaAction || "navigate_internal",
                    target: program.ctaTarget,
                    new_tab: program.ctaNewTab === true,
                  },
                });
              }}
            >
              <UiIcon name="users" />
              {program.cta || "View details"}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}

function LearningIntakeModal({ open, onClose, form, onChange, onSubmit, status, t }) {
  if (!open) return null;
  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="modal-header">
        <h3>{resolveCopy(t, "learning.intakeTitle", "Training intake form")}</h3>
        <p>
          {resolveCopy(
            t,
            "learning.intakeSubtitle",
            "Tell us your goals and we will route you to the right cohort."
          )}
        </p>
      </div>
      <form className="modal-body" onSubmit={onSubmit}>
        <div className="field-grid-equal">
          <label>
            Name
            <input value={form.name} onChange={(event) => onChange("name", event.target.value)} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} />
          </label>
        </div>
        <div className="field-grid-equal">
          <label>
            Phone
            <input value={form.phone} onChange={(event) => onChange("phone", event.target.value)} />
          </label>
          <label>
            Track
            <select value={form.track} onChange={(event) => onChange("track", event.target.value)}>
              {LEARNING_TRACKS.map((track) => (
                <option key={track.id} value={track.title}>
                  {track.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Learning goal
          <textarea
            value={form.goal}
            onChange={(event) => onChange("goal", event.target.value)}
            placeholder="What do you want to achieve in this intake?"
          />
        </label>
        {status?.error ? <p className="modal-alert error">{status.error}</p> : null}
        {status?.success ? <p className="modal-alert success">{status.success}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            <UiIcon name="close" />
            {resolveCopy(t, "auth.close", "Close")}
          </button>
          <button type="submit" className="btn" disabled={status?.loading}>
            <UiIcon name="send" />
            {status?.loading ? "Submitting..." : "Submit intake"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ open, onClose, children, panelClassName }) {
  if (!open) return null;
  return (
    <div className="samara-modal-backdrop" onClick={onClose}>
      <div
        className={`samara-modal ${panelClassName || ""}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

function MemberEntryModal({ open, onClose, onSignIn, onSignUp, t }) {
  if (!open) return null;
  return (
    <ModalShell open={open} onClose={onClose} panelClassName="member-choice-modal">
      <div className="modal-header">
        <h3>{resolveCopy(t, "auth.entryTitle", "Welcome back")}</h3>
        <p>{resolveCopy(t, "auth.entrySubtitle", "Continue with your member account or create one.")}</p>
      </div>
      <div className="member-choice-list">
        <button type="button" className="member-choice-btn" onClick={onSignIn}>
          <strong>{resolveCopy(t, "auth.entryHasAccount", "Already have an account?")}</strong>
          <span>{resolveCopy(t, "auth.entrySignIn", "Sign in")}</span>
        </button>
        <button type="button" className="member-choice-btn" onClick={onSignUp}>
          <strong>{resolveCopy(t, "auth.entryNoAccount", "Not yet a member?")}</strong>
          <span>{resolveCopy(t, "auth.entrySignUp", "Sign up")}</span>
        </button>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          {t("auth.close")}
        </button>
      </div>
    </ModalShell>
  );
}

function PhoneCodeSelect({ value, options, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.iso === value) || options[0];
  const selectedDial = selected?.dial || "--";

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  if (!selected) return null;

  return (
    <div className={`phone-code-select ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="phone-code-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flag-text">
          <FlagMark iso={selected.iso} />
          <span>{selectedDial}</span>
        </span>
        <UiIcon name="chevronDown" className="ui-icon" />
      </button>
      {open ? (
        <div className="phone-code-menu" role="listbox" aria-label="Phone country code">
          {options.map((item) => (
            <button
              key={item.iso}
              type="button"
              className={`phone-code-option ${item.iso === selected.iso ? "active" : ""}`}
              onClick={() => {
                onChange(item.iso);
                setOpen(false);
              }}
            >
              <span className="phone-code-option-main flag-text">
                <FlagMark iso={item.iso} />
                <span>{item.name}</span>
              </span>
              <span className="phone-code-option-meta">{`${item.iso} ${item.dial || "--"}`}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CountrySelect({ value, options, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.iso === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  if (!selected) return null;

  return (
    <div className={`country-picker ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="country-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="flag-text">
          <FlagMark iso={selected.iso} />
          <span>{selected.name}</span>
        </span>
        <UiIcon name="chevronDown" className="ui-icon" />
      </button>
      {open ? (
        <div className="country-menu" role="listbox" aria-label="Country">
          {options.map((item) => (
            <button
              key={item.iso}
              type="button"
              className={`country-option ${item.iso === selected.iso ? "active" : ""}`}
              onClick={() => {
                onChange(item.iso);
                setOpen(false);
              }}
            >
              <span className="flag-text">
                <FlagMark iso={item.iso} />
                <span>{item.name}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemberAuthModal({
  open,
  onClose,
  form,
  onChange,
  onSubmit,
  status,
  t,
  termsText = "",
  termsItems = [],
  termsLoading = false,
  countryOptions = DEFAULT_COUNTRY_OPTIONS,
}) {
  const mode = form.mode === "signup" ? "signup" : "signin";
  const isSignUp = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const signInLabel = resolveCopy(t, "nav.signIn", "Sign in");
  const signUpLabel = resolveCopy(t, "auth.signUp", "Sign up");
  const title = isSignUp ? signUpLabel : signInLabel;
  const subtitle = isSignUp
    ? resolveCopy(
        t,
        "auth.subtitleSignUpTeaser",
        "become a member to benefit from additional features and become a contribbutor"
      )
    : resolveCopy(t, "auth.subtitleSignIn", "Use your credentials to access your member area.");
  const submitLabel = isSignUp
    ? resolveCopy(t, "auth.submitSignUp", "Create account")
    : resolveCopy(t, "auth.submitSignIn", "Sign in");
  const loadingLabel = isSignUp
    ? resolveCopy(t, "auth.submittingSignUp", "Creating account...")
    : resolveCopy(t, "auth.submittingSignIn", "Signing in...");
  const showDebugLink = Boolean(import.meta.env.DEV && status?.debugLink);
  const termLinks = Array.isArray(termsItems)
    ? termsItems
        .map((item, index) => ({
          url: String(item?.url || "").trim(),
          label: String(item?.label || item?.code || `Condition ${index + 1}`).trim(),
        }))
        .filter((item) => item.url)
    : [];

  const phoneOptions = countryOptions;
  const statusModeMatches = Boolean(status?.mode && status.mode === mode);

  useEffect(() => {
    if (!open) {
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      panelClassName={`member-auth-modal ${isSignUp ? "member-auth-modal-signup" : "member-auth-modal-signin"}`}
    >
      <div className="modal-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <form className="modal-body" onSubmit={(event) => onSubmit(event, mode)}>
        {isSignUp ? (
          <>
            <div className="field-grid-equal">
              <label>
                {resolveCopy(t, "auth.emailLabel", "Email")}
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => onChange("email", event.target.value)}
                  required
                />
              </label>
              <label>
                {resolveCopy(t, "auth.username", "Username")}
                <input
                  value={form.username}
                  onChange={(event) => onChange("username", event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="field-grid-equal">
              <label>
                {resolveCopy(t, "auth.firstName", "First name")}
                <input
                  value={form.firstName}
                  onChange={(event) => onChange("firstName", event.target.value)}
                  required
                />
              </label>
              <label>
                {resolveCopy(t, "auth.lastName", "Second name")}
                <input
                  value={form.lastName}
                  onChange={(event) => onChange("lastName", event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="field-grid-equal">
              <label>
                {resolveCopy(t, "auth.password", "Password")}
                <div className="field-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => onChange("password", event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="input-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <UiIcon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </label>
              <label>
                {resolveCopy(t, "auth.confirmPassword", "Confirm password")}
                <div className="field-input-wrap">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword || ""}
                    onChange={(event) => onChange("confirmPassword", event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="input-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    <UiIcon name={showConfirmPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </label>
            </div>
            <div className="field-grid-phone">
              <label>
                {resolveCopy(t, "auth.phoneCode", "Phone code")}
                <PhoneCodeSelect
                  value={form.phoneCountry}
                  options={phoneOptions}
                  onChange={(nextIso) => onChange("phoneCountry", nextIso)}
                />
              </label>
              <label>
                {resolveCopy(t, "auth.phone", "Phone number")}
                <input
                  value={form.phoneNumber}
                  onChange={(event) => onChange("phoneNumber", sanitizeLocalPhoneDigits(event.target.value))}
                  inputMode="numeric"
                  pattern="[0-9]{7,15}"
                  maxLength={15}
                />
              </label>
            </div>
            <label>
              {resolveCopy(t, "auth.address1", "Address line 1")}
              <input
                value={form.address1}
                onChange={(event) => onChange("address1", event.target.value)}
                required
              />
            </label>
            <label>
              {resolveCopy(t, "auth.address2", "Address line 2")}
              <input
                value={form.address2}
                onChange={(event) => onChange("address2", event.target.value)}
              />
            </label>
            <label>
              {resolveCopy(t, "auth.postcode", "Postcode")}
              <input
                value={form.postcode}
                onChange={(event) => onChange("postcode", event.target.value)}
                required
              />
            </label>
            <label>
              {resolveCopy(t, "auth.country", "Country")}
              <CountrySelect
                value={form.country}
                options={countryOptions}
                onChange={(nextIso) => onChange("country", nextIso)}
              />
            </label>
            <label>
              {resolveCopy(t, "auth.termsTitle", "Terms and conditions")}
              <textarea
                className="terms-readonly"
                readOnly
                value={
                  termsLoading
                    ? resolveCopy(t, "auth.termsLoading", "Loading terms...")
                    : (termsText || resolveCopy(t, "auth.termsEmpty", "No trade conditions configured yet."))
                }
              />
              {termLinks.length ? (
                <div className="terms-link-list">
                  {termLinks.map((item) => (
                    <a key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noreferrer noopener">
                      {resolveCopy(t, "auth.openFullTerms", "Open full terms")}: {item.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="terms-check">
              <input
                type="checkbox"
                checked={Boolean(form.termsAccepted)}
                onChange={(event) => onChange("termsAccepted", event.target.checked)}
              />
              <span>
                {resolveCopy(
                  t,
                  "auth.termsAccepted",
                  "I have read and understood the Terms and Conditions."
                )}
              </span>
            </label>
          </>
        ) : (
          <div className="signin-layout">
            <div className="signin-fields">
              <label>
                {t("auth.credential")}
                <input
                  value={form.credential}
                  onChange={(event) => onChange("credential", event.target.value)}
                  required
                />
              </label>
              <label>
                {t("auth.password")}
                <div className="field-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(event) => onChange("password", event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="input-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <UiIcon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </label>
            </div>
            <aside className="signin-visual" aria-hidden="true">
              <img src={communityImg} alt="" />
            </aside>
          </div>
        )}
        {statusModeMatches && status?.error ? <p className="modal-alert error">{status.error}</p> : null}
        {statusModeMatches && status?.success ? <p className="modal-alert success">{status.success}</p> : null}
        {showDebugLink ? (
          <a className="modal-debug-link" href={status.debugLink}>
            Continue (dev shortcut)
          </a>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            <UiIcon name="close" />
            {t("auth.close")}
          </button>
          <button type="submit" className="btn" disabled={status?.loading}>
            <UiIcon name={isSignUp ? "userPlus" : "send"} />
            {status?.loading ? loadingLabel : submitLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function SubscribeModal({ open, onClose, form, onChange, onSubmit, status, t }) {
  return (
    <ModalShell open={open} onClose={onClose} panelClassName="cart-modal">
      <div className="modal-header">
        <h3>{t("modals.subscribe.title")}</h3>
        <p>{t("modals.subscribe.subtitle")}</p>
      </div>
      <form className="modal-body" onSubmit={onSubmit}>
        <label>
          {t("modals.subscribe.name")}
          <input value={form.name} onChange={(event) => onChange("name", event.target.value)} />
        </label>
        <label>
          {t("modals.subscribe.email")}
          <input value={form.email} onChange={(event) => onChange("email", event.target.value)} />
        </label>
        <label>
          {t("modals.subscribe.phone")}
          <input value={form.phone} onChange={(event) => onChange("phone", event.target.value)} />
        </label>
        {status?.error ? <p className="modal-alert error">{status.error}</p> : null}
        {status?.success ? (
          <p className="modal-alert success">{t("modals.subscribe.success")}</p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            <UiIcon name="close" />
            {t("modals.subscribe.cancel")}
          </button>
          <button type="submit" className="btn" disabled={status?.loading}>
            <UiIcon name="send" />
            {status?.loading ? t("modals.subscribe.submitting") : t("modals.subscribe.submit")}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CartModal({
  open,
  onClose,
  items,
  onChangeQty,
  onRemove,
  onClear,
  form,
  onFormChange,
  onPaymentSelect,
  onCheckPaymentStatus,
  onSubmit,
  status,
  countryOptions = DEFAULT_COUNTRY_OPTIONS,
  paymentMethods = DEFAULT_CHECKOUT_METHODS,
  t,
}) {
  const hasItems = Array.isArray(items) && items.length > 0;
  const pricedItems = items.filter((item) => Number.isFinite(item.unitAmount));
  const currencies = Array.from(new Set(pricedItems.map((item) => item.currency).filter(Boolean)));
  const mixedCurrency = currencies.length > 1;
  const subtotal = pricedItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
  const paymentMethodOptions = (Array.isArray(paymentMethods) && paymentMethods.length
    ? paymentMethods
    : DEFAULT_CHECKOUT_METHODS
  );
  const enabledPaymentMethodOptions = paymentMethodOptions.filter(
    (item) => item.enabled !== false && item.available !== false
  );
  const selectedPaymentMethod = normalizePaymentMethodCode(form.payment_method);
  const selectedPaymentProvider = String(form.payment_provider || "").trim().toLowerCase();
  const selectedPaymentOption = enabledPaymentMethodOptions.find(
    (item) => normalizePaymentMethodCode(item.code) === selectedPaymentMethod &&
      String(item.provider_code || "").trim().toLowerCase() === selectedPaymentProvider
  );
  const paymentMethodLabel = (code) => {
    const normalized = normalizePaymentMethodCode(code);
    if (normalized === "paypal") return resolveCopy(t, "cart.paymentMethodPaypal", "PayPal");
    if (normalized === "google_pay") return resolveCopy(t, "cart.paymentMethodGooglePay", "Google Pay");
    if (normalized === "apple_pay") return resolveCopy(t, "cart.paymentMethodApplePay", "Apple Pay");
    if (normalized === "manual_test") return resolveCopy(t, "cart.paymentMethodManualTest", "Sandbox manual test");
    return resolveCopy(t, "cart.paymentMethodCard", "Credit card");
  };
  const paymentModeLabel = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "production") return "live";
    if (normalized === "sandbox") return "sandbox";
    return normalized || "not configured";
  };
  const subtotalLabel =
    currencies.length === 1
      ? formatCurrencyAmount(subtotal, currencies[0])
      : `${subtotal.toFixed(2)}`;

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="modal-header">
        <h3>{t("cart.title")}</h3>
      </div>
      {!hasItems ? (
        <>
          <p className="samara-alert">{t("cart.empty")}</p>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              <UiIcon name="close" />
              {t("cart.close")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="cart-list">
            {items.map((item) => {
              const lineAmount = Number.isFinite(item.unitAmount)
                ? formatCurrencyAmount(item.unitAmount * item.quantity, item.currency)
                : item.priceLabel || "";
              return (
                <article key={item.code || item.id} className="cart-item">
                  <img src={item.image || pattern1} alt={item.title || "Product"} />
                  <div className="cart-item-content">
                    <p className="cart-item-title">{item.title}</p>
                    <p className="cart-item-meta">{item.meta}</p>
                    <p className="cart-item-price">{lineAmount || t("cart.unknownPrice")}</p>
                    <div className="cart-item-actions">
                      <div className="cart-qty">
                        <button type="button" onClick={() => onChangeQty(item.code, item.quantity - 1)}>
                          <UiIcon name="minus" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => onChangeQty(item.code, event.target.value)}
                        />
                        <button type="button" onClick={() => onChangeQty(item.code, item.quantity + 1)}>
                          <UiIcon name="plus" />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="cart-remove icon-only"
                        onClick={() => onRemove(item.code)}
                        aria-label={t("cart.remove")}
                        data-tip={t("cart.remove")}
                      >
                        <UiIcon name="trash" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="cart-summary">
            <p>
              <strong>{t("cart.subtotal")}:</strong> {subtotalLabel}
            </p>
            {!pricedItems.length ? <p>{t("cart.unknownPrice")}</p> : null}
            {mixedCurrency ? <p className="modal-alert error">{t("cart.mixedCurrency")}</p> : null}
          </div>

          <div className="cart-checkout">
            <h4>{t("cart.details")}</h4>
            <form className="modal-body" onSubmit={onSubmit}>
              <label>
                {t("modals.order.name")}
                <input value={form.name} onChange={(event) => onFormChange("name", event.target.value)} />
              </label>
              <label>
                {t("modals.order.email")}
                <input value={form.email} onChange={(event) => onFormChange("email", event.target.value)} />
              </label>
              <label>
                {t("modals.order.phone")}
                <input
                  value={form.phone}
                  onChange={(event) => onFormChange("phone", event.target.value)}
                  inputMode="tel"
                  maxLength={24}
                />
              </label>
              <div className="cart-checkout-block">
                <p className="cart-checkout-title">{resolveCopy(t, "cart.deliveryTitle", "Delivery address")}</p>
                <label>
                  {resolveCopy(t, "cart.country", "Country")}
                  <CountrySelect
                    value={form.delivery_country}
                    options={countryOptions}
                    onChange={(value) => onFormChange("delivery_country", value)}
                  />
                </label>
                <label>
                  {resolveCopy(t, "cart.address1", "Address line 1")}
                  <input
                    value={form.delivery_address1}
                    onChange={(event) => onFormChange("delivery_address1", event.target.value)}
                  />
                </label>
                <label>
                  {resolveCopy(t, "cart.address2", "Address line 2")}
                  <input
                    value={form.delivery_address2}
                    onChange={(event) => onFormChange("delivery_address2", event.target.value)}
                  />
                </label>
                <div className="field-grid-equal">
                  <label>
                    {resolveCopy(t, "cart.city", "City")}
                    <input
                      value={form.delivery_city}
                      onChange={(event) => onFormChange("delivery_city", event.target.value)}
                    />
                  </label>
                  <label>
                    {resolveCopy(t, "cart.region", "Region / State")}
                    <input
                      value={form.delivery_region}
                      onChange={(event) => onFormChange("delivery_region", event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  {resolveCopy(t, "cart.postcode", "Postcode")}
                  <input
                    value={form.delivery_postcode}
                    onChange={(event) => onFormChange("delivery_postcode", event.target.value)}
                  />
                </label>
              </div>

              <div className="cart-checkout-block">
                <p className="cart-checkout-title">{resolveCopy(t, "cart.billingTitle", "Billing address")}</p>
                <label className="terms-check">
                  <input
                    type="checkbox"
                    checked={Boolean(form.billing_same_as_delivery)}
                    onChange={(event) => onFormChange("billing_same_as_delivery", event.target.checked)}
                  />
                  <span>{resolveCopy(t, "cart.sameAsDelivery", "Billing address is same as delivery")}</span>
                </label>
                {!form.billing_same_as_delivery ? (
                  <>
                    <label>
                      {resolveCopy(t, "cart.country", "Country")}
                      <CountrySelect
                        value={form.billing_country}
                        options={countryOptions}
                        onChange={(value) => onFormChange("billing_country", value)}
                      />
                    </label>
                    <label>
                      {resolveCopy(t, "cart.address1", "Address line 1")}
                      <input
                        value={form.billing_address1}
                        onChange={(event) => onFormChange("billing_address1", event.target.value)}
                      />
                    </label>
                    <label>
                      {resolveCopy(t, "cart.address2", "Address line 2")}
                      <input
                        value={form.billing_address2}
                        onChange={(event) => onFormChange("billing_address2", event.target.value)}
                      />
                    </label>
                    <div className="field-grid-equal">
                      <label>
                        {resolveCopy(t, "cart.city", "City")}
                        <input
                          value={form.billing_city}
                          onChange={(event) => onFormChange("billing_city", event.target.value)}
                        />
                      </label>
                      <label>
                        {resolveCopy(t, "cart.region", "Region / State")}
                        <input
                          value={form.billing_region}
                          onChange={(event) => onFormChange("billing_region", event.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      {resolveCopy(t, "cart.postcode", "Postcode")}
                      <input
                        value={form.billing_postcode}
                        onChange={(event) => onFormChange("billing_postcode", event.target.value)}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              <div className="cart-checkout-block">
                <p className="cart-checkout-title">{resolveCopy(t, "cart.paymentTitle", "Payment")}</p>
                <fieldset className="payment-method-picker">
                  <legend>{resolveCopy(t, "cart.paymentMethod", "Payment method")}</legend>
                  {enabledPaymentMethodOptions.length ? (
                    <div className="payment-method-buttons" role="group" aria-label={resolveCopy(t, "cart.paymentMethod", "Payment method")}>
                      {enabledPaymentMethodOptions.map((item) => {
                        const methodCode = normalizePaymentMethodCode(item.code);
                        const providerCode = String(item.provider_code || "").trim().toLowerCase();
                        const selected = selectedPaymentOption === item;
                        const label = item.label || paymentMethodLabel(methodCode);
                        return (
                          <button
                            type="button"
                            key={`${providerCode || "provider"}-${methodCode}`}
                            className={`payment-method-button payment-method-${paymentMethodBrandClass(methodCode)}${selected ? " selected" : ""}`}
                            aria-label={`${label} via ${item.provider_label || providerCode.replace(/_/g, " ") || label}`}
                            aria-pressed={selected}
                            onClick={() => onPaymentSelect(methodCode, providerCode)}
                          >
                            <PaymentMethodLogo methodCode={methodCode} label={label} />
                            <span className="payment-method-button-copy">
                              <strong>{label}</strong>
                              <small>
                                {item.provider_label || providerCode.replace(/_/g, " ") || label}
                                {item.mode ? ` · ${paymentModeLabel(item.mode)}` : ""}
                              </small>
                            </span>
                            <span className="payment-method-selected-mark" aria-hidden="true">✓</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="modal-alert error">No payment method is currently available.</p>
                  )}
                </fieldset>
                <p className="modal-alert">
                  {resolveCopy(
                    t,
                    "cart.paymentProviderNotice",
                    "This method opens a governed checkout session. No raw card details are collected by EIP."
                  )}
                </p>
              </div>
              {status?.error ? <p className="modal-alert error">{status.error}</p> : null}
              {status?.notice ? <p className="modal-alert">{status.notice}</p> : null}
              {status?.success ? (
                <p className="modal-alert success">
                  {formatCopy(t("cart.success"), {
                    code: status.orderCode || t("cart.pending"),
                  })}
                  {status.paymentCode
                    ? ` - ${formatCopy(resolveCopy(t, "cart.paymentSuccess", "Payment registered. Reference: {code}"), {
                        code: status.paymentCode,
                      })}`
                    : ""}
                </p>
              ) : null}
              <div className="modal-actions">
                {status?.awaitingProvider ? (
                  <button type="button" className="btn ghost" onClick={onCheckPaymentStatus} disabled={status?.checkingStatus}>
                    <UiIcon name="checkout" />
                    {status?.checkingStatus ? "Checking..." : "Check payment status"}
                  </button>
                ) : null}
                <button type="button" className="btn ghost" onClick={onClear} disabled={!hasItems}>
                  <UiIcon name="trash" />
                  {t("cart.clear")}
                </button>
                <button type="button" className="btn ghost" onClick={onClose}>
                  <UiIcon name="close" />
                  {t("cart.close")}
                </button>
                <button type="submit" className="btn" disabled={status?.loading || status?.awaitingProvider || !hasItems || mixedCurrency}>
                  <UiIcon name="checkout" />
                  {status?.loading ? t("cart.checkingOut") : t("cart.checkout")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function PaymentLifecycleModal({ state, onCheck, onReturnToCart, onClose }) {
  const lifecycle = String(state?.lifecycle || "pending").toLowerCase();
  const pending = lifecycle === "pending";
  const success = ["paid", "partially_refunded", "refunded"].includes(lifecycle);
  const cancelled = lifecycle === "cancelled";
  const title = success
    ? "Payment successful"
    : cancelled
      ? "Payment cancelled"
      : lifecycle === "failed"
        ? "Payment failed"
        : "Waiting for PayPal";
  return (
    <ModalShell open={Boolean(state?.open)} onClose={onClose} panelClassName="payment-lifecycle-modal">
      <div className={`payment-lifecycle-state ${lifecycle}`}>
        <div className="payment-lifecycle-mark" aria-hidden="true">{success ? "✓" : cancelled || lifecycle === "failed" ? "×" : "…"}</div>
        <div>
          <p className="cart-checkout-title">PayPal checkout</p>
          <h3>{title}</h3>
          {success ? (
            <>
              <p><strong>Thank you for your purchase!</strong></p>
              <p>Your order has been successfully received.</p>
              {state?.closeHint ? <p>{state.closeHint}</p> : null}
            </>
          ) : (
            <p>{state?.message || "Payment opened in PayPal. Waiting for confirmation…"}</p>
          )}
          {!success && state?.closeHint ? <p>{state.closeHint}</p> : null}
          {state?.orderCode ? <p><strong>Order:</strong> {state.orderCode}</p> : null}
          {state?.paymentCode ? <p><strong>Payment:</strong> {state.paymentCode}</p> : null}
        </div>
      </div>
      <div className="modal-actions">
        {pending ? (
          <button type="button" className="btn" onClick={onCheck} disabled={state?.checking}>
            <UiIcon name="checkout" />
            {state?.checking ? "Checking..." : "Check status"}
          </button>
        ) : null}
        {cancelled || lifecycle === "failed" ? (
          <button type="button" className="btn" onClick={onReturnToCart}>
            <UiIcon name="cart" />
            Return to cart
          </button>
        ) : null}
        <button type="button" className="btn ghost" onClick={onClose}>
          <UiIcon name="close" />
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function OrderConfirmationPage({ confirmation, onContinueShopping }) {
  const items = Array.isArray(confirmation?.items) ? confirmation.items : [];
  return (
    <main className="order-confirmation-page">
      <section className="order-confirmation-card">
        <div className="order-confirmation-mark" aria-hidden="true">✓</div>
        <p className="order-confirmation-eyebrow">Order confirmation</p>
        <h1>Payment successful</h1>
        <p className="order-confirmation-thanks">Thank you for your purchase!</p>
        <p>Your order has been successfully received.</p>
        <dl className="order-confirmation-details">
          <div><dt>Order</dt><dd>{confirmation?.orderCode || "Processing"}</dd></div>
          <div><dt>Payment</dt><dd>{confirmation?.paymentCode || "Confirmed"}</dd></div>
          <div><dt>Status</dt><dd>Paid</dd></div>
        </dl>
        {items.length ? (
          <div className="order-confirmation-items">
            <h2>Order details</h2>
            {items.map((item) => (
              <div key={item.code || item.id} className="order-confirmation-item">
                <span>{item.title || item.code || "Item"}</span>
                <span>Qty {item.quantity || 1}</span>
              </div>
            ))}
          </div>
        ) : null}
        <button type="button" className="btn" onClick={onContinueShopping}>
          Continue shopping
          <UiIcon name="arrowRight" />
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("home");
  const [language, setLanguage] = useState("en");
  const [selectedMarketplaceCode, setSelectedMarketplaceCode] = useState("");
  const [languageOptions, setLanguageOptions] = useState(() =>
    normalizeLanguageOptions(DEFAULT_LANGUAGE_OPTIONS)
  );
  const [previewCode, setPreviewCode] = useState("");
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [filters, setFilters] = useState({
    category: "all",
    difficulty: "all",
    sortBy: "featured",
  });
  const [homeItems, setHomeItems] = useState([]);
  const [heroContent, setHeroContent] = useState(null);
  const [contentBySlot, setContentBySlot] = useState({});
  const [contentListsBySlot, setContentListsBySlot] = useState({});
  const [contentLoadingBySlot, setContentLoadingBySlot] = useState({});
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [homeLoading, setHomeLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [gatewayStatus, setGatewayStatus] = useState({
    loading: false,
    ok: false,
    manifestOk: false,
    error: "",
  });
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribeForm, setSubscribeForm] = useState({ name: "", email: "", phone: "" });
  const [subscribeStatus, setSubscribeStatus] = useState({ loading: false, error: "", success: false });
  const [memberEntryOpen, setMemberEntryOpen] = useState(false);
  const [memberAuthOpen, setMemberAuthOpen] = useState(false);
  const [countryOptions, setCountryOptions] = useState(DEFAULT_COUNTRY_OPTIONS);
  const [tradeTermsText, setTradeTermsText] = useState("");
  const [tradeTermsItems, setTradeTermsItems] = useState([]);
  const [tradeTermsLoading, setTradeTermsLoading] = useState(false);
  const [storefrontFx, setStorefrontFx] = useState(DEFAULT_STOREFRONT_FX);
  const [memberAuthForm, setMemberAuthForm] = useState({
    mode: "signin",
    credential: "",
    password: "",
    confirmPassword: "",
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    phoneCountry: DEFAULT_COUNTRY_ISO,
    phoneNumber: "",
    address1: "",
    address2: "",
    postcode: "",
    country: DEFAULT_COUNTRY_ISO,
    termsAccepted: false,
  });
  const [memberAuthStatus, setMemberAuthStatus] = useState({
    loading: false,
    error: "",
    success: "",
    debugLink: "",
    mode: "",
  });
  const [memberUser, setMemberUser] = useState(null);
  const [profileForm, setProfileForm] = useState(() => buildProfileForm(null));
  const [profileStatus, setProfileStatus] = useState({ loading: false, error: "", success: "" });
  const [memberHistory, setMemberHistory] = useState([]);
  const [memberHistoryLoading, setMemberHistoryLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [instantCheckoutItem, setInstantCheckoutItem] = useState(null);
  const [cartItems, setCartItems] = useState(() => loadStoredCart());
  const [favoriteMap, setFavoriteMap] = useState({});
  const [checkoutConfig, setCheckoutConfig] = useState(() => normalizeCheckoutConfig(DEFAULT_CHECKOUT_CONFIG));
  const [checkoutForm, setCheckoutForm] = useState(() => buildCheckoutFormDefaults(DEFAULT_COUNTRY_ISO));
  const [checkoutStatus, setCheckoutStatus] = useState({
    loading: false,
    error: "",
    success: false,
    orderCode: "",
    paymentCode: "",
  });
  const [paymentLifecycleView, setPaymentLifecycleView] = useState({
    open: false,
    lifecycle: "pending",
    message: "",
    paymentCode: "",
    orderCode: "",
    checking: false,
  });
  const [orderConfirmation, setOrderConfirmation] = useState({
    orderCode: "",
    paymentCode: "",
    items: [],
  });
  const [productDetail, setProductDetail] = useState(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);
  const [productDetailError, setProductDetailError] = useState("");
  const [productReviews, setProductReviews] = useState([]);
  const [productReviewSummary, setProductReviewSummary] = useState(null);
  const [productReviewsLoading, setProductReviewsLoading] = useState(false);
  const [productReviewsError, setProductReviewsError] = useState("");
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: "",
    comment: "",
    name: "",
    email: "",
  });
  const [reviewSubmitState, setReviewSubmitState] = useState({
    loading: false,
    error: "",
    success: false,
    pending: false,
  });
  const [learningIntakeOpen, setLearningIntakeOpen] = useState(false);
  const [learningIntakeForm, setLearningIntakeForm] = useState({
    name: "",
    email: "",
    phone: "",
    track: LEARNING_TRACKS[0]?.title || "",
    goal: "",
  });
  const [learningIntakeStatus, setLearningIntakeStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogError, setBlogError] = useState("");
  const t = useTranslator(language);
  const plugReady = Boolean(EIP_CONFIG.endpoint);
  const pageSize = EIP_CONFIG.pageSize;
  const clientSource = EIP_CONFIG.clientSource;
  const externalRefPrefix = EIP_CONFIG.externalRefPrefix;
  const lastMemberLoginRef = useRef("");
  const paypalReturnHandledRef = useRef(false);
  const paypalCheckoutWindowRef = useRef(null);
  const favoritesStorageKey = useMemo(() => buildFavoritesStorageKey(memberUser), [memberUser]);
  const marketplaceOptions = useMemo(
    () => buildMarketplaceOptions(storefrontFx, countryOptions, languageOptions),
    [storefrontFx, countryOptions, languageOptions]
  );
  const activeMarketplace = useMemo(
    () =>
      marketplaceOptions.find((item) => item.code === selectedMarketplaceCode) ||
      marketplaceOptions[0] ||
      null,
    [marketplaceOptions, selectedMarketplaceCode]
  );
  const priceContext = useMemo(() => {
    const baseCurrency = normalizeCurrencyCode(storefrontFx?.fx?.base_currency || "USD", "USD");
    const marketCurrency = normalizeCurrencyCode(activeMarketplace?.currency || baseCurrency, baseCurrency);
    const exchangeRateRaw = Number(activeMarketplace?.exchangeRate);
    const hasValidMarketRate =
      Boolean(activeMarketplace) &&
      /^[A-Z]{3}$/.test(marketCurrency) &&
      Number.isFinite(exchangeRateRaw) &&
      exchangeRateRaw > 0;
    const effectiveCurrency = hasValidMarketRate ? marketCurrency : "USD";
    const exchangeRate = hasValidMarketRate ? exchangeRateRaw : 1;
    return {
      baseCurrency,
      currency: effectiveCurrency,
      exchangeRate,
      jurisdiction:
        String(activeMarketplace?.code || "")
          .trim()
          .toUpperCase() || null,
    };
  }, [storefrontFx, activeMarketplace]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const pageParam = String(params.get("page") || "").toLowerCase();
    const previewParam = String(params.get("preview") || "").trim();
    const productParam = String(params.get("product") || "").trim();
    const mlChallenge = String(params.get("mlc") || "").trim();
    const mlToken = String(params.get("mlt") || "").trim();
    const allowedPages = new Set(["home", "patterns", "pages", "sizes", "blog", "line", "learning", "collab", "account", "profile"]);
    if (allowedPages.has(pageParam)) setActivePage(pageParam);
    if (productParam) {
      setSelectedProductCode(productParam);
      setActivePage("product");
    }
    if (previewParam) {
      setPreviewCode(previewParam);
      setActivePage("patterns");
    }
    if (mlChallenge && mlToken) {
      verifyMemberAuth({
        payload: { challenge_id: mlChallenge, token: mlToken },
      })
        .then((res) => {
          setMemberUser(res?.member || null);
          setMemberAuthStatus({ loading: false, error: "", success: "", debugLink: "", mode: "signin" });
          setMemberAuthOpen(false);
        })
        .catch(() => {
          setMemberUser(null);
          setMemberAuthStatus((prev) => ({
            ...prev,
            loading: false,
            error: COPY.en.auth.verifyFailed,
            mode: "signin",
          }));
          setMemberAuthForm((prev) => ({ ...prev, mode: "signin", password: "" }));
          setMemberAuthOpen(true);
        })
        .finally(() => {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("mlc");
          clean.searchParams.delete("mlt");
          window.history.replaceState({}, "", clean.toString());
        });
    }
  }, []);

  const presentPaymentLifecycle = useCallback((result, { openPending = false, popupReturn = false } = {}) => {
    const payment = result?.payment || {};
    const order = result?.order || {};
    const lifecycle = String(payment.lifecycle_state || result?.status || payment.status || "pending").toLowerCase();
    const paymentCode = String(payment.code || "").trim();
    const orderCode = String(order.code || payment.order_code || "").trim();
    const success = ["paid", "partially_refunded", "refunded"].includes(lifecycle);
    const cancelled = lifecycle === "cancelled";
    const failed = lifecycle === "failed";
    const message = success
      ? "Thank you for your purchase! Your order has been successfully received."
      : cancelled
        ? "PayPal checkout was cancelled. No payment was recorded."
        : failed
          ? "PayPal could not complete this payment."
          : "Payment opened in PayPal. Waiting for confirmation…";

    setCheckoutStatus((previous) => ({
      ...previous,
      loading: false,
      checkingStatus: false,
      awaitingProvider: !success && !cancelled && !failed,
      error: cancelled || failed ? message : "",
      notice: success ? "" : message,
      success,
      orderCode,
      paymentCode: paymentCode || previous.paymentCode,
    }));
    if ((success && popupReturn) || cancelled || failed || openPending) {
      setPaymentLifecycleView({
        open: true,
        lifecycle,
        message,
        paymentCode,
        orderCode,
        checking: false,
      });
    }
    if (success) {
      const purchasedItems = checkoutItems.map((item) => ({
        id: item.id || null,
        code: item.code || "",
        title: item.title || item.code || "Item",
        quantity: item.quantity || 1,
      }));
      setOrderConfirmation({ orderCode, paymentCode, items: purchasedItems });
      setInstantCheckoutItem(null);
      setCartItems([]);
      setCartOpen(false);
      if (!popupReturn) {
        setPaymentLifecycleView((previous) => ({ ...previous, open: false }));
        setActivePage("order-confirmation");
        if (typeof window !== "undefined") {
          const confirmationUrl = new URL(window.location.href);
          confirmationUrl.searchParams.set("page", "order-confirmation");
          if (orderCode) confirmationUrl.searchParams.set("order", orderCode);
          window.history.replaceState({}, "", confirmationUrl.toString());
        }
      }
    }
    return lifecycle;
  }, [checkoutItems]);

  const checkPaymentLifecycle = useCallback(async (paymentCode, { openPending = false, background = false, popupReturn = false } = {}) => {
    const reference = String(paymentCode || "").trim();
    if (!reference) return "missing";
    if (!background) {
      setCheckoutStatus((previous) => ({ ...previous, checkingStatus: true }));
      setPaymentLifecycleView((previous) => ({ ...previous, checking: true }));
    }
    try {
      const result = await fetchCheckoutSession({ paymentId: reference });
      return presentPaymentLifecycle(result, { openPending, popupReturn });
    } catch (error) {
      const message = friendlyCheckoutError(error, "Unable to check payment status.");
      if (!background) {
        setCheckoutStatus((previous) => ({ ...previous, checkingStatus: false, error: message }));
        setPaymentLifecycleView((previous) => ({ ...previous, checking: false, message }));
      }
      return "error";
    }
  }, [presentPaymentLifecycle]);

  useEffect(() => {
    if (!plugReady || paypalReturnHandledRef.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const returnStatus = String(params.get("eip_payment_status") || "").toLowerCase();
    const paymentCode = String(params.get("eip_payment_code") || "").trim();
    if (!["approved", "cancelled"].includes(returnStatus) || !paymentCode) return;
    paypalReturnHandledRef.current = true;

    const providerSessionId = String(params.get("token") || "").trim();
    const clean = new URL(window.location.href);
    for (const key of ["token", "PayerID", "eip_payment_status", "eip_payment_code"]) {
      clean.searchParams.delete(key);
    }
    window.history.replaceState({}, "", clean.toString());
    setPaymentLifecycleView({
      open: true,
      lifecycle: "pending",
      message: returnStatus === "cancelled" ? "Recording PayPal cancellation…" : "Verifying PayPal payment with EIP…",
      paymentCode,
      orderCode: "",
      checking: true,
    });

    const operation = returnStatus === "cancelled"
      ? cancelCheckoutSession({
          paymentId: paymentCode,
          payload: { return_flow: "paypal" },
        })
      : confirmCheckoutSession({
          payload: {
            payment_code: paymentCode,
            provider_session_id: providerSessionId || undefined,
            metadata: { source: clientSource, return_flow: "paypal" },
          },
        });

    operation
      .then((result) => {
        const lifecycle = presentPaymentLifecycle(result, { openPending: true, popupReturn: true });
        const payment = result?.payment || {};
        const order = result?.order || {};
        const notified = notifyPaypalCheckoutOpener({
          lifecycle,
          paymentCode: payment.code || paymentCode,
          orderCode: order.code || payment.order_code || "",
        });
        if (notified && ["paid", "partially_refunded", "refunded", "cancelled", "failed"].includes(lifecycle)) {
          window.setTimeout(() => {
            window.close();
            window.setTimeout(() => {
              setPaymentLifecycleView((previous) => ({
                ...previous,
                open: true,
                closeHint: "You may now close this window.",
              }));
            }, 400);
          }, 900);
        }
        return lifecycle;
      })
      .catch((error) => {
        const message = friendlyCheckoutError(error, "PayPal confirmation failed.");
        setCheckoutStatus({
          loading: false,
          error: message,
          success: false,
          orderCode: "",
          paymentCode,
        });
        setPaymentLifecycleView({
          open: true,
          lifecycle: "failed",
          message,
          paymentCode,
          orderCode: "",
          checking: false,
        });
        const notified = notifyPaypalCheckoutOpener({ lifecycle: "failed", paymentCode });
        if (notified) {
          window.setTimeout(() => {
            window.close();
            window.setTimeout(() => {
              setPaymentLifecycleView((previous) => ({
                ...previous,
                open: true,
                closeHint: "You may now close this window.",
              }));
            }, 400);
          }, 900);
        }
      });
  }, [plugReady, clientSource, presentPaymentLifecycle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const receivePaypalResult = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== PAYPAL_CHECKOUT_MESSAGE_TYPE) return;
      if (paypalCheckoutWindowRef.current && event.source !== paypalCheckoutWindowRef.current) return;
      const paymentCode = String(event.data?.paymentCode || "").trim();
      if (!paymentCode) return;
      setCheckoutStatus((previous) => ({
        ...previous,
        loading: false,
        awaitingProvider: false,
        autoPollingStopped: true,
        notice: "Refreshing your order confirmation…",
      }));
      setCartOpen(false);
      const lifecycle = await checkPaymentLifecycle(paymentCode);
      if (["paid", "partially_refunded", "refunded", "cancelled", "failed"].includes(lifecycle)) {
        try {
          if (paypalCheckoutWindowRef.current && !paypalCheckoutWindowRef.current.closed) {
            paypalCheckoutWindowRef.current.close();
          }
        } catch {
          // The popup also attempts to close itself after notifying the opener.
        }
        paypalCheckoutWindowRef.current = null;
      }
    };
    window.addEventListener("message", receivePaypalResult);
    return () => window.removeEventListener("message", receivePaypalResult);
  }, [checkPaymentLifecycle]);

  useEffect(() => {
    const paymentCode = String(checkoutStatus.paymentCode || "").trim();
    if (!plugReady || !checkoutStatus.awaitingProvider || checkoutStatus.autoPollingStopped || !paymentCode) return;
    let active = true;
    let attempts = 0;
    const poll = async () => {
      if (!active) return;
      attempts += 1;
      const lifecycle = await checkPaymentLifecycle(paymentCode, { background: true });
      if (!active || ["paid", "partially_refunded", "refunded", "cancelled", "failed"].includes(lifecycle)) return;
      if (attempts >= 40) {
        setCheckoutStatus((previous) => ({
          ...previous,
          autoPollingStopped: true,
          notice: "Payment is still pending. Use Check payment status after completing PayPal checkout.",
        }));
      }
    };
    const first = window.setTimeout(poll, 1500);
    const interval = window.setInterval(poll, 3000);
    return () => {
      active = false;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [plugReady, checkoutStatus.awaitingProvider, checkoutStatus.autoPollingStopped, checkoutStatus.paymentCode, checkPaymentLifecycle]);

  const fetchHomeItems = useCallback(async () => {
    if (!plugReady) return;
    setHomeLoading(true);
    try {
      const requestedHomeLimit = Math.max(
        pageSize * 2,
        Math.max(1, Number(EIP_CONFIG.homeCatalogLimit) || 96),
        Math.max(1, Number(EIP_CONFIG.dropMaxCards) || 48),
        Math.max(1, Number(EIP_CONFIG.worthMaxCards) || 24),
        24
      );
      const res = await fetchCatalog({
        materialType: EIP_CONFIG.materialType,
        limit: requestedHomeLimit,
        offset: 0,
      });
      setHomeItems(Array.isArray(res?.items) ? res.items : []);
    } catch (err) {
      console.error("EIP home catalog load failed", err);
      setHomeItems([]);
    } finally {
      setHomeLoading(false);
    }
  }, [plugReady, pageSize]);

  const fetchHeroContent = useCallback(async () => {
    if (!plugReady) {
      setHeroContent(null);
      return;
    }
    try {
      const search =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const previewSlot = search?.get("content_slot");
      const previewMode = search?.get("content_preview") === "1";
      const res = await fetchStorefrontContent({
        slot: previewSlot || "home.hero",
        publishedOnly: !previewMode,
      });
      const item = res?.item || null;
      setHeroContent(item);
      setContentBySlot((prev) => ({ ...prev, [String(previewSlot || "home.hero").toLowerCase()]: item }));
    } catch (err) {
      console.error("EIP storefront content load failed", err);
      setHeroContent(null);
    }
  }, [plugReady]);

  const fetchSlotContent = useCallback(
    async (slot, options = {}) => {
      if (!plugReady || !slot) return null;
      const normalizedSlot = String(slot).trim().toLowerCase();
      if (!normalizedSlot) return null;
      setContentLoadingBySlot((prev) => ({ ...prev, [normalizedSlot]: true }));
      try {
        const search =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const previewSlot = search?.get("content_slot");
        const previewMode = search?.get("content_preview") === "1";
        const isPreviewTarget = previewMode && previewSlot && previewSlot.toLowerCase() === normalizedSlot;
        const res = await fetchStorefrontContent({
          slot: normalizedSlot,
          publishedOnly: !isPreviewTarget,
        });
        const item = res?.item || null;
        setContentBySlot((prev) => ({ ...prev, [normalizedSlot]: item }));
        return item;
      } catch (err) {
        console.error(`EIP slot content load failed (${normalizedSlot})`, err);
        setContentBySlot((prev) => ({ ...prev, [normalizedSlot]: null }));
        return null;
      } finally {
        setContentLoadingBySlot((prev) => ({ ...prev, [normalizedSlot]: false }));
      }
    },
    [plugReady]
  );

  const fetchSlotContentList = useCallback(
    async (slot, options = {}) => {
      if (!plugReady || !slot) return [];
      const normalizedSlot = String(slot).trim().toLowerCase();
      if (!normalizedSlot) return [];
      try {
        const res = await fetchStorefrontContentList({
          slot: normalizedSlot,
          page: options.page,
          contentModel: options.contentModel,
          publishedOnly: options.publishedOnly !== false,
          activeOnly: options.activeOnly !== false,
          limit: options.limit || 24,
          offset: options.offset || 0,
        });
        const items = Array.isArray(res?.items) ? res.items : [];
        setContentListsBySlot((prev) => ({ ...prev, [normalizedSlot]: items }));
        return items;
      } catch (err) {
        console.error(`EIP slot content list load failed (${normalizedSlot})`, err);
        setContentListsBySlot((prev) => ({ ...prev, [normalizedSlot]: [] }));
        return [];
      }
    },
    [plugReady]
  );

  const fetchBlogFeed = useCallback(async () => {
    if (!plugReady) return;
    setBlogLoading(true);
    setBlogError("");
    try {
      const res = await fetchBlogPosts({ limit: 40, offset: 0 });
      const incoming = Array.isArray(res?.items)
        ? res.items.map((item, index) => normalizePublicBlogPost(item, index)).filter(Boolean)
        : [];
      setBlogPosts(incoming);
    } catch (err) {
      setBlogPosts([]);
      setBlogError(err?.message || "Failed to load blog feed.");
    } finally {
      setBlogLoading(false);
    }
  }, [plugReady]);

  const fetchCatalogPage = useCallback(async () => {
    if (!plugReady) return;
    setCatalogLoading(true);
    const offset = (catalogPage - 1) * pageSize;
    try {
      const res = await fetchCatalog({
        materialType: EIP_CONFIG.materialType,
        limit: pageSize,
        offset,
      });
      setCatalogItems(Array.isArray(res?.items) ? res.items : []);
      setCatalogError("");
    } catch (err) {
      console.error("EIP catalog load failed", err);
      setCatalogItems([]);
      setCatalogError(err?.message || "Failed to load catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }, [plugReady, pageSize, catalogPage]);

  const fetchProductDetail = useCallback(async (code) => {
    if (!plugReady || !code) return;
    setProductDetailLoading(true);
    setProductDetailError("");
    try {
      const res = await fetchProductByCode({
        code,
      });
      setProductDetail(res?.item || null);
    } catch (err) {
      setProductDetail(null);
      setProductDetailError(err?.message || "Failed to load product.");
    } finally {
      setProductDetailLoading(false);
    }
  }, [plugReady]);

  const fetchProductReviewData = useCallback(async (code) => {
    if (!plugReady || !code) return;
    setProductReviewsLoading(true);
    setProductReviewsError("");
    try {
      const res = await fetchProductReviews({
        code,
        limit: 50,
        offset: 0,
      });
      setProductReviews(Array.isArray(res?.items) ? res.items : []);
      setProductReviewSummary(res?.summary || null);
    } catch (err) {
      setProductReviews([]);
      setProductReviewSummary(null);
      setProductReviewsError(err?.message || "Failed to load reviews.");
    } finally {
      setProductReviewsLoading(false);
    }
  }, [plugReady]);

  useEffect(() => {
    fetchHomeItems();
    fetchHeroContent();
    Object.values(HOME_PRODUCT_SLOTS).forEach((slot) => {
      fetchSlotContent(slot);
    });
    Object.values(LEGACY_HOME_PRODUCT_SLOTS).forEach((slot) => {
      fetchSlotContent(slot);
    });
    ALL_PAGE_CONTENT_SLOTS.forEach((slot) => {
      fetchSlotContent(slot);
    });
    fetchSlotContentList(PAGE_CONTENT_SLOTS.pages.cards, {
      page: "pages",
      contentModel: "article",
      limit: 24,
      offset: 0,
    });
  }, [fetchHomeItems, fetchHeroContent, fetchSlotContent, fetchSlotContentList]);

  useEffect(() => {
    if (!plugReady) {
      setLanguageOptions(normalizeLanguageOptions(DEFAULT_LANGUAGE_OPTIONS));
      return;
    }
    let cancelled = false;
    fetchStorefrontLocales({})
      .then((res) => {
        if (cancelled) return;
        const incoming = Array.isArray(res?.locales) ? res.locales : [];
        setLanguageOptions(normalizeLanguageOptions(incoming, DEFAULT_LANGUAGE_OPTIONS));
      })
      .catch((err) => {
        console.error("EIP locales load failed", err);
        if (!cancelled) setLanguageOptions(normalizeLanguageOptions(DEFAULT_LANGUAGE_OPTIONS));
      });
    return () => {
      cancelled = true;
    };
  }, [plugReady]);

  useEffect(() => {
    if (!plugReady) {
      setStorefrontFx(DEFAULT_STOREFRONT_FX);
      return;
    }
    let cancelled = false;
    fetchStorefrontFx({})
      .then((res) => {
        if (cancelled) return;
        const fxPayload = res && typeof res === "object" ? res : {};
        setStorefrontFx({
          fx: {
            ...DEFAULT_STOREFRONT_FX.fx,
            ...(fxPayload.fx && typeof fxPayload.fx === "object" ? fxPayload.fx : {}),
          },
          marketplaces: Array.isArray(fxPayload.marketplaces) ? fxPayload.marketplaces : [],
        });
      })
      .catch((err) => {
        console.error("EIP FX load failed", err);
        if (!cancelled) setStorefrontFx(DEFAULT_STOREFRONT_FX);
      });
    return () => {
      cancelled = true;
    };
  }, [plugReady]);

  useEffect(() => {
    const normalizedLanguage = normalizeLocaleCode(language);
    const options = Array.isArray(languageOptions) ? languageOptions : [];
    const activeLocale = normalizeLocaleCode(activeMarketplace?.locale || "");
    if (activeLocale && normalizedLanguage === activeLocale) return;
    if (!options.length) return;
    if (options.some((item) => item.code === normalizedLanguage)) return;
    const fallback = activeLocale || options[0]?.code || "en";
    if (fallback && fallback !== language) setLanguage(fallback);
  }, [language, languageOptions, activeMarketplace]);

  useEffect(() => {
    if (!marketplaceOptions.length) {
      setSelectedMarketplaceCode("");
      return;
    }
    const exists = marketplaceOptions.some((item) => item.code === selectedMarketplaceCode);
    if (exists) return;
    setSelectedMarketplaceCode(marketplaceOptions[0].code);
  }, [marketplaceOptions, selectedMarketplaceCode]);

  useEffect(() => {
    if (!marketplaceOptions.length) return;
    const active =
      marketplaceOptions.find((item) => item.code === selectedMarketplaceCode) ||
      marketplaceOptions[0];
    const nextLanguage = normalizeLocaleCode(active?.locale || "en") || "en";
    if (nextLanguage !== language) setLanguage(nextLanguage);
  }, [marketplaceOptions, selectedMarketplaceCode, language]);

  useEffect(() => {
    if (!plugReady) {
      setMemberUser(null);
      return;
    }
    let cancelled = false;
    fetchMemberMe({})
      .then((res) => {
        if (cancelled) return;
        setMemberUser(res?.member || null);
      })
      .catch(() => {
        if (cancelled) return;
        setMemberUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [plugReady]);

  useEffect(() => {
    setProfileForm(buildProfileForm(memberUser));
    setProfileStatus({ loading: false, error: "", success: "" });
  }, [memberUser]);

  useEffect(() => {
    if (learningIntakeOpen) return;
    setLearningIntakeStatus({ loading: false, error: "", success: "" });
  }, [learningIntakeOpen]);

  useEffect(() => {
    const currentLogin = String(memberUser?.login || "").toLowerCase();
    const previousLogin = String(lastMemberLoginRef.current || "").toLowerCase();
    if (previousLogin !== currentLogin) {
      setCartItems([]);
      setInstantCheckoutItem(null);
      setCheckoutStatus({ loading: false, error: "", success: false, orderCode: "", paymentCode: "" });
    }
    lastMemberLoginRef.current = currentLogin;
  }, [memberUser?.login]);

  useEffect(() => {
    if (!plugReady) {
      setCountryOptions(DEFAULT_COUNTRY_OPTIONS);
      return;
    }
    let cancelled = false;
    fetchCountries({})
      .then((res) => {
        if (cancelled) return;
        const incoming = Array.isArray(res?.items) ? res.items : [];
        if (!incoming.length) {
          setCountryOptions(DEFAULT_COUNTRY_OPTIONS);
          return;
        }
        const fallbackByIso = new Map(
          DEFAULT_COUNTRY_OPTIONS.map((item) => [item.iso, item])
        );
        const merged = incoming
          .map((item) => {
            const iso = normalizeIso(item?.iso);
            if (!iso) return null;
            const fallback = fallbackByIso.get(iso);
            return {
              iso,
              name: String(item?.name || fallback?.name || iso).trim(),
              dial: resolveDialCode(iso, fallback?.dial || ""),
            };
          })
          .filter((item) => item && item.name);
        if (!merged.length) {
          setCountryOptions(DEFAULT_COUNTRY_OPTIONS);
          return;
        }
        const seen = new Set(merged.map((item) => item.iso));
        for (const fallback of DEFAULT_COUNTRY_OPTIONS) {
          if (!seen.has(fallback.iso)) merged.push(fallback);
        }
        merged.sort((a, b) => a.name.localeCompare(b.name));
        setCountryOptions(merged);
      })
      .catch(() => {
        if (cancelled) return;
        setCountryOptions(DEFAULT_COUNTRY_OPTIONS);
      });

    return () => {
      cancelled = true;
    };
  }, [plugReady]);

  useEffect(() => {
    const defaultCountry = countryOptions[0]?.iso || DEFAULT_COUNTRY_ISO;
    setCheckoutForm((prev) => {
      const deliveryCountry = prev.delivery_country || defaultCountry;
      const billingCountry = prev.billing_same_as_delivery
        ? deliveryCountry
        : (prev.billing_country || defaultCountry);
      if (deliveryCountry === prev.delivery_country && billingCountry === prev.billing_country) {
        return prev;
      }
      return {
        ...prev,
        delivery_country: deliveryCountry,
        billing_country: billingCountry,
      };
    });
  }, [countryOptions]);

  useEffect(() => {
    if (!plugReady) {
      setTradeTermsText("");
      setTradeTermsItems([]);
      setTradeTermsLoading(false);
      return;
    }
    let cancelled = false;
    setTradeTermsLoading(true);
    fetchTradeConditions({
      channel: "WEB",
      jurisdiction: priceContext.jurisdiction || "",
      currency: priceContext.currency || "",
    })
      .then((res) => {
        if (cancelled) return;
        const items = Array.isArray(res?.items) ? res.items : [];
        setTradeTermsItems(items);
        const text = items
          .map((item, idx) => {
            const label = String(item?.label || item?.code || `Condition ${idx + 1}`).trim();
            const body = String(item?.text || "").trim();
            if (!body) return `- ${label}`;
            return `- ${label}\n  ${body}`;
          })
          .filter(Boolean)
          .join("\n\n");
        setTradeTermsText(text);
      })
      .catch(() => {
        if (cancelled) return;
        setTradeTermsText("");
        setTradeTermsItems([]);
      })
      .finally(() => {
        if (cancelled) return;
        setTradeTermsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [plugReady, priceContext.currency, priceContext.jurisdiction]);

  useEffect(() => {
    if (!plugReady) {
      setCheckoutConfig(normalizeCheckoutConfig(DEFAULT_CHECKOUT_CONFIG));
      return;
    }
    let cancelled = false;
    fetchPaymentMethods({})
      .catch(() => fetchCheckoutConfig({}))
      .then((res) => {
        if (cancelled) return;
        const normalized = normalizeCheckoutConfig({
          payment: res?.payment || { methods: Array.isArray(res?.methods) ? res.methods : [] }
        });
        setCheckoutConfig(normalized);
        const readyMethods = normalized.payment.ready_methods?.length
          ? normalized.payment.ready_methods
          : normalized.payment.enabled_methods || [];
        if (!readyMethods.length) return;
        setCheckoutForm((prev) => {
          const currentMethod = normalizePaymentMethodCode(prev.payment_method);
          const currentProvider = String(prev.payment_provider || "").trim().toLowerCase();
          const currentOption = normalized.payment.methods.find((item) =>
            normalizePaymentMethodCode(item.code) === currentMethod &&
            currentProvider && String(item.provider_code || "").trim().toLowerCase() === currentProvider &&
            item.enabled !== false && item.available !== false
          );
          if (currentOption) return prev;
          const firstReady = normalized.payment.methods.find((item) =>
            readyMethods.includes(normalizePaymentMethodCode(item.code)) && item.enabled !== false && item.available !== false
          );
          return firstReady
            ? { ...prev, payment_method: firstReady.code, payment_provider: firstReady.provider_code || "" }
            : prev;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setCheckoutConfig(normalizeCheckoutConfig(DEFAULT_CHECKOUT_CONFIG));
      });
    return () => {
      cancelled = true;
    };
  }, [plugReady]);

  useEffect(() => {
    if (activePage !== "patterns" && activePage !== "product") return;
    fetchCatalogPage();
  }, [activePage, fetchCatalogPage]);

  useEffect(() => {
    const slots = PAGE_CONTENT_SLOTS[activePage];
    if (slots) {
      Object.values(slots).forEach((slot) => {
        fetchSlotContent(slot);
      });
    }
    if (activePage === "blog") {
      fetchBlogFeed();
    }
  }, [activePage, fetchBlogFeed, fetchSlotContent]);

  useEffect(() => {
    if (!plugReady || !EIP_CONFIG.refreshMs) return;
    const interval = setInterval(() => {
      fetchHomeItems();
      fetchHeroContent();
      Object.values(HOME_PRODUCT_SLOTS).forEach((slot) => {
        fetchSlotContent(slot, { force: true });
      });
      Object.values(LEGACY_HOME_PRODUCT_SLOTS).forEach((slot) => {
        fetchSlotContent(slot, { force: true });
      });
      if (activePage === "patterns" || activePage === "product") {
        fetchCatalogPage();
      }
      const slots = PAGE_CONTENT_SLOTS[activePage];
      if (slots) {
        Object.values(slots).forEach((slot) => {
          fetchSlotContent(slot, { force: true });
        });
      }
      if (activePage === "blog") {
        fetchBlogFeed();
      }
    }, EIP_CONFIG.refreshMs);
    return () => clearInterval(interval);
  }, [plugReady, fetchHomeItems, fetchHeroContent, fetchCatalogPage, fetchSlotContent, fetchBlogFeed, activePage]);

  useEffect(() => {
    if (activePage !== "product" || !selectedProductCode) return;
    fetchProductDetail(selectedProductCode);
    fetchProductReviewData(selectedProductCode);
  }, [activePage, selectedProductCode, fetchProductDetail, fetchProductReviewData]);

  useEffect(() => {
    if (activePage !== "account" || !memberUser?.login || !plugReady) return;
    let cancelled = false;
    setMemberHistoryLoading(true);
    fetchMemberHistory({ limit: 25 })
      .then((res) => {
        if (cancelled) return;
        setMemberHistory(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => {
        if (cancelled) return;
        setMemberHistory([]);
      })
      .finally(() => {
        if (cancelled) return;
        setMemberHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage, memberUser?.login, plugReady]);

  useEffect(() => {
    let active = true;
    if (!plugReady) return undefined;
    const run = async () => {
      setGatewayStatus({ loading: true, ok: false, manifestOk: false, error: "" });
      try {
        await fetchCatalog({ limit: 1 });
        if (!active) return;
        setGatewayStatus({
          loading: false,
          ok: true,
          manifestOk: true,
          error: "",
        });
      } catch (err) {
        if (!active) return;
        setGatewayStatus({
          loading: false,
          ok: false,
          manifestOk: false,
          error: err?.message || "Gateway handshake failed",
        });
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [plugReady]);

  const handleFilterChange = (next) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setCatalogPage(1);
  };

  const openPatternsPage = useCallback(() => {
    setActivePage("patterns");
  }, []);

  const openSubscribe = useCallback(() => {
    setSubscribeForm({ name: "", email: "", phone: "" });
    setSubscribeStatus({ loading: false, error: "", success: false });
    setSubscribeOpen(true);
  }, []);

  const handleLookbook = useCallback(() => {
    const directUrl = String(EIP_CONFIG.lookbookUrl || "").trim();
    if (directUrl) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    openSubscribe();
  }, [openSubscribe]);

  const routeInternalTarget = useCallback(
    (rawTarget) => {
      const raw = String(rawTarget || "").trim();
      if (!raw) {
        openPatternsPage();
        return;
      }
      const normalizedPath = raw.startsWith("/") ? raw.toLowerCase() : `/${raw.toLowerCase()}`;
      if (normalizedPath.startsWith("/patterns")) {
        const parts = raw.split("/");
        const maybeCode = parts.length > 2 ? String(parts[2] || "").trim() : "";
        if (maybeCode) {
          setSelectedProductCode(maybeCode);
          setActivePage("product");
          return;
        }
        openPatternsPage();
        return;
      }
      if (normalizedPath.startsWith("/account")) {
        setActivePage("account");
        return;
      }
      if (normalizedPath.startsWith("/profile")) {
        setActivePage("profile");
        return;
      }
      if (normalizedPath.startsWith("/blog")) {
        setActivePage("blog");
        return;
      }
      if (normalizedPath.startsWith("/learning")) {
        setActivePage("learning");
        return;
      }
      if (normalizedPath.startsWith("/line")) {
        setActivePage("line");
        return;
      }
      if (normalizedPath.startsWith("/sizes")) {
        setActivePage("sizes");
        return;
      }
      if (normalizedPath === "/subscribe") {
        openSubscribe();
        return;
      }
      openPatternsPage();
    },
    [openPatternsPage, openSubscribe]
  );

  const scrollToHomeSection = useCallback((targetRaw) => {
    const target = String(targetRaw || "").trim();
    if (!target) return false;
    const normalized = target.startsWith("#") ? target.slice(1) : target;
    if (!normalized) return false;
    if (activePage !== "home") setActivePage("home");
    requestAnimationFrame(() => {
      const node =
        document.getElementById(normalized) ||
        document.querySelector(`[data-anchor="${normalized}"]`);
      if (node && typeof node.scrollIntoView === "function") {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    return true;
  }, [activePage]);

  const handleHeroCta = useCallback(
    (slide) => {
      const cta = slide?.cta && typeof slide.cta === "object" ? slide.cta : {};
      const actionRaw = String(
        cta?.action ||
        slide?.cta_action ||
        ""
      ).trim().toLowerCase();
      const target = String(
        cta?.target ||
        slide?.cta_target ||
        slide?.ctaUrl ||
        slide?.cta_url ||
        ""
      ).trim();
      const newTabRaw =
        cta?.new_tab ??
        slide?.cta_new_tab ??
        cta?.newTab ??
        slide?.cta_newTab;
      const newTab = newTabRaw === true || String(newTabRaw || "").toLowerCase() === "true";
      const action = ["navigate_internal", "navigate_external", "scroll_to"].includes(actionRaw)
        ? actionRaw
        : /^https?:\/\//i.test(target)
          ? "navigate_external"
          : target.startsWith("#")
            ? "scroll_to"
            : "navigate_internal";

      if (action === "navigate_external") {
        const hasProtocol = /^https?:\/\//i.test(target);
        const externalUrl = hasProtocol ? target : target ? `https://${target}` : "";
        if (!externalUrl) {
          routeInternalTarget(target);
          return;
        }
        if (newTab) {
          window.open(externalUrl, "_blank", "noopener,noreferrer");
          return;
        }
        window.location.assign(externalUrl);
        return;
      }

      if (action === "scroll_to") {
        if (newTab && typeof window !== "undefined") {
          const hash = target.startsWith("#") ? target : `#${target}`;
          window.open(`${window.location.origin}/${hash}`, "_blank", "noopener,noreferrer");
          return;
        }
        const scrolled = scrollToHomeSection(target);
        if (!scrolled) openPatternsPage();
        return;
      }

      if (newTab && typeof window !== "undefined") {
        const clean = String(target || "").trim();
        const path = clean ? (clean.startsWith("/") ? clean : `/${clean}`) : "/patterns";
        window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
        return;
      }

      routeInternalTarget(target);
    },
    [openPatternsPage, routeInternalTarget, scrollToHomeSection]
  );

  const handleSubscribeChange = (field, value) => {
    const nextValue = field === "phone" ? sanitizePhoneWithOptionalPlus(value) : value;
    setSubscribeForm((prev) => ({ ...prev, [field]: nextValue }));
  };

  const handleSubscribeSubmit = async (event) => {
    event.preventDefault();
    if (!plugReady) {
      setSubscribeStatus({
        loading: false,
        error: t("errors.subscribeRequiresConnection"),
        success: false,
      });
      return;
    }
    if (!subscribeForm.email && !subscribeForm.phone && !subscribeForm.name) {
      setSubscribeStatus({ loading: false, error: t("errors.subscribeMissing"), success: false });
      return;
    }
    if (subscribeForm.phone && !isValidPhone(subscribeForm.phone)) {
      setSubscribeStatus({ loading: false, error: "Phone number format is invalid.", success: false });
      return;
    }
    setSubscribeStatus({ loading: true, error: "", success: false });
    try {
      await createSubscriber({
        payload: {
          source: clientSource,
          form: "subscribe",
          subscriber: {
            name: subscribeForm.name,
            email: subscribeForm.email,
            phone: subscribeForm.phone,
            locale: language,
          },
        },
      });
      setSubscribeStatus({ loading: false, error: "", success: true });
    } catch (err) {
      setSubscribeStatus({
        loading: false,
        error: err?.message || t("errors.subscribeFailed"),
        success: false,
      });
    }
  };

  const handleMemberAuthChange = (field, value) => {
    const normalizedValue = field === "phoneNumber" ? sanitizeLocalPhoneDigits(value) : value;
    setMemberAuthForm((prev) => {
      if (field !== "mode") return { ...prev, [field]: normalizedValue };
      return {
        ...prev,
        mode: value === "signup" ? "signup" : "signin",
        password: "",
        confirmPassword: "",
      };
    });
    if (field === "mode") {
      setMemberAuthStatus({
        loading: false,
        error: "",
        success: "",
        debugLink: "",
        mode: value === "signup" ? "signup" : "signin",
      });
    }
  };

  const handleMemberAuthSubmit = async (event, mode = "signin") => {
    event.preventDefault();
    const requestedMode =
      String(memberAuthForm.mode || mode || "signin").toLowerCase() === "signup" ? "signup" : "signin";
    const credentialInput = String(memberAuthForm.credential || "").trim();
    const password = String(memberAuthForm.password || "").trim();
    const confirmPassword = String(memberAuthForm.confirmPassword || "").trim();
    const isSignUp = requestedMode === "signup";
    const formEmail = String(memberAuthForm.email || "").trim();
    const username = String(memberAuthForm.username || "").trim();
    const firstName = String(memberAuthForm.firstName || "").trim();
    const lastName = String(memberAuthForm.lastName || "").trim();
    const phoneNumber = String(memberAuthForm.phoneNumber || "").trim();
    const address1 = String(memberAuthForm.address1 || "").trim();
    const address2 = String(memberAuthForm.address2 || "").trim();
    const postcode = String(memberAuthForm.postcode || "").trim();
    const termsAccepted = Boolean(memberAuthForm.termsAccepted);
    const defaultCountry = countryOptions[0] || DEFAULT_COUNTRY_OPTIONS[0];
    const phoneCountry =
      countryOptions.find((item) => item.iso === memberAuthForm.phoneCountry && item.dial) ||
      DEFAULT_COUNTRY_OPTIONS.find((item) => item.iso === memberAuthForm.phoneCountry) ||
      defaultCountry;
    const country =
      countryOptions.find((item) => item.iso === memberAuthForm.country) ||
      DEFAULT_COUNTRY_OPTIONS.find((item) => item.iso === memberAuthForm.country) ||
      defaultCountry;
    const credential = isSignUp ? formEmail : credentialInput;

    if (!isSignUp && (!credential || !password)) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.required", "Enter username/email and password."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !password) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.passwordRequired", "Password is required to create your account."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !confirmPassword) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.confirmPasswordRequired", "Please confirm your password."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.passwordMismatch", "Password confirmation does not match."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !formEmail) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.emailRequired", "Email is required to create your account."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !username) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.usernameRequired", "Username is required to create your account."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !firstName) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.firstNameRequired", "First name is required."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !lastName) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.lastNameRequired", "Second name is required."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !address1) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.addressRequired", "Address line 1 is required."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !postcode) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.postcodeRequired", "Postcode is required."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && phoneNumber && !PHONE_DIGITS_REGEX.test(phoneNumber)) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(t, "auth.phoneInvalid", "Phone number must contain 7 to 15 digits."),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    if (isSignUp && !termsAccepted) {
      setMemberAuthStatus({
        loading: false,
        error: resolveCopy(
          t,
          "auth.termsRequired",
          "Please confirm that you read and understood the Terms and Conditions."
        ),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
      return;
    }
    setMemberAuthStatus({
      loading: true,
      error: "",
      success: "",
      debugLink: "",
      mode: requestedMode,
    });
    try {
      const res = await startMemberAuth({
        payload: {
          mode: requestedMode,
          credential,
          password,
          email: isSignUp ? formEmail : "",
          username: isSignUp ? username : "",
          name: isSignUp ? `${firstName} ${lastName}`.trim() : "",
          metadata: isSignUp
            ? {
                first_name: firstName,
                last_name: lastName,
                phone_number: phoneNumber,
                phone_country_iso: phoneCountry.iso,
                phone_country_dial: phoneCountry.dial,
                address_line_1: address1,
                address_line_2: address2,
                postcode,
                country_iso: country.iso,
                country_name: country.name,
                country_dial: country.dial,
                terms_accepted: termsAccepted,
              }
            : {},
        },
      });

      if (res?.authenticated && res?.member) {
        setMemberUser(res.member);
        setCartItems([]);
        setInstantCheckoutItem(null);
        setCheckoutStatus({ loading: false, error: "", success: false, orderCode: "", paymentCode: "" });
        setMemberAuthStatus({
          loading: false,
          error: "",
          success: "",
          debugLink: "",
          mode: requestedMode,
        });
        setMemberAuthOpen(false);
        setMemberEntryOpen(false);
        return;
      }

      if (!isSignUp) {
        setMemberAuthStatus({
          loading: false,
          error: resolveCopy(t, "auth.signinUnexpected", "Unable to open a valid session. Please retry sign in."),
          success: "",
          debugLink: "",
          mode: requestedMode,
        });
        return;
      }

      setMemberAuthStatus({
        loading: false,
        error: "",
        success: resolveCopy(t, "auth.signupSent", "Account started. Check your email to complete sign up."),
        debugLink: res?.debug?.magic_link || "",
        mode: requestedMode,
      });
    } catch (error) {
      const apiCode = parseApiErrorCode(error);
      const mapped = resolveMemberAuthErrorMessage(apiCode, t);
      setMemberAuthStatus({
        loading: false,
        error: mapped || error?.message || t("auth.verifyFailed"),
        success: "",
        debugLink: "",
        mode: requestedMode,
      });
    }
  };

  const handleMemberLogout = async () => {
    const csrf = readCookie("member_csrf");
    try {
      await logoutMember({ csrf });
    } catch {
      // ignore and still clear local state
    }
    setMemberUser(null);
    setMemberHistory([]);
    setCartItems([]);
    setFavoriteMap({});
    setInstantCheckoutItem(null);
    setCheckoutStatus({ loading: false, error: "", success: false, orderCode: "", paymentCode: "" });
    if (activePage === "account" || activePage === "profile") setActivePage("home");
  };

  const handleProfileChange = (field, value) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    if (!plugReady || !memberUser) {
      setProfileStatus({
        loading: false,
        error: resolveCopy(t, "auth.sessionExpired", "Session expired. Sign in again."),
        success: "",
      });
      return;
    }

    const csrf = readCookie("member_csrf");
    setProfileStatus({ loading: true, error: "", success: "" });
    try {
      const result = await updateMemberProfile({
        csrf,
        payload: {
          display_name: String(profileForm.display_name || "").trim() || null,
          title: String(profileForm.title || "").trim() || null,
          first_name: String(profileForm.first_name || "").trim() || null,
          last_name: String(profileForm.last_name || "").trim() || null,
          phone: String(profileForm.phone || "").trim() || null,
          locale: String(profileForm.locale || "").trim() || null,
          timezone: String(profileForm.timezone || "").trim() || null,
          avatar_url: String(profileForm.avatar_url || "").trim() || null,
          preferences: profileForm.preferences && typeof profileForm.preferences === "object" ? profileForm.preferences : {},
        },
      });
      if (result?.member) {
        setMemberUser(result.member);
      }
      setProfileStatus({
        loading: false,
        error: "",
        success: resolveCopy(t, "profile.saved", "Profile updated."),
      });
    } catch (error) {
      setProfileStatus({
        loading: false,
        error: error?.message || resolveCopy(t, "profile.saveFailed", "Unable to save profile."),
        success: "",
      });
    }
  };

  const openMemberEntry = () => {
    setMemberAuthOpen(false);
    setMemberAuthStatus({ loading: false, error: "", success: "", debugLink: "", mode: "" });
    setMemberEntryOpen(true);
  };

  const openMemberAuth = (mode = "signin") => {
    const nextMode = mode === "signup" ? "signup" : "signin";
    const defaultCountryIso = DEFAULT_COUNTRY_ISO;
    setMemberEntryOpen(false);
    setMemberAuthForm(() => ({
      mode: nextMode,
      credential: "",
      password: "",
      confirmPassword: "",
      email: "",
      username: "",
      firstName: "",
      lastName: "",
      phoneCountry: defaultCountryIso,
      phoneNumber: "",
      address1: "",
      address2: "",
      postcode: "",
      country: defaultCountryIso,
      termsAccepted: false,
    }));
    setMemberAuthStatus({ loading: false, error: "", success: "", debugLink: "", mode: nextMode });
    setMemberAuthOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    setFavoriteMap(loadStoredFavorites(favoritesStorageKey));
  }, [favoritesStorageKey]);

  useEffect(() => {
    if (!favoritesStorageKey || typeof window === "undefined") return;
    const favoriteCodes = Object.keys(favoriteMap).filter(Boolean);
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteCodes));
  }, [favoriteMap, favoritesStorageKey]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [cartItems]
  );
  const checkoutItems = useMemo(
    () => (instantCheckoutItem ? [instantCheckoutItem] : cartItems),
    [instantCheckoutItem, cartItems]
  );
  const checkoutPaymentMethods = useMemo(() => {
    const methods = checkoutConfig?.payment?.methods || [];
    return methods.filter((item) => item?.visible !== false && normalizePaymentMethodCode(item?.code));
  }, [checkoutConfig]);

  const addToCart = (item, quantity = 1) => {
    if (!item?.code) return;
    const normalizedQty = Math.max(Number(quantity) || 1, 1);
    const incoming = toCartItem(item, normalizedQty, priceContext);
    setCartItems((prev) => {
      const index = prev.findIndex((entry) => entry.code === incoming.code);
      if (index === -1) return [...prev, incoming];
      const next = [...prev];
      next[index] = {
        ...next[index],
        quantity: next[index].quantity + normalizedQty,
        unitAmount: incoming.unitAmount ?? next[index].unitAmount,
        currency: incoming.currency || next[index].currency,
        priceLabel: incoming.priceLabel || next[index].priceLabel,
        image: incoming.image || next[index].image,
      };
      return next;
    });
    setCheckoutStatus({ loading: false, error: "", success: false, orderCode: "", paymentCode: "" });
  };

  const isFavorite = useCallback(
    (item) => {
      const key = resolveFavoriteKey(item);
      if (!key) return false;
      return Boolean(favoriteMap[key]);
    },
    [favoriteMap]
  );

  const toggleFavorite = useCallback(
    (item) => {
      const key = resolveFavoriteKey(item);
      if (!key) return;
      if (!memberUser) {
        openMemberEntry();
        return;
      }
      setFavoriteMap((prev) => {
        if (prev[key]) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return { ...prev, [key]: true };
      });
    },
    [memberUser, openMemberEntry]
  );

  const checkoutItem = (item) => {
    if (!item?.code) return;
    setInstantCheckoutItem(toCartItem(item, 1, priceContext));
    setCartOpen(true);
    setCheckoutStatus({ loading: false, error: "", success: false, orderCode: "", paymentCode: "" });
  };

  const handleCartQtyChange = (code, nextQty) => {
    const quantity = Math.max(Number(nextQty) || 1, 1);
    if (instantCheckoutItem?.code === code) {
      setInstantCheckoutItem((prev) => (prev ? { ...prev, quantity } : prev));
      return;
    }
    setCartItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, quantity } : item))
    );
  };

  const handleCartRemove = (code) => {
    if (instantCheckoutItem?.code === code) {
      setInstantCheckoutItem(null);
      setCartOpen(false);
      return;
    }
    setCartItems((prev) => prev.filter((item) => item.code !== code));
  };

  const handleCartClear = () => {
    if (instantCheckoutItem) {
      setInstantCheckoutItem(null);
      return;
    }
    setCartItems([]);
  };

  const handleCheckoutFormChange = (field, value) => {
    setCheckoutForm((prev) => {
      let normalizedValue = value;
      if (field === "phone") normalizedValue = sanitizePhoneWithOptionalPlus(value);

      const next = { ...prev, [field]: normalizedValue };
      if (field === "billing_same_as_delivery") {
        const enabled = Boolean(value);
        next.billing_same_as_delivery = enabled;
        if (enabled) {
          next.billing_country = next.delivery_country;
          next.billing_address1 = next.delivery_address1;
          next.billing_address2 = next.delivery_address2;
          next.billing_city = next.delivery_city;
          next.billing_region = next.delivery_region;
          next.billing_postcode = next.delivery_postcode;
        }
      }
      if (next.billing_same_as_delivery) {
        if (field === "delivery_country") next.billing_country = normalizedValue;
        if (field === "delivery_address1") next.billing_address1 = normalizedValue;
        if (field === "delivery_address2") next.billing_address2 = normalizedValue;
        if (field === "delivery_city") next.billing_city = normalizedValue;
        if (field === "delivery_region") next.billing_region = normalizedValue;
        if (field === "delivery_postcode") next.billing_postcode = normalizedValue;
      }
      if (field === "payment_method") {
        next.payment_method = normalizePaymentMethodCode(value);
      }
      return next;
    });
  };

  const handleCheckoutPaymentSelect = (methodCode, providerCode) => {
    setCheckoutForm((prev) => ({
      ...prev,
      payment_method: normalizePaymentMethodCode(methodCode),
      payment_provider: String(providerCode || "").trim().toLowerCase(),
    }));
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();
    if (!plugReady) {
      setCheckoutStatus({
        loading: false,
        error: t("errors.checkoutRequiresConnection"),
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (!checkoutItems.length) {
      setCheckoutStatus({
        loading: false,
        error: t("errors.cartEmpty"),
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }

    const currencies = Array.from(
      new Set(checkoutItems.map((item) => item.currency).filter(Boolean))
    );
    if (currencies.length > 1) {
      setCheckoutStatus({
        loading: false,
        error: t("cart.mixedCurrency"),
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    const selectedMethod = normalizePaymentMethodCode(checkoutForm.payment_method);
    const selectedProvider = String(checkoutForm.payment_provider || "").trim().toLowerCase();
    const selectedPaymentOption = selectedProvider
      ? checkoutPaymentMethods.find((item) =>
          normalizePaymentMethodCode(item.code) === selectedMethod &&
          String(item.provider_code || "").trim().toLowerCase() === selectedProvider
        )
      : null;
    if (
      !selectedMethod ||
      !selectedPaymentOption ||
      selectedPaymentOption.enabled === false ||
      selectedPaymentOption.available === false
    ) {
      setCheckoutStatus({
        loading: false,
        error: t("errors.paymentMethodUnavailable"),
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (!String(checkoutForm.name || "").trim() || !String(checkoutForm.email || "").trim()) {
      setCheckoutStatus({
        loading: false,
        error: "Name and email are required for checkout.",
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (String(checkoutForm.phone || "").trim() && !isValidPhone(checkoutForm.phone)) {
      setCheckoutStatus({
        loading: false,
        error: "Phone number format is invalid.",
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (!String(checkoutForm.delivery_address1 || "").trim() || !String(checkoutForm.delivery_city || "").trim()) {
      setCheckoutStatus({
        loading: false,
        error: "Delivery address line 1 and city are required.",
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (!String(checkoutForm.delivery_postcode || "").trim()) {
      setCheckoutStatus({
        loading: false,
        error: "Delivery postcode is required.",
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (!checkoutForm.billing_same_as_delivery) {
      if (!String(checkoutForm.billing_address1 || "").trim() || !String(checkoutForm.billing_city || "").trim()) {
        setCheckoutStatus({
          loading: false,
          error: "Billing address line 1 and city are required.",
          success: false,
          orderCode: "",
          paymentCode: "",
        });
        return;
      }
      if (!String(checkoutForm.billing_postcode || "").trim()) {
        setCheckoutStatus({
          loading: false,
          error: "Billing postcode is required.",
          success: false,
          orderCode: "",
          paymentCode: "",
        });
        return;
      }
    }
    const usesPaypal = selectedMethod === "paypal" ||
      String(selectedPaymentOption.provider_code || "").trim().toLowerCase() === "paypal";
    const providerCheckoutWindow = usesPaypal ? openPaypalCheckoutTab() : null;
    if (usesPaypal && !providerCheckoutWindow) {
      setCheckoutStatus({
        loading: false,
        error: "Allow pop-ups for this site, then try PayPal checkout again.",
        success: false,
        orderCode: "",
        paymentCode: "",
      });
      return;
    }
    if (providerCheckoutWindow) paypalCheckoutWindowRef.current = providerCheckoutWindow;

    setPaymentLifecycleView((previous) => ({ ...previous, open: false }));
    setCheckoutStatus({ loading: true, error: "", success: false, orderCode: "", paymentCode: "", awaitingProvider: false, autoPollingStopped: false });
    try {
      const currency = currencies[0] || "USD";
      const deliveryCountry =
        countryOptions.find((item) => item.iso === checkoutForm.delivery_country) ||
        countryOptions[0] ||
        DEFAULT_COUNTRY_OPTIONS[0];
      const billingCountry =
        countryOptions.find((item) => item.iso === checkoutForm.billing_country) ||
        deliveryCountry;
      const deliveryAddress = {
        line1: checkoutForm.delivery_address1,
        line2: checkoutForm.delivery_address2,
        city: checkoutForm.delivery_city,
        region: checkoutForm.delivery_region,
        postcode: checkoutForm.delivery_postcode,
        country_iso: deliveryCountry?.iso || "",
        country_name: deliveryCountry?.name || "",
      };
      const billingAddress = checkoutForm.billing_same_as_delivery
        ? { ...deliveryAddress }
        : {
            line1: checkoutForm.billing_address1,
            line2: checkoutForm.billing_address2,
            city: checkoutForm.billing_city,
            region: checkoutForm.billing_region,
            postcode: checkoutForm.billing_postcode,
            country_iso: billingCountry?.iso || "",
            country_name: billingCountry?.name || "",
          };
      const payload = {
        channel: "WEB",
        currency,
        external_ref: `${externalRefPrefix}-${Date.now()}`,
        buyer: {
          agent_type: "person",
          name: checkoutForm.name,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
        },
        shipping_address: deliveryAddress,
        billing_address: billingAddress,
        line_items: checkoutItems.map((item) => ({
          material_code: item.code,
          quantity: item.quantity,
        })),
        metadata: {
          source: clientSource,
          locale: language,
          cart_count: checkoutItems.length,
          checkout: {
            payment_method: selectedMethod,
            payment_provider: selectedPaymentOption.provider_code || null,
            billing_same_as_delivery: checkoutForm.billing_same_as_delivery,
          },
        },
      };
      const result = await createOrder({ payload });
      const orderCode =
        String(
          result?.order?.code ||
          result?.order?.order_code ||
          result?.order?.orderCode ||
          result?.order?.attrs?.order_code ||
          result?.order?.attrs?.orderCode ||
          result?.response?.order?.code ||
          result?.response?.order?.order_code ||
          result?.response?.order?.orderCode ||
          result?.response?.order?.attrs?.order_code ||
          result?.response?.order?.attrs?.orderCode ||
          result?.response?.order_code ||
          result?.response?.orderCode ||
          result?.order_code ||
          result?.orderCode ||
          result?.code ||
          ""
        ).trim();
      const orderId =
        String(
          result?.order?.id ||
          result?.response?.order?.id ||
          result?.order_id ||
          result?.orderId ||
          ""
        ).trim();
      if (!orderCode && !orderId) {
        throw new Error("Order reference not returned by API.");
      }
      const paymentMetadata = {
        source: clientSource,
        locale: language,
        checkout: {
          delivery_address: deliveryAddress,
          billing_address: billingAddress,
          billing_same_as_delivery: checkoutForm.billing_same_as_delivery,
        },
      };
      const paymentResult = await createCheckoutSession({
        payload: {
          order_code: orderCode || undefined,
          order_id: orderId || undefined,
          method: selectedMethod,
          provider_code: selectedPaymentOption.provider_code || undefined,
          metadata: paymentMetadata,
        },
      });
      const payment = paymentResult?.payment || {};
      let finalPayment = payment;
      if (payment?.client_action === "redirect") {
        const redirectUrl = trustedPaypalRedirectUrl(payment?.redirect_url);
        if (!redirectUrl) throw new Error("PayPal did not return a safe approval URL.");
        if (providerCheckoutWindow && !providerCheckoutWindow.closed) {
          providerCheckoutWindow.location.replace(redirectUrl);
          setCheckoutStatus({
            loading: false,
            error: "",
            notice: "PayPal checkout opened in a new tab. Complete payment there.",
            awaitingProvider: true,
            autoPollingStopped: false,
            success: false,
            orderCode,
            paymentCode: payment?.code || "",
          });
        } else {
          window.location.assign(redirectUrl);
        }
        return;
      }
      if (payment?.client_action === "manual_test_confirm") {
        const confirmResult = await confirmCheckoutSession({
          payload: {
            payment_id: payment.id,
            payment_code: payment.code,
            metadata: { source: clientSource, locale: language }
          },
        });
        finalPayment = confirmResult?.payment || payment;
      }
      const confirmedOrderCode =
        String(
          paymentResult?.order_code ||
          paymentResult?.orderCode ||
          finalPayment?.order_code ||
          finalPayment?.attrs?.order_code ||
          finalPayment?.attrs?.orderCode ||
          orderCode ||
          orderId ||
          ""
        ).trim();
      setCheckoutStatus({
        loading: false,
        error: "",
        success: true,
        orderCode: confirmedOrderCode,
        paymentCode: finalPayment?.code || "",
      });
      if (instantCheckoutItem) {
        setInstantCheckoutItem(null);
      } else {
        setCartItems([]);
      }
      setCartOpen(false);
      const defaultCountry = countryOptions[0]?.iso || DEFAULT_COUNTRY_ISO;
      const defaultPaymentOption = checkoutPaymentMethods.find(
        (item) => item.enabled !== false && item.available !== false
      );
      setCheckoutForm({
        ...buildCheckoutFormDefaults(defaultCountry),
        payment_method: defaultPaymentOption?.code || "",
        payment_provider: defaultPaymentOption?.provider_code || "",
      });
    } catch (err) {
      if (providerCheckoutWindow && !providerCheckoutWindow.closed) providerCheckoutWindow.close();
      if (paypalCheckoutWindowRef.current === providerCheckoutWindow) paypalCheckoutWindowRef.current = null;
      setCheckoutStatus({
        loading: false,
        error: friendlyCheckoutError(err, t("errors.paymentFailed")),
        success: false,
        orderCode: "",
        paymentCode: "",
      });
    }
  };

  const openProduct = (item) => {
    if (!item?.code) return;
    setSelectedProductCode(item.code);
    setActivePage("product");
    setReviewForm({
      rating: 5,
      title: "",
      comment: "",
      name: "",
      email: "",
    });
    setReviewSubmitState({ loading: false, error: "", success: false, pending: false });
  };

  const handleReviewChange = (field, value) => {
    setReviewForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    if (!plugReady || !selectedProductCode) {
      setReviewSubmitState({
        loading: false,
        error: t("errors.reviewFailed"),
        success: false,
        pending: false,
      });
      return;
    }
    if (!reviewForm.comment.trim() || !Number(reviewForm.rating)) {
      setReviewSubmitState({
        loading: false,
        error: t("errors.reviewMissing"),
        success: false,
        pending: false,
      });
      return;
    }

    setReviewSubmitState({ loading: true, error: "", success: false, pending: false });
    try {
      const result = await createProductReview({
        payload: {
          product_code: selectedProductCode,
          rating: Number(reviewForm.rating),
          title: reviewForm.title,
          comment: reviewForm.comment,
          reviewer: {
            name: reviewForm.name,
            email: reviewForm.email,
          },
          source: clientSource,
        },
      });
      const pending = result?.moderation?.status === "pending_review";
      setReviewSubmitState({ loading: false, error: "", success: true, pending });
      setReviewForm((prev) => ({ ...prev, title: "", comment: "" }));
      await fetchProductReviewData(selectedProductCode);
      await fetchProductDetail(selectedProductCode);
    } catch (err) {
      setReviewSubmitState({
        loading: false,
        error: err?.message || t("errors.reviewFailed"),
        success: false,
        pending: false,
      });
    }
  };

  const handleLearningIntakeChange = useCallback((field, value) => {
    setLearningIntakeForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleLearningIntakeSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const name = String(learningIntakeForm.name || "").trim();
      const email = String(learningIntakeForm.email || "").trim();
      if (!name || !email) {
        setLearningIntakeStatus({
          loading: false,
          error: "Name and email are required.",
          success: "",
        });
        return;
      }
      setLearningIntakeStatus({
        loading: false,
        error: "",
        success: "Intake submitted. We will email your cohort details shortly.",
      });
      setLearningIntakeForm({
        name: "",
        email: "",
        phone: "",
        track: LEARNING_TRACKS[0]?.title || "",
        goal: "",
      });
    },
    [learningIntakeForm]
  );

  const handleCreateBlogPost = useCallback(
    async (payload) => {
      if (!plugReady) {
        throw new Error("Gateway connection is required to publish blog posts.");
      }
      const csrf = readCookie("member_csrf");
      const response = await createBlogPost({
        csrf,
        payload,
      });
      const created = normalizePublicBlogPost(response?.item || null, 0);
      if (created) {
        setBlogPosts((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      }
      return created;
    },
    [plugReady]
  );

  const handleDeleteBlogPost = useCallback(
    async (postId) => {
      if (!plugReady) {
        throw new Error("Gateway connection is required to manage blog posts.");
      }
      const id = String(postId || "").trim();
      if (!id) throw new Error("Post ID required.");
      const csrf = readCookie("member_csrf");
      await deleteBlogPost({
        csrf,
        postId: id,
      });
      setBlogPosts((prev) =>
        prev.filter(
          (item) =>
            String(item?.id || "") !== id &&
            String(item?.code || "") !== id
        )
      );
      return true;
    },
    [plugReady]
  );

  const heroSlides = useMemo(() => {
    const fallback = [
      {
        id: "hero-default-1",
        image: heroImage,
        overlay: "left",
        eyebrow: t("hero.kicker"),
        title: t("hero.title"),
        subtitle: t("hero.subtitle"),
        ctaLabel: t("hero.shop"),
        ctaUrl: "/patterns",
        cta: {
          action: "navigate_internal",
          target: "/patterns",
          new_tab: false,
        },
      },
      {
        id: "hero-default-2",
        image: dropMain,
        overlay: "left",
        eyebrow: t("drop.kicker"),
        title: t("drop.title"),
        subtitle: t("drop.subtitle"),
        ctaLabel: t("hero.shop"),
        ctaUrl: "/patterns",
        cta: {
          action: "navigate_internal",
          target: "/patterns",
          new_tab: false,
        },
      },
      {
        id: "hero-default-3",
        image: pattern2,
        overlay: "center",
        eyebrow: t("community.kicker"),
        title: t("community.title"),
        subtitle: t("hero.subtitle"),
        ctaLabel: t("hero.shop"),
        ctaUrl: "/patterns",
        cta: {
          action: "navigate_internal",
          target: "/patterns",
          new_tab: false,
        },
      },
    ];

    const maxSlides = Math.max(1, Number(EIP_CONFIG.heroMaxSlides) || 5);
    const configuredSlides = Array.isArray(heroContent?.slides) ? heroContent.slides : [];
    const heroTranslation =
      heroContent?.translation && typeof heroContent.translation === "object"
        ? heroContent.translation
        : null;
    const activeConfiguredSlides = configuredSlides
      .map((slide, index) => {
        const imageRaw =
          slide?.image ||
          slide?.image_url ||
          slide?.media?.url ||
          "";
        const image = imageRaw ? resolveAssetUrl(imageRaw) : "";
        if (!image) return null;
        const ctaTarget = String(
          slide?.cta?.target ||
            slide?.cta_target ||
            slide?.cta_url ||
            slide?.ctaUrl ||
            "/patterns"
        ).trim();
        const ctaActionRaw = String(
          slide?.cta?.action ||
            slide?.cta_action ||
            ""
        ).trim().toLowerCase();
        const ctaAction = ["navigate_internal", "navigate_external", "scroll_to"].includes(ctaActionRaw)
          ? ctaActionRaw
          : /^https?:\/\//i.test(ctaTarget)
            ? "navigate_external"
            : ctaTarget.startsWith("#")
              ? "scroll_to"
              : "navigate_internal";
        const ctaNewTabRaw =
          slide?.cta?.new_tab ??
          slide?.cta_new_tab ??
          slide?.cta?.newTab ??
          slide?.cta_newTab;
        const ctaNewTab = ctaAction === "navigate_external"
          ? (ctaNewTabRaw === true || String(ctaNewTabRaw || "").toLowerCase() === "true")
          : false;
        const eyebrow = resolveTranslatedPath(heroTranslation, `slides.${index}.eyebrow`, language);
        const title = resolveTranslatedPath(heroTranslation, `slides.${index}.title`, language);
        const subtitle = resolveTranslatedPath(heroTranslation, `slides.${index}.subtitle`, language) ||
          resolveTranslatedPath(heroTranslation, `slides.${index}.body`, language);
        const ctaLabel = resolveTranslatedPath(heroTranslation, `slides.${index}.cta_label`, language);
        return {
          id: slide?.id || `hero-slot-${index + 1}`,
          image,
          overlay: slide?.overlay === "center" ? "center" : "left",
          fit: slide?.fit === "contain" ? "contain" : "cover",
          focus_x: Number.isFinite(Number(slide?.focus_x)) ? Number(slide.focus_x) : 50,
          focus_y: Number.isFinite(Number(slide?.focus_y)) ? Number(slide.focus_y) : 50,
          overlay_strength: Number.isFinite(Number(slide?.overlay_strength))
            ? Number(slide.overlay_strength)
            : 78,
          eyebrow: String(eyebrow || slide?.eyebrow || "").trim() || t("hero.kicker"),
          title: String(title || slide?.title || "").trim() || t("hero.title"),
          subtitle: String(subtitle || slide?.subtitle || "").trim() || t("hero.subtitle"),
          ctaLabel: String(ctaLabel || slide?.cta_label || slide?.ctaLabel || "").trim() || t("hero.shop"),
          ctaUrl: ctaTarget || "/patterns",
          cta: {
            action: ctaAction,
            target: ctaTarget || "/patterns",
            new_tab: ctaNewTab,
          },
        };
      })
      .filter(Boolean);
    if (activeConfiguredSlides.length) {
      return activeConfiguredSlides.slice(0, maxSlides);
    }

    return fallback.slice(0, maxSlides);
  }, [heroContent, language, t]);

  const featuredCards = useMemo(() => {
    const configured = getHomeProductSlotItem(contentBySlot, "featured");
    const configuredProducts = Array.isArray(configured?.products) ? configured.products : [];
    if (!configuredProducts.length && !homeItems.length) return [];
    const sourceItems = configuredProducts.length ? configuredProducts : homeItems;
    const dropTagged = sourceItems.filter((item) => hasTag(item, EIP_CONFIG.dropTag));
    const featuredTagged = sourceItems.filter((item) => hasTag(item, EIP_CONFIG.featuredTag));
    const pool = [...dropTagged, ...featuredTagged];
    const source = configuredProducts.length ? configuredProducts : pool.length ? pool : sourceItems.slice(0, 1);
    const seen = new Set();
    const maxDropCards = Math.max(1, Number(EIP_CONFIG.dropMaxCards) || 48);
    return source
      .filter((item) => {
        const key = item?.id || item?.code;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, maxDropCards)
      .map((item) => buildCard(item, language, priceContext));
  }, [contentBySlot, homeItems, language, priceContext]);

  const worthCards = useMemo(() => {
    const configured = getHomeProductSlotItem(contentBySlot, "worth");
    const configuredProducts = Array.isArray(configured?.products) ? configured.products : [];
    if (!configuredProducts.length && !homeItems.length) return [];
    const sourceItems = configuredProducts.length ? configuredProducts : homeItems;
    const tagged = sourceItems.filter((item) => hasTag(item, EIP_CONFIG.worthTag));
    const source = configuredProducts.length ? configuredProducts : tagged.length ? tagged : sourceItems;
    const maxWorthCards = Math.max(1, Number(EIP_CONFIG.worthMaxCards) || 24);
    return source.slice(0, maxWorthCards).map((item) => buildCard(item, language, priceContext));
  }, [contentBySlot, homeItems, language, priceContext]);

  const catalogCards = useMemo(
    () => catalogItems.map((item) => buildCard(item, language, priceContext)),
    [catalogItems, language, priceContext]
  );

  const filteredCatalog = useMemo(() => {
    let items = [...catalogCards];
    if (filters.category !== "all") {
      items = items.filter((card) => {
        const category = getCategory(card.raw).toLowerCase();
        return category.includes(filters.category);
      });
    }
    if (filters.difficulty !== "all") {
      items = items.filter((card) => {
        const difficulty = getDifficulty(card.raw).toLowerCase();
        return difficulty.includes(filters.difficulty);
      });
    }
    if (filters.sortBy === "price") {
      items.sort((a, b) => {
        const priceA = getPriceValue(a.raw, priceContext);
        const priceB = getPriceValue(b.raw, priceContext);
        if (priceA === null) return 1;
        if (priceB === null) return -1;
        return priceA - priceB;
      });
    }
    return items;
  }, [catalogCards, filters, priceContext]);

  const canNext = catalogItems.length === pageSize;
  const pages = useMemo(() => {
    const start = Math.max(1, catalogPage - 1);
    const end = canNext ? catalogPage + 1 : catalogPage;
    const set = new Set([1, ...Array.from({ length: end - start + 1 }, (_, i) => start + i)]);
    return Array.from(set).slice(0, 4);
  }, [catalogPage, canNext]);

  const showingText = useMemo(() => {
    if (!catalogItems.length) return t("patterns.showing");
    const start = (catalogPage - 1) * pageSize + 1;
    const end = start + catalogItems.length - 1;
    return formatCopy(t("patterns.showingRange"), { start, end });
  }, [catalogItems.length, catalogPage, pageSize, t]);

  const productDetailCard = useMemo(() => {
    if (!productDetail) return null;
    return buildCard(productDetail, language, priceContext);
  }, [productDetail, language, priceContext]);

  const handleNavigate = useCallback(
    (nextPage) => {
      const allowed = new Set(["home", "patterns", "product", "account", "profile", "pages", "sizes", "blog", "line", "learning", "collab"]);
      const target = allowed.has(nextPage) ? nextPage : "home";
      if ((target === "account" || target === "profile") && !memberUser) {
        openMemberEntry();
        return;
      }
      if (target === "patterns") {
        openPatternsPage();
        return;
      }
      setActivePage(target);
    },
    [memberUser, openMemberEntry, openPatternsPage]
  );

  return (
    <div className="samara-root">
      <Header
        activePage={activePage}
        onNavigate={handleNavigate}
        marketplaceValue={selectedMarketplaceCode}
        marketplaceOptions={marketplaceOptions}
        onMarketplaceChange={setSelectedMarketplaceCode}
        onOpenCart={() => setCartOpen(true)}
        memberUser={memberUser}
        onOpenLoginPicker={openMemberEntry}
        onOpenAccount={() => setActivePage("account")}
        onOpenProfile={() => setActivePage("profile")}
        onSignOut={handleMemberLogout}
        cartCount={cartCount}
        t={t}
      />
      {activePage === "home" ? (
      <HomePage
          onShop={openPatternsPage}
          onOpenProduct={openProduct}
          onHeroCta={handleHeroCta}
          onLookbook={handleLookbook}
          onSubscribe={openSubscribe}
          t={t}
          heroSlides={heroSlides}
          featuredItems={featuredCards}
          worthItems={worthCards}
          featuredRenderer={getHomeProductSlotItem(contentBySlot, "featured")?.renderer}
          worthRenderer={getHomeProductSlotItem(contentBySlot, "worth")?.renderer}
          loading={homeLoading}
          plugReady={plugReady}
        />
      ) : activePage === "patterns" ? (
        <PatternsPage
          t={t}
          items={plugReady ? filteredCatalog : null}
          useFallback={!plugReady}
          loading={catalogLoading}
          error={catalogError}
          filters={filters}
          onFilterChange={handleFilterChange}
          page={catalogPage}
          pages={pages}
          onPageChange={setCatalogPage}
          canNext={canNext}
          showingText={showingText}
          onView={openProduct}
          onAddToCart={addToCart}
          onCheckout={checkoutItem}
          onToggleFavorite={toggleFavorite}
          isFavorite={isFavorite}
          canOrder={plugReady}
          previewCode={previewCode}
        />
      ) : activePage === "account" ? (
        <AccountPage
          t={t}
          memberUser={memberUser}
          historyItems={memberHistory}
          historyLoading={memberHistoryLoading}
          onOpenLogin={openMemberEntry}
        />
      ) : activePage === "profile" ? (
        <ProfilePage
          t={t}
          memberUser={memberUser}
          form={profileForm}
          onChange={handleProfileChange}
          onSubmit={handleProfileSubmit}
          status={profileStatus}
          onOpenLogin={openMemberEntry}
        />
      ) : activePage === "order-confirmation" ? (
        <OrderConfirmationPage
          confirmation={orderConfirmation}
          onContinueShopping={() => {
            setActivePage("patterns");
            if (typeof window !== "undefined") {
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.delete("order");
              nextUrl.searchParams.set("page", "patterns");
              window.history.replaceState({}, "", nextUrl.toString());
            }
          }}
        />
      ) : activePage === "pages" ? (
        <PagesHubPage
          t={t}
          language={language}
          onNavigate={handleNavigate}
          contentBySlot={contentBySlot}
          contentListsBySlot={contentListsBySlot}
          onContentCta={handleHeroCta}
        />
      ) : activePage === "sizes" ? (
        <SizesGuidePage t={t} language={language} contentBySlot={contentBySlot} onContentCta={handleHeroCta} />
      ) : activePage === "blog" ? (
        <BlogFeedPage
          t={t}
          language={language}
          blogPosts={blogPosts}
          loading={blogLoading}
          error={blogError}
          onCreatePost={handleCreateBlogPost}
          onDeletePost={handleDeleteBlogPost}
          memberUser={memberUser}
          onOpenLogin={openMemberEntry}
          onContentCta={handleHeroCta}
          contentBySlot={contentBySlot}
        />
      ) : activePage === "line" ? (
        <LineStudioPage t={t} language={language} contentBySlot={contentBySlot} onContentCta={handleHeroCta} />
      ) : activePage === "learning" ? (
        <LearningPage
          t={t}
          language={language}
          onOpenIntake={() => setLearningIntakeOpen(true)}
          contentBySlot={contentBySlot}
          onContentCta={handleHeroCta}
        />
      ) : activePage === "collab" ? (
        <CollabShopPage t={t} language={language} contentBySlot={contentBySlot} onContentCta={handleHeroCta} />
      ) : (
        <ProductDetailPage
          t={t}
          language={language}
          item={productDetailCard}
          loading={productDetailLoading}
          error={productDetailError}
          onBack={() => setActivePage("patterns")}
          canOrder={plugReady}
          onAddToCart={addToCart}
          onCheckout={checkoutItem}
          reviews={productReviews}
          summary={productReviewSummary}
          reviewsLoading={productReviewsLoading}
          reviewsError={productReviewsError}
          reviewForm={reviewForm}
          onReviewChange={handleReviewChange}
          onReviewSubmit={handleReviewSubmit}
          reviewSubmitState={reviewSubmitState}
        />
      )}
      <SubscribeModal
        open={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        form={subscribeForm}
        onChange={handleSubscribeChange}
        onSubmit={handleSubscribeSubmit}
        status={subscribeStatus}
        t={t}
      />
      <MemberEntryModal
        open={memberEntryOpen}
        onClose={() => setMemberEntryOpen(false)}
        onSignIn={() => openMemberAuth("signin")}
        onSignUp={() => openMemberAuth("signup")}
        t={t}
      />
      <MemberAuthModal
        open={memberAuthOpen}
        onClose={() => setMemberAuthOpen(false)}
        form={memberAuthForm}
        onChange={handleMemberAuthChange}
        onSubmit={handleMemberAuthSubmit}
        status={memberAuthStatus}
        termsText={tradeTermsText}
        termsItems={tradeTermsItems}
        termsLoading={tradeTermsLoading}
        countryOptions={countryOptions}
        t={t}
      />
      <CartModal
        open={cartOpen}
        onClose={() => {
          setCartOpen(false);
          setInstantCheckoutItem(null);
        }}
        items={checkoutItems}
        onChangeQty={handleCartQtyChange}
        onRemove={handleCartRemove}
        onClear={handleCartClear}
        form={checkoutForm}
        onFormChange={handleCheckoutFormChange}
        onPaymentSelect={handleCheckoutPaymentSelect}
        onCheckPaymentStatus={() => checkPaymentLifecycle(checkoutStatus.paymentCode)}
        onSubmit={handleCheckoutSubmit}
        status={checkoutStatus}
        countryOptions={countryOptions}
        paymentMethods={checkoutPaymentMethods}
        t={t}
      />
      <PaymentLifecycleModal
        state={paymentLifecycleView}
        onCheck={() => checkPaymentLifecycle(paymentLifecycleView.paymentCode, {
          openPending: true,
          popupReturn: typeof window !== "undefined" && window.name === PAYPAL_CHECKOUT_WINDOW_NAME && Boolean(window.opener),
        })}
        onReturnToCart={() => {
          setPaymentLifecycleView((previous) => ({ ...previous, open: false }));
          setCartOpen(true);
        }}
        onClose={() => setPaymentLifecycleView((previous) => ({ ...previous, open: false }))}
      />
      <LearningIntakeModal
        open={learningIntakeOpen}
        onClose={() => setLearningIntakeOpen(false)}
        form={learningIntakeForm}
        onChange={handleLearningIntakeChange}
        onSubmit={handleLearningIntakeSubmit}
        status={learningIntakeStatus}
        t={t}
      />
      <footer className="samara-footer">
        <p>Samara</p>
        <div>
          <span>{t("footer.concept")}</span>
          <span>{t("footer.rizes")}</span>
          <span>{t("footer.blog")}</span>
          <span>{t("footer.faqs")}</span>
          <span>{t("footer.learning")}</span>
        </div>
        <div className="gateway-status">
          {gatewayStatus.loading ? (
            <span className="gateway-pill">{t("gateway.connecting")}</span>
          ) : gatewayStatus.ok ? (
            <span className="gateway-pill ok">
              {gatewayStatus.manifestOk
                ? t("gateway.connected")
                : t("gateway.manifestPending")}
            </span>
          ) : (
            <span className="gateway-pill error">{t("gateway.offline")}</span>
          )}
        </div>
      </footer>
    </div>
  );
}
