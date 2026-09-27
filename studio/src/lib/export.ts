import { generate, type GenerateParams } from '@namche/metaball';
import { SVG_SIZE } from './model';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type ExportOptions = {
  markOnly: boolean; // strip the pink/blue grid + dots, transparent background
  /** Keep the metaball filter instead of stripping it. */
  keepFilters?: boolean;
};

// When present, the metaball is flattened to a real vector path so it survives
// export to tools that ignore SVG filters (Figma, Illustrator).
export type FlattenSpec = { params: GenerateParams; ink: string };

// Produce a clean, standalone SVG element for export.
function buildExportSvg(
  source: SVGSVGElement,
  opts: ExportOptions,
  flatten?: FlattenSpec | null,
): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;

  // Remove editor-only affordances (hit areas, selection ring, drag line).
  clone.querySelectorAll('.editor-only').forEach((el) => el.remove());

  if (opts.markOnly) {
    clone.querySelectorAll('.grid-layer').forEach((el) => el.remove());
  }

  // Replace the filtered metaball group with a flattened path.
  const filtered = clone.querySelector('g[filter]');
  if (filtered) {
    if (flatten) {
      const { d } = generate(flatten.params);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', flatten.ink);
      path.setAttribute('fill-rule', 'evenodd');
      filtered.replaceWith(path);
    } else if (!opts.keepFilters) {
      filtered.removeAttribute('filter');
    }
  }

  // Drop unused filter defs after flatten / filter strip.
  clone.querySelectorAll('filter#goo').forEach((el) => {
    const id = el.getAttribute('id');
    if (!id) return;
    if (!clone.querySelector(`[filter="url(#${id})"]`)) el.remove();
  });

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(SVG_SIZE));
  clone.setAttribute('height', String(SVG_SIZE));
  clone.removeAttribute('style');
  return clone;
}

export function serializeSvg(
  source: SVGSVGElement,
  opts: ExportOptions,
  flatten?: FlattenSpec | null,
): string {
  const svg = buildExportSvg(source, opts, flatten);
  const xml = new XMLSerializer().serializeToString(svg);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copySvgToClipboard(
  source: SVGSVGElement,
  opts: ExportOptions,
  flatten?: FlattenSpec | null,
): Promise<boolean> {
  const svgString = serializeSvg(source, opts, flatten);
  try {
    await navigator.clipboard.writeText(svgString);
    return true;
  } catch {
    return false;
  }
}

export function exportSvg(
  source: SVGSVGElement,
  opts: ExportOptions,
  flatten?: FlattenSpec | null,
  name = 'metaball',
) {
  const svgString = serializeSvg(source, opts, flatten);
  download(`${name}.svg`, new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
}

export async function exportPng(
  source: SVGSVGElement,
  opts: ExportOptions,
  flatten?: FlattenSpec | null,
  scale = 4,
  name = 'metaball',
) {
  const svgString = serializeSvg(source, opts, flatten);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.width = SVG_SIZE;
    img.height = SVG_SIZE;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to render SVG for PNG export'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = SVG_SIZE * scale;
    canvas.height = SVG_SIZE * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) download(`${name}.png`, blob);
        resolve();
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
