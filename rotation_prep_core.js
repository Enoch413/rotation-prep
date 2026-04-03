const APP_CONFIG = {
  defaultTitle: 'ROTATION PREP',
  remoteSessionUrl: 'session.json'
}

const QUESTION_META = {
  topic: { section: 'Big Picture', label: 'Topic', prompt: 'State the topic of this passage in one sentence.' },
  gist: { section: 'Big Picture', label: 'Gist', prompt: 'State the gist of this passage in one sentence.' },
  title: { section: 'Big Picture', label: 'Title', prompt: 'Suggest the best title for this passage.' },
  summary: { section: 'One-Sentence Summary', label: 'Summary', prompt: 'Summarize the whole passage in one sentence.' },
  overall: { section: 'Overall Understanding', label: 'Overall Understanding', prompt: 'Explain the overall content briefly.' }
}

const SCREEN_IDS = ['boot-screen', 'pw-screen', 'class-screen', 'class-auth-screen', 'home-screen', 'study-screen']

let bundleData = null
let prepClasses = []
let studySets = []
let currentClassIndex = -1
let currentSetIndex = -1
let currentPassage = -1
let currentStage = 'study'
let pendingClassIndex = -1
let baseProgressKey = 'rotation_prep_progress_v7'
let progressKey = ''
let progress = { stage1: {}, stage2: {} }
let unlockedClassIds = {}
let pageTitle = APP_CONFIG.defaultTitle
let globalPassword = ''
let isUnlocked = true

document.addEventListener('DOMContentLoaded', initApp)

async function initApp(){
  bindEvents()
  applyPageTitle(APP_CONFIG.defaultTitle)
  setBootState('PREP 자료를 불러오는 중입니다.', '웹에서는 같은 폴더의 <b>session.json</b>을 자동으로 확인합니다.')
  setSessionStatus('info', '대기 중', 'session.json을 확인하는 중입니다.', '')
  const loaded = await loadRemoteSession({ silent: true, silentToast: true })
  if(!loaded) showNoSessionState()
}

function bindEvents(){
  document.getElementById('pw-submit-btn').addEventListener('click', checkPw)
  document.getElementById('class-auth-submit-btn').addEventListener('click', confirmClassPassword)
  document.getElementById('class-auth-back-btn').addEventListener('click', backToClassSelection)
  document.getElementById('change-class-btn').addEventListener('click', showClassScreen)
  document.getElementById('study-class-btn').addEventListener('click', showClassScreen)
  document.getElementById('back-home-btn').addEventListener('click', goHome)
  document.getElementById('p-toggle').addEventListener('click', togglePassage)
  document.getElementById('stage-btn-study').addEventListener('click', function(){ switchStage('study') })
  document.getElementById('stage-btn-practice').addEventListener('click', function(){ switchStage('practice') })
  document.getElementById('reset-progress-btn').addEventListener('click', resetProgress)
  document.getElementById('refresh-json-btn').addEventListener('click', function(){ loadRemoteSession({ silentToast: false }) })
  document.getElementById('load-file-btn').addEventListener('click', openFilePicker)
  document.getElementById('file-input').addEventListener('change', loadFile)
  document.getElementById('clear-set-btn').addEventListener('click', function(){
    currentSetIndex = -1
    currentPassage = -1
    updateSetProgressContext()
    renderClassSummary()
    renderDash()
  })

  const loadBox = document.getElementById('load-box')
  loadBox.addEventListener('click', openFilePicker)
  loadBox.addEventListener('keydown', function(event){
    if(event.key === 'Enter' || event.key === ' '){
      event.preventDefault()
      openFilePicker()
    }
  })

  document.getElementById('pw-input').addEventListener('keydown', function(event){
    if(event.key === 'Enter') checkPw()
  })
  document.getElementById('class-pw-input').addEventListener('keydown', function(event){
    if(event.key === 'Enter') confirmClassPassword()
  })
}

function canFetchRemote(){
  return /^https?:$/i.test(window.location.protocol)
}

function buildRemoteUrl(){
  const joiner = APP_CONFIG.remoteSessionUrl.indexOf('?') >= 0 ? '&' : '?'
  return APP_CONFIG.remoteSessionUrl + joiner + 'v=' + Date.now()
}

async function loadRemoteSession(options){
  const settings = options || {}
  if(!canFetchRemote()) return false
  setBootState('session.json을 확인하는 중입니다.', '최신 PREP 번들을 자동으로 불러오고 있습니다.')
  activateScreen('boot-screen')
  try{
    const response = await fetch(buildRemoteUrl(), { cache: 'no-store' })
    if(!response.ok) throw new Error('HTTP ' + response.status)
    loadData(await response.json(), { source: 'remote' })
    if(!settings.silentToast) showToast('최신 session.json을 불러왔습니다.', 'var(--green)')
    return true
  }catch(error){
    if(!settings.silent) showToast('session.json을 불러오지 못했습니다.', 'var(--red)')
    return false
  }
}

function openFilePicker(){ document.getElementById('file-input').click() }

function loadFile(event){
  const file = event.target.files && event.target.files[0]
  if(!file) return
  const reader = new FileReader()
  reader.onload = function(loadEvent){
    try{
      loadData(JSON.parse(loadEvent.target.result), { source: 'manual' })
      showToast('JSON을 불러왔습니다.', 'var(--green)')
    }catch(error){
      showToast('JSON을 읽지 못했습니다.', 'var(--red)')
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

function loadData(data, options){
  const normalized = normalizeBundleData(data)
  const settings = options || {}
  bundleData = data || {}
  prepClasses = normalized.classes
  studySets = normalized.studySets
  globalPassword = String(normalized.prepConfig.globalPassword || '').trim()
  isUnlocked = !globalPassword
  applyPageTitle(normalized.prepConfig.pageTitle || APP_CONFIG.defaultTitle)
  currentClassIndex = -1
  currentSetIndex = -1
  currentPassage = -1
  currentStage = 'study'
  pendingClassIndex = -1
  unlockedClassIds = {}
  progressKey = ''
  progress = { stage1: {}, stage2: {} }
  baseProgressKey = 'rotation_prep_progress_v7_' + simpleHash(JSON.stringify({ classes: prepClasses, sets: studySets.map(function(set){ return { id: set.id, title: set.title, startDate: set.startDate, endDate: set.endDate, assignments: set.classAssignments, passages: set.passages.map(function(p){ return { title: p.title, items: p.items.length } }) } }) }))
  document.getElementById('dash').style.display = 'block'
  document.getElementById('load-box').classList.add('hidden')
  document.getElementById('refresh-json-btn').style.display = canFetchRemote() ? 'inline-flex' : 'none'
  setSessionStatus(
    settings.source === 'remote' ? 'ok' : 'info',
    settings.source === 'remote' ? '웹 연결' : '수동 테스트',
    settings.source === 'remote' ? '웹의 session.json과 연결되었습니다.' : '로컬 JSON 테스트 모드입니다.',
    formatUpdatedText(data)
  )
  renderClassList()
  routeAfterLoad()
}

function showNoSessionState(){
  bundleData = null
  prepClasses = []
  studySets = []
  currentClassIndex = -1
  currentSetIndex = -1
  currentPassage = -1
  currentStage = 'study'
  pendingClassIndex = -1
  progressKey = ''
  progress = { stage1: {}, stage2: {} }
  globalPassword = ''
  isUnlocked = true
  applyPageTitle(APP_CONFIG.defaultTitle)
  document.getElementById('dash').style.display = 'none'
  document.getElementById('load-box').classList.remove('hidden')
  document.getElementById('refresh-json-btn').style.display = canFetchRemote() ? 'inline-flex' : 'none'
  setSessionStatus(
    canFetchRemote() ? 'warn' : 'info',
    canFetchRemote() ? 'JSON 없음' : '로컬 모드',
    canFetchRemote() ? '서버에서 session.json을 찾지 못했습니다.' : '로컬 모드에서는 JSON 파일을 직접 불러오세요.',
    ''
  )
  activateScreen('home-screen')
}

function setBootState(title, description){
  document.getElementById('boot-title').textContent = title
  document.getElementById('boot-desc').innerHTML = description
}

function setSessionStatus(type, badge, text, updatedText){
  const badgeEl = document.getElementById('session-source')
  badgeEl.textContent = badge
  badgeEl.className = 'status-badge'
  if(type === 'ok') badgeEl.classList.add('ok')
  if(type === 'warn') badgeEl.classList.add('warn')
  if(type === 'info') badgeEl.classList.add('info')
  document.getElementById('session-status-text').textContent = text
  document.getElementById('session-updated').textContent = updatedText || ''
}

function formatUpdatedText(source){
  const raw = source && source.prepConfig && source.prepConfig.generatedAt ? source.prepConfig.generatedAt : (source && (source.savedAt || source.updatedAt || ''))
  if(!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? '' : ('업데이트: ' + date.toLocaleString('ko-KR', { hour12: false }))
}

function applyPageTitle(title){
  pageTitle = String(title || '').trim() || APP_CONFIG.defaultTitle
  document.title = pageTitle
  document.getElementById('home-subtitle').textContent = pageTitle
  document.getElementById('class-subtitle').textContent = pageTitle
  document.getElementById('class-auth-subtitle').textContent = pageTitle
}

function routeAfterLoad(){
  document.getElementById('pw-err').textContent = ''
  document.getElementById('pw-input').value = ''
  if(!bundleData) return showNoSessionState()
  if(!isUnlocked){
    activateScreen('pw-screen')
    return setTimeout(function(){ document.getElementById('pw-input').focus() }, 0)
  }
  routeAfterUnlock()
}

function checkPw(){
  const value = document.getElementById('pw-input').value.trim()
  if(value === globalPassword){
    document.getElementById('pw-err').textContent = ''
    isUnlocked = true
    return routeAfterUnlock()
  }
  document.getElementById('pw-err').textContent = '비밀번호가 올바르지 않습니다.'
  document.getElementById('pw-input').value = ''
  document.getElementById('pw-input').focus()
}

function routeAfterUnlock(){
  if(!bundleData) return showNoSessionState()
  if(prepClasses.length > 1 && currentClassIndex < 0) return showClassScreen()
  if(prepClasses.length === 1 && currentClassIndex < 0){
    requestClassAccess(0, { stayOnCurrent: true })
    if(currentClassIndex >= 0) showHome()
    return
  }
  showHome()
}

function activateScreen(targetId){
  SCREEN_IDS.forEach(function(id){ document.getElementById(id).classList.remove('active') })
  document.getElementById(targetId).classList.add('active')
}

function showClassScreen(){
  if(!bundleData) return showNoSessionState()
  if(prepClasses.length <= 1) return showHome()
  activateScreen('class-screen')
}

function backToClassSelection(){ return prepClasses.length > 1 ? showClassScreen() : showHome() }

function requestClassAccess(index, options){
  if(index < 0 || index >= prepClasses.length) return
  const classInfo = prepClasses[index]
  if(classInfo.password && !unlockedClassIds[classInfo.id]){
    pendingClassIndex = index
    document.getElementById('class-auth-name').textContent = classInfo.name
    document.getElementById('class-pw-input').value = ''
    document.getElementById('class-pw-err').textContent = ''
    document.getElementById('class-auth-back-btn').style.display = prepClasses.length > 1 ? 'inline-flex' : 'none'
    activateScreen('class-auth-screen')
    return setTimeout(function(){ document.getElementById('class-pw-input').focus() }, 0)
  }
  selectClass(index, options)
}

function confirmClassPassword(){
  const classInfo = prepClasses[pendingClassIndex]
  if(!classInfo) return
  const value = document.getElementById('class-pw-input').value.trim()
  if(value === classInfo.password){
    unlockedClassIds[classInfo.id] = true
    document.getElementById('class-pw-err').textContent = ''
    selectClass(pendingClassIndex)
    pendingClassIndex = -1
    return
  }
  document.getElementById('class-pw-err').textContent = '반 비밀번호가 올바르지 않습니다.'
  document.getElementById('class-pw-input').value = ''
  document.getElementById('class-pw-input').focus()
}

function selectClass(index, options){
  if(index < 0 || index >= prepClasses.length) return
  currentClassIndex = index
  currentSetIndex = -1
  currentPassage = -1
  currentStage = 'study'
  ensureCurrentSetSelection()
  updateSetProgressContext()
  renderClassSummary()
  renderDash()
  if(!(options && options.stayOnCurrent)) showHome()
}

function ensureCurrentSetSelection(){
  const visibleSets = getStudySetsForCurrentClass()
  if(!visibleSets.length){
    currentSetIndex = -1
    return
  }
  const currentEntry = visibleSets.find(function(entry){ return entry.index === currentSetIndex }) || null
  if(currentEntry && currentEntry.isAccessible) return
  const preferred = visibleSets.find(function(entry){ return entry.isAccessible }) || currentEntry || null
  currentSetIndex = preferred ? preferred.index : -1
}

function updateSetProgressContext(){
  const currentClass = getCurrentClass()
  const currentSet = getCurrentStudySet()
  if(!currentClass || !currentSet){
    progressKey = ''
    progress = { stage1: {}, stage2: {} }
    return
  }
  progressKey = baseProgressKey + '_' + sanitizeId(currentClass.id) + '_' + sanitizeId(currentSet.id)
  loadProgress()
}

function loadProgress(){
  if(!progressKey){
    progress = { stage1: {}, stage2: {} }
    return
  }
  try{
    const raw = localStorage.getItem(progressKey)
    if(raw){
      const parsed = JSON.parse(raw)
      progress = {
        stage1: parsed && parsed.stage1 && typeof parsed.stage1 === 'object' ? parsed.stage1 : {},
        stage2: parsed && parsed.stage2 && typeof parsed.stage2 === 'object' ? parsed.stage2 : {}
      }
      return
    }
  }catch(error){}
  progress = { stage1: {}, stage2: {} }
}

function saveProgress(){
  if(!progressKey) return
  try{ localStorage.setItem(progressKey, JSON.stringify(progress)) }catch(error){}
}

function getCurrentClass(){ return currentClassIndex >= 0 ? prepClasses[currentClassIndex] : null }
function getCurrentStudySet(){ return currentSetIndex >= 0 ? studySets[currentSetIndex] : null }

function getCurrentClassAssignments(studySet){
  const currentClass = getCurrentClass()
  if(!currentClass || !studySet) return null
  return studySet.classAssignments.find(function(assignment){ return assignment.classId === currentClass.id }) || null
}

function getStudySetsForCurrentClass(){
  const currentClass = getCurrentClass()
  if(!currentClass) return []
  return studySets.map(function(studySet, index){
    const assignment = studySet.classAssignments.find(function(item){ return item.classId === currentClass.id }) || null
    if(!assignment || !assignment.passageIndexes.length) return null
    const status = getStudySetStatus(studySet)
    return { index: index, studySet: studySet, assignment: assignment, status: status, isAccessible: status === 'active' || status === 'always' }
  }).filter(Boolean)
}

function getStudySetStatus(studySet){
  const today = getTodayStamp()
  const start = studySet && studySet.startDate ? studySet.startDate : ''
  const end = studySet && studySet.endDate ? studySet.endDate : ''
  if(!start && !end) return 'always'
  if(start && today < start) return 'upcoming'
  if(end && today > end) return 'ended'
  return 'active'
}

function isStudySetAccessible(studySet){
  const status = getStudySetStatus(studySet)
  return status === 'active' || status === 'always'
}

function getTodayStamp(){
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

function normalizeDateValue(value){
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function getStudySetDateText(studySet){
  const start = studySet && studySet.startDate ? studySet.startDate : ''
  const end = studySet && studySet.endDate ? studySet.endDate : ''
  if(start && end) return start + ' ~ ' + end
  if(start) return start + '부터'
  if(end) return end + '까지'
  return '상시 열림'
}

function getStudySetStatusLabel(status){
  if(status === 'active') return '진행 중'
  if(status === 'upcoming') return '예정'
  if(status === 'ended') return '종료'
  return '상시'
}

function simpleHash(text){
  let hash = 0
  const input = String(text || '')
  for(let i = 0; i < input.length; i += 1){
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function sanitizeId(value){ return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-') }

function escapeHtml(value){
  const div = document.createElement('div')
  div.textContent = String(value == null ? '' : value)
  return div.innerHTML
}

function showToast(message, color){
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.style.borderLeftColor = color || 'var(--blue)'
  toast.style.opacity = '1'
  toast.style.transform = 'translateX(-50%) translateY(0)'
  clearTimeout(showToast._timer)
  showToast._timer = setTimeout(function(){
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(-50%) translateY(20px)'
  }, 2200)
}
