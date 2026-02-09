import { ReactNode, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HelpTooltip } from "@/components/HelpTooltip";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface ValidationRule {
  validate: (value: string) => boolean;
  message: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "password" | "number" | "email" | "tel";
  multiline?: boolean;
  rows?: number;
  rules?: ValidationRule[];
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  showSuccessState?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * Form field with integrated label, help tooltip, and inline validation
 */
export function FormField({
  id,
  label,
  value,
  onChange,
  placeholder,
  help,
  required = false,
  disabled = false,
  type = "text",
  multiline = false,
  rows = 3,
  rules = [],
  validateOnBlur = true,
  validateOnChange = false,
  showSuccessState = false,
  className = "",
  inputClassName = "",
}: FormFieldProps) {
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate value
  const validate = (val: string): string | null => {
    // Required check
    if (required && !val.trim()) {
      return "This field is required";
    }

    // Custom rules
    for (const rule of rules) {
      if (!rule.validate(val)) {
        return rule.message;
      }
    }

    return null;
  };

  // Run validation when appropriate
  useEffect(() => {
    if (touched || validateOnChange) {
      setError(validate(value));
    }
  }, [value, touched, validateOnChange]);

  const handleBlur = () => {
    if (validateOnBlur) {
      setTouched(true);
      setError(validate(value));
    }
  };

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (validateOnChange) {
      setError(validate(newValue));
    }
  };

  const hasError = touched && error;
  const isValid = touched && !error && value.trim() && showSuccessState;

  const inputProps = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      handleChange(e.target.value),
    onBlur: handleBlur,
    placeholder,
    disabled,
    className: cn(
      inputClassName,
      hasError && "border-destructive focus-visible:ring-destructive",
      isValid && "border-success focus-visible:ring-success"
    ),
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label with optional help */}
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className={cn(hasError && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {help && <HelpTooltip content={help} />}
      </div>

      {/* Input */}
      <div className="relative">
        {multiline ? (
          <Textarea {...inputProps} rows={rows} />
        ) : (
          <Input {...inputProps} type={type} />
        )}

        {/* Status icon */}
        {(hasError || isValid) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {hasError ? (
              <IconAlertCircle className="size-4 text-destructive" />
            ) : (
              <IconCheck className="size-4 text-success" />
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-sm text-destructive flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Number input with validation
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  help,
  required = false,
  disabled = false,
  className = "",
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const validate = (val: number): string | null => {
    if (min !== undefined && val < min) {
      return `Must be at least ${min}`;
    }
    if (max !== undefined && val > max) {
      return `Must be at most ${max}`;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    onChange(newValue);
    if (touched) {
      setError(validate(newValue));
    }
  };

  const handleBlur = () => {
    setTouched(true);
    setError(validate(value));
  };

  const hasError = touched && error;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className={cn(hasError && "text-destructive")}>
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {help && <HelpTooltip content={help} />}
      </div>

      <Input
        id={id}
        type="number"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        disabled={disabled}
        className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
      />

      {hasError && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * Delay range input (min/max pair)
 */
export function DelayRangeField({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  label = "Delay (seconds)",
  help,
  disabled = false,
  className = "",
}: {
  minValue: number;
  maxValue: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  label?: string;
  help?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (minValue > maxValue) {
      setError("Min must be ≤ max");
    } else if (minValue < 0 || maxValue < 0) {
      setError("Values must be ≥ 0");
    } else {
      setError(null);
    }
  }, [minValue, maxValue]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <Label className={cn(error && "text-destructive")}>{label}</Label>
        {help && <HelpTooltip content={help} />}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Input
            type="number"
            min={0}
            value={minValue}
            onChange={(e) => onMinChange(Number(e.target.value))}
            disabled={disabled}
            className={cn(error && "border-destructive")}
          />
        </div>
        <span className="text-muted-foreground mt-5">–</span>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Input
            type="number"
            min={0}
            value={maxValue}
            onChange={(e) => onMaxChange(Number(e.target.value))}
            disabled={disabled}
            className={cn(error && "border-destructive")}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}

export default FormField;
