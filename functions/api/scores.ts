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

        // --- 参数预标准化 (JS 层处理) ---
        let normalizedMode: string | null = null;
        if (mode && mode !== 'ALL') {
            // NORMAL, 0, '0' -> '0'
            if (mode === 'NORMAL' || mode === '0' || mode === '0') {
                normalizedMode = '0';
            }
            // COLOR_SHIFT, 1, '1' -> '1'
            else if (mode === 'COLOR_SHIFT' || mode === '1') {
                normalizedMode = '1';
            }
            else {
                normalizedMode = mode;
            }
        }

        let normalizedDiff: string | null = null;
        if (difficulty && difficulty !== 'ALL') {
            if (difficulty === 'NORMAL') normalizedDiff = 'NORMAL';
            else if (difficulty === 'EASY') normalizedDiff = 'EASY';
            else normalizedDiff = difficulty;
        }

        // 使用子查询确保每个 username 只有最高记录出现在榜单上
        // SQL 层配合规范化判定：
        //   对于 mode: 将 NULL / '' / 0 / 'NORMAL' 视为 '0'
        //   对于 difficulty: 将 NULL / '' 视为 'NORMAL'
        query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        ${normalizedMode || normalizedDiff ? 'WHERE ' + [
                normalizedMode ? "(CASE WHEN mode IS NULL OR mode = '' OR mode = 'NORMAL' THEN '0' ELSE CAST(mode AS TEXT) END) = ?" : '',
                normalizedDiff ? "COALESCE(NULLIF(difficulty, ''), 'NORMAL') = ?" : ''
            ].filter(Boolean).join(' AND ') : ''}
      )
      WHERE rn = 1
      ORDER BY ${orderBy} DESC
      LIMIT 50
    `;

        if (normalizedMode) params.push(normalizedMode);
        if (normalizedDiff) params.push(normalizedDiff);

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
