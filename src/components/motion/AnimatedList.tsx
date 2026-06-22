/**
 * AutoAnimate wrapper for lists with automatic add/remove animations
 * Also exports a motion-based staggered list for manual control.
 */
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { motion } from "motion/react";
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
  duration = 180,
  easing = "ease-out",
  className,
}: AnimatedListProps) {
  const [parent] = useAutoAnimate({
    duration,
    easing,
  });

  return (
    <div ref={parent} className={cn(className)}>
      {children}
    </div>
  );
}

/** Stagger container — wraps items that use itemVariants */
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

/** Individual stagger item variant */
export const staggerItem = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 420,
      damping: 26,
      mass: 0.6,
    },
  },
};

interface StaggerListProps {
  children: ReactNode;
  className?: string;
}

/** Motion staggered list — children animate in sequence */
export function StaggerList({ children, className }: StaggerListProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/** Individual item inside a StaggerList */
export function StaggerItem({ children, className }: StaggerListProps) {
  return (
    <motion.div variants={staggerItem} className={cn(className)}>
      {children}
    </motion.div>
  );
}
