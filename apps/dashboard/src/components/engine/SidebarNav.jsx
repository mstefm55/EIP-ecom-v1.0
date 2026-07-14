import {
  LayoutGrid,
  ClipboardList,
  Users,
  Shield,
  FileClock,
  Activity,
  Plug,
  BarChart3,
  Briefcase,
  Copy,
  CreditCard,
  Settings,
  GitBranch,
  Database,
  Package,
  LayoutTemplate,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
} from "lucide-react";
import EipMark from "../brand/EipMark";
import { useEipLanguage } from "../../i18n/EipLanguageContext.jsx";

const ICONS = {
  LayoutGrid,
  ClipboardList,
  Users,
  Shield,
  FileClock,
  Activity,
  Plug,
  BarChart3,
  Briefcase,
  Copy,
  CreditCard,
  Settings,
  GitBranch,
  Database,
  Package,
  LayoutTemplate,
  ShoppingCart,
};

function resolveIcon(icon) {
  if (!icon) return LayoutGrid;
  if (typeof icon === "string") return ICONS[icon] || LayoutGrid;
  return icon;
}

const DEFAULT_MENU = [{ code: "dashboard", label: "Dashboard", icon: "LayoutGrid" }];

export default function SidebarNav({
  brand = "EIP Core",
  title = "Workspace",
  menu = DEFAULT_MENU,
  activeItem,
  onSelect,
  collapsed,
  onToggle,
  showToggle = true,
  topOffset = "1.5rem",
  bottomOffset = "1.5rem",
}) {
  const { t } = useEipLanguage();
  return (
    <aside
      className={`glass-panel fixed left-4 flex min-h-0 flex-col overflow-hidden py-5 ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{ top: topOffset, bottom: bottomOffset }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={`flex items-center gap-3 px-4 ${collapsed ? "justify-center" : ""}`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/80 text-brand-700 shadow-soft">
            <EipMark className="h-5 w-5" title="EIP" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-[0.55rem] uppercase tracking-[0.32em] text-ink-400">{brand}</p>
              <p className="text-[0.85rem] font-semibold font-display">{title}</p>
            </div>
          ) : null}
        </div>

        <div className="eip-sidebar-scroll mt-5 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-2.5 pr-2">
          {menu.map((item) => {
            const Icon = resolveIcon(item.icon);
            const active = activeItem === item.code;
            const label = t(item.label);
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => onSelect?.(item.code)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-1.5 text-[0.85rem] font-semibold transition ${
                  active
                    ? "bg-ink-900 text-white shadow-soft"
                    : "text-ink-500 hover:bg-white/70"
                } ${collapsed ? "justify-center" : ""}`}
                title={label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span className="min-w-0 flex-1 truncate text-left">{label}</span> : null}
                {!collapsed && item.badge ? (
                  <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-brand-700">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {showToggle ? (
        <div className="px-4">
          <button
            type="button"
            onClick={() => onToggle?.()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-ink-500"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed ? t("Collapse") : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
