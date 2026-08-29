import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  GripHorizontal,
  Image as ImageIcon,
  Minimize2,
  Pause,
  Play,
  Plus,
  Ruler,
  Square,
  TimerReset,
  Upload,
  X
} from 'lucide-react';

import ImageAssetStudioModal from '../ImageAssetStudioModal';

import {
  createFitProfileProposal,
  getFitBodyAreaLabel,
  getMeasurementSizeSystems,
  getPreferredSizeReference,
  normalizeMeasurementChartValues
} from '../../lib/measurementChart';
import { UI_LAYERS } from '../../lib/uiLayers';
import { runtimeDataStorage } from '../../lib/runtimeDataGateway';

export const PROJECT_JOURNAL_STORAGE_KEY = 'perfectfit_project_journal_v1';
export const PROJECT_JOURNAL_UPDATED_EVENT = 'perfectfit_project_journal_updated';

const nowIso = () => new Date().toISOString();

const resolveJournalActor = (currentUser) => {
  const user = currentUser || {};

  const id =
    user.id ||
    user.identity_id ||
    user.identityId ||
    user.userId ||
    user.sub ||
    'local-user';

  const email =
    user.email ||
    user.login ||
    user.username ||
    '';

  const name =
    user.name ||
    user.display_name ||
    user.displayName ||
    user.fullName ||
    user.username ||
    email ||
    'Workspace user';

  return {
    id: String(id),
    name: String(name),
    login: String(user.login || user.username || email || name),
    email: String(email)
  };
};


const DEFAULT_FOCUS = {
  open: true,
  minimized: false,
  x: 24,
  y: 120,
  width: 360,
  height: 420
};

const createDefaultStore = () => ({
  version: 'project-journal-v1',
  templates: [],
  assignments: {},
  sessions: [],
  fitSessions: [],
  activeTimer: null,
  updatedAt: nowIso()
});

const safeParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function loadProjectJournalStore() {
  if (typeof window === 'undefined') {
    return createDefaultStore();
  }

  const saved = safeParse(runtimeDataStorage.getItem(PROJECT_JOURNAL_STORAGE_KEY));
  const base = saved && typeof saved === 'object' ? saved : createDefaultStore();

  const templates = Array.isArray(base.templates) ? base.templates : [];

  return {
    ...createDefaultStore(),
    ...base,
    templates,
    assignments: base.assignments && typeof base.assignments === 'object' ? base.assignments : {},
    sessions: Array.isArray(base.sessions) ? base.sessions : [],
    fitSessions: Array.isArray(base.fitSessions) ? base.fitSessions : [],
    activeTimer: base.activeTimer || null
  };
}

export function saveProjectJournalStore(nextStore) {
  if (typeof window === 'undefined') {
    return nextStore;
  }

  const normalized = {
    ...createDefaultStore(),
    ...nextStore,
    updatedAt: nowIso()
  };

  try {
    runtimeDataStorage.setItem(PROJECT_JOURNAL_STORAGE_KEY, JSON.stringify(normalized));
  } catch {}

  window.dispatchEvent(new CustomEvent(PROJECT_JOURNAL_UPDATED_EVENT, { detail: normalized }));
  return normalized;
}

function useProjectJournalStore() {
  const [store, setStore] = useState(() => loadProjectJournalStore());

  useEffect(() => {
    const refresh = () => setStore(loadProjectJournalStore());
    const handleCustom = (event) => {
      if (event?.detail) {
        setStore(event.detail);
      } else {
        refresh();
      }
    };
    const handleStorage = (event) => {
      if (!event?.key || event.key === PROJECT_JOURNAL_STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener(PROJECT_JOURNAL_UPDATED_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(PROJECT_JOURNAL_UPDATED_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateStore = (updater) => {
    const current = loadProjectJournalStore();
    const next = typeof updater === 'function' ? updater(current) : updater;
    const saved = saveProjectJournalStore(next);
    setStore(saved);
    return saved;
  };

  return [store, updateStore];
}

function getElapsedMs(timer, now = Date.now()) {
  if (!timer) {
    return 0;
  }

  const base = Number(timer.accumulatedMs || 0);
  if (timer.status !== 'running' || !timer.lastStartedAt) {
    return base;
  }

  const started = new Date(timer.lastStartedAt).getTime();
  if (!Number.isFinite(started)) {
    return base;
  }

  return Math.max(0, base + now - started);
}

function formatDuration(ms = 0, compact = false) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (compact) {
    if (hours) return `${hours}h ${minutes}m`;
    if (minutes) return `${minutes}m`;
    return seconds ? `${seconds}s` : '-';
  }

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function getTemplateVersion(template, versionId) {
  if (!template) {
    return null;
  }
  return template.versions?.find((version) => version.id === versionId) ||
    template.versions?.find((version) => version.id === template.activeVersionId) ||
    template.versions?.[0] ||
    null;
}

function createProjectContext({ project, style, variant }) {
  return {
    projectId: project?.id || 'project-unassigned',
    styleId: style?.id || 'style-unassigned',
    variantId: variant?.id || 'variant-unassigned',
    contextKey: variant?.id || style?.id || project?.id || 'workspace-unassigned',
    projectName: project?.values?.['project.name'] || project?.title || 'Workspace project',
    styleName: style?.values?.['product.style_name'] || style?.title || 'Style',
    styleCode: style?.values?.['product.style_code'] || '',
    variantName: variant?.values?.['variant.name'] || variant?.title || 'Variant',
    variantCode: variant?.values?.['variant.code'] || ''
  };
}

function instantiateAssignment(template, version, context, existing = null) {
  const existingTasksById = new Map((existing?.tasksSnapshot || []).map((task) => [task.id, task]));
  return {
    id: existing?.id || `assignment-${context.contextKey}-${Date.now()}`,
    contextKey: context.contextKey,
    projectId: context.projectId,
    styleId: context.styleId,
    variantId: context.variantId,
    templateId: template.id,
    templateName: template.name,
    templateVersionId: version.id,
    templateVersionLabel: version.label || `v${version.version}`,
    instantiatedAt: existing?.instantiatedAt || nowIso(),
    updatedAt: nowIso(),
    tasksSnapshot: (version.tasks || [])
      .filter((task) => task.active !== false)
      .map((task, index) => ({
        id: task.id,
        label: task.label,
        active: task.active !== false,
        order: index + 1,
        completed: existingTasksById.get(task.id)?.completed || false,
        completedAt: existingTasksById.get(task.id)?.completedAt || null
      }))
  };
}

function ensureAssignment(store, context) {
  return store.assignments?.[context.contextKey] || null;
}

function getTaskTimeMs(sessions, contextKey, taskId) {
  return sessions
    .filter((session) => session.contextKey === contextKey && session.taskId === taskId)
    .reduce((sum, session) => sum + Number(session.elapsedMs || 0), 0);
}

function readFilesAsDataUrls(files) {
  return Promise.all(
    Array.from(files || []).map((file) => (
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result,
          createdAt: nowIso()
        });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      })
    ))
  );
}

function getSizeSystemOptions(chart, metadata) {
  const systems = getMeasurementSizeSystems(metadata);
  if (systems?.length) return systems;

  const displaySystem = chart?.displaySystem;
  return displaySystem
    ? [{ code: displaySystem, label: displaySystem }]
    : [];
}


function createSessionRecordFromTimer(timer) {
  const loggedAt = nowIso();
  return {
    id: `session-${Date.now()}`,
    projectId: timer.projectId,
    styleId: timer.styleId,
    variantId: timer.variantId,
    contextKey: timer.contextKey,
    projectName: timer.projectName,
    styleName: timer.styleName,
    variantName: timer.variantName,
    taskId: timer.taskId,
    taskLabel: timer.taskLabel,
    taskTemplateId: timer.taskTemplateId,
    taskTemplateVersionId: timer.taskTemplateVersionId,
    taskTemplateVersionLabel: timer.taskTemplateVersionLabel || '',
    measurementChartRevision: timer.measurementChartRevision || 'V1',
    actor: timer.actor || null,
    startedAt: timer.startedAt,
    endedAt: timer.finishedAt || loggedAt,
    elapsedMs: Number(timer.accumulatedMs || 0),
    notes: timer.notes || '',
    photos: timer.photos || [],
    createdAt: loggedAt,
    updatedAt: loggedAt
  };
}

function fileToSessionPhoto(file, processing = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name || `session-photo-${Date.now()}.jpg`,
      type: file.type || processing.mime_type || 'image/jpeg',
      size: file.size || 0,
      width: processing.width || null,
      height: processing.height || null,
      dataUrl: reader.result,
      createdAt: nowIso()
    });

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function SessionPhotoStudio({
  disabled = false,
  photos = [],
  onAppendPhoto,
  compact = false
}) {
  const uploadInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [studioOpen, setStudioOpen] = useState(false);
  const [sourceFile, setSourceFile] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const stopCamera = () => {
    const stream = cameraStreamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
    setCameraOn(false);
  };

  useEffect(() => {
    return () => {
      const stream = cameraStreamRef.current;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      cameraStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (disabled && cameraOn) {
      stopCamera();
    }
  }, [disabled, cameraOn]);

  useEffect(() => {
    if (!cameraOn) return;

    const stream = cameraStreamRef.current;
    const video = videoRef.current;

    if (!stream || !video) return;

    let cancelled = false;

    video.srcObject = stream;

    const markReady = async () => {
      try {
        await video.play();

        if (
          !cancelled &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          setCameraReady(true);
        }
      } catch {
        if (!cancelled) {
          setCameraReady(false);
        }
      }
    };

    const handleLoadedMetadata = () => {
      markReady();
    };

    const handleCanPlay = () => {
      if (
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        setCameraReady(true);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);

    if (video.readyState >= 2) {
      markReady();
    }

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [cameraOn]);

  const openStudioForFile = (file) => {
    if (!file || disabled) return;

    setSourceFile(file);
    setStudioOpen(true);
  };

  const handleUploadInput = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    openStudioForFile(file);
  };

  const toggleCamera = async () => {
    if (disabled) return;

    if (cameraOn) {
      stopCamera();
      return;
    }

    setCameraError('');
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported by this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment'
          }
        },
        audio: false
      });

      cameraStreamRef.current = stream;
      setCameraOn(true);
    } catch (error) {
      setCameraError(
        error?.name === 'NotAllowedError'
          ? 'Camera permission was not granted.'
          : 'The camera could not be started.'
      );
      stopCamera();
    }
  };

  const captureCameraPhoto = async () => {
    const video = videoRef.current;

    if (!cameraOn || !video) {
      return;
    }

    if (
      !cameraReady ||
      video.readyState < 2 ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      setCameraError('Camera is still starting. Wait a moment and try Capture again.');
      return;
    }

    setCameraError('');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');

      if (!context) {
        setCameraError('Could not prepare the camera snapshot.');
        return;
      }

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise((resolve) => {
        canvas.toBlob(
          resolve,
          'image/jpeg',
          0.94
        );
      });

      if (!blob) {
        setCameraError('Could not capture the camera image.');
        return;
      }

      const file = new File(
        [blob],
        `session-camera-${Date.now()}.jpg`,
        {
          type: 'image/jpeg',
          lastModified: Date.now()
        }
      );

      // Pause the live camera while the existing image studio is used.
      stopCamera();
      openStudioForFile(file);
    } catch (error) {
      setCameraError('The camera snapshot could not be captured.');
    }
  };

  const closeStudio = () => {
    setStudioOpen(false);
    setSourceFile(null);
  };

  const handleStudioApply = async (result, error) => {
    if (error || !result?.file) return;

    const photo = await fileToSessionPhoto(result.file, result);

    onAppendPhoto?.(photo);
    closeStudio();
  };

  const moveLightbox = (direction) => {
    setLightbox((current) => {
      if (!current?.photos?.length) return current;

      return {
        ...current,
        index:
          (
            current.index +
            direction +
            current.photos.length
          ) %
          current.photos.length
      };
    });
  };

  return (
    <div className="space-y-2">
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={handleUploadInput}
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact && (
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.b73ebbf793")}</span>
        )}

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              uploadInputRef.current?.click()
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-[#B78A5A] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7A4B2C] disabled:opacity-35"
          >
            <Upload className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.d510308d94")}</button>

          <button
            type="button"
            disabled={disabled}
            onClick={toggleCamera}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-35 ${
              cameraOn
                ? 'border-[#2E241C] bg-[#2E241C] text-white'
                : 'border-[#B78A5A] bg-white text-[#7A4B2C]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            {cameraOn
              ? 'Camera off'
              : 'Camera on'}
          </button>
        </div>
      </div>

      <div
        className={`${
          compact
            ? 'min-h-[64px]'
            : 'h-[118px]'
        } overflow-hidden rounded-[14px] border border-[#E8DED1] bg-white p-2.5`}
      >
        {cameraOn ? (
          <div className="grid h-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-h-0 overflow-hidden rounded-[10px] bg-black">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            </div>

            <button
              type="button"
              onClick={captureCameraPhoto}
              disabled={!cameraReady}
              className="inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-[10px] bg-[#A06E46] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white disabled:cursor-wait disabled:opacity-45"
            >
              <Camera className="h-3.5 w-3.5" />
              {cameraReady ? 'Capture' : 'Starting...'}
            </button>
          </div>
        ) : photos.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map(
              (photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() =>
                    setLightbox({
                      photos,
                      index
                    })
                  }
                  className={`${
                    compact
                      ? 'h-12 w-12'
                      : 'h-14 w-14'
                  } shrink-0 overflow-hidden rounded-[10px] border border-[#E8DED1] bg-[#F7EFE6]`}
                >
                  <img
                    src={photo.dataUrl}
                    alt={
                      photo.name ||
                      'Session photo'
                    }
                    className="h-full w-full object-cover"
                  />
                </button>
              )
            )}
          </div>
        ) : (
          <p className="text-[11px] text-[#8B7A6A]">
            {disabled
              ? 'Start a session to attach photos.'
              : 'No photos attached yet.'}
          </p>
        )}
      </div>

      {cameraError && (
        <p className="text-[10px] text-[#9A3D2F]">
          {cameraError}
        </p>
      )}

      <ImageAssetStudioModal
        open={studioOpen}
        sourceFile={sourceFile}
        sourceUrl=""
        title={pfUiT("ui.components.workspace.projectjournal.d0bc654d21")}
        onCancel={closeStudio}
        onApply={handleStudioApply}
      />

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() =>
            setLightbox(null)
          }
          onMove={moveLightbox}
        />
      )}
    </div>
  );
}

function FitSessionPanel({
  measurementNode,
  variant,
  style,
  metadata,
  context,
  store,
  updateStore,
  onChange,
  actor
}) {
  const canonicalChart = useMemo(
    () => normalizeMeasurementChartValues(
      measurementNode?.values || {},
      variant?.values || {},
      metadata,
      style?.values || {}
    ),
    [measurementNode, metadata, style?.values, variant?.values]
  );
  const sizeSystems = getSizeSystemOptions(canonicalChart, metadata);
  const fitRules = canonicalChart.fitProfile?.rules || [];
  const [displaySystem, setDisplaySystem] = useState(canonicalChart.displaySystem || sizeSystems[0]?.code || 'ALPHA');
  const [testedSizeId, setTestedSizeId] = useState(canonicalChart.baseSizeId || canonicalChart.sizes?.[0]?.id || '');
  const [observations, setObservations] = useState({});
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState('');

  const fitResultOptions = metadata?.dropdowns?.FIT_RESULT || [
    { code: 'UNASSESSED', eipV1Value: 'Not assessed' },
    { code: 'TOO_TIGHT', eipV1Value: 'Too tight' },
    { code: 'SLIGHTLY_TIGHT', eipV1Value: 'Slightly tight' },
    { code: 'GOOD', eipV1Value: 'Good' },
    { code: 'SLIGHTLY_LOOSE', eipV1Value: 'Slightly loose' },
    { code: 'TOO_LOOSE', eipV1Value: 'Too loose' }
  ];
  const fitIssueOptions = metadata?.dropdowns?.FIT_ISSUE || [
    { code: 'NONE', eipV1Value: 'None' },
    { code: 'PULLING', eipV1Value: 'Pulling' },
    { code: 'GAPING', eipV1Value: 'Gaping' },
    { code: 'RESTRICTION', eipV1Value: 'Restriction' },
    { code: 'EXCESS_EASE', eipV1Value: 'Excess ease' },
    { code: 'DRAG_LINES', eipV1Value: 'Drag lines' },
    { code: 'BALANCE', eipV1Value: 'Balance' },
    { code: 'LENGTH', eipV1Value: 'Length' },
    { code: 'OTHER', eipV1Value: 'Other' }
  ];
  const fitSeverityOptions = metadata?.dropdowns?.FIT_SEVERITY || [
    { code: 'NONE', eipV1Value: 'None' },
    { code: 'MINOR', eipV1Value: 'Minor' },
    { code: 'MODERATE', eipV1Value: 'Moderate' },
    { code: 'CRITICAL', eipV1Value: 'Critical' }
  ];
  const fitPriorityOptions = metadata?.dropdowns?.FIT_PRIORITY || [
    { code: 'CRITICAL', eipV1Value: 'Critical' },
    { code: 'IMPORTANT', eipV1Value: 'Important' },
    { code: 'SECONDARY', eipV1Value: 'Secondary' },
    { code: 'NOT_RELEVANT', eipV1Value: 'Not relevant' }
  ];

  const makeObservation = (rule) => ({
    measurementCode: rule.measurementCode,
    result: 'UNASSESSED',
    issue: 'NONE',
    severity: 'NONE',
    comment: '',
    propose: false,
    proposedPriority: rule.priority || 'SECONDARY',
    proposedMinimumEase: rule.minimumEase ?? '',
    proposedTargetEase: rule.targetEase ?? '',
    proposedMaximumPreferredEase: rule.maximumPreferredEase ?? '',
    proposalReason: ''
  });

  useEffect(() => {
    setDisplaySystem(canonicalChart.displaySystem || sizeSystems[0]?.code || 'ALPHA');
    setTestedSizeId(canonicalChart.baseSizeId || canonicalChart.sizes?.[0]?.id || '');
    setObservations(
      fitRules.reduce((result, rule) => ({
        ...result,
        [rule.measurementCode]: makeObservation(rule)
      }), {})
    );
    setNotes('');
    setPhotos([]);
    setMessage('');
  }, [measurementNode?.id, canonicalChart.revisionNumber]);

  if (!measurementNode) {
    return (
      <div className="rounded-[16px] border border-dashed border-[#D8C8B8] bg-white/70 p-4 text-sm text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.06dbc7ae7e")}</div>
    );
  }

  const currentRevision = canonicalChart.revisionLabel || `V${canonicalChart.revisionNumber || 1}`;
  const testedSize = (canonicalChart.sizes || []).find((size) => size.id === testedSizeId) || canonicalChart.sizes?.[0] || null;
  const testedSizeReference = testedSize
    ? getPreferredSizeReference(testedSize, displaySystem) || testedSize.id
    : '';

  const updateObservation = (measurementCode, patch) => {
    setObservations((current) => ({
      ...current,
      [measurementCode]: {
        ...(current[measurementCode] || {}),
        ...patch
      }
    }));
    setMessage('');
  };

  const observationRecords = fitRules.map((rule) => ({
    rule,
    observation: observations[rule.measurementCode] || makeObservation(rule)
  }));

  const assessedCount = observationRecords.filter(({ observation }) => (
    observation.result !== 'UNASSESSED' ||
    observation.issue !== 'NONE' ||
    observation.severity !== 'NONE' ||
    String(observation.comment || '').trim() ||
    observation.propose
  )).length;

  const saveFitSession = () => {
    if (!testedSizeId) {
      setMessage('Select the size tested in this fitting session.');
      return;
    }

    if (!assessedCount && !notes.trim() && !photos.length) {
      setMessage('Record at least one fit observation, note or photo before saving.');
      return;
    }

    const fitSessionId = `fit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = nowIso();

    const savedObservations = observationRecords
      .filter(({ observation }) => (
        observation.result !== 'UNASSESSED' ||
        observation.issue !== 'NONE' ||
        observation.severity !== 'NONE' ||
        String(observation.comment || '').trim() ||
        observation.propose
      ))
      .map(({ rule, observation }) => ({
        measurementCode: rule.measurementCode,
        bodyAreaLabel: getFitBodyAreaLabel(rule.measurementCode, metadata),
        fitPriorityAtSession: rule.priority,
        result: observation.result,
        issue: observation.issue,
        severity: observation.severity,
        comment: String(observation.comment || '').trim()
      }));

    const proposals = observationRecords
      .filter(({ observation }) => observation.propose)
      .map(({ rule, observation }) => createFitProfileProposal({
        fitSessionId,
        rule,
        actor,
        observation: {
          result: observation.result,
          issue: observation.issue,
          severity: observation.severity,
          comment: String(observation.comment || '').trim()
        },
        proposal: {
          measurementCode: rule.measurementCode,
          priority: observation.proposedPriority,
          minimumEase: observation.proposedMinimumEase,
          targetEase: observation.proposedTargetEase,
          maximumPreferredEase: observation.proposedMaximumPreferredEase,
          reason:
            String(observation.proposalReason || '').trim() ||
            String(observation.comment || '').trim() ||
            `Fit session ${fitSessionId}`
        }
      }));

    const fitSession = {
      id: fitSessionId,
      contextKey: context.contextKey,
      projectId: context.projectId,
      styleId: context.styleId,
      variantId: context.variantId,
      projectName: context.projectName,
      styleName: context.styleName,
      variantName: context.variantName,
      measurementChartRevision: currentRevision,
      fitProfileVersion: canonicalChart.fitProfile?.version || 'fit-profile-v1',
      standardFitCategory: canonicalChart.fitProfile?.standardCategory || '',
      silhouette: canonicalChart.fitProfile?.silhouette || '',
      testedSizeId,
      testedSizeReference,
      actor,
      notes: notes.trim(),
      photos,
      observations: savedObservations,
      fitProfileProposalIds: proposals.map((proposal) => proposal.id),
      createdAt
    };

    updateStore((current) => ({
      ...current,
      fitSessions: [fitSession, ...(current.fitSessions || [])]
    }));

    if (proposals.length) {
      onChange?.('__replaceValues', null, measurementNode.id, {
        ...canonicalChart,
        fitProfile: {
          ...canonicalChart.fitProfile,
          proposals: [
            ...(canonicalChart.fitProfile?.proposals || []),
            ...proposals
          ]
        }
      });
    }

    setObservations(
      fitRules.reduce((result, rule) => ({
        ...result,
        [rule.measurementCode]: makeObservation(rule)
      }), {})
    );
    setNotes('');
    setPhotos([]);
    setMessage(
      proposals.length
        ? `Fit session saved with ${proposals.length} pending Fit Profile proposal${proposals.length === 1 ? '' : 's'}. Review them in Measurement Chart → Fit Profile.`
        : 'Fit session evidence saved. The Measurement Chart was not changed.'
    );
  };

  const selectedFitSessions = (store.fitSessions || []).filter(
    (entry) => entry.contextKey === context.contextKey
  );

  const priorityTone = (priority) => ({
    CRITICAL: 'border-[#D69B91] bg-[#FFF4F1] text-[#8E3F33]',
    IMPORTANT: 'border-[#D9B97A] bg-[#FFF7E7] text-[#8A5A18]',
    SECONDARY: 'border-[#CFC4B7] bg-[#F8F3ED] text-[#6F6C65]',
    NOT_RELEVANT: 'border-[#DED2C4] bg-white text-[#918D84]'
  }[priority] || 'border-[#DED2C4] bg-white text-[#6F6C65]');

  return (
    <div className="space-y-3">
      <section className="rounded-[18px] border border-[#DED2C4] bg-[#FFFDF9] p-3 shadow-[0_12px_34px_rgba(77,61,45,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#A06E46]">{pfUiT("ui.components.workspace.projectjournal.226a1c416d")}</span>
            <h3 className="mt-0.5 font-serif text-lg text-[#2E241C]">{pfUiT("ui.components.workspace.projectjournal.661cf54986")}</h3>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-[#7A6A5B]">
              Record what happened on the body. Fit sessions create evidence and optional proposals; they do not directly rewrite the technical Measurement Chart.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#E2D4C4] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7A6A5B]">
              Chart {currentRevision}
            </span>
            <span className="rounded-full border border-[#E2D4C4] bg-[#F8F3ED] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#7A6A5B]">
              {canonicalChart.fitProfile?.standardCategoryLabel || canonicalChart.fitProfile?.standardCategory || 'Fit profile'}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-[minmax(180px,1fr)_180px]">
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.3f8dd393f0")}</span>
            <select
              value={testedSizeId}
              onChange={(event) => setTestedSizeId(event.target.value)}
              className="h-9 w-full rounded-[10px] border border-[#DED2C4] bg-white px-3 text-sm text-[#2E241C]"
            >
              {(canonicalChart.sizes || []).map((size) => (
                <option key={size.id} value={size.id}>
                  {getPreferredSizeReference(size, displaySystem) || size.id}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.6603066ea9")}</span>
            <select
              value={displaySystem}
              onChange={(event) => setDisplaySystem(event.target.value)}
              className="h-9 w-full rounded-[10px] border border-[#DED2C4] bg-white px-3 text-sm text-[#2E241C]"
            >
              {sizeSystems.map((system) => (
                <option key={system.code} value={system.code}>{system.label || system.code}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DED2C4] bg-[#FFFDF9] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.e28f0a35d3")}</span>
            <p className="mt-1 text-[11px] text-[#8B7A6A]">{pfUiT("ui.components.workspace.projectjournal.20bf6da4a5")}</p>
          </div>
          <span className="text-[11px] font-semibold text-[#A06E46]">{assessedCount} assessed</span>
        </div>

        <div className="mt-3 space-y-2.5">
          {observationRecords.map(({ rule, observation }) => (
            <div key={rule.measurementCode} className="rounded-[14px] border border-[#E8DED1] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-[#2E241C]">{getFitBodyAreaLabel(rule.measurementCode, metadata)}</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#A99786]">{rule.measurementCode}</div>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${priorityTone(rule.priority)}`}>
                  {rule.priority}
                </span>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.c048dc4ae0")}</span>
                  <select
                    value={observation.result}
                    onChange={(event) => updateObservation(rule.measurementCode, { result: event.target.value })}
                    className="h-9 w-full rounded-[9px] border border-[#DED2C4] bg-[#FFFDF9] px-2.5 text-[12px] text-[#2E241C]"
                  >
                    {fitResultOptions.map((option) => <option key={option.code} value={option.code}>{option.eipV1Value || option.code}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.ea555ff9bf")}</span>
                  <select
                    value={observation.issue}
                    onChange={(event) => updateObservation(rule.measurementCode, { issue: event.target.value })}
                    className="h-9 w-full rounded-[9px] border border-[#DED2C4] bg-[#FFFDF9] px-2.5 text-[12px] text-[#2E241C]"
                  >
                    {fitIssueOptions.map((option) => <option key={option.code} value={option.code}>{option.eipV1Value || option.code}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.731dbc6713")}</span>
                  <select
                    value={observation.severity}
                    onChange={(event) => updateObservation(rule.measurementCode, { severity: event.target.value })}
                    className="h-9 w-full rounded-[9px] border border-[#DED2C4] bg-[#FFFDF9] px-2.5 text-[12px] text-[#2E241C]"
                  >
                    {fitSeverityOptions.map((option) => <option key={option.code} value={option.code}>{option.eipV1Value || option.code}</option>)}
                  </select>
                </label>
              </div>

              <textarea
                value={observation.comment}
                onChange={(event) => updateObservation(rule.measurementCode, { comment: event.target.value })}
                rows={2}
                className="mt-2 min-h-[58px] w-full resize-y rounded-[9px] border border-[#DED2C4] bg-[#FFFDF9] px-3 py-2 text-[12px] leading-relaxed text-[#2E241C]"
                placeholder={pfUiT("ui.components.workspace.projectjournal.70df8c4946")}
              />

              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A6A5B]">
                <input
                  type="checkbox"
                  checked={Boolean(observation.propose)}
                  onChange={(event) => updateObservation(rule.measurementCode, { propose: event.target.checked })}
                  className="h-3.5 w-3.5 accent-[#A06E46]"
                />{pfUiT("ui.components.workspace.projectjournal.dec4b6a628")}</label>

              {observation.propose && (
                <div className="mt-2 rounded-[10px] border border-[#E7D5BD] bg-[#FFF8EE] p-2.5">
                  <div className="grid gap-2 md:grid-cols-4">
                    <label className="space-y-1">
                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#8A633E]">{pfUiT("ui.components.workspace.projectjournal.75ce86be46")}</span>
                      <select
                        value={observation.proposedPriority}
                        onChange={(event) => updateObservation(rule.measurementCode, { proposedPriority: event.target.value })}
                        className="h-8 w-full rounded-[8px] border border-[#DFC49E] bg-white px-2 text-[11px] text-[#2E241C]"
                      >
                        {fitPriorityOptions.map((option) => <option key={option.code} value={option.code}>{option.eipV1Value || option.code}</option>)}
                      </select>
                    </label>
                    {[
                      ['proposedMinimumEase', 'Min ease'],
                      ['proposedTargetEase', 'Target ease'],
                      ['proposedMaximumPreferredEase', 'Preferred max']
                    ].map(([field, label]) => (
                      <label key={field} className="space-y-1">
                        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#8A633E]">{label}</span>
                        <div className="relative">
                          <input
                            value={observation[field] ?? ''}
                            onChange={(event) => updateObservation(rule.measurementCode, { [field]: event.target.value })}
                            inputMode="decimal"
                            className="h-8 w-full rounded-[8px] border border-[#DFC49E] bg-white px-2 pr-8 text-[11px] text-[#2E241C]"
                            placeholder="—"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#A99786]">{canonicalChart.unit}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={observation.proposalReason}
                    onChange={(event) => updateObservation(rule.measurementCode, { proposalReason: event.target.value })}
                    rows={2}
                    className="mt-2 min-h-[52px] w-full resize-y rounded-[8px] border border-[#DFC49E] bg-white px-2.5 py-2 text-[11px] text-[#2E241C]"
                    placeholder={pfUiT("ui.components.workspace.projectjournal.c01b659abc")}
                  />
                </div>
              )}
            </div>
          ))}

          {!fitRules.length && (
            <div className="rounded-[12px] border border-dashed border-[#D8C8B8] bg-white/70 p-4 text-sm text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.7f035462a5")}</div>
          )}
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DED2C4] bg-[#FFFDF9] p-3">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.92f65f44f7")}</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="h-[104px] w-full resize-none rounded-[12px] border border-[#DED2C4] bg-white px-3 py-2 text-sm leading-relaxed text-[#2E241C]"
              placeholder={pfUiT("ui.components.workspace.projectjournal.0e6883f612")}
            />
          </label>

          <SessionPhotoStudio
            photos={photos}
            onAppendPhoto={(photo) => setPhotos((current) => [...current, photo])}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEE3D6] pt-3">
          <div className="text-xs text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.2817b897e5")}<strong className="text-[#2E241C]">{testedSizeReference || '—'}</strong> · {assessedCount} observation{assessedCount === 1 ? '' : 's'}
            {message && <span className="ml-2 font-semibold text-[#A06E46]">{message}</span>}
          </div>
          <button
            type="button"
            onClick={saveFitSession}
            className="rounded-full bg-[#2E241C] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.13em] text-white"
          >{pfUiT("ui.components.workspace.projectjournal.b228de6579")}</button>
        </div>
      </section>

      {selectedFitSessions.length > 0 && (
        <section className="rounded-[16px] border border-[#DED2C4] bg-[#FFFDF9] p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.db91b64508")}</span>
            <span className="text-xs text-[#A06E46]">{selectedFitSessions.length}</span>
          </div>
          <div className="mt-2 max-h-[260px] space-y-1.5 overflow-auto">
            {selectedFitSessions.map((entry) => {
              const observationCount = Array.isArray(entry.observations)
                ? entry.observations.length
                : Array.isArray(entry.changes)
                ? entry.changes.length
                : 0;

              return (
                <div key={entry.id} className="rounded-[10px] border border-[#E8DED1] bg-white px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#2E241C]">
                      {entry.testedSizeReference ? `Size ${entry.testedSizeReference}` : 'Legacy fit session'}
                      {' · '}
                      {entry.measurementChartRevision || entry.fromRevision || currentRevision}
                    </span>
                    <span className="text-[#A99786]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 text-[#7A6A5B]">
                    {observationCount} observation{observationCount === 1 ? '' : 's'}
                    {entry.fitProfileProposalIds?.length ? ` · ${entry.fitProfileProposalIds.length} proposal${entry.fitProfileProposalIds.length === 1 ? '' : 's'}` : ''}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function PhotoLightbox({ photos, index, onClose, onMove }) {
  const photo = photos?.[index];
  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[#1D1712]/75 p-6"
      style={{ zIndex: UI_LAYERS.modalBackdrop }}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white/20 bg-[#FFFDF9] shadow-2xl"
        style={{ zIndex: UI_LAYERS.modal }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-[#2E241C] p-2 text-white shadow-lg"
          aria-label={pfUiT("ui.components.workspace.projectjournal.4289b87cb4")}
        >
          <X className="h-4 w-4" />
        </button>
        <img src={photo.dataUrl} alt={photo.name || 'Session photo'} className="max-h-[78vh] w-full object-contain bg-[#1D1712]" />
        <div className="flex items-center justify-between gap-3 border-t border-[#E8DED1] px-4 py-3 text-xs text-[#7A6A5B]">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={photos.length < 2}
            className="inline-flex items-center gap-1 rounded-full border border-[#DED2C4] px-3 py-1.5 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.1a69ea4acd")}</button>
          <span>{photo.name || `Photo ${index + 1}`} · {index + 1} / {photos.length}</span>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={photos.length < 2}
            className="inline-flex items-center gap-1 rounded-full border border-[#DED2C4] px-3 py-1.5 disabled:opacity-40"
          >{pfUiT("ui.components.workspace.projectjournal.77862de8d6")}<ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskTemplateEditor({ store, updateStore, assignment, context }) {
  const templates = Array.isArray(store.templates) ? store.templates : [];
  const [selectedTemplateId, setSelectedTemplateId] = useState(assignment?.templateId || templates[0]?.id || '');
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || templates[0] || null;
  const [selectedVersionId, setSelectedVersionId] = useState(assignment?.templateVersionId || selectedTemplate?.activeVersionId || selectedTemplate?.versions?.[0]?.id || '');
  const selectedVersion = selectedTemplate ? getTemplateVersion(selectedTemplate, selectedVersionId) : null;
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTaskLabel, setNewTaskLabel] = useState('');

  useEffect(() => {
    if (!selectedTemplate) {
      if (selectedTemplateId) setSelectedTemplateId('');
      if (selectedVersionId) setSelectedVersionId('');
      return;
    }
    if (!selectedTemplate.versions?.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(selectedTemplate.activeVersionId || selectedTemplate.versions?.[0]?.id || '');
    }
  }, [selectedTemplate, selectedTemplateId, selectedVersionId]);

  const mutateSelectedVersion = (mutator) => {
    if (!selectedTemplate || !selectedVersion) return;
    updateStore((current) => ({
      ...current,
      templates: (current.templates || []).map((template) => {
        if (template.id !== selectedTemplate.id) return template;
        return {
          ...template,
          versions: (template.versions || []).map((version) => (
            version.id === selectedVersion.id
              ? { ...version, tasks: mutator(version.tasks || []) }
              : version
          ))
        };
      })
    }));
  };

  const createTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const id = `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const version = {
      id: `${id}-v1`,
      version: 1,
      label: 'v1',
      createdAt: nowIso(),
      tasks: []
    };
    updateStore((current) => ({
      ...current,
      templates: [
        ...(current.templates || []),
        { id, name, activeVersionId: version.id, createdAt: nowIso(), versions: [version] }
      ]
    }));
    setSelectedTemplateId(id);
    setSelectedVersionId(version.id);
    setNewTemplateName('');
  };

  const addTask = () => {
    const label = newTaskLabel.trim();
    if (!label || !selectedVersion) return;
    mutateSelectedVersion((tasks) => [
      ...tasks,
      {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        active: true
      }
    ]);
    setNewTaskLabel('');
  };

  const createNewVersion = () => {
    if (!selectedTemplate || !selectedVersion) return;
    const nextNumber = Math.max(0, ...(selectedTemplate.versions || []).map((version) => Number(version.version || 0))) + 1;
    const nextVersion = {
      id: `${selectedTemplate.id}-v${nextNumber}-${Date.now()}`,
      version: nextNumber,
      label: `v${nextNumber}`,
      createdAt: nowIso(),
      tasks: (selectedVersion.tasks || []).map((task) => ({ ...task }))
    };
    updateStore((current) => ({
      ...current,
      templates: (current.templates || []).map((template) => (
        template.id === selectedTemplate.id
          ? { ...template, activeVersionId: nextVersion.id, versions: [...(template.versions || []), nextVersion] }
          : template
      ))
    }));
    setSelectedVersionId(nextVersion.id);
  };

  const applyTemplateVersion = () => {
    if (!selectedTemplate || !selectedVersion) return;
    const nextAssignment = instantiateAssignment(selectedTemplate, selectedVersion, context, assignment);
    updateStore((current) => ({
      ...current,
      assignments: { ...(current.assignments || {}), [context.contextKey]: nextAssignment }
    }));
  };

  return (
    <section className="rounded-[22px] border border-[#DED2C4] bg-[#FFFDF9] p-4 shadow-[0_18px_50px_rgba(77,61,45,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#A06E46]">{pfUiT("ui.components.workspace.projectjournal.833f462577")}</span>
          <h3 className="mt-1 font-serif text-2xl text-[#2E241C]">{pfUiT("ui.components.workspace.projectjournal.94f74fa757")}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.3579b05939")}</p>
        </div>
        <Copy className="h-5 w-5 text-[#A06E46]" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={newTemplateName}
          onChange={(event) => setNewTemplateName(event.target.value)}
          placeholder={pfUiT("ui.components.workspace.projectjournal.3c19fa7e5b")}
          className="h-9 min-w-[210px] flex-1 rounded-[12px] border border-[#DED2C4] bg-white px-3 text-xs"
        />
        <button type="button" onClick={createTemplate} className="rounded-full bg-[#2E241C] px-4 text-xs font-bold uppercase tracking-[0.14em] text-white">{pfUiT("ui.components.workspace.projectjournal.ec42690e9d")}</button>
      </div>

      {!selectedTemplate ? (
        <div className="mt-4 rounded-[18px] border border-dashed border-[#D8C8B8] bg-white/70 p-6 text-center text-sm text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.775072d344")}</div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.5f7a84f261")}</span>
              <select
                value={selectedTemplate.id}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className="h-10 w-full rounded-[12px] border border-[#DED2C4] bg-white px-3 text-sm"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.5be1504e21")}</span>
              <select
                value={selectedVersion?.id || ''}
                onChange={(event) => setSelectedVersionId(event.target.value)}
                className="h-10 w-full rounded-[12px] border border-[#DED2C4] bg-white px-3 text-sm"
              >
                {(selectedTemplate.versions || []).map((version) => (
                  <option key={version.id} value={version.id}>{version.label || `v${version.version}`}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!selectedVersion} onClick={createNewVersion} className="rounded-full border border-[#B78A5A] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7A4B2C] disabled:opacity-40">{pfUiT("ui.components.workspace.projectjournal.0f6294a17c")}</button>
            <button type="button" disabled={!selectedVersion} onClick={applyTemplateVersion} className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 disabled:opacity-40">{pfUiT("ui.components.workspace.projectjournal.7be47eb829")}</button>
          </div>

          <div className="mt-4 rounded-[18px] border border-[#E8DED1] bg-white">
            <div className="flex items-center gap-2 border-b border-[#F1E9DE] p-3">
              <input
                value={newTaskLabel}
                onChange={(event) => setNewTaskLabel(event.target.value)}
                placeholder={pfUiT("ui.components.workspace.projectjournal.6abc94a674")}
                disabled={!selectedVersion}
                className="h-9 min-w-0 flex-1 rounded-[12px] border border-[#DED2C4] bg-[#FFFDF9] px-3 text-xs disabled:opacity-50"
              />
              <button type="button" disabled={!selectedVersion} onClick={addTask} className="inline-flex h-9 items-center gap-1 rounded-full bg-[#A06E46] px-3 text-xs font-bold uppercase tracking-[0.14em] text-white disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.4dcbd0f8bb")}</button>
            </div>

            <div className="max-h-[300px] overflow-auto">
              {(selectedVersion?.tasks || []).map((task, index, tasks) => (
                <div key={task.id} className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[#F1E9DE] px-3 py-2 last:border-b-0">
                  <input
                    value={task.label}
                    onChange={(event) => mutateSelectedVersion((currentTasks) => currentTasks.map((item) => (
                      item.id === task.id ? { ...item, label: event.target.value } : item
                    )))}
                    className={`h-9 rounded-[12px] border border-[#DED2C4] px-3 text-xs ${task.active === false ? 'bg-[#F4F0EA] text-[#A99786] line-through' : 'bg-white text-[#2E241C]'}`}
                  />
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={index === 0} onClick={() => mutateSelectedVersion((currentTasks) => {
                      const next = [...currentTasks];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })} className="rounded-full border border-[#DED2C4] px-2 py-1 text-[10px] disabled:opacity-30">{pfUiT("ui.components.workspace.projectjournal.0479f1fcf2")}</button>
                    <button type="button" disabled={index === tasks.length - 1} onClick={() => mutateSelectedVersion((currentTasks) => {
                      const next = [...currentTasks];
                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                      return next;
                    })} className="rounded-full border border-[#DED2C4] px-2 py-1 text-[10px] disabled:opacity-30">{pfUiT("ui.components.workspace.projectjournal.fdbf5d7032")}</button>
                    <button type="button" onClick={() => mutateSelectedVersion((currentTasks) => currentTasks.map((item) => (
                      item.id === task.id ? { ...item, active: item.active === false } : item
                    )))} className="rounded-full border border-[#DED2C4] px-2 py-1 text-[10px]">
                      {task.active === false ? 'Restore' : 'Deactivate'}
                    </button>
                  </div>
                </div>
              ))}
              {!selectedVersion?.tasks?.length && (
                <p className="p-5 text-center text-sm text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.a98db1d442")}</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ProjectTimerPanel({
  store,
  updateStore,
  context,
  assignment,
  sessions,
  selectedTaskId,
  setSelectedTaskId,
  measurementNode,
  actor
}) {
  const [tick, setTick] = useState(Date.now());
  const [lightbox, setLightbox] = useState(null);
  const tasks = assignment?.tasksSnapshot || [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || tasks.find((task) => task.active !== false) || tasks[0] || null;
  const activeTimer = store.activeTimer?.contextKey === context.contextKey ? store.activeTimer : null;
  const elapsed = getElapsedMs(activeTimer, tick);
  const isFinished = activeTimer?.status === 'finished';

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const patchActiveTimer = (patch) => {
    updateStore((current) => ({
      ...current,
      activeTimer: current.activeTimer
        ? { ...current.activeTimer, ...patch, updatedAt: nowIso() }
        : current.activeTimer
    }));
  };

  const startTimer = () => {
    if (!selectedTask || !assignment) return;

    if (activeTimer?.status === 'paused') {
      patchActiveTimer({ status: 'running', lastStartedAt: nowIso() });
      return;
    }

    if (activeTimer) return;

    updateStore((current) => ({
      ...current,
      activeTimer: {
        id: `timer-${Date.now()}`,
        status: 'running',
        contextKey: context.contextKey,
        projectId: context.projectId,
        styleId: context.styleId,
        variantId: context.variantId,
        projectName: context.projectName,
        styleName: context.styleName,
        variantName: context.variantName,
        taskId: selectedTask.id,
        taskLabel: selectedTask.label,
        taskTemplateId: assignment.templateId,
        taskTemplateVersionId: assignment.templateVersionId,
        taskTemplateVersionLabel: assignment.templateVersionLabel || '',
        actor,
        measurementChartRevision:
          measurementNode?.values?.revisionLabel ||
          (measurementNode?.values?.revisionNumber
            ? `V${measurementNode.values.revisionNumber}`
            : 'V1'),
        startedAt: nowIso(),
        lastStartedAt: nowIso(),
        accumulatedMs: 0,
        notes: '',
        photos: [],
        focus: DEFAULT_FOCUS,
        createdAt: nowIso(),
        updatedAt: nowIso()
      }
    }));
  };

  const pauseTimer = () => {
    if (!activeTimer || activeTimer.status !== 'running') return;
    patchActiveTimer({
      status: 'paused',
      accumulatedMs: getElapsedMs(activeTimer),
      lastStartedAt: null
    });
  };

  const finishTimer = () => {
    if (!activeTimer || isFinished) return;
    patchActiveTimer({
      status: 'finished',
      accumulatedMs: getElapsedMs(activeTimer),
      lastStartedAt: null,
      finishedAt: nowIso()
    });
  };

  const logSession = () => {
    if (!activeTimer || activeTimer.status !== 'finished') return;
    const session = createSessionRecordFromTimer(activeTimer);

    updateStore((current) => ({
      ...current,
      activeTimer: null,
      sessions: [session, ...(current.sessions || [])]
    }));
  };


  const moveLightbox = (direction) => {
    setLightbox((current) => {
      if (!current) return current;
      return {
        ...current,
        index: (current.index + direction + current.photos.length) % current.photos.length
      };
    });
  };

  const statusLabel = activeTimer?.status === 'running'
    ? 'Recording'
    : activeTimer?.status === 'paused'
      ? 'Paused'
      : activeTimer?.status === 'finished'
        ? 'Session finished'
        : 'Ready';

  return (
    <section className="rounded-[20px] border border-[#DECDBB] bg-[#FFFDF9] p-3 shadow-[0_12px_34px_rgba(77,61,45,0.06)]">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[14px] border border-[#E8DED1] bg-white px-3 py-1.5">
          <span className="text-[9px] uppercase tracking-[0.18em] text-[#A99786]">{pfUiT("ui.components.workspace.projectjournal.912f91b2ef")}</span>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <strong className="truncate font-serif text-[17px] text-[#2E241C]">{context.styleName}</strong>
            <span className="shrink-0 text-[11px] text-[#7A6A5B]">{context.styleCode || ''}</span>
          </div>
        </div>
        <div className="rounded-[14px] border border-[#E8DED1] bg-white px-3 py-1.5">
          <span className="text-[9px] uppercase tracking-[0.18em] text-[#A99786]">{pfUiT("ui.components.workspace.projectjournal.a7900c3062")}</span>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <strong className="truncate font-serif text-[17px] text-[#2E241C]">{context.variantName}</strong>
            <span className="shrink-0 text-[11px] text-[#7A6A5B]">{context.variantCode || ''}</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid items-stretch gap-2.5 lg:grid-cols-[minmax(260px,0.82fr)_minmax(420px,1.18fr)]">
        <label className="flex min-h-[92px] flex-col justify-center rounded-[16px] border border-[#E8DED1] bg-white px-3.5 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.164525932e")}</span>
          <select
            value={selectedTask?.id || ''}
            disabled={Boolean(activeTimer) || !tasks.length}
            onChange={(event) => setSelectedTaskId(event.target.value)}
            className="mt-2 h-10 w-full rounded-[14px] border border-[#DED2C4] bg-[#FFFDF9] px-3 text-sm text-[#2E241C] disabled:opacity-60"
          >
            {!tasks.length && <option value="">{pfUiT("ui.components.workspace.projectjournal.7b7ca2f005")}</option>}
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.label}</option>)}
          </select>
        </label>

        <div className="flex min-h-[92px] flex-col items-center justify-center rounded-[16px] border border-[#E8DED1] bg-[#F7EFE6] px-3 py-2 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#A06E46]">{statusLabel}</span>
          <div className="mt-1 max-w-full font-mono text-[clamp(2.2rem,5vw,3.7rem)] font-black leading-none tracking-[-0.07em] text-[#2E241C]">
            {formatDuration(elapsed)}
          </div>
          <p className="mt-2 max-w-full truncate text-xs text-[#7A6A5B]">{activeTimer?.taskLabel || selectedTask?.label || 'Select a task to begin'}</p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-2">
            {!activeTimer && (
              <button type="button" disabled={!selectedTask || !assignment} onClick={startTimer} className="inline-flex items-center gap-2 rounded-full bg-[#2E241C] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white disabled:opacity-40">
                <Play className="h-4 w-4" />{pfUiT("ui.components.workspace.projectjournal.2161a5639a")}</button>
            )}
            {activeTimer?.status === 'running' && (
              <button type="button" onClick={pauseTimer} className="inline-flex items-center gap-2 rounded-full border border-[#B78A5A] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#7A4B2C]">
                <Pause className="h-4 w-4" />{pfUiT("ui.components.workspace.projectjournal.c7231e9464")}</button>
            )}
            {activeTimer?.status === 'paused' && (
              <button type="button" onClick={startTimer} className="inline-flex items-center gap-2 rounded-full bg-[#2E241C] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white">
                <Play className="h-4 w-4" />{pfUiT("ui.components.workspace.projectjournal.a37d85369e")}</button>
            )}
            {activeTimer && activeTimer.status !== 'finished' && (
              <button type="button" onClick={finishTimer} className="inline-flex items-center gap-2 rounded-full bg-[#A06E46] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-white">
                <Square className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.50dc576504")}</button>
            )}
            <button type="button" disabled={!isFinished} onClick={logSession} className="inline-flex items-center gap-2 rounded-full border border-[#DED2C4] bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#2E241C] disabled:opacity-35">
              <Check className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.29de77a9f7")}</button>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.f18e9b9305")}</span>
          <textarea
            value={activeTimer?.notes || ''}
            disabled={!activeTimer}
            onChange={(event) => patchActiveTimer({ notes: event.target.value })}
            rows={3}
            className="h-[118px] w-full resize-none rounded-[14px] border border-[#DED2C4] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#2E241C] disabled:bg-[#F4F0EA]"
            placeholder={pfUiT("ui.components.workspace.projectjournal.dcef035510")}
          />
        </label>

        <SessionPhotoStudio
          disabled={!activeTimer}
          photos={activeTimer?.photos || []}
          onAppendPhoto={(photo) => {
            if (!activeTimer) return;
            patchActiveTimer({ photos: [...(activeTimer.photos || []), photo] });
          }}
        />
      </div>

      {isFinished && (
        <div className="mt-3 rounded-[12px] border border-[#D6C2AD] bg-[#FBF5ED] px-3 py-2 text-xs text-[#6E5E50]">{pfUiT("ui.components.workspace.projectjournal.e5b4e29062")}<strong className="text-[#2E241C]">{formatDuration(elapsed)}</strong>{pfUiT("ui.components.workspace.projectjournal.97081ea516")}<strong>{pfUiT("ui.components.workspace.projectjournal.29de77a9f7")}</strong>.
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onMove={moveLightbox}
        />
      )}
    </section>
  );
}

function ProjectTasksPanel({ store, updateStore, context, assignment, sessions, selectedTaskId, setSelectedTaskId }) {
  const tasks = assignment.tasksSnapshot || [];
  const completed = tasks.filter((task) => task.completed).length;
  const total = tasks.length || 1;
  const progress = Math.round((completed / total) * 100);

  const toggleTask = (taskId) => {
    updateStore((current) => ({
      ...current,
      assignments: {
        ...(current.assignments || {}),
        [context.contextKey]: {
          ...assignment,
          updatedAt: nowIso(),
          tasksSnapshot: (assignment.tasksSnapshot || []).map((task) => (
            task.id === taskId
              ? {
                  ...task,
                  completed: !task.completed,
                  completedAt: !task.completed ? nowIso() : null
                }
              : task
          ))
        }
      }
    }));
  };

  return (
    <section className="rounded-[22px] border border-[#DED2C4] bg-[#FFFDF9] p-4 shadow-[0_18px_50px_rgba(77,61,45,0.07)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#A06E46]">{pfUiT("ui.components.workspace.projectjournal.5811130035")}</span>
          <h3 className="mt-1 font-serif text-2xl text-[#2E241C]">{completed} of {tasks.length} tasks completed</h3>
        </div>
        <div className="rounded-full border border-[#DED2C4] bg-white px-4 py-2 text-sm font-bold text-[#7A4B2C]">{progress}% Complete</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFE3D6]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#9C6A43] to-[#D5A170]" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 max-h-[330px] overflow-auto rounded-[18px] border border-[#E8DED1] bg-white">
        {tasks.map((task) => {
          const taskTime = getTaskTimeMs(sessions, context.contextKey, task.id);
          const active = task.id === selectedTaskId || store.activeTimer?.taskId === task.id;
          return (
            <div key={task.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#F1E9DE] px-4 py-3 last:border-b-0 ${active ? 'bg-[#F9F1E7]' : ''}`}>
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                className={`flex h-5 w-5 items-center justify-center rounded-[6px] border ${task.completed ? 'border-[#7A4B2C] bg-[#7A4B2C] text-white' : 'border-[#CDBBA8] bg-white text-transparent'}`}
                aria-label={task.completed ? 'Reopen task' : 'Complete task'}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setSelectedTaskId(task.id)} className="min-w-0 text-left">
                <span className={`block truncate text-sm font-semibold ${task.completed ? 'text-[#8B7A6A]' : 'text-[#2E241C]'}`}>{task.label}</span>
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#A99786]">{active ? 'Active task' : `Task ${task.order}`}</span>
              </button>
              <span className="font-mono text-xs font-bold text-[#7A4B2C]">{formatDuration(taskTime, true)}</span>
            </div>
          );
        })}
        {!tasks.length && <p className="p-5 text-center text-sm text-[#7A6A5B]">{pfUiT("ui.components.workspace.projectjournal.ba676d6991")}</p>}
      </div>
    </section>
  );
}

function SessionJournal({ sessions, assignment, context }) {
  const [lightbox, setLightbox] = useState(null);
  const tasks = assignment?.tasksSnapshot || [];
  const totalLogged = sessions.reduce((sum, session) => sum + Number(session.elapsedMs || 0), 0);
  const tasksWithTime = tasks.filter((task) => getTaskTimeMs(sessions, context.contextKey, task.id) > 0).length;

  const moveLightbox = (direction) => {
    setLightbox((current) => {
      if (!current) return current;
      const nextIndex = (current.index + direction + current.photos.length) % current.photos.length;
      return { ...current, index: nextIndex };
    });
  };

  return (
    <section className="rounded-[22px] border border-[#DED2C4] bg-[#FFFDF9] p-4 shadow-[0_18px_50px_rgba(77,61,45,0.07)]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#A06E46]">{pfUiT("ui.components.workspace.projectjournal.ae5359983e")}</span>
          <h3 className="mt-1 font-serif text-2xl text-[#2E241C]">{context.styleName} / {context.variantName}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="min-w-[76px] rounded-[10px] bg-[#F7EFE6] px-2.5 py-1.5">
            <span className="block text-[9px] uppercase tracking-[0.12em] text-[#8B7A6A]">{pfUiT("ui.components.workspace.projectjournal.fc5877ba96")}</span>
            <strong className="mt-0.5 block text-sm text-[#2E241C]">{formatDuration(totalLogged, true)}</strong>
          </div>
          <div className="min-w-[70px] rounded-[10px] bg-[#F7EFE6] px-2.5 py-1.5">
            <span className="block text-[9px] uppercase tracking-[0.12em] text-[#8B7A6A]">{pfUiT("ui.components.workspace.projectjournal.806665464f")}</span>
            <strong className="mt-0.5 block text-sm text-[#2E241C]">{sessions.length}</strong>
          </div>
          <div className="min-w-[88px] rounded-[10px] bg-[#F7EFE6] px-2.5 py-1.5">
            <span className="block text-[9px] uppercase tracking-[0.12em] text-[#8B7A6A]">{pfUiT("ui.components.workspace.projectjournal.3b435a4b4d")}</span>
            <strong className="mt-0.5 block text-sm text-[#2E241C]">{tasksWithTime} / {tasks.length}</strong>
          </div>
        </div>
      </div>

      <div className="mt-3 max-h-[340px] space-y-1.5 overflow-auto pr-1">
        {sessions.map((session) => (
          <article key={session.id} className="rounded-[14px] border border-[#E8DED1] bg-white px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[#A99786]">
                    {session.endedAt ? new Date(session.endedAt).toLocaleDateString() : 'Session'}
                  </span>
                  <span className="text-xs text-[#7A6A5B]">{session.variantName}</span>
                  {session.taskTemplateVersionLabel && (
                    <span className="rounded-full bg-[#F7EFE6] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#7A4B2C]">
                      {session.taskTemplateVersionLabel}
                    </span>
                  )}
                  {session.measurementChartRevision && (
                    <span className="rounded-full border border-[#E5D6C4] bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A6A48]">
                      Chart {session.measurementChartRevision}
                    </span>
                  )}
                  {session.actor?.name && (
                    <span className="rounded-full bg-[#F4F0EA] px-2 py-0.5 text-[9px] font-semibold text-[#7A6A5B]">
                      {session.actor.name}
                    </span>
                  )}
                </div>
                <h4 className="mt-1 truncate text-sm font-semibold text-[#2E241C]">{session.taskLabel}</h4>
              </div>
              <span className="shrink-0 rounded-full bg-[#F7EFE6] px-2.5 py-1 text-xs font-bold text-[#7A4B2C]">{formatDuration(session.elapsedMs, true)}</span>
            </div>

            {session.notes && (
              <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-[#6E5E50]">{session.notes}</p>
            )}

            {!!session.photos?.length && (
              <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {session.photos.slice(0, 5).map((photo, index) => (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => setLightbox({ photos: session.photos, index })}
                    className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-[#E8DED1]"
                  >
                    <img src={photo.dataUrl} alt={photo.name || 'Session photo'} className="h-full w-full object-cover" />
                  </button>
                ))}
                {session.photos.length > 5 && (
                  <button type="button" onClick={() => setLightbox({ photos: session.photos, index: 5 })} className="h-10 shrink-0 rounded-[10px] border border-[#E8DED1] px-3 text-[10px] font-bold text-[#7A4B2C]">
                    +{session.photos.length - 5}
                  </button>
                )}
              </div>
            )}
          </article>
        ))}

        {!sessions.length && (
          <div className="rounded-[16px] border border-dashed border-[#D8C8B8] bg-white/70 p-5 text-center text-sm text-[#7A6A5B]">
            <ImageIcon className="mx-auto h-6 w-6 text-[#B89778]" />
            <p className="mt-2">{pfUiT("ui.components.workspace.projectjournal.66fe0afc0e")}</p>
          </div>
        )}
      </div>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onMove={moveLightbox}
        />
      )}
    </section>
  );
}

export function ProjectJournalModule({
  node,
  variant,
  style,
  project,
  onChange,
  measurementNode,
  workspacePattern,
  currentUser,
  metadata
}) {
  const [store, updateStore] = useProjectJournalStore();
  const [activeSubTab, setActiveSubTab] = useState('session');
  const context = useMemo(() => createProjectContext({ project, style, variant }), [project, style, variant]);
  const actor = useMemo(
    () => resolveJournalActor(currentUser),
    [currentUser]
  );
  const assignment = ensureAssignment(store, context);
  const sessions = useMemo(
    () => (store.sessions || []).filter((session) => session.contextKey === context.contextKey),
    [context.contextKey, store.sessions]
  );
  const tasks = assignment?.tasksSnapshot || [];
  const [selectedTaskId, setSelectedTaskId] = useState(() => tasks.find((task) => !task.completed)?.id || tasks[0]?.id || '');

  useEffect(() => {
    const currentTasks = assignment?.tasksSnapshot || [];
    if (!currentTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(currentTasks.find((task) => !task.completed)?.id || currentTasks[0]?.id || '');
    }
  }, [assignment?.tasksSnapshot, selectedTaskId]);

  const subTabs = [
    { id: 'session', label: pfUiT('ui.projectJournal.tabs.session', {}, 'Session') },
    { id: 'progress', label: pfUiT('ui.projectJournal.tabs.progress', {}, 'Project Progress') },
    { id: 'measurements', label: pfUiT('ui.projectJournal.tabs.measurements', {}, 'Fit Session') },
    { id: 'templates', label: pfUiT('ui.projectJournal.tabs.templates', {}, 'Task Templates') }
  ];

  return (
    <div className="space-y-4 bg-[#F8F3ED]">
      <div className="flex flex-wrap gap-1 rounded-[16px] border border-[#DED2C4] bg-[#FFFDF9] p-1.5">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`rounded-[12px] px-4 py-2 text-xs font-semibold transition ${
              activeSubTab === tab.id
                ? 'bg-[#2E241C] text-white'
                : 'text-[#7A6A5B] hover:bg-[#F2E8DC] hover:text-[#2E241C]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'session' && (
        <div className="space-y-4">
          <ProjectTimerPanel
            store={store}
            updateStore={updateStore}
            context={context}
            assignment={assignment}
            sessions={sessions}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
            measurementNode={measurementNode}
            actor={actor}
          />
          <SessionJournal sessions={sessions} assignment={assignment} context={context} />
        </div>
      )}

      {activeSubTab === 'progress' && (
        <ProjectTasksPanel
          store={store}
          updateStore={updateStore}
          context={context}
          assignment={assignment || { tasksSnapshot: [] }}
          sessions={sessions}
          selectedTaskId={selectedTaskId}
          setSelectedTaskId={setSelectedTaskId}
        />
      )}

      {activeSubTab === 'measurements' && (
        <FitSessionPanel
          measurementNode={measurementNode}
          variant={variant}
          style={style}
          metadata={metadata}
          context={context}
          store={store}
          updateStore={updateStore}
          onChange={onChange}
          actor={actor}
        />
      )}

      {activeSubTab === 'templates' && (
        <TaskTemplateEditor
          store={store}
          updateStore={updateStore}
          assignment={assignment}
          context={context}
        />
      )}
    </div>
  );
}

export function ProjectFocusWindow() {
  const [store, updateStore] = useProjectJournalStore();
  const timer = store.activeTimer;
  const [tick, setTick] = useState(Date.now());
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMove = (event) => {
      if (dragRef.current) {
        const { startX, startY, origin } = dragRef.current;
        patchFocus({
          x: Math.max(8, origin.x + event.clientX - startX),
          y: Math.max(8, origin.y + event.clientY - startY)
        });
      }
      if (resizeRef.current) {
        const { startX, startY, origin } = resizeRef.current;
        patchFocus({
          width: Math.min(560, Math.max(280, origin.width + event.clientX - startX)),
          height: Math.min(720, Math.max(160, origin.height + event.clientY - startY))
        });
      }
    };
    const handleUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  });

  if (!timer || timer.focus?.open === false) {
    return null;
  }

  const focus = {
    ...DEFAULT_FOCUS,
    ...(timer.focus || {})
  };
  const elapsed = getElapsedMs(timer, tick);

  function patchFocus(patch) {
    updateStore((current) => ({
      ...current,
      activeTimer: current.activeTimer
        ? {
            ...current.activeTimer,
            focus: {
              ...DEFAULT_FOCUS,
              ...(current.activeTimer.focus || {}),
              ...patch
            },
            updatedAt: nowIso()
          }
        : current.activeTimer
    }));
  }

  const patchTimer = (patch) => {
    updateStore((current) => ({
      ...current,
      activeTimer: current.activeTimer
        ? {
            ...current.activeTimer,
            ...patch,
            updatedAt: nowIso()
          }
        : current.activeTimer
    }));
  };

  const pause = () => patchTimer({
    status: 'paused',
    accumulatedMs: getElapsedMs(timer),
    lastStartedAt: null
  });

  const resume = () => patchTimer({
    status: 'running',
    lastStartedAt: nowIso()
  });

  const finish = () => {
    if (timer.status === 'finished') return;
    patchTimer({
      status: 'finished',
      accumulatedMs: getElapsedMs(timer),
      lastStartedAt: null,
      finishedAt: nowIso()
    });
  };

  const logSession = () => {
    if (!timer || timer.status !== 'finished') return;
    const session = createSessionRecordFromTimer(timer);
    updateStore((current) => ({
      ...current,
      activeTimer: null,
      sessions: [session, ...(current.sessions || [])]
    }));
  };

  const discardSession = () => {
    if (!timer) return;
    const shouldDiscard = window.confirm(
      'Exit this session without logging it? The current timer, notes and attached session photos will be discarded.'
    );
    if (!shouldDiscard) return;

    updateStore((current) => ({
      ...current,
      activeTimer: null
    }));
  };

  const appendPhoto = (photo) => {
    patchTimer({
      photos: [...(timer.photos || []), photo]
    });
  };

  return (
    <div
      className="fixed z-[1200] overflow-hidden rounded-[22px] border border-[#D9B68E] bg-[#FFF8EF] text-[#2E241C] shadow-[0_24px_90px_rgba(46,36,28,0.28)]"
      style={{
        left: focus.x,
        top: focus.y,
        width: focus.width,
        height: focus.minimized ? 58 : focus.height
      }}
    >
      <div
        className="flex cursor-grab items-center justify-between gap-2 bg-[#2E241C] px-3 py-2 text-[#FFF8EF]"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            origin: { x: focus.x, y: focus.y }
          };
        }}
      >
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]">
          <GripHorizontal className="h-4 w-4 text-[#D9B68E]" />{pfUiT("ui.components.workspace.projectjournal.823977a5e5")}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => patchFocus({ minimized: !focus.minimized })} className="rounded-full p-1.5 hover:bg-white/10" aria-label={pfUiT("ui.components.workspace.projectjournal.99685a6413")}>
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={discardSession} className="rounded-full p-1.5 hover:bg-white/10" aria-label={pfUiT("ui.components.workspace.projectjournal.ae6caf4181")}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!focus.minimized && (
        <div className="flex h-[calc(100%-42px)] flex-col overflow-y-auto p-4">
          <div>
            <h3 className="font-serif text-xl text-[#2E241C]">{timer.styleName} / {timer.variantName}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#A06E46]">{timer.taskLabel}</p>
          </div>
          <div className="my-5 rounded-[20px] bg-[#F7EFE6] px-4 py-5 text-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#8B7A6A]">{timer.status === 'running' ? 'Recording' : timer.status === 'paused' ? 'Paused' : 'Session finished'}</span>
            <div className="mt-1 font-mono text-4xl font-black tracking-[-0.05em]">{formatDuration(elapsed)}</div>
          </div>
          <textarea
            value={timer.notes || ''}
            onChange={(event) => patchTimer({ notes: event.target.value })}
            className="min-h-[86px] resize-none rounded-[16px] border border-[#DED2C4] bg-white px-3 py-2 text-xs leading-relaxed"
            placeholder={pfUiT("ui.components.workspace.projectjournal.1f153840a7")}
          />

          <div className="mt-3">
            <SessionPhotoStudio
              compact
              photos={timer.photos || []}
              onAppendPhoto={appendPhoto}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {timer.status === 'running' && (
              <>
                <button type="button" onClick={pause} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#B78A5A] bg-white py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7A4B2C]">
                  <Pause className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.c7231e9464")}</button>
                <button type="button" onClick={finish} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#A06E46] py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
                  <TimerReset className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.35d65659aa")}</button>
              </>
            )}

            {timer.status === 'paused' && (
              <>
                <button type="button" onClick={resume} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#2E241C] py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
                  <Play className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.a37d85369e")}</button>
                <button type="button" onClick={finish} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#A06E46] py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
                  <TimerReset className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.35d65659aa")}</button>
              </>
            )}

            {timer.status === 'finished' && (
              <>
                <button type="button" onClick={logSession} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#2E241C] py-2 text-xs font-bold uppercase tracking-[0.14em] text-white">
                  <Check className="h-3.5 w-3.5" />{pfUiT("ui.components.workspace.projectjournal.29de77a9f7")}</button>
                <button type="button" onClick={() => patchFocus({ minimized: true })} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#B78A5A] bg-white py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7A4B2C]">{pfUiT("ui.components.workspace.projectjournal.40a3057eab")}</button>
              </>
            )}
          </div>
        </div>
      )}

      {!focus.minimized && (
        <button
          type="button"
          className="absolute bottom-1 right-1 h-5 w-5 cursor-nwse-resize rounded-br-[18px] border-b-2 border-r-2 border-[#A06E46]"
          aria-label={pfUiT("ui.components.workspace.projectjournal.657101b278")}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            resizeRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              origin: { width: focus.width, height: focus.height }
            };
          }}
        />
      )}
    </div>
  );
}
