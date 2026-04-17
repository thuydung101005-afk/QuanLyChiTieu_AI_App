import express from 'express';
import bcrypt from 'bcrypt';
import db, { seedDefaultJarsForUser } from './database.js';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';

router.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const id = Date.now().toString();
        const hashedPassword = await bcrypt.hash(password, 10);

        db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)')
            .run(id, username, hashedPassword);

        // Assign default custom 6 Jars to the newly created user
        seedDefaultJarsForUser(id);

        res.status(201).json({ success: true, message: 'User created' });
    } catch (err: any) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Issue JWT here
        const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({ success: true, token, user: { id: user.id, username: user.username } });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
