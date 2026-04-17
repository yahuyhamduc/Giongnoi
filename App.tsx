
import React, { useState, useMemo, useRef, useCallback, FC, ReactNode, ChangeEvent, SelectHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { generateSpeech } from './services/geminiService';
import { createWavBlob, createMp3Blob } from './utils/audioUtils';

// --- UI Atom Components (Label, Field, Select, Button, Card) ---

const Label: FC<{ htmlFor: string; children: ReactNode; className?: string }> = ({ htmlFor, children, className = '' }) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-300 mb-1 ${className}`}>
    {children}
  </label>
);

const Field: FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`mb-4 ${className}`}>{children}</div>
);

const Select: FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ children, className = '', ...props }) => (
  <select
    className={`w-full bg-gray-700 border border-gray-600 text-white rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 text-base ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Button: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className = '', ...props }) => (
  <button
    className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform duration-100 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Card: FC<HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg p-6 h-full ${className}`} {...props}>
    {children}
  </div>
);

// --- Interfaces & Constants ---

interface Voice { id: string; apiId: string; name: string; description: string; }

const BANNED_WORDS = ["example_banned_word", "profanity"];
const TOKEN_PER_CHAR = 1;
const PRICE_PER_1K_TOKENS = 0.000015;

const SCENARIOS = [
  { name: "Kịch bản bán hàng", text: "Chào anh chị, em là Gia Huy từ AI GSP. Bên em đang có giải pháp tự động hóa giọng nói giúp tăng hiệu suất tổng đài lên đến 50%. Anh chị có muốn tìm hiểu thêm không ạ?" },
  { name: "Bản tin nhanh", text: "Tin tức mới nhất: Công nghệ Gemini 2.5 vừa được công bố, hứa hẹn mang lại khả năng xử lý ngôn ngữ tự nhiên vượt trội, mở ra nhiều ứng dụng đột phá trong tương lai." },
  { name: "Review phim", text: "Bộ phim mới ra mắt cuối tuần qua đã thực sự tạo nên một cơn sốt. Với kỹ xảo mãn nhãn và cốt truyện sâu sắc, đây chắc chắn là một tác phẩm không thể bỏ lỡ." },
  { name: "Kể chuyện", text: "Ngày xửa ngày xưa, ở một vương quốc xa xôi, có một nàng công chúa vô cùng xinh đẹp nhưng lại bị một lời nguyền giam cầm trong một tòa tháp cao..." }
];

const VOICES_BY_LANGUAGE: Record<string, { male: Voice[], female: Voice[] }> = {
  vi: {
    female: [
      { id: 'vi-female-1', apiId: 'Kore', name: 'Mai Linh (Miền Bắc)', description: 'Giọng nữ miền Bắc, ấm áp, truyền cảm.' },
      { id: 'vi-female-2', apiId: 'Zephyr', name: 'Thảo Vy (Miền Nam)', description: 'Giọng nữ miền Nam, trẻ trung, trong trẻo.' },
      { id: 'vi-female-3', apiId: 'Kore', name: 'Hà Trang (Miền Bắc)', description: 'Giọng nữ miền Bắc, thanh lịch, rõ ràng.' },
      { id: 'vi-female-4', apiId: 'Zephyr', name: 'Ngọc Hân (Miền Nam)', description: 'Giọng nữ miền Nam, ngọt ngào, thân thiện.' },
      { id: 'vi-female-5', apiId: 'Kore', name: 'Phương Anh (Miền Bắc)', description: 'Giọng nữ miền Bắc, chuyên nghiệp, phù hợp tin tức.' },
      { id: 'vi-female-6', apiId: 'Zephyr', name: 'Thanh Trúc (Miền Nam)', description: 'Giọng nữ miền Nam, tự nhiên, gần gũi.' },
      { id: 'vi-female-7', apiId: 'Kore', name: 'Thuỳ Dương (Miền Bắc)', description: 'Giọng nữ miền Bắc, nhẹ nhàng, tinh tế.' },
      { id: 'vi-female-8', apiId: 'Zephyr', name: 'Kim Ngân (Miền Nam)', description: 'Giọng nữ miền Nam, tươi vui, năng động.' },
      { id: 'vi-female-9', apiId: 'Kore', name: 'Lan Chi (Miền Bắc)', description: 'Giọng nữ miền Bắc, trang trọng, quyền uy.' },
      { id: 'vi-female-10', apiId: 'Zephyr', name: 'Tú Quyên (Miền Nam)', description: 'Giọng nữ miền Nam, dịu dàng, sâu lắng.' },
    ],
    male: [
      { id: 'vi-male-1', apiId: 'Puck', name: 'Minh Quang (Miền Bắc)', description: 'Giọng nam miền Bắc, rõ ràng, dứt khoát.' },
      { id: 'vi-male-2', apiId: 'Charon', name: 'Hoàng Dũng (Miền Nam)', description: 'Giọng nam miền Nam, trầm ấm, đáng tin cậy.' },
      { id: 'vi-male-3', apiId: 'Fenrir', name: 'Bảo Long (Miền Bắc)', description: 'Giọng nam miền Bắc, trung tính, tự nhiên.' },
      { id: 'vi-male-4', apiId: 'Puck', name: 'Gia Huy (Miền Nam)', description: 'Giọng nam miền Nam, trẻ trung, năng động.' },
      { id: 'vi-male-5', apiId: 'Charon', name: 'Tuấn Kiệt (Miền Bắc)', description: 'Giọng nam miền Bắc, mạnh mẽ, quyết đoán.' },
      { id: 'vi-male-6', apiId: 'Fenrir', name: 'Đức Anh (Miền Bắc)', description: 'Giọng nam miền Bắc, lịch lãm, điềm tĩnh.' },
      { id: 'vi-male-7', apiId: 'Puck', name: 'Thành Trung (Miền Nam)', description: 'Giọng nam miền Nam, thân thiện, kể chuyện.' },
      { id: 'vi-male-8', apiId: 'Charon', name: 'Quốc Bảo (Miền Nam)', description: 'Giọng nam miền Nam, chững chạc, uy tín.' },
      { id: 'vi-male-9', apiId: 'Fenrir', name: 'Việt Hoàng (Miền Bắc)', description: 'Giọng nam miền Bắc, hào sảng, quảng cáo.' },
      { id: 'vi-male-10', apiId: 'Puck', name: 'Đăng Khoa (Miền Nam)', description: 'Giọng nam miền Nam, sôi nổi, hoạt bát.' },
    ]
  },
  en: {
    female: [{ id: 'en-female-1', apiId: 'Kore', name: 'Kore', description: 'A standard, clear female voice.' },{ id: 'en-female-2', apiId: 'Zephyr', name: 'Zephyr', description: 'A warm and friendly female voice.' }],
    male: [{ id: 'en-male-1', apiId: 'Puck', name: 'Puck', description: 'A youthful and energetic male voice.' },{ id: 'en-male-2', apiId: 'Charon', name: 'Charon', description: 'A deep and authoritative male voice.' },{ id: 'en-male-3', apiId: 'Fenrir', name: 'Fenrir', description: 'A mature and calm male voice.' }]
  },
  zh: { female: [{ id: 'zh-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Mandarin female voice.' }], male: [{ id: 'zh-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Mandarin male voice.' }] },
  es: { female: [{ id: 'es-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Spanish female voice.' }], male: [{ id: 'es-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Spanish male voice.' }] },
  fr: { female: [{ id: 'fr-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard French female voice.' }], male: [{ id: 'fr-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard French male voice.' }] },
  de: { female: [{ id: 'de-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard German female voice.' }], male: [{ id: 'de-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard German male voice.' }] },
  it: { female: [{ id: 'it-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Italian female voice.' }], male: [{ id: 'it-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Italian male voice.' }] },
  pt: { female: [{ id: 'pt-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Portuguese female voice.' }], male: [{ id: 'pt-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Portuguese male voice.' }] },
  ru: { female: [{ id: 'ru-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Russian female voice.' }], male: [{ id: 'ru-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Russian male voice.' }] },
  ja: { female: [{ id: 'ja-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Japanese female voice.' }], male: [{ id: 'ja-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Japanese male voice.' }] },
  ko: { female: [{ id: 'ko-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Korean female voice.' }], male: [{ id: 'ko-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Korean male voice.' }] },
  ar: { female: [{ id: 'ar-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Arabic female voice.' }], male: [{ id: 'ar-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Arabic male voice.' }] },
  hi: { female: [{ id: 'hi-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Hindi female voice.' }], male: [{ id: 'hi-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Hindi male voice.' }] },
  bn: { female: [{ id: 'bn-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Bengali female voice.' }], male: [{ id: 'bn-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Bengali male voice.' }] },
  id: { female: [{ id: 'id-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Indonesian female voice.' }], male: [{ id: 'id-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Indonesian male voice.' }] },
  tr: { female: [{ id: 'tr-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Turkish female voice.' }], male: [{ id: 'tr-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Turkish male voice.' }] },
  nl: { female: [{ id: 'nl-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Dutch female voice.' }], male: [{ id: 'nl-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Dutch male voice.' }] },
  pl: { female: [{ id: 'pl-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Polish female voice.' }], male: [{ id: 'pl-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Polish male voice.' }] },
  sv: { female: [{ id: 'sv-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Swedish female voice.' }], male: [{ id: 'sv-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Swedish male voice.' }] },
  no: { female: [{ id: 'no-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Norwegian female voice.' }], male: [{ id: 'no-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Norwegian male voice.' }] },
  da: { female: [{ id: 'da-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Danish female voice.' }], male: [{ id: 'da-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Danish male voice.' }] },
  fi: { female: [{ id: 'fi-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Finnish female voice.' }], male: [{ id: 'fi-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Finnish male voice.' }] },
  el: { female: [{ id: 'el-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Greek female voice.' }], male: [{ id: 'el-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Greek male voice.' }] },
  cs: { female: [{ id: 'cs-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Czech female voice.' }], male: [{ id: 'cs-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Czech male voice.' }] },
  hu: { female: [{ id: 'hu-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Hungarian female voice.' }], male: [{ id: 'hu-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Hungarian male voice.' }] },
  ro: { female: [{ id: 'ro-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Romanian female voice.' }], male: [{ id: 'ro-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Romanian male voice.' }] },
  th: { female: [{ id: 'th-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Thai female voice.' }], male: [{ id: 'th-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Thai male voice.' }] },
  he: { female: [{ id: 'he-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Hebrew female voice.' }], male: [{ id: 'he-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Hebrew male voice.' }] },
  uk: { female: [{ id: 'uk-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Ukrainian female voice.' }], male: [{ id: 'uk-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Ukrainian male voice.' }] },
  ms: { female: [{ id: 'ms-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Malay female voice.' }], male: [{ id: 'ms-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Malay male voice.' }] },
  fa: { female: [{ id: 'fa-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Persian female voice.' }], male: [{ id: 'fa-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Persian male voice.' }] },
  fil: { female: [{ id: 'fil-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Filipino female voice.' }], male: [{ id: 'fil-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Filipino male voice.' }] },
  af: { female: [{ id: 'af-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Afrikaans female voice.' }], male: [{ id: 'af-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Afrikaans male voice.' }] },
  bg: { female: [{ id: 'bg-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Bulgarian female voice.' }], male: [{ id: 'bg-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Bulgarian male voice.' }] },
  ca: { female: [{ id: 'ca-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Catalan female voice.' }], male: [{ id: 'ca-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Catalan male voice.' }] },
  hr: { female: [{ id: 'hr-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Croatian female voice.' }], male: [{ id: 'hr-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Croatian male voice.' }] },
  et: { female: [{ id: 'et-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Estonian female voice.' }], male: [{ id: 'et-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Estonian male voice.' }] },
  gl: { female: [{ id: 'gl-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Galician female voice.' }], male: [{ id: 'gl-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Galician male voice.' }] },
  is: { female: [{ id: 'is-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Icelandic female voice.' }], male: [{ id: 'is-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Icelandic male voice.' }] },
  lt: { female: [{ id: 'lt-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Lithuanian female voice.' }], male: [{ id: 'lt-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Lithuanian male voice.' }] },
  lv: { female: [{ id: 'lv-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Latvian female voice.' }], male: [{ id: 'lv-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Latvian male voice.' }] },
  mk: { female: [{ id: 'mk-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Macedonian female voice.' }], male: [{ id: 'mk-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Macedonian male voice.' }] },
  sk: { female: [{ id: 'sk-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Slovak female voice.' }], male: [{ id: 'sk-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Slovak male voice.' }] },
  sl: { female: [{ id: 'sl-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Slovenian female voice.' }], male: [{ id: 'sl-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Slovenian male voice.' }] },
  sr: { female: [{ id: 'sr-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Serbian female voice.' }], male: [{ id: 'sr-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Serbian male voice.' }] },
  sw: { female: [{ id: 'sw-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Swahili female voice.' }], male: [{ id: 'sw-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Swahili male voice.' }] },
  ur: { female: [{ id: 'ur-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Urdu female voice.' }], male: [{ id: 'ur-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Urdu male voice.' }] },
  gu: { female: [{ id: 'gu-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Gujarati female voice.' }], male: [{ id: 'gu-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Gujarati male voice.' }] },
  kn: { female: [{ id: 'kn-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Kannada female voice.' }], male: [{ id: 'kn-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Kannada male voice.' }] },
  ml: { female: [{ id: 'ml-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Malayalam female voice.' }], male: [{ id: 'ml-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Malayalam male voice.' }] },
  mr: { female: [{ id: 'mr-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Marathi female voice.' }], male: [{ id: 'mr-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Marathi male voice.' }] },
  ta: { female: [{ id: 'ta-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Tamil female voice.' }], male: [{ id: 'ta-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Tamil male voice.' }] },
  te: { female: [{ id: 'te-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Telugu female voice.' }], male: [{ id: 'te-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Telugu male voice.' }] },
  jv: { female: [{ id: 'jv-female-1', apiId: 'Kore', name: 'Standard Female', description: 'Standard Javanese female voice.' }], male: [{ id: 'jv-male-1', apiId: 'Puck', name: 'Standard Male', description: 'Standard Javanese male voice.' }] },
};


export default function App() {
  const [text, setText] = useState<string>(SCENARIOS[0].text);
  const [language, setLanguage] = useState<string>('vi');
  const [voiceId, setVoiceId] = useState<string>(VOICES_BY_LANGUAGE['vi'].female[0].id);
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [isSSML, setIsSSML] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEncodingMp3, setIsEncodingMp3] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [base64Audio, setBase64Audio] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const charCount = useMemo(() => text.length, [text]);
  const estTokens = useMemo(() => charCount * TOKEN_PER_CHAR, [charCount]);
  const estCost = useMemo(() => (estTokens / 1000) * PRICE_PER_1K_TOKENS, [estTokens]);
  const violations = useMemo(() => BANNED_WORDS.filter(word => text.toLowerCase().includes(word)), [text]);
  
  const selectedVoice = useMemo(() => {
    const voices = VOICES_BY_LANGUAGE[language];
    return [...voices.female, ...voices.male].find(v => v.id === voiceId);
  }, [language, voiceId]);
  
  const handleLanguageChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    const voices = VOICES_BY_LANGUAGE[newLang];
    const firstFemale = voices.female[0];
    const firstMale = voices.male[0];
    if (firstFemale) {
      setVoiceId(firstFemale.id);
    } else if (firstMale) {
      setVoiceId(firstMale.id);
    }
  }, []);

  const handleSynthesize = useCallback(async () => {
    if (!text.trim()) {
      setError("Text cannot be empty.");
      return;
    }
    if (violations.length > 0) {
      setError(`Banned words found: ${violations.join(', ')}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setBase64Audio(null);

    try {
      if (!selectedVoice) {
        throw new Error("No voice selected.");
      }
      const newBase64Audio = await generateSpeech({
        text,
        voiceId: selectedVoice.apiId,
        speed: isSSML ? 1.0 : speed,
        pitch: isSSML ? 0 : pitch,
        isSSML,
      });
      setBase64Audio(newBase64Audio);

      const wavBlob = createWavBlob(newBase64Audio);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);

      setTimeout(() => {
        audioRef.current?.play();
      }, 100);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during synthesis.");
    } finally {
      setLoading(false);
    }
  }, [text, selectedVoice, speed, pitch, isSSML, violations]);

  const handleDownloadWav = useCallback(() => {
    if (!audioUrl || !selectedVoice) return;
    const link = document.createElement('a');
    link.href = audioUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `tts_${selectedVoice.id}_${timestamp}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [audioUrl, selectedVoice]);

  const handleDownloadMp3 = useCallback(async () => {
    if (!base64Audio || !selectedVoice || isEncodingMp3) return;
    setIsEncodingMp3(true);
    setError(null);

    try {
      // Use a timeout to allow the UI to update to the loading state before blocking the main thread
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const mp3Blob = createMp3Blob(base64Audio);
      if (mp3Blob.size === 0) {
        throw new Error("MP3 encoding resulted in an empty file.");
      }
      const url = URL.createObjectURL(mp3Blob);

      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `tts_${selectedVoice.id}_${timestamp}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url); // Clean up the object URL
    } catch (err: any) {
      setError("Failed to encode MP3: " + err.message);
    } finally {
      setIsEncodingMp3(false);
    }
}, [base64Audio, selectedVoice, isEncodingMp3]);


  const langVoices = VOICES_BY_LANGUAGE[language];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">
            CHUYỂN VĂN BẢN THÀNH GIỌNG NÓI
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Powered by Google Gemini. Generate multi-lingual speech with SSML support.
          </p>
        </header>

        <div className="text-center my-6 flex flex-col items-center">
            <a href="https://www.facebook.com/giahuy.nguyen.756/" target="_blank" rel="noopener noreferrer" className="animate-[pulse_1.2s_ease-in-out_infinite] bg-[#FACC15] text-[#111827] rounded-full px-6 py-2 shadow-xl font-semibold transform hover:scale-105 transition-transform duration-200">
                ĐĂNG KÝ THAM GIA KHOÁ HỌC GSP THẦY GIA HUY
            </a>
            <p className="text-xs text-gray-500 mt-4">App Được Tạo Bởi Gia Huy - 0984780782</p>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column A: Settings */}
          <Card className="md:col-span-1">
            <h2 className="text-xl font-semibold mb-4 text-gray-100">Settings</h2>
            <Field>
              <Label htmlFor="language">Language</Label>
              <Select id="language" value={language} onChange={handleLanguageChange}>
                {Object.keys(VOICES_BY_LANGUAGE).map(lang => (
                  <option key={lang} value={lang}>{new Intl.DisplayNames(['en'], { type: 'language' }).of(lang)}</option>
                ))}
              </Select>
            </Field>

            <Field>
              <Label htmlFor="voice">Voice</Label>
              <Select id="voice" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                {langVoices.female.length > 0 && <optgroup label="Female">
                  {langVoices.female.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </optgroup>}
                {langVoices.male.length > 0 && <optgroup label="Male">
                  {langVoices.male.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </optgroup>}
              </Select>
              {selectedVoice && <p className="text-xs text-gray-400 mt-2">{selectedVoice.description}</p>}
            </Field>

            <Field>
              <Label htmlFor="speed" className="flex justify-between"><span>Speed</span> <span>{speed.toFixed(2)}x</span></Label>
              <input type="range" id="speed" min="0.5" max="2" step="0.01" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} disabled={isSSML} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50" />
            </Field>

            <Field>
              <Label htmlFor="pitch" className="flex justify-between"><span>Pitch</span> <span>{pitch.toFixed(1)}</span></Label>
              <input type="range" id="pitch" min="-12" max="12" step="1" value={pitch} onChange={(e) => setPitch(parseInt(e.target.value, 10))} disabled={isSSML} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50" />
            </Field>

            <div className="flex items-center justify-between">
              <Label htmlFor="ssml" className="mb-0">Enable SSML</Label>
              <input type="checkbox" id="ssml" checked={isSSML} onChange={(e) => setIsSSML(e.target.checked)} className="h-4 w-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
            </div>
            {isSSML && <p className="text-xs text-amber-400 mt-2">Speed and Pitch are controlled by SSML tags.</p>}
          </Card>

          {/* Column B: Content */}
          <Card className="md:col-span-1">
            <h2 className="text-xl font-semibold mb-4 text-gray-100">Content</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isSSML ? "Enter your SSML text here, e.g. <speak>Hello world</speak>" : "Enter text to synthesize..."}
              className="w-full h-48 bg-gray-900 border border-gray-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
            />
            <div className="text-xs text-gray-400 mt-2 grid grid-cols-3 gap-2">
              <span>Chars: {charCount}</span>
              <span>Tokens: ~{estTokens}</span>
              <span>Cost: ~${estCost.toFixed(6)}</span>
            </div>
            {violations.length > 0 && (
              <div className="mt-2 p-2 bg-red-900/50 border border-red-500 rounded-md text-sm text-red-300">
                <p className="font-bold">Warning: Banned words detected</p>
                <p className="text-xs">{violations.join(', ')}</p>
              </div>
            )}
          </Card>

          {/* Column C: Result & Controls */}
          <Card className="md:col-span-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-4 text-gray-100">Result & Controls</h2>
            <div className="flex space-x-2">
              <Button onClick={handleSynthesize} disabled={loading || !text.trim() || violations.length > 0} className="flex-1">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : "Generate Speech"}
              </Button>
              <Button onClick={handleDownloadWav} disabled={!audioUrl || loading} className="bg-green-600 hover:bg-green-700">WAV</Button>
              <Button onClick={handleDownloadMp3} disabled={!base64Audio || loading || isEncodingMp3} className="bg-sky-600 hover:bg-sky-700 w-16">
                 {isEncodingMp3 ? (
                    <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : "MP3"}
              </Button>
            </div>
            
            <div className="mt-4 flex-grow">
              {error && <div className="p-3 bg-red-900/50 border border-red-500 rounded-md text-sm text-red-200">{error}</div>}
              {audioUrl && !error && (
                <div className="mt-4">
                  <audio controls ref={audioRef} src={audioUrl} className="w-full">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300">SSML Tips</h3>
                <div className="text-xs text-gray-400 mt-2 bg-gray-900 p-2 rounded-md font-mono">
                    <p>{`<break time="500ms"/>`}</p>
                    <p>{`<emphasis level="strong">important</emphasis>`}</p>
                    <p>{`<prosody rate="slow" pitch="-2st">slower</prosody>`}</p>
                </div>
            </div>
          </Card>
        </div>

        <div className="mt-6">
            <Card>
                <h2 className="text-xl font-semibold mb-4 text-gray-100">Kịch bản nhanh (Quick Scenarios)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {SCENARIOS.map(scenario => (
                        <Button key={scenario.name} onClick={() => setText(scenario.text)} className="bg-gray-700 hover:bg-gray-600 text-left justify-start">
                            {scenario.name}
                        </Button>
                    ))}
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}