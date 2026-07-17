import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import PlayerHand from "../components/PlayerHand";
import OpponentHand from "../components/OpponentHand";
import CenterPile from "../components/CenterPile";
import Button from "../components/Button";
import Card from "../components/Card";
import Loader from "../components/Loader";

import { COLORS } from "../game/deck";
import { needsColorSelection } from "../game/rules";
import { getColorClass } from "../game/helpers";
import { waitForAuth } from "../services/auth";
import {
  subscribeToRoom,
  subscribeToHand,
  startGame,
  playCard,
  drawCard,
  callUno,
  catchUno,
} from "../services/roomService";

export default function Game() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [uid, setUid] = useState(null);
  const [room, setRoom] = useState(null);
  const [hand, setHand] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingWildIndex, setPendingWildIndex] = useState(null);

  // Resolve the signed-in user once, then subscribe to live room + hand data.
  useEffect(() => {
    let unsubRoom = () => {};
    let unsubHand = () => {};

    waitForAuth().then((user) => {
      setUid(user.uid);

      unsubRoom = subscribeToRoom(
        roomCode,
        (data) => {
          setRoom(data);
          setLoading(false);
        },
        () => setLoading(false)
      );

      unsubHand = subscribeToHand(roomCode, user.uid, setHand, () => {});
    });

    return () => {
      unsubRoom();
      unsubHand();
    };
  }, [roomCode]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 3500);
    return () => clearTimeout(t);
  }, [error]);

  if (!uid || loading) return <FullScreenLoader text="Loading room..." />;

  if (room === null) {
    return (
      <FullScreenMessage>
        <p className="font-bold mb-4">Room "{roomCode}" not found.</p>
        <Button onClick={() => navigate("/")}>Back Home</Button>
      </FullScreenMessage>
    );
  }

  const me = room.players.find((p) => p.id === uid);
  if (!me) {
    return (
      <FullScreenMessage>
        <p className="font-bold mb-4">You're not part of this room.</p>
        <Button onClick={() => navigate("/")}>Back Home</Button>
      </FullScreenMessage>
    );
  }

  const isHost = room.hostId === uid;

  async function runAction(fn) {
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
  }

  function handleCardClick(index) {
    const card = hand[index];
    if (needsColorSelection(card)) {
      setPendingWildIndex(index);
      return;
    }
    runAction(() => playCard(roomCode, uid, index));
  }

  function chooseColor(color) {
    const index = pendingWildIndex;
    setPendingWildIndex(null);
    runAction(() => playCard(roomCode, uid, index, color));
  }

  if (room.status === "waiting") {
    return (
      <Lobby
        room={room}
        isHost={isHost}
        onStart={() => runAction(() => startGame(roomCode, uid))}
        onCopyCode={() => navigator.clipboard?.writeText(room.roomCode)}
        error={error}
      />
    );
  }

  const myIndex = room.players.findIndex((p) => p.id === uid);
  const isMyTurn = room.currentPlayerIndex === myIndex;
  const topCard = room.discardPile[room.discardPile.length - 1];
  const opponents = room.players.filter((p) => p.id !== uid);

  return (
    <div className="min-h-screen bg-green-800 relative overflow-hidden">
      {room.status === "finished" && (
        <WinnerBanner
          winnerName={room.players.find((p) => p.id === room.winnerId)?.name}
          isMe={room.winnerId === uid}
          onExit={() => navigate("/")}
        />
      )}

      {pendingWildIndex !== null && <ColorPicker onChoose={chooseColor} />}

      {error && <Toast>{error}</Toast>}

      {room.lastEvent && <EventBanner>{room.lastEvent}</EventBanner>}

      {/* Table */}
      <div className="absolute inset-0 flex items-center justify-center">
        <CenterPile
          topCard={topCard}
          currentColor={room.currentColor}
          deckCount={room.drawPile.length}
          canDraw={isMyTurn}
          onDraw={() => runAction(() => drawCard(roomCode, uid))}
        />
      </div>

      {/* Opponents, spread around the edges */}
      {opponents.map((p, i) => (
        <div
          key={p.id}
          className={positionClassFor(i, opponents.length)}
        >
          <OpponentHand
            playerName={p.name}
            cardCount={p.handCount}
            isCurrentTurn={room.players[room.currentPlayerIndex]?.id === p.id}
          />
          {p.handCount === 1 && !p.hasCalledUno && (
            <button
              onClick={() => runAction(() => catchUno(roomCode, uid, p.id))}
              className="mt-1 mx-auto block px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              Catch!
            </button>
          )}
        </div>
      ))}

      {/* Your hand */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-full">
        <PlayerHand cards={hand} canPlay={isMyTurn} onCardClick={handleCardClick} />

        <div className="flex justify-center mt-2">
          {hand.length <= 2 && !me.hasCalledUno && (
            <button
              onClick={() => runAction(() => callUno(roomCode, uid))}
              className="px-4 py-2 text-sm font-black bg-yellow-400 text-black rounded-full shadow-lg hover:bg-yellow-500"
            >
              UNO!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Small presentational helpers ---------------------------------------

function positionClassFor(index, total) {
  if (total === 1) return "absolute top-5 left-1/2 -translate-x-1/2";
  if (index === 0) return "absolute top-5 left-1/2 -translate-x-1/2";
  if (index === 1) return "absolute left-5 top-1/2 -translate-y-1/2";
  if (index === 2) return "absolute right-5 top-1/2 -translate-y-1/2";
  return "absolute top-24 left-1/2 -translate-x-1/2";
}

function FullScreenLoader({ text }) {
  return (
    <div className="min-h-screen bg-green-800 flex items-center justify-center">
      <Loader text={text} />
    </div>
  );
}

function FullScreenMessage({ children }) {
  return (
    <div className="min-h-screen bg-green-800 flex items-center justify-center text-white text-center p-6">
      <div>{children}</div>
    </div>
  );
}

function Lobby({ room, isHost, onStart, onCopyCode, error }) {
  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center p-6">
      <Card className="max-w-md w-full text-center">
        <h2 className="text-2xl font-bold mb-2">Waiting for players...</h2>

        <button
          onClick={onCopyCode}
          className="text-4xl font-black tracking-widest mb-4 text-green-700 block w-full"
          title="Click to copy"
        >
          {room.roomCode}
        </button>

        <ul className="text-left mb-6">
          {room.players.map((p) => (
            <li key={p.id} className="py-1 border-b last:border-0">
              {p.name} {p.id === room.hostId && <span className="text-xs text-gray-500">(host)</span>}
            </li>
          ))}
        </ul>

        <p className="text-sm text-gray-500 mb-4">
          {room.players.length}/{room.maxPlayers} players
        </p>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        {isHost ? (
          <Button className="w-full" onClick={onStart} disabled={room.players.length < 2}>
            {room.players.length < 2 ? "Need at least 2 players" : "Start Game"}
          </Button>
        ) : (
          <p className="text-gray-500">Waiting for the host to start the game...</p>
        )}
      </Card>
    </div>
  );
}

function ColorPicker({ onChoose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <Card className="text-center">
        <p className="font-bold mb-4">Choose a color</p>
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChoose(color)}
              className={`w-24 h-16 rounded-lg font-bold shadow ${getColorClass(color)}`}
            >
              {color}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function WinnerBanner({ winnerName, isMe, onExit }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <Card className="text-center">
        <p className="text-3xl font-black mb-4">
          {isMe ? "🎉 You won!" : `🎉 ${winnerName || "A player"} won!`}
        </p>
        <Button onClick={onExit}>Back Home</Button>
      </Card>
    </div>
  );
}

function Toast({ children }) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 font-semibold">
      {children}
    </div>
  );
}

function EventBanner({ children }) {
  return (
    <div className="absolute top-0 left-0 right-0 text-center text-white/80 text-sm py-1 z-10">
      {children}
    </div>
  );
}
