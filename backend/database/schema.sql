-- ============================================================================
-- Ticket Booking System - Database Schema
-- Storage Engine: InnoDB
-- Character Set: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS booking_seats;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Table: users
-- Core authentication and authorization credentials.
-- Constraints:
--   - pk_users: PRIMARY KEY on user_id ensures each user has a unique internal identifier.
--   - uq_users_email: UNIQUE constraint on email prevents duplicate registrations.
-- ============================================================================
CREATE TABLE users (
  user_id INT AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_users PRIMARY KEY (user_id),
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: events
-- Event catalog, venue details, pricing, and scheduling.
-- Constraints:
--   - pk_events: PRIMARY KEY on event_id ensures unique identification of every event.
-- Indexes:
--   - idx_events_event_date: Index on event_date accelerates filtering upcoming events
--     and chronologically ordered queries.
-- ============================================================================
CREATE TABLE events (
  event_id INT AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  venue VARCHAR(255) NOT NULL,
  event_date DATETIME NOT NULL COMMENT 'Event date and time stored in UTC',
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  image_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_events PRIMARY KEY (event_id),
  INDEX idx_events_event_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: seats
-- Logical and physical seats belonging to an event layout.
-- Constraints:
--   - pk_seats: PRIMARY KEY on seat_id uniquely identifies each individual seat record.
--   - fk_seats_event: FOREIGN KEY on event_id enforces referential integrity against events.
--     STRICT RESTRICT on DELETE and UPDATE prevents accidental deletion of events with configured seats.
--   - uq_seats_event_seat: UNIQUE constraint on (event_id, seat_number) ensures no duplicate
--     seat numbers can exist within the same event.
-- Indexes:
--   - idx_seats_event_id: Optimizes querying all seats for a specific event.
-- ============================================================================
CREATE TABLE seats (
  seat_id INT AUTO_INCREMENT,
  event_id INT NOT NULL,
  seat_number VARCHAR(10) NOT NULL,
  row_label VARCHAR(2) NOT NULL,
  seat_col INT NOT NULL,
  status ENUM('AVAILABLE', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT pk_seats PRIMARY KEY (seat_id),
  CONSTRAINT uq_seats_event_seat UNIQUE (event_id, seat_number),
  CONSTRAINT fk_seats_event FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_seats_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: bookings
-- Transaction records of user reservations.
-- Constraints:
--   - pk_bookings: PRIMARY KEY on booking_id uniquely identifies each booking transaction.
--   - fk_bookings_user: FOREIGN KEY on user_id ensures valid user identity.
--     STRICT RESTRICT on DELETE and UPDATE ensures user accounts with financial booking history cannot be deleted.
--   - fk_bookings_event: FOREIGN KEY on event_id ensures valid event reference.
--     STRICT RESTRICT on DELETE and UPDATE ensures booked events cannot be deleted.
--   - uq_bookings_reference: UNIQUE constraint on booking_reference ensures public alphanumeric
--     references are globally distinct.
--   - uq_bookings_user_idempotency: UNIQUE constraint on (user_id, idempotency_key) guarantees
--     idempotent booking submissions, preventing duplicate charge/booking requests per user.
-- Indexes:
--   - idx_bookings_user_id: Optimizes lookup of user purchase history (GET /bookings/my).
--   - idx_bookings_event_id: Optimizes lookup of all bookings under an event.
-- ============================================================================
CREATE TABLE bookings (
  booking_id INT AUTO_INCREMENT,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  booking_reference VARCHAR(32) NOT NULL,
  status ENUM('CONFIRMED', 'CANCELLED') NOT NULL DEFAULT 'CONFIRMED',
  total_amount DECIMAL(10,2) NOT NULL,
  idempotency_key VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  CONSTRAINT pk_bookings PRIMARY KEY (booking_id),
  CONSTRAINT uq_bookings_reference UNIQUE (booking_reference),
  CONSTRAINT uq_bookings_user_idempotency UNIQUE (user_id, idempotency_key),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_bookings_event FOREIGN KEY (event_id) REFERENCES events (event_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_bookings_user_id (user_id),
  INDEX idx_bookings_event_id (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table: booking_seats
-- Seat allocation junction mapping bookings to seats.
-- Architectural Guarantee & Explanation:
--   The generated column active_seat_id (STORED) together with UNIQUE(active_seat_id)
--   guarantees at most ONE ACTIVE allocation per seat while cancelled rows stay as
--   history, so a cancelled seat can be rebooked.
--   When is_active is TRUE, active_seat_id evaluates to seat_id, which MySQL enforces
--   as unique across the table. When a booking is cancelled, setting is_active = FALSE
--   evaluates active_seat_id to NULL. In standard SQL and MySQL InnoDB, NULLs do not
--   collide in UNIQUE constraints, allowing multiple cancelled historical records for
--   the same seat while strictly barring more than one active reservation.
-- Strict Foreign Key Rules:
--   STRICT: all foreign keys use default RESTRICT (NO CASCADE / SET NULL), because
--   MySQL does not allow CASCADE or SET NULL on the base column of a stored generated column.
-- Constraints:
--   - pk_booking_seats: PRIMARY KEY on booking_seat_id uniquely identifies each allocation row.
--   - uq_booking_seats_active_seat: UNIQUE constraint on active_seat_id enforces single-active-seat allocation.
--   - fk_booking_seats_booking: FOREIGN KEY on booking_id with RESTRICT on DELETE/UPDATE.
--   - fk_booking_seats_seat: FOREIGN KEY on seat_id with RESTRICT on DELETE/UPDATE.
-- Indexes:
--   - idx_booking_seats_booking_id: Optimizes lookup of all seats belonging to a booking.
-- ============================================================================
CREATE TABLE booking_seats (
  booking_seat_id INT AUTO_INCREMENT,
  booking_id INT NOT NULL,
  seat_id INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  active_seat_id INT GENERATED ALWAYS AS (IF(is_active, seat_id, NULL)) STORED,
  CONSTRAINT pk_booking_seats PRIMARY KEY (booking_seat_id),
  CONSTRAINT uq_booking_seats_active_seat UNIQUE (active_seat_id),
  CONSTRAINT fk_booking_seats_booking FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_booking_seats_seat FOREIGN KEY (seat_id) REFERENCES seats (seat_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  INDEX idx_booking_seats_booking_id (booking_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
