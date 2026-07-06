import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';

const COLORS = ['#0d9488', '#0ea5e9', '#14b8a6', '#0284c7', '#2dd4bf', '#38bdf8', '#0f766e', '#0369a1', '#5eead4', '#7dd3fc'];
const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];

function fmt(n) {
const v = Number(n) || 0;
return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthKey(d) {
return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(d) {
return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export default function Dashboard({ session, household, onHouseholdChange }) {
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
const [loading, setLoading] = useState(true);
const [showSettings, setShowSettings] = useState(false);
const [members, setMembers] = useState([]);
const [pendingInvites, setPendingInvites] = useState([]);

const [form, setForm] = useState({
date: new Date().toISOString().slice(0, 10),
categoryId: '',
description: '',
amount: '',
});
const [newCategoryName, setNewCategoryName] = useState('');
const [categoryBudgetDrafts, setCategoryBudgetDrafts] = useState({});
const [totalBudgetDraft, setTotalBudgetDraft] = useState('');

const [newRecurring, setNewRecurring] = useState({
name: '',
categoryId: '',
amount: '',
startMonth: monthKey(new Date()),
endMonth: '',
});
const [recurringDrafts, setRecurringDrafts] = useState({});
const [inviteEmail, setInviteEmail] = useState('');
const [inviteRelation, setInviteRelation] = useState('Spouse');
const [inviteStatus, setInviteStatus] = useState('');

const [newIncome, setNewIncome] = useState({
name: '',
memberEmail: session.user.email,
amount: '',
startMonth: monthKey(new Date()),
endMonth: '',
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
setRecurringExpenses(recur || []);
setMembers(mem || []);
setPendingInvites(invites || []);
setIncomes(inc || []);
const iDrafts = {};
(inc || []).forEach((i) => {
iDrafts[i.id] = { amount: String(i.amount), endMonth: i.end_date ? i.end_date.slice(0, 7) : '' };
});
setIncomeDrafts(iDrafts);
setTotalBudget(settings?.total_monthly_budget || 0);
setTotalBudgetDraft(String(settings?.total_monthly_budget || ''));
const drafts = {};
(cats || []).forEach((c) => {
drafts[c.id] = c.monthly_budget ? String(c.monthly_budget) : '';
});
setCategoryBudgetDrafts(drafts);
const rDrafts = {};
(recur || []).forEach((r) => {
rDrafts[r.id] = { amount: String(r.amount), endMonth: r.end_date ? r.end_date.slice(0, 7) : '' };
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
const startsOk = r.start_date.slice(0, 7) <= key;
const endsOk = !r.end_date || r.end_date.slice(0, 7) >= key;
return startsOk && endsOk;
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
return incomes.filter((i) => {
if (!i.active) return false;
const startsOk = i.start_date.slice(0, 7) <= key;
const endsOk = !i.end_date || i.end_date.slice(0, 7) >= key;
return startsOk && endsOk;
});
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

async function handleSaveSettings() {
const total = parseFloat(totalBudgetDraft);
await supabase
.from('settings')
.update({ total_monthly_budget: isNaN(total) ? 0 : total })
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
if (!newRecurring.name.trim() || !newRecurring.categoryId || isNaN(amount) || amount <= 0 || !newRecurring.startMonth) {
alert('Please fill in name, category, amount, and start month.');
return;
}
const { error } = await supabase.from('recurring_expenses').insert({
household_id: householdId,
name: newRecurring.name.trim(),
category_id: newRecurring.categoryId,
amount,
start_date: newRecurring.startMonth + '-01',
end_date: newRecurring.endMonth ? newRecurring.endMonth + '-01' : null,
created_by: session.user.id,
});
if (error) {
alert('Could not save fixed expense: ' + error.message);
return;
}
setNewRecurring((r) => ({ ...r, name: '', amount: '', endMonth: '' }));
loadAll();
}

async function handleSaveRecurring(id) {
const draft = recurringDrafts[id];
const amount = parseFloat(draft.amount);
const { error } = await supabase
.from('recurring_expenses')
.update({
amount: isNaN(amount) ? 0 : amount,
end_date: draft.endMonth ? draft.endMonth + '-01' : null,
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
if (!newIncome.name.trim() || isNaN(amount) || amount <= 0 || !newIncome.startMonth) {
alert('Please fill in a name, amount, and start month.');
return;
}
const { error } = await supabase.from('incomes').insert({
household_id: householdId,
name: newIncome.name.trim(),
member_email: newIncome.memberEmail,
amount,
start_date: newIncome.startMonth + '-01',
end_date: newIncome.endMonth ? newIncome.endMonth + '-01' : null,
created_by: session.user.id,
});
if (error) {
alert('Could not save income: ' + error.message);
return;
}
setNewIncome((i) => ({ ...i, name: '', amount: '', endMonth: '' }));
loadAll();
}

async function handleSaveIncome(id) {
const draft = incomeDrafts[id];
const amount = parseFloat(draft.amount);
const { error } = await supabase
.from('incomes')
.update({
amount: isNaN(amount) ? 0 : amount,
end_date: draft.endMonth ? draft.endMonth + '-01' : null,
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
<button className="btn secondary small" onClick={handleSignOut}>Sign out</button>
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
<div className={`card ${remaining < 0 ? 'over' : remaining >= 0 && totalBudget > 0 ? 'ok' : ''}`}>
<div className="k">Remaining</div><div className="v">{fmt(remaining)}</div>
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
<label>Start month</label>
<input
type="month"
value={newIncome.startMonth}
onChange={(e) => setNewIncome({ ...newIncome, startMonth: e.target.value })}
/>
</div>
<div className="field">
<label>End month (optional)</label>
<input
type="month"
value={newIncome.endMonth}
onChange={(e) => setNewIncome({ ...newIncome, endMonth: e.target.value })}
/>
</div>
<button className="btn" type="submit">Add</button>
</form>

{incomes.length === 0 ? (
<div className="empty">No income sources added yet.</div>
) : (
<table style={{ marginTop: 14 }}>
<thead>
<tr><th>Source</th><th>Member</th><th>Amount</th><th>Start</th><th>End</th><th></th><th></th></tr>
</thead>
<tbody>
{incomes.map((i) => (
<tr key={i.id}>
<td>{i.name}</td>
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
<td className="muted-small">{i.start_date.slice(0, 7)}</td>
<td>
<input
type="month"
style={{ width: 130 }}
value={incomeDrafts[i.id]?.endMonth ?? ''}
onChange={(e) =>
setIncomeDrafts({ ...incomeDrafts, [i.id]: { ...incomeDrafts[i.id], endMonth: e.target.value } })
}
/>
</td>
<td><button className="btn secondary small" onClick={() => handleSaveIncome(i.id)}>Save</button></td>
<td><button className="del" onClick={() => handleDeleteIncome(i.id, i.name)}>x</button></td>
</tr>
))}
</tbody>
</table>
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
<label>Start month</label>
<input
type="month"
value={newRecurring.startMonth}
onChange={(e) => setNewRecurring({ ...newRecurring, startMonth: e.target.value })}
/>
</div>
<div className="field">
<label>End month (optional)</label>
<input
type="month"
value={newRecurring.endMonth}
onChange={(e) => setNewRecurring({ ...newRecurring, endMonth: e.target.value })}
/>
</div>
<button className="btn" type="submit">Add</button>
</form>

{recurringExpenses.length === 0 ? (
<div className="empty">No loans, EMIs, or fixed monthly bills added yet.</div>
) : (
<table style={{ marginTop: 14 }}>
<thead>
<tr><th>Name</th><th>Category</th><th>Amount</th><th>Start</th><th>End</th><th></th><th></th></tr>
</thead>
<tbody>
{recurringExpenses.map((r) => (
<tr key={r.id}>
<td>{r.name}</td>
<td>{categoryNameById[r.category_id] || 'Uncategorized'}</td>
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
<td className="muted-small">{r.start_date.slice(0, 7)}</td>
<td>
<input
type="month"
style={{ width: 130 }}
value={recurringDrafts[r.id]?.endMonth ?? ''}
onChange={(e) =>
setRecurringDrafts({ ...recurringDrafts, [r.id]: { ...recurringDrafts[r.id], endMonth: e.target.value } })
}
/>
</td>
<td><button className="btn secondary small" onClick={() => handleSaveRecurring(r.id)}>Save</button></td>
<td><button className="del" onClick={() => handleDeleteRecurring(r.id, r.name)}>x</button></td>
</tr>
))}
</tbody>
</table>
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
<table>
<thead>
<tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th><th>By</th><th></th></tr>
</thead>
<tbody>
{monthExpenses.map((e) => (
<tr key={e.id}>
<td>{e.expense_date}</td>
<td>{categoryNameById[e.category_id] || 'Uncategorized'}</td>
<td>{e.description}</td>
<td className="amount">{fmt(e.amount)}</td>
<td className="muted-small">{e.created_by_email?.split('@')[0]}</td>
<td><button className="del" onClick={() => handleDeleteExpense(e.id)}>x</button></td>
</tr>
))}
</tbody>
</table>
)}
</div>
</div>

<div>
<div className="panel">
<h2>Spending by category</h2>
{pieData.length === 0 ? (
<div className="empty">Add an expense to see the breakdown.</div>
) : (
<ResponsiveContainer width="100%" height={260}>
<PieChart>
<Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
{pieData.map((_, i) => (
<Cell key={i} fill={COLORS[i % COLORS.length]} />
))}
</Pie>
<Tooltip formatter={(v) => fmt(v)} />
<Legend />
</PieChart>
</ResponsiveContainer>
)}
</div>

<div className="panel">
<h2>Household members</h2>
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
<div className="field" style={{ marginBottom: 12 }}>
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

<div className="cat-list">
{categories.map((c) => (
<div className="cat-chip" key={c.id}>
{c.name}
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
</div>
)}
</div>
</div>
</div>
</div>
);
}
