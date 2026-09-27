export default function AppCredits() {
  return (
    <footer
      aria-label="Project credits"
      className="mt-2 flex shrink-0 flex-wrap items-center gap-x-1 gap-y-0.5 border-t py-3 font-mono text-[0.5625rem] leading-snug text-muted-foreground [&_a]:text-inherit [&_a]:decoration-transparent hover:[&_a]:text-foreground hover:[&_a]:decoration-current"
    >
      <a href="https://github.com/NamcheAI/metaball" target="_blank" rel="noreferrer">
        GitHub
      </a>
      <span aria-hidden="true">·</span>
      <span>
        Original Studio by{' '}
        <a href="https://github.com/fizzybubbele" target="_blank" rel="noreferrer">
          Michael Marte
        </a>{' '}
        /{' '}
        <a href="https://ruhmetc.com/" target="_blank" rel="noreferrer">
          Ruhm etc.
        </a>
      </span>
    </footer>
  );
}
