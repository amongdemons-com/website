(()=>{var Lo=Object.defineProperty;var Eo=(e,t)=>{for(var n in t)Lo(e,n,{get:t[n],enumerable:!0})};var h={};function Fn(e){Object.assign(h,e)}var at="amongdemons-battle-speed",In="amongdemons-battle-screen-shake",Nn="amongdemons-battle-card-shake";var Re=[.5,1,2,4];var ze={default:{color:"#FAC51C",shadow:"rgba(250,197,28,0.85)"},poison:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},heal:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},1:{color:"#D1D5D8",shadow:"rgba(209,213,216,0.82)",outline:"#101820"},2:{color:"#171D24",shadow:"rgba(0,0,0,0.88)"},3:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},4:{color:"#E25041",shadow:"rgba(226,80,65,0.88)"},5:{color:"#C8CED2",shadow:"rgba(200,206,210,0.82)",outline:"#101820"},6:{color:"#C084FC",shadow:"rgba(192,132,252,0.9)"},7:{color:"#FFB23F",shadow:"rgba(255,178,63,0.9)"},8:{color:"#6E8F45",shadow:"rgba(110,143,69,0.86)"},9:{color:"#B8BDC2",shadow:"rgba(184,189,194,0.84)",outline:"#101820"},10:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},11:{color:"#52B7FF",shadow:"rgba(82,183,255,0.9)"}};var Bo=window.AmongDemons.getSession(),i={player:Bo.player||null,statPoints:null,run:null,startOptions:null,selectedRecruitRewardId:null,selectedSwapInstanceId:null,selectedRewardDemonKey:null,rewardDraftCandidate:null,isRecruiting:!1,isResultAnimating:!1,draggedRecruitPoolInstanceId:null,draggedFormationInstanceId:null,draggedRewardDemonKey:null,recruitSwapEffectIds:[],pendingHandFlowSources:null,isEnemyPreviewDeferred:!1,enemyRevealEffectIds:[],isPactRevealPending:!1,isPactTeamPreview:!1,pactRevealTimer:null,battleHandPreview:null,activeHandTab:"hand",isMobileRewardBoxOpen:!1,recruitDraftTeam:null,recruitDraftPool:null,collectionDemons:null,collectionReinforcementPlaceholderInteracted:!1,collectionReinforcementStagedInteracted:!0,isRecruitContinuePending:!1,combatLog:[],combatDemons:new Map,combatPlayback:null,battleSpeed:Ao(),isBattleAnimating:!1,endNotice:null,endSummary:null,endedReplayRun:null,formationRows:new Map,isLoading:!0},b={},ue=null;function _n(e){ue=e}function Ao(){let e=Number(localStorage.getItem(at));return Re.includes(e)?e:1}var sn={};Eo(sn,{animateAttackerCard:()=>Zn,animateCombatEntry:()=>Yn,appendTemporaryElement:()=>W,applyBattleSpeed:()=>ut,applyCombatTheme:()=>en,createCombatDemonMap:()=>Ke,createCombatElement:()=>Y,drawAttackZap:()=>Le,drawChaoticLightning:()=>da,drawCombatAnimation:()=>ar,drawDarkSpike:()=>ua,drawFireNova:()=>ca,drawFireball:()=>ia,drawGroupFireball:()=>sa,drawHealEffect:()=>la,drawSwordSwing:()=>Jt,drawThornBurst:()=>Vt,findDemonCard:()=>B,formatBattleSpeed:()=>lr,getAttackGeometry:()=>We,getAttackProfile:()=>Ye,getBattleTimeScale:()=>an,getCombatDemon:()=>J,getCombatStepDelay:()=>tn,getCombatTheme:()=>Qt,getDemonSide:()=>oe,getFightLogActionText:()=>fa,getFightLogAmountText:()=>ha,getFightLogVerb:()=>pa,getFloatingDamageAmount:()=>Wn,getLogRowClass:()=>ba,getLogSideLabel:()=>ya,getPoisonBurstDamage:()=>rn,groupCombatLog:()=>je,healTargetCard:()=>zt,hitTargetCard:()=>aa,isCardShakeEnabled:()=>ta,isScreenShakeEnabled:()=>na,isTypeTwoAttack:()=>ma,maybePlayDeath:()=>ra,pauseCombatPlayback:()=>jt,playCombatLog:()=>st,playTemporaryCardClass:()=>ge,poisonTickCard:()=>Ot,prefersReducedMotion:()=>z,prepareCombatPlayback:()=>qn,renderFightLogDemonName:()=>qt,renderFightLogRow:()=>on,renderLogPosition:()=>ga,renderViewportSvg:()=>re,resumeCombatPlayback:()=>Kt,scaleCombatDuration:()=>V,scheduleImpact:()=>$e,setActiveLogRow:()=>dt,setBattleSpeed:()=>nn,shakeTargetCard:()=>cr,showFloatingDamage:()=>Ve,skipCombatPlayback:()=>Xt,spawnImpactBurst:()=>Ht,stepCombatPlayback:()=>Ut,syncBattleSpeedButtons:()=>mt,syncCombatHpCards:()=>Xn,syncPoisonStatus:()=>Gt,triggerScreenShake:()=>oa,updateTargetCard:()=>me,updateTeamHp:()=>Un});var Do=window.AmongDemons.api;var Hn=window.AmongDemons.ui.renderDemonCard,Mo=window.AmongDemons.ui.renderCombatStats,Os=window.AmongDemons.ui.openDemonDetailsModal,x=window.AmongDemons.ui.renderIcon||(()=>""),Mt=window.AmongDemons.ui.renderSoulAmount||(e=>String(e||0)),Tt=window.AmongDemons.ui.getRarityColor||(()=>"#D1D5D8");var ae=new WeakMap;function On(){i.endNotice=null,i.endSummary=null,i.endedReplayRun=null}function N(e,t){e&&e.addEventListener("click",t)}function ot(e,t,n=document){n.querySelectorAll(e).forEach(a=>{a.addEventListener("click",o=>t(a,o))})}function ee(e,t,n={}){if(!e)return!1;let a=String(t||""),o=n.renderKey?String(n.renderKey):"",r=xe(a,o);return ae.get(e)===r?!1:(n.patchFormationGrid?Fo(e,a,o):n.patchDemonLane?Io(e,a,o):n.preserveDemonImages?To(e,a):e.innerHTML=a,ae.set(e,r),!0)}function To(e,t){let n=Ge(e),a=document.createElement("template");a.innerHTML=t,we(a.content,n),e.replaceChildren(a.content)}function Fo(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let o=e.querySelector(".battle-formation-grid"),r=a.content.querySelector(".battle-formation-grid");if(!o||!r){let m=Ge(e);we(a.content,m),e.replaceChildren(a.content),No(e.querySelector(".battle-formation-grid"),n);return}let s=Ge(e);It(o,r);let c=Ft(o),l=new Map(c.map(m=>[m.dataset.formationSlot,m])),d=Ft(r),u=new Set(d.map(m=>m.dataset.formationSlot));d.forEach((m,f)=>{let P=m.dataset.formationSlot,y=l.get(P);if(!y){we(m,s),o.insertBefore(m,o.children[f]||null);return}y!==o.children[f]&&o.insertBefore(y,o.children[f]||null);let S=m.outerHTML,v=xe(S,n);(ae.get(y)||y.outerHTML)!==v&&(we(m,s),ae.set(m,v),y.replaceWith(m))}),c.forEach(m=>{u.has(m.dataset.formationSlot)||m.remove()})}function Io(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let o=e.querySelector(".formation-lane-cards"),r=a.content.querySelector(".formation-lane-cards");if(!o||!r){let c=Ge(e);we(a.content,c),e.replaceChildren(a.content),Ho(e.querySelector(".formation-lane-cards"),n);return}let s=Ge(e);It(o,r),_o(o,Array.from(r.children),{imagesByKey:s,renderKey:n,getKey:Oo})}function Ft(e){return e?Array.from(e.children).filter(t=>t.matches?.(".formation-slot[data-formation-slot]")):[]}function No(e,t=""){Ft(e).forEach(n=>{ae.set(n,xe(n.outerHTML,t))})}function _o(e,t,n={}){let{imagesByKey:a=new Map,renderKey:o="",getKey:r}=n,s=Array.from(e.children),c=new Map(s.map((d,u)=>[r(d,u),d])),l=new Set(t.map((d,u)=>r(d,u)));t.forEach((d,u)=>{let m=r(d,u),f=c.get(m);if(!f){we(d,a),ae.set(d,xe(d.outerHTML,o)),e.insertBefore(d,e.children[u]||null);return}f!==e.children[u]&&e.insertBefore(f,e.children[u]||null);let P=d.outerHTML,y=xe(P,o);(ae.get(f)||f.outerHTML)!==y&&(we(d,a),ae.set(d,y),f.replaceWith(d))}),s.forEach((d,u)=>{l.has(r(d,u))||d.remove()})}function Ho(e,t=""){e&&Array.from(e.children).forEach(n=>{ae.set(n,xe(n.outerHTML,t))})}function Oo(e,t=0){let n=e.dataset?.instanceId;if(n)return`demon:${n}`;let a=e.dataset?.collectionReinforcementPosition;return a?`collection-reinforcement:${a}`:e.classList?.contains("dungeon-hand-empty")?"empty:hand":`node:${t}`}function xe(e,t=""){return t?`${t}
${e}`:e}function Ge(e){let t=new Map;return e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=zn(n);a&&!t.has(a)&&t.set(a,n)}),t}function we(e,t){e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=zn(n),o=a?t.get(a):null;o&&(It(o,n),n.replaceWith(o),t.delete(a))})}function zn(e){let n=e.closest(".dungeon-demon-card[data-instance-id]")?.dataset.instanceId,a=e.getAttribute("src")||"";return n&&a?`${n}|${a}`:""}function It(e,t){Array.from(e.attributes).forEach(n=>{t.hasAttribute(n.name)||e.removeAttribute(n.name)}),Array.from(t.attributes).forEach(n=>{e.getAttribute(n.name)!==n.value&&e.setAttribute(n.name,n.value)})}function Ce(e){e&&(e.disabled=!1)}function rt(e){return e?e.charAt(0).toUpperCase()+e.slice(1):""}function k(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Gn(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function Nt(e){return(e||[]).map(t=>({...t}))}var Ee=window.AmongDemons.audio,zo="amongdemons:battle-intro-complete";var Yt=(...e)=>h.getDemonPosition(...e),Go=(...e)=>h.renderDemonStatus(...e),Vo=(...e)=>h.renderDungeonCenterActions(...e),_t=(...e)=>h.renderFightLog(...e),Be=(...e)=>h.renderFightLogActions(...e),qe=(...e)=>h.renderRun(...e);function qn(e={}){if(!i.run)return null;let t=je(i.combatLog,{combineCounters:!0}),n={currentIndex:0,isPaused:!1,stepDirection:0,steps:t,totalSteps:t.length,waitResolve:null};return i.combatPlayback=n,i.isBattleAnimating=!0,e.render!==!1&&(qe(),_t()),n}async function st(e={}){if(!i.run)return;let t=e.combatPlayback,n=t&&i.combatPlayback===t?t:qn({render:!1});if(!n)return;let a=n.steps||[];if(i.isBattleAnimating=!0,qe(),_t(),e.waitForBattleIntro){if(Vo({canFight:!0,isFighting:!0}),await Ee?.play("sfx.battle.battleStart",{volume:.9,waitForEnd:!0}),!i.run||i.combatPlayback!==n)return;window.dispatchEvent(new CustomEvent(zo))}qe(),_t();try{for(;i.combatPlayback&&i.combatPlayback.currentIndex<a.length;){let o=await Xo();if(!o||!i.combatPlayback)break;if(o==="previous"){await Jo();continue}let r=i.combatPlayback.currentIndex,s=a[r];if(!s)break;X(!1),Wt(s,r,{animate:!0}),i.combatPlayback.currentIndex=r+1,Be(),await jn(V(tn(s))),X(!!i.combatPlayback?.isPaused)}}finally{i.isBattleAnimating=!1,i.combatPlayback=null,X(!1),qe()}dt(-1)}function Wt(e,t=-1,n={}){let a=er(),o=n.animate!==!1;if(e.entries.forEach(m=>{let f=a.get(m.target);f&&(f.hp=m.targetHp,m.effect==="poison_apply"&&(f.statusEffects=f.statusEffects||{},f.statusEffects.poison=Array.from({length:Math.max(1,Number(m.poisonStacks)||1)},()=>({}))),m.effect==="poison"&&Object.prototype.hasOwnProperty.call(m,"poisonStacks")&&(f.statusEffects=f.statusEffects||{},f.statusEffects.poison=Array.from({length:Math.max(0,Number(m.poisonStacks)||0)},()=>({}))))}),Un(),!o){Xn();return}dt(t);let r=oe(e.attacker),s=ct(e),c=new Map(s.map((m,f)=>[m,f])),l=!!e.isAoe||s.length>1;qo(e),e.primaryEffect!=="poison"&&Zn(e.attacker,e.primaryEffect,e.entries[0]?.target);let d=Wo(e);d&&sa(e.attacker,d.targetIds,{effect:e.primaryEffect,travel:d.travel});let u=jo(e);u&&Jt(e.attacker,u.targetId),e.entries.forEach(m=>{let f=c.get(m)??0;Yn(m,e,r,f,l,d,u)})}function qo(e){let t=e.entries?.[0]||{},n=e.primaryEffect||t.effect;if(n==="poison"||n==="heal"||n==="last_breath"||n==="shared_pain")return;let a=null;if(n==="poison_apply")a="sfx.battle.abilities.poisonApply";else if(n==="retaliate"||n==="thorns")a="sfx.battle.abilities.thornsRetaliate";else{let o=Number(J(e.attacker)?.typeId);a={1:"sfx.battle.abilities.meleeSwing",2:"sfx.battle.abilities.rangedProjectile",3:"sfx.battle.abilities.poisonApply",4:"sfx.battle.abilities.fireAoe",5:"sfx.battle.abilities.bruiserStrike",6:"sfx.battle.abilities.assassinStrike",7:"sfx.battle.abilities.cleave",8:"sfx.battle.abilities.thornsRetaliate",9:"sfx.battle.abilities.juggernautSlam",10:"sfx.battle.abilities.heal",11:"sfx.battle.abilities.chaosAttack"}[o]||"sfx.battle.abilities.meleeSwing"}Ee?.play(a,{volume:.72,minInterval:55}),!Z(t)&&(e.entries||[]).some(Z)&&Ee?.play("sfx.battle.abilities.thornsRetaliate",{volume:.66,minInterval:55})}var Yo=new Set(["poison","heal","last_breath","shared_pain","poison_apply"]);function Z(e){return e?.effect==="retaliate"||e?.effect==="thorns"}function ct(e){return(e.entries||[]).filter(t=>!Z(t))}function it(e){return!Z(e)&&!Yo.has(e.effect)}function Wo(e){if(z()||e.targeting==="chaotic"||Number(J(e.attacker)?.typeId)!==4)return null;let t=(e.entries||[]).filter(it);return t.length?{targetIds:t.map(n=>n.target),travel:Ye(t[0]).travel,lead:90}:null}function jo(e){if(z()||Number(J(e.attacker)?.typeId)!==7)return null;let t=(e.entries||[]).filter(it);return t.length?{targetId:t[Math.floor((t.length-1)/2)].target}:null}function Yn(e,t,n,a,o,r=null,s=null){let c=z();if(e.effect==="poison"){$e(160,()=>{a===0&&Ee?.play("sfx.battle.abilities.poisonTick",{volume:.66,minInterval:80}),a===0&&Ve(e.target,rn(t),"poison",e.attacker,e.effect,{burstCount:t.entries.length}),me(e.target,e.targetHp,n,{hit:!1}),Gt(e.target,e.poisonStacks),Ot(e.target)});return}if(e.effect==="heal"){c||la(e.attacker,e.target),$e(200,()=>{Ee?.play("sfx.battle.abilities.heal",{volume:.7,minInterval:80}),me(e.target,e.targetHp,n,{hit:!1,healing:e.healing}),Ve(e.target,e.healing,"heal",e.attacker,e.effect),zt(e.target)});return}if(e.effect==="last_breath"){$e(160,()=>{me(e.target,e.targetHp,n,{hit:!1}),Ve(e.target,1,"heal",e.attacker,e.effect),zt(e.target)});return}if(e.effect==="shared_pain"){me(e.target,e.targetHp,n,{hit:!1});return}if(e.effect==="poison_apply"){c||Le(t.attacker,e.target,{effect:e.effect,poison:!0,bubbles:15,variant:"poison-flame"}),$e(220,()=>{Gt(e.target,e.poisonStacks||1),me(e.target,e.targetHp,n),Ht(e.target,{attackerId:e.attacker,effect:e.effect,variant:"poison"}),Ot(e.target)});return}let l=Ye(e),d=r&&it(e),u=s&&it(e),m=d||u,f=!Z(e)||Ko(e,t);!c&&!m&&f&&l.draw();let P=d?r.travel+r.lead+a*50:l.travel+(o?a*70:0);$e(P,()=>{me(e.target,e.targetHp,n);let y=Wn(e,t);y>0&&Ve(e.target,y,ma(e.attacker)?"dark":"damage",e.attacker,e.effect),Ht(e.target,{attackerId:e.attacker,effect:e.effect,heavy:l.heavy,variant:l.key,aoe:o&&!Z(e)}),aa(e.target,l.heavy),l.screenShake&&oa(),ra(e.target,e.targetHp)})}function Wn(e,t){let n=Math.max(0,Number(e?.dmg)||0);if(!Z(e))return n;let a=(t?.entries||[]).filter(o=>Z(o)&&o.target===e.target);return a[0]!==e?0:a.reduce((o,r)=>o+Math.max(0,Number(r.dmg)||0),0)}function Ko(e,t){if(!Z(e))return!0;let n=(t?.entries||[]).filter(Z),a=n.filter(r=>r.effect==="retaliate"||Uo(r.attacker));return(a.length?a:n).find(r=>r.attacker===e.attacker)===e}function Uo(e){let t=J(e)||{},n=String(t.role||"").toLowerCase(),a=String(t.abilityKind||t.ability_kind||t.ability?.kind||"").toLowerCase();return Number(t.typeId)===8||n==="counter_tank"||a==="retaliate"}async function Xo(){for(;i.combatPlayback?.isPaused;){X(!0);let e=Number(i.combatPlayback.stepDirection)||0;if(i.combatPlayback.stepDirection=0,e<0)return"previous";if(e>0)return i.combatPlayback.currentIndex<i.combatPlayback.totalSteps?"next":null;await Zo()}return X(!1),i.combatPlayback?"play":null}function jn(e){let t=i.combatPlayback;return t?new Promise(n=>{let a=window.setTimeout(o,Math.max(0,Number(e)||0));function o(){window.clearTimeout(a),t.waitResolve===o&&(t.waitResolve=null),n()}t.waitResolve=o}):Promise.resolve()}function Zo(){let e=i.combatPlayback;return e?new Promise(t=>{e.waitResolve=()=>{e.waitResolve=null,t()}}):Promise.resolve()}function jt(){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!0,X(!0),lt(),Be())}function Kt(){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!1,i.combatPlayback.stepDirection=0,X(!1),lt(),Be())}function Ut(e){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!0,i.combatPlayback.stepDirection=Number(e)<0?-1:1,X(!0),lt(),Be())}function Xt(){let e=i.combatPlayback;!i.run||!e||!i.isBattleAnimating||(e.isPaused=!1,e.stepDirection=0,Kn(e.totalSteps),X(!1),lt())}function lt(){let e=i.combatPlayback?.waitResolve;e&&e()}function Kn(e){if(!i.run||!i.combatPlayback)return;tr(),Qo();let t=i.combatPlayback.steps||[],n=Zt(Math.floor(Number(e)||0),0,t.length);for(let a=0;a<n;a+=1)Wt(t[a],a,{animate:!1});i.combatPlayback.currentIndex=n,qe(),dt(n>0?n-1:-1)}async function Jo(){let e=i.combatPlayback;if(!i.run||!e||e.currentIndex<=0)return;let t=e.steps||[],n=Zt(e.currentIndex-2,0,t.length-1),a=t[n];a&&(Kn(n),X(!1),Wt(a,n,{animate:!0}),e.currentIndex=n+1,Be(),await jn(V(tn(a))),i.combatPlayback&&(i.combatPlayback.isPaused=!0,X(!0),Be()))}function Qo(){let e=i.run?.lastBattle||{};i.run.team=Nt(e.playerTeamBefore||i.run.team||[]),i.run.enemies=Nt(e.enemyTeamBefore||i.run.enemies||[]),i.combatDemons=Ke()}function er(){return new Map([...i.run?.team||[],...i.run?.enemies||[]].map(e=>[e.instanceId,e]))}function tr(){sr(),document.querySelectorAll([".attack-zap",".chaos-lightning",".combat-impact-burst",".dark-spike",".fireball-shot",".fire-nova",".floating-combat-number",".heal-effect",".sword-swing",".thorn-burst"].join(",")).forEach(e=>e.remove()),document.querySelector(".dungeon-arena")?.classList.remove("is-combat-screenshake")}function X(e){let t=!!e;document.documentElement.classList.toggle("is-combat-paused",t),t?rr():ir()}function Zt(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}function Un(){i.run&&(i.run.hp=(i.run.team||[]).reduce((e,t)=>e+Math.max(0,Number(t.hp)||0),0))}function Xn(){[...i.run?.team||[],...i.run?.enemies||[]].forEach(e=>{me(e.instanceId,e.hp)})}function dt(e){document.querySelectorAll(".fight-log-row").forEach(t=>{t.classList.toggle("active",Number(t.dataset.logIndex)===e)})}function Zn(e,t,n){let a=B(e);a&&(en(a,Qt(e,t)),a.classList.toggle("is-player-attack",oe(e)==="player"),a.classList.toggle("is-enemy-attack",oe(e)==="enemy"),nr(a,n),ge(a,"is-attacking",320))}function nr(e,t){if(z()||!t){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let n=B(t);if(!n){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let a=e.getBoundingClientRect(),o=n.getBoundingClientRect(),r=o.left+o.width/2-(a.left+a.width/2),s=o.top+o.height/2-(a.top+a.height/2),c=Math.hypot(r,s)||1,l=Math.min(18,c*.26);e.style.setProperty("--lunge-x",`${(r/c*l).toFixed(1)}px`),e.style.setProperty("--lunge-y",`${(s/c*l).toFixed(1)}px`)}function Ye(e){let{attacker:t,target:n,effect:a}=e;if(Z(e))return{key:"thorn",travel:210,heavy:!1,screenShake:!1,draw:()=>Vt(t,n)};if(e.targeting==="chaotic")return{key:"chaotic",travel:150,heavy:!0,screenShake:!1,draw:()=>da(t,n)};let o=Number(J(t)?.typeId);return{2:{key:"dark",travel:200,heavy:!1,draw:()=>ua(t,n)},4:{key:"fire",travel:380,heavy:!0,screenShake:!1,draw:()=>ia(t,n,{effect:a})},5:{key:"sniper",travel:360,heavy:!0,draw:()=>Le(t,n,{effect:a,variant:"heavy",duration:520})},6:{key:"assassin",travel:120,heavy:!1,draw:()=>Le(t,n,{effect:a,variant:"assassin",duration:240})},7:{key:"melee",travel:170,heavy:!1,draw:()=>Jt(t,n)},8:{key:"thorn",travel:210,heavy:!1,draw:()=>Vt(t,n)},9:{key:"crushing",travel:620,heavy:!0,screenShake:!0,draw:()=>Le(t,n,{effect:a,variant:"crushing",duration:960})}}[o]||{key:"melee",travel:150,heavy:!1,draw:()=>Le(t,n,{effect:a})}}function ar(e){Ye(e).draw()}function z(){return!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)}var Ae=new Set;function Jn(){return window.performance?.now?.()??Date.now()}function $e(e,t){let n=V(e);if(z()||n<=0){t();return}let a={fn:t,remaining:n,startedAt:0,handle:null};a.run=()=>{a.handle=null,Ae.delete(a),a.fn()},Ae.add(a),or()||Qn(a)}function Qn(e){e.startedAt=Jn(),e.handle=window.setTimeout(e.run,e.remaining)}function or(){return document.documentElement.classList.contains("is-combat-paused")}function rr(){Ae.forEach(e=>{e.handle!=null&&(window.clearTimeout(e.handle),e.handle=null,e.remaining=Math.max(0,e.remaining-(Jn()-e.startedAt)))})}function ir(){Ae.forEach(e=>{e.handle==null&&Qn(e)})}function sr(){Ae.forEach(e=>{e.handle!=null&&window.clearTimeout(e.handle)}),Ae.clear()}function Ht(e,t={}){if(z())return;let n=B(e);if(!n)return;let a=n.getBoundingClientRect(),o=Y(["combat-impact-burst",t.heavy?"is-heavy":"",t.aoe?"is-aoe":"",`is-${t.variant||"melee"}`].filter(Boolean).join(" "),t.attackerId,t.effect);o.style.left=`${(a.left+a.width/2).toFixed(1)}px`,o.style.top=`${(a.top+a.height/2).toFixed(1)}px`;let r=t.heavy?520:380;o.style.setProperty("--fx-duration",`${V(r)}ms`);let s=t.heavy?9:6,c=t.heavy?26:17,l=Array.from({length:s},(d,u)=>{let m=360/s*u+(u%2?14:-10),f=c+u%3*5;return`<span class="combat-impact-particle" style="--p-angle:${m.toFixed(0)}deg;--p-dist:${f}px;animation-delay:${V(u*6)}ms"></span>`}).join("");o.innerHTML=`<span class="combat-impact-core"></span>${t.aoe?'<span class="combat-impact-ring"></span>':""}${l}`,W(o,r)}function ea(e){try{return localStorage.getItem(e)!=="0"}catch{return!0}}function ta(){return ea(Nn)}function na(){return ea(In)}function aa(e,t){if(z())return;let n=B(e);if(!n)return;let a=ta();ge(n,t&&a?"is-shaking":"is-hit",t&&a?360:240)}function Ot(e){if(z())return;let t=B(e);t&&ge(t,"is-poison-tick",520)}function zt(e){if(z())return;let t=B(e);t&&ge(t,"is-healed",520)}var Vn=0;function oa(){if(z()||!na())return;let e=window.performance?.now?.()??Date.now();if(e-Vn<140)return;Vn=e;let t=document.querySelector(".dungeon-arena");t&&ge(t,"is-combat-screenshake",360)}function ra(e,t){if(Number(t)>0)return;let n=B(e);!n||n.classList.contains("is-dying")||(Ee?.playDeath(),!z()&&ge(n,"is-dying",620))}function Le(e,t,n={}){let a=B(e),o=B(t);if(!a||!o)return;let{attackerRect:r,startX:s,startY:c,endX:l,endY:d}=We(a,o),u=J(e),m=u&&Yt(u)==="back",f=m?.12:.22,P=m?.9:.78,y=s+(l-s)*f,S=c+(d-c)*f,v=s+(l-s)*P,R=c+(d-c)*P,M=(y+v)/2,F=(S+R)/2,T=-(R-S)/Math.max(1,Math.hypot(v-y,R-S)),I=(v-y)/Math.max(1,Math.hypot(v-y,R-S)),U=m?10:6,te=M+T*U,ne=F+I*U,le=Number(n.bubbles)||0,Pe=le?Array.from({length:le},(be,O)=>{let C=.08+O/Math.max(1,le-1)*.84,ye=(1-C)*(1-C)*y+2*(1-C)*C*te+C*C*v,Dt=(1-C)*(1-C)*S+2*(1-C)*C*ne+C*C*R,Oe=(O%2?-1:1)*(4+O%4),G=2.2+O%4*.8;return`<circle class="poison-bubble" cx="${(ye+T*Oe).toFixed(1)}" cy="${(Dt+I*Oe).toFixed(1)}" r="${G.toFixed(1)}" style="animation-delay: ${V(O*18).toFixed(0)}ms" />`}).join(""):"",H=Number(n.flames)||0,D=H?Array.from({length:H},(be,O)=>{let C=.08+O/Math.max(1,H-1)*.84,ye=(1-C)*(1-C)*y+2*(1-C)*C*te+C*C*v,Dt=(1-C)*(1-C)*S+2*(1-C)*C*ne+C*C*R,Oe=(O%2?-1:1)*(5+O%3*2),G=5+O%4,ve=ye+T*Oe,ke=Dt+I*Oe;return`<path class="fire-spark" d="M ${ve.toFixed(1)} ${(ke-G).toFixed(1)} C ${(ve+G*.72).toFixed(1)} ${(ke-G*.2).toFixed(1)} ${(ve+G*.45).toFixed(1)} ${(ke+G*.72).toFixed(1)} ${ve.toFixed(1)} ${(ke+G).toFixed(1)} C ${(ve-G*.55).toFixed(1)} ${(ke+G*.42).toFixed(1)} ${(ve-G*.45).toFixed(1)} ${(ke-G*.32).toFixed(1)} ${ve.toFixed(1)} ${(ke-G).toFixed(1)} Z" style="animation-delay: ${V(O*16).toFixed(0)}ms" />`}).join(""):"",de=Y(["attack-zap",oe(e)==="player"?"is-player-attack":"is-enemy-attack",m?"is-back-attack":"",n.variant?`is-${n.variant}`:"",n.poison?"is-poison-apply":""].filter(Boolean).join(" "),e,n.effect);de.innerHTML=re(`
      <path class="attack-zap-trail" d="M ${y.toFixed(1)} ${S.toFixed(1)} Q ${te.toFixed(1)} ${ne.toFixed(1)} ${v.toFixed(1)} ${R.toFixed(1)}" />
      ${n.variant==="assassin"?`<path class="attack-zap-trail attack-zap-trail-secondary" d="M ${(y+T*7).toFixed(1)} ${(S+I*7).toFixed(1)} Q ${(te+T*7).toFixed(1)} ${(ne+I*7).toFixed(1)} ${(v+T*7).toFixed(1)} ${(R+I*7).toFixed(1)}" />`:""}
      ${Pe}
      ${D}
      <circle class="attack-zap-impact" cx="${v.toFixed(1)}" cy="${R.toFixed(1)}" r="${m?5:4}" />
  `),W(de,n.duration||320)}function ia(e,t,n={}){let a=B(e),o=B(t);if(!a||!o)return;let{attackerRect:r,targetRect:s,startX:c,startY:l,endX:d,endY:u,angle:m}=We(a,o),f=J(e),P=f&&Yt(f)==="back",y=Math.min(r.width*(P?.28:.42),46),S=Math.min(s.width*.18,22),v=c+Math.cos(m)*y,R=l+Math.sin(m)*y,M=d-Math.cos(m)*S,F=u-Math.sin(m)*S,T=Math.max(1,Math.hypot(M-v,F-R)),I=-(F-R)/T,U=(M-v)/T,te=Math.max(12,Math.min(24,s.width*.18)),ne=8,le=Array.from({length:ne},(H,D)=>{let de=.12+D/Math.max(1,ne-1)*.72,be=(D%2?-1:1)*(4+D%3*2),O=v+(M-v)*de+I*be,C=R+(F-R)*de+U*be,ye=1.8+D%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${C.toFixed(1)}" r="${ye.toFixed(1)}" style="animation-delay: ${V(70+D*28).toFixed(0)}ms" />`}).join(""),Pe=Y(["fireball-shot",oe(e)==="player"?"is-player-attack":"is-enemy-attack",P?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);Pe.innerHTML=re(`
      ${le}
      <g class="fireball-projectile" style="--fireball-start-x: ${v.toFixed(1)}px; --fireball-start-y: ${R.toFixed(1)}px; --fireball-end-x: ${M.toFixed(1)}px; --fireball-end-y: ${F.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="8.5" />
        <circle class="fireball-hot" cx="3.6" cy="-2.2" r="4.2" />
      </g>
      <circle class="fireball-impact" cx="${M.toFixed(1)}" cy="${F.toFixed(1)}" r="${te.toFixed(1)}" />
  `),W(Pe,620)}function sa(e,t,n={}){let a=B(e),o=(t||[]).map(B).filter(Boolean);if(z()||!a||!o.length)return;let r=a.getBoundingClientRect(),s=r.left+r.width/2,c=r.top+r.height/2,l=o.map(H=>{let D=H.getBoundingClientRect();return{x:D.left+D.width/2,y:D.top+D.height/2,half:Math.max(D.width,D.height)/2}}),d=l.reduce((H,D)=>H+D.x,0)/l.length,u=l.reduce((H,D)=>H+D.y,0)/l.length,m=Math.atan2(u-c,d-s),f=J(e),P=f&&Yt(f)==="back",y=Math.min(r.width*(P?.28:.42),46),S=s+Math.cos(m)*y,v=c+Math.sin(m)*y,R=d,M=u,F=Math.max(1,Math.hypot(R-S,M-v)),T=-(M-v)/F,I=(R-S)/F,U=Zt(Math.max(...l.map(H=>Math.hypot(H.x-d,H.y-u)+H.half))+8,44,220),te=9,ne=Array.from({length:te},(H,D)=>{let de=.12+D/Math.max(1,te-1)*.72,be=(D%2?-1:1)*(4+D%3*2),O=S+(R-S)*de+T*be,C=v+(M-v)*de+I*be,ye=1.8+D%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${C.toFixed(1)}" r="${ye.toFixed(1)}" style="animation-delay: ${V(70+D*28).toFixed(0)}ms" />`}).join(""),le=Y(["fireball-shot",oe(e)==="player"?"is-player-attack":"is-enemy-attack",P?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);le.innerHTML=re(`
      ${ne}
      <g class="fireball-projectile" style="--fireball-start-x: ${S.toFixed(1)}px; --fireball-start-y: ${v.toFixed(1)}px; --fireball-end-x: ${R.toFixed(1)}px; --fireball-end-y: ${M.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="11" />
      </g>
  `),W(le,620);let Pe=Number(n.travel)||380;$e(Pe,()=>ca(d,u,U,e,n.effect))}function ca(e,t,n,a,o){if(z())return;let r=Math.max(20,Number(n)||60),s=Y("fire-nova",a,o),c=`fire-nova-grad-${Math.random().toString(36).slice(2,8)}`;s.innerHTML=re(`
      <defs>
        <radialGradient id="${c}" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
          <stop offset="52%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
          <stop offset="82%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0.62" />
          <stop offset="100%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
        </radialGradient>
      </defs>
      <circle class="fire-nova-flash" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${(r*.72).toFixed(1)}" style="fill: url(#${c})" />
      <circle class="fire-nova-ring fire-nova-ring-hot" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${(r*.62).toFixed(1)}" />
      <circle class="fire-nova-ring" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${r.toFixed(1)}" />
      <circle class="fire-nova-ring fire-nova-ring-delayed" cx="${e.toFixed(1)}" cy="${t.toFixed(1)}" r="${r.toFixed(1)}" />
  `),W(s,620)}function me(e,t,n="unknown",a={}){let o=B(e);if(!o)return;let r=o.querySelector(".js-demon-hp");r&&(r.textContent=t);let s=o.querySelector(".js-demon-hp-fill");if(s){let c=Number(s.dataset.maxHp)||Number(t)||1,l=Math.max(0,Math.min(100,Math.round(Number(t)/c*100)));s.style.width=`${l}%`}o.classList.toggle("is-defeated",Number(t)<=0)}function Gt(e,t){let n=B(e);if(!n)return;let a=n.querySelector(".demon-status-poison");if(Number(t)<=0){n.querySelector(".demon-status-strip")?.remove(),n.classList.remove("is-poisoned");return}n.classList.add("is-poisoned"),n.querySelector(".demon-status-strip")?.remove(),n.insertAdjacentHTML("beforeend",Go({statusEffects:{poison:Array.from({length:Math.max(1,Number(t)||1)},()=>({}))}}))}function Ve(e,t,n,a,o,r={}){let s=B(e);if(!s)return;let c=s.getBoundingClientRect(),l=Y(`floating-combat-number is-${n}`,a,o||n);if(l.style.left=`${(c.left+c.width/2).toFixed(1)}px`,l.style.top=`${Math.max(6,c.top+c.height*.08).toFixed(1)}px`,l.innerHTML=n==="heal"?`+${k(t)}`:`-${k(t)}`,n==="poison"&&Number(r.burstCount)>1){let d=Math.max(1,Number(r.burstCount)||1),u=Math.min(2.2,1+(d-1)*.12);l.style.fontSize=`calc(1.22rem * ${u.toFixed(2)})`}W(l,760)}function Jt(e,t){let n=B(e),a=B(t);if(!n||!a)return;let{attackerRect:o,startX:r,startY:s,endX:c,endY:l,angle:d}=We(n,a),u=Math.max(70,o.height*.92),m=Math.max(18,o.width*.2),f=o.width*.58,P=r+Math.cos(d)*f,y=s+Math.sin(d)*f,S=Math.max(22,o.width*.26),v=Y("sword-swing",e);v.innerHTML=re(`
      ${[-.18,0,.18].map((R,M)=>{let F=P+Math.cos(d+Math.PI/2)*u*R,T=y+Math.sin(d+Math.PI/2)*u*R,I=`M ${F.toFixed(1)} ${(T-u*.34).toFixed(1)} Q ${(F+m).toFixed(1)} ${T.toFixed(1)} ${F.toFixed(1)} ${(T+u*.34).toFixed(1)}`,U=`rotate(${(d*180/Math.PI).toFixed(1)} ${F.toFixed(1)} ${T.toFixed(1)}) translate(${S.toFixed(1)} 0)`;return`<path class="sword-swing-belly sword-scratch-${M+1}" d="${I}" transform="${U}" /><path class="sword-swing-arc sword-scratch-${M+1}" d="${I}" transform="${U}" />`}).join("")}
  `),W(v,440)}function Vt(e,t){let n=B(e),a=B(t);if(!n||!a)return;let{attackerRect:o,startX:r,startY:s,angle:c}=We(n,a),l=Math.max(42,o.width*.5),d=r+Math.cos(c)*l,u=s+Math.sin(c)*l,m=Math.max(22,o.width*.28),f=Y("thorn-burst",e),P=[-.48,-.28,-.1,.1,.28,.48];f.innerHTML=re(`
      ${P.map((y,S)=>{let v=c+y,R=m*(.74+S%2*.16),M=o.height*.82,F=d+Math.cos(c+Math.PI/2)*(S/(P.length-1)-.5)*M,T=u+Math.sin(c+Math.PI/2)*(S/(P.length-1)-.5)*M,I=F+Math.cos(v)*R,U=T+Math.sin(v)*R;return`<path class="thorn-spike" d="M ${F.toFixed(1)} ${T.toFixed(1)} L ${I.toFixed(1)} ${U.toFixed(1)}" />`}).join("")}
  `),W(f,520)}function cr(e){let t=B(e);t&&ge(t,"is-shaking",360)}function la(e,t){let n=B(t);if(!n)return;let a=n.getBoundingClientRect(),o=a.left+a.width/2,r=a.top+a.height/2,s=Math.max(18,a.width*.18),c=Y("heal-effect",e,"heal");c.innerHTML=re(`
      <circle class="heal-ring" cx="${o.toFixed(1)}" cy="${r.toFixed(1)}" r="${s.toFixed(1)}" />
      <circle class="heal-ring heal-ring-secondary" cx="${(o-s*.6).toFixed(1)}" cy="${(r+s*.16).toFixed(1)}" r="${(s*.72).toFixed(1)}" />
      <circle class="heal-ring heal-ring-tertiary" cx="${(o+s*.58).toFixed(1)}" cy="${(r-s*.14).toFixed(1)}" r="${(s*.58).toFixed(1)}" />
  `),W(c,620)}function da(e,t){let n=B(t);if(!n)return;let a=n.getBoundingClientRect(),o=a.left+a.width/2,r=Math.max(0,a.top-Math.min(170,window.innerHeight*.24)),s=a.top+a.height*.56,c=a.top+a.height*.26,l=Y("chaos-lightning is-thunderstrike",e),d=`M ${(o-12).toFixed(1)} ${r.toFixed(1)} L ${(o+10).toFixed(1)} ${(r+42).toFixed(1)} L ${(o-8).toFixed(1)} ${(r+42).toFixed(1)} L ${(o+7).toFixed(1)} ${(c+10).toFixed(1)} L ${(o-16).toFixed(1)} ${(c+10).toFixed(1)} L ${(o+4).toFixed(1)} ${s.toFixed(1)}`,u=`M ${(o+7).toFixed(1)} ${(c-4).toFixed(1)} L ${(o+34).toFixed(1)} ${(c+10).toFixed(1)} L ${(o+14).toFixed(1)} ${(c+18).toFixed(1)}`,m=`M ${(o-4).toFixed(1)} ${(c+22).toFixed(1)} L ${(o-35).toFixed(1)} ${(c+34).toFixed(1)} L ${(o-13).toFixed(1)} ${(c+43).toFixed(1)}`;l.innerHTML=re(`
      <path class="chaos-thunder-border chaos-thunder-core" d="${d}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${u}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${m}" />
      <path class="chaos-thunder-core" d="${d}" />
      <path class="chaos-thunder-branch" d="${u}" />
      <path class="chaos-thunder-branch" d="${m}" />
  `),W(l,360)}function ua(e,t){let n=B(e),a=B(t);if(!n||!a)return;let o=n.getBoundingClientRect(),r=a.getBoundingClientRect(),s=o.left+o.width/2,c=o.top+o.height/2,l=r.left+r.width/2,d=r.top+r.height/2,u=Math.atan2(d-c,l-s),m=Math.max(24,Math.hypot(l-s,d-c)),f=Y("dark-spike",e);f.style.left=`${s}px`,f.style.top=`${c}px`,f.style.width=`${m}px`,f.style.setProperty("--dark-spike-angle",`${u}rad`),W(f,340)}function Qt(e,t){if(t==="poison"||t==="poison_apply")return ze.poison;if(t==="heal")return ze.heal;let n=Number(J(e)?.typeId);return ze[n]||ze.default}function en(e,t){!e||!t||(e.style.setProperty("--combat-color",t.color),e.style.setProperty("--combat-shadow",t.shadow),e.style.setProperty("--combat-text-outline",t.outline||"#fff"))}function Y(e,t,n){let a=document.createElement("div");return a.className=e,en(a,Qt(t,n)),a}function W(e,t,n=document.body){return n.appendChild(e),setTimeout(()=>e.remove(),V(t)),e}function re(e){return`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">${e}</svg>`}function We(e,t){let n=e.getBoundingClientRect(),a=t.getBoundingClientRect(),o=n.left+n.width/2,r=n.top+n.height/2,s=a.left+a.width/2,c=a.top+a.height/2;return{attackerRect:n,targetRect:a,startX:o,startY:r,endX:s,endY:c,angle:Math.atan2(c-r,s-o)}}function tn(e){let t=e.entries||[],n=ct(e),a=new Map(n.map((s,c)=>[s,c])),o=!!e.isAoe||n.length>1,r=240;return Math.max(340,...t.map(s=>{if(s.effect==="heal"||s.effect==="last_breath")return 500;if(s.effect==="poison")return 380;if(s.effect==="poison_apply")return 460;if(s.effect==="shared_pain")return 320;let c=a.get(s)??0,l=o?c*70:0;return Ye(s).travel+l+r}))}function nn(e){Re.includes(e)&&(i.battleSpeed=e,localStorage.setItem(at,String(e)),ut(),mt())}function ut(){document.documentElement.style.setProperty("--battle-animation-scale",String(an())),[24,34,36,48,80,150,240,320,340,360,440,520,620,760,960].forEach(e=>{document.documentElement.style.setProperty(`--battle-duration-${e}`,`${V(e)}ms`)})}function an(){return 1/(Number(i.battleSpeed)||1)}function V(e){return Math.max(0,Math.round((Number(e)||0)*an()))}function lr(e){return`${Number(e)}x`}function mt(){document.querySelectorAll("[data-battle-speed]").forEach(e=>{let t=Number(e.dataset.battleSpeed)===i.battleSpeed;e.classList.toggle("active",t),e.classList.toggle("ad-primary-action",t),e.setAttribute("aria-pressed",t?"true":"false")})}function ma(e){return Number(J(e)?.typeId)===2}function B(e){let t=`.dungeon-demon-card[data-instance-id="${Gn(String(e))}"]`;return document.querySelector(`#teamGrid ${t}, #enemyGrid ${t}`)||document.querySelector(t)}function ge(e,t,n){let a=`${t}Timer`;e[a]&&clearTimeout(e[a]),e.classList.remove(t),e.offsetWidth,e.classList.add(t),e[a]=setTimeout(()=>{e.classList.remove(t),(t==="is-attacking"||t==="is-hit")&&e.classList.remove("is-player-attack","is-enemy-attack"),e[a]=null},V(n))}function on(e,t){let n=e.entries[0],a=Number.isInteger(e.playbackIndex)?e.playbackIndex:t,o=ha(e),r=n.effect==="poison_apply"?"Poisoned":n.effect==="heal"?`${n.targetHp} HP`:e.isAoe?"AOE":`${n.targetHp} HP`;return`
    <div class="fight-log-row ${ba(n)}" data-log-index="${a}">
      <span class="text-secondary">T${n.tick}</span>
      <span class="fight-log-side">${ya(n)}</span>
      <span class="fight-log-action">${fa(e)}</span>
      <span class="fight-log-damage">${o}</span>
      <span class="text-secondary">${r}</span>
    </div>
  `}function je(e,t={}){let n=[],a=t.combineCounters===!0;for(let o of e||[]){let r=n[n.length-1],s=o.targeting==="all"||o.targeting==="cleave"?[...n].reverse().find(m=>m.isAoe&&m.tick===o.tick&&m.attacker===o.attacker):null,l=o.effect==="thorns"||a&&o.effect==="retaliate"?[...n].reverse().find(m=>m.tick===o.tick&&m.entries.some(f=>f.attacker===o.target&&f.target===o.attacker)):null,d=o.effect==="poison"&&r?.primaryEffect==="poison"&&r.tick===o.tick&&r.entries.every(m=>m.target===o.target),u=s||l||(d?r:null);if(u){u.entries.push(o);continue}n.push({tick:o.tick,attacker:o.attacker,isAoe:o.targeting==="all"||o.targeting==="cleave",primaryEffect:o.effect||null,entries:[o]})}if(!a){let o=je(e,{combineCounters:!0}),r=new Map;o.forEach((s,c)=>{s.entries.forEach(l=>r.set(l,c))}),n.forEach(s=>{s.playbackIndex=r.get(s.entries[0])})}return n}function ga(e){return e?`<span class="fight-log-position">${e==="front"?"Front":"Back"}</span>`:""}function fa(e){let t=e.entries[0],n=ct(e).length,a=qt(t.attacker),o=`${qt(t.target)} ${ga(t.targetPosition)}`;return t.effect==="poison_apply"?`${a} applied poison to ${o}`:t.effect==="poison"?`${o} took poison damage`:t.effect==="heal"?`${a} healed ${o}`:t.effect==="last_breath"?`${o} survived at 1 HP`:t.effect==="shared_pain"?"Surviving allies gained direct damage":t.effect==="chain_explosion"?`${a} exploded into ${o}`:t.effect==="retaliate"?`${a} retaliated against ${o}`:t.effect==="thorns"?`${a} reflected damage to ${o}`:t.knockback?`${a} crushed ${o} back`:t.targeting==="chaotic"?`${a} chaotically struck ${o}`:t.targeting==="cleave"?`${a} cleaved ${n} demons`:e.isAoe?`${a} splashed ${n} enemies`:`${a} ${pa(t)} ${o}`}function pa(e){return e.effect==="poison_apply"||e.effect==="poison"?"poisoned":e.effect==="heal"?"healed":e.effect==="last_breath"?"survived":e.effect==="shared_pain"?"empowered":e.effect==="chain_explosion"?"exploded into":e.effect==="retaliate"?"retaliated against":e.effect==="thorns"?"reflected damage to":e.targeting==="chaotic"?"chaotically struck":e.targeting==="cleave"?"cleaved":e.targeting==="all"?"splashed":"hit"}function ha(e){let t=e.entries[0],n=ct(e).length,a=e.entries.find(o=>o.effect==="retaliate"||o.effect==="thorns");if(t.effect==="poison_apply")return"poison";if(t.effect==="poison")return`${rn(e)} poison`;if(t.effect==="heal")return`+${t.healing||0} hp`;if(t.effect==="last_breath")return"1 hp";if(t.effect==="shared_pain")return"+25% dmg";if(t.effect==="chain_explosion")return`${t.dmg||0} splash`;if(t.effect==="thorns")return`${t.dmg||0} thorns`;if(t.effect==="retaliate")return`${t.dmg||0} retaliation`;if(a){let o=a.effect==="thorns"?"thorns":"retaliation";return`${t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}, ${a.dmg} ${o}`}return t.knockback?`${t.dmg} dmg, push`:t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}function rn(e){return(e.entries||[]).filter(t=>t.effect==="poison").reduce((t,n)=>t+(Number(n.dmg)||0),0)}function Ke(){return new Map([...(i.run?.team||[]).map(e=>[e.instanceId,{...e,side:"player"}]),...(i.run?.enemies||[]).map(e=>[e.instanceId,{...e,side:"enemy"}])])}function ba(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||oe(e.attacker)==="player"?"is-player-action":"is-enemy-action"}function ya(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||oe(e.attacker)==="player"?"You":"Enemy"}function oe(e){return(i.run?.team||[]).some(t=>t.instanceId===e)?"player":(i.run?.enemies||[]).some(t=>t.instanceId===e)?"enemy":i.combatDemons.get(e)?.side?i.combatDemons.get(e).side:"unknown"}function J(e){return[...i.run?.team||[],...i.run?.enemies||[]].find(t=>t.instanceId===e)||i.combatDemons.get(e)||null}function qt(e){let t=[...i.run?.team||[],...i.run?.enemies||[]].find(n=>n.instanceId===e)||i.combatDemons.get(e);return t?`<span class="ad-${k(t.rarity)}">${k(t.species||"Demon")}</span>`:k(e)}var ka=(...e)=>h.getCollectionReinforcementLimit(...e),dr=(...e)=>h.getExplicitFormationRow(...e),ur=(...e)=>h.getRecruitTeamLimit(...e);var wa=(...e)=>h.getSelectedCollectionReinforcements(...e),cn=(...e)=>h.normalizeFormationRow(...e),mr=(...e)=>h.shouldShowCollectionMissingTag(...e);function ln(e,t={}){let n=t.side==="enemy"?"enemy":"player",a=gr(e||[],n),o=t.gridStyle?` style="${k(t.gridStyle)}"`:"";return`
    <div class="battle-formation battle-formation-grid battle-formation-${n}"${o} role="list" aria-label="${n==="enemy"?"Enemy":"Your team"} formation">
      ${a.map((r,s)=>dn(r,s,t,n)).join("")}
    </div>
  `}function dn(e,t,n,a){let o=gt(t,a),r=hr(t,a),s=pr[r]||"",c=t+1,l=n.side==="enemy"?"Enemy":"Your team",d=kr(n)?wr(o):"",u=!e&&vr(n,a),m=e?Sr(e,n):d||yr(o,c,{collectionTeamTrigger:u});return`
    <div class="formation-slot formation-lane formation-slot-${o} ${s} ${e?"has-demon":"is-empty"}" data-formation-position="${o}" data-formation-lane="${r}" data-formation-row="${t}" data-formation-slot="${t}" role="listitem" aria-label="${k(`${l} slot ${c}`)}">
      <div class="formation-lane-cards formation-slot-cards" data-formation-drop="${o}" data-formation-row="${t}">
        ${m}
      </div>
    </div>
  `}function gr(e=[],t="player"){let n=Array.from({length:9},()=>null),a=[],o=[];return(e||[]).slice(0,9).forEach((r,s)=>{let c=dr(r),l=c!==null?gt(c,t):null,d={...r,position:l||Lr(r,s)};if(c!==null&&!n[c]&&gt(c,t)===d.position){n[c]=d;return}a.push({demon:d,preferredCell:cn(s)})}),a.forEach(({demon:r,preferredCell:s})=>{if(!n[s]&&gt(s,t)===r.position){n[s]=r;return}o.push(r)}),o.forEach(r=>{let s=fr(n,t,r.position);s>=0&&(n[s]=r)}),n}function fr(e,t="player",n=null){for(let a of br(t,n))if(!e[a])return a;return e.findIndex(a=>!a)}function gt(e,t="player"){let n=cn(e)%3,a=t==="enemy"?0:2;return n===a?"front":"back"}var pr={front:"frontline",mid:"middleline",back:"backline"};function hr(e,t="player"){let n=cn(e)%3,a=t==="enemy"?0:2,o=t==="enemy"?2:0;return n===a?"front":n===o?"back":"mid"}function br(e="player",t=null){let n=e==="enemy"?0:2,a=1,o=e==="enemy"?2:0;return(e==="enemy"?t==="front"?[n,a]:t==="back"?[o,a]:[n,a,o]:t==="front"?[n]:t==="back"?[a,o]:[n,a,o]).flatMap(s=>Array.from({length:3},(c,l)=>l*3+s))}function yr(e,t,n={}){return n.collectionTeamTrigger?`
      <button class="formation-empty formation-empty-${e} collection-reinforcement-team-slot" type="button" data-slot-number="${t}" aria-label="Add a Collection demon to team slot ${t}" title="Add from collection">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </button>
    `:`
    <div class="formation-empty formation-empty-${e}" aria-hidden="true" data-slot-number="${t}">
      <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
    </div>
  `}function vr(e,t){return!!(t==="player"&&e.side==="player"&&i.isRecruiting&&i.run?.awaitingRecruit&&i.run?.collectionReinforcementAvailable&&(i.recruitDraftTeam||[]).length<ur()&&wa().length<ka())}function kr(e){return!!(i.isRecruiting&&e.side==="hand"&&i.run?.collectionReinforcementAvailable&&wa().length<ka())}function wr(e){return`
    <button class="dungeon-demon-card collection-reinforcement-placeholder ${i.collectionReinforcementPlaceholderInteracted?"":"is-collection-reinforcement-attention"}" type="button" data-collection-reinforcement-position="${e}" aria-label="Add from collection" title="Add from collection">
      <div class="collection-reinforcement-placeholder-icon">${x("plus",{size:48,strokeWidth:2.75})}</div>
    </button>
  `}function $r(e,t={}){let n=mr(e,t),a=[t.className||"",n?"is-new-encounter":""].filter(Boolean).join(" "),o=`${t.overlayHtml||""}${n?Rr():""}`;return Hn(e,{...t,className:a,overlayHtml:o})}function Sr(e,t){let n=t.side==="player",a=t.side==="hand"&&!!t.isTeamUpgrade,o=!!(t.allowRecruitDrag&&e.recruitSource),r=!!(t.allowRewardDrag&&e.rewardCandidateKey),s=!!(i.isRecruiting&&n),c=!!((t.allowFormationDrag||i.isRecruiting)&&n),l=o||r||c,d=["dungeon-demon-card",o?"is-recruit-draggable":"",r?"is-reward-draggable":"",a?"is-team-upgrade":"",e.recruitSource==="collection"&&!i.collectionReinforcementStagedInteracted?"is-collection-reinforcement-attention":"",s?"is-recruit-drop-target":"",xr(e)?"is-poisoned":""].filter(Boolean).join(" ");return $r(e,{className:d.replace("dungeon-demon-card","").trim(),defeated:Number(e.hp)<=0,active:i.selectedSwapInstanceId===e.instanceId||i.selectedRecruitRewardId===e.rewardId||i.selectedRewardDemonKey===e.rewardCandidateKey,overlayHtml:`${a?un():""}${Pr(e)}`,attributes:{"data-instance-id":e.instanceId,"data-reward-id":e.rewardId||null,"data-reward-candidate-key":e.rewardCandidateKey||null,"data-recruit-source":e.recruitSource||null,role:"button",tabindex:"0",draggable:l}})}function un(){let e=x("arrow-up",{className:"dungeon-team-upgrade-arrow",size:14,strokeWidth:3.25});return`
    <span class="dungeon-team-upgrade-indicator" role="img" aria-label="Upgrade available" title="Upgrade available">
      ${e}${e}
    </span>
  `}function Pr(e){let t=$a(e);return t?`
    <div class="demon-status-strip" aria-label="Status effects">
      <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${t} stack${t===1?"":"s"}" title="Poisoned">
        <span class="demon-status-icon">${Cr()}</span>
        ${t>1?`<span class="demon-status-count">${k(t)}</span>`:""}
      </span>
    </div>
  `:""}function Rr(){return`
    <div class="new-encounter-badge" title="Missing from collection" aria-label="Missing from collection">
      New
    </div>
  `}function xr(e){return $a(e)>0}function $a(e){return(e.statusEffects?.poison||[]).length}function Cr(){return x("poison")}function Lr(e,t=0){return e.position==="back"||!e.position&&t>0?"back":"front"}function Pa(e){if(!e||Number(e.spentPoints)<=0)return null;let t=e.bonuses||{},n=[[t.maxHpFlat,"max HP"],[t.attackFlat,"attack damage"],[t.speedFlat,"Speed"],[t.healingFlat,"healing"],[t.thornsFlat,"thorns damage"],[t.aoeDamageFlat,"AOE damage"],[t.poisonDamageFlat,"poison damage"]].filter(([r])=>Number(r)>0).map(([r,s])=>`+${Sa(r)} ${s}`),a=[[t.maxHpPercent,"max HP"],[t.attackPercent,"attack damage"],[t.speedPercent,"Speed"],[t.healingPercent,"healing"],[t.thornsPercent,"thorns"],[t.aoeDamagePercent,"AOE damage"],[t.poisonDamagePercent,"poison damage"]].filter(([r])=>Number(r)>0).map(([r,s])=>`+${Sa(r)}% ${s}`),o=[...n,...a];return{id:"account-level-power",name:"Level Power",description:o.join(", "),tooltip:["Level Power",...o].join(`
`),rarity:"account",icon:"sparkles",tags:["Permanent","Account"]}}function Sa(e){let t=Number(e)||0;return Number.isInteger(t)?String(t):t.toFixed(1).replace(/\.0$/,"")}var kd=window.AmongDemons.audio;var Ra=!1;function Er(e){let t=String(e.rarity||"common").toLowerCase(),n=Ar(e),a=Tr(n),o=e.href?"a":"button",r=e.href?`href="${k(e.href)}"`:'type="button"',s=e.attention?"is-level-power-attention":"",c=e.expiresAt?"is-temporary":"";return`
    <${o}
      class="active-pact-chip is-${k(t)} ${s} ${c}"
      ${r}
      data-active-pact-id="${k(e.id)}"
      data-tooltip="${a}"
      aria-label="${a}"
    >
      <span class="active-pact-chip-icon" aria-hidden="true">
        ${x(e.icon||"sparkles",{size:28,strokeWidth:1.9})}
      </span>
    </${o}>
  `}function La(e=[],t={}){let n=[],a=new Map,o=t.onlySource?String(t.onlySource):"";return e.forEach(r=>{if(!r?.id)return;if(o&&String(r.source||"")!==o){n.push(r);return}let s=a.get(r.id);if(s){s.stackCount+=1;return}let c={...r,stackCount:1};a.set(r.id,c),n.push(c)}),n}function Ea(e,t={}){let n=Math.max(1,Math.trunc(Number(e?.stackCount)||1)),a=t.stackClass||"active-pact-stack",o=t.countClass||"active-pact-stack-count",r=n>1?{...e,tooltip:`${e.name||e.id}: ${Br(e,n)}`}:e;return`
    <span class="${k(a)}">
      ${Er(r)}
      ${n>1?`
        <span class="${k(o)}" aria-label="${n} stacks">${n}</span>
      `:""}
    </span>
  `}function Br(e,t){let n=(Array.isArray(e?.effects)?e.effects:[]).filter(s=>String(s?.type||"").endsWith("_mult")).map(s=>Math.abs((Number(s.value)-1)*100)).filter(s=>Number.isFinite(s)&&s>0),a=String(e?.description||""),o=0,r=a.replace(/(\d+(?:\.\d+)?)%/g,(s,c)=>{let l=Number(c),d=n.findIndex(m=>Math.abs(m-l)<.001);if(d<0)return s;n.splice(d,1),o+=1;let u=l*t;return`${xa(u)}% (${t} x ${xa(l)}%)`});return o>0?r:`${a.replace(/\.$/,"")} (${t} copies).`}function xa(e){let t=Math.round((Number(e)||0)*100)/100;return Number.isInteger(t)?String(t):String(t).replace(/0+$/,"").replace(/\.$/,"")}function Ar(e={}){let t=e.tooltip||`${e.name||e.id}: ${e.description||""}`,n=Dr(e);return[t,n].filter(Boolean).join(`
`)}function Dr(e={}){let t=Date.parse(e.expiresAt||"");if(!Number.isFinite(t))return"";let n=Math.ceil((t-Date.now())/1e3);return n<=0?"Expired":`Expires in ${Mr(n)}`}function Mr(e){let t=Math.max(0,Math.floor(Number(e)||0)),n=Math.floor(t/86400),a=Math.floor(t%86400/3600),o=Math.floor(t%3600/60);return n>0?`${n}d ${a}h`:a>0?`${a}h ${o}m`:o>0?`${o}m`:`${t}s`}function Tr(e){return k(e).replace(/\n/g,"&#10;")}function Ba(){Ra||(Ra=!0,document.addEventListener("pointerover",e=>{let t=e.target.closest?.(".active-pact-chip");t&&ft(t)}),document.addEventListener("focusin",e=>{let t=e.target.closest?.(".active-pact-chip");t&&ft(t)}),document.addEventListener("click",e=>{let t=e.target.closest?.(".active-pact-chip");document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(n=>{n!==t&&n.classList.remove("is-tooltip-visible")}),t&&(ft(t),t.classList.add("is-tooltip-visible"))}),document.addEventListener("keydown",e=>{e.key==="Escape"&&document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(t=>{t.classList.remove("is-tooltip-visible")})}),window.addEventListener("resize",Ca),window.addEventListener("scroll",Ca,!0))}function Ca(){document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(ft)}function ft(e){if(!e)return;let t=e.getBoundingClientRect(),n=Math.min(384,window.innerWidth*.88),a=Fr(t.left+t.width/2,n/2+8,window.innerWidth-n/2-8),o=t.top>118,r=o?Math.max(8,t.top-8):Math.min(window.innerHeight-8,t.bottom+8);e.style.setProperty("--active-pact-tooltip-left",`${a}px`),e.style.setProperty("--active-pact-tooltip-top",`${r}px`),e.classList.toggle("is-tooltip-below",!o)}function Fr(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}var Ir=window.AmongDemons.audio,Nr=window.AmongDemons.bagVisuals?.renderItemVisual||(()=>'<span class="bag-item-renderer bag-unknown-visual" aria-hidden="true"></span>');var _r=(...e)=>h.bindCollectionReinforcementPlaceholders(...e),Hr=(...e)=>h.bindDemonDetailCards(...e),Or=(...e)=>h.bindFormationDragAndDrop(...e),zr=(...e)=>h.bindPointerDragAndDrop(...e),Gr=(...e)=>h.bindRecruitDragAndDrop(...e),Vr=(...e)=>h.bindRewardDragAndDrop(...e),pn=(...e)=>h.canExtractRun(...e),Aa=(...e)=>h.formatBattleSpeed(...e),qr=(...e)=>h.getRecruitPreviewEnemyTeam(...e),Yr=(...e)=>h.getRecruitPreviewHand(...e),Wr=(...e)=>h.getRecruitPreviewTeam(...e),Da=(...e)=>h.applyDungeonCombatStatPreviewToDemon(...e),jr=(...e)=>h.getRecruitTeamLimit(...e),Kr=(...e)=>h.groupCombatLog(...e),qa=(...e)=>h.hasPendingBuffChoices(...e);var Ur=(...e)=>h.isExtractionUnlocked(...e),Xr=(...e)=>h.isCurrentFloorBattle(...e),Zr=(...e)=>h.pauseCombatPlayback(...e),Jr=(...e)=>h.playEnemyRevealEffect(...e),Qr=(...e)=>h.playPendingHandFlowAnimation(...e),ei=(...e)=>h.playRecruitSwapEffect(...e),Ya=(...e)=>h.renderButtonMeleeIcon(...e);var Ma=(...e)=>h.renderDemonCards(...e),ti=(...e)=>h.renderDungeonDemonCard(...e),ni=(...e)=>h.bindActivePactTooltips(...e),ai=(...e)=>h.getActiveBuffs(...e),oi=(...e)=>h.createLevelPowerBuff(...e),mn=(...e)=>h.renderDemonicPacts(...e),ri=(...e)=>h.toggleDemonicPactView(...e);var ii=(...e)=>h.renderFightLogRow(...e),si=(...e)=>h.renderHandBar(...e),ci=(...e)=>h.renderRewardBox(...e),hn=(...e)=>h.replayFight(...e),li=(...e)=>h.requestRecruitContinue(...e),di=(...e)=>h.resumeCombatPlayback(...e),ui=(...e)=>h.setBattleSpeed(...e),mi=(...e)=>h.skipCombatPlayback(...e),gi=(...e)=>h.startNewDungeonAfterDefeat(...e),Wa=(...e)=>h.startRun(...e),fi=(...e)=>h.stepCombatPlayback(...e);function bn(){let e=i.run,t=!!e;if(b.runLoading&&b.runLoading.classList.toggle("d-none",!i.isLoading),b.runEmpty.classList.toggle("d-none",i.isLoading||t),b.runPanel.classList.toggle("d-none",i.isLoading||!t),Li(),Ri(),i.isLoading){ue&&ue.disconnect(),i.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.fightLog.innerHTML="Opening the latest dungeon state...",b.fightLog.classList.add("text-muted"),mn(!1),Xe(),Ce();return}if(!e){ue&&ue.disconnect(),b.runPanel?.querySelector(".dungeon-arena")?.classList.remove("is-hand-strategy"),b.dungeonBottomPanel?.classList.add("d-none"),i.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.dungeonHandBar?.classList.add("d-none"),b.dungeonRewardBox?.classList.add("d-none"),mn(!1),Fa(),Ia(),Na(),b.runEmpty.innerHTML=i.endSummary?pi():hi(),bi(),Ta(),Xe(),Ce();return}let n=qa(e),a=!!(i.isRecruiting&&e.awaitingRecruit),o=b.runPanel?.querySelector(".dungeon-arena"),r=(a?Wr():e.team||[]).map(Da),s=a&&i.isEnemyPreviewDeferred?[]:a?qr():e.enemies||[],c=!!e.replayOnly,l=!!(i.isBattleAnimating||c),d=!!(i.isPactTeamPreview&&n),u=!!(!a&&l),m=(a?Yr():[]).map(Da),f=u?"battle":"recruit",P=!!(n&&!i.isPactRevealPending&&!i.isBattleAnimating&&!i.isResultAnimating),y=!!(n||i.isPactRevealPending),S=!0,v=!!(a&&!y),R=v,M=!!(!n&&!i.isResultAnimating&&pn()),F=_a(b.teamGrid),T=_a(b.enemyGrid),I=["player",e.awaitingRecruit?"recruit":"battle",i.isRecruiting?"interactive":"locked",n?"pacts":"ready"].join(":");b.dungeonBottomPanel?.classList.toggle("d-none",!S),(!M||i.isBattleAnimating||i.isResultAnimating)&&(i.isMobileRewardBoxOpen=!1),b.dungeonBottomPanel?.classList.toggle("is-battle-active",l||d),b.dungeonBottomPanel?.classList.toggle("is-mobile-reward-open",!!(i.isMobileRewardBoxOpen&&M&&!i.isBattleAnimating)),o?.classList.toggle("is-hand-strategy",a),ee(b.teamGrid,Ma(r,{side:"player",allowFormationDrag:e.status==="active"&&!y&&(!e.awaitingRecruit||i.isRecruiting),gridStyle:F}),{patchFormationGrid:!0,renderKey:I}),ee(b.enemyGrid,Ma(a||(e.team||[]).length?s:[],{side:"enemy",allowRecruitDrag:!1,gridStyle:T}),{patchFormationGrid:!0,renderKey:"enemy"}),si(m,S,v,f),ci(S,R,M),mn(P),Fa(a?r.length:null,a?jr():null),Ia(a?e.nextEnemyPressure:e.enemyPressure,a?e.nextEnemyBuffs:e.enemyBuffs,a?e.nextEnemyTeamBuffs:e.enemyTeamBuffs),Na(),Or(),Gr(),Vr(),zr(),_r(),Hr(),ni(),ei(),Jr(),xi(),Ta(),Xe(),Ce(),Qr(a)}function pi(){let e=i.endSummary||{},t=e.demon,n=e.echo,a=e.outcome==="defeat";return`
    <div class="dungeon-end-screen ${a?"is-defeat":"is-extraction"}">
      <div class="dungeon-end-copy">
        <span class="dungeon-phase-eyebrow">${a?"Defeat":"Extraction"}</span>
        <h2>${k(e.title||"Run complete")}</h2>
        <p>${k(e.message||"Run extracted.")}</p>
      </div>
      ${t?`
        <div class="dungeon-end-demon" aria-label="Collected demon">
          ${ti(t,{className:"dungeon-end-demon-card",suppressCollectionMissingTag:!0,attributes:{"data-instance-id":t.instanceId||`end-${t.id||"demon"}`}})}
        </div>
      `:""}
      ${n?`
        <div
          class="dungeon-end-demon dungeon-end-echo"
          style="--item-rarity: ${k(Tt(n.rarity||"common"))}"
          aria-label="Extracted ${k(`${rt(n.rarity||"common")} ${n.species||"Demon"} Echo`)}"
        >
          <span class="dungeon-end-echo-visual">
            ${Nr(n,{context:"slot"})}
          </span>
        </div>
      `:""}
      <div class="dungeon-end-rewards" aria-label="Rewards obtained">
        ${t?`<span>${x("stars")}${k(t.species||"Demon")}</span>`:""}
        ${n?`<span>${x("sparkles")}${k(`${rt(n.rarity||"common")} ${n.species||"Demon"} Echo`)}</span>`:""}
        <span>${Number(e.xp)||0} XP</span>
        ${Mt(Number(e.souls)||0,{className:"soul-chip dungeon-end-soul-amount"})}
      </div>
      <div class="dungeon-end-actions">
        ${a?"":'<a class="btn btn-glass-muted" href="/camp">Leave</a>'}
        ${i.endedReplayRun?.lastBattle?.combatLog?.length?`
          <button class="btn btn-glass-muted btn-icon-only" id="replayEndedDungeonBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
            ${x("list-restart")}
          </button>
        `:""}
        ${a?`
          <a class="btn btn-glass-muted" id="trainDemonsBtn" href="/collection">
            ${x("swords")}
            Train Demons
          </a>
        `:`
          <a class="btn btn-glass-muted" href="/bag">
            ${x("amphora")}
            View Bag
          </a>
        `}
        <a class="btn btn-primary" href="/dungeon">
          ${x("play")}
          New Dungeon
        </a>
      </div>
    </div>
  `}function hi(){return`
    <img src="/app/images/demons/1.png" alt="Boof Nitza demon preparing for a dungeon run" width="1024" height="1024" loading="lazy" decoding="async">
    <p class="mb-0 text-muted">Ready to descend into the dungeon?</p>
    <button class="btn btn-primary dungeon-start-prompt-btn" id="startNewDungeonBtn" type="button">
      ${x("play")}
      Start Dungeon
    </button>
  `}function bi(){N(document.getElementById("startNewDungeonBtn"),async()=>{On(),await Wa(),bn()}),N(document.getElementById("replayEndedDungeonBtn"),hn)}function Ta(){let t=(i.combatLog.length?Kr(i.combatLog).map((n,a)=>`
      ${ii(n,a)}
    `).join(""):"")+Ei();if(!t.trim()){b.fightLog.innerHTML="Fight log will appear here after a battle.",b.fightLog.classList.add("text-muted");return}b.fightLog.classList.remove("text-muted"),b.fightLog.innerHTML=t}function ja(e,t={}){let n=document.querySelector(".battle-result-burst");n&&n.remove();let a=e==="defeat",o=t.syncActions!==!1,s=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?900:a?3e3:2200;i.isResultAnimating=!0,Ir?.play(e==="victory"?"sfx.battle.victory":"sfx.battle.defeat",{volume:.96}),o&&(Xe(),Ce());let c=document.createElement("div");return c.className=`battle-result-burst is-${e}`,c.style.setProperty("--battle-result-duration",`${s}ms`),c.setAttribute("role","status"),c.setAttribute("aria-live","polite"),c.innerHTML=`
    <div class="battle-result-burst-ring" aria-hidden="true"></div>
    ${a?'<div class="battle-result-burst-wound" aria-hidden="true"></div>':""}
    <div class="battle-result-burst-text">${e==="victory"?"Victory":"Defeat"}</div>
    ${a?'<div class="battle-result-burst-subtitle">Your demons have fallen</div>':""}
    <div class="battle-result-burst-sparks" aria-hidden="true">
      ${Array.from({length:a?16:14},()=>"<span></span>").join("")}
    </div>
  `,document.body.appendChild(c),new Promise(l=>{setTimeout(()=>{c.remove(),i.isResultAnimating=!1,o&&(Xe(),Ce()),l()},s)})}function Fa(e=null,t=null){if(!b.teamSideTitle)return;let n=Number.isFinite(e)&&Number.isFinite(t)?`<span class="battle-side-count" aria-label="${e} of ${t} team slots used">${e}/${t}</span>`:"",a=yi();b.teamSideTitle.innerHTML=`
    <span>Your Team</span>
    ${n?` ${n}`:""}
    ${Ze(a,{side:"player"})}
  `}function Ia(e=null,t=[],n=[]){if(!b.enemySideTitle)return;let a=i.run?.enemyLabel||"Enemies";b.enemySideTitle.innerHTML=`
    <span>${k(a)}</span>
    ${wi(e)}
    ${$i(t)}
    ${Ze(n,{side:"enemy"})}
  `}function yi(e=i.run){if(!e)return[];let t=i.statPoints?oi(i.statPoints):null;return[...t?[t]:[],...ai(e)].filter(n=>n?.id||n?.name)}function Ze(e=[],t={}){let n=vi(e);if(!n.length)return"";let a=n.reduce((c,l)=>c+l.stackCount,0),o=t.side==="enemy"?"enemy":"player",r=t.label||"Buffs",s=`battle-${o}-buff-summary-tooltip`;return`
    <span
      class="enemy-pressure-chip battle-buff-summary-chip is-${o}-buffs"
      tabindex="0"
      aria-label="${k(`${r}, ${a} active`)}"
      aria-describedby="${s}"
    >
      ${x("sparkles")}
      <span>${k(r)}</span>
      <strong>${a}</strong>
      <span class="battle-buff-summary-tooltip" id="${s}" role="tooltip">
        ${n.map(ki).join("")}
      </span>
    </span>
  `}function vi(e=[]){let t=[],n=new Map;return(Array.isArray(e)?e:[]).forEach((a,o)=>{if(!a)return;let r=typeof a=="string"?{id:a,name:a,description:""}:a,s=String(r.id||r.name||`buff-${o+1}`),c=Math.max(1,Math.trunc(Number(r.stackCount)||1)),l=n.get(s);if(l){l.stackCount+=c;return}let d={...r,id:s,stackCount:c};n.set(s,d),t.push(d)}),t}function ki(e={}){let t=String(e.name||e.id||"Buff"),n=e.stackCount>1?` \xD7${e.stackCount}`:"",a=String(e.description||e.tooltip||"").trim(),o=a.startsWith(`${t}
`)?a.slice(t.length+1).trim():a;return`
    <span class="battle-buff-summary-row">
      <strong class="battle-buff-summary-name">${k(t)}${n}</strong>
      ${o?`<span class="battle-buff-summary-description">${k(o).replace(/\n/g,"<br>")}</span>`:""}
    </span>
  `}function wi(e=null){if(!e?.active)return"";let t=De(e.hpBonusPct),n=De(e.atkBonusPct),a=De(e.speedBonusPct),o=Math.max(0,Math.round(Number(e.level)||0));if(o<=0)return"";let r="battle-enemy-terror-tooltip";return`
    <span
      class="enemy-pressure-chip terror-pressure-chip"
      tabindex="0"
      aria-label="${k(`Terror ${o}. Enemy HP ${t}. Enemy Attack ${n}. Enemy Speed ${a}.`)}"
      aria-describedby="${r}"
    >
      <span>Terror</span>
      <strong>${k(String(o))}</strong>
      <span class="terror-pressure-tooltip" id="${r}" role="tooltip">
        <strong class="terror-pressure-title">Terror ${k(String(o))}</strong>
        <span class="terror-pressure-stat">Enemy HP ${t}</span>
        <span class="terror-pressure-stat">Enemy Attack ${n}</span>
        <span class="terror-pressure-stat">Enemy Speed ${a}</span>
      </span>
    </span>
  `}function $i(e=[]){let t=(Array.isArray(e)?e:[]).filter(Boolean);return t.length?t.map(Si).join(""):""}function Si(e={}){let t=String(e.name||e.id||"Boss Buff"),n=String(e.description||""),a=e.id==="rarity-convergence",o=a?[t,n,`Host HP ${De(e.hpBonusPct)}`,`Host Attack ${De(e.atkBonusPct)}`,`Host Speed ${De(e.speedBonusPct)}`].join(`
`):[t,n].filter(Boolean).join(`
`),r=Pi(o),s=a?` style="--enemy-buff-color: ${k(Tt(e.rarity||"common"))}"`:"";return`
    <span
      class="enemy-pressure-chip enemy-buff-chip${a?" is-rarity-convergence":""}"
      ${s}
      tabindex="0"
      data-tooltip="${r}"
      aria-label="${r}"
    >
      ${x(e.icon||"sparkles")}
      <span>${k(t)}</span>
    </span>
  `}function De(e){return`+${Math.max(0,Math.round(Number(e)||0))}%`}function Pi(e){return k(e).replace(/\n/g,"&#10;")}function Na(){if(!b.dungeonJoiner)return;let e=i.run?Math.max(1,Number(i.run.currentFloor)||1):null;b.dungeonJoiner.classList.remove("is-recruiting"),b.dungeonJoiner.innerHTML=`
    <div class="dungeon-center-actions" id="dungeonCenterActions"></div>
    ${e?`<span class="dungeon-floor-marker" aria-label="Current floor ${e}"><span>Floor</span><strong>${e}</strong></span>`:""}
  `,b.dungeonCenterActions=document.getElementById("dungeonCenterActions")}function Ri(){fe("combat")}function pt(){let e=document.getElementById("battleLogPanel")?.classList.contains("show");fe(e?"combat":"log")}function fe(e){let t=e==="log";document.getElementById("combatPanel")?.classList.toggle("show",!t),document.getElementById("combatPanel")?.classList.toggle("active",!t),document.getElementById("battleLogPanel")?.classList.toggle("show",t),document.getElementById("battleLogPanel")?.classList.toggle("active",t)}function xi(){ue&&ue.disconnect();let e=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards")),t=Array.from(document.querySelectorAll(".battle-side > #teamGrid, .battle-side > #enemyGrid"));if(!e.length&&!t.length)return;let n=new ResizeObserver(()=>gn());_n(n),e.forEach(a=>n.observe(a)),t.forEach(a=>n.observe(a)),document.querySelectorAll(".battle-side .dungeon-demon-card-image img").forEach(a=>{a.complete||a.addEventListener("load",gn,{once:!0})}),fn(),gn()}function gn(){fn(),requestAnimationFrame(()=>{fn();let e=[],t=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards"));if(t.forEach(a=>{let o=Array.from(a.querySelectorAll(".dungeon-demon-card"));if(a.classList.remove("is-compressed"),a.style.removeProperty("--dungeon-demon-card-width"),a.style.removeProperty("--dungeon-demon-card-height"),!o.length)return;let r=a.getBoundingClientRect();if(!(o[o.length-1].getBoundingClientRect().bottom>r.bottom+1||a.scrollHeight>a.clientHeight+1))return;let l=parseFloat(getComputedStyle(a).rowGap||getComputedStyle(a).gap)||0,d=getComputedStyle(a).flexDirection.startsWith("row"),u=d?r.height:(r.height-l*(o.length-1))/o.length,m=d?(r.width-l*(o.length-1))/o.length:u,f=Math.max(46,Math.min(148,u,m));e.push(f)}),!e.length)return;let n=Math.min(...e);t.forEach(a=>{a.style.setProperty("--dungeon-demon-card-width",`${n}px`),a.style.setProperty("--dungeon-demon-card-height",`${n}px`),a.classList.add("is-compressed")})})}function fn(){Array.from(document.querySelectorAll(".battle-side .battle-formation-grid")).forEach(t=>{let n=t.parentElement;if(!n)return;let a=n.getBoundingClientRect();if(a.width<=0||a.height<=0)return;let o=getComputedStyle(t),r=3,s=3,c=1,l=Ue(o.gap||o.rowGap||o.columnGap),d=Ue(o.paddingLeft)+Ue(o.paddingRight),u=Ue(o.paddingTop)+Ue(o.paddingBottom),m=(a.width-d-l*(r-1))/r,f=(a.height-u-l*(s-1))/(s*c),P=Math.max(42,Math.min(260,m,f));Number.isFinite(P)&&Ci(t,P,P*c)})}function _a(e){let t=e?.querySelector?.(".battle-formation-grid"),n=t?.style.getPropertyValue("--dungeon-demon-card-width"),a=t?.style.getPropertyValue("--dungeon-demon-card-height");return!n||!a?"":`--dungeon-demon-card-width: ${n}; --dungeon-demon-card-height: ${a};`}function Ci(e,t,n){let a=`${t}px`,o=`${n}px`;e.style.getPropertyValue("--dungeon-demon-card-width")!==a&&e.style.setProperty("--dungeon-demon-card-width",a),e.style.getPropertyValue("--dungeon-demon-card-height")!==o&&e.style.setProperty("--dungeon-demon-card-height",o)}function Ue(e){let t=parseFloat(e);return Number.isFinite(t)?t:0}function Li(){b.dungeonRewardStrip&&(b.dungeonRewardStrip.innerHTML="")}function Ei(){return i.endNotice?`<div class="${i.endNotice.type==="warning"?"fight-log-notice fight-log-end-notice text-warning":"fight-log-notice fight-log-end-notice text-success"}">${i.endNotice.html||k(i.endNotice.text)}</div>`:""}function Ha(e){return b.dungeonBottomControls?ee(b.dungeonBottomControls,e):!1}function yn(e,t){return`
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight" ${e?"":"disabled"}>
      ${x("list-restart")}
    </button>
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogToggleBtn" type="button" title="Fight Log" aria-label="Fight Log" ${t?"":"disabled"}>
      ${x("log")}
    </button>
  `}function Oa(e,t){return b.dungeonReplayLogBox?ee(b.dungeonReplayLogBox,yn(e,t)):!1}function Xe(){if(i.isLoading){za(),Ga({canReplay:!1,canViewLog:!1,canExtract:!1}),Ha(""),Oa(!1,!1);return}let e=i.run?.status==="defeated",t=!i.endSummary&&(!i.run||e||i.run.status==="ended"),n=!!(i.run&&!i.isResultAnimating&&i.isBattleAnimating&&i.combatPlayback),a=qa(i.run),o=!!(i.isPactTeamPreview&&a),r=!!(Xr(i.run)&&(i.run?.lastBattle?.combatLog?.length||i.combatLog.length)),s=!!(!i.isBattleAnimating&&!i.isResultAnimating&&!a&&r),c=s,l=!!(!a&&!i.isResultAnimating&&i.run?.awaitingRecruit&&i.isRecruiting),d=!!(!i.isBattleAnimating&&!i.isResultAnimating&&!a&&pn()),u=!!i.isRecruitContinuePending,m=!!i.isBattleAnimating,f={canFight:l||u||m,isPending:u,isFighting:m,canStart:t&&!!i.run,isDefeated:e,canReplay:s,canViewLog:c,canExtract:d};za(f);let P=Ga(f),y=o?wn():n?`${vn()}${kn()}${$n()}`:"",S=Ha(y),v=Oa(s,c);!S&&!v&&!P||(ot("[data-battle-speed]",R=>ui(Number(R.dataset.battleSpeed))),N(document.getElementById("battlePlaybackToggleBtn"),()=>{i.combatPlayback?.isPaused?di():Zr()}),ot("[data-battle-step]",R=>fi(Number(R.dataset.battleStep))),N(document.getElementById("battlePlaybackSkipBtn"),mi),N(document.getElementById("demonicPactReturnBtn"),ri),N(document.getElementById("fightLogReplayBtn"),hn),N(document.getElementById("fightLogToggleBtn"),pt))}function za(e={}){let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canStart:o=!1,isDefeated:r=!1}=e;if(o){ee(b.dungeonCenterActions,`
      <div class="dungeon-center-action-stack">
        <button class="btn btn-primary dungeon-fight-btn dungeon-center-start-btn" id="dungeonCenterStartBtn" type="button" title="${r?"Start a new dungeon":"Start the dungeon"}">
          ${x("play")}
          <span>${r?"New Dungeon":"Start Dungeon"}</span>
        </button>
      </div>
    `)&&N(document.getElementById("dungeonCenterStartBtn"),r?gi:Wa);return}let s=a?"fighting":n?"preparing":"ready",c=s!=="ready",l=s==="fighting"?"Fighting":s==="preparing"?"Preparing":"Fight",d=s==="fighting"?"Fight in progress":s==="preparing"?"Preparing the next fight":"Start the next fight";ee(b.dungeonCenterActions,t?`
    <div class="dungeon-center-action-stack">
      <span class="dungeon-fight-mark" aria-hidden="true">${Ya()}</span>
      <button
        class="btn btn-primary dungeon-fight-btn ${s==="preparing"?"is-loading":""} ${s==="fighting"?"is-fighting":""}"
        id="dungeonFightBtn"
        type="button"
        title="${d}"
        aria-label="${d}"
        ${c?'disabled aria-busy="true"':""}
      >
        ${s==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':""}
        <span>${l}</span>
      </button>
    </div>
  `:"")&&Ka()}function Ga(e={}){if(!b.dungeonMobileFightBox)return!1;if(i.isLoading)return ee(b.dungeonMobileFightBox,"");let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canReplay:o=!1,canViewLog:r=!1,canExtract:s=!1}=e,c=a?"fighting":n?"preparing":"ready",l=c!=="ready",d=c==="fighting"?"Fighting":c==="preparing"?"Preparing":"Fight",u=c==="fighting"?"Fight in progress":c==="preparing"?"Preparing the next fight":"Start the next fight",m=!!i.run,f=i.activeHandTab==="pacts"?"pacts":"hand",P=!!(i.isMobileRewardBoxOpen&&s),y=!m||a,S=Ur(i.run)?"Extract":"Win your first fight to unlock extraction",v=ee(b.dungeonMobileFightBox,`
    <button
      class="dungeon-mobile-nav-btn ${f==="hand"?"active":""}"
      id="dungeonMobileHandBtn"
      type="button"
      title="Hand"
      aria-label="Hand"
      aria-pressed="${f==="hand"?"true":"false"}"
      ${y?"disabled":""}
    >
      ${x("collection")}
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
      ${x("stars")}
      <span class="visually-hidden">Buffs</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn"
      id="dungeonMobileReplayBtn"
      type="button"
      title="Replay Fight"
      aria-label="Replay Fight"
      ${o?"":"disabled"}
    >
      ${x("list-restart")}
      <span class="visually-hidden">Replay Fight</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn"
      id="dungeonMobileLogBtn"
      type="button"
      title="Fight Log"
      aria-label="Fight Log"
      ${r?"":"disabled"}
    >
      ${x("log")}
      <span class="visually-hidden">Fight Log</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${P?"active":""}"
      id="dungeonMobileExtractBtn"
      type="button"
      title="${S}"
      aria-label="${S}"
      aria-pressed="${P?"true":"false"}"
      ${s?"":"disabled"}
    >
      ${x("flag")}
      <span class="visually-hidden">Extract</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn dungeon-fight-btn dungeon-mobile-fight-btn ad-primary-action ${c==="preparing"?"is-loading":""} ${c==="fighting"?"is-fighting":""}"
      id="dungeonMobileFightBtn"
      type="button"
      title="${u}"
      aria-label="${u}"
      ${!t||l?"disabled":""}
      ${l?'aria-busy="true"':""}
    >
      ${c==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':Ya()}
      <span class="visually-hidden">${d}</span>
    </button>
  `);return v&&(Bi(),Ka()),v}function Bi(){N(document.getElementById("dungeonMobileHandBtn"),()=>Va("hand")),N(document.getElementById("dungeonMobileBuffsBtn"),()=>Va("pacts")),N(document.getElementById("dungeonMobileReplayBtn"),hn),N(document.getElementById("dungeonMobileLogBtn"),pt),N(document.getElementById("dungeonMobileExtractBtn"),Ai)}function Va(e){!i.run||i.isBattleAnimating||(i.activeHandTab=e==="pacts"?"pacts":"hand",bn())}function Ai(){i.isBattleAnimating||i.isResultAnimating||!pn()||(i.isMobileRewardBoxOpen=!i.isMobileRewardBoxOpen,bn())}function vn(){let e=i.combatPlayback||{},t=!!e.isPaused,n=Number(e.currentIndex)||0,a=Number(e.totalSteps)||0,o=n>0,r=n<a;return`
    <div class="battle-playback-control" role="group" aria-label="Battle playback">
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="-1"
        title="Last attack"
        aria-label="Last attack"
        ${o?"":"disabled"}
      >
        ${x("last-attack")}
      </button>
      <button
        class="battle-playback-btn ad-primary-action"
        id="battlePlaybackToggleBtn"
        type="button"
        title="${t?"Play":"Pause"}"
        aria-label="${t?"Play":"Pause"}"
      >
        ${x(t?"play":"pause")}
      </button>
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="1"
        title="Next attack"
        aria-label="Next attack"
        ${r?"":"disabled"}
      >
        ${x("next-attack")}
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
        ${x("sparkles")}
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
        ${x("x")}
      </button>
    </div>
  `}function Ka(){[document.getElementById("dungeonFightBtn"),document.getElementById("dungeonMobileFightBtn")].forEach(e=>{!e||e.dataset.dungeonFightBound==="true"||(e.dataset.dungeonFightBound="true",N(e,t=>li(t.currentTarget)))})}var xt=window.AmongDemons.api,he=window.AmongDemons.audio,Di=window.AmongDemons.ui.renderDemonCard,Mi=window.AmongDemons.ui.renderCombatStats,L=window.AmongDemons.ui.renderIcon||(()=>""),Qe=Object.freeze(["common","uncommon","rare","epic","legendary","mythic"]),Me=2,Se=20,Ua=Object.freeze({common:1,uncommon:2,rare:3,epic:4,legendary:5,mythic:7}),g={},Xa=new Set,q=!1,$=null,p=null,se=!1,w=null,vt=!1,Cn=0,Q=0,Te=null,ht=null,Za=0,Ln=new Set,En=[],Ja=null,et=0,bt=0,nt=null;Fn({...sn,battle:co,getExplicitFormationRow:e=>ce(e?.formationSlot),normalizeFormationRow:e=>ce(e)??0,shouldShowCollectionMissingTag:()=>!1,getDemonPosition:Rs,renderDemonStatus:xs,renderDungeonCenterActions:xo,renderFightLog:ho,renderFightLogActions:bo,renderRun:_});Bs(Ti);async function Ti(){if(!window.AmongDemons.getToken()){window.location.href=window.AmongDemons.appUrl("/login?next=/ranked");return}Fi(),Ii(),Ba(),ut(),he?.setScene({music:"music.default"}),await Ni()}function Fi(){["rankedMessage","runLoading","runEmpty","runPanel","rankedBottomPanel","rankedHandStatus","rankedPreparation","dungeonHandBar","dungeonBottomControls","dungeonReplayLogBox","teamSideTitle","enemySideTitle","teamGrid","enemyGrid","dungeonCenterActions","fightLog","demonicPactOverlay","demonicPactViewToggle","rankedPactGrid","rankedEndRunModal","rankedEndRunEyebrow","rankedEndRunFloor","rankedEndRunGain","rankedEndRunRating","rankedVictoryModal","rankedVictoryRankImage","rankedVictoryDivision","rankedVictoryRankGain","rankedVictorySummary"].forEach(e=>{g[e]=document.getElementById(e)})}function Ii(){document.addEventListener("click",async e=>{if(e.target.closest("[data-ranked-end-confirm]")){e.preventDefault(),await zi();return}let n=e.target.closest("[data-ranked-pact-scroll]");if(n){e.preventDefault(),Zi(n);return}let a=e.target.closest("[data-ranked-victory-action]");if(a){e.preventDefault(),await cs(a.dataset.rankedVictoryAction);return}let o=e.target.closest("[data-battle-speed]");if(o){e.preventDefault(),nn(Number(o.dataset.battleSpeed));return}let r=e.target.closest("[data-battle-step]");if(r){e.preventDefault(),Ut(Number(r.dataset.battleStep));return}if(e.target.closest("#battlePlaybackToggleBtn")){e.preventDefault(),i.combatPlayback?.isPaused?Kt():jt();return}if(e.target.closest("#battlePlaybackSkipBtn")){e.preventDefault(),Xt();return}if(e.target.closest("#fightLogReplayBtn, #rankedMobileReplayBtn")){e.preventDefault(),await Yi();return}if(e.target.closest("#fightLogToggleBtn, #rankedMobileLogBtn")){e.preventDefault(),pt();return}if(e.target.closest("#demonicPactViewToggle, #demonicPactReturnBtn")){e.preventDefault(),ns();return}let s=e.target.closest("[data-ranked-action]");if(s?.matches("button")){e.preventDefault(),await Qa(s,e);return}s&&(e.preventDefault(),await Qa(s,e))}),document.addEventListener("dragstart",e=>{let t=e.target.closest("[data-ranked-workspace-id]");if(!t||!e.dataTransfer||!p)return;let n=t.dataset.rankedWorkspaceId;vt=!0,Dn(n),e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/plain",n),t.classList.add("is-dragging")}),g.rankedEndRunModal?.addEventListener("hidden.bs.modal",()=>{Pt(!1)}),document.addEventListener("dragend",e=>{e.target.closest("[data-ranked-workspace-id]")?.classList.remove("is-dragging"),Cn=Date.now()+350,vt=!1,Rt(),j()}),document.addEventListener("dragover",e=>{let t=$t(e.target);t&&(e.preventDefault(),j(),t.classList.add("is-drag-over"))}),document.addEventListener("dragleave",e=>{let t=$t(e.target);t&&!t.contains(e.relatedTarget)&&t.classList.remove("is-drag-over")}),document.addEventListener("drop",e=>{let t=$t(e.target);if(!t)return;e.preventDefault();let n=e.dataTransfer?.getData("text/plain");n&&(vt=!1,Rt(),So(n,t,{x:e.clientX,y:e.clientY}))}),document.addEventListener("pointerdown",ks),document.addEventListener("pointermove",ws),document.addEventListener("pointerup",Ss),document.addEventListener("pointercancel",Ps),document.addEventListener("keydown",e=>{let t=e.target.closest(".dungeon-demon-card[data-instance-id]");!t||!["Enter"," "].includes(e.key)||(e.preventDefault(),yo(t))}),document.addEventListener("scroll",e=>{let t=e.target?.closest?.("[data-ranked-pact-scroll-viewport]");t&&po(t.closest(".ranked-reserve-buffs-shell"))},{capture:!0,passive:!0}),window.addEventListener("resize",fo)}async function Ni(){Pn(!0);try{let[e]=await Promise.all([xt("/api/ranked/bootstrap"),_i().catch(t=>(console.warn("Ranked upgrade previews will use current-card art.",t),null))]);e.player&&Mn(e.player),nt=e.rating||null,e.run?(Ne(e.run),e.run.status==="active"&&e.run.phase==="result"&&!e.run.awaitingVictoryChoice&&await so()):(i.run=null,$=null),Pn(!1),_(),$?.awaitingVictoryChoice&&vo($)}catch(e){Pn(!1),At(e)}}async function _i(){return Te||(ht||(ht=xt("/api/game/catalog?v=20260722-request-optimization-v1").then(e=>(Te={types:e?.types||{},demons:Array.isArray(e?.demons)?e.demons:[]},Te)).catch(e=>{throw ht=null,e})),ht)}async function Hi(){let e=await uo("/api/ranked/start",{});e?.run&&Ne(e.run)}async function Qa(e,t=null){if(q)return;let n=e.dataset.rankedAction;if(n==="start")return Hi();if($){if(n==="reroll")return Vi(Et(t,e));if(n==="lock-hand")return qi();if(n==="fight")return co();if(n==="continue")return so();if(n==="end")return Oi();if(n==="pact")return Gi(e.dataset.buffId)}}function Oi(){if(!$||!g.rankedEndRunModal||!window.bootstrap?.Modal)return;let e=Math.max(1,Number($.floor)||1),t=Number($.rating?.runDelta)||0,n=Math.max(0,Number($.rating?.rating)||0);g.rankedEndRunEyebrow&&(g.rankedEndRunEyebrow.textContent=`Endless \xB7 Floor ${E(e)}`),g.rankedEndRunFloor&&(g.rankedEndRunFloor.textContent=E(e)),g.rankedEndRunGain&&(g.rankedEndRunGain.textContent=Co(t),g.rankedEndRunGain.classList.toggle("is-negative",t<0)),g.rankedEndRunRating&&(g.rankedEndRunRating.textContent=E(n)),Pt(!1),window.bootstrap.Modal.getOrCreateInstance(g.rankedEndRunModal).show()}async function zi(){if(q||!$||$.status!=="active")return;if(Pt(!0),(await Ie("end",{}))?.run?.status==="ended"){window.bootstrap?.Modal.getOrCreateInstance(g.rankedEndRunModal)?.hide();return}Pt(!1)}function Pt(e){let t=g.rankedEndRunModal;if(!t)return;t.querySelectorAll("button").forEach(a=>{a.disabled=!!e});let n=t.querySelector("[data-ranked-end-confirm]");n?.classList.toggle("is-busy",!!e),n?.setAttribute("aria-busy",e?"true":"false")}async function Ie(e,t){let n=await uo(`/api/ranked/runs/${encodeURIComponent($.runId)}/${e}`,t);return n?.player&&Mn(n.player,{animate:!0}),n?.run&&(Ne(n.run),n.rewards?.souls&&He(`Floor ${Se} cleared. ${n.rewards.souls} Souls awarded.`,"success")),n}async function so(){let e=await Ie("continue",{});e?.run?.phase==="selection"&&e.run.floor>Se&&He("Endless floor unlocked.","success")}async function Gi(e){let t=await Ie("pact",{buffId:e});if(t?.run&&(he?.play("sfx.dungeon.pactChoose",{volume:.9}),!t.run.pendingPact&&et>0)){let n=et;et=0,window.requestAnimationFrame(()=>Ls(n))}return t}async function Vi(e){if(!$o()||q)return;let t=await Ie("reroll",{lineup:ko(),lockHand:!!$.handLocked});if(!t?.run)return;let n=Math.max(0,Number(t.rerollCost)||Me);Bt(e,-n),he?.play("sfx.dungeon.pactReroll",{volume:.86})}async function co(){if(!(!wo()||q||i.isBattleAnimating)){et=0,_e(!0),se=!0;try{let e=await xt(`/api/ranked/runs/${encodeURIComponent($.runId)}/battle`,mo({lineup:ko(),lockHand:!!$.handLocked}));if(!e?.run?.lastBattle)return;let t=e.rSoulInterest;Ne(e.run,{render:!1}),Number(t?.earned)>0&&(Q=Math.max(0,Number(t.balanceBefore)||0));let n=e.run.lastBattle;lo(n),fe("combat"),_(),await st(),await ss(n.winner),Ne(e.run,{render:!1});let a=[];e.rewards?.souls&&(a.push(`Victory milestone: ${e.rewards.souls} Souls awarded.`),e.player&&Mn(e.player,{animate:!0})),Number(t?.earned)>0&&(et=Math.max(0,Number(t.earned)||0)),He(a.length?a.join(" "):"","success"),e.run.awaitingVictoryChoice&&vo(e.run,{rankGain:e.rankGain})}catch(e){At(e)}finally{se=!1,_e(!1),_()}}}function qi(){if(!$||!Bn($))return;let e=!$.handLocked;$.handLocked=e,i.run.handLocked=e,_()}async function Yi(){let e=$?.lastBattle;if(!(q||i.isBattleAnimating||!e?.combatLog?.length)){se=!0,_e(!0);try{lo(e),fe("combat"),_(),g.fightLog.innerHTML="",g.fightLog.classList.remove("text-muted"),await st(),Ne($,{render:!1})}catch(t){At(t)}finally{se=!1,_e(!1),_()}}}function lo(e){i.run.team=K(e.playerTeamBefore||i.run.team||[]),i.run.active=i.run.team,i.run.enemies=K(e.enemyTeamBefore||i.run.enemies||[]),i.combatLog=e.combatLog||[],i.combatDemons=Ke()}async function uo(e,t){_e(!0);try{return await xt(e,mo(t))}catch(n){return At(n),null}finally{_e(!1)}}function mo(e){let t=Es();return{method:"POST",headers:{"Idempotency-Key":t},body:{...e,actionId:t}}}function Ne(e,t={}){Rt(),$=e,nt=e.rating||nt,Q=Math.max(0,Math.floor(Number(e.rSouls)||0));let n=e.lastBattle;p=Bn(e)?ds(e):null,i.run={...e,team:K(p?.active||e.active||e.team),active:K(p?.active||e.active||e.team),reserve:K(p?.reserve||e.reserve),enemies:e.phase==="result"&&n?K(n.enemyTeamAfter):K(e.enemies)},i.combatLog=n?.combatLog||[],i.combatDemons=Ke(),t.render!==!1&&_(),rs(e.combinationEvents||[])}function _(){us();let e=i.run,t=!!e;if(g.runEmpty.classList.toggle("d-none",t||i.isLoading),g.runPanel.classList.toggle("d-none",!t||i.isLoading),g.rankedBottomPanel.classList.toggle("d-none",!t||i.isLoading),!t){fe("combat"),g.runEmpty.innerHTML=os();return}if((e.status==="ended"||e.phase==="ended")&&!se){fe("combat"),g.runPanel.classList.add("d-none"),g.rankedBottomPanel.classList.add("d-none"),g.runEmpty.classList.remove("d-none"),g.runEmpty.innerHTML=as(e),to([]);return}let n=se||i.isBattleAnimating,a=n,o=!!(i.isPactTeamPreview&&e.pendingPact&&!a),r=a||o,s=!!(!r&&(e.lastBattle?.combatLog?.length||i.combatLog?.length));g.enemyGrid.closest(".battle-side")?.classList.toggle("is-ranked-reserve",!a),g.rankedBottomPanel.classList.toggle("is-ranked-combat",r),g.rankedBottomPanel.classList.remove("has-fight-review"),g.rankedBottomPanel.classList.toggle("is-battle-active",n),g.dungeonHandBar.classList.toggle("d-none",!r),g.dungeonHandBar.classList.toggle("is-battle-controls-mode",r),g.dungeonReplayLogBox.classList.add("d-none"),a||fe("combat"),Wi(e),Ki(e,a),xo(),g.teamGrid.innerHTML=ln(e.team||e.active||[],{side:"player",allowFormationDrag:!a&&!e.pendingPact}),g.enemyGrid.innerHTML=a?ln(e.enemies||[],{side:"enemy"}):Xi(e.reserve||[],e),g.rankedPreparation.classList.toggle("d-none",a||o||e.phase==="preparation"&&i.isBattleAnimating);let c=!g.rankedPreparation.classList.contains("d-none"),l=Math.max(0,Math.min(3,Number(e.lives)||0)),d=Array.from({length:3},(u,m)=>`
      <span class="ranked-life-heart ${m<l?"is-active":"is-empty"}">\u2665</span>
    `).join("");g.rankedHandStatus.classList.toggle("d-none",!c),g.rankedHandStatus.setAttribute("aria-label",`${l} of 3 lives, ${E(Q)} Ranked Souls`),g.rankedHandStatus.innerHTML=c?`
      <span class="ranked-lives" aria-hidden="true">${d}</span>
      <span class="ranked-hand-status-separator" aria-hidden="true">&middot;</span>
      ${ji(e)}
    `:"",g.rankedPreparation.innerHTML=a||o?"":Qi(e,{canReviewFight:s}),bo(),ho(),to(e.pacts?.pendingChoices||[]),is(),ms(),gs(),fo()}function Wi(e){let t=e.rating?.division||"Bronze II",n=Ct(t),a=Array.isArray(e.team)?e.team:e.active||[],o=Math.max(1,Number(e.capacities?.active)||6),r=Math.min(o,a.length),s=`${r}/${o}`,c=`
    <span class="battle-side-count" aria-label="${A(`${r} of ${o} team slots used`)}">
      ${A(s)}
    </span>
  `;g.teamSideTitle.innerHTML=`
    <span class="ranked-desktop-status">
      ${Rn(n,{showLabel:!0})}
      ${c}
    </span>
    <span class="ranked-mobile-status">
      ${Rn(n,{showLabel:!0,compact:!0})}
      ${c}
    </span>
    ${Ze(go(e),{side:"player"})}
  `}function ji(e){let t=Math.max(1,Number(e?.floor)||1),n=Math.floor(Q/10),a=t+n;return`
    <span class="ranked-rsoul-balance" tabindex="0" aria-describedby="rankedRSoulTooltip">
      ${L("soul")}
      <span class="ranked-rsoul-value">${E(Q)}</span>
      <span class="ranked-rsoul-tooltip" id="rankedRSoulTooltip" role="tooltip">
        <span class="ranked-rsoul-tooltip-main">
          <strong>Interest:</strong>
          ${L("soul")}
          <strong>${E(a)}</strong>
        </span>
        <span class="ranked-rsoul-tooltip-formula">Floor number + 1 every 10 souls</span>
      </span>
    </span>
  `}function Ki(e,t){if(!t){g.enemySideTitle.innerHTML="<span>Reserve</span>";return}let n=e.opponent?.generated?"Ranked Rival":e.opponent?.hunterName||"Opponent",a=Ct(e.opponent?.division);g.enemySideTitle.innerHTML=`
    <span>${A(n)}</span>
    ${e.opponent?.division?Rn(a,{showLabel:!0,compact:!0}):""}
    ${Ze(e.lastBattle?.enemyBuffs||[],{side:"enemy"})}
  `}function Ct(e="Bronze III"){let t=String(e||"Bronze III").trim().toLowerCase(),n=t.replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),a=["bronze","silver","gold","platinum","diamond","demonic"].find(o=>t.startsWith(o))||"bronze";return{division:String(e||"Bronze III"),slug:n,tier:a,imageUrl:`/app/images/assets/ranks/${a}.svg`}}function Rn(e,t={}){let n=t.compact?" is-compact":"",a=Number.isFinite(t.occupiedSlots)&&Number.isFinite(t.maxSlots),o=a?`${Math.max(0,t.occupiedSlots)}/${Math.max(1,t.maxSlots)}`:"";return`
    <span class="ranked-rank ranked-rank--${A(e.slug)}${n}"
          aria-label="${A(e.division)} rank">
      <img class="ranked-rank-image" src="${A(e.imageUrl)}" alt="" width="72" height="80" aria-hidden="true">
      ${t.showLabel?`<span class="ranked-rank-label rank-division-text rank-division-text--${A(e.slug)}">${A(e.division.toUpperCase())}</span>`:""}
      ${a?`
        <span class="ranked-rank-separator" aria-hidden="true">&middot;</span>
        <span class="ranked-team-slots" aria-label="${A(`${o} team slots occupied`)}">${A(o)}</span>
      `:""}
    </span>
  `}function go(e){let t=e.lockedBonuses||{},n=Object.values(t.allocations||{}).reduce((s,c)=>s+Math.max(0,Number(c)||0),0),a=Pa({spentPoints:n,bonuses:t.skillBonuses||{}}),o=La(Array.isArray(e.pacts?.activeBuffs)?e.pacts.activeBuffs:[]),r=(Array.isArray(t.activeBuffs)?t.activeBuffs:[]).filter(s=>s?.source!=="skill_tree");return[...a?[a]:[],...o,...r].filter(s=>s?.id)}function Ui(e){return Ea(e,{stackClass:"ranked-pact-stack",countClass:"ranked-pact-stack-count"})}function Xi(e,t){let n=Array.from({length:t.capacities.reserve},()=>null),a=[];e.forEach(r=>{let s=pe(r.reserveSlot);s!==null&&!n[s]?n[s]=r:a.push(r)}),a.forEach(r=>{let s=n.findIndex(c=>!c);s>=0&&(n[s]=r)});let o=go(t);return`
    <div class="ranked-reserve-panel">
      <div class="battle-formation battle-formation-grid battle-formation-player ranked-reserve-formation"
           data-ranked-zone="reserve" role="list" aria-label="Reserve">
        ${n.map((r,s)=>dn(r,s,{side:"player",allowFormationDrag:!0},"player")).join("")}
      </div>
      ${o.length?`
        <div class="ranked-reserve-buffs-shell">
          <button class="ranked-pact-scroll-btn is-previous" type="button" data-ranked-pact-scroll="-1"
                  aria-label="Scroll active buffs left" title="Scroll active buffs left" hidden disabled>
            ${L("chevron-left")}
          </button>
          <div class="ranked-reserve-buffs-viewport" data-ranked-pact-scroll-viewport tabindex="0"
               role="region" aria-label="Active Ranked Pacts, Skill Tree bonuses, and buffs">
            <div class="dungeon-hand-pacts ranked-reserve-buffs">
              ${o.map(Ui).join("")}
            </div>
          </div>
          <button class="ranked-pact-scroll-btn is-next" type="button" data-ranked-pact-scroll="1"
                  aria-label="Scroll active buffs right" title="Scroll active buffs right" hidden disabled>
            ${L("chevron-right")}
          </button>
        </div>
      `:""}
    </div>
  `}function Zi(e){let n=e.closest(".ranked-reserve-buffs-shell")?.querySelector("[data-ranked-pact-scroll-viewport]");if(!n||e.disabled)return;let a=n.querySelector(".ranked-reserve-buffs"),o=a?.querySelector(".ranked-pact-stack"),r=a?window.getComputedStyle(a):null,s=parseFloat(r?.columnGap||""),c=parseFloat(r?.gap||""),l=Number.isFinite(s)?s:Number.isFinite(c)?c:0,d=o?.getBoundingClientRect().width||0,u=Number(e.dataset.rankedPactScroll)||0,m=Math.max(d+l,n.clientWidth*.72,1);n.scrollBy({left:u*m,behavior:"smooth"})}function fo(){bt&&window.cancelAnimationFrame(bt),bt=window.requestAnimationFrame(()=>{bt=0,po()})}function po(e=null){let t=e?[e]:Array.from(g.enemyGrid?.querySelectorAll(".ranked-reserve-buffs-shell")||[]),n=window.matchMedia("(max-width: 1199.98px)").matches;t.forEach(a=>{let o=a?.querySelector("[data-ranked-pact-scroll-viewport]"),r=Array.from(a?.querySelectorAll("[data-ranked-pact-scroll]")||[]);if(!o||!r.length)return;!n&&o.scrollLeft&&(o.scrollLeft=0);let s=Math.max(0,o.scrollWidth-o.clientWidth),c=n&&s>1,l=o.scrollLeft<=1,d=o.scrollLeft>=s-1;a.classList.toggle("has-scroll-overflow",c),a.classList.toggle("is-scroll-start",c&&l),a.classList.toggle("is-scroll-end",c&&d),r.forEach(u=>{let f=(Number(u.dataset.rankedPactScroll)||0)<0?l:d;u.hidden=!c||f,u.disabled=!c||f})})}function Ji(e,t={}){let n=Mi?.(e,{hideHpBar:!0})||"";return Di(e,{className:"ranked-preparation-demon-card",showStats:!1,overlayHtml:n?`<div class="ranked-preparation-stats" aria-label="Combat stats">${n}</div>`:"",attributes:{"data-instance-id":e.instanceId,...t.zone!=="enemy"?{"data-ranked-workspace-id":e.instanceId,"data-ranked-zone":t.zone,draggable:t.interactive?"true":"false",role:"button",tabindex:t.interactive?"0":"-1"}:{}}})}function Qi(e,t={}){let n=p?.hand||[],a=!!t.canReviewFight,o=Number(e.floor)>Se,r=$o()&&!q,s=wo()&&!q,c=`Reroll hand for ${Me} Ranked Souls`,l=e.handLocked?"Unlock hand for the next floor":"Lock hand for the next floor",d=es(e.handLocked);return`
    <div class="ranked-reroll-rail">
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-reroll-action" type="button" data-ranked-action="reroll"
              title="${c}" aria-label="${c}" ${r?"":"disabled"}>
        <span class="ranked-reroll-main">
          <span class="ranked-reroll-icon" aria-hidden="true">${L("refresh-cw")}</span>
          <span class="ranked-reroll-copy">
            <strong>Reroll</strong>
          </span>
        </span>
        <span class="ranked-reroll-cost" aria-label="${Me} Ranked Souls">
          ${L("soul")} <strong>${E(Me)}</strong>
        </span>
      </button>
      ${eo(e)}
    </div>
    <div class="ranked-offer-area" data-ranked-drop-zone data-ranked-zone="hand" aria-label="Hand">
      <div class="ranked-offer-grid">
        ${n.length?n.map((u,m)=>`
            <div class="ranked-offer ${!u._rankedPurchased&&Fe(u)>Q?"is-unaffordable":""}"
                 data-ranked-drop-zone data-ranked-zone="hand" data-ranked-index="${m}">
              ${Ji(u,{interactive:!0,zone:"hand"})}
              <span class="ranked-offer-cost ${u._rankedPurchased?"is-purchased":""}"
                    aria-label="${u._rankedPurchased?"Purchased":`${Fe(u)} Ranked Souls`}">
                ${u._rankedPurchased?L("check"):L("soul")}
                ${u._rankedPurchased?"":`<span>${E(Fe(u))}</span>`}
              </span>
            </div>
          `).join(""):'<div class="ranked-hand-empty">Empty</div>'}
      </div>
      <div class="ranked-hand-sale-prompt" aria-hidden="true" hidden>
        <strong>Sell Demon</strong>
        <span>Drop team or reserve demon here</span>
      </div>
    </div>
    <div class="ranked-action-dock${o?" is-endless":""}">
      <button class="btn ${e.handLocked?"btn-success":"btn-outline-light"} ranked-side-action ranked-side-action-compact ranked-lock-action"
              type="button" data-ranked-action="lock-hand" aria-pressed="${e.handLocked?"true":"false"}"
              title="${l}" aria-label="${l}">
        ${d} <span>${e.handLocked?"Locked":"Lock Hand"}</span>
      </button>
      <div class="ranked-review-actions" role="group" aria-label="Previous fight">
        ${yn(a,a)}
      </div>
      ${o?`
        <button class="btn ranked-end-run-action ranked-side-action ranked-side-action-compact ranked-endless-end-action"
                type="button" data-ranked-action="end" title="End Endless run" aria-label="End Endless run">
          ${L("flag")} <span>End Run</span>
        </button>
      `:""}
    </div>
    <button class="btn btn-primary btn-lg ranked-side-action ranked-fight-action" type="button" data-ranked-action="fight"
            title="Start Ranked fight" aria-label="Start Ranked fight" ${s?"":"disabled"}>
      ${L("swords")} <span>Fight</span>
    </button>
    <div class="ranked-mobile-nav${o?" is-endless":""}" role="group" aria-label="Ranked preparation controls">
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-reroll-btn" type="button" data-ranked-action="reroll"
              title="${c}" aria-label="${c}" ${r?"":"disabled"}>
        <span class="ranked-mobile-reroll-icon" aria-hidden="true">${L("refresh-cw")}</span>
        <span class="ranked-mobile-reroll-cost" aria-hidden="true">
          ${L("soul")} <strong>${E(Me)}</strong>
        </span>
        <span class="visually-hidden">Reroll</span>
      </button>
      <details class="ranked-mobile-odds">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Reroll rarity odds" aria-label="Reroll rarity odds">
          ${L("info")}
          <span class="visually-hidden">Reroll rarity odds</span>
        </summary>
        <div class="ranked-mobile-odds-popover">
          ${eo(e)}
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ${e.handLocked?"active":""}" type="button"
              data-ranked-action="lock-hand" title="${l}" aria-label="${l}"
              aria-pressed="${e.handLocked?"true":"false"}">
        ${d}
        <span class="visually-hidden">${e.handLocked?"Unlock hand":"Lock hand"}</span>
      </button>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" id="rankedMobileReplayBtn" type="button"
              title="Replay Fight" aria-label="Replay Fight" ${a?"":"disabled"}>
        ${L("list-restart")}
        <span class="visually-hidden">Replay Fight</span>
      </button>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" id="rankedMobileLogBtn" type="button"
              title="Fight Log" aria-label="Fight Log" ${a?"":"disabled"}>
        ${L("log")}
        <span class="visually-hidden">Fight Log</span>
      </button>
      ${o?`
        <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-end-action ranked-end-run-action" type="button"
                data-ranked-action="end" title="End Endless run" aria-label="End Endless run">
          ${L("flag")}
          <span class="visually-hidden">End Run</span>
        </button>
      `:""}
      <button class="dungeon-mobile-nav-btn dungeon-mobile-fight-btn ranked-mobile-nav-btn ad-primary-action"
              type="button" data-ranked-action="fight" title="Start Ranked fight" aria-label="Start Ranked fight"
              ${s?"":"disabled"}>
        ${L("swords")}
        <span class="visually-hidden">Fight</span>
      </button>
    </div>
  `}function es(e){return L(e?"lock":"lock-open")}function eo(e){let t=e?.rarityOdds||{};return`
    <div class="ranked-reroll-odds" aria-label="Reroll rarity odds per card">
      <span class="ranked-reroll-odds-grid">${Qe.map(a=>{let o=Math.max(0,Number(t[a])||0),r=tt(a);return`
      <span class="ranked-reroll-odd is-${a}${o<=0?" is-zero":""}"
            title="${A(r)}: ${E(o)}%"
            aria-label="${A(r)} ${E(o)} percent">
        <strong>${E(o)}%</strong>
      </span>
    `}).join("")}</span>
    </div>
  `}function ho(){if(g.fightLog){if(!i.combatLog?.length){g.fightLog.innerHTML="Fight log will appear here after a battle.",g.fightLog.classList.add("text-muted");return}g.fightLog.classList.remove("text-muted"),g.fightLog.innerHTML=je(i.combatLog).map((e,t)=>on(e,t)).join("")}}function bo(){let e=i.run;if(!(!e||!g.dungeonBottomControls||!g.dungeonReplayLogBox)){if(g.dungeonReplayLogBox.innerHTML="",i.isPactTeamPreview&&e.pendingPact){Sn("pact",wn());return}if(i.isBattleAnimating){Sn("battle",`
      ${vn()}
      ${kn()}
      ${$n()}
    `),ts();return}Sn("empty","")}}function Sn(e,t){g.dungeonBottomControls.dataset.rankedControlMode!==e&&(g.dungeonBottomControls.innerHTML=t,g.dungeonBottomControls.dataset.rankedControlMode=e)}function ts(){let e=g.dungeonBottomControls,t=i.combatPlayback||{},n=Number(t.currentIndex)||0,a=Number(t.totalSteps)||0,o=!!t.isPaused,r=o?"Play":"Pause",s=e.querySelector('[data-battle-step="-1"]'),c=e.querySelector('[data-battle-step="1"]'),l=e.querySelector("#battlePlaybackToggleBtn");s&&(s.disabled=n<=0),c&&(c.disabled=n>=a),l&&l.getAttribute("aria-label")!==r&&(l.title=r,l.setAttribute("aria-label",r),l.innerHTML=L(o?"play":"pause")),mt()}function to(e){let t=!!e?.length,n=t&&!i.isBattleAnimating&&!i.isLoading&&!se,a=!g.demonicPactOverlay.classList.contains("d-none");if(g.demonicPactOverlay.classList.toggle("d-none",!n),!n){i.isPactTeamPreview=!1,no(),t||(g.rankedPactGrid.innerHTML="",delete g.rankedPactGrid.dataset.pactSignature);return}a||(i.isPactTeamPreview=!1);let o=e.map(r=>`${r.id}:${r.rarity||"common"}`).join("|");g.rankedPactGrid.dataset.pactSignature!==o&&(g.rankedPactGrid.innerHTML=e.map(r=>{let s=String(r.rarity||"common").toLowerCase();return`
        <button class="demonic-pact-card is-${A(s)}" type="button" data-ranked-action="pact" data-buff-id="${A(r.id)}">
          <span class="demonic-pact-icon" aria-hidden="true">${L(r.icon||"sparkles")}</span>
          <span class="demonic-pact-rarity ad-${A(s)}">${tt(s)}</span>
          <strong>${A(r.name||r.id)}</strong>
          <span class="demonic-pact-description">${A(r.description||"")}</span>
          <span class="demonic-pact-tags">${(r.tags||[]).map(c=>`<span>${A(c)}</span>`).join("")}</span>
        </button>
      `}).join(""),g.rankedPactGrid.dataset.pactSignature=o),no(),a||he?.play("sfx.dungeon.pactReveal",{volume:.88})}function ns(){!g.demonicPactOverlay||g.demonicPactOverlay.classList.contains("d-none")||(i.isPactTeamPreview=!i.isPactTeamPreview,_())}function no(){let e=!!i.isPactTeamPreview;g.demonicPactOverlay?.classList.toggle("is-team-preview",e),g.demonicPactViewToggle&&(g.demonicPactViewToggle.classList.toggle("d-none",e),g.demonicPactViewToggle.textContent="View Team",g.demonicPactViewToggle.setAttribute("aria-expanded",String(!e)))}function as(e){let t=Number(e.highestClearedFloor)||0,n=Math.max(t,Number(e.floor)||1);return`
    <div class="ranked-end-card">
      <span class="dungeon-phase-eyebrow">${A(e.season?.name||"Ranked Season")}</span>
      <h1>${t>=Se?"Ranked Victory":"Run Complete"}</h1>
      <p>Reached Floor ${E(n)} &middot; Cleared Floor ${E(t)} &middot; ${Co(e.rating?.runDelta||0)} Rank Points</p>
      <p class="text-muted">${A(e.rating?.division||"")} &middot; ${E(e.rating?.rating||0)} RP</p>
      <button class="btn btn-primary btn-lg" type="button" data-ranked-action="start">Start New Run</button>
    </div>
  `}function os(){let e=nt?.division||"Bronze III",t=Math.max(0,Number(nt?.rating)||0),n=Ct(e);return`
    <div class="ranked-end-card ranked-start-card ranked-rank--${A(n.slug)}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">Seasonal Ranked</span>
      <h1>Draft. Adapt. Climb.</h1>
      <p class="ranked-start-summary">
        Build a temporary standardized roster, survive with three lives, and clear Floor ${Se}.
      </p>
      <div class="ranked-start-rank" aria-label="Current rank ${A(n.division)}, ${E(t)} Rank Points">
        <span class="ranked-start-rank-eyebrow">Current Rank</span>
        <span class="ranked-start-rank-emblem" aria-hidden="true">
          <img src="${A(n.imageUrl)}" alt="" width="144" height="160">
        </span>
        <strong class="rank-division-text rank-division-text--${A(n.slug)}">${A(n.division.toUpperCase())}</strong>
        <span class="ranked-start-rating">${E(t)} RP</span>
      </div>
      <div class="ranked-start-rules" aria-label="Ranked run rules">
        <span>${L("heart")} Three lives</span>
        <span>${L("shield-check")} Standardized roster</span>
        <span>${L("flag")} Floor ${Se} victory</span>
      </div>
      <button class="btn btn-primary btn-lg ranked-start-action" type="button" data-ranked-action="start" ${q?"disabled":""}>
        ${L("trophy")} <span>Start Ranked Run</span>
      </button>
    </div>
  `}function rs(e){(e||[]).forEach(t=>{if(t.deferredPreview)return;let n=`${t.resultInstanceId}:${t.fromRarity}:${t.toRarity}`;Xa.has(n)||(Xa.add(n),window.AmongDemons.showGameAlert?.({type:"success",title:`${tt(t.toRarity)} combination!`,message:`Three identical ${tt(t.fromRarity)} demons became one ${tt(t.toRarity)} demon.`,action:`The upgraded demon stayed in ${t.destination==="active"?"your formation":"Reserve"}.`}),window.setTimeout(()=>{document.querySelector(`[data-instance-id="${Tn(t.resultInstanceId)}"]`)?.classList.add("is-team-upgrade")},0))})}function is(){document.querySelectorAll(".dungeon-demon-card[data-instance-id]").forEach(e=>{e.dataset.rankedDetailsBound!=="true"&&(e.dataset.rankedDetailsBound="true",e.addEventListener("click",t=>{t.defaultPrevented||Date.now()<Cn||e.classList.contains("is-dragging")||e.classList.contains("suppress-detail-click")||yo(e)}))})}function yo(e){let t=ls(e?.dataset.instanceId);t&&window.AmongDemons.ui?.openDemonDetailsModal?.(t)}async function ss(e){await ja(e==="player"?"victory":"defeat",{syncActions:!1})}function vo(e,t={}){if(!g.rankedVictoryModal||!window.bootstrap?.Modal)return;let n=e?.rating?.division||"Bronze II",a=Ct(n),o=Math.max(0,Number(t.rankGain??e?.victoryRankGain??e?.rating?.runDelta)||0),r=Math.max(0,Number(e?.rating?.rating)||0),s=`${e?.runId||"ranked"}:${Se}`,c=g.rankedVictoryRankImage?.closest(".ranked-victory-rank");c?.classList.forEach(l=>{l.startsWith("ranked-rank--")&&c.classList.remove(l)}),c?.classList.add(`ranked-rank--${a.slug}`),g.rankedVictoryRankImage&&(g.rankedVictoryRankImage.src=a.imageUrl,g.rankedVictoryRankImage.alt=`${a.division} rank emblem`),g.rankedVictoryDivision&&(g.rankedVictoryDivision.textContent=a.division),g.rankedVictoryRankGain&&(g.rankedVictoryRankGain.textContent=`+${E(o)} RP`),g.rankedVictorySummary&&(g.rankedVictorySummary.textContent=`${E(r)} total RP. Continue into Endless or close this run and begin again.`),kt(!1),window.bootstrap.Modal.getOrCreateInstance(g.rankedVictoryModal,{backdrop:"static",keyboard:!1}).show(),Ja!==s&&(Ja=s,he?.play("sfx.dungeon.extract",{volume:.94,queueUntilUnlock:!0}))}async function cs(e){if(!(q||!$?.awaitingVictoryChoice)){if(kt(!0),e==="endless"){let t=await Ie("continue",{});if(t?.run&&!t.run.awaitingVictoryChoice){window.bootstrap?.Modal.getOrCreateInstance(g.rankedVictoryModal)?.hide(),He("Endless floor unlocked.","success");return}kt(!1);return}if(e==="new-run"&&(await Ie("end",{}))?.run?.status==="ended"){window.location.href=window.AmongDemons.appUrl("/ranked");return}kt(!1)}}function kt(e){g.rankedVictoryModal?.querySelectorAll("[data-ranked-victory-action]").forEach(t=>{t.classList.toggle("disabled",!!e),t.setAttribute("aria-disabled",e?"true":"false"),t.matches("button")&&(t.disabled=!!e)})}function ls(e){return[...i.run?.team||[],...i.run?.reserve||[],...i.run?.enemies||[],...p?.hand||[]].find(t=>t?.instanceId===e)}function Bn(e){return!!(e?.status==="active"&&["draft","selection","preparation"].includes(e.phase))}function ds(e){En=[],Ln=new Set((e.offers||[]).filter(o=>o.purchased).map(o=>String(o.offerId)));let t=K(e.active||e.team).map((o,r)=>({...wt(o,e),formationSlot:ce(o.formationSlot)??r,_rankedOrigin:"roster",_rankedPurchased:!0})),n=K(e.reserve).map((o,r)=>({...wt(o,e),reserveSlot:pe(o.reserveSlot)??r,_rankedOrigin:"roster",_rankedPurchased:!0})),a=(e.offers||[]).map(o=>({...wt(o.demon,e),_rankedOrigin:"offer",_rankedOfferId:o.offerId,_rankedCost:Math.max(0,Number(o.cost)||Fe(o.demon)),_rankedPurchased:!!o.purchased}));return{active:t,reserve:n,hand:a}}function wt(e={},t=$){let n=JSON.parse(JSON.stringify(e)),a=`${Number(n.typeId||n.type_id||n.type)}:${String(n.rarity||"common").toLowerCase()}`,o=t?.previewStats?.[a];return o?{...n,...JSON.parse(JSON.stringify(o)),hp:Math.max(1,Number(o.maxHp)||Number(o.hp)||1),_rankedPactPreviewApplied:!0}:n}function us(){!p||!i.run||!Bn($)||(i.run.team=p.active,i.run.active=p.active,i.run.reserve=p.reserve,i.run.offers=p.hand.filter(e=>e._rankedOrigin==="offer").map(e=>({offerId:e._rankedOfferId,demon:e})))}function ko(){return{purchasedOfferIds:[...Ln],sold:En.map(e=>Je(e)),active:(p?.active||[]).map(e=>({...Je(e),formationSlot:ce(e.formationSlot)})),reserve:(p?.reserve||[]).map(e=>({...Je(e),reserveSlot:pe(e.reserveSlot)})),hand:(p?.hand||[]).map(e=>Je(e))}}function Je(e){return e?._rankedCombinationRecipe?{combination:JSON.parse(JSON.stringify(e._rankedCombinationRecipe))}:{instanceId:e?.instanceId}}function wo(){return!!(p&&$?.status==="active"&&!$.pendingPact&&p.active.length>0&&p.active.length<=Number($.capacities?.active||6)&&p.reserve.length<=Number($.capacities?.reserve||6))}function $o(){return!p||!["draft","selection"].includes($?.phase)||$.pendingPact?!1:Q>=Me}function ms(){!p||se||i.isBattleAnimating||i.run?.phase==="result"||(g.teamGrid.querySelectorAll(".formation-slot").forEach(e=>{let t=e.querySelector(".formation-lane-cards");if(!t)return;t.dataset.rankedDropZone="",t.dataset.rankedZone="active",t.dataset.formationSlot=e.dataset.formationSlot;let n=t.querySelector(".dungeon-demon-card[data-instance-id]");n&&(n.dataset.rankedWorkspaceId=n.dataset.instanceId,n.dataset.rankedZone="active",n.setAttribute("draggable","true"))}),g.enemyGrid.querySelectorAll(".ranked-reserve-formation .formation-slot").forEach((e,t)=>{e.setAttribute("aria-label",`Reserve slot ${t+1}`);let n=e.querySelector(".formation-lane-cards");if(!n)return;n.dataset.rankedDropZone="",n.dataset.rankedZone="reserve",n.dataset.rankedIndex=String(t);let a=n.querySelector(".dungeon-demon-card[data-instance-id]");a&&(a.dataset.rankedWorkspaceId=a.dataset.instanceId,a.dataset.rankedZone="reserve",a.setAttribute("draggable","true"))}))}function gs(){if(!p||se||i.isBattleAnimating||i.run?.phase==="result")return;fs().forEach(t=>{let n=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${Tn(t)}"]`);n&&(n.classList.add("is-ranked-combine-ready"),n.querySelector(".dungeon-team-upgrade-indicator")||n.insertAdjacentHTML("afterbegin",un()))})}function fs(){let e=new Map;return[...p?.active||[],...p?.reserve||[],...p?.hand||[]].forEach(t=>{let n=String(t?.rarity||"").toLowerCase(),a=Number(t?.typeId||t?.type_id||t?.type);if(!a||!An(n))return;let o=`${a}:${n}`,r=e.get(o)||[];r.push(String(t.instanceId)),e.set(o,r)}),new Set([...e.values()].filter(t=>t.length>=3).flat())}function $t(e){if(!p||!(e instanceof Element))return null;let t=e.closest("[data-ranked-workspace-id]");return t||e.closest("[data-ranked-drop-zone]")}function Lt(e){for(let t of["active","reserve","hand"]){let n=p?.[t]?.findIndex(a=>String(a.instanceId)===String(e));if(n>=0)return{zone:t,index:n,slot:t==="active"?ce(p[t][n].formationSlot):t==="reserve"?pe(p[t][n].reserveSlot)??n:null}}return null}function ps(e){let t=e.closest?.("[data-ranked-workspace-id]");if(t){let s=Lt(t.dataset.rankedWorkspaceId);return s?{...s,occupantId:t.dataset.rankedWorkspaceId}:null}let n=e.dataset.rankedZone;if(!["active","reserve","hand"].includes(n))return null;let a=n==="active"?ce(e.dataset.formationSlot??e.closest(".formation-slot")?.dataset.formationSlot):n==="reserve"?pe(e.dataset.rankedIndex??e.closest(".formation-slot")?.dataset.formationSlot):null,o=Number(e.dataset.rankedIndex),r=Number.isInteger(o)&&o>=0?o:p[n].length;return{zone:n,slot:a,index:r,occupantId:null}}async function So(e,t,n=null){if(!p||q||i.isBattleAnimating)return;let a=Lt(e),o=ps(t);if(!a||!o||o.occupantId===String(e)){j();return}let r={active:K(p.active),reserve:K(p.reserve),hand:K(p.hand)},s=p[a.zone][a.index],c=o.occupantId?p[o.zone][o.index]:null;if(a.zone!=="hand"&&o.zone==="hand"){bs(s,n,t),j(),_();return}let l=a.zone==="hand"&&s?._rankedOrigin==="offer"&&!s._rankedPurchased&&["active","reserve"].includes(o.zone)?s:o.zone==="hand"&&c?._rankedOrigin==="offer"&&!c._rankedPurchased&&["active","reserve"].includes(a.zone)?c:null,d=l?Fe(l):0;if(l&&d>Q){j(),He(`This card costs ${E(d)} rSouls.`,"warning"),_();return}let u=hs(s,a,o,c);if(u){St(e),ao(l,d,n,t);let S=[Po(u.consumed,u.destinationEntry,u.rarity),...ro()].filter(Boolean);j(),_(),io(S);return}let m=Number($.capacities?.active||6);if(o.zone==="active"&&a.zone!=="active"&&!o.occupantId&&p.active.length>=m){j(),He(`Floor ${E($.floor)} allows ${E(m)} active demons.`,"warning"),_();return}let f=St(e),P=o.occupantId?St(o.occupantId):null;if(!f||!oo(f,o)){p=r,j(),_();return}if(P&&!oo(P,a)){p=r,j(),_();return}(p.active.length>Number($.capacities?.active||6)||p.reserve.length>Number($.capacities?.reserve||6))&&(p=r),p!==r&&l&&ao(l,d,n,t);let y=p===r?[]:ro();j(),_(),io(y)}function hs(e,t,n,a){if(t.zone!=="hand"||e?._rankedOrigin!=="offer"||e._rankedPurchased||!["active","reserve"].includes(n.zone)||!n.occupantId||!a)return null;let o=String(e.rarity||"").toLowerCase(),r=Number(e.typeId||e.type_id||e.type);if(!An(o)||Number(a.typeId||a.type_id||a.type)!==r||String(a.rarity||"").toLowerCase()!==o)return null;let s=[...p.active.map(d=>({zone:"active",demon:d})),...p.reserve.map(d=>({zone:"reserve",demon:d}))].filter(d=>Number(d.demon?.typeId||d.demon?.type_id||d.demon?.type)===r&&String(d.demon?.rarity||"").toLowerCase()===o),c=s.find(d=>String(d.demon.instanceId)===String(a.instanceId)),l=s.find(d=>String(d.demon.instanceId)!==String(a.instanceId));return!c||!l?null:{rarity:o,destinationEntry:c,consumed:[c,l,{zone:"hand",demon:e}]}}function ao(e,t,n,a){e&&(e._rankedPurchased=!0,e._rankedCost=t,Ln.add(String(e._rankedOfferId)),Q=Math.max(0,Q-t),Bt(n||Et(null,a),-t),he?.play("sfx.world.merchantPurchase",{volume:.82}))}function bs(e,t,n){if(!e)return;let a=St(e.instanceId);if(!a)return;let o=Cs(a);En.push(a),Q+=o,Bt(t||Et(null,n),o,{interest:!0}),he?.play("sfx.world.merchantPurchase",{volume:.82})}function St(e){let t=Lt(e);return t&&p[t.zone].splice(t.index,1)[0]||null}function oo(e,t){if(!e||!t||!p[t.zone])return!1;if(t.zone==="active"){if(p.active.length>=Number($.capacities?.active||6))return!1;let a=ce(t.slot);return a===null||p.active.some(o=>ce(o.formationSlot)===a)?!1:(e.formationSlot=a,e.position=a%3===2?"front":"back",p.active.push(e),p.active.sort((o,r)=>Number(o.formationSlot)-Number(r.formationSlot)),!0)}if(t.zone==="reserve"&&p.reserve.length>=Number($.capacities?.reserve||6))return!1;if(t.zone==="reserve"){let a=pe(t.slot??t.index);return a===null||p.reserve.some(o=>pe(o.reserveSlot)===a)?!1:(delete e.formationSlot,e.reserveSlot=a,e.position=e.preferredPosition==="back"?"back":"front",p.reserve.push(e),!0)}delete e.formationSlot,delete e.reserveSlot,e.position=e.preferredPosition==="back"?"back":"front";let n=Math.min(Math.max(0,Number(t.index)||0),p[t.zone].length);return p[t.zone].splice(n,0,e),!0}function ro(){if(!p)return[];let e=[],t=!0;for(;t;){t=!1;for(let n of Qe.slice(0,-1)){let a=new Map;[...p.active.map(l=>({zone:"active",demon:l})),...p.reserve.map(l=>({zone:"reserve",demon:l}))].forEach(l=>{if(String(l.demon?.rarity||"").toLowerCase()!==n)return;let d=`${Number(l.demon?.typeId)}:${n}`,u=a.get(d)||[];u.push(l),a.set(d,u)});let r=[...a.values()].find(l=>l.length>=3);if(!r)continue;let s=r.slice(0,3),c=s.find(l=>l.zone==="active")||s[0];e.push(Po(s,c,n)),t=!0;break}}return e}function Po(e,t,n){let a=new Set(e.map(r=>String(r.demon.instanceId)));p.active=p.active.filter(r=>!a.has(String(r.instanceId))),p.reserve=p.reserve.filter(r=>!a.has(String(r.instanceId)));let o=ys(e.map(r=>r.demon),An(n),t);return p[t.zone].push(o),t.zone==="active"&&p.active.sort((r,s)=>Number(r.formationSlot)-Number(s.formationSlot)),{resultInstanceId:o.instanceId,fromRarity:n,toRarity:o.rarity,destination:t.zone}}function ys(e,t,n){let a=e[0]||{},o=Number(a.typeId||a.type_id||a.type);Za+=1;let r=`ranked-preview-combine-${Date.now()}-${Za}`,s=Te?.types?.[String(o)]||{},c=Te?.demons?.find(u=>Number(u.type)===o&&String(u.rarity).toLowerCase()===t),l=Number(s.rarityMultiplier?.[t])||1,d=c?{instanceId:r,sourceDemonId:c.id,typeId:o,species:s.name||a.species,role:s.role||a.role,targeting:s.targeting||a.targeting,preferredPosition:s.preferredPosition==="back"?"back":"front",rarity:t,imageUrl:c.image_url||c.imageUrl,maxHp:yt(s.baseStats?.hp,l),hp:yt(s.baseStats?.hp,l),atk:yt(s.baseStats?.atk,l),speed:yt(s.baseStats?.speed,l),position:s.preferredPosition==="back"?"back":"front",attackMeter:0,ranked:!0}:{...JSON.parse(JSON.stringify(a)),instanceId:r,rarity:t,hp:Math.max(1,Number(a.maxHp)||Number(a.hp)||1),attackMeter:0};return delete d.formationSlot,delete d.reserveSlot,delete d._rankedCost,delete d._rankedOfferId,delete d._rankedPurchased,d._rankedOrigin="combination",d._rankedCombinationRecipe={sources:e.map(u=>Je(u))},n.zone==="active"?(d.formationSlot=ce(n.demon.formationSlot),d.position=d.formationSlot%3===2?"front":"back"):d.reserveSlot=pe(n.demon.reserveSlot),wt(d)}function yt(e,t){let n=Number(e?.[0])||1,a=Number(e?.[1])||n;return Math.max(1,Math.round((n+a)/2*t))}function An(e){let t=Qe.indexOf(String(e||"").toLowerCase());return t>=0&&t<Qe.length-1?Qe[t+1]:null}function io(e){e?.length&&window.requestAnimationFrame(()=>{let t=0;e.forEach(n=>{let a=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${Tn(n.resultInstanceId)}"]`);if(!a)return;let o=t*120;t+=1,window.setTimeout(()=>{vs(a),he?.play("sfx.progression.trainingSuccess",{volume:.88})},o)})})}function vs(e){let t=e?.getBoundingClientRect?.();if(!t)return;let n=document.createElement("span");n.className="ranked-combination-nova",n.setAttribute("aria-hidden","true"),n.style.setProperty("--ranked-combination-nova-size",`${Math.round(Math.max(48,t.width,t.height)*1.5)}px`),n.style.left=`${Math.round(t.left+t.width/2)}px`,n.style.top=`${Math.round(t.top+t.height/2)}px`,n.innerHTML=`
    <span class="ranked-combination-nova-ring"></span>
    <span class="ranked-combination-nova-ring is-delayed"></span>
    <span class="ranked-combination-nova-core"></span>
    ${Array.from({length:6},(a,o)=>`<span class="ranked-combination-nova-ray" style="--angle: ${o*60}deg"></span>`).join("")}
  `,document.body.appendChild(n),e.classList.add("is-ranked-upgrading"),n.addEventListener("animationend",a=>{a.target===n&&n.remove()}),window.setTimeout(()=>{n.remove(),e.classList.remove("is-ranked-upgrading")},1e3)}function j(){document.querySelectorAll(".is-drag-over").forEach(e=>e.classList.remove("is-drag-over"))}function Dn(e){let t=Lt(e);Ro(!!(t&&t.zone!=="hand"))}function Rt(){Ro(!1)}function Ro(e){let t=!!e,n=g.rankedPreparation?.querySelector(".ranked-offer-area"),a=n?.querySelector(".ranked-offer-grid"),o=n?.querySelector(".ranked-hand-sale-prompt");document.documentElement.classList.toggle("is-ranked-selling-demon",t),g.rankedBottomPanel?.classList.toggle("is-ranked-selling-demon",t),n?.classList.toggle("is-ranked-sale-target",t),n?.setAttribute("aria-label",t?"Sell Demon":"Hand"),a?.toggleAttribute("hidden",t),n?.querySelectorAll(".ranked-offer, .ranked-hand-empty").forEach(r=>{r.toggleAttribute("hidden",t)}),o?.toggleAttribute("hidden",!t),o?.setAttribute("aria-hidden",String(!t))}function ks(e){if(e.button!==void 0&&e.button!==0)return;let t=e.target.closest("[data-ranked-workspace-id]");!t||!p||q||i.isBattleAnimating||(w={card:t,instanceId:t.dataset.rankedWorkspaceId,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,active:!1,ghost:null,target:null},Dn(w.instanceId),t.setPointerCapture?.(e.pointerId))}function ws(e){if(!w||e.pointerId!==w.pointerId)return;let t=Math.hypot(e.clientX-w.startX,e.clientY-w.startY);if(!w.active&&t<8)return;w.active||$s(e),e.cancelable&&e.preventDefault(),w.ghost.style.left=`${e.clientX}px`,w.ghost.style.top=`${e.clientY}px`,w.ghost.hidden=!0;let n=document.elementFromPoint(e.clientX,e.clientY);w.ghost.hidden=!1;let a=$t(n);j(),a?.classList.add("is-drag-over"),w.target=a}function $s(e){w.active=!0,Dn(w.instanceId),w.card.classList.add("is-dragging","is-pointer-dragging","suppress-detail-click"),w.ghost=w.card.cloneNode(!0),w.ghost.classList.add("pointer-drag-ghost"),w.ghost.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click","is-drag-over"),w.ghost.removeAttribute("role"),w.ghost.removeAttribute("tabindex"),w.ghost.setAttribute("aria-hidden","true"),w.ghost.style.width=`${w.card.getBoundingClientRect().width}px`,w.ghost.style.left=`${e.clientX}px`,w.ghost.style.top=`${e.clientY}px`,document.body.appendChild(w.ghost)}function Ss(e){if(!w||e.pointerId!==w.pointerId)return;let t=w;if(t.active){e.cancelable&&e.preventDefault(),e.stopPropagation(),Cn=Date.now()+350;let n=t.target;xn(),n&&So(t.instanceId,n,{x:e.clientX,y:e.clientY});return}xn()}function Ps(e){!w||e.pointerId!==w.pointerId||xn({preserveSaleTarget:vt})}function xn(e={}){w&&(w.card?.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click"),w.ghost?.remove(),w=null,e.preserveSaleTarget||Rt(),j())}function Rs(e){return e?.position==="back"?"back":"front"}function xs(){return""}function xo(){if(!g.dungeonCenterActions)return;let e=Math.max(1,Number(i.run?.floor)||1);g.dungeonCenterActions.innerHTML=`
    <span class="dungeon-floor-marker ranked-floor-marker" aria-label="Current floor ${E(e)}">
      <span>Floor</span>
      <strong>${E(e)}</strong>
    </span>
  `}function ce(e){let t=Number(e);return Number.isInteger(t)&&t>=0&&t<9?t:null}function pe(e){let t=Number(e),n=Number($?.capacities?.reserve||6);return Number.isInteger(t)&&t>=0&&t<n?t:null}function Fe(e){let t=Number(e?._rankedCost);if(Number.isFinite(t)&&t>=0)return Math.floor(t);let n=String(e?.rarity||"common").toLowerCase();return Ua[n]||Ua.common}function Cs(e){return Math.ceil(Fe(e)/2)}function Mn(e,t={}){if(!e)return;let n=window.AmongDemons.getSession?.()||{};window.AmongDemons.setSession?.({...n,player:{...n.player||{},...e}}),window.AmongDemons.ui?.updateNavAccount?.(e,t)}function Et(e,t){if(Number.isFinite(e?.clientX)&&Number.isFinite(e?.clientY)&&(e.clientX||e.clientY))return{x:e.clientX,y:e.clientY};let n=t?.getBoundingClientRect?.();return n?{x:n.left+n.width/2,y:n.top+n.height/2}:{x:window.innerWidth/2,y:window.innerHeight/2}}function Ls(e){let t=g.rankedHandStatus?.querySelector(".ranked-rsoul-value");Bt(Et(null,t),e,{interest:!0})}function Bt(e,t,n={}){let a=document.createElement("span"),o=Number(t)||0,r=Math.round(Number(e?.x)||window.innerWidth/2),s=Math.round(Number(e?.y)||window.innerHeight/2);a.className=["ranked-soul-spend-float",o>0?"is-gain":"is-spend",n.interest?"is-interest":""].filter(Boolean).join(" "),a.style.left=`${r}px`,a.style.top=`${s}px`,a.innerHTML=n.interest?`<strong>+</strong>${L("soul")}<strong>${E(Math.abs(o))}</strong>`:`${L("soul")}<strong>${o>0?"+":"-"}${E(Math.abs(o))}</strong>`,document.body.appendChild(a),a.addEventListener("animationend",()=>a.remove(),{once:!0}),window.setTimeout(()=>a.remove(),1400)}function Pn(e){i.isLoading=!!e,g.runLoading?.classList.toggle("d-none",!e)}function _e(e){q=!!e,document.documentElement.classList.toggle("is-ranked-busy",q)}function At(e){console.error(e),window.AmongDemons.setGameAlert(g.rankedMessage,e,{type:"danger"})}function He(e,t="info"){window.AmongDemons.setGameAlert(g.rankedMessage,e,{type:t})}function Es(){return crypto.randomUUID?crypto.randomUUID():`ranked-${Date.now()}-${Math.random().toString(36).slice(2,12)}`}function K(e=[]){return(e||[]).map(t=>JSON.parse(JSON.stringify(t)))}function tt(e){let t=String(e||"");return t?t.charAt(0).toUpperCase()+t.slice(1):""}function E(e){return Number(e||0).toLocaleString()}function Co(e){let t=Number(e)||0;return`${t>0?"+":""}${E(t)}`}function Tn(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function A(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Bs(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}})();
