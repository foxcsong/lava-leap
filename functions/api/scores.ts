export const onRequestGet = async (context) => {
  const { request, env } = context;
  const db = env['game-db'];
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'score'; // 'score' 或 'mileage'
  const mode = url.searchParams.get('mode');
  const difficulty = url.searchParams.get('difficulty');

  try {
    const orderBy = type === 'score' ? 'score' : 'mileage';

    // --- 极致兼容性逻辑 (v2.4.9) ---
    // 我们显式处理各种参数情况，确保老版本前端发送的 ALL 或 NORMAL 也能正确工作
    let whereClauses: string[] = [];

    // 模式过滤逻辑
    if (mode && mode !== 'ALL') {
      if (mode === '1' || mode === 'COLOR_SHIFT') {
        whereClauses.push("(mode = '1' OR mode = 'COLOR_SHIFT')");
      } else {
        // 覆盖所有“普通模式”的历史变体
        whereClauses.push("(mode IS NULL OR mode = '0' OR mode = 'NORMAL' OR mode = '')");
      }
    }

    // 难度过滤逻辑
    if (difficulty && difficulty !== 'ALL') {
      if (difficulty === 'EASY') {
        whereClauses.push("(difficulty = 'EASY')");
      } else {
        // 覆盖所有“普通难度”的历史变体
        whereClauses.push("(difficulty IS NULL OR difficulty = 'NORMAL' OR difficulty = '' OR difficulty = '0')");
      }
    }

    const whereSection = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        ${whereSection}
      )
      WHERE rn = 1
      ORDER BY ${orderBy} DESC
      LIMIT 50
    `;

    const { results } = await db.prepare(query).all();
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
