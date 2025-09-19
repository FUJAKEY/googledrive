import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';

describe('Аутентификация', () => {
  const app = createApp();

  it('регистрирует и авторизует пользователя', async () => {
    const registerResponse = await request(app).post('/api/auth/register').send({
      email: 'user@example.com',
      password: 'password123',
      name: 'Test User'
    });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toBeDefined();
    expect(registerResponse.body.user.email).toBe('user@example.com');

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.get('set-cookie')).toBeDefined();

    const refreshCookie = loginResponse.get('set-cookie')?.find((cookie) =>
      cookie.startsWith('clouddrive.refresh')
    );

    expect(refreshCookie).toBeDefined();

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie ?? '')
      .send();

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toBeDefined();
  });

  it('не допускает авторизацию с неверным паролем', async () => {
    await prisma.user.create({
      data: {
        email: 'fail@example.com',
        password: await bcrypt.hash('password123', 10),
        name: 'Existing'
      }
    });

    const response = await request(app).post('/api/auth/login').send({
      email: 'fail@example.com',
      password: 'wrongpass'
    });

    expect(response.status).toBe(401);
  });
});
