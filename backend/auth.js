const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const router = express.Router();

// 获取登录用户信息
router.get('/userinfo', async (req, res) => {
    // 从请求中获取登录用户名
    const username = req.query.username; // 假设前端在发送请求时会附带用户名参数

    try {
        // 查询数据库获取用户信息
        const [user] = await db.query('SELECT id, username, email, avatar_url FROM user WHERE username = ?', [username]);

        if (user.length === 0) {
            return res.status(404).send('用户不存在');
        }

        // 返回用户信息
        res.json(user[0]);
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).send('服务器错误');
    }
});

// 用户注册
router.post('/register', async (req, res) => {
    const { username, password, email } = req.body;

    // 检查用户名、密码和邮箱是否为空
    if (!username || !password || !email) {
        return res.status(400).send('用户名、密码和邮箱不能为空');
    }

    try {
        // 检查用户名是否已存在
        const [userWithSameUsername] = await db.query('SELECT username FROM user WHERE username = ?', [username]);
        if (userWithSameUsername.length > 0) {
            return res.status(409).send('用户名已存在');
        }

        // 检查邮箱是否已存在
        const [userWithSameEmail] = await db.query('SELECT email FROM user WHERE email = ?', [email]);
        if (userWithSameEmail.length > 0) {
            return res.status(409).send('邮箱已被使用，请使用其他邮箱');
        }

        // 插入新用户
        await db.query('INSERT INTO user (username, password, email) VALUES (?, ?, ?)', [username, password, email]);
        res.status(201).send('用户注册成功');
    } catch (error) {
        res.status(500).send('服务器错误');
    }
});

// 用户登录
router.post('/login/user', async (req, res) => {
    const { username, password } = req.body;

    // 检查用户名和密码是否为空
    if (!username || !password) {
        return res.status(400).send('用户名和密码不能为空');
    }

    try {
        const [user] = await db.query('SELECT * FROM user WHERE username = ?', [username]);

        if (user.length === 0) {
            return res.status(404).send('用户不存在');
        }

        if (user[0].password !== password) {
            return res.status(401).send('密码错误');
        }

        // 登录成功，返回跳转到用户界面的指令或数据
        res.send({ message: '登录成功', redirectTo: '/user-dashboard' });
    } catch (error) {
        res.status(500).send('服务器错误');
    }
});

// 管理员登录
router.post('/login/admin', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [admin] = await db.query('SELECT * FROM admin WHERE username = ?', [username]);

        if (admin.length === 0) {
            return res.status(404).send('管理员不存在');
        }

        if (admin[0].password !== password) {
            return res.status(401).send('密码错误');
        }

        // 登录成功，返回跳转到管理员界面的指令或数据
        res.send({ message: '登录成功', redirectTo: '/admin-dashboard' });
    } catch (error) {
        res.status(500).send('服务器错误');
    }
});

module.exports = router;
