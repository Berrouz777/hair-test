const desktopQuery = window.matchMedia('(min-width: 1024px)')
const stage = document.querySelector('.stage')
const slides = [...document.querySelectorAll('.slide')]
const rotor = document.querySelector('.wheel-rotor')
const icons = [...document.querySelectorAll('.wheel-icon')]
const faces = [...document.querySelectorAll('.wheel-icon-face')]
const startIndex = 1
const angles = [-20, 0, 20]
const idleColor = { '--plate': '#746d68', '--glyph': '#adacac', '--icon-scale': 1.4, '--icon-left': '50%' }
const activeColor = { '--plate': '#dbdbdb', '--glyph': '#726965', '--icon-scale': 1.85, '--icon-left': '53%' }

const wheelThreshold = 40
const alignTolerance = 2

let index = startIndex
let target = startIndex
let locked = false
let aligning = false
let wheelSum = 0
let motion = null
let wheelListening = false

function rotorAngle(slideIndex) {
  return -angles[slideIndex]
}

const captions = [
  ['ФЕН-СТАЙЛЕР', '2 В 1'],
  ['суперлёгкий'],
  ['Инновационный', 'японский мотор'],
]

function setCaption(slideIndex) {
  const caption = document.querySelector('.wheel-caption-move')
  if (!caption) return
  caption.replaceChildren(
    ...captions[slideIndex].map((line) => {
      const span = document.createElement('span')
      span.textContent = line
      return span
    }),
  )
}

function setActiveIcon(slideIndex) {
  icons.forEach((icon, iconIndex) => {
    const active = iconIndex === slideIndex
    icon.classList.toggle('is-active', active)
    if (active) icon.setAttribute('aria-current', 'true')
    else icon.removeAttribute('aria-current')
  })
}

function step(direction) {
  if (!desktopQuery.matches || locked) return

  const next = index + direction
  if (next < 0 || next >= slides.length) return

  target = next
  locked = true
  playStep(direction)
}

function goTo(destination) {
  if (!desktopQuery.matches || locked) return
  if (destination === index || destination < 0 || destination >= slides.length) return

  target = destination
  locked = true
  playStep(destination > index ? 1 : -1)
}

function playStep(direction) {
  const next = index + direction
  const current = slides[index]
  const incoming = slides[next]
  const rotation = rotorAngle(next)
  const captionMove = document.querySelector('.wheel-caption-move')
  const leaveY = direction > 0 ? -16 : 16
  const duration = 0.7
  const captionOut = 0.32
  gsap.set(current, { zIndex: 0 })
  gsap.set(incoming, {
    autoAlpha: 1,
    yPercent: direction > 0 ? 100 : -100,
    zIndex: 1,
  })

  motion = gsap.timeline({
    onComplete() {
      gsap.set(current, { autoAlpha: 0, yPercent: 0, zIndex: 0 })
      current.classList.remove('is-current')
      incoming.classList.add('is-current')
      setActiveIcon(next)
      index = next
      if (index !== target) {
        playStep(target > index ? 1 : -1)
        return
      }
      motion = null
      locked = false
    },
  })
    .to(current, { yPercent: direction > 0 ? -100 : 100, duration, ease: 'power2.inOut' }, 0)
    .to(incoming, { yPercent: 0, duration, ease: 'power2.inOut' }, 0)
    .to(rotor, { '--rotor': `${rotation}deg`, duration, ease: 'power2.inOut' }, 0)
    .to(icons[index], { ...idleColor, duration, ease: 'power2.inOut' }, 0)
    .to(icons[next], { ...activeColor, duration, ease: 'power2.inOut' }, 0)
    .to(captionMove, { y: leaveY, opacity: 0, duration: captionOut, ease: 'power2.in' }, 0)
    .add(() => setCaption(next), captionOut)
    .fromTo(
      captionMove,
      { y: -leaveY, opacity: 0 },
      { y: 0, opacity: 1, duration: duration - captionOut, ease: 'power2.out', immediateRender: false },
      captionOut,
    )
}

function wheelDelta(event) {
  if (event.deltaMode === 1) return event.deltaY * 16
  if (event.deltaMode === 2) return event.deltaY * window.innerHeight
  return event.deltaY
}

function alignStage() {
  const top = stage.getBoundingClientRect().top
  aligning = true
  window.scrollTo({ top: window.scrollY + top, behavior: 'smooth' })
  window.addEventListener('scrollend', () => { aligning = false }, { once: true })
  window.setTimeout(() => { aligning = false }, 800)
}

function onWheel(event) {
  if (!desktopQuery.matches) return

  const delta = wheelDelta(event)
  if (!delta) return

  if (locked || aligning) {
    event.preventDefault()
    return
  }

  const top = stage.getBoundingClientRect().top
  const direction = Math.sign(delta)
  const aligned = Math.abs(top) <= alignTolerance

  if (!aligned) {
    const movingTowardStage = (top > alignTolerance && direction > 0) || (top < -alignTolerance && direction < 0)
    if (!movingTowardStage) {
      wheelSum = 0
      return
    }
    event.preventDefault()
    wheelSum += delta
    if (Math.abs(wheelSum) < wheelThreshold) return
    wheelSum = 0
    alignStage()
    return
  }

  const leavingStage = (index === 0 && direction < 0) || (index === slides.length - 1 && direction > 0)
  if (leavingStage) {
    wheelSum = 0
    return
  }

  event.preventDefault()
  wheelSum += delta
  if (Math.abs(wheelSum) < wheelThreshold) return
  const stepDirection = wheelSum > 0 ? 1 : -1
  wheelSum = 0
  step(stepDirection)
}

function releaseDesktop() {
  motion?.kill()
  motion = null
  locked = false
  aligning = false
  wheelSum = 0
  if (wheelListening) {
    window.removeEventListener('wheel', onWheel)
    wheelListening = false
  }
  gsap.set([...slides, rotor, ...faces, ...icons, document.querySelector('.wheel-caption-move')], { clearProps: 'all' })
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

function mountDesktop() {
  releaseDesktop()
  index = startIndex
  target = startIndex
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle('is-current', slideIndex === startIndex)
    gsap.set(slide, { yPercent: 0, autoAlpha: slideIndex === startIndex ? 1 : 0, zIndex: 0 })
  })
  gsap.set(rotor, { '--rotor': `${rotorAngle(startIndex)}deg` })
  setActiveIcon(startIndex)
  window.addEventListener('wheel', onWheel, { passive: false })
  wheelListening = true
}

function init() {
  if (!window.gsap) return

  icons.forEach((icon, iconIndex) => {
    icon.addEventListener('click', () => goTo(iconIndex))
  })
  if (desktopQuery.matches) mountDesktop()
  const syncBreakpoint = () => {
    if (desktopQuery.matches) {
      if (!wheelListening) mountDesktop()
      return
    }
    if (wheelListening) releaseDesktop()
  }
  desktopQuery.addEventListener('change', syncBreakpoint)
  window.addEventListener('resize', syncBreakpoint)
}

init()
