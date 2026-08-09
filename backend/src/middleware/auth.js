/**
 * 鉴权中间件
 *
 * 两种角色鉴权：
 *   - 商家端：通过 x-owner-token 请求头验证 OWNER_TOKEN
 *   - 骑手端：通过 x-rider-token 请求头验证 RIDER_TOKEN
 *
 * SSE 端点因 EventSource 不支持自定义 header，通过 query 参数传 token
 */

// 商家端访问令牌
const OWNER_TOKEN = process.env.OWNER_TOKEN || 'baji-owner-2026';

// 骑手端访问令牌
const RIDER_TOKEN = process.env.RIDER_TOKEN || 'baji-rider-2026';

/**
 * 商家端鉴权：验证 x-owner-token 请求头
 */
function ownerAuth(req, res, next) {
  const token = req.headers['x-owner-token'];

  if (!token || token !== OWNER_TOKEN) {
    return res.status(401).json({
      code: 401,
      message: '未授权：请提供有效的 x-owner-token 请求头',
    });
  }

  next();
}

/**
 * 骑手端鉴权：验证 x-rider-token 请求头
 */
function riderAuth(req, res, next) {
  const token = req.headers['x-rider-token'];

  if (!token || token !== RIDER_TOKEN) {
    return res.status(401).json({
      code: 401,
      message: '未授权：请提供有效的 x-rider-token 请求头',
    });
  }

  next();
}

module.exports = { ownerAuth, riderAuth, OWNER_TOKEN, RIDER_TOKEN };
