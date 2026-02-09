/**
 * Geometric Wolf Logo with subtle idle breathing animation
 * Clean, minimal design made of simple geometric shapes
 */
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface WolfLogoProps {
  size?: number;
  className?: string;
  animate?: boolean;
}

export function WolfLogo({ size = 64, className, animate = true }: WolfLogoProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      animate={animate ? { scale: [1, 1.02, 1] } : undefined}
      transition={animate ? {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut" as const,
      } : undefined}
    >
      {/* Wolf head - geometric shapes */}
      <g>
        {/* Left ear */}
        <motion.polygon
          points="12,8 20,24 8,24"
          fill="currentColor"
          opacity={0.9}
          animate={animate ? { y: [0, -0.5, 0] } : undefined}
          transition={animate ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const, delay: 0.2 } : undefined}
        />
        
        {/* Right ear */}
        <motion.polygon
          points="52,8 56,24 44,24"
          fill="currentColor"
          opacity={0.9}
          animate={animate ? { y: [0, -0.5, 0] } : undefined}
          transition={animate ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" as const, delay: 0.4 } : undefined}
        />
        
        {/* Head main shape - hexagonal */}
        <polygon
          points="32,12 48,22 52,38 42,54 22,54 12,38 16,22"
          fill="currentColor"
          opacity={0.95}
        />
        
        {/* Snout - triangle pointing down */}
        <polygon
          points="32,36 40,48 24,48"
          fill="currentColor"
          className="text-background"
          opacity={0.15}
        />
        
        {/* Left eye - diamond */}
        <motion.polygon
          points="22,30 26,26 30,30 26,34"
          fill="currentColor"
          className="text-background"
          animate={animate ? { opacity: [1, 0.7, 1] } : undefined}
          transition={animate ? { duration: 4, repeat: Infinity, ease: "easeInOut" as const } : undefined}
        />
        
        {/* Right eye - diamond */}
        <motion.polygon
          points="34,30 38,26 42,30 38,34"
          fill="currentColor"
          className="text-background"
          animate={animate ? { opacity: [1, 0.7, 1] } : undefined}
          transition={animate ? { duration: 4, repeat: Infinity, ease: "easeInOut" as const } : undefined}
        />
        
        {/* Nose - small triangle */}
        <polygon
          points="32,40 35,44 29,44"
          fill="currentColor"
          className="text-background"
          opacity={0.8}
        />
      </g>
    </motion.svg>
  );
}

/**
 * Simple wolf icon for smaller uses (nav, tray, etc.)
 * No animation, just the static geometric shape
 */
export function WolfIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
    >
      {/* Simplified wolf head */}
      <polygon
        points="4,3 8,9 3,9"
        fill="currentColor"
        opacity={0.9}
      />
      <polygon
        points="20,3 21,9 16,9"
        fill="currentColor"
        opacity={0.9}
      />
      <polygon
        points="12,5 19,9 20,15 16,21 8,21 4,15 5,9"
        fill="currentColor"
      />
      {/* Eyes */}
      <circle cx="9" cy="12" r="1.5" fill="currentColor" className="text-background" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" className="text-background" />
      {/* Nose */}
      <polygon points="12,15 14,18 10,18" fill="currentColor" className="text-background" opacity={0.7} />
    </svg>
  );
}
