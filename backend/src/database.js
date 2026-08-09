/**
 * 数据库模块 - 纯 JavaScript JSON 文件存储
 * 替代 better-sqlite3，避免原生模块编译问题
 * 提供与 better-sqlite3 兼容的 prepare().get/all/run() 接口
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// ========== 数据目录 ==========
function findWritableDataDir() {
  const candidates = [];
  if (process.env.DATA_DIR) {
    candidates.push(path.resolve(process.env.DATA_DIR));
  }
  candidates.push(path.join(__dirname, '..', 'data'));
  candidates.push(path.join(os.tmpdir(), 'lehui-data'));

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const testFile = path.join(dir, '.write-test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return dir;
    } catch (e) {
      console.warn(`[数据库] 目录 ${dir} 不可用: ${e.message}`);
    }
  }
  // 最终 fallback
  const fallback = path.join(os.tmpdir(), 'lehui-data');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const dataDir = findWritableDataDir();
const dbFile = path.join(dataDir, 'data.json');
console.log(`[数据库] 数据文件: ${dbFile}`);

// ========== 数据存储 ==========
let data = {
  categories: [],
  dishes: [],
  orders: [],
  payment_records: [],
  settings: [],
  _counters: { categories: 0, dishes: 0, orders: 0, payment_records: 0, settings: 0 }
};

function loadData() {
  try {
    if (fs.existsSync(dbFile)) {
      const raw = fs.readFileSync(dbFile, 'utf-8');
      const loaded = JSON.parse(raw);
      data = { ...data, ...loaded };
      // 确保 counters 正确
      data._counters = data._counters || {};
      data._counters.categories = Math.max(data._counters.categories || 0, ...data.categories.map(c => c.id || 0));
      data._counters.dishes = Math.max(data._counters.dishes || 0, ...data.dishes.map(d => d.id || 0));
    }
  } catch (e) {
    console.warn(`[数据库] 加载数据失败，使用默认数据: ${e.message}`);
  }
}

function saveData() {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[数据库] 保存数据失败: ${e.message}`);
  }
}

function nextId(table) {
  data._counters[table] = (data._counters[table] || 0) + 1;
  return data._counters[table];
}

function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ========== 种子数据 ==========
function seedData() {
  // 初始化收款码设置（独立于分类种子，确保已有数据库也能补齐）
  if (!data.settings.find(s => s.key === 'wechat_qr')) {
    data.settings.push({ id: nextId('settings'), key: 'wechat_qr', value: '/wechat-qr.png', created_at: now() });
  }
  if (!data.settings.find(s => s.key === 'alipay_qr')) {
    data.settings.push({ id: nextId('settings'), key: 'alipay_qr', value: '/alipay-qr.jpeg', created_at: now() });
  }

  if (data.categories.length > 0) {
    saveData();
    return;
  }

  const cats = [
    { name: '咖啡', sort_order: 1, is_active: 1 },
    { name: '茶饮', sort_order: 2, is_active: 1 },
    { name: '烘焙', sort_order: 3, is_active: 1 },
    { name: '轻食', sort_order: 4, is_active: 1 }
  ];
  cats.forEach(c => {
    const id = nextId('categories');
    data.categories.push({ id, ...c, created_at: now() });
  });

  const coffeeId = data.categories.find(c => c.name === '咖啡').id;
  const teaId = data.categories.find(c => c.name === '茶饮').id;
  const bakeryId = data.categories.find(c => c.name === '烘焙').id;
  const lightId = data.categories.find(c => c.name === '轻食').id;

  const dishes = [
    [coffeeId, '拿铁', '浓缩咖啡与蒸牛奶的经典融合，口感顺滑', 28.0, '', 1, 1],
    [coffeeId, '美式', '浓缩咖啡加水稀释，醇厚清爽', 22.0, '', 1, 2],
    [coffeeId, '卡布奇诺', '浓缩咖啡、蒸牛奶与奶泡的完美比例', 30.0, '', 1, 3],
    [coffeeId, '抹茶拿铁', '日式抹茶与蒸牛奶，清香回甘', 32.0, '', 1, 4],
    [teaId, '红茶', '精选锡兰红茶，香气浓郁', 18.0, '', 1, 1],
    [teaId, '柠檬茶', '新鲜柠檬与红茶，酸甜解腻', 20.0, '', 1, 2],
    [teaId, '乌龙奶茶', '炭焙乌龙搭配鲜奶，茶香奶醇', 24.0, '', 1, 3],
    [bakeryId, '可颂', '法式黄油可颂，外酥内软', 16.0, '', 1, 1],
    [bakeryId, '贝果', '手工贝果，嚼劲十足', 15.0, '', 1, 2],
    [bakeryId, '肉桂卷', '香甜肉桂卷，温暖治愈', 18.0, '', 1, 3],
    [lightId, '三明治', '全麦面包搭配火腿蔬菜，营养均衡', 35.0, '', 1, 1],
    [lightId, '凯撒沙拉', '罗马生菜配凯撒酱与面包丁', 32.0, '', 1, 2],
    [lightId, '牛肉卷', '慢炖牛肉搭配新鲜蔬菜卷饼', 38.0, '', 1, 3],
  ];
  dishes.forEach(([cat_id, name, desc, price, img, avail, sort]) => {
    const id = nextId('dishes');
    data.dishes.push({ id, category_id: cat_id, name, description: desc, price, image_url: img, is_available: avail, sort_order: sort, created_at: now() });
  });

  saveData();
  console.log('[数据库] 种子数据初始化完成');
}

// ========== 简易 SQL 解析与执行 ==========
function getTable(sql) {
  const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
  return m ? m[1] : null;
}

function parseWhere(whereClause, params) {
  if (!whereClause || whereClause.trim() === '1=1') return () => true;

  // 简单条件解析：支持 AND 连接的 col = ? 条件、col IN (?,?)、date(col) = date('now','localtime')
  const conditions = whereClause.split(/\s+AND\s+/i).map(c => c.trim()).filter(c => c && c !== '1=1');
  let paramIdx = 0;

  const checks = conditions.map(cond => {
    // IN (...)
    const inMatch = cond.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const col = inMatch[1];
      const count = (inMatch[2].match(/\?/g) || []).length;
      const values = params.slice(paramIdx, paramIdx + count);
      paramIdx += count;
      return (row) => values.includes(row[col]);
    }

    // date(col) = date('now', 'localtime')
    const dateNowMatch = cond.match(/date\((\w+)\)\s*=\s*date\s*\(\s*'now'\s*,\s*'localtime'\s*\)/i);
    if (dateNowMatch) {
      const col = dateNowMatch[1];
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
      return (row) => {
        const val = row[col];
        if (!val) return false;
        return String(val).startsWith(todayStr);
      };
    }

    // date(col) = date(?)
    const dateParamMatch = cond.match(/date\((\w+)\)\s*=\s*date\s*\(\s*\?\s*\)/i);
    if (dateParamMatch) {
      const col = dateParamMatch[1];
      const val = params[paramIdx++];
      return (row) => {
        const rowVal = row[col];
        if (!rowVal) return false;
        return String(rowVal).startsWith(String(val));
      };
    }

    // col = ?
    const eqMatch = cond.match(/(\w+)\s*=\s*\?/);
    if (eqMatch) {
      const col = eqMatch[1];
      const val = params[paramIdx++];
      return (row) => row[col] == val;
    }

    // col = 'value'
    const eqStrMatch = cond.match(/(\w+)\s*=\s*'([^']*)'/);
    if (eqStrMatch) {
      const col = eqStrMatch[1];
      const val = eqStrMatch[2];
      return (row) => row[col] == val;
    }

    return () => true;
  });

  return (row) => checks.every(fn => fn(row));
}

function parseOrderBy(sql) {
  const m = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|$)/i);
  if (!m) return null;
  const parts = m[1].split(',').map(p => p.trim());
  return (a, b) => {
    for (const part of parts) {
      const [col, dir] = part.split(/\s+/);
      const desc = dir && dir.toUpperCase() === 'DESC';
      const va = a[col] || '';
      const vb = b[col] || '';
      if (va < vb) return desc ? 1 : -1;
      if (va > vb) return desc ? -1 : 1;
    }
    return 0;
  };
}

function parseSelectColumns(sql) {
  const m = sql.match(/SELECT\s+(.+?)\s+FROM\s+/is);
  if (!m) return null;
  const cols = m[1].trim();
  if (cols === '*') return null; // return all columns
  return cols.split(',').map(c => c.trim());
}

function filterColumns(row, columns) {
  if (!columns) return { ...row };
  const result = {};
  columns.forEach(col => {
    // Handle aggregates like COUNT(*) as cnt, COALESCE(SUM(...),0) as name
    if (col.includes('as ')) {
      const alias = col.split(/\s+as\s+/i)[1].trim();
      result[alias] = row[alias];
    } else if (col.includes('(')) {
      // aggregate - skip, handled separately
    } else {
      result[col] = row[col];
    }
  });
  return result;
}

function exec(sql) {
  // CREATE TABLE - no-op, we use predefined structure
  if (/CREATE\s+TABLE/i.test(sql)) return;
  console.log(`[数据库] exec: ${sql.substring(0, 80)}...`);
}

function prepare(sql) {
  return {
    _sql: sql,

    get(...params) {
      const rows = this._query(params);
      return rows[0] || undefined;
    },

    all(...params) {
      return this._query(params);
    },

    run(...params) {
      return this._execute(params);
    },

    _query(params) {
      const sql = this._sql;
      const table = getTable(sql);
      if (!table || !data[table]) return [];

      // Handle SELECT COUNT(*), SUM() aggregates
      if (/COUNT\s*\(\s*\*\s*\)|SUM\s*\(/i.test(sql)) {
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/is);
        const whereClause = whereMatch ? whereMatch[1] : '';
        const check = parseWhere(whereClause, params);
        const rows = data[table].filter(check);

        const result = {};
        const countMatch = sql.match(/COUNT\s*\(\s*\*\s*\)\s+as\s+(\w+)/i);
        const sumMatch = sql.match(/SUM\s*\(\s*(\w+)\s*\)\s+as\s+(\w+)/i);
        const coalesceMatch = sql.match(/COALESCE\s*\(\s*SUM\s*\(\s*(\w+)\s*\)\s*,\s*(\d+)\s*\)\s+as\s+(\w+)/i);

        if (countMatch) result[countMatch[1]] = rows.length;
        if (coalesceMatch) {
          const defaultValue = parseFloat(coalesceMatch[2]);
          const sum = rows.reduce((acc, r) => acc + (parseFloat(r[coalesceMatch[1]]) || 0), 0);
          result[coalesceMatch[3]] = sum || defaultValue;
        } else if (sumMatch) {
          result[sumMatch[2]] = rows.reduce((acc, r) => acc + (parseFloat(r[sumMatch[1]]) || 0), 0);
        }
        return [result];
      }

      // Regular SELECT
      let whereClause = '';
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/is);
      if (whereMatch) whereClause = whereMatch[1];

      const check = parseWhere(whereClause, params);
      let rows = data[table].filter(check);

      // Parse items_json for orders
      if (table === 'orders') {
        rows = rows.map(r => {
          const row = { ...r };
          if (row.items_json && typeof row.items_json === 'string') {
            try { row.items = JSON.parse(row.items_json); } catch(e) { row.items = []; }
          } else if (row.items_json) {
            row.items = row.items_json;
          }
          return row;
        });
      }

      // ORDER BY
      const orderFn = parseOrderBy(sql);
      if (orderFn) rows.sort(orderFn);

      // Column filtering
      const columns = parseSelectColumns(sql);
      if (columns && !columns.includes('*')) {
        rows = rows.map(r => filterColumns(r, columns));
      }

      return rows;
    },

    _execute(params) {
      const sql = this._sql;
      const table = getTable(sql);
      if (!table || !data[table]) return { lastInsertRowid: 0, changes: 0 };

      // INSERT
      const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const cols = insertMatch[2].split(',').map(c => c.trim());
        const values = [];
        let pi = 0;
        const valParts = insertMatch[3].split(',').map(v => v.trim());
        for (const vp of valParts) {
          if (vp === '?') {
            values.push(params[pi++]);
          } else if (vp.startsWith("'") && vp.endsWith("'")) {
            values.push(vp.slice(1, -1));
          } else if (vp.includes('datetime(')) {
            values.push(now());
          } else {
            values.push(vp);
          }
        }

        const row = { created_at: now() };
        cols.forEach((col, i) => {
          row[col] = values[i] !== undefined ? values[i] : null;
        });

        // Auto-increment ID if not provided
        if (!row.id) {
          row.id = nextId(table);
        } else if (typeof row.id === 'number') {
          data._counters[table] = Math.max(data._counters[table] || 0, row.id);
        }

        data[table].push(row);
        saveData();
        return { lastInsertRowid: row.id, changes: 1 };
      }

      // UPDATE
      const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/is);
      if (updateMatch) {
        const setClause = updateMatch[2];
        const whereClause = updateMatch[3];

        // Parse SET clause
        const sets = {};
        let paramIdx = 0;
        const setParts = setClause.split(',').map(s => s.trim());
        for (const part of setParts) {
          const eqMatch = part.match(/(\w+)\s*=\s*(.+)/);
          if (!eqMatch) continue;
          const col = eqMatch[1];
          let val = eqMatch[2].trim();
          if (val === '?') {
            sets[col] = params[paramIdx++];
          } else if (val.startsWith("'") && val.endsWith("'")) {
            sets[col] = val.slice(1, -1);
          } else if (val.includes('datetime(')) {
            sets[col] = now();
          } else {
            sets[col] = val;
          }
        }

        // WHERE params come after SET params
        const whereParams = params.slice(paramIdx);
        const check = parseWhere(whereClause, whereParams);
        let changes = 0;
        data[table].forEach(row => {
          if (check(row)) {
            Object.assign(row, sets);
            changes++;
          }
        });
        saveData();
        return { lastInsertRowid: 0, changes };
      }

      // DELETE
      const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/is);
      if (deleteMatch) {
        const whereClause = deleteMatch[2];
        const check = parseWhere(whereClause, params);
        const before = data[table].length;
        data[table] = data[table].filter(row => !check(row));
        const changes = before - data[table].length;
        saveData();
        return { lastInsertRowid: 0, changes };
      }

      console.warn(`[数据库] 未识别的 SQL: ${sql.substring(0, 100)}`);
      return { lastInsertRowid: 0, changes: 0 };
    }
  };
}

function pragma() {
  // no-op for compatibility
}

// ========== 初始化 ==========
loadData();

function initTables() {
  // Tables are implicit in our JSON structure
  console.log('[数据库] 表结构已就绪');
}

function initDatabase() {
  initTables();
  seedData();
}

module.exports = { db: { prepare, exec, pragma }, initDatabase };
