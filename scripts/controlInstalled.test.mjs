import test from 'node:test';
import assert from 'node:assert/strict';
import {getCompletedInstallationUnits, periodBounds} from '../src/utils/installationUnits.ts';
const unit=(id,overrides={})=>({id,required:{s0:true,s1:false,s2:false,s3:false},stages:{s0:true,s1:false,s2:false,s3:false},photoUrl:'foto',completedAt:'2026-11-16T14:00:00Z',completedBy:'a',creditedTeamId:'team',validatedAt:'2026-11-16T15:00:00Z',validatedBy:'admin',status:'validado',measure:'m2',value:1.2345,...overrides});
test('weekly validated installations use completion date and retain exact square meters',()=>{
 const range=periodBounds('semana',new Date('2026-11-16T15:00:00Z'));
 const rows=[unit('ok'),unit('declared',{status:'declarado',validatedAt:'',validatedBy:''}),unit('no-photo',{photoUrl:''}),unit('past',{completedAt:'2026-11-08T14:00:00Z'}),unit('pieces',{measure:'un',value:1}),unit('removed-completed',{installationRemoved:true})];
 const completed=getCompletedInstallationUnits(rows,'validado',range.start,range.end);
 assert.deepEqual(completed.map(x=>x.id),['ok','pieces','removed-completed']);
 assert.equal(completed.filter(x=>x.measure==='m2').reduce((s,x)=>s+x.value,0),2.469);
});
