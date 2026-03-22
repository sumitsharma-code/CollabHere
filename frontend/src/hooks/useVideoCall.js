import { useState, useRef, useEffect, useCallback } from 'react';
import socket from '../services/socket';

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ],
};

export function useVideoCall(workspaceId, myId, myName) {
    const [callState, setCallState]     = useState('idle');
    // 'idle' | 'ringing' | 'incoming' | 'connecting' | 'connected'
    const [incomingCall, setIncomingCall] = useState(null);
    const [currentPeer, setCurrentPeer]   = useState(null);
    const [isMuted,  setIsMuted]          = useState(false);
    const [isCamOff, setIsCamOff]         = useState(false);
    const [callError, setCallError]       = useState('');

    // Refs so socket handlers never have stale closures
    const callStateRef    = useRef('idle');
    const currentPeerRef  = useRef(null);
    const incomingCallRef = useRef(null);

    // Sync helpers
    const setCS = useCallback((s) => { callStateRef.current = s;    setCallState(s);     }, []);
    const setCP = useCallback((p) => { currentPeerRef.current = p;   setCurrentPeer(p);   }, []);
    const setIC = useCallback((c) => { incomingCallRef.current = c;  setIncomingCall(c);  }, []);

    // Video element refs
    const localVideoRef  = useRef(null);
    const remoteVideoRef = useRef(null);

    // WebRTC refs
    const pcRef             = useRef(null);
    const localStreamRef    = useRef(null);
    const pendingCandidates = useRef([]);
    const remoteDescSet     = useRef(false);

    // ── Tear down media + peer connection ───────────────────
    const terminate = useCallback(() => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        pcRef.current?.close();
        pcRef.current = null;
        if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        pendingCandidates.current = [];
        remoteDescSet.current     = false;
        setIsMuted(false);
        setIsCamOff(false);
    }, []);

    // ── Get camera + mic ────────────────────────────────────
    const getLocalStream = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        return stream;
    }, []);

    // ── Create RTCPeerConnection ────────────────────────────
    const createPC = useCallback((targetUserId) => {
        pcRef.current?.close();
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;
        pc.onicecandidate = ({ candidate }) => {
            if (candidate) socket.emit('call:ice-candidate', { targetUserId, candidate });
        };
        pc.ontrack = (ev) => {
            if (remoteVideoRef.current && ev.streams[0])
                remoteVideoRef.current.srcObject = ev.streams[0];
        };
        return pc;
    }, []);

    // ── Flush queued ICE candidates ─────────────────────────
    const flushCandidates = useCallback(async () => {
        for (const c of pendingCandidates.current) {
            try { await pcRef.current?.addIceCandidate(c); } catch { /* ignore */ }
        }
        pendingCandidates.current = [];
    }, []);

    // ── Public: end call (user action) ──────────────────────
    const endCall = useCallback(() => {
        const peer = currentPeerRef.current;
        if (peer?.userId) socket.emit('call:end', { targetUserId: peer.userId });
        terminate();
        setCS('idle'); setCP(null); setIC(null); setCallError('');
    }, [terminate, setCS, setCP, setIC]);

    // ── Public: initiate call ───────────────────────────────
    const initiateCall = useCallback((targetUser) => {
        if (callStateRef.current !== 'idle') return;
        setCS('ringing'); setCP(targetUser); setCallError('');
        socket.emit('call:request', {
            targetUserId: targetUser.userId,
            callerId:     myId,
            callerName:   myName,
            workspaceId,
        });
    }, [myId, myName, workspaceId, setCS, setCP]);

    // ── Public: accept incoming call ────────────────────────
    const acceptCall = useCallback(async () => {
        const ic = incomingCallRef.current;
        if (!ic) return;
        try {
            await getLocalStream();
            setCS('connecting');  // wait for offer/answer before 'connected'
            setCP({ userId: ic.callerId, name: ic.callerName });
            setIC(null);
            socket.emit('call:accept', { callerId: ic.callerId, accepterId: myId, accepterName: myName });
        } catch {
            setCallError('Camera/mic access denied');
            setCS('idle'); setIC(null);
            socket.emit('call:reject', { callerId: ic.callerId });
        }
    }, [myId, myName, getLocalStream, setCS, setCP, setIC]);

    // ── Public: reject incoming call ────────────────────────
    const rejectCall = useCallback(() => {
        const ic = incomingCallRef.current;
        if (!ic) return;
        socket.emit('call:reject', { callerId: ic.callerId });
        setIC(null); setCS('idle');
    }, [setIC, setCS]);

    // ── Toggle mute / camera ────────────────────────────────
    const toggleMute = useCallback(() => {
        const t = localStreamRef.current?.getAudioTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        setIsMuted(!t.enabled);
    }, []);

    const toggleCamera = useCallback(() => {
        const t = localStreamRef.current?.getVideoTracks()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        setIsCamOff(!t.enabled);
    }, []);

    // ── All socket listeners ────────────────────────────────
    useEffect(() => {
        if (!myId) return;

        const onIncoming = ({ callerId, callerName, workspaceId: wId }) => {
            if (wId !== workspaceId) return;
            if (callStateRef.current !== 'idle') {
                socket.emit('call:reject', { callerId }); return;
            }
            setIC({ callerId, callerName });
            setCS('incoming');
        };

        // Caller: callee accepted → get media, create + send offer
        const onAccepted = async ({ accepterId, accepterName }) => {
            try {
                const stream = await getLocalStream();
                const pc = createPC(accepterId);
                stream.getTracks().forEach(t => pc.addTrack(t, stream));
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('call:offer', { targetUserId: accepterId, offer: pc.localDescription });
                setCP(prev => ({ ...prev, userId: accepterId, name: accepterName || prev?.name }));
                setCS('connected');  // caller is connected once offer is sent
            } catch (err) {
                setCallError('Failed to start video: ' + err.message);
                terminate(); setCS('idle'); setCP(null);
            }
        };

        // Callee: received offer → create PC, create + send answer
        const onOffer = async ({ offer, callerId }) => {
            try {
                const stream = localStreamRef.current;
                const pc = createPC(callerId);
                if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                remoteDescSet.current = true;
                await flushCandidates();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('call:answer', { targetUserId: callerId, answer: pc.localDescription });
                setCS('connected');  // callee is connected once answer is sent
            } catch (err) {
                setCallError('Connection failed: ' + err.message);
                terminate(); setCS('idle'); setCP(null);
            }
        };

        // Caller: received answer → set remote desc
        const onAnswer = async ({ answer }) => {
            try {
                if (!pcRef.current) return;
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                remoteDescSet.current = true;
                await flushCandidates();
            } catch (err) {
                setCallError('Answer failed: ' + err.message);
            }
        };

        const onIce = async ({ candidate }) => {
            if (!candidate) return;
            const c = new RTCIceCandidate(candidate);
            if (pcRef.current && remoteDescSet.current) {
                try { await pcRef.current.addIceCandidate(c); } catch { /* ignore */ }
            } else {
                pendingCandidates.current.push(c);
            }
        };

        const onRejected = () => {
            terminate(); setCS('idle'); setCP(null);
            setCallError('Call was declined');
            setTimeout(() => setCallError(''), 3000);
        };

        const onEnded = () => {
            terminate(); setCS('idle'); setCP(null); setIC(null);
        };

        const onCallError = ({ message }) => {
            setCallError(message); terminate(); setCS('idle'); setCP(null);
        };

        socket.on('call:incoming',      onIncoming);
        socket.on('call:accepted',      onAccepted);
        socket.on('call:offer',         onOffer);
        socket.on('call:answer',        onAnswer);
        socket.on('call:ice-candidate', onIce);
        socket.on('call:rejected',      onRejected);
        socket.on('call:ended',         onEnded);
        socket.on('call:error',         onCallError);

        return () => {
            socket.off('call:incoming',      onIncoming);
            socket.off('call:accepted',      onAccepted);
            socket.off('call:offer',         onOffer);
            socket.off('call:answer',        onAnswer);
            socket.off('call:ice-candidate', onIce);
            socket.off('call:rejected',      onRejected);
            socket.off('call:ended',         onEnded);
            socket.off('call:error',         onCallError);
        };
    }, [myId, workspaceId, getLocalStream, createPC, flushCandidates, terminate,
        setCS, setCP, setIC]);

    return {
        callState, incomingCall, currentPeer,
        isMuted, isCamOff, callError,
        localVideoRef, remoteVideoRef,
        initiateCall, acceptCall, rejectCall, endCall,
        toggleMute, toggleCamera,
    };
}
