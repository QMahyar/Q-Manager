import { useState, useEffect } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { motion } from "motion/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Motion-enhanced Card
const MotionCard = motion.create(Card);
import { toast } from "@/components/ui/sonner";
import { useSettingsData, useDelayDefaults, useDelayDefaultMutation, parseBanPatterns } from "@/hooks/useSettingsData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SettingsUpdate, BanWarningPattern, ThemeMode, ThemePalette, ThemeVariant } from "@/lib/types";
import { useTheme } from "@/components/theme-provider";
import { HelpTooltip, helpContent } from "@/components/HelpTooltip";
import { RegexHelpDialog } from "@/components/RegexHelpDialog";
import {
  validateApiId,
  validateApiHash,
  validateBotUserId,
  validateJoinRules,
  validateDelay,
  validatePattern,
  isValidRegex,
} from "@/lib/validation";

export default function SettingsPage() {
  const [hasChanges, setHasChanges] = useState(false);
  const { theme, palette, variant, setTheme, setPalette, setVariant } = useTheme();
  
  // AutoAnimate for lists (refs to be used in JSX)
  const [banPatternsParent] = useAutoAnimate();
  const [actionDelaysParent] = useAutoAnimate();
  // Note: These refs are used below in the ban patterns and action delays lists

  // Form state
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [mainBotUserId, setMainBotUserId] = useState("");
  const [mainBotUsername, setMainBotUsername] = useState("");
  const [betaBotUserId, setBetaBotUserId] = useState("");
  const [betaBotUsername, setBetaBotUsername] = useState("");
  const [joinMaxAttempts, setJoinMaxAttempts] = useState(5);
  const [joinCooldown, setJoinCooldown] = useState(5);
  const [banWarningPatterns, setBanWarningPatterns] = useState<BanWarningPattern[]>([]);
  const [newBanPattern, setNewBanPattern] = useState("");
  const [newBanPatternIsRegex, setNewBanPatternIsRegex] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(theme);
  const [themePalette, setThemePalette] = useState<ThemePalette>(palette);
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>(variant);
  
  // Action delay defaults state
  const [delayChanges, setDelayChanges] = useState<Set<number>>(new Set());
  
  // Validation errors
  const [errors, setErrors] = useState<{
    apiId?: string;
    apiHash?: string;
    mainBotUserId?: string;
    betaBotUserId?: string;
    joinRules?: string;
    newBanPattern?: string;
  }>({});
  const [delayErrors, setDelayErrors] = useState<Record<number, string>>({});

  const { settingsQuery, actionsQuery, saveMutation } = useSettingsData();
  const settings = settingsQuery.data;
  const isLoading = settingsQuery.isLoading;
  const actions = actionsQuery.data ?? [];

  const { actionDelays, setActionDelays } = useDelayDefaults(actions);
  const delayDefaultMutation = useDelayDefaultMutation();

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setApiId(settings.api_id?.toString() || "");
      setApiHash(settings.api_hash || "");
      setMainBotUserId(settings.main_bot_user_id?.toString() || "");
      setMainBotUsername(settings.main_bot_username || "");
      setBetaBotUserId(settings.beta_bot_user_id?.toString() || "");
      setBetaBotUsername(settings.beta_bot_username || "");
      setJoinMaxAttempts(settings.join_max_attempts_default);
      setJoinCooldown(settings.join_cooldown_seconds_default);
      setBanWarningPatterns(parseBanPatterns(settings.ban_warning_patterns_json));
      setThemeMode(settings.theme_mode ?? theme);
      setThemePalette(settings.theme_palette ?? palette);
      setThemeVariant(settings.theme_variant ?? variant);
    }
  }, [settings, theme, palette, variant]);

  // Validation handlers
  const validateApiIdField = (value: string) => {
    if (!value) {
      setErrors(prev => ({ ...prev, apiId: undefined }));
      return true;
    }
    const result = validateApiId(value);
    setErrors(prev => ({ ...prev, apiId: result.error }));
    return result.valid;
  };

  const validateApiHashField = (value: string) => {
    if (!value) {
      setErrors(prev => ({ ...prev, apiHash: undefined }));
      return true;
    }
    const result = validateApiHash(value);
    setErrors(prev => ({ ...prev, apiHash: result.error }));
    return result.valid;
  };

  const validateBotIdField = (value: string, field: 'mainBotUserId' | 'betaBotUserId') => {
    if (!value) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
      return true;
    }
    const result = validateBotUserId(value);
    setErrors(prev => ({ ...prev, [field]: result.error }));
    return result.valid;
  };

  const validateJoinRulesFields = () => {
    const result = validateJoinRules(joinMaxAttempts, joinCooldown);
    setErrors(prev => ({ ...prev, joinRules: result.error }));
    return result.valid;
  };

  const joinCooldownWarning = joinCooldown <= 0
    ? "Cooldown is set to 0 seconds. This may cause rapid join attempts."
    : joinCooldown < 2
      ? "Cooldown is very low. Consider 2+ seconds to avoid rapid retries."
      : "";

  const validateNewBanPatternField = (pattern: string, isRegex: boolean) => {
    if (!pattern.trim()) {
      setErrors(prev => ({ ...prev, newBanPattern: undefined }));
      return true;
    }
    if (isRegex) {
      const result = validatePattern(pattern, true);
      setErrors(prev => ({ ...prev, newBanPattern: result.error }));
      return result.valid;
    }
    setErrors(prev => ({ ...prev, newBanPattern: undefined }));
    return true;
  };

  const handleSave = () => {
    // Validate all fields before save
    let isValid = true;
    if (apiId) isValid = validateApiIdField(apiId) && isValid;
    if (apiHash) isValid = validateApiHashField(apiHash) && isValid;
    if (mainBotUserId) isValid = validateBotIdField(mainBotUserId, 'mainBotUserId') && isValid;
    if (betaBotUserId) isValid = validateBotIdField(betaBotUserId, 'betaBotUserId') && isValid;
    isValid = validateJoinRulesFields() && isValid;

    if (!isValid) {
      toast.error("Please fix validation errors before saving");
      return;
    }

    const payload: SettingsUpdate = {
      api_id: apiId ? parseInt(apiId) : null,
      api_hash: apiHash || null,
      main_bot_user_id: mainBotUserId ? parseInt(mainBotUserId) : null,
      main_bot_username: mainBotUsername || null,
      beta_bot_user_id: betaBotUserId ? parseInt(betaBotUserId) : null,
      beta_bot_username: betaBotUsername || null,
      join_max_attempts_default: joinMaxAttempts,
      join_cooldown_seconds_default: joinCooldown,
      ban_warning_patterns_json: JSON.stringify(banWarningPatterns),
      theme_mode: themeMode,
      theme_palette: themePalette,
      theme_variant: themeVariant,
    };
    saveMutation.mutate(payload, {
      onSuccess: () => {
        setHasChanges(false);
      },
    });
  };

  const markChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  const addBanPattern = () => {
    if (!newBanPattern.trim()) return;
    
    // Validate regex if needed
    if (newBanPatternIsRegex && !isValidRegex(newBanPattern)) {
      setErrors(prev => ({ ...prev, newBanPattern: "Invalid regex pattern" }));
      return;
    }
    
    setBanWarningPatterns([
      ...banWarningPatterns,
      {
        pattern: newBanPattern.trim(),
        is_regex: newBanPatternIsRegex,
        enabled: true,
        priority: 0,
      },
    ]);
    setNewBanPattern("");
    setNewBanPatternIsRegex(false);
    setErrors(prev => ({ ...prev, newBanPattern: undefined }));
    markChanged();
  };

  const removeBanPattern = (index: number) => {
    setBanWarningPatterns(banWarningPatterns.filter((_, i) => i !== index));
    markChanged();
  };

  const toggleBanPatternEnabled = (index: number) => {
    const updated = [...banWarningPatterns];
    updated[index].enabled = !updated[index].enabled;
    setBanWarningPatterns(updated);
    markChanged();
  };

  // Update action delay locally with validation
  const updateActionDelay = (actionId: number, field: "min" | "max", value: number) => {
    const currentDelay = actionDelays[actionId] || { min: 2, max: 8 };
    const newDelay = { ...currentDelay, [field]: value };
    
    setActionDelays((prev) => ({
      ...prev,
      [actionId]: newDelay,
    }));
    setDelayChanges((prev) => new Set(prev).add(actionId));
    
    // Validate the delay
    const result = validateDelay(newDelay.min, newDelay.max);
    setDelayErrors((prev) => ({
      ...prev,
      [actionId]: result.error || "",
    }));
  };

  // Save action delay to backend
  const saveActionDelay = async (actionId: number) => {
    const delay = actionDelays[actionId];
    if (delay) {
      // Validate before saving
      const result = validateDelay(delay.min, delay.max);
      if (!result.valid) {
        setDelayErrors((prev) => ({ ...prev, [actionId]: result.error || "" }));
        toast.error("Invalid delay range", {
          description: result.error,
        });
        return;
      }
      await delayDefaultMutation.mutateAsync({ actionId, min: delay.min, max: delay.max });
      setDelayChanges((prev) => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
      setDelayErrors((prev) => ({ ...prev, [actionId]: "" }));
      toast.success("Delay saved");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <PageHeader title="Settings" description="Global configuration and defaults" />
        <main className="flex-1 p-6 w-full max-w-3xl mx-auto">
          <div className="text-muted-foreground text-center py-12">Loading settings...</div>
        </main>
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader title="Settings" description="Global configuration and defaults">
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
          <IconDeviceFloppy className="size-4 mr-1" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </PageHeader>

      <main className="flex-1 p-6 space-y-6 w-full max-w-3xl mx-auto">
        {/* Theme */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>
              Choose your preferred color palette and light/dark mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Mode</Label>
                <Select
                  value={themeMode}
                  onValueChange={(value) => {
                    const next = value as ThemeMode;
                    setThemeMode(next);
                    setTheme(next);
                    markChanged();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Palette</Label>
                <Select
                  value={themePalette}
                  onValueChange={(value) => {
                    const next = value as ThemePalette;
                    setThemePalette(next);
                    setPalette(next);
                    markChanged();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zinc">Zinc</SelectItem>
                    <SelectItem value="slate">Slate</SelectItem>
                    <SelectItem value="gray">Gray</SelectItem>
                    <SelectItem value="stone">Stone</SelectItem>
                    <SelectItem value="sky">Sky</SelectItem>
                    <SelectItem value="indigo">Indigo</SelectItem>
                    <SelectItem value="emerald">Emerald</SelectItem>
                    <SelectItem value="rose">Rose</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Intensity</Label>
                <Select
                  value={themeVariant}
                  onValueChange={(value) => {
                    const next = value as ThemeVariant;
                    setThemeVariant(next);
                    setVariant(next);
                    markChanged();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subtle">Subtle</SelectItem>
                    <SelectItem value="vibrant">Vibrant</SelectItem>
                    <SelectItem value="contrast">High contrast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <span className="size-2 rounded-full bg-primary" />
                Primary
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <span className="size-2 rounded-full bg-success" />
                Success
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <span className="size-2 rounded-full bg-warning" />
                Warning
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                <span className="size-2 rounded-full bg-destructive" />
                Destructive
              </span>
            </div>
          </CardContent>
        </MotionCard>

        {/* Telegram API Credentials */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Telegram API Credentials</CardTitle>
              <HelpTooltip content={helpContent.apiCredentials} />
            </div>
            <CardDescription>
              Get your API ID and Hash from{" "}
              <a
                href="https://my.telegram.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                my.telegram.org
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="apiId">API ID</Label>
                <Input
                  id="apiId"
                  type="number"
                  value={apiId}
                  onChange={(e) => {
                    setApiId(e.target.value);
                    validateApiIdField(e.target.value);
                    markChanged();
                  }}
                  placeholder="12345678"
                  className={errors.apiId ? "border-destructive" : ""}
                />
                {errors.apiId && (
                  <p className="text-xs text-destructive">{errors.apiId}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="apiHash">API Hash</Label>
                <Input
                  id="apiHash"
                  type="password"
                  value={apiHash}
                  onChange={(e) => {
                    setApiHash(e.target.value);
                    validateApiHashField(e.target.value);
                    markChanged();
                  }}
                  placeholder="abcdef1234567890..."
                  className={errors.apiHash ? "border-destructive" : ""}
                />
                {errors.apiHash && (
                  <p className="text-xs text-destructive">{errors.apiHash}</p>
                )}
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Moderator Bots */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
        >
          <CardHeader>
            <CardTitle>Moderator Bots</CardTitle>
            <CardDescription>
              Configure the Werewolf game moderator bots to monitor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Main Bot</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mainBotUserId">User ID</Label>
                  <Input
                    id="mainBotUserId"
                    type="number"
                    value={mainBotUserId}
                    onChange={(e) => {
                      setMainBotUserId(e.target.value);
                      validateBotIdField(e.target.value, 'mainBotUserId');
                      markChanged();
                    }}
                    placeholder="123456789"
                    className={errors.mainBotUserId ? "border-destructive" : ""}
                  />
                  {errors.mainBotUserId && (
                    <p className="text-xs text-destructive">{errors.mainBotUserId}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mainBotUsername">Username (optional)</Label>
                  <Input
                    id="mainBotUsername"
                    value={mainBotUsername}
                    onChange={(e) => {
                      setMainBotUsername(e.target.value);
                      markChanged();
                    }}
                    placeholder="@werewolfbot"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">Beta Bot (optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="betaBotUserId">User ID</Label>
                  <Input
                    id="betaBotUserId"
                    type="number"
                    value={betaBotUserId}
                    onChange={(e) => {
                      setBetaBotUserId(e.target.value);
                      validateBotIdField(e.target.value, 'betaBotUserId');
                      markChanged();
                    }}
                    placeholder="987654321"
                    className={errors.betaBotUserId ? "border-destructive" : ""}
                  />
                  {errors.betaBotUserId && (
                    <p className="text-xs text-destructive">{errors.betaBotUserId}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="betaBotUsername">Username (optional)</Label>
                  <Input
                    id="betaBotUsername"
                    value={betaBotUsername}
                    onChange={(e) => {
                      setBetaBotUsername(e.target.value);
                      markChanged();
                    }}
                    placeholder="@werewolfbeta"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </MotionCard>

        {/* Join Rules */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.24 }}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Join Rules (Default)</CardTitle>
              <HelpTooltip content={helpContent.joinRules} />
            </div>
            <CardDescription>
              Default settings for automatic game joining. Can be overridden per account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="joinMaxAttempts">Max Join Attempts</Label>
                <Input
                  id="joinMaxAttempts"
                  type="number"
                  min={1}
                  max={100}
                  value={joinMaxAttempts}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 5;
                    setJoinMaxAttempts(value);
                    validateJoinRules(value, joinCooldown);
                    setErrors(prev => ({ ...prev, joinRules: validateJoinRules(value, joinCooldown).error }));
                    markChanged();
                  }}
                  className={errors.joinRules ? "border-destructive" : ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="joinCooldown">Cooldown (seconds)</Label>
                <Input
                  id="joinCooldown"
                  type="number"
                  min={0}
                  max={300}
                  value={joinCooldown}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 5;
                    setJoinCooldown(value);
                    setErrors(prev => ({ ...prev, joinRules: validateJoinRules(joinMaxAttempts, value).error }));
                    markChanged();
                  }}
                  className={errors.joinRules ? "border-destructive" : ""}
                />
              </div>
            </div>
            {errors.joinRules && (
              <p className="text-xs text-destructive">{errors.joinRules}</p>
            )}
            {!errors.joinRules && joinCooldownWarning && (
              <p className="text-xs text-warning">{joinCooldownWarning}</p>
            )}
          </CardContent>
        </MotionCard>

        {/* Default Action Delays */}
        {actions.length > 0 && (
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.32 }}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Default Action Delays</CardTitle>
                <HelpTooltip content={helpContent.delays} />
              </div>
              <CardDescription>
                Set the default delay range (in seconds) before clicking for each action.
                Can be overridden per account in Targets page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(actionDelays).length === 0 && actions.length > 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Loading delay settings...
                </div>
              ) : (
                <div className="space-y-3" ref={actionDelaysParent}>
                  {actions.map((action) => {
                    const delay = actionDelays[action.id] || { min: 2, max: 8 };
                    const hasUnsavedChanges = delayChanges.has(action.id);
                    const delayError = delayErrors[action.id];
                    return (
                      <div key={action.id} className="space-y-1">
                        <div
                          className={`flex items-center justify-between p-3 border rounded-lg ${delayError ? "border-destructive" : ""}`}
                        >
                          <div className="flex-1">
                            <span className="font-medium">{action.name}</span>
                            <span className="text-muted-foreground text-sm ml-2">
                              ({action.button_type})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground">Min</Label>
                              <Input
                                type="number"
                                min={0}
                                max={300}
                                className={`w-16 h-8 ${delayError ? "border-destructive" : ""}`}
                                value={delay.min}
                                onChange={(e) =>
                                  updateActionDelay(action.id, "min", Number(e.target.value))
                                }
                              />
                            </div>
                            <span className="text-muted-foreground">-</span>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground">Max</Label>
                              <Input
                                type="number"
                                min={0}
                                max={300}
                                className={`w-16 h-8 ${delayError ? "border-destructive" : ""}`}
                                value={delay.max}
                                onChange={(e) =>
                                  updateActionDelay(action.id, "max", Number(e.target.value))
                                }
                              />
                            </div>
                            <span className="text-muted-foreground text-sm">sec</span>
                            {hasUnsavedChanges && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveActionDelay(action.id)}
                                disabled={!!delayError}
                              >
                                <IconDeviceFloppy className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            )}
                          </div>
                        </div>
                        {delayError && (
                          <p className="text-xs text-destructive pl-3">{delayError}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </MotionCard>
        )}

        {/* Ban Warning Patterns */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.32 }}
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Ban Warning Patterns</CardTitle>
              <HelpTooltip content={helpContent.banWarnings} />
            </div>
            <CardDescription>
              If any of these patterns are detected in messages from the moderator bot,
              the account will stop trying to join the game. This helps prevent bans.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing patterns */}
            {banWarningPatterns.length > 0 && (
              <div className="space-y-2" ref={banPatternsParent}>
                {banWarningPatterns.map((pattern, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={pattern.enabled}
                        onCheckedChange={() => toggleBanPatternEnabled(index)}
                      />
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {pattern.pattern}
                      </code>
                      <Badge variant={pattern.is_regex ? "default" : "secondary"}>
                        {pattern.is_regex ? "Regex" : "Text"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeBanPattern(index)}
                      aria-label="Remove ban warning pattern"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new pattern */}
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1 grid gap-2">
                  <Label htmlFor="newBanPattern">New Pattern</Label>
                  <Input
                    id="newBanPattern"
                    value={newBanPattern}
                    onChange={(e) => {
                      setNewBanPattern(e.target.value);
                      // Validate on change if regex mode
                      if (newBanPatternIsRegex && e.target.value.trim()) {
                        validateNewBanPatternField(e.target.value, true);
                      } else {
                        setErrors(prev => ({ ...prev, newBanPattern: undefined }));
                      }
                    }}
                    placeholder="Enter ban warning text or regex..."
                    className={`font-mono ${errors.newBanPattern ? "border-destructive" : ""}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
                    <Label htmlFor="isRegex" className="text-sm">
                      Regex
                    </Label>
                    <RegexHelpDialog trigger={<Button variant="ghost" size="icon-sm" aria-label="Regex help">?</Button>} />
                    <Switch
                      id="isRegex"
                      checked={newBanPatternIsRegex}
                      onCheckedChange={(checked) => {
                        setNewBanPatternIsRegex(checked);
                        // Re-validate with new mode
                        if (newBanPattern.trim()) {
                          validateNewBanPatternField(newBanPattern, checked);
                        }
                      }}
                    />
                  </div>
                  <Button onClick={addBanPattern} disabled={!newBanPattern.trim() || !!errors.newBanPattern}>
                    <IconPlus className="size-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
              {errors.newBanPattern && (
                <p className="text-xs text-destructive">{errors.newBanPattern}</p>
              )}
            </div>
          </CardContent>
        </MotionCard>

        {/* Save reminder */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
            <span>You have unsaved changes</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              Save Now
            </Button>
          </div>
        )}
      </main>
    </PageTransition>
  );
}
