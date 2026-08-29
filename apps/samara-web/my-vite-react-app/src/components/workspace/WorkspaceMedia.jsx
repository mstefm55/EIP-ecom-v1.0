import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  AnimatePresence,
  motion
} from 'motion/react';

import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Crop,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  HelpCircle,
  ImagePlus,
  Images,
  Layers3,
  Lock,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
  ZoomIn
} from 'lucide-react';

import ImageAssetStudioModal from '../ImageAssetStudioModal';
import { createIndexedDbRecordStore } from '../../lib/clientBinaryCache';

const ROLE_ICON_REGISTRY = {
  star: Star,
  technicalSketch: FileText,
  pattern: Layers3
};

const MEDIA_DB_NAME =
  'perfectfit_workspace_assets';

const MEDIA_DB_VERSION = 1;

const MEDIA_STORE_NAME =
  'media_files';

function formatMessage(
  t,
  key,
  values = {}
) {
  let output = t(key);

  Object.entries(values).forEach(
    ([token, value]) => {
      output = output.replaceAll(
        `{${token}}`,
        String(value ?? '')
      );
    }
  );

  return output;
}

function createAssetId() {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `media-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function cleanReferencePart(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9-]+/g,
      '-'
    )
    .replace(
      /^-+|-+$/g,
      ''
    );
}

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function getNextMediaSequence(
  assets,
  prefix
) {
  const safePrefix =
    escapeRegExp(prefix);

  const expression =
    new RegExp(
      `-${safePrefix}-(\\d+)$`
    );

  let maximum = 0;

  assets.forEach((asset) => {
    const match =
      String(
        asset.referenceCode ||
          ''
      ).match(
        expression
      );

    if (!match) {
      return;
    }

    maximum = Math.max(
      maximum,
      Number(match[1]) || 0
    );
  });

  return maximum + 1;
}

function padSequence(
  value,
  padding
) {
  return String(value).padStart(
    padding,
    '0'
  );
}

function getExtension(
  mimeType
) {
  if (
    mimeType === 'image/png'
  ) {
    return 'png';
  }

  if (
    mimeType === 'image/webp'
  ) {
    return 'webp';
  }

  return 'jpg';
}

function buildMediaReferenceCode(
  variant,
  assets,
  referenceConfig
) {
  const variantCode =
    cleanReferencePart(
      variant?.values?.[
        'variant.code'
      ]
    ) || 'VARIANT';

  const prefix =
    referenceConfig
      ?.assetPrefix ||
    'MED';

  const padding =
    referenceConfig
      ?.sequencePadding ||
    3;

  const sequence =
    getNextMediaSequence(
      assets,
      prefix
    );

  return `${variantCode}-${prefix}-${padSequence(
    sequence,
    padding
  )}`;
}

function renameProcessedFile(
  file,
  referenceCode,
  mimeType
) {
  const extension =
    getExtension(mimeType);

  return new File(
    [file],
    `${referenceCode}.${extension}`,
    {
      type:
        mimeType ||
        file.type ||
        'image/jpeg',

      lastModified:
        Date.now()
    }
  );
}

function sanitizeAsset(asset) {
  const {
    file,
    previewUrl,
    ...persistableAsset
  } = asset;

  return persistableAsset;
}

const workspaceMediaBinaryCache = createIndexedDbRecordStore({
  dbName: MEDIA_DB_NAME,
  storeName: MEDIA_STORE_NAME,
  version: MEDIA_DB_VERSION
});

async function saveMediaFile(assetId, file) {
  if (!file) return null;
  return workspaceMediaBinaryCache.put({
    id: assetId,
    file,
    fileName: file.name,
    mimeType: file.type,
    lastModified: file.lastModified
  });
}

export async function loadMediaFile(assetId) {
  const record = await workspaceMediaBinaryCache.get(assetId);
  return record?.file || null;
}

async function removeMediaFile(assetId) {
  return workspaceMediaBinaryCache.remove(assetId);
}

export default function WorkspaceMedia({
  node,
  variant,
  style,
  currentUser,
  metadata,
  t,
  onChange
}) {
  const fileInputRef =
    useRef(null);

  const previewUrlsRef =
    useRef(
      new Map()
    );

  const [
    previewUrls,
    setPreviewUrls
  ] = useState({});

  const assets =
    Array.isArray(
      node?.values?.assets
    )
      ? node.values.assets
      : [];

  const slots = {
    primaryAssetId:
      node?.values?.slots
        ?.primaryAssetId ||
      null,

    technicalSketchAssetId:
      node?.values?.slots
        ?.technicalSketchAssetId ||
      null,

    patternAssetId:
      node?.values?.slots
        ?.patternAssetId ||
      null
  };

  const mediaMetadata =
    metadata.media || {};

  const acceptedTypes =
    mediaMetadata.acceptedTypes || [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

  const assetTypes =
    useMemo(
      () =>
        (
          mediaMetadata.assetTypes ||
          []
        ).map((item) => ({
          ...item,

          label:
            t(item.labelKey)
        })),
      [
        mediaMetadata.assetTypes,
        t
      ]
    );

  const assetRoles =
    useMemo(
      () =>
        (
          mediaMetadata.assetRoles ||
          []
        ).map((item) => ({
          ...item,

          label:
            t(item.labelKey),

          description:
            t(
              item.descriptionKey
            )
        })),
      [
        mediaMetadata.assetRoles,
        t
      ]
    );

  const profiles =
    useMemo(
      () =>
        (
          mediaMetadata.profiles ||
          []
        ).map(
          (profile) => ({
            ...profile,

            label:
              t(
                profile.labelKey
              ),

            description:
              profile.descriptionKey
                ? t(
                    profile.descriptionKey
                  )
                : ''
          })
        ),
      [
        mediaMetadata.profiles,
        t
      ]
    );

  const [
    selectedAssetId,
    setSelectedAssetId
  ] = useState(
    () =>
      assets[0]?.id ||
      null
  );

  const [
    studioOpen,
    setStudioOpen
  ] = useState(false);

  const [
    sourceFile,
    setSourceFile
  ] = useState(null);

  const [
    sourceUrl,
    setSourceUrl
  ] = useState('');

  const [
    editingAssetId,
    setEditingAssetId
  ] = useState(null);

  const [
    selectedProfileId,
    setSelectedProfileId
  ] = useState(
    mediaMetadata.defaultProfileId ||
      'product-gallery'
  );

  const [
    lightboxAsset,
    setLightboxAsset
  ] = useState(null);

  const [
    mediaHelpOpen,
    setMediaHelpOpen
  ] = useState(false);

  const [
    placementHelpOpen,
    setPlacementHelpOpen
  ] = useState(false);

  const [
    visibilityHelpOpen,
    setVisibilityHelpOpen
  ] = useState(false);

  const selectedIndex =
    assets.findIndex(
      (asset) =>
        asset.id ===
        selectedAssetId
    );

  const selectedAsset =
    selectedIndex >= 0
      ? assets[
          selectedIndex
        ]
      : null;

  const styleName =
    style?.values?.[
      'product.style_name'
    ] || '';

  const visibleCount =
    assets.filter(
      (asset) =>
        asset.customerVisible !==
        false
    ).length;

  const internalCount =
    assets.length -
    visibleCount;

  const selectedRoles =
    selectedAsset
      ? assetRoles.filter(
          (role) =>
            slots[
              role.slotKey
            ] ===
            selectedAsset.id
        )
      : [];

  const requiresVisibility =
    selectedRoles.some(
      (role) =>
        role.forcesCustomerVisible
    );

  const getAssetSource = (
    asset
  ) => {
    if (!asset) {
      return '';
    }

    return (
      previewUrls[
        asset.id
      ] ||
      asset.url ||
      ''
    );
  };

  const setAssetPreview = (
    assetId,
    file
  ) => {
    const previousUrl =
      previewUrlsRef.current.get(
        assetId
      );

    if (previousUrl) {
      URL.revokeObjectURL(
        previousUrl
      );
    }

    const nextUrl =
      URL.createObjectURL(
        file
      );

    previewUrlsRef.current.set(
      assetId,
      nextUrl
    );

    setPreviewUrls(
      Object.fromEntries(
        previewUrlsRef.current
      )
    );

    return nextUrl;
  };

  const removeAssetPreview = (
    assetId
  ) => {
    const currentUrl =
      previewUrlsRef.current.get(
        assetId
      );

    if (currentUrl) {
      URL.revokeObjectURL(
        currentUrl
      );
    }

    previewUrlsRef.current.delete(
      assetId
    );

    setPreviewUrls(
      Object.fromEntries(
        previewUrlsRef.current
      )
    );
  };

  const notify = (
    key,
    type = 'success'
  ) => {
    if (
      window.showToast
    ) {
      window.showToast(
        t(key),
        type
      );
    }
  };

  const replaceAssets = (
    nextAssets
  ) => {
    onChange(
      'assets',
      nextAssets
    );
  };

  const replaceSlots = (
    nextSlots
  ) => {
    onChange(
      'slots',
      {
        ...slots,
        ...nextSlots
      }
    );
  };

  const updateAsset = (
    assetId,
    changes
  ) => {
    replaceAssets(
      assets.map(
        (asset) =>
          asset.id ===
          assetId
            ? {
                ...asset,
                ...changes,

                updatedAt:
                  new Date().toISOString()
              }
            : asset
      )
    );
  };

  useEffect(() => {
    if (!assets.length) {
      setSelectedAssetId(
        null
      );

      return;
    }

    if (
      !selectedAssetId ||
      !assets.some(
        (asset) =>
          asset.id ===
          selectedAssetId
      )
    ) {
      setSelectedAssetId(
        assets[0].id
      );
    }
  }, [
    assets,
    selectedAssetId
  ]);

  useEffect(() => {
    setPlacementHelpOpen(
      false
    );

    setVisibilityHelpOpen(
      false
    );
  }, [
    selectedAssetId
  ]);

  useEffect(() => {
    let cancelled =
      false;

    const hydrateFiles =
      async () => {
        let requiresCleanup =
          false;

        for (
          const asset of assets
        ) {
          if (
            previewUrlsRef.current.has(
              asset.id
            )
          ) {
            continue;
          }

          let storedFile =
            null;

          if (
            asset.file instanceof
            Blob
          ) {
            storedFile =
              asset.file;

            try {
              await saveMediaFile(
                asset.id,
                asset.file
              );
            } catch {}
          } else {
            try {
              storedFile =
                await loadMediaFile(
                  asset.id
                );
            } catch {}
          }

          if (
            storedFile &&
            !cancelled
          ) {
            setAssetPreview(
              asset.id,
              storedFile
            );
          }

          if (
            Object.prototype.hasOwnProperty.call(
              asset,
              'file'
            ) ||
            Object.prototype.hasOwnProperty.call(
              asset,
              'previewUrl'
            )
          ) {
            requiresCleanup =
              true;
          }
        }

        if (
          requiresCleanup &&
          !cancelled
        ) {
          replaceAssets(
            assets.map(
              sanitizeAsset
            )
          );
        }
      };

    hydrateFiles();

    return () => {
      cancelled =
        true;
    };
  }, [
    assets
  ]);

  useEffect(() => {
    const validIds =
      new Set(
        assets.map(
          (asset) =>
            asset.id
        )
      );

    Array.from(
      previewUrlsRef.current.keys()
    ).forEach(
      (assetId) => {
        if (
          !validIds.has(
            assetId
          )
        ) {
          const url =
            previewUrlsRef.current.get(
              assetId
            );

          if (url) {
            URL.revokeObjectURL(
              url
            );
          }

          previewUrlsRef.current.delete(
            assetId
          );
        }
      }
    );

    setPreviewUrls(
      Object.fromEntries(
        previewUrlsRef.current
      )
    );
  }, [
    assets.length
  ]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(
        (url) => {
          URL.revokeObjectURL(
            url
          );
        }
      );

      previewUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const assignments = [
      [
        'primaryAssetId',
        slots.primaryAssetId
      ],
      [
        'technicalSketchAssetId',
        slots.technicalSketchAssetId
      ],
      [
        'patternAssetId',
        slots.patternAssetId
      ]
    ];

    const byAsset =
      new Map();

    assignments.forEach(
      ([slotKey, assetId]) => {
        if (!assetId) {
          return;
        }

        const current =
          byAsset.get(
            assetId
          ) || [];

        current.push(
          slotKey
        );

        byAsset.set(
          assetId,
          current
        );
      }
    );

    const nextSlots = {
      ...slots
    };

    let changed =
      false;

    byAsset.forEach(
      (slotKeys) => {
        if (
          slotKeys.length <= 1
        ) {
          return;
        }

        const keepSlot =
          slotKeys.includes(
            'primaryAssetId'
          )
            ? 'primaryAssetId'
            : slotKeys[0];

        slotKeys.forEach(
          (slotKey) => {
            if (
              slotKey !==
              keepSlot
            ) {
              nextSlots[
                slotKey
              ] = null;

              changed =
                true;
            }
          }
        );
      }
    );

    if (changed) {
      onChange(
        'slots',
        nextSlots
      );
    }
  }, [
    slots.primaryAssetId,
    slots.technicalSketchAssetId,
    slots.patternAssetId,
    onChange
  ]);

  const openFilePicker =
    () => {
      fileInputRef.current?.click();
    };

  const handleFileSelected =
    (event) => {
      const file =
        event.target.files?.[0];

      event.target.value = '';

      if (!file) {
        return;
      }

      if (
        !acceptedTypes.includes(
          file.type
        )
      ) {
        notify(
          'media.toast.unsupported',
          'warning'
        );

        return;
      }

      setEditingAssetId(
        null
      );

      setSourceFile(
        file
      );

      setSourceUrl('');

      setSelectedProfileId(
        mediaMetadata.defaultProfileId ||
          'product-gallery'
      );

      setStudioOpen(true);
    };

  const closeStudio = () => {
    setStudioOpen(false);

    setSourceFile(null);

    setSourceUrl('');

    setEditingAssetId(
      null
    );
  };

  const openAssetEditor =
    async (asset) => {
      if (!asset) {
        return;
      }

      setEditingAssetId(
        asset.id
      );

      setSelectedProfileId(
        asset.profileId ||
          mediaMetadata.defaultProfileId ||
          'product-gallery'
      );

      let storedFile =
        null;

      try {
        storedFile =
          await loadMediaFile(
            asset.id
          );
      } catch {}

      setSourceFile(
        storedFile
      );

      setSourceUrl(
        storedFile
          ? ''
          : getAssetSource(
              asset
            )
      );

      setStudioOpen(true);
    };

  const handleStudioApply =
    async (
      result,
      error
    ) => {
      if (
        error ||
        !result?.file
      ) {
        if (error) {
          notify(
            'media.toast.processingError',
            'error'
          );
        }

        return;
      }

      if (editingAssetId) {
        const currentAsset =
          assets.find(
            (asset) =>
              asset.id ===
              editingAssetId
          );

        if (!currentAsset) {
          closeStudio();
          return;
        }

        const renamedFile =
          renameProcessedFile(
            result.file,
            currentAsset.referenceCode,
            result.mime_type
          );

        try {
          await saveMediaFile(
            editingAssetId,
            renamedFile
          );
        } catch {}

        setAssetPreview(
          editingAssetId,
          renamedFile
        );

        updateAsset(
          editingAssetId,
          {
            fileName:
              renamedFile.name,

            mimeType:
              result.mime_type,

            width:
              result.width,

            height:
              result.height,

            profileId:
              selectedProfileId
          }
        );

        notify(
          'media.toast.updated'
        );

        closeStudio();

        return;
      }

      const referenceCode =
        buildMediaReferenceCode(
          variant,
          assets,
          mediaMetadata.reference
        );

      const renamedFile =
        renameProcessedFile(
          result.file,
          referenceCode,
          result.mime_type
        );

      const assetId =
        createAssetId();

      try {
        await saveMediaFile(
          assetId,
          renamedFile
        );
      } catch {}

      setAssetPreview(
        assetId,
        renamedFile
      );

      const number =
        assets.length + 1;

      const title =
        styleName
          ? formatMessage(
              t,
              'media.defaultTitle',
              {
                style:
                  styleName,

                number
              }
            )
          : formatMessage(
              t,
              'media.defaultTitle.noStyle',
              {
                number
              }
            );

      const nextAsset = {
        id:
          assetId,

        referenceCode,

        title,

        description:
          '',

        type:
          'GARMENT_SAMPLE',

        customerVisible:
          true,

        fileName:
          renamedFile.name,

        mimeType:
          result.mime_type,

        width:
          result.width,

        height:
          result.height,

        profileId:
          selectedProfileId,

        createdBy:
          currentUser?.id ||
          null,

        createdAt:
          new Date().toISOString()
      };

      replaceAssets([
        ...assets,
        nextAsset
      ]);

      if (
        !slots.primaryAssetId
      ) {
        replaceSlots({
          primaryAssetId:
            assetId
        });
      }

      setSelectedAssetId(
        assetId
      );

      notify(
        'media.toast.added'
      );

      closeStudio();
    };

  const assignRole = (
    role
  ) => {
    if (
      !selectedAsset ||
      !role
    ) {
      return;
    }

    const currentlyAssigned =
      slots[
        role.slotKey
      ] ===
      selectedAsset.id;

    if (
      currentlyAssigned &&
      role.allowClear !==
        false
    ) {
      replaceSlots({
        [role.slotKey]:
          null
      });

      return;
    }

    const nextSlots = {
      ...slots,

      primaryAssetId:
        slots.primaryAssetId ===
        selectedAsset.id
          ? null
          : slots.primaryAssetId,

      technicalSketchAssetId:
        slots
          .technicalSketchAssetId ===
        selectedAsset.id
          ? null
          : slots
              .technicalSketchAssetId,

      patternAssetId:
        slots.patternAssetId ===
        selectedAsset.id
          ? null
          : slots.patternAssetId
    };

    nextSlots[
      role.slotKey
    ] =
      selectedAsset.id;

    onChange(
      'slots',
      nextSlots
    );

    const changes = {};

    if (
      role.forceType
    ) {
      changes.type =
        role.forceType;
    }

    if (
      role.forcesCustomerVisible
    ) {
      changes.customerVisible =
        true;
    }

    if (
      Object.keys(
        changes
      ).length
    ) {
      updateAsset(
        selectedAsset.id,
        changes
      );
    }
  };

  const toggleVisibility =
    () => {
      if (!selectedAsset) {
        return;
      }

      const currentlyVisible =
        selectedAsset.customerVisible !==
        false;

      if (
        currentlyVisible &&
        requiresVisibility
      ) {
        notify(
          'media.toast.visibilityLocked',
          'warning'
        );

        return;
      }

      updateAsset(
        selectedAsset.id,
        {
          customerVisible:
            !currentlyVisible
        }
      );
    };

  const deleteSelectedAsset =
    async () => {
      if (!selectedAsset) {
        return;
      }

      try {
        await removeMediaFile(
          selectedAsset.id
        );
      } catch {}

      removeAssetPreview(
        selectedAsset.id
      );

      let remaining =
        assets.filter(
          (asset) =>
            asset.id !==
            selectedAsset.id
        );

      const deletingPrimary =
        slots.primaryAssetId ===
        selectedAsset.id;

      if (
        deletingPrimary &&
        remaining.length
      ) {
        remaining =
          remaining.map(
            (
              asset,
              index
            ) =>
              index === 0
                ? {
                    ...asset,

                    customerVisible:
                      true
                  }
                : asset
          );
      }

      const nextSlots = {
        primaryAssetId:
          deletingPrimary
            ? remaining[0]
                ?.id ||
              null
            : slots.primaryAssetId,

        technicalSketchAssetId:
          slots
            .technicalSketchAssetId ===
          selectedAsset.id
            ? null
            : slots
                .technicalSketchAssetId,

        patternAssetId:
          slots.patternAssetId ===
          selectedAsset.id
            ? null
            : slots.patternAssetId
      };

      replaceAssets(
        remaining
      );

      onChange(
        'slots',
        nextSlots
      );

      setSelectedAssetId(
        remaining[0]?.id ||
          null
      );
    };

  const selectPrevious =
    () => {
      if (
        assets.length <= 1
      ) {
        return;
      }

      const index =
        selectedIndex === 0
          ? assets.length -
            1
          : selectedIndex -
            1;

      setSelectedAssetId(
        assets[index].id
      );
    };

  const selectNext =
    () => {
      if (
        assets.length <= 1
      ) {
        return;
      }

      const index =
        selectedIndex ===
        assets.length - 1
          ? 0
          : selectedIndex +
            1;

      setSelectedAssetId(
        assets[index].id
      );
    };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={
          acceptedTypes.join(
            ','
          )
        }
        onChange={
          handleFileSelected
        }
        className="hidden"
      />

      <div className="relative flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-clay-700">
            <Images className="h-4 w-4" />

            {t(
              'media.compactTitle'
            )}
          </div>

          <div className="flex items-center gap-1">
            <span
              title={t(
                'media.metric.total'
              )}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-2 text-bark-700"
            >
              <FileImage className="h-3.5 w-3.5" />

              <strong className="text-[10px]">
                {
                  assets.length
                }
              </strong>
            </span>

            <span
              title={t(
                'media.metric.visible'
              )}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-emerald-700"
            >
              <Eye className="h-3.5 w-3.5" />

              <strong className="text-[10px]">
                {
                  visibleCount
                }
              </strong>
            </span>

            <span
              title={t(
                'media.metric.internal'
              )}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 text-amber-700"
            >
              <Lock className="h-3.5 w-3.5" />

              <strong className="text-[10px]">
                {
                  internalCount
                }
              </strong>
            </span>

            <span
              title={t(
                'media.metric.variantReference'
              )}
              className="hidden h-7 items-center gap-1.5 rounded-lg border border-clay-200 bg-clay-50 px-2 text-clay-700 lg:flex"
            >
              <ShieldCheck className="h-3.5 w-3.5" />

              <strong className="font-mono text-[8px]">
                {variant?.values?.[
                  'variant.code'
                ] || '—'}
              </strong>
            </span>

            <button
              type="button"
              onClick={() =>
                setMediaHelpOpen(
                  (current) =>
                    !current
                )
              }
              aria-label={t(
                'media.summary.help'
              )}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-sand-200 bg-white text-bark-400 transition hover:border-clay-300 hover:text-clay-700"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={
            openFilePicker
          }
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-bark-900 px-3 text-[9px] font-semibold text-white transition hover:bg-bark-950"
        >
          <ImagePlus className="h-3.5 w-3.5" />

          {t(
            'media.action.add'
          )}
        </button>

        {mediaHelpOpen && (
          <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-xl border border-sand-200 bg-white p-3 shadow-[0_12px_30px_rgba(48,32,22,0.14)]">
            <div className="flex items-start gap-3">
              <p className="min-w-0 flex-1 text-[9px] leading-4 text-bark-500">
                {t(
                  'media.summary.helpText'
                )}
              </p>

              <button
                type="button"
                onClick={() =>
                  setMediaHelpOpen(
                    false
                  )
                }
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-bark-300 hover:bg-sand-50 hover:text-bark-700"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      <section className="grid h-[calc(100dvh-330px)] min-h-[500px] max-h-[700px] overflow-hidden rounded-[18px] border border-bark-900/30 bg-white shadow-[0_18px_48px_rgba(60,40,27,0.08)] xl:grid-cols-[minmax(0,1.55fr)_minmax(355px,0.9fr)]">
        <div className="flex min-h-0 min-w-0 flex-col border-b border-sand-200 bg-[radial-gradient(circle_at_50%_40%,_rgba(255,255,255,0.98)_0%,_rgba(248,243,236,0.9)_55%,_rgba(236,226,213,0.82)_100%)] xl:border-b-0 xl:border-r">
          <div className="flex h-10 shrink-0 items-center justify-between gap-3 px-4">
            <span className="inline-flex h-7 items-center gap-2 rounded-lg border border-bark-800/50 bg-white/90 px-2.5 font-mono text-[8px] font-bold uppercase tracking-[0.13em] text-bark-800 shadow-sm">
              <Camera className="h-3 w-3 text-clay-700" />

              {selectedAsset
                ? assetTypes.find(
                    (type) =>
                      type.code ===
                      selectedAsset.type
                  )?.label
                : t(
                    'media.empty.kicker'
                  )}
            </span>

            <span className="inline-flex h-7 items-center rounded-lg bg-bark-900 px-3 font-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[#F1D7A5] shadow-sm">
              {selectedAsset
                ? formatMessage(
                    t,
                    'media.slideCounter',
                    {
                      current:
                        selectedIndex +
                        1,

                      total:
                        assets.length
                    }
                  )
                : formatMessage(
                    t,
                    'media.slideCounter',
                    {
                      current: 0,
                      total: 0
                    }
                  )}
            </span>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-12 py-2">
            <div className="pointer-events-none absolute inset-[10%] rounded-[50%] bg-bark-900/[0.04] blur-3xl" />

            {selectedAsset ? (
              <>
                <AnimatePresence
                  mode="wait"
                >
                  <motion.img
                    key={
                      selectedAsset.id
                    }
                    src={
                      getAssetSource(
                        selectedAsset
                      )
                    }
                    alt={
                      selectedAsset.title
                    }
                    initial={{
                      opacity: 0,
                      scale: 0.985
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.985
                    }}
                    transition={{
                      duration: 0.2
                    }}
                    className="relative z-[1] max-h-full max-w-full object-contain shadow-[0_16px_38px_rgba(50,34,23,0.14)]"
                  />
                </AnimatePresence>

                {assets.length >
                  1 && (
                  <>
                    <button
                      type="button"
                      onClick={
                        selectPrevious
                      }
                      className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-sand-300 bg-white/90 text-bark-800 shadow-md backdrop-blur transition hover:scale-105"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={
                        selectNext
                      }
                      className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-sand-300 bg-white/90 text-bark-800 shadow-md backdrop-blur transition hover:scale-105"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="relative z-[2] flex max-w-sm flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-clay-200 bg-white/80 text-clay-700 shadow-sm">
                  <Camera className="h-5 w-5" />
                </div>

                <h4 className="mt-4 font-serif text-xl font-light text-bark-950">
                  {t(
                    'media.empty.title'
                  )}
                </h4>

                <p className="mt-2 text-[10px] leading-5 text-bark-500">
                  {t(
                    'media.empty.description'
                  )}
                </p>

                <button
                  type="button"
                  onClick={
                    openFilePicker
                  }
                  className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-bark-900 px-3 text-[9px] font-semibold text-white"
                >
                  <Upload className="h-3.5 w-3.5" />

                  {t(
                    'media.action.select'
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-sand-200/70 px-4">
            <span className="min-w-0 truncate font-mono text-[8px] font-semibold uppercase tracking-[0.08em] text-bark-400">
              {selectedAsset
                ? selectedAsset.referenceCode
                : variant?.values?.[
                    'variant.code'
                  ] || '—'}
            </span>

            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={
                  !selectedAsset
                }
                onClick={() =>
                  openAssetEditor(
                    selectedAsset
                  )
                }
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-sand-250 bg-white px-2.5 text-[8px] font-semibold text-bark-700 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Crop className="h-3 w-3" />

                {t(
                  'media.action.editCrop'
                )}
              </button>

              <button
                type="button"
                disabled={
                  !selectedAsset
                }
                onClick={() =>
                  setLightboxAsset(
                    selectedAsset
                  )
                }
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-sand-250 bg-white px-2.5 text-[8px] font-semibold text-bark-700 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ZoomIn className="h-3 w-3" />

                {t(
                  'media.action.enlarge'
                )}
              </button>
            </div>
          </div>
        </div>

        <aside className="min-h-0 min-w-0 overflow-y-auto bg-gradient-to-b from-[#FFFEFC] to-white p-4">
          {selectedAsset ? (
            <>
              <div className="flex items-start gap-3 border-b border-bark-900/70 pb-2.5">
                <div className="min-w-0 flex-1">
                  <span className="block font-mono text-[8px] font-bold uppercase tracking-[0.15em] text-clay-700">
                    {t(
                      'media.selectedSpecification'
                    )}
                  </span>

                  <input
                    type="text"
                    value={
                      selectedAsset.title ||
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      updateAsset(
                        selectedAsset.id,
                        {
                          title:
                            event.target.value
                        }
                      )
                    }
                    className="mt-1.5 w-full border-0 bg-transparent p-0 font-serif text-xl font-light leading-tight text-bark-950 outline-none"
                  />

                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_135px] items-center gap-3">
                    <span
                      title={
                        selectedAsset.referenceCode
                      }
                      className="min-w-0 truncate font-mono text-[8px] uppercase tracking-[0.07em] text-bark-400"
                    >
                      {
                        selectedAsset.referenceCode
                      }
                    </span>

                    <select
                      aria-label={t(
                        'media.assetCategory'
                      )}
                      value={
                        selectedAsset.type ||
                        'GARMENT_SAMPLE'
                      }
                      onChange={(
                        event
                      ) =>
                        updateAsset(
                          selectedAsset.id,
                          {
                            type:
                              event.target.value
                          }
                        )
                      }
                      className="h-7 w-full rounded-lg border border-sand-250 bg-white px-2 text-[8px] font-medium text-bark-800 outline-none transition focus:border-clay-400"
                    >
                      {assetTypes.map(
                        (
                          assetType
                        ) => (
                          <option
                            key={
                              assetType.code
                            }
                            value={
                              assetType.code
                            }
                          >
                            {
                              assetType.label
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    deleteSelectedAsset
                  }
                  aria-label={t(
                    'media.action.delete'
                  )}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3">
                <label className="block font-mono text-[8px] font-bold uppercase tracking-[0.13em] text-bark-500">
                  {t(
                    'media.technicalNotes'
                  )}
                </label>

                <textarea
                  rows={2}
                  value={
                    selectedAsset.description ||
                    ''
                  }
                  placeholder={t(
                    'media.technicalNotes.placeholder'
                  )}
                  onChange={(
                    event
                  ) =>
                    updateAsset(
                      selectedAsset.id,
                      {
                        description:
                          event.target.value
                      }
                    )
                  }
                  className="mt-1.5 min-h-[48px] w-full resize-none rounded-lg border border-sand-250 bg-white px-3 py-2 text-[9px] leading-4 text-bark-700 outline-none focus:border-clay-400"
                />
              </div>

              <div className="relative mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] font-bold uppercase tracking-[0.13em] text-bark-500">
                    {t(
                      'media.placement.title'
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPlacementHelpOpen(
                        (current) =>
                          !current
                      )
                    }
                    className="text-bark-350 hover:text-clay-700"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {assetRoles.map(
                    (role) => {
                      const RoleIcon =
                        ROLE_ICON_REGISTRY[
                          role.icon
                        ] ||
                        Star;

                      const active =
                        slots[
                          role.slotKey
                        ] ===
                        selectedAsset.id;

                      return (
                        <button
                          key={
                            role.code
                          }
                          type="button"
                          onClick={() =>
                            assignRole(
                              role
                            )
                          }
                          className={`relative flex h-10 items-center justify-center gap-1.5 rounded-lg border px-1.5 transition ${
                            active
                              ? role.code ===
                                'PRIMARY'
                                ? 'border-bark-900 bg-bark-900 text-white'
                                : 'border-clay-400 bg-clay-50 text-clay-800'
                              : 'border-sand-200 bg-white text-bark-500 hover:border-clay-300'
                          }`}
                        >
                          <RoleIcon className="h-3.5 w-3.5" />

                          <span className="text-[8px] font-semibold">
                            {
                              role.label
                            }
                          </span>

                          {active && (
                            <Check className="absolute right-1 top-1 h-2.5 w-2.5" />
                          )}
                        </button>
                      );
                    }
                  )}
                </div>

                {placementHelpOpen && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-sand-200 bg-white p-3 shadow-xl">
                    {assetRoles.map(
                      (role) => (
                        <div
                          key={
                            role.code
                          }
                          className="mb-2 flex gap-2 last:mb-0"
                        >
                          <strong className="w-24 shrink-0 text-[9px] text-bark-800">
                            {
                              role.label
                            }
                          </strong>

                          <p className="text-[8px] leading-4 text-bark-500">
                            {
                              role.description
                            }
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className="relative mt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[8px] font-bold uppercase tracking-[0.13em] text-bark-500">
                    {t(
                      'media.visibility.title'
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setVisibilityHelpOpen(
                        (current) =>
                          !current
                      )
                    }
                    className="text-bark-350 hover:text-clay-700"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div
                  className={`mt-1.5 flex h-11 items-center gap-2.5 rounded-lg border px-3 ${
                    selectedAsset.customerVisible !==
                    false
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                      selectedAsset.customerVisible !==
                      false
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {selectedAsset.customerVisible !==
                    false ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <strong className="min-w-0 flex-1 truncate text-[9px] font-semibold text-bark-850">
                    {selectedAsset.customerVisible !==
                    false
                      ? t(
                          'media.visibility.visible.title'
                        )
                      : t(
                          'media.visibility.internal.title'
                        )}
                  </strong>

                  <button
                    type="button"
                    onClick={
                      toggleVisibility
                    }
                    disabled={
                      selectedAsset.customerVisible !==
                        false &&
                      requiresVisibility
                    }
                    className={`relative h-6 w-11 rounded-full transition ${
                      selectedAsset.customerVisible !==
                      false
                        ? 'bg-emerald-600'
                        : 'bg-bark-300'
                    } ${
                      selectedAsset.customerVisible !==
                        false &&
                      requiresVisibility
                        ? 'cursor-not-allowed opacity-45'
                        : ''
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                        selectedAsset.customerVisible !==
                        false
                          ? 'left-6'
                          : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {visibilityHelpOpen && (
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-sand-200 bg-white p-3 shadow-xl">
                    <p className="text-[8px] leading-4 text-bark-500">
                      {requiresVisibility
                        ? t(
                            'media.visibility.locked'
                          )
                        : selectedAsset.customerVisible !==
                          false
                        ? t(
                            'media.visibility.visible.description'
                          )
                        : t(
                            'media.visibility.internal.description'
                          )}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-sand-250 bg-sand-50/30 px-6 text-center">
              <FileImage className="h-5 w-5 text-clay-500" />

              <h4 className="mt-3 font-serif text-base font-light text-bark-900">
                {t(
                  'media.empty.title'
                )}
              </h4>

              <p className="mt-1 max-w-xs text-[9px] leading-4 text-bark-400">
                {t(
                  'media.empty.description'
                )}
              </p>
            </div>
          )}

          <div className="mt-3">
            <div className="flex items-center justify-between gap-3 border-t border-sand-200 pt-2.5 font-mono text-[8px] text-bark-400">
              <span className="font-semibold">
                {formatMessage(
                  t,
                  'media.thumbnail.title',
                  {
                    count:
                      assets.length
                  }
                )}
              </span>

              <span>
                {t(
                  'media.thumbnail.hint'
                )}
              </span>
            </div>

            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
              {assets.map(
                (
                  asset,
                  index
                ) => {
                  const active =
                    asset.id ===
                    selectedAsset?.id;

                  const primary =
                    slots.primaryAssetId ===
                    asset.id;

                  const sketch =
                    slots.technicalSketchAssetId ===
                    asset.id;

                  const pattern =
                    slots.patternAssetId ===
                    asset.id;

                  return (
                    <button
                      key={
                        asset.id
                      }
                      type="button"
                      onClick={() =>
                        setSelectedAssetId(
                          asset.id
                        )
                      }
                      className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-sand-100 ${
                        active
                          ? 'border-bark-800 ring-1 ring-clay-200'
                          : 'border-sand-250 opacity-75'
                      }`}
                    >
                      {getAssetSource(
                        asset
                      ) ? (
                        <img
                          src={
                            getAssetSource(
                              asset
                            )
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileImage className="mx-auto h-full w-4 text-bark-300" />
                      )}

                      <span className="absolute left-0.5 top-0.5 rounded bg-bark-950/80 px-1 text-[6px] text-white">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          '0'
                        )}
                      </span>

                      {(primary ||
                        sketch ||
                        pattern) && (
                        <span className="absolute bottom-0.5 right-0.5">
                          {primary && (
                            <Star className="h-3.5 w-3.5 rounded-full bg-bark-900 p-0.5 text-[#F2D594]" />
                          )}

                          {sketch && (
                            <FileText className="h-3.5 w-3.5 rounded-full bg-clay-700 p-0.5 text-white" />
                          )}

                          {pattern && (
                            <Layers3 className="h-3.5 w-3.5 rounded-full bg-clay-700 p-0.5 text-white" />
                          )}
                        </span>
                      )}
                    </button>
                  );
                }
              )}

              <button
                type="button"
                onClick={
                  openFilePicker
                }
                className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-clay-300 bg-[#FBF8F3] text-clay-700"
              >
                <ImagePlus className="h-3.5 w-3.5" />

                <span className="text-[6px] font-semibold uppercase">
                  {t(
                    'media.thumbnail.add'
                  )}
                </span>
              </button>
            </div>
          </div>
        </aside>
      </section>

      <ImageAssetStudioModal
        open={
          studioOpen
        }
        sourceFile={
          sourceFile
        }
        sourceUrl={
          sourceUrl
        }
        title={
          editingAssetId
            ? t(
                'media.editor.editTitle'
              )
            : t(
                'media.editor.addTitle'
              )
        }
        presetProfiles={
          profiles
        }
        defaultProfileId={
          selectedProfileId
        }
        onCancel={
          closeStudio
        }
        onApply={
          handleStudioApply
        }
      />

      <AnimatePresence>
        {lightboxAsset && (
          <motion.div
            initial={{
              opacity: 0
            }}
            animate={{
              opacity: 1
            }}
            exit={{
              opacity: 0
            }}
            onClick={() =>
              setLightboxAsset(
                null
              )
            }
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-bark-950/85 p-6 backdrop-blur-md"
          >
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.95
              }}
              animate={{
                opacity: 1,
                scale: 1
              }}
              exit={{
                opacity: 0,
                scale: 0.95
              }}
              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
              className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] bg-[#FFFEFC] shadow-2xl"
            >
              <header className="flex min-h-[64px] items-center justify-between border-b border-sand-200 px-5">
                <div>
                  <span className="font-mono text-[8px] text-clay-700">
                    {
                      lightboxAsset.referenceCode
                    }
                  </span>

                  <h4 className="mt-1 font-serif text-lg font-light text-bark-950">
                    {
                      lightboxAsset.title
                    }
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLightboxAsset(
                      null
                    )
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-250"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 items-center justify-center bg-sand-50 p-4">
                <img
                  src={
                    getAssetSource(
                      lightboxAsset
                    )
                  }
                  alt={
                    lightboxAsset.title
                  }
                  className="max-h-[74vh] max-w-full object-contain"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
