import { useState, useRef, useCallback, useEffect } from 'react'
import AvatarPanel from './components/AvatarPanel'
import ChatPanel from './components/ChatPanel'
import AuthModal from './components/AuthModal'
import styles from './App.module.css'
import { newSessionId, saveChat, getUser, clearAuth, verifyToken } from './lib/api'
import { MicRecorder, isMicRecorderSupported } from './lib/stt'

// cha-bot-starter-kit
// ─────────────────────────────────────────────────────────────
// VRoid VRM (browser-rendered via three-vrm) + streaming chat +
// voice (STT/TTS). Three conversation modes:
//   ftf : face-to-face (avatar + camera + voice)
//   sts : speech-to-speech (avatar + voice, no camera)
//   ttt : text-to-text (text-only, no avatar/mic)
//
// Backend endpoints (Vercel serverless, see /api):
//   /api/chat-stream   SSE LLM stream
//   /api/tts           text → audio
//   /api/stt           audio → text
//
// All three proxy to your on-premise server (configure in .env).

// Delay (ms) between bot finishing speech and resuming the mic.
// Lets speaker echo decay before the mic listens again.
const ECHO_RESUME_DELAY_MS = 700

// ─── Greetings — replace these to match your bot's persona ───
// Plain text shown in chat. TTS text is the same by default but you can
// adjust (e.g. expand abbreviations, add pauses) for more natural speech.
const GREETING_TEXT = '안녕하세요, 곳간지기 곳간이예요. 이번 달 현금 흐름부터 돌려받을 환불까지 제가 꼼꼼히 챙겨드릴게요. 무엇이 궁금하세요?'
const GREETING_TTS  = '안녕하세요, 곳간지기 곳간이예요. 이번 달 현금 흐름부터 돌려받을 환불까지 제가 꼼꼼히 챙겨드릴게요. 무엇이 궁금하세요?'

// 곳간이 음색 — 서버(omnivoice)의 emo_manifest 검증을 통과하는 안전한 값으로 고정.
// 기존의 길고 자유로운 문자열('cute and cheerful ...')은 서버가 500을 던질 수 있어,
// 프록시 기본값과 동일한 검증된 어휘로 되돌렸다.
// 톤을 다시 키우려면 서버가 허용하는 단어를 하나씩 추가하며 테스트할 것.
const GOTGANI_VOICE = 'female, young adult, moderate pitch, korean accent'

function normalizeTranscript(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

// Remove emoji + normalize a few common technical acronyms for cleaner TTS.
// Extend this for your domain.
function normalizeTtsText(text) {
  if (!text) return ''
  return String(text)
    .replace(/😊|😀|😃|😄|😁|🙂|😉|👍|🙏|✨|💡|📌|🎓|📷|🎙|🎤|▶|■|◉/g, '')
    .replace(/\bAI\b/gi, '에이아이')
    .replace(/\bGPT\b/gi, '지피티')
    .replace(/\bAPI\b/gi, '에이피아이')
    .replace(/\bURL\b/gi, '유알엘')
    .replace(/\bCSV\b/gi, '씨에스브이')
    .replace(/\bPB\b/g, '피비')
    .replace(/\bD-?7\b/gi, '디데이 7일')
    .replace(/\bYONO\b/gi, '요노')
    .replace(/\bYOLO\b/gi, '욜로')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function BotApp({ embedded = false, pendingQuestion = null } = {}) {
  const [status, setStatus]             = useState('idle')   // idle | connecting | connected | speaking
  const [messages, setMessages]         = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [videoReady, setVideoReady]     = useState(false)    // VRM 로드 완료 여부
  const [isListening, setIsListening]   = useState(false)
  const [autoListen, setAutoListen]     = useState(false)
  const [conversationMode, setConversationMode] = useState('ftf')  // ftf | sts | ttt
  const [cameraStream, setCameraStream] = useState(null)
  const [user, setUser] = useState(getUser())   // 로그인된 사용자 (없으면 null = 익명)
  const [authOpen, setAuthOpen] = useState(() => !getUser())
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    // data-theme이 이미 설정돼 있으면 그걸 따르고(사이트와 통일), 없으면 저장값/라이트
    const dom = document.documentElement.getAttribute('data-theme')
    if (dom === 'dark' || dom === 'light') return dom
    return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // 대시보드 쪽 토글 등 외부에서 data-theme이 바뀌면 챗봇도 따라감
  useEffect(() => {
    const sync = () => {
      const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
      setTheme(prev => (prev === t ? prev : t))
    }
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('storage', sync)
    return () => { obs.disconnect(); window.removeEventListener('storage', sync) }
  }, [])

  // 토큰 검증 — 성공하면 모달 닫음 / 실패하면 모달 유지
  useEffect(() => {
    verifyToken().then(u => {
      if (u) { setUser(u); setAuthOpen(false) }
    })
  }, [])

  const handleLogout = () => { clearAuth(); setUser(null) }

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  const vrmAvatarRef      = useRef(null)   // <VRMAvatar> imperative handle (speak/stopSpeaking/...)
  const sessionRef        = useRef(null)   // 아바타 세션 활성 플래그 (ftf/sts true, idle/ttt null)
  const userVideoRef      = useRef(null)
  const cameraStreamRef   = useRef(null)
  const historyRef        = useRef([])

  // ─── TTS 큐 (streaming 응답을 문장 단위로 순차 재생) ───
  // sendMessage 가 문장 boundary 만날 때마다 enqueueTTS(sentence) 호출.
  // 큐 프로세서가 fetch /api/tts + vrmAvatar.speak() 를 순차 실행.
  // ESC 인터럽트 시 clearTTSQueue() 로 큐 비우고 진행 중인 음성 중단.
  const ttsQueueRef       = useRef([])     // 대기 중인 문장 배열 (Promise<ArrayBuffer>)
  const ttsRunningRef     = useRef(false)
  const ttsAbortRef       = useRef(false)
  const sessionIdRef      = useRef(null)
  const conversationModeRef = useRef('ftf')

  // ─── 폴백 오디오 재생 (Web Audio API) ─────────────────────────────────
  // 아바타(VRM)가 아직 로드되지 않았거나 speak 핸들이 없을 때, TTS 버퍼를
  // 직접 재생해서 "소리가 아예 안 나는" 상황을 막는다.
  // 또한 브라우저 autoplay 정책 때문에 사용자 제스처 전에는 AudioContext가
  // suspended 상태라, 시작 버튼 등에서 resume 해줘야 소리가 난다.
  const audioCtxRef        = useRef(null)
  const currentSourceRef   = useRef(null)

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return null
      audioCtxRef.current = new Ctx()
    }
    // 사용자 제스처 컨텍스트에서 호출되면 잠금 해제됨
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    return audioCtxRef.current
  }, [])

  // ArrayBuffer(오디오) 직접 재생. 재생이 끝나면 resolve (큐 페이싱·에코가드 유지).
  const playBufferFallback = useCallback(async (buf) => {
    const ctx = ensureAudioContext()
    if (!ctx || !buf) return
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch {} }

    // decodeAudioData는 버퍼를 detach 하므로 복사본을 넘긴다.
    let audioBuffer
    try {
      audioBuffer = await ctx.decodeAudioData(buf.slice(0))
    } catch (e) {
      console.warn('[tts fallback] decode fail:', e)
      return
    }

    await new Promise((resolve) => {
      const src = ctx.createBufferSource()
      src.buffer = audioBuffer
      src.connect(ctx.destination)
      currentSourceRef.current = src
      src.onended = () => {
        if (currentSourceRef.current === src) currentSourceRef.current = null
        resolve()
      }
      try { src.start(0) } catch { resolve() }
    })
  }, [ensureAudioContext])

  const stopFallbackAudio = useCallback(() => {
    const src = currentSourceRef.current
    if (src) {
      try { src.onended = null; src.stop(0) } catch {}
      currentSourceRef.current = null
    }
  }, [])

  const handleAvatarReady = useCallback(() => {
    setVideoReady(true)
  }, [])

  // ─── STT (MicRecorder, sends audio chunks to /api/stt) ────────────────
  // Web Speech API는 iOS Safari / 카카오 in-app 브라우저에서 불안정 → 자체 녹음 + 서버 transcribe.
  const micRecorderRef    = useRef(null)
  const isSpeakingRef     = useRef(false)
  const isProcessingRef   = useRef(false)
  const autoListenRef     = useRef(false)
  const isListeningRef    = useRef(false)
  const echoResumeTimerRef = useRef(null)
  const lastSubmittedSpeechRef = useRef({ key: '', at: 0 })

  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])
  useEffect(() => { autoListenRef.current   = autoListen }, [autoListen])
  useEffect(() => { isListeningRef.current  = isListening }, [isListening])
  useEffect(() => { isSpeakingRef.current   = (status === 'speaking') }, [status])
  useEffect(() => { conversationModeRef.current = conversationMode }, [conversationMode])

  useEffect(() => {
    if (userVideoRef.current) userVideoRef.current.srcObject = cameraStream || null
  }, [cameraStream])

  const stopUserCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop())
      cameraStreamRef.current = null
    }
    setCameraStream(null)
  }, [])

  // 카메라 프레임 1장 캡처 → JPEG data URL (없으면 null)
  const captureCameraFrame = useCallback(() => {
    const video = userVideoRef.current
    if (!video || !cameraStreamRef.current) return null
    if (!video.videoWidth || !video.videoHeight) return null
    try {
      const W = 640, H = 480
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      canvas.getContext('2d').drawImage(video, 0, 0, W, H)
      return canvas.toDataURL('image/jpeg', 0.7)
    } catch (e) {
      console.warn('[captureCameraFrame] failed:', e)
      return null
    }
  }, [])

  const startUserCamera = useCallback(async () => {
    if (cameraStreamRef.current) return true
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('이 브라우저는 카메라 연결을 지원하지 않아요.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })
      cameraStreamRef.current = stream
      setCameraStream(stream)
      return true
    } catch {
      alert('카메라 권한이 필요해요. 브라우저 주소창 왼쪽의 자물쇠 아이콘에서 카메라를 허용해주세요.')
      return false
    }
  }, [])

  useEffect(() => () => stopUserCamera(), [stopUserCamera])

  // ─── TTS sanitize (URL/전화/이메일이 본문에 들어왔을 때 안전망) ──────────
  const sanitizeForTTS = (s) => {
    if (!s) return ''
    return s
      .replace(/https?:\/\/[^\s)\]]+/gi, '')
      .replace(/\bwww\.[^\s)\]]+/gi, '')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  // ─── TTS queue (parallel pre-fetch) ───────────────────────────────────
  // Queue holds Promise<ArrayBuffer>. enqueueTTS kicks off fetch immediately
  // so sentence N+1 / N+2 are fetched in parallel while N plays.
  // Result: near-zero gap between sentences (~50-100ms vs ~1s sequential).
  const processTTSQueue = useCallback(async () => {
    if (ttsRunningRef.current) return
    ttsRunningRef.current = true

    try {
      while (ttsQueueRef.current.length > 0 && !ttsAbortRef.current) {
        const bufPromise = ttsQueueRef.current.shift()
        if (!bufPromise) continue

        let buf
        try {
          buf = await bufPromise
        } catch (e) {
          console.warn('[tts queue] fetch fail:', e)
          continue
        }

        if (ttsAbortRef.current) break

        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true
          setStatus('speaking')
        }

        const avatar = vrmAvatarRef.current
        if (avatar && avatar.speak) {
          await avatar.speak(buf)
        } else {
          // 아바타(VRM) 미로드/핸들 없음 → 직접 재생해서 음성이 항상 나오게
          await playBufferFallback(buf)
        }
      }
    } finally {
      ttsRunningRef.current = false
      ttsAbortRef.current = false
      if (isSpeakingRef.current && ttsQueueRef.current.length === 0) {
        isSpeakingRef.current = false
        setStatus(s => (s === 'speaking' ? 'connected' : s))
      }
    }
  }, [playBufferFallback])

  // 외부에서 큐에 문장 추가 — fetch를 즉시 시작, Promise만 큐에 푸시.
  const enqueueTTS = useCallback((sentence) => {
    const s = (sentence || '').trim()
    if (!s) return
    if (conversationModeRef.current === 'ttt') return  // 텍스트 전용 모드
    const clean = sanitizeForTTS(normalizeTtsText(s))
    if (!clean) return

    const bufPromise = fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 곳간이 음색 — 밝고 귀여운 톤 (작은 곡식 캐릭터 컨셉)
      body: JSON.stringify({ text: clean, instruct: GOTGANI_VOICE }),
    }).then(res => {
      if (!res.ok) throw new Error('tts http ' + res.status)
      return res.arrayBuffer()
    })

    ttsQueueRef.current.push(bufPromise)
    processTTSQueue()
  }, [processTTSQueue])

  // 인터럽트 — 큐 비우고 진행 중인 음성 즉시 중단
  const clearTTSQueue = useCallback(() => {
    ttsAbortRef.current = true
    ttsQueueRef.current = []
    try { vrmAvatarRef.current?.stopSpeaking?.() } catch {}
    try { stopFallbackAudio() } catch {}
    isSpeakingRef.current = false
    setStatus(s => (s === 'speaking' ? 'connected' : s))
  }, [stopFallbackAudio])

  // ─── 메시지 전송 (Streaming SSE) ──────────────────────────────────────
  // /api/chat-stream 에서 토큰 단위 받음. 문장 boundary 만날 때마다 enqueueTTS().
  // ── 대화 시나리오 스크립트 (포트폴리오 p.9) ──
  // 챗봇 백엔드(OpenAI)엔 곳간이 RAG가 없어 시나리오를 못 받으므로,
  // 시나리오는 프론트에서 정해진 곳간이 답변을 그대로 주입한다 (항상 정확).
  const SCENARIO_SCRIPTS = {
    '곳간아 월급 들어왔어!':
`🌾 곳간 채워졌어요!
입금: 월급 3,200,000원 · 현재 잔액 4,150,000원

📅 이번 달 예상 흐름
· 카드값(25일) -1,800,000원
· 월세(1일) -650,000원
· 통신/공과금 -150,000원

✅ 월말 예상 잔액: 750,000원 (안전 범위)

💸 추가로 챙길 돈
· 환불 가능 1건 +38,000원
· 통신비 협상 가능 월 -18,000원
원하시면 환불부터 도와드릴까요?`,
    '가전 200만원 사도 돼?':
`30초만 시뮬레이션해볼게요…

⚠️ 곳간 경보!
가전 200만원 구매 시 월말 잔액: -1,250,000원
→ 카드값 결제 부족 위험

💡 대안 3가지
① 6개월 무이자 할부 (월 33만원)
② 다음 달 보너스 후 구매
③ 비상금에서 충당 후 채우기
어떤 방법이 편하세요?`,
    '카드값 결제일 다가오는데 괜찮아?':
`🚨 곳간 경보 (D-7)
7일 뒤 카드값 결제일, 예상 잔액 -85,000원 부족!

긴급 조치 3가지
① 환불 가능 2건(총 12만원) 챙기기
② 이번 주 외식 1회 줄이기 (4만원)
③ 적금 1회 미루기 (50만원)

가장 편한 방법은 ①번! 지금 환불 신청 도와드릴까요?`,
  }

  const runScenario = useCallback((question) => {
    const answer = SCENARIO_SCRIPTS[question]
    if (!answer) return false
    if (isProcessingRef.current || isSpeakingRef.current) return true // 나중에 재시도
    // 사용자 질문 + 곳간이 답변을 바로 주입 (AI 호출 없음)
    setMessages(prev => [...prev, { role: 'user', text: question }, { role: 'assistant', text: answer }])
    historyRef.current = [
      ...historyRef.current,
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    ]
    if (sessionIdRef.current) {
      saveChat(sessionIdRef.current, 'user', question)
      saveChat(sessionIdRef.current, 'assistant', answer)
    }
    // 음성 모드면 읽어주기 (문장 단위로)
    if (conversationModeRef.current !== 'ttt') {
      answer.split('\n').filter(s => s.trim()).forEach(line => enqueueTTS(line.trim()))
    }
    return true
  }, [enqueueTTS])

  const sendMessage = useCallback(async (userText) => {
    const text = userText.trim()
    if (!text || isProcessingRef.current) return
    if (isSpeakingRef.current) {
      console.warn('[echo guard] sendMessage suppressed during avatar speaking:', text.slice(0, 30))
      return
    }
    isProcessingRef.current = true
    setIsProcessing(true)

    setMessages(prev => [...prev, { role: 'user', text }])
    historyRef.current = [...historyRef.current, { role: 'user', content: text }]
    if (sessionIdRef.current) saveChat(sessionIdRef.current, 'user', text)
    setMessages(prev => [...prev, { role: 'assistant', text: '' }])

    let accumulated = ''
    let pending = ''
    let isFirstFlush = true

    // 문장 boundary 처리.
    // - 첫 chunk: 최대한 빨리 첫 음성을 내보내 "말 시작 지연"을 줄인다.
    //   4자 이상 짧은 phrase, 콤마/쉼표, 공백(어절)도 boundary로 인정.
    // - 두 번째부터: 12자 이상의 마침표/물음표/느낌표만.
    const flushPendingIfSentence = () => {
      const minLen = isFirstFlush ? 4 : 12
      let m = pending.match(/^([\s\S]*?[.!?…。\n])(.*)$/)
      if (m && m[1].trim().length >= minLen) {
        enqueueTTS(m[1])
        pending = m[2]
        isFirstFlush = false
        return true
      }
      if (isFirstFlush) {
        // 콤마/쉼표
        m = pending.match(/^([\s\S]*?[,，、])(.*)$/)
        if (m && m[1].trim().length >= 4) {
          enqueueTTS(m[1])
          pending = m[2]
          isFirstFlush = false
          return true
        }
        // 그래도 안 끊기면, 8자 넘어가는 순간 공백(어절)에서 끊어 먼저 말 시작
        if (pending.trim().length >= 8) {
          const sp = pending.match(/^([\s\S]*?\S\s)(\S.*)$/)
          if (sp && sp[1].trim().length >= 4) {
            enqueueTTS(sp[1])
            pending = sp[2]
            isFirstFlush = false
            return true
          }
        }
      }
      return false
    }

    try {
      // Vision keyword gate — 카메라/배경 의도가 있을 때만 frame 첨부.
      // Customize VISION_INTENT for your domain (or remove if no vision needed).
      const VISION_INTENT = /보여|보이|보세요|뒤에|뒷.{0,2}배경|배경에|여기.{0,2}어|주변|화면|카메라|캠|영상|모습|어떻게.{0,3}보|뭐가.{0,3}보/
      const wantsVision = VISION_INTENT.test(text)
      const frame = wantsVision ? captureCameraFrame() : null
      const images = frame ? [frame] : []

      // Server-side RAG (Team Edition): middleton의 team RAG가 자동 적용됨.
      // Vercel env 의 TEAM_ID 가 backend endpoint 결정 (예: TEAM_ID=03 → /api/team/03/chat-stream).
      // 학생은 RAG 수정 시 middleton.p-e.kr/finbot/team/<TEAM_ID>/rag 페이지 사용.
      const res = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyRef.current.slice(-8),
          images,
        }),
      })
      if (!res.ok || !res.body) throw new Error('chat-stream http ' + res.status)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let nlIdx
        while ((nlIdx = buf.indexOf('\n\n')) !== -1) {
          const event = buf.slice(0, nlIdx).trim()
          buf = buf.slice(nlIdx + 2)
          if (!event.startsWith('data: ')) continue
          const payload = event.slice(6).trim()
          if (payload === '[DONE]') { buf = ''; break }

          let obj
          try { obj = JSON.parse(payload) } catch { continue }

          if (obj.token) {
            accumulated += obj.token
            pending += obj.token
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, text: accumulated }
              }
              return next
            })
            while (flushPendingIfSentence()) {}
          }
          if (obj.done && pending.trim()) {
            enqueueTTS(pending)
            pending = ''
          }
          if (obj.error) {
            console.warn('[chat-stream] server error:', obj.error)
          }
        }
      }
      if (pending.trim()) {
        enqueueTTS(pending)
        pending = ''
      }

      const finalReply = accumulated || '죄송해요, 답변을 생성하지 못했어요.'
      historyRef.current = [...historyRef.current, { role: 'assistant', content: finalReply }]
      if (sessionIdRef.current) saveChat(sessionIdRef.current, 'assistant', finalReply)

    } catch (e) {
      console.warn('[chat-stream] error:', e)
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant' && !last.text) {
          next[next.length - 1] = { role: 'assistant', text: '오류가 발생했어요. 다시 시도해 주세요.' }
        }
        return next
      })
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }, [captureCameraFrame, enqueueTTS])

  // ─── STT 텍스트 제출 (whisper 결과 → sendMessage) ────────────────────
  const submitSpeechText = useCallback((rawText) => {
    const text = normalizeTranscript(rawText)
    if (!text || text.length < 2) return
    if (isSpeakingRef.current || isProcessingRef.current) {
      console.warn('[echo guard] transcript dropped (speaking/processing):', text.slice(0, 30))
      return
    }
    // 동일 발화 8초 내 중복 제출 방지
    const key = text.replace(/\s+/g, '')
    const now = Date.now()
    const last = lastSubmittedSpeechRef.current
    if (key === last.key && now - last.at < 8000) return
    lastSubmittedSpeechRef.current = { key, at: now }
    sendMessage(text)
  }, [sendMessage])

  // ─── 외부(대시보드 시나리오 카드)에서 주입된 질문 자동 전송 ───────────
  const lastSentQuestionRef = useRef(null)
  useEffect(() => {
    if (!pendingQuestion) return
    // {text, ts} 형태 — ts로 같은 질문을 다시 눌러도 매번 전송되게 구분
    const sig = pendingQuestion.ts ?? pendingQuestion.text
    if (sig === lastSentQuestionRef.current) return
    lastSentQuestionRef.current = sig

    const text = (pendingQuestion.text || '').trim()
    if (!text) return
    // 봇이 말하는/처리 중이면 잠깐 기다렸다 보냄
    let tries = 0
    const trySend = () => {
      if (!isSpeakingRef.current && !isProcessingRef.current) {
        // 시나리오면 스크립트 답변 주입, 아니면 일반 전송
        if (!runScenario(text)) sendMessage(text)
      } else if (tries++ < 30) {
        setTimeout(trySend, 300)
      }
    }
    const t = setTimeout(trySend, 350)   // 도크 열림 애니메이션 후
    return () => clearTimeout(t)
  }, [pendingQuestion, sendMessage, runScenario])


  const ensureMicRecorder = useCallback(() => {
    if (micRecorderRef.current) return micRecorderRef.current
    if (!isMicRecorderSupported()) {
      alert('이 브라우저는 음성 인식을 지원하지 않아요.\n텍스트 모드를 이용하시거나 최신 Chrome/Safari에서 시도해주세요.')
      return null
    }
    const rec = new MicRecorder({
      sttEndpoint: '/api/stt',
      onTranscript: (text) => submitSpeechText(text),
      onError: (err) => console.warn('[STT] MicRecorder error:', err),
      onStateChange: (st) => {
        const listening = st === 'listening' || st === 'recording'
        isListeningRef.current = listening
        setIsListening(listening)
      },
    })
    micRecorderRef.current = rec
    return rec
  }, [submitSpeechText])

  const startListening = useCallback(async () => {
    const rec = ensureMicRecorder()
    if (!rec) {
      autoListenRef.current = false
      setAutoListen(false)
      return
    }
    try {
      if (!rec.isRunning) {
        await rec.start()
      } else {
        rec.resume()
      }
    } catch (e) {
      console.warn('[STT] start failed:', e)
      const denied = e?.name === 'NotAllowedError' || /denied|permission|allowed/i.test(e?.message || '')
      if (denied) {
        alert('마이크 권한이 필요해요.\n브라우저 주소창 왼쪽의 자물쇠 아이콘을 클릭하여 마이크를 허용해주세요.')
      } else {
        alert('마이크를 시작하지 못했어요. 다른 앱이 마이크를 쓰고 있지 않은지 확인해주세요.')
      }
      autoListenRef.current = false
      setAutoListen(false)
    }
  }, [ensureMicRecorder])

  const stopListening = useCallback(() => {
    const rec = micRecorderRef.current
    if (rec) {
      try { rec.stop() } catch {}
      micRecorderRef.current = null
    }
    isListeningRef.current = false
    setIsListening(false)
  }, [])

  const interruptAvatar = useCallback(() => {
    try { clearTTSQueue() } catch (e) { console.error('interrupt error:', e) }
  }, [clearTTSQueue])

  // echo guard: 봇 발화 중 마이크 pause / 발화 끝나면 resume
  useEffect(() => {
    const rec = micRecorderRef.current
    clearTimeout(echoResumeTimerRef.current)
    if (!rec || !rec.isRunning) return

    if (status === 'speaking') {
      rec.pause()
    } else if (status === 'connected' && autoListenRef.current) {
      echoResumeTimerRef.current = setTimeout(() => {
        const r = micRecorderRef.current
        if (r && r.isRunning && autoListenRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          r.resume()
        }
      }, ECHO_RESUME_DELAY_MS)
    }
    return () => clearTimeout(echoResumeTimerRef.current)
  }, [status])

  useEffect(() => {
    const rec = micRecorderRef.current
    if (!isProcessing && autoListen && rec && rec.isRunning && !isSpeakingRef.current) {
      rec.resume()
    }
  }, [isProcessing, autoListen])

  const toggleMic = useCallback(() => {
    if (conversationModeRef.current === 'ttt') return
    if (!sessionRef.current) {
      alert('먼저 [시작] 버튼을 눌러주세요.')
      return
    }
    if (autoListenRef.current || isListeningRef.current) {
      autoListenRef.current = false
      setAutoListen(false)
      stopListening()
    } else {
      autoListenRef.current = true
      setAutoListen(true)
      startListening()
    }
  }, [startListening, stopListening])

  // ESC 키로 발화 인터럽트
  useEffect(() => {
    const handleGlobalKeydown = (e) => {
      if (e.key !== 'Escape' && e.code !== 'Escape') return
      if (!sessionRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const target = e.target
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        target.blur()
      }
      interruptAvatar()
    }
    window.addEventListener('keydown', handleGlobalKeydown, true)
    document.addEventListener('keydown', handleGlobalKeydown, true)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown, true)
      document.removeEventListener('keydown', handleGlobalKeydown, true)
    }
  }, [interruptAvatar])

  const stopAvatar = useCallback(async () => {
    clearTimeout(echoResumeTimerRef.current)
    lastSubmittedSpeechRef.current = { key: '', at: 0 }
    autoListenRef.current = false
    setAutoListen(false)
    stopListening()
    setIsListening(false)
    stopUserCamera()
    isSpeakingRef.current = false

    try { clearTTSQueue() } catch {}

    sessionRef.current     = null
    sessionIdRef.current   = null
    historyRef.current     = []
    setStatus('idle')
    setMessages([])
  }, [stopListening, stopUserCamera, clearTTSQueue])

  const startTextMode = useCallback(() => {
    clearTimeout(echoResumeTimerRef.current)
    lastSubmittedSpeechRef.current = { key: '', at: 0 }
    autoListenRef.current = false
    setAutoListen(false)
    stopListening()
    setIsListening(false)
    stopUserCamera()
    isSpeakingRef.current = false

    sessionRef.current = null
    sessionIdRef.current = newSessionId()
    historyRef.current = []
    setStatus('connected')

    setMessages([{ role: 'assistant', text: GREETING_TEXT }])
    saveChat(sessionIdRef.current, 'assistant', GREETING_TEXT)
  }, [stopListening, stopUserCamera])

  // 아바타 시작 (VRM). VRM은 AvatarPanel에 항상 마운트되어 앱 로드 시점부터 자체 로딩됨.
  const startAvatar = useCallback(async () => {
    setStatus('connecting')
    sessionIdRef.current = newSessionId()
    lastSubmittedSpeechRef.current = { key: '', at: 0 }
    if (conversationModeRef.current === 'ftf') {
      await startUserCamera()
    } else {
      stopUserCamera()
    }

    // VRM 로드 대기 (최대 5초)
    for (let i = 0; i < 50 && !vrmAvatarRef.current?.isReady?.(); i++) {
      await new Promise(r => setTimeout(r, 100))
    }

    sessionRef.current = true
    historyRef.current = []
    setStatus('connected')

    setMessages([{ role: 'assistant', text: GREETING_TEXT }])
    saveChat(sessionIdRef.current, 'assistant', GREETING_TEXT)
    enqueueTTS(normalizeTtsText(GREETING_TTS))

    autoListenRef.current = true
    setAutoListen(true)
    startListening()
  }, [startListening, startUserCamera, stopUserCamera, enqueueTTS])

  const startConversation = useCallback(() => {
    // 사용자 제스처(시작 클릭) 안에서 AudioContext를 깨워 autoplay 차단 방지
    ensureAudioContext()
    if (conversationModeRef.current === 'ttt') {
      startTextMode()
      return
    }
    startAvatar()
  }, [startAvatar, startTextMode, ensureAudioContext])

  const changeConversationMode = useCallback((nextMode) => {
    if (nextMode === conversationModeRef.current) return

    const hasAvatarSession = Boolean(sessionRef.current)
    const isTextOnlySession = status !== 'idle' && !hasAvatarSession

    if (isTextOnlySession && nextMode !== 'ttt') {
      alert('텍스트 대화에서 음성/화상으로 바꾸려면 대화를 종료한 뒤 다시 시작해주세요.')
      return
    }

    conversationModeRef.current = nextMode
    setConversationMode(nextMode)

    if (nextMode === 'ftf') {
      if (hasAvatarSession) startUserCamera()
    } else {
      stopUserCamera()
    }

    if (nextMode === 'ttt') {
      autoListenRef.current = false
      setAutoListen(false)
      stopListening()
      return
    }

    if (hasAvatarSession) {
      autoListenRef.current = true
      setAutoListen(true)
      startListening()
    }
  }, [startListening, startUserCamera, status, stopListening, stopUserCamera])

  // 언마운트 시 마이크 정리
  useEffect(() => () => {
    clearTimeout(echoResumeTimerRef.current)
    if (micRecorderRef.current) {
      try { micRecorderRef.current.stop() } catch {}
      micRecorderRef.current = null
    }
    try { currentSourceRef.current?.stop?.(0) } catch {}
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
      audioCtxRef.current = null
    }
  }, [])

  const isChatConnected = status !== 'idle' && status !== 'connecting'

  return (
    <div className={embedded ? `${styles.app} ${styles.embedded}` : styles.app}>
      <AvatarPanel
        status={status}
        mode={conversationMode}
        onModeChange={changeConversationMode}
        vrmAvatarRef={vrmAvatarRef}
        onAvatarReady={handleAvatarReady}
        userVideoRef={userVideoRef}
        videoReady={videoReady}
        cameraActive={Boolean(cameraStream)}
        onStart={startConversation}
        onStop={stopAvatar}
        onInterrupt={interruptAvatar}
        isListening={isListening}
      />
      <ChatPanel
        messages={messages}
        isProcessing={isProcessing}
        onSend={sendMessage}
        connected={isChatConnected}
        isListening={isListening}
        onToggleMic={toggleMic}
        micEnabled={conversationMode !== 'ttt' && isChatConnected}
        micAvailable={conversationMode !== 'ttt'}
        mode={conversationMode}
        user={user}
        onLoginClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onOpenSurvey={() => window.open('https://naver.me/FTddCcWY', '_blank', 'noopener,noreferrer')}
        surveyUrl="https://naver.me/FTddCcWY"
        quickScenarios={[
          { icon: '💰', label: '월급일', ask: '곳간아 월급 들어왔어!' },
          { icon: '🛒', label: '큰 지출 전', ask: '가전 200만원 사도 돼?' },
          { icon: '🚨', label: 'D-7 경보', ask: '카드값 결제일 다가오는데 괜찮아?' },
        ]}
        onScenario={(q) => { if (!runScenario(q)) sendMessage(q) }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={(u) => setUser(u)}
      />
    </div>
  )
}
