import { useState } from 'react';
import { api } from '../services/api';

export default function CreateTaskModal({ workspaceId, members, defaultIsUrgent, defaultIsImportant, onCreated, onClose }) {
    const [title, setTitle]             = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate]         = useState('');
    const [assignedTo, setAssignedTo]   = useState('');
    const [isUrgent, setIsUrgent]       = useState(!!defaultIsUrgent);
    const [isImportant, setIsImportant] = useState(!!defaultIsImportant);
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');

    const quadrantLabel =
        isUrgent && isImportant    ? '🔥 Do First (Q1)'   :
        !isUrgent && isImportant   ? '📅 Schedule (Q2)'   :
        isUrgent && !isImportant   ? '🤝 Delegate (Q3)'   :
                                     '🗑 Eliminate (Q4)';

    async function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim()) return;
        setLoading(true); setError('');
        try {
            const data = await api.post(`/workspaces/${workspaceId}/tasks`, {
                title: title.trim(),
                description: description.trim(),
                isUrgent, isImportant,
                assignedTo: assignedTo || undefined,
                dueDate: dueDate || undefined,
            });
            onCreated(data.task);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function handleOverlayClick(e) {
        if (e.target === e.currentTarget) onClose();
    }

    const safeMembers = members.filter(m => typeof m.user === 'object' && m.user !== null);

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-box">
                {/* Title bar */}
                <div className="modal-titlebar">
                    <span className="modal-titlebar-text">✨ New Task — {quadrantLabel}</span>
                    <button
                        className="window-dot window-dot-close"
                        onClick={onClose}
                        aria-label="Close"
                        style={{ cursor: 'pointer', border: '1px solid rgba(0,0,0,0.3)' }}
                    />
                </div>

                <div className="modal-body">
                    {error && <div className="auth-error" style={{ marginBottom: 14 }}>{error}</div>}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Task Title *</label>
                            <input
                                id="task-title-input"
                                className="form-input"
                                style={{ fontFamily: 'var(--font-handwriting)', fontSize: '1.1rem' }}
                                placeholder="What needs to get done?"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea
                                id="task-desc-input"
                                className="form-input"
                                style={{ fontFamily: 'var(--font-handwriting)', fontSize: '1rem', resize: 'vertical' }}
                                placeholder="Any details or context..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                                <label className="form-label">Due Date</label>
                                <input
                                    id="task-due-input"
                                    className="form-input"
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    style={{ colorScheme: 'light dark' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assign To</label>
                                <select
                                    id="task-assign-input"
                                    className="form-input form-select"
                                    value={assignedTo}
                                    onChange={e => setAssignedTo(e.target.value)}
                                >
                                    <option value="">Unassigned</option>
                                    {safeMembers.map(m => (
                                        <option key={m.user._id} value={m.user._id}>
                                            {m.user.username || m.user.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Urgent / Important toggles */}
                        <div style={{ display: 'flex', gap: 10 }}>
                            {[
                                { label: '⚡ Urgent',    value: isUrgent,    set: setIsUrgent    },
                                { label: '⭐ Important', value: isImportant, set: setIsImportant },
                            ].map(({ label, value, set }) => (
                                <label
                                    key={label}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                                        cursor: 'pointer',
                                        background: value ? 'var(--accent-glow)' : 'var(--bg-input)',
                                        border: `2px solid ${value ? 'var(--accent)' : 'var(--border-soft)'}`,
                                        boxShadow: value ? 'var(--shadow-soft)' : 'none',
                                        padding: '8px 12px', transition: 'all 0.14s',
                                        fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 700,
                                        letterSpacing: '0.04em',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={value}
                                        onChange={e => set(e.target.checked)}
                                        style={{ accentColor: 'var(--accent)' }}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                            <button
                                id="task-create-submit"
                                type="submit"
                                className="btn btn-primary btn-sm"
                                disabled={loading || !title.trim()}
                            >
                                {loading ? <><div className="spinner spinner-sm" /> Creating...</> : 'Create Task →'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
