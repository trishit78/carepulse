# Video Call Service

A standalone microservice for handling video call sessions in the telemedicine application.

## Features

- Create video sessions per appointment
- Generate secure JWT tokens for participants
- Role-based permissions (doctor = host, patient = participant)
- Simple WebRTC-based video call UI
- Stateless and horizontally scalable

## Setup

1. Install dependencies:
```bash
npm install
```

2. **Create `.env` file in the `videocall` folder:**
   
   Create a file named `.env` in the `videocall` directory with the following content:
   ```env
   PORT=4000
   MONGO_URI=mongodb://localhost:27017/videocall
   INTERNAL_SECRET=your-internal-secret-key-change-this
   VIDEO_JWT_SECRET=your-video-jwt-secret-key-change-this
   CLIENT_BASE_URL=http://localhost:4000
   SFU_NODES=sfu-1,sfu-2
   ```
   
   **IMPORTANT:** 
   - The `INTERNAL_SECRET` value must match the `VIDEO_SERVICE_SECRET` in your telemedicine backend `.env` file
   - Use a strong, random string for both secrets in production

4. Build the project:
```bash
npm run build
```

5. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### POST /sessions

Create a video session for an appointment.

**Headers:**
```
X-Internal-Secret: <INTERNAL_SECRET>
```

**Request:**
```json
{
  "appointmentId": "apt_123",
  "doctorId": "doc_456",
  "patientId": "usr_789"
}
```

**Response:**
```json
{
  "sessionId": "sess_abc",
  "roomName": "room_sess_abc",
  "sfuNodeId": "sfu-1",
  "baseUrl": "http://localhost:4000/join/sess_abc"
}
```

### POST /sessions/:sessionId/join

Get a join URL for a participant.

**Headers:**
```
X-Internal-Secret: <INTERNAL_SECRET>
```

**Request:**
```json
{
  "role": "doctor",
  "userId": "doc_456"
}
```

**Response:**
```json
{
  "joinUrl": "http://localhost:4000/join/sess_abc?token=<jwt>",
  "expiresIn": 3600
}
```

## Frontend

The service includes a simple video call UI accessible at:
```
http://localhost:4000/join/:sessionId?token=<jwt>
```

The UI supports:
- Video/audio streaming
- Mute/unmute controls
- Camera on/off
- Role-based permissions
- Leave call functionality

## Security

- All API endpoints require `X-Internal-Secret` header
- JWT tokens are short-lived (1 hour)
- Tokens include role and permissions
- Never trust client-provided role information

## Architecture

- **Stateless**: All state stored in MongoDB
- **Scalable**: Multiple instances can run simultaneously
- **SFU-ready**: Designed to work with SFU nodes (LiveKit, Twilio, etc.)

## Notes

The current implementation includes a basic WebRTC UI. For production, integrate with:
- LiveKit SDK
- Twilio Video SDK
- Agora SDK
- Or your preferred SFU solution

