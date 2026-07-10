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
// 1. A dotted world map sits behind everything -- built from real lat/lon
//    landmass regions (not smooth abstract blobs) so it actually reads as
//    a world map at a glance: Scandinavia's peninsula, Florida, the Horn
//    of Africa, India's taper, Patagonia's taper, etc. are all their own
//    distinct dot-filled region rather than one soft continent-shaped
//    outline, which is what made the first version look like plain blobs
//    instead of a map.
// 2. A red, blinking location dot + "City, Country" label, placed on that
//    same map using a real IP-based lookup (no permission prompt needed,
//    unlike the browser's own geolocation API) -- a nice "this is YOUR
//    Hearth" touch. Fails silently if the lookup is blocked/offline: the
//    map still looks complete either way, there's just no dot.
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
// latitude linearly to y). Every land region below (and the geolocation
// dot) is placed on this exact same grid, so a real city consistently
// lands in the right spot relative to the actual landmass around it.
function geoToMapXY(lat, lon) {
  const x = ((lon + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x: Math.min(970, Math.max(30, x)), y: Math.min(470, Math.max(30, y)) };
}

// Fills a real lat/lon rectangle with an evenly-spaced grid of dots,
// converted to the map's x/y grid via geoToMapXY. Composing a couple dozen
// of these (one per real sub-region -- Alaska, mainland Canada, Florida,
// Scandinavia, the Horn of Africa, India, etc., each its own accurately
// sized/positioned rectangle) produces a recognizable world map out of
// simple rectangles, since the actual relative sizes/positions/notches
// come from real geography rather than one smoothed-out outline per
// continent.
function fillRegion(latMin, latMax, lonMin, lonMax, stepDeg = 4) {
  const pts = [];
  for (let lat = latMin; lat <= latMax; lat += stepDeg) {
    for (let lon = lonMin; lon <= lonMax; lon += stepDeg) {
      pts.push(geoToMapXY(lat, lon));
    }
  }
  return pts;
}

// One rectangle per real sub-region of each continent -- deliberately
// broken into many small, correctly-shaped/positioned pieces (Florida
// separate from the rest of the US, Baja California separate from
// mainland Mexico, three narrowing bands down through Argentina/Patagonia,
// three narrowing bands down through the Arabian peninsula, etc.) rather
// than one bounding box per continent, since those distinguishing notches
// and tapers are what actually makes the result read as "a world map"
// instead of a handful of blobs.
const WORLD_DOTS = [
  ...fillRegion(55, 71, -168, -141), // Alaska
  ...fillRegion(42, 70, -141, -52), // Canada
  ...fillRegion(25, 49, -125, -95), // USA (west/central)
  ...fillRegion(25, 45, -95, -67), // USA (east)
  ...fillRegion(25, 31, -87, -80), // Florida
  ...fillRegion(15, 32, -117, -87), // Mexico
  ...fillRegion(22, 32, -115, -110), // Baja California
  ...fillRegion(7, 18, -92, -77), // Central America
  ...fillRegion(0, 12, -79, -60), // Colombia / Venezuela
  ...fillRegion(-20, 5, -74, -35), // Brazil
  ...fillRegion(-18, 0, -81, -69), // Peru / Bolivia
  ...fillRegion(-35, -22, -70, -58), // N. Argentina / Chile
  ...fillRegion(-45, -35, -72, -62), // Mid Argentina / Chile
  ...fillRegion(-55, -45, -74, -66), // Patagonia (tapers to a point)
  ...fillRegion(55, 71, 5, 30), // Scandinavia
  ...fillRegion(43, 55, -10, 30), // Western / Central Europe
  ...fillRegion(36, 44, -9, 3), // Iberia
  ...fillRegion(37, 46, 7, 18), // Italy
  ...fillRegion(50, 59, -10, 2), // Britain / Ireland
  ...fillRegion(15, 37, -17, 35), // North Africa
  ...fillRegion(-5, 15, -17, 25), // West / Central Africa
  ...fillRegion(0, 12, 35, 51), // Horn of Africa
  ...fillRegion(-35, 0, 12, 40), // East / Southern Africa
  ...fillRegion(-25, -12, 43, 50), // Madagascar
  ...fillRegion(24, 32, 35, 60), // Arabian Peninsula (north)
  ...fillRegion(12, 24, 42, 54), // Arabian Peninsula (tapers south)
  ...fillRegion(36, 42, 26, 45), // Turkey
  ...fillRegion(45, 75, 45, 140), // Russia / Central Asia
  ...fillRegion(22, 30, 68, 88), // India (north, wide)
  ...fillRegion(15, 22, 70, 85), // India (mid)
  ...fillRegion(6, 15, 74, 80), // India (tapers to a point)
  ...fillRegion(20, 50, 75, 135), // China / East Asia
  ...fillRegion(0, 22, 92, 110), // Southeast Asia
  ...fillRegion(30, 45, 130, 145), // Japan
  ...fillRegion(-10, 8, 95, 140), // Indonesia / Philippines
  ...fillRegion(-39, -10, 113, 154), // Australia
  ...fillRegion(-43, -40, 144, 148), // Tasmania
  ...fillRegion(-47, -34, 166, 179), // New Zealand
];

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
      {/* Dotted world map built from real lat/lon land regions (WORLD_DOTS
          above) -- each continent is many correctly-sized/positioned
          rectangles rather than one smoothed outline, so distinguishing
          features (Florida, Scandinavia, the Horn of Africa, India's and
          Patagonia's tapers, etc.) actually show up and the whole thing
          reads as a real world map rather than abstract blobs. Kept quiet
          behind the hearth scene via .worldmap-continents' low opacity. */}
      <svg className="splash-worldmap" viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <g className="worldmap-continents">
          {WORLD_DOTS.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="2.1" fill="#ffffff" />
          ))}
        </g>

        {/* Location dot -- only rendered once the IP lookup resolves. Red
            and genuinely blinking (opacity animation, see .geo-dot-core in
            CSS) rather than a static pin, so it reads as "this is where
            you are, live" -- plus a small label so it's clear what it's
            pointing at rather than an unexplained dot on a map. Kept at
            its own much higher opacity than the faint continent dots (see
            .geo-marker in CSS) so it's an unmistakable highlight. */}
        {geo && (
          <g className="geo-marker" transform={`translate(${geo.x} ${geo.y})`}>
            <circle className="geo-ping" r="5" fill="none" stroke="#ef4444" strokeWidth="1.6" />
            <circle className="geo-dot-core" r="3.4" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
            <text
              x="0"
              y={geo.y > 420 ? -11 : 16}
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
              <linearGradient id="piggyBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f9a8d4" />
                <stop offset="1" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="receiptBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="1" stopColor="#e7f6f4" />
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

            {/* Lower-right, mirroring the wallet: a piggy bank for the
                Savings side of the app, with its own small coin dropping
                into the slot on a loop -- the literal "putting money
                aside" motif, not just a generic icon. */}
            <g className="splash-float splash-float-piggy" transform="translate(314 246)">
              <ellipse cx="0" cy="4" rx="26" ry="17" fill="url(#piggyBody)" stroke="#9d174d" strokeWidth="1.5" />
              <circle cx="20" cy="-6" r="7" fill="url(#piggyBody)" stroke="#9d174d" strokeWidth="1.5" />
              <path d="M24 -10 L29 -15 L26 -6 Z" fill="url(#piggyBody)" stroke="#9d174d" strokeWidth="1.2" strokeLinejoin="round" />
              <circle cx="22" cy="-7" r="1.3" fill="#5b1235" />
              <ellipse cx="27" cy="-3" rx="3" ry="2" fill="#f472b6" stroke="#9d174d" strokeWidth="1" />
              <circle cx="26" cy="-3.5" r=".5" fill="#5b1235" />
              <circle cx="28" cy="-3.5" r=".5" fill="#5b1235" />
              <path d="M-24 6 Q-29 12 -22 15" stroke="#9d174d" strokeWidth="2" fill="none" strokeLinecap="round" />
              <rect x="-15" y="18" width="4" height="8" rx="1.5" fill="#9d174d" />
              <rect x="9" y="18" width="4" height="8" rx="1.5" fill="#9d174d" />
              <rect x="-5" y="-14" width="10" height="3" rx="1.5" fill="#7a1140" />
              <circle className="piggy-coin-drop" cx="0" cy="-24" r="4.5" fill="url(#coinFace)" stroke="#c88a06" strokeWidth="1" />
            </g>

            {/* Upper-left: a small receipt with a teal checkmark badge --
                "an expense, logged" -- the zigzag bottom edge is what reads
                as "receipt" at a glance rather than a generic card/paper. */}
            <g className="splash-float splash-float-receipt" transform="translate(82 92) rotate(-8)">
              <path d="M-16 -22 H16 V20 L11 24 L5 20 L0 24 L-5 20 L-11 24 L-16 20 Z" fill="url(#receiptBody)" stroke="#0a4f48" strokeOpacity=".5" strokeWidth="1.3" />
              <path d="M-10 -14 H10 M-10 -8 H10 M-10 -2 H4" stroke="#0d9488" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
              <circle cx="8" cy="8" r="7" fill="#0d9488" />
              <path d="M5 8 L7 10.5 L11 5.5" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
