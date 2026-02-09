import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActionCreate } from "@/lib/types";
import { listActions, createAction, deleteAction } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { getErrorMessage } from "@/lib/error-utils";

export function useActionsData() {
  const queryClient = useQueryClient();

  const actionsQuery = useQuery({
    queryKey: ["actions"],
    queryFn: listActions,
  });

  const createMutation = useMutation({
    mutationFn: createAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      toast.success("Action created");
    },
    onError: (error) => {
      toast.error("Failed to create action", { description: getErrorMessage(error) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      toast.success("Action deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete action", { description: getErrorMessage(error) });
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
