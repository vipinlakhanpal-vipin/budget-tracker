import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
// Same circular "platform" badge used as the app's header logo (Dashboard.jsx's
// HearthMark) -- duplicated here (rather than imported) since EManual is meant
// to stay a fully self-contained component. Real logo on the cover per explicit
// request, replacing the earlier plain placeholder circle.
function HearthMark({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="manualCoverSphere" cx="34%" cy="28%" r="78%">
          <stop offset="0" stopColor="#7fabf7" />
          <stop offset="48%" stopColor="#33509f" />
          <stop offset="100%" stopColor="#0e1a3f" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="38" fill="url(#manualCoverSphere)" />
      <text x="50" y="36" textAnchor="middle" className="header-badge-kicker">AI POWERED</text>
      <text x="50" y="54" textAnchor="middle" className="header-badge-brand">Hearth</text>
    </svg>
  );
}

// Auto-generated from the Help panel's helpTopics content -- see Dashboard.jsx.
// Keep this list roughly in sync whenever Help itself changes (same cadence
// as the "Help updated as of vX.XX" marker); it is a plain data snapshot,
// not a live import, so a full e-manual page keeps working even if Help's
// internal structure changes shape later.
const MANUAL_TOPICS = [
  {
    "key": "updates",
    "title": "What's New",
    "body": "Latest updates (Jul 31, 2026): Added a private Investments tracker (Fixed Deposits and Mutual Funds/SIPs) with its own tab, currency + live FX conversion, auto-calculated gain/loss, and a pencil icon to edit any entry. The Report now includes a Payment-Source-wise spend breakdown on screen and in the downloadable/emailed PDF. PDF report category names no longer get cut off -- long names now auto-shrink to fit instead of truncating with \"...\". Every row across Income, Fixed Expenses, Regular Expenses, and Savings now has a pencil icon (matching Investments) that opens a proper edit sheet instead of relying only on inline editing. The small \"Updated\" confirmation toast, and the popup for reading a saved note, now always appear centered in the app instead of sometimes drifting toward the browser's own tab bar on mobile."
  },
  {
    "key": "home",
    "title": "Dashboard",
    "body": "Shows just the dashboard (summary cards and totals), nothing else. Below it, a bigger \"Explore\" section holds the same Spending by category chart (Pie/Bar/Pareto/Treemap), AI Insights, and Budget Coach, sized larger so there's more room to look through them. Clicking Income, Fixed Expenses, Regular Expenses, Savings, Report, Settings, or Help scrolls back up to the top and switches to that tab as usual."
  },
  {
    "key": "regular",
    "title": "Regular Expenses",
    "body": "Log one-off spending (groceries, dining, shopping). Pick the date, category, a short description, and the amount, then Add. It appears under \"Expenses this month\" and is always editable there -- just type into a field and it saves. The note icon () next to Amount opens a spot for a longer free-text description, and the paperclip () lets you attach one photo or PDF (5MB max) -- a receipt, warranty, or anything else worth keeping with that expense. Both are optional. Once saved, a small icon appears next to the entry if it has a note or attachment -- click it to read the note or open the file."
  },
  {
    "key": "scan",
    "title": "Scan a receipt",
    "body": "Below the Regular Expenses form, upload a photo of a receipt (or a screenshot/sheet listing several expenses) and Claude will read it for you. You'll see an editable review list first -- fix anything that looks wrong, untick what you don't want, then add only what you confirm. Nothing is saved automatically."
  },
  {
    "key": "income",
    "title": "Income",
    "body": "Add each income source per month (e.g. Salary). Income does NOT roll over automatically -- since pay can change month to month (deductions, advances, etc.), add a fresh row each month with that month's actual amount, or edit an existing row's Month field forward. Every field auto-saves. It has the same optional note + attachment icons as Regular Expenses."
  },
  {
    "key": "fixed",
    "title": "Fixed Expenses",
    "body": "For recurring bills, loans, EMIs, and rent. Set a Start date, an optional End date, and how often it repeats (Monthly, Alternate month, Quarterly, Half-yearly, Once a year). Every field auto-saves as you edit -- there's no Save button to click. Set a Due date to get an in-app reminder starting 3 days before it's due, and an email reminder if it's set up. It has the same optional note + attachment icons as Regular Expenses -- handy for keeping a loan agreement or lease document attached to the bill itself."
  },
  {
    "key": "notes",
    "title": "Notes & Attachments",
    "body": "The note () and paperclip () icons sit right before the Add button on Income, Fixed Expenses, Regular Expenses, and Savings. Once a row has a saved document, its paperclip icon shows up in two places for convenience -- under the Description/Name cell, and again next to that row's delete icon -- either one opens the same viewer, where you can see the document on screen, open it in a compatible app on your device, or share it by email or WhatsApp."
  },
  {
    "key": "savings",
    "title": "Savings",
    "body": "Set how much you'd like to set aside for the month, e.g. \"Emergency fund\" or \"Investment\". Works exactly like Income: entered fresh per month with no auto-rollover, since the amount you're able to save can change month to month -- add a new row each month, or edit an existing row's Month field forward. Since money you set aside is no longer available to spend, it's treated the same as an expense: it's counted in \"Spent so far\" and \"Combined expenses\", and subtracted in \"Remaining\" and \"Net\", in addition to getting its own page in the PDF report so you can see planned savings build up over time. It has the same optional note + attachment icons as Regular Expenses."
  },
  {
    "key": "investments",
    "title": "Investments",
    "body": "A private tracker for Fixed Deposits and Mutual Funds/SIPs, separate from your household's Income/Expenses/Savings numbers -- it doesn't affect Spent so far, Remaining, or Net. Add the type, name, bank, currency, principal, and (for FDs) an interest rate and maturity date; current value and gain/loss are calculated automatically, and status moves to Matured/Closed on its own once the maturity date passes. Click the pencil icon on any row to edit it, or the trash icon to remove it. Charts on the right show Pie, Bar, and Pareto views of invested vs. current value."
  },
  {
    "key": "regmonth",
    "title": "Regular Expenses for [month]",
    "body": "Labelled with whichever month you're viewing, this is visible below whichever tab (Income, Fixed Expenses, Regular Expenses, Savings) you're on, so you can see what's been logged without switching tabs. It also auto-saves. It's hidden on Dashboard, which shows only the summary and the Explore section instead."
  },
  {
    "key": "chart",
    "title": "Spending by category chart",
    "body": "Toggle between Pie, Bar, Pareto, and Treemap. The Pie groups smaller categories into \"Other\" to stay readable; Bar and Treemap show every category individually. The totals cards above show your combined income, combined expenses (split into Regular, Fixed, and Savings), and what's left of your budget and income after all three are accounted for."
  },
  {
    "key": "insights",
    "title": "AI Insights",
    "body": "Tap Generate below the chart for a short AI-written summary of the month you're viewing (spending patterns, whether you're over budget, and a couple of concrete suggestions). It only runs when you tap the button -- never automatically -- and Refresh regenerates it if your numbers have changed."
  },
  {
    "key": "coach",
    "title": "Budget Coach",
    "body": "Unlike AI Insights (one month at a time), Coach looks across your last 6 months for patterns: a category that keeps going over budget, spending trending up or down, or a savings goal that no longer looks realistic. It only ever writes out suggestions -- it never changes your Settings for you."
  },
  {
    "key": "chatbot",
    "title": "Aria",
    "body": "Aria is Hearth's built-in AI assistant -- a genuinely capable financial companion, not a scripted FAQ bot. It reasons over your household's real numbers, so you can ask it to dig into why a category ran over budget, compare spending across months, spot trends before they become a problem, or get a specific suggestion for hitting a savings goal, and it answers using your actual data rather than generic advice. It's just as happy to explain how any feature works. Find it as the purple chat button below the logo (on phones) or next to the bell (on desktop)."
  },
  {
    "key": "report",
    "title": "Report",
    "body": "Generate a PDF for any date range, then view it on screen, download it, or email it. Each topic gets its own page -- Income, Expenses, Fixed Expenses, Savings, Payment Sources (how much moved through each card/bank/cash), Spend Analysis (Pareto chart), and Recommendations -- except the Category Breakdown bar chart and the Summary table, which share one page by default and only split onto two once the chart itself grows long enough to need the room. Every table, and every category/payment-source label on the charts, auto-shrinks its text to fit rather than cutting names off. The last page closes with a data & privacy note."
  },
  {
    "key": "settings",
    "title": "Settings",
    "body": "Has its own sub-tabs. Currency covers your household's chosen currency (renaming the app/household name itself happens right in the header now -- click the title next to the logo, owners only). Smart Budget always follows whichever month you're viewing on the dashboard (change the Month field there to set or review a different month instead) and covers your overall monthly cap for that month, plus an optional \"Budget for Per Category\" section below it and how this month's spending compares to those caps (you'll get a notification in the bell icon if you go over). Add Category adds, renames, or removes categories. Users (owners only) covers household members and invites -- see below. Admin Console (owners only) covers members and invites. Every field auto-saves as you edit -- there's no Save button to click."
  },
  {
    "key": "notifications",
    "title": "Notifications",
    "body": "The bell icon next to Help (top-right) replaces the old always-on red banners. It shows a count of unread items -- over-total-budget, over a category's budget, or a bill due soon -- and opening it lists them and marks them read."
  },
  {
    "key": "users",
    "title": "Users",
    "body": "See who's active in the household and who's been invited but hasn't joined yet, with full Name/Email/Phone/Location. Owners can invite new members (which also sends them a notification email), fill in or fix anyone's Name/Phone/Location, and edit their own details under \"My details\" -- handy for accounts created before these fields existed. Reachable from Settings' Users sub-tab. The Admin console (if you have access) is separate and never visible to other household members."
  },
  {
    "key": "privacy",
    "title": "Privacy Policy",
    "body": "Covers what's collected, where it's stored, and how the AI features use your data. Also linked at the very bottom of every page. Read the full Privacy Policy (/privacy.html)."
  }
];

// EManual: a full-screen, book-style reader with a real page-turn animation
// (CSS 3D transform, not a canned library) -- per explicit request for a
// PDF-like manual you can "turn pages" on with a tap/swipe instead of a
// flat scroll. Works with click, keyboard arrows, and touch swipe. A plain
// downloadable PDF of the same content is also offered from Settings/Help
// for users who'd rather print or read it offline.
export default function EManual({ open, onClose }) {
  const total = MANUAL_TOPICS.length + 3; // cover + TOC + topics + closing
  const [page, setPage] = useState(0);
  const dragStartX = useRef(null);
  const dragInfo = useRef({ dx: 0 });
  const pageRefs = useRef([]);
  const bookRef = useRef(null);
  const mouseMoveHandler = useRef(null);
  const mouseUpHandler = useRef(null);
  const flapRefs = useRef([]);
  const dragStartY = useRef(null);
  // v2.22: guards the modal-close handler against a click event whose
  // target resolves to .manual-overlay itself -- this happens when a
  // mouseup lands inside the corner-peel's clip-path hole (the folded-away
  // triangle), which makes that pixel hit-test past the page straight to
  // the overlay behind it, so the browser's synthesized click event never
  // passes through manual-shell's stopPropagation() at all.
  const justDraggedRef = useRef(false);

  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  const goNext = useCallback(() => {
    setPage((p) => Math.min(p + 1, total - 1));
  }, [total]);
  const goPrev = useCallback(() => {
    setPage((p) => Math.max(p - 1, 0));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, goNext, goPrev, onClose]);

  if (!open) return null;

  function applyCornerPeel(idx, side, Fx, Fy, W, H) {
    const pageEl = pageRefs.current[idx];
    const flapEl = flapRefs.current[idx];
    if (!pageEl || !flapEl) return;
    const cornerX = side === 'right' ? W : 0;
    const cornerY = 0;
    const vx = Fx - cornerX, vy = Fy - cornerY;
    const vlen = Math.hypot(vx, vy);
    if (vlen < 6) {
      pageEl.style.clipPath = '';
      flapEl.style.clipPath = 'polygon(0% 0%, 0% 0%, 0% 0%)';
      return;
    }
    const mx = (cornerX + Fx) / 2, my = (cornerY + Fy) / 2;
    let dx2 = -vy, dy2 = vx;
    const dlen = Math.hypot(dx2, dy2) || 1;
    dx2 /= dlen; dy2 /= dlen;
    let Tx;
    if (Math.abs(dy2) < 1e-6) { Tx = mx; } else { Tx = mx + (-my / dy2) * dx2; }
    Tx = Math.max(0, Math.min(W, Tx));
    const edgeX = cornerX;
    let edgeY;
    if (Math.abs(dx2) < 1e-6) { edgeY = my; } else { edgeY = my + ((edgeX - mx) / dx2) * dy2; }
    edgeY = Math.max(0, Math.min(H, edgeY));
    const A = dx2 * dx2, B = dx2 * dy2, C = dy2 * dy2;
    const a = 2 * A - 1, b = 2 * B, c = 2 * B, d = 2 * C - 1;
    const e = mx - a * mx - c * my;
    const f = my - b * mx - d * my;
    const pct = (v, total) => (v / total * 100).toFixed(3) + '%';
    if (side === 'right') {
      pageEl.style.clipPath = 'polygon(0% 0%, ' + pct(Tx, W) + ' 0%, 100% ' + pct(edgeY, H) + ', 100% 100%, 0% 100%)';
      flapEl.style.clipPath = 'polygon(' + pct(Tx, W) + ' 0%, 100% 0%, 100% ' + pct(edgeY, H) + ')';
    } else {
      pageEl.style.clipPath = 'polygon(' + pct(Tx, W) + ' 0%, 100% 0%, 100% 100%, 0% 100%, 0% ' + pct(edgeY, H) + ')';
      flapEl.style.clipPath = 'polygon(0% 0%, ' + pct(Tx, W) + ' 0%, 0% ' + pct(edgeY, H) + ')';
    }
    flapEl.style.transform = 'matrix(' + a.toFixed(4) + ',' + b.toFixed(4) + ',' + c.toFixed(4) + ',' + d.toFixed(4) + ',' + e.toFixed(2) + ',' + f.toFixed(2) + ')';
    const angleDeg = Math.atan2(vy, vx) * 180 / Math.PI;
    flapEl.style.backgroundImage =
      'linear-gradient(' + (angleDeg + 90) + 'deg, rgba(20,30,20,.32), rgba(20,30,20,0) 55%), ' +
      'linear-gradient(135deg, #fdfaf3 0%, #f3ecd9 55%, #e2d6b8 100%)';
  }

  // Clears any inline clip-path/transform/--curl left on a page or its flap
  // by an in-progress or reversed drag -- called before handing a page off
  // to the class-driven rotateY snap transition (settleDrag) so the two
  // mechanisms never fight over the same element's styles.
  function resetCornerPeel(idx) {
    const pageEl = pageRefs.current[idx];
    const flapEl = flapRefs.current[idx];
    if (pageEl) { pageEl.style.clipPath = ''; pageEl.style.transform = ''; pageEl.style.removeProperty('--curl'); }
    if (flapEl) { flapEl.style.clipPath = 'polygon(0% 0%, 0% 0%, 0% 0%)'; flapEl.style.transform = ''; }
  }

  function pointerDown(clientX, clientY) {
    dragStartX.current = clientX;
    dragStartY.current = clientY;
    dragInfo.current = { dx: 0 };
  }
  // v2.21: real corner-fold drag. Forward turns (dx<0) peel the current
  // page from its top-right corner using an actual mirror-image flap that
  // follows the pointer -- the fold line is the perpendicular bisector
  // between the page's resting corner and the live pointer position, and
  // the flap is that corner's content reflected across the fold line, per
  // explicit feedback that a bowed-but-flat rectangle (v2.18) didn't read
  // as a real paper fold. Backward drags (dx>0, un-turning a page already
  // flipped past -180deg) keep the earlier rotateY+curl approach, since a
  // 2D corner-peel doesn't compose cleanly with a page that's already
  // resting in a 3D-rotated state.
  function pointerMove(clientX, clientY) {
    if (dragStartX.current == null) return;
    const dx = clientX - dragStartX.current;
    dragInfo.current.dx = dx;
    if (dx < 0 && page < total - 1) {
      const idx = page;
      const el = pageRefs.current[idx];
      if (el) {
        const rect = el.getBoundingClientRect();
        const W = rect.width, H = rect.height;
        const Fx = Math.max(0, Math.min(W, clientX - rect.left));
        const Fy = Math.max(H * 0.06, Math.min(H * 0.42, clientY - rect.top));
        el.style.transition = 'none';
        el.style.transform = '';
        applyCornerPeel(idx, 'right', Fx, Fy, W, H);
      }
      resetCornerPeel(page - 1);
    } else if (dx > 0 && page > 0) {
      const idx = page - 1;
      const el = pageRefs.current[idx];
      if (el) {
        const width = (bookRef.current && bookRef.current.offsetWidth) || 320;
        const progress = Math.min(1, dx / width);
        el.style.transition = 'none';
        el.style.transform = 'rotateY(' + (-180 + 180 * progress) + 'deg)';
        el.style.setProperty('--curl', 1 - progress);
      }
      resetCornerPeel(page);
    }
  }
  function settleDrag(el, toFlipped, finish) {
    if (!el) { finish(); return; }
    el.style.clipPath = '';
    el.style.transition = 'transform 0.6s cubic-bezier(.4,.0,.2,1), --curl 0.6s cubic-bezier(.4,.0,.2,1)';
    el.style.transform = toFlipped ? 'rotateY(-180deg)' : 'rotateY(0deg)';
    el.style.setProperty('--curl', toFlipped ? 1 : 0);
    window.setTimeout(() => {
      el.style.transition = '';
      el.style.transform = '';
      el.style.clipPath = '';
      el.style.removeProperty('--curl');
      finish();
    }, 610);
  }
  function pointerUp() {
    if (dragStartX.current == null) return;
    const dx = dragInfo.current.dx || 0;
    if (dx !== 0) {
      // v2.22: a real drag happened -- the click the browser fires right
      // after this mouseup may spuriously target .manual-overlay (see
      // justDraggedRef declaration above), so suppress the very next click
      // from closing the modal. Cleared on the next tick, well after that
      // synchronous mouseup->click sequence has already run.
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 0);
    }
    const width = (bookRef.current && bookRef.current.offsetWidth) || 320;
    const threshold = width * 0.22;
    if (dx < 0 && page < total - 1) {
      const el = pageRefs.current[page];
      resetCornerPeel(page);
      const shouldAdvance = -dx > threshold;
      settleDrag(el, shouldAdvance, () => { if (shouldAdvance) goNext(); });
    } else if (dx > 0 && page > 0) {
      const el = pageRefs.current[page - 1];
      resetCornerPeel(page - 1);
      const shouldRetreat = dx > threshold;
      settleDrag(el, !shouldRetreat, () => { if (shouldRetreat) goPrev(); });
    }
    dragStartX.current = null;
    dragStartY.current = null;
    dragInfo.current = { dx: 0 };
  }

  // Touch (mobile) -- straightforward, the touch itself is the pointer.
  function handleTouchStart(e) { pointerDown(e.touches[0].clientX, e.touches[0].clientY); }
  function handleTouchMove(e) { pointerMove(e.touches[0].clientX, e.touches[0].clientY); }
  function handleTouchEnd() { pointerUp(); }

  // Mouse (desktop) -- same physics as touch, so dragging a page with the
  // cursor turns it exactly like a finger would. mousemove/mouseup are
  // attached to the window for the duration of the drag (not just the
  // shell) since the cursor can move outside the modal mid-drag; without
  // this a fast drag off the edge would get "stuck" mid-flip.
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    // v2.19: stop the browser's own text-selection / image-drag gesture
    // from starting at the same time as our JS-driven page turn -- see
    // the matching comment on .manual-page-face in index.css.
    e.preventDefault();
    pointerDown(e.clientX, e.clientY);
    mouseMoveHandler.current = (ev) => pointerMove(ev.clientX, ev.clientY);
    mouseUpHandler.current = () => {
      pointerUp();
      window.removeEventListener('mousemove', mouseMoveHandler.current);
      window.removeEventListener('mouseup', mouseUpHandler.current);
    };
    window.addEventListener('mousemove', mouseMoveHandler.current);
    window.addEventListener('mouseup', mouseUpHandler.current);
  }

  function renderPageContent(i) {
    if (i === 0) {
      return (
        <div className="manual-cover">
          <HearthMark size={76} />
          <h1>Hearth</h1>
          <p className="manual-cover-sub">The Complete Guide</p>
          <p className="manual-cover-tag">The heart of your home's finances.</p>
        </div>
      );
    }
    if (i === 1) {
      return (
        <div className="manual-toc">
          <h2>Contents</h2>
          <div className="manual-toc-list">
            {MANUAL_TOPICS.map((topic, idx) => (
              <button
                key={topic.key}
                type="button"
                className="manual-toc-item"
                onClick={() => setPage(idx + 2)}
              >
                <span className="manual-toc-item-title">{topic.title}</span>
                <span className="manual-toc-item-num">{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (i === total - 1) {
      return (
        <div className="manual-closing">
          <h2>That's everything</h2>
          <p>Your data is confidential and private to your household -- it's never shared with anyone outside it.</p>
          <p className="manual-closing-small">Tap "Take the tour again" from Help any time for a guided walkthrough instead.</p>
        </div>
      );
    }
    const t = MANUAL_TOPICS[i - 2];
    return (
      <div className="manual-topic">
        <div className="manual-topic-num">{i - 1} / {MANUAL_TOPICS.length}</div>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
      </div>
    );
  }

  const pages = Array.from({ length: total }, (_, i) => i);

  return (
    <div className="manual-overlay" onClick={(e) => { if (justDraggedRef.current) return; onClose(e); }}>
      <div
        className="manual-shell"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div className="manual-head">
          <span className="manual-head-title"><BookOpen size={16} style={{ marginRight: 6, verticalAlign: -3 }} />Hearth Manual</span>
          <button type="button" className="manual-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="manual-book" ref={bookRef}>
          {pages.map((i) => {
            const flipped = i < page;
            const zIndex = flipped ? i : pages.length - i;
            return (
              <div
                key={i}
                ref={(el) => { pageRefs.current[i] = el; }}
                className={`manual-page${flipped ? ' manual-page-flipped' : ''}`}
                style={{ zIndex }}
                onTransitionEnd={(e) => {
                  // v2.18: the bow/shading is only meant to be visible while a
                  // page is actively mid-turn (see the --curl parabola in
                  // index.css) -- once the transform transition settles at
                  // either resting angle, snap --curl back to 0 immediately
                  // (transition disabled for one frame) so a turned page lies
                  // flat with a straight edge again instead of keeping a
                  // permanent curved notch/shadow.
                  if (e.propertyName !== 'transform' || e.target !== e.currentTarget) return;
                  const el = e.currentTarget;
                  const prevTransition = el.style.transition;
                  el.style.transition = 'none';
                  el.style.setProperty('--curl', '0');
                  requestAnimationFrame(() => { el.style.transition = prevTransition; });
                }}
              >
                <div className="manual-page-face manual-page-front"><span className="manual-page-dogear" aria-hidden="true" />{renderPageContent(i)}</div>
                <div className="manual-page-face manual-page-back" />
                <div ref={(el) => { flapRefs.current[i] = el; }} className="manual-page-flap" />
              </div>
            );
          })}
        </div>
        <div className="manual-controls">
          <button type="button" className="btn small secondary" onClick={goPrev} disabled={page === 0}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="manual-page-count">{page + 1} / {total}</span>
          <button type="button" className="btn small secondary" onClick={goNext} disabled={page === total - 1}>
            Next <ChevronRight size={16} />
          </button>
          <button type="button" className="btn small secondary manual-close-cta" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}
