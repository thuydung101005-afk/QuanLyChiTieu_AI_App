import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const db = new Database('finance.db');
const hashedPassword = await bcrypt.hash('123456', 10);
const result = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hashedPassword, 'Nguyen Manh');

if (result.changes > 0) {
    console.log('✅ Đặt lại mật khẩu thành công cho Nguyen Manh thành: 123456');
} else {
    console.log('❌ Không tìm thấy người dùng Nguyen Manh');
}
db.close();
