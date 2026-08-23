'use client'

import { useEffect, useRef, useState } from 'react'

import { IconPause, IconPlay, IconSpeaker, IconStop } from '@/components/ui/icons'
import { cx } from '@/lib/cx'
import { t, type Lang } from '@/lib/i18n'
import { splitSpeechChunks } from '@/lib/tts'
import { btnGhost, btnSecondary } from '@/lib/ui'

type PlayState = 'idle' | 'loading' | 'playing' | 'paused'

function pickVoice(lang: Lang, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const locale = lang === 'ml' ? 'ml-IN' : 'en-IN'
  const prefix = lang === 'ml' ? 'ml' : 'en'
  const exact = voices.find((voice) => voice.lang.toLowerCase() === locale.toLowerCase())
  if (exact) return exact
  const language = voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix))
  if (language) return language
  if (lang === 'en') {
    return voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ?? null
  }
  return null
}

async function fetchCloudAudio(text: string, lang: Lang, signal: AbortSignal): Promise<Blob> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ text: text.slice(0, 5000), language: lang }),
  })
  if (!response.ok) throw new Error('tts_unavailable')
  const blob = await response.blob()
  if (!blob.size) throw new Error('tts_unavailable')
  return blob
}

export function ReadAloudControls({
  lang,
  text,
  onStatus,
}: {
  lang: Lang
  text: string
  onStatus?: (message: string) => void
}) {
  const [state, setState] = useState<PlayState>('idle')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [error, setError] = useState('')
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const queueRef = useRef<string[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const keepAliveRef = useRef<number | null>(null)
  const stopRef = useRef<(announce: boolean) => void>(() => undefined)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
    }
  }, [])

  const voice = pickVoice(lang, voices)

  function clearKeepAlive() {
    if (keepAliveRef.current !== null) {
      window.clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }

  function releaseAudio() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
  }

  function stopPlayback(announce: boolean) {
    abortRef.current?.abort()
    abortRef.current = null
    clearKeepAlive()
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
    utteranceRef.current = null
    queueRef.current = []
    releaseAudio()
    if (announce) onStatus?.(t(lang, 'playbackStopped'))
  }
  stopRef.current = stopPlayback

  useEffect(() => {
    stopRef.current(false)
    setError('')
    setState('idle')
  }, [lang, text])

  useEffect(() => {
    return () => stopRef.current(false)
  }, [])

  function speakNextChunk() {
    const next = queueRef.current.shift()
    if (!next) {
      clearKeepAlive()
      utteranceRef.current = null
      setState('idle')
      onStatus?.(t(lang, 'playbackStopped'))
      return
    }
    const utterance = new SpeechSynthesisUtterance(next)
    utterance.lang = lang === 'ml' ? 'ml-IN' : 'en-IN'
    if (voice) utterance.voice = voice
    utterance.onend = () => speakNextChunk()
    utterance.onerror = () => {
      clearKeepAlive()
      utteranceRef.current = null
      setState('idle')
      setError(t(lang, lang === 'ml' ? 'malayalamVoiceUnavailable' : 'errorGeneric'))
      onStatus?.(t(lang, lang === 'ml' ? 'malayalamVoiceUnavailable' : 'errorGeneric'))
    }
    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function speakLocal() {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return
    window.speechSynthesis.cancel()
    queueRef.current = splitSpeechChunks(text, 220)
    if (queueRef.current.length === 0) return
    clearKeepAlive()
    keepAliveRef.current = window.setInterval(() => {
      if (!window.speechSynthesis.speaking) return
      window.speechSynthesis.pause()
      window.speechSynthesis.resume()
    }, 8000)
    setState('playing')
    onStatus?.(t(lang, 'playbackStarted'))
    speakNextChunk()
  }

  async function playCloud() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setState('loading')
    setError('')
    onStatus?.(t(lang, 'preparingVoice'))
    try {
      const blob = await fetchCloudAudio(text, lang, controller.signal)
      if (controller.signal.aborted) return
      releaseAudio()
      const url = URL.createObjectURL(blob)
      audioUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setState('idle')
        onStatus?.(t(lang, 'playbackStopped'))
        releaseAudio()
      }
      audio.onerror = () => {
        setState('idle')
        setError(t(lang, 'malayalamVoiceUnavailable'))
        onStatus?.(t(lang, 'malayalamVoiceUnavailable'))
        releaseAudio()
      }
      await audio.play()
      setState('playing')
      onStatus?.(t(lang, 'playbackStarted'))
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setState('idle')
      setError(t(lang, 'malayalamVoiceUnavailable'))
      onStatus?.(t(lang, 'malayalamVoiceUnavailable'))
    }
  }

  function play() {
    if (!text.trim()) return
    stopPlayback(false)
    setError('')
    if (voice || lang === 'en') {
      speakLocal()
      return
    }
    void playCloud()
  }

  function pause() {
    if (audioRef.current) {
      audioRef.current.pause()
      setState('paused')
      return
    }
    window.speechSynthesis?.pause()
    setState('paused')
  }

  function resume() {
    if (audioRef.current) {
      void audioRef.current.play()
      setState('playing')
      return
    }
    window.speechSynthesis?.resume()
    setState('playing')
  }

  function stop() {
    stopPlayback(true)
    setState('idle')
  }

  return (
    <div className="flex flex-col gap-2">
      {state === 'idle' || state === 'loading' ? (
        <button
          type="button"
          className={cx(btnSecondary, 'w-full sm:w-auto')}
          onClick={play}
          disabled={!text.trim() || state === 'loading'}
          aria-busy={state === 'loading'}
        >
          <IconSpeaker className="size-5 shrink-0" />
          {state === 'loading' ? t(lang, 'preparingVoice') : t(lang, 'listenToEmail')}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state === 'playing' ? (
            <button type="button" className={cx(btnGhost, 'min-w-11')} onClick={pause}>
              <IconPause className="size-5" />
              {t(lang, 'pauseReadAloud')}
            </button>
          ) : (
            <button type="button" className={cx(btnGhost, 'min-w-11')} onClick={resume}>
              <IconPlay className="size-5" />
              {t(lang, 'resumeReadAloud')}
            </button>
          )}
          <button type="button" className={cx(btnGhost, 'min-w-11')} onClick={stop}>
            <IconStop className="size-5" />
            {t(lang, 'stopReadAloud')}
          </button>
        </div>
      )}
      {error ? <p className="text-sm text-muted">{error}</p> : null}
    </div>
  )
}
