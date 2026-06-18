export function logLLM({ query, response, timing, error, image }) {
  const entry = { timestamp: new Date().toISOString(), query, response, timing, error, image: !!image }

  if (error) {
    console.error('[LLM]', JSON.stringify(entry))
  } else {
    console.log('[LLM]', JSON.stringify(entry))
  }
}
