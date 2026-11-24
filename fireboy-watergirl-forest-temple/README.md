# Fireboy & Watergirl: Forest Temple

## Structure

- `index.html` — landing page
- `login.html` — login form
- `register.html` — registration form
- `dashboard.html` — player dashboard
- `levels.html` — level selection
- `game.html` — gameplay screen
- `css/` — styles separated into base, components, game, and overlays
- `js/` — engine, level data, local storage/auth, audio, graphics, game loop, and page navigation

## Run

Open this folder in VS Code and use **Live Server**, starting from `index.html`.
The pages use browser `localStorage` for the demo accounts, settings, and progress, so use the same browser and local server origin for all pages.

The login/register system remains a local demo, not a production authentication backend.
