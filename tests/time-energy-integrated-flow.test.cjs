const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const {createProfileStorage} = require("../dist/scripts/profile-storage.js");
const app = fs.readFileSync(path.resolve(__dirname,"../dist/app.js"),"utf8");
const bonus = app.slice(app.indexOf("function timeBonusAnswerDigits("),app.indexOf("const acquisitionDefinitions"));
const progression = app.slice(app.indexOf("function progressCollectionForCorrect("),app.indexOf("function isFinalInitialQuestion()"));
const MemoryStorage = class { constructor(){this.data=new Map()} getItem(k){return this.data.get(k)??null} setItem(k,v){this.data.set(k,String(v))} removeItem(k){this.data.delete(k)} };

function runScenario({elapsed=2000, wrong=false, interrupted=false}={}) {
  const store = createProfileStorage(new MemoryStorage(),{randomUUID:()=> "child-fixed"});
  store.createProfile("tester");
  const current = {kind:"normal",quotient:12,remainder:0,vehicleIndex:0,timeBonusStartedAt:6000-elapsed,hadWrong:wrong};
  const progress={discovered:true,friendly:true,masterMedal:false,stage:2,energy:5};
  const tx={timeEnergyAmount:0,timeEnergyEventId:"round-unique"};
  const state={phase:"initial",mode:"normal",currentVehicleIndex:0,currentStage:2,current};
  const ctx=vm.createContext({
    state,roundTransaction:tx,performance:{now:()=>6000},
    timeBonusConfig:{enabled:true,amount:1,modes:["normal"],limitMsByAnswerDigits:{1:4000,2:5000,3:10000,4:15000,5:20000}},
    vehicleProgress:()=>progress,scaledEnergyGain:x=>x,
    applyEnergyGain:(p,i,amount)=>{p.energy+=amount;return {reward:null,appliedEnergy:p.energy,required:30}},
    saveCollectionProgress:()=>{},currentStageForVehicle:()=>2,
    commitAcquisition:()=>null
  });
  vm.runInContext(bonus+"\n"+progression,ctx);
  const result=vm.runInContext("progressCollectionForCorrect(state.current)",ctx);
  assert.equal(result.energyGain,wrong?1:3);
  assert.equal(progress.energy,wrong?6:8);
  assert.equal(store.getTimeEnergy().balance,0,"answer does not credit persistent balance");
  if (!interrupted && tx.timeEnergyAmount) {
    store.creditTimeEnergy(tx.timeEnergyAmount,tx.timeEnergyEventId);
    assert.equal(store.creditTimeEnergy(tx.timeEnergyAmount,tx.timeEnergyEventId),false);
  }
  return {store,tx,result};
}
test("qualifying answer: pink +1 accrued, blue basic +3 only; completing credits once",()=>{
  const v=runScenario();
  assert.equal(v.tx.timeEnergyAmount,1);
  assert.equal(v.store.getTimeEnergy().balance,1);
  v.store.beginTimeEnergyAllocation("allocation-one",Date.now()+30000);
  assert.equal(v.store.getTimeEnergy().allocation.amount,1);
});
test("unfinished round: pink time energy is discarded",()=>{
  const v=runScenario({interrupted:true});
  assert.equal(v.tx.timeEnergyAmount,1);
  assert.equal(v.store.getTimeEnergy().balance,0);
});
test("wrong or slow answers never acquire pink time energy",()=>{
  for(const args of [{wrong:true},{elapsed:5500}]){
    const v=runScenario(args);
    assert.equal(v.tx.timeEnergyAmount,0);
    assert.equal(v.store.getTimeEnergy().balance,0);
  }
});
