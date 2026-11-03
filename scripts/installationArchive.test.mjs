import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/utils/installationUnits.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { buildProductionUnits, transitionUnit } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const draft = {obraId:'obra', obraNombre:'Obra', teamId:'a', teamName:'Cuadrilla', approvalRequired:false};
const order = {id:'op1', obraNombre:'Obra', posiciones:[{id:'p',numero:'1',descripcion:'puerta',ancho:1000,alto:2000,cantidadTotal:1}]};
const unit = buildProductionUnits(order,draft,'admin')[0];
const change = (u, archived, actor='admin', admin=true, id='op') => transitionUnit(u,{type:'archive', archived, reason:'Corrección'}, actor, admin, id);
test('retirar y recuperar conservan avance, equipo y auditoría', () => {
 const started = transitionUnit(unit,{type:'stage',key:'s0',value:true},'instalador',false,'stage');
 const removed = change(started,true); assert.equal(removed.installationArchived,true); assert.deepEqual(removed.stages,started.stages); assert.equal(removed.teamId,'a'); assert.equal(removed.history.at(-1).action,'archive');
 const restored = change(removed,false,'admin',true,'op2'); assert.equal(restored.installationArchived,false); assert.deepEqual(restored.stages,started.stages); assert.equal(restored.history.length,started.history.length+2);
});
test('reintentos son idempotentes, incluso con nuevo identificador', () => {
 const removed=change(unit,true); assert.equal(change(removed,true,'admin',true,'retry'),removed); assert.equal(change(removed,true),removed);
});
test('solo el administrador puede retirar y unidades retiradas no aceptan acciones de instalador', () => {
 assert.throws(()=>change(unit,true,'installer',false),/administrador/);
 assert.throws(()=>transitionUnit(change(unit,true),{type:'stage',key:'s0',value:true},'installer',false,'change'),/retirada/);
});
test('los valores históricos sin campo son activos', () => assert.equal(change(unit,false),unit));
test('asignación de obra conserva avances y omite unidades retiradas y terminadas', () => {
 const started = transitionUnit(unit,{type:'stage',key:'s0',value:true},'installer',false,'stage');
 const assign = u => transitionUnit(u,{type:'assign',teamId:'instalador:uu',teamName:'UU',reason:'Asignación de obra',onlyOpen:true},'admin',true,'assign');
 const assigned = assign(started); assert.equal(assigned.teamId,'instalador:uu'); assert.deepEqual(assigned.stages,started.stages); assert.equal(assigned.history.at(-1).action,'assign');
 const archived = change(started,true,'admin',true,'arch'); assert.equal(assign(archived),archived);
 const closed = {...started,status:'validado',creditedTeamId:'original'}; assert.equal(assign(closed),closed);
 assert.equal(assign(assigned),assigned);
 assert.throws(()=>transitionUnit(unit,{type:'assign',teamId:'x',teamName:'X',reason:'x',onlyOpen:true},'worker',false,'x'),/administrador/);
});
test('eliminar pieza conserva historial y no se recupera junto con la orden', () => {
 const remove=(u,removed,scope,id)=>transitionUnit(u,{type:'remove',removed,scope,reason:'Cambio del cliente'},'admin',true,id);
 const started=transitionUnit(unit,{type:'stage',key:'s0',value:true},'installer',false,'stage');
 const piece=remove(started,true,'unit','one'); assert.equal(piece.installationRemoved,true); assert.deepEqual(piece.stages,started.stages);
 assert.equal(remove(piece,true,'order','order'),piece); assert.equal(remove(piece,false,'order','restore-order'),piece);
 const restored=remove(piece,false,'unit','restore-piece'); assert.equal(restored.installationRemoved,false); assert.deepEqual(restored.stages,started.stages);
 const all=remove(unit,true,'order','whole'); assert.equal(remove(all,false,'order','undo').installationRemoved,false);
 assert.throws(()=>transitionUnit(piece,{type:'stage',key:'s0',value:false},'worker',false,'x'),/retirada/);
 const assign=transitionUnit(piece,{type:'assign',teamId:'x',teamName:'X',reason:'obra',onlyOpen:true},'admin',true,'assign'); assert.equal(assign,piece);
 assert.throws(()=>transitionUnit(unit,{type:'remove',removed:true,scope:'unit',reason:'x'},'worker',false,'x'),/administrador/);
});
