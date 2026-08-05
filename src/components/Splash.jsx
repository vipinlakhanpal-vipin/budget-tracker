// Launch splash screen -- shown for 6 seconds every time the app starts
// (both a fresh browser load and opening the installed PWA/home screen
// icon), then fades out on its own. Purely cosmetic: it doesn't gate
// anything, the real app underneath is already mounting while it plays.
//
// Plain dark navy gradient backdrop behind a personal greeting, the
// circular "Hearth" platform badge (see PLATFORM_* below), and the
// bottom brand tagline + credit line -- no map, pins, or floating
// decorations.
//
import { useEffect, useState } from 'react';
import { formatVersionBadge } from '../version.js';
import { supabase } from '../supabaseClient';

// Circular "platform" diagram for the intro/splash screen -- replaces the
// earlier hearth/family illustration with a Coupa-style "total platform"
// ring: a navy outer ring carrying the app's own name as a curved title,
// a light-blue band of icons for every one of the app's real header tabs
// (same order as the header itself, Home -> Help), and a glowing blue
// center sphere calling out "AI POWERED". Every label/order below is real
// -- not filler -- so this reads as an honest map of what's actually in
// the app, not a generic marketing graphic.
const PLATFORM_CENTER = { x: 220, y: 236 };
// Kept well inside PLATFORM_RING_INNER (182) even for the two long labels
// ("Fixed Expenses", "Regular Expenses") -- their fill color is the same
// dark navy as the ring stroke, so any part of a label that strayed past
// the ring's inner edge would silently vanish against it (this is what
// caused the earlier "S" of Smart Budget / trailing "s" of Expenses to
// look cut off).
const PLATFORM_ICON_RADIUS = 112;
// Ring pushed outward (182/210 -> 200/218) per explicit follow-up request --
// the label spokes (PLATFORM_ICON_RADIUS, unchanged at 112) still had a
// noticeable stretch of genuinely empty white space between them and the
// ring's old inner edge (182), so rather than moving the labels themselves
// (which would crowd the center sphere), this reclaims that existing slack
// by growing the white disc itself, buying the labels ~18 more units of
// clearance from the ring with zero change to their own position or the
// two-line wrapping already tuned for them. Ring band is slightly thinner
// (18 vs 28) to fit the larger inner radius in the same outer footprint.
const PLATFORM_RING_OUTER = 218;
const PLATFORM_RING_INNER = 200;
const PLATFORM_SPHERE_RADIUS = 82;

function polarPoint(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx, cy, r, startDeg, endDeg) {
  const p1 = polarPoint(cx, cy, r, startDeg);
  const p2 = polarPoint(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;
}
// Curved path the tagline rides above the TOP of the ring -- originally
// this sat at radius 196, embedded inside the ring's own 182-210
// thickness band, but per explicit request to lift it "outside" the dark
// ring rather than sit on top of it, the radius is now 230: clear past
// the ring's current outer edge (218, see PLATFORM_RING_OUTER above) with
// a visible gap, rather than overlapping the ring stroke. The SVG's own
// viewBox (see the <svg> element below) is extended upward to give this
// extra room -- without that, text this far out would clip against the
// top of the canvas.
const PLATFORM_TITLE_ARC = arcPath(PLATFORM_CENTER.x, PLATFORM_CENTER.y, 230, 200, 340);

// Dashboard (formerly "Home") deliberately isn't one of these spokes --
// it's not a distinct feature so much as the summary/overview the whole
// diagram itself already stands in for, so listing it as an 8th "function"
// alongside Income/Savings/etc. was redundant. The remaining 7 real tabs
// are spaced evenly around the full circle (360/7 apart), starting at the
// bottom (90deg) so the layout stays visually balanced without needing an
// even count.
const PLATFORM_TABS = [
  { label: 'Income', icon: 'income', angle: 90 },
  { label: 'Fixed Expenses', icon: 'fixed', angle: 90 + 360 / 7 },
  { label: 'Regular Expenses', icon: 'regular', angle: 90 + (360 / 7) * 2 },
  { label: 'Savings', icon: 'savings', angle: 90 + (360 / 7) * 3 },
  { label: 'Report', icon: 'report', angle: 90 + (360 / 7) * 4 },
  { label: 'Smart Budget', icon: 'settings', angle: 90 + (360 / 7) * 5 },
  { label: 'Help', icon: 'help', angle: 90 + (360 / 7) * 6 },
];

// Faint "network" decoration inside the center sphere -- an outer ring of
// nodes plus a hub wired to a few of them, echoing the connected-data globe
// look of the reference image without needing an actual force-graph lib.
const PLATFORM_NETWORK_DOTS = [
  { x: -46, y: -38, r: 3 }, { x: -10, y: -58, r: 2.4 }, { x: 30, y: -50, r: 3.4 },
  { x: 54, y: -14, r: 2.6 }, { x: 50, y: 26, r: 3 }, { x: 14, y: 52, r: 2.4 },
  { x: -28, y: 46, r: 3.2 }, { x: -56, y: 10, r: 2.6 }, { x: -6, y: 4, r: 2 },
];
const PLATFORM_NETWORK_LINES = [
  [-46, -38, -10, -58], [-10, -58, 30, -50], [30, -50, 54, -14], [54, -14, 50, 26],
  [50, 26, 14, 52], [14, 52, -28, 46], [-28, 46, -56, 10], [-56, 10, -46, -38],
  [-6, 4, -46, -38], [-6, 4, 30, -50], [-6, 4, 50, 26], [-6, 4, -28, 46],
];

// Small hand-drawn line-icon per tab, each in its own local 24x24 box --
// stroke/fill applied by the wrapping <g> in the icon spoke below, kept
// deliberately simple (thin outline shapes) to match the reference
// diagram's icon style rather than a detailed illustration.
function PlatformIcon({ type }) {
  switch (type) {
    case 'home':
      return (
        <g>
          <path d="M2 12 L12 3 L22 12" />
          <path d="M5 10 V21 H19 V10" />
          <rect x="10.5" y="14" width="3" height="7" />
        </g>
      );
    case 'income':
      return (
        <g>
          <rect x="2" y="6" width="20" height="14" rx="2.4" />
          <path d="M2 10 H22" />
          <circle cx="17" cy="14" r="1.6" fill="#1b2a5e" stroke="none" />
        </g>
      );
    case 'fixed':
      return (
        <g>
          <rect x="3" y="5" width="18" height="16" rx="2.2" />
          <path d="M3 10 H21" />
          <path d="M8 2 V6 M16 2 V6" />
          <path d="M9 15 L11.5 17.5 L16 12.5" />
        </g>
      );
    case 'regular':
      return (
        <g>
          <path d="M2 3 H5 L7.4 15.2 A2 2 0 0 0 9.4 17 H18 A2 2 0 0 0 20 15.4 L22 7 H6" />
          <circle cx="9.5" cy="20.5" r="1.4" fill="#1b2a5e" stroke="none" />
          <circle cx="17.5" cy="20.5" r="1.4" fill="#1b2a5e" stroke="none" />
        </g>
      );
    case 'savings':
      return (
        <g>
          <ellipse cx="11" cy="13" rx="9" ry="6.4" />
          <path d="M20 12 L23 9.5 L22 13.5 Z" />
          <circle cx="18" cy="10.6" r="0.9" fill="#1b2a5e" stroke="none" />
          <path d="M4 18.5 V21 M9 19.5 V22" />
          <path d="M2 12 A2 2 0 0 1 2 8" />
        </g>
      );
    case 'report':
      return (
        <g>
          <path d="M2 21 H22" />
          <rect x="4" y="13" width="4" height="8" />
          <rect x="10" y="8" width="4" height="13" />
          <rect x="16" y="4" width="4" height="17" />
        </g>
      );
    case 'settings':
      return (
        <g>
          <path d="M3 15 A9 9 0 0 1 21 15" />
          <path d="M12 15 L17 8" />
          <circle cx="12" cy="15" r="1.6" fill="#1b2a5e" stroke="none" />
        </g>
      );
    case 'help':
      return (
        <g>
          <circle cx="12" cy="12" r="10" />
          <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1b2a5e" stroke="none" fontFamily="Nunito, sans-serif">?</text>
        </g>
      );
    default:
      return null;
  }
}

// Time-of-day greeting -- purely based on the visitor's own device clock
// (new Date().getHours()), so it's automatically correct for whatever
// timezone the browser itself is set to, no IP lookup or timezone library
// needed. Boundaries are the common-sense ones: morning starts at 5am,
// afternoon at noon, evening at 5pm, night from 9pm through the small
// hours.
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 21) return 'Good Evening';
  return 'Good Night';
}

export default function Splash({ session }) {
  // First name only ("Vipin" out of "Vipin Lakhanpal"). Two sources,
  // tried in order:
  // 1. household_members.name -- the actual display name shown
  //    everywhere else in the app (Dashboard's "My details"/profile
  //    dropdown, the "By" column, etc.), editable after signup and so
  //    the authoritative one whenever it's set.
  // 2. session.user.user_metadata.full_name -- the name captured once at
  //    signup (see Login.jsx), used as a fallback for the brief window
  //    before a first-time signup has a household_members row at all.
  // Session can still be null here (splash shows immediately on load,
  // sometimes before Supabase's getSession() resolves) -- in that case
  // the greeting just quietly drops the name instead of showing a
  // placeholder or blocking on auth.
  const [memberName, setMemberName] = useState(null);
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    supabase
      .from('household_members')
      .select('name')
      .eq('user_id', session.user.id)
      .not('name', 'is', null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setMemberName(data.name);
      });
    return () => { cancelled = true; };
  }, [session?.user?.id]);
  const firstName = (memberName || session?.user?.user_metadata?.full_name)?.trim().split(/\s+/)[0] || null;

  return (
    <div className="splash-screen" aria-hidden="true">
      {/* Personal greeting -- the true top-of-screen element now (the
          brand tagline below this one moved down to the bottom a while
          back, see .splash-top-tagline's own comment). Name comes from
          the signed-in user's profile (falls back to no name if session
          hasn't resolved yet); the "Good X" half is always shown, driven
          purely by the visitor's own device clock via getGreeting(). */}
      <div className="splash-greeting">
        {firstName ? `Hello ${firstName}, ` : ''}{getGreeting()}
      </div>

      {/* Standalone brand line near the top -- deliberately just below the
          very top edge, on the plain solid-teal strip above where the world
          map/orbs get busy, per explicit request ("slightly down on plain
          teal solid background"), rather than competing with the main
          logo/text block anchored at the bottom. */}
      <div className="splash-top-tagline">
        {/* Same 4-point AI sparkle glyph used everywhere else in the app
            (see .splash-ai-tag / Dashboard's AI-powered tags), sized in em
            units so it always matches this line's own font-size exactly --
            including its clamp()-driven shrink on narrow phone screens --
            instead of a fixed px size that would look mismatched once the
            text itself scales. */}
        <svg className="splash-top-tagline-icon" viewBox="0 0 20 20" fill="none">
          <path d="M10 1 L12.2 7.8 L19 10 L12.2 12.2 L10 19 L7.8 12.2 L1 10 L7.8 7.8 Z" fill="#eab308" />
        </svg>
        Hearth &mdash; Spend smart. Save better. Live happier.
      </div>

      <div className="splash-center">
        <div className="splash-illustration-wrap">
        <div className="splash-illustration splash-illustration-platform">
          <svg viewBox="0 -50 440 522" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Center sphere lit from the upper-left, deepening to navy at
                  the edges -- same "glowing globe" read as the reference
                  diagram's center, built from Hearth's own blue theme
                  rather than the earlier teal. */}
              <radialGradient id="platformSphere" cx="34%" cy="28%" r="78%">
                <stop offset="0" stopColor="#7fabf7" />
                <stop offset="48%" stopColor="#33509f" />
                <stop offset="100%" stopColor="#0e1a3f" />
              </radialGradient>
              <path id="platformTitleArc" d={PLATFORM_TITLE_ARC} fill="none" />
              <clipPath id="platformSphereClip">
                <circle cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y} r={PLATFORM_SPHERE_RADIUS} />
              </clipPath>
            </defs>

            {/* Outer navy ring -- drawn as one thick stroked circle rather
                than a filled donut path, simplest way to get a clean ring
                of a given thickness. */}
            <circle
              cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y}
              r={(PLATFORM_RING_OUTER + PLATFORM_RING_INNER) / 2}
              fill="none" stroke="#16224a" strokeWidth={PLATFORM_RING_OUTER - PLATFORM_RING_INNER}
            />
            {/* Light-blue middle band that the tab icons sit on. */}
            <circle cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y} r={PLATFORM_RING_INNER} fill="#eaf3fc" />

            {/* Tagline curved along the top of the ring, per explicit
                request to have it "circled around the circle" rather than
                a separate straight heading. */}
            <text className="platform-title-text">
              <textPath href="#platformTitleArc" startOffset="50%" textAnchor="middle">
                Smart Expense Management Platform
              </textPath>
            </text>

            {/* One spoke per real header tab -- icon + label, evenly ringed
                around the center, each popping in with a staggered delay. */}
            {PLATFORM_TABS.map((tab, i) => {
              const pos = polarPoint(PLATFORM_CENTER.x, PLATFORM_CENTER.y, PLATFORM_ICON_RADIUS, tab.angle);
              return (
                // Position (SVG transform attribute) and the pop-in
                // animation (CSS transform: scale, via .platform-tab-icon)
                // are deliberately split across two nested <g>s -- a CSS
                // `transform` completely replaces an element's own SVG
                // `transform` attribute rather than combining with it, so
                // putting both on one node silently drops the translate
                // and stacks every icon on top of each other at (0,0).
                // Two-word labels ("Fixed Expenses", "Regular Expenses",
                // "Smart Budget") are split onto two shorter lines instead
                // of one long one -- the single-line version's horizontal
                // width was what pushed right up against the ring for the
                // labels sitting near the left/right side of the circle
                // (where a label's x-extent adds directly toward the ring
                // rather than being absorbed by empty vertical space), so
                // wrapping cuts each line's width roughly in half and buys
                // a large, unambiguous margin instead of a marginal one.
                (() => {
                  const words = tab.label.split(' ');
                  const isTwoLine = words.length > 1;
                  return (
                    <g key={tab.label} transform={`translate(${pos.x - 12} ${pos.y - 22})`}>
                      <g className="platform-tab-icon" style={{ animationDelay: `${0.7 + i * 0.09}s` }}>
                        <g stroke="#1b2a5e" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <PlatformIcon type={tab.icon} />
                        </g>
                        {isTwoLine ? (
                          <text textAnchor="middle" className="platform-tab-label">
                            <tspan x="12" y="31">{words[0]}</tspan>
                            <tspan x="12" y="41">{words.slice(1).join(' ')}</tspan>
                          </text>
                        ) : (
                          <text x="12" y="34" textAnchor="middle" className="platform-tab-label">{tab.label}</text>
                        )}
                      </g>
                    </g>
                  );
                })()
              );
            })}

            {/* Center sphere -- gentle continuous pulse, plus a faint
                network of nodes/lines clipped to its circle. */}
            <circle
              className="platform-sphere-pulse"
              cx={PLATFORM_CENTER.x} cy={PLATFORM_CENTER.y} r={PLATFORM_SPHERE_RADIUS}
              fill="url(#platformSphere)"
            />
            <g clipPath="url(#platformSphereClip)" className="platform-network">
              {PLATFORM_NETWORK_LINES.map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  x1={PLATFORM_CENTER.x + x1} y1={PLATFORM_CENTER.y + y1}
                  x2={PLATFORM_CENTER.x + x2} y2={PLATFORM_CENTER.y + y2}
                  stroke="#ffffff" strokeWidth="0.7" opacity="0.28"
                />
              ))}
              {PLATFORM_NETWORK_DOTS.map((d, i) => (
                <circle key={i} cx={PLATFORM_CENTER.x + d.x} cy={PLATFORM_CENTER.y + d.y} r={d.r} fill="#ffffff" opacity="0.55" />
              ))}
            </g>

            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y - 30} textAnchor="middle" className="platform-center-kicker">AI POWERED</text>
            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y + 8} textAnchor="middle" className="platform-center-brand">Hearth</text>
            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y + 29} textAnchor="middle" className="platform-center-stat">Income &middot; Bills &middot; Savings</text>
            <text x={PLATFORM_CENTER.x} y={PLATFORM_CENTER.y + 42} textAnchor="middle" className="platform-center-stat">All In One Household View</text>
          </svg>
        </div>
        </div>

        {/* Grouped in their own wrapper with a tight gap (see
            .splash-tagline-group) -- the parent .splash-center's own gap
            is generous by design (breathing room between the big circle
            diagram and the text below it), but that same gap looked too
            loose between these two short lines sitting right on top of
            each other, per explicit request to join them more closely. */}
        <div className="splash-tagline-group">
          <div className="splash-tagline">The heart of your spend management</div>
          <div className="splash-version">{formatVersionBadge()}</div>
        </div>
      </div>

      <div className="splash-credit">Conceptualised, Designed and Created by &ndash;Vipin Lakhanpal</div>
    </div>
  );
}
