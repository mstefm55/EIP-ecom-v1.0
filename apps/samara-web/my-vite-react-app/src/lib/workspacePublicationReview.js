import { runtimeDataStorage } from './runtimeDataGateway';
export const PUBLICATION_MESSAGE_EVENT =
  'perfectfit_publication_messages_updated';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeStatus(status) {
  return status || 'NOT_READY';
}

function walkWorkspace(
  nodes = [],
  context = {},
  output = []
) {
  nodes.forEach((node) => {
    const nextContext = {
      ...context
    };

    if (node.nodeType === 'project') {
      nextContext.project = node;
    }

    if (node.nodeType === 'product') {
      nextContext.style = node;
    }

    if (node.nodeType === 'variant') {
      nextContext.variant = node;

      output.push({
        project:
          nextContext.project ||
          null,
        style:
          nextContext.style ||
          null,
        variant:
          node
      });
    }

    if (
      Array.isArray(
        node.children
      ) &&
      node.children.length
    ) {
      walkWorkspace(
        node.children,
        nextContext,
        output
      );
    }
  });

  return output;
}

export function getWorkspaceVariantContexts(
  workspaceData
) {
  return walkWorkspace(
    workspaceData?.projects || []
  );
}

function presentationMatchesVariant(
  presentation,
  variant
) {
  if (
    !presentation ||
    !variant
  ) {
    return false;
  }

  const variantCode =
    variant.values?.[
      'variant.code'
    ] ||
    '';

  const candidateIds = [
    presentation.workspaceVariantId,
    presentation.variantId,
    presentation.variant?.id
  ].filter(Boolean);

  if (
    candidateIds.some(
      (candidate) =>
        String(candidate) ===
        String(variant.id)
    )
  ) {
    return true;
  }

  const candidateCodes = [
    presentation.variantCode,
    presentation.workspaceVariantCode,
    presentation.variant?.code
  ].filter(Boolean);

  return Boolean(
    variantCode &&
    candidateCodes.some(
      (candidate) =>
        String(candidate) ===
        String(variantCode)
    )
  );
}

export function getPublicationStatusByVariant(
  workspaceData
) {
  const map = new Map();

  getWorkspaceVariantContexts(
    workspaceData
  ).forEach(
    ({ variant }) => {
      const publication =
        variant.values
          ?.publicationRelease ||
        {};

      const status =
        normalizeStatus(
          publication.status
        );

      map.set(
        String(variant.id),
        status
      );

      const variantCode =
        variant.values?.[
          'variant.code'
        ];

      if (variantCode) {
        map.set(
          `code:${variantCode}`,
          status
        );
      }
    }
  );

  return map;
}

export function resolvePresentationPublicationStatus(
  presentation,
  statusMap
) {
  if (!presentation) {
    return null;
  }

  const candidateIds = [
    presentation.workspaceVariantId,
    presentation.variantId,
    presentation.variant?.id
  ].filter(Boolean);

  for (
    const candidate of
    candidateIds
  ) {
    const status =
      statusMap.get(
        String(candidate)
      );

    if (status) {
      return status;
    }
  }

  const candidateCodes = [
    presentation.variantCode,
    presentation.workspaceVariantCode,
    presentation.variant?.code
  ].filter(Boolean);

  for (
    const candidate of
    candidateCodes
  ) {
    const status =
      statusMap.get(
        `code:${candidate}`
      );

    if (status) {
      return status;
    }
  }

  return null;
}

function getPresentationAliases(
  presentation
) {
  return [
    presentation?.id,
    presentation?.commercePatternId,
    presentation?.legacyPatternId,
    presentation?.sourcePatternId,
    presentation?.legacyId
  ]
    .filter(Boolean)
    .map(String);
}

export function filterPublishedProductPresentations({
  mergedPatterns = [],
  workspacePresentations = [],
  workspaceData
}) {
  const statusMap =
    getPublicationStatusByVariant(
      workspaceData
    );

  const controlledAliases =
    new Map();

  workspacePresentations.forEach(
    (presentation) => {
      const status =
        resolvePresentationPublicationStatus(
          presentation,
          statusMap
        ) ||
        'NOT_READY';

      getPresentationAliases(
        presentation
      ).forEach(
        (alias) => {
          controlledAliases.set(
            alias,
            status
          );
        }
      );
    }
  );

  return mergedPatterns.filter(
    (pattern) => {
      const directStatus =
        resolvePresentationPublicationStatus(
          pattern,
          statusMap
        );

      if (directStatus) {
        return (
          directStatus ===
          'PUBLISHED'
        );
      }

      const aliases =
        getPresentationAliases(
          pattern
        );

      const controlledStatus =
        aliases
          .map(
            (alias) =>
              controlledAliases.get(
                alias
              )
          )
          .find(Boolean);

      if (controlledStatus) {
        return (
          controlledStatus ===
          'PUBLISHED'
        );
      }

      return true;
    }
  );
}

export function buildPublicationReviewRequests({
  workspaceData,
  workspacePresentations = []
}) {
  return getWorkspaceVariantContexts(
    workspaceData
  )
    .map(
      ({
        project,
        style,
        variant
      }) => {
        const publication =
          variant.values
            ?.publicationRelease ||
          {};

        if (
          !publication.requestId
        ) {
          return null;
        }

        const pattern =
          workspacePresentations.find(
            (presentation) =>
              presentationMatchesVariant(
                presentation,
                variant
              )
          ) ||
          null;

        return {
          id:
            publication.requestId,
          requestId:
            publication.requestId,
          status:
            normalizeStatus(
              publication.status
            ),
          variantId:
            variant.id,
          variantCode:
            variant.values?.[
              'variant.code'
            ] ||
            '',
          variantName:
            variant.values?.[
              'variant.name'
            ] ||
            variant.title ||
            'Variant',
          styleId:
            style?.id ||
            null,
          styleCode:
            style?.values?.[
              'product.style_code'
            ] ||
            '',
          styleName:
            style?.values?.[
              'product.style_name'
            ] ||
            style?.title ||
            pattern?.name ||
            'Product',
          projectId:
            project?.id ||
            null,
          projectName:
            project?.values?.[
              'project.name'
            ] ||
            project?.title ||
            '',
          submittedAt:
            publication.requestedAt ||
            publication.workflow
              ?.requestedAt ||
            publication.workflow
              ?.submittedAt ||
            null,
          submittedBy:
            publication.requestedBy ||
            publication.workflow
              ?.requestedBy ||
            publication.workflow
              ?.submittedBy ||
            null,
          moderatorNote:
            publication.moderatorNote ||
            '',
          publishedAt:
            publication.workflow
              ?.publishedAt ||
            publication.publishedAt ||
            null,
          publishedBy:
            publication.workflow
              ?.publishedBy ||
            publication.publishedBy ||
            null,
          pattern
        };
      }
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(
          b.submittedAt ||
            0
        ).getTime() -
        new Date(
          a.submittedAt ||
            0
        ).getTime()
    );
}

function updateNodeById(
  nodes = [],
  nodeId,
  updater
) {
  return nodes.map(
    (node) => {
      if (
        node.id === nodeId
      ) {
        return updater(node);
      }

      if (
        node.children?.length
      ) {
        return {
          ...node,
          children:
            updateNodeById(
              node.children,
              nodeId,
              updater
            )
        };
      }

      return node;
    }
  );
}

function normalizeActor(
  actor
) {
  return {
    id:
      actor?.id ||
      actor?.identity_id ||
      actor?.userId ||
      actor?.email ||
      'moderator',

    name:
      actor?.fullName ||
      actor?.displayName ||
      actor?.name ||
      actor?.email ||
      'Moderator',

    login:
      actor?.email ||
      actor?.login ||
      actor?.username ||
      ''
  };
}

export function applyPublicationTransition({
  workspaceData,
  variantId,
  transition,
  actor,
  moderatorNote = ''
}) {
  if (
    !workspaceData ||
    !variantId ||
    !transition?.to
  ) {
    return workspaceData;
  }

  const eventActor =
    normalizeActor(actor);

  const now =
    new Date().toISOString();

  return {
    ...workspaceData,

    projects:
      updateNodeById(
        workspaceData.projects ||
          [],
        variantId,
        (variant) => {
          const current =
            variant.values
              ?.publicationRelease ||
            {};

          const previousStatus =
            normalizeStatus(
              current.status
            );

          const event = {
            id:
              `publication-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            action:
              transition.code,
            from:
              previousStatus,
            to:
              transition.to,
            actor:
              eventActor,
            at:
              now
          };

          const workflow = {
            ...(current.workflow ||
              {}),
            status:
              transition.to,
            history: [
              ...(current.workflow
                ?.history ||
                []),
              event
            ]
          };

          if (
            transition.code ===
            'MODERATOR_RETURN'
          ) {
            workflow.moderatorReturnedAt =
              now;
            workflow.moderatorReturnedBy =
              eventActor;
          }

          if (
            transition.code ===
              'MODERATOR_PUBLISH' ||
            transition.code ===
              'REPUBLISH'
          ) {
            workflow.publishedAt =
              now;
            workflow.publishedBy =
              eventActor;
          }

          if (
            transition.code ===
            'UNPUBLISH'
          ) {
            workflow.unpublishedAt =
              now;
            workflow.unpublishedBy =
              eventActor;
          }

          return {
            ...variant,
            values: {
              ...(variant.values ||
                {}),
              publicationRelease: {
                ...current,
                status:
                  transition.to,
                moderatorNote:
                  transition.code ===
                  'MODERATOR_RETURN'
                    ? moderatorNote
                    : transition.code ===
                        'MODERATOR_PUBLISH'
                    ? ''
                    : current.moderatorNote ||
                      '',
                workflow,
                updatedAt:
                  now
              }
            }
          };
        }
      )
  };
}

export function persistWorkspacePublicationData({
  workspaceData,
  storageKey,
  eventName
}) {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  runtimeDataStorage.setItem(
    storageKey,
    JSON.stringify(
      workspaceData
    )
  );

  if (eventName) {
    window.dispatchEvent(
      new CustomEvent(
        eventName,
        {
          detail: {
            source:
              'MODERATOR_PUBLICATION_REVIEW'
          }
        }
      )
    );
  }
}

function publicationThreadId(
  requestId
) {
  return `PUBLICATION_RELEASE:${requestId}`;
}

export function appendPublicationMessage({
  storageKey,
  request,
  senderType,
  sender,
  text
}) {
  if (
    typeof window ===
      'undefined' ||
    !request?.requestId ||
    !String(text || '').trim()
  ) {
    return;
  }

  let threads = [];

  try {
    const parsed =
      JSON.parse(
        runtimeDataStorage.getItem(
          storageKey
        ) ||
        '[]'
      );

    threads =
      Array.isArray(parsed)
        ? parsed
        : [];
  } catch {
    threads = [];
  }

  const threadId =
    publicationThreadId(
      request.requestId
    );

  const now =
    new Date().toISOString();

  const actor =
    normalizeActor(sender);

  const message = {
    id:
      `message-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    senderType,
    sender:
      actor,
    text:
      String(text).trim(),
    createdAt:
      now
  };

  const existing =
    threads.find(
      (thread) =>
        thread.id ===
        threadId
    );

  const context = {
    contextType:
      'PUBLICATION_RELEASE',
    contextLabel:
      'Publication review',
    requestId:
      request.requestId,
    variantId:
      request.variantId,
    styleId:
      request.styleId ||
      null,
    projectId:
      request.projectId ||
      null,
    title:
      request.styleName ||
      request.pattern?.name ||
      'Product publication',
    subtitle:
      request.variantCode ||
      '',
    recipientRole:
      senderType ===
        'MODERATOR'
        ? 'DESIGNER'
        : 'MODERATOR',
    recipientLabel:
      senderType ===
        'MODERATOR'
        ? 'Designer'
        : 'Moderator'
  };

  const nextThreads =
    existing
      ? threads.map(
          (thread) =>
            thread.id ===
            threadId
              ? {
                  ...thread,
                  ...context,
                  messages: [
                    ...(thread.messages ||
                      []),
                    message
                  ],
                  updatedAt:
                    now,
                  unreadCount:
                    senderType ===
                    'MODERATOR'
                      ? Number(
                          thread.unreadCount ||
                            0
                        ) + 1
                      : thread.unreadCount ||
                        0
                }
              : thread
        )
      : [
          {
            id:
              threadId,
            ...context,
            messages: [
              message
            ],
            createdAt:
              now,
            updatedAt:
              now,
            unreadCount:
              senderType ===
              'MODERATOR'
                ? 1
                : 0
          },
          ...threads
        ];

  runtimeDataStorage.setItem(
    storageKey,
    JSON.stringify(
      nextThreads
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      PUBLICATION_MESSAGE_EVENT,
      {
        detail: {
          threadId,
          requestId:
            request.requestId
        }
      }
    )
  );
}

export function getPublicationThread({
  storageKey,
  requestId
}) {
  if (
    typeof window ===
      'undefined' ||
    !requestId
  ) {
    return null;
  }

  try {
    const threads =
      JSON.parse(
        runtimeDataStorage.getItem(
          storageKey
        ) ||
        '[]'
      );

    return (
      Array.isArray(threads)
        ? threads.find(
            (thread) =>
              thread.id ===
              publicationThreadId(
                requestId
              )
          )
        : null
    ) ||
      null;
  } catch {
    return null;
  }
}
