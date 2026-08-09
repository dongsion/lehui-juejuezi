/**
 * 鉴权中间件
 *
 * 商家端和骑手端共用一个共享密码（存储在数据库 settings 表中）
 *   - 商家端：通过 x-owner-token 请求头验证共享密码
 *   - 骑手端：通过 x-rider-token 请求头验证共享密码
 *
 * SSE 端点因 EventSource 不支持自定义 header，通过 query 参数传 token
 */

const { db } = require('../database');

// 默认共享密码（数据库未初始化时的 fallback）
const DEFAULT_SHARED_PASSWORD = process.env.SHARED_PASSWORD || 'baji-2026';

// 保留向后兼容的导出（旧代码可能引用）
const OWNER_TOKEN = DEFAULT_SHARED_PASSWORD;
const RIDER_TOKEN = DEFAULT_SHARED_PASSWORD;

/**
 * 从数据库读取共享密码
 */
function getSharedPassword() {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('shared_password');
  return setting ? setting.value : DEFAULT_SHARED_PASSWORD;
}

/**
 * 商家端鉴权：验证 x-owner-token 请求头
 */
function ownerAuth(req, res, next) {
  const token = req.headers['x-owner-token'];

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未授权，请先登录',
    });
  }

  const password = getSharedPassword();
  if (token !== password) {
    return res.status(401).json({
      code: 401,
      message: '密码错误',
    });
  }

  next();
}

/**
 * 骑手端鉴权：验证 x-rider-token 请求头
 */
function riderAuth(req, res, next) {
  const token = req.headers['x-rider-token'];

  if (!token) {
    return res.status(401).json({
      code: 401,
      message: '未授权，请先登录',
    });
  }

  const password = getSharedPassword();
  if (token !== password) {
    return res.status(401).json({
      code: 401,
      message: '密码错误',
    });
  }

  next();
}

module.exports = { ownerAuth, riderAuth, OWNER_TOKEN, RIDER_TOKEN, getSharedPassword };
