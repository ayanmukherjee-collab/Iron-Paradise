# Iron Paradise

Web app for Iron Paradise Gym: public landing page, member management, attendance and payment tracking. The full product brief is in [iron-paradise.md](iron-paradise.md).

## Setup

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command             | What it does                                                             |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run dev`       | Start the dev server                                                     |
| `npm run build`     | Production build                                                         |
| `npm run lint`      | ESLint                                                                   |
| `npm run typecheck` | TypeScript type check                                                    |
| `npm test`          | Unit tests (Vitest)                                                      |
| `npm run art`       | Resize and greyscale the character art in `assets/art` into `public/art` |
| `npm run format`    | Format with Prettier                                                     |

## Landing page content

All landing page text, plans, timings and contact details live in `src/content/landing.ts`. Edit that one file to change what the public page says.

Environment variables, tests and deployment will be documented here as each phase lands.
