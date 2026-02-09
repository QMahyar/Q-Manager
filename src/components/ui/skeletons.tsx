/**
 * Composite skeleton components for common loading states.
 * 
 * These provide consistent loading UI across the application.
 */

import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

// ============================================================================
// Table Skeletons
// ============================================================================

interface TableSkeletonProps {
  /** Number of rows to show */
  rows?: number;
  /** Number of columns to show */
  columns?: number;
  /** Whether to show a header row */
  showHeader?: boolean;
  /** Additional class names */
  className?: string;
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  showHeader = true,
  className 
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full space-y-3", className)} role="status" aria-label="Loading table">
      {showHeader && (
        <div className="flex gap-4 pb-2 border-b">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex} 
              className="h-8 flex-1" 
              style={{ opacity: 1 - rowIndex * 0.1 }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ============================================================================
// Card Skeletons
// ============================================================================

interface CardSkeletonProps {
  /** Whether to show an avatar */
  showAvatar?: boolean;
  /** Number of text lines */
  lines?: number;
  /** Additional class names */
  className?: string;
}

export function CardSkeleton({ 
  showAvatar = false, 
  lines = 3,
  className 
}: CardSkeletonProps) {
  return (
    <div 
      className={cn("p-4 border rounded-lg space-y-3", className)} 
      role="status" 
      aria-label="Loading card"
    >
      <div className="flex items-center gap-3">
        {showAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {lines > 0 && (
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="h-3" 
              style={{ width: `${100 - i * 15}%` }}
            />
          ))}
        </div>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ============================================================================
// List Skeletons
// ============================================================================

interface ListSkeletonProps {
  /** Number of items */
  items?: number;
  /** Whether items have icons */
  showIcon?: boolean;
  /** Additional class names */
  className?: string;
}

export function ListSkeleton({ 
  items = 5, 
  showIcon = false,
  className 
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading list">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          {showIcon && <Skeleton className="h-5 w-5 rounded" />}
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${80 - i * 5}%` }} />
        </div>
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ============================================================================
// Form Skeletons
// ============================================================================

interface FormSkeletonProps {
  /** Number of fields */
  fields?: number;
  /** Whether to show submit button */
  showButton?: boolean;
  /** Additional class names */
  className?: string;
}

export function FormSkeleton({ 
  fields = 3, 
  showButton = true,
  className 
}: FormSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} role="status" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      {showButton && (
        <div className="flex justify-end pt-2">
          <Skeleton className="h-10 w-24" />
        </div>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ============================================================================
// Account-Specific Skeletons
// ============================================================================

export function AccountRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 border-b" role="status" aria-label="Loading account">
      <Skeleton className="size-4 rounded" /> {/* Checkbox */}
      <Skeleton className="h-4 w-32" /> {/* Name */}
      <Skeleton className="h-4 w-28" /> {/* Phone */}
      <Skeleton className="h-4 w-20" /> {/* User ID */}
      <Skeleton className="h-6 w-16 rounded-full" /> {/* Status badge */}
      <div className="flex-1" />
      <Skeleton className="h-8 w-8 rounded" /> {/* Action button */}
      <Skeleton className="h-8 w-8 rounded" /> {/* Action button */}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function AccountsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0" role="status" aria-label="Loading accounts">
      {/* Header */}
      <div className="flex items-center gap-4 p-3 border-b bg-muted/50">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
        <div className="flex-1" />
        <Skeleton className="h-4 w-16" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <AccountRowSkeleton key={i} />
      ))}
      <span className="sr-only">Loading accounts...</span>
    </div>
  );
}

// ============================================================================
// Page-Level Skeletons
// ============================================================================

export function PageSkeleton({ 
  title = true,
  subtitle = false,
  children 
}: { 
  title?: boolean;
  subtitle?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="container py-6 space-y-6" role="status" aria-label="Loading page">
      {/* Page header */}
      {(title || subtitle) && (
        <div className="space-y-2">
          {title && <Skeleton className="h-8 w-48" />}
          {subtitle && <Skeleton className="h-4 w-72" />}
        </div>
      )}
      {/* Page content */}
      {children || <TableSkeleton rows={8} columns={5} />}
      <span className="sr-only">Loading page...</span>
    </div>
  );
}

// ============================================================================
// Stats/Dashboard Skeletons
// ============================================================================

export function StatCardSkeleton() {
  return (
    <div className="p-4 border rounded-lg" role="status" aria-label="Loading stat">
      <Skeleton className="h-4 w-20 mb-2" />
      <Skeleton className="h-8 w-16" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      {/* Main content */}
      <div className="grid grid-cols-2 gap-6">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
      <span className="sr-only">Loading dashboard...</span>
    </div>
  );
}
