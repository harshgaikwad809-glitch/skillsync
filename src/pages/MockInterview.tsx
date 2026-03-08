import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Send, RotateCcw,
  ChevronRight, Loader2, CheckCircle2, BotMessageSquare,
  User, Volume2, VolumeX, Clock, Trophy, TrendingUp, MessageSquare,
  Zap, Brain, BarChart3
} from 'lucide-react';
import { chatWithInterviewer, generateInterviewFeedback } from '../lib/gemini';
import type { InterviewMessage, InterviewFeedback } from '../lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Scientist', 'DevOps Engineer', 'Mobile Developer', 'System Architect',
];

const TOPICS: Record<string, string[]> = {
  'Frontend Developer': ['React', 'JavaScript', 'CSS & Design', 'TypeScript', 'Vue.js'],
  'Backend Developer': ['Node.js', 'Python', 'Java Spring', 'REST APIs', 'Databases'],
  'Full Stack Developer': ['React + Node.js', 'System Design', 'APIs & Auth', 'TypeScript'],
  'Data Scientist': ['Machine Learning', 'Python & Pandas', 'SQL', 'Statistics'],
  'DevOps Engineer': ['CI/CD Pipelines', 'Docker & K8s', 'Cloud (AWS/GCP)', 'Linux'],
  'Mobile Developer': ['React Native', 'Flutter', 'iOS (Swift)', 'Android (Kotlin)'],
  'System Architect': ['System Design', 'Microservices', 'Database Design', 'Scalability'],
};

const DIFFICULTIES = ['Junior', 'Mid-Level', 'Senior'] as const;
const Q_COUNTS = [5, 10, 15] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{score}</span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-600 text-center">{label}</span>
    </div>
  );
}

// ─── Phase 1: Setup ───────────────────────────────────────────────────────────

interface SetupProps {
  onStart: (cfg: { role: string; topic: string; difficulty: string; numQ: number }) => void;
}

function SetupScreen({ onStart }: SetupProps) {
  const [role, setRole] = useState(ROLES[0]);
  const [topic, setTopic] = useState(TOPICS[ROLES[0]][0]);
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTIES[1]);
  const [numQ, setNumQ] = useState<number>(5);
  const [camOn, setCamOn] = useState(false);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamOn(true);
      setCamOk(true);
      setMicOk(true);
    } catch {
      setCamOk(false);
      setMicOk(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [startCamera]);

  const handleRoleChange = (r: string) => {
    setRole(r);
    setTopic(TOPICS[r][0]);
  };

  const statusBadge = (ok: boolean | null, label: string) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${ok === null ? 'bg-slate-100 text-slate-500'
        : ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-rose-50 text-rose-700 border border-rose-200'
      }`}>
      <div className={`w-2 h-2 rounded-full ${ok === null ? 'bg-slate-400' : ok ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
        }`} />
      {label}: {ok === null ? 'Checking…' : ok ? 'Ready' : 'Not found'}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left — Camera Preview */}
        <div className="space-y-4">
          <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-video shadow-xl border border-slate-800">
            {camOn ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                <VideoOff className="w-12 h-12" />
                <span className="text-sm">Camera unavailable</span>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Preview
            </div>
          </div>

          <div className="flex gap-3">
            {statusBadge(micOk, '🎤 Mic')}
            {statusBadge(camOk, '📷 Camera')}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700 space-y-1">
            <p className="font-semibold text-indigo-900">💡 Tips for a great interview:</p>
            <ul className="list-disc list-inside space-y-1 text-indigo-600">
              <li>Find a quiet, well-lit environment</li>
              <li>Speak clearly and take your time</li>
              <li>Use the voice button for a realistic feel</li>
              <li>Structure answers with Context → Approach → Result</li>
            </ul>
          </div>
        </div>

        {/* Right — Configuration */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Mock Interview</h1>
            <p className="text-slate-500 mt-1 text-sm">Configure your session then start when ready.</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Target Role</label>
            <select
              value={role}
              onChange={e => handleRoleChange(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Interview Topic</label>
            <div className="flex flex-wrap gap-2">
              {TOPICS[role].map(t => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${topic === t
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Experience Level</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${difficulty === d
                      ? d === 'Junior' ? 'bg-emerald-500 text-white border-emerald-500'
                        : d === 'Mid-Level' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Number of questions */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Number of Questions</label>
            <div className="flex gap-2">
              {Q_COUNTS.map(n => (
                <button
                  key={n}
                  onClick={() => setNumQ(n)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${numQ === n
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {n} Questions
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onStart({ role, topic, difficulty, numQ })}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-95"
          >
            Start Interview
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 2: Live Interview ──────────────────────────────────────────────────

interface LiveProps {
  config: { role: string; topic: string; difficulty: string; numQ: number };
  onEnd: (messages: InterviewMessage[], elapsed: number) => void;
}

// Web Speech API type shim
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

function LiveInterview({ config, onEnd }: LiveProps) {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Camera
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => { });
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Initial AI greeting
  useEffect(() => {
    (async () => {
      try {
        const greeting = await chatWithInterviewer(
          [], 'Hello, I am ready to start the interview.', config.topic, config.role
        );
        const msg: InterviewMessage = { role: 'interviewer', content: greeting, timestamp: Date.now() };
        setMessages([msg]);
        setQuestionCount(1);
      } catch (e) {
        setMessages([{
          role: 'interviewer',
          content: `Welcome! I'm Sarah, your AI interviewer today. We'll be discussing ${config.topic} for a ${config.difficulty} ${config.role} position. Let's begin — can you start by telling me about your background and experience with ${config.topic}?`,
          timestamp: Date.now(),
        }]);
        setQuestionCount(1);
      }
      setIsAiThinking(false);
    })();
  }, [config]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  // Submit answer → AI responds
  const handleSubmit = useCallback(async () => {
    if (!answer.trim() || isAiThinking) return;
    const userMsg: InterviewMessage = { role: 'user', content: answer.trim(), timestamp: Date.now() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setAnswer('');
    setIsAiThinking(true);

    // Auto-end after numQ questions answered
    if (questionCount >= config.numQ) {
      setTimeout(() => onEnd(newHistory, elapsed), 400);
      return;
    }

    try {
      const aiReply = await chatWithInterviewer(
        newHistory.map(m => ({ role: m.role, content: m.content })),
        answer.trim(),
        config.topic,
        config.role
      );
      setMessages(prev => [...prev, { role: 'interviewer', content: aiReply, timestamp: Date.now() }]);
      setQuestionCount(q => q + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: 'interviewer',
        content: 'Sorry, I had a brief hiccup. Please continue with your answer or press "End Interview" to get your results.',
        timestamp: Date.now(),
      }]);
    }
    setIsAiThinking(false);
  }, [answer, isAiThinking, messages, questionCount, config, elapsed, onEnd]);

  // Voice input
  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input is not supported in this browser. Please use Chrome.'); return; }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setAnswer(transcript);
    };
    rec.onend = () => setIsListening(false);
    rec.start();
    setIsListening(true);
  }, [isListening]);

  const progress = Math.min((questionCount / config.numQ) * 100, 100);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-mono">{formatTime(elapsed)}</span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <span className="text-sm text-slate-500">
            Q <span className="font-bold text-indigo-600">{Math.min(questionCount, config.numQ)}</span> / {config.numQ}
          </span>
          <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-slate-400">{config.topic}</span>
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{config.difficulty}</span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">

        {/* Left: AI + User interface */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">

          {/* AI interviewer panel */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 shadow-xl border border-slate-800 flex items-start gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shadow-lg">
                <BotMessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${isAiThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white font-semibold text-sm">Sarah</span>
                <span className="text-slate-400 text-xs">AI Interviewer · {config.role}</span>
              </div>

              {isAiThinking ? (
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                  <span className="text-slate-400 text-sm ml-2">Thinking…</span>
                </div>
              ) : (
                <p className="text-slate-100 text-sm leading-relaxed">
                  {messages.filter(m => m.role === 'interviewer').slice(-1)[0]?.content || ''}
                </p>
              )}
            </div>
          </div>

          {/* User camera + answer */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 min-h-0">
            {/* Camera PiP */}
            <div className="md:col-span-2 bg-slate-900 rounded-2xl overflow-hidden relative shadow-lg border border-slate-800 min-h-[160px]">
              {!isVideoOff ? (
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <User className="w-12 h-12" />
                </div>
              )}
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
                You
              </div>
              {/* Camera/Mic controls */}
              <div className="absolute bottom-3 right-3 flex gap-1.5">
                <button
                  onClick={() => setIsMuted(m => !m)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-rose-500' : 'bg-black/50 hover:bg-black/70'
                    }`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
                </button>
                <button
                  onClick={() => setIsVideoOff(v => !v)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-rose-500' : 'bg-black/50 hover:bg-black/70'
                    }`}
                >
                  {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-white" /> : <Video className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            </div>

            {/* Answer input */}
            <div className="md:col-span-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Your Answer</label>
                <button
                  onClick={toggleVoice}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {isListening ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {isListening ? 'Stop Listening' : '🎤 Voice Input'}
                </button>
              </div>

              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
                placeholder="Type your answer here… or use Voice Input above. (Ctrl+Enter to submit)"
                className="flex-1 min-h-[120px] w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isAiThinking}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  {isAiThinking ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> AI Responding…</>
                  ) : (
                    <><Send className="w-4 h-4" /> Submit Answer</>
                  )}
                </button>
                <button
                  onClick={() => onEnd(messages, elapsed)}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-xl transition-all flex items-center gap-1.5 text-sm border border-rose-100"
                >
                  <PhoneOff className="w-4 h-4" /> End
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Live Transcript</h3>
          </div>
          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`space-y-1 ${m.role === 'user' ? 'text-right' : ''}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${m.role === 'interviewer' ? 'text-indigo-500' : 'text-slate-500'
                  }`}>
                  {m.role === 'interviewer' ? 'Sarah' : 'You'}
                </span>
                <p className={`text-xs leading-relaxed rounded-xl px-3 py-2 inline-block max-w-[90%] ${m.role === 'interviewer'
                    ? 'bg-indigo-50 text-slate-700 rounded-tl-none text-left'
                    : 'bg-slate-100 text-slate-700 rounded-tr-none'
                  }`}>
                  {m.content}
                </p>
              </div>
            ))}
            {isAiThinking && (
              <div className="flex gap-1 px-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3: Feedback ────────────────────────────────────────────────────────

interface FeedbackProps {
  messages: InterviewMessage[];
  elapsed: number;
  config: { role: string; topic: string; difficulty: string; numQ: number };
  onRestart: () => void;
}

function FeedbackScreen({ messages, elapsed, config, onRestart }: FeedbackProps) {
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const fb = await generateInterviewFeedback(
          messages.map(m => ({ role: m.role, content: m.content })),
          config.topic
        );
        setFeedback(fb);
      } catch {
        setFeedback({
          overallScore: 72,
          technicalScore: 70,
          communicationScore: 75,
          confidenceScore: 71,
          strengths: ['Good foundational knowledge', 'Clear communication style'],
          improvements: ['Practice more hands-on coding', 'Add concrete examples to answers'],
          summary: 'You showed solid understanding of core concepts. With more practice on edge cases and real-world examples, you\'ll perform even stronger in live interviews.',
        });
      }
      setLoading(false);
    })();
  }, [messages, config.topic]);

  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
        <p className="font-medium">Analyzing your interview performance…</p>
        <p className="text-sm text-slate-400">This takes a few seconds</p>
      </div>
    );
  }

  if (!feedback) return null;

  const qCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="flex-1 overflow-y-auto space-y-6 pb-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-5 h-5 text-indigo-200" />
              <span className="text-indigo-200 text-sm font-medium">Interview Complete</span>
            </div>
            <h2 className="text-2xl font-bold">{config.topic} — {config.difficulty}</h2>
            <p className="text-indigo-200 text-sm mt-1">{config.role} · {qCount} questions · {formatTime(elapsed)}</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black">{feedback.overallScore}<span className="text-2xl text-indigo-300">/100</span></div>
            <p className="text-indigo-200 text-sm mt-1">Overall Score</p>
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm">
          <Brain className="w-6 h-6 text-indigo-500" />
          <ScoreRing score={feedback.technicalScore} label="Technical" color={scoreColor(feedback.technicalScore)} />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm">
          <MessageSquare className="w-6 h-6 text-amber-500" />
          <ScoreRing score={feedback.communicationScore} label="Communication" color={scoreColor(feedback.communicationScore)} />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center gap-3 shadow-sm">
          <Zap className="w-6 h-6 text-emerald-500" />
          <ScoreRing score={feedback.confidenceScore} label="Confidence" color={scoreColor(feedback.confidenceScore)} />
        </div>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <Trophy className="w-4 h-4" />
            Strengths
          </div>
          <ul className="space-y-2">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-700 font-semibold">
            <TrendingUp className="w-4 h-4" />
            Areas to Improve
          </div>
          <ul className="space-y-2">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <BarChart3 className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <BotMessageSquare className="w-4 h-4" />
          Sarah's Assessment
        </h3>
        <p className="text-sm text-indigo-800 leading-relaxed">{feedback.summary}</p>
      </div>

      {/* Transcript review */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTranscript(t => !t)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            Full Transcript ({messages.length} messages)
          </span>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${showTranscript ? 'rotate-90' : ''}`} />
        </button>
        {showTranscript && (
          <div className="border-t border-slate-100 p-4 max-h-80 overflow-y-auto space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`px-3 py-2 rounded-xl text-sm ${m.role === 'interviewer'
                  ? 'bg-indigo-50 text-slate-700'
                  : 'bg-slate-100 text-slate-700 ml-8'
                }`}>
                <span className="font-semibold text-xs uppercase tracking-wide block mb-1 opacity-60">
                  {m.role === 'interviewer' ? 'Sarah' : 'You'}
                </span>
                {m.content}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <button
        onClick={onRestart}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95"
      >
        <RotateCcw className="w-4 h-4" />
        Start Another Interview
      </button>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

type Phase = 'setup' | 'live' | 'feedback';

interface Config {
  role: string;
  topic: string;
  difficulty: string;
  numQ: number;
}

export function MockInterview() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<Config | null>(null);
  const [finalMessages, setFinalMessages] = useState<InterviewMessage[]>([]);
  const [finalElapsed, setFinalElapsed] = useState(0);

  const handleStart = (cfg: Config) => {
    setConfig(cfg);
    setPhase('live');
  };

  const handleEnd = (messages: InterviewMessage[], elapsed: number) => {
    setFinalMessages(messages);
    setFinalElapsed(elapsed);
    setPhase('feedback');
  };

  const handleRestart = () => {
    setConfig(null);
    setFinalMessages([]);
    setFinalElapsed(0);
    setPhase('setup');
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">AI Mock Interview</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {phase === 'setup' && 'Configure your session and start practising with Sarah, your AI interviewer.'}
          {phase === 'live' && 'Answer each question thoughtfully. You can use voice or text input.'}
          {phase === 'feedback' && 'Review your performance and detailed AI feedback below.'}
        </p>
      </div>

      {/* Phase indicator */}
      <div className="flex items-center gap-3">
        {(['setup', 'live', 'feedback'] as Phase[]).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            {i > 0 && <div className={`h-px w-8 ${(['setup', 'live', 'feedback'] as Phase[]).indexOf(phase) >= i ? 'bg-indigo-400' : 'bg-slate-200'
              }`} />}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${phase === p
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : (['setup', 'live', 'feedback'] as Phase[]).indexOf(phase) > i
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-400'
              }`}>
              {(['setup', 'live', 'feedback'] as Phase[]).indexOf(phase) > i ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium capitalize ${phase === p ? 'text-indigo-600' : 'text-slate-400'}`}>
              {p === 'setup' ? 'Setup' : p === 'live' ? 'Interview' : 'Feedback'}
            </span>
          </div>
        ))}
      </div>

      {phase === 'setup' && <SetupScreen onStart={handleStart} />}

      {phase === 'live' && config && (
        <LiveInterview config={config} onEnd={handleEnd} />
      )}

      {phase === 'feedback' && config && (
        <FeedbackScreen
          messages={finalMessages}
          elapsed={finalElapsed}
          config={config}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
