/**
 * Card wrapper with a subtle CSS hover lift. No entrance/spring animation.
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** Kept for API compatibility; no longer drives a staggered entrance. */
  index?: number;
  /** Enable the hover lift + pointer cursor. */
  interactive?: boolean;
}

export function AnimatedCard({
  children,
  className,
  onClick,
  interactive = true,
}: AnimatedCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        interactive &&
          "cursor-pointer transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-black/[0.06] dark:hover:shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Plain container — staggered child entrance has been removed. */
export function AnimatedCardContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
