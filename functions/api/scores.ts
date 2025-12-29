export const onRequestGet = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'score'; // 'score' 或 'mileage'

    try {
        let query = '';
        if (type === 'score') {
            query = 'SELECT username, score, mileage, mode FROM scores ORDER BY score DESC LIMIT 10';
        } else {
            query = 'SELECT username, score, mileage, mode FROM scores ORDER BY mileage DESC LIMIT 10';
        }

        const { results } = await db.prepare(query).all();
        return new Response(JSON.stringify(results), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

export const onRequestPost = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];

    try {
        const { user_id, username, mileage, score, mode } = await request.json();

        await db.prepare('INSERT INTO scores (user_id, username, mileage, score, mode) VALUES (?, ?, ?, ?, ?)')
            .bind(user_id || null, username || 'Anonymous', mileage, score, mode)
            .run();

        return new Response(JSON.stringify({ message: 'Score submitted' }), { status: 201 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
