// إعدادات Firebase ومفاتيح API الجديدة
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCLghqPsBSQg0EtXfAXBMig5m7We2culC0",
  authDomain: "afnan-95bbe.firebaseapp.com",
  projectId: "afnan-95bbe",
  storageBucket: "afnan-95bbe.firebasestorage.app",
  messagingSenderId: "118735157182",
  appId: "1:118735157182:web:6dc5c4bf43d9f32e49abef",
  measurementId: "G-J7Q6KZSGHC"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { auth, db, firebaseConfig, analytics };
