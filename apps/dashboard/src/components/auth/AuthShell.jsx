import { Children, cloneElement, isValidElement } from "react";
import { UserPlus } from "lucide-react";
import EipMark from "../brand/EipMark";
import { runAction } from "../../engine/actions";
import { EipLanguageSwitcher, useEipLanguage } from "../../i18n/EipLanguageContext.jsx";

export default function AuthShell({ node, children, ctx }) {
  const { t } = useEipLanguage();
  const {
    brand,
    nav = [],
    cta,
    helper,
    quickLoginLabel = "Quick Login",
    quickAction = "open-modal",
    showQuickLogin = true,
    ctaAction = "open-modal",
    showCta = true,
  } = node.props || {};
  const [hero, panels, ...modals] = children || [];
  let balancedPanels = panels;
  let leftRailBlocks = [];

  if (isValidElement(panels)) {
    const panelChildren = Children.toArray(panels.props?.children);
    const leftIds = new Set(["feature-grid", "security-note"]);
    const nextLeft = [];
    const nextRight = [];

    panelChildren.forEach((child) => {
      const id = child?.props?.node?.id;
      if (leftIds.has(id)) {
        nextLeft.push(child);
      } else {
        nextRight.push(child);
      }
    });

    if (nextLeft.length && nextRight.length) {
      leftRailBlocks = nextLeft;
      balancedPanels = cloneElement(panels, panels.props, nextRight);
    }
  }
  const canShowQuickLogin = showQuickLogin !== false;
  const canShowCta = showCta !== false && Boolean(cta);

  return (
    <div className="eip-v1-shell eip-v1-auth-shell relative min-h-screen overflow-hidden bg-mist-50 text-ink-900">
      <div className="pointer-events-none absolute inset-0 bg-auth-aurora opacity-90" />
      <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-brand-200/50 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-96 w-96 rounded-full bg-cyan-200/60 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-auth-grain opacity-50" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-brand-700 shadow-soft">
            <EipMark className="h-6 w-6" title="EIP" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-ink-400">{brand}</p>
            <p className="text-lg font-semibold font-display">{t("Identity Gateway")}</p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-ink-500 md:flex">
          {nav.map((item) => (
            <span key={item} className="hover:text-ink-900 transition">
              {t(item)}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {canShowQuickLogin ? (
            <button
              type="button"
              onClick={() => runAction(quickAction, ctx)}
              className="rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-600 shadow-soft hover:bg-white"
            >
              {t(quickLoginLabel)}
            </button>
          ) : null}
          <EipLanguageSwitcher compact />
          {canShowCta ? (
            <button
              type="button"
              onClick={() => runAction(ctaAction, ctx)}
              className="hidden items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-brand-700 md:flex"
            >
              <UserPlus className="h-4 w-4" />
              {t(cta)}
            </button>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          {hero}
          {leftRailBlocks.length ? <div className="space-y-6">{leftRailBlocks}</div> : null}
        </section>
        <section>{balancedPanels}</section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-10 text-sm text-ink-400">
        <p className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          {t(helper)}
        </p>
      </footer>

      {modals}
    </div>
  );
}
