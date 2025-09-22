import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

async function authenticate() {
  const response = await request(app).post('/api/auth/register').send({
    email: 'drive@example.com',
    password: 'password123',
    name: 'Drive User'
  });

  const accessToken = response.body.accessToken as string;
  const cookie = response.get('set-cookie')?.find((item) => item.startsWith('clouddrive.refresh'));
  return { accessToken, cookie };
}

describe('Файловый менеджер', () => {
  it('создает папку, загружает файл и восстанавливает его из корзины', async () => {
    const { accessToken } = await authenticate();

    const folderResponse = await request(app)
      .post('/api/drive/folder')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Docs' });

    expect(folderResponse.status).toBe(201);
    const folderId = folderResponse.body.item.id as string;

    const fileUpload = await request(app)
      .post('/api/drive/file')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('parentId', folderId)
      .attach('files', Buffer.from('Hello CloudDrive'), 'note.txt');

    expect(fileUpload.status).toBe(201);
    const fileId = fileUpload.body.items[0].id as string;

    const listResponse = await request(app)
      .get('/api/drive/list')
      .query({ parentId: folderId })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);

    const deleteResponse = await request(app)
      .delete(`/api/drive/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const trashResponse = await request(app)
      .get('/api/drive/list')
      .query({ trashed: 'true' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(trashResponse.body.items.some((item: any) => item.id === fileId)).toBe(true);

    const restoreResponse = await request(app)
      .post(`/api/drive/${fileId}/restore`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send();

    expect(restoreResponse.status).toBe(200);

    const shareResponse = await request(app)
      .post(`/api/share/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ permission: 'VIEW' });

    expect(shareResponse.status).toBe(201);
    const token = shareResponse.body.link.token as string;
    expect(shareResponse.body.link.url).toMatch(/^http:\/\/127\.0\.0\.1/);

    const publicResponse = await request(app).get(`/s/${token}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.item.name).toBe('note.txt');

    const archiveResponse = await request(app)
      .post('/api/drive/archive')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ids: [fileId] });

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.headers['content-type']).toBe('application/zip');
  });

  it('создает API-ключ и выполняет операции с файлами через него', async () => {
    const { accessToken } = await authenticate();

    const createResponse = await request(app)
      .post('/api/auth/api-keys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'CI тест' });

    expect(createResponse.status).toBe(201);
    const apiKey = createResponse.body.key as string;
    const apiKeyId = createResponse.body.apiKey.id as string;

    const listKeys = await request(app)
      .get('/api/auth/api-keys')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(listKeys.status).toBe(200);
    expect(Array.isArray(listKeys.body.keys)).toBe(true);
    expect(listKeys.body.keys.some((key: any) => key.id === apiKeyId)).toBe(true);

    const uploadResponse = await request(app)
      .post('/api/drive/file')
      .set('x-api-key', apiKey)
      .attach('files', Buffer.from('API key upload'), 'api.txt');

    expect(uploadResponse.status).toBe(201);
    const uploadedId = uploadResponse.body.items[0].id as string;

    const listResponse = await request(app)
      .get('/api/drive/list')
      .set('x-api-key', apiKey);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items.some((item: any) => item.id === uploadedId)).toBe(true);

    const downloadResponse = await request(app)
      .get(`/api/drive/${uploadedId}/download`)
      .set('x-api-key', apiKey);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers['content-type']).toContain('text/plain');

    const deleteKeyResponse = await request(app)
      .delete(`/api/auth/api-keys/${apiKeyId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteKeyResponse.status).toBe(204);

    const unauthorizedResponse = await request(app)
      .get('/api/drive/list')
      .set('x-api-key', apiKey);

    expect(unauthorizedResponse.status).toBe(401);
  });
});
