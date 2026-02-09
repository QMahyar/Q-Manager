import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BanWarningPattern, SettingsUpdate } from "@/lib/types";
import { getSettings, updateSettings, listActions, getDelayDefault, setDelayDefault } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";

export function useSettingsData() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });

  const actionsQuery = useQuery({
    queryKey: ["actions"],
    queryFn: listActions,
  });

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved", {
        description: "Your settings have been updated.",
      });
    },
    onError: (error) => {
      toast.error("Failed to save settings", { description: getErrorMessage(error) });
    },
  });

  return { settingsQuery, actionsQuery, saveMutation };
}

export function useDelayDefaults(actions: { id: number }[]) {
  const [actionDelays, setActionDelays] = useState<Record<number, { min: number; max: number }>>({});

  useEffect(() => {
    const loadDelayDefaults = async () => {
      const delays: Record<number, { min: number; max: number }> = {};
      for (const action of actions) {
        try {
          const delayDefault = await getDelayDefault(action.id);
          delays[action.id] = {
            min: delayDefault?.min_seconds ?? 2,
            max: delayDefault?.max_seconds ?? 8,
          };
        } catch {
          delays[action.id] = { min: 2, max: 8 };
        }
      }
      setActionDelays(delays);
    };
    if (actions.length > 0) {
      loadDelayDefaults();
    }
  }, [actions]);

  return { actionDelays, setActionDelays };
}

export function useDelayDefaultMutation() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ actionId, min, max }: { actionId: number; min: number; max: number }) =>
      setDelayDefault(actionId, min, max),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delay-defaults"] });
    },
    onError: (error) => {
      toast.error("Failed to update delay defaults", { description: getErrorMessage(error) });
    },
  });
  return mutation;
}

export function parseBanPatterns(json: string): BanWarningPattern[] {
  try {
    return JSON.parse(json) as BanWarningPattern[];
  } catch {
    return [];
  }
}

export function buildSettingsPayload(payload: SettingsUpdate) {
  return payload;
}
