# Finance Tracker

Личный финансовый трекер для телефона. Статика на GitHub Pages, данные в Supabase.
Валюта — тенге, интерфейс русский.

Приложение работает в двух режимах и переключается само:

- **Локальный** — переменные Supabase не заданы. Записи лежат в IndexedDB
  этого браузера. Ничего настраивать не нужно, открыл и пользуешься.
- **Облачный** — переменные заданы. Вход через Google, данные в Postgres,
  доступны с любого устройства. Сессия хранится и обновляется сама, поэтому
  логин нужен один раз.

## Запуск

```bash
npm install
npm run dev
```

Чтобы открыть с телефона в одной сети: `npm run dev -- --host`, затем адрес
вида `http://192.168.x.x:5173/finance-tracker/`.

```bash
npm run build     # сборка + dist/404.html для роутинга на Pages
npm run test      # проверки доменной логики
npm run preview   # локальный просмотр собранной версии
```

## Публикация на GitHub Pages

1. Создать репозиторий с именем **`finance-tracker`** — от него зависит
   `base` в [vite.config.ts](vite.config.ts). При другом имени поменять
   константу `BASE` там же.
2. Запушить ветку `main`.
3. Settings → Pages → Source → **GitHub Actions**.
4. Готово: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
   собирает и публикует при каждом пуше.

Адрес будет `https://<username>.github.io/finance-tracker/`.

## Подключение Supabase

Пока не сделано — приложение работает локально. Когда понадобится синхронизация:

1. Создать проект на [supabase.com](https://supabase.com).
2. SQL Editor → выполнить [supabase/schema.sql](supabase/schema.sql).
   Скрипт создаёт таблицы, индексы и политики Row Level Security.
3. Authentication → Providers → Google: включить, вставить Client ID и Secret
   из Google Cloud Console. В Google Cloud в Authorized redirect URIs указать
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Authentication → URL Configuration:
   - Site URL: `https://<username>.github.io/finance-tracker/`
   - Redirect URLs: туда же плюс `http://localhost:5173/finance-tracker/`
5. GitHub → Settings → Secrets and variables → Actions, добавить
   `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
6. Для локальной разработки скопировать `.env.example` в `.env` и заполнить.

`anon key` попадает в собранный бандл и виден любому — так и задумано.
Данные защищает RLS: каждая политика пропускает только строки текущего
пользователя.

## Как устроено

```
src/
  data/       слой хранения: один интерфейс, два адаптера
    repo.ts         контракт
    localRepo.ts    IndexedDB
    supabaseRepo.ts Postgres
    store.tsx       состояние и мутации, оптимистичные обновления
  lib/        доменная логика без React
    types.ts, format.ts, analytics.ts, recurring.ts, seed.ts, icons.tsx
  components/ примитивы интерфейса
  screens/    экраны
```

Экраны не знают, какой адаптер активен, поэтому переход с памяти устройства
на облако не затрагивает ничего выше `src/data`.

Несколько решений, которые стоит знать:

- **Суммы — целые тенге.** Тиын не в обороте, дробная часть только мешала бы.
- **Знак хранится отдельно от суммы.** `amount` всегда положительный,
  направление задаёт `kind`. Агрегаты считаются без разбора минусов.
- **Регулярные платежи создаются при открытии приложения**, сразу за все
  пропущенные даты. Это дешевле, чем `pg_cron` с Edge Function, ценой того,
  что операция появляется при заходе, а не ровно в полночь.
- **Даты операций — местный календарный день.** На UTC+5 вечерняя трата иначе
  уезжала бы на вчера.

## Оформление

Токены в [src/index.css](src/index.css): светлая палитра в `:root`, тёмная
переопределяет только значения. Компоненты обращаются к именам токенов, а не
к цветам напрямую, поэтому обе темы меняются в одном месте. Тема следует за
системой; переключатель в разделе «Ещё».
