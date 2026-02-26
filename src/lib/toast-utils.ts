import { toast } from "@/components/ui/sonner";
import { normalizeError } from "@/lib/error-utils";

export function toastError(title: string, error: unknown) {
  if (!error) {
    toast.error(title);
    return;
  }

  const normalized = normalizeError(error);
  const description = `${normalized.code ? `[${normalized.code}] ` : ""}${normalized.message}${
    normalized.details ? `\n${normalized.details}` : ""
  }`;

  toast.error(title, { description: description || "An unexpected error occurred" });
}
