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
        // 兼容性处理：mode 为 NULL 或 'NORMAL' 时归为 '0'；difficulty 为 NULL 时归为 'NORMAL'
        query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        ${mode || difficulty ? 'WHERE ' + [
                mode ? "COALESCE(NULLIF(mode, 'NORMAL'), '0') = ?" : '',
                difficulty ? "COALESCE(difficulty, 'NORMAL') = ?" : ''
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
