/**
 * Loading fallback for lazy-loaded pages — a minimal CSS spinner.
 */
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
        <p className="text-xs text-muted-foreground tracking-wide">Loading…</p>
      </div>
    </div>
  );
}
