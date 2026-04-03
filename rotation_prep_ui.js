function showHome(){
  ensureCurrentSetSelection()
  updateSetProgressContext()
  renderClassSummary()
  renderDash()
  activateScreen('home-screen')
}

function renderClassList(){
  const container = document.getElementById('class-list')
  if(!prepClasses.length){
    container.innerHTML = '<div class="empty-box">반 정보가 없습니다.</div>'
    return
  }

  container.innerHTML = prepClasses.map(function(classInfo, index){
    const studyCount = studySets.filter(function(studySet){
      return studySet.classAssignments.some(function(assignment){
        return assignment.classId === classInfo.id && assignment.passageIndexes.length > 0
      })
    }).length

    return '' +
      '<div class="class-item" onclick="requestClassAccess(' + index + ')">' +
        '<div class="class-num">' + (index + 1) + '</div>' +
        '<div class="class-body">' +
          '<div class="class-title">' + escapeHtml(classInfo.name) + '</div>' +
          '<div class="class-preview">' + studyCount + '개의 학습 세트가 준비되어 있습니다.</div>' +
          '<div class="class-tags">' +
            '<span class="class-tag">세트 ' + studyCount + '</span>' +
            '<span class="class-tag">' + (classInfo.password ? '비밀번호 있음' : '바로 입장') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="p-arrow">&rsaquo;</div>' +
      '</div>'
  }).join('')
}

function renderClassSummary(){
  const currentClass = getCurrentClass()
  const currentSet = getCurrentStudySet()
  const visibleSets = getStudySetsForCurrentClass()

  document.getElementById('class-bar').style.display = currentClass ? 'flex' : 'none'
  document.getElementById('change-class-btn').style.display = prepClasses.length > 1 ? 'inline-flex' : 'none'
  document.getElementById('study-class-btn').style.display = prepClasses.length > 1 ? 'inline-flex' : 'none'

  if(currentClass){
    document.getElementById('current-class-name').textContent = currentClass.name
    document.getElementById('current-class-meta').textContent = visibleSets.length + '개의 학습 세트가 연결되어 있습니다.'
  }

  document.getElementById('set-bar').style.display = currentSet ? 'flex' : 'none'
  if(currentSet){
    document.getElementById('current-set-name').textContent = currentSet.title
    document.getElementById('current-set-meta').textContent = getStudySetDateText(currentSet)
  }
}

function renderDash(){
  const visibleSets = getStudySetsForCurrentClass()
  const currentSet = getCurrentStudySet()
  const currentAssignment = currentSet ? getCurrentClassAssignments(currentSet) : null

  const activeCount = visibleSets.filter(function(entry){ return entry.status === 'active' || entry.status === 'always' }).length
  const upcomingCount = visibleSets.filter(function(entry){ return entry.status === 'upcoming' }).length
  const endedCount = visibleSets.filter(function(entry){ return entry.status === 'ended' }).length

  document.getElementById('stats').innerHTML = currentSet && currentAssignment
    ? [
        renderStat(currentAssignment.passageIndexes.length, '지문'),
        renderStat(currentAssignment.passageIndexes.reduce(function(sum, index){
          return sum + (currentSet.passages[index] ? currentSet.passages[index].items.length : 0)
        }, 0), '학습 카드'),
        renderStat(currentAssignment.passageIndexes.filter(function(index){ return !!progress.stage1[index] }).length + '/' + currentAssignment.passageIndexes.length, '1단계'),
        renderStat(currentAssignment.passageIndexes.filter(function(index){ return !!progress.stage2[index] }).length + '/' + currentAssignment.passageIndexes.length, '2단계')
      ].join('')
    : [
        renderStat(visibleSets.length, '세트'),
        renderStat(activeCount, '진행 중'),
        renderStat(upcomingCount, '예정'),
        renderStat(endedCount, '종료')
      ].join('')

  renderSetList(visibleSets)

  const passageSection = document.getElementById('passage-section')
  const resetButton = document.getElementById('reset-progress-btn')

  if(!currentSet || !currentAssignment){
    passageSection.style.display = 'none'
    resetButton.disabled = true
    document.getElementById('p-list').innerHTML = ''
    return
  }

  passageSection.style.display = 'block'
  resetButton.disabled = false
  document.getElementById('passage-list-label').textContent = currentSet.title + ' 지문'

  if(!isStudySetAccessible(currentSet)){
    document.getElementById('p-list').innerHTML = '<div class="empty-box">이 학습 세트는 아직 열리지 않았거나 기간이 종료되었습니다.</div>'
    return
  }

  document.getElementById('p-list').innerHTML = currentAssignment.passageIndexes.map(function(passageIndex, visibleIndex){
    const passage = currentSet.passages[passageIndex]
    const state = getPassageProgress(passageIndex)
    const preview = passage.textLines[0] || passage.text.slice(0, 80) || '본문 미리보기가 없습니다.'

    return '' +
      '<div class="p-item ' + (state.doneCount === 2 ? 'done' : '') + '" onclick="openPassage(' + passageIndex + ')">' +
        '<div class="p-num">' + (visibleIndex + 1) + '</div>' +
        '<div class="p-body">' +
          '<div class="p-title">' + escapeHtml(passage.title) + '</div>' +
          '<div class="p-preview">' + escapeHtml(preview) + '</div>' +
          '<div class="p-meta">' +
            '<span><b>' + passage.items.length + '</b>개 질문</span>' +
            '<span>' + passage.textLines.length + '줄</span>' +
          '</div>' +
          '<div class="p-stage">' + renderStageChip('1단계', state.stage1Done) + renderStageChip('2단계', state.stage2Done) + '</div>' +
        '</div>' +
        '<div class="p-arrow">&rsaquo;</div>' +
      '</div>'
  }).join('')
}

function renderSetList(visibleSets){
  const container = document.getElementById('set-list')
  if(!visibleSets.length){
    container.innerHTML = '<div class="empty-box">이 반에 배정된 학습 세트가 없습니다.</div>'
    return
  }

  container.innerHTML = visibleSets.map(function(entry, visibleIndex){
    const classNames = ['set-item']
    if(entry.index === currentSetIndex) classNames.push('active')
    if(!entry.isAccessible) classNames.push('disabled')

    return '' +
      '<div class="' + classNames.join(' ') + '"' + (entry.isAccessible ? ' onclick="openStudySet(' + entry.index + ')"' : '') + '>' +
        '<div class="set-num">' + (visibleIndex + 1) + '</div>' +
        '<div class="set-body">' +
          '<div class="set-title">' + escapeHtml(entry.studySet.title) + '</div>' +
          '<div class="set-preview">' + escapeHtml(getStudySetDateText(entry.studySet)) + '</div>' +
          '<div class="set-meta">' +
            '<span class="set-badge ' + entry.status + '">' + escapeHtml(getStudySetStatusLabel(entry.status)) + '</span>' +
            '<span class="set-badge">' + entry.assignment.passageIndexes.length + '개 지문</span>' +
            '<span class="set-badge">' + entry.assignment.passageIndexes.reduce(function(sum, index){
              return sum + (entry.studySet.passages[index] ? entry.studySet.passages[index].items.length : 0)
            }, 0) + '개 질문</span>' +
          '</div>' +
        '</div>' +
        '<div class="p-arrow">' + (entry.isAccessible ? '&rsaquo;' : '닫힘') + '</div>' +
      '</div>'
  }).join('')
}

function openStudySet(index){
  const studySet = studySets[index]
  if(!studySet || !isStudySetAccessible(studySet)) return
  currentSetIndex = index
  currentPassage = -1
  currentStage = 'study'
  updateSetProgressContext()
  renderClassSummary()
  renderDash()
}

function openPassage(index){
  const studySet = getCurrentStudySet()
  if(!studySet || !studySet.passages[index]) return
  currentPassage = index
  currentStage = 'study'
  activateScreen('study-screen')
  renderStudy()
}

function goHome(){
  showHome()
}

function togglePassage(){
  const box = document.getElementById('p-box')
  box.classList.toggle('expanded')
  document.getElementById('p-toggle').textContent = box.classList.contains('expanded') ? '접기' : '더 보기'
}

function switchStage(stage){
  currentStage = stage === 'practice' ? 'practice' : 'study'
  renderStudy()
}

function renderStudy(){
  const studySet = getCurrentStudySet()
  const passage = studySet && studySet.passages[currentPassage]
  if(!studySet || !passage) return

  document.getElementById('s-title').textContent = passage.title
  document.getElementById('s-cnt').textContent = passage.items.length + '문제'
  document.getElementById('study-meta').textContent = studySet.title + ' · ' + getStudySetDateText(studySet)
  document.getElementById('p-txt').textContent = passage.text || '본문이 없습니다.'
  document.getElementById('p-box').classList.remove('expanded')
  document.getElementById('p-toggle').textContent = '더 보기'
  document.getElementById('stage-btn-study').classList.toggle('active', currentStage === 'study')
  document.getElementById('stage-btn-practice').classList.toggle('active', currentStage === 'practice')
  document.getElementById('stage-desc').textContent = currentStage === 'study'
    ? '1단계에서는 정답과 함께 모든 문제를 먼저 공부합니다.'
    : '2단계에서는 스스로 답해 보고 필요할 때만 정답을 확인합니다.'

  const sections = groupItems(passage.items)
  document.getElementById('stage-content').innerHTML = sections.length
    ? sections.map(function(section){
        return renderSection(section, currentStage)
      }).join('')
    : '<div class="empty-box">이 지문에는 학습할 문제가 없습니다.</div>'

  renderStageActions()
}

function groupItems(items){
  const order = ['문장 해석', '어법', '동의어 / 반의어', '대의 파악', '한 문장 요약', '전체 내용 파악']
  const groups = new Map()

  items.forEach(function(item){
    if(!groups.has(item.section)) groups.set(item.section, [])
    groups.get(item.section).push(item)
  })

  return order.filter(function(section){
    return groups.has(section)
  }).map(function(section){
    return { section: section, items: groups.get(section) }
  })
}

function renderSection(section, stage){
  return '' +
    '<section class="group">' +
      '<div class="group-title">' +
        '<h3>' + escapeHtml(section.section) + '</h3>' +
        '<span class="group-count">' + section.items.length + '</span>' +
      '</div>' +
      '<div class="item-list">' +
        section.items.map(function(item, index){
          return stage === 'study' ? renderStudyItem(item) : renderPracticeItem(item, index)
        }).join('') +
      '</div>' +
    '</section>'
}

function renderStudyItem(item){
  if(item.type === 'vocab') return renderStudyVocab(item)

  return '' +
    '<div class="item-card">' +
      '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
      '<div class="item-prompt">' + escapeHtml(item.prompt) + '</div>' +
      (item.context ? '<div class="item-context">' + escapeHtml(item.context) + '</div>' : '') +
      renderAnswerSheet(item.answer) +
    '</div>'
}

function renderStudyVocab(item){
  const vocab = item.vocab || {}
  return '' +
    '<div class="item-card">' +
      '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
      '<div class="vocab-word">' + escapeHtml(vocab.word || '') + '</div>' +
      '<div class="item-prompt">원형을 보고 뜻, 동의어, 반의어, 반의어 뜻을 함께 익혀 보세요.</div>' +
      renderAnswerSheet('', renderVocabAnswerGrid(vocab)) +
    '</div>'
}

function renderPracticeItem(item, index){
  if(item.type === 'vocab') return renderPracticeVocab(item, index)

  const answerId = 'answer-' + currentPassage + '-' + sanitizeId(item.key) + '-' + index
  return '' +
    '<div class="item-card">' +
      '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
      '<div class="item-prompt">' + escapeHtml(item.prompt) + '</div>' +
      (item.context ? '<div class="item-context">' + escapeHtml(item.context) + '</div>' : '') +
      '<div class="practice-box"><textarea placeholder="직접 답을 적어 보세요."></textarea></div>' +
      '<div class="inline-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="toggleInlineAnswer(\'' + answerId + '\')">정답 보기</button></div>' +
      '<div class="inline-answer" id="' + answerId + '">' + renderAnswerSheet(item.answer) + '</div>' +
    '</div>'
}

function renderPracticeVocab(item, index){
  const vocab = item.vocab || {}
  const answerId = 'answer-' + currentPassage + '-' + sanitizeId(item.key) + '-' + index
  return '' +
    '<div class="item-card">' +
      '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
      '<div class="vocab-word">' + escapeHtml(vocab.word || '') + '</div>' +
      '<div class="item-prompt">뜻, 동의어, 반의어, 반의어 뜻을 직접 적어 보세요.</div>' +
      '<div class="practice-box"><textarea placeholder="뜻 / 동의어 / 반의어 / 반의어 뜻"></textarea></div>' +
      '<div class="inline-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="toggleInlineAnswer(\'' + answerId + '\')">정답 보기</button></div>' +
      '<div class="inline-answer" id="' + answerId + '">' + renderAnswerSheet('', renderVocabAnswerGrid(vocab)) + '</div>' +
    '</div>'
}

function renderAnswerSheet(answerText, customInnerHtml){
  return '' +
    '<div class="answer-sheet">' +
      '<div class="answer-title">정답</div>' +
      (typeof customInnerHtml === 'string'
        ? customInnerHtml
        : '<div class="answer-text">' + renderAnswerText(answerText, '저장된 정답이 없습니다.') + '</div>') +
    '</div>'
}

function renderAnswerText(text, emptyMessage){
  const trimmed = String(text || '').trim()
  return trimmed
    ? escapeHtml(trimmed).replace(/\n/g, '<br>')
    : ('<span class="missing">' + escapeHtml(emptyMessage) + '</span>')
}

function renderVocabAnswerGrid(vocab){
  return '' +
    '<div class="answer-grid">' +
      renderAnswerChip('뜻', vocab.meaning, '없음') +
      renderAnswerChip('동의어', vocab.syn, '없음') +
      renderAnswerChip('반의어', vocab.ant, '없음') +
      renderAnswerChip('반의어 뜻', vocab.antMeaning, '없음') +
    '</div>'
}

function renderAnswerChip(label, value, emptyMessage){
  return '' +
    '<div class="answer-chip">' +
      '<div class="answer-chip-label">' + escapeHtml(label) + '</div>' +
      '<div class="answer-chip-text">' + renderAnswerText(value, emptyMessage) + '</div>' +
    '</div>'
}

function getPassageProgress(passageIndex){
  return {
    stage1Done: !!progress.stage1[passageIndex],
    stage2Done: !!progress.stage2[passageIndex],
    doneCount: (progress.stage1[passageIndex] ? 1 : 0) + (progress.stage2[passageIndex] ? 1 : 0)
  }
}

function renderStageActions(){
  const status = getPassageProgress(currentPassage)
  document.getElementById('stage-actions').innerHTML = currentStage === 'study'
    ? '<button class="btn btn-green" type="button" onclick="markStageDone(\'stage1\')">' + (status.stage1Done ? '1단계 완료 유지' : '1단계 완료') + '</button><button class="btn btn-ghost" type="button" onclick="switchStage(\'practice\')">2단계로 이동</button>'
    : '<button class="btn btn-blue" type="button" onclick="markStageDone(\'stage2\')">' + (status.stage2Done ? '2단계 완료 유지' : '2단계 완료') + '</button><button class="btn btn-ghost" type="button" onclick="switchStage(\'study\')">1단계로 돌아가기</button>'
}

function markStageDone(stageKey){
  if(currentPassage < 0) return
  progress[stageKey][currentPassage] = true
  saveProgress()
  renderStudy()
  renderDash()
  showToast((stageKey === 'stage1' ? '1단계' : '2단계') + ' 학습 기록을 저장했습니다.', 'var(--green)')
}

function renderStat(value, label){
  return '' +
    '<div class="stat">' +
      '<div class="stat-n">' + escapeHtml(String(value)) + '</div>' +
      '<div class="stat-l">' + escapeHtml(label) + '</div>' +
    '</div>'
}

function renderStageChip(label, done){
  return '<span class="stage-chip ' + (done ? 'done' : '') + '">' + escapeHtml(label) + ' ' + (done ? '완료' : '대기') + '</span>'
}

function toggleInlineAnswer(id){
  const element = document.getElementById(id)
  if(element) element.classList.toggle('show')
}

function resetProgress(){
  const currentClass = getCurrentClass()
  const currentSet = getCurrentStudySet()
  const prefix = currentClass ? '[' + currentClass.name + '] ' : ''
  const setTitle = currentSet ? currentSet.title : '현재 세트'

  if(!window.confirm(prefix + setTitle + '의 학습 기록을 초기화할까요?')) return

  progress = { stage1: {}, stage2: {} }
  saveProgress()
  renderDash()
  if(document.getElementById('study-screen').classList.contains('active')) renderStudy()
  showToast('학습 기록을 초기화했습니다.', 'var(--green)')
}
