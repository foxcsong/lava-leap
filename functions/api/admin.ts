export const onRequest = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];
    const adminKey = env['ADMIN_KEY']; // 需在 Cloudflare 环境变量中设置

    const clientKey = request.headers.get('X-Admin-Key');

    if (!adminKey || clientKey !== adminKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const url = new URL(request.url);
    const method = request.method;

    try {
        if (method === 'GET') {
            const page = parseInt(url.searchParams.get('page') || '1');
            const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
            const search = url.searchParams.get('search') || '';
            const offset = (page - 1) * pageSize;

            let query = 'SELECT * FROM scores';
            let countQuery = 'SELECT COUNT(*) as total FROM scores';
            let params: any[] = [];

            if (search) {
                const where = ' WHERE username LIKE ?';
                query += where;
                countQuery += where;
                params.push(`%${search}%`);
            }

            query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
            const queryParams = [...params, pageSize, offset];

            const { results } = await db.prepare(query).bind(...queryParams).all();
            const { total } = await db.prepare(countQuery).bind(...params).first();

            return new Response(JSON.stringify({
                results,
                total,
                page,
                pageSize
            }), { status: 200 });
        }

        if (method === 'DELETE') {
            const id = url.searchParams.get('id');
            if (id) {
                await db.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ message: 'Deleted' }), { status: 200 });
            }
        }

        if (method === 'POST') {
            const { action } = await request.json();
            if (action === 'MIGRATE') {
                // 将所有 0.0, NULL, 空串等格式归一化为标准的 0 (Normal)
                await db.prepare(`
                    UPDATE scores 
                    SET mode = '0' 
                    WHERE mode IS NULL OR mode = '' OR mode = '0.0' OR mode = 0 OR mode = 'NORMAL'
                `).run();

                await db.prepare(`
                    UPDATE scores 
                    SET difficulty = 'NORMAL' 
                    WHERE difficulty IS NULL OR difficulty = '' OR difficulty = '0.0' OR difficulty = 0 OR difficulty = 'NORMAL'
                `).run();

                return new Response(JSON.stringify({ message: 'Migration successful' }), { status: 200 });
            }

            if (action === 'CLEANUP_DUPLICATES') {
                // 物理去重：每个用户在【每个模式+每个难度】下仅保留一条最高分记录
                // 此逻辑会自动适配未来新增的任何模式
                const query = `
                    DELETE FROM scores 
                    WHERE id NOT IN (
                        SELECT id FROM (
                            SELECT id, ROW_NUMBER() OVER (
                                PARTITION BY username, mode, difficulty 
                                ORDER BY score DESC, mileage DESC, timestamp DESC
                            ) as rn
                            FROM scores
                        ) WHERE rn = 1
                    )
                `;

                await db.prepare(query).run();
                return new Response(JSON.stringify({ message: 'Cleanup successful' }), { status: 200 });
            }

            if (action === 'DELETE_USER_SCORES') {
                const { username } = await request.json();
                if (!username) {
                    return new Response(JSON.stringify({ error: 'Username required' }), { status: 400 });
                }

                // 物理删除该用户的所有记录（全模式全难度一站式清理）
                await db.prepare('DELETE FROM scores WHERE TRIM(username) = TRIM(?)').bind(username).run();

                return new Response(JSON.stringify({ message: `All scores for ${username} deleted` }), { status: 200 });
            }
        }

        return new Response('Not Implemented', { status: 501 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
