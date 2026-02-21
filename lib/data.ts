// Mock data for Motian recruitment platform — Dutch-localized

export interface Candidate {
  id: string
  name: string
  email: string
  role: string
  avatar: string
  score: number
  skills: string[]
  experience: string
  status: "new" | "screening" | "interview" | "offer" | "hired" | "rejected"
  appliedDate: string
  source: string
  resumeQuality: number
  skillMatch: number
  relevance: number
  location: string
  phone: string
  tags: string[]
}

export interface Job {
  id: string
  title: string
  department: string
  location: string
  type: string
  applicants: number
  status: "active" | "paused" | "closed"
  postedDate: string
  requiredSkills: string[]
}

export interface Interview {
  id: string
  candidateId: string
  candidateName: string
  role: string
  date: string
  time: string
  type: "phone" | "video" | "onsite" | "technical"
  interviewer: string
  status: "scheduled" | "completed" | "cancelled"
  feedback?: string
  rating?: number
}

export interface MessageItem {
  id: string
  subject: string
  recipients: number
  sentDate: string
  status: "sent" | "draft" | "scheduled"
  openRate?: number
  template: string
}

export const pipelineStages = [
  { id: "new", name: "Nieuw", color: "#8e8e8e" },
  { id: "screening", name: "Screening", color: "#10a37f" },
  { id: "interview", name: "Interview", color: "#f59e0b" },
  { id: "offer", name: "Aanbieding", color: "#6366f1" },
  { id: "hired", name: "Geplaatst", color: "#22c55e" },
] as const

export const candidates: Candidate[] = [
  {
    id: "c1",
    name: "Jan de Vries",
    email: "jan.devries@gmail.com",
    role: "Senior Full-Stack Developer",
    avatar: "/avatars/01.png",
    score: 92,
    skills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
    experience: "8 jaar",
    status: "interview",
    appliedDate: "2026-02-03",
    source: "Striive",
    resumeQuality: 90,
    skillMatch: 94,
    relevance: 91,
    location: "Amsterdam",
    phone: "+31 6 1234 5678",
    tags: ["senior", "full-stack", "beschikbaar"],
  },
  {
    id: "c2",
    name: "Fatima El Amrani",
    email: "f.elamrani@outlook.com",
    role: "Data Engineer",
    avatar: "/avatars/02.png",
    score: 88,
    skills: ["Python", "Spark", "Airflow", "AWS", "SQL"],
    experience: "5 jaar",
    status: "screening",
    appliedDate: "2026-02-05",
    source: "LinkedIn",
    resumeQuality: 85,
    skillMatch: 90,
    relevance: 88,
    location: "Utrecht",
    phone: "+31 6 2345 6789",
    tags: ["data", "cloud", "Engels vloeiend"],
  },
  {
    id: "c3",
    name: "Sophie van den Berg",
    email: "sophie.vdberg@hotmail.com",
    role: "UX/UI Designer",
    avatar: "/avatars/03.png",
    score: 85,
    skills: ["Figma", "Adobe XD", "User Research", "Prototyping"],
    experience: "4 jaar",
    status: "new",
    appliedDate: "2026-02-10",
    source: "Striive",
    resumeQuality: 88,
    skillMatch: 82,
    relevance: 84,
    location: "Rotterdam",
    phone: "+31 6 3456 7890",
    tags: ["design", "freelance"],
  },
  {
    id: "c4",
    name: "Daan Bakker",
    email: "d.bakker@proton.me",
    role: "DevOps Engineer",
    avatar: "/avatars/04.png",
    score: 91,
    skills: ["Kubernetes", "Terraform", "CI/CD", "Azure", "Docker"],
    experience: "6 jaar",
    status: "offer",
    appliedDate: "2026-02-01",
    source: "Referral",
    resumeQuality: 92,
    skillMatch: 90,
    relevance: 91,
    location: "Eindhoven",
    phone: "+31 6 4567 8901",
    tags: ["devops", "cloud", "senior"],
  },
  {
    id: "c5",
    name: "Lotte Jansen",
    email: "lotte.jansen@gmail.com",
    role: "Frontend Developer",
    avatar: "/avatars/05.png",
    score: 79,
    skills: ["React", "Vue.js", "CSS", "TypeScript"],
    experience: "3 jaar",
    status: "new",
    appliedDate: "2026-02-12",
    source: "Striive",
    resumeQuality: 76,
    skillMatch: 80,
    relevance: 78,
    location: "Den Haag",
    phone: "+31 6 5678 9012",
    tags: ["frontend", "medior"],
  },
  {
    id: "c6",
    name: "Mohammed Yilmaz",
    email: "m.yilmaz@outlook.com",
    role: "Backend Developer",
    avatar: "/avatars/06.png",
    score: 87,
    skills: ["Java", "Spring Boot", "Kafka", "Microservices"],
    experience: "7 jaar",
    status: "interview",
    appliedDate: "2026-02-04",
    source: "LinkedIn",
    resumeQuality: 84,
    skillMatch: 88,
    relevance: 86,
    location: "Amsterdam",
    phone: "+31 6 6789 0123",
    tags: ["backend", "senior", "Java"],
  },
  {
    id: "c7",
    name: "Emma Visser",
    email: "emma.visser@gmail.com",
    role: "Product Owner",
    avatar: "/avatars/07.png",
    score: 83,
    skills: ["Scrum", "Jira", "Stakeholder Management", "Roadmapping"],
    experience: "5 jaar",
    status: "screening",
    appliedDate: "2026-02-08",
    source: "Striive",
    resumeQuality: 80,
    skillMatch: 84,
    relevance: 82,
    location: "Utrecht",
    phone: "+31 6 7890 1234",
    tags: ["agile", "product"],
  },
  {
    id: "c8",
    name: "Thomas Mulder",
    email: "t.mulder@proton.me",
    role: "Cloud Architect",
    avatar: "/avatars/08.png",
    score: 95,
    skills: ["AWS", "Azure", "GCP", "Terraform", "Architecture"],
    experience: "10 jaar",
    status: "hired",
    appliedDate: "2026-02-01",
    source: "Referral",
    resumeQuality: 95,
    skillMatch: 94,
    relevance: 95,
    location: "Amsterdam",
    phone: "+31 6 8901 2345",
    tags: ["architect", "senior", "multi-cloud"],
  },
  {
    id: "c9",
    name: "Noor de Groot",
    email: "noor.degroot@hotmail.com",
    role: "QA Engineer",
    avatar: "/avatars/09.png",
    score: 76,
    skills: ["Selenium", "Cypress", "Jest", "Test Automation"],
    experience: "3 jaar",
    status: "rejected",
    appliedDate: "2026-02-06",
    source: "Striive",
    resumeQuality: 72,
    skillMatch: 78,
    relevance: 74,
    location: "Groningen",
    phone: "+31 6 9012 3456",
    tags: ["testing", "automation"],
  },
  {
    id: "c10",
    name: "Bram van Dijk",
    email: "bram.vandijk@gmail.com",
    role: "Machine Learning Engineer",
    avatar: "/avatars/10.png",
    score: 90,
    skills: ["Python", "PyTorch", "MLOps", "NLP", "Computer Vision"],
    experience: "4 jaar",
    status: "screening",
    appliedDate: "2026-02-11",
    source: "LinkedIn",
    resumeQuality: 88,
    skillMatch: 92,
    relevance: 89,
    location: "Delft",
    phone: "+31 6 0123 4567",
    tags: ["ML", "AI", "Python"],
  },
]

export const interviews: Interview[] = [
  {
    id: "i1",
    candidateId: "c1",
    candidateName: "Jan de Vries",
    role: "Senior Full-Stack Developer",
    date: "2026-02-24",
    time: "10:00",
    type: "technical",
    interviewer: "Lisa van Houten",
    status: "scheduled",
  },
  {
    id: "i2",
    candidateId: "c6",
    candidateName: "Mohammed Yilmaz",
    role: "Backend Developer",
    date: "2026-02-24",
    time: "14:00",
    type: "video",
    interviewer: "Pieter de Boer",
    status: "scheduled",
  },
  {
    id: "i3",
    candidateId: "c4",
    candidateName: "Daan Bakker",
    role: "DevOps Engineer",
    date: "2026-02-20",
    time: "11:00",
    type: "onsite",
    interviewer: "Lisa van Houten",
    status: "completed",
    feedback: "Uitstekende technische kennis, sterke communicatie.",
    rating: 9,
  },
  {
    id: "i4",
    candidateId: "c8",
    candidateName: "Thomas Mulder",
    role: "Cloud Architect",
    date: "2026-02-18",
    time: "09:30",
    type: "technical",
    interviewer: "Pieter de Boer",
    status: "completed",
    feedback: "Zeer ervaren, goed architectureel inzicht. Direct aanbod gedaan.",
    rating: 10,
  },
  {
    id: "i5",
    candidateId: "c2",
    candidateName: "Fatima El Amrani",
    role: "Data Engineer",
    date: "2026-02-25",
    time: "13:00",
    type: "phone",
    interviewer: "Sarah Hendriks",
    status: "scheduled",
  },
  {
    id: "i6",
    candidateId: "c10",
    candidateName: "Bram van Dijk",
    role: "Machine Learning Engineer",
    date: "2026-02-26",
    time: "15:30",
    type: "video",
    interviewer: "Sarah Hendriks",
    status: "scheduled",
  },
]

export const messages: MessageItem[] = [
  {
    id: "m1",
    subject: "Welkom bij het sollicitatieproces",
    recipients: 12,
    sentDate: "2026-02-18",
    status: "sent",
    openRate: 83,
    template: "Onboarding",
  },
  {
    id: "m2",
    subject: "Uitnodiging technisch interview",
    recipients: 4,
    sentDate: "2026-02-19",
    status: "sent",
    openRate: 100,
    template: "Interview",
  },
  {
    id: "m3",
    subject: "Status update - Uw sollicitatie",
    recipients: 8,
    sentDate: "2026-02-20",
    status: "sent",
    openRate: 75,
    template: "Status Update",
  },
  {
    id: "m4",
    subject: "Nieuwe opdrachten beschikbaar - februari",
    recipients: 45,
    sentDate: "2026-02-22",
    status: "scheduled",
    template: "Nieuwsbrief",
  },
  {
    id: "m5",
    subject: "Aanbod - DevOps Engineer positie",
    recipients: 1,
    sentDate: "2026-02-20",
    status: "sent",
    openRate: 100,
    template: "Aanbieding",
  },
  {
    id: "m6",
    subject: "Referral bonus programma Q1 2026",
    recipients: 30,
    sentDate: "",
    status: "draft",
    template: "Campagne",
  },
]

export const positionsList: Job[] = [
  {
    id: "j1",
    title: "Senior Full-Stack Developer",
    department: "Engineering",
    location: "Amsterdam",
    type: "Full-time",
    applicants: 47,
    status: "active",
    postedDate: "2026-01-20",
    requiredSkills: ["React", "Node.js", "TypeScript"],
  },
  {
    id: "j2",
    title: "Data Engineer",
    department: "Data",
    location: "Utrecht",
    type: "Full-time",
    applicants: 32,
    status: "active",
    postedDate: "2026-01-25",
    requiredSkills: ["Python", "Spark", "AWS"],
  },
  {
    id: "j3",
    title: "UX/UI Designer",
    department: "Design",
    location: "Rotterdam",
    type: "Full-time",
    applicants: 28,
    status: "active",
    postedDate: "2026-02-01",
    requiredSkills: ["Figma", "User Research", "Prototyping"],
  },
  {
    id: "j4",
    title: "DevOps Engineer",
    department: "Infrastructure",
    location: "Eindhoven",
    type: "Full-time",
    applicants: 19,
    status: "active",
    postedDate: "2026-02-05",
    requiredSkills: ["Kubernetes", "Terraform", "Docker"],
  },
  {
    id: "j5",
    title: "Backend Developer",
    department: "Engineering",
    location: "Amsterdam",
    type: "Full-time",
    applicants: 35,
    status: "active",
    postedDate: "2026-01-15",
    requiredSkills: ["Java", "Spring Boot", "Kafka"],
  },
  {
    id: "j6",
    title: "Machine Learning Engineer",
    department: "AI/ML",
    location: "Delft",
    type: "Full-time",
    applicants: 22,
    status: "active",
    postedDate: "2026-02-10",
    requiredSkills: ["Python", "PyTorch", "MLOps"],
  },
]
