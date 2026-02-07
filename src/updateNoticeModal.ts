import { App, Modal, MarkdownRenderer, Component, Setting } from "obsidian";

// Changelog entries - add new versions at the top
const CHANGELOGS: { version: string; date: string; changes: string }[] = [
	{
		version: "2.3.3", // Updated to reflect merged version
		date: "2025-02",
		changes: `
**Bug Fixes**
- Fixed embedding model changes not taking effect until plugin restart
- Fixed settings not saving when closing settings tab quickly

**New**
- Tavily search provider support (alternative to Brave)
- Search provider picker in settings
- Enhanced search engine support with multiple options (Brave, SearXNG, DuckDuckGo, Firecrawl, Perplexica, Custom)
`,
	},
	{
		version: "2.3.2",
		date: "2025-02",
		changes: `
**Bug Fixes**
- Fixed embedding model changes not taking effect until plugin restart
- Fixed settings not saving when closing settings tab quickly

**New**
- Tavily search provider support (alternative to Brave)
- Search provider picker in settings
`,
	},
	{
		version: "2.3.1",
		date: "2024-02",
		changes: `
**New Features**
- **Redesigned RAG Chat**: New chat interface with welcome message, example queries, and clickable sources
- **Changelog in Settings**: View version history anytime from Settings → About

**RAG Improvements**
- Smarter chunking with overlap for better context preservation
- Incremental indexing - only re-indexes changed files
- Content preprocessing - strips frontmatter and cleans markdown
- Better error messages when notes aren't indexed

**UI/UX**
- Commands organized with prefixes (Text:, Chat:, Web:, Notes:)
- Ribbon menu grouped logically with separators
- Settings page organized into 7 clear sections
- All prompts improved for better LLM output
- Persona prompts rewritten to be more actionable
`,
	},
	{
		version: "2.3.0",
		date: "2024-01",
		changes: `
**New Features**
- **Edit with Prompt**: Edit selected text with preset or custom prompts
  - 8 presets: fix grammar, make concise, expand, simplify, formal/casual tone, bullet points, improve clarity
  - Custom prompt input for one-off instructions

**Security**
- Fixed dependency vulnerabilities (langchain, axios, form-data, js-yaml)

**Improvements**
- Clearer error messages for embedding failures
`,
	},
	{
		version: "2.2.1",
		date: "2024-01",
		changes: `
**Bug Fixes**
- Fixed re-embedding issue that caused embeddings to regenerate on every restart
- Proper persistent storage for embeddings

**Improvements**
- Storage diagnostics command
- Shows embedding count on startup
`,
	},
	{
		version: "2.2.0",
		date: "2024-01",
		changes: `
**New Features**
- Multi-provider support: Ollama, OpenAI, LM Studio
- Easy provider switching in settings
- Configurable temperature and max tokens

**Improvements**
- Code refactoring with src/ directory structure
`,
	},
];

export class UpdateNoticeModal extends Modal {
	constructor(app: App, private version: string) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: `Local LLM Helper updated to v${this.version}` });

		const changelogMd = `
## What's New in v${this.version}

### 🔧 Major Bug Fixes
- **Fixed Re-embedding Issue**: Embeddings no longer re-generate on every app restart
- **Proper Persistent Storage**: Embeddings now persist correctly across Obsidian restarts
- **Data Separation**: Plugin settings and embeddings are now stored separately to prevent conflicts

### 🚀 New Features
- **Storage Diagnostics**: New command and settings button to check embedding storage status
- **User Notifications**: Shows embedding count and storage info on startup
- **Enhanced Logging**: Comprehensive console logging with emojis for better debugging

### 🔧 Improvements
- **Better Error Handling**: Improved Ollama API integration with proper error messages
- **Default Settings**: Updated to use Ollama port 11434 and mxbai-embed-large model
- **Settings UI**: Indexed file count now updates properly in settings panel

[Full Changelog](https://github.com/manimohans/obsidian-local-llm-helper/releases)
        `;

		const dummyComponent = new Component();
		MarkdownRenderer.render(this.app, changelogMd, contentEl, "", dummyComponent);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
