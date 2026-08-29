import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { translatePerfectFitText as pfUiT } from '../../lib/i18n';
import {
  ArrowRight,
  CaseUpper,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CornerDownRight,
  FileImage,
  Link2,
  MousePointer2,
  Redo2,
  Ruler,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

import {
  loadMediaFile
} from './WorkspaceMedia';

const TOOL_ICON_REGISTRY = {
  select: MousePointer2,
  callout: CornerDownRight,
  dimension: Ruler,
  arrow: ArrowRight,
  text: CaseUpper
};

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function getAnnotationSequence(
  annotations,
  mode
) {
  const nextIndex =
    annotations.filter(
      (item) =>
        item.type === 'CALLOUT'
    ).length + 1;

  if (mode === 'ALPHA') {
    let value = nextIndex;
    let label = '';

    while (value > 0) {
      value -= 1;
      label =
        String.fromCharCode(
          65 + (value % 26)
        ) + label;
      value =
        Math.floor(value / 26);
    }

    return label;
  }

  return String(nextIndex);
}

function getReferenceOptions({
  referenceType,
  referenceTypes,
  sewingNode,
  measurementNode
}) {
  const config =
    referenceTypes.find(
      (item) =>
        item.code ===
        referenceType
    );

  if (!config?.source) {
    return [];
  }

  if (
    config.source ===
    'sewing.constructionSteps'
  ) {
    return (
      sewingNode?.values
        ?.constructionSteps || []
    ).map((item) => ({
      id: item.id,
      label: `${
        item.order || ''
      } ${
        item.title ||
        'Construction step'
      }`.trim()
    }));
  }

  if (
    config.source ===
    'sewing.operations'
  ) {
    return (
      sewingNode?.values
        ?.operations || []
    ).map((item) => ({
      id: item.id,
      label: `${
        item.step || ''
      } ${
        item.op ||
        'Operation'
      }`.trim()
    }));
  }

  if (
    config.source ===
    'measurement.measurements'
  ) {
    return (
      measurementNode?.values
        ?.measurements || []
    ).map((item) => ({
      id: item.id,
      label:
        item.code
          ? `${item.code} · ${
              item.label ||
              'Measurement'
            }`
          : item.label ||
            'Measurement'
    }));
  }

  return [];
}

function truncateSvgText(
  value,
  max = 28
) {
  const text =
    String(value || '');

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(
    0,
    Math.max(0, max - 1)
  )}…`;
}

function wrapSvgTextLines(
  value,
  maxChars = 30,
  maxLines = 2
) {
  const words = String(value || 'Callout')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return ['Callout'];

  const lines = [];
  let current = '';

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars || !current) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) {
    lines.push(current);
  }

  if (lines.length <= maxLines) {
    return lines;
  }

  const visible = lines.slice(0, maxLines);
  const lastIndex = visible.length - 1;
  const last = visible[lastIndex] || '';
  visible[lastIndex] =
    last.length >= maxChars
      ? `${last.slice(0, Math.max(0, maxChars - 1))}...`
      : `${last}...`;

  return visible;
}

function DrawingSvg({
  width,
  height,
  imageUrl,
  annotations,
  selectedAnnotationId,
  onSelect,
  onCanvasClick,
  onBeginDrag,
  interactive = true,
  pendingStart = null,
  svgRef = null,
  markerId = 'tp-arrow-marker',
  imageRect = null
}) {
  return (
    <svg
      ref={svgRef}
      className="tp-drawing-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.2b1d68ee82")}
      onClick={
        interactive
          ? onCanvasClick
          : undefined
      }
    >
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,6 L9,3 z"
            fill="currentColor"
          />
        </marker>
      </defs>

      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="12"
        fill="#fffefb"
      />

      <rect
        x="34"
        y="34"
        width={width - 68}
        height={height - 68}
        rx="6"
        fill="none"
        stroke="#e8e0d7"
        strokeWidth="2"
      />

      {imageUrl ? (
        <image
          href={imageUrl}
          x={imageRect?.x ?? 80}
          y={imageRect?.y ?? 90}
          width={imageRect?.width ?? width - 160}
          height={imageRect?.height ?? height - 210}
          preserveAspectRatio="xMidYMid meet"
          opacity="0.98"
          pointerEvents="none"
        />
      ) : (
        <g
          pointerEvents="none"
          opacity="0.7"
        >
          <rect
            x={width * 0.21}
            y={height * 0.24}
            width={width * 0.58}
            height={height * 0.38}
            rx="18"
            fill="#faf7f2"
            stroke="#d9cfc3"
            strokeWidth="2"
            strokeDasharray="10 10"
          />
          <text
            x={width / 2}
            y={height * 0.43}
            textAnchor="middle"
            fill="#8c8075"
            fontFamily="system-ui, sans-serif"
            fontSize="25"
          >{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.ca735791a0")}</text>
        </g>
      )}

      {annotations.map(
        (annotation) => {
          const selected =
            annotation.id ===
            selectedAnnotationId;

          if (
            annotation.type ===
            'CALLOUT'
          ) {
            const anchor =
              annotation.anchor || {
                x: 500,
                y: 700
              };

            const box =
              annotation.box || {
                x: 650,
                y: 650,
                width: 360,
                height: 82
              };

            const joinX =
              box.x >
              anchor.x
                ? box.x
                : box.x +
                  box.width;

            const joinY =
              clamp(
                anchor.y,
                box.y + 12,
                box.y +
                  box.height -
                  12
              );

            const elbowX =
              anchor.x +
              (joinX -
                anchor.x) *
                0.48;
            const calloutLines =
              wrapSvgTextLines(
                annotation.shortText ||
                  'Callout'
              );

            return (
              <g
                key={annotation.id}
                className={`tp-svg-annotation ${
                  selected
                    ? 'is-selected'
                    : ''
                }`}
                onClick={
                  interactive
                    ? (event) => {
                        event.stopPropagation();
                        onSelect?.(
                          annotation.id
                        );
                      }
                    : undefined
                }
              >
                <polyline
                  points={`${anchor.x},${anchor.y} ${elbowX},${anchor.y} ${joinX},${joinY}`}
                  fill="none"
                  stroke={
                    selected
                      ? '#a56542'
                      : '#51443a'
                  }
                  strokeWidth={
                    selected
                      ? 4
                      : 3
                  }
                />

                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r={
                    selected ? 8 : 6
                  }
                  fill="#fffefb"
                  stroke={
                    selected
                      ? '#a56542'
                      : '#51443a'
                  }
                  strokeWidth="3"
                  className={
                    interactive
                      ? 'tp-svg-drag-target'
                      : undefined
                  }
                  onPointerDown={
                    interactive
                      ? (event) =>
                          onBeginDrag?.(
                            event,
                            annotation,
                            'anchor'
                          )
                      : undefined
                  }
                />

                <g
                  className={
                    interactive
                      ? 'tp-svg-drag-target'
                      : undefined
                  }
                  onPointerDown={
                    interactive
                      ? (event) =>
                          onBeginDrag?.(
                            event,
                            annotation,
                            'box'
                          )
                      : undefined
                  }
                >
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    rx="12"
                    fill="#fffdf9"
                    stroke={
                      selected
                        ? '#a56542'
                        : '#57483d'
                    }
                    strokeWidth={
                      selected
                        ? 4
                        : 3
                    }
                  />

                  <circle
                    cx={
                      box.x + 29
                    }
                    cy={
                      box.y +
                      box.height /
                        2
                    }
                    r="17"
                    fill="#2b211a"
                  />

                  <text
                    x={
                      box.x + 29
                    }
                    y={
                      box.y +
                      box.height /
                        2 +
                      6
                    }
                    textAnchor="middle"
                    fill="#fffdf8"
                    fontFamily="ui-monospace, monospace"
                    fontWeight="700"
                    fontSize="16"
                  >
                    {annotation.sequence ||
                      '—'}
                  </text>

                  <text
                    x={
                      box.x + 64
                    }
                    y={
                      box.y +
                      box.height /
                        2 -
                      (calloutLines.length - 1) * 10 +
                      6
                    }
                    fill="#2d241e"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="650"
                    fontSize="17"
                  >
                    {calloutLines.map((line, index) => (
                      <tspan
                        key={`${annotation.id}-line-${index}`}
                        x={box.x + 64}
                        dy={index === 0 ? 0 : 20}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              </g>
            );
          }

          if (
            annotation.type ===
            'DIMENSION'
          ) {
            const p1 =
              annotation.p1 || {
                x: 300,
                y: 400
              };
            const p2 =
              annotation.p2 || {
                x: 700,
                y: 400
              };

            const centerX =
              (p1.x + p2.x) / 2;
            const centerY =
              (p1.y + p2.y) / 2;

            return (
              <g
                key={annotation.id}
                className={`tp-svg-annotation ${
                  selected
                    ? 'is-selected'
                    : ''
                }`}
                onClick={
                  interactive
                    ? (event) => {
                        event.stopPropagation();
                        onSelect?.(
                          annotation.id
                        );
                      }
                    : undefined
                }
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={
                    selected
                      ? '#a56542'
                      : '#51443a'
                  }
                  strokeWidth="3"
                />

                <line
                  x1={p1.x}
                  y1={p1.y - 14}
                  x2={p1.x}
                  y2={p1.y + 14}
                  stroke="#51443a"
                  strokeWidth="3"
                />

                <line
                  x1={p2.x}
                  y1={p2.y - 14}
                  x2={p2.x}
                  y2={p2.y + 14}
                  stroke="#51443a"
                  strokeWidth="3"
                />

                <rect
                  x={
                    centerX - 74
                  }
                  y={
                    centerY - 34
                  }
                  width="148"
                  height="29"
                  rx="7"
                  fill="#fffdf9"
                  stroke="#d8cec3"
                  strokeWidth="2"
                />

                <text
                  x={centerX}
                  y={
                    centerY - 14
                  }
                  textAnchor="middle"
                  fill="#30261f"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="700"
                  fontSize="15"
                >
                  {truncateSvgText(
                    annotation.text ||
                      'Dimension',
                    17
                  )}
                </text>
              </g>
            );
          }

          if (
            annotation.type ===
            'ARROW'
          ) {
            const p1 =
              annotation.p1 || {
                x: 350,
                y: 500
              };
            const p2 =
              annotation.p2 || {
                x: 650,
                y: 500
              };

            return (
              <g
                key={annotation.id}
                onClick={
                  interactive
                    ? (event) => {
                        event.stopPropagation();
                        onSelect?.(
                          annotation.id
                        );
                      }
                    : undefined
                }
                style={{
                  color: selected
                    ? '#a56542'
                    : '#51443a'
                }}
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="currentColor"
                  strokeWidth={
                    selected
                      ? 4
                      : 3
                  }
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            );
          }

          if (
            annotation.type ===
            'TEXT'
          ) {
            const point =
              annotation.p1 || {
                x: 400,
                y: 400
              };

            return (
              <g
                key={annotation.id}
                onClick={
                  interactive
                    ? (event) => {
                        event.stopPropagation();
                        onSelect?.(
                          annotation.id
                        );
                      }
                    : undefined
                }
              >
                <text
                  x={point.x}
                  y={point.y}
                  fill={
                    selected
                      ? '#a56542'
                      : '#30261f'
                  }
                  fontFamily="system-ui, sans-serif"
                  fontWeight="650"
                  fontSize="22"
                >
                  {annotation.text ||
                    'Technical note'}
                </text>
              </g>
            );
          }

          return null;
        }
      )}

      {pendingStart && (
        <g
          pointerEvents="none"
        >
          <circle
            cx={pendingStart.x}
            cy={pendingStart.y}
            r="10"
            fill="#a56542"
          />
          <circle
            cx={pendingStart.x}
            cy={pendingStart.y}
            r="19"
            fill="none"
            stroke="#a56542"
            strokeWidth="2"
            opacity="0.45"
          />
        </g>
      )}
    </svg>
  );
}

function ToolButton({
  tool,
  active,
  onClick
}) {
  const Icon =
    TOOL_ICON_REGISTRY[
      tool.icon
    ] ||
    MousePointer2;

  return (
    <button
      type="button"
      className={`tp-tool-button ${
        active
          ? 'is-active'
          : ''
      }`}
      onClick={onClick}
      title={tool.label}
      aria-pressed={active}
    >
      <Icon aria-hidden="true" />
      <span>{tool.label}</span>
    </button>
  );
}

export default function TechPackTechnicalDrawingStudio({
  metadata,
  techPackNode,
  mediaNode,
  measurementNode,
  sewingNode,
  variant,
  style,
  onChange,
  onOpenCompanion,
  onNavigateModule
}) {
  const config =
    metadata?.techPack
      ?.drawingStudio;

  const svgRef =
    useRef(null);

  const dragRef =
    useRef(null);

  const objectUrlsRef =
    useRef(
      new Map()
    );

  const values =
    techPackNode?.values ||
    {};

  const drawingStore = {
    activeAssetId:
      values.drawingStudio
        ?.activeAssetId ||
      null,

    sequenceMode:
      values.drawingStudio
        ?.sequenceMode ||
      config?.defaults
        ?.sequenceMode ||
      'NUMERIC',

    drawings:
      Array.isArray(
        values.drawingStudio
          ?.drawings
      )
        ? values.drawingStudio
            .drawings
        : []
  };

  const mediaAssets =
    Array.isArray(
      mediaNode?.values?.assets
    )
      ? mediaNode.values.assets
      : [];

  const technicalSketchTypeCode =
    config?.technicalSketchTypeCode;

  const technicalSlotAssetId =
    mediaNode?.values?.slots
      ?.technicalSketchAssetId ||
    null;

  const technicalAssets =
    useMemo(
      () =>
        mediaAssets.filter(
          (asset) =>
            asset.type ===
              technicalSketchTypeCode ||
            asset.id ===
              technicalSlotAssetId
        ),
      [
        mediaAssets,
        technicalSketchTypeCode,
        technicalSlotAssetId
      ]
    );

  const initialAssetId =
    drawingStore.activeAssetId &&
    technicalAssets.some(
      (asset) =>
        asset.id ===
        drawingStore.activeAssetId
    )
      ? drawingStore.activeAssetId
      : technicalAssets[0]?.id ||
        null;

  const [
    activeAssetId,
    setActiveAssetId
  ] = useState(
    initialAssetId
  );

  const [
    imageUrls,
    setImageUrls
  ] = useState({});

  const [
    activeTool,
    setActiveTool
  ] = useState(
    config?.defaults
      ?.activeTool ||
      'SELECT'
  );

  const [
    selectedAnnotationId,
    setSelectedAnnotationId
  ] = useState(null);

  const [
    localAnnotations,
    setLocalAnnotations
  ] = useState([]);

  const localAnnotationsRef =
    useRef([]);

  const [
    pendingStart,
    setPendingStart
  ] = useState(null);

  const [
    zoom,
    setZoom
  ] = useState(1);

  const [
    undoStack,
    setUndoStack
  ] = useState([]);

  const [
    redoStack,
    setRedoStack
  ] = useState([]);

  const activeAsset =
    technicalAssets.find(
      (asset) =>
        asset.id ===
        activeAssetId
    ) ||
    null;

  const activeDrawing =
    drawingStore.drawings.find(
      (drawing) =>
        drawing.assetId ===
        activeAssetId
    ) ||
    null;

  const activeImageUrl =
    activeAssetId
      ? imageUrls[
          activeAssetId
        ] ||
        activeAsset?.url ||
        ''
      : '';

  const selectedAnnotation =
    localAnnotations.find(
      (item) =>
        item.id ===
        selectedAnnotationId
    ) ||
    null;

  const referenceTypes =
    config?.referenceTypes ||
    [];

  const selectedReferenceOptions =
    selectedAnnotation
      ? getReferenceOptions({
          referenceType:
            selectedAnnotation
              .reference?.type ||
            'NONE',
          referenceTypes,
          sewingNode,
          measurementNode
        })
      : [];

  useEffect(() => {
    setActiveAssetId(
      (current) => {
        if (
          current &&
          technicalAssets.some(
            (asset) =>
              asset.id ===
              current
          )
        ) {
          return current;
        }

        return (
          drawingStore.activeAssetId &&
          technicalAssets.some(
            (asset) =>
              asset.id ===
              drawingStore.activeAssetId
          )
            ? drawingStore.activeAssetId
            : technicalAssets[0]?.id ||
              null
        );
      }
    );
  }, [
    technicalAssets,
    drawingStore.activeAssetId
  ]);

  useEffect(() => {
    const nextAnnotations =
      clone(
        activeDrawing
          ?.annotations ||
        []
      );

    localAnnotationsRef.current =
      nextAnnotations;

    setLocalAnnotations(
      nextAnnotations
    );

    setSelectedAnnotationId(
      null
    );

    setUndoStack([]);
    setRedoStack([]);
    setPendingStart(null);
  }, [
    activeAssetId,
    activeDrawing?.id
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviews() {
      const next =
        new Map(
          objectUrlsRef.current
        );

      for (
        const asset of
        technicalAssets
      ) {
        if (
          next.has(asset.id) ||
          asset.url
        ) {
          continue;
        }

        try {
          const file =
            await loadMediaFile(
              asset.id
            );

          if (
            !file ||
            cancelled
          ) {
            continue;
          }

          const url =
            URL.createObjectURL(
              file
            );

          next.set(
            asset.id,
            url
          );
        } catch {
          // The Media module owns
          // the binary. A missing
          // binary is represented by
          // the empty-state canvas.
        }
      }

      if (!cancelled) {
        objectUrlsRef.current =
          next;

        setImageUrls(
          Object.fromEntries(
            next
          )
        );
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
    };
  }, [technicalAssets]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(
        (url) =>
          URL.revokeObjectURL(
            url
          )
      );
    };
  }, []);

  useEffect(() => {
    const handleMove = (
      event
    ) => {
      if (
        !dragRef.current ||
        !svgRef.current
      ) {
        return;
      }

      const point =
        screenToSvgPoint(
          event.clientX,
          event.clientY
        );

      if (!point) {
        return;
      }

      const drag =
        dragRef.current;

      setLocalAnnotations(
        (current) => {
          const next =
            current.map(
            (annotation) => {
              if (
                annotation.id !==
                drag.annotationId
              ) {
                return annotation;
              }

              if (
                drag.mode ===
                'anchor'
              ) {
                return {
                  ...annotation,
                  anchor: {
                    x: clamp(
                      point.x,
                      36,
                      config.canvas
                        .viewBoxWidth -
                        36
                    ),
                    y: clamp(
                      point.y,
                      36,
                      config.canvas
                        .viewBoxHeight -
                        36
                    )
                  }
                };
              }

              const dx =
                point.x -
                drag.pointerStart.x;

              const dy =
                point.y -
                drag.pointerStart.y;

              const box =
                drag.boxStart;

              return {
                ...annotation,
                box: {
                  ...box,
                  x: clamp(
                    box.x + dx,
                    36,
                    config.canvas
                      .viewBoxWidth -
                      box.width -
                      36
                  ),
                  y: clamp(
                    box.y + dy,
                    36,
                    config.canvas
                      .viewBoxHeight -
                      box.height -
                      36
                  )
                }
              };
            }
          );

          localAnnotationsRef.current =
            next;

          return next;
        }
      );
    };

    const handleUp = () => {
      if (
        !dragRef.current
      ) {
        return;
      }

      const before =
        dragRef.current.before;

      dragRef.current =
        null;

      persistAnnotations(
        localAnnotationsRef.current,
        {
          before,
          recordHistory: true
        }
      );
    };

    window.addEventListener(
      'pointermove',
      handleMove
    );

    window.addEventListener(
      'pointerup',
      handleUp
    );

    return () => {
      window.removeEventListener(
        'pointermove',
        handleMove
      );

      window.removeEventListener(
        'pointerup',
        handleUp
      );
    };
  });

  if (!config) {
    return (
      <section className="tp-config-error">
        <strong>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.4d49d453fb")}</strong>
      </section>
    );
  }

  function writeDrawingStore(
    nextStore
  ) {
    onChange?.(
      '__replaceValues',
      null,
      techPackNode.id,
      {
        ...values,
        drawingStudio:
          nextStore
      }
    );
  }

  function upsertDrawing(
    annotations,
    extra = {}
  ) {
    if (!activeAssetId) {
      return;
    }

    const current =
      drawingStore.drawings.find(
        (drawing) =>
          drawing.assetId ===
          activeAssetId
      );

    const nextDrawing = {
      id:
        current?.id ||
        createId('drawing'),
      assetId:
        activeAssetId,
      revision:
        current?.revision ||
        1,
      editRevision:
        (current?.editRevision ||
          0) + 1,
      annotations:
        clone(annotations),
      createdAt:
        current?.createdAt ||
        nowIso(),
      updatedAt:
        nowIso(),
      ...extra
    };

    const nextDrawings =
      current
        ? drawingStore.drawings.map(
            (drawing) =>
              drawing.assetId ===
              activeAssetId
                ? nextDrawing
                : drawing
          )
        : [
            ...drawingStore.drawings,
            nextDrawing
          ];

    writeDrawingStore({
      ...drawingStore,
      activeAssetId,
      drawings:
        nextDrawings
    });
  }

  function persistAnnotations(
    next,
    {
      before =
        localAnnotations,
      recordHistory = true
    } = {}
  ) {
    if (
      recordHistory
    ) {
      setUndoStack(
        (current) => [
          ...current,
          clone(before)
        ].slice(-40)
      );

      setRedoStack([]);
    }

    upsertDrawing(next);
  }

  function commitAnnotations(
    next,
    options
  ) {
    const snapshot =
      clone(next);

    localAnnotationsRef.current =
      snapshot;

    setLocalAnnotations(
      snapshot
    );

    persistAnnotations(
      snapshot,
      options
    );
  }

  function patchAnnotation(
    annotationId,
    patch
  ) {
    const next =
      localAnnotations.map(
        (annotation) =>
          annotation.id ===
          annotationId
            ? {
                ...annotation,
                ...patch,
                updatedAt:
                  nowIso()
              }
            : annotation
      );

    commitAnnotations(
      next
    );
  }

  function removeAnnotation(
    annotationId
  ) {
    const next =
      localAnnotations.filter(
        (annotation) =>
          annotation.id !==
          annotationId
      );

    commitAnnotations(
      next
    );

    setSelectedAnnotationId(
      null
    );
  }

  function screenToSvgPoint(
    clientX,
    clientY
  ) {
    const svg =
      svgRef.current;

    if (
      !svg ||
      !svg.getScreenCTM()
    ) {
      return null;
    }

    const point =
      svg.createSVGPoint();

    point.x =
      clientX;
    point.y =
      clientY;

    return point.matrixTransform(
      svg
        .getScreenCTM()
        .inverse()
    );
  }

  function handleCanvasClick(
    event
  ) {
    const point =
      screenToSvgPoint(
        event.clientX,
        event.clientY
      );

    if (!point) {
      return;
    }

    if (
      activeTool === 'SELECT'
    ) {
      setSelectedAnnotationId(
        null
      );
      return;
    }

    if (
      activeTool === 'CALLOUT'
    ) {
      const width =
        config.defaults
          .calloutWidth;

      const height =
        config.defaults
          .calloutHeight;

      const boxX =
        point.x <
        config.canvas
          .viewBoxWidth *
          0.58
          ? point.x + 90
          : point.x -
            width -
            90;

      const annotation = {
        id:
          createId(
            'callout'
          ),
        type:
          'CALLOUT',
        sequence:
          getAnnotationSequence(
            localAnnotations,
            drawingStore.sequenceMode
          ),
        shortText:
          config.defaults
            .shortText,
        extendedNote:
          '',
        anchor: {
          x: point.x,
          y: point.y
        },
        box: {
          x: clamp(
            boxX,
            36,
            config.canvas
              .viewBoxWidth -
              width -
              36
          ),
          y: clamp(
            point.y -
              height /
                2,
            36,
            config.canvas
              .viewBoxHeight -
              height -
              36
          ),
          width,
          height
        },
        reference: {
          type: 'NONE',
          id: null
        },
        createdAt:
          nowIso(),
        updatedAt:
          nowIso()
      };

      commitAnnotations([
        ...localAnnotations,
        annotation
      ]);

      setSelectedAnnotationId(
        annotation.id
      );

      setActiveTool(
        'SELECT'
      );

      return;
    }

    if (
      activeTool === 'TEXT'
    ) {
      const annotation = {
        id:
          createId('text'),
        type:
          'TEXT',
        text:
          config.defaults
            .textValue,
        p1: {
          x: point.x,
          y: point.y
        },
        reference: {
          type: 'NONE',
          id: null
        },
        createdAt:
          nowIso(),
        updatedAt:
          nowIso()
      };

      commitAnnotations([
        ...localAnnotations,
        annotation
      ]);

      setSelectedAnnotationId(
        annotation.id
      );

      setActiveTool(
        'SELECT'
      );

      return;
    }

    if (
      activeTool ===
        'DIMENSION' ||
      activeTool === 'ARROW'
    ) {
      if (!pendingStart) {
        setPendingStart({
          x: point.x,
          y: point.y
        });
        return;
      }

      const annotation = {
        id:
          createId(
            activeTool.toLowerCase()
          ),
        type: activeTool,
        p1:
          pendingStart,
        p2: {
          x: point.x,
          y: point.y
        },
        text:
          activeTool ===
          'DIMENSION'
            ? config.defaults
                .dimensionText
            : '',
        reference: {
          type: 'NONE',
          id: null
        },
        createdAt:
          nowIso(),
        updatedAt:
          nowIso()
      };

      commitAnnotations([
        ...localAnnotations,
        annotation
      ]);

      setPendingStart(null);
      setSelectedAnnotationId(
        annotation.id
      );
      setActiveTool(
        'SELECT'
      );
    }
  }

  function handleBeginDrag(
    event,
    annotation,
    mode
  ) {
    event.stopPropagation();
    event.preventDefault();

    const point =
      screenToSvgPoint(
        event.clientX,
        event.clientY
      );

    if (!point) {
      return;
    }

    setSelectedAnnotationId(
      annotation.id
    );

    dragRef.current = {
      annotationId:
        annotation.id,
      mode,
      pointerStart:
        point,
      boxStart:
        clone(
          annotation.box ||
            {}
        ),
      before:
        clone(
          localAnnotations
        )
    };
  }

  function undo() {
    if (!undoStack.length) {
      return;
    }

    const previous =
      undoStack[
        undoStack.length - 1
      ];

    setRedoStack(
      (current) => [
        ...current,
        clone(
          localAnnotations
        )
      ].slice(-40)
    );

    setUndoStack(
      (current) =>
        current.slice(
          0,
          -1
        )
    );

    const previousSnapshot =
      clone(previous);

    localAnnotationsRef.current =
      previousSnapshot;

    setLocalAnnotations(
      previousSnapshot
    );

    upsertDrawing(
      previousSnapshot
    );
  }

  function redo() {
    if (!redoStack.length) {
      return;
    }

    const next =
      redoStack[
        redoStack.length - 1
      ];

    setUndoStack(
      (current) => [
        ...current,
        clone(
          localAnnotations
        )
      ].slice(-40)
    );

    setRedoStack(
      (current) =>
        current.slice(
          0,
          -1
        )
    );

    const nextSnapshot =
      clone(next);

    localAnnotationsRef.current =
      nextSnapshot;

    setLocalAnnotations(
      nextSnapshot
    );

    upsertDrawing(
      nextSnapshot
    );
  }

  function chooseAsset(
    assetId
  ) {
    setActiveAssetId(
      assetId
    );

    writeDrawingStore({
      ...drawingStore,
      activeAssetId:
        assetId
    });
  }

  function setSequenceMode(
    code
  ) {
    writeDrawingStore({
      ...drawingStore,
      activeAssetId,
      sequenceMode:
        code
    });
  }

  const viewWidth =
    config.canvas
      .viewBoxWidth;

  const viewHeight =
    config.canvas
      .viewBoxHeight;

  const zoomMin =
    config.canvas
      .minimumZoom;

  const zoomMax =
    config.canvas
      .maximumZoom;

  const zoomStep =
    config.canvas
      .zoomStep;

  const callouts =
    localAnnotations.filter(
      (annotation) =>
        annotation.type ===
        'CALLOUT'
    );

  return (
    <>
      <section className="tp-drawing-studio">
        <aside className="tp-assets-panel">
          <div className="tp-panel-heading">
            <div>
              <span className="tp-panel-kicker">{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.33d39737eb")}</span>
              <h3>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.ea9ba32f6e")}</h3>
            </div>

            <span className="tp-count-badge">
              {
                technicalAssets.length
              }
            </span>
          </div>

          <div className="tp-asset-list">
            {technicalAssets.map(
              (asset) => {
                const active =
                  asset.id ===
                  activeAssetId;

                const source =
                  imageUrls[
                    asset.id
                  ] ||
                  asset.url ||
                  '';

                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`tp-asset-card ${
                      active
                        ? 'is-active'
                        : ''
                    }`}
                    onClick={() =>
                      chooseAsset(
                        asset.id
                      )
                    }
                  >
                    <span className="tp-asset-thumb">
                      {source ? (
                        <img
                          src={source}
                          alt=""
                        />
                      ) : (
                        <FileImage
                          aria-hidden="true"
                        />
                      )}
                    </span>

                    <span className="tp-asset-copy">
                      <strong>
                        {asset.title ||
                          'Technical sketch'}
                      </strong>

                      <small>
                        {asset.referenceCode ||
                          asset.fileName ||
                          'Workspace media'}
                      </small>

                      <span className="tp-asset-visibility">
                        {asset.customerVisible ===
                        false
                          ? 'Internal'
                          : 'Customer visible'}
                      </span>
                    </span>
                  </button>
                );
              }
            )}

            {!technicalAssets.length && (
              <div className="tp-assets-empty">
                <FileImage
                  aria-hidden="true"
                />
                <strong>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.1f5d163398")}</strong>
                <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.15344c99fb")}</span>

                {onNavigateModule && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateModule(
                        'media'
                      )
                    }
                  >{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.2e5c4f61cc")}</button>
                )}
              </div>
            )}
          </div>

          {technicalAssets.length >
            1 && (
            <div className="tp-asset-pager">
              <button
                type="button"
                onClick={() => {
                  const index =
                    technicalAssets.findIndex(
                      (item) =>
                        item.id ===
                        activeAssetId
                    );

                  const next =
                    technicalAssets[
                      Math.max(
                        0,
                        index - 1
                      )
                    ];

                  if (next) {
                    chooseAsset(
                      next.id
                    );
                  }
                }}
                disabled={
                  activeAssetId ===
                  technicalAssets[0]
                    ?.id
                }
              >
                <ChevronLeft />
              </button>

              <span>
                {Math.max(
                  1,
                  technicalAssets.findIndex(
                    (item) =>
                      item.id ===
                      activeAssetId
                  ) + 1
                )}
                {' / '}
                {
                  technicalAssets.length
                }
              </span>

              <button
                type="button"
                onClick={() => {
                  const index =
                    technicalAssets.findIndex(
                      (item) =>
                        item.id ===
                        activeAssetId
                    );

                  const next =
                    technicalAssets[
                      Math.min(
                        technicalAssets.length -
                          1,
                        index + 1
                      )
                    ];

                  if (next) {
                    chooseAsset(
                      next.id
                    );
                  }
                }}
                disabled={
                  activeAssetId ===
                  technicalAssets[
                    technicalAssets.length -
                      1
                  ]?.id
                }
              >
                <ChevronRight />
              </button>
            </div>
          )}
        </aside>

        <section className="tp-canvas-column">
          <div className="tp-canvas-toolbar">
            <div className="tp-tool-group">
              {config.tools.map(
                (tool) => (
                  <ToolButton
                    key={tool.code}
                    tool={tool}
                    active={
                      activeTool ===
                      tool.code
                    }
                    onClick={() => {
                      setActiveTool(
                        tool.code
                      );
                      setPendingStart(
                        null
                      );
                    }}
                  />
                )
              )}
            </div>

            <div className="tp-toolbar-divider" />

            <div className="tp-icon-tool-group">
              <button
                type="button"
                className="tp-icon-button"
                onClick={undo}
                disabled={
                  !undoStack.length
                }
                title={pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.af841986e2")}
              >
                <Undo2 />
              </button>

              <button
                type="button"
                className="tp-icon-button"
                onClick={redo}
                disabled={
                  !redoStack.length
                }
                title={pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.02d4ee1435")}
              >
                <Redo2 />
              </button>
            </div>

            <div className="tp-toolbar-spacer" />

            <label className="tp-sequence-control">
              <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.45ca28849c")}</span>
              <select
                value={
                  drawingStore.sequenceMode
                }
                onChange={(
                  event
                ) =>
                  setSequenceMode(
                    event.target
                      .value
                  )
                }
              >
                {config.sequenceModes.map(
                  (mode) => (
                    <option
                      key={
                        mode.code
                      }
                      value={
                        mode.code
                      }
                    >
                      {
                        mode.label
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <div className="tp-zoom-control">
              <button
                type="button"
                className="tp-icon-button"
                onClick={() =>
                  setZoom(
                    (current) =>
                      clamp(
                        Number(
                          (
                            current -
                            zoomStep
                          ).toFixed(
                            2
                          )
                        ),
                        zoomMin,
                        zoomMax
                      )
                  )
                }
                disabled={
                  zoom <= zoomMin
                }
                title={pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.c18b00dc6f")}
              >
                <ZoomOut />
              </button>

              <button
                type="button"
                className="tp-zoom-value"
                onClick={() =>
                  setZoom(1)
                }
                title={pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.e4273d8583")}
              >
                {Math.round(
                  zoom * 100
                )}
                %
              </button>

              <button
                type="button"
                className="tp-icon-button"
                onClick={() =>
                  setZoom(
                    (current) =>
                      clamp(
                        Number(
                          (
                            current +
                            zoomStep
                          ).toFixed(
                            2
                          )
                        ),
                        zoomMin,
                        zoomMax
                      )
                  )
                }
                disabled={
                  zoom >= zoomMax
                }
                title={pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.11a1f22b4e")}
              >
                <ZoomIn />
              </button>
            </div>
          </div>

          <div className="tp-canvas-viewport">
            <div
              className="tp-paper-frame"
              style={{
                width: `${
                  zoom * 100
                }%`
              }}
            >
                <DrawingSvg
                  width={viewWidth}
                  height={viewHeight}
                  imageUrl={
                    activeImageUrl
                  }
                  annotations={
                    localAnnotations
                  }
                  selectedAnnotationId={
                    selectedAnnotationId
                  }
                  onSelect={
                    setSelectedAnnotationId
                  }
                  onCanvasClick={
                    handleCanvasClick
                  }
                  onBeginDrag={
                    handleBeginDrag
                  }
                  pendingStart={
                    pendingStart
                  }
                  svgRef={svgRef}
                  markerId="tp-arrow-marker-editor"
                  imageRect={{
                    x: config.canvas.imageX,
                    y: config.canvas.imageY,
                    width: config.canvas.imageWidth,
                    height: config.canvas.imageHeight
                  }}
                />
            </div>
          </div>

          <div className="tp-canvas-status">
            <span>
              {activeAsset
                ? activeAsset.title ||
                  activeAsset.referenceCode ||
                  'Technical sketch'
                : 'No technical sketch selected'}
            </span>

            <span>
              {
                localAnnotations.length
              }{' '}
              annotations
            </span>
          </div>
        </section>

        <aside className="tp-notes-panel">
          <div className="tp-panel-heading">
            <div>
              <span className="tp-panel-kicker">{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.9a1b0f1efe")}</span>
              <h3>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.ae2ed47234")}</h3>
            </div>

            <span className="tp-count-badge">
              {
                callouts.length
              }
            </span>
          </div>

          <div className="tp-note-register">
            {callouts.map(
              (annotation) => (
                <button
                  key={
                    annotation.id
                  }
                  type="button"
                  className={`tp-note-card ${
                    annotation.id ===
                    selectedAnnotationId
                      ? 'is-active'
                      : ''
                  }`}
                  onClick={() =>
                    setSelectedAnnotationId(
                      annotation.id
                    )
                  }
                >
                  <span className="tp-note-sequence">
                    {annotation.sequence ||
                      '—'}
                  </span>

                  <span className="tp-note-copy">
                    <strong>
                      {annotation.shortText ||
                        'Callout'}
                    </strong>

                    <small>
                      {annotation.extendedNote ||
                        'No additional note.'}
                    </small>

                    {annotation.reference?.id && (
                      <span className="tp-linked-reference">
                        <Link2 />
                        {
                          annotation.reference
                            .id
                        }
                      </span>
                    )}
                  </span>
                </button>
              )
            )}

            {!callouts.length && (
              <div className="tp-notes-empty">
                <CircleDot
                  aria-hidden="true"
                />
                <strong>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.f8f95cacb4")}</strong>
                <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.91c09945bc")}</span>
              </div>
            )}
          </div>
        </aside>

        <aside className="tp-properties-panel">
          <div className="tp-panel-heading">
            <div>
              <span className="tp-panel-kicker">{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.43c121f0e7")}</span>
              <h3>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.92f12783a8")}</h3>
            </div>
          </div>

          {selectedAnnotation ? (
            <div className="tp-properties-form">
              <div className="tp-selected-type">
                <span>
                  {
                    selectedAnnotation.type
                  }
                </span>
                <code>
                  {
                    selectedAnnotation.id
                  }
                </code>
              </div>

              {selectedAnnotation.type ===
                'CALLOUT' && (
                <>
                  <label>
                    <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.45ca28849c")}</span>
                    <input
                      value={
                        selectedAnnotation.sequence ||
                        ''
                      }
                      onChange={(
                        event
                      ) =>
                        patchAnnotation(
                          selectedAnnotation.id,
                          {
                            sequence:
                              event
                                .target
                                .value
                          }
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.a80432b5c4")}</span>
                    <input
                      value={
                        selectedAnnotation.shortText ||
                        ''
                      }
                      onChange={(
                        event
                      ) =>
                        patchAnnotation(
                          selectedAnnotation.id,
                          {
                            shortText:
                              event
                                .target
                                .value
                          }
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.1263420426")}</span>
                    <textarea
                      rows="6"
                      value={
                        selectedAnnotation.extendedNote ||
                        ''
                      }
                      onChange={(
                        event
                      ) =>
                        patchAnnotation(
                          selectedAnnotation.id,
                          {
                            extendedNote:
                              event
                                .target
                                .value
                          }
                        )
                      }
                    />
                  </label>
                </>
              )}

              {(selectedAnnotation.type ===
                'DIMENSION' ||
                selectedAnnotation.type ===
                  'TEXT') && (
                <label>
                  <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.7d82d108af")}</span>
                  <input
                    value={
                      selectedAnnotation.text ||
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      patchAnnotation(
                        selectedAnnotation.id,
                        {
                          text:
                            event
                              .target
                              .value
                        }
                      )
                    }
                  />
                </label>
              )}

              <label>
                <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.bfbd80c5ff")}</span>
                <select
                  value={
                    selectedAnnotation.reference
                      ?.type ||
                    'NONE'
                  }
                  onChange={(
                    event
                  ) =>
                    patchAnnotation(
                      selectedAnnotation.id,
                      {
                        reference: {
                          type:
                            event
                              .target
                              .value,
                          id: null
                        }
                      }
                    )
                  }
                >
                  {referenceTypes.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.label
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              {selectedAnnotation.reference
                ?.type !==
                'NONE' && (
                <label>
                  <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.9033fed3d0")}</span>
                  <select
                    value={
                      selectedAnnotation.reference
                        ?.id ||
                      ''
                    }
                    onChange={(
                      event
                    ) =>
                      patchAnnotation(
                        selectedAnnotation.id,
                        {
                          reference: {
                            ...selectedAnnotation.reference,
                            id:
                              event
                                .target
                                .value ||
                              null
                          }
                        }
                      )
                    }
                  >
                    <option value="">{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.2b1854a9b4")}</option>

                    {selectedReferenceOptions.map(
                      (
                        option
                      ) => (
                        <option
                          key={
                            option.id
                          }
                          value={
                            option.id
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>
              )}

              <div className="tp-inspector-links">
                <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.01393bc563")}</span>

                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenCompanion?.(
                        'CONSTRUCTION_OPERATIONS'
                      )
                    }
                    disabled={
                      !onOpenCompanion
                    }
                  >{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.d799bfe53a")}</button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenCompanion?.(
                        'MEASUREMENT_CHART'
                      )
                    }
                    disabled={
                      !onOpenCompanion
                    }
                  >{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.0ebb075025")}</button>
                </div>
              </div>

              <button
                type="button"
                className="tp-delete-annotation"
                onClick={() =>
                  removeAnnotation(
                    selectedAnnotation.id
                  )
                }
              >
                <Trash2 />{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.1dddc8a8bf")}</button>
            </div>
          ) : (
            <div className="tp-properties-empty">
              <MousePointer2
                aria-hidden="true"
              />
              <strong>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.8309166375")}</strong>
              <span>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.5d7478c38c")}</span>
            </div>
          )}
        </aside>
      </section>

      <section
        className="tp-print-sheet"
        aria-hidden="true"
      >
        <header className="tp-print-header">
          <div>
            <span>
              TECHNICAL DRAWING
            </span>
            <h1>
              {style?.values
                ?.['product.style_name'] ||
                'Technical Pack'}
            </h1>
          </div>

          <dl>
            <div>
              <dt>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.44c570e95d")}</dt>
              <dd>
                {variant?.values
                  ?.['variant.code'] ||
                  '—'}
              </dd>
            </div>

            <div>
              <dt>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.956d07d181")}</dt>
              <dd>
                {values.version ||
                  '—'}
              </dd>
            </div>

            <div>
              <dt>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.dd32e7693d")}</dt>
              <dd>
                {activeAsset?.referenceCode ||
                  activeAsset?.title ||
                  '—'}
              </dd>
            </div>
          </dl>
        </header>

        <div className="tp-print-grid">
          <div className="tp-print-drawing">
            <DrawingSvg
              width={viewWidth}
              height={viewHeight}
              imageUrl={
                activeImageUrl
              }
              annotations={
                localAnnotations
              }
              interactive={
                false
              }
              markerId="tp-arrow-marker-print"
              imageRect={{
                x: config.canvas.imageX,
                y: config.canvas.imageY,
                width: config.canvas.imageWidth,
                height: config.canvas.imageHeight
              }}
            />
          </div>

          <aside className="tp-print-notes">
            <h2>{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.ae2ed47234")}</h2>

            {callouts.map(
              (annotation) => (
                <div
                  key={
                    annotation.id
                  }
                  className="tp-print-note"
                >
                  <span>
                    {annotation.sequence ||
                      '—'}
                  </span>

                  <div>
                    <strong>
                      {annotation.shortText ||
                        'Callout'}
                    </strong>

                    {annotation.extendedNote && (
                      <p>
                        {
                          annotation.extendedNote
                        }
                      </p>
                    )}
                  </div>
                </div>
              )
            )}

            {!callouts.length && (
              <p className="tp-print-empty">{pfUiT("ui.components.workspace.techpacktechnicaldrawingstudio.ed82ebf1c8")}</p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}
