function buildPassageState(source, index){
  const text = String(source && source.text || '').trim()
  const textLines = splitLines(text)
  const translationText = buildTranslationText(source, textLines)
  const title = getPassageTitle(source, index)
  const selectedLines = mapSelectedLines(source, textLines)
  const grammarSelections = normalizeGrammarSelections(source)
  const vocabRows = normalizeVocabRows(source)
  const questionAnswers = normalizeQuestionAnswers(source && source.questionAnswers || {})

  return {
    index: index,
    title: title,
    text: text,
    textLines: textLines,
    translationText: translationText,
    translationLines: splitLines(translationText),
    selectedLines: selectedLines,
    grammarSelections: grammarSelections,
    vocabRows: vocabRows,
    questionAnswers: questionAnswers,
    items: buildStudyItems({
      textLines: textLines,
      translationText: translationText,
      selectedLines: selectedLines,
      grammarSelections: grammarSelections,
      vocabRows: vocabRows,
      questionAnswers: questionAnswers
    })
  }
}

function splitLines(text){
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(function(line){ return line.trim() })
    .filter(Boolean)
}

function escapeHtml(text){
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegExp(text){
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightTextHtml(text, needle){
  const source = String(text || '')
  const target = String(needle || '').trim()
  if(!source) return ''
  if(!target) return escapeHtml(source)

  const pattern = new RegExp(escapeRegExp(target), 'g')
  let lastIndex = 0
  let matched = false
  let output = ''

  source.replace(pattern, function(match, offset){
    matched = true
    output += escapeHtml(source.slice(lastIndex, offset))
    output += '<span class="grammar-highlight">' + escapeHtml(match) + '</span>'
    lastIndex = offset + match.length
    return match
  })

  output += escapeHtml(source.slice(lastIndex))
  return matched ? output : escapeHtml(source)
}

function getGrammarSentence(passage, row){
  const lineIndex = Number(row && row.lineIndex)
  if(Number.isInteger(lineIndex) && lineIndex >= 0 && lineIndex < (passage.textLines || []).length){
    const line = passage.textLines[lineIndex] || ''
    if(line) return line
  }
  return String(row && row.context || '').trim() || String(row && row.text || '').trim()
}

function normalizeNumberList(list, max){
  const result = []
  const seen = new Set()
  ;(Array.isArray(list) ? list : []).forEach(function(value){
    const number = Number(value)
    if(Number.isInteger(number) && number >= 0 && number < max && !seen.has(number)){
      seen.add(number)
      result.push(number)
    }
  })
  return result.sort(function(a, b){ return a - b })
}

function getPassageTitle(passage, index){
  const raw = String(passage && (passage.title || passage.name) || '').trim()
  return raw || ('지문 ' + (index + 1))
}

function mapSelectedLines(passage, textLines){
  if(Array.isArray(passage && passage.selectedLines)){
    return normalizeNumberList(passage.selectedLines, textLines.length)
  }

  const selectedSents = Array.isArray(passage && passage.selectedSents) ? passage.selectedSents : []
  const usedIndexes = new Set()

  return selectedSents.map(function(sentence){
    const target = String(sentence || '').trim()
    if(!target) return -1

    let lineIndex = textLines.findIndex(function(line, idx){
      return !usedIndexes.has(idx) && line.trim() === target
    })

    if(lineIndex < 0){
      lineIndex = textLines.findIndex(function(line, idx){
        return !usedIndexes.has(idx) && line.indexOf(target) >= 0
      })
    }

    if(lineIndex >= 0) usedIndexes.add(lineIndex)
    return lineIndex
  }).filter(function(lineIndex){
    return lineIndex >= 0
  })
}

function buildTranslationText(passage, textLines){
  if(passage && typeof passage.translationText === 'string' && passage.translationText.trim()){
    return passage.translationText.trim()
  }

  const legacyAnswers = passage && passage.translationAnswers && typeof passage.translationAnswers === 'object'
    ? passage.translationAnswers
    : {}

  return textLines.map(function(line){
    return String(legacyAnswers[line] || '').trim()
  }).join('\n').trim()
}

function normalizeGrammarSelections(passage){
  const source = Array.isArray(passage && passage.grammarSelections)
    ? passage.grammarSelections
    : (Array.isArray(passage && passage.grammarRows) ? passage.grammarRows : [])

  return source.map(function(row){
    return {
      text: String(row && (row.text || row.point) || '').trim(),
      answer: String(row && row.answer || '').trim(),
      lineIndex: Number.isInteger(row && row.lineIndex) ? row.lineIndex : -1,
      context: String(row && row.context || '').trim()
    }
  }).filter(function(row){
    return row.text
  })
}

function normalizeVocabRows(passage){
  return (Array.isArray(passage && passage.vocabRows) ? passage.vocabRows : []).map(function(row){
    return {
      word: String(row && (row.word || row.lemma) || '').trim(),
      meaning: String(row && row.meaning || '').trim(),
      syn: String(row && row.syn || '').trim(),
      ant: String(row && row.ant || '').trim(),
      antMeaning: String(row && row.antMeaning || '').trim()
    }
  }).filter(function(row){
    return row.word
  })
}

function normalizeQuestionAnswers(source){
  return {
    topic: String(source && source.topic || '').trim()
  }
}

function buildStudyItems(passage){
  const items = []
  const translationLines = splitLines(passage && passage.translationText)

  ;(passage.selectedLines || []).forEach(function(lineIndex, idx){
    items.push({
      key: 'translate-' + idx,
      section: '문장 해석',
      type: 'translate',
      label: '해석 ' + (idx + 1),
      prompt: passage.textLines[lineIndex] || '',
      answer: translationLines[lineIndex] || '',
      context: ''
    })
  })

  ;(passage.grammarSelections || []).forEach(function(row, idx){
    const sentence = getGrammarSentence(passage, row)
    items.push({
      key: 'grammar-' + idx,
      section: '어법',
      type: 'grammar',
      label: '어법 포인트 ' + (idx + 1),
      prompt: '',
      promptHtml: highlightTextHtml(sentence, row.text),
      answer: row.answer,
      context: ''
    })
  })

  ;(passage.vocabRows || []).forEach(function(row, idx){
    items.push({
      key: 'vocab-' + idx,
      section: '동의어 / 반의어',
      type: 'vocab',
      label: '단어 ' + (idx + 1),
      prompt: row.word,
      answer: '',
      context: '원형을 보고 뜻, 동의어, 반의어, 반의어 뜻을 모두 말해 보세요.',
      vocab: row
    })
  })

  appendQaItem(items, 'topic', passage.questionAnswers)

  return items
}

function appendQaItem(items, field, questionAnswers){
  const answer = String(questionAnswers && questionAnswers[field] || '').trim()
  if(!answer) return

  const metaMap = {
    topic: {
      section: '대의 파악',
      label: '주제',
      prompt: ''
    }
  }

  const meta = metaMap[field]
  if(!meta) return

  items.push({
    key: 'qa-' + field,
    section: meta.section,
    type: 'qa',
    label: meta.label,
    prompt: meta.prompt,
    answer: answer,
    context: ''
  })
}
