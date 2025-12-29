export const onRequestGet = async (context) => {
    const { request, env } = context;
    const db = env['game-db'];
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'score'; // 'score' 或 'mileage'
    const mode = url.searchParams.get('mode');
    const difficulty = url.searchParams.get('difficulty');

    try {
        let query = 'SELECT username, score, mileage, mode, difficulty FROM scores';
        let conditions: string[] = [];
        let params: any[] = [];

        if (mode) {
            conditions.push('mode = ?');
            params.push(mode);
        }
        if (difficulty) {
            conditions.push('difficulty = ?');
            params.push(difficulty);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += type === 'score' ? ' ORDER BY score DESC LIMIT 10' : ' ORDER BY mileage DESC LIMIT 10';

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
