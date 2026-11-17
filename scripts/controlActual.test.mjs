import test from 'node:test';
import assert from 'node:assert/strict';
import {getCashLines,getForecastLines,getWorkResults,validDay} from '../src/utils/controlActual.ts';
const movement=(id,tipo,metodoPago,monto=100,fecha='2026-11-02')=>({id,obraId:'w',tipo,metodoPago,monto,fecha,concepto:id});
const cheque=(id,tipo,estado,amount,overrides={})=>({id,tipo,estado,monto:amount,numeroCheque:id,obraId:'w',movimientoId:'',fechaCobroCheque:'2026-11-20', ...overrides});
test('cash includes actual transfers and cleared cheques once; uncertain legacy dates remain outside',()=>{
 const movements=[movement('cash','ingreso','Transferencia',100),movement('cheque-m','ingreso','Cheque',200),movement('credit','ingreso','Credito',300),movement('spent','egreso','Efectivo',50)];
 const cheques=[cheque('c1','recibido','cobrado',200,{movimientoId:'cheque-m',fechaRealCobro:'2026-11-10'}),cheque('c2','recibido','cobrado',400),cheque('c3','recibido','recibido',500),cheque('c4','emitido','debitado',25,{fechaRealPago:'2026-11-05'})];
 const result=getCashLines(movements,cheques,'2026-11-16');
 assert.deepEqual(result.lines.map(x=>x.amount),[100,50,200,25]); assert.ok(result.issues.some(x=>x.id==='cheque:c2')); assert.ok(result.issues.some(x=>x.id==='movement:credit'));
});
test('ambiguous duplicate cheques and orphaned links never inflate actual cash',()=>{
 const cheques=[cheque('a','recibido','cobrado',100,{numeroCheque:'1',fechaRealCobro:'2026-11-10'}),cheque('b','recibido','cobrado',100,{numeroCheque:'1',fechaRealCobro:'2026-11-10'}),cheque('c','recibido','cobrado',100,{movimientoId:'missing',fechaRealCobro:'2026-11-10'})];
 const result=getCashLines([],cheques,'2026-11-16'); assert.equal(result.lines.length,0); assert.equal(result.issues.length,3);
});
test('forecast uses dated pending instruments and plans, flags overdue, never uses work balance',()=>{
 const cheques=[cheque('due','recibido','recibido',200),cheque('out','emitido','entregado',90,{fechaCobroCheque:'2026-12-16'}),cheque('late','emitido','emitido',30,{fechaCobroCheque:'2026-11-15'}),cheque('paid','recibido','cobrado',500)];
 const plans=[{id:'p',direction:'egreso',date:'2026-11-22',amount:60,description:'Alquiler',obraId:'',state:'pendiente'}, {id:'removed',direction:'ingreso',date:'2026-11-22',amount:999,description:'x',obraId:'',state:'retirada'}];
 const result=getForecastLines(cheques,plans,'2026-11-16'); assert.deepEqual(result.lines.map(x=>x.id),['cheque:due','plan:p','cheque:out']); assert.equal(result.end,'2026-12-16'); assert.ok(result.overdue.some(x=>x.id==='cheque:late')); assert.equal(validDay('2026-02-30'),false);
});
test('work result uses registered costs, not default estimates, and marks missing costs',()=>{
 const works=[{id:'w',estado:'Aprobado',montoAprobado:1000,totalContratado:1000,costosEstimados:[{real:900}]},{id:'empty',estado:'Instalacion',montoAprobado:500},{id:'prospect',estado:'Prospecto',montoAprobado:2000}];
 const rows=getWorkResults(works,[movement('cost','compra','Credito',300)]); assert.equal(rows.length,2); assert.equal(rows[0].result,700); assert.equal(rows[0].available,true); assert.equal(rows[1].available,false);
});

test('forecast excludes broken cheque links and exposes later and duplicate manual plans for review',()=>{
 const checks=[cheque('linked','recibido','recibido',200,{movimientoId:'missing'}),cheque('normal','recibido','recibido',300)];
 const plans=[{id:'dup',direction:'ingreso',date:'2026-11-20',amount:300,description:'Cheque duplicado',obraId:'w',state:'pendiente'},{id:'later',direction:'egreso',date:'2027-01-01',amount:40,description:'Alquiler',obraId:'',state:'pendiente'}];
 const result=getForecastLines(checks,plans,'2026-11-16',[]);
 assert.deepEqual(result.lines.map(x=>x.id),['cheque:normal']);
 assert.deepEqual(result.later.map(x=>x.id),['plan:later']);
 assert.ok(result.issues.some(x=>x.id==='cheque:linked')); assert.ok(result.issues.some(x=>x.id==='plan:dup'));
});
