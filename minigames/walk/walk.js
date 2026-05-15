// 산책 미니게임 — 도그캠 시점.
// 만두는 화면 중앙 하단 X 위치만 변하고, 도로 배경이 위→아래로 흐른다.
// 위에서 떨어지는 장애물(자전거/웅덩이/다른 강아지)은 피하고, 수집물(간식/하트)은 받는다.
// 30초 후 자동 종료, 결과(collisionCount, treats)는 onResult 콜백으로 전달.
// intro 단계에서 ✕ 종료 시 onResult 가 호출되지 않으므로 산책 카운트가 증가하지 않는다.
const { BaseMinigame } = require('../base.js')

const VIEW_W = 480
const VIEW_H = 480

const DURATION_MS = 30000

const PLAYER_W = 140
const PLAYER_H = 140
const PLAYER_Y = VIEW_H - PLAYER_H - 40
const PLAYER_FOLLOW = 0.22

const ITEM_SIZE = 58
const ITEM_HITBOX = 44
const ITEM_FONT_PX = 48
const SPAWN_INTERVAL_START = 900
const SPAWN_INTERVAL_END = 380
const FALL_SPEED_START = 1.6
const FALL_SPEED_END = 3.6

const ROAD_HEIGHT = VIEW_H
const ROAD_SCROLL_START = 1.6
const ROAD_SCROLL_END = 3.6

const OBSTACLES = ['🚲', '💧', '🐕', '🪨']
const COLLECTIBLES = ['🦴', '💛']

const DECOR_EMOJIS = ['🌱', '🌿', '🍀', '🌾', '🌼', '🪻']
const DECOR_COUNT = 18
const DECOR_SIZE_MIN = 22
const DECOR_SIZE_MAX = 36

const IMG_TOP = './images/minigames/walk/mandu_top.png'
const IMG_TOP_WALK_A = './images/minigames/walk/mandu_top_walk_a.png'
const IMG_TOP_WALK_B = './images/minigames/walk/mandu_top_walk_b.png'
const IMG_FALLBACK = './images/mandu_up.png'

const WALK_FRAME_INTERVAL_MS = 220 // 걷기 프레임 교대 주기

class WalkGame extends BaseMinigame {
  constructor() {
    super({
      id: 'walk',
      title: '산책',
      description: '리드줄 잡고 산책 가기',
    })

    this.wrap = null
    this.road = null
    this.player = null
    this.scoreEl = null
    this.timerEl = null
    this.introPanel = null

    this.rafId = null
    this.lastTime = 0
    this.elapsedMs = 0
    this.spawnAccumMs = 0
    this.walkFrameAccumMs = 0
    this.walkFrameToggle = false

    this.playerX = VIEW_W / 2
    this.targetX = VIEW_W / 2
    this.pointerActive = false

    this.items = []
    this.decors = [] // {el, x, y, size}
    this.collisionCount = 0
    this.treats = 0
    this.recentlyHitMs = 0

    this.state = 'intro' // 'intro' | 'playing' | 'gameover'

    this._hasWalkFrameA = false
    this._hasWalkFrameB = false

    this._onPointerDown = null
    this._onPointerMove = null
    this._onPointerUp = null
    this._onResult = null
  }

  /** 게임이 끝났을 때 결과를 받을 콜백 (collisionCount, treats). intro-quit 시엔 호출 안 됨. */
  onResult(cb) {
    this._onResult = cb
  }

  mount(container) {
    super.mount(container)
    container.innerHTML = ''

    const wrap = document.createElement('div')
    wrap.className = 'walk-wrap'
    wrap.style.position = 'relative'
    wrap.style.width = VIEW_W + 'px'
    wrap.style.height = VIEW_H + 'px'
    wrap.style.margin = '0 auto'
    wrap.style.background = 'linear-gradient(#D9EFB0 0%, #B8DD8C 100%)'
    wrap.style.overflow = 'hidden'
    wrap.style.userSelect = 'none'
    wrap.style.touchAction = 'none'
    wrap.style.cursor = 'grab'

    // 풀밭 — 위→아래로 흐르는 풀잎 이모지 decor 컨테이너.
    const road = document.createElement('div')
    road.className = 'walk-road'
    road.style.position = 'absolute'
    road.style.inset = '0'
    road.style.height = ROAD_HEIGHT + 'px'
    road.style.pointerEvents = 'none'
    wrap.appendChild(road)

    // HUD
    const hud = document.createElement('div')
    hud.style.position = 'absolute'
    hud.style.top = '12px'
    hud.style.left = '12px'
    hud.style.display = 'flex'
    hud.style.gap = '8px'
    hud.style.fontSize = '13px'
    hud.style.fontWeight = '600'
    hud.style.color = '#5C3D2E'

    const scoreEl = document.createElement('div')
    scoreEl.className = 'walk-score'
    scoreEl.style.padding = '6px 12px'
    scoreEl.style.background = 'rgba(255,255,255,0.85)'
    scoreEl.style.border = '2px solid #F0C8A0'
    scoreEl.style.borderRadius = '999px'
    scoreEl.textContent = '🦴 0'
    hud.appendChild(scoreEl)

    const timerEl = document.createElement('div')
    timerEl.className = 'walk-timer'
    timerEl.style.padding = '6px 12px'
    timerEl.style.background = 'rgba(255,255,255,0.85)'
    timerEl.style.border = '2px solid #F0C8A0'
    timerEl.style.borderRadius = '999px'
    timerEl.textContent = '⏱ 30'
    hud.appendChild(timerEl)

    wrap.appendChild(hud)

    // ✕ 닫기 — intro/playing 공용. 동작은 _onCloseClick.
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.textContent = '✕'
    closeBtn.style.position = 'absolute'
    closeBtn.style.top = '8px'
    closeBtn.style.right = '8px'
    closeBtn.style.width = '32px'
    closeBtn.style.height = '32px'
    closeBtn.style.border = '2px solid #F0C8A0'
    closeBtn.style.borderRadius = '50%'
    closeBtn.style.background = '#FFFFFF'
    closeBtn.style.color = '#5C3D2E'
    closeBtn.style.fontSize = '14px'
    closeBtn.style.fontWeight = '700'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.boxShadow = '0 2px 8px rgba(176,128,96,0.2)'
    closeBtn.style.zIndex = '5'
    closeBtn.addEventListener('click', () => this._onCloseClick())
    wrap.appendChild(closeBtn)

    // 만두 (탑다운 이미지 — 로드 실패 시 mandu_up.png, 그것도 실패 시 placeholder).
    const player = document.createElement('img')
    player.alt = '만두'
    player.draggable = false
    player.className = 'walk-player'
    player.style.position = 'absolute'
    player.style.width = PLAYER_W + 'px'
    player.style.height = PLAYER_H + 'px'
    player.style.left = (this.playerX - PLAYER_W / 2) + 'px'
    player.style.top = PLAYER_Y + 'px'
    player.style.pointerEvents = 'none'
    player.style.filter = 'drop-shadow(0 4px 6px rgba(120,80,60,0.35))'
    player.style.transformOrigin = '50% 60%'
    this._setupPlayerImageFallback(player)
    wrap.appendChild(player)

    // 걷기 프레임 자산 존재 여부만 사전 검사 (있으면 게임 중 교대로 src 변경).
    this._probeWalkFrames()

    // intro 패널 (시작 전)
    const intro = this._buildIntroPanel()
    wrap.appendChild(intro)

    container.appendChild(wrap)

    this.wrap = wrap
    this.road = road
    this.player = player
    this.scoreEl = scoreEl
    this.timerEl = timerEl
    this.introPanel = intro
  }

  _setupPlayerImageFallback(imgEl) {
    let attempt = 0
    const sources = [IMG_TOP, IMG_FALLBACK]
    const tryNext = () => {
      if (attempt >= sources.length) {
        // 마지막 폴백 — placeholder 색 사각
        imgEl.removeAttribute('src')
        imgEl.style.background = '#F0C8A0'
        imgEl.style.borderRadius = '16px'
        imgEl.style.border = '2px solid #5C3D2E'
        return
      }
      imgEl.src = sources[attempt++]
    }
    imgEl.onerror = tryNext
    tryNext()
  }

  _probeWalkFrames() {
    const probe = (src, flag) => {
      const im = new Image()
      im.onload = () => { this[flag] = true }
      im.onerror = () => { this[flag] = false }
      im.src = src
    }
    probe(IMG_TOP_WALK_A, '_hasWalkFrameA')
    probe(IMG_TOP_WALK_B, '_hasWalkFrameB')
  }

  _buildIntroPanel() {
    const panel = document.createElement('div')
    panel.className = 'walk-intro'
    panel.style.position = 'absolute'
    panel.style.inset = '0'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.alignItems = 'center'
    panel.style.justifyContent = 'center'
    panel.style.gap = '14px'
    panel.style.background = 'rgba(255, 240, 220, 0.92)'
    panel.style.zIndex = '4'
    panel.style.padding = '40px 24px'
    panel.style.textAlign = 'center'
    panel.style.color = '#5C3D2E'
    panel.style.fontFamily = 'inherit'

    const title = document.createElement('div')
    title.textContent = '산책 가기 🐾'
    title.style.fontSize = '22px'
    title.style.fontWeight = '700'
    title.style.letterSpacing = '0.5px'
    panel.appendChild(title)

    const rules = document.createElement('div')
    rules.style.fontSize = '13px'
    rules.style.lineHeight = '1.7'
    rules.style.maxWidth = '320px'
    rules.style.color = '#5C3D2E'
    rules.innerHTML = [
      '🖐️ 마우스를 끌어 만두를 좌우로 움직여요',
      '🚲 💧 🐕 🪨 부딪히면 더 더러워져요',
      '🦴 💛 줍는 건 자유!',
      '⏱ 30초 동안 산책해요',
    ].join('<br>')
    panel.appendChild(rules)

    const startBtn = document.createElement('button')
    startBtn.type = 'button'
    startBtn.textContent = '산책 시작'
    startBtn.style.marginTop = '8px'
    startBtn.style.padding = '10px 26px'
    startBtn.style.fontSize = '15px'
    startBtn.style.fontWeight = '700'
    startBtn.style.border = '2px solid #F0C8A0'
    startBtn.style.borderRadius = '999px'
    startBtn.style.background = '#FFB347'
    startBtn.style.color = '#FFFFFF'
    startBtn.style.cursor = 'pointer'
    startBtn.style.boxShadow = '0 4px 12px rgba(255, 165, 70, 0.45)'
    startBtn.style.fontFamily = 'inherit'
    startBtn.addEventListener('click', () => this._beginPlay())
    panel.appendChild(startBtn)

    const hint = document.createElement('div')
    hint.textContent = '✕ 누르면 안 나가도 돼요'
    hint.style.fontSize = '11px'
    hint.style.color = '#B08060'
    hint.style.marginTop = '4px'
    panel.appendChild(hint)

    return panel
  }

  start() {
    super.start()
    this._reset()
    this._attachPointer()
    this.lastTime = performance.now()
    const tick = (now) => {
      if (!this._running) return
      const dt = Math.min(48, now - this.lastTime)
      this.lastTime = now
      if (this.state === 'playing') {
        this._update(dt)
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  _reset() {
    this.elapsedMs = 0
    this.spawnAccumMs = 0
    this.walkFrameAccumMs = 0
    this.walkFrameToggle = false
    this.playerX = VIEW_W / 2
    this.targetX = VIEW_W / 2
    this.collisionCount = 0
    this.treats = 0
    this.recentlyHitMs = 0
    for (const it of this.items) it.el.remove()
    this.items = []
    for (const d of this.decors) d.el.remove()
    this.decors = []
    this._spawnInitialDecors()
    if (this.scoreEl) this.scoreEl.textContent = '🦴 0'
    if (this.timerEl) this.timerEl.textContent = '⏱ 30'
    this._renderPlayer()
  }

  _spawnInitialDecors() {
    if (!this.road) return
    for (let i = 0; i < DECOR_COUNT; i++) {
      const y = Math.random() * VIEW_H
      this._addDecor(y)
    }
  }

  _addDecor(y) {
    const emoji = DECOR_EMOJIS[Math.floor(Math.random() * DECOR_EMOJIS.length)]
    const size = DECOR_SIZE_MIN + Math.random() * (DECOR_SIZE_MAX - DECOR_SIZE_MIN)
    const x = Math.random() * (VIEW_W - size)
    const el = document.createElement('span')
    el.textContent = emoji
    el.style.position = 'absolute'
    el.style.left = x + 'px'
    el.style.top = y + 'px'
    el.style.fontSize = size + 'px'
    el.style.userSelect = 'none'
    el.style.pointerEvents = 'none'
    el.style.opacity = (0.55 + Math.random() * 0.35).toFixed(2)
    el.style.transform = 'rotate(' + ((Math.random() - 0.5) * 30).toFixed(1) + 'deg)'
    this.road.appendChild(el)
    this.decors.push({ el, x, y, size })
  }

  _beginPlay() {
    if (this.state !== 'intro') return
    if (this.introPanel) {
      this.introPanel.style.transition = 'opacity 0.25s ease'
      this.introPanel.style.opacity = '0'
      const ref = this.introPanel
      setTimeout(() => ref.remove(), 260)
      this.introPanel = null
    }
    this.state = 'playing'
    this.lastTime = performance.now()
  }

  _onCloseClick() {
    if (this.state === 'intro') {
      // 산책을 시작하지 않은 채 종료 — onResult 호출하지 않음(=카운트/더러움 미적용).
      this.state = 'gameover'
      setTimeout(() => this.exit(), 0)
      return
    }
    this._endGame('quit')
  }

  _attachPointer() {
    const rectFn = () => this.wrap.getBoundingClientRect()
    this._onPointerDown = (e) => {
      if (this.state !== 'playing') return
      this.pointerActive = true
      this.wrap.style.cursor = 'grabbing'
      const r = rectFn()
      this.targetX = Math.max(PLAYER_W / 2, Math.min(VIEW_W - PLAYER_W / 2, e.clientX - r.left))
      e.preventDefault()
    }
    this._onPointerMove = (e) => {
      if (!this.pointerActive) return
      const r = rectFn()
      this.targetX = Math.max(PLAYER_W / 2, Math.min(VIEW_W - PLAYER_W / 2, e.clientX - r.left))
    }
    this._onPointerUp = () => {
      this.pointerActive = false
      this.wrap.style.cursor = 'grab'
    }
    this.wrap.addEventListener('pointerdown', this._onPointerDown)
    window.addEventListener('pointermove', this._onPointerMove)
    window.addEventListener('pointerup', this._onPointerUp)
  }

  _detachPointer() {
    if (this._onPointerDown && this.wrap) {
      this.wrap.removeEventListener('pointerdown', this._onPointerDown)
    }
    if (this._onPointerMove) {
      window.removeEventListener('pointermove', this._onPointerMove)
    }
    if (this._onPointerUp) {
      window.removeEventListener('pointerup', this._onPointerUp)
    }
    this._onPointerDown = null
    this._onPointerMove = null
    this._onPointerUp = null
  }

  _progress() {
    return Math.min(1, this.elapsedMs / DURATION_MS)
  }

  _update(dt) {
    this.elapsedMs += dt

    if (this.elapsedMs >= DURATION_MS) {
      this._endGame('done')
      return
    }

    const remainSec = Math.max(0, Math.ceil((DURATION_MS - this.elapsedMs) / 1000))
    this.timerEl.textContent = '⏱ ' + remainSec

    this.playerX += (this.targetX - this.playerX) * PLAYER_FOLLOW
    this._renderPlayer()

    // 풀잎 decor 스크롤 — 위→아래 흐름. 화면 밖으로 나가면 위에서 재활용.
    const p = this._progress()
    const scrollSpeed = (ROAD_SCROLL_START + (ROAD_SCROLL_END - ROAD_SCROLL_START) * p) * (dt / 16.6667)
    for (const d of this.decors) {
      d.y += scrollSpeed
      if (d.y > VIEW_H + d.size) {
        d.y = -d.size - Math.random() * 40
        d.x = Math.random() * (VIEW_W - d.size)
        d.el.textContent = DECOR_EMOJIS[Math.floor(Math.random() * DECOR_EMOJIS.length)]
        d.el.style.left = d.x + 'px'
        d.el.style.transform = 'rotate(' + ((Math.random() - 0.5) * 30).toFixed(1) + 'deg)'
        d.el.style.opacity = (0.55 + Math.random() * 0.35).toFixed(2)
      }
      d.el.style.top = d.y.toFixed(1) + 'px'
    }

    // 걷기 프레임 교대
    if (this._hasWalkFrameA && this._hasWalkFrameB) {
      this.walkFrameAccumMs += dt
      if (this.walkFrameAccumMs >= WALK_FRAME_INTERVAL_MS) {
        this.walkFrameAccumMs = 0
        this.walkFrameToggle = !this.walkFrameToggle
        this.player.src = this.walkFrameToggle ? IMG_TOP_WALK_B : IMG_TOP_WALK_A
      }
    }

    if (this.recentlyHitMs > 0) {
      this.recentlyHitMs = Math.max(0, this.recentlyHitMs - dt)
    }

    this.spawnAccumMs += dt
    const spawnInterval = SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * p
    if (this.spawnAccumMs >= spawnInterval) {
      this.spawnAccumMs = 0
      this._spawnItem()
    }

    const fallSpeed = (FALL_SPEED_START + (FALL_SPEED_END - FALL_SPEED_START) * p) * (dt / 16.6667)
    for (const it of this.items) {
      if (it.hit) continue
      it.y += fallSpeed
      it.el.style.top = it.y + 'px'

      const playerLeft = this.playerX - PLAYER_W / 2 + 18
      const playerRight = this.playerX + PLAYER_W / 2 - 18
      const playerTop = PLAYER_Y + 20
      const playerBottom = PLAYER_Y + PLAYER_H - 12
      const itemLeft = it.x - ITEM_HITBOX / 2
      const itemRight = it.x + ITEM_HITBOX / 2
      const itemTop = it.y
      const itemBottom = it.y + ITEM_HITBOX

      const overlap =
        playerLeft < itemRight &&
        playerRight > itemLeft &&
        playerTop < itemBottom &&
        playerBottom > itemTop

      if (overlap) {
        it.hit = true
        if (it.kind === 'collect') {
          this.treats++
          this.scoreEl.textContent = '🦴 ' + this.treats
          this._spawnSparkle(it.x, it.y, '💛')
          it.el.remove()
        } else {
          if (this.recentlyHitMs <= 0) {
            this.collisionCount++
            this.recentlyHitMs = 300
            this._shakeWrap()
          }
          it.el.style.transition = 'transform 0.25s ease, opacity 0.25s ease'
          it.el.style.opacity = '0'
          it.el.style.transform = 'rotate(60deg) scale(0.6)'
          setTimeout(() => it.el.remove(), 260)
        }
      }
    }

    this.items = this.items.filter((it) => {
      if (it.hit) return false
      if (it.y > VIEW_H + 40) {
        it.el.remove()
        return false
      }
      return true
    })
  }

  _renderPlayer() {
    this.player.style.left = (this.playerX - PLAYER_W / 2) + 'px'
    // 좌우 기울임 + 정지 시 idle bob (CSS animation 'walkBob' 사용).
    const dx = this.targetX - this.playerX
    const tilt = Math.max(-10, Math.min(10, dx * 0.5))
    this.player.style.transform = 'rotate(' + tilt.toFixed(1) + 'deg)'
  }

  _spawnItem() {
    const isCollect = Math.random() < 0.32
    const emoji = isCollect
      ? COLLECTIBLES[Math.floor(Math.random() * COLLECTIBLES.length)]
      : OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)]
    const x = ITEM_SIZE / 2 + Math.random() * (VIEW_W - ITEM_SIZE)
    const el = document.createElement('div')
    el.className = isCollect ? 'walk-item collect' : 'walk-item obstacle'
    el.textContent = emoji
    el.style.position = 'absolute'
    el.style.left = (x - ITEM_SIZE / 2) + 'px'
    el.style.top = '-' + ITEM_SIZE + 'px'
    el.style.width = ITEM_SIZE + 'px'
    el.style.height = ITEM_SIZE + 'px'
    el.style.fontSize = ITEM_FONT_PX + 'px'
    el.style.display = 'flex'
    el.style.alignItems = 'center'
    el.style.justifyContent = 'center'
    el.style.pointerEvents = 'none'
    el.style.userSelect = 'none'
    el.style.filter = isCollect
      ? 'drop-shadow(0 2px 4px rgba(255, 180, 70, 0.55))'
      : 'drop-shadow(0 2px 4px rgba(60, 40, 20, 0.45))'
    this.wrap.appendChild(el)
    this.items.push({
      el,
      x,
      y: -ITEM_SIZE,
      kind: isCollect ? 'collect' : 'obstacle',
      emoji,
      hit: false,
    })
  }

  _spawnSparkle(x, y, emoji) {
    const s = document.createElement('span')
    s.textContent = emoji
    s.style.position = 'absolute'
    s.style.left = x + 'px'
    s.style.top = y + 'px'
    s.style.fontSize = '22px'
    s.style.pointerEvents = 'none'
    s.style.userSelect = 'none'
    s.style.transition = 'transform 0.6s ease, opacity 0.6s ease'
    s.style.opacity = '1'
    this.wrap.appendChild(s)
    requestAnimationFrame(() => {
      s.style.transform = 'translate(' + ((Math.random() - 0.5) * 60).toFixed(0) + 'px, -50px) scale(1.4)'
      s.style.opacity = '0'
    })
    setTimeout(() => s.remove(), 700)
  }

  _shakeWrap() {
    this.wrap.animate(
      [
        { transform: 'translate(0,0)' },
        { transform: 'translate(-6px, 2px)' },
        { transform: 'translate(6px, -2px)' },
        { transform: 'translate(-3px, 1px)' },
        { transform: 'translate(0,0)' },
      ],
      { duration: 220, easing: 'ease-out' }
    )
  }

  _endGame(reason) {
    if (this.state === 'gameover') return
    this.state = 'gameover'

    if (this._onResult) {
      try {
        this._onResult({ collisionCount: this.collisionCount, treats: this.treats, reason })
      } catch (err) {
        console.error('[walk] onResult error', err)
      }
    }

    setTimeout(() => this.exit(), 60)
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this._detachPointer()
    for (const it of this.items) it.el.remove()
    this.items = []
    for (const d of this.decors) d.el.remove()
    this.decors = []
    super.destroy()
  }
}

module.exports = { WalkGame }
