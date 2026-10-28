/**
 * seatLayout.js
 * Builds complete 3D & 2D seat map data structures for any venue layout.
 * Combines venue templates, mathematical primitives, and backend seat data.
 */

import { getTemplate } from './templates.js';

/**
 * Extracts row label and numeric column from a seat number or seat object.
 * Handles patterns:
 * - 'A5', 'AA12'
 * - 'FLR-A5', 'UPR-C18'
 * - 'T1-2', 'BAR-B4'
 * - objects with row and number properties
 */
export function parseSeatNumber(input) {
  if (!input) return { row: '', col: 0, code: '' };

  if (typeof input === 'object') {
    const row = String(input.row || input.rowLabel || '').toUpperCase();
    const col = parseInt(input.number || input.col || input.seatCol || 0, 10);
    const code = String(input.code || input.section || '');
    if (row && col) {
      return { row, col, code };
    }
  }

  const str = typeof input === 'string'
    ? input
    : (input.seatNumber || `${input.row || ''}${input.number || ''}`);

  const trimmed = String(str).trim();

  // Pattern 1: Section-RowCol (e.g. FLR-A5, UPR-B12, LB-A1, BAR-B4)
  const prefixMatch = trimmed.match(/^([A-Za-z0-9]+)-([A-Za-z]+)(\d+)$/);
  if (prefixMatch) {
    return {
      code: prefixMatch[1],
      row: prefixMatch[2].toUpperCase(),
      col: parseInt(prefixMatch[3], 10)
    };
  }

  // Pattern 2: Table-Seat (e.g. T1-2, T8-4)
  const tableMatch = trimmed.match(/^(T\d+)-(\d+)$/i);
  if (tableMatch) {
    return {
      code: 'TBL',
      row: tableMatch[1].toUpperCase(),
      col: parseInt(tableMatch[2], 10)
    };
  }

  // Pattern 3: Standard RowCol (e.g. A5, C12)
  const stdMatch = trimmed.match(/^([A-Za-z]+)(\d+)$/);
  if (stdMatch) {
    return {
      code: '',
      row: stdMatch[1].toUpperCase(),
      col: parseInt(stdMatch[2], 10)
    };
  }

  return { row: trimmed.toUpperCase(), col: 0, code: '' };
}

/**
 * Natural sorting comparator for seat numbers or seat objects.
 */
export function seatNumberCompare(a, b) {
  const parsedA = parseSeatNumber(a);
  const parsedB = parseSeatNumber(b);

  if (parsedA.code && parsedB.code && parsedA.code !== parsedB.code) {
    return parsedA.code.localeCompare(parsedB.code);
  }

  if (parsedA.row !== parsedB.row) {
    return parsedA.row.localeCompare(parsedB.row, undefined, { numeric: true });
  }

  return parsedA.col - parsedB.col;
}

/**
 * Builds the complete layout model for an event and its seats.
 *
 * @param {object} event - Event object (with layoutType, category, etc.)
 * @param {Array<object>} seats - Raw seat array from GET /events/:id/seats
 * @returns {object} Layout model with rows, sections, bounds, decor, and camera
 */
export function getSeatLayout(seats, event = {}) {
  if (!Array.isArray(seats) || seats.length === 0) {
    return {
      layoutType: 'GENERIC',
      templateName: 'Empty Venue',
      rows: [],
      sections: [],
      decor: [],
      camera: {},
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
    };
  }

  const layoutType = event.layoutType || event.category || 'GENERIC';
  const template = getTemplate(layoutType);
  const slots = template.generatePositions();

  // Create slot lookup maps:
  // Key 1: "section|row|col"
  // Key 2: "row|col"
  const slotMapBySecRowCol = new Map();
  const slotMapByRowCol = new Map();

  for (const slot of slots) {
    const secKey = `${String(slot.section || '').trim().toLowerCase()}|${String(slot.rowLabel).toUpperCase()}|${slot.colNumber}`;
    slotMapBySecRowCol.set(secKey, slot);

    const rowColKey = `${String(slot.rowLabel).toUpperCase()}|${slot.colNumber}`;
    if (!slotMapByRowCol.has(rowColKey)) {
      slotMapByRowCol.set(rowColKey, []);
    }
    slotMapByRowCol.get(rowColKey).push(slot);
  }

  // Track unassigned slots for sequential fallback
  const usedSlots = new Set();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  // Process and match each seat from API
  const processedSeats = seats.map((rawSeat, index) => {
    const parsed = parseSeatNumber(rawSeat);
    const seatRow = String(rawSeat.row || parsed.row || 'A').toUpperCase();
    const seatCol = Number(rawSeat.number || rawSeat.col || parsed.col || 1);
    const seatSec = String(rawSeat.section || '').trim();

    // 1. Try matching by section + row + col
    let slot = null;
    if (seatSec) {
      const secKey = `${seatSec.toLowerCase()}|${seatRow}|${seatCol}`;
      slot = slotMapBySecRowCol.get(secKey);
    }

    // 2. Try matching by row + col
    if (!slot && slotMapByRowCol.has(`${seatRow}|${seatCol}`)) {
      const candidates = slotMapByRowCol.get(`${seatRow}|${seatCol}`);
      slot = candidates.find((c) => !usedSlots.has(c)) || candidates[0];
    }

    // 3. Fallback to slot by index
    if (!slot) {
      slot = slots[index % slots.length];
    }

    if (slot) usedSlots.add(slot);

    const x = slot ? slot.x : (index % 10) * 36 - 160;
    const y = slot ? slot.y : Math.floor(index / 10) * 40;
    const z = slot ? slot.z : 0;
    const angleDeg = slot ? slot.angleDeg : 0;
    const sectionName = seatSec || (slot && slot.section) || 'General';

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;

    return {
      ...rawSeat,
      id: rawSeat.seatId || rawSeat.id,
      seatId: rawSeat.seatId || rawSeat.id,
      seatNumber: rawSeat.seatNumber || `${seatRow}${seatCol}`,
      section: sectionName,
      row: seatRow,
      col: seatCol,
      grid: {
        rowIndex: slot ? slot.rowIndex : 0,
        colIndex: slot ? slot.colIndex : index
      },
      pos: {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
        angleDeg: Number(angleDeg.toFixed(2))
      }
    };
  });

  // Group by rows (for backward compatibility and row-level rendering)
  const rowMap = new Map();
  const sectionMap = new Map();

  for (const seat of processedSeats) {
    // Row grouping key combines section + row label for multi-section uniqueness
    const rowKey = `${seat.section}__${seat.row}`;
    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        key: rowKey,
        label: seat.row,
        section: seat.section,
        seats: []
      });
    }
    rowMap.get(rowKey).seats.push(seat);

    // Section grouping
    if (!sectionMap.has(seat.section)) {
      sectionMap.set(seat.section, {
        name: seat.section,
        seats: []
      });
    }
    sectionMap.get(seat.section).seats.push(seat);
  }

  // Sort seats inside each row by natural seat order
  const rows = Array.from(rowMap.values()).map((r, rowIndex) => {
    r.seats.sort(seatNumberCompare);
    return {
      ...r,
      index: rowIndex
    };
  });

  const sections = Array.from(sectionMap.values()).map((sec) => {
    // Unique rows in section
    const secRows = Array.from(new Set(sec.seats.map((s) => s.row)));
    return {
      ...sec,
      rows: secRows
    };
  });

  const bounds = {
    minX: Number((minX === Infinity ? 0 : minX).toFixed(2)),
    maxX: Number((maxX === -Infinity ? 0 : maxX).toFixed(2)),
    minY: Number((minY === Infinity ? 0 : minY).toFixed(2)),
    maxY: Number((maxY === -Infinity ? 0 : maxY).toFixed(2)),
    minZ: Number((minZ === Infinity ? 0 : minZ).toFixed(2)),
    maxZ: Number((maxZ === -Infinity ? 0 : maxZ).toFixed(2))
  };

  return {
    layoutType: template.layoutType,
    templateName: template.name,
    camera: template.camera,
    decor: template.decor,
    sections,
    rows,
    seats: processedSeats,
    bounds
  };
}

export default {
  parseSeatNumber,
  seatNumberCompare,
  getSeatLayout
};
