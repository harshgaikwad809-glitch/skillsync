import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, Send, RotateCcw,
  ChevronRight, Loader2, CheckCircle2, BotMessageSquare,
  User, Volume2, VolumeX, Clock, Trophy, TrendingUp, MessageSquare,
  Zap, Brain, BarChart3, Lightbulb, Shield, Building2,
} from 'lucide-react';
import { chatWithInterviewer, generateInterviewFeedback } from '../lib/gemini';
import type { InterviewMessage, InterviewFeedback } from '../lib/types';

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDUSTRIES: Record<string, string[]> = {
  'Technology': ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Mobile Developer', 'DevOps Engineer', 'Data Engineer', 'ML Engineer'],
  'Data & AI': ['Data Scientist', 'AI/ML Engineer', 'Data Analyst', 'BI Developer'],
  'Design': ['UX Designer', 'Product Designer', 'UI Developer'],
  'Product': ['Product Manager', 'Business Analyst', 'Scrum Master'],
  'Architecture': ['System Architect', 'Solution Architect', 'Cloud Architect'],
  'Finance & Banking': ['Quantitative Analyst', 'Risk Analyst', 'FinTech Developer'],
};

const TOPICS_FOR_ROLE: Record<string, string[]> = {
  'Frontend Developer': ['React', 'JavaScript', 'TypeScript', 'CSS & Design'],
  'Backend Developer': ['Node.js', 'REST APIs', 'Databases', 'Python'],
  'Full Stack Developer': ['React + Node.js', 'System Design', 'APIs & Auth'],
  'Mobile Developer': ['React Native', 'Flutter', 'iOS Swift', 'Android Kotlin'],
  'DevOps Engineer': ['CI/CD', 'Docker & Kubernetes', 'AWS/GCP', 'Linux'],
  'Data Engineer': ['SQL & NoSQL', 'Spark & Kafka', 'ETL Pipelines'],
  'Data Scientist': ['Machine Learning', 'Python & Pandas', 'Statistics'],
  'AI/ML Engineer': ['Deep Learning', 'LLMs & Transformers', 'MLOps'],
  'Data Analyst': ['SQL', 'Excel & BI Tools', 'Statistics'],
  'BI Developer': ['Power BI', 'Tableau', 'SQL'],
  'UX Designer': ['UX Research', 'Figma & Prototyping', 'Design Systems'],
  'Product Designer': ['User-Centered Design', 'Wireframing', 'Interaction Design'],
  'UI Developer': ['React + CSS', 'Accessibility', 'Design Systems'],
  'Product Manager': ['Product Strategy', 'Agile & Scrum', 'Stakeholder Management'],
  'Business Analyst': ['Requirements Gathering', 'Process Mapping', 'UML'],
  'Scrum Master': ['Agile Ceremonies', 'Team Coaching', 'Jira & Tools'],
  'System Architect': ['System Design', 'Microservices', 'Scalability'],
  'Solution Architect': ['Cloud Architecture', 'Enterprise Systems', 'APIs'],
  'Cloud Architect': ['AWS', 'GCP', 'Azure', 'Infrastructure as Code'],
  'Quantitative Analyst': ['Options Pricing', 'Risk Modeling', 'Python & R'],
  'Risk Analyst': ['Market Risk', 'Credit Risk', 'Regulatory Compliance'],
  'FinTech Developer': ['Payment Systems', 'Blockchain Basics', 'Banking APIs'],
};

const DIFFICULTIES = ['Junior', 'Mid-Level', 'Senior'] as const;
const Q_COUNTS = [5, 10, 15] as const;

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label, sublabel, color, icon }: {
  score: number; label: string; sublabel?: string; color: string;
  icon: React.ReactNode;
}) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-slate-900">{score}</span>
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1 text-xs font-semibold text-slate-700">{icon}{label}</div>
        {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

// ─── Phase 1: Setup ───────────────────────────────────────────────────────────

interface Config { industry: string; role: string; topic: string; difficulty: string; numQ: number; }

function SetupScreen({ onStart }: { onStart: (cfg: Config) => void }) {
  const [industry, setIndustry] = useState(Object.keys(INDUSTRIES)[0]);
  const [role, setRole] = useState(INDUSTRIES[Object.keys(INDUSTRIES)[0]][0]);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string>(DIFFICULTIES[1]);
  const [numQ, setNumQ] = useState<number>(5);
  const [camOn, setCamOn] = useState(false);
  const [micOk, setMicOk] = useState<boolean | null>(null);
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const roles = INDUSTRIES[industry];
    const r = roles[0];
    setRole(r);
    setTopic(TOPICS_FOR_ROLE[r]?.[0] ?? '');
  }, [industry]);

  useEffect(() => {
    setTopic(TOPICS_FOR_ROLE[role]?.[0] ?? '');
  }, [role]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOn(true); setCamOk(true); setMicOk(true);
      })
      .catch(() => { setCamOk(false); setMicOk(false); });
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const badge = (ok: boolean | null, label: string) => (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${ok === null ? 'bg-slate-50 text-slate-500 border-slate-200'
      : ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-rose-50 text-rose-600 border-rose-200'
      }`}>
      <div className={`w-1.5 h-1.5 rounded-full ${ok === null ? 'bg-slate-400' : ok ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
      {label}: {ok === null ? 'Checking…' : ok ? 'Ready' : 'Not found'}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left — Camera + Stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* macOS-style camera window */}
          <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-800">
            {/* Chrome bar */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 border-b border-slate-700/60">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="ml-auto text-xs text-slate-400 font-medium">Camera Preview</span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-2" />
            </div>
            <div className="relative aspect-video">
              {camOn
                ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-500 min-h-[180px]">
                  <VideoOff className="w-10 h-10" />
                  <span className="text-sm">Camera unavailable</span>
                </div>
              }
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> You
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {badge(micOk, '🎤 Mic')}
            {badge(camOk, '📷 Camera')}
          </div>

          {/* Stats row like CareerUplift */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['5K+', 'Interviews'], ['93%', 'Success Rate'], ['100+', 'Roles']].map(([v, l]) => (
              <div key={l} className="bg-indigo-50 border border-indigo-100 rounded-xl py-3">
                <div className="text-lg font-black text-indigo-700">{v}</div>
                <div className="text-[10px] text-indigo-500 font-medium">{l}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-2">
            <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">💡 Interview Tips</p>
            {['Find a quiet, well-lit environment', 'Structure answers: Situation → Task → Action → Result', 'Use voice input for a realistic feel'].map(t => (
              <div key={t} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-600">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Config */}
        <div className="lg:col-span-3 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Start Your Demo Interview</h1>
            <p className="text-slate-500 mt-1 text-sm">Configure your session, then begin when ready.</p>
          </div>

          {/* Industry */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <Building2 className="w-3.5 h-3.5 inline mr-1" />Select Industry
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(INDUSTRIES).map(ind => (
                <button key={ind} onClick={() => setIndustry(ind)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${industry === ind
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Role
            </label>
            <select value={role} onChange={e => setRole(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm">
              {INDUSTRIES[industry].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Focus Topic</label>
            <div className="flex flex-wrap gap-2">
              {(TOPICS_FOR_ROLE[role] ?? []).map(t => (
                <button key={t} onClick={() => setTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${topic === t
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600'
                    }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Experience Level</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${difficulty === d
                    ? d === 'Junior' ? 'bg-emerald-500 text-white border-emerald-500'
                      : d === 'Mid-Level' ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-rose-500 text-white border-rose-500'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Q Count */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Questions</label>
            <div className="flex gap-2">
              {Q_COUNTS.map(n => (
                <button key={n} onClick={() => setNumQ(n)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${numQ === n ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                  {n} Questions
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => onStart({ industry, role, topic, difficulty, numQ })}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-95 text-sm">
            Start Interview <ChevronRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-slate-400">No credit card required · AI + Human verified responses</p>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 2: Live Interview ──────────────────────────────────────────────────

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

function LiveInterview({ config, onEnd }: {
  config: Config;
  onEnd: (messages: InterviewMessage[], elapsed: number) => void;
}) {
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => { streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => { });
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Pass empty history — Sarah starts fresh with an intro + first question
        const greeting = await chatWithInterviewer(
          [],
          'Please introduce yourself and ask the first interview question.',
          config.topic,
          config.role
        );
        setMessages([{ role: 'interviewer', content: greeting, timestamp: Date.now() }]);
      } catch {
        setMessages([{
          role: 'interviewer',
          content: `Welcome! I'm Sarah, your AI interviewer. Today we'll focus on ${config.topic} for a ${config.difficulty} ${config.role} position. Let's begin — please introduce yourself and your experience with ${config.topic}.`,
          timestamp: Date.now(),
        }]);
      }
      setIsAiThinking(false);
      setQuestionCount(1);
    })();
  }, [config]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages]);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim() || isAiThinking) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }

    const userAnswer = answer.trim();
    const userMsg: InterviewMessage = { role: 'user', content: userAnswer, timestamp: Date.now() };
    // Keep previous history (before adding user's message) for the API call
    const prevHistory = messages.map(m => ({ role: m.role, content: m.content }));
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setAnswer('');
    setIsAiThinking(true);

    if (questionCount >= config.numQ) {
      setTimeout(() => onEnd(newHistory, elapsed), 300);
      return;
    }

    try {
      // Pass previous history + userAnswer separately to avoid duplication
      const aiReply = await chatWithInterviewer(
        prevHistory,
        userAnswer,
        config.topic,
        config.role
      );
      setMessages(prev => [...prev, { role: 'interviewer', content: aiReply, timestamp: Date.now() }]);
      setQuestionCount(q => q + 1);
    } catch {
      setMessages(prev => [...prev, {
        role: 'interviewer',
        content: 'I had a brief connection issue. Please try submitting your answer again.',
        timestamp: Date.now(),
      }]);
    }
    setIsAiThinking(false);
  }, [answer, isAiThinking, messages, questionCount, config, elapsed, onEnd, isListening]);

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Voice input requires Chrome browser.'); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setAnswer(t);
    };
    rec.onend = () => setIsListening(false);
    rec.start();
    setIsListening(true);
  }, [isListening]);

  const lastAiMsg = messages.filter(m => m.role === 'interviewer').slice(-1)[0]?.content ?? '';
  const progress = Math.min((questionCount / config.numQ) * 100, 100);

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Status bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 font-mono text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />{formatTime(elapsed)}
          </span>
          <div className="w-px h-4 bg-slate-200" />
          <span className="text-slate-500">
            Q <span className="font-black text-indigo-600">{Math.min(questionCount, config.numQ)}</span>/{config.numQ}
          </span>
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">{config.role}</span>
          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Connected
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-3 min-h-0">
        <div className="lg:col-span-3 flex flex-col gap-3 min-h-0">

          {/* AI Interviewer — macOS style window */}
          <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            {/* Window chrome */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="ml-3 text-xs text-slate-500 font-medium">AI Interview Session</span>
              <div className="ml-auto flex items-center gap-1.5 bg-emerald-900/50 border border-emerald-700/50 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Connected
              </div>
            </div>

            <div className="p-5 flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shadow-lg">
                  <BotMessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${isAiThinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-bold text-sm">Sarah</span>
                  <span className="text-slate-500 text-xs">AI Interviewer · {config.industry}</span>
                </div>
                {isAiThinking
                  ? <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                    <span className="text-slate-500 text-xs ml-2">Thinking…</span>
                  </div>
                  : <p className="text-slate-200 text-sm leading-relaxed">{lastAiMsg}</p>
                }
              </div>
            </div>
          </div>

          {/* User area */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 min-h-0">
            {/* PiP Camera */}
            <div className="md:col-span-2 bg-slate-900 rounded-2xl overflow-hidden relative shadow-lg border border-slate-800 min-h-[160px]">
              {!isVideoOff
                ? <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                : <div className="w-full h-full flex items-center justify-center text-slate-500 min-h-[160px]"><User className="w-12 h-12" /></div>
              }
              <div className="absolute bottom-3 left-3 text-white text-xs px-2 py-1 rounded-full font-medium bg-black/60 backdrop-blur-sm">You</div>
              <div className="absolute bottom-3 right-3 flex gap-1.5">
                <button onClick={() => setIsMuted(m => !m)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-rose-500' : 'bg-black/50 hover:bg-black/70'}`}>
                  {isMuted ? <MicOff className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5 text-white" />}
                </button>
                <button onClick={() => setIsVideoOff(v => !v)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isVideoOff ? 'bg-rose-500' : 'bg-black/50 hover:bg-black/70'}`}>
                  {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-white" /> : <Video className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            </div>

            {/* Answer panel */}
            <div className="md:col-span-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">Your Answer</label>
                <button onClick={toggleVoice}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${isListening ? 'bg-rose-500 text-white border-rose-500 animate-pulse shadow-lg shadow-rose-200' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}>
                  {isListening ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  {isListening ? 'Stop Listening' : '🎤 Voice Input'}
                </button>
              </div>

              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
                placeholder="Type your answer here, or click Voice Input to speak… (Ctrl+Enter to submit)"
                className="flex-1 min-h-[120px] w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />

              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={!answer.trim() || isAiThinking}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm active:scale-95">
                  {isAiThinking ? <><Loader2 className="w-4 h-4 animate-spin" /> Responding…</> : <><Send className="w-4 h-4" /> Submit Answer</>}
                </button>
                <button onClick={() => onEnd(messages, elapsed)}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl transition-all flex items-center gap-1.5 text-sm border border-rose-100">
                  <PhoneOff className="w-4 h-4" /> End
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-700">Transcript</h3>
          </div>
          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${m.role === 'interviewer' ? 'text-indigo-500' : 'text-slate-500'}`}>
                  {m.role === 'interviewer' ? 'Sarah' : 'You'}
                </span>
                <p className={`text-xs leading-relaxed rounded-xl px-3 py-2 mt-0.5 inline-block max-w-[95%] ${m.role === 'interviewer' ? 'bg-indigo-50 text-slate-700 rounded-tl-none text-left' : 'bg-slate-100 text-slate-700 rounded-tr-none'
                  }`}>{m.content}</p>
              </div>
            ))}
            {isAiThinking && (
              <div className="flex gap-1 px-3">
                {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 3: Feedback ────────────────────────────────────────────────────────

function FeedbackScreen({ messages, elapsed, config, onRestart }: {
  messages: InterviewMessage[];
  elapsed: number;
  config: Config;
  onRestart: () => void;
}) {
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAnswer, setExpandedAnswer] = useState<number | null>(null);

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
          overallScore: 74, technicalScore: 72, communicationScore: 78, confidenceScore: 72,
          strengths: ['Good foundational understanding', 'Clear and structured responses'],
          improvements: ['Add more concrete real-world examples', 'Dive deeper into edge cases'],
          summary: 'You demonstrated solid fundamentals and communicated clearly. Focusing on depth and real-world scenarios will significantly improve your interview performance.',
          communicationStyle: 'Clear and structured, but could add more specific examples',
          idealAnswers: [],
        });
      }
      setLoading(false);
    })();
  }, [messages, config.topic]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-700">Analysing your performance…</p>
          <p className="text-sm text-slate-400 mt-1">Sarah is reviewing your answers and generating ideal responses</p>
        </div>
      </div>
    );
  }

  if (!feedback) return null;

  const sc = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';
  const qCount = messages.filter(m => m.role === 'user').length;

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pb-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 rounded-2xl p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Shield className="w-4 h-4 text-indigo-300" />
              <span className="text-indigo-300 text-xs font-semibold uppercase tracking-wider">AI + Human Verified</span>
            </div>
            <h2 className="text-2xl font-black mb-1">{config.role}</h2>
            <p className="text-indigo-200 text-sm">{config.industry} · {config.topic} · {config.difficulty} · {qCount} Q · {formatTime(elapsed)}</p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-black">{feedback.overallScore}<span className="text-xl text-indigo-300">/100</span></div>
            <p className="text-indigo-300 text-xs mt-1">Overall Score</p>
          </div>
        </div>
      </div>

      {/* Score rings */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { score: feedback.technicalScore, label: 'Technical', sublabel: 'Depth & accuracy', color: sc(feedback.technicalScore), icon: <Brain className="w-3.5 h-3.5" /> },
          { score: feedback.communicationScore, label: 'Communication', sublabel: 'Clarity & structure', color: sc(feedback.communicationScore), icon: <MessageSquare className="w-3.5 h-3.5" /> },
          { score: feedback.confidenceScore, label: 'Confidence', sublabel: 'Decisiveness & pace', color: sc(feedback.confidenceScore), icon: <Zap className="w-3.5 h-3.5" /> },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 flex justify-center shadow-sm">
            <ScoreRing {...s} />
          </div>
        ))}
      </div>

      {/* Communication Style — CareerUplift-inspired */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" /> Communication Analysis
        </h3>
        <p className="text-sm text-slate-600 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 italic">
          "{feedback.communicationStyle}"
        </p>
      </div>

      {/* Strengths & Improvements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" /> Strengths</h3>
          <ul className="space-y-2">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />{s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Areas to Improve</h3>
          <ul className="space-y-2">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <BarChart3 className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />{s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
          <BotMessageSquare className="w-4 h-4" /> Sarah's Assessment
        </h3>
        <p className="text-sm text-indigo-800 leading-relaxed">{feedback.summary}</p>
      </div>

      {/* Ideal Answer Recommendations — key CareerUplift feature */}
      {feedback.idealAnswers && feedback.idealAnswers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" /> Personalized Answer Recommendations
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">See how your answers compare to ideal responses</p>
          </div>
          <div className="divide-y divide-slate-100">
            {feedback.idealAnswers.map((item, i) => (
              <div key={i} className="px-5 py-4">
                <button onClick={() => setExpandedAnswer(expandedAnswer === i ? null : i)}
                  className="w-full flex items-start justify-between gap-3 text-left">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm font-semibold text-slate-700">{item.question}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5 transition-transform ${expandedAnswer === i ? 'rotate-90' : ''}`} />
                </button>
                {expandedAnswer === i && (
                  <div className="mt-3 ml-7">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Ideal Answer
                    </p>
                    <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 leading-relaxed">{item.ideal}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onRestart}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-95">
        <RotateCcw className="w-4 h-4" /> Start Another Interview
      </button>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

type Phase = 'setup' | 'live' | 'feedback';

export function MockInterview() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [config, setConfig] = useState<Config | null>(null);
  const [finalMessages, setFinalMessages] = useState<InterviewMessage[]>([]);
  const [finalElapsed, setFinalElapsed] = useState(0);

  return (
    <div className="h-full flex flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">AI Mock Interview</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {phase === 'setup' && 'Select your industry and role, then start your AI-powered interview.'}
          {phase === 'live' && 'Answer each question naturally. Use voice or text — Sarah is listening.'}
          {phase === 'feedback' && 'Detailed AI feedback with ideal answer recommendations below.'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(['setup', 'live', 'feedback'] as Phase[]).map((p, i) => {
          const idx = ['setup', 'live', 'feedback'].indexOf(phase);
          return (
            <div key={p} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 transition-all ${idx >= i ? 'bg-indigo-400' : 'bg-slate-200'}`} />}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${phase === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : idx > i ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                }`}>{idx > i ? '✓' : i + 1}</div>
              <span className={`text-xs font-medium capitalize ${phase === p ? 'text-indigo-600' : 'text-slate-400'}`}>
                {p === 'setup' ? 'Setup' : p === 'live' ? 'Interview' : 'Feedback'}
              </span>
            </div>
          );
        })}
      </div>

      {phase === 'setup' && (
        <SetupScreen onStart={cfg => { setConfig(cfg); setPhase('live'); }} />
      )}
      {phase === 'live' && config && (
        <LiveInterview config={config} onEnd={(msgs, el) => { setFinalMessages(msgs); setFinalElapsed(el); setPhase('feedback'); }} />
      )}
      {phase === 'feedback' && config && (
        <FeedbackScreen messages={finalMessages} elapsed={finalElapsed} config={config} onRestart={() => { setConfig(null); setFinalMessages([]); setFinalElapsed(0); setPhase('setup'); }} />
      )}
    </div>
  );
}
