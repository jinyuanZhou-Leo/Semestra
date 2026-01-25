import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/RequireAuth';
import Loading from './components/Loading';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(module => ({ default: module.RegisterPage })));
const ProgramDashboard = lazy(() => import('./pages/ProgramDashboard').then(module => ({ default: module.ProgramDashboard })));
const SemesterDashboard = lazy(() => import('./pages/SemesterDashboard').then(module => ({ default: module.SemesterDashboard })));
const CourseDashboard = lazy(() => import('./pages/CourseDashboard').then(module => ({ default: module.CourseDashboard })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(module => ({ default: module.SettingsPage })));

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
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
                  <SemesterDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/courses/:id"
              element={
                <RequireAuth>
                  <CourseDashboard />
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
      </AuthProvider>
    </Router>
  );
}

export default App;
