import './ExerciseCard.css';

export interface SetEntry {
  id: number;
  setNumber: number;
  actualReps: number | null;
  actualWeight: number | null;
}

export interface SessionExercise {
  id: number;
  exerciseName: string;
  targetSets: number;
  repLow: number;
  repHigh: number;
  targetWeight: number | null;
  skipped: number;
  sets: SetEntry[];
}

interface ExerciseCardProps {
  exercise: SessionExercise;
  locked: boolean;
  onSetChange: (setId: number, payload: { actual_reps: number | null; actual_weight: number | null }) => void;
  onSkip: (exerciseId: number) => void;
  onSave: (exerciseId: number) => void;
  onEdit: (exerciseId: number) => void;
}

export function ExerciseCard({ exercise, locked, onSetChange, onSkip, onSave, onEdit }: ExerciseCardProps) {
  const disabled = exercise.skipped === 1 || locked;
  const target = `${exercise.targetSets} × ${exercise.repLow}-${exercise.repHigh}`;

  return (
    <div className={`exercise-card card ${disabled ? 'exercise-card--disabled' : ''}`}>
      <div className="exercise-card-header">
        <div>
          <h2>{exercise.exerciseName}</h2>
          <p className="exercise-target">
            {target} {exercise.targetWeight ? `@ ${exercise.targetWeight} lb` : ''}
          </p>
        </div>
        <div className="exercise-card-actions">
          {disabled ? (
            <button className="secondary-button" type="button" onClick={() => onEdit(exercise.id)}>
              Edit
            </button>
          ) : (
            <>
              <button className="secondary-button" type="button" onClick={() => onSkip(exercise.id)}>
                Skip Exercise
              </button>
              <button className="primary-button" type="button" onClick={() => onSave(exercise.id)}>
                Save
              </button>
            </>
          )}
        </div>
      </div>
      <div className="exercise-set-list">
        {exercise.sets.map((set) => (
          <div key={set.id} className="exercise-set-row">
            <div className="set-label">Set {set.setNumber}</div>
            <div className="set-inputs">
              <label>
                Reps
                <input
                  type="number"
                  min={0}
                  value={set.actualReps ?? ''}
                  onChange={(e) =>
                    onSetChange(set.id, {
                      actual_reps: e.target.value === '' ? null : Number(e.target.value),
                      actual_weight: set.actualWeight
                    })
                  }
                  disabled={disabled}
                />
              </label>
              <label>
                Weight (lb)
                <input
                  type="number"
                  min={0}
                  value={set.actualWeight ?? ''}
                  onChange={(e) =>
                    onSetChange(set.id, {
                      actual_reps: set.actualReps,
                      actual_weight: e.target.value === '' ? null : Number(e.target.value)
                    })
                  }
                  disabled={disabled}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ExerciseCard;
