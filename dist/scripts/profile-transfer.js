/* One-way, explicit, non-destructive transfer between the two PWA origins.
   No network calls. The source site's storage is never modified. */
(() => {
  "use strict";
  const PREFIX = "warizan-robot:";
  const PROFILE_KEY = PREFIX + "profiles-v1";
  const ACTIVE_KEY = PREFIX + "active-profile-id-v1";
  const FORMAT = "maique-profile-transfer-v1";
  const ALLOWED = new Set(["https://mickey25lab.github.io", "https://mainichi-quest-63c.pages.dev"]);
  if (!ALLOWED.has(location.origin)) return;
  const $ = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  const isStoreKey = (key) => key.startsWith(PREFIX);
  const parseProfiles = (raw) => {
    const data = JSON.parse(raw);
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.profiles) || data.profiles.length === 0) throw Error("プロフィールが見つからないか形式が違います。");
    const ids = new Set();
    for (const p of data.profiles) {
      if (!p || typeof p.profileId !== "string" || !p.profileId || ids.has(p.profileId) || typeof p.displayName !== "string" || !p.progress || !p.collection || !p.bestRecords) throw Error("プロフィール形式が不正です。");
      ids.add(p.profileId);
    }
    return {data, ids};
  };
  const serialise = () => {
    const entries = {};
    for (let i=0; i<localStorage.length; i++) {
      const key = localStorage.key(i);
      if (isStoreKey(key)) entries[key] = localStorage.getItem(key);
    }
    const {ids} = parseProfiles(entries[PROFILE_KEY]);
    if (!ids.has(entries[ACTIVE_KEY])) throw Error("選択中のプロフィールIDが不正です。");
    return {format:FORMAT, sourceOrigin:location.origin, exportedAt:new Date().toISOString(), entries};
  };
  const validate = (payload) => {
    if (!payload || payload.format !== FORMAT || !ALLOWED.has(payload.sourceOrigin) || payload.sourceOrigin === location.origin) throw Error("移行ファイルの形式・移行元が不正です。");
    const entries=payload.entries;
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw Error("移行データが不正です。");
    for (const [key,value] of Object.entries(entries)) {
      if (!isStoreKey(key) || typeof value !== "string" || value.length > 5000000) throw Error("想定外の保存データです。");
    }
    const {data,ids}=parseProfiles(entries[PROFILE_KEY]);
    if (!ids.has(entries[ACTIVE_KEY])) throw Error("移行元の選択プロフィールが不正です。");
    return {entries,data};
  };
  const saveFile = (filename,content) => {
    const url=URL.createObjectURL(new Blob([content],{type:"application/json;charset=utf-8"}));
    const a=$("a"); a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  const start = () => {
    const footer=document.getElementById("admin-panel-overlay")?.querySelector(".profile-card");
    if (!footer || document.getElementById("mq-transfer-open")) return;
    const launch=$("button","データ移行"); launch.id="mq-transfer-open"; launch.type="button";
    launch.style.cssText="font-size:12px;padding:6px 9px;border-radius:8px;border:1px solid #fff;color:#fff;background:#222;";
    footer.append(launch);
    const layer=$("div");layer.id="mq-transfer-dialog";
    layer.style.cssText="position:fixed;inset:0;z-index:2147483500;background:rgba(0,0,0,.90);display:none;align-items:center;justify-content:center;padding:16px;color:white;box-sizing:border-box;font:16px/1.6 sans-serif;";
    const panel=$("div");panel.style.cssText="background:#202632;padding:22px;border-radius:14px;width:min(92vw,540px);max-height:85vh;overflow:auto;";
    const heading=$("h2","マイクエ｜データ移行");panel.append(heading);
    panel.append($("p","現在のPWAの保存領域から書き出します。元データは変更しません。読み込みは空の移行先に限ります。"));
    const status=$("p");status.setAttribute("role","status");status.style.whiteSpace="pre-wrap";
    const button=(label,fn)=>{const b=$("button",label);b.type="button";b.style.cssText="padding:11px;margin:6px;border-radius:8px;background:#eef;color:#111;border:0;";b.addEventListener("click",fn);panel.append(b);return b;};
    button("① データを書き出す",()=>{
      try {const file=serialise();saveFile("maique-transfer-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(file,null,2));status.textContent="保存ファイルを確認してください。元のデータは変更していません。";}
      catch(e){status.textContent="書き出し失敗: "+e.message;}
    });
    // Profile deletion is explicit and available on either supported origin.
    // A full local backup is downloaded before any destructive change.
    const deleteRow=$("div");
    const deleteLabel=$("p","③ プロフィール削除（先にバックアップを保存）");
    const profileSelect=$("select");profileSelect.id="mq-transfer-delete-profile";
    profileSelect.style.cssText="display:block;width:100%;padding:10px;margin:8px 0;background:#fff;color:#111;";
    deleteRow.append(deleteLabel,profileSelect);
    const refreshDeleteProfiles=()=>{
      profileSelect.replaceChildren();
      const raw=localStorage.getItem(PROFILE_KEY);
      if(!raw)return;
      try {
        const {data}=parseProfiles(raw);
        for(const p of data.profiles){const option=$("option");option.value=p.profileId;option.textContent=p.displayName+" ("+p.profileId.slice(0,8)+")";profileSelect.append(option);}
      }catch(_){/* Reject invalid registries when deletion is attempted. */}
    };
    const deleteBtn=$("button","選択したプロフィールを削除");
    deleteBtn.type="button";deleteBtn.style.cssText="padding:11px;margin:6px;border-radius:8px;border:1px solid #f77;background:#4b1d26;color:white;";
    deleteBtn.addEventListener("click",()=>{
      try {
        const raw=localStorage.getItem(PROFILE_KEY);
        const {data}=parseProfiles(raw);
        const selectedId=profileSelect.value;
        const target=data.profiles.find(p=>p.profileId===selectedId);
        if(!target)throw Error("対象プロフィールを確認できません。");
        const snapshot=serialise();
        if(!confirm("「"+target.displayName+"」のデータを削除します。まず全データのバックアップJSONを書き出しますか？")){status.textContent="キャンセルしました。";return;}
        saveFile("maique-before-profile-delete-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(snapshot,null,2));
        if(prompt("バックアップがファイルに保存されたのを確認してから、削除するプロフィール名「"+target.displayName+"」を入力してください。")!==target.displayName){
          status.textContent="バックアップのみ保存しました。削除はキャンセルしました。";return;
        }
        // Reject concurrent changes before mutation.
        const now=serialise();
        if(JSON.stringify(now.entries)!==JSON.stringify(snapshot.entries))throw Error("確認中にデータが変更されました。削除を中止します。");
        if(!confirm("最終確認：「"+target.displayName+"」のプロフィールと学習記録を削除します。よろしいですか？")){status.textContent="キャンセルしました。";return;}
        const removed=[];
        const changes=[];
        const remaining=data.profiles.filter(p=>p.profileId!==selectedId);
        if(remaining.length===0){
          // Last profile: remove all app-storage keys so the existing importer can work.
          for(const key of Object.keys(snapshot.entries))changes.push([key,null]);
        }else{
          changes.push([PROFILE_KEY,JSON.stringify({...data,profiles:remaining})]);
          if(localStorage.getItem(ACTIVE_KEY)===selectedId)changes.push([ACTIVE_KEY,remaining[0].profileId]);
          const qaKey=PREFIX+"profile-qa-state-v1";
          const qaRaw=localStorage.getItem(qaKey);
          if(qaRaw){
            const qa=JSON.parse(qaRaw);
            if(qa && typeof qa==="object" && Object.hasOwn(qa,selectedId)){
              delete qa[selectedId];
              changes.push([qaKey,JSON.stringify(qa)]);
            }
          }
        }
        try{
          for(const [key,value] of changes){
            if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);
            removed.push(key);
          }
          for(const [key,value] of changes)if(localStorage.getItem(key)!==value)throw Error("削除後の照合に失敗: "+key);
        }catch(e){
          for(const key of removed){
            const previous=snapshot.entries[key];
            if(previous===undefined)localStorage.removeItem(key);else localStorage.setItem(key,previous);
          }
          throw Error("削除エラー。復旧を試みました: "+e.message);
        }
        refreshDeleteProfiles();
        status.textContent="「"+target.displayName+"」の削除が完了しました。アプリを再起動して確認してください。";
      }catch(e){status.textContent="削除中止: "+e.message;}
    });
    deleteRow.append(deleteBtn);panel.append(deleteRow);
    const fileInput=$("input");fileInput.type="file";fileInput.accept=".json,application/json";fileInput.style.display="none";panel.append(fileInput);
    button("② ファイルを読み込む",()=>fileInput.click());
    fileInput.addEventListener("change",async()=>{
      try {
        const file=fileInput.files?.[0];if(!file)return;
        if(file.size>10000000)throw Error("ファイルが大きすぎます。");
        const {entries,data}=validate(JSON.parse(await file.text()));
        if(localStorage.getItem(PROFILE_KEY)!==null)throw Error("移行先にプロフィールがあります。上書き禁止のため中止しました。");
        for(const key of Object.keys(entries))if(localStorage.getItem(key)!==null)throw Error("移行先に同じ保存キーがあります: "+key);
        const names=data.profiles.map(p=>p.displayName).join("・");
        status.textContent="読み込み候補: "+names+"（"+data.profiles.length+"プロフィール）\nこの端末にはまだ保存していません。";
        if(!confirm("移行先に "+names+" のデータを書き込みます。元データは削除しません。続行しますか？")){status.textContent="キャンセルしました。";return;}
        const typed=prompt("誤操作防止のため『移行』と入力してください。");
        if(typed!=="移行"){status.textContent="キャンセルしました。";return;}
        const written=[];
        try {
          for(const [key,value] of Object.entries(entries)){localStorage.setItem(key,value);written.push(key);}
          for(const [key,value] of Object.entries(entries)) {
            if(localStorage.getItem(key)!==value)throw Error("保存後の一致確認に失敗: "+key);
          }
          const saved=parseProfiles(localStorage.getItem(PROFILE_KEY));
          if(!saved.ids.has(localStorage.getItem(ACTIVE_KEY)))throw Error("移行後のプロフィールID確認に失敗");
        } catch(err) {
          for(const key of written)localStorage.removeItem(key);
          throw Error("保存に失敗したため書き込み分を取り消しました: "+err.message);
        }
        status.textContent="移行データの保存完了。PWAを再起動して表示と進捗を確認してください。元のPWAは削除しないでください。";
      }catch(e){status.textContent="読み込み中止: "+e.message;}finally{fileInput.value="";}
    });
    button("閉じる",()=>{layer.style.display="none";});
    panel.append(status);layer.append(panel);document.body.append(layer);
    launch.addEventListener("click",()=>{refreshDeleteProfiles();layer.style.display="flex";});
    // An empty destination shows profile setup before the top screen; allow import there.
    const setup=document.getElementById("profile-setup-overlay");
    if(setup) {
      const setupLaunch=$("button","以前のデータを移行する");
      setupLaunch.type="button";
      setupLaunch.style.cssText="padding:12px;margin:10px;background:#eef;color:#111;border-radius:9px;border:1px solid #888;";
      setupLaunch.addEventListener("click",()=>{refreshDeleteProfiles();layer.style.display="flex";});
      const form=setup.querySelector("form");
      if(form)form.append(setupLaunch);else setup.append(setupLaunch);
    }
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
