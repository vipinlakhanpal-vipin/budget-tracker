import { Wallet, PiggyBank, TrendingUp, Receipt, Calculator, Landmark, Coins, ShieldCheck } from 'lucide-react';

// Launch splash screen -- shown for ~4 seconds every time the app starts
// (both a fresh browser load and opening the installed PWA/home screen
// icon), then fades out on its own. Purely a first-impression / brand
// moment: it doesn't gate anything, the real app underneath is already
// mounting and ready while this plays.
const MARQUEE_ICONS = [Wallet, PiggyBank, TrendingUp, Receipt, Calculator, Landmark, Coins, ShieldCheck];

export default function Splash() {
  // Rendered twice back-to-back so the CSS marquee (translateX 0 -> -50%)
  // loops seamlessly instead of visibly jumping/resetting.
  const track = [...MARQUEE_ICONS, ...MARQUEE_ICONS];

  return (
    <div className="splash-screen" aria-hidden="true">
      <div className="splash-marquee-row splash-marquee-row-1">
        <div className="splash-marquee-track">
          {track.map((Icon, i) => (
            <span className="splash-marquee-icon" key={`a-${i}`}>
              <Icon size={30} strokeWidth={1.8} />
            </span>
          ))}
        </div>
      </div>

      <div className="splash-center">
        <div className="splash-icon-wrap">
          <div className="splash-icon">
            <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splashBg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#2dd4bf" />
                  <stop offset="1" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="104" fill="url(#splashBg)" />
              <rect x="112" y="176" width="288" height="208" rx="28" fill="#ffffff" />
              <rect x="112" y="176" width="288" height="52" rx="28" fill="#e6f7f4" />
              <circle cx="336" cy="280" r="30" fill="#0d9488" />
              <circle cx="336" cy="280" r="12" fill="#ffffff" />
              <rect x="146" y="330" width="22" height="30" rx="4" fill="#99e6da" />
              <rect x="176" y="316" width="22" height="44" rx="4" fill="#5fd6c4" />
              <rect x="206" y="300" width="22" height="60" rx="4" fill="#0d9488" />
            </svg>
          </div>
        </div>
        <div className="splash-title">Hearth</div>
        <div className="splash-tagline">Track together. Spend smarter.</div>
      </div>

      <div className="splash-marquee-row splash-marquee-row-2">
        <div className="splash-marquee-track splash-marquee-track-reverse">
          {track.map((Icon, i) => (
            <span className="splash-marquee-icon" key={`b-${i}`}>
              <Icon size={26} strokeWidth={1.8} />
            </span>
          ))}
        </div>
      </div>

      <div className="splash-credit">Conceptualized and created by &ndash;Lakhanpal</div>
    </div>
  );
}
