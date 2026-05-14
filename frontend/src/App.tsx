import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './hooks/useAuth';
import { PERMISSIONS } from './lib/permissions';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Studies from './pages/Studies';
import Consultations from './pages/Consultations';
import ConsultationDetail from './pages/ConsultationDetail';
import Users from './pages/Users';
import Hospitals from './pages/Hospitals';
import Reports from './pages/Reports';
import AccessRequests from './pages/AccessRequests';
import Roles from './pages/Roles';
import SystemLogs from './pages/SystemLogs';
import ImagingDevices from './pages/ImagingDevices';
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

const AuthorizedRoute: React.FC<{ children: React.ReactNode; permissions: string[] }> = ({ children, permissions }) => {
  const { hasAnyPermission } = useAuth();
  if (!hasAnyPermission(...permissions)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="/patients" element={<AuthorizedRoute permissions={[PERMISSIONS.PATIENT_LIST]}><Patients /></AuthorizedRoute>} />
        <Route path="/patients/:id" element={<AuthorizedRoute permissions={[PERMISSIONS.PATIENT_READ]}><PatientDetail /></AuthorizedRoute>} />
        <Route path="/studies" element={<AuthorizedRoute permissions={[PERMISSIONS.STUDY_LIST]}><Studies /></AuthorizedRoute>} />
        <Route path="/consultations" element={<AuthorizedRoute permissions={[PERMISSIONS.CONSULTATION_LIST]}><Consultations /></AuthorizedRoute>} />
        <Route path="/consultations/:id" element={<AuthorizedRoute permissions={[PERMISSIONS.CONSULTATION_LIST]}><ConsultationDetail /></AuthorizedRoute>} />
        <Route path="/users" element={<AuthorizedRoute permissions={[PERMISSIONS.USER_LIST]}><Users /></AuthorizedRoute>} />
        <Route path="/hospitals" element={<AuthorizedRoute permissions={[PERMISSIONS.HOSPITAL_LIST]}><Hospitals /></AuthorizedRoute>} />
        <Route path="/reports" element={<AuthorizedRoute permissions={[PERMISSIONS.REPORT_LIST]}><Reports /></AuthorizedRoute>} />
        <Route path="/access-requests" element={<AuthorizedRoute permissions={[PERMISSIONS.ACCESS_REQUEST_LIST]}><AccessRequests /></AuthorizedRoute>} />
        <Route path="/roles" element={<AuthorizedRoute permissions={[PERMISSIONS.USER_ASSIGN_ROLE]}><Roles /></AuthorizedRoute>} />
        <Route path="/system-logs" element={<AuthorizedRoute permissions={[PERMISSIONS.SYSTEM_AUDIT]}><SystemLogs /></AuthorizedRoute>} />
        <Route path="/devices" element={<AuthorizedRoute permissions={[PERMISSIONS.DEVICE_LIST]}><ImagingDevices /></AuthorizedRoute>} />
      </Route>
    </Routes>
  );
};

export default App;
