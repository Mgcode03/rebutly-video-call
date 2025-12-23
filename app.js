import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  remove,
  update,
  get,
  onDisconnect,
} from "firebase/database";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

// Debate Topics by Category
const debateTopics = {
  politics: [
    "Democracy is the best form of government",
    "Voting should be mandatory",
    "Term limits should exist for all politicians",
    "Social media should be regulated by governments",
    "Universal basic income should be implemented",
  ],
  technology: [
    "AI will create more jobs than it destroys",
    "Social media does more harm than good",
    "Privacy is more important than security",
    "Cryptocurrency should replace traditional currency",
    "Remote work is better than office work",
  ],
  environment: [
    "Nuclear energy is the solution to climate change",
    "Meat consumption should be heavily taxed",
    "Electric vehicles should be mandatory by 2030",
    "Individual actions can solve climate change",
    "Developed nations should pay for climate damage",
  ],
  ethics: [
    "The death penalty should be abolished",
    "Euthanasia should be legal",
    "Animal testing should be banned",
    "Genetic engineering of humans is ethical",
    "Censorship is ever justified",
  ],
  education: [
    "University education should be free",
    "Standardized testing should be eliminated",
    "Homework should be banned",
    "AI tools should be allowed in education",
    "Gap years should be encouraged",
  ],
  economics: [
    "Billionaires should not exist",
    "Minimum wage should be doubled",
    "Free trade benefits everyone",
    "Automation requires wealth redistribution",
    "Student debt should be forgiven",
  ],
};


// DOM Elements
const authSection = document.getElementById("auth-section");
const lobbySection = document.getElementById("lobby-section");
const callSection = document.getElementById("call-section");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const signupBtn = document.getElementById("signup-btn");
const googleBtn = document.getElementById("google-btn");
const logoutBtn = document.getElementById("logout-btn");
const userEmailSpan = document.getElementById("user-email");
const categorySelect = document.getElementById("category-select");
const topicSelectWrapper = document.getElementById("topic-select-wrapper");
const topicSelect = document.getElementById("topic-select");
const customTopicWrapper = document.getElementById("custom-topic-wrapper");
const customTopicInput = document.getElementById("custom-topic");
const forBtn = document.getElementById("for-btn");
const againstBtn = document.getElementById("against-btn");
const durationSelect = document.getElementById("duration-select");
const createRoomBtn = document.getElementById("create-room-btn");
const roomsList = document.getElementById("rooms-list");
const roomTitle = document.getElementById("room-title");
const timerDisplay = document.getElementById("timer");
const startTimerBtn = document.getElementById("start-timer-btn");
const leaveBtn = document.getElementById("leave-btn");
const localVideo = document.getElementById("local-video");
const remoteVideo = document.getElementById("remote-video");
const localLabel = document.getElementById("local-label");
const remoteLabel = document.getElementById("remote-label");
const toggleAudioBtn = document.getElementById("toggle-audio");
const toggleVideoBtn = document.getElementById("toggle-video");

// State
let currentUser = null;
let currentRoomId = null;
let currentRoom = null;
let localStream = null;
let peerConnection = null;
let isAudioEnabled = true;
let isVideoEnabled = true;
let selectedPosition = null;
let timerInterval = null;
let remainingTime = 0;

// WebRTC Configuration
const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};


// Category and Topic Selection
categorySelect.addEventListener("change", () => {
  const category = categorySelect.value;
  topicSelectWrapper.classList.add("hidden");
  customTopicWrapper.classList.add("hidden");

  if (category === "custom") {
    customTopicWrapper.classList.remove("hidden");
  } else if (category && debateTopics[category]) {
    topicSelect.innerHTML = '<option value="">Select a topic...</option>';
    debateTopics[category].forEach((topic) => {
      topicSelect.innerHTML += `<option value="${topic}">${topic}</option>`;
    });
    topicSelectWrapper.classList.remove("hidden");
  }
});

// Position Selection
forBtn.addEventListener("click", () => {
  selectedPosition = "for";
  forBtn.classList.add("selected");
  againstBtn.classList.remove("selected");
});

againstBtn.addEventListener("click", () => {
  selectedPosition = "against";
  againstBtn.classList.add("selected");
  forBtn.classList.remove("selected");
});

// Auth State Observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    showLobby();
  } else {
    currentUser = null;
    showAuth();
  }
});

// Auth Functions
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Login failed: " + error.message);
  }
});

signupBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Sign up failed: " + error.message);
  }
});

googleBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    alert("Google sign in failed: " + error.message);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (currentRoomId) await leaveRoom();
  await signOut(auth);
});


// UI Functions
function showAuth() {
  authSection.classList.remove("hidden");
  lobbySection.classList.add("hidden");
  callSection.classList.add("hidden");
}

function showLobby() {
  authSection.classList.add("hidden");
  lobbySection.classList.remove("hidden");
  callSection.classList.add("hidden");
  userEmailSpan.textContent = currentUser.email;
  resetCreateForm();
  loadRooms();
}

function resetCreateForm() {
  categorySelect.value = "";
  topicSelectWrapper.classList.add("hidden");
  customTopicWrapper.classList.add("hidden");
  selectedPosition = null;
  forBtn.classList.remove("selected");
  againstBtn.classList.remove("selected");
  durationSelect.value = "10";
}

function showCall(room) {
  authSection.classList.add("hidden");
  lobbySection.classList.add("hidden");
  callSection.classList.remove("hidden");
  roomTitle.textContent = room.topic;
  remainingTime = room.duration * 60;
  updateTimerDisplay();

  // Set up video positions based on user's side
  const localWrapper = localVideo.parentElement;
  const remoteWrapper = remoteVideo.parentElement;
  const myPosition = room.participants[currentUser.uid]?.position;

  if (myPosition === "for") {
    localWrapper.className = "video-wrapper for-side";
    localWrapper.querySelector(".position-label").className = "position-label for";
    localWrapper.querySelector(".position-label").textContent = "FOR 👍";
    remoteWrapper.className = "video-wrapper against-side";
    remoteWrapper.querySelector(".position-label").className = "position-label against";
    remoteWrapper.querySelector(".position-label").textContent = "AGAINST 👎";
  } else {
    localWrapper.className = "video-wrapper against-side";
    localWrapper.querySelector(".position-label").className = "position-label against";
    localWrapper.querySelector(".position-label").textContent = "AGAINST 👎";
    remoteWrapper.className = "video-wrapper for-side";
    remoteWrapper.querySelector(".position-label").className = "position-label for";
    remoteWrapper.querySelector(".position-label").textContent = "FOR 👍";
  }

  localLabel.textContent = `You (${currentUser.email.split("@")[0]})`;
  remoteLabel.textContent = "Waiting for opponent...";
}

function updateTimerDisplay() {
  const mins = Math.floor(remainingTime / 60);
  const secs = remainingTime % 60;
  timerDisplay.textContent = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}


// Create Room
createRoomBtn.addEventListener("click", async () => {
  const category = categorySelect.value;
  let topic = "";

  if (category === "custom") {
    topic = customTopicInput.value.trim();
  } else if (category) {
    topic = topicSelect.value;
  }

  if (!topic) {
    alert("Please select or enter a debate topic");
    return;
  }

  if (!selectedPosition) {
    alert("Please select your position (FOR or AGAINST)");
    return;
  }

  const duration = parseInt(durationSelect.value);

  try {
    const roomRef = push(ref(db, "rooms"));
    const roomData = {
      topic,
      category: category === "custom" ? "Custom" : category,
      duration,
      createdBy: currentUser.uid,
      creatorEmail: currentUser.email,
      participants: {
        [currentUser.uid]: {
          email: currentUser.email,
          position: selectedPosition,
          joined: Date.now(),
        },
      },
      forTaken: selectedPosition === "for",
      againstTaken: selectedPosition === "against",
      participantCount: 1,
      timerStarted: false,
      createdAt: Date.now(),
    };

    await set(roomRef, roomData);
    await joinRoom(roomRef.key, roomData, true);
  } catch (error) {
    console.error("Create room error:", error);
    alert("Failed to create debate: " + error.message);
  }
});

function loadRooms() {
  const roomsRef = ref(db, "rooms");
  onValue(roomsRef, (snapshot) => {
    roomsList.innerHTML = "";
    const rooms = snapshot.val();

    if (!rooms) {
      roomsList.innerHTML = '<p class="no-rooms">No debates available. Create one!</p>';
      return;
    }

    let hasRooms = false;
    Object.entries(rooms).forEach(([roomId, room]) => {
      if (room.createdBy === currentUser.uid) return;
      if (room.participantCount >= 2) return;

      hasRooms = true;
      const card = document.createElement("div");
      card.className = "room-card";

      const availablePosition = !room.forTaken ? "for" : "against";

      card.innerHTML = `
        <div class="room-card-header">
          <span class="room-topic">${room.topic}</span>
          <span class="room-category">${room.category}</span>
        </div>
        <div class="room-meta">
          <span>⏱️ ${room.duration} min</span>
          <span>👤 ${room.creatorEmail.split("@")[0]}</span>
        </div>
        <div class="room-positions">
          <span class="position-badge for ${room.forTaken ? "taken" : "available"}">
            FOR 👍 ${room.forTaken ? "(Taken)" : "(Join)"}
          </span>
          <span class="position-badge against ${room.againstTaken ? "taken" : "available"}">
            AGAINST 👎 ${room.againstTaken ? "(Taken)" : "(Join)"}
          </span>
        </div>
      `;

      const availableBadge = card.querySelector(`.position-badge.${availablePosition}`);
      if (availableBadge) {
        availableBadge.addEventListener("click", () => joinRoom(roomId, room, false, availablePosition));
      }

      roomsList.appendChild(card);
    });

    if (!hasRooms) {
      roomsList.innerHTML = '<p class="no-rooms">No debates available. Create one!</p>';
    }
  });
}


async function joinRoom(roomId, room, isCreator, position = null) {
  currentRoomId = roomId;
  currentRoom = room;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (error) {
    alert("Could not access camera/microphone: " + error.message);
    return;
  }

  if (!isCreator) {
    const roomRef = ref(db, `rooms/${roomId}`);
    const snapshot = await get(roomRef);
    const latestRoom = snapshot.val();

    if (latestRoom.participantCount >= 2) {
      alert("Room is full");
      localStream.getTracks().forEach((track) => track.stop());
      return;
    }

    await update(roomRef, {
      [`participants/${currentUser.uid}`]: {
        email: currentUser.email,
        position: position,
        joined: Date.now(),
      },
      [`${position}Taken`]: true,
      participantCount: latestRoom.participantCount + 1,
    });

    currentRoom = { ...latestRoom, participants: { ...latestRoom.participants, [currentUser.uid]: { position } } };
  }

  const participantRef = ref(db, `rooms/${roomId}/participants/${currentUser.uid}`);
  onDisconnect(participantRef).remove();

  showCall(currentRoom);
  setupWebRTC(roomId, isCreator);
  listenForParticipants(roomId);
  listenForTimer(roomId);
}

function listenForParticipants(roomId) {
  const participantsRef = ref(db, `rooms/${roomId}/participants`);
  onValue(participantsRef, (snapshot) => {
    const participants = snapshot.val();
    if (!participants) return;

    Object.entries(participants).forEach(([oderId, p]) => {
      if (oderId !== currentUser.uid) {
        remoteLabel.textContent = `${p.email.split("@")[0]} (${p.position.toUpperCase()})`;
      }
    });
  });
}

function listenForTimer(roomId) {
  const timerRef = ref(db, `rooms/${roomId}/timerStarted`);
  onValue(timerRef, (snapshot) => {
    const started = snapshot.val();
    if (started && !timerInterval) {
      startTimerBtn.textContent = "Running...";
      startTimerBtn.disabled = true;
      startLocalTimer();
    }
  });
}

startTimerBtn.addEventListener("click", async () => {
  if (currentRoomId && !timerInterval) {
    await update(ref(db, `rooms/${currentRoomId}`), { timerStarted: true });
  }
});

function startLocalTimer() {
  timerInterval = setInterval(() => {
    remainingTime--;
    updateTimerDisplay();
    if (remainingTime <= 0) {
      clearInterval(timerInterval);
      alert("Debate time is up!");
    }
  }, 1000);
}


// WebRTC Functions
async function setupWebRTC(roomId, isCreator) {
  peerConnection = new RTCPeerConnection(rtcConfig);

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateRef = push(ref(db, `rooms/${roomId}/candidates/${currentUser.uid}`));
      set(candidateRef, event.candidate.toJSON());
    }
  };

  const candidatesRef = ref(db, `rooms/${roomId}/candidates`);
  onValue(candidatesRef, (snapshot) => {
    const candidates = snapshot.val();
    if (!candidates) return;

    Object.entries(candidates).forEach(([oderId, userCandidates]) => {
      if (oderId !== currentUser.uid) {
        Object.values(userCandidates).forEach(async (candidate) => {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.log("Error adding ICE candidate:", e);
          }
        });
      }
    });
  });

  if (isCreator) {
    const answerRef = ref(db, `rooms/${roomId}/answer`);
    onValue(answerRef, async (snapshot) => {
      const answer = snapshot.val();
      if (answer && peerConnection.signalingState === "have-local-offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await set(ref(db, `rooms/${roomId}/offer`), {
      type: offer.type,
      sdp: offer.sdp,
    });
  } else {
    const offerRef = ref(db, `rooms/${roomId}/offer`);
    onValue(offerRef, async (snapshot) => {
      const offer = snapshot.val();
      if (offer && !peerConnection.remoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        await set(ref(db, `rooms/${roomId}/answer`), {
          type: answer.type,
          sdp: answer.sdp,
        });
      }
    });
  }
}


// Leave Room
leaveBtn.addEventListener("click", leaveRoom);

async function leaveRoom() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  remoteVideo.srcObject = null;

  if (currentRoomId) {
    const roomRef = ref(db, `rooms/${currentRoomId}`);
    const snapshot = await get(roomRef);
    const room = snapshot.val();

    if (room) {
      await remove(ref(db, `rooms/${currentRoomId}/participants/${currentUser.uid}`));
      await remove(ref(db, `rooms/${currentRoomId}/candidates/${currentUser.uid}`));

      if (room.createdBy === currentUser.uid || room.participantCount <= 1) {
        await remove(roomRef);
      } else {
        const myPosition = room.participants[currentUser.uid]?.position;
        await update(roomRef, {
          participantCount: room.participantCount - 1,
          [`${myPosition}Taken`]: false,
        });
        await remove(ref(db, `rooms/${currentRoomId}/offer`));
        await remove(ref(db, `rooms/${currentRoomId}/answer`));
      }
    }

    currentRoomId = null;
    currentRoom = null;
  }

  isAudioEnabled = true;
  isVideoEnabled = true;
  toggleAudioBtn.textContent = "🎤 Mute";
  toggleAudioBtn.classList.remove("active");
  toggleVideoBtn.textContent = "📹 Stop Video";
  toggleVideoBtn.classList.remove("active");
  startTimerBtn.textContent = "Start Timer";
  startTimerBtn.disabled = false;

  showLobby();
}

// Media Controls
toggleAudioBtn.addEventListener("click", () => {
  if (localStream) {
    isAudioEnabled = !isAudioEnabled;
    localStream.getAudioTracks().forEach((track) => (track.enabled = isAudioEnabled));
    toggleAudioBtn.textContent = isAudioEnabled ? "🎤 Mute" : "🎤 Unmute";
    toggleAudioBtn.classList.toggle("active", !isAudioEnabled);
  }
});

toggleVideoBtn.addEventListener("click", () => {
  if (localStream) {
    isVideoEnabled = !isVideoEnabled;
    localStream.getVideoTracks().forEach((track) => (track.enabled = isVideoEnabled));
    toggleVideoBtn.textContent = isVideoEnabled ? "📹 Stop Video" : "📹 Start Video";
    toggleVideoBtn.classList.toggle("active", !isVideoEnabled);
  }
});

window.addEventListener("beforeunload", () => {
  if (currentRoomId) leaveRoom();
});
