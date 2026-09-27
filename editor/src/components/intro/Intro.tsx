import { useEffect, useState, type ReactNode } from 'react';
import type { GenerateParams } from '@namche/metaball';

import { Button } from '@/components/ui/button';
import { ThemeMenu } from '@/components/theme-menu';
import { useTheme } from '@/hooks/use-theme';
import { BRAND } from '../../lib/brand';
import { DAY_THEME, NIGHT_THEME, SVG_SIZE, cellRect, type Theme } from '../../lib/model';
import AppCredits from '../AppCredits';
import { ArtFrame, GraphLayer, GrowingMark, NodeLayer, TracedMark } from './IntroArt';
import { LOOP_EDGES, LOOP_GOO, LOOP_NODES, SEED_NODES, WEIGHTED_NODES } from './marks';

const LOOP_PARAMS: GenerateParams = { preset: 'loop' };

/** Step 4 — the same five nodes with the necks pulled in, mid-fusion. */
const FUSION_PARAMS: GenerateParams = {
  nodes: LOOP_NODES,
  edges: LOOP_EDGES,
  neck: LOOP_GOO.tubeFactor,
  blur: LOOP_GOO.gooStd,
  contrast: LOOP_GOO.gooThreshold,
  // 0.45, not higher: at the loop's blur/contrast a stronger pinch severs
  // the necks and the "fusion" tile reads as separate droplets.
  pinch: 0.45,
};

/**
 * The story art follows the interface theme, using the very same Day/Night pair
 * the Studio writes into a document — so the page is also a demonstration of
 * the canvas theme it is introducing.
 */
function useCanvasTheme(): Theme {
  const { theme } = useTheme();
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const dark = theme === 'system' ? systemDark : theme === 'dark';
  return dark ? NIGHT_THEME : DAY_THEME;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.6875rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function Section({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">{children}</div>
    </section>
  );
}

function BrandLockup() {
  return (
    <a href="/" className="flex min-w-0 items-center gap-2.5 no-underline">
      <img src="/namche-mark.svg" alt="" aria-hidden="true" className="size-6 shrink-0 invert" />
      {/* Same as the Studio's top bar: below `sm` the mark carries the brand
          on its own and the wordmark steps aside. */}
      <span className="hidden min-w-0 flex-col leading-none sm:flex">
        <span className="font-mono text-[0.5625rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {BRAND.wordmark}
        </span>
        <span className="truncate font-display text-base font-medium">{BRAND.product}</span>
      </span>
    </a>
  );
}

/* Slide 03: the old letterform, assembled from raster cells. Implied with four
   geometric pieces rather than redrawn — the point is the vocabulary (quarter
   rounds and bars snapped to a grid), not the retired logo. */
function LegacyGlyph({ theme }: { theme: Theme }) {
  const topLeft = cellRect(1, 1);
  const topRight = cellRect(1, 3);
  const bottomLeft = cellRect(3, 1);
  const bottomRight = cellRect(3, 3);
  const s = topLeft.w;
  const half = s / 2;

  // A quarter round with its right angle at the cell's bottom-right corner.
  const wedgeTopLeft = [
    `M ${topLeft.x + s} ${topLeft.y}`,
    `L ${topLeft.x + s} ${topLeft.y + s}`,
    `L ${topLeft.x} ${topLeft.y + s}`,
    `A ${s} ${s} 0 0 1 ${topLeft.x + s} ${topLeft.y}`,
    'Z',
  ].join(' ');

  // A quarter round with its right angle at the cell's top-left corner.
  const wedgeBottomRight = [
    `M ${bottomRight.x} ${bottomRight.y}`,
    `L ${bottomRight.x + s} ${bottomRight.y}`,
    `A ${s} ${s} 0 0 1 ${bottomRight.x} ${bottomRight.y + s}`,
    'Z',
  ].join(' ');

  // A bar with one rounded end, reaching to the far cell.
  const barRight = [
    `M ${topLeft.x + s} ${topLeft.y}`,
    `H ${topRight.x + s - half}`,
    `A ${half} ${half} 0 0 1 ${topRight.x + s - half} ${topLeft.y + s}`,
    `H ${topLeft.x + s}`,
    'Z',
  ].join(' ');

  const barDown = [
    `M ${topLeft.x} ${topLeft.y + s}`,
    `V ${bottomLeft.y + s - half}`,
    `A ${half} ${half} 0 0 0 ${topLeft.x + s} ${bottomLeft.y + s - half}`,
    `V ${topLeft.y + s}`,
    'Z',
  ].join(' ');

  return (
    <g fill={theme.ink}>
      <path d={wedgeTopLeft} />
      <path d={barRight} />
      <path d={barDown} />
      <path d={wedgeBottomRight} />
    </g>
  );
}

type Step = {
  id: string;
  caption: string;
  art: (theme: Theme) => ReactNode;
};

const STEPS: Step[] = [
  {
    id: '01',
    caption: 'Nodes',
    art: (theme) => (
      <ArtFrame theme={theme}>
        <NodeLayer nodes={SEED_NODES} theme={theme} />
      </ArtFrame>
    ),
  },
  {
    id: '02',
    caption: 'Weight',
    art: (theme) => (
      <ArtFrame theme={theme}>
        <NodeLayer nodes={WEIGHTED_NODES} theme={theme} />
      </ArtFrame>
    ),
  },
  {
    id: '03',
    caption: 'Connection',
    art: (theme) => (
      <ArtFrame theme={theme}>
        <GraphLayer nodes={LOOP_NODES} edges={LOOP_EDGES} theme={theme} />
      </ArtFrame>
    ),
  },
  {
    id: '04',
    caption: 'Fusion',
    art: (theme) => (
      <ArtFrame theme={theme}>
        <TracedMark params={FUSION_PARAMS} theme={theme} />
      </ArtFrame>
    ),
  },
  {
    id: '05',
    caption: 'The mark',
    art: (theme) => <GrowingMark theme={theme} params={LOOP_GOO} />,
  },
];

export default function Intro() {
  const canvas = useCanvasTheme();

  return (
    <div className="min-h-full bg-background text-foreground">
      {/* Hero — night in both themes, the way the deck's title slides are. The
          `dark` class re-points the design tokens for this subtree only, so
          every control inside it is correct without a second palette. */}
      <section className="dark bg-background text-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-16 px-6 pt-5 pb-24 sm:gap-20 sm:pb-28">
          <header className="flex items-center gap-3">
            <BrandLockup />
            <div className="ml-auto flex items-center gap-1">
              <ThemeMenu />
              <Button
                variant="link"
                nativeButton={false}
                render={<a href="/studio">Open the Studio</a>}
              />
            </div>
          </header>

          <div className="grid items-center gap-12 md:grid-cols-[1.15fr_1fr] md:gap-16">
            <div className="flex flex-col gap-6">
              <Eyebrow>Design exploration: NAMCHE</Eyebrow>
              <h1 className="max-w-[14ch] font-display text-4xl leading-[1.04] font-medium tracking-tight text-balance sm:text-5xl lg:text-6xl">
                From chessboard to network.
              </h1>
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground sm:text-lg">
                The story of the NAMCHE metaball mark — and the studio that draws it.
              </p>
            </div>
            <div className="mx-auto w-full max-w-[18rem] md:max-w-none">
              <ArtFrame theme={NIGHT_THEME} raster={false}>
                <TracedMark params={LOOP_PARAMS} theme={NIGHT_THEME} />
              </ArtFrame>
            </div>
          </div>
        </div>
      </section>

      {/* 2 — the existing system */}
      <Section className="border-t">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_1fr] md:gap-16">
          <div className="flex flex-col gap-6">
            <Eyebrow>Design system [Existing]</Eyebrow>
            <h2 className="font-display text-2xl leading-tight font-medium tracking-tight sm:text-3xl">
              A brand that grew up on graph paper.
            </h2>
            <div className="flex max-w-prose flex-col gap-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                The old system was a raster: <span className="font-mono">Y = X/8</span>, five cells
                by five, a pink outer field around a light-blue inner canvas. Every earlier form was
                assembled from those cells — quarter rounds, bars, squares.
              </p>
              <p>
                It was precise, and it was static. The grid held the shapes apart: whatever you
                built, the geometry was a layout of separated parts.
              </p>
            </div>
          </div>
          <figure className="mx-auto flex w-full max-w-[22rem] flex-col gap-3 md:max-w-none">
            <ArtFrame theme={canvas}>
              <LegacyGlyph theme={canvas} />
            </ArtFrame>
            <figcaption>
              <Caption>Y = X/8 · 5 × 5 · a form assembled from cells</Caption>
            </figcaption>
          </figure>
        </div>
      </Section>

      {/* 3 — the pivot */}
      <section className="dark border-t bg-background text-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-24 sm:py-28">
          <Eyebrow>The pivot</Eyebrow>
          <blockquote
            lang="de"
            cite="Design exploration: NAMCHE"
            className="max-w-[24ch] font-display text-2xl leading-[1.2] font-medium tracking-tight text-balance sm:max-w-[30ch] sm:text-3xl lg:text-4xl"
          >
            Vom Schachbrett zum Netzwerk: statt geometrischer Trennung entsteht ein reaktives,
            vernetztes System – lebendig, auf äußere Reize reagierend, auch dreidimensional denkbar.
          </blockquote>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
            From chessboard to network: instead of geometric separation, a reactive, connected
            system — alive, responding to its surroundings, at home in three dimensions.
          </p>
        </div>
      </section>

      {/* 4 — the new system, step by step */}
      <Section className="border-t">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <Eyebrow>Design system [New]</Eyebrow>
            <h2 className="font-display text-2xl leading-tight font-medium tracking-tight sm:text-3xl">
              How the mark is born.
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
              The new system keeps the raster and changes what stands on it. Five nodes, four
              connections, one blur re-cut at a threshold — and the geometry stops being a layout
              and starts being a field. Every step below is drawn live by the engine, on this page.
            </p>
          </div>
          <ol className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-5">
            {STEPS.map((step) => (
              <li key={step.id} className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-md border">{step.art(canvas)}</div>
                <Caption>
                  {step.id} — {step.caption}
                </Caption>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* 5 — alive */}
      <Section className="border-t">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6">
            <Eyebrow>Alive</Eyebrow>
            <h2 className="font-display text-2xl leading-tight font-medium tracking-tight sm:text-3xl">
              A field, not a drawing.
            </h2>
          </div>
          <div className="grid gap-12 md:grid-cols-2 md:gap-16">
            <div className="flex flex-col gap-5">
              <div className="mx-auto w-full max-w-[15rem] md:mx-0">
                {/* The mark breathing: two contour ghosts around the solid form. */}
                <ArtFrame theme={canvas} raster={false}>
                  {[1, 0.91].map((scale, index) => (
                    <g
                      key={scale}
                      transform={`translate(${((1 - scale) * SVG_SIZE) / 2} ${((1 - scale) * SVG_SIZE) / 2}) scale(${scale})`}
                    >
                      <TracedMark
                        params={LOOP_PARAMS}
                        theme={canvas}
                        outline
                        opacity={0.28 + index * 0.16}
                      />
                    </g>
                  ))}
                  <g transform={`translate(${0.09 * SVG_SIZE} ${0.09 * SVG_SIZE}) scale(0.82)`}>
                    <TracedMark params={LOOP_PARAMS} theme={canvas} />
                  </g>
                </ArtFrame>
              </div>
              <h3 className="font-display text-lg font-medium">It moves.</h3>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Because the mark is a graph, it can be played. The Studio grows it along its own
                edges, outward from the most central node, and loops it with motions that breathe,
                drift and pulse. Nothing is keyframed — the geometry is recomputed every frame.
              </p>
            </div>
            <div className="flex flex-col gap-5">
              <div className="mx-auto w-full max-w-[15rem] md:mx-0">
                {/* One field, sliced: contour after contour stacked upward, with
                    the solid mark as the near face. */}
                <ArtFrame theme={canvas} raster={false}>
                  <g transform="translate(0 44)">
                    {[3, 2, 1].map((slice) => (
                      <g key={slice} transform={`translate(0 ${-slice * 30})`}>
                        <TracedMark
                          params={LOOP_PARAMS}
                          theme={canvas}
                          outline
                          opacity={0.2 + (3 - slice) * 0.14}
                        />
                      </g>
                    ))}
                    <TracedMark params={LOOP_PARAMS} theme={canvas} />
                  </g>
                </ArtFrame>
              </div>
              <h3 className="font-display text-lg font-medium">It has depth.</h3>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                The same scalar field, lifted a dimension: an isosurface through marching cubes,
                with organic and liquid materials, camera studies and a Blender handoff. That
                viewer is a Studio feature and stays there — this page never loads it.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 6 — the way in */}
      <Section className="border-t">
        <div className="flex flex-col items-start gap-6">
          <h2 className="max-w-[18ch] font-display text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl">
            Draw one.
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
            The Studio is this engine with a face on it: place nodes on the raster, connect them,
            pinch the necks, watch it grow, and export SVG or PNG.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button
              size="lg"
              nativeButton={false}
              render={<a href="/studio">Open the Studio</a>}
            />
            <a
              href="https://ui.namche.ai"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase no-underline hover:text-foreground"
            >
              Built on the NAMCHE design system
            </a>
          </div>
        </div>
      </Section>

      <div className="mx-auto max-w-5xl px-6 pb-8">
        <AppCredits />
      </div>
    </div>
  );
}
