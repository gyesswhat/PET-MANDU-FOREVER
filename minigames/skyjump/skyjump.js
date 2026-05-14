// Sky Jump — Pou 스타일 점프 미니게임.
// 이미지 자산은 추후 교체. 현재는 색 네모 placeholder 로 렌더.
const { BaseMinigame } = require('../base.js')

const VIEW_W = 480
const VIEW_H = 480

// 물리 상수
const GRAVITY = 0.45
const JUMP_VY = -12.5
const MOVE_ACCEL = 1.3
const MAX_HSPEED = 10
const FRICTION = 0.82

// 플레이어 크기
const PLAYER_W = 60
const PLAYER_H = 60

// 플랫폼
const PLATFORM_W = 96
const PLATFORM_H = 18

// 난이도 곡선: difficulty(score) = clamp(score / DIFFICULTY_SCORE_CAP, 0, 1)
// 초반(d=0): 간격 좁고, 좌우 변동 적음 → 깨기 매우 쉬움
// 후반(d=1): 간격 넓고, 좌우 변동 큼 → 어렵지만 점프 사거리 안쪽이라 깰 수는 있음
const DIFFICULTY_SCORE_CAP = 1500
const GAP_MIN_EASY = 50
const GAP_MIN_HARD = 90
const GAP_MAX_EASY = 75
const GAP_MAX_HARD = 130
// 이전 플랫폼 x 로부터의 다음 플랫폼 좌우 변동량 최대치 (px)
const XSPREAD_EASY = 60
const XSPREAD_HARD = VIEW_W - PLATFORM_W // 사실상 전체

// 카메라
const CAMERA_TRIGGER_Y = 200 // 플레이어가 화면상 y < 200 가 되면 카메라가 따라옴

// 땅
const GROUND_H = 60

// 스코어 환산: 카메라가 1픽셀 올라갈 때마다 0.1 점
const SCORE_PER_PX = 0.1

const BEST_SCORE_KEY = 'mandu_skyjump_best'

class SkyJump extends BaseMinigame {
  constructor() {
    super({
      id: 'skyjump',
      title: 'Sky Jump',
      description: '구름 타고 쭉쭉 올라가는 게임',
    })

    this.canvas = null
    this.ctx = null
    this.rafId = null
    this.lastTime = 0

    // 이미지 preload. 로드 전엔 placeholder 로 폴백.
    this.manduImg = this._loadImg('./images/minigames/skyjump/mandu.png', '_manduImgLoaded')
    this.cloudImg = this._loadImg('./images/minigames/skyjump/cloud_platform.png', '_cloudImgLoaded')
    this.groundImg = this._loadImg('./images/minigames/skyjump/ground.png', '_groundImgLoaded')
    this.bgImg = this._loadImg('./images/minigames/skyjump/bg_sky_tile.png', '_bgImgLoaded')
    // 마지막으로 향했던 방향 (1: 우, -1: 좌). vx == 0 일 때 유지.
    this._facing = 1

    // game state
    this.state = 'ready' // 'ready' | 'playing' | 'gameover'
    this.player = null
    this.platforms = []
    this.cameraY = 0 // 누적 스크롤 양 (점수 계산용)
    this.score = 0
    this.bestScore = 0
    this.isNewBest = false

    // 입력
    this.keys = { left: false, right: false }
    this._keydown = null
    this._keyup = null

    // UI nodes
    this.uiOverlay = null
  }

  _loadImg(src, loadedFlag) {
    this[loadedFlag] = false
    const img = new Image()
    img.onload = () => { this[loadedFlag] = true }
    img.onerror = () => { this[loadedFlag] = false }
    img.src = src
    return img
  }

  mount(container) {
    super.mount(container)
    container.innerHTML = ''

    // 게임 wrapper
    const wrap = document.createElement('div')
    wrap.className = 'sj-wrap'
    wrap.style.position = 'relative'
    wrap.style.width = VIEW_W + 'px'
    wrap.style.height = VIEW_H + 'px'
    wrap.style.margin = '0 auto'
    wrap.style.background = 'linear-gradient(#CDE7FF 0%, #E8F4FF 80%, #B8E0FF 100%)'
    wrap.style.overflow = 'hidden'
    wrap.style.userSelect = 'none'

    // canvas
    const canvas = document.createElement('canvas')
    canvas.width = VIEW_W
    canvas.height = VIEW_H
    canvas.style.display = 'block'
    canvas.style.width = VIEW_W + 'px'
    canvas.style.height = VIEW_H + 'px'
    wrap.appendChild(canvas)

    // overlay (점수, 닫기, 게임오버)
    const overlay = document.createElement('div')
    overlay.className = 'sj-overlay'
    overlay.style.position = 'absolute'
    overlay.style.inset = '0'
    overlay.style.pointerEvents = 'none'
    overlay.style.fontFamily = 'inherit'
    wrap.appendChild(overlay)

    // 좌상단 점수
    const scoreEl = document.createElement('div')
    scoreEl.className = 'sj-score'
    scoreEl.style.position = 'absolute'
    scoreEl.style.top = '12px'
    scoreEl.style.left = '12px'
    scoreEl.style.padding = '6px 12px'
    scoreEl.style.background = 'rgba(255,255,255,0.85)'
    scoreEl.style.border = '2px solid #F0C8A0'
    scoreEl.style.borderRadius = '999px'
    scoreEl.style.fontSize = '14px'
    scoreEl.style.fontWeight = '600'
    scoreEl.style.color = '#5C3D2E'
    scoreEl.textContent = '0'
    overlay.appendChild(scoreEl)

    // 우상단 닫기
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'sj-close'
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
    closeBtn.style.pointerEvents = 'auto'
    closeBtn.style.boxShadow = '0 2px 8px rgba(176,128,96,0.2)'
    closeBtn.addEventListener('click', () => this.exit())
    overlay.appendChild(closeBtn)

    // 게임 오버 패널 (초기 숨김)
    const goPanel = document.createElement('div')
    goPanel.className = 'sj-gameover'
    goPanel.style.position = 'absolute'
    goPanel.style.top = '50%'
    goPanel.style.left = '50%'
    goPanel.style.transform = 'translate(-50%, -50%)'
    goPanel.style.padding = '20px 28px'
    goPanel.style.background = 'rgba(255,255,255,0.95)'
    goPanel.style.border = '2px solid #F0C8A0'
    goPanel.style.borderRadius = '16px'
    goPanel.style.textAlign = 'center'
    goPanel.style.color = '#5C3D2E'
    goPanel.style.boxShadow = '0 6px 20px rgba(176,128,96,0.25)'
    goPanel.style.display = 'none'
    goPanel.style.pointerEvents = 'auto'
    goPanel.style.minWidth = '220px'
    overlay.appendChild(goPanel)

    container.appendChild(wrap)

    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.uiOverlay = overlay
    this.scoreEl = scoreEl
    this.goPanel = goPanel

    this._loadBest()
  }

  _loadBest() {
    try {
      const raw = localStorage.getItem(BEST_SCORE_KEY)
      this.bestScore = raw ? parseInt(raw, 10) || 0 : 0
    } catch (e) {
      this.bestScore = 0
    }
  }

  _saveBest() {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore))
    } catch (e) {
      // localStorage 못 쓰면 무시
    }
  }

  // 0(easy) → 1(hard). 점수가 DIFFICULTY_SCORE_CAP 에 도달하면 최대 난이도.
  _difficulty() {
    return Math.min(1, Math.max(0, this.score / DIFFICULTY_SCORE_CAP))
  }

  // 이전 플랫폼 위에 다음 플랫폼을 절차적으로 생성. 간격/좌우 변동이 모두 난이도에 따라 커진다.
  _spawnNextPlatform(prev) {
    const d = this._difficulty()
    const minGap = GAP_MIN_EASY + (GAP_MIN_HARD - GAP_MIN_EASY) * d
    const maxGap = GAP_MAX_EASY + (GAP_MAX_HARD - GAP_MAX_EASY) * d
    const gap = minGap + Math.random() * (maxGap - minGap)
    const y = prev.y - gap

    const spread = XSPREAD_EASY + (XSPREAD_HARD - XSPREAD_EASY) * d
    const lowX = Math.max(0, prev.x - spread)
    const highX = Math.min(VIEW_W - PLATFORM_W, prev.x + spread)
    const x = lowX + Math.random() * (highX - lowX)

    const plat = { x, y, w: PLATFORM_W, h: PLATFORM_H }
    this.platforms.push(plat)
    return plat
  }

  _reset() {
    // 플레이어를 땅 위에 세움.
    this.player = {
      x: VIEW_W / 2 - PLAYER_W / 2,
      y: VIEW_H - GROUND_H - PLAYER_H,
      vx: 0,
      vy: JUMP_VY, // 시작 즉시 첫 점프
    }
    this.cameraY = 0
    this.score = 0
    this.isNewBest = false
    this.state = 'playing'

    // 초기 플랫폼
    this.platforms = []
    // 보장 플랫폼: 플레이어 발 바로 아래에 배치 — 첫 점프 후 안전하게 착지 가능
    const base = {
      x: VIEW_W / 2 - PLATFORM_W / 2,
      y: VIEW_H - GROUND_H - 12,
      w: PLATFORM_W,
      h: PLATFORM_H,
    }
    this.platforms.push(base)
    // 위쪽 절차적 생성 — 초기엔 score=0 이라 가장 쉬운 셋팅으로 시작.
    let prev = base
    while (prev.y > -200) {
      prev = this._spawnNextPlatform(prev)
    }

    this.goPanel.style.display = 'none'
    this.scoreEl.textContent = '0'
  }

  start() {
    super.start()
    this._reset()
    this._attachInput()
    this.lastTime = performance.now()
    const tick = (now) => {
      if (!this._running) return
      const dt = Math.min(32, now - this.lastTime) // ms
      this.lastTime = now
      if (this.state === 'playing') {
        this._update(dt / 16.6667) // 60fps 기준 정규화
      }
      this._render()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  _attachInput() {
    this._keydown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.left = true
        e.preventDefault()
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.right = true
        e.preventDefault()
      } else if (e.key === 'Escape') {
        this.exit()
      }
    }
    this._keyup = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keys.left = false
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keys.right = false
      }
    }
    window.addEventListener('keydown', this._keydown)
    window.addEventListener('keyup', this._keyup)
  }

  _detachInput() {
    if (this._keydown) window.removeEventListener('keydown', this._keydown)
    if (this._keyup) window.removeEventListener('keyup', this._keyup)
    this._keydown = null
    this._keyup = null
    this.keys.left = false
    this.keys.right = false
  }

  _update(t) {
    const p = this.player
    // 가속/마찰
    if (this.keys.left) p.vx -= MOVE_ACCEL * t
    if (this.keys.right) p.vx += MOVE_ACCEL * t
    if (!this.keys.left && !this.keys.right) {
      p.vx *= Math.pow(FRICTION, t)
      if (Math.abs(p.vx) < 0.05) p.vx = 0
    }
    if (p.vx > MAX_HSPEED) p.vx = MAX_HSPEED
    if (p.vx < -MAX_HSPEED) p.vx = -MAX_HSPEED

    // 시각 방향: 키 누른 방향 기준 (속도 0 또는 마찰 감속 중엔 직전 방향 유지)
    if (this.keys.right) this._facing = 1
    else if (this.keys.left) this._facing = -1

    // 중력
    p.vy += GRAVITY * t

    // 위치 갱신
    p.x += p.vx * t
    p.y += p.vy * t

    // 가로 wrap-around
    if (p.x + PLAYER_W < 0) p.x = VIEW_W
    if (p.x > VIEW_W) p.x = -PLAYER_W

    // 플랫폼 충돌 — 하강 중일 때, 발 끝이 플랫폼 상단을 지나가는 순간만
    if (p.vy > 0) {
      for (const plat of this.platforms) {
        const playerFootPrev = p.y + PLAYER_H - p.vy * t
        const playerFootNow = p.y + PLAYER_H
        const overlapX = p.x + PLAYER_W > plat.x && p.x < plat.x + plat.w
        const crossingTop =
          playerFootPrev <= plat.y && playerFootNow >= plat.y
        if (overlapX && crossingTop) {
          // 자동 점프
          p.y = plat.y - PLAYER_H
          p.vy = JUMP_VY
          break
        }
      }
    }

    // 카메라: 플레이어가 화면상 y < CAMERA_TRIGGER_Y 가 되면, 그만큼 모두를 아래로 밀어 화면 유지.
    if (p.y < CAMERA_TRIGGER_Y) {
      const delta = CAMERA_TRIGGER_Y - p.y
      p.y += delta
      for (const plat of this.platforms) plat.y += delta
      this.cameraY += delta
      this.score = Math.floor(this.cameraY * SCORE_PER_PX)
      this.scoreEl.textContent = String(this.score)
    }

    // 아래로 벗어난 플랫폼 제거
    this.platforms = this.platforms.filter((pl) => pl.y < VIEW_H + 40)

    // 위쪽으로 새 플랫폼 채우기 — 가장 높은 플랫폼에서 chain 으로 생성
    let topPlat = this.platforms.reduce(
      (best, pl) => (pl.y < best.y ? pl : best),
      this.platforms[0]
    )
    while (topPlat.y > -120) {
      topPlat = this._spawnNextPlatform(topPlat)
    }

    // 게임 오버: 플레이어가 화면 아래로 완전히 떨어짐
    if (p.y > VIEW_H + 20) {
      this._gameOver()
    }
  }

  _gameOver() {
    this.state = 'gameover'

    if (this.score > this.bestScore) {
      this.bestScore = this.score
      this.isNewBest = true
      this._saveBest()
    }

    this._renderGameOverPanel()
  }

  _renderGameOverPanel() {
    const panel = this.goPanel
    panel.innerHTML = ''

    const title = document.createElement('div')
    title.style.fontSize = '20px'
    title.style.fontWeight = '700'
    title.style.marginBottom = '10px'
    title.textContent = '게임 오버'
    panel.appendChild(title)

    const sc = document.createElement('div')
    sc.style.fontSize = '14px'
    sc.style.marginBottom = '4px'
    sc.textContent = `점수: ${this.score}`
    panel.appendChild(sc)

    const best = document.createElement('div')
    best.style.fontSize = '13px'
    best.style.color = '#B08060'
    best.style.marginBottom = '14px'
    best.textContent = `최고 점수: ${this.bestScore}`
    panel.appendChild(best)

    if (this.isNewBest) {
      const nb = document.createElement('div')
      nb.style.fontSize = '13px'
      nb.style.color = '#FFB347'
      nb.style.fontWeight = '700'
      nb.style.marginBottom = '14px'
      nb.textContent = '🌟 NEW BEST!'
      panel.insertBefore(nb, best.nextSibling)
    }

    const btnRow = document.createElement('div')
    btnRow.style.display = 'flex'
    btnRow.style.gap = '8px'
    btnRow.style.justifyContent = 'center'

    const restartBtn = document.createElement('button')
    restartBtn.type = 'button'
    restartBtn.textContent = '다시 시작'
    this._styleButton(restartBtn, true)
    restartBtn.addEventListener('click', () => {
      this._reset()
    })
    btnRow.appendChild(restartBtn)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.textContent = '닫기'
    this._styleButton(closeBtn, false)
    closeBtn.addEventListener('click', () => this.exit())
    btnRow.appendChild(closeBtn)

    panel.appendChild(btnRow)
    panel.style.display = 'block'
  }

  _styleButton(btn, primary) {
    btn.style.padding = '8px 14px'
    btn.style.border = '2px solid #F0C8A0'
    btn.style.borderRadius = '999px'
    btn.style.background = primary ? '#FFB347' : '#FFFFFF'
    btn.style.color = primary ? '#FFFFFF' : '#5C3D2E'
    btn.style.fontFamily = 'inherit'
    btn.style.fontSize = '13px'
    btn.style.fontWeight = '600'
    btn.style.cursor = 'pointer'
  }

  _render() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, VIEW_W, VIEW_H)

    // 배경 — 타일 이미지 두 장 stacked + 살짝의 parallax. 못 불러왔으면 gradient 폴백.
    if (this._bgImgLoaded) {
      const tileH = VIEW_H
      const raw = (this.cameraY * 0.3) % tileH
      const off = raw < 0 ? raw + tileH : raw
      ctx.drawImage(this.bgImg, 0, off - tileH, VIEW_W, tileH)
      ctx.drawImage(this.bgImg, 0, off, VIEW_W, tileH)
    } else {
      const grd = ctx.createLinearGradient(0, 0, 0, VIEW_H)
      grd.addColorStop(0, '#CDE7FF')
      grd.addColorStop(0.85, '#E8F4FF')
      grd.addColorStop(1, '#B8E0FF')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    }

    // 땅 — 카메라가 따라 올라간 만큼 함께 밀려 내려가야 함. ground.png 는 480x80 권장.
    const groundY = VIEW_H - GROUND_H + this.cameraY
    if (groundY < VIEW_H) {
      if (this._groundImgLoaded) {
        ctx.drawImage(this.groundImg, 0, groundY, VIEW_W, 80)
      } else {
        ctx.fillStyle = '#A8D080'
        ctx.fillRect(0, groundY, VIEW_W, GROUND_H)
        ctx.fillStyle = '#8B6A3F'
        ctx.fillRect(0, Math.min(VIEW_H, groundY + 18), VIEW_W, GROUND_H)
      }
    }

    // 플랫폼 (구름) — 이미지 96x32 권장, hitbox top 라인 = 이미지 top
    for (const plat of this.platforms) {
      if (this._cloudImgLoaded) {
        ctx.drawImage(this.cloudImg, plat.x, plat.y, plat.w, 32)
      } else {
        this._drawCloudPlaceholder(ctx, plat.x, plat.y, plat.w, plat.h)
      }
    }

    // 플레이어 (만두)
    this._drawPlayer(ctx, this.player.x, this.player.y)
  }

  _drawCloudPlaceholder(ctx, x, y, w, h) {
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeStyle = '#B0D0E0'
    ctx.lineWidth = 2
    this._roundRect(ctx, x, y, w, h, 10)
    ctx.fill()
    ctx.stroke()
  }

  _drawPlayer(ctx, x, y) {
    if (this._manduImgLoaded) {
      // hitbox 는 PLAYER_W x PLAYER_H (60x60), 시각적으론 더 크게 그려서 만두 비중↑.
      // 발(visual bottom) 이 hitbox bottom 과 정렬되도록 y 보정.
      const vW = 96
      const vH = 96
      const vX = x + (PLAYER_W - vW) / 2
      const vY = y + PLAYER_H - vH
      if (this._facing === -1) {
        ctx.save()
        ctx.translate(vX + vW, vY)
        ctx.scale(-1, 1)
        ctx.drawImage(this.manduImg, 0, 0, vW, vH)
        ctx.restore()
      } else {
        ctx.drawImage(this.manduImg, vX, vY, vW, vH)
      }
      return
    }
    // placeholder (이미지 로드 실패/지연 시)
    ctx.fillStyle = '#F0C8A0'
    ctx.strokeStyle = '#5C3D2E'
    ctx.lineWidth = 2
    this._roundRect(ctx, x, y, PLAYER_W, PLAYER_H, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#5C3D2E'
    const eyeY = y + PLAYER_H * 0.4
    ctx.beginPath()
    ctx.arc(x + PLAYER_W * 0.32, eyeY, 3, 0, Math.PI * 2)
    ctx.arc(x + PLAYER_W * 0.68, eyeY, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x + PLAYER_W * 0.5, y + PLAYER_H * 0.65, 4, 0, Math.PI)
    ctx.stroke()
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this._detachInput()
    super.destroy()
  }
}

module.exports = { SkyJump }
