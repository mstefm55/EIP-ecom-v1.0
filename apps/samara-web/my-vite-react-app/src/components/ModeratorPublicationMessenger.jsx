import React, { useEffect, useMemo, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import {
  MessageCircle,
  Send,
  X
} from 'lucide-react';

import {
  appendPublicationMessage,
  getPublicationThread,
  PUBLICATION_MESSAGE_EVENT
} from '../lib/workspacePublicationReview';

import './ModeratorPublicationMessenger.css';

export default function ModeratorPublicationMessenger({
  open,
  request,
  storageKey,
  currentUser,
  onClose
}) {
  const [
    threadVersion,
    setThreadVersion
  ] = useState(0);

  const [
    draft,
    setDraft
  ] = useState('');

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const refresh = () =>
      setThreadVersion(
        (value) =>
          value + 1
      );

    window.addEventListener(
      PUBLICATION_MESSAGE_EVENT,
      refresh
    );

    window.addEventListener(
      'storage',
      refresh
    );

    return () => {
      window.removeEventListener(
        PUBLICATION_MESSAGE_EVENT,
        refresh
      );

      window.removeEventListener(
        'storage',
        refresh
      );
    };
  }, [open]);

  const thread =
    useMemo(
      () =>
        getPublicationThread({
          storageKey,
          requestId:
            request?.requestId
        }),
      [
        request?.requestId,
        storageKey,
        threadVersion
      ]
    );

  if (
    !open ||
    !request
  ) {
    return null;
  }

  const messages =
    thread?.messages ||
    [];

  const sendMessage = () => {
    const text =
      draft.trim();

    if (!text) {
      return;
    }

    appendPublicationMessage({
      storageKey,
      request,
      senderType:
        'MODERATOR',
      sender:
        currentUser,
      text
    });

    setDraft('');
    setThreadVersion(
      (value) =>
        value + 1
    );
  };

  return (
    <section className="moderator-message-panel">
      <header>
        <div>
          <span>
            PUBLICATION REVIEW
          </span>

          <h3>{pfUiT("ui.components.moderatorpublicationmessenger.2f8e56e910")}</h3>

          <small>
            {request.requestId}
            {' · '}
            {request.styleName}
          </small>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          aria-label={pfUiT("ui.components.moderatorpublicationmessenger.7cf93ee957")}
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="moderator-message-body">
        {messages.length ? (
          messages.map(
            (message) => {
              const own =
                message.senderType ===
                'MODERATOR';

              return (
                <div
                  key={
                    message.id
                  }
                  className={`moderator-message-row ${
                    own
                      ? 'is-own'
                      : ''
                  }`}
                >
                  <div className="moderator-message-bubble">
                    <span>
                      {message.sender?.name ||
                        (own
                          ? 'Moderator'
                          : 'Designer')}
                    </span>

                    <p>
                      {
                        message.text
                      }
                    </p>

                    <time>
                      {new Date(
                        message.createdAt
                      ).toLocaleString()}
                    </time>
                  </div>
                </div>
              );
            }
          )
        ) : (
          <div className="moderator-message-empty">
            <MessageCircle aria-hidden="true" />

            <strong>{pfUiT("ui.components.moderatorpublicationmessenger.8638fae1f6")}</strong>

            <span>{pfUiT("ui.components.moderatorpublicationmessenger.9f80ddf992")}</span>
          </div>
        )}
      </div>

      <footer>
        <textarea
          rows="2"
          value={
            draft
          }
          onChange={(
            event
          ) =>
            setDraft(
              event.target.value
            )
          }
          placeholder={pfUiT("ui.components.moderatorpublicationmessenger.27e8736e26")}
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
                'Enter' &&
              !event.shiftKey
            ) {
              event.preventDefault();
              sendMessage();
            }
          }}
        />

        <button
          type="button"
          onClick={
            sendMessage
          }
          disabled={
            !draft.trim()
          }
        >
          <Send aria-hidden="true" />{pfUiT("ui.components.moderatorpublicationmessenger.9c2f3188e3")}</button>
      </footer>
    </section>
  );
}
