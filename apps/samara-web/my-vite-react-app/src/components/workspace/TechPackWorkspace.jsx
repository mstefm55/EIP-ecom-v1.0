import React, { useMemo, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import {
  Factory,
  FileCheck2,
  FileText,
  NotebookPen,
  Printer,
  Ruler,
  Scissors
} from 'lucide-react';

import TechPackTechnicalDrawingStudio from './TechPackTechnicalDrawingStudio';
import './TechPackWorkspace.css';

const TAB_ICON_REGISTRY = {
  drawing: FileText,
  factory: Factory,
  release: FileCheck2
};

const COMPANION_ICON_REGISTRY = {
  construction: Scissors,
  measurement: Ruler,
  journal: NotebookPen
};

function findVariantModule(variant, nodeType) {
  return (variant?.children || []).find(
    (child) => child.nodeType === nodeType
  ) || null;
}

function getDisplayName(style, variant) {
  return {
    style:
      style?.values?.['product.style_name'] ||
      style?.title ||
      'Untitled style',

    styleCode:
      style?.values?.['product.style_code'] ||
      '',

    variant:
      variant?.values?.['variant.name'] ||
      variant?.title ||
      'Variant',

    variantCode:
      variant?.values?.['variant.code'] ||
      ''
  };
}

export default function TechPackWorkspace({
  metadata,
  node,
  variant,
  style,
  project,
  onChange,
  onOpenCompanion,
  onNavigateModule,
  industrialContent = null,
  releasesContent = null
}) {
  const config = metadata?.techPack;
  const tabs = config?.ui?.tabs || [];
  const companionPanels =
    config?.ui?.companionPanels || [];

  const [activeTab, setActiveTab] = useState(
    () =>
      tabs[0]?.code ||
      ''
  );

  const mediaNode = useMemo(
    () => findVariantModule(variant, 'media'),
    [variant]
  );

  const measurementNode = useMemo(
    () => findVariantModule(variant, 'sizeSet'),
    [variant]
  );

  const sewingNode = useMemo(
    () => findVariantModule(variant, 'sewing'),
    [variant]
  );

  const journalNode = useMemo(
    () => findVariantModule(variant, 'projectJournal'),
    [variant]
  );

  const identity = getDisplayName(
    style,
    variant
  );

  const values = node?.values || {};

  const handlePrint = () => {
    if (activeTab !== 'TECHNICAL_DRAWINGS') {
      setActiveTab('TECHNICAL_DRAWINGS');

      window.setTimeout(() => {
        window.print();
      }, 0);

      return;
    }

    window.print();
  };

  if (!config) {
    return (
      <section className="tp-config-error">
        <strong>{pfUiT("ui.components.workspace.techpackworkspace.0bdf662bb4")}</strong>
        <span>{pfUiT("ui.components.workspace.techpackworkspace.d918cc4ebd")}</span>
      </section>
    );
  }

  if (!tabs.length) {
    return (
      <section className="tp-config-error">
        <strong>{pfUiT("ui.components.workspace.techpackworkspace.da13c137c4")}</strong>
        <span>{pfUiT("ui.components.workspace.techpackworkspace.d7184bfbe0")}</span>
      </section>
    );
  }

  return (
    <div className="tp-workspace">
      <header className="tp-shell-header">
        <div className="tp-shell-identity">
          <div className="tp-kicker-row">
            <span className="tp-kicker">TECH PACK</span>
            <span className="tp-version-chip">
              {values.version || '—'}
            </span>
          </div>

          <div className="tp-title-row">
            <div>
              <h2 className="tp-title">
                {identity.style}
              </h2>

              <p className="tp-subtitle">
                {identity.styleCode || 'Style'}
                <span aria-hidden="true"> · </span>
                {identity.variant}
                {identity.variantCode
                  ? ` · ${identity.variantCode}`
                  : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="tp-shell-actions">
          <div
            className="tp-companion-launchers"
            aria-label={pfUiT("ui.components.workspace.techpackworkspace.2dea23bc80")}
          >
            {companionPanels.map((panel) => {
              const Icon =
                COMPANION_ICON_REGISTRY[
                  panel.icon
                ] ||
                FileText;

              return (
                <button
                  key={panel.code}
                  type="button"
                  className="tp-companion-button"
                  onClick={() =>
                    onOpenCompanion?.(
                      panel.code
                    )
                  }
                  disabled={
                    !onOpenCompanion
                  }
                  title={panel.label}
                >
                  <Icon aria-hidden="true" />
                  <span>
                    {panel.shortLabel ||
                      panel.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="tp-print-button"
            onClick={handlePrint}
          >
            <Printer aria-hidden="true" />
            <span>{pfUiT("ui.components.workspace.techpackworkspace.a393535e55")}</span>
          </button>
        </div>
      </header>

      <nav
        className="tp-main-tabs"
        aria-label={pfUiT("ui.components.workspace.techpackworkspace.fccef3a757")}
      >
        {tabs.map((tab) => {
          const Icon =
            TAB_ICON_REGISTRY[
              tab.icon
            ] ||
            FileText;

          const active =
            activeTab === tab.code;

          return (
            <button
              key={tab.code}
              type="button"
              className={`tp-main-tab ${
                active
                  ? 'is-active'
                  : ''
              }`}
              onClick={() =>
                setActiveTab(
                  tab.code
                )
              }
              aria-current={
                active
                  ? 'page'
                  : undefined
              }
            >
              <Icon aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="tp-main-content">
        {activeTab ===
          'TECHNICAL_DRAWINGS' && (
          <TechPackTechnicalDrawingStudio
            metadata={metadata}
            techPackNode={node}
            mediaNode={mediaNode}
            measurementNode={
              measurementNode
            }
            sewingNode={sewingNode}
            journalNode={journalNode}
            variant={variant}
            style={style}
            project={project}
            onChange={onChange}
            onOpenCompanion={
              onOpenCompanion
            }
            onNavigateModule={
              onNavigateModule
            }
          />
        )}

        {activeTab ===
          'INDUSTRIAL_PACK' && (
          <section className="tp-content-surface">
            {industrialContent || (
              <div className="tp-empty-surface">
                <Factory
                  aria-hidden="true"
                />
                <h3>{pfUiT("ui.components.workspace.techpackworkspace.463be851f9")}</h3>
                <p>{pfUiT("ui.components.workspace.techpackworkspace.276bd25428")}</p>
              </div>
            )}
          </section>
        )}

        {activeTab ===
          'RELEASES' && (
          <section className="tp-content-surface">
            {releasesContent || (
              <div className="tp-empty-surface">
                <FileCheck2
                  aria-hidden="true"
                />
                <h3>{pfUiT("ui.components.workspace.techpackworkspace.2634964add")}</h3>
                <p>{pfUiT("ui.components.workspace.techpackworkspace.fd2f84b147")}</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
