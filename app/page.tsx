'use client';

import { useState, useEffect } from 'react';
import { ROLE_TEMPLATES } from '@/lib/roleMapper';

const DEFAULT_OPENING = `Tell me about yourself and your professional background.

Why are you interested in this role and our company?`;

const DEFAULT_CLOSING = `When would you be available to start if offered the position?

Do you have any questions for us?`;

interface FormData {
  job_title: string;
  industry: string;
  location: string;
  seniority: string;
  job_type: string;
  work_model: string;
  role_template: string;
  key_responsibilities: string[];
  required_skills: string[];
  opening_questions: string;
  closing_questions: string;
}

interface InterviewResult {
  interview_id: string;
  questions: string[];
  interview_link: string;
}

export default function Home() {
  const [step, setStep] = useState<'paste' | 'review'>('paste');
  const [jobDescription, setJobDescription] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    job_title: '',
    industry: '',
    location: '',
    seniority: 'Mid-level',
    job_type: 'Full-time',
    work_model: 'Remote',
    role_template: 'General Professional',
    key_responsibilities: [],
    required_skills: [],
    opening_questions: DEFAULT_OPENING,
    closing_questions: DEFAULT_CLOSING,
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (result) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [result]);

  const handleExtract = async () => {
    if (!jobDescription.trim()) {
      setExtractError('Please paste a job description first');
      return;
    }

    setExtracting(true);
    setExtractError('');
    
    try {
      const response = await fetch('/api/extract-job-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: jobDescription }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract job information');
      }
      
      const extractedData = await response.json();
      
      setFormData({
        job_title: extractedData.job_title || '',
        industry: extractedData.industry || '',
        location: extractedData.location || '',
        seniority: extractedData.seniority || 'Mid-level',
        job_type: extractedData.job_type || 'Full-time',
        work_model: extractedData.work_model || 'Remote',
        role_template: extractedData.role_template || 'General Professional',
        key_responsibilities: extractedData.key_responsibilities?.length > 0 
          ? extractedData.key_responsibilities 
          : [''],
        required_skills: extractedData.required_skills?.length > 0 
          ? extractedData.required_skills 
          : [''],
        opening_questions: DEFAULT_OPENING,
        closing_questions: DEFAULT_CLOSING,
      });
      
      setStep('review');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'An error occurred while extracting job information');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanedData = {
      ...formData,
      key_responsibilities: formData.key_responsibilities.filter(r => r.trim()),
      required_skills: formData.required_skills.filter(s => s.trim()),
    };
    
    if (!cleanedData.job_title.trim()) {
      setError('Job title is required');
      return;
    }
    
    if (cleanedData.key_responsibilities.length === 0 && cleanedData.required_skills.length === 0) {
      setError('Add at least one responsibility or skill to generate relevant questions. Scroll up to the "Key Responsibilities" or "Required Skills" section.');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const response = await fetch('/api/generate-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cleanedData, num_questions: 10 }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate interview');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the interview');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.interview_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForm = () => {
    setFormData({
      job_title: '',
      industry: '',
      location: '',
      seniority: 'Mid-level',
      job_type: 'Full-time',
      work_model: 'Remote',
      role_template: 'General Professional',
      key_responsibilities: [],
      required_skills: [],
      opening_questions: DEFAULT_OPENING,
      closing_questions: DEFAULT_CLOSING,
    });
  };

  const handleBackToPaste = () => {
    setStep('paste');
    resetForm();
  };

  const handleCreateAnother = () => {
    setResult(null);
    setStep('paste');
    setJobDescription('');
    resetForm();
  };

  const isFormValid = 
    formData.job_title.trim() !== '' && 
    (formData.key_responsibilities.some(r => r.trim()) || formData.required_skills.some(s => s.trim()));

  const updateResponsibility = (index: number, value: string) => {
    const updated = [...formData.key_responsibilities];
    updated[index] = value;
    setFormData({ ...formData, key_responsibilities: updated });
  };

  const removeResponsibility = (index: number) => {
    const updated = formData.key_responsibilities.filter((_, i) => i !== index);
    setFormData({ ...formData, key_responsibilities: updated });
  };

  const addResponsibility = () => {
    setFormData({
      ...formData,
      key_responsibilities: [...formData.key_responsibilities, '']
    });
  };

  const updateSkill = (index: number, value: string) => {
    const updated = [...formData.required_skills];
    updated[index] = value;
    setFormData({ ...formData, required_skills: updated });
  };

  const removeSkill = (index: number) => {
    const updated = formData.required_skills.filter((_, i) => i !== index);
    setFormData({ ...formData, required_skills: updated });
  };

  const addSkill = () => {
    setFormData({
      ...formData,
      required_skills: [...formData.required_skills, '']
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center pt-8 pb-6 mb-6">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent mb-4 drop-shadow-sm pb-1">
            Wavvy - Create AI Interview
          </h1>
          <p className="text-gray-700 text-lg font-medium">
            Paste your job description and let AI do the work
          </p>
        </div>

        {step === 'paste' && (
          <div className="bg-white p-8 rounded-xl shadow-md">
            <div className="mb-6">
              <label className="block mb-2 font-semibold text-lg text-gray-800">
                Paste Job Description
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Copy and paste your job posting. AI will extract all relevant details.
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="w-full border border-gray-200 p-4 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                rows={12}
                placeholder="Example:&#10;&#10;We're looking for a Retail Sales Assistant to join our team...&#10;&#10;Responsibilities:&#10;- Customer service&#10;- Sales&#10;- Stock management&#10;&#10;Requirements:&#10;- 1+ years experience&#10;- Strong communication skills&#10;..."
              />
              <p className="text-xs text-gray-500 mt-2">
                {jobDescription.length} characters
                {jobDescription.length > 0 && jobDescription.length < 100 && ' (paste more for better results)'}
              </p>
            </div>

            {extractError && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 text-red-700 rounded text-sm">
                {extractError}
              </div>
            )}

            <button
              onClick={handleExtract}
              disabled={extracting || !jobDescription.trim()}
              className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded-lg font-semibold hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-100"
            >
              {extracting ? 'Extracting Information...' : 'Extract Job Information →'}
            </button>

            <div className="mt-5 text-center">
              <button
                onClick={() => setStep('review')}
                className="text-[#667eea] hover:text-[#764ba2] font-medium text-sm transition-colors"
              >
                Or fill form manually
              </button>
            </div>
          </div>
        )}

        {step === 'review' && !result && (
          <div className="bg-white p-8 rounded-xl shadow-md space-y-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Review & Edit Details</h2>
              <button
                type="button"
                onClick={handleBackToPaste}
                className="text-sm text-gray-600 hover:text-[#667eea] font-medium transition-colors"
              >
                ← Back to paste
              </button>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-gray-800">Position Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">Job Title *</label>
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                    className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Industry</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                      placeholder="e.g., Retail"
                    />
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                      placeholder="e.g., London, UK"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Optional — leave blank for remote or location-flexible roles
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Seniority</label>
                    <select
                      value={formData.seniority}
                      onChange={(e) => setFormData({...formData, seniority: e.target.value})}
                      className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    >
                      <option>Entry-level</option>
                      <option>Junior</option>
                      <option>Mid-level</option>
                      <option>Senior</option>
                      <option>Lead/Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Job Type</label>
                    <select
                      value={formData.job_type}
                      onChange={(e) => setFormData({...formData, job_type: e.target.value})}
                      className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    >
                      <option>Full-time</option>
                      <option>Part-time</option>
                      <option>Contract</option>
                      <option>Internship</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Work Model</label>
                    <select
                      value={formData.work_model}
                      onChange={(e) => setFormData({...formData, work_model: e.target.value})}
                      className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    >
                      <option>Remote</option>
                      <option>Hybrid</option>
                      <option>On-site</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">Role Template</label>
                    <select
                      value={formData.role_template}
                      onChange={(e) => setFormData({...formData, role_template: e.target.value})}
                      className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    >
                      {ROLE_TEMPLATES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Key Responsibilities</label>
              {formData.key_responsibilities.length === 0 && (
                <p className="text-sm text-gray-500 italic mb-2">
                  No responsibilities detected. Add some manually below.
                </p>
              )}
              <div className="space-y-2">
                {formData.key_responsibilities.map((resp, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={resp}
                      onChange={(e) => updateResponsibility(index, e.target.value)}
                      className="flex-1 border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeResponsibility(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addResponsibility}
                  className="text-sm text-[#667eea] hover:text-[#764ba2] font-medium transition-colors"
                >
                  + Add responsibility
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Required Skills</label>
              {formData.required_skills.length === 0 && (
                <p className="text-sm text-gray-500 italic mb-2">
                  No skills detected. Add some manually below.
                </p>
              )}
              <div className="space-y-2">
                {formData.required_skills.map((skill, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={skill}
                      onChange={(e) => updateSkill(index, e.target.value)}
                      className="flex-1 border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSkill}
                  className="text-sm text-[#667eea] hover:text-[#764ba2] font-medium transition-colors"
                >
                  + Add skill
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-5 rounded-lg border-2 border-gray-200 opacity-80 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-gray-200 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded">System Required</span>
                <span className="text-xs text-gray-400">Verifies identity & microphone</span>
              </div>
              <p className="text-sm text-gray-800 font-medium font-mono bg-white p-3 rounded border border-gray-100">
                "To begin, please look at the camera and state your full name and the role you are applying for."
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Opening Questions <span className="text-gray-500 font-normal">(Edit as needed)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, opening_questions: ''})}
                  className="text-xs text-gray-600 hover:text-red-600 transition-colors font-medium"
                >
                  Clear all
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Warm-up questions to help candidates settle in. These are pre-filled but you can customize them.
              </p>
              <textarea
                value={formData.opening_questions}
                onChange={(e) => setFormData({...formData, opening_questions: e.target.value})}
                maxLength={1000}
                className="w-full border border-gray-200 p-4 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 One question per line • These appear before AI-generated questions
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
              <p className="text-sm text-gray-700 font-medium">
                ✨ AI will generate several in-depth, role-specific questions based on the job details, responsibilities, and skills
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Closing Questions <span className="text-gray-500 font-normal">(Edit as needed)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({...formData, closing_questions: ''})}
                  className="text-xs text-gray-600 hover:text-red-600 transition-colors font-medium"
                >
                  Clear all
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Final questions to assess expectations and availability. These are pre-filled but you can customize them.
              </p>
              <textarea
                value={formData.closing_questions}
                onChange={(e) => setFormData({...formData, closing_questions: e.target.value})}
                maxLength={1000}
                className="w-full border border-gray-200 p-4 rounded-lg focus:ring-2 focus:ring-[#667eea] focus:border-transparent"
                rows={5}
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 One question per line • These appear after all other questions
              </p>
            </div>

            {error && (
              <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-500 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !isFormValid}
              className="w-full bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white p-4 rounded-lg font-semibold hover:shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-100"
            >
              {loading ? 'Generating Interview...' : 'Generate Interview Questions'}
            </button>
          </div>
        )}

        {result && (
          <>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 rounded-lg p-6 mb-6 shadow-md">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">Interview Created! 🎉</h2>
              <p className="text-gray-700 text-sm">Share this link with your candidate to start the interview</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-md">
              <div className="mb-6">
                <label className="block font-semibold mb-3 text-gray-800">Interview Link:</label>
                <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 font-mono text-sm break-all mb-4">
                  {result.interview_link}
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-100"
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                  
                  <a
                    href={result.interview_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all transform hover:scale-[1.02] active:scale-100 text-center"
                  >
                    View Interview →
                  </a>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border-2 border-blue-100">
                <label className="block font-semibold mb-3 text-gray-800">
                  Complete Interview ({result.questions.length} questions):
                </label>
                <ol className="list-decimal list-inside space-y-2">
                  {result.questions.map((q: string, i: number) => (
                    <li key={i} className="text-gray-700 leading-relaxed">{q.replace(/^\d+\.\s*/, '')}</li>
                  ))}
                </ol>
              </div>

              <button
                onClick={handleCreateAnother}
                className="mt-6 w-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 p-4 rounded-lg font-semibold hover:from-gray-200 hover:to-gray-300 transition-all"
              >
                Create Another Interview
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}