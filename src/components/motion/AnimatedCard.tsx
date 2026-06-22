/**
 * Animated card with hover effects and staggered entry
 */
import { motion } from "motion/react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  index?: number; // For staggered animations
  interactive?: boolean; // Enable hover/tap effects
}

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.97,
  },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
      mass: 0.7,
      delay: index * 0.055,
    },
  }),
};

export function AnimatedCard({
  children,
  className,
  onClick,
  index = 0,
  interactive = true,
}: AnimatedCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      custom={index}
      whileHover={interactive ? {
        scale: 1.025,
        y: -3,
        transition: { type: "spring", stiffness: 500, damping: 25, mass: 0.5 },
      } : undefined}
      whileTap={interactive ? {
        scale: 0.97,
        transition: { type: "spring", stiffness: 600, damping: 30 },
      } : undefined}
      onClick={onClick}
      style={{ willChange: "transform" }}
      className={cn(
        "cursor-pointer",
        interactive && "hover:shadow-lg hover:shadow-black/[0.06] dark:hover:shadow-black/20",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container for staggered card animations
 */
interface AnimatedCardContainerProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedCardContainer({
  children,
  className,
}: AnimatedCardContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}
