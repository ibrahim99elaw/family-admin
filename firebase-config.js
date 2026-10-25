firebase.initializeApp({
  apiKey: "AIzaSyCTgiUQMWJ4diDPMIbQJBYOyXyNpnzgNi8",
  authDomain: "family-76901.firebaseapp.com",
  projectId: "family-76901"
});
const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;
