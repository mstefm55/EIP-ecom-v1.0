import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Store
} from 'lucide-react';

const STATUS_ICON_REGISTRY = {
  DRAFT: Clock3,
  IN_REVIEW: Send,
  REVIEW: Send,
  APPROVED: CheckCircle2,
  RELEASED: CheckCircle2,
  ACTIVE: CheckCircle2,
  SUPERSEDED: RotateCcw,
  NOT_READY: Clock3,
  READY_FOR_REVIEW: Store,
  AWAITING_MODERATOR_RELEASE: Send,
  RETURNED_BY_MODERATOR: AlertTriangle,
  PUBLISHED: CheckCircle2,
  UNPUBLISHED: RotateCcw
};

const TECHNICAL_FINAL_STATUSES = new Set([
  'APPROVED',
  'RELEASED',
  'ACTIVE',
  'SUPERSEDED'
]);

const STATUS_STYLE_MAP = {
  DRAFT: {
    icon: 'bg-[#F5EFE8] text-[#8D654B]',
    badge: 'border-[#DCC7B4] bg-[#FBF5ED] text-[#7D5C46]'
  },
  IN_REVIEW: {
    icon: 'bg-[#FBF3DF] text-[#9A6A1D]',
    badge: 'border-[#E4D1A6] bg-[#FFF8E8] text-[#8D641E]'
  },
  APPROVED: {
    icon: 'bg-[#EDF5EE] text-[#4F7A58]',
    badge: 'border-[#C9DDCC] bg-[#F0F7F1] text-[#4D7656]'
  },
  RELEASED: {
    icon: 'bg-[#EDF5EE] text-[#4F7A58]',
    badge: 'border-[#C9DDCC] bg-[#F0F7F1] text-[#4D7656]'
  },
  ACTIVE: {
    icon: 'bg-[#EDF5EE] text-[#4F7A58]',
    badge: 'border-[#C9DDCC] bg-[#F0F7F1] text-[#4D7656]'
  },
  SUPERSEDED: {
    icon: 'bg-[#F4F2ED] text-[#7A746D]',
    badge: 'border-[#D9D5CC] bg-[#F4F2ED] text-[#7A746D]'
  },
  NOT_READY: {
    icon: 'bg-[#F4F2ED] text-[#7A746D]',
    badge: 'border-[#D9D5CC] bg-[#F4F2ED] text-[#7A746D]'
  },
  READY_FOR_REVIEW: {
    icon: 'bg-[#F7EFE6] text-[#966547]',
    badge: 'border-[#D7C2AF] bg-[#FFF8F0] text-[#825F45]'
  },
  AWAITING_MODERATOR_RELEASE: {
    icon: 'bg-[#F7EFE6] text-[#966547]',
    badge: 'border-[#DDC898] bg-[#FFF8E8] text-[#8D641E]'
  },
  RETURNED_BY_MODERATOR: {
    icon: 'bg-[#FFF0EC] text-[#9A3D2F]',
    badge: 'border-[#E3C2BB] bg-[#FFF5F2] text-[#973F33]'
  },
  PUBLISHED: {
    icon: 'bg-[#EDF5EE] text-[#4F7A58]',
    badge: 'border-[#C9DDCC] bg-[#F0F7F1] text-[#4D7656]'
  },
  UNPUBLISHED: {
    icon: 'bg-[#F4F2ED] text-[#7A746D]',
    badge: 'border-[#D9D5CC] bg-[#F4F2ED] text-[#7A746D]'
  }
};

const ACTION_STYLE_MAP = {
  primary:
    'border-[#272622] bg-[#272622] text-white hover:bg-[#3A3934]',
  release:
    'border-[#4F7657] bg-[#4F7657] text-white hover:bg-[#426849]',
  secondary:
    'border-[#D9D5CC] bg-[#FFFDF9] text-[#4A4741] hover:bg-[#F4F2ED]'
};

function normalizeStatus(status) {
  return status === 'REVIEW' ? 'IN_REVIEW' : status || 'DRAFT';
}

function getStatusMeta(metadata, status) {
  const normalized = normalizeStatus(status);

  return (
    metadata?.approval?.statuses?.find((item) => item.code === normalized) || {
      code: normalized,
      label: normalized
    }
  );
}

function getWorkflow(metadata, workflowKey) {
  return metadata?.approval?.workflows?.[workflowKey] || null;
}

function getDesignerTransitions(metadata, workflowKey, status) {
  const workflow = getWorkflow(metadata, workflowKey);
  const normalized = normalizeStatus(status);

  return (workflow?.transitions || []).filter(
    (transition) =>
      (transition.from || []).includes(normalized) &&
      transition.surface !== 'MODERATOR_CONTROL'
  );
}

function statusRank(status) {
  const normalized = normalizeStatus(status);

  if (normalized === 'IN_REVIEW') return 0;
  if (normalized === 'DRAFT') return 1;
  if (TECHNICAL_FINAL_STATUSES.has(normalized)) return 2;
  return 3;
}

function getPublicationSummary(publicationItem, technicalComplete) {
  if (!technicalComplete) return 'Technical release still in progress';
  if (!publicationItem) return 'Technical released · Publication not started';

  const status = normalizeStatus(publicationItem.status);

  if (status === 'READY_FOR_REVIEW') return 'Technical released · Ready for moderator';
  if (status === 'AWAITING_MODERATOR_RELEASE') return 'Technical released · Awaiting moderator';
  if (status === 'RETURNED_BY_MODERATOR') return 'Publication returned by moderator';
  if (status === 'PUBLISHED') return 'Technical released · Published';
  if (status === 'UNPUBLISHED') return 'Technical released · Unpublished';

  return 'Technical released';
}

export default function WorkspaceApprovalCenter({
  metadata,
  items = [],
  onTransition,
  onMessageModerator,
  disabled = false,
  disabledReason = 'Save Workspace changes before changing approval status.'
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalizedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        status: normalizeStatus(item.status)
      })),
    [items]
  );

  const publicationItem =
    normalizedItems.find((item) => item.workflowKey === 'CATALOGUE_RELEASE') || null;

  const technicalItems = normalizedItems.filter(
    (item) => item.workflowKey !== 'CATALOGUE_RELEASE' && item.workflowKey !== 'PROJECT'
  );

  const projectItems = normalizedItems.filter((item) => item.workflowKey === 'PROJECT');

  const sortedTechnicalItems = useMemo(
    () =>
      [...technicalItems].sort((a, b) => {
        const difference = statusRank(a.status) - statusRank(b.status);
        if (difference) return difference;
        return String(a.title || '').localeCompare(String(b.title || ''));
      }),
    [technicalItems]
  );

  const technicalDraftCount = technicalItems.filter((item) => item.status === 'DRAFT').length;
  const technicalReviewCount = technicalItems.filter(
    (item) => item.status === 'IN_REVIEW'
  ).length;

  const technicalComplete =
    technicalItems.length > 0 &&
    technicalItems.every((item) => TECHNICAL_FINAL_STATUSES.has(item.status));

  const publicationNeedsAttention =
    publicationItem &&
    ['READY_FOR_REVIEW', 'AWAITING_MODERATOR_RELEASE', 'RETURNED_BY_MODERATOR'].includes(
      publicationItem.status
    );

  const totalAttention =
    technicalDraftCount + technicalReviewCount + (publicationNeedsAttention ? 1 : 0);

  const triggerSubtitle =
    technicalDraftCount || technicalReviewCount
      ? `${technicalDraftCount} draft${technicalDraftCount === 1 ? '' : 's'} · ${technicalReviewCount} in review`
      : getPublicationSummary(publicationItem, technicalComplete);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const renderItem = (item) => {
    const statusMeta = getStatusMeta(metadata, item.status);
    const StatusIcon = STATUS_ICON_REGISTRY[item.status] || FileCheck2;
    const statusStyle = STATUS_STYLE_MAP[item.status] || STATUS_STYLE_MAP.DRAFT;
    const transitions = getDesignerTransitions(metadata, item.workflowKey, item.status);

    return (
      <article
        key={item.key}
        className="overflow-hidden rounded-[11px] border border-[#E5E2DA] bg-white"
      >
        <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2.5">
          <span
            className={`inline-flex h-[31px] w-[31px] items-center justify-center rounded-[9px] ${statusStyle.icon}`}
          >
            <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>

          <div className="flex min-w-0 flex-col">
            <span className="font-mono text-[6.5px] font-extrabold uppercase tracking-[0.12em] text-[#9A6545]">
              {item.resourceLabel}
            </span>
            <strong className="mt-0.5 truncate text-[10px] font-semibold text-[#272622]">
              {item.title}
            </strong>
            {item.subtitle && (
              <small className="mt-0.5 truncate text-[7.5px] text-[#918D84]">
                {item.subtitle}
              </small>
            )}
          </div>

          <span
            className={`inline-flex min-h-6 items-center justify-center rounded-full border px-2 font-mono text-[6.5px] font-extrabold uppercase tracking-[0.08em] ${statusStyle.badge}`}
          >
            {statusMeta.label}
          </span>
        </div>

        {item.blockedReason && (
          <div className="mx-2.5 mb-2.5 ml-[51px] flex items-start gap-1.5 rounded-lg bg-[#F7F3ED] px-2 py-1.5 text-[7px] leading-relaxed text-[#7F756C]">
            <AlertTriangle className="mt-px h-[11px] w-[11px] shrink-0" aria-hidden="true" />
            <span>{item.blockedReason}</span>
          </div>
        )}

        {item.moderatorNote && (
          <div className="mx-2.5 mb-2.5 ml-[51px] rounded-lg border border-[#E3C7C0] bg-[#FFF8F6] px-2 py-2">
            <span className="font-mono text-[6px] font-extrabold uppercase tracking-[0.1em] text-[#995146]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.d995864631")}</span>
            <p className="mt-1 text-[7.5px] leading-relaxed text-[#5F5148]">
              {item.moderatorNote}
            </p>
          </div>
        )}

        {(transitions.length > 0 || item.canMessageModerator) && (
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-2.5 pb-2.5 pl-[51px]">
            {item.canMessageModerator && (
              <button
                type="button"
                className="mr-auto inline-flex min-h-[29px] items-center justify-center gap-1.5 rounded-lg border border-[#D7C5B5] bg-[#FFFAF4] px-2.5 text-[7.5px] font-extrabold text-[#805F49] transition-colors hover:bg-[#F8EEE4]"
                onClick={() => onMessageModerator?.(item)}
              >
                <MessageCircle className="h-[11px] w-[11px]" aria-hidden="true" />{pfUiT("ui.components.workspace.workspaceapprovalcenter.e3ae4039f8")}</button>
            )}

            {transitions.map((transition) => {
              const intent = transition.intent || 'secondary';
              const actionStyle = ACTION_STYLE_MAP[intent] || ACTION_STYLE_MAP.secondary;

              return (
                <button
                  key={transition.code}
                  type="button"
                  className={`inline-flex min-h-[29px] items-center justify-center rounded-lg border px-2.5 text-[7.5px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${actionStyle}`}
                  disabled={disabled || Boolean(item.blockedReason)}
                  title={disabled ? disabledReason : item.blockedReason || ''}
                  onClick={() => onTransition?.(item, transition)}
                >
                  {transition.label}
                </button>
              );
            })}
          </div>
        )}
      </article>
    );
  };

  return (
    <div ref={rootRef} className="relative hidden shrink-0 xl:block">
      <button
        type="button"
        className={`grid min-h-[52px] min-w-[250px] grid-cols-[34px_minmax(0,1fr)_auto_14px] items-center gap-2 rounded-[13px] border bg-[#FFFEFB] px-2.5 py-1.5 text-left text-[#272622] transition-all hover:-translate-y-px hover:bg-[#FFFAF4] hover:shadow-[0_8px_22px_rgba(60,40,27,0.07)] ${
          totalAttention ? 'border-[#D5C0AA]' : 'border-[#BFD2C2]'
        }`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] ${
            totalAttention ? 'bg-[#F6EEE4] text-[#9A6545]' : 'bg-[#EDF5EE] text-[#4F7A58]'
          }`}
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="flex min-w-0 flex-col">
          <strong className="text-[10px] font-extrabold tracking-[0.02em]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.a2d0a6c507")}</strong>
          <span className="mt-0.5 text-[8.5px] leading-tight text-[#918D84] max-[1260px]:hidden">
            {triggerSubtitle}
          </span>
        </span>

        <span
          className={`inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-2 font-mono text-[9px] font-extrabold text-white ${
            totalAttention ? 'bg-[#272622]' : 'bg-[#4F7A58]'
          }`}
        >
          {totalAttention || <Check className="h-3 w-3" aria-hidden="true" />}
        </span>

        <ChevronDown
          className={`h-[13px] w-[13px] text-[#918D84] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <section
          className="absolute right-0 top-[calc(100%+9px)] z-[120] w-[min(520px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-[#D9D5CC] bg-[#FFFDF9] shadow-[0_24px_70px_rgba(39,38,34,0.18)]"
          role="dialog"
          aria-label={pfUiT("ui.components.workspace.workspaceapprovalcenter.d01a98d51b")}
        >
          <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-[#E5E2DA] bg-gradient-to-b from-[#FFFEFB] to-[#FAF5EE] px-[18px] py-[15px]">
            <div>
              <span className="font-mono text-[7px] font-extrabold tracking-[0.16em] text-[#9A6545]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.0783c0f83b")}</span>
              <h3 className="mt-0.5 font-serif text-[22px] font-medium leading-tight tracking-[-0.02em] text-[#272622]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.a2d0a6c507")}</h3>
              <p className="mt-1 max-w-[310px] text-[9px] leading-relaxed text-[#7A746D]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.1f9b014c94")}</p>
            </div>

            <div className="grid grid-cols-2 gap-1 self-center">
              <span className="flex min-h-[46px] w-[72px] flex-col items-center justify-center rounded-[9px] border border-[#E2DBD2] bg-white text-[6.5px] font-bold uppercase text-[#918D84]">
                <strong className="font-mono text-[13px] text-[#272622]">
                  {technicalComplete ? '✓' : technicalDraftCount + technicalReviewCount}
                </strong>{pfUiT("ui.components.workspace.workspaceapprovalcenter.0d2f0d6c20")}</span>
              <span className="flex min-h-[46px] w-[72px] flex-col items-center justify-center rounded-[9px] border border-[#E2DBD2] bg-white text-[6.5px] font-bold uppercase text-[#918D84]">
                <strong className="font-mono text-[13px] text-[#272622]">
                  {publicationItem?.status === 'PUBLISHED'
                    ? '✓'
                    : publicationItem?.status === 'AWAITING_MODERATOR_RELEASE'
                      ? '…'
                      : publicationItem?.status === 'RETURNED_BY_MODERATOR'
                        ? '!'
                        : '—'}
                </strong>{pfUiT("ui.components.workspace.workspaceapprovalcenter.1c22e8cc25")}</span>
            </div>
          </header>

          {disabled && (
            <div className="mx-2.5 mt-2.5 flex items-center gap-2 rounded-[9px] border border-[#E8D5AA] bg-[#FFF8E7] px-2.5 py-2 text-[7.5px] leading-relaxed text-[#7D5B20]">
              <AlertTriangle className="h-[13px] w-[13px] shrink-0" aria-hidden="true" />
              <span>{disabledReason}</span>
            </div>
          )}

          <div className="max-h-[min(520px,66vh)] overflow-y-auto p-2.5">
            {projectItems.length > 0 && (
              <section>
                <div className="mx-0.5 mb-2 font-mono text-[6.5px] font-extrabold uppercase tracking-[0.14em] text-[#8B7E72]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.9c833e718c")}</div>
                <div className="space-y-2">{projectItems.map(renderItem)}</div>
              </section>
            )}

            <section className={projectItems.length ? 'mt-3 border-t border-[#E5E2DA] pt-3' : ''}>
              <div className="mx-0.5 mb-2 font-mono text-[6.5px] font-extrabold uppercase tracking-[0.14em] text-[#8B7E72]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.af156d08ac")}</div>

              {sortedTechnicalItems.length ? (
                <div className="space-y-2">{sortedTechnicalItems.map(renderItem)}</div>
              ) : (
                <div className="flex min-h-[82px] flex-col items-center justify-center text-center">
                  <FileCheck2 className="h-[18px] w-[18px] text-[#587C5F]" aria-hidden="true" />
                  <strong className="mt-2 text-[10px] text-[#272622]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.b729c1b490")}</strong>
                </div>
              )}
            </section>

            <section className="mt-3 border-t border-[#E5E2DA] pt-3">
              <div className="mx-0.5 mb-2 font-mono text-[6.5px] font-extrabold uppercase tracking-[0.14em] text-[#8B7E72]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.5fc1866230")}</div>

              {publicationItem ? (
                renderItem(publicationItem)
              ) : (
                <div className="flex min-h-[82px] flex-col items-center justify-center text-center">
                  <Store className="h-[18px] w-[18px] text-[#B48C70]" aria-hidden="true" />
                  <strong className="mt-2 text-[10px] text-[#272622]">{pfUiT("ui.components.workspace.workspaceapprovalcenter.4b4aca5b32")}</strong>
                </div>
              )}
            </section>
          </div>
        </section>
      )}
    </div>
  );
}
