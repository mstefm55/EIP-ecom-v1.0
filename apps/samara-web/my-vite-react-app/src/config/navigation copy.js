// src/config.js

import logo from "../assets/samara logo.png";
import searchIcon from "../assets/magnifying-glass-thin.svg";
import cartIcon from "../assets/cart1.svg";
import loginIcon from "../assets/profile.svg";
import globeIcon from "../assets/globe.svg";
import settings from "../assets/settings1.svg";

export const NAV_ITEMS = [
  { label: "Patterns", href: "/patterns/" },
  { label: "Courses", href: "/courses/" },
  { label: "Blog", href: "/blog/" },
  { label: "Reviews", href: "/reviews/" },
  { label: "Contacts", href: "/contacts/" },
  { label: "❤", href: "/favorites/" },
  { label: "Profile", href: "/profile/" },
];

export const NAV_UTILITIES = [
  { label: "Search", href: "/search/", icon: searchIcon },
  { label: "Cart", href: "/cart/", icon: cartIcon },
  { label: "Login", href: "/login/", icon: loginIcon },
  { label: "EN", href: "/lang/", icon: globeIcon },
  { label: "settings", href: "/settings/", icon: settings},
];

export const BRAND_LOGO = logo;
export const BRAND_NAME = "Samara";

export const FOOTER_LINKS = [
  { label: "Privacy Policy", href: "/privacy/" },
  { label: "Terms of Service", href: "/terms/" },
  { label: "Help", href: "/help/" },
  { label: "Contact Us", href: "/contact/" },
];