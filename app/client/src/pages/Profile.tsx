import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import WeekGrid, { PlanDay } from '../components/WeekGrid';
import Tabs from '../components/Tabs';
import Charts, { OneRMEntry, OneRMSeriesEntry, WeeklyVolumePoint } from '../components/Charts';
import { api } from '../api/http';
import './Profile.css';

interface PlanResponse {
  days: PlanDay[];
}

interface ProfileInfo {
  id: number;
  name: string;
  gender: string;
}

interface StatsResponse {
  from: string;
  to: string;
  weeklyVolume: WeeklyVolumePoint[];
  oneRMByExercise: OneRMEntry[];
  oneRMSeriesByExercise: OneRMSeriesEntry[];
}

function mondayOfWeek(date: dayjs.Dayjs) {
  const day = date.day();
  if (day === 0) {
    return date.subtract(6, 'day');
  }
  return date.subtract(day - 1, 'day');
}

function Profile() {
  const { profileId } = useParams();
  const [activeTab, setActiveTab] = useState<'plan' | 'stats'>('plan');
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(dayjs()).format('YYYY-MM-DD'));
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [statsRange, setStatsRange] = useState(() => {
    const to = dayjs().format('YYYY-MM-DD');
    const from = mondayOfWeek(dayjs().subtract(11, 'week')).format('YYYY-MM-DD');
    return { from, to };
  });

  useEffect(() => {
    if (!profileId) return;
    api
      .get<ProfileInfo[]>('/api/profiles')
      .then((profiles) => profiles.find((p) => p.id === Number(profileId)))
      .then((found) => setProfile(found ?? null))
      .catch((err) => console.error('Failed to load profile', err));
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    setPlanLoading(true);
    setPlanError(null);
    api
      .get<PlanResponse>(`/api/plan/week?profileId=${profileId}&weekStart=${weekStart}`)
      .then((data) => setPlan(data))
      .catch((err) => setPlanError(err.message))
      .finally(() => setPlanLoading(false));
  }, [profileId, weekStart]);

  useEffect(() => {
    if (!profileId) return;
    setStatsLoading(true);
    setStatsError(null);
    api
      .get<StatsResponse>(`/api/stats/summary?profileId=${profileId}&from=${statsRange.from}&to=${statsRange.to}`)
      .then((data) => setStats(data))
      .catch((err) => setStatsError(err.message))
      .finally(() => setStatsLoading(false));
  }, [profileId, statsRange.from, statsRange.to]);

  const weekLabel = useMemo(() => {
    const start = dayjs(weekStart);
    return `${start.format('MMM D')} - ${start.add(6, 'day').format('MMM D, YYYY')}`;
  }, [weekStart]);

  function shiftWeek(offset: number) {
    setWeekStart((prev) => dayjs(prev).add(offset, 'week').format('YYYY-MM-DD'));
  }

  return (
    <main className="container profile">
      <header className="profile-header">
        <div>
          <h1>Training Overview</h1>
          <p>{profile ? profile.name : `Profile #${profileId}`}</p>
        </div>
        <Link className="primary-button" to={`/p/${profileId}/workout/today`}>
          Start Workout
        </Link>
      </header>

      <Tabs
        tabs={[{ key: 'plan', label: 'Week Plan' }, { key: 'stats', label: 'Stats' }]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'plan' | 'stats')}
      />

      {activeTab === 'plan' ? (
        <section className="plan-section">
          <div className="plan-controls">
            <button type="button" onClick={() => shiftWeek(-1)} className="secondary-button">
              Previous
            </button>
            <h2>{weekLabel}</h2>
            <button type="button" onClick={() => shiftWeek(1)} className="secondary-button">
              Next
            </button>
          </div>
          {planLoading && <p>Loading plan…</p>}
          {planError && <p className="error">{planError}</p>}
          {plan && <WeekGrid weekStart={weekStart} days={plan.days} />}
        </section>
      ) : (
        <section className="stats-section">
          <div className="stats-controls">
            <label>
              From
              <input
                type="date"
                value={statsRange.from}
                onChange={(e) => setStatsRange((prev) => ({ ...prev, from: e.target.value }))}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={statsRange.to}
                onChange={(e) => setStatsRange((prev) => ({ ...prev, to: e.target.value }))}
              />
            </label>
          </div>
          {statsLoading && <p>Loading stats…</p>}
          {statsError && <p className="error">{statsError}</p>}
          {stats && (
            <Charts
              weeklyVolume={stats.weeklyVolume}
              oneRMByExercise={stats.oneRMByExercise}
              oneRMSeriesByExercise={stats.oneRMSeriesByExercise}
            />
          )}
        </section>
      )}
    </main>
  );
}

export default Profile;
