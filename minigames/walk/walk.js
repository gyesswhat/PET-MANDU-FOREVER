// 산책 미니게임 — 리드줄 드래그.
// 만두를 화면 하단에 두고 좌우 pointer 드래그로 조작.
// 위에서 떨어지는 장애물(자전거/웅덩이/다른 강아지)은 피하고, 수집물(간식/하트)은 받는다.
// 30초 후 자동 종료, 결과(collisionCount, treats)는 onResult 콜백으로 전달.
const { BaseMinigame } = require('../base.js')

const VIEW_W = 480
const VIEW_H = 480

const DURATION_MS = 30000

// 만두(플레이어)
const PLAYER_W = 72
const PLAYER_H = 72
const PLAYER_Y = VIEW_H - PLAYER_H - 28
const PLAYER_FOLLOW = 0.22 // pointer 위치로 lerp 보간 계수

// 떨어지는 아이템
const ITEM_SIZE = 40
const ITEM_HITBOX = 30
const SPAWN_INTERVAL_START = 900 // ms
const SPAWN_INTERVAL_END = 380 // 후반 가속
const FALL_SPEED_START = 1.6 // px/frame @60fps
const FALL_SPEED_END = 3.6

const OBSTACLES = ['🚲', '💧', '🐕', '🪨']
const COLLECTIBLES = ['🦴', '💛']

class WalkGame extends BaseMinigame {
  constructor() {
    super({
      id: 'walk',
      title: '산책',
      description: '리드줄 잡고 산책 가기',
    })

    this.wrap = null
    this.ground = null
    this.player = null
    this.scoreEl = null
    this.timerEl = null
    this.endPanel = null

    this.rafId = null
    this.lastTime = 0
    this.elapsedMs = 0
    this.spawnAccumMs = 0

    this.playerX = VIEW_W / 2
    this.targetX = VIEW_W / 2
    this.pointerActive = false

    this.items = [] // {el, x, y, vy, kind ('obstacle'|'collect'), emoji, hit:false}
    this.collisionCount = 0
    this.treats = 0
    this.recentlyHitMs = 0 // 짧은 무적 시간으로 1회 통과 중복 충돌 방지

    this.state = 'ready' // 'ready' | 'playing' | 'gameover'

    this._onPointerDown = null
    this._onPointerMove = null
    this._onPointerUp = null
    this._onResult = null
  }

  /** 게임이 끝났을 때 결과를 받을 콜백 (collisionCount, treats) */
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
    wrap.style.background = 'linear-gradient(#FFE8C8 0%, #FFD499 60%, #FFC270 100%)'
    wrap.style.overflow = 'hidden'
    wrap.style.userSelect = 'none'
    wrap.style.touchAction = 'none'
    wrap.style.cursor = 'grab'
    wrap.style.borderRadius = '0px'

    // 산책로 줄무늬 (배경)
    const road = document.createElement('div')
    road.className = 'walk-road'
    road.style.position = 'absolute'
    road.style.left = '0'
    road.style.right = '0'
    road.style.bottom = '0'
    road.style.height = '120px'
    road.style.background =
      'repeating-linear-gradient(90deg, #C9A574 0 24px, #B8915F 24px 48px)'
    road.style.opacity = '0.45'
    wrap.appendChild(road)

    // 점수/타이머 (좌상단)
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

    // 우상단 닫기
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
    closeBtn.addEventListener('click', () => this._endGame('quit'))
    wrap.appendChild(closeBtn)

    // 플레이어 (만두)
    const player = document.createElement('img')
    player.src = './images/mandu_up.png'
    player.alt = '만두'
    player.draggable = false
    player.style.position = 'absolute'
    player.style.width = PLAYER_W + 'px'
    player.style.height = PLAYER_H + 'px'
    player.style.left = (this.playerX - PLAYER_W / 2) + 'px'
    player.style.top = PLAYER_Y + 'px'
    player.style.pointerEvents = 'none'
    player.style.filter = 'drop-shadow(0 4px 6px rgba(120,80,60,0.35))'
    player.style.transition = 'transform 0.12s ease'
    // 이미지 로드 실패해도 게임은 진행
    player.onerror = () => {
      player.style.background = '#F0C8A0'
      player.style.borderRadius = '16px'
      player.style.border = '2px solid #5C3D2E'
    }
    wrap.appendChild(player)

    // 게임 오버/결과 패널 (초기 숨김)
    const endPanel = document.createElement('div')
    endPanel.className = 'walk-end'
    endPanel.style.position = 'absolute'
    endPanel.style.top = '50%'
    endPanel.style.left = '50%'
    endPanel.style.transform = 'translate(-50%, -50%)'
    endPanel.style.padding = '20px 28px'
    endPanel.style.background = 'rgba(255,255,255,0.96)'
    endPanel.style.border = '2px solid #F0C8A0'
    endPanel.style.borderRadius = '16px'
    endPanel.style.textAlign = 'center'
    endPanel.style.color = '#5C3D2E'
    endPanel.style.boxShadow = '0 6px 20px rgba(176,128,96,0.25)'
    endPanel.style.minWidth = '240px'
    endPanel.style.display = 'none'
    wrap.appendChild(endPanel)

    container.appendChild(wrap)

    this.wrap = wrap
    this.player = player
    this.scoreEl = scoreEl
    this.timerEl = timerEl
    this.endPanel = endPanel
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
    this.playerX = VIEW_W / 2
    this.targetX = VIEW_W / 2
    this.collisionCount = 0
    this.treats = 0
    this.recentlyHitMs = 0
    for (const it of this.items) it.el.remove()
    this.items = []
    this.scoreEl.textContent = '🦴 0'
    this.timerEl.textContent = '⏱ 30'
    this.endPanel.style.display = 'none'
    this.endPanel.innerHTML = ''
    this.state = 'playing'
    this._renderPlayer()
  }

  _attachPointer() {
    const rectFn = () => this.wrap.getBoundingClientRect()
    this._onPointerDown = (e) => {
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

    // 시간 만료
    if (this.elapsedMs >= DURATION_MS) {
      this._endGame('done')
      return
    }

    // hud
    const remainSec = Math.max(0, Math.ceil((DURATION_MS - this.elapsedMs) / 1000))
    this.timerEl.textContent = '⏱ ' + remainSec

    // 플레이어 lerp 보간
    this.playerX += (this.targetX - this.playerX) * PLAYER_FOLLOW
    this._renderPlayer()

    // 충돌 무적 감소
    if (this.recentlyHitMs > 0) {
      this.recentlyHitMs = Math.max(0, this.recentlyHitMs - dt)
    }

    // spawn
    this.spawnAccumMs += dt
    const p = this._progress()
    const spawnInterval = SPAWN_INTERVAL_START + (SPAWN_INTERVAL_END - SPAWN_INTERVAL_START) * p
    if (this.spawnAccumMs >= spawnInterval) {
      this.spawnAccumMs = 0
      this._spawnItem()
    }

    // 낙하 + 충돌
    const fallSpeed = (FALL_SPEED_START + (FALL_SPEED_END - FALL_SPEED_START) * p) * (dt / 16.6667)
    for (const it of this.items) {
      if (it.hit) continue
      it.y += fallSpeed
      it.el.style.top = it.y + 'px'

      // 충돌 검사 (사각형 hitbox)
      const playerLeft = this.playerX - PLAYER_W / 2 + 10
      const playerRight = this.playerX + PLAYER_W / 2 - 10
      const playerTop = PLAYER_Y + 12
      const playerBottom = PLAYER_Y + PLAYER_H - 6
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
          // 사라지면서 살짝 회전
          it.el.style.transition = 'transform 0.25s ease, opacity 0.25s ease'
          it.el.style.opacity = '0'
          it.el.style.transform = 'rotate(60deg) scale(0.6)'
          setTimeout(() => it.el.remove(), 260)
        }
      }
    }

    // 화면 밖 정리
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
    // 살짝 기울이기
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
    el.style.fontSize = '32px'
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

    // 결과 콜백 (collisionCount, treats)
    if (this._onResult) {
      try {
        this._onResult({ collisionCount: this.collisionCount, treats: this.treats, reason })
      } catch (err) {
        console.error('[walk] onResult error', err)
      }
    }

    // 자동 종료 (간단히 바로 exit)
    setTimeout(() => this.exit(), 60)
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this._detachPointer()
    for (const it of this.items) it.el.remove()
    this.items = []
    super.destroy()
  }
}

module.exports = { WalkGame }
