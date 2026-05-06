const messagesData = require('./messages.json')
const messages = messagesData.messages

const manduImg = document.getElementById('mandu-img')
const bubble = document.getElementById('speech-bubble')
const bubbleText = document.getElementById('bubble-text')
const hint = document.getElementById('hint')
const heartsLayer = document.getElementById('hearts')

const PET_DISTANCE_THRESHOLD = 30
const BUBBLE_DURATION_MS = 3000
const DBLCLICK_WINDOW_MS = 700
const HEART_POOL = ['💛', '💖', '💕', '✨', '🐾', '💗', '🌟']

let isDragging = false
let dragDistance = 0
let dragTriggered = false
let lastX = 0
let lastY = 0
let resetTimer = null
let lastMessageId = null
let lastPetTime = 0

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

function triggerPet() {
  manduImg.src = './images/mandu_up.png'
  manduImg.classList.add('petting')
  hint.classList.add('dim')

  showBubble(getRandomMessage())

  clearTimeout(resetTimer)
  resetTimer = setTimeout(resetState, BUBBLE_DURATION_MS)
}

function resetState() {
  dragDistance = 0
  isDragging = false
  dragTriggered = false
  manduImg.src = './images/mandu_lay.png'
  manduImg.classList.remove('petting')
  manduImg.classList.remove('wobble')
  hint.classList.remove('dim')
  hideBubble()
  clearTimeout(resetTimer)
  resetTimer = null
}

manduImg.addEventListener('mousedown', (e) => {
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
  if (!isDragging) return
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
  resetState()
})

document.addEventListener('click', (e) => {
  if (!isActive()) return
  if (e.target === manduImg) return
  if (bubble.contains(e.target)) return
  resetState()
})

manduImg.addEventListener('error', () => {
  manduImg.alt = '🐶 (이미지 파일을 images/ 폴더에 넣어주세요)'
})
