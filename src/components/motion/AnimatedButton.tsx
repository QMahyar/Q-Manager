/**
 * Thin wrapper around Button. Press feedback is handled by Button's own CSS
 * `active:scale` state, so no JS animation is needed here.
 */
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AnimatedButtonProps {
  children: ReactNode;
  /** Accepted for API compatibility; no longer used. */
  hoverScale?: number;
  /** Accepted for API compatibility; no longer used. */
  tapScale?: number;
  /** Accepted for API compatibility; no longer used. */
  noAnimation?: boolean;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs" | "icon-xs" | "icon-sm" | "icon-lg";
  disabled?: boolean;
  onClick?: () => void;
}

export function AnimatedButton({
  children,
  className,
  variant,
  size,
  disabled,
  onClick,
}: AnimatedButtonProps) {
  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
