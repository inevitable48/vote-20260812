const cloudbase = require('@cloudbase/node-sdk');

const ENV_ID = 'changhai-d3g5wjyhka349046a';
const app = cloudbase.init({ env: ENV_ID });
const db = app.database();

const GROUPS = [
  {
    id: 'ibd', name: 'IBD内镜诊治协作组', candidates: [
      ['组长','刘小伟','中南大学湘雅二医院'],['副组长','缪应雷','昆明医科大学第一附属医院'],['副组长','杨红','北京协和医院'],['副组长','毛仁','中山大学附属第一医院'],['副组长','施海韵','北京友谊医院'],['副组长','柏愚','上海长海医院'],['副组长','徐桂芳','安徽医科大学第一附属医院']
    ]
  },
  {
    id: 'surgery', name: '内镜外科青年协作组', candidates: [
      ['组长','张磊','兰州大学第一医院'],['副组长','王琦','宁夏医科大学总医院'],['副组长','杨富春','浙江大学附属第一医院'],['副组长','蔡开琳','华中科技大学同济医学院附属协和医院'],['副组长','刘威','中南大学湘雅二医院'],['副组长','陈震','天津市南开医院'],['副组长','张桂信','大连医科大学附属第二医院']
    ]
  },
  {
    id: 'colon', name: '大肠镜青年协作组', candidates: [
      ['组长','刘思德','南方医科大学南方医院'],['副组长','王强','北京协和医院'],['副组长','何梦江','复旦大学附属中山医院'],['副组长','赵九龙','海军军医大学附属长海医院'],['副组长','冯哲','四川大学附属华西医院'],['副组长','王健','辽宁方大总医院'],['副组长','赖秋华','南方医科大学附属南方医院']
    ]
  }
];

exports.main = async (event) => {
  try {
    const expected = process.env.ADMIN_KEY;
    if (!expected) return { ok: false, code: 'NO_ADMIN_KEY', message: '后台尚未配置 ADMIN_KEY 环境变量' };
    if (!event || event.adminKey !== expected) return { ok: false, code: 'FORBIDDEN', message: '管理口令不正确' };

    const res = await db.collection('votes').orderBy('submittedAt', 'desc').limit(1000).get();
    const docs = Array.isArray(res.data) ? res.data : [];

    const groups = GROUPS.map(g => ({
      id: g.id,
      name: g.name,
      candidates: g.candidates.map(([role,name,unit]) => ({ role, name, unit, agree: 0, disagree: 0, agreeRate: 0 })),
      alternatives: []
    }));

    const altMaps = Object.fromEntries(GROUPS.map(g => [g.id, new Map()]));

    for (const doc of docs) {
      for (const sg of (doc.groups || [])) {
        const tg = groups.find(g => g.id === sg.id);
        if (!tg) continue;
        for (let i = 0; i < tg.candidates.length; i++) {
          const v = sg.candidates && sg.candidates[i] && sg.candidates[i].vote;
          if (v === '同意') tg.candidates[i].agree++;
          if (v === '不同意') tg.candidates[i].disagree++;
        }
        if (sg.alternativeName && sg.alternativeUnit) {
          const k = `${sg.alternativeName}|||${sg.alternativeUnit}`;
          const old = altMaps[sg.id].get(k) || { name: sg.alternativeName, unit: sg.alternativeUnit, count: 0 };
          old.count++;
          altMaps[sg.id].set(k, old);
        }
      }
    }

    for (const g of groups) {
      for (const c of g.candidates) {
        const n = c.agree + c.disagree;
        c.agreeRate = n ? Math.round(c.agree * 1000 / n) / 10 : 0;
      }
      g.alternatives = Array.from(altMaps[g.id].values()).sort((a,b) => b.count - a.count);
    }

    const voters = docs.map((d, i) => ({
      index: docs.length - i,
      name: d.voterName || '',
      unit: d.voterUnit || '',
      disagreeCount: Number(d.disagreeCount || 0),
      clientTime: d.clientTime || ''
    }));

    return {
      ok: true,
      totalVotes: docs.length,
      groups,
      voters,
      refreshedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error('getResults failed', err);
    return { ok: false, code: 'SERVER_ERROR', message: err && err.message ? err.message : '读取统计失败' };
  }
};
