import { useMemo } from 'react'

function hashString(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const GRADIENT_PALETTES = [
  { from: '#7c3aed', to: '#22d3ee', accent: '#34d399' }, // Violet to Cyan
  { from: '#4f46e5', to: '#ec4899', accent: '#f43f5e' }, // Indigo to Pink
  { from: '#0284c7', to: '#10b981', accent: '#38bdf8' }, // Sky to Emerald
  { from: '#9333ea', to: '#f59e0b', accent: '#fbbf24' }, // Purple to Amber
  { from: '#e11d48', to: '#7c3aed', accent: '#ec4899' }, // Rose to Violet
  { from: '#0d9488', to: '#6366f1', accent: '#22d3ee' }  // Teal to Indigo
]

export function PosterArt({ title = '', category = '', height = 180, className = '' }) {
  const hash = useMemo(() => hashString(title + category), [title, category])
  const palette = GRADIENT_PALETTES[hash % GRADIENT_PALETTES.length]
  const cat = (category || '').toLowerCase().trim()

  const gradId = `post-grad-${hash}`
  const beamId = `beam-grad-${hash}`
  const glowId = `glow-${hash}`

  // Render specific motif based on category
  const renderMotif = () => {
    if (cat.includes('concert') || cat.includes('music')) {
      // Concert: Light beams radiating + equalizer frequency bars
      return (
        <g>
          {/* Light beams */}
          <polygon points="200,-10 60,230 140,230" fill="url(#beamGrad)" opacity="0.45" />
          <polygon points="200,-10 160,230 240,230" fill="url(#beamGrad)" opacity="0.6" />
          <polygon points="200,-10 260,230 340,230" fill="url(#beamGrad)" opacity="0.45" />

          {/* Equalizer frequency bars at bottom */}
          {[
            { x: 50, h: 45 }, { x: 70, h: 70 }, { x: 90, h: 35 }, { x: 110, h: 90 },
            { x: 130, h: 60 }, { x: 150, h: 110 }, { x: 170, h: 80 }, { x: 190, h: 125 },
            { x: 210, h: 125 }, { x: 230, h: 95 }, { x: 250, h: 65 }, { x: 270, h: 105 },
            { x: 290, h: 50 }, { x: 310, h: 85 }, { x: 330, h: 40 }, { x: 350, h: 60 }
          ].map((bar, i) => (
            <rect
              key={i}
              x={bar.x}
              y={220 - bar.h}
              width="12"
              height={bar.h}
              rx="4"
              fill={palette.accent}
              opacity="0.75"
            />
          ))}

          {/* Stage floor glow */}
          <ellipse cx="200" cy="220" rx="140" ry="25" fill={palette.to} opacity="0.35" />
        </g>
      )
    }

    if (cat.includes('conference') || cat.includes('tech')) {
      // Conference: Node / network lines with glowing vertices
      return (
        <g>
          {/* Grid lines */}
          <line x1="50" y1="50" x2="160" y2="100" stroke={palette.accent} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
          <line x1="160" y1="100" x2="260" y2="60" stroke={palette.accent} strokeWidth="1.5" opacity="0.6" />
          <line x1="260" y1="60" x2="350" y2="110" stroke={palette.accent} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
          <line x1="160" y1="100" x2="210" y2="170" stroke={palette.accent} strokeWidth="1.5" opacity="0.6" />
          <line x1="260" y1="60" x2="210" y2="170" stroke={palette.accent} strokeWidth="1.5" opacity="0.6" />
          <line x1="100" y1="160" x2="210" y2="170" stroke={palette.accent} strokeWidth="1.5" opacity="0.6" />
          <line x1="210" y1="170" x2="310" y2="170" stroke={palette.accent} strokeWidth="1.5" opacity="0.6" />

          {/* Connected Glowing Nodes */}
          {[
            { cx: 50, cy: 50, r: 5 }, { cx: 160, cy: 100, r: 8 },
            { cx: 260, cy: 60, r: 7 }, { cx: 350, cy: 110, r: 5 },
            { cx: 100, cy: 160, r: 6 }, { cx: 210, cy: 170, r: 9 },
            { cx: 310, cy: 170, r: 6 }
          ].map((node, i) => (
            <g key={i}>
              <circle cx={node.cx} cy={node.cy} r={node.r * 1.8} fill={palette.accent} opacity="0.25" />
              <circle cx={node.cx} cy={node.cy} r={node.r} fill="#ffffff" />
            </g>
          ))}
        </g>
      )
    }

    if (cat.includes('comedy')) {
      // Comedy: Spotlight beam + stage curtain arcs
      return (
        <g>
          {/* Spotlight angled from top left */}
          <polygon points="50,-10 130,220 270,220" fill="url(#beamGrad)" opacity="0.55" />
          <ellipse cx="200" cy="205" rx="80" ry="18" fill={palette.accent} opacity="0.4" />

          {/* Stage curtain swag arcs at top */}
          <path d="M-10,0 Q100,60 200,20 Q300,60 410,0" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.3" />
          <path d="M-10,0 Q100,85 200,35 Q300,85 410,0" fill="none" stroke={palette.to} strokeWidth="3" opacity="0.45" />

          {/* Micro sparkle accents */}
          <polygon points="200,140 203,148 211,151 203,154 200,162 197,154 189,151 197,148" fill="#ffffff" opacity="0.8" />
          <polygon points="170,120 172,125 177,127 172,129 170,134 168,129 163,127 168,125" fill={palette.accent} opacity="0.9" />
          <polygon points="230,130 232,135 237,137 232,139 230,144 228,139 223,137 228,135" fill={palette.accent} opacity="0.9" />
        </g>
      )
    }

    if (cat.includes('theatre') || cat.includes('theater')) {
      // Theatre: Velvety curtain folds & draped vertical curves
      return (
        <g>
          {/* Symmetrical curtain pleats and folds */}
          {[-20, 30, 80, 130, 220, 270, 320, 370].map((x, i) => (
            <path
              key={i}
              d={`M${x},0 Q${x + 25},110 ${x},220 L${x + 50},220 Q${x + 25},110 ${x + 50},0 Z`}
              fill="rgba(0,0,0,0.22)"
              stroke="rgba(255,255,255,0.08)"
            />
          ))}

          {/* Top draped valance */}
          <path d="M-10,0 C80,45 120,45 200,0 C280,45 320,45 410,0" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
          <ellipse cx="200" cy="210" rx="100" ry="20" fill={palette.accent} opacity="0.3" />
        </g>
      )
    }

    if (cat.includes('sport')) {
      // Sports: Track/arena concentric rings & speed arches
      return (
        <g>
          <ellipse cx="200" cy="110" rx="170" ry="75" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <ellipse cx="200" cy="110" rx="135" ry="58" fill="none" stroke={palette.accent} strokeWidth="3" opacity="0.75" />
          <ellipse cx="200" cy="110" rx="100" ry="42" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
          <ellipse cx="200" cy="110" rx="65" ry="26" fill="rgba(255,255,255,0.15)" stroke="#ffffff" strokeWidth="2" />

          {/* Speed vector lines */}
          <line x1="30" y1="110" x2="370" y2="110" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="6 4" />
          <line x1="200" y1="35" x2="200" y2="185" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="6 4" />
        </g>
      )
    }

    if (cat.includes('festival') || cat.includes('fest')) {
      // Festival: Bursting rays and festive glowing dots
      return (
        <g>
          {/* Bursting rays from center */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
            <line
              key={i}
              x1="200"
              y1="110"
              x2={200 + Math.cos((deg * Math.PI) / 180) * 190}
              y2={110 + Math.sin((deg * Math.PI) / 180) * 110}
              stroke={palette.accent}
              strokeWidth={i % 2 === 0 ? '2.5' : '1.5'}
              strokeDasharray={i % 3 === 0 ? '4 4' : 'none'}
              opacity="0.5"
            />
          ))}

          {/* Festive floating particles */}
          {[
            { cx: 120, cy: 60, r: 4 }, { cx: 280, cy: 50, r: 6 },
            { cx: 90, cy: 150, r: 5 }, { cx: 310, cy: 160, r: 5 },
            { cx: 160, cy: 180, r: 4 }, { cx: 240, cy: 40, r: 3 },
            { cx: 190, cy: 75, r: 7 }
          ].map((pt, i) => (
            <circle
              key={i}
              cx={pt.cx}
              cy={pt.cy}
              r={pt.r}
              fill={i % 2 === 0 ? '#ffffff' : palette.accent}
              opacity="0.85"
            />
          ))}

          <circle cx="200" cy="110" r="16" fill="#ffffff" />
          <circle cx="200" cy="110" r="28" fill="none" stroke={palette.accent} strokeWidth="3" opacity="0.8" />
        </g>
      )
    }

    // Default: Layered futuristic geometric waves
    return (
      <g>
        <path d="M-20,160 Q100,70 200,150 T420,140 L420,220 L-20,220 Z" fill="rgba(0,0,0,0.3)" />
        <path d="M-20,180 Q120,120 220,180 T420,160 L420,220 L-20,220 Z" fill="rgba(255,255,255,0.08)" />
        <ellipse cx="200" cy="110" rx="90" ry="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
        <polygon points="200,70 230,110 200,150 170,110" fill="none" stroke={palette.accent} strokeWidth="2.5" opacity="0.8" />
      </g>
    )
  }

  return (
    <div
      className={`poster-art-wrapper ${className}`.trim()}
      style={{
        position: 'relative',
        width: '100%',
        height: height || '100%',
        overflow: 'hidden',
        borderTopLeftRadius: 'inherit',
        borderTopRightRadius: 'inherit',
        background: '#090912'
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          {/* Base Deterministic Gradient */}
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={palette.from} stopOpacity="0.85" />
            <stop offset="60%" stopColor="#0b0b14" stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.to} stopOpacity="0.75" />
          </linearGradient>

          {/* Light Beam Gradient */}
          <linearGradient id={beamId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor={palette.accent} stopOpacity="0.05" />
          </linearGradient>

          {/* Glow Radial */}
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.from} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base Gradient Canvas */}
        <rect width="400" height="220" fill={`url(#${gradId})`} />

        {/* Ambient Center Glow */}
        <circle cx="200" cy="110" r="130" fill={`url(#${glowId})`} />

        {/* Category Specific Motif */}
        {renderMotif()}

        {/* Cinematic Vignette Overlay */}
        <rect
          width="400"
          height="220"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      </svg>
    </div>
  )
}
