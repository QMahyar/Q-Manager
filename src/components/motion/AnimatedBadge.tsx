/**
 * Animated status badge with pulse effects for different states
 */
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AccountStatus } from "@/lib/types";

interface AnimatedBadgeProps {
  status: AccountStatus;
  className?: string;
}

const statusConfig: Record<AccountStatus, {
  variant: "default" | "secondary" | "destructive" | "outline";
  pulse: boolean;
  pulseColor: string;
}> = {
  stopped: {
    variant: "secondary",
    pulse: false,
    pulseColor: "",
  },
  starting: {
    variant: "outline",
    pulse: true,
    pulseColor: "bg-info/50",
  },
  running: {
    variant: "default",
    pulse: true,
    pulseColor: "bg-success/50",
  },
  stopping: {
    variant: "outline",
    pulse: true,
    pulseColor: "bg-warning/50",
  },
  reconnecting: {
    variant: "outline",
    pulse: true,
    pulseColor: "bg-warning/50",
  },
  error: {
    variant: "destructive",
    pulse: true,
    pulseColor: "bg-destructive/50",
  },
};

export function AnimatedBadge({ status, className }: AnimatedBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className={cn("relative inline-flex", className)}>
      {config.pulse && (
        <motion.span
          className={cn(
            "absolute inset-0 rounded-full",
            config.pulseColor
          )}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}
      <Badge variant={config.variant} className="relative">
        {status}
      </Badge>
    </div>
  );
}
