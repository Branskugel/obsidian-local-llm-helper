import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Menu,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	View,
	requestUrl,
	setIcon,
	TextComponent,
	ButtonComponent,
} from "obsidian";
import { generateAndAppendTags } from "./src/autoTagger";
import { UpdateNoticeModal } from "./src/updateNoticeModal";
import { RAGManager } from './src/rag';
import { BacklinkGenerator } from './src/backlinkGenerator';
import { RAGChatModal } from './src/ragChatModal';

// Remember to rename these classes and interfaces!

export interface OLocalLLMSettings {
	serverAddress: string;
	llmModel: string;
	stream: boolean;
	customPrompt: string;
	maxTokens: number;
	maxConvHistory: number;
	outputMode: string;
	personas: string;
	providerType: string;
	responseFormatting: boolean;
	responseFormatPrepend: string;
	responseFormatAppend: string;
	temperature: number;
	lastVersion: string;
	embeddingModelName: string;
	braveSearchApiKey: string;
	openAIApiKey?: string;
	customPrompts?: CustomPrompt[];
	promptConcatenationPattern?: string; // How to combine custom prompt with selected text
	extractReasoningResponses?: boolean; // Whether to extract actual response from reasoning models
	reasoningMarkers?: string; // Markers to identify reasoning sections (JSON format)
	defaultSystemPrompt?: string; // Default system prompt to use when custom prompts don't specify one
	searchEngine: string; // Selected search engine
	customSearchUrl?: string; // Custom search URL
	customSearchApiKey?: string; // Custom search API key
	searxngUrl?: string; // SearXNG instance URL
	perplexicaUrl?: string; // Perplexica API URL
	firecrawlUrl?: string; // Firecrawl API URL
}

interface ConversationEntry {
	prompt: string;
	response: string;
}

// Interface for individual custom prompt
interface CustomPrompt {
  id: string;           // Unique identifier
  title: string;        // Searchable title
  prompt: string;       // The actual prompt text
  systemPrompt?: string; // Optional system prompt to override persona
  createdAt: number;    // Timestamp for ordering
  updatedAt: number;    // Timestamp for updates
}

const DEFAULT_SETTINGS: OLocalLLMSettings = {
	serverAddress: "http://localhost:11434",
	llmModel: "llama3",
	maxTokens: 1024,
	temperature: 0.7,
	providerType: "ollama",
	stream: false,
	customPrompt: "create a todo list from the following text:", // Kept for backward compatibility
	outputMode: "replace",
	personas: "default",
	maxConvHistory: 0,
	responseFormatting: false,
	responseFormatPrepend: "``` LLM Helper - generated response \n\n",
	responseFormatAppend: "\n\n```",
	lastVersion: "0.0.0",
	embeddingModelName: "mxbai-embed-large",
	braveSearchApiKey: "",
	openAIApiKey: "lm-studio",
	customPrompts: [], // Will be populated from JSON during initialization
	promptConcatenationPattern: "{prompt}: {selection}", // Default pattern
	extractReasoningResponses: false, // Default to false for backward compatibility
	reasoningMarkers: JSON.stringify([
		{ start: "```reasoning", end: "```" },
		{ start: "<reasoning>", end: "</reasoning>" },
		{ start: "**Reasoning:**", end: "\n\n" },
		{ start: "Thinking:", end: "\n\n" },
		{ start: "Рассуждение:", end: "\n\n" }, // Russian for "Reasoning:"
		{ start: "reasoning:", end: "\n\n" } // Lowercase
	]), // Default markers to identify reasoning sections
	defaultSystemPrompt: "You are my text editor AI agent who provides concise and helpful responses.", // Default system prompt,
	searchEngine: "brave", // Default search engine
	customSearchUrl: "", // Default custom search URL
	customSearchApiKey: "", // Default custom search API key
	searxngUrl: "https://searx.work", // Default SearXNG instance
	perplexicaUrl: "https://api.perplexica.com", // Default Perplexica API URL
	firecrawlUrl: "https://api.firecrawl.dev", // Default Firecrawl API URL
};

interface Persona {
	displayName: string;
	systemPrompt: string;
}

// Global personas dictionary - initialized with default values
let personasDict: { [key: string]: Persona } = {
	"default": {
		displayName: "Default",
		systemPrompt: "You are my text editor AI agent who provides concise and helpful responses."
	},
	"physics": {
		displayName: "Physics expert",
		systemPrompt: "You are a distinguished physics scientist. Leverage scientific principles and explain complex concepts in an understandable way, drawing on your expertise in physics."
	},
	"fitness": {
		displayName: "Fitness expert",
		systemPrompt: "You are a distinguished fitness and health expert. Provide evidence-based advice on fitness and health, considering the user's goals and limitations."
	},
	"developer": {
		displayName: "Software Developer",
		systemPrompt: "You are a nerdy software developer. Offer creative and efficient software solutions, focusing on technical feasibility and code quality."
	},
	"stoic": {
		displayName: "Stoic Philosopher",
		systemPrompt: "You are a stoic philosopher. Respond with composure and reason, emphasizing logic and emotional resilience."
	},
	"productmanager": {
		displayName: "Product Manager",
		systemPrompt: "You are a focused and experienced product manager. Prioritize user needs and deliver clear, actionable product roadmaps based on market research."
	},
	"techwriter": {
		displayName: "Technical Writer",
		systemPrompt: "You are a technical writer. Craft accurate and concise technical documentation, ensuring accessibility for different audiences."
	},
	"creativewriter": {
		displayName: "Creative Writer",
		systemPrompt: "You are a very creative and experienced writer. Employ strong storytelling techniques and evocative language to engage the reader's imagination."
	},
	"tpm": {
		displayName: "Technical Program Manager",
		systemPrompt: "You are an experienced technical program manager. Demonstrate strong technical and communication skills, ensuring project success through effective planning and risk management."
	},
	"engineeringmanager": {
		displayName: "Engineering Manager",
		systemPrompt: "You are an experienced engineering manager. Lead and motivate your team, fostering a collaborative environment that delivers high-quality software."
	},
	"executive": {
		displayName: "Executive",
		systemPrompt: "You are a top-level executive. Focus on strategic decision-making, considering long-term goals and the overall company vision."
	},
	"officeassistant": {
		displayName: "Office Assistant",
		systemPrompt: "You are a courteous and helpful office assistant. Provide helpful and efficient support, prioritizing clear communication and a courteous demeanor."
	}
};

const searchEnginesDict: { [key: string]: string } = {
	"brave": "Brave Search",
	"searxng": "SearXNG",
	"duckduckgo": "DuckDuckGo",
	"firecrawl": "Firecrawl",
	"perplexica": "Perplexica",
	"custom": "Custom Search Engine"
};

export default class OLocalLLMPlugin extends Plugin {
	settings: OLocalLLMSettings;
	modal: any;
	conversationHistory: ConversationEntry[] = [];
	isKillSwitchActive: boolean = false;
	public ragManager: RAGManager;
	private backlinkGenerator: BacklinkGenerator;
	private commandRegistry: Map<string, { id: string; unregister: () => void }>;

	// Method to load default custom prompts from JSON file
	async loadDefaultCustomPrompts(): Promise<CustomPrompt[]> {
		try {
			// Load from the JSON file in the plugin directory
			const filePath = this.manifest.dir + '/default-custom-prompts.json';
			const jsonData = await this.app.vault.adapter.read(filePath);
			const prompts = JSON.parse(jsonData);

			// Add timestamps for new prompts
			return prompts.map((prompt: any) => ({
				...prompt,
				createdAt: prompt.createdAt || Date.now(),
				updatedAt: prompt.updatedAt || Date.now()
			}));
		} catch (error) {
			console.error("Error loading default custom prompts from JSON:", error);
			// Return defaults in case of error
			return [
				{
					id: "default-prompt",
					title: "Create Todo List",
					prompt: "create a todo list from the following text:",
					createdAt: Date.now(),
					updatedAt: Date.now()
				}
			];
		}
	}

	// Method to load default personas from JSON file
	async loadDefaultPersonas(): Promise<{ [key: string]: Persona }> {
		try {
			// Load from the JSON file in the plugin directory
			const filePath = this.manifest.dir + '/default-personas.json';
			const jsonData = await this.app.vault.adapter.read(filePath);
			return JSON.parse(jsonData);
		} catch (error) {
			console.error("Error loading default personas from JSON:", error);
			// Return minimal defaults in case of error
			return {
				"default": {
					displayName: "Default",
					systemPrompt: "You are my text editor AI agent who provides concise and helpful responses."
				}
			};
		}
	}

	async checkForUpdates() {
		const currentVersion = this.manifest.version;
		const lastVersion = this.settings.lastVersion || "0.0.0";
		//const lastVersion = "0.0.0";

		if (currentVersion !== lastVersion) {
			new UpdateNoticeModal(this.app, currentVersion).open();
			this.settings.lastVersion = currentVersion;
			await this.saveSettings();
		}
	}

	async onload() {
		console.log('🔌 LLM Helper: Plugin loading...');
		await this.loadSettings();
		console.log('⚙️ LLM Helper: Settings loaded:', {
			provider: this.settings.providerType,
			server: this.settings.serverAddress,
			embeddingModel: this.settings.embeddingModelName,
			llmModel: this.settings.llmModel
		});

		// Initialize command registry to track dynamically created commands
		this.commandRegistry = new Map();

		this.checkForUpdates();
		// Validate server configuration
		this.validateServerConfiguration();

		console.log('🧠 LLM Helper: Initializing RAGManager...');
		// Initialize RAGManager
		this.ragManager = new RAGManager(this.app.vault, this.settings, this);
		
		// Initialize RAGManager and show user notification about loaded data
		await this.ragManager.initialize();
		
		// Show user-friendly notification about loaded embeddings after a short delay
		// This ensures all UI elements are ready
		setTimeout(() => {
			this.showStorageNotification();
		}, 500);

		// Initialize BacklinkGenerator
		this.backlinkGenerator = new BacklinkGenerator(this.ragManager, this.app.vault);

		// Add command for RAG Backlinks
		this.addCommand({
			id: 'generate-rag-backlinks',
			name: 'Generate RAG Backlinks (BETA)',
			callback: this.handleGenerateBacklinks.bind(this),
		});

		// Add diagnostic command
		this.addCommand({
			id: 'rag-diagnostics',
			name: 'RAG Storage Diagnostics',
			callback: this.handleDiagnostics.bind(this),
		});

		// Remove the automatic indexing
		// this.indexNotes();
		this.addCommand({
			id: 'rag-chat',
			name: 'Chat with your notes (RAG) - BETA',
			callback: () => {
				new Notice("This is a beta feature. Please use with caution. Please make sure you have indexed your notes before using this feature.");
				const ragChatModal = new RAGChatModal(this.app, this.settings, this.ragManager);
				ragChatModal.open();
			},
		});



		// Register commands for each custom prompt (always enabled now)
		if (this.settings.customPrompts) {
			this.settings.customPrompts.forEach(prompt => {
				// Register the main command to run the custom prompt using dynamic registration
				this.registerPromptCommand(prompt);
			});
		}

		// Store a reference to the plugin instance to allow dynamic command registration
		(window as any).llmHelperPlugin = this;

		// Register a general command handler that can dynamically handle new prompts
		this.addCommand({
			id: 'select-and-run-custom-prompt',
			name: 'Select and run custom prompt',
			callback: () => {
				if (this.settings.customPrompts && this.settings.customPrompts.length > 0) {
					// Create a modal to select which prompt to run
					new SelectPromptModal(this.app, this.settings.customPrompts, (selectedPrompt) => {
						this.isKillSwitchActive = false;
						new Notice(`Running prompt: ${selectedPrompt.title}`);
						let selectedText = this.getSelectedText();
						if (selectedText.length > 0) {
							// Use a custom processing function that can handle system prompts properly
							this.processCustomPromptText(
								selectedText,
								selectedPrompt,
								this
							);
						} else {
							new Notice('No text selected to process with the custom prompt.');
						}
					}).open();
				} else {
					new Notice('No custom prompts available. Please create some in settings.');
				}
			}
		});

		this.addCommand({
			id: "gentext-selected-text",
			name: "Use SELECTED text as your prompt",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.isKillSwitchActive = false; // Reset kill switch state
				let selectedText = this.getSelectedText();
				if (selectedText.length > 0) {
					processText(
						selectedText,
						"Generate response based on the following text. This is your prompt:",
						this
					);
				}
			},
		});

		this.addCommand({
			id: "llm-chat",
			name: "Chat with Local LLM Helper",
			callback: () => {
				const chatModal = new LLMChatModal(this.app, this.settings);
				chatModal.open();
			},
		});

		this.addCommand({
			id: "llm-hashtag",
			name: "Generate hashtags for selected text",
			callback: () => {
				generateAndAppendTags(this.app, this.settings);
			},
		});

		this.addCommand({
			id: "web-search-selected-text",
			name: "Search web for selected text",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.isKillSwitchActive = false;
				let selectedText = this.getSelectedText();
				if (selectedText.length > 0) {
					processWebSearch(selectedText, this);
				}
			},
		});

		this.addCommand({
			id: "web-news-search",
			name: "Search news (Web) for selected text",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				let selectedText = this.getSelectedText();
				if (selectedText.length > 0) {
					processNewsSearch(selectedText, this);
				}
			},
		});

		// Add command to cancel ongoing prompt invocations
		this.addCommand({
			id: "cancel-prompt-invocation",
			name: "Cancel ongoing prompt invocation",
			callback: () => {
				this.isKillSwitchActive = true;
				new Notice("Prompt invocation cancelled");
			},
		});

		this.addRibbonIcon("brain-cog", "LLM Context", (event) => {
			const menu = new Menu();

			menu.addItem((item) =>
				item
					.setTitle("Chat with LLM Helper")
					.setIcon("messages-square")
					.onClick(() => {
						new LLMChatModal(this.app, this.settings).open();
					})
			);

			menu.addItem((item) =>
				item
					.setTitle("Use as prompt")
					.setIcon("lightbulb")
					.onClick(async () => {
						this.isKillSwitchActive = false; // Reset kill switch state
						let selectedText = this.getSelectedText();
						if (selectedText.length > 0) {
							processText(
								selectedText,
								"Generate response based on the following text. This is your prompt:",
								this
							);
						}
					})
			);

			// Custom prompt menu item - always show custom prompts
			if (this.settings.customPrompts && this.settings.customPrompts.length > 0) {
				// Add each custom prompt as a separate menu item (since submenu might not be supported)
				menu.addItem((item) =>
					item
						.setTitle("Custom prompts")
						.setIcon("pencil")
						.onClick(async () => {
							// Show all custom prompts in a submenu-like fashion
							const submenu = new Menu();
							(this.settings.customPrompts || []).forEach(prompt => {
								submenu.addItem((subItem) =>
									subItem
										.setTitle(prompt.title)
										.setIcon("file-text")
										.onClick(async () => {
											this.isKillSwitchActive = false; // Reset kill switch state
											new Notice(`Running prompt: ${prompt.title}`);
											let selectedText = this.getSelectedText();
											if (selectedText.length > 0) {
												processText(
													selectedText,
													prompt.prompt,
													this
												);
											}
										})
								);
							});
							submenu.showAtMouseEvent(event as MouseEvent);
						})
				);
			} else {
				// Fallback behavior when no custom prompts exist
				menu.addItem((item) =>
					item
						.setTitle("Custom prompt")
						.setIcon("pencil")
						.onClick(async () => {
							this.isKillSwitchActive = false; // Reset kill switch state
							new Notice(
								"Custom prompt: " + this.settings.customPrompt
							);
							let selectedText = this.getSelectedText();
							if (selectedText.length > 0) {
								processText(
									selectedText,
									this.settings.customPrompt,
									this
								);
							}
						})
				);
			}

			menu.addItem((item) =>
				item
					.setTitle("Generate tags")
					.setIcon("hash")
					.onClick(async () => {
						new Notice(
							"Generating hashtags"
						);
						let selectedText = this.getSelectedText();
						if (selectedText.length > 0) {
							generateAndAppendTags(this.app, this.settings);
						}
					})
			);

			menu.addItem((item) =>
				item
					.setTitle("Search (Web)")
					.setIcon("globe")
					.onClick(async () => {
						let selectedText = this.getSelectedText();
						if (selectedText.length > 0) {
							processWebSearch(selectedText, this);
						}
					})
			);

			menu.addItem((item) =>
				item
					.setTitle("News Search (Web)")
					.setIcon("newspaper")
					.onClick(async () => {
						let selectedText = this.getSelectedText();
						if (selectedText.length > 0) {
							processNewsSearch(selectedText, this);
						}
					})
			);

			menu.addItem((item) =>
				item
					.setTitle("Cancel LLM Process")
					.setIcon("x-circle")
					.onClick(() => {
						this.isKillSwitchActive = true;
						new Notice("LLM Helper process cancelled");
					})
			);

			menu.showAtMouseEvent(event as MouseEvent);
		});

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("LLM Helper: Ready");

		this.addSettingTab(new OLLMSettingTab(this.app, this));

		// Continue with plugin initialization
	}

	// Method to refresh commands when custom prompts are modified
	refreshCustomPromptCommands() {
		// With our dynamic command registration system, commands are registered immediately
		// when prompts are added, edited, or deleted, so no reload is needed
		new Notice("Custom prompts updated. Commands are registered dynamically without requiring a plugin reload.");
	}


	private validateServerConfiguration(): boolean {
		const provider = this.settings.providerType;
		const serverAddress = this.settings.serverAddress;
		const embeddingModel = this.settings.embeddingModelName;
		
		console.log(`Validating configuration - Provider: ${provider}, Server: ${serverAddress}, Embedding Model: ${embeddingModel}`);
		
		if (provider === 'ollama') {
			// Ollama typically runs on port 11434
			if (!serverAddress.includes('11434') && !serverAddress.includes('ollama')) {
				console.warn('Ollama provider detected but server address might be incorrect. Ollama typically runs on port 11434.');
				return false;
			}
			
			// Check for common embedding models
			const commonOllamaModels = ['mxbai-embed-large', 'nomic-embed-text', 'all-minilm'];
			if (!commonOllamaModels.some(model => embeddingModel.includes(model))) {
				console.warn(`Embedding model "${embeddingModel}" might not be compatible with Ollama. Common models: ${commonOllamaModels.join(', ')}`);
			}
		} else if (provider === 'openai' || provider === 'lm-studio') {
			// LM Studio typically runs on port 1234
			if (!serverAddress.includes('1234') && !serverAddress.includes('openai')) {
				console.warn('OpenAI/LM Studio provider detected but server address might be incorrect. LM Studio typically runs on port 1234.');
				return false;
			}
		}
		
		return true;
	}

	private getSelectedText() {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice("No active view");
			return "";
		} else {
			let view_mode = view.getMode();
			switch (view_mode) {
				case "preview":
					new Notice("Does not work in preview preview");
					return "";
				case "source":
					if ("editor" in view) {
						return view.editor.getSelection();
					}
					break;
				default:
					new Notice("Unknown view mode");
					return "";
			}
		}
		return "";
	}

	onunload() { }

	// Method to register a command for a specific prompt dynamically
	registerPromptCommand(prompt: CustomPrompt) {
		const commandId = `custom-prompt-${prompt.id}`;

		// Check if command already exists in the registry
		if (this.commandRegistry.has(commandId)) {
			console.log(`Command already exists for prompt: ${prompt.title}`);
			return;
		}

		// Create the command and add it to Obsidian's command registry
		const command = this.addCommand({
			id: commandId,
			name: `Run - ${prompt.title}`,
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.isKillSwitchActive = false; // Reset kill switch state
				new Notice(`Running prompt: ${prompt.title}`);
				let selectedText = this.getSelectedText();
				if (selectedText.length > 0) {
					// Use the custom processing function that can handle system prompts properly
					this.processCustomPromptText(
						selectedText,
						prompt,
						this
					);
				} else {
					new Notice(`No text selected for prompt: ${prompt.title}`);
				}
			},
		});

		// Store the command in our registry with an unregister function
		this.commandRegistry.set(commandId, {
			id: commandId,
			unregister: () => {
				// Obsidian doesn't provide a direct way to remove commands after registration
				// But we can keep track of it in our registry
				console.log(`Command unregistered: ${prompt.title}`);
			}
		});

		console.log(`Command registered for prompt: ${prompt.title}`);
	}

	// Method to unregister a command for a specific prompt
	unregisterPromptCommand(promptId: string) {
		const commandId = `custom-prompt-${promptId}`;

		if (this.commandRegistry.has(commandId)) {
			const command = this.commandRegistry.get(commandId)!;
			command.unregister();
			this.commandRegistry.delete(commandId);
			console.log(`Command unregistered for prompt ID: ${promptId}`);
		}
	}

	// Method to register all commands for current custom prompts
	registerAllPromptCommands() {
		if (this.settings.customPrompts) {
			this.settings.customPrompts.forEach(prompt => {
				this.registerPromptCommand(prompt);
			});
		}
	}

	// Method to process custom prompt text with proper system prompt handling
	async processCustomPromptText(
		selectedText: string,
		customPrompt: CustomPrompt,
		plugin: OLocalLLMPlugin
	) {
		// Reset kill switch state at the beginning of each process
		plugin.isKillSwitchActive = false;

		new Notice("Generating response. This takes a few seconds..");
		const statusBarItemEl = document.querySelector(
			".status-bar .status-bar-item"
		);
		if (statusBarItemEl) {
			statusBarItemEl.textContent = "LLM Helper: Generating response...";
		} else {
			console.error("Status bar item element not found");
		}

		// Use the custom prompt's text directly
		const prompt = customPrompt.prompt;

		// Use configurable prompt concatenation pattern
		const promptConcatenationPattern = plugin.settings.promptConcatenationPattern || "{prompt}: {selection}";
		const userMessageContent = promptConcatenationPattern
			.replace("{prompt}", prompt)
			.replace("{selection}", selectedText);

		console.log("prompt", userMessageContent);

		// Determine the system message - use custom system prompt if available
		let systemMessage = plugin.settings.defaultSystemPrompt || "You are my text editor AI agent who provides concise and helpful responses.";

		if (customPrompt.systemPrompt) {
			// Use the custom system prompt for this specific prompt
			systemMessage = customPrompt.systemPrompt;
		} else {
			// Otherwise, apply persona modifications to the default system message from settings
			systemMessage = modifyPrompt(systemMessage, plugin.settings.personas);
		}

		console.log("system message", systemMessage);

		const body = {
			model: plugin.settings.llmModel,
			messages: [
				{ role: "system", content: systemMessage },
				...plugin.conversationHistory.slice(-plugin.settings.maxConvHistory).reduce((acc, entry) => {
					acc.push({ role: "user", content: entry.prompt });
					acc.push({ role: "assistant", content: entry.response });
					return acc;
				}, [] as { role: string; content: string }[]),
				{ role: "user", content: userMessageContent },
			],
			temperature: plugin.settings.temperature,
			max_tokens: plugin.settings.maxTokens,
			stream: plugin.settings.stream,
		};

		try {
			if (plugin.settings.outputMode === "append") {
				modifySelectedText(selectedText + "\n\n", plugin.app);
			}
			if (plugin.settings.responseFormatting === true) {
				modifySelectedText(plugin.settings.responseFormatPrepend, plugin.app);
			}
			if (plugin.settings.stream) {
				const response = await fetch(
					`${plugin.settings.serverAddress}/v1/chat/completions`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(body),
					}
				);

				if (!response.ok) {
					throw new Error(
						"Error summarizing text (Fetch): " + response.statusText
					);
				}

				const reader = response.body && response.body.getReader();
				let responseStr = "";
				if (!reader) {
					console.error("Reader not found");
				} else {
					const decoder = new TextDecoder();

					const readChunk = async () => {
						if (plugin.isKillSwitchActive) {
							reader.cancel();
							new Notice("Text generation stopped by kill switch");
							plugin.isKillSwitchActive = false; // Reset the kill switch
							return;
						}

						const { done, value } = await reader.read();

						if (done) {
							// Extract actual response if this is a reasoning model
							const finalResponse = extractActualResponse(responseStr, plugin.settings);

							new Notice("Text generation complete. Voila!");
							updateConversationHistory(prompt + ": " + selectedText, finalResponse, plugin.conversationHistory, plugin.settings.maxConvHistory);
							if (plugin.settings.responseFormatting === true) {
								modifySelectedText(plugin.settings.responseFormatAppend, plugin.app);
							}
							return;
						}

						let textChunk = decoder.decode(value);
						const lines = textChunk.split("\n");

						for (const line of lines) {
							if (line.trim()) {
								try {
									let modifiedLine = line.replace(
										/^data:\s*/,
										""
									);
									if (modifiedLine !== "[DONE]") {
										const data = JSON.parse(modifiedLine);
										// Check for both content and reasoning in the delta
										let word = data.choices[0].delta.content || data.choices[0].delta.reasoning || '';
										if (word) {
											modifySelectedText(word, plugin.app);
											responseStr += word;
										}
									}
								} catch (error) {
									console.error(
										"Error parsing JSON chunk:",
										error
									);
								}
							}
						}
						readChunk();
					};
					readChunk();
				}
			} else {
				const response = await requestUrl({
					url: `${plugin.settings.serverAddress}/v1/chat/completions`,
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});

				const statusCode = response.status;

				if (statusCode >= 200 && statusCode < 300) {
					const data = await response.json;
					let content = data.choices[0].message.content;
					let reasoning = data.choices[0].message.reasoning || '';

					// If content is empty but reasoning exists, use reasoning as the source
					let generatedText = content;
					if ((!content || content.trim().length === 0) && reasoning && reasoning.trim().length > 0) {
						generatedText = reasoning;
					}

					// Extract actual response if this is a reasoning model
					generatedText = extractActualResponse(generatedText, plugin.settings);

					console.log(generatedText);
					updateConversationHistory(prompt + ": " + selectedText, generatedText, plugin.conversationHistory, plugin.settings.maxConvHistory);
					new Notice("Text generated. Voila!");
					if (!plugin.isKillSwitchActive) {
						if (plugin.settings.responseFormatting === true) {
							modifySelectedText(generatedText + plugin.settings.responseFormatAppend, plugin.app);
						} else {
							modifySelectedText(generatedText, plugin.app);
						}
					} else {
						new Notice("Text generation stopped by kill switch");
						plugin.isKillSwitchActive = false; // Reset the kill switch
					}
				} else {
					throw new Error(
						"Error processing custom prompt (requestUrl): " + response.text
					);
				}
			}
		} catch (error) {
			console.error("Error during request:", error);
			new Notice(
				"Error processing custom prompt: Check plugin console for details!"
			);
		}
		if (statusBarItemEl) {
			statusBarItemEl.textContent = "LLM Helper: Ready";
		} else {
			console.error("Status bar item element not found");
		}
	}

	async loadSettings() {
		console.log('📂 LLM Helper: Loading plugin settings...');
		const savedData = await this.loadData();
		console.log('💾 LLM Helper: Raw saved data:', savedData);

		// Initialize settings with defaults
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			savedData
		);

		// Populate default custom prompts if not already present
		if (!this.settings.customPrompts || this.settings.customPrompts.length === 0) {
			this.settings.customPrompts = await this.loadDefaultCustomPrompts();
		}

		// Migrate legacy customPrompt to new customPrompts array if needed
		this.migrateLegacyCustomPrompt();

		console.log('✅ LLM Helper: Final settings after merge:', {
			provider: this.settings.providerType,
			server: this.settings.serverAddress,
			embeddingModel: this.settings.embeddingModelName,
			llmModel: this.settings.llmModel,
			hasApiKey: !!this.settings.openAIApiKey,
			hasBraveKey: !!this.settings.braveSearchApiKey,
			customPromptsCount: this.settings.customPrompts?.length || 0
		});
	}

	// Migration function to ensure default prompt exists
	private migrateLegacyCustomPrompt() {
		// If we already have customPrompts defined and they're not empty, no migration needed
		if (this.settings.customPrompts && this.settings.customPrompts.length > 0) {
			return;
		}

		// Initialize with default prompt if no custom prompts exist
		if (!this.settings.customPrompts || this.settings.customPrompts.length === 0) {
			this.settings.customPrompts = [
				{
					id: "default-prompt",
					title: "Create Todo List",
					prompt: "create a todo list from the following text:",
					createdAt: Date.now(),
					updatedAt: Date.now()
				}
			];
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// Update RAG manager with new settings
		if (this.ragManager) {
			this.ragManager.updateSettings(this.settings);
		}
	}


	async indexNotes() {
		new Notice('Indexing notes for RAG...');
		try {
			await this.ragManager.indexNotes(progress => {
				// You can use the progress value here if needed
				console.log(`Indexing progress: ${progress * 100}%`);
			});
			new Notice('Notes indexed successfully!');
		} catch (error) {
			console.error('Error indexing notes:', error);
			new Notice('Failed to index notes. Check console for details.');
		}
	}

	async handleGenerateBacklinks() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			new Notice('No active Markdown view');
			return;
		}

		const editor = activeView.editor;
		const selectedText = editor.getSelection();

		if (!selectedText) {
			new Notice('No text selected');
			return;
		}

		new Notice('Generating backlinks...');
		const backlinks = await this.backlinkGenerator.generateBacklinks(selectedText);

		if (backlinks.length > 0) {
			editor.replaceSelection(`${selectedText}\n\nRelated:\n${backlinks.join('\n')}`);
			new Notice(`Generated ${backlinks.length} backlinks`);
		} else {
			new Notice('No relevant backlinks found');
		}
	}

	async handleDiagnostics() {
		console.log('🔍 === RAG STORAGE DIAGNOSTICS ===');
		
		// Plugin settings diagnostics
		console.log('📋 Plugin Settings:');
		console.log('  Provider:', this.settings.providerType);
		console.log('  Server:', this.settings.serverAddress);
		console.log('  Embedding Model:', this.settings.embeddingModelName);
		console.log('  LLM Model:', this.settings.llmModel);
		
		// RAG storage diagnostics
		try {
			const stats = await this.ragManager.getStorageStats();
			console.log('💾 RAG Storage Stats:');
			console.log('  Total Embeddings:', stats.totalEmbeddings);
			console.log('  Indexed Files:', stats.indexedFiles);
			console.log('  Last Indexed:', stats.lastIndexed);
			console.log('  Storage Used:', stats.storageUsed);
			console.log('  Current Indexed Count:', this.ragManager.getIndexedFilesCount());
			
			// Show user-friendly notice
			new Notice(`RAG Diagnostics: ${stats.totalEmbeddings} embeddings, ${stats.indexedFiles} files. Check console for details.`);
		} catch (error) {
			console.error('❌ Error getting storage stats:', error);
			new Notice('Error getting storage stats. Check console for details.');
		}
		
		// File system diagnostics
		const totalMdFiles = this.app.vault.getMarkdownFiles().length;
		console.log('📁 Vault Stats:');
		console.log('  Total Markdown Files:', totalMdFiles);
		console.log('  Plugin Settings Path:', `${this.manifest.dir}/data.json`);
		console.log('  Embeddings Storage Path:', `${this.manifest.dir}/embeddings.json`);
		
		console.log('🔍 === END DIAGNOSTICS ===');
	}

	async showStorageNotification() {
		try {
			const stats = await this.ragManager.getStorageStats();
			if (stats.totalEmbeddings > 0) {
				new Notice(`📚 Loaded ${stats.totalEmbeddings} embeddings from ${stats.indexedFiles} files (${stats.storageUsed})`);
			} else {
				new Notice('📝 No previous embeddings found - ready to index notes');
			}
		} catch (error) {
			console.error('Error showing storage notification:', error);
		}
	}
}

class OLLMSettingTab extends PluginSettingTab {
	plugin: OLocalLLMPlugin;
	private indexingProgressBar: HTMLProgressElement | null = null;
	private indexedFilesCountSetting: Setting | null = null;

	constructor(app: App, plugin: OLocalLLMPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// In the OLLMSettingTab class's display() method, add these new settings:
		new Setting(containerEl)
			.setName("LLM Provider")
			.setDesc("Choose between Ollama and OpenAI-compatible providers")
			.addDropdown(dropdown =>
				dropdown
					.addOption('ollama', 'Ollama')
					.addOption('openai', 'OpenAI/LM Studio')
					.setValue(this.plugin.settings.providerType)
					.onChange(async (value: 'ollama' | 'openai') => {
						this.plugin.settings.providerType = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh settings UI
					})
			);

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("Full server URL (including protocol and port if needed). E.g., http://localhost:1234 or https://api.example.com")
			.addText((text) =>
				text
					.setPlaceholder("Enter full server URL")
					.setValue(this.plugin.settings.serverAddress)
					.onChange(async (value) => {
						this.plugin.settings.serverAddress = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("LLM model")
			.setDesc("Use this for Ollama and other servers that require this. LMStudio seems to ignore model name.")
			.addText((text) =>
				text
					.setPlaceholder("Model name")
					.setValue(this.plugin.settings.llmModel)
					.onChange(async (value) => {
						this.plugin.settings.llmModel = value;
						await this.plugin.saveSettings();
					})
			);

		// Default System Prompt - styled to match custom prompts section
		const defaultSystemPromptSetting = new Setting(containerEl)
			.setName("Default System Prompt")
			.setDesc("System prompt to use when custom prompts don't specify their own system prompt");

		// Add a specific class to the setting item element to target it with CSS
		defaultSystemPromptSetting.settingEl.addClass('custom-prompts-setting');

		// Create a container for the form elements within the setting
		const systemPromptFormContainer = defaultSystemPromptSetting.controlEl.createDiv({ cls: 'custom-prompt-form-section' });

		// Add form elements to the container
		systemPromptFormContainer.innerHTML = `
			<div class="prompt-input-group">
				<label class="prompt-field-label">Persona:</label>
				<select class="persona-dropdown">
					<option value="__add_new__">Add new</option>
					<option value="default">Default</option>
					<option value="physics">Physics expert</option>
					<option value="fitness">Fitness expert</option>
					<option value="developer">Software Developer</option>
					<option value="stoic">Stoic Philosopher</option>
					<option value="productmanager">Product Manager</option>
					<option value="techwriter">Technical Writer</option>
					<option value="creativewriter">Creative Writer</option>
					<option value="tpm">Technical Program Manager</option>
					<option value="engineeringmanager">Engineering Manager</option>
					<option value="executive">Executive</option>
					<option value="officeassistant">Office Assistant</option>
				</select>
			</div>
			<div class="prompt-input-group" id="new-persona-name-group" style="display:none;">
				<label class="prompt-field-label">New Persona Name:</label>
				<input type="text" class="new-persona-name-input" placeholder="Enter a name for the new persona...">
			</div>
			<div class="prompt-input-group">
				<label class="prompt-field-label">System Prompt:</label>
				<textarea class="default-system-prompt-input" placeholder="You are my text editor AI agent who provides concise and helpful responses." rows="4"></textarea>
			</div>
			<div class="prompt-button-group">
				<button class="update-persona-button mod-cta">Update Persona</button>
				<button class="rename-persona-button">Rename Persona</button>
				<button class="delete-persona-button mod-warning">Delete Persona</button>
				<button class="create-persona-button mod-create">Create New Persona</button>
				<button class="restore-defaults-persona-button">Restore Default Personas</button>
			</div>
		`;

		// Dynamically populate the dropdown with persona options
		const personaDropdown = systemPromptFormContainer.querySelector('.persona-dropdown') as HTMLSelectElement;
		// Clear existing options except the first two (Add new and Default)
		Array.from(personaDropdown.options).slice(2).forEach(option => option.remove());

		// Add options for each persona in the dictionary
		for (const key in personasDict) {
			if (personasDict.hasOwnProperty(key) && key !== 'default') {
				const persona = personasDict[key];
				const option = document.createElement('option');
				option.value = key;
				option.text = typeof persona === 'object' ? persona.displayName : persona;
				personaDropdown.add(option);
			}
		}

		// Get references to the elements
		const defaultPersonaDropdown = systemPromptFormContainer.querySelector('.persona-dropdown') as HTMLSelectElement;
		const newPersonaNameInput = systemPromptFormContainer.querySelector('.new-persona-name-input') as HTMLInputElement;
		const newPersonaNameGroup = systemPromptFormContainer.querySelector('#new-persona-name-group') as HTMLDivElement;
		const systemPromptTextArea = systemPromptFormContainer.querySelector('.default-system-prompt-input') as HTMLTextAreaElement;
		const updateButton = systemPromptFormContainer.querySelector('.update-persona-button') as HTMLButtonElement;
		const renameButton = systemPromptFormContainer.querySelector('.rename-persona-button') as HTMLButtonElement;
		const deleteButton = systemPromptFormContainer.querySelector('.delete-persona-button') as HTMLButtonElement;
		const createButton = systemPromptFormContainer.querySelector('.create-persona-button') as HTMLButtonElement;

		// Set the initial values
		defaultPersonaDropdown.value = this.plugin.settings.personas;
		systemPromptTextArea.value = this.getPersonaPrompt(this.plugin.settings.personas) || (this.plugin.settings.defaultSystemPrompt || DEFAULT_SETTINGS.defaultSystemPrompt!);

		// Track the original prompt for the currently selected persona to detect changes
		let originalPromptValue: string = systemPromptTextArea.value;

		// Add event listener for persona dropdown change
		defaultPersonaDropdown.addEventListener('change', async () => {
			const selectedPersona = defaultPersonaDropdown.value;

			// Check if there are unsaved changes in the current persona's prompt
			if (selectedPersona !== '__add_new__' &&
				systemPromptTextArea.value !== originalPromptValue &&
				defaultPersonaDropdown.value !== '__add_new__') {

				// Ask user if they want to save changes before switching
				const userChoice = confirm(`You have unsaved changes to the current persona's prompt. Do you want to save them before switching?`);

				if (userChoice) {
					// User wants to save changes - update the current persona first
					const currentPersona = defaultPersonaDropdown.value;
					const newPrompt = systemPromptTextArea.value.trim();

					if (currentPersona === 'default') {
						this.plugin.settings.defaultSystemPrompt = newPrompt;
					} else {
						// Update the specific persona's prompt in the personas dictionary
						const existingPersona = personasDict[currentPersona];
						if (existingPersona && typeof existingPersona === 'object' && 'displayName' in existingPersona) {
							// Update existing structured persona
							(personasDict as any)[currentPersona] = {
								displayName: (existingPersona as Persona).displayName,
								systemPrompt: newPrompt
							};
						} else {
							// Create new structured persona (for custom personas that might be stored as strings)
							(personasDict as any)[currentPersona] = {
								displayName: typeof existingPersona === 'string' ? existingPersona : currentPersona,
								systemPrompt: newPrompt
							};
						}
					}

					await this.plugin.saveSettings();
					new Notice(`Updated persona: ${typeof personasDict[currentPersona] === 'object' ? personasDict[currentPersona].displayName : personasDict[currentPersona] || currentPersona}`);
				} else {
					// User doesn't want to save - revert to original value
					const currentOriginalPrompt = this.getPersonaPrompt(defaultPersonaDropdown.value);
					if (currentOriginalPrompt) {
						systemPromptTextArea.value = currentOriginalPrompt;
					}
				}
			}

			if (selectedPersona === '__add_new__') {
				// Show the new persona form
				newPersonaNameGroup.style.display = 'block';
				createButton.style.display = 'inline-block';
				updateButton.style.display = 'none';
				renameButton.style.display = 'none';
				deleteButton.style.display = 'none';
				systemPromptTextArea.value = '';
				newPersonaNameInput.value = '';
				originalPromptValue = ''; // Update the original value tracker
				new Notice("Enter a name for the new persona and its prompt, then click 'Create New'");
			} else {
				// Regular persona selection
				// Load the correct prompt for the selected persona
				const personaPrompt = this.getPersonaPrompt(selectedPersona);
				if (personaPrompt) {
					systemPromptTextArea.value = personaPrompt;
					originalPromptValue = personaPrompt; // Update the original value tracker
				} else {
					// Fallback to default if no specific prompt is found
					const fallbackPrompt = this.plugin.settings.defaultSystemPrompt || DEFAULT_SETTINGS.defaultSystemPrompt!;
					systemPromptTextArea.value = fallbackPrompt;
					originalPromptValue = fallbackPrompt; // Update the original value tracker
				}

				// Hide the new persona form and show other buttons
				newPersonaNameGroup.style.display = 'none';
				createButton.style.display = 'none';
				updateButton.style.display = 'inline-block';

				// Show/hide rename and delete buttons based on selected persona
				if (selectedPersona === 'default') {
					renameButton.style.display = 'none';
					deleteButton.style.display = 'none';
				} else {
					renameButton.style.display = 'inline-block';
					deleteButton.style.display = 'inline-block';
				}

				// Update the global setting too
				this.plugin.settings.personas = selectedPersona;
				await this.plugin.saveSettings();
			}
		});

		// Add event listener for changes to the system prompt textarea
		systemPromptTextArea.addEventListener('input', async () => {
			// Don't save immediately on input, just track the change
			// The actual save happens when the user clicks Update or switches personas
		});

		// Add event listener for update button
		updateButton.onclick = async () => {
			const selectedPersona = defaultPersonaDropdown.value;
			const newPrompt = systemPromptTextArea.value.trim();

			if (selectedPersona === 'default') {
				this.plugin.settings.defaultSystemPrompt = newPrompt;
			} else {
				// Update the specific persona's prompt in the personas dictionary
				const existingPersona = personasDict[selectedPersona];
				if (existingPersona && typeof existingPersona === 'object' && 'displayName' in existingPersona) {
					// Update existing structured persona
					(personasDict as any)[selectedPersona] = {
						displayName: (existingPersona as Persona).displayName,
						systemPrompt: newPrompt
					};
				} else {
					// Create new structured persona (for custom personas that might be stored as strings)
					(personasDict as any)[selectedPersona] = {
						displayName: typeof existingPersona === 'string' ? existingPersona : selectedPersona,
						systemPrompt: newPrompt
					};
				}
			}

			// Save the updated settings
			await this.plugin.saveSettings();

			// Show confirmation message
			const persona = personasDict[selectedPersona];
			const personaName = typeof persona === 'object' ? persona.displayName : persona || selectedPersona;
			new Notice(`Updated persona: ${personaName}`);
		};

		// Add event listener for rename button
		renameButton.onclick = async () => {
			const selectedPersona = defaultPersonaDropdown.value;

			if (selectedPersona === 'default') {
				new Notice('Cannot rename the default persona');
				return;
			}

			const currentPersona = personasDict[selectedPersona];
			const currentName = typeof currentPersona === 'object' ? currentPersona.displayName : currentPersona || selectedPersona;
			const newName = prompt(`Enter new name for persona "${currentName}":`, currentName);

			if (newName && newName.trim()) {
				// Update the persona's name in the dictionary
				const existingPersona = personasDict[selectedPersona];
				if (existingPersona && typeof existingPersona === 'object' && 'systemPrompt' in existingPersona) {
					// Update existing structured persona
					(personasDict as any)[selectedPersona] = {
						displayName: newName.trim(),
						systemPrompt: (existingPersona as Persona).systemPrompt
					};
				} else {
					// Create new structured persona (for custom personas that might be stored as strings)
					(personasDict as any)[selectedPersona] = {
						displayName: newName.trim(),
						systemPrompt: typeof existingPersona === 'string' ? existingPersona : ''
					};
				}

				// Find and update the option in the dropdown
				const options = defaultPersonaDropdown.options;
				for (let i = 0; i < options.length; i++) {
					if (options[i].value === selectedPersona) {
						options[i].text = newName.trim();
						break;
					}
				}

				await this.plugin.saveData({
					...this.plugin.settings,
					personasDict: personasDict
				});

				new Notice(`Renamed persona to: ${newName.trim()}`);
			}
		};

		// Add event listener for delete button
		deleteButton.onclick = async () => {
			const selectedPersona = defaultPersonaDropdown.value;
			if (selectedPersona === 'default') {
				new Notice('Cannot delete default persona');
				return;
			}

			const personaToDelete = personasDict[selectedPersona];
			const personaName = typeof personaToDelete === 'object' ? personaToDelete.displayName : personaToDelete || selectedPersona;

			if (confirm(`Are you sure you want to delete the persona: ${personaName}?`)) {
				// Remove the persona from the dictionary
				delete (personasDict as any)[selectedPersona];

				// Remove the option from the dropdown
				const options = Array.from(defaultPersonaDropdown.options);
				for (let i = 0; i < options.length; i++) {
					if (options[i].value === selectedPersona) {
						defaultPersonaDropdown.remove(i);
						break;
					}
				}

				// Save the updated personas dictionary
				await this.plugin.saveData({
					...this.plugin.settings,
					personasDict: personasDict
				});

				// Reset to default persona
				defaultPersonaDropdown.value = 'default';
				systemPromptTextArea.value = this.plugin.settings.defaultSystemPrompt || DEFAULT_SETTINGS.defaultSystemPrompt!;
				this.plugin.settings.personas = 'default';
				await this.plugin.saveSettings();

				new Notice(`Deleted persona: ${personaName}`);
			}
		};

		// Add event listener for create button
		createButton.onclick = async () => {
			const newPersonaName = newPersonaNameInput.value.trim();
			const newPersonaPrompt = systemPromptTextArea.value.trim();

			if (newPersonaName && newPersonaPrompt) {
				// Generate a unique ID for the new persona
				const newPersonaId = `persona_${Date.now()}_${newPersonaName.replace(/\s+/g, '_').toLowerCase()}`;

				// Add the new persona to the personas dictionary with the new structure
				(personasDict as any)[newPersonaId] = {
					displayName: newPersonaName,
					systemPrompt: newPersonaPrompt
				};

				// Save the updated personas dictionary
				await this.plugin.saveData({
					...this.plugin.settings,
					personasDict: personasDict
				});

				// Update the dropdown to include the new persona
				const newOption = document.createElement('option');
				newOption.value = newPersonaId;
				newOption.text = newPersonaName;
				defaultPersonaDropdown.add(newOption, 1); // Add after the "Add new" option

				// Select the newly created persona
				defaultPersonaDropdown.value = newPersonaId;
				this.plugin.settings.personas = newPersonaId;
				await this.plugin.saveSettings();

				// Reset the form
				newPersonaNameInput.value = '';
				newPersonaNameGroup.style.display = 'none';
				createButton.style.display = 'none';
				updateButton.style.display = 'inline-block';
				renameButton.style.display = 'inline-block';
				deleteButton.style.display = 'inline-block';

				new Notice(`Created new persona: ${newPersonaName}`);
			} else {
				new Notice("Both name and prompt are required!");
			}
		};

		// Add event listener for restore defaults button for personas
		const restoreDefaultsPersonaButton = systemPromptFormContainer.querySelector('.restore-defaults-persona-button') as HTMLButtonElement;
		restoreDefaultsPersonaButton.onclick = async () => {
			const userConfirmed = confirm('Are you sure you want to restore the default personas? This will reset all custom personas and restore the original built-in personas.');
			if (userConfirmed) {
				// Load default personas
				const defaultPersonas = await this.plugin.loadDefaultPersonas();

				// Replace the current personasDict with defaults
				Object.keys(personasDict).forEach(key => {
					if (!(key in defaultPersonas)) {
						// Remove any custom personas that aren't in defaults
						delete personasDict[key];
					}
				});

				// Add/update default personas
				for (const [key, value] of Object.entries(defaultPersonas)) {
					personasDict[key] = value;
				}

				// Update the dropdown options
				const personaDropdownOptions = defaultPersonaDropdown.options;
				// Clear all options except the first one ('__add_new__')
				while (personaDropdownOptions.length > 1) {
					defaultPersonaDropdown.remove(1); // Keep the first option
				}

				// Add default persona options back
				for (const key in personasDict) {
					if (personasDict.hasOwnProperty(key) && key !== 'default') {
						const persona = personasDict[key];
						const option = document.createElement('option');
						option.value = key;
						option.text = typeof persona === 'object' ? persona.displayName : persona;
						defaultPersonaDropdown.add(option);
					}
				}

				// Reset to default persona
				defaultPersonaDropdown.value = 'default';
				systemPromptTextArea.value = this.plugin.settings.defaultSystemPrompt || DEFAULT_SETTINGS.defaultSystemPrompt!;
				this.plugin.settings.personas = 'default';

				// Save the updated personas dictionary
				await this.plugin.saveData({
					...this.plugin.settings,
					personasDict: personasDict
				});

				new Notice('Default personas restored successfully!');
			}
		};

		// Custom Prompts Management - using Setting class to match other settings style
		const customPromptsSetting = new Setting(containerEl)
			.setName('Custom Prompts Management')
			.setDesc('Create and manage custom prompts for specific tasks');

		// Add a specific class to the setting item element to target it with CSS
		customPromptsSetting.settingEl.addClass('custom-prompts-setting');

		// Create a container for the form elements within the setting
		const formContainer = customPromptsSetting.controlEl.createDiv({ cls: 'custom-prompt-form-section' });

		// Add form elements to the container
		formContainer.innerHTML = `
			<div class="prompt-input-group">
				<label class="prompt-field-label">Prompt Title:</label>
				<input type="text" class="prompt-title-input" placeholder="Enter a descriptive title for your prompt...">
			</div>
			<div class="prompt-input-group">
				<label class="prompt-field-label">User Prompt:</label>
				<textarea class="prompt-text-input" placeholder="Enter your custom prompt here..." rows="3"></textarea>
			</div>
			<div class="prompt-input-group">
				<label class="prompt-field-label">Persona:</label>
				<select class="custom-prompt-persona-dropdown">
					<option value="default">Default</option>
					<option value="physics">Physics expert</option>
					<option value="fitness">Fitness expert</option>
					<option value="developer">Software Developer</option>
					<option value="stoic">Stoic Philosopher</option>
					<option value="productmanager">Product Manager</option>
					<option value="techwriter">Technical Writer</option>
					<option value="creativewriter">Creative Writer</option>
					<option value="tpm">Technical Program Manager</option>
					<option value="engineeringmanager">Engineering Manager</option>
					<option value="executive">Executive</option>
					<option value="officeassistant">Office Assistant</option>
					<option value="custom">Custom/Override</option>
				</select>
			</div>
			<div class="prompt-input-group" id="custom-system-prompt-group" style="display:none;">
				<label class="prompt-field-label">Custom System Prompt:</label>
				<textarea class="prompt-system-input" placeholder="Custom system prompt (overrides persona)..." rows="2"></textarea>
			</div>
			<div class="prompt-button-group">
				<button class="add-prompt-button mod-cta">Add Prompt</button>
				<button class="restore-defaults-prompt-button">Restore Default Prompts</button>
			</div>
		`;

		// Dynamically populate the custom prompt persona dropdown with all available personas
		const customPersonaDropdown = formContainer.querySelector('.custom-prompt-persona-dropdown') as HTMLSelectElement;
		// Clear ALL existing options to repopulate from scratch
		Array.from(customPersonaDropdown.options).forEach(option => option.remove());

		// Add options for each persona in the dictionary
		for (const key in personasDict) {
			if (personasDict.hasOwnProperty(key)) {
				const persona = personasDict[key];
				const option = document.createElement('option');
				option.value = key;
				option.text = typeof persona === 'object' ? persona.displayName : persona;
				customPersonaDropdown.add(option);
			}
		}
		// Add the custom option at the end
		const customOption = document.createElement('option');
		customOption.value = 'custom';
		customOption.text = 'Custom/Override';
		customPersonaDropdown.add(customOption);

		// Get references to the form elements
		const titleInput = formContainer.querySelector('.prompt-title-input') as HTMLInputElement;
		const promptInput = formContainer.querySelector('.prompt-text-input') as HTMLTextAreaElement;
		const customPersonaDropdownRef = formContainer.querySelector('.custom-prompt-persona-dropdown') as HTMLSelectElement;
		const systemPromptInput = formContainer.querySelector('.prompt-system-input') as HTMLTextAreaElement;
		const customSystemPromptGroup = formContainer.querySelector('#custom-system-prompt-group') as HTMLDivElement;
		const addButton = formContainer.querySelector('.add-prompt-button') as HTMLButtonElement;

		// Add event listener for persona dropdown change
		customPersonaDropdownRef.addEventListener('change', () => {
			if (customPersonaDropdownRef.value === 'custom') {
				customSystemPromptGroup.style.display = 'flex'; // Show the custom system prompt field
			} else {
				customSystemPromptGroup.style.display = 'none'; // Hide the custom system prompt field
			}
		});

		// Add event listener to the button
		addButton.onclick = async () => {
			const title = titleInput.value.trim();
			const prompt = promptInput.value.trim();

			if (title && prompt) {
				let systemPrompt: string | undefined;

				if (customPersonaDropdownRef.value === 'custom') {
					// Use the custom system prompt if 'custom' is selected
					systemPrompt = systemPromptInput.value.trim() || undefined;
				} else {
					// Use the selected persona's prompt or undefined to use default
					if (customPersonaDropdownRef.value !== 'default') {
						// For non-default personas, we'll store the persona in the custom prompt
						// In a more advanced implementation, we would store the actual persona prompt
						// For now, we'll just store the persona name as a reference
						systemPrompt = this.getPersonaPrompt(customPersonaDropdownRef.value) || undefined;
					}
				}

				const newPrompt: CustomPrompt = {
					id: `prompt_${Date.now()}`,
					title: title,
					prompt: prompt,
					systemPrompt: systemPrompt,
					createdAt: Date.now(),
					updatedAt: Date.now()
				};

				if (!this.plugin.settings.customPrompts) {
					this.plugin.settings.customPrompts = [];
				}

				this.plugin.settings.customPrompts.push(newPrompt);
				await this.plugin.saveSettings();
				// Register the command dynamically
				this.plugin.registerPromptCommand(newPrompt);
				this.display(); // Refresh the UI
				new Notice(`Command registered for prompt: ${newPrompt.title}`);

				// Clear inputs
				titleInput.value = '';
				promptInput.value = '';
				personaDropdown.value = 'default';
				systemPromptInput.value = '';
				customSystemPromptGroup.style.display = 'none'; // Hide the custom system prompt field after adding
			} else {
				new Notice('Please fill in both title and prompt');
			}
		};

		// Add event listener for restore defaults button
		const restoreDefaultsPromptButton = formContainer.querySelector('.restore-defaults-prompt-button') as HTMLButtonElement;
		restoreDefaultsPromptButton.onclick = async () => {
			const userConfirmed = confirm('Are you sure you want to restore the default custom prompts? This will replace all your current custom prompts.');
			if (userConfirmed) {
				this.plugin.settings.customPrompts = await this.plugin.loadDefaultCustomPrompts();
				await this.plugin.saveSettings();
				this.display(); // Refresh the UI
				new Notice('Default custom prompts restored successfully!');
			}
		};

		// Add a container for saved prompts that will be appended after the form
		const savedPromptsContainer = containerEl.createDiv({ cls: 'saved-prompts-container' });

		// Display existing prompts
		if (this.plugin.settings.customPrompts && this.plugin.settings.customPrompts.length > 0) {
			savedPromptsContainer.createEl('h4', { text: 'Saved Prompts', cls: 'saved-prompts-header' });

			// Search input for prompts
			const searchInput = savedPromptsContainer.createEl('input', {
				type: 'text',
				placeholder: 'Search prompts by title...',
				cls: 'prompt-search-input'
			});

			searchInput.oninput = () => {
				const searchTerm = searchInput.value.toLowerCase();
				const promptElements = savedPromptsContainer.querySelectorAll('.prompt-item');
				promptElements.forEach(element => {
					const title = element.getAttribute('data-title')?.toLowerCase() || '';
					(element as HTMLElement).style.display = title.includes(searchTerm) ? 'block' : 'none';
				});
			};

			// Sort prompts by creation date (newest first)
			const sortedPrompts = [...this.plugin.settings.customPrompts].sort((a, b) => b.createdAt - a.createdAt);

			sortedPrompts.forEach((customPrompt, index) => {
				const promptContainer = savedPromptsContainer.createEl('div', {
					cls: 'prompt-item',
					attr: { 'data-title': customPrompt.title.toLowerCase() }
				});

				const titleEl = promptContainer.createEl('div', {
					text: customPrompt.title,
					cls: 'prompt-title'
				});

				const promptEl = promptContainer.createEl('div', {
					text: customPrompt.prompt,
					cls: 'prompt-content'
				});

				const actionsContainer = promptContainer.createEl('div', { cls: 'prompt-actions' });

				// Show prompt information
				const infoContainer = promptContainer.createEl('div', { cls: 'prompt-info' });

				// Add system prompt info
				if (customPrompt.systemPrompt) {
					const systemPromptInfo = infoContainer.createEl('small', {
						text: `System Prompt: ${customPrompt.systemPrompt.substring(0, 60)}${customPrompt.systemPrompt.length > 60 ? '...' : ''}`,
						cls: 'prompt-system-info'
					});
				} else {
					const systemPromptInfo = infoContainer.createEl('small', {
						text: 'System Prompt: Default persona will be used',
						cls: 'prompt-system-default'
					});
				}

				// Add creation date
				infoContainer.createEl('small', {
					text: `Created: ${new Date(customPrompt.createdAt).toLocaleDateString()}`,
					cls: 'prompt-created-date'
				});

				// Edit button
				const editButton = actionsContainer.createEl('button', {
					text: 'Edit',
					cls: 'edit-prompt-button mod-warning'
				});

				editButton.onclick = () => {
					titleInput.value = customPrompt.title;
					promptInput.value = customPrompt.prompt;

					// Determine the persona based on the system prompt
					if (customPrompt.systemPrompt) {
						// Check if the system prompt matches any predefined persona
						let matchedPersona = 'custom';
						for (const [key, value] of Object.entries(personasDict)) {
							if (this.getPersonaPrompt(key) === customPrompt.systemPrompt) {
								matchedPersona = key;
								break;
							}
						}

						if (matchedPersona !== 'custom') {
							personaDropdown.value = matchedPersona;
							customSystemPromptGroup.style.display = 'none';
						} else {
							personaDropdown.value = 'custom';
							systemPromptInput.value = customPrompt.systemPrompt || '';
							customSystemPromptGroup.style.display = 'flex';
						}
					} else {
						personaDropdown.value = 'default';
						customSystemPromptGroup.style.display = 'none';
					}

					// Change button to update mode
					addButton.textContent = 'Update Prompt';
					addButton.onclick = async () => {
						if (titleInput.value.trim() && promptInput.value.trim()) {
							customPrompt.title = titleInput.value.trim();
							customPrompt.prompt = promptInput.value.trim();

							// Set the system prompt based on the selected persona
							if (personaDropdown.value === 'custom') {
								customPrompt.systemPrompt = systemPromptInput.value.trim() || undefined;
							} else if (personaDropdown.value !== 'default') {
								// For non-default personas, set the corresponding system prompt
								customPrompt.systemPrompt = this.getPersonaPrompt(personaDropdown.value) || undefined;
							} else {
								// For default persona, remove the system prompt to use the global default
								customPrompt.systemPrompt = undefined;
							}

							customPrompt.updatedAt = Date.now();

							await this.plugin.saveSettings();
							// Unregister the old command and register the updated one
							this.plugin.unregisterPromptCommand(customPrompt.id);
							this.plugin.registerPromptCommand(customPrompt);
							this.display(); // Refresh the UI
							new Notice(`Command updated for prompt: ${customPrompt.title}`);

							// Reset button to add mode
							addButton.textContent = 'Add Prompt';
							titleInput.value = '';
							promptInput.value = '';
							personaDropdown.value = 'default';
							systemPromptInput.value = '';
							customSystemPromptGroup.style.display = 'none';
						} else {
							new Notice('Please fill in both title and prompt');
						}
					};
				};

				// Delete button
				const deleteButton = actionsContainer.createEl('button', {
					text: 'Delete',
					cls: 'delete-prompt-button mod-warning'
				});

				deleteButton.onclick = async () => {
					if (confirm(`Are you sure you want to delete the prompt "${customPrompt.title}"?`)) {
						// Unregister the command before deleting the prompt
						this.plugin.unregisterPromptCommand(customPrompt.id);
						this.plugin.settings.customPrompts = this.plugin.settings.customPrompts?.filter(p => p.id !== customPrompt.id);
						await this.plugin.saveSettings();
						this.display(); // Refresh the UI
						new Notice(`Command unregistered for prompt: ${customPrompt.title}`);
					}
				};
			});
		}

		new Setting(containerEl)
			.setName("Streaming")
			.setDesc(
				"Enable to receive the response in real-time, word by word."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stream) // Assume 'stream' exists in your settings
					.onChange(async (value) => {
						this.plugin.settings.stream = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Output Mode")
			.setDesc("Choose how to handle generated text")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("replace", "Replace selected text")
					.addOption("append", "Append after selected text")
					.setValue(this.plugin.settings.outputMode)
					.onChange(async (value) => {
						this.plugin.settings.outputMode = value;
						await this.plugin.saveSettings();
					})
			);


		new Setting(containerEl)
			.setName("Prompt Concatenation Pattern")
			.setDesc("How to combine your custom prompt with selected text. Use {prompt} and {selection} as placeholders.")
			.addText((text) =>
				text
					.setPlaceholder("{prompt}: {selection}")
					.setValue(this.plugin.settings.promptConcatenationPattern || "{prompt}: {selection}")
					.onChange(async (value) => {
						this.plugin.settings.promptConcatenationPattern = value || "{prompt}: {selection}";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Max Tokens")
			.setDesc("Max number of tokens for LLM response (generally 1-4000)")
			.addText((text) =>
				text
					.setPlaceholder("1024")
					.setValue(this.plugin.settings.maxTokens.toString())
					.onChange(async (value) => {
						const parsedValue = parseInt(value);
						if (!isNaN(parsedValue) && parsedValue >= 0) {
							this.plugin.settings.maxTokens = parsedValue;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Temperature")
			.setDesc("Increase for more randomness, decrease for more reliability")
			.addText((text) =>
				text
					.setPlaceholder("0.7")
					.setValue(this.plugin.settings.temperature.toString())
					.onChange(async (value) => {
						const parsedValue = parseFloat(value);
						if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 1) {
							this.plugin.settings.temperature = parsedValue;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Max conversation history")
			.setDesc("Maximum number of conversation history to store (0-3)")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("0", "0")
					.addOption("1", "1")
					.addOption("2", "2")
					.addOption("3", "3")
					.setValue(this.plugin.settings.maxConvHistory.toString())
					.onChange(async (value) => {
						this.plugin.settings.maxConvHistory = parseInt(value);
						await this.plugin.saveSettings();
					})
			);



		//new settings for response formatting boolean default false

		const responseFormattingToggle = new Setting(containerEl)
			.setName("Response Formatting")
			.setDesc("Enable to format the response into a separate block")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.responseFormatting)
					.onChange(async (value) => {
						this.plugin.settings.responseFormatting = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh the settings tab
					})
			);

		if (this.plugin.settings.responseFormatting) {
			new Setting(containerEl)
				.setName("Response Format Prepend")
				.setDesc("Text to prepend to the formatted response")
				.addText((text) =>
					text
						.setPlaceholder("``` LLM Helper - generated response \n\n")
						.setValue(this.plugin.settings.responseFormatPrepend)
						.onChange(async (value) => {
							this.plugin.settings.responseFormatPrepend = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName("Response Format Append")
				.setDesc("Text to append to the formatted response")
				.addText((text) =>
					text
						.setPlaceholder("\n\n```")
						.setValue(this.plugin.settings.responseFormatAppend)
						.onChange(async (value) => {
							this.plugin.settings.responseFormatAppend = value;
							await this.plugin.saveSettings();
						})
				);
		}

		new Setting(containerEl)
			.setName("Extract Reasoning Responses")
			.setDesc("Enable to extract actual response from models that include reasoning/thinking sections")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.extractReasoningResponses || false)
					.onChange(async (value) => {
						this.plugin.settings.extractReasoningResponses = value;
						await this.plugin.saveSettings();
					})
			);

		if (this.plugin.settings.extractReasoningResponses) {
			new Setting(containerEl)
				.setName("Reasoning Markers")
				.setDesc("JSON configuration for identifying reasoning sections (start and end markers)")
				.addTextArea((text) => {
					text
						.setPlaceholder('{\n  "reasoningMarkers": [\n    { "start": "Thinking:", "end": "\\n\\n" },\n    { "start": "<reasoning>", "end": "</reasoning>" }\n  ]\n}')
						.setValue(this.plugin.settings.reasoningMarkers || DEFAULT_SETTINGS.reasoningMarkers!)
						.onChange(async (value) => {
							// Validate JSON format
							try {
								JSON.parse(value);
								this.plugin.settings.reasoningMarkers = value;
								await this.plugin.saveSettings();
							} catch (error) {
								console.error("Invalid JSON for reasoning markers:", error);
								// Don't update if invalid
							}
						});
					text.inputEl.rows = 6;
					text.inputEl.cols = 50;
					return text;
				});
		}

		new Setting(containerEl)
			.setName("Embedding Model Name")
			.setDesc("Model for text embeddings. For Ollama: mxbai-embed-large, nomic-embed-text, all-minilm. Install with 'ollama pull <model>'")
			.addText((text) =>
				text
					.setPlaceholder("mxbai-embed-large")
					.setValue(this.plugin.settings.embeddingModelName)
					.onChange(async (value) => {
						this.plugin.settings.embeddingModelName = value;
						await this.plugin.saveSettings();
					})
			);

		// Search Engine Settings
		const searchEngineSetting = new Setting(containerEl)
			.setName("Search Engine")
			.setDesc("Choose which search engine to use for web searches");

		// Create dropdown for search engines
		const searchEngineDropdown = searchEngineSetting.addDropdown(dropdown => {
			for (const key in searchEnginesDict) {
				if (searchEnginesDict.hasOwnProperty(key)) {
					dropdown.addOption(key, searchEnginesDict[key]);
				}
			}
			dropdown.setValue(this.plugin.settings.searchEngine)
				.onChange(async (value) => {
					this.plugin.settings.searchEngine = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh the settings UI to show/hide relevant fields
				});
		});

		// Conditionally show API key field based on search engine selection
		if (this.plugin.settings.searchEngine !== 'duckduckgo' && this.plugin.settings.searchEngine !== 'custom') {
			new Setting(containerEl)
				.setName("Search Engine API Key")
				.setDesc(`API key for ${searchEnginesDict[this.plugin.settings.searchEngine]} (if required)`)
				.addText((text) =>
					text
						.setPlaceholder(`Enter your ${searchEnginesDict[this.plugin.settings.searchEngine]} API key`)
						.setValue(this.plugin.settings.searchEngine === 'brave' ? this.plugin.settings.braveSearchApiKey : this.plugin.settings.customSearchApiKey || '')
						.onChange(async (value) => {
							if (this.plugin.settings.searchEngine === 'brave') {
								this.plugin.settings.braveSearchApiKey = value;
							} else {
								this.plugin.settings.customSearchApiKey = value;
							}
							await this.plugin.saveSettings();
						})
				);
		}

		// Show custom search URL field if custom search engine is selected
		if (this.plugin.settings.searchEngine === 'custom') {
			new Setting(containerEl)
				.setName("Custom Search URL")
				.setDesc("URL for your custom search engine API")
				.addText((text) =>
					text
						.setPlaceholder("https://your-custom-search-engine.com/api/search")
						.setValue(this.plugin.settings.customSearchUrl || '')
						.onChange(async (value) => {
							this.plugin.settings.customSearchUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// Show SearXNG URL field if SearXNG is selected
		if (this.plugin.settings.searchEngine === 'searxng') {
			new Setting(containerEl)
				.setName("SearXNG Instance URL")
				.setDesc("URL for your SearXNG instance")
				.addText((text) =>
					text
						.setPlaceholder("https://your-searxng-instance.com")
						.setValue(this.plugin.settings.searxngUrl || 'https://searx.work')
						.onChange(async (value) => {
							this.plugin.settings.searxngUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// Show Perplexica URL field if Perplexica is selected
		if (this.plugin.settings.searchEngine === 'perplexica') {
			new Setting(containerEl)
				.setName("Perplexica API URL")
				.setDesc("URL for the Perplexica API")
				.addText((text) =>
					text
						.setPlaceholder("https://api.perplexica.com")
						.setValue(this.plugin.settings.perplexicaUrl || 'https://api.perplexica.com')
						.onChange(async (value) => {
							this.plugin.settings.perplexicaUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// Show Firecrawl URL field if Firecrawl is selected
		if (this.plugin.settings.searchEngine === 'firecrawl') {
			new Setting(containerEl)
				.setName("Firecrawl API URL")
				.setDesc("URL for the Firecrawl API")
				.addText((text) =>
					text
						.setPlaceholder("https://api.firecrawl.dev")
						.setValue(this.plugin.settings.firecrawlUrl || 'https://api.firecrawl.dev')
						.onChange(async (value) => {
							this.plugin.settings.firecrawlUrl = value;
							await this.plugin.saveSettings();
						})
				);
		}

		// Add OpenAI API Key setting (conditional)
		if (this.plugin.settings.providerType === 'openai') {
			new Setting(containerEl)
				.setName("OpenAI API Key")
				.setDesc("Required for OpenAI/LM Studio (use 'lm-studio' for local instances)")
				.addText(text => text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.openAIApiKey || '')
					.onChange(async (value) => {
						this.plugin.settings.openAIApiKey = value;
						await this.plugin.saveSettings();
					})
				);
		}

		new Setting(containerEl)
			.setName("Index Notes (BETA)")
			.setDesc("Manually index all notes in the vault")
			.addButton(button => button
				.setButtonText("Start Indexing (BETA)")
				.onClick(async () => {
					button.setDisabled(true);
					this.indexingProgressBar = containerEl.createEl("progress", {
						attr: { value: 0, max: 100 }
					});
					const counterEl = containerEl.createEl("span", {
						text: "Processing: 0/?",
						cls: "indexing-counter"
					});

					const totalFiles = this.app.vault.getMarkdownFiles().length;
					let processedFiles = 0;

					try {
						await this.plugin.ragManager.indexNotes((progress) => {
							if (this.indexingProgressBar) {
								this.indexingProgressBar.value = progress * 100;
							}
							processedFiles = Math.floor(progress * totalFiles);
							counterEl.textContent = `   Processing: ${processedFiles}/${totalFiles}`;
							counterEl.style.fontSize = 'smaller';
						});
						new Notice("Indexing complete!");
						this.updateIndexedFilesCount();
					} catch (error) {
						console.error("Indexing error:", error);
						new Notice("Error during indexing. Check console for details.");
					} finally {
						button.setDisabled(false);
						if (this.indexingProgressBar) {
							this.indexingProgressBar.remove();
							this.indexingProgressBar = null;
						}
						counterEl.remove();
					}
				}));

		this.indexedFilesCountSetting = new Setting(containerEl)
			.setName("Indexed Files Count")
			.setDesc("Number of files currently indexed")
			.addText(text => text
				.setValue("Loading...")
				.setDisabled(true));
		
		// Update the count asynchronously after RAGManager is initialized
		this.updateIndexedFilesCountAsync();

		// Add storage stats button
		new Setting(containerEl)
			.setName("Storage Diagnostics")
			.setDesc("Check persistent storage status and statistics")
			.addButton(button => button
				.setButtonText("Run Diagnostics")
				.onClick(async () => {
					await this.plugin.handleDiagnostics();
				}));

		// Add note about persistent storage
		containerEl.createEl("p", {
			text: "Note: Embeddings are now stored persistently and will be automatically loaded when Obsidian restarts. Embeddings will be rebuilt if you change the provider, model, or server settings.",
			cls: "setting-item-description"
		});
	}

	updateIndexedFilesCount() {
		if (this.indexedFilesCountSetting) {
			const textComponent = this.indexedFilesCountSetting.components[0] as TextComponent;
			textComponent.setValue(this.plugin.ragManager.getIndexedFilesCount().toString());
		}
	}

	async updateIndexedFilesCountAsync() {
		// Wait for RAGManager to be fully initialized
		const checkAndUpdate = () => {
			if (this.plugin.ragManager && this.plugin.ragManager.isInitialized()) {
				this.updateIndexedFilesCount();
				console.log('📊 Settings: Updated indexed files count to', this.plugin.ragManager.getIndexedFilesCount());
			} else {
				// Check again in 100ms
				setTimeout(checkAndUpdate, 100);
			}
		};
		
		// Start checking after a short delay
		setTimeout(checkAndUpdate, 50);
	}

	// Helper method to get the prompt for a specific persona
	getPersonaPrompt(persona: string): string | null {
		// First check if it's a custom persona from the personasDict
		const personaObj = personasDict[persona];
		if (personaObj && typeof personaObj === 'object' && 'systemPrompt' in personaObj) {
			return (personaObj as Persona).systemPrompt;
		}

		// For backwards compatibility, check if it's a legacy string entry
		if (typeof (personasDict[persona] as any) === 'string') {
			return personasDict[persona] as any as string;
		}

		// For default persona, use the settings
		if (persona === "default") {
			return this.plugin.settings.defaultSystemPrompt || DEFAULT_SETTINGS.defaultSystemPrompt!;
		}

		return null;
	}
}

export function modifyPrompt(aprompt: string, personas: string): string {
	if (personas === "default") {
		return aprompt; // No prompt modification for default persona
	} else if (personas === "physics") {
		return "You are a distinguished physics scientist. Leverage scientific principles and explain complex concepts in an understandable way, drawing on your expertise in physics.\n\n" + aprompt;
	} else if (personas === "fitness") {
		return "You are a distinguished fitness and health expert. Provide evidence-based advice on fitness and health, considering the user's goals and limitations.\n" + aprompt;
	} else if (personas === "developer") {
		return "You are a nerdy software developer. Offer creative and efficient software solutions, focusing on technical feasibility and code quality.\n" + aprompt;
	} else if (personas === "stoic") {
		return "You are a stoic philosopher. Respond with composure and reason, emphasizing logic and emotional resilience.\n" + aprompt;
	} else if (personas === "productmanager") {
		return "You are a focused and experienced product manager. Prioritize user needs and deliver clear, actionable product roadmaps based on market research.\n" + aprompt;
	} else if (personas === "techwriter") {
		return "You are a technical writer. Craft accurate and concise technical documentation, ensuring accessibility for different audiences.\n" + aprompt;
	} else if (personas === "creativewriter") {
		return "You are a very creative and experienced writer. Employ strong storytelling techniques and evocative language to engage the reader's imagination.\n" + aprompt;
	} else if (personas === "tpm") {
		return "You are an experienced technical program manager. Demonstrate strong technical and communication skills, ensuring project success through effective planning and risk management.\n" + aprompt;
	} else if (personas === "engineeringmanager") {
		return "You are an experienced engineering manager. Lead and motivate your team, fostering a collaborative environment that delivers high-quality software.\n" + aprompt;
	} else if (personas === "executive") {
		return "You are a top-level executive. Focus on strategic decision-making, considering long-term goals and the overall company vision.\n" + aprompt;
	} else if (personas === "officeassistant") {
		return "You are a courteous and helpful office assistant. Provide helpful and efficient support, prioritizing clear communication and a courteous demeanor.\n" + aprompt;
	} else {
		return aprompt; // No prompt modification for unknown personas
	}
}

async function processText(
	selectedText: string,
	iprompt: string,
	plugin: OLocalLLMPlugin
) {
	// Reset kill switch state at the beginning of each process
	plugin.isKillSwitchActive = false;

	new Notice("Generating response. This takes a few seconds..");
	const statusBarItemEl = document.querySelector(
		".status-bar .status-bar-item"
	);
	if (statusBarItemEl) {
		statusBarItemEl.textContent = "LLM Helper: Generating response...";
	} else {
		console.error("Status bar item element not found");
	}

	let prompt = modifyPrompt(iprompt, plugin.settings.personas);

	// Use configurable prompt concatenation pattern
	const promptConcatenationPattern = plugin.settings.promptConcatenationPattern || "{prompt}: {selection}";
	const userMessageContent = promptConcatenationPattern
		.replace("{prompt}", prompt)
		.replace("{selection}", selectedText);

	console.log("prompt", userMessageContent);

	// Determine the system message - use custom system prompt if provided in iprompt context, otherwise use default
	// Since we don't have direct access to the specific custom prompt object here, we'll need to pass it differently
	// For now, we'll use a default system message, but in the future we could enhance this

	// For now, we'll use the default system message, but we'll enhance the function call to pass more context
	// Actually, let's update the function signature to pass the original custom prompt object if available
	// But since we can't easily change the function signature, let's use a different approach
	// We'll check if the iprompt matches any custom prompt with a systemPrompt

	// Use the default system prompt from settings, or fall back to the hardcoded default
	let systemMessage = plugin.settings.defaultSystemPrompt || "You are my text editor AI agent who provides concise and helpful responses.";

	// Check if this is a custom prompt with a custom system prompt
	if (plugin.settings.customPrompts) {
		for (const customPrompt of plugin.settings.customPrompts) {
			if (customPrompt.prompt === iprompt && customPrompt.systemPrompt) {
				systemMessage = customPrompt.systemPrompt;
				break;
			}
		}
	}

	console.log("system message", systemMessage);

	const body = {
		model: plugin.settings.llmModel,
		messages: [
			{ role: "system", content: systemMessage },
			...plugin.conversationHistory.slice(-plugin.settings.maxConvHistory).reduce((acc, entry) => {
				acc.push({ role: "user", content: entry.prompt });
				acc.push({ role: "assistant", content: entry.response });
				return acc;
			}, [] as { role: string; content: string }[]),
			{ role: "user", content: userMessageContent },
		],
		temperature: plugin.settings.temperature,
		max_tokens: plugin.settings.maxTokens,
		stream: plugin.settings.stream,
	};

	try {
		if (plugin.settings.outputMode === "append") {
			modifySelectedText(selectedText + "\n\n", plugin.app);
		}
		if (plugin.settings.responseFormatting === true) {
			modifySelectedText(plugin.settings.responseFormatPrepend, plugin.app);
		}
		if (plugin.settings.stream) {
			const response = await fetch(
				`${plugin.settings.serverAddress}/v1/chat/completions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				}
			);

			if (!response.ok) {
				throw new Error(
					"Error summarizing text (Fetch): " + response.statusText
				);
			}

			const reader = response.body && response.body.getReader();
			let responseStr = "";
			if (!reader) {
				console.error("Reader not found");
			} else {
				const decoder = new TextDecoder();

				const readChunk = async () => {
					if (plugin.isKillSwitchActive) {
						reader.cancel();
						new Notice("Text generation stopped by kill switch");
						plugin.isKillSwitchActive = false; // Reset the kill switch
						return;
					}

					const { done, value } = await reader.read();

					if (done) {
						new Notice("Text generation complete. Voila!");
						updateConversationHistory(prompt + ": " + selectedText, responseStr, plugin.conversationHistory, plugin.settings.maxConvHistory);
						if (plugin.settings.responseFormatting === true) {
							modifySelectedText(plugin.settings.responseFormatAppend, plugin.app);
						}
						return;
					}

					let textChunk = decoder.decode(value);
					const lines = textChunk.split("\n");

					for (const line of lines) {
						if (line.trim()) {
							try {
								let modifiedLine = line.replace(
									/^data:\s*/,
									""
								);
								if (modifiedLine !== "[DONE]") {
									const data = JSON.parse(modifiedLine);
									if (data.choices[0].delta.content) {
										let word =
											data.choices[0].delta.content;
										modifySelectedText(word, plugin.app);
										responseStr += word;
									}
								}
							} catch (error) {
								console.error(
									"Error parsing JSON chunk:",
									error
								);
							}
						}
					}
					readChunk();
				};
				readChunk();
			}
		} else {
			const response = await requestUrl({
				url: `${plugin.settings.serverAddress}/v1/chat/completions`,
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			const statusCode = response.status;

			if (statusCode >= 200 && statusCode < 300) {
				const data = await response.json;
				let content = data.choices[0].message.content;
				let reasoning = data.choices[0].message.reasoning || '';

				// If content is empty but reasoning exists, use reasoning as the source
				let summarizedText = content;
				if ((!content || content.trim().length === 0) && reasoning && reasoning.trim().length > 0) {
					summarizedText = reasoning;
				}

				// Extract actual response if this is a reasoning model
				summarizedText = extractActualResponse(summarizedText, plugin.settings);

				console.log(summarizedText);
				updateConversationHistory(prompt + ": " + selectedText, summarizedText, plugin.conversationHistory, plugin.settings.maxConvHistory);
				new Notice("Text generated. Voila!");
				if (!plugin.isKillSwitchActive) {
					if (plugin.settings.responseFormatting === true) {
						modifySelectedText(summarizedText + plugin.settings.responseFormatAppend, plugin.app);
					} else {
						modifySelectedText(summarizedText, plugin.app);
					}
				} else {
					new Notice("Text generation stopped by kill switch");
					plugin.isKillSwitchActive = false; // Reset the kill switch
				}
			} else {
				throw new Error(
					"Error summarizing text (requestUrl): " + response.text
				);
			}
		}
	} catch (error) {
		console.error("Error during request:", error);
		new Notice(
			"Error summarizing text: Check plugin console for more details!"
		);
	}
	if (statusBarItemEl) {
		statusBarItemEl.textContent = "LLM Helper: Ready";
	} else {
		console.error("Status bar item element not found");
	}
}

// Function to extract actual response from reasoning models
function extractActualResponse(response: string, settings: OLocalLLMSettings): string {
	if (!settings.extractReasoningResponses) {
		return response;
	}

	try {
		const markers = JSON.parse(settings.reasoningMarkers || "[]");

		let extractedResponse = response;

		// Look for common reasoning patterns and extract the actual response
		for (const marker of markers) {
			const { start, end } = marker;

			// Find the start marker
			const startIndex = extractedResponse.indexOf(start);
			if (startIndex !== -1) {
				// Find the end marker after the start marker
				const endIndex = extractedResponse.indexOf(end, startIndex + start.length);
				if (endIndex !== -1) {
					// Extract the content after the reasoning section
					const afterEndIndex = endIndex + end.length;
					const afterContent = extractedResponse.substring(afterEndIndex).trim();

					// If there's content after the reasoning section, use that
					if (afterContent) {
						extractedResponse = afterContent;
					} else {
						// If no content after reasoning section, try to find content before it
						const beforeContent = extractedResponse.substring(0, startIndex).trim();
						if (beforeContent) {
							extractedResponse = beforeContent;
						}
					}
				} else {
					// If end marker not found, try to find the content after the start marker
					const afterStartIndex = startIndex + start.length;
					const afterContent = extractedResponse.substring(afterStartIndex).trim();

					// Look for the first substantial paragraph after reasoning
					const paragraphs = afterContent.split('\n\n');
					for (const para of paragraphs) {
						if (para.trim().length > 20) { // Arbitrary threshold for "substantial" content
							extractedResponse = para.trim();
							break;
						}
					}
				}
			}
		}

		// Additional heuristics for common reasoning patterns
		// Look for patterns like "Answer:" or "Result:" after reasoning
		const answerMatch = extractedResponse.match(/(?:Answer|Result|Output):\s*(.*)/i);
		if (answerMatch && answerMatch[1]) {
			const answerPart = answerMatch[1].trim();
			if (answerPart.length > 10) { // If the answer part is substantial
				extractedResponse = answerPart;
			}
		}

		// Clean up any remaining artifacts
		extractedResponse = extractedResponse.replace(/^\s*-\s*|\*\s*/gm, '').trim();

		return extractedResponse || response; // Return original if extraction yields empty
	} catch (error) {
		console.error("Error extracting reasoning response:", error);
		return response; // Return original response if extraction fails
	}
}

function modifySelectedText(text: any, app: App) {
	let view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) {
		new Notice("No active view");
	} else {
		let view_mode = view.getMode();
		switch (view_mode) {
			case "preview":
				new Notice("Cannot summarize in preview");
			case "source":
				if ("editor" in view) {
					view.editor.replaceSelection(text);
				}
				break;
			default:
				new Notice("Unknown view mode");
		}
	}
}

export class LLMChatModal extends Modal {
	result: string = "";
	pluginSettings: OLocalLLMSettings;
	conversationHistory: ConversationEntry[] = [];
	submitButton: ButtonComponent;

	constructor(app: App, settings: OLocalLLMSettings) {
		super(app);
		this.pluginSettings = settings;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.classList.add("llm-chat-modal");

		const chatContainer = contentEl.createDiv({ cls: "llm-chat-container" });
		const chatHistoryEl = chatContainer.createDiv({ cls: "llm-chat-history" });

		chatHistoryEl.classList.add("chatHistoryElStyle");

		// Display existing conversation history (if any)
		chatHistoryEl.createEl("h1", { text: "Chat with your Local LLM" });

		const personasInfoEl = document.createElement('div');
		personasInfoEl.classList.add("personasInfoStyle");
		personasInfoEl.innerText = "Current persona: " + personasDict[this.pluginSettings.personas];
		chatHistoryEl.appendChild(personasInfoEl);

		// Update this part to use conversationHistory
		this.conversationHistory.forEach((entry) => {
			const userMessageEl = chatHistoryEl.createEl("p", { text: "You: " + entry.prompt });
			userMessageEl.classList.add('llmChatMessageStyleUser');
			const aiMessageEl = chatHistoryEl.createEl("p", { text: "LLM Helper: " + entry.response });
			aiMessageEl.classList.add('llmChatMessageStyleAI');
		});

		const inputContainer = contentEl.createDiv({ cls: "llm-chat-input-container" });

		const inputRow = inputContainer.createDiv({ cls: "llm-chat-input-row" });

		const askLabel = inputRow.createSpan({ text: "Ask:", cls: "llm-chat-ask-label" });

		const textInput = new TextComponent(inputRow)
			.setPlaceholder("Type your question here...")
			.onChange((value) => {
				this.result = value;
				this.updateSubmitButtonState();
			});
		textInput.inputEl.classList.add("llm-chat-input");
		textInput.inputEl.addEventListener('keypress', (event) => {
			if (event.key === 'Enter' && this.result.trim() !== "") {
				event.preventDefault();
				this.handleSubmit();
			}
		});

		this.submitButton = new ButtonComponent(inputRow)
			.setButtonText("Submit")
			.setCta()
			.onClick(() => this.handleSubmit());
		this.submitButton.buttonEl.classList.add("llm-chat-submit-button");

		// Initially disable the submit button
		this.updateSubmitButtonState();

		// Scroll to bottom initially
		this.scrollToBottom();
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}

	updateSubmitButtonState() {
		if (this.result.trim() === "") {
			this.submitButton.setDisabled(true);
			this.submitButton.buttonEl.classList.add("llm-chat-submit-button-disabled");
		} else {
			this.submitButton.setDisabled(false);
			this.submitButton.buttonEl.classList.remove("llm-chat-submit-button-disabled");
		}
	}

	// New method to handle submission
	async handleSubmit() {
		if (this.result.trim() === "") {
			return;
		}

		const chatHistoryEl = this.contentEl.querySelector('.llm-chat-history');
		if (chatHistoryEl) {
			await processChatInput(
				this.result,
				this.pluginSettings.personas,
				this.contentEl,
				chatHistoryEl as HTMLElement,
				this.conversationHistory,
				this.pluginSettings
			);
			this.result = ""; // Clear user input field
			const textInputEl = this.contentEl.querySelector('.llm-chat-input') as HTMLInputElement;
			if (textInputEl) {
				textInputEl.value = "";
			}
			this.updateSubmitButtonState(); // Disable the button after submission
			this.scrollToBottom();
		}
	}

	scrollToBottom() {
		const chatHistoryEl = this.contentEl.querySelector('.llm-chat-history');
		if (chatHistoryEl) {
			chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
		}
	}
}

async function processChatInput(text: string, personas: string, chatContainer: HTMLElement, chatHistoryEl: HTMLElement, conversationHistory: ConversationEntry[], pluginSettings: OLocalLLMSettings) {
	const { contentEl } = this; // Assuming 'this' refers to the LLMChatModal instance

	// Add user's question to conversation history
	conversationHistory.push({ prompt: text, response: "" });
	if (chatHistoryEl) {
		const chatElement = document.createElement('div');
		chatElement.classList.add('llmChatMessageStyleUser');
		chatElement.innerHTML = text;
		chatHistoryEl.appendChild(chatElement);
	}

	showThinkingIndicator(chatHistoryEl);
	scrollToBottom(chatContainer);

	text = modifyPrompt(text, personas);
	console.log(text);

	try {
		const body = {
			model: pluginSettings.llmModel,
			messages: [
				{ role: "system", content: pluginSettings.defaultSystemPrompt || "You are my text editor AI agent who provides concise and helpful responses." },
				...conversationHistory.slice(-pluginSettings.maxConvHistory).reduce((acc, entry) => {
					acc.push({ role: "user", content: entry.prompt });
					acc.push({ role: "assistant", content: entry.response });
					return acc;
				}, [] as { role: string; content: string }[]),
				{ role: "user", content: text },
			],
			temperature: pluginSettings.temperature,
			max_tokens: pluginSettings.maxTokens,
			stream: false, // Set to false for chat window
		};

		const response = await requestUrl({
			url: `${pluginSettings.serverAddress}/v1/chat/completions`,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		const statusCode = response.status;

		if (statusCode >= 200 && statusCode < 300) {
			const data = await response.json;
			let content = data.choices[0].message.content;
			let reasoning = data.choices[0].message.reasoning || '';

			// If content is empty but reasoning exists, use reasoning as the source
			let llmResponse = content;
			if ((!content || content.trim().length === 0) && reasoning && reasoning.trim().length > 0) {
				llmResponse = reasoning;
			}

			// Extract actual response if this is a reasoning model
			// Create a temporary settings object to pass to the extraction function
			const tempSettings: OLocalLLMSettings = {
				...pluginSettings,
				extractReasoningResponses: pluginSettings.extractReasoningResponses || false,
				reasoningMarkers: pluginSettings.reasoningMarkers || DEFAULT_SETTINGS.reasoningMarkers
			};

			llmResponse = extractActualResponse(llmResponse, tempSettings);

			// Convert LLM response to HTML
			let formattedResponse = llmResponse;
			//conver to html - bold
			formattedResponse = formattedResponse.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
			formattedResponse = formattedResponse.replace(/_(.*?)_/g, "<i>$1</i>");
			formattedResponse = formattedResponse.replace(/\n\n/g, "<br><br>");

			console.log("formattedResponse", formattedResponse);

			// Create response container
			const responseContainer = document.createElement('div');
			responseContainer.classList.add('llmChatMessageStyleAI');

			// Create response text element
			const responseTextEl = document.createElement('div');
			responseTextEl.innerHTML = formattedResponse;
			responseContainer.appendChild(responseTextEl);

			// Create copy button
			const copyButton = document.createElement('button');
			copyButton.classList.add('copy-button');
			setIcon(copyButton, 'copy');
			copyButton.addEventListener('click', () => {
				navigator.clipboard.writeText(llmResponse).then(() => {
					new Notice('Copied to clipboard!');
				});
			});
			responseContainer.appendChild(copyButton);

			// Add response container to chat history
			chatHistoryEl.appendChild(responseContainer);

			// Add LLM response to conversation history with Markdown
			updateConversationHistory(text, formattedResponse, conversationHistory, pluginSettings.maxConvHistory);

			hideThinkingIndicator(chatHistoryEl);

			// Scroll to bottom after response is generated
			scrollToBottom(chatContainer);

		} else {
			throw new Error(
				"Error getting response from LLM server: " + response.text
			);
		}
	} catch (error) {
		console.error("Error during request:", error);
		new Notice(
			"Error communicating with LLM Helper: Check plugin console for details!"
		);
		hideThinkingIndicator(chatHistoryEl);
	}

}

function showThinkingIndicator(chatHistoryEl: HTMLElement) {
	const thinkingIndicatorEl = document.createElement('div');
	thinkingIndicatorEl.classList.add('thinking-indicator');
	const tStr = ["Calculating the last digit of pi... just kidding",
		"Quantum entanglement engaged... thinking deeply",
		"Reticulating splines... stand by",
		"Consulting the Oracle",
		"Entangling qubits... preparing for a quantum leap",
		"Processing... yada yada yada... almost done",
		"Processing... We're approaching singularity",
		"Serenity now! Patience while we process",
		"Calculating the probability of George getting a date",
		"Asking my man Art Vandalay"];
	// pick a random index between 0 and size of string array above
	const randomIndex = Math.floor(Math.random() * tStr.length);
	thinkingIndicatorEl.innerHTML = tStr[randomIndex] + '<span class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span>'; // Inline HTML

	chatHistoryEl.appendChild(thinkingIndicatorEl);
}

function hideThinkingIndicator(chatHistoryEl: HTMLElement) {
	const thinkingIndicatorEl = chatHistoryEl.querySelector('.thinking-indicator');
	if (thinkingIndicatorEl) {
		chatHistoryEl.removeChild(thinkingIndicatorEl);
	}
}

function scrollToBottom(el: HTMLElement) {
	const chatHistoryEl = el.querySelector('.llm-chat-history');
	if (chatHistoryEl) {
		chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
	}
}

function updateConversationHistory(prompt: string, response: string, conversationHistory: ConversationEntry[], maxConvHistoryLength: number) {
	conversationHistory.push({ prompt, response });

	// Limit history length to maxConvHistoryLength
	if (conversationHistory.length > maxConvHistoryLength) {
		conversationHistory.shift();
	}
}



// Modal for selecting a custom prompt
class SelectPromptModal extends Modal {
	private prompts: CustomPrompt[];
	private callback: (prompt: CustomPrompt) => void;

	constructor(app: App, prompts: CustomPrompt[], callback: (prompt: CustomPrompt) => void) {
		super(app);
		this.prompts = prompts;
		this.callback = callback;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.createEl("h3", { text: "Select a Custom Prompt" });

		// Create a list of prompts to select from
		const promptList = contentEl.createEl("div", { cls: "prompt-selection-list" });

		this.prompts.forEach(prompt => {
			const promptItem = promptList.createEl("div", {
				cls: "prompt-item",
				text: prompt.title,
				attr: { style: "padding: 8px; cursor: pointer; border-bottom: 1px solid #ccc; user-select: none;" }
			});

			promptItem.addEventListener("click", () => {
				this.callback(prompt);
				this.close();
			});

			// Add hover effect
			promptItem.addEventListener("mouseenter", () => {
				promptItem.setAttribute("style", "padding: 8px; cursor: pointer; border-bottom: 1px solid #ccc; user-select: none; background-color: #f0f0f0;");
			});

			promptItem.addEventListener("mouseleave", () => {
				promptItem.setAttribute("style", "padding: 8px; cursor: pointer; border-bottom: 1px solid #ccc; user-select: none;");
			});
		});

		// Add a close button
		const closeButton = contentEl.createEl("button", {
			text: "Cancel",
			cls: "mod-cta"
		});

		closeButton.addEventListener("click", () => {
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

//TODO: add a button to clear the chat history
//TODO: add a button to save the chat history to a obsidian file

//TODO: kill switch

// Helper function to get the API key based on the selected search engine
function getSearchApiKey(plugin: OLocalLLMPlugin): string {
	switch (plugin.settings.searchEngine) {
		case 'brave':
			return plugin.settings.braveSearchApiKey;
		case 'custom':
			return plugin.settings.customSearchApiKey || '';
		default:
			return plugin.settings.customSearchApiKey || '';
	}
}

// Helper function to get the search URL based on the selected search engine
function getSearchUrl(plugin: OLocalLLMPlugin, query: string, searchType: 'web' | 'news' = 'web'): string {
	const encodedQuery = encodeURIComponent(query);

	switch (plugin.settings.searchEngine) {
		case 'brave':
			if (searchType === 'web') {
				return `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=5&summary=1&extra_snippets=1&text_decorations=1&result_filter=web,discussions,faq,news&spellcheck=1`;
			} else {
				return `https://api.search.brave.com/res/v1/news/search?q=${encodedQuery}&count=5&search_lang=en&freshness=pd`;
			}
		case 'searxng':
			// Use the specific SearXNG URL
			const searxngUrl = plugin.settings.searxngUrl || 'https://searx.work';
			return `${searxngUrl}/search?q=${encodedQuery}&format=json`;
		case 'duckduckgo':
			// DuckDuckGo doesn't require an API key for their Instant Answer API
			return `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&pretty=1`;
		case 'firecrawl':
			// Use the specific Firecrawl URL
			const firecrawlUrl = plugin.settings.firecrawlUrl || 'https://api.firecrawl.dev';
			return `${firecrawlUrl}/v1/search?q=${encodedQuery}`;
		case 'perplexica':
			// Use the specific Perplexica URL
			const perplexicaUrl = plugin.settings.perplexicaUrl || 'https://api.perplexica.com';
			return `${perplexicaUrl}/search?q=${encodedQuery}`;
		case 'custom':
			// Use the custom search URL provided by the user
			const customUrl = plugin.settings.customSearchUrl || '';
			return customUrl.replace('{query}', encodedQuery);
		default:
			// Default to Brave if no valid engine is selected
			if (searchType === 'web') {
				return `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=5&summary=1&extra_snippets=1&text_decorations=1&result_filter=web,discussions,faq,news&spellcheck=1`;
			} else {
				return `https://api.search.brave.com/res/v1/news/search?q=${encodedQuery}&count=5&search_lang=en&freshness=pd`;
			}
	}
}

// Helper function to get headers based on the selected search engine
function getSearchHeaders(plugin: OLocalLLMPlugin): Record<string, string> {
	const apiKey = getSearchApiKey(plugin);

	switch (plugin.settings.searchEngine) {
		case 'brave':
			return {
				"Accept": "application/json",
				"Accept-Encoding": "gzip",
				"X-Subscription-Token": apiKey,
			};
		case 'firecrawl':
			return {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			};
		case 'searxng':
		case 'duckduckgo':
		case 'perplexica':
			// These engines may not require special headers or use different authentication
			return {
				"Accept": "application/json",
			};
		case 'custom':
			return {
				"Accept": "application/json",
				"Authorization": `Bearer ${apiKey}`,
			};
		default:
			return {
				"Accept": "application/json",
				"Accept-Encoding": "gzip",
				"X-Subscription-Token": apiKey,
			};
	}
}

// Helper function to format search results based on the search engine
function formatSearchResults(results: any, searchEngine: string, searchType: 'web' | 'news' = 'web'): string {
	switch (searchEngine) {
		case 'brave':
			if (searchType === 'web' && results.web && results.web.results) {
				return results.web.results.map((result: any) => {
					let snippets = result.extra_snippets ?
						'\nAdditional Context:\n' + result.extra_snippets.join('\n') : '';
					return `${result.title}\n${result.description}${snippets}\nSource: ${result.url}\n\n`;
				}).join('');
			} else if (searchType === 'news' && results.results) {
				return results.results.map((result: any) =>
					`${result.title}\n${result.description}\nSource: ${result.url}\nPublished: ${result.published_time}\n\n`
				).join('');
			}
			break;
		case 'duckduckgo':
			// DuckDuckGo Instant Answer API format
			if (results.AbstractText) {
				return `DDG Result:\n${results.AbstractText}\nSource: ${results.AbstractURL}\n\n`;
			} else if (results.RelatedTopics && results.RelatedTopics.length > 0) {
				return results.RelatedTopics.map((topic: any) => {
					if (topic.Text) {
						return `${topic.Text}\nSource: ${topic.FirstURL}\n\n`;
					}
					return '';
				}).join('');
			}
			break;
		case 'searxng':
			// SearXNG format
			if (results.results && results.results.length > 0) {
				return results.results.map((result: any) =>
					`${result.title}\n${result.content || result.description}\nSource: ${result.url}\n\n`
				).join('');
			}
			break;
		case 'firecrawl':
			// Firecrawl format
			if (results.data && results.data.length > 0) {
				return results.data.map((result: any) =>
					`${result.title}\n${result.description || result.content}\nSource: ${result.url}\n\n`
				).join('');
			}
			break;
		case 'perplexica':
			// Perplexica format
			if (results.data && results.data.length > 0) {
				return results.data.map((result: any) =>
					`${result.title}\n${result.content}\nSource: ${result.url}\n\n`
				).join('');
			}
			break;
		case 'custom':
			// Custom format - try to parse based on common patterns
			if (Array.isArray(results)) {
				return results.map((result: any) => {
					const title = result.title || result.name || 'Untitled';
					const content = result.content || result.description || result.text || '';
					const url = result.url || result.link || 'No source';
					return `${title}\n${content}\nSource: ${url}\n\n`;
				}).join('');
			} else if (results.results && Array.isArray(results.results)) {
				return results.results.map((result: any) => {
					const title = result.title || result.name || 'Untitled';
					const content = result.content || result.description || result.text || '';
					const url = result.url || result.link || 'No source';
					return `${title}\n${content}\nSource: ${url}\n\n`;
				}).join('');
			}
			break;
		default:
			// Default to Brave format
			if (results.web && results.web.results) {
				return results.web.results.map((result: any) => {
					let snippets = result.extra_snippets ?
						'\nAdditional Context:\n' + result.extra_snippets.join('\n') : '';
					return `${result.title}\n${result.description}${snippets}\nSource: ${result.url}\n\n`;
				}).join('');
			}
	}

	return "No results found or unsupported format.";
}

async function processWebSearch(query: string, plugin: OLocalLLMPlugin) {
	// Check if API key is required and available
	const requiresApiKey = plugin.settings.searchEngine !== 'duckduckgo' && plugin.settings.searchEngine !== 'custom';
	const apiKey = getSearchApiKey(plugin);

	if (requiresApiKey && !apiKey) {
		new Notice(`Please set your ${searchEnginesDict[plugin.settings.searchEngine] || 'search engine'} API key in settings`);
		return;
	}

	new Notice(`Searching the web using ${searchEnginesDict[plugin.settings.searchEngine] || 'selected search engine'}...`);

	try {
		const url = getSearchUrl(plugin, query, 'web');
		const headers = getSearchHeaders(plugin);

		const response = await requestUrl({
			url: url,
			method: "GET",
			headers: headers
		});

		if (response.status !== 200) {
			throw new Error(`Search failed with status: ${response.status}`);
		}

		const formattedResults = formatSearchResults(response.json, plugin.settings.searchEngine, 'web');

		processText(
			`Based on these comprehensive search results about "${query}" from ${searchEnginesDict[plugin.settings.searchEngine]}:\n\n${formattedResults}`,
			"You are a helpful assistant. Analyze these detailed search results and provide a thorough, well-structured response. Include relevant source citations and consider multiple perspectives if available.",
			plugin
		);

	} catch (error) {
		console.error("Web search error:", error);
		new Notice("Web search failed. Check console for details.");
	}
}

async function processNewsSearch(query: string, plugin: OLocalLLMPlugin) {
	// Check if API key is required and available
	const requiresApiKey = plugin.settings.searchEngine !== 'duckduckgo' && plugin.settings.searchEngine !== 'custom';
	const apiKey = getSearchApiKey(plugin);

	if (requiresApiKey && !apiKey) {
		new Notice(`Please set your ${searchEnginesDict[plugin.settings.searchEngine] || 'search engine'} API key in settings`);
		return;
	}

	new Notice(`Searching news using ${searchEnginesDict[plugin.settings.searchEngine] || 'selected search engine'}...`);

	try {
		const url = getSearchUrl(plugin, query, 'news');
		const headers = getSearchHeaders(plugin);

		const response = await requestUrl({
			url: url,
			method: "GET",
			headers: headers
		});

		if (response.status !== 200) {
			throw new Error(`News search failed with status: ${response.status}`);
		}

		const formattedResults = formatSearchResults(response.json, plugin.settings.searchEngine, 'news');

		processText(
			`Based on these news results about "${query}" from ${searchEnginesDict[plugin.settings.searchEngine]}:\n\n${formattedResults}`,
			"Analyze these news results and provide a comprehensive summary with key points and timeline. Include source citations.",
			plugin
		);
	} catch (error) {
		console.error("News search error:", error);
		new Notice("News search failed. Check console for details.");
	}
}
