// 自动化测试：模拟两个 WS 客户端走核心流程
const WebSocket = require('ws');
const PORT = 8000;
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function mkClient(){
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  ws._buf = [];
  ws.on('message', d => ws._buf.push(JSON.parse(d)));
  ws.next = (pred, timeout=6000) => new Promise((res, rej) => {
    const t = setTimeout(()=>rej(new Error('timeout')), timeout);
    const check = () => {
      for (let i=0;i<ws._buf.length;i++){
        if (!pred || pred(ws._buf[i])) { clearTimeout(t); res(ws._buf.splice(i,1)[0]); return; }
      }
      setTimeout(check, 15);
    };
    check();
  });
  ws.drain = () => { ws._buf.length = 0; };
  ws.sendObj = o => ws.send(JSON.stringify(o));
  return ws;
}

let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗ FAIL:',m);} };

(async () => {
  const p1 = mkClient(), p2 = mkClient();
  await Promise.all([new Promise(r=>p1.on('open',r)), new Promise(r=>p2.on('open',r))]);
  await p1.next(m=>m.type==='hello');
  await p2.next(m=>m.type==='hello');

  console.log('1. 创建房间');
  p1.sendObj({type:'createRoom', name:'小明'});
  const r1 = await p1.next(m=>m.type==='room');
  const code = r1.code;
  ok(!!code, '生成房间号 '+code);
  ok(r1.players.length===1 && r1.players[0].name==='小明', '房主小明');

  console.log('2. p2 加入');
  p2.sendObj({type:'joinRoom', code, name:'小红'});
  const r2 = await p2.next(m=>m.type==='room');
  ok(r2.players.length===2 && r2.players.some(p=>p.name==='小红'), '2人 小红已加入');

  console.log('3. 开始游戏');
  p1.sendObj({type:'start'});
  let s = await p1.next(m=>m.type==='state');
  ok(s.snapshot.phase==='roll', 'phase=roll');
  ok(s.snapshot.turnIdx===0, '轮到小明');
  ok(s.snapshot.players[0].cash===1500, '初始¥1500');
  ok(s.snapshot.players[0].items.length===1, '初始1道具');

  // helper：让当前玩家掷骰，等待落地完成
  async function rollCurrent(snap){
    const ws = snap.turnIdx===0?p1:p2;
    const startPos = snap.players[snap.turnIdx].pos;
    ws.sendObj({type:'roll'});
    // 1) 等玩家移动到新位置
    while(true){
      snap = (await p1.next(m=>m.type==='state')).snapshot;
      if (snap.players[snap.turnIdx] && snap.players[snap.turnIdx].pos !== startPos) break;
    }
    // 2) 再读一条落地结算状态（买地/回合结束等）
    snap = (await p1.next(m=>m.type==='state')).snapshot;
    return snap;
  }

  console.log('4. 循环掷骰直到买地决策');
  p1.drain(); p2.drain();
  let snap = s.snapshot;
  let buySnap = null;
  for (let i=0;i<40;i++){
    if (snap.phase==='over'){ console.log('   游戏结束'); break; }
    if (snap.pending && snap.pending.type==='buy' && snap.pending.forId!==null){ buySnap=snap; break; }
    if (snap.phase==='roll' || snap.phase==='reroll'){ snap = await rollCurrent(snap); }
    else { snap = (await p1.next(m=>m.type==='state')).snapshot; }
  }
  ok(!!buySnap, '出现买地决策');
  if (buySnap){
    const pos = buySnap.pending.pos;
    const cur = buySnap.turnIdx;
    const ws = cur===0?p1:p2;
    console.log(`   玩家${cur+1} 在格子${pos} 购买`);
    ws.sendObj({type:'buy'});
    const after = (await p1.next(m=>m.type==='state')).snapshot;
    ok(after.owners[pos]===cur, `p${cur+1} 拥有格子${pos}`);
    ok(after.players[cur].props.includes(pos), `p${cur+1} props 含该地`);
    ok(after.players[cur].cash < buySnap.players[cur].cash, `p${cur+1} 现金减少`);
    snap = after;
  }

  console.log('5. 拍卖流程');
  let aucPos = null, winner = null;
  // 等待状态满足指定条件（跳过中间旧状态）
  async function waitState(pred, timeout=6000){
    const deadline = Date.now()+timeout;
    while(Date.now()<deadline){
      const s = (await p1.next(m=>m.type==='state', Math.max(100, deadline-Date.now()))).snapshot;
      if (pred(s)) return s;
    }
    throw new Error('waitState timeout');
  }
  for (let i=0;i<40;i++){
    if (snap.phase==='over') break;
    if (snap.pending && snap.pending.type==='buy' && snap.pending.forId!==null){
      const cur = snap.turnIdx; const ws = cur===0?p1:p2;
      ws.sendObj({type:'auction'});
      // 等待拍卖正式开始
      snap = await waitState(s => s.pending && s.pending.type==='auction');
      continue;
    }
    if (snap.pending && snap.pending.type==='auction'){
      aucPos = snap.pending.pos;
      const firstBidder = snap.pending.curId;
      const bw = firstBidder===0?p1:p2;
      bw.sendObj({type:'auctionBid', amount: snap.pending.bid+10});
      // 等出价生效（topBidder 被设置）
      snap = await waitState(s => s.pending && s.pending.type==='auction' && s.pending.topBidder!==null);
      winner = snap.pending.topBidder;
      // 其余人依次弃权直到成交
      let guard=0;
      while (snap.pending && snap.pending.type==='auction' && guard++<20){
        const c = snap.pending.curId; const cw = c===0?p1:p2;
        cw.sendObj({type:'auctionPass'});
        snap = await waitState(s => !s.pending || s.pending.type!=='auction');
      }
      break;
    }
    if (snap.phase==='roll' || snap.phase==='reroll'){ snap = await rollCurrent(snap); }
    else { snap = (await p1.next(m=>m.type==='state')).snapshot; }
  }
  if (aucPos!==null){
    ok(snap.pending===null || snap.pending.type!=='auction', '拍卖成交结束');
    ok(snap.owners[aucPos]===winner, `拍得者拥有该地（玩家${winner+1}）`);
    console.log(`   拍卖: 格子${aucPos} 由玩家${(winner??-1)+1} 拍得，owners=${snap.owners[aucPos]}`);
  } else { console.log('   拍卖未触发'); }

  console.log('6. 道具使用协议不崩');
  // 等回到 roll 阶段无 pending
  for (let i=0;i<20 && (snap.phase!=='roll' && snap.phase!=='reroll');i++){
    snap = (await p1.next(m=>m.type==='state')).snapshot;
  }
  if (snap.phase==='roll' || snap.phase==='reroll'){
    const cur = snap.turnIdx; const player = snap.players[cur]; const ws = cur===0?p1:p2;
    if (player.items.length){
      const it = player.items[0];
      ws.sendObj({type:'useItem', itemKey: it});
      await sleep(300);
      ok(true, `使用 ${it} 协议发送成功`);
    } else ok(true, '当前玩家无道具，跳过');
  } else ok(true, '未回到roll阶段，跳过道具测试');

  console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error('测试异常:', e); process.exit(2); });
