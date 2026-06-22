import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
	IconUsers,
	IconListCheck,
	IconHandClick,
	IconTarget,
	IconSettings,
	IconSun,
	IconMoon,
	IconDeviceDesktop,
	IconAlertTriangle,
	IconAlertCircle,
	IconActivity,
	IconChevronRight,
	IconBolt,
	IconPlayerPlay,
	IconPlayerStop,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { getVersion } from "@tauri-apps/api/app";
import { checkSystem } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { listAccounts, listActions } from "@/lib/api";
import type { StartupCheckError } from "@/lib/types";
import { WolfLogo, WolfIcon } from "@/components/WolfLogo";

const BANNER_DISMISSED_KEY = "q-manager-banner-dismissed";

function buildSystemErrorHash(errors: StartupCheckError[]) {
	return errors
		.map((error) =>
			[
				error.code,
				error.is_blocking ? "1" : "0",
				error.message,
				error.details ?? "",
			].join("::"),
		)
		.join("|");
}

const navigationItems = [
	{
		title: "Accounts",
		description: "Manage Telegram accounts and sessions",
		icon: IconUsers,
		path: "/accounts",
		accent: "sky",
		color: "text-sky-500",
		bg: "bg-sky-500/10",
		hoverBg: "group-hover:bg-sky-500",
		border: "group-hover:border-sky-500/40",
		glow: "group-hover:shadow-sky-500/15",
		shortcut: "Alt+1",
	},
	{
		title: "Phase Detection",
		description: "Configure game phase detection patterns",
		icon: IconListCheck,
		path: "/phase-detection",
		accent: "violet",
		color: "text-violet-500",
		bg: "bg-violet-500/10",
		hoverBg: "group-hover:bg-violet-500",
		border: "group-hover:border-violet-500/40",
		glow: "group-hover:shadow-violet-500/15",
		shortcut: "Alt+2",
	},
	{
		title: "Actions",
		description: "Define action triggers and button types",
		icon: IconHandClick,
		path: "/actions",
		accent: "emerald",
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
		hoverBg: "group-hover:bg-emerald-500",
		border: "group-hover:border-emerald-500/40",
		glow: "group-hover:shadow-emerald-500/15",
		shortcut: "Alt+3",
	},
	{
		title: "Targets",
		description: "Set per-account targeting rules",
		icon: IconTarget,
		path: "/targets",
		accent: "orange",
		color: "text-orange-500",
		bg: "bg-orange-500/10",
		hoverBg: "group-hover:bg-orange-500",
		border: "group-hover:border-orange-500/40",
		glow: "group-hover:shadow-orange-500/15",
		shortcut: "Alt+4",
	},
	{
		title: "Settings",
		description: "Global configuration and defaults",
		icon: IconSettings,
		path: "/settings",
		accent: "rose",
		color: "text-rose-500",
		bg: "bg-rose-500/10",
		hoverBg: "group-hover:bg-rose-500",
		border: "group-hover:border-rose-500/40",
		glow: "group-hover:shadow-rose-500/15",
		shortcut: "Alt+5",
	},
	{
		title: "Activity",
		description: "View live account activity feed",
		icon: IconActivity,
		path: "/accounts",
		accent: "amber",
		color: "text-amber-500",
		bg: "bg-amber-500/10",
		hoverBg: "group-hover:bg-amber-500",
		border: "group-hover:border-amber-500/40",
		glow: "group-hover:shadow-amber-500/15",
		shortcut: "",
	},
];

export default function HomePage() {
	const navigate = useNavigate();
	const { theme, setTheme } = useTheme();

	const [version, setVersion] = useState<string>("1.0.1");
	useEffect(() => {
		getVersion()
			.then(setVersion)
			.catch(() => setVersion("1.0.1"));
	}, []);

	const { data: accounts = [] } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});
	const { data: actions = [] } = useQuery({
		queryKey: ["actions"],
		queryFn: listActions,
	});

	const runningCount = accounts.filter((a) => a.status === "running").length;
	const stoppedCount = accounts.filter((a) => a.status === "stopped").length;
	const actionsCount = actions.length;

	const [systemErrors, setSystemErrors] = useState<StartupCheckError[]>([]);
	const [showSystemBanner, setShowSystemBanner] = useState(false);
	const dismissedHashRef = useRef<string>(
		sessionStorage.getItem(BANNER_DISMISSED_KEY) ?? "",
	);

	useEffect(() => {
		checkSystem()
			.then((result) => {
				if (result.errors.length === 0) {
					setSystemErrors([]);
					setShowSystemBanner(false);
					return;
				}
				const sorted = [...result.errors].sort((a, b) =>
					a.is_blocking === b.is_blocking ? 0 : a.is_blocking ? -1 : 1,
				);
				setSystemErrors(sorted);
				const hash = buildSystemErrorHash(sorted);
				setShowSystemBanner(hash !== dismissedHashRef.current);
			})
			.catch(() => {});
	}, []);

	const dismissBanner = () => {
		const hash = buildSystemErrorHash(systemErrors);
		dismissedHashRef.current = hash;
		sessionStorage.setItem(BANNER_DISMISSED_KEY, hash);
		setShowSystemBanner(false);
	};

	const hasBlockingErrors = systemErrors.some((e) => e.is_blocking);

	const cycleTheme = () => {
		const next: Record<string, "light" | "dark" | "system"> = {
			system: "light",
			light: "dark",
			dark: "system",
		};
		setTheme(next[theme] ?? "system");
	};

	const themeIcon =
		theme === "dark" ? (
			<IconMoon className="h-4 w-4" />
		) : theme === "light" ? (
			<IconSun className="h-4 w-4" />
		) : (
			<IconDeviceDesktop className="h-4 w-4" />
		);

	const themeLabel =
		theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

	return (
		<div className="min-h-screen flex flex-col bg-background">
			{/* ── Header ── */}
			<motion.header
				className="border-b border-border/60 bg-background/90 backdrop-blur-md px-6 py-3 flex items-center justify-between sticky top-0 z-10"
				initial={{ opacity: 0, y: -12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ type: "spring", stiffness: 380, damping: 30 }}
			>
				{/* Branding */}
				<motion.div
					className="flex items-center gap-3"
					initial={{ opacity: 0, x: -8 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{
						type: "spring",
						stiffness: 380,
						damping: 26,
						delay: 0.06,
					}}
				>
					<WolfLogo size={40} animate={true} />
					<div>
						<h1 className="text-lg font-bold leading-none text-foreground">
							Q Manager
						</h1>
						<p className="text-xs text-muted-foreground mt-0.5">
							Werewolf Game Automation
						</p>
					</div>
				</motion.div>

				{/* Right: theme toggle */}
				<motion.div
					initial={{ opacity: 0, x: 8 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{
						type: "spring",
						stiffness: 380,
						damping: 26,
						delay: 0.1,
					}}
				>
					<Button
						variant="outline"
						size="sm"
						onClick={cycleTheme}
						className="gap-2 h-8 px-3 text-xs font-medium border-border/70 bg-background/60 hover:bg-muted/80"
						title={`Current: ${themeLabel} — click to cycle`}
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.span
								key={theme}
								initial={{ opacity: 0, rotate: -20, scale: 0.75 }}
								animate={{ opacity: 1, rotate: 0, scale: 1 }}
								exit={{ opacity: 0, rotate: 20, scale: 0.75 }}
								transition={{ duration: 0.15 }}
								className="flex items-center"
							>
								{themeIcon}
							</motion.span>
						</AnimatePresence>
						<span className="text-foreground/70">{themeLabel}</span>
					</Button>
				</motion.div>
			</motion.header>

			{/* ── System error banner ── */}
			<AnimatePresence>
				{showSystemBanner && systemErrors.length > 0 && (
					<motion.div
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.2 }}
						className={`border-b px-6 py-3 ${
							hasBlockingErrors
								? "border-destructive/30 bg-destructive/8"
								: "border-warning/25 bg-warning/8"
						}`}
					>
						<div className="flex items-start justify-between gap-4 max-w-5xl mx-auto">
							<div className="space-y-1 min-w-0">
								<p
									className={`font-semibold text-sm flex items-center gap-1.5 ${
										hasBlockingErrors ? "text-destructive" : "text-warning"
									}`}
								>
									{hasBlockingErrors ? (
										<IconAlertCircle className="h-4 w-4 shrink-0" />
									) : (
										<IconAlertTriangle className="h-4 w-4 shrink-0" />
									)}
									{hasBlockingErrors
										? "Action Required"
										: "Configuration Recommended"}
								</p>
								<ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
									{systemErrors.map((w, i) => (
										<li key={i}>
											{w.is_blocking && (
												<span className="text-destructive font-medium mr-1">
													[Blocking]
												</span>
											)}
											{w.message}
											{w.details ? ` — ${w.details}` : ""}
										</li>
									))}
								</ul>
							</div>
							<div className="flex gap-2 shrink-0">
								<Button
									variant="outline"
									size="sm"
									onClick={() => navigate("/settings")}
								>
									Open Settings
								</Button>
								<Button variant="ghost" size="sm" onClick={dismissBanner}>
									Dismiss
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* ── Main ── */}
			<main className="flex-1 flex flex-col items-center justify-center px-6 py-10 md:py-14">
				<div className="w-full max-w-4xl space-y-10">
					{/* Hero stat strip */}
					<motion.div
						className="grid grid-cols-3 gap-4"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{
							delay: 0.1,
							type: "spring",
							stiffness: 340,
							damping: 28,
						}}
					>
						{/* Running */}
						<motion.button
							onClick={() => navigate("/accounts")}
							className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 py-6 px-4 cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/10"
							whileHover={{ scale: 1.02, y: -2 }}
							whileTap={{ scale: 0.97 }}
							transition={{ type: "spring", stiffness: 500, damping: 24 }}
						>
							<div className="flex items-center gap-2">
								<span className="relative flex size-2.5">
									<motion.span
										className="absolute inset-0 rounded-full bg-emerald-500"
										animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
										transition={{
											duration: 2.2,
											repeat: Infinity,
											ease: "easeInOut",
										}}
									/>
									<span className="relative size-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
								</span>
								<span className="text-4xl font-black tabular-nums text-emerald-500">
									{runningCount}
								</span>
							</div>
							<div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">
								<IconPlayerPlay className="size-3" />
								Running
							</div>
						</motion.button>

						{/* Stopped */}
						<motion.button
							onClick={() => navigate("/accounts")}
							className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/50 hover:border-border py-6 px-4 cursor-pointer transition-all duration-200 hover:shadow-md"
							whileHover={{ scale: 1.02, y: -2 }}
							whileTap={{ scale: 0.97 }}
							transition={{ type: "spring", stiffness: 500, damping: 24 }}
						>
							<div className="flex items-center gap-2">
								<span className="size-2.5 rounded-full bg-muted-foreground/40" />
								<span className="text-4xl font-black tabular-nums text-muted-foreground">
									{stoppedCount}
								</span>
							</div>
							<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70">
								<IconPlayerStop className="size-3" />
								Stopped
							</div>
						</motion.button>

						{/* Actions */}
						<motion.button
							onClick={() => navigate("/actions")}
							className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-500/40 py-6 px-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-sky-500/10"
							whileHover={{ scale: 1.02, y: -2 }}
							whileTap={{ scale: 0.97 }}
							transition={{ type: "spring", stiffness: 500, damping: 24 }}
						>
							<div className="flex items-center gap-2">
								<span className="size-2.5 rounded-full bg-sky-500" />
								<span className="text-4xl font-black tabular-nums text-sky-500">
									{actionsCount}
								</span>
							</div>
							<div className="flex items-center gap-1.5 text-xs font-medium text-sky-600/80 dark:text-sky-400/80">
								<IconBolt className="size-3" />
								Actions
							</div>
						</motion.button>
					</motion.div>

					{/* Nav grid */}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
						{navigationItems.map((item, index) => (
							<motion.button
								key={item.title}
								onClick={() => navigate(item.path)}
								className={`group relative flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-5 text-left cursor-pointer transition-all duration-200 hover:shadow-xl ${item.glow} ${item.border} overflow-hidden`}
								initial={{ opacity: 0, y: 20, scale: 0.97 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{
									type: "spring",
									stiffness: 360,
									damping: 28,
									delay: 0.15 + index * 0.055,
								}}
								whileHover={{
									scale: 1.025,
									y: -3,
									transition: {
										type: "spring",
										stiffness: 520,
										damping: 22,
										mass: 0.4,
									},
								}}
								whileTap={{
									scale: 0.97,
									transition: { type: "spring", stiffness: 700, damping: 30 },
								}}
								style={{ willChange: "transform" }}
							>
								{/* Subtle top-left glow orb on hover */}
								<div
									className={`absolute -top-6 -left-6 size-20 rounded-full opacity-0 group-hover:opacity-100 blur-2xl transition-opacity duration-300 ${item.bg}`}
								/>

								{/* Icon */}
								<div
									className={`relative shrink-0 flex items-center justify-center size-11 rounded-xl transition-all duration-200 ${item.bg} ${item.hoverBg}`}
								>
									<item.icon
										className={`size-5 transition-colors duration-200 ${item.color} group-hover:text-white`}
									/>
								</div>

								{/* Text */}
								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between gap-2 mb-0.5">
										<span className="text-sm font-semibold text-foreground leading-tight group-hover:text-foreground">
											{item.title}
										</span>
										{item.shortcut && (
											<kbd className="hidden md:inline-flex shrink-0 items-center rounded-md border border-border/50 bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50">
												{item.shortcut}
											</kbd>
										)}
									</div>
									<p className="text-xs text-muted-foreground leading-snug">
										{item.description}
									</p>
								</div>

								{/* Arrow */}
								<IconChevronRight className="size-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/70 group-hover:translate-x-0.5 transition-all duration-200" />
							</motion.button>
						))}
					</div>
				</div>
			</main>

			{/* ── Footer ── */}
			<footer className="border-t border-border/40 px-6 py-3 flex items-center justify-between text-[11px] text-muted-foreground/50">
				<span className="inline-flex items-center gap-1.5">
					<WolfIcon size={13} className="text-primary/50" />
					<span>Q Manager</span>
					<span className="font-mono text-muted-foreground/40">v{version}</span>
				</span>
				<span className="inline-flex items-center gap-1">
					<IconBolt className="size-3 text-muted-foreground/40" />
					Werewolf Automation
				</span>
			</footer>
		</div>
	);
}
