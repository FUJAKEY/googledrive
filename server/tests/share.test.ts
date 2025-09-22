import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

async function authenticate() {
  const response = await request(app).post('/api/auth/register').send({
    email: 'share@example.com',
    password: 'password123',
    name: 'Share User'
  });

  const accessToken = response.body.accessToken as string;
  return { accessToken };
}

describe('Публичные ссылки', () => {
  it('отдаёт JSON и архив для расшаренной папки', async () => {
    const { accessToken } = await authenticate();

    const folderResponse = await request(app)
      .post('/api/drive/folder')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Проекты' });

    expect(folderResponse.status).toBe(201);
    const folderId = folderResponse.body.item.id as string;

    const fileUpload = await request(app)
      .post('/api/drive/file')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('parentId', folderId)
      .attach('files', Buffer.from('Shared content'), 'shared.txt');

    expect(fileUpload.status).toBe(201);

    const shareResponse = await request(app)
      .post(`/api/share/${folderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ permission: 'VIEW' });

    expect(shareResponse.status).toBe(201);
    const token = shareResponse.body.link.token as string;

    const publicJson = await request(app).get(`/s/${token}`).set('Accept', 'application/json');

    expect(publicJson.status).toBe(200);
    expect(publicJson.body.archiveUrl).toContain(`/s/${token}/archive`);
    expect(Array.isArray(publicJson.body.children)).toBe(true);

    const archiveResponse = await request(app).get(`/s/${token}/archive`);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.headers['content-type']).toBe('application/zip');
  });
});
