# GRACE-Style Code Annotation System

## Overview

**GRACE-style** (Graph-Ready Annotated Code Entities) — это наш подход к аннотированию кода для улучшения навигации, понимания и поддержки кодовых баз AI-моделями и разработчиками.

Этот подход предоставляет стандартизированный способ документирования:
- Структуры кода через XML-подобные теги
- Контрактов на всех уровнях (модуль, класс, метод)
- Взаимоотношений между сущностями
- Потоков данных через систему

> **Примечание**: Это наша собственная интерпретация принципов аннотирования кода. Мы не аффилированы с оригинальным GRACE Framework и не претендуем на строгое следование каким-либо внешним спецификациям.

---

## Component 1: XML-like Tagging System

### Format

```typescript
// <SECTION_NAME_START>
// ... code ...
// <SECTION_NAME_END>
```

### Purpose

1. **Navigation**: Быстрая локализация секций кода AI-моделями
2. **Context**: Четкие границы функциональных единиц
3. **Maintainability**: Изолированные модификации без влияния на другие части
4. **Understanding**: Помощь AI в понимании структуры кода

### Tag Categories

- `IMPORTS_START/END` - Импорты модуля
- `INTERFACE_DEFINITIONS_START/END` - Определения интерфейсов
- `CLASS_NAME_START/END` - Определения классов
- `METHOD_CATEGORY_START/END` - Группы методов
- `SETTINGS_SECTION_START/END` - Управление настройками
- `UI_COMPONENT_START/END` - UI компоненты
- `MODULE_START/END` - Границы модуля/файла

---

## Component 2: Contract System

### Contract Levels

#### Level 1: Module Contracts

Рекомендуется иметь контракт на уровне файла в начале файла:

```typescript
/* Module Contract: [responsibility] --> [provided functionality] --> [consumers] */
```

**Пример:**
```typescript
/* Module Contract: Manage RAG operations for note indexing and retrieval --> Provide embedding, indexing, and semantic search capabilities --> Used by main plugin, backlink generator, chat modal */
```

#### Level 2: Class Contracts

Рекомендуется иметь контракт перед объявлением класса:

```typescript
/* Class Contract: [purpose] --> [key responsibilities] --> [provided services] */
```

**Пример:**
```typescript
/* Class Contract: Orchestrate RAG functionality --> Manage vector store, embeddings, and persistent storage --> Enable semantic search across vault notes */
export class RAGManager { ... }
```

#### Level 3: Method Contracts

Рекомендуется иметь контракт для публичных методов:

```typescript
/* Method Contract: [use-case] --> [actions] --> [expected results] */
```

**Пример:**
```typescript
/* Method Contract: Index all notes in vault --> Process markdown files and generate embeddings --> Notes become searchable via RAG functionality */
async indexNotes() { ... }
```

### Contract Format

Все контракты следуют формату:

```
[input/context] --> [processing/actions] --> [output/outcome]
```

Где:
- **input/context**: Что получает функция/класс/модуль на вход или в каком контексте работает
- **processing/actions**: Что происходит внутри (основные действия)
- **output/outcome**: Что возвращается или какой результат достигается

---

## Component 3: Entity Relationship Documentation

Рекомендуется документировать зависимости файлов:

### Imports Section
```typescript
// Dependencies:
// - module1.ts: ExportedEntity1, ExportedEntity2
// - module2.ts: ExportedEntity3
```

### Exports Section
```typescript
// Provides:
// - ExportedClass: Description of what it provides
// - ExportedInterface: Description of contract
```

### Relationships
```typescript
// Used by:
// - main.ts: OLocalLLMPlugin uses this class for X
// - other.ts: Function Y imports this
```

---

## Component 4: Complete File Example

```typescript
// <AUTO_TAGGER_MODULE_START>
/* Module Contract: Generate hashtags for selected text --> Process text through LLM and extract hashtags --> Append formatted hashtags to note */

import { App, Editor, MarkdownView, Notice } from "obsidian";
import { OLocalLLMSettings } from "../main";

// <GENERATE_TAGS_FUNCTION_START>
/* Method Contract: Generate and append hashtags to note --> Get selected text, call LLM, format response --> Hashtags appended to current note */
export async function generateAndAppendTags(app: App, settings: OLocalLLMSettings) {
    // Implementation
}
// <GENERATE_TAGS_FUNCTION_END>

// <TAG_GENERATION_HELPER_START>
/* Method Contract: Call LLM to generate tags --> Send text to LLM with hashtag prompt --> Return array of hashtag strings */
async function generateTags(text: string, settings: OLocalLLMSettings): Promise<string[]> {
    // Implementation
}
// <TAG_GENERATION_HELPER_END>
// <AUTO_TAGGER_MODULE_END>
```

---

## Component 5: Guidelines

### Recommended Practices for Source Files

1. **Module Tag**: Желательно иметь открывающий и закрывающий тег модуля
2. **Module Contract**: Контракт на уровне модуля в начале файла
3. **Class Contracts**: Классы должны иметь контракты
4. **Method Contracts**: Публичные методы должны иметь контракты
5. **Import/Export Documentation**: Зависимости должны быть задокументированы

### Verification Checklist

- [ ] Файл имеет `<MODULE_NAME_START>` и `<MODULE_NAME_END>` теги
- [ ] Файл имеет `/* Module Contract: ... */` комментарий
- [ ] Все классы имеют `/* Class Contract: ... */` комментарий
- [ ] Все публичные методы имеют `/* Method Contract: ... */` комментарий
- [ ] Импорты задокументированы с указанием источника
- [ ] Экспорты задокументированы с указанием назначения

---

## Benefits

### For AI Models
- Быстрая навигация по кодовой базе
- Понимание предназначения каждой сущности
- Ясные контракты для генерации кода
- Граф зависимостей для контекста

### For Developers
- Самодокументирующийся код
- Легкая поддержка и модификация
- Ясные ожидания от каждой функции
- Быстрый онбординг в проект

---

**Project**: Obsidian Local LLM Helper
