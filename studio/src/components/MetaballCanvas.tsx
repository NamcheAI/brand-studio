import React, { forwardRef, useMemo, useRef, useState } from 'react';
import {
  CELL,
  COLS,
  DOT_RADIUS,
  GRAPH_STROKE,
  ROWS,
  SVG_SIZE,
  cellCenter,
  cellRect,
  edgeKey,
  edgePull,
  edgeTubeFactor,
  effectiveNodeRadius,
  getMetaballShapes,
  inwardTubeScale,
  isEditableCell,
  isInner,
  nodeId,
  nodePosition,
  type Edge,
  type GridNode,
  type Mode,
  type NodeId,
  type Theme,
} from '../lib/model';
import GooFilter from './GooFilter';

type Props = {
  mode: Mode;
  nodes: GridNode[];
  edges: Edge[];
  theme: Theme;
  showGrid: boolean;
  fullGrid: boolean;
  gooStd: number;
  gooThreshold: number;
  tubeFactor: number;
  inwardPull: number;
  edgeFactors: Record<string, number>;
  edgePulls: Record<string, number>;
  selected: NodeId | null;
  selectedEdge: string | null;
  canonicalPath?: string | null;
  exportPreviewPath: string | null;
  onAddNode: (r: number, c: number) => void;
  onSelect: (id: NodeId | null) => void;
  onSelectEdge: (key: string) => void;
  onToggleEdge: (a: NodeId, b: NodeId) => void;
  onRemoveNode: (id: NodeId) => void;
  onMoveNode: (from: NodeId, toR: number, toC: number) => void;
};

const ACCENT = '#111';
const CONNECT_THRESHOLD = 5;

type DragState = {
  from: NodeId;
  x: number;
  y: number;
  moved: boolean;
  moveNode: boolean;
};

const MetaballCanvas = forwardRef<SVGSVGElement, Props>(function MetaballCanvas(
  {
    mode,
    nodes,
    edges,
    theme,
    showGrid,
    fullGrid,
    gooStd,
    gooThreshold,
    tubeFactor,
    inwardPull,
    edgeFactors,
    edgePulls,
    selected,
    selectedEdge,
    canonicalPath = null,
    exportPreviewPath,
    onAddNode,
    onSelect,
    onSelectEdge,
    onToggleEdge,
    onRemoveNode,
    onMoveNode,
  },
  ref,
) {
  const markFill = theme.ink;
  const innerRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const updateDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const setRefs = (el: SVGSVGElement | null) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<SVGSVGElement | null>).current = el;
  };

  const nodeByCell = useMemo(() => {
    const map = new Map<NodeId, GridNode>();
    for (const node of nodes) map.set(nodeId(node.r, node.c), node);
    return map;
  }, [nodes]);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = innerRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const cellAt = (x: number, y: number): { r: number; c: number } | null => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const { x: rx, y: ry, w, h } = cellRect(r, c);
        if (x >= rx && x <= rx + w && y >= ry && y <= ry + h) return { r, c };
      }
    }
    return null;
  };

  const hitNode = (x: number, y: number): GridNode | null => {
    let best: GridNode | null = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      const { cx, cy } = nodePosition(node);
      const d = Math.hypot(cx - x, cy - y);
      const r = Math.max(effectiveNodeRadius(node), CELL * 0.4);
      if (d <= r && d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
    return best;
  };

  const handleNodeDown = (e: React.PointerEvent, id: NodeId, moveNode = false) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    downPos.current = { x: e.clientX, y: e.clientY };
    updateDrag({ from: id, x: p.x, y: p.y, moved: false, moveNode });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current || !downPos.current) return;
    const p = toSvg(e.clientX, e.clientY);
    const moved =
      Math.hypot(e.clientX - downPos.current.x, e.clientY - downPos.current.y) > CONNECT_THRESHOLD;
    updateDrag({ ...current, x: p.x, y: p.y, moved: current.moved || moved });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const current = dragRef.current;
    if (!current) return;
    const p = toSvg(e.clientX, e.clientY);

    if (current.moveNode && current.moved) {
      const cell = cellAt(p.x, p.y);
      if (cell && isEditableCell(cell.r, cell.c, fullGrid)) {
        const targetId = nodeId(cell.r, cell.c);
        if (targetId !== current.from && !nodeByCell.has(targetId)) {
          onMoveNode(current.from, cell.r, cell.c);
        }
      }
    } else if (current.moved) {
      const target = hitNode(p.x, p.y);
      if (target && nodeId(target.r, target.c) !== current.from) {
        onToggleEdge(current.from, nodeId(target.r, target.c));
      }
    } else if (!current.moved) {
      onSelect(current.from);
    }

    updateDrag(null);
    downPos.current = null;
  };

  const startNode = drag ? nodeByCell.get(drag.from) : null;
  const startCenter = startNode ? nodePosition(startNode) : null;

  const gridEls: React.ReactNode[] = [];
  const guideEls: React.ReactNode[] = [];
  const hitEls: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y, w, h } = cellRect(r, c);
      const inner = isInner(r, c);
      const editable = isEditableCell(r, c, fullGrid);
      const hasNode = nodeByCell.has(nodeId(r, c));
      if (showGrid) {
        const cellFill = inner ? theme.blue : theme.pink;
        gridEls.push(
          <rect key={`bg-${r}-${c}`} x={x} y={y} width={w} height={h} rx={2} fill={cellFill} />,
        );
        if (editable && !hasNode) {
          const { cx, cy } = cellCenter(r, c);
          guideEls.push(
            <circle key={`dot-${r}-${c}`} cx={cx} cy={cy} r={DOT_RADIUS} fill={theme.ink} />,
          );
        }
      }
      if (editable && !hasNode) {
        hitEls.push(
          <rect
            key={`hit-${r}-${c}`}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="transparent"
            style={{ cursor: 'copy' }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              onAddNode(r, c);
            }}
          />,
        );
      }
    }
  }

  const markShapes =
    mode === 'metaball'
      ? getMetaballShapes(nodes, edges, tubeFactor, edgeFactors, inwardPull, edgePulls)
      : null;

  const markChildren = canonicalPath ? (
    <path d={canonicalPath} fill={markFill} fillRule="evenodd" />
  ) : markShapes ? (
    <>
      {markShapes.capsules.map((cap, i) => (
        <line
          key={`edge-${i}`}
          x1={cap.x1}
          y1={cap.y1}
          x2={cap.x2}
          y2={cap.y2}
          stroke={markFill}
          strokeWidth={cap.r * 2}
          strokeLinecap="round"
        />
      ))}
      {markShapes.circles.map((c, i) => (
        <circle key={`node-${i}`} cx={c.cx} cy={c.cy} r={c.r} fill={markFill} />
      ))}
    </>
  ) : (
    <>
      {edges.map(([a, b]) => {
        const na = nodeByCell.get(a);
        const nb = nodeByCell.get(b);
        if (!na || !nb) return null;
        const ca = nodePosition(na);
        const cb = nodePosition(nb);
        return (
          <line
            key={`edge-${edgeKey(a, b)}`}
            x1={ca.cx}
            y1={ca.cy}
            x2={cb.cx}
            y2={cb.cy}
            stroke={theme.ink}
            strokeWidth={GRAPH_STROKE}
            strokeLinecap="round"
          />
        );
      })}
      {nodes.map((node) => {
        const { cx, cy } = nodePosition(node);
        return (
          <circle
            key={`node-${nodeId(node.r, node.c)}`}
            cx={cx}
            cy={cy}
            r={effectiveNodeRadius(node)}
            fill={theme.ink}
          />
        );
      })}
    </>
  );

  return (
    <svg
      ref={setRefs}
      className="metaball-svg"
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        updateDrag(null);
        downPos.current = null;
      }}
      onLostPointerCapture={() => {
        updateDrag(null);
        downPos.current = null;
      }}
      onPointerDown={(e) => {
        if (e.button === 0) onSelect(null);
      }}
    >
      <defs>
        <GooFilter
          id="goo"
          gooStd={gooStd}
          gooThreshold={gooThreshold}
          inwardPull={inwardPull}
        />
      </defs>

      <g className="grid-layer">
        {showGrid && (
          <>
            <rect x={0} y={0} width={SVG_SIZE} height={SVG_SIZE} fill={theme.bg} />
            {gridEls}
          </>
        )}
      </g>

      <g className="editor-only guide-layer">{guideEls}</g>
      <g className="editor-only">{hitEls}</g>

      {mode === 'metaball' ? (
        canonicalPath ? (
          <g>{markChildren}</g>
        ) : (
          <g filter="url(#goo)">{markChildren}</g>
        )
      ) : (
        <g>{markChildren}</g>
      )}

      {exportPreviewPath && mode === 'metaball' && (
        <path
          className="editor-only export-preview"
          d={exportPreviewPath}
          fill="none"
          stroke={ACCENT}
          strokeOpacity={0.45}
          strokeWidth={2}
          strokeDasharray="6 6"
          fillRule="evenodd"
          pointerEvents="none"
        />
      )}

      <g className="editor-only">
        {edges.map(([a, b]) => {
          const na = nodeByCell.get(a);
          const nb = nodeByCell.get(b);
          if (!na || !nb) return null;
          const key = edgeKey(a, b);
          const ca = nodePosition(na);
          const cb = nodePosition(nb);
          const pull = mode === 'metaball' ? edgePull(a, b, inwardPull, edgePulls) : 0;
          const tubeScale = mode === 'metaball' ? inwardTubeScale(pull) : 1;
          const width =
            2 *
            edgeTubeFactor(a, b, tubeFactor, edgeFactors) *
            tubeScale *
            Math.min(effectiveNodeRadius(na), effectiveNodeRadius(nb));
          return (
            <g key={`edgeui-${key}`}>
              {selectedEdge === key && (
                <line
                  x1={ca.cx}
                  y1={ca.cy}
                  x2={cb.cx}
                  y2={cb.cy}
                  stroke={ACCENT}
                  strokeOpacity={0.5}
                  strokeWidth={width + 8}
                  strokeLinecap="round"
                  strokeDasharray="6 8"
                  pointerEvents="none"
                />
              )}
              <line
                x1={ca.cx}
                y1={ca.cy}
                x2={cb.cx}
                y2={cb.cy}
                stroke="transparent"
                strokeWidth={Math.max(width, 22)}
                strokeLinecap="round"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  onSelectEdge(key);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onToggleEdge(a, b);
                }}
              />
            </g>
          );
        })}
        {nodes.map((node) => {
          const id = nodeId(node.r, node.c);
          const { cx, cy } = nodePosition(node);
          const hitR = Math.max(effectiveNodeRadius(node), CELL * 0.4);
          return (
            <g key={`ui-${id}`}>
              <circle
                cx={cx}
                cy={cy}
                r={hitR}
                fill="transparent"
                style={{ cursor: drag?.moveNode ? 'grabbing' : 'grab' }}
                onPointerDown={(e) => handleNodeDown(e, id, e.altKey || e.shiftKey)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onRemoveNode(id);
                }}
              />
              {selected === id && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={effectiveNodeRadius(node) + 8}
                  fill="none"
                  stroke={ACCENT}
                  strokeOpacity={0.5}
                  strokeWidth={3}
                  strokeDasharray="6 6"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}
        {drag && drag.moved && startCenter && !drag.moveNode && (
          <line
            x1={startCenter.cx}
            y1={startCenter.cy}
            x2={drag.x}
            y2={drag.y}
            stroke={ACCENT}
            strokeOpacity={0.4}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="4 8"
            pointerEvents="none"
          />
        )}
        {drag && drag.moved && drag.moveNode && startCenter && (
          <circle
            cx={drag.x}
            cy={drag.y}
            r={startNode ? effectiveNodeRadius(startNode) : CELL * 0.44}
            fill={theme.ink}
            fillOpacity={0.35}
            stroke={ACCENT}
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray="4 6"
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  );
});

export default MetaballCanvas;
