import { lazy, Suspense } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { useAccountEvents } from "./hooks/useAccountEvents";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcut";
import { PageLoader } from "./components/PageLoader";
import { PageTransition } from "./components/motion";

// Lazy load all pages for code splitting
const HomePage = lazy(() => import("./pages/HomePage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const AccountEditPage = lazy(() => import("./pages/AccountEditPage"));
const PhaseDetectionPage = lazy(() => import("./pages/PhaseDetectionPage"));
const ActionsPage = lazy(() => import("./pages/ActionsPage"));
const TargetsPage = lazy(() => import("./pages/TargetsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // Subscribe to all backend events (account status, phases, actions, tray commands)
  // This ensures events are handled globally regardless of which page is active
  useAccountEvents();

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    // Go back to home with Escape (if not already on home)
    "escape": () => {
      if (location.pathname !== "/") {
        navigate("/");
      }
    },
    // Quick navigation shortcuts
    "alt+1": () => navigate("/accounts"),
    "alt+2": () => navigate("/phase-detection"),
    "alt+3": () => navigate("/actions"),
    "alt+4": () => navigate("/targets"),
    "alt+5": () => navigate("/settings"),
  });

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence mode="wait">
        <Suspense fallback={<PageLoader />}>
          <PageTransition key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<HomePage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:id/edit" element={<AccountEditPage />} />
              <Route path="/phase-detection" element={<PhaseDetectionPage />} />
              <Route path="/actions" element={<ActionsPage />} />
              <Route path="/targets" element={<TargetsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </PageTransition>
        </Suspense>
      </AnimatePresence>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
