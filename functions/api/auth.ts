export const onRequestPost = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];

    if (!db) {
        return new Response(JSON.stringify({ error: 'Database connection failed' }), { status: 500 });
    }

    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return new Response(JSON.stringify({ error: 'Username and password required' }), { status: 400 });
        }

        // 1. 广泛格式检查 (2-16位，支持多国语言、数字、常用符号及空格)
        // \p{L} 匹配任意语言字母, \p{N} 匹配数字, \p{P} 匹配标点与符号
        const nameRegex = /^[\p{L}\p{N}\p{P}\s]{2,16}$/u;
        if (!nameRegex.test(username)) {
            return new Response(JSON.stringify({ error: '名字需为2-16位中外文字符、数字或符号' }), { status: 400 });
        }

        // 2. 敏感词简单过滤 (生产环境建议接入专业API，此处演示基础逻辑)
        const forbiddenWords = ['admin', 'manager', 'root', 'system', 'shit', 'fuck', 'sb', 'bitch', 'tmd', 'nmd'];
        if (forbiddenWords.some(word => username.toLowerCase().includes(word))) {
            return new Response(JSON.stringify({ error: '名字包含不当内容，请换一个' }), { status: 400 });
        }

        // 尝试查找用户
        const user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();

        if (!user) {
            // 注册逻辑
            const result = await db.prepare('INSERT INTO users (username, password) VALUES (?, ?)')
                .bind(username, password)
                .run();

            const newUser = await db.prepare('SELECT id, username FROM users WHERE id = ?').bind(result.meta.last_row_id).first();
            return new Response(JSON.stringify({ message: 'Registered successfully', user: newUser }), { status: 201 });
        } else {
            // 登录逻辑
            if (user.password === password) {
                return new Response(JSON.stringify({ message: 'Logged in successfully', user: { id: user.id, username: user.username } }), { status: 200 });
            } else {
                return new Response(JSON.stringify({ error: 'Invalid password' }), { status: 401 });
            }
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
