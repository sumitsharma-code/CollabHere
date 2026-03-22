import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────
function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDay(dateStr) {
    const d   = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    if (d.toDateString() === now.toDateString())       return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function isSameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.toDateString() === db.toDateString();
}

function getSenderName(sender) {
    if (!sender) return 'Unknown';
    if (typeof sender === 'string') return 'User';
    return sender.username || sender.email?.split('@')[0] || 'Unknown';
}

function getSenderInitial(sender) {
    return getSenderName(sender)[0]?.toUpperCase() || '?';
}

// Rainbow-stable color per user id
const USER_COLORS = [
    '#2952a3','#8b1a1a','#1a6b3a','#5a2080','#7a5200',
    '#1a5a6b','#6b1a5a','#3a6b1a','#6b3a1a','#1a3a6b',
];
function userColor(userId) {
    let h = 0;
    for (let i = 0; i < (userId?.length || 0); i++) h = (h * 31 + userId.charCodeAt(i)) % USER_COLORS.length;
    return USER_COLORS[h];
}

// ─── Chat Component ───────────────────────────────────────────
export default function Chat({ workspaceId, members }) {
    const { user } = useAuth();
    const myId   = user?._id || user?.id || '';
    const myName = user?.username || user?.email || 'Me';

    const [messages, setMessages]     = useState([]);
    const [input, setInput]           = useState('');
    const [loading, setLoading]       = useState(true);
    const [hasMore, setHasMore]       = useState(false);
    const [page, setPage]             = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [typingUsers, setTypingUsers] = useState(new Map()); // userId → userName
    const [sendError, setSendError]   = useState('');
    const [sending, setSending]       = useState(false);

    const bottomRef      = useRef(null);
    const inputRef       = useRef(null);
    const typingTimer    = useRef(null);
    const isTyping       = useRef(false);
    const typingTimers   = useRef(new Map()); // per-user timers

    // ── Load history ───────────────────────────────────────────
    const loadMessages = useCallback(async (pg = 1, prepend = false) => {
        try {
            const data = await api.get(
                `/workspaces/${workspaceId}/messages?page=${pg}&limit=40`
            );
            setMessages(prev =>
                prepend
                    ? [...data.messages, ...prev]
                    : data.messages
            );
            setHasMore(data.pagination.hasMore);
            setPage(pg);
        } catch (err) {
            console.error('Failed to load messages:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        setLoading(true);
        loadMessages(1, false);
    }, [loadMessages]);

    // ── Socket: join room & listen ─────────────────────────────
    useEffect(() => {
        if (!myId) return;

        const joinRoom = () => {
            socket.emit('joinWorkspaceChat', {
                workspaceId,
                userId:   myId,
                userName: myName,
            });
        };

        const onChatMessage = (msg) => {
            setMessages(prev => [...prev, msg]);
        };

        const onChatTyping = ({ userId, userName }) => {
            if (userId === myId) return;
            setTypingUsers(prev => new Map(prev).set(userId, userName));
            // auto-clear after 3s silence
            if (typingTimers.current.has(userId)) clearTimeout(typingTimers.current.get(userId));
            const t = setTimeout(() => {
                setTypingUsers(prev => { const m = new Map(prev); m.delete(userId); return m; });
                typingTimers.current.delete(userId);
            }, 3200);
            typingTimers.current.set(userId, t);
        };

        const onChatStopTyping = ({ userId }) => {
            if (typingTimers.current.has(userId)) clearTimeout(typingTimers.current.get(userId));
            typingTimers.current.delete(userId);
            setTypingUsers(prev => { const m = new Map(prev); m.delete(userId); return m; });
        };

        const onChatError = ({ message }) => {
            setSendError(message);
            setSending(false);
        };

        socket.on('chatMessage',        onChatMessage);
        socket.on('chatUserTyping',     onChatTyping);
        socket.on('chatUserStopTyping', onChatStopTyping);
        socket.on('chatError',          onChatError);
        socket.on('connect',            joinRoom);

        if (socket.connected) joinRoom();

        return () => {
            socket.off('chatMessage',        onChatMessage);
            socket.off('chatUserTyping',     onChatTyping);
            socket.off('chatUserStopTyping', onChatStopTyping);
            socket.off('chatError',          onChatError);
            socket.off('connect',            joinRoom);
            clearTimeout(typingTimer.current);
            typingTimers.current.forEach(t => clearTimeout(t));
            typingTimers.current.clear();
        };
    }, [workspaceId, myId, myName]);

    // ── Auto-scroll to bottom on new messages ─────────────────
    useEffect(() => {
        if (!loading) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    // ── Typing indicator emit ──────────────────────────────────
    function handleInputChange(e) {
        setInput(e.target.value);
        setSendError('');

        if (!isTyping.current) {
            socket.emit('chatTyping', { workspaceId, userId: myId, userName: myName });
            isTyping.current = true;
        }
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => {
            socket.emit('chatStopTyping', { workspaceId, userId: myId });
            isTyping.current = false;
        }, 2500);
    }

    // ── Send message ───────────────────────────────────────────
    function handleSend() {
        const text = input.trim();
        if (!text || sending) return;
        setSending(true);
        setSendError('');

        socket.emit('sendChatMessage', {
            workspaceId,
            content:  text,
            userId:   myId,
            userName: myName,
        });

        // Clear input immediately; message arrives via socket broadcast
        setInput('');
        isTyping.current = false;
        clearTimeout(typingTimer.current);
        socket.emit('chatStopTyping', { workspaceId, userId: myId });

        // Reset sending after a short delay
        setTimeout(() => setSending(false), 600);
        inputRef.current?.focus();
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    // ── Load more (scroll up) ─────────────────────────────────
    async function handleLoadMore() {
        setLoadingMore(true);
        await loadMessages(page + 1, true);
    }

    // ── Render ─────────────────────────────────────────────────
    const typingList = Array.from(typingUsers.values());

    return (
        <div className="chat-wrapper">
            {/* Header bar */}
            <div className="chat-header">
                <div className="chat-header-info">
                    <span className="chat-header-icon">💬</span>
                    <div>
                        <div className="chat-header-title">Workspace Chat</div>
                        <div className="chat-header-sub">
                            {members.length} member{members.length !== 1 ? 's' : ''} · messages persist forever
                        </div>
                    </div>
                </div>
                {/* Online dots */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {members.slice(0, 5).map((m, i) => (
                        <div
                            key={i}
                            className="avatar avatar-sm"
                            title={m.user?.username || m.user?.email}
                            style={{ background: `hsl(${i * 70 + 180}, 40%, 42%)` }}
                        >
                            {String(m.user?.username || m.user?.email || '?')[0].toUpperCase()}
                        </div>
                    ))}
                </div>
            </div>

            {/* Messages area */}
            <div className="chat-messages" id="chat-messages-area">
                {/* Load more */}
                {hasMore && (
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <button
                            className="btn btn-ghost btn-xs"
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                        >
                            {loadingMore
                                ? <><div className="spinner spinner-sm" /> Loading...</>
                                : '↑ Load older messages'
                            }
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="spinner-wrapper" style={{ flex: 1 }}>
                        <div className="spinner" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="chat-empty">
                        <div style={{ fontSize: '3rem' }}>✉️</div>
                        <p style={{ fontFamily: 'var(--font-handwriting)', fontSize: '1.25rem', marginTop: 8 }}>
                            No messages yet...
                        </p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                            Be the first to say something!
                        </p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMine       = (msg.sender?._id || msg.sender) === myId;
                        const senderId     = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender;
                        const senderName   = getSenderName(msg.sender);
                        const senderInitial= getSenderInitial(msg.sender);
                        const color        = userColor(senderId);
                        const prevMsg      = messages[idx - 1];
                        const showDay       = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                        const prevSameSender = prevMsg && !showDay &&
                            (prevMsg.sender?._id || prevMsg.sender) === senderId;

                        return (
                            <div key={msg._id || idx}>
                                {/* Day separator */}
                                {showDay && (
                                    <div className="chat-day-separator">
                                        <span className="chat-day-label">{formatDay(msg.createdAt)}</span>
                                    </div>
                                )}

                                <div className={`chat-row ${isMine ? 'chat-row-mine' : 'chat-row-theirs'}`}>
                                    {/* Avatar — only for others, only on first message of a group */}
                                    {!isMine && (
                                        <div
                                            className="avatar avatar-sm chat-avatar"
                                            style={{ background: color, opacity: prevSameSender ? 0 : 1 }}
                                        >
                                            {senderInitial}
                                        </div>
                                    )}

                                    <div className="chat-bubble-group">
                                        {/* Sender name — only for others, first in group */}
                                        {!isMine && !prevSameSender && (
                                            <div className="chat-sender-name" style={{ color }}>
                                                {senderName}
                                            </div>
                                        )}

                                        <div className={`chat-bubble ${isMine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
                                            <div className="chat-text">{msg.content}</div>
                                            <div className={`chat-time ${isMine ? 'chat-time-mine' : ''}`}>
                                                {formatTime(msg.createdAt)}
                                                {isMine && <span className="chat-tick">✓✓</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Typing indicator */}
                {typingList.length > 0 && (
                    <div className="chat-row chat-row-theirs">
                        <div className="chat-typing-bubble">
                            <div className="chat-typing-dots">
                                <span /><span /><span />
                            </div>
                            <span className="chat-typing-label">
                                {typingList.length === 1
                                    ? `${typingList[0]} is writing...`
                                    : `${typingList.slice(0, 2).join(' & ')} are writing...`}
                            </span>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="chat-input-area">
                {sendError && (
                    <div className="chat-send-error">⚠️ {sendError}</div>
                )}
                <div className="chat-input-row">
                    <div
                        className="chat-my-avatar avatar"
                        style={{ background: userColor(myId), flexShrink: 0, width: 32, height: 32, fontSize: '0.85rem' }}
                    >
                        {myName[0]?.toUpperCase() || '?'}
                    </div>

                    <textarea
                        ref={inputRef}
                        id="chat-input"
                        className="chat-input"
                        placeholder="Write a message... (Enter to send, Shift+Enter for new line)"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        maxLength={2000}
                    />

                    <button
                        id="chat-send-btn"
                        className="chat-send-btn"
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        title="Send (Enter)"
                    >
                        {sending
                            ? <div className="spinner spinner-sm" style={{ borderTopColor: '#fff' }} />
                            : '➤'
                        }
                    </button>
                </div>
                <div className="chat-input-hint">
                    {input.length > 0 && (
                        <span>{input.length}/2000 chars</span>
                    )}
                </div>
            </div>
        </div>
    );
}
