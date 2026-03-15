// Real WebRTC P2P implementation with Socket.IO

let localStream = null;
let peerConnection = null;
let currentRole = null;
let currentSessionId = null;
let socket = null;
let isMuted = false;
let isCameraOff = false;
let isAiDoctorSession = false; // true when role === 'ai-doctor' or URL has aiConsultation=true
let aiAudioElement = null;
let aiAudioListenerAttached = false;
let patientAudioRecorder = null;
let patientAudioSendingActive = false;
const PATIENT_AUDIO_CHUNK_MS = 4000; // send audio every 4 seconds when in AI session

// ICE Config
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Parse token
function getTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    return JSON.parse(atob(parts[1]));
  } catch (e) {
    console.error('Invalid token', e);
    return null;
  }
}

function getAiConsultationFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('aiConsultation') === 'true' || params.get('aiConsultation') === '1';
}

function displayAiAvatar(placement) {
  const container = document.getElementById('videoContainer');
  const existing = container.querySelector('.ai-avatar-placeholder');
  if (existing) existing.remove();

  const isRemote = placement === 'remote';
  const wrapper = document.createElement('div');
  wrapper.className = 'video-participant ai-avatar-placeholder ' + (isRemote ? 'remote' : 'local');
  wrapper.innerHTML = `
    <div class="ai-avatar">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1c2.76 0 5 2.24 5 5v1h1c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-1v1c0 2.76-2.24 5-5 5h-2c-2.76 0-5-2.24-5-5v-1H4c-.55 0-1-.45-1-1v-2c0-.55.45-1 1-1h1v-1c0-2.76 2.24-5 5-5h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" fill="currentColor"/>
        <circle cx="9" cy="13" r="1.5" fill="var(--background)"/>
        <circle cx="15" cy="13" r="1.5" fill="var(--background)"/>
      </svg>
    </div>
    <div class="participant-info">
      <div class="participant-name">${isRemote ? 'AI Doctor' : 'You (AI)'}</div>
      <div class="participant-role">${isRemote ? 'Listening...' : 'Connected'}</div>
    </div>
  `;
  if (isRemote) {
    wrapper.id = 'remoteVideoContainer';
    const first = container.querySelector('.local') || container.firstElementChild;
    if (first) container.insertBefore(wrapper, first);
    else container.appendChild(wrapper);
  } else {
    container.insertBefore(wrapper, container.firstElementChild);
  }
}

function setupAiAudioListener() {
  if (!aiAudioElement) {
    aiAudioElement = document.createElement('audio');
    aiAudioElement.setAttribute('autoplay', '');
    aiAudioElement.style.display = 'none';
    document.body.appendChild(aiAudioElement);
  }
  if (aiAudioListenerAttached || !socket) return;
  aiAudioListenerAttached = true;
  socket.on('ai-audio', (audioBase64) => {
    if (!audioBase64 || !aiAudioElement) return;
    try {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      aiAudioElement.src = url;
      aiAudioElement.play().catch(() => {});
      aiAudioElement.onended = () => URL.revokeObjectURL(url);
    } catch (e) {
      console.error('ai-audio play error', e);
    }
  });
}

function startPatientAudioSend() {
  if (!isAiDoctorSession || !localStream || !socket || !socket.connected) return;
  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length === 0) return;
  if (patientAudioRecorder) return;

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';

  function scheduleChunk() {
    if (!patientAudioSendingActive || !localStream || !socket || !socket.connected) return;
    const stream = new MediaStream(localStream.getAudioTracks());
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
    recorder.ondataavailable = (e) => {
      if (e.data.size === 0 || isMuted) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(reader.result)));
        socket.emit('patient-audio', { audio: base64 });
      };
      reader.readAsArrayBuffer(e.data);
    };
    recorder.onstop = () => {
      patientAudioRecorder = null;
      if (patientAudioSendingActive) setTimeout(scheduleChunk, 100);
    };
    patientAudioRecorder = recorder;
    recorder.start();
    setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, PATIENT_AUDIO_CHUNK_MS);
  }

  try {
    patientAudioSendingActive = true;
    scheduleChunk();
    showStatus('Speak now — the AI will respond in a few seconds.');
    console.log('[AI Session] Sending complete webm every', PATIENT_AUDIO_CHUNK_MS / 1000, 's');
  } catch (e) {
    console.error('Failed to start patient audio send', e);
  }
}

function stopPatientAudioSend() {
  patientAudioSendingActive = false;
  if (patientAudioRecorder && patientAudioRecorder.state !== 'inactive') {
    patientAudioRecorder.stop();
    patientAudioRecorder = null;
  }
}

async function initializeCall() {
  const token = getTokenFromURL();
  if (!token) return showError('No token found');

  const payload = decodeJWT(token);
  if (!payload) return showError('Invalid token');

  currentRole = payload.role;
  currentSessionId = payload.sessionId;
  isAiDoctorSession = currentRole === 'ai-doctor' || getAiConsultationFromURL();

  const sessionInfoEl = document.getElementById('sessionInfo');
  if (sessionInfoEl) sessionInfoEl.textContent = `Session: ${currentSessionId.substr(0,8)}... | Role: ${currentRole}${isAiDoctorSession ? ' (AI)' : ''}`;

  if (currentRole === 'ai-doctor') {
    updateStatus('Connecting...');
    displayAiAvatar('local');
    socket = io();
    socket.on('connect', () => {
      updateStatus('Connected');
      socket.emit('join-room', currentSessionId, currentRole);
      setupAiAudioListener();
    });
    document.getElementById('toggleMic')?.setAttribute('disabled', 'true');
    document.getElementById('toggleCamera')?.setAttribute('disabled', 'true');
    return;
  }

  updateStatus('Requesting Media Access...');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
    });

    displayLocalVideo(localStream);
    if (isAiDoctorSession) {
      displayAiAvatar('remote');
    }
    updateStatus('Connecting to Server...');

    socket = io();

    socket.on('connect', () => {
        updateStatus('Connected to Signaling Server');
        console.log('Socket connected:', socket.id);
        socket.emit('join-room', currentSessionId, currentRole);
        if (isAiDoctorSession) {
          setupAiAudioListener();
          startPatientAudioSend();
        }
    });

    socket.on('user-connected', (userId) => {
        console.log('User connected:', userId);
        if (isAiDoctorSession && typeof userId === 'string' && userId.startsWith('ai-doctor')) {
          showStatus('AI Doctor is here. You can speak.');
          return;
        }
        showStatus('Peer joined. Connecting...');
        createPeerConnection();
        createOffer();
    });

    socket.on('signal', async (data) => {
        const { type, sdp, candidate } = data;
        if (isAiDoctorSession && !peerConnection) return;

        if (!peerConnection) createPeerConnection();

        if (type === 'offer') {
            console.log('Received Offer');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            createAnswer();
        } else if (type === 'answer') {
            console.log('Received Answer');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        } else if (candidate) {
            console.log('Received ICE Candidate');
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        }
    });

  } catch (err) {
    console.error(err);
    showError('Media Access Denied or Error: ' + err.message);
  }
}

function createPeerConnection() {
    if (peerConnection) return; // Already exists

    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }

    // Handle remote track
    peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        const [remoteStream] = event.streams;
        displayRemoteVideo(remoteStream);
        showStatus('Connected');
    };

    // ICE Candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('signal', {
                room: currentSessionId,
                candidate: event.candidate
            });
        }
    };
    
    // Connection State
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        updateStatus(state.charAt(0).toUpperCase() + state.slice(1));
        if (state === 'disconnected' || state === 'failed') {
            document.getElementById('remoteVideoContainer').innerHTML = ''; // Clear remote
            showStatus('Peer disconnected');
            // Clean up
            peerConnection.close();
            peerConnection = null;
        }
    };
}

async function createOffer() {
    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', {
            room: currentSessionId,
            type: 'offer',
            sdp: offer
        });
    } catch (err) {
        console.error('Error creating offer', err);
    }
}

async function createAnswer() {
    try {
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', {
            room: currentSessionId,
            type: 'answer',
            sdp: answer
        });
    } catch (err) {
        console.error('Error creating answer', err);
    }
}


// UI Helpers
function displayLocalVideo(stream) {
    const container = document.getElementById('videoContainer');
    // Clear any existing local video to prevent duplicates, but keep remote container if it exists
    const existingLocal = container.querySelector('.local');
    if (existingLocal) existingLocal.remove();

    // Create wrapper for local
    const wrapper = document.createElement('div');
    wrapper.className = 'video-participant local'; // ADDED 'local' class
    wrapper.innerHTML = `
        <video autoplay playsinline muted></video>
        <div class="participant-info">
            <div class="participant-name">You</div>
        </div>
    `;
    const video = wrapper.querySelector('video');
    video.srcObject = stream;
    container.appendChild(wrapper);

    // Create placeholder container for remote if not exists
    if (!document.getElementById('remoteVideoContainer')) {
        const remoteWrapper = document.createElement('div');
        remoteWrapper.id = 'remoteVideoContainer';
        // Make sure remote container fills the space or is ready to
        remoteWrapper.className = 'video-participant remote'; // ADDED 'remote' class for the container
        remoteWrapper.style.display = 'none'; // Hide until stream arrives
        container.insertBefore(remoteWrapper, wrapper); // Put remote BEHIND local (in DOM order, though z-index handles it)
    }
}

function displayRemoteVideo(stream) {
    const container = document.getElementById('videoContainer');
    
    // Check for existing remote container, or create one if missing
    let wrapper = document.getElementById('remoteVideoContainer');
    
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'remoteVideoContainer';
        wrapper.className = 'video-participant remote';
        container.insertBefore(wrapper, container.querySelector('.local'));
    }
    
    wrapper.style.display = 'block';
    // Reset content
    wrapper.innerHTML = `
        <video autoplay playsinline></video>
         <div class="participant-info">
            <div class="participant-name">Remote Peer</div>
            <div class="participant-role">Connected</div>
        </div>
    `;
    
    const video = wrapper.querySelector('video');
    video.srcObject = stream;
}


function updateStatus(msg) {
    const el = document.getElementById('connectionStatus');
    if (el) el.textContent = msg;
}

function showStatus(msg) {
      const statusEl = document.getElementById('statusMessage');
      if (statusEl) {
        statusEl.textContent = msg;
        statusEl.style.display = msg ? 'block' : 'none';
      }
}

function showError(msg) {
    alert(msg);
}

// Controls
document.getElementById('toggleMic')?.addEventListener('click', (e) => {
    isMuted = !isMuted;
    if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    e.currentTarget.innerHTML = `<span>🎤</span> ${isMuted ? 'Unmute' : 'Mute'}`;
});

document.getElementById('toggleCamera')?.addEventListener('click', (e) => {
    isCameraOff = !isCameraOff;
    if (localStream) localStream.getVideoTracks().forEach(t => t.enabled = !isCameraOff);
    e.currentTarget.innerHTML = `<span>📹</span> ${isCameraOff ? 'Camera On' : 'Camera Off'}`;
});

document.getElementById('leaveCall')?.addEventListener('click', () => {
    stopPatientAudioSend();
    if (confirm('Leave call?')) window.close();
});


// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCall);
} else {
    initializeCall();
}
