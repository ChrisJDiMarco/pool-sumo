# Pool Sumo

A playable Three.js tabletop duel against a computer rival. Choose one red marble, pull back, and release to lock a shot. Both shots launch together after five seconds. The closest marble inside the center circle scores; first to five wins. Knocked-out marbles land beside the table and return at their home edge next round.

## Run locally

Requires Node.js for tests and Python 3 for the static development server.

```sh
npm start
npm test
```

Open http://localhost:4318. No build or package installation is required. Production assets are in `dist/`; `.openai/hosting.json` identifies the public GPT Site.

## Controls

- Mouse or touch: select a red marble, drag away from your target, release.
- Keyboard: 1/2/3 selects; left/right aim; up/down adjust power; Space locks.
- Escape pauses. Instructions and restart confirmation pause the clock too.
- Sound is optional and starts muted.

## Implementation

Fixed-step billiard collisions, friction, gravity, floor bounce, center scoring and non-overlapping respawn. The computer commits its plan from the public board before the human chooses, so it cannot inspect the player's aim. There is no network multiplayer or account requirement.

Three.js 0.186.0 is vendored under `dist/vendor/` with its MIT license. Room and material images are original AI-generated assets made for this game. The visual reference was supplied by the user. DM Sans is loaded through Google Fonts, with a system fallback.

Optional WebMCP tools expose public match state, shot selection, and restart. Opponent plans are never exposed.
