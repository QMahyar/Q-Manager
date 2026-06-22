import type { ReactNode, ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  backTo?: string;
  /** Optional Tabler icon component to show beside the title */
  icon?: ElementType;
  /** Tailwind color class for the icon, e.g. "text-sky-500" */
  iconColor?: string;
}

export function PageHeader({
  title,
  description,
  children,
  backTo = "/",
  icon: Icon,
  iconColor = "text-primary",
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/60 bg-background/90 backdrop-blur-sm px-6 py-4 sticky top-0 z-10 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          {/* Back button */}
          <motion.div
            whileHover={{ x: -2, scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(backTo)}
              className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
              aria-label="Go back"
            >
              <IconArrowLeft className="h-4 w-4" />
            </Button>
          </motion.div>

          {/* Optional page icon */}
          {Icon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.75 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 24, delay: 0.04 }}
              className={`p-1.5 rounded-lg bg-muted/70 ${iconColor}`}
            >
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </motion.div>
          )}

          {/* Title + description */}
          <motion.div
            className="flex flex-col"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.05 }}
          >
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-tight">{title}</h1>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </motion.div>
        </div>

        {/* Right-side actions */}
        {children && (
          <motion.div
            className="flex flex-wrap items-center gap-2 md:justify-end shrink-0"
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.08 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </header>
  );
}
