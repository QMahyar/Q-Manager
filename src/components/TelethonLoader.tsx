/**
 * Telethon Initialization Loader
 * Shows a subtle loading animation while Telethon initializes
 */
import { motion } from "motion/react";
import { WolfLogo } from "./WolfLogo";

interface TelethonLoaderProps {
  message?: string;
}

export function TelethonLoader({ message = "Initializing Telethon..." }: TelethonLoaderProps) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-6 z-50">
      {/* Animated wolf logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <WolfLogo size={80} animate={true} />
      </motion.div>

      {/* Loading indicator */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-primary"
              animate={{
                y: [0, -8, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        <motion.p
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}

/**
 * Inline loader for smaller contexts (buttons, cards)
 */
export function InlineLoader({ size = 16 }: { size?: number }) {
  return (
    <motion.div
      className="flex gap-0.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full bg-current"
          style={{ width: size / 4, height: size / 4 }}
          animate={{
            y: [0, -size / 4, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}
