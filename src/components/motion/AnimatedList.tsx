/**
 * AutoAnimate wrapper for lists with automatic add/remove animations
 */
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedListProps {
  children: ReactNode;
  duration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "ease-in-out";
  className?: string;
}

export function AnimatedList({
  children,
  duration = 200,
  easing = "ease-out",
  className,
}: AnimatedListProps) {
  const [parent] = useAutoAnimate({
    duration,
    easing,
  });

  return (
    <div
      ref={parent}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
