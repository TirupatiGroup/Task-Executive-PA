// App routes with auth protection.

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Loader } from '../components/common';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TaskListPage } from '../pages/TaskListPage';
import { TaskDetailPage } from '../pages/TaskDetailPage';
import { PeoplePage } from '../pages/PeoplePage';
import { DeadlinesPage } from '../pages/DeadlinesPage';
import { FollowUpsPage } from '../pages/FollowUpsPage';
import { CalendarPage } from '../pages/CalendarPage';
import { ActivityPage } from '../pages/ActivityPage';
import { SearchPage } from '../pages/SearchPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { AssistantPage } from '../pages/AssistantPage';
import { SettingsPage } from '../pages/SettingsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center"><Loader label="Checking session…" /></div>;
  }
  if (status !== 'signed-in') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TaskListPage mode="personal" />} />
        <Route path="/assigned" element={<TaskListPage mode="assigned" />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/deadlines" element={<DeadlinesPage />} />
        <Route path="/followups" element={<FollowUpsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
