// src/config/navigation.js
import React from "react";

/* ============================================================
   UNIVERSAL, PRODUCTION-READY BUILDER ENGINE (no JSX)
   ============================================================ */

const truthy = (x) => !!x;
const toArray = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const pickKey = (d, i) => d?.key ?? d?.id ?? d?.attrs?.href ?? i;

const mergeObjects = (maybeArray) => {
  const arr = toArray(maybeArray);
  return arr.reduce((acc, obj) => {
    if (obj && typeof obj === "object") Object.assign(acc, obj);
    return acc;
  }, {});
};

const toClassName = (input) => {
  if (!input) return "";
  if (typeof input === "string") return input.trim();
  if (Array.isArray(input)) return input.map(toClassName).filter(truthy).join(" ").trim();
  if (typeof input === "object") {
    return Object.entries(input)
      .filter(([, v]) => !!v)
      .map(([k]) => k)
      .join(" ")
      .trim();
  }
  return String(input);
};

function normalizeDescriptor(desc) {
  const out = { ...desc };

  if ("if" in out) {
    out.__if = out.if;
    delete out.if;
  }

  out.className = toClassName(out.className);
  out.style = mergeObjects(out.style);
  out.attrs = mergeObjects(out.attrs);
  out.bind = mergeObjects(out.bind);
  out.events = mergeObjects(out.events);

  if (out.dataset && typeof out.dataset === "object") {
    out.attrs = out.attrs || {};
    for (const [k, v] of Object.entries(out.dataset)) {
      out.attrs[`data-${k}`] = v;
    }
  }

  if (typeof out.html === "string" && !out.dangerouslySetInnerHTML) {
    out.dangerouslySetInnerHTML = { __html: out.html };
    delete out.html;
  }

  if (out.options != null && !Array.isArray(out.options)) out.options = [out.options];
  if (out.children != null && !Array.isArray(out.children)) out.children = [out.children];

  return out;
}

function buildOptions(options) {
  const nodes = [];
  for (const raw of options) {
    if (raw == null) continue;

    if (typeof raw === "object" && Array.isArray(raw.options)) {
      const label = raw.label ?? "";
      nodes.push(
        React.createElement("optgroup", { key: `og-${label}`, label }, ...buildOptions(raw.options))
      );
      continue;
    }

    if (typeof raw === "string" || typeof raw === "number") {
      const val = String(raw);
      nodes.push(React.createElement("option", { key: val, value: val }, val));
    } else {
      const value = raw.value ?? raw.label ?? "";
      const label = raw.label ?? String(value);
      const props = { value, key: String(value) };
      if (raw.disabled) props.disabled = true;
      if (raw.selected) props.selected = true;
      nodes.push(React.createElement("option", props, label));
    }
  }
  return nodes;
}

function buildChildren(children, api) {
  const nodes = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      nodes.push(
        React.createElement(
          React.Fragment,
          { key: Math.random().toString(36).slice(2) },
          ...buildChildren(child, api)
        )
      );
    } else if (child == null) {
      // skip
    } else if (typeof child === "object") {
      nodes.push(buildElement(child, api));
    } else {
      nodes.push(child);
    }
  }
  return nodes;
}

/**
 * Build a single descriptor or an array of descriptors into React nodes.
 * @param {object|array} desc
 * @param {object} api { state, handlers }
 */
export function buildElement(desc, api) {
  if (Array.isArray(desc)) {
    return React.createElement(
      React.Fragment,
      null,
      ...desc.map((d, i) =>
        React.createElement(React.Fragment, { key: pickKey(d, i) }, buildElement(d, api))
      )
    );
  }

  if (desc == null || typeof desc !== "object") {
    return desc == null ? null : React.createElement(React.Fragment, null, desc);
  }

  const d = normalizeDescriptor(desc);

  if (typeof d.__if === "function" && !d.__if(api)) return null;
  if (d.__if === false) return null;

  if (d.type === "fragment") {
    return React.createElement(React.Fragment, null, ...buildChildren(d.children || [], api));
  }

  const {
    type = "div",
    id,
    className,
    attrs = {},
    style = {},
    bind = {},
    events = {},
    options = [],
    children = [],
    dangerouslySetInnerHTML,
  } = d;

  const props = { id, className, style, ...attrs };

  if (api?.state && bind && typeof bind === "object") {
    for (const [propName, stateKey] of Object.entries(bind)) {
      if (propName === "value") props.value = api.state[stateKey];
      else if (propName === "checked") props.checked = !!api.state[stateKey];
      else props[propName] = api.state[stateKey];
    }
  }

  if (api?.handlers && events && typeof events === "object") {
    for (const [evtName, ref] of Object.entries(events)) {
      if (typeof ref === "function") {
        props[evtName] = (e) => ref(e, { desc: d, api });
      } else if (typeof ref === "string" && typeof api.handlers[ref] === "function") {
        props[evtName] = (e) => api.handlers[ref](e, { desc: d, api });
      }
    }
  }

  if (dangerouslySetInnerHTML && typeof dangerouslySetInnerHTML === "object") {
    props.dangerouslySetInnerHTML = dangerouslySetInnerHTML;
    return React.createElement(type, props);
  }

  const kids = [];
  if (type === "select" && Array.isArray(options)) kids.push(...buildOptions(options));
  if (Array.isArray(children) && children.length) kids.push(...buildChildren(children, api));

  return React.createElement(type, props, ...kids);
}

export function buildElements(list, api) {
  if (!Array.isArray(list)) return buildElement(list, api);
  return list.map((d, i) =>
    React.createElement(React.Fragment, { key: pickKey(d, i) }, buildElement(d, api))
  );
}

export function createNavApi({ state = {}, handlers = {} } = {}) {
  return { state, handlers };
}

/* ============================================================
   SHARED DESCRIPTOR OBJECTS (pure config)
   ============================================================ */

import logo from "../assets/samara logo.png";
import searchIcon from "../assets/magnifying-glass-thin.svg";
import cartIcon from "../assets/cart1.svg";
import loginIcon from "../assets/profile.svg";
import settingsIcon from "../assets/settings1.svg";
import globeIcon from "../assets/globe.svg";

/* Slides images referenced by shared slide objects */
import slide1 from "../assets/hero/slide1.jpg";
import slide2 from "../assets/hero/slide2.jpg";
import slide3 from "../assets/hero/slide3.jpg";
// Map physical image files to logical slides.
// You can swap these assignments without touching the slide config.
const heroImage1 = slide1; // used by slide index 0 (dot 1)
const heroImage2 = slide1; // used by slide index 1 (dot 2)
const heroImage3 = slide1; // used by slide index 2 (dot 3);

// If you realise "slide2 file is actually my 3rd design", just do:
// const heroImage2 = slide3;
// const heroImage3 = slide2;


export const BRAND = {
  type: "a",
  id: "brand",
  className: "menu__logo",
  attrs: { href: "/", title: "Samara" },
  children: [
    {
      type: "img",
      className: "menu__logo-img",
      style: [{ height: "4rem" }, { width: "auto" }, { display: "block" }],
      attrs: { src: logo, alt: "Samara" },
    },
  ],
};

export const NAV_ITEMS = [
  { type: "a", id: "nav-patterns", className: "menu__item", attrs: { href: "/patterns/" }, children: ["Patterns"] },
  { type: "a", id: "nav-courses", className: "menu__item", attrs: { href: "/courses/" }, children: ["Courses"] },
  { type: "a", id: "nav-blog", className: "menu__item", attrs: { href: "/blog/" }, children: ["Blog"] },
  { type: "a", id: "nav-reviews", className: "menu__item", attrs: { href: "/reviews/" }, children: ["Reviews"] },
  { type: "a", id: "nav-contacts", className: "menu__item", attrs: { href: "/contacts/" }, children: ["Contacts"] },
  { type: "a", id: "nav-favorites", className: "menu__item", attrs: { href: "/favorites/" }, children: ["❤"] },
  { type: "a", id: "nav-profile", className: "menu__item", attrs: { href: "/profile/" }, children: ["Profile"] },
];

export const NAV_UTILITIES = [
  {
    type: "a",
    id: "util-search",
    className: "menu__util",
    attrs: { href: "/search/", title: "Search" },
    children: [
      { type: "img", className: "menu__icon", attrs: { src: searchIcon, alt: "Search" } },
      { type: "span", className: "menu__label", children: ["Search"] },
    ],
  },
  {
    type: "a",
    id: "util-cart",
    className: "menu__util",
    attrs: { href: "/cart/", title: "Cart" },
    children: [
      { type: "img", className: "menu__icon", attrs: { src: cartIcon, alt: "Cart" } },
      { type: "span", className: "menu__label", children: ["Cart"] },
    ],
  },
  {
    type: "a",
    id: "util-login",
    className: "menu__util",
    attrs: { href: "/login/", title: "Login" },
    children: [
      { type: "img", className: "menu__icon", attrs: { src: loginIcon, alt: "Login" } },
      { type: "span", className: "menu__label", children: ["Login"] },
    ],
  },
  {
    type: "div",
    id: "util-lang",
    className: ["menu__item", "menu__util", "menu__util--language"],
    style: { display: "inline-flex", alignItems: "center", gap: ".3rem" },
    children: [
      {
        type: "img",
        className: "menu__icon",
        style: { height: 18, width: 18 },
        attrs: { src: globeIcon, alt: "Language" },
      },
      {
        type: "select",
        className: "input",
        style: {
          color: "#222",
          backgroundColor: "#fff",
          border: "1px solid #ccc",
          borderRadius: "6px",
          padding: ".25rem .5rem",
          fontSize: ".9rem",
          lineHeight: 1.2,
        },
        attrs: { title: "Language", "aria-label": "Language" },
        bind: { value: "language" },
        events: { onChange: "handleLanguageChange" },
        options: [
          { value: "EN", label: "EN" },
          { value: "FR", label: "FR" },
          { value: "DE", label: "DE" },
        ],
      },
    ],
  },
  {
    type: "a",
    id: "util-settings",
    className: "menu__util",
    attrs: { href: "/settings/", title: "Settings" },
    children: [
      { type: "img", className: "menu__icon", attrs: { src: settingsIcon, alt: "Settings" } },
      { type: "span", className: "menu__label", children: ["settings"] },
    ],
  },
];

export const FOOTER_LINKS = [
  { label: "Privacy Policy", href: "/privacy/" },
  { label: "Terms of Service", href: "/terms/" },
  { label: "Help", href: "/help/" },
  { label: "Contact Us", href: "/contact/" },
];

/* =========================
   Sidebar descriptors
   ========================= */
import { Tag, BookOpen, MessageSquare, Star } from "lucide-react";

export const SIDEBAR_SECTIONS = [
  {
    type: "section",
    className: "sidebar__section",
    children: [
      { type: "h3", className: "sidebar__title", children: ["Shop"] },
      {
        type: "nav",
        className: "sidebar__list",
        children: [
          {
            type: "a",
            className: "sidebar__link",
            attrs: { href: "/patterns/" },
            children: [
              { type: Tag, className: "sidebar__icon", attrs: { size: 18 } },
              { type: "span", className: "sidebar__label", children: ["Patterns"] },
            ],
          },
          {
            type: "a",
            className: "sidebar__link",
            attrs: { href: "/courses/" },
            children: [
              { type: BookOpen, className: "sidebar__icon", attrs: { size: 18 } },
              { type: "span", className: "sidebar__label", children: ["Courses"] },
            ],
          },
          {
            type: "a",
            className: "sidebar__link",
            attrs: { href: "/blog/" },
            children: [
              { type: MessageSquare, className: "sidebar__icon", attrs: { size: 18 } },
              { type: "span", className: "sidebar__label", children: ["Blog"] },
            ],
          },
          {
            type: "a",
            className: "sidebar__link",
            attrs: { href: "/reviews/" },
            children: [
              { type: Star, className: "sidebar__icon", attrs: { size: 18 } },
              { type: "span", className: "sidebar__label", children: ["Reviews"] },
            ],
          },
        ],
      },
    ],
  },
  // (Filters + Language etc.)
];

/* ============================================================
   SHARED CAROUSEL SLIDES (pure objects; no functions)
   ============================================================ */
/* ============================================================
   SHARED CAROUSEL SLIDES (pure objects; no functions)
   ============================================================ */
export const CAROUSEL_SLIDES = [
  // SLIDE 1
  {
    type: "section",
    id: "hero-slide-1",
    className: ["hero", "hero--cover", "hero--align-center"],
    style: {
      backgroundImage: `url(${slide1})`,
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#000",
    },
    attrs: {
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": "1 of 3",
    },
    children: [
      {
        type: "div",
        className: "hero__overlay",
        style: {
          background:
            "linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.35))",
        },
      },
      {
        type: "div",
        className: ["hero__content", "container"],
        children: [
          {
            type: "h1",
            className: "hero__title",
            children: ["Samara Patterns"],
          },
          {
            type: "p",
            className: "hero__subtitle",
            children: ["Modern, elegant, and made for makers."],
          },
          {
            type: "div",
            className: "hero__cta",
            children: [
              {
                type: "a",
                className: "btn btn--primary",
                attrs: { href: "/patterns/" },
                children: ["Explore Patterns"],
              },
              {
                type: "a",
                className: "btn btn--ghost",
                attrs: { href: "/courses/" },
                style: {
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  color: "#fff",
                },
                children: ["View Courses"],
              },
            ],
          },
        ],
      },
    ],
  },

  // SLIDE 2
  {
    type: "section",
    id: "hero-slide-2",
    className: ["hero", "hero--cover", "hero--align-start"],
    style: {
      backgroundImage: `url(${slide2})`,
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#000",
    },
    attrs: {
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": "2 of 3",
    },
    children: [
      {
        type: "div",
        className: "hero__overlay",
        style: { background: "rgba(0,0,0,.35)" },
      },
      {
        type: "div",
        className: ["hero__content", "container"],
        children: [
          {
            type: "h2",
            className: "hero__title",
            children: ["Premium Courses"],
          },
          {
            type: "p",
            className: "hero__subtitle",
            children: ["Learn techniques from industry pros."],
          },
          {
            type: "a",
            className: "btn btn--primary",
            attrs: { href: "/courses/" },
            children: ["Start Learning"],
          },
        ],
      },
    ],
  },

  // SLIDE 3
  {
    type: "section",
    id: "hero-slide-3",
    className: ["hero", "hero--cover", "hero--align-end"],
    style: {
      backgroundImage: `url(${slide3})`,
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      backgroundColor: "#000",
    },
    attrs: {
      role: "group",
      "aria-roledescription": "slide",
      "aria-label": "3 of 3",
    },
    children: [
      {
        type: "div",
        className: "hero__overlay",
        style: { background: "rgba(0,0,0,.30)" },
      },
      {
        type: "div",
        className: ["hero__content", "container"],
        children: [
          {
            type: "h2",
            className: "hero__title",
            children: ["Community Reviews"],
          },
          {
            type: "p",
            className: "hero__subtitle",
            children: ["Trusted by makers worldwide."],
          },
          {
            type: "a",
            className: "btn btn--ghost",
            attrs: { href: "/reviews/" },
            style: {
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.5)",
              color: "#fff",
            },
            children: ["Read Reviews"],
          },
        ],
      },
    ],
  },
];
