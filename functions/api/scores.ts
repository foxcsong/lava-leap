export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const db = env['game-db'];
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'score'; // 'score' 或 'mileage'
  const mode = url.searchParams.get('mode');
  const difficulty = url.searchParams.get('difficulty');

  try {
    const orderBy = type === 'score' ? 'score' : 'mileage';

    // --- 极致兼容性逻辑 (v2.5.0) ---
    // 我们显式构建查询分支，不再依赖数据库的隐式转换
    let modeCondition = "";
    if (mode === '1' || mode === 'COLOR_SHIFT') {
      // 匹配变色模式
      modeCondition = "(mode = '1' OR mode = 'COLOR_SHIFT')";
    } else {
      // 匹配普通模式（包括所有历史遗留状态）
      modeCondition = "(mode IS NULL OR mode = '0' OR mode = 0 OR mode = 'NORMAL' OR mode = '')";
    }

    let diffCondition = "";
    if (difficulty === 'EASY') {
      // 匹配简单难度
      diffCondition = "(difficulty = 'EASY')";
    } else {
      // 匹配普通难度（包括所有历史遗留状态）
      diffCondition = "(difficulty IS NULL OR difficulty = 'NORMAL' OR difficulty = '' OR difficulty = '0' OR difficulty = 0)";
    }

    const query = `
      SELECT username, score, mileage, mode, difficulty
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY username ORDER BY ${orderBy} DESC) as rn
        FROM scores
        WHERE ${modeCondition} AND ${diffCondition}
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
