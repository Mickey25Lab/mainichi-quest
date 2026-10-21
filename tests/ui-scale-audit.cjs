const {chromium}=require("playwright");
const fs=require("node:fs"),http=require("node:http"),path=require("node:path");
const root=path.resolve(__dirname,"../dist"),output=path.resolve(__dirname,"../audit-results/ui-scale");
const sizes=[[1400,1050],[1024,768],[768,1024],[1280,720]];
const targets={
"start-screen":["#top-bgm-toggle-button","#top-reload-button","#admin-settings-button","#parent-settings-button","#profile-switch-button","#start-button","#top-collection-button"],
"mode-select-screen":["#mode-select-back",".mode-select-choice",".mode-select-energy"],
"phonics-intro-screen":["#phonics-intro-back","#phonics-intro-start"],
"phonics-youtube-screen":["#phonics-youtube-back","#phonics-youtube-end"],
"play-screen":["#quit-button","#bgm-toggle-button","#assist-button",".progress-badge",".elapsed-time"],
"result-screen":["#again-button","#finish-button","#collection-button"],
"collection-screen":["#collection-exit","#collection-series-prev","#collection-series-next",".category-button",".collection-time"],
"collection-detail-screen":["#detail-back","#detail-prev","#detail-next",".category-button",".collection-time"]
};
(async()=>{
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
let name;try{name=decodeURIComponent(new URL(req.url,"http://localhost").pathname).replace(/^\/+/,"")||"index.html";}catch{res.writeHead(400);res.end();return;}
const file=path.resolve(root,name);
if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".mp3":"audio/mpeg"};
res.setHeader("content-type",types[path.extname(file)]||"application/octet-stream");fs.createReadStream(file).pipe(res);
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try {
browser=await chromium.launch({headless:true});
const audit={method:"Structural DOM measurement; inactive screens temporarily revealed without navigation",screens:[],notes:["Not an interaction test or Safari measurement","Uninitialized/hidden controls are explicitly marked missing or hidden","Lengths are browser CSS pixels, including ancestor transforms"]};
for(const [width,height] of sizes){
const context=await browser.newContext({viewport:{width,height}});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
await page.waitForTimeout(450);
if(await page.locator("#profile-setup-overlay").isVisible()){
await page.locator("#profile-setup-name").fill("UI監査");
await page.locator("#profile-setup-form button[type=submit]").click();
await page.locator("#profile-setup-overlay").waitFor({state:"hidden",timeout:10000});
}
// Exercise the real entry path to initialize collection data and dynamic category controls.
const collectionFlow={status:"not-started"};
try {
  await page.locator("#top-collection-button").click({timeout:10000});
  await page.locator("#collection-screen.active").waitFor({timeout:15000});
  const category=page.locator('.category-button[data-category="vehicle"]');
  if(await category.count()){
    await category.click({timeout:10000});
    await page.waitForTimeout(150);
    collectionFlow.status="vehicle-category-opened";
  } else {
    collectionFlow.status="collection-opened-category-unavailable";
  }
  collectionFlow.prevVisible=await page.locator("#collection-series-prev").isVisible();
  collectionFlow.nextVisible=await page.locator("#collection-series-next").isVisible();
} catch(e) {
  collectionFlow.status="failed";
  collectionFlow.error=String(e.message).slice(0,300);
}
const item={viewport:{width,height},errors,collectionFlow,measurements:{}};
for(const [id,selectors] of Object.entries(targets)){
item.measurements[id]=await page.evaluate(({id,selectors})=>{
const screens=[...document.querySelectorAll(".screen")],was=screens.map(x=>x.classList.contains("active"));
screens.forEach(x=>x.classList.toggle("active",x.id===id));
const target=document.getElementById(id);
const stage=target.querySelector(".play-stage,.phonics-intro-stage,.phonics-youtube-stage,.collection-stage,.collection-detail-stage,.mode-select-stage,.start-layer,.result-stage");
const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
const results={visualViewport:window.visualViewport?{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}:null,stage:stage?{rect:rect(stage),transform:getComputedStyle(stage).transform}:null,controls:{}};
for(const selector of selectors){
const matches=[...target.querySelectorAll(selector)],el=matches[0];
if(!el){results.controls[selector]={status:"missing",count:0};continue;}
const c=getComputedStyle(el),r=rect(el),ancestors=[];let p=el.parentElement;
while(p&&p!==document.body){const t=getComputedStyle(p).transform;if(t!=="none")ancestors.push({element:p.id||p.className.toString(),transform:t});p=p.parentElement;}
results.controls[selector]={status:c.display==="none"||c.visibility==="hidden"||r.width===0||r.height===0?"hidden":"measured",count:matches.length,rect:r,computed:{width:c.width,height:c.height,fontSize:c.fontSize,transform:c.transform,border:c.borderWidth,padding:c.padding},ancestorTransforms:ancestors};
}

// Geometry check only: reveal a dialog without invoking game state transitions.
const dialogs=id==="collection-screen"?["#collection-exit-confirm","#phonics-reward-intro","#phonics-grow-confirm"]:[];
results.dialogs={};
for(const selector of dialogs){
  const el=(id==="play-screen"?document:target).querySelector(selector);
  if(!el){results.dialogs[selector]={status:"missing"};continue;}
  const previouslyHidden=el.hidden;
  el.hidden=false;
  const d=rect(el),st=stage?rect(stage):null,card=el.querySelector(".answer-confirm-card");
  const delta=st?{left:Math.abs(d.x-st.x),top:Math.abs(d.y-st.y),width:Math.abs(d.width-st.width),height:Math.abs(d.height-st.height)}:null;
  const cardRect=card?rect(card):null;
  results.dialogs[selector]={status:"measured",rect:d,delta,cardRect,
    cardFits:!!(cardRect&&st&&cardRect.x>=st.x-0.5&&cardRect.y>=st.y-0.5&&cardRect.x+cardRect.width<=st.x+st.width+0.5&&cardRect.y+cardRect.height<=st.y+st.height+0.5)};
  el.hidden=previouslyHidden;
}
screens.forEach((x,i)=>x.classList.toggle("active",was[i]));
return results;
},{id,selectors});
}
audit.screens.push(item);
await context.close();
}
const pairs=[["BGM","start-screen","#top-bgm-toggle-button","play-screen","#bgm-toggle-button"],["Quit","phonics-intro-screen","#phonics-intro-back","play-screen","#quit-button"],["Quit","phonics-youtube-screen","#phonics-youtube-back","play-screen","#quit-button"]];
audit.comparisons=[];
for(const x of audit.screens)for(const [type,a,sa,b,sb] of pairs){
const l=x.measurements[a].controls[sa],r=x.measurements[b].controls[sb],ok=l.status==="measured"&&r.status==="measured";
audit.comparisons.push({viewport:x.viewport,type,status:ok?"measured":"unmeasured",widthDelta:ok?+(l.rect.width-r.rect.width).toFixed(3):null,heightDelta:ok?+(l.rect.height-r.rect.height).toFixed(3):null});
}

// Fail the UI geometry audit on mismatched game-owned modal bounds.
for(const x of audit.screens)for(const [screenName,m] of Object.entries(x.measurements))
for(const [selector,d] of Object.entries(m.dialogs||{})){
  if(d.status!=="measured"||!d.delta||!d.cardFits||Object.values(d.delta).some(v=>v>0.5))
    throw Error("Dialog geometry mismatch at "+x.viewport.width+"x"+x.viewport.height+" "+screenName+" "+selector+": "+JSON.stringify(d));
}
fs.writeFileSync(path.join(output,"geometry.json"),JSON.stringify(audit,null,2)+"\n");
let report="# Multi-viewport UI geometry audit\n\n"+"Synthetic inactive-screen activation; not interaction or Safari validation.\n\n| Viewport | Component | Width delta | Height delta | Status |\n|---|---|---:|---:|---|\n";
for(const x of audit.comparisons)report+="| "+x.viewport.width+"x"+x.viewport.height+" | "+x.type+" | "+(x.widthDelta??"N/A")+" | "+(x.heightDelta??"N/A")+" | "+x.status+" |\n";
report+="\n## Unmeasured controls\n";
for(const x of audit.screens){report+="\n### "+x.viewport.width+"x"+x.viewport.height+"\n";
const unavailable=Object.entries(x.measurements).flatMap(([name,m])=>Object.entries(m.controls).filter(([,v])=>v.status!=="measured").map(([selector,v])=>"- "+name+" "+selector+": "+v.status));
report+=unavailable.length?unavailable.join("\n")+"\n":"All listed controls measured.\n";
}
report+="\n## Dynamic collection flow\n";
for(const x of audit.screens) report+="- "+x.viewport.width+"x"+x.viewport.height+": "+x.collectionFlow.status+", previous visible="+x.collectionFlow.prevVisible+", next visible="+x.collectionFlow.nextVisible+(x.collectionFlow.error?", error="+x.collectionFlow.error:"")+"\n";
report+="\n## Limitations\n"+audit.notes.map(x=>"- "+x).join("\n")+"\n";
fs.writeFileSync(path.join(output,"summary.md"),report);
console.log(report);
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
