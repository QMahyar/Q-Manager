import { useState, useEffect, useRef } from "react";
import {
  IconPhone,
  IconKey,
  IconLock,
  IconUser,
  IconCheck,
  IconLoader2,
  IconAlertCircle,
  IconCircleCheckFilled,
  IconApi,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthState,
  loginStart,
  loginGetState,
  loginSendPhone,
  loginSendCode,
  loginSendPassword,
  loginComplete,
  loginCancel,
} from "@/lib/login-api";
import { checkCanLogin, checkAccountNameExists } from "@/lib/api";
import type { StartupCheckResult } from "@/lib/types";
import { validatePhoneNumber, validateAccountName } from "@/lib/validation";
import { uiLogger } from "@/lib/logger";

interface LoginWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "init" | "phone" | "code" | "password" | "name" | "success" | "error";

export function LoginWizard({ open, onOpenChange, onSuccess }: LoginWizardProps) {
  const [step, setStep] = useState<Step>("init");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Session state
  const [token, setToken] = useState<string | null>(null);

  // Tracks the post-success redirect timer so it can be cleared if the dialog
  // unmounts before it fires (otherwise it calls onSuccess/onOpenChange on an
  // unmounted component).
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Form inputs
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [apiIdOverride, setApiIdOverride] = useState("");
  const [apiHashOverride, setApiHashOverride] = useState("");
  
  // Password hint from Telegram
  const [passwordHint, setPasswordHint] = useState("");
  
  // User info from successful login
  const [userInfo, setUserInfo] = useState<{
    userId: number;
    firstName: string;
    lastName: string;
    phone: string;
  } | null>(null);
  
  // Validation errors
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [accountNameError, setAccountNameError] = useState<string | undefined>();
  const [accountNameTouched, setAccountNameTouched] = useState(false);

  // Cancel login session on dialog close/unmount while login is in progress
  useEffect(() => {
    return () => {
      if (token && step !== "success" && step !== "error") {
        void loginCancel(token).catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Clear the post-success redirect timer if the dialog unmounts first
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("init");
      setLoading(false);
      setError(null);
      setToken(null);
      setPhone("");
      setCode("");
      setPassword("");
      setAccountName("");
      setApiIdOverride("");
      setApiHashOverride("");
      setPasswordHint("");
      setUserInfo(null);
      setPhoneError(undefined);
      setAccountNameError(undefined);
      setAccountNameTouched(false);
      
      // Start initialization
      initLogin();
    }
  }, [open]);

  // Poll for state changes
  useEffect(() => {
    if (!token || step === "success" || step === "error") return;

    // Use a ref-snapshot of the handler so the interval always calls the
    // latest version without needing to be recreated on every step change.
    const interval = setInterval(async () => {
      try {
        const state = await loginGetState(token);
        handleStateChange(state);
      } catch (err) {
        uiLogger.logError(err, "Error polling login state", { source: "LoginWizard" });
      }
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, step]);

  const initLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Comprehensive pre-flight check (Telethon + API creds + sessions dir)
      const preflight: StartupCheckResult = await checkCanLogin(
        apiIdOverride ? parseInt(apiIdOverride) : null,
        apiHashOverride || null
      );
      if (!preflight.can_proceed) {
        // Build a helpful error message from blocking errors
        const messages = preflight.errors
          .filter(e => e.is_blocking)
          .map(e => `• ${e.message}${e.details ? `\n  ${e.details}` : ""}`)
          .join("\n\n");
        setError(messages || "Cannot start login due to configuration issues.");
        setStep("error");
        setLoading(false);
        return;
      }

      // Start login session
      const result = await loginStart(
        apiIdOverride ? parseInt(apiIdOverride) : undefined,
        apiHashOverride || undefined
      );
      setToken(result.token);
      handleStateChange(result.state);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleStateChange = (state: AuthState) => {
    switch (state.state) {
      case "waiting_phone_number":
        setStep("phone");
        break;
      case "waiting_code":
        setStep("code");
        break;
      case "waiting_password":
        setPasswordHint(state.password_hint || "");
        setStep("password");
        break;
      case "ready":
        setUserInfo({
          userId: state.user_id,
          firstName: state.first_name,
          lastName: state.last_name,
          phone: state.phone,
        });
        // Only set default name on first transition to "name" step
        if (step !== "name" && !accountNameTouched) {
          setAccountName(state.first_name || "My Account");
        }
        setStep("name");
        break;
      case "error":
        setError(state.message);
        setStep("error");
        break;
      case "closed":
        // Session was closed
        break;
    }
  };

  // Validate phone on change
  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (value.trim()) {
      const result = validatePhoneNumber(value);
      setPhoneError(result.error);
    } else {
      setPhoneError(undefined);
    }
  };

  // Validate account name on change
  const handleAccountNameChange = (value: string) => {
    setAccountName(value);
    setAccountNameTouched(true);
    if (value.trim()) {
      const result = validateAccountName(value);
      setAccountNameError(result.error);
    } else {
      setAccountNameError(undefined);
    }
  };

  const handleSendPhone = async () => {
    if (!token || !phone.trim()) return;
    
    // Validate before sending
    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const state = await loginSendPhone(token, phone.trim());
      handleStateChange(state);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!token || !code.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const state = await loginSendCode(token, code.trim());
      handleStateChange(state);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendPassword = async () => {
    if (!token || !password) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const state = await loginSendPassword(token, password);
      handleStateChange(state);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!token || !accountName.trim()) return;
    
    // Validate before completing
    const nameValidation = validateAccountName(accountName);
    if (!nameValidation.valid) {
      setAccountNameError(nameValidation.error);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check if account name already exists
      const exists = await checkAccountNameExists(accountName.trim());
      if (exists) {
        setAccountNameError("An account with this name already exists");
        setLoading(false);
        return;
      }
      
      await loginComplete(
        token,
        accountName.trim(),
        apiIdOverride ? parseInt(apiIdOverride) : null,
        apiHashOverride || null
      );
      setStep("success");
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (token) {
      try {
        await loginCancel(token);
      } catch (err) {
        uiLogger.logError(err, "Error canceling login", { source: "LoginWizard" });
      }
    }
    setLoading(false);
    onOpenChange(false);
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: "phone", label: "Phone", icon: IconPhone },
      { key: "code", label: "Code", icon: IconKey },
      { key: "password", label: "2FA", icon: IconLock, optional: true },
      { key: "name", label: "Name", icon: IconUser },
    ];
    
    const currentIndex = steps.findIndex(s => s.key === step);
    
    return (
      <div className="flex items-center justify-center gap-1 mb-6">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.key === step;
          const isCompleted = currentIndex > i || step === "success";
          const isSkipped = s.optional && step === "name" && i === 2;
          
          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ring-2 ${
                    isActive
                      ? "bg-primary text-primary-foreground ring-primary/30"
                      : isCompleted || isSkipped
                      ? "bg-emerald-500 text-white ring-emerald-500/30"
                      : "bg-muted text-muted-foreground ring-transparent"
                  }`}
                >
                  {isCompleted || isSkipped ? (
                    <IconCheck className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-[10px] font-medium leading-none ${
                  isActive ? "text-primary" : isCompleted || isSkipped ? "text-emerald-500" : "text-muted-foreground"
                }`}>
                  {s.label}
                  {s.optional && <span className="opacity-60"> (opt)</span>}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-10 h-0.5 mb-4 mx-1 rounded-full transition-all duration-300 ${
                    currentIndex > i || step === "success" ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = () => {
    if (step === "init" || (loading && step !== "phone" && step !== "code" && step !== "password" && step !== "name")) {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="p-4 rounded-2xl bg-primary/10">
            <IconLoader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">Connecting to Telegram</p>
            <p className="text-sm text-muted-foreground mt-1">Initializing Telethon worker...</p>
          </div>
        </div>
      );
    }

    if (step === "error") {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="p-4 rounded-2xl bg-destructive/10">
            <IconAlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-destructive mb-1">Login Failed</p>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{error}</p>
          </div>
        </div>
      );
    }

    if (step === "success") {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-500/10">
            <IconCircleCheckFilled className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-emerald-500">Account Created!</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting you now...</p>
          </div>
        </div>
      );
    }

    if (step === "phone") {
      return (
        <div className="space-y-4">
          {renderStepIndicator()}
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+1234567890"
              disabled={loading}
              className={phoneError ? "border-destructive" : ""}
            />
            {phoneError ? (
              <p className="text-xs text-destructive">{phoneError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enter your phone number with country code
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <IconApi className="size-3.5" />
              API Override (optional)
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="apiIdOverride" className="text-xs">API ID</Label>
                <Input
                  id="apiIdOverride"
                  type="number"
                  value={apiIdOverride}
                  onChange={(e) => setApiIdOverride(e.target.value)}
                  placeholder="Use global default"
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="apiHashOverride" className="text-xs">API Hash</Label>
                <Input
                  id="apiHashOverride"
                  type="password"
                  value={apiHashOverride}
                  onChange={(e) => setApiHashOverride(e.target.value)}
                  placeholder="Use global default"
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      );
    }

    if (step === "code") {
      return (
        <div className="space-y-4">
          {renderStepIndicator()}
          <div className="grid gap-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345"
              disabled={loading}
              maxLength={6}
            />
            <p className="text-xs text-muted-foreground">
              Enter the code sent to your Telegram app
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              <IconLoader2 className="h-3 w-3 animate-spin shrink-0" />
              Waiting for code from your Telegram app...
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      );
    }

    if (step === "password") {
      return (
        <div className="space-y-4">
          {renderStepIndicator()}
          <div className="grid gap-2">
            <Label htmlFor="password">Two-Factor Authentication</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your 2FA password"
              disabled={loading}
            />
            {passwordHint && (
              <p className="text-xs text-muted-foreground">
                Hint: {passwordHint}
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      );
    }

    if (step === "name") {
      return (
        <div className="space-y-4">
          {renderStepIndicator()}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-500/15">
              <IconCircleCheckFilled className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {userInfo?.firstName} {userInfo?.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{userInfo?.phone}</p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="accountName">Account Name</Label>
            <Input
              id="accountName"
              value={accountName}
              onChange={(e) => handleAccountNameChange(e.target.value)}
              placeholder="My Account"
              disabled={loading}
              className={accountNameError ? "border-destructive" : ""}
              maxLength={100}
            />
            {accountNameError ? (
              <p className="text-xs text-destructive">{accountNameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Give this account a name for easy identification
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      );
    }

    return null;
  };

  const renderFooter = () => {
    if (step === "init" || step === "success") {
      return null;
    }

    if (step === "error") {
      return (
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Close
          </Button>
          <Button onClick={initLogin}>
            Try Again
          </Button>
        </DialogFooter>
      );
    }

    return (
      <DialogFooter>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        {step === "phone" && (
          <Button onClick={handleSendPhone} disabled={loading || !phone.trim() || !!phoneError}>
            {loading ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Send Code
          </Button>
        )}
        {step === "code" && (
          <Button onClick={handleSendCode} disabled={loading || !code.trim()}>
            {loading ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Verify
          </Button>
        )}
        {step === "password" && (
          <Button onClick={handleSendPassword} disabled={loading || !password}>
            {loading ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit
          </Button>
        )}
        {step === "name" && (
          <Button onClick={handleComplete} disabled={loading || !accountName.trim() || !!accountNameError}>
            {loading ? <IconLoader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Account
          </Button>
        )}
      </DialogFooter>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) { void handleCancel(); } }}>
      <DialogContent className="sm:max-w-md" hideClose={false}>
        <DialogHeader>
          <DialogTitle>Add Telegram Account</DialogTitle>
          <DialogDescription>
            {step === "phone" && "Enter your phone number to receive a verification code"}
            {step === "code" && "Check your Telegram app for the verification code"}
            {step === "password" && "Enter your two-factor authentication password"}
            {step === "name" && "Choose a name for this account"}
            {step === "init" && "Connecting to Telegram..."}
            {step === "error" && "Something went wrong"}
            {step === "success" && "Account created successfully"}
          </DialogDescription>
        </DialogHeader>
        
        {renderContent()}
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
