const cloudbase = require('@cloudbase/node-sdk');

const ENV_ID = 'changhai-d3g5wjyhka349046a';
const DEADLINE_MS = Date.parse('2026-08-15T23:59:59+08:00');
const app = cloudbase.init({ env: ENV_ID });
const db = app.database();
const auth = app.auth();

const GROUPS = [
  {
    id: 'ibd',
    name: 'IBD内镜诊治协作组',
    candidates: [
      ['组长', '刘小伟', '中南大学湘雅二医院'],
      ['副组长', '缪应雷', '昆明医科大学第一附属医院'],
      ['副组长', '杨红', '北京协和医院'],
      ['副组长', '毛仁', '中山大学附属第一医院'],
      ['副组长', '施海韵', '北京友谊医院'],
      ['副组长', '柏愚', '上海长海医院'],
      ['副组长', '徐桂芳', '安徽医科大学第一附属医院']
    ]
  },
  {
    id: 'surgery',
    name: '内镜外科青年协作组',
    candidates: [
      ['组长', '张磊', '兰州大学第一医院'],
      ['副组长', '王琦', '宁夏医科大学总医院'],
      ['副组长', '杨富春', '浙江大学附属第一医院'],
      ['副组长', '蔡开琳', '华中科技大学同济医学院附属协和医院'],
      ['副组长', '刘威', '中南大学湘雅二医院'],
      ['副组长', '陈震', '天津市南开医院'],
      ['副组长', '张桂信', '大连医科大学附属第二医院']
    ]
  },
  {
    id: 'colon',
    name: '大肠镜青年协作组',
    candidates: [
      ['组长', '刘思德', '南方医科大学南方医院'],
      ['副组长', '王强', '北京协和医院'],
      ['副组长', '何梦江', '复旦大学附属中山医院'],
      ['副组长', '赵九龙', '海军军医大学附属长海医院'],
      ['副组长', '冯哲', '四川大学附属华西医院'],
      ['副组长', '王健', '辽宁方大总医院'],
      ['副组长', '赖秋华', '南方医科大学附属南方医院']
    ]
  }
];

function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function validateAndNormalize(event) {
  const voterName = cleanText(event.voterName, 30);
  const voterUnit = cleanText(event.voterUnit, 60);
  if (!voterName || !voterUnit) throw new Error('请填写投票人姓名和单位');

  if (!Array.isArray(event.groups) || event.groups.length !== GROUPS.length) {
    throw new Error('投票数据不完整');
  }

  const normalizedGroups = GROUPS.map((officialGroup) => {
    const submitted = event.groups.find(g => g && g.id === officialGroup.id);
    if (!submitted || !Array.isArray(submitted.candidates)) {
      throw new Error(`缺少“${officialGroup.name}”表决数据`);
    }
    if (submitted.candidates.length !== officialGroup.candidates.length) {
      throw new Error(`“${officialGroup.name}”候选人数不正确`);
    }

    const candidates = officialGroup.candidates.map(([role, name, unit], index) => {
      const vote = submitted.candidates[index] && submitted.candidates[index].vote;
      if (vote !== '同意' && vote !== '不同意') {
        throw new Error(`“${officialGroup.name}”${name}尚未完成表决`);
      }
      return { role, name, unit, vote };
    });

    const alternativeName = cleanText(submitted.alternativeName, 30);
    const alternativeUnit = cleanText(submitted.alternativeUnit, 60);
    if ((alternativeName && !alternativeUnit) || (!alternativeName && alternativeUnit)) {
      throw new Error(`“${officialGroup.name}”拟推荐人选姓名和单位请同时填写`);
    }

    return {
      id: officialGroup.id,
      name: officialGroup.name,
      candidates,
      alternativeName,
      alternativeUnit
    };
  });

  return { voterName, voterUnit, groups: normalizedGroups };
}

exports.main = async (event, context) => {
  try {
    if (Date.now() > DEADLINE_MS) {
      return { ok: false, code: 'CLOSED', message: '本次投票已于2026年8月15日23:59:59（北京时间）结束' };
    }

    const userInfo = auth.getUserInfo();
    const uid = userInfo && userInfo.uid;
    if (!uid) {
      return { ok: false, code: 'NO_AUTH', message: '未取得匿名用户身份，请刷新页面后重试' };
    }

    const normalized = validateAndNormalize(event || {});

    const existing = await db.collection('votes').where({ uid }).count();
    if (existing.total > 0) {
      return { ok: false, code: 'DUPLICATE', message: '当前设备账号已经提交过本次投票，不能重复提交' };
    }

    const disagreeCount = normalized.groups.reduce(
      (sum, g) => sum + g.candidates.filter(c => c.vote === '不同意').length,
      0
    );

    const result = await db.collection('votes').add({
      uid,
      voterName: normalized.voterName,
      voterUnit: normalized.voterUnit,
      groups: normalized.groups,
      disagreeCount,
      submittedAt: new Date(),
      clientTime: cleanText(event.clientTime, 60),
      source: 'cloudbase-web-v1',
      version: 2
    });

    return { ok: true, id: result.id || result._id || '', disagreeCount };
  } catch (err) {
    console.error('submitVote failed', err);
    return {
      ok: false,
      code: 'SERVER_ERROR',
      message: err && err.message ? err.message : '服务器处理失败，请稍后重试'
    };
  }
};
