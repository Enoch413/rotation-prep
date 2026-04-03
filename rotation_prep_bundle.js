function normalizeBundleData(data){
  const source = data && typeof data === 'object' ? data : {}
  const prepConfig = {
    pageTitle: String((source.prepConfig && source.prepConfig.pageTitle) || source.pageTitle || APP_CONFIG.defaultTitle).trim() || APP_CONFIG.defaultTitle,
    globalPassword: String((source.prepConfig && source.prepConfig.globalPassword) || source.password || '').trim(),
    generatedAt: String((source.prepConfig && source.prepConfig.generatedAt) || source.savedAt || source.updatedAt || '').trim()
  }

  if(Array.isArray(source.studySets) && source.studySets.length){
    const classes = normalizeBundleClasses(source.classes, source.studySets)
    const studySets = source.studySets.map(function(studySet, index){
      return normalizeStudySet(studySet, index, classes)
    }).filter(function(studySet){
      return studySet.passages.length > 0 && studySet.classAssignments.length > 0
    })

    return {
      version: Number(source.version || source.bundleVersion || 1),
      prepConfig: prepConfig,
      classes: classes,
      studySets: studySets
    }
  }

  const classes = normalizeLegacyClasses(source.prepClasses)
  const finalClasses = classes.length ? classes : [{ id: 'class-1', name: '전체', password: '' }]
  const passages = Array.isArray(source.passages) ? source.passages : []
  const assignments = Array.isArray(source.prepClasses) && source.prepClasses.length
    ? source.prepClasses.map(function(classInfo, index){
        return {
          classId: finalClasses[index] ? finalClasses[index].id : ('class-' + (index + 1)),
          passageIndexes: normalizeNumberList(classInfo && classInfo.passageIndexes, passages.length)
        }
      }).filter(function(assignment){
        return assignment.passageIndexes.length > 0
      })
    : [{ classId: finalClasses[0].id, passageIndexes: Array.from({ length: passages.length }, function(_, index){ return index }) }]

  return {
    version: Number(source.version || 1),
    prepConfig: prepConfig,
    classes: finalClasses,
    studySets: [normalizeStudySet({
      id: 'set-1',
      title: prepConfig.pageTitle || '학습 세트 1',
      sourceName: '',
      startDate: '',
      endDate: '',
      savedAt: String(source.savedAt || '').trim(),
      questionCounts: source.questionCounts || {},
      passages: passages,
      classAssignments: assignments
    }, 0, finalClasses)]
  }
}

function normalizeBundleClasses(sourceClasses, studySetSources){
  const classes = []
  const seen = new Set()

  ;(Array.isArray(sourceClasses) ? sourceClasses : []).slice(0, 8).forEach(function(classInfo, index){
    const normalized = normalizeClassInfo(classInfo, index)
    if(!normalized || seen.has(normalized.id)) return
    seen.add(normalized.id)
    classes.push(normalized)
  })

  if(classes.length) return classes

  ;(Array.isArray(studySetSources) ? studySetSources : []).forEach(function(studySet){
    ;(Array.isArray(studySet && studySet.prepClasses) ? studySet.prepClasses : []).forEach(function(classInfo, index){
      const normalized = normalizeClassInfo(classInfo, index)
      if(!normalized || seen.has(normalized.id)) return
      seen.add(normalized.id)
      classes.push(normalized)
    })
  })

  return classes.length ? classes.slice(0, 8) : [{ id: 'class-1', name: '전체', password: '' }]
}

function normalizeLegacyClasses(source){
  return (Array.isArray(source) ? source : []).slice(0, 8).map(function(classInfo, index){
    return normalizeClassInfo(classInfo, index)
  }).filter(Boolean)
}

function normalizeClassInfo(classInfo, index){
  const id = sanitizeId(String(classInfo && classInfo.id || ('class-' + (index + 1))))
  if(!id) return null
  return {
    id: id,
    name: String(classInfo && classInfo.name || ((index + 1) + '반')).trim() || ((index + 1) + '반'),
    password: String(classInfo && classInfo.password || '').trim()
  }
}

function normalizeStudySet(source, index, classes){
  const passages = Array.isArray(source && source.passages) ? source.passages.map(function(passage, passageIndex){
    return buildPassageState(passage, passageIndex)
  }) : []

  return {
    id: sanitizeId(String(source && source.id || ('set-' + (index + 1)))) || ('set-' + (index + 1)),
    title: String(source && (source.title || source.name) || ('학습 세트 ' + (index + 1))).trim() || ('학습 세트 ' + (index + 1)),
    sourceName: String(source && source.sourceName || '').trim(),
    startDate: normalizeDateValue(source && source.startDate),
    endDate: normalizeDateValue(source && source.endDate),
    savedAt: String(source && source.savedAt || '').trim(),
    questionCounts: source && typeof source.questionCounts === 'object' ? source.questionCounts : {},
    passages: passages,
    classAssignments: normalizeStudySetAssignments(source, classes, passages.length)
  }
}

function normalizeStudySetAssignments(source, classes, passageCount){
  const allIndexes = Array.from({ length: passageCount }, function(_, index){ return index })

  if(Array.isArray(source && source.classAssignments)){
    return source.classAssignments.map(function(assignment){
      return {
        classId: sanitizeId(String(assignment && assignment.classId || '')),
        passageIndexes: normalizeNumberList(assignment && assignment.passageIndexes, passageCount)
      }
    }).filter(function(assignment){
      return assignment.classId && assignment.passageIndexes.length > 0
    })
  }

  if(Array.isArray(source && source.prepClasses)){
    return source.prepClasses.map(function(classInfo, index){
      const fallbackClass = classes[index]
      return {
        classId: sanitizeId(String(classInfo && classInfo.id || (fallbackClass && fallbackClass.id) || ('class-' + (index + 1)))),
        passageIndexes: normalizeNumberList(classInfo && classInfo.passageIndexes, passageCount)
      }
    }).filter(function(assignment){
      return assignment.classId && assignment.passageIndexes.length > 0
    })
  }

  return classes.length ? [{ classId: classes[0].id, passageIndexes: allIndexes }] : []
}
