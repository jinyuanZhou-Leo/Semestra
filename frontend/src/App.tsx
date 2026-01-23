import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProgramDashboard } from './pages/ProgramDashboard';
import { SemesterDashboard } from './pages/SemesterDashboard';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth } from './components/RequireAuth';

import { CourseDashboard } from './pages/CourseDashboard';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <Router>
      <AuthProvider>
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
      </AuthProvider>
    </Router>
  );
}

export default App;
