import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/RequireAuth';

// Lazy load page components
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
      <AuthProvider>
        {/* Use null fallback to keep index.html spinner visible during lazy load */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <HomePage />
                </RequireAuth>
              }
            />
            <Route
              path="/programs/:id"
              element={
                <RequireAuth>
                  <ProgramDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/semesters/:id"
              element={
                <RequireAuth>
                  <SemesterHomepage />
                </RequireAuth>
              }
            />
            <Route
              path="/courses/:id"
              element={
                <RequireAuth>
                  <CourseHomepage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />
          </Routes>
        </Suspense>
        <SpeedInsights />
      </AuthProvider>
    </Router>
  );
}

export default App;
