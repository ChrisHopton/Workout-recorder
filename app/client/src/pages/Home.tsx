import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';
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
      <main className="container">
        <p>Loading profiles...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <p className="error">Failed to load profiles: {error}</p>
      </main>
    );
  }

  return (
    <main className="container home">
      <header className="home-header">
        <h1>Hypertrophy Tracker</h1>
        <p>Pick a profile to jump into today&rsquo;s training.</p>
      </header>
      <div className="profile-grid">
        {profiles.map((profile) => (
          <button key={profile.id} className="profile-card card" onClick={() => navigate(`/p/${profile.id}`)} type="button">
            <h2>{profile.name}</h2>
            <p>{profile.gender === 'male' ? 'Built for progressive overload.' : 'Dialed in for sculpted strength.'}</p>
          </button>
        ))}
      </div>
    </main>
  );
}

export default Home;
