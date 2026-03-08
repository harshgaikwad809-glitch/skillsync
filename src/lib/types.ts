// ========================
// SkillSync — Shared Types
// ========================

// --- User & Profile ---
export interface UserProfile {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github?: string;
    portfolio: string;
    bio: string;
    avatar: string;
    skills: string[];
    targetRole: string;
}

// --- Resume ---
export interface ResumeExperience {
    id: number;
    company: string;
    role: string;
    date: string;
    bullets: string[];
    technologiesUsed?: string;
}

export interface ResumeEducation {
    id: number;
    school: string;
    degree: string;
    date: string;
    gpa: string;
    coursework?: string;
}

export interface ResumeProject {
    id: number;
    name: string;
    description: string;
    tech: string;
    link?: string;
    date?: string;
}

export interface ResumeCertification {
    id: number;
    name: string;
    issuer: string;
    date: string;
}

export type ResumeTemplate = 'classic' | 'modern' | 'minimal';

export interface SkillCategories {
    languages?: string;
    frameworks?: string;
    cloudDevops?: string;
    databases?: string;
    tools?: string;
}

export interface ResumeData {
    personal: {
        name: string;
        email: string;
        phone: string;
        location: string;
        linkedin: string;
        github?: string;
        portfolio: string;
    };
    summary: string;
    skillCategories?: SkillCategories;
    experience: ResumeExperience[];
    education: ResumeEducation[];
    projects: ResumeProject[];
    certifications: ResumeCertification[];
    achievements: string[];
    skills: string;
}

// --- Roadmap ---
export type MilestoneStatus = 'completed' | 'current' | 'locked';

export interface Milestone {
    id: number;
    title: string;
    description: string;
    status: MilestoneStatus;
    date?: string;
    progress?: number;
}

// --- Aptitude Test ---
export interface AptitudeQuestion {
    id: number;
    category: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    text: string;
    options: string[];
    correct: number;
    explanation?: string;
}

export interface AptitudeResult {
    date: string;
    score: number;
    total: number;
    percentile: number;
    weakAreas: string[];
}

// --- Mock Interview ---
export interface InterviewMessage {
    role: 'interviewer' | 'user';
    content: string;
    timestamp: number;
}

export interface InterviewSession {
    id: string;
    topic: string;
    role: string;
    messages: InterviewMessage[];
    feedback?: InterviewFeedback;
    date: string;
}

export interface InterviewFeedback {
    overallScore: number;
    technicalScore: number;
    communicationScore: number;
    confidenceScore: number;
    strengths: string[];
    improvements: string[];
    summary: string;
}

// --- Job Suggestions ---
export interface Job {
    id: number;
    title: string;
    company: string;
    location: string;
    salary: string;
    matchScore: number;
    type: string;
    posted: string;
    skills: string[];
    description: string;
}

// --- Skill Gap ---
export interface SkillGapSkill {
    name: string;
    category: string;
    importance: 'High' | 'Medium' | 'Low';
}

export interface SkillGapResult {
    targetRole: string;
    matchPercentage: number;
    matchedSkills: SkillGapSkill[];
    missingSkills: SkillGapSkill[];
}

// --- ATS Linter ---
export type AtsIssueType = 'error' | 'warning' | 'pass';

export interface AtsIssue {
    type: AtsIssueType;
    title: string;
    description: string;
}

export interface AtsReport {
    score: number;
    issues: AtsIssue[];
}

// --- Learning Paths ---
export type CourseStatus = 'not_started' | 'enrolled' | 'completed';

export interface Course {
    id: number;
    title: string;
    provider: string;
    author: string;
    duration: string;
    rating: number;
    students: string;
    level: string;
    skills: string[];
    match: string;
    status: CourseStatus;
    progress: number;
    url?: string;
}

// --- Salary ---
export interface SalaryData {
    role: string;
    min: number;
    median: number;
    max: number;
}

// --- Notifications ---
export interface Notification {
    id: string;
    title: string;
    description: string;
    timestamp: string;
    read: boolean;
}
