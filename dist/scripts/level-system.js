(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;root.MiqueLevelSystem=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){"use strict";
const thresholds=Object.freeze([0,100,400,900,1600,2800,4200,5800,7500,9300]);
const titles=Object.freeze(["ロボット見習い（みならい）","メカ訓練生（くんれんせい）","ロボットの友だち","はじめての操縦士（そうじゅうし）","メカの旅人（たびびと）","ロボット探検家（たんけんか）","メカライダー","未来（みらい）のパイロット","ロボット隊員（たいいん）","一人前（いちにんまえ）の操縦士（そうじゅうし）","メカの達人（たつじん）","ロボット隊長（たいちょう）","はがねの戦士（せんし）","メカキャプテン","ロボット師匠（ししょう）","勇気（ゆうき）の守護者（しゅごしゃ）","ロボット司令官（しれいかん）","伝説（でんせつ）の操縦士（そうじゅうし）","メカの大将（たいしょう）","ロボットマスター","いなずまライダー","無敵（むてき）のロボット使い","はがねの騎士（きし）","メカの英雄（えいゆう）","スーパーロボット師匠（ししょう）","ほのおの勇者（ゆうしゃ）","マッハの操縦王（そうじゅうおう）","ロボット軍団長（ぐんだんちょう）","伝説（でんせつ）のメカ騎士（きし）","最強（さいきょう）のロボット王（おう）","星空（ほしぞら）の旅人（たびびと）","宇宙（うちゅう）の操縦士（そうじゅうし）","銀河（ぎんが）の探検王（たんけんおう）","スターコマンダー","銀河（ぎんが）の守護神（しゅごしん）","光（ひかり）の聖騎士（せいきし）","伝説（でんせつ）のロボット英雄（えいゆう）","宇宙（うちゅう）の大司令官（だいしれいかん）","銀河（ぎんが）の皇帝（こうてい）","ロボット界（かい）の伝説（でんせつ）","時空（じくう）の旅人（たびびと）","銀河（ぎんが）の英雄王（えいゆうおう）","伝説（でんせつ）の神騎士（しんきし）","インフィニティマスター","アルティメットロボキング","ゴッドメカエンペラー","ギャラクシーロボゴッド","インフィニティロボエンペラー","アルティメットレジェンド","マイクエ・レジェンド"]);
function requiredPoints(level){if(!Number.isInteger(level)||level<1||level>50)throw new RangeError("level must be 1..50");return level<=10?thresholds[level-1]:thresholds[9]+(level-10)*2000;}
function levelAt(points){const total=Math.max(0,Math.floor(Number(points)||0));for(let level=50;level>=1;level--)if(total>=requiredPoints(level))return level;return 1;}
function formatPoints(points){const n=Math.max(0,Math.floor(Number(points)||0));return n>=10000?`${Math.floor(n/10000)}万${n%10000?String(n%10000):""}`:`${n}`;}
function title(level){return titles[level-1].replace(/（[^）]*）/g,"");}
function titleHtml(level){return titles[level-1].replace(/([一-龯々ヶ]+[ぁ-ん]*)（([^）]+)）/g,"<ruby>$1<rt>$2</rt></ruby>");}
return Object.freeze({thresholds,titles,requiredPoints,levelAt,formatPoints,title,titleHtml});
});
