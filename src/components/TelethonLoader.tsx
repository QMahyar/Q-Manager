/**
 * Telethon Initialization Loader — static logo + a minimal CSS spinner.
 */
import { WolfLogo } from "./WolfLogo";

interface TelethonLoaderProps {
  message?: string;
}

export function TelethonLoader({ message = "Initializing Telethon..." }: TelethonLoaderProps) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-8 z-50 animate-page-fade">
      <WolfLogo size={88} />

      <div className="flex flex-col items-center gap-4">
        <div className="size-6 rounded-full border-2 border-muted border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground tracking-wide">{message}</p>
      </div>
    </div>
  );
}

/**
 * Inline loader for smaller contexts (buttons, cards) — inherits text color.
 */
export function InlineLoader({ size = 16 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent opacity-70 align-[-0.125em]"
      style={{ width: size, height: size }}
    />
  );
}
