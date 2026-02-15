import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <div className="inline-flex">{children}</div>
}

interface TooltipProps {
  children: React.ReactNode
  delayDuration?: number
}

const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <div className="group relative inline-flex">{children}</div>
}

interface TooltipTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLSpanElement, TooltipTriggerProps>(
  ({ children, asChild, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        ref,
        className: cn("cursor-help", child.props.className),
      });
    }

    return (
      <span ref={ref} className="group cursor-help" {...props}>
        {children}
      </span>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = "top", children, ...props }, ref) => {
    const positionClasses = {
      top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
      bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
      left: "right-full top-1/2 -translate-y-1/2 mr-2",
      right: "left-full top-1/2 -translate-y-1/2 ml-2",
    }

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-50 hidden group-hover:block",
          "rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
          "animate-in fade-in-0 zoom-in-95",
          positionClasses[side],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
