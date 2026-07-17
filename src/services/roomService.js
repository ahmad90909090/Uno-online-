import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { COLORS } from "../game/deck";
import { isValidPlay, needsColorSelection, getNextTurn } from "../game/rules";
import { dealAndStart, resolvePlayEffect, ensureDrawPile } from "../game/engine";
import { displayValue } from "../game/helpers";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

function roomRef(roomCode) {
  return doc(db, "rooms", roomCode);
}

function handRef(roomCode, playerId) {
  return doc(db, "rooms", roomCode, "hands", playerId);
}

// --- Lobby -----------------------------------------------------------

export async function createRoom(hostId, hostName, maxPlayers = 4) {
  const roomCode = generateRoomCode();

  await runTransaction(db, async (tx) => {
    tx.set(roomRef(roomCode), {
      roomCode,
      hostId,
      maxPlayers,
      status: "waiting",
      players: [{ id: hostId, name: hostName, handCount: 0, hasCalledUno: false }],
      playerIds: [hostId],
      currentPlayerIndex: 0,
      direction: 1,
      discardPile: [],
      drawPile: [],
      currentColor: null,
      winnerId: null,
      lastEvent: `${hostName} created the room.`,
      createdAt: serverTimestamp(),
    });

    tx.set(handRef(roomCode, hostId), { cards: [] });
  });

  return roomCode;
}

export async function joinRoom(roomCode, playerId, playerName) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(roomCode));
    if (!snap.exists()) throw new Error("Room not found.");

    const room = snap.data();

    if (room.players.some((p) => p.id === playerId)) {
      // Already in the room (e.g. a page refresh) — nothing to do.
      return;
    }

    if (room.status !== "waiting") {
      throw new Error("This game has already started.");
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error("Room is full.");
    }

    tx.update(roomRef(roomCode), {
      players: [
        ...room.players,
        { id: playerId, name: playerName, handCount: 0, hasCalledUno: false },
      ],
      playerIds: [...room.playerIds, playerId],
      lastEvent: `${playerName} joined the room.`,
    });

    tx.set(handRef(roomCode, playerId), { cards: [] });
  });

  return roomCode;
}

export function subscribeToRoom(roomCode, onUpdate, onError) {
  return onSnapshot(
    roomRef(roomCode),
    (snap) => onUpdate(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError
  );
}

export function subscribeToHand(roomCode, playerId, onUpdate, onError) {
  return onSnapshot(
    handRef(roomCode, playerId),
    (snap) => onUpdate(snap.exists() ? snap.data().cards : []),
    onError
  );
}

// --- Gameplay ----------------------------------------------------------

export async function startGame(roomCode, requesterId) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef(roomCode));
    if (!snap.exists()) throw new Error("Room not found.");
    const room = snap.data();

    if (room.hostId !== requesterId) throw new Error("Only the host can start the game.");
    if (room.status !== "waiting") throw new Error("The game has already started.");
    if (room.players.length < 2) throw new Error("You need at least 2 players.");

    const { hands, drawPile, discardPile, currentColor, direction, currentPlayerIndex, lastEvent } =
      dealAndStart(room.players);

    room.players.forEach((p) => {
      tx.set(handRef(roomCode, p.id), { cards: hands[p.id] });
    });

    tx.update(roomRef(roomCode), {
      status: "playing",
      players: room.players.map((p) => ({ ...p, handCount: hands[p.id].length, hasCalledUno: false })),
      drawPile,
      discardPile,
      currentColor,
      direction,
      currentPlayerIndex,
      winnerId: null,
      lastEvent,
    });
  });
}

export async function playCard(roomCode, playerId, cardIndex, chosenColor = null) {
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef(roomCode));
    if (!roomSnap.exists()) throw new Error("Room not found.");
    const room = roomSnap.data();

    if (room.status !== "playing") throw new Error("The game isn't in progress.");

    const moverIndex = room.currentPlayerIndex;
    const mover = room.players[moverIndex];
    if (!mover || mover.id !== playerId) throw new Error("It's not your turn.");

    const moverHandSnap = await tx.get(handRef(roomCode, playerId));
    const hand = moverHandSnap.exists() ? moverHandSnap.data().cards : [];
    const card = hand[cardIndex];
    if (!card) throw new Error("That card is no longer in your hand.");

    const topCard = room.discardPile[room.discardPile.length - 1];
    if (!isValidPlay(card, topCard, room.currentColor)) {
      throw new Error("That card can't be played right now.");
    }
    if (needsColorSelection(card) && !COLORS.includes(chosenColor)) {
      throw new Error("Choose a color for that wild card.");
    }

    const { newColor, newDirection, nextIndex, forcedDrawIndex, forcedDrawCount } =
      resolvePlayEffect({ card, chosenColor, players: room.players, moverIndex, direction: room.direction });

    let drawPile = [...room.drawPile];
    let discardPile = [...room.discardPile, card];
    const newHand = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];

    const players = room.players.map((p) => ({ ...p }));
    players[moverIndex].handCount = newHand.length;
    players[moverIndex].hasCalledUno = newHand.length === 1 ? players[moverIndex].hasCalledUno : false;

    let forcedDrawHandRef = null;
    let forcedDrawNewHand = null;

    if (forcedDrawIndex !== null && newHand.length > 0) {
      const target = players[forcedDrawIndex];
      const reshuffled = ensureDrawPile(drawPile, discardPile);
      drawPile = reshuffled.drawPile;
      discardPile = reshuffled.discardPile;

      forcedDrawHandRef = handRef(roomCode, target.id);
      const targetHandSnap = await tx.get(forcedDrawHandRef);
      const targetHand = targetHandSnap.exists() ? targetHandSnap.data().cards : [];

      const drawn = drawPile.splice(0, Math.min(forcedDrawCount, drawPile.length));
      forcedDrawNewHand = [...targetHand, ...drawn];
      players[forcedDrawIndex].handCount = forcedDrawNewHand.length;
      players[forcedDrawIndex].hasCalledUno = false;
    }

    const winnerId = newHand.length === 0 ? playerId : null;
    const cardLabel = `${displayValue(card.value)}${card.color !== "Black" ? " " + card.color : ""}`;
    const lastEvent = winnerId
      ? `${mover.name} played ${cardLabel} and won the game! \uD83C\uDF89`
      : `${mover.name} played ${cardLabel}.`;

    tx.set(handRef(roomCode, playerId), { cards: newHand });
    if (forcedDrawHandRef) tx.set(forcedDrawHandRef, { cards: forcedDrawNewHand });

    tx.update(roomRef(roomCode), {
      players,
      drawPile,
      discardPile,
      currentColor: newColor,
      direction: newDirection,
      currentPlayerIndex: winnerId ? moverIndex : nextIndex,
      status: winnerId ? "finished" : "playing",
      winnerId,
      lastEvent,
    });
  });
}

export async function drawCard(roomCode, playerId) {
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef(roomCode));
    if (!roomSnap.exists()) throw new Error("Room not found.");
    const room = roomSnap.data();

    if (room.status !== "playing") throw new Error("The game isn't in progress.");

    const moverIndex = room.currentPlayerIndex;
    const mover = room.players[moverIndex];
    if (!mover || mover.id !== playerId) throw new Error("It's not your turn.");

    const { drawPile, discardPile } = ensureDrawPile(room.drawPile, room.discardPile);
    if (drawPile.length === 0) throw new Error("No cards left to draw.");

    const handSnap = await tx.get(handRef(roomCode, playerId));
    const hand = handSnap.exists() ? handSnap.data().cards : [];

    const [drawnCard, ...restOfPile] = drawPile;
    const newHand = [...hand, drawnCard];

    const players = room.players.map((p) => ({ ...p }));
    players[moverIndex].handCount = newHand.length;
    players[moverIndex].hasCalledUno = false;

    const nextIndex = getNextTurn(moverIndex, room.direction, players.length);

    tx.set(handRef(roomCode, playerId), { cards: newHand });
    tx.update(roomRef(roomCode), {
      players,
      drawPile: restOfPile,
      discardPile,
      currentPlayerIndex: nextIndex,
      lastEvent: `${mover.name} drew a card.`,
    });
  });
}

export async function callUno(roomCode, playerId) {
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef(roomCode));
    if (!roomSnap.exists()) throw new Error("Room not found.");
    const room = roomSnap.data();

    const index = room.players.findIndex((p) => p.id === playerId);
    if (index === -1) throw new Error("You're not in this room.");

    const players = room.players.map((p) => ({ ...p }));
    players[index].hasCalledUno = true;

    tx.update(roomRef(roomCode), {
      players,
      lastEvent: `${players[index].name} called UNO!`,
    });
  });
}

// A player with exactly one card who hasn't called UNO can be "caught"
// by anyone else, drawing 2 penalty cards.
export async function catchUno(roomCode, callerId, targetId) {
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef(roomCode));
    if (!roomSnap.exists()) throw new Error("Room not found.");
    const room = roomSnap.data();

    const targetIndex = room.players.findIndex((p) => p.id === targetId);
    if (targetIndex === -1) throw new Error("Player not found.");

    const target = room.players[targetIndex];
    if (target.handCount !== 1 || target.hasCalledUno) {
      throw new Error("Nothing to catch there.");
    }

    const { drawPile, discardPile } = ensureDrawPile(room.drawPile, room.discardPile);
    const handSnap = await tx.get(handRef(roomCode, targetId));
    const hand = handSnap.exists() ? handSnap.data().cards : [];

    const drawn = drawPile.splice(0, Math.min(2, drawPile.length));
    const newHand = [...hand, ...drawn];

    const players = room.players.map((p) => ({ ...p }));
    players[targetIndex].handCount = newHand.length;
    players[targetIndex].hasCalledUno = false;

    const caller = room.players.find((p) => p.id === callerId);

    tx.set(handRef(roomCode, targetId), { cards: newHand });
    tx.update(roomRef(roomCode), {
      players,
      drawPile,
      discardPile,
      lastEvent: `${caller ? caller.name : "Someone"} caught ${target.name} without calling UNO! +2 cards.`,
    });
  });
}
