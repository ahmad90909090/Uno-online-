# UNO Pro Online

A professional multiplayer UNO game built with:

- ⚛️ React
- ⚡ Vite
- 🎨 Tailwind CSS
- 🔥 Firebase
- ☁️ Vercel

## Features

- Online Multiplayer
- Firebase Authentication
- Firestore Realtime Database
- AI Strategy Assistant
- Responsive Design
- Professional UI

## Tech Stack

- React
- Vite
- Tailwind CSS
- Firebase
- Vercel

## Development

```bash
npm install
npm run dev
```

Create a `.env.local` with your Firebase project's web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Enable **Anonymous** sign-in under Firebase Authentication, and deploy the
included security rules:

```bash
firebase deploy --only firestore:rules
```

## Build

```bash
npm run build
```

## Data model

- `rooms/{roomCode}` — shared table state: player list/order, whose turn it
  is, direction, discard pile, current color, draw-pile count, etc.
- `rooms/{roomCode}/hands/{playerId}` — each player's actual cards, split
  into its own document so it can be locked down separately.

## Known simplifications / limitations

- **Hands are private, the draw pile isn't fully.** `firestore.rules`
  restricts *reads* of `hands/{playerId}` to that player's own uid, so
  opponents genuinely cannot see your cards. The shared draw pile, though,
  lives inside the room document because whichever client draws needs to
  read/write it directly — there's no backend to broker that. A fully
  tamper-proof version would move card dealing into a Cloud Function so no
  client ever sees the deck order or another player's hand contents.
- **No stacking of Draw Two / Wild Draw Four.** Playing a Draw 2 on a Draw 2
  simply resolves the first one; it doesn't chain.
- **Drawing ends your turn.** There's no "draw, then optionally play that
  card" step — matches many simplified digital UNO implementations, but
  differs from house rules some tables use.
- **UNO calling** is enforced by convention: the "UNO!" button appears once
  your hand hits 2 cards, and any opponent can "Catch!" you for +2 if you
  reach 1 card without calling it. There's no time pressure/window — the
  catch is available until you call or play down further.

## License

MIT
