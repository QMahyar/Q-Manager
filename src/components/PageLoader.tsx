import { motion } from "motion/react";

/**
 * Loading fallback for lazy-loaded pages — animated dot wave
 */
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        {/* Dot wave loader */}
        <div className="flex gap-1.5 items-end h-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 rounded-full bg-primary"
              animate={{ height: ["6px", "20px", "6px"], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.1,
                ease: [0.4, 0, 0.6, 1],
              }}
            />
          ))}
        </div>
        <motion.p
          className="text-xs text-muted-foreground tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          Loading…
        </motion.p>
      </div>
    </div>
  );
}
