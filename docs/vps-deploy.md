# Развёртывание на VPS (по IP, без домена)

Этот проект можно развернуть на VPS без домена и без TLS-сертификата.

## Что делает эта схема

- раздаёт фронтенд через `nginx` на порту `80`
- проксирует запросы `/api/*` из `nginx` в backend
- держит `postgres` закрытым внутри Docker-сети
- держит backend закрытым внутри Docker-сети

Снаружи доступен только фронтенд-контейнер.

## Что нужно заранее

1. VPS на Ubuntu.
2. Открытые входящие порты `22` и `80`.
3. Установленные Docker Engine и Docker Compose plugin.
4. Репозиторий, который будет лежать в отдельной директории, например `/srv/hire-hub`.

## Отдельное место для проекта

Создай отдельного Unix-пользователя для деплоя и держи проект под ним:

```bash
sudo adduser deployer
sudo mkdir -p /srv/hire-hub
sudo chown -R deployer:deployer /srv/hire-hub
```

Важно: если добавить пользователя в группу `docker`, это по сути почти root-доступ на сервере. Если команде нельзя давать такой уровень доступа, не давай им shell-доступ с правами на Docker. Безопасный базовый вариант такой:

- один deploy-пользователь владеет стеком
- остальная команда получает только URL приложения
- деплой делает тот, у кого есть доступ к VPS

## Подготовка сервера

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deployer
```

После этого переподключись уже под `deployer`.

## Подготовка проекта

```bash
cd /srv/hire-hub
git clone <URL_ТВОЕГО_РЕПО> .
cp .env.prod.example .env.prod
nano .env.prod
```

Минимум нужно задать:

```env
POSTGRES_PASSWORD=твой_надёжный_пароль
HH_TOKEN=твой_hh_token
PUBLIC_ORIGIN=http://IP_ТВОЕГО_СЕРВЕРА
FRONTEND_PORT=80
```

## Запуск стека

Перед новым запуском всегда сначала опускай старый стек:

```bash
cd /srv/hire-hub
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

Проверка состояния:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f frontend
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f backend
```

Открывать в браузере:

```text
http://IP_ТВОЕГО_СЕРВЕРА
```

## Обновление после изменений в коде

```bash
cd /srv/hire-hub
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml down
docker compose --env-file .env.prod -f docker-compose.prod.yml up --build -d
```

## Как аккуратно всё свернуть

Остановить контейнеры, но оставить данные базы:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

Остановить контейнеры и удалить данные базы тоже:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v
```

Полностью удалить проект с VPS:

```bash
cd /srv
rm -rf /srv/hire-hub
```

Последнюю команду используй только если действительно хочешь снести проектовые файлы с сервера.
