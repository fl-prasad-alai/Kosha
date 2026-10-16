import type { QuestionId } from './types.ts'

export interface Question {
  id: QuestionId
  english: string
  local: Record<string, string>
}

export const QUESTIONS: Question[] = [
  {
    id: 'years',
    english: 'How long have you been running this shop?',
    local: {
      hi: 'आप यह दुकान कितने साल से चला रहे हैं?',
      tl: 'Gaano na po katagal ninyong pinapatakbo ang tindahan?',
      id: 'Sudah berapa lama Ibu/Bapak menjalankan warung ini?',
      mr: 'तुम्ही हे दुकान किती वर्षांपासून चालवत आहात?',
    },
  },
  {
    id: 'suppliers',
    english: 'Who are your main suppliers, and how often do you buy from them?',
    local: {
      hi: 'आप माल किन थोक व्यापारियों से लेते हैं, और कितनी बार?',
      tl: 'Saan po kayo kumukuha ng paninda, at gaano kadalas?',
      id: 'Dari mana Ibu/Bapak belanja barang, dan seberapa sering?',
      mr: 'तुम्ही माल कोणत्या घाऊक व्यापाऱ्यांकडून आणि किती वेळा घेता?',
    },
  },
  {
    id: 'busy',
    english: 'Which days and seasons are busiest for you?',
    local: {
      hi: 'आपकी दुकान पर सबसे ज़्यादा भीड़ कब होती है? कौन से दिन और त्योहार?',
      tl: 'Kailan po pinakamabenta ang tindahan? Anong araw at panahon?',
      id: 'Kapan warung paling ramai? Hari apa dan musim apa?',
      mr: 'तुमच्या दुकानात सर्वात जास्त गर्दी कधी असते? कोणते दिवस आणि सण?',
    },
  },
  {
    id: 'credit',
    english: 'How much do your customers owe you on credit right now?',
    local: {
      hi: 'अभी ग्राहकों का आप पर कितना उधार बाकी है?',
      tl: 'Magkano po ang kabuuang utang ng mga suki ninyo ngayon?',
      id: 'Berapa total bon pelanggan yang belum dibayar sekarang?',
      mr: 'सध्या ग्राहकांकडे तुमची किती उधारी बाकी आहे?',
    },
  },
  {
    id: 'purpose',
    english: 'What will you use the loan for, and how will it help the shop?',
    local: {
      hi: 'आप यह लोन किस काम के लिए लेना चाहते हैं, और इससे दुकान को क्या फ़ायदा होगा?',
      tl: 'Saan po ninyo gagamitin ang loan, at paano ito makakatulong sa tindahan?',
      id: 'Pinjaman ini akan dipakai untuk apa, dan bagaimana membantu warung?',
      mr: 'हे कर्ज तुम्ही कशासाठी वापरणार, आणि दुकानाला त्याचा काय फायदा होईल?',
    },
  },
]

export const LANGUAGES: Record<string, { label: string; speech: string }> = {
  hi: { label: 'हिन्दी', speech: 'hi-IN' },
  mr: { label: 'मराठी', speech: 'mr-IN' },
  tl: { label: 'Tagalog', speech: 'fil-PH' },
  id: { label: 'Bahasa Indonesia', speech: 'id-ID' },
  en: { label: 'English', speech: 'en-US' },
}
