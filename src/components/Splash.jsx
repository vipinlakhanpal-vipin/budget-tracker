// Launch splash screen -- shown for ~4 seconds every time the app starts
// (both a fresh browser load and opening the installed PWA/home screen
// icon), then fades out on its own. A bigger, bolder illustrated scene --
// a person celebrating a savings win next to a rising budget/spending bar
// chart, with a big held-up coin and confetti -- rather than a piggy bank
// or scrolling icon rows. Purely cosmetic: it doesn't gate anything, the
// real app underneath is already mounting while it plays.
import { formatVersionBadge } from '../version.js';

export default function Splash() {
  return (
    <div className="splash-screen" aria-hidden="true">
      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />

      <div className="splash-center">
        <div className="splash-illustration">
          <svg viewBox="0 0 360 320" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffd9b3" />
                <stop offset="1" stopColor="#f3b785" />
              </linearGradient>
              <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5eead4" />
                <stop offset="1" stopColor="#0d9488" />
              </linearGradient>
              <linearGradient id="pants" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#134e4a" />
                <stop offset="1" stopColor="#0a2f2c" />
              </linearGradient>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffe27a" />
                <stop offset="1" stopColor="#f6b93b" />
              </linearGradient>
              <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fff3c4" />
                <stop offset="1" stopColor="#f6b93b" />
              </linearGradient>
              <radialGradient id="glow" cx="46%" cy="55%" r="60%">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* soft glow + ground shadow anchor the scene */}
            <ellipse cx="200" cy="190" rx="185" ry="130" fill="url(#glow)" />
            <ellipse cx="228" cy="300" rx="150" ry="13" fill="rgba(0,0,0,0.16)" />

            {/* rising budget/spend-trend bar chart -- each bar grows up from
                the baseline, staggered, like a "you're on track" moment */}
            <g className="chart-bars">
              <rect className="bar bar-1" x="40" y="230" width="30" height="70" rx="7" fill="url(#barGrad)" />
              <rect className="bar bar-2" x="78" y="190" width="30" height="110" rx="7" fill="url(#barGrad)" />
              <rect className="bar bar-3" x="116" y="150" width="30" height="150" rx="7" fill="url(#barGrad)" />
            </g>
            <g className="trend-arrow">
              <path d="M55 222 L93 182 L131 142" stroke="#ffffff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M116 142 L131 142 L131 157" stroke="#ffffff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* the person -- simple flat-illustration figure celebrating,
                one arm raised holding up a big coin */}
            <g className="splash-person">
              {/* legs */}
              <rect x="206" y="255" width="20" height="47" rx="9" fill="url(#pants)" />
              <rect x="238" y="255" width="20" height="47" rx="9" fill="url(#pants)" />
              {/* torso / shirt */}
              <path d="M200 190 Q200 170 230 170 Q260 170 262 191 L268 254 Q231 268 194 254 Z" fill="url(#shirt)" />
              {/* relaxed arm */}
              <path d="M206 196 Q186 208 188 238" stroke="url(#skin)" strokeWidth="14" fill="none" strokeLinecap="round" />
              <circle cx="188" cy="240" r="9" fill="url(#skin)" />
              {/* raised arm holding coin */}
              <g className="arm-raise">
                <path d="M254 194 Q276 176 282 146" stroke="url(#skin)" strokeWidth="14" fill="none" strokeLinecap="round" />
                <circle cx="282" cy="144" r="9" fill="url(#skin)" />
              </g>
              {/* head */}
              <circle cx="230" cy="155" r="28" fill="url(#skin)" />
              {/* hair */}
              <path d="M202 148 Q204 116 231 114 Q259 114 261 143 Q253 130 240 132 Q244 122 237 116 Q224 118 216 128 Q206 132 202 148 Z" fill="#3b2b26" />
              {/* face */}
              <circle cx="220" cy="154" r="3" fill="#20232a" />
              <circle cx="240" cy="154" r="3" fill="#20232a" />
              <path d="M217 166 Q230 176 243 166" stroke="#20232a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <ellipse cx="212" cy="163" rx="5.5" ry="3.4" fill="#ff9b9b" opacity="0.55" />
              <ellipse cx="248" cy="163" rx="5.5" ry="3.4" fill="#ff9b9b" opacity="0.55" />
            </g>

            {/* big triumphant coin held overhead */}
            <g className="big-coin">
              <circle cx="286" cy="112" r="27" fill="url(#coinGrad)" stroke="#c9861a" strokeWidth="3.5" />
              <text x="286" y="121" textAnchor="middle" fontSize="24" fontWeight="800" fill="#8a5b0f">$</text>
            </g>

            {/* confetti */}
            <g className="confetti confetti-1"><rect width="9" height="14" rx="2.5" fill="#ffe27a" transform="translate(70 44) rotate(15)" /></g>
            <g className="confetti confetti-2"><rect width="8" height="13" rx="2.5" fill="#ffffff" transform="translate(305 58) rotate(-20)" /></g>
            <g className="confetti confetti-3"><circle r="5.5" fill="#5eead4" transform="translate(178 34)" /></g>
            <g className="confetti confetti-4"><rect width="8" height="13" rx="2.5" fill="#f6b93b" transform="translate(330 190) rotate(30)" /></g>
            <g className="confetti confetti-5"><circle r="5" fill="#ffffff" transform="translate(32 210)" /></g>
            <g className="confetti confetti-6"><rect width="8" height="12" rx="2.5" fill="#99f6e4" transform="translate(150 250) rotate(-10)" /></g>
          </svg>
        </div>

        <div className="splash-title">Hearth</div>
        <div className="splash-tagline">Track together. Spend smarter.</div>
        <div className="splash-version">{formatVersionBadge()}</div>
      </div>

      <div className="splash-credit">Conceptualized and created by &ndash;Lakhanpal</div>
    </div>
  );
}
