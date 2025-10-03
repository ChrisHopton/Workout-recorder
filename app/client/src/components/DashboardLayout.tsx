import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  showHomeShortcut?: boolean;
}

function DashboardLayout({ title, subtitle, actions, children, showHomeShortcut = true }: DashboardLayoutProps) {
  return (
    <div className="dashboard-shell">
      <nav className="dashboard-topbar">
        <Link to="/" className="brand-link" aria-label="Hypertrophy Tracker home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-text">Hypertrophy Tracker</span>
        </Link>
        {showHomeShortcut && (
          <Link className="nav-shortcut" to="/">
            <span aria-hidden="true">⌂</span>
            <span>Switch Profile</span>
          </Link>
        )}
      </nav>

      <main className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="dashboard-header-actions">{actions}</div>}
        </header>

        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;
