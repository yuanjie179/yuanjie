const express = require('express'); // 导入Express模块
const path = require('path'); // 导入path模块
const authRoutes = require('./auth'); // 导入auth路由
const homeRoutes = require('./home'); // 导入home路由
const cors = require('cors'); // 导入CORS中间件
const app = express(); // 创建Express应用

// 设定静态文件路径
const staticFilesPath = path.join(__dirname, 'public/images');

app.use(cors()); // 使用CORS中间件
app.use(express.json()); // 使用JSON解析中间件
app.use('/images', express.static(staticFilesPath)); // 设置静态文件路由
app.use('/api', authRoutes); // 设置auth路由
app.use('/api', homeRoutes); // 设置home路由

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
