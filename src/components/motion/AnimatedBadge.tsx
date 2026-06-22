/**
 * Animated status badge with pulse effects for different states
 */
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import type { AccountStatus } from "@/lib/types";

interface AnimatedBadgeProps {
  status: AccountStatus;
  className?: string;
}

const statusConfig: Record<AccountStatus, {
  dot: string;
  label: string;
  className: string;
  pulse: boolean;
  pulseSpeed: number;
}> = {
  stopped: {
    dot: "bg-muted-foreground/50",
    label: "Stopped",
    className: "bg-muted/60 text-muted-foreground border-border/60",
    pulse: false,
    pulseSpeed: 0,
  },
  starting: {
    dot: "bg-sky-500",
    label: "Starting",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    pulse: true,
    pulseSpeed: 1.2,
  },
  running: {
    dot: "bg-emerald-500",
    label: "Running",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    pulse: true,
    pulseSpeed: 2.2,
  },
  stopping: {
    dot: "bg-amber-500",
    label: "Stopping",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    pulse: true,
    pulseSpeed: 1.0,
  },
  reconnecting: {
    dot: "bg-amber-500",
    label: "Reconnecting",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    pulse: true,
    pulseSpeed: 0.7,
  },
  error: {
    dot: "bg-destructive",
    label: "Error",
    className: "bg-destructive/10 text-destructive border-destructive/30",
    pulse: true,
    pulseSpeed: 0.9,
  },
};

export function AnimatedBadge({ status, className }: AnimatedBadgeProps) {
  const config = statusConfig[status] ?? statusConfig["stopped"];

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
          config.className,
          className
        )}
      >
        <span className="relative flex size-1.5">
          {config.pulse && (
            <motion.span
              className={cn("absolute inset-0 rounded-full", config.dot)}
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{
                duration: config.pulseSpeed,
                repeat: Infinity,
                ease: [0.4, 0, 0.6, 1],
                repeatDelay: 0.1,
              }}
            />
          )}
          <span className={cn("relative rounded-full size-1.5", config.dot)} />
        </span>
        {config.label}
      </motion.span>
    </AnimatePresence>
  );
}
