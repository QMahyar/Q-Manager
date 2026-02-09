import { createContext, useContext, useEffect, useState } from "react";

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
  setTheme: (theme: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  setVariant: (variant: ThemeVariant) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  palette: "zinc",
  variant: "subtle",
  setTheme: () => null,
  setPalette: () => null,
  setVariant: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<ThemeMode>(
    () => (localStorage.getItem(storageKey) as ThemeMode) || defaultTheme
  );
  const [palette, setPalette] = useState<ThemePalette>("zinc");
  const [variant, setVariant] = useState<ThemeVariant>("subtle");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getSettings()
      .then((settings) => {
        if (!isMounted) return;
        const nextTheme = settings.theme_mode ?? defaultTheme;
        const nextPalette = settings.theme_palette ?? "zinc";
        const nextVariant = settings.theme_variant ?? "subtle";
        setTheme(nextTheme);
        setPalette(nextPalette);
        setVariant(nextVariant);
        setIsHydrated(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsHydrated(true);
      });
    return () => {
      isMounted = false;
    };
  }, [defaultTheme]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    root.setAttribute("data-theme", palette);
    root.setAttribute("data-variant", variant);
  }, [theme, palette, variant]);

  const value = {
    theme,
    palette,
    variant,
    setTheme: (nextTheme: ThemeMode) => {
      localStorage.setItem(storageKey, nextTheme);
      setTheme(nextTheme);
      if (isHydrated) {
        updateSettings({ theme_mode: nextTheme }).catch(() => null);
      }
    },
    setPalette: (nextPalette: ThemePalette) => {
      setPalette(nextPalette);
      if (isHydrated) {
        updateSettings({ theme_palette: nextPalette }).catch(() => null);
      }
    },
    setVariant: (nextVariant: ThemeVariant) => {
      setVariant(nextVariant);
      if (isHydrated) {
        updateSettings({ theme_variant: nextVariant }).catch(() => null);
      }
    },
  };

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
