// input:  [router primitives, global providers, route guards, lazily imported page modules]
// output: [default `App` component and `RootGate` authenticated/guest entry resolver]
// pos:    [Root composition module that defines the app route tree and provider stack]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import { RequireAuth } from './components/RequireAuth';
import { PageSkeleton } from './components/PageSkeleton';
import { DialogProvider } from './contexts/DialogContext';
import { Toaster } from "sonner"

const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({ default: module.RegisterPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(module => ({ default: module.LandingPage })));
const ProgramDashboard = lazy(() => import('./pages/ProgramDashboard').then(module => ({ default: module.ProgramDashboard })));
const SemesterHomepage = lazy(() => import('./pages/SemesterHomepage').then(module => ({ default: module.SemesterHomepage })));
const CourseHomepage = lazy(() => import('./pages/CourseHomepage').then(module => ({ default: module.CourseHomepage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

const RootGate = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (user) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <HomePage />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <LandingPage />
    </Suspense>
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <DialogProvider>
            <Routes>
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
              <Route
                path="/"
                element={<RootGate />}
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
  );
}

export default App;
