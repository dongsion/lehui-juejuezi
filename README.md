# 小暖咖啡馆 — 网址 App 点单收银系统

参考「吧唧go」的轻量化设计理念，面向单店自用的点单收银 H5 应用。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Vant 4 + Pinia |
| 后端 | Node.js + Express + better-sqlite3 |
| 数据库 | SQLite（零配置，开箱即用） |
| 支付 | 微信 H5 支付 + 支付宝手机网站支付（当前 mock，含真实对接注释） |

## 快速启动

```bash
# 1. 启动后端（端口 3001）
cd backend
npm install
npm start

# 2. 启动前端（端口 5173）
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 即可使用。

## 功能清单

### 顾客端
- 扫码/输入 URL 进入点单页
- 分类侧边栏 + 无图卡纸菜单（文字排版风格）
- 购物车加减、结算弹窗
- 下单 → 订单详情 → 支付选择（微信/支付宝）
- 支付完成显示取餐码

### 老板端（密码：baji-owner-2026）
- 经营看板：今日营收、订单数、客单价、热销排行
- 订单管理：按状态筛选、展开详情
- 菜品管理：新增/编辑/上下架/删除

## 路由

| 路径 | 说明 |
|---|---|
| `/` | 顾客点单首页 |
| `/order/:id` | 订单详情 |
| `/payment/:orderId` | 支付选择页 |
| `/admin` | 老板经营看板 |
| `/admin/orders` | 订单管理 |
| `/admin/dishes` | 菜品管理 |

## API 一览

### 顾客端
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/menu | 获取菜单 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders/:id | 订单详情 |
| POST | /api/payment/create | 创建支付 |
| GET | /api/payment/status/:orderId | 查询支付状态 |

### 老板端（Header: x-owner-token: baji-owner-2026）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/admin/stats | 今日统计 |
| GET | /api/admin/orders | 订单列表 |
| GET | /api/admin/dishes | 菜品列表 |
| POST | /api/admin/dishes | 新增菜品 |
| PUT | /api/admin/dishes/:id | 编辑菜品 |
| DELETE | /api/admin/dishes/:id | 删除菜品 |
| POST | /api/admin/categories | 新增分类 |

## 对接真实支付

查看 `backend/src/routes/payment.js` 文件头部注释，包含：
1. 微信 H5 支付对接指南（/v3/pay/transactions/h5）
2. 支付宝手机网站支付对接指南（alipay.trade.wap.pay）
3. 聚合支付替代方案（收钱吧、Ping++）

## 数据库

SQLite 文件：`backend/data/app.db`，包含 4 张表：
- `categories` — 菜品分类
- `dishes` — 菜品
- `orders` — 订单
- `payment_records` — 支付记录

首次启动自动建表并写入示例数据（4 分类 13 菜品）。
