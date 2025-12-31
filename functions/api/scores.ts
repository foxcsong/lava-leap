export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const db = env['game-db'];
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'score';
  const mode = url.searchParams.get('mode');
  const difficulty = url.searchParams.get('difficulty');

  try {
    const orderBy = type === 'score' ? 'score' : 'mileage';

    // --- 直接并行匹配逻辑 (v2.5.1) ---
    const modeIsColor = (mode === '1' || mode === 'COLOR_SHIFT');
    const diffIsEasy = (difficulty === 'EASY');

    const modeClause = modeIsColor ?
      "(mode = '1' OR mode = 'COLOR_SHIFT')" :
      "(mode IS NULL OR mode = '0' OR mode = 0 OR mode = 'NORMAL' OR mode = '')";

    const diffClause = diffIsEasy ?
      "(difficulty = 'EASY')" :
      "(difficulty IS NULL OR difficulty = 'NORMAL' OR difficulty = '' OR difficulty = '0' OR difficulty = 0)";

    // 移除分区聚合，全量展示前 50 名，诊断所有数据记录
    const query = `
      SELECT username, score, mileage, mode, difficulty
      FROM scores
      WHERE ${modeClause} AND ${diffClause}
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
