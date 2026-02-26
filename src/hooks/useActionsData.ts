import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActionCreate } from "@/lib/types";
import { listActions, createAction, deleteAction } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-utils";

export function useActionsData() {
  const queryClient = useQueryClient();

  const actionsQuery = useQuery({
    queryKey: queryKeys.actions(),
    queryFn: listActions,
  });

  const createMutation = useMutation({
    mutationFn: createAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions() });
      toast.success("Action created");
    },
    onError: (error) => {
      toastError("Failed to create action", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.actions() });
      toast.success("Action deleted");
    },
    onError: (error) => {
      toastError("Failed to delete action", error);
    },
  });

  const create = (payload: ActionCreate) => createMutation.mutateAsync(payload);
  const remove = (actionId: number) => deleteMutation.mutateAsync(actionId);

  return {
    actionsQuery,
    create,
    remove,
    createMutation,
    deleteMutation,
  };
}
