export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const db = env['game-db'];
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'score';
  const mode = url.searchParams.get('mode');
  const difficulty = url.searchParams.get('difficulty');

  try {
    const orderBy = type === 'score' ? 'score' : 'mileage';

    // --- 直接并行匹配逻辑 (v2.5.2) ---
    const modeIsColor = (mode === '1' || mode === 'COLOR_SHIFT');
    const diffIsEasy = (difficulty === 'EASY');

    const modeClause = modeIsColor ?
      "(TRIM(mode) = '1' OR TRIM(mode) = 'COLOR_SHIFT')" :
      "(mode IS NULL OR TRIM(mode) = '' OR TRIM(mode) = '0' OR mode = 0 OR TRIM(mode) = 'NORMAL')";

    const diffClause = diffIsEasy ?
      "(TRIM(difficulty) = 'EASY')" :
      "(difficulty IS NULL OR TRIM(difficulty) = 'NORMAL' OR TRIM(difficulty) = '' OR TRIM(difficulty) = '0' OR difficulty = 0)";

    // 恢复分区聚合：同一个用户在同模式同难度下只保留最高纪录
    const query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        WHERE ${modeClause} AND ${diffClause}
      )
      WHERE rn = 1
      ORDER BY ${orderBy} DESC
      LIMIT 50
    `;

    const { results } = await db.prepare(query).all();
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  const db = env['game-db'];

  try {
    const data = await request.json();
    const { user_id, username, mileage, score, mode, difficulty } = data;

    // 存入前进行强行归一化
    const finalMode = (mode === '1' || mode === 1 || mode === 'COLOR_SHIFT') ? '1' : '0';
    const finalDiff = (difficulty === 'EASY') ? 'EASY' : 'NORMAL';

    await db.prepare('INSERT INTO scores (user_id, username, mileage, score, mode, difficulty) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user_id || null, username || 'Anonymous User', mileage || 0, score || 0, finalMode, finalDiff)
      .run();

    return new Response(JSON.stringify({ message: 'Score submitted' }), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
