/**
 * Animated button with responsive spring micro-interactions
 */
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface AnimatedButtonProps {
  children: ReactNode;
  /** Scale factor on hover (default: 1.03) */
  hoverScale?: number;
  /** Scale factor on tap (default: 0.96) */
  tapScale?: number;
  /** Disable animations */
  noAnimation?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs" | "icon-sm" | "icon-lg";
  disabled?: boolean;
  onClick?: () => void;
}

// Tight, snappy spring — feels like a real physical button
const springConfig = {
  type: "spring" as const,
  stiffness: 500,
  damping: 22,
  mass: 0.5,
};

export function AnimatedButton({
  hoverScale = 1.03,
  tapScale = 0.96,
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
      whileHover={{ scale: hoverScale, transition: { ...springConfig, stiffness: 600 } }}
      whileTap={{ scale: tapScale, transition: springConfig }}
      transition={springConfig}
      style={{ willChange: "transform", display: "inline-block" }}
    >
      <Button className={className} variant={variant} size={size} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </motion.div>
  );
}
