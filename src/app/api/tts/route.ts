import { NextResponse } from 'next/server'
import { z } from 'zod'

import { splitSpeechChunks, TTS_MAX_CHARS, ttsLocale } from '@/lib/tts'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  text: z.string().trim().min(1).max(TTS_MAX_CHARS),
  language: z.enum(['ml', 'en']),
})

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function translateTtsUrl(text: string, tl: string, host: 'translate.google.com' | 'translate.googleapis.com'): string {
  const client = host === 'translate.googleapis.com' ? 'gtx' : 'tw-ob'
  return `https://${host}/translate_tts?ie=UTF-8&client=${client}&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(text)}`
}

async function fetchChunk(text: string, tl: string): Promise<ArrayBuffer | null> {
  for (const host of ['translate.google.com', 'translate.googleapis.com'] as const) {
    try {
      const response = await fetch(translateTtsUrl(text, tl, host), {
        headers: {
          Accept: 'audio/mpeg,*/*',
          'User-Agent': UA,
          Referer: 'https://translate.google.com/',
        },
        cache: 'no-store',
      })
      if (!response.ok) continue
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength > 500) return buffer
    } catch {
      continue
    }
  }
  return null
}

function concatAudio(parts: ArrayBuffer[]): Buffer {
  return Buffer.concat(parts.map((part) => Buffer.from(part)))
}

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }

  const chunks = splitSpeechChunks(parsed.data.text)
  if (chunks.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }

  const tl = ttsLocale(parsed.data.language)
  const audioParts: ArrayBuffer[] = []
  for (const chunk of chunks) {
    const part = await fetchChunk(chunk, tl)
    if (!part) {
      return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
    }
    audioParts.push(part)
  }

  return new NextResponse(new Uint8Array(concatAudio(audioParts)), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
