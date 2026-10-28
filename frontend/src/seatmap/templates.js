/**
 * templates.js
 * Venue template definitions for each layout type.
 *
 * Each template specifies:
 * - layoutType: string (ARENA, AUDITORIUM, CLUB, THEATRE, STADIUM, FESTIVAL, GENERIC)
 * - name: human-readable venue type name
 * - camera: default tilt, yaw, zoom, and orbit bounds
 * - decor: list of 3D visual decor items for the venue
 * - generatePositions(seats): function returning an array of seat positions matching the venue plan
 */

import {
  gridBlock,
  arcBlock,
  ringBlock,
  tableBlock
} from './primitives.js';

export const VENUE_TEMPLATES = {
  // 1. ARENA (Concert - 138 seats)
  ARENA: {
    layoutType: 'ARENA',
    name: 'Concert Arena',
    camera: {
      defaultTilt: 50,
      defaultYaw: 0,
      defaultZoom: 0.95,
      tiltMin: 30,
      tiltMax: 65,
      yawMin: -45,
      yawMax: 45
    },
    decor: [
      {
        type: 'stage',
        label: 'MAIN STAGE',
        width: 380,
        height: 60,
        x: 0,
        y: -100,
        z: 12,
        hasCatwalk: true,
        catwalkLength: 80,
        beams: 3,
        beamColor: 'cyan'
      },
      {
        type: 'speakerTower',
        x: -210,
        y: -90,
        z: 30
      },
      {
        type: 'speakerTower',
        x: 210,
        y: -90,
        z: 30
      }
    ],
    generatePositions: () => {
      // Floor: 5 rows (A-E) x 10 cols = 50
      const floor = gridBlock({
        rows: ['A', 'B', 'C', 'D', 'E'],
        cols: 10,
        startX: 0,
        startY: 20,
        startZ: 0,
        pitchX: 34,
        pitchY: 38,
        rake: 4
      }).map((s) => ({ ...s, section: 'Floor' }));

      // Lower Left: 4 rows (A:4, B:5, C:5, D:6) = 20
      const lowerLeft = gridBlock({
        rows: ['A', 'B', 'C', 'D'],
        cols: [4, 5, 5, 6],
        startX: -225,
        startY: 20,
        startZ: 14,
        pitchX: 30,
        pitchY: 34,
        rake: 12,
        yawDeg: 26
      }).map((s) => ({ ...s, section: 'Lower Left' }));

      // Lower Right: 4 rows (A:4, B:5, C:5, D:6) = 20
      const lowerRight = gridBlock({
        rows: ['A', 'B', 'C', 'D'],
        cols: [4, 5, 5, 6],
        startX: 225,
        startY: 20,
        startZ: 14,
        pitchX: 30,
        pitchY: 34,
        rake: 12,
        yawDeg: -26
      }).map((s) => ({ ...s, section: 'Lower Right' }));

      // Upper Tier: 3 rows (A:14, B:16, C:18) = 48
      const upperTier = arcBlock({
        rows: ['A', 'B', 'C'],
        cols: [14, 16, 18],
        innerRadius: 345,
        rowSpacing: 44,
        startAngleDeg: -48,
        endAngleDeg: 48,
        startZ: 50,
        rake: 18,
        center: [0, -70]
      }).map((s) => ({ ...s, section: 'Upper Tier' }));

      return [...floor, ...lowerLeft, ...lowerRight, ...upperTier];
    }
  },

  // 2. AUDITORIUM (Conference - 128 seats)
  AUDITORIUM: {
    layoutType: 'AUDITORIUM',
    name: 'Summit Auditorium',
    camera: {
      defaultTilt: 52,
      defaultYaw: 0,
      defaultZoom: 0.95,
      tiltMin: 32,
      tiltMax: 65,
      yawMin: -40,
      yawMax: 40
    },
    decor: [
      {
        type: 'stage',
        label: 'KEYNOTE STAGE',
        width: 440,
        height: 54,
        x: 0,
        y: -90,
        z: 8,
        hasScreen: true,
        beams: 2,
        beamColor: 'violet'
      },
      {
        type: 'podium',
        x: -120,
        y: -75,
        z: 14
      }
    ],
    generatePositions: () => {
      const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

      // Left Block: 8 rows x 4 cols = 32
      const left = gridBlock({
        rows,
        cols: 4,
        startX: -210,
        startY: 15,
        startZ: 4,
        pitchX: 33,
        pitchY: 36,
        rake: 10,
        yawDeg: 14
      }).map((s) => ({ ...s, section: 'Left Block' }));

      // Center Block: 8 rows x 8 cols = 64
      const center = gridBlock({
        rows,
        cols: 8,
        startX: 0,
        startY: 10,
        startZ: 4,
        pitchX: 34,
        pitchY: 36,
        rake: 10,
        yawDeg: 0
      }).map((s) => ({ ...s, section: 'Center Block' }));

      // Right Block: 8 rows x 4 cols = 32
      const right = gridBlock({
        rows,
        cols: 4,
        startX: 210,
        startY: 15,
        startZ: 4,
        pitchX: 33,
        pitchY: 36,
        rake: 10,
        yawDeg: -14
      }).map((s) => ({ ...s, section: 'Right Block' }));

      return [...left, ...center, ...right];
    }
  },

  // 3. CLUB (Comedy - 40 seats)
  CLUB: {
    layoutType: 'CLUB',
    name: 'Comedy Club',
    camera: {
      defaultTilt: 48,
      defaultYaw: 0,
      defaultZoom: 1.1,
      tiltMin: 28,
      tiltMax: 62,
      yawMin: -35,
      yawMax: 35
    },
    decor: [
      {
        type: 'stage',
        label: 'COMEDY STAGE',
        width: 220,
        height: 50,
        x: 0,
        y: -75,
        z: 10,
        hasMicStand: true,
        spotlight: true
      },
      {
        type: 'barCounter',
        width: 320,
        height: 24,
        x: 0,
        y: 245,
        z: 12
      }
    ],
    generatePositions: () => {
      // 8 round tables: T1-T4 (front row), T5-T8 (back row)
      const tables = [
        { id: 'T1', center: [-150, 20], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T2', center: [-50, 20], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T3', center: [50, 20], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T4', center: [150, 20], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T5', center: [-160, 110], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T6', center: [-55, 110], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T7', center: [55, 110], radius: 24, seatCount: 4, startAngle: 45 },
        { id: 'T8', center: [160, 110], radius: 24, seatCount: 4, startAngle: 45 }
      ];

      return tableBlock({
        tables,
        bar: {
          center: [0, 215],
          seatCount: 8,
          pitchX: 36,
          startZ: 14
        },
        startZ: 0
      });
    }
  },

  // 4. THEATRE (Musical Theatre - 144 seats)
  THEATRE: {
    layoutType: 'THEATRE',
    name: 'Proscenium Theatre',
    camera: {
      defaultTilt: 54,
      defaultYaw: 0,
      defaultZoom: 0.95,
      tiltMin: 32,
      tiltMax: 65,
      yawMin: -40,
      yawMax: 40
    },
    decor: [
      {
        type: 'stage',
        label: 'OPERA STAGE',
        width: 420,
        height: 64,
        x: 0,
        y: -110,
        z: 14,
        prosceniumArch: true,
        orchestraPit: true
      },
      {
        type: 'boxBalcony',
        side: 'left',
        x: -255,
        y: 60,
        z: 42,
        width: 75,
        height: 90
      },
      {
        type: 'boxBalcony',
        side: 'right',
        x: 255,
        y: 60,
        z: 42,
        width: 75,
        height: 90
      }
    ],
    generatePositions: () => {
      // Stalls: 7 rows (A:10, B:10, C:12, D:12, E:14, F:14, G:16) = 88
      const stalls = arcBlock({
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        cols: [10, 10, 12, 12, 14, 14, 16],
        innerRadius: 170,
        rowSpacing: 32,
        startAngleDeg: -46,
        endAngleDeg: 46,
        startZ: 0,
        rake: 8,
        center: [0, -100]
      }).map((s) => ({ ...s, section: 'Stalls' }));

      // Circle: 3 rows (A:14, B:14, C:16) = 44
      const circle = arcBlock({
        rows: ['A', 'B', 'C'],
        cols: [14, 14, 16],
        innerRadius: 400,
        rowSpacing: 38,
        startAngleDeg: -50,
        endAngleDeg: 50,
        startZ: 50,
        rake: 16,
        center: [0, -100]
      }).map((s) => ({ ...s, section: 'Circle' }));

      // Left Box: 2 rows (A:3, B:3) = 6
      const leftBox = gridBlock({
        rows: ['A', 'B'],
        cols: 3,
        startX: -250,
        startY: 50,
        startZ: 44,
        pitchX: 28,
        pitchY: 34,
        rake: 10,
        yawDeg: 40
      }).map((s) => ({ ...s, section: 'Left Box' }));

      // Right Box: 2 rows (A:3, B:3) = 6
      const rightBox = gridBlock({
        rows: ['A', 'B'],
        cols: 3,
        startX: 250,
        startY: 50,
        startZ: 44,
        pitchX: 28,
        pitchY: 34,
        rake: 10,
        yawDeg: -40
      }).map((s) => ({ ...s, section: 'Right Box' }));

      return [...stalls, ...circle, ...leftBox, ...rightBox];
    }
  },

  // 5. STADIUM (Sports Finals - 126 seats)
  STADIUM: {
    layoutType: 'STADIUM',
    name: 'Multi-Sport Stadium',
    camera: {
      defaultTilt: 58,
      defaultYaw: 0,
      defaultZoom: 0.9,
      tiltMin: 35,
      tiltMax: 70,
      yawMin: -45,
      yawMax: 45
    },
    decor: [
      {
        type: 'pitch',
        label: 'STADIUM ARENA',
        width: 250,
        height: 160,
        x: 0,
        y: 60,
        z: -2,
        isField: true
      },
      {
        type: 'floodlight',
        x: -240,
        y: -110,
        z: 80
      },
      {
        type: 'floodlight',
        x: 240,
        y: -110,
        z: 80
      },
      {
        type: 'floodlight',
        x: -240,
        y: 230,
        z: 80
      },
      {
        type: 'floodlight',
        x: 240,
        y: 230,
        z: 80
      }
    ],
    generatePositions: () => {
      // 8 sectors matching database:
      // North Stand bearing range 310° to 50° wraps across 0°/360° explicitly!
      const sectors = [
        { name: 'North Stand', code: 'NTH', startDeg: 310, endDeg: 50, rows: [{ label: 'A', count: 10 }, { label: 'B', count: 10 }, { label: 'C', count: 10 }] },
        { name: 'NE Corner', code: 'NEC', startDeg: 50, endDeg: 70, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] },
        { name: 'East End', code: 'EST', startDeg: 70, endDeg: 110, rows: [{ label: 'A', count: 5 }, { label: 'B', count: 5 }, { label: 'C', count: 5 }] },
        { name: 'SE Corner', code: 'SEC', startDeg: 110, endDeg: 130, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] },
        { name: 'South Stand', code: 'STH', startDeg: 130, endDeg: 230, rows: [{ label: 'A', count: 10 }, { label: 'B', count: 10 }, { label: 'C', count: 10 }] },
        { name: 'SW Corner', code: 'SWC', startDeg: 230, endDeg: 250, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] },
        { name: 'West End', code: 'WST', startDeg: 250, endDeg: 290, rows: [{ label: 'A', count: 5 }, { label: 'B', count: 5 }, { label: 'C', count: 5 }] },
        { name: 'NW Corner', code: 'NWC', startDeg: 290, endDeg: 310, rows: [{ label: 'A', count: 3 }, { label: 'B', count: 3 }, { label: 'C', count: 3 }] }
      ];

      return ringBlock({
        sectors,
        innerRadiusX: 220,
        innerRadiusY: 160,
        ringWidthX: 85,
        ringWidthY: 85,
        rake: 14,
        startZ: 6,
        center: [0, 60]
      });
    }
  },

  // 6. FESTIVAL (Outdoor Festival - 138 seats)
  FESTIVAL: {
    layoutType: 'FESTIVAL',
    name: 'Festival Grounds',
    camera: {
      defaultTilt: 52,
      defaultYaw: 0,
      defaultZoom: 0.95,
      tiltMin: 32,
      tiltMax: 65,
      yawMin: -45,
      yawMax: 45
    },
    decor: [
      {
        type: 'stage',
        label: 'SOLARIS STAGE',
        width: 360,
        height: 64,
        x: 0,
        y: -100,
        z: 14,
        trussArch: true,
        lasers: true
      },
      {
        type: 'festivalTent',
        label: 'LOUNGE',
        x: -245,
        y: 20,
        z: 8
      },
      {
        type: 'festivalTent',
        label: 'ART DOME',
        x: 245,
        y: 20,
        z: 8
      }
    ],
    generatePositions: () => {
      // VIP Front: 3 rows (A:8, B:10, C:12) = 30
      const vip = arcBlock({
        rows: ['A', 'B', 'C'],
        cols: [8, 10, 12],
        innerRadius: 130,
        rowSpacing: 34,
        startAngleDeg: -36,
        endAngleDeg: 36,
        startZ: 0,
        rake: 6,
        center: [0, -90]
      }).map((s) => ({ ...s, section: 'VIP Front' }));

      // Zone A: 4 rows (A:6, B:7, C:8, D:9) = 30
      const zoneA = gridBlock({
        rows: ['A', 'B', 'C', 'D'],
        cols: [6, 7, 8, 9],
        startX: -250,
        startY: 35,
        startZ: 10,
        pitchX: 28,
        pitchY: 34,
        rake: 8,
        yawDeg: 28
      }).map((s) => ({ ...s, section: 'Zone A' }));

      // Zone B: 4 rows (A:6, B:7, C:8, D:9) = 30
      const zoneB = gridBlock({
        rows: ['A', 'B', 'C', 'D'],
        cols: [6, 7, 8, 9],
        startX: 250,
        startY: 35,
        startZ: 10,
        pitchX: 28,
        pitchY: 34,
        rake: 8,
        yawDeg: -28
      }).map((s) => ({ ...s, section: 'Zone B' }));

      // Lawn: 3 rows (A:14, B:16, C:18) = 48
      const lawn = arcBlock({
        rows: ['A', 'B', 'C'],
        cols: [14, 16, 18],
        innerRadius: 390,
        rowSpacing: 42,
        startAngleDeg: -50,
        endAngleDeg: 50,
        startZ: 40,
        rake: 16,
        center: [0, -90]
      }).map((s) => ({ ...s, section: 'Lawn' }));

      return [...vip, ...zoneA, ...zoneB, ...lawn];
    }
  },

  // 7. GENERIC (Fallback)
  GENERIC: {
    layoutType: 'GENERIC',
    name: 'Standard Venue',
    camera: {
      defaultTilt: 52,
      defaultYaw: 0,
      defaultZoom: 1.0,
      tiltMin: 35,
      tiltMax: 65,
      yawMin: -35,
      yawMax: 35
    },
    decor: [
      {
        type: 'stage',
        label: 'STAGE',
        width: 440,
        height: 48,
        x: 0,
        y: -92,
        z: 8,
        beams: 3,
        beamColor: 'cyan'
      }
    ],
    generatePositions: () => {
      return arcBlock({
        rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        cols: 10,
        innerRadius: 240,
        rowSpacing: 54,
        startAngleDeg: -45,
        endAngleDeg: 45,
        startZ: 0,
        rake: 10,
        center: [0, -92]
      }).map((s) => ({ ...s, section: 'General' }));
    }
  }
};

/**
 * Returns the matching template by layoutType or category fallback.
 */
export function getTemplate(layoutTypeOrCategory) {
  if (!layoutTypeOrCategory) return VENUE_TEMPLATES.GENERIC;

  const key = String(layoutTypeOrCategory).trim().toUpperCase();
  if (VENUE_TEMPLATES[key]) {
    return VENUE_TEMPLATES[key];
  }

  // Fallback by event category
  const categoryMap = {
    CONCERT: 'ARENA',
    CONFERENCE: 'AUDITORIUM',
    COMEDY: 'CLUB',
    THEATRE: 'THEATRE',
    THEATER: 'THEATRE',
    SPORTS: 'STADIUM',
    SPORT: 'STADIUM',
    FESTIVAL: 'FESTIVAL'
  };

  const mappedKey = categoryMap[key];
  return (mappedKey && VENUE_TEMPLATES[mappedKey]) || VENUE_TEMPLATES.GENERIC;
}

export default {
  VENUE_TEMPLATES,
  getTemplate
};
