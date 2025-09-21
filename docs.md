# CloudDrive API

Документ описывает работу CloudDrive на уровне REST API, управление API-ключами и примерные `curl`-сценарии. Все эндпоинты расположены по умолчанию на `http://localhost:8000`. При деплое замените хост на значение из `BASE_URL`.

## Аутентификация

### JWT-сессия

1. Зарегистрируйте пользователя (однократно):
   ```bash
   curl -X POST http://localhost:8000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com","password":"password123","name":"Demo"}'
   ```
2. Выполните вход и получите `accessToken` (используется для защищённых вызовов и создания API-ключей):
   ```bash
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"demo@example.com","password":"password123"}'
   ```
   Ответ содержит объект `user` и строку `accessToken`. Сохраните токен и cookie `clouddrive.refresh`, если планируете обновление сессии.

### API-ключ

API-ключ позволяет обращаться к файловому API без JWT и cookie. Ключ создаётся только после успешного входа в аккаунт.

#### Создание через UI

1. Авторизуйтесь на сайте.
2. Нажмите кнопку **API-ключи** в верхней панели.
3. Укажите название и нажмите «Создать». Скопируйте показанный ключ — он отображается только один раз.

#### Создание через REST

1. Получите `accessToken`, как описано выше.
2. Создайте ключ:
   ```bash
   curl -X POST http://localhost:8000/api/auth/api-keys \
     -H "Authorization: Bearer <ACCESS_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"label":"CI"}'
   ```
   Ответ:
   ```json
   {
     "key": "cld_XXXXXXXXXXXXXXXX",
     "apiKey": {
       "id": "ckey_...",
       "label": "CI",
       "createdAt": "2025-09-21T21:50:00.000Z",
       "lastUsedAt": null
     }
   }
   ```
3. Сохраните поле `key`. Для последующих запросов используйте один из заголовков:
   - `X-API-Key: cld_...`
   - `Authorization: ApiKey cld_...`

#### Управление ключами

- Список ключей: `GET /api/auth/api-keys`
- Удаление ключа: `DELETE /api/auth/api-keys/:id`

Оба запроса требуют JWT (`Authorization: Bearer ...`).

## Файловое API (MVP)

| Метод | Маршрут | Описание |
|-------|---------|----------|
| `GET` | `/api/drive/list` | Список файлов и папок. Параметры: `parentId`, `search`, `type`, `trashed`, `sort`, `order`. |
| `POST` | `/api/drive/folder` | Создание папки (`name`, `parentId?`). |
| `POST` | `/api/drive/file` | Множественная загрузка файлов. Поле формы: `files`. Дополнительно `parentId`. |
| `PATCH` | `/api/drive/:id` | Переименование (`name`) и/или перемещение (`parentId`). |
| `DELETE` | `/api/drive/:id` | Перемещение в корзину. Параметр `hard=true` для окончательного удаления. |
| `POST` | `/api/drive/:id/restore` | Восстановление элемента из корзины. |
| `GET` | `/api/drive/:id/download` | Скачивание файла. |
| `POST` | `/api/drive/archive` | Сборка ZIP по массиву `ids`. |

Для публичного доступа см. `/api/share/:id` и `/s/:token` (выдача JSON и скачивание без авторизации).

## Примеры `curl` с API-ключом

Предполагаем, что переменная окружения `API_KEY` содержит значение `cld_xxx`, полученное выше.

### Список корневых элементов
```bash
curl -H "X-API-Key: $API_KEY" \
  http://localhost:8000/api/drive/list
```

### Поиск по имени и фильтрация по типу
```bash
curl -G -H "X-API-Key: $API_KEY" \
  --data-urlencode "search=invoice" \
  --data-urlencode "type=FILE" \
  http://localhost:8000/api/drive/list
```

### Загрузка файла в указанную папку
```bash
curl -X POST http://localhost:8000/api/drive/file \
  -H "X-API-Key: $API_KEY" \
  -F "parentId=<FOLDER_ID>" \
  -F "files=@/path/to/report.pdf"
```
Ответ содержит массив `items` с `id`, `name`, `type`, `size` и др.

### Скачивание файла по ID
```bash
curl -H "X-API-Key: $API_KEY" \
  -L http://localhost:8000/api/drive/<FILE_ID>/download \
  -o downloaded-file
```

### Пакетное скачивание выбранных элементов (ZIP)
```bash
curl -X POST http://localhost:8000/api/drive/archive \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ids":["<FILE_ID>","<FOLDER_ID>"]}' \
  -o archive.zip
```

## Безопасность и ограничения

- Максимальный размер одного файла определяется `MAX_UPLOAD_MB` (по умолчанию 25 МБ).
- API-ключи хранятся в базе в виде SHA-256 хэшей. При утечке ключа отзовите его через `DELETE /api/auth/api-keys/:id`.
- На защищённых маршрутах действует rate limit (`RATE_LIMIT_MAX` запросов за 15 минут) и Helmet заголовки.
- Все запросы с API-ключом выполняются от имени владельца ключа: действия (загрузка, удаление, шаринг) попадают в историю активности.

## Сценарий автоматизации

1. Один раз создайте API-ключ для сервиса/скрипта CI.
2. В пайплайне используйте `curl` или любой HTTP-клиент, добавляя заголовок `X-API-Key`.
3. Для получения идентификаторов файлов читайте ответ `/api/drive/list` (вложенные папки доступны через передачу `parentId`).
4. Скачивание архивов для бэкапа реализуется через `/api/drive/archive`.

## Поддержка

- Описание фронтенда, запуска и окружения: см. [README.md](README.md).
- Вопросы и улучшения приветствуются через issues/PR.
