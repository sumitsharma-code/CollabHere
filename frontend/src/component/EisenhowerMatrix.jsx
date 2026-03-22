import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import TaskCard from './TaskCard';
import CreateTaskModal from './CreateTaskModal';

const QUADRANTS = [
    { key: 'q1', label: 'Do First',  subtitle: 'Urgent & Important',      icon: '🔥', isUrgent: true,  isImportant: true,  colorClass: 'q1' },
    { key: 'q2', label: 'Schedule',  subtitle: 'Not Urgent, Important',    icon: '📅', isUrgent: false, isImportant: true,  colorClass: 'q2' },
    { key: 'q3', label: 'Delegate',  subtitle: 'Urgent, Not Important',    icon: '🤝', isUrgent: true,  isImportant: false, colorClass: 'q3' },
    { key: 'q4', label: 'Eliminate', subtitle: 'Not Urgent, Not Important', icon: '🗑', isUrgent: false, isImportant: false, colorClass: 'q4' },
];

function getQuadrant(task) {
    if (task.isUrgent && task.isImportant)   return 'q1';
    if (!task.isUrgent && task.isImportant)  return 'q2';
    if (task.isUrgent && !task.isImportant)  return 'q3';
    return 'q4';
}

export default function EisenhowerMatrix({ workspaceId, members, onTaskChange }) {
    const [tasks, setTasks]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [modal, setModal]     = useState(null);

    const fetchTasks = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await api.get(`/workspaces/${workspaceId}/tasks`);
            setTasks(data.tasks || []);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [workspaceId]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    function handleTaskCreated(t) { setTasks(p => [t, ...p]); onTaskChange?.(); }
    function handleTaskUpdated(t) { setTasks(p => p.map(x => x._id === t._id ? t : x)); onTaskChange?.(); }
    function handleTaskDeleted(id){ setTasks(p => p.filter(x => x._id !== id)); onTaskChange?.(); }

    if (loading) return <div className="spinner-wrapper"><div className="spinner" /></div>;

    if (error) return (
        <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <p className="empty-title">Failed to load tasks</p>
            <p className="empty-desc">{error}</p>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={fetchTasks}>
                Try Again
            </button>
        </div>
    );

    const total      = tasks.length;
    const done       = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;

    return (
        <div className="matrix-wrapper">
            {/* Stats bar */}
            {total > 0 && (
                <div className="stats-bar">
                    <span><strong>{total}</strong> total</span>
                    <span style={{ color: 'var(--warning)' }}><strong>{inProgress}</strong> in progress</span>
                    <span style={{ color: 'var(--success)' }}><strong>{done}</strong> done</span>
                    <div style={{ flex: 1 }}>
                        <div className="progress-bar-track">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={fetchTasks}>↻ Refresh</button>
                </div>
            )}

            {/* Axis labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    ⚡ URGENT
                </div>
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    🕰 NOT URGENT
                </div>
            </div>

            {/* 2×2 grid */}
            <div className="matrix-grid">
                {QUADRANTS.map(q => {
                    const qTasks = tasks.filter(t => getQuadrant(t) === q.key);
                    return (
                        <div key={q.key} className={`matrix-quadrant ${q.colorClass}`}>
                            {/* Quadrant title bar */}
                            <div className="quadrant-titlebar">
                                <div>
                                    <div className="quadrant-label">
                                        <span>{q.icon}</span> {q.label}
                                        <span style={{
                                            marginLeft: 6, fontSize: '0.68rem',
                                            fontFamily: 'var(--font-ui)',
                                            padding: '0 5px',
                                            border: '1px solid currentColor', opacity: 0.7,
                                        }}>
                                            {qTasks.length}
                                        </span>
                                    </div>
                                    <div className="quadrant-subtitle">{q.subtitle}</div>
                                </div>
                            </div>

                            <div className="quadrant-body">
                                <div className="quadrant-tasks">
                                    {qTasks.length === 0 ? (
                                        <p style={{
                                            fontFamily: 'var(--font-handwriting)',
                                            fontSize: '1rem', color: 'var(--text-muted)',
                                            fontStyle: 'italic', padding: '4px 0',
                                        }}>
                                            Nothing here yet...
                                        </p>
                                    ) : (
                                        qTasks.map(task => (
                                            <TaskCard
                                                key={task._id}
                                                task={task}
                                                workspaceId={workspaceId}
                                                onUpdated={handleTaskUpdated}
                                                onDeleted={handleTaskDeleted}
                                            />
                                        ))
                                    )}
                                </div>

                                <button
                                    id={`add-task-${q.key}`}
                                    className="quadrant-add-btn"
                                    onClick={() => setModal({ isUrgent: q.isUrgent, isImportant: q.isImportant })}
                                >
                                    <span>+</span> Add Task
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {modal && (
                <CreateTaskModal
                    workspaceId={workspaceId}
                    members={members}
                    defaultIsUrgent={modal.isUrgent}
                    defaultIsImportant={modal.isImportant}
                    onCreated={handleTaskCreated}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}
