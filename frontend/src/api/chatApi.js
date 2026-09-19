import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min — RAG pipeline & translation
})

// Forward auth token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kg_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const chatAPI = {
  /**
   * Ask a question with multilingual text support.
   *
   * @param {string} question
   * @param {Array}  history
   * @param {string} language - 'en-IN', 'ta-IN', 'hi-IN', 'te-IN', or 'auto'
   * @param {boolean} enable_tts
   * @returns {Promise<{ answer: string, sources: Array, language: string, audio: string|null }>}
   */
  ask: (question, history = [], language = 'en-IN', enable_tts = false) =>
    api
      .post('/chat', {
        question,
        history,
        language,
        enable_tts,
      })
      .then((res) => res.data),

  /**
   * Ask a question via audio recording (Sarvam STT -> RAG -> Sarvam TTS).
   *
   * @param {Blob}   audioBlob
   * @param {Array}  history
   * @param {string} language
   * @param {boolean} enable_tts
   * @returns {Promise<{ answer: string, sources: Array, language: string, audio: string|null, original_query: string }>}
   */
  askVoice: (audioBlob, history = [], language = 'en-IN', enable_tts = true) => {
    const formData = new FormData()
    formData.append('file', audioBlob, 'voice_query.webm')
    formData.append('language', language)
    formData.append('enable_tts', enable_tts)
    formData.append('history', JSON.stringify(history))

    return api
      .post('/chat/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },
}

export default chatAPI
