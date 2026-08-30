const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const baseCss=fs.readFileSync(path.join(__dirname,'../public/app/css/base.css'),'utf8');
const combatSource=fs.readFileSync(path.join(__dirname,'../public/app/js/dungeon/combat.js'),'utf8');

function loadCombat() {
  const created=[];
  const cards=new Map(['goh','baobaw','target'].map((id,index)=>[id,{
    getBoundingClientRect:()=>({left:index*200,top:100,width:130,height:130})
  }]));
  const context={
    window:{AmongDemons:{},innerWidth:1000,innerHeight:800},
    state:{battleSpeed:1,combatDemons:new Map(),run:{
      team:[{instanceId:'goh',typeId:6,position:'back'},{instanceId:'baobaw',typeId:7,position:'front'}],
      enemies:[{instanceId:'target',typeId:1,position:'front'}]
    }},
    dungeonActions:{getDemonPosition:d=>d.position},
    cssEscape:String,escapeHtml:String,setTimeout:()=>0,
    document:{
      querySelector:selector=>cards.get(selector.match(/data-instance-id="([^"]+)"/)?.[1]),
      createElement:()=>({style:{values:{},setProperty(name,value){this.values[name]=value;}},remove(){}}),
      body:{appendChild:element=>created.push(element)}
    }
  };
  vm.createContext(context);
  const read=name=>fs.readFileSync(path.join(__dirname,'../public/app/js/dungeon',name),'utf8');
  vm.runInContext(read('config.js').replace(/^export /gm,''),context);
  vm.runInContext(read('combat.js').replace(/^import .+;\r?$/gm,'').replace(/export \{[\s\S]*?\};?\s*$/,''),context);
  return {context,created};
}

test('Goh Loomb stays a fast assassin zap and Baobaw stays a swipe after the palette swap',()=>{
  const {context,created}=loadCombat();
  for(const [attacker,key,travel,cssClass,color,shadow] of [
    ['goh','assassin',120,'attack-zap','#FFB23F','rgba(255,178,63,0.9)'],
    ['baobaw','melee',170,'sword-swing','#C084FC','rgba(192,132,252,0.9)']
  ]){
    const profile=context.getAttackProfile({attacker,target:'target'});
    assert.equal(profile.key,key);
    assert.equal(profile.travel,travel);
    profile.draw();
    const effect=created.at(-1);
    assert(effect.className.includes(cssClass));
    context.showFloatingDamage('target',42,'damage',attacker);
    const number=created.at(-1);
    assert.equal(number.innerHTML,'-42');
    for(const element of [effect,number]){
      assert.equal(element.style.values['--combat-color'],color);
      assert.equal(element.style.values['--combat-shadow'],shadow);
    }
  }
});

test('floating combat amounts are at least twice their original size',()=>{
  const floatingRule=baseCss.match(/\.floating-combat-number\s*\{([^}]*)\}/)?.[1]||'';
  assert.match(floatingRule,/font-size:\s*2\.44rem;/);
  assert.match(combatSource,/fontSize = `calc\(2\.44rem \* \$\{scale\.toFixed\(2\)\}\)`/);
});
