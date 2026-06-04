// src/components/GLBAvatar.jsx
// 곳간이 정적 GLB(Tripo image-to-3D) 아바타 렌더러 — three.js.
//
// VRM과 달리 이 모델은 휴머노이드 뼈대/블렌드셰이프가 없는 "정적 메시"라
// 입모양 립싱크는 불가능하다. 대신:
//   - idle  : 부드러운 좌우 시선 회전 + 위아래 호흡 bob
//   - speak : TTS 오디오 음량(RMS)에 맞춰 살짝 통통 튀는 "말하는" 모션
//             (입모양 대신 몸 전체가 리듬에 반응 → 살아있는 느낌)
//
// imperative handle은 VRMAvatar와 동일한 시그니처라 App.jsx 교체 없이 끼울 수 있다:
//   speak(arrayBuffer) -> Promise   : 음성 재생 + 모션, 끝나면 resolve
//   stopSpeaking()                  : 재생 중단
//   isSpeaking() / isReady() / getModel()
//   setMouthOpen(v) / setExpression(...) : VRM 호환용 (정적 모델이라 no-op에 가까움)

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// 말하기 모션 튜닝 — 음량(RMS) → 통통 튀는 정도
const TALK_FLOOR = 0.018  // 이 이하 RMS는 무음으로 간주
const TALK_GAIN = 6.5     // RMS 증폭 → 0..1
const TALK_SMOOTH = 0.35  // 모션 보간 (0..1, 클수록 빠릿)

// 곳간이 정면이 카메라(+Z)를 보도록 하는 Y축 회전(도). 이 Tripo 모델은
// 기본적으로 옆을 보고 있어서 -90°로 돌려야 정면이 보인다.
// 만약 배포 후 여전히 옆/뒤를 보면 이 값만 바꾸면 됨: 0 / 90 / -90 / 180
const FACING_Y_DEG = -90

const GLBAvatar = forwardRef(function GLBAvatar(
  { modelUrl = '/model.glb', onReady, onError, className, style },
  ref
) {
  const mountRef = useRef(null)
  const modelRef = useRef(null)
  const readyRef = useRef(false)
  const talkLevelRef = useRef(0)   // 목표 말하기 강도 0..1

  // ── 오디오 ──
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const analyserDataRef = useRef(null)
  const currentSourceRef = useRef(null)
  const speakingRef = useRef(false)
  const speakEndResolveRef = useRef(null)

  const stopCurrentAudio = () => {
    const src = currentSourceRef.current
    if (src) {
      try { src.onended = null; src.stop() } catch { /* already stopped */ }
      currentSourceRef.current = null
    }
    analyserRef.current = null
    speakingRef.current = false
    talkLevelRef.current = 0
    const resolve = speakEndResolveRef.current
    speakEndResolveRef.current = null
    if (resolve) resolve()
  }

  const ensureAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new AC()
    }
    return audioCtxRef.current
  }

  useImperativeHandle(ref, () => ({
    isReady: () => readyRef.current,
    isSpeaking: () => speakingRef.current,
    getModel: () => modelRef.current,

    speak: async (arrayBuffer) => {
      stopCurrentAudio()
      if (!arrayBuffer || !arrayBuffer.byteLength) return
      const ctx = ensureAudioCtx()
      if (ctx.state === 'suspended') {
        try { await ctx.resume() } catch { /* ignore */ }
      }
      let audioBuffer
      try {
        audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
      } catch (e) {
        console.warn('[GLBAvatar] decodeAudioData 실패:', e)
        return
      }
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyser.connect(ctx.destination)

      analyserRef.current = analyser
      analyserDataRef.current = new Uint8Array(analyser.fftSize)
      currentSourceRef.current = source
      speakingRef.current = true

      return new Promise((resolve) => {
        speakEndResolveRef.current = resolve
        source.onended = () => {
          if (currentSourceRef.current !== source) return
          currentSourceRef.current = null
          analyserRef.current = null
          speakingRef.current = false
          talkLevelRef.current = 0
          speakEndResolveRef.current = null
          resolve()
        }
        source.start()
      })
    },

    stopSpeaking: () => stopCurrentAudio(),

    // VRM 호환용 — 정적 모델이라 말하기 강도로만 받아둔다.
    setMouthOpen: (v) => {
      talkLevelRef.current = Math.max(0, Math.min(1, Number(v) || 0))
    },
    setExpression: () => { /* 정적 모델: 표정 없음 */ },
  }), [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let disposed = false

    // ── scene / camera / renderer ──
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    camera.position.set(0, 0.1, 3)
    scene.add(camera)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x000000, 0)   // 투명 — 패널 CSS 배경이 비침
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    // ── PBR 환경광 (Tripo 머티리얼이 PBR이라 env map이 있어야 자연스러움) ──
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex

    // 보조 라이트
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(0.6, 1.4, 1.2)
    scene.add(dir)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b5a45, 0.65))
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))

    // ── sizing ──
    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // pivot: idle/talk 모션은 여기에 적용 (모델 자체엔 centering+scale만)
    const pivot = new THREE.Group()
    scene.add(pivot)

    const loader = new GLTFLoader()
    const timer = new THREE.Timer()
    let talkSmoothed = 0
    let baseY = 0

    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return
        const model = gltf.scene
        model.traverse((o) => { o.frustumCulled = false })

        // 정면이 카메라를 보도록 회전 (bbox 계산 전에 적용해야 센터링이 맞음)
        model.rotation.y = (FACING_Y_DEG * Math.PI) / 180
        model.updateWorldMatrix(true, false)

        // 정면이 카메라를 보도록 회전
        model.rotation.y = (FACING_Y_DEG * Math.PI) / 180

        // 1) 목표 높이로 스케일
        model.updateWorldMatrix(true, false)
        let box = new THREE.Box3().setFromObject(model)
        const size = new THREE.Vector3(); box.getSize(size)
        const maxDim = Math.max(size.x, size.y, size.z) || 1
        const targetH = 1.9
        model.scale.setScalar(targetH / maxDim)

        // 2) 스케일 적용 후 다시 박스 계산해서 정확히 원점 정렬
        model.updateWorldMatrix(true, false)
        box = new THREE.Box3().setFromObject(model)
        const center = new THREE.Vector3(); box.getCenter(center)
        model.position.sub(center)

        pivot.add(model)
        modelRef.current = model

        // 카메라 프레이밍 — 얼굴(상단부)을 살짝 올려다보게 해서 모자챙에 눈이
        // 가리지 않도록. 몸 전체는 프레임 안에 들어오게 여백 확보.
        const fov = (camera.fov * Math.PI) / 180
        const radius = targetH * 0.62
        const dist = (radius / Math.sin(fov / 2)) * 1.05  // 가로 패널: 적당히 여유
        camera.position.set(0, targetH * 0.04, dist)
        camera.lookAt(0, targetH * 0.16, 0)

        baseY = 0
        readyRef.current = true
        onReady?.(model)

        renderer.setAnimationLoop(() => {
          if (disposed) return
          timer.update()
          const t = timer.getElapsed()

          // 말하기 강도: 발화 중이면 음량(RMS) → talkLevelRef
          if (speakingRef.current && analyserRef.current && analyserDataRef.current) {
            const data = analyserDataRef.current
            analyserRef.current.getByteTimeDomainData(data)
            let sum = 0
            for (let i = 0; i < data.length; i++) {
              const s = (data[i] - 128) / 128
              sum += s * s
            }
            const rms = Math.sqrt(sum / data.length)
            talkLevelRef.current = Math.max(0, Math.min(1, (rms - TALK_FLOOR) * TALK_GAIN))
          }
          talkSmoothed += (talkLevelRef.current - talkSmoothed) * TALK_SMOOTH

          // idle: 부드러운 좌우 시선 회전 + 호흡 bob
          pivot.rotation.y = Math.sin(t * 0.4) * 0.22
          const breathe = Math.sin(t * 1.4) * 0.012
          // talk: 음량에 맞춰 통통 튀는 bob + 살짝 squash-stretch
          const bounce = Math.abs(Math.sin(t * 11)) * talkSmoothed * 0.05
          pivot.position.y = baseY + breathe + bounce
          const squash = talkSmoothed * 0.035
          pivot.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6)

          renderer.render(scene, camera)
        })
      },
      undefined,
      (err) => {
        console.error('[GLBAvatar] load failed:', err)
        onError?.(err)
      }
    )

    return () => {
      disposed = true
      ro.disconnect()
      renderer.setAnimationLoop(null)
      stopCurrentAudio()
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close() } catch { /* ignore */ }
        audioCtxRef.current = null
      }
      const m = modelRef.current
      if (m) {
        try {
          pivot.remove(m)
          m.traverse((o) => {
            if (o.geometry) o.geometry.dispose?.()
            if (o.material) {
              const mats = Array.isArray(o.material) ? o.material : [o.material]
              for (const mat of mats) {
                for (const val of Object.values(mat)) {
                  if (val && val.isTexture) val.dispose()
                }
                mat.dispose?.()
              }
            }
          })
        } catch { /* ignore */ }
        modelRef.current = null
      }
      try { envTex.dispose?.(); pmrem.dispose?.() } catch { /* ignore */ }
      readyRef.current = false
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [modelUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  )
})

export default GLBAvatar
