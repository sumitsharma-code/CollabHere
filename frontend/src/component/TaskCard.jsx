import { useState } from 'react';
import { api } from '../services/api';

const STATUS_OPTIONS = [
    { value: 'todo',        label: 'To Do' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'done',        label: 'Done' },
];

export default function TaskCard({ task, workspaceId, onUpdated, onDeleted }) {
    const [expanded, setExpanded]   = useState(false);
    const [updating, setUpdating]   = useState(false);

    const statusClass = {
        'todo':        'badge-todo',
        'in-progress': 'badge-progress',
        'done':        'badge-done',
    }[task.status] || 'badge-todo';

    const statusLabel = {
        'todo':        'To Do',
        'in-progress': 'In Progress',
        'done':        'Done',
    }[task.status] || task.status;

    // Is task overdue?
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

    async function handleStatusChange(newStatus) {
        setUpdating(true);
        try {
            const data = await api.put(`/workspaces/${workspaceId}/tasks/${task._id}`, { status: newStatus });
            onUpdated(data.task);
        } catch (err) {
            console.error('Failed to update task:', err);
        } finally {
            setUpdating(false);
        }
    }

    async function handleDelete() {
        if (!confirm(`Delete "${task.title}"?`)) return;
        try {
            await api.delete(`/workspaces/${workspaceId}/tasks/${task._id}`);
            onDeleted(task._id);
        } catch (err) {
            console.error('Failed to delete task:', err);
        }
    }

    return (
        <div className="task-card" onClick={() => setExpanded(v => !v)} id={`task-${task._id}`}>
            <div className="task-card-title" style={task.status === 'done' ? { textDecoration: 'line-through', opacity: 0.5 } : {}}>
                {task.title}
            </div>

            <div className="task-card-footer">
                <span className={`badge ${statusClass}`}>{statusLabel}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {task.dueDate && (
                        <span className={`task-due ${isOverdue ? 'overdue' : ''}`}>
                            📅 {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                    {task.assignedTo && (
                        <div
                            className="avatar avatar-sm"
                            title={task.assignedTo.username || task.assignedTo.email}
                        >
                            {String(task.assignedTo.username || task.assignedTo.email || '?')[0].toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div
                    style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 10 }}
                    onClick={e => e.stopPropagation()}
                >
                    {task.description && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                            {task.description}
                        </p>
                    )}

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {STATUS_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                className={`btn btn-xs ${task.status === opt.value ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => handleStatusChange(opt.value)}
                                disabled={updating || task.status === opt.value}
                            >
                                {updating && task.status !== opt.value
                                    ? <div className="spinner spinner-sm" />
                                    : opt.label}
                            </button>
                        ))}
                        <button
                            className="btn btn-xs btn-danger"
                            style={{ marginLeft: 'auto' }}
                            onClick={handleDelete}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
