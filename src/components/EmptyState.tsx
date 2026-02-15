import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  IconUsers,
  IconBolt,
  IconTarget,
  IconSettings,
  IconClipboardList,
  IconPlus,
  IconInbox,
} from "@tabler/icons-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * Generic empty state component for when there's no data to display
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="rounded-full bg-muted p-4 mb-4">
        {icon || <IconInbox className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-md mb-4 text-pretty">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          <IconPlus className="size-4 mr-2" />
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */
export function NoAccounts({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<IconUsers className="h-8 w-8 text-muted-foreground" />}
      title="No accounts yet"
      description="Add your first Telegram account to start automating Werewolf games."
      action={onAdd ? { label: "Add Account", onClick: onAdd } : undefined}
    />
  );
}

export function NoActions({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<IconBolt className="h-8 w-8 text-muted-foreground" />}
      title="No actions configured"
      description="Create actions to define how the bot responds to game prompts."
      action={onAdd ? { label: "Create Action", onClick: onAdd } : undefined}
    />
  );
}

export function NoPatterns({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<IconClipboardList className="h-8 w-8 text-muted-foreground" />}
      title="No patterns configured"
      description="Add patterns to detect game phases and trigger automated responses."
      action={onAdd ? { label: "Add Pattern", onClick: onAdd } : undefined}
    />
  );
}

export function NoTargets() {
  return (
    <EmptyState
      icon={<IconTarget className="h-8 w-8 text-muted-foreground" />}
      title="No targets configured"
      description="Select an account and action to configure targeting rules."
    />
  );
}

export function NoResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon={<IconInbox className="h-8 w-8 text-muted-foreground" />}
      title="No results found"
      description={
        query
          ? `No items match "${query}". Try a different search term.`
          : "No items match your current filters."
      }
    />
  );
}

export function NoSelection({ itemType = "item" }: { itemType?: string }) {
  return (
    <EmptyState
      icon={<IconSettings className="h-8 w-8 text-muted-foreground" />}
      title={`Select ${itemType}`}
      description={`Choose ${itemType === "an" ? "an" : "a"} ${itemType} from the list to view or edit its settings.`}
    />
  );
}

export default EmptyState;
