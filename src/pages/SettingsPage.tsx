import { useState, useEffect } from "react";
import { PageTransition } from "@/components/motion/PageTransition";
import { motion, AnimatePresence } from "motion/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
  IconPalette,
  IconKey,
  IconRobot,
  IconPlayerPlay,
  IconClock,
  IconShieldOff,
  IconActivity,
  IconSettings,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
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
import { useSettingsData, useDelayDefaults, useDelayDefaultMutation, parseBanPatterns, useDiagnosticsSnapshot } from "@/hooks/useSettingsData";
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
  const { diagnosticsQuery } = useDiagnosticsSnapshot();
  const settings = settingsQuery.data;
  const isLoading = settingsQuery.isLoading;
  const actions = actionsQuery.data ?? [];

  const { actionDelays: serverActionDelays, isLoading: delaysLoading } = useDelayDefaults(actions);
  // Local overrides for unsaved edits — merged on top of server values
  const [localDelayOverrides, setLocalDelayOverrides] = useState<Record<number, { min: number; max: number }>>({});
  const actionDelays = { ...serverActionDelays, ...localDelayOverrides };
  const delayDefaultMutation = useDelayDefaultMutation();

  // Update form when settings load
  useEffect(() => {
    if (!settings || hasChanges) {
      return;
    }
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
  }, [settings, theme, palette, variant, hasChanges]);

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
    setBanWarningPatterns((prev) =>
      prev.map((pattern, i) =>
        i === index ? { ...pattern, enabled: !pattern.enabled } : pattern
      )
    );
    markChanged();
  };

  // Update action delay locally with validation
  const updateActionDelay = (actionId: number, field: "min" | "max", value: number) => {
    const currentDelay = actionDelays[actionId] || { min: 2, max: 8 };
    const newDelay = { ...currentDelay, [field]: value };

    setLocalDelayOverrides((prev: Record<number, { min: number; max: number }>) => ({
      ...prev,
      [actionId]: newDelay,
    }));
    setDelayChanges((prev: Set<number>) => new Set(prev).add(actionId));

    // Validate the delay
    const result = validateDelay(newDelay.min, newDelay.max);
    setDelayErrors((prev: Record<number, string>) => ({
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
        setDelayErrors((prev: Record<number, string>) => ({ ...prev, [actionId]: result.error || "" }));
        toast.error("Invalid delay range", {
          description: result.error,
        });
        return;
      }
      await delayDefaultMutation.mutateAsync({ actionId, min: delay.min, max: delay.max });
      // Clear the local override — the server value will now reflect the saved one
      setLocalDelayOverrides((prev: Record<number, { min: number; max: number }>) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
      setDelayChanges((prev: Set<number>) => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
      setDelayErrors((prev: Record<number, string>) => ({ ...prev, [actionId]: "" }));
      toast.success("Delay saved");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <PageHeader title="Settings" description="Global configuration and defaults" icon={IconSettings} iconColor="text-rose-500" />
        <main className="flex-1 p-6 w-full max-w-3xl mx-auto">
          <div className="text-muted-foreground text-center py-12">Loading settings...</div>
        </main>
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen flex flex-col">
      <PageHeader title="Settings" description="Global configuration and defaults" icon={IconSettings} iconColor="text-rose-500">
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary">Unsaved changes</Badge>
          )}
          <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
            <IconDeviceFloppy className="size-4 mr-1" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </PageHeader>

      <main className="flex-1 p-6 space-y-6 w-full max-w-3xl mx-auto">
        {/* Theme */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0 }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <IconPalette className="size-4 text-violet-500" />
              </div>
              <div>
                <CardTitle>Theme</CardTitle>
                <CardDescription>
                  Choose your preferred color palette and light/dark mode.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Mode picker — icon buttons */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "system", label: "System", Icon: IconDeviceDesktop },
                    { value: "light",  label: "Light",  Icon: IconSun },
                    { value: "dark",   label: "Dark",   Icon: IconMoon },
                  ] as const
                ).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setThemeMode(value); setTheme(value); markChanged(); }}
                    className={`flex-1 flex flex-col items-center gap-1.5 rounded-lg border py-3 px-2 text-xs font-medium transition-all
                      ${themeMode === value
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Palette picker — color swatches */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Palette</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "zinc",    label: "Zinc",    color: "bg-zinc-500" },
                    { value: "slate",   label: "Slate",   color: "bg-slate-500" },
                    { value: "gray",    label: "Gray",    color: "bg-gray-500" },
                    { value: "stone",   label: "Stone",   color: "bg-stone-500" },
                    { value: "sky",     label: "Sky",     color: "bg-sky-500" },
                    { value: "indigo",  label: "Indigo",  color: "bg-indigo-500" },
                    { value: "emerald", label: "Emerald", color: "bg-emerald-500" },
                    { value: "rose",    label: "Rose",    color: "bg-rose-500" },
                  ] as const
                ).map(({ value, label, color }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setThemePalette(value); setPalette(value); markChanged(); }}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all
                      ${themePalette === value
                        ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    title={label}
                  >
                    <span className={`size-3 rounded-full ${color} shrink-0`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity picker */}
            <div className="grid gap-2">
              <Label className="text-xs text-muted-foreground">Intensity</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: "subtle",   label: "Subtle",        desc: "Soft, muted tones" },
                    { value: "vibrant",  label: "Vibrant",       desc: "Richer, saturated" },
                    { value: "contrast", label: "High Contrast", desc: "Maximum legibility" },
                  ] as const
                ).map(({ value, label, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setThemeVariant(value); setVariant(value); markChanged(); }}
                    className={`flex-1 flex flex-col gap-0.5 rounded-lg border py-2.5 px-3 text-left transition-all
                      ${themeVariant === value
                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                        : "border-border bg-muted/30 hover:bg-muted"
                      }`}
                  >
                    <span className={`text-xs font-medium ${themeVariant === value ? "text-primary" : "text-foreground"}`}>{label}</span>
                    <span className="text-[10px] text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview swatches */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { label: "Primary",     cls: "bg-primary" },
                { label: "Success",     cls: "bg-success" },
                { label: "Warning",     cls: "bg-warning" },
                { label: "Destructive", cls: "bg-destructive" },
                { label: "Muted",       cls: "bg-muted-foreground" },
              ].map(({ label, cls }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                  <span className={`size-2.5 rounded-full ${cls}`} />
                  {label}
                </span>
              ))}
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <IconKey className="size-4 text-sky-500" />
              </div>
              <div>
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
                    className="text-primary hover:underline font-medium"
                  >
                    my.telegram.org
                  </a>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="apiId" className="text-xs text-muted-foreground">API ID</Label>
                <Input
                  id="apiId"
                  type="number"
                  value={apiId}
                  onChange={(e) => { setApiId(e.target.value); validateApiIdField(e.target.value); markChanged(); }}
                  placeholder="12345678"
                  className={errors.apiId ? "border-destructive" : ""}
                />
                {errors.apiId && <p className="text-xs text-destructive">{errors.apiId}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="apiHash" className="text-xs text-muted-foreground">API Hash</Label>
                <Input
                  id="apiHash"
                  type="password"
                  value={apiHash}
                  onChange={(e) => { setApiHash(e.target.value); validateApiHashField(e.target.value); markChanged(); }}
                  placeholder="abcdef1234567890..."
                  className={errors.apiHash ? "border-destructive" : ""}
                />
                {errors.apiHash && <p className="text-xs text-destructive">{errors.apiHash}</p>}
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <IconRobot className="size-4 text-emerald-500" />
              </div>
              <div>
                <CardTitle>Moderator Bots</CardTitle>
                <CardDescription>
                  Configure the Werewolf game moderator bots to monitor
                </CardDescription>
              </div>
            </div>
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <IconPlayerPlay className="size-4 text-orange-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Join Rules (Default)</CardTitle>
                  <HelpTooltip content={helpContent.joinRules} />
                </div>
                <CardDescription>
                  Default settings for automatic game joining. Can be overridden per account.
                </CardDescription>
              </div>
            </div>
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
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <IconClock className="size-4 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Default Action Delays</CardTitle>
                    <HelpTooltip content={helpContent.delays} />
                  </div>
                  <CardDescription>
                    Set the default delay range (in seconds) before clicking for each action.
                    Can be overridden per account in Targets page.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {delaysLoading && actions.length > 0 ? (
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

        {/* Diagnostics — inline compact row */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.32 }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10">
                  <IconActivity className="size-4 text-sky-500" />
                </div>
                <CardTitle>Diagnostics</CardTitle>
              </div>
              {diagnosticsQuery.data && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${diagnosticsQuery.data.running_workers > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                    <span className="font-medium text-foreground">{diagnosticsQuery.data.running_workers}</span>
                    <span>/ {diagnosticsQuery.data.total_workers} workers</span>
                  </span>
                  <span className="text-border">|</span>
                  <span>Uptime: <span className="font-medium text-foreground">{Math.floor(diagnosticsQuery.data.uptime_ms / 1000)}s</span></span>
                  <span className="text-border">|</span>
                  <span>{diagnosticsQuery.data.running_workers > 0 ? "🟢 Active" : "⚪ Idle"}</span>
                </div>
              )}
              {diagnosticsQuery.isLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
              {diagnosticsQuery.isError && <span className="text-xs text-destructive">Failed to load</span>}
            </div>
          </CardHeader>
        </MotionCard>

        {/* Ban Warning Patterns */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.32 }}
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <IconShieldOff className="size-4 text-destructive" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>Ban Warning Patterns</CardTitle>
                  <HelpTooltip content={helpContent.banWarnings} />
                </div>
                <CardDescription>
                  If any of these patterns are detected in messages from the moderator bot,
                  the account will stop trying to join the game. This helps prevent bans.
                </CardDescription>
              </div>
            </div>
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

        {/* Save reminder — animated floating pill */}
        <AnimatePresence>
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              className="fixed bottom-6 right-6 z-50 bg-background/95 border border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-xl px-4 py-3 flex items-center gap-3 backdrop-blur-md"
            >
              <motion.div
                className="size-2 rounded-full bg-amber-500"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="text-sm font-medium text-foreground">Unsaved changes</span>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="h-7 text-xs">
                <IconDeviceFloppy className="size-3.5 mr-1.5" />
                {saveMutation.isPending ? "Saving..." : "Save Now"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </PageTransition>
  );
}
