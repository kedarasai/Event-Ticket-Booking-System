Project: Event & Ticket Booking System with a premium 3D UI. Users browse events, pick seats on a 3D seat map, and book with ZERO double-booking, guaranteed by MySQL transactions + row locks.
STACK (no substitutions): React (Vite, plain JS) | Node.js + Express (CommonJS) | MySQL 8 InnoDB via mysql2/promise, no ORM. The frontend may use ONLY react, react-dom, react-router-dom and plain CSS. No Tailwind, UI kits, animation libraries, icon libraries, CSS-in-JS, or 3D/WebGL libraries; ask me before adding anything. All 3D is done with CSS 3D transforms.
RULES:
- Backend layering: routes -> controllers -> services -> repositories. SQL only in repositories, parameterized queries ONLY. Wrap async handlers in an asyncHandler utility.
- Booking writes use ONE dedicated pooled connection, released in finally.
- User identity comes ONLY from the verified JWT, never from client input. Prices are computed on the server.
- MAX_SEATS_PER_BOOKING = 8 on both backend and frontend.
- JSON is camelCase. mysql2 returns DECIMAL as strings, so convert money to Number in the repository mapping. Dates are UTC and returned as ISO strings.
- Follow docs/API_CONTRACT.md exactly; follow docs/DESIGN.md for all UI.
- Idempotency-Key: a replay with the same key and the same payload returns the original booking (200). The same key with a different payload returns 409.
- Frontend effects must be safe under React StrictMode (double-invoked effects): abort fetches, clear timers and listeners, and never duplicate side effects.
- Do not run ANY git commands (no init, add, commit, push, remote). The owner handles git manually.
DEFINITION OF DONE (applies to every task): the code actually runs; there are no console errors, no TODO/placeholder/mock code, and no unused files; you ran the gate commands and showed real output; you changed only files relevant to the task; you fixed any error you caused before finishing.
