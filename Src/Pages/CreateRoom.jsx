import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card";
import Button from "../components/Button";
import { waitForAuth } from "../services/auth";
import { createRoom } from "../services/roomService";

export default function CreateRoom() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const user = await waitForAuth();
      const roomCode = await createRoom(user.uid, name.trim(), maxPlayers);
      navigate(`/game/${roomCode}`);
    } catch (err) {
      setError(err.message || "Couldn't create the room.");
      setIsCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-6">Create Room</h2>

        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 border rounded-lg mb-4"
        />

        <select
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Number(e.target.value))}
          className="w-full p-3 border rounded-lg mb-4"
        >
          {Array.from({ length: 9 }, (_, i) => i + 2).map((count) => (
            <option key={count} value={count}>
              {count} Players
            </option>
          ))}
        </select>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <Button className="w-full" onClick={handleCreate} disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Room"}
        </Button>
      </Card>
    </div>
  );
}
