# Развёртывание стенда на VPS

Документ описывает порядок поднятия, обновления и остановки временного стенда `Hire Hub` на VPS по IP-адресу, без домена и без TLS.

## Назначение стенда

- предоставить команде общий доступ к приложению по IP-адресу
- изолировать окружение от локальных машин разработчиков
- дать возможность быстро поднять и так же быстро полностью свернуть стенд после тестирования

## Состав стенда

- `frontend` — статическая сборка, раздаётся через `nginx`
- `backend` — Node.js API
- `db` — PostgreSQL

Снаружи публикуется только порт фронтенда. База данных и backend остаются внутри Docker-сети.

## Размещение на сервере

Проект разворачивается в отдельной директории:

```bash
/srv/hire-hub
```

Рекомендуемая модель доступа:

- отдельный системный пользователь `deployer`
- проектовые файлы принадлежат `deployer`
- Docker-команды выполняются только от имени `deployer`

Важно: доступ к Docker на сервере по сути эквивалентен расширенным системным правам. Команде не следует выдавать shell-доступ с правом управлять Docker, если это не требуется организационно.

## Подготовка сервера

Требования:

- Ubuntu VPS
- открытые входящие порты `22` и `80`
- установленный Docker Engine
- установленный Docker Compose plugin

Пример базовой подготовки:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo adduser deployer
sudo mkdir -p /srv/hire-hub
sudo chown -R deployer:deployer /srv/hire-hub
sudo usermod -aG docker deployer
```

После этого работа со стендом ведётся под пользователем `deployer`.

## Подготовка проекта

```bash
cd /srv/hire-hub
git clone <URL_РЕПОЗИТОРИЯ> .
cp .env.prod.example .env.prod
```

Файл `.env.prod` должен быть заполнен как минимум следующими значениями:

```env
POSTGRES_PASSWORD=надёжный_пароль
HH_TOKEN=токен_hh
PUBLIC_ORIGIN=http://IP_СЕРВЕРА
FRONTEND_PORT=80
```

## Первый запуск

Для запуска используется отдельный production-compose файл:

```bash
cd /srv/hire-hub
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

Проверка состояния:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 backend
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 frontend
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 db
```

После успешного старта приложение доступно по адресу:

```text
http://IP_СЕРВЕРА
```

## Обновление стенда

После изменений в коде используется полный пересбор:

```bash
cd /srv/hire-hub
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

Такой порядок обязателен для текущего окружения, чтобы избежать конфликтов со старыми контейнерами.

## Диагностика

Проверка контейнеров:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
```

Просмотр логов backend:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 backend
```

Просмотр логов frontend:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 frontend
```

Просмотр логов базы:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=100 db
```

## Остановка стенда

Остановить контейнеры, сохранив данные PostgreSQL:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

Остановить контейнеры и удалить volume базы данных:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
```

## Полное удаление стенда

Если стенд больше не нужен:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
cd /srv
rm -rf /srv/hire-hub
```

Эта операция удаляет контейнеры, volume базы данных и файлы проекта с VPS.
