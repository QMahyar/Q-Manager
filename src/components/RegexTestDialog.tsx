import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { IconFlask, IconCheck, IconX, IconAlertTriangle } from "@tabler/icons-react";

interface RegexTestDialogProps {
  pattern: string;
  isRegex: boolean;
  onPatternChange?: (pattern: string) => void;
  onIsRegexChange?: (isRegex: boolean) => void;
  trigger?: React.ReactNode;
}

interface MatchResult {
  match: string;
  index: number;
  groups?: string[];
}

/**
 * Dialog for testing regex/substring patterns against sample text
 */
export function RegexTestDialog({
  pattern,
  isRegex,
  onPatternChange,
  onIsRegexChange,
  trigger,
}: RegexTestDialogProps) {
  const [open, setOpen] = useState(false);
  const [testText, setTestText] = useState("");
  const [localPattern, setLocalPattern] = useState(pattern);
  const [localIsRegex, setLocalIsRegex] = useState(isRegex);

  // Update local state when props change
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalPattern(pattern);
      setLocalIsRegex(isRegex);
    }
    setOpen(isOpen);
  };

  // Test the pattern against the text
  const testResult = useMemo(() => {
    if (!localPattern || !testText) {
      return { valid: true, matches: [], error: null };
    }

    try {
      if (localIsRegex) {
        const regex = new RegExp(localPattern, "gi");
        const matches: MatchResult[] = [];
        let match;
        while ((match = regex.exec(testText)) !== null) {
          matches.push({
            match: match[0],
            index: match.index,
            groups: match.slice(1).length > 0 ? match.slice(1) : undefined,
          });
          // Prevent infinite loop for zero-length matches
          if (match[0].length === 0) regex.lastIndex++;
        }
        return { valid: true, matches, error: null };
      } else {
        // Substring match
        const matches: MatchResult[] = [];
        let index = 0;
        const lowerText = testText.toLowerCase();
        const lowerPattern = localPattern.toLowerCase();
        while ((index = lowerText.indexOf(lowerPattern, index)) !== -1) {
          matches.push({
            match: testText.slice(index, index + localPattern.length),
            index,
          });
          index += localPattern.length;
        }
        return { valid: true, matches, error: null };
      }
    } catch (e) {
      return {
        valid: false,
        matches: [],
        error: e instanceof Error ? e.message : "Invalid pattern",
      };
    }
  }, [localPattern, localIsRegex, testText]);

  // Highlight matches in text
  const highlightedText = useMemo(() => {
    if (!testText || testResult.matches.length === 0) {
      return testText;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort matches by index
    const sortedMatches = [...testResult.matches].sort((a, b) => a.index - b.index);

    sortedMatches.forEach((match, i) => {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${i}`}>{testText.slice(lastIndex, match.index)}</span>
        );
      }
      parts.push(
        <mark key={`match-${i}`} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {match.match}
        </mark>
      );
      lastIndex = match.index + match.match.length;
    });

    if (lastIndex < testText.length) {
      parts.push(<span key="text-end">{testText.slice(lastIndex)}</span>);
    }

    return parts;
  }, [testText, testResult.matches]);

  const handleApply = () => {
    onPatternChange?.(localPattern);
    onIsRegexChange?.(localIsRegex);
    setOpen(false);
  };

  const triggerElement = trigger ? (
    trigger
  ) : (
    <Button variant="outline" size="icon-sm" title="Test pattern">
      <IconFlask className="size-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger>{triggerElement}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Pattern</DialogTitle>
          <DialogDescription>
            Test your pattern against sample text to see if it matches correctly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Pattern Input */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pattern">Pattern</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="isRegex" className="text-sm text-muted-foreground">
                  Regex
                </Label>
                <Switch
                  id="isRegex"
                  checked={localIsRegex}
                  onCheckedChange={setLocalIsRegex}
                />
              </div>
            </div>
            <Input
              id="pattern"
              value={localPattern}
              onChange={(e) => setLocalPattern(e.target.value)}
              placeholder={localIsRegex ? "Enter regex pattern..." : "Enter substring..."}
              className={`font-mono ${!testResult.valid ? "border-destructive" : ""}`}
            />
            {!testResult.valid && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <IconAlertTriangle className="size-4" />
                {testResult.error}
              </p>
            )}
          </div>

          {/* Test Text Input */}
          <div className="grid gap-2">
            <Label htmlFor="testText">Sample Text</Label>
            <Textarea
              id="testText"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Paste or type sample text to test against..."
              rows={4}
            />
          </div>

          {/* Results */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Result</Label>
              {testText && (
                <Badge
                  variant={testResult.matches.length > 0 ? "default" : "secondary"}
                  className="gap-1"
                >
                  {testResult.matches.length > 0 ? (
                    <>
                      <IconCheck className="h-3 w-3" />
                      {testResult.matches.length} match{testResult.matches.length !== 1 ? "es" : ""}
                    </>
                  ) : (
                    <>
                      <IconX className="h-3 w-3" />
                      No matches
                    </>
                  )}
                </Badge>
              )}
            </div>

            {testText && (
              <div className="p-3 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap break-all max-h-40 overflow-auto">
                {highlightedText}
              </div>
            )}

            {/* Show capture groups if any */}
            {testResult.matches.some((m) => m.groups && m.groups.length > 0) && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Capture Groups</Label>
                {testResult.matches.map((match, i) =>
                  match.groups ? (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground">Match {i + 1}:</span>
                      {match.groups.map((g, j) => (
                        <Badge key={j} variant="outline" className="font-mono">
                          ${j + 1}: {g}
                        </Badge>
                      ))}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {(onPatternChange || onIsRegexChange) && (
            <Button onClick={handleApply} disabled={!testResult.valid}>
              Apply Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Simpler inline regex test - just shows valid/invalid status
 */
export function RegexValidationBadge({ pattern, isRegex }: { pattern: string; isRegex: boolean }) {
  const isValid = useMemo(() => {
    if (!pattern) return true;
    if (!isRegex) return true;
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }, [pattern, isRegex]);

  if (!pattern || !isRegex) return null;

  return (
    <Badge variant={isValid ? "outline" : "destructive"} className="gap-1 text-xs">
      {isValid ? (
        <>
          <IconCheck className="h-3 w-3" />
          Valid
        </>
      ) : (
        <>
          <IconX className="h-3 w-3" />
          Invalid
        </>
      )}
    </Badge>
  );
}

export default RegexTestDialog;
