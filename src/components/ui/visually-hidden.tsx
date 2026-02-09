/**
 * Visually Hidden component for screen reader-only content.
 * 
 * Use this to provide additional context for screen readers without
 * affecting the visual layout.
 */

import * as React from "react";

export interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** If true, the content becomes visible when focused */
  focusable?: boolean;
}

export function VisuallyHidden({ 
  children, 
  focusable = false,
  ...props 
}: VisuallyHiddenProps) {
  const styles: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  };

  // If focusable, show content when focused
  if (focusable) {
    return (
      <span
        {...props}
        style={styles}
        tabIndex={0}
        onFocus={(e) => {
          e.currentTarget.style.position = 'static';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.overflow = 'visible';
          e.currentTarget.style.clip = 'auto';
          e.currentTarget.style.whiteSpace = 'normal';
          e.currentTarget.style.margin = '0';
        }}
        onBlur={(e) => {
          Object.assign(e.currentTarget.style, styles);
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span {...props} style={styles}>
      {children}
    </span>
  );
}

/**
 * Skip link component for keyboard users to bypass navigation
 */
export function SkipLink({ 
  href = "#main-content",
  children = "Skip to main content" 
}: { 
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring focus:rounded-md"
    >
      {children}
    </a>
  );
}
