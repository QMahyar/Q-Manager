/**
 * Animated button with subtle hover/tap micro-interactions
 */
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface AnimatedButtonProps {
  children: ReactNode;
  /** Scale factor on hover (default: 1.02) */
  hoverScale?: number;
  /** Scale factor on tap (default: 0.98) */
  tapScale?: number;
  /** Disable animations */
  noAnimation?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs" | "icon-sm" | "icon-lg";
  disabled?: boolean;
  onClick?: () => void;
}

export function AnimatedButton({
  hoverScale = 1.02,
  tapScale = 0.98,
  noAnimation = false,
  children,
  className,
  variant,
  size,
  disabled,
  onClick,
}: AnimatedButtonProps) {
  if (noAnimation || disabled) {
    return (
      <Button className={className} variant={variant} size={size} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{
        type: "spring" as const,
        stiffness: 400,
        damping: 17,
      }}
      className="inline-block"
    >
      <Button className={className} variant={variant} size={size} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </motion.div>
  );
}
