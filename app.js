const messagesData = require('./messages.json')
const messages = messagesData.messages
const minigameRegistry = require('./minigames/index.js')

const manduImg = document.getElementById('mandu-img')
const bubble = document.getElementById('speech-bubble')
const bubbleText = document.getElementById('bubble-text')
const hint = document.getElementById('hint')
const heartsLayer = document.getElementById('hearts')
const manduWrap = document.getElementById('mandu-wrap')
const treatBtn = document.getElementById('treat-btn')
const minigameBtn = document.getElementById('minigame-btn')
const walkBtn = document.getElementById('walk-btn')
const gameRoot = document.getElementById('game-root')

let activeMinigame = null
let washBtn = null // isDirty 일 때 동적 생성됨

const PET_DISTANCE_THRESHOLD = 30
const BUBBLE_DURATION_MS = 3000
const DBLCLICK_WINDOW_MS = 700
const HEART_POOL = ['💛', '💖', '💕', '✨', '🐾', '💗', '🌟']
const TAIL_WAG_INTERVAL_MS = 160
const TREAT_TOSS_MS = 300
const TREAT_EAT_MS = 1200
const POOP_MIN_COUNT = 3
const POOP_MAX_COUNT = 6
const TREAT_MESSAGES = [
  '냠냠!\n맛있어!',
  '와! 좋아하는 간식이다!',
  '누나. 하나 더 줘. 빨리.',
  '헤헤 행복하다...',
  '이거 진짜 멍맛있다!',
  '간식 최고야!\n또 줘!',
]

const MAX_FEEDS_BEFORE_FULL = 5
const FULL_REACTION_MS = 1500
const STOMACHACHE_MS = 1800
const POOP_VANISH_MS = 500
const FULL_MESSAGE = '배불러!\n왜 자꾸 줘!'
const STOMACHACHE_MESSAGE = '많이 먹었더니\n쫌 배아픈것같은데...'
const POOPED_MESSAGE = '누나 나 똥쌌어\n치워줘ㅠㅠ'
const POOP_CLEANED_MESSAGE = '아이 깨끗해!\n고마워 누나!'

const IMG_LAY = './images/mandu_lay.png'
const IMG_UP = './images/mandu_up.png'
const IMG_UP_WAG = './images/mandu_up_wag.png'
const IMG_EAT = './images/mandu_eat.png'

let isDragging = false
let dragDistance = 0
let dragTriggered = false
let lastX = 0
let lastY = 0
let resetTimer = null
let lastMessageId = null
let lastPetTime = 0
let tailWagTimer = null
let tailWagToggle = false
let isFeeding = false
let feedCount = 0
let isPooped = false
let annoyEl = null
let poopEls = []

// ───── 산책/케어 상태 ─────
let isDirty = false
let dirtLevel = 0 // 0~3
let mudEls = []
let isNagging = false
let isWalking = false
let isCaring = false

const WALK_NAG_MESSAGE = '누나 산책가자!\n나가야돼!'
const WALK_LOCK_TREAT = '산책부터 가자!\n간식은 그담에...'
const WALK_LOCK_PET = '으잉 산책부터!\n나갈래!'
const WALK_LOCK_GAME = '딴 게임 말고 산책!'
const WALK_ANGRY_MESSAGES = [
  '피곤한데 왜 자꾸\n나가자고 해!',
  '오늘은 그만!\n다리 아파ㅠㅠ',
  '집에서 쉬자...\n좀..',
]
const DIRTY_LOCK_TREAT = '나 더러운데\n간식 먹기 좀 그래'
const DIRTY_LOCK_PET = '씻고 나서 만져줘!\n안그럼 누나도 더러워져'
const DIRTY_LOCK_GAME = '나 더러워!\n씻겨줘ㅠㅠ'
const DIRTY_HINT_MESSAGE = '아 더러워..\n누나 씻겨줘ㅠㅠ'
const CARE_INCOMPLETE_MESSAGE = '아직 다 안 끝났어!\n더 케어해줘ㅠㅠ'
const CARE_FINISH_MESSAGES = [
  '뽀송뽀송!\n누나 최고야',
  '헤헤 깨끗해진 만두 어때?',
  '이제 진짜 강아지같지?',
  '고마워...\n사실 더러운 거 싫었어',
]

const WALK_LAST_NAG_KEY = 'mandu.walk.lastNagDate'
const WALK_COUNT_KEY_PREFIX = 'mandu.walk.count.'
const WALK_DAILY_LIMIT = 3

function getRandomMessage() {
  if (messages.length === 1) return messages[0]
  let pick
  do {
    pick = messages[Math.floor(Math.random() * messages.length)]
  } while (pick.id === lastMessageId)
  lastMessageId = pick.id
  return pick
}

function showBubble(msg) {
  bubbleText.innerHTML = msg.text.replace(/\n/g, '<br>')
  bubble.classList.add('visible')
}

function hideBubble() {
  bubble.classList.remove('visible')
  bubble.classList.remove('pop')
}

function isActive() {
  return resetTimer !== null
}

function spawnHearts(count) {
  for (let i = 0; i < count; i++) {
    const h = document.createElement('span')
    h.className = 'heart'
    h.textContent = HEART_POOL[Math.floor(Math.random() * HEART_POOL.length)]

    h.style.left = (25 + Math.random() * 50) + '%'
    h.style.top = (25 + Math.random() * 30) + '%'
    h.style.setProperty('--drift', ((Math.random() - 0.5) * 80) + 'px')
    h.style.setProperty('--rot', ((Math.random() - 0.5) * 50) + 'deg')
    h.style.animationDelay = (i * 0.06) + 's'

    heartsLayer.appendChild(h)
    setTimeout(() => h.remove(), 1700)
  }
}

function wobble() {
  manduImg.classList.remove('wobble')
  void manduImg.offsetWidth
  manduImg.classList.add('wobble')
}

function popBubble() {
  bubble.classList.remove('pop')
  void bubble.offsetWidth
  bubble.classList.add('pop')
}

function startTailWag() {
  if (tailWagTimer !== null) return
  tailWagToggle = false
  manduImg.src = IMG_UP
  tailWagTimer = setInterval(() => {
    tailWagToggle = !tailWagToggle
    manduImg.src = tailWagToggle ? IMG_UP_WAG : IMG_UP
  }, TAIL_WAG_INTERVAL_MS)
}

function stopTailWag() {
  if (tailWagTimer === null) return
  clearInterval(tailWagTimer)
  tailWagTimer = null
  tailWagToggle = false
}

function triggerPet() {
  manduImg.classList.add('petting')
  hint.classList.add('dim')
  startTailWag()

  showBubble(getRandomMessage())

  clearTimeout(resetTimer)
  resetTimer = setTimeout(resetState, BUBBLE_DURATION_MS)
}

function resetState() {
  dragDistance = 0
  isDragging = false
  dragTriggered = false
  isFeeding = false
  stopTailWag()
  manduImg.src = IMG_LAY
  manduImg.classList.remove('petting')
  manduImg.classList.remove('wobble')
  hint.classList.remove('dim')
  hideBubble()
  clearTimeout(resetTimer)
  resetTimer = null
}

function showAnnoyEmoji() {
  if (annoyEl) return
  annoyEl = document.createElement('span')
  annoyEl.className = 'annoy-emoji'
  annoyEl.textContent = '💢'
  manduWrap.appendChild(annoyEl)
}

function hideAnnoyEmoji() {
  if (!annoyEl) return
  const el = annoyEl
  annoyEl = null
  el.classList.add('fading')
  setTimeout(() => el.remove(), 300)
}

// mandu_lay.png 의 투명 영역에서 미리 샘플링한 좌표 200개 (x, y 비율 0~1).
// 이모지가 사진 밖으로 안 삐져나가게 하단 8% 마진 둠 (y 범위: 0.55 ~ 0.92).
const POOP_SPAWN_POINTS = [
  [0.2659, 0.8639], [0.7242, 0.7631], [0.0972, 0.7441], [0.8393, 0.7212], [0.381, 0.6851],
  [0.7996, 0.6051], [0.2798, 0.687], [0.7579, 0.8925], [0.252, 0.7269], [0.6806, 0.7231],
  [0.7282, 0.7174], [0.4722, 0.7688], [0.6726, 0.6984], [0.1409, 0.5956], [0.8512, 0.588],
  [0.7401, 0.8297], [0.0159, 0.6851], [0.2698, 0.6223], [0.1746, 0.7441], [0.9702, 0.8107],
  [0.2718, 0.6413], [0.1389, 0.5519], [0.8909, 0.706], [0.879, 0.6775], [0.0, 0.8145],
  [0.9206, 0.8354], [0.2917, 0.6413], [0.2877, 0.9115], [0.121, 0.7612], [0.2659, 0.7269],
  [0.9583, 0.7498], [0.2183, 0.8563], [0.4206, 0.8982], [0.369, 0.5652], [0.0496, 0.7821],
  [0.8373, 0.7783], [0.9921, 0.8658], [0.1647, 0.9134], [0.1448, 0.5576], [0.9802, 0.843],
  [0.129, 0.6375], [0.0873, 0.7231], [0.004, 0.7003], [0.4246, 0.9172], [0.8512, 0.7802],
  [0.1806, 0.8202], [0.9444, 0.7536], [0.4206, 0.6794], [0.8294, 0.5671], [0.3829, 0.5633],
  [0.25, 0.706], [0.6667, 0.7422], [0.0655, 0.7859], [0.994, 0.8069], [0.1726, 0.8677],
  [0.3433, 0.5785], [0.1032, 0.9039], [0.8651, 0.5804], [0.494, 0.8449], [0.6508, 0.8126],
  [0.1567, 0.7174], [0.4663, 0.8982], [0.9583, 0.7383], [0.4266, 0.7612], [0.3472, 0.9001],
  [0.7302, 0.7802], [0.0972, 0.6451], [0.8829, 0.7155], [0.1528, 0.6432], [0.9643, 0.8716],
  [0.2738, 0.6565], [0.9187, 0.8297], [0.2857, 0.6013], [0.0813, 0.8716], [0.0278, 0.8849],
  [0.0992, 0.8754], [0.0298, 0.8773], [0.371, 0.5823], [0.3829, 0.6508], [0.0377, 0.607],
  [0.3056, 0.9001], [0.0238, 0.8392], [0.9206, 0.6965], [0.1012, 0.6946], [0.119, 0.8677],
  [0.9504, 0.6432], [0.9563, 0.7992], [0.8829, 0.6736], [0.8452, 0.6832], [0.0, 0.8906],
  [0.6706, 0.7288], [0.7639, 0.55], [0.1746, 0.607], [0.0417, 0.8221], [0.3036, 0.7288],
  [0.2639, 0.9172], [0.2599, 0.8773], [0.8373, 0.5728], [0.8175, 0.7212], [0.0675, 0.5823],
  [0.121, 0.803], [0.1647, 0.7802], [0.8988, 0.7764], [0.8095, 0.5728], [0.0337, 0.7441],
  [0.879, 0.6794], [0.502, 0.8449], [0.1548, 0.7402], [0.9722, 0.7992], [0.2024, 0.8011],
  [0.621, 0.8754], [0.4861, 0.7916], [0.0516, 0.6775], [0.4742, 0.6375], [0.9306, 0.6984],
  [0.0, 0.6565], [0.2778, 0.7441], [0.9425, 0.9001], [0.8135, 0.6032], [0.244, 0.765],
  [0.8433, 0.7669], [0.7798, 0.9001], [0.5853, 0.8164], [0.2758, 0.7402], [0.5774, 0.7326],
  [0.4147, 0.7973], [0.3472, 0.6489], [0.6567, 0.7859], [0.4167, 0.6622], [0.7063, 0.8792],
  [0.4921, 0.7231], [0.2282, 0.8982], [0.4782, 0.7764], [0.9623, 0.6356], [0.8909, 0.8449],
  [0.4821, 0.6527], [0.8512, 0.7383], [0.502, 0.9153], [0.3313, 0.6813], [0.3274, 0.6927],
  [0.748, 0.8792], [0.4881, 0.7631], [0.7063, 0.6356], [0.2976, 0.7954], [0.8591, 0.8088],
  [0.2659, 0.6603], [0.6786, 0.6413], [0.9028, 0.8183], [0.1012, 0.6223], [0.1468, 0.7441],
  [0.2639, 0.8639], [0.8333, 0.7878], [0.0952, 0.5785], [0.9702, 0.8677], [0.0575, 0.6889],
  [0.1806, 0.8069], [0.1766, 0.6717], [0.5655, 0.9153], [0.7163, 0.7479], [0.629, 0.8049],
  [0.4167, 0.6889], [0.8472, 0.6736], [0.0218, 0.6451], [0.7937, 0.5652], [0.3948, 0.5861],
  [0.1746, 0.9096], [0.0774, 0.9077], [0.006, 0.7383], [0.8909, 0.8297], [0.9345, 0.843],
  [0.3353, 0.5823], [0.3492, 0.5671], [0.6071, 0.8525], [0.254, 0.8963], [0.7282, 0.6584],
  [0.9345, 0.7383], [0.3988, 0.7441], [0.7024, 0.8601], [0.9663, 0.6185], [0.75, 0.8849],
  [0.2917, 0.8944], [0.129, 0.5861], [0.1647, 0.8601], [0.4127, 0.9058], [0.9563, 0.7079],
  [0.2083, 0.9153], [0.0317, 0.569], [0.6825, 0.8525], [0.0933, 0.8011], [0.0694, 0.6527],
  [0.4266, 0.7631], [0.998, 0.7726], [0.0774, 0.5842], [0.0397, 0.8925], [0.0119, 0.7326],
  [0.8492, 0.7269], [0.7381, 0.8506], [0.1706, 0.9134], [0.9345, 0.5823], [0.0238, 0.7555],
]

function pickPoopPoint() {
  const btnRect = treatBtn.getBoundingClientRect()
  const wrapRect = manduWrap.getBoundingClientRect()
  const margin = 12
  const emojiMax = 50

  for (let i = 0; i < 40; i++) {
    const [x, y] = POOP_SPAWN_POINTS[Math.floor(Math.random() * POOP_SPAWN_POINTS.length)]
    const px = wrapRect.left + x * wrapRect.width
    const py = wrapRect.top + y * wrapRect.height
    const overlapsBtn =
      px + emojiMax > btnRect.left - margin &&
      px < btnRect.right + margin &&
      py + emojiMax > btnRect.top - margin &&
      py < btnRect.bottom + margin
    if (!overlapsBtn) return { left: x * 100, top: y * 100 }
  }
  const [x, y] = POOP_SPAWN_POINTS[0]
  return { left: x * 100, top: y * 100 }
}

function showPoopEmojis() {
  if (poopEls.length > 0) return
  const count = POOP_MIN_COUNT + Math.floor(Math.random() * (POOP_MAX_COUNT - POOP_MIN_COUNT + 1))
  for (let i = 0; i < count; i++) {
    const pt = pickPoopPoint()
    const el = document.createElement('span')
    el.className = 'poop-emoji'
    el.textContent = '💩'
    el.style.left = pt.left + '%'
    el.style.top = pt.top + '%'
    el.style.fontSize = (28 + Math.random() * 18) + 'px'
    el.style.animationDelay = (i * 0.07) + 's'
    el.setAttribute('role', 'button')
    el.setAttribute('aria-label', '치우기')
    el.addEventListener('click', cleanPoopOne)
    manduWrap.appendChild(el)
    poopEls.push(el)
  }
}

function cleanPoopOne(e) {
  e.stopPropagation()
  const el = e.currentTarget
  if (el.classList.contains('cleaning')) return

  el.classList.add('cleaning')
  spawnHearts(2)

  setTimeout(() => {
    el.remove()
    poopEls = poopEls.filter((p) => p !== el)
    if (poopEls.length === 0) onAllPoopsCleaned()
  }, POOP_VANISH_MS)
}

function onAllPoopsCleaned() {
  isPooped = false
  feedCount = 0
  treatBtn.disabled = false

  bubbleText.innerHTML = POOP_CLEANED_MESSAGE.replace(/\n/g, '<br>')
  bubble.classList.add('visible')
  popBubble()
  spawnHearts(3)

  clearTimeout(resetTimer)
  resetTimer = setTimeout(resetState, BUBBLE_DURATION_MS)
}

function triggerFullReaction() {
  isFeeding = true
  treatBtn.disabled = true

  stopTailWag()
  clearTimeout(resetTimer)
  resetTimer = null

  manduImg.classList.remove('wobble')
  manduImg.classList.add('petting')
  hint.classList.add('dim')
  manduImg.src = IMG_UP

  showAnnoyEmoji()
  bubbleText.innerHTML = FULL_MESSAGE.replace(/\n/g, '<br>')
  bubble.classList.add('visible')
  popBubble()
  wobble()

  setTimeout(() => {
    bubbleText.innerHTML = STOMACHACHE_MESSAGE.replace(/\n/g, '<br>')
    popBubble()

    setTimeout(() => {
      hideAnnoyEmoji()
      bubbleText.innerHTML = POOPED_MESSAGE.replace(/\n/g, '<br>')
      popBubble()
      showPoopEmojis()

      isFeeding = false
      isPooped = true
    }, STOMACHACHE_MS)
  }, FULL_REACTION_MS)
}

function feedTreat() {
  if (isFeeding || isPooped) return

  if (feedCount >= MAX_FEEDS_BEFORE_FULL) {
    triggerFullReaction()
    return
  }

  feedCount++
  isFeeding = true
  treatBtn.disabled = true

  stopTailWag()
  clearTimeout(resetTimer)
  resetTimer = null

  manduImg.classList.remove('wobble')
  manduImg.classList.add('petting')
  hint.classList.add('dim')
  manduImg.src = IMG_UP

  const treat = document.createElement('span')
  treat.className = 'treat-projectile'
  treat.textContent = '🦴'
  heartsLayer.appendChild(treat)

  setTimeout(() => {
    treat.remove()
    manduImg.src = IMG_EAT

    const text = TREAT_MESSAGES[Math.floor(Math.random() * TREAT_MESSAGES.length)]
    bubbleText.innerHTML = text.replace(/\n/g, '<br>')
    bubble.classList.add('visible')
    popBubble()
    spawnHearts(4)

    isFeeding = false
    treatBtn.disabled = false

    resetTimer = setTimeout(resetState, TREAT_EAT_MS)
  }, TREAT_TOSS_MS)
}

manduImg.addEventListener('mousedown', (e) => {
  if (isFeeding || isPooped) return
  if (isCaring || isWalking) return
  if (isNagging) {
    showTextBubble(WALK_LOCK_PET, true)
    return
  }
  if (isDirty) {
    showTextBubble(DIRTY_LOCK_PET, true)
    return
  }
  e.preventDefault()
  isDragging = true
  dragDistance = 0
  dragTriggered = false
  lastX = e.clientX
  lastY = e.clientY

  const now = Date.now()
  const isDouble = (now - lastPetTime) < DBLCLICK_WINDOW_MS
  lastPetTime = isDouble ? 0 : now

  triggerPet()

  if (isDouble) {
    wobble()
    popBubble()
    spawnHearts(6)
  } else {
    spawnHearts(2)
  }
})

window.addEventListener('mousemove', (e) => {
  if (!isDragging || isFeeding) return
  const dx = e.clientX - lastX
  const dy = e.clientY - lastY
  dragDistance += Math.hypot(dx, dy)
  lastX = e.clientX
  lastY = e.clientY

  if (dragDistance >= PET_DISTANCE_THRESHOLD && !dragTriggered) {
    dragTriggered = true
    triggerPet()
    spawnHearts(2)
  }
})

window.addEventListener('mouseup', () => {
  isDragging = false
})

manduImg.addEventListener('animationend', (e) => {
  if (e.animationName === 'manduWobble') {
    manduImg.classList.remove('wobble')
  }
})

bubble.addEventListener('animationend', (e) => {
  if (e.animationName === 'bubblePop') {
    bubble.classList.remove('pop')
  }
})

bubble.addEventListener('click', () => {
  if (isFeeding || isPooped) return
  resetState()
})

document.addEventListener('click', (e) => {
  if (!isActive()) return
  if (e.target === manduImg) return
  if (bubble.contains(e.target)) return
  if (treatBtn.contains(e.target)) return
  if (poopEls.some((p) => p.contains(e.target))) return
  if (isFeeding || isPooped) return
  resetState()
})

treatBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  if (isLockedForTreat()) return
  feedTreat()
})

if (walkBtn) {
  walkBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openWalkGame()
  })
}

manduImg.addEventListener('error', () => {
  manduImg.alt = '🐶 (이미지 파일을 images/ 폴더에 넣어주세요)'
})

// ───── 산책/케어 헬퍼 ─────
function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

function getWalkCountToday() {
  try {
    const raw = localStorage.getItem(WALK_COUNT_KEY_PREFIX + todayKey())
    return raw ? parseInt(raw, 10) || 0 : 0
  } catch (e) {
    return 0
  }
}

function setWalkCountToday(n) {
  try {
    localStorage.setItem(WALK_COUNT_KEY_PREFIX + todayKey(), String(n))
  } catch (e) {
    // localStorage 못 쓰면 무시
  }
}

function getLastNagDate() {
  try {
    return localStorage.getItem(WALK_LAST_NAG_KEY) || ''
  } catch (e) {
    return ''
  }
}

function setLastNagDate(s) {
  try {
    localStorage.setItem(WALK_LAST_NAG_KEY, s)
  } catch (e) {
    // ignore
  }
}

function showTextBubble(text, popIt, opts) {
  bubbleText.innerHTML = text.replace(/\n/g, '<br>')
  bubble.classList.add('visible')
  if (popIt) popBubble()
  const o = opts || {}
  if (o.persistent) {
    clearTimeout(resetTimer)
    resetTimer = null
    return
  }
  // 기본 — BUBBLE_DURATION_MS 후 자동 해제
  clearTimeout(resetTimer)
  resetTimer = setTimeout(resetState, BUBBLE_DURATION_MS)
}

function applyDirtFilter() {
  if (!isDirty) {
    manduImg.style.filter = ''
    return
  }
  const sepia = 0.3 + dirtLevel * 0.12 // 1→0.42, 2→0.54, 3→0.66
  const bright = 0.95 - dirtLevel * 0.04
  manduImg.style.filter =
    'sepia(' + sepia.toFixed(2) + ') brightness(' + bright.toFixed(2) + ')'
}

const MUD_EMOJIS = ['🟤', '🍂', '🌿']
const MUD_COUNT_BY_LEVEL = { 1: 3, 2: 5, 3: 7 }

function spawnMudEmojis() {
  clearMudEmojis()
  const count = MUD_COUNT_BY_LEVEL[dirtLevel] || 4
  for (let i = 0; i < count; i++) {
    const pt = pickPoopPoint()
    const el = document.createElement('span')
    el.className = 'mud-emoji'
    el.textContent = MUD_EMOJIS[Math.floor(Math.random() * MUD_EMOJIS.length)]
    el.style.left = pt.left + '%'
    el.style.top = pt.top + '%'
    el.style.fontSize = (24 + Math.random() * 14) + 'px'
    el.style.animationDelay = (i * 0.05) + 's'
    manduWrap.appendChild(el)
    mudEls.push(el)
  }
}

function clearMudEmojis() {
  for (const el of mudEls) el.remove()
  mudEls = []
}

function updateWashBtnVisibility() {
  if (isDirty && !isCaring && !document.body.classList.contains('game-mode')) {
    if (!washBtn) createWashBtn()
    washBtn.hidden = false
  } else if (washBtn) {
    washBtn.hidden = true
  }
}

function createWashBtn() {
  washBtn = document.createElement('button')
  washBtn.id = 'wash-btn'
  washBtn.type = 'button'
  washBtn.title = '씻기기'
  washBtn.setAttribute('aria-label', '씻기기')
  const icon = document.createElement('span')
  icon.className = 'treat-icon'
  icon.textContent = '🛁'
  const label = document.createElement('span')
  label.className = 'treat-label'
  label.textContent = '씻기기'
  washBtn.appendChild(icon)
  washBtn.appendChild(label)
  washBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!isDirty || isCaring) return
    openCareModal()
  })
  document.body.appendChild(washBtn)
}

function applyNagLock() {
  treatBtn.disabled = isNagging || isPooped || isDirty
}

function refreshLockUI() {
  applyNagLock()
  applyDirtFilter()
  updateWashBtnVisibility()
}

// 인터랙션 락 검사 — true 면 차단된 상태.
// 차단되는 경우 거부 메시지를 말풍선으로 띄우고 wobble 한다.
function isLockedForPet() {
  if (isCaring || isWalking) return true
  if (isNagging) {
    showTextBubble(WALK_LOCK_PET, true)
    return true
  }
  if (isDirty) {
    showTextBubble(DIRTY_LOCK_PET, true)
    return true
  }
  return false
}

function isLockedForTreat() {
  if (isCaring || isWalking) return true
  if (isNagging) {
    showTextBubble(WALK_LOCK_TREAT, true)
    return true
  }
  if (isDirty) {
    showTextBubble(DIRTY_LOCK_TREAT, true)
    return true
  }
  return false
}

function isLockedForOtherGame() {
  if (isCaring || isWalking) return true
  if (isNagging) {
    showTextBubble(WALK_LOCK_GAME, true)
    return true
  }
  if (isDirty) {
    showTextBubble(DIRTY_LOCK_GAME, true)
    return true
  }
  return false
}

// 하루 1회 강제 조르기 트리거.
function maybeStartNagging() {
  const today = todayKey()
  if (getLastNagDate() === today) return
  if (isPooped) return // 똥 처리 중엔 굳이 끼어들지 않음
  isNagging = true
  applyNagLock()
  // 살짝 늦게 띄워 첫 로드 깜빡임 방지
  setTimeout(() => {
    if (!isNagging) return
    manduImg.src = IMG_UP
    showTextBubble(WALK_NAG_MESSAGE, true, { persistent: true })
    spawnHearts(2)
  }, 400)
}

function endNagging() {
  if (!isNagging) return
  isNagging = false
  setLastNagDate(todayKey())
  applyNagLock()
}

// 산책 결과 → 더러움 매핑.
function applyWalkResult(result) {
  const c = (result && result.collisionCount) || 0
  if (c <= 1) dirtLevel = 1
  else if (c <= 4) dirtLevel = 2
  else dirtLevel = 3
  isDirty = true
  applyDirtFilter()
  spawnMudEmojis()
  manduImg.src = IMG_LAY
  showTextBubble(DIRTY_HINT_MESSAGE, true)
  updateWashBtnVisibility()
}

// 산책 게임 직접 진입 (선택 화면 거치지 않음).
function openWalkGame() {
  if (isWalking) return
  // 조르기 중이 아닐 때만 횟수 제한 체크 — 조르기 1회차는 강제로 통과.
  if (!isNagging && getWalkCountToday() >= WALK_DAILY_LIMIT) {
    const msg = WALK_ANGRY_MESSAGES[Math.floor(Math.random() * WALK_ANGRY_MESSAGES.length)]
    manduImg.src = IMG_UP
    showTextBubble(msg, true)
    showAnnoyEmoji()
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      hideAnnoyEmoji()
      resetState()
    }, 1800)
    return
  }
  if (isCaring) return
  if (isDirty) {
    showTextBubble(DIRTY_LOCK_GAME, true)
    return
  }
  if (isPooped) return

  isWalking = true
  resetState()
  document.body.classList.add('game-mode')
  gameRoot.hidden = false
  launchWalkMinigame()
}

function launchWalkMinigame() {
  const game = minigameRegistry.get('walk')
  if (!game) {
    console.warn('[walk] minigame not registered')
    finishWalk(null)
    return
  }
  gameRoot.innerHTML = ''
  activeMinigame = game
  let resultPayload = null
  if (typeof game.onResult === 'function') {
    game.onResult((r) => {
      resultPayload = r
    })
  }
  game.onExit(() => {
    finishWalk(resultPayload)
  })
  game.mount(gameRoot)
  game.start()
}

function finishWalk(result) {
  if (activeMinigame) {
    try {
      activeMinigame.destroy()
    } catch (err) {
      console.error('[walk] destroy error:', err)
    }
    activeMinigame = null
  }
  gameRoot.innerHTML = ''
  gameRoot.hidden = true
  document.body.classList.remove('game-mode')
  isWalking = false

  // intro-quit (산책 시작 안 함) — 카운트/더러움/조르기 모두 그대로 둠.
  if (!result) {
    refreshLockUI()
    return
  }

  setWalkCountToday(getWalkCountToday() + 1)
  endNagging()
  applyWalkResult(result)
  refreshLockUI()
}

// ───── 케어 모달 (씻기 → 말리기 → 빗질) ─────
let careModal = null
let careState = null

function openCareModal() {
  if (isCaring) return
  if (!isDirty) return
  isCaring = true
  refreshLockUI()
  resetState()

  careState = {
    step: 'wash', // 'wash' | 'towel' | 'dry' | 'brush' | 'done'
    washProgress: 0,
    towelProgress: 0,
    dryHoldMs: 0,
    brushProgress: 0,
    mudList: [],
    drops: [],
    toolEl: null,
    toolGrabbed: false,
    toolOffsetX: 0,
    toolOffsetY: 0,
    isPointerDown: false,
    lastX: 0,
    lastY: 0,
  }

  buildCareModal()
  enterStep('wash')
}

function buildCareModal() {
  const modal = document.createElement('div')
  modal.id = 'care-modal'
  modal.style.position = 'fixed'
  modal.style.inset = '0'
  modal.style.background = '#FFF4E0'
  modal.style.zIndex = '120'
  modal.style.display = 'flex'
  modal.style.flexDirection = 'column'
  modal.style.alignItems = 'center'
  modal.style.justifyContent = 'flex-start'
  modal.style.padding = '40px 20px 20px'
  modal.style.userSelect = 'none'
  modal.style.touchAction = 'none'

  // 헤더
  const header = document.createElement('div')
  header.style.display = 'flex'
  header.style.alignItems = 'center'
  header.style.justifyContent = 'center'
  header.style.gap = '12px'
  header.style.marginBottom = '8px'
  header.style.fontFamily = "'Mona10', 'Apple SD Gothic Neo', sans-serif"
  header.style.color = 'var(--text-sub)'
  header.style.fontSize = '14px'
  header.style.letterSpacing = '1px'
  const title = document.createElement('div')
  title.id = 'care-title'
  title.textContent = '만두 씻기기'
  header.appendChild(title)

  const close = document.createElement('button')
  close.type = 'button'
  close.textContent = '✕'
  close.style.position = 'absolute'
  close.style.top = '12px'
  close.style.right = '12px'
  close.style.width = '32px'
  close.style.height = '32px'
  close.style.border = '2px solid var(--bubble-border)'
  close.style.borderRadius = '50%'
  close.style.background = '#FFFFFF'
  close.style.color = 'var(--text-main)'
  close.style.fontSize = '14px'
  close.style.fontWeight = '700'
  close.style.cursor = 'pointer'
  close.style.boxShadow = '0 2px 6px rgba(176,128,96,0.2)'
  close.addEventListener('click', () => requestCareClose())
  modal.appendChild(header)
  modal.appendChild(close)

  // 안내문
  const guide = document.createElement('div')
  guide.id = 'care-guide'
  guide.style.fontSize = '13px'
  guide.style.color = 'var(--text-main)'
  guide.style.marginBottom = '8px'
  guide.style.textAlign = 'center'
  guide.style.height = '20px'
  modal.appendChild(guide)

  // 진행 바
  const barWrap = document.createElement('div')
  barWrap.style.width = '240px'
  barWrap.style.height = '10px'
  barWrap.style.background = '#FFF4E0'
  barWrap.style.border = '2px solid var(--bubble-border)'
  barWrap.style.borderRadius = '999px'
  barWrap.style.overflow = 'hidden'
  barWrap.style.marginBottom = '12px'
  const bar = document.createElement('div')
  bar.id = 'care-bar'
  bar.style.height = '100%'
  bar.style.width = '0%'
  bar.style.background = 'linear-gradient(90deg, #FFC270, #FFB347)'
  bar.style.transition = 'width 0.15s ease'
  barWrap.appendChild(bar)
  modal.appendChild(barWrap)

  // 만두 영역 (이미지 + 오버레이)
  const stage = document.createElement('div')
  stage.id = 'care-stage'
  stage.style.position = 'relative'
  stage.style.width = '320px'
  stage.style.height = '320px'
  stage.style.touchAction = 'none'
  stage.style.cursor = 'grab'

  const img = document.createElement('img')
  img.id = 'care-mandu'
  img.src = IMG_LAY
  img.alt = '만두'
  img.draggable = false
  img.style.width = '100%'
  img.style.height = '100%'
  img.style.objectFit = 'contain'
  img.style.pointerEvents = 'none'
  img.style.transition = 'filter 0.2s ease, transform 0.2s ease'
  stage.appendChild(img)

  const overlay = document.createElement('div')
  overlay.id = 'care-overlay'
  overlay.style.position = 'absolute'
  overlay.style.inset = '0'
  overlay.style.pointerEvents = 'none'
  stage.appendChild(overlay)

  modal.appendChild(stage)

  // 안내 말풍선 (모달 하단)
  const note = document.createElement('div')
  note.id = 'care-note'
  note.style.marginTop = '14px'
  note.style.minHeight = '18px'
  note.style.fontSize = '13px'
  note.style.color = 'var(--text-sub)'
  note.style.textAlign = 'center'
  modal.appendChild(note)

  document.body.appendChild(modal)
  careModal = modal

  // 포인터 핸들러 — 씻기는 만두 위 직접 드래그, 그 외 단계는 도구 이모지 드래그.
  const onPointerDown = (e) => {
    careState.isPointerDown = true
    careState.lastX = e.clientX
    careState.lastY = e.clientY

    // 도구 단계 — 포인터가 toolEl 위에서 시작했을 때만 잡힘.
    if (careState.toolEl) {
      const r = careState.toolEl.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        careState.toolGrabbed = true
        careState.toolOffsetX = e.clientX - (r.left + r.width / 2)
        careState.toolOffsetY = e.clientY - (r.top + r.height / 2)
      }
    }
    stage.style.cursor = 'grabbing'
    e.preventDefault()
  }
  const onPointerMove = (e) => {
    if (!careState.isPointerDown) return
    const dx = e.clientX - careState.lastX
    const dy = e.clientY - careState.lastY
    careState.lastX = e.clientX
    careState.lastY = e.clientY

    if (careState.step === 'wash') {
      onWashMove(dx, dy, e, stage)
      return
    }
    if (!careState.toolGrabbed) return
    moveToolTo(e.clientX - careState.toolOffsetX, e.clientY - careState.toolOffsetY, stage)
    if (careState.step === 'towel') onTowelMove(dx, dy)
    else if (careState.step === 'brush') onBrushMove(dx, dy)
    // 'dry' 단계는 hold 시간이라 별도 처리 없음 (rAF 루프에서 처리)
  }
  const onPointerUp = () => {
    if (!careState.isPointerDown) return
    careState.isPointerDown = false
    careState.toolGrabbed = false
    stage.style.cursor = 'grab'
  }
  stage.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  // teardown 핸들에 보관
  careState._teardown = () => {
    stage.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }
}

function setCareGuide(text) {
  const g = document.getElementById('care-guide')
  if (g) g.textContent = text
}

function setCareNote(text) {
  const n = document.getElementById('care-note')
  if (n) n.textContent = text || ''
}

function setCareBar(ratio) {
  const b = document.getElementById('care-bar')
  if (b) b.style.width = Math.max(0, Math.min(1, ratio)) * 100 + '%'
}

function setCareTitle(text) {
  const t = document.getElementById('care-title')
  if (t) t.textContent = text
}

function enterStep(step) {
  careState.step = step
  removeCareTool()
  if (step === 'wash') {
    setCareTitle('만두 씻기기')
    setCareGuide('만두 위를 문질러서 거품 내주세요')
    setCareBar(0)
    setCareNote('진흙을 다 씻겨주세요')
    cloneMudIntoCareStage()
  } else if (step === 'towel') {
    setCareTitle('만두 수건 닦기')
    setCareGuide('수건으로 톡톡 닦아주세요')
    setCareBar(0)
    setCareNote('🧻 잡고 만두 위에서 비비기')
    spawnWaterDropsInCareStage()
    spawnCareTool('🧻', 100, './images/care/towel.png')
  } else if (step === 'dry') {
    setCareTitle('만두 말리기')
    setCareGuide('드라이기로 따끈하게 말려주세요')
    setCareBar(0)
    setCareNote('💨 잡아서 만두 위에 가만히 대고 있기')
    // dry 단계는 vapor 만 띄움. 이전 단계 물방울은 이미 사라졌어야 하지만 안전망으로 overlay 비움.
    const overlay = document.getElementById('care-overlay')
    if (overlay) overlay.innerHTML = ''
    careState.drops = []
    spawnCareTool('💨', 100, './images/care/dryer.png')
    startDryHoldLoop()
  } else if (step === 'brush') {
    setCareTitle('만두 빗질하기')
    setCareGuide('위에서 아래로 빗어주세요 ✨')
    setCareBar(0)
    setCareNote('🪮 잡고 위→아래 방향으로')
    const overlay = document.getElementById('care-overlay')
    if (overlay) overlay.innerHTML = ''
    careState.drops = []
    spawnCareTool('🪮', 100, './images/care/comb.png')
  }
}

// 도구 spawn — 이미지가 있으면 <img>, 없으면 이모지 <span>. 초기 위치: stage 우상단.
function spawnCareTool(emoji, sizePx, imgSrc) {
  const stage = document.getElementById('care-stage')
  if (!stage) return
  const initLeft = stage.clientWidth - sizePx - 12 + 'px'
  const initTop = '8px'

  if (imgSrc) {
    const probe = new Image()
    probe.onload = () => {
      // 로드 성공 — 이모지를 이미지로 교체.
      if (!careState || !careState.toolEl) return
      const oldEl = careState.toolEl
      const imgEl = makeCareToolElement(sizePx, initLeft, initTop)
      imgEl.style.backgroundImage = 'url("' + imgSrc + '")'
      imgEl.style.backgroundSize = 'contain'
      imgEl.style.backgroundRepeat = 'no-repeat'
      imgEl.style.backgroundPosition = 'center'
      imgEl.textContent = ''
      // 기존 위치 유지(아직 안 잡았으면 초기 위치)
      imgEl.style.left = oldEl.style.left
      imgEl.style.top = oldEl.style.top
      oldEl.replaceWith(imgEl)
      careState.toolEl = imgEl
    }
    probe.src = imgSrc
  }

  // 즉시 이모지 폴백으로 spawn (probe 가 늦거나 실패하면 그대로 사용).
  const el = makeCareToolElement(sizePx, initLeft, initTop)
  el.textContent = emoji
  el.style.fontSize = (sizePx - 12) + 'px'
  stage.appendChild(el)
  careState.toolEl = el
}

function makeCareToolElement(sizePx, left, top) {
  const el = document.createElement('span')
  el.className = 'care-tool'
  el.style.position = 'absolute'
  el.style.width = sizePx + 'px'
  el.style.height = sizePx + 'px'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.userSelect = 'none'
  el.style.left = left
  el.style.top = top
  el.style.pointerEvents = 'auto'
  el.style.cursor = 'grab'
  el.style.filter = 'drop-shadow(0 3px 5px rgba(80, 60, 40, 0.35))'
  el.style.zIndex = '3'
  return el
}

function removeCareTool() {
  if (careState && careState.toolEl) {
    careState.toolEl.remove()
    careState.toolEl = null
    careState.toolGrabbed = false
  }
}

function moveToolTo(centerClientX, centerClientY, stage) {
  if (!careState.toolEl) return
  const rect = stage.getBoundingClientRect()
  const localX = centerClientX - rect.left
  const localY = centerClientY - rect.top
  const w = careState.toolEl.offsetWidth
  const h = careState.toolEl.offsetHeight
  careState.toolEl.style.left = (localX - w / 2) + 'px'
  careState.toolEl.style.top = (localY - h / 2) + 'px'
}

// 도구가 현재 만두(care-mandu) 영역 위에 겹쳐있는지 검사.
function isToolOverMandu() {
  if (!careState || !careState.toolEl) return false
  const t = careState.toolEl.getBoundingClientRect()
  const img = document.getElementById('care-mandu')
  if (!img) return false
  const m = img.getBoundingClientRect()
  // 만두 박스 안쪽 70% 영역만 카운트 (테두리 노이즈 제거)
  const padX = m.width * 0.15
  const padY = m.height * 0.15
  const tx = t.left + t.width / 2
  const ty = t.top + t.height / 2
  return tx >= m.left + padX && tx <= m.right - padX && ty >= m.top + padY && ty <= m.bottom - padY
}

function cloneMudIntoCareStage() {
  const overlay = document.getElementById('care-overlay')
  if (!overlay) return
  overlay.innerHTML = ''
  careState.mudList = []
  const total = mudEls.length || (MUD_COUNT_BY_LEVEL[dirtLevel] || 4)
  const positions = mudEls.length > 0
    ? mudEls.map((el) => ({
        left: parseFloat(el.style.left),
        top: parseFloat(el.style.top),
        emoji: el.textContent,
      }))
    : Array.from({ length: total }, () => {
        const pt = pickPoopPoint()
        return {
          left: pt.left,
          top: pt.top,
          emoji: MUD_EMOJIS[Math.floor(Math.random() * MUD_EMOJIS.length)],
        }
      })
  for (const p of positions) {
    const el = document.createElement('span')
    // 케어 모달용은 entry mudPlop 애니메이션 없이 static 으로(깜빡거림 방지).
    el.className = 'mud-care'
    el.textContent = p.emoji
    el.style.position = 'absolute'
    el.style.left = p.left + '%'
    el.style.top = p.top + '%'
    el.style.fontSize = '30px'
    el.style.userSelect = 'none'
    el.style.pointerEvents = 'none'
    el.style.filter = 'drop-shadow(0 2px 3px rgba(80, 55, 30, 0.4))'
    overlay.appendChild(el)
    careState.mudList.push(el)
  }
}

function spawnWaterDropsInCareStage() {
  const overlay = document.getElementById('care-overlay')
  if (!overlay) return
  overlay.innerHTML = ''
  careState.drops = []
  const count = 8
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.className = 'water-drop'
    el.textContent = '💧'
    el.style.position = 'absolute'
    el.style.left = (10 + Math.random() * 80) + '%'
    el.style.top = (15 + Math.random() * 60) + '%'
    el.style.fontSize = (22 + Math.random() * 8) + 'px'
    el.style.transition = 'transform 0.4s ease, opacity 0.4s ease'
    overlay.appendChild(el)
    careState.drops.push(el)
  }
}

const WASH_REQUIRED_PX = 1600 // 누적 드래그 거리

function onWashMove(dx, dy, e, stage) {
  const dist = Math.hypot(dx, dy)
  careState.washProgress += dist
  if (Math.random() < 0.5) {
    spawnBubbleAt(e, stage)
  }
  const ratio = careState.washProgress / WASH_REQUIRED_PX
  setCareBar(ratio)

  // 진흙 비례 제거 — 남아있는 진흙 중 마지막 것부터 fadeOut 처리.
  const remaining = careState.mudList.filter((el) => !el.dataset.removed)
  const totalInit = careState.mudList.length
  const targetRemaining = Math.max(0, Math.round(totalInit - totalInit * ratio))
  while (remaining.length > targetRemaining) {
    const el = remaining.pop()
    if (!el) break
    el.dataset.removed = '1'
    el.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
    el.style.opacity = '0'
    el.style.transform = 'scale(0.4) rotate(40deg)'
    setTimeout(() => el.remove(), 320)
  }

  // sepia filter 비례 감소
  const img = document.getElementById('care-mandu')
  if (img) {
    const sepia = (0.3 + dirtLevel * 0.12) * Math.max(0, 1 - ratio)
    const bright = 1 - 0.04 * dirtLevel * Math.max(0, 1 - ratio)
    img.style.filter = 'sepia(' + sepia.toFixed(2) + ') brightness(' + bright.toFixed(2) + ')'
  }

  if (ratio >= 1) {
    setCareBar(1)
    for (const el of careState.mudList) {
      if (!el.dataset.removed) {
        el.dataset.removed = '1'
        el.style.opacity = '0'
        setTimeout(() => el.remove(), 200)
      }
    }
    careState.mudList = []
    setTimeout(() => enterStep('towel'), 350)
  }
}

const TOWEL_REQUIRED_PX = 1200
const TOWEL_INIT_DROP_COUNT = 8

function onTowelMove(dx, dy) {
  if (!isToolOverMandu()) return
  careState.towelProgress += Math.hypot(dx, dy)
  const ratio = Math.min(careState.towelProgress / TOWEL_REQUIRED_PX, 1)
  setCareBar(ratio)
  // 진행 비율에 맞춰 물방울 개수를 목표값으로 수렴(완료 시 0).
  const targetRemaining = Math.max(0, Math.round(TOWEL_INIT_DROP_COUNT * (1 - ratio)))
  while (careState.drops.length > targetRemaining) {
    const el = careState.drops.shift()
    if (!el || !el.isConnected) continue
    el.style.transform =
      'translate(' + ((Math.random() - 0.5) * 60).toFixed(0) + 'px, ' + ((Math.random() - 0.5) * 40).toFixed(0) + 'px) scale(0.4)'
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 380)
  }
  if (ratio >= 1) {
    setTimeout(() => enterStep('dry'), 350)
  }
}

const DRY_HOLD_REQUIRED_MS = 3000
const VAPOR_EMOJIS = ['💨', '〰️', '~']
let dryHoldRafId = null
let dryHoldLastTime = 0
let vaporSpawnAccumMs = 0

function startDryHoldLoop() {
  cancelDryHoldLoop()
  dryHoldLastTime = performance.now()
  vaporSpawnAccumMs = 0
  const tick = (now) => {
    if (!careState || careState.step !== 'dry') {
      dryHoldRafId = null
      return
    }
    const dt = Math.min(48, now - dryHoldLastTime)
    dryHoldLastTime = now
    if (careState.toolGrabbed && isToolOverMandu()) {
      careState.dryHoldMs += dt
      const ratio = careState.dryHoldMs / DRY_HOLD_REQUIRED_MS
      setCareBar(ratio)
      // 만두에서 수증기 파티클이 위로 떠오르는 시각 효과(약 110ms 간격).
      vaporSpawnAccumMs += dt
      if (vaporSpawnAccumMs >= 110) {
        vaporSpawnAccumMs = 0
        spawnVaporOnMandu()
      }
      if (ratio >= 1) {
        setTimeout(() => enterStep('brush'), 350)
        return
      }
    }
    dryHoldRafId = requestAnimationFrame(tick)
  }
  dryHoldRafId = requestAnimationFrame(tick)
}

function spawnVaporOnMandu() {
  const stage = document.getElementById('care-stage')
  const img = document.getElementById('care-mandu')
  if (!stage || !img) return
  const sRect = stage.getBoundingClientRect()
  const mRect = img.getBoundingClientRect()
  const cx = mRect.left + mRect.width / 2 - sRect.left + (Math.random() - 0.5) * mRect.width * 0.5
  const cy = mRect.top + mRect.height * 0.4 - sRect.top
  const el = document.createElement('span')
  el.textContent = VAPOR_EMOJIS[Math.floor(Math.random() * VAPOR_EMOJIS.length)]
  el.style.position = 'absolute'
  el.style.left = cx + 'px'
  el.style.top = cy + 'px'
  el.style.fontSize = (22 + Math.random() * 12) + 'px'
  el.style.pointerEvents = 'none'
  el.style.userSelect = 'none'
  el.style.opacity = '0.85'
  el.style.transition = 'transform 1s ease-out, opacity 1s ease-out'
  el.style.filter = 'drop-shadow(0 2px 3px rgba(160, 200, 230, 0.45))'
  stage.appendChild(el)
  requestAnimationFrame(() => {
    el.style.transform =
      'translate(' + ((Math.random() - 0.5) * 60).toFixed(0) + 'px, ' + (-90 - Math.random() * 30).toFixed(0) + 'px) scale(1.4)'
    el.style.opacity = '0'
  })
  setTimeout(() => el.remove(), 1100)
}

function cancelDryHoldLoop() {
  if (dryHoldRafId !== null) {
    cancelAnimationFrame(dryHoldRafId)
    dryHoldRafId = null
  }
}

const BRUSH_REQUIRED_PX = 800

function onBrushMove(dx, dy) {
  if (!isToolOverMandu()) return
  // 위→아래 방향(양의 dy)만 누적
  if (dy <= 0) return
  careState.brushProgress += dy
  const ratio = careState.brushProgress / BRUSH_REQUIRED_PX
  setCareBar(ratio)
  // 무작위로 ✨/🐾 spawn
  if (Math.random() < 0.35) {
    const stage = document.getElementById('care-stage')
    if (stage && careState.toolEl) {
      const r = careState.toolEl.getBoundingClientRect()
      const sr = stage.getBoundingClientRect()
      const x = r.left + r.width / 2 - sr.left
      const y = r.top + r.height / 2 - sr.top
      const pool = ['✨', '🐾']
      const el = document.createElement('span')
      el.textContent = pool[Math.floor(Math.random() * pool.length)]
      el.style.position = 'absolute'
      el.style.left = (x + (Math.random() - 0.5) * 20) + 'px'
      el.style.top = (y + (Math.random() - 0.5) * 20) + 'px'
      el.style.fontSize = '22px'
      el.style.pointerEvents = 'none'
      el.style.transition = 'transform 0.6s ease-out, opacity 0.6s ease-out'
      stage.appendChild(el)
      requestAnimationFrame(() => {
        el.style.transform = 'translate(' + ((Math.random() - 0.5) * 40).toFixed(0) + 'px, -40px) scale(1.3)'
        el.style.opacity = '0'
      })
      setTimeout(() => el.remove(), 650)
    }
  }
  if (ratio >= 1) {
    setTimeout(finishCare, 350)
  }
}

function spawnBubbleAt(e, stage) {
  const rect = stage.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const el = document.createElement('span')
  el.className = 'bubble-particle'
  el.textContent = '🫧'
  el.style.position = 'absolute'
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  el.style.fontSize = (16 + Math.random() * 10) + 'px'
  el.style.pointerEvents = 'none'
  el.style.transition = 'transform 0.9s ease-out, opacity 0.9s ease-out'
  stage.appendChild(el)
  requestAnimationFrame(() => {
    el.style.transform =
      'translate(' + ((Math.random() - 0.5) * 40).toFixed(0) + 'px, -' + (40 + Math.random() * 40).toFixed(0) + 'px) scale(1.3)'
    el.style.opacity = '0'
  })
  setTimeout(() => el.remove(), 950)
}

function requestCareClose() {
  if (careState && careState.step !== 'done' && isDirty) {
    setCareNote(CARE_INCOMPLETE_MESSAGE.replace('\n', ' '))
    // 거부 효과 — 모달 흔들기
    if (careModal) {
      careModal.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: 'translate(-8px, 0)' },
          { transform: 'translate(8px, 0)' },
          { transform: 'translate(0,0)' },
        ],
        { duration: 250, easing: 'ease-out' }
      )
    }
    return
  }
  closeCareModal(false)
}

function finishCare() {
  careState.step = 'done'
  closeCareModal(true)
}

function closeCareModal(success) {
  cancelDryHoldLoop()
  if (careModal) {
    if (careState && careState._teardown) careState._teardown()
    removeCareTool()
    careModal.remove()
    careModal = null
  }
  careState = null

  if (success) {
    isDirty = false
    dirtLevel = 0
    clearMudEmojis()
    applyDirtFilter()
    isCaring = false
    refreshLockUI()
    manduImg.src = IMG_UP
    const msg = CARE_FINISH_MESSAGES[Math.floor(Math.random() * CARE_FINISH_MESSAGES.length)]
    showTextBubble(msg, true)
    spawnHearts(6)
    clearTimeout(resetTimer)
    resetTimer = setTimeout(resetState, BUBBLE_DURATION_MS)
  } else {
    isCaring = false
    refreshLockUI()
  }
}

// ───── 미니게임 진입/종료 + 선택 화면 ─────
function openMinigameMode() {
  if (isLockedForOtherGame()) return
  // 만두 인터랙션 상태 리셋 (똥이 있으면 가려질 뿐 상태 유지 — 종료 시 복귀)
  resetState()
  document.body.classList.add('game-mode')
  gameRoot.hidden = false
  showGameSelector()
}

function exitMinigameMode() {
  if (activeMinigame) {
    try {
      activeMinigame.destroy()
    } catch (err) {
      console.error('[minigame] destroy error:', err)
    }
    activeMinigame = null
  }
  gameRoot.innerHTML = ''
  gameRoot.hidden = true
  document.body.classList.remove('game-mode')
  resetState()
}

function showGameSelector() {
  if (activeMinigame) {
    try {
      activeMinigame.destroy()
    } catch (err) {
      console.error('[minigame] destroy error:', err)
    }
    activeMinigame = null
  }

  gameRoot.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'mg-picker'

  const header = document.createElement('div')
  header.className = 'mg-picker-header'

  const title = document.createElement('div')
  title.className = 'mg-picker-title'
  title.textContent = '만두와 게임해요'
  header.appendChild(title)

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'mg-picker-close'
  close.textContent = '✕'
  close.setAttribute('aria-label', '닫기')
  close.addEventListener('click', exitMinigameMode)
  header.appendChild(close)

  wrap.appendChild(header)

  const listEl = document.createElement('div')
  listEl.className = 'mg-picker-list'

  const games = minigameRegistry.list()
  if (games.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'mg-picker-empty'
    empty.textContent = '등록된 게임이 없어요.'
    listEl.appendChild(empty)
  } else {
    for (const meta of games) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'mg-picker-card'
      card.addEventListener('click', () => launchMinigame(meta.id))

      const icon = document.createElement('div')
      icon.className = 'mg-picker-card-icon'
      icon.textContent = meta.icon
      card.appendChild(icon)

      const info = document.createElement('div')
      info.className = 'mg-picker-card-info'

      const cTitle = document.createElement('div')
      cTitle.className = 'mg-picker-card-title'
      cTitle.textContent = meta.title
      info.appendChild(cTitle)

      if (meta.description) {
        const cDesc = document.createElement('div')
        cDesc.className = 'mg-picker-card-desc'
        cDesc.textContent = meta.description
        info.appendChild(cDesc)
      }

      card.appendChild(info)
      listEl.appendChild(card)
    }
  }

  wrap.appendChild(listEl)
  gameRoot.appendChild(wrap)
}

function launchMinigame(id) {
  const game = minigameRegistry.get(id)
  if (!game) {
    console.warn('[minigame] unknown id:', id)
    return
  }

  gameRoot.innerHTML = ''
  activeMinigame = game
  // 게임 안에서 닫기 → 선택 화면으로 복귀(메인이 아니라)
  game.onExit(() => showGameSelector())
  game.mount(gameRoot)
  game.start()
}

minigameBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  openMinigameMode()
})

// 시작 시 — 하루 1회 강제 조르기 트리거
maybeStartNagging()
