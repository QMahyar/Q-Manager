import { IconUsers, IconArrowUp, IconArrowDown } from "@tabler/icons-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { EmptyState } from "@/components/EmptyState";
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
    <div className="border rounded-lg overflow-hidden">
      <Table style={{ width: table.getCenterTotalSize() }}>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const canResize = header.column.getCanResize();
                const sortDir = header.column.getIsSorted();

                return (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={`relative ${canSort ? "cursor-pointer select-none hover:bg-muted/50" : ""}`}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : typeof header.column.columnDef.header === "function"
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header ?? null}
                      {sortDir === "asc" && <IconArrowUp className="h-3 w-3" />}
                      {sortDir === "desc" && <IconArrowDown className="h-3 w-3" />}
                    </div>
                    {canResize && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        aria-label="Resize column"
                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none bg-transparent hover:bg-primary/50 ${
                          header.column.getIsResizing() ? "bg-primary" : ""
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
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="hover:shadow-sm"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {typeof cell.column.columnDef.cell === "function"
                      ? cell.column.columnDef.cell(cell.getContext())
                      : cell.column.columnDef.cell ?? null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
