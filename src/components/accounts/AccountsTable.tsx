import { IconUsers, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import type { ColumnDef, Table as TableInstance } from "@tanstack/react-table";
import type { Account } from "@/lib/types";

interface AccountsTableProps {
  table: TableInstance<Account>;
  columns: ColumnDef<Account>[];
  accounts: Account[];
  isLoading: boolean;
  onCreate: () => void;
}

export function AccountsTable({ table, columns, accounts, isLoading, onCreate }: AccountsTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} columns={7} />;
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers className="h-8 w-8 text-muted-foreground" />}
        title="No accounts yet"
        description="Add your first Telegram account to start automating Werewolf games."
        action={{ label: "Create Account", onClick: onCreate }}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card/70 shadow-sm overflow-hidden">
      <Table
        className="min-w-full"
        style={{ width: Math.max(table.getCenterTotalSize(), 880) }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="bg-muted/30 hover:bg-muted/30"
            >
              {headerGroup.headers.map((header, headerIndex) => {
                const canSort = header.column.getCanSort();
                const canResize = header.column.getCanResize();
                const sortDir = header.column.getIsSorted();
                const isSelectColumn = header.column.id === "select";
                const isLastColumn = headerIndex === headerGroup.headers.length - 1;

                return (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={cn(
                      "relative h-10 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70",
                      canSort && "cursor-pointer select-none hover:text-foreground",
                      isSelectColumn && "w-10 pl-4 pr-0",
                      isLastColumn ? "pr-4" : ""
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        isSelectColumn && "justify-center"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : typeof header.column.columnDef.header === "function"
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header ?? null}
                      {sortDir === "asc" && <IconArrowUp className="h-3 w-3 text-foreground/60" />}
                      {sortDir === "desc" && <IconArrowDown className="h-3 w-3 text-foreground/60" />}
                    </div>
                    {canResize && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        aria-label="Resize column"
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/30 ${
                          header.column.getIsResizing() ? "bg-primary/50" : ""
                        }`}
                        style={{ userSelect: "none" }}
                      />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-20 text-center text-sm text-muted-foreground">
                No results found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row, i) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  "transition-colors",
                  row.getIsSelected()
                    ? "bg-primary/10 hover:bg-primary/10"
                    : i % 2 !== 0
                    ? "bg-muted/10 hover:bg-muted/25"
                    : "hover:bg-muted/20"
                )}
              >
                {row.getVisibleCells().map((cell, cellIndex) => {
                  const isSelectCell = cell.column.id === "select";
                  const isLastCell = cellIndex === row.getVisibleCells().length - 1;

                  return (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        ...(i === table.getRowModel().rows.length - 1
                          ? { borderBottom: "none" }
                          : {}),
                      }}
                      className={cn(
                        "py-2.5",
                        isSelectCell && "w-10 pl-4 pr-0",
                        isLastCell && "pr-4"
                      )}
                    >
                      <div className={cn(isSelectCell && "flex justify-center")}>
                        {typeof cell.column.columnDef.cell === "function"
                          ? cell.column.columnDef.cell(cell.getContext())
                          : cell.column.columnDef.cell ?? null}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
