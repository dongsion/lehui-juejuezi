/**
 * 数据库初始化模块
 * 负责 SQLite 数据库的连接、建表和种子数据初始化
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 确保数据目录存在
// 按优先级尝试可写目录：环境变量 DATA_DIR > 项目相对目录 > 系统临时目录
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
      // 测试写入权限
      const testFile = path.join(dir, '.write-test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      console.log(`[数据库] 使用数据目录: ${dir}`);
      return dir;
    } catch (e) {
      console.warn(`[数据库] 目录 ${dir} 不可用: ${e.message}`);
    }
  }
  throw new Error('无法找到可写的数据目录');
}

const dataDir = findWritableDataDir();

// 数据库文件路径
const dbPath = path.join(dataDir, 'app.db');

// 创建数据库连接（启用 WAL 模式提升并发读性能）
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * 初始化所有数据库表
 */
function initTables() {
  // 分类表：用于菜单分类（如咖啡、茶饮、烘焙、轻食）
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 菜品表：每个菜品属于一个分类
  db.exec(`
    CREATE TABLE IF NOT EXISTS dishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image_url TEXT,
      is_available INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);

  // 订单表：主键使用 nanoid 生成的字符串，order_no 为便于阅读的订单编号
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      total_amount REAL NOT NULL,
      items_json TEXT NOT NULL,
      customer_note TEXT,
      dine_type TEXT,
      table_number TEXT,
      payment_channel TEXT,
      payment_status TEXT DEFAULT 'unpaid',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      paid_at TEXT
    )
  `);

  // 支付记录表：记录每笔支付请求及回调结果
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      raw_response TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);
}

/**
 * 插入种子数据：示例分类与菜品
 * 仅在表为空时执行，避免重复插入
 */
function seedData() {
  // 检查是否已有分类数据，避免重复初始化
  const count = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (count > 0) {
    return;
  }

  // 插入示例分类
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, sort_order, is_active) VALUES (?, ?, ?)'
  );
  insertCategory.run('咖啡', 1, 1);
  insertCategory.run('茶饮', 2, 1);
  insertCategory.run('烘焙', 3, 1);
  insertCategory.run('轻食', 4, 1);

  // 获取各分类 ID
  const categories = db.prepare('SELECT id, name FROM categories').all();
  const categoryMap = {};
  categories.forEach((cat) => {
    categoryMap[cat.name] = cat.id;
  });

  // 插入示例菜品
  const insertDish = db.prepare(
    'INSERT INTO dishes (category_id, name, description, price, image_url, is_available, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // 咖啡类菜品
  const coffeeId = categoryMap['咖啡'];
  insertDish.run(coffeeId, '拿铁', '浓缩咖啡与蒸牛奶的经典融合，口感顺滑', 28.0, '', 1, 1);
  insertDish.run(coffeeId, '美式', '浓缩咖啡加水稀释，醇厚清爽', 22.0, '', 1, 2);
  insertDish.run(coffeeId, '卡布奇诺', '浓缩咖啡、蒸牛奶与奶泡的完美比例', 30.0, '', 1, 3);
  insertDish.run(coffeeId, '抹茶拿铁', '日式抹茶与蒸牛奶，清香回甘', 32.0, '', 1, 4);

  // 茶饮类菜品
  const teaId = categoryMap['茶饮'];
  insertDish.run(teaId, '红茶', '精选锡兰红茶，香气浓郁', 18.0, '', 1, 1);
  insertDish.run(teaId, '柠檬茶', '新鲜柠檬与红茶，酸甜解腻', 20.0, '', 1, 2);
  insertDish.run(teaId, '乌龙奶茶', '炭焙乌龙搭配鲜奶，茶香奶醇', 24.0, '', 1, 3);

  // 烘焙类菜品
  const bakeryId = categoryMap['烘焙'];
  insertDish.run(bakeryId, '可颂', '法式黄油可颂，外酥内软', 16.0, '', 1, 1);
  insertDish.run(bakeryId, '贝果', '手工贝果，嚼劲十足', 15.0, '', 1, 2);
  insertDish.run(bakeryId, '肉桂卷', '香甜肉桂卷，温暖治愈', 18.0, '', 1, 3);

  // 轻食类菜品
  const lightId = categoryMap['轻食'];
  insertDish.run(lightId, '三明治', '全麦面包搭配火腿蔬菜，营养均衡', 35.0, '', 1, 1);
  insertDish.run(lightId, '凯撒沙拉', '罗马生菜配凯撒酱与面包丁', 32.0, '', 1, 2);
  insertDish.run(lightId, '牛肉卷', '慢炖牛肉搭配新鲜蔬菜卷饼', 38.0, '', 1, 3);
}

/**
 * 初始化数据库：建表 + 种子数据
 */
function initDatabase() {
  initTables();
  seedData();
}

module.exports = { db, initDatabase };
