/**
 * Lightweight page wrapper — a quick CSS opacity fade on mount (~120ms).
 * No JS animation, no movement/blur/scale. Snappy by design.
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={cn("animate-page-fade", className)}>{children}</div>;
}
