import { useState, useRef, useEffect } from 'react'
import chatAPI from '../api/chatApi'

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function BotIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 17h6" />
    </svg>
  )
}

function SendIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function MicIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  )
}

function StopIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  )
}

function GlobeIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function CloseIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Source citation renderer
// ─────────────────────────────────────────────────────────────

function SourceList({ sources }) {
  if (!sources || sources.length === 0) return null

  const grouped = {}
  sources.forEach((src) => {
    const file =
      typeof src === 'string'
        ? src
        : src.file || src.source || src.filename || 'Document'
    const page =
      typeof src === 'object' ? (src.page != null ? src.page + 1 : null) : null
    if (!grouped[file]) grouped[file] = []
    if (page != null && !grouped[file].includes(page)) grouped[file].push(page)
  })

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        📚 Sources
      </p>
      {Object.entries(grouped).map(([file, pages]) => {
        const name = file.split(/[\\/]/).pop()
        return (
          <div key={file} className="font-mono text-[10px] text-slate-600 leading-snug">
            <span className="font-semibold text-slate-700">📄 {name}</span>
            {pages.length > 0 && (
              <span className="text-slate-500 ml-1">
                — p.{pages.sort((a, b) => a - b).join(', ')}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Audio Player Component for TTS Spoken Responses
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
      onClick={togglePlay}
      className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
        playing
          ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
          : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
      }`}
      title={playing ? 'Pause spoken response' : 'Listen to spoken response'}
    >
      {playing ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>Pause Voice</span>
        </>
      ) : (
        <>
          <span>🔊</span>
          <span>Listen Voice (Bulbul v3)</span>
        </>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Formatted Markdown / Rich-Text Parser for Assistant Replies
// ─────────────────────────────────────────────────────────────

function renderInlineText(text) {
  if (!text) return null

  // Match **bold**, *italic*, `code`
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
        <strong key={key++} className="font-semibold text-slate-950">
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
        <code key={key++} className="px-1 py-0.5 bg-slate-100 rounded text-xs font-mono text-emerald-800">
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

  // Normalize <br>, <br/>, <br />, and block tags into clean line breaks
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
          <ul key={`ul-${keyIndex++}`} className="my-2 space-y-1 pl-0.5">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700 text-xs sm:text-sm leading-relaxed">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                <span className="flex-1">{renderInlineText(item)}</span>
              </li>
            ))}
          </ul>
        )
      } else if (listType === 'numbered') {
        elements.push(
          <ol key={`ol-${keyIndex++}`} className="my-2 space-y-1 pl-0.5">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700 text-xs sm:text-sm leading-relaxed">
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
      elements.push(<hr key={`hr-${keyIndex++}`} className="my-2 border-slate-200" />)
      continue
    }

    const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headerMatch) {
      flushList()
      const level = headerMatch[1].length
      const headingText = headerMatch[2]
      elements.push(
        <div
          key={`h-${keyIndex++}`}
          className={`font-semibold tracking-tight text-slate-900 mt-2.5 mb-1 ${
            level <= 2
              ? 'text-sm sm:text-base text-emerald-950 font-bold border-b border-slate-100 pb-1'
              : 'text-xs sm:text-sm text-slate-900'
          }`}
        >
          {renderInlineText(headingText)}
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
      <p key={`p-${keyIndex++}`} className="mb-2 text-slate-800 text-xs sm:text-sm leading-relaxed last:mb-0">
        {renderInlineText(trimmed)}
      </p>
    )
  }

  flushList()

  return <div className="space-y-0.5">{elements}</div>
}

// ─────────────────────────────────────────────────────────────
// Individual message bubble
// ─────────────────────────────────────────────────────────────

const LANGUAGE_BADGES = {
  'en-IN': 'English',
  'ta-IN': 'தமிழ் (Tamil)',
  'hi-IN': 'हिन्दी (Hindi)',
  'te-IN': 'తెలుగు (Telugu)',
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[88%] px-3.5 py-2.5 rounded text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-emerald-900 text-white font-sans'
            : 'bg-white border border-slate-200 text-slate-900 font-sans'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        ) : (
          <>
            {msg.language && msg.language !== 'en-IN' && LANGUAGE_BADGES[msg.language] && (
              <div className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span>🌐</span>
                <span>{LANGUAGE_BADGES[msg.language]}</span>
              </div>
            )}
            <FormattedMessage content={msg.content} />
            {msg.audio && (
              <AudioPlayerButton base64Audio={msg.audio} autoPlay={msg.autoPlay} />
            )}
          </>
        )}
        {!isUser && <SourceList sources={msg.sources} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Thinking indicator
// ─────────────────────────────────────────────────────────────

function ThinkingIndicator({ statusText = 'Thinking…' }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-emerald-700 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 ml-1">
          {statusText}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main ChatWidget
// ─────────────────────────────────────────────────────────────

const PLACEHOLDERS = {
  'en-IN': 'Ask about schemes eligibility, benefits…',
  'ta-IN': 'திட்டங்களின் தகுதி, பலன்கள் பற்றி கேளுங்கள்…',
  'hi-IN': 'योजनाओं की पात्रता, लाभ के बारे में पूछें…',
  'te-IN': 'పథకాల అర్హత, ప్రయోజనాల గురించి అడగండి…',
  'auto': 'Ask in English, தமிழ், हिन्दी, or తెలుగు…',
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [language, setLanguage] = useState('en-IN')
  const [enableTts, setEnableTts] = useState(true)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordingTimerRef = useRef(null)

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Namaste 🙏 I am your KisanGuard Agricultural Scheme Advisory Assistant.\n\nI can guide you with verified information from official Ministry guidelines across all 5 key agricultural schemes:\n• **PM-KISAN:** Income support (₹6,000/year), eligibility, exclusion rules, and eKYC/DBT.\n• **PMFBY (Crop Insurance):** Coverage against weather risks, seasonal premium rates, and loss claim processes.\n• **Physical Verification:** 5% mandatory field audits, verification checklists, and recovery norms.\n• **Procurement & MSP:** Minimum Support Price procurement, FAQ quality standards, and direct farmer payment timelines.\n• **Digital Declarations:** Self-declaration forms, land record seeding, and digital portal authentication.\n\nWhich scheme or topic would you like to explore today?',
      sources: [],
      language: 'en-IN',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('Thinking…')
  const [error, setError] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, open])

  // Focus input when panel opens
  useEffect(() => {
    if (open && !isRecording) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, isRecording])

  // Timer for voice recording
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

  // ── Voice Recording Functions ──────────────────────────────

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
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((t) => t.stop())

        if (audioChunksRef.current.length === 0) return

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        })

        await handleSendVoice(audioBlob)
      }

      mediaRecorderRef.current = recorder
      recorder.start(100) // chunk every 100ms
      setIsRecording(true)
    } catch (err) {
      console.error('Microphone error:', err)
      setError('Could not access microphone. Please allow microphone permission.')
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
      // Discard recorded chunks
      audioChunksRef.current = []
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  // ── Send Voice Message ─────────────────────────────────────

  const handleSendVoice = async (audioBlob) => {
    setLoading(true)
    setLoadingStatus('Transcribing Voice (Sarvam STT)…')
    setError(null)

    // Build history
    const historyPayload = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Temporary placeholder message
    const tempUserMsg = {
      role: 'user',
      content: '🎤 Voice question recorded…',
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      setTimeout(() => setLoadingStatus('Consulting Scheme Knowledge Base…'), 1200)

      const response = await chatAPI.askVoice(
        audioBlob,
        historyPayload,
        language,
        enableTts
      )

      // Replace temporary voice message with actual transcript if returned
      setMessages((prev) => {
        const copy = [...prev]
        if (copy.length > 0 && copy[copy.length - 1].role === 'user') {
          copy[copy.length - 1] = {
            role: 'user',
            content: response.original_query
              ? `🎤 "${response.original_query}"`
              : '🎤 Voice question',
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
          },
        ]
      })
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        'Voice query processing failed. Please try again.'
      setError(msg)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ Voice processing encountered an issue. Please try speaking clearly or typing your question.',
          sources: [],
        },
      ])
    } finally {
      setLoading(false)
      setLoadingStatus('Thinking…')
    }
  }

  // ── Send Text Message ──────────────────────────────────────

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return

    const userMsg = { role: 'user', content: q }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setLoadingStatus('Searching Scheme Knowledge Base…')
    setError(null)

    const historyPayload = messages.slice(1).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      if (language !== 'en-IN') {
        setLoadingStatus('Translating & Retrieving Answers…')
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
        },
      ])
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        'Failed to get an answer. Please try again.'
      setError(msg)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ An error occurred while retrieving scheme information. Please verify your query or try again.',
          sources: [],
        },
      ])
    } finally {
      setLoading(false)
      setLoadingStatus('Thinking…')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content:
          'Namaste 🙏 I am your KisanGuard Agricultural Scheme Advisory Assistant.\n\nI can guide you with verified information from official Ministry guidelines across all 5 key agricultural schemes:\n• **PM-KISAN:** Income support (₹6,000/year), eligibility, exclusion rules, and eKYC/DBT.\n• **PMFBY (Crop Insurance):** Coverage against weather risks, seasonal premium rates, and loss claim processes.\n• **Physical Verification:** 5% mandatory field audits, verification checklists, and recovery norms.\n• **Procurement & MSP:** Minimum Support Price procurement, FAQ quality standards, and direct farmer payment timelines.\n• **Digital Declarations:** Self-declaration forms, land record seeding, and digital portal authentication.\n\nWhich scheme or topic would you like to explore today?',
        sources: [],
        language: 'en-IN',
      },
    ])
    setError(null)
  }

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  return (
    <>
      {/* ── Floating Action Button ─────────────────────────── */}
      <button
        id="chatbot-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open KisanGuard Scheme Assistant"
        title="KisanGuard Scheme Assistant"
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center
          bg-emerald-900 text-white border-2 border-emerald-700
          shadow-lg hover:bg-emerald-800 transition-all duration-200
          ${open ? 'rotate-12 scale-95' : 'hover:scale-110'}`}
      >
        {open ? (
          <CloseIcon className="w-5 h-5" />
        ) : (
          <>
            <BotIcon className="w-6 h-6" />
            <span className="absolute inset-0 rounded-none animate-ping bg-emerald-700 opacity-20 pointer-events-none" />
          </>
        )}
      </button>

      {/* ── Chat Panel ────────────────────────────────────── */}
      {open && (
        <div
          id="chatbot-panel"
          className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]
            flex flex-col bg-white border border-slate-300 shadow-2xl"
          style={{ height: '540px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-emerald-900 text-white px-4 py-2.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              <BotIcon className="w-5 h-5 text-emerald-300" />
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-wider">
                  KisanGuard Scheme Assistant
                </p>
                <p className="font-mono text-[9px] text-emerald-300 uppercase tracking-widest">
                  5 Schemes · Voice &amp; Multilingual
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="chatbot-clear"
                onClick={handleClear}
                title="Clear conversation"
                className="font-mono text-[10px] uppercase tracking-wider text-emerald-300
                  hover:text-white border border-emerald-700 hover:border-emerald-300
                  px-2 py-0.5 transition-colors"
              >
                Clear
              </button>
              <button
                id="chatbot-close"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="text-emerald-300 hover:text-white transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Multilingual & Voice Control Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border-b border-emerald-200 text-xs flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <GlobeIcon className="w-3.5 h-3.5 text-emerald-800" />
              <span className="font-mono text-[10px] text-slate-700 font-semibold uppercase tracking-wider">
                Language:
              </span>
              <select
                id="chatbot-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="text-xs bg-white border border-emerald-300 rounded px-1.5 py-0.5 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-700 cursor-pointer shadow-sm"
              >
                <option value="en-IN">English</option>
                <option value="ta-IN">தமிழ் (Tamil)</option>
                <option value="hi-IN">हिन्दी (Hindi)</option>
                <option value="te-IN">తెలుగు (Telugu)</option>
                <option value="auto">Auto Detect</option>
              </select>
            </div>

            <label className="flex items-center gap-1 cursor-pointer text-[11px] text-slate-700 select-none hover:text-emerald-950 font-medium">
              <input
                type="checkbox"
                checked={enableTts}
                onChange={(e) => setEnableTts(e.target.checked)}
                className="accent-emerald-800 rounded w-3.5 h-3.5"
              />
              <span>🔊 Voice Reply</span>
            </label>
          </div>

          {/* Disclaimer ribbon */}
          <div className="bg-amber-50 border-b border-amber-200 px-3 py-1 flex-shrink-0">
            <p className="font-mono text-[9px] text-amber-800 uppercase tracking-wider">
              ⚠ Answers derived directly from official Ministry scheme operational guidelines.
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-slate-50">
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}
            {loading && <ThinkingIndicator statusText={loadingStatus} />}
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 font-mono text-[11px] text-red-800">
                ⚠ {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Recording Overlay / Bar */}
          {isRecording ? (
            <div className="flex-shrink-0 border-t border-red-200 bg-red-50 p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                <span className="font-mono text-xs font-semibold text-red-700">
                  Listening in {LANGUAGE_BADGES[language] || 'Selected Language'}…
                </span>
                <span className="font-mono text-xs text-red-900 bg-red-200 px-1.5 py-0.5 rounded">
                  {formatTimer(recordingSeconds)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelVoiceRecording}
                  className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={stopVoiceRecording}
                  className="px-3 py-1 text-xs bg-red-600 text-white hover:bg-red-700 rounded font-semibold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <StopIcon className="w-3.5 h-3.5" />
                  <span>Send Voice</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Input bar with Mic & Send */
            <div className="flex-shrink-0 border-t border-slate-200 bg-white p-2 flex items-end gap-1.5">
              <textarea
                id="chatbot-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={PLACEHOLDERS[language] || PLACEHOLDERS['en-IN']}
                rows={2}
                disabled={loading}
                className="flex-1 resize-none px-3 py-1.5 text-sm font-sans bg-white border border-slate-300
                  text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-800
                  transition-colors disabled:opacity-50"
              />

              {/* Microphone / Voice Button */}
              <button
                id="chatbot-mic"
                type="button"
                onClick={startVoiceRecording}
                disabled={loading}
                title="Speak question (Sarvam Voice STT)"
                className="p-2.5 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-300
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 rounded"
              >
                <MicIcon className="w-4 h-4" />
              </button>

              {/* Text Send Button */}
              <button
                id="chatbot-send"
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label="Send"
                title="Send question"
                className="p-2.5 bg-emerald-900 text-white hover:bg-emerald-800
                  transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 rounded"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex-shrink-0 bg-white border-t border-slate-100 px-3 py-1">
            <p className="font-mono text-[9px] text-slate-400 uppercase tracking-wider text-center">
              Sarvam AI (STT · Translate · Bulbul v3 TTS) · Ministry of Agriculture GOI
            </p>
          </div>
        </div>
      )}
    </>
  )
}
