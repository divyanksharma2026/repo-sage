export const SYSTEM_PROMPT = `You are an expert software architect and code analyst.
When asked for JSON output, respond with ONLY the raw JSON object — no markdown, no explanation, no preamble.
Start your response directly with { and end with }.`

export function architecturePrompt(fileTree: string, keyFiles: string): string {
  return `Analyze this GitHub repository and provide a comprehensive architecture overview.

FILE TREE:
${fileTree}

KEY FILES:
${keyFiles}

Respond with JSON in this exact shape:
{
  "overview": "2-3 paragraph narrative description of the codebase",
  "techStack": ["list", "of", "technologies"],
  "patterns": ["architectural patterns detected, e.g. MVC, event-driven, microservices"],
  "entryPoints": ["main entry point file paths"]
}`
}

export function modulePrompt(modulePath: string, files: string): string {
  return `Analyze this module/directory from a codebase.

MODULE PATH: ${modulePath}

FILES IN THIS MODULE:
${files}

Respond with JSON in this exact shape:
{
  "name": "short module name",
  "summary": "2-3 sentence description of what this module does",
  "responsibility": "one sentence describing the single responsibility",
  "exports": ["list of key exported functions/classes/types"],
  "imports": ["list of external packages this module depends on"]
}`
}

export function fileExplanationPrompt(filePath: string, content: string): string {
  return `Explain this source code file in detail.

FILE: ${filePath}

CONTENT:
${content}

Respond with JSON in this exact shape:
{
  "purpose": "one sentence describing what this file does",
  "explanation": "2-4 paragraph detailed explanation",
  "keyFunctions": [
    { "name": "functionName", "description": "what it does" }
  ],
  "dependencies": ["list of imported modules/packages"]
}`
}
