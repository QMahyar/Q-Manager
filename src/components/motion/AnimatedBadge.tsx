/**
 * Status badge. Keeps a lightweight CSS ping pulse on active states (a live
 * signal) — no JS animation library involved.
 */
import { cn } from "@/lib/utils";
import type { AccountStatus } from "@/lib/types";

interface AnimatedBadgeProps {
  status: AccountStatus;
  className?: string;
}

const statusConfig: Record<
  AccountStatus,
  { dot: string; label: string; className: string; pulse: boolean }
> = {
  stopped: {
    dot: "bg-muted-foreground/50",
    label: "Stopped",
    className: "bg-muted/60 text-muted-foreground border-border/60",
    pulse: false,
  },
  starting: {
    dot: "bg-sky-500",
    label: "Starting",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    pulse: true,
  },
  running: {
    dot: "bg-emerald-500",
    label: "Running",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    pulse: true,
  },
  stopping: {
    dot: "bg-amber-500",
    label: "Stopping",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    pulse: true,
  },
  reconnecting: {
    dot: "bg-amber-500",
    label: "Reconnecting",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    pulse: true,
  },
  error: {
    dot: "bg-destructive",
    label: "Error",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    pulse: false,
  },
};

export function AnimatedBadge({ status, className }: AnimatedBadgeProps) {
  const config = statusConfig[status] ?? statusConfig["stopped"];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.className,
        className
      )}
    >
      <span className="relative flex size-1.5">
        {config.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              config.dot
            )}
          />
        )}
        <span className={cn("relative inline-flex rounded-full size-1.5", config.dot)} />
      </span>
      {config.label}
    </span>
  );
}
