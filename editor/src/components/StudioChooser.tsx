/**
 * The fork in the road: 2D marks, 3D objects and image studies are different
 * deliverables with different toolsets, so choosing between them is a page,
 * not a toggle tucked into a toolbar corner. Deep links skip this page;
 * the switch inside either editor is a full navigation on purpose.
 */
const PATHS = [
  {
    href: '/studio/mark',
    eyebrow: '2D',
    title: 'Mark',
    description: 'Draw the network, style the mark on the raster, export SVG and PNG.',
  },
  {
    href: '/studio/object',
    eyebrow: '3D',
    title: 'Object',
    description: 'Sculpt the form, apply curated surface textures, metamorph and render with AI.',
  },
  {
    href: '/studio/images',
    eyebrow: 'AI',
    title: 'Images',
    description: 'Make Hestia fields, atmospheric filters and intimate close-ups. Build your image library.',
  },
] as const;

export default function StudioChooser() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-6 text-foreground">
      <header className="text-center">
        <p className="font-mono text-[0.6875rem] tracking-[0.2em] text-muted-foreground uppercase">
          Namche
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Metaball Studio</h1>
      </header>
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {PATHS.map((path) => (
          <a
            key={path.href}
            href={path.href}
            className="group flex flex-col gap-2 rounded-xl border bg-card p-6 transition-colors hover:border-foreground/40"
          >
            <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-muted-foreground uppercase">
              {path.eyebrow}
            </span>
            <span className="text-xl font-semibold group-hover:underline">{path.title}</span>
            <span className="text-sm leading-snug text-muted-foreground">{path.description}</span>
          </a>
        ))}
      </div>
      <a href="/" className="text-xs text-muted-foreground hover:text-foreground">
        ← The story of the mark
      </a>
    </main>
  );
}
