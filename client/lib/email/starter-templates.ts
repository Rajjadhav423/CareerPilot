/**
 * Ready-to-use application emails, written to common industry practice: short, specific, one clear ask, and a
 * signature with contact details. They use only built-in fields, so they work for everyone; {{resume_url}} is
 * filled from the "Resume link" detail in Settings.
 */
export type StarterTemplate = { id: string; name: string; description: string; subject: string; body: string };

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "application",
    name: "Job application",
    description: "A concise application for a posted role, with your resume link.",
    subject: "Application for {{job_title}} – {{candidate_name}}",
    body: `Dear Hiring Team,

I am writing to apply for the {{job_title}} position at {{company_name}}. I build reliable, well-tested software and enjoy working closely with product and design to ship features that matter to users.

I would welcome the opportunity to bring that experience to {{company_name}}. My resume is available here: {{resume_url}}

Thank you for your time and consideration. I look forward to hearing from you.

Best regards,
{{candidate_name}}
{{candidate_email}}`,
  },
  {
    id: "recruiter",
    name: "Recruiter outreach",
    description: "A short note to a recruiter or hiring manager about a specific opening.",
    subject: "{{job_title}} at {{company_name}} – {{candidate_name}}",
    body: `Hi,

I came across the {{job_title}} opening at {{company_name}} ({{job_url}}) and believe my background is a strong match. I have hands-on experience delivering production features end to end, from design through deployment and support.

Would you be open to a short call this week to discuss the role? My resume is here: {{resume_url}}

Thanks in advance,
{{candidate_name}}
{{candidate_email}}`,
  },
  {
    id: "follow-up",
    name: "Follow-up after applying",
    description: "A polite check-in about a week after you applied.",
    subject: "Following up on my application – {{job_title}}",
    body: `Dear Hiring Team,

I applied for the {{job_title}} position at {{company_name}} on {{application_date}} and wanted to follow up on my application. I remain very interested in the role and in contributing to your team.

If it would help, I am happy to share more about my experience or answer any questions. My resume is available here: {{resume_url}}

Thank you for your time.

Kind regards,
{{candidate_name}}
{{candidate_email}}`,
  },
];
