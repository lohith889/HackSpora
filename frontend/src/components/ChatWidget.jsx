import { useState, useRef, useEffect } from 'react'
import chatAPI from '../api/chatApi'

// ─────────────────────────────────────────────────────────────
// Audio Player Pill for Spoken Responses (Bulbul v3)
// ─────────────────────────────────────────────────────────────
function AudioPlayerButton({ base64Audio, autoPlay = false }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    if (base64Audio) {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`)
      audio.onended = () => setPlaying(false)
      audio.onerror = () => setPlaying(false)
      audioRef.current = audio

      if (autoPlay) {
        audio.play().then(() => setPlaying(true)).catch(() => {})
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [base64Audio, autoPlay])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  if (!base64Audio) return null

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        playing
          ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/40'
          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/70'
      }`}
      title={playing ? 'Pause spoken response' : 'Listen to voice readout'}
    >
      {playing ? (
        <>
          <div className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 bg-white rounded-full animate-wave" style={{ animationDelay: '0.1s' }} />
            <span className="w-0.5 bg-white rounded-full animate-wave" style={{ animationDelay: '0.3s' }} />
            <span className="w-0.5 bg-white rounded-full animate-wave" style={{ animationDelay: '0.2s' }} />
          </div>
          <span>Pause Readout</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <span>Listen (Voice Readout)</span>
        </>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Formatted Markdown / Clean Rich-Text Parser
// ─────────────────────────────────────────────────────────────
function renderInlineText(text) {
  if (!text) return null

  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key++} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-[11px] font-mono">
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

function FormattedMessage({ content }) {
  if (!content) return null

  const normalized = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n\n')
    .replace(/<(p|div)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')

  const lines = normalized.split('\n')
  const elements = []
  let currentList = []
  let listType = null
  let keyIndex = 0

  const flushList = () => {
    if (currentList.length > 0) {
      if (listType === 'bullet') {
        elements.push(
          <ul key={`ul-${keyIndex++}`} className="my-2 space-y-1.5 pl-1">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700 text-xs leading-relaxed">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span className="flex-1">{renderInlineText(item)}</span>
              </li>
            ))}
          </ul>
        )
      } else if (listType === 'numbered') {
        elements.push(
          <ol key={`ol-${keyIndex++}`} className="my-2 space-y-1.5 pl-1">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700 text-xs leading-relaxed">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold mt-0.5 shrink-0">
                  {idx + 1}
                </span>
                <span className="flex-1">{renderInlineText(item)}</span>
              </li>
            ))}
          </ol>
        )
      }
      currentList = []
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushList()
      continue
    }

    if (/^([-*_]){3,}$/.test(trimmed)) {
      flushList()
      elements.push(<hr key={`hr-${keyIndex++}`} className="my-2.5 border-slate-100" />)
      continue
    }

    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headerMatch) {
      flushList()
      elements.push(
        <div key={`h-${keyIndex++}`} className="font-heading font-bold text-slate-900 text-xs mt-3 mb-1">
          {renderInlineText(headerMatch[2])}
        </div>
      )
      continue
    }

    const bulletMatch = trimmed.match(/^[-*•+]\s+(.+)$/)
    if (bulletMatch) {
      if (listType !== 'bullet') flushList()
      listType = 'bullet'
      currentList.push(bulletMatch[1])
      continue
    }

    const numberedMatch = trimmed.match(/^(\d+)[\.)]\s+(.+)$/)
    if (numberedMatch) {
      if (listType !== 'numbered') flushList()
      listType = 'numbered'
      currentList.push(numberedMatch[2])
      continue
    }

    flushList()
    elements.push(
      <p key={`p-${keyIndex++}`} className="mb-2 text-slate-700 text-xs leading-relaxed last:mb-0">
        {renderInlineText(trimmed)}
      </p>
    )
  }

  flushList()
  return <div className="space-y-0.5">{elements}</div>
}

// ─────────────────────────────────────────────────────────────
// Language Configuration & Placeholders
// ─────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en-IN', label: 'English', native: 'EN' },
  { code: 'ta-IN', label: 'தமிழ்', native: 'TA' },
  { code: 'hi-IN', label: 'हिंदी', native: 'HI' },
  { code: 'te-IN', label: 'తెలుగు', native: 'TE' },
  { code: 'auto', label: 'Auto Detect', native: '🌐' },
]

const PLACEHOLDERS = {
  'en-IN': 'Ask about PM-KISAN, crop insurance, subsidies...',
  'ta-IN': 'திட்டங்களின் தகுதி, பலன்கள் பற்றி கேளுங்கள்…',
  'hi-IN': 'योजनाओं की पात्रता, लाभ के बारे में पूछें…',
  'te-IN': 'పథకాల అర్హత, ప్రయోజనాల గురించి అడగండి…',
  'auto': 'Ask about agricultural schemes, subsidies...',
}

// ─────────────────────────────────────────────────────────────
// Primary ChatWidget Component
// ─────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [showTooltip, setShowTooltip] = useState(true)
  const [language, setLanguage] = useState('en-IN')
  const [enableTts, setEnableTts] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Retrieving verified scheme guidelines...')
  const [error, setError] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, open])

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      setRecordingSeconds(0)
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    }
  }, [isRecording])

  // Voice Recording Handlers
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Microphone access is not supported by your browser.')
      return
    }

    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (audioChunksRef.current.length === 0) return

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        })
        await handleSendVoice(audioBlob)
      }

      mediaRecorderRef.current = recorder
      recorder.start(100)
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone error:', err)
      setError('Could not access microphone. Please allow microphone permissions.')
      setIsRecording(false)
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = []
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const handleSendVoice = async (audioBlob) => {
    setLoading(true)
    setLoadingStatus('Transcribing voice audio...')
    setError(null)

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }))

    const tempUserMsg = {
      role: 'user',
      content: '🎤 Voice message...',
      timestamp: timeString,
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      setTimeout(() => setLoadingStatus('Searching Ministry guidelines...'), 1200)

      const response = await chatAPI.askVoice(audioBlob, historyPayload, language, enableTts)

      setMessages((prev) => {
        const copy = [...prev]
        if (copy.length > 0 && copy[copy.length - 1].role === 'user') {
          copy[copy.length - 1] = {
            role: 'user',
            content: response.original_query ? `🎤 "${response.original_query}"` : '🎤 Voice message',
            timestamp: timeString,
          }
        }
        return [
          ...copy,
          {
            role: 'assistant',
            content: response.answer,
            sources: response.sources || [],
            language: response.language || language,
            audio: response.audio,
            autoPlay: enableTts,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]
      })
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Voice query processing failed.'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStatus('Retrieving verified scheme guidelines...')
    }
  }

  const executeSend = async (queryText) => {
    const q = (queryText || input).trim()
    if (!q || loading) return

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', content: q, timestamp: timeString }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setLoading(true)
    setLoadingStatus('Searching official guidelines...')
    setError(null)

    const historyPayload = messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      if (language !== 'en-IN') {
        setLoadingStatus('Translating & Retrieving...')
      }

      const response = await chatAPI.ask(q, historyPayload, language, enableTts)

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources || [],
          language: response.language || language,
          audio: response.audio,
          autoPlay: enableTts,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to retrieve scheme information.'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStatus('Retrieving verified scheme guidelines...')
    }
  }

  const handleMessageSubmit = (e) => {
    if (e) e.preventDefault()
    executeSend()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    setError(null)
  }

  const copyReplyText = (text, idx) => {
    navigator.clipboard?.writeText(text)
    setCopiedIndex(idx)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <>
      {/* ── FLOATING LAUNCHER (Bottom-Right) ── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {showTooltip && !open && (
          <div className="bg-slate-900 text-white text-xs px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-medium">Need Scheme Help? Ask AI</span>
            <button
              type="button"
              onClick={() => setShowTooltip(false)}
              className="text-slate-400 hover:text-white font-bold ml-1"
            >
              ✕
            </button>
          </div>
        )}

        <button
          id="chatbot-launcher"
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (showTooltip) setShowTooltip(false)
          }}
          aria-label={open ? 'Close Scheme Assistant' : 'Open Scheme Assistant'}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 hover:from-emerald-500 hover:to-teal-700 text-white shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 border border-emerald-500/30 relative"
        >
          {open ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v8" />
              <path d="M9 13l3-3 3 3" />
            </svg>
          )}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>
        </button>
      </div>

      {/* ── EXPANDED CHAT WINDOW ── */}
      {open && (
        <section
          id="chatbot-panel"
          aria-label="KisanGuard Scheme Assistant Chatbot"
          className="fixed bottom-24 right-6 z-50 w-[calc(100vw-2rem)] sm:w-[440px] h-[640px] max-h-[calc(100vh-7rem)] bg-white rounded-3xl shadow-2xl shadow-emerald-950/15 border border-slate-200/80 flex flex-col overflow-hidden transition-all duration-200 animate-fadeIn"
        >
          {/* 1. ELEGANT HEADER */}
          <header className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white px-4 py-3.5 relative flex-shrink-0 shadow-sm flex items-center justify-between">
            {/* Identity */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-emerald-200">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 8v8" />
                  <path d="M9 13l3-3 3 3" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-sm tracking-tight text-white leading-tight">
                    KisanGuard AI
                  </h2>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active RAG Service" />
                </div>
                <p className="text-[11px] text-emerald-100/80 font-normal">
                  Official Scheme Advisory
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1.5">
              {/* Language Pill Selector */}
              <div className="relative">
                <select
                  id="language-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="appearance-none bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium rounded-full py-1 pl-2.5 pr-6 border border-white/20 focus:outline-none cursor-pointer transition-colors"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="text-slate-800 bg-white">
                      {l.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-emerald-200">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* TTS Voice Readout Toggle */}
              <button
                type="button"
                onClick={() => setEnableTts((v) => !v)}
                title={enableTts ? 'Voice Readout is ON' : 'Enable Voice Readout'}
                className={`p-1.5 rounded-full transition-all border ${
                  enableTts
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-emerald-100 border-white/20'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </button>

              {/* Clear Chat */}
              <button
                type="button"
                onClick={handleClear}
                title="Clear chat history"
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-emerald-100 border border-white/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-emerald-100 border border-white/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </header>

          {/* 2. CHAT FEED CONTAINER */}
          <main
            id="chat-messages"
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll bg-slate-50/50"
            role="log"
            aria-live="polite"
          >
            {/* Welcome Conversational Greeting */}
            {messages.length === 0 && (
              <div className="space-y-4 py-2 animate-fadeIn">
                {/* Greeting Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-slate-700 text-xs leading-relaxed space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🙏</span>
                    <h3 className="font-heading font-semibold text-slate-900 text-sm">
                      Namaste! How can I assist you?
                    </h3>
                  </div>
                  <p className="text-slate-600">
                    I provide verified information directly from official Ministry guidelines for all major Indian agricultural schemes.
                  </p>
                </div>

                {/* Soft Suggestion Pills */}
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-2 px-1">
                    Explore Schemes &amp; Subsidies:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => executeSend('Tell me about PM-KISAN Income Support scheme and eligibility')}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span>🌾</span>
                      <span>PM-KISAN ₹6,000/yr</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => executeSend('Explain PMFBY Crop Insurance coverage and claim process')}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span>🛡️</span>
                      <span>PMFBY Crop Insurance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => executeSend('How do I apply for PM-KUSUM Solar Pump subsidy?')}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span>☀️</span>
                      <span>PM-KUSUM Solar Pump</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => executeSend('What is Soil Health Card Scheme and how to get tested?')}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span>🧪</span>
                      <span>Soil Health Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => executeSend('Explain Agriculture Infrastructure Fund (AIF) loan scheme')}
                      className="px-3.5 py-1.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-xs font-medium border border-slate-200/80 hover:border-emerald-300 transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <span>🚜</span>
                      <span>Agri Infrastructure Fund</span>
                    </button>
                  </div>
                </div>

                {/* Quick Inquiries */}
                <div>
                  <p className="text-[11px] font-medium text-slate-400 mb-2 px-1">
                    Quick Inquiries:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => executeSend('Check PM-KISAN 17th installment eligibility criteria')}
                      className="px-3 py-1 rounded-full bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium border border-emerald-200/60 transition-colors"
                    >
                      ✨ Check eligibility
                    </button>
                    <button
                      type="button"
                      onClick={() => executeSend('What documents are required to apply for PM-KISAN and PMFBY?')}
                      className="px-3 py-1 rounded-full bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-[11px] font-medium border border-emerald-200/60 transition-colors"
                    >
                      📋 Required documents list
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Conversation Bubbles */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user'

              if (isUser) {
                return (
                  <div key={index} className="flex justify-end animate-fadeIn">
                    <div className="max-w-[85%] bg-emerald-700 text-white text-xs px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-sm leading-relaxed">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <span className="text-[10px] text-emerald-200/80 block text-right mt-1 font-mono">
                        {msg.timestamp || 'Just now'}
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={index} className="flex items-start gap-2.5 animate-fadeIn">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex-shrink-0 flex items-center justify-center font-bold text-[11px] shadow-sm mt-0.5">
                    KG
                  </div>

                  <div className="max-w-[90%] space-y-2">
                    {/* Assistant Card */}
                    <div className="bg-white rounded-2xl rounded-tl-xs p-4 text-xs text-slate-800 shadow-sm border border-slate-100 leading-relaxed space-y-2">
                      <FormattedMessage content={msg.content} />

                      {/* Spoken Audio Readout */}
                      {msg.audio && <AudioPlayerButton base64Audio={msg.audio} autoPlay={msg.autoPlay} />}

                      {/* Sources Accordion */}
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="source-details group mt-3 pt-2.5 border-t border-slate-100 text-xs">
                          <summary className="flex items-center justify-between cursor-pointer list-none text-[11px] font-semibold text-emerald-800 hover:text-emerald-900 select-none py-1">
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              <span>Official Citations ({msg.sources.length})</span>
                            </span>
                            <svg className="chevron w-3 h-3 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>

                          <div className="mt-2 space-y-1.5 pl-1 pr-0.5 text-[11px] text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                            {msg.sources.map((src, idx) => {
                              const docName =
                                typeof src === 'string'
                                  ? src
                                  : src.file || src.source || src.filename || 'Official Ministry Document'
                              const cleanName = docName.split(/[\\/]/).pop()
                              const page =
                                typeof src === 'object' && src.page != null ? `Page ${src.page + 1}` : null

                              return (
                                <div key={idx} className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-200/60 last:border-b-0 last:pb-0">
                                  <div>
                                    <span className="font-medium text-slate-800 block">
                                      {cleanName}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Ministry of Agriculture &amp; Farmers Welfare
                                    </span>
                                  </div>
                                  {page && (
                                    <span className="text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                                      {page}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      )}

                      {/* Footer Actions: Copy */}
                      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                        <span>{msg.timestamp || 'Just now'}</span>
                        <button
                          type="button"
                          onClick={() => copyReplyText(msg.content, index)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors flex items-center gap-1"
                          title="Copy reply text"
                        >
                          {copiedIndex === index ? (
                            <span className="text-emerald-600 font-medium text-[10px]">Copied!</span>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5 animate-fadeIn">
                <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex-shrink-0 flex items-center justify-center font-bold text-[11px] shadow-sm mt-0.5">
                  KG
                </div>
                <div className="bg-white rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-600 shadow-sm border border-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-[11px] text-slate-500 ml-1">{loadingStatus}</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-800 rounded-2xl p-3.5 text-xs border border-red-200/70 flex items-start gap-2">
                <svg className="w-4 h-4 text-red-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-700 leading-relaxed">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* 3. VOICE RECORDING OVERLAY */}
          {isRecording && (
            <div className="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between border-t border-emerald-800 animate-fadeIn flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="text-xs font-medium text-emerald-100">
                  Listening ({formatTimer(recordingSeconds)})...
                </span>
              </div>

              <div className="flex items-center gap-1 h-5">
                <span className="w-1 bg-emerald-300 rounded-full animate-wave" style={{ animationDelay: '0.1s' }}></span>
                <span className="w-1 bg-emerald-300 rounded-full animate-wave" style={{ animationDelay: '0.3s' }}></span>
                <span className="w-1 bg-emerald-300 rounded-full animate-wave" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1 bg-emerald-300 rounded-full animate-wave" style={{ animationDelay: '0.4s' }}></span>
                <span className="w-1 bg-emerald-300 rounded-full animate-wave" style={{ animationDelay: '0.15s' }}></span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="text-xs px-2.5 py-1 rounded-full bg-emerald-800 hover:bg-emerald-700 text-emerald-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="text-xs px-3 py-1 rounded-full bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-semibold transition-colors shadow-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* 4. SLEEK COMPOSER INPUT */}
          <footer className="bg-white border-t border-slate-100 p-3 flex-shrink-0">
            <form onSubmit={handleMessageSubmit} className="relative">
              <div className="flex items-center gap-2 bg-slate-100/80 hover:bg-slate-100 focus-within:bg-white border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-2xl p-1.5 transition-all">
                {/* Voice Input Button */}
                <button
                  id="mic-btn"
                  type="button"
                  onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                  title={isRecording ? 'Stop recording' : 'Speak in your local language'}
                  className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>

                {/* Text Area */}
                <textarea
                  id="user-input"
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={PLACEHOLDERS[language] || PLACEHOLDERS['en-IN']}
                  className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none py-1 px-1 max-h-24 leading-normal"
                />

                {/* Send Button */}
                <button
                  id="send-btn"
                  type="submit"
                  disabled={loading || !input.trim()}
                  title="Send question"
                  className="p-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition-all flex-shrink-0 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                >
                  <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1 font-normal">
              <span>Verified against Ministry scheme guidelines</span>
              <span>MoA&amp;FW RAG</span>
            </div>
          </footer>
        </section>
      )}
    </>
  )
}
