import { useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import { supabase } from '../supabaseClient';

const COLORS = ['#0d9488', '#0ea5e9', '#14b8a6', '#0284c7', '#2dd4bf', '#38bdf8', '#0f766e', '#0369a1', '#5eead4', '#7dd3fc'];
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
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [expenseDrafts, setExpenseDrafts] = useState({});
  const [myRelationDraft, setMyRelationDraft] = useState('');

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
    const me = (mem || []).find((m) => m.email.toLowerCase() === session.user.email.toLowerCase());
    if (me) setMyRelationDraft(me.relation);
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

  async function handleSaveExpense(id) {
    const draft = expenseDrafts[id];
    const amount = parseFloat(draft.amount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    const { error } = await supabase
      .from('expenses')
      .update({
        expense_date: draft.date,
        category_id: draft.categoryId,
        description: draft.description.trim(),
        amount,
      })
      .eq('id', id);
    if (error) {
      alert('Could not update expense: ' + error.message);
      return;
    }
    loadAll();
  }

  async function handleSaveMyRelation() {
    const me = members.find((m) => m.email.toLowerCase() === session.user.email.toLowerCase());
    if (!me) return;
    await handleUpdateMemberRelation(me.id, myRelationDraft);
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

  async function handleSaveRecurring(id) {
    const draft = recurringDrafts[id];
    const amount = parseFloat(draft.amount);
    if (!draft.name?.trim() || !draft.startDate) {
      alert('Name and start date cannot be empty.');
      return;
    }
    const { error } = await supabase
      .from('recurring_expenses')
      .update({
        name: draft.name.trim(),
        category_id: draft.categoryId,
        amount: isNaN(amount) ? 0 : amount,
        start_date: draft.startDate,
        end_date: draft.endDate || null,
        frequency: draft.frequency || 'monthly',
      })
      .eq('id', id);
    if (error) alert('Could not update: ' + error.message);
    loadAll();
  }

  // Category changes save immediately (no need to hit the row's Save button
  // for this one field, per user feedback that it felt like it "wasn't saving").
  async function handleCategoryChangeRecurring(id, categoryId) {
    setRecurringDrafts((prev) => ({ ...prev, [id]: { ...prev[id], categoryId } }));
    const { error } = await supabase.from('recurring_expenses').update({ category_id: categoryId }).eq('id', id);
    if (error) alert('Could not update category: ' + error.message);
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

  async function handleSaveIncome(id) {
    const draft = incomeDrafts[id];
    const amount = parseFloat(draft.amount);
    if (!draft.name?.trim() || !draft.month) {
      alert('Source name and month cannot be empty.');
      return;
    }
    const { error } = await supabase
      .from('incomes')
      .update({
        name: draft.name.trim(),
        amount: isNaN(amount) ? 0 : amount,
        start_date: draft.month + '-01',
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
        <div className="top-bar-actions">
          {isAdmin && (
            <button className="btn secondary small" onClick={onOpenAdmin}>Admin console</button>
          )}
        </div>
      </div>

      <button className="btn secondary small signout-fixed" onClick={handleSignOut}>Sign out</button>

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
              <div className="v">â</div>
              <div className="muted-small" style={{ marginTop: 4 }}>Set a monthly budget to track this</div>
            </>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card ok"><div className="k">Combined income</div><div className="v">{fmt(totalIncome)}</div></div>
        <div className="card"><div className="k">Combined expenses</div><div className="v">{fmt(total)}</div></div>
        <div className={`card ${netCombined < 0 ? 'over' : 'ok'}`}>
          <div className="k">Net (income - expenses)</div><div className="v">{fmt(netCombined)}</div>
        </div>
      </div>

      <div className="content-grid">
        <div>
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

          <div className="panel">
            <h2>Household income</h2>
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
              Income is entered per month on purpose -- it won't automatically carry over. Add a new row each month (or edit last month's row's Month field forward).
            </div>

            {incomes.length === 0 ? (
              <div className="empty">No income sources added yet.</div>
            ) : (
              <div className="table-scroll">
              <table style={{ marginTop: 14 }}>
                <thead>
                  <tr><th>Source</th><th>Member</th><th>Amount</th><th>Month</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {incomes.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <input
                          type="text"
                          style={{ width: 110 }}
                          value={incomeDrafts[i.id]?.name ?? ''}
                          onChange={(e) =>
                            setIncomeDrafts({ ...incomeDrafts, [i.id]: { ...incomeDrafts[i.id], name: e.target.value } })
                          }
                        />
                      </td>
                      <td className="muted-small">{i.member_email}</td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={{ width: 90 }}
                          value={incomeDrafts[i.id]?.amount ?? ''}
                          onChange={(e) =>
                            setIncomeDrafts({ ...incomeDrafts, [i.id]: { ...incomeDrafts[i.id], amount: e.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="month"
                          style={{ width: 130 }}
                          value={incomeDrafts[i.id]?.month ?? ''}
                          onChange={(e) =>
                            setIncomeDrafts({ ...incomeDrafts, [i.id]: { ...incomeDrafts[i.id], month: e.target.value } })
                          }
                        />
                      </td>
                      <td><button className="btn secondary small" onClick={() => handleSaveIncome(i.id)}>Save</button></td>
                      <td><button className="del" onClick={() => handleDeleteIncome(i.id, i.name)}>x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {incomeForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                {fmt(totalIncome)} in combined income counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Fixed monthly expenses (loans, EMIs, credit cards)</h2>
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
              <table style={{ marginTop: 14 }}>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Amount</th><th>Start</th><th>End</th><th>Repeats</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {recurringExpenses.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="text"
                          style={{ width: 120 }}
                          value={recurringDrafts[r.id]?.name ?? ''}
                          onChange={(e) =>
                            setRecurringDrafts({ ...recurringDrafts, [r.id]: { ...recurringDrafts[r.id], name: e.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={recurringDrafts[r.id]?.categoryId ?? ''}
                          onChange={(e) => handleCategoryChangeRecurring(r.id, e.target.value)}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={{ width: 90 }}
                          value={recurringDrafts[r.id]?.amount ?? ''}
                          onChange={(e) =>
                            setRecurringDrafts({ ...recurringDrafts, [r.id]: { ...recurringDrafts[r.id], amount: e.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          style={{ width: 150 }}
                          value={recurringDrafts[r.id]?.startDate ?? ''}
                          onChange={(e) =>
                            setRecurringDrafts({ ...recurringDrafts, [r.id]: { ...recurringDrafts[r.id], startDate: e.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          style={{ width: 150 }}
                          value={recurringDrafts[r.id]?.endDate ?? ''}
                          onChange={(e) =>
                            setRecurringDrafts({ ...recurringDrafts, [r.id]: { ...recurringDrafts[r.id], endDate: e.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={recurringDrafts[r.id]?.frequency ?? 'monthly'}
                          onChange={(e) =>
                            setRecurringDrafts({ ...recurringDrafts, [r.id]: { ...recurringDrafts[r.id], frequency: e.target.value } })
                          }
                        >
                          {FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td><button className="btn secondary small" onClick={() => handleSaveRecurring(r.id)}>Save</button></td>
                      <td><button className="del" onClick={() => handleDeleteRecurring(r.id, r.name)}>x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            {recurringForMonth.length > 0 && (
              <div className="muted-small" style={{ marginTop: 10 }}>
                {fmt(recurringTotal)} in fixed expenses counted toward {monthLabel(currentMonth)}.
              </div>
            )}
          </div>

          <div className="panel">
            <h2>Expenses this month</h2>
            {monthExpenses.length === 0 ? (
              <div className="empty">No one-off expenses logged for this month yet.</div>
            ) : (
              <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {monthExpenses.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="date"
                          style={{ width: 130 }}
                          value={expenseDrafts[e.id]?.date ?? ''}
                          onChange={(ev) =>
                            setExpenseDrafts({ ...expenseDrafts, [e.id]: { ...expenseDrafts[e.id], date: ev.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={expenseDrafts[e.id]?.categoryId ?? ''}
                          onChange={(ev) =>
                            setExpenseDrafts({ ...expenseDrafts, [e.id]: { ...expenseDrafts[e.id], categoryId: ev.target.value } })
                          }
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          style={{ width: 140 }}
                          value={expenseDrafts[e.id]?.description ?? ''}
                          onChange={(ev) =>
                            setExpenseDrafts({ ...expenseDrafts, [e.id]: { ...expenseDrafts[e.id], description: ev.target.value } })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          style={{ width: 90 }}
                          value={expenseDrafts[e.id]?.amount ?? ''}
                          onChange={(ev) =>
                            setExpenseDrafts({ ...expenseDrafts, [e.id]: { ...expenseDrafts[e.id], amount: ev.target.value } })
                          }
                        />
                      </td>
                      <td className="muted-small">{e.created_by_email?.split('@')[0]}</td>
                      <td><button className="btn secondary small" onClick={() => handleSaveExpense(e.id)}>Save</button></td>
                      <td><button className="del" onClick={() => handleDeleteExpense(e.id)}>x</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              </div>
            </div>
            {pieData.length === 0 ? (
              <div className="empty">Add an expense to see the breakdown.</div>
            ) : chartType === 'pie' ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={85}
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
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(260, pieData.length * 40)}>
                <BarChart data={pieData} layout="vertical" margin={{ top: 5, right: 55, left: 10, bottom: 5 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} hide />
                  <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Bar dataKey="value" barSize={9} radius={[0, 3, 3, 0]}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                    <LabelList dataKey="value" content={DirhamBarLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="panel">
            <h2>Household members</h2>
            <div className="table-scroll">
            <table>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.email}</td>
                    <td className="muted-small">
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
                    <td className="muted-small">{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
              <div className="field" style={{ maxWidth: 200 }}>
                <label>Your relation</label>
                <select value={myRelationDraft} onChange={(e) => setMyRelationDraft(e.target.value)}>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button className="btn secondary small" onClick={handleSaveMyRelation}>Save my details</button>
            </div>

            {isOwner && (
              <>
                <form className="row" style={{ marginTop: 14 }} onSubmit={handleSendInvite}>
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
                {pendingInvites.length > 0 && (
                  <div className="cat-list" style={{ marginTop: 10 }}>
                    {pendingInvites.map((inv) => (
                      <div className="cat-chip" key={inv.id}>
                        {inv.email}
                        <button onClick={() => handleCancelInvite(inv.id)}>x</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel">
            <button className="btn secondary small" onClick={() => setShowSettings((s) => !s)}>
              {showSettings ? 'Hide budget settings' : 'Budget settings'}
            </button>

            {showSettings && (
              <div style={{ marginTop: 14 }}>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
