import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Clock,
  Video,
  Camera,
  Upload,
  Download,
  ChevronRight,
  ChevronLeft,
  Save,
  Edit,
  Check,
  Activity,
  Sliders,
  Gauge,
  Zap,
  Tv,
  Info,
  Sparkles,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Sample operations for initial load matching the active pattern
const INITIAL_STUDY_STEPS = {
  'sartorial-01': [
    { id: 'op-1', step: '01', op: 'Fuse Front Facings & Waistline Stabilizers', t1: 2.5, t2: 8.8, observedTime: 6.3, ratingFactor: 100, allowanceFactor: 12, normalTime: 6.3, sam: 0.118 },
    { id: 'op-2', step: '02', op: 'Staystitch Front Neckline & Armholes', t1: 10.2, t2: 17.5, observedTime: 7.3, ratingFactor: 95, allowanceFactor: 12, normalTime: 6.94, sam: 0.13 },
    { id: 'op-3', step: '03', op: 'Stitch Bust Darts', t1: 19.1, t2: 32.4, observedTime: 13.3, ratingFactor: 105, allowanceFactor: 12, normalTime: 13.97, sam: 0.261 },
    { id: 'op-4', step: '04', op: 'Construct & Turn Waist Belt Ties', t1: 34.0, t2: 52.1, observedTime: 18.1, ratingFactor: 100, allowanceFactor: 12, normalTime: 18.1, sam: 0.338 }
  ],
  'sartorial-02': [
    { id: 'op-1', step: '01', op: 'Fuse Front Panels, Collar, and Sleeve Cuffs', t1: 1.0, t2: 12.5, observedTime: 11.5, ratingFactor: 100, allowanceFactor: 12, normalTime: 11.5, sam: 0.215 },
    { id: 'op-2', step: '02', op: 'Assemble Epaulettes & Sleeve Carriers', t1: 14.2, t2: 29.8, observedTime: 15.6, ratingFactor: 90, allowanceFactor: 12, normalTime: 14.04, sam: 0.262 },
    { id: 'op-3', step: '03', op: 'Prepare & Stitch Back Storm Shield', t1: 31.0, t2: 55.4, observedTime: 24.4, ratingFactor: 110, allowanceFactor: 12, normalTime: 26.84, sam: 0.501 }
  ],
  'sartorial-03': [
    { id: 'op-1', step: '01', op: 'Overlock Seam Edges of all Leg Panels', t1: 3.0, t2: 16.5, observedTime: 13.5, ratingFactor: 100, allowanceFactor: 12, normalTime: 13.5, sam: 0.252 },
    { id: 'op-2', step: '02', op: 'Sew Front Pleats & Back Waist Darts', t1: 18.2, t2: 32.4, observedTime: 14.2, ratingFactor: 105, allowanceFactor: 12, normalTime: 14.91, sam: 0.278 },
    { id: 'op-3', step: '03', op: 'Assemble & Topstitch Front Slant Pockets', t1: 35.0, t2: 58.2, observedTime: 23.2, ratingFactor: 95, allowanceFactor: 12, normalTime: 22.04, sam: 0.411 }
  ],
  'sartorial-04': [
    { id: 'op-1', step: '01', op: 'Fuse Neckline Curves and Stay-tapes', t1: 2.0, t2: 9.5, observedTime: 7.5, ratingFactor: 100, allowanceFactor: 12, normalTime: 7.5, sam: 0.14 },
    { id: 'op-2', step: '02', op: 'Stitch Asymmetrical Neckline Gather Pleats', t1: 11.0, t2: 26.4, observedTime: 15.4, ratingFactor: 100, allowanceFactor: 12, normalTime: 15.4, sam: 0.288 }
  ]
};

const SAMPLE_CLIPS = [
  { id: 'sample-1', name: '🎬 Sleeve Cuff Micro-Stitching Cycle', duration: 60, desc: 'Detailed seam assembly and single needle stitching close-up.' },
  { id: 'sample-2', name: '🎬 Welt Pocket Double Needle Prep', duration: 90, desc: 'Industrial welt pocket pocketing and precision corner cutting study.' },
  { id: 'sample-3', name: '🎬 Collar Joining & Staystitch Run', duration: 120, desc: 'High-speed assembly lines curve handling and collar stand fusion.' }
];

export default function TimeAndMotionStudy({ patterns = [], userProjects = [], activePatternId = 'sartorial-01' }) {
  // --- STATE ---
  const [studyMode, setStudyMode] = useState('video'); // 'video' | 'live'
  const [videoSource, setVideoSource] = useState('simulated'); // 'uploaded' | 'simulated' | 'camera'

  const [selectedSampleId, setSelectedSampleId] = useState('sample-1');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFileName, setVideoFileName] = useState('');

  // List of active operations under study
  const [operations, setOperations] = useState(() => {
    try {
      const saved = localStorage.getItem(`sartorial_study_ops_${activePatternId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load operations state:", e);
    }
    return INITIAL_STUDY_STEPS[activePatternId] || INITIAL_STUDY_STEPS['sartorial-01'];
  });

  // Current active step index for the stopwatch or target video operations
  const [selectedOpId, setSelectedOpId] = useState(operations[0]?.id || '');

  // Live stopwatch states
  const [liveElapsed, setLiveElapsed] = useState(0);
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const liveIntervalRef = useRef(null);

  // Video playback simulation/player states
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1.0);
  const [videoTime, setVideoTime] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(60); // In seconds
  const videoElementRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Camera capture states
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const webCamRef = useRef(null);

  // Inputs for adding a new operation inline
  const [newOpName, setNewOpName] = useState('');
  const [newOpEst, setNewOpEst] = useState('10');

  // Multi-round statistics state
  const [selectedProjectPattern, setSelectedProjectPattern] = useState(activePatternId);

  // Timeline note states for annotation log and pins
  const [timelineNotes, setTimelineNotes] = useState(() => {
    try {
      const saved = localStorage.getItem(`sartorial_time_study_notes_${activePatternId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load timeline notes:", e);
      return [];
    }
  });
  const [noteText, setNoteText] = useState('');

  // --- GUIDED ONBOARDING TOUR CONFIGURATION ---
  const TOUR_STEPS = useMemo(() => [
    {
      title: "🎓 Sewing Motion Study Deck",
      desc: "Welcome to Perfect Fit Bureau's professional engineering suite. This deck enables you to dissection-time sewing cycle videos down to 1/30th of a second for optimal standard allowed minutes.",
      target: "time-and-motion-container",
      actionText: "Begin Tour"
    },
    {
      title: "🎥 Telemetry Footage Sources",
      desc: "Choose where your sewing feed comes from: upload local camera footage, access your floor camera live, or play our high-fidelity simulated Stitch Station Simulator.",
      target: "video-source-selector",
      actionText: "Next Component"
    },
    {
      title: "🕹️ Playhead & Micro-Scrubbing",
      desc: "Analyze stitching sequences with millimeter accuracy. Play or pause, drag the progress bar, and scrub frame-by-frame with high-accuracy stepping controls (-1f / +1f).",
      target: "player-viewport-container",
      actionText: "Next Component"
    },
    {
      title: "🐌 Slow-Motion Precision",
      desc: "Switch the video playback speed from 1x down to 0.25x or 0.5x. Slowing the needle action down allows you to identify ergonomics bottlenecks, postural waste, or thread feed drags.",
      target: "playback-speed-controls",
      actionText: "Next Component"
    },
    {
      title: "⏱️ Instant T1 & T2 Timestamps",
      desc: "Calibrate sewing elements in real-time. Pick an operation in the database, click T1 when the cycle starts, and T2 when completed. The difference becomes the observed element time.",
      target: "timestamp-shortcut-triggers",
      actionText: "Next Component"
    },
    {
      title: "📌 Visual Timeline Annotations",
      desc: "Log critical breaks or quality inspections. Write a short note or use quick pre-made tags (Setup, Stitch, Delay) to drop pins on the playhead. Click any pin to seek directly to that frame.",
      target: "timeline-annotations-panel",
      actionText: "Next Component"
    },
    {
      title: "⏱️ Live Floor Stopwatch",
      desc: "Conduct studies live in the factory floor. Switch to Live mode, stand next to the machine, and tap 'Record Cycle (Lap)' as they sew to auto-advance and log intervals.",
      target: "study-mode-tab-switchers",
      actionText: "Next Component"
    },
    {
      title: "📊 Industrial SAM Calculations",
      desc: "View your calculations instantly. Every logged cycle's raw time is combined with performance Rating and allowance tolerances to calculate Standard Allowed Minutes (SAM).",
      target: "ops-study-grid-scroller",
      actionText: "Finish Tour"
    }
  ], []);

  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Auto-trigger tour on first load
  useEffect(() => {
    const isCompleted = localStorage.getItem('sartorial_motion_tour_done_v1');
    if (!isCompleted) {
      const timer = setTimeout(() => {
        setIsTourActive(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Sync state to current tour step triggers
  useEffect(() => {
    if (isTourActive) {
      const step = TOUR_STEPS[tourStep];
      if (step && step.target) {
        // Automatically switch studyMode if targeting live elements
        if (step.target === 'study-mode-tab-switchers') {
          setStudyMode('live');
        } else {
          setStudyMode('video');
        }

        setTimeout(() => {
          const el = document.getElementById(step.target);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);
      }
    }
  }, [tourStep, isTourActive, TOUR_STEPS]);

  // --- SAVE STATE TO STORAGE ON CHANGE ---
  useEffect(() => {
    localStorage.setItem(`sartorial_study_ops_${selectedProjectPattern}`, JSON.stringify(operations));
  }, [operations, selectedProjectPattern]);

  useEffect(() => {
    localStorage.setItem(`sartorial_time_study_notes_${selectedProjectPattern}`, JSON.stringify(timelineNotes));
  }, [timelineNotes, selectedProjectPattern]);

  const lastOfflineToastTimeRef = useRef(0);

  useEffect(() => {
    // If we are offline and any study operations or notes change, notify the user that it's cached locally
    if (window.isAtelierOffline) {
      const now = Date.now();
      // Show at most once every 12 seconds to prevent rapid trigger spam
      if (now - lastOfflineToastTimeRef.current > 12000) {
        lastOfflineToastTimeRef.current = now;
        if (window.showToast) {
          window.showToast(
            "Working offline. Your time study sequences and notes are being automatically cached in your local browser workspace.",
            "warning",
            "Offline Autosave Active"
          );
        }
      }
    }
  }, [operations, timelineNotes]);

  useEffect(() => {
    const handleSaveShortcut = () => {
      localStorage.setItem(`sartorial_study_ops_${selectedProjectPattern}`, JSON.stringify(operations));
      localStorage.setItem(`sartorial_time_study_notes_${selectedProjectPattern}`, JSON.stringify(timelineNotes));
    };

    window.addEventListener('sartorial-save-shortcut', handleSaveShortcut);
    return () => {
      window.removeEventListener('sartorial-save-shortcut', handleSaveShortcut);
    };
  }, [operations, timelineNotes, selectedProjectPattern]);

  // Handle selected project pattern change
  useEffect(() => {
    const saved = localStorage.getItem(`sartorial_study_ops_${selectedProjectPattern}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setOperations(parsed);
      if (parsed.length > 0) setSelectedOpId(parsed[0].id);
    } else {
      const defaults = INITIAL_STUDY_STEPS[selectedProjectPattern] || INITIAL_STUDY_STEPS['sartorial-01'];
      setOperations(defaults);
      if (defaults.length > 0) setSelectedOpId(defaults[0].id);
    }

    const savedNotes = localStorage.getItem(`sartorial_time_study_notes_${selectedProjectPattern}`);
    if (savedNotes) {
      try {
        setTimelineNotes(JSON.parse(savedNotes));
      } catch (e) {
        setTimelineNotes([]);
      }
    } else {
      setTimelineNotes([]);
    }
  }, [selectedProjectPattern]);

  // --- HTML5 VIDEO EVENT LISTENERS ---
  useEffect(() => {
    const videoNode = videoElementRef.current;
    if (!videoNode) return;

    const handleTimeUpdate = () => {
      setVideoTime(videoNode.currentTime);
    };

    const handleDurationChange = () => {
      if (videoNode.duration) {
        setVideoDuration(videoNode.duration);
      }
    };

    const handleEnded = () => {
      setIsVideoPlaying(false);
    };

    videoNode.addEventListener('timeupdate', handleTimeUpdate);
    videoNode.addEventListener('durationchange', handleDurationChange);
    videoNode.addEventListener('ended', handleEnded);

    return () => {
      videoNode.removeEventListener('timeupdate', handleTimeUpdate);
      videoNode.removeEventListener('durationchange', handleDurationChange);
      videoNode.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl, videoSource]);

  // --- LIVE STOPWATCH INTERVAL ---
  useEffect(() => {
    if (isLiveRunning) {
      liveIntervalRef.current = setInterval(() => {
        setLiveElapsed(prev => prev + 0.1);
      }, 100);
    } else {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    }
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [isLiveRunning]);

  // --- CINEMATIC STUDY SIMULATOR TIMER ---
  // If the user utilizes the simulated timeline, we drive the time with an interval
  useEffect(() => {
    if (isVideoPlaying && videoSource === 'simulated') {
      const step = 0.05; // 50ms intervals
      simIntervalRef.current = setInterval(() => {
        setVideoTime(prev => {
          const next = prev + step * videoPlaybackRate;
          if (next >= videoDuration) {
            setIsVideoPlaying(false);
            return videoDuration;
          }
          return next;
        });
      }, 50);
    } else {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    }
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isVideoPlaying, videoSource, videoPlaybackRate, videoDuration]);

  // --- LIVE CAMERA CONTROLS ---
  useEffect(() => {
    if (videoSource === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [videoSource]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (webCamRef.current) {
          webCamRef.current.srcObject = stream;
        }
      }, 150);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Camera access rejected or unavailable. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  // --- HELPER TIME CONVERTERS ---
  const formatTimecode = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const hundredths = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  };

  const formatShortTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0.00s';
    return `${seconds.toFixed(2)}s`;
  };

  // --- EXPORT TO CSV ---
  const handleExportCSV = () => {
    try {
      const headers = ['Step', 'Operation Name', 'Start T1 (s)', 'End T2 (s)', 'Observed Time (s)', 'Performance Rating (%)', 'Allowance PF&D (%)', 'Normal Time (s)', 'Standard Allowed Minutes (SAM)'];
      const rows = operations.map(op => [
        op.step,
        `"${op.op.replace(/"/g, '""')}"`,
        op.t1 ? op.t1.toFixed(2) : '0.00',
        op.t2 ? op.t2.toFixed(2) : '0.00',
        op.observedTime ? op.observedTime.toFixed(2) : '0.00',
        op.ratingFactor,
        op.allowanceFactor,
        op.normalTime ? op.normalTime.toFixed(2) : '0.00',
        op.sam ? op.sam.toFixed(4) : '0.0000'
      ]);

      const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `sartorial_time_study_${selectedProjectPattern}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (window.showToast) {
        window.showToast("Time study sheet exported successfully as CSV.", "success", "Export Complete");
      }
    } catch (e) {
      console.error(e);
      if (window.showToast) {
        window.showToast("Failed to compile CSV file.", "error", "Export Error");
      }
    }
  };

  // --- SYNC SAM VALUES BACK TO ACTIVE BLUEPRINT SESSIONS ---
  const handleApplySams = () => {
    // Generate notification or toast showing we have saved
    if (window.showToast) {
      const totalSAM = operations.reduce((sum, op) => sum + (op.sam || 0), 0).toFixed(2);
      window.showToast(
        `Applied standard times! New process standard is ${totalSAM} Standard Minutes (SAM).`,
        "success",
        "Standards Engineered"
      );
    }
  };

  // --- TIMING CALCULATORS ---
  const recalculateOpStats = (op) => {
    const obs = op.observedTime || 0;
    const rating = op.ratingFactor || 100;
    const allowance = op.allowanceFactor || 12;
    const norm = obs * (rating / 100);
    const samValue = (norm * (1 + allowance / 100)) / 60; // SAM is in minutes, observed is in seconds
    return {
      ...op,
      normalTime: parseFloat(norm.toFixed(2)),
      sam: parseFloat(samValue.toFixed(4))
    };
  };

  // --- ACTIONS FOR OPERATIONS GRID ---
  const handleAddOperation = (e) => {
    e.preventDefault();
    if (!newOpName.trim()) return;

    const lastStepNum = operations.length > 0 ? parseInt(operations[operations.length - 1].step) || 0 : 0;
    const nextStepCode = (lastStepNum + 1).toString().padStart(2, '0');

    const newOp = recalculateOpStats({
      id: `custom-op-${Date.now()}`,
      step: nextStepCode,
      op: newOpName,
      t1: 0,
      t2: 0,
      observedTime: parseFloat(newOpEst) || 10,
      ratingFactor: 100,
      allowanceFactor: 12
    });

    setOperations(prev => [...prev, newOp]);
    setNewOpName('');
    setSelectedOpId(newOp.id);

    if (window.showToast) {
      window.showToast(`Operation "${newOp.op}" appended to industrial study sheet.`, "success", "Operation Added");
    }
  };

  const handleDeleteOp = (id) => {
    setOperations(prev => {
      const filtered = prev.filter(op => op.id !== id);
      // Clean up step numbering
      return filtered.map((op, idx) => ({
        ...op,
        step: (idx + 1).toString().padStart(2, '0')
      }));
    });
    if (window.showToast) {
      window.showToast("Operation removed from active study sheet.", "info", "Deleted");
    }
  };

  const handleUpdateOpField = (id, field, value) => {
    setOperations(prev => prev.map(op => {
      if (op.id === id) {
        let updated = { ...op, [field]: value };
        // Recalculate observed if we edited T1 or T2
        if (field === 't1' || field === 't2') {
          const t1Val = field === 't1' ? value : op.t1;
          const t2Val = field === 't2' ? value : op.t2;
          updated.observedTime = Math.max(0, t2Val - t1Val);
        }
        return recalculateOpStats(updated);
      }
      return op;
    }));
  };

  // Click start / end timers on the fly for the active element
  const captureTimestamp = (type) => {
    if (type === 't1') {
      handleUpdateOpField(selectedOpId, 't1', videoTime);
    } else {
      const currentOp = operations.find(o => o.id === selectedOpId);
      if (currentOp && videoTime < currentOp.t1) {
        if (window.showToast) {
          window.showToast("End time cannot be prior to start time.", "error", "Timing Error");
        }
        return;
      }
      handleUpdateOpField(selectedOpId, 't2', videoTime);
    }
  };

  // Jump player head directly to timestamp
  const jumpVideoTo = (seconds) => {
    if (videoSource === 'uploaded' && videoElementRef.current) {
      videoElementRef.current.currentTime = seconds;
    } else {
      setVideoTime(seconds);
    }
  };

  // Add a new timeline annotation note at the active playback head time
  const handleAddNote = (e) => {
    e?.preventDefault();
    if (!noteText.trim()) return;

    const newNote = {
      id: `note-${Date.now()}`,
      timestamp: videoTime,
      note: noteText.trim()
    };

    setTimelineNotes(prev => {
      const updated = [...prev, newNote];
      // Sort notes so they appear in sequence on the list and timeline
      return updated.sort((a, b) => a.timestamp - b.timestamp);
    });
    setNoteText('');

    if (window.showToast) {
      window.showToast(`Saved timestamp pin at ${formatTimecode(videoTime)}`, "success", "Note Annotated");
    }
  };

  // --- LIVE STOPWATCH CYCLE TRIGGER (LAP) ---
  const handleLiveLap = () => {
    // Record elapsed time to active operation
    const currentOp = operations.find(o => o.id === selectedOpId);
    if (!currentOp) return;

    handleUpdateOpField(selectedOpId, 'observedTime', liveElapsed);

    // Find next operation index to auto-advance
    const curIdx = operations.findIndex(o => o.id === selectedOpId);
    const nextOp = operations[curIdx + 1] || operations[0];

    setSelectedOpId(nextOp.id);
    setLiveElapsed(0); // Reset stopwatch for next operation element cycle

    if (window.showToast) {
      window.showToast(
        `Recorded ${formatShortTime(liveElapsed)} for "${currentOp.op}". Advancing to next step...`,
        "success",
        "Lap Completed"
      );
    }
  };

  // File Uploader handler
  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoFileName(file.name);
    setVideoSource('uploaded');
    setVideoTime(0);
    setIsVideoPlaying(false);

    if (window.showToast) {
      window.showToast(`Loaded user tailoring video: "${file.name}"`, "success", "Video Imported");
    }
  };

  // --- MEMOIZED CALCULATED TOTALS ---
  const totalSAM = useMemo(() => {
    return operations.reduce((sum, op) => sum + (op.sam || 0), 0);
  }, [operations]);

  const totalObserved = useMemo(() => {
    return operations.reduce((sum, op) => sum + (op.observedTime || 0), 0);
  }, [operations]);

  const chartData = useMemo(() => {
    return operations.map(op => ({
      name: `Step ${op.step}`,
      'Observed (Sec)': parseFloat(op.observedTime.toFixed(1)),
      'SAM x100 (Min)': parseFloat((op.sam * 100).toFixed(1)),
      description: op.op
    }));
  }, [operations]);

  return (
    <div className="space-y-6" id="time-and-motion-container">

      {/* HEADER CONTROLS CARD */}
      <div className="bg-white border border-sand-200 rounded-[4px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#ba6446]/10 text-[#ba6446] rounded">
              <Activity className="w-4 h-4 animate-pulse" />
            </span>
            <h4 className="font-serif text-lg font-bold text-bark-950">
              Tailoring Time &amp; Motion Analyzer
            </h4>
          </div>
          <p className="text-xs text-bark-550 mt-1 max-w-xl font-sans leading-relaxed">
            Perform precision cycle timing and element breakdown for industrial tailoring. Upload video feeds or use real-time stopwatch laps to compute Standard Allowed Minutes (SAM).
          </p>
        </div>

        {/* STUDY BLUEPRINT SELECTOR */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setTourStep(0);
              setIsTourActive(true);
              if (window.showToast) window.showToast("Launching the step-by-step Motion Study interactive onboarding!", "info", "Guided Onboarding");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-850 border border-amber-200 hover:border-amber-350 rounded text-xs font-bold transition-all cursor-pointer shadow-3xs font-mono"
            title="Start Interactive Tour Guide"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Interactive Guide</span>
          </button>

          <div className="space-y-1">
            <label className="text-[8px] font-mono font-bold text-bark-400 uppercase tracking-widest block">
              Active Blueprint Target
            </label>
            <select
              value={selectedProjectPattern}
              onChange={(e) => setSelectedProjectPattern(e.target.value)}
              className="bg-sand-50 border border-sand-250 text-bark-850 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-[#ba6446]"
            >
              {patterns.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {userProjects.length > 0 && userProjects.map(p => (
                <option key={p.id} value={p.id}>Project: {p.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              const defaults = INITIAL_STUDY_STEPS[selectedProjectPattern] || INITIAL_STUDY_STEPS['sartorial-01'];
              setOperations(defaults);
              if (defaults.length > 0) setSelectedOpId(defaults[0].id);
              if (window.showToast) window.showToast("Reset operations list to reference standards.", "info", "Standards Reset");
            }}
            className="p-1.5 mt-4 hover:bg-sand-100 text-bark-500 rounded border border-sand-200 transition-colors"
            title="Reset to Standard Reference Steps"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CORE WORKSPACE SPLIT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" id="study-main-workspace-grid">

        {/* COLUMN 1: VIDEO RECORDER / PLAYER WORKSPACE (6 COLS) */}
        <div className="lg:col-span-6 flex flex-col space-y-4">

          {/* TAB SWITCHERS */}
          <div
            id="study-mode-tab-switchers"
            className={`bg-sand-50 p-1 rounded border flex items-center justify-between transition-all duration-300 ${
              isTourActive && TOUR_STEPS[tourStep]?.target === 'study-mode-tab-switchers'
                ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.01] relative z-40 border-amber-300 bg-amber-50/20'
                : 'border-sand-200'
            }`}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStudyMode('video')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
                  studyMode === 'video'
                    ? 'bg-white text-[#ba6446] shadow-3xs font-bold'
                    : 'text-bark-600 hover:text-bark-900'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>📹 Video Study Deck</span>
              </button>
              <button
                type="button"
                onClick={() => setStudyMode('live')}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
                  studyMode === 'live'
                    ? 'bg-white text-[#ba6446] shadow-3xs font-bold'
                    : 'text-bark-600 hover:text-bark-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏱️ Live Stopwatch Study</span>
              </button>
            </div>

            <span className="text-[9px] font-mono font-bold bg-[#ba6446]/10 text-[#ba6446] px-2 py-0.5 rounded uppercase tracking-wider">
              {studyMode === 'video' ? 'Frame Analysis' : 'Floor Timing'}
            </span>
          </div>

          {/* MODE A: VIDEO DECK & SIMULATOR */}
          {studyMode === 'video' && (
            <div className="bg-white border border-sand-200/90 rounded-[4px] p-4 space-y-4 shadow-3xs flex-1 flex flex-col justify-between">

              {/* VIDEO SOURCE CONTROLLERS */}
              <div
                id="video-source-selector"
                className={`space-y-3 transition-all duration-300 p-2.5 rounded ${
                  isTourActive && TOUR_STEPS[tourStep]?.target === 'video-source-selector'
                    ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.01] relative z-40 bg-amber-50/10 border border-amber-300/40'
                    : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-100 pb-2.5">
                  <span className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                    Telemetry Footage Source
                  </span>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] bg-sand-50 hover:bg-sand-100 text-bark-750 px-2.5 py-1 border border-sand-250 hover:border-[#ba6446] rounded font-bold font-mono transition-all flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3 text-[#ba6446]" />
                      <span>Upload Video File</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setVideoSource('camera')}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                        videoSource === 'camera'
                          ? 'bg-[#ba6446] border-[#ba6446] text-white'
                          : 'bg-white border-sand-250 text-bark-700 hover:bg-sand-50'
                      }`}
                    >
                      <Camera className="w-3 h-3" />
                      <span>Live Camera</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVideoSource('simulated');
                        setVideoUrl('');
                      }}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                        videoSource === 'simulated'
                          ? 'bg-[#ba6446]/10 border-[#ba6446]/25 text-[#ba6446]'
                          : 'bg-white border-sand-250 text-bark-700 hover:bg-sand-50'
                      }`}
                    >
                      <Tv className="w-3 h-3" />
                      <span>Simulator</span>
                    </button>
                  </div>
                </div>

                {videoSource === 'uploaded' && (
                  <div className="bg-sand-50 border border-dashed border-sand-250 p-2 rounded text-[11px] text-bark-700 flex items-center justify-between font-mono">
                    <span className="truncate max-w-[280px]">📁 {videoFileName || 'Custom uploaded file'}</span>
                    <span className="text-emerald-700 font-extrabold text-[9px] uppercase">Active HTML5</span>
                  </div>
                )}
              </div>

              {/* CENTER PLAYER VIEWPORT */}
              <div
                id="player-viewport-container"
                className={`relative bg-black rounded overflow-hidden aspect-video flex flex-col items-center justify-center border transition-all duration-300 ${
                  isTourActive && TOUR_STEPS[tourStep]?.target === 'player-viewport-container'
                    ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_25px_rgba(245,158,11,0.5)] scale-[1.015] relative z-40 border-amber-300'
                    : 'border-bark-900'
                } group`}
              >

                {/* 1. ACTUAL USER UPLOADED VIDEO */}
                {videoSource === 'uploaded' && videoUrl && (
                  <video
                    ref={videoElementRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    controls={false}
                    playsInline
                  />
                )}

                {/* 2. CAMERA VIDEO CHANNEL */}
                {videoSource === 'camera' && (
                  <div className="w-full h-full relative bg-bark-950 flex items-center justify-center">
                    {cameraError ? (
                      <div className="p-4 text-center text-red-400 text-xs font-mono space-y-1.5">
                        <p>⚠️ {cameraError}</p>
                        <button onClick={startCamera} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px]">Retry Device Capture</button>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={webCamRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover transform -scale-x-100"
                        />
                        {/* Interactive Timing HUD Overlay */}
                        <div className="absolute top-3 left-3 bg-red-650/85 backdrop-blur-xs text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-sm flex items-center gap-1.5 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
                          <span>LIVE FLOOR CAMERA HUD</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 3. CINEMATIC ATELIER SIMULATOR (Drawn via beautiful Canvas/CSS components) */}
                {videoSource === 'simulated' && (
                  <div className="w-full h-full relative bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center p-4">
                    {/* Atmospheric Grid Backdrop */}
                    <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                    {/* Simulated Tailoring Head and Sewing Needle */}
                    <div className="relative z-10 flex flex-col items-center text-center space-y-3.5">
                      <div className="relative w-28 h-20 bg-slate-850 border border-slate-700 rounded p-2 shadow-2xl flex flex-col justify-between overflow-hidden">
                        {/* Moving belt mechanism */}
                        <div className="flex justify-between items-center text-[8px] font-mono text-slate-500">
                          <span>GEAR SPEED</span>
                          <span className={`${isVideoPlaying ? 'text-amber-500 animate-pulse' : ''}`}>
                            {videoPlaybackRate.toFixed(2)}x
                          </span>
                        </div>

                        {/* Animated needle stitch indicator */}
                        <div className="flex flex-col items-center relative">
                          <div className="w-1 h-8 bg-slate-400 rounded-b transition-transform duration-75 relative" style={{
                            transform: isVideoPlaying
                              ? `translateY(${Math.sin(videoTime * 15) * 6}px)`
                              : 'translateY(0px)'
                          }}>
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-500 opacity-60" />
                          </div>
                          <div className="w-14 h-0.5 bg-sand-200 mt-1 relative overflow-hidden">
                            {/* Moving fabric strand */}
                            {isVideoPlaying && (
                              <div className="absolute top-0 bottom-0 bg-[#ba6446] w-5 animate-[slideRight_1.5s_linear_infinite]" />
                            )}
                          </div>
                        </div>

                        <span className="text-[9px] font-mono text-slate-400 font-extrabold uppercase">STITCH STATION SIM</span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-350 font-mono tracking-wider font-semibold">
                          {selectedSampleId === 'sample-1' && '🔬 Element: Cuff Edge Alignment & Joining run'}
                          {selectedSampleId === 'sample-2' && '🔬 Element: Welt Flap Folding & Double Needle Hold'}
                          {selectedSampleId === 'sample-3' && '🔬 Element: Collar Point Turn & Staystitch Tensioning'}
                        </p>
                        <p className="text-[9px] text-slate-500 italic max-w-xs font-sans">
                          A beautiful visual timeline simulator that synchronizes precise video timecodes for cycle estimations.
                        </p>
                      </div>
                    </div>

                    {/* HUD Metadata Overlay */}
                    <div className="absolute bottom-3 right-3 font-mono text-[8px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                      FRAME: {Math.floor(videoTime * 30)} | COMP: SEW-A
                    </div>
                  </div>
                )}

                {/* BOTTOM FLOATING PLAYHEAD BAR */}
                <div className="absolute bottom-0 left-0 right-0 bg-bark-950/95 backdrop-blur-xs p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-white border-t border-white/5 opacity-90 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className="p-1.5 rounded-full bg-[#ba6446] text-white hover:bg-[#a25135] transition-colors cursor-pointer shrink-0"
                    >
                      {isVideoPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white pl-0.5" />}
                    </button>
                    <span className="text-[10px] font-mono text-bark-300 hidden sm:inline">PLAY</span>
                  </div>

                  {/* TIMELINE SLIDER WITH OVERLAID PINS */}
                  <div className="flex-1 flex items-center gap-2.5 relative">
                    <span className="text-[10px] font-mono text-bark-200">{formatTimecode(videoTime)}</span>

                    <div className="flex-1 relative flex items-center h-8 select-none">
                      {/* The range input slider */}
                      <input
                        type="range"
                        min="0"
                        max={videoDuration}
                        step="0.01"
                        value={videoTime}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          jumpVideoTo(val);
                        }}
                        className="w-full accent-[#ba6446] bg-white/20 h-1.5 rounded-full outline-none cursor-pointer relative z-10"
                      />

                      {/* Overlaid visual markers (pins) for the notes */}
                      {timelineNotes.map((item) => {
                        const pct = videoDuration > 0 ? (item.timestamp / videoDuration) * 100 : 0;
                        const clampedPct = Math.min(98.5, Math.max(1.5, pct));
                        return (
                          <div
                            key={item.id}
                            className="absolute z-20 group/pin cursor-pointer transform -translate-x-1/2"
                            style={{ left: `${clampedPct}%`, top: '16px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              jumpVideoTo(item.timestamp);
                              if (window.showToast) {
                                window.showToast(`Jumped playhead to: "${item.note}"`, "info", "Annotation Seek");
                              }
                            }}
                          >
                            {/* Marker Diamond shape representing the pin */}
                            <div className="w-2.5 h-2.5 rotate-45 bg-amber-400 border border-bark-950 hover:bg-amber-300 hover:scale-125 transition-all shadow-md" />

                            {/* Floating tooltip */}
                            <div className="pointer-events-none opacity-0 group-hover/pin:opacity-100 transition-all duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-bark-950 border border-bark-750 text-white text-[10px] py-1.5 px-2.5 rounded shadow-2xl z-30 min-w-[120px] max-w-[200px] text-center">
                              <span className="font-mono text-[8.5px] text-amber-400 block font-bold mb-0.5">
                                ⏱️ {formatTimecode(item.timestamp)}
                              </span>
                              <span className="font-sans block truncate">{item.note}</span>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-bark-950" />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <span className="text-[10px] font-mono text-bark-400">{formatTimecode(videoDuration)}</span>
                  </div>

                  {/* FRAME BY FRAME STEPPING */}
                  <div className="flex items-center gap-1 shrink-0 bg-white/5 p-0.5 rounded border border-white/10">
                    <button
                      type="button"
                      onClick={() => jumpVideoTo(Math.max(0, videoTime - 5 * (1/30)))}
                      className="px-1.5 py-1 rounded hover:bg-white/10 text-[9px] font-mono font-bold transition-colors cursor-pointer"
                      title="Step Backward 5 Frames (-0.17s)"
                    >
                      -5f
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpVideoTo(Math.max(0, videoTime - 1 * (1/30)))}
                      className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[9px] font-mono font-bold transition-colors border border-white/10 cursor-pointer"
                      title="Step Backward 1 Frame (-0.03s)"
                    >
                      -1f
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpVideoTo(Math.min(videoDuration, videoTime + 1 * (1/30)))}
                      className="px-1.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[9px] font-mono font-bold transition-colors border border-white/10 cursor-pointer"
                      title="Step Forward 1 Frame (+0.03s)"
                    >
                      +1f
                    </button>
                    <button
                      type="button"
                      onClick={() => jumpVideoTo(Math.min(videoDuration, videoTime + 5 * (1/30)))}
                      className="px-1.5 py-1 rounded hover:bg-white/10 text-[9px] font-mono font-bold transition-colors cursor-pointer"
                      title="Step Forward 5 Frames (+0.17s)"
                    >
                      +5f
                    </button>
                  </div>
                </div>
              </div>

              {/* TIMELINE CONTROL AND CALIBRATION PANEL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">

                {/* VIDEO PLAYBACK RATE SPEED SELECTOR */}
                <div
                  id="playback-speed-controls"
                  className={`space-y-1 transition-all duration-300 p-2.5 rounded ${
                    isTourActive && TOUR_STEPS[tourStep]?.target === 'playback-speed-controls'
                      ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.01] relative z-40 bg-amber-50/10 border border-amber-300/40'
                      : ''
                  }`}
                >
                  <label className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                    Playback Analysis Speed (Slow-Mo)
                  </label>
                  <div className="flex items-center gap-1 bg-sand-50 p-1 rounded border border-sand-200">
                    {[0.25, 0.5, 1.0, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setVideoPlaybackRate(rate);
                          if (videoElementRef.current) {
                            videoElementRef.current.playbackRate = rate;
                          }
                        }}
                        className={`flex-1 text-[10px] font-mono py-1 rounded transition-all ${
                          videoPlaybackRate === rate
                            ? 'bg-white text-[#ba6446] shadow-3xs font-extrabold border border-sand-150'
                            : 'text-bark-550 hover:text-bark-850'
                        }`}
                      >
                        {rate === 1.0 ? '1x Normal' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ADVANCED TIMING SHORTCUT TRIGGERS */}
                <div
                  id="timestamp-shortcut-triggers"
                  className={`space-y-1 transition-all duration-300 p-2.5 rounded ${
                    isTourActive && TOUR_STEPS[tourStep]?.target === 'timestamp-shortcut-triggers'
                      ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.01] relative z-40 bg-amber-50/10 border border-amber-300/40'
                      : ''
                  }`}
                >
                  <label className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                    Record Timestamp For Active Element
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => captureTimestamp('t1')}
                      className="px-3 py-1.5 bg-white border border-sand-300 hover:border-[#ba6446] hover:bg-sand-50 text-[10.5px] font-semibold text-bark-800 rounded flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Set Start (T1)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => captureTimestamp('t2')}
                      className="px-3 py-1.5 bg-white border border-sand-300 hover:border-[#ba6446] hover:bg-sand-50 text-[10.5px] font-semibold text-bark-800 rounded flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Set End (T2)</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* DEFAULT SAMPLE CLIPS SELECTOR */}
              {videoSource === 'simulated' && (
                <div className="bg-sand-50/70 border border-sand-200 rounded p-3 space-y-2 mt-2">
                  <span className="text-[9px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                    Study Library Clips
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SAMPLE_CLIPS.map((clip) => (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => {
                          setSelectedSampleId(clip.id);
                          setVideoDuration(clip.duration);
                          setVideoTime(0);
                          setIsVideoPlaying(false);
                          // Preset timing ranges based on selected sample to give initial values
                          if (clip.id === 'sample-1') {
                            setOperations(INITIAL_STUDY_STEPS[selectedProjectPattern] || INITIAL_STUDY_STEPS['sartorial-01']);
                          } else {
                            // Scale values
                            setOperations(prev => prev.map((op, i) => ({
                              ...op,
                              t1: i * 15,
                              t2: (i + 1) * 15 - 2,
                              observedTime: 13,
                              ratingFactor: 100,
                              allowanceFactor: 12,
                              normalTime: 13,
                              sam: parseFloat(((13 * 1.12) / 60).toFixed(4))
                            })));
                          }
                        }}
                        className={`text-left p-2 rounded border text-[10.5px] transition-all flex flex-col justify-between ${
                          selectedSampleId === clip.id
                            ? 'bg-white border-[#ba6446] shadow-3xs'
                            : 'bg-white border-sand-200 hover:bg-sand-100/30'
                        }`}
                      >
                        <span className="font-bold text-bark-850 truncate">{clip.name}</span>
                        <span className="text-[8.5px] text-bark-450 mt-1">{clip.desc}</span>
                        <span className="text-[8px] text-bark-400 font-mono mt-1 font-bold">DUR: {clip.duration}s</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TIMELINE ANNOTATIONS CARD */}
              <div
                id="timeline-annotations-panel"
                className={`border-t border-sand-150 pt-4.5 space-y-3.5 transition-all duration-300 p-2 rounded ${
                  isTourActive && TOUR_STEPS[tourStep]?.target === 'timeline-annotations-panel'
                    ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.01] relative z-40 bg-amber-50/10 border border-amber-300/40'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-[#ba6446]/10 text-[#ba6446] rounded">
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-mono font-bold text-bark-850 uppercase tracking-wider">
                      Timeline Annotations &amp; Pins ({timelineNotes.length})
                    </span>
                  </div>
                  {timelineNotes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTimelineNotes([]);
                        if (window.showToast) window.showToast("All annotations cleared for this pattern.", "info", "Cleared");
                      }}
                      className="text-[9px] font-mono text-red-650 hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* SCROLLABLE NOTES LOG */}
                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 text-[11px] font-sans scrollbar-thin">
                  {timelineNotes.length === 0 ? (
                    <div className="text-center py-4 bg-sand-50/40 rounded border border-dashed border-sand-200 text-bark-400 italic">
                      No timestamp notes yet. Set the playhead and add an annotation below.
                    </div>
                  ) : (
                    timelineNotes.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between gap-2 p-1.5 rounded bg-sand-50/60 border border-sand-150 hover:border-sand-250 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <button
                            type="button"
                            onClick={() => jumpVideoTo(note.timestamp)}
                            className="px-1.5 py-0.5 bg-bark-100 hover:bg-[#ba6446]/15 hover:text-[#ba6446] rounded text-[9.5px] font-mono font-bold transition-all text-bark-750 cursor-pointer border border-sand-200"
                            title="Seek to Timestamp"
                          >
                            ⏱️ {formatTimecode(note.timestamp)}
                          </button>
                          <span className="text-bark-800 truncate font-medium">{note.note}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTimelineNotes(prev => prev.filter(n => n.id !== note.id));
                            if (window.showToast) window.showToast("Annotation removed.", "info", "Deleted");
                          }}
                          className="text-bark-400 hover:text-red-600 transition-colors cursor-pointer p-1 rounded hover:bg-red-50"
                          title="Delete Annotation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* INPUT FORM */}
                <form onSubmit={handleAddNote} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type a timestamp note (e.g. Needle thread break, Finished dart...)"
                      className="flex-1 bg-sand-50/80 border border-sand-250 hover:border-sand-450 focus:border-[#ba6446] text-bark-850 text-xs rounded px-2.5 py-1.5 focus:outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!noteText.trim()}
                      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        noteText.trim()
                          ? 'bg-[#ba6446] text-white hover:bg-[#a25135] shadow-3xs'
                          : 'bg-sand-100 text-bark-300 border-sand-200 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Pin</span>
                    </button>
                  </div>

                  {/* PRE-MADE TAGS */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold text-bark-400 uppercase tracking-widest mr-1">
                      Quick Tags:
                    </span>
                    {['⚙️ Setup', '🧵 Stitch', '🔍 Inspect', '⚠️ Delay', '📦 Handover'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const tagText = tag;
                          const newNote = {
                            id: `note-${Date.now()}`,
                            timestamp: videoTime,
                            note: tagText
                          };
                          setTimelineNotes(prev => {
                            const updated = [...prev, newNote];
                            return updated.sort((a, b) => a.timestamp - b.timestamp);
                          });
                          if (window.showToast) {
                            window.showToast(`Annotation added at ${formatTimecode(videoTime)}`, "success", "Note Created");
                          }
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-sand-100 text-[10px] text-bark-650 hover:text-bark-900 border border-sand-250 hover:border-sand-350 rounded-sm font-mono cursor-pointer transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </form>
              </div>

            </div>
          )}

          {/* MODE B: LIVE FLOATING CLINICAL WATCH */}
          {studyMode === 'live' && (
            <div className="bg-white border border-sand-200/90 rounded-[4px] p-5 space-y-6 shadow-3xs flex-1 flex flex-col justify-between">

              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200/60 rounded p-3.5 flex items-start gap-3">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed text-amber-900">
                    <span className="font-bold">Real-Time Floor Study Mode Active</span>
                    <p className="mt-1">
                      Mimic industrial engineers on the sewing factory floor. Hold your phone, look at the operator, and click <b className="text-amber-950">"Lap Cycle Time"</b> at the completion of each operation. The cycle is logged instantly, the timer resets, and active step advances automatically!
                    </p>
                  </div>
                </div>

                {/* GIANT ROUND DIAL IN LIVE STOPWATCH */}
                <div className="flex flex-col items-center justify-center py-6 relative">
                  <div className={`w-48 h-48 rounded-full border-2 flex flex-col items-center justify-center transition-all duration-500 relative ${
                    isLiveRunning
                      ? 'border-[#ba6446] bg-white shadow-[0_0_20px_rgba(186,100,70,0.1)]'
                      : 'border-sand-200 bg-sand-50/40'
                  }`}>
                    {isLiveRunning && (
                      <div className="absolute inset-2 border border-dashed border-clay-300 rounded-full animate-[spin_40s_linear_infinite]" />
                    )}

                    <span className="text-[9px] font-mono uppercase tracking-widest text-bark-450 font-bold">
                      {isLiveRunning ? 'TIMING ON AIR' : 'TIMING STOPPED'}
                    </span>

                    <div className="font-mono text-4xl font-extrabold text-bark-950 mt-1 tracking-tight">
                      {liveElapsed.toFixed(1)}s
                    </div>

                    {/* Target SAM of current op */}
                    {(() => {
                      const cur = operations.find(o => o.id === selectedOpId);
                      return cur ? (
                        <div className="text-[8.5px] font-mono text-bark-500 mt-1.5 truncate max-w-[150px]">
                          Step {cur.step}: {cur.op.slice(0, 20)}...
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              </div>

              {/* TIMING ACTION CONTROLLERS */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setIsLiveRunning(!isLiveRunning)}
                    className={`px-6 py-3 rounded-[3px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95 ${
                      isLiveRunning
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-[#ba6446] hover:bg-[#a25135] text-white'
                    }`}
                  >
                    {isLiveRunning ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>{isLiveRunning ? 'Pause Study' : 'Start Study Timer'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isLiveRunning && liveElapsed === 0}
                    onClick={() => setLiveElapsed(0)}
                    className="p-3 bg-white border border-sand-300 hover:bg-sand-50 rounded text-bark-600 cursor-pointer active:scale-95 transition-all"
                    title="Reset Active Watch"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* MULTI-LAP BUTTON (THE HEART OF THE STUDY) */}
                <button
                  type="button"
                  disabled={liveElapsed < 0.5}
                  onClick={handleLiveLap}
                  className={`w-full py-3 rounded-[4px] font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    liveElapsed >= 0.5
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md active:translate-y-0.5'
                      : 'bg-sand-100 text-bark-300 border-sand-200 cursor-not-allowed'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>RECORD CYCLE &amp; ADVANCE (LAP)</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* COLUMN 2: OPERATIONS INDUSTRIAL STUDY SHEET (6 COLS) */}
        <div className="lg:col-span-6 flex flex-col space-y-4" id="study-sheet-operations-container">

          <div className="bg-white border border-sand-200 rounded-[4px] p-4 space-y-4 shadow-3xs flex-1 flex flex-col justify-between">

            <div className="space-y-3.5">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sand-100 pb-2">
                <span className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                  Industrial Element Study Sheet (Observed Times)
                </span>

                <span className="text-[9px] font-mono text-bark-500 font-bold bg-sand-100 px-2 py-0.5 rounded">
                  Elements: {operations.length} | Target: {selectedProjectPattern}
                </span>
              </div>

              {/* GRID SCROLLABLE CONTAINER */}
              <div
                id="ops-study-grid-scroller"
                className={`max-h-[380px] overflow-y-auto border transition-all duration-300 rounded ${
                  isTourActive && TOUR_STEPS[tourStep]?.target === 'ops-study-grid-scroller'
                    ? 'ring-4 ring-amber-400 ring-offset-2 shadow-[0_0_20px_rgba(245,158,11,0.5)] scale-[1.01] relative z-40 bg-amber-50/10 border-amber-300'
                    : 'border-sand-150'
                }`}
              >
                <table className="w-full text-left text-xs font-sans border-collapse">
                  <thead>
                    <tr className="bg-sand-50/85 text-bark-850 border-b border-sand-150 text-[10px] uppercase font-mono tracking-wider">
                      <th className="p-2.5 font-extrabold text-center w-12">Step</th>
                      <th className="p-2.5 font-extrabold">Operation / Sequence Element</th>
                      <th className="p-2.5 font-extrabold text-center w-20">Obs. Time</th>
                      <th className="p-2.5 font-extrabold text-center w-12">Rating</th>
                      <th className="p-2.5 font-extrabold text-center w-12">Allow.</th>
                      <th className="p-2.5 font-extrabold text-center w-16">SAM</th>
                      <th className="p-2.5 font-extrabold text-center w-10">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((op) => {
                      const isActive = op.id === selectedOpId;
                      return (
                        <tr
                          key={op.id}
                          onClick={() => setSelectedOpId(op.id)}
                          className={`border-b border-sand-100 last:border-0 cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-[#ba6446]/5 hover:bg-[#ba6446]/10'
                              : 'hover:bg-sand-50/50'
                          }`}
                        >
                          <td className="p-2 text-center font-mono font-bold text-bark-600">
                            {op.step}
                          </td>
                          <td className="p-2">
                            <div className="space-y-0.5">
                              <span className="font-bold text-bark-900 block leading-tight">{op.op}</span>

                              {/* Sub-timestamps in video mode */}
                              {studyMode === 'video' && (op.t1 > 0 || op.t2 > 0) && (
                                <div className="flex items-center gap-1 text-[9px] text-[#ba6446] font-mono">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      jumpVideoTo(op.t1);
                                    }}
                                    className="hover:underline hover:text-[#a25135] font-extrabold"
                                  >
                                    🎬 Jump T1 ({op.t1.toFixed(1)}s)
                                  </button>
                                  <span>→</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      jumpVideoTo(op.t2);
                                    }}
                                    className="hover:underline hover:text-[#a25135] font-extrabold"
                                  >
                                    Jump T2 ({op.t2.toFixed(1)}s)
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center font-mono">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={op.observedTime}
                              onChange={(e) => handleUpdateOpField(op.id, 'observedTime', parseFloat(e.target.value) || 0)}
                              className="w-16 bg-white border border-sand-250 text-bark-900 font-bold rounded p-1 text-center text-[11px] focus:outline-none focus:border-[#ba6446]"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[9px] text-bark-450 block mt-0.5">secs</span>
                          </td>
                          <td className="p-2 text-center font-mono">
                            <input
                              type="number"
                              min="50"
                              max="150"
                              value={op.ratingFactor}
                              onChange={(e) => handleUpdateOpField(op.id, 'ratingFactor', parseInt(e.target.value) || 100)}
                              className="w-12 bg-white border border-sand-250 text-bark-900 rounded p-1 text-center text-[11px] focus:outline-none focus:border-[#ba6446]"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[9px] text-bark-450 block mt-0.5">%</span>
                          </td>
                          <td className="p-2 text-center font-mono">
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={op.allowanceFactor}
                              onChange={(e) => handleUpdateOpField(op.id, 'allowanceFactor', parseInt(e.target.value) || 12)}
                              className="w-12 bg-white border border-sand-250 text-bark-900 rounded p-1 text-center text-[11px] focus:outline-none focus:border-[#ba6446]"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-[9px] text-bark-450 block mt-0.5">%</span>
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-[#ba6446]">
                            {op.sam.toFixed(3)}
                            <span className="text-[8px] text-bark-400 block font-normal">mins</span>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOp(op.id);
                              }}
                              className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* INLINE TUNING AND RECALCULATOR FOR SELECTED STEP */}
              {(() => {
                const selectedOp = operations.find(o => o.id === selectedOpId);
                if (!selectedOp) return null;
                return (
                  <div className="bg-sand-50/60 rounded p-3 border border-sand-150 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono font-bold text-[#ba6446] uppercase tracking-wider">
                        Active Step Tuning: OP-{selectedOp.step}
                      </span>
                      <span className="text-[9px] font-mono text-bark-500 truncate max-w-[150px]">
                        "{selectedOp.op}"
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-bark-850">
                          <span>Performance Rating:</span>
                          <span className="font-mono font-bold text-[#ba6446]">{selectedOp.ratingFactor}%</span>
                        </div>
                        <input
                          type="range"
                          min="60"
                          max="140"
                          step="5"
                          value={selectedOp.ratingFactor}
                          onChange={(e) => handleUpdateOpField(selectedOp.id, 'ratingFactor', parseInt(e.target.value))}
                          className="w-full accent-[#ba6446]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-medium text-bark-850">
                          <span>PF&amp;D Allowance:</span>
                          <span className="font-mono font-bold text-emerald-700">{selectedOp.allowanceFactor}%</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="25"
                          step="1"
                          value={selectedOp.allowanceFactor}
                          onChange={(e) => handleUpdateOpField(selectedOp.id, 'allowanceFactor', parseInt(e.target.value))}
                          className="w-full accent-emerald-600"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* FORM TO ADD A NEW OPERATION ALONG IN THE LIST */}
            <form onSubmit={handleAddOperation} className="border-t border-sand-150 pt-3.5 space-y-2.5">
              <span className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
                Append Custom Sewing Operation Step
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. Stitch and clean welt binding flaps..."
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  className="flex-1 bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] placeholder-bark-300"
                />

                <div className="flex gap-2">
                  <div className="w-20">
                    <input
                      type="number"
                      placeholder="Est (s)"
                      value={newOpEst}
                      onChange={(e) => setNewOpEst(e.target.value)}
                      className="w-full bg-white border border-sand-250 text-bark-900 text-xs rounded p-2 focus:outline-none focus:border-[#ba6446] text-center"
                      title="Estimated Duration in Seconds"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#ba6446] hover:bg-[#a25135] text-white text-xs font-bold uppercase tracking-wider rounded flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </form>

          </div>

        </div>

      </div>

      {/* SUMMARY PERFORMANCE DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch" id="study-analytics-dashboard">

        {/* KPI MATRIX (4 COLS) */}
        <div className="md:col-span-4 bg-white border border-sand-200 rounded-[4px] p-5 space-y-4 shadow-3xs flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-[#ba6446] uppercase tracking-widest block">
            Engineered Time Standard Summary
          </span>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-sand-50/70 rounded p-3 border border-sand-150/60 text-center">
              <span className="text-[9px] font-mono text-bark-450 uppercase block">Total SAM</span>
              <span className="text-xl font-extrabold font-mono text-[#ba6446]">{totalSAM.toFixed(3)}</span>
              <span className="text-[8.5px] text-bark-400 block mt-0.5">minutes</span>
            </div>

            <div className="bg-sand-50/70 rounded p-3 border border-sand-150/60 text-center">
              <span className="text-[9px] font-mono text-bark-450 uppercase block">Observed Time</span>
              <span className="text-xl font-extrabold font-mono text-bark-900">{totalObserved.toFixed(1)}</span>
              <span className="text-[8.5px] text-bark-400 block mt-0.5">seconds</span>
            </div>

            <div className="bg-sand-50/70 rounded p-3 border border-sand-150/60 text-center col-span-2">
              <span className="text-[9px] font-mono text-bark-450 uppercase block">Estimated Line Capacity</span>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <span className="text-lg font-bold text-emerald-700 font-mono">
                  {totalSAM > 0 ? Math.floor(480 / totalSAM) : 0}
                </span>
                <span className="text-[10px] text-bark-550 font-sans">garments / 8hr shift</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-sand-150 pt-3">
            <button
              onClick={handleApplySams}
              className="w-full py-2 bg-[#ba6446] hover:bg-[#a25135] text-white text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs"
            >
              <Save className="w-4 h-4" />
              <span>Apply Engineered SAMs</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="w-full py-2 bg-white border border-sand-300 hover:bg-sand-50 text-bark-750 text-xs font-bold uppercase tracking-wider rounded flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Study Sheet (CSV)</span>
            </button>
          </div>
        </div>

        {/* COMPARATIVE BAR CHART (8 COLS) */}
        <div className="md:col-span-8 bg-white border border-sand-200 rounded-[4px] p-5 shadow-3xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-bark-450 uppercase tracking-widest block">
              Performance Comparison: Observed Time vs. Engineered Standard (SAM)
            </span>
            <span className="text-[9px] font-mono text-[#ba6446] flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Variance Analyzer</span>
            </span>
          </div>

          <div className="h-56 w-full" id="variance-chart-container">
            {operations.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1eeea" />
                  <XAxis dataKey="name" stroke="#8c7b64" fontSize={10} tickLine={false} />
                  <YAxis stroke="#8c7b64" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5dfd5', borderRadius: '4px' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1c1917' }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '10px', marginTop: '5px' }} />
                  <Bar dataKey="Observed (Sec)" fill="#ba6446" radius={[2, 2, 0, 0]} barSize={25} />
                  <Bar dataKey="SAM x100 (Min)" fill="#10b981" radius={[2, 2, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-bark-400">
                No timed elements to chart. Start capturing durations above.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* INDUSTRIAL ENGINEERING METHODOLOGY CARD */}
      <div className="bg-sand-50 border border-sand-200 rounded-[4px] p-4.5 flex items-start gap-4">
        <div className="p-2 bg-white rounded border border-sand-200 text-[#ba6446] shrink-0">
          <Sliders className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 text-xs text-bark-750 leading-relaxed">
          <h5 className="font-serif font-bold text-bark-900">Garment Industrial Engineering Methodology</h5>
          <p>
            Standard Allowed Minutes (SAM) is computed mathematically as:
            <code className="mx-1 px-1.5 py-0.5 bg-white border border-sand-200 rounded font-mono font-bold text-[#ba6446]">
              SAM = [Observed Time × (Rating / 100) × (1 + Allowance / 100)] / 60
            </code>.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-bark-600 mt-1">
            <li><b>Performance Rating (%):</b> Evaluates the operator's speed compared to a standard qualified operator working at a normal pace (100%). Values above 100% indicate fast-paced specialists; values below represent developing specialists.</li>
            <li><b>PF&amp;D Allowance (%):</b> General personal, fatigue, and unavoidable delay compensation (typically 12-15% in standard textile mills) added to yield a sustainable daily target.</li>
          </ul>
        </div>
      </div>

      {/* GUIDED ONBOARDING TOUR OVERLAY */}
      <AnimatePresence>
        {isTourActive && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-bark-950/45 backdrop-blur-xs">
            {/* Spotlight / backdrop click handler to dismiss */}
            <div
              className="absolute inset-0"
              onClick={() => {
                setIsTourActive(false);
                localStorage.setItem('sartorial_motion_tour_done_v1', 'true');
              }}
            />

            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-white border-2 border-amber-400 rounded-lg shadow-2xl p-5 z-[110] flex flex-col space-y-4"
            >
              {/* Header with step count */}
              <div className="flex items-center justify-between border-b border-sand-150 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Step {tourStep + 1} of {TOUR_STEPS.length}
                  </span>
                  <span className="text-[10px] font-mono text-bark-400">Time &amp; Motion Tour</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsTourActive(false);
                    localStorage.setItem('sartorial_motion_tour_done_v1', 'true');
                    if (window.showToast) window.showToast("Onboarding tour completed. Re-trigger anytime from the top bar!", "success", "Tour Finished");
                  }}
                  className="text-bark-400 hover:text-bark-900 text-xs font-mono transition-colors p-1"
                >
                  Skip
                </button>
              </div>

              {/* Title & Body */}
              <div className="space-y-1.5">
                <h4 className="font-serif text-sm font-extrabold text-bark-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  {TOUR_STEPS[tourStep].title}
                </h4>
                <p className="text-xs text-bark-650 leading-relaxed font-sans">
                  {TOUR_STEPS[tourStep].desc}
                </p>
              </div>

              {/* Step Navigation Controls */}
              <div className="flex items-center justify-between pt-1.5">
                <button
                  type="button"
                  disabled={tourStep === 0}
                  onClick={() => setTourStep(prev => prev - 1)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 transition-all ${
                    tourStep === 0
                      ? 'text-bark-300 cursor-not-allowed'
                      : 'text-bark-750 hover:bg-sand-100 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-1">
                  {TOUR_STEPS.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === tourStep
                          ? 'bg-amber-500 w-3'
                          : 'bg-sand-300'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (tourStep < TOUR_STEPS.length - 1) {
                      setTourStep(prev => prev + 1);
                    } else {
                      setIsTourActive(false);
                      localStorage.setItem('sartorial_motion_tour_done_v1', 'true');
                      if (window.showToast) window.showToast("Onboarding tour completed. Re-trigger anytime from the top bar!", "success", "Tour Finished");
                    }
                  }}
                  className="px-4 py-1.5 bg-[#ba6446] hover:bg-[#a25135] text-white font-bold text-xs uppercase tracking-wider rounded shadow-3xs transition-all cursor-pointer"
                >
                  <span>{TOUR_STEPS[tourStep].actionText}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
