import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Loader from "./Components/Loader";
import Home from "./pages/Home";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import Game from "./pages/Game";
import { loginAnonymous } from "./services/auth";

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    loginAnonymous()
      .then(() => {
        if (!cancelled) setAuthReady(true);
      })
      .catch((error) => {
        if (!cancelled) setAuthError(error.message || "Failed to sign in.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (authError) {
    return (
      <div className="min-h-screen bg-green-800 flex items-center justify-center text-white font-bold p-6 text-center">
        Couldn't connect: {authError}
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-green-800 flex items-center justify-center">
        <Loader text="Connecting..." />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/create" element={<CreateRoom />} />
      <Route path="/join" element={<JoinRoom />} />
      <Route path="/game/:roomCode" element={<Game />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
