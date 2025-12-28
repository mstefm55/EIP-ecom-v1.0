// src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { buildElements, createNavApi } from "../config/navigation";

// ✅ Optional: tiny inline chevrons so you don't depend on lucide-react
const ChevronLeft = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

function Sidebar({
  containerTag = "aside",
  containerClass = "site-sidebar",
  sections = [],
  state = {},
  handlers = {},
  defaultCollapsed = false,
  onCollapseChange,                 // optional callback (collapsed:boolean) => void
}) {
  const [isCollapsed, setIsCollapsed] = useState(Boolean(defaultCollapsed));

  const api   = useMemo(() => createNavApi({ state, handlers }), [state, handlers]);
  const nodes = useMemo(() => buildElements(sections, api), [sections, api]);

  // keep content margin in sync with sidebar width
  useEffect(() => {
    const layout = document.querySelector(".layout");
    if (!layout) return;
    layout.classList.toggle("layout--collapsed", isCollapsed);
  }, [isCollapsed]);

  // notify parent if needed
  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  const Container = containerTag;
  return (
    <Container
      className={`${containerClass} ${isCollapsed ? "is-collapsed" : ""}`}
      aria-label="Sidebar"
      data-collapsed={isCollapsed ? "true" : "false"}
    >
      <button
        className="sidebar__toggle"
        onClick={() => setIsCollapsed(v => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsCollapsed(v => !v); } }}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        type="button"
      >
        <ChevronLeft size={12} /> 
      </button>

      <div className="sidebar__content">
        {nodes}
      </div>
    </Container>
  );
}

Sidebar.propTypes = {
  containerTag: PropTypes.oneOf(["aside", "nav", "div"]),
  containerClass: PropTypes.string,
  sections: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.object, PropTypes.array])),
  state: PropTypes.object,
  handlers: PropTypes.object,
  defaultCollapsed: PropTypes.bool,
  onCollapseChange: PropTypes.func,
};

export default React.memo(Sidebar);
