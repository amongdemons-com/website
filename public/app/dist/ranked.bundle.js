(()=>{var Ar=Object.defineProperty;var Dr=(e,t)=>{for(var n in t)Ar(e,n,{get:t[n],enumerable:!0})};var h={};function Hn(e){Object.assign(h,e)}var ct="amongdemons-battle-speed",On="amongdemons-battle-screen-shake",zn="amongdemons-battle-card-shake";var xe=[.5,1,2,4];var qe={default:{color:"#FAC51C",shadow:"rgba(250,197,28,0.85)"},poison:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},heal:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},1:{color:"#D1D5D8",shadow:"rgba(209,213,216,0.82)",outline:"#101820"},2:{color:"#171D24",shadow:"rgba(0,0,0,0.88)"},3:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},4:{color:"#E25041",shadow:"rgba(226,80,65,0.88)"},5:{color:"#C8CED2",shadow:"rgba(200,206,210,0.82)",outline:"#101820"},6:{color:"#C084FC",shadow:"rgba(192,132,252,0.9)"},7:{color:"#FFB23F",shadow:"rgba(255,178,63,0.9)"},8:{color:"#6E8F45",shadow:"rgba(110,143,69,0.86)"},9:{color:"#B8BDC2",shadow:"rgba(184,189,194,0.84)",outline:"#101820"},10:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},11:{color:"#52B7FF",shadow:"rgba(82,183,255,0.9)"}};var Mr=window.AmongDemons.getSession(),s={player:Mr.player||null,statPoints:null,run:null,startOptions:null,selectedRecruitRewardId:null,selectedSwapInstanceId:null,selectedRewardDemonKey:null,rewardDraftCandidate:null,isRecruiting:!1,isResultAnimating:!1,draggedRecruitPoolInstanceId:null,draggedFormationInstanceId:null,draggedRewardDemonKey:null,recruitSwapEffectIds:[],pendingHandFlowSources:null,isEnemyPreviewDeferred:!1,enemyRevealEffectIds:[],isPactRevealPending:!1,isPactTeamPreview:!1,pactRevealTimer:null,battleHandPreview:null,activeHandTab:"hand",isMobileRewardBoxOpen:!1,recruitDraftTeam:null,recruitDraftPool:null,collectionDemons:null,collectionReinforcementPlaceholderInteracted:!1,collectionReinforcementStagedInteracted:!0,isRecruitContinuePending:!1,combatLog:[],combatDemons:new Map,combatPlayback:null,battleSpeed:Tr(),isBattleAnimating:!1,endNotice:null,endSummary:null,endedReplayRun:null,formationRows:new Map,isLoading:!0},b={},ge=null;function Gn(e){ge=e}function Tr(){let e=Number(localStorage.getItem(ct));return xe.includes(e)?e:1}var dn={};Dr(dn,{animateAttackerCard:()=>ta,animateCombatEntry:()=>Kn,appendTemporaryElement:()=>W,applyBattleSpeed:()=>ht,applyCombatTheme:()=>an,createCombatDemonMap:()=>Ze,createCombatElement:()=>Y,drawAttackZap:()=>Le,drawChaoticLightning:()=>fa,drawCombatAnimation:()=>io,drawDarkSpike:()=>pa,drawFireNova:()=>ma,drawFireball:()=>da,drawGroupFireball:()=>ua,drawHealEffect:()=>ga,drawSwordSwing:()=>tn,drawThornBurst:()=>Wt,findDemonCard:()=>A,formatBattleSpeed:()=>go,getAttackGeometry:()=>Ke,getAttackProfile:()=>Ue,getBattleTimeScale:()=>sn,getCombatDemon:()=>Q,getCombatStepDelay:()=>rn,getCombatTheme:()=>nn,getDemonSide:()=>oe,getFightLogActionText:()=>ya,getFightLogAmountText:()=>ka,getFightLogVerb:()=>va,getFloatingDamageAmount:()=>Xn,getLogRowClass:()=>wa,getLogSideLabel:()=>$a,getPoisonBurstDamage:()=>ln,groupCombatLog:()=>Xe,healTargetCard:()=>qt,hitTargetCard:()=>sa,isCardShakeEnabled:()=>oa,isScreenShakeEnabled:()=>ia,isTypeTwoAttack:()=>ha,maybePlayDeath:()=>la,pauseCombatPlayback:()=>Xt,playCombatLog:()=>mt,playTemporaryCardClass:()=>pe,poisonTickCard:()=>Vt,prefersReducedMotion:()=>z,prepareCombatPlayback:()=>Un,renderFightLogDemonName:()=>jt,renderFightLogRow:()=>cn,renderLogPosition:()=>ba,renderViewportSvg:()=>ie,resumeCombatPlayback:()=>Zt,scaleCombatDuration:()=>q,scheduleImpact:()=>Se,setActiveLogRow:()=>pt,setBattleSpeed:()=>on,shakeTargetCard:()=>mo,showFloatingDamage:()=>We,skipCombatPlayback:()=>Qt,spawnImpactBurst:()=>Gt,stepCombatPlayback:()=>Jt,syncBattleSpeedButtons:()=>bt,syncCombatHpCards:()=>ea,syncPoisonStatus:()=>Yt,triggerScreenShake:()=>ca,updateTargetCard:()=>fe,updateTeamHp:()=>Qn});var Fr=window.AmongDemons.api;var Vn=window.AmongDemons.ui.renderDemonCard,Ir=window.AmongDemons.ui.renderCombatStats,js=window.AmongDemons.ui.openDemonDetailsModal,B=window.AmongDemons.ui.renderIcon||(()=>""),It=window.AmongDemons.ui.renderSoulAmount||(e=>String(e||0)),Nt=window.AmongDemons.ui.getRarityColor||(()=>"#D1D5D8");var re=new WeakMap;function qn(){s.endNotice=null,s.endSummary=null,s.endedReplayRun=null}function N(e,t){e&&e.addEventListener("click",t)}function lt(e,t,n=document){n.querySelectorAll(e).forEach(a=>{a.addEventListener("click",r=>t(a,r))})}function te(e,t,n={}){if(!e)return!1;let a=String(t||""),r=n.renderKey?String(n.renderKey):"",o=Ce(a,r);return re.get(e)===o?!1:(n.patchFormationGrid?_r(e,a,r):n.patchDemonLane?Hr(e,a,r):n.preserveDemonImages?Nr(e,a):e.innerHTML=a,re.set(e,o),!0)}function Nr(e,t){let n=Ye(e),a=document.createElement("template");a.innerHTML=t,$e(a.content,n),e.replaceChildren(a.content)}function _r(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let r=e.querySelector(".battle-formation-grid"),o=a.content.querySelector(".battle-formation-grid");if(!r||!o){let u=Ye(e);$e(a.content,u),e.replaceChildren(a.content),Or(e.querySelector(".battle-formation-grid"),n);return}let i=Ye(e);Ht(r,o);let c=_t(r),d=new Map(c.map(u=>[u.dataset.formationSlot,u])),l=_t(o),g=new Set(l.map(u=>u.dataset.formationSlot));l.forEach((u,p)=>{let P=u.dataset.formationSlot,y=d.get(P);if(!y){$e(u,i),r.insertBefore(u,r.children[p]||null);return}y!==r.children[p]&&r.insertBefore(y,r.children[p]||null);let S=u.outerHTML,k=Ce(S,n);(re.get(y)||y.outerHTML)!==k&&($e(u,i),re.set(u,k),y.replaceWith(u))}),c.forEach(u=>{g.has(u.dataset.formationSlot)||u.remove()})}function Hr(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let r=e.querySelector(".formation-lane-cards"),o=a.content.querySelector(".formation-lane-cards");if(!r||!o){let c=Ye(e);$e(a.content,c),e.replaceChildren(a.content),Gr(e.querySelector(".formation-lane-cards"),n);return}let i=Ye(e);Ht(r,o),zr(r,Array.from(o.children),{imagesByKey:i,renderKey:n,getKey:Vr})}function _t(e){return e?Array.from(e.children).filter(t=>t.matches?.(".formation-slot[data-formation-slot]")):[]}function Or(e,t=""){_t(e).forEach(n=>{re.set(n,Ce(n.outerHTML,t))})}function zr(e,t,n={}){let{imagesByKey:a=new Map,renderKey:r="",getKey:o}=n,i=Array.from(e.children),c=new Map(i.map((l,g)=>[o(l,g),l])),d=new Set(t.map((l,g)=>o(l,g)));t.forEach((l,g)=>{let u=o(l,g),p=c.get(u);if(!p){$e(l,a),re.set(l,Ce(l.outerHTML,r)),e.insertBefore(l,e.children[g]||null);return}p!==e.children[g]&&e.insertBefore(p,e.children[g]||null);let P=l.outerHTML,y=Ce(P,r);(re.get(p)||p.outerHTML)!==y&&($e(l,a),re.set(l,y),p.replaceWith(l))}),i.forEach((l,g)=>{d.has(o(l,g))||l.remove()})}function Gr(e,t=""){e&&Array.from(e.children).forEach(n=>{re.set(n,Ce(n.outerHTML,t))})}function Vr(e,t=0){let n=e.dataset?.instanceId;if(n)return`demon:${n}`;let a=e.dataset?.collectionReinforcementPosition;return a?`collection-reinforcement:${a}`:e.classList?.contains("dungeon-hand-empty")?"empty:hand":`node:${t}`}function Ce(e,t=""){return t?`${t}
${e}`:e}function Ye(e){let t=new Map;return e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=Yn(n);a&&!t.has(a)&&t.set(a,n)}),t}function $e(e,t){e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=Yn(n),r=a?t.get(a):null;r&&(Ht(r,n),n.replaceWith(r),t.delete(a))})}function Yn(e){let n=e.closest(".dungeon-demon-card[data-instance-id]")?.dataset.instanceId,a=e.getAttribute("src")||"";return n&&a?`${n}|${a}`:""}function Ht(e,t){Array.from(e.attributes).forEach(n=>{t.hasAttribute(n.name)||e.removeAttribute(n.name)}),Array.from(t.attributes).forEach(n=>{e.getAttribute(n.name)!==n.value&&e.setAttribute(n.name,n.value)})}function Be(e){e&&(e.disabled=!1)}function dt(e){return e?e.charAt(0).toUpperCase()+e.slice(1):""}function w(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Wn(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function Ot(e){return(e||[]).map(t=>({...t}))}var Ee=window.AmongDemons.audio,qr="amongdemons:battle-intro-complete";var Ut=(...e)=>h.getDemonPosition(...e),Yr=(...e)=>h.renderDemonStatus(...e),Wr=(...e)=>h.renderDungeonCenterActions(...e),zt=(...e)=>h.renderFightLog(...e),Ae=(...e)=>h.renderFightLogActions(...e),je=(...e)=>h.renderRun(...e);function Un(e={}){if(!s.run)return null;let t=Xe(s.combatLog,{combineCounters:!0}),n={currentIndex:0,isPaused:!1,stepDirection:0,steps:t,totalSteps:t.length,waitResolve:null};return s.combatPlayback=n,s.isBattleAnimating=!0,e.render!==!1&&(je(),zt()),n}async function mt(e={}){if(!s.run)return;let t=e.combatPlayback,n=t&&s.combatPlayback===t?t:Un({render:!1});if(!n)return;let a=n.steps||[];if(s.isBattleAnimating=!0,je(),zt(),e.waitForBattleIntro){if(Wr({canFight:!0,isFighting:!0}),await Ee?.play("sfx.battle.battleStart",{volume:.9,waitForEnd:!0}),!s.run||s.combatPlayback!==n)return;window.dispatchEvent(new CustomEvent(qr))}je(),zt();try{for(;s.combatPlayback&&s.combatPlayback.currentIndex<a.length;){let r=await Qr();if(!r||!s.combatPlayback)break;if(r==="previous"){await to();continue}let o=s.combatPlayback.currentIndex,i=a[o];if(!i)break;Z(!1),Kt(i,o,{animate:!0}),s.combatPlayback.currentIndex=o+1,Ae(),await Zn(q(rn(i))),Z(!!s.combatPlayback?.isPaused)}}finally{s.isBattleAnimating=!1,s.combatPlayback=null,Z(!1),je()}pt(-1)}function Kt(e,t=-1,n={}){let a=ao(),r=n.animate!==!1;if(e.entries.forEach(u=>{let p=a.get(u.target);p&&(p.hp=u.targetHp,u.effect==="poison_apply"&&(p.statusEffects=p.statusEffects||{},p.statusEffects.poison=Array.from({length:Math.max(1,Number(u.poisonStacks)||1)},()=>({}))),u.effect==="poison"&&Object.prototype.hasOwnProperty.call(u,"poisonStacks")&&(p.statusEffects=p.statusEffects||{},p.statusEffects.poison=Array.from({length:Math.max(0,Number(u.poisonStacks)||0)},()=>({}))))}),Qn(),!r){ea();return}pt(t);let o=oe(e.attacker),i=gt(e),c=new Map(i.map((u,p)=>[u,p])),d=!!e.isAoe||i.length>1;jr(e),e.primaryEffect!=="poison"&&ta(e.attacker,e.primaryEffect,e.entries[0]?.target);let l=Kr(e);l&&ua(e.attacker,l.targetIds,{effect:e.primaryEffect,travel:l.travel});let g=Xr(e);g&&tn(e.attacker,g.targetId),e.entries.forEach(u=>{let p=c.get(u)??0;Kn(u,e,o,p,d,l,g)})}function jr(e){let t=e.entries?.[0]||{},n=e.primaryEffect||t.effect;if(n==="poison"||n==="heal"||n==="last_breath"||n==="shared_pain")return;let a=null;if(n==="poison_apply")a="sfx.battle.abilities.poisonApply";else if(n==="retaliate"||n==="thorns")a="sfx.battle.abilities.thornsRetaliate";else{let r=Number(Q(e.attacker)?.typeId);a={1:"sfx.battle.abilities.meleeSwing",2:"sfx.battle.abilities.rangedProjectile",3:"sfx.battle.abilities.poisonApply",4:"sfx.battle.abilities.fireAoe",5:"sfx.battle.abilities.bruiserStrike",6:"sfx.battle.abilities.assassinStrike",7:"sfx.battle.abilities.cleave",8:"sfx.battle.abilities.thornsRetaliate",9:"sfx.battle.abilities.juggernautSlam",10:"sfx.battle.abilities.heal",11:"sfx.battle.abilities.chaosAttack"}[r]||"sfx.battle.abilities.meleeSwing"}Ee?.play(a,{volume:.72,minInterval:55}),!J(t)&&(e.entries||[]).some(J)&&Ee?.play("sfx.battle.abilities.thornsRetaliate",{volume:.66,minInterval:55})}var Ur=new Set(["poison","heal","last_breath","shared_pain","poison_apply"]);function J(e){return e?.effect==="retaliate"||e?.effect==="thorns"}function gt(e){return(e.entries||[]).filter(t=>!J(t))}function ut(e){return!J(e)&&!Ur.has(e.effect)}function Kr(e){if(z()||e.targeting==="chaotic"||Number(Q(e.attacker)?.typeId)!==4)return null;let t=(e.entries||[]).filter(ut);return t.length?{targetIds:t.map(n=>n.target),travel:Ue(t[0]).travel,lead:90}:null}function Xr(e){if(z()||Number(Q(e.attacker)?.typeId)!==7)return null;let t=(e.entries||[]).filter(ut);return t.length?{targetId:t[Math.floor((t.length-1)/2)].target}:null}function Kn(e,t,n,a,r,o=null,i=null){let c=z();if(e.effect==="poison"){Se(160,()=>{a===0&&Ee?.play("sfx.battle.abilities.poisonTick",{volume:.66,minInterval:80}),a===0&&We(e.target,ln(t),"poison",e.attacker,e.effect,{burstCount:t.entries.length}),fe(e.target,e.targetHp,n,{hit:!1}),Yt(e.target,e.poisonStacks),Vt(e.target)});return}if(e.effect==="heal"){c||ga(e.attacker,e.target),Se(200,()=>{Ee?.play("sfx.battle.abilities.heal",{volume:.7,minInterval:80}),fe(e.target,e.targetHp,n,{hit:!1,healing:e.healing}),We(e.target,e.healing,"heal",e.attacker,e.effect),qt(e.target)});return}if(e.effect==="last_breath"){Se(160,()=>{fe(e.target,e.targetHp,n,{hit:!1}),We(e.target,1,"heal",e.attacker,e.effect),qt(e.target)});return}if(e.effect==="shared_pain"){fe(e.target,e.targetHp,n,{hit:!1});return}if(e.effect==="poison_apply"){c||Le(t.attacker,e.target,{effect:e.effect,poison:!0,bubbles:15,variant:"poison-flame"}),Se(220,()=>{Yt(e.target,e.poisonStacks||1),fe(e.target,e.targetHp,n),Gt(e.target,{attackerId:e.attacker,effect:e.effect,variant:"poison"}),Vt(e.target)});return}let d=Ue(e),l=o&&ut(e),g=i&&ut(e),u=l||g,p=!J(e)||Zr(e,t);!c&&!u&&p&&d.draw();let P=l?o.travel+o.lead+a*50:d.travel+(r?a*70:0);Se(P,()=>{fe(e.target,e.targetHp,n);let y=Xn(e,t);y>0&&We(e.target,y,ha(e.attacker)?"dark":"damage",e.attacker,e.effect),Gt(e.target,{attackerId:e.attacker,effect:e.effect,heavy:d.heavy,variant:d.key,aoe:r&&!J(e)}),sa(e.target,d.heavy),d.screenShake&&ca(),la(e.target,e.targetHp)})}function Xn(e,t){let n=Math.max(0,Number(e?.dmg)||0);if(!J(e))return n;let a=(t?.entries||[]).filter(r=>J(r)&&r.target===e.target);return a[0]!==e?0:a.reduce((r,o)=>r+Math.max(0,Number(o.dmg)||0),0)}function Zr(e,t){if(!J(e))return!0;let n=(t?.entries||[]).filter(J),a=n.filter(o=>o.effect==="retaliate"||Jr(o.attacker));return(a.length?a:n).find(o=>o.attacker===e.attacker)===e}function Jr(e){let t=Q(e)||{},n=String(t.role||"").toLowerCase(),a=String(t.abilityKind||t.ability_kind||t.ability?.kind||"").toLowerCase();return Number(t.typeId)===8||n==="counter_tank"||a==="retaliate"}async function Qr(){for(;s.combatPlayback?.isPaused;){Z(!0);let e=Number(s.combatPlayback.stepDirection)||0;if(s.combatPlayback.stepDirection=0,e<0)return"previous";if(e>0)return s.combatPlayback.currentIndex<s.combatPlayback.totalSteps?"next":null;await eo()}return Z(!1),s.combatPlayback?"play":null}function Zn(e){let t=s.combatPlayback;return t?new Promise(n=>{let a=window.setTimeout(r,Math.max(0,Number(e)||0));function r(){window.clearTimeout(a),t.waitResolve===r&&(t.waitResolve=null),n()}t.waitResolve=r}):Promise.resolve()}function eo(){let e=s.combatPlayback;return e?new Promise(t=>{e.waitResolve=()=>{e.waitResolve=null,t()}}):Promise.resolve()}function Xt(){!s.combatPlayback||!s.isBattleAnimating||(s.combatPlayback.isPaused=!0,Z(!0),ft(),Ae())}function Zt(){!s.combatPlayback||!s.isBattleAnimating||(s.combatPlayback.isPaused=!1,s.combatPlayback.stepDirection=0,Z(!1),ft(),Ae())}function Jt(e){!s.combatPlayback||!s.isBattleAnimating||(s.combatPlayback.isPaused=!0,s.combatPlayback.stepDirection=Number(e)<0?-1:1,Z(!0),ft(),Ae())}function Qt(){let e=s.combatPlayback;!s.run||!e||!s.isBattleAnimating||(e.isPaused=!1,e.stepDirection=0,Jn(e.totalSteps),Z(!1),ft())}function ft(){let e=s.combatPlayback?.waitResolve;e&&e()}function Jn(e){if(!s.run||!s.combatPlayback)return;ro(),no();let t=s.combatPlayback.steps||[],n=en(Math.floor(Number(e)||0),0,t.length);for(let a=0;a<n;a+=1)Kt(t[a],a,{animate:!1});s.combatPlayback.currentIndex=n,je(),pt(n>0?n-1:-1)}async function to(){let e=s.combatPlayback;if(!s.run||!e||e.currentIndex<=0)return;let t=e.steps||[],n=en(e.currentIndex-2,0,t.length-1),a=t[n];a&&(Jn(n),Z(!1),Kt(a,n,{animate:!0}),e.currentIndex=n+1,Ae(),await Zn(q(rn(a))),s.combatPlayback&&(s.combatPlayback.isPaused=!0,Z(!0),Ae()))}function no(){let e=s.run?.lastBattle||{};s.run.team=Ot(e.playerTeamBefore||s.run.team||[]),s.run.enemies=Ot(e.enemyTeamBefore||s.run.enemies||[]),s.combatDemons=Ze()}function ao(){return new Map([...s.run?.team||[],...s.run?.enemies||[]].map(e=>[e.instanceId,e]))}function ro(){uo(),document.querySelectorAll([".attack-zap",".chaos-lightning",".combat-impact-burst",".dark-spike",".fireball-shot",".fire-nova",".floating-combat-number",".heal-effect",".sword-swing",".thorn-burst"].join(",")).forEach(e=>e.remove()),document.querySelector(".dungeon-arena")?.classList.remove("is-combat-screenshake")}function Z(e){let t=!!e;document.documentElement.classList.toggle("is-combat-paused",t),t?co():lo()}function en(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}function Qn(){s.run&&(s.run.hp=(s.run.team||[]).reduce((e,t)=>e+Math.max(0,Number(t.hp)||0),0))}function ea(){[...s.run?.team||[],...s.run?.enemies||[]].forEach(e=>{fe(e.instanceId,e.hp)})}function pt(e){document.querySelectorAll(".fight-log-row").forEach(t=>{t.classList.toggle("active",Number(t.dataset.logIndex)===e)})}function ta(e,t,n){let a=A(e);a&&(an(a,nn(e,t)),a.classList.toggle("is-player-attack",oe(e)==="player"),a.classList.toggle("is-enemy-attack",oe(e)==="enemy"),oo(a,n),pe(a,"is-attacking",320))}function oo(e,t){if(z()||!t){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let n=A(t);if(!n){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let a=e.getBoundingClientRect(),r=n.getBoundingClientRect(),o=r.left+r.width/2-(a.left+a.width/2),i=r.top+r.height/2-(a.top+a.height/2),c=Math.hypot(o,i)||1,d=Math.min(18,c*.26);e.style.setProperty("--lunge-x",`${(o/c*d).toFixed(1)}px`),e.style.setProperty("--lunge-y",`${(i/c*d).toFixed(1)}px`)}function Ue(e){let{attacker:t,target:n,effect:a}=e;if(J(e))return{key:"thorn",travel:210,heavy:!1,screenShake:!1,draw:()=>Wt(t,n)};if(e.targeting==="chaotic")return{key:"chaotic",travel:150,heavy:!0,screenShake:!1,draw:()=>fa(t,n)};let r=Number(Q(t)?.typeId);return{2:{key:"dark",travel:200,heavy:!1,draw:()=>pa(t,n)},4:{key:"fire",travel:380,heavy:!0,screenShake:!1,draw:()=>da(t,n,{effect:a})},5:{key:"sniper",travel:360,heavy:!0,draw:()=>Le(t,n,{effect:a,variant:"heavy",duration:520})},6:{key:"assassin",travel:120,heavy:!1,draw:()=>Le(t,n,{effect:a,variant:"assassin",duration:240})},7:{key:"melee",travel:170,heavy:!1,draw:()=>tn(t,n)},8:{key:"thorn",travel:210,heavy:!1,draw:()=>Wt(t,n)},9:{key:"crushing",travel:620,heavy:!0,screenShake:!0,draw:()=>Le(t,n,{effect:a,variant:"crushing",duration:960})}}[r]||{key:"melee",travel:150,heavy:!1,draw:()=>Le(t,n,{effect:a})}}function io(e){Ue(e).draw()}function z(){return!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)}var De=new Set;function na(){return window.performance?.now?.()??Date.now()}function Se(e,t){let n=q(e);if(z()||n<=0){t();return}let a={fn:t,remaining:n,startedAt:0,handle:null};a.run=()=>{a.handle=null,De.delete(a),a.fn()},De.add(a),so()||aa(a)}function aa(e){e.startedAt=na(),e.handle=window.setTimeout(e.run,e.remaining)}function so(){return document.documentElement.classList.contains("is-combat-paused")}function co(){De.forEach(e=>{e.handle!=null&&(window.clearTimeout(e.handle),e.handle=null,e.remaining=Math.max(0,e.remaining-(na()-e.startedAt)))})}function lo(){De.forEach(e=>{e.handle==null&&aa(e)})}function uo(){De.forEach(e=>{e.handle!=null&&window.clearTimeout(e.handle)}),De.clear()}function Gt(e,t={}){if(z())return;let n=A(e);if(!n)return;let a=n.getBoundingClientRect(),r=Y(["combat-impact-burst",t.heavy?"is-heavy":"",t.aoe?"is-aoe":"",`is-${t.variant||"melee"}`].filter(Boolean).join(" "),t.attackerId,t.effect);r.style.left=`${(a.left+a.width/2).toFixed(1)}px`,r.style.top=`${(a.top+a.height/2).toFixed(1)}px`;let o=t.heavy?520:380;r.style.setProperty("--fx-duration",`${q(o)}ms`);let i=t.heavy?9:6,c=t.heavy?26:17,d=Array.from({length:i},(l,g)=>{let u=360/i*g+(g%2?14:-10),p=c+g%3*5;return`<span class="combat-impact-particle" style="--p-angle:${u.toFixed(0)}deg;--p-dist:${p}px;animation-delay:${q(g*6)}ms"></span>`}).join("");r.innerHTML=`<span class="combat-impact-core"></span>${t.aoe?'<span class="combat-impact-ring"></span>':""}${d}`,W(r,o)}function ra(e){try{return localStorage.getItem(e)!=="0"}catch{return!0}}function oa(){return ra(zn)}function ia(){return ra(On)}function sa(e,t){if(z())return;let n=A(e);if(!n)return;let a=oa();pe(n,t&&a?"is-shaking":"is-hit",t&&a?360:240)}function Vt(e){if(z())return;let t=A(e);t&&pe(t,"is-poison-tick",520)}function qt(e){if(z())return;let t=A(e);t&&pe(t,"is-healed",520)}var jn=0;function ca(){if(z()||!ia())return;let e=window.performance?.now?.()??Date.now();if(e-jn<140)return;jn=e;let t=document.querySelector(".dungeon-arena");t&&pe(t,"is-combat-screenshake",360)}function la(e,t){if(Number(t)>0)return;let n=A(e);!n||n.classList.contains("is-dying")||(Ee?.playDeath(),!z()&&pe(n,"is-dying",620))}function Le(e,t,n={}){let a=A(e),r=A(t);if(!a||!r)return;let{attackerRect:o,startX:i,startY:c,endX:d,endY:l}=Ke(a,r),g=Q(e),u=g&&Ut(g)==="back",p=u?.12:.22,P=u?.9:.78,y=i+(d-i)*p,S=c+(l-c)*p,k=i+(d-i)*P,x=c+(l-c)*P,M=(y+k)/2,F=(S+x)/2,T=-(x-S)/Math.max(1,Math.hypot(k-y,x-S)),I=(k-y)/Math.max(1,Math.hypot(k-y,x-S)),X=u?10:6,ne=M+T*X,ae=F+I*X,ue=Number(n.bubbles)||0,Pe=ue?Array.from({length:ue},(ye,O)=>{let E=.08+O/Math.max(1,ue-1)*.84,ve=(1-E)*(1-E)*y+2*(1-E)*E*ne+E*E*k,Ft=(1-E)*(1-E)*S+2*(1-E)*E*ae+E*E*x,Ve=(O%2?-1:1)*(4+O%4),V=2.2+O%4*.8;return`<circle class="poison-bubble" cx="${(ve+T*Ve).toFixed(1)}" cy="${(Ft+I*Ve).toFixed(1)}" r="${V.toFixed(1)}" style="animation-delay: ${q(O*18).toFixed(0)}ms" />`}).join(""):"",H=Number(n.flames)||0,D=H?Array.from({length:H},(ye,O)=>{let E=.08+O/Math.max(1,H-1)*.84,ve=(1-E)*(1-E)*y+2*(1-E)*E*ne+E*E*k,Ft=(1-E)*(1-E)*S+2*(1-E)*E*ae+E*E*x,Ve=(O%2?-1:1)*(5+O%3*2),V=5+O%4,ke=ve+T*Ve,we=Ft+I*Ve;return`<path class="fire-spark" d="M ${ke.toFixed(1)} ${(we-V).toFixed(1)} C ${(ke+V*.72).toFixed(1)} ${(we-V*.2).toFixed(1)} ${(ke+V*.45).toFixed(1)} ${(we+V*.72).toFixed(1)} ${ke.toFixed(1)} ${(we+V).toFixed(1)} C ${(ke-V*.55).toFixed(1)} ${(we+V*.42).toFixed(1)} ${(ke-V*.45).toFixed(1)} ${(we-V*.32).toFixed(1)} ${ke.toFixed(1)} ${(we-V).toFixed(1)} Z" style="animation-delay: ${q(O*16).toFixed(0)}ms" />`}).join(""):"",me=Y(["attack-zap",oe(e)==="player"?"is-player-attack":"is-enemy-attack",u?"is-back-attack":"",n.variant?`is-${n.variant}`:"",n.poison?"is-poison-apply":""].filter(Boolean).join(" "),e,n.effect);me.innerHTML=ie(`
      <path class="attack-zap-trail" d="M ${y.toFixed(1)} ${S.toFixed(1)} Q ${ne.toFixed(1)} ${ae.toFixed(1)} ${k.toFixed(1)} ${x.toFixed(1)}" />
      ${n.variant==="assassin"?`<path class="attack-zap-trail attack-zap-trail-secondary" d="M ${(y+T*7).toFixed(1)} ${(S+I*7).toFixed(1)} Q ${(ne+T*7).toFixed(1)} ${(ae+I*7).toFixed(1)} ${(k+T*7).toFixed(1)} ${(x+I*7).toFixed(1)}" />`:""}
      ${Pe}
      ${D}
      <circle class="attack-zap-impact" cx="${k.toFixed(1)}" cy="${x.toFixed(1)}" r="${u?5:4}" />
  `),W(me,n.duration||320)}function da(e,t,n={}){let a=A(e),r=A(t);if(!a||!r)return;let{attackerRect:o,targetRect:i,startX:c,startY:d,endX:l,endY:g,angle:u}=Ke(a,r),p=Q(e),P=p&&Ut(p)==="back",y=Math.min(o.width*(P?.28:.42),46),S=Math.min(i.width*.18,22),k=c+Math.cos(u)*y,x=d+Math.sin(u)*y,M=l-Math.cos(u)*S,F=g-Math.sin(u)*S,T=Math.max(1,Math.hypot(M-k,F-x)),I=-(F-x)/T,X=(M-k)/T,ne=Math.max(12,Math.min(24,i.width*.18)),ae=8,ue=Array.from({length:ae},(H,D)=>{let me=.12+D/Math.max(1,ae-1)*.72,ye=(D%2?-1:1)*(4+D%3*2),O=k+(M-k)*me+I*ye,E=x+(F-x)*me+X*ye,ve=1.8+D%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${E.toFixed(1)}" r="${ve.toFixed(1)}" style="animation-delay: ${q(70+D*28).toFixed(0)}ms" />`}).join(""),Pe=Y(["fireball-shot",oe(e)==="player"?"is-player-attack":"is-enemy-attack",P?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);Pe.innerHTML=ie(`
      ${ue}
      <g class="fireball-projectile" style="--fireball-start-x: ${k.toFixed(1)}px; --fireball-start-y: ${x.toFixed(1)}px; --fireball-end-x: ${M.toFixed(1)}px; --fireball-end-y: ${F.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="8.5" />
        <circle class="fireball-hot" cx="3.6" cy="-2.2" r="4.2" />
      </g>
      <circle class="fireball-impact" cx="${M.toFixed(1)}" cy="${F.toFixed(1)}" r="${ne.toFixed(1)}" />
  `),W(Pe,620)}function ua(e,t,n={}){let a=A(e),r=(t||[]).map(A).filter(Boolean);if(z()||!a||!r.length)return;let o=a.getBoundingClientRect(),i=o.left+o.width/2,c=o.top+o.height/2,d=r.map(H=>{let D=H.getBoundingClientRect();return{x:D.left+D.width/2,y:D.top+D.height/2,half:Math.max(D.width,D.height)/2}}),l=d.reduce((H,D)=>H+D.x,0)/d.length,g=d.reduce((H,D)=>H+D.y,0)/d.length,u=Math.atan2(g-c,l-i),p=Q(e),P=p&&Ut(p)==="back",y=Math.min(o.width*(P?.28:.42),46),S=i+Math.cos(u)*y,k=c+Math.sin(u)*y,x=l,M=g,F=Math.max(1,Math.hypot(x-S,M-k)),T=-(M-k)/F,I=(x-S)/F,X=en(Math.max(...d.map(H=>Math.hypot(H.x-l,H.y-g)+H.half))+8,44,220),ne=9,ae=Array.from({length:ne},(H,D)=>{let me=.12+D/Math.max(1,ne-1)*.72,ye=(D%2?-1:1)*(4+D%3*2),O=S+(x-S)*me+T*ye,E=k+(M-k)*me+I*ye,ve=1.8+D%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${E.toFixed(1)}" r="${ve.toFixed(1)}" style="animation-delay: ${q(70+D*28).toFixed(0)}ms" />`}).join(""),ue=Y(["fireball-shot",oe(e)==="player"?"is-player-attack":"is-enemy-attack",P?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);ue.innerHTML=ie(`
      ${ae}
      <g class="fireball-projectile" style="--fireball-start-x: ${S.toFixed(1)}px; --fireball-start-y: ${k.toFixed(1)}px; --fireball-end-x: ${x.toFixed(1)}px; --fireball-end-y: ${M.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="11" />
      </g>
  `),W(ue,620);let Pe=Number(n.travel)||380;Se(Pe,()=>ma(l,g,X,e,n.effect))}function ma(e,t,n,a,r){if(z())return;let o=Math.max(20,Number(n)||60),i=Y("fire-nova",a,r),c=`fire-nova-grad-${Math.random().toString(36).slice(2,8)}`;i.innerHTML=ie(`
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
  `),W(i,620)}function fe(e,t,n="unknown",a={}){let r=A(e);if(!r)return;let o=r.querySelector(".js-demon-hp");o&&(o.textContent=t);let i=r.querySelector(".js-demon-hp-fill");if(i){let c=Number(i.dataset.maxHp)||Number(t)||1,d=Math.max(0,Math.min(100,Math.round(Number(t)/c*100)));i.style.width=`${d}%`}r.classList.toggle("is-defeated",Number(t)<=0)}function Yt(e,t){let n=A(e);if(!n)return;let a=n.querySelector(".demon-status-poison");if(Number(t)<=0){n.querySelector(".demon-status-strip")?.remove(),n.classList.remove("is-poisoned");return}n.classList.add("is-poisoned"),n.querySelector(".demon-status-strip")?.remove(),n.insertAdjacentHTML("beforeend",Yr({statusEffects:{poison:Array.from({length:Math.max(1,Number(t)||1)},()=>({}))}}))}function We(e,t,n,a,r,o={}){let i=A(e);if(!i)return;let c=i.getBoundingClientRect(),d=Y(`floating-combat-number is-${n}`,a,r||n);if(d.style.left=`${(c.left+c.width/2).toFixed(1)}px`,d.style.top=`${Math.max(6,c.top+c.height*.08).toFixed(1)}px`,d.innerHTML=n==="heal"?`+${w(t)}`:`-${w(t)}`,n==="poison"&&Number(o.burstCount)>1){let l=Math.max(1,Number(o.burstCount)||1),g=Math.min(2.2,1+(l-1)*.12);d.style.fontSize=`calc(1.22rem * ${g.toFixed(2)})`}W(d,760)}function tn(e,t){let n=A(e),a=A(t);if(!n||!a)return;let{attackerRect:r,startX:o,startY:i,endX:c,endY:d,angle:l}=Ke(n,a),g=Math.max(70,r.height*.92),u=Math.max(18,r.width*.2),p=r.width*.58,P=o+Math.cos(l)*p,y=i+Math.sin(l)*p,S=Math.max(22,r.width*.26),k=Y("sword-swing",e);k.innerHTML=ie(`
      ${[-.18,0,.18].map((x,M)=>{let F=P+Math.cos(l+Math.PI/2)*g*x,T=y+Math.sin(l+Math.PI/2)*g*x,I=`M ${F.toFixed(1)} ${(T-g*.34).toFixed(1)} Q ${(F+u).toFixed(1)} ${T.toFixed(1)} ${F.toFixed(1)} ${(T+g*.34).toFixed(1)}`,X=`rotate(${(l*180/Math.PI).toFixed(1)} ${F.toFixed(1)} ${T.toFixed(1)}) translate(${S.toFixed(1)} 0)`;return`<path class="sword-swing-belly sword-scratch-${M+1}" d="${I}" transform="${X}" /><path class="sword-swing-arc sword-scratch-${M+1}" d="${I}" transform="${X}" />`}).join("")}
  `),W(k,440)}function Wt(e,t){let n=A(e),a=A(t);if(!n||!a)return;let{attackerRect:r,startX:o,startY:i,angle:c}=Ke(n,a),d=Math.max(42,r.width*.5),l=o+Math.cos(c)*d,g=i+Math.sin(c)*d,u=Math.max(22,r.width*.28),p=Y("thorn-burst",e),P=[-.48,-.28,-.1,.1,.28,.48];p.innerHTML=ie(`
      ${P.map((y,S)=>{let k=c+y,x=u*(.74+S%2*.16),M=r.height*.82,F=l+Math.cos(c+Math.PI/2)*(S/(P.length-1)-.5)*M,T=g+Math.sin(c+Math.PI/2)*(S/(P.length-1)-.5)*M,I=F+Math.cos(k)*x,X=T+Math.sin(k)*x;return`<path class="thorn-spike" d="M ${F.toFixed(1)} ${T.toFixed(1)} L ${I.toFixed(1)} ${X.toFixed(1)}" />`}).join("")}
  `),W(p,520)}function mo(e){let t=A(e);t&&pe(t,"is-shaking",360)}function ga(e,t){let n=A(t);if(!n)return;let a=n.getBoundingClientRect(),r=a.left+a.width/2,o=a.top+a.height/2,i=Math.max(18,a.width*.18),c=Y("heal-effect",e,"heal");c.innerHTML=ie(`
      <circle class="heal-ring" cx="${r.toFixed(1)}" cy="${o.toFixed(1)}" r="${i.toFixed(1)}" />
      <circle class="heal-ring heal-ring-secondary" cx="${(r-i*.6).toFixed(1)}" cy="${(o+i*.16).toFixed(1)}" r="${(i*.72).toFixed(1)}" />
      <circle class="heal-ring heal-ring-tertiary" cx="${(r+i*.58).toFixed(1)}" cy="${(o-i*.14).toFixed(1)}" r="${(i*.58).toFixed(1)}" />
  `),W(c,620)}function fa(e,t){let n=A(t);if(!n)return;let a=n.getBoundingClientRect(),r=a.left+a.width/2,o=Math.max(0,a.top-Math.min(170,window.innerHeight*.24)),i=a.top+a.height*.56,c=a.top+a.height*.26,d=Y("chaos-lightning is-thunderstrike",e),l=`M ${(r-12).toFixed(1)} ${o.toFixed(1)} L ${(r+10).toFixed(1)} ${(o+42).toFixed(1)} L ${(r-8).toFixed(1)} ${(o+42).toFixed(1)} L ${(r+7).toFixed(1)} ${(c+10).toFixed(1)} L ${(r-16).toFixed(1)} ${(c+10).toFixed(1)} L ${(r+4).toFixed(1)} ${i.toFixed(1)}`,g=`M ${(r+7).toFixed(1)} ${(c-4).toFixed(1)} L ${(r+34).toFixed(1)} ${(c+10).toFixed(1)} L ${(r+14).toFixed(1)} ${(c+18).toFixed(1)}`,u=`M ${(r-4).toFixed(1)} ${(c+22).toFixed(1)} L ${(r-35).toFixed(1)} ${(c+34).toFixed(1)} L ${(r-13).toFixed(1)} ${(c+43).toFixed(1)}`;d.innerHTML=ie(`
      <path class="chaos-thunder-border chaos-thunder-core" d="${l}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${g}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${u}" />
      <path class="chaos-thunder-core" d="${l}" />
      <path class="chaos-thunder-branch" d="${g}" />
      <path class="chaos-thunder-branch" d="${u}" />
  `),W(d,360)}function pa(e,t){let n=A(e),a=A(t);if(!n||!a)return;let r=n.getBoundingClientRect(),o=a.getBoundingClientRect(),i=r.left+r.width/2,c=r.top+r.height/2,d=o.left+o.width/2,l=o.top+o.height/2,g=Math.atan2(l-c,d-i),u=Math.max(24,Math.hypot(d-i,l-c)),p=Y("dark-spike",e);p.style.left=`${i}px`,p.style.top=`${c}px`,p.style.width=`${u}px`,p.style.setProperty("--dark-spike-angle",`${g}rad`),W(p,340)}function nn(e,t){if(t==="poison"||t==="poison_apply")return qe.poison;if(t==="heal")return qe.heal;let n=Number(Q(e)?.typeId);return qe[n]||qe.default}function an(e,t){!e||!t||(e.style.setProperty("--combat-color",t.color),e.style.setProperty("--combat-shadow",t.shadow),e.style.setProperty("--combat-text-outline",t.outline||"#fff"))}function Y(e,t,n){let a=document.createElement("div");return a.className=e,an(a,nn(t,n)),a}function W(e,t,n=document.body){return n.appendChild(e),setTimeout(()=>e.remove(),q(t)),e}function ie(e){return`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">${e}</svg>`}function Ke(e,t){let n=e.getBoundingClientRect(),a=t.getBoundingClientRect(),r=n.left+n.width/2,o=n.top+n.height/2,i=a.left+a.width/2,c=a.top+a.height/2;return{attackerRect:n,targetRect:a,startX:r,startY:o,endX:i,endY:c,angle:Math.atan2(c-o,i-r)}}function rn(e){let t=e.entries||[],n=gt(e),a=new Map(n.map((i,c)=>[i,c])),r=!!e.isAoe||n.length>1,o=240;return Math.max(340,...t.map(i=>{if(i.effect==="heal"||i.effect==="last_breath")return 500;if(i.effect==="poison")return 380;if(i.effect==="poison_apply")return 460;if(i.effect==="shared_pain")return 320;let c=a.get(i)??0,d=r?c*70:0;return Ue(i).travel+d+o}))}function on(e){xe.includes(e)&&(s.battleSpeed=e,localStorage.setItem(ct,String(e)),ht(),bt())}function ht(){document.documentElement.style.setProperty("--battle-animation-scale",String(sn())),[24,34,36,48,80,150,240,320,340,360,440,520,620,760,960].forEach(e=>{document.documentElement.style.setProperty(`--battle-duration-${e}`,`${q(e)}ms`)})}function sn(){return 1/(Number(s.battleSpeed)||1)}function q(e){return Math.max(0,Math.round((Number(e)||0)*sn()))}function go(e){return`${Number(e)}x`}function bt(){document.querySelectorAll("[data-battle-speed]").forEach(e=>{let t=Number(e.dataset.battleSpeed)===s.battleSpeed;e.classList.toggle("active",t),e.classList.toggle("ad-primary-action",t),e.setAttribute("aria-pressed",t?"true":"false")})}function ha(e){return Number(Q(e)?.typeId)===2}function A(e){let t=`.dungeon-demon-card[data-instance-id="${Wn(String(e))}"]`;return document.querySelector(`#teamGrid ${t}, #enemyGrid ${t}`)||document.querySelector(t)}function pe(e,t,n){let a=`${t}Timer`;e[a]&&clearTimeout(e[a]),e.classList.remove(t),e.offsetWidth,e.classList.add(t),e[a]=setTimeout(()=>{e.classList.remove(t),(t==="is-attacking"||t==="is-hit")&&e.classList.remove("is-player-attack","is-enemy-attack"),e[a]=null},q(n))}function cn(e,t){let n=e.entries[0],a=Number.isInteger(e.playbackIndex)?e.playbackIndex:t,r=ka(e),o=n.effect==="poison_apply"?"Poisoned":n.effect==="heal"?`${n.targetHp} HP`:e.isAoe?"AOE":`${n.targetHp} HP`;return`
    <div class="fight-log-row ${wa(n)}" data-log-index="${a}">
      <span class="text-secondary">T${n.tick}</span>
      <span class="fight-log-side">${$a(n)}</span>
      <span class="fight-log-action">${ya(e)}</span>
      <span class="fight-log-damage">${r}</span>
      <span class="text-secondary">${o}</span>
    </div>
  `}function Xe(e,t={}){let n=[],a=t.combineCounters===!0;for(let r of e||[]){let o=n[n.length-1],i=r.targeting==="all"||r.targeting==="cleave"?[...n].reverse().find(u=>u.isAoe&&u.tick===r.tick&&u.attacker===r.attacker):null,d=r.effect==="thorns"||a&&r.effect==="retaliate"?[...n].reverse().find(u=>u.tick===r.tick&&u.entries.some(p=>p.attacker===r.target&&p.target===r.attacker)):null,l=r.effect==="poison"&&o?.primaryEffect==="poison"&&o.tick===r.tick&&o.entries.every(u=>u.target===r.target),g=i||d||(l?o:null);if(g){g.entries.push(r);continue}n.push({tick:r.tick,attacker:r.attacker,isAoe:r.targeting==="all"||r.targeting==="cleave",primaryEffect:r.effect||null,entries:[r]})}if(!a){let r=Xe(e,{combineCounters:!0}),o=new Map;r.forEach((i,c)=>{i.entries.forEach(d=>o.set(d,c))}),n.forEach(i=>{i.playbackIndex=o.get(i.entries[0])})}return n}function ba(e){return e?`<span class="fight-log-position">${e==="front"?"Front":"Back"}</span>`:""}function ya(e){let t=e.entries[0],n=gt(e).length,a=jt(t.attacker),r=`${jt(t.target)} ${ba(t.targetPosition)}`;return t.effect==="poison_apply"?`${a} applied poison to ${r}`:t.effect==="poison"?`${r} took poison damage`:t.effect==="heal"?`${a} healed ${r}`:t.effect==="last_breath"?`${r} survived at 1 HP`:t.effect==="shared_pain"?"Surviving allies gained direct damage":t.effect==="chain_explosion"?`${a} exploded into ${r}`:t.effect==="retaliate"?`${a} retaliated against ${r}`:t.effect==="thorns"?`${a} reflected damage to ${r}`:t.knockback?`${a} crushed ${r} back`:t.targeting==="chaotic"?`${a} chaotically struck ${r}`:t.targeting==="cleave"?`${a} cleaved ${n} demons`:e.isAoe?`${a} splashed ${n} enemies`:`${a} ${va(t)} ${r}`}function va(e){return e.effect==="poison_apply"||e.effect==="poison"?"poisoned":e.effect==="heal"?"healed":e.effect==="last_breath"?"survived":e.effect==="shared_pain"?"empowered":e.effect==="chain_explosion"?"exploded into":e.effect==="retaliate"?"retaliated against":e.effect==="thorns"?"reflected damage to":e.targeting==="chaotic"?"chaotically struck":e.targeting==="cleave"?"cleaved":e.targeting==="all"?"splashed":"hit"}function ka(e){let t=e.entries[0],n=gt(e).length,a=e.entries.find(r=>r.effect==="retaliate"||r.effect==="thorns");if(t.effect==="poison_apply")return"poison";if(t.effect==="poison")return`${ln(e)} poison`;if(t.effect==="heal")return`+${t.healing||0} hp`;if(t.effect==="last_breath")return"1 hp";if(t.effect==="shared_pain")return"+25% dmg";if(t.effect==="chain_explosion")return`${t.dmg||0} splash`;if(t.effect==="thorns")return`${t.dmg||0} thorns`;if(t.effect==="retaliate")return`${t.dmg||0} retaliation`;if(a){let r=a.effect==="thorns"?"thorns":"retaliation";return`${t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}, ${a.dmg} ${r}`}return t.knockback?`${t.dmg} dmg, push`:t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}function ln(e){return(e.entries||[]).filter(t=>t.effect==="poison").reduce((t,n)=>t+(Number(n.dmg)||0),0)}function Ze(){return new Map([...(s.run?.team||[]).map(e=>[e.instanceId,{...e,side:"player"}]),...(s.run?.enemies||[]).map(e=>[e.instanceId,{...e,side:"enemy"}])])}function wa(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||oe(e.attacker)==="player"?"is-player-action":"is-enemy-action"}function $a(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||oe(e.attacker)==="player"?"You":"Enemy"}function oe(e){return(s.run?.team||[]).some(t=>t.instanceId===e)?"player":(s.run?.enemies||[]).some(t=>t.instanceId===e)?"enemy":s.combatDemons.get(e)?.side?s.combatDemons.get(e).side:"unknown"}function Q(e){return[...s.run?.team||[],...s.run?.enemies||[]].find(t=>t.instanceId===e)||s.combatDemons.get(e)||null}function jt(e){let t=[...s.run?.team||[],...s.run?.enemies||[]].find(n=>n.instanceId===e)||s.combatDemons.get(e);return t?`<span class="ad-${w(t.rarity)}">${w(t.species||"Demon")}</span>`:w(e)}var Ra=(...e)=>h.getCollectionReinforcementLimit(...e),fo=(...e)=>h.getExplicitFormationRow(...e),po=(...e)=>h.getRecruitTeamLimit(...e);var Pa=(...e)=>h.getSelectedCollectionReinforcements(...e),un=(...e)=>h.normalizeFormationRow(...e),ho=(...e)=>h.shouldShowCollectionMissingTag(...e);function mn(e,t={}){let n=t.side==="enemy"?"enemy":"player",a=bo(e||[],n),r=t.gridStyle?` style="${w(t.gridStyle)}"`:"";return`
    <div class="battle-formation battle-formation-grid battle-formation-${n}"${r} role="list" aria-label="${n==="enemy"?"Enemy":"Your team"} formation">
      ${a.map((o,i)=>gn(o,i,t,n)).join("")}
    </div>
  `}function gn(e,t,n,a){let r=yt(t,a),o=ko(t,a),i=vo[o]||"",c=t+1,d=n.side==="enemy"?"Enemy":"Your team",l=Ro(n)?Po(r):"",g=!e&&So(n,a),u=e?Co(e,n):l||$o(r,c,{collectionTeamTrigger:g});return`
    <div class="formation-slot formation-lane formation-slot-${r} ${i} ${e?"has-demon":"is-empty"}" data-formation-position="${r}" data-formation-lane="${o}" data-formation-row="${t}" data-formation-slot="${t}" role="listitem" aria-label="${w(`${d} slot ${c}`)}">
      <div class="formation-lane-cards formation-slot-cards" data-formation-drop="${r}" data-formation-row="${t}">
        ${u}
      </div>
    </div>
  `}function bo(e=[],t="player"){let n=Array.from({length:9},()=>null),a=[],r=[];return(e||[]).slice(0,9).forEach((o,i)=>{let c=fo(o),d=c!==null?yt(c,t):null,l={...o,position:d||Do(o,i)};if(c!==null&&!n[c]&&yt(c,t)===l.position){n[c]=l;return}a.push({demon:l,preferredCell:un(i)})}),a.forEach(({demon:o,preferredCell:i})=>{if(!n[i]&&yt(i,t)===o.position){n[i]=o;return}r.push(o)}),r.forEach(o=>{let i=yo(n,t,o.position);i>=0&&(n[i]=o)}),n}function yo(e,t="player",n=null){for(let a of wo(t,n))if(!e[a])return a;return e.findIndex(a=>!a)}function yt(e,t="player"){let n=un(e)%3,a=t==="enemy"?0:2;return n===a?"front":"back"}var vo={front:"frontline",mid:"middleline",back:"backline"};function ko(e,t="player"){let n=un(e)%3,a=t==="enemy"?0:2,r=t==="enemy"?2:0;return n===a?"front":n===r?"back":"mid"}function wo(e="player",t=null){let n=e==="enemy"?0:2,a=1,r=e==="enemy"?2:0;return(e==="enemy"?t==="front"?[n,a]:t==="back"?[r,a]:[n,a,r]:t==="front"?[n]:t==="back"?[a,r]:[n,a,r]).flatMap(i=>Array.from({length:3},(c,d)=>d*3+i))}function $o(e,t,n={}){return n.collectionTeamTrigger?`
      <button class="formation-empty formation-empty-${e} collection-reinforcement-team-slot" type="button" data-slot-number="${t}" aria-label="Add a Collection demon to team slot ${t}" title="Add from collection">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </button>
    `:`
    <div class="formation-empty formation-empty-${e}" aria-hidden="true" data-slot-number="${t}">
      <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
    </div>
  `}function So(e,t){return!!(t==="player"&&e.side==="player"&&s.isRecruiting&&s.run?.awaitingRecruit&&s.run?.collectionReinforcementAvailable&&(s.recruitDraftTeam||[]).length<po()&&Pa().length<Ra())}function Ro(e){return!!(s.isRecruiting&&e.side==="hand"&&s.run?.collectionReinforcementAvailable&&Pa().length<Ra())}function Po(e){return`
    <button class="dungeon-demon-card collection-reinforcement-placeholder ${s.collectionReinforcementPlaceholderInteracted?"":"is-collection-reinforcement-attention"}" type="button" data-collection-reinforcement-position="${e}" aria-label="Add from collection" title="Add from collection">
      <div class="collection-reinforcement-placeholder-icon">${B("plus",{size:48,strokeWidth:2.75})}</div>
    </button>
  `}function xo(e,t={}){let n=ho(e,t),a=[t.className||"",n?"is-new-encounter":""].filter(Boolean).join(" "),r=`${t.overlayHtml||""}${n?Lo():""}`;return Vn(e,{...t,className:a,overlayHtml:r})}function Co(e,t){let n=t.side==="player",a=t.side==="hand"&&!!t.isTeamUpgrade,r=!!(t.allowRecruitDrag&&e.recruitSource),o=!!(t.allowRewardDrag&&e.rewardCandidateKey),i=!!(s.isRecruiting&&n),c=!!((t.allowFormationDrag||s.isRecruiting)&&n),d=r||o||c,l=["dungeon-demon-card",r?"is-recruit-draggable":"",o?"is-reward-draggable":"",a?"is-team-upgrade":"",e.recruitSource==="collection"&&!s.collectionReinforcementStagedInteracted?"is-collection-reinforcement-attention":"",i?"is-recruit-drop-target":"",Eo(e)?"is-poisoned":""].filter(Boolean).join(" ");return xo(e,{className:l.replace("dungeon-demon-card","").trim(),defeated:Number(e.hp)<=0,active:s.selectedSwapInstanceId===e.instanceId||s.selectedRecruitRewardId===e.rewardId||s.selectedRewardDemonKey===e.rewardCandidateKey,overlayHtml:`${a?fn():""}${Bo(e)}`,attributes:{"data-instance-id":e.instanceId,"data-reward-id":e.rewardId||null,"data-reward-candidate-key":e.rewardCandidateKey||null,"data-recruit-source":e.recruitSource||null,role:"button",tabindex:"0",draggable:d}})}function fn(){let e=B("arrow-up",{className:"dungeon-team-upgrade-arrow",size:14,strokeWidth:3.25});return`
    <span class="dungeon-team-upgrade-indicator" role="img" aria-label="Upgrade available" title="Upgrade available">
      ${e}${e}
    </span>
  `}function Bo(e){let t=xa(e);return t?`
    <div class="demon-status-strip" aria-label="Status effects">
      <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${t} stack${t===1?"":"s"}" title="Poisoned">
        <span class="demon-status-icon">${Ao()}</span>
        ${t>1?`<span class="demon-status-count">${w(t)}</span>`:""}
      </span>
    </div>
  `:""}function Lo(){return`
    <div class="new-encounter-badge" title="Missing from collection" aria-label="Missing from collection">
      New
    </div>
  `}function Eo(e){return xa(e)>0}function xa(e){return(e.statusEffects?.poison||[]).length}function Ao(){return B("poison")}function Do(e,t=0){return e.position==="back"||!e.position&&t>0?"back":"front"}function pn(e){if(!e||Number(e.spentPoints)<=0)return null;let t=e.bonuses||{},n=[[t.maxHpFlat,"max HP"],[t.attackFlat,"attack damage"],[t.speedFlat,"Speed"],[t.healingFlat,"healing"],[t.thornsFlat,"thorns damage"],[t.aoeDamageFlat,"AOE damage"],[t.poisonDamageFlat,"poison damage"]].filter(([o])=>Number(o)>0).map(([o,i])=>`+${Ca(o)} ${i}`),a=[[t.maxHpPercent,"max HP"],[t.attackPercent,"attack damage"],[t.speedPercent,"Speed"],[t.healingPercent,"healing"],[t.thornsPercent,"thorns"],[t.aoeDamagePercent,"AOE damage"],[t.poisonDamagePercent,"poison damage"]].filter(([o])=>Number(o)>0).map(([o,i])=>`+${Ca(o)}% ${i}`),r=[...n,...a];return{id:"account-level-power",name:"Level Power",description:r.join(", "),tooltip:["Level Power",...r].join(`
`),rarity:"account",icon:"sparkles",tags:["Permanent","Account"]}}function Ca(e){let t=Number(e)||0;return Number.isInteger(t)?String(t):t.toFixed(1).replace(/\.0$/,"")}var Cd=window.AmongDemons.audio;var Ba=!1;function Mo(e){let t=String(e.rarity||"common").toLowerCase(),n=Fo(e),a=_o(n),r=e.href?"a":"button",o=e.href?`href="${w(e.href)}"`:'type="button"',i=e.attention?"is-level-power-attention":"",c=e.expiresAt?"is-temporary":"";return`
    <${r}
      class="active-pact-chip is-${w(t)} ${i} ${c}"
      ${o}
      data-active-pact-id="${w(e.id)}"
      data-tooltip="${a}"
      aria-label="${a}"
    >
      <span class="active-pact-chip-icon" aria-hidden="true">
        ${B(e.icon||"sparkles",{size:28,strokeWidth:1.9})}
      </span>
    </${r}>
  `}function Aa(e=[],t={}){let n=[],a=new Map,r=t.onlySource?String(t.onlySource):"";return e.forEach(o=>{if(!o?.id)return;if(r&&String(o.source||"")!==r){n.push(o);return}let i=a.get(o.id);if(i){i.stackCount+=1;return}let c={...o,stackCount:1};a.set(o.id,c),n.push(c)}),n}function Da(e,t={}){let n=Math.max(1,Math.trunc(Number(e?.stackCount)||1)),a=t.stackClass||"active-pact-stack",r=t.countClass||"active-pact-stack-count",o=n>1?{...e,tooltip:`${e.name||e.id}: ${To(e,n)}`}:e;return`
    <span class="${w(a)}">
      ${Mo(o)}
      ${n>1?`
        <span class="${w(r)}" aria-label="${n} stacks">${n}</span>
      `:""}
    </span>
  `}function To(e,t){let n=(Array.isArray(e?.effects)?e.effects:[]).filter(i=>String(i?.type||"").endsWith("_mult")).map(i=>Math.abs((Number(i.value)-1)*100)).filter(i=>Number.isFinite(i)&&i>0),a=String(e?.description||""),r=0,o=a.replace(/(\d+(?:\.\d+)?)%/g,(i,c)=>{let d=Number(c),l=n.findIndex(u=>Math.abs(u-d)<.001);if(l<0)return i;n.splice(l,1),r+=1;let g=d*t;return`${La(g)}% (${t} x ${La(d)}%)`});return r>0?o:`${a.replace(/\.$/,"")} (${t} copies).`}function La(e){let t=Math.round((Number(e)||0)*100)/100;return Number.isInteger(t)?String(t):String(t).replace(/0+$/,"").replace(/\.$/,"")}function Fo(e={}){let t=e.tooltip||`${e.name||e.id}: ${e.description||""}`,n=Io(e);return[t,n].filter(Boolean).join(`
`)}function Io(e={}){let t=Date.parse(e.expiresAt||"");if(!Number.isFinite(t))return"";let n=Math.ceil((t-Date.now())/1e3);return n<=0?"Expired":`Expires in ${No(n)}`}function No(e){let t=Math.max(0,Math.floor(Number(e)||0)),n=Math.floor(t/86400),a=Math.floor(t%86400/3600),r=Math.floor(t%3600/60);return n>0?`${n}d ${a}h`:a>0?`${a}h ${r}m`:r>0?`${r}m`:`${t}s`}function _o(e){return w(e).replace(/\n/g,"&#10;")}function Ma(){Ba||(Ba=!0,document.addEventListener("pointerover",e=>{let t=e.target.closest?.(".active-pact-chip");t&&vt(t)}),document.addEventListener("focusin",e=>{let t=e.target.closest?.(".active-pact-chip");t&&vt(t)}),document.addEventListener("click",e=>{let t=e.target.closest?.(".active-pact-chip");document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(n=>{n!==t&&n.classList.remove("is-tooltip-visible")}),t&&(vt(t),t.classList.add("is-tooltip-visible"))}),document.addEventListener("keydown",e=>{e.key==="Escape"&&document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(t=>{t.classList.remove("is-tooltip-visible")})}),window.addEventListener("resize",Ea),window.addEventListener("scroll",Ea,!0))}function Ea(){document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(vt)}function vt(e){if(!e)return;let t=e.getBoundingClientRect(),n=Math.min(384,window.innerWidth*.88),a=Ho(t.left+t.width/2,n/2+8,window.innerWidth-n/2-8),r=t.top>118,o=r?Math.max(8,t.top-8):Math.min(window.innerHeight-8,t.bottom+8);e.style.setProperty("--active-pact-tooltip-left",`${a}px`),e.style.setProperty("--active-pact-tooltip-top",`${o}px`),e.classList.toggle("is-tooltip-below",!r)}function Ho(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}var Oo=window.AmongDemons.audio,zo=window.AmongDemons.bagVisuals?.renderItemVisual||(()=>'<span class="bag-item-renderer bag-unknown-visual" aria-hidden="true"></span>');var Go=(...e)=>h.bindCollectionReinforcementPlaceholders(...e),Vo=(...e)=>h.bindDemonDetailCards(...e),qo=(...e)=>h.bindFormationDragAndDrop(...e),Yo=(...e)=>h.bindPointerDragAndDrop(...e),Wo=(...e)=>h.bindRecruitDragAndDrop(...e),jo=(...e)=>h.bindRewardDragAndDrop(...e),vn=(...e)=>h.canExtractRun(...e),Ta=(...e)=>h.formatBattleSpeed(...e),Uo=(...e)=>h.getRecruitPreviewEnemyTeam(...e),Ko=(...e)=>h.getRecruitPreviewHand(...e),Xo=(...e)=>h.getRecruitPreviewTeam(...e),Fa=(...e)=>h.applyDungeonCombatStatPreviewToDemon(...e),Zo=(...e)=>h.getRecruitTeamLimit(...e),Jo=(...e)=>h.groupCombatLog(...e),ja=(...e)=>h.hasPendingBuffChoices(...e);var Qo=(...e)=>h.isExtractionUnlocked(...e),ei=(...e)=>h.isCurrentFloorBattle(...e),ti=(...e)=>h.pauseCombatPlayback(...e),ni=(...e)=>h.playEnemyRevealEffect(...e),ai=(...e)=>h.playPendingHandFlowAnimation(...e),ri=(...e)=>h.playRecruitSwapEffect(...e),Ua=(...e)=>h.renderButtonMeleeIcon(...e);var Ia=(...e)=>h.renderDemonCards(...e),oi=(...e)=>h.renderDungeonDemonCard(...e),ii=(...e)=>h.bindActivePactTooltips(...e),si=(...e)=>h.getActiveBuffs(...e),ci=(...e)=>h.createLevelPowerBuff(...e),hn=(...e)=>h.renderDemonicPacts(...e),li=(...e)=>h.toggleDemonicPactView(...e);var di=(...e)=>h.renderFightLogRow(...e),ui=(...e)=>h.renderHandBar(...e),mi=(...e)=>h.renderRewardBox(...e),kn=(...e)=>h.replayFight(...e),gi=(...e)=>h.requestRecruitContinue(...e),fi=(...e)=>h.resumeCombatPlayback(...e),pi=(...e)=>h.setBattleSpeed(...e),hi=(...e)=>h.skipCombatPlayback(...e),bi=(...e)=>h.startNewDungeonAfterDefeat(...e),Ka=(...e)=>h.startRun(...e),yi=(...e)=>h.stepCombatPlayback(...e);function wn(){let e=s.run,t=!!e;if(b.runLoading&&b.runLoading.classList.toggle("d-none",!s.isLoading),b.runEmpty.classList.toggle("d-none",s.isLoading||t),b.runPanel.classList.toggle("d-none",s.isLoading||!t),Di(),Li(),s.isLoading){ge&&ge.disconnect(),s.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.fightLog.innerHTML="Opening the latest dungeon state...",b.fightLog.classList.add("text-muted"),hn(!1),Qe(),Be();return}if(!e){ge&&ge.disconnect(),b.runPanel?.querySelector(".dungeon-arena")?.classList.remove("is-hand-strategy"),b.dungeonBottomPanel?.classList.add("d-none"),s.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.dungeonHandBar?.classList.add("d-none"),b.dungeonRewardBox?.classList.add("d-none"),hn(!1),_a(),Ha(),Oa(),b.runEmpty.innerHTML=s.endSummary?vi():ki(),wi(),Na(),Qe(),Be();return}let n=ja(e),a=!!(s.isRecruiting&&e.awaitingRecruit),r=b.runPanel?.querySelector(".dungeon-arena"),o=(a?Xo():e.team||[]).map(Fa),i=a&&s.isEnemyPreviewDeferred?[]:a?Uo():e.enemies||[],c=!!e.replayOnly,d=!!(s.isBattleAnimating||c),l=!!(s.isPactTeamPreview&&n),g=!!(!a&&d),u=(a?Ko():[]).map(Fa),p=g?"battle":"recruit",P=!!(n&&!s.isPactRevealPending&&!s.isBattleAnimating&&!s.isResultAnimating),y=!!(n||s.isPactRevealPending),S=!0,k=!!(a&&!y),x=k,M=!!(!n&&!s.isResultAnimating&&vn()),F=za(b.teamGrid),T=za(b.enemyGrid),I=["player",e.awaitingRecruit?"recruit":"battle",s.isRecruiting?"interactive":"locked",n?"pacts":"ready"].join(":");b.dungeonBottomPanel?.classList.toggle("d-none",!S),(!M||s.isBattleAnimating||s.isResultAnimating)&&(s.isMobileRewardBoxOpen=!1),b.dungeonBottomPanel?.classList.toggle("is-battle-active",d||l),b.dungeonBottomPanel?.classList.toggle("is-mobile-reward-open",!!(s.isMobileRewardBoxOpen&&M&&!s.isBattleAnimating)),r?.classList.toggle("is-hand-strategy",a),te(b.teamGrid,Ia(o,{side:"player",allowFormationDrag:e.status==="active"&&!y&&(!e.awaitingRecruit||s.isRecruiting),gridStyle:F}),{patchFormationGrid:!0,renderKey:I}),te(b.enemyGrid,Ia(a||(e.team||[]).length?i:[],{side:"enemy",allowRecruitDrag:!1,gridStyle:T}),{patchFormationGrid:!0,renderKey:"enemy"}),ui(u,S,k,p),mi(S,x,M),hn(P),_a(a?o.length:null,a?Zo():null),Ha(a?e.nextEnemyPressure:e.enemyPressure,a?e.nextEnemyBuffs:e.enemyBuffs,a?e.nextEnemyTeamBuffs:e.enemyTeamBuffs),Oa(),qo(),Wo(),jo(),Yo(),Go(),Vo(),ii(),ri(),ni(),Ei(),Na(),Qe(),Be(),ai(a)}function vi(){let e=s.endSummary||{},t=e.demon,n=e.echo,a=e.outcome==="defeat";return`
    <div class="dungeon-end-screen ${a?"is-defeat":"is-extraction"}">
      <div class="dungeon-end-copy">
        <span class="dungeon-phase-eyebrow">${a?"Defeat":"Extraction"}</span>
        <h2>${w(e.title||"Run complete")}</h2>
        <p>${w(e.message||"Run extracted.")}</p>
      </div>
      ${t?`
        <div class="dungeon-end-demon" aria-label="Collected demon">
          ${oi(t,{className:"dungeon-end-demon-card",suppressCollectionMissingTag:!0,attributes:{"data-instance-id":t.instanceId||`end-${t.id||"demon"}`}})}
        </div>
      `:""}
      ${n?`
        <div
          class="dungeon-end-demon dungeon-end-echo"
          style="--item-rarity: ${w(Nt(n.rarity||"common"))}"
          aria-label="Extracted ${w(`${dt(n.rarity||"common")} ${n.species||"Demon"} Echo`)}"
        >
          <span class="dungeon-end-echo-visual">
            ${zo(n,{context:"slot"})}
          </span>
        </div>
      `:""}
      <div class="dungeon-end-rewards" aria-label="Rewards obtained">
        ${t?`<span>${B("stars")}${w(t.species||"Demon")}</span>`:""}
        ${n?`<span>${B("sparkles")}${w(`${dt(n.rarity||"common")} ${n.species||"Demon"} Echo`)}</span>`:""}
        <span>${Number(e.xp)||0} XP</span>
        ${It(Number(e.souls)||0,{className:"soul-chip dungeon-end-soul-amount"})}
      </div>
      <div class="dungeon-end-actions">
        ${a?"":'<a class="btn btn-glass-muted" href="/camp">Leave</a>'}
        ${s.endedReplayRun?.lastBattle?.combatLog?.length?`
          <button class="btn btn-glass-muted btn-icon-only" id="replayEndedDungeonBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
            ${B("list-restart")}
          </button>
        `:""}
        ${a?`
          <a class="btn btn-glass-muted" id="trainDemonsBtn" href="/collection">
            ${B("swords")}
            Train Demons
          </a>
        `:`
          <a class="btn btn-glass-muted" href="/bag">
            ${B("amphora")}
            View Bag
          </a>
        `}
        <a class="btn btn-primary" href="/dungeon">
          ${B("play")}
          New Dungeon
        </a>
      </div>
    </div>
  `}function ki(){return`
    <img src="/app/images/demons/1.png" alt="Boof Nitza demon preparing for a dungeon run" width="1024" height="1024" loading="lazy" decoding="async">
    <p class="mb-0 text-muted">Ready to descend into the dungeon?</p>
    <button class="btn btn-primary dungeon-start-prompt-btn" id="startNewDungeonBtn" type="button">
      ${B("play")}
      Start Dungeon
    </button>
  `}function wi(){N(document.getElementById("startNewDungeonBtn"),async()=>{qn(),await Ka(),wn()}),N(document.getElementById("replayEndedDungeonBtn"),kn)}function Na(){let t=(s.combatLog.length?Jo(s.combatLog).map((n,a)=>`
      ${di(n,a)}
    `).join(""):"")+Mi();if(!t.trim()){b.fightLog.innerHTML="Fight log will appear here after a battle.",b.fightLog.classList.add("text-muted");return}b.fightLog.classList.remove("text-muted"),b.fightLog.innerHTML=t}function Xa(e,t={}){let n=document.querySelector(".battle-result-burst");n&&n.remove();let a=e==="defeat",r=t.syncActions!==!1,i=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?900:a?3e3:2200;s.isResultAnimating=!0,Oo?.play(e==="victory"?"sfx.battle.victory":"sfx.battle.defeat",{volume:.96}),r&&(Qe(),Be());let c=document.createElement("div");return c.className=`battle-result-burst is-${e}`,c.style.setProperty("--battle-result-duration",`${i}ms`),c.setAttribute("role","status"),c.setAttribute("aria-live","polite"),c.innerHTML=`
    <div class="battle-result-burst-ring" aria-hidden="true"></div>
    ${a?'<div class="battle-result-burst-wound" aria-hidden="true"></div>':""}
    <div class="battle-result-burst-text">${e==="victory"?"Victory":"Defeat"}</div>
    ${a?'<div class="battle-result-burst-subtitle">Your demons have fallen</div>':""}
    <div class="battle-result-burst-sparks" aria-hidden="true">
      ${Array.from({length:a?16:14},()=>"<span></span>").join("")}
    </div>
  `,document.body.appendChild(c),new Promise(d=>{setTimeout(()=>{c.remove(),s.isResultAnimating=!1,r&&(Qe(),Be()),d()},i)})}function _a(e=null,t=null){if(!b.teamSideTitle)return;let n=Number.isFinite(e)&&Number.isFinite(t)?`<span class="battle-side-count" aria-label="${e} of ${t} team slots used">${e}/${t}</span>`:"",a=$i();b.teamSideTitle.innerHTML=`
    <span>Your Team</span>
    ${n?` ${n}`:""}
    ${et(a,{side:"player"})}
  `}function Ha(e=null,t=[],n=[]){if(!b.enemySideTitle)return;let a=s.run?.enemyLabel||"Enemies";b.enemySideTitle.innerHTML=`
    <span>${w(a)}</span>
    ${Pi(e)}
    ${xi(t)}
    ${et(n,{side:"enemy"})}
  `}function $i(e=s.run){if(!e)return[];let t=s.statPoints?ci(s.statPoints):null;return[...t?[t]:[],...si(e)].filter(n=>n?.id||n?.name)}function et(e=[],t={}){let n=Si(e);if(!n.length)return"";let a=n.reduce((c,d)=>c+d.stackCount,0),r=t.side==="enemy"?"enemy":"player",o=t.label||"Buffs",i=`battle-${r}-buff-summary-tooltip`;return`
    <span
      class="enemy-pressure-chip battle-buff-summary-chip is-${r}-buffs"
      tabindex="0"
      aria-label="${w(`${o}, ${a} active`)}"
      aria-describedby="${i}"
    >
      ${B("sparkles")}
      <span>${w(o)}</span>
      <strong>${a}</strong>
      <span class="battle-buff-summary-tooltip" id="${i}" role="tooltip">
        ${n.map(Ri).join("")}
      </span>
    </span>
  `}function Si(e=[]){let t=[],n=new Map;return(Array.isArray(e)?e:[]).forEach((a,r)=>{if(!a)return;let o=typeof a=="string"?{id:a,name:a,description:""}:a,i=String(o.id||o.name||`buff-${r+1}`),c=Math.max(1,Math.trunc(Number(o.stackCount)||1)),d=n.get(i);if(d){d.stackCount+=c;return}let l={...o,id:i,stackCount:c};n.set(i,l),t.push(l)}),t}function Ri(e={}){let t=String(e.name||e.id||"Buff"),n=e.stackCount>1?` \xD7${e.stackCount}`:"",a=String(e.description||e.tooltip||"").trim(),r=a.startsWith(`${t}
`)?a.slice(t.length+1).trim():a;return`
    <span class="battle-buff-summary-row">
      <strong class="battle-buff-summary-name">${w(t)}${n}</strong>
      ${r?`<span class="battle-buff-summary-description">${w(r).replace(/\n/g,"<br>")}</span>`:""}
    </span>
  `}function Pi(e=null){if(!e?.active)return"";let t=Me(e.hpBonusPct),n=Me(e.atkBonusPct),a=Me(e.speedBonusPct),r=Math.max(0,Math.round(Number(e.level)||0));if(r<=0)return"";let o="battle-enemy-terror-tooltip";return`
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
  `}function xi(e=[]){let t=(Array.isArray(e)?e:[]).filter(Boolean);return t.length?t.map(Ci).join(""):""}function Ci(e={}){let t=String(e.name||e.id||"Boss Buff"),n=String(e.description||""),a=e.id==="rarity-convergence",r=a?[t,n,`Host HP ${Me(e.hpBonusPct)}`,`Host Attack ${Me(e.atkBonusPct)}`,`Host Speed ${Me(e.speedBonusPct)}`].join(`
`):[t,n].filter(Boolean).join(`
`),o=Bi(r),i=a?` style="--enemy-buff-color: ${w(Nt(e.rarity||"common"))}"`:"";return`
    <span
      class="enemy-pressure-chip enemy-buff-chip${a?" is-rarity-convergence":""}"
      ${i}
      tabindex="0"
      data-tooltip="${o}"
      aria-label="${o}"
    >
      ${B(e.icon||"sparkles")}
      <span>${w(t)}</span>
    </span>
  `}function Me(e){return`+${Math.max(0,Math.round(Number(e)||0))}%`}function Bi(e){return w(e).replace(/\n/g,"&#10;")}function Oa(){if(!b.dungeonJoiner)return;let e=s.run?Math.max(1,Number(s.run.currentFloor)||1):null;b.dungeonJoiner.classList.remove("is-recruiting"),b.dungeonJoiner.innerHTML=`
    <div class="dungeon-center-actions" id="dungeonCenterActions"></div>
    ${e?`<span class="dungeon-floor-marker" aria-label="Current floor ${e}"><span>Floor</span><strong>${e}</strong></span>`:""}
  `,b.dungeonCenterActions=document.getElementById("dungeonCenterActions")}function Li(){he("combat")}function kt(){let e=document.getElementById("battleLogPanel")?.classList.contains("show");he(e?"combat":"log")}function he(e){let t=e==="log";document.getElementById("combatPanel")?.classList.toggle("show",!t),document.getElementById("combatPanel")?.classList.toggle("active",!t),document.getElementById("battleLogPanel")?.classList.toggle("show",t),document.getElementById("battleLogPanel")?.classList.toggle("active",t)}function Ei(){ge&&ge.disconnect();let e=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards")),t=Array.from(document.querySelectorAll(".battle-side > #teamGrid, .battle-side > #enemyGrid"));if(!e.length&&!t.length)return;let n=new ResizeObserver(()=>bn());Gn(n),e.forEach(a=>n.observe(a)),t.forEach(a=>n.observe(a)),document.querySelectorAll(".battle-side .dungeon-demon-card-image img").forEach(a=>{a.complete||a.addEventListener("load",bn,{once:!0})}),yn(),bn()}function bn(){yn(),requestAnimationFrame(()=>{yn();let e=[],t=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards"));if(t.forEach(a=>{let r=Array.from(a.querySelectorAll(".dungeon-demon-card"));if(a.classList.remove("is-compressed"),a.style.removeProperty("--dungeon-demon-card-width"),a.style.removeProperty("--dungeon-demon-card-height"),!r.length)return;let o=a.getBoundingClientRect();if(!(r[r.length-1].getBoundingClientRect().bottom>o.bottom+1||a.scrollHeight>a.clientHeight+1))return;let d=parseFloat(getComputedStyle(a).rowGap||getComputedStyle(a).gap)||0,l=getComputedStyle(a).flexDirection.startsWith("row"),g=l?o.height:(o.height-d*(r.length-1))/r.length,u=l?(o.width-d*(r.length-1))/r.length:g,p=Math.max(46,Math.min(148,g,u));e.push(p)}),!e.length)return;let n=Math.min(...e);t.forEach(a=>{a.style.setProperty("--dungeon-demon-card-width",`${n}px`),a.style.setProperty("--dungeon-demon-card-height",`${n}px`),a.classList.add("is-compressed")})})}function yn(){Array.from(document.querySelectorAll(".battle-side .battle-formation-grid")).forEach(t=>{let n=t.parentElement;if(!n)return;let a=n.getBoundingClientRect();if(a.width<=0||a.height<=0)return;let r=getComputedStyle(t),o=3,i=3,c=1,d=Je(r.gap||r.rowGap||r.columnGap),l=Je(r.paddingLeft)+Je(r.paddingRight),g=Je(r.paddingTop)+Je(r.paddingBottom),u=(a.width-l-d*(o-1))/o,p=(a.height-g-d*(i-1))/(i*c),P=Math.max(42,Math.min(260,u,p));Number.isFinite(P)&&Ai(t,P,P*c)})}function za(e){let t=e?.querySelector?.(".battle-formation-grid"),n=t?.style.getPropertyValue("--dungeon-demon-card-width"),a=t?.style.getPropertyValue("--dungeon-demon-card-height");return!n||!a?"":`--dungeon-demon-card-width: ${n}; --dungeon-demon-card-height: ${a};`}function Ai(e,t,n){let a=`${t}px`,r=`${n}px`;e.style.getPropertyValue("--dungeon-demon-card-width")!==a&&e.style.setProperty("--dungeon-demon-card-width",a),e.style.getPropertyValue("--dungeon-demon-card-height")!==r&&e.style.setProperty("--dungeon-demon-card-height",r)}function Je(e){let t=parseFloat(e);return Number.isFinite(t)?t:0}function Di(){b.dungeonRewardStrip&&(b.dungeonRewardStrip.innerHTML="")}function Mi(){return s.endNotice?`<div class="${s.endNotice.type==="warning"?"fight-log-notice fight-log-end-notice text-warning":"fight-log-notice fight-log-end-notice text-success"}">${s.endNotice.html||w(s.endNotice.text)}</div>`:""}function Ga(e){return b.dungeonBottomControls?te(b.dungeonBottomControls,e):!1}function $n(e,t){return`
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight" ${e?"":"disabled"}>
      ${B("list-restart")}
    </button>
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogToggleBtn" type="button" title="Fight Log" aria-label="Fight Log" ${t?"":"disabled"}>
      ${B("log")}
    </button>
  `}function Va(e,t){return b.dungeonReplayLogBox?te(b.dungeonReplayLogBox,$n(e,t)):!1}function Qe(){if(s.isLoading){qa(),Ya({canReplay:!1,canViewLog:!1,canExtract:!1}),Ga(""),Va(!1,!1);return}let e=s.run?.status==="defeated",t=!s.endSummary&&(!s.run||e||s.run.status==="ended"),n=!!(s.run&&!s.isResultAnimating&&s.isBattleAnimating&&s.combatPlayback),a=ja(s.run),r=!!(s.isPactTeamPreview&&a),o=!!(ei(s.run)&&(s.run?.lastBattle?.combatLog?.length||s.combatLog.length)),i=!!(!s.isBattleAnimating&&!s.isResultAnimating&&!a&&o),c=i,d=!!(!a&&!s.isResultAnimating&&s.run?.awaitingRecruit&&s.isRecruiting),l=!!(!s.isBattleAnimating&&!s.isResultAnimating&&!a&&vn()),g=!!s.isRecruitContinuePending,u=!!s.isBattleAnimating,p={canFight:d||g||u,isPending:g,isFighting:u,canStart:t&&!!s.run,isDefeated:e,canReplay:i,canViewLog:c,canExtract:l};qa(p);let P=Ya(p),y=r?Pn():n?`${Sn()}${Rn()}${xn()}`:"",S=Ga(y),k=Va(i,c);!S&&!k&&!P||(lt("[data-battle-speed]",x=>pi(Number(x.dataset.battleSpeed))),N(document.getElementById("battlePlaybackToggleBtn"),()=>{s.combatPlayback?.isPaused?fi():ti()}),lt("[data-battle-step]",x=>yi(Number(x.dataset.battleStep))),N(document.getElementById("battlePlaybackSkipBtn"),hi),N(document.getElementById("demonicPactReturnBtn"),li),N(document.getElementById("fightLogReplayBtn"),kn),N(document.getElementById("fightLogToggleBtn"),kt))}function qa(e={}){let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canStart:r=!1,isDefeated:o=!1}=e;if(r){te(b.dungeonCenterActions,`
      <div class="dungeon-center-action-stack">
        <button class="btn btn-primary dungeon-fight-btn dungeon-center-start-btn" id="dungeonCenterStartBtn" type="button" title="${o?"Start a new dungeon":"Start the dungeon"}">
          ${B("play")}
          <span>${o?"New Dungeon":"Start Dungeon"}</span>
        </button>
      </div>
    `)&&N(document.getElementById("dungeonCenterStartBtn"),o?bi:Ka);return}let i=a?"fighting":n?"preparing":"ready",c=i!=="ready",d=i==="fighting"?"Fighting":i==="preparing"?"Preparing":"Fight",l=i==="fighting"?"Fight in progress":i==="preparing"?"Preparing the next fight":"Start the next fight";te(b.dungeonCenterActions,t?`
    <div class="dungeon-center-action-stack">
      <span class="dungeon-fight-mark" aria-hidden="true">${Ua()}</span>
      <button
        class="btn btn-primary dungeon-fight-btn ${i==="preparing"?"is-loading":""} ${i==="fighting"?"is-fighting":""}"
        id="dungeonFightBtn"
        type="button"
        title="${l}"
        aria-label="${l}"
        ${c?'disabled aria-busy="true"':""}
      >
        ${i==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':""}
        <span>${d}</span>
      </button>
    </div>
  `:"")&&Za()}function Ya(e={}){if(!b.dungeonMobileFightBox)return!1;if(s.isLoading)return te(b.dungeonMobileFightBox,"");let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canReplay:r=!1,canViewLog:o=!1,canExtract:i=!1}=e,c=a?"fighting":n?"preparing":"ready",d=c!=="ready",l=c==="fighting"?"Fighting":c==="preparing"?"Preparing":"Fight",g=c==="fighting"?"Fight in progress":c==="preparing"?"Preparing the next fight":"Start the next fight",u=!!s.run,p=s.activeHandTab==="pacts"?"pacts":"hand",P=!!(s.isMobileRewardBoxOpen&&i),y=!u||a,S=Qo(s.run)?"Extract":"Win your first fight to unlock extraction",k=te(b.dungeonMobileFightBox,`
    <button
      class="dungeon-mobile-nav-btn ${p==="hand"?"active":""}"
      id="dungeonMobileHandBtn"
      type="button"
      title="Hand"
      aria-label="Hand"
      aria-pressed="${p==="hand"?"true":"false"}"
      ${y?"disabled":""}
    >
      ${B("collection")}
      <span class="visually-hidden">Hand</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${p==="pacts"?"active":""}"
      id="dungeonMobileBuffsBtn"
      type="button"
      title="Buffs"
      aria-label="Buffs"
      aria-pressed="${p==="pacts"?"true":"false"}"
      ${y?"disabled":""}
    >
      ${B("stars")}
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
      ${B("list-restart")}
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
      ${B("log")}
      <span class="visually-hidden">Fight Log</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${P?"active":""}"
      id="dungeonMobileExtractBtn"
      type="button"
      title="${S}"
      aria-label="${S}"
      aria-pressed="${P?"true":"false"}"
      ${i?"":"disabled"}
    >
      ${B("flag")}
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
      ${c==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':Ua()}
      <span class="visually-hidden">${l}</span>
    </button>
  `);return k&&(Ti(),Za()),k}function Ti(){N(document.getElementById("dungeonMobileHandBtn"),()=>Wa("hand")),N(document.getElementById("dungeonMobileBuffsBtn"),()=>Wa("pacts")),N(document.getElementById("dungeonMobileReplayBtn"),kn),N(document.getElementById("dungeonMobileLogBtn"),kt),N(document.getElementById("dungeonMobileExtractBtn"),Fi)}function Wa(e){!s.run||s.isBattleAnimating||(s.activeHandTab=e==="pacts"?"pacts":"hand",wn())}function Fi(){s.isBattleAnimating||s.isResultAnimating||!vn()||(s.isMobileRewardBoxOpen=!s.isMobileRewardBoxOpen,wn())}function Sn(){let e=s.combatPlayback||{},t=!!e.isPaused,n=Number(e.currentIndex)||0,a=Number(e.totalSteps)||0,r=n>0,o=n<a;return`
    <div class="battle-playback-control" role="group" aria-label="Battle playback">
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="-1"
        title="Last attack"
        aria-label="Last attack"
        ${r?"":"disabled"}
      >
        ${B("last-attack")}
      </button>
      <button
        class="battle-playback-btn ad-primary-action"
        id="battlePlaybackToggleBtn"
        type="button"
        title="${t?"Play":"Pause"}"
        aria-label="${t?"Play":"Pause"}"
      >
        ${B(t?"play":"pause")}
      </button>
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="1"
        title="Next attack"
        aria-label="Next attack"
        ${o?"":"disabled"}
      >
        ${B("next-attack")}
      </button>
    </div>
  `}function Rn(){return`
    <div class="battle-speed-control" role="group" aria-label="Battle animation speed">
      ${xe.map(e=>`
        <button
          class="battle-speed-option ${s.battleSpeed===e?"active ad-primary-action":""}"
          type="button"
          data-battle-speed="${e}"
          aria-pressed="${s.battleSpeed===e?"true":"false"}"
          title="${Ta(e)} battle speed"
        >
          ${Ta(e)}
        </button>
      `).join("")}
    </div>
  `}function Pn(){return`
    <div class="battle-speed-control demonic-pact-return-control" role="group" aria-label="Demonic Pact controls">
      <button
        class="battle-speed-option active ad-primary-action demonic-pact-return-option"
        id="demonicPactReturnBtn"
        type="button"
        title="Show Demonic Pacts"
        aria-label="Show Demonic Pacts"
      >
        ${B("sparkles")}
        <span>Show Pacts</span>
      </button>
    </div>
  `}function xn(){return`
    <div class="battle-playback-control battle-skip-control">
      <button
        class="battle-playback-btn battle-skip-btn"
        id="battlePlaybackSkipBtn"
        type="button"
        title="Skip to result"
        aria-label="Skip to result"
      >
        ${B("x")}
      </button>
    </div>
  `}function Za(){[document.getElementById("dungeonFightBtn"),document.getElementById("dungeonMobileFightBtn")].forEach(e=>{!e||e.dataset.dungeonFightBound==="true"||(e.dataset.dungeonFightBound="true",N(e,t=>gi(t.currentTarget)))})}var Dt=window.AmongDemons.api,de=window.AmongDemons.audio,Ii=window.AmongDemons.ui.renderDemonCard,Ni=window.AmongDemons.ui.renderCombatStats,L=window.AmongDemons.ui.renderIcon||(()=>""),nt=Object.freeze(["common","uncommon","rare","epic","legendary","mythic"]),Te=2,_e=20,Ja=Object.freeze({common:1,uncommon:2,rare:3,epic:4,legendary:5,mythic:7}),m={},Qa=new Set,G=!1,v=null,f=null,ce=!1,$=null,Rt=!1,An=0,K=0,Fe=null,wt=null,er=0,Dn=new Set,Mt=[],tr=null,at=0,$t=0,ot=null;Hn({...dn,battle:dr,getExplicitFormationRow:e=>le(e?.formationSlot),normalizeFormationRow:e=>le(e)??0,shouldShowCollectionMissingTag:()=>!1,getDemonPosition:Ms,renderDemonStatus:Ts,renderDungeonCenterActions:Br,renderFightLog:br,renderFightLogActions:yr,renderRun:_});Ns(_i);async function _i(){if(!window.AmongDemons.getToken()){window.location.href=window.AmongDemons.appUrl("/login?next=/ranked");return}Hi(),Oi(),Ma(),ht(),de?.setScene({music:"music.default"}),await zi()}function Hi(){["rankedMessage","runLoading","runEmpty","runPanel","rankedBottomPanel","rankedHandStatus","rankedPreparation","dungeonHandBar","dungeonBottomControls","dungeonReplayLogBox","teamSideTitle","enemySideTitle","teamGrid","enemyGrid","dungeonCenterActions","fightLog","demonicPactOverlay","demonicPactViewToggle","rankedPactGrid","rankedEndRunModal","rankedEndRunEyebrow","rankedEndRunSummary","rankedEndRunFloor","rankedEndRunGain","rankedEndRunRating","rankedVictoryModal","rankedVictoryRankImage","rankedVictoryDivision","rankedVictoryRankGain","rankedVictorySummary"].forEach(e=>{m[e]=document.getElementById(e)})}function Oi(){document.addEventListener("click",async e=>{if(e.target.closest("[data-ranked-end-confirm]")){e.preventDefault(),await Yi();return}let n=e.target.closest("[data-ranked-pact-scroll]");if(n){e.preventDefault(),ns(n);return}let a=e.target.closest("[data-ranked-victory-action]");if(a){e.preventDefault(),await ps(a.dataset.rankedVictoryAction);return}let r=e.target.closest("[data-battle-speed]");if(r){e.preventDefault(),on(Number(r.dataset.battleSpeed));return}let o=e.target.closest("[data-battle-step]");if(o){e.preventDefault(),Jt(Number(o.dataset.battleStep));return}if(e.target.closest("#battlePlaybackToggleBtn")){e.preventDefault(),s.combatPlayback?.isPaused?Zt():Xt();return}if(e.target.closest("#battlePlaybackSkipBtn")){e.preventDefault(),Qt();return}if(e.target.closest("#fightLogReplayBtn, #rankedMobileReplayBtn")){e.preventDefault(),e.target.closest(".ranked-mobile-review-menu")?.removeAttribute("open"),await Ki();return}if(e.target.closest("#fightLogToggleBtn, #rankedMobileLogBtn")){e.preventDefault(),e.target.closest(".ranked-mobile-review-menu")?.removeAttribute("open"),kt();return}if(e.target.closest("#demonicPactViewToggle, #demonicPactReturnBtn")){e.preventDefault(),ss();return}let i=e.target.closest("[data-ranked-action]");if(i?.matches("button")){e.preventDefault(),await nr(i,e);return}i&&(e.preventDefault(),await nr(i,e))}),document.addEventListener("dragstart",e=>{let t=e.target.closest("[data-ranked-workspace-id]");if(!t||!e.dataTransfer||!f)return;let n=t.dataset.rankedWorkspaceId;Rt=!0,Fn(n),e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/plain",n),t.classList.add("is-dragging")}),m.rankedEndRunModal?.addEventListener("hidden.bs.modal",()=>{Bt(!1)}),document.addEventListener("dragend",e=>{e.target.closest("[data-ranked-workspace-id]")?.classList.remove("is-dragging"),An=Date.now()+350,Rt=!1,At(),j()}),document.addEventListener("dragover",e=>{let t=Ct(e.target);t&&(e.preventDefault(),j(),t.classList.add("is-drag-over"))}),document.addEventListener("dragleave",e=>{let t=Ct(e.target);t&&!t.contains(e.relatedTarget)&&t.classList.remove("is-drag-over")}),document.addEventListener("drop",e=>{let t=Ct(e.target);if(!t)return;e.preventDefault();let n=e.dataTransfer?.getData("text/plain");n&&(Rt=!1,At(),Rr(n,t,{x:e.clientX,y:e.clientY}))}),document.addEventListener("pointerdown",Bs),document.addEventListener("pointermove",Ls),document.addEventListener("pointerup",As),document.addEventListener("pointercancel",Ds),document.addEventListener("keydown",e=>{let t=e.target.closest(".dungeon-demon-card[data-instance-id]");!t||!["Enter"," "].includes(e.key)||(e.preventDefault(),vr(t))}),document.addEventListener("scroll",e=>{let t=e.target?.closest?.("[data-ranked-pact-scroll-viewport]");t&&hr(t.closest(".ranked-reserve-buffs-shell"))},{capture:!0,passive:!0}),window.addEventListener("resize",pr)}async function zi(){Bn(!0);try{let[e]=await Promise.all([Dt("/api/ranked/bootstrap"),Gi().catch(t=>(console.warn("Ranked upgrade previews will use current-card art.",t),null))]);e.player&&Nn(e.player),ot=e.rating||null,e.run?(Oe(e.run),e.run.status==="active"&&e.run.phase==="result"&&!e.run.awaitingVictoryChoice&&await lr()):(s.run=null,v=null),Bn(!1),_(),v?.awaitingVictoryChoice&&kr(v)}catch(e){Bn(!1),Tt(e)}}async function Gi(){return Fe||(wt||(wt=Dt("/api/game/catalog?v=20260722-request-optimization-v1").then(e=>(Fe={types:e?.types||{},demons:Array.isArray(e?.demons)?e.demons:[]},Fe)).catch(e=>{throw wt=null,e})),wt)}async function Vi(){let e=await mr("/api/ranked/start",{});e?.run&&Oe(e.run)}async function nr(e,t=null){if(G)return;let n=e.dataset.rankedAction;if(n==="start")return Vi();if(v){if(n==="reroll")return ji(Ge(t,e));if(n==="lock-hand")return Ui();if(n==="fight")return dr();if(n==="continue")return lr();if(n==="end")return qi();if(n==="pact")return Wi(e.dataset.buffId)}}function qi(){if(!v||!m.rankedEndRunModal||!window.bootstrap?.Modal)return;let e=Math.max(1,Number(v.floor)||1),t=Number(v.rating?.projectedRunDelta??v.rating?.runDelta)||0,n=Math.max(0,Number(v.rating?.projectedEnd??v.rating?.rating)||0);m.rankedEndRunEyebrow&&(m.rankedEndRunEyebrow.textContent=`Concede \xB7 Floor ${R(e)}`),m.rankedEndRunSummary&&(m.rankedEndRunSummary.textContent=`Ending now calculates your final rank from reaching Floor ${R(e)} and retires this temporary roster.`),m.rankedEndRunFloor&&(m.rankedEndRunFloor.textContent=R(e)),m.rankedEndRunGain&&(m.rankedEndRunGain.textContent=Er(t),m.rankedEndRunGain.classList.toggle("is-negative",t<0)),m.rankedEndRunRating&&(m.rankedEndRunRating.textContent=R(n)),Bt(!1),window.bootstrap.Modal.getOrCreateInstance(m.rankedEndRunModal).show()}async function Yi(){if(G||!v||v.status!=="active")return;if(Bt(!0),(await He("end",{}))?.run?.status==="ended"){window.bootstrap?.Modal.getOrCreateInstance(m.rankedEndRunModal)?.hide();return}Bt(!1)}function Bt(e){let t=m.rankedEndRunModal;if(!t)return;t.querySelectorAll("button").forEach(a=>{a.disabled=!!e});let n=t.querySelector("[data-ranked-end-confirm]");n?.classList.toggle("is-busy",!!e),n?.setAttribute("aria-busy",e?"true":"false")}async function He(e,t){let n=await mr(`/api/ranked/runs/${encodeURIComponent(v.runId)}/${e}`,t);return n?.player&&Nn(n.player,{animate:!0}),n?.run&&(Oe(n.run),n.rewards?.souls&&Re(`Floor ${_e} cleared. ${n.rewards.souls} Souls awarded.`,"success")),n}async function lr(){let e=await He("continue",{});e?.run?.phase==="selection"&&e.run.floor>_e&&Re("Endless floor unlocked.","success")}async function Wi(e){let t=await He("pact",{buffId:e});return t?.run&&(de?.play("sfx.dungeon.pactChoose",{volume:.9}),Lr()),t}async function ji(e){if(!Sr()||G)return;let t=await He("reroll",{lineup:wr(),lockHand:!!v.handLocked});if(!t?.run)return;let n=Math.max(0,Number(t.rerollCost)||Te);st(e,-n),de?.play("sfx.dungeon.pactReroll",{volume:.86})}async function dr(){if(!$r()||G||s.isBattleAnimating)return;at=0;let e=Rs();ze(!0),ce=!0;try{let t=await Dt(`/api/ranked/runs/${encodeURIComponent(v.runId)}/battle`,gr({lineup:wr(),lockHand:!!v.handLocked}));if(!t?.run?.lastBattle)return;let n=t.rSoulInterest;Oe(t.run,{render:!1}),Number(n?.earned)>0&&(K=Math.max(0,Number(n.balanceBefore)||0));let a=t.run.lastBattle;ur(a),he("combat"),_(),await mt(),await fs(a.winner),Oe(t.run,{render:!1});let r=[];e.count&&r.push(`Auto-sold ${e.count} purchased Hand demon${e.count===1?"":"s"} for ${R(e.amount)} rSouls.`),t.rewards?.souls&&(r.push(`Victory milestone: ${t.rewards.souls} Souls awarded.`),t.player&&Nn(t.player,{animate:!0})),Number(n?.earned)>0&&(at=Math.max(0,Number(n.earned)||0)),Re(r.length?r.join(" "):"","success"),t.run.awaitingVictoryChoice&&kr(t.run,{rankGain:t.rankGain})}catch(t){Tt(t)}finally{ce=!1,ze(!1),_(),Lr()}}function Ui(){if(!v||!Mn(v))return;let e=!v.handLocked;v.handLocked=e,s.run.handLocked=e,_()}async function Ki(){let e=v?.lastBattle;if(!(G||s.isBattleAnimating||!e?.combatLog?.length)){ce=!0,ze(!0);try{ur(e),he("combat"),_(),m.fightLog.innerHTML="",m.fightLog.classList.remove("text-muted"),await mt(),Oe(v,{render:!1})}catch(t){Tt(t)}finally{ce=!1,ze(!1),_()}}}function ur(e){s.run.floor=Math.max(1,Number(e.floor)||Number(s.run.floor)||1),s.run.team=U(e.playerTeamBefore||s.run.team||[]),s.run.active=s.run.team,s.run.enemies=U(e.enemyTeamBefore||s.run.enemies||[]),s.combatLog=e.combatLog||[],s.combatDemons=Ze()}async function mr(e,t){ze(!0);try{return await Dt(e,gr(t))}catch(n){return Tt(n),null}finally{ze(!1)}}function gr(e){let t=Is();return{method:"POST",headers:{"Idempotency-Key":t},body:{...e,actionId:t}}}function Oe(e,t={}){At(),v=e,ot=e.rating||ot,K=Math.max(0,Math.floor(Number(e.rSouls)||0));let n=e.lastBattle;f=Mn(e)?bs(e):null,s.run={...e,team:U(f?.active||e.active||e.team),active:U(f?.active||e.active||e.team),reserve:U(f?.reserve||e.reserve),enemies:e.phase==="result"&&n?U(n.enemyTeamAfter):U(e.enemies)},s.combatLog=n?.combatLog||[],s.combatDemons=Ze(),t.render!==!1&&_(),ds(e.combinationEvents||[])}function _(){ys();let e=s.run,t=!!e;if(m.runEmpty.classList.toggle("d-none",t||s.isLoading),m.runPanel.classList.toggle("d-none",!t||s.isLoading),m.rankedBottomPanel.classList.toggle("d-none",!t||s.isLoading),!t){he("combat"),m.runEmpty.innerHTML=ls();return}if((e.status==="ended"||e.phase==="ended")&&!ce){he("combat"),m.runPanel.classList.add("d-none"),m.rankedBottomPanel.classList.add("d-none"),m.runEmpty.classList.remove("d-none"),m.runEmpty.innerHTML=cs(e),rr([]);return}let n=ce||s.isBattleAnimating,a=n,r=!!(s.isPactTeamPreview&&e.pendingPact&&!a),o=a||r,i=!!(!o&&(e.lastBattle?.combatLog?.length||s.combatLog?.length));m.enemyGrid.closest(".battle-side")?.classList.toggle("is-ranked-reserve",!a),m.rankedBottomPanel.classList.toggle("is-ranked-combat",o),m.rankedBottomPanel.classList.remove("has-fight-review"),m.rankedBottomPanel.classList.toggle("is-battle-active",n),m.dungeonHandBar.classList.toggle("d-none",!o),m.dungeonHandBar.classList.toggle("is-battle-controls-mode",o),m.dungeonReplayLogBox.classList.add("d-none"),a||he("combat"),Xi(e),Ji(e,a),Br(),m.teamGrid.innerHTML=mn(e.team||e.active||[],{side:"player",allowFormationDrag:!a&&!e.pendingPact}),m.enemyGrid.innerHTML=a?mn(e.enemies||[],{side:"enemy"}):ts(e.reserve||[],e),m.rankedPreparation.classList.toggle("d-none",a||r||e.phase==="preparation"&&s.isBattleAnimating);let c=!m.rankedPreparation.classList.contains("d-none"),d=Math.max(0,Math.min(3,Number(e.lives)||0)),l=Array.from({length:3},(g,u)=>`
      <span class="ranked-life-heart ${u<d?"is-active":"is-empty"}">\u2665</span>
    `).join("");m.rankedHandStatus.classList.toggle("d-none",!c),m.rankedHandStatus.setAttribute("aria-label",`${d} of 3 lives, ${R(K)} Ranked Souls`),m.rankedHandStatus.innerHTML=c?`
      <span class="ranked-lives" aria-hidden="true">${l}</span>
      <span class="ranked-hand-status-separator" aria-hidden="true">&middot;</span>
      ${Zi(e)}
    `:"",m.rankedPreparation.innerHTML=a||r?"":rs(e,{canReviewFight:i}),yr(),br(),rr(e.pacts?.pendingChoices||[]),us(),vs(),ks(),pr()}function Xi(e){let t=e.rating?.division||"Bronze II",n=it(t),a=Array.isArray(e.team)?e.team:e.active||[],r=Math.max(1,Number(e.capacities?.active)||6),o=Math.min(r,a.length),i=`${o}/${r}`,c=`
    <span class="battle-side-count" aria-label="${C(`${o} of ${r} team slots used`)}">
      ${C(i)}
    </span>
  `;m.teamSideTitle.innerHTML=`
    <span class="ranked-desktop-status">
      ${c}
      ${Lt(n,{showLabel:!0})}
    </span>
    <span class="ranked-mobile-status">
      ${c}
      ${Lt(n,{showLabel:!0,compact:!0})}
    </span>
    ${et(fr(e),{side:"player"})}
  `}function Zi(e){let t=Math.max(1,Number(e?.floor)||1),n=Math.floor(K/10),a=t+n;return`
    <span class="ranked-rsoul-balance" tabindex="0" aria-describedby="rankedRSoulTooltip">
      ${L("soul")}
      <span class="ranked-rsoul-value">${R(K)}</span>
      <span class="ranked-rsoul-tooltip" id="rankedRSoulTooltip" role="tooltip">
        <span class="ranked-rsoul-tooltip-main">
          <strong>Interest:</strong>
          ${L("soul")}
          <strong>${R(a)}</strong>
        </span>
        <span class="ranked-rsoul-tooltip-formula">Floor number + 1 every 10 souls</span>
      </span>
    </span>
  `}function Ji(e,t){if(!t){m.enemySideTitle.innerHTML="<span>Reserve</span>";return}let n=e.opponent||e.lastBattle?.opponent||null,a=n?.generated?"Ranked Rival":n?.hunterName||"Opponent",r=!n?.generated&&n?.hunterName?`<a class="ranked-opponent-link" href="${C(window.AmongDemons.appUrl(`/hunter/${encodeURIComponent(n.hunterName)}`))}">${C(a)}</a>`:`<span>${C(a)}</span>`,o=it(n?.division),i=n?.division?`
      <span class="ranked-desktop-status">
        ${Lt(o,{showLabel:!0})}
      </span>
      <span class="ranked-mobile-status">
        ${Lt(o,{showLabel:!0,compact:!0})}
      </span>
    `:"";m.enemySideTitle.innerHTML=`
    ${r}
    ${i}
    ${et(Qi(e),{side:"enemy"})}
  `}function it(e="Bronze III"){let t=String(e||"Bronze III").trim().toLowerCase(),n=t.replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),a=["bronze","silver","gold","platinum","diamond","demonic"].find(r=>t.startsWith(r))||"bronze";return{division:String(e||"Bronze III"),slug:n,tier:a,imageUrl:`/app/images/assets/ranks/${a}.svg`}}function Lt(e,t={}){let n=t.compact?" is-compact":"",a=Number.isFinite(t.occupiedSlots)&&Number.isFinite(t.maxSlots),r=a?`${Math.max(0,t.occupiedSlots)}/${Math.max(1,t.maxSlots)}`:"";return`
    <span class="ranked-rank ranked-rank--${C(e.slug)}${n}"
          aria-label="${C(e.division)} rank">
      <img class="ranked-rank-image" src="${C(e.imageUrl)}" alt="" width="72" height="80" aria-hidden="true">
      ${t.showLabel?`<span class="ranked-rank-label rank-division-text rank-division-text--${C(e.slug)}">${C(e.division.toUpperCase())}</span>`:""}
      ${a?`
        <span class="ranked-rank-separator" aria-hidden="true">&middot;</span>
        <span class="ranked-team-slots" aria-label="${C(`${r} team slots occupied`)}">${C(r)}</span>
      `:""}
    </span>
  `}function fr(e){let t=e.lockedBonuses||{},n=Object.values(t.allocations||{}).reduce((i,c)=>i+Math.max(0,Number(c)||0),0),a=pn({spentPoints:n,bonuses:t.skillBonuses||{}}),r=Aa(Array.isArray(e.pacts?.activeBuffs)?e.pacts.activeBuffs:[]),o=(Array.isArray(t.activeBuffs)?t.activeBuffs:[]).filter(i=>i?.source!=="skill_tree");return[...a?[a]:[],...r,...o].filter(i=>i?.id)}function Qi(e){let t=Array.isArray(e.lastBattle?.enemyBuffs)?e.lastBattle.enemyBuffs:[],n=pn(e.lastBattle?.enemySkillTree);return n?[n,...t.filter(a=>a?.source!=="skill_tree")]:t}function es(e){return Da(e,{stackClass:"ranked-pact-stack",countClass:"ranked-pact-stack-count"})}function ts(e,t){let n=Array.from({length:t.capacities.reserve},()=>null),a=[];e.forEach(o=>{let i=ee(o.reserveSlot);i!==null&&!n[i]?n[i]=o:a.push(o)}),a.forEach(o=>{let i=n.findIndex(c=>!c);i>=0&&(n[i]=o)});let r=fr(t);return`
    <div class="ranked-reserve-panel">
      <div class="battle-formation battle-formation-grid battle-formation-player ranked-reserve-formation"
           data-ranked-zone="reserve" role="list" aria-label="Reserve">
        ${n.map((o,i)=>gn(o,i,{side:"player",allowFormationDrag:!0},"player")).join("")}
      </div>
      ${r.length?`
        <div class="ranked-reserve-buffs-shell">
          <button class="ranked-pact-scroll-btn is-previous" type="button" data-ranked-pact-scroll="-1"
                  aria-label="Scroll active buffs left" title="Scroll active buffs left" hidden disabled>
            ${L("chevron-left")}
          </button>
          <div class="ranked-reserve-buffs-viewport" data-ranked-pact-scroll-viewport tabindex="0"
               role="region" aria-label="Active Ranked Pacts, Skill Tree bonuses, and buffs">
            <div class="dungeon-hand-pacts ranked-reserve-buffs">
              ${r.map(es).join("")}
            </div>
          </div>
          <button class="ranked-pact-scroll-btn is-next" type="button" data-ranked-pact-scroll="1"
                  aria-label="Scroll active buffs right" title="Scroll active buffs right" hidden disabled>
            ${L("chevron-right")}
          </button>
        </div>
      `:""}
    </div>
  `}function ns(e){let n=e.closest(".ranked-reserve-buffs-shell")?.querySelector("[data-ranked-pact-scroll-viewport]");if(!n||e.disabled)return;let a=n.querySelector(".ranked-reserve-buffs"),r=a?.querySelector(".ranked-pact-stack"),o=a?window.getComputedStyle(a):null,i=parseFloat(o?.columnGap||""),c=parseFloat(o?.gap||""),d=Number.isFinite(i)?i:Number.isFinite(c)?c:0,l=r?.getBoundingClientRect().width||0,g=Number(e.dataset.rankedPactScroll)||0,u=Math.max(l+d,n.clientWidth*.72,1);n.scrollBy({left:g*u,behavior:"smooth"})}function pr(){$t&&window.cancelAnimationFrame($t),$t=window.requestAnimationFrame(()=>{$t=0,hr()})}function hr(e=null){let t=e?[e]:Array.from(m.enemyGrid?.querySelectorAll(".ranked-reserve-buffs-shell")||[]),n=window.matchMedia("(max-width: 1199.98px)").matches;t.forEach(a=>{let r=a?.querySelector("[data-ranked-pact-scroll-viewport]"),o=Array.from(a?.querySelectorAll("[data-ranked-pact-scroll]")||[]);if(!r||!o.length)return;!n&&r.scrollLeft&&(r.scrollLeft=0);let i=Math.max(0,r.scrollWidth-r.clientWidth),c=n&&i>1,d=r.scrollLeft<=1,l=r.scrollLeft>=i-1;a.classList.toggle("has-scroll-overflow",c),a.classList.toggle("is-scroll-start",c&&d),a.classList.toggle("is-scroll-end",c&&l),o.forEach(g=>{let p=(Number(g.dataset.rankedPactScroll)||0)<0?d:l;g.hidden=!c||p,g.disabled=!c||p})})}function as(e,t={}){let n=Ni?.(e,{hideHpBar:!0})||"";return Ii(e,{className:"ranked-preparation-demon-card",showStats:!1,overlayHtml:n?`<div class="ranked-preparation-stats" aria-label="Combat stats">${n}</div>`:"",attributes:{"data-instance-id":e.instanceId,...t.zone!=="enemy"?{"data-ranked-workspace-id":e.instanceId,"data-ranked-zone":t.zone,draggable:t.interactive?"true":"false",role:"button",tabindex:t.interactive?"0":"-1"}:{}}})}function rs(e,t={}){let n=f?.hand||[],a=!!t.canReviewFight,r=Sr()&&!G,o=$r()&&!G,i=`Reroll hand for ${Te} Ranked Souls`,c=e.handLocked?"Unlock hand for the next floor":"Lock hand for the next floor",d=os(e.handLocked);return`
    <div class="ranked-reroll-rail">
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-reroll-action" type="button" data-ranked-action="reroll"
              title="${i}" aria-label="${i}" ${r?"":"disabled"}>
        <span class="ranked-reroll-main">
          <span class="ranked-reroll-icon" aria-hidden="true">${L("refresh-cw")}</span>
          <span class="ranked-reroll-copy">
            <strong>Reroll</strong>
          </span>
        </span>
        <span class="ranked-reroll-cost" aria-label="${Te} Ranked Souls">
          ${L("soul")} <strong>${R(Te)}</strong>
        </span>
      </button>
      ${ar(e)}
    </div>
    <div class="ranked-offer-area" data-ranked-drop-zone data-ranked-zone="hand" aria-label="Hand">
      <div class="ranked-offer-grid">
        ${n.length?n.map((l,g)=>`
            <div class="ranked-offer ${!l._rankedPurchased&&Ne(l)>K?"is-unaffordable":""}"
                 data-ranked-drop-zone data-ranked-zone="hand" data-ranked-index="${g}">
              ${as(l,{interactive:!0,zone:"hand"})}
              <span class="ranked-offer-cost ${l._rankedPurchased?"is-purchased":""}"
                    aria-label="${l._rankedPurchased?"Purchased":`${Ne(l)} Ranked Souls`}">
                ${l._rankedPurchased?L("check"):L("soul")}
                ${l._rankedPurchased?"":`<span>${R(Ne(l))}</span>`}
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
        ${$n(a,a)}
      </div>
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-end-run-control"
              type="button" data-ranked-action="end" title="Concede Ranked run" aria-label="Concede Ranked run">
        ${L("flag")} <span>End Run</span>
      </button>
    </div>
    <button class="btn btn-primary btn-lg ranked-side-action ranked-fight-action" type="button" data-ranked-action="fight"
            title="Start Ranked fight" aria-label="Start Ranked fight" ${o?"":"disabled"}>
      ${L("swords")} <span>Fight</span>
    </button>
    <div class="ranked-mobile-nav has-end-run" role="group" aria-label="Ranked preparation controls">
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-reroll-btn" type="button" data-ranked-action="reroll"
              title="${i}" aria-label="${i}" ${r?"":"disabled"}>
        <span class="ranked-mobile-reroll-icon" aria-hidden="true">${L("refresh-cw")}</span>
        <span class="ranked-mobile-reroll-cost" aria-hidden="true">
          ${L("soul")} <strong>${R(Te)}</strong>
        </span>
        <span class="visually-hidden">Reroll</span>
      </button>
      <details class="ranked-mobile-odds" name="ranked-mobile-popover">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Reroll rarity odds" aria-label="Reroll rarity odds">
          ${L("info")}
          <span class="visually-hidden">Reroll rarity odds</span>
        </summary>
        <div class="ranked-mobile-odds-popover">
          ${ar(e)}
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ${e.handLocked?"active":""}" type="button"
              data-ranked-action="lock-hand" title="${c}" aria-label="${c}"
              aria-pressed="${e.handLocked?"true":"false"}">
        ${d}
        <span class="visually-hidden">${e.handLocked?"Unlock hand":"Lock hand"}</span>
      </button>
      <details class="ranked-mobile-review-menu ${a?"":"is-disabled"}" name="ranked-mobile-popover">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Fight Review" aria-label="Fight Review"
                 aria-disabled="${a?"false":"true"}" ${a?"":'tabindex="-1"'}>
          ${L("scroll-text")}
          <span class="visually-hidden">Fight Review</span>
        </summary>
        <div class="ranked-mobile-review-popover" role="group" aria-label="Fight Review actions">
          <button class="dungeon-mobile-nav-btn ranked-mobile-review-action" id="rankedMobileReplayBtn" type="button"
                  title="Replay Fight" aria-label="Replay Fight" ${a?"":"disabled"}>
            ${L("list-restart")} <span>Replay</span>
          </button>
          <button class="dungeon-mobile-nav-btn ranked-mobile-review-action" id="rankedMobileLogBtn" type="button"
                  title="Fight Log" aria-label="Fight Log" ${a?"":"disabled"}>
            ${L("log")} <span>Fight Log</span>
          </button>
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-end-action" type="button"
              data-ranked-action="end" title="Concede Ranked run" aria-label="Concede Ranked run">
        ${L("flag")}
        <span class="visually-hidden">End Run</span>
      </button>
      <button class="dungeon-mobile-nav-btn dungeon-mobile-fight-btn ranked-mobile-nav-btn ad-primary-action"
              type="button" data-ranked-action="fight" title="Start Ranked fight" aria-label="Start Ranked fight"
              ${o?"":"disabled"}>
        ${L("swords")}
        <span class="visually-hidden">Fight</span>
      </button>
    </div>
  `}function os(e){return L(e?"lock":"lock-open")}function ar(e){let t=e?.rarityOdds||{};return`
    <div class="ranked-reroll-odds" aria-label="Reroll rarity odds per card">
      <span class="ranked-reroll-odds-grid">${nt.map(a=>{let r=Math.max(0,Number(t[a])||0),o=rt(a);return`
      <span class="ranked-reroll-odd is-${a}${r<=0?" is-zero":""}"
            title="${C(o)}: ${R(r)}%"
            aria-label="${C(o)} ${R(r)} percent">
        <strong>${R(r)}%</strong>
      </span>
    `}).join("")}</span>
    </div>
  `}function br(){if(m.fightLog){if(!s.combatLog?.length){m.fightLog.innerHTML="Fight log will appear here after a battle.",m.fightLog.classList.add("text-muted");return}m.fightLog.classList.remove("text-muted"),m.fightLog.innerHTML=Xe(s.combatLog).map((e,t)=>cn(e,t)).join("")}}function yr(){let e=s.run;if(!(!e||!m.dungeonBottomControls||!m.dungeonReplayLogBox)){if(m.dungeonReplayLogBox.innerHTML="",s.isPactTeamPreview&&e.pendingPact){Cn("pact",Pn());return}if(s.isBattleAnimating){Cn("battle",`
      ${Sn()}
      ${Rn()}
      ${xn()}
    `),is();return}Cn("empty","")}}function Cn(e,t){m.dungeonBottomControls.dataset.rankedControlMode!==e&&(m.dungeonBottomControls.innerHTML=t,m.dungeonBottomControls.dataset.rankedControlMode=e)}function is(){let e=m.dungeonBottomControls,t=s.combatPlayback||{},n=Number(t.currentIndex)||0,a=Number(t.totalSteps)||0,r=!!t.isPaused,o=r?"Play":"Pause",i=e.querySelector('[data-battle-step="-1"]'),c=e.querySelector('[data-battle-step="1"]'),d=e.querySelector("#battlePlaybackToggleBtn");i&&(i.disabled=n<=0),c&&(c.disabled=n>=a),d&&d.getAttribute("aria-label")!==o&&(d.title=o,d.setAttribute("aria-label",o),d.innerHTML=L(r?"play":"pause")),bt()}function rr(e){let t=!!e?.length,n=t&&!s.isBattleAnimating&&!s.isLoading&&!ce,a=!m.demonicPactOverlay.classList.contains("d-none");if(m.demonicPactOverlay.classList.toggle("d-none",!n),!n){s.isPactTeamPreview=!1,or(),t||(m.rankedPactGrid.innerHTML="",delete m.rankedPactGrid.dataset.pactSignature);return}a||(s.isPactTeamPreview=!1);let r=e.map(o=>`${o.id}:${o.rarity||"common"}`).join("|");m.rankedPactGrid.dataset.pactSignature!==r&&(m.rankedPactGrid.innerHTML=e.map(o=>{let i=String(o.rarity||"common").toLowerCase();return`
        <button class="demonic-pact-card is-${C(i)}" type="button" data-ranked-action="pact" data-buff-id="${C(o.id)}">
          <span class="demonic-pact-icon" aria-hidden="true">${L(o.icon||"sparkles")}</span>
          <span class="demonic-pact-rarity ad-${C(i)}">${rt(i)}</span>
          <strong>${C(o.name||o.id)}</strong>
          <span class="demonic-pact-description">${C(o.description||"")}</span>
          <span class="demonic-pact-tags">${(o.tags||[]).map(c=>`<span>${C(c)}</span>`).join("")}</span>
        </button>
      `}).join(""),m.rankedPactGrid.dataset.pactSignature=r),or(),a||de?.play("sfx.dungeon.pactReveal",{volume:.88})}function ss(){!m.demonicPactOverlay||m.demonicPactOverlay.classList.contains("d-none")||(s.isPactTeamPreview=!s.isPactTeamPreview,_())}function or(){let e=!!s.isPactTeamPreview;m.demonicPactOverlay?.classList.toggle("is-team-preview",e),m.demonicPactViewToggle&&(m.demonicPactViewToggle.classList.toggle("d-none",e),m.demonicPactViewToggle.textContent="View Team",m.demonicPactViewToggle.setAttribute("aria-expanded",String(!e)))}function cs(e){let t=Number(e.highestClearedFloor)||0,n=Math.max(t,Number(e.endReachedFloor??e.floor)||1),a=Math.max(0,Number(e.rating?.rating)||0),r=Number(e.rating?.runDelta)||0,o=it(e.rating?.division||"Bronze III"),i=e.endReason||(Number(e.lives)<=0?"defeated":"completed"),c=t>=_e,d=c?"Ranked Victory":i==="conceded"?"Run Conceded":i==="defeated"?"Run Defeated":"Run Complete",l=c?"trophy":i==="defeated"?"skull":"flag",g=c?"Floor 20 was conquered and your climb has been recorded.":i==="conceded"?`Your final rank was calculated from reaching Floor ${R(n)}.`:"All three lives were lost. Your rank now reflects the floor you reached.",u=r>0?"is-positive":r<0?"is-negative":"is-neutral";return`
    <div class="ranked-end-card ranked-start-card ranked-results-card ranked-rank--${C(o.slug)} ${u}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">${C(e.season?.name||"Ranked Season")}</span>
      <span class="ranked-results-sigil" aria-hidden="true">${L(l)}</span>
      <h1>${C(d)}</h1>
      <p class="ranked-results-summary">${C(g)}</p>
      <div class="ranked-results-progress" aria-label="Run progress">
        <div><span>Reached</span><strong>Floor ${R(n)}</strong></div>
        <div><span>Cleared</span><strong>Floor ${R(t)}</strong></div>
        <div><span>Lives Left</span><strong>${R(e.lives||0)}</strong></div>
      </div>
      <div class="ranked-results-rank" aria-label="Final rank ${C(o.division)}, ${R(a)} Rank Points">
        <span class="ranked-results-emblem" aria-hidden="true">
          <img src="${C(o.imageUrl)}" alt="" width="112" height="124">
        </span>
        <span class="ranked-results-rank-copy">
          <small>Final Rank</small>
          <strong class="rank-division-text rank-division-text--${C(o.slug)}">${C(o.division.toUpperCase())}</strong>
          <span>${R(a)} RP</span>
        </span>
        <span class="ranked-results-delta ${u}">
          <small>Run Result</small>
          <strong>${Er(r)} RP</strong>
        </span>
      </div>
      <button class="btn btn-primary btn-lg ranked-results-action" type="button" data-ranked-action="start">
        ${L("trophy")} <span>Start New Run</span>
      </button>
    </div>
  `}function ls(){let e=ot?.division||"Bronze III",t=Math.max(0,Number(ot?.rating)||0),n=it(e);return`
    <div class="ranked-end-card ranked-start-card ranked-rank--${C(n.slug)}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">Seasonal Ranked</span>
      <h1>Draft. Adapt. Climb.</h1>
      <p class="ranked-start-summary">
        Build a temporary standardized roster, survive with three lives, and clear Floor ${_e}.
      </p>
      <div class="ranked-start-rank" aria-label="Current rank ${C(n.division)}, ${R(t)} Rank Points">
        <span class="ranked-start-rank-eyebrow">Current Rank</span>
        <span class="ranked-start-rank-emblem" aria-hidden="true">
          <img src="${C(n.imageUrl)}" alt="" width="144" height="160">
        </span>
        <strong class="rank-division-text rank-division-text--${C(n.slug)}">${C(n.division.toUpperCase())}</strong>
        <span class="ranked-start-rating">${R(t)} RP</span>
      </div>
      <div class="ranked-start-rules" aria-label="Ranked run rules">
        <span>${L("heart")} Three lives</span>
        <span>${L("shield-check")} Standardized roster</span>
        <span>${L("flag")} Floor ${_e} victory</span>
      </div>
      <button class="btn btn-primary btn-lg ranked-start-action" type="button" data-ranked-action="start" ${G?"disabled":""}>
        ${L("trophy")} <span>Start Ranked Run</span>
      </button>
    </div>
  `}function ds(e){(e||[]).forEach(t=>{if(t.deferredPreview)return;let n=`${t.resultInstanceId}:${t.fromRarity}:${t.toRarity}`;Qa.has(n)||(Qa.add(n),window.AmongDemons.showGameAlert?.({type:"success",title:`${rt(t.toRarity)} combination!`,message:`Three identical ${rt(t.fromRarity)} demons became one ${rt(t.toRarity)} demon.`,action:`The upgraded demon stayed in ${t.destination==="active"?"your formation":"Reserve"}.`}),window.setTimeout(()=>{document.querySelector(`[data-instance-id="${_n(t.resultInstanceId)}"]`)?.classList.add("is-team-upgrade")},0))})}function us(){document.querySelectorAll(".dungeon-demon-card[data-instance-id]").forEach(e=>{e.dataset.rankedDetailsBound!=="true"&&(e.dataset.rankedDetailsBound="true",e.addEventListener("click",t=>{t.defaultPrevented||Date.now()<An||e.classList.contains("is-dragging")||e.classList.contains("suppress-detail-click")||vr(e)}))})}function vr(e){let t=hs(e?.dataset.instanceId);t&&window.AmongDemons.ui?.openDemonDetailsModal?.(t,{actions:ms(t)})}function ms(e){if(!!!(be(e?.instanceId)?.zone==="hand"&&e?._rankedPurchased&&!G&&!s.isBattleAnimating))return[];let a=In(e);return[{label:"Sell",helper:R(a),icon:"soul",variant:"secondary",className:"ranked-detail-sell-action",title:`Sell for ${R(a)} Ranked Souls`,onClick:gs}]}function gs(e,t){let n=be(e?.instanceId),a=n?f?.[n.zone]?.[n.index]:null;if(n?.zone!=="hand"||!a?._rankedPurchased)return;t.disabled=!0;let r=Pr(a,Ge(null,t),t);if(!r)return;let o=document.getElementById("demonDetailModal");window.bootstrap?.Modal.getInstance(o)?.hide(),Re(`Sold ${a.species||a.name||"demon"} for ${R(r.amount)} rSouls.`,"success"),_()}async function fs(e){await Xa(e==="player"?"victory":"defeat",{syncActions:!1})}function kr(e,t={}){if(!m.rankedVictoryModal||!window.bootstrap?.Modal)return;let n=e?.rating?.division||"Bronze II",a=it(n),r=Math.max(0,Number(t.rankGain??e?.victoryRankGain??e?.rating?.runDelta)||0),o=Math.max(0,Number(e?.rating?.rating)||0),i=`${e?.runId||"ranked"}:${_e}`,c=m.rankedVictoryRankImage?.closest(".ranked-victory-rank");c?.classList.forEach(d=>{d.startsWith("ranked-rank--")&&c.classList.remove(d)}),c?.classList.add(`ranked-rank--${a.slug}`),m.rankedVictoryRankImage&&(m.rankedVictoryRankImage.src=a.imageUrl,m.rankedVictoryRankImage.alt=`${a.division} rank emblem`),m.rankedVictoryDivision&&(m.rankedVictoryDivision.textContent=a.division),m.rankedVictoryRankGain&&(m.rankedVictoryRankGain.textContent=`+${R(r)} RP`),m.rankedVictorySummary&&(m.rankedVictorySummary.textContent=`${R(o)} total RP. Continue into Endless or close this run and begin again.`),Pt(!1),window.bootstrap.Modal.getOrCreateInstance(m.rankedVictoryModal,{backdrop:"static",keyboard:!1}).show(),tr!==i&&(tr=i,de?.play("sfx.dungeon.extract",{volume:.94,queueUntilUnlock:!0}))}async function ps(e){if(!(G||!v?.awaitingVictoryChoice)){if(Pt(!0),e==="endless"){let t=await He("continue",{});if(t?.run&&!t.run.awaitingVictoryChoice){window.bootstrap?.Modal.getOrCreateInstance(m.rankedVictoryModal)?.hide(),Re("Endless floor unlocked.","success");return}Pt(!1);return}if(e==="new-run"&&(await He("end",{}))?.run?.status==="ended"){window.location.href=window.AmongDemons.appUrl("/ranked");return}Pt(!1)}}function Pt(e){m.rankedVictoryModal?.querySelectorAll("[data-ranked-victory-action]").forEach(t=>{t.classList.toggle("disabled",!!e),t.setAttribute("aria-disabled",e?"true":"false"),t.matches("button")&&(t.disabled=!!e)})}function hs(e){return[...s.run?.team||[],...s.run?.reserve||[],...s.run?.enemies||[],...f?.hand||[]].find(t=>t?.instanceId===e)}function Mn(e){return!!(e?.status==="active"&&["draft","selection","preparation"].includes(e.phase))}function bs(e){Mt=[],Dn=new Set((e.offers||[]).filter(r=>r.purchased).map(r=>String(r.offerId)));let t=U(e.active||e.team).map((r,o)=>({...xt(r,e),formationSlot:le(r.formationSlot)??o,_rankedOrigin:"roster",_rankedPurchased:!0})),n=U(e.reserve).map((r,o)=>({...xt(r,e),reserveSlot:ee(r.reserveSlot)??o,_rankedOrigin:"roster",_rankedPurchased:!0})),a=(e.offers||[]).map(r=>({...xt(r.demon,e),_rankedOrigin:"offer",_rankedOfferId:r.offerId,_rankedCost:Math.max(0,Number(r.cost)||Ne(r.demon)),_rankedPurchased:!!r.purchased}));return{active:t,reserve:n,hand:a}}function xt(e={},t=v){let n=JSON.parse(JSON.stringify(e)),a=`${Number(n.typeId||n.type_id||n.type)}:${String(n.rarity||"common").toLowerCase()}`,r=t?.previewStats?.[a];return r?{...n,...JSON.parse(JSON.stringify(r)),hp:Math.max(1,Number(r.maxHp)||Number(r.hp)||1),_rankedPactPreviewApplied:!0}:n}function ys(){!f||!s.run||!Mn(v)||(s.run.team=f.active,s.run.active=f.active,s.run.reserve=f.reserve,s.run.offers=f.hand.filter(e=>e._rankedOrigin==="offer").map(e=>({offerId:e._rankedOfferId,demon:e})))}function wr(){return{purchasedOfferIds:[...Dn],sold:Mt.map(e=>tt(e)),active:(f?.active||[]).map(e=>({...tt(e),formationSlot:le(e.formationSlot)})),reserve:(f?.reserve||[]).map(e=>({...tt(e),reserveSlot:ee(e.reserveSlot)})),hand:(f?.hand||[]).map(e=>tt(e))}}function tt(e){return e?._rankedCombinationRecipe?{combination:JSON.parse(JSON.stringify(e._rankedCombinationRecipe))}:{instanceId:e?.instanceId}}function $r(){return!!(f&&v?.status==="active"&&!v.pendingPact&&f.active.length>0&&f.active.length<=Number(v.capacities?.active||6)&&f.reserve.length<=Number(v.capacities?.reserve||6))}function Sr(){return!f||!["draft","selection"].includes(v?.phase)||v.pendingPact?!1:K>=Te}function vs(){!f||ce||s.isBattleAnimating||s.run?.phase==="result"||(m.teamGrid.querySelectorAll(".formation-slot").forEach(e=>{let t=e.querySelector(".formation-lane-cards");if(!t)return;t.dataset.rankedDropZone="",t.dataset.rankedZone="active",t.dataset.formationSlot=e.dataset.formationSlot;let n=t.querySelector(".dungeon-demon-card[data-instance-id]");n&&(n.dataset.rankedWorkspaceId=n.dataset.instanceId,n.dataset.rankedZone="active",n.setAttribute("draggable","true"))}),m.enemyGrid.querySelectorAll(".ranked-reserve-formation .formation-slot").forEach((e,t)=>{e.setAttribute("aria-label",`Reserve slot ${t+1}`);let n=e.querySelector(".formation-lane-cards");if(!n)return;n.dataset.rankedDropZone="",n.dataset.rankedZone="reserve",n.dataset.rankedIndex=String(t);let a=n.querySelector(".dungeon-demon-card[data-instance-id]");a&&(a.dataset.rankedWorkspaceId=a.dataset.instanceId,a.dataset.rankedZone="reserve",a.setAttribute("draggable","true"))}))}function ks(){if(!f||ce||s.isBattleAnimating||s.run?.phase==="result")return;ws().forEach(t=>{let n=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${_n(t)}"]`);n&&(n.classList.add("is-ranked-combine-ready"),n.querySelector(".dungeon-team-upgrade-indicator")||n.insertAdjacentHTML("afterbegin",fn()))})}function ws(){let e=new Map;return[...f?.active||[],...f?.reserve||[],...f?.hand||[]].forEach(t=>{let n=String(t?.rarity||"").toLowerCase(),a=Number(t?.typeId||t?.type_id||t?.type);if(!a||!Tn(n))return;let r=`${a}:${n}`,o=e.get(r)||[];o.push(String(t.instanceId)),e.set(r,o)}),new Set([...e.values()].filter(t=>t.length>=3).flat())}function Ct(e){if(!f||!(e instanceof Element))return null;let t=e.closest("[data-ranked-workspace-id]");return t||e.closest("[data-ranked-drop-zone]")}function be(e){for(let t of["active","reserve","hand"]){let n=f?.[t]?.findIndex(a=>String(a.instanceId)===String(e));if(n>=0)return{zone:t,index:n,slot:t==="active"?le(f[t][n].formationSlot):t==="reserve"?ee(f[t][n].reserveSlot)??n:null}}return null}function $s(e){let t=e.closest?.("[data-ranked-workspace-id]");if(t){let i=be(t.dataset.rankedWorkspaceId);return i?{...i,occupantId:t.dataset.rankedWorkspaceId}:null}let n=e.dataset.rankedZone;if(!["active","reserve","hand"].includes(n))return null;let a=n==="active"?le(e.dataset.formationSlot??e.closest(".formation-slot")?.dataset.formationSlot):n==="reserve"?ee(e.dataset.rankedIndex??e.closest(".formation-slot")?.dataset.formationSlot):null,r=Number(e.dataset.rankedIndex),o=Number.isInteger(r)&&r>=0?r:f[n].length;return{zone:n,slot:a,index:o,occupantId:null}}function Ln(e=null){let t=Number(v?.capacities?.reserve||6);if(f.reserve.length>=t)return null;let n=new Set(f.reserve.map((o,i)=>ee(o.reserveSlot)??ee(i)).filter(o=>o!==null)),a=e?.zone==="reserve"&&!e.occupantId?ee(e.slot??e.index):null,r=a!==null&&!n.has(a)?a:Array.from({length:t},(o,i)=>i).find(o=>!n.has(o));return Number.isInteger(r)?{zone:"reserve",slot:r,index:f.reserve.length,occupantId:null}:null}async function Rr(e,t,n=null){if(!f||G||s.isBattleAnimating)return;let a=be(e),r=$s(t);if(!a||!r||r.occupantId===String(e)){j();return}let o={active:U(f.active),reserve:U(f.reserve),hand:U(f.hand)},i=f[a.zone][a.index],c=r.occupantId?f[r.zone][r.index]:null;if(a.zone!=="hand"&&r.zone==="hand"){Pr(i,n,t),j(),_();return}let d=a.zone==="hand"&&i?._rankedOrigin==="offer"&&!i._rankedPurchased&&["active","reserve"].includes(r.zone)?i:r.zone==="hand"&&c?._rankedOrigin==="offer"&&!c._rankedPurchased&&["active","reserve"].includes(a.zone)?c:null,l=d?Ne(d):0;if(d&&l>K){j(),Re(`This card costs ${R(l)} rSouls.`,"warning"),_();return}let g=Ss(i,a,r,c);if(g){Ie(e),ir(d,l,n,t);let x=[xr(g.consumed,g.destinationEntry,g.rarity),...sr()].filter(Boolean);j(),_(),cr(x);return}let u=d===i&&r.zone!=="active"&&Ln(r)||r,p=Number(v.capacities?.active||6);if(u.zone==="active"&&a.zone!=="active"&&!u.occupantId&&f.active.length>=p){j(),Re(`Floor ${R(v.floor)} allows ${R(p)} active demons.`,"warning"),_();return}let P=Ie(e),y=u.occupantId?Ie(u.occupantId):null;if(!P||!Et(P,u)){f=o,j(),_();return}let S=a.zone==="hand"&&u.zone==="active"&&Ln()||a;if(y&&!Et(y,S)){f=o,j(),_();return}(f.active.length>Number(v.capacities?.active||6)||f.reserve.length>Number(v.capacities?.reserve||6))&&(f=o),f!==o&&d&&ir(d,l,n,t);let k=f===o?[]:sr();j(),_(),cr(k)}function Ss(e,t,n,a){if(t.zone!=="hand"||e?._rankedOrigin!=="offer"||e._rankedPurchased||!["active","reserve"].includes(n.zone)||!n.occupantId||!a)return null;let r=String(e.rarity||"").toLowerCase(),o=Number(e.typeId||e.type_id||e.type);if(!Tn(r)||Number(a.typeId||a.type_id||a.type)!==o||String(a.rarity||"").toLowerCase()!==r)return null;let i=[...f.active.map(l=>({zone:"active",demon:l})),...f.reserve.map(l=>({zone:"reserve",demon:l}))].filter(l=>Number(l.demon?.typeId||l.demon?.type_id||l.demon?.type)===o&&String(l.demon?.rarity||"").toLowerCase()===r),c=i.find(l=>String(l.demon.instanceId)===String(a.instanceId)),d=i.find(l=>String(l.demon.instanceId)!==String(a.instanceId));return!c||!d?null:{rarity:r,destinationEntry:c,consumed:[c,d,{zone:"hand",demon:e}]}}function ir(e,t,n,a){e&&(e._rankedPurchased=!0,e._rankedCost=t,Dn.add(String(e._rankedOfferId)),K=Math.max(0,K-t),st(n||Ge(null,a),-t),de?.play("sfx.world.merchantPurchase",{volume:.82}))}function Rs(){let e=(f?.hand||[]).filter(r=>r?._rankedPurchased);if(!e.length)return{count:0,amount:0};let t=0,n=0;if(e.forEach(r=>{let o=Ie(r.instanceId);o&&(Mt.push(o),t+=In(o),n+=1)}),!n)return{count:0,amount:0};K+=t;let a=m.rankedHandStatus?.querySelector(".ranked-rsoul-value");return st(Ge(null,a),t,{interest:!0}),de?.play("sfx.world.merchantPurchase",{volume:.82}),{count:n,amount:t}}function Pr(e,t,n){if(!e)return null;let a=be(e.instanceId),r=Ie(e.instanceId);if(!r)return null;let o=In(r);Mt.push(r),K+=o;let i=a?.zone==="reserve"?Ps(a.slot):null;return st(t||Ge(null,n),o,{interest:!0}),de?.play("sfx.world.merchantPurchase",{volume:.82}),{sold:r,amount:o,reserveRefill:i}}function Ps(e){let t=f?.hand?.find(o=>o?._rankedPurchased);if(!t)return null;let n=be(t.instanceId),a=Ln({zone:"reserve",slot:e,index:e,occupantId:null});if(!n||!a)return null;let r=Ie(t.instanceId);return r?Et(r,a)?r:(Et(r,n),null):null}function Ie(e){let t=be(e);return t&&f[t.zone].splice(t.index,1)[0]||null}function Et(e,t){if(!e||!t||!f[t.zone])return!1;if(t.zone==="active"){if(f.active.length>=Number(v.capacities?.active||6))return!1;let a=le(t.slot);return a===null||f.active.some(r=>le(r.formationSlot)===a)?!1:(e.formationSlot=a,e.position=a%3===2?"front":"back",f.active.push(e),f.active.sort((r,o)=>Number(r.formationSlot)-Number(o.formationSlot)),!0)}if(t.zone==="reserve"&&f.reserve.length>=Number(v.capacities?.reserve||6))return!1;if(t.zone==="reserve"){let a=ee(t.slot??t.index);return a===null||f.reserve.some(r=>ee(r.reserveSlot)===a)?!1:(delete e.formationSlot,e.reserveSlot=a,e.position=e.preferredPosition==="back"?"back":"front",f.reserve.push(e),!0)}delete e.formationSlot,delete e.reserveSlot,e.position=e.preferredPosition==="back"?"back":"front";let n=Math.min(Math.max(0,Number(t.index)||0),f[t.zone].length);return f[t.zone].splice(n,0,e),!0}function sr(){if(!f)return[];let e=[],t=!0;for(;t;){t=!1;for(let n of nt.slice(0,-1)){let a=new Map;[...f.active.map(d=>({zone:"active",demon:d})),...f.reserve.map(d=>({zone:"reserve",demon:d}))].forEach(d=>{if(String(d.demon?.rarity||"").toLowerCase()!==n)return;let l=`${Number(d.demon?.typeId)}:${n}`,g=a.get(l)||[];g.push(d),a.set(l,g)});let o=[...a.values()].find(d=>d.length>=3);if(!o)continue;let i=o.slice(0,3),c=i.find(d=>d.zone==="active")||i[0];e.push(xr(i,c,n)),t=!0;break}}return e}function xr(e,t,n){let a=new Set(e.map(o=>String(o.demon.instanceId)));f.active=f.active.filter(o=>!a.has(String(o.instanceId))),f.reserve=f.reserve.filter(o=>!a.has(String(o.instanceId)));let r=xs(e.map(o=>o.demon),Tn(n),t);return f[t.zone].push(r),t.zone==="active"&&f.active.sort((o,i)=>Number(o.formationSlot)-Number(i.formationSlot)),{resultInstanceId:r.instanceId,fromRarity:n,toRarity:r.rarity,destination:t.zone}}function xs(e,t,n){let a=e[0]||{},r=Number(a.typeId||a.type_id||a.type);er+=1;let o=`ranked-preview-combine-${Date.now()}-${er}`,i=Fe?.types?.[String(r)]||{},c=Fe?.demons?.find(g=>Number(g.type)===r&&String(g.rarity).toLowerCase()===t),d=Number(i.rarityMultiplier?.[t])||1,l=c?{instanceId:o,sourceDemonId:c.id,typeId:r,species:i.name||a.species,role:i.role||a.role,targeting:i.targeting||a.targeting,preferredPosition:i.preferredPosition==="back"?"back":"front",rarity:t,imageUrl:c.image_url||c.imageUrl,maxHp:St(i.baseStats?.hp,d),hp:St(i.baseStats?.hp,d),atk:St(i.baseStats?.atk,d),speed:St(i.baseStats?.speed,d),position:i.preferredPosition==="back"?"back":"front",attackMeter:0,ranked:!0}:{...JSON.parse(JSON.stringify(a)),instanceId:o,rarity:t,hp:Math.max(1,Number(a.maxHp)||Number(a.hp)||1),attackMeter:0};return delete l.formationSlot,delete l.reserveSlot,delete l._rankedCost,delete l._rankedOfferId,delete l._rankedPurchased,l._rankedOrigin="combination",l._rankedCombinationRecipe={sources:e.map(g=>tt(g))},n.zone==="active"?(l.formationSlot=le(n.demon.formationSlot),l.position=l.formationSlot%3===2?"front":"back"):l.reserveSlot=ee(n.demon.reserveSlot),xt(l)}function St(e,t){let n=Number(e?.[0])||1,a=Number(e?.[1])||n;return Math.max(1,Math.round((n+a)/2*t))}function Tn(e){let t=nt.indexOf(String(e||"").toLowerCase());return t>=0&&t<nt.length-1?nt[t+1]:null}function cr(e){e?.length&&window.requestAnimationFrame(()=>{let t=0;e.forEach(n=>{let a=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${_n(n.resultInstanceId)}"]`);if(!a)return;let r=t*120;t+=1,window.setTimeout(()=>{Cs(a),de?.play("sfx.progression.trainingSuccess",{volume:.88})},r)})})}function Cs(e){let t=e?.getBoundingClientRect?.();if(!t)return;let n=document.createElement("span");n.className="ranked-combination-nova",n.setAttribute("aria-hidden","true"),n.style.setProperty("--ranked-combination-nova-size",`${Math.round(Math.max(48,t.width,t.height)*1.5)}px`),n.style.left=`${Math.round(t.left+t.width/2)}px`,n.style.top=`${Math.round(t.top+t.height/2)}px`,n.innerHTML=`
    <span class="ranked-combination-nova-ring"></span>
    <span class="ranked-combination-nova-ring is-delayed"></span>
    <span class="ranked-combination-nova-core"></span>
    ${Array.from({length:6},(a,r)=>`<span class="ranked-combination-nova-ray" style="--angle: ${r*60}deg"></span>`).join("")}
  `,document.body.appendChild(n),e.classList.add("is-ranked-upgrading"),n.addEventListener("animationend",a=>{a.target===n&&n.remove()}),window.setTimeout(()=>{n.remove(),e.classList.remove("is-ranked-upgrading")},1e3)}function j(){document.querySelectorAll(".is-drag-over").forEach(e=>e.classList.remove("is-drag-over"))}function Fn(e){let t=be(e);Cr(!!(t&&t.zone!=="hand"))}function At(){Cr(!1)}function Cr(e){let t=!!e,n=m.rankedPreparation?.querySelector(".ranked-offer-area"),a=n?.querySelector(".ranked-offer-grid"),r=n?.querySelector(".ranked-hand-sale-prompt");document.documentElement.classList.toggle("is-ranked-selling-demon",t),m.rankedBottomPanel?.classList.toggle("is-ranked-selling-demon",t),n?.classList.toggle("is-ranked-sale-target",t),n?.setAttribute("aria-label",t?"Sell Demon":"Hand"),a?.toggleAttribute("hidden",t),n?.querySelectorAll(".ranked-offer, .ranked-hand-empty").forEach(o=>{o.toggleAttribute("hidden",t)}),r?.toggleAttribute("hidden",!t),r?.setAttribute("aria-hidden",String(!t))}function Bs(e){if(e.button!==void 0&&e.button!==0)return;let t=e.target.closest("[data-ranked-workspace-id]");!t||!f||G||s.isBattleAnimating||($={card:t,instanceId:t.dataset.rankedWorkspaceId,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,active:!1,ghost:null,target:null},Fn($.instanceId),t.setPointerCapture?.(e.pointerId))}function Ls(e){if(!$||e.pointerId!==$.pointerId)return;let t=Math.hypot(e.clientX-$.startX,e.clientY-$.startY);if(!$.active&&t<8)return;$.active||Es(e),e.cancelable&&e.preventDefault(),$.ghost.style.left=`${e.clientX}px`,$.ghost.style.top=`${e.clientY}px`,$.ghost.hidden=!0;let n=document.elementFromPoint(e.clientX,e.clientY);$.ghost.hidden=!1;let a=Ct(n);j(),a?.classList.add("is-drag-over"),$.target=a}function Es(e){$.active=!0,Fn($.instanceId),$.card.classList.add("is-dragging","is-pointer-dragging","suppress-detail-click"),$.ghost=$.card.cloneNode(!0),$.ghost.classList.add("pointer-drag-ghost"),$.ghost.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click","is-drag-over"),$.ghost.removeAttribute("role"),$.ghost.removeAttribute("tabindex"),$.ghost.setAttribute("aria-hidden","true"),$.ghost.style.width=`${$.card.getBoundingClientRect().width}px`,$.ghost.style.left=`${e.clientX}px`,$.ghost.style.top=`${e.clientY}px`,document.body.appendChild($.ghost)}function As(e){if(!$||e.pointerId!==$.pointerId)return;let t=$;if(t.active){e.cancelable&&e.preventDefault(),e.stopPropagation(),An=Date.now()+350;let n=t.target;En(),n&&Rr(t.instanceId,n,{x:e.clientX,y:e.clientY});return}En()}function Ds(e){!$||e.pointerId!==$.pointerId||En({preserveSaleTarget:Rt})}function En(e={}){$&&($.card?.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click"),$.ghost?.remove(),$=null,e.preserveSaleTarget||At(),j())}function Ms(e){return e?.position==="back"?"back":"front"}function Ts(){return""}function Br(){if(!m.dungeonCenterActions)return;let e=Math.max(1,Number(s.run?.floor)||1);m.dungeonCenterActions.innerHTML=`
    <span class="dungeon-floor-marker ranked-floor-marker" aria-label="Current floor ${R(e)}">
      <span>Floor</span>
      <strong>${R(e)}</strong>
    </span>
  `}function le(e){let t=Number(e);return Number.isInteger(t)&&t>=0&&t<9?t:null}function ee(e){let t=Number(e),n=Number(v?.capacities?.reserve||6);return Number.isInteger(t)&&t>=0&&t<n?t:null}function Ne(e){let t=Number(e?._rankedCost);if(Number.isFinite(t)&&t>=0)return Math.floor(t);let n=String(e?.rarity||"common").toLowerCase();return Ja[n]||Ja.common}function In(e){return Math.ceil(Ne(e)/2)}function Nn(e,t={}){if(!e)return;let n=window.AmongDemons.getSession?.()||{};window.AmongDemons.setSession?.({...n,player:{...n.player||{},...e}}),window.AmongDemons.ui?.updateNavAccount?.(e,t)}function Ge(e,t){if(Number.isFinite(e?.clientX)&&Number.isFinite(e?.clientY)&&(e.clientX||e.clientY))return{x:e.clientX,y:e.clientY};let n=t?.getBoundingClientRect?.();return n?{x:n.left+n.width/2,y:n.top+n.height/2}:{x:window.innerWidth/2,y:window.innerHeight/2}}function Fs(e){let t=m.rankedHandStatus?.querySelector(".ranked-rsoul-value");st(Ge(null,t),e,{interest:!0})}function Lr(){if(at<=0||v?.pendingPact)return;let e=at;at=0,window.requestAnimationFrame(()=>Fs(e))}function st(e,t,n={}){let a=document.createElement("span"),r=Number(t)||0,o=Math.round(Number(e?.x)||window.innerWidth/2),i=Math.round(Number(e?.y)||window.innerHeight/2);a.className=["ranked-soul-spend-float",r>0?"is-gain":"is-spend",n.interest?"is-interest":""].filter(Boolean).join(" "),a.style.left=`${o}px`,a.style.top=`${i}px`,a.innerHTML=n.interest?`<strong>+</strong>${L("soul")}<strong>${R(Math.abs(r))}</strong>`:`${L("soul")}<strong>${r>0?"+":"-"}${R(Math.abs(r))}</strong>`,document.body.appendChild(a),a.addEventListener("animationend",()=>a.remove(),{once:!0}),window.setTimeout(()=>a.remove(),1400)}function Bn(e){s.isLoading=!!e,m.runLoading?.classList.toggle("d-none",!e)}function ze(e){G=!!e,document.documentElement.classList.toggle("is-ranked-busy",G)}function Tt(e){console.error(e),window.AmongDemons.setGameAlert(m.rankedMessage,e,{type:"danger"})}function Re(e,t="info"){window.AmongDemons.setGameAlert(m.rankedMessage,e,{type:t})}function Is(){return crypto.randomUUID?crypto.randomUUID():`ranked-${Date.now()}-${Math.random().toString(36).slice(2,12)}`}function U(e=[]){return(e||[]).map(t=>JSON.parse(JSON.stringify(t)))}function rt(e){let t=String(e||"");return t?t.charAt(0).toUpperCase()+t.slice(1):""}function R(e){return Number(e||0).toLocaleString()}function Er(e){let t=Number(e)||0;return`${t>0?"+":""}${R(t)}`}function _n(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function C(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Ns(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}})();
