import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyA1IXFiboFw187GJ77heay984HECOttAf4",
  authDomain: "encryption-chat-265c8.firebaseapp.com",
  projectId: "encryption-chat-265c8",
  storageBucket: "encryption-chat-265c8.appspot.com",
  messagingSenderId: "827446802150",
  appId: "1:827446802150:web:35747dbe6f853c40c52d27",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel("debug");

const userIdDisplay = document.getElementById("userIdDisplay");
const peerIdInput = document.getElementById("peerIdInput");
const algorithmSelect = document.getElementById("algorithmSelect");
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const chatHistory = document.getElementById("chatHistory");
const authFormContainer = document.getElementById("authFormContainer");
const registerForm = document.getElementById("registerForm");
const regUsernameInput = document.getElementById("regUsernameInput");
const regPasswordInput = document.getElementById("regPasswordInput");
const regError = document.getElementById("regError");
const loginForm = document.getElementById("loginForm");
const loginUsernameInput = document.getElementById("loginUsernameInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginError = document.getElementById("loginError");
const toLoginBtn = document.getElementById("toLoginBtn");
const toRegisterBtn = document.getElementById("toRegisterBtn");
const mainChatUI = document.getElementById("mainChatUI");

let currentUsername = localStorage.getItem("chatUsername") || null;
let isUsernameReady = false;
let currentUserPassword = null;

let sharedSecretKey = "";
let chatCollection = null;

function generateRandomKey(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function addMessageToChat(sender, message, type) {
  const messageContainer = document.createElement("div");
  messageContainer.classList.add("message-container");
  if (type === "sent") messageContainer.classList.add("justify-end");

  const messageElement = document.createElement("div");
  messageElement.classList.add("message", type);

  const senderName = document.createElement("div");
  senderName.classList.add("sender-name");
  senderName.textContent = sender;

  const messageText = document.createElement("p");
  messageText.textContent = message;

  const timestamp = document.createElement("div");
  timestamp.classList.add("timestamp");
  const now = new Date();
  timestamp.textContent = `${now.getHours()}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  messageElement.appendChild(senderName);
  messageElement.appendChild(messageText);
  messageElement.appendChild(timestamp);

  messageContainer.appendChild(messageElement);
  chatHistory.appendChild(messageContainer);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function encryptMessage(message, key) {
  try {
    const algorithm = algorithmSelect.value;
    const keyHex = CryptoJS.enc.Utf8.parse(key);
    if (algorithm === "AES") {
      const encrypted = CryptoJS.AES.encrypt(message, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      });
      return encrypted.toString();
    } else if (algorithm === "DES") {
      if (key.length !== 8) {
        alert("Kunci DES harus 8 karakter. Silakan buat kunci baru.");
        return null;
      }
      const encrypted = CryptoJS.DES.encrypt(message, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      });
      return encrypted.toString();
    }
  } catch (e) {
    alert(`Error enkripsi: ${e.message}`);
    return null;
  }
}

function decryptMessage(encryptedMessage, key) {
  try {
    const algorithm = algorithmSelect.value;
    const keyHex = CryptoJS.enc.Utf8.parse(key);
    let decrypted = "";
    if (algorithm === "AES") {
      decrypted = CryptoJS.AES.decrypt(encryptedMessage, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
      });
    } else if (algorithm === "DES") {
      if (key.length !== 8) {
        return "Pesan tidak dapat didekripsi. Kunci salah.";
      }
      decrypted = CryptoJS.DES.decrypt(encryptedMessage, keyHex, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Utf8,
      });
    }
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return "Pesan tidak dapat didekripsi. Kunci salah.";
  }
}

function showRegisterForm() {
  registerForm.style.display = "flex";
  loginForm.style.display = "none";
}
function showLoginForm() {
  registerForm.style.display = "none";
  loginForm.style.display = "flex";
}
function showMainChatUI() {
  authFormContainer.style.display = "none";
  mainChatUI.style.display = "block";
}
function setUsername(username, password) {
  currentUsername = username;
  currentUserPassword = password;
  localStorage.setItem("chatUsername", username);
  localStorage.setItem("chatPassword", password);
  userIdDisplay.textContent = username;
  showMainChatUI();
  isUsernameReady = true;
}

// Switch form
toLoginBtn.addEventListener("click", showLoginForm);
toRegisterBtn.addEventListener("click", showRegisterForm);

// Registrasi
registerForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const username = regUsernameInput.value.trim();
  const password = regPasswordInput.value.trim();
  if (!username.match(/^[a-zA-Z0-9]{3,20}$/) || !password.match(/^.{4,20}$/)) {
    regError.textContent =
      "Username 3-20 huruf/angka, password minimal 4 karakter.";
    regError.style.display = "block";
    return;
  }
  regError.style.display = "none";
  // Cek ke Firestore apakah username sudah dipakai
  const userDoc = doc(db, "users", username);
  const userSnap = await getDoc(userDoc);
  if (userSnap.exists()) {
    regError.textContent = "Username sudah terdaftar.";
    regError.style.display = "block";
    return;
  }
  // Simpan hash password
  const passwordHash = CryptoJS.SHA256(password).toString();
  await setDoc(userDoc, { passwordHash });
  setUsername(username, password);
});

// Login
loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value.trim();
  if (!username || !password) {
    loginError.textContent = "Username dan password wajib diisi.";
    loginError.style.display = "block";
    return;
  }
  loginError.style.display = "none";
  const userDoc = doc(db, "users", username);
  const userSnap = await getDoc(userDoc);
  if (!userSnap.exists()) {
    loginError.textContent = "Username tidak ditemukan.";
    loginError.style.display = "block";
    return;
  }
  const passwordHash = CryptoJS.SHA256(password).toString();
  if (userSnap.data().passwordHash !== passwordHash) {
    loginError.textContent = "Password salah.";
    loginError.style.display = "block";
    return;
  }
  setUsername(username, password);
});

// Auto login jika sudah ada di localStorage
if (currentUsername && localStorage.getItem("chatPassword")) {
  setUsername(currentUsername, localStorage.getItem("chatPassword"));
} else {
  showLoginForm();
}

// Logika chat utama, pakai username
const checkOrCreateChatKey = async () => {
  if (!isUsernameReady) return;
  const peerUsername = peerIdInput.value.trim();
  if (!peerUsername) {
    sharedSecretKey = "";
    chatCollection = null;
    chatHistory.innerHTML = "";
    return;
  }
  try {
    const userNames = [currentUsername, peerUsername].sort();
    const chatRoomId = userNames.join("_");
    console.log("Chat Room ID:", chatRoomId);
    // Path dokumen: artifacts/{appId}/keys/{chatRoomId}
    const chatKeyDoc = doc(
      db,
      "artifacts",
      firebaseConfig.appId,
      "keys",
      chatRoomId
    );
    const docSnap = await getDoc(chatKeyDoc);
    if (docSnap.exists()) {
      sharedSecretKey = docSnap.data().key;
      console.log("Kunci obrolan ditemukan:", sharedSecretKey);
    } else {
      const algorithm = algorithmSelect.value;
      const keyLength = algorithm === "AES" ? 16 : 8;
      sharedSecretKey = generateRandomKey(keyLength);
      await setDoc(chatKeyDoc, {
        key: sharedSecretKey,
        createdAt: new Date(),
        userNames: userNames,
      });
      console.log("Kunci obrolan baru dibuat:", sharedSecretKey);
    }
    chatCollection = collection(
      db,
      "artifacts",
      firebaseConfig.appId,
      "chats",
      chatRoomId,
      "messages"
    );
    // Bersihkan chatHistory setiap kali ganti lawan chat
    chatHistory.innerHTML = "";
    // Subscribe realtime, tampilkan semua pesan
    onSnapshot(query(chatCollection, orderBy("timestamp")), (snapshot) => {
      chatHistory.innerHTML = "";
      snapshot.forEach((doc) => {
        const msg = doc.data();
        const decryptedText = decryptMessage(msg.text, sharedSecretKey);
        const type = msg.senderName === currentUsername ? "sent" : "received";
        addMessageToChat(msg.senderName, decryptedText, type);
      });
    });
  } catch (err) {
    sharedSecretKey = "";
    chatCollection = null;
    chatHistory.innerHTML = "";
    console.error("Gagal membuat/mengambil kunci obrolan:", err);
  }
};

peerIdInput.addEventListener("input", checkOrCreateChatKey);
sendMessageBtn.addEventListener("click", sendMessage);

async function sendMessage() {
  const message = messageInput.value.trim();
  const peerUsername = peerIdInput.value.trim();
  if (!message || !peerUsername) {
    alert("Pesan dan username teman harus diisi.");
    return;
  }
  if (!sharedSecretKey || !chatCollection) {
    alert(
      "Kunci obrolan belum disepakati atau chat belum siap. Pastikan username teman sudah diisi dan tunggu beberapa detik sebelum mengirim pesan."
    );
    return;
  }
  const encryptedMessage = encryptMessage(message, sharedSecretKey);
  if (!encryptedMessage) return;
  try {
    await addDoc(chatCollection, {
      senderName: currentUsername,
      text: encryptedMessage,
      timestamp: new Date(),
    });
    messageInput.value = "";
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}
