import dayjs from 'dayjs';
import './WeekGrid.css';

export interface PlanExercise {
  name: string;
  set_count: number;
  rep_low: number;
  rep_high: number;
  target_weight: number | null;
}

export interface PlanDay {
  dayOfWeek: number;
  label: string;
  title: string;
  exercises: PlanExercise[];
}

interface WeekGridProps {
  weekStart: string;
  days: PlanDay[];
}

function formatTarget(exercise: PlanExercise) {
  const repRange = `${exercise.rep_low}-${exercise.rep_high}`;
  const sets = `${exercise.set_count} × ${repRange}`;
  if (exercise.target_weight !== null && exercise.target_weight !== 0) {
    return `${sets} @ ${exercise.target_weight} lb`;
  }
  return sets;
}

export function WeekGrid({ weekStart, days }: WeekGridProps) {
  const start = dayjs(weekStart);
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((dow) => days.find((d) => d.dayOfWeek === dow));

  return (
    <div className="week-grid">
      {ordered.map((day, idx) => {
        const date = start.add(idx, 'day');
        return (
          <div key={idx} className="week-grid-cell card">
            <h3>{date.format('ddd MMM D')}</h3>
            <p className="week-grid-title">{day?.title ?? 'Rest'}</p>
            <div className="week-grid-body">
              {day?.exercises && day.exercises.length > 0 ? (
                <ul>
                  {day.exercises.map((exercise) => (
                    <li key={exercise.name}>
                      <span className="exercise-name">{exercise.name}</span>
                      <span className="exercise-meta">{formatTarget(exercise)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rest-day">Rest / Recovery</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WeekGrid;
