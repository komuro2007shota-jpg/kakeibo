import test from 'node:test';
import assert from 'node:assert/strict';
import {validEntry,summarize} from './model.js';
const entry = {id:'one',type:'expense',date:'2026-10-16',amount:1200,category:'食費',memo:'買い物'};
test('validates dates, integer yen and categories',()=>{
 assert.equal(validEntry(entry),true);
 for(const patch of [{date:'2026-02-30'},{amount:0},{amount:1.5},{amount:NaN},{category:'給与'},{type:'unknown'},{memo:'x'.repeat(101)}]) assert.equal(validEntry({...entry,...patch}),false);
});
test('monthly totals exclude other months and group expenses',()=>{
 const data=[entry,{...entry,id:'two',amount:300},{...entry,id:'three',type:'income',category:'給与',amount:10000},{...entry,id:'four',date:'2026-09-30',amount:999}];
 const result=summarize(data,'2026-10');
 assert.equal(result.records.length,3);assert.equal(result.income,10000);assert.equal(result.expense,1500);assert.equal(result.balance,8500);assert.deepEqual(result.breakdown,{'食費':1500});
 assert.equal(summarize(data,'2026-11').balance,0);
});

import {validEntries,validBudgets,parseBackup,toCSV} from './model.js';
test('backup supports legacy entries and validates complete restore before writing',()=>{
 assert.deepEqual(parseBackup(JSON.stringify([entry])),{entries:[entry],budgets:{}});
 const data={entries:[entry],budgets:{'2026-10':50000}};
 assert.deepEqual(parseBackup(JSON.stringify(data)),data);
 assert.throws(()=>parseBackup(JSON.stringify({...data,budgets:{'2026-13':100}})));
 assert.throws(()=>parseBackup(JSON.stringify({...data,entries:[entry,entry]})));
 assert.equal(validEntries([{...entry,type:'toString'}]),false);
 assert.equal(validBudgets({'2026-10':-1}),false);
});
test('CSV preserves Japanese, escapes quotes and blocks spreadsheet formulas',()=>{
 const csv=toCSV([{...entry,memo:'=SUM(1,2)'},{...entry,memo:'パン,"牛乳"\n買い物'}]);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('"\'=SUM(1,2)"'));
 assert.ok(csv.includes('"パン,""牛乳""\n買い物"'));
});
