# 乐荟绝绝子 — 单店点单收银系统

面向单店自用的点单收银 H5 应用，包含顾客端、商家端和骑手端三端协同。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Vant 4 + Pinia |
| 后端 | Node.js + Express |
| 数据库 | JSON 文件存储（零配置，开箱即用） |
| 实时通信 | SSE（Server-Sent Events） |
| 支付 | 微信/支付宝个人收款码模式（含真实对接注释） |

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
- 堂食/外带选择、桌号输入、订单备注
- 购物车加减、结算弹窗
- 下单 → 订单详情 → 支付选择（微信/支付宝）
- 收款码付款后提交“我已支付”，等待商家核实到账
- 商家确认到账后显示取餐码
- 订单详情实时状态轮询（每5秒自动刷新）

### 商家端（默认密码：baji-2026）
- 经营看板：今日营收、本月营收、全年营收、订单数、客单价、热销排行
- 实时订单推送（SSE + 提示音 + 桌面通知）
- 订单管理：按状态筛选、核实收款、完成订单、取消订单、删除订单
- 菜品管理：新增/编辑/上下架/删除
- 分类管理：新增/启用停用/删除分类
- 菜单变更实时推送到顾客端

### 骑手端（默认密码：baji-2026）
- 今日配送概览（待配送/配送中/已送达）
- 实时新订单推送（SSE + 提示音 + 桌面通知）
- 订单列表按状态筛选
- 一键开始配送、确认送达
- 配送信息展示（堂食/外带、桌号、备注）

## 路由

| 路径 | 说明 |
|---|---|
| `/` | 顾客点单首页 |
| `/order/:id` | 订单详情 |
| `/payment/:orderId` | 支付选择页 |
| `/admin` | 商家经营看板 |
| `/admin/orders` | 订单管理 |
| `/admin/dishes` | 菜品管理 |
| `/rider` | 骑手配送端 |

## API 一览

### 顾客端
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/menu | 获取菜单 |
| GET | /api/menu/stream | SSE 菜单实时更新 |
| POST | /api/orders | 创建订单 |
| GET | /api/orders/:id | 订单详情 |
| POST | /api/payment/create | 创建支付 |
| POST | /api/payment/confirm | 确认支付 |
| GET | /api/payment/status/:orderId | 查询支付状态 |

### 商家端（Header: x-owner-token）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/admin/order-stream | SSE 订单实时推送 |
| GET | /api/admin/stats | 今日统计 |
| GET | /api/admin/orders | 订单列表 |
| PUT | /api/admin/orders/:id/payment | 核实收款（确认到账/未到账驳回） |
| PUT | /api/admin/orders/:id/status | 更新订单状态（完成/取消） |
| DELETE | /api/admin/orders/:id | 删除订单 |
| GET | /api/admin/dishes | 菜品列表 |
| POST | /api/admin/dishes | 新增菜品 |
| PUT | /api/admin/dishes/:id | 编辑菜品 |
| DELETE | /api/admin/dishes/:id | 删除菜品 |
| POST | /api/admin/categories | 新增分类 |
| PUT | /api/admin/categories/:id | 编辑分类 |
| DELETE | /api/admin/categories/:id | 删除分类 |

### 骑手端（Header: x-rider-token）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/rider/order-stream | SSE 订单实时推送 |
| GET | /api/rider/orders | 订单列表 |
| PUT | /api/rider/orders/:id/status | 更新配送状态 |

## 订单状态流转

```
pending（待支付）
  ↓ 顾客点击“我已支付”
verifying（付款待核实）
  ↓ 商家确认到账
confirmed（已确认/待配送）
  ↓ 骑手取货
delivering（配送中）
  ↓ 骑手送达 / 商家完成
completed（已完成）

任意未完成状态 → cancelled（已取消，商家操作）
```

## 对接真实支付

查看 `backend/src/routes/payment.js` 文件头部注释，包含：
1. 微信 H5 支付对接指南（/v3/pay/transactions/h5）
2. 支付宝手机网站支付对接指南（alipay.trade.wap.pay）
3. 聚合支付替代方案（收钱吧、Ping++）

## 数据库

JSON 文件存储，位于 `backend/data/data.json`，包含 4 张表：
- `categories` — 菜品分类
- `dishes` — 菜品
- `orders` — 订单
- `payment_records` — 支付记录

首次启动自动建表并写入示例数据（4 分类 13 菜品）。

## Docker 部署

```bash
# 复制环境变量配置
cp .env.example .env

# 构建并启动
docker compose up -d --build

# 访问
# 顾客端：http://服务器IP/
# 商家端：http://服务器IP/admin
# 骑手端：http://服务器IP/rider
```

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| SHARED_PASSWORD | 商家端 / 骑手端共享登录密码 | baji-2026 |
| PORT | 后端服务端口 | 3001 |
| DATA_DIR | 数据文件目录 | ./data |
