import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyCmEsQS5ZfdxMrZP-l3plM4W5iRpEWcf7I',
    authDomain: 'chip-roadmap-site.firebaseapp.com',
    projectId: 'chip-roadmap-site',
    storageBucket: 'chip-roadmap-site.firebasestorage.app',
    messagingSenderId: '780943489591',
    appId: '1:780943489591:web:1de3a5359f0dbdb1549db2'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
