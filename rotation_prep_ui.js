function showHome(){
  ensureCurrentSetSelection()
  updateSetProgressContext()
  renderClassSummary()
  renderSetScreen()
  activateScreen('home-screen')
}

function goBackFromSetScreen(){
  currentSetIndex = -1
  currentPassage = -1
  showClassScreen()
}

function showPassageScreen(){
  const currentSet = getCurrentStudySet()
  const assignment = currentSet ? getCurrentClassAssignments(currentSet) : null
  if(!currentSet || !assignment){
    goHome()
    return
  }
  renderClassSummary()
  renderPassageScreen()
  activateScreen('passage-screen')
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
  document.getElementById('set-back-btn').style.display = 'inline-flex'

  if(currentClass){
    document.getElementById('current-class-name').textContent = currentClass.name
    document.getElementById('current-class-meta').textContent = visibleSets.length + '개의 학습 세트가 연결되어 있습니다.'
  }else{
    document.getElementById('current-class-name').textContent = ''
    document.getElementById('current-class-meta').textContent = ''
  }

  document.getElementById('passage-bar').style.display = currentSet ? 'flex' : 'none'
  if(currentSet){
    document.getElementById('current-set-name').textContent = currentSet.title
    document.getElementById('current-set-meta').textContent = getStudySetDateText(currentSet)
  }else{
    document.getElementById('current-set-name').textContent = ''
    document.getElementById('current-set-meta').textContent = ''
  }
}

function renderDash(){
  renderSetScreen()
  if(getCurrentStudySet()) renderPassageScreen()
}

function renderSetScreen(){
  const visibleSets = getStudySetsForCurrentClass()
  const activeCount = visibleSets.filter(function(entry){ return entry.status === 'active' || entry.status === 'always' }).length
  const upcomingCount = visibleSets.filter(function(entry){ return entry.status === 'upcoming' }).length
  const endedCount = visibleSets.filter(function(entry){ return entry.status === 'ended' }).length

  document.getElementById('stats').innerHTML = [
    renderStat(visibleSets.length, '세트'),
    renderStat(activeCount, '진행 중'),
    renderStat(upcomingCount, '예정'),
    renderStat(endedCount, '종료')
  ].join('')

  renderSetList(visibleSets)
}

function renderPassageScreen(){
  const currentSet = getCurrentStudySet()
  const assignment = currentSet ? getCurrentClassAssignments(currentSet) : null
  const container = document.getElementById('p-list')

  if(!currentSet || !assignment){
    container.innerHTML = '<div class="empty-box">먼저 학습 세트를 선택해 주세요.</div>'
    document.getElementById('passage-stats').innerHTML = ''
    return
  }

  const totalQuestions = assignment.passageIndexes.reduce(function(sum, passageIndex){
    return sum + (currentSet.passages[passageIndex] ? currentSet.passages[passageIndex].items.length : 0)
  }, 0)
  const doneCount = assignment.passageIndexes.filter(function(passageIndex){
    return getPassageProgress(passageIndex).done
  }).length

  document.getElementById('passage-stats').innerHTML = [
    renderStat(assignment.passageIndexes.length, '지문'),
    renderStat(totalQuestions, '질문'),
    renderStat(doneCount, '완료'),
    renderStat(Math.max(assignment.passageIndexes.length - doneCount, 0), '남음')
  ].join('')

  document.getElementById('passage-list-label').textContent = currentSet.title + ' 지문 선택'

  if(!isStudySetAccessible(currentSet)){
    container.innerHTML = '<div class="empty-box">이 학습 세트는 아직 열리지 않았거나 기간이 종료되었습니다.</div>'
    return
  }

  container.innerHTML = assignment.passageIndexes.map(function(passageIndex, visibleIndex){
    const passage = currentSet.passages[passageIndex]
    const state = getPassageProgress(passageIndex)
    const preview = passage.textLines[0] || passage.text.slice(0, 80) || '본문 미리보기가 없습니다.'

    return '' +
      '<div class="p-item ' + (state.done ? 'done' : '') + '" onclick="openPassage(' + passageIndex + ')">' +
        '<div class="p-num">' + (visibleIndex + 1) + '</div>' +
        '<div class="p-body">' +
          '<div class="p-title">' + escapeHtml(passage.title) + '</div>' +
          '<div class="p-preview">' + escapeHtml(preview) + '</div>' +
          '<div class="p-meta">' +
            '<span><b>' + passage.items.length + '</b>개 질문</span>' +
            '<span>' + passage.textLines.length + '줄</span>' +
          '</div>' +
          '<div class="p-stage">' + renderProgressChip(state.done) + '</div>' +
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
            '<span class="set-badge">' + entry.assignment.passageIndexes.reduce(function(sum, passageIndex){
              return sum + (entry.studySet.passages[passageIndex] ? entry.studySet.passages[passageIndex].items.length : 0)
            }, 0) + '개 질문</span>' +
          '</div>' +
        '</div>' +
        '<div class="p-arrow">' + (entry.isAccessible ? '&rsaquo;' : '예정') + '</div>' +
      '</div>'
  }).join('')
}

function openStudySet(index){
  const studySet = studySets[index]
  if(!studySet || !isStudySetAccessible(studySet)) return
  currentSetIndex = index
  currentPassage = -1
  updateSetProgressContext()
  renderClassSummary()
  renderPassageScreen()
  activateScreen('passage-screen')
}

function openPassage(index){
  const studySet = getCurrentStudySet()
  if(!studySet || !studySet.passages[index]) return
  currentPassage = index
  renderStudy()
  activateScreen('study-screen')
}

function goHome(){
  currentPassage = -1
  renderClassSummary()
  renderSetScreen()
  activateScreen('home-screen')
}

function togglePassage(){
  const box = document.getElementById('p-box')
  box.classList.toggle('expanded')
  document.getElementById('p-toggle').textContent = box.classList.contains('expanded') ? '접기' : '더 보기'
}

function renderStudy(){
  const studySet = getCurrentStudySet()
  const passage = studySet && studySet.passages[currentPassage]
  if(!studySet || !passage){
    showPassageScreen()
    return
  }

  document.getElementById('s-title').textContent = passage.title
  document.getElementById('s-cnt').textContent = passage.items.length + '문제'
  document.getElementById('study-meta').textContent = studySet.title + ' · ' + getStudySetDateText(studySet)
  document.getElementById('p-txt').textContent = passage.text || '본문이 없습니다.'
  document.getElementById('p-box').classList.remove('expanded')
  document.getElementById('p-toggle').textContent = '더 보기'
  document.getElementById('stage-panel').innerHTML = renderStagePanel()

  const sections = groupItems(passage.items)
  document.getElementById('stage-content').innerHTML = sections.length
    ? sections.map(function(section){
        return renderSection(section)
      }).join('')
    : '<div class="empty-box">이 지문에는 학습할 질문이 없습니다.</div>'

  renderStageActions()
}

function renderStagePanel(){
  return ''
}

function groupItems(items){
  const configs = [
    { id: 'big-picture', title: '대의 파악' },
    { id: 'translation', title: '해석' },
    { id: 'vocab', title: '동의어 / 반의어' },
    { id: 'grammar', title: '어법' }
  ]

  const buckets = new Map()
  configs.forEach(function(config){
    buckets.set(config.id, [])
  })

  ;(Array.isArray(items) ? items : []).forEach(function(item, index){
    const groupId = getStudyItemGroupId(item)
    if(!buckets.has(groupId)) return
    buckets.get(groupId).push({ item: item, originalIndex: index })
  })

  return configs.map(function(config){
    const wrappedItems = buckets.get(config.id) || []
    wrappedItems.sort(function(a, b){
      const orderDiff = getStudyItemSortOrder(a.item) - getStudyItemSortOrder(b.item)
      return orderDiff || (a.originalIndex - b.originalIndex)
    })
    return {
      title: config.title,
      items: wrappedItems.map(function(entry){ return entry.item })
    }
  }).filter(function(group){
    return group.items.length > 0
  })
}

function getStudyItemGroupId(item){
  if(item && item.group) return item.group
  if(item && item.type === 'translate') return 'translation'
  if(item && item.type === 'vocab') return 'vocab'
  if(item && item.type === 'grammar') return 'grammar'
  return 'big-picture'
}

function getStudyItemSortOrder(item){
  const key = String(item && item.key || '')
  if(key.indexOf('qa-topic') === 0) return 1
  return 20
}

function renderSection(section){
  return '' +
    '<section class="group">' +
      '<div class="group-title">' +
        '<h3>' + escapeHtml(section.title) + '</h3>' +
        '<span class="group-count">' + section.items.length + '</span>' +
      '</div>' +
      '<div class="item-list">' +
        section.items.map(function(item){
          return item.type === 'vocab' ? renderStudyVocab(item) : renderStudyItem(item)
        }).join('') +
      '</div>' +
    '</section>'
}

function renderStudyItem(item){
  const promptHtml = item && item.promptHtml
    ? '<div class="item-prompt">' + item.promptHtml + '</div>'
    : (item && item.prompt ? '<div class="item-prompt">' + escapeHtml(item.prompt) + '</div>' : '')
  const contextHtml = item && item.contextHtml
    ? '<div class="item-context">' + item.contextHtml + '</div>'
    : (item && item.context ? '<div class="item-context">' + escapeHtml(item.context) + '</div>' : '')
  return '' +
    '<div class="item-card">' +
      '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
      promptHtml +
      contextHtml +
      renderAnswerSheet(item.answer) +
    '</div>'
}

function renderStudyVocab(item){
  const vocab = item.vocab || {}
  return '' +
    '<div class="item-card">' +
      '<div class="item-label">' + escapeHtml(item.label) + '</div>' +
      '<div class="vocab-word">' + escapeHtml(vocab.word || '') + '</div>' +
      renderAnswerSheet('', renderVocabAnswerGrid(vocab)) +
    '</div>'
}

function renderAnswerSheet(answerText, customInnerHtml){
  return '' +
    '<div class="answer-sheet">' +
      '<div class="answer-title">정답 확인</div>' +
      (typeof customInnerHtml === 'string'
        ? customInnerHtml
        : '<div class="answer-text">' + renderAnswerText(answerText, '등록된 정답이 없습니다.') + '</div>') +
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
    done: !!(progress.done && progress.done[passageIndex])
  }
}

function renderStageActions(){
  const state = getPassageProgress(currentPassage)
  document.getElementById('stage-actions').innerHTML =
    '<button class="btn ' + (state.done ? 'btn-ghost' : 'btn-green') + '" type="button" onclick="markPassageDone()">' +
      (state.done ? '학습 완료 취소' : '이 지문 학습 완료') +
    '</button>'
}

function markPassageDone(){
  if(currentPassage < 0) return
  if(!progress.done || typeof progress.done !== 'object') progress.done = {}
  const nextDone = !progress.done[currentPassage]
  progress.done[currentPassage] = nextDone
  saveProgress()
  renderStudy()
  renderPassageScreen()
  showToast(nextDone ? '이 지문을 학습 완료로 표시했습니다.' : '이 지문의 학습 완료 표시를 취소했습니다.', 'var(--green)')
}

function renderStat(value, label){
  return '' +
    '<div class="stat">' +
      '<div class="stat-n">' + escapeHtml(String(value)) + '</div>' +
      '<div class="stat-l">' + escapeHtml(label) + '</div>' +
    '</div>'
}

function renderStatusBadge(done){
  return '<span class="stage-chip ' + (done ? 'done' : '') + '">' + (done ? '학습 완료' : '학습 중') + '</span>'
}

function renderProgressChip(done){
  return '<span class="stage-chip ' + (done ? 'done' : '') + '">' + (done ? '완료' : '진행 중') + '</span>'
}

function resetProgress(){
  const currentClass = getCurrentClass()
  const currentSet = getCurrentStudySet()
  const prefix = currentClass ? '[' + currentClass.name + '] ' : ''
  const setTitle = currentSet ? currentSet.title : '현재 세트'

  if(!window.confirm(prefix + setTitle + '의 학습 기록을 초기화할까요?')) return

  progress = { done: {} }
  saveProgress()
  renderPassageScreen()
  if(document.getElementById('study-screen').classList.contains('active')) renderStudy()
  showToast('학습 기록을 초기화했습니다.', 'var(--green)')
}
