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

export function AnimatedCard({
  children,
  className,
  onClick,
  index = 0,
  interactive = true,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05, // Stagger effect
        ease: "easeOut",
      }}
      whileHover={interactive ? { scale: 1.02, y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-shadow",
        interactive && "hover:shadow-lg",
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
