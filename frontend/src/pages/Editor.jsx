import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "../services/socket";
import { useAuth } from "../context/AuthContext";
import Navbar from "../component/Navbar";
import { api } from "../services/api";

function Editor() {
    const { workspaceId, documentId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [content, setContent]           = useState("");
    const [docTitle, setDocTitle]         = useState("Untitled Document");
    const [activeUsers, setActiveUsers]   = useState([]);
    const [typingUsers, setTypingUsers]   = useState(new Map());
    const [isLoading, setIsLoading]       = useState(true);
    const [saveStatus, setSaveStatus]     = useState("idle"); // idle | saving | saved | error
    const [saveError, setSaveError]       = useState(null);
    const [lastSavedContent, setLastSavedContent] = useState("");
    const [lastSavedTime, setLastSavedTime]       = useState(null);

    const userId   = user?._id || user?.id || "";
    const userName = user?.username || user?.email || "Anonymous";

    const textareaRef     = useRef();
    const debounceTimeout = useRef(null);
    const typingTimeout   = useRef(null);
    const typingTimers    = useRef(new Map());
    const isTypingEmitted = useRef(false);
    const autoSaveTimeout = useRef(null);
    const isSavingRef     = useRef(false);
    const contentRef      = useRef(content);
    const saveStatusTO    = useRef(null);
    const retryCount      = useRef(0);

    useEffect(() => { contentRef.current = content; }, [content]);

    // Load document
    useEffect(() => {
        if (!documentId || !workspaceId) return;
        api.get(`/workspaces/${workspaceId}/documents/${documentId}`)
            .then(data => {
                const body = data.document?.content  || "";
                const title = data.document?.title   || "Untitled Document";
                setContent(body);
                setDocTitle(title);
                setLastSavedContent(body);
                setLastSavedTime(data.document?.updatedAt ? new Date(data.document.updatedAt).getTime() : Date.now());
            })
            .catch(err => setSaveError("Failed to load document: " + err.message))
            .finally(() => setIsLoading(false));
    }, [documentId, workspaceId]);

    // Auto-save
    const saveDocumentContent = async (contentToSave, isRetry = false) => {
        if (isSavingRef.current || contentToSave === lastSavedContent) return;
        isSavingRef.current = true;
        setSaveStatus("saving");
        setSaveError(null);
        try {
            const result = await api.put(
                `/workspaces/${workspaceId}/documents/${documentId}`,
                { content: contentToSave, updatedAt: lastSavedTime || Date.now() }
            );
            setLastSavedContent(contentToSave);
            setLastSavedTime(new Date(result.document?.savedAt || new Date()).getTime());
            setSaveStatus("saved");
            retryCount.current = 0;
            clearTimeout(saveStatusTO.current);
            saveStatusTO.current = setTimeout(() => setSaveStatus(p => p === "saved" ? "idle" : p), 2500);
        } catch (err) {
            setSaveError(err.message || "Save failed");
            setSaveStatus("error");
            if (!isRetry && retryCount.current < 2) {
                retryCount.current++;
                setTimeout(() => saveDocumentContent(contentRef.current, true), 1000 * retryCount.current);
            }
        } finally {
            isSavingRef.current = false;
        }
    };

    // Socket events
    useEffect(() => {
        if (!documentId || !userId) return;

        const onUpdate = (data) => {
            if (data.userId !== userId) {
                const cursor = textareaRef.current?.selectionStart || 0;
                setContent(data.content);
                setLastSavedContent(data.content);
                setLastSavedTime(new Date(data.timestamp || new Date()).getTime());
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = cursor;
                        textareaRef.current.selectionEnd   = cursor;
                    }
                }, 0);
            }
        };

        const onPresence = (users) => setActiveUsers(users);

        const onTyping = ({ userId: uid, userName: uname }) => {
            if (uid === userId) return;
            setTypingUsers(prev => new Map(prev).set(uid, uname));
            if (typingTimers.current.has(uid)) clearTimeout(typingTimers.current.get(uid));
            const t = setTimeout(() => {
                setTypingUsers(prev => { const m = new Map(prev); m.delete(uid); return m; });
                typingTimers.current.delete(uid);
            }, 3000);
            typingTimers.current.set(uid, t);
        };

        const onStopTyping = ({ userId: uid }) => {
            if (typingTimers.current.has(uid)) clearTimeout(typingTimers.current.get(uid));
            typingTimers.current.delete(uid);
            setTypingUsers(prev => { const m = new Map(prev); m.delete(uid); return m; });
        };

        const onConnect = () => {
            socket.emit("joinDocument", { documentId, userName, userId });
        };

        socket.on("documentUpdate", onUpdate);
        socket.on("presenceUpdate", onPresence);
        socket.on("typing",         onTyping);
        socket.on("stopTyping",     onStopTyping);
        socket.on("connect",        onConnect);

        if (socket.connected) onConnect();

        return () => {
            socket.off("documentUpdate", onUpdate);
            socket.off("presenceUpdate", onPresence);
            socket.off("typing",         onTyping);
            socket.off("stopTyping",     onStopTyping);
            socket.off("connect",        onConnect);
            clearTimeout(debounceTimeout.current);
            clearTimeout(typingTimeout.current);
            clearTimeout(autoSaveTimeout.current);
            clearTimeout(saveStatusTO.current);
            typingTimers.current.forEach(t => clearTimeout(t));
            typingTimers.current.clear();
        };
    }, [documentId, userId, userName]);

    const handleChange = (e) => {
        const newContent = e.target.value;
        setContent(newContent);

        clearTimeout(debounceTimeout.current);
        debounceTimeout.current = setTimeout(() => {
            socket.emit("documentChange", { documentId, content: newContent, userId, timestamp: Date.now() });
        }, 200);

        if (!isTypingEmitted.current) {
            socket.emit("typing", { documentId, userId, userName });
            isTypingEmitted.current = true;
        }
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => {
            socket.emit("stopTyping", { documentId, userId });
            isTypingEmitted.current = false;
        }, 3000);

        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = setTimeout(() => saveDocumentContent(contentRef.current), 3000);
    };

    const typingUsersList = useMemo(() => Array.from(typingUsers.values()), [typingUsers]);

    return (
        <div className="editor-wrapper">
            <Navbar workspaceName={docTitle} />

            {/* Toolbar */}
            <div className="editor-toolbar">
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/workspace/${workspaceId}`)}
                >
                    ← Back
                </button>

                {/* Active users */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {activeUsers.map(u => (
                        <div
                            key={u.socketId}
                            className="avatar avatar-sm"
                            title={`${u.userName}${u.userId === userId ? ' (you)' : ''}`}
                            style={{
                                background: u.userId === userId
                                    ? 'var(--accent)'
                                    : `hsl(${[...u.userId].reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 45%, 40%)`,
                                borderColor: u.userId === userId ? 'var(--accent)' : 'var(--border-soft)',
                            }}
                        >
                            {String(u.userName || '?')[0].toUpperCase()}
                        </div>
                    ))}
                    {activeUsers.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                            {activeUsers.length} online
                        </span>
                    )}
                </div>

                <div style={{ flex: 1 }} />

                {/* Typing indicator — handwriting font makes it feel personal */}
                {typingUsersList.length > 0 && (
                    <span style={{ fontFamily: 'var(--font-handwriting)', fontSize: '1.05rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        ✍️ {typingUsersList.length === 1
                            ? `${typingUsersList[0]} is typing...`
                            : `${typingUsersList.slice(0, 2).join(', ')} are typing...`}
                    </span>
                )}

                {/* Save status */}
                {saveStatus === 'saving' && <span className="save-pill save-saving">⏳ Saving...</span>}
                {saveStatus === 'saved'  && <span className="save-pill save-saved" >✓ Saved</span>}
                {saveStatus === 'error'  && <span className="save-pill save-error" >✗ {saveError}</span>}
            </div>

            {/* Editor area — the textarea sits on top of the ruled lines from index.css body background */}
            {isLoading ? (
                <div className="spinner-wrapper" style={{ flex: 1 }}>
                    <div className="spinner" />
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    id="document-editor"
                    className="editor-area"
                    value={content}
                    onChange={handleChange}
                    placeholder="Start writing here... every line is a new thought."
                />
            )}
        </div>
    );
}

export default Editor;