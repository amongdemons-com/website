(()=>{var Cr=Object.defineProperty;var Lr=(e,t)=>{for(var n in t)Cr(e,n,{get:t[n],enumerable:!0})};var h={};function Fn(e){Object.assign(h,e)}var rt="amongdemons-battle-speed",In="amongdemons-battle-screen-shake",Nn="amongdemons-battle-card-shake";var Re=[.5,1,2,4];var ze={default:{color:"#FAC51C",shadow:"rgba(250,197,28,0.85)"},poison:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},heal:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},1:{color:"#D1D5D8",shadow:"rgba(209,213,216,0.82)",outline:"#101820"},2:{color:"#171D24",shadow:"rgba(0,0,0,0.88)"},3:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},4:{color:"#E25041",shadow:"rgba(226,80,65,0.88)"},5:{color:"#C8CED2",shadow:"rgba(200,206,210,0.82)",outline:"#101820"},6:{color:"#C084FC",shadow:"rgba(192,132,252,0.9)"},7:{color:"#FFB23F",shadow:"rgba(255,178,63,0.9)"},8:{color:"#6E8F45",shadow:"rgba(110,143,69,0.86)"},9:{color:"#B8BDC2",shadow:"rgba(184,189,194,0.84)",outline:"#101820"},10:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},11:{color:"#52B7FF",shadow:"rgba(82,183,255,0.9)"}};var Br=window.AmongDemons.getSession(),i={player:Br.player||null,statPoints:null,run:null,startOptions:null,selectedRecruitRewardId:null,selectedSwapInstanceId:null,selectedRewardDemonKey:null,rewardDraftCandidate:null,isRecruiting:!1,isResultAnimating:!1,draggedRecruitPoolInstanceId:null,draggedFormationInstanceId:null,draggedRewardDemonKey:null,recruitSwapEffectIds:[],pendingHandFlowSources:null,isEnemyPreviewDeferred:!1,enemyRevealEffectIds:[],isPactRevealPending:!1,isPactTeamPreview:!1,pactRevealTimer:null,battleHandPreview:null,activeHandTab:"hand",isMobileRewardBoxOpen:!1,recruitDraftTeam:null,recruitDraftPool:null,collectionDemons:null,collectionReinforcementPlaceholderInteracted:!1,collectionReinforcementStagedInteracted:!0,isRecruitContinuePending:!1,combatLog:[],combatDemons:new Map,combatPlayback:null,battleSpeed:Er(),isBattleAnimating:!1,endNotice:null,endSummary:null,endedReplayRun:null,formationRows:new Map,isLoading:!0},b={},ue=null;function _n(e){ue=e}function Er(){let e=Number(localStorage.getItem(rt));return Re.includes(e)?e:1}var sn={};Lr(sn,{animateAttackerCard:()=>Zn,animateCombatEntry:()=>Yn,appendTemporaryElement:()=>W,applyBattleSpeed:()=>mt,applyCombatTheme:()=>en,createCombatDemonMap:()=>Ke,createCombatElement:()=>Y,drawAttackZap:()=>Ce,drawChaoticLightning:()=>da,drawCombatAnimation:()=>no,drawDarkSpike:()=>ua,drawFireNova:()=>ca,drawFireball:()=>ia,drawGroupFireball:()=>sa,drawHealEffect:()=>la,drawSwordSwing:()=>Jt,drawThornBurst:()=>Vt,findDemonCard:()=>A,formatBattleSpeed:()=>co,getAttackGeometry:()=>We,getAttackProfile:()=>Ye,getBattleTimeScale:()=>an,getCombatDemon:()=>J,getCombatStepDelay:()=>tn,getCombatTheme:()=>Qt,getDemonSide:()=>re,getFightLogActionText:()=>fa,getFightLogAmountText:()=>ha,getFightLogVerb:()=>pa,getFloatingDamageAmount:()=>Wn,getLogRowClass:()=>ba,getLogSideLabel:()=>ya,getPoisonBurstDamage:()=>on,groupCombatLog:()=>je,healTargetCard:()=>zt,hitTargetCard:()=>aa,isCardShakeEnabled:()=>ta,isScreenShakeEnabled:()=>na,isTypeTwoAttack:()=>ma,maybePlayDeath:()=>oa,pauseCombatPlayback:()=>jt,playCombatLog:()=>ct,playTemporaryCardClass:()=>ge,poisonTickCard:()=>Ot,prefersReducedMotion:()=>z,prepareCombatPlayback:()=>qn,renderFightLogDemonName:()=>qt,renderFightLogRow:()=>rn,renderLogPosition:()=>ga,renderViewportSvg:()=>oe,resumeCombatPlayback:()=>Kt,scaleCombatDuration:()=>V,scheduleImpact:()=>$e,setActiveLogRow:()=>ut,setBattleSpeed:()=>nn,shakeTargetCard:()=>so,showFloatingDamage:()=>Ve,skipCombatPlayback:()=>Xt,spawnImpactBurst:()=>Ht,stepCombatPlayback:()=>Ut,syncBattleSpeedButtons:()=>gt,syncCombatHpCards:()=>Xn,syncPoisonStatus:()=>Gt,triggerScreenShake:()=>ra,updateTargetCard:()=>me,updateTeamHp:()=>Un});var Ar=window.AmongDemons.api;var Hn=window.AmongDemons.ui.renderDemonCard,Dr=window.AmongDemons.ui.renderCombatStats,Os=window.AmongDemons.ui.openDemonDetailsModal,L=window.AmongDemons.ui.renderIcon||(()=>""),Mt=window.AmongDemons.ui.renderSoulAmount||(e=>String(e||0)),Tt=window.AmongDemons.ui.getRarityColor||(()=>"#D1D5D8");var ae=new WeakMap;function On(){i.endNotice=null,i.endSummary=null,i.endedReplayRun=null}function N(e,t){e&&e.addEventListener("click",t)}function ot(e,t,n=document){n.querySelectorAll(e).forEach(a=>{a.addEventListener("click",r=>t(a,r))})}function ee(e,t,n={}){if(!e)return!1;let a=String(t||""),r=n.renderKey?String(n.renderKey):"",o=Pe(a,r);return ae.get(e)===o?!1:(n.patchFormationGrid?Tr(e,a,r):n.patchDemonLane?Fr(e,a,r):n.preserveDemonImages?Mr(e,a):e.innerHTML=a,ae.set(e,o),!0)}function Mr(e,t){let n=Ge(e),a=document.createElement("template");a.innerHTML=t,we(a.content,n),e.replaceChildren(a.content)}function Tr(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let r=e.querySelector(".battle-formation-grid"),o=a.content.querySelector(".battle-formation-grid");if(!r||!o){let m=Ge(e);we(a.content,m),e.replaceChildren(a.content),Ir(e.querySelector(".battle-formation-grid"),n);return}let s=Ge(e);It(r,o);let c=Ft(r),d=new Map(c.map(m=>[m.dataset.formationSlot,m])),l=Ft(o),g=new Set(l.map(m=>m.dataset.formationSlot));l.forEach((m,f)=>{let R=m.dataset.formationSlot,y=d.get(R);if(!y){we(m,s),r.insertBefore(m,r.children[f]||null);return}y!==r.children[f]&&r.insertBefore(y,r.children[f]||null);let S=m.outerHTML,k=Pe(S,n);(ae.get(y)||y.outerHTML)!==k&&(we(m,s),ae.set(m,k),y.replaceWith(m))}),c.forEach(m=>{g.has(m.dataset.formationSlot)||m.remove()})}function Fr(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let r=e.querySelector(".formation-lane-cards"),o=a.content.querySelector(".formation-lane-cards");if(!r||!o){let c=Ge(e);we(a.content,c),e.replaceChildren(a.content),_r(e.querySelector(".formation-lane-cards"),n);return}let s=Ge(e);It(r,o),Nr(r,Array.from(o.children),{imagesByKey:s,renderKey:n,getKey:Hr})}function Ft(e){return e?Array.from(e.children).filter(t=>t.matches?.(".formation-slot[data-formation-slot]")):[]}function Ir(e,t=""){Ft(e).forEach(n=>{ae.set(n,Pe(n.outerHTML,t))})}function Nr(e,t,n={}){let{imagesByKey:a=new Map,renderKey:r="",getKey:o}=n,s=Array.from(e.children),c=new Map(s.map((l,g)=>[o(l,g),l])),d=new Set(t.map((l,g)=>o(l,g)));t.forEach((l,g)=>{let m=o(l,g),f=c.get(m);if(!f){we(l,a),ae.set(l,Pe(l.outerHTML,r)),e.insertBefore(l,e.children[g]||null);return}f!==e.children[g]&&e.insertBefore(f,e.children[g]||null);let R=l.outerHTML,y=Pe(R,r);(ae.get(f)||f.outerHTML)!==y&&(we(l,a),ae.set(l,y),f.replaceWith(l))}),s.forEach((l,g)=>{d.has(o(l,g))||l.remove()})}function _r(e,t=""){e&&Array.from(e.children).forEach(n=>{ae.set(n,Pe(n.outerHTML,t))})}function Hr(e,t=0){let n=e.dataset?.instanceId;if(n)return`demon:${n}`;let a=e.dataset?.collectionReinforcementPosition;return a?`collection-reinforcement:${a}`:e.classList?.contains("dungeon-hand-empty")?"empty:hand":`node:${t}`}function Pe(e,t=""){return t?`${t}
${e}`:e}function Ge(e){let t=new Map;return e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=zn(n);a&&!t.has(a)&&t.set(a,n)}),t}function we(e,t){e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=zn(n),r=a?t.get(a):null;r&&(It(r,n),n.replaceWith(r),t.delete(a))})}function zn(e){let n=e.closest(".dungeon-demon-card[data-instance-id]")?.dataset.instanceId,a=e.getAttribute("src")||"";return n&&a?`${n}|${a}`:""}function It(e,t){Array.from(e.attributes).forEach(n=>{t.hasAttribute(n.name)||e.removeAttribute(n.name)}),Array.from(t.attributes).forEach(n=>{e.getAttribute(n.name)!==n.value&&e.setAttribute(n.name,n.value)})}function xe(e){e&&(e.disabled=!1)}function it(e){return e?e.charAt(0).toUpperCase()+e.slice(1):""}function w(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Gn(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function Nt(e){return(e||[]).map(t=>({...t}))}var Le=window.AmongDemons.audio,Or="amongdemons:battle-intro-complete";var Yt=(...e)=>h.getDemonPosition(...e),zr=(...e)=>h.renderDemonStatus(...e),Gr=(...e)=>h.renderDungeonCenterActions(...e),_t=(...e)=>h.renderFightLog(...e),Be=(...e)=>h.renderFightLogActions(...e),qe=(...e)=>h.renderRun(...e);function qn(e={}){if(!i.run)return null;let t=je(i.combatLog,{combineCounters:!0}),n={currentIndex:0,isPaused:!1,stepDirection:0,steps:t,totalSteps:t.length,waitResolve:null};return i.combatPlayback=n,i.isBattleAnimating=!0,e.render!==!1&&(qe(),_t()),n}async function ct(e={}){if(!i.run)return;let t=e.combatPlayback,n=t&&i.combatPlayback===t?t:qn({render:!1});if(!n)return;let a=n.steps||[];if(i.isBattleAnimating=!0,qe(),_t(),e.waitForBattleIntro){if(Gr({canFight:!0,isFighting:!0}),await Le?.play("sfx.battle.battleStart",{volume:.9,waitForEnd:!0}),!i.run||i.combatPlayback!==n)return;window.dispatchEvent(new CustomEvent(Or))}qe(),_t();try{for(;i.combatPlayback&&i.combatPlayback.currentIndex<a.length;){let r=await Ur();if(!r||!i.combatPlayback)break;if(r==="previous"){await Zr();continue}let o=i.combatPlayback.currentIndex,s=a[o];if(!s)break;X(!1),Wt(s,o,{animate:!0}),i.combatPlayback.currentIndex=o+1,Be(),await jn(V(tn(s))),X(!!i.combatPlayback?.isPaused)}}finally{i.isBattleAnimating=!1,i.combatPlayback=null,X(!1),qe()}ut(-1)}function Wt(e,t=-1,n={}){let a=Qr(),r=n.animate!==!1;if(e.entries.forEach(m=>{let f=a.get(m.target);f&&(f.hp=m.targetHp,m.effect==="poison_apply"&&(f.statusEffects=f.statusEffects||{},f.statusEffects.poison=Array.from({length:Math.max(1,Number(m.poisonStacks)||1)},()=>({}))),m.effect==="poison"&&Object.prototype.hasOwnProperty.call(m,"poisonStacks")&&(f.statusEffects=f.statusEffects||{},f.statusEffects.poison=Array.from({length:Math.max(0,Number(m.poisonStacks)||0)},()=>({}))))}),Un(),!r){Xn();return}ut(t);let o=re(e.attacker),s=lt(e),c=new Map(s.map((m,f)=>[m,f])),d=!!e.isAoe||s.length>1;Vr(e),e.primaryEffect!=="poison"&&Zn(e.attacker,e.primaryEffect,e.entries[0]?.target);let l=Yr(e);l&&sa(e.attacker,l.targetIds,{effect:e.primaryEffect,travel:l.travel});let g=Wr(e);g&&Jt(e.attacker,g.targetId),e.entries.forEach(m=>{let f=c.get(m)??0;Yn(m,e,o,f,d,l,g)})}function Vr(e){let t=e.entries?.[0]||{},n=e.primaryEffect||t.effect;if(n==="poison"||n==="heal"||n==="last_breath"||n==="shared_pain")return;let a=null;if(n==="poison_apply")a="sfx.battle.abilities.poisonApply";else if(n==="retaliate"||n==="thorns")a="sfx.battle.abilities.thornsRetaliate";else{let r=Number(J(e.attacker)?.typeId);a={1:"sfx.battle.abilities.meleeSwing",2:"sfx.battle.abilities.rangedProjectile",3:"sfx.battle.abilities.poisonApply",4:"sfx.battle.abilities.fireAoe",5:"sfx.battle.abilities.bruiserStrike",6:"sfx.battle.abilities.assassinStrike",7:"sfx.battle.abilities.cleave",8:"sfx.battle.abilities.thornsRetaliate",9:"sfx.battle.abilities.juggernautSlam",10:"sfx.battle.abilities.heal",11:"sfx.battle.abilities.chaosAttack"}[r]||"sfx.battle.abilities.meleeSwing"}Le?.play(a,{volume:.72,minInterval:55}),!Z(t)&&(e.entries||[]).some(Z)&&Le?.play("sfx.battle.abilities.thornsRetaliate",{volume:.66,minInterval:55})}var qr=new Set(["poison","heal","last_breath","shared_pain","poison_apply"]);function Z(e){return e?.effect==="retaliate"||e?.effect==="thorns"}function lt(e){return(e.entries||[]).filter(t=>!Z(t))}function st(e){return!Z(e)&&!qr.has(e.effect)}function Yr(e){if(z()||e.targeting==="chaotic"||Number(J(e.attacker)?.typeId)!==4)return null;let t=(e.entries||[]).filter(st);return t.length?{targetIds:t.map(n=>n.target),travel:Ye(t[0]).travel,lead:90}:null}function Wr(e){if(z()||Number(J(e.attacker)?.typeId)!==7)return null;let t=(e.entries||[]).filter(st);return t.length?{targetId:t[Math.floor((t.length-1)/2)].target}:null}function Yn(e,t,n,a,r,o=null,s=null){let c=z();if(e.effect==="poison"){$e(160,()=>{a===0&&Le?.play("sfx.battle.abilities.poisonTick",{volume:.66,minInterval:80}),a===0&&Ve(e.target,on(t),"poison",e.attacker,e.effect,{burstCount:t.entries.length}),me(e.target,e.targetHp,n,{hit:!1}),Gt(e.target,e.poisonStacks),Ot(e.target)});return}if(e.effect==="heal"){c||la(e.attacker,e.target),$e(200,()=>{Le?.play("sfx.battle.abilities.heal",{volume:.7,minInterval:80}),me(e.target,e.targetHp,n,{hit:!1,healing:e.healing}),Ve(e.target,e.healing,"heal",e.attacker,e.effect),zt(e.target)});return}if(e.effect==="last_breath"){$e(160,()=>{me(e.target,e.targetHp,n,{hit:!1}),Ve(e.target,1,"heal",e.attacker,e.effect),zt(e.target)});return}if(e.effect==="shared_pain"){me(e.target,e.targetHp,n,{hit:!1});return}if(e.effect==="poison_apply"){c||Ce(t.attacker,e.target,{effect:e.effect,poison:!0,bubbles:15,variant:"poison-flame"}),$e(220,()=>{Gt(e.target,e.poisonStacks||1),me(e.target,e.targetHp,n),Ht(e.target,{attackerId:e.attacker,effect:e.effect,variant:"poison"}),Ot(e.target)});return}let d=Ye(e),l=o&&st(e),g=s&&st(e),m=l||g,f=!Z(e)||jr(e,t);!c&&!m&&f&&d.draw();let R=l?o.travel+o.lead+a*50:d.travel+(r?a*70:0);$e(R,()=>{me(e.target,e.targetHp,n);let y=Wn(e,t);y>0&&Ve(e.target,y,ma(e.attacker)?"dark":"damage",e.attacker,e.effect),Ht(e.target,{attackerId:e.attacker,effect:e.effect,heavy:d.heavy,variant:d.key,aoe:r&&!Z(e)}),aa(e.target,d.heavy),d.screenShake&&ra(),oa(e.target,e.targetHp)})}function Wn(e,t){let n=Math.max(0,Number(e?.dmg)||0);if(!Z(e))return n;let a=(t?.entries||[]).filter(r=>Z(r)&&r.target===e.target);return a[0]!==e?0:a.reduce((r,o)=>r+Math.max(0,Number(o.dmg)||0),0)}function jr(e,t){if(!Z(e))return!0;let n=(t?.entries||[]).filter(Z),a=n.filter(o=>o.effect==="retaliate"||Kr(o.attacker));return(a.length?a:n).find(o=>o.attacker===e.attacker)===e}function Kr(e){let t=J(e)||{},n=String(t.role||"").toLowerCase(),a=String(t.abilityKind||t.ability_kind||t.ability?.kind||"").toLowerCase();return Number(t.typeId)===8||n==="counter_tank"||a==="retaliate"}async function Ur(){for(;i.combatPlayback?.isPaused;){X(!0);let e=Number(i.combatPlayback.stepDirection)||0;if(i.combatPlayback.stepDirection=0,e<0)return"previous";if(e>0)return i.combatPlayback.currentIndex<i.combatPlayback.totalSteps?"next":null;await Xr()}return X(!1),i.combatPlayback?"play":null}function jn(e){let t=i.combatPlayback;return t?new Promise(n=>{let a=window.setTimeout(r,Math.max(0,Number(e)||0));function r(){window.clearTimeout(a),t.waitResolve===r&&(t.waitResolve=null),n()}t.waitResolve=r}):Promise.resolve()}function Xr(){let e=i.combatPlayback;return e?new Promise(t=>{e.waitResolve=()=>{e.waitResolve=null,t()}}):Promise.resolve()}function jt(){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!0,X(!0),dt(),Be())}function Kt(){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!1,i.combatPlayback.stepDirection=0,X(!1),dt(),Be())}function Ut(e){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!0,i.combatPlayback.stepDirection=Number(e)<0?-1:1,X(!0),dt(),Be())}function Xt(){let e=i.combatPlayback;!i.run||!e||!i.isBattleAnimating||(e.isPaused=!1,e.stepDirection=0,Kn(e.totalSteps),X(!1),dt())}function dt(){let e=i.combatPlayback?.waitResolve;e&&e()}function Kn(e){if(!i.run||!i.combatPlayback)return;eo(),Jr();let t=i.combatPlayback.steps||[],n=Zt(Math.floor(Number(e)||0),0,t.length);for(let a=0;a<n;a+=1)Wt(t[a],a,{animate:!1});i.combatPlayback.currentIndex=n,qe(),ut(n>0?n-1:-1)}async function Zr(){let e=i.combatPlayback;if(!i.run||!e||e.currentIndex<=0)return;let t=e.steps||[],n=Zt(e.currentIndex-2,0,t.length-1),a=t[n];a&&(Kn(n),X(!1),Wt(a,n,{animate:!0}),e.currentIndex=n+1,Be(),await jn(V(tn(a))),i.combatPlayback&&(i.combatPlayback.isPaused=!0,X(!0),Be()))}function Jr(){let e=i.run?.lastBattle||{};i.run.team=Nt(e.playerTeamBefore||i.run.team||[]),i.run.enemies=Nt(e.enemyTeamBefore||i.run.enemies||[]),i.combatDemons=Ke()}function Qr(){return new Map([...i.run?.team||[],...i.run?.enemies||[]].map(e=>[e.instanceId,e]))}function eo(){io(),document.querySelectorAll([".attack-zap",".chaos-lightning",".combat-impact-burst",".dark-spike",".fireball-shot",".fire-nova",".floating-combat-number",".heal-effect",".sword-swing",".thorn-burst"].join(",")).forEach(e=>e.remove()),document.querySelector(".dungeon-arena")?.classList.remove("is-combat-screenshake")}function X(e){let t=!!e;document.documentElement.classList.toggle("is-combat-paused",t),t?ro():oo()}function Zt(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}function Un(){i.run&&(i.run.hp=(i.run.team||[]).reduce((e,t)=>e+Math.max(0,Number(t.hp)||0),0))}function Xn(){[...i.run?.team||[],...i.run?.enemies||[]].forEach(e=>{me(e.instanceId,e.hp)})}function ut(e){document.querySelectorAll(".fight-log-row").forEach(t=>{t.classList.toggle("active",Number(t.dataset.logIndex)===e)})}function Zn(e,t,n){let a=A(e);a&&(en(a,Qt(e,t)),a.classList.toggle("is-player-attack",re(e)==="player"),a.classList.toggle("is-enemy-attack",re(e)==="enemy"),to(a,n),ge(a,"is-attacking",320))}function to(e,t){if(z()||!t){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let n=A(t);if(!n){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let a=e.getBoundingClientRect(),r=n.getBoundingClientRect(),o=r.left+r.width/2-(a.left+a.width/2),s=r.top+r.height/2-(a.top+a.height/2),c=Math.hypot(o,s)||1,d=Math.min(18,c*.26);e.style.setProperty("--lunge-x",`${(o/c*d).toFixed(1)}px`),e.style.setProperty("--lunge-y",`${(s/c*d).toFixed(1)}px`)}function Ye(e){let{attacker:t,target:n,effect:a}=e;if(Z(e))return{key:"thorn",travel:210,heavy:!1,screenShake:!1,draw:()=>Vt(t,n)};if(e.targeting==="chaotic")return{key:"chaotic",travel:150,heavy:!0,screenShake:!1,draw:()=>da(t,n)};let r=Number(J(t)?.typeId);return{2:{key:"dark",travel:200,heavy:!1,draw:()=>ua(t,n)},4:{key:"fire",travel:380,heavy:!0,screenShake:!1,draw:()=>ia(t,n,{effect:a})},5:{key:"sniper",travel:360,heavy:!0,draw:()=>Ce(t,n,{effect:a,variant:"heavy",duration:520})},6:{key:"assassin",travel:120,heavy:!1,draw:()=>Ce(t,n,{effect:a,variant:"assassin",duration:240})},7:{key:"melee",travel:170,heavy:!1,draw:()=>Jt(t,n)},8:{key:"thorn",travel:210,heavy:!1,draw:()=>Vt(t,n)},9:{key:"crushing",travel:620,heavy:!0,screenShake:!0,draw:()=>Ce(t,n,{effect:a,variant:"crushing",duration:960})}}[r]||{key:"melee",travel:150,heavy:!1,draw:()=>Ce(t,n,{effect:a})}}function no(e){Ye(e).draw()}function z(){return!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)}var Ee=new Set;function Jn(){return window.performance?.now?.()??Date.now()}function $e(e,t){let n=V(e);if(z()||n<=0){t();return}let a={fn:t,remaining:n,startedAt:0,handle:null};a.run=()=>{a.handle=null,Ee.delete(a),a.fn()},Ee.add(a),ao()||Qn(a)}function Qn(e){e.startedAt=Jn(),e.handle=window.setTimeout(e.run,e.remaining)}function ao(){return document.documentElement.classList.contains("is-combat-paused")}function ro(){Ee.forEach(e=>{e.handle!=null&&(window.clearTimeout(e.handle),e.handle=null,e.remaining=Math.max(0,e.remaining-(Jn()-e.startedAt)))})}function oo(){Ee.forEach(e=>{e.handle==null&&Qn(e)})}function io(){Ee.forEach(e=>{e.handle!=null&&window.clearTimeout(e.handle)}),Ee.clear()}function Ht(e,t={}){if(z())return;let n=A(e);if(!n)return;let a=n.getBoundingClientRect(),r=Y(["combat-impact-burst",t.heavy?"is-heavy":"",t.aoe?"is-aoe":"",`is-${t.variant||"melee"}`].filter(Boolean).join(" "),t.attackerId,t.effect);r.style.left=`${(a.left+a.width/2).toFixed(1)}px`,r.style.top=`${(a.top+a.height/2).toFixed(1)}px`;let o=t.heavy?520:380;r.style.setProperty("--fx-duration",`${V(o)}ms`);let s=t.heavy?9:6,c=t.heavy?26:17,d=Array.from({length:s},(l,g)=>{let m=360/s*g+(g%2?14:-10),f=c+g%3*5;return`<span class="combat-impact-particle" style="--p-angle:${m.toFixed(0)}deg;--p-dist:${f}px;animation-delay:${V(g*6)}ms"></span>`}).join("");r.innerHTML=`<span class="combat-impact-core"></span>${t.aoe?'<span class="combat-impact-ring"></span>':""}${d}`,W(r,o)}function ea(e){try{return localStorage.getItem(e)!=="0"}catch{return!0}}function ta(){return ea(Nn)}function na(){return ea(In)}function aa(e,t){if(z())return;let n=A(e);if(!n)return;let a=ta();ge(n,t&&a?"is-shaking":"is-hit",t&&a?360:240)}function Ot(e){if(z())return;let t=A(e);t&&ge(t,"is-poison-tick",520)}function zt(e){if(z())return;let t=A(e);t&&ge(t,"is-healed",520)}var Vn=0;function ra(){if(z()||!na())return;let e=window.performance?.now?.()??Date.now();if(e-Vn<140)return;Vn=e;let t=document.querySelector(".dungeon-arena");t&&ge(t,"is-combat-screenshake",360)}function oa(e,t){if(Number(t)>0)return;let n=A(e);!n||n.classList.contains("is-dying")||(Le?.playDeath(),!z()&&ge(n,"is-dying",620))}function Ce(e,t,n={}){let a=A(e),r=A(t);if(!a||!r)return;let{attackerRect:o,startX:s,startY:c,endX:d,endY:l}=We(a,r),g=J(e),m=g&&Yt(g)==="back",f=m?.12:.22,R=m?.9:.78,y=s+(d-s)*f,S=c+(l-c)*f,k=s+(d-s)*R,P=c+(l-c)*R,M=(y+k)/2,F=(S+P)/2,T=-(P-S)/Math.max(1,Math.hypot(k-y,P-S)),I=(k-y)/Math.max(1,Math.hypot(k-y,P-S)),U=m?10:6,te=M+T*U,ne=F+I*U,le=Number(n.bubbles)||0,Se=le?Array.from({length:le},(be,O)=>{let B=.08+O/Math.max(1,le-1)*.84,ye=(1-B)*(1-B)*y+2*(1-B)*B*te+B*B*k,Dt=(1-B)*(1-B)*S+2*(1-B)*B*ne+B*B*P,Oe=(O%2?-1:1)*(4+O%4),G=2.2+O%4*.8;return`<circle class="poison-bubble" cx="${(ye+T*Oe).toFixed(1)}" cy="${(Dt+I*Oe).toFixed(1)}" r="${G.toFixed(1)}" style="animation-delay: ${V(O*18).toFixed(0)}ms" />`}).join(""):"",H=Number(n.flames)||0,D=H?Array.from({length:H},(be,O)=>{let B=.08+O/Math.max(1,H-1)*.84,ye=(1-B)*(1-B)*y+2*(1-B)*B*te+B*B*k,Dt=(1-B)*(1-B)*S+2*(1-B)*B*ne+B*B*P,Oe=(O%2?-1:1)*(5+O%3*2),G=5+O%4,ve=ye+T*Oe,ke=Dt+I*Oe;return`<path class="fire-spark" d="M ${ve.toFixed(1)} ${(ke-G).toFixed(1)} C ${(ve+G*.72).toFixed(1)} ${(ke-G*.2).toFixed(1)} ${(ve+G*.45).toFixed(1)} ${(ke+G*.72).toFixed(1)} ${ve.toFixed(1)} ${(ke+G).toFixed(1)} C ${(ve-G*.55).toFixed(1)} ${(ke+G*.42).toFixed(1)} ${(ve-G*.45).toFixed(1)} ${(ke-G*.32).toFixed(1)} ${ve.toFixed(1)} ${(ke-G).toFixed(1)} Z" style="animation-delay: ${V(O*16).toFixed(0)}ms" />`}).join(""):"",de=Y(["attack-zap",re(e)==="player"?"is-player-attack":"is-enemy-attack",m?"is-back-attack":"",n.variant?`is-${n.variant}`:"",n.poison?"is-poison-apply":""].filter(Boolean).join(" "),e,n.effect);de.innerHTML=oe(`
      <path class="attack-zap-trail" d="M ${y.toFixed(1)} ${S.toFixed(1)} Q ${te.toFixed(1)} ${ne.toFixed(1)} ${k.toFixed(1)} ${P.toFixed(1)}" />
      ${n.variant==="assassin"?`<path class="attack-zap-trail attack-zap-trail-secondary" d="M ${(y+T*7).toFixed(1)} ${(S+I*7).toFixed(1)} Q ${(te+T*7).toFixed(1)} ${(ne+I*7).toFixed(1)} ${(k+T*7).toFixed(1)} ${(P+I*7).toFixed(1)}" />`:""}
      ${Se}
      ${D}
      <circle class="attack-zap-impact" cx="${k.toFixed(1)}" cy="${P.toFixed(1)}" r="${m?5:4}" />
  `),W(de,n.duration||320)}function ia(e,t,n={}){let a=A(e),r=A(t);if(!a||!r)return;let{attackerRect:o,targetRect:s,startX:c,startY:d,endX:l,endY:g,angle:m}=We(a,r),f=J(e),R=f&&Yt(f)==="back",y=Math.min(o.width*(R?.28:.42),46),S=Math.min(s.width*.18,22),k=c+Math.cos(m)*y,P=d+Math.sin(m)*y,M=l-Math.cos(m)*S,F=g-Math.sin(m)*S,T=Math.max(1,Math.hypot(M-k,F-P)),I=-(F-P)/T,U=(M-k)/T,te=Math.max(12,Math.min(24,s.width*.18)),ne=8,le=Array.from({length:ne},(H,D)=>{let de=.12+D/Math.max(1,ne-1)*.72,be=(D%2?-1:1)*(4+D%3*2),O=k+(M-k)*de+I*be,B=P+(F-P)*de+U*be,ye=1.8+D%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${B.toFixed(1)}" r="${ye.toFixed(1)}" style="animation-delay: ${V(70+D*28).toFixed(0)}ms" />`}).join(""),Se=Y(["fireball-shot",re(e)==="player"?"is-player-attack":"is-enemy-attack",R?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);Se.innerHTML=oe(`
      ${le}
      <g class="fireball-projectile" style="--fireball-start-x: ${k.toFixed(1)}px; --fireball-start-y: ${P.toFixed(1)}px; --fireball-end-x: ${M.toFixed(1)}px; --fireball-end-y: ${F.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="8.5" />
        <circle class="fireball-hot" cx="3.6" cy="-2.2" r="4.2" />
      </g>
      <circle class="fireball-impact" cx="${M.toFixed(1)}" cy="${F.toFixed(1)}" r="${te.toFixed(1)}" />
  `),W(Se,620)}function sa(e,t,n={}){let a=A(e),r=(t||[]).map(A).filter(Boolean);if(z()||!a||!r.length)return;let o=a.getBoundingClientRect(),s=o.left+o.width/2,c=o.top+o.height/2,d=r.map(H=>{let D=H.getBoundingClientRect();return{x:D.left+D.width/2,y:D.top+D.height/2,half:Math.max(D.width,D.height)/2}}),l=d.reduce((H,D)=>H+D.x,0)/d.length,g=d.reduce((H,D)=>H+D.y,0)/d.length,m=Math.atan2(g-c,l-s),f=J(e),R=f&&Yt(f)==="back",y=Math.min(o.width*(R?.28:.42),46),S=s+Math.cos(m)*y,k=c+Math.sin(m)*y,P=l,M=g,F=Math.max(1,Math.hypot(P-S,M-k)),T=-(M-k)/F,I=(P-S)/F,U=Zt(Math.max(...d.map(H=>Math.hypot(H.x-l,H.y-g)+H.half))+8,44,220),te=9,ne=Array.from({length:te},(H,D)=>{let de=.12+D/Math.max(1,te-1)*.72,be=(D%2?-1:1)*(4+D%3*2),O=S+(P-S)*de+T*be,B=k+(M-k)*de+I*be,ye=1.8+D%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${B.toFixed(1)}" r="${ye.toFixed(1)}" style="animation-delay: ${V(70+D*28).toFixed(0)}ms" />`}).join(""),le=Y(["fireball-shot",re(e)==="player"?"is-player-attack":"is-enemy-attack",R?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);le.innerHTML=oe(`
      ${ne}
      <g class="fireball-projectile" style="--fireball-start-x: ${S.toFixed(1)}px; --fireball-start-y: ${k.toFixed(1)}px; --fireball-end-x: ${P.toFixed(1)}px; --fireball-end-y: ${M.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="11" />
      </g>
  `),W(le,620);let Se=Number(n.travel)||380;$e(Se,()=>ca(l,g,U,e,n.effect))}function ca(e,t,n,a,r){if(z())return;let o=Math.max(20,Number(n)||60),s=Y("fire-nova",a,r),c=`fire-nova-grad-${Math.random().toString(36).slice(2,8)}`;s.innerHTML=oe(`
      <defs>
        <radialGradient id="${c}" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
          <stop offset="52%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
          <stop offset="82%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0.62" />
          <stop offset="100%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
        </radialGradient>
      </defs>
      <circle class="fire-nova-flash" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${(o*.72).toFixed(1)}" style="fill: url(#${c})" />
      <circle class="fire-nova-ring fire-nova-ring-hot" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${(o*.62).toFixed(1)}" />
      <circle class="fire-nova-ring" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${o.toFixed(1)}" />
      <circle class="fire-nova-ring fire-nova-ring-delayed" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${o.toFixed(1)}" />
  `),W(s,620)}function me(e,t,n="unknown",a={}){let r=A(e);if(!r)return;let o=r.querySelector(".js-demon-hp");o&&(o.textContent=t);let s=r.querySelector(".js-demon-hp-fill");if(s){let c=Number(s.dataset.maxHp)||Number(t)||1,d=Math.max(0,Math.min(100,Math.round(Number(t)/c*100)));s.style.width=`${d}%`}r.classList.toggle("is-defeated",Number(t)<=0)}function Gt(e,t){let n=A(e);if(!n)return;let a=n.querySelector(".demon-status-poison");if(Number(t)<=0){n.querySelector(".demon-status-strip")?.remove(),n.classList.remove("is-poisoned");return}n.classList.add("is-poisoned"),n.querySelector(".demon-status-strip")?.remove(),n.insertAdjacentHTML("beforeend",zr({statusEffects:{poison:Array.from({length:Math.max(1,Number(t)||1)},()=>({}))}}))}function Ve(e,t,n,a,r,o={}){let s=A(e);if(!s)return;let c=s.getBoundingClientRect(),d=Y(`floating-combat-number is-${n}`,a,r||n);if(d.style.left=`${(c.left+c.width/2).toFixed(1)}px`,d.style.top=`${Math.max(6,c.top+c.height*.08).toFixed(1)}px`,d.innerHTML=n==="heal"?`+${w(t)}`:`-${w(t)}`,n==="poison"&&Number(o.burstCount)>1){let l=Math.max(1,Number(o.burstCount)||1),g=Math.min(2.2,1+(l-1)*.12);d.style.fontSize=`calc(1.22rem * ${g.toFixed(2)})`}W(d,760)}function Jt(e,t){let n=A(e),a=A(t);if(!n||!a)return;let{attackerRect:r,startX:o,startY:s,endX:c,endY:d,angle:l}=We(n,a),g=Math.max(70,r.height*.92),m=Math.max(18,r.width*.2),f=r.width*.58,R=o+Math.cos(l)*f,y=s+Math.sin(l)*f,S=Math.max(22,r.width*.26),k=Y("sword-swing",e);k.innerHTML=oe(`
      ${[-.18,0,.18].map((P,M)=>{let F=R+Math.cos(l+Math.PI/2)*g*P,T=y+Math.sin(l+Math.PI/2)*g*P,I=`M ${F.toFixed(1)} ${(T-g*.34).toFixed(1)} Q ${(F+m).toFixed(1)} ${T.toFixed(1)} ${F.toFixed(1)} ${(T+g*.34).toFixed(1)}`,U=`rotate(${(l*180/Math.PI).toFixed(1)} ${F.toFixed(1)} ${T.toFixed(1)}) translate(${S.toFixed(1)} 0)`;return`<path class="sword-swing-belly sword-scratch-${M+1}" d="${I}" transform="${U}" /><path class="sword-swing-arc sword-scratch-${M+1}" d="${I}" transform="${U}" />`}).join("")}
  `),W(k,440)}function Vt(e,t){let n=A(e),a=A(t);if(!n||!a)return;let{attackerRect:r,startX:o,startY:s,angle:c}=We(n,a),d=Math.max(42,r.width*.5),l=o+Math.cos(c)*d,g=s+Math.sin(c)*d,m=Math.max(22,r.width*.28),f=Y("thorn-burst",e),R=[-.48,-.28,-.1,.1,.28,.48];f.innerHTML=oe(`
      ${R.map((y,S)=>{let k=c+y,P=m*(.74+S%2*.16),M=r.height*.82,F=l+Math.cos(c+Math.PI/2)*(S/(R.length-1)-.5)*M,T=g+Math.sin(c+Math.PI/2)*(S/(R.length-1)-.5)*M,I=F+Math.cos(k)*P,U=T+Math.sin(k)*P;return`<path class="thorn-spike" d="M ${F.toFixed(1)} ${T.toFixed(1)} L ${I.toFixed(1)} ${U.toFixed(1)}" />`}).join("")}
  `),W(f,520)}function so(e){let t=A(e);t&&ge(t,"is-shaking",360)}function la(e,t){let n=A(t);if(!n)return;let a=n.getBoundingClientRect(),r=a.left+a.width/2,o=a.top+a.height/2,s=Math.max(18,a.width*.18),c=Y("heal-effect",e,"heal");c.innerHTML=oe(`
      <circle class="heal-ring" cx="${r.toFixed(1)}" cy="${o.toFixed(1)}" r="${s.toFixed(1)}" />
      <circle class="heal-ring heal-ring-secondary" cx="${(r-s*.6).toFixed(1)}" cy="${(o+s*.16).toFixed(1)}" r="${(s*.72).toFixed(1)}" />
      <circle class="heal-ring heal-ring-tertiary" cx="${(r+s*.58).toFixed(1)}" cy="${(o-s*.14).toFixed(1)}" r="${(s*.58).toFixed(1)}" />
  `),W(c,620)}function da(e,t){let n=A(t);if(!n)return;let a=n.getBoundingClientRect(),r=a.left+a.width/2,o=Math.max(0,a.top-Math.min(170,window.innerHeight*.24)),s=a.top+a.height*.56,c=a.top+a.height*.26,d=Y("chaos-lightning is-thunderstrike",e),l=`M ${(r-12).toFixed(1)} ${o.toFixed(1)} L ${(r+10).toFixed(1)} ${(o+42).toFixed(1)} L ${(r-8).toFixed(1)} ${(o+42).toFixed(1)} L ${(r+7).toFixed(1)} ${(c+10).toFixed(1)} L ${(r-16).toFixed(1)} ${(c+10).toFixed(1)} L ${(r+4).toFixed(1)} ${s.toFixed(1)}`,g=`M ${(r+7).toFixed(1)} ${(c-4).toFixed(1)} L ${(r+34).toFixed(1)} ${(c+10).toFixed(1)} L ${(r+14).toFixed(1)} ${(c+18).toFixed(1)}`,m=`M ${(r-4).toFixed(1)} ${(c+22).toFixed(1)} L ${(r-35).toFixed(1)} ${(c+34).toFixed(1)} L ${(r-13).toFixed(1)} ${(c+43).toFixed(1)}`;d.innerHTML=oe(`
      <path class="chaos-thunder-border chaos-thunder-core" d="${l}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${g}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${m}" />
      <path class="chaos-thunder-core" d="${l}" />
      <path class="chaos-thunder-branch" d="${g}" />
      <path class="chaos-thunder-branch" d="${m}" />
  `),W(d,360)}function ua(e,t){let n=A(e),a=A(t);if(!n||!a)return;let r=n.getBoundingClientRect(),o=a.getBoundingClientRect(),s=r.left+r.width/2,c=r.top+r.height/2,d=o.left+o.width/2,l=o.top+o.height/2,g=Math.atan2(l-c,d-s),m=Math.max(24,Math.hypot(d-s,l-c)),f=Y("dark-spike",e);f.style.left=`${s}px`,f.style.top=`${c}px`,f.style.width=`${m}px`,f.style.setProperty("--dark-spike-angle",`${g}rad`),W(f,340)}function Qt(e,t){if(t==="poison"||t==="poison_apply")return ze.poison;if(t==="heal")return ze.heal;let n=Number(J(e)?.typeId);return ze[n]||ze.default}function en(e,t){!e||!t||(e.style.setProperty("--combat-color",t.color),e.style.setProperty("--combat-shadow",t.shadow),e.style.setProperty("--combat-text-outline",t.outline||"#fff"))}function Y(e,t,n){let a=document.createElement("div");return a.className=e,en(a,Qt(t,n)),a}function W(e,t,n=document.body){return n.appendChild(e),setTimeout(()=>e.remove(),V(t)),e}function oe(e){return`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">${e}</svg>`}function We(e,t){let n=e.getBoundingClientRect(),a=t.getBoundingClientRect(),r=n.left+n.width/2,o=n.top+n.height/2,s=a.left+a.width/2,c=a.top+a.height/2;return{attackerRect:n,targetRect:a,startX:r,startY:o,endX:s,endY:c,angle:Math.atan2(c-o,s-r)}}function tn(e){let t=e.entries||[],n=lt(e),a=new Map(n.map((s,c)=>[s,c])),r=!!e.isAoe||n.length>1,o=240;return Math.max(340,...t.map(s=>{if(s.effect==="heal"||s.effect==="last_breath")return 500;if(s.effect==="poison")return 380;if(s.effect==="poison_apply")return 460;if(s.effect==="shared_pain")return 320;let c=a.get(s)??0,d=r?c*70:0;return Ye(s).travel+d+o}))}function nn(e){Re.includes(e)&&(i.battleSpeed=e,localStorage.setItem(rt,String(e)),mt(),gt())}function mt(){document.documentElement.style.setProperty("--battle-animation-scale",String(an())),[24,34,36,48,80,150,240,320,340,360,440,520,620,760,960].forEach(e=>{document.documentElement.style.setProperty(`--battle-duration-${e}`,`${V(e)}ms`)})}function an(){return 1/(Number(i.battleSpeed)||1)}function V(e){return Math.max(0,Math.round((Number(e)||0)*an()))}function co(e){return`${Number(e)}x`}function gt(){document.querySelectorAll("[data-battle-speed]").forEach(e=>{let t=Number(e.dataset.battleSpeed)===i.battleSpeed;e.classList.toggle("active",t),e.classList.toggle("ad-primary-action",t),e.setAttribute("aria-pressed",t?"true":"false")})}function ma(e){return Number(J(e)?.typeId)===2}function A(e){let t=`.dungeon-demon-card[data-instance-id="${Gn(String(e))}"]`;return document.querySelector(`#teamGrid ${t}, #enemyGrid ${t}`)||document.querySelector(t)}function ge(e,t,n){let a=`${t}Timer`;e[a]&&clearTimeout(e[a]),e.classList.remove(t),e.offsetWidth,e.classList.add(t),e[a]=setTimeout(()=>{e.classList.remove(t),(t==="is-attacking"||t==="is-hit")&&e.classList.remove("is-player-attack","is-enemy-attack"),e[a]=null},V(n))}function rn(e,t){let n=e.entries[0],a=Number.isInteger(e.playbackIndex)?e.playbackIndex:t,r=ha(e),o=n.effect==="poison_apply"?"Poisoned":n.effect==="heal"?`${n.targetHp} HP`:e.isAoe?"AOE":`${n.targetHp} HP`;return`
    <div class="fight-log-row ${ba(n)}" data-log-index="${a}">
      <span class="text-secondary">T${n.tick}</span>
      <span class="fight-log-side">${ya(n)}</span>
      <span class="fight-log-action">${fa(e)}</span>
      <span class="fight-log-damage">${r}</span>
      <span class="text-secondary">${o}</span>
    </div>
  `}function je(e,t={}){let n=[],a=t.combineCounters===!0;for(let r of e||[]){let o=n[n.length-1],s=r.targeting==="all"||r.targeting==="cleave"?[...n].reverse().find(m=>m.isAoe&&m.tick===r.tick&&m.attacker===r.attacker):null,d=r.effect==="thorns"||a&&r.effect==="retaliate"?[...n].reverse().find(m=>m.tick===r.tick&&m.entries.some(f=>f.attacker===r.target&&f.target===r.attacker)):null,l=r.effect==="poison"&&o?.primaryEffect==="poison"&&o.tick===r.tick&&o.entries.every(m=>m.target===r.target),g=s||d||(l?o:null);if(g){g.entries.push(r);continue}n.push({tick:r.tick,attacker:r.attacker,isAoe:r.targeting==="all"||r.targeting==="cleave",primaryEffect:r.effect||null,entries:[r]})}if(!a){let r=je(e,{combineCounters:!0}),o=new Map;r.forEach((s,c)=>{s.entries.forEach(d=>o.set(d,c))}),n.forEach(s=>{s.playbackIndex=o.get(s.entries[0])})}return n}function ga(e){return e?`<span class="fight-log-position">${e==="front"?"Front":"Back"}</span>`:""}function fa(e){let t=e.entries[0],n=lt(e).length,a=qt(t.attacker),r=`${qt(t.target)} ${ga(t.targetPosition)}`;return t.effect==="poison_apply"?`${a} applied poison to ${r}`:t.effect==="poison"?`${r} took poison damage`:t.effect==="heal"?`${a} healed ${r}`:t.effect==="last_breath"?`${r} survived at 1 HP`:t.effect==="shared_pain"?"Surviving allies gained direct damage":t.effect==="chain_explosion"?`${a} exploded into ${r}`:t.effect==="retaliate"?`${a} retaliated against ${r}`:t.effect==="thorns"?`${a} reflected damage to ${r}`:t.knockback?`${a} crushed ${r} back`:t.targeting==="chaotic"?`${a} chaotically struck ${r}`:t.targeting==="cleave"?`${a} cleaved ${n} demons`:e.isAoe?`${a} splashed ${n} enemies`:`${a} ${pa(t)} ${r}`}function pa(e){return e.effect==="poison_apply"||e.effect==="poison"?"poisoned":e.effect==="heal"?"healed":e.effect==="last_breath"?"survived":e.effect==="shared_pain"?"empowered":e.effect==="chain_explosion"?"exploded into":e.effect==="retaliate"?"retaliated against":e.effect==="thorns"?"reflected damage to":e.targeting==="chaotic"?"chaotically struck":e.targeting==="cleave"?"cleaved":e.targeting==="all"?"splashed":"hit"}function ha(e){let t=e.entries[0],n=lt(e).length,a=e.entries.find(r=>r.effect==="retaliate"||r.effect==="thorns");if(t.effect==="poison_apply")return"poison";if(t.effect==="poison")return`${on(e)} poison`;if(t.effect==="heal")return`+${t.healing||0} hp`;if(t.effect==="last_breath")return"1 hp";if(t.effect==="shared_pain")return"+25% dmg";if(t.effect==="chain_explosion")return`${t.dmg||0} splash`;if(t.effect==="thorns")return`${t.dmg||0} thorns`;if(t.effect==="retaliate")return`${t.dmg||0} retaliation`;if(a){let r=a.effect==="thorns"?"thorns":"retaliation";return`${t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}, ${a.dmg} ${r}`}return t.knockback?`${t.dmg} dmg, push`:t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}function on(e){return(e.entries||[]).filter(t=>t.effect==="poison").reduce((t,n)=>t+(Number(n.dmg)||0),0)}function Ke(){return new Map([...(i.run?.team||[]).map(e=>[e.instanceId,{...e,side:"player"}]),...(i.run?.enemies||[]).map(e=>[e.instanceId,{...e,side:"enemy"}])])}function ba(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||re(e.attacker)==="player"?"is-player-action":"is-enemy-action"}function ya(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||re(e.attacker)==="player"?"You":"Enemy"}function re(e){return(i.run?.team||[]).some(t=>t.instanceId===e)?"player":(i.run?.enemies||[]).some(t=>t.instanceId===e)?"enemy":i.combatDemons.get(e)?.side?i.combatDemons.get(e).side:"unknown"}function J(e){return[...i.run?.team||[],...i.run?.enemies||[]].find(t=>t.instanceId===e)||i.combatDemons.get(e)||null}function qt(e){let t=[...i.run?.team||[],...i.run?.enemies||[]].find(n=>n.instanceId===e)||i.combatDemons.get(e);return t?`<span class="ad-${w(t.rarity)}">${w(t.species||"Demon")}</span>`:w(e)}var ka=(...e)=>h.getCollectionReinforcementLimit(...e),lo=(...e)=>h.getExplicitFormationRow(...e),uo=(...e)=>h.getRecruitTeamLimit(...e);var wa=(...e)=>h.getSelectedCollectionReinforcements(...e),cn=(...e)=>h.normalizeFormationRow(...e),mo=(...e)=>h.shouldShowCollectionMissingTag(...e);function ln(e,t={}){let n=t.side==="enemy"?"enemy":"player",a=go(e||[],n),r=t.gridStyle?` style="${w(t.gridStyle)}"`:"";return`
    <div class="battle-formation battle-formation-grid battle-formation-${n}"${r} role="list" aria-label="${n==="enemy"?"Enemy":"Your team"} formation">
      ${a.map((o,s)=>dn(o,s,t,n)).join("")}
    </div>
  `}function dn(e,t,n,a){let r=ft(t,a),o=ho(t,a),s=po[o]||"",c=t+1,d=n.side==="enemy"?"Enemy":"Your team",l=ko(n)?wo(r):"",g=!e&&vo(n,a),m=e?So(e,n):l||yo(r,c,{collectionTeamTrigger:g});return`
    <div class="formation-slot formation-lane formation-slot-${r} ${s} ${e?"has-demon":"is-empty"}" data-formation-position="${r}" data-formation-lane="${o}" data-formation-row="${t}" data-formation-slot="${t}" role="listitem" aria-label="${w(`${d} slot ${c}`)}">
      <div class="formation-lane-cards formation-slot-cards" data-formation-drop="${r}" data-formation-row="${t}">
        ${m}
      </div>
    </div>
  `}function go(e=[],t="player"){let n=Array.from({length:9},()=>null),a=[],r=[];return(e||[]).slice(0,9).forEach((o,s)=>{let c=lo(o),d=c!==null?ft(c,t):null,l={...o,position:d||Lo(o,s)};if(c!==null&&!n[c]&&ft(c,t)===l.position){n[c]=l;return}a.push({demon:l,preferredCell:cn(s)})}),a.forEach(({demon:o,preferredCell:s})=>{if(!n[s]&&ft(s,t)===o.position){n[s]=o;return}r.push(o)}),r.forEach(o=>{let s=fo(n,t,o.position);s>=0&&(n[s]=o)}),n}function fo(e,t="player",n=null){for(let a of bo(t,n))if(!e[a])return a;return e.findIndex(a=>!a)}function ft(e,t="player"){let n=cn(e)%3,a=t==="enemy"?0:2;return n===a?"front":"back"}var po={front:"frontline",mid:"middleline",back:"backline"};function ho(e,t="player"){let n=cn(e)%3,a=t==="enemy"?0:2,r=t==="enemy"?2:0;return n===a?"front":n===r?"back":"mid"}function bo(e="player",t=null){let n=e==="enemy"?0:2,a=1,r=e==="enemy"?2:0;return(e==="enemy"?t==="front"?[n,a]:t==="back"?[r,a]:[n,a,r]:t==="front"?[n]:t==="back"?[a,r]:[n,a,r]).flatMap(s=>Array.from({length:3},(c,d)=>d*3+s))}function yo(e,t,n={}){return n.collectionTeamTrigger?`
      <button class="formation-empty formation-empty-${e} collection-reinforcement-team-slot" type="button" data-slot-number="${t}" aria-label="Add a Collection demon to team slot ${t}" title="Add from collection">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </button>
    `:`
    <div class="formation-empty formation-empty-${e}" aria-hidden="true" data-slot-number="${t}">
      <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
    </div>
  `}function vo(e,t){return!!(t==="player"&&e.side==="player"&&i.isRecruiting&&i.run?.awaitingRecruit&&i.run?.collectionReinforcementAvailable&&(i.recruitDraftTeam||[]).length<uo()&&wa().length<ka())}function ko(e){return!!(i.isRecruiting&&e.side==="hand"&&i.run?.collectionReinforcementAvailable&&wa().length<ka())}function wo(e){return`
    <button class="dungeon-demon-card collection-reinforcement-placeholder ${i.collectionReinforcementPlaceholderInteracted?"":"is-collection-reinforcement-attention"}" type="button" data-collection-reinforcement-position="${e}" aria-label="Add from collection" title="Add from collection">
      <div class="collection-reinforcement-placeholder-icon">${L("plus",{size:48,strokeWidth:2.75})}</div>
    </button>
  `}function $o(e,t={}){let n=mo(e,t),a=[t.className||"",n?"is-new-encounter":""].filter(Boolean).join(" "),r=`${t.overlayHtml||""}${n?Po():""}`;return Hn(e,{...t,className:a,overlayHtml:r})}function So(e,t){let n=t.side==="player",a=t.side==="hand"&&!!t.isTeamUpgrade,r=!!(t.allowRecruitDrag&&e.recruitSource),o=!!(t.allowRewardDrag&&e.rewardCandidateKey),s=!!(i.isRecruiting&&n),c=!!((t.allowFormationDrag||i.isRecruiting)&&n),d=r||o||c,l=["dungeon-demon-card",r?"is-recruit-draggable":"",o?"is-reward-draggable":"",a?"is-team-upgrade":"",e.recruitSource==="collection"&&!i.collectionReinforcementStagedInteracted?"is-collection-reinforcement-attention":"",s?"is-recruit-drop-target":"",xo(e)?"is-poisoned":""].filter(Boolean).join(" ");return $o(e,{className:l.replace("dungeon-demon-card","").trim(),defeated:Number(e.hp)<=0,active:i.selectedSwapInstanceId===e.instanceId||i.selectedRecruitRewardId===e.rewardId||i.selectedRewardDemonKey===e.rewardCandidateKey,overlayHtml:`${a?un():""}${Ro(e)}`,attributes:{"data-instance-id":e.instanceId,"data-reward-id":e.rewardId||null,"data-reward-candidate-key":e.rewardCandidateKey||null,"data-recruit-source":e.recruitSource||null,role:"button",tabindex:"0",draggable:d}})}function un(){let e=L("arrow-up",{className:"dungeon-team-upgrade-arrow",size:14,strokeWidth:3.25});return`
    <span class="dungeon-team-upgrade-indicator" role="img" aria-label="Upgrade available" title="Upgrade available">
      ${e}${e}
    </span>
  `}function Ro(e){let t=$a(e);return t?`
    <div class="demon-status-strip" aria-label="Status effects">
      <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${t} stack${t===1?"":"s"}" title="Poisoned">
        <span class="demon-status-icon">${Co()}</span>
        ${t>1?`<span class="demon-status-count">${w(t)}</span>`:""}
      </span>
    </div>
  `:""}function Po(){return`
    <div class="new-encounter-badge" title="Missing from collection" aria-label="Missing from collection">
      New
    </div>
  `}function xo(e){return $a(e)>0}function $a(e){return(e.statusEffects?.poison||[]).length}function Co(){return L("poison")}function Lo(e,t=0){return e.position==="back"||!e.position&&t>0?"back":"front"}function Ra(e){if(!e||Number(e.spentPoints)<=0)return null;let t=e.bonuses||{},n=[[t.maxHpFlat,"max HP"],[t.attackFlat,"attack damage"],[t.speedFlat,"Speed"],[t.healingFlat,"healing"],[t.thornsFlat,"thorns damage"],[t.aoeDamageFlat,"AOE damage"],[t.poisonDamageFlat,"poison damage"]].filter(([o])=>Number(o)>0).map(([o,s])=>`+${Sa(o)} ${s}`),a=[[t.maxHpPercent,"max HP"],[t.attackPercent,"attack damage"],[t.speedPercent,"Speed"],[t.healingPercent,"healing"],[t.thornsPercent,"thorns"],[t.aoeDamagePercent,"AOE damage"],[t.poisonDamagePercent,"poison damage"]].filter(([o])=>Number(o)>0).map(([o,s])=>`+${Sa(o)}% ${s}`),r=[...n,...a];return{id:"account-level-power",name:"Level Power",description:r.join(", "),tooltip:["Level Power",...r].join(`
`),rarity:"account",icon:"sparkles",tags:["Permanent","Account"]}}function Sa(e){let t=Number(e)||0;return Number.isInteger(t)?String(t):t.toFixed(1).replace(/\.0$/,"")}var kd=window.AmongDemons.audio;var Pa=!1;function Bo(e){let t=String(e.rarity||"common").toLowerCase(),n=Ao(e),a=To(n),r=e.href?"a":"button",o=e.href?`href="${w(e.href)}"`:'type="button"',s=e.attention?"is-level-power-attention":"",c=e.expiresAt?"is-temporary":"";return`
    <${r}
      class="active-pact-chip is-${w(t)} ${s} ${c}"
      ${o}
      data-active-pact-id="${w(e.id)}"
      data-tooltip="${a}"
      aria-label="${a}"
    >
      <span class="active-pact-chip-icon" aria-hidden="true">
        ${L(e.icon||"sparkles",{size:28,strokeWidth:1.9})}
      </span>
    </${r}>
  `}function La(e=[],t={}){let n=[],a=new Map,r=t.onlySource?String(t.onlySource):"";return e.forEach(o=>{if(!o?.id)return;if(r&&String(o.source||"")!==r){n.push(o);return}let s=a.get(o.id);if(s){s.stackCount+=1;return}let c={...o,stackCount:1};a.set(o.id,c),n.push(c)}),n}function Ba(e,t={}){let n=Math.max(1,Math.trunc(Number(e?.stackCount)||1)),a=t.stackClass||"active-pact-stack",r=t.countClass||"active-pact-stack-count",o=n>1?{...e,tooltip:`${e.name||e.id}: ${Eo(e,n)}`}:e;return`
    <span class="${w(a)}">
      ${Bo(o)}
      ${n>1?`
        <span class="${w(r)}" aria-label="${n} stacks">${n}</span>
      `:""}
    </span>
  `}function Eo(e,t){let n=(Array.isArray(e?.effects)?e.effects:[]).filter(s=>String(s?.type||"").endsWith("_mult")).map(s=>Math.abs((Number(s.value)-1)*100)).filter(s=>Number.isFinite(s)&&s>0),a=String(e?.description||""),r=0,o=a.replace(/(\d+(?:\.\d+)?)%/g,(s,c)=>{let d=Number(c),l=n.findIndex(m=>Math.abs(m-d)<.001);if(l<0)return s;n.splice(l,1),r+=1;let g=d*t;return`${xa(g)}% (${t} x ${xa(d)}%)`});return r>0?o:`${a.replace(/\.$/,"")} (${t} copies).`}function xa(e){let t=Math.round((Number(e)||0)*100)/100;return Number.isInteger(t)?String(t):String(t).replace(/0+$/,"").replace(/\.$/,"")}function Ao(e={}){let t=e.tooltip||`${e.name||e.id}: ${e.description||""}`,n=Do(e);return[t,n].filter(Boolean).join(`
`)}function Do(e={}){let t=Date.parse(e.expiresAt||"");if(!Number.isFinite(t))return"";let n=Math.ceil((t-Date.now())/1e3);return n<=0?"Expired":`Expires in ${Mo(n)}`}function Mo(e){let t=Math.max(0,Math.floor(Number(e)||0)),n=Math.floor(t/86400),a=Math.floor(t%86400/3600),r=Math.floor(t%3600/60);return n>0?`${n}d ${a}h`:a>0?`${a}h ${r}m`:r>0?`${r}m`:`${t}s`}function To(e){return w(e).replace(/\n/g,"&#10;")}function Ea(){Pa||(Pa=!0,document.addEventListener("pointerover",e=>{let t=e.target.closest?.(".active-pact-chip");t&&pt(t)}),document.addEventListener("focusin",e=>{let t=e.target.closest?.(".active-pact-chip");t&&pt(t)}),document.addEventListener("click",e=>{let t=e.target.closest?.(".active-pact-chip");document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(n=>{n!==t&&n.classList.remove("is-tooltip-visible")}),t&&(pt(t),t.classList.add("is-tooltip-visible"))}),document.addEventListener("keydown",e=>{e.key==="Escape"&&document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(t=>{t.classList.remove("is-tooltip-visible")})}),window.addEventListener("resize",Ca),window.addEventListener("scroll",Ca,!0))}function Ca(){document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(pt)}function pt(e){if(!e)return;let t=e.getBoundingClientRect(),n=Math.min(384,window.innerWidth*.88),a=Fo(t.left+t.width/2,n/2+8,window.innerWidth-n/2-8),r=t.top>118,o=r?Math.max(8,t.top-8):Math.min(window.innerHeight-8,t.bottom+8);e.style.setProperty("--active-pact-tooltip-left",`${a}px`),e.style.setProperty("--active-pact-tooltip-top",`${o}px`),e.classList.toggle("is-tooltip-below",!r)}function Fo(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}var Io=window.AmongDemons.audio,No=window.AmongDemons.bagVisuals?.renderItemVisual||(()=>'<span class="bag-item-renderer bag-unknown-visual" aria-hidden="true"></span>');var _o=(...e)=>h.bindCollectionReinforcementPlaceholders(...e),Ho=(...e)=>h.bindDemonDetailCards(...e),Oo=(...e)=>h.bindFormationDragAndDrop(...e),zo=(...e)=>h.bindPointerDragAndDrop(...e),Go=(...e)=>h.bindRecruitDragAndDrop(...e),Vo=(...e)=>h.bindRewardDragAndDrop(...e),pn=(...e)=>h.canExtractRun(...e),Aa=(...e)=>h.formatBattleSpeed(...e),qo=(...e)=>h.getRecruitPreviewEnemyTeam(...e),Yo=(...e)=>h.getRecruitPreviewHand(...e),Wo=(...e)=>h.getRecruitPreviewTeam(...e),Da=(...e)=>h.applyDungeonCombatStatPreviewToDemon(...e),jo=(...e)=>h.getRecruitTeamLimit(...e),Ko=(...e)=>h.groupCombatLog(...e),qa=(...e)=>h.hasPendingBuffChoices(...e);var Uo=(...e)=>h.isExtractionUnlocked(...e),Xo=(...e)=>h.isCurrentFloorBattle(...e),Zo=(...e)=>h.pauseCombatPlayback(...e),Jo=(...e)=>h.playEnemyRevealEffect(...e),Qo=(...e)=>h.playPendingHandFlowAnimation(...e),ei=(...e)=>h.playRecruitSwapEffect(...e),Ya=(...e)=>h.renderButtonMeleeIcon(...e);var Ma=(...e)=>h.renderDemonCards(...e),ti=(...e)=>h.renderDungeonDemonCard(...e),ni=(...e)=>h.bindActivePactTooltips(...e),ai=(...e)=>h.getActiveBuffs(...e),ri=(...e)=>h.createLevelPowerBuff(...e),mn=(...e)=>h.renderDemonicPacts(...e),oi=(...e)=>h.toggleDemonicPactView(...e);var ii=(...e)=>h.renderFightLogRow(...e),si=(...e)=>h.renderHandBar(...e),ci=(...e)=>h.renderRewardBox(...e),hn=(...e)=>h.replayFight(...e),li=(...e)=>h.requestRecruitContinue(...e),di=(...e)=>h.resumeCombatPlayback(...e),ui=(...e)=>h.setBattleSpeed(...e),mi=(...e)=>h.skipCombatPlayback(...e),gi=(...e)=>h.startNewDungeonAfterDefeat(...e),Wa=(...e)=>h.startRun(...e),fi=(...e)=>h.stepCombatPlayback(...e);function bn(){let e=i.run,t=!!e;if(b.runLoading&&b.runLoading.classList.toggle("d-none",!i.isLoading),b.runEmpty.classList.toggle("d-none",i.isLoading||t),b.runPanel.classList.toggle("d-none",i.isLoading||!t),Li(),Pi(),i.isLoading){ue&&ue.disconnect(),i.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.fightLog.innerHTML="Opening the latest dungeon state...",b.fightLog.classList.add("text-muted"),mn(!1),Xe(),xe();return}if(!e){ue&&ue.disconnect(),b.runPanel?.querySelector(".dungeon-arena")?.classList.remove("is-hand-strategy"),b.dungeonBottomPanel?.classList.add("d-none"),i.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.dungeonHandBar?.classList.add("d-none"),b.dungeonRewardBox?.classList.add("d-none"),mn(!1),Fa(),Ia(),Na(),b.runEmpty.innerHTML=i.endSummary?pi():hi(),bi(),Ta(),Xe(),xe();return}let n=qa(e),a=!!(i.isRecruiting&&e.awaitingRecruit),r=b.runPanel?.querySelector(".dungeon-arena"),o=(a?Wo():e.team||[]).map(Da),s=a&&i.isEnemyPreviewDeferred?[]:a?qo():e.enemies||[],c=!!e.replayOnly,d=!!(i.isBattleAnimating||c),l=!!(i.isPactTeamPreview&&n),g=!!(!a&&d),m=(a?Yo():[]).map(Da),f=g?"battle":"recruit",R=!!(n&&!i.isPactRevealPending&&!i.isBattleAnimating&&!i.isResultAnimating),y=!!(n||i.isPactRevealPending),S=!0,k=!!(a&&!y),P=k,M=!!(!n&&!i.isResultAnimating&&pn()),F=_a(b.teamGrid),T=_a(b.enemyGrid),I=["player",e.awaitingRecruit?"recruit":"battle",i.isRecruiting?"interactive":"locked",n?"pacts":"ready"].join(":");b.dungeonBottomPanel?.classList.toggle("d-none",!S),(!M||i.isBattleAnimating||i.isResultAnimating)&&(i.isMobileRewardBoxOpen=!1),b.dungeonBottomPanel?.classList.toggle("is-battle-active",d||l),b.dungeonBottomPanel?.classList.toggle("is-mobile-reward-open",!!(i.isMobileRewardBoxOpen&&M&&!i.isBattleAnimating)),r?.classList.toggle("is-hand-strategy",a),ee(b.teamGrid,Ma(o,{side:"player",allowFormationDrag:e.status==="active"&&!y&&(!e.awaitingRecruit||i.isRecruiting),gridStyle:F}),{patchFormationGrid:!0,renderKey:I}),ee(b.enemyGrid,Ma(a||(e.team||[]).length?s:[],{side:"enemy",allowRecruitDrag:!1,gridStyle:T}),{patchFormationGrid:!0,renderKey:"enemy"}),si(m,S,k,f),ci(S,P,M),mn(R),Fa(a?o.length:null,a?jo():null),Ia(a?e.nextEnemyPressure:e.enemyPressure,a?e.nextEnemyBuffs:e.enemyBuffs,a?e.nextEnemyTeamBuffs:e.enemyTeamBuffs),Na(),Oo(),Go(),Vo(),zo(),_o(),Ho(),ni(),ei(),Jo(),xi(),Ta(),Xe(),xe(),Qo(a)}function pi(){let e=i.endSummary||{},t=e.demon,n=e.echo,a=e.outcome==="defeat";return`
    <div class="dungeon-end-screen ${a?"is-defeat":"is-extraction"}">
      <div class="dungeon-end-copy">
        <span class="dungeon-phase-eyebrow">${a?"Defeat":"Extraction"}</span>
        <h2>${w(e.title||"Run complete")}</h2>
        <p>${w(e.message||"Run extracted.")}</p>
      </div>
      ${t?`
        <div class="dungeon-end-demon" aria-label="Collected demon">
          ${ti(t,{className:"dungeon-end-demon-card",suppressCollectionMissingTag:!0,attributes:{"data-instance-id":t.instanceId||`end-${t.id||"demon"}`}})}
        </div>
      `:""}
      ${n?`
        <div
          class="dungeon-end-demon dungeon-end-echo"
          style="--item-rarity: ${w(Tt(n.rarity||"common"))}"
          aria-label="Extracted ${w(`${it(n.rarity||"common")} ${n.species||"Demon"} Echo`)}"
        >
          <span class="dungeon-end-echo-visual">
            ${No(n,{context:"slot"})}
          </span>
        </div>
      `:""}
      <div class="dungeon-end-rewards" aria-label="Rewards obtained">
        ${t?`<span>${L("stars")}${w(t.species||"Demon")}</span>`:""}
        ${n?`<span>${L("sparkles")}${w(`${it(n.rarity||"common")} ${n.species||"Demon"} Echo`)}</span>`:""}
        <span>${Number(e.xp)||0} XP</span>
        ${Mt(Number(e.souls)||0,{className:"soul-chip dungeon-end-soul-amount"})}
      </div>
      <div class="dungeon-end-actions">
        ${a?"":'<a class="btn btn-glass-muted" href="/camp">Leave</a>'}
        ${i.endedReplayRun?.lastBattle?.combatLog?.length?`
          <button class="btn btn-glass-muted btn-icon-only" id="replayEndedDungeonBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
            ${L("list-restart")}
          </button>
        `:""}
        ${a?`
          <a class="btn btn-glass-muted" id="trainDemonsBtn" href="/collection">
            ${L("swords")}
            Train Demons
          </a>
        `:`
          <a class="btn btn-glass-muted" href="/bag">
            ${L("amphora")}
            View Bag
          </a>
        `}
        <a class="btn btn-primary" href="/dungeon">
          ${L("play")}
          New Dungeon
        </a>
      </div>
    </div>
  `}function hi(){return`
    <img src="/app/images/demons/1.png" alt="Boof Nitza demon preparing for a dungeon run" width="1024" height="1024" loading="lazy" decoding="async">
    <p class="mb-0 text-muted">Ready to descend into the dungeon?</p>
    <button class="btn btn-primary dungeon-start-prompt-btn" id="startNewDungeonBtn" type="button">
      ${L("play")}
      Start Dungeon
    </button>
  `}function bi(){N(document.getElementById("startNewDungeonBtn"),async()=>{On(),await Wa(),bn()}),N(document.getElementById("replayEndedDungeonBtn"),hn)}function Ta(){let t=(i.combatLog.length?Ko(i.combatLog).map((n,a)=>`
      ${ii(n,a)}
    `).join(""):"")+Bi();if(!t.trim()){b.fightLog.innerHTML="Fight log will appear here after a battle.",b.fightLog.classList.add("text-muted");return}b.fightLog.classList.remove("text-muted"),b.fightLog.innerHTML=t}function ja(e,t={}){let n=document.querySelector(".battle-result-burst");n&&n.remove();let a=e==="defeat",r=t.syncActions!==!1,s=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?900:a?3e3:2200;i.isResultAnimating=!0,Io?.play(e==="victory"?"sfx.battle.victory":"sfx.battle.defeat",{volume:.96}),r&&(Xe(),xe());let c=document.createElement("div");return c.className=`battle-result-burst is-${e}`,c.style.setProperty("--battle-result-duration",`${s}ms`),c.setAttribute("role","status"),c.setAttribute("aria-live","polite"),c.innerHTML=`
    <div class="battle-result-burst-ring" aria-hidden="true"></div>
    ${a?'<div class="battle-result-burst-wound" aria-hidden="true"></div>':""}
    <div class="battle-result-burst-text">${e==="victory"?"Victory":"Defeat"}</div>
    ${a?'<div class="battle-result-burst-subtitle">Your demons have fallen</div>':""}
    <div class="battle-result-burst-sparks" aria-hidden="true">
      ${Array.from({length:a?16:14},()=>"<span></span>").join("")}
    </div>
  `,document.body.appendChild(c),new Promise(d=>{setTimeout(()=>{c.remove(),i.isResultAnimating=!1,r&&(Xe(),xe()),d()},s)})}function Fa(e=null,t=null){if(!b.teamSideTitle)return;let n=Number.isFinite(e)&&Number.isFinite(t)?`<span class="battle-side-count" aria-label="${e} of ${t} team slots used">${e}/${t}</span>`:"",a=yi();b.teamSideTitle.innerHTML=`
    <span>Your Team</span>
    ${n?` ${n}`:""}
    ${Ze(a,{side:"player"})}
  `}function Ia(e=null,t=[],n=[]){if(!b.enemySideTitle)return;let a=i.run?.enemyLabel||"Enemies";b.enemySideTitle.innerHTML=`
    <span>${w(a)}</span>
    ${wi(e)}
    ${$i(t)}
    ${Ze(n,{side:"enemy"})}
  `}function yi(e=i.run){if(!e)return[];let t=i.statPoints?ri(i.statPoints):null;return[...t?[t]:[],...ai(e)].filter(n=>n?.id||n?.name)}function Ze(e=[],t={}){let n=vi(e);if(!n.length)return"";let a=n.reduce((c,d)=>c+d.stackCount,0),r=t.side==="enemy"?"enemy":"player",o=t.label||"Buffs",s=`battle-${r}-buff-summary-tooltip`;return`
    <span
      class="enemy-pressure-chip battle-buff-summary-chip is-${r}-buffs"
      tabindex="0"
      aria-label="${w(`${o}, ${a} active`)}"
      aria-describedby="${s}"
    >
      ${L("sparkles")}
      <span>${w(o)}</span>
      <strong>${a}</strong>
      <span class="battle-buff-summary-tooltip" id="${s}" role="tooltip">
        ${n.map(ki).join("")}
      </span>
    </span>
  `}function vi(e=[]){let t=[],n=new Map;return(Array.isArray(e)?e:[]).forEach((a,r)=>{if(!a)return;let o=typeof a=="string"?{id:a,name:a,description:""}:a,s=String(o.id||o.name||`buff-${r+1}`),c=Math.max(1,Math.trunc(Number(o.stackCount)||1)),d=n.get(s);if(d){d.stackCount+=c;return}let l={...o,id:s,stackCount:c};n.set(s,l),t.push(l)}),t}function ki(e={}){let t=String(e.name||e.id||"Buff"),n=e.stackCount>1?` \xD7${e.stackCount}`:"",a=String(e.description||e.tooltip||"").trim(),r=a.startsWith(`${t}
`)?a.slice(t.length+1).trim():a;return`
    <span class="battle-buff-summary-row">
      <strong class="battle-buff-summary-name">${w(t)}${n}</strong>
      ${r?`<span class="battle-buff-summary-description">${w(r).replace(/\n/g,"<br>")}</span>`:""}
    </span>
  `}function wi(e=null){if(!e?.active)return"";let t=Ae(e.hpBonusPct),n=Ae(e.atkBonusPct),a=Ae(e.speedBonusPct),r=Math.max(0,Math.round(Number(e.level)||0));if(r<=0)return"";let o="battle-enemy-terror-tooltip";return`
    <span
      class="enemy-pressure-chip terror-pressure-chip"
      tabindex="0"
      aria-label="${w(`Terror ${r}. Enemy HP ${t}. Enemy Attack ${n}. Enemy Speed ${a}.`)}"
      aria-describedby="${o}"
    >
      <span>Terror</span>
      <strong>${w(String(r))}</strong>
      <span class="terror-pressure-tooltip" id="${o}" role="tooltip">
        <strong class="terror-pressure-title">Terror ${w(String(r))}</strong>
        <span class="terror-pressure-stat">Enemy HP ${t}</span>
        <span class="terror-pressure-stat">Enemy Attack ${n}</span>
        <span class="terror-pressure-stat">Enemy Speed ${a}</span>
      </span>
    </span>
  `}function $i(e=[]){let t=(Array.isArray(e)?e:[]).filter(Boolean);return t.length?t.map(Si).join(""):""}function Si(e={}){let t=String(e.name||e.id||"Boss Buff"),n=String(e.description||""),a=e.id==="rarity-convergence",r=a?[t,n,`Host HP ${Ae(e.hpBonusPct)}`,`Host Attack ${Ae(e.atkBonusPct)}`,`Host Speed ${Ae(e.speedBonusPct)}`].join(`
`):[t,n].filter(Boolean).join(`
`),o=Ri(r),s=a?` style="--enemy-buff-color: ${w(Tt(e.rarity||"common"))}"`:"";return`
    <span
      class="enemy-pressure-chip enemy-buff-chip${a?" is-rarity-convergence":""}"
      ${s}
      tabindex="0"
      data-tooltip="${o}"
      aria-label="${o}"
    >
      ${L(e.icon||"sparkles")}
      <span>${w(t)}</span>
    </span>
  `}function Ae(e){return`+${Math.max(0,Math.round(Number(e)||0))}%`}function Ri(e){return w(e).replace(/\n/g,"&#10;")}function Na(){if(!b.dungeonJoiner)return;let e=i.run?Math.max(1,Number(i.run.currentFloor)||1):null;b.dungeonJoiner.classList.remove("is-recruiting"),b.dungeonJoiner.innerHTML=`
    <div class="dungeon-center-actions" id="dungeonCenterActions"></div>
    ${e?`<span class="dungeon-floor-marker" aria-label="Current floor ${e}"><span>Floor</span><strong>${e}</strong></span>`:""}
  `,b.dungeonCenterActions=document.getElementById("dungeonCenterActions")}function Pi(){fe("combat")}function ht(){let e=document.getElementById("battleLogPanel")?.classList.contains("show");fe(e?"combat":"log")}function fe(e){let t=e==="log";document.getElementById("combatPanel")?.classList.toggle("show",!t),document.getElementById("combatPanel")?.classList.toggle("active",!t),document.getElementById("battleLogPanel")?.classList.toggle("show",t),document.getElementById("battleLogPanel")?.classList.toggle("active",t)}function xi(){ue&&ue.disconnect();let e=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards")),t=Array.from(document.querySelectorAll(".battle-side > #teamGrid, .battle-side > #enemyGrid"));if(!e.length&&!t.length)return;let n=new ResizeObserver(()=>gn());_n(n),e.forEach(a=>n.observe(a)),t.forEach(a=>n.observe(a)),document.querySelectorAll(".battle-side .dungeon-demon-card-image img").forEach(a=>{a.complete||a.addEventListener("load",gn,{once:!0})}),fn(),gn()}function gn(){fn(),requestAnimationFrame(()=>{fn();let e=[],t=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards"));if(t.forEach(a=>{let r=Array.from(a.querySelectorAll(".dungeon-demon-card"));if(a.classList.remove("is-compressed"),a.style.removeProperty("--dungeon-demon-card-width"),a.style.removeProperty("--dungeon-demon-card-height"),!r.length)return;let o=a.getBoundingClientRect();if(!(r[r.length-1].getBoundingClientRect().bottom>o.bottom+1||a.scrollHeight>a.clientHeight+1))return;let d=parseFloat(getComputedStyle(a).rowGap||getComputedStyle(a).gap)||0,l=getComputedStyle(a).flexDirection.startsWith("row"),g=l?o.height:(o.height-d*(r.length-1))/r.length,m=l?(o.width-d*(r.length-1))/r.length:g,f=Math.max(46,Math.min(148,g,m));e.push(f)}),!e.length)return;let n=Math.min(...e);t.forEach(a=>{a.style.setProperty("--dungeon-demon-card-width",`${n}px`),a.style.setProperty("--dungeon-demon-card-height",`${n}px`),a.classList.add("is-compressed")})})}function fn(){Array.from(document.querySelectorAll(".battle-side .battle-formation-grid")).forEach(t=>{let n=t.parentElement;if(!n)return;let a=n.getBoundingClientRect();if(a.width<=0||a.height<=0)return;let r=getComputedStyle(t),o=3,s=3,c=1,d=Ue(r.gap||r.rowGap||r.columnGap),l=Ue(r.paddingLeft)+Ue(r.paddingRight),g=Ue(r.paddingTop)+Ue(r.paddingBottom),m=(a.width-l-d*(o-1))/o,f=(a.height-g-d*(s-1))/(s*c),R=Math.max(42,Math.min(260,m,f));Number.isFinite(R)&&Ci(t,R,R*c)})}function _a(e){let t=e?.querySelector?.(".battle-formation-grid"),n=t?.style.getPropertyValue("--dungeon-demon-card-width"),a=t?.style.getPropertyValue("--dungeon-demon-card-height");return!n||!a?"":`--dungeon-demon-card-width: ${n}; --dungeon-demon-card-height: ${a};`}function Ci(e,t,n){let a=`${t}px`,r=`${n}px`;e.style.getPropertyValue("--dungeon-demon-card-width")!==a&&e.style.setProperty("--dungeon-demon-card-width",a),e.style.getPropertyValue("--dungeon-demon-card-height")!==r&&e.style.setProperty("--dungeon-demon-card-height",r)}function Ue(e){let t=parseFloat(e);return Number.isFinite(t)?t:0}function Li(){b.dungeonRewardStrip&&(b.dungeonRewardStrip.innerHTML="")}function Bi(){return i.endNotice?`<div class="${i.endNotice.type==="warning"?"fight-log-notice fight-log-end-notice text-warning":"fight-log-notice fight-log-end-notice text-success"}">${i.endNotice.html||w(i.endNotice.text)}</div>`:""}function Ha(e){return b.dungeonBottomControls?ee(b.dungeonBottomControls,e):!1}function yn(e,t){return`
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight" ${e?"":"disabled"}>
      ${L("list-restart")}
    </button>
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogToggleBtn" type="button" title="Fight Log" aria-label="Fight Log" ${t?"":"disabled"}>
      ${L("log")}
    </button>
  `}function Oa(e,t){return b.dungeonReplayLogBox?ee(b.dungeonReplayLogBox,yn(e,t)):!1}function Xe(){if(i.isLoading){za(),Ga({canReplay:!1,canViewLog:!1,canExtract:!1}),Ha(""),Oa(!1,!1);return}let e=i.run?.status==="defeated",t=!i.endSummary&&(!i.run||e||i.run.status==="ended"),n=!!(i.run&&!i.isResultAnimating&&i.isBattleAnimating&&i.combatPlayback),a=qa(i.run),r=!!(i.isPactTeamPreview&&a),o=!!(Xo(i.run)&&(i.run?.lastBattle?.combatLog?.length||i.combatLog.length)),s=!!(!i.isBattleAnimating&&!i.isResultAnimating&&!a&&o),c=s,d=!!(!a&&!i.isResultAnimating&&i.run?.awaitingRecruit&&i.isRecruiting),l=!!(!i.isBattleAnimating&&!i.isResultAnimating&&!a&&pn()),g=!!i.isRecruitContinuePending,m=!!i.isBattleAnimating,f={canFight:d||g||m,isPending:g,isFighting:m,canStart:t&&!!i.run,isDefeated:e,canReplay:s,canViewLog:c,canExtract:l};za(f);let R=Ga(f),y=r?wn():n?`${vn()}${kn()}${$n()}`:"",S=Ha(y),k=Oa(s,c);!S&&!k&&!R||(ot("[data-battle-speed]",P=>ui(Number(P.dataset.battleSpeed))),N(document.getElementById("battlePlaybackToggleBtn"),()=>{i.combatPlayback?.isPaused?di():Zo()}),ot("[data-battle-step]",P=>fi(Number(P.dataset.battleStep))),N(document.getElementById("battlePlaybackSkipBtn"),mi),N(document.getElementById("demonicPactReturnBtn"),oi),N(document.getElementById("fightLogReplayBtn"),hn),N(document.getElementById("fightLogToggleBtn"),ht))}function za(e={}){let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canStart:r=!1,isDefeated:o=!1}=e;if(r){ee(b.dungeonCenterActions,`
      <div class="dungeon-center-action-stack">
        <button class="btn btn-primary dungeon-fight-btn dungeon-center-start-btn" id="dungeonCenterStartBtn" type="button" title="${o?"Start a new dungeon":"Start the dungeon"}">
          ${L("play")}
          <span>${o?"New Dungeon":"Start Dungeon"}</span>
        </button>
      </div>
    `)&&N(document.getElementById("dungeonCenterStartBtn"),o?gi:Wa);return}let s=a?"fighting":n?"preparing":"ready",c=s!=="ready",d=s==="fighting"?"Fighting":s==="preparing"?"Preparing":"Fight",l=s==="fighting"?"Fight in progress":s==="preparing"?"Preparing the next fight":"Start the next fight";ee(b.dungeonCenterActions,t?`
    <div class="dungeon-center-action-stack">
      <span class="dungeon-fight-mark" aria-hidden="true">${Ya()}</span>
      <button
        class="btn btn-primary dungeon-fight-btn ${s==="preparing"?"is-loading":""} ${s==="fighting"?"is-fighting":""}"
        id="dungeonFightBtn"
        type="button"
        title="${l}"
        aria-label="${l}"
        ${c?'disabled aria-busy="true"':""}
      >
        ${s==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':""}
        <span>${d}</span>
      </button>
    </div>
  `:"")&&Ka()}function Ga(e={}){if(!b.dungeonMobileFightBox)return!1;if(i.isLoading)return ee(b.dungeonMobileFightBox,"");let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canReplay:r=!1,canViewLog:o=!1,canExtract:s=!1}=e,c=a?"fighting":n?"preparing":"ready",d=c!=="ready",l=c==="fighting"?"Fighting":c==="preparing"?"Preparing":"Fight",g=c==="fighting"?"Fight in progress":c==="preparing"?"Preparing the next fight":"Start the next fight",m=!!i.run,f=i.activeHandTab==="pacts"?"pacts":"hand",R=!!(i.isMobileRewardBoxOpen&&s),y=!m||a,S=Uo(i.run)?"Extract":"Win your first fight to unlock extraction",k=ee(b.dungeonMobileFightBox,`
    <button
      class="dungeon-mobile-nav-btn ${f==="hand"?"active":""}"
      id="dungeonMobileHandBtn"
      type="button"
      title="Hand"
      aria-label="Hand"
      aria-pressed="${f==="hand"?"true":"false"}"
      ${y?"disabled":""}
    >
      ${L("collection")}
      <span class="visually-hidden">Hand</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${f==="pacts"?"active":""}"
      id="dungeonMobileBuffsBtn"
      type="button"
      title="Buffs"
      aria-label="Buffs"
      aria-pressed="${f==="pacts"?"true":"false"}"
      ${y?"disabled":""}
    >
      ${L("stars")}
      <span class="visually-hidden">Buffs</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn"
      id="dungeonMobileReplayBtn"
      type="button"
      title="Replay Fight"
      aria-label="Replay Fight"
      ${r?"":"disabled"}
    >
      ${L("list-restart")}
      <span class="visually-hidden">Replay Fight</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn"
      id="dungeonMobileLogBtn"
      type="button"
      title="Fight Log"
      aria-label="Fight Log"
      ${o?"":"disabled"}
    >
      ${L("log")}
      <span class="visually-hidden">Fight Log</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${R?"active":""}"
      id="dungeonMobileExtractBtn"
      type="button"
      title="${S}"
      aria-label="${S}"
      aria-pressed="${R?"true":"false"}"
      ${s?"":"disabled"}
    >
      ${L("flag")}
      <span class="visually-hidden">Extract</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn dungeon-fight-btn dungeon-mobile-fight-btn ad-primary-action ${c==="preparing"?"is-loading":""} ${c==="fighting"?"is-fighting":""}"
      id="dungeonMobileFightBtn"
      type="button"
      title="${g}"
      aria-label="${g}"
      ${!t||d?"disabled":""}
      ${d?'aria-busy="true"':""}
    >
      ${c==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':Ya()}
      <span class="visually-hidden">${l}</span>
    </button>
  `);return k&&(Ei(),Ka()),k}function Ei(){N(document.getElementById("dungeonMobileHandBtn"),()=>Va("hand")),N(document.getElementById("dungeonMobileBuffsBtn"),()=>Va("pacts")),N(document.getElementById("dungeonMobileReplayBtn"),hn),N(document.getElementById("dungeonMobileLogBtn"),ht),N(document.getElementById("dungeonMobileExtractBtn"),Ai)}function Va(e){!i.run||i.isBattleAnimating||(i.activeHandTab=e==="pacts"?"pacts":"hand",bn())}function Ai(){i.isBattleAnimating||i.isResultAnimating||!pn()||(i.isMobileRewardBoxOpen=!i.isMobileRewardBoxOpen,bn())}function vn(){let e=i.combatPlayback||{},t=!!e.isPaused,n=Number(e.currentIndex)||0,a=Number(e.totalSteps)||0,r=n>0,o=n<a;return`
    <div class="battle-playback-control" role="group" aria-label="Battle playback">
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="-1"
        title="Last attack"
        aria-label="Last attack"
        ${r?"":"disabled"}
      >
        ${L("last-attack")}
      </button>
      <button
        class="battle-playback-btn ad-primary-action"
        id="battlePlaybackToggleBtn"
        type="button"
        title="${t?"Play":"Pause"}"
        aria-label="${t?"Play":"Pause"}"
      >
        ${L(t?"play":"pause")}
      </button>
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="1"
        title="Next attack"
        aria-label="Next attack"
        ${o?"":"disabled"}
      >
        ${L("next-attack")}
      </button>
    </div>
  `}function kn(){return`
    <div class="battle-speed-control" role="group" aria-label="Battle animation speed">
      ${Re.map(e=>`
        <button
          class="battle-speed-option ${i.battleSpeed===e?"active ad-primary-action":""}"
          type="button"
          data-battle-speed="${e}"
          aria-pressed="${i.battleSpeed===e?"true":"false"}"
          title="${Aa(e)} battle speed"
        >
          ${Aa(e)}
        </button>
      `).join("")}
    </div>
  `}function wn(){return`
    <div class="battle-speed-control demonic-pact-return-control" role="group" aria-label="Demonic Pact controls">
      <button
        class="battle-speed-option active ad-primary-action demonic-pact-return-option"
        id="demonicPactReturnBtn"
        type="button"
        title="Show Demonic Pacts"
        aria-label="Show Demonic Pacts"
      >
        ${L("sparkles")}
        <span>Show Pacts</span>
      </button>
    </div>
  `}function $n(){return`
    <div class="battle-playback-control battle-skip-control">
      <button
        class="battle-playback-btn battle-skip-btn"
        id="battlePlaybackSkipBtn"
        type="button"
        title="Skip to result"
        aria-label="Skip to result"
      >
        ${L("x")}
      </button>
    </div>
  `}function Ka(){[document.getElementById("dungeonFightBtn"),document.getElementById("dungeonMobileFightBtn")].forEach(e=>{!e||e.dataset.dungeonFightBound==="true"||(e.dataset.dungeonFightBound="true",N(e,t=>li(t.currentTarget)))})}var Ct=window.AmongDemons.api,he=window.AmongDemons.audio,Di=window.AmongDemons.ui.renderDemonCard,Mi=window.AmongDemons.ui.renderCombatStats,E=window.AmongDemons.ui.renderIcon||(()=>""),Qe=Object.freeze(["common","uncommon","rare","epic","legendary","mythic"]),De=2,Fe=20,Ua=Object.freeze({common:1,uncommon:2,rare:3,epic:4,legendary:5,mythic:7}),u={},Xa=new Set,q=!1,v=null,p=null,se=!1,$=null,kt=!1,Cn=0,Q=0,Me=null,bt=null,Za=0,Ln=new Set,Bn=[],Ja=null,et=0,yt=0,nt=null;Fn({...sn,battle:cr,getExplicitFormationRow:e=>ce(e?.formationSlot),normalizeFormationRow:e=>ce(e)??0,shouldShowCollectionMissingTag:()=>!1,getDemonPosition:Ps,renderDemonStatus:xs,renderDungeonCenterActions:Pr,renderFightLog:pr,renderFightLogActions:hr,renderRun:_});Es(Ti);async function Ti(){if(!window.AmongDemons.getToken()){window.location.href=window.AmongDemons.appUrl("/login?next=/ranked");return}Fi(),Ii(),Ea(),mt(),he?.setScene({music:"music.default"}),await Ni()}function Fi(){["rankedMessage","runLoading","runEmpty","runPanel","rankedBottomPanel","rankedHandStatus","rankedPreparation","dungeonHandBar","dungeonBottomControls","dungeonReplayLogBox","teamSideTitle","enemySideTitle","teamGrid","enemyGrid","dungeonCenterActions","fightLog","demonicPactOverlay","demonicPactViewToggle","rankedPactGrid","rankedEndRunModal","rankedEndRunEyebrow","rankedEndRunSummary","rankedEndRunFloor","rankedEndRunGain","rankedEndRunRating","rankedVictoryModal","rankedVictoryRankImage","rankedVictoryDivision","rankedVictoryRankGain","rankedVictorySummary"].forEach(e=>{u[e]=document.getElementById(e)})}function Ii(){document.addEventListener("click",async e=>{if(e.target.closest("[data-ranked-end-confirm]")){e.preventDefault(),await zi();return}let n=e.target.closest("[data-ranked-pact-scroll]");if(n){e.preventDefault(),Zi(n);return}let a=e.target.closest("[data-ranked-victory-action]");if(a){e.preventDefault(),await cs(a.dataset.rankedVictoryAction);return}let r=e.target.closest("[data-battle-speed]");if(r){e.preventDefault(),nn(Number(r.dataset.battleSpeed));return}let o=e.target.closest("[data-battle-step]");if(o){e.preventDefault(),Ut(Number(o.dataset.battleStep));return}if(e.target.closest("#battlePlaybackToggleBtn")){e.preventDefault(),i.combatPlayback?.isPaused?Kt():jt();return}if(e.target.closest("#battlePlaybackSkipBtn")){e.preventDefault(),Xt();return}if(e.target.closest("#fightLogReplayBtn, #rankedMobileReplayBtn")){e.preventDefault(),await Yi();return}if(e.target.closest("#fightLogToggleBtn, #rankedMobileLogBtn")){e.preventDefault(),ht();return}if(e.target.closest("#demonicPactViewToggle, #demonicPactReturnBtn")){e.preventDefault(),ns();return}let s=e.target.closest("[data-ranked-action]");if(s?.matches("button")){e.preventDefault(),await Qa(s,e);return}s&&(e.preventDefault(),await Qa(s,e))}),document.addEventListener("dragstart",e=>{let t=e.target.closest("[data-ranked-workspace-id]");if(!t||!e.dataTransfer||!p)return;let n=t.dataset.rankedWorkspaceId;kt=!0,Dn(n),e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/plain",n),t.classList.add("is-dragging")}),u.rankedEndRunModal?.addEventListener("hidden.bs.modal",()=>{Pt(!1)}),document.addEventListener("dragend",e=>{e.target.closest("[data-ranked-workspace-id]")?.classList.remove("is-dragging"),Cn=Date.now()+350,kt=!1,xt(),j()}),document.addEventListener("dragover",e=>{let t=St(e.target);t&&(e.preventDefault(),j(),t.classList.add("is-drag-over"))}),document.addEventListener("dragleave",e=>{let t=St(e.target);t&&!t.contains(e.relatedTarget)&&t.classList.remove("is-drag-over")}),document.addEventListener("drop",e=>{let t=St(e.target);if(!t)return;e.preventDefault();let n=e.dataTransfer?.getData("text/plain");n&&(kt=!1,xt(),$r(n,t,{x:e.clientX,y:e.clientY}))}),document.addEventListener("pointerdown",ks),document.addEventListener("pointermove",ws),document.addEventListener("pointerup",Ss),document.addEventListener("pointercancel",Rs),document.addEventListener("keydown",e=>{let t=e.target.closest(".dungeon-demon-card[data-instance-id]");!t||!["Enter"," "].includes(e.key)||(e.preventDefault(),br(t))}),document.addEventListener("scroll",e=>{let t=e.target?.closest?.("[data-ranked-pact-scroll-viewport]");t&&fr(t.closest(".ranked-reserve-buffs-shell"))},{capture:!0,passive:!0}),window.addEventListener("resize",gr)}async function Ni(){Rn(!0);try{let[e]=await Promise.all([Ct("/api/ranked/bootstrap"),_i().catch(t=>(console.warn("Ranked upgrade previews will use current-card art.",t),null))]);e.player&&Mn(e.player),nt=e.rating||null,e.run?(Ne(e.run),e.run.status==="active"&&e.run.phase==="result"&&!e.run.awaitingVictoryChoice&&await sr()):(i.run=null,v=null),Rn(!1),_(),v?.awaitingVictoryChoice&&yr(v)}catch(e){Rn(!1),At(e)}}async function _i(){return Me||(bt||(bt=Ct("/api/game/catalog?v=20260722-request-optimization-v1").then(e=>(Me={types:e?.types||{},demons:Array.isArray(e?.demons)?e.demons:[]},Me)).catch(e=>{throw bt=null,e})),bt)}async function Hi(){let e=await dr("/api/ranked/start",{});e?.run&&Ne(e.run)}async function Qa(e,t=null){if(q)return;let n=e.dataset.rankedAction;if(n==="start")return Hi();if(v){if(n==="reroll")return Vi(Bt(t,e));if(n==="lock-hand")return qi();if(n==="fight")return cr();if(n==="continue")return sr();if(n==="end")return Oi();if(n==="pact")return Gi(e.dataset.buffId)}}function Oi(){if(!v||!u.rankedEndRunModal||!window.bootstrap?.Modal)return;let e=Math.max(1,Number(v.floor)||1),t=Number(v.rating?.projectedRunDelta??v.rating?.runDelta)||0,n=Math.max(0,Number(v.rating?.projectedEnd??v.rating?.rating)||0);u.rankedEndRunEyebrow&&(u.rankedEndRunEyebrow.textContent=`Concede \xB7 Floor ${C(e)}`),u.rankedEndRunSummary&&(u.rankedEndRunSummary.textContent=`Ending now calculates your final rank from reaching Floor ${C(e)} and retires this temporary roster.`),u.rankedEndRunFloor&&(u.rankedEndRunFloor.textContent=C(e)),u.rankedEndRunGain&&(u.rankedEndRunGain.textContent=xr(t),u.rankedEndRunGain.classList.toggle("is-negative",t<0)),u.rankedEndRunRating&&(u.rankedEndRunRating.textContent=C(n)),Pt(!1),window.bootstrap.Modal.getOrCreateInstance(u.rankedEndRunModal).show()}async function zi(){if(q||!v||v.status!=="active")return;if(Pt(!0),(await Ie("end",{}))?.run?.status==="ended"){window.bootstrap?.Modal.getOrCreateInstance(u.rankedEndRunModal)?.hide();return}Pt(!1)}function Pt(e){let t=u.rankedEndRunModal;if(!t)return;t.querySelectorAll("button").forEach(a=>{a.disabled=!!e});let n=t.querySelector("[data-ranked-end-confirm]");n?.classList.toggle("is-busy",!!e),n?.setAttribute("aria-busy",e?"true":"false")}async function Ie(e,t){let n=await dr(`/api/ranked/runs/${encodeURIComponent(v.runId)}/${e}`,t);return n?.player&&Mn(n.player,{animate:!0}),n?.run&&(Ne(n.run),n.rewards?.souls&&He(`Floor ${Fe} cleared. ${n.rewards.souls} Souls awarded.`,"success")),n}async function sr(){let e=await Ie("continue",{});e?.run?.phase==="selection"&&e.run.floor>Fe&&He("Endless floor unlocked.","success")}async function Gi(e){let t=await Ie("pact",{buffId:e});if(t?.run&&(he?.play("sfx.dungeon.pactChoose",{volume:.9}),!t.run.pendingPact&&et>0)){let n=et;et=0,window.requestAnimationFrame(()=>Ls(n))}return t}async function Vi(e){if(!wr()||q)return;let t=await Ie("reroll",{lineup:vr(),lockHand:!!v.handLocked});if(!t?.run)return;let n=Math.max(0,Number(t.rerollCost)||De);Et(e,-n),he?.play("sfx.dungeon.pactReroll",{volume:.86})}async function cr(){if(!(!kr()||q||i.isBattleAnimating)){et=0,_e(!0),se=!0;try{let e=await Ct(`/api/ranked/runs/${encodeURIComponent(v.runId)}/battle`,ur({lineup:vr(),lockHand:!!v.handLocked}));if(!e?.run?.lastBattle)return;let t=e.rSoulInterest;Ne(e.run,{render:!1}),Number(t?.earned)>0&&(Q=Math.max(0,Number(t.balanceBefore)||0));let n=e.run.lastBattle;lr(n),fe("combat"),_(),await ct(),await ss(n.winner),Ne(e.run,{render:!1});let a=[];e.rewards?.souls&&(a.push(`Victory milestone: ${e.rewards.souls} Souls awarded.`),e.player&&Mn(e.player,{animate:!0})),Number(t?.earned)>0&&(et=Math.max(0,Number(t.earned)||0)),He(a.length?a.join(" "):"","success"),e.run.awaitingVictoryChoice&&yr(e.run,{rankGain:e.rankGain})}catch(e){At(e)}finally{se=!1,_e(!1),_()}}}function qi(){if(!v||!En(v))return;let e=!v.handLocked;v.handLocked=e,i.run.handLocked=e,_()}async function Yi(){let e=v?.lastBattle;if(!(q||i.isBattleAnimating||!e?.combatLog?.length)){se=!0,_e(!0);try{lr(e),fe("combat"),_(),u.fightLog.innerHTML="",u.fightLog.classList.remove("text-muted"),await ct(),Ne(v,{render:!1})}catch(t){At(t)}finally{se=!1,_e(!1),_()}}}function lr(e){i.run.team=K(e.playerTeamBefore||i.run.team||[]),i.run.active=i.run.team,i.run.enemies=K(e.enemyTeamBefore||i.run.enemies||[]),i.combatLog=e.combatLog||[],i.combatDemons=Ke()}async function dr(e,t){_e(!0);try{return await Ct(e,ur(t))}catch(n){return At(n),null}finally{_e(!1)}}function ur(e){let t=Bs();return{method:"POST",headers:{"Idempotency-Key":t},body:{...e,actionId:t}}}function Ne(e,t={}){xt(),v=e,nt=e.rating||nt,Q=Math.max(0,Math.floor(Number(e.rSouls)||0));let n=e.lastBattle;p=En(e)?ds(e):null,i.run={...e,team:K(p?.active||e.active||e.team),active:K(p?.active||e.active||e.team),reserve:K(p?.reserve||e.reserve),enemies:e.phase==="result"&&n?K(n.enemyTeamAfter):K(e.enemies)},i.combatLog=n?.combatLog||[],i.combatDemons=Ke(),t.render!==!1&&_(),os(e.combinationEvents||[])}function _(){us();let e=i.run,t=!!e;if(u.runEmpty.classList.toggle("d-none",t||i.isLoading),u.runPanel.classList.toggle("d-none",!t||i.isLoading),u.rankedBottomPanel.classList.toggle("d-none",!t||i.isLoading),!t){fe("combat"),u.runEmpty.innerHTML=rs();return}if((e.status==="ended"||e.phase==="ended")&&!se){fe("combat"),u.runPanel.classList.add("d-none"),u.rankedBottomPanel.classList.add("d-none"),u.runEmpty.classList.remove("d-none"),u.runEmpty.innerHTML=as(e),tr([]);return}let n=se||i.isBattleAnimating,a=n,r=!!(i.isPactTeamPreview&&e.pendingPact&&!a),o=a||r,s=!!(!o&&(e.lastBattle?.combatLog?.length||i.combatLog?.length));u.enemyGrid.closest(".battle-side")?.classList.toggle("is-ranked-reserve",!a),u.rankedBottomPanel.classList.toggle("is-ranked-combat",o),u.rankedBottomPanel.classList.remove("has-fight-review"),u.rankedBottomPanel.classList.toggle("is-battle-active",n),u.dungeonHandBar.classList.toggle("d-none",!o),u.dungeonHandBar.classList.toggle("is-battle-controls-mode",o),u.dungeonReplayLogBox.classList.add("d-none"),a||fe("combat"),Wi(e),Ki(e,a),Pr(),u.teamGrid.innerHTML=ln(e.team||e.active||[],{side:"player",allowFormationDrag:!a&&!e.pendingPact}),u.enemyGrid.innerHTML=a?ln(e.enemies||[],{side:"enemy"}):Xi(e.reserve||[],e),u.rankedPreparation.classList.toggle("d-none",a||r||e.phase==="preparation"&&i.isBattleAnimating);let c=!u.rankedPreparation.classList.contains("d-none"),d=Math.max(0,Math.min(3,Number(e.lives)||0)),l=Array.from({length:3},(g,m)=>`
      <span class="ranked-life-heart ${m<d?"is-active":"is-empty"}">\u2665</span>
    `).join("");u.rankedHandStatus.classList.toggle("d-none",!c),u.rankedHandStatus.setAttribute("aria-label",`${d} of 3 lives, ${C(Q)} Ranked Souls`),u.rankedHandStatus.innerHTML=c?`
      <span class="ranked-lives" aria-hidden="true">${l}</span>
      <span class="ranked-hand-status-separator" aria-hidden="true">&middot;</span>
      ${ji(e)}
    `:"",u.rankedPreparation.innerHTML=a||r?"":Qi(e,{canReviewFight:s}),hr(),pr(),tr(e.pacts?.pendingChoices||[]),is(),ms(),gs(),gr()}function Wi(e){let t=e.rating?.division||"Bronze II",n=at(t),a=Array.isArray(e.team)?e.team:e.active||[],r=Math.max(1,Number(e.capacities?.active)||6),o=Math.min(r,a.length),s=`${o}/${r}`,c=`
    <span class="battle-side-count" aria-label="${x(`${o} of ${r} team slots used`)}">
      ${x(s)}
    </span>
  `;u.teamSideTitle.innerHTML=`
    <span class="ranked-desktop-status">
      ${Pn(n,{showLabel:!0})}
      ${c}
    </span>
    <span class="ranked-mobile-status">
      ${Pn(n,{showLabel:!0,compact:!0})}
      ${c}
    </span>
    ${Ze(mr(e),{side:"player"})}
  `}function ji(e){let t=Math.max(1,Number(e?.floor)||1),n=Math.floor(Q/10),a=t+n;return`
    <span class="ranked-rsoul-balance" tabindex="0" aria-describedby="rankedRSoulTooltip">
      ${E("soul")}
      <span class="ranked-rsoul-value">${C(Q)}</span>
      <span class="ranked-rsoul-tooltip" id="rankedRSoulTooltip" role="tooltip">
        <span class="ranked-rsoul-tooltip-main">
          <strong>Interest:</strong>
          ${E("soul")}
          <strong>${C(a)}</strong>
        </span>
        <span class="ranked-rsoul-tooltip-formula">Floor number + 1 every 10 souls</span>
      </span>
    </span>
  `}function Ki(e,t){if(!t){u.enemySideTitle.innerHTML="<span>Reserve</span>";return}let n=e.opponent?.generated?"Ranked Rival":e.opponent?.hunterName||"Opponent",a=at(e.opponent?.division);u.enemySideTitle.innerHTML=`
    <span>${x(n)}</span>
    ${e.opponent?.division?Pn(a,{showLabel:!0,compact:!0}):""}
    ${Ze(e.lastBattle?.enemyBuffs||[],{side:"enemy"})}
  `}function at(e="Bronze III"){let t=String(e||"Bronze III").trim().toLowerCase(),n=t.replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),a=["bronze","silver","gold","platinum","diamond","demonic"].find(r=>t.startsWith(r))||"bronze";return{division:String(e||"Bronze III"),slug:n,tier:a,imageUrl:`/app/images/assets/ranks/${a}.svg`}}function Pn(e,t={}){let n=t.compact?" is-compact":"",a=Number.isFinite(t.occupiedSlots)&&Number.isFinite(t.maxSlots),r=a?`${Math.max(0,t.occupiedSlots)}/${Math.max(1,t.maxSlots)}`:"";return`
    <span class="ranked-rank ranked-rank--${x(e.slug)}${n}"
          aria-label="${x(e.division)} rank">
      <img class="ranked-rank-image" src="${x(e.imageUrl)}" alt="" width="72" height="80" aria-hidden="true">
      ${t.showLabel?`<span class="ranked-rank-label rank-division-text rank-division-text--${x(e.slug)}">${x(e.division.toUpperCase())}</span>`:""}
      ${a?`
        <span class="ranked-rank-separator" aria-hidden="true">&middot;</span>
        <span class="ranked-team-slots" aria-label="${x(`${r} team slots occupied`)}">${x(r)}</span>
      `:""}
    </span>
  `}function mr(e){let t=e.lockedBonuses||{},n=Object.values(t.allocations||{}).reduce((s,c)=>s+Math.max(0,Number(c)||0),0),a=Ra({spentPoints:n,bonuses:t.skillBonuses||{}}),r=La(Array.isArray(e.pacts?.activeBuffs)?e.pacts.activeBuffs:[]),o=(Array.isArray(t.activeBuffs)?t.activeBuffs:[]).filter(s=>s?.source!=="skill_tree");return[...a?[a]:[],...r,...o].filter(s=>s?.id)}function Ui(e){return Ba(e,{stackClass:"ranked-pact-stack",countClass:"ranked-pact-stack-count"})}function Xi(e,t){let n=Array.from({length:t.capacities.reserve},()=>null),a=[];e.forEach(o=>{let s=pe(o.reserveSlot);s!==null&&!n[s]?n[s]=o:a.push(o)}),a.forEach(o=>{let s=n.findIndex(c=>!c);s>=0&&(n[s]=o)});let r=mr(t);return`
    <div class="ranked-reserve-panel">
      <div class="battle-formation battle-formation-grid battle-formation-player ranked-reserve-formation"
           data-ranked-zone="reserve" role="list" aria-label="Reserve">
        ${n.map((o,s)=>dn(o,s,{side:"player",allowFormationDrag:!0},"player")).join("")}
      </div>
      ${r.length?`
        <div class="ranked-reserve-buffs-shell">
          <button class="ranked-pact-scroll-btn is-previous" type="button" data-ranked-pact-scroll="-1"
                  aria-label="Scroll active buffs left" title="Scroll active buffs left" hidden disabled>
            ${E("chevron-left")}
          </button>
          <div class="ranked-reserve-buffs-viewport" data-ranked-pact-scroll-viewport tabindex="0"
               role="region" aria-label="Active Ranked Pacts, Skill Tree bonuses, and buffs">
            <div class="dungeon-hand-pacts ranked-reserve-buffs">
              ${r.map(Ui).join("")}
            </div>
          </div>
          <button class="ranked-pact-scroll-btn is-next" type="button" data-ranked-pact-scroll="1"
                  aria-label="Scroll active buffs right" title="Scroll active buffs right" hidden disabled>
            ${E("chevron-right")}
          </button>
        </div>
      `:""}
    </div>
  `}function Zi(e){let n=e.closest(".ranked-reserve-buffs-shell")?.querySelector("[data-ranked-pact-scroll-viewport]");if(!n||e.disabled)return;let a=n.querySelector(".ranked-reserve-buffs"),r=a?.querySelector(".ranked-pact-stack"),o=a?window.getComputedStyle(a):null,s=parseFloat(o?.columnGap||""),c=parseFloat(o?.gap||""),d=Number.isFinite(s)?s:Number.isFinite(c)?c:0,l=r?.getBoundingClientRect().width||0,g=Number(e.dataset.rankedPactScroll)||0,m=Math.max(l+d,n.clientWidth*.72,1);n.scrollBy({left:g*m,behavior:"smooth"})}function gr(){yt&&window.cancelAnimationFrame(yt),yt=window.requestAnimationFrame(()=>{yt=0,fr()})}function fr(e=null){let t=e?[e]:Array.from(u.enemyGrid?.querySelectorAll(".ranked-reserve-buffs-shell")||[]),n=window.matchMedia("(max-width: 1199.98px)").matches;t.forEach(a=>{let r=a?.querySelector("[data-ranked-pact-scroll-viewport]"),o=Array.from(a?.querySelectorAll("[data-ranked-pact-scroll]")||[]);if(!r||!o.length)return;!n&&r.scrollLeft&&(r.scrollLeft=0);let s=Math.max(0,r.scrollWidth-r.clientWidth),c=n&&s>1,d=r.scrollLeft<=1,l=r.scrollLeft>=s-1;a.classList.toggle("has-scroll-overflow",c),a.classList.toggle("is-scroll-start",c&&d),a.classList.toggle("is-scroll-end",c&&l),o.forEach(g=>{let f=(Number(g.dataset.rankedPactScroll)||0)<0?d:l;g.hidden=!c||f,g.disabled=!c||f})})}function Ji(e,t={}){let n=Mi?.(e,{hideHpBar:!0})||"";return Di(e,{className:"ranked-preparation-demon-card",showStats:!1,overlayHtml:n?`<div class="ranked-preparation-stats" aria-label="Combat stats">${n}</div>`:"",attributes:{"data-instance-id":e.instanceId,...t.zone!=="enemy"?{"data-ranked-workspace-id":e.instanceId,"data-ranked-zone":t.zone,draggable:t.interactive?"true":"false",role:"button",tabindex:t.interactive?"0":"-1"}:{}}})}function Qi(e,t={}){let n=p?.hand||[],a=!!t.canReviewFight,r=wr()&&!q,o=kr()&&!q,s=`Reroll hand for ${De} Ranked Souls`,c=e.handLocked?"Unlock hand for the next floor":"Lock hand for the next floor",d=es(e.handLocked);return`
    <div class="ranked-reroll-rail">
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-reroll-action" type="button" data-ranked-action="reroll"
              title="${s}" aria-label="${s}" ${r?"":"disabled"}>
        <span class="ranked-reroll-main">
          <span class="ranked-reroll-icon" aria-hidden="true">${E("refresh-cw")}</span>
          <span class="ranked-reroll-copy">
            <strong>Reroll</strong>
          </span>
        </span>
        <span class="ranked-reroll-cost" aria-label="${De} Ranked Souls">
          ${E("soul")} <strong>${C(De)}</strong>
        </span>
      </button>
      ${er(e)}
    </div>
    <div class="ranked-offer-area" data-ranked-drop-zone data-ranked-zone="hand" aria-label="Hand">
      <div class="ranked-offer-grid">
        ${n.length?n.map((l,g)=>`
            <div class="ranked-offer ${!l._rankedPurchased&&Te(l)>Q?"is-unaffordable":""}"
                 data-ranked-drop-zone data-ranked-zone="hand" data-ranked-index="${g}">
              ${Ji(l,{interactive:!0,zone:"hand"})}
              <span class="ranked-offer-cost ${l._rankedPurchased?"is-purchased":""}"
                    aria-label="${l._rankedPurchased?"Purchased":`${Te(l)} Ranked Souls`}">
                ${l._rankedPurchased?E("check"):E("soul")}
                ${l._rankedPurchased?"":`<span>${C(Te(l))}</span>`}
              </span>
            </div>
          `).join(""):'<div class="ranked-hand-empty">Empty</div>'}
      </div>
      <div class="ranked-hand-sale-prompt" aria-hidden="true" hidden>
        <strong>Sell Demon</strong>
        <span>Drop team or reserve demon here</span>
      </div>
    </div>
    <div class="ranked-action-dock has-end-run">
      <button class="btn ${e.handLocked?"btn-success":"btn-outline-light"} ranked-side-action ranked-side-action-compact ranked-lock-action"
              type="button" data-ranked-action="lock-hand" aria-pressed="${e.handLocked?"true":"false"}"
              title="${c}" aria-label="${c}">
        ${d} <span>${e.handLocked?"Locked":"Lock Hand"}</span>
      </button>
      <div class="ranked-review-actions" role="group" aria-label="Previous fight">
        ${yn(a,a)}
      </div>
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-end-run-control"
              type="button" data-ranked-action="end" title="Concede Ranked run" aria-label="Concede Ranked run">
        ${E("flag")} <span>End Run</span>
      </button>
    </div>
    <button class="btn btn-primary btn-lg ranked-side-action ranked-fight-action" type="button" data-ranked-action="fight"
            title="Start Ranked fight" aria-label="Start Ranked fight" ${o?"":"disabled"}>
      ${E("swords")} <span>Fight</span>
    </button>
    <div class="ranked-mobile-nav has-end-run" role="group" aria-label="Ranked preparation controls">
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-reroll-btn" type="button" data-ranked-action="reroll"
              title="${s}" aria-label="${s}" ${r?"":"disabled"}>
        <span class="ranked-mobile-reroll-icon" aria-hidden="true">${E("refresh-cw")}</span>
        <span class="ranked-mobile-reroll-cost" aria-hidden="true">
          ${E("soul")} <strong>${C(De)}</strong>
        </span>
        <span class="visually-hidden">Reroll</span>
      </button>
      <details class="ranked-mobile-odds">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Reroll rarity odds" aria-label="Reroll rarity odds">
          ${E("info")}
          <span class="visually-hidden">Reroll rarity odds</span>
        </summary>
        <div class="ranked-mobile-odds-popover">
          ${er(e)}
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ${e.handLocked?"active":""}" type="button"
              data-ranked-action="lock-hand" title="${c}" aria-label="${c}"
              aria-pressed="${e.handLocked?"true":"false"}">
        ${d}
        <span class="visually-hidden">${e.handLocked?"Unlock hand":"Lock hand"}</span>
      </button>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" id="rankedMobileReplayBtn" type="button"
              title="Replay Fight" aria-label="Replay Fight" ${a?"":"disabled"}>
        ${E("list-restart")}
        <span class="visually-hidden">Replay Fight</span>
      </button>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" id="rankedMobileLogBtn" type="button"
              title="Fight Log" aria-label="Fight Log" ${a?"":"disabled"}>
        ${E("log")}
        <span class="visually-hidden">Fight Log</span>
      </button>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-end-action" type="button"
              data-ranked-action="end" title="Concede Ranked run" aria-label="Concede Ranked run">
        ${E("flag")}
        <span class="visually-hidden">End Run</span>
      </button>
      <button class="dungeon-mobile-nav-btn dungeon-mobile-fight-btn ranked-mobile-nav-btn ad-primary-action"
              type="button" data-ranked-action="fight" title="Start Ranked fight" aria-label="Start Ranked fight"
              ${o?"":"disabled"}>
        ${E("swords")}
        <span class="visually-hidden">Fight</span>
      </button>
    </div>
  `}function es(e){return E(e?"lock":"lock-open")}function er(e){let t=e?.rarityOdds||{};return`
    <div class="ranked-reroll-odds" aria-label="Reroll rarity odds per card">
      <span class="ranked-reroll-odds-grid">${Qe.map(a=>{let r=Math.max(0,Number(t[a])||0),o=tt(a);return`
      <span class="ranked-reroll-odd is-${a}${r<=0?" is-zero":""}"
            title="${x(o)}: ${C(r)}%"
            aria-label="${x(o)} ${C(r)} percent">
        <strong>${C(r)}%</strong>
      </span>
    `}).join("")}</span>
    </div>
  `}function pr(){if(u.fightLog){if(!i.combatLog?.length){u.fightLog.innerHTML="Fight log will appear here after a battle.",u.fightLog.classList.add("text-muted");return}u.fightLog.classList.remove("text-muted"),u.fightLog.innerHTML=je(i.combatLog).map((e,t)=>rn(e,t)).join("")}}function hr(){let e=i.run;if(!(!e||!u.dungeonBottomControls||!u.dungeonReplayLogBox)){if(u.dungeonReplayLogBox.innerHTML="",i.isPactTeamPreview&&e.pendingPact){Sn("pact",wn());return}if(i.isBattleAnimating){Sn("battle",`
      ${vn()}
      ${kn()}
      ${$n()}
    `),ts();return}Sn("empty","")}}function Sn(e,t){u.dungeonBottomControls.dataset.rankedControlMode!==e&&(u.dungeonBottomControls.innerHTML=t,u.dungeonBottomControls.dataset.rankedControlMode=e)}function ts(){let e=u.dungeonBottomControls,t=i.combatPlayback||{},n=Number(t.currentIndex)||0,a=Number(t.totalSteps)||0,r=!!t.isPaused,o=r?"Play":"Pause",s=e.querySelector('[data-battle-step="-1"]'),c=e.querySelector('[data-battle-step="1"]'),d=e.querySelector("#battlePlaybackToggleBtn");s&&(s.disabled=n<=0),c&&(c.disabled=n>=a),d&&d.getAttribute("aria-label")!==o&&(d.title=o,d.setAttribute("aria-label",o),d.innerHTML=E(r?"play":"pause")),gt()}function tr(e){let t=!!e?.length,n=t&&!i.isBattleAnimating&&!i.isLoading&&!se,a=!u.demonicPactOverlay.classList.contains("d-none");if(u.demonicPactOverlay.classList.toggle("d-none",!n),!n){i.isPactTeamPreview=!1,nr(),t||(u.rankedPactGrid.innerHTML="",delete u.rankedPactGrid.dataset.pactSignature);return}a||(i.isPactTeamPreview=!1);let r=e.map(o=>`${o.id}:${o.rarity||"common"}`).join("|");u.rankedPactGrid.dataset.pactSignature!==r&&(u.rankedPactGrid.innerHTML=e.map(o=>{let s=String(o.rarity||"common").toLowerCase();return`
        <button class="demonic-pact-card is-${x(s)}" type="button" data-ranked-action="pact" data-buff-id="${x(o.id)}">
          <span class="demonic-pact-icon" aria-hidden="true">${E(o.icon||"sparkles")}</span>
          <span class="demonic-pact-rarity ad-${x(s)}">${tt(s)}</span>
          <strong>${x(o.name||o.id)}</strong>
          <span class="demonic-pact-description">${x(o.description||"")}</span>
          <span class="demonic-pact-tags">${(o.tags||[]).map(c=>`<span>${x(c)}</span>`).join("")}</span>
        </button>
      `}).join(""),u.rankedPactGrid.dataset.pactSignature=r),nr(),a||he?.play("sfx.dungeon.pactReveal",{volume:.88})}function ns(){!u.demonicPactOverlay||u.demonicPactOverlay.classList.contains("d-none")||(i.isPactTeamPreview=!i.isPactTeamPreview,_())}function nr(){let e=!!i.isPactTeamPreview;u.demonicPactOverlay?.classList.toggle("is-team-preview",e),u.demonicPactViewToggle&&(u.demonicPactViewToggle.classList.toggle("d-none",e),u.demonicPactViewToggle.textContent="View Team",u.demonicPactViewToggle.setAttribute("aria-expanded",String(!e)))}function as(e){let t=Number(e.highestClearedFloor)||0,n=Math.max(t,Number(e.endReachedFloor??e.floor)||1),a=Math.max(0,Number(e.rating?.rating)||0),r=Number(e.rating?.runDelta)||0,o=at(e.rating?.division||"Bronze III"),s=e.endReason||(Number(e.lives)<=0?"defeated":"completed"),c=t>=Fe,d=c?"Ranked Victory":s==="conceded"?"Run Conceded":s==="defeated"?"Run Defeated":"Run Complete",l=c?"trophy":s==="defeated"?"skull":"flag",g=c?"Floor 20 was conquered and your climb has been recorded.":s==="conceded"?`Your final rank was calculated from reaching Floor ${C(n)}.`:"All three lives were lost. Your rank now reflects the floor you reached.",m=r>0?"is-positive":r<0?"is-negative":"is-neutral";return`
    <div class="ranked-end-card ranked-start-card ranked-results-card ranked-rank--${x(o.slug)} ${m}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">${x(e.season?.name||"Ranked Season")}</span>
      <span class="ranked-results-sigil" aria-hidden="true">${E(l)}</span>
      <h1>${x(d)}</h1>
      <p class="ranked-results-summary">${x(g)}</p>
      <div class="ranked-results-progress" aria-label="Run progress">
        <div><span>Reached</span><strong>Floor ${C(n)}</strong></div>
        <div><span>Cleared</span><strong>Floor ${C(t)}</strong></div>
        <div><span>Lives Left</span><strong>${C(e.lives||0)}</strong></div>
      </div>
      <div class="ranked-results-rank" aria-label="Final rank ${x(o.division)}, ${C(a)} Rank Points">
        <span class="ranked-results-emblem" aria-hidden="true">
          <img src="${x(o.imageUrl)}" alt="" width="112" height="124">
        </span>
        <span class="ranked-results-rank-copy">
          <small>Final Rank</small>
          <strong class="rank-division-text rank-division-text--${x(o.slug)}">${x(o.division.toUpperCase())}</strong>
          <span>${C(a)} RP</span>
        </span>
        <span class="ranked-results-delta ${m}">
          <small>Run Result</small>
          <strong>${xr(r)} RP</strong>
        </span>
      </div>
      <button class="btn btn-primary btn-lg ranked-results-action" type="button" data-ranked-action="start">
        ${E("trophy")} <span>Start New Run</span>
      </button>
    </div>
  `}function rs(){let e=nt?.division||"Bronze III",t=Math.max(0,Number(nt?.rating)||0),n=at(e);return`
    <div class="ranked-end-card ranked-start-card ranked-rank--${x(n.slug)}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">Seasonal Ranked</span>
      <h1>Draft. Adapt. Climb.</h1>
      <p class="ranked-start-summary">
        Build a temporary standardized roster, survive with three lives, and clear Floor ${Fe}.
      </p>
      <div class="ranked-start-rank" aria-label="Current rank ${x(n.division)}, ${C(t)} Rank Points">
        <span class="ranked-start-rank-eyebrow">Current Rank</span>
        <span class="ranked-start-rank-emblem" aria-hidden="true">
          <img src="${x(n.imageUrl)}" alt="" width="144" height="160">
        </span>
        <strong class="rank-division-text rank-division-text--${x(n.slug)}">${x(n.division.toUpperCase())}</strong>
        <span class="ranked-start-rating">${C(t)} RP</span>
      </div>
      <div class="ranked-start-rules" aria-label="Ranked run rules">
        <span>${E("heart")} Three lives</span>
        <span>${E("shield-check")} Standardized roster</span>
        <span>${E("flag")} Floor ${Fe} victory</span>
      </div>
      <button class="btn btn-primary btn-lg ranked-start-action" type="button" data-ranked-action="start" ${q?"disabled":""}>
        ${E("trophy")} <span>Start Ranked Run</span>
      </button>
    </div>
  `}function os(e){(e||[]).forEach(t=>{if(t.deferredPreview)return;let n=`${t.resultInstanceId}:${t.fromRarity}:${t.toRarity}`;Xa.has(n)||(Xa.add(n),window.AmongDemons.showGameAlert?.({type:"success",title:`${tt(t.toRarity)} combination!`,message:`Three identical ${tt(t.fromRarity)} demons became one ${tt(t.toRarity)} demon.`,action:`The upgraded demon stayed in ${t.destination==="active"?"your formation":"Reserve"}.`}),window.setTimeout(()=>{document.querySelector(`[data-instance-id="${Tn(t.resultInstanceId)}"]`)?.classList.add("is-team-upgrade")},0))})}function is(){document.querySelectorAll(".dungeon-demon-card[data-instance-id]").forEach(e=>{e.dataset.rankedDetailsBound!=="true"&&(e.dataset.rankedDetailsBound="true",e.addEventListener("click",t=>{t.defaultPrevented||Date.now()<Cn||e.classList.contains("is-dragging")||e.classList.contains("suppress-detail-click")||br(e)}))})}function br(e){let t=ls(e?.dataset.instanceId);t&&window.AmongDemons.ui?.openDemonDetailsModal?.(t)}async function ss(e){await ja(e==="player"?"victory":"defeat",{syncActions:!1})}function yr(e,t={}){if(!u.rankedVictoryModal||!window.bootstrap?.Modal)return;let n=e?.rating?.division||"Bronze II",a=at(n),r=Math.max(0,Number(t.rankGain??e?.victoryRankGain??e?.rating?.runDelta)||0),o=Math.max(0,Number(e?.rating?.rating)||0),s=`${e?.runId||"ranked"}:${Fe}`,c=u.rankedVictoryRankImage?.closest(".ranked-victory-rank");c?.classList.forEach(d=>{d.startsWith("ranked-rank--")&&c.classList.remove(d)}),c?.classList.add(`ranked-rank--${a.slug}`),u.rankedVictoryRankImage&&(u.rankedVictoryRankImage.src=a.imageUrl,u.rankedVictoryRankImage.alt=`${a.division} rank emblem`),u.rankedVictoryDivision&&(u.rankedVictoryDivision.textContent=a.division),u.rankedVictoryRankGain&&(u.rankedVictoryRankGain.textContent=`+${C(r)} RP`),u.rankedVictorySummary&&(u.rankedVictorySummary.textContent=`${C(o)} total RP. Continue into Endless or close this run and begin again.`),wt(!1),window.bootstrap.Modal.getOrCreateInstance(u.rankedVictoryModal,{backdrop:"static",keyboard:!1}).show(),Ja!==s&&(Ja=s,he?.play("sfx.dungeon.extract",{volume:.94,queueUntilUnlock:!0}))}async function cs(e){if(!(q||!v?.awaitingVictoryChoice)){if(wt(!0),e==="endless"){let t=await Ie("continue",{});if(t?.run&&!t.run.awaitingVictoryChoice){window.bootstrap?.Modal.getOrCreateInstance(u.rankedVictoryModal)?.hide(),He("Endless floor unlocked.","success");return}wt(!1);return}if(e==="new-run"&&(await Ie("end",{}))?.run?.status==="ended"){window.location.href=window.AmongDemons.appUrl("/ranked");return}wt(!1)}}function wt(e){u.rankedVictoryModal?.querySelectorAll("[data-ranked-victory-action]").forEach(t=>{t.classList.toggle("disabled",!!e),t.setAttribute("aria-disabled",e?"true":"false"),t.matches("button")&&(t.disabled=!!e)})}function ls(e){return[...i.run?.team||[],...i.run?.reserve||[],...i.run?.enemies||[],...p?.hand||[]].find(t=>t?.instanceId===e)}function En(e){return!!(e?.status==="active"&&["draft","selection","preparation"].includes(e.phase))}function ds(e){Bn=[],Ln=new Set((e.offers||[]).filter(r=>r.purchased).map(r=>String(r.offerId)));let t=K(e.active||e.team).map((r,o)=>({...$t(r,e),formationSlot:ce(r.formationSlot)??o,_rankedOrigin:"roster",_rankedPurchased:!0})),n=K(e.reserve).map((r,o)=>({...$t(r,e),reserveSlot:pe(r.reserveSlot)??o,_rankedOrigin:"roster",_rankedPurchased:!0})),a=(e.offers||[]).map(r=>({...$t(r.demon,e),_rankedOrigin:"offer",_rankedOfferId:r.offerId,_rankedCost:Math.max(0,Number(r.cost)||Te(r.demon)),_rankedPurchased:!!r.purchased}));return{active:t,reserve:n,hand:a}}function $t(e={},t=v){let n=JSON.parse(JSON.stringify(e)),a=`${Number(n.typeId||n.type_id||n.type)}:${String(n.rarity||"common").toLowerCase()}`,r=t?.previewStats?.[a];return r?{...n,...JSON.parse(JSON.stringify(r)),hp:Math.max(1,Number(r.maxHp)||Number(r.hp)||1),_rankedPactPreviewApplied:!0}:n}function us(){!p||!i.run||!En(v)||(i.run.team=p.active,i.run.active=p.active,i.run.reserve=p.reserve,i.run.offers=p.hand.filter(e=>e._rankedOrigin==="offer").map(e=>({offerId:e._rankedOfferId,demon:e})))}function vr(){return{purchasedOfferIds:[...Ln],sold:Bn.map(e=>Je(e)),active:(p?.active||[]).map(e=>({...Je(e),formationSlot:ce(e.formationSlot)})),reserve:(p?.reserve||[]).map(e=>({...Je(e),reserveSlot:pe(e.reserveSlot)})),hand:(p?.hand||[]).map(e=>Je(e))}}function Je(e){return e?._rankedCombinationRecipe?{combination:JSON.parse(JSON.stringify(e._rankedCombinationRecipe))}:{instanceId:e?.instanceId}}function kr(){return!!(p&&v?.status==="active"&&!v.pendingPact&&p.active.length>0&&p.active.length<=Number(v.capacities?.active||6)&&p.reserve.length<=Number(v.capacities?.reserve||6))}function wr(){return!p||!["draft","selection"].includes(v?.phase)||v.pendingPact?!1:Q>=De}function ms(){!p||se||i.isBattleAnimating||i.run?.phase==="result"||(u.teamGrid.querySelectorAll(".formation-slot").forEach(e=>{let t=e.querySelector(".formation-lane-cards");if(!t)return;t.dataset.rankedDropZone="",t.dataset.rankedZone="active",t.dataset.formationSlot=e.dataset.formationSlot;let n=t.querySelector(".dungeon-demon-card[data-instance-id]");n&&(n.dataset.rankedWorkspaceId=n.dataset.instanceId,n.dataset.rankedZone="active",n.setAttribute("draggable","true"))}),u.enemyGrid.querySelectorAll(".ranked-reserve-formation .formation-slot").forEach((e,t)=>{e.setAttribute("aria-label",`Reserve slot ${t+1}`);let n=e.querySelector(".formation-lane-cards");if(!n)return;n.dataset.rankedDropZone="",n.dataset.rankedZone="reserve",n.dataset.rankedIndex=String(t);let a=n.querySelector(".dungeon-demon-card[data-instance-id]");a&&(a.dataset.rankedWorkspaceId=a.dataset.instanceId,a.dataset.rankedZone="reserve",a.setAttribute("draggable","true"))}))}function gs(){if(!p||se||i.isBattleAnimating||i.run?.phase==="result")return;fs().forEach(t=>{let n=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${Tn(t)}"]`);n&&(n.classList.add("is-ranked-combine-ready"),n.querySelector(".dungeon-team-upgrade-indicator")||n.insertAdjacentHTML("afterbegin",un()))})}function fs(){let e=new Map;return[...p?.active||[],...p?.reserve||[],...p?.hand||[]].forEach(t=>{let n=String(t?.rarity||"").toLowerCase(),a=Number(t?.typeId||t?.type_id||t?.type);if(!a||!An(n))return;let r=`${a}:${n}`,o=e.get(r)||[];o.push(String(t.instanceId)),e.set(r,o)}),new Set([...e.values()].filter(t=>t.length>=3).flat())}function St(e){if(!p||!(e instanceof Element))return null;let t=e.closest("[data-ranked-workspace-id]");return t||e.closest("[data-ranked-drop-zone]")}function Lt(e){for(let t of["active","reserve","hand"]){let n=p?.[t]?.findIndex(a=>String(a.instanceId)===String(e));if(n>=0)return{zone:t,index:n,slot:t==="active"?ce(p[t][n].formationSlot):t==="reserve"?pe(p[t][n].reserveSlot)??n:null}}return null}function ps(e){let t=e.closest?.("[data-ranked-workspace-id]");if(t){let s=Lt(t.dataset.rankedWorkspaceId);return s?{...s,occupantId:t.dataset.rankedWorkspaceId}:null}let n=e.dataset.rankedZone;if(!["active","reserve","hand"].includes(n))return null;let a=n==="active"?ce(e.dataset.formationSlot??e.closest(".formation-slot")?.dataset.formationSlot):n==="reserve"?pe(e.dataset.rankedIndex??e.closest(".formation-slot")?.dataset.formationSlot):null,r=Number(e.dataset.rankedIndex),o=Number.isInteger(r)&&r>=0?r:p[n].length;return{zone:n,slot:a,index:o,occupantId:null}}async function $r(e,t,n=null){if(!p||q||i.isBattleAnimating)return;let a=Lt(e),r=ps(t);if(!a||!r||r.occupantId===String(e)){j();return}let o={active:K(p.active),reserve:K(p.reserve),hand:K(p.hand)},s=p[a.zone][a.index],c=r.occupantId?p[r.zone][r.index]:null;if(a.zone!=="hand"&&r.zone==="hand"){bs(s,n,t),j(),_();return}let d=a.zone==="hand"&&s?._rankedOrigin==="offer"&&!s._rankedPurchased&&["active","reserve"].includes(r.zone)?s:r.zone==="hand"&&c?._rankedOrigin==="offer"&&!c._rankedPurchased&&["active","reserve"].includes(a.zone)?c:null,l=d?Te(d):0;if(d&&l>Q){j(),He(`This card costs ${C(l)} rSouls.`,"warning"),_();return}let g=hs(s,a,r,c);if(g){Rt(e),ar(d,l,n,t);let S=[Sr(g.consumed,g.destinationEntry,g.rarity),...or()].filter(Boolean);j(),_(),ir(S);return}let m=Number(v.capacities?.active||6);if(r.zone==="active"&&a.zone!=="active"&&!r.occupantId&&p.active.length>=m){j(),He(`Floor ${C(v.floor)} allows ${C(m)} active demons.`,"warning"),_();return}let f=Rt(e),R=r.occupantId?Rt(r.occupantId):null;if(!f||!rr(f,r)){p=o,j(),_();return}if(R&&!rr(R,a)){p=o,j(),_();return}(p.active.length>Number(v.capacities?.active||6)||p.reserve.length>Number(v.capacities?.reserve||6))&&(p=o),p!==o&&d&&ar(d,l,n,t);let y=p===o?[]:or();j(),_(),ir(y)}function hs(e,t,n,a){if(t.zone!=="hand"||e?._rankedOrigin!=="offer"||e._rankedPurchased||!["active","reserve"].includes(n.zone)||!n.occupantId||!a)return null;let r=String(e.rarity||"").toLowerCase(),o=Number(e.typeId||e.type_id||e.type);if(!An(r)||Number(a.typeId||a.type_id||a.type)!==o||String(a.rarity||"").toLowerCase()!==r)return null;let s=[...p.active.map(l=>({zone:"active",demon:l})),...p.reserve.map(l=>({zone:"reserve",demon:l}))].filter(l=>Number(l.demon?.typeId||l.demon?.type_id||l.demon?.type)===o&&String(l.demon?.rarity||"").toLowerCase()===r),c=s.find(l=>String(l.demon.instanceId)===String(a.instanceId)),d=s.find(l=>String(l.demon.instanceId)!==String(a.instanceId));return!c||!d?null:{rarity:r,destinationEntry:c,consumed:[c,d,{zone:"hand",demon:e}]}}function ar(e,t,n,a){e&&(e._rankedPurchased=!0,e._rankedCost=t,Ln.add(String(e._rankedOfferId)),Q=Math.max(0,Q-t),Et(n||Bt(null,a),-t),he?.play("sfx.world.merchantPurchase",{volume:.82}))}function bs(e,t,n){if(!e)return;let a=Rt(e.instanceId);if(!a)return;let r=Cs(a);Bn.push(a),Q+=r,Et(t||Bt(null,n),r,{interest:!0}),he?.play("sfx.world.merchantPurchase",{volume:.82})}function Rt(e){let t=Lt(e);return t&&p[t.zone].splice(t.index,1)[0]||null}function rr(e,t){if(!e||!t||!p[t.zone])return!1;if(t.zone==="active"){if(p.active.length>=Number(v.capacities?.active||6))return!1;let a=ce(t.slot);return a===null||p.active.some(r=>ce(r.formationSlot)===a)?!1:(e.formationSlot=a,e.position=a%3===2?"front":"back",p.active.push(e),p.active.sort((r,o)=>Number(r.formationSlot)-Number(o.formationSlot)),!0)}if(t.zone==="reserve"&&p.reserve.length>=Number(v.capacities?.reserve||6))return!1;if(t.zone==="reserve"){let a=pe(t.slot??t.index);return a===null||p.reserve.some(r=>pe(r.reserveSlot)===a)?!1:(delete e.formationSlot,e.reserveSlot=a,e.position=e.preferredPosition==="back"?"back":"front",p.reserve.push(e),!0)}delete e.formationSlot,delete e.reserveSlot,e.position=e.preferredPosition==="back"?"back":"front";let n=Math.min(Math.max(0,Number(t.index)||0),p[t.zone].length);return p[t.zone].splice(n,0,e),!0}function or(){if(!p)return[];let e=[],t=!0;for(;t;){t=!1;for(let n of Qe.slice(0,-1)){let a=new Map;[...p.active.map(d=>({zone:"active",demon:d})),...p.reserve.map(d=>({zone:"reserve",demon:d}))].forEach(d=>{if(String(d.demon?.rarity||"").toLowerCase()!==n)return;let l=`${Number(d.demon?.typeId)}:${n}`,g=a.get(l)||[];g.push(d),a.set(l,g)});let o=[...a.values()].find(d=>d.length>=3);if(!o)continue;let s=o.slice(0,3),c=s.find(d=>d.zone==="active")||s[0];e.push(Sr(s,c,n)),t=!0;break}}return e}function Sr(e,t,n){let a=new Set(e.map(o=>String(o.demon.instanceId)));p.active=p.active.filter(o=>!a.has(String(o.instanceId))),p.reserve=p.reserve.filter(o=>!a.has(String(o.instanceId)));let r=ys(e.map(o=>o.demon),An(n),t);return p[t.zone].push(r),t.zone==="active"&&p.active.sort((o,s)=>Number(o.formationSlot)-Number(s.formationSlot)),{resultInstanceId:r.instanceId,fromRarity:n,toRarity:r.rarity,destination:t.zone}}function ys(e,t,n){let a=e[0]||{},r=Number(a.typeId||a.type_id||a.type);Za+=1;let o=`ranked-preview-combine-${Date.now()}-${Za}`,s=Me?.types?.[String(r)]||{},c=Me?.demons?.find(g=>Number(g.type)===r&&String(g.rarity).toLowerCase()===t),d=Number(s.rarityMultiplier?.[t])||1,l=c?{instanceId:o,sourceDemonId:c.id,typeId:r,species:s.name||a.species,role:s.role||a.role,targeting:s.targeting||a.targeting,preferredPosition:s.preferredPosition==="back"?"back":"front",rarity:t,imageUrl:c.image_url||c.imageUrl,maxHp:vt(s.baseStats?.hp,d),hp:vt(s.baseStats?.hp,d),atk:vt(s.baseStats?.atk,d),speed:vt(s.baseStats?.speed,d),position:s.preferredPosition==="back"?"back":"front",attackMeter:0,ranked:!0}:{...JSON.parse(JSON.stringify(a)),instanceId:o,rarity:t,hp:Math.max(1,Number(a.maxHp)||Number(a.hp)||1),attackMeter:0};return delete l.formationSlot,delete l.reserveSlot,delete l._rankedCost,delete l._rankedOfferId,delete l._rankedPurchased,l._rankedOrigin="combination",l._rankedCombinationRecipe={sources:e.map(g=>Je(g))},n.zone==="active"?(l.formationSlot=ce(n.demon.formationSlot),l.position=l.formationSlot%3===2?"front":"back"):l.reserveSlot=pe(n.demon.reserveSlot),$t(l)}function vt(e,t){let n=Number(e?.[0])||1,a=Number(e?.[1])||n;return Math.max(1,Math.round((n+a)/2*t))}function An(e){let t=Qe.indexOf(String(e||"").toLowerCase());return t>=0&&t<Qe.length-1?Qe[t+1]:null}function ir(e){e?.length&&window.requestAnimationFrame(()=>{let t=0;e.forEach(n=>{let a=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${Tn(n.resultInstanceId)}"]`);if(!a)return;let r=t*120;t+=1,window.setTimeout(()=>{vs(a),he?.play("sfx.progression.trainingSuccess",{volume:.88})},r)})})}function vs(e){let t=e?.getBoundingClientRect?.();if(!t)return;let n=document.createElement("span");n.className="ranked-combination-nova",n.setAttribute("aria-hidden","true"),n.style.setProperty("--ranked-combination-nova-size",`${Math.round(Math.max(48,t.width,t.height)*1.5)}px`),n.style.left=`${Math.round(t.left+t.width/2)}px`,n.style.top=`${Math.round(t.top+t.height/2)}px`,n.innerHTML=`
    <span class="ranked-combination-nova-ring"></span>
    <span class="ranked-combination-nova-ring is-delayed"></span>
    <span class="ranked-combination-nova-core"></span>
    ${Array.from({length:6},(a,r)=>`<span class="ranked-combination-nova-ray" style="--angle: ${r*60}deg"></span>`).join("")}
  `,document.body.appendChild(n),e.classList.add("is-ranked-upgrading"),n.addEventListener("animationend",a=>{a.target===n&&n.remove()}),window.setTimeout(()=>{n.remove(),e.classList.remove("is-ranked-upgrading")},1e3)}function j(){document.querySelectorAll(".is-drag-over").forEach(e=>e.classList.remove("is-drag-over"))}function Dn(e){let t=Lt(e);Rr(!!(t&&t.zone!=="hand"))}function xt(){Rr(!1)}function Rr(e){let t=!!e,n=u.rankedPreparation?.querySelector(".ranked-offer-area"),a=n?.querySelector(".ranked-offer-grid"),r=n?.querySelector(".ranked-hand-sale-prompt");document.documentElement.classList.toggle("is-ranked-selling-demon",t),u.rankedBottomPanel?.classList.toggle("is-ranked-selling-demon",t),n?.classList.toggle("is-ranked-sale-target",t),n?.setAttribute("aria-label",t?"Sell Demon":"Hand"),a?.toggleAttribute("hidden",t),n?.querySelectorAll(".ranked-offer, .ranked-hand-empty").forEach(o=>{o.toggleAttribute("hidden",t)}),r?.toggleAttribute("hidden",!t),r?.setAttribute("aria-hidden",String(!t))}function ks(e){if(e.button!==void 0&&e.button!==0)return;let t=e.target.closest("[data-ranked-workspace-id]");!t||!p||q||i.isBattleAnimating||($={card:t,instanceId:t.dataset.rankedWorkspaceId,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,active:!1,ghost:null,target:null},Dn($.instanceId),t.setPointerCapture?.(e.pointerId))}function ws(e){if(!$||e.pointerId!==$.pointerId)return;let t=Math.hypot(e.clientX-$.startX,e.clientY-$.startY);if(!$.active&&t<8)return;$.active||$s(e),e.cancelable&&e.preventDefault(),$.ghost.style.left=`${e.clientX}px`,$.ghost.style.top=`${e.clientY}px`,$.ghost.hidden=!0;let n=document.elementFromPoint(e.clientX,e.clientY);$.ghost.hidden=!1;let a=St(n);j(),a?.classList.add("is-drag-over"),$.target=a}function $s(e){$.active=!0,Dn($.instanceId),$.card.classList.add("is-dragging","is-pointer-dragging","suppress-detail-click"),$.ghost=$.card.cloneNode(!0),$.ghost.classList.add("pointer-drag-ghost"),$.ghost.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click","is-drag-over"),$.ghost.removeAttribute("role"),$.ghost.removeAttribute("tabindex"),$.ghost.setAttribute("aria-hidden","true"),$.ghost.style.width=`${$.card.getBoundingClientRect().width}px`,$.ghost.style.left=`${e.clientX}px`,$.ghost.style.top=`${e.clientY}px`,document.body.appendChild($.ghost)}function Ss(e){if(!$||e.pointerId!==$.pointerId)return;let t=$;if(t.active){e.cancelable&&e.preventDefault(),e.stopPropagation(),Cn=Date.now()+350;let n=t.target;xn(),n&&$r(t.instanceId,n,{x:e.clientX,y:e.clientY});return}xn()}function Rs(e){!$||e.pointerId!==$.pointerId||xn({preserveSaleTarget:kt})}function xn(e={}){$&&($.card?.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click"),$.ghost?.remove(),$=null,e.preserveSaleTarget||xt(),j())}function Ps(e){return e?.position==="back"?"back":"front"}function xs(){return""}function Pr(){if(!u.dungeonCenterActions)return;let e=Math.max(1,Number(i.run?.floor)||1);u.dungeonCenterActions.innerHTML=`
    <span class="dungeon-floor-marker ranked-floor-marker" aria-label="Current floor ${C(e)}">
      <span>Floor</span>
      <strong>${C(e)}</strong>
    </span>
  `}function ce(e){let t=Number(e);return Number.isInteger(t)&&t>=0&&t<9?t:null}function pe(e){let t=Number(e),n=Number(v?.capacities?.reserve||6);return Number.isInteger(t)&&t>=0&&t<n?t:null}function Te(e){let t=Number(e?._rankedCost);if(Number.isFinite(t)&&t>=0)return Math.floor(t);let n=String(e?.rarity||"common").toLowerCase();return Ua[n]||Ua.common}function Cs(e){return Math.ceil(Te(e)/2)}function Mn(e,t={}){if(!e)return;let n=window.AmongDemons.getSession?.()||{};window.AmongDemons.setSession?.({...n,player:{...n.player||{},...e}}),window.AmongDemons.ui?.updateNavAccount?.(e,t)}function Bt(e,t){if(Number.isFinite(e?.clientX)&&Number.isFinite(e?.clientY)&&(e.clientX||e.clientY))return{x:e.clientX,y:e.clientY};let n=t?.getBoundingClientRect?.();return n?{x:n.left+n.width/2,y:n.top+n.height/2}:{x:window.innerWidth/2,y:window.innerHeight/2}}function Ls(e){let t=u.rankedHandStatus?.querySelector(".ranked-rsoul-value");Et(Bt(null,t),e,{interest:!0})}function Et(e,t,n={}){let a=document.createElement("span"),r=Number(t)||0,o=Math.round(Number(e?.x)||window.innerWidth/2),s=Math.round(Number(e?.y)||window.innerHeight/2);a.className=["ranked-soul-spend-float",r>0?"is-gain":"is-spend",n.interest?"is-interest":""].filter(Boolean).join(" "),a.style.left=`${o}px`,a.style.top=`${s}px`,a.innerHTML=n.interest?`<strong>+</strong>${E("soul")}<strong>${C(Math.abs(r))}</strong>`:`${E("soul")}<strong>${r>0?"+":"-"}${C(Math.abs(r))}</strong>`,document.body.appendChild(a),a.addEventListener("animationend",()=>a.remove(),{once:!0}),window.setTimeout(()=>a.remove(),1400)}function Rn(e){i.isLoading=!!e,u.runLoading?.classList.toggle("d-none",!e)}function _e(e){q=!!e,document.documentElement.classList.toggle("is-ranked-busy",q)}function At(e){console.error(e),window.AmongDemons.setGameAlert(u.rankedMessage,e,{type:"danger"})}function He(e,t="info"){window.AmongDemons.setGameAlert(u.rankedMessage,e,{type:t})}function Bs(){return crypto.randomUUID?crypto.randomUUID():`ranked-${Date.now()}-${Math.random().toString(36).slice(2,12)}`}function K(e=[]){return(e||[]).map(t=>JSON.parse(JSON.stringify(t)))}function tt(e){let t=String(e||"");return t?t.charAt(0).toUpperCase()+t.slice(1):""}function C(e){return Number(e||0).toLocaleString()}function xr(e){let t=Number(e)||0;return`${t>0?"+":""}${C(t)}`}function Tn(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function x(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Es(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}})();
