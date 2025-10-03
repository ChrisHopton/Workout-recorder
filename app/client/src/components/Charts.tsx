import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import './Charts.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export interface WeeklyVolumePoint {
  weekStartISO: string | null;
  totalVolume: number;
}

export interface OneRMEntry {
  exerciseId: number;
  exerciseName: string;
  best1RM: number | null;
}

export interface OneRMSeriesEntry {
  exerciseId: number;
  exerciseName: string;
  points: { date: string | null; est1RM: number | null }[];
}

interface ChartsProps {
  weeklyVolume: WeeklyVolumePoint[];
  oneRMByExercise: OneRMEntry[];
  oneRMSeriesByExercise: OneRMSeriesEntry[];
}

function palette(index: number) {
  const colors = ['#2563eb', '#7c3aed', '#10b981', '#f97316'];
  return colors[index % colors.length];
}

export function Charts({ weeklyVolume, oneRMByExercise, oneRMSeriesByExercise }: ChartsProps) {
  const volumeData = {
    labels: weeklyVolume.map((point) => point.weekStartISO ?? ''),
    datasets: [
      {
        label: 'Weekly Volume (lbs)',
        data: weeklyVolume.map((point) => point.totalVolume),
        fill: false,
        borderColor: '#2563eb',
        tension: 0.2
      }
    ]
  };

  const volumeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: 'Weekly Volume'
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 12
        }
      }
    }
  };

  const oneRmDatasets = oneRMSeriesByExercise.map((series, idx) => ({
    label: series.exerciseName,
    data: series.points.map((point) => point.est1RM ?? 0),
    borderColor: palette(idx),
    tension: 0.25
  }));

  const oneRmLabels =
    oneRMSeriesByExercise[0]?.points.map((point) => point.date ?? '') ?? weeklyVolume.map((point) => point.weekStartISO ?? '');

  const oneRmData = {
    labels: oneRmLabels,
    datasets: oneRmDatasets
  };

  const oneRmOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const
      },
      title: {
        display: true,
        text: 'Estimated 1RM Trends'
      }
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 12
        }
      }
    }
  };

  const volumeWidth = Math.max(weeklyVolume.length, 4) * 90;
  const oneRmWidth = Math.max(oneRmLabels.length, 4) * 90;

  return (
    <div className="charts">
      <div className="chart-card card">
        {weeklyVolume.length ? (
          <div className="chart-wrapper" style={{ minWidth: `${volumeWidth}px` }}>
            <Line data={volumeData} options={volumeOptions} />
          </div>
        ) : (
          <p>No completed sessions yet.</p>
        )}
      </div>

      <div className="pr-grid">
        {oneRMByExercise.map((entry) => (
          <div key={entry.exerciseId} className="pr-card card">
            <h4>{entry.exerciseName}</h4>
            <p>{entry.best1RM ? `${entry.best1RM.toFixed(1)} lb` : 'No data'}</p>
          </div>
        ))}
      </div>

      <div className="chart-card card">
        {oneRMSeriesByExercise.length ? (
          <div className="chart-wrapper" style={{ minWidth: `${oneRmWidth}px` }}>
            <Line data={oneRmData} options={oneRmOptions} />
          </div>
        ) : (
          <p>Lift history coming soon.</p>
        )}
      </div>
    </div>
  );
}

export default Charts;
