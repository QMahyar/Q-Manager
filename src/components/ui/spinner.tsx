import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClasses = {
    sm: "size-4 border-2",
    md: "size-6 border-2",
    lg: "size-8 border-4",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-solid border-current border-r-transparent",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
      <Spinner size="lg" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

interface LoadingContentProps {
  loading?: boolean;
  children: React.ReactNode;
}

export function LoadingContent({ loading, children }: LoadingContentProps) {
  if (loading) {
    return (
      <>
        <Spinner size="sm" className="mr-2" />
        Loading...
      </>
    );
  }
  return <>{children}</>;
}
