import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import { runtimeDataStorage } from '../../lib/runtimeDataGateway';
import {
  ChevronDown,
  MessageCircle,
  Send,
  X
} from 'lucide-react';

import './WorkspaceMessagingWidget.css';

function makeThreadId(context) {
  return [
    context?.contextType || 'workspace',
    context?.requestId || context?.variantId || 'general'
  ].join(':');
}

function makeMessageId() {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `message-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function loadThreads(storageKey) {
  try {
    const parsed =
      JSON.parse(
        runtimeDataStorage.getItem(storageKey) ||
        '[]'
      );

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function persistThreads(storageKey, threads) {
  try {
    runtimeDataStorage.setItem(
      storageKey,
      JSON.stringify(threads)
    );
  } catch {}
}

function ensureContextThread(
  threads,
  context
) {
  if (!context?.variantId) {
    return {
      threads,
      threadId: null
    };
  }

  const threadId =
    makeThreadId(context);

  const existing =
    threads.find(
      (thread) =>
        thread.id ===
        threadId
    );

  if (existing) {
    return {
      threads: threads.map(
        (thread) =>
          thread.id ===
          threadId
            ? {
                ...thread,
                ...context,
                updatedAt:
                  new Date().toISOString()
              }
            : thread
      ),
      threadId
    };
  }

  const now =
    new Date().toISOString();

  return {
    threads: [
      {
        id: threadId,
        ...context,
        recipientRole:
          context.recipientRole ||
          'MODERATOR',
        recipientLabel:
          context.recipientLabel ||
          'Moderator',
        messages: [],
        createdAt: now,
        updatedAt: now
      },
      ...threads
    ],
    threadId
  };
}

export default function WorkspaceMessagingWidget({
  storageKey,
  currentUser,
  context,
  openRequest,
  onOpenRequestHandled,
  showLauncher = true
}) {
  const [
    threads,
    setThreads
  ] = useState(
    () =>
      typeof window ===
      'undefined'
        ? []
        : loadThreads(
            storageKey
          )
  );

  const [
    open,
    setOpen
  ] = useState(false);

  const [
    activeThreadId,
    setActiveThreadId
  ] = useState(null);

  const [
    draft,
    setDraft
  ] = useState('');

  const bodyRef =
    useRef(null);

  const activeThread =
    threads.find(
      (thread) =>
        thread.id ===
        activeThreadId
    ) ||
    null;

  const contextThread =
    useMemo(
      () =>
        context
          ? threads.find(
              (thread) =>
                thread.id ===
                makeThreadId(
                  context
                )
            ) || null
          : null,
      [
        context,
        threads
      ]
    );

  const unreadCount =
    threads.reduce(
      (total, thread) =>
        total +
        Number(
          thread.unreadCount ||
          0
        ),
      0
    );

  useEffect(() => {
    persistThreads(
      storageKey,
      threads
    );
  }, [
    storageKey,
    threads
  ]);

  useEffect(() => {
    if (!context) {
      return;
    }

    setThreads(
      (current) => {
        const result =
          ensureContextThread(
            current,
            context
          );

        return result.threads;
      }
    );
  }, [
    context?.contextType,
    context?.requestId,
    context?.variantId,
    context?.title
  ]);

  useEffect(() => {
    if (!openRequest) {
      return;
    }

    setThreads(
      (current) => {
        const result =
          ensureContextThread(
            current,
            openRequest
          );

        setActiveThreadId(
          result.threadId
        );

        return result.threads.map(
          (thread) =>
            thread.id ===
            result.threadId
              ? {
                  ...thread,
                  unreadCount: 0
                }
              : thread
        );
      }
    );

    setOpen(true);
    onOpenRequestHandled?.();
  }, [
    openRequest,
    onOpenRequestHandled
  ]);

  useEffect(() => {
    if (
      open &&
      activeThreadId
    ) {
      setThreads(
        (current) =>
          current.map(
            (thread) =>
              thread.id ===
              activeThreadId
                ? {
                    ...thread,
                    unreadCount: 0
                  }
                : thread
          )
      );
    }
  }, [
    open,
    activeThreadId
  ]);

  useEffect(() => {
    if (
      !open ||
      !bodyRef.current
    ) {
      return;
    }

    bodyRef.current.scrollTop =
      bodyRef.current.scrollHeight;
  }, [
    open,
    activeThreadId,
    activeThread?.messages?.length
  ]);

  const openWidget = () => {
    const preferred =
      contextThread?.id ||
      threads[0]?.id ||
      null;

    setActiveThreadId(
      (current) =>
        current &&
        threads.some(
          (thread) =>
            thread.id ===
            current
        )
          ? current
          : preferred
    );

    setOpen(true);
  };

  const handleSend = () => {
    const text =
      draft.trim();

    if (
      !text ||
      !activeThreadId
    ) {
      return;
    }

    const actor = {
      id:
        currentUser?.id ||
        currentUser?.identity_id ||
        currentUser?.userId ||
        'local-user',

      name:
        currentUser?.name ||
        currentUser?.displayName ||
        currentUser?.fullName ||
        currentUser?.email ||
        'Designer'
    };

    const message = {
      id:
        makeMessageId(),
      senderType:
        'DESIGNER',
      sender:
        actor,
      text,
      createdAt:
        new Date().toISOString()
    };

    setThreads(
      (current) =>
        current.map(
          (thread) =>
            thread.id ===
            activeThreadId
              ? {
                  ...thread,
                  messages: [
                    ...(thread.messages ||
                      []),
                    message
                  ],
                  updatedAt:
                    message.createdAt
                }
              : thread
        )
    );

    setDraft('');
  };

  return (
    <>
      {showLauncher && (
      <button
        type="button"
        className="ws-message-launcher"
        onClick={
          openWidget
        }
        aria-label={pfUiT("ui.components.workspace.workspacemessagingwidget.93f62add10")}
      >
        <MessageCircle aria-hidden="true" />

        <span>{pfUiT("ui.components.workspace.workspacemessagingwidget.2fe454ce33")}</span>

        {unreadCount >
          0 && (
          <strong>
            {unreadCount >
            99
              ? '99+'
              : unreadCount}
          </strong>
        )}
      </button>
      )}

      {open && (
        <section
          className="ws-message-panel"
          aria-label={pfUiT("ui.components.workspace.workspacemessagingwidget.d2224bfbdd")}
        >
          <header className="ws-message-header">
            <div>
              <span className="ws-message-kicker">
                WORKSPACE
              </span>
              <h3>{pfUiT("ui.components.workspace.workspacemessagingwidget.2fe454ce33")}</h3>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              aria-label={pfUiT("ui.components.workspace.workspacemessagingwidget.9012922cff")}
            >
              <X aria-hidden="true" />
            </button>
          </header>

          <div className="ws-message-content">
            <aside className="ws-message-threads">
              {threads.length ? (
                threads.map(
                  (thread) => {
                    const active =
                      thread.id ===
                      activeThreadId;

                    const latest =
                      thread.messages?.[
                        thread.messages
                          .length -
                          1
                      ];

                    return (
                      <button
                        key={
                          thread.id
                        }
                        type="button"
                        className={`ws-message-thread ${
                          active
                            ? 'is-active'
                            : ''
                        }`}
                        onClick={() =>
                          setActiveThreadId(
                            thread.id
                          )
                        }
                      >
                        <span className="ws-message-thread-context">
                          {thread.contextLabel ||
                            'Workspace'}
                        </span>

                        <strong>
                          {thread.title ||
                            'Conversation'}
                        </strong>

                        <small>
                          {latest?.text ||
                            thread.requestId ||
                            thread.recipientLabel ||
                            'Moderator'}
                        </small>
                      </button>
                    );
                  }
                )
              ) : (
                <div className="ws-message-thread-empty">{pfUiT("ui.components.workspace.workspacemessagingwidget.054780e41b")}</div>
              )}
            </aside>

            <main className="ws-message-conversation">
              {activeThread ? (
                <>
                  <div className="ws-message-context">
                    <div>
                      <span>
                        {activeThread.contextLabel ||
                          'Publication request'}
                      </span>

                      <strong>
                        {activeThread.title ||
                          'Product review'}
                      </strong>

                      {activeThread.requestId && (
                        <small>
                          {
                            activeThread.requestId
                          }
                        </small>
                      )}
                    </div>

                    <span className="ws-message-recipient">
                      {activeThread.recipientLabel ||
                        'Moderator'}
                    </span>
                  </div>

                  <div
                    ref={bodyRef}
                    className="ws-message-body"
                  >
                    {(activeThread.messages ||
                      []).length ? (
                      activeThread.messages.map(
                        (
                          message
                        ) => {
                          const own =
                            message.senderType ===
                            'DESIGNER';

                          return (
                            <div
                              key={
                                message.id
                              }
                              className={`ws-message-bubble-row ${
                                own
                                  ? 'is-own'
                                  : ''
                              }`}
                            >
                              <div className="ws-message-bubble">
                                <span>
                                  {message.sender?.name ||
                                    (own
                                      ? 'Designer'
                                      : 'Moderator')}
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
                      <div className="ws-message-empty">
                        <MessageCircle aria-hidden="true" />

                        <strong>{pfUiT("ui.components.workspace.workspacemessagingwidget.d628da710c")}</strong>

                        <span>{pfUiT("ui.components.workspace.workspacemessagingwidget.0fb5495fe0")}</span>
                      </div>
                    )}
                  </div>

                  <footer className="ws-message-compose">
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
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                            'Enter' &&
                          !event.shiftKey
                        ) {
                          event.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={pfUiT("ui.components.workspace.workspacemessagingwidget.152fce86ae")}
                    />

                    <button
                      type="button"
                      onClick={
                        handleSend
                      }
                      disabled={
                        !draft.trim()
                      }
                    >
                      <Send aria-hidden="true" />{pfUiT("ui.components.workspace.workspacemessagingwidget.ed2319e12e")}</button>
                  </footer>
                </>
              ) : (
                <div className="ws-message-no-selection">
                  <MessageCircle aria-hidden="true" />

                  <strong>{pfUiT("ui.components.workspace.workspacemessagingwidget.8083c04175")}</strong>

                  <span>{pfUiT("ui.components.workspace.workspacemessagingwidget.5c20153c56")}</span>
                </div>
              )}
            </main>
          </div>
        </section>
      )}
    </>
  );
}
