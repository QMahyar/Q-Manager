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
import { getErrorMessage } from "@/lib/error-utils";

export function useAccountsData() {
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: listAccounts,
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account created");
    },
    onError: (error) => {
      toast.error("Failed to create account", { description: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete account", { description: getErrorMessage(error) });
    },
  });

  const startMutation = useMutation({
    mutationFn: startAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account started");
    },
    onError: (error) => {
      toast.error("Failed to start account", { description: getErrorMessage(error) });
    },
  });

  const stopMutation = useMutation({
    mutationFn: stopAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Account stopped");
    },
    onError: (error) => {
      toast.error("Failed to stop account", { description: getErrorMessage(error) });
    },
  });

  const startAllMutation = useMutation({
    mutationFn: startAllAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Started all accounts");
    },
    onError: (error) => {
      toast.error("Failed to start all accounts", { description: getErrorMessage(error) });
    },
  });

  const stopAllMutation = useMutation({
    mutationFn: stopAllAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Stopped all accounts");
    },
    onError: (error) => {
      toast.error("Failed to stop all accounts", { description: getErrorMessage(error) });
    },
  });

  const startSelectedMutation = useMutation({
    mutationFn: startSelectedAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Started selected accounts");
    },
    onError: (error) => {
      toast.error("Failed to start selected accounts", { description: getErrorMessage(error) });
    },
  });

  const stopSelectedMutation = useMutation({
    mutationFn: stopSelectedAccounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Stopped selected accounts");
    },
    onError: (error) => {
      toast.error("Failed to stop selected accounts", { description: getErrorMessage(error) });
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

