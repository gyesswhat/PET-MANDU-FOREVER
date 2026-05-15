// 미니게임 레지스트리.
// 새 게임 추가:
//   1) ./<game>/<game>.js 에서 BaseMinigame 를 상속한 클래스 export
//   2) 아래 두 줄(import + register({ ... })) 만 추가
const _games = new Map() // id -> meta

function register(meta) {
  if (!meta || !meta.id || typeof meta.factory !== 'function') {
    throw new Error('[minigame] register requires { id, title, factory }')
  }
  if (_games.has(meta.id)) {
    console.warn('[minigame] duplicate id, overwriting:', meta.id)
  }
  _games.set(meta.id, {
    id: meta.id,
    title: meta.title || meta.id,
    description: meta.description || '',
    icon: meta.icon || '🎮',
    factory: meta.factory,
  })
}

function get(id) {
  const meta = _games.get(id)
  return meta ? meta.factory() : null
}

// 선택 화면용 — factory 제외한 메타 정보만 반환.
function list() {
  return Array.from(_games.values()).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    icon: m.icon,
  }))
}

// ── 등록 ──
const { SkyJump } = require('./skyjump/skyjump.js')
register({
  id: 'skyjump',
  title: 'Sky Jump',
  description: '구름 타고 쭉쭉 올라가기',
  icon: '☁️',
  factory: () => new SkyJump(),
})

const { WalkGame } = require('./walk/walk.js')
register({
  id: 'walk',
  title: '산책',
  description: '리드줄 잡고 만두랑 산책 가기',
  icon: '🐾',
  factory: () => new WalkGame(),
})

module.exports = { register, get, list }
