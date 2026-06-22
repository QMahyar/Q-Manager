/**
 * Telethon Initialization Loader
 * Shows a rich loading animation while Telethon initializes
 */
import { motion } from "motion/react";
import { WolfLogo } from "./WolfLogo";

interface TelethonLoaderProps {
  message?: string;
}

export function TelethonLoader({ message = "Initializing Telethon..." }: TelethonLoaderProps) {
  return (
    <motion.div
      className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-8 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Animated wolf logo with entrance */}
      <motion.div
        initial={{ opacity: 0, scale: 0.75, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 22, mass: 0.8, delay: 0.1 }}
      >
        <WolfLogo size={88} animate={true} />
      </motion.div>

      {/* Loading indicator */}
      <div className="flex flex-col items-center gap-4">
        {/* Dot wave */}
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{
                y: [0, -10, 0],
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1.0,
                repeat: Infinity,
                delay: i * 0.12,
                ease: [0.4, 0, 0.6, 1],
              }}
            />
          ))}
        </div>

        <motion.p
          className="text-sm text-muted-foreground tracking-wide"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3, ease: "easeOut" }}
        >
          {message}
        </motion.p>
      </div>
    </motion.div>
  );
}

/**
 * Inline loader for smaller contexts (buttons, cards)
 */
export function InlineLoader({ size = 16 }: { size?: number }) {
  const dotSize = Math.max(3, Math.round(size / 4));
  return (
    <motion.div
      className="flex gap-0.5 items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full bg-current"
          style={{ width: dotSize, height: dotSize }}
          animate={{
            y: [0, -(dotSize * 1.5), 0],
            opacity: [0.4, 1, 0.4],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 0.65,
            repeat: Infinity,
            delay: i * 0.12,
            ease: [0.4, 0, 0.6, 1],
          }}
        />
      ))}
    </motion.div>
  );
}
