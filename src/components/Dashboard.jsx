
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  ComposedChart, Line, Treemap,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../supabaseClient';
import AdminConsole from './AdminConsole.jsx';
import EManual from './EManual.jsx';
import { formatVersionBadge, APP_VERSION } from '../version.js';
import {
  Home, Plus, FileText, Users as UsersIcon, Settings as SettingsIcon,
  Pencil, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, Camera, MessageCircle, Bot, Sparkles, User,
  Palette, Check, StickyNote, Paperclip, ExternalLink, Mail, Lightbulb,
  Wallet, CalendarClock, ShoppingCart, PiggyBank, HelpCircle, Filter, Sun, Moon, RefreshCw, Landmark, BookOpen,
} from 'lucide-react';

// v1.89: cross-browser searchable dropdown, replacing the old
// <input list="..."> + <datalist> combo. Native HTML5 datalist support is
// inconsistent across browsers/engines (and can silently fail to show
// suggestions depending on the page's rendering state), which was causing
// Bank/Currency selection to appear broken for some users even though the
// underlying save logic worked. This component renders its own dropdown
// list via a portal, so it behaves identically everywhere.
function SearchableCombobox({ value, onChange, onCommit, options, placeholder, style }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [displayValue, setDisplayValue] = useState(value || '');
  const inputRef = useRef(null);
  useEffect(() => { setDisplayValue(value || ''); }, [value]);
  const norm = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );
  const filtered = useMemo(() => {
    const q = (displayValue || '').toLowerCase().trim();
    const list = q
      ? norm.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      : norm;
    return list.slice(0, 60);
  }, [displayValue, norm]);
  function updatePos() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  }
  function selectOption(opt) {
    setDisplayValue(opt.value);
    onChange(opt.value);
    if (onCommit) onCommit(opt.value);
    setOpen(false);
  }
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        style={style}
        autoComplete="off"
        onFocus={() => {
          // v1.90: clear the visible text on focus (same trick already used
          // for the Settings Currency field) so the FULL option list shows
          // immediately, instead of being filtered down to near-nothing by
          // whatever value is already sitting in the field -- previously a
          // user had to manually delete the existing text before any
          // suggestions would appear, which looked broken.
          setDisplayValue('');
          updatePos();
          setOpen(true);
        }}
        onChange={(e) => { setDisplayValue(e.target.value); onChange(e.target.value); updatePos(); setOpen(true); }}
        onBlur={(e) => {
          setOpen(false);
          const finalValue = e.target.value || value || '';
          setDisplayValue(finalValue);
          onChange(finalValue);
          if (onCommit) onCommit(finalValue);
        }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); e.currentTarget.blur(); } }}
      />
      {open && filtered.length > 0 && rect && createPortal(
        <div
          style={{
            position: 'fixed',
            top: rect.bottom + 2,
            left: rect.left,
            width: Math.max(rect.width, 160),
            maxHeight: 220,
            overflowY: 'auto',
            background: '#1c2333',
            border: '1px solid #3a445c',
            borderRadius: 6,
            zIndex: 99999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          {filtered.map((opt) => (
            <div
              key={opt.value}
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', color: '#e6e9f0' }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}


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

// Header logo -- a small, resized copy of the splash screen's own circular
// "platform" badge (glowing blue sphere + "AI POWERED Hearth" text), per
// explicit request to use that badge as the app's logo everywhere rather
// than two different marks. The dark navy ring that originally surrounded
// the sphere was removed per explicit follow-up request ("dark blue ring
// around the logo... can u remove that and keep the rest asis") -- sphere
// + text are unchanged, just no outer ring stroke around them anymore.
function HearthMark({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Same 3-stop blue gradient as the splash sphere (Splash.jsx's
            platformSphere) -- own id since this and the splash badge can
            both be mounted at once (the splash overlays on top of the
            already-loaded Dashboard for its first 6 seconds), and SVG
            gradient ids must be unique across the whole page. */}
        <radialGradient id="headerBadgeSphere" cx="34%" cy="28%" r="78%">
          <stop offset="0" stopColor="#7fabf7" />
          <stop offset="48%" stopColor="#33509f" />
          <stop offset="100%" stopColor="#0e1a3f" />
        </radialGradient>
      </defs>
      <circle className="platform-sphere-pulse" cx="50" cy="50" r="38" fill="url(#headerBadgeSphere)" />
      <text x="50" y="36" textAnchor="middle" className="header-badge-kicker">AI POWERED</text>
      <text x="50" y="54" textAnchor="middle" className="header-badge-brand">Hearth</text>
    </svg>
  );
}

const COLORS = [
  '#f97316', '#0ea5e9', '#a855f7', '#22c55e', '#ef4444',
  '#eab308', '#14b8a6', '#ec4899', '#6366f1', '#84cc16',
  '#06b6d4', '#f43f5e',
];
const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];
const CURRENCIES = ['AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL'];
const CURRENCY_REGIONS = { AED: 'United Arab Emirates', AFN: 'Afghanistan', ALL: 'Albania', AMD: 'Armenia', ANG: 'CuraÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ao & Sint Maarten', AOA: 'Angola', ARS: 'Argentina', AUD: 'Australia', AWG: 'Aruba', AZN: 'Azerbaijan', BAM: 'Bosnia & Herzegovina', BBD: 'Barbados', BDT: 'Bangladesh', BGN: 'Bulgaria', BHD: 'Bahrain', BIF: 'Burundi', BMD: 'Bermuda', BND: 'Brunei', BOB: 'Bolivia', BRL: 'Brazil', BSD: 'Bahamas', BTN: 'Bhutan', BWP: 'Botswana', BYN: 'Belarus', BZD: 'Belize', CAD: 'Canada', CDF: 'DR Congo', CHF: 'Switzerland', CLP: 'Chile', CNY: 'China', COP: 'Colombia', CRC: 'Costa Rica', CUP: 'Cuba', CVE: 'Cape Verde', CZK: 'Czech Republic', DJF: 'Djibouti', DKK: 'Denmark', DOP: 'Dominican Republic', DZD: 'Algeria', EGP: 'Egypt', ERN: 'Eritrea', ETB: 'Ethiopia', EUR: 'Eurozone', FJD: 'Fiji', FKP: 'Falkland Islands', GBP: 'United Kingdom', GEL: 'Georgia', GHS: 'Ghana', GIP: 'Gibraltar', GMD: 'Gambia', GNF: 'Guinea', GTQ: 'Guatemala', GYD: 'Guyana', HKD: 'Hong Kong', HNL: 'Honduras', HTG: 'Haiti', HUF: 'Hungary', IDR: 'Indonesia', ILS: 'Israel', INR: 'India', IQD: 'Iraq', IRR: 'Iran', ISK: 'Iceland', JMD: 'Jamaica', JOD: 'Jordan', JPY: 'Japan', KES: 'Kenya', KGS: 'Kyrgyzstan', KHR: 'Cambodia', KMF: 'Comoros', KPW: 'North Korea', KRW: 'South Korea', KWD: 'Kuwait', KYD: 'Cayman Islands', KZT: 'Kazakhstan', LAK: 'Laos', LBP: 'Lebanon', LKR: 'Sri Lanka', LRD: 'Liberia', LSL: 'Lesotho', LYD: 'Libya', MAD: 'Morocco', MDL: 'Moldova', MGA: 'Madagascar', MKD: 'North Macedonia', MMK: 'Myanmar', MNT: 'Mongolia', MOP: 'Macau', MRU: 'Mauritania', MUR: 'Mauritius', MVR: 'Maldives', MWK: 'Malawi', MXN: 'Mexico', MYR: 'Malaysia', MZN: 'Mozambique', NAD: 'Namibia', NGN: 'Nigeria', NIO: 'Nicaragua', NOK: 'Norway', NPR: 'Nepal', NZD: 'New Zealand', OMR: 'Oman', PAB: 'Panama', PEN: 'Peru', PGK: 'Papua New Guinea', PHP: 'Philippines', PKR: 'Pakistan', PLN: 'Poland', PYG: 'Paraguay', QAR: 'Qatar', RON: 'Romania', RSD: 'Serbia', RUB: 'Russia', RWF: 'Rwanda', SAR: 'Saudi Arabia', SBD: 'Solomon Islands', SCR: 'Seychelles', SDG: 'Sudan', SEK: 'Sweden', SGD: 'Singapore', SHP: 'Saint Helena', SLE: 'Sierra Leone', SOS: 'Somalia', SRD: 'Suriname', SSP: 'South Sudan', STN: 'SÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½o TomÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ & PrÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ncipe', SYP: 'Syria', SZL: 'Eswatini', THB: 'Thailand', TJS: 'Tajikistan', TMT: 'Turkmenistan', TND: 'Tunisia', TOP: 'Tonga', TRY: 'Turkey', TTD: 'Trinidad & Tobago', TWD: 'Taiwan', TZS: 'Tanzania', UAH: 'Ukraine', UGX: 'Uganda', USD: 'United States', UYU: 'Uruguay', UZS: 'Uzbekistan', VES: 'Venezuela', VND: 'Vietnam', VUV: 'Vanuatu', WST: 'Samoa', XAF: 'Central Africa (CEMAC)', XCD: 'Eastern Caribbean', XOF: 'West Africa (UEMOA)', XPF: 'French Pacific', YER: 'Yemen', ZAR: 'South Africa', ZMW: 'Zambia', ZWL: 'Zimbabwe' };

// Shown as a prefix inside every amount field so what you're typing is
// unambiguous at a glance -- codes without one universally-recognized
// glyph (AED/SAR/PKR) just repeat the code itself, matching how fmt()
// already labels totals elsewhere in the app.
const CURRENCY_SYMBOLS = { AED: 'AED', AFN: 'AFN', ALL: 'ALL', AMD: 'AMD', ANG: 'ANG', AOA: 'AOA', ARS: '$', AUD: '$', AWG: 'AWG', AZN: 'AZN', BAM: 'BAM', BBD: '$', BDT: 'BDT', BGN: 'BGN', BHD: 'BHD', BIF: 'BIF', BMD: '$', BND: '$', BOB: 'BOB', BRL: 'R$', BSD: '$', BTN: 'BTN', BWP: 'P', BYN: 'BYN', BZD: 'BZ$', CAD: '$', CDF: 'CDF', CHF: 'CHF', CLP: '$', CNY: 'CNY', COP: '$', CRC: 'CRC', CUP: '$', CVE: 'CVE', CZK: 'CZK', DJF: 'DJF', DKK: 'DKK', DOP: 'RD$', DZD: 'DZD', EGP: 'EGP', ERN: 'ERN', ETB: 'ETB', EUR: 'EUR', FJD: '$', FKP: 'FKP', GBP: 'GBP', GEL: 'GEL', GHS: 'GHS', GIP: 'GIP', GMD: 'GMD', GNF: 'GNF', GTQ: 'GTQ', GYD: '$', HKD: '$', HNL: 'HNL', HTG: 'HTG', HUF: 'HUF', IDR: 'IDR', ILS: 'ILS', INR: 'INR', IQD: 'IQD', IRR: 'IRR', ISK: 'ISK', JMD: '$', JOD: 'JOD', JPY: 'JPY', KES: 'KES', KGS: 'KGS', KHR: 'KHR', KMF: 'KMF', KPW: 'KPW', KRW: 'KRW', KWD: 'KWD', KYD: '$', KZT: 'KZT', LAK: 'LAK', LBP: 'LBP', LKR: 'LKR', LRD: '$', LSL: 'LSL', LYD: 'LYD', MAD: 'MAD', MDL: 'MDL', MGA: 'MGA', MKD: 'MKD', MMK: 'MMK', MNT: 'MNT', MOP: 'MOP', MRU: 'MRU', MUR: 'MUR', MVR: 'MVR', MWK: 'MWK', MXN: '$', MYR: 'RM', MZN: 'MZN', NAD: '$', NGN: 'NGN', NIO: 'C$', NOK: 'NOK', NPR: 'NPR', NZD: '$', OMR: 'OMR', PAB: 'PAB', PEN: 'PEN', PGK: 'PGK', PHP: 'PHP', PKR: 'PKR', PLN: 'PLN', PYG: 'PYG', QAR: 'QAR', RON: 'RON', RSD: 'RSD', RUB: 'RUB', RWF: 'RWF', SAR: 'SAR', SBD: '$', SCR: 'SCR', SDG: 'SDG', SEK: 'SEK', SGD: '$', SHP: 'SHP', SLE: 'SLE', SOS: 'SOS', SRD: '$', SSP: 'SSP', STN: 'STN', SYP: 'SYP', SZL: 'SZL', THB: 'THB', TJS: 'TJS', TMT: 'TMT', TND: 'TND', TOP: 'TOP', TRY: 'TRY', TTD: '$', TWD: 'NT$', TZS: 'TZS', UAH: 'UAH', UGX: 'UGX', USD: '$', UYU: '$U', UZS: 'UZS', VES: 'VES', VND: 'VND', VUV: 'VUV', WST: 'WS$', XAF: 'XAF', XCD: '$', XOF: 'XOF', XPF: 'XPF', YER: 'YER', ZAR: 'R', ZMW: 'ZMW', ZWL: 'ZWL' };

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'alternate', label: 'Alternate month' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Once a year' },
];

// How an expense was paid. Bank name only matters (and only shows) for the
// two card options -- Cash has nothing to pick.
const PAYMENT_SOURCES = ['Cash', 'Credit Card', 'Debit Card', 'Bank'];
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
const RECURRING_PAYMENT_SOURCES = [...PAYMENT_SOURCES, 'Salary'];
const CARD_PAYMENT_SOURCES = ['Credit Card', 'Debit Card', 'Bank'];
// Free-tier household size cap: the owner plus this many additional people
// (active members + pending invites combined).
const MAX_ADDITIONAL_USERS = Infinity; // No cap on household size
// Common UAE retail banks, since this household is based in Dubai -- "Other"
// covers anything not listed rather than blocking entry.
// Major banks across UAE/GCC, Levant & Egypt, North America, UK, Europe,
// Australia/NZ, South Asia, East & Southeast Asia, Africa, and Latin America --
// each bank name includes its country/region so a global list of similarly
// named entries is still unambiguous at a glance. "Other" still covers
// anything not listed rather than blocking entry.
const BANKS = [
  'Emirates NBD (UAE)', 'ADCB (UAE)', 'FAB (First Abu Dhabi Bank) (UAE)', 'Dubai Islamic Bank (UAE)', 'Mashreq (UAE)', 'ADIB (UAE)', 'RAKBANK (UAE)', 'CBD (Commercial Bank of Dubai) (UAE)', 'HSBC UAE (UAE)', 'Standard Chartered UAE (UAE)', 'Citibank UAE (UAE)', 'Saudi National Bank (Saudi Arabia)', 'Al Rajhi Bank (Saudi Arabia)', 'Riyad Bank (Saudi Arabia)', 'SABB (Saudi Arabia)', 'Qatar National Bank (Qatar)', 'Doha Bank (Qatar)', 'National Bank of Kuwait (Kuwait)', 'Gulf Bank (Kuwait)', 'Bank Muscat (Oman)', 'Bank of Bahrain and Kuwait (Bahrain)', 'Ahli United Bank (Bahrain)', 'Bank Audi (Lebanon)', 'Byblos Bank (Lebanon)', 'Arab Bank (Jordan)', 'Bank of Jordan (Jordan)', 'National Bank of Egypt (Egypt)', 'CIB (Commercial International Bank) (Egypt)', 'Banque Misr (Egypt)', 'JPMorgan Chase (USA)', 'Bank of America (USA)', 'Wells Fargo (USA)', 'Citibank (USA)', 'U.S. Bank (USA)', 'PNC Bank (USA)', 'Truist (USA)', 'Capital One (USA)', 'TD Bank (USA)', 'Goldman Sachs (USA)', 'American Express (USA)', 'Charles Schwab Bank (USA)', 'USAA (USA)', 'Ally Bank (USA)', 'RBC Royal Bank (Canada)', 'TD Canada Trust (Canada)', 'Scotiabank (Canada)', 'BMO Bank of Montreal (Canada)', 'CIBC (Canada)', 'National Bank of Canada (Canada)', 'Barclays (UK)', 'HSBC UK (UK)', 'Lloyds Bank (UK)', 'NatWest (UK)', 'Santander UK (UK)', 'Nationwide (UK)', 'TSB (UK)', 'Halifax (UK)', 'Monzo (UK)', 'Revolut (UK)', 'Starling Bank (UK)', 'Deutsche Bank (Germany)', 'Commerzbank (Germany)', 'BNP Paribas (France)', 'Societe Generale (France)', 'Credit Agricole (France)', 'ING (Netherlands)', 'Rabobank (Netherlands)', 'ABN AMRO (Netherlands)', 'UniCredit (Italy)', 'Intesa Sanpaolo (Italy)', 'Banco Santander (Spain)', 'BBVA (Spain)', 'CaixaBank (Spain)', 'UBS (Switzerland)', 'Credit Suisse (Switzerland)', 'Nordea (Nordics)', 'Danske Bank (Nordics)', 'SEB (Nordics)', 'Swedbank (Nordics)', 'Erste Group (Austria)', 'Raiffeisen Bank (Austria)', 'KBC Bank (Belgium)', 'mBank (Poland)', 'PKO Bank Polski (Poland)', 'Commonwealth Bank (Australia)', 'Westpac (Australia)', 'ANZ (Australia)', 'NAB (National Australia Bank) (Australia)', 'Bendigo Bank (Australia)', 'ASB Bank (New Zealand)', 'ANZ New Zealand (New Zealand)', 'BNZ (New Zealand)', 'Kiwibank (New Zealand)', 'State Bank of India (India)', 'HDFC Bank (India)', 'ICICI Bank (India)', 'Axis Bank (India)', 'Kotak Mahindra Bank (India)', 'Punjab National Bank (India)', 'Bank of Baroda (India)', 'Yes Bank (India)', 'IndusInd Bank (India)', 'HBL (Habib Bank) (Pakistan)', 'UBL (United Bank) (Pakistan)', 'MCB Bank (Pakistan)', 'Meezan Bank (Pakistan)', 'Allied Bank (Pakistan)', 'National Bank of Pakistan (Pakistan)', 'Bank Alfalah (Pakistan)', 'ICBC (China)', 'China Construction Bank (China)', 'Bank of China (China)', 'Agricultural Bank of China (China)', 'Bank of Communications (China)', 'MUFG Bank (Japan)', 'Sumitomo Mitsui Banking (Japan)', 'Mizuho Bank (Japan)', 'Japan Post Bank (Japan)', 'KB Kookmin Bank (South Korea)', 'Shinhan Bank (South Korea)', 'Woori Bank (South Korea)', 'Hana Bank (South Korea)', 'DBS Bank (Singapore)', 'OCBC Bank (Singapore)', 'UOB (Singapore)', 'Maybank (Malaysia)', 'CIMB (Malaysia)', 'Bangkok Bank (Thailand)', 'Kasikornbank (Thailand)', 'BDO Unibank (Philippines)', 'BPI (Bank of the Philippine Islands) (Philippines)', 'Bank Mandiri (Indonesia)', 'BCA (Indonesia)', 'Vietcombank (Vietnam)', 'Standard Bank (South Africa)', 'FirstRand/FNB (South Africa)', 'ABSA (South Africa)', 'Nedbank (South Africa)', 'Access Bank (Nigeria)', 'GTBank (Nigeria)', 'Zenith Bank (Nigeria)', 'First Bank of Nigeria (Nigeria)', 'UBA (United Bank for Africa) (Nigeria)', 'Equity Bank (Kenya)', 'KCB Bank (Kenya)', 'Itau Unibanco (Brazil)', 'Banco do Brasil (Brazil)', 'Bradesco (Brazil)', 'Caixa Economica Federal (Brazil)', 'Santander Brasil (Brazil)', 'BBVA Mexico (Mexico)', 'Banorte (Mexico)', 'Citibanamex (Mexico)', 'Banco de Chile (Chile)', 'BancoEstado (Chile)', 'Bancolombia (Colombia)', 'Banco de Bogota (Colombia)', 'BBVA Argentina (Argentina)', 'Banco Galicia (Argentina)', 'Banco Santander Rio (Argentina)', 'Other',
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
// Renders one chip per picked-but-not-yet-uploaded file on the Income/Fixed
// Expenses/Regular Expenses/Savings add-forms, each with its own remove
// button -- replaces the old single "one file" chip now that a row can carry
// more than one attachment (per explicit request). `files` is a plain array
// of File objects; `onRemove(index)` drops just that one from the list.
function PendingAttachmentChips({ files, onRemove }) {
  if (!files || files.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="muted-small attachment-chip">
          <Paperclip size={12} /> {f.name}
          <button type="button" className="attachment-chip-remove" onClick={() => onRemove(i)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function DirhamBarLabel(props) {
  const { x, y, width, height, value } = props;
  const cy = y + height / 2;
  const startX = x + width + 6;
  const numStr = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <g>
      <text x={startX} y={cy} dy={3.5} fontSize={10} fontWeight={700} fill="var(--text)" fontFamily="Arial, sans-serif">D</text>
      <line x1={startX - 1} y1={cy - 2.5} x2={startX + 6.5} y2={cy - 2.5} stroke="var(--text)" strokeWidth={1} />
      <line x1={startX - 1} y1={cy + 2.5} x2={startX + 6.5} y2={cy + 2.5} stroke="var(--text)" strokeWidth={1} />
      <text x={startX + 10} y={cy} dy={3.5} fontSize={10} fill="var(--text)">{numStr}</text>
    </g>
  );
}

// Rotated (vertical, reading bottom-to-top) variants of the label above --
// used only on Home's big "Explore" bar chart (both orientations it
// offers), per explicit request: instead of the value trailing off
// sideways from the bar's tip (eating into the chart's width), it prints
// straight up from the bar's own edge instead. That frees up the
// horizontal room the old sideways label needed, which is exactly what
// lets the bars themselves shrink and the plot area cover more of the
// available width -- "more coverage, more elegantly" as asked. Built by
// laying the exact same D-glyph + number out along +x from a pivot point
// (the bar's edge), then rotating the whole group -90 degrees around that
// same pivot, which swings +x to point straight up.
function DirhamBarLabelVerticalSideways(props) {
  // v2.35: per explicit request, value labels next to the sideways Bar
  // chart's bars must read horizontally (flowing right off the bar's tip),
  // not rotated vertical -- so this now shares the same horizontal layout
  // as DirhamBarLabel above instead of a -90deg rotated <g>.
  const { x, y, width, height, value } = props;
  const cy = y + height / 2;
  const startX = x + width + 6;
  const numStr = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <g>
      <text x={startX} y={cy} dy={3} fontSize={8.5} fontWeight={700} fill="var(--text)" fontFamily="Arial, sans-serif">D</text>
      <line x1={startX - 1} y1={cy - 2} x2={startX + 6} y2={cy - 2} stroke="var(--text)" strokeWidth={1} />
      <line x1={startX - 1} y1={cy + 2} x2={startX + 6} y2={cy + 2} stroke="var(--text)" strokeWidth={1} />
      <text x={startX + 9.5} y={cy} dy={3} fontSize={8.5} fill="var(--text)">{numStr}</text>
    </g>
  );
}
function shortSourceLabel(fullName) {
  if (!fullName) return fullName;
  const CODE = { 'Credit Card': 'CC', 'Debit Card': 'DC', 'Bank Account': 'BA', 'Salary Deduction': 'Salary' };
  const m = fullName.match(/^([^(]+?)\s*(?:\((.+)\))?$/);
  if (!m) return fullName;
  const base = m[1].trim();
  const inner = m[2];
  const code = CODE[base] || base;
  if (!inner) return code;
  const bankCode = inner.split('(')[0].trim();
  return bankCode ? `${code}-${bankCode}` : code;
}
function DirhamBarLabelVerticalColumn(props) {
  const { x, y, width, value } = props;
  const px = x + width / 2;
  const py = y;
  const numStr = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <g transform={`rotate(-90, ${px}, ${py})`}>
      <text x={px + 3} y={py} dy={3} fontSize={9} fontWeight={700} fill="var(--text)" fontFamily="Arial, sans-serif">D</text>
      <line x1={px + 2} y1={py - 2.2} x2={px + 8.5} y2={py - 2.2} stroke="var(--text)" strokeWidth={1} />
      <line x1={px + 2} y1={py + 2.2} x2={px + 8.5} y2={py + 2.2} stroke="var(--text)" strokeWidth={1} />
      <text x={px + 11.5} y={py} dy={3} fontSize={9} fill="var(--text)">{numStr}</text>
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
  const label = name && name.length > 14 ? name.slice(0, 14) + '&' : name;
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

// First-time-user spotlight tour -- a short, dismissible walkthrough of the
// handful of things a brand-new household member most needs to find (the
// title/logo, Home, adding an expense, the spending chart, Settings, the
// notification bell, and Help). Each step's `selector` is a data-tour="..."
// attribute already sitting on the real, live button/element -- desktop and
// mobile intentionally share the SAME data-tour value on their respective
// versions of "the same" action (e.g. the desktop header's Home button and
// the mobile bottom-nav's Home button both carry data-tour="nav-home"), so
// this one step list works unmodified on both layouts: querySelectorAll
// picks whichever of the two is actually visible (offsetParent !== null)
// rather than needing an isMobile branch here. No SVG mask/cutout -- the
// "hole" in the dark backdrop is the classic CSS trick of a transparent box
// exactly the target's size with an enormous box-shadow around it, which
// naturally follows the target's real rect (no separate math to keep two
// shapes in sync as the page scrolls/resizes).
const TOUR_STEPS = [
  {
    selector: '[data-tour="brand"]',
    title: 'Welcome to Hearth',
    body: 'A quick 30-second look around -- skip anytime, or replay this later from Help.',
  },
  {
    selector: '[data-tour="nav-home"]',
    title: 'Dashboard',
    body: 'Your dashboard: budget, spending, and income at a glance, plus a bigger Explore view with the chart, AI Insights, and Budget Coach.',
  },
  {
    selector: '[data-tour="nav-add"]',
    title: 'Add an expense',
    body: 'Log a regular expense here -- Income, Fixed Expenses, and Savings all work the same way and auto-save as you type.',
  },
  {
    selector: '[data-tour="chart-toggle"]',
    title: 'Spending by category',
    body: 'Switch between Pie, Bar, Pareto, Treemap, and By Source to see where your money is going.',
    ensureView: 'home',
  },
  {
    selector: '[data-tour="nav-settings"]',
    title: 'Smart Budget',
    body: 'Set a monthly budget per category here -- go over, and youll get a heads-up in the bell icon next.',
  },
  {
    selector: '[data-tour="notif-bell"]',
    title: 'Notifications',
    body: 'Over-budget categories and bills due soon show up here, with an unread count.',
  },
  {
    selector: '[data-tour="nav-help"]',
    title: 'Need more?',
    body: 'Help has a full guide to every feature, and you can replay this tour anytime from there.',
  },
];

function SpotlightTour({ stepIndex, onNext, onPrev, onSkip }) {
  const [rect, setRect] = useState(null);
  const step = TOUR_STEPS[stepIndex];

    useLayoutEffect(() => {
    // Clear any previous step's highlight immediately on step change --
    // showing nothing for a frame beats showing the WRONG (previous
    // step's) box, which is what a one-shot setTimeout measurement used
    // to do here: if steps advanced faster than its 260ms delay (a normal
    // double-click, or this component's own smooth-scroll re-triggering
    // the old step's scroll listener before its cleanup ran), the stale
    // rect from the step you just left could get painted under the NEW
    // step's tooltip text, or -- worse -- a scroll event mid-transition
    // could hand the old closure a completely unrelated element's rect.
    // A continuous requestAnimationFrame loop instead of a single delayed
    // measurement has no "stale snapshot" to leak: every frame re-reads
    // the real DOM and the real scroll-into-view position, so it always
    // self-corrects to the truth within one frame, and rAF ids (not a
    // closed-over boolean) fully own their own cancellation.
    if (!step) { setRect(null); return; }
    setRect(null);
    let cancelled = false;
    let rafId = null;
    let hasScrolled = false;
    const tick = () => {
      if (cancelled) return;
      const candidates = Array.from(document.querySelectorAll(step.selector));
      const el = candidates.find((c) => c.offsetParent !== null) || candidates[0];
      if (el) {
        if (!hasScrolled) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          hasScrolled = true;
        }
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [stepIndex, step]);

  if (!step) return null;
  const pad = 8;
  const highlightStyle = rect
    ? {
        position: 'fixed',
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 12,
      }
    : null;
  // Tooltip prefers sitting below the target; flips above if there isn't
  // room, and always stays clamped within the viewport horizontally so it
  // never runs off the left/right edge on a narrow phone screen.
  const tooltipWidth = 300;
  let tooltipTop = rect ? rect.bottom + pad + 10 : 100;
  let flipAbove = false;
  if (rect && tooltipTop + 160 > window.innerHeight) {
    tooltipTop = Math.max(10, rect.top - pad - 10 - 160);
    flipAbove = true;
  }
  let tooltipLeft = rect ? Math.min(Math.max(10, rect.left + rect.width / 2 - tooltipWidth / 2), window.innerWidth - tooltipWidth - 10) : 20;

  return (
    <div className="tour-overlay">
      {highlightStyle && <div className="tour-highlight" style={highlightStyle} />}
      <div
        className={`tour-tooltip ${flipAbove ? 'tour-tooltip-above' : ''}`}
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
      >
        <div className="tour-tooltip-title">{step.title}</div>
        <div className="tour-tooltip-body">{step.body}</div>
        <div className="tour-tooltip-foot">
          <button type="button" className="tour-skip-link" onClick={onSkip}>Skip tour</button>
          <div className="tour-tooltip-actions">
            <span className="tour-step-count">{stepIndex + 1} / {TOUR_STEPS.length}</span>
            {stepIndex > 0 && (
              <button type="button" className="btn small secondary" onClick={onPrev}>Back</button>
            )}
            <button type="button" className="btn small" onClick={onNext}>
              {stepIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
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

function fmtCur(n, cur) {
  const v = Number(n) || 0;
  return (cur || CURRENT_CURRENCY) + ' ' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function investAccruedValue(inv) {
  const principal = Number(inv.principal_amount || 0);
  const cv = inv.current_value;
  const hasOverride = cv !== null && cv !== undefined && cv !== '' && Number(cv) !== principal;
  if (hasOverride) return Number(cv);
  if (inv.investment_type === 'Fixed Deposit' && inv.interest_rate && inv.start_date) {
    const rate = Number(inv.interest_rate) || 0;
    const start = new Date(inv.start_date);
    const maturity = inv.maturity_date ? new Date(inv.maturity_date) : null;
    const today = new Date();
    const end = (maturity && today > maturity) ? maturity : today;
    const msPerYear = 365.25 * 24 * 3600 * 1000;
    const years = Math.max(0, (end - start) / msPerYear);
    return principal * (1 + (rate / 100) * years);
  }
  return cv !== null && cv !== undefined && cv !== '' ? Number(cv) : principal;
}

function investIsEstimated(inv) {
  const principal = Number(inv.principal_amount || 0);
  const cv = inv.current_value;
  const hasOverride = cv !== null && cv !== undefined && cv !== '' && Number(cv) !== principal;
  return !hasOverride && inv.investment_type === 'Fixed Deposit' && !!inv.interest_rate && !!inv.start_date;
}

function investDisplayStatus(inv) {
  if (inv.status && inv.status !== 'Active') return inv.status;
  if (inv.maturity_date && new Date() > new Date(inv.maturity_date)) return 'Matured';
  return inv.status || 'Active';
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
// already have a normal Unicode symbol -- $, ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½, ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½, ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ -- so there's nothing
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
// symbol -- "-AED50" reads oddly, "-ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½50" reads the way "-$50" would.
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

// Same as Amt, but for a value in a currency other than the household's --
// used by Investments, where each Fixed Deposit/SIP can be opened in a
// different currency than the household's own. Reuses the same Dirham
// glyph and CURRENCY_SYMBOLS map the rest of the app already uses (instead
// of a plain "AED 250.00" text prefix), so investment amounts look and
// feel exactly like every other amount in the app when they happen to be
// in the household's currency, and fall back to the 3-letter code only for
// currencies with no recognizable glyph.
function AmtCur({ value, currency }) {
  const v = Number(value) || 0;
  const neg = v < 0;
  const numStr = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cur = currency || CURRENT_CURRENCY;
  const symbol = cur === 'AED' ? <DirhamGlyph /> : (CURRENCY_SYMBOLS[cur] || cur + ' ');
  return (
    <span className="amt-tight">
      {neg ? '-' : ''}{symbol}{numStr}
    </span>
  );
}

function monthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(d) {
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// First/last calendar day of a given month, as yyyy-mm-dd strings -- used to
// bound the dashboard's date-range picker (see rangeStart/rangeEnd below) so
// it can never be dragged outside whichever month is currently selected via
// the </> month nav.
function firstDayOfMonthStr(d) {
  return monthKey(d) + '-01';
}
function lastDayOfMonthStr(d) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return monthKey(d) + '-' + String(last.getDate()).padStart(2, '0');
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
  // Investments (Fixed Deposits / Mutual Fund SIPs) is a private tab -- only
  // Vipin's own login sees it; everyone else in the household continues to
  // see just the existing "Coming Soon" placeholder, untouched.
  const isMe = (session.user.email || '').trim().toLowerCase() === 'vipinlakhanpal@gmail.com';

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [investmentForm, setInvestmentForm] = useState({
    investmentType: 'Fixed Deposit', name: '', institution: '', principal: '', currentValue: '',
    interestRate: '', sipAmount: '', startDate: new Date().toISOString().slice(0, 10), maturityDate: '', status: 'Active',
    currency: CURRENT_CURRENCY,
  });
  const [investFxRates, setInvestFxRates] = useState(null);
  const [showInvestmentMoreFields, setShowInvestmentMoreFields] = useState(false);
  const [investChartType, setInvestChartType] = useState('bar-h');
  const [editingInvestmentId, setEditingInvestmentId] = useState(null);
  function investToBase(amount, cur) {
    if (!cur || cur === CURRENT_CURRENCY) return amount;
    if (investFxRates && investFxRates[cur]) return amount / investFxRates[cur];
    return amount;
  }
  const investmentTotals = useMemo(() => {
    const principal = investments.reduce((s, x) => s + investToBase(Number(x.principal_amount || 0), x.currency), 0);
    const current = investments.reduce((s, x) => s + investToBase(investAccruedValue(x), x.currency), 0);
    return { principal, current, gain: current - principal };
  }, [investments, investFxRates]);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://open.er-api.com/v6/latest/${CURRENT_CURRENCY}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j && j.rates) setInvestFxRates(j.rates); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isMe]);
  // Total monthly budget now lives per-calendar-month (one row per month, in
  // the monthly_budgets table), exactly like Income/Savings, instead of one
  // flat number that applied to every month forever. `totalBudget` below is
  // derived from this list for whichever month is currently selected, so
  // every existing calculation that reads `totalBudget` (Remaining, the
  // over-budget banner, the PDF report, AI insights, etc.) automatically
  // reflects the right month's figure without changing at every call site.
  const [monthlyBudgets, setMonthlyBudgets] = useState([]);
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
  // Bar chart orientation -- only exposed on the Home tab's big "Explore"
  // chart (see renderChartCard(big) below); the normal small chart panel
  // next to every other tab keeps its original fixed orientation, per
  // explicit request. 'vertical' matches the app's original/default bar
  // layout (categories stacked in a vertical list, bars extending
  // sideways); 'horizontal' is the more familiar column-chart look (bars
  // standing up, categories spread left-to-right along the bottom) -- handy
  // on Home's wider canvas where there's room for that.
  const [barOrientation, setBarOrientation] = useState('vertical');
  const [loading, setLoading] = useState(true);
  // Exactly one of these panels (Budget settings / Users / Admin console / Help)
  // can be open at a time -- they all render in the same spot below the chart,
  // and opening one auto-scrolls its title into view.
  const [activePanel, setActivePanel] = useState(null);
  const panelRef = useRef(null);
const [mobileReportOpen, setMobileReportOpen] = useState(false);
  // Which sub-section shows inside the Settings panel -- App Settings
  // (budget/currency/categories) or, for the admin user only, the Admin
  // Console. Previously Admin Console was its own separate top-bar button
  // and panel; folding it into Settings as a sub-toggle instead reduces the
  // top bar to fewer buttons and groups "app configuration" together.
  const [settingsSubTab, setSettingsSubTab] = useState('app');
  // Help panel is now an accordion -- each topic's bold title is a button;
  // clicking one opens just that topic's description and closes whichever
  // other one was open, instead of one long always-visible wall of text.
  // Starts with nothing open so the panel reads as a clean list of topics
  // first, per explicit request ("when Home is clicked... the Home
  // description appears... do this for all").
  const [helpOpenTopic, setHelpOpenTopic] = useState(null);
  function togglePanel(name) {
    // Closing the mobile add sheet whenever a different panel opens keeps
    // only one "overlay" on screen at a time, so Report/Users/Settings
    // never end up stacked underneath an already-open Add sheet.
    setAddSheetOpen(false);
    closeAllMobileEditSheets();
    setActivePanel(name);
    // Also clear inputTab -- Report/Settings/Help are meant to pair with
    // Home, not linger stacked on top of whichever Income/Fixed Expenses/
    // Regular Expenses/Savings tab was previously selected.
    setInputTab(null);
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
  const [profileDropdownPos, setProfileDropdownPos] = useState(null);
  // v2.25: the REAL bug behind "Sign out does nothing" -- .sticky-dashboard-frame
  // (the header's sticky container) sets overflow-x: clip with overflow-y:
  // visible. Per the CSS overflow spec, when one axis is non-visible the
  // other axis silently becomes 'auto' instead of staying 'visible' -- so
  // that header frame was ACTUALLY clipping anything extending past its own
  // bottom edge, even though it kept painting the dropdown fine visually.
  // The dropdown is tall enough to extend well past the frame, so every
  // real click on "Sign out" (or the fields above it) was hit-testing
  // straight through to whatever dashboard content sits behind it -- not a
  // mousedown/click race after all (that v2.24 fix was harmless but not
  // the actual cause). Rendering the dropdown as position:fixed, measured
  // from the toggle button the moment it opens, escapes that clipping
  // ancestor entirely so clicks land on the real buttons again.
  //
  // v2.26: position:fixed alone still wasn't enough -- .sticky-dashboard-frame
  // also carries will-change:transform (an iOS repaint-lag fix, see v1.47
  // above), and ANY transform on an ancestor makes it the containing block
  // for position:fixed descendants too, not just absolute ones. So the
  // "fixed" dropdown was still being sized/clipped relative to that frame
  // instead of the viewport. Rendering it through a portal straight into
  // document.body sidesteps both the clipping and the transform-containment
  // issue for good.
  useEffect(() => {
    if (!profileMenuOpen) return;
    if (profileMenuRef.current) {
      const r = profileMenuRef.current.getBoundingClientRect();
      setProfileDropdownPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    function onDocClick(e) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setProfileMenuOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
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
{ id: 'amber', label: 'Amber', color: '#b45309' },
  { id: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { id: 'slate', label: 'Slate', color: '#475569' },
  { id: 'wine', label: 'Wine', color: '#9f1239' },
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
  const [themeDropdownPos, setThemeDropdownPos] = useState(null);
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
    // Light/dark mode -- stored separately from the color theme above (its own
    // localStorage key) so switching one never resets the other. Toggled via
    // a [data-mode="dark"] attribute on <html>; index.css recolors --bg/
    // --card/--text/--muted/--border off of that attribute for every color
    // theme at once.
    const [mode, setMode] = useState(() => {
      try {
        return localStorage.getItem('hearth-mode') || 'light';
      } catch {
        return 'light';
      }
    });
    useEffect(() => {
      if (mode === 'dark') {
        document.documentElement.setAttribute('data-mode', 'dark');
      } else {
        document.documentElement.removeAttribute('data-mode');
      }
      try {
        localStorage.setItem('hearth-mode', mode);
      } catch {
        // ignore -- same nice-to-have persistence as the color theme above
      }
    }, [mode]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    if (themeMenuRef.current) {
      const r = themeMenuRef.current.getBoundingClientRect();
      setThemeDropdownPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    function onDocClick(e) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target)) setThemeMenuOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [themeMenuOpen]);
  // Attachment viewer modal -- opened from every place a document can be
  // viewed (aggregated Attachments dropdown, each table's row icon, each
  // mobile edit sheet). Holds the signed URL + name of whichever attachment
  // is currently open, so one modal + one set of handlers covers all of them.
  const [attachmentViewer, setAttachmentViewer] = useState(null);
  // Multiple-attachments-per-row support: rowAttachments maps
  // "{table}:{rowId}" -> array of { id, storage_path, file_name, created_at },
  // loaded in bulk in loadAll() from the row_attachments join table (see
  // migration_multi_attachments.sql) rather than a single attachment_url
  // column per row. attachmentListModal holds which row's list is currently
  // open (table/rowId/label) -- clicking an item in that list opens the
  // existing single-file attachmentViewer above, unchanged, so the
  // view/email/WhatsApp actions work exactly as before per attachment.
  const [rowAttachments, setRowAttachments] = useState({});
  const [attachmentListModal, setAttachmentListModal] = useState(null);
  function rowAttachmentKey(table, rowId) {
    return `${table}:${rowId}`;
  }
  function getRowAttachments(table, rowId) {
    return rowAttachments[rowAttachmentKey(table, rowId)] || [];
  }
  function openAttachmentList(table, rowId, label) {
    setAttachmentListModal({ table, rowId, label: label || 'Attachments' });
  }
  // Footer "Suggestion" form -- lets any signed-in user send product
  // feedback straight to the app owner's inbox (see api/send-suggestion.js)
  // without needing a whole feedback-tracking table. Pre-filled from the
  // same name/location the user already saved under "My details" so most
  // people can just add their message and submit.
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState({ name: '', email: '', location: '', message: '' });
  const [suggestionStatus, setSuggestionStatus] = useState(''); // '', 'sending', 'sent', 'error'
  function openSuggestionModal() {
    setSuggestionForm({
      name: myDetailsDraft.name || '',
      email: session?.user?.email || '',
      location: myDetailsDraft.location || '',
      message: '',
    });
    setSuggestionStatus('');
    setSuggestionModalOpen(true);
  }
  async function handleSubmitSuggestion(e) {
    e.preventDefault();
    if (!suggestionForm.name.trim() || !suggestionForm.message.trim()) return;
    setSuggestionStatus('sending');
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/send-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify(suggestionForm),
      });
      if (!res.ok) throw new Error('failed');
      setSuggestionStatus('sent');
    } catch {
      setSuggestionStatus('error');
    }
  }
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
  const [stickyFrameSpacerHeight, setStickyFrameSpacerHeight] = useState(0);
  useEffect(() => {
    const el = stickyFrameRef.current;
    if (!el) return undefined;
    const update = () => setStickyFrameSpacerHeight(el.getBoundingClientRect().bottom + 16);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  const inputTabsSectionRef = useRef(null);
  // On mobile, tapping "+" or "Add" opens the exact same Add
  // expense/income/fixed/savings forms as a sliding bottom sheet instead of
  // scrolling to them -- the standard native quick-add pattern. This reuses
  // the identical form JSX and state that desktop already renders inline;
  // only a CSS class (added below, mobile-breakpoint only) turns that same
  // section into an overlay, so nothing about desktop's layout or behavior
  // changes.
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Collapsed by default on the Home "Explore" pie card so the chart
  // itself gets the available width/height instead of competing with a
  // long category list next to (desktop) or above/below (mobile) it.
  const [showTop10, setShowTop10] = useState(false);

  // Drives the mobile-only "Expenses this month" redesign below: on a
  // narrow screen, that list renders as tappable read-only rows (icon,
  // description, date, amount) instead of the always-editable input table
  // desktop uses -- tapping a row opens an edit sheet instead. Tracked in
  // JS (not just CSS) because which JSX gets rendered actually differs
  // between the two, not just how it's styled.
  const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px), ((pointer: coarse) and (hover: none) and (max-width: 1366px))').matches
  );
  useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px), ((pointer: coarse) and (hover: none) and (max-width: 1366px))');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // First-time-user spotlight tour (#301) -- shows once automatically for
  // someone who's never seen it (a localStorage flag, not a DB column: this
  // is a "have I personally clicked through this once" per-browser thing,
  // not household data every member should share), and can be replayed
  // anytime from a link in the Help panel below.
  const TOUR_SEEN_KEY = 'hearth-tour-seen-v1';
  const [tourStep, setTourStep] = useState(null); // null = not currently running
  useEffect(() => {
    if (!household?.id) return;
    if (localStorage.getItem(TOUR_SEEN_KEY)) return;
    // Small delay so the tour's first highlight lands on a settled layout
    // (post-data-load) instead of racing the initial render/scroll.
    const t = setTimeout(() => startTour(), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id]);

  function startTour() {
    setActivePanel(null);
    setInputTab(null);
    setTourStep(0);
  }
  function finishTour() {
    localStorage.setItem(TOUR_SEEN_KEY, '1');
    setTourStep(null);
  }
  function tourNext() {
    setTourStep((s) => {
      const next = s + 1;
      if (next >= TOUR_STEPS.length) {
        localStorage.setItem(TOUR_SEEN_KEY, '1');
        return null;
      }
      if (TOUR_STEPS[next].ensureView === 'home') {
        setActivePanel(null);
        setInputTab(null);
      }
      return next;
    });
  }
  function tourPrev() {
    setTourStep((s) => Math.max(0, s - 1));
  }

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
    setInputTab(null);
    setAddSheetOpen(false);
    closeAllMobileEditSheets();
    scrollToFrameA();
  }
  // Scrolls all the way back to the top of the page -- called whenever one
  // of the header row's own tabs (Home/Income/Fixed/Regular/Savings/Report/
  // Settings/Help) is clicked, so switching tabs always re-anchors back at
  // the top instead of leaving the page wherever it happened to be scrolled
  // to (e.g. after reading through a long Expenses table, or exploring the
  // Home tab's larger chart section further down the page).
  //
  // NOTE: this deliberately uses window.scrollTo rather than
  // topRef.current.scrollIntoView(...) (the original approach). Frame A
  // (.sticky-dashboard-frame, which topRef points into) is `position:
  // sticky; top: 0`, so once the page is scrolled down even a little, that
  // element is already sitting at the top of the viewport from the
  // browser's point of view -- scrollIntoView sees it as "already in view"
  // and does nothing, silently no-op'ing every single time this was called
  // from anywhere below the fold. That was the actual bug behind tabs not
  // realigning the page: window.scrollTo always moves the real page scroll
  // position, regardless of what's currently stuck to the top.
  //
  // Also deliberately deferred rather than called synchronously in the same
  // click handler that flips inputTab/activePanel. Switching tabs changes
  // which panels/tables are mounted, which can shrink or grow the page's
  // total height a lot (e.g. Home hides every form and table). Calling
  // scrollTo *before* React has re-rendered starts it against the OLD
  // (taller or shorter) page, and if the resize lands mid-scroll the
  // browser clamps the in-flight position to whatever the new max scroll
  // position is instead of finishing the trip to 0 -- landing partway down
  // the page instead of at the top.
  //
  // Uses setTimeout(..., 0) rather than requestAnimationFrame to do that
  // deferring. rAF is the "correct" tool for this in most apps, but it
  // ties the callback to the next paint -- and turned out to be unreliable
  // to depend on here (it can end up simply not firing in some automated/
  // background-tab contexts, silently dropping the scroll entirely).
  // setTimeout only depends on the ordinary JS event loop finishing the
  // current render/commit first, which is all we actually need.
  //
  // Uses behavior: 'auto' (instant), not 'smooth'. A 'smooth' scroll is an
  // animation spread over several frames -- if anything on the page nudges
  // layout again during that window (images/charts finishing their own
  // layout, a second state update, etc.) the browser can clamp or cancel it
  // partway, landing short of the top again. An instant jump has no window
  // for that to happen in, so it reliably lands exactly at the top every
  // time.
  function scrollToFrameA() {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 0);
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
    // Deferred with setTimeout (not requestAnimationFrame) for the same
    // reliability reason as scrollToFrameA above -- rAF turned out to
    // silently never fire in some contexts, dropping the scroll entirely
    // (which is exactly what made Report/Settings/Help look unresponsive).
    // setTimeout still gives the panel (which only mounts once activePanel
    // matches) a tick to actually be in the DOM/laid out before measuring
    // it, without depending on the paint/compositor pipeline to run.
    //
    // Uses behavior: 'auto' (instant) rather than 'smooth' -- a 'smooth'
    // scroll can get clamped or silently cancelled if anything else nudges
    // the page's layout during the animation window.
    const t = setTimeout(() => {
      if (!panelRef.current) return;
      const stickyHeight = stickyFrameRef.current?.offsetHeight || 0;
      const panelTop = panelRef.current.getBoundingClientRect().top + window.scrollY;
      const targetY = Math.max(panelTop - stickyHeight - 12, 0);
      window.scrollTo({ top: targetY, behavior: 'auto' });
    }, 0);
    return () => clearTimeout(t);
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
  const [expenseFiles, setExpenseFiles] = useState([]);
  const expenseFilesInputRef = useRef(null);
  // AI feature #1 (auto-categorization): a small hint shown next to the
  // Category field right after the AI picks one for you, so it's clear the
  // dropdown got auto-filled rather than silently changing. Purely
  // additive -- if the API key isn't configured yet or the call fails, this
  // just never fires and the form behaves exactly as before.
  const [aiCategoryHint, setAiCategoryHint] = useState('');
  
  // suggestion for Fixed Expenses' Name field, kept in its own state so
  // it never clashes with the Regular Expenses hint above.
  const [fixedAiCategoryHint, setFixedAiCategoryHint] = useState('');// AI feature #1b: same auto-categorize behaviour as Regular Expenses'
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
  // instead of typing each line by hand. Per explicit request, scanned
  // items are now added straight to Regular Expenses (including a best-
  // guess payment source read off the receipt) rather than sitting in a
  // review list first -- edit afterwards the same way you'd edit any other
  // expense (pencil icon in the list / mobile edit sheet) if anything looks
  // wrong.
  const scanFileInputRef = useRef(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState('');
  // Read-only summary of what the last scan just added, shown briefly right
  // below the button -- not an editable staging area anymore.
  const [lastScanAdded, setLastScanAdded] = useState([]); // [{ description, amount }]
  // Tiny toast used for "Updated" confirmations (manual Add and receipt
  // auto-add both trigger it) -- auto-dismisses on its own.
  const [toastMsg, setToastMsg] = useState('');
  const toastTimerRef = useRef(null);
  function showToast(msg) {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(''), 2200);
  }

  // Centered popup for viewing a row's saved note -- replaces the old
  // alert(x.notes) calls on the Income/Fixed Expenses/Savings/Regular
  // Expenses row note icons, which rendered as the browser's native alert
  // dialog pinned to the tab/address-bar chrome instead of an in-app
  // element. Reuses the existing attachment-viewer-overlay/modal styling
  // for a consistent, properly viewport-centered popup.
  const [notePopup, setNotePopup] = useState(null);
  const [showManual, setShowManual] = useState(false);

  // AI feature #4 (chat assistant): a floating Q&A bubble, available from
  // anywhere in the app (not tied to a specific tab/panel), that answers
  // questions using this household's own data -- spending by category,
  // budget status, recent-month comparisons. Each request re-sends a fresh
  // snapshot of the household's numbers rather than trying to keep data
  // "inside" a saved conversation, so answers can't go stale mid-chat.
  // The conversation ITSELF, though, is persisted (see chat_messages table
  // / migration_chat_messages.sql) -- per explicit request ("can chatbot
  // record the previous chats and save them... so I can retrieve and
  // continue"), one continuous thread shared by the whole household
  // (everyone reads/adds to the same running history, same visibility
  // model as the rest of the app's shared data), loaded once below and
  // appended to as each message is sent.
  const [chatOpen, setChatOpen] = useState(false);
  // Owner-only new version available indicator + one-click refresh --
  // polls the tiny static /version.json file (bumped in lockstep with
  // APP_VERSION every time a change is pushed) rather than the already-
  // loaded bundle, since running code cannot know about a newer build of
  // itself. Desktop + owner only, per explicit request -- lets Vipin hit
  // one button instead of remembering to hard-refresh the browser tab.
  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const checkVersion = () => {
      fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data && data.version && data.version !== APP_VERSION) setUpdateAvailable(true);
        })
        .catch(() => {});
    };
    checkVersion();
    const id = setInterval(checkVersion, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  const [chatMessages, setChatMessages] = useState([]); // [{ role: 'user'|'assistant', content }]
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('chat_messages')
      .select('role, content')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setChatMessages(data.map((m) => ({ role: m.role, content: m.content })));
      });
    return () => { cancelled = true; };
  }, [householdId]);
  // Chat bubble now lives as a fixed icon button in the header, directly
  // next to the notification bell (see .chat-fab-wrap in index.css) --
  // no longer a free-floating, draggable FAB. That removes the recurring
  // "collides with the header/bell" bugs for good, since its position is
  // now just normal document flow right next to the bell (same dropdown
  // pattern as the bell and profile menus) instead of fixed viewport
  // coordinates that had to be reclamped on every header change.
  const chatMenuRef = useRef(null);
  // Aria's popup used to live nested inside the sticky header frame, but
  // that frame clips descendant hit-testing (not just painting) to its own
  // box height -- once the popup grew tall enough for its input row to sit
  // below that boundary, real clicks/taps on the input passed straight
  // through to whatever page content was underneath instead of reaching
  // the input, and the outside-click handler below (seeing a click outside
  // chatMenuRef) correctly-by-its-own-logic closed the chat before anyone
  // could type. Fix: on desktop, portal the popup to document.body as a
  // position:fixed element anchored under the header icon, so it's fully
  // outside that clipped subtree. chatWindowRef lets the outside-click
  // check treat the portaled content as "inside" too. Mobile keeps its
  // existing (already-working) inline rendering untouched.
  const chatWindowRef = useRef(null);
  const [chatPos, setChatPos] = useState(null);
  useEffect(() => {
    if (!chatOpen) { setChatPos(null); return; }
    function updateChatPos() {
      if (isMobile) {
        // Anchor the popup near the BOTTOM of the screen (like a normal
        // mobile chat sheet, and close to where the Aria icon actually
        // lives in the bottom nav) instead of pinning it near the top --
        // opening at the very top of the screen read as "it jumped up and
        // got stuck" since a position:fixed element doesn't move when the
        // page scrolls, which is exactly what page-scroll used to do for
        // it before. bottomOffset is how far the *visible* area (above
        // the on-screen keyboard, tracked via window.visualViewport) falls
        // short of the true screen bottom, so the sheet naturally rises to
        // clear the keyboard when it opens and settles just above the
        // bottom nav when it's closed.
        const vv = window.visualViewport;
        const layoutH = window.innerHeight;
        const vvBottom = vv ? vv.offsetTop + vv.height : layoutH;
        const navClearance = 74;
        const bottomOffset = Math.max(navClearance, (layoutH - vvBottom) + 12);
        const maxHeight = Math.max(200, (vv ? vv.height : layoutH) - bottomOffset - 16);
        setChatPos({ mobile: true, bottom: bottomOffset, maxHeight });
      } else {
        if (!chatMenuRef.current) return;
        const r = chatMenuRef.current.getBoundingClientRect();
        setChatPos({ mobile: false, top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
      }
    }
    updateChatPos();
    // Mobile DOES need to keep tracking window.visualViewport live (via
    // these listeners) -- without it, the sheet stays glued to its
    // opening position and the keyboard simply covers the input/Send
    // button once it opens (confirmed: that's exactly what not tracking
    // it caused). The earlier "jump" complaint wasn't really about
    // tracking the keyboard at all -- it was that the position snapped
    // instantly instead of sliding, which the .chat-window CSS transition
    // (bottom/max-height) now smooths out. So: keep live-tracking on both
    // mobile and desktop, and let the CSS transition handle the "feel".
    window.addEventListener('resize', updateChatPos);
    window.addEventListener('scroll', updateChatPos, true);
    if (isMobile && window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateChatPos);
      window.visualViewport.addEventListener('scroll', updateChatPos);
    }
    return () => {
      window.removeEventListener('resize', updateChatPos);
      window.removeEventListener('scroll', updateChatPos, true);
      if (isMobile && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateChatPos);
        window.visualViewport.removeEventListener('scroll', updateChatPos);
      }
    };
  }, [chatOpen, isMobile]);
  // iOS's native "scroll the focused input into view" behaviour jumps the
  // WHOLE page the instant the chat input is tapped, even though the chat
  // itself is a position:fixed sheet that never needed scrolling into view
  // in the first place -- confirmed by the user still seeing a visible
  // jump-and-snap-back after the earlier fix (v1.76) that re-pins scrollY
  // AFTER the jump happens. Reacting after the fact still shows one frame
  // of the jump, which reads as unpolished. The reliable fix is to remove
  // iOS's ability to scroll the page AT ALL while the chat is open, using
  // the standard iOS body-scroll-lock trick (pin body as position:fixed at
  // its current scroll offset) -- with nothing scrollable to move, there's
  // nothing for the native behaviour to jump.
  useEffect(() => {
    if (!chatOpen || !isMobile) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      window.scrollTo(0, scrollY);
    };
  }, [chatOpen, isMobile]);
  useEffect(() => {
    if (!chatOpen) return;
    function onDocClick(e) {
      const inMenu = chatMenuRef.current && chatMenuRef.current.contains(e.target);
      const inWindow = chatWindowRef.current && chatWindowRef.current.contains(e.target);
      if (!inMenu && !inWindow) setChatOpen(false);
    }
    // Attach on the NEXT tick, not immediately -- if we attach synchronously
    // while still inside the same click that just opened the popup, some
    // browsers can treat that same in-flight click as the "outside" click
    // and close it before it's even visible. Deferring by one tick (0ms)
    // guarantees the opening click has fully finished before we start
    // listening, without weakening the outside-click behavior at all.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDocClick);
    };
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
  // Which month the "Budgeting" settings tab is currently editing -- defaults
  // to the dashboard's current month every time that tab is opened (see the
  // "Budgeting" button's onClick), can be changed via its own Month field to
  // set/review a different month's budget without leaving the tab.
  const [budgetMonthDraft, setBudgetMonthDraft] = useState(() => monthKey(currentMonth));
  const [totalBudgetDraft, setTotalBudgetDraft] = useState('');
  // Opt-in per-user privacy: a member can mark their own income/expense/
  // fixed-expense/savings entries private so only they (not the rest of
  // the household) can see them. These four just hold the checkbox state
  // for each add-form; myPrivacyEnabled (below, near commitMyDetailsField)
  // gates whether the checkbox even renders.
  const [expenseIsPrivate, setExpenseIsPrivate] = useState(false);
  const [incomeIsPrivate, setIncomeIsPrivate] = useState(false);
  const [recurringIsPrivate, setRecurringIsPrivate] = useState(false);
  const [savingIsPrivate, setSavingIsPrivate] = useState(false);

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
  const [showRecurringMoreDates, setShowRecurringMoreDates] = useState(false);
  const [recurringFiles, setRecurringFiles] = useState([]);
  const recurringFilesInputRef = useRef(null);

  // Savings goals -- how much the household wants to set aside each month.
  // Entered per month on purpose, exactly like Income (no auto-rollover) --
  // savings amounts often change month to month, so re-entering a fresh
  // value each month avoids silently counting last month's amount again.
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [newSaving, setNewSaving] = useState({
    name: '',
    amount: '',
    month: monthKey(new Date()),
    notes: '',
  });
  const [savingsDrafts, setSavingsDrafts] = useState({});
  // Same note/attachment pattern as the expense forms.
  const [showSavingNotes, setShowSavingNotes] = useState(false);
  const [savingFiles, setSavingFiles] = useState([]);
  const savingFilesInputRef = useRef(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRelation, setInviteRelation] = useState('Spouse');
  const [inviteStatus, setInviteStatus] = useState('');

  // Income is entered per month on purpose (no auto-rollover) -- see newIncome.month.
  const [newIncome, setNewIncome] = useState({
    name: '',
    memberEmail: session.user.email,
    amount: '',
    month: monthKey(new Date()),
    notes: '',
  });
  const [incomeDrafts, setIncomeDrafts] = useState({});
  // Same note/attachment pattern as the expense forms.
  const [showIncomeNotes, setShowIncomeNotes] = useState(false);
  const [incomeFiles, setIncomeFiles] = useState([]);
  const incomeFilesInputRef = useRef(null);

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
  const [reportInfoOpen, setReportInfoOpen] = useState(false); // v1.29: mobile-only collapsible report description toggle
  const [investmentsInfoOpen, setInvestmentsInfoOpen] = useState(false); // collapsible Investments description toggle, reusing the report-info-btn/report-desc pattern
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
  const myMemberRow = members.find((m) => m.email?.toLowerCase() === session.user.email.toLowerCase());
  const myPrivacyEnabled = !!myMemberRow?.privacy_enabled;

  async function togglePrivacyEnabled(next) {
    const mine = members.find((m) => m.email?.toLowerCase() === session.user.email.toLowerCase());
    if (!mine) return;
    const { error } = await supabase.from('household_members').update({ privacy_enabled: next }).eq('id', mine.id);
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === mine.id ? { ...m, privacy_enabled: next } : m)));
  }

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
    const [{ data: cats }, { data: exps }, { data: settings }, { data: recur }, { data: mem }, { data: invites }, { data: inc }, { data: savings }, { data: mBudgets }, { data: rowAtts }] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', householdId).order('name'),
      // Secondary sort by id is required, not cosmetic -- Postgres doesn't
      // guarantee a stable order for rows that tie on expense_date (very
      // common; several expenses share the same day), so without a
      // tiebreaker the row order could silently shuffle between fetches.
      // That's exactly what made picking a Payment Source then a Bank feel
      // broken: committing the Payment Source triggered a reload, ties
      // re-sorted, and the row the user was mid-selection on jumped to a
      // different position before they could pick the bank.
      supabase.from('expenses').select('*').eq('household_id', householdId).order('id', { ascending: false }),
      supabase.from('settings').select('*').eq('household_id', householdId).maybeSingle(),
      // Same tiebreaker reasoning as expenses above.
      supabase.from('recurring_expenses').select('*').eq('household_id', householdId).order('id', { ascending: false }),
      supabase.from('household_members').select('*').eq('household_id', householdId).order('joined_at'),
      supabase.from('household_invites').select('*').eq('household_id', householdId).eq('status', 'pending'),
      supabase.from('incomes').select('*').eq('household_id', householdId).order('id', { ascending: false }),
      supabase.from('savings_goals').select('*').eq('household_id', householdId).order('id', { ascending: false }),
      supabase.from('monthly_budgets').select('*').eq('household_id', householdId).order('month'),
      supabase.from('row_attachments').select('*').eq('household_id', householdId).order('created_at'),
    ]);
    // Build the "{table}:{rowId}" -> [attachments] map once per load, in
    // created_at order, so the list modal always shows attachments in the
    // order they were added without needing to re-sort per row on click.
    const raMap = {};
    (rowAtts || []).forEach((a) => {
      const k = rowAttachmentKey(a.table_name, a.row_id);
      (raMap[k] = raMap[k] || []).push(a);
    });
    setRowAttachments(raMap);
    {
      try {
        const { data: inv, error: invErr } = await supabase
          .from('investments')
          .select('*')
          .eq('household_id', householdId)
          .order('start_date', { ascending: false });
        if (!invErr) setInvestments(inv || []);
      } catch (e) {
        // investments table may not exist yet until the one-time SQL
        // migration has been run -- fail quietly instead of breaking
        // the rest of the app.
      }
    }
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
    setMonthlyBudgets(mBudgets || []);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_budgets', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'row_attachments', filter: `household_id=eq.${householdId}` }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId]);

  const monthExpenses = useMemo(() => {
    const key = monthKey(currentMonth);
    return expenses.filter((e) => e.expense_date.slice(0, 7) === key);
  }, [expenses, currentMonth]);

  // ---- Dashboard date range (start/end within the currently viewed month).
  // Narrows Regular Expenses' contribution to the spending totals/chart --
  // Spent so far, Remaining, Combined expenses, Net, and Spending by category
  // all flow from oneOffTotal/byCategory below, which now read rangeExpenses
  // instead of monthExpenses directly. Combined income, the Fixed Expenses
  // total, and Savings are NOT affected -- those are only ever entered as one
  // lump sum for the whole month (no specific day), so there's nothing
  // meaningful to narrow. The "Regular Expenses for {month}" list further
  // down the page is a separate view (with its own Category/Payment Filter
  // button) and always keeps showing the full month, regardless of this
  // range -- a caption next to the range picker says so.
  const [rangeStart, setRangeStart] = useState(() => firstDayOfMonthStr(currentMonth));
  const [rangeEnd, setRangeEnd] = useState(() => lastDayOfMonthStr(currentMonth));
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef(null);
  useEffect(() => {
    if (!rangeOpen) return;
    function onDocClick(e) {
      if (rangeRef.current && !rangeRef.current.contains(e.target)) setRangeOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [rangeOpen]);
  // Reset to the full new month whenever the </> month nav changes months --
  // a range picked for July shouldn't silently carry over and quietly narrow
  // August too.
  useEffect(() => {
    setRangeStart(firstDayOfMonthStr(currentMonth));
    setRangeEnd(lastDayOfMonthStr(currentMonth));
  }, [currentMonth]);
  const rangeIsFullMonth = rangeStart === firstDayOfMonthStr(currentMonth) && rangeEnd === lastDayOfMonthStr(currentMonth);
  const rangeExpenses = useMemo(
    () => monthExpenses.filter((e) => e.expense_date >= rangeStart && e.expense_date <= rangeEnd),
    [monthExpenses, rangeStart, rangeEnd]
  );

  // Whichever month the dashboard is currently showing -- see the
  // monthlyBudgets state declaration above for why this replaced the old
  // flat totalBudget value. Falls back to 0 (same as before) if no budget
  // has been set for this particular month yet.
  const totalBudget = useMemo(() => {
    const key = monthKey(currentMonth);
    const row = monthlyBudgets.find((b) => b.month === key);
    return row ? Number(row.total_budget) : 0;
  }, [monthlyBudgets, currentMonth]);

  // Keeps the Budgeting tab's Amount field in sync with whichever month its
  // own Month field is set to (budgetMonthDraft), separate from the
  // dashboard's currentMonth -- so reviewing/editing a past or future
  // month's budget there doesn't also flip which month the rest of the
  // dashboard (charts, tables, Remaining) is showing.
  useEffect(() => {
    const row = monthlyBudgets.find((b) => b.month === budgetMonthDraft);
    setTotalBudgetDraft(row ? String(row.total_budget) : '');
  }, [budgetMonthDraft, monthlyBudgets]);

  // Follow the dashboard's own month navigation (the < / > arrows) so the
  // Smart Budget tab's Month field always shows whichever month is
  // currently selected -- previously it only picked up the current month
  // the moment the tab was first opened, so switching months with the tab
  // already open (or already visited) kept showing the stale month.
  useEffect(() => {
    setBudgetMonthDraft(monthKey(currentMonth));
  }, [currentMonth]);

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
    // Regular Expenses respects the date-range picker (rangeExpenses is
    // monthExpenses narrowed to rangeStart/rangeEnd, or the full month by
    // default) -- Fixed Expenses always contributes its full monthly amount
    // since it isn't entered per day.
    rangeExpenses.forEach((e) => {
      const name = categoryNameById[e.category_id] || 'Uncategorized';
      m[name] = (m[name] || 0) + Number(e.amount);
    });
    recurringForMonth.forEach((r) => {
      const name = categoryNameById[r.category_id] || 'Uncategorized';
      m[name] = (m[name] || 0) + Number(r.amount);
    });
    return m;
  }, [rangeExpenses, recurringForMonth, categoryNameById]);

  const oneOffTotal = useMemo(() => rangeExpenses.reduce((s, e) => s + Number(e.amount), 0), [rangeExpenses]);
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

  // ---- Filters for the 4 month-scoped lists below (Regular Expenses, Fixed
  // Expenses, Income, Savings). These only narrow what's rendered on screen --
  // every total, chart, and the PDF report keep reading the original
  // (unfiltered) monthExpenses/recurringForMonth/incomeForMonth/savingsForMonth
  // arrays above, so an active filter never skews a number, only which rows
  // are visible. Each section gets its own state/open/ref trio, following the
  // same click-to-open, click-outside-to-close pattern as the theme picker
  // (themeMenuOpen/themeMenuRef above).
  const [expenseFilter, setExpenseFilter] = useState({ category: '', payment: '', bank: '' });
  const [expenseFilterOpen, setExpenseFilterOpen] = useState(false);
  const expenseFilterRef = useRef(null);
  useEffect(() => {
    if (!expenseFilterOpen) return;
    function onDocClick(e) {
      if (expenseFilterRef.current && !expenseFilterRef.current.contains(e.target)) setExpenseFilterOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [expenseFilterOpen]);
  const expenseFilterActive = !!(expenseFilter.category || expenseFilter.payment || expenseFilter.bank);
  const filteredMonthExpenses = useMemo(() => {
    return rangeExpenses.filter((e) => {
      if (expenseFilter.category && e.category_id !== expenseFilter.category) return false;
      if (expenseFilter.payment && (e.payment_source || 'Cash') !== expenseFilter.payment) return false;
      if (expenseFilter.bank && (e.payment_bank || '') !== expenseFilter.bank) return false;
      return true;
    }).sort((a, b) => (b.expense_date || '').localeCompare(a.expense_date || '') || (b.id || 0) - (a.id || 0));
  }, [rangeExpenses, expenseFilter]);

  const [recurringFilter, setRecurringFilter] = useState({ category: '', payment: '', bank: '' });
  const [recurringFilterOpen, setRecurringFilterOpen] = useState(false);
  const recurringFilterRef = useRef(null);
  useEffect(() => {
    if (!recurringFilterOpen) return;
    function onDocClick(e) {
      if (recurringFilterRef.current && !recurringFilterRef.current.contains(e.target)) setRecurringFilterOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [recurringFilterOpen]);
  const recurringFilterActive = !!(recurringFilter.category || recurringFilter.payment || recurringFilter.bank);
  const filteredRecurringForMonth = useMemo(() => {
    return recurringForMonth.filter((r) => {
      if (recurringFilter.category && r.category_id !== recurringFilter.category) return false;
      if (recurringFilter.payment && (r.payment_source || 'Cash') !== recurringFilter.payment) return false;
      if (recurringFilter.bank && (r.payment_bank || '') !== recurringFilter.bank) return false;
      return true;
    }).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '') || (b.id || 0) - (a.id || 0));
  }, [recurringForMonth, recurringFilter]);

  const [incomeFilter, setIncomeFilter] = useState({ source: '', member: '' });
  const [incomeFilterOpen, setIncomeFilterOpen] = useState(false);
  const incomeFilterRef = useRef(null);
  useEffect(() => {
    if (!incomeFilterOpen) return;
    function onDocClick(e) {
      if (incomeFilterRef.current && !incomeFilterRef.current.contains(e.target)) setIncomeFilterOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [incomeFilterOpen]);
  const incomeFilterActive = !!(incomeFilter.source || incomeFilter.member);
  // Income has no category/payment fields (see Source/Member/Amount/Month
  // columns), so it's filtered on what it actually has instead -- distinct
  // Source names and Members actually present this month, not every source
  // ever entered across all months.
  const incomeSourceOptions = useMemo(
    () => Array.from(new Set(incomeForMonth.map((i) => (i.name || '').trim()).filter(Boolean))).sort(),
    [incomeForMonth]
  );
  const incomeMemberOptions = useMemo(
    () => Array.from(new Set(incomeForMonth.map((i) => i.member_email).filter(Boolean))).sort(),
    [incomeForMonth]
  );
  const filteredIncomeForMonth = useMemo(() => {
    return incomeForMonth.filter((i) => {
      if (incomeFilter.source && (i.name || '').trim() !== incomeFilter.source) return false;
      if (incomeFilter.member && i.member_email !== incomeFilter.member) return false;
      return true;
    }).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '') || (b.id || 0) - (a.id || 0));
  }, [incomeForMonth, incomeFilter]);

  const [savingsFilter, setSavingsFilter] = useState({ name: '' });
  const [savingsFilterOpen, setSavingsFilterOpen] = useState(false);
  const savingsFilterRef = useRef(null);
  useEffect(() => {
    if (!savingsFilterOpen) return;
    function onDocClick(e) {
      if (savingsFilterRef.current && !savingsFilterRef.current.contains(e.target)) setSavingsFilterOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [savingsFilterOpen]);
  const savingsFilterActive = !!savingsFilter.name;
  // Savings only has a Name field to filter on (see Name/Amount/Month
  // columns) -- distinct names actually present this month.
  const savingsNameOptions = useMemo(
    () => Array.from(new Set(savingsForMonth.map((s) => (s.name || '').trim()).filter(Boolean))).sort(),
    [savingsForMonth]
  );
  const filteredSavingsForMonth = useMemo(() => {
    return savingsForMonth.filter((s) => {
      if (savingsFilter.name && (s.name || '').trim() !== savingsFilter.name) return false;
      return true;
    }).sort((a, b) => (b.start_date || '').localeCompare(a.start_date || '') || (b.id || 0) - (a.id || 0));
  }, [savingsForMonth, savingsFilter]);

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

  // Payment-source breakdown for the "By Source" chart-toggle option (Phase 2,
  // per explicit request: show Credit Card / Debit Card / Bank Account spend on
  // the Dashboard as a chart rather than new tiles). Same data scope as
  // byCategory above (rangeExpenses + recurringForMonth) so the two toggle
  // options always describe the exact same pool of spending, just grouped
  // differently. 'Bank' / 'Salary' are Fixed Expenses-only payment sources
  // (see RECURRING_PAYMENT_SOURCES) -- relabeled here for a clearer chart.
  const byPaymentSource = useMemo(() => {
    const m = {};
    const label = (src) => (src === 'Bank' ? 'Bank Account' : src === 'Salary' ? 'Salary Deduction' : src);
    const BANK_BREAKDOWN_SOURCES = ['Credit Card', 'Debit Card', 'Bank Account'];
    const keyFor = (rawSrc, bank) => {
      const name = label(rawSrc || 'Cash');
      return BANK_BREAKDOWN_SOURCES.includes(name) && bank ? `${name} (${bank})` : name;
    };
    rangeExpenses.forEach((e) => {
      const name = keyFor(e.payment_source, e.payment_bank);
      m[name] = (m[name] || 0) + Number(e.amount);
    });
    recurringForMonth.forEach((r) => {
      const name = keyFor(r.payment_source, r.payment_bank);
      m[name] = (m[name] || 0) + Number(r.amount);
    });
    return m;
  }, [rangeExpenses, recurringForMonth]);
  const paymentSourceData = Object.entries(byPaymentSource).map(([name, value]) => ({ name, value }));

  // Phase 2 dashboard tiles: unlike the By Source chart (broken out per bank),
  // these three roll every Credit Card / Debit Card / Bank Account entry up
  // to a single type-level total for an at-a-glance summary above the fold --
  // no per-bank detail here, that's what the By Source chart is for.
  const byPaymentType = useMemo(() => {
    const totals = {};
    const banks = {};
    const label = (src) => (src === 'Bank' ? 'Bank Account' : src === 'Salary' ? 'Salary Deduction' : src);
    // Per-request: the 3 tile descriptions show the bank(s) behind that
    // total in short form (e.g. "Credit Card (FAB)") rather than a bare
    // type name -- same abbreviation rule as shortSourceLabel (the part of
    // the bank string before its first "(", e.g. "FAB" out of
    // "FAB (First Abu Dhabi Bank) (UAE)"). If a type spans more than one
    // bank in a given month, all of them show, joined with "/".
    const shortBank = (b) => (b || '').split('(')[0].trim();
    const add = (rawSrc, rawBank, amount) => {
      const name = label(rawSrc || 'Cash');
      totals[name] = (totals[name] || 0) + Number(amount);
      const b = shortBank(rawBank);
      if (b) {
        banks[name] = banks[name] || new Set();
        banks[name].add(b);
      }
    };
    rangeExpenses.forEach((e) => add(e.payment_source, e.payment_bank, e.amount));
    recurringForMonth.forEach((r) => add(r.payment_source, r.payment_bank, r.amount));
    return { totals, banks };
  }, [rangeExpenses, recurringForMonth]);
  const paymentTypeTileLabel = (type) => {
    const bankSet = byPaymentType.banks[type];
    return bankSet && bankSet.size > 0 ? `${type} (${Array.from(bankSet).join('/')})` : type;
  };

  // The pie chart specifically (not Bar/Pareto/Treemap) gets capped to its
  // biggest slices with everything else folded into "Other". A pie is the
  // one chart type where every extra category makes EVERY slice harder to
  // read (more slivers competing for the same ring of space), so this is
  // what actually fixes clutter -- shrinking or resizing the chart doesn't,
  // since the underlying problem is too many slices, not too little room.
  const PIE_TOP_N = 6;
  // Home's bigger "Explore" pie gets a slightly higher cap than the normal
  // small side-panel pie -- there's enough room on that larger canvas for a
  // few more slices before it turns back into clutter, per explicit
  // request ("Pie can slightly expand with more categories"). The small
  // panel used everywhere else keeps the original PIE_TOP_N untouched.
  const PIE_TOP_N_BIG = 9;
  function getPieChartData(topN) {
    if (pieData.length <= topN) return pieData;
    const sorted = [...pieData].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, topN);
    const otherTotal = sorted.slice(topN).reduce((s, d) => s + d.value, 0);
    return otherTotal > 0 ? [...top, { name: 'Other', value: otherTotal }] : top;
  }
  const pieChartData = useMemo(() => getPieChartData(PIE_TOP_N), [pieData]);

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

  // Shared by the one-off expense form, Income, Fixed Expenses, and Savings
  // forms. Uploads to the private "attachments" Storage bucket under a
  // {household_id}/{table}-{row_id}-{filename} path -- the RLS policies on
  // storage.objects check that the first path segment is a household this
  // signed-in user belongs to (via my_household_ids()), so nobody outside
  // the household can read/write another household's files even though the
  // bucket itself is shared. Runs AFTER the row insert, since the path needs
  // the new row's own id.
  //
  // Takes an ARRAY of files (not a single file) and inserts one row per file
  // into the row_attachments join table (see migration_multi_attachments.sql)
  // instead of patching a single attachment_url/attachment_name column --
  // this is what lets a row carry more than one attachment. Each file
  // uploads/inserts independently so one bad file doesn't block the rest.
  async function uploadAttachmentsForRow(table, rowId, files) {
    const list = (files || []).filter(Boolean);
    if (list.length === 0) return;
    for (const file of list) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${householdId}/${table}-${rowId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (uploadError) {
        alert(`Saved, but "${file.name}" could not be uploaded: ` + uploadError.message);
        continue;
      }
      const { error: insertError } = await supabase.from('row_attachments').insert({
        household_id: householdId,
        table_name: table,
        row_id: rowId,
        storage_path: path,
        file_name: file.name,
        created_by: session.user.id,
      });
      if (insertError) {
        alert(`Saved and uploaded, but "${file.name}" could not be linked: ` + insertError.message);
      }
    }
    loadAll();
  }

  // The bucket is private, so viewing/downloading a saved attachment needs a
  // signed URL generated on demand -- the stored attachment_url is just the
  // storage path, never a public link. This opens the attachment-viewer
  // modal (used from every table row, mobile edit sheet, etc.) rather than
  // navigating away directly, so the same "view inline / open / share" set
  // of options is available everywhere a document can be attached.
  async function openAttachmentViewer(path, name) {
    if (!path) return;
    setAttachmentViewer({ loading: true, path, name: name || 'Attachment', url: null });
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      alert('Could not open attachment: ' + (error?.message || 'unknown error'));
      setAttachmentViewer(null);
      return;
    }
    setAttachmentViewer({ loading: false, path, name: name || 'Attachment', url: data.signedUrl });
  }

  function isImageAttachment(name) {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');
  }
  function isPdfAttachment(name) {
    return /\.pdf$/i.test(name || '');
  }

  // Share generates its OWN fresh, longer-lived link (24h) rather than
  // reusing the viewer's 1-hour link -- the recipient on the other end of an
  // email/WhatsApp message may not open it right away, so the share link
  // needs more runway than the in-app viewer does.
  async function shareAttachment(path, name, via) {
    const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 86400);
    if (error || !data?.signedUrl) {
      alert('Could not create a shareable link: ' + (error?.message || 'unknown error'));
      return;
    }
    const link = data.signedUrl;
    const label = name || 'attachment';
    if (via === 'email') {
      const subject = encodeURIComponent(`Hearth document: ${label}`);
      const body = encodeURIComponent(`Sharing a document from Hearth: ${label}\n\n${link}\n\n(This link expires in 24 hours.)`);
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    } else if (via === 'whatsapp') {
      const text = encodeURIComponent(`${label}: ${link}\n(link expires in 24 hours)`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  }

  // Now takes a FileList/array (was a single file) so more than one document
  // can be attached to the same row -- per explicit request. Valid files are
  // APPENDED to whatever's already picked (not replaced), so picking again
  // adds more rather than starting over; each invalid file is skipped with
  // one combined alert rather than one popup per bad file.
  function handleAttachmentPick(files, setFilesFn) {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const valid = [];
    let rejected = 0;
    for (const file of list) {
      if (isAllowedAttachment(file)) valid.push(file);
      else rejected++;
    }
    if (rejected > 0) {
      alert(`${rejected} file${rejected === 1 ? '' : 's'} skipped -- attachments must be an image or PDF, 5MB or smaller.`);
    }
    if (valid.length > 0) {
      setFilesFn((cur) => [...(cur || []), ...valid]);
    }
  }

  function removeAttachmentAt(setFilesFn, index) {
    setFilesFn((cur) => (cur || []).filter((_, i) => i !== index));
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
      ...(myPrivacyEnabled ? { is_private: expenseIsPrivate } : {}),
    }).select().single();
    if (error) {
      alert('Could not save expense: ' + error.message);
      return;
    }
    if (expenseFiles.length > 0 && inserted?.id) {
      await uploadAttachmentsForRow('expenses', inserted.id, expenseFiles);
    }
    const d = new Date(form.date + 'T00:00:00');
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setForm((f) => ({ ...f, description: '', amount: '', notes: '' }));
    setShowExpenseNotes(false);
    setExpenseFiles([]);
    if (expenseFilesInputRef.current) expenseFilesInputRef.current.value = '';
    loadAll();
    showToast('Updated');
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
      setAiCategoryHint(`( AI-suggested: ${match.name}`);
      setTimeout(() => setAiCategoryHint((h) => (h.includes(match.name) ? '' : h)), 4000);
    } catch {
      // AI suggestion is a nice-to-have -- silently skip on any failure.
    }
  }

  // Same AI category-suggestion flow as Regular Expenses, but wired to
  // the Fixed Expenses form's own state (newRecurring/setNewRecurring)
  // and its own hint variable so the two forms never step on each other.
  async function suggestFixedCategoryFromDescription(text) {
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
      setNewRecurring((f) => (f.name.trim() === trimmed ? { ...f, categoryId: match.id } : f));
      setFixedAiCategoryHint(`( AI-suggested: ${match.name}`);
      setTimeout(() => setFixedAiCategoryHint((h) => (h.includes(match.name) ? '' : h)), 4000);
    } catch {
      // AI suggestion is a nice-to-have -- worst case, nothing gets suggested.
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

  // Maps whatever the model read off the receipt to one of the app's own
  // PAYMENT_SOURCES values -- defaults to 'Cash' (same default the manual
  // Add form uses) when the receipt didn't show a clear payment marker.
  function matchPaymentSource(detected) {
    return PAYMENT_SOURCES.includes(detected) ? detected : 'Cash';
  }

  // Auto-fill a bank for Credit Card / Debit Card payment sources by reusing
  // whichever bank this household most recently used for that same source --
  // saves re-picking the same bank on every single expense, and covers the
  // AI receipt-scan path too (a receipt itself never states which bank issued
  // the card, so that path used to leave payment_bank blank every time).
  function getDefaultBankFor(source) {
    if (source !== 'Credit Card' && source !== 'Debit Card') return '';
    const match = expenses
      .filter((x) => x.payment_source === source && x.payment_bank)
      .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date))[0];
    return match ? match.payment_bank : '';
  }

  function blankInvestmentForm() {
    return {
      investmentType: 'Fixed Deposit', name: '', institution: '', principal: '', currentValue: '',
      interestRate: '', sipAmount: '', startDate: new Date().toISOString().slice(0, 10), maturityDate: '', status: 'Active',
      currency: CURRENT_CURRENCY,
    };
  }

  function startEditInvestment(inv) {
    setEditingInvestmentId(inv.id);
    setInvestmentForm({
      investmentType: inv.investment_type,
      name: inv.name,
      institution: inv.institution || '',
      principal: String(inv.principal_amount || ''),
      currentValue: inv.current_value != null ? String(inv.current_value) : '',
      interestRate: inv.interest_rate != null ? String(inv.interest_rate) : '',
      sipAmount: inv.sip_amount != null ? String(inv.sip_amount) : '',
      startDate: inv.start_date || '',
      maturityDate: inv.maturity_date || '',
      status: inv.status || 'Active',
      currency: inv.currency || CURRENT_CURRENCY,
    });
  }

  function cancelEditInvestment() {
    setEditingInvestmentId(null);
    setInvestmentForm(blankInvestmentForm());
  }

  async function handleSaveInvestment() {
    const principal = parseFloat(investmentForm.principal);
    if (!investmentForm.name.trim() || isNaN(principal) || principal <= 0) {
      alert('Please enter a name and a valid principal / invested amount.');
      return;
    }
    const payload = {
      investment_type: investmentForm.investmentType,
      name: investmentForm.name.trim(),
      institution: investmentForm.institution.trim() || null,
      principal_amount: principal,
      current_value: investmentForm.currentValue ? parseFloat(investmentForm.currentValue) : null,
      interest_rate: investmentForm.investmentType === 'Fixed Deposit' && investmentForm.interestRate ? parseFloat(investmentForm.interestRate) : null,
      sip_amount: investmentForm.investmentType === 'Mutual Fund' && investmentForm.sipAmount ? parseFloat(investmentForm.sipAmount) : null,
      start_date: investmentForm.startDate || null,
      maturity_date: investmentForm.investmentType === 'Fixed Deposit' ? (investmentForm.maturityDate || null) : null,
      status: investmentForm.status || 'Active',
      currency: investmentForm.currency || CURRENT_CURRENCY,
    };
    let error;
    if (editingInvestmentId) {
      ({ error } = await supabase.from('investments').update(payload).eq('id', editingInvestmentId));
    } else {
      ({ error } = await supabase.from('investments').insert({
        household_id: householdId, created_by: session.user.id, created_by_email: session.user.email, ...payload,
      }));
    }
    if (error) { alert('Could not save investment: ' + error.message); return; }
    const wasEditing = !!editingInvestmentId;
    cancelEditInvestment();
    await loadAll();
    showToast(wasEditing ? 'Investment updated' : 'Investment added');
  }

  async function handleDeleteInvestment(id, name) {
    if (!confirm(`Remove "${name}" from your investments? This can't be undone.`)) return;
    const { error } = await supabase.from('investments').delete().eq('id', id);
    if (error) { alert('Could not delete: ' + error.message); return; }
    if (editingInvestmentId === id) cancelEditInvestment();
    loadAll();
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
    setLastScanAdded([]);
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
      // Straight to the database -- no review step. categoryId falls back
      // to the first category (same fallback the old review list used) so
      // a row never goes in with no category at all; payment source falls
      // back to Cash. Both are just as editable afterwards as anything
      // typed in by hand.
      const rows = json.items
        .filter((item) => item.amount && Number(item.amount) > 0)
        .map((item) => {
          const match = categories.find((c) => c.name.toLowerCase() === (item.categoryName || '').toLowerCase());
          const paymentSource = matchPaymentSource(item.paymentSource);
          return {
            household_id: householdId,
            expense_date: item.date || new Date().toISOString().slice(0, 10),
            category_id: match ? match.id : (categories[0]?.id || null),
            description: (item.description || '').trim(),
            amount: Number(item.amount),
            payment_source: paymentSource,
            payment_bank: getDefaultBankFor(paymentSource) || null,
            created_by: session.user.id,
            created_by_email: session.user.email,
          };
        });
      if (rows.length === 0) {
        setScanError("Couldn't find any expenses in that image -- try a clearer photo, or enter it manually below.");
        return;
      }
      const { error } = await supabase.from('expenses').insert(rows);
      if (error) {
        setScanError('Could not save scanned expenses: ' + error.message);
        return;
      }
      setLastScanAdded(rows.map((r) => ({ description: r.description || '(no description)', amount: r.amount })));
      loadAll();
      showToast('Updated');
    } catch {
      setScanError("Couldn't read that image -- try again, or enter it manually below.");
    } finally {
      setScanLoading(false);
    }
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

  // Fire-and-forget row insert into chat_messages -- failures here shouldn't
  // block the conversation itself (worst case that one message just doesn't
  // survive a reload), so this deliberately swallows its own errors instead
  // of surfacing them in the chat UI.
  async function saveChatMessage(role, content) {
    try {
      await supabase.from('chat_messages').insert({
        household_id: householdId,
        role,
        content,
        created_by: session.user.id,
        created_by_email: session.user.email,
      });
    } catch {
      // ignore -- see comment above
    }
  }

  async function clearChatHistory() {
    if (!window.confirm("Clear the whole chat history for everyone in the household? This can't be undone.")) return;
    await supabase.from('chat_messages').delete().eq('household_id', householdId);
    setChatMessages([]);
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const newHistory = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    saveChatMessage('user', text);
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
        // Deliberately NOT saved to chat_messages -- a transient "try again"
        // notice isn't part of the actual conversation and would just be
        // confusing clutter to see again on a later reload.
        setChatMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't answer that just now -- try again in a moment." }]);
        return;
      }
      setChatMessages((prev) => [...prev, { role: 'assistant', content: json.reply }]);
      saveChatMessage('assistant', json.reply);
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

  async function commitExpenseField(id, field, value, extra) {
    const merged = { ...(expenseDrafts[id] || {}), [field]: value, ...(extra || {}) };
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

  async function handleAutofillBanks() {
    const missing = expenses.filter((x) => (x.payment_source === 'Credit Card' || x.payment_source === 'Debit Card') && !x.payment_bank);
    if (missing.length === 0) { alert('No expenses are missing a bank right now.'); return; }
    const bySource = {};
    for (const src of ['Credit Card', 'Debit Card']) {
      const bank = getDefaultBankFor(src);
      const count = missing.filter((x) => x.payment_source === src).length;
      if (count > 0 && bank) bySource[src] = { bank, count };
    }
    const lines = Object.entries(bySource).map(([src, v]) => `${v.count} ${src} entr${v.count === 1 ? 'y' : 'ies'} -> ${v.bank}`);
    if (lines.length === 0) {
      alert("Can't auto-fill yet -- none of your existing Credit Card or Debit Card expenses have a bank saved to copy from. Pick a bank on one expense first, then try again.");
      return;
    }
    const resolvedCount = Object.values(bySource).reduce((s, v) => s + v.count, 0);
    const unresolved = missing.length - resolvedCount;
    let msg = `Fill in the missing bank on:\n${lines.join('\n')}`;
    if (unresolved > 0) msg += `\n\n${unresolved} more entr${unresolved === 1 ? 'y' : 'ies'} will stay as-is (no bank on file yet for that payment source).`;
    if (!confirm(msg)) return;
    for (const [src, v] of Object.entries(bySource)) {
      const { error } = await supabase.from('expenses').update({ payment_bank: v.bank }).eq('household_id', householdId).eq('payment_source', src).is('payment_bank', null);
      if (error) { alert('Could not update: ' + error.message); return; }
    }
    loadAll();
    showToast('Banks filled in');
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
  // The monthly budget is now one row per household+month (upsert on the
  // unique constraint), same as Income/Savings, instead of one flat number
  // on "settings" -- see the monthlyBudgets state declaration for why.
  async function commitMonthlyBudget(monthStr, value) {
    const total = parseFloat(value);
    const { error } = await supabase
      .from('monthly_budgets')
      .upsert({ household_id: householdId, month: monthStr, total_budget: isNaN(total) ? 0 : total }, { onConflict: 'household_id,month' });
    if (error) {
      alert('Could not update the budget for that month: ' + error.message);
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
    // v1.91: force a hard reload after sign-out. The app's top-level
    // session listener wasn't reliably flipping the UI back to the login
    // screen after signOut() resolved -- session cleared server-side, but
    // the Dashboard kept rendering with stale local state. A full reload
    // re-runs the initial session check from scratch, which we know
    // correctly shows the login screen when there's no active session.
    window.location.reload();
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
      ...(myPrivacyEnabled ? { is_private: recurringIsPrivate } : {}),
    }).select().single();
    if (error) {
      alert('Could not save fixed expense: ' + error.message);
      return;
    }
    if (recurringFiles.length > 0 && inserted?.id) {
      await uploadAttachmentsForRow('recurring_expenses', inserted.id, recurringFiles);
    }
    setNewRecurring((r) => ({ ...r, name: '', amount: '', endDate: '', dueDate: '', notes: '' }));
    setShowRecurringNotes(false);
    setRecurringFiles([]);
    if (recurringFilesInputRef.current) recurringFilesInputRef.current.value = '';
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
    const { data: inserted, error } = await supabase.from('savings_goals').insert({
      household_id: householdId,
      name: newSaving.name.trim(),
      amount,
      start_date: newSaving.month + '-01',
      end_date: null,
      notes: newSaving.notes.trim() || null,
      created_by: session.user.id,
      ...(myPrivacyEnabled ? { is_private: savingIsPrivate } : {}),
    }).select().single();
    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }
    if (savingFiles.length > 0 && inserted?.id) {
      await uploadAttachmentsForRow('savings_goals', inserted.id, savingFiles);
    }
    setNewSaving((s) => ({ ...s, name: '', amount: '', notes: '' }));
    setShowSavingNotes(false);
    setSavingFiles([]);
    if (savingFilesInputRef.current) savingFilesInputRef.current.value = '';
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
    const { data: inserted, error } = await supabase.from('incomes').insert({
      household_id: householdId,
      name: newIncome.name.trim(),
      member_email: newIncome.memberEmail,
      amount,
      start_date: newIncome.month + '-01',
      end_date: null,
      notes: newIncome.notes.trim() || null,
      created_by: session.user.id,
      ...(myPrivacyEnabled ? { is_private: incomeIsPrivate } : {}),
    }).select().single();
    if (error) {
      alert('Could not save income: ' + error.message);
      return;
    }
    if (incomeFiles.length > 0 && inserted?.id) {
      await uploadAttachmentsForRow('incomes', inserted.id, incomeFiles);
    }
    setNewIncome((i) => ({ ...i, name: '', amount: '', notes: '' }));
    setShowIncomeNotes(false);
    setIncomeFiles([]);
    if (incomeFilesInputRef.current) incomeFilesInputRef.current.value = '';
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
      styles: { fontSize: 11.25, cellPadding: 3, lineColor: [230, 234, 238], lineWidth: 0.1 },
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
  // Always render at the same fixed size on every page/table so the report
  // reads consistently -- tables that don't fit within bottomLimit simply
  // flow onto a new page (autoTable does this automatically) instead of
  // shrinking, which is what caused different font sizes on different pages.
  const maxFont = 11.25, maxPad = 3;
  return { fontSize: maxFont, cellPadding: maxPad };
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
    doc.setFontSize(12.5);
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
      const barX = M + 62; // widened from 48mm (v2.02) so long category names have room to fit without truncating
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
      // v2.02: no more hard character-count truncation ("Home Cleanin...").
      // Every category name is measured with doc.getTextWidth and only
      // shrinks -- from this uniform base size down to a 7pt readability
      // floor -- just far enough to fit the widened label gutter in full.
      const labelFontSize = 11.25; // Uniform with every other table/section -- the max/base size
      const labelMinFontSize = 7; // floor a long name is allowed to shrink to before it would otherwise overflow
      const labelMaxWidth = barX - labelX - 4; // gutter width minus a little breathing room before the bar
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
        doc.setTextColor(50);
        let fitSize = labelFontSize;
        doc.setFontSize(fitSize);
        while (fitSize > labelMinFontSize && doc.getTextWidth(name) > labelMaxWidth) {
          fitSize -= 0.25;
          doc.setFontSize(fitSize);
        }
        const textY = y + barHeight - Math.min(1.3, barHeight * 0.3);
        doc.text(name, labelX, textY);
        doc.setFontSize(labelFontSize);
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
    doc.setFontSize(12.5);
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
        styles: { fontSize: 11.25, fontStyle: 'normal', cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'right' } },
      margin: { left: M, right: M },
      didParseCell: (data) => {
        if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
        if (data.row.index === 5) {
        data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = netTotal >= 0 ? [220, 252, 231] : [254, 226, 226];
          data.cell.styles.textColor = netTotal >= 0 ? [22, 101, 52] : [153, 27, 27];
        }
      },
    });

    // ---------- Income ----------
    // ---------- Payment Sources ----------
    // Point #6 PDF parity: same payment-source grouping as the on-screen
    // Report view -- total per payment source (bank name appended for
    // card/bank sources), then a category breakdown nested under each one,
    // sorted by total desc. Its own dedicated page, same as Income/Expenses
    // below, so it reads as its own chapter rather than being squeezed in.
    doc.addPage();
    y = drawHeader('Payment Sources');

    drawEyebrow('By Payment Method', y);
    y += 7;
    doc.setFontSize(12.5);
    doc.setFont(undefined, 'bold');
    doc.text('Spend by Payment Source', M, y);
    doc.setFont(undefined, 'normal');
    y += 4;

    const pdfSourceLabelFor = (item) => {
      const src = item.payment_source || 'Cash';
      return item.payment_bank ? `${src} - ${item.payment_bank}` : src;
    };
    const pdfPaymentSourceMap = {};
    const pdfAddToSourceMap = (item) => {
      const src = pdfSourceLabelFor(item);
      const cat = categoryNameById[item.category_id] || 'Uncategorized';
      if (!pdfPaymentSourceMap[src]) pdfPaymentSourceMap[src] = { total: 0, categories: {} };
      pdfPaymentSourceMap[src].total += Number(item.amount);
      pdfPaymentSourceMap[src].categories[cat] = (pdfPaymentSourceMap[src].categories[cat] || 0) + Number(item.amount);
    };
    rangeExpenses.forEach(pdfAddToSourceMap);
    rangeRecurringOccurrences.forEach(pdfAddToSourceMap);
    const pdfPaymentSourceRows = Object.entries(pdfPaymentSourceMap)
      .map(([source, v]) => ({
        source,
        total: v.total,
        categories: Object.entries(v.categories).sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.total - a.total);

    if (pdfPaymentSourceRows.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No expenses in this period.', M, y);
      doc.setTextColor(0);
    } else {
      const pdfSourceHeaderRows = new Set();
      const pdfSourceBody = [];
      pdfPaymentSourceRows.forEach((row) => {
        pdfSourceHeaderRows.add(pdfSourceBody.length);
        pdfSourceBody.push([row.source, fmt(row.total)]);
        row.categories.forEach(([name, val]) => {
          pdfSourceBody.push([`     ${name}`, fmt(val)]);
        });
      });
      autoTable(doc, {
        theme: 'plain',
        startY: y,
        body: pdfSourceBody,
        styles: { fontSize: 10.5, cellPadding: 2.4 },
        columnStyles: { 0: { cellWidth: 130 }, 1: { halign: 'right' } },
        margin: { left: M, right: M },
        didParseCell: (data) => {
          if (pdfSourceHeaderRows.has(data.row.index)) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [241, 245, 249];
          } else {
            data.cell.styles.textColor = [90, 90, 90];
          }
        },
      });
    }

    // Income and Expenses each get their own dedicated page (previously
    // they shared one page, which -- combined with the bar chart on page 1
    // already showing per-category expense totals -- made it look like
    // expenses were being shown twice across two pages).
    doc.addPage();
    y = drawHeader('Income');

    drawEyebrow('Money In', y);
    y += 7;
    doc.setFontSize(12.5);
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
    doc.setFontSize(12.5);
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
    doc.setFontSize(12.5);
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
    doc.setFontSize(12.5);
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
      doc.setFontSize(12.5);
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
    doc.setFontSize(12.5);
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
      const barX = M + 62; // widened (v2.02) to match the page 1 fix, matching the label gutter width there
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
      const labelFontSize = paretoRows.length > 24 ? 7.5 : paretoRows.length > 14 ? 8.5 : 9.5; // base/max size for this row density
      const labelMinFontSize = 6; // floor a long name is allowed to shrink to before it would otherwise overflow
      const labelMaxWidth = barX - labelX - 4; // gutter width minus a little breathing room before the bar
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
        doc.setTextColor(50);
        let fitSize = labelFontSize;
        doc.setFontSize(fitSize);
        while (fitSize > labelMinFontSize && doc.getTextWidth(r.name) > labelMaxWidth) {
          fitSize -= 0.25;
          doc.setFontSize(fitSize);
        }
        const textY = y + barHeight - Math.min(1.3, barHeight * 0.3);
        doc.text(r.name, labelX, textY);
        doc.setFontSize(labelFontSize);
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
    doc.setFontSize(12.5);
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

  function computeReportData(from, to) {
    const rangeLabel = `${fmtDate(from)} - ${fmtDate(to)}`;
    const rangeExpenses = expenses.filter((e) => e.expense_date >= from && e.expense_date <= to);
    const fromMonth = from.slice(0, 7);
    const toMonth = to.slice(0, 7);
    const rangeIncomes = incomes.filter((i) => i.active && i.start_date.slice(0, 7) >= fromMonth && i.start_date.slice(0, 7) <= toMonth);
    const rangeMonths = monthsBetween(from, to);
    const rangeRecurringOccurrences = [];
    rangeMonths.forEach((mKey) => {
      recurringExpenses.forEach((r) => {
        if (recurringOccursInMonth(r, mKey)) {
          rangeRecurringOccurrences.push({ ...r, occurredMonth: mKey });
        }
      });
    });
    const rangeSavingsOccurrences = savingsGoals
      .filter((s) => s.active && s.start_date.slice(0, 7) >= fromMonth && s.start_date.slice(0, 7) <= toMonth)
      .map((s) => ({ ...s, occurredMonth: s.start_date.slice(0, 7) }));
    const expenseTotal = rangeExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const incomeTotal = rangeIncomes.reduce((s, i) => s + Number(i.amount), 0);
    const fixedTotal = rangeRecurringOccurrences.reduce((s, r) => s + Number(r.amount), 0);
    const savingsGoalTotal = rangeSavingsOccurrences.reduce((s, g) => s + Number(g.amount), 0);
    const netTotal = incomeTotal - expenseTotal - fixedTotal - savingsGoalTotal;
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
    const maxCategoryVal = Math.max(1, ...chartRows.map(([, v]) => v));

    // Payment-Source-wise category breakdown (point #6): same combined
    // Regular + Fixed data as the category chart above, grouped by payment
    // source first, then by category within each source. Cash has no bank;
    // Credit Card / Debit Card / Bank get the bank name appended so
    // "Credit Card - HSBC" and "Credit Card - Citi" don't collapse together.
    const sourceLabelFor = (item) => {
      const src = item.payment_source || 'Cash';
      return item.payment_bank ? `${src} - ${item.payment_bank}` : src;
    };
    const paymentSourceMap = {};
    const addToSourceMap = (item) => {
      const src = sourceLabelFor(item);
      const cat = categoryNameById[item.category_id] || 'Uncategorized';
      if (!paymentSourceMap[src]) paymentSourceMap[src] = { total: 0, categories: {} };
      paymentSourceMap[src].total += Number(item.amount);
      paymentSourceMap[src].categories[cat] = (paymentSourceMap[src].categories[cat] || 0) + Number(item.amount);
    };
    rangeExpenses.forEach(addToSourceMap);
    rangeRecurringOccurrences.forEach(addToSourceMap);
    const paymentSourceRows = Object.entries(paymentSourceMap)
      .map(([source, v]) => ({
        source,
        total: v.total,
        categories: Object.entries(v.categories).sort((a, b) => b[1] - a[1]),
      }))
      .sort((a, b) => b.total - a.total);
    const maxSourceVal = Math.max(1, ...paymentSourceRows.map((r) => r.total));
    const totalSpend = chartRows.reduce((s, [, v]) => s + v, 0);
    let cum = 0;
    const paretoRows = chartRows.map(([name, val]) => {
      cum += val;
      return { name, val, cumPct: totalSpend > 0 ? (cum / totalSpend) * 100 : 0 };
    });
    let vitalFewNames = paretoRows.filter((r) => r.cumPct <= 80).map((r) => r.name);
    if (vitalFewNames.length === 0 && paretoRows.length) vitalFewNames = [paretoRows[0].name];
    const suggestions = [];
    if (chartRows.length && totalSpend > 0) {
      const [topName, topVal] = chartRows[0];
      const topShare = Math.round((topVal / totalSpend) * 100);
      suggestions.push(`${topName} is your single biggest spend at ${fmt(topVal)} (${topShare}% of total). Even a small cut here moves the needle more than trimming several small categories.`);
      if (vitalFewNames.length) {
        suggestions.push(`Focus review time on ${vitalFewNames.length === 1 ? 'this one category' : `these ${vitalFewNames.length} categories`} first -- they drive 80% of your spending, so that's where controls will have the most impact (the 80/20 rule).`);
      }
    }
    if (fixedTotal > expenseTotal && fixedTotal > 0) {
      suggestions.push(`Fixed/recurring bills (${fmt(fixedTotal)}) are larger than your regular day-to-day spending (${fmt(expenseTotal)}). Review loans, EMIs, and subscriptions for refinancing, consolidation, or cancellation opportunities -- fixed costs compound every month whether or not you notice them.`);
    }
    const overBudgetInRange = categories.filter((c) => c.monthly_budget > 0 && (categoryTotals[c.name] || 0) > c.monthly_budget * Math.max(1, rangeMonths.length));
    if (overBudgetInRange.length) {
      suggestions.push(`${overBudgetInRange.map((c) => c.name).join(', ')} went over the budget you set for ${overBudgetInRange.length > 1 ? 'them' : 'it'} this period. Consider raising the budget if it's genuinely necessary, or setting a firmer cap if it's discretionary.`);
    }
    if (netTotal < 0) {
      suggestions.push(`You spent ${fmt(Math.abs(netTotal))} more than you earned this period. Before cutting anywhere else, check whether this was a one-off (e.g. an annual bill or a big-ticket purchase) or a pattern -- if it repeats, it's worth revisiting the top categories above.`);
    } else if (totalSpend > 0) {
      suggestions.push(`You stayed within income this period (net ${fmt(netTotal)}). Consider directing part of that surplus toward paying down the highest-interest EMI or loan faster, or into savings.`);
    }
    if (suggestions.length === 0) {
      suggestions.push('Not enough data in this period to generate suggestions -- add a few more expenses and generate the report again.');
    }
    const perMonthSavings = {};
    rangeSavingsOccurrences.forEach((s) => {
      perMonthSavings[s.occurredMonth] = (perMonthSavings[s.occurredMonth] || 0) + Number(s.amount);
    });
    const sortedRecurring = [...rangeRecurringOccurrences].sort((a, b) => (a.occurredMonth < b.occurredMonth ? -1 : a.occurredMonth > b.occurredMonth ? 1 : a.name.localeCompare(b.name)));
    const sortedSavings = [...rangeSavingsOccurrences].sort((a, b) => (a.occurredMonth < b.occurredMonth ? -1 : a.occurredMonth > b.occurredMonth ? 1 : a.name.localeCompare(b.name)));
    return {
      rangeLabel, rangeIncomes, rangeExpenses,
      rangeRecurringOccurrences: sortedRecurring,
      rangeSavingsOccurrences: sortedSavings,
      rangeMonths, perMonthSavings,
      expenseTotal, incomeTotal, fixedTotal, savingsGoalTotal, netTotal,
      chartRows, maxCategoryVal, totalSpend, paretoRows, vitalFewNames, suggestions,
      paymentSourceRows, maxSourceVal,
    };
  }

function ReportHtmlView({ data }) {
    const [showExpenseDetail, setShowExpenseDetail] = useState(false);
    if (!data) return null;
    return (
      <div className="report-preview" style={{ padding: 20, maxHeight: 'min(80vh, 1400px)', overflowY: 'auto' }}>
        <h4 style={{ marginTop: 0 }}>Summary</h4>
        <table className="responsive-table" style={{ marginBottom: 24 }}>
          <tbody>
            <tr><td>Total Income</td><td style={{ textAlign: 'right' }}>{fmt(data.incomeTotal)}</td></tr>
            <tr><td>Total Regular Expenses</td><td style={{ textAlign: 'right' }}>{fmt(data.expenseTotal)}</td></tr>
            <tr><td>Total Fixed Expenses</td><td style={{ textAlign: 'right' }}>{fmt(data.fixedTotal)}</td></tr>
            <tr><td>Total Savings</td><td style={{ textAlign: 'right' }}>{fmt(data.savingsGoalTotal)}</td></tr>
            <tr className="report-total-row report-total-outflow" style={{ fontWeight: 700 }}><td>Total Outflow (Expenses + Savings)</td><td style={{ textAlign: 'right' }}>{fmt(data.expenseTotal + data.fixedTotal + data.savingsGoalTotal)}</td></tr>
            <tr className={`report-total-row report-net-row ${data.netTotal >= 0 ? 'report-net-positive' : 'report-net-negative'}`} style={{ fontWeight: 700 }}><td>Net (Income - Total Outflow)</td><td style={{ textAlign: 'right' }}>{fmt(data.netTotal)}</td></tr>
          </tbody>
        </table>
        <h4>Expenses by Category</h4>
        {data.chartRows.length === 0 ? (
          <div className="muted-small" style={{ marginBottom: 24 }}>No expenses in this period.</div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {data.chartRows.map(([name, val], i) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{name}</div>
                <div className="report-bar-track" style={{ flex: 1, borderRadius: 4, height: 14 }}>
                  <div style={{ width: `${Math.max(2, (val / data.maxCategoryVal) * 100)}%`, background: COLORS[i % COLORS.length], height: '100%', borderRadius: 4 }} />
                </div>
                <div style={{ width: 90, fontSize: 12, textAlign: 'right', fontWeight: 600, flexShrink: 0 }}>{fmt(val)}</div>
              </div>
            ))}
          </div>
        )}
        <h4>Spend by Payment Source</h4>
        {data.paymentSourceRows.length === 0 ? (
          <div className="muted-small" style={{ marginBottom: 24 }}>No expenses in this period.</div>
        ) : (
          <div style={{ marginBottom: 24 }}>
            {data.paymentSourceRows.map((row, i) => (
              <div key={row.source} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 120, fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{row.source}</div>
                  <div className="report-bar-track" style={{ flex: 1, borderRadius: 4, height: 14 }}>
                    <div style={{ width: `${Math.max(2, (row.total / data.maxSourceVal) * 100)}%`, background: COLORS[i % COLORS.length], height: '100%', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 90, fontSize: 12, textAlign: 'right', fontWeight: 700, flexShrink: 0 }}>{fmt(row.total)}</div>
                </div>
                <div style={{ paddingLeft: 128 }}>
                  {row.categories.map(([name, val]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <div style={{ flex: 1, fontSize: 11, color: 'var(--muted)' }}>{name}</div>
                      <div style={{ width: 90, fontSize: 11, textAlign: 'right', color: 'var(--muted)', flexShrink: 0 }}>{fmt(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <h4>Income</h4>
        <div className="table-scroll" style={{ marginBottom: 24 }}>
          <table className="responsive-table">
            <thead><tr><th>Month</th><th>Source</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {data.rangeIncomes.map((i, idx) => (
                <tr key={idx}><td>{i.start_date.slice(0, 7)}</td><td>{i.name}</td><td style={{ textAlign: 'right' }}>{fmt(i.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr className="report-total-row" style={{ fontWeight: 700 }}><td></td><td>Total</td><td style={{ textAlign: 'right' }}>{fmt(data.incomeTotal)}</td></tr></tfoot>
          </table>
        </div>
        <h4>Expenses</h4>
        <div
          className="report-collapsible-toggle"
          onClick={() => setShowExpenseDetail((v) => !v)}
          role="button"
          tabIndex={0}
        >
          <span>{showExpenseDetail ? 'Hide' : 'Show'} {data.rangeExpenses.length} transactions ({fmt(data.expenseTotal)})</span>
          <ChevronDown size={22} strokeWidth={2.75} className={`report-toggle-chevron${showExpenseDetail ? ' report-toggle-chevron-open' : ''}`} />
        </div>
        {showExpenseDetail && (
        <div className="table-scroll" style={{ marginBottom: 24 }}>
          <table className="responsive-table">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>
              {data.rangeExpenses.map((e) => (
                <tr key={e.id}><td>{fmtDate(e.expense_date)}</td><td>{categoryNameById[e.category_id] || 'Uncategorized'}</td><td>{e.description || ''}</td><td style={{ textAlign: 'right' }}>{fmt(e.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr className="report-total-row" style={{ fontWeight: 700 }}><td></td><td></td><td>Total</td><td style={{ textAlign: 'right' }}>{fmt(data.expenseTotal)}</td></tr></tfoot>
          </table>
        </div>
        )}
        <h4>Fixed Expenses</h4>
        {data.rangeRecurringOccurrences.length === 0 ? (
          <div className="muted-small" style={{ marginBottom: 24 }}>No fixed expenses due in this period.</div>
        ) : (
          <div className="table-scroll" style={{ marginBottom: 24 }}>
            <table className="responsive-table">
              <thead><tr><th>Name</th><th>Category</th><th>Frequency</th><th>Month Due</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {data.rangeRecurringOccurrences.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.name}</td>
                    <td>{categoryNameById[r.category_id] || 'Uncategorized'}</td>
                    <td>{(FREQUENCIES.find((f) => f.value === r.frequency) || {}).label || r.frequency}</td>
                    <td>{r.occurredMonth}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="report-total-row" style={{ fontWeight: 700 }}><td></td><td></td><td></td><td>Total</td><td style={{ textAlign: 'right' }}>{fmt(data.fixedTotal)}</td></tr></tfoot>
            </table>
          </div>
        )}
        <h4>Savings by Month</h4>
        {data.rangeSavingsOccurrences.length === 0 ? (
          <div className="muted-small" style={{ marginBottom: 24 }}>No savings goals set for this period. Add one from the Savings tab.</div>
        ) : (
          <div className="table-scroll" style={{ marginBottom: 24 }}>
            <table className="responsive-table">
              <thead><tr><th>Month</th><th>Savings Goal</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {data.rangeSavingsOccurrences.map((s, idx) => (
                  <tr key={idx}><td>{s.occurredMonth}</td><td>{s.name}</td><td style={{ textAlign: 'right' }}>{fmt(s.amount)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr className="report-total-row" style={{ fontWeight: 700 }}><td></td><td>Total Savings</td><td style={{ textAlign: 'right' }}>{fmt(data.savingsGoalTotal)}</td></tr></tfoot>
            </table>
          </div>
        )}
        {data.rangeMonths.length > 1 && data.rangeSavingsOccurrences.length > 0 && (
          <>
            <h4>Total Saved Per Month</h4>
            <div className="table-scroll" style={{ marginBottom: 24 }}>
              <table className="responsive-table">
                <thead><tr><th>Month</th><th>Total Saved</th></tr></thead>
                <tbody>
                  {data.rangeMonths.map((mKey) => (
                    <tr key={mKey}><td>{mKey}</td><td style={{ textAlign: 'right' }}>{fmt(data.perMonthSavings[mKey] || 0)}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr className="report-total-row" style={{ fontWeight: 700 }}><td>Total</td><td style={{ textAlign: 'right' }}>{fmt(data.savingsGoalTotal)}</td></tr></tfoot>
              </table>
            </div>
          </>
        )}
        <h4>Pareto Chart -- Where Your Money Goes</h4>
        {data.paretoRows.length === 0 ? (
          <div className="muted-small" style={{ marginBottom: 24 }}>No expenses in this period.</div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {data.paretoRows.map((r, i) => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{r.name}</div>
                <div className="report-bar-track" style={{ flex: 1, borderRadius: 4, height: 14 }}>
                  <div style={{ width: `${Math.max(2, (r.val / data.maxCategoryVal) * 100)}%`, background: (r.cumPct <= 80 || i === 0) ? 'var(--ok)' : 'var(--muted)', height: '100%', borderRadius: 4 }} />
                </div>
                <div style={{ width: 90, fontSize: 12, textAlign: 'right', fontWeight: 600, flexShrink: 0 }}>{fmt(r.val)}</div>
                <div style={{ width: 44, fontSize: 12, textAlign: 'right', color: (r.cumPct <= 80 || i === 0) ? 'var(--ok)' : 'var(--muted)', flexShrink: 0 }}>{Math.round(r.cumPct)}%</div>
              </div>
            ))}
            <div className="muted-small" style={{ marginTop: 8 }}>
              {data.vitalFewNames.length} of {data.paretoRows.length} categories ({data.vitalFewNames.join(', ')}) make up about 80% of this period's spending.
            </div>
          </div>
        )}
        <h4>Where You Can Bring In Controls</h4>
        <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
          {data.suggestions.map((s, i) => (
            <li key={i} className="report-suggestion-item" style={{ marginBottom: 8, fontSize: 13 }}>{s}</li>
          ))}
        </ul>
        <div className="report-tip-box" style={{ marginTop: 8, padding: 12, borderRadius: 8, fontSize: 12 }}>
          <strong>Data & Privacy:</strong> The figures in this report are drawn directly from the data your household has entered into Hearth. This data is private to your household -- it is not visible to, or shared with, anyone outside your household's account, and it is not sold or provided to third parties. Once downloaded or emailed, this report becomes a standalone file outside the app, so please share it only with people you intend to see your household's financial information.
        </div>
      </div>
    );
}

  function handleGenerateReport() {
    if (!reportFrom || !reportTo || reportFrom > reportTo) {
      alert('Please choose a valid From/To date range.');
      return;
    }
    const { doc, filename, rangeLabel } = buildReportPdf(reportFrom, reportTo);
    const dataUri = doc.output('datauristring');
        // The on-screen preview uses a blob: URL (rather than the data: URI used
    // for email) with a "#view=FitH" PDF-open-parameter suffix so the
    // embedded page always fits the iframe's current width and re-fits
    // automatically if the browser window is resized, instead of staying
    // locked at a fixed zoom. The PDF's own font sizes were bumped up this
        // pass specifically so fit-width viewing still reads comfortably.
    if (reportPreviewUrlRef.current) URL.revokeObjectURL(reportPreviewUrlRef.current);
    const blobUrl = URL.createObjectURL(doc.output('blob'));
    reportPreviewUrlRef.current = blobUrl;
    setReportDoc({ dataUri, previewUrl: `${blobUrl}#view=FitH`, filename, rangeLabel, data: computeReportData(reportFrom, reportTo) });
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
  // Budget threshold alerts (35% / 60% of a category's monthly_budget) --
  // one bell item per category, escalating: a category already over 100%
  // shows via overCategories above instead of repeating itself here. Same
  // 35/60/100 tiers as the daily email alert (see
  // api/cron/rent-reminders.js's checkCategoryBudgetAlerts), just computed
  // live from what's already on screen instead of a server round-trip.
  categories.forEach((c) => {
    if (!(c.monthly_budget > 0)) return;
    if (overCategories.includes(c.name)) return;
    const spend = byCategory[c.name] || 0;
    const pct = (spend / c.monthly_budget) * 100;
    if (pct >= 60) {
      notifications.push({ id: `cat-pct-60-${c.name}`, text: `${c.name}: 60% of this month's budget used.` });
    } else if (pct >= 35) {
      notifications.push({ id: `cat-pct-35-${c.name}`, text: `${c.name}: 35% of this month's budget used.` });
    }
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

  // Shared body for the Users panel -- rendered from two different spots
  // (the standalone "Users" header button, and the "Users" sub-tab inside
  // Settings) so there is exactly one copy of this markup/logic instead of
  // two that could drift apart. Defined as a plain JSX value (not its own
  // component function) deliberately: a component defined inside another
  // component's body gets a new identity every render, which would force
  // React to unmount/remount this whole subtree on every keystroke (since
  // typing in any draft field re-renders the parent) and drop focus out of
  // whichever input the person was mid-edit in.
  // Coming Soon / roadmap content, reused two ways (same pattern as
  // usersPanelBody just below): the mobile bottom-nav "Soon" button still
  // sets activePanel to 'roadmap' directly, while the desktop entry point
  // (a pill inside Settings, per explicit request to declutter the top
  // nav row) switches settingsSubTab instead so the rest of the Settings
  // sub-tab row stays visible -- previously it used togglePanel('roadmap')
  // too, which navigated clean away from Settings and made every other
  // sub-tab pill disappear, per explicit bug report.
  const roadmapPanelBody = (
          <div className="panel" ref={panelRef}>
            <div className="muted-small" style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>
              What we're building next
            </div>
            <div className="my-details-box" style={{ marginBottom: 18, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>&#127974;</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Bank & card integration</span>
              </div>
              <p style={{ margin: 0, color: 'var(--muted)' }}>
                Connect your bank accounts and cards so income, expenses, and card transactions capture themselves automatically instead of manual entry -- transactions land in Hearth the moment they post. This is a bigger piece of work (it needs a secure banking-data provider behind the scenes), so it's planned for after the app is live and we've learned how the household actually uses it day to day.
              </p>
            </div>
            <div className="muted-small" style={{ marginTop: 4 }}>
              Have a feature you'd like to see next? Use the Suggestion link at the bottom of the app to let us know.
            </div>
          </div>
          );

  const usersPanelBody = (
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
                                    <span className="muted-small" style={{ marginRight: 10 }}>{m.name || m.email}</span>
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
  );

  // Shared Pie/Bar/Pareto/Treemap toggle row -- identical in both the
  // normal (narrow, next to the data-entry tabs) and Home-tab ("big
  // explore") layouts, since it's the same chartType state either way.
  const chartTypeToggle = (
    <div className="input-tabs" data-tour="chart-toggle">
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
      <button
        className={`btn small ${chartType === 'source' ? '' : 'secondary'}`}
        onClick={() => setChartType('source')}
      >
        By Source
      </button>
    </div>
  );

  // Renders the "Spending by category" chart card. Called with big=true
  // from the Home tab's dedicated explore section (see the !inputTab block
  // further down) for noticeably larger chart real estate to "play around"
  // in, and big=false everywhere else so the normal narrow layout next to
  // the data-entry tabs is untouched. Plain function (not its own component)
  // so it's just JSX built fresh per call -- see usersPanelBody above for
  // why that distinction matters.
  function renderChartCard(big) {
    // Home's bigger view gets a slightly higher pie cap (PIE_TOP_N_BIG);
    // the normal small side-panel chart keeps the original PIE_TOP_N.
    const topN = big ? PIE_TOP_N_BIG : PIE_TOP_N;
    const chartPieData = big ? getPieChartData(topN) : pieChartData;
    // Home's big bar chart can be flipped between the app's original
    // sideways-bar layout ('vertical') and a standing-column layout
    // ('horizontal') -- the small panel everywhere else always stays
    // 'vertical', matching its original look.
    const effectiveBarOrientation = big ? barOrientation : 'vertical';
    return (
      <div className="panel">
        <h2 style={{ margin: '0 0 4px' }}>Spending by category</h2>
        {big && chartType === 'bar' && (
          <div className="input-tabs" style={{ marginBottom: 8 }}>
            <button
              className={`btn small ${effectiveBarOrientation === 'vertical' ? '' : 'secondary'}`}
              onClick={() => setBarOrientation('vertical')}
            >
              Vertical
            </button>
            <button
              className={`btn small ${effectiveBarOrientation === 'horizontal' ? '' : 'secondary'}`}
              onClick={() => setBarOrientation('horizontal')}
            >
              Horizontal
            </button>
          </div>
        )}
        {pieData.length === 0 ? (
          <div className="empty">Add a regular expense to see the breakdown.</div>
        ) : chartType === 'pie' ? (
          <>
            {/* Home's big pie is now one 3-column row -- Total spent stats
                on the left, the pie itself in the middle, Top 10 categories
                on the right -- instead of a summary bar stacked above the
                chart. That lifts the pie up level with the stat blocks
                instead of sitting in its own row further down, and puts it
                literally between the left and right values, per explicit
                request. Small side panel (big=false) is untouched -- still
                just the chart alone, centered. */}
            {big ? (() => {
              const sortedPie = [...pieData].sort((a, b) => b.value - a.value);
              const totalSpent = pieData.reduce((s, d) => s + d.value, 0);
              const top5 = sortedPie.slice(0, 10);
              return (
                <div style={{ display: 'flex', gap: 24, alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 150px' }}>
                    <div className="muted-small" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Total spent</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}><Amt value={totalSpent} /></div>
                    <div className="muted-small">{pieData.length} categor{pieData.length === 1 ? 'y' : 'ies'} this month</div>
                    {overCategories.length > 0 && (
                      <div className="muted-small" style={{ color: 'var(--danger)', marginTop: 4 }}>
                        {overCategories.length} over budget
                      </div>
                    )}
                  </div>
                  <div style={{ flex: '1 1 320px', minWidth: 0, maxWidth: 480 }}>
                    {/* Radius and container height drop on phones (isMobile,
                        <=640px) -- a fixed 150px radius needed a ~320px-wide
                        plot area to avoid clipping its outer percent labels,
                        which a phone's Home explore column (full width minus
                        the frame's own padding) doesn't reliably have. 85px
                        comfortably fits a ~300px-wide phone with room for
                        labels either side; height shrinks to match so the
                        chart doesn't force an oversized scroll on a small
                        screen. Desktop's original 480/150 is untouched. */}
                    <ResponsiveContainer width="100%" height={isMobile ? 280 : 480}>
                      <PieChart margin={{ top: 4, right: 10, bottom: 0, left: 10 }}>
                        <Pie
                          data={chartPieData}
                          dataKey="value"
                          nameKey="name"
                          cy="50%"
                          outerRadius={isMobile ? '70%' : 150}
                          isAnimationActive={false}
                          label={({ percent }) => (percent >= 0.04 ? `${Math.round(percent * 100)}%` : '')}
                          labelLine={false}
                        >
                          {chartPieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                        
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: '1 1 230px', minWidth: 0 }}>
                    <div
                      className="report-collapsible-toggle"
                      onClick={() => setShowTop10((v) => !v)}
                      role="button"
                      tabIndex={0}
                    >
                      <span>Top 10 categories</span>
                      <ChevronDown size={22} strokeWidth={2.75} className={`report-toggle-chevron${showTop10 ? ' report-toggle-chevron-open' : ''}`} />
                    </div>
                    {showTop10 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {top5.map((c, i) => {
                        const pct = totalSpent > 0 ? Math.round((c.value / totalSpent) * 100) : 0;
                        return (
                          <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                            <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                            <span style={{ width: 130, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.name}</span>
                            <span className="muted-small" style={{ width: 32, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                            <span style={{ fontWeight: 700, width: 78, textAlign: 'right', flexShrink: 0 }}><Amt value={c.value} /></span>
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height={360}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 0, left: 20 }}>
                      <Pie
                        data={chartPieData}
                        dataKey="value"
                        nameKey="name"
                        cy="46%"
                        outerRadius={95}
                        isAnimationActive={false}
                        label={({ percent }) => (percent >= 0.04 ? `${Math.round(percent * 100)}%` : '')}
                        labelLine={false}
                      >
                        {chartPieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 10, lineHeight: '18px', paddingTop: 10 }} iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {pieData.length > topN && (
              <div className="muted-small" style={{ marginTop: 4 }}>
                Showing your top {topN} categories -- the rest are grouped into "Other" to keep this readable. Switch to Treemap or Bar to see every category separately.
              </div>
            )}
          </>
        ) : chartType === 'bar' && effectiveBarOrientation === 'horizontal' ? (
          // Standing-column layout: category names run along the bottom
          // (angled so longer names don't overlap), value goes up the
          // Y-axis -- the more familiar "bar chart" look, available on
          // Home's wider canvas.
          <ResponsiveContainer width="100%" height={big ? (isMobile ? 340 : 480) : 340}>
            {/* Top margin widened (20 -> 46, big only) to leave room for the
                rotated value label poking up above each column -- see
                DirhamBarLabelVerticalColumn. Bar itself narrowed (28 -> 20,
                big only) so more categories fit before the chart feels
                crowded, per explicit request to shrink bars for denser,
                more "elegant" coverage. On phones (isMobile), the big
                column-bar drops back to the same height as the small panel
                version and narrows further (14px) since a 390px-wide screen
                can't give each of, say, 8+ standing columns the room a
                480px-tall/20px-wide desktop layout assumes -- otherwise bars
                and their rotated labels start overlapping each other. */}
            <BarChart data={pieData} layout="horizontal" margin={{ top: big ? (isMobile ? 24 : 46) : 20, right: 20, left: 0, bottom: 70 }} barCategoryGap={big ? '20%' : '25%'}>
              <XAxis
                type="category"
                dataKey="name"
                interval={0}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
                tickFormatter={(name) => (name.length > 14 ? name.slice(0, 14) + '&' : name)}
              />
              <YAxis type="number" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="value" barSize={big ? (isMobile ? 14 : 20) : 28} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <LabelList dataKey="value" content={big ? DirhamBarLabelVerticalColumn : DirhamBarLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : chartType === 'bar' ? (() => {
          // Fixed a real overlap bug here: the wrapper below used to decide
          // scroll-vs-visible purely by category COUNT (>30 big / >17
          // small), while separately capping the box at a fixed maxHeight
          // (760/520). With a count under that threshold but a lot of
          // categories (e.g. 27), the actual content height (27 * 32 =
          // 864px) could still exceed the 760px cap -- and since overflow
          // was 'visible' in that case, the chart's own SVG simply painted
          // past the bottom of its box, bleeding into "Showing your top N"
          // and the AI Insights card below it. Now the needed height is
          // compared against the cap directly, so scrolling only turns
          // itself off when the content actually fits inside it.
          // On phones, the big view's per-row height/max height fall back to
          // the small-panel numbers (rather than the desktop-tuned 32/760)
          // so a long category list doesn't force an extremely tall chart
          // that dwarfs the rest of the Home explore section -- the same
          // internal scroll (barWillOverflow) still kicks in once content
          // exceeds the (now shorter) cap.
          const barMaxHeight = big ? (isMobile ? 520 : 760) : 520;
          const barRowHeight = big ? (isMobile ? 30 : 32) : 30;
          const barNeededHeight = Math.max(big ? 240 : 180, pieData.length * barRowHeight);
          const barWillOverflow = barNeededHeight > barMaxHeight;
          return (
          <div style={{ maxHeight: barMaxHeight, overflowY: barWillOverflow ? 'auto' : 'visible', marginBottom: 4 }}>
            {/* Right margin narrowed a lot on the big view (55 -> 26) --
                the rotated value label (DirhamBarLabelVerticalSideways)
                shoots straight up off the bar's tip instead of trailing
                sideways, so it no longer needs that wide reserved strip.
                That freed width plus a thinner bar (14 -> 10) and a
                shorter per-row height (42 -> 32) is what actually lets the
                plot area "cover more of the data elegantly": longer bars,
                more categories visible per screen, per explicit request. */}
            <ResponsiveContainer width="100%" height={barNeededHeight}>
              <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: big ? 60 : 55, left: 10, bottom: 5 }} barCategoryGap={big ? '35%' : '30%'}>
                <XAxis type="number" tick={{ fontSize: big ? 11 : 8.5 }} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={big ? (isMobile ? 95 : 140) : 95}
                  tick={{ fontSize: big ? 11 : 8.5 }}
                  tickFormatter={(name) => (name.length > (big ? (isMobile ? 13 : 20) : 13) ? name.slice(0, big ? (isMobile ? 13 : 20) : 13) + '&' : name)}
                />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="value" barSize={big ? 10 : 9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" content={big ? DirhamBarLabelVerticalSideways : DirhamBarLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          );
        })() : chartType === 'treemap' ? (
          <ResponsiveContainer width="100%" height={big ? (isMobile ? 400 : 560) : 360}>
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
        ) : chartType === 'source' ? (
          // Payment-source breakdown -- Phase 2 addition (Credit Card / Debit
          // Card / Bank Account / Cash spend as a chart, per explicit request
          // to use a chart-toggle option here instead of new dashboard tiles).
          <ResponsiveContainer width="100%" height={big ? (isMobile ? 340 : 400) : 320}>
            <BarChart data={paymentSourceData} margin={{ top: 55, right: 20, left: 30, bottom: 20 }}>
              <XAxis dataKey="name" tickFormatter={shortSourceLabel} tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tickFormatter={(v) => fmt(v)} width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(v)} cursor={false} labelStyle={{ color: '#1a1a1a', fontWeight: 600 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false} barSize={big ? undefined : 26}>
                {paymentSourceData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="top" content={DirhamBarLabelVerticalColumn} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={big ? (isMobile ? 380 : 520) : 340}>
            <ComposedChart data={paretoData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: big ? (isMobile ? paretoFontSize : 12) : paretoFontSize }}
                interval={0}
                angle={-50}
                textAnchor="end"
                height={75}
                tickFormatter={(name) => (name.length > paretoMaxNameLen ? name.slice(0, paretoMaxNameLen) + '&' : name)}
              />
              <YAxis yAxisId="left" tick={{ fontSize: big ? 11 : 9 }} width={big ? 50 : 40} />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v) => v + '%'}
                tick={{ fontSize: big ? 11 : 9 }}
                width={big ? 40 : 34}
              />
              <Tooltip
                formatter={(v, key) => (key === 'cumulative' ? v + '%' : fmt(v))}
              />
              <Bar yAxisId="left" dataKey="value" barSize={big ? (isMobile ? paretoBarSize : paretoBarSize + 6) : paretoBarSize} isAnimationActive={false}>
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
    );
  }

  // AI Insights and Budget Coach cards -- reused as-is (same size) in both
  // the normal narrow layout and the Home tab's big explore section, since
  // their content is text, not a chart that benefits from more room.
  const aiInsightsCard = (
    <div className="panel" style={{ marginTop: 16 }}>
      {/* Title on its own line, Generate button on the line right below it
          (was inline next to the title) -- both left-aligned, per explicit
          request to move the button below rather than floating beside the
          title. */}
      <h2 style={{ margin: '0 0 8px' }}>
        AI Insights <AiTag />
      </h2>
      <div className="row" style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button
          className="btn small secondary"
          onClick={generateMonthlyDigest}
          disabled={aiDigestLoading || pieData.length === 0}
        >
          {aiDigestLoading ? 'Thinking...' : aiDigest ? 'Refresh' : 'Generate'}
        </button>
      </div>
      {pieData.length === 0 ? (
        <div className="empty">Add a regular expense to get insights on this month.</div>
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
  );

  const budgetCoachCard = (
    <div className="panel" style={{ marginTop: 16 }}>
      {/* Same treatment as AI Insights above: title on its own line,
          Analyze trends button on the line right below it, left-aligned. */}
      <h2 style={{ margin: '0 0 8px' }}>
        Budget Coach <AiTag />
      </h2>
      <div className="row" style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 10, marginBottom: 4 }}>
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
  );

  return (
    <div className="wrap">
      {/* "Updated" confirmation toast -- fires on manual Add (Regular
          Expenses) and on receipt auto-add; auto-dismisses itself. */}
      
      {/* Header, month nav, and both summary-card rows are wrapped in one
          sticky block (see .sticky-dashboard-frame) so the whole "dashboard
          frame" stays frozen at the top while only the tabs/panels/lists
          below it scroll -- rather than just the title bar row by itself. */}
      <div className="sticky-dashboard-frame" ref={stickyFrameRef}>
      <div className="top-bar" ref={topRef}>
        <div className="top-bar-row">
          <div className="header-title-row" data-tour="brand">
            <HearthMark size={56} />
            {/* The page title is now editable right here, in place, instead
                of only through Settings > App Settings -- typing here and
                clicking away (auto-saves, same commitHouseholdName as
                before) renames the household/app label everywhere it shows
                (this header, the splash screen, PDF reports). Settings no
                longer has its own separate "Household name" field for this,
                since it would just be a second way to edit the same value. */}
            {isOwner ? (
              <>
                <input
                  type="text"
                  className="app-title-purple app-title-input"
                  value={householdNameDraft}
                  onChange={(e) => setHouseholdNameDraft(e.target.value)}
                  onBlur={(e) => commitHouseholdName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                  placeholder="Expense Management"
                  title="Click to rename -- saves automatically"
                  style={{ width: Math.max(120, (householdNameDraft?.length || 8) * 21) + 'px' }}
                />
                {/* Light-grey hint telling the owner they can (and should)
                    give the app its own name -- only shown while the field
                    is still empty, so it disappears the moment they save
                    a real title and never nags again after that. */}
                {!householdNameDraft && (
                  <span className="title-hint-text">add a title here</span>
                )}
              </>
            ) : (
              <h1 className="app-title-purple">{household.name || 'Hearth'}</h1>
            )}
          </div>
          <button
            type="button"
            className={`refresh-app-btn${updateAvailable ? ' refresh-app-btn-new' : ''}`}
            title={updateAvailable ? 'New update available -- click to refresh' : 'Refresh app'}
            onClick={() => { window.location.href = window.location.pathname + '?_r=' + Date.now(); }}
          >
            <RefreshCw size={16} />
            {updateAvailable && <span className="refresh-app-btn-badge">!</span>}
          </button>
          <div className="corner-badge-group">
<div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="profile-icon-btn"
                title="Profile"
                onClick={() => setProfileMenuOpen((o) => !o)}
              >
                <User size={18} />
<span className="corner-profile-label" title="This updates automatically -- if a change doesn't look right, reload the page.">{displayNameForEmail(session.user.email)} | {formatVersionBadge().replace(' ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½ ', ' | ')}</span>
              </button>
              {profileMenuOpen && profileDropdownPos && createPortal(
                <div className="profile-dropdown" style={{ position: 'fixed', top: profileDropdownPos.top, right: profileDropdownPos.right, zIndex: 500 }}>
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
                </div>,
                document.body
              )}
            </div>
                  </div>
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
            {/* Home -- the one entry in this row that isn't a data-entry tab.
                Clicking it clears both inputTab and activePanel so nothing
                but the dashboard itself (summary cards, chart, AI Insights,
                Budget Coach) is showing -- a quick way back to the plain
                overview after drilling into Income/Fixed/Report/etc. Every
                other button in this row keeps working exactly as before;
                clicking any of them simply replaces inputTab/activePanel
                again, the same way it always did. */}
            <button
              type="button"
              data-tour="nav-home"
              className={`btn-teal header-tab-btn ${!inputTab && !activePanel ? 'header-tab-btn-active' : ''}`}
              onClick={() => { setActivePanel(null); setInputTab(null); scrollToFrameA(); }}
              title="Show just the dashboard"
            >
              <Home size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Dashboard
            </button>
            <button
              type="button"
              className={`btn-teal header-tab-btn tab-visible-mobile ${inputTab === 'income' ? 'header-tab-btn-active' : ''}`}
              onClick={() => { setActivePanel(null); setInputTab('income'); scrollToFrameA(); }}
              >
              <Wallet size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Income
            </button>
            <button
              type="button"
              className={`btn-teal header-tab-btn tab-visible-mobile ${inputTab === 'fixed' ? 'header-tab-btn-active' : ''}`}
              onClick={() => { setActivePanel(null); setInputTab('fixed'); scrollToFrameA(); }}
              >
              <CalendarClock size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Fixed Expenses
            </button>
            <button
              type="button"
              data-tour="nav-add"
              className={`btn-teal header-tab-btn tab-visible-mobile ${inputTab === 'expense' ? 'header-tab-btn-active' : ''}`}
              onClick={() => { setActivePanel(null); setInputTab('expense'); scrollToFrameA(); }}
              >
              <ShoppingCart size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Regular Expenses
            </button>
            <button
              type="button"
              className={`btn-teal header-tab-btn tab-visible-mobile ${inputTab === 'savings' ? 'header-tab-btn-active' : ''}`}
              onClick={() => { setActivePanel(null); setInputTab('savings'); scrollToFrameA(); }}
              >
              <PiggyBank size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Savings
            </button>
            {/* Report/Settings/Help deliberately do NOT call scrollToFrameA()
                here -- they already have their own scroll-to-panel effect
                (see the activePanel-keyed useEffect above, which computes
                the sticky frame's real height and lands just below the
                panel's own heading). Calling scrollToFrameA() here too was
                firing a *second*, later scroll back to the very top of the
                page right after that effect had already positioned things
                correctly, which is why opening Report/Settings/Help looked
                like it stopped doing anything. */}
                        <button className={`btn-teal header-tab-btn tab-visible-mobile${activePanel === 'investments' ? ' header-tab-btn-active' : ''}`} onClick={() => togglePanel('investments')}>
              <Landmark size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Investments
            </button>
            <button className={`btn-teal header-tab-btn tab-visible-mobile${activePanel === 'report' ? ' header-tab-btn-active' : ''}`} onClick={() => togglePanel('report')}>
              <FileText size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Report
            </button>
                        <button className={`btn-teal header-tab-btn tab-hide-mobile${activePanel === 'settings' ? ' header-tab-btn-active' : ''}`} data-tour="nav-settings" onClick={() => togglePanel('settings')}>
              <SettingsIcon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Settings
            </button>
            {/* Standalone "Users" button removed from this row -- Users
                management now lives under Settings > Users instead, so
                there's one way to reach it, not two. */}
                        <button className={`btn-teal header-tab-btn tab-hide-mobile${activePanel === 'help' ? ' header-tab-btn-active' : ''}`} data-tour="nav-help" onClick={() => togglePanel('help')}>
              <HelpCircle size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Help
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
              {themeMenuOpen && themeDropdownPos && createPortal(
                <div className="theme-dropdown" style={{ position: 'fixed', top: themeDropdownPos.top, right: themeDropdownPos.right, zIndex: 500 }}>
                    <div className="theme-dropdown-title">Appearance</div>
                    <div className="theme-mode-row">
            <button
              type="button"
              className={`theme-mode-btn ${mode === 'light' ? 'active' : ''}`}
              onClick={() => setMode('light')}
            >
              <Sun size={14} /> Light
            </button>
            <button
              type="button"
              className={`theme-mode-btn ${mode === 'dark' ? 'active' : ''}`}
              onClick={() => setMode('dark')}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
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
                </div>,
                document.body
              )}
            </div>
            {/* Profile icon replaces the old standalone Sign out button --
                clicking it shows the signed-in email plus the same
                self-editable Name/Phone/Location fields as "My details" in
                Users, with Sign out as the last action in the dropdown. */}
            <div className="notif-bell-wrap" ref={notifBellRef}>
              <button
                type="button"
                data-tour="notif-bell"
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
            <div className="chat-fab-wrap chat-fab-wrap-spaced" ref={chatMenuRef}>
              <button
                type="button"
                                                            className="chat-fab-btn tab-hide-mobile"
                        title={chatOpen ? 'Close chat' : 'Aria - Your AI Assistant'}
                onClick={() => setChatOpen((o) => !o)}
              >
                          {chatOpen ? <X size={18} /> : <Bot size={18} strokeWidth={2.2} className="aria-icon-motion" />}
              </button>
              {!chatOpen && (
                <>
            <span className="chat-fab-badge-title chat-fab-badge-below tab-hide-mobile">Aria</span>
                </>
              )}
              {chatOpen && (() => {
                const chatWindowEl = (
                  <div className="chat-window" ref={chatWindowRef} style={chatPos ? (chatPos.mobile ? { position: 'fixed', bottom: chatPos.bottom, top: 'auto', left: '50%', right: 'auto', transform: 'translateX(-50%)', maxHeight: chatPos.maxHeight } : { position: 'fixed', top: chatPos.top, right: chatPos.right, left: 'auto' }) : undefined}>
                  <div className="chat-header">
                              <span>Ask Aria about your Expenses, Budgets and Savings <AiTag /></span>
                    <div className="chat-header-actions">
                      {/* Chat history is now saved (see chat_messages table)
                          and shared by the whole household, so this is the
                          one way to actually start over -- with a confirm,
                          since it wipes it for everyone, not just this
                          browser. */}
                      {chatMessages.length > 0 && (
                        <button onClick={clearChatHistory} aria-label="Clear chat history" title="Clear chat history for everyone">
                          <Trash2 size={15} />
                        </button>
                      )}
                      <button onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={16} /></button>
                    </div>
                  </div>
                  <div className="chat-messages" ref={chatMessagesRef}>
                    {chatMessages.length === 0 && (
                      <div className="chat-empty">
                        <div className="chat-empty-greeting">Hello {displayNameForEmail(session.user.email)}, I'm Aria. How can I help today? </div>
I can help you track expenses, understand spending patterns, create budgets, and make smarter financial decisions including your saving plans.
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
                      onFocus={() => {
                        // iOS -- especially in standalone/home-screen PWA
                        // mode -- auto-scrolls the whole page to reveal a
                        // newly-focused input the instant it's tapped, even
                        // though this one lives inside an always-visible
                        // position:fixed popup that never needed scrolling
                        // into view in the first place. WebKit's "scroll
                        // focused element into view" heuristic doesn't seem
                        // to account for fixed-position ancestors, so the
                        // entire screen visibly jumps. Forcibly re-pinning
                        // the scroll position across a few frames/timeouts
                        // cancels that out-of-our-control auto-scroll
                        // without touching the popup's own (already
                        // static) position.
                        if (!isMobile) return;
                        const y = window.scrollY;
                        const lock = () => window.scrollTo(0, y);
                        requestAnimationFrame(lock);
                        setTimeout(lock, 50);
                        setTimeout(lock, 150);
                        setTimeout(lock, 350);
                      }}
                      placeholder="Ask a question..."
                      disabled={chatLoading}
                    />
                    <button type="submit" className="btn small" disabled={chatLoading || !chatInput.trim()}>Send</button>
                  </form>
                </div>
                );
                return chatPos ? createPortal(chatWindowEl, document.body) : chatWindowEl;
              })()}
            </div>
            </div>
        </div>

      {/* Every header tab shows its own name as a small left-aligned title
          right above the month nav, matching whichever button was clicked
          -- Income/Fixed Expenses/Regular Expenses/Savings used to only
          show their name as a heading buried inside their own panel further
          down the page (easy to miss, per explicit feedback), and
          Report/Settings/Help used to render cramped inside their own
          narrow content-grid column. Uses its own .page-title-themed class
          (25px, left-aligned) -- deliberately separate from
          .panel-title-themed (40px) below, which stays exactly as it was on
          the in-frame headings ("Regular Expenses for {month}", "Your fixed
          expenses", the Income/Fixed Expenses/Regular Expenses/Savings
          add-form headings) per explicit request to leave those in place,
          just left-aligned instead of centered.

          IMPORTANT: inputTab (Income/Fixed/Regular/Savings) and activePanel
          (Report/Settings/Help/Users) are NOT mutually exclusive elsewhere
          in this app -- Report/Settings/Help are togglable overlays that
          can stay open at the same time as whichever data-entry tab was
          last selected (confirmed live: opening Report while Savings was
          still selected showed both "Savings" and "Report" stacked on top
          of each other). So the inputTab titles below are gated on
          `!activePanel` -- whenever an activePanel overlay is open, its
          title wins and is the only one shown. */}
      <div className="page-title-row">
      {toastMsg && activePanel !== 'investments' && <div className="app-toast">{toastMsg}</div>}
      {!inputTab && !activePanel && (
        <h2 className="page-title-themed">Dashboard</h2>
      )}
      {!activePanel && inputTab === 'income' && <h2 className="page-title-themed">Income</h2>}
      {!activePanel && inputTab === 'fixed' && <h2 className="page-title-themed">Fixed Expenses</h2>}
      {!activePanel && inputTab === 'expense' && <h2 className="page-title-themed">Regular Expenses</h2>}
      {!activePanel && inputTab === 'savings' && <h2 className="page-title-themed">Savings</h2>}
      {activePanel === 'report' && <h2 className="page-title-themed">Report</h2>}
      {activePanel === 'settings' && <h2 className="page-title-themed">Settings</h2>}
      {activePanel === 'help' && <h2 className="page-title-themed">Help</h2>}
      {activePanel === 'roadmap' && <h2 className="page-title-themed">Coming Soon</h2>}

      {/* Month selection has no purpose on Settings/Help -- neither ever
          shows monthly spending data, so the nav (and its date-range
          filter) is hidden entirely for those two rather than just hiding
          the filter piece. Income and Savings used to be excluded here too
          (their own "for the month" lists are month-scoped, so the nav is
          just as relevant there as on Fixed/Regular Expenses) -- removed
          per explicit request so they now get it as well. */}
{activePanel !== 'settings' && activePanel !== 'help' && activePanel !== 'roadmap' && (
      <div className="month-nav">
        <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>&lsaquo;</button>
        <div className="label">{monthLabel(currentMonth)}</div>
        <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>&rsaquo;</button>
        {/* No date range on Settings/Help -- neither shows any spending data,
            so narrowing "this month" to a sub-range has nothing to act on
            there. */}
        {activePanel !== 'settings' && activePanel !== 'help' && activePanel !== 'roadmap' && (
        <div className="filter-wrap" ref={rangeRef}>
          <button
            type="button"
            className={`filter-btn ${!rangeIsFullMonth ? 'active' : ''}`}
            onClick={() => setRangeOpen((o) => !o)}
            title="Date range"
          >
            <CalendarClock size={13} />
            {rangeIsFullMonth ? 'Full month' : `${fmtDate(rangeStart)} - ${fmtDate(rangeEnd)}`}
            {!rangeIsFullMonth && <span className="filter-active-dot" />}
          </button>
          {rangeOpen && (
            <div className="filter-dropdown" style={{ width: 240 }}>
              <div className="filter-dropdown-title">Date range within {monthLabel(currentMonth)}</div>
              <div className="filter-field">
                <label>Start</label>
                <input
                  type="date"
                  value={rangeStart}
                  min={firstDayOfMonthStr(currentMonth)}
                  max={rangeEnd}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </div>
              <div className="filter-field">
                <label>End</label>
                <input
                  type="date"
                  value={rangeEnd}
                  min={rangeStart}
                  max={lastDayOfMonthStr(currentMonth)}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>
              <div className="muted-small" style={{ fontSize: 11, lineHeight: 1.5 }}>
                Narrows Spent so far/Remaining/Net and the spending chart to Regular Expenses in this range. Fixed Expenses, Income, Savings, and the Regular Expenses list below always show the full month.
              </div>
              {!rangeIsFullMonth && (
                <button
                  type="button"
                  className="filter-clear-btn"
                  onClick={() => {
                    setRangeStart(firstDayOfMonthStr(currentMonth));
                    setRangeEnd(lastDayOfMonthStr(currentMonth));
                  }}
                >
                  Reset to full month
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>
)}
      </div>
{(!isMobile || (!inputTab && !activePanel)) && (
<div className="summary-cards">
            <div className="grid">
                <div className="card card-budget">
          <div className="k">Monthly Budget</div>
          {totalBudget > 0 ? (
            <div className="v"><Amt value={totalBudget} /></div>
          ) : (
            <div className="muted-small" style={{ marginTop: 4 }}>You can enter monthly budget values in settings</div>
          )}
        </div>
        <div className={`card card-spent ${totalBudget > 0 && combinedOutflow > totalBudget ? 'over' : ''}`}>
          <div className="k">Spent so far (incl. savings)</div><div className="v"><Amt value={combinedOutflow} /></div>
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
              <div className="v"></div>
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
          <div className="k">Combined expenses (incl. savings)</div>
          <div className="v"><Amt value={combinedOutflow} /></div>
          <div className="muted-small" style={{ marginTop: 4 }}>
            Regular <Amt value={oneOffTotal} /> + Fixed <Amt value={recurringTotal} />{savingsTotal > 0 ? <> + Savings <Amt value={savingsTotal} /></> : ''}
          </div>
        </div>
        <div className={`card card-net ${netCombined < 0 ? 'over' : 'ok'}`}>
          <div className="k">Net (income - expenses - savings)</div><div className="v"><Amt value={netCombined} /></div>
        </div>
        {(
          <div className={`card card-invest ${investmentTotals.gain < 0 ? 'over' : 'ok'}`}>
            <div className="k">My Investments</div>
            <div className="v"><Amt value={investmentTotals.current} /></div>
            <div className="muted-small" style={{ marginTop: 4 }}>
              Invested <Amt value={investmentTotals.principal} /> -- {investmentTotals.gain >= 0 ? 'Gain' : 'Loss'} <Amt value={Math.abs(investmentTotals.gain)} />
            </div>
          </div>
        )}
        <div className="card card-cc">
          <div className="k">{paymentTypeTileLabel('Credit Card')}</div>
          <div className="v"><Amt value={byPaymentType.totals['Credit Card'] || 0} /></div>
        </div>
        <div className="card card-dc">
          <div className="k">{paymentTypeTileLabel('Debit Card')}</div>
          <div className="v"><Amt value={byPaymentType.totals['Debit Card'] || 0} /></div>
        </div>
        <div className="card card-ba">
          <div className="k">{paymentTypeTileLabel('Bank Account')}</div>
          <div className="v"><Amt value={byPaymentType.totals['Bank Account'] || 0} /></div>
        </div>
      </div>
      </div>
)}
      </div>
      <div className="sticky-dashboard-frame-spacer" style={{ height: 0 }} />

      <div className="content-grid">
        <div ref={inputTabsSectionRef} className={addSheetOpen ? 'mobile-add-sheet' : undefined}>
          {addSheetOpen && (
            <div className="mobile-sheet-handle">
              <span className="mobile-sheet-drag" />
              <button
                className="mobile-sheet-close"
                onClick={() => { setAddSheetOpen(false); window.scrollTo({ top: 0, behavior: 'auto' }); }}
                aria-label="Close"
              >
                
              </button>
            </div>
          )}
          {activePanel === 'investments' ? (
 <>
 <div className="panel" ref={panelRef} style={{ maxWidth: '100%', marginBottom: 24 }}>
            <div className="panel-title-row-inline" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 className="panel-title-themed" style={{ marginBottom: 0 }}>My Investments</h2>
              <button
                type="button"
                className="report-info-btn"
                aria-label="About Investments"
                title="About Investments"
                onClick={() => setInvestmentsInfoOpen((v) => !v)}
              >
                {'\u24D8'}
              </button>
              {toastMsg && activePanel === 'investments' && <div className="app-toast">{toastMsg}</div>}
            </div>
            <div className={`muted-small report-desc${investmentsInfoOpen ? ' is-open' : ''}`} style={{ textAlign: 'left', marginTop: -6, marginBottom: 12 }}>
              Fixed Deposits and Mutual Fund / SIP investments, tracked separately from the household budget. Visible to everyone in your household.
              If you withdraw money from an FD or SIP and spend it, record that spend as a normal entry under Regular Expenses -- this tab only tracks what's invested, not day-to-day spending.
            </div>
            <div className="row investments-field-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: '0 1 170px' }}>
                <label>Type</label>
                <select
                  value={investmentForm.investmentType}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, investmentType: e.target.value })}
                >
                  <option value="Fixed Deposit">Fixed Deposit</option>
                  <option value="Mutual Fund">Mutual Fund / SIP</option>
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label>Name</label>
                <input
                  type="text"
                  value={investmentForm.name}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, name: e.target.value })}
                  placeholder={investmentForm.investmentType === 'Fixed Deposit' ? 'e.g. 1-Year FD' : 'e.g. HDFC Flexicap SIP'}
                />
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label>{investmentForm.investmentType === 'Fixed Deposit' ? 'Bank' : 'Fund House'}</label>
                {investmentForm.investmentType === 'Fixed Deposit' ? (
                  <SearchableCombobox value={investmentForm.institution} onChange={(v) => setInvestmentForm({ ...investmentForm, institution: v })} options={BANKS} placeholder="Search bank..." />
                ) : (
                  <input
                    type="text"
                    value={investmentForm.institution}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, institution: e.target.value })}
                    placeholder="e.g. HDFC Mutual Fund"
                  />
                )}
              </div>
              <div className="field" style={{ flex: '0 1 190px' }}>
                <label>Currency</label>
                <SearchableCombobox value={investmentForm.currency} onChange={(v) => { const vv = v.toUpperCase(); if (CURRENCIES.includes(vv)) setInvestmentForm({ ...investmentForm, currency: vv }); else setInvestmentForm({ ...investmentForm, currency: v }); }} options={CURRENCIES.map((c) => ({ value: c, label: c + (CURRENCY_REGIONS[c] ? ' - ' + CURRENCY_REGIONS[c] : '') }))} placeholder="Search currency..." />
                {investmentForm.currency && investmentForm.currency !== CURRENT_CURRENCY && (
                  <div className="muted-small" style={{ marginTop: 4 }}>
                    {investFxRates && investFxRates[investmentForm.currency]
                      ? `Live rate: 1 ${investmentForm.currency} = ${(1 / investFxRates[investmentForm.currency]).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${CURRENT_CURRENCY}`
                      : 'Fetching live exchange rate...'}
                  </div>
                )}
              </div>
              <div className="field" style={{ flex: '0 1 140px' }}>
                <label>{investmentForm.investmentType === 'Fixed Deposit' ? 'Principal Amount' : 'Total Invested So Far'}</label>
                <input
                  type="number" min="0" step="0.01"
                  value={investmentForm.principal}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, principal: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="field" style={{ flex: '0 1 140px' }}>
                <label>Current Value</label>
                <input
                  type="number" min="0" step="0.01"
                  value={investmentForm.currentValue}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, currentValue: e.target.value })}
                  placeholder="Same as principal if unsure"
                />
              </div>
              {showInvestmentMoreFields && (investmentForm.investmentType === 'Fixed Deposit' ? (
                <div className="field" style={{ flex: '0 1 130px' }}>
                  <label>Interest Rate (% p.a.)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={investmentForm.interestRate}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, interestRate: e.target.value })}
                    placeholder="e.g. 4.5"
                  />
                </div>
              ) : (
                <div className="field" style={{ flex: '0 1 130px' }}>
                  <label>Monthly SIP Amount</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={investmentForm.sipAmount}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, sipAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              ))}
              <div className="field" style={{ flex: '0 1 120px' }}>
                <label>Start Date</label>
                <input
                  type="date"
                  value={investmentForm.startDate}
                  onChange={(e) => setInvestmentForm({ ...investmentForm, startDate: e.target.value })}
                />
              </div>
              
              <div className="field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowInvestmentMoreFields((s) => !s)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: '10px 0', whiteSpace: 'nowrap' }}
                >
                  {showInvestmentMoreFields ? 'Hide rate/maturity date' : '+ Rate or maturity date'}
                </button>
              </div>
              {showInvestmentMoreFields && (investmentForm.investmentType === 'Fixed Deposit' && (
                <div className="field" style={{ flex: '0 1 120px' }}>
                  <label>Maturity Date</label>
                  <input
                    type="date"
                    value={investmentForm.maturityDate}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, maturityDate: e.target.value })}
                  />
                </div>
              ))}
              {editingInvestmentId && (
                <div className="field" style={{ flex: '0 1 140px' }}>
                  <label>Status</label>
                  <select
                    value={investmentForm.status}
                    onChange={(e) => setInvestmentForm({ ...investmentForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Matured">Matured</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              )}
              <div className="field" style={{ flex: '0 0 auto', display: 'flex', gap: 8 }}>
                <button className="btn" type="button" onClick={handleSaveInvestment} style={{ height: 40 }}>
                  {editingInvestmentId ? 'Save Changes' : 'Add'}
                </button>
                {editingInvestmentId && (
                  <button className="btn secondary" type="button" onClick={cancelEditInvestment} style={{ height: 40 }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="panel" style={{ maxWidth: '100%', marginBottom: 24 }}>
            <h2 className="panel-title-themed" style={{ fontSize: 16 }}>Your Investment Records</h2>
            <div>
              <div className="muted-small" style={{ marginBottom: 14, fontSize: 13, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)', borderRadius: 8, padding: '10px 12px' }}>
                
                {investments.length} {investments.length === 1 ? 'entry' : 'entries'} -- Invested <strong><Amt value={investmentTotals.principal} /></strong> -- Current <strong style={{ color: '#0ea5e9' }}><Amt value={investmentTotals.current} /></strong> -- <strong style={{ color: investmentTotals.gain >= 0 ? '#1a7f37' : '#d1242f' }}>{investmentTotals.gain >= 0 ? 'Gain' : 'Loss'} <Amt value={Math.abs(investmentTotals.gain)} /></strong>
              </div>
              {investments.length === 0 ? (
                <div className="empty">No investments added yet.</div>
              ) : (
                <div className="mobile-txn-list">
                  {investments.map((inv) => {
                    const cur = investAccruedValue(inv);
                    const gain = cur - Number(inv.principal_amount || 0);
                    const estFlag = investIsEstimated(inv);
                    const isFD = inv.investment_type === 'Fixed Deposit';
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        className="mobile-txn-row"
                        onClick={() => startEditInvestment(inv)}
                      >
                        <span className="mobile-txn-icon" style={{ background: isFD ? '#8b5cf6' : '#0d9488' }}>
                          {isFD ? 'FD' : 'MF'}
                        </span>
                        <span className="mobile-txn-mid">
                          <span className="mobile-txn-title">{inv.name}</span>
                          <span className="mobile-txn-sub">
                            {inv.institution || '--'}
                            {isFD
                              ? (inv.interest_rate != null ? ` \u00b7 ${inv.interest_rate}% p.a.` : '')
                              : (inv.sip_amount != null ? ` \u00b7 ${fmt(inv.sip_amount)}/mo` : '')}
                            {inv.start_date ? ` \u00b7 Started ${inv.start_date}` : ''}
                          </span>
                        </span>
                        <span style={{ textAlign: 'right', flex: '0 0 auto' }}>
                          <span className="mobile-txn-amount"><AmtCur value={cur} currency={inv.currency} />{estFlag && <span className="muted-small" style={{ marginLeft: 4 }}>(est.)</span>}</span>
                          <div className="muted-small" style={{ marginTop: 2 }}>{investDisplayStatus(inv)}{inv.maturity_date ? ` \u00b7 ${inv.maturity_date}` : ''}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: gain >= 0 ? '#1a7f37' : '#d1242f' }}>
                            {gain >= 0 ? '+' : '-'}<AmtCur value={Math.abs(gain)} currency={inv.currency} />
                          </div>
                          <span
                            role="button"
                            tabIndex={0}
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); handleDeleteInvestment(inv.id, inv.name); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteInvestment(inv.id, inv.name); } }}
                            style={{ display: 'inline-flex', marginTop: 4, cursor: 'pointer', color: 'var(--muted)' }}
                          >
                            <Trash2 size={13} />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
</>
) : (
<>
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
              Regular Expenses
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
            <h2 className="panel-title-themed form-title-mobile-hide">Regular Expenses</h2>
            <form onSubmit={handleAddExpense}>
            <div className="row">
              <div className="field-pair">
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : undefined}>
                <label>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 0 auto' }}>
                {/* Mobile: this field is forced to flex:1 1 0 (see isMobile
                    above) so Date and Amount split the pair's width evenly --
                    without that override, Amount's desktop content-sized
                    flex:'0 0 auto' would win over the mobile CSS rule (inline
                    style beats a class rule), leaving Date to grab all the
                    leftover space and visually overlap/crowd Amount. */}
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
          </div>
            {/* Payment source sits on its own row, below the main fields --
                keeping it out of the first row avoids cramming a 5th/6th
                field into a row already tight on width (the exact pattern
                that caused the earlier Amount/Start-date overlap bug in
                Fixed Expenses). The bank picker only renders once a card
                option is chosen, so Cash payers never see an irrelevant field. */}
            <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}>
              <div className="field-pair">
              <div className="field" style={{ flex: '0 1 150px', minWidth: 130 }}>
                <label>Payment Source</label>
                <select
                  value={form.paymentSource}
                  onChange={(e) => { const src = e.target.value; setForm({ ...form, paymentSource: src, paymentBank: src === 'Cash' ? '' : (form.paymentBank || getDefaultBankFor(src)) }); }}
                >
                  {PAYMENT_SOURCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {form.paymentSource !== 'Cash' && (
                <div className="field" style={{ flex: '0 1 190px', minWidth: 150 }}>
                  <label>Bank</label>
                  <SearchableCombobox value={form.paymentBank} onChange={(v) => setForm({ ...form, paymentBank: v })} options={BANKS} placeholder="Search bank..." />
                </div>
              )}
              </div>
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
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`icon-btn-outline ${form.notes ? 'active' : ''}`}
                    title="Add a note"
                    onClick={() => setShowExpenseNotes((s) => !s)}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <StickyNote size={16} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn-outline ${expenseFiles.length > 0 ? 'active' : ''}`}
                    title="Attach documents"
                    onClick={() => expenseFilesInputRef.current?.click()}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    ref={expenseFilesInputRef}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleAttachmentPick(e.target.files, setExpenseFiles)}
                  />
                  {myPrivacyEnabled && (
                  <label className="muted-small" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} title="Only you will be able to see this entry">
                    <input type="checkbox" checked={expenseIsPrivate} onChange={(e) => setExpenseIsPrivate(e.target.checked)} />
                    Private
                  </label>
                )}
                <button className="btn" type="submit" style={{ height: 40, flex: '0 0 auto' }}>Add</button>
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
            <PendingAttachmentChips files={expenseFiles} onRemove={(i) => removeAttachmentAt(setExpenseFiles, i)} />
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
                Upload a photo of a receipt, or a sheet/screenshot listing several expenses -- Claude adds them straight to the list below (payment source included, when the receipt shows one). Edit anything that looks wrong afterwards.
              </div>
              {scanError && <div className="scan-error">{scanError}</div>}
              {lastScanAdded.length > 0 && (
                <div className="scan-added-summary">
                  Added {lastScanAdded.length} expense{lastScanAdded.length === 1 ? '' : 's'}: {lastScanAdded.map((r) => `${r.description} (${r.amount})`).join(', ')}
                </div>
              )}
            </div>
          </div>
          )}

          {inputTab === 'income' && (
          <div className="panel">
            <h2 className="panel-title-themed form-title-mobile-hide">Income</h2>
            <form onSubmit={handleAddIncome}>
            {/* Month field removed on purpose -- this entry's month
                already comes from the month-nav selector above (see the
                effect that syncs newIncome.month to currentMonth), so a
                second, editable Month input here was pure duplication. To
                save an entry for a different month, switch the month-nav
                first, same as everywhere else the entry list is filtered. */}
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
              <div className="field-pair">
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : undefined}>
                <label>Whose income</label>
                <select
                  value={newIncome.memberEmail}
                  onChange={(e) => setNewIncome({ ...newIncome, memberEmail: e.target.value })}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.email}>{displayNameForEmail(m.email)}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 0 auto' }}>
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
              </div>
              {/* Note + Attach + Add live together in ONE flex item, in that
                  order, immediately before Add -- per explicit request that
                  these icons sit right before the Add button on every tab. */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`icon-btn-outline ${newIncome.notes ? 'active' : ''}`}
                    title="Add a note"
                    onClick={() => setShowIncomeNotes((s) => !s)}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <StickyNote size={16} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn-outline ${incomeFiles.length > 0 ? 'active' : ''}`}
                    title="Attach documents"
                    onClick={() => incomeFilesInputRef.current?.click()}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    ref={incomeFilesInputRef}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleAttachmentPick(e.target.files, setIncomeFiles)}
                  />
                  {myPrivacyEnabled && (
                  <label className="muted-small" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} title="Only you will be able to see this entry">
                    <input type="checkbox" checked={incomeIsPrivate} onChange={(e) => setIncomeIsPrivate(e.target.checked)} />
                    Private
                  </label>
                )}
                <button className="btn" type="submit" style={{ height: 40, flex: '0 0 auto' }}>Add</button>
                </div>
              </div>
            </div>
            {showIncomeNotes && (
              <div className="field" style={{ marginTop: 8 }}>
                <label>Note (optional, long description)</label>
                <textarea
                  rows={2}
                  placeholder="Any extra detail about this income..."
                  value={newIncome.notes}
                  onChange={(e) => setNewIncome({ ...newIncome, notes: e.target.value })}
                />
              </div>
            )}
            <PendingAttachmentChips files={incomeFiles} onRemove={(i) => removeAttachmentAt(setIncomeFiles, i)} />
            </form>
            <div className="panel-heading-row" style={{ justifyContent: 'flex-end', marginTop: 8, marginBottom: 0 }}>
              <div className="filter-wrap" ref={incomeFilterRef}>
                <button
                  type="button"
                  className={`filter-btn ${incomeFilterActive ? 'active' : ''}`}
                  onClick={() => setIncomeFilterOpen((o) => !o)}
                >
                  <Filter size={13} />
                  Filter
                  {incomeFilterActive && <span className="filter-active-dot" />}
                </button>
                {incomeFilterOpen && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-title">Filter Income</div>
                    <div className="filter-field">
                      <label>Source</label>
                      <select
                        value={incomeFilter.source}
                        onChange={(e) => setIncomeFilter({ ...incomeFilter, source: e.target.value })}
                      >
                        <option value="">All sources</option>
                        {incomeSourceOptions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-field">
                      <label>Member</label>
                      <select
                        value={incomeFilter.member}
                        onChange={(e) => setIncomeFilter({ ...incomeFilter, member: e.target.value })}
                      >
                        <option value="">All members</option>
                        {incomeMemberOptions.map((m) => (
                          <option key={m} value={m}>{displayNameForEmail(m)}</option>
                        ))}
                      </select>
                    </div>
                    {incomeFilterActive && (
                      <button
                        type="button"
                        className="filter-clear-btn"
                        onClick={() => setIncomeFilter({ source: '', member: '' })}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {filteredIncomeForMonth.length > 0 && (
              <div className="section-total-badge">
                {filteredIncomeForMonth.length} {filteredIncomeForMonth.length === 1 ? 'entry' : 'entries'} &middot; Total {fmt(filteredIncomeForMonth.reduce((s, i) => s + (Number(i.amount) || 0), 0))}
              </div>
            )}

            {incomeForMonth.length === 0 ? (
              <div className="empty">No income added for {monthLabel(currentMonth)} yet.</div>
            ) : filteredIncomeForMonth.length === 0 ? (
              <div className="empty">No income matches the current filter.</div>
            ) : (
              <div className="mobile-txn-list">
                {filteredIncomeForMonth.map((i) => {
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
                        <span className="mobile-txn-title">
                          {title}
                          {i.notes && <StickyNote size={11} className="row-attach-hint" />}
                          {getRowAttachments('incomes', i.id).length > 0 && <Paperclip size={11} className="row-attach-hint" />}
                        </span>
                        <span className="mobile-txn-sub">{displayNameForEmail(i.member_email)}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={i.amount} /></span>
                    </button>
                  );
                })}
              </div>
            )}
            {incomeForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                Changes save automatically. <Amt value={totalIncome} /> in combined income counted toward {monthLabel(currentMonth)}.
              </div>
            )}

            {/* Mobile edit sheet for a tapped income row -- same fields/handlers as desktop's inline row. */}
            {editingIncomeId && (() => {
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
                    {(i.notes || getRowAttachments('incomes', i.id).length > 0) && (
                      <div className="muted-small" style={{ marginBottom: 10 }}>
                        {i.notes && <div style={{ marginBottom: 4 }}><StickyNote size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{i.notes}</div>}
                        {getRowAttachments('incomes', i.id).length > 0 && (
                          <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => openAttachmentList('incomes', i.id, i.name)}>
                            <Paperclip size={12} style={{ marginRight: 4, verticalAlign: -2 }} />View attachments ({getRowAttachments('incomes', i.id).length})
                          </button>
                        )}
                      </div>
                    )}
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
          <div className="muted-small" style={{ marginTop: 14 }}>
            Income is entered per month on purpose -- it won't automatically carry over. The list below only shows entries for {monthLabel(currentMonth)}; add a new row for each new month.
          </div>
          </div>
          )}

          {inputTab === 'fixed' && (
          <>
          <div className="panel">
            <h2 className="panel-title-themed form-title-mobile-hide">Fixed Expenses</h2>
            <div className="muted-small" style={{ textAlign: 'center', marginTop: -6, marginBottom: 12 }}>
              Loans, EMIs, credit cards, rent
            </div>
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
            {/* Row 1: what the expense is, how much, how often, what
                category -- the "what/how much" facts. Row 2 (below): the
                "when/how paid" scheduling facts. Splitting into two
                explicit rows (rather than one long row that auto-wraps
                wherever flexbox happens to run out of width) is what keeps
                field order predictable on desktop -- an auto-wrapped single
                row was cutting a field-pair in half across two lines,
                which is what made the form look "funny"/out of order. */}
            <div className="row">
              <div className="field-pair">
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '1.2 1 180px', minWidth: 160 }}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Car loan EMI"
                  value={newRecurring.name}
                  onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
                  onBlur={(e) => suggestFixedCategoryFromDescription(e.target.value)}
                />
              </div>
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 0 auto' }}>
                <label>Amount/M.</label>
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
              </div>
              <div className="field" style={{ flex: '1.3 1 190px', minWidth: 170 }}>
                <label>Category <AiTag /></label>
                <select
                  value={newRecurring.categoryId}
                  onChange={(e) => setNewRecurring({ ...newRecurring, categoryId: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {fixedAiCategoryHint && <div className="ai-hint">{fixedAiCategoryHint}</div>}
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
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="field-pair">
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 1 190px', minWidth: 170 }}>
                <label>Start date</label>
                <input
                  type="date"
                  value={newRecurring.startDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, startDate: e.target.value })}
                />
              </div>
              {showRecurringMoreDates && (
<div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 1 190px', minWidth: 170 }}>
                <label>End date (optional)</label>
                <input
                  type="date"
                  value={newRecurring.endDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, endDate: e.target.value })}
                />
              </div>
              )}
              </div>
              <div className="field-pair">
              {showRecurringMoreDates && (
<div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 1 170px', minWidth: 150 }}>
                <label>Due date (optional, for reminders)</label>
                <input
                  type="date"
                  value={newRecurring.dueDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, dueDate: e.target.value })}
                />
              </div>
              )}
              {/* Payment Source sits right next to Due date in this same row now
                  (previously it was pushed onto its own separate row below, which
                  made it look disconnected/unaligned from the rest of the form). */}
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 1 170px', minWidth: 150 }}>
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
              </div>
              {CARD_PAYMENT_SOURCES.includes(newRecurring.paymentSource) && (
                <div className="field" style={{ flex: '0 1 190px', minWidth: 150 }}>
                  <label>Bank</label>
                  <SearchableCombobox value={newRecurring.paymentBank} onChange={(v) => setNewRecurring({ ...newRecurring, paymentBank: v })} options={BANKS} placeholder="Search bank..." />
                </div>
              )}
              <div className="field" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowRecurringMoreDates((s) => !s)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: '10px 0', whiteSpace: 'nowrap' }}
                >
                  {showRecurringMoreDates ? 'Hide end/due date' : '+ End or due date'}
                </button>
              </div>
              {/* Note + Attach + Add now live together in ONE flex item, in
                  that order, immediately before Add -- per explicit request
                  that these icons sit right before the Add button on every
                  tab. Keeping all three in a single field (instead of Note/
                  Attach as their own field next to a separate Add field)
                  guarantees they can never separate from each other or from
                  Add when the row wraps on a narrower screen -- the exact
                  "why do these appear in two different places" bug that
                  happened here before (a leftover duplicate copy of this
                  block used to sit further up the row too). */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`icon-btn-outline ${newRecurring.notes ? 'active' : ''}`}
                    title="Add a note"
                    onClick={() => setShowRecurringNotes((s) => !s)}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <StickyNote size={16} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn-outline ${recurringFiles.length > 0 ? 'active' : ''}`}
                    title="Attach documents"
                    onClick={() => recurringFilesInputRef.current?.click()}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    ref={recurringFilesInputRef}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleAttachmentPick(e.target.files, setRecurringFiles)}
                  />
                  {myPrivacyEnabled && (
                  <label className="muted-small" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} title="Only you will be able to see this entry">
                    <input type="checkbox" checked={recurringIsPrivate} onChange={(e) => setRecurringIsPrivate(e.target.checked)} />
                    Private
                  </label>
                )}
                <button className="btn" type="submit" style={{ height: 40, flex: '0 0 auto' }}>Add</button>
                </div>
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
            <PendingAttachmentChips files={recurringFiles} onRemove={(i) => removeAttachmentAt(setRecurringFiles, i)} />
            </form>
          </div>
          {/* Data entry (above) and the list of what's already been entered
              (below) are now two separate frames, same as how "Expenses this
              month" already sits in its own panel below the Add-expense form
              -- makes it visually clear where you type a NEW fixed expense
              versus where you review/edit the ones you've already added. */}
          <div className="panel">
            <div className="panel-heading-row">
              <h2 className="panel-title-themed" style={{ marginBottom: 0 }}>Your fixed expenses</h2>
              <div className="filter-wrap" ref={recurringFilterRef}>
                <button
                  type="button"
                  className={`filter-btn ${recurringFilterActive ? 'active' : ''}`}
                  onClick={() => setRecurringFilterOpen((o) => !o)}
                >
                  <Filter size={13} />
                  Filter
                  {recurringFilterActive && <span className="filter-active-dot" />}
                </button>
                {recurringFilterOpen && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-title">Filter Fixed Expenses</div>
                    <div className="filter-field">
                      <label>Category</label>
                      <select
                        value={recurringFilter.category}
                        onChange={(e) => setRecurringFilter({ ...recurringFilter, category: e.target.value })}
                      >
                        <option value="">All categories</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-field">
                      <label>Payment type</label>
                      <select
                        value={recurringFilter.payment}
                        onChange={(e) =>
                          setRecurringFilter({
                            ...recurringFilter,
                            payment: e.target.value,
                            bank: CARD_PAYMENT_SOURCES.includes(e.target.value) ? recurringFilter.bank : '',
                          })
                        }
                      >
                        <option value="">All payment types</option>
                        {RECURRING_PAYMENT_SOURCES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    {CARD_PAYMENT_SOURCES.includes(recurringFilter.payment) && (
                      <div className="filter-field">
                        <label>Bank</label>
                        <select
                          value={recurringFilter.bank}
                          onChange={(e) => setRecurringFilter({ ...recurringFilter, bank: e.target.value })}
                        >
                          <option value="">All banks</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {recurringFilterActive && (
                      <button
                        type="button"
                        className="filter-clear-btn"
                        onClick={() => setRecurringFilter({ category: '', payment: '', bank: '' })}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {filteredRecurringForMonth.length > 0 && (
              <div className="section-total-badge">
                {filteredRecurringForMonth.length} {filteredRecurringForMonth.length === 1 ? 'entry' : 'entries'} &middot; Total {fmt(filteredRecurringForMonth.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
              </div>
            )}
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
            ) : filteredRecurringForMonth.length === 0 ? (
              <div className="empty">No fixed expenses match the current filter.</div>
            ) : (
              <div className="mobile-txn-list">
                {filteredRecurringForMonth.map((r) => {
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
                          {getRowAttachments('recurring_expenses', r.id).length > 0 && <Paperclip size={11} className="row-attach-hint" />}
                        </span>
                        <span className="mobile-txn-sub">{catName} &middot; {freqLabel}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={r.amount} /></span>
                    </button>
                  );
                })}
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
            {editingRecurringId && (() => {
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
                    {(r.notes || getRowAttachments('recurring_expenses', r.id).length > 0) && (
                      <div className="muted-small" style={{ marginBottom: 10 }}>
                        {r.notes && <div style={{ marginBottom: 4 }}><StickyNote size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{r.notes}</div>}
                        {getRowAttachments('recurring_expenses', r.id).length > 0 && (
                          <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => openAttachmentList('recurring_expenses', r.id, r.name)}>
                            <Paperclip size={12} style={{ marginRight: 4, verticalAlign: -2 }} />View attachments ({getRowAttachments('recurring_expenses', r.id).length})
                          </button>
                        )}
                      </div>
                    )}
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Description</label>
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
            <h2 className="panel-title-themed form-title-mobile-hide">Savings</h2>
            <div className="muted-small" style={{ textAlign: 'left', marginTop: -6, marginBottom: 12 }}>
              How much you want to set aside each month
            </div>
            <form onSubmit={handleAddSaving}>
            {/* Month field removed on purpose -- this entry's month
                already comes from the month-nav selector above (see the
                effect that syncs newSaving.month to currentMonth), so a
                second, editable Month input here was pure duplication. To
                save an entry for a different month, switch the month-nav
                first, same as everywhere else the entry list is filtered. */}
            <div className="row">
              <div className="field-pair">
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: 1.1 }}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency fund"
                  value={newSaving.name}
                  onChange={(e) => setNewSaving({ ...newSaving, name: e.target.value })}
                />
              </div>
              <div className="field" style={isMobile ? { flex: '1 1 0', minWidth: 0 } : { flex: '0 0 auto' }}>
                <label>Amount/M.</label>
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
              </div>
              {/* Note + Attach + Add live together in ONE flex item, in that
                  order, immediately before Add -- per explicit request that
                  these icons sit right before the Add button on every tab. */}
              <div className="field" style={{ flex: '0 0 auto' }}>
                <label style={{ visibility: 'hidden' }}>Add</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`icon-btn-outline ${newSaving.notes ? 'active' : ''}`}
                    title="Add a note"
                    onClick={() => setShowSavingNotes((s) => !s)}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <StickyNote size={16} />
                  </button>
                  <button
                    type="button"
                    className={`icon-btn-outline ${savingFiles.length > 0 ? 'active' : ''}`}
                    title="Attach documents"
                    onClick={() => savingFilesInputRef.current?.click()}
                    style={{ height: 40, width: 40, flex: '0 0 auto' }}
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    ref={savingFilesInputRef}
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleAttachmentPick(e.target.files, setSavingFiles)}
                  />
                  {myPrivacyEnabled && (
                  <label className="muted-small" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }} title="Only you will be able to see this entry">
                    <input type="checkbox" checked={savingIsPrivate} onChange={(e) => setSavingIsPrivate(e.target.checked)} />
                    Private
                  </label>
                )}
                <button className="btn" type="submit" style={{ height: 40, flex: '0 0 auto' }}>Add</button>
                </div>
              </div>
            </div>
            {showSavingNotes && (
              <div className="field" style={{ marginTop: 8 }}>
                <label>Note (optional, long description)</label>
                <textarea
                  rows={2}
                  placeholder="Any extra detail about this savings goal..."
                  value={newSaving.notes}
                  onChange={(e) => setNewSaving({ ...newSaving, notes: e.target.value })}
                />
              </div>
            )}
            <PendingAttachmentChips files={savingFiles} onRemove={(i) => removeAttachmentAt(setSavingFiles, i)} />
            </form>
            <div className="panel-heading-row" style={{ justifyContent: 'flex-end', marginTop: 8, marginBottom: 0 }}>
              <div className="filter-wrap" ref={savingsFilterRef}>
                <button
                  type="button"
                  className={`filter-btn ${savingsFilterActive ? 'active' : ''}`}
                  onClick={() => setSavingsFilterOpen((o) => !o)}
                >
                  <Filter size={13} />
                  Filter
                  {savingsFilterActive && <span className="filter-active-dot" />}
                </button>
                {savingsFilterOpen && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-title">Filter Savings</div>
                    <div className="filter-field">
                      <label>Name</label>
                      <select
                        value={savingsFilter.name}
                        onChange={(e) => setSavingsFilter({ ...savingsFilter, name: e.target.value })}
                      >
                        <option value="">All names</option>
                        {savingsNameOptions.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    {savingsFilterActive && (
                      <button
                        type="button"
                        className="filter-clear-btn"
                        onClick={() => setSavingsFilter({ name: '' })}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {filteredSavingsForMonth.length > 0 && (
              <div className="section-total-badge">
                {filteredSavingsForMonth.length} {filteredSavingsForMonth.length === 1 ? 'entry' : 'entries'} &middot; Total {fmt(filteredSavingsForMonth.reduce((s, sv) => s + (Number(sv.amount) || 0), 0))}
              </div>
            )}

            {savingsForMonth.length === 0 ? (
              <div className="empty">No savings added for {monthLabel(currentMonth)} yet.</div>
            ) : filteredSavingsForMonth.length === 0 ? (
              <div className="empty">No savings match the current filter.</div>
            ) : (
              <div className="mobile-txn-list">
                {filteredSavingsForMonth.map((s) => {
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
                        <span className="mobile-txn-title">
                          {title}
                          {s.notes && <StickyNote size={11} className="row-attach-hint" />}
                          {getRowAttachments('savings_goals', s.id).length > 0 && <Paperclip size={11} className="row-attach-hint" />}
                        </span>
                        <span className="mobile-txn-sub">{monthLabel(currentMonth)}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={s.amount} /></span>
                    </button>
                  );
                })}
              </div>
            )}
            {savingsForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                <Amt value={savingsTotal} /> in planned savings for {monthLabel(currentMonth)}.
              </div>
            )}

            {/* Mobile edit sheet for a tapped savings row -- same fields/handlers as desktop's inline row. */}
            {editingSavingId && (() => {
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
                    {(s.notes || getRowAttachments('savings_goals', s.id).length > 0) && (
                      <div className="muted-small" style={{ marginBottom: 10 }}>
                        {s.notes && <div style={{ marginBottom: 4 }}><StickyNote size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{s.notes}</div>}
                        {getRowAttachments('savings_goals', s.id).length > 0 && (
                          <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => openAttachmentList('savings_goals', s.id, s.name)}>
                            <Paperclip size={12} style={{ marginRight: 4, verticalAlign: -2 }} />View attachments ({getRowAttachments('savings_goals', s.id).length})
                          </button>
                        )}
                      </div>
                    )}
                    <div className="field" style={{ marginBottom: 10 }}>
                      <label>Description</label>
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
          <div className="muted-small" style={{ marginTop: 14 }}>
            Savings is entered per month on purpose -- it won't automatically carry over, exactly like Income. The list below only shows entries for {monthLabel(currentMonth)}; add a new row for each new month. Since it's money leaving your income, it's included in "Spent so far" and "Combined expenses" above and reduces "Remaining"/"Net" -- it also gets its own report page.
          </div>
          </div>
          )}

          {/* Now shown only while the Regular Expenses tab itself is active --
            per explicit request, each tab (Income/Fixed/Regular/Savings)
            should show only its own list instead of this one staying
            visible underneath every other tab, which read as cluttered
            and confusing once the tabs looked mutually exclusive. */}
          {inputTab === 'expense' && (
                    <div className="panel">
            {/* Renamed from the generic "Expenses this month" -- the month
                shown here always follows currentMonth (the same </> month-
                nav state driving the whole dashboard), so it stays correct
                automatically as you switch months, no separate picker
                needed. */}
            <div className="panel-heading-row">
              <h2 className="panel-title-themed">Regular Expenses for {monthLabel(currentMonth)}</h2>
              <div className="filter-wrap" ref={expenseFilterRef}>
                {expenses.some((x) => (x.payment_source === 'Credit Card' || x.payment_source === 'Debit Card') && !x.payment_bank) && (
                  <button type="button" className="filter-btn" onClick={handleAutofillBanks} title="Fill in the bank for card expenses that are missing one">
                    Fix missing banks
                  </button>
                )}
                <button
                  type="button"
                  className={`filter-btn ${expenseFilterActive ? 'active' : ''}`}
                  onClick={() => setExpenseFilterOpen((o) => !o)}
                >
                  <Filter size={13} />
                  Filter
                  {expenseFilterActive && <span className="filter-active-dot" />}
                </button>
                {expenseFilterOpen && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-title">Filter Regular Expenses</div>
                    <div className="filter-field">
                      <label>Category</label>
                      <select
                        value={expenseFilter.category}
                        onChange={(e) => setExpenseFilter({ ...expenseFilter, category: e.target.value })}
                      >
                        <option value="">All categories</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="filter-field">
                      <label>Payment type</label>
                      <select
                        value={expenseFilter.payment}
                        onChange={(e) =>
                          setExpenseFilter({
                            ...expenseFilter,
                            payment: e.target.value,
                            bank: CARD_PAYMENT_SOURCES.includes(e.target.value) ? expenseFilter.bank : '',
                          })
                        }
                      >
                        <option value="">All payment types</option>
                        {PAYMENT_SOURCES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    {CARD_PAYMENT_SOURCES.includes(expenseFilter.payment) && (
                      <div className="filter-field">
                        <label>Bank</label>
                        <select
                          value={expenseFilter.bank}
                          onChange={(e) => setExpenseFilter({ ...expenseFilter, bank: e.target.value })}
                        >
                          <option value="">All banks</option>
                          {BANKS.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {expenseFilterActive && (
                      <button
                        type="button"
                        className="filter-clear-btn"
                        onClick={() => setExpenseFilter({ category: '', payment: '', bank: '' })}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {filteredMonthExpenses.length > 0 && (
              <div className="section-total-badge">
                {filteredMonthExpenses.length} {filteredMonthExpenses.length === 1 ? 'entry' : 'entries'} &middot; Total {fmt(filteredMonthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))}
              </div>
            )}
            {monthExpenses.length === 0 ? (
              <div className="empty">No one-off expenses logged for this month yet.</div>
            ) : filteredMonthExpenses.length === 0 ? (
              <div className="empty">No expenses match the current filter.</div>
            ) : (
              // Mobile gets a clean, read-at-a-glance transaction list --
              // colored category icon, description, category + date, and a
              // right-aligned amount -- instead of four always-open input
              // fields per row, which read more like a spreadsheet than an
              // app. Tapping a row opens the same kind of bottom sheet as
              // "Add", pre-filled for editing, reusing the exact same
              // commitExpenseField/handleDeleteExpense logic desktop uses.
              <div className="mobile-txn-list">
                {filteredMonthExpenses.map((e) => {
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
                          {getRowAttachments('expenses', e.id).length > 0 && <Paperclip size={11} className="row-attach-hint" />}
                        </span>
                        <span className="mobile-txn-sub">{catName} &middot; {fmtDate(e.expense_date)}</span>
                      </span>
                      <span className="mobile-txn-amount"><Amt value={e.amount} /></span>
                    </button>
                  );
                })}
              </div>
            )}
            {monthExpenses.length > 0 && (
              <div className="muted-small" style={{ marginTop: 8 }}>
                Changes save automatically. <Amt value={oneOffTotal} /> in regular (one-off) expenses counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>
          )}

          {/* Mobile edit sheet for a tapped transaction -- same fields, same
              auto-save-on-blur handlers as desktop's inline row, just
              presented as a focused sheet instead of four permanently open
              inputs. */}
          {editingExpenseId && (() => {
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
                  {(e.notes || getRowAttachments('expenses', e.id).length > 0) && (
                    <div className="muted-small" style={{ marginBottom: 10 }}>
                      {e.notes && <div style={{ marginBottom: 4 }}><StickyNote size={12} style={{ marginRight: 4, verticalAlign: -2 }} />{e.notes}</div>}
                      {getRowAttachments('expenses', e.id).length > 0 && (
                        <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => openAttachmentList('expenses', e.id, expenseDrafts[e.id]?.description || 'Expense')}>
                          <Paperclip size={12} style={{ marginRight: 4, verticalAlign: -2 }} />View attachments ({getRowAttachments('expenses', e.id).length})
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
                      onChange={(ev) => { const src = ev.target.value; const curBank = expenseDrafts[e.id]?.paymentBank; commitExpenseField(e.id, 'paymentSource', src, src !== 'Cash' && !curBank ? { paymentBank: getDefaultBankFor(src) } : {}); }}
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
</>
)}
        </div>
                <div style={(activePanel === 'report' || activePanel === 'help' || activePanel === 'settings' || activePanel === 'roadmap') ? { gridColumn: '1 / -1' } : undefined}>
          {/* This narrow chart/AI column only shows for the normal
              data-entry tabs now (inputTab truthy) -- Home has its own
              full-width, bigger version of the same three cards further
              down the page (see the !inputTab section right after this
              content-grid closes), so the two don't show at once. Report/
              Settings/Help panels below still render regardless of
              inputTab, since those can be open at the same time as Home.
              Mobile-only: this column is dropped entirely on the data-entry
              tabs so the form to its left gets the full screen width/height
              for entering data -- the chart/AI/Coach cards are only useful
              once there's data to look at, and are still one tap away via
              the Dashboard tab. Desktop is unaffected. */}
          {inputTab && !isMobile && activePanel !== 'investments' && (
            <>
              {chartTypeToggle}
              {renderChartCard(false)}
              {aiInsightsCard}
              {budgetCoachCard}
            </>
          )}

          {activePanel === 'investments' && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ marginTop: 0 }}>Investment Overview</h3>
              {investments.length === 0 ? (
                <div className="muted-small">Add a Fixed Deposit or Mutual Fund to see your chart here.</div>
              ) : (
                <>
                  <div className="input-tabs" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                    <button className={`btn small ${investChartType === 'pie' ? '' : 'secondary'}`} onClick={() => setInvestChartType('pie')}>Pie</button>
                    <button className={`btn small ${investChartType === 'bar-v' ? '' : 'secondary'}`} onClick={() => setInvestChartType('bar-v')}>Bar (V)</button>
                    <button className={`btn small ${investChartType === 'bar-h' ? '' : 'secondary'}`} onClick={() => setInvestChartType('bar-h')}>Bar (H)</button>
                    <button className={`btn small ${investChartType === 'pareto' ? '' : 'secondary'}`} onClick={() => setInvestChartType('pareto')}>Pareto</button>
                  </div>
                  {(() => {
                    const chartData = investments.map((x) => ({
                      name: (x.name || '').length > 12 ? (x.name || '').slice(0, 12) + '&' : (x.name || ''),
                      Invested: investToBase(Number(x.principal_amount || 0), x.currency),
                      Current: investToBase(investAccruedValue(x), x.currency),
                    }));
                    if (investChartType === 'pie') {
                      return (
                        <ResponsiveContainer width="100%" height={Math.max(220, investments.length * 30)}>
                          <PieChart>
                            <Pie data={chartData} dataKey="Current" nameKey="name" outerRadius={80} label={(e) => e.name}>
                              {chartData.map((e, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    }
                    if (investChartType === 'pareto') {
                      const sorted = [...chartData].sort((a, b) => b.Current - a.Current);
                      const total = sorted.reduce((s, x) => s + x.Current, 0) || 1;
                      let cum = 0;
                      const paretoData = sorted.map((x) => { cum += x.Current; return { ...x, cumPct: (cum / total) * 100 }; });
                      return (
                        <ResponsiveContainer width="100%" height={Math.max(220, investments.length * 40)}>
                          <ComposedChart data={paretoData} margin={{ top: 8, right: 24, left: 8, bottom: 40 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-40} textAnchor="end" height={60} />
                            <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} />
                            <Tooltip formatter={(v, n) => n === 'Cumulative %' ? `${Number(v).toFixed(1)}%` : fmt(v)} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar yAxisId="left" dataKey="Current" fill="#22c55e" />
                            <Line yAxisId="right" dataKey="cumPct" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Cumulative %" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      );
                    }
                    if (investChartType === 'bar-v') {
                      return (
                        <ResponsiveContainer width="100%" height={Math.max(220, investments.length * 40)}>
                          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 40 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-40} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Tooltip formatter={(v) => fmt(v)} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="Invested" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Current" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      );
                    }
                    return (
                      <ResponsiveContainer width="100%" height={Math.max(220, investments.length * 46)}>
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                        >
                          <XAxis type="number" tick={{ fontSize: 9 }} hide />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                          <Tooltip formatter={(v) => fmt(v)} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="Invested" fill="#8884d8" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="Current" fill="#22c55e" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()}
                  <div className="muted-small" style={{ marginTop: 12, lineHeight: 1.6 }}>
                    Fixed Deposits: <Amt value={investments.filter((x) => x.investment_type === 'Fixed Deposit').reduce((s, x) => s + investToBase(investAccruedValue(x), x.currency), 0)} /> across {investments.filter((x) => x.investment_type === 'Fixed Deposit').length}
                    <br />
                    Mutual Funds: <Amt value={investments.filter((x) => x.investment_type === 'Mutual Fund').reduce((s, x) => s + investToBase(investAccruedValue(x), x.currency), 0)} /> across {investments.filter((x) => x.investment_type === 'Mutual Fund').length}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Only the standalone header-button route renders here now --
              the Settings > Users sub-tab renders this same usersPanelBody
              value in place, inside the Settings panel itself, instead of
              in this separate box (which used to make it appear above the
              Settings panel rather than replacing its content like every
              other sub-tab does). */}
          {activePanel === 'members' && (
          <div className="panel" ref={panelRef}>
            {usersPanelBody}
          </div>
          )}

          {activePanel === 'help' && (() => {
            // Accordion content: bold title + description, one entry per
            // topic. Clicking a title opens just that topic (closing
            // whichever other one was open) instead of the old single wall
            // of always-visible paragraphs -- per explicit request, mirrors
            // how clicking Home/Regular Expenses/etc. in the header itself
            // jumps straight to that one thing.
            // Bump this manually whenever helpTopics' content below changes (not on
            // every app release -- only when Help itself is edited), so the
            // little "Help updated as of vX.XX" marker next to the tour button
            // tells users this text is actually in sync with what they're using.
            const HELP_LAST_UPDATED_VERSION = '2.60';
            const helpTopics = [
{ key: 'updates', title: "What's New", body: <>Latest updates (Jul 31, 2026): Added a private Investments tracker (Fixed Deposits and Mutual Funds/SIPs) with its own tab, currency + live FX conversion, auto-calculated gain/loss, and a pencil icon to edit any entry. The Report now includes a Payment-Source-wise spend breakdown on screen and in the downloadable/emailed PDF. PDF report category names no longer get cut off -- long names now auto-shrink to fit instead of truncating with "...". Every row across Income, Fixed Expenses, Regular Expenses, and Savings now has a pencil icon (matching Investments) that opens a proper edit sheet instead of relying only on inline editing. The small "Updated" confirmation toast, and the popup for reading a saved note, now always appear centered in the app instead of sometimes drifting toward the browser's own tab bar on mobile.</> },
              { key: 'home', title: 'Dashboard', body: <>Shows just the dashboard (summary cards and totals), nothing else. Below it, a bigger "Explore" section holds the same Spending by category chart (Pie/Bar/Pareto/Treemap), AI Insights, and Budget Coach, sized larger so there's more room to look through them. Clicking Income, Fixed Expenses, Regular Expenses, Savings, Report, Settings, or Help scrolls back up to the top and switches to that tab as usual.</> },
              { key: 'regular', title: 'Regular Expenses', body: <>Log one-off spending (groceries, dining, shopping). Pick the date, category, a short description, and the amount, then Add. It appears under "Expenses this month" and is always editable there -- just type into a field and it saves. The note icon (<StickyNote size={11} style={{ verticalAlign: -2 }} />) next to Amount opens a spot for a longer free-text description, and the paperclip (<Paperclip size={11} style={{ verticalAlign: -2 }} />) lets you attach one photo or PDF (5MB max) -- a receipt, warranty, or anything else worth keeping with that expense. Both are optional. Once saved, a small icon appears next to the entry if it has a note or attachment -- click it to read the note or open the file.</> },
              { key: 'scan', title: 'Scan a receipt', body: <>Below the Regular Expenses form, upload a photo of a receipt (or a screenshot/sheet listing several expenses) and Claude will read it for you. You'll see an editable review list first -- fix anything that looks wrong, untick what you don't want, then add only what you confirm. Nothing is saved automatically.</> },
              { key: 'income', title: 'Income', body: <>Add each income source per month (e.g. Salary). Income does NOT roll over automatically -- since pay can change month to month (deductions, advances, etc.), add a fresh row each month with that month's actual amount, or edit an existing row's Month field forward. Every field auto-saves. It has the same optional note + attachment icons as Regular Expenses.</> },
              { key: 'fixed', title: 'Fixed Expenses', body: <>For recurring bills, loans, EMIs, and rent. Set a Start date, an optional End date, and how often it repeats (Monthly, Alternate month, Quarterly, Half-yearly, Once a year). Every field auto-saves as you edit -- there's no Save button to click. Set a Due date to get an in-app reminder starting 3 days before it's due, and an email reminder if it's set up. It has the same optional note + attachment icons as Regular Expenses -- handy for keeping a loan agreement or lease document attached to the bill itself.</> },
              { key: 'notes', title: 'Notes & Attachments', body: <>The note (<StickyNote size={11} style={{ verticalAlign: -2 }} />) and paperclip (<Paperclip size={11} style={{ verticalAlign: -2 }} />) icons sit right before the Add button on Income, Fixed Expenses, Regular Expenses, and Savings. Once a row has a saved document, its paperclip icon shows up in two places for convenience -- under the Description/Name cell, and again next to that row's delete icon -- either one opens the same viewer, where you can see the document on screen, open it in a compatible app on your device, or share it by email or WhatsApp.</> },
              { key: 'savings', title: 'Savings', body: <>Set how much you'd like to set aside for the month, e.g. "Emergency fund" or "Investment". Works exactly like Income: entered fresh per month with no auto-rollover, since the amount you're able to save can change month to month -- add a new row each month, or edit an existing row's Month field forward. Since money you set aside is no longer available to spend, it's treated the same as an expense: it's counted in "Spent so far" and "Combined expenses", and subtracted in "Remaining" and "Net", in addition to getting its own page in the PDF report so you can see planned savings build up over time. It has the same optional note + attachment icons as Regular Expenses.</> },
              { key: 'investments', title: 'Investments', body: <>A private tracker for Fixed Deposits and Mutual Funds/SIPs, separate from your household's Income/Expenses/Savings numbers -- it doesn't affect Spent so far, Remaining, or Net. Add the type, name, bank, currency, principal, and (for FDs) an interest rate and maturity date; current value and gain/loss are calculated automatically, and status moves to Matured/Closed on its own once the maturity date passes. Click the pencil icon on any row to edit it, or the trash icon to remove it. Charts on the right show Pie, Bar, and Pareto views of invested vs. current value.</> },
              { key: 'regmonth', title: 'Regular Expenses for [month]', body: <>Labelled with whichever month you're viewing, this is visible below whichever tab (Income, Fixed Expenses, Regular Expenses, Savings) you're on, so you can see what's been logged without switching tabs. It also auto-saves. It's hidden on Dashboard, which shows only the summary and the Explore section instead.</> },
              { key: 'chart', title: 'Spending by category chart', body: <>Toggle between Pie, Bar, Pareto, Treemap, and By Source. The Pie groups smaller categories into "Other" to stay readable; Bar and Treemap show every category individually. The totals cards above show your combined income, combined expenses (split into Regular, Fixed, and Savings), and what's left of your budget and income after all three are accounted for.</> },
              { key: 'insights', title: 'AI Insights', body: <>Tap Generate below the chart for a short AI-written summary of the month you're viewing (spending patterns, whether you're over budget, and a couple of concrete suggestions). It only runs when you tap the button -- never automatically -- and Refresh regenerates it if your numbers have changed.</> },
              { key: 'coach', title: 'Budget Coach', body: <>Unlike AI Insights (one month at a time), Coach looks across your last 6 months for patterns: a category that keeps going over budget, spending trending up or down, or a savings goal that no longer looks realistic. It only ever writes out suggestions -- it never changes your Settings for you.</> },
                        { key: 'chatbot', title: 'Aria', body: <>Aria is Hearth's built-in AI assistant -- a genuinely capable financial companion, not a scripted FAQ bot. It reasons over your household's real numbers, so you can ask it to dig into why a category ran over budget, compare spending across months, spot trends before they become a problem, or get a specific suggestion for hitting a savings goal, and it answers using your actual data rather than generic advice. It's just as happy to explain how any feature works. Find it as the purple chat button below the logo (on phones) or next to the bell (on desktop).</> },
              { key: 'report', title: 'Report', body: <>Generate a PDF for any date range, then view it on screen, download it, or email it. Each topic gets its own page -- Income, Expenses, Fixed Expenses, Savings, Payment Sources (how much moved through each card/bank/cash), Spend Analysis (Pareto chart), and Recommendations -- except the Category Breakdown bar chart and the Summary table, which share one page by default and only split onto two once the chart itself grows long enough to need the room. Every table, and every category/payment-source label on the charts, auto-shrinks its text to fit rather than cutting names off. The last page closes with a data & privacy note.</> },
              { key: 'settings', title: 'Settings', body: <>Has its own sub-tabs. Currency covers your household's chosen currency (renaming the app/household name itself happens right in the header now -- click the title next to the logo, owners only). Smart Budget always follows whichever month you're viewing on the dashboard (change the Month field there to set or review a different month instead) and covers your overall monthly cap for that month, plus an optional "Budget for Per Category" section below it and how this month's spending compares to those caps (you'll get a notification in the bell icon if you go over). Add Category adds, renames, or removes categories. Users (owners only) covers household members and invites -- see below. Admin Console (owners only) covers members and invites. Every field auto-saves as you edit -- there's no Save button to click.</> },
              { key: 'notifications', title: 'Notifications', body: <>The bell icon next to Help (top-right) replaces the old always-on red banners. It shows a count of unread items -- over-total-budget, over a category's budget, or a bill due soon -- and opening it lists them and marks them read.</> },
              { key: 'users', title: 'Users', body: <>See who's active in the household and who's been invited but hasn't joined yet, with full Name/Email/Phone/Location. Owners can invite new members (which also sends them a notification email), fill in or fix anyone's Name/Phone/Location, and edit their own details under "My details" -- handy for accounts created before these fields existed. Reachable from Settings' Users sub-tab. The Admin console (if you have access) is separate and never visible to other household members.</> },
              { key: 'privacy', title: 'Privacy Policy', body: <>Covers what's collected, where it's stored, and how the AI features use your data. Also linked at the very bottom of every page. <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Read the full Privacy Policy</a>.</> },
            ];
            return (
                    <div className="panel" ref={panelRef}>
              {/* "Help" itself now renders as a page-level centered title
                  next to the Dashboard/Report/Settings ones (see the
                  !inputTab block up near the month nav) instead of cramped
                  inside this narrow content-grid column, so it gets the same
                  full-width treatment as every other tab's title. */}
              <div className="muted-small" style={{ textAlign: 'center', marginBottom: 10 }}>How to use this app -- tap any topic below to open its description.</div>
              {/* Replays the same first-run spotlight tour that auto-showed
                  once for this browser -- lets anyone (a returning user who
                  wants a refresher, or someone who skipped it the first
                  time) walk through it again on demand. */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => { setActivePanel(null); startTour(); }}
                >
                  Take the tour again
                </button>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => setShowManual(true)}
                >
                  <BookOpen size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  Read Full Manual
                </button>
              </div>
              <div className="muted-small" style={{ textAlign: 'center', marginBottom: 14 }}>Help updated as of v{HELP_LAST_UPDATED_VERSION}</div>
                                  <div className="help-accordion" style={{ display: 'flex', flexDirection: 'column', gap: '8px 32px' }}>
                {helpTopics.map((t) => {
                  const open = helpOpenTopic === t.key;
                  return (
                                            <div key={t.key} className="help-accordion-item" style={{ flex: '1 1 100%' }}>
                      <button
                        type="button"
                        className="help-accordion-title"
                        onClick={() => setHelpOpenTopic(open ? null : t.key)}
                        aria-expanded={open}
                      >
                        <span>{t.title}</span>
                        <ChevronDown size={16} className={`help-accordion-chevron ${open ? 'open' : ''}`} />
                      </button>
                      {open && (
                        <div className="muted-small help-accordion-body">{t.body}</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="muted-small" style={{ lineHeight: 1.6, marginTop: 16 }}>
                <p>All figures use your household's chosen currency, set in Settings. Your data is confidential and private to your household -- it's never shared with anyone outside it.</p>
                <p>The small <strong>{formatVersionBadge()}</strong> badge in the top-right corner shows which build you're on. The app updates itself automatically -- you'll never need to manually update anything -- but if something looks off, reload the page and check that it matches the latest you were told about.</p>
              </div>
            </div>
            );
          })()}

          {activePanel === 'roadmap' && roadmapPanelBody}

          {activePanel === 'report' && (
 <div className="panel" ref={panelRef} style={{ maxWidth: '100%', marginBottom: 24 }}>
            {/* "Report" itself renders as a page-level centered title (see
                the !inputTab block near the month nav) instead of cramped
                inside this narrow content-grid column. */}
            <div className="row report-daterow" style={{ marginBottom: 12 }}>
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
              <button
                type="button"
                className="report-info-btn"
                aria-label="About this report"
                title="About this report"
                onClick={() => setReportInfoOpen((v) => !v)}
              >
                {'\u24D8'}
              </button>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button className="btn secondary small" onClick={handleGenerateReport}>Generate report</button>
              </div>
            </div>
            <div className={`muted-small report-desc${reportInfoOpen ? ' is-open' : ''}`} style={{ marginBottom: 12 }}>Generate a PDF for a date range, then view it on screen, download it, or email it. Category Breakdown and Summary share a page unless the chart runs long; Income, Expenses, Fixed Expenses, Savings, Spend Analysis, and Recommendations each get their own dedicated page. Tables auto-shrink to try to fit one page before flowing onto a second.<br /><br /><strong>What's New</strong> (Jul 23, 2026): Fixed Expenses now suggests a Category automatically as you type the Description, just like Regular Expenses, and Amount/month now comes before Category to match. The Fixed Expenses and Savings "Name" fields are now called "Description" for consistency. Aria's greeting is personalized and her chat window no longer gets hidden behind the page. Hovering the Aria icon now shows "Aria - Your AI Assistant".</div>

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
        <>
                  <ReportHtmlView data={reportDoc.data} />
                  <div
                    style={{
                      marginTop: 16,
                      display: 'none',
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
                    {isMobile ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
            Your phone's built-in preview can only show the first page. Open the full report to scroll through every page.
          </p>
          <button
            type="button"
                        onClick={() => setMobileReportOpen(true)}
            style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Open Full Report
          </button>
        </div>
      ) : (
        <iframe
          title="Budget report preview"
          src={reportDoc.previewUrl}
          style={{ width: '100%', maxWidth: 800, margin: '0 auto', height: 'min(85vh, 1000px)', border: 'none', display: 'block', background: '#525659' }}
        />
      )}
                  </div>
                </>
                )}
            {isMobile && mobileReportOpen && reportDoc && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#0d9488' }}>
                  <button
                    type="button"
                    onClick={() => setMobileReportOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    {'ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¯ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ¿ÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂÃÂ½'} Back to App
                  </button>
                </div>
                <iframe
                  title="Budget report full view"
                  src={reportDoc.previewUrl}
                  style={{ flex: 1, width: '100%', border: 'none', background: '#525659' }}
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
                {/* "Settings" itself renders as a page-level centered title
                    (see the !inputTab block near the month nav) instead of
                    cramped inside this narrow content-grid column. */}
                <div className="my-details-box" style={{ marginBottom: 18, padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div className="muted-small" style={{ fontWeight: 600, marginBottom: 8 }}>Private entries</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={myPrivacyEnabled}
                      onChange={(e) => togglePrivacyEnabled(e.target.checked)}
                    />
                    Let me mark my own entries as private
                  </label>
                  <div className="muted-small" style={{ marginTop: 4 }}>
                    Off by default. Once on, a "Private" option appears when you add an income, expense, fixed expense, or savings entry -- those entries are visible only to you, not the rest of the household (they're still excluded from what others see, including shared totals).
                  </div>
                </div>

                <div className="row" style={{ gap: 8, marginBottom: 16 }}>
                  <button
                    className={`btn-teal ${settingsSubTab === 'app' ? '' : 'secondary'}`}
                    onClick={() => setSettingsSubTab('app')}
                  >
                    Currency
                  </button>
                  <button
                    className={`btn-teal ${settingsSubTab === 'monthlybudget' ? '' : 'secondary'}`}
                    onClick={() => { setBudgetMonthDraft(monthKey(currentMonth)); setSettingsSubTab('monthlybudget'); }}
                  >
                    Monthly Budget
                  </button>
                  <button
                    className={`btn-teal ${settingsSubTab === 'budgeting' ? '' : 'secondary'}`}
                    onClick={() => { setBudgetMonthDraft(monthKey(currentMonth)); setSettingsSubTab('budgeting'); }}
                  >
                    Category Budgets
                  </button>
                  <button
                    className={`btn-teal ${settingsSubTab === 'category' ? '' : 'secondary'}`}
                    onClick={() => setSettingsSubTab('category')}
                  >
                    Add Category
                  </button>
                  {isOwner && (
                    <button
                      className={`btn-teal ${settingsSubTab === 'users' ? '' : 'secondary'}`}
                      onClick={() => setSettingsSubTab('users')}
                    >
                      Users
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className={`btn-teal ${settingsSubTab === 'admin' ? '' : 'secondary'}`}
                      onClick={() => setSettingsSubTab('admin')}
                    >
                      Admin Console
                    </button>
                  )}
                  <button
                    className={`btn-teal ${settingsSubTab === 'roadmap' ? '' : 'secondary'}`}
                    data-tour="nav-roadmap"
                    onClick={() => setSettingsSubTab('roadmap')}
                  >
                    <Sparkles size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                    Coming Soon
                  </button>
                </div>

                {/* The "Users" sub-tab intentionally does not render its own
                    content here -- it reuses the exact same Users panel that
                    already lives further down this file (see
                    `activePanel === 'members'`), which now also renders
                    whenever this sub-tab is selected, so household member
                    management logic exists in exactly one place. */}
                {settingsSubTab === 'admin' && isAdmin ? (
                  <AdminConsole embedded onClose={() => setSettingsSubTab('app')} />
                ) : settingsSubTab === 'monthlybudget' ? (
                <>
                {/* Smart Budget tab -- Monthly Budget and per-category Budget
                    merged into one tab, per explicit request. Month always
                    follows the dashboard's currently selected month (see the
                    currentMonth-keyed useEffect above), and can be changed
                    here to set/review a different month's figure without it
                    affecting the rest of the dashboard. */}
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="field" style={{ flex: '0 1 170px', minWidth: 150 }}>
                    <label>Month</label>
                    <input
                      type="month"
                      value={budgetMonthDraft}
                      onChange={(e) => setBudgetMonthDraft(e.target.value)}
                    />
                  </div>
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
                        onBlur={(e) => commitMonthlyBudget(budgetMonthDraft, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="muted-small">Changes save automatically as you edit -- there's no Save button to click.</div>
                </>
                ) : settingsSubTab === 'budgeting' ? (
                <>

                {/* Per-category caps + how this month's actual spending
                    compares to them. Optional -- the overall monthly budget
                    above is all that's required. */}
                <div style={{ marginTop: 22 }}>
                  <label className="muted-small" style={{ fontWeight: 700 }}>Budget for Per Category (optional)</label>
                  {categories.map((c) => (
                    <div className="cat-budget-row" key={c.id}>
                      <span className="cat-budget-name">{c.name}</span>
                      <div className="amount-field-wrap tight">
                        <span className="currency-prefix"><CurrencyPrefix /></span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          style={{ '--amt-px': formAmountPx(categoryBudgetDrafts[c.id] ?? '') + 'px' }}
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
                <div className="muted-small" style={{ marginTop: 8 }}>Changes save automatically as you edit -- there's no Save button to click.</div>

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
                          <span className="cat-budget-name">{c.name}</span>
                          <span className={over ? 'muted-small' : 'muted-small'} style={{ color: over ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                            <Amt value={spent} /> / <Amt value={c.monthly_budget} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                </>
                ) : settingsSubTab === 'users' ? (
                  // Renders the exact same usersPanelBody shown by the
                  // standalone header "Users" button -- in place, right
                  // here below the sub-tab row, the same way every other
                  // sub-tab's content appears.
                  usersPanelBody
                ) : settingsSubTab === 'roadmap' ? (
                  roadmapPanelBody
                ) : settingsSubTab === 'category' ? (
                <>
                {/* Add Category tab -- split out on its own, separate from
                    App Settings, per explicit request. Adding, renaming, and
                    removing categories all live here now. */}
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

                <div className="muted-small" style={{ margin: '10px 0 6px' }}>Category names (click to rename)</div>
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
                </>
                ) : (
                <>
                {/* Household name/app-title editing moved to the header
                    itself (click the title next to the logo, owners only) --
                    it no longer has a separate field here, so there's one
                    place to rename it instead of two. */}
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="field">
                    <label>Currency</label>
                    <input
                      key={currencyDraft}
                      list="currency-options"
                      defaultValue={currencyDraft}
                      onFocus={(e) => { e.target.value = ''; }}
                      onBlur={(e) => { if (!e.target.value) e.target.value = currencyDraft; }}
                      onChange={(e) => { const v = e.target.value; if (CURRENCIES.includes(v)) commitCurrency(v); }}
                      placeholder="Search currency..."
                    />
                    <datalist id="currency-options">
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c} - {CURRENCY_REGIONS[c] || ''}</option>
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="muted-small">Changes save automatically as you edit -- there's no Save button to click.</div>
                </>
                )}
              </div>
          </div>
          )}
        </div>
      </div>

      {/* Home-only "explore" section -- a full-width frame that only shows
          when Home is active (inputTab null), sitting right below Frame A
          (the sticky header/month-nav/summary-cards block) and the now-
          hidden content-grid. Reuses the exact same chart toggle/big chart/
          AI Insights/Budget Coach pieces the normal tabs use (extracted
          above as chartTypeToggle/renderChartCard/aiInsightsCard/
          budgetCoachCard), just rendered bigger and full width here so
          there's room to "play around" with the charts and AI features,
          per explicit request. Mobile-only addition: on top of the above,
          require the screen to be true Home (no activePanel at all, so
          Report is excluded too) -- Report/Settings/Help each get to use
          the freed-up screen for their own content on mobile instead of
          this Explore block tagging along underneath. Desktop keeps the
          original behavior (Explore still follows Report there). */}
            {!inputTab && activePanel !== 'settings' && activePanel !== 'help' && activePanel !== 'roadmap' && activePanel !== 'investments' && (!isMobile || !activePanel) && (
        <div className="home-explore-frame">
          <h2 style={{ margin: '0 0 10px' }}>Explore</h2>
          {chartTypeToggle}
          {renderChartCard(true)}
          {aiInsightsCard}
          {budgetCoachCard}
        </div>
      )}

      <div className="app-footer">
        Your data is confidential and private to this household. It is never shared with anyone outside it.{' '}
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="app-footer-link">Privacy Policy</a>
        {' '}&middot;{' '}
        <button type="button" className="app-footer-link app-footer-link-btn" onClick={openSuggestionModal}>
          <Lightbulb size={12} style={{ marginRight: 3, verticalAlign: -2 }} />
          Suggestion
        </button>
      </div>

      {/* Suggestion form -- any signed-in user can send product feedback
          straight to the app owner's inbox from the footer link above.
          Pre-filled from "My details" (name/location) and the signed-in
          email; only the message itself needs to be typed. On success the
          form is replaced with a short thank-you note instead of just
          closing, so the person knows it actually went somewhere. */}
      {suggestionModalOpen && (
        <div className="attachment-viewer-overlay" onClick={() => setSuggestionModalOpen(false)}>
          <div className="attachment-viewer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="attachment-viewer-head">
              <span className="attachment-viewer-title">
                <Lightbulb size={15} style={{ marginRight: 6, verticalAlign: -3 }} />
                Suggestion
              </span>
              <button type="button" className="mobile-sheet-close" onClick={() => setSuggestionModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {suggestionStatus === 'sent' ? (
              <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Thank you for your suggestion.</div>
                <div className="muted-small">We will review the suggestion and implement it if this helps the users across the globe.</div>
                <button type="button" className="btn small secondary" style={{ marginTop: 18 }} onClick={() => setSuggestionModalOpen(false)}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitSuggestion} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label>Name</label>
                  <input
                    type="text"
                    required
                    value={suggestionForm.name}
                    onChange={(e) => setSuggestionForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Email Id</label>
                  <input
                    type="email"
                    value={suggestionForm.email}
                    onChange={(e) => setSuggestionForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input
                    type="text"
                    value={suggestionForm.location}
                    onChange={(e) => setSuggestionForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Your suggestion</label>
                  <textarea
                    required
                    rows={4}
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    value={suggestionForm.message}
                    onChange={(e) => setSuggestionForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="What would make Hearth more useful for you?"
                  />
                </div>
                {suggestionStatus === 'error' && (
                  <div className="muted-small" style={{ color: 'var(--danger, #dc2626)' }}>
                    Couldn't send that just now -- please try again in a moment.
                  </div>
                )}
                <button type="submit" className="btn small" disabled={suggestionStatus === 'sending'}>
                  {suggestionStatus === 'sending' ? 'Sending...' : 'Submit'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {addSheetOpen && (
        <div className="mobile-sheet-backdrop" onClick={() => { setAddSheetOpen(false); window.scrollTo({ top: 0, behavior: 'auto' }); }} />
      )}

      {/* Mobile floating Add button removed per explicit request -- it duplicated
          the bottom-nav "Add" button (both called goToAdd()), and having two
          entry points for the same action on screen at once was confusing.
          The bottom-nav Add button below is now the single entry point. */}
      <nav className="mobile-bottom-nav">
        <button data-tour="nav-home" className={!activePanel && !addSheetOpen ? 'active' : ''} onClick={goToOverview}>
          <Home size={20} strokeWidth={2.2} />
          <span>Dashboard</span>
        </button>
        <button data-tour="nav-add" onClick={() => goToAdd(inputTab || 'expense')}>
          <Plus size={20} strokeWidth={2.2} />
          <span>Add</span>
        </button>
        <button data-tour="nav-help" className={activePanel === 'help' ? 'active' : ''} onClick={() => togglePanel('help')}>
          <HelpCircle size={20} strokeWidth={2.2} />
          <span>Help</span>
        </button>
{/* Aria now lives here on phones instead of the top-bar icon (see
    tab-hide-mobile on chat-fab-btn/chat-fab-badge-title above) --
    same chatOpen state either way, so the chat window itself is
    unchanged, just the thumb-reachable entry point moved down per
    explicit request. Desktop keeps the original top-bar icon. */}
<button data-tour="nav-aria" className={chatOpen ? 'active' : ''} onClick={() => setChatOpen((o) => !o)}>
  <Bot size={20} strokeWidth={2.2} className={chatOpen ? '' : 'aria-icon-motion'} />
  <span>Aria</span>
</button>
        <button data-tour="nav-roadmap" className={activePanel === 'roadmap' ? 'active' : ''} onClick={() => togglePanel('roadmap')}>
          <Sparkles size={20} strokeWidth={2.2} />
          <span>Soon</span>
        </button>
        {/* Users button removed from here too -- reach it via Settings >
            Users now, same as desktop. */}
        <button data-tour="nav-settings" className={activePanel === 'settings' ? 'active' : ''} onClick={() => togglePanel('settings')}>
          <SettingsIcon size={20} strokeWidth={2.2} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Attachment LIST modal -- opened by tapping a row's paperclip icon
          when it now has one or more documents (rows can carry more than one
          attachment, per explicit request). Lists every file for that row in
          the order it was uploaded (rowAttachments is already sorted by
          created_at from loadAll's query); tapping one closes this list and
          opens the existing single-file attachmentViewer modal below for
          that exact file, so View/Open/Email/WhatsApp all keep working
          per-attachment without any duplicated logic. */}
      <EManual open={showManual} onClose={() => setShowManual(false)} />
      {notePopup && (
        <div className="attachment-viewer-overlay" onClick={() => setNotePopup(null)}>
          <div className="attachment-viewer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="attachment-viewer-head">
              <span className="attachment-viewer-title">Note</span>
              <button type="button" className="mobile-sheet-close" onClick={() => setNotePopup(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 16, whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text)', fontSize: 14 }}>
              {notePopup}
            </div>
          </div>
        </div>
      )}
      {attachmentListModal && (() => {
        const list = getRowAttachments(attachmentListModal.table, attachmentListModal.rowId);
        return (
          <div className="attachment-viewer-overlay" onClick={() => setAttachmentListModal(null)}>
            <div className="attachment-viewer-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="attachment-viewer-head">
                <span className="attachment-viewer-title">Attachments -- {attachmentListModal.label}</span>
                <button type="button" className="mobile-sheet-close" onClick={() => setAttachmentListModal(null)} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <div className="attachment-list-body">
                {list.length === 0 ? (
                  <div className="muted-small" style={{ padding: 16, textAlign: 'center' }}>No attachments left on this entry.</div>
                ) : (
                  list.map((a, idx) => (
                    <button
                      key={a.id}
                      type="button"
                      className="attachment-list-item"
                      onClick={() => {
                        setAttachmentListModal(null);
                        openAttachmentViewer(a.storage_path, a.file_name);
                      }}
                    >
                      <span className="attachment-list-item-order">{idx + 1}</span>
                      <Paperclip size={14} style={{ flexShrink: 0, color: 'var(--muted)' }} />
                      <span className="attachment-list-item-name">{a.file_name}</span>
                      <ChevronDown size={14} style={{ flexShrink: 0, transform: 'rotate(-90deg)', color: 'var(--muted)' }} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Attachment viewer -- opened from every row/edit-sheet that has a
          document attached (Regular Expenses, Fixed Expenses, Income,
          Savings, desktop tables and mobile edit sheets alike). Shows the
          document inline where the browser can render it (image or PDF),
          plus buttons to open it in whatever app the device considers the
          right handler for that file type, and to share the document link
          by email or WhatsApp. */}
      {attachmentViewer && (
        <div className="attachment-viewer-overlay" onClick={() => setAttachmentViewer(null)}>
          <div className="attachment-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="attachment-viewer-head">
              <span className="attachment-viewer-title">{attachmentViewer.name}</span>
              <button type="button" className="mobile-sheet-close" onClick={() => setAttachmentViewer(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="attachment-viewer-body">
              {attachmentViewer.loading ? (
                <div className="muted-small" style={{ padding: 24, textAlign: 'center' }}>Loading document...</div>
              ) : isImageAttachment(attachmentViewer.name) ? (
                <img src={attachmentViewer.url} alt={attachmentViewer.name} className="attachment-viewer-img" />
              ) : isPdfAttachment(attachmentViewer.name) ? (
                <iframe src={attachmentViewer.url} title={attachmentViewer.name} className="attachment-viewer-frame" />
              ) : (
                <div className="muted-small" style={{ padding: 24, textAlign: 'center' }}>
                  A preview isn't available for this file type here -- tap Open to view it in a compatible app on your device.
                </div>
              )}
            </div>
            {!attachmentViewer.loading && (
              <div className="attachment-viewer-actions">
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => window.open(attachmentViewer.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  Open
                </button>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => shareAttachment(attachmentViewer.path, attachmentViewer.name, 'email')}
                >
                  <Mail size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  Share via Email
                </button>
                <button
                  type="button"
                  className="btn small secondary"
                  onClick={() => shareAttachment(attachmentViewer.path, attachmentViewer.name, 'whatsapp')}
                >
                  <MessageCircle size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                  Share via WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tourStep !== null && (
        <SpotlightTour
          stepIndex={tourStep}
          onNext={tourNext}
          onPrev={tourPrev}
          onSkip={finishTour}
        />
      )}

    </div>
  );
}
