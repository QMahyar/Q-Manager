import {
  IconCheckbox,
  IconSquareOff,
  IconPlayerPlay,
  IconPlayerStop,
  IconSearch,
  IconDownload,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Table } from "@tanstack/react-table";
import type { Account } from "@/lib/types";

interface AccountsToolbarProps {
  table: Table<Account>;
  accounts: Account[];
  selectedCount: number;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  startAllPending: boolean;
  stopAllPending: boolean;
  startSelectedPending: boolean;
  stopSelectedPending: boolean;
  onStartAll: () => void;
  onStopAll: () => void;
  onStartSelected: () => void;
  onStopSelected: () => void;
  onExportSelected: () => void;
}

export function AccountsToolbar({
  table,
  accounts,
  selectedCount,
  globalFilter,
  setGlobalFilter,
  startAllPending,
  stopAllPending,
  startSelectedPending,
  stopSelectedPending,
  onStartAll,
  onStopAll,
  onStartSelected,
  onStopSelected,
  onExportSelected,
}: AccountsToolbarProps) {
  const stoppedCount = accounts.filter((a) => a.status === "stopped" || a.status === "error").length;
  const runningCount = accounts.filter((a) => a.status === "running").length;

  return (
    <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: bulk actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Selection toggles */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-md"
            onClick={() => table.toggleAllRowsSelected(true)}
          >
            <IconCheckbox className="size-3.5 mr-1" />
            All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-md"
            onClick={() => table.toggleAllRowsSelected(false)}
          >
            <IconSquareOff className="size-3.5 mr-1" />
            None
          </Button>
        </div>

        <div className="h-5 w-px bg-border/60" />

        {/* Start / Stop All */}
        <Button
          variant="outline"
          size="sm"
          onClick={onStartAll}
          disabled={startAllPending || stoppedCount === 0}
          className="h-8 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/50 disabled:opacity-40 disabled:text-muted-foreground disabled:border-border disabled:bg-transparent"
        >
          <IconPlayerPlay className="size-3.5 mr-1.5" />
          Start All
          {stoppedCount > 0 && (
            <span className="ml-1 tabular-nums opacity-60 text-[11px]">({stoppedCount})</span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onStopAll}
          disabled={stopAllPending || runningCount === 0}
          className="h-8 text-destructive border-destructive/25 bg-destructive/5 hover:bg-destructive/15 hover:border-destructive/50 disabled:opacity-40 disabled:text-muted-foreground disabled:border-border disabled:bg-transparent"
        >
          <IconPlayerStop className="size-3.5 mr-1.5" />
          Stop All
          {runningCount > 0 && (
            <span className="ml-1 tabular-nums opacity-60 text-[11px]">({runningCount})</span>
          )}
        </Button>

        {/* Selection-specific actions */}
        {selectedCount > 0 && (
          <>
            <div className="h-5 w-px bg-border/60" />
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5">
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-none border-0 rounded-md"
                onClick={onStartSelected}
                disabled={startSelectedPending}
              >
                <IconPlayerPlay className="size-3.5 mr-1" />
                Start {selectedCount}
              </Button>
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-none border-0 rounded-md"
                onClick={onStopSelected}
                disabled={stopSelectedPending}
              >
                <IconPlayerStop className="size-3.5 mr-1" />
                Stop {selectedCount}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-md"
                onClick={onExportSelected}
              >
                <IconDownload className="size-3.5 mr-1" />
                Export
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Right: search + count */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60 pointer-events-none" />
          <Input
            placeholder="Search accounts…"
            aria-label="Search accounts"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 pr-7 h-8 w-48 text-xs bg-muted/30 border-border/60 focus:bg-background"
          />
          {globalFilter && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
              onClick={() => setGlobalFilter("")}
              aria-label="Clear search"
            >
              <IconX className="size-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground/60 tabular-nums whitespace-nowrap">
          {table.getFilteredRowModel().rows.length === accounts.length
            ? `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`
            : `${table.getFilteredRowModel().rows.length} / ${accounts.length}`}
        </span>
      </div>
    </div>
  );
}
