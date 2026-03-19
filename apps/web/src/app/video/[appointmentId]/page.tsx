"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic, MicOff, Video, VideoOff, Monitor, Phone, MessageSquare, X,
  Circle, Square, Send
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

interface ChatMsg {
  fromUserId: number;
  text: string;
  ts: number;
}

// ICE servers config
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function VideoRoomPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();

  // State
  const [status, setStatus] = useState<"loading" | "connecting" | "connected" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [isRecording, setIsRecording] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState<"idle" | "waiting" | "approved">("idle");
  const [remoteUserId, setRemoteUserId] = useState<number | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoTokenRef = useRef<string>("");
  const myUserIdRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollTsRef = useRef<number>(Date.now() - 5000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const isInitiatorRef = useRef<boolean>(false);
  const makingOfferRef = useRef<boolean>(false);
  const ignoreOfferRef = useRef<boolean>(false);

  // ── Signal helpers ─────────────────────────────────────────────────────────
  const sendSignal = useCallback(async (type: string, payload: unknown, toUserId?: number) => {
    try {
      await fetch(`${API_BASE}/video/signal/${appointmentId}?token=${videoTokenRef.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload, toUserId }),
      });
    } catch (e) {
      console.error("Signal send error", e);
    }
  }, [appointmentId]);

  // ── Build PeerConnection ───────────────────────────────────────────────────
  const buildPeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal("ice-candidate", candidate);
    };

    pc.ontrack = ({ streams }) => {
      if (remoteVideoRef.current && streams[0]) {
        remoteVideoRef.current.srcObject = streams[0];
        setPeerConnected(true);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setStatus("connected");
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
      }
      if (state === "failed" || state === "disconnected") {
        setPeerConnected(false);
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        if (makingOfferRef.current) return;
        makingOfferRef.current = true;
        await pc.setLocalDescription();
        sendSignal("offer", pc.localDescription);
      } catch (e) {
        console.error("Negotiation error", e);
      } finally {
        makingOfferRef.current = false;
      }
    };

    return pc;
  }, [sendSignal]);

  // ── Handle incoming signals ───────────────────────────────────────────────
  const handleSignal = useCallback(async (msg: any) => {
    const pc = pcRef.current;

    if (msg.type === "peer-joined") {
      setRemoteUserId(msg.fromUserId);
      // If we joined second, the first peer initiates
    }

    if (msg.type === "peer-left") {
      setPeerConnected(false);
      setStatus("connecting");
      return;
    }

    if (msg.type === "chat") {
      setChatMessages((prev) => [
        ...prev,
        { fromUserId: msg.fromUserId, text: msg.payload?.text ?? "", ts: msg.payload?.ts ?? Date.now() },
      ]);
      return;
    }

    if (msg.type === "recording-consent-request") {
      setRecordingConsent("waiting");
      return;
    }
    if (msg.type === "recording-consent-approved") {
      setRecordingConsent("approved");
      return;
    }

    if (!pc) return;

    if (msg.type === "offer") {
      const offerCollision =
        makingOfferRef.current || pc.signalingState !== "stable";
      ignoreOfferRef.current = !isInitiatorRef.current && offerCollision;
      if (ignoreOfferRef.current) return;

      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
      await pc.setLocalDescription();
      sendSignal("answer", pc.localDescription);
      setRemoteUserId(msg.fromUserId);
    }

    if (msg.type === "answer") {
      if (pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
    }

    if (msg.type === "ice-candidate" && msg.payload) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
      } catch (e) {
        if (!ignoreOfferRef.current) console.error("ICE error", e);
      }
    }
  }, [sendSignal]);

  // ── Polling loop ─────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const since = lastPollTsRef.current;
        const res = await fetch(
          `${API_BASE}/video/signal/${appointmentId}?token=${videoTokenRef.current}&since=${since}`
        );
        if (!res.ok) return;
        const data = await res.json();
        lastPollTsRef.current = data.serverTime ?? Date.now();
        for (const msg of data.messages ?? []) {
          await handleSignal(msg);
        }
      } catch { /* ignore network errors */ }
    }, 800);
  }, [appointmentId, handleSignal]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Get JWT access token from localStorage/cookie
        const jwtToken = localStorage.getItem("accessToken") || "";

        // 2. Get video token
        const tokenRes = await fetch(`${API_BASE}/video/token/${appointmentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
          },
          credentials: "include",
        });

        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          setErrorMsg(err.message || err.error || "Nelze získat přístup k video sezení.");
          setStatus("error");
          return;
        }

        const { token, userId } = await tokenRes.json();
        if (cancelled) return;
        videoTokenRef.current = token;
        myUserIdRef.current = userId;

        // 3. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 4. Build peer connection
        buildPeerConnection(stream);
        setStatus("connecting");

        // 5. Announce presence and start polling
        lastPollTsRef.current = Date.now() - 2000;
        await sendSignal("peer-joined", { userId });
        startPolling();

        // 6. Check if anyone is already in room — trigger offer after short delay
        isInitiatorRef.current = false;
        setTimeout(async () => {
          // Query peers via a presence poll
          const since = lastPollTsRef.current - 10000;
          const res = await fetch(
            `${API_BASE}/video/signal/${appointmentId}?token=${token}&since=${since}`
          );
          if (res.ok) {
            const data = await res.json();
            const peerJoins = (data.messages ?? []).filter((m: any) => m.type === "peer-joined");
            if (peerJoins.length > 0) {
              // Someone is already there — we initiate the offer
              isInitiatorRef.current = true;
              const pc = pcRef.current;
              if (pc) {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                sendSignal("offer", pc.localDescription);
              }
            }
          }
        }, 1500);
      } catch (e: any) {
        if (cancelled) return;
        console.error(e);
        setErrorMsg(e.message || "Chyba při připojení k video sezení.");
        setStatus("error");
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [appointmentId, buildPeerConnection, sendSignal, startPolling]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current?.stop();
      // Send leave signal (best-effort)
      if (videoTokenRef.current) {
        fetch(`${API_BASE}/video/signal/${appointmentId}?token=${videoTokenRef.current}`, {
          method: "DELETE",
        }).catch(() => {});
      }
    };
  }, [appointmentId]);

  // ── Controls ──────────────────────────────────────────────────────────────
  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsMuted((m) => !m);
  }

  function toggleCamera() {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsCameraOff((v) => !v);
  }

  async function toggleScreenShare() {
    const pc = pcRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Revert to camera
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(camTrack);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(screenTrack);
        screenTrack.onended = () => toggleScreenShare();
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        setIsScreenSharing(true);
      } catch { /* user cancelled */ }
    }
  }

  function sendChat() {
    if (!chatInput.trim()) return;
    sendSignal("chat", { text: chatInput.trim(), ts: Date.now() });
    setChatMessages((prev) => [
      ...prev,
      { fromUserId: myUserIdRef.current, text: chatInput.trim(), ts: Date.now() },
    ]);
    setChatInput("");
  }

  function endCall() {
    router.back();
  }

  async function startRecording() {
    // Ask for remote consent first
    setRecordingConsent("waiting");
    await sendSignal("recording-consent-request", {});
  }

  function approveRecording() {
    sendSignal("recording-consent-approved", {});
    doStartRecording();
  }

  function doStartRecording() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const chunks: Blob[] = [];
    recordedChunksRef.current = chunks;
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${appointmentId}-${new Date().toISOString().slice(0, 10)}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    mr.start(1000);
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingConsent("idle");
  }

  // ── Format timer ─────────────────────────────────────────────────────────
  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Připojuji se k video sezení…</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center max-w-md px-4">
          <div className="text-red-400 text-5xl mb-4">⚠</div>
          <h2 className="text-xl font-bold mb-2">Nelze se připojit</h2>
          <p className="text-gray-400 mb-6">{errorMsg}</p>
          <button onClick={() => router.back()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl">
            Zpět
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header bar */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${peerConnected ? "bg-green-400" : "bg-yellow-400"} animate-pulse`} />
          <span className="text-white text-sm font-medium">
            {peerConnected ? "Připojeno" : "Čekám na účastníka…"}
          </span>
        </div>
        <div className="text-gray-300 text-sm font-mono">{fmt(elapsed)}</div>
        {isRecording && (
          <div className="flex items-center gap-1 text-red-400 text-xs animate-pulse">
            <Circle size={8} fill="currentColor" /> Nahrávám
          </div>
        )}
      </div>

      {/* Video area */}
      <div className="flex-1 relative flex">
        {/* Remote video */}
        <div className="flex-1 relative bg-gray-950">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
          {!peerConnected && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-3">
                  <Video size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-400 text-sm">
                  {status === "connecting" ? "Čekám na připojení druhé strany…" : "Připojuji…"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Local video (PiP) */}
        <div className="absolute bottom-4 right-4 w-32 h-24 md:w-48 md:h-36 rounded-xl overflow-hidden border-2 border-gray-600 bg-gray-800 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isCameraOff && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff size={20} className="text-gray-400" />
            </div>
          )}
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <span className="text-white font-medium text-sm">Chat</span>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-gray-500 text-xs text-center pt-4">Žádné zprávy</p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} className={`text-sm px-3 py-2 rounded-lg ${m.fromUserId === myUserIdRef.current ? "bg-blue-600 text-white ml-4" : "bg-gray-700 text-gray-100 mr-4"}`}>
                  {m.text}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-700 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                placeholder="Napište zprávu…"
                className="flex-1 bg-gray-700 text-white text-sm px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
              />
              <button onClick={sendChat} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg">
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recording consent modal */}
      {recordingConsent === "waiting" && remoteUserId === null && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full mx-4 text-white">
            <h3 className="font-bold text-lg mb-2">Souhlas s nahráváním</h3>
            <p className="text-gray-300 text-sm mb-4">Druhá strana požádala o souhlas s nahráváním sezení.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setRecordingConsent("idle")}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm"
              >Odmítnout</button>
              <button
                onClick={approveRecording}
                className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg text-sm"
              >Souhlasím</button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-center gap-4 flex-wrap">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMuted ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-500"}`}
          title={isMuted ? "Zapnout mikrofon" : "Vypnout mikrofon"}
        >
          {isMuted ? <MicOff size={20} className="text-white" /> : <Mic size={20} className="text-white" />}
        </button>

        {/* Camera */}
        <button
          onClick={toggleCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-500"}`}
          title={isCameraOff ? "Zapnout kameru" : "Vypnout kameru"}
        >
          {isCameraOff ? <VideoOff size={20} className="text-white" /> : <Video size={20} className="text-white" />}
        </button>

        {/* Screen share */}
        <button
          onClick={toggleScreenShare}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-500"}`}
          title={isScreenSharing ? "Zastavit sdílení obrazovky" : "Sdílet obrazovku"}
        >
          <Monitor size={20} className="text-white" />
        </button>

        {/* Chat */}
        <button
          onClick={() => setShowChat((v) => !v)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${showChat ? "bg-blue-600" : "bg-gray-600 hover:bg-gray-500"}`}
          title="Chat"
        >
          <MessageSquare size={20} className="text-white" />
        </button>

        {/* Recording */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-500 flex items-center justify-center"
            title="Nahrávat sezení"
          >
            <Circle size={20} className="text-white" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center animate-pulse"
            title="Zastavit nahrávání"
          >
            <Square size={20} className="text-white" />
          </button>
        )}

        {/* End call */}
        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
          title="Ukončit hovor"
        >
          <Phone size={22} className="text-white rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}
