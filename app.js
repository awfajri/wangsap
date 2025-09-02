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

let sharedSecretKey = "";
let currentUserId = null;
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

async function sendMessage() {
  const message = messageInput.value.trim();
  const peerId = peerIdInput.value.trim();
  if (!message || !peerId) {
    alert("Pesan dan ID teman harus diisi.");
    return;
  }
  if (!sharedSecretKey || !chatCollection) {
    alert(
      "Kunci obrolan belum disepakati atau chat belum siap. Pastikan ID Teman sudah diisi dan tunggu beberapa detik sebelum mengirim pesan."
    );
    return;
  }
  const encryptedMessage = encryptMessage(message, sharedSecretKey);
  if (!encryptedMessage) return;
  try {
    await addDoc(chatCollection, {
      senderId: currentUserId,
      text: encryptedMessage,
      timestamp: new Date(),
    });
    messageInput.value = "";
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    userIdDisplay.textContent = currentUserId;
    const checkOrCreateChatKey = async () => {
      const peerId = peerIdInput.value.trim();
      if (!peerId) {
        sharedSecretKey = "";
        chatCollection = null;
        chatHistory.innerHTML = "";
        return;
      }
      try {
        const userIds = [currentUserId, peerId].sort();
        const chatRoomId = userIds.join("_");
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
            userIds: userIds,
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
            const type = msg.senderId === currentUserId ? "sent" : "received";
            addMessageToChat(msg.senderId, decryptedText, type);
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
  } else {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      userIdDisplay.textContent = "Gagal login: " + err.message;
      console.error("Firebase Auth Error:", err);
    }
  }
});
