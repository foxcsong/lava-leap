export const onRequestGet = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'score'; // 'score' 或 'mileage'
    const mode = url.searchParams.get('mode');
    const difficulty = url.searchParams.get('difficulty');

    try {
        let query = '';
        let params: any[] = [];
        const orderBy = type === 'score' ? 'score' : 'mileage';

        // --- 参数预标准化 ---
        let targetMode = (mode === 'NORMAL' || mode === '0' || !mode || mode === 'ALL') ? '0' : '1';
        let targetDiff = (difficulty === 'NORMAL' || !difficulty || difficulty === 'ALL') ? 'NORMAL' : 'EASY';

        // 使用子查询确保每个 username 只有最高记录出现在榜单上
        // 精准匹配逻辑：
        //   普通模式(0)：匹配 NULL, '', '0', 0, 'NORMAL'
        //   变色模式(1)：匹配 '1', 1, 'COLOR_SHIFT'
        //   普通难度(NORMAL)：匹配 NULL, '', 'NORMAL'
        //   简单难度(EASY)：匹配 'EASY'
        query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        WHERE (
          (? = '0' AND (mode IS NULL OR mode = '' OR mode = '0' OR mode = 0 OR mode = 'NORMAL'))
          OR
          (? = '1' AND (mode = '1' OR mode = 1 OR mode = 'COLOR_SHIFT'))
        )
        AND (
          (? = 'NORMAL' AND (difficulty IS NULL OR difficulty = '' OR difficulty = 'NORMAL'))
          OR
          (? = 'EASY' AND (difficulty = 'EASY'))
        )
      )
      WHERE rn = 1
      ORDER BY ${orderBy} DESC
      LIMIT 50
    `;

        // 绑定参数：注意 SQL 中有 4 个占位符，需按顺序填充
        params.push(targetMode, targetMode, targetDiff, targetDiff);

        const { results } = await db.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(results), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify(err.message), { status: 500 });
    }
};

export const onRequestPost = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];

    try {
        const { user_id, username, mileage, score, mode, difficulty } = await request.json();

        await db.prepare('INSERT INTO scores (user_id, username, mileage, score, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(user_id || null, username || 'Anonymous', mileage, score, mode, difficulty || 'NORMAL')
            .run();

        return new Response(JSON.stringify({ message: 'Score submitted' }), { status: 201 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
