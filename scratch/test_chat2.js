import 'dotenv/config';
import axios from 'axios';

// Login
const login = await axios.post('http://localhost:3001/api/auth/login', { username: 'chattest', password: '123456' });
const token = login.data.token;
console.log('Token obtained');

// Chat
try {
    const chat = await axios.post('http://localhost:3001/api/chat', 
        { message: 'xin chào' },
        { headers: { Authorization: 'Bearer ' + token }, timeout: 60000 }
    );
    console.log('✅ Chat OK:', JSON.stringify(chat.data));
} catch (err) {
    console.error('❌ Chat Error:', err.response?.status, JSON.stringify(err.response?.data));
}
