import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import {
  Activity,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Pause,
  Play,
  RotateCcw,
  RefreshCw,
  Save,
  Square,
  Trash2,
  Upload,
  Video,
  X
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { UI_LAYERS } from '../../lib/uiLayers';
import { createIndexedDbRecordStore } from '../../lib/clientBinaryCache';

const STUDY_MEDIA_DB = 'perfectfit_time_study_media_v1';
const STUDY_MEDIA_STORE = 'clips';
const studyMediaBinaryCache = createIndexedDbRecordStore({
  dbName: STUDY_MEDIA_DB,
  storeName: STUDY_MEDIA_STORE
});

function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function saveStudyClip(id, blob, metadata = {}) {
  if (!blob) return null;
  return studyMediaBinaryCache.put({ id, blob, ...metadata });
}

async function loadStudyClip(id) {
  const record = await studyMediaBinaryCache.get(id);
  return record?.blob || null;
}

function average(values = []) {
  const valid = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function calculateOperation(operation, defaults) {
  const observations = Array.isArray(operation.observations) ? operation.observations : [];
  const observedTime = observations.length
    ? average(observations.map((item) => item.durationSeconds))
    : Number(operation.observedTime || 0);
  const ratingFactor = Number(operation.ratingFactor ?? defaults.ratingDefault ?? 100);
  const allowanceFactor = Number(operation.allowanceFactor ?? defaults.allowanceDefault ?? 12);
  const normalTime = observedTime * (ratingFactor / 100);
  const sam = (normalTime * (1 + allowanceFactor / 100)) / 60;
  return {
    ...operation,
    observations,
    observedTime: Number(observedTime.toFixed(2)),
    ratingFactor,
    allowanceFactor,
    normalTime: Number(normalTime.toFixed(2)),
    sam: Number(sam.toFixed(4))
  };
}

function formatTimecode(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const hundredths = Math.floor((safe % 1) * 100);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function downloadBlob(blob, fileName) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function TimeAndMotionStudy({
  metadata,
  t,
  operations = [],
  onOperationsChange,
  studyData = {},
  onStudyDataChange,
  activePatternId = '',
  designerCode = '',
  patternName = ''
}) {
  const sewingConfig = metadata?.sewing?.timeMotion || {};
  const evidencePolicy = sewingConfig.evidencePolicy || {};
  const evidenceAssetClass = evidencePolicy.assetClass || 'SEWING_STUDY';
  const evidenceVisibility = evidencePolicy.defaultVisibility || 'PRIVATE';

  const defaults = sewingConfig.defaults || {};
  const tr = (key) => (typeof t === 'function' ? t(key) : key);

  const normalizedOperations = useMemo(
    () => operations.map((operation) => calculateOperation(operation, defaults)),
    [operations, defaults.ratingDefault, defaults.allowanceDefault]
  );

  const [studyMode, setStudyMode] = useState('VIDEO');
  const [videoSource, setVideoSource] = useState('NONE');
  const [studySequenceMode, setStudySequenceMode] = useState('SEQUENCE');
  const [selectedOpId, setSelectedOpId] = useState(normalizedOperations[0]?.id || '');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [activeVideoT1, setActiveVideoT1] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [noteCategory, setNoteCategory] = useState(sewingConfig.annotationTypes?.[0]?.code || 'OTHER');
  const [helpOpen, setHelpOpen] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceTime, setPracticeTime] = useState(0);
  const [practicePlaying, setPracticePlaying] = useState(false);

  const [cameraStream, setCameraStream] = useState(null);
  const cameraStreamRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [cameraRecordingMode, setCameraRecordingMode] = useState('FULL_STUDY');
  const [cameraSessionRecording, setCameraSessionRecording] = useState(false);
  const [cameraOperationRunning, setCameraOperationRunning] = useState(false);
  const cameraOperationStartRef = useRef(0);
  const cameraRecorderRef = useRef(null);
  const cameraRecorderChunksRef = useRef([]);
  const cameraRecorderContextRef = useRef(null);

  const [liveElapsed, setLiveElapsed] = useState(0);
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const liveStartedAtRef = useRef(0);
  const liveAccumulatedRef = useRef(0);

  const videoElementRef = useRef(null);
  const webCamRef = useRef(null);
  const uploadedObjectUrlRef = useRef('');

  const annotations = Array.isArray(studyData.annotations) ? studyData.annotations : [];
  const clips = Array.isArray(studyData.clips) ? studyData.clips : [];

  useEffect(() => {
    if (!selectedOpId || !normalizedOperations.some((operation) => operation.id === selectedOpId)) {
      setSelectedOpId(normalizedOperations[0]?.id || '');
    }
  }, [normalizedOperations, selectedOpId]);

  useEffect(() => {
    const video = videoElementRef.current;
    if (!video) return undefined;
    const onTime = () => setVideoTime(video.currentTime || 0);
    const onDuration = () => setVideoDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onPlay = () => setIsVideoPlaying(true);
    const onPause = () => setIsVideoPlaying(false);
    const onEnded = () => setIsVideoPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [videoUrl]);

  useEffect(() => {
    const interval = isLiveRunning
      ? window.setInterval(() => {
          const elapsed = (performance.now() - liveStartedAtRef.current) / 1000;
          setLiveElapsed(liveAccumulatedRef.current + elapsed);
        }, 50)
      : null;
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [isLiveRunning]);

  useEffect(() => {
    const interval = practicePlaying
      ? window.setInterval(() => setPracticeTime((value) => (value >= 30 ? 0 : value + 0.05)), 50)
      : null;
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [practicePlaying]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (uploadedObjectUrlRef.current) URL.revokeObjectURL(uploadedObjectUrlRef.current);
  }, []);

  const selectedOperation = normalizedOperations.find((operation) => operation.id === selectedOpId) || null;

  const updateOperations = (nextOperations) => {
    onOperationsChange?.(nextOperations.map((operation) => calculateOperation(operation, defaults)));
  };

  const patchOperation = (operationId, patch) => {
    updateOperations(
      normalizedOperations.map((operation) =>
        operation.id === operationId ? calculateOperation({ ...operation, ...patch }, defaults) : operation
      )
    );
  };

  const addObservation = (operationId, observation) => {
    const operation = normalizedOperations.find((item) => item.id === operationId);
    if (!operation) return;
    patchOperation(operationId, {
      observations: [
        ...(operation.observations || []),
        {
          id: makeId('obs'),
          capturedAt: new Date().toISOString(),
          ...observation
        }
      ],
      standardStatus: operation.standardStatus === 'APPROVED' ? 'REVIEW' : operation.standardStatus || 'DRAFT'
    });
  };

  const selectNextOperation = () => {
    if (studySequenceMode !== 'SEQUENCE' || !selectedOpId || !normalizedOperations.length) return;
    const currentIndex = normalizedOperations.findIndex((operation) => operation.id === selectedOpId);
    const next = normalizedOperations[currentIndex + 1] || normalizedOperations[0];
    if (next) setSelectedOpId(next.id);
  };

  const setStudyValues = (patch) => {
    onStudyDataChange?.({ ...studyData, ...patch });
  };

  const handleVideoUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const maxBytes = Number(sewingConfig.mediaLimits?.maxUploadMb || 250) * 1024 * 1024;
    if (maxBytes && file.size > maxBytes) {
      window.showToast?.(tr('sewing.timeMotion.toast.videoTooLarge'), 'warning');
      return;
    }
    if (uploadedObjectUrlRef.current) URL.revokeObjectURL(uploadedObjectUrlRef.current);
    const url = URL.createObjectURL(file);
    uploadedObjectUrlRef.current = url;
    setVideoUrl(url);
    setVideoFileName(file.name);
    setVideoSource('UPLOADED');
    setVideoTime(0);
    setActiveVideoT1(null);
  };

  const toggleUploadedVideo = async () => {
    const video = videoElementRef.current;
    if (!video) return;
    if (video.paused) {
      video.playbackRate = videoPlaybackRate;
      try { await video.play(); } catch {}
    } else {
      video.pause();
    }
  };

  const seekVideo = (seconds) => {
    const next = Math.max(0, Math.min(videoDuration || 0, Number(seconds || 0)));
    if (videoElementRef.current) videoElementRef.current.currentTime = next;
    setVideoTime(next);
  };

  const captureVideoStart = async () => {
    if (!selectedOperation || videoSource !== 'UPLOADED' || !videoElementRef.current) return;
    const video = videoElementRef.current;
    const t1 = video.currentTime;
    setActiveVideoT1(t1);
    video.playbackRate = videoPlaybackRate;
    try { await video.play(); } catch {}
  };

  const captureVideoEnd = () => {
    if (!selectedOperation || activeVideoT1 === null || videoSource !== 'UPLOADED' || !videoElementRef.current) return;
    const video = videoElementRef.current;
    const t2 = video.currentTime;
    video.pause();
    if (t2 <= activeVideoT1) {
      window.showToast?.(tr('sewing.timeMotion.toast.invalidRange'), 'warning');
      return;
    }
    addObservation(selectedOperation.id, {
      source: 'UPLOADED_VIDEO',
      t1: Number(activeVideoT1.toFixed(3)),
      t2: Number(t2.toFixed(3)),
      durationSeconds: Number((t2 - activeVideoT1).toFixed(3))
    });
    setActiveVideoT1(null);
    selectNextOperation();
  };

  const startCamera = async (facingMode = cameraFacingMode) => {
    setCameraError('');

    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCameraFacingMode(facingMode);
      setVideoSource('CAMERA');
    } catch (error) {
      console.error(error);
      setCameraError(tr('sewing.timeMotion.camera.error'));
    }
  };

  const toggleCameraFacingMode = async () => {
    if (cameraSessionRecording || cameraOperationRunning) return;
    const nextFacingMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    await startCamera(nextFacingMode);
  };
useEffect(() => {
  if (!cameraStream || !webCamRef.current) return;

  const video = webCamRef.current;

  video.srcObject = cameraStream;

  video.play().catch((error) => {
    console.error('Camera preview play failed:', error);
  });

  return () => {
    if (video.srcObject === cameraStream) {
      video.srcObject = null;
    }
  };
}, [cameraStream, videoSource]);

  const stopCamera = () => {
    if (cameraRecorderRef.current?.state === 'recording') {
      cameraRecorderRef.current.stop();
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraSessionRecording(false);
    setCameraOperationRunning(false);
    if (webCamRef.current) webCamRef.current.srcObject = null;
  };

  const persistRecordedBlob = async (blob, context) => {
    const clipId = makeId('clip');
    const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
    const clip = {
      id: clipId,
      operationId: context.operationId || null,
      kind: context.kind,
      mimeType: blob.type,
      fileName: `${designerCode || activePatternId || 'study'}-${context.kind.toLowerCase()}-${Date.now()}.${extension}`,
      durationSeconds: context.durationSeconds || null,
      assetClass: evidenceAssetClass,
      visibility: evidenceVisibility,
      frontendSurface: evidencePolicy.frontendSurface || 'SEWING_ONLY',
      customerEligible: evidencePolicy.customerEligible === true,
      mediaTabVisible: evidencePolicy.mediaTabVisible === true,
      shareableFromMediaTab: evidencePolicy.shareableFromMediaTab === true,
      createdAt: new Date().toISOString()
    };
    try {
      await saveStudyClip(clipId, blob, clip);
      setStudyValues({ clips: [...clips, clip] });
    } catch (error) {
      console.error(error);
      window.showToast?.(tr('sewing.timeMotion.toast.clipSaveFailed'), 'error');
    }
  };

  const beginRecorder = (context) => {
    const stream = cameraStreamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') return false;
    const supported = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported?.(type));
    const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
    cameraRecorderChunksRef.current = [];
    cameraRecorderContextRef.current = context;
    recorder.ondataavailable = (event) => {
      if (event.data?.size) cameraRecorderChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const chunks = cameraRecorderChunksRef.current;
      const recorderContext = cameraRecorderContextRef.current || context;
      if (chunks.length) {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
        await persistRecordedBlob(blob, recorderContext);
      }
      cameraRecorderChunksRef.current = [];
      cameraRecorderContextRef.current = null;
    };
    recorder.start();
    cameraRecorderRef.current = recorder;
    return true;
  };

  const stopRecorder = () => {
    const recorder = cameraRecorderRef.current;
    if (recorder?.state === 'recording') recorder.stop();
    cameraRecorderRef.current = null;
  };

  const toggleFullCameraRecording = () => {
    if (!cameraStreamRef.current) return;
    if (cameraSessionRecording) {
      stopRecorder();
      setCameraSessionRecording(false);
      return;
    }
    if (beginRecorder({ kind: 'FULL_STUDY', operationId: null })) {
      setCameraSessionRecording(true);
    }
  };

  const startCameraOperation = () => {
    if (!selectedOperation || !cameraStreamRef.current || cameraOperationRunning) return;
    cameraOperationStartRef.current = performance.now();
    if (cameraRecordingMode === 'OPERATION_CLIPS') {
      beginRecorder({ kind: 'OPERATION_CLIP', operationId: selectedOperation.id });
    }
    setCameraOperationRunning(true);
  };

  const endCameraOperation = () => {
    if (!selectedOperation || !cameraOperationRunning) return;
    const durationSeconds = (performance.now() - cameraOperationStartRef.current) / 1000;
    if (cameraRecordingMode === 'OPERATION_CLIPS') {
      if (cameraRecorderContextRef.current) {
        cameraRecorderContextRef.current.durationSeconds = Number(durationSeconds.toFixed(3));
      }
      stopRecorder();
    }
    addObservation(selectedOperation.id, {
      source: 'LIVE_CAMERA',
      durationSeconds: Number(durationSeconds.toFixed(3))
    });
    setCameraOperationRunning(false);
    selectNextOperation();
  };

  const toggleLiveTimer = () => {
    if (isLiveRunning) {
      const elapsed = (performance.now() - liveStartedAtRef.current) / 1000;
      liveAccumulatedRef.current += elapsed;
      setLiveElapsed(liveAccumulatedRef.current);
      setIsLiveRunning(false);
    } else {
      liveStartedAtRef.current = performance.now();
      setIsLiveRunning(true);
    }
  };

  const resetLiveTimer = () => {
    liveAccumulatedRef.current = 0;
    setLiveElapsed(0);
    setIsLiveRunning(false);
  };

  const recordLiveCycle = () => {
    if (!selectedOperation || liveElapsed <= 0) return;
    addObservation(selectedOperation.id, {
      source: 'LIVE_STOPWATCH',
      durationSeconds: Number(liveElapsed.toFixed(3))
    });
    liveAccumulatedRef.current = 0;
    setLiveElapsed(0);
    if (isLiveRunning) liveStartedAtRef.current = performance.now();
    selectNextOperation();
  };

  const addAnnotation = (categoryCode = noteCategory) => {
    if (!noteText.trim() && categoryCode === 'OTHER') return;
    const category = sewingConfig.annotationTypes?.find((item) => item.code === categoryCode);
    const annotation = {
      id: makeId('annotation'),
      timestamp: Number(videoTime.toFixed(3)),
      operationId: selectedOpId || null,
      category: categoryCode,
      note: noteText.trim() || tr(category?.labelKey),
      createdAt: new Date().toISOString()
    };
    setStudyValues({ annotations: [...annotations, annotation] });
    setNoteText('');
  };

  const deleteAnnotation = (annotationId) => {
    setStudyValues({ annotations: annotations.filter((item) => item.id !== annotationId) });
  };

  const approveStandards = () => {
    const now = new Date().toISOString();
    updateOperations(normalizedOperations.map((operation) => ({ ...operation, standardStatus: 'APPROVED', approvedAt: now })));
    const currentRevision = Number(studyData.approvedRevision || 0);
    setStudyValues({ approvedRevision: currentRevision + 1, approvedAt: now });
    window.showToast?.(tr('sewing.timeMotion.toast.approved'), 'success');
  };

  const exportCsv = () => {
    const headers = [
      'Step', 'Operation', 'Observations', 'Average observed seconds', 'Rating %', 'PF&D %', 'Normal seconds', 'SAM minutes', 'Status'
    ];
    const rows = normalizedOperations.map((operation) => [
      operation.step || '',
      `"${String(operation.op || operation.title || '').replace(/"/g, '""')}"`,
      operation.observations?.length || 0,
      operation.observedTime.toFixed(2),
      operation.ratingFactor,
      operation.allowanceFactor,
      operation.normalTime.toFixed(2),
      operation.sam.toFixed(4),
      operation.standardStatus || 'DRAFT'
    ]);
    const blob = new Blob([[headers.join(','), ...rows.map((row) => row.join(','))].join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `${designerCode || activePatternId || 'perfectfit'}-time-study.csv`);
  };

  const openClip = async (clip) => {
    try {
      const blob = await loadStudyClip(clip.id);
      if (!blob) return;
      downloadBlob(blob, clip.fileName || `${clip.id}.webm`);
    } catch (error) {
      console.error(error);
    }
  };

  const totalSam = normalizedOperations.reduce((sum, operation) => sum + (operation.sam || 0), 0);
  const observationCount = normalizedOperations.reduce((sum, operation) => sum + (operation.observations?.length || 0), 0);
  const studiedOperationCount = normalizedOperations.filter((operation) => (operation.observations?.length || 0) > 0).length;
  const samChart = normalizedOperations
    .filter((operation) => operation.sam > 0)
    .map((operation) => ({
      name: operation.step ? `${operation.step}` : operation.op?.slice(0, 12),
      sam: operation.sam,
      operation: operation.op || operation.title
    }));

  return (
    <div className="min-h-0 space-y-3 pb-20 sm:pb-3" id="time-and-motion-container">
      <div className="flex flex-col gap-2 rounded-[10px] border border-sand-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ba6446]/10 text-[#ba6446]">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-bark-900">{tr('sewing.timeMotion.title')}</div>
            <div className="truncate text-[9px] text-bark-450">{patternName || activePatternId}</div>
          </div>
        </div>
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-1.5 sm:flex sm:w-auto">
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex h-7 items-center gap-1 rounded-lg border border-sand-200 bg-white px-2.5 text-[9px] font-semibold text-bark-700">
            <HelpCircle className="h-3.5 w-3.5" /> {tr('sewing.timeMotion.help')}
          </button>
          <select value={studySequenceMode} onChange={(event) => setStudySequenceMode(event.target.value)} className="h-9 min-w-0 rounded-lg border border-sand-200 bg-sand-50 px-2 text-[10px] font-semibold text-bark-700 sm:h-7 sm:text-[9px]">
            {(sewingConfig.sequenceModes || []).map((mode) => <option key={mode.code} value={mode.code}>{tr(mode.labelKey)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(430px,1fr)]">
        <section className="min-w-0 rounded-[12px] border border-sand-200 bg-white p-2.5 sm:p-3">
          <div className="sticky top-0 z-20 mb-3 flex items-center justify-between gap-2 rounded-lg border border-sand-100 bg-sand-50/95 p-1 backdrop-blur sm:static sm:border-0">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1 sm:flex sm:items-center">
              {(sewingConfig.studyModes || []).map((mode) => {
                const Icon = mode.code === 'VIDEO' ? Video : Clock;
                return (
                  <button key={mode.code} type="button" onClick={() => setStudyMode(mode.code)} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold sm:h-9 sm:justify-start sm:px-3 sm:text-[12px] ${studyMode === mode.code ? 'bg-white text-[#ba6446] shadow-sm' : 'text-bark-550'}`}>
                    <Icon className="h-3.5 w-3.5" /> {tr(mode.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {studyMode === 'VIDEO' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-150 pb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-[0.12em] text-bark-450">{tr('sewing.timeMotion.source.title')}</span>
                <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                  <label className={`inline-flex h-10 cursor-pointer items-center justify-center sm:h-8 items-center gap-1.5 rounded-lg border px-3 text-[9px] font-semibold ${videoSource === 'UPLOADED' ? 'border-[#ba6446] bg-[#ba6446]/5 text-[#ba6446]' : 'border-sand-200 bg-white text-bark-700'}`}>
                    <Upload className="h-3.5 w-3.5" /> {tr('sewing.timeMotion.source.upload')}
                    <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  </label>
                  <button type="button" onClick={cameraStream ? stopCamera : startCamera} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-[9px] font-semibold sm:h-8 ${cameraStream ? 'border-bark-900 bg-bark-900 text-white' : 'border-sand-200 bg-white text-bark-700'}`}>
                    <Camera className="h-3.5 w-3.5" /> {cameraStream ? tr('sewing.timeMotion.camera.off') : tr('sewing.timeMotion.camera.on')}
                  </button>
                  {cameraStream && (
                    <button
                      type="button"
                      onClick={toggleCameraFacingMode}
                      disabled={cameraSessionRecording || cameraOperationRunning}
                      className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-sand-200 bg-white px-3 text-[9px] font-semibold text-bark-700 disabled:cursor-not-allowed disabled:opacity-40 sm:col-auto sm:h-8"
                      title={cameraFacingMode === 'environment' ? 'Switch to front camera' : 'Switch to rear camera'}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {cameraFacingMode === 'environment' ? 'Front camera' : 'Rear camera'}
                    </button>
                  )}
                </div>
              </div>

              <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-bark-900 bg-black sm:aspect-video">
                {videoSource === 'UPLOADED' && videoUrl ? (
                  <video ref={videoElementRef} src={videoUrl} className="h-full w-full object-contain" playsInline />
                ) : cameraStream ? (
                  <video ref={webCamRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-[11px] text-white/55">{tr('sewing.timeMotion.source.empty')}</div>
                )}
                {videoSource === 'UPLOADED' && videoUrl && (
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-bark-950/95 px-3 py-2 text-white">
                    <button type="button" onClick={toggleUploadedVideo} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ba6446]">
                      {isVideoPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <span className="w-16 font-mono text-[9px]">{formatTimecode(videoTime)}</span>
                    <input type="range" min="0" max={videoDuration || 0} step="0.01" value={videoTime} onChange={(event) => seekVideo(Number(event.target.value))} className="min-w-0 flex-1 accent-[#ba6446]" />
                    <span className="w-16 text-right font-mono text-[9px] text-white/60">{formatTimecode(videoDuration)}</span>
                    <div className="flex items-center gap-0.5 rounded border border-white/10 bg-white/5 p-0.5">
                      {[-5, -1, 1, 5].map((frames) => <button key={frames} type="button" onClick={() => seekVideo(videoTime + frames / 30)} className="rounded px-1.5 py-1 font-mono text-[8px] hover:bg-white/10">{frames > 0 ? '+' : ''}{frames}f</button>)}
                    </div>
                  </div>
                )}
              </div>

              {videoSource === 'UPLOADED' && videoUrl && (
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2 py-2">
                    <span className="mr-1 text-[8px] font-mono font-bold uppercase text-bark-450">{tr('sewing.timeMotion.playback')}</span>
                    {(sewingConfig.playbackRates || [0.25, 0.5, 1, 1.5, 2]).map((rate) => <button key={rate} type="button" onClick={() => { setVideoPlaybackRate(rate); if (videoElementRef.current) videoElementRef.current.playbackRate = rate; }} className={`h-7 rounded px-2 text-[9px] font-semibold ${videoPlaybackRate === rate ? 'bg-white text-[#ba6446] shadow-sm' : 'text-bark-600'}`}>{rate}x</button>)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" disabled={!selectedOperation || activeVideoT1 !== null} onClick={captureVideoStart} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-bark-900 px-4 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-35">
                      <Play className="h-3.5 w-3.5" /> {tr('sewing.timeMotion.capture.start')}
                    </button>
                    <button type="button" disabled={!selectedOperation || activeVideoT1 === null} onClick={captureVideoEnd} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ba6446] px-4 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-35">
                      <Square className="h-3.5 w-3.5" /> {tr('sewing.timeMotion.capture.end')}
                    </button>
                  </div>
                </div>
              )}

              {cameraStream && (
                <div className="rounded-[10px] border border-sand-200 bg-sand-50 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono font-bold uppercase text-bark-450">{tr('sewing.timeMotion.camera.recordingMode')}</span>
                      <select value={cameraRecordingMode} onChange={(event) => setCameraRecordingMode(event.target.value)} disabled={cameraSessionRecording || cameraOperationRunning} className="h-8 rounded-lg border border-sand-200 bg-white px-2 text-[9px] font-semibold">
                        {(sewingConfig.recordingModes || []).map((mode) => <option key={mode.code} value={mode.code}>{tr(mode.labelKey)}</option>)}
                      </select>
                    </div>
                    {cameraRecordingMode === 'FULL_STUDY' && (
                      <button type="button" onClick={toggleFullCameraRecording} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[9px] font-semibold ${cameraSessionRecording ? 'bg-red-650 text-white' : 'border border-sand-200 bg-white text-bark-700'}`}>
                        {cameraSessionRecording ? <Square className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} {cameraSessionRecording ? tr('sewing.timeMotion.camera.stopRecording') : tr('sewing.timeMotion.camera.startRecording')}
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!selectedOperation || cameraOperationRunning} onClick={startCameraOperation} className="h-10 rounded-lg bg-bark-900 text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-35">{tr('sewing.timeMotion.capture.start')}</button>
                    <button type="button" disabled={!cameraOperationRunning} onClick={endCameraOperation} className="h-10 rounded-lg bg-[#ba6446] text-[9px] font-bold uppercase tracking-wider text-white disabled:opacity-35">{tr('sewing.timeMotion.capture.end')}</button>
                  </div>
                  {cameraError && <p className="mt-2 text-[9px] text-red-650">{cameraError}</p>}
                </div>
              )}

              {videoSource === 'UPLOADED' && videoUrl && (
                <div className="rounded-[10px] border border-sand-200 bg-white p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-450">{tr('sewing.timeMotion.annotations')}</span>
                    <select value={noteCategory} onChange={(event) => setNoteCategory(event.target.value)} className="h-7 rounded-lg border border-sand-200 bg-sand-50 px-2 text-[8px] font-semibold">
                      {(sewingConfig.annotationTypes || []).map((type) => <option key={type.code} value={type.code}>{tr(type.labelKey)}</option>)}
                    </select>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <input value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder={tr('sewing.timeMotion.annotation.placeholder')} className="h-8 min-w-0 flex-1 rounded-lg border border-sand-200 px-2.5 text-[9px]" />
                    <button type="button" onClick={() => addAnnotation()} className="h-8 rounded-lg bg-[#ba6446] px-3 text-[9px] font-semibold text-white">{tr('sewing.timeMotion.annotation.add')}</button>
                  </div>
                  {annotations.length > 0 && (
                    <div className="mt-2 max-h-28 space-y-1 overflow-auto">
                      {annotations.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-sand-50 px-2 py-1.5 text-[8px]"><button type="button" onClick={() => seekVideo(item.timestamp)} className="font-mono font-bold text-[#ba6446]">{formatTimecode(item.timestamp)}</button><span className="min-w-0 flex-1 truncate text-bark-700">{item.note}</span><button type="button" onClick={() => deleteAnnotation(item.id)} className="text-red-550"><Trash2 className="h-3 w-3" /></button></div>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block sm:hidden">
                <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-bark-500">{tr('sewing.timeMotion.col.operation')}</span>
                <select
                  value={selectedOpId}
                  onChange={(event) => setSelectedOpId(event.target.value)}
                  className="h-11 w-full rounded-lg border border-sand-200 bg-white px-3 text-[12px] font-semibold text-bark-850"
                >
                  {normalizedOperations.map((operation) => (
                    <option key={operation.id} value={operation.id}>
                      {operation.step ? `${operation.step} · ` : ''}{operation.op || operation.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] leading-relaxed text-amber-900"><Info className="mr-1 inline h-3.5 w-3.5" />{tr('sewing.timeMotion.stopwatch.help')}</div>
              <div className="flex flex-col items-center justify-center py-2 sm:py-5">
                <div className={`flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 sm:h-44 sm:w-44 ${isLiveRunning ? 'border-[#ba6446] bg-white' : 'border-sand-200 bg-sand-50'}`}>
                  <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-bark-450">{isLiveRunning ? tr('sewing.timeMotion.stopwatch.running') : tr('sewing.timeMotion.stopwatch.ready')}</span>
                  <strong className="mt-1 font-mono text-4xl text-bark-950">{liveElapsed.toFixed(2)}</strong>
                  <span className="mt-1 max-w-[135px] truncate text-[8px] text-bark-500">{selectedOperation?.op || tr('sewing.timeMotion.operation.none')}</span>
                </div>
              </div>
              <div className="sticky bottom-2 z-20 space-y-2 rounded-[12px] border border-sand-200 bg-white/95 p-2 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                <button type="button" disabled={liveElapsed <= 0 || !selectedOperation} onClick={recordLiveCycle} className="h-14 w-full rounded-lg bg-[#2F7B4A] text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#28683F] active:translate-y-px disabled:cursor-not-allowed disabled:bg-sand-100 disabled:text-bark-300 disabled:shadow-none sm:h-11 sm:text-[9px]">{studySequenceMode === 'SEQUENCE' ? tr('sewing.timeMotion.stopwatch.recordAdvance') : tr('sewing.timeMotion.stopwatch.recordRepeat')}</button>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button type="button" onClick={toggleLiveTimer} className="h-12 rounded-lg bg-bark-900 text-[10px] font-bold uppercase tracking-wider text-white sm:h-10 sm:text-[9px]">{isLiveRunning ? tr('sewing.timeMotion.stopwatch.pause') : tr('sewing.timeMotion.stopwatch.start')}</button>
                  <button type="button" onClick={resetLiveTimer} className="flex h-12 w-12 items-center justify-center rounded-lg border border-sand-200 bg-white text-bark-600 sm:h-10 sm:w-10" aria-label={pfUiT("ui.components.subcomponents.timeandmotionstudy.4ec0bebd02")}><RotateCcw className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-[12px] border border-sand-200 bg-white p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-150 pb-2">
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-bark-500">{tr('sewing.timeMotion.operations.title')}</div>
              <div className="mt-0.5 text-[9px] text-bark-400">{tr('sewing.timeMotion.operations.subtitle')}</div>
            </div>
            <span className="rounded-full bg-sand-100 px-2 py-1 text-[8px] font-semibold text-bark-600">{normalizedOperations.length}</span>
          </div>

          <div className="mt-2 max-h-[48dvh] overflow-auto rounded-lg border border-sand-150 sm:max-h-[410px]">
            <div className="divide-y divide-sand-100 sm:hidden">
              {normalizedOperations.map((operation) => {
                const active = operation.id === selectedOpId;
                return (
                  <button
                    key={operation.id}
                    type="button"
                    onClick={() => setSelectedOpId(operation.id)}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-left ${active ? 'bg-[#ba6446]/5' : 'bg-white'}`}
                  >
                    <span className="flex h-10 min-w-12 items-center justify-center rounded-lg bg-sand-50 px-2 font-mono text-[11px] font-bold text-bark-600">{operation.step}</span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[11px] text-bark-850">{operation.op || operation.title}</strong>
                      <span className="mt-0.5 block text-[9px] text-bark-400">{operation.observations?.length || 0} {tr('sewing.timeMotion.cycles')} · {operation.observedTime.toFixed(2)}s avg · SAM {operation.sam.toFixed(3)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-bark-350" />
                  </button>
                );
              })}
            </div>
            <table className="hidden w-full border-collapse text-left sm:table">
              <thead className="sticky top-0 z-10 bg-sand-50 text-[8px] font-mono uppercase tracking-wider text-bark-500">
                <tr><th className="w-12 px-2 py-2">{tr('sewing.timeMotion.col.step')}</th><th className="px-2 py-2">{tr('sewing.timeMotion.col.operation')}</th><th className="w-14 px-2 py-2 text-center">{tr('sewing.timeMotion.col.cycles')}</th><th className="w-16 px-2 py-2 text-center">{tr('sewing.timeMotion.col.avg')}</th><th className="w-16 px-2 py-2 text-center">SAM</th></tr>
              </thead>
              <tbody>
                {normalizedOperations.map((operation) => {
                  const active = operation.id === selectedOpId;
                  return <tr key={operation.id} onClick={() => setSelectedOpId(operation.id)} className={`cursor-pointer border-t border-sand-100 text-[9px] ${active ? 'bg-[#ba6446]/5' : 'hover:bg-sand-50'}`}><td className="px-2 py-2 font-mono font-bold text-bark-500">{operation.step}</td><td className="px-2 py-2"><strong className="block text-bark-850">{operation.op || operation.title}</strong><span className="text-[8px] text-bark-400">{operation.standardStatus || 'DRAFT'}</span></td><td className="px-2 py-2 text-center font-mono">{operation.observations?.length || 0}</td><td className="px-2 py-2 text-center font-mono">{operation.observedTime.toFixed(2)}s</td><td className="px-2 py-2 text-center font-mono font-bold text-[#ba6446]">{operation.sam.toFixed(3)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>

          {selectedOperation && (
            <div className="mt-2 rounded-lg border border-sand-150 bg-sand-50 p-2.5">
              <div className="flex items-center justify-between gap-2"><strong className="truncate text-[9px] text-bark-850">{selectedOperation.op || selectedOperation.title}</strong><span className="text-[8px] font-mono text-[#ba6446]">{selectedOperation.observations?.length || 0} {tr('sewing.timeMotion.cycles')}</span></div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-[8px] font-semibold text-bark-500">{tr('sewing.timeMotion.rating')} <span className="float-right font-mono text-bark-800">{selectedOperation.ratingFactor}%</span><input type="range" min={defaults.ratingMin ?? 60} max={defaults.ratingMax ?? 140} step={defaults.ratingStep ?? 5} value={selectedOperation.ratingFactor} onChange={(event) => patchOperation(selectedOperation.id, { ratingFactor: Number(event.target.value) })} className="mt-1 w-full accent-[#ba6446]" /></label>
                <label className="text-[8px] font-semibold text-bark-500">{tr('sewing.timeMotion.allowance')} <span className="float-right font-mono text-bark-800">{selectedOperation.allowanceFactor}%</span><input type="range" min={defaults.allowanceMin ?? 5} max={defaults.allowanceMax ?? 25} step={defaults.allowanceStep ?? 1} value={selectedOperation.allowanceFactor} onChange={(event) => patchOperation(selectedOperation.id, { allowanceFactor: Number(event.target.value) })} className="mt-1 w-full accent-emerald-600" /></label>
              </div>
              {(selectedOperation.observations?.length || 0) > 0 && <div className="mt-2 flex flex-wrap gap-1">{selectedOperation.observations.map((observation, index) => <span key={observation.id} className="rounded bg-white px-1.5 py-1 font-mono text-[8px] text-bark-650">#{index + 1} {Number(observation.durationSeconds || 0).toFixed(2)}s</span>)}</div>}
            </div>
          )}

          {clips.length > 0 && (
            <div className="mt-2 rounded-lg border border-sand-150 bg-white p-2.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[8px] font-mono font-bold uppercase tracking-wider text-bark-500">{tr('sewing.timeMotion.clips')}</div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[7px] font-bold uppercase tracking-wider text-amber-800">
                  {tr('sewing.timeMotion.evidence.private')}
                </span>
              </div>
              <p className="mb-1.5 text-[8px] leading-relaxed text-bark-400">
                {tr('sewing.timeMotion.evidence.privateHelp')}
              </p>
              <div className="max-h-24 space-y-1 overflow-auto">
                {clips.slice().reverse().map((clip) => <button type="button" key={clip.id} onClick={() => openClip(clip)} title={tr('sewing.timeMotion.evidence.download')} className="flex w-full items-center justify-between rounded bg-sand-50 px-2 py-1.5 text-left text-[8px] hover:bg-sand-100"><span className="truncate">{clip.fileName}</span><Download className="h-3 w-3 shrink-0" /></button>)}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-[12px] border border-sand-200 bg-white p-3">
          <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#ba6446]">{tr('sewing.timeMotion.summary')}</div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-sand-50 p-2 text-center"><span className="block text-[7px] uppercase text-bark-450">{tr('sewing.timeMotion.kpi.sam')}</span><strong className="font-mono text-[14px] text-[#ba6446]">{totalSam.toFixed(3)}</strong></div>
            <div className="rounded-lg bg-sand-50 p-2 text-center"><span className="block text-[7px] uppercase text-bark-450">{tr('sewing.timeMotion.kpi.cycles')}</span><strong className="font-mono text-[14px] text-bark-900">{observationCount}</strong></div>
            <div className="rounded-lg bg-sand-50 p-2 text-center"><span className="block text-[7px] uppercase text-bark-450">{tr('sewing.timeMotion.kpi.coverage')}</span><strong className="font-mono text-[14px] text-bark-900">{studiedOperationCount}/{normalizedOperations.length}</strong></div>
          </div>
          <div className="mt-2 grid gap-1.5">
            <button type="button" onClick={approveStandards} disabled={!observationCount} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#ba6446] text-[9px] font-bold uppercase tracking-wider text-white disabled:bg-sand-100 disabled:text-bark-300"><Save className="h-3.5 w-3.5" />{tr('sewing.timeMotion.approve')}</button>
            <button type="button" onClick={exportCsv} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-sand-200 bg-white text-[9px] font-bold uppercase tracking-wider text-bark-700"><FileSpreadsheet className="h-3.5 w-3.5 text-emerald-650" />{tr('sewing.timeMotion.export')}</button>
          </div>
        </div>
        <div className="rounded-[12px] border border-sand-200 bg-white p-3">
          <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-bark-500">{tr('sewing.timeMotion.chart.samContribution')}</div>
          <div className="mt-2 h-40">
            {samChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={samChart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#eee8df" /><XAxis dataKey="name" fontSize={8} /><YAxis fontSize={8} /><Tooltip formatter={(value) => [`${Number(value).toFixed(4)} min`, 'SAM']} labelFormatter={(label, payload) => payload?.[0]?.payload?.operation || label} /><Bar dataKey="sam" fill="#ba6446" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[9px] text-bark-400">{tr('sewing.timeMotion.chart.empty')}</div>}
          </div>
        </div>
      </section>

      {helpOpen && (
        <div className="fixed inset-0 flex items-end justify-center bg-bark-950/25 p-0 sm:items-center sm:p-4" style={{ zIndex: UI_LAYERS.modalBackdrop }} onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
          <div className="max-h-[88dvh] w-full overflow-auto rounded-t-[18px] border border-sand-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[14px]" style={{ zIndex: UI_LAYERS.modal }}>
            <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ba6446]">{tr('sewing.timeMotion.help')}</div><h3 className="mt-1 text-[16px] font-semibold text-bark-950">{tr('sewing.timeMotion.help.title')}</h3></div><button type="button" onClick={() => setHelpOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-sand-50"><X className="h-4 w-4" /></button></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{(sewingConfig.helpSteps || []).map((step, index) => <div key={step.code} className="rounded-lg border border-sand-150 bg-sand-50 p-3"><span className="text-[8px] font-mono font-bold text-[#ba6446]">{String(index + 1).padStart(2, '0')}</span><strong className="ml-2 text-[10px] text-bark-850">{tr(step.titleKey)}</strong><p className="mt-1 text-[9px] leading-relaxed text-bark-500">{tr(step.descriptionKey)}</p></div>)}</div>
            <div className="mt-3 flex items-center justify-between border-t border-sand-150 pt-3"><p className="text-[9px] text-bark-500">{tr('sewing.timeMotion.practice.description')}</p><button type="button" onClick={() => { setHelpOpen(false); setPracticeOpen(true); }} className="h-8 rounded-lg bg-bark-900 px-3 text-[9px] font-semibold text-white">{tr('sewing.timeMotion.practice.open')}</button></div>
          </div>
        </div>
      )}

      {practiceOpen && (
        <div className="fixed inset-0 flex items-end justify-center bg-bark-950/30 p-0 sm:items-center sm:p-4" style={{ zIndex: UI_LAYERS.modalBackdrop }} onMouseDown={(event) => { if (event.target === event.currentTarget) setPracticeOpen(false); }}>
          <div className="max-h-[88dvh] w-full overflow-auto rounded-t-[18px] border border-sand-200 bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-[14px]" style={{ zIndex: UI_LAYERS.modal }}>
            <div className="flex items-center justify-between"><div><div className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#ba6446]">{tr('sewing.timeMotion.practice.kicker')}</div><h3 className="mt-1 text-[15px] font-semibold text-bark-950">{tr('sewing.timeMotion.practice.title')}</h3></div><button type="button" onClick={() => setPracticeOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-sand-50"><X className="h-4 w-4" /></button></div>
            <div className="mt-3 flex aspect-video flex-col items-center justify-center rounded-lg bg-slate-950 text-white"><div className="relative flex h-24 w-36 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-900"><div className={`h-12 w-1 rounded bg-slate-300 ${practicePlaying ? 'animate-pulse' : ''}`} style={{ transform: `translateY(${practicePlaying ? Math.sin(practiceTime * 15) * 5 : 0}px)` }} /><div className="mt-1 h-0.5 w-20 bg-sand-200" /></div><span className="mt-3 font-mono text-[11px]">{formatTimecode(practiceTime)}</span></div>
            <div className="mt-3 flex items-center justify-between gap-2"><p className="text-[9px] text-bark-500">{tr('sewing.timeMotion.practice.description')}</p><button type="button" onClick={() => setPracticePlaying((value) => !value)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ba6446] px-4 text-[9px] font-semibold text-white">{practicePlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{practicePlaying ? tr('sewing.timeMotion.practice.pause') : tr('sewing.timeMotion.practice.play')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
