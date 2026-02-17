# AGENTS.md

## Build/Lint/Test Commands

### Build Commands
- `npm run dev`: Start development server with esbuild (watch mode)
- `npm run build`: Build production version using tsc and esbuild
- `npm run version`: Bump version number and update manifest.json and versions.json

### Linting
- No specific lint command found in package.json, but ESLint is installed as a dependency
- Use `npx eslint .` to run ESLint on all files

### Testing
- No test commands found in package.json
- No tests appear to be present in the codebase

## Code Style Guidelines

### Imports
- Import statements should be grouped and sorted alphabetically
- Use relative paths for local imports (e.g., `./src/...`)
- Use absolute paths for external dependencies

### Formatting
- Use 2 spaces for indentation
- Follow standard JavaScript/TypeScript formatting conventions
- No specific code formatter is configured in the project

### Types
- Use TypeScript for type safety
- Define interfaces and types where appropriate
- Use `export interface` for public interfaces

### Naming Conventions
- Use camelCase for variables, functions, and methods
- Use PascalCase for classes and interfaces
- Use uppercase for constants
- Use descriptive names that clearly indicate purpose

### Error Handling
- Use try-catch blocks for error handling
- Log errors to console with appropriate context
- Return meaningful error messages
- Handle edge cases explicitly

## Cursor Rules (if any)
- No .cursor/rules directory found
- No .cursorrules files found

## Copilot Instructions (if any)
- No .github/copilot-instructions.md file found

## Additional Notes

### Project Structure
- The project uses a src/ directory for source code
- Main entry point is main.ts
- Configuration files include package.json, tsconfig.json, and esbuild.config.mjs

### Development Workflow
1. Make changes to the codebase
2. Run `npm run dev` to start development server
3. Use `npm run build` for production builds
4. Use `npm run version` to bump version numbers
5. Commit changes with appropriate message
6. Push to remote repository

### Key Files
- **package.json**: Contains project dependencies and scripts
- **tsconfig.json**: TypeScript configuration file
- **esbuild.config.mjs**: Build configuration for esbuild
- **main.ts**: Main entry point of the plugin
- **README.md**: Project documentation
- **TROUBLESHOOTING.md**: Common issues and solutions
- **.gitignore**: Files to ignore in version control

### Plugin Development
- This is an Obsidian plugin written in TypeScript
- Uses the Obsidian API for integration with the application
- Follows Obsidian's plugin development patterns
- Implements various features like LLM integration, text processing, and chat functionality

## Best Practices
1. Always run `npm install` after cloning or updating dependencies
2. Use `npm run dev` during development to see changes in real-time
3. Run `npm run build` before releasing a new version
4. Update the manifest.json file when making significant changes
5. Follow Obsidian's plugin development guidelines for compatibility and performance
6. Test thoroughly with different LLM providers (Ollama, OpenAI, LM Studio)
7. Handle edge cases like network errors, model not found, and invalid inputs gracefully
8. Use meaningful error messages to help users troubleshoot issues
9. Keep the codebase clean and well-documented for maintainability
10. Follow the AI-friendly tagging system for better code organization