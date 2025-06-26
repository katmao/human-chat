import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkkGt1qlQK62dGzxi4AK1aZC5H2A7DPxY",
  authDomain: "chatroom-66981.firebaseapp.com",
  projectId: "chatroom-66981",
  storageBucket: "chatroom-66981.firebasestorage.app",
  messagingSenderId: "919496165622",
  appId: "1:919496165622:web:315eeb28ff0e02646ec4d7",
  measurementId: "G-W9YZ50NW5R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db }; 