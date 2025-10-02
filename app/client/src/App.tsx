import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Profile from './pages/Profile';
import TodayWorkout from './pages/TodayWorkout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:profileId" element={<Profile />} />
      <Route path="/p/:profileId/workout/today" element={<TodayWorkout />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
