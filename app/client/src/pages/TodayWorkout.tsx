import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import ExerciseCard, { SessionExercise } from '../components/ExerciseCard';
import DashboardLayout from '../components/DashboardLayout';
import { api } from '../api/http';
import './TodayWorkout.css';

interface SessionResponse {
  id: number;
  profileId: number;
  sessionDate: string;
  status: string;
  exercises: SessionExercise[];
  note?: string | null;
}

function TodayWorkout() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!profileId) return;
    const today = dayjs().format('YYYY-MM-DD');
    setLoading(true);
    setError(null);
    api
      .post<SessionResponse>(`/api/sessions/start?profileId=${profileId}&date=${today}`)
      .then((data) => {
        setSession(data);
        setNote(data.note ?? '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profileId]);

  const refreshSet = (setId: number, payload: { actual_reps: number | null; actual_weight: number | null }) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        exercises: prev.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => (set.id === setId ? { ...set, actualReps: payload.actual_reps, actualWeight: payload.actual_weight } : set))
        }))
      };
      return updated;
    });
  };

  const handleSetChange = async (
    setId: number,
    payload: { actual_reps: number | null; actual_weight: number | null }
  ) => {
    refreshSet(setId, payload);
    try {
      await api.put(`/api/set-entries/${setId}`, payload);
    } catch (err) {
      console.error(err);
      setError('Failed to save set.');
    }
  };

  const handleSkipExercise = async (exerciseId: number) => {
    try {
      await api.patch(`/api/session-exercises/${exerciseId}/skip`);
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((exercise) =>
            exercise.id === exerciseId
              ? {
                  ...exercise,
                  skipped: 1,
                  sets: exercise.sets.map((set) => ({ ...set, actualReps: null, actualWeight: null }))
                }
              : exercise
          )
        };
      });
    } catch (err) {
      console.error(err);
      setError('Failed to skip exercise.');
    }
  };

  const handleComplete = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      await api.post(`/api/sessions/${session.id}/complete`, { note });
      navigate(`/p/${session.profileId}`);
    } catch (err) {
      console.error(err);
      setError('Could not complete session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipDay = async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      await api.post(`/api/sessions/${session.id}/skip-day`);
      navigate(`/p/${session.profileId}`);
    } catch (err) {
      console.error(err);
      setError('Could not skip day.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Loading today&rsquo;s session"
        subtitle="Gathering your exercises and sets."
      >
        <section className="status-card">
          <p>Loading today&rsquo;s session…</p>
        </section>
      </DashboardLayout>
    );
  }

  if (error && !session) {
    return (
      <DashboardLayout title="We hit a snag" subtitle="We couldn&rsquo;t open today&rsquo;s session just yet.">
        <section className="status-card">
          <p className="error">{error}</p>
        </section>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout title="No session found" subtitle="There isn&rsquo;t anything on the board for today.">
        <section className="status-card">
          <p>No session found.</p>
        </section>
      </DashboardLayout>
    );
  }

  const sessionDate = dayjs(session.sessionDate).format('dddd, MMMM D');

  return (
    <DashboardLayout
      title="Today&rsquo;s Workout"
      subtitle={sessionDate}
      actions={
        <div className="today-actions">
          <button type="button" className="secondary-button" onClick={handleSkipDay} disabled={submitting}>
            Skip Today
          </button>
          <button type="button" className="primary-button" onClick={handleComplete} disabled={submitting}>
            Complete Session
          </button>
        </div>
      }
    >
      {error && <p className="error-banner">{error}</p>}

      <section className="today-board">
        {session.exercises.length === 0 ? (
          <div className="rest-card">
            <h2>Rest day!</h2>
            <p>Nothing on deck. Take the win and recover.</p>
          </div>
        ) : (
          <div className="exercise-list">
            {session.exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onSetChange={handleSetChange}
                onSkip={handleSkipExercise}
              />
            ))}
          </div>
        )}
      </section>

      <section className="session-note-panel">
        <div className="session-note">
          <label htmlFor="session-note">Session Notes</label>
          <textarea
            id="session-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How did it go?"
          />
        </div>
      </section>
    </DashboardLayout>
  );
}

export default TodayWorkout;
