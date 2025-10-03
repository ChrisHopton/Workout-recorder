import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

interface NavLinkConfig {
  to: string;
  label: string;
  end?: boolean;
}

function Layout() {
  const location = useLocation();
  const profileMatch = location.pathname.match(/^\/p\/(\d+)/);
  const profileId = profileMatch ? profileMatch[1] : null;

  const navLinks: NavLinkConfig[] = [
    { to: '/', label: 'Home', end: true }
  ];

  if (profileId) {
    navLinks.push(
      { to: `/p/${profileId}`, label: 'Dashboard', end: true },
      { to: `/p/${profileId}/workout/today`, label: 'Today' }
    );
  }

  return (
    <div className="app-shell">
      <div className="app-sheen" aria-hidden="true" />
      <header className="app-header">
        <NavLink to="/" className="brand" end>
          <span className="brand-mark">HT</span>
          <span className="brand-text">Hypertrophy Tracker</span>
        </NavLink>
        <nav className="app-nav" aria-label="Primary">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;
