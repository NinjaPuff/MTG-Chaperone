import { Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { StandingsPage } from './pages/StandingsPage';
import { SchedulePage } from './pages/SchedulePage';
import { CardPoolsPage } from './pages/CardPoolsPage';
import { CardPoolDetailPage } from './pages/CardPoolDetailPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventResultsPage } from './pages/EventResultsPage';
import { DecklistsPage } from './pages/DecklistsPage';
import { DeckBuilderPage } from './pages/DeckBuilderPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { SeasonHistoryPage } from './pages/SeasonHistoryPage';
import { JoinPage } from './pages/JoinPage';
import { ShareDeckPage } from './pages/ShareDeckPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/standings" element={<StandingsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/events/:eventId/results" element={<EventResultsPage />} />
        <Route path="/events/:eventId/build" element={<DeckBuilderPage />} />
        <Route path="/events/:eventId/rounds/:roundId/build" element={<DeckBuilderPage />} />
        <Route path="/pools" element={<CardPoolsPage />} />
        <Route path="/pools/:poolId" element={<CardPoolDetailPage />} />
        <Route path="/decks" element={<DecklistsPage />} />
        <Route path="/share/decks/:token" element={<ShareDeckPage />} />
        <Route path="/share/decks" element={<ShareDeckPage />} />
        <Route path="/history" element={<SeasonHistoryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:slug" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
