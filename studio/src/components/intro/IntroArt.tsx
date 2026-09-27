import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GenerateParams } from '@namche/metaball';

import { cn } from '@/lib/utils';
import {
  COLS,
  DOT_RADIUS,
  GRAPH_STROKE,
  ROWS,
  SVG_SIZE,
  cellRect,
  effectiveNodeRadius,
  getMetaballShapes,
  isInner,
  nodeId,
  nodePosition,
  type Edge,
  type GridNode,
  type Theme,
} from '../../lib/model';
import {
  GROWTH_DURATION_MS,
  applyGrowthDisplay,
  buildGrowthSchedule,
  scalesAtElapsed,
} from '../../lib/growth';
import GooFilter from '../GooFilter';
import { LOOP_EDGES, LOOP_NODES, markPath, type GooParams } from './marks';

/* Everything on this page is drawn by the same engine the Studio draws with —
   no exported bitmaps, no second implementation of the geometry. The art below
   is @namche/metaball's own output: `generate` for traced paths, the shared
   primitive builder plus the shared goo filter for the live states. */

export function ArtFrame({
  theme,
  raster = true,
  className,
  children,
}: {
  theme: Theme;
  raster?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className={cn('block h-auto w-full', className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Without the raster there is no canvas to paint: the mark sits straight
          on the page, the way an exported transparent SVG would. */}
      {raster && (
        <>
          <rect x={0} y={0} width={SVG_SIZE} height={SVG_SIZE} fill={theme.bg} />
          <RasterCells theme={theme} />
        </>
      )}
      {children}
    </svg>
  );
}

/** The Y = X/8 raster: a pink outer ring around the light-blue inner 3 × 3. */
export function RasterCells({ theme }: { theme: Theme }) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y, w, h } = cellRect(r, c);
      cells.push(
        <rect
          key={`cell-${r}-${c}`}
          x={x}
          y={y}
          width={w}
          height={h}
          rx={2}
          fill={isInner(r, c) ? theme.blue : theme.pink}
        />,
      );
    }
  }
  return <g>{cells}</g>;
}

/** The unused inner cells keep their tick, exactly as the Studio canvas shows them. */
function GuideDots({ nodes, theme }: { nodes: GridNode[]; theme: Theme }) {
  const taken = new Set(nodes.map((node) => nodeId(node.r, node.c)));
  const dots: ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isInner(r, c) || taken.has(nodeId(r, c))) continue;
      const { x, y, w, h } = cellRect(r, c);
      dots.push(
        <circle
          key={`guide-${r}-${c}`}
          cx={x + w / 2}
          cy={y + h / 2}
          r={DOT_RADIUS}
          fill={theme.ink}
        />,
      );
    }
  }
  return <g>{dots}</g>;
}

export function NodeLayer({
  nodes,
  theme,
  guides = true,
}: {
  nodes: GridNode[];
  theme: Theme;
  guides?: boolean;
}) {
  return (
    <>
      {guides && <GuideDots nodes={nodes} theme={theme} />}
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
}

/** The network before it fuses — the Studio's graph view. */
export function GraphLayer({
  nodes,
  edges,
  theme,
}: {
  nodes: GridNode[];
  edges: Edge[];
  theme: Theme;
}) {
  const byId = new Map(nodes.map((node) => [nodeId(node.r, node.c), node]));
  return (
    <>
      <GuideDots nodes={nodes} theme={theme} />
      {edges.map(([a, b]) => {
        const na = byId.get(a);
        const nb = byId.get(b);
        if (!na || !nb) return null;
        const ca = nodePosition(na);
        const cb = nodePosition(nb);
        return (
          <line
            key={`edge-${a}-${b}`}
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
            key={`gnode-${nodeId(node.r, node.c)}`}
            cx={cx}
            cy={cy}
            r={effectiveNodeRadius(node)}
            fill={theme.ink}
          />
        );
      })}
    </>
  );
}

/** Live fusion: engine primitives under the shared blur-and-threshold filter. */
export function GooLayer({
  id,
  nodes,
  edges,
  theme,
  params,
}: {
  id: string;
  nodes: GridNode[];
  edges: Edge[];
  theme: Theme;
  params: GooParams;
}) {
  const shapes = getMetaballShapes(nodes, edges, params.tubeFactor, {}, params.inwardPull, {});
  return (
    <>
      <defs>
        <GooFilter
          id={id}
          gooStd={params.gooStd}
          gooThreshold={params.gooThreshold}
          inwardPull={params.inwardPull}
        />
      </defs>
      <g filter={`url(#${id})`}>
        {shapes.capsules.map((capsule, index) => (
          <line
            key={`cap-${index}`}
            x1={capsule.x1}
            y1={capsule.y1}
            x2={capsule.x2}
            y2={capsule.y2}
            stroke={theme.ink}
            strokeWidth={capsule.r * 2}
            strokeLinecap="round"
          />
        ))}
        {shapes.circles.map((circle, index) => (
          <circle key={`circ-${index}`} cx={circle.cx} cy={circle.cy} r={circle.r} fill={theme.ink} />
        ))}
      </g>
    </>
  );
}

/** The finished mark as the engine exports it: one traced, even-odd path. */
export function TracedMark({
  params,
  theme,
  opacity,
  outline = false,
}: {
  params: GenerateParams;
  theme: Theme;
  opacity?: number;
  /** Draw the contour only — used for the ghost copies in the "Alive" section. */
  outline?: boolean;
}) {
  return (
    <path
      d={markPath(params)}
      fill={outline ? 'none' : theme.ink}
      stroke={outline ? theme.ink : undefined}
      strokeWidth={outline ? 6 : undefined}
      fillRule="evenodd"
      opacity={opacity}
    />
  );
}

const HOLD_MS = 1600;
const CYCLE_MS = GROWTH_DURATION_MS + HOLD_MS;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Step 5 grows itself: the Studio's own growth schedule, replayed on a loop.
 * It only runs while the tile is on screen, and never when the visitor has
 * asked for reduced motion — in that case the finished mark is simply drawn.
 */
export function GrowingMark({ theme, params }: { theme: Theme; params: GooParams }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const schedule = useMemo(() => buildGrowthSchedule(LOOP_NODES, LOOP_EDGES), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;
    if (typeof IntersectionObserver !== 'function') return;

    let frame = 0;
    let start = 0;

    const tick = (now: number) => {
      if (start === 0) start = now;
      setElapsed((now - start) % CYCLE_MS);
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (frame === 0) frame = requestAnimationFrame(tick);
        } else if (frame !== 0) {
          cancelAnimationFrame(frame);
          frame = 0;
          start = 0;
          setElapsed(null);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  const display =
    elapsed === null
      ? { nodes: LOOP_NODES, edges: LOOP_EDGES }
      : applyGrowthDisplay(LOOP_NODES, LOOP_EDGES, scalesAtElapsed(schedule, elapsed));

  return (
    <div ref={hostRef}>
      <ArtFrame theme={theme}>
        <GooLayer
          id="intro-growth-goo"
          nodes={display.nodes}
          edges={display.edges}
          theme={theme}
          params={params}
        />
      </ArtFrame>
    </div>
  );
}
