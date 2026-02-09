import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { 
  IconUsers, 
  IconListCheck, 
  IconHandClick, 
  IconTarget, 
  IconSettings,
  IconSun,
  IconMoon
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "@/components/theme-provider";
import { getVersion } from "@tauri-apps/api/app";
import { checkSystem } from "@/lib/api";
import type { StartupCheckError } from "@/lib/types";
import { WolfLogo } from "@/components/WolfLogo";

// Motion-enhanced Card
const MotionCard = motion.create(Card);

const navigationItems = [
  {
    title: "Accounts",
    description: "Manage Telegram accounts and sessions",
    icon: IconUsers,
    path: "/accounts",
  },
  {
    title: "Phase Detection",
    description: "Configure game phase patterns",
    icon: IconListCheck,
    path: "/phase-detection",
  },
  {
    title: "Actions",
    description: "Define action triggers and button types",
    icon: IconHandClick,
    path: "/actions",
  },
  {
    title: "Targets",
    description: "Set per-account targeting rules",
    icon: IconTarget,
    path: "/targets",
  },
  {
    title: "Settings",
    description: "Global configuration and defaults",
    icon: IconSettings,
    path: "/settings",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [version, setVersion] = useState<string>("0.1.0");
  const [systemWarnings, setSystemWarnings] = useState<StartupCheckError[]>([]);
  const [showSystemBanner, setShowSystemBanner] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("0.1.0"));
  }, []);

  // Run system checks on startup (non-blocking)
  useEffect(() => {
    checkSystem()
      .then((result) => {
        const warnings = result.errors.filter((e) => !e.is_blocking);
        if (warnings.length > 0) {
          setSystemWarnings(warnings);
          setShowSystemBanner(true);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/70 bg-background/80 backdrop-blur px-6 py-4 flex flex-col gap-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WolfLogo size={48} animate={true} />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Q Manager</h1>
              <p className="text-sm text-muted-foreground">Werewolf Game Automation</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
          </Button>
        </div>

        {showSystemBanner && systemWarnings.length > 0 && (
          <div className="border border-warning/30 bg-warning/10 rounded-md p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-sm text-warning">
                  Configuration Recommended
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                  {systemWarnings.map((w, i) => (
                    <li key={i} className="whitespace-pre-wrap">
                      {w.message}
                      {w.details ? ` — ${w.details}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>Open Settings</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSystemBanner(false)}>Dismiss</Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
          <div className="lg:col-span-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/70 p-4 shadow-sm">
            <div>
              <p className="text-sm uppercase tracking-wide text-muted-foreground">Quick stats</p>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500"></span>
                  Running accounts: <strong>See Accounts page</strong>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-slate-400"></span>
                  Stopped accounts: <strong>See Accounts page</strong>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-sky-500"></span>
                  Actions configured: <strong>See Actions page</strong>
                </span>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate("/accounts")} className="font-medium">
              Open Accounts
            </Button>
          </div>
          {navigationItems.map((item, index) => (
            <MotionCard
              key={item.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: index * 0.08,
                ease: "easeOut",
              }}
              whileHover={{ 
                scale: 1.03, 
                y: -4,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.98 }}
              className="group cursor-pointer hover:shadow-lg hover:border-primary/50"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <motion.div 
                  className="p-4 rounded-full bg-primary/10"
                  whileHover={{ 
                    scale: 1.1,
                    backgroundColor: "var(--primary)",
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <item.icon className="h-8 w-8 text-primary group-hover:text-primary-foreground" />
                </motion.div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {item.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>
                </div>
              </CardContent>
            </MotionCard>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3 text-center text-sm text-muted-foreground">
        Q Manager v{version}
      </footer>
    </div>
  );
}
