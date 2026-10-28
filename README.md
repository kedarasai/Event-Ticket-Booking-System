# TicketFlow — Real-Time Event & Ticket Booking System

A production-grade, highly performant Event and Ticket Booking System featuring **event-specific CSS 3D seat maps**, **tiered seat pricing**, and a **mathematically verified zero-double-booking guarantee** backed by MySQL InnoDB row-level exclusive locks and ACID transactions.

---

## Table of Contents
1. [Overview & Highlights](#overview--highlights)
2. [Tech Stack & Hard Constraints](#tech-stack--hard-constraints)
3. [Architecture Overview](#architecture-overview)
4. [Database Entity-Relationship (ER) Model](#database-entity-relationship-er-model)
5. [The Six Venue Layouts & Seating Plans](#the-six-venue-layouts--seating-plans)
6. [Tiered Pricing & Server-Side Financial Integrity](#tiered-pricing--server-side-financial-integrity)
7. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
8. [Demo Credentials](#demo-credentials)
9. [API Contract & Endpoint Documentation](#api-contract--endpoint-documentation)
10. [How Double-Booking is Prevented](#how-double-booking-is-prevented)
11. [Design Decisions: Why CSS 3D Instead of WebGL](#design-decisions-why-css-3d-instead-of-webgl)
12. [5-Minute Demo Script (Multi-Venue & Tiered Pricing)](#5-minute-demo-script-multi-venue--tiered-pricing)
13. [12 Likely Judge Questions & In-Depth Answers](#12-likely-judge-questions--in-depth-answers)

---

## Overview & Highlights

TicketFlow provides a seamless, modern ticketing experience for live entertainment (Concerts, Festivals, Sports, Theatre, Conferences, and Comedy):
- **Zero Double-Booking Guarantee**: Proven under high concurrency (e.g. 10+ simultaneous requests for the exact same seat) using pessimistic row locks (`SELECT ... FOR UPDATE`) in ascending ID order, paired with a physical database constraint on active seats.
- **Event-Specific 3D Seat Maps**: Every event has an authentic architectural layout matching real-world venue geometries (Arena with multi-tier floor & upper bowl, Curved Auditorium, Comedy Club with circular table disks and bar counter, Classic Theatre with Stalls/Circle/Balcony/Royal Boxes, Stadium 360° ring stands around a central pitch, and Open-Air Festival grounds with VIP viewing deck).
- **Tiered Seat Pricing (VIP, Premium, Standard, Economy)**: Different sections and seat tiers within the same event carry distinct prices. Seats and legend dots are distinctly color-coded.
- **Server-Side Financial Authority**: The server alone computes totals in integer paise (`Math.round(Number(price) * 100)`) across locked database rows. Any client-sent price or total is strictly ignored.
- **Historical Price Snapshots (`price_paid`)**: Each booked seat preserves its purchase price in `booking_seats.price_paid`. Subsequent direct price updates to the `seats` table never alter past booking receipts or accounting records.
- **3D Digital Ticket Pass**: CSS 3D flippable ticket featuring high-contrast event art, perforated tear line, notched edge cutouts, cryptographic booking reference, deterministic barcode pattern, and individual seat tier/price pills.
- **Full Booking Lifecycle**: Instant self-service booking, idempotent network retries via `Idempotency-Key`, instantaneous cancellation with immediate seat release, and historical auditing.
- **Real-Time Polling & Live Pruning**: Background polling updates seat availability every 5 seconds, alerting users if a chosen seat was booked by someone else and pruning invalid selections before checkout.

---

## Tech Stack & Hard Constraints

Strictly minimal, robust, and zero bloated third-party UI/3D libraries:

### Frontend
- **Framework**: React 19 (Vite, Plain JavaScript)
- **Routing**: React Router DOM v7
- **Styling & 3D**: 100% Vanilla CSS with CSS 3D Transforms (`preserve-3d`, `translate3d`, `rotateX`, `rotateY`, `scale`)
- **Icons & Graphics**: Pure inline SVGs
- **Constraints**: No Tailwind, no UI kits, no animation libraries, no CSS-in-JS, no Three.js / WebGL / Canvas

### Backend
- **Runtime**: Node.js (CommonJS)
- **Server Framework**: Express 5
- **Architecture**: Strict 4-layer separation: `routes -> controllers -> services -> repositories`
- **Security**: JWT (`jsonwebtoken`), password hashing (`bcrypt`), request headers (`helmet`), rate limiting (`express-rate-limit`)
- **Database Driver**: `mysql2/promise` with connection pooling, parameterized queries only (zero ORM)
- **Timezone**: All database sessions run in UTC (`SET time_zone = '+00:00'`) and dates are ISO strings

### Database
- **Engine**: MySQL 8.0+ (InnoDB Storage Engine)
- **Isolation**: Standard transaction isolation paired with deterministic pessimistic row locks
- **Schema Constraints**: Unique composite keys and a stored generated column for active seat reservations

---

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  | CSS 3D Seat Map    |  | CSS 3D Ticket Pass   |  | Roving TabIndex / A11y    |  |
|  | (Orbit/Yaw/Zoom)   |  | (Interactive Flip)   |  | (WCAG 2.5.5 Tap Targets)  |  |
|  +--------------------+  +----------------------+  +---------------------------+  |
|         |                           |                            |                |
|         +---------------------------+----------------------------+                |
|                                     | Fetch / REST (JSON)                         |
+-------------------------------------|---------------------------------------------+
                                      v
+-----------------------------------------------------------------------------------+
|                               EXPRESS BACKEND API                                 |
|  +-----------------------------------------------------------------------------+  |
|  | Middleware: Helmet, CORS, RateLimiter, JWT Auth, AsyncHandler, ErrorHandler |  |
|  +-----------------------------------------------------------------------------+  |
|  | Routes & Controllers: /auth, /events, /bookings, /dev/race                  |  |
|  +-----------------------------------------------------------------------------+  |
|  | Services: Business logic, Input validation, Idempotency, Deadlock retry     |  |
|  +-----------------------------------------------------------------------------+  |
|  | Repositories: Raw parameterized SQL queries only (mysql2/promise)           |  |
|  +-----------------------------------------------------------------------------+  |
|                                     | Dedicated Pooled Connection                 |
+-------------------------------------|---------------------------------------------+
                                      v
+-----------------------------------------------------------------------------------+
|                            MYSQL 8 INNODB DATABASE                                |
|  +-----------------------------------------------------------------------------+  |
|  | ACID Transactions: START TRANSACTION ... COMMIT / ROLLBACK                  |  |
|  | Row-Level Locks: SELECT ... WHERE seat_id IN (...) ORDER BY seat_id FOR UPDATE |  |
|  | Physical Invariant: UNIQUE(active_seat_id) on STORED generated column       |  |
|  | Idempotency Invariant: UNIQUE(user_id, idempotency_key)                      |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Database Entity-Relationship (ER) Model

The schema comprises **5 relational tables** hosted on InnoDB with strict foreign key constraints:

```
    +------------------+             +--------------------+
    |      users       |             |       events       |
    +------------------+             +--------------------+
    | user_id (PK)     |<-----+      | event_id (PK)      |<-------+
    | email (UQ)       |      |      | title              |        |
    | password_hash    |      |      | venue              |        |
    | role             |      |      | event_date         |        |
    | created_at       |      |      | layout_type        |        |
    +------------------+      |      | price (min)        |        |
                              |      | category           |        |
                              |      +--------------------+        |
                              |                |                   |
                              | 1              | 1                 |
                              |                |                   |
                              | N              | N                 |
                     +------------------+      |                   |
                     |     bookings     |      |                   |
                     +------------------+      |                   |
                     | booking_id (PK)  |      |                   |
                     | user_id (FK)     |------+                   |
                     | event_id (FK)    |--------------------------+
                     | booking_ref (UQ) |
                     | idempotency_key  |
                     | status           |
                     | total_amount     |
                     | created_at       |
                     | cancelled_at     |
                     +------------------+
                              | 1
                              |
                              | N
                     +-------------------------+            +-------------------+
                     |      booking_seats      |            |       seats       |
                     +-------------------------+            +-------------------+
                     | booking_seat_id (PK)    |     N    1 | seat_id (PK)      |
                     | booking_id (FK)         |----------->| event_id (FK)     |
                     | seat_id (FK)            |            | seat_number       |
                     | price_paid (DECIMAL)    |            | section           |
                     | is_active (BOOLEAN)     |            | tier              |
                     | active_seat_id (UQ,GEN) |            | price             |
                     +-------------------------+            | row_label         |
                                                            | seat_col          |
                                                            | status            |
                                                            +-------------------+
```

### Table Descriptions & Constraints

1. **`users`**:
   - `user_id` (INT, PK, AUTO_INCREMENT)
   - `name` (VARCHAR(100), NOT NULL)
   - `email` (VARCHAR(255), NOT NULL, UNIQUE)
   - `password_hash` (VARCHAR(255), NOT NULL)
   - `role` (ENUM('USER', 'ADMIN'), DEFAULT 'USER')
   - `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

2. **`events`**:
   - `event_id` (INT, PK, AUTO_INCREMENT)
   - `title` (VARCHAR(255), NOT NULL)
   - `description` (TEXT)
   - `venue` (VARCHAR(255), NOT NULL)
   - `event_date` (DATETIME, NOT NULL, INDEXED — stored in UTC)
   - `layout_type` (VARCHAR(20), NOT NULL, DEFAULT 'ARENA' — ARENA, AUDITORIUM, CLUB, THEATRE, STADIUM, FESTIVAL)
   - `price` (DECIMAL(10,2), NOT NULL — represents minimum seat price)
   - `category` (VARCHAR(50), NOT NULL)
   - `image_url` (VARCHAR(255), NULL)
   - `created_at` (TIMESTAMP)

3. **`seats`**:
   - `seat_id` (INT, PK, AUTO_INCREMENT)
   - `event_id` (INT, NOT NULL, FK $\rightarrow$ `events.event_id` RESTRICT)
   - `seat_number` (VARCHAR(10), NOT NULL — e.g. `FLR-A1`, `BAL-A3`, `N-A1`)
   - `section` (VARCHAR(50), NOT NULL, DEFAULT 'General' — e.g. 'Floor', 'Upper Tier', 'Balcony', 'Stalls')
   - `tier` (VARCHAR(20), NOT NULL, DEFAULT 'STANDARD' — VIP, PREMIUM, STANDARD, ECONOMY)
   - `price` (DECIMAL(10,2), NOT NULL, DEFAULT 1000.00 — active seat price)
   - `row_label` (VARCHAR(2), NOT NULL)
   - `seat_col` (INT, NOT NULL)
   - `status` (ENUM('AVAILABLE', 'BOOKED'), DEFAULT 'AVAILABLE')
   - `CONSTRAINT uq_seats_event_seat UNIQUE (event_id, seat_number)`

4. **`bookings`**:
   - `booking_id` (INT, PK, AUTO_INCREMENT)
   - `user_id` (INT, NOT NULL, FK $\rightarrow$ `users.user_id` RESTRICT)
   - `event_id` (INT, NOT NULL, FK $\rightarrow$ `events.event_id` RESTRICT)
   - `booking_reference` (VARCHAR(32), NOT NULL, UNIQUE — e.g. `EVT-A1B2C3D4`)
   - `status` (ENUM('CONFIRMED', 'CANCELLED'), DEFAULT 'CONFIRMED')
   - `total_amount` (DECIMAL(10,2), NOT NULL)
   - `idempotency_key` (VARCHAR(64), NULL)
   - `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
   - `cancelled_at` (TIMESTAMP, NULL)
   - `CONSTRAINT uq_bookings_user_idempotency UNIQUE (user_id, idempotency_key)`

5. **`booking_seats`** (Allocation, Pricing Snapshot & Audit Junction):
   - `booking_seat_id` (INT, PK, AUTO_INCREMENT)
   - `booking_id` (INT, NOT NULL, FK $\rightarrow$ `bookings.booking_id` RESTRICT)
   - `seat_id` (INT, NOT NULL, FK $\rightarrow$ `seats.seat_id` RESTRICT)
   - `price_paid` (DECIMAL(10,2), NOT NULL, DEFAULT 0.00 — immutable purchase price snapshot)
   - `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE)
   - `active_seat_id` (INT GENERATED ALWAYS AS (IF(is_active, seat_id, NULL)) STORED)
   - `CONSTRAINT uq_booking_seats_active_seat UNIQUE (active_seat_id)`

---

## The Six Venue Layouts & Seating Plans

Every event has an architectural layout matching the physical characteristics of its venue. All 6 layouts are rendered purely via CSS 3D transforms (`rotateX`, `rotateY`, `translate3d`):

| Event # | Title | Venue Layout | Total Seats | Sections & Seat Counts | Tiers & Prices |
|:---|:---|:---|:---:|:---|:---|
| **1** | **Neon Odyssey: Synthwave World Tour** | **ARENA** | **138** | Floor: 50<br>Lower Left: 20<br>Lower Right: 20<br>Upper Tier: 48 | **VIP**: ₹4,000 (Floor `FLR-A1..` - 50 seats)<br>**PREMIUM**: ₹3,000 (Lower `LL-A1..`, `LR-A1..` - 40 seats)<br>**STANDARD**: ₹2,000 (Upper `UPR-A1..` - 48 seats) |
| **2** | **NextGen AI & Cloud Summit 2026** | **AUDITORIUM** | **128** | Left Block: 32<br>Center Block: 64<br>Right Block: 32 | **PREMIUM**: ₹4,900 (Center `CB-A1..` - 64 seats)<br>**STANDARD**: ₹3,500 (Flanks `LB-A1..`, `RB-A1..` - 64 seats) |
| **3** | **Midnight Chuckles: Standup Comedy** | **CLUB** | **40** | Tables: 32 (8 circular tables)<br>Bar: 8 | **PREMIUM**: ₹1,040 (Tables `T1-1..T8-4` - 32 seats)<br>**ECONOMY**: ₹560 (Bar `BAR-1..BAR-8` - 8 seats) |
| **4** | **The Phantom Illusion: Live Musical** | **THEATRE** | **144** | Stalls: 60<br>Circle: 44<br>Balcony: 28<br>Royal Boxes: 12 | **VIP**: ₹3,300 (Boxes `BOX-L1..`, `BOX-R1..` - 12 seats)<br>**PREMIUM**: ₹2,250 (Stalls `STL-A1..`, Balcony `BAL-A1..` - 88 seats)<br>**STANDARD**: ₹1,500 (Circle `CIR-A1..` - 44 seats) |
| **5** | **Apex Championship: Sports Finals** | **STADIUM** | **126** | North Stand: 30<br>East Stand: 36<br>South Stand: 30<br>West Stand: 30 | **VIP**: ₹2,600 (North `N-A1..` - 30 seats)<br>**PREMIUM**: ₹1,950 (South `S-A1..` - 30 seats)<br>**STANDARD**: ₹1,300 (East `E-A1..` - 36 seats)<br>**ECONOMY**: ₹910 (West `W-A1..` - 30 seats) |
| **6** | **Solaris Light & Sonic Festival** | **FESTIVAL** | **138** | Main Stage Deck: 30<br>General Field: 60<br>Lawn: 48 | **VIP**: ₹12,500 (Deck `VIP-A1..` - 30 seats)<br>**PREMIUM**: ₹7,500 (Field `GA-A1..` - 60 seats)<br>**ECONOMY**: ₹3,000 (Lawn `LWN-A1..` - 48 seats) |

*(Total across all 6 venues: 714 seeded seats)*

### Realistic Seat Labels
Seats are labeled by section and row/col coordinates:
- `FLR-A1` (Arena Floor)
- `UPR-A1` (Arena Upper Tier)
- `CB-A1` (Auditorium Center Block)
- `T1-1` (Comedy Club Table 1, Seat 1)
- `BAR-1` (Comedy Club Bar)
- `STL-A1` (Theatre Stalls)
- `CIR-A1` (Theatre Circle)
- `BAL-A1` / `BAL-A3` (Theatre Balcony)
- `BOX-L1` (Theatre Left Royal Box)
- `N-A1` (Stadium North Stand)
- `VIP-A1` (Festival VIP Deck)
- `GA-A1` (Festival General Field)

---

## Tiered Pricing & Server-Side Financial Integrity

### 1. The Server Alone Decides Prices
Any `price`, `tier`, or `totalAmount` sent in the `POST /bookings` body is **strictly ignored**. Prices are fetched exclusively from the database rows locked inside the transaction.

### 2. Zero Floating-Point Rupee Addition (Integer Paise Math)
Computers represent IEEE 754 floating-point numbers with precision anomalies (e.g., `0.1 + 0.2 = 0.30000000000000004`). In TicketFlow, financial calculations are performed in integer paise:
```javascript
// Sum integer paise across all locked seat rows
let sumPaise = 0;
for (const seat of lockedSeats) {
  sumPaise += Math.round(Number(seat.price) * 100);
}

// Convert to rupee DECIMAL(10,2) once at the end
const finalTotal = (sumPaise / 100).toFixed(2);
```

### 3. Historical Price Snapshots (`booking_seats.price_paid`)
When a booking is created, the locked seat's current price is saved in `booking_seats.price_paid`:
```javascript
await connection.query(
  'INSERT INTO booking_seats (booking_id, seat_id, price_paid, is_active) VALUES (?, ?, ?, TRUE)',
  [bookingId, seat.seatId, Number(seat.price).toFixed(2)]
);
```
Even if an administrator runs a direct `UPDATE seats SET price = 9999.00`, existing booking receipts (`GET /bookings/:id` and `GET /bookings/my`) continue to report the exact historical price paid.

---

## Prerequisites & Environment Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MySQL Server**: 8.0 or higher running locally (or accessible remotely)

### 2. Environment Files

#### Backend Configuration (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ticket_booking
JWT_SECRET=super_secret_jwt_key_min_32_characters_long_12345
CORS_ORIGIN=http://localhost:5173
```

#### Frontend Configuration (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Database Initialization & Seeding

```bash
# From within the backend directory:
npm run db:init
```

### 4. Running the Application

```bash
# Terminal 1: Start Backend Server
cd backend
npm run dev
# Server starts at http://localhost:5000

# Terminal 2: Start Frontend Client
cd frontend
npm run dev
# Vite dev server starts at http://localhost:5173
```

### 5. Running Automated Verification Gates

```bash
# 1. Run Backend Jest Integration Suite (6 suites, 53 tests)
cd backend
npm test

# 2. Run High-Concurrency Race Script (10 simultaneous concurrent requests)
node scripts/race.js

# 3. Run Gate 8 Comprehensive Booking Verification (11 scenarios)
node scripts/gate8.js

# 4. Run Real HTTP E2E Smoke Test (10 steps)
node scripts/e2e-smoke.js

# 5. Run Database Integrity SQL Check Runner (4 checks)
node scripts/integrity-check.js

# 6. Run Frontend Linter & Production Build
cd ../frontend
npm run lint
npm run build
```

---

## Demo Credentials

The database seeder automatically initializes the following test accounts:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Standard User 1** | `alice@example.com` | `Password123!` | Browse events, select seats, book, cancel own bookings |
| **Standard User 2** | `bob@example.com` | `Password123!` | Competing race user, independent bookings |
| **Administrator** | `admin@example.com` | `Password123!` | Full access, view/cancel any user's booking |

---

## API Contract & Endpoint Documentation

All endpoints are prefixed with `/api/v1`. Responses adhere strictly to:
- **Success**: `{ "success": true, "message": "...", "data": { ... } }`
- **Error**: `{ "success": false, "message": "..." }`

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | None | Create a new user account |
| `POST` | `/auth/login` | None | Authenticate with email/password; returns JWT |
| `GET` | `/auth/me` | Bearer JWT | Returns current authenticated user profile |
| `GET` | `/events` | None | Paginated event list with `price` (min) and `priceMax` |
| `GET` | `/events/:id` | None | Single event profile including `tiers` array |
| `GET` | `/events/:id/seats` | None | Per-seat `section`, `tier`, `price`, `seatNumber`, and live status |
| `POST` | `/bookings` | Bearer JWT | Atomic reservation with `Idempotency-Key` header |
| `GET` | `/bookings/my` | Bearer JWT | Authenticated user's booking history with `price_paid` snapshot |
| `GET` | `/bookings/:id` | Bearer JWT | Single booking pass with `price_paid` snapshot (Owner or Admin) |
| `POST` | `/bookings/:id/cancel`| Bearer JWT | Cancel reservation & atomically release seats |
| `POST` | `/dev/race` | Bearer JWT | (Dev-only) Launch N concurrent requests for a seat |
| `POST` | `/dev/race/reset` | Bearer JWT | (Dev-only) Reset winning reservation for re-running |

### Example Contract Payloads

#### 1. `GET /api/v1/events/1`
```json
{
  "success": true,
  "message": "Event details retrieved successfully",
  "data": {
    "event": {
      "eventId": 1,
      "title": "Neon Odyssey: Synthwave World Tour",
      "venue": "Cyber Dome, Neo Metropolis",
      "eventDate": "2026-10-31T19:00:00.000Z",
      "price": 2000,
      "priceMax": 4000,
      "category": "Concert",
      "layoutType": "ARENA",
      "totalSeats": 138,
      "availableSeats": 122,
      "tiers": [
        { "tier": "VIP", "price": 4000, "totalSeats": 50, "availableSeats": 44 },
        { "tier": "PREMIUM", "price": 3000, "totalSeats": 40, "availableSeats": 34 },
        { "tier": "STANDARD", "price": 2000, "totalSeats": 48, "availableSeats": 44 }
      ]
    }
  }
}
```

#### 2. `POST /api/v1/bookings`
**Headers**:
- `Authorization: Bearer <token>`
- `Idempotency-Key: a3f88b47-66c3-4d4b-a25e-50369806b291`

```json
// Request (Any client-sent price is strictly ignored)
{
  "eventId": 1,
  "seatIds": [1, 51]
}

// Response (201 Created)
{
  "success": true,
  "message": "Booking confirmed successfully",
  "data": {
    "bookingId": 15,
    "bookingReference": "EVT-8F32C19A",
    "status": "CONFIRMED",
    "eventId": 1,
    "seatIds": [1, 51],
    "seatNumbers": ["FLR-A1", "LL-A1"],
    "seats": [
      { "seatId": 1, "seatNumber": "FLR-A1", "section": "Floor", "tier": "VIP", "price": 4000 },
      { "seatId": 51, "seatNumber": "LL-A1", "section": "Lower Left", "tier": "PREMIUM", "price": 3000 }
    ],
    "totalAmount": 7000
  }
}
```

---

## How Double-Booking is Prevented

Double booking is mathematically prevented through five coordinated layers of defence:

```
[Incoming Concurrent Requests]
              |
              v
1. Input Normalization & Deadlock Elimination (Sort seat IDs: [1, 51])
              |
              v
2. Single Dedicated DB Connection per Transaction (release in finally)
              |
              v
3. Pessimistic Row Lock (SELECT ... WHERE seat_id IN (...) ORDER BY seat_id ASC FOR UPDATE)
   --> Only ONE transaction holds exclusive locks on those seat rows
   --> Competing transactions block on the row locks
              |
              v
4. State Verification (status == 'AVAILABLE')
   --> 1st transaction sees AVAILABLE, proceeds to book
   --> 2nd transaction waits, unblocks, sees status == 'BOOKED', aborts with 409
              |
              v
5. Database Invariant Barrier: UNIQUE(active_seat_id) on booking_seats
   --> Generated column: IF(is_active, seat_id, NULL)
   --> Physical B-tree index guarantees NO TWO active rows can share a seat_id
```

---

## Design Decisions: Why CSS 3D Instead of WebGL

| Dimension | Pure CSS 3D Transforms (Our Choice) | Three.js / WebGL / Canvas |
| :--- | :--- | :--- |
| **Bundle Size Overhead** | **0 kB** (native browser CSS engine) | **+500 kB to +1.2 MB** library bundle |
| **Accessibility (A11y)** | **Native DOM elements**: full screen-reader support, roving tabindex, native keyboard tab stops, standard focus rings | Opaque `<canvas>` element requiring custom offscreen accessibility DOM trees and virtual focus managers |
| **Tap Targets (WCAG 2.5.5)** | Real `<button>` nodes with responsive `::before` pseudo hit targets $\ge 44\text{px}$ | Requires complex raycasting from 2D mouse coords to 3D meshes |
| **GPU Acceleration** | Hardware-accelerated GPU compositor via `matrix3d()` and `transform-style: preserve-3d` | WebGL context initialization, shader compilation, and GPU memory overhead |
| **Styling & Theming** | Direct CSS variable reactivity (`--tilt`, `--yaw`, `--zoom`, color tokens) | Custom material uniforms, custom shader rebuilds, canvas re-renders |
| **Mobile Degradation** | Instant seamless fallback to 2D view with zero overhead | High mobile GPU memory usage, potential WebGL context loss on mobile backgrounding |

---

## 5-Minute Demo Script (Multi-Venue & Tiered Pricing)

| Timestamp | Phase & Screen | Action & What to Click | What to Say |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:45** | **Hero & Catalog** (`/`) | 1. Move cursor over hero tickets to show 3D parallax depth.<br>2. Type `/` keyboard shortcut into search bar.<br>3. Observe price footers: Event cards display **`From ₹X – ₹Y`** ranges (e.g. `From ₹2,000 – ₹4,000`). | *"Welcome to TicketFlow. Notice the hero scene reacting with real-time 3D parallax. Our catalog displays realistic price ranges across events, powered by our tiered pricing model."* |
| **0:45 – 1:30** | **Venue 1: Arena 3D Map** (`/events/1/seats`) | 1. Click *Select Seats* on Neon Odyssey.<br>2. Drag the amphitheater to orbit. Point out the gold **Floor** seats (VIP), violet **Lower Stands** (Premium), and cyan **Upper Tier** (Standard).<br>3. Inspect the toolbar legend showing exact prices per tier. | *"Here is our Arena layout. Every venue type has its own real architectural shape. The Floor section carries VIP seats in gold at ₹4,000, while Upper Tier carries Standard seats at ₹2,000. All rendered with pure CSS 3D transforms."* |
| **1:30 – 2:15** | **Venue 2: Theatre 3D Map** (`/events/4/seats`) | 1. Navigate to Event #4 (The Phantom Illusion).<br>2. Rotate view: show the **Stalls**, elevated **Circle**, upper **Balcony**, and cantilevered **Royal Boxes** with gold curtain velvet decor.<br>3. Point out Royal Box VIP seats (`BOX-L1`) and Balcony seats (`BAL-A1`). | *"Now look at the Theatre layout. Notice how the scene geometry completely transforms: we have ground Stalls, an elevated Circle, cantilevered Royal Boxes on the left and right, and an upper Balcony. Zero WebGL, zero Three.js."* |
| **2:15 – 3:00** | **Venue 3: Stadium 360° Ring** (`/events/5/seats`) | 1. Navigate to Event #5 (Apex Championship).<br>2. Rotate 360 degrees around the central green sports pitch.<br>3. Point out the North, East, South, and West stands with their respective tiers (VIP, Premium, Standard, Economy). | *"In our Stadium layout, 4 stands ring a central pitch in full 360-degree perspective. North Stand represents VIP seating with direct midfield views."* |
| **3:00 – 3:45** | **Mixed-Tier Booking & Sticky Drawer** (`/events/1/seats`) | 1. Return to Event #1.<br>2. Select 1 VIP seat (`FLR-A1` @ ₹4,000) and 1 Standard seat (`UPR-A1` @ ₹2,000).<br>3. Show the Booking Summary drawer: chips show `VIP` and `STANDARD` badges with their individual prices, and the total displays **₹6,000**.<br>4. Click **Confirm (2)**. | *"Let's book across tiers: one VIP floor seat and one Upper Tier seat. Notice how the summary displays the exact breakdown: ₹4,000 + ₹2,000 = ₹6,000. The server computes this total in integer paise from locked database rows, strictly ignoring any client input."* |
| **3:45 – 4:30** | **3D Ticket Pass & Price Snapshot** (`/booking/:id`) | 1. Observe self-drawing SVG checkmark celebration.<br>2. On the 3D ticket stub, point out the reserved seat pills showing `FLR-A1 VIP ₹4,000` and `UPR-A1 STANDARD ₹2,000`.<br>3. Flip ticket to show the SVG security barcode and terms.<br>4. Navigate to **My Bookings** $\rightarrow$ show the booking card with tier badges. | *"Here is the confirmed 3D digital ticket. Each seat pill preserves the exact purchase price snapshot in `booking_seats.price_paid`. Even if event prices change tomorrow, this ticket's financial audit trail remains immutable."* |
| **4:30 – 5:00** | **Cancellation, Instant Seat Release & Concurrency Proof** | 1. Click **Cancel** on the booking in My Bookings.<br>2. Return to `/events/1/seats`: the seats are immediately available again.<br>3. Visit `/demo`: show the 10-way concurrency race proving zero double-booking. | *"We cancel the reservation, and MySQL immediately releases the seat back to the pool while preserving audit history. TicketFlow combines bulletproof ACID financial integrity with a stunning CSS 3D user experience."* |

---

## 12 Likely Judge Questions & In-Depth Answers

### 1. What database isolation level are you using, and why are row locks necessary?
> **Answer**: We use MySQL InnoDB's default `REPEATABLE READ` isolation level. Standard isolation levels alone do not prevent write-skew or concurrent read-then-write double bookings because concurrent transactions read a consistent snapshot. To guarantee mutual exclusion, we use pessimistic row locks (`SELECT ... FOR UPDATE`), which lock the actual index records and block all competing booking transactions until the active transaction commits or rolls back.

### 2. How do you prevent deadlocks when a user books multiple seats simultaneously?
> **Answer**: Deadlocks occur when Transaction A locks Seat 1 and requests Seat 2, while Transaction B locks Seat 2 and requests Seat 1 (a cyclic dependency). We eliminate this cycle by **sorting all requested seat IDs in ascending numerical order** (`ORDER BY seat_id ASC`) before issuing `SELECT ... FOR UPDATE`. Because every transaction locks rows in the identical sequence, circular lock waits cannot occur. We also include a 3-attempt jittered retry as a safeguard.

### 3. Why does the server alone compute totals, and why do you use integer paise?
> **Answer**: We treat all client input as untrusted. A malicious actor could easily tamper with client POST requests to send `{ price: 1, totalAmount: 1 }`. By fetching prices directly from locked database rows inside the transaction, client tampering is impossible. Furthermore, floating-point arithmetic in software (`0.1 + 0.2 = 0.30000000000000004`) causes rounding errors. We accumulate totals in integer paise (`Math.round(Number(price) * 100)`), divide once by 100 at the end, and store the total as `DECIMAL(10,2)`.

### 4. What is a price snapshot (`price_paid`), and why is it stored per seat?
> **Answer**: In real event ticketing, seat prices change over time due to dynamic pricing, promotions, or inflation. If a booking only referenced the `seats.price` column, updating a seat's price tomorrow would silently rewrite past booking receipts and corrupt accounting reports. We store `price_paid DECIMAL(10,2)` on each `booking_seats` row at the moment of booking. This provides an immutable financial record that guarantees past receipts match the exact money collected.

### 5. How does the unique active-seat key work in MySQL?
> **Answer**: In the `booking_seats` table, we define:
> `active_seat_id INT GENERATED ALWAYS AS (IF(is_active, seat_id, NULL)) STORED`
> with a `UNIQUE(active_seat_id)` constraint. When active, `active_seat_id = seat_id`, and the unique B-tree index rejects duplicates. When cancelled, `is_active` becomes `FALSE`, making `active_seat_id = NULL`. In SQL and MySQL InnoDB, `NULL` values do not collide in unique indexes, allowing unlimited historical cancelled rows while strictly disallowing more than one active reservation.

### 6. How does your system handle idempotent booking requests?
> **Answer**: The frontend generates a unique UUID `Idempotency-Key` per booking attempt and passes it as an HTTP header. The database enforces `UNIQUE(user_id, idempotency_key)` on `bookings`. If a user experiences network loss and retries with the same key and payload, the server returns the previously created booking with **HTTP 200**. If the key is replayed with a different payload, it immediately rejects with **HTTP 409 Conflict**.

### 7. Why did you choose pure CSS 3D over Three.js / WebGL?
> **Answer**: Three.js introduces 600 kB+ of JavaScript, canvas context initialization overhead, and completely opaque `<canvas>` pixels that break web accessibility. With CSS 3D, our seat map is rendered with native HTML `<button>` elements accelerated by the browser's GPU compositor (`transform-style: preserve-3d`). This provides instant initial load times, native roving tabindex keyboard accessibility, screen-reader announcements, and direct CSS variable styling.

### 8. How do you handle multi-venue architectural decor in CSS 3D?
> **Answer**: Each layout defines its own 3D coordinate space. For the Comedy Club, we calculate table center coordinates and render circular CSS disks under groups of 4 chairs. For the Theatre, we render cantilevered royal boxes and balconies at elevated Z-coordinates with counter-rotated labels. For the Stadium, seats are placed in an elliptical ring with tangent rotation angles around a textured sports pitch.

### 9. What happens if a user abandons seat selection or stays on the page forever?
> **Answer**: Seats are not locked while simply browsing or hovering. Locks are only acquired during the sub-millisecond execution of the `POST /bookings` transaction. To prevent stale selections, the frontend polls `/events/:id/seats` every 5 seconds. If a seat is taken by someone else while another user has it selected, our live conflict-pruning algorithm alerts the user with a warning toast and deselects the unavailable seat before they attempt to confirm.

### 10. How do you prevent double-cancellation or race conditions on booking cancellation?
> **Answer**: Cancellations run inside a single MySQL transaction using `SELECT * FROM bookings WHERE booking_id = ? FOR UPDATE`. If the booking status is already `CANCELLED`, the transaction rolls back and returns **HTTP 409 Conflict**. Otherwise, it sets `status = 'CANCELLED'`, updates `booking_seats.is_active = FALSE`, and flips the seat status back to `AVAILABLE`.

### 11. How would you scale this system beyond a single MySQL database node?
> **Answer**: Read traffic accounts for >90% of requests and can be scaled horizontally across MySQL Read Replicas or cached in Redis with short TTLs. For write scaling, event seating is partitioned by `event_id`: booking Seat A1 for Event 1 has zero relation to Event 2. We can shard write databases by `event_id` or use distributed databases like Vitess/PlanetScale where each event resides on an independent partition.

### 12. What are the limitations of CSS 3D and when would you switch to WebGL?
> **Answer**: CSS 3D is ideal for venues with up to ~500 DOM elements. When scaling to a 50,000-seat stadium, managing 50,000 DOM nodes degrades browser DOM layout and memory performance. In that scenario, we would transition the 3D viewport to a WebGL instanced-mesh renderer while retaining an invisible DOM accessibility tree for keyboard and screen-reader support.
