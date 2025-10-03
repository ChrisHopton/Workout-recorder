import { useEffect, useMemo, useState } from 'react';
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

  const profileCount = profiles.length;
  const heroSubtitle = useMemo(() => {
    if (profileCount === 0) {
      return 'Create a profile in the API to start building a plan.';
    }
    if (profileCount === 1) {
      return 'Review your training split and stay consistent this week.';
    }
    return 'Choose whose training to review and jump into the next session.';
  }, [profileCount]);

  useEffect(() => {
    api
      .get<Profile[]>('/api/profiles')
      .then((data) => setProfiles(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="container home">
        <section className="home-hero card">
          <div className="home-hero-copy">
            <p className="eyebrow">Your training HQ</p>
            <h1>Hypertrophy Tracker</h1>
            <p className="home-hero-subtitle">Loading profiles…</p>
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container home">
        <section className="home-hero card">
          <div className="home-hero-copy">
            <p className="eyebrow">Your training HQ</p>
            <h1>Hypertrophy Tracker</h1>
            <p className="home-hero-subtitle">We hit a snag loading your profiles.</p>
          </div>
        </section>
        <div className="home-empty card home-error">
          <h3>Failed to load profiles</h3>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container home">
      <section className="home-hero card">
        <div className="home-hero-copy">
          <p className="eyebrow">Your training HQ</p>
          <h1>Hypertrophy Tracker</h1>
          <p className="home-hero-subtitle">{heroSubtitle}</p>
        </div>
        <div className="home-hero-metrics">
          <div className="home-metric">
            <span className="home-metric-label">Active Profiles</span>
            <strong className="home-metric-value">{profileCount}</strong>
          </div>
          <div className="home-metric">
            <span className="home-metric-label">Sessions Ready</span>
            <strong className="home-metric-value">{profileCount > 0 ? 'Dialed In' : 'Pending'}</strong>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <h2>Switch profiles</h2>
            <p>Select a lifter to review their plan and stats.</p>
          </div>
        </div>
        {profiles.length === 0 ? (
          <div className="home-empty card">
            <h3>No profiles yet</h3>
            <p>Add a profile through the API to populate your dashboard.</p>
          </div>
        ) : (
          <div className="profile-grid">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className="profile-card card"
                onClick={() => navigate(`/p/${profile.id}`)}
                type="button"
              >
                <div className="profile-card-header">
                  <h3>{profile.name}</h3>
                  <span aria-hidden="true" className="profile-card-icon">→</span>
                </div>
                <p className="profile-card-copy">
                  {profile.gender === 'male'
                    ? 'Structured for progressive overload and strength.'
                    : 'Focused on sculpted strength with smart volume.'}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default Home;
