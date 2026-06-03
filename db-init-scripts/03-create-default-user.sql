\c kontur;
-- Создаём администратора (пароль: admin123)
INSERT INTO "user" (login, password_hash, role) 
VALUES ('admin', crypt('admin123', gen_salt('bf')), 'admin')
ON CONFLICT (login) DO NOTHING;