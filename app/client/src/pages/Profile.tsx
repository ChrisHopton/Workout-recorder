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

  const orderedPlanDays = useMemo(() => {
    if (!plan) return [] as PlanDay[];
    return [1, 2, 3, 4, 5, 6, 0]
      .map((dow) => plan.days.find((d) => d.dayOfWeek === dow))
      .filter((day): day is PlanDay => Boolean(day));
  }, [plan]);

  const activeTrainingDays = useMemo(() => {
    if (!plan) return 0;
    return plan.days.filter((day) => day.exercises.length > 0).length;
  }, [plan]);

  const totalPlannedExercises = useMemo(() => {
    if (!plan) return 0;
    return plan.days.reduce((count, day) => count + day.exercises.length, 0);
  }, [plan]);

  const nextFocus = useMemo(() => {
    const nextDay = orderedPlanDays.find((day) => day.exercises.length > 0);
    return nextDay ? nextDay.title : 'Recovery Day';
  }, [orderedPlanDays]);

  const statsWindow = useMemo(() => {
    const from = dayjs(statsRange.from);
    const to = dayjs(statsRange.to);
    return `${from.format('MMM D, YYYY')} – ${to.format('MMM D, YYYY')}`;
  }, [statsRange.from, statsRange.to]);

  const activeDaysValue = planLoading ? '…' : plan ? activeTrainingDays : '—';
  const plannedExercisesValue = planLoading ? '…' : plan ? totalPlannedExercises : '—';
  const nextFocusValue = planLoading ? 'Loading…' : plan ? nextFocus : planError ? 'Load failed' : 'Recovery Day';

  function shiftWeek(offset: number) {
    setWeekStart((prev) => dayjs(prev).add(offset, 'week').format('YYYY-MM-DD'));
  }

  return (
    <main className="container profile">
      <section className="profile-hero card">
        <div className="profile-hero-main">
          <div>
            <p className="eyebrow">Training dashboard</p>
            <h1>{profile ? profile.name : `Profile #${profileId}`}</h1>
            <p className="profile-hero-subtitle">Current training week · {weekLabel}</p>
          </div>
          <Link className="primary-button" to={`/p/${profileId}/workout/today`}>
            Start Workout
          </Link>
        </div>
        <div className="profile-hero-metrics">
          <div className="profile-metric">
            <span className="profile-metric-label">Active days</span>
            <span className="profile-metric-value">{activeDaysValue}</span>
          </div>
          <div className="profile-metric">
            <span className="profile-metric-label">Planned exercises</span>
            <span className="profile-metric-value">{plannedExercisesValue}</span>
          </div>
          <div className="profile-metric">
            <span className="profile-metric-label">Next focus</span>
            <span className="profile-metric-value profile-metric-value--text">{nextFocusValue}</span>
          </div>
        </div>
      </section>

      <Tabs
        tabs={[{ key: 'plan', label: 'Week Plan' }, { key: 'stats', label: 'Stats' }]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'plan' | 'stats')}
      />

      {activeTab === 'plan' ? (
        <section className="profile-panel card plan-section">
          <div className="panel-header">
            <div>
              <h2>Weekly split</h2>
              <p className="panel-description">Preview the work for this training block.</p>
            </div>
            <div className="plan-nav" aria-label="Change week">
              <button type="button" onClick={() => shiftWeek(-1)} className="secondary-button plan-nav-button">
                ← Previous
              </button>
              <span className="plan-nav-label">{weekLabel}</span>
              <button type="button" onClick={() => shiftWeek(1)} className="secondary-button plan-nav-button">
                Next →
              </button>
            </div>
          </div>
          <div className="panel-body">
            {planLoading && <p>Loading plan…</p>}
            {planError && <p className="error">{planError}</p>}
            {plan && <WeekGrid weekStart={weekStart} days={plan.days} />}
          </div>
        </section>
      ) : (
        <section className="profile-panel card stats-section">
          <div className="panel-header">
            <div>
              <h2>Progress trends</h2>
              <p className="panel-description">Visualise volume and strength between {statsWindow}.</p>
            </div>
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
          </div>
          <div className="panel-body">
            {statsLoading && <p>Loading stats…</p>}
            {statsError && <p className="error">{statsError}</p>}
            {stats && (
              <Charts
                weeklyVolume={stats.weeklyVolume}
                oneRMByExercise={stats.oneRMByExercise}
                oneRMSeriesByExercise={stats.oneRMSeriesByExercise}
              />
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default Profile;
