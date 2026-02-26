import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAccounts,
  createAccount,
  deleteAccount,
  startAccount,
  stopAccount,
  startAllAccounts,
  stopAllAccounts,
  startSelectedAccounts,
  stopSelectedAccounts,
} from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/toast-utils";

export function useAccountsData() {
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: listAccounts,
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Account created");
    },
    onError: (error) => {
      toastError("Failed to create account", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Account deleted");
    },
    onError: (error) => {
      toastError("Failed to delete account", error);
    },
  });

  const startMutation = useMutation({
    mutationFn: startAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Account started");
    },
    onError: (error) => {
      toastError("Failed to start account", error);
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Account stopped");
    },
    onError: (error) => {
      toastError("Failed to stop account", error);
    },
  });

  const startAllMutation = useMutation({
    mutationFn: startAllAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Started all accounts");
    },
    onError: (error) => {
      toastError("Failed to start all accounts", error);
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: stopAllAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Stopped all accounts");
    },
    onError: (error) => {
      toastError("Failed to stop all accounts", error);
    },
  });

  const startSelectedMutation = useMutation({
    mutationFn: startSelectedAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Started selected accounts");
    },
    onError: (error) => {
      toastError("Failed to start selected accounts", error);
    },
  });

  const stopSelectedMutation = useMutation({
    mutationFn: stopSelectedAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts() });
      toast.success("Stopped selected accounts");
    },
    onError: (error) => {
      toastError("Failed to stop selected accounts", error);
    },
  });

  const selectedSummary = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const running = accounts.filter((account) => account.status === "running");
    const stopped = accounts.filter((account) => account.status === "stopped");
    return { running, stopped };
  }, [accountsQuery.data]);

  return {
    accountsQuery,
    createMutation,
    deleteMutation,
    startMutation,
    stopMutation,
    startAllMutation,
    stopAllMutation,
    startSelectedMutation,
    stopSelectedMutation,
    selectedSummary,
  };
}

