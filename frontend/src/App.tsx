// input:  [router primitives, auth/user-preference context, plugin idle-preload controller, global providers, route guards, lazily imported page modules including auth password-reset and the standalone Create Semester wizard, and TanStack Query client provider]
// output: [default `App` component and `RootGate` active-Program-aware root entry resolver]
// pos:    [Root composition module that defines the app route tree, query cache boundary, provider stack, authenticated idle plugin preload wiring, the active-Program root redirect, and the Program-hosted Semester creation wizard route]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Suspense, lazy, useCallback, useEffect, useState, type ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import { RequireAuth } from './components/RequireAuth';
import { PageSkeleton } from './components/PageSkeleton';
import { DialogProvider } from './contexts/DialogContext';
import { AuthRouteLayout } from './components/AuthRouteLayout';
import { Toaster } from "sonner"
import { queryClient } from './services/queryClient';
import { preloadRemainingPluginsWhenIdle } from './plugin-system';
import { OnboardingTour, TOUR_STEP_KEY, type TourStep } from './components/OnboardingTour';
import { getProgramDetailQueryOptions, getProgramSemesterDraftQueryOptions } from './data/resources';

const ProgramsPage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.ProgramsPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({ default: module.RegisterPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(module => ({ default: module.ResetPasswordPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));
const ProgramDashboard = lazy(() => import('./pages/ProgramDashboard').then(module => ({ default: module.ProgramDashboard })));
const ProgramSettingsPage = lazy(() => import('./pages/ProgramSettingsPage').then(module => ({ default: module.ProgramSettingsPage })));
const CreateSemesterWizardPage = lazy(() => import('./pages/CreateSemesterWizardPage').then(module => ({ default: module.CreateSemesterWizardPage })));
const SemesterHomepage = lazy(() => import('./pages/SemesterHomepage').then(module => ({ default: module.SemesterHomepage })));
const CourseHomepage = lazy(() => import('./pages/CourseHomepage').then(module => ({ default: module.CourseHomepage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

/**
 * WizardPrefetchWrapper
 *
 * Sits **outside** the Suspense boundary so it is mounted as soon as the route
 * matches — before the lazy CreateSemesterWizardPage bundle has finished
 * downloading.  It fires prefetch requests for the two synchronous blockers
 * (programQuery + currentDraftQuery) in parallel with the JS download,
 * converting the wizard's 3-RTT serial waterfall into a single true Round-Trip
 * (pluginSystemSetupQuery) by the time the page component mounts.
 */
function WizardPrefetchWrapper({ children }: { children: ReactElement }): ReactElement {
  const { id: programId } = useParams<{ id: string }>();
  const client = useQueryClient();

  useEffect(() => {
    if (!programId) return;
    // Fire-and-forget: errors are swallowed because the page component will
    // re-fetch and surface an error state if either request fails.
    void client.prefetchQuery({
      ...getProgramDetailQueryOptions(programId),
      staleTime: 60_000,
    });
    void client.prefetchQuery({
      ...getProgramSemesterDraftQueryOptions(programId),
      staleTime: 10_000,
    });
  }, [client, programId]);

  return children;
}

function RootGate(): ReactElement {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (user) {
    if (user.active_program_id) {
      return <Navigate to={`/programs/${user.active_program_id}`} replace />;
    }
    return (
      <Suspense fallback={<PageSkeleton />}>
        <ProgramsPage />
      </Suspense>
    );
  }

  return <Navigate to="/login" replace />;
}

function PluginIdlePreloadController(): null {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user || user.background_plugin_preload === false) {
      return;
    }

    return preloadRemainingPluginsWhenIdle();
  }, [isLoading, user, user?.background_plugin_preload]);

  return null;
}

const PROGRAM_DASHBOARD_RE = /^\/programs\/[^/]+$/;

function resolveStepForPath(stored: TourStep, path: string): TourStep | null {
  // Auto-advance: after program creation user lands on /programs/:id
  if (stored === 'highlight-new-program' && PROGRAM_DASHBOARD_RE.test(path)) {
    return 'program-dashboard-tour';
  }

  const validPaths: Record<TourStep, (p: string) => boolean> = {
    'highlight-new-program':   (p) => p === '/programs',
    'program-dashboard-tour':  (p) => PROGRAM_DASHBOARD_RE.test(p),
  };
  return validPaths[stored]?.(path) ? stored : null;
}

function OnboardingController(): ReactElement | null {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [activeTourStep, setActiveTourStep] = useState<TourStep | null>(null);

  useEffect(() => {
    if (isLoading || !user || user.onboarding_completed_at) {
      setActiveTourStep(null);
      return;
    }

    const path = location.pathname;
    const stored = sessionStorage.getItem(TOUR_STEP_KEY) as TourStep | null;

    if (!stored) {
      if (path === '/programs' && !user.active_program_id) {
        sessionStorage.setItem(TOUR_STEP_KEY, 'highlight-new-program');
        setActiveTourStep('highlight-new-program');
      } else {
        setActiveTourStep(null);
      }
      return;
    }

    const resolved = resolveStepForPath(stored, path);
    if (resolved && resolved !== stored) {
      sessionStorage.setItem(TOUR_STEP_KEY, resolved);
    }
    setActiveTourStep(resolved);
  }, [isLoading, user, location.pathname]);

  const handleComplete = useCallback(() => {
    sessionStorage.removeItem(TOUR_STEP_KEY);
    setActiveTourStep(null);
  }, []);

  if (!activeTourStep) return null;
  return (
    <OnboardingTour
      step={activeTourStep}
      onComplete={handleComplete}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
          <AuthProvider>
            <DialogProvider>
              <PluginIdlePreloadController />
              <OnboardingController />
              <Routes>
                <Route element={<AuthRouteLayout />}>
                  <Route path="/login" element={
                    <Suspense fallback={null}>
                      <LoginPage />
                    </Suspense>
                  } />
                  <Route path="/register" element={
                    <Suspense fallback={null}>
                      <RegisterPage />
                    </Suspense>
                  } />
                  <Route path="/reset-password" element={
                    <Suspense fallback={null}>
                      <ResetPasswordPage />
                    </Suspense>
                  } />
                </Route>
                <Route
                  path="/"
                  element={<RootGate />}
                />
                <Route
                  path="/programs"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<PageSkeleton />}>
                        <ProgramsPage />
                      </Suspense>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/landing"
                  element={
                    <Suspense fallback={null}>
                      <LandingPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/programs/:id"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<PageSkeleton />}>
                        <ProgramDashboard />
                      </Suspense>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/programs/:id/settings"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<PageSkeleton />}>
                        <ProgramSettingsPage />
                      </Suspense>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/programs/:id/semesters/create"
                  element={
                    <RequireAuth>
                      <WizardPrefetchWrapper>
                        <Suspense fallback={<PageSkeleton />}>
                          <CreateSemesterWizardPage />
                        </Suspense>
                      </WizardPrefetchWrapper>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/semesters/:id"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<PageSkeleton />}>
                        <SemesterHomepage />
                      </Suspense>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/courses/:id"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<PageSkeleton />}>
                        <CourseHomepage />
                      </Suspense>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <Suspense fallback={<PageSkeleton />}>
                        <SettingsPage />
                      </Suspense>
                    </RequireAuth>
                  }
                />
              </Routes>
              <Toaster />
              <SpeedInsights />
            </DialogProvider>
          </AuthProvider>
        </ThemeProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
