/**
 * 顾客认证路由
 *
 * 功能：
 *   1. 发送验证码（模拟短信，直接返回验证码给前端）
 *   2. 顾客登录（验证码验证，查找或创建顾客记录）
 */
const express = require('express');
const { nanoid } = require('nanoid');
const { db } = require('../database');
const router = express.Router();

function now() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * POST /api/customer/send-code
 * 发送验证码（模拟短信，返回验证码给前端）
 * 请求体：{ phone }
 */
router.post('/send-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ code: 400, message: '请输入正确的手机号' });
  }

  // 生成4位验证码
  const code = String(Math.floor(1000 + Math.random() * 9000));

  // 存储验证码（5分钟有效）
  const existing = db.prepare('SELECT * FROM verification_codes WHERE phone = ?').get(phone);
  if (existing) {
    db.prepare('UPDATE verification_codes SET code = ?, created_at = ?, used = ? WHERE phone = ?').run(code, now(), 0, phone);
  } else {
    db.prepare('INSERT INTO verification_codes (phone, code, created_at, used) VALUES (?, ?, ?, ?)').run(phone, code, now(), 0);
  }

  // 模拟短信：返回验证码（生产环境应发短信，这里直接返回）
  res.json({ code: 'SUCCESS', message: '验证码已发送', debug_code: code });
});

/**
 * POST /api/customer/login
 * 顾客登录（验证码验证）
 * 请求体：{ phone, code }
 */
router.post('/login', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ code: 400, message: '请输入手机号和验证码' });
  }

  const record = db.prepare('SELECT * FROM verification_codes WHERE phone = ? AND used = ?').get(phone, 0);
  if (!record) {
    return res.status(400).json({ code: 400, message: '请先获取验证码' });
  }

  if (record.code !== code) {
    return res.status(400).json({ code: 400, message: '验证码错误' });
  }

  // 检查是否过期（5分钟）
  const createdTime = new Date(record.created_at.replace(/-/g, '/'));
  if (Date.now() - createdTime.getTime() > 5 * 60 * 1000) {
    return res.status(400).json({ code: 400, message: '验证码已过期，请重新获取' });
  }

  // 标记验证码已使用
  db.prepare('UPDATE verification_codes SET used = ? WHERE phone = ?').run(1, phone);

  // 查找或创建顾客
  let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  if (!customer) {
    const customerId = nanoid();
    db.prepare('INSERT INTO customers (id, phone, nickname, created_at, last_login_at) VALUES (?, ?, ?, ?, ?)').run(
      customerId, phone, '顾客' + phone.slice(-4), now(), now()
    );
    customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  } else {
    db.prepare('UPDATE customers SET last_login_at = ? WHERE phone = ?').run(now(), phone);
  }

  // 生成简单 token
  const token = nanoid();

  res.json({
    code: 'SUCCESS',
    message: '登录成功',
    customer: {
      id: customer.id,
      phone: customer.phone,
      nickname: customer.nickname,
    },
    token: token,
  });
});

module.exports = router;
