/**
 * Page transition wrapper with spring-physics fade + slide animations
 */
import { motion } from "motion/react";
import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.99,
    filter: "blur(2px)",
  },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.99,
    filter: "blur(1px)",
  },
};

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 30,
        mass: 0.8,
        opacity: { duration: 0.18, ease: "easeOut" },
        filter: { duration: 0.2, ease: "easeOut" },
      }}
      style={{ willChange: "transform, opacity" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
