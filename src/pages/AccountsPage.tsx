import { useState, useMemo, useCallback } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { useNavigate } from "react-router-dom";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnSizingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import {
  IconUserPlus,
  IconUpload,
  IconDownload,
  IconPlayerPlay,
  IconPlayerStop,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AnimatedBadge } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { AccountsToolbar, AccountsTable } from "@/components/accounts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginWizard } from "@/components/login-wizard";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  importAccountPreflight,
  importAccountResolve,
  exportAccount,
  checkAccountStart,
  type ExportFormat,
  type ImportConflict,
  type ImportCandidate,
  type ImportResolution,
  type ImportAction,
} from "@/lib/api";
import { useAccountsData } from "@/hooks/useAccountsData";
import type { Account, AccountStatus, StartupCheckResult, BulkStartReport } from "@/lib/types";
import { ActivityFeed } from "@/components/ActivityFeed";
import { getErrorMessage } from "@/lib/error-utils";

export default function AccountsPage() {
  const navigate = useNavigate();
  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: "account_name", desc: false }]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  
  const [loginWizardOpen, setLoginWizardOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  
  // Import/Export state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPath, setImportPath] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [importConflictIndex, setImportConflictIndex] = useState(0);
  const [importConflictDialogOpen, setImportConflictDialogOpen] = useState(false);
  const [importResolutionName, setImportResolutionName] = useState("");
  const [importApplyToAll, setImportApplyToAll] = useState(false);
  const [importDefaultAction, setImportDefaultAction] = useState<ImportAction>("rename");
  const [importResolutions, setImportResolutions] = useState<ImportResolution[]>([]);
  
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [accountToExport, setAccountToExport] = useState<Account | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("zip");
  const [exporting, setExporting] = useState(false);
  
  // Batch operation confirmation dialogs
  const [startAllDialogOpen, setStartAllDialogOpen] = useState(false);
  const [stopAllDialogOpen, setStopAllDialogOpen] = useState(false);
  
  // Validation error dialog state
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<StartupCheckResult | null>(null);
  const [validationAccountName, setValidationAccountName] = useState("");
  const [bulkStartReports, setBulkStartReports] = useState<BulkStartReport[]>([]);
  const [bulkStartDialogOpen, setBulkStartDialogOpen] = useState(false);

  const {
    accountsQuery,
    deleteMutation,
    startMutation,
    stopMutation,
    startAllMutation,
    stopAllMutation,
    startSelectedMutation,
    stopSelectedMutation,
  } = useAccountsData();

  const accounts = accountsQuery.data ?? [];
  const isLoading = accountsQuery.isLoading;

  // Status badge helper - now uses AnimatedBadge with pulse effects
  const getStatusBadge = useCallback((status: AccountStatus) => {
    return <AnimatedBadge status={status} />;
  }, []);

  // Column definitions for TanStack Table
  const columns = useMemo<ColumnDef<Account>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 40,
      enableSorting: false,
      enableResizing: false,
    },
    {
      accessorKey: "account_name",
      header: "Name",
      size: 150,
      minSize: 100,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("account_name")}</span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      size: 130,
      minSize: 100,
      cell: ({ row }) => row.getValue("phone") || "-",
    },
    {
      accessorKey: "user_id",
      header: "User ID",
      size: 120,
      minSize: 80,
      cell: ({ row }) => row.getValue("user_id") || "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 100,
      minSize: 80,
      cell: ({ row }) => getStatusBadge(row.getValue("status")),
    },
    {
      accessorKey: "last_seen_at",
      header: "Last Seen",
      size: 180,
      minSize: 120,
      cell: ({ row }) => {
        const value = row.getValue("last_seen_at") as string | null;
        return value ? new Date(value).toLocaleString() : "-";
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      size: 160,
      minSize: 140,
      enableSorting: false,
      enableResizing: false,
      cell: ({ row }) => {
        const account = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            {account.status === "stopped" || account.status === "error" ? (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Start"
                aria-label="Start account"
                onClick={() => handleStartAccount(account)}
                disabled={startMutation.isPending}
              >
                <IconPlayerPlay className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Stop"
                aria-label="Stop account"
                onClick={() => stopMutation.mutate(account.id)}
                disabled={stopMutation.isPending}
              >
                <IconPlayerStop className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(`/accounts/${account.id}/edit`)}
              title="Edit"
              aria-label="Edit account"
            >
              <IconPencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openExportDialog(account)}
              title="Export"
              aria-label="Export account"
            >
              <IconDownload className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setAccountToDelete(account);
                setDeleteDialogOpen(true);
              }}
              title="Delete"
              aria-label="Delete account"
            >
              <IconTrash className="size-4" />
            </Button>
          </div>
        );
      },
    },
  ], [getStatusBadge, navigate, startMutation, stopMutation]);

  // TanStack Table instance
  const table = useReactTable({
    data: accounts,
    columns,
    state: {
      sorting,
      columnSizing,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => String(row.id),
  });

  // Get selected account IDs
  const selectedAccountIds = useMemo(() => {
    return Object.keys(rowSelection).map(Number);
  }, [rowSelection]);

  const selectedCount = selectedAccountIds.length;

  // Handle login wizard success
  const handleLoginSuccess = () => {
    accountsQuery.refetch();
  };

  // Handle start with validation check
  const handleStartAccount = async (account: Account) => {
    try {
      const result = await checkAccountStart(account.id);
      
      if (!result.can_proceed) {
        // Show validation error dialog
        setValidationResult(result);
        setValidationAccountName(account.account_name);
        setValidationDialogOpen(true);
        return;
      }
      
      // Show warnings as toasts but proceed
      if (result.errors.length > 0) {
        result.errors.forEach((error) => {
          toast.warning(error.message, {
            description: error.details || undefined,
          });
        });
      }
      
      // Start the account
      startMutation.mutate(account.id);
    } catch (error) {
      toast.error("Failed to validate account", {
        description: getErrorMessage(error),
      });
    }
  };

  // Delete account handler
  const handleDelete = () => {
    if (accountToDelete) {
      deleteMutation.mutate(accountToDelete.id, {
        onSuccess: () => {
          toast.success("Account deleted", {
            description: `${accountToDelete.account_name} has been removed.`,
          });
        },
        onSettled: () => {
          setDeleteDialogOpen(false);
          setAccountToDelete(null);
        },
      });
    }
  };

  // Import handlers
  const handleBrowseImport = async (directory: boolean) => {
    const result = await openDialog({
      title: "Select session file or folder",
      directory,
      multiple: false,
      filters: directory
        ? undefined
        : [
            { name: "Session Bundle", extensions: ["zip"] },
            { name: "All Files", extensions: ["*"] },
          ],
    });
    if (result) {
      setImportPath(result as string);
      // Auto-fill name from path
      const pathParts = (result as string).split(/[/\\]/);
      const folderName = pathParts[pathParts.length - 1] || "";
      if (!importName) {
        setImportName(folderName.replace(/_session$/, ""));
      }
      resetImportState();
    }
  };

  const buildDefaultRename = (name: string, index: number) => {
    if (index <= 1) return `${name} (2)`;
    return `${name} (${index + 1})`;
  };

  const resetImportState = () => {
    setImportConflicts([]);
    setImportConflictIndex(0);
    setImportConflictDialogOpen(false);
    setImportResolutionName("");
    setImportApplyToAll(false);
    setImportDefaultAction("rename");
    setImportResolutions([]);
  };

  const resolveImport = async (resolutions: ImportResolution[]) => {
    const results = await importAccountResolve(resolutions);
    const successCount = results.filter((item) => item.success).length;
    const failed = results.filter((item) => !item.success);

    if (successCount > 0) {
      toast.success("Import completed", {
        description: `${successCount} account${successCount === 1 ? "" : "s"} imported successfully.`,
      });
      accountsQuery.refetch();
    }

    if (failed.length > 0) {
      toast.error("Some imports failed", {
        description: failed.map((item) => item.message).join("; "),
      });
    }
  };

  const startImportWithResolutions = async (resolutions: ImportResolution[]) => {
    setImporting(true);
    try {
      await resolveImport(resolutions);
      setImportDialogOpen(false);
      setImportPath("");
      setImportName("");
      resetImportState();
    } catch (error) {
      toast.error("Import failed", {
        description: getErrorMessage(error),
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!importPath || !importName) return;

    setImporting(true);
    try {
      const trimmedName = importName.trim();
      const candidates: ImportCandidate[] = [
        {
          source_path: importPath,
          account_name: trimmedName,
        },
      ];
      const preflight = await importAccountPreflight(candidates);

      if (preflight.conflicts.length === 0) {
        await startImportWithResolutions([
          {
            source_path: importPath,
            account_name: trimmedName,
            action: "rename",
          },
        ]);
        return;
      }

      setImportConflicts(preflight.conflicts);
      setImportConflictIndex(0);
      setImportConflictDialogOpen(true);
      setImportResolutionName(buildDefaultRename(trimmedName, 1));
      setImportResolutions([]);
      setImportApplyToAll(false);
    } catch (error) {
      toast.error("Import failed", {
        description: getErrorMessage(error),
      });
    } finally {
      setImporting(false);
    }
  };

  const handleResolveConflict = async (action: ImportAction) => {
    const conflict = importConflicts[importConflictIndex];
    if (!conflict) return;

    const resolution: ImportResolution = {
      source_path: conflict.source_path,
      account_name: conflict.account_name,
      action,
      existing_account_id: conflict.existing_account_id,
      new_name: action === "rename" ? importResolutionName.trim() : undefined,
    };

    const nextResolutions = [...importResolutions, resolution];
    const nextIndex = importConflictIndex + 1;

    if (importApplyToAll) {
      const remaining = importConflicts.slice(nextIndex).map((item, idx) => {
        const useAction = importDefaultAction;
        const defaultName = buildDefaultRename(item.account_name, nextIndex + idx + 1);
        return {
          source_path: item.source_path,
          account_name: item.account_name,
          action: useAction,
          existing_account_id: item.existing_account_id,
          new_name: useAction === "rename" ? defaultName : undefined,
        };
      });
      setImportConflictDialogOpen(false);
      await startImportWithResolutions([...nextResolutions, ...remaining]);
      return;
    }

    if (nextIndex >= importConflicts.length) {
      setImportConflictDialogOpen(false);
      await startImportWithResolutions(nextResolutions);
      return;
    }

    setImportResolutions(nextResolutions);
    setImportConflictIndex(nextIndex);
    setImportResolutionName(buildDefaultRename(importConflicts[nextIndex].account_name, nextIndex + 1));
  };

  const handleCancelConflictFlow = () => {
    setImportConflictDialogOpen(false);
    resetImportState();
  };

  // Export handlers
  const handleExport = async () => {
    if (!accountToExport) return;
    
    const result = await saveDialog({
      title: "Export session",
      defaultPath: `${accountToExport.account_name}_session${exportFormat === "zip" ? ".zip" : ""}`,
      filters: exportFormat === "zip" ? [{ name: "ZIP Archive", extensions: ["zip"] }] : [],
    });
    
    if (!result) return;
    
    setExporting(true);
    try {
      const exportResult = await exportAccount(accountToExport.id, result, exportFormat);
      if (exportResult.success) {
        toast.success("Account exported", {
          description: exportResult.message,
        });
        setExportDialogOpen(false);
        setAccountToExport(null);
      } else {
        toast.error("Export failed", {
          description: exportResult.message,
        });
      }
    } catch (error) {
      toast.error("Export failed", {
        description: getErrorMessage(error),
      });
    } finally {
      setExporting(false);
    }
  };

  const openExportDialog = (account: Account) => {
    setAccountToExport(account);
    setExportDialogOpen(true);
  };

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader title="Accounts" description="Manage Telegram accounts and sessions">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setLoginWizardOpen(true)}>
            <IconUserPlus className="size-4 mr-1" />
            Create
          </Button>

          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <IconUpload className="size-4 mr-1" />
            Import
          </Button>
        </div>
      </PageHeader>

      {/* Login Wizard Modal */}
      <LoginWizard
        open={loginWizardOpen}
        onOpenChange={setLoginWizardOpen}
        onSuccess={handleLoginSuccess}
      />

      <main className="flex-1 p-6 w-full max-w-6xl mx-auto">
        <AccountsToolbar
          table={table}
          accounts={accounts}
          selectedCount={selectedCount}
          globalFilter={globalFilter}
          setGlobalFilter={setGlobalFilter}
          startAllPending={startAllMutation.isPending}
          stopAllPending={stopAllMutation.isPending}
          startSelectedPending={startSelectedMutation.isPending}
          stopSelectedPending={stopSelectedMutation.isPending}
          onStartAll={() => setStartAllDialogOpen(true)}
          onStopAll={() => setStopAllDialogOpen(true)}
          onStartSelected={() => startSelectedMutation.mutate(selectedAccountIds, {
            onSuccess: (reports) => {
              const failed = reports.filter((report) => !report.started);
              if (failed.length > 0) {
                setBulkStartReports(reports);
                setBulkStartDialogOpen(true);
              }
            },
          })}
          onStopSelected={() => stopSelectedMutation.mutate(selectedAccountIds)}
        />

        <AccountsTable
          table={table}
          columns={columns}
          accounts={accounts}
          isLoading={isLoading}
          onCreate={() => setLoginWizardOpen(true)}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{accountToDelete?.account_name}"? This will remove the
                database record and session files. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            resetImportState();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Session</DialogTitle>
              <DialogDescription>
                Import an existing Telethon session from a folder or ZIP file.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="import-path">Session Path</Label>
                <div className="flex gap-2">
                  <Input
                    id="import-path"
                    value={importPath}
                    onChange={(e) => setImportPath(e.target.value)}
                    placeholder="Select session folder or file..."
                    readOnly
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleBrowseImport(true)}>
                      Browse Folder
                    </Button>
                    <Button variant="outline" onClick={() => handleBrowseImport(false)}>
                      Browse ZIP
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="import-name">Account Name</Label>
                <Input
                  id="import-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Enter a name for this account"
                />
                <p className="text-xs text-muted-foreground">
                  If the name already exists, you'll be asked to replace, rename, or cancel.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setImportDialogOpen(false);
                resetImportState();
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!importPath || !importName || importing}
              >
                {importing ? "Importing..." : "Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Duplicate Conflict Dialog */}
        <Dialog open={importConflictDialogOpen} onOpenChange={setImportConflictDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Duplicate account name</DialogTitle>
              <DialogDescription>
                The account name already exists. Choose how to handle this session.
              </DialogDescription>
            </DialogHeader>
            {importConflicts.length > 0 && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Incoming</p>
                    <Badge variant="secondary">{importConflicts[importConflictIndex]?.account_name}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-all">
                    {importConflicts[importConflictIndex]?.source_path}
                  </p>
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Existing</p>
                    <Badge variant="outline">
                      {importConflicts[importConflictIndex]?.existing_account_name}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>User ID: {importConflicts[importConflictIndex]?.existing_user_id ?? "-"}</div>
                    <div>Phone: {importConflicts[importConflictIndex]?.existing_phone ?? "-"}</div>
                    <div className="col-span-2">
                      Last seen: {importConflicts[importConflictIndex]?.existing_last_seen_at
                        ? new Date(importConflicts[importConflictIndex].existing_last_seen_at).toLocaleString()
                        : "-"}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-rename">Rename to</Label>
                  <Input
                    id="import-rename"
                    value={importResolutionName}
                    onChange={(e) => setImportResolutionName(e.target.value)}
                    placeholder="New account name"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Apply to all duplicates</p>
                    <p className="text-xs text-muted-foreground">
                      Use the same choice for remaining conflicts.
                    </p>
                  </div>
                  <Checkbox
                    checked={importApplyToAll}
                    onCheckedChange={(value) => setImportApplyToAll(Boolean(value))}
                  />
                </div>
                {importApplyToAll && (
                  <div className="space-y-2">
                    <Label htmlFor="import-default-action">Default action</Label>
                    <Select
                      value={importDefaultAction}
                      onValueChange={(value) => setImportDefaultAction(value as ImportAction)}
                    >
                      <SelectTrigger id="import-default-action">
                        <SelectValue placeholder="Choose default action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rename">Rename</SelectItem>
                        <SelectItem value="replace">Replace</SelectItem>
                        <SelectItem value="skip">Skip</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Conflict {importConflictIndex + 1} of {importConflicts.length}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelConflictFlow}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => handleResolveConflict("skip")}>Skip</Button>
              <Button variant="secondary" onClick={() => handleResolveConflict("replace")}>
                Replace
              </Button>
              <Button
                onClick={() => handleResolveConflict("rename")}
                disabled={!importResolutionName.trim()}
              >
                Rename
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Session</DialogTitle>
              <DialogDescription>
                Export "{accountToExport?.account_name}" session for backup or transfer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="export-format">Export Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zip">ZIP Archive (recommended)</SelectItem>
                    <SelectItem value="folder">Raw Folder</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  ZIP is recommended for sharing or backup. Raw folder copies all session files directly.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting..." : "Export"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Start All Confirmation Dialog */}
        <Dialog open={startAllDialogOpen} onOpenChange={setStartAllDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start All Accounts</DialogTitle>
              <DialogDescription>
                Are you sure you want to start all stopped accounts?
                This will start {accounts.filter(a => a.status === "stopped" || a.status === "error").length} account(s).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStartAllDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  startAllMutation.mutate(undefined, {
                    onSuccess: (reports) => {
                      const failed = reports.filter((report) => !report.started);
                      if (failed.length > 0) {
                        setBulkStartReports(reports);
                        setBulkStartDialogOpen(true);
                      }
                    },
                  });
                  setStartAllDialogOpen(false);
                }}
                disabled={startAllMutation.isPending}
              >
                <IconPlayerPlay className="size-4 mr-1" />
                Start All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stop All Confirmation Dialog */}
        <Dialog open={stopAllDialogOpen} onOpenChange={setStopAllDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stop All Accounts</DialogTitle>
              <DialogDescription>
                Are you sure you want to stop all running accounts?
                This will stop {accounts.filter(a => a.status === "running").length} account(s).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStopAllDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  stopAllMutation.mutate();
                  setStopAllDialogOpen(false);
                }}
                disabled={stopAllMutation.isPending}
              >
                <IconPlayerStop className="size-4 mr-1" />
                Stop All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Validation Error Dialog */}
        <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-destructive">Cannot Start Account</DialogTitle>
              <DialogDescription>
                "{validationAccountName}" cannot be started due to the following issues:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-80 overflow-y-auto">
              {validationResult?.errors.map((error, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg border ${
                    error.is_blocking 
                      ? "bg-destructive/10 border-destructive/30" 
                      : "bg-warning/10 border-warning/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Badge variant={error.is_blocking ? "destructive" : "outline"} className="shrink-0">
                      {error.is_blocking ? "Error" : "Warning"}
                    </Badge>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{error.message}</p>
                      {error.details && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {error.details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setValidationDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => navigate("/settings")}>
                Go to Settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activity Feed */}
        <div className="mt-6">
          <ActivityFeed collapsible defaultCollapsed={true} />
        </div>

        {/* Bulk Start Report Dialog */}
        <Dialog open={bulkStartDialogOpen} onOpenChange={setBulkStartDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Some accounts could not start</DialogTitle>
              <DialogDescription>
                Review the preflight issues below and resolve them before retrying.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 max-h-80 overflow-y-auto">
              {bulkStartReports
                .filter((report) => !report.started)
                .map((report) => (
                  <div key={report.account_id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{report.account_name}</p>
                      <Badge variant="destructive">Failed</Badge>
                    </div>
                    <div className="space-y-2">
                      {report.errors.map((error, index) => (
                        <div
                          key={index}
                          className={`rounded-md border px-3 py-2 text-xs ${
                            error.is_blocking
                              ? "bg-destructive/10 border-destructive/30"
                              : "bg-warning/10 border-warning/30"
                          }`}
                        >
                          <p className="font-semibold text-sm">{error.message}</p>
                          {error.details && (
                            <p className="text-muted-foreground whitespace-pre-wrap">{error.details}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkStartDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => navigate("/settings")}>Go to Settings</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </PageTransition>
  );
}
