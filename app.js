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
const gameRoot = document.getElementById('game-root')

let activeMinigame = null

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
  feedTreat()
})

manduImg.addEventListener('error', () => {
  manduImg.alt = '🐶 (이미지 파일을 images/ 폴더에 넣어주세요)'
})

// ───── 미니게임 진입/종료 + 선택 화면 ─────
function openMinigameMode() {
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
