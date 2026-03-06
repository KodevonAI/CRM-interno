const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b'

interface OllamaGenerateResponse {
  response: string
  done: boolean
}

// Genera texto con Ollama — stream: false para respuesta completa
export async function generate(prompt: string, maxTokens = 300): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:   OLLAMA_MODEL,
      prompt,
      stream:  false,
      options: {
        temperature: 0.1,      // bajo = respuestas consistentes, menos aleatorio
        num_predict: maxTokens,
        top_p:       0.9,
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Ollama error ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = await res.json() as OllamaGenerateResponse
  return data.response?.trim() ?? ''
}

// Verifica que Ollama esté corriendo y el modelo descargado
export async function isAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
    const data = await res.json() as { models: Array<{ name: string }> }
    return data.models.some((m) => m.name.startsWith(OLLAMA_MODEL.split(':')[0]))
  } catch {
    return false
  }
}
