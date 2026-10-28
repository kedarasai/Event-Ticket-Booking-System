/**
 * primitives.js
 * Pure mathematical primitives for 3D CSS seat map projections.
 *
 * All coordinates are produced in scene units (pixels):
 * - x: horizontal position (left negative, right positive)
 * - y: depth along floor plane (front negative toward stage, back positive)
 * - z: vertical elevation / tier height out of floor plane
 * - angleDeg: rotation around Z in degrees (faces center/stage)
 */

/**
 * Normalizes degrees into [0, 360)
 */
export function normalizeDeg(deg) {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Computes angular span between startDeg and endDeg, explicitly handling
 * the 0°/360° boundary wrap-around (e.g., 310° to 50° => 100° span).
 *
 * @param {number} startDeg - Starting angle in degrees
 * @param {number} endDeg - Ending angle in degrees
 * @returns {{ span: number, isWrap: boolean }}
 */
export function calculateArcSpan(startDeg, endDeg) {
  const s = normalizeDeg(startDeg);
  const e = normalizeDeg(endDeg);

  if (s <= e) {
    return { span: e - s, isWrap: false };
  } else {
    // Explicit wrap across 360°/0°
    const span = (360 - s) + e;
    return { span, isWrap: true };
  }
}

/**
 * Interpolates an angle between startDeg and endDeg along the forward arc,
 * with explicit wrap-around handling.
 *
 * @param {number} startDeg - Starting angle in degrees (e.g. 310)
 * @param {number} endDeg - Ending angle in degrees (e.g. 50)
 * @param {number} t - Fraction from 0 to 1
 * @returns {number} Interpolated angle in [0, 360)
 */
export function interpolateArcAngle(startDeg, endDeg, t) {
  const { span, isWrap } = calculateArcSpan(startDeg, endDeg);
  let deg = normalizeDeg(startDeg) + t * span;
  if (isWrap && deg >= 360) {
    deg -= 360;
  }
  return normalizeDeg(deg);
}

/**
 * Rectangular grid block with optional row rake (elevation), yaw/rotation, and aisle offsets.
 */
export function gridBlock({
  rows,
  cols,
  startX = 0,
  startY = 0,
  startZ = 0,
  pitchX = 38,
  pitchY = 44,
  rake = 10,
  yawDeg = 0,
  centerOffset = true
}) {
  const result = [];
  const rowCount = Array.isArray(rows) ? rows.length : Number(rows);

  for (let r = 0; r < rowCount; r++) {
    const rowLabel = Array.isArray(rows) ? rows[r] : String.fromCharCode(65 + r);
    const colCount = typeof cols === 'function' ? cols(r) : (Array.isArray(cols) ? cols[r] : Number(cols));
    const totalRowWidth = (colCount - 1) * pitchX;
    const rowStartX = centerOffset ? (startX - totalRowWidth / 2) : startX;
    const rowY = startY + r * pitchY;
    const rowZ = startZ + r * rake;

    for (let c = 0; c < colCount; c++) {
      let localX = rowStartX + c * pitchX;
      let localY = rowY;

      // Apply block rotation if specified
      if (yawDeg !== 0) {
        const rad = (yawDeg * Math.PI) / 180;
        const dx = localX - startX;
        const dy = localY - startY;
        localX = startX + dx * Math.cos(rad) - dy * Math.sin(rad);
        localY = startY + dx * Math.sin(rad) + dy * Math.cos(rad);
      }

      result.push({
        rowIndex: r,
        colIndex: c,
        rowLabel,
        colNumber: c + 1,
        x: Number(localX.toFixed(2)),
        y: Number(localY.toFixed(2)),
        z: Number(rowZ.toFixed(2)),
        angleDeg: Number(yawDeg.toFixed(2))
      });
    }
  }

  return result;
}

/**
 * Radial curved arc block (amphitheater, fan, auditorium).
 */
export function arcBlock({
  rows,
  cols,
  innerRadius = 240,
  rowSpacing = 48,
  startAngleDeg = -45,
  endAngleDeg = 45,
  startZ = 0,
  rake = 12,
  center = [0, -100]
}) {
  const result = [];
  const rowCount = Array.isArray(rows) ? rows.length : Number(rows);

  for (let r = 0; r < rowCount; r++) {
    const rowLabel = Array.isArray(rows) ? rows[r] : String.fromCharCode(65 + r);
    const colCount = typeof cols === 'function' ? cols(r) : (Array.isArray(cols) ? cols[r] : Number(cols));
    const radius = innerRadius + r * rowSpacing;
    const z = startZ + r * rake;

    for (let c = 0; c < colCount; c++) {
      const t = colCount > 1 ? c / (colCount - 1) : 0.5;
      const deg = startAngleDeg + t * (endAngleDeg - startAngleDeg);
      const rad = (deg * Math.PI) / 180;

      const x = center[0] + radius * Math.sin(rad);
      const y = center[1] + radius * Math.cos(rad);
      const angleDeg = -deg; // Inward facing

      result.push({
        rowIndex: r,
        colIndex: c,
        rowLabel,
        colNumber: c + 1,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(z.toFixed(2)),
        angleDeg: Number(angleDeg.toFixed(2))
      });
    }
  }

  return result;
}

/**
 * Stadium ring block: 8 sectors around a central pitch.
 * Explicitly handles wrap-around (e.g. North Stand 310° to 50°).
 */
export function ringBlock({
  sectors,
  innerRadiusX = 220,
  innerRadiusY = 160,
  ringWidthX = 90,
  ringWidthY = 90,
  rake = 14,
  startZ = 0,
  center = [0, 60]
}) {
  const result = [];

  for (const sector of sectors) {
    const { name, code, startDeg, endDeg, rows } = sector;
    const rowCount = Array.isArray(rows) ? rows.length : Number(rows);

    for (let r = 0; r < rowCount; r++) {
      const rowInfo = Array.isArray(rows) ? rows[r] : { label: String.fromCharCode(65 + r), count: 10 };
      const rowLabel = rowInfo.label || String.fromCharCode(65 + r);
      const colCount = rowInfo.count || 10;

      const rowT = rowCount > 1 ? r / (rowCount - 1) : 0;
      const rx = innerRadiusX + rowT * ringWidthX;
      const ry = innerRadiusY + rowT * ringWidthY;
      const z = startZ + r * rake;

      for (let c = 0; c < colCount; c++) {
        // Distribute evenly along the sector arc with small margins at edges
        const t = colCount > 1 ? (c + 0.5) / colCount : 0.5;
        const deg = interpolateArcAngle(startDeg, endDeg, t);
        const rad = (deg * Math.PI) / 180;

        // Compass orientation: 0° is North (-Y), 90° East (+X), 180° South (+Y), 270° West (-X)
        const x = center[0] + rx * Math.sin(rad);
        const y = center[1] - ry * Math.cos(rad);

        // Face the central pitch
        let faceDeg = -(deg - 180);
        if (faceDeg > 180) faceDeg -= 360;
        if (faceDeg < -180) faceDeg += 360;

        result.push({
          section: name,
          sectorCode: code,
          rowIndex: r,
          colIndex: c,
          rowLabel,
          colNumber: c + 1,
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
          z: Number(z.toFixed(2)),
          angleDeg: Number(faceDeg.toFixed(2))
        });
      }
    }
  }

  return result;
}

/**
 * Comedy Club table & bar layout block:
 * Round tables with seats arranged along perimeter, plus elevated bar stools.
 */
export function tableBlock({
  tables = [],
  bar = null,
  startZ = 0
}) {
  const result = [];

  // 1. Round Tables
  for (const table of tables) {
    const { id, center, radius = 26, seatCount = 4, startAngle = 45 } = table;
    for (let c = 0; c < seatCount; c++) {
      const deg = startAngle + c * (360 / seatCount);
      const rad = (deg * Math.PI) / 180;

      const x = center[0] + radius * Math.sin(rad);
      const y = center[1] + radius * Math.cos(rad);
      const angleDeg = -deg; // Face inward toward table center

      result.push({
        section: 'Tables',
        tableId: id,
        rowLabel: id,
        colNumber: c + 1,
        rowIndex: 0,
        colIndex: c,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: startZ,
        angleDeg: Number(angleDeg.toFixed(2))
      });
    }
  }

  // 2. Straight Bar
  if (bar) {
    const { center = [0, 240], seatCount = 8, pitchX = 36, startZ: barZ = 16 } = bar;
    const totalWidth = (seatCount - 1) * pitchX;
    const startX = center[0] - totalWidth / 2;

    for (let c = 0; c < seatCount; c++) {
      const x = startX + c * pitchX;
      const y = center[1];

      result.push({
        section: 'Bar',
        rowLabel: 'B',
        colNumber: c + 1,
        rowIndex: 0,
        colIndex: c,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        z: Number(barZ.toFixed(2)),
        angleDeg: 0 // Face straight forward to stage
      });
    }
  }

  return result;
}

export default {
  normalizeDeg,
  calculateArcSpan,
  interpolateArcAngle,
  gridBlock,
  arcBlock,
  ringBlock,
  tableBlock
};
