const bcrypt = require('bcryptjs');

const password = "123123";
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function (err, hash) {
    if (err) {
        console.error(err);
        return;
    }
    console.log("加密后的密码:", hash);
    // 更新数据库中的密码为这个加密后的密码
});
