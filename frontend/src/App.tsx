import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import { RequireAuth } from './components/RequireAuth';
import { PageSkeleton } from './components/PageSkeleton';
import { DialogProvider } from './contexts/DialogContext';
import { Toaster } from "sonner"

const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({ default: module.RegisterPage })));
const ProgramDashboard = lazy(() => import('./pages/ProgramDashboard').then(module => ({ default: module.ProgramDashboard })));
const SemesterHomepage = lazy(() => import('./pages/SemesterHomepage').then(module => ({ default: module.SemesterHomepage })));
const CourseHomepage = lazy(() => import('./pages/CourseHomepage').then(module => ({ default: module.CourseHomepage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

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
                element={
                  <RequireAuth>
                    <Suspense fallback={<PageSkeleton />}>
                      <HomePage />
                    </Suspense>
                  </RequireAuth>
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
