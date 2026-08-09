/**
 * 顾客端菜单路由
 * 提供菜品分类及菜品列表查询
 */
const express = require('express');
const { db } = require('../database');

const router = express.Router();

/**
 * GET /api/menu
 * 获取菜单（按分类分组，只返回上架的分类和可用的菜品）
 * 返回格式：{ categories: [{ id, name, dishes: [{ id, name, description, price, image_url }] }] }
 */
router.get('/', (req, res) => {
  // 查询所有启用的分类，按 sort_order 排序
  const categories = db
    .prepare('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
    .all();

  // 查询所有可用的菜品，按 sort_order 排序
  const dishes = db
    .prepare(
      'SELECT id, category_id, name, description, price, image_url FROM dishes WHERE is_available = 1 ORDER BY sort_order ASC, id ASC'
    )
    .all();

  // 将菜品按分类 ID 分组
  const dishesByCategory = {};
  dishes.forEach((dish) => {
    if (!dishesByCategory[dish.category_id]) {
      dishesByCategory[dish.category_id] = [];
    }
    dishesByCategory[dish.category_id].push({
      id: dish.id,
      name: dish.name,
      description: dish.description,
      price: dish.price,
      image_url: dish.image_url,
    });
  });

  // 组装最终返回结构
  const result = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    dishes: dishesByCategory[cat.id] || [],
  }));

  res.json({ categories: result });
});

module.exports = router;
