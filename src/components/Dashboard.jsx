import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  ComposedChart, Line,
} from 'recharts';
import { supabase } from '../supabaseClient';
import AdminConsole from './AdminConsole.jsx';

const COLORS = [
  '#f97316', '#0ea5e9', '#a855f7', '#22c55e', '#ef4444',
  '#eab308', '#14b8a6', '#ec4899', '#6366f1', '#84cc16',
  '#06b6d4', '#f43f5e',
];
const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];
const CURRENCIES = ['AED', 'USD', 'GBP', 'EUR', 'INR', 'SAR', 'PKR'];

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'alternate', label: 'Alternate month' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Once a year' },
];
const FREQUENCY_MONTHS = { monthly: 1, alternate: 2, quarterly: 3, half_yearly: 6, yearly: 12 };

// Difference, in whole months, between two "YYYY-MM" keys (to >= from assumed
// for the recurring-expense-occurs-this-month check below).
function monthDiff(fromKey, toKey) {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
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

// Module-level so the standalone fmt() helper (used all over the JSX below)
// can stay a simple function instead of threading a currency prop through
// every call site. Updated at the top of each Dashboard render from the
// household's saved currency setting.
let CURRENT_CURRENCY = 'AED';

function fmt(n) {
  const v = Number(n) || 0;
  return CURRENT_CURRENCY + ' ' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [chartType, setChartType] = useState('pie');
  const [loading, setLoading] = useState(true);
  // Exactly one of these panels (Budget settings / Users / Admin console / Help)
  // can be open at a time -- they all render in the same spot below the chart,
  // and opening one auto-scrolls its title into view.
  const [activePanel, setActivePanel] = useState(null);
  const panelRef = useRef(null);
  function togglePanel(name) {
    setActivePanel((cur) => (cur === name ? null : name));
  }
  useEffect(() => {
    if (activePanel && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activePanel]);
  const [inputTab, setInputTab] = useState('expense');
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [expenseDrafts, setExpenseDrafts] = useState({});

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    categoryId: '',
    description: '',
    amount: '',
  });
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
  });
  const [recurringDrafts, setRecurringDrafts] = useState({});
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

  // Keep the "Add income" form's default Month field in sync with whichever
  // month the dashboard is currently showing, so adding income while viewing
  // August defaults to August instead of whatever month the app happened to
  // load on.
  useEffect(() => {
    setNewIncome((i) => ({ ...i, month: monthKey(currentMonth) }));
  }, [currentMonth]);

  async function loadAll() {
    setLoading(true);
    const [{ data: cats }, { data: exps }, { data: settings }, { data: recur }, { data: mem }, { data: invites }, { data: inc }] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', householdId).order('name'),
      supabase.from('expenses').select('*').eq('household_id', householdId).order('expense_date', { ascending: false }),
      supabase.from('settings').select('*').eq('household_id', householdId).maybeSingle(),
      supabase.from('recurring_expenses').select('*').eq('household_id', householdId).order('start_date'),
      supabase.from('household_members').select('*').eq('household_id', householdId).order('joined_at'),
      supabase.from('household_invites').select('*').eq('household_id', householdId).eq('status', 'pending'),
      supabase.from('incomes').select('*').eq('household_id', householdId).order('start_date'),
    ]);
    setCategories(cats || []);
    setExpenses(exps || []);
    const eDrafts = {};
    (exps || []).forEach((e) => {
      eDrafts[e.id] = { date: e.expense_date, categoryId: e.category_id, description: e.description || '', amount: String(e.amount) };
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
      };
    });
    setRecurringDrafts(rDrafts);
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
    loadAll();
    const channel = supabase
      .channel('budget-tracker-changes-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `household_id=eq.${householdId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: `household_id=eq.${householdId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses', filter: `household_id=eq.${householdId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_invites', filter: `household_id=eq.${householdId}` }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes', filter: `household_id=eq.${householdId}` }, loadAll)
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
    return recurringExpenses.filter((r) => {
      if (!r.active) return false;
      const startKey = r.start_date.slice(0, 7);
      const startsOk = startKey <= key;
      const endsOk = !r.end_date || r.end_date.slice(0, 7) >= key;
      if (!startsOk || !endsOk) return false;
      const interval = FREQUENCY_MONTHS[r.frequency] || 1;
      if (interval <= 1) return true;
      // Only lands on months that are a whole number of intervals after the start month
      // (e.g. alternate-month rent counts every 2nd month from its start date).
      return monthDiff(startKey, key) % interval === 0;
    });
  }, [recurringExpenses, currentMonth]);

  const categoryNameById = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [categories]);

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
  const total = oneOffTotal + recurringTotal;
  const remaining = totalBudget - total;

  const incomeForMonth = useMemo(() => {
    const key = monthKey(currentMonth);
    // Income is entered per month on purpose -- no auto-rollover -- so this is
    // an exact month match rather than a start/end range like expenses.
    return incomes.filter((i) => i.active && i.start_date.slice(0, 7) === key);
  }, [incomes, currentMonth]);
  const totalIncome = useMemo(() => incomeForMonth.reduce((s, i) => s + Number(i.amount), 0), [incomeForMonth]);
  const netCombined = totalIncome - total;

  const overCategories = useMemo(() => {
    return categories
      .filter((c) => c.monthly_budget > 0 && (byCategory[c.name] || 0) > c.monthly_budget)
      .map((c) => c.name);
  }, [categories, byCategory]);

  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

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

  async function handleAddExpense(e) {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.categoryId || isNaN(amount) || amount <= 0) {
      alert('Please choose a category and enter a valid amount.');
      return;
    }
    const { error } = await supabase.from('expenses').insert({
      household_id: householdId,
      expense_date: form.date,
      category_id: form.categoryId,
      description: form.description.trim(),
      amount,
      created_by: session.user.id,
      created_by_email: session.user.email,
    });
    if (error) {
      alert('Could not save expense: ' + error.message);
      return;
    }
    const d = new Date(form.date + 'T00:00:00');
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setForm((f) => ({ ...f, description: '', amount: '' }));
    loadAll();
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

  async function handleSaveSettings() {
    const total = parseFloat(totalBudgetDraft);
    await supabase
      .from('settings')
      .update({ total_monthly_budget: isNaN(total) ? 0 : total, currency: currencyDraft })
      .eq('household_id', householdId);
    for (const c of categories) {
      const val = parseFloat(categoryBudgetDrafts[c.id]);
      await supabase
        .from('categories')
        .update({ monthly_budget: isNaN(val) || val <= 0 ? 0 : val })
        .eq('id', c.id);
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
    const { error } = await supabase.from('recurring_expenses').insert({
      household_id: householdId,
      name: newRecurring.name.trim(),
      category_id: newRecurring.categoryId,
      amount,
      start_date: newRecurring.startDate,
      end_date: newRecurring.endDate || null,
      frequency: newRecurring.frequency,
      created_by: session.user.id,
    });
    if (error) {
      alert('Could not save fixed expense: ' + error.message);
      return;
    }
    setNewRecurring((r) => ({ ...r, name: '', amount: '', endDate: '' }));
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

  async function handleSendInvite(e) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
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
    setInviteStatus('sent');
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

  if (loading) return <div className="center-screen">Loading your budget...</div>;

  CURRENT_CURRENCY = currency;

  const warnings = [];
  if (totalBudget > 0 && total > totalBudget) {
    warnings.push(`You're ${fmt(total - totalBudget)} over your total monthly budget.`);
  }
  if (overCategories.length) {
    warnings.push(`Over budget in: ${overCategories.join(', ')}.`);
  }

  return (
    <div className="wrap">
      <div className="top-bar">
        <div>
          <h1>{household.name || 'Household Budget Tracker'}</h1>
          <div className="sub">Signed in as {session.user.email}{isOwner ? ' (owner)' : ''}</div>
        </div>
        <div className="action-row-teal">
          <button className="btn-teal" onClick={() => togglePanel('help')}>
            {activePanel === 'help' ? 'Hide help' : 'Help'}
          </button>
          <button className="btn-teal" onClick={() => togglePanel('settings')}>
            {activePanel === 'settings' ? 'Hide settings' : 'Settings'}
          </button>
          {isAdmin && (
            <button className="btn-teal" onClick={() => togglePanel('admin')}>
              {activePanel === 'admin' ? 'Hide admin console' : 'Admin console'}
            </button>
          )}
          <button className="btn-teal" onClick={() => togglePanel('members')}>
            {activePanel === 'members' ? 'Hide users' : 'Users'}
          </button>
          <button className="btn-teal" onClick={handleSignOut}>Sign out</button>
        </div>
      </div>

      <div className="month-nav">
        <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>&lsaquo;</button>
        <div className="label">{monthLabel(currentMonth)}</div>
        <button onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>&rsaquo;</button>
      </div>

      {warnings.length > 0 && <div className="warning show">{warnings.join(' ')}</div>}

      <div className="grid">
        <div className="card"><div className="k">Monthly Budget</div><div className="v">{fmt(totalBudget)}</div></div>
        <div className={`card ${totalBudget > 0 && total > totalBudget ? 'over' : ''}`}>
          <div className="k">Spent so far</div><div className="v">{fmt(total)}</div>
        </div>
        <div className={`card ${totalBudget > 0 && remaining < 0 ? 'over' : totalBudget > 0 && remaining >= 0 ? 'ok' : ''}`}>
          <div className="k">Remaining</div>
          {totalBudget > 0 ? (
            <div className="v">{fmt(remaining)}</div>
          ) : (
            <>
              <div className="v">—</div>
              <div className="muted-small" style={{ marginTop: 4 }}>Set a monthly budget to track this</div>
            </>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card ok"><div className="k">Combined income</div><div className="v">{fmt(totalIncome)}</div></div>
        <div className="card">
          <div className="k">Combined expenses</div>
          <div className="v">{fmt(total)}</div>
          <div className="muted-small" style={{ marginTop: 4 }}>
            Regular {fmt(oneOffTotal)} + Fixed {fmt(recurringTotal)}
          </div>
        </div>
        <div className={`card ${netCombined < 0 ? 'over' : 'ok'}`}>
          <div className="k">Net (income - expenses)</div><div className="v">{fmt(netCombined)}</div>
        </div>
      </div>

      <div className="content-grid">
        <div>
          <div className="input-tabs">
            <button
              className={`btn small ${inputTab === 'expense' ? '' : 'secondary'}`}
              onClick={() => setInputTab('expense')}
            >
              Add an expense
            </button>
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
          </div>

          {inputTab === 'expense' && (
          <div className="panel">
            <h2>Add an expense</h2>
            <form className="row" onSubmit={handleAddExpense}>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 1.4 }}>
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Groceries at Trader Joe's"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <button className="btn" type="submit">Add</button>
            </form>
          </div>
          )}

          {inputTab === 'income' && (
          <div className="panel">
            <h2>Income</h2>
            <form className="row" onSubmit={handleAddIncome}>
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
              <div className="field">
                <label>Amount / month</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newIncome.amount}
                  onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Month</label>
                <input
                  type="month"
                  value={newIncome.month}
                  onChange={(e) => setNewIncome({ ...newIncome, month: e.target.value })}
                />
              </div>
              <button className="btn" type="submit">Add</button>
            </form>
            <div className="muted-small" style={{ marginTop: 6 }}>
              Income is entered per month on purpose -- it won't automatically carry over. The list below only shows entries for {monthLabel(currentMonth)}; add a new row for each new month.
            </div>

            {incomeForMonth.length === 0 ? (
              <div className="empty">No income added for {monthLabel(currentMonth)} yet.</div>
            ) : (
              <div className="table-scroll">
              <table className="responsive-table" style={{ marginTop: 14, fontSize: 12 }}>
                <colgroup>
                  <col style={{ width: '26%' }} /><col style={{ width: '26%' }} /><col style={{ width: '17%' }} />
                  <col style={{ width: '19%' }} /><col style={{ width: '12%' }} />
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
                          style={{ fontSize: 12 }}
                          value={incomeDrafts[i.id]?.name ?? ''}
                          onChange={(e) => updateIncomeDraftField(i.id, 'name', e.target.value)}
                          onBlur={(e) => commitIncomeField(i.id, 'name', e.target.value)}
                        />
                      </td>
                      <td className="muted-small" data-label="Member">{i.member_email}</td>
                      <td data-label="Amount">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={{ fontSize: 12 }}
                          value={incomeDrafts[i.id]?.amount ?? ''}
                          onChange={(e) => updateIncomeDraftField(i.id, 'amount', e.target.value)}
                          onBlur={(e) => commitIncomeField(i.id, 'amount', e.target.value)}
                        />
                      </td>
                      <td data-label="Month">
                        <input
                          type="month"
                          style={{ fontSize: 11 }}
                          value={incomeDrafts[i.id]?.month ?? ''}
                          onChange={(e) => commitIncomeField(i.id, 'month', e.target.value)}
                        />
                      </td>
                      <td><button className="del" onClick={() => handleDeleteIncome(i.id, i.name)}>x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {incomeForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                Changes save automatically. {fmt(totalIncome)} in combined income counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>
          )}

          {inputTab === 'fixed' && (
          <div className="panel">
            <h2>Fixed Expenses (loans, EMIs, credit cards, rent)</h2>
            <form className="row" onSubmit={handleAddRecurring}>
              <div className="field" style={{ flex: 1.4 }}>
                <label>Name</label>
                <input
                  type="text"
                  placeholder="e.g. Car loan EMI"
                  value={newRecurring.name}
                  onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })}
                />
              </div>
              <div className="field">
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
              <div className="field">
                <label>Amount / month</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newRecurring.amount}
                  onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Start date</label>
                <input
                  type="date"
                  value={newRecurring.startDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, startDate: e.target.value })}
                />
              </div>
              <div className="field">
                <label>End date (optional)</label>
                <input
                  type="date"
                  value={newRecurring.endDate}
                  onChange={(e) => setNewRecurring({ ...newRecurring, endDate: e.target.value })}
                />
              </div>
              <div className="field">
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
              <button className="btn" type="submit">Add</button>
            </form>

            {recurringExpenses.length === 0 ? (
              <div className="empty">No loans, EMIs, or fixed monthly bills added yet.</div>
            ) : (
              <div className="table-scroll">
              <table className="responsive-table" style={{ marginTop: 14, fontSize: 12 }}>
                <colgroup>
                  <col style={{ width: '19%' }} /><col style={{ width: '15%' }} /><col style={{ width: '11%' }} />
                  <col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '17%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Amount</th><th>Start</th><th>End</th><th>Repeats</th><th></th></tr>
                </thead>
                <tbody>
                  {recurringExpenses.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Name">
                        <input
                          type="text"
                          style={{ width: 110, fontSize: 12 }}
                          value={recurringDrafts[r.id]?.name ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'name', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'name', e.target.value)}
                        />
                      </td>
                      <td data-label="Category">
                        <select
                          style={{ fontSize: 12 }}
                          value={recurringDrafts[r.id]?.categoryId ?? ''}
                          onChange={(e) => commitRecurringField(r.id, 'categoryId', e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td data-label="Amount">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={{ width: 80, fontSize: 12 }}
                          value={recurringDrafts[r.id]?.amount ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'amount', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'amount', e.target.value)}
                        />
                      </td>
                      <td data-label="Start">
                        <input
                          type="date"
                          style={{ width: 130, fontSize: 11 }}
                          value={recurringDrafts[r.id]?.startDate ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'startDate', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'startDate', e.target.value)}
                        />
                      </td>
                      <td data-label="End">
                        <input
                          type="date"
                          style={{ width: 130, fontSize: 11 }}
                          value={recurringDrafts[r.id]?.endDate ?? ''}
                          onChange={(e) => updateRecurringDraftField(r.id, 'endDate', e.target.value)}
                          onBlur={(e) => commitRecurringField(r.id, 'endDate', e.target.value)}
                        />
                      </td>
                      <td data-label="Repeats">
                        <select
                          style={{ fontSize: 12 }}
                          value={recurringDrafts[r.id]?.frequency ?? 'monthly'}
                          onChange={(e) => commitRecurringField(r.id, 'frequency', e.target.value)}
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td><button className="del" onClick={() => handleDeleteRecurring(r.id, r.name)}>x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="muted-small" style={{ marginTop: 6 }}>Changes save automatically.</div>
            {recurringForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                {fmt(recurringTotal)} in fixed expenses counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>
          )}

          <div className="panel">
            <h2>Expenses this month</h2>
            {monthExpenses.length === 0 ? (
              <div className="empty">No one-off expenses logged for this month yet.</div>
            ) : (
              <div className="table-scroll">
              <table className="responsive-table" style={{ fontSize: 12 }}>
                <colgroup>
                  <col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '30%' }} />
                  <col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th><th></th></tr>
                </thead>
                <tbody>
                  {monthExpenses.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Date">
                        <input
                          type="date"
                          style={{ width: 120, fontSize: 11 }}
                          value={expenseDrafts[e.id]?.date ?? ''}
                          onChange={(ev) => updateExpenseDraftField(e.id, 'date', ev.target.value)}
                          onBlur={(ev) => commitExpenseField(e.id, 'date', ev.target.value)}
                        />
                      </td>
                      <td data-label="Category">
                        <select
                          style={{ fontSize: 12 }}
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
                          style={{ width: 120, fontSize: 12 }}
                          value={expenseDrafts[e.id]?.description ?? ''}
                          onChange={(ev) => updateExpenseDraftField(e.id, 'description', ev.target.value)}
                          onBlur={(ev) => commitExpenseField(e.id, 'description', ev.target.value)}
                        />
                      </td>
                      <td data-label="Amount">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={{ width: 75, fontSize: 12 }}
                          value={expenseDrafts[e.id]?.amount ?? ''}
                          onChange={(ev) => updateExpenseDraftField(e.id, 'amount', ev.target.value)}
                          onBlur={(ev) => commitExpenseField(e.id, 'amount', ev.target.value)}
                        />
                      </td>
                      <td data-label="By" className="muted-small">{e.created_by_email?.split('@')[0]}</td>
                      <td><button className="del" onClick={() => handleDeleteExpense(e.id)}>x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {monthExpenses.length > 0 && (
              <div className="muted-small" style={{ marginTop: 8 }}>
                Changes save automatically. {fmt(oneOffTotal)} in regular (one-off) expenses counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>Spending by category</h2>
              <div style={{ display: 'flex', gap: 6 }}>
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
              </div>
            </div>
            {pieData.length === 0 ? (
              <div className="empty">Add an expense to see the breakdown.</div>
            ) : chartType === 'pie' ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart margin={{ top: 24, right: 20, bottom: 0, left: 20 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cy="52%"
                    outerRadius={62}
                    isAnimationActive={false}
                    label={{ fontSize: 9, fill: 'var(--text)' }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : chartType === 'bar' ? (
              <ResponsiveContainer width="100%" height={Math.max(260, pieData.length * 40)}>
                <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} hide />
                  <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" barSize={9} radius={[0, 3, 3, 0]} isAnimationActive={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                    <LabelList dataKey="value" content={DirhamBarLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={paretoData} margin={{ top: 20, right: 30, left: 0, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9 }}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={60}
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
                  <Bar yAxisId="left" dataKey="value" barSize={22} isAnimationActive={false}>
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

          {activePanel === 'members' && (
          <div className="panel" ref={panelRef}>
              <div>
                <h2>Users</h2>
                <div className="muted-small" style={{ marginBottom: 4, fontWeight: 600 }}>Active ({members.length})</div>
                <div className="table-scroll">
                <table className="responsive-table users-table">
                  <colgroup>
                    <col style={{ width: '42%' }} /><col style={{ width: '20%' }} />
                    <col style={{ width: '18%' }} /><col style={{ width: '20%' }} />
                  </colgroup>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td data-label="Email">{m.email}</td>
                        <td className="muted-small" data-label="Relation">
                          {isOwner && m.role !== 'owner' ? (
                            <select value={m.relation} onChange={(e) => handleUpdateMemberRelation(m.id, e.target.value)}>
                              {RELATIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            m.relation
                          )}
                        </td>
                        <td className="muted-small" data-label="Role">{m.role}</td>
                        <td data-label="Status"><span className="status-pill active">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {isOwner && (
                  <>
                    <div className="muted-small" style={{ marginTop: 20, marginBottom: 4, fontWeight: 600 }}>
                      Invited, pending activation ({pendingInvites.length})
                    </div>
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
                      They'll also need a Supabase sign-in invite from the project admin before their first login.
                    </div>
                    {inviteStatus === 'sent' && (
                      <div className="muted-small" style={{ marginTop: 6, color: 'var(--ok)' }}>Invite created.</div>
                    )}
                    {pendingInvites.length > 0 ? (
                      <div className="cat-list" style={{ marginTop: 10 }}>
                        {pendingInvites.map((inv) => (
                          <div className="cat-chip" key={inv.id}>
                            {inv.email}
                            <button onClick={() => handleCancelInvite(inv.id)}>x</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="muted-small" style={{ marginTop: 10 }}>No one invited and pending right now.</div>
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
              <p><strong>Add an expense</strong> -- log one-off spending (groceries, dining, shopping). Pick the date, category, a short description, and the amount, then Add. It appears under "Expenses this month" and is always editable there -- just type into a field and it saves.</p>
              <p><strong>Income</strong> -- add each income source per month (e.g. Salary). Income does NOT roll over automatically -- since pay can change month to month (deductions, advances, etc.), add a fresh row each month with that month's actual amount, or edit an existing row's Month field forward. Every field auto-saves.</p>
              <p><strong>Fixed Expenses</strong> -- for recurring bills, loans, EMIs, and rent. Set a Start date, an optional End date, and how often it repeats (Monthly, Alternate month, Quarterly, Half-yearly, Once a year). Every field auto-saves as you edit -- there's no Save button to click.</p>
              <p><strong>Expenses this month</strong> is always visible below the tabs so you can see what's been logged without switching tabs. It also auto-saves.</p>
              <p><strong>Spending by category</strong> chart -- toggle between Pie, Bar, and Pareto. The totals cards above show your combined income, combined expenses (split into Regular vs Fixed), and what's left of your budget.</p>
              <p><strong>Settings</strong> -- set your total monthly budget, currency, add/rename categories, and set optional per-category budget caps (you'll get a warning banner if you go over).</p>
              <p><strong>Users</strong> -- see who's active in the household and who's been invited but hasn't joined yet. Owners can invite new members and change their relation label.</p>
              <p>All figures use your household's chosen currency, set in Settings.</p>
            </div>
          </div>
          )}

          {activePanel === 'admin' && isAdmin && (
          <div className="panel" ref={panelRef}>
            <AdminConsole embedded onClose={() => setActivePanel(null)} />
          </div>
          )}

          {activePanel === 'settings' && (
          <div className="panel" ref={panelRef}>
              <div>
                <h2>Settings</h2>
                <div className="row" style={{ marginBottom: 12 }}>
                  <div className="field">
                    <label>Total monthly budget</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={totalBudgetDraft}
                      onChange={(e) => setTotalBudgetDraft(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Currency</label>
                    <select value={currencyDraft} onChange={(e) => setCurrencyDraft(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

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
                      <button onClick={() => handleRemoveCategory(c.id, c.name)}>x</button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="muted-small">Per-category budgets (optional)</label>
                  {categories.map((c) => (
                    <div className="cat-budget-row" key={c.id}>
                      <span>{c.name}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={categoryBudgetDrafts[c.id] ?? ''}
                        onChange={(e) =>
                          setCategoryBudgetDrafts({ ...categoryBudgetDrafts, [c.id]: e.target.value })
                        }
                      />
                    </div>
                  ))}
                </div>

                <button className="btn secondary" style={{ marginTop: 14 }} onClick={handleSaveSettings}>
                  Save settings
                </button>

                {categories.some((c) => c.monthly_budget > 0) && (
                  <div style={{ marginTop: 18 }}>
                    <label className="muted-small">
                      This month's spending vs. budget (shown here, and categories over budget also trigger the warning banner at the top)
                    </label>
                    {categories.filter((c) => c.monthly_budget > 0).map((c) => {
                      const spent = byCategory[c.name] || 0;
                      const over = spent > c.monthly_budget;
                      return (
                        <div className="cat-budget-row" key={c.id}>
                          <span>{c.name}</span>
                          <span className={over ? 'muted-small' : 'muted-small'} style={{ color: over ? 'var(--danger)' : 'var(--ok)', fontWeight: 600 }}>
                            {fmt(spent)} / {fmt(c.monthly_budget)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
