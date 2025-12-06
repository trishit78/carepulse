// Simple WebRTC-based video call implementation
// This is a basic implementation - in production, you'd use a proper SFU SDK

let localStream = null;
let peerConnections = new Map();
let currentRole = null;
let currentSessionId = null;
let currentRoomName = null;
let permissions = [];
let isMuted = false;
let isCameraOff = false;

// Parse token from URL
function getTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

// Decode JWT (simple base64 decode - in production, verify signature)
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
}

// Initialize video call
async function initializeCall() {
  console.log('Initializing video call...');
  
  // Wait a bit to ensure DOM is ready
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const token = getTokenFromURL();
  console.log('Token from URL:', token ? 'Found' : 'Missing');
  
  if (!token) {
    showError('No token provided in URL. Please join the call from the dashboard.');
    return;
  }

  const payload = decodeJWT(token);
  console.log('Decoded payload:', payload);
  
  if (!payload) {
    showError('Invalid token. Please refresh and try again.');
    return;
  }

  currentRole = payload.role;
  currentSessionId = payload.sessionId;
  currentRoomName = payload.roomName;
  permissions = payload.permissions || [];

  console.log('Session info:', { currentRole, currentSessionId, currentRoomName });

  // Update UI (with null checks)
  const sessionInfoEl = document.getElementById('sessionInfo');
  if (sessionInfoEl) {
    sessionInfoEl.textContent = `Session: ${currentSessionId} | Role: ${currentRole}`;
  } else {
    console.warn('sessionInfo element not found');
  }
  updateConnectionStatus('Connecting...');

  // Show role-specific controls
  if (currentRole === 'doctor' && permissions.includes('end-call')) {
    const controlsEl = document.getElementById('controls');
    if (controlsEl) {
      const endCallBtn = document.createElement('button');
      endCallBtn.className = 'btn btn-danger';
      endCallBtn.textContent = 'End Call';
      endCallBtn.onclick = endCall;
      controlsEl.appendChild(endCallBtn);
    }
  }

  try {
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError('Your browser does not support video calling. Please use a modern browser like Chrome, Firefox, or Edge.');
      return;
    }

    // Check if we're on HTTPS or localhost (required for getUserMedia)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showError('Video calling requires HTTPS. Please access this page via HTTPS or localhost.');
      return;
    }

    updateConnectionStatus('Requesting camera/microphone access...');
    console.log('Requesting media access...');
    
    // Get user media with better error handling
    try {
      console.log('Calling getUserMedia...');
      // Try with simpler constraints first for better compatibility
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
      } catch (constraintError) {
        console.warn('Failed with ideal constraints, trying basic constraints...', constraintError);
        // Fallback to basic constraints
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }
      console.log('Media access granted!', localStream);
    } catch (mediaError) {
      console.error('Media access error:', mediaError);
      console.error('Media access error:', mediaError);
      
      // Provide specific error messages
      let errorMessage = 'Failed to access camera/microphone. ';
      
      if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow camera and microphone access in your browser settings and refresh the page.';
      } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
        errorMessage += 'No camera or microphone found. Please connect a camera and microphone.';
      } else if (mediaError.name === 'NotReadableError' || mediaError.name === 'TrackStartError') {
        errorMessage += 'Camera or microphone is being used by another application. Please close other applications using your camera/microphone.';
      } else if (mediaError.name === 'OverconstrainedError' || mediaError.name === 'ConstraintNotSatisfiedError') {
        errorMessage += 'Your device does not support the required video/audio settings.';
      } else {
        errorMessage += `Error: ${mediaError.message || mediaError.name}`;
      }
      
      showError(errorMessage);
      updateConnectionStatus('Permission Denied');
      return;
    }

    // Display local video
    console.log('Displaying local video...');
    displayLocalVideo(localStream);

    // In a real implementation, you would:
    // 1. Connect to SFU using roomName
    // 2. Handle signaling (WebSocket/HTTP)
    // 3. Create peer connections for other participants
    // 4. Handle ICE candidates and offers/answers

    // For now, simulate connection
    updateConnectionStatus('Connected');
    showStatus('Waiting for other participant...');
    console.log('Video call initialized successfully');

    // Simulate remote participant after 2 seconds (for demo)
    setTimeout(() => {
      simulateRemoteParticipant();
    }, 2000);

  } catch (error) {
    console.error('Unexpected error in initializeCall:', error);
    console.error('Error stack:', error.stack);
    showError(`Unexpected error: ${error.message || error}. Please check the browser console for details.`);
    updateConnectionStatus('Error');
  }
}

function displayLocalVideo(stream) {
  const container = document.getElementById('videoContainer');
  if (!container) {
    console.error('Video container not found');
    return;
  }
  container.innerHTML = '';

  const participantDiv = createParticipantElement('You', currentRole, stream, true);
  container.appendChild(participantDiv);
}

function createParticipantElement(name, role, stream, isLocal = false) {
  const div = document.createElement('div');
  div.className = 'video-participant';
  
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal; // Mute local video to avoid feedback
  
  if (stream) {
    video.srcObject = stream;
  }
  
  const info = document.createElement('div');
  info.className = 'participant-info';
  info.innerHTML = `
    <div>
      <div class="participant-name">${name}</div>
      <div class="participant-role">${role === 'doctor' ? '👨‍⚕️ Doctor (Host)' : '👤 Patient'}</div>
    </div>
  `;
  
  div.appendChild(video);
  div.appendChild(info);
  
  return div;
}

function simulateRemoteParticipant() {
  // In production, this would come from the SFU
  const container = document.getElementById('videoContainer');
  if (!container) {
    console.error('Video container not found');
    return;
  }
  const remoteDiv = createParticipantElement(
    currentRole === 'doctor' ? 'Patient' : 'Doctor',
    currentRole === 'doctor' ? 'patient' : 'doctor',
    null,
    false
  );
  container.appendChild(remoteDiv);
  showStatus('');
}

function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    statusEl.textContent = status;
  }
}

function showStatus(message) {
  const statusEl = document.getElementById('statusMessage');
  if (!statusEl) return;
  
  if (message) {
    statusEl.textContent = message;
    statusEl.style.display = 'block';
  } else {
    statusEl.style.display = 'none';
  }
}

function showError(message) {
  const container = document.getElementById('videoContainer');
  if (!container) {
    // If container doesn't exist, try to create a basic error display
    console.error('Video container not found, cannot display error');
    alert(`Error: ${message}\n\nPlease refresh the page and allow camera/microphone access.`);
    return;
  }
  container.innerHTML = `
    <div class="error-container">
      <div class="error-content">
        <h3>⚠️ Camera/Microphone Access Required</h3>
        <p style="margin-bottom: 1rem; line-height: 1.6;">${message}</p>
        <div style="font-size: 0.875rem; color: #999; margin-top: 1.5rem;">
          <p style="font-weight: 600; margin-bottom: 0.5rem; color: #fff;">How to fix:</p>
          <ol>
            <li>Look for the lock 🔒 or camera 📷 icon in your browser's address bar</li>
            <li>Click it and select "Allow" for camera and microphone</li>
            <li>Click the "Retry" button below or refresh the page</li>
          </ol>
        </div>
        <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 1.5rem;">
          🔄 Retry
        </button>
      </div>
    </div>
  `;
}

// Control handlers (with null checks)
const toggleMicBtn = document.getElementById('toggleMic');
if (toggleMicBtn) {
  toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
      isMuted = !isMuted;
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      toggleMicBtn.textContent = isMuted ? '🎤 Unmute' : '🎤 Mute';
    }
  });
}

const toggleCameraBtn = document.getElementById('toggleCamera');
if (toggleCameraBtn) {
  toggleCameraBtn.addEventListener('click', () => {
    if (localStream) {
      isCameraOff = !isCameraOff;
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
      toggleCameraBtn.textContent = isCameraOff ? '📹 Camera On' : '📹 Camera Off';
    }
  });
}

const leaveCallBtn = document.getElementById('leaveCall');
if (leaveCallBtn) {
  leaveCallBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the call?')) {
      endCall();
    }
  });
}

function endCall() {
  // Stop all tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // Close peer connections
  peerConnections.forEach(pc => pc.close());
  peerConnections.clear();

  // Redirect or close
  window.close();
  if (!document.hidden) {
    window.location.href = '/';
  }
}

// Initialize on load (wait for DOM to be ready)
function startInitialization() {
  console.log('DOM ready, starting initialization...');
  console.log('Document ready state:', document.readyState);
  
  // Check if required elements exist
  const requiredElements = ['videoContainer', 'sessionInfo', 'connectionStatus', 'controls'];
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  
  if (missingElements.length > 0) {
    console.error('Missing required elements:', missingElements);
    document.body.innerHTML = `
      <div style="padding: 2rem; color: white; background: #1a1a1a; height: 100vh; display: flex; align-items: center; justify-content: center;">
        <div>
          <h2>Error: Missing Required Elements</h2>
          <p>Missing: ${missingElements.join(', ')}</p>
          <p>Please refresh the page.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Small delay to ensure everything is ready
  setTimeout(() => {
    initializeCall().catch(error => {
      console.error('Failed to initialize call:', error);
      showError(`Failed to initialize: ${error.message || error}`);
    });
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startInitialization);
} else {
  // DOM is already ready
  startInitialization();
}

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
});

