import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { StandingsPage } from './pages/StandingsPage';
import { SchedulePage } from './pages/SchedulePage';
import { CardPoolsPage } from './pages/CardPoolsPage';
import { DecklistsPage } from './pages/DecklistsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { JoinPage } from './pages/JoinPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/pools" element={<CardPoolsPage />} />
        <Route path="/decks" element={<DecklistsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:slug" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
