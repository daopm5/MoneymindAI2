// src/Dashboard.jsx
// 곳간이 메인 대시보드 + 🎯 일일 미션(게이미피케이션).
//   - 미션 "해보기"를 누르면 그 질문이 실제로 곳간이 챗봇에 전송됨 (onAskQuestion)
//   - 완료 상태/연속일(streak)/오늘 받은 포인트는 localStorage에 저장 → 새로고침해도 유지
//   - 매일 00시 기준으로 미션 자동 초기화 (날짜가 바뀌면 리셋)
import { useState, useEffect, useCallback } from 'react'

// ── 오늘의 미션 목록 (원하는 대로 자유롭게 추가/수정하세요) ──
// id: 고유값(겹치면 안 됨) · ask: 곳간이에게 보낼 실제 질문 · xp: 완료 시 포인트
const MISSIONS = [
  { id: 'cashflow', icon: '📊', title: '이번 달 현금 흐름 보기', desc: '월말까지 잔액이 어떻게 흐르는지 예측받기', ask: '이번 달 내 현금 흐름을 예측해줘', xp: 30 },
  { id: 'refund',   icon: '💸', title: '돌려받을 환불 찾기',     desc: '놓친 환불·과오납이 있는지 점검',          ask: '내가 돌려받을 수 있는 환불이 있는지 확인해줘', xp: 25 },
  { id: 'leak',     icon: '🔍', title: '새는 돈 점검',          desc: '안 쓰는데 자동결제되는 구독 찾기',         ask: '내가 안 쓰는데 자동결제되고 있는 구독을 찾아줘', xp: 25 },
  { id: 'save',     icon: '🐷', title: '오늘의 절약 한 가지',    desc: '오늘 바로 실천할 절약 팁 받기',           ask: '오늘 바로 실천할 수 있는 절약 팁 하나만 알려줘', xp: 20 },
]
const TOTAL_XP = MISSIONS.reduce((s, m) => s + m.xp, 0)

// 날짜 키 (로컬 시간 기준 YYYY-MM-DD)
const dayKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
const yesterdayKey = () => dayKey(new Date(Date.now() - 86400000))

const LS_DATE   = 'gotgani_mission_date'
const LS_DONE   = 'gotgani_mission_done'
const LS_STREAK = 'gotgani_mission_streak'

export default function Dashboard({ onOpenChat, onAskQuestion }) {
  const [done, setDone]     = useState([])   // 오늘 완료한 미션 id 배열
  const [streak, setStreak] = useState(0)    // 연속 달성일

  // ── 초기 로드: 날짜가 바뀌었으면 미션 초기화 ──
  useEffect(() => {
    try {
      const today = dayKey()
      const savedDate = localStorage.getItem(LS_DATE)
      const savedStreak = parseInt(localStorage.getItem(LS_STREAK) || '0', 10) || 0

      if (savedDate === today) {
        // 오늘 기록 그대로 복원
        setDone(JSON.parse(localStorage.getItem(LS_DONE) || '[]'))
        setStreak(savedStreak)
      } else {
        // 새 날 → 미션 리셋. 어제 안 했으면 연속일도 끊김.
        const keepStreak = savedDate === yesterdayKey() ? savedStreak : 0
        setStreak(keepStreak)
        setDone([])
        localStorage.setItem(LS_DATE, today)
        localStorage.setItem(LS_DONE, '[]')
        localStorage.setItem(LS_STREAK, String(keepStreak))
      }
    } catch (_) { /* localStorage 막힌 환경 — 그냥 메모리로만 동작 */ }
  }, [])

  // ── 완료 상태 저장 + 전부 완료 시 streak 1회 증가 ──
  const persist = useCallback((nextDone) => {
    try {
      localStorage.setItem(LS_DATE, dayKey())
      localStorage.setItem(LS_DONE, JSON.stringify(nextDone))
      // 오늘 모든 미션을 처음 다 채운 순간 streak +1
      if (nextDone.length === MISSIONS.length) {
        const last = localStorage.getItem('gotgani_streak_awarded')
        if (last !== dayKey()) {
          const ns = (parseInt(localStorage.getItem(LS_STREAK) || '0', 10) || 0) + 1
          localStorage.setItem(LS_STREAK, String(ns))
          localStorage.setItem('gotgani_streak_awarded', dayKey())
          setStreak(ns)
        }
      }
    } catch (_) {}
  }, [])

  // 미션 "해보기" → 곳간이에게 질문 전송 + 완료 처리
  const runMission = (m) => {
    if (onAskQuestion) onAskQuestion(m.ask)   // 챗봇 열고 질문 주입 = "미션화"
    if (!done.includes(m.id)) {
      const next = [...done, m.id]
      setDone(next)
      persist(next)
    }
  }
  // 완료 취소 (잘못 눌렀을 때)
  const undoMission = (m) => {
    const next = done.filter((id) => id !== m.id)
    setDone(next)
    persist(next)
  }

  const doneCount = done.length
  const earnedXp  = MISSIONS.filter((m) => done.includes(m.id)).reduce((s, m) => s + m.xp, 0)
  const pct       = Math.round((doneCount / MISSIONS.length) * 100)
  const allDone   = doneCount === MISSIONS.length

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* ── 헤더 ── */}
        <header style={S.hero}>
          <img src="/gotgani-mascot.png" alt="곳간이" style={S.heroImg}
               onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <div>
            <h1 style={S.h1}>곳간이</h1>
            <p style={S.sub}>내일을 알려주는 AI 소비 대리인 · 전직 은행 PB</p>
          </div>
          <button style={S.openBtn} onClick={onOpenChat}>💬 곳간이와 대화</button>
        </header>

        {/* ── 🎯 일일 미션 카드 ── */}
        <section style={S.card}>
          <div style={S.cardHead}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <h2 style={S.h2}>오늘의 미션</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={S.streak} title="연속 달성일">🔥 {streak}일</span>
              <span style={S.xpPill}>{earnedXp} / {TOTAL_XP} P</span>
            </div>
          </div>

          {/* 진행 바 */}
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${pct}%` }} />
          </div>
          <p style={S.progressLabel}>
            {allDone
              ? '🎉 오늘 미션 전부 완료! 내일도 만나요.'
              : `${doneCount} / ${MISSIONS.length} 완료 — ${MISSIONS.length - doneCount}개 남았어요`}
          </p>

          {/* 미션 리스트 */}
          <ul style={S.list}>
            {MISSIONS.map((m) => {
              const isDone = done.includes(m.id)
              return (
                <li key={m.id} style={{ ...S.item, ...(isDone ? S.itemDone : null) }}>
                  <span style={S.itemIcon}>{m.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...S.itemTitle, ...(isDone ? S.strike : null) }}>{m.title}</div>
                    <div style={S.itemDesc}>{m.desc}</div>
                  </div>
                  {isDone ? (
                    <button style={S.doneBtn} onClick={() => undoMission(m)} title="완료 취소">✓ 완료</button>
                  ) : (
                    <button style={S.runBtn} onClick={() => runMission(m)}>+{m.xp}P 해보기</button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <p style={S.foot}>미션을 누르면 곳간이가 바로 답해드려요. 미션은 매일 자정에 새로 채워집니다.</p>
      </div>
    </div>
  )
}

// ── 스타일 (index.css의 테마 변수 사용 → 라이트/다크 자동 대응) ──
const S = {
  page:   { minHeight: '100vh', padding: '32px 18px 120px', display: 'flex', justifyContent: 'center' },
  wrap:   { width: '100%', maxWidth: 560 },
  hero:   { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' },
  heroImg:{ width: 56, height: 56, objectFit: 'contain' },
  h1:     { margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' },
  sub:    { margin: '2px 0 0', fontSize: 13, color: 'var(--muted)' },
  openBtn:{ marginLeft: 'auto', background: 'var(--gold)', color: '#fff', border: 'none',
            borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(201,160,99,.35)' },

  card:   { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20,
            padding: 20, boxShadow: 'var(--shadow-card, 0 18px 50px rgba(58,40,23,.10))' },
  cardHead:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  h2:     { margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' },
  streak: { fontSize: 12, fontWeight: 700, color: 'var(--gold)' },
  xpPill: { fontSize: 12, fontWeight: 700, color: 'var(--gold)',
            background: 'var(--overlay-soft, rgba(201,160,99,.10))',
            border: '1px solid var(--gold)', borderRadius: 999, padding: '3px 10px' },

  progressTrack:{ height: 10, borderRadius: 999, background: 'var(--overlay-track, rgba(139,90,43,.18))', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--gold-dim), var(--gold))', transition: 'width .35s ease' },
  progressLabel:{ margin: '8px 0 16px', fontSize: 13, color: 'var(--muted)' },

  list:   { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  item:   { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            border: '1px solid var(--border)', borderRadius: 14, background: 'var(--panel)' },
  itemDone:{ opacity: 0.7, background: 'var(--overlay-soft, rgba(201,160,99,.08))', borderColor: 'var(--gold)' },
  itemIcon:{ fontSize: 22, flexShrink: 0 },
  itemTitle:{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' },
  strike: { textDecoration: 'line-through', textDecorationColor: 'var(--gold)' },
  itemDesc:{ fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  runBtn: { flexShrink: 0, background: 'var(--gold)', color: '#fff', border: 'none', borderRadius: 10,
            padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  doneBtn:{ flexShrink: 0, background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold)',
            borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },

  foot:   { textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 18 },
}
