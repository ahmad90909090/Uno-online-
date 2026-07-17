import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card";
import Button from "../components/Button";
import { waitForAuth } from "../services/auth";
import { joinRoom } from "../services/roomService";

export default function JoinRoom() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  async function handleJoin() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    setError("");
    setIsJoining(true);

    try {
      const user = await waitForAuth();
      const code = roomCode.trim().toUpperCase();
      await joinRoom(code, user.uid, name.trim());
      navigate(`/game/${code}`);
    } catch (err) {
      setError(err.message || "Couldn't join that room.");
      setIsJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-6">Join Room</h2>

        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 border rounded-lg mb-4"
        />

        <input
          type="text"
          placeholder="Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          className="w-full p-3 border rounded-lg mb-6 uppercase"
        />

        {error && <p className="text-red-600 text-sm mb-4 -mt-2">{error}</p>}

        <Button
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          onClick={handleJoin}
          disabled={isJoining}
        >
          {isJoining ? "Joining..." : "Join Room"}
        </Button>
      </Card>
    </div>
  );
}
