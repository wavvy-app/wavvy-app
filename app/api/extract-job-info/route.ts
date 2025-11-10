import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { mapToRoleTemplate, ROLE_TEMPLATES } from '@/lib/roleMapper';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { job_description } = await req.json();

    if (!job_description?.trim()) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    const prompt = buildExtractionPrompt(job_description);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    let responseText = completion.choices[0]?.message?.content || '';
    responseText = cleanMarkdownCodeBlocks(responseText);

    const extracted = JSON.parse(responseText);

    if (!extracted.job_title?.trim()) {
      return NextResponse.json(
        { error: "Could not find a job title in the description. Please try again or fill the form manually." },
        { status: 400 }
      );
    }

    const responsibilities = Array.isArray(extracted.key_responsibilities) 
      ? extracted.key_responsibilities.filter((r: any) => r?.trim()) 
      : [];
      
    const skills = Array.isArray(extracted.required_skills)
      ? extracted.required_skills.filter((s: any) => s?.trim())
      : [];

    if (responsibilities.length === 0 && skills.length === 0) {
      return NextResponse.json(
        { error: "Could not extract responsibilities or skills. Please check your job description or fill manually." },
        { status: 400 }
      );
    }

    const validatedRoleTemplate = mapToRoleTemplate(
      extracted.role_template || extracted.job_title || ''
    );

    const result = {
      job_title: extracted.job_title.trim(),
      industry: extracted.industry?.trim() || 'General',
      location: extracted.location?.trim() || '',
      seniority: extracted.seniority?.trim() || 'Mid-level',
      job_type: extracted.job_type?.trim() || 'Full-time',
      work_model: extracted.work_model?.trim() || 'On-site',
      language: extracted.language?.trim() || 'English',
      role_template: validatedRoleTemplate,
      key_responsibilities: responsibilities,
      required_skills: skills,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse job description. Please ensure it contains clear job details." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to extract job information. The description might be too short or unclear. Try adding more details or fill the form manually." 
      },
      { status: 500 }
    );
  }
}

function buildExtractionPrompt(jobDescription: string): string {
  return `You are extracting structured information from a job description.

Job Description:
${jobDescription}

Extract the following and return as JSON:
{
  "job_title": "the exact job title",
  "industry": "the industry (e.g., Tech, Retail, Healthcare, Finance, Education, Hospitality)",
  "location": "the geographic location (city, region, or country where the job is based)",
  "seniority": "one of: Entry-level, Junior, Mid-level, Senior, Lead/Manager",
  "job_type": "one of: Full-time, Part-time, Contract, Internship, Temporary, Permanent",
  "work_model": "one of: Remote, Hybrid, On-site",
  "language": "interview language if mentioned, otherwise English",
  "role_template": "the job role/title that best describes this position (e.g., Software Engineer, Marketing Manager, Sales Representative)",
  "key_responsibilities": ["list all key responsibilities mentioned"],
  "required_skills": ["list all required skills mentioned"]
}

IMPORTANT: 
- For "role_template", extract the actual role/position title from the job description
- Be specific (e.g., "Graphic Designer" not just "Designer", "Data Analyst" not just "Analyst")
- Return valid JSON only, no extra text

Be accurate. If something isn't clearly stated, make a reasonable inference based on context.`;
}

function cleanMarkdownCodeBlocks(text: string): string {
  return text.trim()
    .replace(/^```json\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '');
}