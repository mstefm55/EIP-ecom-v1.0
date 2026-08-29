import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../lib/i18n';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Inbox,
  MessageCircle,
  Minus,
  PenLine,
  Reply,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X
} from 'lucide-react';
import {
  getUserDisplayName,
  getUserIdentity
} from './messages/messageMetadata';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import {
  FLOATING_TOOL_LAUNCHER,
  clampFloatingToolPosition,
  normalizeFloatingToolLayout,
  persistFloatingToolLayout
} from '../lib/floatingToolLayout';
import { UI_LAYERS } from '../lib/uiLayers';
import { runtimeDataStorage } from '../lib/runtimeDataGateway';
import {
  formatRecipientDisplay,
  getPublicUserPresentation,
  normalizeUsername
} from '../lib/userIdentity';

const CONTACT_SHARE_ENABLED = false;
const defaultMetadata = perfectFitMetadata.messaging;
const EMPTY_RECIPIENTS = Object.freeze([]);

const safeRead = (key, fallback = []) => {
  try {
    const value = runtimeDataStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  try {
    runtimeDataStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([groupKey, groupValue]) => {
    if (Array.isArray(groupValue)) {
      return groupValue.map((item) => ({
        ...item,
        __groupKey: groupKey
      }));
    }

    if (groupValue && typeof groupValue === 'object') {
      return [{ ...groupValue, __groupKey: groupKey }];
    }

    return [];
  });
};

const getTimestamp = (message) =>
  message?.createdAt ||
  message?.sentAt ||
  message?.at ||
  message?.timestamp ||
  new Date(0).toISOString();

const formatMessageDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const looksPrivateIdentifier = (value) => {
  const text = String(value || '').trim();
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ||
    /^(user|user-id|agent|role|local-user):/i.test(text)
  );
};

const safeVisibleText = (value, fallback = '') => {
  const text = String(value || '').trim();
  if (!text || looksPrivateIdentifier(text)) return fallback;
  return text;
};

const roleLabelForMessageRole = (role = '') => {
  const normalizedRole = String(role || '').toLowerCase();
  if (['designer', 'collaborator', 'seller'].includes(normalizedRole)) return 'Designer';
  if (normalizedRole === 'buyer') return 'Buyer';
  if (normalizedRole === 'administrator') return 'Administrator';
  if (normalizedRole === 'moderator') return 'Moderator';
  return 'Perfect Fit member';
};

const normalizePresentation = (entity = {}, fallbackRole = '') => {
  const role = entity.role || entity.recipientRole || fallbackRole || '';
  const username = normalizeUsername(entity.username || entity.handle);
  const brandName = entity.brandName || entity.designerBrand || entity.studioName || '';
  const displayLabel = safeVisibleText(
    entity.displayLabel ||
    entity.label ||
    entity.name ||
    entity.fullName ||
    entity.recipientName,
    ''
  );

  const presentation = getPublicUserPresentation(
    {
      ...entity,
      username,
      brandName,
      role,
      roleLabel: entity.roleLabel || roleLabelForMessageRole(role),
      displayLabel
    },
    { source: 'message-center-presentation' }
  );

  return {
    username: presentation.username,
    brandName: presentation.brandName,
    role,
    roleLabel: presentation.roleLabel || roleLabelForMessageRole(role),
    displayLabel: displayLabel || presentation.displayLabel,
    label: formatRecipientDisplay({
      ...presentation,
      displayLabel,
      role,
      roleLabel: presentation.roleLabel || roleLabelForMessageRole(role)
    })
  };
};

const getRecipientLabel = (recipient = {}) =>
  formatRecipientDisplay({
    ...recipient,
    roleLabel: recipient.roleLabel || roleLabelForMessageRole(recipient.role)
  });

const getMessageSenderLabel = (message = {}) =>
  formatRecipientDisplay({
    ...(message.senderPresentation || {}),
    role: message.senderRole,
    roleLabel:
      message.senderPresentation?.roleLabel ||
      roleLabelForMessageRole(message.senderRole),
    displayLabel: safeVisibleText(message.senderName, '')
  });

function normalizeWorkflowMessage(message, index, metadata) {
  const sender = message?.sender || message?.actor || {};

  const senderType = String(
    message?.senderType ||
    message?.actorType ||
    sender?.role ||
    ''
  ).toUpperCase();

  const request = message?.request || message?.context || {};

  const requestId =
    message?.requestId ||
    request?.requestId ||
    message?.__groupKey ||
    '';

  const styleName =
    message?.styleName ||
    request?.styleName ||
    request?.title ||
    message?.title ||
    '';

  const isModerator = senderType.includes('MODERATOR');

  return {
    id: message?.id || `workflow-${requestId || 'message'}-${index}`,
    messageType: 'WORKFLOW',
    protected: true,
    senderId:
      message?.senderId ||
      (sender?.email
        ? `user:${String(sender.email).toLowerCase()}`
        : isModerator
          ? 'role:moderator'
          : 'role:designer'),
    senderName:
      getUserDisplayName(sender) ||
      (isModerator
        ? metadata.workflow.labels.moderator
        : metadata.workflow.labels.designer),
    recipients: [
      {
        id:
          message?.recipientId ||
          (isModerator ? 'role:designer' : 'role:moderator'),
        name:
          message?.recipientName ||
          (isModerator
            ? metadata.workflow.labels.designer
            : metadata.workflow.labels.moderator),
        role: isModerator ? 'designer' : 'moderator'
      }
    ],
    subject:
      message?.subject ||
      (styleName
        ? `Publication review · ${styleName}`
        : requestId
          ? `Publication review · ${requestId}`
          : 'Approval / release workflow'),
    text: message?.text || message?.message || message?.body || '',
    createdAt: getTimestamp(message),
    contextLabel:
      requestId
        ? `Request ${requestId}`
        : metadata.workflow.labels.automatic,
    raw: message
  };
}

function normalizeDirectMessage(message) {
  const recipients =
    Array.isArray(message?.recipients) && message.recipients.length
      ? message.recipients.map((recipient) => normalizeRecipientEntry(recipient))
      : message?.recipientId
        ? [
            normalizeRecipientEntry({
              id: message.recipientId,
              name: message.recipientName || 'Recipient',
              role: message.recipientRole || ''
            })
          ]
        : [];

  const senderPresentation = message.senderPresentation ||
    normalizePresentation(
      {
        id: message.senderId,
        username: message.senderUsername,
        brandName: message.senderBrandName,
        displayLabel: message.senderDisplayLabel,
        name: message.senderName,
        role: message.senderRole
      },
      message.senderRole
    );

  return {
    id: message.id,
    messageType: 'DIRECT',
    protected: false,
    senderId: message.senderId || '',
    senderPresentation,
    senderName:
      formatRecipientDisplay(senderPresentation) ||
      safeVisibleText(message.senderName, 'Perfect Fit user'),
    senderRole: message.senderRole || '',
    recipients,
    subject: message.subject || '(No subject)',
    text: message.text || '',
    createdAt: getTimestamp(message),
    contextLabel: message.contextLabel || 'Direct message',
    context: message.context || {},
    privacy: message.privacy || { mode: message.privacyMode || 'USERNAME_ONLY' },
    raw: message
  };
}

const recipientNames = (message) =>
  (message?.recipients || [])
    .map((recipient) => getRecipientLabel(recipient))
    .filter(Boolean)
    .join(', ') || 'Recipient';

const normalizeRecipientEntry = (recipient = {}) => {
  const email = recipient.email ? String(recipient.email).toLowerCase() : '';
  const role = recipient.role ? String(recipient.role).toLowerCase() : '';
  const id =
    recipient.id ||
    recipient.recipientId ||
    (email
      ? `user:${email}`
      : role
        ? `role:${role}`
        : '');
  const presentation = normalizePresentation(recipient, role);
  const label = getRecipientLabel(presentation);

  return {
    ...recipient,
    id,
    role,
    username: presentation.username,
    brandName: presentation.brandName,
    roleLabel: presentation.roleLabel,
    displayLabel: presentation.displayLabel,
    name: label,
    label
  };
};

function MessageRow({ message, currentIdentity, onOpen }) {
  const sentByMe =
    Boolean(currentIdentity) &&
    message.senderId === currentIdentity;

  return (
    <button
      type="button"
      onClick={() => onOpen(message)}
      className="group flex w-full items-start gap-3 border-b border-[#EEE7E0] px-4 py-3 text-left transition-colors hover:bg-[#FCFAF7]"
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          message.messageType === 'WORKFLOW'
            ? 'bg-[#F4E9DF] text-[#9B6043]'
            : sentByMe
              ? 'bg-[#272724] text-white'
              : 'bg-[#F1EFEA] text-[#62594F]'
        }`}
      >
        {message.messageType === 'WORKFLOW' ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <UserRound className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-[10px] font-bold text-[#2D2925]">
            {sentByMe
              ? `To: ${recipientNames(message)}`
              : message.senderName}
          </div>
          <div className="shrink-0 text-[8px] text-[#9A8F86]">
            {formatMessageDate(message.createdAt)}
          </div>
        </div>

        <div className="mt-0.5 truncate text-[10px] font-semibold text-[#675D55]">
          {message.subject}
        </div>

        <div className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-[#8B8178]">
          {message.text || 'No message text'}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] ${
              message.messageType === 'WORKFLOW'
                ? 'border-[#E4CEC0] bg-[#FBF2EB] text-[#925D43]'
                : 'border-[#DDD5CC] bg-[#FAF8F5] text-[#766B62]'
            }`}
          >
            {message.messageType === 'WORKFLOW'
              ? 'Workflow · automatic'
              : 'Direct'}
          </span>
          {message.contextLabel && (
            <span className="truncate text-[7px] text-[#9B9087]">
              {message.contextLabel}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="mt-3 h-3.5 w-3.5 shrink-0 text-[#B2A79E] group-hover:text-[#6F655D]" />
    </button>
  );
}

export default function MessageCenterWidget({
  currentUser,
  workflowStorageKey,
  contextLabel = 'Perfect Fit',
  metadata = defaultMetadata,
  recipients: recipientsProp = EMPTY_RECIPIENTS
}) {
  const launcherRef = useRef(null);
  const dragStateRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    return normalizeFloatingToolLayout(
      metadata.storage.widgetLayout,
      'messages',
      metadata.widget.defaultCompact
    ).compact;
  });
  const [position, setPosition] = useState(() => {
    const layout = normalizeFloatingToolLayout(
      metadata.storage.widgetLayout,
      'messages',
      metadata.widget.defaultCompact
    );
    return { x: layout.x, y: layout.y };
  });

  const [directMessages, setDirectMessages] = useState([]);
  const [workflowMessages, setWorkflowMessages] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [view, setView] = useState('inbox');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [filter, setFilter] = useState('all');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [compose, setCompose] = useState({
    recipientIds: [],
    subject: '',
    text: ''
  });

  const currentIdentity = getUserIdentity(currentUser);
  const currentName = getUserDisplayName(currentUser);

  const getLauncherSize = () => {
    return {
      width: isCompact
        ? FLOATING_TOOL_LAUNCHER.compactWidth
        : FLOATING_TOOL_LAUNCHER.width,
      height: FLOATING_TOOL_LAUNCHER.height
    };
  };

  const clampLauncherPosition = (nextPosition) => {
    const { width, height } = getLauncherSize();
    return clampFloatingToolPosition(nextPosition, width, height);
  };

  const persistWidgetLayout = (nextPosition = position, nextCompact = isCompact) => {
    persistFloatingToolLayout(metadata.storage.widgetLayout, {
      x: nextPosition.x,
      y: nextPosition.y,
      compact: nextCompact
    });
  };

  const refresh = () => {
    const direct = safeRead(metadata.storage.directMessages, []);
    setDirectMessages(
      Array.isArray(direct)
        ? direct.map(normalizeDirectMessage)
        : []
    );

    const savedDirectory = safeRead(metadata.storage.directory, []);
    const mergedDirectory = [
      ...metadata.defaultDirectory,
      ...(Array.isArray(savedDirectory) ? savedDirectory : []),
      ...(Array.isArray(recipientsProp) ? recipientsProp : [])
    ];

    const seen = new Set();
    setDirectory(
      mergedDirectory
        .map((recipient) => {
          const id =
            recipient.id ||
            (recipient.email
              ? `user:${String(recipient.email).toLowerCase()}`
              : recipient.role
                ? `role:${String(recipient.role).toLowerCase()}`
                : '');

          return {
            ...recipient,
            id,
            label:
              recipient.label ||
              [
                recipient.fullName || recipient.name || recipient.email || recipient.role,
                recipient.role
              ]
                .filter(Boolean)
                .join(' · ')
          };
        })
        .filter((recipient) => {
          if (!recipient.id) return false;
          if (recipient.id === currentIdentity) return false;
          if (seen.has(recipient.id)) return false;
          seen.add(recipient.id);
          return true;
        })
    );

    if (workflowStorageKey) {
      const raw = safeRead(workflowStorageKey, []);
      setWorkflowMessages(
        toArray(raw).map((message, index) =>
          normalizeWorkflowMessage(message, index, metadata)
        )
      );
    } else {
      setWorkflowMessages([]);
    }
  };

  useEffect(() => {
    refresh();

    const handleStorage = (event) => {
      if (
        !event.key ||
        event.key === metadata.storage.directMessages ||
        event.key === metadata.storage.directory ||
        event.key === workflowStorageKey
      ) {
        refresh();
      }
    };

    window.addEventListener('storage', handleStorage);

    // Existing workflow helpers write localStorage in this same document.
    // Same-document writes do not fire the storage event, so refresh lightly.
    const timer = window.setInterval(refresh, 1500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(timer);
    };
  }, [workflowStorageKey, currentIdentity, recipientsProp, metadata]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        const next = clampLauncherPosition(current);
        persistWidgetLayout(next, isCompact);
        return next;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCompact]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = dragStateRef.current;
      if (!drag) return;

      const next = clampLauncherPosition({
        x: drag.originX + (event.clientX - drag.pointerX),
        y: drag.originY + (event.clientY - drag.pointerY)
      });

      setPosition(next);
    };

    const handlePointerUp = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      setPosition((current) => {
        persistWidgetLayout(current, isCompact);
        return current;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isCompact]);

  const startDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: position.x,
      originY: position.y
    };
  };

  const visibleDirectMessages = useMemo(() => {
    if (!currentIdentity && !currentUser?.role) return [];

    const role = String(currentUser?.role || '').toLowerCase();
    const roleIdentities = new Set(
      [
        role ? `role:${role}` : '',
        ['designer', 'collaborator'].includes(role) ? 'role:designer' : '',
        ['designer', 'collaborator'].includes(role) ? 'role:collaborator' : ''
      ].filter(Boolean)
    );

    return directMessages.filter((message) => {
      const recipientMatch = (message.recipients || []).some(
        (recipient) =>
          recipient.id === currentIdentity ||
          roleIdentities.has(recipient.id) ||
          roleIdentities.has(`role:${String(recipient.role || '').toLowerCase()}`)
      );

      return (
        message.senderId === currentIdentity ||
        roleIdentities.has(message.senderId) ||
        recipientMatch
      );
    });
  }, [directMessages, currentIdentity, currentUser?.role]);

  const visibleWorkflowMessages = useMemo(() => {
    const role = String(currentUser?.role || '').toLowerCase();

    if (
      ['administrator', 'moderator', 'collaborator', 'designer'].includes(role)
    ) {
      return workflowMessages;
    }

    return [];
  }, [workflowMessages, currentUser?.role]);

  const combinedMessages = useMemo(() => {
    const messages = [
      ...(filter === 'workflow' ? [] : visibleDirectMessages),
      ...(filter === 'direct' ? [] : visibleWorkflowMessages)
    ];

    return messages.sort(
      (a, b) =>
        new Date(b.createdAt || 0) -
        new Date(a.createdAt || 0)
    );
  }, [filter, visibleDirectMessages, visibleWorkflowMessages]);

  const selectedRecipients = useMemo(
    () =>
      compose.recipientIds
        .map((id) => directory.find((recipient) => recipient.id === id))
        .filter(Boolean),
    [compose.recipientIds, directory]
  );

  const recipientSuggestions = useMemo(() => {
    const query = recipientQuery.trim().toLowerCase();
    if (query.length < metadata.recipientPicker.minQueryLength) return [];

    return directory
      .filter((recipient) => !compose.recipientIds.includes(recipient.id))
      .filter((recipient) => {
        const haystack = [
          recipient.fullName,
          recipient.name,
          recipient.email,
          recipient.role,
          recipient.label
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, metadata.recipientPicker.maxVisibleSuggestions);
  }, [directory, compose.recipientIds, recipientQuery, metadata]);

  const addRecipient = (recipient) => {
    if (!recipient?.id || compose.recipientIds.includes(recipient.id)) return;

    setCompose((current) => ({
      ...current,
      recipientIds: [...current.recipientIds, recipient.id]
    }));
    setRecipientQuery('');
    setRecipientPickerOpen(false);
  };

  const removeRecipient = (recipientId) => {
    setCompose((current) => ({
      ...current,
      recipientIds: current.recipientIds.filter((id) => id !== recipientId)
    }));
  };

  const resetCompose = (preset = {}) => {
    setCompose({
      recipientIds: Array.isArray(preset.recipientIds)
        ? preset.recipientIds.filter(Boolean)
        : [],
      subject: preset.subject || '',
      text: ''
    });
    setRecipientQuery('');
    setRecipientPickerOpen(false);
  };

  const startCompose = (preset = {}) => {
    setSelectedMessage(null);
    resetCompose(preset);
    setView('compose');
  };

  useEffect(() => {
    const handleExternalCompose = (event) => {
      if (!currentIdentity && !currentUser?.role) {
        window.showToast?.(
          'Sign in before sending a message.',
          'warning',
          'Messaging'
        );
        return;
      }

      const detail = event.detail || {};
      const recipient = normalizeRecipientEntry(
        detail.recipient ||
        detail.to ||
        detail.recipientProfile ||
        {}
      );

      if (!recipient.id) {
        window.showToast?.(
          'This pattern does not expose a messageable designer.',
          'warning',
          'Messaging'
        );
        return;
      }

      const savedDirectory = safeRead(metadata.storage.directory, []);
      if (
        Array.isArray(savedDirectory) &&
        !savedDirectory.some((entry) => normalizeRecipientEntry(entry).id === recipient.id)
      ) {
        safeWrite(metadata.storage.directory, [...savedDirectory, recipient]);
      }

      setDirectory((current) => {
        const existingIndex = current.findIndex((entry) => entry.id === recipient.id);

        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = { ...next[existingIndex], ...recipient };
          return next;
        }

        return [...current, recipient];
      });

      setSelectedMessage(null);
      setCompose({
        recipientIds: [recipient.id],
        subject: detail.subject || '',
        text: ''
      });
      setRecipientQuery('');
      setRecipientPickerOpen(false);
      setIsOpen(true);
      setView('compose');
    };

    window.addEventListener('perfectfit:message-compose', handleExternalCompose);

    return () => {
      window.removeEventListener('perfectfit:message-compose', handleExternalCompose);
    };
  }, [currentIdentity, currentUser?.role]);

  const openMessage = (message) => {
    setSelectedMessage(message);
    setView('message');
  };

  const sendMessage = () => {
    if (!currentIdentity && !currentUser?.role) {
      window.showToast?.(
        'Sign in before sending a message.',
        'warning',
        'Messaging'
      );
      return;
    }

    if (!selectedRecipients.length || !compose.text.trim()) {
      window.showToast?.(
        'Add at least one recipient and enter a message.',
        'warning',
        'Message not sent'
      );
      return;
    }

    const recipients = selectedRecipients.map((recipient) => ({
      id: recipient.id,
      name:
        recipient.fullName ||
        recipient.name ||
        recipient.label ||
        recipient.email ||
        recipient.role,
      role: recipient.role || '',
      email: recipient.email || ''
    }));

    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      messageType: 'DIRECT',
      senderId:
        currentIdentity ||
        `role:${String(currentUser?.role || 'user').toLowerCase()}`,
      senderName: currentName,
      senderRole: currentUser?.role || '',
      recipients,
      // Backward-compatible primary recipient fields.
      recipientId: recipients[0]?.id || '',
      recipientName: recipients[0]?.name || '',
      recipientRole: recipients[0]?.role || '',
      subject: compose.subject.trim() || '(No subject)',
      text: compose.text.trim(),
      contextLabel,
      createdAt: new Date().toISOString()
    };

    const existing = safeRead(metadata.storage.directMessages, []);
    const next = [message, ...(Array.isArray(existing) ? existing : [])];

    safeWrite(metadata.storage.directMessages, next);
    setDirectMessages(next.map(normalizeDirectMessage));
    setSelectedMessage(normalizeDirectMessage(message));
    setView('message');

    window.showToast?.(
      `Message sent to ${recipients.map((recipient) => recipient.name).join(', ')}.`,
      'success',
      'Message sent'
    );
  };

  const replyToSelected = () => {
    if (!selectedMessage) return;

    if (selectedMessage.messageType === 'WORKFLOW') {
      window.showToast?.(
        'Use the approval/release Message action to reply inside the protected workflow thread.',
        'info',
        'Workflow message'
      );
      return;
    }

    const sentByMe = selectedMessage.senderId === currentIdentity;
    if (!sentByMe && selectedMessage.senderId) {
      const senderRecipient = normalizeRecipientEntry({
        id: selectedMessage.senderId,
        name: selectedMessage.senderName,
        role: selectedMessage.senderRole || ''
      });

      if (senderRecipient.id) {
        const savedDirectory = safeRead(metadata.storage.directory, []);
        if (
          Array.isArray(savedDirectory) &&
          !savedDirectory.some((entry) => normalizeRecipientEntry(entry).id === senderRecipient.id)
        ) {
          safeWrite(metadata.storage.directory, [...savedDirectory, senderRecipient]);
        }

        setDirectory((current) => {
          if (current.some((entry) => entry.id === senderRecipient.id)) return current;
          return [...current, senderRecipient];
        });
      }
    }

    const recipientIds = sentByMe
      ? (selectedMessage.recipients || [])
          .map((recipient) => recipient.id)
          .filter((id) => id && id !== currentIdentity)
      : [selectedMessage.senderId].filter(Boolean);

    startCompose({
      recipientIds,
      subject: selectedMessage.subject?.toLowerCase().startsWith('re:')
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`
    });
  };

  const toggleCompact = (event) => {
    event.stopPropagation();
    const nextCompact = !isCompact;
    setIsCompact(nextCompact);

    window.requestAnimationFrame(() => {
      setPosition((current) => {
        const next = clampLauncherPosition(current);
        persistWidgetLayout(next, nextCompact);
        return next;
      });
    });
  };

  const launcherSize = getLauncherSize();
  const panelWidth = Math.min(
    metadata.widget.panelWidth,
    Math.max(320, window.innerWidth - metadata.widget.edgePadding * 2)
  );
  const panelHeight = Math.min(
    metadata.widget.panelHeight,
    Math.max(380, window.innerHeight - metadata.widget.edgePadding * 2)
  );

  const panelPosition = {
    x: clamp(
      position.x - panelWidth + launcherSize.width,
      metadata.widget.edgePadding,
      Math.max(metadata.widget.edgePadding, window.innerWidth - panelWidth - metadata.widget.edgePadding)
    ),
    y: clamp(
      position.y - panelHeight + launcherSize.height,
      metadata.widget.edgePadding,
      Math.max(metadata.widget.edgePadding, window.innerHeight - panelHeight - metadata.widget.edgePadding)
    )
  };

  if (isOpen) {
    return (
      <aside
        className="fixed flex flex-col overflow-hidden rounded-[18px] border border-[#D8D0C7] bg-[#FFFDF9] shadow-[0_24px_65px_rgba(39,39,36,0.22)]"
        style={{
          left: panelPosition.x,
          top: panelPosition.y,
          width: panelWidth,
          height: panelHeight,
          zIndex: UI_LAYERS.utilityPanel
        }}
        id="perfectfit-message-center"
        aria-label={pfUiT("ui.components.messagecenterwidget.d53e20f5bb")}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E7E0D8] bg-[#FCFAF6] px-3 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onPointerDown={startDrag}
              className="flex h-8 w-6 cursor-grab items-center justify-center rounded-md text-[#9B9087] hover:bg-[#F0EBE5] active:cursor-grabbing"
              title={pfUiT("ui.components.messagecenterwidget.7d698d10a0")}
              aria-label={pfUiT("ui.components.messagecenterwidget.3ede265f0d")}
            >
              <GripVertical className="h-4 w-4" />
            </button>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#272724] text-white">
              <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
            </div>

            <div className="min-w-0 leading-tight">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#2D2925]">{pfUiT("ui.components.messagecenterwidget.4462cb6bad")}</div>
              <div className="mt-0.5 truncate text-[9px] text-[#8B8178]">
                {contextLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {view !== 'compose' && (
              <button
                type="button"
                onClick={() => startCompose()}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#272724] px-3 text-[9px] font-bold text-white hover:bg-[#1F1F1D]"
              >
                <PenLine className="h-3 w-3" />{pfUiT("ui.components.messagecenterwidget.7a03ff2144")}</button>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#746A62] hover:bg-[#F0EBE5] hover:text-[#272724]"
              aria-label={pfUiT("ui.components.messagecenterwidget.3fcc8d16cb")}
              title={pfUiT("ui.components.messagecenterwidget.1291a98508")}
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {view === 'inbox' && (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#EEE7E0] bg-white px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <Inbox className="h-3.5 w-3.5 text-[#766B62]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#62584F]">{pfUiT("ui.components.messagecenterwidget.48b7857dd1")}</span>
              </div>

              <div className="flex rounded-full border border-[#E3DAD1] bg-[#FAF8F5] p-0.5">
                {[
                  ['all', 'All'],
                  ['direct', 'Direct'],
                  ['workflow', 'Workflow']
                ].map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setFilter(code)}
                    className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${
                      filter === code
                        ? 'bg-white text-[#2D2925] shadow-sm'
                        : 'text-[#8A7F76]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              {combinedMessages.length > 0 ? (
                combinedMessages.map((message) => (
                  <MessageRow
                    key={`${message.messageType}-${message.id}`}
                    message={message}
                    currentIdentity={currentIdentity}
                    onOpen={openMessage}
                  />
                ))
              ) : (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-8 text-center">
                  <MessageCircle className="h-8 w-8 text-[#B56C4C]" strokeWidth={1.5} />
                  <div className="mt-3 text-[12px] font-semibold text-[#2D2925]">{pfUiT("ui.components.messagecenterwidget.e636544a58")}</div>
                  <p className="mt-1.5 max-w-[270px] text-[10px] leading-relaxed text-[#81766D]">{pfUiT("ui.components.messagecenterwidget.f4c8a0ce02")}</p>
                  <button
                    type="button"
                    onClick={() => startCompose()}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#272724] px-4 py-2 text-[9px] font-bold text-white"
                  >
                    <PenLine className="h-3 w-3" />{pfUiT("ui.components.messagecenterwidget.7a03ff2144")}</button>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'compose' && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="flex items-center gap-2 border-b border-[#EEE7E0] px-4 py-2.5">
              <button
                type="button"
                onClick={() => setView('inbox')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#70665D] hover:bg-[#F4F0EB]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="text-[10px] font-bold text-[#2D2925]">{pfUiT("ui.components.messagecenterwidget.7a03ff2144")}</div>
                <div className="text-[8px] text-[#90857C]">{pfUiT("ui.components.messagecenterwidget.5fe49821c0")}</div>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div className="relative">
                <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-[#8A786A]">{pfUiT("ui.components.messagecenterwidget.76491a7ef7")}</span>

                <div
                  className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-[10px] border border-[#D7CDC4] bg-white px-2 py-1.5 focus-within:border-[#B56C4C]"
                  onClick={() => setRecipientPickerOpen(true)}
                >
                  {selectedRecipients.map((recipient) => (
                    <span
                      key={recipient.id}
                      className="inline-flex max-w-[210px] items-center gap-1 rounded-full border border-[#DCCFC4] bg-[#F8F2EC] py-1 pl-2 pr-1 text-[8px] font-semibold text-[#654F42]"
                    >
                      <span className="truncate">
                        {recipient.fullName || recipient.name || recipient.email || recipient.role}
                      </span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeRecipient(recipient.id);
                        }}
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-[#EADDD2]"
                        aria-label={`Remove ${recipient.label}`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}

                  <div className="flex min-w-[150px] flex-1 items-center gap-1.5 px-1">
                    <Search className="h-3.5 w-3.5 shrink-0 text-[#A69A91]" />
                    <input
                      value={recipientQuery}
                      onFocus={() => setRecipientPickerOpen(true)}
                      onChange={(event) => {
                        setRecipientQuery(event.target.value);
                        setRecipientPickerOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Backspace' &&
                          !recipientQuery &&
                          compose.recipientIds.length
                        ) {
                          removeRecipient(compose.recipientIds[compose.recipientIds.length - 1]);
                        }

                        if (event.key === 'Enter' && recipientSuggestions.length === 1) {
                          event.preventDefault();
                          addRecipient(recipientSuggestions[0]);
                        }
                      }}
                      placeholder={selectedRecipients.length ? 'Add another recipient…' : 'Start typing a name, email or role…'}
                      className="w-full border-0 bg-transparent py-1.5 text-[10px] text-[#3E352F] outline-none placeholder:text-[#A59A91]"
                    />
                  </div>
                </div>

                {recipientPickerOpen && recipientQuery.trim() && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[210px] overflow-y-auto rounded-[10px] border border-[#D7CDC4] bg-white p-1.5 shadow-[0_14px_36px_rgba(39,39,36,0.16)]">
                    {recipientSuggestions.length ? (
                      recipientSuggestions.map((recipient) => (
                        <button
                          key={recipient.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => addRecipient(recipient)}
                          className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left hover:bg-[#F7F3EE]"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1ECE6] text-[#766354]">
                            <UserRound className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[9px] font-bold text-[#342E29]">
                              {recipient.fullName || recipient.name || recipient.email || recipient.role}
                            </div>
                            <div className="truncate text-[8px] text-[#90857C]">
                              {[recipient.email, recipient.role].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-[9px] text-[#92877E]">{pfUiT("ui.components.messagecenterwidget.83e7d2721a")}</div>
                    )}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-[#8A786A]">{pfUiT("ui.components.messagecenterwidget.4ed9e64755")}</span>
                <input
                  value={compose.subject}
                  onChange={(event) =>
                    setCompose((current) => ({ ...current, subject: event.target.value }))
                  }
                  placeholder={pfUiT("ui.components.messagecenterwidget.14e9d74581")}
                  className="w-full rounded-[10px] border border-[#D7CDC4] bg-white px-3 py-2.5 text-[10px] text-[#3E352F] outline-none focus:border-[#B56C4C]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.08em] text-[#8A786A]">{pfUiT("ui.components.messagecenterwidget.21098e4372")}</span>
                <textarea
                  rows={8}
                  value={compose.text}
                  onChange={(event) =>
                    setCompose((current) => ({ ...current, text: event.target.value }))
                  }
                  placeholder={pfUiT("ui.components.messagecenterwidget.84e94fee8e")}
                  className="w-full resize-none rounded-[10px] border border-[#D7CDC4] bg-white px-3 py-2.5 text-[10px] leading-relaxed text-[#3E352F] outline-none focus:border-[#B56C4C]"
                />
              </label>

              <div className="rounded-[10px] border border-[#E7DED5] bg-[#FAF8F5] px-3 py-2 text-[8px] leading-relaxed text-[#82766D]">{pfUiT("ui.components.messagecenterwidget.4eef2cecd0")}</div>
            </div>

            <div className="sticky bottom-0 flex justify-end border-t border-[#EEE7E0] bg-[#FCFAF7] px-4 py-3">
              <button
                type="button"
                onClick={sendMessage}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#272724] px-4 py-2 text-[9px] font-bold text-white hover:bg-[#1F1F1D]"
              >
                <Send className="h-3.5 w-3.5" />{pfUiT("ui.components.messagecenterwidget.9daa2c3774")}</button>
            </div>
          </div>
        )}

        {view === 'message' && selectedMessage && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            <div className="flex items-center gap-2 border-b border-[#EEE7E0] px-4 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedMessage(null);
                  setView('inbox');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#70665D] hover:bg-[#F4F0EB]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-bold text-[#2D2925]">
                  {selectedMessage.subject}
                </div>
                <div className="mt-0.5 text-[8px] text-[#90857C]">
                  {selectedMessage.messageType === 'WORKFLOW'
                    ? 'Protected workflow message'
                    : 'Direct message'}
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="rounded-[12px] border border-[#E3DAD1] bg-[#FCFAF7] p-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      selectedMessage.messageType === 'WORKFLOW'
                        ? 'bg-[#F4E9DF] text-[#955D42]'
                        : 'bg-[#272724] text-white'
                    }`}
                  >
                    {selectedMessage.messageType === 'WORKFLOW' ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-[#2D2925]">
                      {selectedMessage.senderName}
                    </div>
                    <div className="mt-0.5 text-[8px] text-[#8D8178]">
                      To {recipientNames(selectedMessage)}
                    </div>
                    <div className="mt-0.5 text-[8px] text-[#A0968D]">
                      {formatMessageDate(selectedMessage.createdAt)}
                    </div>
                  </div>

                  {selectedMessage.messageType === 'WORKFLOW' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#E2CDBF] bg-[#FBF1EA] px-2 py-1 text-[7px] font-bold uppercase text-[#915A41]">
                      <ShieldCheck className="h-3 w-3" />{pfUiT("ui.components.messagecenterwidget.afc49870f5")}</span>
                  )}
                </div>

                <div className="mt-4 whitespace-pre-wrap text-[10px] leading-[1.65] text-[#574D46]">
                  {selectedMessage.text || 'No message text'}
                </div>

                {selectedMessage.contextLabel && (
                  <div className="mt-4 border-t border-[#E8E0D9] pt-2 text-[8px] text-[#8D8178]">
                    {selectedMessage.contextLabel}
                  </div>
                )}
              </div>

              {selectedMessage.messageType === 'WORKFLOW' ? (
                <div className="mt-3 rounded-[10px] border border-[#E5D3C5] bg-[#FFF8F2] px-3 py-2 text-[8px] leading-relaxed text-[#765C4B]">{pfUiT("ui.components.messagecenterwidget.6d0b8599b4")}</div>
              ) : (
                <button
                  type="button"
                  onClick={replyToSelected}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#D8CFC6] bg-white px-3 py-2 text-[9px] font-bold text-[#5F554D] hover:bg-[#FAF7F3]"
                >
                  <Reply className="h-3.5 w-3.5" />{pfUiT("ui.components.messagecenterwidget.c2cb4da4ee")}</button>
              )}
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between border-t border-[#E7E0D8] bg-[#FCFAF6] px-4 py-2">
          <div className="flex items-center gap-1 text-[7px] uppercase tracking-[0.08em] text-[#9B9087]">
            <Check className="h-3 w-3 text-emerald-600" />{pfUiT("ui.components.messagecenterwidget.25843c072f")}</div>
          <div className="text-[7px] text-[#A69C93]">{currentName}</div>
        </div>
      </aside>
    );
  }

  return (
    <div
      ref={launcherRef}
      className="fixed flex items-center overflow-hidden rounded-full bg-[#272724] text-white shadow-[0_18px_42px_rgba(39,39,36,0.24)]"
      style={{
        left: position.x,
        top: position.y,
        width: isCompact
          ? FLOATING_TOOL_LAUNCHER.compactWidth
          : FLOATING_TOOL_LAUNCHER.width,
        height: FLOATING_TOOL_LAUNCHER.height,
        zIndex: UI_LAYERS.floatingLauncher
      }}
      id="perfectfit-message-launcher"
    >
      <button
        type="button"
        onPointerDown={startDrag}
        className="flex h-14 w-7 cursor-grab items-center justify-center rounded-l-full text-white/55 hover:bg-white/5 hover:text-white/85 active:cursor-grabbing"
        title={pfUiT("ui.components.messagecenterwidget.8d74068f27")}
        aria-label={pfUiT("ui.components.messagecenterwidget.d004eb4a81")}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setView('inbox');
        }}
        className={`inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2.5 hover:bg-[#1F1F1D] ${
          isCompact ? 'px-0' : 'px-3.5'
        }`}
        title={pfUiT("ui.components.messagecenterwidget.7785135b72")}
        aria-label={pfUiT("ui.components.messagecenterwidget.8d90058f66")}
      >
        <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={1.8} />
        {!isCompact && (
          <span className="text-[12px] font-semibold tracking-[-0.01em]">{pfUiT("ui.components.messagecenterwidget.4462cb6bad")}</span>
        )}
      </button>

      <button
        type="button"
        onClick={toggleCompact}
        className="flex h-14 w-8 items-center justify-center rounded-r-full border-l border-white/10 text-white/65 hover:bg-white/5 hover:text-white"
        title={isCompact ? 'Expand Messages button' : 'Collapse Messages button'}
        aria-label={isCompact ? 'Expand Messages button' : 'Collapse Messages button'}
      >
        {isCompact ? (
          <ChevronLeft className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
