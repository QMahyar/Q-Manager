import { toast } from "@/components/ui/sonner";
import { getBackendError, getErrorMessage } from "@/lib/error-utils";

export function toastError(title: string, error: unknown) {
  const backendError = getBackendError(error);
  const description = backendError
    ? `${backendError.code ? `[${backendError.code}] ` : ""}${backendError.message ?? "Unknown error"}${
        backendError.details ? `\n${backendError.details}` : ""
      }`
    : getErrorMessage(error);

  toast.error(title, { description });
}
