# Project Dependency Graph - Obsidian Local LLM Helper

## Executive Summary

Этот документ описывает полную архитектуру проекта Obsidian Local LLM Helper в виде графа зависимостей между всеми сущностями: модулями, классами, интерфейсами и функциями.

**Версия проекта**: 2.3.3  
**Тип**: Obsidian Plugin (TypeScript)  
**Архитектурный стиль**: Plugin-based с модульной структурой

---

## Module Dependency Matrix

| Module | Path | Imports From | Exports To | External Dependencies |
|--------|------|--------------|------------|----------------------|
| **main.ts** | `/main.ts` | autoTagger, rag, backlinkGenerator, ragChatModal, updateNoticeModal, promptPickerModal | OLocalLLMSettings, OLocalLLMPlugin | Obsidian API, LangChain |
| **rag.ts** | `/src/rag.ts` | ollamaEmbeddings, openAIEmbeddings, main.ts | RAGManager | LangChain (MemoryVectorStore, Document) |
| **ollamaEmbeddings.ts** | `/src/ollamaEmbeddings.ts` | obsidian (requestUrl) | OllamaEmbeddings | Obsidian API |
| **openAIEmbeddings.ts** | `/src/openAIEmbeddings.ts` | @langchain/openai | OpenAIEmbeddings | @langchain/openai |
| **backlinkGenerator.ts** | `/src/backlinkGenerator.ts` | rag.ts, obsidian | BacklinkGenerator | Obsidian API (TFile, Vault) |
| **ragChatModal.ts** | `/src/ragChatModal.ts` | main.ts, rag.ts, obsidian | RAGChatModal | Obsidian API (Modal) |
| **autoTagger.ts** | `/src/autoTagger.ts` | main.ts, obsidian | generateAndAppendTags() | Obsidian API |
| **promptPickerModal.ts** | `/src/promptPickerModal.ts` | obsidian | PromptPickerModal | Obsidian API (Modal) |
| **updateNoticeModal.ts** | `/src/updateNoticeModal.ts` | obsidian | UpdateNoticeModal | Obsidian API (Modal) |

---

## Central Entities Graph

### 1. OLocalLLMPlugin (main.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                    OLocalLLMPlugin                              │
│                    (Main Plugin Class)                          │
├─────────────────────────────────────────────────────────────────┤
│ Наследует: Plugin (Obsidian)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Содержит (Composition):                                         │
│   • ragManager: RAGManager                                      │
│   • backlinkGenerator: BacklinkGenerator                        │
│   • commandRegistry: Map<string, Command>                       │
│   • settings: OLocalLLMSettings                                 │
│   • conversationHistory: ConversationEntry[]                    │
├─────────────────────────────────────────────────────────────────┤
│ Использует (Dependencies):                                      │
│   • OLLMSettingTab (наследует PluginSettingTab)                 │
│   • LLMChatModal (наследует Modal)                              │
│   • RAGChatModal (наследует Modal)                              │
│   • UpdateNoticeModal (наследует Modal)                         │
│   • PromptPickerModal (наследует Modal)                         │
│   • SelectPromptModal (наследует Modal)                         │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • onload() → Инициализация плагина                            │
│   • loadSettings() → Загрузка настроек                          │
│   • saveSettings() → Сохранение настроек                        │
│   • indexNotes() → Индексация заметок                           │
│   • handleGenerateBacklinks() → Генерация бэклинков             │
│   • handleDiagnostics() → Диагностика RAG                       │
│   • registerPromptCommand() → Регистрация промптов              │
│   • processCustomPromptText() → Обработка промптов              │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    [obsidian]          [Other Modules]      [User Actions]
    - Plugin            - autoTagger         - Commands
    - PluginSettingTab  - backlinkGenerator  - Ribbon Menu
    - Modal             - ragChatModal       - Settings UI
```

**Взаимоотношения:**
- **Создает**: `new RAGManager()`, `new BacklinkGenerator()`, `new OLLMSettingTab()`
- **Вызывает**: `generateAndAppendTags()`, `new LLMChatModal()`, `new RAGChatModal()`
- **Наследует**: `Plugin` от Obsidian API

---

### 2. RAGManager (src/rag.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                      RAGManager                                 │
│              (Retrieval Augmented Generation)                   │
├─────────────────────────────────────────────────────────────────┤
│ Module Contract: Manage RAG operations for note indexing and    │
│ retrieval --> Provide embedding, indexing, and semantic search  │
│ --> Used by main plugin, backlink generator, chat modal         │
├─────────────────────────────────────────────────────────────────┤
│ Содержит (Composition):                                         │
│   • vectorStore: MemoryVectorStore (LangChain)                  │
│   • embeddings: OllamaEmbeddings | OpenAIEmbeddings             │
│   • indexedFiles: string[]                                      │
│   • vault: Vault (Obsidian)                                     │
│   • settings: OLocalLLMSettings                                 │
├─────────────────────────────────────────────────────────────────┤
│ Зависит от:                                                     │
│   • OllamaEmbeddings (src/ollamaEmbeddings.ts)                  │
│   • OpenAIEmbeddings (src/openAIEmbeddings.ts)                  │
│   • OLocalLLMSettings (main.ts)                                 │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • OLocalLLMPlugin (main.ts)                                   │
│   • BacklinkGenerator (src/backlinkGenerator.ts)                │
│   • RAGChatModal (src/ragChatModal.ts)                          │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • initialize() → Инициализация с загрузкой эмбеддингов        │
│   • indexNotes() → Индексация всех заметок                      │
│   • getRAGResponse() → Получение ответа через RAG               │
│   • findSimilarNotes() → Поиск похожих заметок                  │
│   • saveEmbeddings() → Сохранение в embeddings.json             │
│   • loadEmbeddings() → Загрузка из embeddings.json              │
│   • getStorageStats() → Статистика хранилища                    │
│   • clearStoredEmbeddings() → Очистка хранилища                 │
└─────────────────────────────────────────────────────────────────┘
```

**Поток данных при индексации:**
```
OLocalLLMPlugin.indexNotes()
    ↓
RAGManager.indexNotes()
    ↓
RAGManager.processFiles()
    ↓
[Для каждого файла]
    ├→ Vault.cachedRead(file)
    ├→ splitIntoChunks(content)
    └→ vectorStore.addDocuments([doc])
        ↓
    OllamaEmbeddings.embedDocuments()
        ↓
    MemoryVectorStore (in-memory)
        ↓
RAGManager.saveEmbeddings()
    ↓
filesystem (embeddings.json)
```

---

### 3. OllamaEmbeddings (src/ollamaEmbeddings.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                    OllamaEmbeddings                             │
│              (Ollama Embedding Provider)                        │
├─────────────────────────────────────────────────────────────────┤
│ Module Contract: Provide Ollama embedding capabilities -->      │
│ Call Ollama API to generate embeddings --> Used by RAGManager   │
├─────────────────────────────────────────────────────────────────┤
│ Содержит:                                                       │
│   • baseUrl: string (Ollama server URL)                         │
│   • model: string (Embedding model name)                        │
├─────────────────────────────────────────────────────────────────┤
│ Использует:                                                     │
│   • requestUrl (Obsidian API)                                   │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • RAGManager (src/rag.ts)                                     │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • embedDocuments(docs: string[]) → number[][]                 │
│   • embedQuery(text: string) → number[]                         │
│   • checkModelAvailability() → boolean                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. OpenAIEmbeddings (src/openAIEmbeddings.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                   OpenAIEmbeddings                              │
│           (OpenAI/LM Studio Embedding Provider)                 │
├─────────────────────────────────────────────────────────────────┤
│ Module Contract: Provide OpenAI-compatible embedding -->        │
│ Extend LangChain OpenAIEmbeddings --> Used by RAGManager        │
├─────────────────────────────────────────────────────────────────┤
│ Наследует: OpenAIEmbeddings (@langchain/openai)                 │
├─────────────────────────────────────────────────────────────────┤
│ Содержит:                                                       │
│   • openAIApiKey: string (default: "lm-studio")                 │
│   • modelName: string                                           │
│   • baseURL: string (default: http://127.0.0.1:1234)            │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • RAGManager (src/rag.ts)                                     │
├─────────────────────────────────────────────────────────────────┤
│ Методы (переопределенные):                                      │
│   • embedDocuments(docs: string[]) → number[][]                 │
│   • embedQuery(text: string) → number[]                         │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. BacklinkGenerator (src/backlinkGenerator.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                   BacklinkGenerator                             │
│            (Generate Backlinks using RAG)                       │
├─────────────────────────────────────────────────────────────────┤
│ Module Contract: Generate backlinks for selected text -->       │
│ Use RAG to find similar notes --> Return backlink list          │
├─────────────────────────────────────────────────────────────────┤
│ Содержит (Composition):                                         │
│   • ragManager: RAGManager                                      │
│   • vault: Vault (Obsidian)                                     │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • OLocalLLMPlugin (main.ts)                                   │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • generateBacklinks(selectedText: string) → string[]          │
└─────────────────────────────────────────────────────────────────┘
```

**Поток генерации бэклинков:**
```
OLocalLLMPlugin.handleGenerateBacklinks()
    ↓
BacklinkGenerator.generateBacklinks(selectedText)
    ↓
RAGManager.findSimilarNotes(selectedText)
    ↓
MemoryVectorStore.similaritySearch(query, 5)
    ↓
[Для каждого результата]
    ├→ Extract file path from [[filepath]]
    ├→ Vault.getAbstractFileByPath(path)
    └→ Create backlink [[filename|basename]]
    ↓
Return string[] of backlinks
```

---

### 6. RAGChatModal (src/ragChatModal.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                      RAGChatModal                               │
│           (Chat Interface for RAG Queries)                      │
├─────────────────────────────────────────────────────────────────┤
│ Module Contract: Provide chat UI for RAG queries -->            │
│ Display chat history and submit queries --> Show RAG responses  │
├─────────────────────────────────────────────────────────────────┤
│ Наследует: Modal (Obsidian)                                     │
├─────────────────────────────────────────────────────────────────┤
│ Содержит (Composition):                                         │
│   • pluginSettings: OLocalLLMSettings                           │
│   • ragManager: RAGManager                                      │
│   • conversationHistory: {prompt, response}[]                   │
│   • submitButton: ButtonComponent                               │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • OLocalLLMPlugin (main.ts)                                   │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • onOpen() → Инициализация UI                                 │
│   • handleSubmit() → Обработка запроса                          │
│   • showThinkingIndicator() → Показ индикатора                  │
│   • scrollToBottom() → Прокрутка к новому                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7. OLLMSettingTab (main.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                     OLLMSettingTab                              │
│            (Settings UI for Plugin Configuration)               │
├─────────────────────────────────────────────────────────────────┤
│ Module Contract: Manage plugin settings UI --> Render all       │
│ configurable options --> Allow user configuration               │
├─────────────────────────────────────────────────────────────────┤
│ Наследует: PluginSettingTab (Obsidian)                          │
├─────────────────────────────────────────────────────────────────┤
│ Содержит:                                                       │
│   • plugin: OLocalLLMPlugin                                     │
│   • indexingProgressBar: HTMLProgressElement                    │
│   • indexedFilesCountSetting: Setting                           │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • OLocalLLMPlugin (регистрирует через addSettingTab)          │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • display() → Отрисовка настроек                              │
│   • hide() → Сохранение при закрытии                            │
│   • debouncedSave() → Отложенное сохранение                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8. LLMChatModal (main.ts)

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLMChatModal                               │
│         (General Chat Interface with Personas)                  │
├─────────────────────────────────────────────────────────────────┤
│ Наследует: Modal (Obsidian)                                     │
├─────────────────────────────────────────────────────────────────┤
│ Содержит:                                                       │
│   • pluginSettings: OLocalLLMSettings                           │
│   • conversationHistory: ConversationEntry[]                    │
│   • textInput: TextComponent                                    │
│   • submitButton: ButtonComponent                               │
├─────────────────────────────────────────────────────────────────┤
│ Используется:                                                   │
│   • OLocalLLMPlugin (main.ts)                                   │
├─────────────────────────────────────────────────────────────────┤
│ Методы:                                                         │
│   • onOpen() → Инициализация UI                                 │
│   • handleSubmit() → Отправка сообщения                         │
│   • streamResponse() → Потоковый вывод ответа                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interface Contracts

### OLocalLLMSettings (main.ts)

```typescript
/* Interface Contract: Define all plugin configuration parameters --> 
   Specify types for server, model, RAG, search settings --> 
   Used by all modules for consistent configuration access */
```

**Ключевые поля:**
- `serverAddress: string` - URL LLM сервера
- `llmModel: string` - Модель для генерации
- `providerType: 'ollama' | 'openai'` - Провайдер
- `embeddingModelName: string` - Модель для эмбеддингов
- `searchEngine: string` - Поисковый движок
- `customPrompts?: CustomPrompt[]` - Пользовательские промпты
- `personas: string` - Выбранная персона

### CustomPrompt (main.ts)

```typescript
/* Interface Contract: Define structure for user-defined prompts --> 
   Include id, title, prompt, systemPrompt, timestamps --> 
   Used for dynamic command registration */
```

### Persona (main.ts)

```typescript
/* Interface Contract: Define AI persona structure --> 
   Include displayName and systemPrompt --> 
   Used to customize LLM response style */
```

### ConversationEntry (main.ts)

```typescript
/* Interface Contract: Define chat history entry --> 
   Store prompt/response pairs --> 
   Used for conversation context */
```

---

## External Dependencies Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    Obsidian API                                 │
├─────────────────────────────────────────────────────────────────┤
│ Plugin ─────────────────────→ OLocalLLMPlugin                   │
│ PluginSettingTab ──────────→ OLLMSettingTab                     │
│ Modal ─────────────────────→ RAGChatModal, LLMChatModal,        │
│                              UpdateNoticeModal, PromptPickerModal
│ TFile, Vault ──────────────→ RAGManager, BacklinkGenerator      │
│ Editor, MarkdownView ──────→ Text processing commands           │
│ Notice ────────────────────→ User notifications                 │
│ Setting ───────────────────→ Settings UI                        │
│ requestUrl ────────────────→ OllamaEmbeddings, autoTagger       │
│ setIcon ───────────────────→ UI icons                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    LangChain                                    │
├─────────────────────────────────────────────────────────────────┤
│ MemoryVectorStore ─────────→ RAGManager                         │
│ Document ──────────────────→ RAGManager                         │
│ @langchain/ollama ─────────→ rag.ts (LLM for RAG)               │
│ @langchain/openai ─────────→ rag.ts, OpenAIEmbeddings           │
│ createRetrievalChain ──────→ RAGManager.getRAGResponse()        │
│ createStuffDocumentsChain → RAGManager.getRAGResponse()         │
│ PromptTemplate ────────────→ RAGManager.getRAGResponse()        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Other Dependencies                           │
├─────────────────────────────────────────────────────────────────┤
│ axios ─────────────────────→ HTTP requests (alternative)        │
│ fs-extra ──────────────────→ package_plugin.js                  │
│ esbuild ───────────────────→ Build process                      │
│ typescript ────────────────→ Type checking                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Flow 1: Plugin Initialization

```
User enables plugin in Obsidian
    ↓
Obsidian calls OLocalLLMPlugin.onload()
    ↓
├─→ loadSettings() → loadData() from data.json
├─→ checkForUpdates() → Compare versions
├─→ validateServerConfiguration()
├─→ new RAGManager(vault, settings, plugin)
│       └─→ Initialize embeddings provider
├─→ ragManager.initialize()
│       └─→ loadEmbeddings() from embeddings.json
├─→ new BacklinkGenerator(ragManager, vault)
├─→ registerAllCommands()
│   ├─→ generate-rag-backlinks
│   ├─→ rag-diagnostics
│   ├─→ rag-chat
│   ├─→ custom-prompt commands
│   ├─→ llm-chat
│   ├─→ web-search
│   └─→ cancel-prompt-invocation
└─→ addRibbonIcon("brain-cog") → Context menu
    ↓
Plugin ready (shown in status bar)
```

### Flow 2: Note Indexing (RAG)

```
User triggers "Index notes for RAG" command
    ↓
OLocalLLMPlugin.indexNotes()
    ↓
RAGManager.indexNotes(progressCallback)
    ↓
├─→ initialize() (if not already)
├─→ waitForVaultReady()
├─→ vault.getFiles().filter(md files)
└─→ processFiles(files, progressCallback)
    │
    └─→ [For each file]
        ├─→ vault.cachedRead(file)
        ├─→ splitIntoChunks(content, 1000)
        └─→ [For each chunk]
            ├─→ new Document(pageContent, metadata)
            └─→ vectorStore.addDocuments([doc])
                ↓
            OllamaEmbeddings.embedDocuments()
                ↓
            POST /api/embeddings → Ollama server
                ↓
            MemoryVectorStore.memoryVectors.push()
    ↓
saveEmbeddings()
    ↓
Write embeddings.json to plugin directory
    ↓
Show "Indexing complete" Notice
```

### Flow 3: RAG Chat Query

```
User opens "Chat with your notes (RAG)"
    ↓
new RAGChatModal(app, settings, ragManager).open()
    ↓
User types query and clicks Submit
    ↓
RAGChatModal.handleSubmit()
    ↓
├─→ Show user message in chat history
├─→ showThinkingIndicator()
└─→ ragManager.getRAGResponse(query)
    │
    ├─→ vectorStore.similaritySearch(query, 4)
    │   └─→ embedQuery(query) → Get query embedding
    │   └─→ Cosine similarity with stored embeddings
    │   └─→ Return top 4 documents
    │
    ├─→ Create LLM (Ollama or OpenAI)
    ├─→ createRetrievalChain(llm, retriever)
    └─→ chain.invoke({ input: query })
        └─→ LLM generates answer from context
    ↓
Hide thinking indicator
    ↓
Show response with sources in chat
    ↓
Add copy button for response
```

### Flow 4: Backlink Generation

```
User selects text and triggers "Generate RAG Backlinks"
    ↓
OLocalLLMPlugin.handleGenerateBacklinks()
    ↓
BacklinkGenerator.generateBacklinks(selectedText)
    ↓
RAGManager.findSimilarNotes(selectedText)
    ↓
vectorStore.similaritySearch(selectedText, 5)
    ↓
[For each similar document]
    ├─→ Extract file path from metadata.source
    ├─→ vault.getAbstractFileByPath(path)
    ├─→ If TFile: create [[path|basename]]
    └─→ Add to backlinks array
    ↓
Insert backlinks at cursor position in editor
    ↓
Show "Backlinks generated" Notice
```

### Flow 5: Custom Prompt Execution

```
User selects text and triggers custom prompt command
    ↓
OLocalLLMPlugin.processCustomPromptText()
    ↓
├─→ Get system prompt (from persona or custom)
├─→ Build messages array [system, user]
└─→ Call LLM API
    │
    ├─→ POST /v1/chat/completions
    ├─→ Body: { model, messages, temperature, max_tokens }
    └─→ Stream or wait for response
    ↓
If streaming:
    └─→ Process chunks as they arrive
Else:
    └─→ Get complete response
    ↓
If outputMode === "replace":
    └─→ editor.replaceSelection(response)
Else (append):
    └─→ editor.replaceSelection(selectedText + response)
```

---

## Call Hierarchy Examples

### Example 1: onload() Call Stack

```
Obsidian Framework
    └─→ OLocalLLMPlugin.onload()
        ├─→ OLocalLLMPlugin.loadSettings()
        │   └─→ Plugin.loadData() [Obsidian]
        ├─→ OLocalLLMPlugin.checkForUpdates()
        │   └─→ new UpdateNoticeModal().open()
        ├─→ OLocalLLMPlugin.validateServerConfiguration()
        ├─→ new RAGManager()
        │   └─→ new OllamaEmbeddings() or new OpenAIEmbeddings()
        ├─→ RAGManager.initialize()
        │   └─→ RAGManager.loadEmbeddings()
        │       └─→ Vault.adapter.read() [Obsidian]
        ├─→ OLocalLLMPlugin.showStorageNotification()
        │   └─→ RAGManager.getStorageStats()
        ├─→ new BacklinkGenerator()
        ├─→ OLocalLLMPlugin.addCommand() [x10]
        │   └─→ Plugin.addCommand() [Obsidian]
        └─→ OLocalLLMPlugin.addRibbonIcon()
            └─→ Plugin.addRibbonIcon() [Obsidian]
```

### Example 2: indexNotes() Call Stack

```
User Command
    └─→ OLocalLLMPlugin.indexNotes()
        └─→ RAGManager.indexNotes(progressCallback)
            ├─→ RAGManager.initialize()
            ├─→ RAGManager.waitForVaultReady()
            ├─→ Vault.getFiles() [Obsidian]
            └─→ RAGManager.processFiles()
                ├─→ Vault.cachedRead() [Obsidian]
                ├─→ RAGManager.splitIntoChunks()
                └─→ MemoryVectorStore.addDocuments()
                    ├─→ OllamaEmbeddings.embedDocuments()
                    │   └─→ OllamaEmbeddings.embedQuery() [xN]
                    │       └─→ requestUrl() [Obsidian]
                    └─→ MemoryVectorStore.memoryVectors.push()
            └─→ RAGManager.saveEmbeddings()
                └─→ Vault.adapter.write() [Obsidian]
```

---

## File Structure with Annotation Tags

```
obsidian-local-llm-helper/
│
├── main.ts
│   ├── <IMPORTS_START/END>
│   ├── <SETTINGS_INTERFACE_START/END>
│   ├── <CONVERSATION_ENTRY_INTERFACE_START/END>
│   ├── <CUSTOM_PROMPT_INTERFACE_START/END>
│   ├── <DEFAULT_SETTINGS_START/END>
│   ├── <PERSONAS_DEFINITIONS_START/END>
│   ├── <SEARCH_ENGINES_DICT_START/END>
│   ├── <MAIN_PLUGIN_CLASS_START/END>
│   │   ├── <LOAD_DEFAULT_CUSTOM_PROMPTS_START/END>
│   │   ├── <LOAD_DEFAULT_PERSONAS_START/END>
│   │   ├── <CHECK_FOR_UPDATES_START/END>
│   │   ├── <PLUGIN_ONLOAD_START/END>
│   │   ├── <VALIDATE_SERVER_CONFIGURATION_START/END>
│   │   ├── <GET_SELECTED_TEXT_START/END>
│   │   ├── <REGISTER_PROMPT_COMMAND_START/END>
│   │   ├── <PROCESS_CUSTOM_PROMPT_TEXT_START/END>
│   │   ├── <LOAD_SETTINGS_START/END>
│   │   ├── <SAVE_SETTINGS_START/END>
│   │   ├── <INDEX_NOTES_START/END>
│   │   ├── <HANDLE_GENERATE_BACKLINKS_START/END>
│   │   ├── <HANDLE_DIAGNOSTICS_START/END>
│   │   └── <SHOW_STORAGE_NOTIFICATION_START/END>
│   ├── <SETTINGS_TAB_CLASS_START/END>
│   ├── <MODIFY_PROMPT_FUNCTION_START/END>
│   └── Standalone functions: processText(), processWebSearch(), processNewsSearch()
│
├── src/
│   ├── rag.ts
│   │   ├── <RAG_MANAGER_MODULE_START/END>
│   │   └── Class: RAGManager (all methods tagged)
│   │
│   ├── ollamaEmbeddings.ts
│   │   ├── <OLLAMA_EMBEDDINGS_MODULE_START/END>
│   │   └── Class: OllamaEmbeddings
│   │
│   ├── openAIEmbeddings.ts
│   │   ├── <OPENAI_EMBEDDINGS_MODULE_START/END>
│   │   └── Class: OpenAIEmbeddings
│   │
│   ├── backlinkGenerator.ts
│   │   ├── <BACKLINK_GENERATOR_MODULE_START/END>
│   │   └── Class: BacklinkGenerator
│   │
│   ├── ragChatModal.ts
│   │   ├── <RAG_CHAT_MODAL_MODULE_START/END>
│   │   └── Class: RAGChatModal
│   │
│   ├── autoTagger.ts
│   │   ├── <AUTO_TAGGER_MODULE_START/END>
│   │   └── Function: generateAndAppendTags()
│   │
│   ├── promptPickerModal.ts
│   │   ├── <PROMPT_PICKER_MODAL_MODULE_START/END>
│   │   └── Class: PromptPickerModal
│   │
│   └── updateNoticeModal.ts
│       ├── <UPDATE_NOTICE_MODAL_MODULE_START/END>
│       └── Class: UpdateNoticeModal + CHANGELOGS constant
│
├── GRACE.md (GRACE-style annotation documentation)
├── PROJECT_DEPENDENCY_GRAPH.md (This file)
├── QWEN.md (Project context)
├── manifest.json
├── package.json
├── main.css
├── default-personas.json
└── default-custom-prompts.json
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-17 | Initial graph creation with GRACE-style annotations |

---

## See Also

- [GRACE-Style Annotation Documentation](./GRACE.md)
- [Project Context](./QWEN.md)
- [README](./README.md)
