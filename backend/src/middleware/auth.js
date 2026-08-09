/**
 * 老板端鉴权中间件
 * 通过请求头 x-owner-token 验证身份
 * 生产环境建议使用 JWT + 数据库存储的 token，此处为单店自用简化方案
 */

// 老板端访问令牌
// 优先从环境变量读取，默认值为开发环境令牌
const OWNER_TOKEN = process.env.OWNER_TOKEN || 'baji-owner-2026';

/**
 * 验证 x-owner-token 请求头
 * 通过则放行，未通过则返回 401 未授权
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

module.exports = { ownerAuth };
