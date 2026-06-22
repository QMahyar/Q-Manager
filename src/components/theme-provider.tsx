import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	useCallback,
} from "react";

import { getSettings, updateSettings } from "@/lib/api";
import type { ThemeMode, ThemePalette, ThemeVariant } from "@/lib/types";

type ThemeProviderProps = {
	children: React.ReactNode;
	defaultTheme?: ThemeMode;
	storageKey?: string;
};

type ThemeProviderState = {
	theme: ThemeMode;
	palette: ThemePalette;
	variant: ThemeVariant;
	/** The resolved actual mode: "light" or "dark" (never "system") */
	resolvedTheme: "light" | "dark";
	setTheme: (theme: ThemeMode) => void;
	setPalette: (palette: ThemePalette) => void;
	setVariant: (variant: ThemeVariant) => void;
};

const initialState: ThemeProviderState = {
	theme: "system",
	palette: "zinc",
	variant: "subtle",
	resolvedTheme: "light",
	setTheme: () => null,
	setPalette: () => null,
	setVariant: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getSystemTheme(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function resolveTheme(theme: ThemeMode): "light" | "dark" {
	return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "q-manager-theme",
	...props
}: ThemeProviderProps) {
	const [theme, setThemeState] = useState<ThemeMode>(
		() => (localStorage.getItem(storageKey) as ThemeMode) || defaultTheme,
	);
	const [palette, setPaletteState] = useState<ThemePalette>("zinc");
	const [variant, setVariantState] = useState<ThemeVariant>("subtle");
	const [isHydrated, setIsHydrated] = useState(false);

	// Load persisted settings from backend on mount
	useEffect(() => {
		let isMounted = true;
		getSettings()
			.then((settings) => {
				if (!isMounted) return;
				const nextTheme = settings.theme_mode ?? defaultTheme;
				const nextPalette = settings.theme_palette ?? "zinc";
				const nextVariant = settings.theme_variant ?? "subtle";
				// Sync localStorage so next cold-start is instant
				localStorage.setItem(storageKey, nextTheme);
				setThemeState(nextTheme);
				setPaletteState(nextPalette);
				setVariantState(nextVariant);
				setIsHydrated(true);
			})
			.catch(() => {
				if (!isMounted) return;
				setIsHydrated(true);
			});
		return () => {
			isMounted = false;
		};
	}, [defaultTheme, storageKey]);

	// Apply theme classes/attributes to <html> whenever they change
	useEffect(() => {
		const root = window.document.documentElement;
		const resolved = resolveTheme(theme);
		root.classList.remove("light", "dark");
		root.classList.add(resolved);
		root.setAttribute("data-theme", palette);
		root.setAttribute("data-variant", variant);
	}, [theme, palette, variant]);

	// Listen for system preference changes when mode is "system"
	useEffect(() => {
		if (theme !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => {
			const root = window.document.documentElement;
			root.classList.remove("light", "dark");
			root.classList.add(e.matches ? "dark" : "light");
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [theme]);

	const setTheme = useCallback(
		(nextTheme: ThemeMode) => {
			setThemeState((current) => {
				if (current === nextTheme) return current;
				localStorage.setItem(storageKey, nextTheme);
				if (isHydrated) {
					updateSettings({ theme_mode: nextTheme }).catch(() => null);
				}
				return nextTheme;
			});
		},
		[isHydrated, storageKey],
	);

	const setPalette = useCallback(
		(nextPalette: ThemePalette) => {
			setPaletteState((current) => {
				if (current === nextPalette) return current;
				localStorage.setItem(`${storageKey}-palette`, nextPalette);
				if (isHydrated) {
					updateSettings({ theme_palette: nextPalette }).catch(() => null);
				}
				return nextPalette;
			});
		},
		[isHydrated, storageKey],
	);

	const setVariant = useCallback(
		(nextVariant: ThemeVariant) => {
			setVariantState((current) => {
				if (current === nextVariant) return current;
				localStorage.setItem(`${storageKey}-variant`, nextVariant);
				if (isHydrated) {
					updateSettings({ theme_variant: nextVariant }).catch(() => null);
				}
				return nextVariant;
			});
		},
		[isHydrated, storageKey],
	);

	const value = useMemo(
		() => ({
			theme,
			palette,
			variant,
			resolvedTheme: resolveTheme(theme),
			setTheme,
			setPalette,
			setVariant,
		}),
		[palette, setTheme, setPalette, setVariant, theme, variant],
	);

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export const useTheme = () => {
	const context = useContext(ThemeProviderContext);
	if (context === undefined)
		throw new Error("useTheme must be used within a ThemeProvider");
	return context;
};
