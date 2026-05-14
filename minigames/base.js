// 모든 미니게임이 따라야 할 공통 라이프사이클.
// 새 미니게임 추가 시 BaseMinigame 를 상속하고 mount/start/destroy 만 구현하면 됨.
class BaseMinigame {
  constructor(meta) {
    this.id = meta.id
    this.title = meta.title
    this.description = meta.description || ''
    this.container = null
    this._running = false
    this._paused = false
    this._onExit = null
  }

  onExit(cb) {
    this._onExit = cb
  }

  mount(container) {
    this.container = container
  }

  start() {
    this._running = true
  }

  pause() {
    this._paused = true
  }

  resume() {
    this._paused = false
  }

  exit() {
    if (this._onExit) this._onExit()
  }

  destroy() {
    this._running = false
    if (this.container) {
      this.container.innerHTML = ''
    }
  }

  isRunning() {
    return this._running && !this._paused
  }
}

module.exports = { BaseMinigame }
