// Launch splash screen -- shown for 6 seconds every time the app starts
// (both a fresh browser load and opening the installed PWA/home screen
// icon), then fades out on its own. Built around the app's own name: a
// literal hearth -- a warm flame glowing at the center of a roofline --
// with a small cast of budgeting-related characters (a coin, a rising
// trend line, a wallet) gently floating/orbiting around it, plus embers
// and AI "sparkle" stars drifting up so the whole scene feels alive
// rather than a static logo. Purely cosmetic: it doesn't gate anything,
// the real app underneath is already mounting while it plays.
//
// Three things layered on top of the original hearth scene:
// 1. A stylized dotted world map sits behind everything -- an abstract,
//    on-theme backdrop (not a literal geographic import) built from six
//    soft continent blobs on a standard equirectangular grid, textured
//    with a dot pattern instead of a flat fill so it reads as "map" at a
//    glance without competing with the flame for attention.
// 2. A pulsing location dot + "City, Country" label, placed on that same
//    map using a real IP-based lookup (no permission prompt needed, unlike
//    the browser's own geolocation API) -- a nice "this is YOUR Hearth"
//    touch. Fails silently if the lookup is blocked/offline: the map still
//    looks complete either way, there's just no dot.
// 3. A slow ring of six feature chips (Income, Fixed Expenses, Add an
//    expense, Savings, Chat BoT, Reports) orbiting the hearth -- a quick
//    visual tour of what the app actually does while the brand moment
//    plays, instead of a logo that says nothing about the product.
import { useEffect, useState } from 'react';
import { formatVersionBadge } from '../version.js';

// Free, no-API-key IP geolocation lookup with CORS enabled for browser
// fetches -- confirmed working live before wiring this in. Deliberately
// not the browser's own navigator.geolocation: that pops a permission
// prompt on every single app launch, which would be intrusive for a purely
// decorative splash detail.
const GEO_LOOKUP_URL = 'https://ipapi.co/json/';

// Converts a real lat/lon into an x/y point on the map's own 1000x500
// equirectangular grid (standard projection: longitude maps linearly to x,
// latitude linearly to y). The six continent blobs below were placed on
// this exact same grid, so a real city consistently lands in roughly the
// right spot relative to them.
function geoToMapXY(lat, lon) {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x: Math.min(970, Math.max(30, x)), y: Math.min(470, Math.max(30, y)) };
}

const FEATURE_CHIPS = [
  { label: 'Income', angle: 0 },
  { label: 'Fixed Expenses', angle: 60 },
  { label: 'Add an expense', angle: 120 },
  { label: 'Savings', angle: 180 },
  { label: 'Chat BoT', angle: 240 },
  { label: 'Reports', angle: 300 },
];

// One small hand-drawn glyph per feature chip, kept in the same simple
// line-art style as the coin/chart/wallet cast already floating around the
// flame, rather than pulling in an icon library just for six tiny shapes.
function FeatureIcon({ label }) {
  switch (label) {
    case 'Income':
      return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <path d="M4 16 L8 10 L12 13 L17 5" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 5 H17 V10" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'Fixed Expenses':
      return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="6" width="14" height="10" rx="2" stroke="#0d9488" strokeWidth="2" />
          <path d="M3 9 H17" stroke="#0d9488" strokeWidth="2" />
        </svg>
      );
    case 'Add an expense':
      return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="#0d9488" strokeWidth="2" />
          <path d="M10 6 V14 M6 10 H14" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'Savings':
      return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <path d="M4 11 Q4 6 10 6 Q16 6 16 11 Q16 15 10 15 Q6 15 4 12.5 Z" stroke="#0d9488" strokeWidth="2" />
          <circle cx="12.5" cy="10" r="1" fill="#0d9488" />
          <path d="M4 12 L2 13.5" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'Chat BoT':
      return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <path d="M3 5 H17 V13 H9 L5 16 V13 H3 Z" stroke="#0d9488" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <path d="M4 16 V11 M9 16 V7 M14 16 V4" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

export default function Splash() {
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(GEO_LOOKUP_URL)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d || d.error || typeof d.latitude !== 'number' || typeof d.longitude !== 'number') return;
        const { x, y } = geoToMapXY(d.latitude, d.longitude);
        const place = [d.city, d.country_name].filter(Boolean).join(', ');
        if (place) setGeo({ place, x, y });
      })
      .catch(() => {
        // Silent -- the map still looks complete with no dot, and this is
        // a purely decorative detail, never worth surfacing an error for.
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="splash-screen" aria-hidden="true">
      {/* Stylized dotted world map -- six soft continent blobs on a shared
          equirectangular grid (see geoToMapXY above), textured with a
          repeating dot pattern instead of a flat fill so it reads as "map"
          rather than random blobs, and toned to sit quietly behind the
          hearth scene instead of competing with it. */}
      <svg className="splash-worldmap" viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="mapDots" width="13" height="13" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="#ffffff" fillOpacity=".5" />
          </pattern>
        </defs>
        {/* North America */}
        <path d="M60 70 Q160 40 260 65 Q320 90 300 140 Q280 190 220 205 Q160 215 110 180 Q55 140 60 70 Z" fill="url(#mapDots)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="1.5" />
        {/* South America */}
        <path d="M270 235 Q330 220 350 270 Q365 330 335 385 Q310 425 285 400 Q265 350 270 290 Z" fill="url(#mapDots)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="1.5" />
        {/* Europe */}
        <path d="M470 65 Q540 50 600 70 Q615 100 590 130 Q540 150 495 135 Q465 105 470 65 Z" fill="url(#mapDots)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="1.5" />
        {/* Africa */}
        <path d="M470 150 Q560 140 610 175 Q625 230 605 290 Q580 350 530 345 Q480 320 465 250 Q455 195 470 150 Z" fill="url(#mapDots)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="1.5" />
        {/* Asia */}
        <path d="M615 55 Q740 40 890 75 Q930 110 900 160 Q850 210 760 200 Q680 190 630 150 Q600 100 615 55 Z" fill="url(#mapDots)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="1.5" />
        {/* Australia */}
        <path d="M815 300 Q890 285 925 315 Q935 350 900 370 Q850 380 820 355 Q805 325 815 300 Z" fill="url(#mapDots)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="1.5" />

        {/* Location dot -- only rendered once the IP lookup resolves. A
            calm two-layer pulse (expanding ring + steady core) instead of
            a static pin, so it reads as "live" rather than decorative
            clutter, plus a small label so it's clear what it's pointing
            at rather than an unexplained dot on a map. */}
        {geo && (
          <g className="geo-marker" transform={`translate(${geo.x} ${geo.y})`}>
            <circle className="geo-ping" r="6" fill="none" stroke="#ffe27a" strokeWidth="2" />
            <circle r="4" fill="#ffe27a" stroke="#8a5a04" strokeWidth="1" />
            <text
              x="0"
              y={geo.y > 420 ? -14 : 20}
              textAnchor="middle"
              className="geo-label"
            >
              {geo.place}
            </text>
          </g>
        )}
      </svg>

      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />
      {/* Tiny twinkling points scattered across the whole background --
          the thing that turns a plain gradient into a "night sky" feel
          instead of an empty flat color. */}
      <div className="splash-dust splash-dust-1" />
      <div className="splash-dust splash-dust-2" />
      <div className="splash-dust splash-dust-3" />
      <div className="splash-dust splash-dust-4" />
      <div className="splash-dust splash-dust-5" />

      <div className="splash-center">
        <div className="splash-illustration-wrap">
          {/* Slow ring of feature chips orbiting the hearth -- each chip's
              own placement transform (rotate+translate+rotate-back) sets
              its fixed point on the circle; the ring itself spins
              continuously while each chip's inner content counter-spins at
              the exact same rate so the label text stays upright and
              readable the whole time instead of wheeling around with it. */}
          <div className="feature-orbit">
            {FEATURE_CHIPS.map((f) => (
              <div
                key={f.label}
                className="feature-chip"
                style={{ transform: `rotate(${f.angle}deg) translate(178px) rotate(${-f.angle}deg)` }}
              >
                <div className="feature-chip-inner">
                  <FeatureIcon label={f.label} />
                  <span>{f.label}</span>
                </div>
              </div>
            ))}
          </div>
        <div className="splash-illustration splash-illustration-hearth">
          <svg viewBox="0 0 380 300" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="glow" cx="50%" cy="58%" r="42%">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="fireGlow" cx="50%" cy="60%" r="50%">
                <stop offset="0" stopColor="#ffd88a" stopOpacity="0.85" />
                <stop offset="1" stopColor="#ffd88a" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="flameOuter" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#e6432c" />
                <stop offset="1" stopColor="#ff8a3d" />
              </linearGradient>
              <linearGradient id="flameMid" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#ff8a3d" />
                <stop offset="1" stopColor="#ffcf5c" />
              </linearGradient>
              <linearGradient id="flameInner" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#ffe27a" />
                <stop offset="1" stopColor="#fffbe6" />
              </linearGradient>
              <linearGradient id="hearthBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#3a5a56" />
                <stop offset="1" stopColor="#1c3634" />
              </linearGradient>
              <linearGradient id="coinFace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffe27a" />
                <stop offset="1" stopColor="#eab308" />
              </linearGradient>
              <linearGradient id="walletBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1bcbb4" />
                <stop offset="1" stopColor="#0d9488" />
              </linearGradient>
            </defs>

            {/* soft ambient glow + ground shadow anchor the scene */}
            <ellipse cx="190" cy="168" rx="150" ry="118" fill="url(#glow)" />
            <ellipse cx="190" cy="262" rx="118" ry="12" fill="rgba(0,0,0,0.18)" />

            {/* a simple roofline arching over the hearth -- drawn in like a
                sketch as the splash opens, standing in for "home" without
                a literal illustrated house competing with the flame for
                attention. */}
            <path
              className="hearth-roof"
              d="M96 128 L190 48 L284 128"
              stroke="#ffffff" strokeOpacity="0.85" strokeWidth="6"
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />

            {/* the hearth itself -- a rounded stone ledge holding the fire */}
            <path d="M132 238 Q132 214 156 210 L224 210 Q248 214 248 238 Z" fill="url(#hearthBase)" />
            <rect x="126" y="234" width="128" height="16" rx="8" fill="url(#hearthBase)" />

            {/* warm glow radiating from the fire, behind the flame itself */}
            <ellipse cx="190" cy="190" rx="95" ry="90" fill="url(#fireGlow)" />

            {/* the flame -- three layered teardrops, each with its own
                gentle independent flicker so the whole thing reads as
                alive rather than a static icon */}
            <g className="hearth-flame" style={{ transformOrigin: '190px 232px' }}>
              <path className="flame-layer flame-outer" d="M190 232 C162 208 158 172 190 118 C222 172 218 208 190 232 Z" fill="url(#flameOuter)" />
              <path className="flame-layer flame-mid" d="M190 230 C170 210 168 182 190 144 C212 182 210 210 190 230 Z" fill="url(#flameMid)" />
              <path className="flame-layer flame-inner" d="M190 226 C178 212 177 194 190 168 C203 194 202 212 190 226 Z" fill="url(#flameInner)" />
            </g>

            {/* embers rising from the fire -- soft round glows */}
            <g className="ember ember-1"><circle r="4" fill="#ffb457" transform="translate(160 150)" /></g>
            <g className="ember ember-2"><circle r="3" fill="#ffd88a" transform="translate(218 140)" /></g>
            <g className="ember ember-3"><circle r="3.5" fill="#ff8a3d" transform="translate(190 110)" /></g>
            <g className="ember ember-4"><circle r="2.6" fill="#ffe27a" transform="translate(172 96)" /></g>

            {/* AI sparkle accents -- the same twinkling 4-point stars used
                for every "AI powered" tag elsewhere in the app, drifting
                up with the embers so the fire's own sparks double as the
                AI motif, rather than a separate unrelated badge. */}
            <g className="splash-sparkle splash-sparkle-1">
              <path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill="#eab308" transform="translate(136 92)" />
            </g>
            <g className="splash-sparkle splash-sparkle-2">
              <path d="M0 -7 L1.7 -1.7 L7 0 L1.7 1.7 L0 7 L-1.7 1.7 L-7 0 L-1.7 -1.7 Z" fill="#ffe27a" transform="translate(246 78)" />
            </g>
            <g className="splash-sparkle splash-sparkle-3">
              <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#ffffff" transform="translate(190 60)" />
            </g>

            {/* Left of the hearth: a spinning Dirham coin -- the app's own
                real currency glyph (the same "D + two lines" mark used
                throughout the app) minted onto a coin, rather than a
                generic/mismatched "$", so the motif is actually Hearth's
                own money, not a stock icon. A slow scaleX "flip" plus a
                diagonal shine sweep gives it a genuine coin-spin feel
                instead of just sitting there. */}
            <g className="splash-float splash-float-coin">
              <g className="coin-spin" transform="translate(50 168)">
                <circle r="23" fill="url(#coinFace)" stroke="#c88a06" strokeWidth="2" />
                <circle r="17" fill="none" stroke="#c88a06" strokeOpacity=".55" strokeWidth="1.4" />
                <text x="-2" y="7" fontSize="19" fontWeight="800" fontFamily="Arial, sans-serif" fill="#8a5a04" textAnchor="middle">D</text>
                <line x1="-10" y1="-2.6" x2="7" y2="-2.6" stroke="#8a5a04" strokeWidth="2" />
                <line x1="-10" y1="2.6" x2="7" y2="2.6" stroke="#8a5a04" strokeWidth="2" />
                <path className="coin-shine" d="M-23 -6 A23 23 0 0 1 -2 -22" stroke="#fff8e1" strokeOpacity=".8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              </g>
            </g>

            {/* Right of the hearth: a small rising trend line with bars --
                the "your spending is on track" motif, orbiting slowly. */}
            <g className="splash-float splash-float-chart" transform="translate(316 176)">
              <rect x="-20" y="4" width="9" height="20" rx="2" fill="rgba(255,255,255,.85)" />
              <rect x="-6" y="-6" width="9" height="30" rx="2" fill="rgba(255,255,255,.85)" />
              <rect x="8" y="-16" width="9" height="40" rx="2" fill="#ffe27a" />
              <path d="M-22 6 L-2 -10 L12 -2 L24 -24" stroke="#eab308" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 -24 L24 -24 L24 -16" stroke="#eab308" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Lower-left: a simple wallet, anchoring the "budgeting"
                theme a third way without crowding the flame itself. */}
            <g className="splash-float splash-float-wallet" transform="translate(66 246)">
              <rect x="-24" y="-15" width="48" height="32" rx="7" fill="url(#walletBody)" stroke="#0a4f48" strokeWidth="1.5" />
              <path d="M-24 -3 H24" stroke="#0a4f48" strokeOpacity=".4" strokeWidth="1.5" />
              <circle cx="14" cy="-3" r="4" fill="#ffe27a" />
            </g>
          </svg>
        </div>
        </div>

        <div className="splash-title">Hearth</div>
        <div className="splash-ai-tag">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path d="M10 1 L12.2 7.8 L19 10 L12.2 12.2 L10 19 L7.8 12.2 L1 10 L7.8 7.8 Z" fill="#eab308" />
          </svg>
          AI-powered budgeting
        </div>
        <div className="splash-tagline">The heart of your home&rsquo;s finances.</div>
        <div className="splash-version">{formatVersionBadge()}</div>
      </div>

      <div className="splash-credit">Conceptualized and created by &ndash;Lakhanpal</div>
    </div>
  );
}
