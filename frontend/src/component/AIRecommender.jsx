import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function AIRecommender({ workspaceId, onTaskUpdated }) {
    const [rec, setRec]         = useState(null);   // { task, reasoning }
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        if (!workspaceId) return;
        fetchRecommendation();
    }, [workspaceId]);

    async function fetchRecommendation() {
        setLoading(true);
        try {
            const data = await api.get(`/workspaces/${workspaceId}/tasks/recommend`);
            setRec(data);
        } catch (err) {
            console.error('AI recommend error:', err);
            setRec(null);
        } finally {
            setLoading(false);
        }
    }

    async function handleStartNow() {
        if (!rec?.task) return;
        setStarting(true);
        try {
            const data = await api.put(
                `/workspaces/${workspaceId}/tasks/${rec.task._id}`,
                { status: 'in-progress' }
            );
            onTaskUpdated?.(data.task);
            // Re-fetch recommendation
            await fetchRecommendation();
        } catch (err) {
            console.error('Failed to start task:', err);
        } finally {
            setStarting(false);
        }
    }

    if (loading) {
        return (
            <div className="ai-recommender">
                <div className="ai-icon">⚡</div>
                <div className="ai-content">
                    <div className="ai-label">AI Recommender</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <div className="spinner spinner-sm" />
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Finding your best next task...
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (!rec?.task) {
        return (
            <div className="ai-recommender">
                <div className="ai-icon">🎉</div>
                <div className="ai-content">
                    <div className="ai-label">AI Recommender</div>
                    <div className="ai-task-name">All clear!</div>
                    <div className="ai-reasoning">
                        {rec?.reasoning || 'No pending tasks found. Great work!'}
                    </div>
                </div>
                <div className="ai-actions">
                    <button className="btn btn-ghost btn-sm" onClick={fetchRecommendation}>
                        🔄 Refresh
                    </button>
                </div>
            </div>
        );
    }

    const { task, reasoning } = rec;
    const quadrantTag =
        task.isUrgent && task.isImportant    ? { label: 'Do First',  color: 'var(--q1-color)' } :
        !task.isUrgent && task.isImportant   ? { label: 'Schedule',  color: 'var(--q2-color)' } :
        task.isUrgent && !task.isImportant   ? { label: 'Delegate',  color: 'var(--q3-color)' } :
                                               { label: 'Eliminate', color: 'var(--q4-color)' };

    return (
        <div className="ai-recommender">
            <div className="ai-icon">⚡</div>

            <div className="ai-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div className="ai-label">Your Next Action</div>
                    <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: `${quadrantTag.color}20`,
                        color: quadrantTag.color,
                        border: `1px solid ${quadrantTag.color}50`,
                        letterSpacing: '0.04em',
                    }}>
                        {quadrantTag.label}
                    </span>
                    {task.status === 'in-progress' && (
                        <span style={{
                            fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                            borderRadius: 999, background: 'var(--warning-dim)', color: 'var(--warning)',
                        }}>
                            In Progress
                        </span>
                    )}
                </div>

                <div className="ai-task-name">{task.title}</div>
                <div className="ai-reasoning">{reasoning}</div>

                {task.dueDate && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        📅 Due {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                )}
            </div>

            <div className="ai-actions">
                {task.status !== 'in-progress' && (
                    <button
                        id="ai-start-btn"
                        className="btn-ai-start"
                        onClick={handleStartNow}
                        disabled={starting}
                    >
                        {starting
                            ? <><div className="spinner spinner-sm" /> Starting...</>
                            : <>▶ Start Now</>
                        }
                    </button>
                )}
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={fetchRecommendation}
                    style={{ justifyContent: 'center' }}
                >
                    🔄 Refresh
                </button>
            </div>
        </div>
    );
}
