// Launch splash screen -- shown for ~4 seconds every time the app starts
// (both a fresh browser load and opening the installed PWA/home screen
// icon), then fades out on its own. Redesigned around the app's own name:
// a literal hearth -- a warm flame glowing at the center of a roofline,
// with embers and AI "sparkle" stars drifting up together (fire sparks
// doubling as the app's AI-feature motif) against the app's signature teal.
// Purely cosmetic: it doesn't gate anything, the real app underneath is
// already mounting while it plays.
import { formatVersionBadge } from '../version.js';

export default function Splash() {
  return (
    <div className="splash-screen" aria-hidden="true">
      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />

      <div className="splash-center">
        <div className="splash-illustration splash-illustration-hearth">
          <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="glow" cx="50%" cy="58%" r="55%">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.34" />
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
            </defs>

            {/* soft ambient glow + ground shadow anchor the scene */}
            <ellipse cx="150" cy="168" rx="140" ry="118" fill="url(#glow)" />
            <ellipse cx="150" cy="262" rx="118" ry="12" fill="rgba(0,0,0,0.18)" />

            {/* a simple roofline arching over the hearth -- drawn in like a
                sketch as the splash opens, standing in for "home" without
                a literal illustrated house competing with the flame for
                attention. */}
            <path
              className="hearth-roof"
              d="M56 128 L150 48 L244 128"
              stroke="#ffffff" strokeOpacity="0.85" strokeWidth="6"
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />

            {/* the hearth itself -- a rounded stone ledge holding the fire */}
            <path d="M92 238 Q92 214 116 210 L184 210 Q208 214 208 238 Z" fill="url(#hearthBase)" />
            <rect x="86" y="234" width="128" height="16" rx="8" fill="url(#hearthBase)" />

            {/* warm glow radiating from the fire, behind the flame itself */}
            <ellipse cx="150" cy="190" rx="95" ry="90" fill="url(#fireGlow)" />

            {/* the flame -- three layered teardrops, each with its own
                gentle independent flicker so the whole thing reads as
                alive rather than a static icon */}
            <g className="hearth-flame" style={{ transformOrigin: '150px 232px' }}>
              <path className="flame-layer flame-outer" d="M150 232 C122 208 118 172 150 118 C182 172 178 208 150 232 Z" fill="url(#flameOuter)" />
              <path className="flame-layer flame-mid" d="M150 230 C130 210 128 182 150 144 C172 182 170 210 150 230 Z" fill="url(#flameMid)" />
              <path className="flame-layer flame-inner" d="M150 226 C138 212 137 194 150 168 C163 194 162 212 150 226 Z" fill="url(#flameInner)" />
            </g>

            {/* embers rising from the fire -- soft round glows */}
            <g className="ember ember-1"><circle r="4" fill="#ffb457" transform="translate(120 150)" /></g>
            <g className="ember ember-2"><circle r="3" fill="#ffd88a" transform="translate(178 140)" /></g>
            <g className="ember ember-3"><circle r="3.5" fill="#ff8a3d" transform="translate(150 110)" /></g>
            <g className="ember ember-4"><circle r="2.6" fill="#ffe27a" transform="translate(132 96)" /></g>

            {/* AI sparkle accents -- the same twinkling 4-point stars used
                for every "AI powered" tag elsewhere in the app, drifting
                up with the embers so the fire's own sparks double as the
                AI motif, rather than a separate unrelated badge. */}
            <g className="splash-sparkle splash-sparkle-1">
              <path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" fill="#eab308" transform="translate(96 92)" />
            </g>
            <g className="splash-sparkle splash-sparkle-2">
              <path d="M0 -7 L1.7 -1.7 L7 0 L1.7 1.7 L0 7 L-1.7 1.7 L-7 0 L-1.7 -1.7 Z" fill="#ffe27a" transform="translate(206 78)" />
            </g>
            <g className="splash-sparkle splash-sparkle-3">
              <path d="M0 -6 L1.5 -1.5 L6 0 L1.5 1.5 L0 6 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill="#ffffff" transform="translate(150 60)" />
            </g>
          </svg>
        </div>

        <div className="splash-title">Hearth</div>
        <div className="splash-ai-tag">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
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
