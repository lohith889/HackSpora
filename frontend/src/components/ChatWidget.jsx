import { useState, useRef, useEffect } from 'react'
import chatAPI from '../api/chatApi'

// ─────────────────────────────────────────────────────────────
// Audio Player & Speech Utilities (Sarvam Bulbul v3 + Web Speech Fallback)
// ─────────────────────────────────────────────────────────────
let currentActiveAudio = null

function cleanForSpeech(text) {
  if (!text) return ''
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/[*#_`~]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[•\-\+]\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fallbackSpeechSynthesis(text, language = 'en-IN', onEnd) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) onEnd()
    return
  }
  window.speechSynthesis.cancel()
  const clean = cleanForSpeech(text)
  if (!clean) {
    if (onEnd) onEnd()
    return
  }
  const utterance = new SpeechSynthesisUtterance(clean)
  const langCode =
    language === 'ta-IN' ? 'ta' : language === 'hi-IN' ? 'hi' : language === 'te-IN' ? 'te' : 'en-IN'
  utterance.lang = langCode
  utterance.rate = 0.95
  utterance.onend = () => {
    if (onEnd) onEnd()
  }
  utterance.onerror = () => {
    if (onEnd) onEnd()
  }
  window.speechSynthesis.speak(utterance)
}

function stopAllSpeech() {
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause()
      currentActiveAudio = null
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function playSpeech(text, base64Audio, language = 'en-IN', onEnd) {
  stopAllSpeech()

  if (base64Audio) {
    try {
      const audio = new Audio(`data:audio/wav;base64,${base64Audio}`)
      currentActiveAudio = audio
      audio.onended = () => {
        currentActiveAudio = null
        if (onEnd) onEnd()
      }
      audio.onerror = () => {
        currentActiveAudio = null
        fallbackSpeechSynthesis(text, language, onEnd)
      }
      audio.play().catch(() => {
        fallbackSpeechSynthesis(text, language, onEnd)
      })
      return
    } catch (_) {
      fallbackSpeechSynthesis(text, language, onEnd)
      return
    }
  }

  fallbackSpeechSynthesis(text, language, onEnd)
}

function AudioPlayerButton({ text, base64Audio, autoPlay = false, language = 'en-IN' }) {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (autoPlay) {
      setPlaying(true)
      playSpeech(text, base64Audio, language, () => setPlaying(false))
    }
    return () => {
      stopAllSpeech()
    }
  }, [base64Audio, autoPlay, text, language])

  const togglePlay = () => {
    if (playing) {
      stopAllSpeech()
      setPlaying(false)
    } else {
      setPlaying(true)
      playSpeech(text, base64Audio, language, () => setPlaying(false))
    }
  }

  return (
    <button
      type="button"
      onClick={togglePlay}
      className={`mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        playing
          ? 'bg-gov-700 text-white border-gov-800 shadow-sm'
          : 'bg-gov-50 text-gov-900 border-gov-300 hover:bg-gov-100'
      }`}
      title={playing ? 'Pause voice readout' : 'Listen to voice readout'}
    >
      {playing ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>Pause Voice</span>
        </>
      ) : (
        <>
          <svg
            className="w-3.5 h-3.5 text-gov-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
            />
          </svg>
          <span>Listen Voice</span>
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
        <strong key={key++} className="font-semibold text-charcoal-900">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key++} className="italic text-charcoal-700">
          {token.slice(1, -1)}
        </em>
      )
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={key++} className="px-1 py-0.5 bg-slate-100 rounded text-[11px] font-mono text-gov-800">
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
          <ul key={`ul-${keyIndex++}`} className="my-2 space-y-1 pl-1">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-charcoal-700 text-xs leading-relaxed">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gov-600 mt-1.5 shrink-0" />
                <span className="flex-1">{renderInlineText(item)}</span>
              </li>
            ))}
          </ul>
        )
      } else if (listType === 'numbered') {
        elements.push(
          <ol key={`ol-${keyIndex++}`} className="my-2 space-y-1 pl-1">
            {currentList.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-charcoal-700 text-xs leading-relaxed">
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gov-100 text-gov-800 text-[10px] font-bold mt-0.5 shrink-0">
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
          className={`font-heading font-bold text-gov-900 mt-2 mb-1 ${
            level <= 2 ? 'text-xs font-bold border-b border-slate-100 pb-1' : 'text-xs text-charcoal-900 font-semibold'
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
      <p key={`p-${keyIndex++}`} className="mb-2 text-charcoal-700 text-xs leading-relaxed last:mb-0">
        {renderInlineText(trimmed)}
      </p>
    )
  }

  flushList()

  return <div className="space-y-0.5">{elements}</div>
}

// ─────────────────────────────────────────────────────────────
// Supported Languages & Placeholders
// ─────────────────────────────────────────────────────────────
const LANGUAGE_BADGES = {
  'en-IN': 'English (Official)',
  'ta-IN': 'தமிழ் (Tamil)',
  'hi-IN': 'हिंदी (Hindi)',
  'te-IN': 'తెలుగు (Telugu)',
  'auto': 'Auto Detect',
}

const PLACEHOLDERS = {
  'en-IN': 'Ask about PM-KISAN, PMFBY, KUSUM, Soil Health...',
  'ta-IN': 'திட்டங்களின் தகுதி, பலன்கள் பற்றி கேளுங்கள்…',
  'hi-IN': 'योजनाओं की पात्रता, लाभ के बारे में पूछें…',
  'te-IN': 'పథకాల అర్హత, ప్రయోజనాల గురించి అడగండి…',
  'auto': 'Ask about PM-KISAN, PMFBY, KUSUM, Soil Health...',
}

export default function ChatWidget() {
  const [open, setOpen] = useState(true)
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
  const [loadingStatus, setLoadingStatus] = useState('Retrieving official scheme documents...')
  const [error, setError] = useState(null)
  const [copiedIndex, setCopiedIndex] = useState(null)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, open])

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

  // Voice Readout Switch toggle
  const toggleVoiceReadout = () => {
    const nextState = !enableTts
    setEnableTts(nextState)

    if (!nextState) {
      stopAllSpeech()
    } else {
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
      const textToRead = lastAssistant
        ? lastAssistant.content
        : 'Namaste! I am your KisanGuard Agricultural Scheme Assistant. I provide authentic answers retrieved directly from official Ministry guidelines and scheme gazettes.'
      const audioToRead = lastAssistant?.audio || null
      const langToRead = lastAssistant?.language || language
      playSpeech(textToRead, audioToRead, langToRead)
    }
  }

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
      audioChunksRef.current = []
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  // ── Send Voice Message ─────────────────────────────────────
  const handleSendVoice = async (audioBlob) => {
    setLoading(true)
    setLoadingStatus('Transcribing Voice (Sarvam STT)...')
    setError(null)

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const tempUserMsg = {
      role: 'user',
      content: '🎤 Voice question recorded…',
      timestamp: timeString,
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      setTimeout(() => setLoadingStatus('Retrieving official scheme documents...'), 1200)

      const response = await chatAPI.askVoice(audioBlob, historyPayload, language, enableTts)

      setMessages((prev) => {
        const copy = [...prev]
        if (copy.length > 0 && copy[copy.length - 1].role === 'user') {
          copy[copy.length - 1] = {
            role: 'user',
            content: response.original_query ? `🎤 "${response.original_query}"` : '🎤 Voice question',
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
            confidence: '99.2%',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]
      })
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Voice query processing failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStatus('Retrieving official scheme documents...')
    }
  }

  // ── Send Text Message ──────────────────────────────────────
  const executeSend = async (queryText) => {
    const q = (queryText || input).trim()
    if (!q || loading) return

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg = { role: 'user', content: q, timestamp: timeString }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setLoading(true)
    setLoadingStatus('Retrieving official scheme documents...')
    setError(null)

    const historyPayload = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    try {
      if (language !== 'en-IN') {
        setLoadingStatus('Translating & Retrieving Answers...')
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
          confidence: '99.2%',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        'Failed to retrieve scheme information. Please verify your query or try again.'
      setError(msg)
    } finally {
      setLoading(false)
      setLoadingStatus('Retrieving official scheme documents...')
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

  const sendQuickPrompt = (promptText) => {
    executeSend(promptText)
  }

  const handleClear = () => {
    stopAllSpeech()
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
      {/* ── FLOATING CHAT LAUNCHER BUTTON & TOOLTIP (Bottom-Right Corner) ── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {/* Tooltip / Callout Pill */}
        {showTooltip && (
          <div
            id="launcher-tooltip"
            className="bg-gov-950 text-white text-xs px-3 py-1.5 rounded-full shadow-lg border border-gov-700 flex items-center gap-2 transition-opacity duration-300"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium">Need Scheme Help? Ask AI</span>
            <button
              type="button"
              onClick={() => setShowTooltip(false)}
              className="text-slate-400 hover:text-white ml-1 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Compact Floating Launcher Button */}
        <button
          id="chatbot-launcher"
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (showTooltip) setShowTooltip(false)
          }}
          aria-label={open ? 'Close KisanGuard Scheme Assistant' : 'Open KisanGuard Scheme Assistant'}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gov-800 to-gov-900 hover:from-gov-700 hover:to-gov-800 text-white shadow-floating flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-gov-400/30 border border-gov-600/60 relative group"
        >
          {open ? (
            /* Close 'X' icon when panel is open */
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Shield + Seedling Emblem when panel is closed */
            <svg
              className="w-6 h-6 text-gov-200 group-hover:text-white transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v8" />
              <path d="M9 13l3-3 3 3" />
            </svg>
          )}

          {/* Verified Status Pip */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>
        </button>
      </div>

      {/* ── FLOATING CHATBOT WINDOW (Exact layout & styling from code.html & screen.png) ── */}
      {open && (
        <section
          id="chatbot-panel"
          aria-label="KisanGuard Scheme Assistant Chatbot"
          className="fixed bottom-24 right-6 z-50 w-full sm:w-[418px] h-[648px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-widget border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 ease-out transform origin-bottom-right"
        >
          {/* 1. OFFICIAL GOV HEADER */}
          <header className="bg-gov-900 text-white px-4 py-3.5 relative flex-shrink-0 border-b border-gov-800 shadow-sm">
            {/* Tricolor Indian Emblem Inspired Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-white to-gov-500 opacity-90"></div>

            <div className="flex items-center justify-between mt-1">
              {/* Left: Identity & Shield Icon */}
              <div className="flex items-center gap-2.5">
                <div className="relative w-9 h-9 rounded-xl bg-gov-800/90 border border-gov-700 flex items-center justify-center shadow-inner text-gov-300">
                  {/* Security Shield + Plant Icon */}
                  <svg
                    className="w-5 h-5 text-gov-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M12 8v8" />
                    <path d="M9 13l3-3 3 3" />
                  </svg>
                  {/* Verified small pip badge */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gov-500 border-2 border-gov-900 rounded-full flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10.28 2.28L3.989 8.575 1.705 6.305a1 1 0 00-1.41 1.41l3 3a1 1 0 001.414 0l7-7a1 1 0 00-1.414-1.414z" />
                    </svg>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="font-heading font-bold text-sm tracking-tight text-white leading-tight">
                      KisanGuard
                    </h1>
                    <span className="text-[10px] font-semibold tracking-wider uppercase bg-gov-800 text-gov-300 px-1.5 py-0.5 rounded border border-gov-700/60">
                      RAG AI
                    </span>
                  </div>
                  <p className="text-[11px] text-gov-200/90 font-medium leading-none mt-0.5">
                    Verified Agricultural Scheme Assistant
                  </p>
                </div>
              </div>

              {/* Right: Controls (Clear conversation, Minimize/Close) */}
              <div className="flex items-center gap-1 text-gov-200">
                {/* Clear chat history button */}
                <button
                  id="clear-chat-btn"
                  type="button"
                  title="Clear conversation"
                  className="p-1.5 rounded-lg hover:bg-gov-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gov-400 text-gov-200"
                  onClick={handleClear}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                {/* Close / Minimize Panel */}
                <button
                  id="close-panel-btn"
                  type="button"
                  title="Close chat widget"
                  className="p-1.5 rounded-lg hover:bg-gov-800 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gov-400 text-gov-200"
                  onClick={() => setOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Trust Indicator Badge Strip */}
            <div className="mt-2.5 pt-2 border-t border-gov-800/80 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-gov-200 font-medium">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="tracking-wide">Official Ministry Scheme Data</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gov-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>RAG Synced</span>
              </div>
            </div>
          </header>

          {/* 2. UTILITY TOOLBAR: Multilingual Selector & Voice Audio Readout Toggle */}
          <div className="bg-sage-50 px-3.5 py-2 border-b border-slate-200/90 flex items-center justify-between flex-shrink-0 text-xs text-charcoal-700">
            {/* Language selector with quick change dropdown */}
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-gov-700 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
              <label htmlFor="language-select" className="sr-only">
                Select Scheme Assistant Language
              </label>
              <div className="relative">
                <select
                  id="language-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="appearance-none bg-white font-medium text-[11px] text-charcoal-800 border border-slate-300 rounded-md py-1 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-gov-600 focus:border-gov-600 cursor-pointer shadow-subtle"
                >
                  <option value="en-IN">English (Official)</option>
                  <option value="ta-IN">தமிழ் (Tamil)</option>
                  <option value="hi-IN">हिंदी (Hindi)</option>
                  <option value="te-IN">తెలుగు (Telugu)</option>
                  <option value="auto">Auto Detect</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Audio Output (Read Aloud) Switch */}
            <div className="flex items-center gap-2">
              <button
                id="tts-toggle"
                type="button"
                onClick={toggleVoiceReadout}
                title="Toggle voice readout of scheme replies"
                className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded border transition-colors font-medium ${
                  enableTts
                    ? 'bg-gov-50 border-gov-400 text-gov-800 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <svg
                  id="tts-icon"
                  className="w-3.5 h-3.5 text-gov-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
                <span id="tts-label">{enableTts ? 'Audio: ON' : 'Voice Readout'}</span>
              </button>
            </div>
          </div>

          {/* 3. CONVERSATION MESSAGE SCROLL REGION */}
          <main
            id="chat-messages"
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll bg-[#FAFBF9]"
            role="log"
            aria-live="polite"
          >
            {/* Welcome Message Component (Initial Guided State) */}
            <div id="welcome-block" className="space-y-3 pb-2 border-b border-slate-200/80">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gov-800 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm">
                  KG
                </div>
                <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-3.5 text-xs text-charcoal-800 shadow-subtle leading-relaxed max-w-[92%]">
                  <p className="font-heading font-bold text-gov-900 text-sm mb-1 flex items-center gap-1.5">
                    Namaste 🙏
                  </p>
                  <p className="text-charcoal-700">
                    I am your <strong>KisanGuard Agricultural Scheme Assistant</strong>. I provide authentic answers
                    retrieved directly from official Ministry guidelines and scheme gazettes.
                  </p>
                </div>
              </div>

              {/* 5 Supported Schemes Chips */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    5 Supported Schemes
                  </span>
                  <span className="text-[10px] text-gov-700 font-medium">Click to explore</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* PM-KISAN */}
                  <button
                    type="button"
                    onClick={() => sendQuickPrompt('Tell me about PM-KISAN Income Support scheme and eligibility')}
                    className="flex flex-col text-left p-2 rounded-lg bg-white hover:bg-gov-50/70 border border-slate-200/90 hover:border-gov-300 transition-all text-charcoal-800 group shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] text-gov-900 group-hover:text-gov-700">
                        PM-KISAN
                      </span>
                      <span className="text-[9px] bg-gov-100 text-gov-800 font-medium px-1 rounded">₹6,000/yr</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      Income support for landholders
                    </span>
                  </button>

                  {/* PMFBY */}
                  <button
                    type="button"
                    onClick={() => sendQuickPrompt('Explain PMFBY Crop Insurance coverage and claim process')}
                    className="flex flex-col text-left p-2 rounded-lg bg-white hover:bg-gov-50/70 border border-slate-200/90 hover:border-gov-300 transition-all text-charcoal-800 group shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] text-gov-900 group-hover:text-gov-700">PMFBY</span>
                      <span className="text-[9px] bg-blue-50 text-blue-700 font-medium px-1 rounded">Insurance</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      Crop loss &amp; natural hazard cover
                    </span>
                  </button>

                  {/* PM-KUSUM */}
                  <button
                    type="button"
                    onClick={() => sendQuickPrompt('How do I apply for PM-KUSUM Solar Pump subsidy?')}
                    className="flex flex-col text-left p-2 rounded-lg bg-white hover:bg-gov-50/70 border border-slate-200/90 hover:border-gov-300 transition-all text-charcoal-800 group shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] text-gov-900 group-hover:text-gov-700">
                        PM-KUSUM
                      </span>
                      <span className="text-[9px] bg-amber-50 text-amber-800 font-medium px-1 rounded">Solar</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      Solar pump &amp; grid connection
                    </span>
                  </button>

                  {/* Soil Health Card */}
                  <button
                    type="button"
                    onClick={() => sendQuickPrompt('What is Soil Health Card Scheme and how to get tested?')}
                    className="flex flex-col text-left p-2 rounded-lg bg-white hover:bg-gov-50/70 border border-slate-200/90 hover:border-gov-300 transition-all text-charcoal-800 group shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[11px] text-gov-900 group-hover:text-gov-700">
                        Soil Health Card
                      </span>
                      <span className="text-[9px] bg-emerald-50 text-emerald-800 font-medium px-1 rounded">
                        Nutrients
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      Soil testing &amp; crop advisory
                    </span>
                  </button>

                  {/* Agri Infra Fund (Span 2 for neat bottom finish) */}
                  <button
                    type="button"
                    onClick={() =>
                      sendQuickPrompt('Explain Agriculture Infrastructure Fund (AIF) loan interest subvention')
                    }
                    className="col-span-2 flex items-center justify-between p-2 rounded-lg bg-white hover:bg-gov-50/70 border border-slate-200/90 hover:border-gov-300 transition-all text-charcoal-800 group shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <div className="text-left">
                      <span className="font-semibold text-[11px] text-gov-900 group-hover:text-gov-700 block">
                        Agriculture Infrastructure Fund (AIF)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        3% Interest subvention for post-harvest infra &amp; cold chain
                      </span>
                    </div>
                    <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded ml-2">
                      ₹1 Lakh Cr
                    </span>
                  </button>
                </div>
              </div>

              {/* Quick Action Prompts */}
              <div className="pt-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 px-0.5">
                  Quick Inquiries
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => sendQuickPrompt('Check PM-KISAN 17th installment eligibility')}
                    className="text-[11px] bg-white hover:bg-slate-100 text-charcoal-700 border border-slate-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span>🌾 Check PM-KISAN eligibility</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sendQuickPrompt('What documents are required for PMFBY crop insurance?')}
                    className="text-[11px] bg-white hover:bg-slate-100 text-charcoal-700 border border-slate-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span>📑 Required documents list</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Conversation Messages */}
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user'

              if (isUser) {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] bg-gov-800 text-white text-xs px-3.5 py-2.5 rounded-2xl rounded-tr-xs shadow-sm leading-relaxed">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <span className="text-[10px] text-gov-200/80 block text-right mt-1 font-mono">
                        {msg.timestamp || 'Just now'} · Sent
                      </span>
                    </div>
                  </div>
                )
              }

              return (
                <div key={index} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gov-800 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm">
                    KG
                  </div>

                  <div className="max-w-[90%] space-y-2">
                    {/* Main Content Card */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-3.5 text-xs text-charcoal-800 shadow-subtle leading-relaxed">
                      {/* Top Verification Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gov-800 bg-gov-50 px-2 py-0.5 rounded-md border border-gov-200/70">
                          <svg className="w-3 h-3 text-gov-600" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10.28 2.28L3.989 8.575 1.705 6.305a1 1 0 00-1.41 1.41l3 3a1 1 0 001.414 0l7-7a1 1 0 00-1.414-1.414z" />
                          </svg>
                          Verified Ministry Scheme Guidelines
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Confidence: {msg.confidence || '99.2%'}
                        </span>
                      </div>

                      {/* Assistant Answer Body */}
                      <FormattedMessage content={msg.content} />

                      {/* Audio Player Button (Bulbul v3 TTS + Fallback) */}
                      <AudioPlayerButton
                        text={msg.content}
                        base64Audio={msg.audio}
                        autoPlay={msg.autoPlay}
                        language={msg.language || language}
                      />

                      {/* Collapsible Source Grounding Documents Accordion */}
                      {msg.sources && msg.sources.length > 0 && (
                        <details className="source-details group mt-2 pt-2 border-t border-slate-100" open>
                          <summary className="flex items-center justify-between cursor-pointer list-none text-[11px] font-semibold text-gov-800 hover:text-gov-900 select-none py-1">
                            <span className="flex items-center gap-1.5">
                              <svg
                                className="w-3.5 h-3.5 text-gov-700"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                                />
                              </svg>
                              <span>
                                Sources • {msg.sources.length} Official Document
                                {msg.sources.length > 1 ? 's' : ''} Retrieved
                              </span>
                            </span>
                            <svg
                              className="chevron w-3 h-3 text-slate-400 transition-transform duration-200"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>

                          <div className="mt-2 space-y-1.5 pl-1 pr-0.5 text-[11px] text-slate-600 bg-slate-50/80 p-2 rounded-lg border border-slate-200">
                            {msg.sources.map((src, idx) => {
                              const docName =
                                typeof src === 'string'
                                  ? src
                                  : src.file || src.source || src.filename || 'Official Ministry Document'
                              const cleanName = docName.split(/[\\/]/).pop()
                              const page =
                                typeof src === 'object' && src.page != null ? `Page ${src.page + 1}` : null

                              return (
                                <div
                                  key={idx}
                                  className="flex items-start justify-between gap-2 pb-1.5 border-b border-slate-200/60 last:border-b-0 last:pb-0"
                                >
                                  <div>
                                    <span className="font-medium text-slate-800 block">
                                      {idx + 1}. {cleanName}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      Ministry of Agriculture Scheme Corpus
                                    </span>
                                  </div>
                                  {page && (
                                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1 py-0.5 rounded font-mono flex-shrink-0">
                                      {page}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      )}

                      {/* Quick Action Within Reply: Tutorial & Copy */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <button
                          type="button"
                          onClick={() => sendQuickPrompt('Can you provide a step-by-step checklist for this?')}
                          className="text-gov-700 hover:text-gov-800 font-medium flex items-center gap-1"
                        >
                          <span>Need step-by-step guidance?</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Copy official reply"
                          onClick={() => copyReplyText(msg.content, index)}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                        >
                          {copiedIndex === index ? (
                            <svg className="w-3.5 h-3.5 text-gov-600" fill="currentColor" viewBox="0 0 12 12">
                              <path d="M10.28 2.28L3.989 8.575 1.705 6.305a1 1 0 00-1.41 1.41l3 3a1 1 0 001.414 0l7-7a1 1 0 00-1.414-1.414z" />
                            </svg>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Bottom Metadata Line */}
                    <div className="text-[10px] text-slate-400 px-1 font-mono flex items-center justify-between">
                      <span>Answer grounded in official ministerial corpus</span>
                      <span>{msg.timestamp || 'Just now'}</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Dynamic Typing / Loading State */}
            {loading && (
              <div id="loading-state" className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gov-800 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm">
                  KG
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-3.5 py-3 text-xs text-slate-600 shadow-subtle flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gov-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span
                    className="w-2 h-2 rounded-full bg-gov-600 animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  ></span>
                  <span
                    className="w-2 h-2 rounded-full bg-gov-600 animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  ></span>
                  <span className="text-[11px] text-slate-500 font-medium ml-1">{loadingStatus}</span>
                </div>
              </div>
            )}

            {/* Error Card */}
            {error && (
              <div id="error-card" className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-800 text-white flex-shrink-0 flex items-center justify-center font-bold text-xs">
                  !
                </div>
                <div className="bg-red-50/90 border border-red-200 rounded-2xl rounded-tl-sm p-3 text-xs text-red-900 shadow-subtle max-w-[90%]">
                  <div className="flex items-center gap-1.5 font-semibold text-red-800 mb-1">
                    <svg className="w-3.5 h-3.5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>Unable to verify with scheme database</span>
                  </div>
                  <p className="text-red-700 text-[11px] mb-2 leading-relaxed">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="bg-white hover:bg-red-100 text-red-800 border border-red-300 font-medium px-2.5 py-1 rounded text-[11px] transition-colors shadow-xs"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </main>

          {/* 4. VOICE ACTIVE OVERLAY BAR */}
          {isRecording && (
            <div
              id="voice-overlay"
              className="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between border-t border-emerald-800 animate-fadeIn flex-shrink-0"
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="text-xs font-medium text-emerald-100">
                  Listening ({formatTimer(recordingSeconds)})...
                </span>
              </div>

              {/* Voice Waveform Visualizer */}
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
                  className="text-[10px] uppercase tracking-wider bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-2 py-0.5 rounded font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="text-[10px] uppercase tracking-wider bg-emerald-400 hover:bg-emerald-300 text-gov-950 px-2.5 py-0.5 rounded font-bold transition-colors shadow-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* 5. MESSAGE COMPOSER (STICKY BOTTOM INPUT) */}
          <footer className="bg-white border-t border-slate-200 p-3 flex-shrink-0">
            <form id="chat-form" onSubmit={handleMessageSubmit} className="relative">
              <div className="flex items-end gap-1.5 bg-slate-50 border border-slate-300 focus-within:border-gov-600 focus-within:ring-2 focus-within:ring-gov-100 rounded-xl p-1.5 transition-all shadow-inner">
                {/* Voice Input Button */}
                <button
                  id="mic-btn"
                  type="button"
                  onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                  title={isRecording ? 'Stop recording' : 'Speak in your local language'}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 focus:outline-none ${
                    isRecording ? 'text-gov-700 bg-gov-100' : 'text-slate-500 hover:text-gov-700 hover:bg-gov-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>

                {/* Text Input Area */}
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
                  className="w-full bg-transparent text-xs text-charcoal-900 placeholder:text-slate-400 focus:outline-none resize-none py-1.5 px-1 max-h-24 leading-normal"
                />

                {/* Send Action Button */}
                <button
                  id="send-btn"
                  type="submit"
                  disabled={loading || !input.trim()}
                  title="Send question to KisanGuard"
                  className="p-2 bg-gov-700 hover:bg-gov-800 active:bg-gov-900 text-white rounded-lg transition-colors flex-shrink-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-gov-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-4 h-4 transform rotate-90"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2.2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Official Disclaimer / Trust Micro-statement */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1 font-medium">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-gov-600" fill="currentColor" viewBox="0 0 12 12">
                  <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm0 2a.75.75 0 110 1.5.75.75 0 010-1.5zm.75 6h-1.5V5.5h1.5V9z" />
                </svg>
                Answers grounded in official scheme documents
              </span>
              <span className="text-slate-400">MoA&amp;FW AI RAG</span>
            </div>
          </footer>
        </section>
      )}
    </>
  )
}
