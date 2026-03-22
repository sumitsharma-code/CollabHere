import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../services/socket';
import Navbar from '../component/Navbar';
import EisenhowerMatrix from '../component/EisenhowerMatrix';
import AIRecommender from '../component/AIRecommender';
import Chat from '../component/Chat';
import VideoCall from '../component/VideoCall';
import { useVideoCall } from '../hooks/useVideoCall';
import { api } from '../services/api';

const TABS = [
    { id: 'matrix',    label: 'Matrix',    icon: '⊞' },
    { id: 'chat',      label: 'Chat',      icon: '💬' },
    { id: 'documents', label: 'Docs',      icon: '📄' },
    { id: 'members',   label: 'Members',   icon: '👥' },
];

// Helper: safely get display name from a member's user field
// Handles both populated ({ username, email }) and unpopulated (ObjectId string) cases
function getMemberName(user) {
    if (!user) return 'Unknown';
    if (typeof user === 'string') return 'User';   // not populated
    return user.username || (user.email ? user.email.split('@')[0] : 'Unknown');
}

function getMemberInitial(user) {
    const name = getMemberName(user);
    return name[0]?.toUpperCase() || '?';
}

export default function Workspace() {
    const { workspaceId } = useParams();
    const { user: authUser } = useAuth();
    const navigate = useNavigate();

    const myId   = authUser?._id || authUser?.id || '';
    const myName = authUser?.username || authUser?.email || 'Anonymous';

    const call = useVideoCall(workspaceId, myId, myName);

    // Register this user in the socket room immediately so call routing works
    // from ANY tab (not just when the Chat tab is mounted)
    useEffect(() => {
        if (!myId || !workspaceId) return;
        const joinRoom = () => {
            socket.emit('joinWorkspaceChat', { workspaceId, userId: myId, userName: myName });
        };
        socket.on('connect', joinRoom);
        if (socket.connected) joinRoom();
        return () => socket.off('connect', joinRoom);
    }, [workspaceId, myId, myName]);

    const [workspace, setWorkspace]   = useState(null);
    const [documents, setDocuments]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [activeTab, setActiveTab]   = useState('matrix');
    const [aiKey, setAiKey]           = useState(0);

    // Invite member state
    const [inviteEmail, setInviteEmail]   = useState('');
    const [inviteRole, setInviteRole]     = useState('member');
    const [inviting, setInviting]         = useState(false);
    const [inviteError, setInviteError]   = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    // Delete workspace state
    const [deleting, setDeleting] = useState(false);

    // Load workspace
    useEffect(() => {
        setLoading(true);
        api.get(`/workspaces/${workspaceId}`)
            .then(data => setWorkspace(data.workspace))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [workspaceId]);

    // Load documents on tab switch
    useEffect(() => {
        if (activeTab !== 'documents') return;
        api.get(`/workspaces/${workspaceId}/documents`)
            .then(data => setDocuments(data.data?.documents || []))
            .catch(err => console.error('Failed to load docs:', err));
    }, [activeTab, workspaceId]);

    async function handleCreateDocument() {
        try {
            const data = await api.post(`/workspaces/${workspaceId}/documents`, {});
            navigate(`/workspace/${workspaceId}/editor/${data.document._id}`);
        } catch (err) { alert(err.message); }
    }

    async function handleInviteMember(e) {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setInviting(true); setInviteError(''); setInviteSuccess('');
        try {
            const data = await api.post(`/workspaces/${workspaceId}/members`, {
                email: inviteEmail.trim(),
                role: inviteRole
            });
            setWorkspace(data.workspace);
            setInviteSuccess(`${inviteEmail.trim()} added as ${inviteRole}!`);
            setInviteEmail('');
        } catch (err) {
            setInviteError(err.message);
        } finally {
            setInviting(false);
        }
    }

    async function handleDeleteWorkspace() {
        const confirmed = window.confirm(
            `⚠️ Delete workspace "${workspace?.name}"?\n\nThis will permanently delete all documents, tasks, and activity. This cannot be undone.`
        );
        if (!confirmed) return;
        setDeleting(true);
        try {
            await api.delete(`/workspaces/${workspaceId}`);
            navigate('/dashboard');
        } catch (err) {
            alert(err.message);
            setDeleting(false);
        }
    }

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="spinner-wrapper" style={{ height: 'calc(100vh - 56px)' }}>
                    <div className="spinner" />
                </div>
            </>
        );
    }

    if (error || !workspace) {
        return (
            <>
                <Navbar />
                <div className="empty-state" style={{ marginTop: 60 }}>
                    <div className="empty-icon">⚠️</div>
                    <p className="empty-title">Failed to Load Workspace</p>
                    <p className="empty-desc">{error || 'Workspace not found'}</p>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/dashboard')}>
                        ← Back to Dashboard
                    </button>
                </div>
            </>
        );
    }

    const members = workspace.members || [];
    // Find current user's role in this workspace
    const myMembership = members.find(m => {
        const uid = typeof m.user === 'object' ? m.user._id : m.user;
        return uid === (authUser?._id || authUser?.id);
    });
    const myRole = myMembership?.role || 'member';
    const isOwner = myRole === 'owner';
    const isAdminOrOwner = myRole === 'owner' || myRole === 'admin';

    return (
        <div className="page-wrapper">
            <Navbar workspaceName={workspace.name} />

            {/* Workspace header */}
            <div className="workspace-header">
                <div className="workspace-icon">
                    {workspace.name[0].toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                    <div className="workspace-name">{workspace.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        {/* Member avatar cluster */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            {members.slice(0, 5).map((m, i) => (
                                <div
                                    key={typeof m.user === 'object' ? m.user._id : i}
                                    className="avatar avatar-sm"
                                    title={`${getMemberName(m.user)} (${m.role})`}
                                    style={{
                                        marginLeft: i > 0 ? -6 : 0,
                                        border: '2px solid var(--bg-card)',
                                        background: `hsl(${i * 70 + 180}, 45%, 42%)`,
                                    }}
                                >
                                    {getMemberInitial(m.user)}
                                </div>
                            ))}
                        </div>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>
                            {members.length} member{members.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-ui)', padding: '1px 6px', border: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>
                            you: {myRole}
                        </span>
                    </div>
                </div>

                {/* Owner-only: delete workspace */}
                {isOwner && (
                    <button
                        id="delete-workspace-btn"
                        className="btn btn-danger btn-sm"
                        onClick={handleDeleteWorkspace}
                        disabled={deleting}
                    >
                        {deleting ? <div className="spinner spinner-sm" /> : '🗑'}
                        {deleting ? ' Deleting...' : ' Delete Workspace'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="workspace-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        id={`tab-${tab.id}`}
                        className={`workspace-tab ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content — chat gets no padding so it can fill the viewport */}
            <div className="workspace-content" style={activeTab === 'chat' ? { padding: 0, display: 'flex', flexDirection: 'column' } : {}}>

                {/* ── MATRIX TAB ── */}
                {activeTab === 'matrix' && (
                    <>
                        <AIRecommender
                            key={aiKey}
                            workspaceId={workspaceId}
                            onTaskUpdated={() => setAiKey(k => k + 1)}
                        />
                        <EisenhowerMatrix
                            workspaceId={workspaceId}
                            members={members}
                            onTaskChange={() => setAiKey(k => k + 1)}
                        />
                    </>
                )}

                {/* ── CHAT TAB ── */}
                {activeTab === 'chat' && (
                    <Chat workspaceId={workspaceId} members={members} />
                )}

                {/* ── DOCUMENTS TAB ── */}
                {activeTab === 'documents' && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>Documents</h3>
                            <button id="create-doc-btn" className="btn btn-primary btn-sm" onClick={handleCreateDocument}>
                                + New Document
                            </button>
                        </div>

                        {documents.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📄</div>
                                <p className="empty-title">No Documents Yet</p>
                                <p className="empty-desc">Create your first collaborative document</p>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={handleCreateDocument}>
                                    + New Document
                                </button>
                            </div>
                        ) : (
                            <div className="documents-list">
                                {documents.map(doc => (
                                    <div
                                        id={`doc-${doc._id}`}
                                        key={doc._id}
                                        className="document-row"
                                        onClick={() => navigate(`/workspace/${workspaceId}/editor/${doc._id}`)}
                                    >
                                        <div className="document-icon">📝</div>
                                        <div style={{ flex: 1 }}>
                                            <div className="document-title">{doc.title || 'Untitled Document'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-ui)' }}>
                                                Updated {new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>OPEN →</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── MEMBERS TAB ── */}
                {activeTab === 'members' && (
                    <div>
                        <h3 style={{ margin: '0 0 16px' }}>
                            Members
                            <span style={{ marginLeft: 8, fontSize: '0.875rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                                ({members.length})
                            </span>
                        </h3>

                        {/* Invite section — only for owners and admins */}
                        {isAdminOrOwner && (
                            <div className="invite-section">
                                <div className="invite-section-title">
                                    ✉ Invite a Member
                                </div>
                                <form className="invite-form" onSubmit={handleInviteMember}>
                                    <div className="form-group" style={{ flex: 2 }}>
                                        <label className="form-label">Email Address</label>
                                        <input
                                            id="invite-email-input"
                                            className="form-input"
                                            type="email"
                                            placeholder="colleague@example.com"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group" style={{ minWidth: 130 }}>
                                        <label className="form-label">Role</label>
                                        <select
                                            id="invite-role-select"
                                            className="form-input form-select"
                                            value={inviteRole}
                                            onChange={e => setInviteRole(e.target.value)}
                                        >
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                                        <label className="form-label" style={{ opacity: 0 }}>_</label>
                                        <button
                                            id="invite-submit-btn"
                                            type="submit"
                                            className="btn btn-primary btn-sm"
                                            disabled={inviting}
                                        >
                                            {inviting ? <div className="spinner spinner-sm" /> : '+ Invite'}
                                        </button>
                                    </div>
                                </form>

                                {inviteError && (
                                    <div className="auth-error" style={{ margin: '0 14px 14px' }}>
                                        {inviteError}
                                    </div>
                                )}
                                {inviteSuccess && (
                                    <div style={{ margin: '0 14px 14px', padding: '8px 12px', background: 'var(--success-dim)', border: '2px solid var(--success)', color: 'var(--success)', fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 700 }}>
                                        ✓ {inviteSuccess}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Members list */}
                        <div className="members-list">
                            {members.map((m, i) => {
                                const name  = getMemberName(m.user);
                                const email = typeof m.user === 'object' ? m.user?.email : '';
                                const uid   = typeof m.user === 'object' ? m.user?._id : m.user;
                                const isMe  = uid === myId;
                                return (
                                    <div key={uid || i} className="member-row">
                                        <div
                                            className="avatar avatar-lg"
                                            style={{ background: `hsl(${i * 70 + 180}, 45%, 38%)` }}
                                        >
                                            {getMemberInitial(m.user)}
                                        </div>
                                        <div className="member-info">
                                            <div className="member-name">
                                                {name}
                                                {isMe && (
                                                    <span style={{ marginLeft: 8, fontSize: '0.7rem', fontFamily: 'var(--font-ui)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '0 5px' }}>
                                                        YOU
                                                    </span>
                                                )}
                                            </div>
                                            {email && <div className="member-email">{email}</div>}
                                        </div>
                                        <span className={`role-badge role-${m.role}`}>{m.role}</span>
                                        {/* 📞 Call button */}
                                        {!isMe && uid && (
                                            <button
                                                id={`call-btn-${uid}`}
                                                className="call-member-btn"
                                                disabled={call.callState !== 'idle'}
                                                onClick={() => call.initiateCall({ userId: uid, name })}
                                                title={`Video call ${name}`}
                                            >
                                                📞 Call
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* VideoCall renders as a fixed overlay, always mounted while in workspace */}
            <VideoCall {...call} />
        </div>
    );
}
