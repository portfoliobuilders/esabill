import assert from 'node:assert/strict'
import { test } from 'node:test'

import { splitSpeechChunks } from './tts'

test('splitSpeechChunks keeps short text as one piece', () => {
  assert.deepEqual(splitSpeechChunks('Hello world.', 160), ['Hello world.'])
})

test('splitSpeechChunks splits long Malayalam on sentence boundaries', () => {
  const sentence = 'ഇത് ഒരു വാചകമാണ്. '.repeat(20).trim()
  const chunks = splitSpeechChunks(sentence, 80)
  assert.ok(chunks.length > 1)
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 80)
    assert.ok(chunk.includes('വാചകമാണ്'))
  }
})
