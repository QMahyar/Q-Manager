import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  IconActivity,
  IconPlayerPlay,
  IconAlertCircle,
  IconTarget,
  IconClock,
  IconUserPlus,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import type { Event } from "@tauri-apps/api/event";
import { toast } from "@/components/ui/sonner";

export interface ActivityItem {
  id: string;
  type: "status" | "phase" | "action" | "join" | "error" | "warn" | "info";
  logLevel?: "info" | "warn" | "error" | "debug";
  accountId?: number;
  accountName?: string;
  title: string;
  description?: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  maxItems?: number;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const typeIcons: Record<ActivityItem["type"], ReactNode> = {
  status: <IconPlayerPlay className="size-4" />,
  phase: <IconClock className="size-4" />,
  action: <IconTarget className="size-4" />,
  join: <IconUserPlus className="size-4" />,
  error: <IconAlertCircle className="size-4" />,
  warn: <IconAlertCircle className="size-4" />,
  info: <IconActivity className="size-4" />,
};

const typeColors: Record<ActivityItem["type"], string> = {
  status: "bg-info/10 text-info",
  phase: "bg-primary/10 text-primary",
  action: "bg-success/10 text-success",
  join: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
  warn: "bg-warning/10 text-warning",
  info: "bg-muted/10 text-muted-foreground",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Real-time activity feed showing events from the backend
 */
const DEFAULT_MAX_ITEMS = 500;

export function ActivityFeed({
  maxItems = DEFAULT_MAX_ITEMS,
  className = "",
  collapsible = false,
  defaultCollapsed = false,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [logLevelFilter, setLogLevelFilter] = useState<"all" | "error" | "warn" | "info">("warn");
  const scrollRef = useRef<HTMLDivElement>(null);

  const addActivity = (item: Omit<ActivityItem, "id" | "timestamp">) => {
    setActivities((prev) => {
      const newItem: ActivityItem = {
        ...item,
        id: generateId(),
        timestamp: new Date(),
      };
      const updated = [newItem, ...prev];
      return updated.slice(0, maxItems);
    });
  };

  // Subscribe to backend events
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let cancelled = false;

    const addListener = async <T,>(eventName: string, handler: (event: Event<T>) => void) => {
      const unlisten = await listen<T>(eventName, handler);
      if (cancelled) {
        unlisten();
        return;
      }
      unlisteners.push(unlisten);
    };

    const setupListeners = async () => {
      // Account status changes
      await addListener<{
        account_id: number;
        account_name: string;
        status: string;
        message?: string | null;
      }>("account-status", (event) => {
        const { account_id, account_name, status, message } = event.payload;
        if (status === "starting" || status === "stopping") {
          return;
        }
        const statusMap: Record<string, string> = {
          running: "Started",
          stopped: "Stopped",
          error: "Error",
          reconnecting: "Reconnecting",
        };
        addActivity({
          type: status === "error" ? "error" : "status",
          accountId: account_id,
          accountName: account_name,
          title: `${account_name || `Account ${account_id}`} ${statusMap[status] || status}`,
          description: message || undefined,
        });
      });

      // Phase detected
      await addListener<{
        account_id: number;
        account_name: string;
        phase_name: string;
      }>("phase-detected", (event) => {
        const { account_id, account_name, phase_name } = event.payload;
        addActivity({
          type: "phase",
          accountId: account_id,
          accountName: account_name,
          title: `Phase: ${phase_name}`,
          description: `Detected for ${account_name}`,
        });
      });

      // Action detected
      await addListener<{
        account_id: number;
        account_name: string;
        action_name: string;
        target?: string;
      }>("action-detected", (event) => {
        const { account_id, account_name, action_name, target } = event.payload;
        addActivity({
          type: "action",
          accountId: account_id,
          accountName: account_name,
          title: `Action: ${action_name}`,
          description: target ? `Target: ${target}` : `Executed for ${account_name}`,
        });
      });

      // Join attempt
      await addListener<{
        account_id: number;
        account_name: string;
        attempt: number;
        success: boolean;
        message?: string;
      }>("join-attempt", (event) => {
        const { account_id, account_name, attempt, success, message } = event.payload;
        addActivity({
          type: "join",
          accountId: account_id,
          accountName: account_name,
          title: `Join Attempt #${attempt}`,
          description: success ? "Joined successfully" : message || "Attempting to join...",
        });
      });

      // Log messages
      await addListener<{
        account_id: number;
        account_name: string;
        level: string;
        message: string;
      }>("account-log", (event) => {
        const { account_name, level, message } = event.payload;
        if (level === "debug") {
          return;
        }
        const logLevel = (level === "warn" ? "warn" : level === "error" ? "error" : "info") as
          | "info"
          | "warn"
          | "error";
        addActivity({
          type: logLevel === "error" ? "error" : logLevel === "warn" ? "warn" : "info",
          logLevel,
          accountName: account_name,
          title: `${logLevel.toUpperCase()}: ${account_name}`,
          description: message,
        });

        if (logLevel === "warn" && message) {
          const isLimit = message.includes("FLOOD_WAIT") || message.includes("SLOWMODE_WAIT");
          if (isLimit) {
            toast.warning("Telegram limit reached", {
              description: message,
            });
          }
        }
      });
    };

    setupListeners();

    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [maxItems]);

  const clearActivities = () => {
    setActivities([]);
  };

  const filteredActivities = activities.filter((activity) => {
    if (!activity.logLevel || logLevelFilter === "all") {
      return true;
    }
    return activity.logLevel === logLevelFilter;
  });

  if (collapsible && collapsed) {
    return (
      <Card className={className}>
        <CardHeader className="py-3 cursor-pointer" onClick={() => setCollapsed(false)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconActivity className="size-4" />
              Activity Feed
              {activities.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activities.length}
                </Badge>
              )}
            </CardTitle>
            <IconChevronDown className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className={`text-sm flex items-center gap-2 ${collapsible ? "cursor-pointer" : ""}`}
            onClick={collapsible ? () => setCollapsed(true) : undefined}
          >
            <IconActivity className="size-4" />
            Activity Feed
            {collapsible && <IconChevronUp className="size-4 text-muted-foreground ml-1" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Log level</span>
              <Select value={logLevelFilter} onValueChange={(value) => setLogLevelFilter(value as typeof logLevelFilter)}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                  <SelectItem value="warn">Warnings</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activities.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearActivities}
                title="Clear activity feed"
              >
                <IconTrash className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-64" ref={scrollRef}>
          {filteredActivities.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
              {activities.length === 0 ? "No activity yet" : "No activity matching filter"}
            </div>
          ) : (
            <div className="space-y-1 p-3 pt-0">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
                >
                  <div className={`p-1.5 rounded-md ${typeColors[activity.type]}`}>
                    {typeIcons[activity.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTime(activity.timestamp)}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * Compact activity indicator showing recent activity count
 */
export function ActivityIndicator({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="relative">
      <IconActivity className="size-5" />
      <Badge
        variant="destructive"
        className="absolute -top-2 -right-2 h-4 min-w-4 p-0 flex items-center justify-center text-[0.625rem]"
      >
        {count > 99 ? "99+" : count}
      </Badge>
    </div>
  );
}

export default ActivityFeed;
