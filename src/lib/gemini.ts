// ================================================
// SkillSync — Gemini AI Client
// All AI-powered features call through these helpers
// ================================================

import { GoogleGenAI } from '@google/genai';
import type {
    AptitudeQuestion,
    AtsReport,
    InterviewFeedback,
    Job,
    SkillGapResult,
} from './types';

// Initialize the client with the key injected by Vite
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const MODEL = 'gemini-2.0-flash';

// ---- Helpers ----

/**
 * Send a prompt to Gemini and get the text response.
 */
async function ask(prompt: string, systemInstruction?: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: systemInstruction ? { systemInstruction } : undefined,
    });
    return response.text ?? '';
}

/**
 * Send a prompt and parse the JSON response.
 */
async function askJSON<T>(prompt: string, systemInstruction?: string): Promise<T> {
    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            ...(systemInstruction ? { systemInstruction } : {}),
        },
    });
    const text = response.text ?? '{}';
    return JSON.parse(text) as T;
}

// ================================================
// Feature-Specific Functions
// ================================================

/**
 * RESUME BUILDER — Enhance bullet points with stronger action verbs & metrics.
 */
export async function enhanceResumeBullets(bullets: string[]): Promise<string[]> {
    const result = await askJSON<{ bullets: string[] }>(
        `You are a professional resume writer. Enhance these resume bullet points to be more impactful.
Use strong action verbs (Spearheaded, Engineered, Optimized, Architected, etc.).
Add quantified metrics where possible (percentages, numbers, dollar amounts).
Keep each bullet concise (1-2 lines max).
Maintain the original meaning but make it more powerful.

Original bullets:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Return a JSON object with a "bullets" array containing the enhanced versions in the same order.`
    );
    return result.bullets;
}

/**
 * APTITUDE TEST — Generate questions for a given category and difficulty.
 */
export async function generateAptitudeQuestions(
    category: string,
    difficulty: 'Easy' | 'Medium' | 'Hard',
    count: number = 5
): Promise<AptitudeQuestion[]> {
    const result = await askJSON<{ questions: AptitudeQuestion[] }>(
        `Generate ${count} multiple-choice aptitude test questions.

Category: ${category}
Difficulty: ${difficulty}

Each question must have:
- "id": sequential number starting from 1
- "category": "${category}"
- "difficulty": "${difficulty}"
- "text": the question text
- "options": array of 4 answer choices
- "correct": index (0-3) of the correct answer
- "explanation": brief explanation of the correct answer

Make questions challenging and diverse. Include real-world problem solving.
Return a JSON object with a "questions" array.`
    );
    return result.questions;
}

/**
 * MOCK INTERVIEW — Get an AI interviewer response in a conversation.
 */
export async function chatWithInterviewer(
    history: { role: string; content: string }[],
    userMessage: string,
    topic: string,
    targetRole: string
): Promise<string> {
    const systemInstruction = `You are Sarah, an experienced technical interviewer at a top tech company. You are conducting a ${topic} interview for a ${targetRole} position.

Your interview style:
- Be professional, encouraging, but thorough
- Ask one question at a time
- After the candidate answers, give brief positive feedback (1 sentence) then ask the next question
- Cover both conceptual understanding and practical experience
- If this is the first message, introduce yourself briefly and ask the first question
- Keep responses concise (2-4 sentences max)`;

    // Build properly structured contents array for Gemini multi-turn format
    // Gemini uses 'user' and 'model' roles (not 'user' / 'interviewer')
    const contents = [
        // Map previous history to proper Gemini roles
        ...history.map(msg => ({
            role: msg.role === 'interviewer' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        })),
        // Add the new user message
        {
            role: 'user',
            parts: [{ text: userMessage }],
        },
    ];

    const response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: { systemInstruction },
    });

    return response.text ?? 'I apologize, I could not generate a response. Please try again.';
}


/**
 * MOCK INTERVIEW — Generate a feedback summary for the entire session.
 */
export async function generateInterviewFeedback(
    messages: { role: string; content: string }[],
    topic: string
): Promise<InterviewFeedback> {
    const transcript = messages
        .map((msg) => `${msg.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${msg.content}`)
        .join('\n\n');

    return askJSON<InterviewFeedback>(
        `Analyze this ${topic} technical interview transcript and provide feedback.

Transcript:
${transcript}

Return a JSON object with:
- "overallScore": number from 0-100 (weighted average of the three sub-scores)
- "technicalScore": number from 0-100 (depth and correctness of technical answers)
- "communicationScore": number from 0-100 (clarity, structure, and articulation)
- "confidenceScore": number from 0-100 (assertiveness, decisiveness, pacing)
- "strengths": array of 2-3 strength strings
- "improvements": array of 2-3 improvement area strings
- "summary": 2-3 sentence overall performance summary
- "communicationStyle": a single sentence describing the candidate's communication style (e.g. "Clear and structured, but slightly rushed at times")
- "idealAnswers": array of objects, one per candidate answer, each with:
  - "question": the interviewer's question text (verbatim or summarised)
  - "ideal": the ideal 2-3 sentence model answer for that question`
    );
}

/**
 * SKILL GAP ANALYZER — Analyze user skills against a target job role.
 */
export async function analyzeSkillGap(
    userSkills: string[],
    targetRole: string,
    industry?: string
): Promise<SkillGapResult> {
    return askJSON<SkillGapResult>(
        `You are a career counselor and technical recruiter. Analyze the skill gap for this candidate.

Candidate's current skills: ${userSkills.join(', ')}
Target role: ${targetRole}
${industry ? `Industry: ${industry}` : ''}

Compare their skills against what's typically required for the target role.

Return a JSON object with:
- "targetRole": the target role name
- "matchPercentage": number 0-100 showing overall match
- "matchedSkills": array of objects with {"name": string, "category": string, "importance": "High"|"Medium"|"Low"} for skills the candidate HAS
- "missingSkills": array of objects with {"name": string, "category": string, "importance": "High"|"Medium"|"Low"} for skills the candidate is MISSING

Include 5-10 relevant skills in total. Be realistic about importance levels.`
    );
}

/**
 * ATS LINTER — Score a resume against ATS best practices.
 */
export async function lintResumeForATS(resumeText: string): Promise<AtsReport> {
    return askJSON<AtsReport>(
        `You are an Applicant Tracking System (ATS) expert. Analyze this resume for ATS compatibility.

Resume:
${resumeText}

Check for:
1. Formatting issues (tables, columns, images, headers/footers)
2. Contact information parsability
3. Standard section headings (Experience, Education, Skills)
4. Action verb usage in bullet points
5. Keyword optimization
6. File format considerations
7. Date format consistency
8. Quantified achievements

Return a JSON object with:
- "score": number 0-100 (ATS compatibility score)
- "issues": array of objects, each with:
  - "type": "error" | "warning" | "pass"
  - "title": short issue title
  - "description": detailed explanation and fix suggestion

Include at least 2 passes, 1-3 warnings, and 0-2 errors. Be realistic.`
    );
}

/**
 * JOB SUGGESTIONS — Generate matched jobs based on user skills.
 */
export async function generateJobSuggestions(
    skills: string[],
    targetRole?: string,
    location?: string
): Promise<Job[]> {
    const result = await askJSON<{ jobs: Job[] }>(
        `You are a job matching AI. Generate 6 realistic job listings that match this candidate's profile.

Candidate skills: ${skills.join(', ')}
${targetRole ? `Preferred role: ${targetRole}` : ''}
${location ? `Preferred location: ${location}` : ''}

For each job, return:
- "id": sequential number starting from 1
- "title": job title
- "company": a real well-known tech company name
- "location": city or "Remote"
- "salary": salary range as string (e.g., "$120k - $150k")
- "matchScore": 60-99 match percentage based on skills overlap
- "type": "Full-time" | "Part-time" | "Internship" | "Contract"
- "posted": realistic time ago string (e.g., "2 days ago")
- "skills": array of 3-5 required skills
- "description": 1-2 sentence job description

Return a JSON object with a "jobs" array. Sort by matchScore descending.`
    );
    return result.jobs;
}

/**
 * RESUME BUILDER — Generate a professional summary from role, skills, and experience.
 */
export async function generateProfessionalSummary(
    targetRole: string,
    skills: string[],
    yearsOfExperience: string
): Promise<string> {
    return ask(
        `Write a concise, powerful 2-3 sentence professional summary for a resume.
Target Role: ${targetRole}
Years of Experience: ${yearsOfExperience}
Top Skills: ${skills.slice(0, 8).join(', ')}

Requirements:
- Start with a strong opening (e.g. "Results-driven", "Passionate", "Innovative")
- Mention the target role and years of experience
- Highlight 2-3 key skills or achievements
- End with a value proposition (what they bring to the employer)
- Keep it under 60 words, no clichés, ATS-friendly
- Return ONLY the summary text, no quotes or labels`
    );
}

/**
 * RESUME BUILDER — Rewrite a single bullet point for maximum impact.
 */
export async function rewriteSingleBullet(bullet: string): Promise<string> {
    return ask(
        `Rewrite this resume bullet point to be more impactful and ATS-optimized.

Original: "${bullet}"

Rules:
- Start with a strong action verb (Engineered, Spearheaded, Architected, Optimized, etc.)
- Add quantified metrics if not present (estimate reasonable numbers)
- Keep it to 1 line max
- Do NOT add quotes or explanations
- Return ONLY the rewritten bullet`
    );
}
