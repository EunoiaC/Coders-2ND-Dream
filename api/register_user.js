import fetch from 'node-fetch';
import {initializeApp} from "firebase/app";
import {
    signInWithEmailAndPassword,
    getAuth,
} from "firebase/auth";
import {doc, updateDoc, getFirestore} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAgHxgz4BD3mxvUFJrr2KUDGER6LElf790",
    authDomain: "coder-s-second-dream.firebaseapp.com",
    projectId: "coder-s-second-dream",
    storageBucket: "coder-s-second-dream.firebasestorage.app",
    messagingSenderId: "249976919261",
    appId: "1:249976919261:web:1ae131ec4951f17860b734",
    measurementId: "G-DPJLSV4CS2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// Main API handler
export default async function register_user(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { uid } = req.body;
    if (!uid) {
        return res.status(400).json({ error: "Invalid input" });
    }

    signInWithEmailAndPassword(auth, "admin@admin.com", process.env.ADMIN_PASS).then(userCred => {
        const docRef = doc(db, "users", uid);
        updateDoc(docRef, {
            selfRequestedMatches: 0,
            otherRequestedMatches: 0,
            successfulMatches: 0,
        })
            .then(() => {
                console.log('Document written with ID: ', docRef.id);
                res.status(200).json()
            })
            .catch((error) => {
                console.error('Error adding document: ', error);
                res.status(500).json({ error: error.message || 'An unexpected error occurred' })
            });
    }).catch(err => {
        console.error(err)
        res.status(500).json({ error: err.message || 'An unexpected error occurred' })
    });
}
