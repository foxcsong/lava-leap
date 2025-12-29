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
            // 获取完整列表用于管理
            const { results } = await db.prepare('SELECT * FROM scores ORDER BY timestamp DESC LIMIT 200').all();
            return new Response(JSON.stringify(results), { status: 200 });
        }

        if (method === 'DELETE') {
            const id = url.searchParams.get('id');
            if (id) {
                await db.prepare('DELETE FROM scores WHERE id = ?').bind(id).run();
                return new Response(JSON.stringify({ message: 'Deleted' }), { status: 200 });
            }
        }

        return new Response('Not Implemented', { status: 501 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
