import { inwardGooStd } from '../lib/model';

/**
 * The live fusion filter: blur the union of circles and capsules, then re-cut
 * the alpha channel. It is the browser-side twin of the engine's rasterize →
 * threshold → trace pipeline, and it is what makes the mark move without
 * re-tracing a path every frame.
 *
 * SVG filter ids are document-global, so every canvas on a page passes its own.
 */
export default function GooFilter({
  id,
  gooStd,
  gooThreshold,
  inwardPull,
}: {
  id: string;
  gooStd: number;
  gooThreshold: number;
  inwardPull: number;
}) {
  return (
    <filter id={id} x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
      <feGaussianBlur
        in="SourceGraphic"
        stdDeviation={inwardGooStd(gooStd, inwardPull)}
        result="blur"
      />
      <feColorMatrix
        in="blur"
        mode="matrix"
        values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${gooThreshold} ${-gooThreshold / 2}`}
      />
    </filter>
  );
}
