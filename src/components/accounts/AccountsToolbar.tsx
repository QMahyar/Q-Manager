import { IconCheckbox, IconSquareOff, IconPlayerPlay, IconPlayerStop, IconSearch } from "@tabler/icons-react";
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
}: AccountsToolbarProps) {
  const stoppedCount = accounts.filter((a) => a.status === "stopped" || a.status === "error").length;
  const runningCount = accounts.filter((a) => a.status === "running").length;

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => table.toggleAllRowsSelected(true)}>
          <IconCheckbox className="size-4 mr-1" />
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={() => table.toggleAllRowsSelected(false)}>
          <IconSquareOff className="size-4 mr-1" />
          Clear
        </Button>
        <div className="h-4 w-px bg-border mx-2" />
        <Button
          variant="outline"
          size="sm"
          onClick={onStartAll}
          disabled={startAllPending || stoppedCount === 0}
        >
          <IconPlayerPlay className="size-4 mr-1" />
          Start All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onStopAll}
          disabled={stopAllPending || runningCount === 0}
        >
          <IconPlayerStop className="size-4 mr-1" />
          Stop All
        </Button>
        {selectedCount > 0 && (
          <>
            <div className="h-4 w-px bg-border mx-2" />
            <Button
              size="sm"
              onClick={onStartSelected}
              disabled={startSelectedPending}
            >
              <IconPlayerPlay className="size-4 mr-1" />
              Start Selected ({selectedCount})
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onStopSelected}
              disabled={stopSelectedPending}
            >
              <IconPlayerStop className="size-4 mr-1" />
              Stop Selected ({selectedCount})
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            aria-label="Search accounts"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8 w-64"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length === accounts.length
            ? `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`
            : `${table.getFilteredRowModel().rows.length} of ${accounts.length} accounts`}
        </div>
      </div>
    </div>
  );
}
