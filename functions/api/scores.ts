export const onRequestGet = async (context) => {
  const { request, env } = context;
  const db = env['game-db'];
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'score'; // 'score' 或 'mileage'
  const mode = url.searchParams.get('mode');
  const difficulty = url.searchParams.get('difficulty');

  try {
    let query = '';
    const orderBy = type === 'score' ? 'score' : 'mileage';

    // --- 深度兼容性匹配逻辑 (换个思路：相信字面匹配，不依赖绑定类型) ---
    const isColorShift = (mode === '1' || mode === 'COLOR_SHIFT');
    const isEasy = (difficulty === 'EASY');

    // 构建普通模式(0)匹配集：NULL, '', '0', 0, 'NORMAL'
    // 构建普通难度(NORMAL)匹配集：NULL, '', 'NORMAL', '0', 0
    const modeMatch = isColorShift ?
      "(TRIM(mode) = '1' OR mode = 1 OR UPPER(TRIM(mode)) = 'COLOR_SHIFT')" :
      "(mode IS NULL OR TRIM(mode) = '' OR TRIM(mode) = '0' OR mode = 0 OR UPPER(TRIM(mode)) = 'NORMAL')";

    const diffMatch = isEasy ?
      "(UPPER(TRIM(difficulty)) = 'EASY')" :
      "(difficulty IS NULL OR TRIM(difficulty) = '' OR UPPER(TRIM(difficulty)) = 'NORMAL' OR TRIM(difficulty) = '0' OR difficulty = 0)";

    query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        WHERE ${modeMatch} AND ${diffMatch}
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
