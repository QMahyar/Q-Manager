import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  IconActivity,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconWaveSquare,
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

const typeDots: Record<ActivityItem["type"], string> = {
  status: "bg-sky-500",
  phase: "bg-violet-500",
  action: "bg-emerald-500",
  join: "bg-amber-500",
  error: "bg-destructive",
  warn: "bg-amber-500",
  info: "bg-muted-foreground/40",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

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

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let cancelled = false;

    const addListener = async <T,>(eventName: string, handler: (event: Event<T>) => void) => {
      const unlisten = await listen<T>(eventName, handler);
      if (cancelled) { unlisten(); return; }
      unlisteners.push(unlisten);
    };

    const setupListeners = async () => {
      await addListener<{
        account_id: number; account_name: string; status: string; message?: string | null;
      }>("account-status", (event) => {
        const { account_id, account_name, status, message } = event.payload;
        if (status === "starting" || status === "stopping") return;
        const statusMap: Record<string, string> = {
          running: "Started", stopped: "Stopped", error: "Error", reconnecting: "Reconnecting",
        };
        addActivity({
          type: status === "error" ? "error" : "status",
          accountId: account_id, accountName: account_name,
          title: `${account_name || `Account ${account_id}`} ${statusMap[status] || status}`,
          description: message || undefined,
        });
      });

      await addListener<{
        account_id: number; account_name: string; phase_name: string;
      }>("phase-detected", (event) => {
        const { account_id, account_name, phase_name } = event.payload;
        addActivity({
          type: "phase", accountId: account_id, accountName: account_name,
          title: `Phase: ${phase_name}`, description: `Detected for ${account_name}`,
        });
      });

      await addListener<{
        account_id: number; account_name: string; action_name: string; target?: string;
      }>("action-detected", (event) => {
        const { account_id, account_name, action_name, target } = event.payload;
        addActivity({
          type: "action", accountId: account_id, accountName: account_name,
          title: `Action: ${action_name}`,
          description: target ? `Target: ${target}` : `Executed for ${account_name}`,
        });
      });

      await addListener<{
        account_id: number; account_name: string; attempt: number; success: boolean; message?: string;
      }>("join-attempt", (event) => {
        const { account_id, account_name, attempt, success, message } = event.payload;
        addActivity({
          type: "join", accountId: account_id, accountName: account_name,
          title: `Join Attempt #${attempt}`,
          description: success ? "Joined successfully" : message || "Attempting to join...",
        });
      });

      await addListener<{
        account_id: number; account_name: string; level: string; message: string;
      }>("account-log", (event) => {
        const { account_name, level, message } = event.payload;
        if (level === "debug") return;
        const logLevel = (level === "warn" ? "warn" : level === "error" ? "error" : "info") as "info" | "warn" | "error";
        addActivity({
          type: logLevel === "error" ? "error" : logLevel === "warn" ? "warn" : "info",
          logLevel, accountName: account_name,
          title: `${logLevel.toUpperCase()}: ${account_name}`,
          description: message,
        });

        if (logLevel === "warn" && message) {
          const isLimit = message.includes("FLOOD_WAIT") || message.includes("SLOWMODE_WAIT");
          if (isLimit) {
            toast.warning("Telegram limit reached", { description: message });
          }
        }
      });
    };

    setupListeners().catch((err) => {
      console.error("[ActivityFeed] Failed to set up event listeners:", err);
    });
    return () => { cancelled = true; unlisteners.forEach((u) => u()); };
  }, [maxItems]);

  const clearActivities = () => setActivities([]);

  const filteredActivities = activities.filter((activity) => {
    if (logLevelFilter === "all") return true;
    // For log events, filter by level; for non-log events (status/phase/action/join) always show
    if (!activity.logLevel) return true;
    if (logLevelFilter === "error") return activity.logLevel === "error";
    if (logLevelFilter === "warn") return activity.logLevel === "warn" || activity.logLevel === "error";
    if (logLevelFilter === "info") return true; // info shows everything
    return true;
  });

  const errorCount = activities.filter((a) => a.type === "error").length;

  // ── Collapsed bar ────────────────────────────────────────────────────────
  if (collapsible && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={`w-full flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 hover:bg-muted/30 hover:border-border transition-all duration-150 group ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <IconWaveSquare className="size-4 text-amber-500/80" />
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Activity Feed
          </span>
          {activities.length > 0 && (
            <span className="text-xs text-muted-foreground/50 tabular-nums">
              {activities.length} event{activities.length !== 1 ? "s" : ""}
            </span>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-full">
              {errorCount} err
            </Badge>
          )}
        </div>
        <IconChevronDown className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </button>
    );
  }

  // ── Expanded ─────────────────────────────────────────────────────────────
  return (
    <Card className={`border-border/60 overflow-hidden ${className}`}>
      <CardHeader className="py-2.5 px-4 border-b border-border/50 bg-muted/10">
        <div className="flex items-center justify-between">
          <CardTitle
            className={`text-sm flex items-center gap-2 ${collapsible ? "cursor-pointer" : ""}`}
            onClick={collapsible ? () => setCollapsed(true) : undefined}
          >
            <IconWaveSquare className="size-4 text-amber-500/80" />
            <span className="font-medium text-muted-foreground">Activity Feed</span>
            {activities.length > 0 && (
              <span className="text-xs text-muted-foreground/40 tabular-nums font-normal">
                {activities.length}
              </span>
            )}
            {collapsible && (
              <IconChevronUp className="size-4 text-muted-foreground/40 ml-0.5" />
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Select value={logLevelFilter} onValueChange={(v) => setLogLevelFilter(v as typeof logLevelFilter)}>
              <SelectTrigger size="sm" className="h-6 w-24 text-[11px] border-border/50 bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="error">Errors</SelectItem>
                <SelectItem value="warn">Warnings</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            {activities.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={clearActivities}
                title="Clear activity feed"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
              >
                <IconTrash className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-52" ref={scrollRef}>
          {filteredActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground/40">
              <IconWaveSquare className="size-7 opacity-40" />
              <p className="text-xs text-center">
                {activities.length === 0
                  ? "No activity yet — start an account to see events"
                  : "No events match the current filter"}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="divide-y divide-border/30">
                {filteredActivities.map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="flex items-start gap-2.5 px-4 py-2 hover:bg-muted/20 transition-colors"
                  >
                    {/* Type dot */}
                    <span className={`mt-1.5 size-1.5 rounded-full shrink-0 ${typeDots[activity.type]}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-medium text-foreground/90 truncate leading-snug">
                          {activity.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground/40 whitespace-nowrap font-mono shrink-0">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-[11px] text-muted-foreground/60 truncate leading-snug mt-px">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

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
