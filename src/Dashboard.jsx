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

// 🛡️ AI 경비 감사 — 법인카드 내역을 AI가 1차 검토하고 위험도 점수(0~100)를 매김
// score 높을수록 위험 · tone: red(고위험) amber(중위험) green(저위험)
const AUDIT = [
  { merchant: '강남 ○○ 고깃집',        dept: '영업1팀',   amount: '184,000', when: '토 21:40', score: 82, level: '고위험', tone: 'red',   reason: '주말·개인 지역 심야 결제 — 업무 관련성 확인 필요', ask: '법인카드로 주말 강남 식당에서 18만원 결제된 건이 업무용으로 적정한지 검토해줘' },
  { merchant: '쿠팡 (생활용품)',        dept: '경영지원',  amount: '43,500',  when: '일 14:05', score: 73, level: '고위험', tone: 'red',   reason: '주말 개인 성격 품목 — 영수증·용도 증빙 요청', ask: '주말에 법인카드로 결제된 쿠팡 생활용품 4.3만원의 업무 용도를 확인해줘' },
  { merchant: 'Adobe Creative Cloud',   dept: '디자인팀',  amount: '76,000',  when: '15일 정기', score: 58, level: '중위험', tone: 'amber', reason: '동일 라이선스 2건 중복 결제 의심 — 미사용 계정 점검', ask: 'Adobe 라이선스가 중복 결제되거나 안 쓰는 계정이 있는지 점검해줘' },
  { merchant: '네이버클라우드',          dept: '개발팀',    amount: '132,000', when: '1일 정기',  score: 49, level: '중위험', tone: 'amber', reason: '전월 대비 사용량 급감 — 미사용 리소스 가능성', ask: '네이버클라우드 결제가 실제 사용량 대비 적정한지 확인해줘' },
  { merchant: 'KTX 서울-부산',          dept: '재무팀',    amount: '119,800', when: '수 09:12', score: 14, level: '저위험', tone: 'green', reason: '출장 일정과 일치 — 정상 처리 권고', ask: null },
]

// 🛡️ 규칙 기반 자동 위험 점수 — 사용자가 추가한 결제 내역을 곳간이가 자동 분석
// 입력: { merchant, dept, amount, day('평일'|'주말'), hour(0~23), offsite(근무지 외 여부) }
function scoreExpense({ merchant = '', amount = '0', day = '평일', hour = 12, offsite = false }) {
  let score = 0
  const reasons = []
  if (day === '주말') { score += 30; reasons.push('주말 결제') }
  if (hour >= 22 || hour < 6) { score += 20; reasons.push('심야 결제') }
  if (offsite) { score += 25; reasons.push('근무지 외 지역') }
  // 접대성 업종 키워드
  if (/주점|바|고깃집|호프|노래|유흥|횟집|술/.test(merchant)) { score += 20; reasons.push('접대성 업종') }
  // 개인 성격 품목 키워드
  if (/생활용품|마트|편의점|쿠팡|배달|카페/.test(merchant)) { score += 12; reasons.push('개인 성격 품목') }
  // 고액 결제
  const won = parseInt(String(amount).replace(/[^0-9]/g, ''), 10) || 0
  if (won >= 300000) { score += 15; reasons.push('고액 결제') }
  score = Math.min(score, 100)
  const tone = score >= 70 ? 'red' : score >= 40 ? 'amber' : 'green'
  const level = score >= 70 ? '고위험' : score >= 40 ? '중위험' : '저위험'
  const reason = reasons.length ? reasons.join(' · ') + ' — 검토 권장' : '특이사항 없음 — 정상 처리 권고'
  return { score, tone, level, reason, category: categorize(merchant) }
}

// 가맹점명으로 세부 카테고리 자동 분류
function categorize(merchant = '') {
  const m = merchant
  if (/고깃집|횟집|주점|바|호프|식당|국밥|치킨|피자|레스토랑|뷔페/.test(m)) return '식대·접대'
  if (/카페|커피|스타벅스|투썸|베이커리|디저트/.test(m)) return '카페·간식'
  if (/KTX|택시|버스|주유|기차|항공|렌터카|톨게이트|주차/.test(m)) return '교통·출장'
  if (/호텔|리조트|숙박|모텔|펜션/.test(m)) return '숙박'
  if (/Adobe|클라우드|구독|소프트|라이선스|SaaS|Slack|Figma|GitHub|넷플릭스|노션/i.test(m)) return 'SW·구독'
  if (/쿠팡|마트|생활용품|편의점|다이소|배달|이마트|홈플러스/.test(m)) return '비품·생활'
  if (/문구|사무|프린트|토너|복사/.test(m)) return '사무용품'
  return '기타'
}

// 추가된 결제 내역을 바탕으로 곳간이가 즉석에서 만드는 동적 답변 (5초 뒤 출력)
function buildAuditAnswer({ merchant, dept, wonStr, when, category, level, score, reason }) {
  const emoji = level === '고위험' ? '🚨' : level === '중위험' ? '⚠️' : '✅'
  const verdict = level === '고위험'
    ? '업무 관련성 소명이 필요합니다. 담당자에게 영수증·목적 증빙을 요청하세요.'
    : level === '중위험'
    ? '한 번 더 확인이 필요합니다. 반복 결제·한도 초과 여부를 점검하세요.'
    : '특이사항이 없어 정상 처리해도 됩니다.'
  return `🛡️ AI 1차 감사 결과 — 위험점수 ${score} (${level}) ${emoji}\n`
    + `\n· 가맹점: ${merchant}`
    + `\n· 부서: ${dept} · 결제: ${when} · ${wonStr}원`
    + `\n· 분류: ${category}`
    + `\n· 사유: ${reason}`
    + `\n\n📋 권고: ${verdict}`
}

// 🗓️ 주말 결제 — 자동 위험 판정 (tone) + 동적 답변
function scoreWeekend({ merchant = '', amount = '0', hour = 12, offsite = false }) {
  const won = parseInt(String(amount).replace(/[^0-9]/g, ''), 10) || 0
  let risk = 0
  if (hour >= 22 || hour < 6) risk += 2
  if (offsite) risk += 1
  if (/주점|바|고깃집|호프|노래|유흥|횟집|술/.test(merchant)) risk += 2
  if (/생활용품|마트|편의점|쿠팡|배달/.test(merchant)) risk += 1
  if (won >= 200000) risk += 1
  const tone = risk >= 3 ? 'red' : 'amber'
  return { tone }
}
function buildWeekendAnswer({ merchant, dept, who, wonStr, when, place, tone }) {
  const head = tone === 'red' ? '🗓️ 주말 개인지역 결제 확인 요청 — 고위험 🚨' : '🗓️ 주말 개인지역 결제 확인 요청'
  return `${head}\n`
    + `\n· ${dept} ${who} · ${when} · ${place} · ${wonStr}원`
    + `\n· 가맹점: ${merchant}`
    + `\n\n담당자에게 '업무 관련성 소명' 알림을 발송했습니다.`
    + `\n3일 내 미소명 시 개인용(환수 대상)으로 자동 분류됩니다.`
}

// 💳 미사용 라이선스 — 좌석 사용률로 자동 판정 + 동적 답변
function scoreLicense({ seats = 0, used = 0 }) {
  const idle = Math.max(seats - used, 0)
  const rate = seats > 0 ? used / seats : 1
  const tone = rate < 0.6 ? 'red' : rate < 0.9 ? 'amber' : 'green'
  const note = idle > 0
    ? (tone === 'red' ? `${idle}좌석 미사용 — 즉시 해지 권장` : `${idle}좌석 정리 가능`)
    : '전 좌석 활성 — 유지 권장'
  return { tone, idle, note }
}
function buildLicenseAnswer({ name, dept, seats, used, monthly, idle, tone }) {
  const won = (n) => n.toLocaleString('ko-KR')
  const perSeat = seats > 0 ? Math.round(monthly / seats) : 0
  const save = perSeat * idle
  if (idle <= 0) {
    return `💳 ${name} 점검 결과\n\n· ${dept} · 좌석 ${used}/${seats} 전원 활성\n· 월 ${won(monthly)}원 — 낭비 없음\n\n✅ 현 상태 유지를 권장합니다.`
  }
  return `💳 ${name} 점검 결과\n`
    + `\n· ${dept} · 좌석 ${used}/${seats} 사용 (미사용 ${idle})`
    + `\n· 미사용분 월 약 ${won(save)}원 낭비 중`
    + `\n\n✅ ${idle}좌석 정리 시 월 ${won(save)}원 · 연 ${won(save * 12)}원 절감`
    + `\n관리자 콘솔 → 미사용 계정 → 라이선스 회수 순으로 진행하세요.`
}

// 🗓️ 주말 개인지역 결제 — 주말·근무지 외 지역에서 발생한 법인카드 결제만 모아
// 직원에게 '업무 관련성 확인'을 요청. status: 대기중 / 업무확인 / 개인용
const WEEKEND = [
  { merchant: '제주 ○○ 횟집',   dept: '영업1팀', who: '김OO', amount: '142,000', when: '토 19:30', place: '제주 (근무지 외)', status: '대기중',   tone: 'amber', ask: '주말에 제주에서 결제된 법인카드 14.2만원이 업무 관련 지출인지 확인 요청해줘' },
  { merchant: '강남 ○○ 바',      dept: '기획팀',  who: '이OO', amount: '88,000',  when: '일 23:10', place: '심야 결제',       status: '대기중',   tone: 'red',   ask: '일요일 심야에 결제된 법인카드 8.8만원의 업무 관련성을 확인 요청해줘' },
  { merchant: '속초 리조트',      dept: '디자인팀', who: '박OO', amount: '210,000', when: '토 15:00', place: '속초 (근무지 외)', status: '업무확인', tone: 'green', ask: null },
  { merchant: '쿠팡 (생활용품)', dept: '경영지원', who: '최OO', amount: '43,500',  when: '일 14:05', place: '개인 성격 품목',   status: '개인용',   tone: 'red',   ask: null },
]

// 💳 미사용 라이선스 — 결제는 되는데 로그인/사용이 없는 SaaS 좌석을 탐지해 해지 추천
// lastLogin: 마지막 로그인 · seats: 결제좌석/실사용 · monthly: 월 비용(원)
const LICENSE = [
  { name: 'Adobe Creative Cloud', dept: '디자인팀',  seats: 8,  used: 5, lastLogin: '없음 (3개월+)', monthly: 304000, tone: 'red',   note: '3좌석 미사용 — 즉시 해지 권장', ask: 'Adobe Creative Cloud 8좌석 중 3개가 3개월 넘게 미사용인데 해지 절차를 알려줘' },
  { name: 'Slack 비즈니스+',       dept: '전사',      seats: 40, used: 31, lastLogin: '9명 30일+', monthly: 360000, tone: 'amber', note: '퇴사·미접속 9명 좌석 정리 가능',      ask: 'Slack 좌석 40개 중 9명이 30일 넘게 미접속인데 비활성 좌석을 정리하는 방법 알려줘' },
  { name: 'Figma 프로',            dept: '기획팀',    seats: 6,  used: 6, lastLogin: '전원 활성', monthly: 108000, tone: 'green', note: '전 좌석 활성 — 유지 권장',          ask: null },
  { name: 'GitHub Copilot',        dept: '개발팀',    seats: 12, used: 7, lastLogin: '5명 미사용', monthly: 114000, tone: 'red',   note: '5좌석 미사용 — 다운그레이드 검토',   ask: 'GitHub Copilot 12좌석 중 5개가 미사용인데 좌석을 줄이는 게 나을지 검토해줘' },
]

// 📅 월별 내역 (달력) — 토스 월별 내역 스타일 · 5·6월 예시
const CAL = {
  5: [
    { d: 2,  merchant: '스타벅스 강남', amount: 6300,   cat: '카페' },
    { d: 2,  merchant: '쿠팡',          amount: 38900,  cat: '쇼핑' },
    { d: 5,  merchant: 'GS25',          amount: 4800,   cat: '편의점' },
    { d: 8,  merchant: '배달의민족',     amount: 21000,  cat: '식비' },
    { d: 12, merchant: 'Netflix',       amount: 13500,  cat: '구독' },
    { d: 12, merchant: '이마트',         amount: 64200,  cat: '장보기' },
    { d: 17, merchant: 'CGV',           amount: 28000,  cat: '문화' },
    { d: 21, merchant: '카카오T 택시',   amount: 12400,  cat: '교통' },
    { d: 25, merchant: '카드값 결제',     amount: 480000, cat: '고정' },
    { d: 25, merchant: '스타벅스',       amount: 5600,   cat: '카페' },
    { d: 29, merchant: '올리브영',       amount: 33400,  cat: '쇼핑' },
  ],
  6: [
    { d: 1,  merchant: '월세 이체',       amount: 650000, cat: '고정' },
    { d: 3,  merchant: '배달의민족',     amount: 18500,  cat: '식비' },
    { d: 3,  merchant: '투썸플레이스',    amount: 7100,   cat: '카페' },
    { d: 6,  merchant: '쿠팡',          amount: 52300,  cat: '쇼핑' },
    { d: 9,  merchant: 'Spotify',       amount: 10900,  cat: '구독' },
    { d: 12, merchant: 'GS25',          amount: 5200,   cat: '편의점' },
    { d: 14, merchant: '주유소',         amount: 60000,  cat: '교통' },
    { d: 18, merchant: '교보문고',       amount: 24800,  cat: '문화' },
    { d: 22, merchant: '마켓컬리',       amount: 41600,  cat: '장보기' },
    { d: 25, merchant: '카드값 결제',     amount: 512000, cat: '고정' },
  ],
}
// 2026년 5월 1일=목(4), 6월 1일=월(1) — 달력 첫 칸 요일
const MONTH_FIRST_DOW = { 5: 4, 6: 1 }
const MONTH_DAYS = { 5: 31, 6: 30 }
const CAT_EMOJI = { 카페: '☕', 쇼핑: '🛍️', 편의점: '🏪', 식비: '🍜', 구독: '🔄', 장보기: '🛒', 문화: '🎬', 교통: '🚕', 고정: '🏠', 식대접대: '🍽️', 'SW·구독': '💻', 출장: '✈️', 사무용품: '📎', 숙박: '🏨' }

// 🗓️ 법인 지출 달력 (B2B) — 법인카드 결제 5·6월 예시 (부서·위험도 포함)
const CAL_B2B = {
  5: [
    { d: 3,  merchant: 'KTX 서울-부산', amount: 119800, cat: '출장',    dept: '재무팀',   tone: 'green' },
    { d: 7,  merchant: 'Adobe CC',      amount: 76000,  cat: 'SW·구독', dept: '디자인팀', tone: 'amber' },
    { d: 10, merchant: '오피스디포',     amount: 43000,  cat: '사무용품', dept: '경영지원', tone: 'green' },
    { d: 11, merchant: '강남 고깃집',    amount: 184000, cat: '식대접대', dept: '영업1팀',  tone: 'red' },
    { d: 18, merchant: '네이버클라우드', amount: 132000, cat: 'SW·구독', dept: '개발팀',   tone: 'amber' },
    { d: 24, merchant: '제주 횟집',      amount: 142000, cat: '식대접대', dept: '영업1팀',  tone: 'red' },
  ],
  6: [
    { d: 2,  merchant: 'Slack 비즈니스', amount: 360000, cat: 'SW·구독', dept: '전사',     tone: 'amber' },
    { d: 5,  merchant: '쿠팡 생활용품',  amount: 43500,  cat: '사무용품', dept: '경영지원', tone: 'red' },
    { d: 9,  merchant: 'GitHub Copilot', amount: 114000, cat: 'SW·구독', dept: '개발팀',   tone: 'red' },
    { d: 14, merchant: '택시 (심야)',    amount: 28000,  cat: '출장',    dept: '기획팀',   tone: 'amber' },
    { d: 20, merchant: '속초 리조트',    amount: 210000, cat: '숙박',    dept: '디자인팀', tone: 'green' },
    { d: 27, merchant: '강남 바',        amount: 88000,  cat: '식대접대', dept: '기획팀',   tone: 'red' },
  ],
}

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
  // 탭 정의 + B2C/B2B 그룹 (scenario는 공통)
  const TAB_DEFS = [
    { k: 'subs',     icon: '📋', label: '구독 목록',      group: 'b2c' },
    { k: 'flow',     icon: '📊', label: '현금 흐름',      group: 'b2c' },
    { k: 'refund',   icon: '↩️', label: '환불 진단',      group: 'b2c' },
    { k: 'mission',  icon: '🎯', label: '오늘의 미션',    group: 'b2c' },
    { k: 'calendar', icon: '📅', label: '월별 내역',      group: 'b2c' },
    { k: 'audit',    icon: '🛡️', label: 'AI 경비 감사',   group: 'b2b' },
    { k: 'weekend',  icon: '🗓️', label: '주말 결제 확인', group: 'b2b' },
    { k: 'license',  icon: '💳', label: '미사용 라이선스', group: 'b2b' },
    { k: 'calendarB', icon: '🗓️', label: '법인 지출 달력', group: 'b2b' },
    { k: 'scenario', icon: '💬', label: '대화 시나리오',  group: 'both' },
  ]
  const [grp, setGrp] = useState('b2c')   // 현재 보고 있는 그룹
  const [calMonth, setCalMonth] = useState(5)   // 달력: 5월/6월
  const [calDay, setCalDay] = useState(null)    // 선택한 날짜
  const visibleTabs = TAB_DEFS.filter((t) => t.group === grp || t.group === 'both')
  // 그룹을 바꾸면 그 그룹의 첫 탭으로 자동 이동
  const switchGroup = (g) => {
    setGrp(g)
    const first = TAB_DEFS.find((t) => t.group === g)
    if (first && !TAB_DEFS.some((t) => t.k === tab && (t.group === g || t.group === 'both'))) setTab(first.k)
  }
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

  // 🗓️ 주말 결제 — 각 건의 확인 상태 (대기중 → 업무확인 / 개인용)
  const [wkStatus, setWkStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gotgani_weekend') || 'null') || WEEKEND.map((w) => w.status) }
    catch { return WEEKEND.map((w) => w.status) }
  })
  const setWk = (i, v) => {
    setWkStatus((prev) => {
      const next = prev.map((s, j) => (j === i ? v : s))
      try { localStorage.setItem('gotgani_weekend', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // ── 예시 항목 숨김(삭제) 세트 — 예시도 지울 수 있게 ──
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gotgani_hidden') || '{}') } catch { return {} }
  })
  const hideEx = (kind, i) => {
    setHidden((prev) => {
      const next = { ...prev, [kind]: [...(prev[kind] || []), i] }
      try { localStorage.setItem('gotgani_hidden', JSON.stringify(next)) } catch {}
      return next
    })
  }
  const isHidden = (kind, i) => (hidden[kind] || []).includes(i)

  // 🛡️ 경비 감사 — 사용자가 직접 추가한 결제 내역 (localStorage 저장)
  const [myAudit, setMyAudit] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gotgani_myaudit') || '[]') } catch { return [] }
  })
  // 🗓️ 주말 결제 / 💳 라이선스 — 경비감사에서 자동 분배되어 쌓이는 목록
  const [myWk, setMyWk] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gotgani_mywk') || '[]') } catch { return [] }
  })
  const [myLic, setMyLic] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gotgani_mylic') || '[]') } catch { return [] }
  })

  const [auditForm, setAuditForm] = useState({ merchant: '', dept: '', amount: '', day: '평일', hour: '12', offsite: false })
  const addAudit = () => {
    if (!auditForm.merchant.trim() || !auditForm.amount.trim()) return
    const merchant = auditForm.merchant.trim()
    const dept = auditForm.dept.trim() || '미지정'
    const hour = parseInt(auditForm.hour, 10) || 12
    const sc = scoreExpense({ merchant, amount: auditForm.amount, day: auditForm.day, hour, offsite: auditForm.offsite })
    const wonStr = (parseInt(auditForm.amount.replace(/[^0-9]/g, ''), 10) || 0).toLocaleString('ko-KR')
    const monthly = parseInt(auditForm.amount.replace(/[^0-9]/g, ''), 10) || 0
    const when = `${auditForm.day} ${String(hour).padStart(2, '0')}:00`

    // ① 경비 감사에 추가
    const auditEntry = {
      merchant, dept, amount: wonStr, when,
      score: sc.score, level: sc.level, tone: sc.tone, reason: sc.reason, category: sc.category,
      ask: `법인카드로 ${merchant}에서 ${wonStr}원 결제된 건의 업무 관련성을 검토해줘`,
      answer: buildAuditAnswer({ merchant, dept, wonStr, when, category: sc.category, level: sc.level, score: sc.score, reason: sc.reason }),
      _mine: true,
    }
    const nextAudit = [auditEntry, ...myAudit]
    setMyAudit(nextAudit)
    try { localStorage.setItem('gotgani_myaudit', JSON.stringify(nextAudit)) } catch {}

    // ② 자동 분배 — 주말/근무지외/심야면 '주말 결제 확인' 탭에도
    const isLate = hour >= 22 || hour < 6
    if (auditForm.day === '주말' || auditForm.offsite || isLate) {
      const place = auditForm.offsite ? '근무지 외' : (isLate ? '심야 결제' : '주말 결제')
      const wkTone = scoreWeekend({ merchant, amount: auditForm.amount, hour, offsite: auditForm.offsite }).tone
      const wkWhen = `주말 ${String(hour).padStart(2, '0')}:00`
      const wkEntry = {
        merchant, dept, who: '담당자', amount: wonStr, when: wkWhen, place, status: '대기중', tone: wkTone,
        ask: `주말에 ${merchant}에서 결제된 법인카드 ${wonStr}원의 업무 관련성을 확인 요청해줘`,
        answer: buildWeekendAnswer({ merchant, dept, who: '담당자', wonStr, when: wkWhen, place, tone: wkTone }),
        _mine: true, _auto: true,
      }
      const nextWk = [wkEntry, ...myWk]
      setMyWk(nextWk)
      try { localStorage.setItem('gotgani_mywk', JSON.stringify(nextWk)) } catch {}
    }

    // ③ 자동 분배 — SW·구독 카테고리면 '미사용 라이선스' 탭에도
    if (sc.category === 'SW·구독') {
      const licEntry = {
        name: merchant, dept, seats: 1, used: 0, monthly, tone: 'amber',
        note: '카드에서 감지된 구독 — 실제 사용 여부 점검 필요', lastLogin: '확인 필요', _sub: true,
        ask: `${merchant} 구독이 실제로 쓰이고 있는지, 안 쓰면 어떻게 해지하는지 알려줘`,
        answer: `💳 ${merchant} 구독 감지\n\n· ${dept} · 월 ${wonStr}원\n· 법인카드 내역에서 자동 감지된 구독이에요.\n\n실제 로그인·사용 여부를 확인하고, 미사용이면 해지해 매달 ${wonStr}원을 아끼세요.`,
        _mine: true, _auto: true,
      }
      const nextLic = [licEntry, ...myLic]
      setMyLic(nextLic)
      try { localStorage.setItem('gotgani_mylic', JSON.stringify(nextLic)) } catch {}
    }

    setAuditForm({ merchant: '', dept: '', amount: '', day: '평일', hour: '12', offsite: false })
  }
  const removeAudit = (idx) => {
    const next = myAudit.filter((_, i) => i !== idx)
    setMyAudit(next)
    try { localStorage.setItem('gotgani_myaudit', JSON.stringify(next)) } catch {}
  }
  const removeWk = (idx) => {
    const next = myWk.filter((_, i) => i !== idx)
    setMyWk(next)
    try { localStorage.setItem('gotgani_mywk', JSON.stringify(next)) } catch {}
  }
  const setMyWkStatus = (idx, v) => {
    const next = myWk.map((w, i) => (i === idx ? { ...w, status: v } : w))
    setMyWk(next)
    try { localStorage.setItem('gotgani_mywk', JSON.stringify(next)) } catch {}
  }
  const removeLic = (idx) => {
    const next = myLic.filter((_, i) => i !== idx)
    setMyLic(next)
    try { localStorage.setItem('gotgani_mylic', JSON.stringify(next)) } catch {}
  }

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
        <aside style={{ width: 176, minHeight: 'calc(100vh - 52px)', background: C.side, padding: '16px 12px', flexShrink: 0 }}>
          {/* B2C / B2B 전환 */}
          <div style={{ display: 'flex', gap: 4, background: C.surface, borderRadius: 10, padding: 4, marginBottom: 14 }}>
            {[{ g: 'b2c', label: '개인 B2C' }, { g: 'b2b', label: '기업 B2B' }].map((x) => (
              <button key={x.g} onClick={() => switchGroup(x.g)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700,
                background: grp === x.g ? C.bar : 'transparent',
                color: grp === x.g ? '#fff' : C.sub,
              }}>{x.label}</button>
            ))}
          </div>
          {visibleTabs.map((it) => (
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
          <div style={{ display: 'flex', gap: 24, padding: '0 32px', borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap' }}>
            {visibleTabs.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{
                padding: '16px 2px', background: 'none', border: 'none', cursor: 'pointer',
                color: tab === t.k ? C.text : C.sub, fontSize: 15, fontWeight: tab === t.k ? 700 : 500,
                borderBottom: `2px solid ${tab === t.k ? C.bar : 'transparent'}`, marginBottom: -1,
              }}>{t.icon} {t.label}</button>
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

            {/* ▶ 🛡️ AI 경비 감사 */}
            {tab === 'audit' && (() => {
              const allAudit = [
                ...myAudit.map((a, i) => ({ ...a, _src: 'mine', _i: i })),
                ...AUDIT.map((a, i) => ({ ...a, _src: 'ex', _i: i })).filter((a) => !isHidden('audit', a._i)),
              ]
              const high = allAudit.filter((a) => a.tone === 'red').length
              const mid  = allAudit.filter((a) => a.tone === 'amber').length
              const low  = allAudit.filter((a) => a.tone === 'green').length
              const total = allAudit.reduce((s, a) => s + (parseInt(String(a.amount).replace(/,/g, ''), 10) || 0), 0)
              const won = (n) => n.toLocaleString('ko-KR')
              return (
                <div style={{ animation: 'fadeUp .3s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>🛡️ AI 경비 감사 리포트</h2>
                    <Badge tone="blue" C={C}>B2B</Badge>
                  </div>
                  <p style={{ color: C.sub, fontSize: 14, marginBottom: 18 }}>
                    법인카드 내역을 AI가 1차 검토하고 위험도를 점수화합니다. 회계·재무팀은 고위험 건만 집중 확인하면 됩니다.
                  </p>

                  {/* 요약 카드 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: '검토 건수', value: `${allAudit.length}건`, tone: null },
                      { label: '고위험', value: `${high}건`, tone: 'red' },
                      { label: '중위험', value: `${mid}건`, tone: 'amber' },
                      { label: '검토 금액', value: `${won(total)}원`, tone: null },
                    ].map((s, i) => (
                      <div key={i} style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.tone === 'red' ? C.red : s.tone === 'amber' ? C.amber : C.text }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* ➕ 카드내역 직접 추가 — 입력하면 곳간이가 자동으로 위험 점수를 매김 */}
                  <div style={{ background: C.side, border: `1px dashed ${C.bar}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginBottom: 10 }}>➕ 카드 내역 추가 <span style={{ color: C.sub, fontWeight: 500 }}>— 넣으면 곳간이가 자동으로 위험도를 매겨요</span></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input value={auditForm.merchant} onChange={(e) => setAuditForm({ ...auditForm, merchant: e.target.value })}
                        placeholder="가맹점 (예: 강남 고깃집)"
                        style={{ flex: '2 1 160px', minWidth: 0, background: C.search, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', color: C.text, fontSize: 13, outline: 'none' }} />
                      <input value={auditForm.dept} onChange={(e) => setAuditForm({ ...auditForm, dept: e.target.value })}
                        placeholder="부서 (선택)"
                        style={{ flex: '1 1 90px', minWidth: 0, background: C.search, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', color: C.text, fontSize: 13, outline: 'none' }} />
                      <input value={auditForm.amount} onChange={(e) => setAuditForm({ ...auditForm, amount: e.target.value })}
                        placeholder="금액 (원)" inputMode="numeric"
                        style={{ flex: '1 1 100px', minWidth: 0, background: C.search, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', color: C.text, fontSize: 13, outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                      <select value={auditForm.day} onChange={(e) => setAuditForm({ ...auditForm, day: e.target.value })}
                        style={{ background: C.search, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', color: C.text, fontSize: 13, outline: 'none' }}>
                        <option value="평일">평일</option>
                        <option value="주말">주말</option>
                      </select>
                      <select value={auditForm.hour} onChange={(e) => setAuditForm({ ...auditForm, hour: e.target.value })}
                        style={{ background: C.search, border: `1px solid ${C.line}`, borderRadius: 9, padding: '9px 11px', color: C.text, fontSize: 13, outline: 'none' }}>
                        {Array.from({ length: 24 }, (_, h) => <option key={h} value={String(h)}>{String(h).padStart(2, '0')}시</option>)}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.sub, cursor: 'pointer' }}>
                        <input type="checkbox" checked={auditForm.offsite} onChange={(e) => setAuditForm({ ...auditForm, offsite: e.target.checked })} />
                        근무지 외
                      </label>
                      <button onClick={addAudit} style={{
                        marginLeft: 'auto', background: C.bar, color: '#fff', border: 'none', borderRadius: 9,
                        padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>분석 + 추가</button>
                    </div>
                  </div>

                  {/* 내역 리스트 (사용자 추가분 + 예시) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {allAudit.map((a) => (
                      <div key={`${a._src}-${a._i}`} style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          {/* 위험 점수 원형 */}
                          <div style={{
                            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: a.tone === 'red' ? C.redBg : a.tone === 'amber' ? C.amberBg : C.greenBg,
                            color: a.tone === 'red' ? C.red : a.tone === 'amber' ? C.amber : C.green,
                            border: `2px solid ${a.tone === 'red' ? C.red : a.tone === 'amber' ? C.amber : C.green}`,
                          }}>
                            <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1 }}>{a.score}</span>
                            <span style={{ fontSize: 8, opacity: .8 }}>점</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{a.merchant}</span>
                              <Badge tone={a.tone} C={C}>{a.level}</Badge>
                              {a.category && <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 6, padding: '2px 8px' }}>{a.category}</span>}
                            </div>
                            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2 }}>{a.dept} · {a.when} · {a.amount}원</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: C.text, marginTop: 10, lineHeight: 1.55 }}>
                          <span style={{ fontWeight: 700, color: a.tone === 'red' ? C.red : a.tone === 'amber' ? C.amber : C.green }}>AI 1차 검사: </span>
                          {a.reason}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          {a.ask && (
                            <button onClick={() => (onAskQuestion ? onAskQuestion(a.ask, a.answer || null) : onOpenChat?.())} style={{
                              background: C.bar, color: '#fff', border: 'none', borderRadius: 10,
                              padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                            }}>곳간이에게 정밀 검토 요청 →</button>
                          )}
                          {a._mine && <span style={{ fontSize: 11, color: C.bar, fontWeight: 700 }}>내가 추가함</span>}
                          <button onClick={() => (a._src === 'mine' ? removeAudit(a._i) : hideEx('audit', a._i))} style={{
                            background: 'transparent', color: C.sub, border: `1px solid ${C.line}`, borderRadius: 10,
                            padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}>삭제</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ color: C.sub, fontSize: 12.5, marginTop: 16 }}>
                    위험 점수 0~100 · 70 이상 고위험 · AI가 1차 분류한 결과이며 최종 판단은 담당자가 합니다.
                  </p>
                </div>
              )
            })()}

            {/* ▶ 🗓️ 주말 개인지역 결제 확인 */}
            {tab === 'weekend' && (() => {
              const STATUS_META = {
                '대기중':   { tone: 'amber', label: '확인 대기중' },
                '업무확인': { tone: 'green', label: '업무용 확인됨' },
                '개인용':   { tone: 'red',   label: '개인용 (회수 대상)' },
              }
              const allWk = [
                ...myWk.map((w, i) => ({ ...w, _src: 'mine', _i: i })),
                ...WEEKEND.map((w, i) => ({ ...w, _src: 'ex', _i: i, status: wkStatus[i] || '대기중' })).filter((w) => !isHidden('wk', w._i)),
              ]
              const pending = allWk.filter((w) => w.status === '대기중').length
              return (
                <div style={{ animation: 'fadeUp .3s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>🗓️ 주말 개인지역 결제 확인</h2>
                    <Badge tone="blue" C={C}>B2B</Badge>
                    {pending > 0 && <Badge tone="amber" C={C}>확인 대기 {pending}건</Badge>}
                  </div>
                  <p style={{ color: C.sub, fontSize: 14, marginBottom: 18 }}>
                    주말·근무지 외 지역에서 발생한 법인카드 결제입니다. 각 건의 업무 관련성을 담당자에게 확인 요청하세요.
                  </p>

                  <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: C.text }}>
                    💡 내역은 <b>AI 경비 감사</b> 탭에서 추가하면, 주말·근무지 외·심야 결제가 여기로 <b>자동 분류</b>돼요.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {allWk.map((w) => {
                      const st = w.status || '대기중'
                      const meta = STATUS_META[st] || STATUS_META['대기중']
                      const setSt = (v) => (w._src === 'mine' ? setMyWkStatus(w._i, v) : setWk(w._i, v))
                      return (
                        <div key={`${w._src}-${w._i}`} style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{w.merchant}</span>
                            <Badge tone={meta.tone} C={C}>{meta.label}</Badge>
                            {w._src === 'mine' && <span style={{ fontSize: 11, color: C.bar, fontWeight: 700 }}>내가 추가함</span>}
                          </div>
                          <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>
                            {w.dept} · {w.who} · {w.when} · {w.amount}원 · <span style={{ color: C.red }}>{w.place}</span>
                          </div>

                          {/* 액션: 업무 관련성 확인 요청 / 처리 */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            {st === '대기중' ? (
                              <>
                                {w.ask && (
                                  <button onClick={() => (onAskQuestion ? onAskQuestion(w.ask, w.answer || null) : onOpenChat?.())} style={{
                                    background: C.bar, color: '#fff', border: 'none', borderRadius: 10,
                                    padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                                  }}>업무 관련성 확인 요청</button>
                                )}
                                <button onClick={() => setSt('업무확인')} style={{
                                  background: 'transparent', color: C.green, border: `1px solid ${C.green}`, borderRadius: 10,
                                  padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                                }}>업무용으로 확인</button>
                                <button onClick={() => setSt('개인용')} style={{
                                  background: 'transparent', color: C.red, border: `1px solid ${C.red}`, borderRadius: 10,
                                  padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                                }}>개인용으로 처리</button>
                                <button onClick={() => (w._src === 'mine' ? removeWk(w._i) : hideEx('wk', w._i))} style={{
                                  background: 'transparent', color: C.sub, border: `1px solid ${C.line}`, borderRadius: 10,
                                  padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                }}>삭제</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setSt('대기중')} style={{
                                  background: 'transparent', color: C.sub, border: `1px solid ${C.line}`, borderRadius: 10,
                                  padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                                }}>↺ 다시 확인 대기로</button>
                                <button onClick={() => (w._src === 'mine' ? removeWk(w._i) : hideEx('wk', w._i))} style={{
                                  background: 'transparent', color: C.sub, border: `1px solid ${C.line}`, borderRadius: 10,
                                  padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                }}>삭제</button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ color: C.sub, fontSize: 12.5, marginTop: 16 }}>
                    '개인용'으로 처리된 건은 환수(회수) 대상으로 분류됩니다. 확인 상태는 자동 저장됩니다.
                  </p>
                </div>
              )
            })()}

            {/* ▶ 💳 미사용 라이선스 */}
            {tab === 'license' && (() => {
              const won = (n) => n.toLocaleString('ko-KR')
              const allLic = [
                ...myLic.map((l, i) => ({ ...l, _src: 'mine', _i: i })),
                ...LICENSE.map((l, i) => ({ ...l, _src: 'ex', _i: i })).filter((l) => !isHidden('lic', l._i)),
              ]
              // 미사용 좌석 비율로 낭비 추정액 계산
              const waste = allLic.reduce((s, l) => {
                const idle = l.seats - l.used
                return s + (idle > 0 ? Math.round((l.monthly / l.seats) * idle) : 0)
              }, 0)
              const cutCount = allLic.filter((l) => l.tone === 'red').length
              return (
                <div style={{ animation: 'fadeUp .3s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>💳 미사용 라이선스</h2>
                    <Badge tone="blue" C={C}>B2B</Badge>
                  </div>
                  <p style={{ color: C.sub, fontSize: 14, marginBottom: 18 }}>
                    결제는 되는데 로그인·사용이 없는 좌석을 탐지합니다. 중복 구독·퇴사자 계정·요금제 과잉을 정리해 구독료를 절약하세요.
                  </p>

                  {/* 절약 가능액 강조 카드 */}
                  <div style={{
                    background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 16,
                    padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 4 }}>이번 달 절약 가능 (미사용 좌석 기준)</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: C.green }}>약 {won(waste)}원<span style={{ fontSize: 14, fontWeight: 600 }}> / 월</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 4 }}>해지 권장</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.red }}>{cutCount}건</div>
                    </div>
                  </div>

                  <div style={{ background: C.greenBg, border: `1px solid ${C.green}`, borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: C.text }}>
                    💡 <b>AI 경비 감사</b>에서 SW·구독 결제를 추가하면 여기로 <b>자동 감지</b>돼요. 실제 사용 여부만 확인하면 됩니다.
                  </div>

                  {/* 라이선스 리스트 (사용자 추가분 + 예시) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {allLic.map((l) => {
                      const idle = l.seats - l.used
                      const pct = l.seats > 0 ? Math.round((l.used / l.seats) * 100) : 0
                      return (
                        <div key={`${l._src}-${l._i}`} style={{ background: C.side, border: `1px solid ${C.line}`, borderRadius: 14, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{l.name}</span>
                            <Badge tone={l.tone} C={C}>{l.tone === 'red' ? '해지 권장' : l.tone === 'amber' ? '정리 가능' : '유지'}</Badge>
                            {l._auto && <span style={{ fontSize: 11, color: C.bar, fontWeight: 700 }}>카드 자동감지</span>}
                            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: C.sub }}>{l.dept} · 월 {won(l.monthly)}원</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: C.sub, marginTop: 6 }}>
                            {l._sub
                              ? '카드 내역에서 감지된 구독 · 사용 여부 미확인'
                              : <>좌석 {l.used}/{l.seats} 사용 · 마지막 로그인: {l.lastLogin}{idle > 0 && <span style={{ color: C.red, fontWeight: 700 }}> · 미사용 {idle}좌석</span>}</>}
                          </div>
                          {/* 사용률 바 */}
                          <div style={{ height: 8, borderRadius: 999, background: C.surface, overflow: 'hidden', marginTop: 8 }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999,
                              background: l.tone === 'red' ? C.red : l.tone === 'amber' ? C.amber : C.green }} />
                          </div>
                          <div style={{ fontSize: 13, color: C.text, marginTop: 10 }}>
                            <span style={{ fontWeight: 700, color: l.tone === 'red' ? C.red : l.tone === 'amber' ? C.amber : C.green }}>진단: </span>{l.note}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            {l.ask && (
                              <button onClick={() => (onAskQuestion ? onAskQuestion(l.ask, l.answer || null) : onOpenChat?.())} style={{
                                background: C.bar, color: '#fff', border: 'none', borderRadius: 10,
                                padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                              }}>곳간이에게 해지 방법 묻기 →</button>
                            )}
                            <button onClick={() => (l._src === 'mine' ? removeLic(l._i) : hideEx('lic', l._i))} style={{
                              background: 'transparent', color: C.sub, border: `1px solid ${C.line}`, borderRadius: 10,
                              padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}>삭제</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p style={{ color: C.sub, fontSize: 12.5, marginTop: 16 }}>
                    절약 가능액은 미사용 좌석 × 좌석당 단가로 추정한 값입니다. 실제 해지는 각 서비스 관리자 페이지에서 진행하세요.
                  </p>
                </div>
              )
            })()}

            {/* ▶ 📅 월별 내역 (달력) — 토스 스타일: 미니멀·여백·점 인디케이터 */}
            {tab === 'calendar' && (() => {
              const won = (n) => n.toLocaleString('ko-KR')
              const txns = CAL[calMonth] || []
              const total = txns.reduce((s, t) => s + t.amount, 0)
              const byDay = {}
              txns.forEach((t) => { byDay[t.d] = (byDay[t.d] || 0) + t.amount })
              const maxDay = Math.max(1, ...Object.values(byDay))
              const days = MONTH_DAYS[calMonth]
              const firstDow = MONTH_FIRST_DOW[calMonth]
              const cells = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
              const dayTxns = calDay ? txns.filter((t) => t.d === calDay) : []
              const WD = ['일', '월', '화', '수', '목', '금', '토']
              const fixed = txns.filter((t) => t.cat === '고정').reduce((s, t) => s + t.amount, 0)
              const variable = total - fixed
              return (
                <div style={{ animation: 'fadeUp .3s ease', maxWidth: 460, margin: '0 auto' }}>
                  {/* 월 전환 헤더 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 22 }}>
                    <button onClick={() => { setCalMonth(5); setCalDay(null) }} disabled={calMonth === 5}
                      style={{ background: 'none', border: 'none', cursor: calMonth === 5 ? 'default' : 'pointer', color: calMonth === 5 ? C.line : C.sub, fontSize: 22, lineHeight: 1, padding: 4 }}>‹</button>
                    <div style={{ textAlign: 'center', minWidth: 96 }}>
                      <div style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>2026</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>{calMonth}월</div>
                    </div>
                    <button onClick={() => { setCalMonth(6); setCalDay(null) }} disabled={calMonth === 6}
                      style={{ background: 'none', border: 'none', cursor: calMonth === 6 ? 'default' : 'pointer', color: calMonth === 6 ? C.line : C.sub, fontSize: 22, lineHeight: 1, padding: 4 }}>›</button>
                  </div>

                  {/* 이번 달 지출 요약 카드 */}
                  <div style={{ background: C.side, borderRadius: 18, padding: '18px 20px', marginBottom: 22, boxShadow: 'var(--shadow-card, 0 8px 24px rgba(58,40,23,.06))' }}>
                    <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>{calMonth}월 총 지출</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-1px', lineHeight: 1 }}>{won(total)}<span style={{ fontSize: 16, fontWeight: 600, color: C.sub }}>원</span></div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.sub }}>고정 지출</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{won(fixed)}원</div>
                      </div>
                      <div style={{ width: 1, background: C.line }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.sub }}>변동 지출</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.bar }}>{won(variable)}원</div>
                      </div>
                    </div>
                  </div>

                  {/* 요일 헤더 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
                    {WD.map((w, i) => (
                      <div key={w} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: i === 0 ? C.red : i === 6 ? C.blue : C.sub }}>{w}</div>
                    ))}
                  </div>
                  {/* 날짜 셀 — 테두리 없이, 지출일엔 점, 선택일은 채운 원 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
                    {cells.map((d, i) => {
                      if (d === null) return <div key={`e${i}`} />
                      const amt = byDay[d] || 0
                      const has = amt > 0
                      const sel = calDay === d
                      const dotSize = has ? 4 + Math.round(4 * (amt / maxDay)) : 0
                      return (
                        <button key={d} onClick={() => setCalDay(sel ? null : d)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        }}>
                          <span style={{
                            width: 32, height: 32, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13.5, fontWeight: sel ? 800 : 500,
                            background: sel ? C.bar : 'transparent',
                            color: sel ? '#fff' : C.text,
                            transition: 'background .15s',
                          }}>{d}</span>
                          <span style={{
                            width: dotSize, height: dotSize, borderRadius: '50%',
                            background: sel ? C.bar : (has ? C.bar : 'transparent'),
                            opacity: sel ? 0 : 0.85,
                          }} />
                        </button>
                      )
                    })}
                  </div>

                  {/* 선택한 날짜 상세 */}
                  <div style={{ marginTop: 22 }}>
                    {calDay ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{calMonth}월 {calDay}일</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{won(byDay[calDay] || 0)}원</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {dayTxns.map((t, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', borderBottom: j < dayTxns.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface, fontSize: 16 }}>
                                {CAT_EMOJI[t.cat] || '💳'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{t.merchant}</div>
                                <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{t.cat}</div>
                              </div>
                              <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{won(t.amount)}원</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: C.sub, fontSize: 13, textAlign: 'center' }}>날짜를 누르면 그날 결제 내역을 볼 수 있어요</p>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ▶ 🗓️ 법인 지출 달력 (B2B) */}
            {tab === 'calendarB' && (() => {
              const won = (n) => n.toLocaleString('ko-KR')
              const txns = CAL_B2B[calMonth] || []
              const total = txns.reduce((s, t) => s + t.amount, 0)
              const byDay = {}
              txns.forEach((t) => { byDay[t.d] = (byDay[t.d] || 0) + t.amount })
              const maxDay = Math.max(1, ...Object.values(byDay))
              const days = MONTH_DAYS[calMonth]
              const firstDow = MONTH_FIRST_DOW[calMonth]
              const cells = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
              const dayTxns = calDay ? txns.filter((t) => t.d === calDay) : []
              const WD = ['일', '월', '화', '수', '목', '금', '토']
              const highCnt = txns.filter((t) => t.tone === 'red').length
              const dotColor = (tone) => tone === 'red' ? C.red : tone === 'amber' ? C.amber : C.green
              const dayTone = (d) => {
                const ts = txns.filter((t) => t.d === d)
                if (ts.some((t) => t.tone === 'red')) return 'red'
                if (ts.some((t) => t.tone === 'amber')) return 'amber'
                return 'green'
              }
              return (
                <div style={{ animation: 'fadeUp .3s ease', maxWidth: 460, margin: '0 auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginBottom: 22 }}>
                    <button onClick={() => { setCalMonth(5); setCalDay(null) }} disabled={calMonth === 5}
                      style={{ background: 'none', border: 'none', cursor: calMonth === 5 ? 'default' : 'pointer', color: calMonth === 5 ? C.line : C.sub, fontSize: 22, lineHeight: 1, padding: 4 }}>‹</button>
                    <div style={{ textAlign: 'center', minWidth: 96 }}>
                      <div style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>2026 · 법인카드</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>{calMonth}월</div>
                    </div>
                    <button onClick={() => { setCalMonth(6); setCalDay(null) }} disabled={calMonth === 6}
                      style={{ background: 'none', border: 'none', cursor: calMonth === 6 ? 'default' : 'pointer', color: calMonth === 6 ? C.line : C.sub, fontSize: 22, lineHeight: 1, padding: 4 }}>›</button>
                  </div>

                  <div style={{ background: C.side, borderRadius: 18, padding: '18px 20px', marginBottom: 22, boxShadow: 'var(--shadow-card, 0 8px 24px rgba(58,40,23,.06))' }}>
                    <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 6 }}>{calMonth}월 법인카드 지출</div>
                    <div style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-1px', lineHeight: 1 }}>{won(total)}<span style={{ fontSize: 16, fontWeight: 600, color: C.sub }}>원</span></div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.sub }}>결제 건수</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{txns.length}건</div>
                      </div>
                      <div style={{ width: 1, background: C.line }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: C.sub }}>고위험 건</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>{highCnt}건</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
                    {WD.map((w, i) => (
                      <div key={w} style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: i === 0 ? C.red : i === 6 ? C.blue : C.sub }}>{w}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
                    {cells.map((d, i) => {
                      if (d === null) return <div key={`e${i}`} />
                      const amt = byDay[d] || 0
                      const has = amt > 0
                      const sel = calDay === d
                      const dotSize = has ? 4 + Math.round(4 * (amt / maxDay)) : 0
                      return (
                        <button key={d} onClick={() => setCalDay(sel ? null : d)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        }}>
                          <span style={{
                            width: 32, height: 32, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 13.5, fontWeight: sel ? 800 : 500,
                            background: sel ? C.bar : 'transparent',
                            color: sel ? '#fff' : C.text, transition: 'background .15s',
                          }}>{d}</span>
                          <span style={{
                            width: dotSize, height: dotSize, borderRadius: '50%',
                            background: sel ? 'transparent' : (has ? dotColor(dayTone(d)) : 'transparent'),
                            opacity: 0.9,
                          }} />
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ marginTop: 22 }}>
                    {calDay ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{calMonth}월 {calDay}일</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{won(byDay[calDay] || 0)}원</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {dayTxns.map((t, j) => (
                            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 2px', borderBottom: j < dayTxns.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surface, fontSize: 16 }}>
                                {CAT_EMOJI[t.cat] || '💳'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>{t.merchant}</span>
                                  <Badge tone={t.tone} C={C}>{t.tone === 'red' ? '고위험' : t.tone === 'amber' ? '확인' : '정상'}</Badge>
                                </div>
                                <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>{t.dept} · {t.cat}</div>
                              </div>
                              <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{won(t.amount)}원</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: C.sub, fontSize: 13, textAlign: 'center' }}>날짜를 누르면 그날 법인카드 결제 내역을 볼 수 있어요 · 점 색이 위험도예요</p>
                    )}
                  </div>
                </div>
              )
            })()}

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
