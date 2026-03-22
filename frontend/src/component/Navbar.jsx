import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar({ workspaceName }) {
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate('/login');
    }

    // Defensively get the initials from real user data
    const initials = user?.username
        ? user.username.slice(0, 2).toUpperCase()
        : user?.email
        ? user.email.slice(0, 2).toUpperCase()
        : '??';

    return (
        <nav className="navbar">
            <Link to="/dashboard" className="navbar-brand">
                ⚡ CollabHere
            </Link>

            {workspaceName && (
                <>
                    <span className="navbar-sep">/</span>
                    <span className="navbar-breadcrumb">{workspaceName}</span>
                </>
            )}

            <div className="navbar-spacer" />

            <div className="navbar-user">
                <button
                    className="theme-toggle"
                    onClick={toggle}
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? '🌙' : '☀️'}
                </button>

                <div
                    className="avatar avatar-sm"
                    style={{ background: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.5)' }}
                >
                    {initials}
                </div>

                <span>{user?.username || user?.email || ''}</span>

                <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="btn btn-sm"
                >
                    Sign Out
                </button>
            </div>
        </nav>
    );
}
