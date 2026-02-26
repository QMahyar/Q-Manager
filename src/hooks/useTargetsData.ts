import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Account, Action, TargetBlacklist, TargetPair, TargetRule } from "@/lib/types";
import {
  listAccounts,
  listActions,
  getTargetOverride,
  getDelayOverride,
  setTargetOverride,
  deleteTargetOverride,
  setDelayOverride,
  deleteDelayOverride,
  listBlacklist,
  addBlacklistEntry,
  removeBlacklistEntry,
  listTargetPairs,
  addTargetPair,
  removeTargetPair,
  copyTargets,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/toast-utils";

export function useTargetsData() {
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(),
    queryFn: listAccounts,
  });

  const actionsQuery = useQuery({
    queryKey: queryKeys.actions(),
    queryFn: listActions,
  });

  return { accountsQuery, actionsQuery };
}

export function useTargetOverrides(accountId: number | null, actionId: number | null, accounts: Account[], actions: Action[]) {
  const accountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const actionIds = useMemo(() => actions.map((action) => action.id), [actions]);

  const actionOverridesQuery = useQuery({
    queryKey: queryKeys.actionOverrides(actionId ?? 0, accountIds.join("-")),
    queryFn: async () => {
      if (!actionId) return {};
      const entries = await Promise.all(
        accounts.map(async (account) => {
          const [targetOvr, delayOvr] = await Promise.all([
            getTargetOverride(account.id, actionId),
            getDelayOverride(account.id, actionId),
          ]);
          return [
            account.id,
            {
              hasTargetOverride: !!targetOvr,
              hasDelayOverride: !!delayOvr,
              delayMin: delayOvr?.min_seconds,
              delayMax: delayOvr?.max_seconds,
            },
          ] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: !!actionId && accounts.length > 0,
  });

  const accountOverridesQuery = useQuery({
    queryKey: queryKeys.accountOverrides(accountId ?? 0, actionIds.join("-")),
    queryFn: async () => {
      if (!accountId) return {};
      const entries = await Promise.all(
        actions.map(async (action) => {
          const [targetOvr, delayOvr] = await Promise.all([
            getTargetOverride(accountId, action.id),
            getDelayOverride(accountId, action.id),
          ]);
          return [
            action.id,
            {
              hasTargetOverride: !!targetOvr,
              hasDelayOverride: !!delayOvr,
            },
          ] as const;
        })
      );
      return Object.fromEntries(entries);
    },
    enabled: !!accountId && actions.length > 0,
  });

  return {
    actionOverrides: actionOverridesQuery.data ?? {},
    accountOverrides: accountOverridesQuery.data ?? {},
    actionOverridesQuery,
    accountOverridesQuery,
  };
}

export function useTargetConfig(accountId: number, action: Action) {
  const queryClient = useQueryClient();

  const saveOverrides = useMutation({
    mutationFn: async (payload: { rule: TargetRule | null; delay: { min: number; max: number } | null }) => {
      if (payload.rule) {
        await setTargetOverride(accountId, action.id, JSON.stringify(payload.rule));
      } else {
        await deleteTargetOverride(accountId, action.id);
      }
      if (payload.delay) {
        await setDelayOverride(accountId, action.id, payload.delay.min, payload.delay.max);
      } else {
        await deleteDelayOverride(accountId, action.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.targetOverride(accountId, action.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.delayOverride(accountId, action.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.actionOverridesRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountOverridesRoot() });
    },
    onError: (error) => {
      toastError("Failed to save", error);
    },
  });

  const blacklistMutation = useMutation({
    mutationFn: async (payload: { entry?: string; removeId?: number }) => {
      if (payload.entry) {
        return addBlacklistEntry(accountId, action.id, payload.entry);
      }
      if (payload.removeId !== undefined) {
        await removeBlacklistEntry(payload.removeId);
        return null;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blacklist(accountId, action.id) });
    },
    onError: (error) => {
      toastError("Failed to update blacklist", error);
    },
  });

  const pairsMutation = useMutation({
    mutationFn: async (payload: { pair?: { a: string; b: string }; removeId?: number }) => {
      if (payload.pair) {
        return addTargetPair(accountId, action.id, payload.pair.a, payload.pair.b);
      }
      if (payload.removeId !== undefined) {
        await removeTargetPair(payload.removeId);
        return null;
      }
      return null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pairs(accountId, action.id) });
    },
    onError: (error) => {
      toastError("Failed to update target pairs", error);
    },
  });

  return { saveOverrides, blacklistMutation, pairsMutation };
}

export function useTargetLists(accountId: number, action: Action) {
  const overridesQuery = useQuery({
    queryKey: queryKeys.targetOverride(accountId, action.id),
    queryFn: () => getTargetOverride(accountId, action.id),
  });

  const delayQuery = useQuery({
    queryKey: queryKeys.delayOverride(accountId, action.id),
    queryFn: () => getDelayOverride(accountId, action.id),
  });

  const blacklistQuery = useQuery({
    queryKey: queryKeys.blacklist(accountId, action.id),
    queryFn: () => listBlacklist(accountId, action.id),
  });

  const pairsQuery = useQuery({
    queryKey: queryKeys.pairs(accountId, action.id),
    queryFn: () => listTargetPairs(accountId, action.id),
    enabled: action.is_two_step,
  });

  return {
    overridesQuery,
    delayQuery,
    blacklistQuery,
    pairsQuery,
  };
}

export function useCopyTargets() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ fromId, toIds, actionIds }: { fromId: number; toIds: number[]; actionIds: number[] }) =>
      copyTargets(fromId, toIds, actionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.targetOverrideRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.delayOverrideRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blacklistRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pairsRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.accountOverridesRoot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.actionOverridesRoot() });
    },
    onError: (error) => {
      toastError("Failed to paste targets", error);
    },
  });

  return mutation;
}

// Note: useTargetDefaults was previously returning a trivially memoized
// plain object with no data-fetching value. Callers should use the
// accountId/actionId values directly instead.
export function useTargetDefaults(accountId: number, actionId: number) {
  return useMemo(() => ({ accountId, actionId }), [accountId, actionId]);
}

export type TargetConfigState = {
  useOverride: boolean;
  targets: string;
  randomFallback: boolean;
  useDelayOverride: boolean;
  minDelay: number;
  maxDelay: number;
  blacklistEntries: TargetBlacklist[];
  pairs: TargetPair[];
};
