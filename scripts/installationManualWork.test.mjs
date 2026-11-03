import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../src/utils/installationUnits.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { buildManualUnits } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
test("manual installation requires a named work and preserves directions for the installer", () => {
  const input = {jobId:"one",code:"",obraId:"instalacion:abc",obraNombre:"  Casa de Fulano  ",description:"Instalar box",type:"box",quantity:1,measure:"un",width:0,height:0,length:0,dimensionUnit:"m",criterion:"",teamId:"team-1",teamName:"UU",approvalRequired:false,details:"Calle 123; llevar herrajes"};
  const [unit] = buildManualUnits(input,"admin");
  assert.equal(unit.obraNombre,"Casa de Fulano"); assert.equal(unit.obraId,"instalacion:abc"); assert.equal(unit.details,"Calle 123; llevar herrajes"); assert.equal(unit.value,1); assert.equal(unit.criterion,"Por unidades"); assert.equal(unit.teamId,"team-1");
  assert.throws(() => buildManualUnits({...input,obraNombre:"  "},"admin"), /Obra/);
});
