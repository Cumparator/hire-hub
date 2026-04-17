# Search Syntax

Умная строка поиска вдохновлена YouTrack и GitHub Code Search.
Поддерживает два режима: **простой текстовый** и **атрибутный**.

Документация-источники:
- https://www.jetbrains.com/help/youtrack/server/attribute-based-search.html
- https://docs.github.com/ru/search-github/github-code-search/understanding-github-code-search-syntax

---

## Примеры запросов

```
python fastapi                        # полнотекстовый — ищет в title и stack
remote:true python                    # удалёнка + python в названии/стеке
stack:Python,FastAPI                  # вакансии где есть ОБА технологии
salary:>80000                         # зарплата от 80k
experience:intern                     # стажировки
source:hh python                      # только с HH.ru
stack:React salary:>60000 remote:true # комбинирование атрибутов
```

---

## Атрибуты

| Атрибут      | Тип        | Значения / формат | Пример |
|--------------|------------|--------------------|--------|
| `remote`     | boolean    | `true`, `false`    | `remote:true` |
| `source`     | enum       | `hh`, `tg`, `habr` | `source:hh` |
| `experience` | enum       | `intern`, `no_experience`, `between1And3` | `experience:intern` |
| `stack`      | list       | Названия через запятую (AND) | `stack:Python,Django` |
| `salary`     | number+op  | `>N`, `<N`, `N-M` | `salary:>80000` |
| `location`   | string     | Город или `remote` | `location:Москва` |

---

## Грамматика (EBNF)

```
query       = term { WS term }
term        = attribute ":" value | freetext
attribute   = "remote" | "source" | "experience" | "stack" | "salary" | "location"
value       = bare_word | quoted_string | range
range       = ">" number | "<" number | number "-" number
list_value  = word { "," word }
freetext    = word          -- применяется к title и stack (fulltext search)
quoted_string = '"' .* '"'  -- для значений с пробелами: location:"Санкт-Петербург"
```

---

## Парсинг на фронтенде

`SearchBar` парсит строку в объект фильтров и передаёт их в `api/client.js`:

```js
// Пример результата парсинга "python salary:>80000 remote:true"
{
  freetext: "python",
  filters: {
    salaryFrom: 80000,
    remote: true
  }
}
```

Логика парсинга живёт в `frontend/src/utils/queryParser.js` (файл создать).
Тесты — рядом: `frontend/src/utils/queryParser.test.js`. (нафиг тесты)

---

## Приоритет реализации

1. **MVP**: простой текстовый поиск + remote, stack, experience — через кнопки
2. **Этап 2**: строка с атрибутным синтаксисом (поле + парсер)
3. **Этап 3**: автодополнение атрибутов при вводе `:`
