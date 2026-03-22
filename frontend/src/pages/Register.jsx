import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        if (password.length < 6) return setError('Password must be at least 6 characters');
        setLoading(true);
        try {
            await register(username, email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card-titlebar">
                    <div>
                        <div className="auth-card-title">⚡ CollabHere</div>
                        <div className="auth-subtitle">Create a new account</div>
                    </div>
                    <div className="window-titlebar-dots">
                        <div className="window-dot window-dot-close" />
                        <div className="window-dot window-dot-min" />
                        <div className="window-dot window-dot-max" />
                    </div>
                </div>

                <div className="auth-card-body">
                    <form className="auth-form" onSubmit={handleSubmit}>
                        {error && <div className="auth-error">{error}</div>}

                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input
                                id="reg-username"
                                className="form-input"
                                type="text"
                                placeholder="min. 3 characters"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                minLength={3}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                id="reg-email"
                                className="form-input"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                id="reg-password"
                                className="form-input"
                                type="password"
                                placeholder="min. 6 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>

                        <button
                            id="reg-submit"
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                            disabled={loading}
                        >
                            {loading
                                ? <><div className="spinner spinner-sm" /> Creating...</>
                                : 'Create Account →'
                            }
                        </button>
                    </form>

                    <div className="auth-switch">
                        Already registered?{' '}
                        <Link to="/login">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
