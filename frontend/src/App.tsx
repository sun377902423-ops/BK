import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Studies from './pages/Studies';
import Consultations from './pages/Consultations';
import Users from './pages/Users';
import Hospitals from './pages/Hospitals';
import Reports from './pages/Reports';
import AccessRequests from './pages/AccessRequests';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text={t('common.loading')} />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/studies" element={<Studies />} />
        <Route path="/consultations" element={<Consultations />} />
        <Route path="/users" element={<Users />} />
        <Route path="/hospitals" element={<Hospitals />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/access-requests" element={<AccessRequests />} />
      </Route>
    </Routes>
  );
};

export default App;
