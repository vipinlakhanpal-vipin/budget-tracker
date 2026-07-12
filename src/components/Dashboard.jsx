import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  ComposedChart, Line, Treemap,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../supabaseClient';
import AdminConsole from './AdminConsole.jsx';
import { formatVersionBadge } from '../version.js';
import {
  Home, Plus, FileText, Users as UsersIcon, Settings as SettingsIcon,
  Pencil, Trash2, X, ChevronLeft, ChevronRight, Camera, MessageCircle, Sparkles, User,
  Palette, Check, StickyNote, Paperclip,
} from 'lucide-react';

// Max size for a note/fixed-expense attachment (images or PDF only). Kept as
// a constant so the Add-expense form, Fixed Expenses form, and the shared
// upload helper all enforce exactly the same limit.
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ATTACHMENT_ACCEPT = 'image/*,application/pdf';

function isAllowedAttachment(file) {
  if (!file) return true;
  if (file.size > ATTACHMENT_MAX_BYTES) return false;
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

// Small reusable "AI powered" pill -- a magic-wand sparkle + label used next
// to every AI feature (auto-categorize, receipt scan, AI Insights, Budget
// Coach, chat assistant) so they all read as visually distinct from regular
// app chrome, consistently, wherever they appear.
function AiTag({ style }) {
  return (
    <span className="ai-powered-tag" style={style}>
      <Sparkles size={11} className="ai-tag-sparkle" strokeWidth={2.25} />
      AI powered
    </span>
  );
}

// A small header-sized version of the splash screen's own hearth motif
// (roofline + layered flame) -- reuses the exact same gradients/paths as
// Splash.jsx, just without the surrounding scene (glow ellipses, coin,
// wallet, piggy bank, receipt) that only make sense at splash size. Sits
// above the household name in the top bar so the app's own mark, not just
// plain text, anchors the header.
function HearthMark({ size = 32 }) {
  // v4 of this mark: rebuilt to match the gold "heart-shaped roofline +
  // house + chimney with rising hearts" logo the user provided as a
  // reference (family silhouette + full wordmark version lives at splash
  // size in Splash.jsx -- there's no room for that level of detail at a
  // 30-ish px header icon, so this keeps just the heart outline, the small
  // roof peak nested inside it, and the chimney with a single tiny rising
  // heart above it). Gold throughout now, replacing the red filled heart
  // from the previous version, to match that reference. The heart outline
  // has a brighter, blurred "glow chase" copy animating its dash-offset
  // around the perimeter (.heart-glow-chase in index.css) -- the same
  // traveling-shimmer technique used on the big splash version, rather than
  // a plain scale pulse, so the two read as the same animated mark at two
  // sizes instead of two different effects.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hdrHeartGold" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#5c3a06" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Darkened per explicit follow-up ("keep it gold, just darken the
          lines") -- the first version's gradient ran up to a pale
          #fde68a top stop, which is exactly the shade that disappears
          against this header's light background. Both stops here are now
          solidly dark/mid amber-brown, so the outline stays clearly
          visible the whole way around rather than fading out at the top. */}
      <path
        className="heart-outline-draw"
        d="M32 54 C32 54 9 35 9 22 C9 12 17 7 25 10 C29 11.5 31 15 32 18 C33 15 35 11.5 39 10 C47 7 55 12 55 22 C55 35 32 54 32 54 Z"
        fill="none" stroke="url(#hdrHeartGold)" strokeWidth="3.4" strokeLinejoin="round"
      />
      <path
        className="heart-glow-chase"
        d="M32 54 C32 54 9 35 9 22 C9 12 17 7 25 10 C29 11.5 31 15 32 18 C33 15 35 11.5 39 10 C47 7 55 12 55 22 C55 35 32 54 32 54 Z"
        fill="none" stroke="#eab308" strokeWidth="2.2" strokeLinejoin="round"
      />
      <path
        className="hearth-roof"
        d="M20 32 L32 19 L44 32"
        stroke="#5c3a06" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round"
      />
      <rect x="41" y="15" width="5" height="11" fill="url(#hdrHeartGold)" />
      <g className="mini-rising-heart">
        <path
          d="M43.5,10.1l-.44-.4C41.6,8.3,40.6,7.4,40.6,6.2c0-.9.7-1.6,1.6-1.6.5,0,1,.24,1.3.62.3-.38.8-.62,1.3-.62.9,0,1.6.7,1.6,1.6,0,1.2-1,2.1-2.5,3.5l-.4.38Z"
          fill="#fde68a"
        />
      </g>
      {/* Smallest possible hint of the splash version's family silhouette --
          three plain dots (two "parents" + a smaller "child" in front)
          rather than actual head+shoulder shapes, since any finer detail
          just anti-aliases into a blob at this size (the exact problem the
          original fine-line heart had). Sized/positioned so the mark's
          overall footprint (viewBox, size prop) doesn't change at all. */}
      <g fill="#2a1608">
        <circle cx="27.5" cy="39.5" r="3" />
        <circle cx="36.5" cy="39.5" r="3" />
        <circle cx="32" cy="43.5" r="2.3" />
      </g>
    </svg>
  );
}

const COLORS = [
  '#f97316', '#0ea5e9', '#a855f7', '#22c55e', '#ef4444',
  '#eab308', '#14b8a6', '#ec4899', '#6366f1', '#84cc16',
  '#06b6d4', '#f43f5e',
];
const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];
const CURRENCIES = ['AED', 'USD', 'GBP', 'EUR', 'INR', 'SAR', 'PKR'];
// Shown as a prefix inside every amount field so what you're typing is
// unambiguous at a glance -- codes without one universally-recognized
// glyph (AED/SAR/PKR) just repeat the code itself, matching how fmt()
// already labels totals elsewhere in the app.
const CURRENCY_SYMBOLS = { AED: 'AED', USD: '$', GBP: '£', EUR: '€', INR: '₹', SAR: 'SAR', PKR: 'PKR' };

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'alternate', label: 'Alternate month' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Once a year' },
];

// How an expense was paid. Bank name only matters (and only shows) for the
// two card options -- Cash has nothing to pick.
const PAYMENT_SOURCES = ['Cash', 'Credit Card', 'Debit Card'];
// Fixed/recurring expenses get a 4th option: some of them (health insurance,
// a salary loan EMI) are deducted straight from the paycheck rather than
// paid via cash or a card, so they don't fit either existing bucket. Only
// offered on the Fixed Expenses forms/table, not one-off expenses.
// "Bank" is its own option (distinct from Credit/Debit Card) for fixed
// bills that are debited straight from a bank account -- a car loan EMI,
// for instance -- rather than paid via a card. It still needs a bank name
// picked, same as the two card options, so it's included in
// CARD_PAYMENT_SOURCES below (which really means "needs a bank picker"
// at this point, not strictly "is a card").
const RECURRING_PAYMENT_SOURCES = [...PAYMENT_SOURCES, 'Bank', 'Salary'];
const CARD_PAYMENT_SOURCES = ['Credit Card', 'Debit Card', 'Bank'];
// Free-tier household size cap: the owner plus this many additional people
// (active members + pending invites combined).
const MAX_ADDITIONAL_USERS = 2;
// Common UAE retail banks, since this household is based in Dubai -- "Other"
// covers anything not listed rather than blocking entry.
const BANKS = [
  'Emirates NBD', 'ADCB', 'FAB (First Abu Dhabi Bank)', 'Dubai Islamic Bank',
  'Mashreq', 'ADIB', 'RAKBANK', 'CBD (Commercial Bank of Dubai)', 'HSBC UAE',
  'Standard Chartered UAE', 'Citibank UAE', 'Other',
];
const FREQUENCY_MONTHS = { monthly: 1, alternate: 2, quarterly: 3, half_yearly: 6, yearly: 12 };

// Difference, in whole months, between two "YYYY-MM" keys (to >= from assumed
// for the recurring-expense-occurs-this-month check below).
function monthDiff(fromKey, toKey) {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// Shared by the dashboard's current-month view and the PDF report: whether a
// recurring expense lands in a given "YYYY-MM" month, honouring its start/end
// dates and repeat frequency (e.g. alternate-month rent only counts every
// 2nd month from its start date).
function recurringOccursInMonth(r, key) {
  if (!r.active) return false;
  const startKey = r.start_date.slice(0, 7);
  const startsOk = startKey <= key;
  const endsOk = !r.end_date || r.end_date.slice(0, 7) >= key;
  if (!startsOk || !endsOk) return false;
  const interval = FREQUENCY_MONTHS[r.frequency] || 1;
  if (interval <= 1) return true;
  return monthDiff(startKey, key) % interval === 0;
}

// All "YYYY-MM" month keys from one date to another, inclusive.
function monthsBetween(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr + 'T00:00:00');
  const to = new Date(toDateStr + 'T00:00:00');
  const keys = [];
  let cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    keys.push(monthKey(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return keys;
}

// The UAE's new official Dirham symbol (a "D" crossed by two horizontal
// strokes) isn't in a shipped Unicode font yet, so it can't be typed as plain
// text. Since Recharts renders to inline SVG, we draw a vector approximation
// directly so it displays correctly everywhere without relying on any font.
function DirhamBarLabel(props) {
  const { x, y, width, height, value } = props;
  const cy = y + height / 2;
  const startX = x + width + 6;
  const numStr = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <g>
      <text x={startX} y={cy} dy={3.5} fontSize={10} fontWeight={700} fill="#0f2a2e" fontFamily="Arial, sans-serif">D</text>
      <line x1={startX - 1} y1={cy - 2.5} x2={startX + 6.5} y2={cy - 2.5} stroke="#0f2a2e" strokeWidth={1} />
      <line x1={startX - 1} y1={cy + 2.5} x2={startX + 6.5} y2={cy + 2.5} stroke="#0f2a2e" strokeWidth={1} />
      <text x={startX + 10} y={cy} dy={3.5} fontSize={10} fill="#0f2a2e">{numStr}</text>
    </g>
  );
}

// Treemap tile renderer -- each category gets a box sized by how much was
// spent, colored from the same palette as the other charts. Unlike a pie
// slice, a treemap box has room to print its own label directly inside it,
// so nothing overlaps regardless of how many categories there are -- boxes
// too small to hold readable text (the tiny "long tail" categories) simply
// render as an unlabeled colored tile instead of cramming text in, which is
// exactly the clutter a many-category pie chart runs into.
function TreemapTile(props) {
  const { x, y, width, height, index, name, value } = props;
  const color = COLORS[index % COLORS.length];
  const canLabel = width > 46 && height > 24;
  const canShowValue = width > 60 && height > 40;
  const label = name && name.length > 14 ? name.slice(0, 14) + '…' : name;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: '#fff', strokeWidth: 1.5 }} />
      {canLabel && (
        <text x={x + 6} y={y + 16} fontSize={10.5} fontWeight={700} fill="#fff">{label}</text>
      )}
      {canShowValue && (
        <text x={x + 6} y={y + 30} fontSize={9} fill="#fff" fillOpacity={0.9}>{fmt(value)}</text>
      )}
    </g>
  );
}

// Module-level so the standalone fmt() helper (used all over the JSX below)
// can stay a simple function instead of threading a currency prop through
// every call site. Updated at the top of each Dashboard render from the
// household's saved currency setting.
let CURRENT_CURRENCY = 'AED';

function fmt(n) {
  const v = Number(n) || 0;
  return CURRENT_CURRENCY + ' ' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// The little prefix shown inside every amount input (Add forms, edit
// sheets, and the inline-editable tables) so the currency is always
// visible right where you're typing, not just in the household's Settings.
function currencySymbol() {
  return CURRENCY_SYMBOLS[CURRENT_CURRENCY] || CURRENT_CURRENCY;
}

// The UAE's new official Dirham symbol (unveiled by the Central Bank in
// March 2025 -- a Latin "D" crossed by two horizontal lines) has no Unicode
// codepoint yet (assigned U+20C3, but not shipping in any font until
// Unicode 18.0 lands, expected ~Sept 2026), so there's no font character to
// just type. Drawing it as a tiny inline SVG (currentColor, sized to the
// surrounding text) is the only faithful way to show the real symbol today
// instead of falling back to the "AED" text abbreviation. Renders inside
// the currency-prefix span everywhere an amount is entered/shown.
// size defaults to "1em" rather than a fixed pixel value so the glyph
// always scales with whatever font-size its surrounding text is using --
// small next to a table figure, larger next to a big bold dashboard
// number -- instead of staying visually tiny/mismatched against large
// values (the em unit resolves against the <svg>'s own inherited
// font-size, and the fixed viewBox keeps the D + double-line drawing
// proportioned correctly at any size).
function DirhamGlyph({ size = '1em' }) {
  return (
    // viewBox tightly wraps just the drawn D + two lines (the old 0 0 16 16
    // box left a wide margin of empty space to the right/below the glyph,
    // which read as a built-in gap before the number even started -- a "$"
    // never has that dead space, so this crops it out the same way.
    <svg width={size} height={size} viewBox="0 3 10 11" fill="none" style={{ flex: '0 0 auto' }}>
      <text x="1" y="12.5" fontSize="12" fontWeight="800" fontFamily="Arial, sans-serif" fill="currentColor">D</text>
      <line x1="0.5" y1="5.4" x2="9.5" y2="5.4" stroke="currentColor" strokeWidth="1.3" />
      <line x1="0.5" y1="8.6" x2="9.5" y2="8.6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

// Prefix shown inside every amount field: the real Dirham glyph for AED
// households, or the plain text symbol for any other currency (those all
// already have a normal Unicode symbol -- $, £, €, ₹ -- so there's nothing
// to substitute there).
function CurrencyPrefix() {
  if (CURRENT_CURRENCY === 'AED') return <DirhamGlyph />;
  return currencySymbol();
}

// Every editable amount field (top-level Add forms + in-table cells) sizes
// its input to exactly fit the digits typed, so the currency symbol sits
// glued against them with zero gap -- the same "$4,500" look the read-only
// dashboard figures and description text already have for free (a plain
// text node just IS as wide as its content). An <input> can't do that on
// its own, so this measures the actual rendered pixel width of the typed
// value with a shared offscreen canvas and returns it directly, instead of
// approximating it from a per-character formula. The formula approach (an
// earlier version of this fix) used a flat "1ch per character" estimate,
// which is close but not exact -- a "." is narrower than a digit, and even
// digits aren't perfectly uniform width in this font, so different values
// with the same character count ended up with visibly different amounts of
// slack once right-aligned. Measuring the real string removes that
// residual inconsistency entirely rather than tuning the formula further.
let _amtMeasureCanvas = null;
function measureAmountWidthPx(value, font, emptyFallback) {
  if (!_amtMeasureCanvas) _amtMeasureCanvas = document.createElement('canvas');
  const ctx = _amtMeasureCanvas.getContext('2d');
  ctx.font = font;
  const text = String(value ?? '').trim() || emptyFallback;
  return ctx.measureText(text).width;
}
// Table cells: 11px Nunito (the unified table font size -- see the
// "Unify font size across all table inputs/selects" fix). Small fixed
// buffer just for the input's own subpixel rounding/caret, not a safety
// margin for missing digits (the measurement is exact, so it doesn't need
// one the way the old ch-based formula did). Empty is rare here (rows
// already have a value), but floors at 2 digits' width same as before.
function tightAmountPx(value) {
  return Math.ceil(measureAmountWidthPx(value, '400 11px Nunito, sans-serif', '00')) + 2;
}
// Top-level Add-form fields: 14px, the standard .field input size. Empty
// measures against the field's own "0.00" placeholder (not a bare "0") --
// otherwise the box sizes for 1 character while 4 characters of grey
// placeholder text are actually rendered inside it, clipping the "0.00".
function formAmountPx(value) {
  return Math.ceil(measureAmountWidthPx(value, '400 14px Nunito, sans-serif', '0.00')) + 2;
}

// Read-only currency display used everywhere a figure is just shown (not
// edited) -- dashboard summary cards, mobile transaction amounts, budget-cap
// progress, etc. Glues the symbol straight onto the number with no space,
// same "$4,500" convention the editable amount fields already use, instead
// of the old "AED 4,500.00" (code + space) text format. A leading minus
// sign (for negative/over-budget figures) is pulled out in front of the
// symbol -- "-AED50" reads oddly, "-Đ50" reads the way "-$50" would.
function Amt({ value }) {
  const v = Number(value) || 0;
  const neg = v < 0;
  const numStr = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className="amt-tight">
      {neg ? '-' : ''}<CurrencyPrefix />{numStr}
    </span>
  );
}

function monthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(d) {
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function Dashboard({ session, household, onHouseholdChange, isAdmin, onOpenAdmin }) {
  const householdId = household.id;
  const isOwner = household.role === 'owner';

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [currency, setCurrency] = useState('AED');
  const [currencyDraft, setCurrencyDraft] = useState('AED');
  // Self-service household rename (owner-only) -- previously the name
  // could only be set once at creation, or changed by the superadmin via
  // Admin Console. Synced from the `household` prop whenever it changes
  // (e.g. after commitHouseholdName() triggers onHouseholdChange() to
  // re-fetch it), same pattern as totalBudgetDraft/currencyDraft above.
  const [householdNameDraft, setHouseholdNameDraft] = useState(household.name || '');
  useEffect(() => {
    setHouseholdNameDraft(household.name || '');
  }, [household.name]);
  const [chartType, setChartType] = useState('pie');
  const [loading, setLoading] = useState(true);
  // Exactly one of these panels (Budget settings / Users / Admin console / Help)
  // can be open at a time -- they all render in the same spot below the chart,
  // and opening one auto-scrolls its title into view.
  const [activePanel, setActivePanel] = useState(null);
  const panelRef = useRef(null);
  // Which sub-section shows inside the Settings panel -- App Settings
  // (budget/currency/categories) or, for the admin user only, the Admin
  // Console. Previously Admin Console was its own separate top-bar button
  // and panel; folding it into Settings as a sub-toggle instead reduces the
  // top bar to fewer buttons and groups "app configuration" together.
  const [settingsSubTab, setSettingsSubTab] = useState('app');
  function togglePanel(name) {
    // Closing the mobile add sheet whenever a different panel opens keeps
    // only one "overlay" on screen at a time, so Report/Users/Settings
    // never end up stacked underneath an already-open Add sheet.
    setAddSheetOpen(false);
    closeAllMobileEditSheets();
    setActivePanel((cur) => (cur === name ? null : name));
  }

  // Bell icon (top bar, just before Help) replaces the old always-visible red
  // "over budget" / "bill due soon" banners -- same underlying warnings, just
  // tucked behind a click instead of shouting across the top of the page on
  // every visit. Read/unread state is remembered per-household in
  // localStorage (keyed by notification id, e.g. "over-cat-Credit Card EMI")
  // so a notification only shows as unread once, even across reloads/logins,
  // until its underlying condition actually changes (a new id shows up again).
  const [notifOpen, setNotifOpen] = useState(false);
  const notifSeenKey = `hearth-seen-notifs-${household.id}`;
  const [seenNotifIds, setSeenNotifIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(notifSeenKey) || '[]'));
    } catch {
      return new Set();
    }
  });
  const notifBellRef = useRef(null);
  useEffect(() => {
    if (!notifOpen) return;
    function onDocClick(e) {
      if (notifBellRef.current && !notifBellRef.current.contains(e.target)) setNotifOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  // Profile icon (replaces the old standalone "Sign out" button) -- same
  // open/close-on-outside-click pattern as the notification bell above.
  // Shows the signed-in email plus the same self-editable Name/Phone/
  // Location fields as "My details" in Users (myDetailsDraft/
  // commitMyDetailsField, already defined below), with Sign out as the
  // last action in the dropdown instead of its own top-bar button.
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  useEffect(() => {
    if (!profileMenuOpen) return;
    function onDocClick(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [profileMenuOpen]);
  // Color theme picker -- swaps the app's --accent/--accent2 pairs (see the
  // [data-theme="..."] rules in index.css) via a data-theme attribute on
  // <html>, remembered per-browser in localStorage. Purely cosmetic/local:
  // there's no per-household "theme" column, so each signed-in device can
  // pick its own without affecting anyone else in the household.
  const THEMES = [
    { id: 'teal', label: 'Teal (default)', color: '#0d9488' },
    { id: 'ocean', label: 'Ocean blue', color: '#0369a1' },
    { id: 'purple', label: 'Purple', color: '#7c3aed' },
    { id: 'rose', label: 'Rose', color: '#db2777' },
    { id: 'forest', label: 'Forest green', color: '#15803d' },
  ];
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('hearth-theme') || 'teal';
    } catch {
      return 'teal';
    }
  });
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);
  useEffect(() => {
    if (theme === 'teal') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      localStorage.setItem('hearth-theme', theme);
    } catch {
      // ignore -- purely a nice-to-have persistence, not worth surfacing an error for
    }
  }, [theme]);
  useEffect(() => {
    if (!themeMenuOpen) return;
    function onDocClick(e) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) setThemeMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [themeMenuOpen]);
  function markNotifsSeen(ids) {
    setSeenNotifIds((cur) => {
      const next = new Set(cur);
      ids.forEach((id) => next.add(id));
      try {
        localStorage.setItem(notifSeenKey, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  // Mobile bottom navigation -- a fixed, thumb-reachable bar (shown only
  // below 640px via CSS) that jumps straight to the app's main destinations,
  // instead of making a phone user scroll back up to the top button rows
  // every time they want to switch sections. It's additive: the existing
  // top action row and input tabs still work exactly as before on any
  // screen size, this just gives mobile a faster, app-like way to get
  // around using the same underlying state.
  const topRef = useRef(null);
  const stickyFrameRef = useRef(null);
  const inputTabsSectionRef = useRef(null);
  // On mobile, tapping "+" or "Add" opens the exact same Add
  // expense/income/fixed/savings forms as a sliding bottom sheet instead of
  // scrolling to them -- the standard native quick-add pattern. This reuses
  // the identical form JSX and state that desktop already renders inline;
  // only a CSS class (added below, mobile-breakpoint only) turns that same
  // section into an overlay, so nothing about desktop's layout or behavior
  // changes.
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Drives the mobile-only "Expenses this month" redesign below: on a
  // narrow screen, that list renders as tappable read-only rows (icon,
  // description, date, amount) instead of the always-editable input table
  // desktop uses -- tapping a row opens an edit sheet instead. Tracked in
  // JS (not just CSS) because which JSX gets rendered actually differs
  // between the two, not just how it's styled.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  // Same tap-to-edit pattern as Expenses, applied to Income / Fixed
  // Expenses / Savings so all four mobile lists behave consistently.
  const [editingIncomeId, setEditingIncomeId] = useState(null);
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [editingSavingId, setEditingSavingId] = useState(null);

  function closeAllMobileEditSheets() {
    setEditingExpenseId(null);
    setEditingIncomeId(null);
    setEditingRecurringId(null);
    setEditingSavingId(null);
  }

  function goToOverview() {
    setActivePanel(null);
    setAddSheetOpen(false);
    closeAllMobileEditSheets();
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function goToAdd(tab) {
    setActivePanel(null);
    closeAllMobileEditSheets();
    setInputTab(tab);
    setAddSheetOpen(true);
  }
  useEffect(() => {
    if (!activePanel || !panelRef.current) return;
    // Plain scrollIntoView({block:'start'}) aligns the panel's top edge with
    // the very top of the viewport -- but .sticky-dashboard-frame (logo,
    // tab row, month nav, summary cards) is pinned to that exact spot, so it
    // was covering each panel's own heading (e.g. Help's "How to use this
    // app") right after the "scroll", leaving users looking at a header they
    // already had and not the section they just opened. Instead, compute
    // the sticky frame's real rendered height and land just below it.
    // requestAnimationFrame gives the panel (which only mounts once
    // activePanel matches) one tick to actually be in the DOM/laid out
    // before measuring it.
    const raf = requestAnimationFrame(() => {
      if (!panelRef.current) return;
      const stickyHeight = stickyFrameRef.current?.offsetHeight || 0;
      const panelTop = panelRef.current.getBoundingClientRect().top + window.scrollY;
      const targetY = Math.max(panelTop - stickyHeight - 12, 0);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [activePanel]);
  const [inputTab, setInputTab] = useState('expense');
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  // Lets anyone (including accounts created before the Location field
  // existed, like the very first owner account) fill in / fix their own
  // Name, Phone, Location later -- without needing to sign out and sign up
  // again, since signup metadata only ever gets copied into
  // household_members once, at the moment a household is first joined.
  const [myDetailsDraft, setMyDetailsDraft] = useState({ name: '', phone: '', location: '' });
  const [expenseDrafts, setExpenseDrafts] = useState({});

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    categoryId: '',
    description: '',
    amount: '',
    paymentSource: 'Cash',
    paymentBank: '',
    notes: '',
  });
  // Notes textarea starts collapsed (most expenses don't need a long
  // description) -- the note icon just reveals it. The file itself isn't
  // uploaded until the expense is actually saved, since the upload path
  // needs the new row's own id (see uploadAttachment/handleAddExpense).
  const [showExpenseNotes, setShowExpenseNotes] = useState(false);
  const [expenseFile, setExpenseFile] = useState(null);
  const expenseFileInputRef = useRef(null);
  // AI feature #1 (auto-categorization): a small hint shown next to the
  // Category field right after the AI picks one for you, so it's clear the
  // dropdown got auto-filled rather than silently changing. Purely
  // additive -- if the API key isn't configured yet or the call fails, this
  // just never fires and the form behaves exactly as before.
  const [aiCategoryHint, setAiCategoryHint] = useState('');
  // AI feature #2 (monthly digest): a short AI-written summary of the
  // currently viewed month's spending, generated on demand (not
  // automatically) so it never costs anything unless someone actually asks
  // for it. Kept in memory only -- reopening the app or switching months
  // just shows the "Generate" prompt again instead of a stale digest for a
  // different month.
  const [aiDigest, setAiDigest] = useState('');
  const [aiDigestLoading, setAiDigestLoading] = useState(false);
  const [aiDigestError, setAiDigestError] = useState(false);
  const [aiDigestMonthKey, setAiDigestMonthKey] = useState(null);
  // AI feature #3 (receipt scanning): upload a photo of a receipt, or a
  // sheet/screenshot listing several expenses, and let Claude read it
  // instead of typing each line by hand. Nothing is saved to the database
  // until the user reviews and confirms the extracted rows below -- OCR/
  // vision can misread a date, merchant name, or amount, especially on a
  // blurry photo, so this is a staging area rather than a direct insert.
  const scanFileInputRef = useRef(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanResults, setScanResults] = useState([]); // [{ include, date, description, amount, categoryId }]

  // AI feature #4 (chat assistant): a floating Q&A bubble, available from
  // anywhere in the app (not tied to a specific tab/panel), that answers
  // questions using this household's own data -- spending by category,
  // budget status, recent-month comparisons. Conversation history lives only
  // in memory for this session; each request re-sends a fresh snapshot of
  // the household's numbers rather than trying to keep data "inside" a
  // saved conversation, so answers can't go stale mid-chat.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]); // [{ role: 'user'|'assistant', content }]
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  // Chat bubble now lives as a fixed icon button in the header, directly
  // next to the notification bell (see .chat-fab-wrap in index.css) --
  // no longer a free-floating, draggable FAB. That removes the recurring
  // "collides with the header/bell" bugs for good, since its position is
  // now just normal document flow right next to the bell (same dropdown
  // pattern as the bell and profile menus) instead of fixed viewport
  // coordinates that had to be reclamped on every header change.
  const chatMenuRef = useRef(null);
  useEffect(() => {
    if (!chatOpen) return;
    function onDocClick(e) {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target)) setChatOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [chatOpen]);
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // AI feature #5 (Budget Coach): unlike the monthly digest (#2), which
  // summarizes just the currently viewed month, this looks across the last
  // 6 months for trends -- a category over its cap for several months
  // running, spending creeping up or down, whether planned savings still
  // look realistic. Suggestions-only, per explicit choice -- it never
  // writes to Settings itself, so nothing changes unless the user goes and
  // changes it themselves.
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState(false);
  const [coachResult, setCoachResult] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryNameDrafts, setCategoryNameDrafts] = useState({});
  const [categoryBudgetDrafts, setCategoryBudgetDrafts] = useState({});
  const [totalBudgetDraft, setTotalBudgetDraft] = useState('');

  const [newRecurring, setNewRecurring] = useState({
    name: '',
    categoryId: '',
    amount: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    frequency: 'monthly',
    dueDate: '',
    paymentSource: 'Cash',
    paymentBank: '',
    notes: '',
  });
  const [recurringDrafts, setRecurringDrafts] = useState({});
  // Same note/attachment pattern as the one-off expense form above.
  const [showRecurringNotes, setShowRecurringNotes] = useState(false);
  const [recurringFile, setRecurringFile] = useState(null);
  const recurringFileInputRef = useRef(null);

  // Savings goals -- how much the household wants to set aside each month.
  // Entered per month on purpose, exactly like Income (no auto-rollover) --
  // savings amounts often change month to month, so re-entering a fresh
  // value each month avoids silently counting last month's amount again.
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [newSaving, setNewSaving] = useState({
    name: '',
    amount: '',
    month: monthKey(new Date()),
  });
  const [savingsDrafts, setSavingsDrafts] = useState({});

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRelation, setInviteRelation] = useState('Spouse');
  const [inviteStatus, setInviteStatus] = useState('');

  // Income is entered per month on purpose (no auto-rollover) -- see newIncome.month.
  const [newIncome, setNewIncome] = useState({
    name: '',
    memberEmail: session.user.email,
    amount: '',
    month: monthKey(new Date()),
  });
  const [incomeDrafts, setIncomeDrafts] = useState({});

  // Report panel state -- generates a PDF for a chosen date range covering
  // Expenses this month / Income / Fixed Expenses. Kept as a data URI in
  // state after "Generate" so Download and Email can both reuse it without
  // rebuilding the PDF twice.
  const [reportFrom, setReportFrom] = useState(() => monthKey(new Date()) + '-01');
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportDoc, setReportDoc] = useState(null); // { blob, dataUri, previewUrl, filename, rangeLabel }
  const [reportEmail, setReportEmail] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [reportPreviewOpen, setReportPreviewOpen] = useState(false);
  // Tracks the current blob: URL used for the on-screen preview so it can be
  // revoked (freeing memory) whenever a new one is generated or the
  // component unmounts.
  const reportPreviewUrlRef = useRef(null);
  useEffect(() => {
    return () => {
      if (reportPreviewUrlRef.current) URL.revokeObjectURL(reportPreviewUrlRef.current);
    };
  }, []);

  // Keep the "Add income" form's default Month field in sync with whichever
  // month the dashboard is currently showing, so adding income while viewing
  // August defaults to August instead of whatever month the app happened to
  // load on.
  useEffect(() => {
    setNewIncome((i) => ({ ...i, month: monthKey(currentMonth) }));
  }, [currentMonth]);

  // Same idea for the "Add saving" form's default Month field.
  useEffect(() => {
    setNewSaving((s) => ({ ...s, month: monthKey(currentMonth) }));
  }, [currentMonth]);

  // Seed the "My details" self-edit fields from the signed-in user's own
  // household_members row -- but only ONCE, the first time it becomes
  // available. After that, commitMyDetailsField keeps this draft in sync
  // directly, so this effect never runs again and can't clobber whatever
  // the user is currently typing with a stale value from a background
  // refresh.
  const didInitMyDetails = useRef(false);
  useEffect(() => {
    if (didInitMyDetails.current) return;
    const mine = members.find((m) => m.email?.toLowerCase() === session.user.email.toLowerCase());
    if (mine) {
      setMyDetailsDraft({ name: mine.name || '', phone: mine.phone || '', location: mine.location || '' });
      didInitMyDetails.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  // These three commit functions deliberately do NOT call loadAll() after a
  // successful save. Doing so previously re-fetched and replaced the whole
  // `members`/`pendingInvites` arrays on every single field blur -- when
  // tabbing quickly through Full name -> Phone -> Location, that refresh
  // (plus the realtime subscription's own echo of the same change) could
  // land mid-keystroke and effectively knock focus out of the field the
  // user was still typing into. Updating local state directly with the
  // exact value just saved keeps the UI in sync instantly with zero risk of
  // a background refresh interrupting typing; the realtime subscription
  // still keeps everything else (other users' edits) in sync in the
  // background.
  async function commitMyDetailsField(field, value) {
    const mine = members.find((m) => m.email?.toLowerCase() === session.user.email.toLowerCase());
    if (!mine) return;
    const cleaned = value.trim() || null;
    const { error } = await supabase.from('household_members').update({ [field]: cleaned }).eq('id', mine.id);
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === mine.id ? { ...m, [field]: cleaned } : m)));
    // Keep the owner-editable Users-table row for this same person in sync
    // too, since it's a separate draft object for the same underlying row --
    // without this, editing "My details" wouldn't show up in the table below
    // until a full page reload.
    setMemberDetailDrafts((prev) => (prev[mine.id] ? { ...prev, [mine.id]: { ...prev[mine.id], [field]: value } } : prev));
  }

  // Lets the owner fill in / fix Name, Phone, Location for anyone else in
  // the household directly from the Users table -- useful since the owner
  // usually already knows this info for family members who haven't filled
  // it in themselves yet. Works for both already-joined members and people
  // who are still only a pending invite.
  //
  // These two effects only ADD entries for members/invites we haven't seen
  // before (or drop ones that were removed) -- they never overwrite an
  // existing draft entry. That matters because `members`/`pendingInvites`
  // change on every single field save (including other rows'), and a full
  // rebuild here would stomp over whatever the owner is mid-typing in a
  // different row with whatever value happens to already be saved.
  const [memberDetailDrafts, setMemberDetailDrafts] = useState({});
  const [inviteDetailDrafts, setInviteDetailDrafts] = useState({});

  useEffect(() => {
    setMemberDetailDrafts((prev) => {
      const next = {};
      members.forEach((m) => {
        next[m.id] = prev[m.id] ?? { name: m.name || '', phone: m.phone || '', location: m.location || '' };
      });
      return next;
    });
  }, [members]);

  useEffect(() => {
    setInviteDetailDrafts((prev) => {
      const next = {};
      pendingInvites.forEach((inv) => {
        next[inv.id] = prev[inv.id] ?? { name: inv.name || '', phone: inv.phone || '', location: inv.location || '' };
      });
      return next;
    });
  }, [pendingInvites]);

  function updateMemberDetailDraft(id, field, value) {
    setMemberDetailDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function commitMemberDetailField(id, field, value) {
    const cleaned = value.trim() || null;
    const { error } = await supabase.from('household_members').update({ [field]: cleaned }).eq('id', id);
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: cleaned } : m)));
    // If the owner just edited their own row from this table, mirror it
    // into "My details" too, for the same reason as above -- one row, two
    // draft objects, both need to agree.
    const edited = members.find((m) => m.id === id);
    if (edited && edited.email?.toLowerCase() === session.user.email.toLowerCase()) {
      setMyDetailsDraft((prev) => ({ ...prev, [field]: value }));
    }
  }

  function updateInviteDetailDraft(id, field, value) {
    setInviteDetailDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function commitInviteDetailField(id, field, value) {
    const cleaned = value.trim() || null;
    const { error } = await supabase.from('household_invites').update({ [field]: cleaned }).eq('id', id);
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    setPendingInvites((prev) => prev.map((inv) => (inv.id === id ? { ...inv, [field]: cleaned } : inv)));
  }

  // isInitial controls whether the full-page "Loading your budget..." spinner
  // shows. It should only ever be true for the very first load on mount --
  // every other call (realtime updates, auto-save refreshes after a field
  // commit) must update state quietly in the background. Toggling loading
  // to true here on every keystroke-driven save was unmounting the whole
  // Dashboard mid-edit, which kicked users out of forms like "My details"
  // as soon as they tabbed from one field to the next.
  async function loadAll(isInitial = false) {
    if (isInitial) setLoading(true);
    const [{ data: cats }, { data: exps }, { data: settings }, { data: recur }, { data: mem }, { data: invites }, { data: inc }, { data: savings }] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', householdId).order('name'),
      // Secondary sort by id is required, not cosmetic -- Postgres doesn't
      // guarantee a stable order for rows that tie on expense_date (very
      // common; several expenses share the same day), so without a
      // tiebreaker the row order could silently shuffle between fetches.
      // That's exactly what made picking a Payment Source then a Bank feel
      // broken: committing the Payment Source triggered a reload, ties
      // re-sorted, and the row the user was mid-selection on jumped to a
      // different position before they could pick the bank.
      supabase.from('expenses').select('*').eq('household_id', householdId).order('expense_date', { ascending: false }).order('id', { ascending: false }),
      supabase.from('settings').select('*').eq('household_id', householdId).maybeSingle(),
      // Same tiebreaker reasoning as expenses above.
      supabase.from('recurring_expenses').select('*').eq('household_id', householdId).order('start_date').order('id'),
      supabase.from('household_members').select('*').eq('household_id', householdId).order('joined_at'),
      supabase.from('household_invites').select('*').eq('household_id', householdId).eq('status', 'pending'),
      supabase.from('incomes').select('*').eq('household_id', householdId).order('start_date').order('id'),
      supabase.from('savings_goals').select('*').eq('household_id', householdId).order('start_date').order('id'),
    ]);
    setCategories(cats || []);
    setExpenses(exps || []);
    const eDrafts = {};
    (exps || []).forEach((e) => {
      eDrafts[e.id] = {
        date: e.expense_date, categoryId: e.category_id, description: e.description || '', amount: String(e.amount),
        paymentSource: e.payment_source || 'Cash', paymentBank: e.payment_bank || '',
      };
    });
    setExpenseDrafts(eDrafts);
    setRecurringExpenses(recur || []);
    setMembers(mem || []);
    setPendingInvites(invites || []);
    setIncomes(inc || []);
    const iDrafts = {};
    (inc || []).forEach((i) => {
      iDrafts[i.id] = { name: i.name, amount: String(i.amount), month: i.start_date.slice(0, 7) };
    });
    setIncomeDrafts(iDrafts);
    setTotalBudget(settings?.total_monthly_budget || 0);
    setTotalBudgetDraft(String(settings?.total_monthly_budget || ''));
    setCurrency(settings?.currency || 'AED');
    setCurrencyDraft(settings?.currency || 'AED');
    const drafts = {};
    const nameDrafts = {};
    (cats || []).forEach((c) => {
      drafts[c.id] = c.monthly_budget ? String(c.monthly_budget) : '';
      nameDrafts[c.id] = c.name;
    });
    setCategoryBudgetDrafts(drafts);
    setCategoryNameDrafts(nameDrafts);
    const rDrafts = {};
    (recur || []).forEach((r) => {
      rDrafts[r.id] = {
        name: r.name,
        categoryId: r.category_id,
        amount: String(r.amount),
        startDate: r.start_date,
        endDate: r.end_date || '',
        frequency: r.frequency || 'monthly',
        dueDate: r.due_date || '',
        paymentSource: r.payment_source || 'Cash',
        paymentBank: r.payment_bank || '',
      };
    });
    setRecurringDrafts(rDrafts);
    setSavingsGoals(savings || []);
    const sDrafts = {};
    (savings || []).forEach((s) => {
      sDrafts[s.id] = {
        name: s.name,
        amount: String(s.amount),
        month: s.start_date.slice(0, 7),
      };
    });
    setSavingsDrafts(sDrafts);
    if (!form.categoryId && cats && cats.length) {
      setForm((f) => ({ ...f, categoryId: cats[0].id }));
    }
    if (!newRecurring.categoryId && cats && cats.length) {
      const emi = cats.find((c) => c.name === 'Loan EMI') || cats[0];
      setNewRecurring((r) => ({ ...r, categoryId: emi.id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll(true);
    // Wrapped in arrow functions so the realtime payload object Supabase
    // passes in isn't mistaken for the isInitial flag (which would re-trigger
    // the full-page spinner on every background change).
    const refresh = () => loadAll();
    const channel = supabase
      .channel('budget-tracker-changes-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_invites', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'savings_goals', filter: `household_id=eq.${householdId}` }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const monthExpenses = useMemo(() => {
    const key = monthKey(currentMonth);
    return expenses.filter((e) => e.expense_date.slice(0, 7) === key);
  }, [expenses, currentMonth]);

  const recurringForMonth = useMemo(() => {
    const key = monthKey(currentMonth);
    return recurringExpenses.filter((r) => recurringOccursInMonth(r, key));
  }, [recurringExpenses, currentMonth]);

  // Savings entered for the currently viewed month -- exact month match, no
  // auto-rollover, same as Income (see newIncome/incomeForMonth above).
  const savingsForMonth = useMemo(() => {
    const key = monthKey(currentMonth);
    return savingsGoals.filter((s) => s.active && s.start_date.slice(0, 7) === key);
  }, [savingsGoals, currentMonth]);
  const savingsTotal = useMemo(() => savingsForMonth.reduce((s, g) => s + Number(g.amount), 0), [savingsForMonth]);

  const categoryNameById = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

  // Maps a household member's login email to their friendly first name (set
  // under Users -> My details), so the "By" column reads "Vipin"/"Annie"
  // instead of a raw email-derived string like "vipinlakhanpal". Falls back
  // to the email's local part if that member hasn't set a name yet.
  const nameByEmail = useMemo(() => {
    const m = {};
    members.forEach((mm) => {
      if (mm.email) m[mm.email.toLowerCase()] = (mm.name || '').trim();
    });
    return m;
  }, [members]);

  function displayNameForEmail(email) {
    if (!email) return '';
    const name = nameByEmail[email.toLowerCase()];
    // First name only ("Vipin", "Annie") -- keeps the "By" column compact,
    // matching how it read before (a single short word) rather than a full name.
    if (name) return name.split(' ')[0];
    return email.split('@')[0];
  }

  const byCategory = useMemo(() => {
    const m = {};
    monthExpenses.forEach((e) => {
      const name = categoryNameById[e.category_id] || 'Uncategorized';
      m[name] = (m[name] || 0) + Number(e.amount);
    });
    recurringForMonth.forEach((r) => {
      const name = categoryNameById[r.category_id] || 'Uncategorized';
      m[name] = (m[name] || 0) + Number(r.amount);
    });
    return m;
  }, [monthExpenses, recurringForMonth, categoryNameById]);

  const oneOffTotal = useMemo(() => monthExpenses.reduce((s, e) => s + Number(e.amount), 0), [monthExpenses]);
  const recurringTotal = useMemo(() => recurringForMonth.reduce((s, r) => s + Number(r.amount), 0), [recurringForMonth]);
  // "total" = actual spending only (one-off + fixed), used for the per-category
  // Pareto/budget-cap checks below since savings goals aren't tied to a category.
  const total = oneOffTotal + recurringTotal;
  // "combinedOutflow" = spending + planned savings. Savings is money leaving
  // your income just like an expense would, so every headline figure the
  // household actually reads (Spent so far, Remaining, Combined expenses, Net)
  // needs to account for it -- otherwise "Remaining"/"Net" would overstate how
  // much is actually free to spend.
  const combinedOutflow = total + savingsTotal;
  const remaining = totalBudget - combinedOutflow;

  const incomeForMonth = useMemo(() => {
    const key = monthKey(currentMonth);
    // Income is entered per month on purpose -- no auto-rollover -- so this is
    // an exact month match rather than a start/end range like expenses.
    return incomes.filter((i) => i.active && i.start_date.slice(0, 7) === key);
  }, [incomes, currentMonth]);
  const totalIncome = useMemo(() => incomeForMonth.reduce((s, i) => s + Number(i.amount), 0), [incomeForMonth]);
  const netCombined = totalIncome - combinedOutflow;

  // Bills/rent due soon -- an in-app pop-up style banner starting N days
  // before the due date (default 3) and continuing to show until the due
  // date itself. Email reminders on the same schedule are a server-side
  // feature (needs a daily cron + mail sender) and aren't wired up yet.
  const dueReminders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recurringExpenses
      .filter((r) => r.active && r.due_date)
      .map((r) => {
        const due = new Date(r.due_date + 'T00:00:00');
        const daysUntil = Math.round((due - today) / 86400000);
        return { ...r, daysUntil };
      })
      .filter((r) => r.daysUntil >= 0 && r.daysUntil <= (r.remind_before_days ?? 3));
  }, [recurringExpenses]);

  const overCategories = useMemo(() => {
    return categories
      .filter((c) => c.monthly_budget > 0 && (byCategory[c.name] || 0) > c.monthly_budget)
      .map((c) => c.name);
  }, [categories, byCategory]);

  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

  // The pie chart specifically (not Bar/Pareto/Treemap) gets capped to its
  // biggest slices with everything else folded into "Other". A pie is the
  // one chart type where every extra category makes EVERY slice harder to
  // read (more slivers competing for the same ring of space), so this is
  // what actually fixes clutter -- shrinking or resizing the chart doesn't,
  // since the underlying problem is too many slices, not too little room.
  const PIE_TOP_N = 6;
  const pieChartData = useMemo(() => {
    if (pieData.length <= PIE_TOP_N) return pieData;
    const sorted = [...pieData].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, PIE_TOP_N);
    const otherTotal = sorted.slice(PIE_TOP_N).reduce((s, d) => s + d.value, 0);
    return otherTotal > 0 ? [...top, { name: 'Other', value: otherTotal }] : top;
  }, [pieData]);

  // Pareto = categories sorted highest-spend-first with a running cumulative
  // percentage line overlaid, so it's easy to see which categories make up
  // the bulk (e.g. 80%) of this month's spending.
  const paretoData = useMemo(() => {
    const sorted = [...pieData].sort((a, b) => b.value - a.value);
    const totalVal = sorted.reduce((s, d) => s + d.value, 0) || 1;
    let cum = 0;
    return sorted.map((d) => {
      cum += d.value;
      return { ...d, cumulative: Math.round((cum / totalVal) * 1000) / 10 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byCategory]);

  // Pareto bar thickness/label size shrink as the category count grows, so
  // every category always fits within the chart's own width -- no horizontal
  // scrolling needed regardless of how many categories exist.
  const paretoBarSize = Math.max(6, Math.min(22, Math.floor(260 / Math.max(paretoData.length, 1))));
  const paretoFontSize = paretoData.length > 14 ? 7 : paretoData.length > 9 ? 8 : 9;
  const paretoMaxNameLen = paretoData.length > 14 ? 6 : paretoData.length > 9 ? 9 : 14;

  // Shared by the one-off expense form and the Fixed Expenses form. Uploads
  // to the private "attachments" Storage bucket under a
  // {household_id}/{table}-{row_id}-{filename} path -- the RLS policies on
  // storage.objects check that the first path segment is a household this
  // signed-in user belongs to (via my_household_ids()), so nobody outside
  // the household can read/write another household's files even though the
  // bucket itself is shared. Runs AFTER the row insert, since the path needs
  // the new row's own id, then patches attachment_url/attachment_name onto
  // that same row.
  async function uploadAttachmentForRow(table, rowId, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${householdId}/${table}-${rowId}-${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadError) {
      alert('Saved, but the attachment could not be uploaded: ' + uploadError.message);
      return;
    }
    const { error: patchError } = await supabase.from(table).update({
      attachment_url: path,
      attachment_name: file.name,
    }).eq('id', rowId);
    if (patchError) {
      alert('Saved, but the attachment could not be linked: ' + patchError.message);
    }
  }

  // The bucket is private, so viewing/downloading a saved attachment needs a
  // short-lived signed URL generated on demand -- the stored attachment_url
  // is just the storage path, never a public link.
  async function viewAttachment(path) {
    if (!path) return;
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      alert('Could not open attachment: ' + (error?.message || 'unknown error'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  function handleAttachmentPick(file, setFileFn) {
    if (!file) return;
    if (!isAllowedAttachment(file)) {
      alert('Attachments must be an image or PDF, 5MB or smaller.');
      return;
    }
    setFileFn(file);
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.categoryId || isNaN(amount) || amount <= 0) {
      alert('Please choose a category and enter a valid amount.');
      return;
    }
    const { data: inserted, error } = await supabase.from('expenses').insert({
      household_id: householdId,
      expense_date: form.date,
      category_id: form.categoryId,
      description: form.description.trim(),
      amount,
      payment_source: form.paymentSource || null,
      payment_bank: form.paymentSource === 'Cash' ? null : (form.paymentBank || null),
      notes: form.notes.trim() || null,
      created_by: session.user.id,
      created_by_email: session.user.email,
    }).select().single();
    if (error) {
      alert('Could not save expense: ' + error.message);
      return;
    }
    if (expenseFile && inserted?.id) {
      await uploadAttachmentForRow('expenses', inserted.id, expenseFile);
    }
    const d = new Date(form.date + 'T00:00:00');
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setForm((f) => ({ ...f, description: '', amount: '', notes: '' }));
    setShowExpenseNotes(false);
    setExpenseFile(null);
    if (expenseFileInputRef.current) expenseFileInputRef.current.value = '';
    loadAll();
  }

  // AI feature #1: ask Claude to pick the best category for what the user
  // just typed, and auto-fill the dropdown if it's confident. Fires once
  // the Description field loses focus. Never throws into the UI -- worst
  // case, nothing gets suggested and the user picks a category as normal.
  async function suggestCategoryFromDescription(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length < 4 || categories.length === 0) return;
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/categorize-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ description: trimmed, categoryNames: categories.map((c) => c.name) }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.categoryName) return;
      const match = categories.find((c) => c.name === json.categoryName);
      if (!match) return;
      setForm((f) => (f.description.trim() === trimmed ? { ...f, categoryId: match.id } : f));
      setAiCategoryHint(`✨ AI-suggested: ${match.name}`);
      setTimeout(() => setAiCategoryHint((h) => (h.includes(match.name) ? '' : h)), 4000);
    } catch {
      // AI suggestion is a nice-to-have -- silently skip on any failure.
    }
  }

  // AI feature #2: build a short, plain-language summary of the currently
  // viewed month (income, spending by category, fixed bills, savings, and
  // whether any category or the overall budget is over) and ask Claude to
  // turn it into a few sentences of insight plus a couple of concrete
  // suggestions. Only runs when the user clicks the button -- never
  // automatically -- since unlike the category auto-fill, this isn't
  // something that should happen silently in the background on every visit.
  async function generateMonthlyDigest() {
    setAiDigestLoading(true);
    setAiDigestError(false);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const categoryBreakdown = Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, amount]) => ({ name, amount }));
      const res = await fetch('/api/monthly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({
          currency: CURRENT_CURRENCY,
          monthLabel: monthLabel(currentMonth),
          totalIncome,
          totalBudget,
          remaining,
          fixedTotal: recurringTotal,
          savingsTotal,
          // The REAL totals, computed from every category -- categoryBreakdown
          // below is capped to the top 8 for a readable prompt, so it must
          // never be summed server-side to derive "total spent" (that was a
          // real bug: it silently dropped every category past the top 8).
          totalSpendExcludingSavings: total,
          totalSpendIncludingSavings: combinedOutflow,
          categoryBreakdown,
          categoryBreakdownIsPartial: pieData.length > categoryBreakdown.length,
          overBudgetCategories: overCategories,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.digest) {
        setAiDigestError(true);
        setAiDigest('');
        return;
      }
      setAiDigest(json.digest);
      setAiDigestMonthKey(monthKey(currentMonth));
    } catch {
      setAiDigestError(true);
      setAiDigest('');
    } finally {
      setAiDigestLoading(false);
    }
  }

  // AI feature #3 helper: shrink and re-encode the uploaded image client-side
  // before it ever leaves the browser. Phone camera photos are routinely
  // 3-4000px and several MB, which risks Vercel's serverless request-body
  // limit and Anthropic's own per-image size guidance -- capping the long
  // edge to 1600px and re-encoding as JPEG keeps the payload small and the
  // request reliable without any visible quality loss for reading text.
  function readFileAsResizedBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not read image'));
        img.onload = () => {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleScanFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be re-picked later if needed
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScanError('Please choose an image file (photo or screenshot of the receipt).');
      return;
    }
    setScanLoading(true);
    setScanError('');
    setScanResults([]);
    try {
      const base64 = await readFileAsResizedBase64(file);
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ imageBase64: base64, categoryNames: categories.map((c) => c.name) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.items || json.items.length === 0) {
        setScanError("Couldn't find any expenses in that image -- try a clearer photo, or enter it manually below.");
        return;
      }
      const rows = json.items.map((item) => {
        const match = categories.find((c) => c.name.toLowerCase() === (item.categoryName || '').toLowerCase());
        return {
          include: true,
          date: item.date || new Date().toISOString().slice(0, 10),
          description: item.description || '',
          amount: item.amount ? String(item.amount) : '',
          categoryId: match ? match.id : (categories[0]?.id || ''),
        };
      });
      setScanResults(rows);
    } catch {
      setScanError("Couldn't read that image -- try again, or enter it manually below.");
    } finally {
      setScanLoading(false);
    }
  }

  function updateScanRow(i, field, value) {
    setScanResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function commitScanResults() {
    const toAdd = scanResults.filter((r) => r.include && r.categoryId && Number(r.amount) > 0 && r.date);
    if (toAdd.length === 0) {
      alert('Select at least one item with a category and a valid amount.');
      return;
    }
    const rows = toAdd.map((r) => ({
      household_id: householdId,
      expense_date: r.date,
      category_id: r.categoryId,
      description: r.description.trim(),
      amount: Number(r.amount),
      created_by: session.user.id,
      created_by_email: session.user.email,
    }));
    const { error } = await supabase.from('expenses').insert(rows);
    if (error) {
      alert('Could not save scanned expenses: ' + error.message);
      return;
    }
    setScanResults([]);
    setScanError('');
    loadAll();
  }

  // Shared by AI feature #4 (chat) and #5 (Budget Coach): a snapshot of one
  // "YYYY-MM" month's actuals, computed the same way the dashboard's own
  // current-month figures are (recurringOccursInMonth, exact-month-match for
  // income/savings) so multi-month numbers handed to either endpoint always
  // agree with what the app itself shows for that month.
  function computeMonthSnapshot(key) {
    const mExp = expenses.filter((e) => e.expense_date.slice(0, 7) === key);
    const mRecur = recurringExpenses.filter((r) => recurringOccursInMonth(r, key));
    const mIncome = incomes.filter((i) => i.active && i.start_date.slice(0, 7) === key);
    const mSavings = savingsGoals.filter((s) => s.active && s.start_date.slice(0, 7) === key);
    const catTotals = {};
    mExp.forEach((e) => {
      const n = categoryNameById[e.category_id] || 'Uncategorized';
      catTotals[n] = (catTotals[n] || 0) + Number(e.amount);
    });
    mRecur.forEach((r) => {
      const n = categoryNameById[r.category_id] || 'Uncategorized';
      catTotals[n] = (catTotals[n] || 0) + Number(r.amount);
    });
    const overBudget = categories
      .filter((c) => c.monthly_budget > 0 && (catTotals[c.name] || 0) > c.monthly_budget)
      .map((c) => c.name);
    const expensesTotal = mExp.reduce((s, e) => s + Number(e.amount), 0) + mRecur.reduce((s, r) => s + Number(r.amount), 0);
    const savingsTotalM = mSavings.reduce((s, g) => s + Number(g.amount), 0);
    // The household's total monthly budget is a single current setting, not
    // stored per-month historically, so this same value is applied to every
    // month here (same simplification the rest of the app already makes).
    // remainingVsBudget is computed here -- not left for the AI to derive --
    // after an earlier bug where the chat assistant told the user they were
    // "not over budget" when they actually were AED 2,112.45 over: it had
    // been asked to compare raw totals itself and got the arithmetic wrong.
    const remainingVsBudget = totalBudget > 0 ? totalBudget - (expensesTotal + savingsTotalM) : null;
    const d = new Date(key + '-01T00:00:00');
    return {
      monthLabel: monthLabel(d),
      income: mIncome.reduce((s, i) => s + Number(i.amount), 0),
      expensesTotal,
      savingsTotal: savingsTotalM,
      categoryTotals: catTotals,
      overBudgetCategories: overBudget,
      remainingVsBudget, // negative = over budget by this amount that month; null = no budget set
    };
  }

  // AI feature #4 needed a fix shortly after shipping: it could only see
  // category-level MONTHLY TOTALS (via computeMonthSnapshot), never the
  // individual expense rows themselves -- so it had no way to answer a
  // question like "what did I spend at Carrefour" or "show me my taxi
  // rides", since a specific description isn't part of a category sum.
  // This returns the actual one-off expense rows (date, description,
  // category, amount) for one "YYYY-MM" month, capped defensively so a
  // very high-transaction-volume household can't blow up the request size.
  function rawExpensesForMonth(key) {
    return expenses
      .filter((e) => e.expense_date.slice(0, 7) === key)
      .slice(0, 200)
      .map((e) => ({
        date: e.expense_date,
        description: e.description || '',
        category: categoryNameById[e.category_id] || 'Uncategorized',
        amount: Number(e.amount),
        // Payment method wasn't being sent at all -- so a question like
        // "what did I spend on my FAB credit card" had no way to be
        // answered correctly; the assistant could only see date/category/
        // amount/description, never which card or account paid for it.
        paymentSource: e.payment_source || 'Cash',
        paymentBank: e.payment_bank || null,
      }));
  }

  function recentMonthSnapshots(count) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
      out.push(computeMonthSnapshot(monthKey(d)));
    }
    return out;
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const newHistory = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const prevMonthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      const context = {
        currency: CURRENT_CURRENCY,
        totalBudget,
        categoryBudgetCaps: categories.map((c) => ({ name: c.name, monthlyCap: c.monthly_budget || null })),
        fixedExpenses: recurringExpenses
          .filter((r) => r.active)
          .map((r) => ({ name: r.name, category: categoryNameById[r.category_id], amount: r.amount, frequency: r.frequency, dueDate: r.due_date || null })),
        savingsGoalsThisMonth: savingsForMonth.map((s) => ({ name: s.name, amount: s.amount })),
        // Individual income line items (not just the combined monthly total
        // already inside recentMonths) -- without this the assistant could
        // say what total income was but not name a single income source,
        // which read as "it can't see the Income tab at all" even though
        // the total itself was correct.
        incomeThisMonth: incomeForMonth.map((i) => ({ source: i.name, member: i.member_email, amount: i.amount })),
        recentMonths: recentMonthSnapshots(3),
        // Individual expense rows (not just category totals) for the
        // current and previous month, so questions about a specific
        // merchant or transaction description can actually be answered.
        transactionsThisMonth: rawExpensesForMonth(monthKey(currentMonth)),
        transactionsPreviousMonth: rawExpensesForMonth(monthKey(prevMonthDate)),
        // Who's in the household -- so "who are the members" or "who added
        // this" type questions can be answered instead of only ever seeing
        // financial numbers. Name/email only (no phone/location) since
        // those aren't relevant to a budget question.
        householdMembers: members.map((m) => ({ name: m.name || m.email.split('@')[0], email: m.email })),
      };
      const res = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ message: text, history: newHistory.slice(0, -1).slice(-10), context }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.reply) {
        setChatMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't answer that just now -- try again in a moment." }]);
        return;
      }
      setChatMessages((prev) => [...prev, { role: 'assistant', content: json.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't answer that just now -- try again in a moment." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function generateBudgetCoach() {
    setCoachLoading(true);
    setCoachError(false);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const context = {
        currency: CURRENT_CURRENCY,
        categoryBudgetCaps: categories.map((c) => ({ name: c.name, monthlyCap: c.monthly_budget || null })),
        months: recentMonthSnapshots(6),
      };
      const res = await fetch('/api/budget-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify(context),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.advice) {
        setCoachError(true);
        setCoachResult('');
        return;
      }
      setCoachResult(json.advice);
    } catch {
      setCoachError(true);
      setCoachResult('');
    } finally {
      setCoachLoading(false);
    }
  }

  async function handleDeleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) alert('Could not delete: ' + error.message);
    loadAll();
  }

  // Expenses this month auto-saves like Fixed monthly expenses -- text/number
  // fields commit on blur, dates/dropdowns commit immediately on change.
  function updateExpenseDraftField(id, field, value) {
    setExpenseDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function commitExpenseField(id, field, value) {
    const merged = { ...(expenseDrafts[id] || {}), [field]: value };
    setExpenseDrafts((prev) => ({ ...prev, [id]: merged }));
    const amount = parseFloat(merged.amount);
    if (!merged.date || isNaN(amount) || amount <= 0) return;
    const { error } = await supabase
      .from('expenses')
      .update({
        expense_date: merged.date,
        category_id: merged.categoryId,
        description: (merged.description || '').trim(),
        amount,
        payment_source: merged.paymentSource || null,
        payment_bank: merged.paymentSource === 'Cash' ? null : (merged.paymentBank || null),
      })
      .eq('id', id);
    if (error) {
      alert('Could not update expense: ' + error.message);
      return;
    }
    loadAll();
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const { error } = await supabase.from('categories').insert({ name, household_id: householdId });
    if (error) {
      alert('Could not add category: ' + error.message);
      return;
    }
    setNewCategoryName('');
    loadAll();
  }

  async function handleRemoveCategory(id, name) {
    const hasExpenses = expenses.some((e) => e.category_id === id);
    if (hasExpenses && !confirm(`"${name}" has expenses logged against it. Remove anyway?`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) alert('Could not remove category: ' + error.message);
    loadAll();
  }

  async function handleRenameCategory(id) {
    const name = (categoryNameDrafts[id] || '').trim();
    const current = categories.find((c) => c.id === id);
    if (!name || (current && name === current.name)) return;
    const { error } = await supabase.from('categories').update({ name }).eq('id', id);
    if (error) {
      alert('Could not rename category: ' + error.message);
      return;
    }
    loadAll();
  }

  // Settings auto-saves field by field (like Income/Fixed Expenses/Savings)
  // instead of a single "Save settings" button -- each field commits on its
  // own blur/change, so nothing is lost if someone edits one field and
  // navigates away without touching the others.
  async function commitTotalBudget(value) {
    const total = parseFloat(value);
    const { error } = await supabase
      .from('settings')
      .update({ total_monthly_budget: isNaN(total) ? 0 : total })
      .eq('household_id', householdId);
    if (error) {
      alert('Could not update total monthly budget: ' + error.message);
      return;
    }
    loadAll();
  }

  async function commitCurrency(value) {
    setCurrencyDraft(value);
    const { error } = await supabase
      .from('settings')
      .update({ currency: value })
      .eq('household_id', householdId);
    if (error) {
      alert('Could not update currency: ' + error.message);
      return;
    }
    loadAll();
  }

  async function commitHouseholdName(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      setHouseholdNameDraft(household.name || '');
      return;
    }
    if (trimmed === household.name) return;
    const { error } = await supabase
      .from('households')
      .update({ name: trimmed })
      .eq('id', householdId);
    if (error) {
      alert('Could not rename household: ' + error.message);
      setHouseholdNameDraft(household.name || '');
      return;
    }
    onHouseholdChange();
  }

  async function commitCategoryBudget(id, value) {
    const val = parseFloat(value);
    const { error } = await supabase
      .from('categories')
      .update({ monthly_budget: isNaN(val) || val <= 0 ? 0 : val })
      .eq('id', id);
    if (error) {
      alert('Could not update category budget: ' + error.message);
      return;
    }
    loadAll();
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleAddRecurring(e) {
    e.preventDefault();
    const amount = parseFloat(newRecurring.amount);
    if (!newRecurring.name.trim() || !newRecurring.categoryId || isNaN(amount) || amount <= 0 || !newRecurring.startDate) {
      alert('Please fill in name, category, amount, and start date.');
      return;
    }
    const { data: inserted, error } = await supabase.from('recurring_expenses').insert({
      household_id: householdId,
      name: newRecurring.name.trim(),
      category_id: newRecurring.categoryId,
      amount,
      start_date: newRecurring.startDate,
      end_date: newRecurring.endDate || null,
      frequency: newRecurring.frequency,
      due_date: newRecurring.dueDate || null,
      payment_source: newRecurring.paymentSource || null,
      payment_bank: CARD_PAYMENT_SOURCES.includes(newRecurring.paymentSource) ? (newRecurring.paymentBank || null) : null,
      notes: newRecurring.notes.trim() || null,
      created_by: session.user.id,
    }).select().single();
    if (error) {
      alert('Could not save fixed expense: ' + error.message);
      return;
    }
    if (recurringFile && inserted?.id) {
      await uploadAttachmentForRow('recurring_expenses', inserted.id, recurringFile);
    }
    setNewRecurring((r) => ({ ...r, name: '', amount: '', endDate: '', dueDate: '', notes: '' }));
    setShowRecurringNotes(false);
    setRecurringFile(null);
    if (recurringFileInputRef.current) recurringFileInputRef.current.value = '';
    loadAll();
  }

  // Every field in the Fixed monthly expenses table auto-saves -- there's no
  // separate "Save" button. Text/number fields (name, amount) save on blur
  // (once you're done typing); dates/dropdowns save immediately on change
  // since those only fire once a value is actually picked.
  function updateRecurringDraftField(id, field, value) {
    setRecurringDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function commitRecurringField(id, field, value) {
    const merged = { ...(recurringDrafts[id] || {}), [field]: value };
    setRecurringDrafts((prev) => ({ ...prev, [id]: merged }));
    if (!merged.name?.trim() || !merged.startDate) return;
    const amount = parseFloat(merged.amount);
    const { error } = await supabase
      .from('recurring_expenses')
      .update({
        name: merged.name.trim(),
        category_id: merged.categoryId,
        amount: isNaN(amount) ? 0 : amount,
        start_date: merged.startDate,
        end_date: merged.endDate || null,
        frequency: merged.frequency || 'monthly',
        due_date: merged.dueDate || null,
        payment_source: merged.paymentSource || null,
        payment_bank: CARD_PAYMENT_SOURCES.includes(merged.paymentSource) ? (merged.paymentBank || null) : null,
      })
      .eq('id', id);
    if (error) alert('Could not update: ' + error.message);
    loadAll();
  }

  async function handleDeleteRecurring(id, name) {
    if (!confirm(`Remove "${name}" completely (including past months)? To just stop it going forward, set an end month instead and click Save.`)) return;
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id);
    if (error) alert('Could not remove: ' + error.message);
    loadAll();
  }

  async function handleAddSaving(e) {
    e.preventDefault();
    const amount = parseFloat(newSaving.amount);
    if (!newSaving.name.trim() || isNaN(amount) || amount <= 0 || !newSaving.month) {
      alert('Please fill in a name, amount, and month.');
      return;
    }
    const { error } = await supabase.from('savings_goals').insert({
      household_id: householdId,
      name: newSaving.name.trim(),
      amount,
      start_date: newSaving.month + '-01',
      end_date: null,
      created_by: session.user.id,
    });
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    setNewSaving((s) => ({ ...s, name: '', amount: '' }));
    loadAll();
  }

  // Savings rows auto-save like Income -- text/number fields commit on blur,
  // the Month field commits immediately on change. No Save button, and no
  // frequency/end date -- entered fresh each month on purpose (see the
  // comment on savingsGoals above).
  function updateSavingDraftField(id, field, value) {
    setSavingsDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function commitSavingField(id, field, value) {
    const merged = { ...(savingsDrafts[id] || {}), [field]: value };
    setSavingsDrafts((prev) => ({ ...prev, [id]: merged }));
    if (!merged.name?.trim() || !merged.month) return;
    const amount = parseFloat(merged.amount);
    const { error } = await supabase
      .from('savings_goals')
      .update({
        name: merged.name.trim(),
        amount: isNaN(amount) ? 0 : amount,
        start_date: merged.month + '-01',
        end_date: null,
      })
      .eq('id', id);
    if (error) {
      alert('Could not update: ' + error.message);
      return;
    }
    setSavingsGoals((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, name: merged.name.trim(), amount: isNaN(amount) ? 0 : amount, start_date: merged.month + '-01', end_date: null }
          : s
      )
    );
  }

  async function handleDeleteSaving(id, name) {
    if (!confirm(`Remove the savings goal "${name}"?`)) return;
    const { error } = await supabase.from('savings_goals').delete().eq('id', id);
    if (error) {
      alert('Could not remove: ' + error.message);
      return;
    }
    setSavingsGoals((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    // Free-tier cap: owner + 2 additional people per household. Pending
    // (not-yet-accepted) invites count toward the cap too -- otherwise an
    // owner could stack up unlimited pending invites and get more than 2
    // extra people the moment they all sign up.
    const additionalCount = Math.max(0, members.length - 1) + pendingInvites.length;
    if (additionalCount >= MAX_ADDITIONAL_USERS) {
      setInviteStatus('limit-reached');
      return;
    }
    setInviteStatus('sending');
    const { data: existing } = await supabase
      .from('household_invites')
      .select('id')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .ilike('email', email)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('household_invites').insert({
        household_id: householdId,
        email,
        relation: inviteRelation,
        invited_by: session.user.id,
      });
      if (error) {
        setInviteStatus('');
        alert('Could not create invite: ' + error.message);
        return;
      }
    }
    setInviteEmail('');

    // The invite itself (the household_invites row) is what actually lets
    // this person auto-join when they sign up -- that part always works
    // regardless of what happens below. This email is just a courtesy
    // notification over the same free Gmail infra as reports/reminders, so
    // its failure (e.g. GMAIL_USER/GMAIL_APP_PASSWORD not configured yet)
    // shouldn't be reported as the invite itself failing.
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ to: email, householdName: household.name }),
      });
      if (res.ok) {
        setInviteStatus('sent');
      } else {
        const json = await res.json().catch(() => ({}));
        setInviteStatus('sent-no-email: ' + (json.error || 'email not sent'));
      }
    } catch {
      setInviteStatus('sent-no-email: could not reach email service');
    }
    loadAll();
  }

  async function handleCancelInvite(id) {
    const { error } = await supabase.from('household_invites').delete().eq('id', id);
    if (error) alert('Could not cancel invite: ' + error.message);
    loadAll();
  }

  async function handleUpdateMemberRelation(memberId, relation) {
    const { error } = await supabase.from('household_members').update({ relation }).eq('id', memberId);
    if (error) alert('Could not update relation: ' + error.message);
    loadAll();
  }

  async function handleAddIncome(e) {
    e.preventDefault();
    const amount = parseFloat(newIncome.amount);
    if (!newIncome.name.trim() || isNaN(amount) || amount <= 0 || !newIncome.month) {
      alert('Please fill in a name, amount, and month.');
      return;
    }
    const { error } = await supabase.from('incomes').insert({
      household_id: householdId,
      name: newIncome.name.trim(),
      member_email: newIncome.memberEmail,
      amount,
      start_date: newIncome.month + '-01',
      end_date: null,
      created_by: session.user.id,
    });
    if (error) {
      alert('Could not save income: ' + error.message);
      return;
    }
    setNewIncome((i) => ({ ...i, name: '', amount: '' }));
    loadAll();
  }

  // Income rows auto-save like Fixed Expenses -- text/number fields commit on
  // blur, the Month field commits immediately on change. No Save button.
  function updateIncomeDraftField(id, field, value) {
    setIncomeDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function commitIncomeField(id, field, value) {
    const merged = { ...(incomeDrafts[id] || {}), [field]: value };
    setIncomeDrafts((prev) => ({ ...prev, [id]: merged }));
    if (!merged.name?.trim() || !merged.month) return;
    const amount = parseFloat(merged.amount);
    const { error } = await supabase
      .from('incomes')
      .update({
        name: merged.name.trim(),
        amount: isNaN(amount) ? 0 : amount,
        start_date: merged.month + '-01',
        end_date: null,
      })
      .eq('id', id);
    if (error) alert('Could not update: ' + error.message);
    loadAll();
  }

  async function handleDeleteIncome(id, name) {
    if (!confirm(`Remove "${name}"?`)) return;
    const { error } = await supabase.from('incomes').delete().eq('id', id);
    if (error) alert('Could not remove: ' + error.message);
    loadAll();
  }

  // Builds a jsPDF document covering Expenses / Income / Fixed Expenses for
  // the chosen date range. Returns the doc plus a filename and a human
  // range label, so the caller can either save it locally or hand it off
  // to the email endpoint as a base64 attachment.
  function buildReportPdf(from, to) {
    const rangeLabel = `${fmtDate(from)} - ${fmtDate(to)}`;
    const rangeExpenses = expenses.filter((e) => e.expense_date >= from && e.expense_date <= to);
    const fromMonth = from.slice(0, 7);
    const toMonth = to.slice(0, 7);
    const rangeIncomes = incomes.filter((i) => i.active && i.start_date.slice(0, 7) >= fromMonth && i.start_date.slice(0, 7) <= toMonth);

    // Fixed Expenses are recurring, so a date range spanning more than one
    // month can include multiple occurrences of the same bill (e.g. two
    // months of rent). Walk every month in the range and include one row
    // per month a recurring expense actually falls due, using the same
    // frequency logic as the dashboard -- this is what makes the total
    // complete instead of only counting each bill once regardless of range.
    const rangeMonths = monthsBetween(from, to);
    const rangeRecurringOccurrences = [];
    rangeMonths.forEach((mKey) => {
      recurringExpenses.forEach((r) => {
        if (recurringOccursInMonth(r, mKey)) {
          rangeRecurringOccurrences.push({ ...r, occurredMonth: mKey });
        }
      });
    });

    // Savings is entered per month on purpose (no auto-rollover, same as
    // Income) -- so a goal only counts toward the months it was actually
    // entered for, via an exact month-range match rather than a recurrence
    // walk. "occurredMonth" is kept on each row so the rest of this page's
    // sorting/grouping logic below doesn't need to change.
    const rangeSavingsOccurrences = savingsGoals
      .filter((s) => s.active && s.start_date.slice(0, 7) >= fromMonth && s.start_date.slice(0, 7) <= toMonth)
      .map((s) => ({ ...s, occurredMonth: s.start_date.slice(0, 7) }));

    const expenseTotal = rangeExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const incomeTotal = rangeIncomes.reduce((s, i) => s + Number(i.amount), 0);
    const fixedTotal = rangeRecurringOccurrences.reduce((s, r) => s + Number(r.amount), 0);
    const savingsGoalTotal = rangeSavingsOccurrences.reduce((s, g) => s + Number(g.amount), 0);

    // Combined Regular + Fixed spend per category, used by the bar chart.
    const categoryTotals = {};
    rangeExpenses.forEach((e) => {
      const name = categoryNameById[e.category_id] || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0) + Number(e.amount);
    });
    rangeRecurringOccurrences.forEach((r) => {
      const name = categoryNameById[r.category_id] || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0) + Number(r.amount);
    });
    const chartRows = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const M = 18; // outer margin -- a bit more generous than the previous 14mm for a cleaner, more modern feel.
    const [accentR, accentG, accentB] = hexToRgb('#0d9488');
    // Savings is money leaving income just like an expense, so it's folded
    // into the net figure -- mirrors how the dashboard's "Net (income -
    // expenses - savings)" card is calculated.
    const netTotal = incomeTotal - expenseTotal - fixedTotal - savingsGoalTotal;
    const today = fmtDate(new Date().toISOString().slice(0, 10));

    // Repeated on every page: a slim teal header band with the household
    // name + a per-page "chapter" label (e.g. "01 / Overview"), so each
    // page reads like a section of one cohesively designed report rather
    // than a plain stapled-together printout. The page number is read
    // straight off the document (doc.internal.getNumberOfPages()) instead
    // of being passed in and hardcoded at each call site -- that matters now
    // that the Category Breakdown chart and Summary can land on either one
    // shared page or two separate pages depending on how many expense
    // categories there are, which shifts every page number after it.
    function drawHeader(sectionLabel) {
      const pageNum = doc.internal.getNumberOfPages();
      doc.setFillColor(accentR, accentG, accentB);
      doc.rect(0, 0, pageWidth, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(14);
      doc.text(household.name || 'Hearth', M, 11);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8.5);
      doc.text(`Budget Report -- ${rangeLabel}`, M, 18);
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text(`0${pageNum} / ${sectionLabel}`, pageWidth - M, 11, { align: 'right' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7.5);
      doc.text(`Generated ${today}`, pageWidth - M, 18, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      return 38;
    }

    // Small uppercase "eyebrow" label above a section title -- a common
    // modern-report typographic touch that adds visual hierarchy without
    // extra clutter.
    function drawEyebrow(text, y) {
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(accentR, accentG, accentB);
      doc.text(text.toUpperCase(), M, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
    }

    const tableDefaults = {
      styles: { fontSize: 9, cellPadding: 3, lineColor: [230, 234, 238], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 250, 251] },
      margin: { left: M, right: M },
    };

    // Automatically solves for the largest font size/cell padding that still
    // lets this table's rows fit within the space actually left on the page
    // (from startY down to bottomLimit). If the row count is small, that
    // works out to the roomy default size. If it's large enough that even
    // the readability floor (7pt) wouldn't fit everything on one page, the
    // floor size is used anyway and the table is simply left to flow onto a
    // second page (autoTable does this automatically) -- shrinking further
    // than 7pt would make the text illegible on screen, in print, and
    // especially on a phone, so that's the one thing this won't sacrifice.
    function autoFitTableStyles(rowCount, startY, bottomLimit = 272) {
      const maxFont = 9.5, minFont = 7;
      const maxPad = 3, minPad = 1;
      const extraRows = 2; // header + footer row, approximated as normal rows
      const rowHeight = (fontSize, cellPadding) => fontSize * 0.3528 + 2 * cellPadding + 1;
      const maxRowHeight = rowHeight(maxFont, maxPad);
      const minRowHeight = rowHeight(minFont, minPad);
      const availableHeight = Math.max(bottomLimit - startY, minRowHeight);
      const targetRowHeight = availableHeight / Math.max(rowCount + extraRows, 1);
      if (targetRowHeight >= maxRowHeight) return { fontSize: maxFont, cellPadding: maxPad };
      if (targetRowHeight <= minRowHeight) return { fontSize: minFont, cellPadding: minPad };
      const t = (targetRowHeight - minRowHeight) / (maxRowHeight - minRowHeight);
      return {
        fontSize: Math.round((minFont + t * (maxFont - minFont)) * 10) / 10,
        cellPadding: Math.round((minPad + t * (maxPad - minPad)) * 10) / 10,
      };
    }

    // ---------- Category Breakdown -- bar chart, plus Summary if it fits ----------
    // The bar chart and the Summary table share one page by default (there's
    // usually plenty of room below a chart of a normal household's category
    // list). Once the chart itself runs long enough to fill most of the
    // page -- more categories than usual -- Summary automatically moves to
    // its own fresh page instead of being squeezed in underneath or
    // overlapping the footer. Either way, every section after this one still
    // gets its own dedicated page.
    let y = drawHeader('Category Breakdown');

    drawEyebrow('Spending Breakdown', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Expenses by Category', M, y);
    doc.setFont(undefined, 'normal');
    y += 9;

    if (chartRows.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No expenses in this period.', M, y);
      doc.setTextColor(0);
    } else {
      const maxVal = Math.max(...chartRows.map(([, v]) => v)) || 1;
      const labelX = M;
      const barX = M + 48;
      const barMaxWidth = pageWidth - barX - M - 26;
      // Capped low (5.5) rather than growing to fill whatever space is left
      // on the page -- with only a handful of categories this used to
      // stretch the chart tall to use up the full page; it now stays
      // compact regardless of category count, and only shrinks further
      // (down to the 2.6 floor) once there are enough categories that it
      // would otherwise overflow.
      const usableHeight = 258 - y;
      const rowUnit = Math.min(5.5, Math.max(3, usableHeight / chartRows.length));
      const barHeight = Math.max(2, rowUnit * 0.63);
      const rowGap = Math.max(0.9, rowUnit * 0.37);
      // Readability comes first here: label size only drops a little even
      // for a long category list, rather than shrinking down to a size
      // that's hard to read on screen, in print, or on a phone.
      const labelFontSize = chartRows.length > 30 ? 7.5 : chartRows.length > 18 ? 8.5 : 9.5;
      const labelMaxLen = chartRows.length > 30 ? 12 : chartRows.length > 18 ? 15 : 19;
      chartRows.forEach(([name, val], i) => {
        // Shrinking only goes so far before bars get unreadably thin -- once
        // an extreme number of categories exists (well beyond a typical
        // household's list), spill onto a fresh page instead of drawing
        // past the bottom margin.
        if (y > 268) { doc.addPage(); y = drawHeader('Category Breakdown'); }
        const barWidth = Math.max(1, (val / maxVal) * barMaxWidth);
        const [r, g, b] = hexToRgb(COLORS[i % COLORS.length]);
        doc.setFillColor(245, 246, 248);
        doc.roundedRect(barX, y, barMaxWidth, barHeight, 1, 1, 'F');
        doc.setFillColor(r, g, b);
        doc.roundedRect(barX, y, barWidth, barHeight, 1, 1, 'F');
        doc.setFontSize(labelFontSize);
        doc.setTextColor(50);
        const label = name.length > labelMaxLen ? name.slice(0, labelMaxLen) + '...' : name;
        const textY = y + barHeight - Math.min(1.3, barHeight * 0.3);
        doc.text(label, labelX, textY);
        doc.setFont(undefined, 'bold');
        doc.text(fmt(val), barX + barMaxWidth + 3, textY);
        doc.setFont(undefined, 'normal');
        y += barHeight + rowGap;
      });
    }

    // ---------- Summary -- "At A Glance" totals ----------
    // The Summary table needs roughly 90mm (eyebrow + title + its 6 rows).
    // If that doesn't comfortably fit below wherever the bar chart ended,
    // give Summary its own fresh page instead of squeezing it in or letting
    // it run into the footer; otherwise it continues right below the chart
    // on the same page.
    const SUMMARY_BLOCK_HEIGHT = 90;
    if (y + SUMMARY_BLOCK_HEIGHT > 262) {
      doc.addPage();
      y = drawHeader('Summary');
    } else {
      y += 12;
    }

    drawEyebrow('At A Glance', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', M, y);
    doc.setFont(undefined, 'normal');
    y += 4;
    autoTable(doc, {
      startY: y,
      body: [
        ['Total Income', fmt(incomeTotal)],
        ['Total Regular Expenses', fmt(expenseTotal)],
        ['Total Fixed Expenses', fmt(fixedTotal)],
        ['Total Savings', fmt(savingsGoalTotal)],
        ['Total Outflow (Expenses + Savings)', fmt(expenseTotal + fixedTotal + savingsGoalTotal)],
        ['Net (Income - Total Outflow)', fmt(netTotal)],
      ],
      theme: 'plain',
      styles: { fontSize: 10.5, fontStyle: 'bold', cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.row.index === 4) {
          data.cell.styles.fillColor = [241, 245, 249];
        }
        if (data.row.index === 5) {
          data.cell.styles.fillColor = netTotal >= 0 ? [220, 252, 231] : [254, 226, 226];
          data.cell.styles.textColor = netTotal >= 0 ? [22, 101, 52] : [153, 27, 27];
        }
      },
    });

    // ---------- Income ----------
    // Income and Expenses each get their own dedicated page (previously
    // they shared one page, which -- combined with the bar chart on page 1
    // already showing per-category expense totals -- made it look like
    // expenses were being shown twice across two pages).
    doc.addPage();
    y = drawHeader('Income');

    drawEyebrow('Money In', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Income', M, y);
    doc.setFont(undefined, 'normal');
    y += 4;
    autoTable(doc, {
      ...tableDefaults,
      styles: { ...tableDefaults.styles, ...autoFitTableStyles(rangeIncomes.length, y) },
      startY: y,
      head: [['Month', 'Source', 'Amount']],
      body: rangeIncomes.map((i) => [i.start_date.slice(0, 7), i.name, fmt(i.amount)]),
      foot: [['', 'Total', fmt(incomeTotal)]],
      headStyles: { fillColor: [14, 165, 233] },
      footStyles: { fillColor: [226, 240, 250], textColor: [15, 42, 46], fontStyle: 'bold' },
    });

    // ---------- Expenses ----------
    doc.addPage();
    y = drawHeader('Expenses');

    drawEyebrow('Money Out', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Expenses', M, y);
    doc.setFont(undefined, 'normal');
    y += 4;
    autoTable(doc, {
      ...tableDefaults,
      styles: { ...tableDefaults.styles, ...autoFitTableStyles(rangeExpenses.length, y) },
      startY: y,
      head: [['Date', 'Category', 'Description', 'Amount']],
      body: rangeExpenses.map((e) => [fmtDate(e.expense_date), categoryNameById[e.category_id] || 'Uncategorized', e.description || '', fmt(e.amount)]),
      foot: [['', '', 'Total', fmt(expenseTotal)]],
      headStyles: { fillColor: [249, 115, 22] },
      footStyles: { fillColor: [253, 237, 224], textColor: [15, 42, 46], fontStyle: 'bold' },
    });

    // ---------- Fixed Expenses ----------
    doc.addPage();
    y = drawHeader('Fixed Expenses');

    drawEyebrow('Recurring Bills', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Fixed Expenses', M, y);
    doc.setFont(undefined, 'normal');
    y += 4;
    if (rangeRecurringOccurrences.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No fixed expenses due in this period.', M, y);
      doc.setTextColor(0);
    } else {
      autoTable(doc, {
        ...tableDefaults,
        styles: { ...tableDefaults.styles, ...autoFitTableStyles(rangeRecurringOccurrences.length, y) },
        startY: y,
        head: [['Name', 'Category', 'Frequency', 'Month Due', 'Amount']],
        body: rangeRecurringOccurrences
          .sort((a, b) => (a.occurredMonth < b.occurredMonth ? -1 : a.occurredMonth > b.occurredMonth ? 1 : a.name.localeCompare(b.name)))
          .map((r) => [
            r.name,
            categoryNameById[r.category_id] || 'Uncategorized',
            (FREQUENCIES.find((f) => f.value === r.frequency) || {}).label || r.frequency,
            r.occurredMonth,
            fmt(r.amount),
          ]),
        foot: [['', '', '', 'Total', fmt(fixedTotal)]],
        headStyles: { fillColor: [168, 85, 247] },
        footStyles: { fillColor: [240, 229, 250], textColor: [15, 42, 46], fontStyle: 'bold' },
      });
    }

    // ---------- Savings -- month-wise, with a total ----------
    // Mirrors the Fixed Expenses page above but for planned savings: one row
    // per month a savings goal is active within the selected range, plus a
    // running total, so the household can see how much they've committed to
    // (or actually set aside) across the whole period at a glance.
    doc.addPage();
    y = drawHeader('Savings');

    drawEyebrow('Money Set Aside', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Savings by Month', M, y);
    doc.setFont(undefined, 'normal');
    y += 4;
    if (rangeSavingsOccurrences.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No savings goals set for this period. Add one from the Savings tab.', M, y);
      doc.setTextColor(0);
      y += 10;
    } else {
      autoTable(doc, {
        ...tableDefaults,
        styles: { ...tableDefaults.styles, ...autoFitTableStyles(rangeSavingsOccurrences.length, y) },
        startY: y,
        head: [['Month', 'Savings Goal', 'Amount']],
        body: rangeSavingsOccurrences
          .sort((a, b) => (a.occurredMonth < b.occurredMonth ? -1 : a.occurredMonth > b.occurredMonth ? 1 : a.name.localeCompare(b.name)))
          .map((s) => [s.occurredMonth, s.name, fmt(s.amount)]),
        foot: [['', 'Total Savings', fmt(savingsGoalTotal)]],
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fillColor: [220, 252, 231], textColor: [15, 42, 46], fontStyle: 'bold' },
      });
      y = doc.lastAutoTable.finalY + 12;
    }

    // A quick month-by-month summary total makes it easy to see at a glance
    // how savings build up across the range, not just the grand total.
    if (rangeMonths.length > 1 && rangeSavingsOccurrences.length > 0) {
      if (y > 250) { doc.addPage(); y = drawHeader('Savings'); }
      drawEyebrow('Month By Month', y);
      y += 7;
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.text('Total Saved Per Month', M, y);
      doc.setFont(undefined, 'normal');
      y += 4;
      const perMonth = {};
      rangeSavingsOccurrences.forEach((s) => {
        perMonth[s.occurredMonth] = (perMonth[s.occurredMonth] || 0) + Number(s.amount);
      });
      autoTable(doc, {
        ...tableDefaults,
        styles: { ...tableDefaults.styles, ...autoFitTableStyles(rangeMonths.length, y) },
        startY: y,
        head: [['Month', 'Total Saved']],
        body: rangeMonths.map((mKey) => [mKey, fmt(perMonth[mKey] || 0)]),
        foot: [['Total', fmt(savingsGoalTotal)]],
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fillColor: [220, 252, 231], textColor: [15, 42, 46], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' } },
      });
    }

    // ---------- Spend Analysis -- Pareto chart (own dedicated page) ----------
    // The same category totals as the Category Breakdown bar chart, but
    // sorted and annotated with a running cumulative-% so it's obvious which
    // categories are the "vital few" driving most of the spend (the 80/20
    // rule). Recommendations get their own page right after this one, rather
    // than sharing this page, so both the chart and the write-up each get
    // room to breathe.
    doc.addPage();
    y = drawHeader('Spend Analysis');

    drawEyebrow('80/20 Breakdown', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Pareto Chart -- Where Your Money Goes', M, y);
    doc.setFont(undefined, 'normal');
    y += 9;

    const totalSpend = chartRows.reduce((s, [, v]) => s + v, 0);
    let vitalFewNames = [];

    if (chartRows.length === 0 || totalSpend <= 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No expenses in this period.', M, y);
      doc.setTextColor(0);
      y += 10;
    } else {
      let cum = 0;
      const paretoRows = chartRows.map(([name, val]) => {
        cum += val;
        return { name, val, cumPct: (cum / totalSpend) * 100 };
      });
      vitalFewNames = paretoRows.filter((r) => r.cumPct <= 80).map((r) => r.name);
      // Always call out at least the single biggest category, even if it
      // alone already exceeds 80% (the filter above would otherwise return
      // an empty "vital few" list in that case).
      if (vitalFewNames.length === 0 && paretoRows.length) vitalFewNames = [paretoRows[0].name];

      const maxVal = Math.max(...paretoRows.map((r) => r.val)) || 1;
      const labelX = M;
      const barX = M + 48;
      // Two separate right-aligned columns -- Amount and Cumulative % -- each
      // with a fixed x position and enough width for their longest possible
      // value ("AED 12,880.00" / "100%"). Previously the amount was drawn
      // left-anchored right after the bar while the cumulative % was pinned
      // to a fixed position near the margin, so a long amount could run
      // straight into the percentage text. Reserving a dedicated column for
      // each (with a gap between them) keeps them from ever colliding
      // regardless of value length.
      const cumX = pageWidth - M; // right edge of the Cumulative % column
      const cumColWidth = 22; // wide enough for "CUM. %" header + "100%"
      const amtX = cumX - cumColWidth; // right edge of the Amount column
      const amtColWidth = 30; // wide enough for "AED 12,880.00"
      const barMaxWidth = amtX - amtColWidth - barX;
      // Capped low (6) rather than growing to fill whatever space is left on
      // the page -- with few categories this used to stretch the chart tall
      // to use up the page; it now stays compact regardless of category
      // count, freeing up room on this page for the total row, suggestions,
      // and the privacy disclaimer below. Row height/label size still shrink
      // further (down to the 3 floor) once there are enough categories that
      // it would otherwise overflow, and everything drawn after the bars --
      // the total row, the vital-few sentence, the Recommendations heading,
      // and each suggestion -- checks the remaining space and starts a
      // fresh page instead of running into the footer.
      const usableHeight = 228 - y;
      const rowUnit = Math.min(6, Math.max(3.4, usableHeight / paretoRows.length));
      const barHeight = Math.max(2.2, rowUnit * 0.6);
      const rowGap = Math.max(1, rowUnit * 0.4);
      // Readability comes first here too -- see the matching note on the
      // page 1 bar chart above.
      const labelFontSize = paretoRows.length > 24 ? 7.5 : paretoRows.length > 14 ? 8.5 : 9.5;
      const labelMaxLen = paretoRows.length > 24 ? 9 : paretoRows.length > 14 ? 12 : 15;
      doc.setFontSize(7.8);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(140);
      doc.text('AMOUNT', amtX, y - 3, { align: 'right' });
      doc.text('CUM. %', cumX, y - 3, { align: 'right' });
      doc.setTextColor(0);
      doc.setFont(undefined, 'normal');
      paretoRows.forEach((r, i) => {
        // Same extreme-case safeguard as the page 1 bar chart: once shrinking
        // hits its readable floor, spill onto a fresh page rather than
        // drawing past the bottom margin.
        if (y > 262) { doc.addPage(); y = drawHeader('Spend Analysis'); }
        const isVitalFew = r.cumPct <= 80 || i === 0;
        const barWidth = Math.max(1, (r.val / maxVal) * barMaxWidth);
        const [vr, vg, vb] = hexToRgb('#0d9488');
        const [tr, tg, tb] = hexToRgb('#94a3b8');
        doc.setFillColor(245, 246, 248);
        doc.roundedRect(barX, y, barMaxWidth, barHeight, 1, 1, 'F');
        if (isVitalFew) doc.setFillColor(vr, vg, vb); else doc.setFillColor(tr, tg, tb);
        doc.roundedRect(barX, y, barWidth, barHeight, 1, 1, 'F');
        doc.setFontSize(labelFontSize);
        doc.setTextColor(50);
        const label = r.name.length > labelMaxLen ? r.name.slice(0, labelMaxLen) + '...' : r.name;
        const textY = y + barHeight - Math.min(1.3, barHeight * 0.3);
        doc.text(label, labelX, textY);
        doc.setFont(undefined, 'bold');
        doc.text(fmt(r.val), amtX, textY, { align: 'right' });
        doc.setTextColor(isVitalFew ? accentR : 150, isVitalFew ? accentG : 150, isVitalFew ? accentB : 150);
        doc.text(`${Math.round(r.cumPct)}%`, cumX, textY, { align: 'right' });
        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        y += barHeight + rowGap;
      });

      // Total row -- a divider plus the grand total of every figure in the
      // chart above, so the reader doesn't have to add up each bar by hand.
      // Checked against remaining space first so it can never land on top of
      // the page footer.
      if (y > 262) { doc.addPage(); y = drawHeader('Spend Analysis'); }
      doc.setDrawColor(220, 224, 228);
      doc.line(barX, y, cumX, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('TOTAL', labelX, y);
      doc.text(fmt(totalSpend), amtX, y, { align: 'right' });
      doc.text('100%', cumX, y, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 10;

      if (y > 262) { doc.addPage(); y = drawHeader('Spend Analysis'); }
      doc.setFontSize(8);
      doc.setTextColor(120);
      const vitalFewLabel = vitalFewNames.length > 1
        ? `${vitalFewNames.slice(0, -1).join(', ')} and ${vitalFewNames[vitalFewNames.length - 1]}`
        : (vitalFewNames[0] || '');
      const vitalFewLines = doc.splitTextToSize(
        `${vitalFewNames.length} of ${paretoRows.length} categories (${vitalFewLabel}) make up about 80% of this period's spending.`,
        pageWidth - 2 * M
      );
      doc.text(vitalFewLines, M, y);
      doc.setTextColor(0);
      y += vitalFewLines.length * 5 + 9;
    }

    // ---------- Recommendations -- own dedicated page ----------
    // Generated from this report's own numbers. Always starts on a fresh
    // page rather than sharing the Pareto chart's page, so both get room to
    // breathe and every section of the report keeps to its own page.
    doc.addPage();
    y = drawHeader('Recommendations');

    drawEyebrow('Recommendations', y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Where You Can Bring In Controls', M, y);
    doc.setFont(undefined, 'normal');
    y += 8;

    const suggestions = [];
    if (chartRows.length && totalSpend > 0) {
      const [topName, topVal] = chartRows[0];
      const topShare = Math.round((topVal / totalSpend) * 100);
      suggestions.push(
        `${topName} is your single biggest spend at ${fmt(topVal)} (${topShare}% of total). Even a small cut here moves the needle more than trimming several small categories.`
      );
      if (vitalFewNames.length) {
        suggestions.push(
          `Focus review time on ${vitalFewNames.length === 1 ? 'this one category' : `these ${vitalFewNames.length} categories`} first -- they drive 80% of your spending, so that's where controls will have the most impact (the 80/20 rule).`
        );
      }
    }
    if (fixedTotal > expenseTotal && fixedTotal > 0) {
      suggestions.push(
        `Fixed/recurring bills (${fmt(fixedTotal)}) are larger than your regular day-to-day spending (${fmt(expenseTotal)}). Review loans, EMIs, and subscriptions for refinancing, consolidation, or cancellation opportunities -- fixed costs compound every month whether or not you notice them.`
      );
    }
    const overBudgetInRange = categories.filter((c) => c.monthly_budget > 0 && (categoryTotals[c.name] || 0) > c.monthly_budget * Math.max(1, rangeMonths.length));
    if (overBudgetInRange.length) {
      suggestions.push(
        `${overBudgetInRange.map((c) => c.name).join(', ')} went over the budget you set for ${overBudgetInRange.length > 1 ? 'them' : 'it'} this period. Consider raising the budget if it's genuinely necessary, or setting a firmer cap if it's discretionary.`
      );
    }
    if (netTotal < 0) {
      suggestions.push(
        `You spent ${fmt(Math.abs(netTotal))} more than you earned this period. Before cutting anywhere else, check whether this was a one-off (e.g. an annual bill or a big-ticket purchase) or a pattern -- if it repeats, it's worth revisiting the top categories above.`
      );
    } else if (totalSpend > 0) {
      suggestions.push(
        `You stayed within income this period (net ${fmt(netTotal)}). Consider directing part of that surplus toward paying down the highest-interest EMI or loan faster, or into savings.`
      );
    }
    if (suggestions.length === 0) {
      suggestions.push('Not enough data in this period to generate suggestions -- add a few more expenses and generate the report again.');
    }

    suggestions.forEach((s) => {
      if (y > 260) { doc.addPage(); y = drawHeader('Recommendations'); }
      doc.setFillColor(accentR, accentG, accentB);
      doc.circle(M + 1.2, y - 1.5, 1.2, 'F');
      doc.setFontSize(9.5);
      doc.setTextColor(40);
      const lines = doc.splitTextToSize(s, pageWidth - 2 * M - 8);
      doc.text(lines, M + 6, y);
      doc.setTextColor(0);
      y += lines.length * 5 + 6;
    });

    // ---------- Data & privacy disclaimer -- always at the very end ----------
    // A short, plain-language note on how this household's data is handled,
    // shown as its own boxed callout at the close of the report (in addition
    // to the shorter confidentiality line already on every page's footer).
    const disclaimerText =
      "Data & Privacy: The figures in this report are drawn directly from the data your household has entered into Hearth. This data is private to your household -- it is not visible to, or shared with, anyone outside your household's account, and it is not sold or provided to third parties. Once downloaded or emailed, this report becomes a standalone file outside the app, so please share it only with people you intend to see your household's financial information.";
    const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 2 * M - 12);
    const disclaimerHeight = disclaimerLines.length * 4.2 + 14;
    if (y + disclaimerHeight > 262) { doc.addPage(); y = drawHeader('Recommendations'); }
    y += 6;
    doc.setDrawColor(230, 234, 238);
    doc.setFillColor(248, 250, 251);
    doc.roundedRect(M, y, pageWidth - 2 * M, disclaimerHeight, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(disclaimerLines, M + 6, y + 8);
    doc.setTextColor(0);

    // Footer on every page: a thin rule, confidentiality note, and page count.
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(225);
      doc.line(M, 285, pageWidth - M, 285);
      doc.setFontSize(7.5);
      doc.setTextColor(140);
      doc.text('Confidential -- for household members only. Not to be shared outside the household.', M, 290);
      doc.text(`Page ${p} of ${pageCount}`, pageWidth - M, 290, { align: 'right' });
    }

    const filename = `budget-report_${from}_to_${to}.pdf`;
    return { doc, filename, rangeLabel };
  }

  function handleGenerateReport() {
    if (!reportFrom || !reportTo || reportFrom > reportTo) {
      alert('Please choose a valid From/To date range.');
      return;
    }
    const { doc, filename, rangeLabel } = buildReportPdf(reportFrom, reportTo);
    const dataUri = doc.output('datauristring');
    // The on-screen preview uses a blob: URL (rather than the data: URI used
    // for email) with a "#zoom=150" PDF-open-parameter suffix -- browsers
    // reliably honor this zoom fragment for blob: URLs, which is what
    // actually makes the embedded page render larger in the iframe. Without
    // it, the built-in PDF viewer defaults to "fit page to width", which on
    // a wide screen scales the whole page down and made the text look small
    // even though the PDF's own font sizes are fine for print/download.
    if (reportPreviewUrlRef.current) URL.revokeObjectURL(reportPreviewUrlRef.current);
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    reportPreviewUrlRef.current = blobUrl;
    setReportDoc({ dataUri, previewUrl: `${blobUrl}#zoom=150`, filename, rangeLabel });
    setReportStatus('');
    setReportPreviewOpen(true);
  }

  function handleDownloadReport() {
    if (!reportDoc) return;
    const { doc } = buildReportPdf(reportFrom, reportTo);
    doc.save(reportDoc.filename);
  }

  async function handleEmailReport(e) {
    e.preventDefault();
    if (!reportDoc) return;
    if (!reportEmail.trim()) {
      alert('Please enter an email address to send the report to.');
      return;
    }
    setReportStatus('sending');
    try {
      const base64 = reportDoc.dataUri.split(',')[1];
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({
          to: reportEmail.trim(),
          filename: reportDoc.filename,
          rangeLabel: reportDoc.rangeLabel,
          pdfBase64: base64,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReportStatus('error: ' + (json.error || 'Could not send email'));
        return;
      }
      setReportStatus('sent');
    } catch (err) {
      setReportStatus('error: ' + err.message);
    }
  }

  if (loading) return <div className="center-screen">Loading your budget...</div>;

  CURRENT_CURRENCY = currency;

  // Notifications behind the bell icon -- same conditions that used to
  // render as always-visible red banners across the top of the page
  // (over total budget, over a specific category's budget, a bill due
  // soon), just collected into one list with stable ids so read/unread
  // status can be tracked per-notification instead of the whole page
  // shouting the same warning on every visit.
  const notifications = [];
  if (totalBudget > 0 && combinedOutflow > totalBudget) {
    notifications.push({
      id: 'over-total',
      text: <>You&rsquo;re <Amt value={combinedOutflow - totalBudget} /> over your total monthly budget (including planned savings).</>,
    });
  }
  overCategories.forEach((name) => {
    notifications.push({ id: `over-cat-${name}`, text: `Over budget in: ${name}.` });
  });
  dueReminders.forEach((r) => {
    notifications.push({
      id: `due-${r.id}`,
      text: (
        <>
          <strong>{r.name}</strong> due {r.daysUntil === 0 ? 'today' : `in ${r.daysUntil} day${r.daysUntil > 1 ? 's' : ''}`} ({fmtDate(r.due_date)})
        </>
      ),
    });
  });
  const unreadNotifCount = notifications.filter((n) => !seenNotifIds.has(n.id)).length;

  return (
    <div className="wrap">
      {/* Header, month nav, and both summary-card rows are wrapped in one
          sticky block (see .sticky-dashboard-frame) so the whole "dashboard
          frame" stays frozen at the top while only the tabs/panels/lists
          below it scroll -- rather than just the title bar row by itself. */}
      <div className="sticky-dashboard-frame" ref={stickyFrameRef}>
      <div className="top-bar" ref={topRef}>
        <div className="top-bar-row">
          <div className="header-title-row">
            <HearthMark size={34} />
            <h1 className="app-title-purple">{household.name || 'Hearth'}</h1>
          </div>
          <span className="corner-version-badge" title="This updates automatically -- if a change doesn't look right, reload the page.">
            {formatVersionBadge()}
          </span>
        </div>
          {/* Left-aligned, single row: the 4 data-entry tabs first, then the
              teal panel-toggle buttons, then the Profile icon, then the
              bell last -- all one flowing group instead of two separate
              rows (tabs used to live down in the content area; teal buttons
              used to be right-aligned in their own row up here). The 4 tabs
              are hidden on mobile (.header-tab-btn) since phones keep their
              own bottom-nav/FAB pattern -- the original in-content tab
              switcher (further below) still drives that. */}
          <div className="action-row-teal action-row-left">
            {/* All four tabs are always solid teal + white text now (no more
                outline "not selected" look) -- matches the Help/Report/
                Settings/Users buttons right next to them so the whole row
                reads as one consistent button style. header-tab-btn-active
                just adds a subtle inset ring so you can still tell which
                one is currently open. */}
            <button
              type="button"
              className={`btn-teal header-tab-btn ${inputTab === 'income' ? 'header-tab-btn-active' : ''}`}
              onClick={() => setInputTab('income')}
            >
              Income
            </button>
            <button
              type="button"
              className={`btn-teal header-tab-btn ${inputTab === 'fixed' ? 'header-tab-btn-active' : ''}`}
              onClick={() => setInputTab('fixed')}
            >
              Fixed Expenses
            </button>
            <button
              type="button"
              className={`btn-teal header-tab-btn ${inputTab === 'expense' ? 'header-tab-btn-active' : ''}`}
              onClick={() => setInputTab('expense')}
            >
              Add an expense
            </button>
            <button
              type="button"
              className={`btn-teal header-tab-btn ${inputTab === 'savings' ? 'header-tab-btn-active' : ''}`}
              onClick={() => setInputTab('savings')}
            >
              Savings
            </button>
            <button className="btn-teal" onClick={() => togglePanel('report')}>
              {activePanel === 'report' ? 'Hide report' : 'Report'}
            </button>
            <button className="btn-teal" onClick={() => togglePanel('settings')}>
              {activePanel === 'settings' ? 'Hide settings' : 'Settings'}
            </button>
            {isOwner && (
              <button className="btn-teal" onClick={() => togglePanel('members')}>
                {activePanel === 'members' ? 'Hide users' : 'Users'}
              </button>
            )}
            <button className="btn-teal" onClick={() => togglePanel('help')}>
              {activePanel === 'help' ? 'Hide help' : 'Help'}
            </button>
            {/* Color theme picker -- deliberately styled as a multi-color
                swatch (conic-gradient ring) rather than matching the plain
                teal/white icon-button family right next to it, so the
                button itself hints at "pick a color" before it's even
                opened, while still behaving like every other header
                dropdown (click to open, click outside to close). */}
            <div className="theme-fab-wrap" ref={themeMenuRef}>
              <button
                type="button"
                className="theme-fab-btn"
                title="Color theme"
                onClick={() => setThemeMenuOpen((o) => !o)}
              >
                <Palette size={16} />
              </button>
              {themeMenuOpen && (
                <div className="theme-dropdown">
                  <div className="theme-dropdown-title">Color theme</div>
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`theme-swatch-row ${theme === t.id ? 'active' : ''}`}
                      onClick={() => { setTheme(t.id); setThemeMenuOpen(false); }}
                    >
                      <span className="theme-swatch-dot" style={{ background: t.color }} />
                      {t.label}
                      {theme === t.id && <Check size={14} style={{ marginLeft: 'auto' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Profile icon replaces the old standalone Sign out button --
                clicking it shows the signed-in email plus the same
                self-editable Name/Phone/Location fields as "My details" in
                Users, with Sign out as the last action in the dropdown. */}
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="profile-icon-btn"
                title="Profile"
                onClick={() => setProfileMenuOpen((o) => !o)}
              >
                <User size={18} />
              </button>
              {profileMenuOpen && (
                <div className="profile-dropdown">
                  {/* Per explicit request: a clear "Signed in as {name}
                      ({email})" line, plus role and account-created date --
                      everything else (phone/location) is already editable
                      just below this, so this line is purely identity
                      context, not another editable field. */}
                  <div className="profile-dropdown-email">
                    Signed in as {myDetailsDraft.name || 'you'} ({session.user.email})
                  </div>
                  <div className="muted-small" style={{ marginTop: -6, marginBottom: 10 }}>
                    {isOwner ? 'Owner' : 'User'}
                    {session.user.created_at && (
                      <> &middot; Member since {new Date(session.user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                    )}
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Full name</label>
                    <input
                      type="text"
                      value={myDetailsDraft.name}
                      onChange={(e) => setMyDetailsDraft((d) => ({ ...d, name: e.target.value }))}
                      onBlur={(e) => commitMyDetailsField('name', e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Phone (optional)</label>
                    <input
                      type="text"
                      value={myDetailsDraft.phone}
                      onChange={(e) => setMyDetailsDraft((d) => ({ ...d, phone: e.target.value }))}
                      onBlur={(e) => commitMyDetailsField('phone', e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Location</label>
                    <input
                      type="text"
                      value={myDetailsDraft.location}
                      onChange={(e) => setMyDetailsDraft((d) => ({ ...d, location: e.target.value }))}
                      onBlur={(e) => commitMyDetailsField('location', e.target.value)}
                    />
                  </div>
                  <div className="muted-small" style={{ marginBottom: 12 }}>Changes save automatically.</div>
                  <button className="btn-teal profile-signout-btn" onClick={handleSignOut}>Sign out</button>
                </div>
              )}
            </div>
            <div className="notif-bell-wrap" ref={notifBellRef}>
              <button
                type="button"
                className="notif-bell-btn"
                title="Notifications"
                onClick={() => {
                  const opening = !notifOpen;
                  setNotifOpen(opening);
                  if (opening && notifications.length) markNotifsSeen(notifications.map((n) => n.id));
                }}
              >
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 22Z" fill="currentColor" />
                  <path d="M19 16.2V11a7 7 0 1 0-14 0v5.2l-1.6 2.2c-.4.5 0 1.3.6 1.3h16c.6 0 1-.8.6-1.3L19 16.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
                {unreadNotifCount > 0 && (
                  <span className="notif-badge">{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
                )}
              </button>
              {notifOpen && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-title">Notifications</div>
                  {notifications.length === 0 ? (
                    <div className="notif-empty">You&rsquo;re all caught up.</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="notif-item">{n.text}</div>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* AI feature #4: chat assistant, now anchored as a fixed icon
                button right next to the bell (same relative/absolute
                dropdown pattern as notif-bell-wrap and profile-menu-wrap
                just above) instead of a free-floating draggable bubble --
                per explicit request, this stays put next to the bell no
                matter what else changes in the header. */}
            <div className="chat-fab-wrap" ref={chatMenuRef}>
              <button
                type="button"
                className="chat-fab-btn"
                title={chatOpen ? 'Close chat' : 'Chat BoT -- Ask about your budget (AI powered)'}
                onClick={() => setChatOpen((o) => !o)}
              >
                {chatOpen ? <X size={18} /> : <MessageCircle size={18} />}
              </button>
              {!chatOpen && (
                <>
                  {/* "AI powered" sits above the icon, "Chat BoT" below --
                      both centered on the button itself, per explicit
                      request (previously both lines were stacked below and
                      right-aligned to the button). */}
                  <span className="chat-fab-badge-sub chat-fab-badge-above">
                    <Sparkles size={11} className="ai-tag-sparkle" strokeWidth={2.25} />
                    AI powered
                  </span>
                  <span className="chat-fab-badge-title chat-fab-badge-below">Chat BoT</span>
                </>
              )}
              {chatOpen && (
                <div className="chat-window">
                  <div className="chat-header">
                    <span>Ask me About Budget &amp; Expenses / Suggestions <AiTag /></span>
                    <button onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={16} /></button>
                  </div>
                  <div className="chat-messages" ref={chatMessagesRef}>
                    {chatMessages.length === 0 && (
                      <div className="chat-empty">
                        Ask about any tab -- Income, Fixed Expenses, Add an expense, Savings, or how a feature works -- and ask for suggestions too, e.g. "how much did I spend on dining this month?", "how do fixed expenses work?", or "any suggestions to lower my spending?". I can only see the numbers already in your household's data, nothing outside it.
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`chat-bubble ${m.role}`}>{m.content}</div>
                    ))}
                    {chatLoading && <div className="chat-bubble assistant chat-typing">Thinking...</div>}
                  </div>
                  <form
                    className="chat-input-row"
                    onSubmit={(e) => { e.preventDefault(); sendChatMessage(); }}
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a question..."
                      disabled={chatLoading}
                    />
                    <button type="submit" className="btn small" disabled={chatLoading || !chatInput.trim()}>Send</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

      <div className="month-nav">
        <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>&lsaquo;</button>
        <div className="label">{monthLabel(currentMonth)}</div>
        <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>&rsaquo;</button>
      </div>

      <div className="grid">
        <div className="card card-budget"><div className="k">Monthly Budget</div><div className="v"><Amt value={totalBudget} /></div></div>
        <div className={`card card-spent ${totalBudget > 0 && combinedOutflow > totalBudget ? 'over' : ''}`}>
          <div className="k">Spent so far</div><div className="v"><Amt value={combinedOutflow} /></div>
          {savingsTotal > 0 && (
            <div className="muted-small" style={{ marginTop: 4 }}>
              Expenses <Amt value={total} /> + Savings <Amt value={savingsTotal} />
            </div>
          )}
        </div>
        <div className={`card card-remaining ${totalBudget > 0 && remaining < 0 ? 'over' : totalBudget > 0 && remaining >= 0 ? 'ok' : ''}`}>
          <div className="k">Remaining</div>
          {totalBudget > 0 ? (
            <>
              <div className="v"><Amt value={remaining} /></div>
              <div className="muted-small" style={{ marginTop: 4 }}>After expenses and savings</div>
            </>
          ) : (
            <>
              <div className="v">—</div>
              <div className="muted-small" style={{ marginTop: 4 }}>Set a monthly budget to track this</div>
            </>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card card-income ok">
          <div className="k">Combined income</div>
          <div className="v"><Amt value={totalIncome} /></div>
          {/* Same breakdown treatment as Combined expenses/Spent so far --
              income doesn't have fixed "types" the way expenses do
              (Regular/Fixed/Savings), so this lists each of this month's
              income sources by name instead, in the same "+"-joined style. */}
          {incomeForMonth.length > 0 && (
            <div className="muted-small" style={{ marginTop: 4 }}>
              {incomeForMonth.map((i, idx) => (
                <span key={i.id}>
                  {idx > 0 ? ' + ' : ''}{i.name} <Amt value={i.amount} />
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="card card-expenses">
          <div className="k">Combined expenses</div>
          <div className="v"><Amt value={combinedOutflow} /></div>
          <div className="muted-small" style={{ marginTop: 4 }}>
            Regular <Amt value={oneOffTotal} /> + Fixed <Amt value={recurringTotal} />{savingsTotal > 0 ? <> + Savings <Amt value={savingsTotal} /></> : ''}
          </div>
        </div>
        <div className={`card card-net ${netCombined < 0 ? 'over' : 'ok'}`}>
          <div className="k">Net (income - expenses - savings)</div><div className="v"><Amt value={netCombined} /></div>
        </div>
      </div>
      </div>

      <div className="content-grid">
        <div ref={inputTabsSectionRef} className={addSheetOpen ? 'mobile-add-sheet' : undefined}>
          {addSheetOpen && (
            <div className="mobile-sheet-handle">
              <span className="mobile-sheet-drag" />
              <button
                className="mobile-sheet-close"
                onClick={() => setAddSheetOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          )}
          <div className="input-tabs data-entry-tabs">
            <button
              className={`btn small ${inputTab === 'income' ? '' : 'secondary'}`}
              onClick={() => setInputTab('income')}
            >
              Income
            </button>
            <button
              className={`btn small ${inputTab === 'fixed' ? '' : 'secondary'}`}
              onClick={() => setInputTab('fixed')}
            >
              Fixed Expenses
            </button>
            <button
              className={`btn small ${inputTab === 'expense' ? '' : 'secondary'}`}
              onClick={() => setInputTab('expense')}
            >
              Add an expense
            </button>
            <button
              className={`btn small ${inputTab === 'savings' ? '' : 'secondary'}`}
              onClick={() => setInputTab('savings')}
            >
              Savings
            </button>
          </div>

          {inputTab === 'expense' && (
          <div className="panel">
            <h2>Add an expense</h2>
            <form onSubmit={handleAddExpense}>
            <div className="row">
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1.4 }}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Groceries at Trader Joe's"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  onBlur={(e) => suggestCategoryFromDescription(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Category <AiTag /></label>
                <select value={form.categoryId} onChange={(e) => { setForm({ ...form, categoryId: e.target.value }); setAiCategoryHint(''); }}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {aiCategoryHint && <div className="ai-hint">{aiCategoryHint}</div>}
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                {/* Was flex:'0 1 140px'/minWidth:120 -- same leftover width
                    reservation fixed on Income's Amount field. Sizing to
                    content instead closes the dead space now that the box
                    itself is exactly as wide as the typed value. */}
                <label>Amount</label>
                <div className="amount-field-wrap">
                  <span className="currency-prefix"><CurrencyPrefix /></span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={{ '--amt-px': formAmountPx(form.amount) + 'px' }}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </div>
              {/* Note + Attach icons -- per explicit request, a small note
                  symbol reveals a textarea for a longer free-text description
                  (separate from the short Description field above), and a
                  paperclip lets you attach one image or PDF (5MB cap) related
                  to this expense. Both are optional and collapsed by default
                  so most expenses (which need neither) stay a single quick row. */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Note</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`icon-btn-outline ${form.notes ? 'active' : ''}`}
                    title="Add a note"
                    onClick={() => setShowExpenseNotes((s) => !s)}
                    style={{ height: 40, width: 40 }}
                  >
                    <StickyNote size={16} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn-outline ${expenseFile ? 'active' : ''}`}
                    title="Attach a document"
                    onClick={() => expenseFileInputRef.current?.click()}
                    style={{ height: 40, width: 40 }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    ref={expenseFileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => handleAttachmentPick(e.target.files?.[0], setExpenseFile)}
                  />
                </div>
              </div>
            </div>
            {showExpenseNotes && (
              <div className="field" style={{ marginTop: 8 }}>
                <label>Note (optional, long description)</label>
                <textarea
                  rows={2}
                  placeholder="Any extra detail about this expense..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            )}
            {expenseFile && (
              <div className="muted-small attachment-chip" style={{ marginTop: 6 }}>
                <Paperclip size={12} /> {expenseFile.name}
                <button type="button" className="attachment-chip-remove" onClick={() => { setExpenseFile(null); if (expenseFileInputRef.current) expenseFileInputRef.current.value = ''; }}>
                  <X size={12} />
                </button>
              </div>
            )}
            {/* Payment source sits on its own row, below the main fields --
                keeping it out of the first row avoids cramming a 5th/6th
                field into a row already tight on width (the exact pattern
                that caused the earlier Amount/Start-date overlap bug in
                Fixed Expenses). The bank picker only renders once a card
                option is chosen, so Cash payers never see an irrelevant field. */}
            <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '0 1 150px', minWidth: 130 }}>
                <label>Payment Source</label>
                <select
                  value={form.paymentSource}
                  onChange={(e) => setForm({ ...form, paymentSource: e.target.value, paymentBank: e.target.value === 'Cash' ? '' : form.paymentBank })}
                >
                  {PAYMENT_SOURCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {form.paymentSource !== 'Cash' && (
                <div className="field" style={{ flex: '0 1 190px', minWidth: 150 }}>
                  <label>Bank</label>
                  <select value={form.paymentBank} onChange={(e) => setForm({ ...form, paymentBank: e.target.value })}>
                    <option value="">Select bank</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Scan a receipt now comes before Add, reading left-to-right as
                  "capture it, then confirm/submit it" -- Add is the final
                  action in the row, same order the eye naturally follows.
                  Scan stays type="button" so it can't accidentally submit the
                  Add form now that it lives inside it. */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Scan</label>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => scanFileInputRef.current?.click()}
                  disabled={scanLoading}
                  style={{ height: 40 }}
                >
                  <Camera size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  {scanLoading ? 'Reading receipt...' : 'Scan a receipt'}
                  <AiTag />
                </button>
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <button className="btn" type="submit" style={{ height: 40 }}>Add</button>
              </div>
            </div>
            </form>

            <div className="scan-receipt-block">
              <input
                type="file"
                accept="image/*"
                ref={scanFileInputRef}
                style={{ display: 'none' }}
                onChange={handleScanFileChange}
              />
              <div className="muted-small" style={{ marginTop: 6 }}>
                Upload a photo of a receipt, or a sheet/screenshot listing several expenses -- review what Claude finds before anything is added.
              </div>
              {scanError && <div className="scan-error">{scanError}</div>}
            </div>

            {scanResults.length > 0 && (
              <div className="scan-review-list">
                <div className="muted-small" style={{ fontWeight: 700, marginBottom: 8 }}>
                  Review before adding -- edit anything that looks wrong, untick what you don't want:
                </div>
                {scanResults.map((row, i) => (
                  <div className="scan-review-row" key={i}>
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateScanRow(i, 'include', e.target.checked)}
                    />
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateScanRow(i, 'date', e.target.value)}
                    />
                    <input
                      type="text"
                      value={row.description}
                      placeholder="Description"
                      onChange={(e) => updateScanRow(i, 'description', e.target.value)}
                    />
                    <select value={row.categoryId} onChange={(e) => updateScanRow(i, 'categoryId', e.target.value)}>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <div className="amount-field-wrap tight">
                      <span className="currency-prefix"><CurrencyPrefix /></span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount}
                        onChange={(e) => updateScanRow(i, 'amount', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <div className="row" style={{ marginTop: 4 }}>
                  <button type="button" className="btn" onClick={commitScanResults}>
                    Add {scanResults.filter((r) => r.include).length} expense{scanResults.filter((r) => r.include).length === 1 ? '' : 's'}
                  </button>
                  <button type="button" className="btn secondary" onClick={() => { setScanResults([]); setScanError(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {inputTab === 'income' && (
          <div className="panel">
            <h2>Income</h2>
            <form onSubmit={handleAddIncome}>
            <div className="row">
              <div className="field" style={{ flex: 1.2 }}>
                <label>Source</label>
                <input
                  type="text"
                  placeholder="e.g. Salary"
                  value={newIncome.name}
                  onChange={(e) => setNewIncome({ ...newIncome, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Whose income</label>
                <select
                  value={newIncome.memberEmail}
                  onChange={(e) => setNewIncome({ ...newIncome, memberEmail: e.target.value })}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.email}>{m.email} ({m.relation})</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                {/* Was flex:'0 1 150px'/minWidth:130 -- a leftover width
                    reservation from before the Amount box shrank to its
                    exact content (see tightAmountPx/formAmountPx). That fixed
                    minimum left a big empty gap between the now-narrow pill
                    and the Month field next to it. Sizing to content instead
                    (like the Add button field) closes that gap. */}
                <label>Amount / month</label>
                <div className="amount-field-wrap">
                  <span className="currency-prefix"><CurrencyPrefix /></span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={{ '--amt-px': formAmountPx(newIncome.amount) + 'px' }}
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="field" style={{ flex: '0 1 150px', minWidth: 130 }}>
                <label>Month</label>
                <input
                  type="month"
                  value={newIncome.month}
                  onChange={(e) => setNewIncome({ ...newIncome, month: e.target.value })}
                />
              </div>
              {/* Add sits right next to Month, in the same row, instead of on
                  its own line below -- the invisible label above it matches
                  every other field's label height so the button's own 40px
                  height still lines up on the same baseline as the inputs
                  next to it (the row is align-items:flex-end). */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <button className="btn" type="submit" style={{ height: 40 }}>Add</button>
              </div>
            </div>
            </form>
            <div className="muted-small" style={{ marginTop: 6 }}>
              Income is entered per month on purpose -- it won't automatically carry over. The list below only shows entries for {monthLabel(currentMonth)}; add a new row for each new month.
            </div>

            {incomeForMonth.length === 0 ? (
              <div className="empty">No income added for {monthLabel(currentMonth)} yet.</div>
            ) : isMobile ? (
              <div className="mobile-txn-list">
                {incomeForMonth.map((i) => {
                  const title = (incomeDrafts[i.id]?.name || i.name || 'Income').trim();
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className="mobile-txn-row"
                      onClick={() => { setAddSheetOpen(false); setEditingIncomeId(i.id); }}
                    >
                      <span className="mobile-txn-icon" style={{ background: COLORS[0] }}>
                        {title.charAt(0).toUpperCase()}
                      </span>
                      <span className="mobile-txn-mid">
                        <span className="mobile-txn-title">{title}</span>
                        <span className="mobile-txn-sub">{displayNameForEmail(i.member_email)}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={i.amount} /></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="table-scroll">
              <table className="responsive-table" style={{ marginTop: 14, fontSize: 11 }}>
                <colgroup>
                  {/* Member only ever shows a first name now (displayNameForEmail),
                      so its old 26% (same as Source) was reserving far more room
                      than it needs -- that unused space read as a big gap next to
                      the Amount column. Narrowed to 16% and redistributed to
                      Source/Month/delete. */}
                  <col style={{ width: '30%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} />
                  <col style={{ width: '24%' }} /><col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr><th>Source</th><th>Member</th><th>Amount</th><th>Month</th><th></th></tr>
                </thead>
                <tbody>
                  {incomeForMonth.map((i) => (
                    <tr key={i.id}>
                      <td data-label="Source">
                        <input
                          type="text"
                          style={{ fontSize: 11 }}
                          value={incomeDrafts[i.id]?.name ?? ''}
                          onChange={(e) => updateIncomeDraftField(i.id, 'name', e.target.value)}
                          onBlur={(e) => commitIncomeField(i.id, 'name', e.target.value)}
                        />
                      </td>
                      <td className="muted-small" data-label="Member">{displayNameForEmail(i.member_email)}</td>
                      <td data-label="Amount">
                        <div className="amount-field-wrap tight">
                          <span className="currency-prefix"><CurrencyPrefix /></span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            style={{ fontSize: 11, '--amt-px': tightAmountPx(incomeDrafts[i.id]?.amount) + 'px' }}
                            value={incomeDrafts[i.id]?.amount ?? ''}
                            onChange={(e) => updateIncomeDraftField(i.id, 'amount', e.target.value)}
                            onBlur={(e) => commitIncomeField(i.id, 'amount', e.target.value)}
                          />
                        </div>
                      </td>
                      <td data-label="Month">
                        <input
                          type="month"
                          style={{ fontSize: 11, width: '100%', textAlign: 'right' }}
                          value={incomeDrafts[i.id]?.month ?? ''}
                          onChange={(e) => commitIncomeField(i.id, 'month', e.target.value)}
                        />
                      </td>
                      <td><button className="del" onClick={() => handleDeleteIncome(i.id, i.name)} title="Delete"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {incomeForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                Changes save automatically. <Amt value={totalIncome} /> in combined income counted toward {monthLabel(currentMonth)}.
              </div>
            )}

            {/* Mobile edit sheet for a tapped income row -- same fields/handlers as desktop's inline row. */}
            {isMobile && editingIncomeId && (() => {
              const i = incomeForMonth.find((x) => x.id === editingIncomeId);
              if (!i) return null;
              return (
                <>
                  <div className="mobile-sheet-backdrop" onClick={() => setEditingIncomeId(null)} />
                  <div className="mobile-add-sheet">
                    <div className="mobile-sheet-handle">
                      <span className="mobile-sheet-drag" />
                      <button className="mobile-sheet-close" onClick={() => setEditingIncomeId(null)} aria-label="Close">
                        <X size={18} />
                      </button>
                    </div>
                    <h2 style={{ margin: '0 0 12px' }}>Edit income</h2>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Source</label>
                      <input
                        type="text"
                        value={incomeDrafts[i.id]?.name ?? ''}
                        onChange={(e) => updateIncomeDraftField(i.id, 'name', e.target.value)}
                        onBlur={(e) => commitIncomeField(i.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Amount</label>
                      <div className="amount-field-wrap">
                        <span className="currency-prefix"><CurrencyPrefix /></span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={incomeDrafts[i.id]?.amount ?? ''}
                          onChange={(e) => updateIncomeDraftField(i.id, 'amount', e.target.value)}
                          onBlur={(e) => commitIncomeField(i.id, 'amount', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="field" style={{ marginBottom: 16 }}>
                      <label>Month</label>
                      <input
                        type="month"
                        value={incomeDrafts[i.id]?.month ?? ''}
                        onChange={(e) => commitIncomeField(i.id, 'month', e.target.value)}
                      />
                    </div>
                    <button
                      className="mobile-delete-btn"
                      onClick={() => { handleDeleteIncome(i.id, i.name); setEditingIncomeId(null); }}
                    >
                      <Trash2 size={16} /> Delete income
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
          )}

          {inputTab === 'fixed' && (
          <>
          <div className="panel">
            <h2>Fixed Expenses (loans, EMIs, credit cards, rent)</h2>
            {/* With 7 fields, this form can wrap onto several lines on
                narrower screens -- the Add button is kept on its own row
                below (rather than inline at flex-end) so it never overlaps
                a wrapped field. */}
            <form onSubmit={handleAddRecurring}>
            {/* Every field below now gets an explicit width sized to what it
                actually needs to hold (rather than the default equal-flex
                split, which squeezed the Category dropdown too narrow to
                show longer names like "Movies/Entertainment" and made the
                row wrap unevenly) -- this is what keeps the row's spacing
                and wrapping predictable/balanced instead of shifting around
                based on which fields happen to land on line 2. */}
            <div className="row">
              <div className="field" style={{ flex: '1.2 1 180px', minWidth: 160 }}>
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Car loan EMI"
                  value={newRecurring.name}
                  onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: '1.3 1 190px', minWidth: 170 }}>
                <label>Category</label>
                <select
                  value={newRecurring.categoryId}
                  onChange={(e) => setNewRecurring({ ...newRecurring, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                {/* Was flex:'0 1 150px'/minWidth:130 -- same leftover width
                    reservation fixed on Income's Amount field. Sizing to
                    content instead closes the dead space now that the box
                    itself is exactly as wide as the typed value. */}
                <label>Amount / month</label>
                <div className="amount-field-wrap">
                  <span className="currency-prefix"><CurrencyPrefix /></span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={{ '--amt-px': formAmountPx(newRecurring.amount) + 'px' }}
                    value={newRecurring.amount}
                    onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="field" style={{ flex: '0 1 150px', minWidth: 140 }}>
                <label>Start date</label>
                <input
                  type="date"
                  value={newRecurring.startDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, startDate: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: '0 1 150px', minWidth: 140 }}>
                <label>End date (optional)</label>
                <input
                  type="date"
                  value={newRecurring.endDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, endDate: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: '0 1 165px', minWidth: 150 }}>
                <label>Repeats</label>
                <select
                  value={newRecurring.frequency}
                  onChange={(e) => setNewRecurring({ ...newRecurring, frequency: e.target.value })}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: '0 1 190px', minWidth: 170 }}>
                <label>Due date (optional, for reminders)</label>
                <input
                  type="date"
                  value={newRecurring.dueDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, dueDate: e.target.value })}
                />
              </div>
              {/* Payment Source sits right next to Due date in this same row now
                  (previously it was pushed onto its own separate row below, which
                  made it look disconnected/unaligned from the rest of the form). */}
              <div className="field" style={{ flex: '0 1 150px', minWidth: 130 }}>
                <label>Payment Source</label>
                <select
                  value={newRecurring.paymentSource}
                  onChange={(e) => setNewRecurring({ ...newRecurring, paymentSource: e.target.value, paymentBank: CARD_PAYMENT_SOURCES.includes(e.target.value) ? newRecurring.paymentBank : '' })}
                >
                  {RECURRING_PAYMENT_SOURCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {CARD_PAYMENT_SOURCES.includes(newRecurring.paymentSource) && (
                <div className="field" style={{ flex: '0 1 190px', minWidth: 150 }}>
                  <label>Bank</label>
                  <select value={newRecurring.paymentBank} onChange={(e) => setNewRecurring({ ...newRecurring, paymentBank: e.target.value })}>
                    <option value="">Select bank</option>
                    {BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Same note/attach pair as the one-off expense form above --
                  optional long description + one image/PDF attachment
                  (5MB cap), useful here for loan agreements, EMI schedules,
                  or lease documents. */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Note</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={`icon-btn-outline ${newRecurring.notes ? 'active' : ''}`}
                    title="Add a note"
                    onClick={() => setShowRecurringNotes((s) => !s)}
                    style={{ height: 40, width: 40 }}
                  >
                    <StickyNote size={16} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn-outline ${recurringFile ? 'active' : ''}`}
                    title="Attach a document"
                    onClick={() => recurringFileInputRef.current?.click()}
                    style={{ height: 40, width: 40 }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    ref={recurringFileInputRef}
                    style={{ display: 'none' }}
                    onChange={(e) => handleAttachmentPick(e.target.files?.[0], setRecurringFile)}
                  />
                </div>
              </div>
              {/* Add sits right next to Payment Source (and Bank, when it's
                  showing) in this same row, instead of on its own line below.
                  Same invisible-label trick as Income's Add button so its
                  40px height still lines up with the row's other fields. */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <button className="btn" type="submit" style={{ height: 40 }}>Add</button>
              </div>
            </div>
            {showRecurringNotes && (
              <div className="field" style={{ marginTop: 8 }}>
                <label>Note (optional, long description)</label>
                <textarea
                  rows={2}
                  placeholder="Any extra detail about this fixed expense..."
                  value={newRecurring.notes}
                  onChange={(e) => setNewRecurring({ ...newRecurring, notes: e.target.value })}
                />
              </div>
            )}
            {recurringFile && (
              <div className="muted-small attachment-chip" style={{ marginTop: 6 }}>
                <Paperclip size={12} /> {recurringFile.name}
                <button type="button" className="attachment-chip-remove" onClick={() => { setRecurringFile(null); if (recurringFileInputRef.current) recurringFileInputRef.current.value = ''; }}>
                  <X size={12} />
                </button>
              </div>
            )}
            </form>
          </div>
          {/* Data entry (above) and the list of what's already been entered
              (below) are now two separate frames, same as how "Expenses this
              month" already sits in its own panel below the Add-expense form
              -- makes it visually clear where you type a NEW fixed expense
              versus where you review/edit the ones you've already added. */}
          <div className="panel">
            <h2 style={{ marginBottom: 14 }}>Your fixed expenses</h2>
            {recurringExpenses.length === 0 ? (
              <div className="empty">No loans, EMIs, or fixed monthly bills added yet.</div>
            ) : recurringForMonth.length === 0 ? (
              /* Bug fix: this list used to always render EVERY fixed expense
                 ever added, regardless of which month was selected in the
                 month-nav above -- so scrolling back to e.g. Jan 2021 (long
                 before the item's own start date, or even before the app
                 existed) still showed it as if it applied there. Fixed
                 expenses are recurring RULES, but which ones are actually "in
                 effect" still depends on each rule's own start/end date and
                 repeat frequency -- exactly what recurringForMonth (used
                 elsewhere for the month's total) already computes via
                 recurringOccursInMonth. Filtering this list the same way is
                 what makes the visible rows finally match the selected
                 month. */
              <div className="empty">No fixed expenses apply to {monthLabel(currentMonth)}.</div>
            ) : isMobile ? (
              <div className="mobile-txn-list">
                {recurringForMonth.map((r) => {
                  const catIdx = categories.findIndex((c) => c.id === r.category_id);
                  const catColor = COLORS[(catIdx >= 0 ? catIdx : 0) % COLORS.length];
                  const catName = categoryNameById[r.category_id] || 'Uncategorized';
                  const title = (recurringDrafts[r.id]?.name || r.name || catName).trim();
                  const freqLabel = FREQUENCIES.find((f) => f.value === (recurringDrafts[r.id]?.frequency ?? r.frequency))?.label || 'Monthly';
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className="mobile-txn-row"
                      onClick={() => { setAddSheetOpen(false); setEditingRecurringId(r.id); }}
                    >
                      <span className="mobile-txn-icon" style={{ background: catColor }}>
                        {title.charAt(0).toUpperCase()}
                      </span>
                      <span className="mobile-txn-mid">
                        <span className="mobile-txn-title">
                          {title}
                          {r.notes && <StickyNote size={11} className="row-attach-hint" />}
                          {r.attachment_url && <Paperclip size={11} className="row-attach-hint" />}
                        </span>
                        <span className="mobile-txn-sub">{catName} &middot; {freqLabel}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={r.amount} /></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="table-scroll">
              {/* Switched from percentage columns to fixed pixel widths (with
                  min-width on the table itself) after repeatedly having to
                  steal a percentage point from one column to fix another --
                  every column here is already at the smallest width its own
                  content needs, so there was no more percentage slack left
                  to give Name more room without re-clipping something we'd
                  just fixed. Fixed px widths give every column exactly what
                  it needs; if that adds up to more than the panel's visible
                  width, .table-scroll's horizontal scroll handles the rest
                  (same technique already used for .users-table). */}
              <table className="responsive-table" style={{ marginTop: 14, fontSize: 11, minWidth: 851 }}>
                <colgroup>
                  {/* Widened Start/End/Due date so the native dd/mm/yyyy text
                      never clips its year, and widened Payment so its own
                      dropdown arrow + a stacked bank name aren't clipped --
                      both confirmed live. But NOT wide enough to reintroduce
                      horizontal scroll: per explicit feedback the table must
                      fit the panel with zero scroll, so Name/Category/Amount/
                      delete gave up width to compensate. Total (851px) was
                      confirmed live to sit safely under this panel's actual
                      content width (~882px measured live), and every date/
                      payment/delete value was individually re-confirmed
                      non-clipped (scrollWidth <= clientWidth) at these exact
                      widths before shipping. */}
                  <col style={{ width: '110px' }} /><col style={{ width: '105px' }} /><col style={{ width: '80px' }} />
                  <col style={{ width: '100px' }} /><col style={{ width: '100px' }} /><col style={{ width: '110px' }} />
                  <col style={{ width: '105px' }} /><col style={{ width: '101px' }} /><col style={{ width: '40px' }} />
                </colgroup>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Amount</th><th>Start</th><th>End</th><th>Repeats</th><th>Due date</th><th>Payment</th><th></th></tr>
                </thead>
                <tbody>
                  {recurringForMonth.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Name">
                        <input
                          type="text"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={recurringDrafts[r.id]?.name ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'name', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'name', e.target.value)}
                        />
                        {(r.notes || r.attachment_url) && (
                          <div className="row-attach-icons">
                            {r.notes && (
                              <button type="button" className="row-icon-btn" title={r.notes} onClick={() => alert(r.notes)}>
                                <StickyNote size={11} />
                              </button>
                            )}
                            {r.attachment_url && (
                              <button type="button" className="row-icon-btn" title={r.attachment_name || 'View attachment'} onClick={() => viewAttachment(r.attachment_url)}>
                                <Paperclip size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="Category">
                        <select
                          style={{ fontSize: 11, width: '100%' }}
                          value={recurringDrafts[r.id]?.categoryId ?? ''}
                          onChange={(e) => commitRecurringField(r.id, 'categoryId', e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Amount">
                        <div className="amount-field-wrap tight">
                          <span className="currency-prefix"><CurrencyPrefix /></span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            style={{ fontSize: 11, '--amt-px': tightAmountPx(recurringDrafts[r.id]?.amount) + 'px' }}
                            value={recurringDrafts[r.id]?.amount ?? ''}
                            onChange={(e) => updateRecurringDraftField(r.id, 'amount', e.target.value)}
                            onBlur={(e) => commitRecurringField(r.id, 'amount', e.target.value)}
                          />
                        </div>
                      </td>
                      <td data-label="Start">
                        <input
                          type="date"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={recurringDrafts[r.id]?.startDate ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'startDate', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'startDate', e.target.value)}
                        />
                      </td>
                      <td data-label="End">
                        <input
                          type="date"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={recurringDrafts[r.id]?.endDate ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'endDate', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'endDate', e.target.value)}
                        />
                      </td>
                      <td data-label="Repeats">
                        <select
                          style={{ fontSize: 11, width: '100%' }}
                          value={recurringDrafts[r.id]?.frequency ?? 'monthly'}
                          onChange={(e) => commitRecurringField(r.id, 'frequency', e.target.value)}
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Due date">
                        <input
                          type="date"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={recurringDrafts[r.id]?.dueDate ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'dueDate', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'dueDate', e.target.value)}
                        />
                      </td>
                      <td data-label="Payment">
                        <select
                          style={{ fontSize: 11, width: '100%', minWidth: 0 }}
                          value={recurringDrafts[r.id]?.paymentSource ?? 'Cash'}
                          onChange={(e) => commitRecurringField(r.id, 'paymentSource', e.target.value)}
                        >
                          {RECURRING_PAYMENT_SOURCES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {/* Always rendered -- just hidden (not unmounted) when this row's
                            payment source doesn't need a bank name -- so the Payment cell
                            reserves the same two-select height on every row regardless of
                            content, which is what keeps every row in the table the same
                            height instead of the shorter "Cash" rows looking squashed next
                            to taller "Bank"/card rows. */}
                        <select
                          style={{
                            fontSize: 11, width: '100%', minWidth: 0, marginTop: 4,
                            visibility: CARD_PAYMENT_SOURCES.includes(recurringDrafts[r.id]?.paymentSource ?? 'Cash') ? 'visible' : 'hidden',
                          }}
                          value={recurringDrafts[r.id]?.paymentBank ?? ''}
                          onChange={(e) => commitRecurringField(r.id, 'paymentBank', e.target.value)}
                        >
                          <option value="">Bank</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </td>
                      <td><button className="del" onClick={() => handleDeleteRecurring(r.id, r.name)} title="Delete"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="muted-small" style={{ marginTop: 6 }}>
              Changes save automatically. Set a due date on rent or any bill to get an in-app reminder starting 3 days before it's due.
            </div>
            {recurringForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                <Amt value={recurringTotal} /> in fixed expenses counted toward {monthLabel(currentMonth)}.
              </div>
            )}

            {/* Mobile edit sheet for a tapped fixed-expense row -- same fields/handlers as desktop's inline row. */}
            {isMobile && editingRecurringId && (() => {
              const r = recurringExpenses.find((x) => x.id === editingRecurringId);
              if (!r) return null;
              return (
                <>
                  <div className="mobile-sheet-backdrop" onClick={() => setEditingRecurringId(null)} />
                  <div className="mobile-add-sheet">
                    <div className="mobile-sheet-handle">
                      <span className="mobile-sheet-drag" />
                      <button className="mobile-sheet-close" onClick={() => setEditingRecurringId(null)} aria-label="Close">
                        <X size={18} />
                      </button>
                    </div>
                    <h2 style={{ margin: '0 0 12px' }}>Edit fixed expense</h2>
                    {(r.notes || r.attachment_url) && (
                      <div className="muted-small" style={{ marginBottom: 10 }}>
                        {r.notes && <div style={{ marginBottom: 4 }}><StickyNote size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{r.notes}</div>}
                        {r.attachment_url && (
                          <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => viewAttachment(r.attachment_url)}>
                            <Paperclip size={12} style={{ marginRight: 4, verticalAlign: -2 }} />View {r.attachment_name || 'attachment'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Name</label>
                      <input
                        type="text"
                        value={recurringDrafts[r.id]?.name ?? ''}
                        onChange={(e) => updateRecurringDraftField(r.id, 'name', e.target.value)}
                        onBlur={(e) => commitRecurringField(r.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Category</label>
                      <select
                        value={recurringDrafts[r.id]?.categoryId ?? ''}
                        onChange={(e) => commitRecurringField(r.id, 'categoryId', e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Amount / month</label>
                      <div className="amount-field-wrap">
                        <span className="currency-prefix"><CurrencyPrefix /></span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={recurringDrafts[r.id]?.amount ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'amount', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'amount', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Start date</label>
                      <input
                        type="date"
                        value={recurringDrafts[r.id]?.startDate ?? ''}
                        onChange={(e) => updateRecurringDraftField(r.id, 'startDate', e.target.value)}
                        onBlur={(e) => commitRecurringField(r.id, 'startDate', e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>End date (optional)</label>
                      <input
                        type="date"
                        value={recurringDrafts[r.id]?.endDate ?? ''}
                        onChange={(e) => updateRecurringDraftField(r.id, 'endDate', e.target.value)}
                        onBlur={(e) => commitRecurringField(r.id, 'endDate', e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Repeats</label>
                      <select
                        value={recurringDrafts[r.id]?.frequency ?? 'monthly'}
                        onChange={(e) => commitRecurringField(r.id, 'frequency', e.target.value)}
                      >
                        {FREQUENCIES.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Due date (optional, for reminders)</label>
                      <input
                        type="date"
                        value={recurringDrafts[r.id]?.dueDate ?? ''}
                        onChange={(e) => updateRecurringDraftField(r.id, 'dueDate', e.target.value)}
                        onBlur={(e) => commitRecurringField(r.id, 'dueDate', e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Payment Source</label>
                      <select
                        value={recurringDrafts[r.id]?.paymentSource ?? 'Cash'}
                        onChange={(e) => commitRecurringField(r.id, 'paymentSource', e.target.value)}
                      >
                        {RECURRING_PAYMENT_SOURCES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    {CARD_PAYMENT_SOURCES.includes(recurringDrafts[r.id]?.paymentSource ?? 'Cash') && (
                      <div className="field" style={{ marginBottom: 16 }}>
                        <label>Bank</label>
                        <select
                          value={recurringDrafts[r.id]?.paymentBank ?? ''}
                          onChange={(e) => commitRecurringField(r.id, 'paymentBank', e.target.value)}
                        >
                          <option value="">Select bank</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      className="mobile-delete-btn"
                      onClick={() => { handleDeleteRecurring(r.id, r.name); setEditingRecurringId(null); }}
                    >
                      <Trash2 size={16} /> Delete fixed expense
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
          </>
          )}

          {inputTab === 'savings' && (
          <div className="panel">
            <h2>Savings (how much you want to set aside each month)</h2>
            <form onSubmit={handleAddSaving}>
            <div className="row">
              <div className="field" style={{ flex: 1.4 }}>
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency fund"
                  value={newSaving.name}
                  onChange={(e) => setNewSaving({ ...newSaving, name: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: '0 0 auto' }}>
                {/* Was flex:'0 1 150px'/minWidth:130 -- same leftover width
                    reservation fixed on Income's Amount field. Sizing to
                    content instead closes the dead space now that the box
                    itself is exactly as wide as the typed value. */}
                <label>Amount / month</label>
                <div className="amount-field-wrap">
                  <span className="currency-prefix"><CurrencyPrefix /></span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    style={{ '--amt-px': formAmountPx(newSaving.amount) + 'px' }}
                    value={newSaving.amount}
                    onChange={(e) => setNewSaving({ ...newSaving, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="field" style={{ flex: '0 1 150px', minWidth: 130 }}>
                <label>Month</label>
                <input
                  type="month"
                  value={newSaving.month}
                  onChange={(e) => setNewSaving({ ...newSaving, month: e.target.value })}
                />
              </div>
              {/* Add now sits inline right after Month, in the same row,
                  instead of on its own line below -- matching the Income/
                  Fixed Expenses/Add-expense pattern (invisible label keeps
                  the button's 40px height on the same baseline as the row's
                  other fields, since the row is align-items:flex-end). */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <button className="btn" type="submit" style={{ height: 40 }}>Add</button>
              </div>
            </div>
            </form>
            <div className="muted-small" style={{ marginTop: 6 }}>
              Savings is entered per month on purpose -- it won't automatically carry over, exactly like Income. The list below only shows entries for {monthLabel(currentMonth)}; add a new row for each new month. Since it's money leaving your income, it's included in "Spent so far" and "Combined expenses" above and reduces "Remaining"/"Net" -- it also gets its own report page.
            </div>

            {savingsForMonth.length === 0 ? (
              <div className="empty">No savings added for {monthLabel(currentMonth)} yet.</div>
            ) : isMobile ? (
              <div className="mobile-txn-list">
                {savingsForMonth.map((s) => {
                  const title = (savingsDrafts[s.id]?.name || s.name || 'Savings').trim();
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="mobile-txn-row"
                      onClick={() => { setAddSheetOpen(false); setEditingSavingId(s.id); }}
                    >
                      <span className="mobile-txn-icon" style={{ background: COLORS[1 % COLORS.length] }}>
                        {title.charAt(0).toUpperCase()}
                      </span>
                      <span className="mobile-txn-mid">
                        <span className="mobile-txn-title">{title}</span>
                        <span className="mobile-txn-sub">{monthLabel(currentMonth)}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={s.amount} /></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="table-scroll">
              <table className="responsive-table" style={{ marginTop: 14, fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: '32%' }} /><col style={{ width: '24%' }} /><col style={{ width: '24%' }} /><col style={{ width: '10%' }} />
                </colgroup>
                <thead>
                  <tr><th>Name</th><th>Amount</th><th>Month</th><th></th></tr>
                </thead>
                <tbody>
                  {savingsForMonth.map((s) => (
                    <tr key={s.id}>
                      <td data-label="Name">
                        <input
                          type="text"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={savingsDrafts[s.id]?.name ?? ''}
                          onChange={(e) => updateSavingDraftField(s.id, 'name', e.target.value)}
                          onBlur={(e) => commitSavingField(s.id, 'name', e.target.value)}
                        />
                      </td>
                      <td data-label="Amount">
                        <div className="amount-field-wrap tight">
                          <span className="currency-prefix"><CurrencyPrefix /></span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            style={{ fontSize: 11, '--amt-px': tightAmountPx(savingsDrafts[s.id]?.amount) + 'px' }}
                            value={savingsDrafts[s.id]?.amount ?? ''}
                            onChange={(e) => updateSavingDraftField(s.id, 'amount', e.target.value)}
                            onBlur={(e) => commitSavingField(s.id, 'amount', e.target.value)}
                          />
                        </div>
                      </td>
                      <td data-label="Month">
                        <input
                          type="month"
                          style={{ width: '100%', fontSize: 11, textAlign: 'right' }}
                          value={savingsDrafts[s.id]?.month ?? ''}
                          onChange={(e) => commitSavingField(s.id, 'month', e.target.value)}
                        />
                      </td>
                      <td><button className="del" onClick={() => handleDeleteSaving(s.id, s.name)} title="Delete"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {savingsForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                <Amt value={savingsTotal} /> in planned savings for {monthLabel(currentMonth)}.
              </div>
            )}

            {/* Mobile edit sheet for a tapped savings row -- same fields/handlers as desktop's inline row. */}
            {isMobile && editingSavingId && (() => {
              const s = savingsForMonth.find((x) => x.id === editingSavingId);
              if (!s) return null;
              return (
                <>
                  <div className="mobile-sheet-backdrop" onClick={() => setEditingSavingId(null)} />
                  <div className="mobile-add-sheet">
                    <div className="mobile-sheet-handle">
                      <span className="mobile-sheet-drag" />
                      <button className="mobile-sheet-close" onClick={() => setEditingSavingId(null)} aria-label="Close">
                        <X size={18} />
                      </button>
                    </div>
                    <h2 style={{ margin: '0 0 12px' }}>Edit savings</h2>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Name</label>
                      <input
                        type="text"
                        value={savingsDrafts[s.id]?.name ?? ''}
                        onChange={(e) => updateSavingDraftField(s.id, 'name', e.target.value)}
                        onBlur={(e) => commitSavingField(s.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Amount / month</label>
                      <div className="amount-field-wrap">
                        <span className="currency-prefix"><CurrencyPrefix /></span>
                        <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={savingsDrafts[s.id]?.amount ?? ''}
                        onChange={(e) => updateSavingDraftField(s.id, 'amount', e.target.value)}
                        onBlur={(e) => commitSavingField(s.id, 'amount', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="field" style={{ marginBottom: 16 }}>
                      <label>Month</label>
                      <input
                        type="month"
                        value={savingsDrafts[s.id]?.month ?? ''}
                        onChange={(e) => commitSavingField(s.id, 'month', e.target.value)}
                      />
                    </div>
                    <button
                      className="mobile-delete-btn"
                      onClick={() => { handleDeleteSaving(s.id, s.name); setEditingSavingId(null); }}
                    >
                      <Trash2 size={16} /> Delete savings
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
          )}

          <div className="panel">
            <h2>Expenses this month</h2>
            {monthExpenses.length === 0 ? (
              <div className="empty">No one-off expenses logged for this month yet.</div>
            ) : isMobile ? (
              // Mobile gets a clean, read-at-a-glance transaction list --
              // colored category icon, description, category + date, and a
              // right-aligned amount -- instead of four always-open input
              // fields per row, which read more like a spreadsheet than an
              // app. Tapping a row opens the same kind of bottom sheet as
              // "Add", pre-filled for editing, reusing the exact same
              // commitExpenseField/handleDeleteExpense logic desktop uses.
              <div className="mobile-txn-list">
                {monthExpenses.map((e) => {
                  const catIdx = categories.findIndex((c) => c.id === e.category_id);
                  const catColor = COLORS[(catIdx >= 0 ? catIdx : 0) % COLORS.length];
                  const catName = categoryNameById[e.category_id] || 'Uncategorized';
                  const title = (expenseDrafts[e.id]?.description || e.description || catName).trim();
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="mobile-txn-row"
                      onClick={() => { setAddSheetOpen(false); setEditingExpenseId(e.id); }}
                    >
                      <span className="mobile-txn-icon" style={{ background: catColor }}>
                        {catName.charAt(0).toUpperCase()}
                      </span>
                      <span className="mobile-txn-mid">
                        <span className="mobile-txn-title">
                          {title}
                          {e.notes && <StickyNote size={11} className="row-attach-hint" />}
                          {e.attachment_url && <Paperclip size={11} className="row-attach-hint" />}
                        </span>
                        <span className="mobile-txn-sub">{catName} &middot; {fmtDate(e.expense_date)}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={e.amount} /></span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="table-scroll">
              <table className="responsive-table" style={{ fontSize: 11 }}>
                <colgroup>
                  <col style={{ width: '11%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} />
                  <col style={{ width: '10%' }} /><col style={{ width: '18%' }} /><col style={{ width: '7%' }} />
                  <col style={{ width: '6%' }} />
                </colgroup>
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Payment</th><th style={{ textAlign: 'center' }}>By</th><th></th></tr>
                </thead>
                <tbody>
                  {monthExpenses.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Date">
                        <input
                          type="date"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={expenseDrafts[e.id]?.date ?? ''}
                          onChange={(ev) => updateExpenseDraftField(e.id, 'date', ev.target.value)}
                          onBlur={(ev) => commitExpenseField(e.id, 'date', ev.target.value)}
                        />
                      </td>
                      <td data-label="Category">
                        <select
                          style={{ fontSize: 11, width: '100%' }}
                          value={expenseDrafts[e.id]?.categoryId ?? ''}
                          onChange={(ev) => commitExpenseField(e.id, 'categoryId', ev.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Description">
                        <input
                          type="text"
                          style={{ width: '100%', minWidth: 0, fontSize: 11 }}
                          value={expenseDrafts[e.id]?.description ?? ''}
                          onChange={(ev) => updateExpenseDraftField(e.id, 'description', ev.target.value)}
                          onBlur={(ev) => commitExpenseField(e.id, 'description', ev.target.value)}
                        />
                        {(e.notes || e.attachment_url) && (
                          <div className="row-attach-icons">
                            {e.notes && (
                              <button type="button" className="row-icon-btn" title={e.notes} onClick={() => alert(e.notes)}>
                                <StickyNote size={11} />
                              </button>
                            )}
                            {e.attachment_url && (
                              <button type="button" className="row-icon-btn" title={e.attachment_name || 'View attachment'} onClick={() => viewAttachment(e.attachment_url)}>
                                <Paperclip size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="Amount">
                        <div className="amount-field-wrap tight">
                          <span className="currency-prefix"><CurrencyPrefix /></span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            style={{ fontSize: 11, '--amt-px': tightAmountPx(expenseDrafts[e.id]?.amount) + 'px' }}
                            value={expenseDrafts[e.id]?.amount ?? ''}
                            onChange={(ev) => updateExpenseDraftField(e.id, 'amount', ev.target.value)}
                            onBlur={(ev) => commitExpenseField(e.id, 'amount', ev.target.value)}
                          />
                        </div>
                      </td>
                      <td data-label="Payment">
                        <select
                          style={{ fontSize: 11, width: '100%', minWidth: 0 }}
                          value={expenseDrafts[e.id]?.paymentSource ?? 'Cash'}
                          onChange={(ev) => commitExpenseField(e.id, 'paymentSource', ev.target.value)}
                        >
                          {PAYMENT_SOURCES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        {/* Always rendered -- just hidden (not unmounted) when this row's
                            payment source doesn't need a bank name -- so the Payment cell
                            reserves the same two-select height on every row, keeping every
                            row in the table the same height regardless of content. */}
                        <select
                          style={{
                            fontSize: 11, width: '100%', minWidth: 0, marginTop: 4,
                            visibility: (expenseDrafts[e.id]?.paymentSource ?? 'Cash') !== 'Cash' ? 'visible' : 'hidden',
                          }}
                          value={expenseDrafts[e.id]?.paymentBank ?? ''}
                          onChange={(ev) => commitExpenseField(e.id, 'paymentBank', ev.target.value)}
                        >
                          <option value="">Bank</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="By" className="muted-small" style={{ textAlign: 'center' }}>{displayNameForEmail(e.created_by_email)}</td>
                      <td><button className="del" onClick={() => handleDeleteExpense(e.id)} title="Delete"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {monthExpenses.length > 0 && (
              <div className="muted-small" style={{ marginTop: 8 }}>
                Changes save automatically. <Amt value={oneOffTotal} /> in regular (one-off) expenses counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>

          {/* Mobile edit sheet for a tapped transaction -- same fields, same
              auto-save-on-blur handlers as desktop's inline row, just
              presented as a focused sheet instead of four permanently open
              inputs. */}
          {isMobile && editingExpenseId && (() => {
            const e = monthExpenses.find((x) => x.id === editingExpenseId);
            if (!e) return null;
            return (
              <>
                <div className="mobile-sheet-backdrop" onClick={() => setEditingExpenseId(null)} />
                <div className="mobile-add-sheet">
                  <div className="mobile-sheet-handle">
                    <span className="mobile-sheet-drag" />
                    <button className="mobile-sheet-close" onClick={() => setEditingExpenseId(null)} aria-label="Close">
                      <X size={18} />
                    </button>
                  </div>
                  <h2 style={{ margin: '0 0 12px' }}>Edit expense</h2>
                  {(e.notes || e.attachment_url) && (
                    <div className="muted-small" style={{ marginBottom: 10 }}>
                      {e.notes && <div style={{ marginBottom: 4 }}><StickyNote size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{e.notes}</div>}
                      {e.attachment_url && (
                        <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => viewAttachment(e.attachment_url)}>
                          <Paperclip size={12} style={{ marginRight: 4, verticalAlign: -2 }} />View {e.attachment_name || 'attachment'}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={expenseDrafts[e.id]?.date ?? ''}
                      onChange={(ev) => updateExpenseDraftField(e.id, 'date', ev.target.value)}
                      onBlur={(ev) => commitExpenseField(e.id, 'date', ev.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Category</label>
                    <select
                      value={expenseDrafts[e.id]?.categoryId ?? ''}
                      onChange={(ev) => commitExpenseField(e.id, 'categoryId', ev.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Description</label>
                    <input
                      type="text"
                      value={expenseDrafts[e.id]?.description ?? ''}
                      onChange={(ev) => updateExpenseDraftField(e.id, 'description', ev.target.value)}
                      onBlur={(ev) => commitExpenseField(e.id, 'description', ev.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Amount</label>
                    <div className="amount-field-wrap">
                    <span className="currency-prefix"><CurrencyPrefix /></span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={expenseDrafts[e.id]?.amount ?? ''}
                      onChange={(ev) => updateExpenseDraftField(e.id, 'amount', ev.target.value)}
                      onBlur={(ev) => commitExpenseField(e.id, 'amount', ev.target.value)}
                    />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Payment Source</label>
                    <select
                      value={expenseDrafts[e.id]?.paymentSource ?? 'Cash'}
                      onChange={(ev) => commitExpenseField(e.id, 'paymentSource', ev.target.value)}
                    >
                      {PAYMENT_SOURCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  {(expenseDrafts[e.id]?.paymentSource ?? 'Cash') !== 'Cash' && (
                    <div className="field" style={{ marginBottom: 16 }}>
                      <label>Bank</label>
                      <select
                        value={expenseDrafts[e.id]?.paymentBank ?? ''}
                        onChange={(ev) => commitExpenseField(e.id, 'paymentBank', ev.target.value)}
                      >
                        <option value="">Select bank</option>
                        {BANKS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    className="mobile-delete-btn"
                    onClick={() => {
                      handleDeleteExpense(e.id);
                      setEditingExpenseId(null);
                    }}
                  >
                    <Trash2 size={16} /> Delete expense
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        <div>
          {/* Same row/height as the left column's Add-expense/Income/Fixed
              Expenses/Savings tabs, so the two white panels below line up
              at the same top edge instead of the chart card floating
              higher (it used to keep its own toggle inside the panel,
              which pushed the panel's actual top down past where the
              left column's panel starts). */}
          <div className="input-tabs">
            <button
              className={`btn small ${chartType === 'pie' ? '' : 'secondary'}`}
              onClick={() => setChartType('pie')}
            >
              Pie
            </button>
            <button
              className={`btn small ${chartType === 'bar' ? '' : 'secondary'}`}
              onClick={() => setChartType('bar')}
            >
              Bar
            </button>
            <button
              className={`btn small ${chartType === 'pareto' ? '' : 'secondary'}`}
              onClick={() => setChartType('pareto')}
            >
              Pareto
            </button>
            <button
              className={`btn small ${chartType === 'treemap' ? '' : 'secondary'}`}
              onClick={() => setChartType('treemap')}
            >
              Treemap
            </button>
          </div>
          <div className="panel">
            <h2 style={{ margin: '0 0 4px' }}>Spending by category</h2>
            {pieData.length === 0 ? (
              <div className="empty">Add an expense to see the breakdown.</div>
            ) : chartType === 'pie' ? (
              // Capped to the top PIE_TOP_N categories (see pieChartData) --
              // with everything else folded into one "Other" slice -- since a
              // pie chart is the one chart type where every extra category
              // makes every OTHER slice harder to read too. Slice labels only
              // show a percentage (and only for slices big enough to read,
              // >=4%) instead of the full name, since the Legend below
              // already lists every name.
              <>
                <ResponsiveContainer width="100%" height={360}>
                  <PieChart margin={{ top: 20, right: 20, bottom: 0, left: 20 }}>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cy="46%"
                      outerRadius={95}
                      isAnimationActive={false}
                      label={({ percent }) => (percent >= 0.04 ? `${Math.round(percent * 100)}%` : '')}
                      labelLine={false}
                    >
                      {pieChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, lineHeight: '18px', paddingTop: 10 }}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {pieData.length > PIE_TOP_N && (
                  <div className="muted-small" style={{ marginTop: 4 }}>
                    Showing your top {PIE_TOP_N} categories -- the rest are grouped into "Other" to keep this readable. Switch to Treemap or Bar to see every category separately.
                  </div>
                )}
              </>
            ) : chartType === 'bar' ? (
              // Thinner bars (7px) than the original version so the chart
              // stays compact per category, but given more vertical room to
              // grow overall (maxHeight 520 vs. the earlier 380, and more
              // height per row) so more categories are visible without
              // scrolling -- only once the list gets genuinely long does the
              // scrollable cap kick in.
              <div style={{ maxHeight: 520, overflowY: pieData.length > 17 ? 'auto' : 'visible' }}>
                <ResponsiveContainer width="100%" height={Math.max(180, pieData.length * 30)}>
                  <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 8.5 }} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={95}
                      tick={{ fontSize: 8.5 }}
                      tickFormatter={(name) => (name.length > 13 ? name.slice(0, 13) + '…' : name)}
                    />
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Bar dataKey="value" barSize={9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                      <LabelList dataKey="value" content={DirhamBarLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : chartType === 'treemap' ? (
              // Every category gets its own proportionally-sized box with its
              // own label printed inside it -- unlike a pie, nothing has to
              // compete for space around a shared ring, so this stays legible
              // no matter how many categories there are. The smallest
              // categories just render as an unlabeled sliver of color
              // instead of overlapping text (see TreemapTile).
              <ResponsiveContainer width="100%" height={360}>
                <Treemap
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive={false}
                  content={<TreemapTile />}
                >
                  <Tooltip formatter={(v) => fmt(v)} />
                </Treemap>
              </ResponsiveContainer>
            ) : (
              // Pareto -- bar thickness and label size shrink as the category
              // count grows (see paretoBarSize/paretoFontSize/paretoMaxNameLen
              // above) so every category always fits within the chart's own
              // width. No horizontal scrolling needed regardless of count.
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={paretoData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: paretoFontSize }}
                    interval={0}
                    angle={-50}
                    textAnchor="end"
                    height={75}
                    tickFormatter={(name) => (name.length > paretoMaxNameLen ? name.slice(0, paretoMaxNameLen) + '…' : name)}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 9 }} width={40} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v) => v + '%'}
                    tick={{ fontSize: 9 }}
                    width={34}
                  />
                  <Tooltip
                    formatter={(v, key) => (key === 'cumulative' ? v + '%' : fmt(v))}
                  />
                  <Bar yAxisId="left" dataKey="value" barSize={paretoBarSize} isAnimationActive={false}>
                    {paretoData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>
                AI Insights <AiTag />
              </h2>
              <button
                className="btn small secondary"
                onClick={generateMonthlyDigest}
                disabled={aiDigestLoading || pieData.length === 0}
              >
                {aiDigestLoading ? 'Thinking...' : aiDigest ? 'Refresh' : 'Generate'}
              </button>
            </div>
            {pieData.length === 0 ? (
              <div className="empty">Add an expense to get insights on this month.</div>
            ) : aiDigest && aiDigestMonthKey === monthKey(currentMonth) ? (
              <div className="muted-small" style={{ lineHeight: 1.6, whiteSpace: 'pre-line', color: 'var(--text)' }}>
                {aiDigest}
              </div>
            ) : aiDigestError ? (
              <div className="muted-small">Couldn't generate insights right now -- try again in a moment.</div>
            ) : (
              <div className="muted-small">
                Get a short AI-written summary of {monthLabel(currentMonth)}'s spending, with a couple of suggestions -- tap Generate.
              </div>
            )}
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>
                Budget Coach <AiTag />
              </h2>
              <button className="btn small secondary" onClick={generateBudgetCoach} disabled={coachLoading}>
                {coachLoading ? 'Analyzing...' : coachResult ? 'Re-analyze' : 'Analyze trends'}
              </button>
            </div>
            <div className="muted-small" style={{ marginBottom: 10 }}>
              Looks across the last 6 months (not just the one you're viewing) for patterns -- categories that stay over budget, spending trending up or down, whether your savings goal still looks realistic. Suggestions only -- nothing here changes your Settings automatically.
            </div>
            {coachResult ? (
              <div className="muted-small" style={{ lineHeight: 1.6, whiteSpace: 'pre-line', color: 'var(--text)' }}>
                {coachResult}
              </div>
            ) : coachError ? (
              <div className="muted-small">Couldn't analyze trends right now -- try again in a moment.</div>
            ) : (
              <div className="empty">Tap "Analyze trends" to get a coaching read on your last 6 months.</div>
            )}
          </div>

          {activePanel === 'members' && (
          <div className="panel" ref={panelRef}>
              <div>
                <h2>Users</h2>

                <div className="my-details-box" style={{ marginBottom: 18, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div className="muted-small" style={{ fontWeight: 600, marginBottom: 8 }}>My details</div>
                  <div className="row">
                    <div className="field">
                      <label>Full name</label>
                      <input
                        type="text"
                        value={myDetailsDraft.name}
                        onChange={(e) => setMyDetailsDraft((d) => ({ ...d, name: e.target.value }))}
                        onBlur={(e) => commitMyDetailsField('name', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Phone (optional)</label>
                      <input
                        type="text"
                        value={myDetailsDraft.phone}
                        onChange={(e) => setMyDetailsDraft((d) => ({ ...d, phone: e.target.value }))}
                        onBlur={(e) => commitMyDetailsField('phone', e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Location</label>
                      <input
                        type="text"
                        value={myDetailsDraft.location}
                        onChange={(e) => setMyDetailsDraft((d) => ({ ...d, location: e.target.value }))}
                        onBlur={(e) => commitMyDetailsField('location', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="muted-small" style={{ marginTop: 4 }}>Changes save automatically. Use this to fill in or fix your own info, including for accounts created before this field existed.</div>
                </div>

                <div className="muted-small" style={{ marginBottom: 4, fontWeight: 600 }}>
                  {members.length + pendingInvites.length} total -- {members.length} active, {pendingInvites.length} pending
                </div>
                {isOwner && (
                  <div className="muted-small" style={{ marginBottom: 6 }}>
                    As owner, you can fill in or fix Name / Phone / Location for anyone below -- handy for family members who haven't set theirs yet.
                  </div>
                )}
                <div className="table-scroll">
                <table className="responsive-table users-table">
                  <colgroup>
                    <col style={{ width: '20%' }} /><col style={{ width: '16%' }} />
                    <col style={{ width: '18%' }} /><col style={{ width: '26%' }} /><col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr><th>Name</th><th>Email</th><th>Phone</th><th>Location</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={'m-' + m.id}>
                        {isOwner ? (
                          <>
                            <td data-label="Name">
                              <input
                                data-editable
                                type="text"
                                placeholder="--"
                                value={memberDetailDrafts[m.id]?.name ?? ''}
                                onChange={(e) => updateMemberDetailDraft(m.id, 'name', e.target.value)}
                                onBlur={(e) => commitMemberDetailField(m.id, 'name', e.target.value)}
                              />
                            </td>
                            <td data-label="Email">{m.email}</td>
                            <td data-label="Phone">
                              <input
                                data-editable
                                type="text"
                                placeholder="--"
                                value={memberDetailDrafts[m.id]?.phone ?? ''}
                                onChange={(e) => updateMemberDetailDraft(m.id, 'phone', e.target.value)}
                                onBlur={(e) => commitMemberDetailField(m.id, 'phone', e.target.value)}
                              />
                            </td>
                            <td data-label="Location">
                              <input
                                data-editable
                                type="text"
                                placeholder="--"
                                value={memberDetailDrafts[m.id]?.location ?? ''}
                                onChange={(e) => updateMemberDetailDraft(m.id, 'location', e.target.value)}
                                onBlur={(e) => commitMemberDetailField(m.id, 'location', e.target.value)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td data-label="Name">{m.name || <span className="muted-small">--</span>}</td>
                            <td data-label="Email">{m.email}</td>
                            <td className="muted-small" data-label="Phone">{m.phone || '--'}</td>
                            <td className="muted-small" data-label="Location">{m.location || '--'}</td>
                          </>
                        )}
                        <td data-label="Status"><span className="status-pill active">Active</span></td>
                      </tr>
                    ))}
                    {pendingInvites.map((inv) => (
                      <tr key={'p-' + inv.id}>
                        {isOwner ? (
                          <>
                            <td data-label="Name">
                              <input
                                data-editable
                                type="text"
                                placeholder="--"
                                value={inviteDetailDrafts[inv.id]?.name ?? ''}
                                onChange={(e) => updateInviteDetailDraft(inv.id, 'name', e.target.value)}
                                onBlur={(e) => commitInviteDetailField(inv.id, 'name', e.target.value)}
                              />
                            </td>
                            <td data-label="Email">{inv.email}</td>
                            <td data-label="Phone">
                              <input
                                data-editable
                                type="text"
                                placeholder="--"
                                value={inviteDetailDrafts[inv.id]?.phone ?? ''}
                                onChange={(e) => updateInviteDetailDraft(inv.id, 'phone', e.target.value)}
                                onBlur={(e) => commitInviteDetailField(inv.id, 'phone', e.target.value)}
                              />
                            </td>
                            <td data-label="Location">
                              <input
                                data-editable
                                type="text"
                                placeholder="--"
                                value={inviteDetailDrafts[inv.id]?.location ?? ''}
                                onChange={(e) => updateInviteDetailDraft(inv.id, 'location', e.target.value)}
                                onBlur={(e) => commitInviteDetailField(inv.id, 'location', e.target.value)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td data-label="Name">{inv.name || <span className="muted-small">--</span>}</td>
                            <td data-label="Email">{inv.email}</td>
                            <td className="muted-small" data-label="Phone">{inv.phone || '--'}</td>
                            <td className="muted-small" data-label="Location">{inv.location || '--'}</td>
                          </>
                        )}
                        <td data-label="Status"><span className="status-pill pending">Pending</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {isOwner && members.some((m) => m.role !== 'owner') && (
                  <div style={{ marginTop: 14 }}>
                    <div className="muted-small" style={{ marginBottom: 4, fontWeight: 600 }}>Change a member's relation</div>
                    {members.filter((m) => m.role !== 'owner').map((m) => (
                      <div className="row" key={m.id} style={{ alignItems: 'center', marginBottom: 6 }}>
                        <span className="muted-small" style={{ flex: 1 }}>{m.name || m.email}</span>
                        <select value={m.relation} onChange={(e) => handleUpdateMemberRelation(m.id, e.target.value)}>
                          {RELATIONS.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {isOwner && (
                  <>
                    <div className="muted-small" style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>
                      Invite someone new
                    </div>
                    {Math.max(0, members.length - 1) + pendingInvites.length >= MAX_ADDITIONAL_USERS ? (
                      <div
                        className="muted-small"
                        style={{
                          marginTop: 4, padding: '12px 14px', borderRadius: 10,
                          background: 'var(--accent-light)', border: '1px solid var(--border)', color: 'var(--text)',
                        }}
                      >
                        <strong>Free plan limit reached</strong> -- this household already has the owner plus {MAX_ADDITIONAL_USERS} more people (active + pending). Remove a pending invite or an existing member to invite someone else, or upgrade for more seats.
                      </div>
                    ) : (
                    <>
                    <form className="row" onSubmit={handleSendInvite}>
                      <input
                        type="email"
                        placeholder="Invite by email"
                        style={{ flex: 1.2 }}
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                      <select value={inviteRelation} onChange={(e) => setInviteRelation(e.target.value)}>
                        {RELATIONS.filter((r) => r !== 'Self').map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <button className="btn secondary small" type="submit">Invite</button>
                    </form>
                    <div className="muted-small" style={{ marginTop: 6 }}>
                      They'll land in this household automatically the moment they sign up (or sign in) with this exact email address -- an invite notification email is also sent to let them know, once you've set up email sending (see Settings/Vercel setup). Free plan: owner + {MAX_ADDITIONAL_USERS} more people.
                    </div>
                    </>
                    )}
                    {inviteStatus === 'sending' && (
                      <div className="muted-small" style={{ marginTop: 6 }}>Sending...</div>
                    )}
                    {inviteStatus === 'sent' && (
                      <div className="muted-small" style={{ marginTop: 6, color: 'var(--ok)' }}>Invite created and notification email sent.</div>
                    )}
                    {inviteStatus.startsWith('sent-no-email') && (
                      <div className="muted-small" style={{ marginTop: 6, color: '#92400e' }}>
                        Invite created -- they'll still auto-join when they sign up with this email. The notification email itself couldn't be sent ({inviteStatus.replace('sent-no-email: ', '')}); share the sign-up link with them directly for now.
                      </div>
                    )}
                    {pendingInvites.length > 0 && (
                      <div className="cat-list" style={{ marginTop: 10 }}>
                        {pendingInvites.map((inv) => (
                          <div className="cat-chip" key={inv.id}>
                            {inv.email}
                            <button onClick={() => handleCancelInvite(inv.id)} title="Cancel invite"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
          </div>
          )}

          {activePanel === 'help' && (
          <div className="panel" ref={panelRef}>
            <h2>How to use this app</h2>
            <div className="muted-small" style={{ lineHeight: 1.6 }}>
              <p><strong>Add an expense</strong> -- log one-off spending (groceries, dining, shopping). Pick the date, category, a short description, and the amount, then Add. It appears under "Expenses this month" and is always editable there -- just type into a field and it saves. The note icon (<StickyNote size={11} style={{ verticalAlign: -2 }} />) next to Amount opens a spot for a longer free-text description, and the paperclip (<Paperclip size={11} style={{ verticalAlign: -2 }} />) lets you attach one photo or PDF (5MB max) -- a receipt, warranty, or anything else worth keeping with that expense. Both are optional. Once saved, a small icon appears next to the expense if it has a note or attachment -- click it to read the note or open the file.</p>
              <p><strong>Scan a receipt</strong> -- below the Add-an-expense form, upload a photo of a receipt (or a screenshot/sheet listing several expenses) and Claude will read it for you. You'll see an editable review list first -- fix anything that looks wrong, untick what you don't want, then add only what you confirm. Nothing is saved automatically.</p>
              <p><strong>Income</strong> -- add each income source per month (e.g. Salary). Income does NOT roll over automatically -- since pay can change month to month (deductions, advances, etc.), add a fresh row each month with that month's actual amount, or edit an existing row's Month field forward. Every field auto-saves.</p>
              <p><strong>Fixed Expenses</strong> -- for recurring bills, loans, EMIs, and rent. Set a Start date, an optional End date, and how often it repeats (Monthly, Alternate month, Quarterly, Half-yearly, Once a year). Every field auto-saves as you edit -- there's no Save button to click. Set a Due date to get an in-app reminder starting 3 days before it's due, and an email reminder if it's set up. It has the same optional note + attachment icons as Add an expense -- handy for keeping a loan agreement or lease document attached to the bill itself.</p>
              <p><strong>Savings</strong> -- set how much you'd like to set aside for the month, e.g. "Emergency fund" or "Investment". Works exactly like Income: entered fresh per month with no auto-rollover, since the amount you're able to save can change month to month -- add a new row each month, or edit an existing row's Month field forward. Since money you set aside is no longer available to spend, it's treated the same as an expense: it's counted in "Spent so far" and "Combined expenses", and subtracted in "Remaining" and "Net", in addition to getting its own page in the PDF report so you can see planned savings build up over time.</p>
              <p><strong>Expenses this month</strong> is always visible below the tabs so you can see what's been logged without switching tabs. It also auto-saves.</p>
              <p><strong>Spending by category</strong> chart -- toggle between Pie, Bar, Pareto, and Treemap. The Pie groups smaller categories into "Other" to stay readable; Bar and Treemap show every category individually. The totals cards above show your combined income, combined expenses (split into Regular, Fixed, and Savings), and what's left of your budget and income after all three are accounted for.</p>
              <p><strong>AI Insights</strong> -- tap Generate below the chart for a short AI-written summary of the month you're viewing (spending patterns, whether you're over budget, and a couple of concrete suggestions). It only runs when you tap the button -- never automatically -- and Refresh regenerates it if your numbers have changed.</p>
              <p><strong>Budget Coach</strong> -- unlike AI Insights (one month at a time), Coach looks across your last 6 months for patterns: a category that keeps going over budget, spending trending up or down, or a savings goal that no longer looks realistic. It only ever writes out suggestions -- it never changes your Settings for you.</p>
              <p><strong>Chat BoT</strong> -- the round chat bubble in the corner (drag it anywhere on screen) answers questions about your household's own numbers across every tab -- Income, Fixed Expenses, Savings, one-off spending, and who's in the household -- and can also answer "how do I..." questions about the app itself and give suggestions when asked. It can only see the data already in the app -- nothing outside it.</p>
              <p><strong>Report</strong> -- generate a PDF for any date range, then view it on screen, download it, or email it. Each topic gets its own page -- Income, Expenses, Fixed Expenses, Savings, Spend Analysis (Pareto chart), and Recommendations -- except the Category Breakdown bar chart and the Summary table, which share one page by default and only split onto two once the chart itself grows long enough to need the room. Every table also auto-shrinks its text to try to fit on one page first, and only flows onto a second page if the list is too long even at a readable size. The last page closes with a data & privacy note.</p>
              <p><strong>Settings</strong> -- set your total monthly budget, currency, add/rename categories, and set optional per-category budget caps (you'll get a notification in the bell icon if you go over). Every field auto-saves as you edit -- there's no Save button to click.</p>
              <p><strong>Notifications</strong> -- the bell icon next to Help (top-right) replaces the old always-on red banners. It shows a count of unread items -- over-total-budget, over a category's budget, or a bill due soon -- and opening it lists them and marks them read.</p>
              <p><strong>Users</strong> -- see who's active in the household and who's been invited but hasn't joined yet, with full Name/Email/Phone/Location. Owners can invite new members (which also sends them a notification email), fill in or fix anyone's Name/Phone/Location, and edit their own details under "My details" -- handy for accounts created before these fields existed. The Admin console (if you have access) is separate and never visible to other household members.</p>
              <p>All figures use your household's chosen currency, set in Settings. Your data is confidential and private to your household -- it's never shared with anyone outside it.</p>
              <p>The small <strong>{formatVersionBadge()}</strong> badge in the top-right corner shows which build you're on. The app updates itself automatically -- you'll never need to manually update anything -- but if something looks off, reload the page and check that it matches the latest you were told about.</p>
            </div>
          </div>
          )}

          {activePanel === 'report' && (
          <div className="panel" ref={panelRef}>
            <h2>Report</h2>
            <div className="muted-small" style={{ marginBottom: 12 }}>
              Generate a PDF for a date range, then view it on screen, download it, or email it. Category Breakdown and Summary share a page unless the chart runs long; Income, Expenses, Fixed Expenses, Savings, Spend Analysis, and Recommendations each get their own dedicated page. Tables auto-shrink to try to fit one page before flowing onto a second.
            </div>
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>From</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => { setReportFrom(e.target.value); setReportDoc(null); setReportStatus(''); setReportPreviewOpen(false); }}
                />
              </div>
              <div className="field">
                <label>To</label>
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => { setReportTo(e.target.value); setReportDoc(null); setReportStatus(''); setReportPreviewOpen(false); }}
                />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn secondary small" onClick={handleGenerateReport}>Generate report</button>
              </div>
            </div>

            {reportDoc && (
              <div style={{ marginTop: 8 }}>
                <div className="muted-small" style={{ marginBottom: 8 }}>
                  Report ready for {reportDoc.rangeLabel}.
                </div>
                <div className="row" style={{ marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    className={`btn small ${reportPreviewOpen ? '' : 'secondary'}`}
                    onClick={() => setReportPreviewOpen((v) => !v)}
                  >
                    {reportPreviewOpen ? 'Hide on-screen report' : 'View on screen'}
                  </button>
                  <button className="btn secondary small" onClick={handleDownloadReport}>Download</button>
                </div>
                <form className="row" onSubmit={handleEmailReport} style={{ alignItems: 'center' }}>
                  <input
                    type="email"
                    placeholder="Email address to send report to"
                    style={{ flex: 1 }}
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    required
                  />
                  <button className="btn secondary small" type="submit" disabled={reportStatus === 'sending'}>
                    {reportStatus === 'sending' ? 'Sending...' : 'Email report'}
                  </button>
                </form>
                {reportStatus === 'sent' && <div className="muted-small" style={{ marginTop: 6, color: '#22c55e' }}>Report emailed successfully.</div>}
                {reportStatus.startsWith('error') && <div className="muted-small" style={{ marginTop: 6, color: '#ef4444' }}>{reportStatus.replace('error: ', '')}</div>}

                {reportPreviewOpen && (
                  // On-screen preview -- the exact same PDF that Download and
                  // Email produce, presented in a polished card (rounded
                  // frame, subtle shadow, teal title bar) instead of a bare
                  // browser PDF plugin, so viewing it in-app feels like a
                  // deliberate feature rather than an afterthought.
                  <div
                    style={{
                      marginTop: 16,
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                      background: '#fff',
                    }}
                  >
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                        color: '#fff',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        Budget Report -- {reportDoc.rangeLabel}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.85 }}>{reportDoc.filename}</div>
                    </div>
                    <iframe
                      title="Budget report preview"
                      src={reportDoc.previewUrl}
                      style={{
                        width: '100%',
                        height: 'min(85vh, 1000px)',
                        border: 'none',
                        display: 'block',
                        background: '#525659',
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {activePanel === 'settings' && (
          <div className="panel" ref={panelRef}>
              <div>
                <h2>Settings</h2>
                <div className="row" style={{ gap: 8, marginBottom: 16 }}>
                  <button
                    className={`btn-teal ${settingsSubTab === 'app' ? '' : 'secondary'}`}
                    onClick={() => setSettingsSubTab('app')}
                  >
                    App Settings
                  </button>
                  {isAdmin && (
                    <button
                      className={`btn-teal ${settingsSubTab === 'admin' ? '' : 'secondary'}`}
                      onClick={() => setSettingsSubTab('admin')}
                    >
                      Admin Console
                    </button>
                  )}
                </div>

                {settingsSubTab === 'admin' && isAdmin ? (
                  <AdminConsole embedded onClose={() => setSettingsSubTab('app')} />
                ) : (
                <>
                <div className="field" style={{ marginBottom: 12, maxWidth: 340 }}>
                  <label>Household name</label>
                  {isOwner ? (
                    <input
                      type="text"
                      value={householdNameDraft}
                      onChange={(e) => setHouseholdNameDraft(e.target.value)}
                      onBlur={(e) => commitHouseholdName(e.target.value)}
                    />
                  ) : (
                    <div className="muted-small" style={{ padding: '9px 0' }}>
                      {household.name || 'Hearth'} <span style={{ opacity: .75 }}>(only the owner can rename)</span>
                    </div>
                  )}
                </div>
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="field">
                    <label>Total monthly budget</label>
                    <div className="amount-field-wrap">
                      <span className="currency-prefix"><CurrencyPrefix /></span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        style={{ '--amt-px': formAmountPx(totalBudgetDraft) + 'px' }}
                        value={totalBudgetDraft}
                        onChange={(e) => setTotalBudgetDraft(e.target.value)}
                        onBlur={(e) => commitTotalBudget(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Currency</label>
                    <select value={currencyDraft} onChange={(e) => commitCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="muted-small" style={{ marginBottom: 12 }}>Changes save automatically as you edit -- there's no Save button to click.</div>

                <div className="field">
                  <label>Add category</label>
                  <div className="row">
                    <input
                      type="text"
                      placeholder="Category name"
                      style={{ flex: 1 }}
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <button className="btn secondary small" onClick={handleAddCategory}>Add</button>
                  </div>
                </div>

                <div className="muted-small" style={{ marginBottom: 6 }}>Category names (click to rename)</div>
                <div className="cat-list">
                  {categories.map((c) => (
                    <div className="cat-chip" key={c.id}>
                      <input
                        value={categoryNameDrafts[c.id] ?? c.name}
                        onChange={(e) => setCategoryNameDrafts({ ...categoryNameDrafts, [c.id]: e.target.value })}
                        onBlur={() => handleRenameCategory(c.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        style={{
                          border: 'none', background: 'transparent', color: 'inherit', fontWeight: 600,
                          fontSize: 12, width: Math.max(50, (categoryNameDrafts[c.id]?.length || c.name.length) * 7),
                        }}
                      />
                      <button onClick={() => handleRemoveCategory(c.id, c.name)} title="Remove category"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="muted-small">Per-category budgets (optional)</label>
                  {categories.map((c) => (
                    <div className="cat-budget-row" key={c.id}>
                      <span>{c.name}</span>
                      <div className="amount-field-wrap tight">
                        <span className="currency-prefix"><CurrencyPrefix /></span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={categoryBudgetDrafts[c.id] ?? ''}
                          onChange={(e) =>
                            setCategoryBudgetDrafts({ ...categoryBudgetDrafts, [c.id]: e.target.value })
                          }
                          onBlur={(e) => commitCategoryBudget(c.id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {categories.some((c) => c.monthly_budget > 0) && (
                  <div style={{ marginTop: 18 }}>
                    <label className="muted-small">
                      This month's spending vs. budget (shown here, and categories over budget also trigger a notification in the bell icon, top-right)
                    </label>
                    {categories.filter((c) => c.monthly_budget > 0).map((c) => {
                      const spent = byCategory[c.name] || 0;
                      const over = spent > c.monthly_budget;
                      return (
                        <div className="cat-budget-row" key={c.id}>
                          <span>{c.name}</span>
                          <span className={over ? 'muted-small' : 'muted-small'} style={{ color: over ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                            <Amt value={spent} /> / <Amt value={c.monthly_budget} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                </>
                )}
              </div>
          </div>
          )}
        </div>
      </div>

      <div className="app-footer">
        Your data is confidential and private to this household. It is never shared with anyone outside it.
      </div>

      {addSheetOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => setAddSheetOpen(false)} />
      )}

      {/* Mobile-only bottom navigation + floating add button (hidden on
          desktop via CSS, see .mobile-bottom-nav / .mobile-fab in
          index.css). This reuses the exact same state and handlers as the
          existing top action row and input tabs -- nothing about desktop
          changes, this just gives a phone user a thumb-reachable way to
          jump straight to the main destinations instead of scrolling back
          up to the top of a long page every time. */}
      <button
        className="mobile-fab"
        onClick={() => goToAdd('expense')}
        aria-label="Add an expense"
        title="Add an expense"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
      <nav className="mobile-bottom-nav">
        <button className={!activePanel && !addSheetOpen ? 'active' : ''} onClick={goToOverview}>
          <Home size={20} strokeWidth={2.2} />
          <span>Home</span>
        </button>
        <button onClick={() => goToAdd(inputTab || 'expense')}>
          <Plus size={20} strokeWidth={2.2} />
          <span>Add</span>
        </button>
        <button className={activePanel === 'report' ? 'active' : ''} onClick={() => togglePanel('report')}>
          <FileText size={20} strokeWidth={2.2} />
          <span>Report</span>
        </button>
        {isOwner && (
          <button className={activePanel === 'members' ? 'active' : ''} onClick={() => togglePanel('members')}>
            <UsersIcon size={20} strokeWidth={2.2} />
            <span>Users</span>
          </button>
        )}
        <button className={activePanel === 'settings' ? 'active' : ''} onClick={() => togglePanel('settings')}>
          <SettingsIcon size={20} strokeWidth={2.2} />
          <span>Settings</span>
        </button>
      </nav>

    </div>
  );
}
