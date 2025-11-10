export const ROLE_TEMPLATES = [
  "Customer Support",
  "Customer Success / Account Management",
  "Sales",
  "Marketing",
  "Creative & Design",
  "Product & UX",
  "Software Engineering & IT",
  "Data & Analytics",
  "Operations & Administration",
  "Finance & Accounting",
  "Human Resources & Talent",
  "Legal & Compliance",
  "Education & Training",
  "Healthcare & Social Work",
  "General Professional",
] as const;

export type RoleTemplate = typeof ROLE_TEMPLATES[number];

const ROLE_KEYWORD_MAP: Record<string, RoleTemplate> = {
  "customer support": "Customer Support",
  "customer service": "Customer Support",
  "help desk": "Customer Support",
  "technical support": "Customer Support",
  "support specialist": "Customer Support",
  "tech support": "Customer Support",
  
  "customer success": "Customer Success / Account Management",
  "account manager": "Customer Success / Account Management",
  "csm": "Customer Success / Account Management",
  "client success": "Customer Success / Account Management",
  
  "sales": "Sales",
  "sdr": "Sales",
  "bdr": "Sales",
  "account executive": "Sales",
  "business development": "Sales",
  "sales representative": "Sales",
  "sales rep": "Sales",
  
  "marketing": "Marketing",
  "content writer": "Marketing",
  "content marketing": "Marketing",
  "social media": "Marketing",
  "seo": "Marketing",
  "digital marketing": "Marketing",
  "growth marketing": "Marketing",
  "brand": "Marketing",
  
  "graphic designer": "Creative & Design",
  "visual designer": "Creative & Design",
  "creative director": "Creative & Design",
  "video editor": "Creative & Design",
  "motion graphics": "Creative & Design",
  "illustrator": "Creative & Design",
  "animator": "Creative & Design",
  "art director": "Creative & Design",
  
  "product manager": "Product & UX",
  "ux designer": "Product & UX",
  "ui designer": "Product & UX",
  "product owner": "Product & UX",
  "product designer": "Product & UX",
  
  "software engineer": "Software Engineering & IT",
  "developer": "Software Engineering & IT",
  "devops": "Software Engineering & IT",
  "qa engineer": "Software Engineering & IT",
  "it support": "Software Engineering & IT",
  "web developer": "Software Engineering & IT",
  "full stack": "Software Engineering & IT",
  "backend": "Software Engineering & IT",
  "frontend": "Software Engineering & IT",
  "sre": "Software Engineering & IT",
  "programmer": "Software Engineering & IT",
  
  "data analyst": "Data & Analytics",
  "data scientist": "Data & Analytics",
  "analytics": "Data & Analytics",
  "data engineer": "Data & Analytics",
  "machine learning": "Data & Analytics",
  "ml engineer": "Data & Analytics",
  "business intelligence": "Data & Analytics",
  
  "operations": "Operations & Administration",
  "project manager": "Operations & Administration",
  "business analyst": "Operations & Administration",
  "operations manager": "Operations & Administration",
  "scrum master": "Operations & Administration",
  "office manager": "Operations & Administration",
  
  "finance": "Finance & Accounting",
  "accountant": "Finance & Accounting",
  "financial analyst": "Finance & Accounting",
  "accounting": "Finance & Accounting",
  "bookkeeper": "Finance & Accounting",
  
  "hr": "Human Resources & Talent",
  "recruiter": "Human Resources & Talent",
  "talent acquisition": "Human Resources & Talent",
  "human resources": "Human Resources & Talent",
  "people operations": "Human Resources & Talent",
  
  "lawyer": "Legal & Compliance",
  "attorney": "Legal & Compliance",
  "legal counsel": "Legal & Compliance",
  "paralegal": "Legal & Compliance",
  "compliance officer": "Legal & Compliance",
  "compliance": "Legal & Compliance",
  "legal": "Legal & Compliance",
  
  "teacher": "Education & Training",
  "instructor": "Education & Training",
  "trainer": "Education & Training",
  "educator": "Education & Training",
  "learning and development": "Education & Training",
  "l&d": "Education & Training",
  "instructional designer": "Education & Training",
  "professor": "Education & Training",
  
  "nurse": "Healthcare & Social Work",
  "healthcare": "Healthcare & Social Work",
  "support worker": "Healthcare & Social Work",
  "social worker": "Healthcare & Social Work",
  "caregiver": "Healthcare & Social Work",
  "nursing": "Healthcare & Social Work",
  "therapist": "Healthcare & Social Work",
  "counselor": "Healthcare & Social Work",
};

const SORTED_KEYWORDS = Object.keys(ROLE_KEYWORD_MAP).sort(
  (a, b) => b.length - a.length
);

export function mapToRoleTemplate(extractedRole: string): RoleTemplate {
  if (!extractedRole?.trim()) return "General Professional";
  
  const normalized = extractedRole.toLowerCase().trim();
  
  const junkInputs = ["na", "n/a", "none", "-", "", "null", "unspecified"];
  if (junkInputs.includes(normalized)) {
    return "General Professional";
  }
  
  const exactMatch = ROLE_TEMPLATES.find(
    t => t.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch;
  
  for (const keyword of SORTED_KEYWORDS) {
    if (normalized.includes(keyword)) {
      return ROLE_KEYWORD_MAP[keyword];
    }
  }
  
  return "General Professional";
}
