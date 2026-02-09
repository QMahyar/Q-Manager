import { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import { IconLoader2, IconCheck, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export type ProgressStatus = "idle" | "loading" | "success" | "error";

interface ProgressIndicatorProps {
  status: ProgressStatus;
  progress?: number; // 0-100
  message?: string;
  className?: string;
}

/**
 * Progress indicator for async operations
 */
export function ProgressIndicator({
  status,
  progress,
  message,
  className = "",
}: ProgressIndicatorProps) {
  if (status === "idle") return null;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Icon */}
      <div className="flex-shrink-0">
        {status === "loading" && (
          <IconLoader2 className="size-5 animate-spin text-primary" />
        )}
        {status === "success" && (
          <IconCheck className="size-5 text-success" />
        )}
        {status === "error" && (
          <IconX className="size-5 text-destructive" />
        )}
      </div>

      {/* Progress bar or message */}
      <div className="flex-1 min-w-0">
        {progress !== undefined && status === "loading" ? (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            {message && (
              <p className="text-xs text-muted-foreground truncate">{message}</p>
            )}
          </div>
        ) : (
          message && (
            <p
              className={cn(
                "text-sm",
                status === "error" && "text-destructive",
                status === "success" && "text-success"
              )}
            >
              {message}
            </p>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Inline loading spinner
 */
export function LoadingSpinner({
  size = "default",
  className = "",
}: {
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "size-3",
    default: "size-4",
    lg: "size-6",
  };

  return (
    <IconLoader2 className={cn("animate-spin", sizeClasses[size], className)} />
  );
}

/**
 * Full-page loading overlay
 */
export function LoadingOverlay({
  message = "Loading...",
  visible = true,
}: {
  message?: string;
  visible?: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <IconLoader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/**
 * Step progress indicator for multi-step operations
 */
export function StepProgress({
  steps,
  className = "",
}: {
  steps: { label: string; status: ProgressStatus }[];
  currentStep?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {steps.map((step, index) => (
        <div key={index} className="flex items-center gap-3">
          {/* Step indicator */}
          <div
            className={cn(
              "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
              step.status === "idle" && "bg-muted text-muted-foreground",
              step.status === "loading" && "bg-primary text-primary-foreground",
              step.status === "success" && "bg-success text-success-foreground",
              step.status === "error" && "bg-destructive text-destructive-foreground"
            )}
          >
            {step.status === "loading" ? (
              <IconLoader2 className="size-3 animate-spin" />
            ) : step.status === "success" ? (
              <IconCheck className="size-3" />
            ) : step.status === "error" ? (
              <IconX className="size-3" />
            ) : (
              index + 1
            )}
          </div>

          {/* Step label */}
          <span
            className={cn(
              "text-sm",
              step.status === "idle" && "text-muted-foreground",
              step.status === "loading" && "font-medium",
              step.status === "success" && "text-success",
              step.status === "error" && "text-destructive"
            )}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Button with loading state
 */
export function ButtonWithLoading({
  children,
  loading,
  loadingText,
  disabled,
  onClick,
  className = "",
  variant = "default",
  size = "default",
  ...props
}: {
  children: ReactNode;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  };

  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <IconLoader2 className="size-4 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export default ProgressIndicator;
