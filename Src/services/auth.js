import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/firebase";

export async function loginAnonymous() {
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error("Anonymous login failed:", error);
    throw error;
  }
}

export function listenAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// Resolves with the current user as soon as one exists, instead of
// trusting auth.currentUser (which can still be null right after
// the app mounts, while the anonymous sign-in call is in flight).
export function waitForAuth() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user);
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );
  });
}
