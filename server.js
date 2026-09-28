// 好友大富翁 · 联网版服务端
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8000;

/* ---------- 静态文件 ---------- */
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(__dirname, 'public', p);
  if (!fp.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

/* ---------- 常量数据（与客户端共享） ---------- */
const PLAYER_COLORS = ['#ff5d5d', '#5fb8ff', '#5fd07e', '#ffd23f'];
const PLAYER_AV = ['🔴', '🔵', '🟢', '🟡'];
const START_CASH = 1500, GO_BONUS = 200, JAIL_FINE = 50;

const SPACES = [
  { t:'go', name:'起点' },
  { t:'prop', name:'胡同甲', g:'brown', price:60, rent:[2,10,30,90,160,250] },
  { t:'fate', name:'命运' },
  { t:'prop', name:'胡同乙', g:'brown', price:60, rent:[4,20,60,180,320,450] },
  { t:'tax', name:'所得税', amount:200 },
  { t:'rr', name:'北方车站', price:200 },
  { t:'prop', name:'小镇甲', g:'lblue', price:100, rent:[6,30,90,270,400,550] },
  { t:'chance', name:'机会' },
  { t:'prop', name:'小镇乙', g:'lblue', price:100, rent:[6,30,90,270,400,550] },
  { t:'prop', name:'小镇丙', g:'lblue', price:120, rent:[8,40,100,300,450,600] },
  { t:'jail', name:'监狱' },
  { t:'prop', name:'老街甲', g:'pink', price:140, rent:[10,50,150,450,625,750] },
  { t:'util', name:'电力公司', price:150 },
  { t:'prop', name:'老街乙', g:'pink', price:140, rent:[10,50,150,450,625,750] },
  { t:'prop', name:'老街丙', g:'pink', price:160, rent:[12,60,180,500,700,900] },
  { t:'rr', name:'东方车站', price:200 },
  { t:'prop', name:'新区甲', g:'orange', price:180, rent:[14,70,200,550,700,900] },
  { t:'fate', name:'命运' },
  { t:'prop', name:'新区乙', g:'orange', price:180, rent:[14,70,200,550,700,900] },
  { t:'prop', name:'新区丙', g:'orange', price:200, rent:[16,80,220,600,800,1000] },
  { t:'parking', name:'免费停车' },
  { t:'prop', name:'商街甲', g:'red', price:220, rent:[18,90,250,700,875,1050] },
  { t:'fate', name:'命运' },
  { t:'prop', name:'商街乙', g:'red', price:220, rent:[18,90,250,700,875,1050] },
  { t:'prop', name:'商街丙', g:'red', price:240, rent:[20,100,300,750,925,1100] },
  { t:'rr', name:'南方车站', price:200 },
  { t:'prop', name:'金融甲', g:'yellow', price:260, rent:[22,110,330,800,975,1150] },
  { t:'chance', name:'机会' },
  { t:'prop', name:'金融乙', g:'yellow', price:260, rent:[22,110,330,800,975,1150] },
  { t:'prop', name:'金融丙', g:'yellow', price:280, rent:[24,120,360,850,1025,1200] },
  { t:'gotojail', name:'入狱' },
  { t:'prop', name:'豪宅甲', g:'green', price:300, rent:[26,130,390,900,1100,1275] },
  { t:'prop', name:'豪宅乙', g:'green', price:300, rent:[26,130,390,900,1100,1275] },
  { t:'fate', name:'命运' },
  { t:'prop', name:'豪宅丙', g:'green', price:320, rent:[28,150,450,1000,1200,1400] },
  { t:'rr', name:'西方车站', price:200 },
  { t:'chance', name:'机会' },
  { t:'prop', name:'富豪甲', g:'dblue', price:350, rent:[35,175,500,1100,1300,1500] },
  { t:'tax', name:'奢侈税', amount:100 },
  { t:'prop', name:'富豪乙', g:'dblue', price:400, rent:[50,200,600,1400,1700,2000] },
];
const GROUPS = { brown:{n:2,house:50}, lblue:{n:3,house:50}, pink:{n:3,house:100}, orange:{n:3,house:100}, red:{n:3,house:150}, yellow:{n:3,house:150}, green:{n:3,house:200}, dblue:{n:2,house:200} };
const ITEMS = {
  rentfree:{ name:'🛡️免租卡', desc:'本次需付租金时自动免单' },
  x2rent:{ name:'💰双倍收租', desc:'本回合收到的租金翻倍' },
  teleport:{ name:'🚕传送卡', desc:'移动到指定格子' },
  steal:{ name:'🕵️偷钱卡', desc:'从某玩家偷取100' },
  protect:{ name:'💸收保护费', desc:'向所有其他玩家各收50' },
  swap:{ name:'🔄换房卡', desc:'与某玩家交换一块地产' },
  freeze:{ name:'🧊冻结卡', desc:'指定玩家下回合跳过' },
  reroll:{ name:'🎲重骰卡', desc:'本回合重新掷骰' },
  lucky:{ name:'🎁幸运卡', desc:'获得一个随机道具' },
  troll:{ name:'😈损友卡', desc:'指定玩家付100给银行' },
};
const ITEM_KEYS = Object.keys(ITEMS);
const CARDS = [
  { d:'意外之财', kind:'money', a:[100,200,300] },
  { d:'钱包被偷', kind:'money', a:[-100,-150,-200] },
  { d:'罚款通知', kind:'money', a:[-50,-75,-100] },
  { d:'市场上涨', kind:'item', a:['x2rent'] },
  { d:'幸运骰子', kind:'item', a:['reroll'] },
  { d:'损友事件', kind:'troll', a:[50,100] },
  { d:'银行分红', kind:'money', a:[50,80] },
  { d:'维修费', kind:'repair', a:[25,40] },
  { d:'生日红包', kind:'birthday', a:[20] },
  { d:'前进至起点', kind:'moveto', a:[0] },
  { d:'前进至车站', kind:'moveto', a:[5] },
  { d:'直达监狱', kind:'gotojail', a:[] },
];

/* ---------- 房间/连接管理 ---------- */
const rooms = new Map();      // code -> room
const conns = new Map();     // ws -> { id, roomCode|null }
let nextId = 1;

function genCode() {
  let c; do { c = String(Math.floor(1000 + Math.random()*9000)); } while (rooms.has(c));
  return c;
}
function randItem() { return ITEM_KEYS[Math.floor(Math.random()*ITEM_KEYS.length)]; }
function logPush(G, msg, cls='') { G.logs.push({ msg, cls }); if (G.logs.length > 60) G.logs.shift(); }

/* ---------- 游戏逻辑 ---------- */
function createGame(players) {
  return {
    players: players.map(p => ({
      id:p.id, name:p.name, color:p.color, av:p.av,
      cash:START_CASH, pos:0, props:[], items:[randItem()],
      jailTurns:0, skipNext:false, x2rentThisTurn:false, alive:true,
      rolledThisTurn:false, movedThisTurn:false, doubles:0,
    })),
    owners:Array(40).fill(null),
    houses:Array(40).fill(0),
    turn:0, turnIdx:0, phase:'roll',
    dice:[1,1], lastCardIdx:-1, logs:[],
    pending:null,
  };
}
const cur = G => G.players[G.turnIdx];
const alivePlayers = G => G.players.filter(p=>p.alive);
const rrCount = p => p.props.filter(i=>SPACES[i].t==='rr').length;
const utilCount = p => p.props.filter(i=>SPACES[i].t==='util').length;
const ownsFullGroup = (G,p,g) => SPACES.map((s,i)=>s.g===g?i:-1).filter(i=>i>=0).every(i=>G.owners[i]===p.id);
const isProp = i => { const t=SPACES[i].t; return t==='prop'||t==='rr'||t==='util'; };
const networth = (G,p) => { let v=p.cash; p.props.forEach(i=>{const s=SPACES[i];v+=s.price||0;v+=(G.houses[i]||0)*((GROUPS[s.g]?.house)||0);}); return v; };

function setPending(G, p) { G.pending = p; }
function clearPending(G) { G.pending = null; }

function startTurn(G, room) {
  const p = cur(G);
  if (!p.alive) { nextPlayer(G, room); return; }
  p.rolledThisTurn=false; p.movedThisTurn=false; p.x2rentThisTurn=false; G.phase='roll';
  if (p.skipNext) { logPush(G, `${p.av} ${p.name} 被冻结，跳过本回合。`, 'bad'); p.skipNext=false; nextPlayer(G, room); return; }
  if (p.jailTurns>0) {
    G.phase='jail';
    logPush(G, `${p.av} ${p.name} 在监狱中（剩余${p.jailTurns}），可交¥${JAIL_FINE}保释或尝试掷双数。`, 'evt');
    setPending(G, { forId:p.id, type:'jail', jailTurns:p.jailTurns });
    broadcast(room); return;
  }
  logPush(G, `—— 轮到 ${p.av} ${p.name} ——`);
  broadcast(room);
}

function onRoll(G, room) {
  if (G.phase!=='roll' && G.phase!=='reroll') return;
  const p = cur(G);
  if (p.rolledThisTurn) return;
  const d1 = 1+Math.floor(Math.random()*6), d2 = 1+Math.floor(Math.random()*6);
  G.dice = [d1,d2];
  const isDouble = d1===d2;
  if (G.phase==='reroll') G.phase='roll';
  if (p.jailTurns>0) {
    if (isDouble) { logPush(G, `${p.av} ${p.name} 掷出双 ${d1}，出狱！`, 'good'); p.jailTurns=0; movePlayer(G, room, d1+d2); }
    else {
      p.jailTurns--;
      if (p.jailTurns<=0) { logPush(G, `${p.av} ${p.name} 未掷出双数，且已满3回合，须交¥${JAIL_FINE}保释出狱。`, 'bad'); pay(G,p,JAIL_FINE,null,'保释金'); p.jailTurns=0; movePlayer(G, room, d1+d2); }
      else { logPush(G, `${p.av} ${p.name} 未掷出双数，仍在狱中（剩余${p.jailTurns}）。`, 'bad'); endTurn(G, room); }
    }
    broadcast(room); return;
  }
  logPush(G, `${p.av} ${p.name} 掷出 ${d1} + ${d2} = ${d1+d2}${isDouble?'（双数！）':''}`);
  p.rolledThisTurn=true;
  p.doubles = (p.doubles||0) + (isDouble?1:0);
  if (p.doubles>=3) { logPush(G, `${p.av} ${p.name} 连续3次双数，直接入狱！`, 'bad'); sendToJail(p); p.doubles=0; endTurn(G, room); return; }
  if (!isDouble) p.doubles=0;
  movePlayer(G, room, d1+d2);
}

function movePlayer(G, room, steps) {
  const p = cur(G);
  let np = p.pos + steps;
  if (np>=40) { np-=40; p.cash+=GO_BONUS; logPush(G, `${p.av} ${p.name} 经过起点，领¥${GO_BONUS}。`, 'good'); }
  p.pos=np; p.movedThisTurn=true;
  broadcast(room);
  setTimeout(()=>landOnSpace(G, room, np), 300);
}

function landOnSpace(G, room, pos) {
  if (G.pending) return; // 已有玩家决策在进行，丢弃过时的落地事件
  const s = SPACES[pos]; const p = cur(G);
  switch (s.t) {
    case 'go': endTurn(G, room); break;
    case 'parking': logPush(G, `${p.av} 踩到免费停车，无事发生。`); endTurn(G, room); break;
    case 'jail': logPush(G, `${p.av} 路过监狱（探监）。`); endTurn(G, room); break;
    case 'gotojail': logPush(G, `${p.av} ${p.name} 踩到入狱格，进监狱！`, 'bad'); sendToJail(p); endTurn(G, room); break;
    case 'tax': pay(G,p,s.amount,null,s.name); logPush(G, `${p.av} ${p.name} 缴${s.name} ¥${s.amount}。`, 'bad'); afterSpend(G, room, p); break;
    case 'chance': drawCard(G, room, 'chance'); break;
    case 'fate': drawCard(G, room, 'fate'); break;
    case 'prop': case 'rr': case 'util': handleProperty(G, room, pos); break;
  }
}

function afterSpend(G, room, p) { if (checkBankruptcy(G, room, p)) return; endTurn(G, room); }

function handleProperty(G, room, pos) {
  const s = SPACES[pos]; const p = cur(G); const owner = G.owners[pos];
  if (owner==null) {
    G.phase='move';
    setPending(G, { forId:p.id, type:'buy', pos, canBuy: p.cash>=s.price });
    broadcast(room);
  } else if (owner===p.id) {
    logPush(G, `${p.av} ${p.name} 到达自己的 ${s.name}，安全通过。`, 'good');
    endTurn(G, room);
  } else {
    const rfIdx = p.items.indexOf('rentfree');
    if (rfIdx>=0) { p.items.splice(rfIdx,1); logPush(G, `${p.av} ${p.name} 使用免租卡，免付 ${s.name} 租金！`, 'evt'); endTurn(G, room); return; }
    const rent = calcRent(G, p, owner, pos);
    const owe = p.x2rentThisTurn ? rent*2 : rent;
    if (p.x2rentThisTurn) logPush(G, `(双倍收租生效)`);
    pay(G, p, owe, G.players[owner], '租金');
    logPush(G, `${p.av} ${p.name} 向 ${G.players[owner].av} 支付 ${s.name} 租金 ¥${owe}。`, 'bad');
    G.players[owner].x2rentThisTurn=false;
    afterSpend(G, room, p);
  }
}

function calcRent(G, payer, owner, pos) {
  const s = SPACES[pos]; const ow = G.players[owner];
  if (s.t==='prop') { const h=G.houses[pos]; let r=s.rent[h]; if (h===0 && ownsFullGroup(G,ow,s.g)) r*=2; return r; }
  if (s.t==='rr') { const n=rrCount(ow); return [0,25,50,100,200][n]; }
  if (s.t==='util') { const n=utilCount(ow); return (n===2?10:4)*(G.dice[0]+G.dice[1]); }
  return 0;
}

/* 买地决策回传 */
function actBuy(G, room) {
  const p = cur(G); const pos = G.pending.pos; const s = SPACES[pos];
  if (p.cash < s.price) { clearPending(G); endTurn(G, room); return; }
  p.cash-=s.price; G.owners[pos]=p.id; p.props.push(pos);
  logPush(G, `${p.av} ${p.name} 购入 ${s.name}（¥${s.price}）。`, 'good');
  clearPending(G); afterSpend(G, room, p);
}
function actSkipBuy(G, room) { clearPending(G); logPush(G, `${cur(G).av} ${cur(G).name} 放弃购买。`); endTurn(G, room); }
function actAuction(G, room) {
  const pos = G.pending.pos; const s = SPACES[pos];
  const bidders = alivePlayers(G).map(p=>p.id);
  clearPending(G);
  G.pending = { forId:null, type:'auction', pos, bidders, cur:0, bid:0, topBidder:null, passed:[] };
  logPush(G, `🔨 ${s.name} 进入拍卖（起拍价 ¥0，每次加价 ≥¥10）。`, 'evt');
  broadcast(room);
}
function auctionCurId(G) {
  const a = G.pending; if (!a || a.type!=='auction') return null;
  return a.bidders[a.cur];
}
function actAuctionBid(G, room, amount) {
  const a = G.pending; if (!a || a.type!=='auction') return;
  const pid = a.bidders[a.cur];
  if (amount < a.bid+10) { sendError(room, pid, `出价须 ≥ ¥${a.bid+10}`); return; }
  if (amount > G.players[pid].cash) { sendError(room, pid, '现金不足'); return; }
  a.bid = amount; a.topBidder = pid;
  logPush(G, `${G.players[pid].av} ${G.players[pid].name} 出价 ¥${amount}。`);
  do { a.cur = (a.cur+1) % a.bidders.length; } while (a.passed.includes(a.bidders[a.cur]));
  broadcast(room);
}
function actAuctionPass(G, room) {
  const a = G.pending; if (!a || a.type!=='auction') return;
  const pid = a.bidders[a.cur];
  a.passed.push(pid);
  logPush(G, `${G.players[pid].av} ${G.players[pid].name} 弃权。`);
  const left = a.bidders.filter(id=>!a.passed.includes(id));
  if (left.length<=1 || (left.length===1 && a.topBidder!==null && left[0]===a.topBidder)) {
    auctionEnd(G, room); return;
  }
  do { a.cur = (a.cur+1) % a.bidders.length; } while (a.passed.includes(a.bidders[a.cur]) && a.passed.length<a.bidders.length);
  broadcast(room);
}
function auctionEnd(G, room) {
  const a = G.pending; const s = SPACES[a.pos];
  if (a.topBidder===null) { logPush(G, `拍卖流拍，${s.name} 无人购买。`, 'evt'); clearPending(G); endTurn(G, room); return; }
  const p = G.players[a.topBidder];
  p.cash-=a.bid; G.owners[a.pos]=p.id; p.props.push(a.pos);
  logPush(G, `🔨 成交！${p.av} ${p.name} 以 ¥${a.bid} 拍得 ${s.name}。`, 'good');
  clearPending(G); afterSpend(G, room, p);
}

/* 卡牌 */
function drawCard(G, room, kind) {
  let idx; do { idx = Math.floor(Math.random()*CARDS.length); } while (idx===G.lastCardIdx && CARDS.length>1);
  G.lastCardIdx = idx;
  const c = CARDS[idx]; const p = cur(G);
  logPush(G, `🎁 ${kind==='chance'?'机会':'命运'}卡：${c.d}（${kind}）`, 'evt');
  applyCard(G, room, c, p);
}
function applyCard(G, room, c, p) {
  switch (c.kind) {
    case 'money': {
      const amt = c.a[Math.floor(Math.random()*c.a.length)];
      if (amt>0) { p.cash+=amt; logPush(G, `${p.av} ${p.name} 获得 ¥${amt}。`, 'good'); }
      else { const cost=-amt; pay(G,p,cost,null,c.d); logPush(G, `${p.av} ${p.name} ${c.d} ¥${cost}。`, 'bad'); }
      afterSpend(G, room, p); break;
    }
    case 'item': { const it=c.a[Math.floor(Math.random()*c.a.length)]; p.items.push(it); logPush(G, `${p.av} ${p.name} 获得道具 ${ITEMS[it].name}。`, 'good'); endTurn(G, room); break; }
    case 'troll': {
      const amt=c.a[Math.floor(Math.random()*c.a.length)];
      G.players.forEach(o=>{ if (o.id!==p.id && o.alive) pay(G,o,amt,null,'损友事件'); });
      logPush(G, `${p.av} ${p.name} 触发损友事件，其他玩家各付 ¥${amt}。`, 'bad');
      endTurn(G, room); break;
    }
    case 'repair': {
      const per=c.a[Math.floor(Math.random()*c.a.length)]; let total=0;
      p.props.forEach(i=> total += (G.houses[i]||0)*per);
      if (total>0) { pay(G,p,total,null,'维修费'); logPush(G, `${p.av} ${p.name} 维修费 ¥${total}。`, 'bad'); afterSpend(G, room, p); }
      else { logPush(G, `${p.av} ${p.name} 无房产需维修。`); endTurn(G, room); }
      break;
    }
    case 'birthday': {
      const amt=c.a[0]; let got=0;
      G.players.forEach(o=>{ if (o.id!==p.id && o.alive) { if (o.cash>=amt) { o.cash-=amt; got+=amt; } else { got+=o.cash; o.cash=0; } } });
      p.cash+=got; logPush(G, `${p.av} ${p.name} 生日，每人送 ¥${amt}，共收 ¥${got}。`, 'good'); endTurn(G, room); break;
    }
    case 'moveto': {
      const target=c.a[0];
      if (p.pos>target) { p.cash+=GO_BONUS; logPush(G, `${p.av} ${p.name} 经过起点领¥${GO_BONUS}。`, 'good'); }
      p.pos=target; broadcast(room);
      setTimeout(()=>landOnSpace(G, room, target), 300);
      break;
    }
    case 'gotojail': { sendToJail(p); endTurn(G, room); break; }
  }
}

function sendToJail(p) { p.pos=10; p.jailTurns=3; p.doubles=0; }

/* 监狱决策 */
function actJailPay(G, room) {
  const p=cur(G); pay(G,p,JAIL_FINE,null,'保释金'); p.jailTurns=0;
  logPush(G, `${p.av} ${p.name} 交保释金出狱。`, 'bad');
  clearPending(G); G.phase='roll'; broadcast(room);
}
function actJailRoll(G, room) { clearPending(G); G.phase='roll'; onRoll(G, room); }

/* 付款/破产 */
function pay(G, p, amount, to, reason) {
  if (amount<=0) return;
  if (p.cash>=amount) { p.cash-=amount; if (to) to.cash+=amount; return; }
  raiseCash(G, p, amount);
  if (p.cash>=amount) { p.cash-=amount; if (to) to.cash+=amount; }
}
function raiseCash(G, p, need) {
  let guard=0;
  while (p.cash<need && guard++<200) {
    const i = p.props.find(idx=>G.houses[idx]>0); if (i==null) break;
    const s=SPACES[i]; const hc=GROUPS[s.g]?.house||0;
    G.houses[i]--; p.cash+=Math.floor(hc/2);
    logPush(G, `${p.av} ${p.name} 变卖 ${s.name} 1座房，得 ¥${Math.floor(hc/2)}。`, 'evt');
  }
  while (p.cash<need && p.props.length>0) {
    const i=p.props[0]; const s=SPACES[i]; const val=Math.floor((s.price||0)/2);
    if (val<=0) { p.props.shift(); continue; }
    p.cash+=val; G.owners[i]=null; p.props=p.props.filter(x=>x!==i); G.houses[i]=0;
    logPush(G, `${p.av} ${p.name} 抵押 ${s.name}，得 ¥${val}。`, 'bad');
  }
}
function checkBankruptcy(G, room, p) {
  if (p.cash>=0) return false;
  p.alive=false;
  p.props.forEach(i=>{ G.owners[i]=null; G.houses[i]=0; });
  p.props=[];
  logPush(G, `${p.av} ${p.name} 破产出局！💸`, 'bad');
  if (checkWin(G, room)) return true;
  return true;
}
function checkWin(G, room) {
  const alive = alivePlayers(G);
  if (alive.length<=1) {
    const winner = alive[0] || G.players.reduce((a,b)=>networth(G,a)>=networth(G,b)?a:b);
    G.phase='over'; G.winner = winner.id;
    broadcast(room);
    return true;
  }
  return false;
}

function endTurn(G, room) {
  if (G.phase==='over') return;
  const p = cur(G);
  if (p.doubles>0 && p.jailTurns===0 && p.movedThisTurn && p.alive) {
    logPush(G, `${p.av} ${p.name} 双数，获得额外回合！`, 'good');
    G.phase='roll'; p.movedThisTurn=false; p.rolledThisTurn=false; broadcast(room); return;
  }
  nextPlayer(G, room);
}
function nextPlayer(G, room) {
  if (G.phase==='over') return;
  for (let k=0;k<G.players.length;k++) {
    G.turnIdx=(G.turnIdx+1)%G.players.length; G.turn++;
    if (cur(G).alive) break;
  }
  startTurn(G, room);
}

/* 道具 */
function actUseItem(G, room, pid, itemKey) {
  if (pid!==cur(G).id || G.phase==='over') return;
  const p = cur(G);
  if (itemKey==='rentfree') { sendError(room, pid, '免租卡将在你被收租时自动使用，无需手动。'); return; }
  // 即时类
  if (itemKey==='x2rent') { consumeItem(p,'x2rent'); p.x2rentThisTurn=true; logPush(G, `${p.av} ${p.name} 启用双倍收租（本回合收租翻倍）。`, 'evt'); broadcast(room); return; }
  if (itemKey==='reroll') { consumeItem(p,'reroll'); G.phase='reroll'; logPush(G, `${p.av} ${p.name} 使用重骰卡，可重新掷骰。`, 'evt'); broadcast(room); return; }
  if (itemKey==='lucky') { consumeItem(p,'lucky'); const it=randItem(); p.items.push(it); logPush(G, `${p.av} ${p.name} 幸运卡，获得 ${ITEMS[it].name}。`, 'good'); broadcast(room); return; }
  if (itemKey==='protect') { consumeItem(p,'protect'); let got=0; G.players.forEach(o=>{ if (o.id!==p.id && o.alive) { const a=Math.min(50,o.cash); o.cash-=a; got+=a; } }); p.cash+=got; logPush(G, `${p.av} ${p.name} 收保护费，共 ¥${got}。`, 'good'); broadcast(room); return; }
  // 需选目标：设 pending，不立即消耗
  if (itemKey==='steal' || itemKey==='freeze' || itemKey==='troll') {
    const targets = alivePlayers(G).filter(o=>o.id!==p.id).map(o=>o.id);
    if (!targets.length) { sendError(room, pid, '没有可选目标。'); return; }
    setPending(G, { forId:p.id, type:'itemTarget', itemKey, targets });
    broadcast(room); return;
  }
  if (itemKey==='teleport') {
    const targets = SPACES.map((s,i)=>({i, t:s.t})).filter(x=>x.t==='prop'||x.t==='rr'||x.t==='util'||x.t==='go').map(x=>x.i);
    setPending(G, { forId:p.id, type:'teleport', itemKey, targets });
    broadcast(room); return;
  }
  if (itemKey==='swap') {
    const myProps = p.props.filter(i=>isProp(i));
    if (!myProps.length) { sendError(room, pid, '你没有可交换的地产。'); return; }
    const targets = alivePlayers(G).filter(o=>o.id!==p.id && o.props.some(i=>isProp(i))).map(o=>o.id);
    if (!targets.length) { sendError(room, pid, '没有可交换的玩家。'); return; }
    setPending(G, { forId:p.id, type:'swap', itemKey, myProps, targets });
    broadcast(room); return;
  }
}
function consumeItem(p, key) { const i=p.items.indexOf(key); if (i>=0) p.items.splice(i,1); }

/* 道具目标决策回传 */
function actItemTarget(G, room, targetId) {
  const pd = G.pending; if (!pd || pd.type!=='itemTarget') return;
  const p = cur(G); if (pd.forId!==p.id) return;
  const o = G.players[targetId]; if (!o || !o.alive || o.id===p.id) return;
  consumeItem(p, pd.itemKey);
  clearPending(G);
  if (pd.itemKey==='steal') { const amt=Math.min(100,o.cash); o.cash-=amt; p.cash+=amt; logPush(G, `${p.av} 从 ${o.av} ${o.name} 偷取 ¥${amt}。`, 'evt'); }
  if (pd.itemKey==='freeze') { o.skipNext=true; logPush(G, `${o.av} ${o.name} 被冻结，下回合跳过。`, 'evt'); }
  if (pd.itemKey==='troll') { pay(G,o,100,null,'损友卡'); logPush(G, `${o.av} ${o.name} 被损友，付¥100给银行。`, 'bad'); }
  broadcast(room);
}
function actTeleport(G, room, pos) {
  const pd = G.pending; if (!pd || pd.type!=='teleport') return;
  const p = cur(G); if (pd.forId!==p.id) return;
  if (!pd.targets.includes(pos)) return;
  consumeItem(p, pd.itemKey); clearPending(G);
  if (pos<p.pos) { p.cash+=GO_BONUS; logPush(G, `${p.av} ${p.name} 传送经过起点，领¥${GO_BONUS}。`, 'good'); }
  p.pos=pos; G.phase='move';
  logPush(G, `${p.av} ${p.name} 传送到 ${SPACES[pos].name}。`, 'evt');
  broadcast(room);
  setTimeout(()=>landOnSpace(G, room, pos), 300);
}
function actSwap(G, room, myPos, targetId, theirPos) {
  const pd = G.pending; if (!pd || pd.type!=='swap') return;
  const p = cur(G); if (pd.forId!==p.id) return;
  if (!pd.myProps.includes(myPos)) return;
  const t = G.players[targetId];
  if (!t || !t.alive || t.id===p.id || !t.props.includes(theirPos) || !isProp(theirPos)) return;
  consumeItem(p, pd.itemKey); clearPending(G);
  p.props = p.props.filter(x=>x!==myPos); p.props.push(theirPos);
  t.props = t.props.filter(x=>x!==theirPos); t.props.push(myPos);
  G.owners[myPos]=t.id; G.owners[theirPos]=p.id;
  logPush(G, `${p.av} ${p.name} 用 ${SPACES[myPos].name} 换了 ${t.av} ${t.name} 的 ${SPACES[theirPos].name}。`, 'evt');
  broadcast(room);
}
function actCancelPending(G, room, pid) {
  const pd = G.pending; if (!pd) return;
  if (pd.forId!==pid) return;
  // 不消耗道具（teleport/swap/itemTarget 未执行）
  clearPending(G); logPush(G, `${G.players[pid].av} ${G.players[pid].name} 取消操作。`);
  broadcast(room);
}

/* 交易 */
function actTradeOffer(G, room, fromId, offer) {
  // offer: { targetId, giveCash, giveProps:[], wantCash, wantProps:[] }
  const me = G.players[fromId]; const t = G.players[offer.targetId];
  if (!t || !t.alive || t.id===me.id) return;
  if (offer.giveCash>me.cash || offer.wantCash>t.cash) { sendError(room, fromId, '现金不足'); return; }
  if (offer.giveProps.some(i=>!me.props.includes(i)) || offer.wantProps.some(i=>!t.props.includes(i))) { sendError(room, fromId, '地产不属于该玩家'); return; }
  setPending(G, { forId:t.id, type:'trade', fromId, offer });
  logPush(G, `${me.av} ${me.name} 向 ${t.av} ${t.name} 提议交易。`, 'evt');
  broadcast(room);
}
function actTradeAccept(G, room, byId) {
  const pd = G.pending; if (!pd || pd.type!=='trade' || pd.forId!==byId) return;
  const me = G.players[pd.fromId]; const t = G.players[byId]; const o = pd.offer;
  if (o.giveCash>me.cash || o.wantCash>t.cash) { clearPending(G); sendError(room, byId, '现金不足，交易取消'); broadcast(room); return; }
  me.cash-=o.giveCash; t.cash+=o.giveCash; t.cash-=o.wantCash; me.cash+=o.wantCash;
  o.giveProps.forEach(i=>{ me.props=me.props.filter(x=>x!==i); t.props.push(i); G.owners[i]=t.id; });
  o.wantProps.forEach(i=>{ t.props=t.props.filter(x=>x!==i); me.props.push(i); G.owners[i]=me.id; });
  logPush(G, `${me.av} ${me.name} 与 ${t.av} ${t.name} 完成交易。`, 'evt');
  clearPending(G); broadcast(room);
}
function actTradeReject(G, room, byId) {
  const pd = G.pending; if (!pd || pd.type!=='trade' || pd.forId!==byId) return;
  logPush(G, `${G.players[byId].av} ${G.players[byId].name} 拒绝了交易。`, 'bad');
  clearPending(G); broadcast(room);
}

/* 建房 */
function actBuild(G, room, pid, pos) {
  if (pid!==cur(G).id || G.phase==='over') return;
  const p = cur(G); const s = SPACES[pos];
  if (!s.g || G.owners[pos]!==p.id || !ownsFullGroup(G,p,s.g) || G.houses[pos]>=5) return;
  const cost = GROUPS[s.g].house;
  if (p.cash<cost) { sendError(room, pid, '现金不足'); return; }
  p.cash-=cost; G.houses[pos]++;
  logPush(G, `${p.av} ${p.name} 在 ${s.name} 建${G.houses[pos]>=5?'酒店':'1座房'}（¥${cost}）。`, 'good');
  broadcast(room);
}

/* 认输 */
function actResign(G, room, pid) {
  if (pid!==cur(G).id || G.phase==='over') return;
  const p = cur(G); p.alive=false;
  p.props.forEach(i=>{ G.owners[i]=null; G.houses[i]=0; });
  p.props=[]; clearPending(G);
  logPush(G, `${p.av} ${p.name} 认输出局。`, 'bad');
  if (!checkWin(G, room)) nextPlayer(G, room);
}

/* ---------- 广播 ---------- */
function snapshot(room, forId) {
  const G = room.game;
  if (!G) return null;
  const snap = {
    players: G.players.map(p=>({
      id:p.id, name:p.name, color:p.color, av:p.av, cash:p.cash, pos:p.pos,
      props:[...p.props], items:[...p.items], jailTurns:p.jailTurns,
      skipNext:p.skipNext, x2rentThisTurn:p.x2rentThisTurn, alive:p.alive,
    })),
    owners:[...G.owners], houses:[...G.houses],
    turn:G.turn, turnIdx:G.turnIdx, phase:G.phase, dice:[...G.dice],
    logs:[...G.logs], winner:G.winner||null,
    myId:forId, roomCode:room.code, hostId:room.hostId, started:room.started,
  };
  // pending: 给所有人一个摘要（谁在决策、类型），细节只给 forId
  if (G.pending) {
    const pd = G.pending;
    const isMine = pd.forId===forId;
    if (pd.type==='auction') {
      // 拍卖全员可见细节
      snap.pending = {
        forId: pd.forId, type:'auction', pos:pd.pos,
        bid:pd.bid, topBidder:pd.topBidder,
        topBidderName: pd.topBidder!==null ? G.players[pd.topBidder].name : null,
        curId: pd.bidders[pd.cur], curName: G.players[pd.bidders[pd.cur]].name,
        curCash: G.players[pd.bidders[pd.cur]].cash,
        yourTurn: pd.bidders[pd.cur]===forId,
        passed:[...pd.passed],
      };
    } else if (pd.type==='trade' && pd.forId===forId) {
      snap.pending = { forId:pd.forId, type:'trade', fromId:pd.fromId, fromName:G.players[pd.fromId].name, offer:pd.offer };
    } else if (isMine) {
      // buy / jail / itemTarget / teleport / swap : 细节给本人
      const detail = { ...pd };
      if (pd.type==='itemTarget') {
        detail.targetInfos = pd.targets.map(id=>({ id, name:G.players[id].name, av:G.players[id].av, color:G.players[id].color, cash:G.players[id].cash }));
      } else if (pd.type==='swap') {
        detail.myPropInfos = pd.myProps.map(i=>({ i, name:SPACES[i].name, g:SPACES[i].g }));
        detail.targetInfos = pd.targets.map(id=>({ id, name:G.players[id].name, av:G.players[id].av, color:G.players[id].color, theirProps:G.players[id].props.filter(isProp).map(i=>({i,name:SPACES[i].name,g:SPACES[i].g})) }));
      } else if (pd.type==='teleport') {
        detail.targetInfos = pd.targets.map(i=>({ i, name:SPACES[i].name, g:SPACES[i].g, price:SPACES[i].price, t:SPACES[i].t }));
      } else if (pd.type==='buy') {
        detail.space = { name:SPACES[pd.pos].name, price:SPACES[pd.pos].price, g:SPACES[pd.pos].g };
      }
      snap.pending = detail;
    } else {
      // 给其他人一个摘要：谁在做什么
      const who = pd.forId!==null ? G.players[pd.forId].name : (pd.type==='auction' ? '拍卖' : '?');
      const verb = { buy:'决定是否购买', jail:'监狱决策', itemTarget:'选择道具目标', teleport:'选择传送目标', swap:'选择交换地产', trade:'回应交易' }[pd.type] || '决策中';
      snap.pending = { forId:pd.forId, type:pd.type, summary: `${who} 正在${verb}…`, pos: pd.pos };
    }
  } else {
    snap.pending = null;
  }
  return snap;
}
function broadcast(room) {
  const payload = JSON.stringify({ type:'state' });
  room.players.forEach(pl => {
    if (pl.ws && pl.ws.readyState === 1) {
      pl.ws.send(JSON.stringify({ type:'state', snapshot: snapshot(room, pl.id) }));
    }
  });
  // 旁观者也发
  (room.observers||[]).forEach(ws => {
    if (ws.readyState===1) ws.send(JSON.stringify({ type:'state', snapshot: snapshot(room, null) }));
  });
}
function broadcastRoom(room) {
  const info = {
    type:'room', code:room.code, hostId:room.hostId, started:room.started,
    players: room.players.map(p=>({ id:p.id, name:p.name, color:p.color, av:p.av, ready:true })),
  };
  room.players.forEach(pl=>{ if (pl.ws && pl.ws.readyState===1) pl.ws.send(JSON.stringify(info)); });
  (room.observers||[]).forEach(ws=>{ if (ws.readyState===1) ws.send(JSON.stringify(info)); });
}
function sendError(room, pid, msg) {
  const pl = room.players.find(p=>p.id===pid);
  if (pl && pl.ws && pl.ws.readyState===1) pl.ws.send(JSON.stringify({ type:'error', msg }));
}
function sendTo(ws, obj) { if (ws.readyState===1) ws.send(JSON.stringify(obj)); }

/* ---------- WebSocket 接入 ---------- */
wss.on('connection', (ws) => {
  const myConn = { id: nextId++, roomCode:null };
  conns.set(ws, myConn);
  sendTo(ws, { type:'hello', yourId: myConn.id });

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    const conn = conns.get(ws);
    if (!conn) return;

    // 创建房间
    if (m.type==='createRoom') {
      const code = genCode();
      const id = 0;
      const room = { code, hostId:id, started:false, game:null, players:[], observers:[] };
      const player = { id, name:(m.name||('玩家1')).slice(0,8), color:PLAYER_COLORS[0], av:PLAYER_AV[0], ws };
      room.players.push(player);
      conn.id = id; conn.roomCode = code;
      rooms.set(code, room);
      sendTo(ws, { type:'hello', yourId:id });
      broadcastRoom(room);
      return;
    }
    // 加入房间
    if (m.type==='joinRoom') {
      const room = rooms.get(m.code);
      if (!room) { sendTo(ws, { type:'error', msg:'房间号不存在' }); return; }
      if (room.started) { sendTo(ws, { type:'error', msg:'游戏已开始，无法加入' }); return; }
      if (room.players.length>=4) { sendTo(ws, { type:'error', msg:'房间已满' }); return; }
      const used = new Set(room.players.map(p=>p.color));
      const ci = PLAYER_COLORS.findIndex(c=>!used.has(c));
      const id = room.players.length;
      const player = { id, name:(m.name||('玩家'+(room.players.length+1))).slice(0,8), color:PLAYER_COLORS[ci], av:PLAYER_AV[ci], ws };
      room.players.push(player);
      conn.id = id; conn.roomCode = m.code;
      sendTo(ws, { type:'hello', yourId:id });
      broadcastRoom(room);
      return;
    }
    const room = conn.roomCode ? rooms.get(conn.roomCode) : null;
    if (!room) { sendTo(ws, { type:'error', msg:'请先创建或加入房间' }); return; }
    const me = room.players.find(p=>p.id===conn.id);

    if (m.type==='start') {
      if (conn.id !== room.hostId) { sendTo(ws, { type:'error', msg:'只有房主可以开始' }); return; }
      if (room.players.length<2) { sendTo(ws, { type:'error', msg:'至少2人才能开始' }); return; }
      room.started = true;
      room.game = createGame(room.players.map(p=>({ id:p.id, name:p.name, color:p.color, av:p.av })));
      logPush(room.game, '游戏开始！每人初始现金 '+START_CASH+'，并随机获得1张道具卡。', 'evt');
      broadcastRoom(room);
      startTurn(room.game, room);
      return;
    }

    // 以下需要游戏已开始
    const G = room.game;
    if (!G || G.phase==='over') return;
    if (!me) return;

    switch (m.type) {
      case 'roll': onRoll(G, room); break;
      case 'buy': if (G.pending && G.pending.forId===me.id && G.pending.type==='buy') actBuy(G, room); break;
      case 'skipBuy': if (G.pending && G.pending.forId===me.id && G.pending.type==='buy') actSkipBuy(G, room); break;
      case 'auction': if (G.pending && G.pending.forId===me.id && G.pending.type==='buy') actAuction(G, room); break;
      case 'auctionBid': if (G.pending && G.pending.type==='auction' && auctionCurId(G)===me.id) actAuctionBid(G, room, +m.amount); break;
      case 'auctionPass': if (G.pending && G.pending.type==='auction' && auctionCurId(G)===me.id) actAuctionPass(G, room); break;
      case 'jailPay': if (G.pending && G.pending.forId===me.id && G.pending.type==='jail') actJailPay(G, room); break;
      case 'jailRoll': if (G.pending && G.pending.forId===me.id && G.pending.type==='jail') actJailRoll(G, room); break;
      case 'useItem': actUseItem(G, room, me.id, m.itemKey); break;
      case 'itemTarget': actItemTarget(G, room, +m.targetId); break;
      case 'teleport': actTeleport(G, room, +m.pos); break;
      case 'swap': actSwap(G, room, +m.myPos, +m.targetId, +m.theirPos); break;
      case 'cancelPending': actCancelPending(G, room, me.id); break;
      case 'tradeOffer': actTradeOffer(G, room, me.id, m.offer); break;
      case 'tradeAccept': actTradeAccept(G, room, me.id); break;
      case 'tradeReject': actTradeReject(G, room, me.id); break;
      case 'build': actBuild(G, room, me.id, +m.pos); break;
      case 'resign': actResign(G, room, me.id); break;
    }
  });

  ws.on('close', () => {
    const conn = conns.get(ws);
    conns.delete(ws);
    if (conn && conn.roomCode) {
      const room = rooms.get(conn.roomCode);
      if (room) {
        const pl = room.players.find(p=>p.id===conn.id);
        if (pl) {
          pl.ws = null;
          // 房间未开始：直接移除
          if (!room.started) {
            room.players = room.players.filter(p=>p.id!==conn.id);
            if (room.hostId===conn.id) room.hostId = room.players[0]?.id || null;
            if (room.players.length===0) { rooms.delete(conn.roomCode); }
            else broadcastRoom(room);
          } else {
            // 游戏中：标记断线（保留座位，可重连——简化：标记为离线，逻辑仍按 alive 处理）
            pl.offline = true;
            broadcastRoom(room);
          }
        }
      }
    }
  });
});

server.listen(PORT, () => console.log(`好友大富翁服务已启动: http://localhost:${PORT}`));
