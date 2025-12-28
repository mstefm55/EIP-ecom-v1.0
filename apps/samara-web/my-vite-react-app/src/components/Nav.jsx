// src/components/Nav.jsx
import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  buildElement,
  buildElements,
  createNavApi,
  BRAND as DEFAULT_BRAND,
  NAV_ITEMS as DEFAULT_NAV_ITEMS,
  NAV_UTILITIES as DEFAULT_NAV_UTILS,
} from "../config/navigation";

/**
 * Production Navigation component
 * - Renders brand, primary items, and utility items using the universal builder.
 * - Accepts external state/handlers (e.g., language + handleLanguageChange).
 * - Allows overriding descriptors (brandDesc/mainItems/utilItems) if needed.
 */
function Nav({
  // Layout & classes
  containerClass = "site-nav",
  mainNavClass = "menu__main",
  utilNavClass = "menu__utils",

  // Descriptors (can override; defaults come from navigation.js)
  brandDesc = DEFAULT_BRAND,
  mainItems = DEFAULT_NAV_ITEMS,
  utilItems = DEFAULT_NAV_UTILS,

  // State & handlers for dynamic bindings/events
  language,              // e.g., "EN"
  extraState = {},       // merge in any additional state needed by descriptors
  handlers = {},         // e.g., { handleLanguageChange }

  // A11y labels (customizable)
  mainAriaLabel = "Primary",
  utilAriaLabel = "Utilities",
}) {
  // Combine all state for the builder (language + anything else)
  const state = useMemo(
    () => ({ ...(extraState || {}), ...(language !== undefined ? { language } : {}) }),
    [extraState, language]
  );

  // Build an API context for the builder
  const api = useMemo(() => createNavApi({ state, handlers }), [state, handlers]);

  // Build brand / primary / utilities nodes
  const brandNode = useMemo(() => buildElement(brandDesc, api), [brandDesc, api]);
  const mainNodes = useMemo(() => buildElements(mainItems || [], api), [mainItems, api]);
  const utilNodes = useMemo(() => buildElements(utilItems || [], api), [utilItems, api]);

  return (
    <header className={containerClass} data-component="Nav">
      {brandNode}

      <nav className={mainNavClass} aria-label={mainAriaLabel}>
        {mainNodes}
      </nav>

      {utilItems?.length ? (
        <nav className={utilNavClass} aria-label={utilAriaLabel}>
          {utilNodes}
        </nav>
      ) : null}
    </header>
  );
}

/* ---------------- PropTypes (production-safe) ---------------- */

Nav.propTypes = {
  containerClass: PropTypes.string,
  mainNavClass: PropTypes.string,
  utilNavClass: PropTypes.string,

  brandDesc: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  mainItems: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.array])),
  utilItems: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.array])),

  language: PropTypes.string,
  extraState: PropTypes.object,
  handlers: PropTypes.object,

  mainAriaLabel: PropTypes.string,
  utilAriaLabel: PropTypes.string,
};

export default React.memo(Nav);
