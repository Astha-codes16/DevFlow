import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import AppLayout from './layouts/AppLayout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import KanbanBoardPage from './pages/KanbanBoardPage';
import IssuesListPage from './pages/IssuesListPage';
import IssueDetailPage from './pages/IssueDetailPage';
import ProjectSettingsPage from './pages/ProjectSettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import GitHubProjectPage from './pages/GitHubProjectPage';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center text-slate-400">
        Loading DevFlow...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected application routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:id" element={<ProjectSettingsPage />} />
              <Route path="projects/:id/board" element={<KanbanBoardPage />} />
              <Route path="projects/:id/issues" element={<IssuesListPage />} />
              <Route path="projects/:id/analytics" element={<AnalyticsPage />} />
              <Route path="projects/:id/github" element={<GitHubProjectPage />} />
              <Route path="issues/:id" element={<IssueDetailPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
