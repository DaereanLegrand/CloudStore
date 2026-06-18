const LOG_PREFIX = '[LLM]'

export function logLLM({ query, response, timing, error, image }) {
  const entry = {
    timestamp: new Date().toISOString(),
    query,
    response: response || null,
    timing: timing ? `${timing.toFixed(1)}s` : null,
    error: error || null,
    image: !!image,
  }

  if (error) {
    console.error(LOG_PREFIX, entry)
  } else {
    console.log(LOG_PREFIX, entry)
  }

  try {
    const history = JSON.parse(sessionStorage.getItem('llm_logs') || '[]')
    history.unshift(entry)
    if (history.length > 100) history.length = 100
    sessionStorage.setItem('llm_logs', JSON.stringify(history))
  } catch {}
}

export function getLLMLogs() {
  try {
    return JSON.parse(sessionStorage.getItem('llm_logs') || '[]')
  } catch {
    return []
  }
}

export function clearLLMLogs() {
  sessionStorage.removeItem('llm_logs')
}
