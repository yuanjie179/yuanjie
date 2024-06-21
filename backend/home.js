const express = require('express');
const db = require('./db');
const router = express.Router();
const pool = require('./db');

// 按书名或作者查询小说
router.get('/search', async (req, res) => {
    const { title, author } = req.query;

    let query = 'SELECT * FROM novels';
    let conditions = [];
    let params = [];

    if (title) {
        conditions.push('title LIKE ?');
        params.push(`%${title}%`);
    }

    if (author) {
        conditions.push('author LIKE ?');
        params.push(`%${author}%`);
    }

    if (conditions.length) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    try {
        const [results] = await db.query(query, params);
        if (results.length > 0) {
            res.status(200).json(results);
        } else {
            res.status(404).send('没有找到符合条件的小说');
        }
    } catch (error) {
        console.error('数据库查询失败', error);
        res.status(500).send('服务器错误');
    }
});

// 获取所有小说的API路由
router.get('/novels', async (req, res) => {
    try {
        // 执行 SQL 查询以获取小说表中的所有条目
        const [novels] = await db.query('SELECT * FROM novels');
        // 设置响应头，明确返回内容类型为 JSON
        res.setHeader('Content-Type', 'application/json');
        // 将查询结果作为 JSON 发送回客户端
        res.json(novels);
    } catch (error) {
        // 在服务器控制台打印错误详情，便于后端开发者调试
        console.error(`Error fetching novels: ${error.message}`);
        // 向客户端发送500状态码和错误信息
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 获取推荐小说（首页的轮播图及推荐榜单中的小说）
router.get('/featured-novels', async (req, res) => {
    try {
        const [featuredNovels] = await db.query('SELECT novel_id, title, cover_image_url, summary FROM novels WHERE is_featured = TRUE');
        if (featuredNovels.length > 0) {
            res.status(200).json(featuredNovels);
        } else {
            res.status(404).send('没有找到推荐小说');
        }
    } catch (error) {
        console.error('数据库查询失败', error);
        res.status(500).send('服务器错误');
    }
});

// 获取单个小说的API路由
router.get('/novels/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [novel] = await db.query('SELECT * FROM novels WHERE id = ?', [id]);
        if (novel.length > 0) {
            res.status(200).json(novel[0]); // 返回对象而不是数组
        } else {
            res.status(404).send('没有找到该小说');
        }
    } catch (error) {
        console.error(`Error fetching novel with id ${id}: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});


// 获取小说的章节列表
router.get('/novels/:id/chapters', async (req, res) => {
    const { id } = req.params;

    try {
        const [chapters] = await db.query('SELECT id, title FROM chapters WHERE novel_id = ?', [id]);
        if (chapters.length > 0) {
            res.status(200).json(chapters);
        } else {
            res.status(404).send('没有找到该小说的章节');
        }
    } catch (error) {
        console.error(`Error fetching chapters for novel with id ${id}: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 获取单个章节内容
router.get('/chapters/:chapterId', async (req, res) => {
    const { chapterId } = req.params;

    try {
        const [chapter] = await db.query('SELECT title, content FROM chapters WHERE id = ?', [chapterId]);
        if (chapter.length > 0) {
            res.status(200).json(chapter[0]);
        } else {
            res.status(404).send('没有找到该章节');
        }
    } catch (error) {
        console.error(`Error fetching chapter with id ${chapterId}: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 将小说加入书架
router.post('/bookshelf', async (req, res) => {
    const { user_id, novel_id } = req.body;

    if (!user_id || !novel_id) {
        return res.status(400).json({ error: '缺少必要的参数' });
    }

    try {
        const [existingEntry] = await db.query('SELECT * FROM bookshelf WHERE user_id = ? AND novel_id = ?', [user_id, novel_id]);
        if (existingEntry.length) {
            return res.status(409).json({ error: '此小说已在书架上' });
        }

        await db.query('INSERT INTO bookshelf (user_id, novel_id) VALUES (?, ?)', [user_id, novel_id]);
        res.status(201).json({ message: '小说已成功加入书架' });
    } catch (error) {
        console.error('数据库操作失败', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 用户给小说打赏月票并加入书架
router.post('/reward', async (req, res) => {
    const { user_id, novel_id, tickets } = req.body;

    if (!tickets || tickets <= 0) {
        return res.status(400).json({ error: '请输入有效的打赏月票数' });
    }

    let connection;

    try {
        // 从连接池获取连接
        connection = await pool.getConnection();

        // 开启事务
        await connection.beginTransaction();

        // 检查用户的月票是否足够
        const [user] = await connection.query('SELECT monthly_tickets FROM user WHERE id = ?', [user_id]);
        if (user.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: '用户不存在' });
        }

        if (user[0].monthly_tickets < tickets) {
            await connection.rollback();
            return res.status(400).json({ error: '月票数不足' });
        }

        // 减少用户的月票数量
        await connection.query('UPDATE user SET monthly_tickets = monthly_tickets - ? WHERE id = ?', [tickets, user_id]);

        // 将小说加入书架，首先检查是否已经在书架上
        const [exists] = await connection.query('SELECT * FROM bookshelf WHERE user_id = ? AND novel_id = ?', [user_id, novel_id]);
        if (exists.length === 0) {
            // 小说不在书架上，加入书架
            await connection.query('INSERT INTO bookshelf (user_id, novel_id) VALUES (?, ?)', [user_id, novel_id]);
        }

        // 提交事务
        await connection.commit();
        res.json({ message: '打赏成功，小说已加入书架' });
    } catch (error) {
        // 如果在任何一步出现问题，回滚事务
        if (connection) await connection.rollback();
        console.error('数据库操作失败', error);
        res.status(500).json({ error: '服务器错误' });
    } finally {
        // 释放连接回连接池
        if (connection) connection.release();
    }
});

//根据用户id获取相应的小说展示在书架
router.get('/bookshelf/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const [bookshelf] = await db.query(`
            SELECT novels.id, novels.title, novels.cover_image_url
            FROM bookshelf
            JOIN novels ON bookshelf.novel_id = novels.id
            WHERE bookshelf.user_id = ?
        `, [user_id]);

        if (bookshelf.length > 0) {
            res.status(200).json(bookshelf);
        } else {
            res.status(404).send('暂无小说');
        }
    } catch (error) {
        console.error('数据库操作失败', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 删除书架中小说
router.delete('/bookshelf/delete', async (req, res) => {
    const { user_id, novel_ids } = req.body;

    if (!user_id || !novel_ids || !Array.isArray(novel_ids)) {
        return res.status(400).send('缺少必要的参数');
    }

    try {
        // 删除书架中对应的小说条目
        await db.query('DELETE FROM bookshelf WHERE user_id = ? AND novel_id IN (?)', [user_id, novel_ids]);
        res.status(200).send('成功删除书架中的小说');
    } catch (error) {
        console.error('数据库操作失败', error);
        res.status(500).send('服务器错误');
    }
});


// 添加章节的API路由
router.post('/novels/:novel_id/chapters', async (req, res) => {
    const { novel_id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: '章节标题和内容不能为空' });
    }

    try {
        const result = await db.query('INSERT INTO chapters (novel_id, title, content) VALUES (?, ?, ?)', [novel_id, title, content]);
        res.status(201).json({ message: '章节添加成功', chapterId: result.insertId });
    } catch (error) {
        console.error('数据库操作失败', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 编辑章节的API路由
router.put('/chapters/:chapterId', async (req, res) => {
    const { chapterId } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: '章节标题和内容不能为空' });
    }

    try {
        await db.query('UPDATE chapters SET title = ?, content = ? WHERE id = ?', [title, content, chapterId]);
        res.status(200).json({ message: '章节更新成功' });
    } catch (error) {
        console.error(`数据库操作失败: ${error.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 删除章节的API路由
router.delete('/chapters/:chapterId', async (req, res) => {
    const { chapterId } = req.params;

    try {
        await db.query('DELETE FROM chapters WHERE id = ?', [chapterId]);
        res.status(200).json({ message: '章节删除成功' });
    } catch (error) {
        console.error(`数据库操作失败: ${error.message}`);
        res.status(500).json({ error: '服务器错误' });
    }
});


// 获取所有小说，并按月票数量排序
router.get('/novels/rankings', async (req, res) => { // 修改为新的路径
    try {
        const [rows] = await db.query('SELECT * FROM novels ORDER BY monthly_tickets DESC');
        console.log('排行榜小说数据:', rows); // 添加日志输出查询结果
        res.json(rows);
    } catch (error) {
        console.error('获取小说数据失败', error);
        res.status(500).send('服务器错误');
    }
});

// 修改用户信息的API路由
router.post('/user/update', async (req, res) => {
    const { username, email, password } = req.body;
    const query = 'UPDATE user SET email = ?, password = ? WHERE username = ?';

    try {
        await db.query(query, [email, password, username]);
        res.sendStatus(200);
    } catch (error) {
        console.error('更新用户信息时出错:', error);
        res.status(500).send('更新用户信息失败');
    }
});

// 修改密码的API路由
router.post('/user/update-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    const query = 'SELECT * FROM user WHERE username = ?';

    try {
        const [users] = await db.query(query, [username]);
        if (users.length === 0) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const user = users[0];
        if (user.password !== currentPassword) {
            return res.status(400).json({ error: '当前密码不正确' });
        }

        const updateQuery = 'UPDATE user SET password = ? WHERE username = ?';
        await db.query(updateQuery, [newPassword, username]);
        res.sendStatus(200);
    } catch (error) {
        console.error('更新密码时出错:', error);
        res.status(500).send('更新密码失败');
    }
});


module.exports = router;