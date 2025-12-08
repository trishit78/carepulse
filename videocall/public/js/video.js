// Real WebRTC P2P implementation with Socket.IO

let localStream = null;
let peerConnection = null;
let currentRole = null;
let currentSessionId = null;
let socket = null;
let isMuted = false;
let isCameraOff = false;

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

async function initializeCall() {
  const token = getTokenFromURL();
  if (!token) return showError('No token found');

  const payload = decodeJWT(token);
  if (!payload) return showError('Invalid token');

  currentRole = payload.role;
  currentSessionId = payload.sessionId;

  // Update UI
  const sessionInfoEl = document.getElementById('sessionInfo');
  if (sessionInfoEl) sessionInfoEl.textContent = `Session: ${currentSessionId.substr(0,8)}... | Role: ${currentRole}`;
  
  updateStatus('Requesting Media Access...');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
    });
    
    displayLocalVideo(localStream);
    updateStatus('Connecting to Server...');

    // Connect Socket options
    // Note: 'io' global is provided by /socket.io/socket.io.js
    socket = io(); 

    socket.on('connect', () => {
        updateStatus('Connected to Signaling Server');
        console.log('Socket connected:', socket.id);
        socket.emit('join-room', currentSessionId, currentRole);
    });

    socket.on('user-connected', (userId) => {
        console.log('User connected:', userId);
        showStatus('Peer joined. Connecting...');
        // We are the existing user, so we initiate the offer
        createPeerConnection();
        createOffer();
    });

    // Handle signals passed via 'signal' event or specific events
    // Backend implementation:
    // socket.to(room).emit('signal', { sender: socket.id, ...rest });

    socket.on('signal', async (data) => {
        const { type, sdp, candidate } = data;
        
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

    // Legacy handler if we change backend logic slightly
    // socket.on('offer') ... etc

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
    if (confirm('Leave call?')) window.close();
});


// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCall);
} else {
    initializeCall();
}
