// Pure game-logic helpers. Nothing in this file talks to Firestore —
// it just takes plain data in and returns plain data out, so the rules
// can be reasoned about (and unit-tested) independently of the backend.

import { COLORS, createDeck } from "./deck";
import { shuffleDeck } from "./helpers";
import { getNextTurn, reverseDirection, displayValue } from "./rules";

// Deals 7 cards to each player and flips a starting card.
// Returns the initial shared game state.
export function dealAndStart(players) {
  const deck = shuffleDeck(createDeck());

  const hands = {};
  players.forEach((p) => {
    hands[p.id] = deck.splice(0, 7);
  });

  // Flip a starting card. A WildDraw4 as the very first card is
  // conventionally reshuffled back in rather than kept.
  let startCard = null;
  while (!startCard) {
    const candidate = deck.pop();
    if (!candidate) break; // extremely unlikely with a 108-card deck
    if (candidate.value === "WildDraw4") {
      deck.unshift(candidate);
      continue;
    }
    startCard = candidate;
  }

  let currentColor =
    startCard.color === "Black"
      ? COLORS[Math.floor(Math.random() * COLORS.length)]
      : startCard.color;

  let direction = 1;
  let currentPlayerIndex = 0;
  const n = players.length;

  if (startCard.value === "Skip") {
    currentPlayerIndex = getNextTurn(0, direction, n);
  } else if (startCard.value === "Reverse") {
    direction = -1;
    currentPlayerIndex = n - 1;
  } else if (startCard.value === "Draw2") {
    hands[players[0].id].push(...deck.splice(0, 2));
    currentPlayerIndex = getNextTurn(0, direction, n);
  }

  const lastEvent = `Game started \u2014 first card: ${displayValue(
    startCard.value
  )}${startCard.color !== "Black" ? " " + startCard.color : ""}`;

  return {
    hands,
    drawPile: deck,
    discardPile: [startCard],
    currentColor,
    direction,
    currentPlayerIndex,
    lastEvent,
  };
}

// Works out everything that follows from playing `card`, without
// touching any hands or piles itself. moverIndex is the index (in
// `players`) of whoever just played the card.
export function resolvePlayEffect({ card, chosenColor, players, moverIndex, direction }) {
  const n = players.length;
  let newDirection = direction;
  const newColor = card.color === "Black" ? chosenColor : card.color;

  let nextIndex = getNextTurn(moverIndex, direction, n);
  let forcedDrawIndex = null;
  let forcedDrawCount = 0;
  let skippedIndex = null;

  switch (card.value) {
    case "Reverse": {
      newDirection = reverseDirection(direction);
      // With only two players, a Reverse behaves like a Skip: the same
      // player who played it goes again.
      nextIndex = n === 2 ? moverIndex : getNextTurn(moverIndex, newDirection, n);
      break;
    }
    case "Skip": {
      skippedIndex = getNextTurn(moverIndex, direction, n);
      nextIndex = getNextTurn(skippedIndex, direction, n);
      break;
    }
    case "Draw2": {
      forcedDrawIndex = getNextTurn(moverIndex, direction, n);
      forcedDrawCount = 2;
      nextIndex = getNextTurn(forcedDrawIndex, direction, n);
      break;
    }
    case "WildDraw4": {
      forcedDrawIndex = getNextTurn(moverIndex, direction, n);
      forcedDrawCount = 4;
      nextIndex = getNextTurn(forcedDrawIndex, direction, n);
      break;
    }
    default:
      break;
  }

  return { newColor, newDirection, nextIndex, forcedDrawIndex, forcedDrawCount, skippedIndex };
}

// If the draw pile has run out, recycle the discard pile (keeping the
// current top card in place) back into a freshly shuffled draw pile.
export function ensureDrawPile(drawPile, discardPile) {
  if (drawPile.length > 0 || discardPile.length <= 1) {
    return { drawPile, discardPile };
  }

  const top = discardPile[discardPile.length - 1];
  const rest = discardPile.slice(0, -1);

  return { drawPile: shuffleDeck(rest), discardPile: [top] };
}
