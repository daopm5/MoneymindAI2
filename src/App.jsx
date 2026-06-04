// src/App.jsx
// 곳간이 메인 = 밝은 곳간이 톤 대시보드 + 우하단 가로 플로팅 챗봇(BotApp).
// 시나리오 카드를 누르면 그 질문이 실제로 곳간이 챗봇에 전송된다.
import { useState, useEffect, useCallback } from 'react'
import Dashboard from './Dashboard'
import BotApp from './BotApp'

const GOLD = '#C9A063'
const GOLD_TO = '#DDB777'

export default function App() {
  const [chatOpen, setChatOpen] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const [theme, setTheme] = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') ? 'dark' : 'light'
  )
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
    const obs = new MutationObserver(sync)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  // 시나리오 카드 → 챗봇 열고 질문 주입 (ts로 같은 질문도 매번 다시 전송)
  const askQuestion = useCallback((text) => {
    setChatOpen(true)
    setPendingQuestion({ text, ts: Date.now() })
  }, [])

  const dockBg     = theme === 'dark' ? '#231F18' : '#FFFDF7'
  const dockBorder = theme === 'dark' ? '#3A3329' : '#E6DCC4'

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: theme === 'dark' ? '#1E1B16' : '#FAF6EC' }}>
      {/* 메인 대시보드 */}
      <Dashboard onOpenChat={() => setChatOpen(true)} onAskQuestion={askQuestion} />

      {/* ── 가로 플로팅 챗봇 도크 (실제 봇 BotApp 임베드) ── */}
      <div
        {...(!chatOpen ? { inert: '' } : {})}
        style={{
          position: 'fixed', right: 24, bottom: 100, zIndex: 60,
          width: 'min(760px, calc(100vw - 32px))',
          height: 'min(520px, calc(100vh - 120px))',
          background: dockBg, border: `1px solid ${dockBorder}`, borderRadius: 20,
          boxShadow: '0 24px 70px rgba(80,60,20,.28)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transformOrigin: 'bottom right',
          transition: 'opacity .22s ease, transform .22s ease',
          opacity: chatOpen ? 1 : 0,
          transform: chatOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(.96)',
          pointerEvents: chatOpen ? 'auto' : 'none',
        }}
      >
        {/* 도크 헤더 */}
        <div style={{
          flexShrink: 0, padding: '10px 14px',
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_TO})`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img src="/gotgani-mascot.png" alt="곳간이" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>곳간이</div>
            <div style={{ color: 'rgba(255,255,255,.85)', fontSize: 11 }}>AI 소비 대리인 · 전직 은행 PB</div>
          </div>
          <button onClick={() => setChatOpen(false)} aria-label="닫기" style={{
            background: 'rgba(255,255,255,.22)', border: 'none', color: '#fff',
            width: 28, height: 28, borderRadius: 8, cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>

        {/* 실제 봇 (아바타+채팅+음성) — 기능 그대로, 시나리오 질문 주입 */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <BotApp embedded pendingQuestion={pendingQuestion} />
        </div>
      </div>

      {/* 플로팅 토글 버튼 — 곳간이 마스코트 */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        aria-label={chatOpen ? '곳간이 닫기' : '곳간이 열기'}
        style={{
          position: 'fixed', right: 24, bottom: 24, width: 64, height: 64, borderRadius: '50%',
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_TO})`, border: 'none',
          cursor: 'pointer', color: '#fff',
          boxShadow: '0 10px 28px rgba(201,160,99,.5)', zIndex: 61,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, overflow: 'hidden',
        }}
      >
        {chatOpen
          ? <span style={{ fontSize: 28 }}>×</span>
          : <img src="/gotgani-mascot.png" alt="곳간이" style={{ width: 46, height: 46, objectFit: 'contain' }} />}
      </button>
    </div>
  )
}
