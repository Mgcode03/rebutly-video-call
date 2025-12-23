# Video Call App

One-to-one video call application using Firebase and WebRTC.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password and Google)
   - Enable Realtime Database
   - Set database rules to:
     ```json
     {
       "rules": {
         ".read": "auth != null",
         ".write": "auth != null"
       }
     }
     ```
   - Copy your config to `firebase-config.js`

3. **Run the app:**
   ```bash
   npm run dev
   ```

## Features

- Firebase Authentication (Email/Password + Google)
- Create video call rooms
- Join available rooms (max 2 participants)
- Real-time room list updates
- Mute/unmute audio and video
- Auto-cleanup when leaving rooms
