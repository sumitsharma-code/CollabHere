import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword]     = useState('');
    const [error, setError]           = useState('');
    const [loading, setLoading]       = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(identifier, password);
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
                        <div className="auth-subtitle">Sign in to your account</div>
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
                            <label className="form-label">Username or Email</label>
                            <input
                                id="auth-identifier"
                                className="form-input"
                                type="text"
                                placeholder="your username or email"
                                value={identifier}
                                onChange={e => setIdentifier(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                id="auth-password"
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            id="auth-submit"
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                            disabled={loading}
                        >
                            {loading
                                ? <><div className="spinner spinner-sm" /> Signing In...</>
                                : 'Sign In →'
                            }
                        </button>
                    </form>

                    <div className="auth-switch">
                        No account?{' '}
                        <Link to="/register">Register here</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
