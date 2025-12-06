import { useState, useEffect } from 'preact/hooks'
import './app.css'

interface Verse {
  id: number
  text: string
}

interface Surah {
  id: number
  name: string
  transliteration: string
  type: string
  total_verses: number
  verses: Verse[]
}

interface LetterData {
  letter: string
  count: number
  verses: {
    surahName: string
    surahId: number
    verseId: number
    verseText: string
  }[]
}

function getFirstLetter(text: string): string {
  // Remove diacritics and special characters to get the base letter
  const cleaned = text.trim()
  if (!cleaned) return ''

  // Get the first character
  let firstChar = cleaned[0]

  // Filter out common Arabic diacritics and special characters
  const diacritics = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g
  let letter = firstChar.replace(diacritics, '')

  // Normalize Arabic letters - treat variations as the same letter
  // Normalize Alef variations: إ أ ٱ ا ء -> ا
  if (letter === 'إ' || letter === 'أ' || letter === 'ٱ' || letter === 'ء') {
    letter = 'ا'
  }

  // Normalize other common variations
  // Taa Marbuta and Haa: ة -> ه
  if (letter === 'ة') {
    letter = 'ه'
  }

  // Yaa variations: ى -> ي
  if (letter === 'ى') {
    letter = 'ي'
  }

  return letter
}

function VerseItem({ verse, expanded, onToggle }: {
  verse: { surahName: string; surahId: number; verseId: number; verseText: string }
  expanded: boolean
  onToggle: () => void
}) {
  const MAX_LENGTH = 100
  const isTooLong = verse.verseText.length > MAX_LENGTH
  const displayText = expanded || !isTooLong
    ? verse.verseText
    : verse.verseText.substring(0, MAX_LENGTH) + '...'

  return (
    <div class="verse-item">
      <div class="verse-header">
        <strong>{verse.surahName}</strong> - آية {verse.verseId}
      </div>
      <div class="verse-text">
        {displayText}
        {isTooLong && (
          <button
            class="expand-button"
            onClick={onToggle}
          >
            {expanded ? 'عرض أقل' : 'عرض المزيد'}
          </button>
        )}
      </div>
    </div>
  )
}

function Modal({ letter, data, onClose }: {
  letter: string
  data: LetterData | null
  onClose: () => void
}) {
  const [expandedVerses, setExpandedVerses] = useState<Set<string>>(new Set())

  if (!data) return null

  const toggleVerse = (key: string) => {
    setExpandedVerses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>الآيات التي تبدأ بحرف "{letter}"</h2>
          <button class="close-button" onClick={onClose}>×</button>
        </div>
        <div class="modal-body">
          <p class="verse-count">عدد الآيات: {data.count}</p>
          <div class="verses-list">
            {data.verses.map((verse) => {
              const key = `${verse.surahId}-${verse.verseId}`
              return (
                <VerseItem
                  key={key}
                  verse={verse}
                  expanded={expandedVerses.has(key)}
                  onToggle={() => toggleVerse(key)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function App() {
  const [letterFrequency, setLetterFrequency] = useState<LetterData[]>([])
  const [selectedLetter, setSelectedLetter] = useState<LetterData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/quran.json')
        const surahs: Surah[] = await response.json()

        // Calculate frequency
        const frequencyMap = new Map<string, LetterData>()

        surahs.forEach(surah => {
          surah.verses.forEach(verse => {
            const firstLetter = getFirstLetter(verse.text)
            if (!firstLetter) return

            if (!frequencyMap.has(firstLetter)) {
              frequencyMap.set(firstLetter, {
                letter: firstLetter,
                count: 0,
                verses: []
              })
            }

            const data = frequencyMap.get(firstLetter)!
            data.count++
            data.verses.push({
              surahName: surah.name,
              surahId: surah.id,
              verseId: verse.id,
              verseText: verse.text
            })
          })
        })

        // Convert to array and sort by frequency (highest to lowest)
        const sorted = Array.from(frequencyMap.values())
          .sort((a, b) => b.count - a.count)

        setLetterFrequency(sorted)
        setLoading(false)
      } catch (error) {
        console.error('Error loading Quran data:', error)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const maxCount = letterFrequency.length > 0 ? letterFrequency[0].count : 1

  if (loading) {
    return <div class="loading">جاري التحميل...</div>
  }

  return (
    <div class="app">
      <header class="app-header">
        <h1>تكرار الحروف الأولى في آيات القرآن الكريم</h1>
        <p class="subtitle">انقر على أي شريط لعرض الآيات</p>
      </header>

      <div class="chart-container">
        {letterFrequency.map((data) => {
          const widthPercent = (data.count / maxCount) * 100

          return (
            <div
              key={data.letter}
              class="bar-row"
              onClick={() => setSelectedLetter(data)}
            >
              <div class="bar-label">{data.letter}</div>
              <div class="bar-wrapper">
                <div
                  class="bar"
                  style={{ width: `${widthPercent}%` }}
                >
                  <span class="bar-count">{data.count}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedLetter && (
        <Modal
          letter={selectedLetter.letter}
          data={selectedLetter}
          onClose={() => setSelectedLetter(null)}
        />
      )}
    </div>
  )
}
