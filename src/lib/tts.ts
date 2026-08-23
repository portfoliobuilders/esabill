import type { Lang } from '@/lib/i18n'

export const TTS_MAX_CHARS = 5000
export const TTS_CHUNK_CHARS = 160

export function splitSpeechChunks(text: string, maxChars = TTS_CHUNK_CHARS): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []
  const sentences = (normalized.match(/[^.!?।]+[.!?।]?/g) ?? [normalized])
    .map((part) => part.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      const next = current ? `${current} ${sentence}` : sentence
      if (next.length <= maxChars) {
        current = next
      } else {
        if (current) chunks.push(current)
        current = sentence
      }
      continue
    }
    if (current) {
      chunks.push(current)
      current = ''
    }
    for (const piece of splitLongRun(sentence, maxChars)) chunks.push(piece)
  }
  if (current) chunks.push(current)
  return chunks
}

function splitLongRun(text: string, maxChars: number): string[] {
  const words = text.split(' ').filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const word of words) {
    if (word.length > maxChars) {
      if (current) chunks.push(current)
      current = ''
      for (let i = 0; i < word.length; i += maxChars) chunks.push(word.slice(i, i + maxChars))
      continue
    }
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
    } else {
      if (current) chunks.push(current)
      current = word
    }
  }
  if (current) chunks.push(current)
  return chunks
}

export function ttsLocale(lang: Lang): string {
  return lang === 'ml' ? 'ml' : 'en'
}
