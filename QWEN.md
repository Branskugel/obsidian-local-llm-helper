# Obsidian Local LLM Helper - Project Context

## Project Overview

The Obsidian Local LLM Helper is a community plugin for Obsidian that seamlessly integrates local LLMs (Large Language Models) with your Obsidian vault. It enables users to process large text chunks, transform content with AI, chat with their notes, and maintain data privacy—all without leaving their notes.

### Key Features
- **Multi-Provider Support**: Works with Ollama, OpenAI, and LM Studio
- **Text Processing Commands**: Summarization, professional tone adjustment, action item generation, custom prompts
- **LLM Chat Interface**: Interactive chat window with conversation history
- **RAG (Retrieval Augmented Generation)**: Chat with your indexed notes using semantic search
- **Web Search Integration**: Search the web and news using Brave Search API
- **Auto-tagging**: Generate hashtags for selected text
- **Backlink Generation**: Generate backlinks to related notes
- **Multiple Personas**: Choose from various AI personas (developer, physicist, fitness expert, etc.)

---

## GRACE-Подобный Подход к Аннотированию Кода

Этот проект использует **GRACE-подобный подход** (Graph-Ready Annotated Code Entities) — систему аннотирования кода для улучшения навигации, понимания и поддержки кодовых баз AI-моделями и разработчиками.

📄 **Документация по аннотированию**: [`GRACE.md`](./GRACE.md)

### Принципы Аннотирования

Рекомендуемые принципы для исходных файлов проекта:

1. **Module Tags**: Желательно иметь открывающий и закрывающий тег модуля
   - Формат: `// <MODULE_NAME_START>` и `// <MODULE_NAME_END>`

2. **Module Contract**: Контракт на уровне модуля в начале файла
   - Формат: `/* Module Contract: [responsibility] --> [functionality] --> [consumers] */`

3. **Class Contracts**: Классы должны иметь контракты
   - Формат: `/* Class Contract: [purpose] --> [responsibilities] --> [services] */`

4. **Method Contracts**: Публичные методы должны иметь контракты
   - Формат: `/* Method Contract: [use-case] --> [actions] --> [results] */`

5. **Import/Export Documentation**: Зависимости должны быть задокументированы

📊 **Project Dependency Graph**: [`PROJECT_DEPENDENCY_GRAPH.md`](./PROJECT_DEPENDENCY_GRAPH.md)

---

## Architecture

### Main Components

Для полной информации о зависимостях см. [`PROJECT_DEPENDENCY_GRAPH.md`](./PROJECT_DEPENDENCY_GRAPH.md)

- [`main.ts`](./main.ts): Core plugin implementation with commands, settings, and UI integration ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#1-olocalllmplugin-maints))
- [`src/rag.ts`](./src/rag.ts): RAG (Retrieval Augmented Generation) system for chatting with notes ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#2-ragmanager-srcragts))
- [`src/ollamaEmbeddings.ts`](./src/ollamaEmbeddings.ts): Ollama embedding provider ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#3-ollamaembeddings-srcollamaembeddingsts))
- [`src/openAIEmbeddings.ts`](./src/openAIEmbeddings.ts): OpenAI/LM Studio embedding provider ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#4-openaiembeddings-srcopenaiembeddingsts))
- [`src/autoTagger.ts`](./src/autoTagger.ts): Auto-generation of hashtags for content ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#module-dependency-matrix))
- [`src/backlinkGenerator.ts`](./src/backlinkGenerator.ts): Generates backlinks to related notes using RAG ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#5-backlinkgenerator-srcbacklinkgeneratorts))
- [`src/ragChatModal.ts`](./src/ragChatModal.ts): Chat interface for RAG functionality ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#6-ragchatmodal-srcragchatmodalts))
- [`src/updateNoticeModal.ts`](./src/updateNoticeModal.ts): Modal for displaying update information with changelog ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#module-dependency-matrix))
- [`src/promptPickerModal.ts`](./src/promptPickerModal.ts): Modal for selecting preset or custom prompts ([см. граф зависимостей](./PROJECT_DEPENDENCY_GRAPH.md#module-dependency-matrix))

### Technology Stack
- **Framework**: Obsidian API
- **Language**: TypeScript
- **Build System**: ESBuild
- **Package Manager**: npm
- **AI Libraries**: @langchain/ollama, @langchain/openai, langchain
- **HTTP Client**: Obsidian's requestUrl and axios

## Building and Running

### Prerequisites
- Node.js and npm
- Obsidian installed
- Local LLM server (Ollama, LM Studio, or compatible OpenAI API server)

### Development Setup
```bash
# Install dependencies
npm install

# Development build (with hot reload)
npm run dev

# Production build
npm run build
```

### Plugin Installation
1. Build the plugin using `npm run build`
2. Copy the generated files to your Obsidian plugins directory
3. Enable the plugin in Obsidian settings

## Development Conventions

### Code Structure
- Core plugin logic in `main.ts`
- Feature-specific modules in `src/` directory
- CSS styles in `styles.css`
- Configuration in `manifest.json`, `package.json`, and `tsconfig.json`

### Settings Management
- Plugin settings are defined in `OLocalLLMSettings` interface
- Settings are persisted using Obsidian's `saveData()` and `loadData()` methods
- Settings UI is implemented in `OLLMSettingTab` class

### Error Handling
- Comprehensive error handling for API calls
- User notifications using Obsidian's `Notice` component
- Console logging with descriptive messages and emojis for debugging

### RAG Implementation
- Embeddings are stored persistently in the vault
- Vector storage uses MemoryVectorStore from LangChain
- Automatic re-indexing when provider/model settings change
- Chunking of documents for better semantic search

## Key Functionality

### Text Processing
- Commands for summarizing, rephrasing, and generating action items
- Streaming output option for real-time text generation
- Multiple output modes (replace or append to selection)

### Chat Interface
- Interactive chat window with conversation history
- Persona selection for different response styles
- Thinking indicators and copy buttons for responses

### RAG Features
- Note indexing for semantic search
- Persistent storage of embeddings
- Chat with your notes functionality
- Backlink generation based on semantic similarity

### Provider Support
- Ollama: Default provider using port 11434
- LM Studio/OpenAI: Compatible with OpenAI API format on port 1234
- Configurable server addresses and model names

## Testing and Debugging

### Console Logging
The plugin includes extensive logging with emojis for easy identification of different operations:
- 🔌 Loading plugin
- ⚙️ Settings loaded
- 🧠 RAGManager initialization
- 🔄 Indexing progress
- ✅ Success messages
- ❌ Error messages

### Diagnostic Tools
- Storage diagnostics command to check embedding status
- Settings validation for server configurations
- Progress indicators for indexing operations

## Configuration Options

### Core Settings
- Server URL and port
- LLM model selection
- Temperature and max tokens
- Streaming output toggle
- Output mode (replace/append)
- Persona selection

### Advanced Settings
- Response formatting options
- Embedding model configuration
- Brave Search API key for web search
- OpenAI API key for cloud services

### RAG Settings
- Indexing controls
- Storage diagnostics
- Persistent embedding management

## Best Practices

### Security
- Local processing ensures data privacy
- API keys stored securely in plugin settings
- No external data transmission for core functionality

### Performance
- Efficient chunking of large documents
- Progress tracking for long operations
- Memory management for vector stores

### User Experience
- Clear status indicators
- Helpful error messages
- Intuitive UI with familiar Obsidian patterns
- Responsive feedback during operations

## Troubleshooting

Common issues and solutions are documented in `TROUBLESHOOTING.md`. The plugin includes diagnostic tools to help identify and resolve configuration problems.