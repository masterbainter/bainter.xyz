// This file's sole purpose is to initialize Firebase and export the db service.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD4siULVs184mF6tkcuTRzybRPGxApu5TQ",
    authDomain: "bainter-xyz.firebaseapp.com",
    projectId: "bainter-xyz",
    storageBucket: "bainter-xyz.appspot.com",
    messagingSenderId: "754582576816",
    appId: "1:754582576816:web:6c2c2c5c0dd774f8122575",
    measurementId: "G-03560RG2S2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Enable offline data persistence
enableIndexedDbPersistence(db).catch(err => {
    console.error("Firebase persistence error", err.code, err.message);
});

// Export the initialized db service for other modules to use
export { db };
