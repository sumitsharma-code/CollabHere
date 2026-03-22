import { useEffect, useRef, useState } from 'react';

export default function VideoCall({
    callState, incomingCall, currentPeer,
    isMuted, isCamOff, callError,
    localVideoRef, remoteVideoRef,
    acceptCall, rejectCall, endCall,
    toggleMute, toggleCamera,
}) {
    const [duration, setDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const timerRef = useRef(null);
    const callWindowRef = useRef(null);

    // Call duration timer
    useEffect(() => {
        if (callState === 'connected') {
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [callState]);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === callWindowRef.current);
        };

        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement === callWindowRef.current) {
                await document.exitFullscreen();
                return;
            }

            if (callWindowRef.current) {
                await callWindowRef.current.requestFullscreen();
            }
        } catch {
            // Ignore unsupported/fullscreen permission errors.
        }
    };

    const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <>
            {/* ── Error toast (shown briefly after rejected/failed) ── */}
            {callError && callState === 'idle' && (
                <div className="call-toast">⚠️ {callError}</div>
            )}

            {/* ── Incoming call notification ─────────────────────── */}
            {callState === 'incoming' && incomingCall && (
                <div className="call-incoming-card">
                    <div className="call-window-titlebar">
                        <span className="call-window-title">📞 Incoming Call</span>
                        <div className="call-ringing-anim"><span /><span /><span /></div>
                    </div>
                    <div className="call-incoming-body">
                        <div className="call-caller-avatar">
                            {incomingCall.callerName?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="call-caller-name">{incomingCall.callerName}</div>
                        <div className="call-caller-sub">is calling you…</div>
                        <div className="call-incoming-actions">
                            <button id="call-reject-btn" className="call-btn-reject" onClick={rejectCall}>
                                📵 Decline
                            </button>
                            <button id="call-accept-btn" className="call-btn-accept" onClick={acceptCall}>
                                📞 Accept
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Outbound ringing banner ────────────────────────── */}
            {callState === 'ringing' && (
                <div className="call-ringing-banner">
                    <div className="call-ringing-anim" style={{ marginRight: 10 }}>
                        <span /><span /><span />
                    </div>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Calling {currentPeer?.name}…
                    </span>
                    <button id="call-cancel-btn" className="call-btn-reject" style={{ marginLeft: 'auto' }} onClick={endCall}>
                        ✕ Cancel
                    </button>
                </div>
            )}

            {/* ── Active call window ─────────────────────────────── */}
            {(callState === 'connected' || callState === 'connecting') && (
                <div className="call-window" id="call-window" ref={callWindowRef}>
                    {/* Title bar */}
                    <div className="call-window-titlebar">
                        <span className="call-window-title">
                            📹 {currentPeer?.name ?? 'Call'} — {callState === 'connecting' ? 'Connecting…' : fmt(duration)}
                        </span>
                        <div className="window-titlebar-dots">
                            <button
                                id="call-fullscreen-btn"
                                className="window-dot window-dot-max"
                                style={{ cursor: 'pointer' }}
                                onClick={toggleFullscreen}
                                title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                            />
                            <button
                                className="window-dot window-dot-close"
                                style={{ cursor: 'pointer' }}
                                onClick={endCall}
                                title="End call"
                            />
                        </div>
                    </div>

                    {/* Video area */}
                    <div className="call-video-area">
                        {/* Remote (main) */}
                        <video
                            ref={remoteVideoRef}
                            id="call-remote-video"
                            className="call-remote-video"
                            autoPlay
                            playsInline
                        />

                        {/* Fallback avatar shown until remote stream arrives */}
                        <div className="call-remote-placeholder">
                            <div className="call-remote-avatar">
                                {currentPeer?.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="call-remote-name">{currentPeer?.name}</div>
                            <div className="call-connecting-dots">
                                <span /><span /><span />
                            </div>
                        </div>

                        {/* Local PiP (bottom-right) */}
                        <div className="call-local-pip">
                            <video
                                ref={localVideoRef}
                                id="call-local-video"
                                className="call-local-video"
                                autoPlay
                                playsInline
                                muted
                            />
                            {isCamOff && (
                                <div className="call-cam-off-overlay">📷 Off</div>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="call-controls">
                        <button
                            id="call-mute-btn"
                            className={`call-ctrl-btn ${isMuted ? 'call-ctrl-active' : ''}`}
                            onClick={toggleMute}
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? '🔇' : '🎙️'}
                            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                        </button>

                        <button
                            id="call-end-btn"
                            className="call-ctrl-btn call-ctrl-end"
                            onClick={endCall}
                            title="End call"
                        >
                            📵 <span>End</span>
                        </button>

                        <button
                            id="call-cam-btn"
                            className={`call-ctrl-btn ${isCamOff ? 'call-ctrl-active' : ''}`}
                            onClick={toggleCamera}
                            title={isCamOff ? 'Camera On' : 'Camera Off'}
                        >
                            {isCamOff ? '📷' : '📹'}
                            <span>{isCamOff ? 'Cam On' : 'Cam Off'}</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
