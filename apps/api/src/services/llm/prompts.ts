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

/**
 * Chat answers are grounded, not JSON — so this gets its own system prompt
 * instead of SYSTEM_PROMPT, which demands raw JSON.
 */
export const CHAT_SYSTEM_PROMPT = `You are a senior engineer answering questions about one specific codebase.

You are given numbered excerpts from that codebase. Each excerpt has a file path and an exact line range.

Rules:
- Ground every factual claim in the excerpts. After each claim, cite the excerpt it came from as [1], [2], … You may cite several, like [2][5].
- Never invent a file path, function name, or line number that is not in the excerpts.
- If the excerpts do not answer the question, say so plainly and name what you would need to see. Do not guess.
- The excerpts are retrieved by similarity, so some may be irrelevant. Ignore those silently.
- Be concise and concrete. Prefer naming the actual functions and files over general advice.
- Answer in markdown. Do not wrap the whole answer in a code fence.`

export interface ChatContextChunk {
  ref: number
  filePath: string
  startLine: number
  endLine: number
  snippet: string
}

export function chatPrompt(
  question: string,
  chunks: ChatContextChunk[],
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): string {
  const context = chunks
    .map((c) => `[${c.ref}] ${c.filePath}:${c.startLine}-${c.endLine}\n\`\`\`\n${c.snippet}\n\`\`\``)
    .join('\n\n')

  const priorTurns = history.length
    ? `EARLIER IN THIS CONVERSATION:\n${history
        .map((t) => `${t.role === 'user' ? 'Question' : 'Answer'}: ${t.content}`)
        .join('\n\n')}\n\n`
    : ''

  return `${priorTurns}CODEBASE EXCERPTS:

${context}

QUESTION: ${question}

Answer the question using only the excerpts above, citing them as [n].`
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
