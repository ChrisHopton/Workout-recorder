import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import DashboardLayout from '../components/DashboardLayout';
import './Home.css';

interface Profile {
  id: number;
  name: string;
  gender: string;
}

function Home() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Profile[]>('/api/profiles')
      .then((data) => setProfiles(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <DashboardLayout title="Syncing profiles" subtitle="Hang tight while we load everyone up." showHomeShortcut={false}>
        <section className="status-card">
          <p>Loading profiles...</p>
        </section>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="We hit a snag" subtitle="We couldn&rsquo;t reach the profile list just yet." showHomeShortcut={false}>
        <section className="status-card">
          <p className="error">Failed to load profiles: {error}</p>
        </section>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Choose your athlete"
      subtitle="Pick who you want to train with to open their personalized dashboard."
      showHomeShortcut={false}
    >
      <section className="home-panel">
        <div className="home-panel-header">
          <div>
            <h2 className="home-panel-title">Profiles</h2>
            <p className="home-panel-subtitle">Tap a card to jump into their training space.</p>
          </div>
        </div>
        <div className="profile-grid">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className="profile-card"
              onClick={() => navigate(`/p/${profile.id}`)}
              type="button"
            >
              <span className="profile-card-kicker">{profile.gender === 'male' ? 'Strength' : 'Sculpt'}</span>
              <h3>{profile.name}</h3>
              <p>{profile.gender === 'male' ? 'Built for progressive overload.' : 'Dialed in for sculpted strength.'}</p>
            </button>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}

export default Home;
