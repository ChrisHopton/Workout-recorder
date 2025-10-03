import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import ExerciseCard, { SessionExercise } from '../components/ExerciseCard';
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
  const { profileId, sessionDate } = useParams<{ profileId: string; sessionDate?: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [lockedExercises, setLockedExercises] = useState<Set<number>>(() => new Set());

  const fallbackToday = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  useEffect(() => {
    if (!profileId) return;
    const dateToLoad = sessionDate ?? fallbackToday;
    if (sessionDate && !dayjs(sessionDate, 'YYYY-MM-DD', true).isValid()) {
      setError('Invalid date supplied.');
      setSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .post<SessionResponse>(`/api/sessions/start?profileId=${profileId}&date=${dateToLoad}`)
      .then((data) => {
        setSession(data);
        setNote(data.note ?? '');
        setLockedExercises(() => {
          const next = new Set<number>();
          data.exercises.forEach((exercise) => {
            if (exercise.skipped === 1) {
              next.add(exercise.id);
            }
          });
          return next;
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [profileId, sessionDate, fallbackToday]);

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

  const handleSaveExercise = (exerciseId: number) => {
    setLockedExercises((prev) => {
      const next = new Set(prev);
      next.add(exerciseId);
      return next;
    });
  };

  const handleEditExercise = async (exerciseId: number) => {
    const wasSkipped = session?.exercises.find((exercise) => exercise.id === exerciseId)?.skipped === 1;
    setLockedExercises((prev) => {
      const next = new Set(prev);
      next.delete(exerciseId);
      return next;
    });
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((exercise) =>
          exercise.id === exerciseId ? { ...exercise, skipped: 0 } : exercise
        )
      };
    });

    if (wasSkipped) {
      try {
        await api.patch(`/api/session-exercises/${exerciseId}/unskip`);
      } catch (err) {
        console.error(err);
        setError('Failed to restore exercise.');
      }
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
      <main className="container">
        <p>Loading today&rsquo;s session…</p>
      </main>
    );
  }

  if (error && !session) {
    return (
      <main className="container">
        <p className="error">{error}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="container">
        <p>No session found.</p>
      </main>
    );
  }

  const sessionDay = dayjs(session.sessionDate);
  const isToday = sessionDay.isSame(dayjs(), 'day');
  const heroEyebrow = isToday ? "Today’s focus" : 'Session editor';
  const heroTitle = isToday ? "Today’s Workout" : `Workout for ${sessionDay.format('MMMM D')}`;
  const heroSubtitle = isToday
    ? sessionDay.format('dddd, MMMM D')
    : `Editing ${sessionDay.format('dddd, MMMM D')}`;
  const skipLabel = isToday ? 'Skip Today' : 'Skip This Day';

  return (
    <main className="container today">
      <section className="today-hero card">
        <div className="today-hero-text">
          <p className="eyebrow">{heroEyebrow}</p>
          <h1>{heroTitle}</h1>
          <p className="today-hero-subtitle">{heroSubtitle}</p>
        </div>
        <div className="today-actions">
          <button type="button" className="secondary-button" onClick={handleSkipDay} disabled={submitting}>
            {skipLabel}
          </button>
          <button type="button" className="primary-button" onClick={handleComplete} disabled={submitting}>
            Complete Session
          </button>
        </div>
      </section>

      {error && <div className="today-error card">{error}</div>}

      <section className="exercise-section">
        <h2>Workout block</h2>
        <div className="exercise-list">
          {session.exercises.length === 0 ? (
            <div className="exercise-empty card">Rest day! Nothing scheduled.</div>
          ) : (
            session.exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                locked={lockedExercises.has(exercise.id)}
                onSetChange={handleSetChange}
                onSkip={handleSkipExercise}
                onSave={handleSaveExercise}
                onEdit={handleEditExercise}
              />
            ))
          )}
        </div>
      </section>

      <section className="session-note card">
        <label>
          Session Notes
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="How did it go?" />
        </label>
      </section>
    </main>
  );
}

export default TodayWorkout;
