import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../component/Navbar';
import { api } from '../services/api';

export default function Dashboard() {
    const navigate = useNavigate();
    const [workspaces, setWorkspaces] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [creating, setCreating]     = useState(false);
    const [showForm, setShowForm]     = useState(false);
    const [newName, setNewName]       = useState('');
    const [error, setError]           = useState('');

    useEffect(() => {
        api.get('/workspaces')
            .then(data => setWorkspaces(data.workspaces || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleCreate(e) {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true); setError('');
        try {
            const data = await api.post('/workspaces', { name: newName.trim() });
            setWorkspaces(prev => [data.workspace, ...prev]);
            setNewName(''); setShowForm(false);
            navigate(`/workspace/${data.workspace._id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    }

    const PALETTE = [
        ['#2952a3','#4a6cc0'], ['#8b1a1a','#b03030'], ['#1a6b3a','#2a8a4a'],
        ['#5a2080','#7a3aa0'], ['#7a5200','#a06a00'],
    ];

    return (
        <div className="page-wrapper">
            <Navbar />

            <div className="container">
                <div className="dashboard-header">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <div>
                            <h1>My Workspaces</h1>
                            <p style={{ marginTop: 6, fontFamily: 'var(--font-ui)', letterSpacing: '0.02em' }}>
                                {workspaces.length > 0
                                    ? `${workspaces.length} workspace${workspaces.length > 1 ? 's' : ''} found`
                                    : 'Create a workspace to get started'}
                            </p>
                        </div>
                        <button
                            id="create-workspace-btn"
                            className="btn btn-primary"
                            onClick={() => setShowForm(v => !v)}
                        >
                            {showForm ? '✕ Cancel' : '+ New Workspace'}
                        </button>
                    </div>

                    {showForm && (
                        <form
                            onSubmit={handleCreate}
                            style={{
                                marginTop: 20, display: 'flex', gap: 10,
                                background: 'var(--bg-card)',
                                border: '2px solid var(--border-ink)',
                                boxShadow: 'var(--shadow-soft)', padding: '14px',
                            }}
                        >
                            <input
                                id="workspace-name-input"
                                className="form-input"
                                placeholder="Workspace name (minimum 3 characters)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                minLength={3}
                                required
                                autoFocus
                                style={{ flex: 1 }}
                            />
                            <button
                                id="workspace-create-submit"
                                type="submit"
                                className="btn btn-primary"
                                disabled={creating}
                            >
                                {creating ? <><div className="spinner spinner-sm" /> Creating...</> : 'Create →'}
                            </button>
                        </form>
                    )}

                    {error && <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>}
                </div>

                {loading ? (
                    <div className="spinner-wrapper"><div className="spinner" /></div>
                ) : workspaces.length === 0 ? (
                    <div className="empty-state" style={{ marginTop: 40 }}>
                        <div className="empty-icon">🏠</div>
                        <p className="empty-title">No Workspaces Yet</p>
                        <p className="empty-desc">Click "New Workspace" to create your first collaborative space</p>
                    </div>
                ) : (
                    <div className="workspace-grid">
                        {workspaces.map((ws, idx) => {
                            const [c1, c2] = PALETTE[idx % PALETTE.length];
                            return (
                                <div
                                    id={`workspace-${ws._id}`}
                                    key={ws._id}
                                    className="workspace-card"
                                    onClick={() => navigate(`/workspace/${ws._id}`)}
                                >
                                    {/* Title bar */}
                                    <div
                                        className="workspace-card-header"
                                        style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                                    >
                                        <span className="workspace-card-name">{ws.name}</span>
                                        <div className="window-titlebar-dots">
                                            <div className="window-dot window-dot-close" />
                                            <div className="window-dot window-dot-min" />
                                            <div className="window-dot window-dot-max" />
                                        </div>
                                    </div>

                                    <div className="workspace-card-body">
                                        <div className="workspace-card-meta">
                                            {/* Member avatars */}
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {ws.members.slice(0, 4).map((m, i) => (
                                                    <div
                                                        key={m.user?._id || i}
                                                        className="avatar avatar-sm"
                                                        style={{
                                                            marginLeft: i > 0 ? -6 : 0,
                                                            border: '2px solid var(--bg-card)',
                                                            background: `hsl(${i * 80 + 180}, 40%, 42%)`,
                                                        }}
                                                    >
                                                        {String(m.user?.username || m.user?.email || '?')[0].toUpperCase()}
                                                    </div>
                                                ))}
                                            </div>
                                            <span>{ws.members.length} member{ws.members.length !== 1 ? 's' : ''}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {new Date(ws.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
