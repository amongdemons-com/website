(()=>{var Po=Object.defineProperty;var Ro=(e,t)=>{for(var n in t)Po(e,n,{get:t[n],enumerable:!0})};var h={};function Tn(e){Object.assign(h,e)}var nt="amongdemons-battle-speed",Mn="amongdemons-battle-screen-shake",Fn="amongdemons-battle-card-shake";var Pe=[.5,1,2,4];var Oe={default:{color:"#FAC51C",shadow:"rgba(250,197,28,0.85)"},poison:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},heal:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},1:{color:"#D1D5D8",shadow:"rgba(209,213,216,0.82)",outline:"#101820"},2:{color:"#171D24",shadow:"rgba(0,0,0,0.88)"},3:{color:"#167246",shadow:"rgba(22,114,70,0.92)"},4:{color:"#E25041",shadow:"rgba(226,80,65,0.88)"},5:{color:"#C8CED2",shadow:"rgba(200,206,210,0.82)",outline:"#101820"},6:{color:"#C084FC",shadow:"rgba(192,132,252,0.9)"},7:{color:"#FFB23F",shadow:"rgba(255,178,63,0.9)"},8:{color:"#6E8F45",shadow:"rgba(110,143,69,0.86)"},9:{color:"#B8BDC2",shadow:"rgba(184,189,194,0.84)",outline:"#101820"},10:{color:"#8DE7FF",shadow:"rgba(141,231,255,0.86)",outline:"#0d2530"},11:{color:"#52B7FF",shadow:"rgba(82,183,255,0.9)"}};var xo=window.AmongDemons.getSession(),i={player:xo.player||null,statPoints:null,run:null,startOptions:null,selectedRecruitRewardId:null,selectedSwapInstanceId:null,selectedRewardDemonKey:null,rewardDraftCandidate:null,isRecruiting:!1,isResultAnimating:!1,draggedRecruitPoolInstanceId:null,draggedFormationInstanceId:null,draggedRewardDemonKey:null,recruitSwapEffectIds:[],pendingHandFlowSources:null,isEnemyPreviewDeferred:!1,enemyRevealEffectIds:[],isPactRevealPending:!1,isPactTeamPreview:!1,pactRevealTimer:null,battleHandPreview:null,activeHandTab:"hand",isMobileRewardBoxOpen:!1,recruitDraftTeam:null,recruitDraftPool:null,collectionDemons:null,collectionReinforcementPlaceholderInteracted:!1,collectionReinforcementStagedInteracted:!0,isRecruitContinuePending:!1,combatLog:[],combatDemons:new Map,combatPlayback:null,battleSpeed:Lo(),isBattleAnimating:!1,endNotice:null,endSummary:null,endedReplayRun:null,formationRows:new Map,isLoading:!0},b={},ue=null;function In(e){ue=e}function Lo(){let e=Number(localStorage.getItem(nt));return Pe.includes(e)?e:1}var an={};Ro(an,{animateAttackerCard:()=>Kn,animateCombatEntry:()=>Vn,appendTemporaryElement:()=>Y,applyBattleSpeed:()=>dt,applyCombatTheme:()=>Zt,createCombatDemonMap:()=>je,createCombatElement:()=>q,drawAttackZap:()=>Le,drawChaoticLightning:()=>sa,drawCombatAnimation:()=>Qo,drawDarkSpike:()=>ca,drawFireNova:()=>ra,drawFireball:()=>aa,drawGroupFireball:()=>oa,drawHealEffect:()=>ia,drawSwordSwing:()=>Ut,drawThornBurst:()=>Ot,findDemonCard:()=>C,formatBattleSpeed:()=>rr,getAttackGeometry:()=>Ye,getAttackProfile:()=>qe,getBattleTimeScale:()=>en,getCombatDemon:()=>Z,getCombatStepDelay:()=>Jt,getCombatTheme:()=>Xt,getDemonSide:()=>oe,getFightLogActionText:()=>ua,getFightLogAmountText:()=>ga,getFightLogVerb:()=>ma,getLogRowClass:()=>fa,getLogSideLabel:()=>pa,getPoisonBurstDamage:()=>nn,groupCombatLog:()=>We,healTargetCard:()=>_t,hitTargetCard:()=>ea,isCardShakeEnabled:()=>Jn,isScreenShakeEnabled:()=>Qn,isTypeTwoAttack:()=>la,maybePlayDeath:()=>na,pauseCombatPlayback:()=>qt,playCombatLog:()=>it,playTemporaryCardClass:()=>ge,poisonTickCard:()=>Nt,prefersReducedMotion:()=>z,prepareCombatPlayback:()=>Gn,renderFightLogDemonName:()=>zt,renderFightLogRow:()=>tn,renderLogPosition:()=>da,renderViewportSvg:()=>re,resumeCombatPlayback:()=>Yt,scaleCombatDuration:()=>V,scheduleImpact:()=>$e,setActiveLogRow:()=>lt,setBattleSpeed:()=>Qt,shakeTargetCard:()=>or,showFloatingDamage:()=>Ge,skipCombatPlayback:()=>jt,spawnImpactBurst:()=>It,stepCombatPlayback:()=>Wt,syncBattleSpeedButtons:()=>ut,syncCombatHpCards:()=>jn,syncPoisonStatus:()=>Ht,triggerScreenShake:()=>ta,updateTargetCard:()=>me,updateTeamHp:()=>Wn});var Co=window.AmongDemons.api;var Nn=window.AmongDemons.ui.renderDemonCard,Bo=window.AmongDemons.ui.renderCombatStats,Ds=window.AmongDemons.ui.openDemonDetailsModal,x=window.AmongDemons.ui.renderIcon||(()=>""),At=window.AmongDemons.ui.renderSoulAmount||(e=>String(e||0)),Et=window.AmongDemons.ui.getRarityColor||(()=>"#D1D5D8");var ne=new WeakMap;function _n(){i.endNotice=null,i.endSummary=null,i.endedReplayRun=null}function N(e,t){e&&e.addEventListener("click",t)}function at(e,t,n=document){n.querySelectorAll(e).forEach(a=>{a.addEventListener("click",o=>t(a,o))})}function Q(e,t,n={}){if(!e)return!1;let a=String(t||""),o=n.renderKey?String(n.renderKey):"",r=Re(a,o);return ne.get(e)===r?!1:(n.patchFormationGrid?Eo(e,a,o):n.patchDemonLane?Do(e,a,o):n.preserveDemonImages?Ao(e,a):e.innerHTML=a,ne.set(e,r),!0)}function Ao(e,t){let n=ze(e),a=document.createElement("template");a.innerHTML=t,we(a.content,n),e.replaceChildren(a.content)}function Eo(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let o=e.querySelector(".battle-formation-grid"),r=a.content.querySelector(".battle-formation-grid");if(!o||!r){let u=ze(e);we(a.content,u),e.replaceChildren(a.content),To(e.querySelector(".battle-formation-grid"),n);return}let s=ze(e);Tt(o,r);let c=Dt(o),l=new Map(c.map(u=>[u.dataset.formationSlot,u])),d=Dt(r),m=new Set(d.map(u=>u.dataset.formationSlot));d.forEach((u,f)=>{let S=u.dataset.formationSlot,y=l.get(S);if(!y){we(u,s),o.insertBefore(u,o.children[f]||null);return}y!==o.children[f]&&o.insertBefore(y,o.children[f]||null);let $=u.outerHTML,v=Re($,n);(ne.get(y)||y.outerHTML)!==v&&(we(u,s),ne.set(u,v),y.replaceWith(u))}),c.forEach(u=>{m.has(u.dataset.formationSlot)||u.remove()})}function Do(e,t,n=""){let a=document.createElement("template");a.innerHTML=t;let o=e.querySelector(".formation-lane-cards"),r=a.content.querySelector(".formation-lane-cards");if(!o||!r){let c=ze(e);we(a.content,c),e.replaceChildren(a.content),Fo(e.querySelector(".formation-lane-cards"),n);return}let s=ze(e);Tt(o,r),Mo(o,Array.from(r.children),{imagesByKey:s,renderKey:n,getKey:Io})}function Dt(e){return e?Array.from(e.children).filter(t=>t.matches?.(".formation-slot[data-formation-slot]")):[]}function To(e,t=""){Dt(e).forEach(n=>{ne.set(n,Re(n.outerHTML,t))})}function Mo(e,t,n={}){let{imagesByKey:a=new Map,renderKey:o="",getKey:r}=n,s=Array.from(e.children),c=new Map(s.map((d,m)=>[r(d,m),d])),l=new Set(t.map((d,m)=>r(d,m)));t.forEach((d,m)=>{let u=r(d,m),f=c.get(u);if(!f){we(d,a),ne.set(d,Re(d.outerHTML,o)),e.insertBefore(d,e.children[m]||null);return}f!==e.children[m]&&e.insertBefore(f,e.children[m]||null);let S=d.outerHTML,y=Re(S,o);(ne.get(f)||f.outerHTML)!==y&&(we(d,a),ne.set(d,y),f.replaceWith(d))}),s.forEach((d,m)=>{l.has(r(d,m))||d.remove()})}function Fo(e,t=""){e&&Array.from(e.children).forEach(n=>{ne.set(n,Re(n.outerHTML,t))})}function Io(e,t=0){let n=e.dataset?.instanceId;if(n)return`demon:${n}`;let a=e.dataset?.collectionReinforcementPosition;return a?`collection-reinforcement:${a}`:e.classList?.contains("dungeon-hand-empty")?"empty:hand":`node:${t}`}function Re(e,t=""){return t?`${t}
${e}`:e}function ze(e){let t=new Map;return e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=Hn(n);a&&!t.has(a)&&t.set(a,n)}),t}function we(e,t){e.querySelectorAll(".dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img").forEach(n=>{let a=Hn(n),o=a?t.get(a):null;o&&(Tt(o,n),n.replaceWith(o),t.delete(a))})}function Hn(e){let n=e.closest(".dungeon-demon-card[data-instance-id]")?.dataset.instanceId,a=e.getAttribute("src")||"";return n&&a?`${n}|${a}`:""}function Tt(e,t){Array.from(e.attributes).forEach(n=>{t.hasAttribute(n.name)||e.removeAttribute(n.name)}),Array.from(t.attributes).forEach(n=>{e.getAttribute(n.name)!==n.value&&e.setAttribute(n.name,n.value)})}function xe(e){e&&(e.disabled=!1)}function ot(e){return e?e.charAt(0).toUpperCase()+e.slice(1):""}function k(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function On(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function Mt(e){return(e||[]).map(t=>({...t}))}var Ce=window.AmongDemons.audio,No="amongdemons:battle-intro-complete";var Gt=(...e)=>h.getDemonPosition(...e),_o=(...e)=>h.renderDemonStatus(...e),Ho=(...e)=>h.renderDungeonCenterActions(...e),Ft=(...e)=>h.renderFightLog(...e),Be=(...e)=>h.renderFightLogActions(...e),Ve=(...e)=>h.renderRun(...e);function Gn(e={}){if(!i.run)return null;let t=We(i.combatLog,{combineCounters:!0}),n={currentIndex:0,isPaused:!1,stepDirection:0,steps:t,totalSteps:t.length,waitResolve:null};return i.combatPlayback=n,i.isBattleAnimating=!0,e.render!==!1&&(Ve(),Ft()),n}async function it(e={}){if(!i.run)return;let t=e.combatPlayback,n=t&&i.combatPlayback===t?t:Gn({render:!1});if(!n)return;let a=n.steps||[];if(i.isBattleAnimating=!0,Ve(),Ft(),e.waitForBattleIntro){if(Ho({canFight:!0,isFighting:!0}),await Ce?.play("sfx.battle.battleStart",{volume:.9,waitForEnd:!0}),!i.run||i.combatPlayback!==n)return;window.dispatchEvent(new CustomEvent(No))}Ve(),Ft();try{for(;i.combatPlayback&&i.combatPlayback.currentIndex<a.length;){let o=await Wo();if(!o||!i.combatPlayback)break;if(o==="previous"){await Ko();continue}let r=i.combatPlayback.currentIndex,s=a[r];if(!s)break;X(!1),Vt(s,r,{animate:!0}),i.combatPlayback.currentIndex=r+1,Be(),await qn(V(Jt(s))),X(!!i.combatPlayback?.isPaused)}}finally{i.isBattleAnimating=!1,i.combatPlayback=null,X(!1),Ve()}lt(-1)}function Vt(e,t=-1,n={}){let a=Xo(),o=n.animate!==!1;if(e.entries.forEach(u=>{let f=a.get(u.target);f&&(f.hp=u.targetHp,u.effect==="poison_apply"&&(f.statusEffects=f.statusEffects||{},f.statusEffects.poison=Array.from({length:Math.max(1,Number(u.poisonStacks)||1)},()=>({}))),u.effect==="poison"&&Object.prototype.hasOwnProperty.call(u,"poisonStacks")&&(f.statusEffects=f.statusEffects||{},f.statusEffects.poison=Array.from({length:Math.max(0,Number(u.poisonStacks)||0)},()=>({}))))}),Wn(),!o){jn();return}lt(t);let r=oe(e.attacker),s=st(e),c=new Map(s.map((u,f)=>[u,f])),l=!!e.isAoe||s.length>1;Oo(e),e.primaryEffect!=="poison"&&Kn(e.attacker,e.primaryEffect,e.entries[0]?.target);let d=Go(e);d&&oa(e.attacker,d.targetIds,{effect:e.primaryEffect,travel:d.travel});let m=Vo(e);m&&Ut(e.attacker,m.targetId),e.entries.forEach(u=>{let f=c.get(u)??0;Vn(u,e,r,f,l,d,m)})}function Oo(e){let t=e.entries?.[0]||{},n=e.primaryEffect||t.effect;if(n==="poison"||n==="heal"||n==="last_breath"||n==="shared_pain")return;let a=null;if(n==="poison_apply")a="sfx.battle.abilities.poisonApply";else if(n==="retaliate"||n==="thorns")a="sfx.battle.abilities.thornsRetaliate";else{let o=Number(Z(e.attacker)?.typeId);a={1:"sfx.battle.abilities.meleeSwing",2:"sfx.battle.abilities.rangedProjectile",3:"sfx.battle.abilities.poisonApply",4:"sfx.battle.abilities.fireAoe",5:"sfx.battle.abilities.bruiserStrike",6:"sfx.battle.abilities.assassinStrike",7:"sfx.battle.abilities.cleave",8:"sfx.battle.abilities.thornsRetaliate",9:"sfx.battle.abilities.juggernautSlam",10:"sfx.battle.abilities.heal",11:"sfx.battle.abilities.chaosAttack"}[o]||"sfx.battle.abilities.meleeSwing"}Ce?.play(a,{volume:.72,minInterval:55}),!ae(t)&&(e.entries||[]).some(ae)&&Ce?.play("sfx.battle.abilities.thornsRetaliate",{volume:.66,minInterval:55})}var zo=new Set(["poison","heal","last_breath","shared_pain","poison_apply"]);function ae(e){return e?.effect==="retaliate"||e?.effect==="thorns"}function st(e){return(e.entries||[]).filter(t=>!ae(t))}function rt(e){return!ae(e)&&!zo.has(e.effect)}function Go(e){if(z()||e.targeting==="chaotic"||Number(Z(e.attacker)?.typeId)!==4)return null;let t=(e.entries||[]).filter(rt);return t.length?{targetIds:t.map(n=>n.target),travel:qe(t[0]).travel,lead:90}:null}function Vo(e){if(z()||Number(Z(e.attacker)?.typeId)!==7)return null;let t=(e.entries||[]).filter(rt);return t.length?{targetId:t[Math.floor((t.length-1)/2)].target}:null}function Vn(e,t,n,a,o,r=null,s=null){let c=z();if(e.effect==="poison"){$e(160,()=>{a===0&&Ce?.play("sfx.battle.abilities.poisonTick",{volume:.66,minInterval:80}),a===0&&Ge(e.target,nn(t),"poison",e.attacker,e.effect,{burstCount:t.entries.length}),me(e.target,e.targetHp,n,{hit:!1}),Ht(e.target,e.poisonStacks),Nt(e.target)});return}if(e.effect==="heal"){c||ia(e.attacker,e.target),$e(200,()=>{Ce?.play("sfx.battle.abilities.heal",{volume:.7,minInterval:80}),me(e.target,e.targetHp,n,{hit:!1,healing:e.healing}),Ge(e.target,e.healing,"heal",e.attacker,e.effect),_t(e.target)});return}if(e.effect==="last_breath"){$e(160,()=>{me(e.target,e.targetHp,n,{hit:!1}),Ge(e.target,1,"heal",e.attacker,e.effect),_t(e.target)});return}if(e.effect==="shared_pain"){me(e.target,e.targetHp,n,{hit:!1});return}if(e.effect==="poison_apply"){c||Le(t.attacker,e.target,{effect:e.effect,poison:!0,bubbles:15,variant:"poison-flame"}),$e(220,()=>{Ht(e.target,e.poisonStacks||1),me(e.target,e.targetHp,n),It(e.target,{attackerId:e.attacker,effect:e.effect,variant:"poison"}),Nt(e.target)});return}let l=qe(e),d=r&&rt(e),m=s&&rt(e),u=d||m,f=!ae(e)||qo(e,t);!c&&!u&&f&&l.draw();let S=d?r.travel+r.lead+a*50:l.travel+(o?a*70:0);$e(S,()=>{me(e.target,e.targetHp,n),Number(e.dmg)>0&&Ge(e.target,e.dmg,la(e.attacker)?"dark":"damage",e.attacker,e.effect),It(e.target,{attackerId:e.attacker,effect:e.effect,heavy:l.heavy,variant:l.key,aoe:o&&!ae(e)}),ea(e.target,l.heavy),l.screenShake&&ta(),na(e.target,e.targetHp)})}function qo(e,t){if(!ae(e))return!0;let n=(t?.entries||[]).filter(ae),a=n.filter(r=>r.effect==="retaliate"||Yo(r.attacker));return(a.length?a:n).find(r=>r.attacker===e.attacker)===e}function Yo(e){let t=Z(e)||{},n=String(t.role||"").toLowerCase(),a=String(t.abilityKind||t.ability_kind||t.ability?.kind||"").toLowerCase();return Number(t.typeId)===8||n==="counter_tank"||a==="retaliate"}async function Wo(){for(;i.combatPlayback?.isPaused;){X(!0);let e=Number(i.combatPlayback.stepDirection)||0;if(i.combatPlayback.stepDirection=0,e<0)return"previous";if(e>0)return i.combatPlayback.currentIndex<i.combatPlayback.totalSteps?"next":null;await jo()}return X(!1),i.combatPlayback?"play":null}function qn(e){let t=i.combatPlayback;return t?new Promise(n=>{let a=window.setTimeout(o,Math.max(0,Number(e)||0));function o(){window.clearTimeout(a),t.waitResolve===o&&(t.waitResolve=null),n()}t.waitResolve=o}):Promise.resolve()}function jo(){let e=i.combatPlayback;return e?new Promise(t=>{e.waitResolve=()=>{e.waitResolve=null,t()}}):Promise.resolve()}function qt(){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!0,X(!0),ct(),Be())}function Yt(){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!1,i.combatPlayback.stepDirection=0,X(!1),ct(),Be())}function Wt(e){!i.combatPlayback||!i.isBattleAnimating||(i.combatPlayback.isPaused=!0,i.combatPlayback.stepDirection=Number(e)<0?-1:1,X(!0),ct(),Be())}function jt(){let e=i.combatPlayback;!i.run||!e||!i.isBattleAnimating||(e.isPaused=!1,e.stepDirection=0,Yn(e.totalSteps),X(!1),ct())}function ct(){let e=i.combatPlayback?.waitResolve;e&&e()}function Yn(e){if(!i.run||!i.combatPlayback)return;Zo(),Uo();let t=i.combatPlayback.steps||[],n=Kt(Math.floor(Number(e)||0),0,t.length);for(let a=0;a<n;a+=1)Vt(t[a],a,{animate:!1});i.combatPlayback.currentIndex=n,Ve(),lt(n>0?n-1:-1)}async function Ko(){let e=i.combatPlayback;if(!i.run||!e||e.currentIndex<=0)return;let t=e.steps||[],n=Kt(e.currentIndex-2,0,t.length-1),a=t[n];a&&(Yn(n),X(!1),Vt(a,n,{animate:!0}),e.currentIndex=n+1,Be(),await qn(V(Jt(a))),i.combatPlayback&&(i.combatPlayback.isPaused=!0,X(!0),Be()))}function Uo(){let e=i.run?.lastBattle||{};i.run.team=Mt(e.playerTeamBefore||i.run.team||[]),i.run.enemies=Mt(e.enemyTeamBefore||i.run.enemies||[]),i.combatDemons=je()}function Xo(){return new Map([...i.run?.team||[],...i.run?.enemies||[]].map(e=>[e.instanceId,e]))}function Zo(){ar(),document.querySelectorAll([".attack-zap",".chaos-lightning",".combat-impact-burst",".dark-spike",".fireball-shot",".fire-nova",".floating-combat-number",".heal-effect",".sword-swing",".thorn-burst"].join(",")).forEach(e=>e.remove()),document.querySelector(".dungeon-arena")?.classList.remove("is-combat-screenshake")}function X(e){let t=!!e;document.documentElement.classList.toggle("is-combat-paused",t),t?tr():nr()}function Kt(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}function Wn(){i.run&&(i.run.hp=(i.run.team||[]).reduce((e,t)=>e+Math.max(0,Number(t.hp)||0),0))}function jn(){[...i.run?.team||[],...i.run?.enemies||[]].forEach(e=>{me(e.instanceId,e.hp)})}function lt(e){document.querySelectorAll(".fight-log-row").forEach(t=>{t.classList.toggle("active",Number(t.dataset.logIndex)===e)})}function Kn(e,t,n){let a=C(e);a&&(Zt(a,Xt(e,t)),a.classList.toggle("is-player-attack",oe(e)==="player"),a.classList.toggle("is-enemy-attack",oe(e)==="enemy"),Jo(a,n),ge(a,"is-attacking",320))}function Jo(e,t){if(z()||!t){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let n=C(t);if(!n){e.style.setProperty("--lunge-x","0px"),e.style.setProperty("--lunge-y","0px");return}let a=e.getBoundingClientRect(),o=n.getBoundingClientRect(),r=o.left+o.width/2-(a.left+a.width/2),s=o.top+o.height/2-(a.top+a.height/2),c=Math.hypot(r,s)||1,l=Math.min(18,c*.26);e.style.setProperty("--lunge-x",`${(r/c*l).toFixed(1)}px`),e.style.setProperty("--lunge-y",`${(s/c*l).toFixed(1)}px`)}function qe(e){let{attacker:t,target:n,effect:a}=e;if(ae(e))return{key:"thorn",travel:210,heavy:!1,screenShake:!1,draw:()=>Ot(t,n)};if(e.targeting==="chaotic")return{key:"chaotic",travel:150,heavy:!0,screenShake:!1,draw:()=>sa(t,n)};let o=Number(Z(t)?.typeId);return{2:{key:"dark",travel:200,heavy:!1,draw:()=>ca(t,n)},4:{key:"fire",travel:380,heavy:!0,screenShake:!1,draw:()=>aa(t,n,{effect:a})},5:{key:"sniper",travel:360,heavy:!0,draw:()=>Le(t,n,{effect:a,variant:"heavy",duration:520})},6:{key:"assassin",travel:120,heavy:!1,draw:()=>Le(t,n,{effect:a,variant:"assassin",duration:240})},7:{key:"melee",travel:170,heavy:!1,draw:()=>Ut(t,n)},8:{key:"thorn",travel:210,heavy:!1,draw:()=>Ot(t,n)},9:{key:"crushing",travel:620,heavy:!0,screenShake:!0,draw:()=>Le(t,n,{effect:a,variant:"crushing",duration:960})}}[o]||{key:"melee",travel:150,heavy:!1,draw:()=>Le(t,n,{effect:a})}}function Qo(e){qe(e).draw()}function z(){return!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)}var Ae=new Set;function Un(){return window.performance?.now?.()??Date.now()}function $e(e,t){let n=V(e);if(z()||n<=0){t();return}let a={fn:t,remaining:n,startedAt:0,handle:null};a.run=()=>{a.handle=null,Ae.delete(a),a.fn()},Ae.add(a),er()||Xn(a)}function Xn(e){e.startedAt=Un(),e.handle=window.setTimeout(e.run,e.remaining)}function er(){return document.documentElement.classList.contains("is-combat-paused")}function tr(){Ae.forEach(e=>{e.handle!=null&&(window.clearTimeout(e.handle),e.handle=null,e.remaining=Math.max(0,e.remaining-(Un()-e.startedAt)))})}function nr(){Ae.forEach(e=>{e.handle==null&&Xn(e)})}function ar(){Ae.forEach(e=>{e.handle!=null&&window.clearTimeout(e.handle)}),Ae.clear()}function It(e,t={}){if(z())return;let n=C(e);if(!n)return;let a=n.getBoundingClientRect(),o=q(["combat-impact-burst",t.heavy?"is-heavy":"",t.aoe?"is-aoe":"",`is-${t.variant||"melee"}`].filter(Boolean).join(" "),t.attackerId,t.effect);o.style.left=`${(a.left+a.width/2).toFixed(1)}px`,o.style.top=`${(a.top+a.height/2).toFixed(1)}px`;let r=t.heavy?520:380;o.style.setProperty("--fx-duration",`${V(r)}ms`);let s=t.heavy?9:6,c=t.heavy?26:17,l=Array.from({length:s},(d,m)=>{let u=360/s*m+(m%2?14:-10),f=c+m%3*5;return`<span class="combat-impact-particle" style="--p-angle:${u.toFixed(0)}deg;--p-dist:${f}px;animation-delay:${V(m*6)}ms"></span>`}).join("");o.innerHTML=`<span class="combat-impact-core"></span>${t.aoe?'<span class="combat-impact-ring"></span>':""}${l}`,Y(o,r)}function Zn(e){try{return localStorage.getItem(e)!=="0"}catch{return!0}}function Jn(){return Zn(Fn)}function Qn(){return Zn(Mn)}function ea(e,t){if(z())return;let n=C(e);if(!n)return;let a=Jn();ge(n,t&&a?"is-shaking":"is-hit",t&&a?360:240)}function Nt(e){if(z())return;let t=C(e);t&&ge(t,"is-poison-tick",520)}function _t(e){if(z())return;let t=C(e);t&&ge(t,"is-healed",520)}var zn=0;function ta(){if(z()||!Qn())return;let e=window.performance?.now?.()??Date.now();if(e-zn<140)return;zn=e;let t=document.querySelector(".dungeon-arena");t&&ge(t,"is-combat-screenshake",360)}function na(e,t){if(Number(t)>0)return;let n=C(e);!n||n.classList.contains("is-dying")||(Ce?.playDeath(),!z()&&ge(n,"is-dying",620))}function Le(e,t,n={}){let a=C(e),o=C(t);if(!a||!o)return;let{attackerRect:r,startX:s,startY:c,endX:l,endY:d}=Ye(a,o),m=Z(e),u=m&&Gt(m)==="back",f=u?.12:.22,S=u?.9:.78,y=s+(l-s)*f,$=c+(d-c)*f,v=s+(l-s)*S,P=c+(d-c)*S,A=(y+v)/2,M=($+P)/2,T=-(P-$)/Math.max(1,Math.hypot(v-y,P-$)),I=(v-y)/Math.max(1,Math.hypot(v-y,P-$)),U=u?10:6,ee=A+T*U,te=M+I*U,le=Number(n.bubbles)||0,Se=le?Array.from({length:le},(be,O)=>{let L=.08+O/Math.max(1,le-1)*.84,ye=(1-L)*(1-L)*y+2*(1-L)*L*ee+L*L*v,Bt=(1-L)*(1-L)*$+2*(1-L)*L*te+L*L*P,He=(O%2?-1:1)*(4+O%4),G=2.2+O%4*.8;return`<circle class="poison-bubble" cx="${(ye+T*He).toFixed(1)}" cy="${(Bt+I*He).toFixed(1)}" r="${G.toFixed(1)}" style="animation-delay: ${V(O*18).toFixed(0)}ms" />`}).join(""):"",H=Number(n.flames)||0,B=H?Array.from({length:H},(be,O)=>{let L=.08+O/Math.max(1,H-1)*.84,ye=(1-L)*(1-L)*y+2*(1-L)*L*ee+L*L*v,Bt=(1-L)*(1-L)*$+2*(1-L)*L*te+L*L*P,He=(O%2?-1:1)*(5+O%3*2),G=5+O%4,ve=ye+T*He,ke=Bt+I*He;return`<path class="fire-spark" d="M ${ve.toFixed(1)} ${(ke-G).toFixed(1)} C ${(ve+G*.72).toFixed(1)} ${(ke-G*.2).toFixed(1)} ${(ve+G*.45).toFixed(1)} ${(ke+G*.72).toFixed(1)} ${ve.toFixed(1)} ${(ke+G).toFixed(1)} C ${(ve-G*.55).toFixed(1)} ${(ke+G*.42).toFixed(1)} ${(ve-G*.45).toFixed(1)} ${(ke-G*.32).toFixed(1)} ${ve.toFixed(1)} ${(ke-G).toFixed(1)} Z" style="animation-delay: ${V(O*16).toFixed(0)}ms" />`}).join(""):"",de=q(["attack-zap",oe(e)==="player"?"is-player-attack":"is-enemy-attack",u?"is-back-attack":"",n.variant?`is-${n.variant}`:"",n.poison?"is-poison-apply":""].filter(Boolean).join(" "),e,n.effect);de.innerHTML=re(`
      <path class="attack-zap-trail" d="M ${y.toFixed(1)} ${$.toFixed(1)} Q ${ee.toFixed(1)} ${te.toFixed(1)} ${v.toFixed(1)} ${P.toFixed(1)}" />
      ${n.variant==="assassin"?`<path class="attack-zap-trail attack-zap-trail-secondary" d="M ${(y+T*7).toFixed(1)} ${($+I*7).toFixed(1)} Q ${(ee+T*7).toFixed(1)} ${(te+I*7).toFixed(1)} ${(v+T*7).toFixed(1)} ${(P+I*7).toFixed(1)}" />`:""}
      ${Se}
      ${B}
      <circle class="attack-zap-impact" cx="${v.toFixed(1)}" cy="${P.toFixed(1)}" r="${u?5:4}" />
  `),Y(de,n.duration||320)}function aa(e,t,n={}){let a=C(e),o=C(t);if(!a||!o)return;let{attackerRect:r,targetRect:s,startX:c,startY:l,endX:d,endY:m,angle:u}=Ye(a,o),f=Z(e),S=f&&Gt(f)==="back",y=Math.min(r.width*(S?.28:.42),46),$=Math.min(s.width*.18,22),v=c+Math.cos(u)*y,P=l+Math.sin(u)*y,A=d-Math.cos(u)*$,M=m-Math.sin(u)*$,T=Math.max(1,Math.hypot(A-v,M-P)),I=-(M-P)/T,U=(A-v)/T,ee=Math.max(12,Math.min(24,s.width*.18)),te=8,le=Array.from({length:te},(H,B)=>{let de=.12+B/Math.max(1,te-1)*.72,be=(B%2?-1:1)*(4+B%3*2),O=v+(A-v)*de+I*be,L=P+(M-P)*de+U*be,ye=1.8+B%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${L.toFixed(1)}" r="${ye.toFixed(1)}" style="animation-delay: ${V(70+B*28).toFixed(0)}ms" />`}).join(""),Se=q(["fireball-shot",oe(e)==="player"?"is-player-attack":"is-enemy-attack",S?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);Se.innerHTML=re(`
      ${le}
      <g class="fireball-projectile" style="--fireball-start-x: ${v.toFixed(1)}px; --fireball-start-y: ${P.toFixed(1)}px; --fireball-end-x: ${A.toFixed(1)}px; --fireball-end-y: ${M.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="8.5" />
        <circle class="fireball-hot" cx="3.6" cy="-2.2" r="4.2" />
      </g>
      <circle class="fireball-impact" cx="${A.toFixed(1)}" cy="${M.toFixed(1)}" r="${ee.toFixed(1)}" />
  `),Y(Se,620)}function oa(e,t,n={}){let a=C(e),o=(t||[]).map(C).filter(Boolean);if(z()||!a||!o.length)return;let r=a.getBoundingClientRect(),s=r.left+r.width/2,c=r.top+r.height/2,l=o.map(H=>{let B=H.getBoundingClientRect();return{x:B.left+B.width/2,y:B.top+B.height/2,half:Math.max(B.width,B.height)/2}}),d=l.reduce((H,B)=>H+B.x,0)/l.length,m=l.reduce((H,B)=>H+B.y,0)/l.length,u=Math.atan2(m-c,d-s),f=Z(e),S=f&&Gt(f)==="back",y=Math.min(r.width*(S?.28:.42),46),$=s+Math.cos(u)*y,v=c+Math.sin(u)*y,P=d,A=m,M=Math.max(1,Math.hypot(P-$,A-v)),T=-(A-v)/M,I=(P-$)/M,U=Kt(Math.max(...l.map(H=>Math.hypot(H.x-d,H.y-m)+H.half))+8,44,220),ee=9,te=Array.from({length:ee},(H,B)=>{let de=.12+B/Math.max(1,ee-1)*.72,be=(B%2?-1:1)*(4+B%3*2),O=$+(P-$)*de+T*be,L=v+(A-v)*de+I*be,ye=1.8+B%3*.8;return`<circle class="fireball-ember" cx="${O.toFixed(1)}" cy="${L.toFixed(1)}" r="${ye.toFixed(1)}" style="animation-delay: ${V(70+B*28).toFixed(0)}ms" />`}).join(""),le=q(["fireball-shot",oe(e)==="player"?"is-player-attack":"is-enemy-attack",S?"is-back-attack":""].filter(Boolean).join(" "),e,n.effect);le.innerHTML=re(`
      ${te}
      <g class="fireball-projectile" style="--fireball-start-x: ${$.toFixed(1)}px; --fireball-start-y: ${v.toFixed(1)}px; --fireball-end-x: ${P.toFixed(1)}px; --fireball-end-y: ${A.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="11" />
      </g>
  `),Y(le,620);let Se=Number(n.travel)||380;$e(Se,()=>ra(d,m,U,e,n.effect))}function ra(e,t,n,a,o){if(z())return;let r=Math.max(20,Number(n)||60),s=q("fire-nova",a,o),c=`fire-nova-grad-${Math.random().toString(36).slice(2,8)}`;s.innerHTML=re(`
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
  `),Y(s,620)}function me(e,t,n="unknown",a={}){let o=C(e);if(!o)return;let r=o.querySelector(".js-demon-hp");r&&(r.textContent=t);let s=o.querySelector(".js-demon-hp-fill");if(s){let c=Number(s.dataset.maxHp)||Number(t)||1,l=Math.max(0,Math.min(100,Math.round(Number(t)/c*100)));s.style.width=`${l}%`}o.classList.toggle("is-defeated",Number(t)<=0)}function Ht(e,t){let n=C(e);if(!n)return;let a=n.querySelector(".demon-status-poison");if(Number(t)<=0){n.querySelector(".demon-status-strip")?.remove(),n.classList.remove("is-poisoned");return}n.classList.add("is-poisoned"),n.querySelector(".demon-status-strip")?.remove(),n.insertAdjacentHTML("beforeend",_o({statusEffects:{poison:Array.from({length:Math.max(1,Number(t)||1)},()=>({}))}}))}function Ge(e,t,n,a,o,r={}){let s=C(e);if(!s)return;let c=s.getBoundingClientRect(),l=q(`floating-combat-number is-${n}`,a,o||n);if(l.style.left=`${(c.left+c.width/2).toFixed(1)}px`,l.style.top=`${Math.max(6,c.top+c.height*.08).toFixed(1)}px`,l.innerHTML=n==="heal"?`+${k(t)}`:`-${k(t)}`,n==="poison"&&Number(r.burstCount)>1){let d=Math.max(1,Number(r.burstCount)||1),m=Math.min(2.2,1+(d-1)*.12);l.style.fontSize=`calc(1.22rem * ${m.toFixed(2)})`}Y(l,760)}function Ut(e,t){let n=C(e),a=C(t);if(!n||!a)return;let{attackerRect:o,startX:r,startY:s,endX:c,endY:l,angle:d}=Ye(n,a),m=Math.max(70,o.height*.92),u=Math.max(18,o.width*.2),f=o.width*.58,S=r+Math.cos(d)*f,y=s+Math.sin(d)*f,$=Math.max(22,o.width*.26),v=q("sword-swing",e);v.innerHTML=re(`
      ${[-.18,0,.18].map((P,A)=>{let M=S+Math.cos(d+Math.PI/2)*m*P,T=y+Math.sin(d+Math.PI/2)*m*P,I=`M ${M.toFixed(1)} ${(T-m*.34).toFixed(1)} Q ${(M+u).toFixed(1)} ${T.toFixed(1)} ${M.toFixed(1)} ${(T+m*.34).toFixed(1)}`,U=`rotate(${(d*180/Math.PI).toFixed(1)} ${M.toFixed(1)} ${T.toFixed(1)}) translate(${$.toFixed(1)} 0)`;return`<path class="sword-swing-belly sword-scratch-${A+1}" d="${I}" transform="${U}" /><path class="sword-swing-arc sword-scratch-${A+1}" d="${I}" transform="${U}" />`}).join("")}
  `),Y(v,440)}function Ot(e,t){let n=C(e),a=C(t);if(!n||!a)return;let{attackerRect:o,startX:r,startY:s,angle:c}=Ye(n,a),l=Math.max(42,o.width*.5),d=r+Math.cos(c)*l,m=s+Math.sin(c)*l,u=Math.max(22,o.width*.28),f=q("thorn-burst",e),S=[-.48,-.28,-.1,.1,.28,.48];f.innerHTML=re(`
      ${S.map((y,$)=>{let v=c+y,P=u*(.74+$%2*.16),A=o.height*.82,M=d+Math.cos(c+Math.PI/2)*($/(S.length-1)-.5)*A,T=m+Math.sin(c+Math.PI/2)*($/(S.length-1)-.5)*A,I=M+Math.cos(v)*P,U=T+Math.sin(v)*P;return`<path class="thorn-spike" d="M ${M.toFixed(1)} ${T.toFixed(1)} L ${I.toFixed(1)} ${U.toFixed(1)}" />`}).join("")}
  `),Y(f,520)}function or(e){let t=C(e);t&&ge(t,"is-shaking",360)}function ia(e,t){let n=C(t);if(!n)return;let a=n.getBoundingClientRect(),o=a.left+a.width/2,r=a.top+a.height/2,s=Math.max(18,a.width*.18),c=q("heal-effect",e,"heal");c.innerHTML=re(`
      <circle class="heal-ring" cx="${o.toFixed(1)}" cy="${r.toFixed(1)}" r="${s.toFixed(1)}" />
      <circle class="heal-ring heal-ring-secondary" cx="${(o-s*.6).toFixed(1)}" cy="${(r+s*.16).toFixed(1)}" r="${(s*.72).toFixed(1)}" />
      <circle class="heal-ring heal-ring-tertiary" cx="${(o+s*.58).toFixed(1)}" cy="${(r-s*.14).toFixed(1)}" r="${(s*.58).toFixed(1)}" />
  `),Y(c,620)}function sa(e,t){let n=C(t);if(!n)return;let a=n.getBoundingClientRect(),o=a.left+a.width/2,r=Math.max(0,a.top-Math.min(170,window.innerHeight*.24)),s=a.top+a.height*.56,c=a.top+a.height*.26,l=q("chaos-lightning is-thunderstrike",e),d=`M ${(o-12).toFixed(1)} ${r.toFixed(1)} L ${(o+10).toFixed(1)} ${(r+42).toFixed(1)} L ${(o-8).toFixed(1)} ${(r+42).toFixed(1)} L ${(o+7).toFixed(1)} ${(c+10).toFixed(1)} L ${(o-16).toFixed(1)} ${(c+10).toFixed(1)} L ${(o+4).toFixed(1)} ${s.toFixed(1)}`,m=`M ${(o+7).toFixed(1)} ${(c-4).toFixed(1)} L ${(o+34).toFixed(1)} ${(c+10).toFixed(1)} L ${(o+14).toFixed(1)} ${(c+18).toFixed(1)}`,u=`M ${(o-4).toFixed(1)} ${(c+22).toFixed(1)} L ${(o-35).toFixed(1)} ${(c+34).toFixed(1)} L ${(o-13).toFixed(1)} ${(c+43).toFixed(1)}`;l.innerHTML=re(`
      <path class="chaos-thunder-border chaos-thunder-core" d="${d}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${m}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${u}" />
      <path class="chaos-thunder-core" d="${d}" />
      <path class="chaos-thunder-branch" d="${m}" />
      <path class="chaos-thunder-branch" d="${u}" />
  `),Y(l,360)}function ca(e,t){let n=C(e),a=C(t);if(!n||!a)return;let o=n.getBoundingClientRect(),r=a.getBoundingClientRect(),s=o.left+o.width/2,c=o.top+o.height/2,l=r.left+r.width/2,d=r.top+r.height/2,m=Math.atan2(d-c,l-s),u=Math.max(24,Math.hypot(l-s,d-c)),f=q("dark-spike",e);f.style.left=`${s}px`,f.style.top=`${c}px`,f.style.width=`${u}px`,f.style.setProperty("--dark-spike-angle",`${m}rad`),Y(f,340)}function Xt(e,t){if(t==="poison"||t==="poison_apply")return Oe.poison;if(t==="heal")return Oe.heal;let n=Number(Z(e)?.typeId);return Oe[n]||Oe.default}function Zt(e,t){!e||!t||(e.style.setProperty("--combat-color",t.color),e.style.setProperty("--combat-shadow",t.shadow),e.style.setProperty("--combat-text-outline",t.outline||"#fff"))}function q(e,t,n){let a=document.createElement("div");return a.className=e,Zt(a,Xt(t,n)),a}function Y(e,t,n=document.body){return n.appendChild(e),setTimeout(()=>e.remove(),V(t)),e}function re(e){return`<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">${e}</svg>`}function Ye(e,t){let n=e.getBoundingClientRect(),a=t.getBoundingClientRect(),o=n.left+n.width/2,r=n.top+n.height/2,s=a.left+a.width/2,c=a.top+a.height/2;return{attackerRect:n,targetRect:a,startX:o,startY:r,endX:s,endY:c,angle:Math.atan2(c-r,s-o)}}function Jt(e){let t=e.entries||[],n=st(e),a=new Map(n.map((s,c)=>[s,c])),o=!!e.isAoe||n.length>1,r=240;return Math.max(340,...t.map(s=>{if(s.effect==="heal"||s.effect==="last_breath")return 500;if(s.effect==="poison")return 380;if(s.effect==="poison_apply")return 460;if(s.effect==="shared_pain")return 320;let c=a.get(s)??0,l=o?c*70:0;return qe(s).travel+l+r}))}function Qt(e){Pe.includes(e)&&(i.battleSpeed=e,localStorage.setItem(nt,String(e)),dt(),ut())}function dt(){document.documentElement.style.setProperty("--battle-animation-scale",String(en())),[24,34,36,48,80,150,240,320,340,360,440,520,620,760,960].forEach(e=>{document.documentElement.style.setProperty(`--battle-duration-${e}`,`${V(e)}ms`)})}function en(){return 1/(Number(i.battleSpeed)||1)}function V(e){return Math.max(0,Math.round((Number(e)||0)*en()))}function rr(e){return`${Number(e)}x`}function ut(){document.querySelectorAll("[data-battle-speed]").forEach(e=>{let t=Number(e.dataset.battleSpeed)===i.battleSpeed;e.classList.toggle("active",t),e.classList.toggle("ad-primary-action",t),e.setAttribute("aria-pressed",t?"true":"false")})}function la(e){return Number(Z(e)?.typeId)===2}function C(e){let t=`.dungeon-demon-card[data-instance-id="${On(String(e))}"]`;return document.querySelector(`#teamGrid ${t}, #enemyGrid ${t}`)||document.querySelector(t)}function ge(e,t,n){let a=`${t}Timer`;e[a]&&clearTimeout(e[a]),e.classList.remove(t),e.offsetWidth,e.classList.add(t),e[a]=setTimeout(()=>{e.classList.remove(t),(t==="is-attacking"||t==="is-hit")&&e.classList.remove("is-player-attack","is-enemy-attack"),e[a]=null},V(n))}function tn(e,t){let n=e.entries[0],a=Number.isInteger(e.playbackIndex)?e.playbackIndex:t,o=ga(e),r=n.effect==="poison_apply"?"Poisoned":n.effect==="heal"?`${n.targetHp} HP`:e.isAoe?"AOE":`${n.targetHp} HP`;return`
    <div class="fight-log-row ${fa(n)}" data-log-index="${a}">
      <span class="text-secondary">T${n.tick}</span>
      <span class="fight-log-side">${pa(n)}</span>
      <span class="fight-log-action">${ua(e)}</span>
      <span class="fight-log-damage">${o}</span>
      <span class="text-secondary">${r}</span>
    </div>
  `}function We(e,t={}){let n=[],a=t.combineCounters===!0;for(let o of e||[]){let r=n[n.length-1],s=o.targeting==="all"||o.targeting==="cleave"?[...n].reverse().find(u=>u.isAoe&&u.tick===o.tick&&u.attacker===o.attacker):null,l=o.effect==="thorns"||a&&o.effect==="retaliate"?[...n].reverse().find(u=>u.tick===o.tick&&u.entries.some(f=>f.attacker===o.target&&f.target===o.attacker)):null,d=o.effect==="poison"&&r?.primaryEffect==="poison"&&r.tick===o.tick&&r.entries.every(u=>u.target===o.target),m=s||l||(d?r:null);if(m){m.entries.push(o);continue}n.push({tick:o.tick,attacker:o.attacker,isAoe:o.targeting==="all"||o.targeting==="cleave",primaryEffect:o.effect||null,entries:[o]})}if(!a){let o=We(e,{combineCounters:!0}),r=new Map;o.forEach((s,c)=>{s.entries.forEach(l=>r.set(l,c))}),n.forEach(s=>{s.playbackIndex=r.get(s.entries[0])})}return n}function da(e){return e?`<span class="fight-log-position">${e==="front"?"Front":"Back"}</span>`:""}function ua(e){let t=e.entries[0],n=st(e).length,a=zt(t.attacker),o=`${zt(t.target)} ${da(t.targetPosition)}`;return t.effect==="poison_apply"?`${a} applied poison to ${o}`:t.effect==="poison"?`${o} took poison damage`:t.effect==="heal"?`${a} healed ${o}`:t.effect==="last_breath"?`${o} survived at 1 HP`:t.effect==="shared_pain"?"Surviving allies gained direct damage":t.effect==="chain_explosion"?`${a} exploded into ${o}`:t.effect==="retaliate"?`${a} retaliated against ${o}`:t.effect==="thorns"?`${a} reflected damage to ${o}`:t.knockback?`${a} crushed ${o} back`:t.targeting==="chaotic"?`${a} chaotically struck ${o}`:t.targeting==="cleave"?`${a} cleaved ${n} demons`:e.isAoe?`${a} splashed ${n} enemies`:`${a} ${ma(t)} ${o}`}function ma(e){return e.effect==="poison_apply"||e.effect==="poison"?"poisoned":e.effect==="heal"?"healed":e.effect==="last_breath"?"survived":e.effect==="shared_pain"?"empowered":e.effect==="chain_explosion"?"exploded into":e.effect==="retaliate"?"retaliated against":e.effect==="thorns"?"reflected damage to":e.targeting==="chaotic"?"chaotically struck":e.targeting==="cleave"?"cleaved":e.targeting==="all"?"splashed":"hit"}function ga(e){let t=e.entries[0],n=st(e).length,a=e.entries.find(o=>o.effect==="retaliate"||o.effect==="thorns");if(t.effect==="poison_apply")return"poison";if(t.effect==="poison")return`${nn(e)} poison`;if(t.effect==="heal")return`+${t.healing||0} hp`;if(t.effect==="last_breath")return"1 hp";if(t.effect==="shared_pain")return"+25% dmg";if(t.effect==="chain_explosion")return`${t.dmg||0} splash`;if(t.effect==="thorns")return`${t.dmg||0} thorns`;if(t.effect==="retaliate")return`${t.dmg||0} retaliation`;if(a){let o=a.effect==="thorns"?"thorns":"retaliation";return`${t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}, ${a.dmg} ${o}`}return t.knockback?`${t.dmg} dmg, push`:t.targeting==="cleave"?`${n} x ${t.dmg} cleave`:e.isAoe?`${n} x ${t.dmg} dmg`:`${t.dmg} dmg`}function nn(e){return(e.entries||[]).filter(t=>t.effect==="poison").reduce((t,n)=>t+(Number(n.dmg)||0),0)}function je(){return new Map([...(i.run?.team||[]).map(e=>[e.instanceId,{...e,side:"player"}]),...(i.run?.enemies||[]).map(e=>[e.instanceId,{...e,side:"enemy"}])])}function fa(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||oe(e.attacker)==="player"?"is-player-action":"is-enemy-action"}function pa(e){return e.effect==="chain_explosion"||e.effect==="shared_pain"||e.effect==="last_breath"||oe(e.attacker)==="player"?"You":"Enemy"}function oe(e){return(i.run?.team||[]).some(t=>t.instanceId===e)?"player":(i.run?.enemies||[]).some(t=>t.instanceId===e)?"enemy":i.combatDemons.get(e)?.side?i.combatDemons.get(e).side:"unknown"}function Z(e){return[...i.run?.team||[],...i.run?.enemies||[]].find(t=>t.instanceId===e)||i.combatDemons.get(e)||null}function zt(e){let t=[...i.run?.team||[],...i.run?.enemies||[]].find(n=>n.instanceId===e)||i.combatDemons.get(e);return t?`<span class="ad-${k(t.rarity)}">${k(t.species||"Demon")}</span>`:k(e)}var ba=(...e)=>h.getCollectionReinforcementLimit(...e),ir=(...e)=>h.getExplicitFormationRow(...e),sr=(...e)=>h.getRecruitTeamLimit(...e);var ya=(...e)=>h.getSelectedCollectionReinforcements(...e),on=(...e)=>h.normalizeFormationRow(...e),cr=(...e)=>h.shouldShowCollectionMissingTag(...e);function rn(e,t={}){let n=t.side==="enemy"?"enemy":"player",a=lr(e||[],n),o=t.gridStyle?` style="${k(t.gridStyle)}"`:"";return`
    <div class="battle-formation battle-formation-grid battle-formation-${n}"${o} role="list" aria-label="${n==="enemy"?"Enemy":"Your team"} formation">
      ${a.map((r,s)=>sn(r,s,t,n)).join("")}
    </div>
  `}function sn(e,t,n,a){let o=mt(t,a),r=mr(t,a),s=ur[r]||"",c=t+1,l=n.side==="enemy"?"Enemy":"Your team",d=hr(n)?br(o):"",m=!e&&pr(n,a),u=e?vr(e,n):d||fr(o,c,{collectionTeamTrigger:m});return`
    <div class="formation-slot formation-lane formation-slot-${o} ${s} ${e?"has-demon":"is-empty"}" data-formation-position="${o}" data-formation-lane="${r}" data-formation-row="${t}" data-formation-slot="${t}" role="listitem" aria-label="${k(`${l} slot ${c}`)}">
      <div class="formation-lane-cards formation-slot-cards" data-formation-drop="${o}" data-formation-row="${t}">
        ${u}
      </div>
    </div>
  `}function lr(e=[],t="player"){let n=Array.from({length:9},()=>null),a=[],o=[];return(e||[]).slice(0,9).forEach((r,s)=>{let c=ir(r),l=c!==null?mt(c,t):null,d={...r,position:l||Pr(r,s)};if(c!==null&&!n[c]&&mt(c,t)===d.position){n[c]=d;return}a.push({demon:d,preferredCell:on(s)})}),a.forEach(({demon:r,preferredCell:s})=>{if(!n[s]&&mt(s,t)===r.position){n[s]=r;return}o.push(r)}),o.forEach(r=>{let s=dr(n,t,r.position);s>=0&&(n[s]=r)}),n}function dr(e,t="player",n=null){for(let a of gr(t,n))if(!e[a])return a;return e.findIndex(a=>!a)}function mt(e,t="player"){let n=on(e)%3,a=t==="enemy"?0:2;return n===a?"front":"back"}var ur={front:"frontline",mid:"middleline",back:"backline"};function mr(e,t="player"){let n=on(e)%3,a=t==="enemy"?0:2,o=t==="enemy"?2:0;return n===a?"front":n===o?"back":"mid"}function gr(e="player",t=null){let n=e==="enemy"?0:2,a=1,o=e==="enemy"?2:0;return(e==="enemy"?t==="front"?[n,a]:t==="back"?[o,a]:[n,a,o]:t==="front"?[n]:t==="back"?[a,o]:[n,a,o]).flatMap(s=>Array.from({length:3},(c,l)=>l*3+s))}function fr(e,t,n={}){return n.collectionTeamTrigger?`
      <button class="formation-empty formation-empty-${e} collection-reinforcement-team-slot" type="button" data-slot-number="${t}" aria-label="Add a Collection demon to team slot ${t}" title="Add from collection">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </button>
    `:`
    <div class="formation-empty formation-empty-${e}" aria-hidden="true" data-slot-number="${t}">
      <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
    </div>
  `}function pr(e,t){return!!(t==="player"&&e.side==="player"&&i.isRecruiting&&i.run?.awaitingRecruit&&i.run?.collectionReinforcementAvailable&&(i.recruitDraftTeam||[]).length<sr()&&ya().length<ba())}function hr(e){return!!(i.isRecruiting&&e.side==="hand"&&i.run?.collectionReinforcementAvailable&&ya().length<ba())}function br(e){return`
    <button class="dungeon-demon-card collection-reinforcement-placeholder ${i.collectionReinforcementPlaceholderInteracted?"":"is-collection-reinforcement-attention"}" type="button" data-collection-reinforcement-position="${e}" aria-label="Add from collection" title="Add from collection">
      <div class="collection-reinforcement-placeholder-icon">${x("plus",{size:48,strokeWidth:2.75})}</div>
    </button>
  `}function yr(e,t={}){let n=cr(e,t),a=[t.className||"",n?"is-new-encounter":""].filter(Boolean).join(" "),o=`${t.overlayHtml||""}${n?wr():""}`;return Nn(e,{...t,className:a,overlayHtml:o})}function vr(e,t){let n=t.side==="player",a=t.side==="hand"&&!!t.isTeamUpgrade,o=!!(t.allowRecruitDrag&&e.recruitSource),r=!!(t.allowRewardDrag&&e.rewardCandidateKey),s=!!(i.isRecruiting&&n),c=!!((t.allowFormationDrag||i.isRecruiting)&&n),l=o||r||c,d=["dungeon-demon-card",o?"is-recruit-draggable":"",r?"is-reward-draggable":"",a?"is-team-upgrade":"",e.recruitSource==="collection"&&!i.collectionReinforcementStagedInteracted?"is-collection-reinforcement-attention":"",s?"is-recruit-drop-target":"",$r(e)?"is-poisoned":""].filter(Boolean).join(" ");return yr(e,{className:d.replace("dungeon-demon-card","").trim(),defeated:Number(e.hp)<=0,active:i.selectedSwapInstanceId===e.instanceId||i.selectedRecruitRewardId===e.rewardId||i.selectedRewardDemonKey===e.rewardCandidateKey,overlayHtml:`${a?cn():""}${kr(e)}`,attributes:{"data-instance-id":e.instanceId,"data-reward-id":e.rewardId||null,"data-reward-candidate-key":e.rewardCandidateKey||null,"data-recruit-source":e.recruitSource||null,role:"button",tabindex:"0",draggable:l}})}function cn(){let e=x("arrow-up",{className:"dungeon-team-upgrade-arrow",size:14,strokeWidth:3.25});return`
    <span class="dungeon-team-upgrade-indicator" role="img" aria-label="Upgrade available" title="Upgrade available">
      ${e}${e}
    </span>
  `}function kr(e){let t=va(e);return t?`
    <div class="demon-status-strip" aria-label="Status effects">
      <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${t} stack${t===1?"":"s"}" title="Poisoned">
        <span class="demon-status-icon">${Sr()}</span>
        ${t>1?`<span class="demon-status-count">${k(t)}</span>`:""}
      </span>
    </div>
  `:""}function wr(){return`
    <div class="new-encounter-badge" title="Missing from collection" aria-label="Missing from collection">
      New
    </div>
  `}function $r(e){return va(e)>0}function va(e){return(e.statusEffects?.poison||[]).length}function Sr(){return x("poison")}function Pr(e,t=0){return e.position==="back"||!e.position&&t>0?"back":"front"}function wa(e){if(!e||Number(e.spentPoints)<=0)return null;let t=e.bonuses||{},n=[[t.maxHpFlat,"max HP"],[t.attackFlat,"attack damage"],[t.speedFlat,"Speed"],[t.healingFlat,"healing"],[t.thornsFlat,"thorns damage"],[t.aoeDamageFlat,"AOE damage"],[t.poisonDamageFlat,"poison damage"]].filter(([r])=>Number(r)>0).map(([r,s])=>`+${ka(r)} ${s}`),a=[[t.maxHpPercent,"max HP"],[t.attackPercent,"attack damage"],[t.speedPercent,"Speed"],[t.healingPercent,"healing"],[t.thornsPercent,"thorns"],[t.aoeDamagePercent,"AOE damage"],[t.poisonDamagePercent,"poison damage"]].filter(([r])=>Number(r)>0).map(([r,s])=>`+${ka(r)}% ${s}`),o=[...n,...a];return{id:"account-level-power",name:"Level Power",description:o.join(", "),tooltip:["Level Power",...o].join(`
`),rarity:"account",icon:"sparkles",tags:["Permanent","Account"]}}function ka(e){let t=Number(e)||0;return Number.isInteger(t)?String(t):t.toFixed(1).replace(/\.0$/,"")}var md=window.AmongDemons.audio;var $a=!1;function Rr(e){let t=String(e.rarity||"common").toLowerCase(),n=Lr(e),a=Ar(n),o=e.href?"a":"button",r=e.href?`href="${k(e.href)}"`:'type="button"',s=e.attention?"is-level-power-attention":"",c=e.expiresAt?"is-temporary":"";return`
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
  `}function Ra(e=[],t={}){let n=[],a=new Map,o=t.onlySource?String(t.onlySource):"";return e.forEach(r=>{if(!r?.id)return;if(o&&String(r.source||"")!==o){n.push(r);return}let s=a.get(r.id);if(s){s.stackCount+=1;return}let c={...r,stackCount:1};a.set(r.id,c),n.push(c)}),n}function xa(e,t={}){let n=Math.max(1,Math.trunc(Number(e?.stackCount)||1)),a=t.stackClass||"active-pact-stack",o=t.countClass||"active-pact-stack-count",r=n>1?{...e,tooltip:`${e.name||e.id}: ${xr(e,n)}`}:e;return`
    <span class="${k(a)}">
      ${Rr(r)}
      ${n>1?`
        <span class="${k(o)}" aria-label="${n} stacks">${n}</span>
      `:""}
    </span>
  `}function xr(e,t){let n=(Array.isArray(e?.effects)?e.effects:[]).filter(s=>String(s?.type||"").endsWith("_mult")).map(s=>Math.abs((Number(s.value)-1)*100)).filter(s=>Number.isFinite(s)&&s>0),a=String(e?.description||""),o=0,r=a.replace(/(\d+(?:\.\d+)?)%/g,(s,c)=>{let l=Number(c),d=n.findIndex(u=>Math.abs(u-l)<.001);if(d<0)return s;n.splice(d,1),o+=1;let m=l*t;return`${Sa(m)}% (${t} x ${Sa(l)}%)`});return o>0?r:`${a.replace(/\.$/,"")} (${t} copies).`}function Sa(e){let t=Math.round((Number(e)||0)*100)/100;return Number.isInteger(t)?String(t):String(t).replace(/0+$/,"").replace(/\.$/,"")}function Lr(e={}){let t=e.tooltip||`${e.name||e.id}: ${e.description||""}`,n=Cr(e);return[t,n].filter(Boolean).join(`
`)}function Cr(e={}){let t=Date.parse(e.expiresAt||"");if(!Number.isFinite(t))return"";let n=Math.ceil((t-Date.now())/1e3);return n<=0?"Expired":`Expires in ${Br(n)}`}function Br(e){let t=Math.max(0,Math.floor(Number(e)||0)),n=Math.floor(t/86400),a=Math.floor(t%86400/3600),o=Math.floor(t%3600/60);return n>0?`${n}d ${a}h`:a>0?`${a}h ${o}m`:o>0?`${o}m`:`${t}s`}function Ar(e){return k(e).replace(/\n/g,"&#10;")}function La(){$a||($a=!0,document.addEventListener("pointerover",e=>{let t=e.target.closest?.(".active-pact-chip");t&&gt(t)}),document.addEventListener("focusin",e=>{let t=e.target.closest?.(".active-pact-chip");t&&gt(t)}),document.addEventListener("click",e=>{let t=e.target.closest?.(".active-pact-chip");document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(n=>{n!==t&&n.classList.remove("is-tooltip-visible")}),t&&(gt(t),t.classList.add("is-tooltip-visible"))}),document.addEventListener("keydown",e=>{e.key==="Escape"&&document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(t=>{t.classList.remove("is-tooltip-visible")})}),window.addEventListener("resize",Pa),window.addEventListener("scroll",Pa,!0))}function Pa(){document.querySelectorAll(".active-pact-chip.is-tooltip-visible").forEach(gt)}function gt(e){if(!e)return;let t=e.getBoundingClientRect(),n=Math.min(384,window.innerWidth*.88),a=Er(t.left+t.width/2,n/2+8,window.innerWidth-n/2-8),o=t.top>118,r=o?Math.max(8,t.top-8):Math.min(window.innerHeight-8,t.bottom+8);e.style.setProperty("--active-pact-tooltip-left",`${a}px`),e.style.setProperty("--active-pact-tooltip-top",`${r}px`),e.classList.toggle("is-tooltip-below",!o)}function Er(e,t,n){return Math.max(t,Math.min(n,Number(e)||0))}var Dr=window.AmongDemons.audio,Tr=window.AmongDemons.bagVisuals?.renderItemVisual||(()=>'<span class="bag-item-renderer bag-unknown-visual" aria-hidden="true"></span>');var Mr=(...e)=>h.bindCollectionReinforcementPlaceholders(...e),Fr=(...e)=>h.bindDemonDetailCards(...e),Ir=(...e)=>h.bindFormationDragAndDrop(...e),Nr=(...e)=>h.bindPointerDragAndDrop(...e),_r=(...e)=>h.bindRecruitDragAndDrop(...e),Hr=(...e)=>h.bindRewardDragAndDrop(...e),mn=(...e)=>h.canExtractRun(...e),Ca=(...e)=>h.formatBattleSpeed(...e),Or=(...e)=>h.getRecruitPreviewEnemyTeam(...e),zr=(...e)=>h.getRecruitPreviewHand(...e),Gr=(...e)=>h.getRecruitPreviewTeam(...e),Ba=(...e)=>h.applyDungeonCombatStatPreviewToDemon(...e),Vr=(...e)=>h.getRecruitTeamLimit(...e),qr=(...e)=>h.groupCombatLog(...e),za=(...e)=>h.hasPendingBuffChoices(...e);var Yr=(...e)=>h.isExtractionUnlocked(...e),Wr=(...e)=>h.isCurrentFloorBattle(...e),jr=(...e)=>h.pauseCombatPlayback(...e),Kr=(...e)=>h.playEnemyRevealEffect(...e),Ur=(...e)=>h.playPendingHandFlowAnimation(...e),Xr=(...e)=>h.playRecruitSwapEffect(...e),Ga=(...e)=>h.renderButtonMeleeIcon(...e);var Aa=(...e)=>h.renderDemonCards(...e),Zr=(...e)=>h.renderDungeonDemonCard(...e),Jr=(...e)=>h.bindActivePactTooltips(...e),Qr=(...e)=>h.getActiveBuffs(...e),ei=(...e)=>h.createLevelPowerBuff(...e),ln=(...e)=>h.renderDemonicPacts(...e),ti=(...e)=>h.toggleDemonicPactView(...e);var ni=(...e)=>h.renderFightLogRow(...e),ai=(...e)=>h.renderHandBar(...e),oi=(...e)=>h.renderRewardBox(...e),gn=(...e)=>h.replayFight(...e),ri=(...e)=>h.requestRecruitContinue(...e),ii=(...e)=>h.resumeCombatPlayback(...e),si=(...e)=>h.setBattleSpeed(...e),ci=(...e)=>h.skipCombatPlayback(...e),li=(...e)=>h.startNewDungeonAfterDefeat(...e),Va=(...e)=>h.startRun(...e),di=(...e)=>h.stepCombatPlayback(...e);function fn(){let e=i.run,t=!!e;if(b.runLoading&&b.runLoading.classList.toggle("d-none",!i.isLoading),b.runEmpty.classList.toggle("d-none",i.isLoading||t),b.runPanel.classList.toggle("d-none",i.isLoading||!t),Pi(),wi(),i.isLoading){ue&&ue.disconnect(),i.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.fightLog.innerHTML="Opening the latest dungeon state...",b.fightLog.classList.add("text-muted"),ln(!1),Ue(),xe();return}if(!e){ue&&ue.disconnect(),b.runPanel?.querySelector(".dungeon-arena")?.classList.remove("is-hand-strategy"),b.dungeonBottomPanel?.classList.add("d-none"),i.isMobileRewardBoxOpen=!1,b.dungeonBottomPanel?.classList.remove("is-battle-active","is-mobile-reward-open"),b.dungeonHandBar?.classList.add("d-none"),b.dungeonRewardBox?.classList.add("d-none"),ln(!1),Da(),Ta(),Ma(),b.runEmpty.innerHTML=i.endSummary?ui():mi(),gi(),Ea(),Ue(),xe();return}let n=za(e),a=!!(i.isRecruiting&&e.awaitingRecruit),o=b.runPanel?.querySelector(".dungeon-arena"),r=(a?Gr():e.team||[]).map(Ba),s=a&&i.isEnemyPreviewDeferred?[]:a?Or():e.enemies||[],c=!!e.replayOnly,l=!!(i.isBattleAnimating||c),d=!!(i.isPactTeamPreview&&n),m=!!(!a&&l),u=(a?zr():[]).map(Ba),f=m?"battle":"recruit",S=!!(n&&!i.isPactRevealPending&&!i.isBattleAnimating&&!i.isResultAnimating),y=!!(n||i.isPactRevealPending),$=!0,v=!!(a&&!y),P=v,A=!!(!n&&!i.isResultAnimating&&mn()),M=Fa(b.teamGrid),T=Fa(b.enemyGrid),I=["player",e.awaitingRecruit?"recruit":"battle",i.isRecruiting?"interactive":"locked",n?"pacts":"ready"].join(":");b.dungeonBottomPanel?.classList.toggle("d-none",!$),(!A||i.isBattleAnimating||i.isResultAnimating)&&(i.isMobileRewardBoxOpen=!1),b.dungeonBottomPanel?.classList.toggle("is-battle-active",l||d),b.dungeonBottomPanel?.classList.toggle("is-mobile-reward-open",!!(i.isMobileRewardBoxOpen&&A&&!i.isBattleAnimating)),o?.classList.toggle("is-hand-strategy",a),Q(b.teamGrid,Aa(r,{side:"player",allowFormationDrag:e.status==="active"&&!y&&(!e.awaitingRecruit||i.isRecruiting),gridStyle:M}),{patchFormationGrid:!0,renderKey:I}),Q(b.enemyGrid,Aa(a||(e.team||[]).length?s:[],{side:"enemy",allowRecruitDrag:!1,gridStyle:T}),{patchFormationGrid:!0,renderKey:"enemy"}),ai(u,$,v,f),oi($,P,A),ln(S),Da(a?r.length:null,a?Vr():null),Ta(a?e.nextEnemyPressure:e.enemyPressure,a?e.nextEnemyBuffs:e.enemyBuffs,a?e.nextEnemyTeamBuffs:e.enemyTeamBuffs),Ma(),Ir(),_r(),Hr(),Nr(),Mr(),Fr(),Jr(),Xr(),Kr(),$i(),Ea(),Ue(),xe(),Ur(a)}function ui(){let e=i.endSummary||{},t=e.demon,n=e.echo,a=e.outcome==="defeat";return`
    <div class="dungeon-end-screen ${a?"is-defeat":"is-extraction"}">
      <div class="dungeon-end-copy">
        <span class="dungeon-phase-eyebrow">${a?"Defeat":"Extraction"}</span>
        <h2>${k(e.title||"Run complete")}</h2>
        <p>${k(e.message||"Run extracted.")}</p>
      </div>
      ${t?`
        <div class="dungeon-end-demon" aria-label="Collected demon">
          ${Zr(t,{className:"dungeon-end-demon-card",suppressCollectionMissingTag:!0,attributes:{"data-instance-id":t.instanceId||`end-${t.id||"demon"}`}})}
        </div>
      `:""}
      ${n?`
        <div
          class="dungeon-end-demon dungeon-end-echo"
          style="--item-rarity: ${k(Et(n.rarity||"common"))}"
          aria-label="Extracted ${k(`${ot(n.rarity||"common")} ${n.species||"Demon"} Echo`)}"
        >
          <span class="dungeon-end-echo-visual">
            ${Tr(n,{context:"slot"})}
          </span>
        </div>
      `:""}
      <div class="dungeon-end-rewards" aria-label="Rewards obtained">
        ${t?`<span>${x("stars")}${k(t.species||"Demon")}</span>`:""}
        ${n?`<span>${x("sparkles")}${k(`${ot(n.rarity||"common")} ${n.species||"Demon"} Echo`)}</span>`:""}
        <span>${Number(e.xp)||0} XP</span>
        ${At(Number(e.souls)||0,{className:"soul-chip dungeon-end-soul-amount"})}
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
  `}function mi(){return`
    <img src="/app/images/demons/1.png" alt="Boof Nitza demon preparing for a dungeon run" width="1024" height="1024" loading="lazy" decoding="async">
    <p class="mb-0 text-muted">Ready to descend into the dungeon?</p>
    <button class="btn btn-primary dungeon-start-prompt-btn" id="startNewDungeonBtn" type="button">
      ${x("play")}
      Start Dungeon
    </button>
  `}function gi(){N(document.getElementById("startNewDungeonBtn"),async()=>{_n(),await Va(),fn()}),N(document.getElementById("replayEndedDungeonBtn"),gn)}function Ea(){let t=(i.combatLog.length?qr(i.combatLog).map((n,a)=>`
      ${ni(n,a)}
    `).join(""):"")+Ri();if(!t.trim()){b.fightLog.innerHTML="Fight log will appear here after a battle.",b.fightLog.classList.add("text-muted");return}b.fightLog.classList.remove("text-muted"),b.fightLog.innerHTML=t}function qa(e,t={}){let n=document.querySelector(".battle-result-burst");n&&n.remove();let a=e==="defeat",o=t.syncActions!==!1,s=!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches?900:a?3e3:2200;i.isResultAnimating=!0,Dr?.play(e==="victory"?"sfx.battle.victory":"sfx.battle.defeat",{volume:.96}),o&&(Ue(),xe());let c=document.createElement("div");return c.className=`battle-result-burst is-${e}`,c.style.setProperty("--battle-result-duration",`${s}ms`),c.setAttribute("role","status"),c.setAttribute("aria-live","polite"),c.innerHTML=`
    <div class="battle-result-burst-ring" aria-hidden="true"></div>
    ${a?'<div class="battle-result-burst-wound" aria-hidden="true"></div>':""}
    <div class="battle-result-burst-text">${e==="victory"?"Victory":"Defeat"}</div>
    ${a?'<div class="battle-result-burst-subtitle">Your demons have fallen</div>':""}
    <div class="battle-result-burst-sparks" aria-hidden="true">
      ${Array.from({length:a?16:14},()=>"<span></span>").join("")}
    </div>
  `,document.body.appendChild(c),new Promise(l=>{setTimeout(()=>{c.remove(),i.isResultAnimating=!1,o&&(Ue(),xe()),l()},s)})}function Da(e=null,t=null){if(!b.teamSideTitle)return;let n=Number.isFinite(e)&&Number.isFinite(t)?`<span class="battle-side-count" aria-label="${e} of ${t} team slots used">${e}/${t}</span>`:"",a=fi();b.teamSideTitle.innerHTML=`
    <span>Your Team</span>
    ${n?` ${n}`:""}
    ${Xe(a,{side:"player"})}
  `}function Ta(e=null,t=[],n=[]){if(!b.enemySideTitle)return;let a=i.run?.enemyLabel||"Enemies";b.enemySideTitle.innerHTML=`
    <span>${k(a)}</span>
    ${bi(e)}
    ${yi(t)}
    ${Xe(n,{side:"enemy"})}
  `}function fi(e=i.run){if(!e)return[];let t=i.statPoints?ei(i.statPoints):null;return[...t?[t]:[],...Qr(e)].filter(n=>n?.id||n?.name)}function Xe(e=[],t={}){let n=pi(e);if(!n.length)return"";let a=n.reduce((c,l)=>c+l.stackCount,0),o=t.side==="enemy"?"enemy":"player",r=t.label||"Buffs",s=`battle-${o}-buff-summary-tooltip`;return`
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
        ${n.map(hi).join("")}
      </span>
    </span>
  `}function pi(e=[]){let t=[],n=new Map;return(Array.isArray(e)?e:[]).forEach((a,o)=>{if(!a)return;let r=typeof a=="string"?{id:a,name:a,description:""}:a,s=String(r.id||r.name||`buff-${o+1}`),c=Math.max(1,Math.trunc(Number(r.stackCount)||1)),l=n.get(s);if(l){l.stackCount+=c;return}let d={...r,id:s,stackCount:c};n.set(s,d),t.push(d)}),t}function hi(e={}){let t=String(e.name||e.id||"Buff"),n=e.stackCount>1?` \xD7${e.stackCount}`:"",a=String(e.description||e.tooltip||"").trim(),o=a.startsWith(`${t}
`)?a.slice(t.length+1).trim():a;return`
    <span class="battle-buff-summary-row">
      <strong class="battle-buff-summary-name">${k(t)}${n}</strong>
      ${o?`<span class="battle-buff-summary-description">${k(o).replace(/\n/g,"<br>")}</span>`:""}
    </span>
  `}function bi(e=null){if(!e?.active)return"";let t=Ee(e.hpBonusPct),n=Ee(e.atkBonusPct),a=Ee(e.speedBonusPct),o=Math.max(0,Math.round(Number(e.level)||0));if(o<=0)return"";let r="battle-enemy-terror-tooltip";return`
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
  `}function yi(e=[]){let t=(Array.isArray(e)?e:[]).filter(Boolean);return t.length?t.map(vi).join(""):""}function vi(e={}){let t=String(e.name||e.id||"Boss Buff"),n=String(e.description||""),a=e.id==="rarity-convergence",o=a?[t,n,`Host HP ${Ee(e.hpBonusPct)}`,`Host Attack ${Ee(e.atkBonusPct)}`,`Host Speed ${Ee(e.speedBonusPct)}`].join(`
`):[t,n].filter(Boolean).join(`
`),r=ki(o),s=a?` style="--enemy-buff-color: ${k(Et(e.rarity||"common"))}"`:"";return`
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
  `}function Ee(e){return`+${Math.max(0,Math.round(Number(e)||0))}%`}function ki(e){return k(e).replace(/\n/g,"&#10;")}function Ma(){if(!b.dungeonJoiner)return;let e=i.run?Math.max(1,Number(i.run.currentFloor)||1):null;b.dungeonJoiner.classList.remove("is-recruiting"),b.dungeonJoiner.innerHTML=`
    <div class="dungeon-center-actions" id="dungeonCenterActions"></div>
    ${e?`<span class="dungeon-floor-marker" aria-label="Current floor ${e}"><span>Floor</span><strong>${e}</strong></span>`:""}
  `,b.dungeonCenterActions=document.getElementById("dungeonCenterActions")}function wi(){fe("combat")}function ft(){let e=document.getElementById("battleLogPanel")?.classList.contains("show");fe(e?"combat":"log")}function fe(e){let t=e==="log";document.getElementById("combatPanel")?.classList.toggle("show",!t),document.getElementById("combatPanel")?.classList.toggle("active",!t),document.getElementById("battleLogPanel")?.classList.toggle("show",t),document.getElementById("battleLogPanel")?.classList.toggle("active",t)}function $i(){ue&&ue.disconnect();let e=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards")),t=Array.from(document.querySelectorAll(".battle-side > #teamGrid, .battle-side > #enemyGrid"));if(!e.length&&!t.length)return;let n=new ResizeObserver(()=>dn());In(n),e.forEach(a=>n.observe(a)),t.forEach(a=>n.observe(a)),document.querySelectorAll(".battle-side .dungeon-demon-card-image img").forEach(a=>{a.complete||a.addEventListener("load",dn,{once:!0})}),un(),dn()}function dn(){un(),requestAnimationFrame(()=>{un();let e=[],t=Array.from(document.querySelectorAll(".battle-side .formation-lane-cards"));if(t.forEach(a=>{let o=Array.from(a.querySelectorAll(".dungeon-demon-card"));if(a.classList.remove("is-compressed"),a.style.removeProperty("--dungeon-demon-card-width"),a.style.removeProperty("--dungeon-demon-card-height"),!o.length)return;let r=a.getBoundingClientRect();if(!(o[o.length-1].getBoundingClientRect().bottom>r.bottom+1||a.scrollHeight>a.clientHeight+1))return;let l=parseFloat(getComputedStyle(a).rowGap||getComputedStyle(a).gap)||0,d=getComputedStyle(a).flexDirection.startsWith("row"),m=d?r.height:(r.height-l*(o.length-1))/o.length,u=d?(r.width-l*(o.length-1))/o.length:m,f=Math.max(46,Math.min(148,m,u));e.push(f)}),!e.length)return;let n=Math.min(...e);t.forEach(a=>{a.style.setProperty("--dungeon-demon-card-width",`${n}px`),a.style.setProperty("--dungeon-demon-card-height",`${n}px`),a.classList.add("is-compressed")})})}function un(){Array.from(document.querySelectorAll(".battle-side .battle-formation-grid")).forEach(t=>{let n=t.parentElement;if(!n)return;let a=n.getBoundingClientRect();if(a.width<=0||a.height<=0)return;let o=getComputedStyle(t),r=3,s=3,c=1,l=Ke(o.gap||o.rowGap||o.columnGap),d=Ke(o.paddingLeft)+Ke(o.paddingRight),m=Ke(o.paddingTop)+Ke(o.paddingBottom),u=(a.width-d-l*(r-1))/r,f=(a.height-m-l*(s-1))/(s*c),S=Math.max(42,Math.min(260,u,f));Number.isFinite(S)&&Si(t,S,S*c)})}function Fa(e){let t=e?.querySelector?.(".battle-formation-grid"),n=t?.style.getPropertyValue("--dungeon-demon-card-width"),a=t?.style.getPropertyValue("--dungeon-demon-card-height");return!n||!a?"":`--dungeon-demon-card-width: ${n}; --dungeon-demon-card-height: ${a};`}function Si(e,t,n){let a=`${t}px`,o=`${n}px`;e.style.getPropertyValue("--dungeon-demon-card-width")!==a&&e.style.setProperty("--dungeon-demon-card-width",a),e.style.getPropertyValue("--dungeon-demon-card-height")!==o&&e.style.setProperty("--dungeon-demon-card-height",o)}function Ke(e){let t=parseFloat(e);return Number.isFinite(t)?t:0}function Pi(){b.dungeonRewardStrip&&(b.dungeonRewardStrip.innerHTML="")}function Ri(){return i.endNotice?`<div class="${i.endNotice.type==="warning"?"fight-log-notice fight-log-end-notice text-warning":"fight-log-notice fight-log-end-notice text-success"}">${i.endNotice.html||k(i.endNotice.text)}</div>`:""}function Ia(e){return b.dungeonBottomControls?Q(b.dungeonBottomControls,e):!1}function pn(e,t){return`
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight" ${e?"":"disabled"}>
      ${x("list-restart")}
    </button>
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogToggleBtn" type="button" title="Fight Log" aria-label="Fight Log" ${t?"":"disabled"}>
      ${x("log")}
    </button>
  `}function Na(e,t){return b.dungeonReplayLogBox?Q(b.dungeonReplayLogBox,pn(e,t)):!1}function Ue(){if(i.isLoading){_a(),Ha({canReplay:!1,canViewLog:!1,canExtract:!1}),Ia(""),Na(!1,!1);return}let e=i.run?.status==="defeated",t=!i.endSummary&&(!i.run||e||i.run.status==="ended"),n=!!(i.run&&!i.isResultAnimating&&i.isBattleAnimating&&i.combatPlayback),a=za(i.run),o=!!(i.isPactTeamPreview&&a),r=!!(Wr(i.run)&&(i.run?.lastBattle?.combatLog?.length||i.combatLog.length)),s=!!(!i.isBattleAnimating&&!i.isResultAnimating&&!a&&r),c=s,l=!!(!a&&!i.isResultAnimating&&i.run?.awaitingRecruit&&i.isRecruiting),d=!!(!i.isBattleAnimating&&!i.isResultAnimating&&!a&&mn()),m=!!i.isRecruitContinuePending,u=!!i.isBattleAnimating,f={canFight:l||m||u,isPending:m,isFighting:u,canStart:t&&!!i.run,isDefeated:e,canReplay:s,canViewLog:c,canExtract:d};_a(f);let S=Ha(f),y=o?yn():n?`${hn()}${bn()}${vn()}`:"",$=Ia(y),v=Na(s,c);!$&&!v&&!S||(at("[data-battle-speed]",P=>si(Number(P.dataset.battleSpeed))),N(document.getElementById("battlePlaybackToggleBtn"),()=>{i.combatPlayback?.isPaused?ii():jr()}),at("[data-battle-step]",P=>di(Number(P.dataset.battleStep))),N(document.getElementById("battlePlaybackSkipBtn"),ci),N(document.getElementById("demonicPactReturnBtn"),ti),N(document.getElementById("fightLogReplayBtn"),gn),N(document.getElementById("fightLogToggleBtn"),ft))}function _a(e={}){let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canStart:o=!1,isDefeated:r=!1}=e;if(o){Q(b.dungeonCenterActions,`
      <div class="dungeon-center-action-stack">
        <button class="btn btn-primary dungeon-fight-btn dungeon-center-start-btn" id="dungeonCenterStartBtn" type="button" title="${r?"Start a new dungeon":"Start the dungeon"}">
          ${x("play")}
          <span>${r?"New Dungeon":"Start Dungeon"}</span>
        </button>
      </div>
    `)&&N(document.getElementById("dungeonCenterStartBtn"),r?li:Va);return}let s=a?"fighting":n?"preparing":"ready",c=s!=="ready",l=s==="fighting"?"Fighting":s==="preparing"?"Preparing":"Fight",d=s==="fighting"?"Fight in progress":s==="preparing"?"Preparing the next fight":"Start the next fight";Q(b.dungeonCenterActions,t?`
    <div class="dungeon-center-action-stack">
      <span class="dungeon-fight-mark" aria-hidden="true">${Ga()}</span>
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
  `:"")&&Ya()}function Ha(e={}){if(!b.dungeonMobileFightBox)return!1;if(i.isLoading)return Q(b.dungeonMobileFightBox,"");let{canFight:t=!1,isPending:n=!1,isFighting:a=!1,canReplay:o=!1,canViewLog:r=!1,canExtract:s=!1}=e,c=a?"fighting":n?"preparing":"ready",l=c!=="ready",d=c==="fighting"?"Fighting":c==="preparing"?"Preparing":"Fight",m=c==="fighting"?"Fight in progress":c==="preparing"?"Preparing the next fight":"Start the next fight",u=!!i.run,f=i.activeHandTab==="pacts"?"pacts":"hand",S=!!(i.isMobileRewardBoxOpen&&s),y=!u||a,$=Yr(i.run)?"Extract":"Win your first fight to unlock extraction",v=Q(b.dungeonMobileFightBox,`
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
      class="dungeon-mobile-nav-btn ${S?"active":""}"
      id="dungeonMobileExtractBtn"
      type="button"
      title="${$}"
      aria-label="${$}"
      aria-pressed="${S?"true":"false"}"
      ${s?"":"disabled"}
    >
      ${x("flag")}
      <span class="visually-hidden">Extract</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn dungeon-fight-btn dungeon-mobile-fight-btn ad-primary-action ${c==="preparing"?"is-loading":""} ${c==="fighting"?"is-fighting":""}"
      id="dungeonMobileFightBtn"
      type="button"
      title="${m}"
      aria-label="${m}"
      ${!t||l?"disabled":""}
      ${l?'aria-busy="true"':""}
    >
      ${c==="preparing"?'<span class="dungeon-action-spinner" aria-hidden="true"></span>':Ga()}
      <span class="visually-hidden">${d}</span>
    </button>
  `);return v&&(xi(),Ya()),v}function xi(){N(document.getElementById("dungeonMobileHandBtn"),()=>Oa("hand")),N(document.getElementById("dungeonMobileBuffsBtn"),()=>Oa("pacts")),N(document.getElementById("dungeonMobileReplayBtn"),gn),N(document.getElementById("dungeonMobileLogBtn"),ft),N(document.getElementById("dungeonMobileExtractBtn"),Li)}function Oa(e){!i.run||i.isBattleAnimating||(i.activeHandTab=e==="pacts"?"pacts":"hand",fn())}function Li(){i.isBattleAnimating||i.isResultAnimating||!mn()||(i.isMobileRewardBoxOpen=!i.isMobileRewardBoxOpen,fn())}function hn(){let e=i.combatPlayback||{},t=!!e.isPaused,n=Number(e.currentIndex)||0,a=Number(e.totalSteps)||0,o=n>0,r=n<a;return`
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
  `}function bn(){return`
    <div class="battle-speed-control" role="group" aria-label="Battle animation speed">
      ${Pe.map(e=>`
        <button
          class="battle-speed-option ${i.battleSpeed===e?"active ad-primary-action":""}"
          type="button"
          data-battle-speed="${e}"
          aria-pressed="${i.battleSpeed===e?"true":"false"}"
          title="${Ca(e)} battle speed"
        >
          ${Ca(e)}
        </button>
      `).join("")}
    </div>
  `}function yn(){return`
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
  `}function vn(){return`
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
  `}function Ya(){[document.getElementById("dungeonFightBtn"),document.getElementById("dungeonMobileFightBtn")].forEach(e=>{!e||e.dataset.dungeonFightBound==="true"||(e.dataset.dungeonFightBound="true",N(e,t=>ri(t.currentTarget)))})}var Pt=window.AmongDemons.api,he=window.AmongDemons.audio,Ci=window.AmongDemons.ui.renderDemonCard,E=window.AmongDemons.ui.renderIcon||(()=>""),Je=Object.freeze(["common","uncommon","rare","epic","legendary","mythic"]),De=2,tt=20,Wa=Object.freeze({common:1,uncommon:2,rare:3,epic:4,legendary:5,mythic:7}),g={},ja=new Set,K=!1,R=null,p=null,se=!1,w=null,yt=!1,Pn=0,J=0,Te=null,pt=null,Ka=0,Rn=new Set,xn=[],Ua=null,Qe=0,ht=0;Tn({...an,battle:ro,getExplicitFormationRow:e=>ce(e?.formationSlot),normalizeFormationRow:e=>ce(e)??0,shouldShowCollectionMissingTag:()=>!1,getDemonPosition:hs,renderDemonStatus:bs,renderDungeonCenterActions:So,renderFightLog:go,renderFightLogActions:fo,renderRun:_});$s(Bi);async function Bi(){if(!window.AmongDemons.getToken()){window.location.href=window.AmongDemons.appUrl("/login?next=/ranked");return}Ai(),Ei(),La(),dt(),he?.setScene({music:"music.default"}),await Di()}function Ai(){["rankedMessage","runLoading","runEmpty","runPanel","rankedBottomPanel","rankedHandStatus","rankedPreparation","dungeonHandBar","dungeonBottomControls","dungeonReplayLogBox","teamSideTitle","enemySideTitle","teamGrid","enemyGrid","dungeonCenterActions","fightLog","demonicPactOverlay","demonicPactViewToggle","rankedPactGrid","rankedVictoryModal","rankedVictoryRankImage","rankedVictoryDivision","rankedVictoryRankGain","rankedVictorySummary"].forEach(e=>{g[e]=document.getElementById(e)})}function Ei(){document.addEventListener("click",async e=>{let t=e.target.closest("[data-ranked-pact-scroll]");if(t){e.preventDefault(),qi(t);return}let n=e.target.closest("[data-ranked-victory-action]");if(n){e.preventDefault(),await Qi(n.dataset.rankedVictoryAction);return}let a=e.target.closest("[data-battle-speed]");if(a){e.preventDefault(),Qt(Number(a.dataset.battleSpeed));return}let o=e.target.closest("[data-battle-step]");if(o){e.preventDefault(),Wt(Number(o.dataset.battleStep));return}if(e.target.closest("#battlePlaybackToggleBtn")){e.preventDefault(),i.combatPlayback?.isPaused?Yt():qt();return}if(e.target.closest("#battlePlaybackSkipBtn")){e.preventDefault(),jt();return}if(e.target.closest("#fightLogReplayBtn, #rankedMobileReplayBtn")){e.preventDefault(),await _i();return}if(e.target.closest("#fightLogToggleBtn, #rankedMobileLogBtn")){e.preventDefault(),ft();return}if(e.target.closest("#demonicPactViewToggle, #demonicPactReturnBtn")){e.preventDefault(),Ki();return}let r=e.target.closest("[data-ranked-action]");if(r?.matches("button")){e.preventDefault(),await Xa(r,e);return}r&&(e.preventDefault(),await Xa(r,e))}),document.addEventListener("dragstart",e=>{let t=e.target.closest("[data-ranked-workspace-id]");if(!t||!e.dataTransfer||!p)return;let n=t.dataset.rankedWorkspaceId;yt=!0,An(n),e.dataTransfer.effectAllowed="move",e.dataTransfer.setData("text/plain",n),t.classList.add("is-dragging")}),document.addEventListener("dragend",e=>{e.target.closest("[data-ranked-workspace-id]")?.classList.remove("is-dragging"),Pn=Date.now()+350,yt=!1,St(),W()}),document.addEventListener("dragover",e=>{let t=wt(e.target);t&&(e.preventDefault(),W(),t.classList.add("is-drag-over"))}),document.addEventListener("dragleave",e=>{let t=wt(e.target);t&&!t.contains(e.relatedTarget)&&t.classList.remove("is-drag-over")}),document.addEventListener("drop",e=>{let t=wt(e.target);if(!t)return;e.preventDefault();let n=e.dataTransfer?.getData("text/plain");n&&(yt=!1,St(),ko(n,t,{x:e.clientX,y:e.clientY}))}),document.addEventListener("pointerdown",us),document.addEventListener("pointermove",ms),document.addEventListener("pointerup",fs),document.addEventListener("pointercancel",ps),document.addEventListener("keydown",e=>{let t=e.target.closest(".dungeon-demon-card[data-instance-id]");!t||!["Enter"," "].includes(e.key)||(e.preventDefault(),po(t))}),document.addEventListener("scroll",e=>{let t=e.target?.closest?.("[data-ranked-pact-scroll-viewport]");t&&mo(t.closest(".ranked-reserve-buffs-shell"))},{capture:!0,passive:!0}),window.addEventListener("resize",uo)}async function Di(){wn(!0);try{let[e]=await Promise.all([Pt("/api/ranked/bootstrap"),Ti().catch(t=>(console.warn("Ranked upgrade previews will use current-card art.",t),null))]);e.player&&En(e.player),e.run?(Ie(e.run),e.run.status==="active"&&e.run.phase==="result"&&!e.run.awaitingVictoryChoice&&await oo()):(i.run=null,R=null),wn(!1),_(),R?.awaitingVictoryChoice&&ho(R)}catch(e){wn(!1),Ct(e)}}async function Ti(){return Te||(pt||(pt=Pt("/api/game/catalog?v=20260722-request-optimization-v1").then(e=>(Te={types:e?.types||{},demons:Array.isArray(e?.demons)?e.demons:[]},Te)).catch(e=>{throw pt=null,e})),pt)}async function Mi(){let e=await so("/api/ranked/start",{});e?.run&&Ie(e.run)}async function Xa(e,t=null){if(K)return;let n=e.dataset.rankedAction;if(n==="start")return Mi();if(R){if(n==="reroll")return Ii(xt(t,e));if(n==="lock-hand")return Ni();if(n==="fight")return ro();if(n==="continue")return oo();if(n==="end")return window.confirm("End this Ranked run and finalize its current Rank Points?")?Fe("end",{}):void 0;if(n==="pact")return Fi(e.dataset.buffId)}}async function Fe(e,t){let n=await so(`/api/ranked/runs/${encodeURIComponent(R.runId)}/${e}`,t);return n?.player&&En(n.player,{animate:!0}),n?.run&&(Ie(n.run),n.rewards?.souls&&_e(`Floor ${tt} cleared. ${n.rewards.souls} Souls awarded.`,"success")),n}async function oo(){let e=await Fe("continue",{});e?.run?.phase==="selection"&&e.run.floor>tt&&_e("Endless floor unlocked.","success")}async function Fi(e){let t=await Fe("pact",{buffId:e});if(t?.run&&(he?.play("sfx.dungeon.pactChoose",{volume:.9}),!t.run.pendingPact&&Qe>0)){let n=Qe;Qe=0,window.requestAnimationFrame(()=>vs(n))}return t}async function Ii(e){if(!vo()||K)return;let t=await Fe("reroll",{lineup:bo(),lockHand:!!R.handLocked});if(!t?.run)return;let n=Math.max(0,Number(t.rerollCost)||De);Lt(e,-n),he?.play("sfx.dungeon.pactReroll",{volume:.86})}async function ro(){if(!(!yo()||K||i.isBattleAnimating)){Qe=0,Ne(!0),se=!0;try{let e=await Pt(`/api/ranked/runs/${encodeURIComponent(R.runId)}/battle`,co({lineup:bo(),lockHand:!!R.handLocked}));if(!e?.run?.lastBattle)return;let t=e.rSoulInterest;Ie(e.run,{render:!1}),Number(t?.earned)>0&&(J=Math.max(0,Number(t.balanceBefore)||0));let n=e.run.lastBattle;io(n),fe("combat"),_(),await it(),await Ji(n.winner),Ie(e.run,{render:!1});let a=[];e.rewards?.souls&&(a.push(`Victory milestone: ${e.rewards.souls} Souls awarded.`),e.player&&En(e.player,{animate:!0})),Number(t?.earned)>0&&(Qe=Math.max(0,Number(t.earned)||0)),_e(a.length?a.join(" "):"","success"),e.run.awaitingVictoryChoice&&ho(e.run,{rankGain:e.rankGain})}catch(e){Ct(e)}finally{se=!1,Ne(!1),_()}}}function Ni(){if(!R||!Cn(R))return;let e=!R.handLocked;R.handLocked=e,i.run.handLocked=e,_()}async function _i(){let e=R?.lastBattle;if(!(K||i.isBattleAnimating||!e?.combatLog?.length)){se=!0,Ne(!0);try{io(e),fe("combat"),_(),g.fightLog.innerHTML="",g.fightLog.classList.remove("text-muted"),await it(),Ie(R,{render:!1})}catch(t){Ct(t)}finally{se=!1,Ne(!1),_()}}}function io(e){i.run.team=j(e.playerTeamBefore||i.run.team||[]),i.run.active=i.run.team,i.run.enemies=j(e.enemyTeamBefore||i.run.enemies||[]),i.combatLog=e.combatLog||[],i.combatDemons=je()}async function so(e,t){Ne(!0);try{return await Pt(e,co(t))}catch(n){return Ct(n),null}finally{Ne(!1)}}function co(e){let t=ks();return{method:"POST",headers:{"Idempotency-Key":t},body:{...e,actionId:t}}}function Ie(e,t={}){St(),R=e,J=Math.max(0,Math.floor(Number(e.rSouls)||0));let n=e.lastBattle;p=Cn(e)?ts(e):null,i.run={...e,team:j(p?.active||e.active||e.team),active:j(p?.active||e.active||e.team),reserve:j(p?.reserve||e.reserve),enemies:e.phase==="result"&&n?j(n.enemyTeamAfter):j(e.enemies)},i.combatLog=n?.combatLog||[],i.combatDemons=je(),t.render!==!1&&_(),Xi(e.combinationEvents||[])}function _(){ns();let e=i.run,t=!!e;if(g.runEmpty.classList.toggle("d-none",t||i.isLoading),g.runPanel.classList.toggle("d-none",!t||i.isLoading),g.rankedBottomPanel.classList.toggle("d-none",!t||i.isLoading),!t){fe("combat"),g.runEmpty.innerHTML=`
      <div class="ranked-end-card">
        <span class="dungeon-phase-eyebrow">Seasonal Ranked</span>
        <h1>Draft. Adapt. Climb.</h1>
        <p>Build a temporary standardized roster, survive with three lives, and clear Floor ${tt}.</p>
        <button class="btn btn-primary btn-lg" type="button" data-ranked-action="start" ${K?"disabled":""}>
          ${E("trophy")} Start Ranked Run
        </button>
      </div>
    `;return}if((e.status==="ended"||e.phase==="ended")&&!se){fe("combat"),g.runPanel.classList.add("d-none"),g.rankedBottomPanel.classList.add("d-none"),g.runEmpty.classList.remove("d-none"),g.runEmpty.innerHTML=Ui(e),Ja([]);return}let n=se||i.isBattleAnimating,a=n,o=!!(i.isPactTeamPreview&&e.pendingPact&&!a),r=a||o,s=!!(!r&&(e.lastBattle?.combatLog?.length||i.combatLog?.length));g.enemyGrid.closest(".battle-side")?.classList.toggle("is-ranked-reserve",!a),g.rankedBottomPanel.classList.toggle("is-ranked-combat",r),g.rankedBottomPanel.classList.remove("has-fight-review"),g.rankedBottomPanel.classList.toggle("is-battle-active",n),g.dungeonHandBar.classList.toggle("d-none",!r),g.dungeonHandBar.classList.toggle("is-battle-controls-mode",r),g.dungeonReplayLogBox.classList.add("d-none"),a||fe("combat"),Hi(e),zi(e,a),So(),g.teamGrid.innerHTML=rn(e.team||e.active||[],{side:"player",allowFormationDrag:!a&&!e.pendingPact}),g.enemyGrid.innerHTML=a?rn(e.enemies||[],{side:"enemy"}):Vi(e.reserve||[],e),g.rankedPreparation.classList.toggle("d-none",a||o||e.phase==="preparation"&&i.isBattleAnimating);let c=!g.rankedPreparation.classList.contains("d-none"),l=Math.max(0,Math.min(3,Number(e.lives)||0)),d=Array.from({length:3},(m,u)=>`
      <span class="ranked-life-heart ${u<l?"is-active":"is-empty"}">\u2665</span>
    `).join("");g.rankedHandStatus.classList.toggle("d-none",!c),g.rankedHandStatus.setAttribute("aria-label",`${l} of 3 lives, ${D(J)} Ranked Souls`),g.rankedHandStatus.innerHTML=c?`
      <span class="ranked-lives" aria-hidden="true">${d}</span>
      <span class="ranked-hand-status-separator" aria-hidden="true">&middot;</span>
      ${Oi(e)}
    `:"",g.rankedPreparation.innerHTML=a||o?"":Wi(e,{canReviewFight:s}),fo(),go(),Ja(e.pacts?.pendingChoices||[]),Zi(),as(),os(),uo()}function Hi(e){let t=e.rating?.division||"Bronze II",n=Ln(t),a=Array.isArray(e.team)?e.team:e.active||[],o=Math.max(1,Number(e.capacities?.active)||6),r=Math.min(o,a.length),s=`${r}/${o}`,c=`
    <span class="battle-side-count" aria-label="${F(`${r} of ${o} team slots used`)}">
      ${F(s)}
    </span>
  `;g.teamSideTitle.innerHTML=`
    <span class="ranked-desktop-status">
      ${$n(n,{showLabel:!0})}
      ${c}
    </span>
    <span class="ranked-mobile-status">
      ${$n(n,{showLabel:!0,compact:!0})}
      ${c}
    </span>
    ${Xe(lo(e),{side:"player"})}
  `}function Oi(e){let t=Math.max(1,Number(e?.floor)||1),n=Math.floor(J/10),a=t+n;return`
    <span class="ranked-rsoul-balance" tabindex="0" aria-describedby="rankedRSoulTooltip">
      ${E("soul")}
      <span class="ranked-rsoul-value">${D(J)}</span>
      <span class="ranked-rsoul-tooltip" id="rankedRSoulTooltip" role="tooltip">
        <span class="ranked-rsoul-tooltip-main">
          <strong>Interest:</strong>
          ${E("soul")}
          <strong>${D(a)}</strong>
        </span>
        <span class="ranked-rsoul-tooltip-formula">Floor number + 1 every 10 souls</span>
      </span>
    </span>
  `}function zi(e,t){if(!t){g.enemySideTitle.innerHTML="<span>Reserve</span>";return}let n=e.opponent?.generated?"Ranked Rival":e.opponent?.hunterName||"Opponent",a=Ln(e.opponent?.division);g.enemySideTitle.innerHTML=`
    <span>${F(n)}</span>
    ${e.opponent?.division?$n(a,{showLabel:!0,compact:!0}):""}
    ${Xe(e.lastBattle?.enemyBuffs||[],{side:"enemy"})}
  `}function Ln(e="Bronze III"){let t=String(e||"Bronze III").trim().toLowerCase(),n=t.replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),a=["bronze","silver","gold","platinum","diamond","demonic"].find(o=>t.startsWith(o))||"bronze";return{division:String(e||"Bronze III"),slug:n,tier:a,imageUrl:`/app/images/assets/ranks/${a}.svg`}}function $n(e,t={}){let n=t.compact?" is-compact":"",a=Number.isFinite(t.occupiedSlots)&&Number.isFinite(t.maxSlots),o=a?`${Math.max(0,t.occupiedSlots)}/${Math.max(1,t.maxSlots)}`:"";return`
    <span class="ranked-rank ranked-rank--${F(e.slug)}${n}"
          aria-label="${F(e.division)} rank">
      <img class="ranked-rank-image" src="${F(e.imageUrl)}" alt="" width="72" height="80" aria-hidden="true">
      ${t.showLabel?`<span class="ranked-rank-label rank-division-text rank-division-text--${F(e.slug)}">${F(e.division.toUpperCase())}</span>`:""}
      ${a?`
        <span class="ranked-rank-separator" aria-hidden="true">&middot;</span>
        <span class="ranked-team-slots" aria-label="${F(`${o} team slots occupied`)}">${F(o)}</span>
      `:""}
    </span>
  `}function lo(e){let t=e.lockedBonuses||{},n=Object.values(t.allocations||{}).reduce((s,c)=>s+Math.max(0,Number(c)||0),0),a=wa({spentPoints:n,bonuses:t.skillBonuses||{}}),o=Ra(Array.isArray(e.pacts?.activeBuffs)?e.pacts.activeBuffs:[]),r=(Array.isArray(t.activeBuffs)?t.activeBuffs:[]).filter(s=>s?.source!=="skill_tree");return[...a?[a]:[],...o,...r].filter(s=>s?.id)}function Gi(e){return xa(e,{stackClass:"ranked-pact-stack",countClass:"ranked-pact-stack-count"})}function Vi(e,t){let n=Array.from({length:t.capacities.reserve},()=>null),a=[];e.forEach(r=>{let s=pe(r.reserveSlot);s!==null&&!n[s]?n[s]=r:a.push(r)}),a.forEach(r=>{let s=n.findIndex(c=>!c);s>=0&&(n[s]=r)});let o=lo(t);return`
    <div class="ranked-reserve-panel">
      <div class="battle-formation battle-formation-grid battle-formation-player ranked-reserve-formation"
           data-ranked-zone="reserve" role="list" aria-label="Reserve">
        ${n.map((r,s)=>sn(r,s,{side:"player",allowFormationDrag:!0},"player")).join("")}
      </div>
      ${o.length?`
        <div class="ranked-reserve-buffs-shell">
          <button class="ranked-pact-scroll-btn is-previous" type="button" data-ranked-pact-scroll="-1"
                  aria-label="Scroll active buffs left" title="Scroll active buffs left" hidden disabled>
            ${E("chevron-left")}
          </button>
          <div class="ranked-reserve-buffs-viewport" data-ranked-pact-scroll-viewport tabindex="0"
               role="region" aria-label="Active Ranked Pacts, Skill Tree bonuses, and buffs">
            <div class="dungeon-hand-pacts ranked-reserve-buffs">
              ${o.map(Gi).join("")}
            </div>
          </div>
          <button class="ranked-pact-scroll-btn is-next" type="button" data-ranked-pact-scroll="1"
                  aria-label="Scroll active buffs right" title="Scroll active buffs right" hidden disabled>
            ${E("chevron-right")}
          </button>
        </div>
      `:""}
    </div>
  `}function qi(e){let n=e.closest(".ranked-reserve-buffs-shell")?.querySelector("[data-ranked-pact-scroll-viewport]");if(!n||e.disabled)return;let a=n.querySelector(".ranked-reserve-buffs"),o=a?.querySelector(".ranked-pact-stack"),r=a?window.getComputedStyle(a):null,s=parseFloat(r?.columnGap||""),c=parseFloat(r?.gap||""),l=Number.isFinite(s)?s:Number.isFinite(c)?c:0,d=o?.getBoundingClientRect().width||0,m=Number(e.dataset.rankedPactScroll)||0,u=Math.max(d+l,n.clientWidth*.72,1);n.scrollBy({left:m*u,behavior:"smooth"})}function uo(){ht&&window.cancelAnimationFrame(ht),ht=window.requestAnimationFrame(()=>{ht=0,mo()})}function mo(e=null){let t=e?[e]:Array.from(g.enemyGrid?.querySelectorAll(".ranked-reserve-buffs-shell")||[]),n=window.matchMedia("(max-width: 1199.98px)").matches;t.forEach(a=>{let o=a?.querySelector("[data-ranked-pact-scroll-viewport]"),r=Array.from(a?.querySelectorAll("[data-ranked-pact-scroll]")||[]);if(!o||!r.length)return;!n&&o.scrollLeft&&(o.scrollLeft=0);let s=Math.max(0,o.scrollWidth-o.clientWidth),c=n&&s>1,l=o.scrollLeft<=1,d=o.scrollLeft>=s-1;a.classList.toggle("has-scroll-overflow",c),a.classList.toggle("is-scroll-start",c&&l),a.classList.toggle("is-scroll-end",c&&d),r.forEach(m=>{let f=(Number(m.dataset.rankedPactScroll)||0)<0?l:d;m.hidden=!c||f,m.disabled=!c||f})})}function Yi(e,t={}){return Ci(e,{attributes:{"data-instance-id":e.instanceId,...t.zone!=="enemy"?{"data-ranked-workspace-id":e.instanceId,"data-ranked-zone":t.zone,draggable:t.interactive?"true":"false",role:"button",tabindex:t.interactive?"0":"-1"}:{}}})}function Wi(e,t={}){let n=p?.hand||[],a=!!t.canReviewFight,o=vo()&&!K,r=yo()&&!K,s=`Reroll hand for ${De} Ranked Souls`,c=e.handLocked?"Unlock hand for the next floor":"Lock hand for the next floor";return`
    <div class="ranked-reroll-rail">
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-reroll-action" type="button" data-ranked-action="reroll"
              title="${s}" aria-label="${s}" ${o?"":"disabled"}>
        <span class="ranked-reroll-main">
          <span class="ranked-reroll-icon" aria-hidden="true">${E("refresh-cw")}</span>
          <span class="ranked-reroll-copy">
            <strong>Reroll</strong>
          </span>
        </span>
        <span class="ranked-reroll-cost" aria-label="${De} Ranked Souls">
          ${E("soul")} <strong>${D(De)}</strong>
        </span>
      </button>
      ${Za(e)}
    </div>
    <div class="ranked-offer-area" data-ranked-drop-zone data-ranked-zone="hand" aria-label="Hand">
      <div class="ranked-offer-grid">
        ${n.length?n.map((l,d)=>`
            <div class="ranked-offer ${!l._rankedPurchased&&Me(l)>J?"is-unaffordable":""}"
                 data-ranked-drop-zone data-ranked-zone="hand" data-ranked-index="${d}">
              ${Yi(l,{interactive:!0,zone:"hand"})}
              <span class="ranked-offer-cost ${l._rankedPurchased?"is-purchased":""}"
                    aria-label="${l._rankedPurchased?"Purchased":`${Me(l)} Ranked Souls`}">
                ${l._rankedPurchased?E("check"):E("soul")}
                ${l._rankedPurchased?"":`<span>${D(Me(l))}</span>`}
              </span>
            </div>
          `).join(""):'<div class="ranked-hand-empty">Empty</div>'}
      </div>
      <div class="ranked-hand-sale-prompt" aria-hidden="true" hidden>
        <strong>Sell Demon</strong>
        <span>Drop team or reserve demon here</span>
      </div>
    </div>
    <div class="ranked-action-dock">
      <button class="btn ${e.handLocked?"btn-success":"btn-outline-light"} ranked-side-action ranked-side-action-compact ranked-lock-action"
              type="button" data-ranked-action="lock-hand" aria-pressed="${e.handLocked?"true":"false"}"
              title="${c}" aria-label="${c}">
        ${E(e.handLocked?"check":"save")} <span>${e.handLocked?"Locked":"Lock Hand"}</span>
      </button>
      <div class="ranked-review-actions" role="group" aria-label="Previous fight">
        ${pn(a,a)}
      </div>
    </div>
    <button class="btn btn-primary btn-lg ranked-side-action ranked-fight-action" type="button" data-ranked-action="fight"
            title="Start Ranked fight" aria-label="Start Ranked fight" ${r?"":"disabled"}>
      ${E("swords")} <span>Fight</span>
    </button>
    <div class="ranked-mobile-nav" role="group" aria-label="Ranked preparation controls">
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-reroll-btn" type="button" data-ranked-action="reroll"
              title="${s}" aria-label="${s}" ${o?"":"disabled"}>
        <span class="ranked-mobile-reroll-icon" aria-hidden="true">${E("refresh-cw")}</span>
        <span class="ranked-mobile-reroll-cost" aria-hidden="true">
          ${E("soul")} <strong>${D(De)}</strong>
        </span>
        <span class="visually-hidden">Reroll</span>
      </button>
      <details class="ranked-mobile-odds">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Reroll rarity odds" aria-label="Reroll rarity odds">
          ${E("info")}
          <span class="visually-hidden">Reroll rarity odds</span>
        </summary>
        <div class="ranked-mobile-odds-popover">
          ${Za(e)}
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ${e.handLocked?"active":""}" type="button"
              data-ranked-action="lock-hand" title="${c}" aria-label="${c}"
              aria-pressed="${e.handLocked?"true":"false"}">
        ${E(e.handLocked?"check":"save")}
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
      <button class="dungeon-mobile-nav-btn dungeon-mobile-fight-btn ranked-mobile-nav-btn ad-primary-action"
              type="button" data-ranked-action="fight" title="Start Ranked fight" aria-label="Start Ranked fight"
              ${r?"":"disabled"}>
        ${E("swords")}
        <span class="visually-hidden">Fight</span>
      </button>
    </div>
  `}function Za(e){let t=e?.rarityOdds||{};return`
    <div class="ranked-reroll-odds" aria-label="Reroll rarity odds per card">
      <span class="ranked-reroll-odds-grid">${Je.map(a=>{let o=Math.max(0,Number(t[a])||0),r=et(a);return`
      <span class="ranked-reroll-odd is-${a}${o<=0?" is-zero":""}"
            title="${F(r)}: ${D(o)}%"
            aria-label="${F(r)} ${D(o)} percent">
        <strong>${D(o)}%</strong>
      </span>
    `}).join("")}</span>
    </div>
  `}function go(){if(g.fightLog){if(!i.combatLog?.length){g.fightLog.innerHTML="Fight log will appear here after a battle.",g.fightLog.classList.add("text-muted");return}g.fightLog.classList.remove("text-muted"),g.fightLog.innerHTML=We(i.combatLog).map((e,t)=>tn(e,t)).join("")}}function fo(){let e=i.run;if(!(!e||!g.dungeonBottomControls||!g.dungeonReplayLogBox)){if(g.dungeonReplayLogBox.innerHTML="",i.isPactTeamPreview&&e.pendingPact){kn("pact",yn());return}if(i.isBattleAnimating){kn("battle",`
      ${hn()}
      ${bn()}
      ${vn()}
    `),ji();return}kn("empty","")}}function kn(e,t){g.dungeonBottomControls.dataset.rankedControlMode!==e&&(g.dungeonBottomControls.innerHTML=t,g.dungeonBottomControls.dataset.rankedControlMode=e)}function ji(){let e=g.dungeonBottomControls,t=i.combatPlayback||{},n=Number(t.currentIndex)||0,a=Number(t.totalSteps)||0,o=!!t.isPaused,r=o?"Play":"Pause",s=e.querySelector('[data-battle-step="-1"]'),c=e.querySelector('[data-battle-step="1"]'),l=e.querySelector("#battlePlaybackToggleBtn");s&&(s.disabled=n<=0),c&&(c.disabled=n>=a),l&&l.getAttribute("aria-label")!==r&&(l.title=r,l.setAttribute("aria-label",r),l.innerHTML=E(o?"play":"pause")),ut()}function Ja(e){let t=!!e?.length,n=t&&!i.isBattleAnimating&&!i.isLoading&&!se,a=!g.demonicPactOverlay.classList.contains("d-none");if(g.demonicPactOverlay.classList.toggle("d-none",!n),!n){i.isPactTeamPreview=!1,Qa(),t||(g.rankedPactGrid.innerHTML="",delete g.rankedPactGrid.dataset.pactSignature);return}a||(i.isPactTeamPreview=!1);let o=e.map(r=>`${r.id}:${r.rarity||"common"}`).join("|");g.rankedPactGrid.dataset.pactSignature!==o&&(g.rankedPactGrid.innerHTML=e.map(r=>{let s=String(r.rarity||"common").toLowerCase();return`
        <button class="demonic-pact-card is-${F(s)}" type="button" data-ranked-action="pact" data-buff-id="${F(r.id)}">
          <span class="demonic-pact-icon" aria-hidden="true">${E(r.icon||"sparkles")}</span>
          <span class="demonic-pact-rarity ad-${F(s)}">${et(s)}</span>
          <strong>${F(r.name||r.id)}</strong>
          <span class="demonic-pact-description">${F(r.description||"")}</span>
          <span class="demonic-pact-tags">${(r.tags||[]).map(c=>`<span>${F(c)}</span>`).join("")}</span>
        </button>
      `}).join(""),g.rankedPactGrid.dataset.pactSignature=o),Qa(),a||he?.play("sfx.dungeon.pactReveal",{volume:.88})}function Ki(){!g.demonicPactOverlay||g.demonicPactOverlay.classList.contains("d-none")||(i.isPactTeamPreview=!i.isPactTeamPreview,_())}function Qa(){let e=!!i.isPactTeamPreview;g.demonicPactOverlay?.classList.toggle("is-team-preview",e),g.demonicPactViewToggle&&(g.demonicPactViewToggle.classList.toggle("d-none",e),g.demonicPactViewToggle.textContent="View Team",g.demonicPactViewToggle.setAttribute("aria-expanded",String(!e)))}function Ui(e){let t=Number(e.highestClearedFloor)||0,n=Math.max(t,Number(e.floor)||1);return`
    <div class="ranked-end-card">
      <span class="dungeon-phase-eyebrow">${F(e.season?.name||"Ranked Season")}</span>
      <h1>${t>=tt?"Ranked Victory":"Run Complete"}</h1>
      <p>Reached Floor ${D(n)} &middot; Cleared Floor ${D(t)} &middot; ${ws(e.rating?.runDelta||0)} Rank Points</p>
      <p class="text-muted">${F(e.rating?.division||"")} &middot; ${D(e.rating?.rating||0)} RP</p>
      <button class="btn btn-primary btn-lg" type="button" data-ranked-action="start">Start New Run</button>
    </div>
  `}function Xi(e){(e||[]).forEach(t=>{if(t.deferredPreview)return;let n=`${t.resultInstanceId}:${t.fromRarity}:${t.toRarity}`;ja.has(n)||(ja.add(n),window.AmongDemons.showGameAlert?.({type:"success",title:`${et(t.toRarity)} combination!`,message:`Three identical ${et(t.fromRarity)} demons became one ${et(t.toRarity)} demon.`,action:`The upgraded demon stayed in ${t.destination==="active"?"your formation":"Reserve"}.`}),window.setTimeout(()=>{document.querySelector(`[data-instance-id="${Dn(t.resultInstanceId)}"]`)?.classList.add("is-team-upgrade")},0))})}function Zi(){document.querySelectorAll(".dungeon-demon-card[data-instance-id]").forEach(e=>{e.dataset.rankedDetailsBound!=="true"&&(e.dataset.rankedDetailsBound="true",e.addEventListener("click",t=>{t.defaultPrevented||Date.now()<Pn||e.classList.contains("is-dragging")||e.classList.contains("suppress-detail-click")||po(e)}))})}function po(e){let t=es(e?.dataset.instanceId);t&&window.AmongDemons.ui?.openDemonDetailsModal?.(t)}async function Ji(e){await qa(e==="player"?"victory":"defeat",{syncActions:!1})}function ho(e,t={}){if(!g.rankedVictoryModal||!window.bootstrap?.Modal)return;let n=e?.rating?.division||"Bronze II",a=Ln(n),o=Math.max(0,Number(t.rankGain??e?.victoryRankGain??e?.rating?.runDelta)||0),r=Math.max(0,Number(e?.rating?.rating)||0),s=`${e?.runId||"ranked"}:${tt}`,c=g.rankedVictoryRankImage?.closest(".ranked-victory-rank");c?.classList.forEach(l=>{l.startsWith("ranked-rank--")&&c.classList.remove(l)}),c?.classList.add(`ranked-rank--${a.slug}`),g.rankedVictoryRankImage&&(g.rankedVictoryRankImage.src=a.imageUrl,g.rankedVictoryRankImage.alt=`${a.division} rank emblem`),g.rankedVictoryDivision&&(g.rankedVictoryDivision.textContent=a.division),g.rankedVictoryRankGain&&(g.rankedVictoryRankGain.textContent=`+${D(o)} RP`),g.rankedVictorySummary&&(g.rankedVictorySummary.textContent=`${D(r)} total RP. Continue into Endless or close this run and begin again.`),vt(!1),window.bootstrap.Modal.getOrCreateInstance(g.rankedVictoryModal,{backdrop:"static",keyboard:!1}).show(),Ua!==s&&(Ua=s,he?.play("sfx.dungeon.extract",{volume:.94,queueUntilUnlock:!0}))}async function Qi(e){if(!(K||!R?.awaitingVictoryChoice)){if(vt(!0),e==="endless"){let t=await Fe("continue",{});if(t?.run&&!t.run.awaitingVictoryChoice){window.bootstrap?.Modal.getOrCreateInstance(g.rankedVictoryModal)?.hide(),_e("Endless floor unlocked.","success");return}vt(!1);return}if(e==="new-run"&&(await Fe("end",{}))?.run?.status==="ended"){window.location.href=window.AmongDemons.appUrl("/ranked");return}vt(!1)}}function vt(e){g.rankedVictoryModal?.querySelectorAll("[data-ranked-victory-action]").forEach(t=>{t.classList.toggle("disabled",!!e),t.setAttribute("aria-disabled",e?"true":"false"),t.matches("button")&&(t.disabled=!!e)})}function es(e){return[...i.run?.team||[],...i.run?.reserve||[],...i.run?.enemies||[],...p?.hand||[]].find(t=>t?.instanceId===e)}function Cn(e){return!!(e?.status==="active"&&["draft","selection","preparation"].includes(e.phase))}function ts(e){xn=[],Rn=new Set((e.offers||[]).filter(o=>o.purchased).map(o=>String(o.offerId)));let t=j(e.active||e.team).map((o,r)=>({...kt(o,e),formationSlot:ce(o.formationSlot)??r,_rankedOrigin:"roster",_rankedPurchased:!0})),n=j(e.reserve).map((o,r)=>({...kt(o,e),reserveSlot:pe(o.reserveSlot)??r,_rankedOrigin:"roster",_rankedPurchased:!0})),a=(e.offers||[]).map(o=>({...kt(o.demon,e),_rankedOrigin:"offer",_rankedOfferId:o.offerId,_rankedCost:Math.max(0,Number(o.cost)||Me(o.demon)),_rankedPurchased:!!o.purchased}));return{active:t,reserve:n,hand:a}}function kt(e={},t=R){let n=JSON.parse(JSON.stringify(e)),a=`${Number(n.typeId||n.type_id||n.type)}:${String(n.rarity||"common").toLowerCase()}`,o=t?.previewStats?.[a];return o?{...n,...JSON.parse(JSON.stringify(o)),hp:Math.max(1,Number(o.maxHp)||Number(o.hp)||1),_rankedPactPreviewApplied:!0}:n}function ns(){!p||!i.run||!Cn(R)||(i.run.team=p.active,i.run.active=p.active,i.run.reserve=p.reserve,i.run.offers=p.hand.filter(e=>e._rankedOrigin==="offer").map(e=>({offerId:e._rankedOfferId,demon:e})))}function bo(){return{purchasedOfferIds:[...Rn],sold:xn.map(e=>Ze(e)),active:(p?.active||[]).map(e=>({...Ze(e),formationSlot:ce(e.formationSlot)})),reserve:(p?.reserve||[]).map(e=>({...Ze(e),reserveSlot:pe(e.reserveSlot)})),hand:(p?.hand||[]).map(e=>Ze(e))}}function Ze(e){return e?._rankedCombinationRecipe?{combination:JSON.parse(JSON.stringify(e._rankedCombinationRecipe))}:{instanceId:e?.instanceId}}function yo(){return!!(p&&R?.status==="active"&&!R.pendingPact&&p.active.length>0&&p.active.length<=Number(R.capacities?.active||6)&&p.reserve.length<=Number(R.capacities?.reserve||6))}function vo(){return!p||!["draft","selection"].includes(R?.phase)||R.pendingPact?!1:J>=De}function as(){!p||se||i.isBattleAnimating||i.run?.phase==="result"||(g.teamGrid.querySelectorAll(".formation-slot").forEach(e=>{let t=e.querySelector(".formation-lane-cards");if(!t)return;t.dataset.rankedDropZone="",t.dataset.rankedZone="active",t.dataset.formationSlot=e.dataset.formationSlot;let n=t.querySelector(".dungeon-demon-card[data-instance-id]");n&&(n.dataset.rankedWorkspaceId=n.dataset.instanceId,n.dataset.rankedZone="active",n.setAttribute("draggable","true"))}),g.enemyGrid.querySelectorAll(".ranked-reserve-formation .formation-slot").forEach((e,t)=>{e.setAttribute("aria-label",`Reserve slot ${t+1}`);let n=e.querySelector(".formation-lane-cards");if(!n)return;n.dataset.rankedDropZone="",n.dataset.rankedZone="reserve",n.dataset.rankedIndex=String(t);let a=n.querySelector(".dungeon-demon-card[data-instance-id]");a&&(a.dataset.rankedWorkspaceId=a.dataset.instanceId,a.dataset.rankedZone="reserve",a.setAttribute("draggable","true"))}))}function os(){if(!p||se||i.isBattleAnimating||i.run?.phase==="result")return;rs().forEach(t=>{let n=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${Dn(t)}"]`);n&&(n.classList.add("is-ranked-combine-ready"),n.querySelector(".dungeon-team-upgrade-indicator")||n.insertAdjacentHTML("afterbegin",cn()))})}function rs(){let e=new Map;return[...p?.active||[],...p?.reserve||[],...p?.hand||[]].forEach(t=>{let n=String(t?.rarity||"").toLowerCase(),a=Number(t?.typeId||t?.type_id||t?.type);if(!a||!Bn(n))return;let o=`${a}:${n}`,r=e.get(o)||[];r.push(String(t.instanceId)),e.set(o,r)}),new Set([...e.values()].filter(t=>t.length>=3).flat())}function wt(e){if(!p||!(e instanceof Element))return null;let t=e.closest("[data-ranked-workspace-id]");return t||e.closest("[data-ranked-drop-zone]")}function Rt(e){for(let t of["active","reserve","hand"]){let n=p?.[t]?.findIndex(a=>String(a.instanceId)===String(e));if(n>=0)return{zone:t,index:n,slot:t==="active"?ce(p[t][n].formationSlot):t==="reserve"?pe(p[t][n].reserveSlot)??n:null}}return null}function is(e){let t=e.closest?.("[data-ranked-workspace-id]");if(t){let s=Rt(t.dataset.rankedWorkspaceId);return s?{...s,occupantId:t.dataset.rankedWorkspaceId}:null}let n=e.dataset.rankedZone;if(!["active","reserve","hand"].includes(n))return null;let a=n==="active"?ce(e.dataset.formationSlot??e.closest(".formation-slot")?.dataset.formationSlot):n==="reserve"?pe(e.dataset.rankedIndex??e.closest(".formation-slot")?.dataset.formationSlot):null,o=Number(e.dataset.rankedIndex),r=Number.isInteger(o)&&o>=0?o:p[n].length;return{zone:n,slot:a,index:r,occupantId:null}}async function ko(e,t,n=null){if(!p||K||i.isBattleAnimating)return;let a=Rt(e),o=is(t);if(!a||!o||o.occupantId===String(e)){W();return}let r={active:j(p.active),reserve:j(p.reserve),hand:j(p.hand)},s=p[a.zone][a.index],c=o.occupantId?p[o.zone][o.index]:null;if(a.zone!=="hand"&&o.zone==="hand"){cs(s,n,t),W(),_();return}let l=a.zone==="hand"&&s?._rankedOrigin==="offer"&&!s._rankedPurchased&&["active","reserve"].includes(o.zone)?s:o.zone==="hand"&&c?._rankedOrigin==="offer"&&!c._rankedPurchased&&["active","reserve"].includes(a.zone)?c:null,d=l?Me(l):0;if(l&&d>J){W(),_e(`This card costs ${D(d)} rSouls.`,"warning"),_();return}let m=ss(s,a,o,c);if(m){$t(e),eo(l,d,n,t);let $=[wo(m.consumed,m.destinationEntry,m.rarity),...no()].filter(Boolean);W(),_(),ao($);return}let u=Number(R.capacities?.active||6);if(o.zone==="active"&&a.zone!=="active"&&!o.occupantId&&p.active.length>=u){W(),_e(`Floor ${D(R.floor)} allows ${D(u)} active demons.`,"warning"),_();return}let f=$t(e),S=o.occupantId?$t(o.occupantId):null;if(!f||!to(f,o)){p=r,W(),_();return}if(S&&!to(S,a)){p=r,W(),_();return}(p.active.length>Number(R.capacities?.active||6)||p.reserve.length>Number(R.capacities?.reserve||6))&&(p=r),p!==r&&l&&eo(l,d,n,t);let y=p===r?[]:no();W(),_(),ao(y)}function ss(e,t,n,a){if(t.zone!=="hand"||e?._rankedOrigin!=="offer"||e._rankedPurchased||!["active","reserve"].includes(n.zone)||!n.occupantId||!a)return null;let o=String(e.rarity||"").toLowerCase(),r=Number(e.typeId||e.type_id||e.type);if(!Bn(o)||Number(a.typeId||a.type_id||a.type)!==r||String(a.rarity||"").toLowerCase()!==o)return null;let s=[...p.active.map(d=>({zone:"active",demon:d})),...p.reserve.map(d=>({zone:"reserve",demon:d}))].filter(d=>Number(d.demon?.typeId||d.demon?.type_id||d.demon?.type)===r&&String(d.demon?.rarity||"").toLowerCase()===o),c=s.find(d=>String(d.demon.instanceId)===String(a.instanceId)),l=s.find(d=>String(d.demon.instanceId)!==String(a.instanceId));return!c||!l?null:{rarity:o,destinationEntry:c,consumed:[c,l,{zone:"hand",demon:e}]}}function eo(e,t,n,a){e&&(e._rankedPurchased=!0,e._rankedCost=t,Rn.add(String(e._rankedOfferId)),J=Math.max(0,J-t),Lt(n||xt(null,a),-t),he?.play("sfx.world.merchantPurchase",{volume:.82}))}function cs(e,t,n){if(!e)return;let a=$t(e.instanceId);if(!a)return;let o=ys(a);xn.push(a),J+=o,Lt(t||xt(null,n),o,{interest:!0}),he?.play("sfx.world.merchantPurchase",{volume:.82})}function $t(e){let t=Rt(e);return t&&p[t.zone].splice(t.index,1)[0]||null}function to(e,t){if(!e||!t||!p[t.zone])return!1;if(t.zone==="active"){if(p.active.length>=Number(R.capacities?.active||6))return!1;let a=ce(t.slot);return a===null||p.active.some(o=>ce(o.formationSlot)===a)?!1:(e.formationSlot=a,e.position=a%3===2?"front":"back",p.active.push(e),p.active.sort((o,r)=>Number(o.formationSlot)-Number(r.formationSlot)),!0)}if(t.zone==="reserve"&&p.reserve.length>=Number(R.capacities?.reserve||6))return!1;if(t.zone==="reserve"){let a=pe(t.slot??t.index);return a===null||p.reserve.some(o=>pe(o.reserveSlot)===a)?!1:(delete e.formationSlot,e.reserveSlot=a,e.position=e.preferredPosition==="back"?"back":"front",p.reserve.push(e),!0)}delete e.formationSlot,delete e.reserveSlot,e.position=e.preferredPosition==="back"?"back":"front";let n=Math.min(Math.max(0,Number(t.index)||0),p[t.zone].length);return p[t.zone].splice(n,0,e),!0}function no(){if(!p)return[];let e=[],t=!0;for(;t;){t=!1;for(let n of Je.slice(0,-1)){let a=new Map;[...p.active.map(l=>({zone:"active",demon:l})),...p.reserve.map(l=>({zone:"reserve",demon:l}))].forEach(l=>{if(String(l.demon?.rarity||"").toLowerCase()!==n)return;let d=`${Number(l.demon?.typeId)}:${n}`,m=a.get(d)||[];m.push(l),a.set(d,m)});let r=[...a.values()].find(l=>l.length>=3);if(!r)continue;let s=r.slice(0,3),c=s.find(l=>l.zone==="active")||s[0];e.push(wo(s,c,n)),t=!0;break}}return e}function wo(e,t,n){let a=new Set(e.map(r=>String(r.demon.instanceId)));p.active=p.active.filter(r=>!a.has(String(r.instanceId))),p.reserve=p.reserve.filter(r=>!a.has(String(r.instanceId)));let o=ls(e.map(r=>r.demon),Bn(n),t);return p[t.zone].push(o),t.zone==="active"&&p.active.sort((r,s)=>Number(r.formationSlot)-Number(s.formationSlot)),{resultInstanceId:o.instanceId,fromRarity:n,toRarity:o.rarity,destination:t.zone}}function ls(e,t,n){let a=e[0]||{},o=Number(a.typeId||a.type_id||a.type);Ka+=1;let r=`ranked-preview-combine-${Date.now()}-${Ka}`,s=Te?.types?.[String(o)]||{},c=Te?.demons?.find(m=>Number(m.type)===o&&String(m.rarity).toLowerCase()===t),l=Number(s.rarityMultiplier?.[t])||1,d=c?{instanceId:r,sourceDemonId:c.id,typeId:o,species:s.name||a.species,role:s.role||a.role,targeting:s.targeting||a.targeting,preferredPosition:s.preferredPosition==="back"?"back":"front",rarity:t,imageUrl:c.image_url||c.imageUrl,maxHp:bt(s.baseStats?.hp,l),hp:bt(s.baseStats?.hp,l),atk:bt(s.baseStats?.atk,l),speed:bt(s.baseStats?.speed,l),position:s.preferredPosition==="back"?"back":"front",attackMeter:0,ranked:!0}:{...JSON.parse(JSON.stringify(a)),instanceId:r,rarity:t,hp:Math.max(1,Number(a.maxHp)||Number(a.hp)||1),attackMeter:0};return delete d.formationSlot,delete d.reserveSlot,delete d._rankedCost,delete d._rankedOfferId,delete d._rankedPurchased,d._rankedOrigin="combination",d._rankedCombinationRecipe={sources:e.map(m=>Ze(m))},n.zone==="active"?(d.formationSlot=ce(n.demon.formationSlot),d.position=d.formationSlot%3===2?"front":"back"):d.reserveSlot=pe(n.demon.reserveSlot),kt(d)}function bt(e,t){let n=Number(e?.[0])||1,a=Number(e?.[1])||n;return Math.max(1,Math.round((n+a)/2*t))}function Bn(e){let t=Je.indexOf(String(e||"").toLowerCase());return t>=0&&t<Je.length-1?Je[t+1]:null}function ao(e){e?.length&&window.requestAnimationFrame(()=>{let t=0;e.forEach(n=>{let a=document.querySelector(`.ranked-page .dungeon-demon-card[data-instance-id="${Dn(n.resultInstanceId)}"]`);if(!a)return;let o=t*120;t+=1,window.setTimeout(()=>{ds(a),he?.play("sfx.progression.trainingSuccess",{volume:.88})},o)})})}function ds(e){let t=e?.getBoundingClientRect?.();if(!t)return;let n=document.createElement("span");n.className="ranked-combination-nova",n.setAttribute("aria-hidden","true"),n.style.setProperty("--ranked-combination-nova-size",`${Math.round(Math.max(48,t.width,t.height)*1.5)}px`),n.style.left=`${Math.round(t.left+t.width/2)}px`,n.style.top=`${Math.round(t.top+t.height/2)}px`,n.innerHTML=`
    <span class="ranked-combination-nova-ring"></span>
    <span class="ranked-combination-nova-ring is-delayed"></span>
    <span class="ranked-combination-nova-core"></span>
    ${Array.from({length:6},(a,o)=>`<span class="ranked-combination-nova-ray" style="--angle: ${o*60}deg"></span>`).join("")}
  `,document.body.appendChild(n),e.classList.add("is-ranked-upgrading"),n.addEventListener("animationend",a=>{a.target===n&&n.remove()}),window.setTimeout(()=>{n.remove(),e.classList.remove("is-ranked-upgrading")},1e3)}function W(){document.querySelectorAll(".is-drag-over").forEach(e=>e.classList.remove("is-drag-over"))}function An(e){let t=Rt(e);$o(!!(t&&t.zone!=="hand"))}function St(){$o(!1)}function $o(e){let t=!!e,n=g.rankedPreparation?.querySelector(".ranked-offer-area"),a=n?.querySelector(".ranked-offer-grid"),o=n?.querySelector(".ranked-hand-sale-prompt");document.documentElement.classList.toggle("is-ranked-selling-demon",t),g.rankedBottomPanel?.classList.toggle("is-ranked-selling-demon",t),n?.classList.toggle("is-ranked-sale-target",t),n?.setAttribute("aria-label",t?"Sell Demon":"Hand"),a?.toggleAttribute("hidden",t),n?.querySelectorAll(".ranked-offer, .ranked-hand-empty").forEach(r=>{r.toggleAttribute("hidden",t)}),o?.toggleAttribute("hidden",!t),o?.setAttribute("aria-hidden",String(!t))}function us(e){if(e.button!==void 0&&e.button!==0)return;let t=e.target.closest("[data-ranked-workspace-id]");!t||!p||K||i.isBattleAnimating||(w={card:t,instanceId:t.dataset.rankedWorkspaceId,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,active:!1,ghost:null,target:null},An(w.instanceId),t.setPointerCapture?.(e.pointerId))}function ms(e){if(!w||e.pointerId!==w.pointerId)return;let t=Math.hypot(e.clientX-w.startX,e.clientY-w.startY);if(!w.active&&t<8)return;w.active||gs(e),e.cancelable&&e.preventDefault(),w.ghost.style.left=`${e.clientX}px`,w.ghost.style.top=`${e.clientY}px`,w.ghost.hidden=!0;let n=document.elementFromPoint(e.clientX,e.clientY);w.ghost.hidden=!1;let a=wt(n);W(),a?.classList.add("is-drag-over"),w.target=a}function gs(e){w.active=!0,An(w.instanceId),w.card.classList.add("is-dragging","is-pointer-dragging","suppress-detail-click"),w.ghost=w.card.cloneNode(!0),w.ghost.classList.add("pointer-drag-ghost"),w.ghost.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click","is-drag-over"),w.ghost.removeAttribute("role"),w.ghost.removeAttribute("tabindex"),w.ghost.setAttribute("aria-hidden","true"),w.ghost.style.width=`${w.card.getBoundingClientRect().width}px`,w.ghost.style.left=`${e.clientX}px`,w.ghost.style.top=`${e.clientY}px`,document.body.appendChild(w.ghost)}function fs(e){if(!w||e.pointerId!==w.pointerId)return;let t=w;if(t.active){e.cancelable&&e.preventDefault(),e.stopPropagation(),Pn=Date.now()+350;let n=t.target;Sn(),n&&ko(t.instanceId,n,{x:e.clientX,y:e.clientY});return}Sn()}function ps(e){!w||e.pointerId!==w.pointerId||Sn({preserveSaleTarget:yt})}function Sn(e={}){w&&(w.card?.classList.remove("is-dragging","is-pointer-dragging","suppress-detail-click"),w.ghost?.remove(),w=null,e.preserveSaleTarget||St(),W())}function hs(e){return e?.position==="back"?"back":"front"}function bs(){return""}function So(){if(!g.dungeonCenterActions)return;let e=Math.max(1,Number(i.run?.floor)||1);g.dungeonCenterActions.innerHTML=`
    <span class="dungeon-floor-marker ranked-floor-marker" aria-label="Current floor ${D(e)}">
      <span>Floor</span>
      <strong>${D(e)}</strong>
    </span>
  `}function ce(e){let t=Number(e);return Number.isInteger(t)&&t>=0&&t<9?t:null}function pe(e){let t=Number(e),n=Number(R?.capacities?.reserve||6);return Number.isInteger(t)&&t>=0&&t<n?t:null}function Me(e){let t=Number(e?._rankedCost);if(Number.isFinite(t)&&t>=0)return Math.floor(t);let n=String(e?.rarity||"common").toLowerCase();return Wa[n]||Wa.common}function ys(e){return Math.ceil(Me(e)/2)}function En(e,t={}){if(!e)return;let n=window.AmongDemons.getSession?.()||{};window.AmongDemons.setSession?.({...n,player:{...n.player||{},...e}}),window.AmongDemons.ui?.updateNavAccount?.(e,t)}function xt(e,t){if(Number.isFinite(e?.clientX)&&Number.isFinite(e?.clientY)&&(e.clientX||e.clientY))return{x:e.clientX,y:e.clientY};let n=t?.getBoundingClientRect?.();return n?{x:n.left+n.width/2,y:n.top+n.height/2}:{x:window.innerWidth/2,y:window.innerHeight/2}}function vs(e){let t=g.rankedHandStatus?.querySelector(".ranked-rsoul-value");Lt(xt(null,t),e,{interest:!0})}function Lt(e,t,n={}){let a=document.createElement("span"),o=Number(t)||0,r=Math.round(Number(e?.x)||window.innerWidth/2),s=Math.round(Number(e?.y)||window.innerHeight/2);a.className=["ranked-soul-spend-float",o>0?"is-gain":"is-spend",n.interest?"is-interest":""].filter(Boolean).join(" "),a.style.left=`${r}px`,a.style.top=`${s}px`,a.innerHTML=n.interest?`<strong>+</strong>${E("soul")}<strong>${D(Math.abs(o))}</strong>`:`${E("soul")}<strong>${o>0?"+":"-"}${D(Math.abs(o))}</strong>`,document.body.appendChild(a),a.addEventListener("animationend",()=>a.remove(),{once:!0}),window.setTimeout(()=>a.remove(),1400)}function wn(e){i.isLoading=!!e,g.runLoading?.classList.toggle("d-none",!e)}function Ne(e){K=!!e,document.documentElement.classList.toggle("is-ranked-busy",K)}function Ct(e){console.error(e),window.AmongDemons.setGameAlert(g.rankedMessage,e,{type:"danger"})}function _e(e,t="info"){window.AmongDemons.setGameAlert(g.rankedMessage,e,{type:t})}function ks(){return crypto.randomUUID?crypto.randomUUID():`ranked-${Date.now()}-${Math.random().toString(36).slice(2,12)}`}function j(e=[]){return(e||[]).map(t=>JSON.parse(JSON.stringify(t)))}function et(e){let t=String(e||"");return t?t.charAt(0).toUpperCase()+t.slice(1):""}function D(e){return Number(e||0).toLocaleString()}function ws(e){let t=Number(e)||0;return`${t>0?"+":""}${D(t)}`}function Dn(e){return window.CSS?.escape?window.CSS.escape(String(e)):String(e).replace(/["\\]/g,"\\$&")}function F(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function $s(e){if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",e,{once:!0});return}e()}})();
