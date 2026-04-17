# API Contracts

Base URL: `/api`

---

## GET /api/jobs

Возвращает список вакансий с фильтрацией и пагинацией.

### Query-параметры

| Параметр   | Тип     | Обязательный | Описание |
|------------|---------|--------------|----------|
| `q`        | string  | нет          | Полнотекстовый / умный поиск (см. search-syntax.md) |
| `source`   | string  | нет          | `hh`, `tg`, `superjob`, `habr` (можно несколько через запятую) |
| `remote`   | boolean | нет          | `true` — только удалёнка |
| `experience`| string | нет          | `intern`, `no_experience`, `between1And3` |
| `stack`    | string  | нет          | `Python,FastAPI` — AND-логика |
| `salary_from`| number| нет          | Минимальная зарплата (руб.) |
| `page`     | number  | нет          | Номер страницы, default `1` |
| `per_page` | number  | нет          | Размер страницы, default `20`, max `50` |

### Ответ `200 OK`

```json
{
  "jobs": [
    {
      "id": "uuid",
      "source": "hh",
      "url": "https://hh.ru/vacancy/98765432",
      "title": "Junior Python Developer",
      "company": "Acme Corp",
      "salaryMin": 80000,
      "salaryMax": 120000,
      "salaryCurrency": "RUB",
      "location": "Москва",
      "remote": true,
      "experience": "no_experience",
      "employment": "full",
      "stack": ["Python", "FastAPI", "PostgreSQL"],
      "publishedAt": "2024-12-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "perPage": 20,
    "total": 134,
    "totalPages": 7
  }
}
```

### Ошибки

| Код | Описание |
|-----|----------|
| `400` | Неверные параметры фильтра |
| `500` | Внутренняя ошибка |

---

## GET /api/jobs/:id

Возвращает одну вакансию по ID.

### Ответ `200 OK`

Объект `Job` (полный, включая поле `description`).

### Ошибки

| Код | Описание |
|-----|----------|
| `404` | Вакансия не найдена |

---

## POST /api/favorites

Добавляет вакансию в избранное текущего пользователя.

### Заголовки

```
X-User-Id: <uuid>    # временная авторизация для MVP (без JWT)
```

### Тело запроса

```json
{ "jobId": "uuid" }
```

### Ответ `201 Created`

```json
{ "favoriteId": "uuid" }
```

### Ошибки

| Код | Описание |
|-----|----------|
| `400` | `jobId` не передан |
| `404` | Вакансия не найдена |
| `409` | Уже в избранном |

---

## GET /api/favorites

Возвращает список вакансий в избранном текущего пользователя.

### Заголовки

```
X-User-Id: <uuid>
```

### Ответ `200 OK`

```json
{
  "jobs": [ /* массив объектов Job */ ]
}
```

---

## DELETE /api/favorites/:jobId

Удаляет вакансию из избранного.

### Заголовки

```
X-User-Id: <uuid>
```

### Ответ `204 No Content`

---

## Замечания для команды

- **Авторизация в MVP**: передаём `X-User-Id` в заголовке напрямую. Перед публичным релизом заменить на JWT.
- **CORS**: бэкенд должен разрешать запросы с `http://localhost:3000` (dev) и продовского домена.
- **Формат ошибок** всегда:

  ```json
  { "error": "human-readable message", "code": "MACHINE_CODE" }
  ```
