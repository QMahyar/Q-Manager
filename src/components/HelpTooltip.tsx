import { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconInfoCircle, IconHelpCircle } from "@tabler/icons-react";

interface HelpTooltipProps {
  content: ReactNode;
  children?: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  variant?: "info" | "help";
  className?: string;
}

/**
 * Help tooltip component for explaining complex features
 */
export function HelpTooltip({
  content,
  children,
  side = "top",
  align = "center",
  variant = "info",
  className = "",
}: HelpTooltipProps) {
  const Icon = variant === "info" ? IconInfoCircle : IconHelpCircle;

  const trigger = children || (
    <span className={`inline-flex cursor-help ${className}`}>
      <Icon className="size-4 text-muted-foreground hover:text-foreground transition-colors" />
    </span>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Label with integrated help tooltip
 */
export function LabelWithHelp({
  label,
  help,
  htmlFor,
  required = false,
  className = "",
}: {
  label: string;
  help: ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <HelpTooltip content={help} />
    </div>
  );
}

/**
 * Pre-defined help content for common features
 */
export const helpContent = {
  // Phases
  phases: (
    <div className="space-y-1">
      <p className="font-medium">Game Phases</p>
      <p className="text-xs">
        Phases represent different stages of the game: JoinTime, Join Confirmation, Game Start, and Game End.
        Add patterns to detect when each phase begins.
      </p>
    </div>
  ),
  phasePattern: (
    <div className="space-y-1">
      <p className="font-medium">Pattern Matching</p>
      <p className="text-xs">
        Patterns match against message text. Use substring for simple matching or regex for complex patterns.
        Higher priority patterns are checked first.
      </p>
    </div>
  ),
  phasePriority: (
    <div className="space-y-1">
      <p className="font-medium">Phase Priority</p>
      <p className="text-xs">
        Lower numbers = higher priority. When multiple patterns match, the one with lowest priority wins.
      </p>
    </div>
  ),

  // Actions
  actions: (
    <div className="space-y-1">
      <p className="font-medium">Actions</p>
      <p className="text-xs">
        Actions define how the bot responds to game prompts. Each action has trigger patterns and a button type
        that determines how targets are selected.
      </p>
    </div>
  ),
  buttonType: (
    <div className="space-y-1">
      <p className="font-medium">Button Types</p>
      <ul className="text-xs space-y-1">
        <li><strong>player_list:</strong> Buttons show player names</li>
        <li><strong>yes_no:</strong> Simple Yes/No choices</li>
        <li><strong>fixed:</strong> Predefined button text</li>
      </ul>
    </div>
  ),
  twoStepAction: (
    <div className="space-y-1">
      <p className="font-medium">Two-Step Actions</p>
      <p className="text-xs">
        Some actions (like Cupid) require selecting two targets in sequence. Configure target pairs to
        specify which players to choose together.
      </p>
    </div>
  ),

  // Targets
  targets: (
    <div className="space-y-1">
      <p className="font-medium">Target Configuration</p>
      <p className="text-xs">
        Set default targets globally, then override per-account if needed. Targets are checked in priority order.
      </p>
    </div>
  ),
  randomFallback: (
    <div className="space-y-1">
      <p className="font-medium">Random Fallback</p>
      <p className="text-xs">
        When enabled, if no configured target is found in the button list, a random available player will be selected.
      </p>
    </div>
  ),
  blacklist: (
    <div className="space-y-1">
      <p className="font-medium">Blacklist</p>
      <p className="text-xs">
        Players on the blacklist will never be targeted by random selection. Explicit targets override the blacklist.
      </p>
    </div>
  ),
  targetPairs: (
    <div className="space-y-1">
      <p className="font-medium">Target Pairs</p>
      <p className="text-xs">
        For two-step actions, configure pairs of targets (A, B). The bot will select A in the first prompt and B in the second.
      </p>
    </div>
  ),

  // Settings
  apiCredentials: (
    <div className="space-y-1">
      <p className="font-medium">API Credentials</p>
      <p className="text-xs">
        Telegram API ID and Hash from my.telegram.org. Required for Telethon to connect to Telegram.
        Set globally or override per-account.
      </p>
    </div>
  ),
  joinRules: (
    <div className="space-y-1">
      <p className="font-medium">Join Rules</p>
      <p className="text-xs">
        <strong>Max Attempts:</strong> How many times to try joining before giving up.<br />
        <strong>Cooldown:</strong> Seconds to wait between join attempts.
      </p>
    </div>
  ),
  banWarnings: (
    <div className="space-y-1">
      <p className="font-medium">Ban Warning Detection</p>
      <p className="text-xs">
        Patterns to detect ban warnings from the moderator bot. When detected, join attempts will stop
        to prevent account restrictions.
      </p>
    </div>
  ),
  moderatorBot: (
    <div className="space-y-1">
      <p className="font-medium">Moderator Bot</p>
      <p className="text-xs">
        The Telegram user ID of the Werewolf game bot. Messages from this bot are used to detect
        game phases and actions.
      </p>
    </div>
  ),
  delays: (
    <div className="space-y-1">
      <p className="font-medium">Action Delays</p>
      <p className="text-xs">
        Random delay (in seconds) before clicking action buttons. Helps avoid detection and makes
        behavior more human-like.
      </p>
    </div>
  ),

  // Accounts
  groupSlots: (
    <div className="space-y-1">
      <p className="font-medium">Group Slots</p>
      <p className="text-xs">
        Each account can monitor up to 2 game groups. Select groups from your Telegram chats and
        assign to slots.
      </p>
    </div>
  ),
  accountStatus: (
    <div className="space-y-1">
      <p className="font-medium">Account Status</p>
      <ul className="text-xs space-y-1">
        <li><strong>Stopped:</strong> Not connected</li>
        <li><strong>Running:</strong> Active and monitoring</li>
        <li><strong>Error:</strong> Connection failed</li>
      </ul>
    </div>
  ),

  // Regex
  regex: (
    <div className="space-y-1">
      <p className="font-medium">Regex vs Substring</p>
      <p className="text-xs">
        <strong>Substring:</strong> Simple text matching (case-insensitive).<br />
        <strong>Regex:</strong> Full regular expression support for complex patterns.
      </p>
    </div>
  ),
};

export default HelpTooltip;
