// src/Dashboard.jsx
// 곳간이 메인 대시보드 — 곳간이 마스코트(밀짚 베이지/곳간 골드) 톤의 밝은 UI.
// 라이트/다크 모드 모두 지원. 콘텐츠는 '곳간이 도안' 기반.
// (챗봇은 여기 없음 — App.jsx가 실제 봇을 우하단 플로팅으로 띄움.)
import { useState, useEffect, useCallback } from 'react'

// ── 🎯 오늘의 미션 (자유롭게 추가/수정) ──
// ask: 곳간이에게 보낼 실제 질문 · xp: 완료 포인트
const MISSIONS = [
  { id: 'cashflow', icon: '📊', title: '이번 달 현금 흐름 보기', desc: '월말까지 잔액이 어떻게 흐르는지 예측받기', ask: '이번 달 내 현금 흐름을 예측해줘', xp: 30 },
  { id: 'refund',   icon: '💸', title: '돌려받을 환불 찾기',     desc: '놓친 환불·과오납이 있는지 점검',          ask: '내가 돌려받을 수 있는 환불이 있는지 확인해줘', xp: 25 },
  { id: 'leak',     icon: '🔍', title: '새는 돈 점검',          desc: '안 쓰는데 자동결제되는 구독 찾기',         ask: '내가 안 쓰는데 자동결제되고 있는 구독을 찾아줘', xp: 25 },
  { id: 'save',     icon: '🐷', title: '오늘의 절약 한 가지',    desc: '오늘 바로 실천할 절약 팁 받기',           ask: '오늘 바로 실천할 수 있는 절약 팁 하나만 알려줘', xp: 20 },
]
const TOTAL_XP = MISSIONS.reduce((s, m) => s + m.xp, 0)
const dayKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
const yesterdayKey = () => dayKey(new Date(Date.now() - 86400000))
const LS_MDATE = 'gotgani_mission_date', LS_MDONE = 'gotgani_mission_done', LS_MSTREAK = 'gotgani_mission_streak'

// 곳간이 마스코트·아이콘에서 추출한 따뜻한 팔레트
const LIGHT = {
  bar: '#C9A063', barTo: '#DDB777',          // 곳간 골드 (상단 바)
  bg: '#FAF6EC',                              // 크림 배경
  side: '#FFFDF7', surface: '#F3ECDB',        // 카드/표면
  search: '#EFE7D3',                          // 입력창
  line: '#E6DCC4',                            // 구분선
  text: '#3B3326', sub: '#9A8D72',            // 글자
  green: '#7A8B5A', greenBg: 'rgba(122,139,90,.16)',     // 곡식 그린
  red: '#C0654A', redBg: 'rgba(192,101,74,.14)',         // 매듭 테라코타
  blue: '#5B83A6', blueBg: 'rgba(91,131,166,.16)',       // 차분한 블루
  amber: '#D89B3E', amberBg: 'rgba(216,155,62,.16)',     // 황금
  plum: '#A98AB5',
  heroFrom: '#F6ECD4', heroTo: '#FBF7EE',     // 히어로 그라데이션
}
const DARK = {
  bar: '#D9B074', barTo: '#C9A063',
  bg: '#1E1B16',                              // 짙은 모카
  side: '#28241D', surface: '#322C23',
  search: '#363026',
  line: '#3A3329',
  text: '#F1E9D8', sub: '#A99B81',
  green: '#9DB173', greenBg: 'rgba(157,177,115,.16)',
  red: '#D67D5F', redBg: 'rgba(214,125,95,.16)',
  blue: '#7FA3C4', blueBg: 'rgba(127,163,196,.16)',
  amber: '#E0B85C', amberBg: 'rgba(224,184,92,.16)',
  plum: '#B89BC4',
  heroFrom: '#2A2620', heroTo: '#211E18',
}

const DEFAULT_SUBS = [
  { name: 'HBO Max',         price: '15,900', payDay: 10, status: '해지됨',   tone: 'red' },
  { name: 'Netflix',         price: '15,900', payDay: 12, status: '이용중',   tone: 'green' },
  { name: 'Spotify Premium', price: '10,900', payDay: 18, status: '이용중',   tone: 'green' },
  { name: 'ChatGPT Plus',    price: '20,000', payDay: 22, status: '비교됨',   tone: 'blue' },
  { name: '쿠팡 와우',        price: '7,890',  payDay: 25, status: '점검필요', tone: 'amber' },
]

// payDay(결제일)로 '다음 결제일'을 계산 — 오늘 지난 날짜면 다음 달로 자동 증가.
// 매달 한 달 간격으로 꾸준히 밀려서, 시간이 지나도 항상 미래 날짜를 보여줌.
function nextPaymentDate(payDay, base = new Date()) {
  const y = base.getFullYear()
  const m = base.getMonth()        // 0~11
  const today = base.getDate()
  // 이번 달 결제일이 아직 안 지났으면 이번 달, 지났으면 다음 달
  const targetMonth = payDay >= today ? m : m + 1
  const d = new Date(y, targetMonth, payDay)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

// 상태값 → 뱃지 색 매핑
const STATUS_TONE = { '이용중': 'green', '해지됨': 'red', '비교됨': 'blue', '점검필요': 'amber' }

const REFUNDS = [
  { store: '쿠팡',     item: '운동기구', amount: '38,000', state: '환불 가능', day: '배송 9일째', tone: 'green', detail: '14일 이내 + 미사용 시 100% 환불 · 회수기사 신청 가능' },
  { store: '마켓컬리', item: '주방용품', amount: '52,000', state: '환불 가능', day: '결제 5일째', tone: 'green', detail: '단순 변심 7일 이내 청약철회 가능' },
  { store: '11번가',   item: '의류',     amount: '29,900', state: '기한 임박', day: 'D-2',        tone: 'amber', detail: '교환·환불 마감 임박, 서둘러 신청 필요' },
]

const FLOW = [
  { label: '카드값',   amount: 1800000, pct: 43, tone: 'bar' },
  { label: '구독',     amount: 760000,  pct: 18, tone: 'amber' },
  { label: '변동지출', amount: 800000,  pct: 19, tone: 'blue' },
  { label: '월세',     amount: 650000,  pct: 16, tone: 'green' },
  { label: '비상금',   amount: 170000,  pct: 4,  tone: 'plum' },
]

// 챗봇 대화 시나리오 3개 (최종 포트폴리오 p.9) — 카드 클릭 시 곳간이 챗봇 실행
const SCENARIOS = [
  {
    key: '월급일',
    icon: '💰',
    ask: '곳간아 월급 들어왔어!',
    lines: [
      '입금: 월급 3,200,000원 · 현재 잔액 4,150,000원',
      '카드값(25일) -1,800,000 · 월세(1일) -650,000 · 통신/공과금 -150,000',
      '월말 예상 잔액: 750,000원 (안전)',
      '환불 가능 1건 +38,000원 · 통신비 협상 가능 월 -18,000원',
    ],
  },
  {
    key: '큰 지출 전',
    icon: '🛒',
    ask: '가전 200만원 사도 돼?',
    lines: [
      '가전 200만원 구매 시 월말 잔액: -1,250,000원',
      '① 6개월 무이자 할부 (월 33만원)',
      '② 다음 달 보너스 후 구매',
      '③ 비상금에서 충당 후 채우기',
    ],
  },
  {
    key: 'D-7 경보',
    icon: '🚨',
    ask: '카드값 결제일 다가오는데 괜찮아?',
    lines: [
      '7일 뒤 카드값 결제일, 예상 잔액 -85,000원 부족!',
      '① 환불 가능 2건 (총 12만원) 챙기기',
      '② 외식 1회 줄이기 (4만원)',
      '③ 적금 1회 미루기 (50만원)',
      '가장 편한 방법은 ①번!',
    ],
  },
]

const won = (n) => n.toLocaleString('ko-KR')

function Badge({ tone, children, C }) {
  const map = {
    green: { bg: C.greenBg, fg: C.green },
    red:   { bg: C.redBg,   fg: C.red },
    blue:  { bg: C.blueBg,  fg: C.blue },
    amber: { bg: C.amberBg, fg: C.amber },
  }
  const s = map[tone] || map.green
  return (
    <span style={{
      background: s.bg, color: s.fg, fontSize: 12, fontWeight: 700,
      padding: '4px 10px', borderRadius: 6, letterSpacing: '.02em', whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

export default function Dashboard({ onOpenChat, onAskQuestion }) {
  const [tab, setTab] = useState('subs')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [q, setQ] = useState('')
  const [refundQ, setRefundQ] = useState('')

  // 라이트/다크 — 봇(BotApp)과 같은 'theme' 키를 공유해 사이트 전체가 함께 전환됨
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light')
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])
  // 챗봇 쪽 토글 등 외부에서 data-theme이 바뀌면 대시보드도 따라감
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
  const C = theme === 'dark' ? DARK : LIGHT

  // 구독 목록: localStorage에 저장 → 새로고침해도 유지
  const [subs, setSubs] = useState(() => {
    try {
      const saved = localStorage.getItem('gotgani_subs')
      if (!saved) return DEFAULT_SUBS
      const parsed = JSON.parse(saved)
      // 구버전(payDay 없는 next 기반) 데이터면 기본값으로 갱신
      if (Array.isArray(parsed) && parsed.every(s => typeof s.payDay === 'number')) {
        return parsed
      }
      return DEFAULT_SUBS
    } catch { return DEFAULT_SUBS }
  })
  useEffect(() => {
    try { localStorage.setItem('gotgani_subs', JSON.stringify(subs)) } catch {}
  }, [subs])

  // ── 🎯 일일 미션 상태 (localStorage 저장 · 매일 자정 초기화) ──
  const [mDone, setMDone]     = useState([])
  const [mStreak, setMStreak] = useState(0)
  useEffect(() => {
    try {
      const today = dayKey()
      const savedDate = localStorage.getItem(LS_MDATE)
      const savedStreak = parseInt(localStorage.getItem(LS_MSTREAK) || '0', 10) || 0
      if (savedDate === today) {
        setMDone(JSON.parse(localStorage.getItem(LS_MDONE) || '[]'))
        setMStreak(savedStreak)
      } else {
        const keep = savedDate === yesterdayKey() ? savedStreak : 0
        setMStreak(keep); setMDone([])
        localStorage.setItem(LS_MDATE, today)
        localStorage.setItem(LS_MDONE, '[]')
        localStorage.setItem(LS_MSTREAK, String(keep))
      }
    } catch {}
  }, [])
  const persistMission = useCallback((next) => {
    try {
      localStorage.setItem(LS_MDATE, dayKey())
      localStorage.setItem(LS_MDONE, JSON.stringify(next))
      if (next.length === MISSIONS.length && localStorage.getItem('gotgani_streak_awarded') !== dayKey()) {
        const ns = (parseInt(localStorage.getItem(LS_MSTREAK) || '0', 10) || 0) + 1
        localStorage.setItem(LS_MSTREAK, String(ns))
        localStorage.setItem('gotgani_streak_awarded', dayKey())
        setMStreak(ns)
      }
    } catch {}
  }, [])
  const runMission = (m) => {
    if (onAskQuestion) onAskQuestion(m.ask)
    if (!mDone.includes(m.id)) { const next = [...mDone, m.id]; setMDone(next); persistMission(next) }
  }
  const undoMission = (m) => { const next = mDone.filter((id) => id !== m.id); setMDone(next); persistMission(next) }

  // 추가 폼
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', payDay: '' })

  const addSub = () => {
    const name = form.name.trim()
    if (!name) return
    const price = (form.price.trim() || '0').replace(/[^\d]/g, '')
    const formatted = price ? Number(price).toLocaleString('ko-KR') : '0'
    let payDay = parseInt(form.payDay, 10)
    if (isNaN(payDay) || payDay < 1 || payDay > 31) payDay = new Date().getDate()
    setSubs((list) => [
      { name, price: formatted, payDay, status: '이용중', tone: 'green' },
      ...list,
    ])
    setForm({ name: '', price: '', payDay: '' })
    setAdding(false)
  }

  const removeSub = (idx) => {
    if (window.confirm(`'${subs[idx].name}' 구독을 삭제할까요?`)) {
      setSubs((list) => list.filter((_, i) => i !== idx))
    }
  }

  // 이용중 ↔ 해지됨 토글
  const toggleStatus = (idx) => {
    setSubs((list) => list.map((s, i) => {
      if (i !== idx) return s
      const nextStatus = s.status === '해지됨' ? '이용중' : '해지됨'
      return { ...s, status: nextStatus, tone: STATUS_TONE[nextStatus] }
    }))
  }

  const filtered = subs.filter((s) =>
    (statusFilter === '전체' || s.status === statusFilter) &&
    s.name.toLowerCase().includes(q.toLowerCase())
  )

  const wrap = { fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif" }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, ...wrap }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .gk-row:hover{background:rgba(255,255,255,.02)}
        .gk-scroll::-webkit-scrollbar{width:8px}
        .gk-scroll::-webkit-scrollbar-thumb{background:#3a3a44;border-radius:4px}
      `}</style>

      {/* 상단 골드 바 */}
      <div style={{
        height: 52, background: `linear-gradient(90deg, ${C.bar}, ${C.barTo})`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 40,
        boxShadow: '0 2px 12px rgba(0,0,0,.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontWeight: 800, fontSize: 16 }}>
          <img src="/icon-wheat.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }} onError={(e) => { e.currentTarget.style.display = 'none' }} /> 곳간이
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="테마 전환" title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff',
              fontSize: 15, width: 34, height: 34, borderRadius: 9, cursor: 'pointer' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={onOpenChat} aria-label="곳간이에게 검색" title="곳간이에게 물어보기"
            style={{ background: 'rgba(255,255,255,.18)', border: 'none', color: '#fff', opacity: .95,
              fontSize: 16, width: 34, height: 34, borderRadius: 9, cursor: 'pointer' }}>🔍</button>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* 좌측 사이드바 */}
        <aside style={{ width: 176, minHeight: 'calc(100vh - 52px)', background: C.side, padding: '20px 12px', flexShrink: 0 }}>
          {[
            { k: 'subs', icon: '📋', label: '구독 목록' },
            { k: 'flow', icon: '📊', label: '현금 흐름' },
            { k: 'refund', icon: '↩️', label: '환불 진단' },
            { k: 'scenario', icon: '💬', label: '대화 시나리오' },
            { k: 'mission', icon: '🎯', label: '오늘의 미션' },
          ].map((it) => (
            <button key={it.k} onClick={() => setTab(it.k)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
              borderRadius: 10, marginBottom: 4, cursor: 'pointer', textAlign: 'left',
              background: tab === it.k ? 'rgba(127,119,222,.16)' : 'transparent',
              color: tab === it.k ? C.text : C.sub, border: 'none',
              fontSize: 14, fontWeight: tab === it.k ? 700 : 500,
            }}>
              <span>{it.icon}</span> {it.label}
            </button>
          ))}
        </aside>

        {/* 메인 */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* 히어로 */}
          <div style={{
            background: `radial-gradient(120% 140% at 0% 0%, ${C.heroFrom} 0%, ${C.heroTo} 100%)`,
            padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                background: `linear-gradient(135deg, ${C.bar}, ${C.barTo})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src="/char-rice.png" alt="곳간이" style={{ width: 46, height: 46, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
              </div>
              <div>
                <div style={{ color: C.bar, fontWeight: 700, fontSize: 14 }}>안녕하세요, 곳간지기예요</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>내 돈이 어디서 새는지 확인해보세요</div>
              </div>
            </div>
            <button onClick={onOpenChat} title="곳간이에게 물어보기"
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.search, borderRadius: 10,
                padding: '10px 14px', minWidth: 240, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ color: C.sub }}>🔍</span>
              <span style={{ color: C.sub, flex: 1, fontSize: 14 }}>곳간이에게 물어보기…</span>
            </button>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', gap: 24, padding: '0 32px', borderBottom: `1px solid ${C.line}` }}>
            {[
              { k: 'subs', label: '📋 구독 목록' },
              { k: 'flow', label: '📊 현금 흐름' },
              { k: 'refund', label: '↩️ 환불 진단' },
              { k: 'scenario', label: '💬 대화 시나리오' },
              { k: 'mission', label: '🎯 오늘의 미션' },
            ].map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding: '16px 2px', background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.k ? C.text : C.sub, fontSize: 15, fontWeight: tab === t.k ? 700 : 500,
                borderBottom: `2px solid ${tab === t.k ? C.bar : 'transparent'}`, marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>

          {/* 콘텐츠 */}
          <div style={{ padding: '24px 32px 120px' }}>
            {/* ▶ 🎯 오늘의 미션 */}
            {tab === 'mission' && (() => {
              const doneCount = mDone.length
              const earned = MISSIONS.filter((m) => mDone.includes(m.id)).reduce((s, m) => s + m.xp, 0)
              const pct = Math.round((doneCount / MISSIONS.length) * 100)
              const allDone = doneCount === MISSIONS.length
              return (
                <div style={{ animation: 'fadeUp .3s ease', maxWidth: 640 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>🎯 오늘의 미션</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.bar }} title="연속 달성일">🔥 {mStreak}일</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.bar, background: C.surface, border: `1px solid ${C.bar}`, borderRadius: 999, padding: '3px 12px' }}>{earned} / {TOTAL_XP} P</span>
                    </div>
                  </div>

                  <div style={{ height: 10, borderRadius: 999, background: C.surface, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${C.bar}, ${C.barTo})`, transition: 'width .35s ease' }} />
                  </div>
                  <p style={{ color: C.sub, fontSize: 13, margin: '8px 0 18px' }}>
                    {allDone ? '🎉 오늘 미션 전부 완료! 내일도 만나요.' : `${doneCount} / ${MISSIONS.length} 완료 — ${MISSIONS.length - doneCount}개 남았어요`}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {MISSIONS.map((m) => {
                      const isDone = mDone.includes(m.id)
                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                          border: `1px solid ${isDone ? C.bar : C.line}`, borderRadius: 14,
                          background: isDone ? C.surface : C.side, opacity: isDone ? 0.78 : 1,
                        }}>
                          <span style={{ fontSize: 22, flexShrink: 0 }}>{m.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: C.bar }}>{m.title}</div>
                            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{m.desc}</div>
                          </div>
                          {isDone ? (
                            <button onClick={() => undoMission(m)} title="완료 취소" style={{ flexShrink: 0, background: 'transparent', color: C.bar, border: `1px solid ${C.bar}`, borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ 완료</button>
                          ) : (
                            <button onClick={() => runMission(m)} style={{ flexShrink: 0, background: C.bar, color: '#fff', border: 'none', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+{m.xp}P 해보기</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ color: C.sub, fontSize: 12.5, marginTop: 16 }}>미션을 누르면 곳간이가 바로 답해드려요. 미션은 매일 자정에 새로 채워집니다.</p>
                </div>
              )
            })()}

            {tab === 'subs' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 800 }}>구독 목록</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.search, borderRadius: 10, padding: '8px 12px', minWidth: 220 }}>
                    <span style={{ color: C.sub }}>🔍</span>
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="구독 검색…"
                      style={{ background: 'transparent', border: 'none', color: C.text, outline: 'none', flex: 1, fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {['전체', '이용중', '해지됨', '점검필요'].map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)} style={{
                      fontSize: 13, padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                      background: statusFilter === s ? C.bar : C.surface,
                      color: statusFilter === s ? '#fff' : C.sub,
                      border: `1px solid ${statusFilter === s ? C.bar : C.line}`,
                    }}>{s}</button>
                  ))}
                  <button onClick={() => setAdding((v) => !v)} style={{
                    marginLeft: 'auto', fontSize: 13, fontWeight: 700, padding: '6px 14px', borderRadius: 999,
                    cursor: 'pointer', background: adding ? C.surface : C.bar,
                    color: adding ? C.sub : '#fff', border: `1px solid ${adding ? C.line : C.bar}`,
                  }}>{adding ? '닫기' : '+ 구독 추가'}</button>
                </div>

                {/* 구독 추가 폼 */}
                {adding && (
                  <div style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, marginBottom: 16, animation: 'fadeUp .2s ease' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
                      <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="서비스명 (예: 디즈니+)"
                        style={{ background: C.search, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
                      <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="월 결제액 (예: 9900)" inputMode="numeric"
                        style={{ background: C.search, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
                      <input value={form.payDay} onChange={(e) => setForm({ ...form, payDay: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && addSub()} placeholder="매월 결제일 (예: 15)" inputMode="numeric"
                        style={{ background: C.search, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
                    </div>
                    <button onClick={addSub} disabled={!form.name.trim()} style={{
                      background: form.name.trim() ? C.green : C.surface, color: form.name.trim() ? '#08130f' : C.sub,
                      border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13,
                      cursor: form.name.trim() ? 'pointer' : 'default',
                    }}>가입 추가</button>
                  </div>
                )}

                {filtered.length === 0 && (
                  <p style={{ color: C.sub, fontSize: 14, padding: '24px 4px' }}>표시할 구독이 없어요.</p>
                )}
                {filtered.map((s) => {
                  const realIdx = subs.indexOf(s)   // 원본 배열 인덱스 (삭제/토글용)
                  const cancelled = s.status === '해지됨'
                  return (
                    <div key={realIdx} className="gk-row" style={{ borderBottom: `1px solid ${C.line}`, padding: '18px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
                        <span style={{ fontSize: 17, fontWeight: 700, opacity: cancelled ? 0.55 : 1, textDecoration: cancelled ? 'line-through' : 'none' }}>{s.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Badge tone={s.tone} C={C}>{s.status}</Badge>
                          <button onClick={() => toggleStatus(realIdx)} title={cancelled ? '재구독' : '해지'} style={{
                            fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                            background: 'transparent', color: cancelled ? C.green : C.amber,
                            border: `1px solid ${cancelled ? C.green : C.amber}`, whiteSpace: 'nowrap',
                          }}>{cancelled ? '재구독' : '해지'}</button>
                          <button onClick={() => removeSub(realIdx)} title="삭제" aria-label="삭제" style={{
                            fontSize: 14, padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
                            background: 'transparent', color: C.sub, border: `1px solid ${C.line}`,
                          }}>🗑</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 48, color: C.sub, fontSize: 14, flexWrap: 'wrap' }}>
                        <div><span style={{ marginRight: 16 }}>월 결제액</span><b style={{ color: C.text, fontWeight: 600 }}>{s.price}원</b></div>
                        <div><span style={{ marginRight: 16 }}>다음 결제일</span><b style={{ color: C.text, fontWeight: 600 }}>{nextPaymentDate(s.payDay)}</b></div>
                      </div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
                  <img src="/char-wheat.png" alt="" style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <p style={{ color: C.sub, fontSize: 13 }}>
                    💡 한 번 가입하면 자동결제로 조용히 빠져나가는 게 구독이에요. 안 쓰는 건 곳간이가 골라드릴게요.
                  </p>
                </div>
              </div>
            )}

            {tab === 'flow' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>이번 달 현금 흐름</h2>
                <p style={{ color: C.sub, fontSize: 14, marginBottom: 20 }}>다중회귀 기반 월말 예상 잔액 + 위험 시점 (R²=0.92)</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                  {[
                    { t: '월말 예상 잔액', v: '750,000원', s: '👍 안전 범위', tone: 'green' },
                    { t: '이번 달 총 지출', v: '3,400,000원', s: '전월 대비 +4.0%', tone: 'amber' },
                    { t: '다음 위험 시점', v: 'D-7', s: '카드값 결제일', tone: 'red' },
                  ].map((c, i) => (
                    <div key={i} style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18 }}>
                      <div style={{ color: C.sub, fontSize: 13, marginBottom: 8 }}>{c.t}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{c.v}</div>
                      <Badge tone={c.tone} C={C}>{c.s}</Badge>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22, marginBottom: 24 }}>
                  <div style={{ fontWeight: 700, marginBottom: 16 }}>지출 구성</div>
                  {FLOW.map((f, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                        <span>{f.label}</span>
                        <span style={{ color: C.sub }}>{won(f.amount)}원 · {f.pct}%</span>
                      </div>
                      <div style={{ height: 8, background: C.surface, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${f.pct}%`, height: '100%', background: ({ bar: C.bar, amber: C.amber, blue: C.blue, green: C.green, plum: C.plum })[f.tone] || C.bar, borderRadius: 4, transition: 'width .6s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* 예측 모델 성능 (최종 포트폴리오 수치) */}
                <div style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <img src="/deco-wheat.png" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                    <div style={{ fontWeight: 700 }}>예측 모델 성능</div>
                  </div>
                  <p style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>다중회귀분석 · 변수 8개(구독료·외식비·쇼핑·교통비·명절 등)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    {[
                      { t: '설명력 (R²)', v: '0.92', c: C.green },
                      { t: '평균 오차', v: '4.7만원', c: C.amber },
                      { t: '오차율', v: '약 1.5%', c: C.blue },
                    ].map((m, i) => (
                      <div key={i} style={{ background: C.surface, borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ color: C.sub, fontSize: 12, marginBottom: 4 }}>{m.t}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: m.c }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'refund' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>환불 진단 센터</h2>
                <p style={{ color: C.sub, fontSize: 14, marginBottom: 20 }}>구매일·정책·사용여부를 분석해 돌려받을 돈을 자동으로 찾아드려요</p>
                <div style={{ background: `linear-gradient(135deg, ${C.greenBg}, transparent)`, border: `1px solid ${C.line}`, borderRadius: 14, padding: 18, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ color: C.sub, fontSize: 13 }}>지금 돌려받을 수 있는 금액</span>
                    <div style={{ fontSize: 28, fontWeight: 800, color: C.green, marginTop: 4 }}>119,900원</div>
                  </div>
                  <img src="/char-rice.png" alt="" style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.search, borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
                  <span style={{ color: C.sub }}>🔍</span>
                  <input value={refundQ} onChange={(e) => setRefundQ(e.target.value)} placeholder="쇼핑몰·품목 검색…"
                    style={{ background: 'transparent', border: 'none', color: C.text, outline: 'none', flex: 1, fontSize: 13 }} />
                </div>
                {REFUNDS.filter((r) =>
                  (r.store + r.item).toLowerCase().includes(refundQ.toLowerCase())
                ).map((r, i) => (
                  <div key={i} className="gk-row" style={{ borderBottom: `1px solid ${C.line}`, padding: '18px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{r.store} · {r.item}</span>
                      <Badge tone={r.tone} C={C}>{r.state}</Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 40, fontSize: 14, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div><span style={{ color: C.sub, marginRight: 12 }}>환불액</span><b style={{ color: C.green }}>{r.amount}원</b></div>
                      <div><span style={{ color: C.sub, marginRight: 12 }}>경과</span><b>{r.day}</b></div>
                    </div>
                    <p style={{ color: C.sub, fontSize: 13 }}>{r.detail}</p>
                  </div>
                ))}
                <p style={{ color: C.sub, fontSize: 13, marginTop: 16 }}>
                  지원: 쿠팡 · 네이버쇼핑 · 마켓컬리 · G마켓 · 11번가 <span style={{ opacity: .6 }}>(점진적 확대)</span>
                </p>
              </div>
            )}

            {/* ▶ 대화 시나리오 (포트폴리오 p.9) */}
            {tab === 'scenario' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <img src="/char-rice.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  <h2 style={{ fontSize: 20, fontWeight: 800 }}>곳간이 대화 시나리오</h2>
                </div>
                <p style={{ color: C.sub, fontSize: 14, marginBottom: 20 }}>실제 대화 3가지 — 카드를 누르면 곳간이 챗봇이 열려요</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  {SCENARIOS.map((sc, i) => (
                    <button key={i} onClick={() => (onAskQuestion ? onAskQuestion(sc.ask) : onOpenChat?.())} style={{
                      textAlign: 'left', cursor: 'pointer', background: C.side,
                      border: `1px solid ${C.line}`, borderRadius: 16, padding: 18,
                      display: 'flex', flexDirection: 'column', gap: 10, transition: 'transform .15s ease, border-color .15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = C.bar }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = C.line }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{sc.icon}</span>
                        <span style={{ fontWeight: 800, fontSize: 16 }}>시나리오 {i + 1}</span>
                        <Badge tone={['green', 'amber', 'red'][i]} C={C}>{sc.key}</Badge>
                      </div>
                      <div style={{ background: C.bar, color: '#fff', alignSelf: 'flex-start', borderRadius: 12, borderBottomLeftRadius: 4, padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>
                        “{sc.ask}”
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {sc.lines.map((ln, j) => (
                          <div key={j} style={{ background: C.surface, color: C.text, borderRadius: 10, padding: '8px 11px', fontSize: 12.5, lineHeight: 1.5 }}>
                            {ln}
                          </div>
                        ))}
                      </div>
                      <span style={{ color: C.bar, fontSize: 12.5, fontWeight: 700, marginTop: 2 }}>곳간이에게 이 질문하기 →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
