export const categories = {
  expense: ['食費', '日用品', '交通費', '住居費', '水道・光熱費', '娯楽', '医療・健康', 'その他'],
  income: ['給与', '副収入', 'その他']
};
export function validEntry(entry) {
  if (!entry || !Object.hasOwn(categories,entry.type) || !categories[entry.type]?.includes(entry.category) || (typeof entry.id !== 'string' || !entry.id) || !Number.isSafeInteger(entry.amount) || entry.amount < 1 || entry.amount > 999999999 || typeof entry.memo !== 'string' || entry.memo.length > 100 || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false;
  const date = new Date(entry.date + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === entry.date;
}
export function summarize(entries, month) {
  const records = entries.filter(e => e.date.startsWith(month + '-')).sort((a,b) => b.date.localeCompare(a.date));
  const income = records.filter(e => e.type === 'income').reduce((s,e) => s + e.amount,0);
  const expense = records.filter(e => e.type === 'expense').reduce((s,e) => s + e.amount,0);
  const breakdown = {};
  for (const e of records) if(e.type === 'expense') breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
  return {records, income, expense, balance: income - expense, breakdown};
}
export function validEntries(data) {
  return Array.isArray(data) && data.every(validEntry) && new Set(data.map(e=>e.id)).size === data.length;
}
export function validBudgets(data) {
  return data !== null && typeof data === 'object' && !Array.isArray(data) && Object.entries(data).every(([month,amount]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number.isSafeInteger(amount) && amount > 0 && amount <= 999999999);
}
export function parseBackup(text) {
  const data=JSON.parse(text);
  const entries=Array.isArray(data)?data:data?.entries;
  const budgets=Array.isArray(data)?{}:data?.budgets;
  if(!validEntries(entries) || !validBudgets(budgets)) throw new Error('Invalid backup');
  return {entries,budgets};
}
export function toCSV(entries) {
  const cell=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[['日付','種類','カテゴリー','金額（円）','メモ'],...entries.map(e=>[e.date,e.type==='income'?'収入':'支出',e.category,e.amount,e.memo])].map(row=>row.map(cell).join(',')).join('\r\n');
}
