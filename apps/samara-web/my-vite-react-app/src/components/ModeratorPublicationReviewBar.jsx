import React, { useMemo, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  X
} from 'lucide-react';

import './ModeratorPublicationReview.css';

function findTransition(
  workflow,
  code,
  status
) {
  return (
    workflow?.transitions ||
    []
  ).find(
    (transition) =>
      transition.code ===
        code &&
      (
        transition.from ||
        []
      ).includes(
        status
      )
  ) ||
    null;
}

export default function ModeratorPublicationReviewBar({
  request,
  workflow,
  onClose,
  onApprove,
  onReturn,
  onMessageDesigner
}) {
  const [
    returning,
    setReturning
  ] = useState(false);

  const [
    returnReason,
    setReturnReason
  ] = useState('');

  const approveTransition =
    useMemo(
      () =>
        findTransition(
          workflow,
          'MODERATOR_PUBLISH',
          request?.status
        ),
      [
        request?.status,
        workflow
      ]
    );

  const returnTransition =
    useMemo(
      () =>
        findTransition(
          workflow,
          'MODERATOR_RETURN',
          request?.status
        ),
      [
        request?.status,
        workflow
      ]
    );

  if (!request) {
    return null;
  }

  const pending =
    request.status ===
    'AWAITING_MODERATOR_RELEASE';

  return (
    <section className="moderator-review-bar">
      <div className="moderator-review-main">
        <div className="moderator-review-title">
          <span className="moderator-review-icon">
            <ShieldCheck aria-hidden="true" />
          </span>

          <div>
            <span>{pfUiT("ui.components.moderatorpublicationreviewbar.fbedd5b300")}</span>

            <strong>
              {request.styleName}
            </strong>

            <small>
              {request.requestId}
              {request.variantCode
                ? ` · ${request.variantCode}`
                : ''}
            </small>
          </div>
        </div>

        <div className="moderator-review-context">
          <span>{pfUiT("ui.components.moderatorpublicationreviewbar.d869a8633e")}</span>

          <strong>{pfUiT("ui.components.moderatorpublicationreviewbar.132cbe1e4f")}</strong>

          <small>{pfUiT("ui.components.moderatorpublicationreviewbar.4172eb8f22")}</small>
        </div>

        <div className="moderator-review-actions">
          <button
            type="button"
            className="moderator-review-message"
            onClick={() =>
              onMessageDesigner?.(
                request
              )
            }
          >
            <MessageCircle aria-hidden="true" />{pfUiT("ui.components.moderatorpublicationreviewbar.c9923fc1d5")}</button>

          {pending &&
            returnTransition && (
            <button
              type="button"
              className="moderator-review-return"
              onClick={() =>
                setReturning(
                  (current) =>
                    !current
                )
              }
            >
              <RotateCcw aria-hidden="true" />{pfUiT("ui.components.moderatorpublicationreviewbar.0683f52939")}</button>
          )}

          {pending &&
            approveTransition && (
            <button
              type="button"
              className="moderator-review-approve"
              onClick={() =>
                onApprove?.(
                  request,
                  approveTransition
                )
              }
            >
              <CheckCircle2 aria-hidden="true" />{pfUiT("ui.components.moderatorpublicationreviewbar.4bd5284bd7")}</button>
          )}

          <button
            type="button"
            className="moderator-review-close"
            onClick={
              onClose
            }
            aria-label={pfUiT("ui.components.moderatorpublicationreviewbar.35e7d66df3")}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      {returning &&
        pending && (
        <div className="moderator-review-return-panel">
          <div>
            <span>
              RETURN TO DESIGNER
            </span>

            <strong>{pfUiT("ui.components.moderatorpublicationreviewbar.096660aaf1")}</strong>
          </div>

          <textarea
            rows="2"
            value={
              returnReason
            }
            onChange={(
              event
            ) =>
              setReturnReason(
                event.target.value
              )
            }
            placeholder={pfUiT("ui.components.moderatorpublicationreviewbar.28d44625d8")}
            autoFocus
          />

          <div className="moderator-review-return-actions">
            <button
              type="button"
              onClick={() => {
                setReturning(false);
                setReturnReason('');
              }}
            >
              <ArrowLeft aria-hidden="true" />{pfUiT("ui.components.moderatorpublicationreviewbar.06e80d654b")}</button>

            <button
              type="button"
              className="is-confirm"
              disabled={
                !returnReason.trim()
              }
              onClick={() => {
                onReturn?.(
                  request,
                  returnTransition,
                  returnReason.trim()
                );
              }}
            >{pfUiT("ui.components.moderatorpublicationreviewbar.c2f4d39295")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
