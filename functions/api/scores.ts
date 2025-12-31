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

        // 使用子查询确保每个 username 只有最高记录出现在榜单上
        // 通过 CASE 语句进行最强力的规范化：
        // mode: NULL, '', 'NORMAL', '0', 0 均映射为 '0' (普通模式)
        // mode: 'COLOR_SHIFT', '1', 1 均映射为 '1' (变色模式)
        // difficulty: NULL, '', 'NORMAL' 均映射为 'NORMAL'
        query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        ${mode || difficulty ? 'WHERE ' + [
                mode ? `(CASE
            WHEN mode IS NULL OR mode = '' OR mode = 'NORMAL' OR mode = '0' OR mode = 0 THEN '0'
            WHEN mode = 'COLOR_SHIFT' OR mode = '1' OR mode = 1 THEN '1'
            ELSE CAST(mode AS TEXT)
          END) = ?` : '',
                difficulty ? `(CASE
            WHEN difficulty IS NULL OR difficulty = '' OR difficulty = 'NORMAL' THEN 'NORMAL'
            ELSE difficulty
          END) = ?` : ''
            ].filter(Boolean).join(' AND ') : ''}
      )
      WHERE rn = 1
      ORDER BY ${orderBy} DESC
      LIMIT 50
    `;

        if (mode) params.push(mode);
        if (difficulty) params.push(difficulty);

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
