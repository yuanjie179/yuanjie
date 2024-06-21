const express = require('express');
const db = require('./db');
const router = express.Router();

// 获取所有用户信息
router.get('/all-users', async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, email FROM user');
        if (users.length > 0) {
            res.status(200).json(users);
        } else {
            res.status(404).send('没有用户信息');
        }
    } catch (error) {
        console.error('数据库查询失败', error);
        res.status(500).send('服务器错误');
    }
});

// 查询单个用户
router.get('/users', async (req, res) => {
    const { username } = req.query;

    try {
        let query = 'SELECT id, username, email FROM user';
        const params = [];

        if (username) {
            query += ' WHERE username LIKE ?';
            params.push(`%${username}%`);
        }

        const [users] = await db.query(query, params);
        if (users.length > 0) {
            res.status(200).json(users);
        } else {
            res.status(404).send('未找到用户');
        }
    } catch (error) {
        console.error('数据库查询失败', error);
        res.status(500).send('服务器错误');
    }
});

// 删除用户
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query('DELETE FROM user WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.status(200).send('用户删除成功');
        } else {
            res.status(404).send('未找到用户');
        }
    } catch (error) {
        console.error('数据库删除操作失败', error);
        res.status(500).send('服务器错误');
    }
});

// 添加小说
router.post('/novels', async (req, res) => {
    const { title, author, description, cover_image_url } = req.body;
    try {
        const [result] = await db.query('INSERT INTO novels (title, author, description, cover_image_url) VALUES (?, ?, ?, ?)', [title, author, description, cover_image_url]);
        res.status(201).send(`小说添加成功，ID: ${result.insertId}`);
    } catch (error) {
        console.error('数据库插入失败', error);
        res.status(500).send('服务器错误');
    }
});

// 删除小说
router.delete('/novels/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM novels WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            res.send('小说删除成功');
        } else {
            res.status(404).send('未找到小说');
        }
    } catch (error) {
        console.error('数据库删除操作失败', error);
        res.status(500).send('服务器错误');
    }
});

// 修改小说
router.put('/novels/:id', async (req, res) => {
    const { id } = req.params;
    const { title, author, description, cover_image_url } = req.body;
    try {
        const [result] = await db.query('UPDATE novels SET title = ?, author = ?, description = ?, cover_image_url = ? WHERE id = ?', [title, author, description, cover_image_url, id]);
        if (result.affectedRows > 0) {
            res.send('小说信息更新成功');
        } else {
            res.status(404).send('未找到小说');
        }
    } catch (error) {
        console.error('数据库更新操作失败', error);
        res.status(500).send('服务器错误');
    }
});

// 按书名或作者查询小说
router.get('/novels/search', async (req, res) => {
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


module.exports = router;
