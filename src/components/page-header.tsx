import type { ReactNode, ElementType } from "react";
import { useNavigate } from "react-router-dom";
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
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(backTo)}
            className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
            aria-label="Go back"
          >
            <IconArrowLeft className="h-4 w-4" />
          </Button>

          {/* Optional page icon */}
          {Icon && (
            <div className={`p-1.5 rounded-lg bg-muted/70 ${iconColor}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
          )}

          {/* Title + description */}
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* Right-side actions */}
        {children && (
          <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
