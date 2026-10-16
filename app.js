import {categories, validEntry, summarize, validEntries, validBudgets, parseBackup, toCSV} from './model.js';
const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY'}).format(value);
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const key = 'kotsukotsu-kakeibo-v2';
let entries = [], budgets = {}, editingId = null;
let storageOK = true;
try {
  const raw = localStorage.getItem(key);
  if(raw !== null) {
    ({entries,budgets}=parseBackup(raw));
  } else {
    const legacy=localStorage.getItem('kotsukotsu-kakeibo-v1') ?? localStorage.getItem('kotsukotsu-windows-v1');
    if(legacy !== null){entries=JSON.parse(legacy);if(!validEntries(entries)) throw new Error('Invalid data');}
  }
} catch {
  storageOK = false;
  $('message').textContent = '保存データを読み込めませんでした。データ保護のため変更を停止しています。バックアップから復元できます。';
}
$('month').value = today.slice(0,7);
$('date').value = today;
function updateCategories() {
  const type = document.querySelector('input[name=type]:checked').value;
  $('category').replaceChildren(...categories[type].map(c => new Option(c,c)));
}
document.querySelectorAll('input[name=type]').forEach(el=>el.addEventListener('change',updateCategories));
updateCategories();
function save(next, nextBudgets=budgets, recovering=false) {
  if(!storageOK && !recovering) return false;
  try {
    localStorage.setItem(key, JSON.stringify({version:2,entries:next,budgets:nextBudgets}));
    entries=next;budgets=nextBudgets;storageOK=true;return true;
  } catch {$('message').textContent='保存できませんでした。ブラウザの保存容量や設定を確認してください。';return false;}
}
function resetForm(){
  editingId=null;$('form-title').textContent='お金を記録する';
  document.querySelector('button[type=submit]').textContent='＋ 記録を追加';
  $('cancel-edit').hidden=true;$('amount').value='';$('memo').value='';
}
function element(tag, className, text) {
  const el=document.createElement(tag);el.className=className;if(text !== undefined) el.textContent=text;return el;
}
const icons = {'食費':'🍚','日用品':'🧺','交通費':'🚃','住居費':'🏠','水道・光熱費':'💡','娯楽':'☕','医療・健康':'🌿','給与':'💼','副収入':'🌱','その他':'📝'};
let pendingDelete;
function render() {
  const {records,income,expense,balance,breakdown}=summarize(entries,$('month').value);
  $('income').textContent=money(income);$('expense').textContent=money(expense);$('balance').textContent=money(balance);$('count').textContent=`${records.length}件`;
  $('breakdown').replaceChildren();
  const groups=Object.entries(breakdown).sort((a,b)=>b[1]-a[1]);
  if(!groups.length) $('breakdown').append(element('p','empty','まだ支出の記録がありません。最初の一件を追加しましょう。'));
  for(const [category,total] of groups){
    const row=element('div','break-row');const label=element('div','break-label');
    label.append(element('span','',`${icons[category]} ${category}`),element('span','',`${money(total)} · ${Math.round(total/expense*100)}%`));
    const bar=element('div','bar');const fill=element('span','');fill.style.width=`${total/expense*100}%`;bar.append(fill);row.append(label,bar);$('breakdown').append(row);
  }
  const query=$('search').value.trim().toLocaleLowerCase('ja');
  const filtered=records.filter(r=>($('filter').value==='all'||r.type===$('filter').value) && (r.category+' '+r.memo).toLocaleLowerCase('ja').includes(query));
  $('filter-count').textContent=`${filtered.length}件を表示 / この月の全${records.length}件`;
  const budget=budgets[$('month').value];
  $('budget').value=budget||'';
  $('budget-status').textContent=budget?`消化率 ${Math.round(expense/budget*100)}%`:'予算未設定';
  $('budget-remaining').textContent=budget?(expense>budget?`予算を${money(expense-budget)}超えています`:`あと${money(budget-expense)}使えます`):'予算を設定すると、残りの金額を確認できます。';
  $('budget-remaining').className=budget&&expense>budget?'over-budget':'';
  $('budget-progress').style.width=budget?`${Math.min(100,expense/budget*100)}%`:'0%';
  $('budget-progress').style.background=budget&&expense>budget?'#bf7060':'';
  $('budget-form').querySelectorAll('button').forEach(b=>b.disabled=!storageOK);
  $('backup').disabled=!storageOK;
  $('history').replaceChildren();
  if(!filtered.length){const empty=element('div','empty');empty.append(element('span','empty-icon','▤'),document.createTextNode(records.length?'条件に一致する記録がありません。':'この月の記録はまだありません。'));$('history').append(empty);}
  for(const record of filtered){
    const row=element('div','record');const text=element('div','record-text');text.append(element('strong','',record.category),element('p','',`${record.date.replaceAll('-','/')} ${record.memo}`));
    const button=element('button','delete','削除');button.type='button';button.disabled=!storageOK;button.setAttribute('aria-label',`${record.date} ${record.category} ${record.amount}円の記録を削除`);
    button.addEventListener('click',()=>{pendingDelete=record.id;$('delete-dialog').showModal();});
    const edit=element('button','edit','編集');edit.type='button';edit.disabled=!storageOK;
    edit.setAttribute('aria-label',`${record.date} ${record.category} ${record.amount}円の記録を編集`);
    edit.addEventListener('click',()=>{
      editingId=record.id;
      document.querySelector(`input[name=type][value=${record.type}]`).checked=true;
      updateCategories();$('category').value=record.category;$('date').value=record.date;
      $('amount').value=record.amount;$('memo').value=record.memo;
      $('form-title').textContent='記録を編集する';
      document.querySelector('button[type=submit]').textContent='変更を保存';
      $('cancel-edit').hidden=false;$('amount').focus();
    });
    const actions=element('div','record-actions');actions.append(edit,button);
    row.append(element('span','record-icon',icons[record.category]),text,element('span',`record-amount ${record.type==='income'?'positive':''}`,`${record.type==='income'?'+':'−'}${money(record.amount)}`),actions);$('history').append(row);
  }
  document.querySelector('button[type=submit]').disabled=!storageOK;
}
$('entry-form').addEventListener('submit',event=>{
  event.preventDefault();
  const record={id:editingId || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),type:document.querySelector('input[name=type]:checked').value,date:$('date').value,amount:Number($('amount').value),category:$('category').value,memo:$('memo').value.trim()};
  if(!validEntry(record)){$('message').textContent='日付と金額を確認してください。金額は1円以上の整数で入力してください。';return;}
  if(!storageOK)return;
  const next=editingId?entries.map(e=>e.id===editingId?record:e):[...entries,record];
  if(save(next)){$('month').value=record.date.slice(0,7);resetForm();$('message').textContent='記録を保存しました。';render();}
});
$('month').addEventListener('change',()=>{if($('month').value)render();});
$('cancel-delete').addEventListener('click',()=>$('delete-dialog').close());
$('confirm-delete').addEventListener('click',()=>{if(save(entries.filter(e=>e.id!==pendingDelete))){if(editingId===pendingDelete)resetForm();render();$('message').textContent='記録を削除しました。';}$('delete-dialog').close();});

$('cancel-edit').addEventListener('click',resetForm);
$('search').addEventListener('input',render);
$('filter').addEventListener('change',render);
$('budget-form').addEventListener('submit',event=>{
  event.preventDefault();
  const next={...budgets,[$('month').value]:Number($('budget').value)};
  if(!validBudgets(next)){$('data-message').textContent='予算は1円以上の整数で設定してください。';return;}
  if(save(entries,next)){$('data-message').textContent='予算を保存しました。';render();}
});
$('clear-budget').addEventListener('click',()=>{
  const next={...budgets};delete next[$('month').value];
  if(save(entries,next)){render();$('data-message').textContent='この月の予算を解除しました。';}
});
function download(content,type,name){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('backup').addEventListener('click',()=>{
  download(JSON.stringify({version:2,entries,budgets},null,2),'application/json',`家計簿バックアップ-${today}.json`);
});
$('csv').addEventListener('click',()=>{
  download(toCSV(summarize(entries,$('month').value).records),'text/csv;charset=utf-8',`家計簿-${$('month').value}.csv`);
});
let pendingRestore=null;
$('restore').addEventListener('click',()=>$('restore-file').click());
$('restore-file').addEventListener('change',async()=>{
  const file=$('restore-file').files[0];if(!file)return;
  try {
    if(file.size>10*1024*1024)throw new Error('Too large');
    pendingRestore=parseBackup(await file.text());
    $('restore-summary').textContent=`記録 ${pendingRestore.entries.length}件、予算 ${Object.keys(pendingRestore.budgets).length}か月分を復元します。`;
    $('restore-dialog').showModal();
  } catch {$('data-message').textContent='有効な家計簿バックアップ（10MB以下）を選んでください。現在の記録は変更していません。';}
  $('restore-file').value='';
});
$('cancel-restore').addEventListener('click',()=>{pendingRestore=null;$('restore-dialog').close();});
$('restore-dialog').addEventListener('cancel',()=>{pendingRestore=null;});
$('confirm-restore').addEventListener('click',()=>{
  if(pendingRestore && save(pendingRestore.entries,pendingRestore.budgets,true)){
    resetForm();render();$('message').textContent='';$('data-message').textContent='バックアップを復元しました。';
  }
  pendingRestore=null;$('restore-dialog').close();
});
window.addEventListener('storage',event=>{
  if(event.key===key || event.key===null){
    storageOK=false;render();$('message').textContent='別の画面で保存データが変更されました。上書きを防ぐため、ページを再読み込みしてください。';
  }
});
render();
