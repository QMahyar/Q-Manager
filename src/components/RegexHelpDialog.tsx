import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconInfoCircle } from "@tabler/icons-react";

interface RegexHelpDialogProps {
  trigger?: React.ReactNode;
  title?: string;
}

export function RegexHelpDialog({ trigger, title = "Regex Help" }: RegexHelpDialogProps) {
  return (
    <Dialog>
      {trigger ? (
        <DialogTrigger>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger>
          <Button variant="ghost" size="sm" className="gap-1" aria-label="Regex help">
            <IconInfoCircle className="size-4" />
            Regex Help
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Use regex when you need flexible matching. For exact text, keep Regex OFF.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4 text-sm">
            <section className="space-y-2">
              <h4 className="font-semibold">Quick rules</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><Badge variant="outline">.*</Badge> matches any text (wildcard).</li>
                <li><Badge variant="outline">^</Badge> start of text, <Badge variant="outline">$</Badge> end of text.</li>
                <li><Badge variant="outline">.</Badge> matches any single character.</li>
                <li><Badge variant="outline">*</Badge> repeats the previous token (0+ times).</li>
                <li><Badge variant="outline">+</Badge> repeats the previous token (1+ times).</li>
                <li><Badge variant="outline">?</Badge> makes the previous token optional (0 or 1).</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="font-semibold">Examples</h4>
              <div className="space-y-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Wildcard match</div>
                  <div className="font-mono">یک بازی با حالت آشوب توسط .* ساخته شده</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Exact word (case-insensitive)</div>
                  <div className="font-mono">\bریهون\b</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Start of message</div>
                  <div className="font-mono">^شروع بازی</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">End of message</div>
                  <div className="font-mono">پایان$</div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="font-semibold">Escaping special characters</h4>
              <p>
                Characters like <Badge variant="outline">.</Badge>, <Badge variant="outline">*</Badge>,
                <Badge variant="outline">?</Badge>, <Badge variant="outline">+</Badge>, <Badge variant="outline">( )</Badge>
                have special meaning. Use a backslash to match them literally.
              </p>
              <div className="rounded-md border p-3 font-mono">
                \* matches a literal asterisk
              </div>
            </section>

            <section className="space-y-2">
              <h4 className="font-semibold">Tips</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>If Regex is OFF, the pattern is a simple substring match.</li>
                <li>Use the Test button to check your pattern before saving.</li>
                <li>If your regex is invalid, the app will warn you and skip matching.</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default RegexHelpDialog;
