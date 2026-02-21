"use client";

import { useState, useMemo, useEffect } from "react";
import { interviews } from "@/lib/data";
import type { Interview } from "@/lib/data";
import {
  CalendarDays,
  CheckCircle2,
  Star,
  XCircle,
  Plus,
  Clock,
  Video,
  Phone,
  MapPin,
  Cpu,
  User,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const typeLabels: Record<string, string> = {
  phone: "Telefoon",
  video: "Video",
  onsite: "Op locatie",
  technical: "Technisch",
};

const typeIcons: Record<string, React.ReactNode> = {
  video: <Video className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  onsite: <MapPin className="h-3.5 w-3.5" />,
  technical: <Cpu className="h-3.5 w-3.5" />,
};

const statusColors: Record<string, string> = {
  scheduled: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  scheduled: "Gepland",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

const candidateOptions = [
  { value: "jan", label: "Jan de Vries", role: "Frontend Developer" },
  { value: "fatima", label: "Fatima El Amrani", role: "UX Designer" },
  { value: "sophie", label: "Sophie van den Berg", role: "Data Analyst" },
  { value: "daan", label: "Daan Bakker", role: "Backend Developer" },
  { value: "lotte", label: "Lotte Jansen", role: "Product Manager" },
  { value: "mohammed", label: "Mohammed Yilmaz", role: "DevOps Engineer" },
];

const interviewerOptions = [
  { value: "lisa", label: "Lisa van Houten" },
  { value: "pieter", label: "Pieter de Boer" },
  { value: "sarah", label: "Sarah Hendriks" },
];

function getDayName(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("nl-NL", { weekday: "short" });
}

function getDateNum(dateStr: string) {
  return new Date(dateStr + "T00:00:00").getDate();
}

function getMonthName(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("nl-NL", {
    month: "short",
  });
}

function getWeekDays(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function renderStars(rating: number) {
  const full = Math.floor(rating / 2);
  const half = rating % 2 >= 1;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(
        <Star
          key={i}
          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
        />
      );
    } else if (i === full && half) {
      stars.push(
        <Star
          key={i}
          className="h-3.5 w-3.5 fill-amber-400/50 text-amber-400"
        />
      );
    } else {
      stars.push(
        <Star key={i} className="h-3.5 w-3.5 text-[#2d2d2d]" />
      );
    }
  }
  return stars;
}

export default function InterviewsPage() {
  const [interviewList, setInterviewList] = useState<Interview[]>(interviews);
  const [typeFilter, setTypeFilter] = useState("alle");
  const [activeTab, setActiveTab] = useState("scheduled");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch real interview data on mount
  useEffect(() => {
    async function loadInterviews() {
      try {
        const res = await fetch("/api/interviews?limit=100");
        if (!res.ok) return; // fall back to mock data
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return;

        // Map DB records to the Interview type used by the UI
        const mapped: Interview[] = data.map((rec: Record<string, unknown>) => {
          const scheduledAt = (rec.scheduledAt as string) ?? "";
          const [datePart, timePart] = scheduledAt.includes("T")
            ? scheduledAt.split("T")
            : [scheduledAt, ""];
          return {
            id: rec.id as string,
            candidateId: (rec.applicationId as string) ?? "",
            candidateName: (rec.candidateName as string) ?? (rec.applicationId as string) ?? "Onbekend",
            role: (rec.role as string) ?? "",
            date: datePart,
            time: timePart ? timePart.slice(0, 5) : "",
            type: (rec.type as Interview["type"]) ?? "video",
            interviewer: (rec.interviewer as string) ?? "",
            status: (rec.status as Interview["status"]) ?? "scheduled",
            feedback: rec.feedback as string | undefined,
            rating: rec.rating as number | undefined,
          };
        });

        setInterviewList(mapped);
      } catch {
        /* keep mock data */
      }
    }
    loadInterviews();
  }, []);

  // Form state for "Gesprek Plannen"
  const [candidateSelect, setCandidateSelect] = useState("");
  const [interviewerSelect, setInterviewerSelect] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [timeInput, setTimeInput] = useState("");
  const [typeSelect, setTypeSelect] = useState("");
  const [notesInput, setNotesInput] = useState("");

  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackInterviewId, setFeedbackInterviewId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);

  const scheduled = interviewList.filter((i) => i.status === "scheduled");
  const completed = interviewList.filter((i) => i.status === "completed");
  const cancelled = interviewList.filter((i) => i.status === "cancelled");

  const filtered = useMemo(() => {
    let list = interviewList;
    if (typeFilter !== "alle") {
      list = list.filter((i) => i.type === typeFilter);
    }
    if (activeTab === "scheduled") return list.filter((i) => i.status === "scheduled");
    if (activeTab === "completed") return list.filter((i) => i.status === "completed");
    return list;
  }, [typeFilter, activeTab, interviewList]);

  const weekDays = getWeekDays();
  const today = new Date().toISOString().split("T")[0];

  const interviewsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    interviewList.forEach((i) => {
      map[i.date] = (map[i.date] || 0) + 1;
    });
    return map;
  }, [interviewList]);

  const avgRating = useMemo(() => {
    const rated = completed.filter((i) => i.rating != null);
    if (rated.length === 0) return 0;
    return +(
      rated.reduce((sum, i) => sum + (i.rating || 0), 0) / rated.length / 2
    ).toFixed(1);
  }, [completed]);

  function resetForm() {
    setCandidateSelect("");
    setInterviewerSelect("");
    setDateInput("");
    setTimeInput("");
    setTypeSelect("");
    setNotesInput("");
  }

  function handleCreateInterview() {
    if (!candidateSelect || !interviewerSelect || !dateInput || !timeInput || !typeSelect) {
      setToast("Vul alle verplichte velden in");
      return;
    }
    const candidate = candidateOptions.find((c) => c.value === candidateSelect);
    const interviewer = interviewerOptions.find((i) => i.value === interviewerSelect);
    if (!candidate || !interviewer) return;

    const newInterview: Interview = {
      id: `i-${Date.now()}`,
      candidateId: candidateSelect,
      candidateName: candidate.label,
      role: candidate.role,
      date: dateInput,
      time: timeInput,
      type: typeSelect as Interview["type"],
      interviewer: interviewer.label,
      status: "scheduled",
    };
    setInterviewList((prev) => [newInterview, ...prev]);
    setDialogOpen(false);
    resetForm();
    setToast(`Gesprek gepland met ${candidate.label}`);

    // Fire-and-forget API call to persist the interview
    fetch("/api/interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: candidateSelect,
        scheduledAt: `${dateInput}T${timeInput}:00`,
        type: typeSelect,
        interviewer: interviewer.label,
      }),
    }).catch(() => {});
  }

  function handleCancelInterview(interview: Interview) {
    setInterviewList((prev) =>
      prev.map((i) => (i.id === interview.id ? { ...i, status: "cancelled" as const } : i))
    );
    setToast(`Interview geannuleerd voor ${interview.candidateName}`);

    // Fire-and-forget API call to persist cancellation
    fetch(`/api/interviews/${interview.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {});
  }

  function handleOpenFeedback(interviewId: string) {
    setFeedbackInterviewId(interviewId);
    setFeedbackText("");
    setFeedbackRating(0);
    setFeedbackDialogOpen(true);
  }

  function handleSubmitFeedback() {
    if (!feedbackInterviewId || !feedbackText || feedbackRating === 0) {
      setToast("Vul feedback en beoordeling in");
      return;
    }
    setInterviewList((prev) =>
      prev.map((i) =>
        i.id === feedbackInterviewId
          ? { ...i, feedback: feedbackText, rating: feedbackRating * 2 }
          : i
      )
    );
    // Fire-and-forget API call to persist feedback
    fetch(`/api/interviews/${feedbackInterviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: feedbackText, rating: feedbackRating * 2 }),
    }).catch(() => {});

    setFeedbackDialogOpen(false);
    setFeedbackInterviewId(null);
    setToast("Feedback toegevoegd");
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#ececec]">Gesprekken</h1>
            <p className="text-sm text-[#6b6b6b] mt-1">
              Beheer en plan interviews met kandidaten
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] text-sm">
                <SelectValue placeholder="Filter op type" />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                <SelectItem value="alle">Alle</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="phone">Telefoon</SelectItem>
                <SelectItem value="onsite">Op locatie</SelectItem>
                <SelectItem value="technical">Technisch</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white gap-2">
                  <Plus className="h-4 w-4" />
                  Plan Gesprek
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle className="text-[#ececec]">
                    Gesprek Plannen
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-[#8e8e8e]">Kandidaat</Label>
                    <Select value={candidateSelect} onValueChange={setCandidateSelect}>
                      <SelectTrigger className="w-full bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                        <SelectValue placeholder="Selecteer kandidaat" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                        {candidateOptions.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8e8e8e]">Interviewer</Label>
                    <Select value={interviewerSelect} onValueChange={setInterviewerSelect}>
                      <SelectTrigger className="w-full bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                        <SelectValue placeholder="Selecteer interviewer" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                        {interviewerOptions.map((i) => (
                          <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[#8e8e8e]">Datum</Label>
                      <Input
                        type="date"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[#8e8e8e]">Tijd</Label>
                      <Input
                        type="time"
                        value={timeInput}
                        onChange={(e) => setTimeInput(e.target.value)}
                        className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8e8e8e]">Type</Label>
                    <Select value={typeSelect} onValueChange={setTypeSelect}>
                      <SelectTrigger className="w-full bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                        <SelectValue placeholder="Selecteer type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="phone">Telefoon</SelectItem>
                        <SelectItem value="onsite">Op locatie</SelectItem>
                        <SelectItem value="technical">Technisch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8e8e8e]">Notities</Label>
                    <Textarea
                      value={notesInput}
                      onChange={(e) => setNotesInput(e.target.value)}
                      placeholder="Voeg notities toe over dit gesprek..."
                      className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] min-h-[80px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    className="border-[#2d2d2d] text-[#8e8e8e] hover:bg-[#2d2d2d]"
                    onClick={() => setDialogOpen(false)}
                  >
                    Annuleren
                  </Button>
                  <Button
                    className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white"
                    onClick={handleCreateInterview}
                  >
                    Gesprek Plannen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-[#10a37f]/10 text-[#10a37f] flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">
                {scheduled.length}
              </p>
              <p className="text-xs text-[#6b6b6b]">Gepland</p>
            </div>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">
                {completed.length}
              </p>
              <p className="text-xs text-[#6b6b6b]">Afgerond</p>
            </div>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">{avgRating}</p>
              <p className="text-xs text-[#6b6b6b]">Gem. Beoordeling</p>
            </div>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">
                {cancelled.length}
              </p>
              <p className="text-xs text-[#6b6b6b]">Geannuleerd</p>
            </div>
          </Card>
        </div>

        {/* Weekly calendar */}
        <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4">
          <h3 className="text-sm font-semibold text-[#ececec] mb-3">
            Deze week
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const isToday = day === today;
              const count = interviewsByDate[day] || 0;
              return (
                <div
                  key={day}
                  className={`rounded-lg p-3 text-center transition-colors ${
                    isToday
                      ? "border-2 border-[#10a37f] bg-[#10a37f]/5"
                      : "border border-[#2d2d2d] bg-[#0d0d0d]"
                  }`}
                >
                  <p
                    className={`text-xs uppercase ${
                      isToday ? "text-[#10a37f] font-semibold" : "text-[#6b6b6b]"
                    }`}
                  >
                    {getDayName(day)}
                  </p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      isToday ? "text-[#10a37f]" : "text-[#ececec]"
                    }`}
                  >
                    {getDateNum(day)}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2 min-h-[8px]">
                    {Array.from({ length: Math.min(count, 4) }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 w-1.5 rounded-full ${
                          isToday ? "bg-[#10a37f]" : "bg-[#8e8e8e]"
                        }`}
                      />
                    ))}
                    {count > 4 && (
                      <span className="text-[10px] text-[#6b6b6b]">
                        +{count - 4}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Tabs + Interview cards */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1e1e1e] border border-[#2d2d2d]">
            <TabsTrigger
              value="scheduled"
              className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
            >
              Gepland ({scheduled.length})
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
            >
              Afgerond ({completed.length})
            </TabsTrigger>
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
            >
              Alle ({interviewList.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-[#6b6b6b]">
                  <p className="text-lg">Geen gesprekken gevonden</p>
                  <p className="text-sm mt-1">
                    Pas je filters aan of plan een nieuw gesprek
                  </p>
                </div>
              ) : (
                filtered.map((interview) => (
                  <Card
                    key={interview.id}
                    className="bg-[#1e1e1e] border-[#2d2d2d] p-0 overflow-hidden"
                  >
                    <div className="flex">
                      {/* Date block */}
                      <div className="w-20 shrink-0 bg-[#0d0d0d] border-r border-[#2d2d2d] flex flex-col items-center justify-center py-4 px-2">
                        <span className="text-[10px] uppercase text-[#6b6b6b]">
                          {getDayName(interview.date)}
                        </span>
                        <span className="text-2xl font-bold text-[#ececec]">
                          {getDateNum(interview.date)}
                        </span>
                        <span className="text-xs text-[#8e8e8e]">
                          {getMonthName(interview.date)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-[#ececec]">
                              {interview.candidateName}
                            </h4>
                            <p className="text-xs text-[#8e8e8e] mt-0.5">
                              {interview.role}
                            </p>
                          </div>
                          <Badge
                            className={`text-[10px] border ${statusColors[interview.status]}`}
                          >
                            {statusLabels[interview.status]}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-[#8e8e8e]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {interview.time}
                          </span>
                          <span className="flex items-center gap-1">
                            {typeIcons[interview.type]}
                            {typeLabels[interview.type]}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {interview.interviewer}
                          </span>
                        </div>

                        {/* Feedback for completed */}
                        {interview.status === "completed" && interview.feedback && (
                          <div className="bg-[#0d0d0d] border border-[#2d2d2d] rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5 text-[#8e8e8e]" />
                              <span className="text-xs font-medium text-[#8e8e8e]">
                                Feedback
                              </span>
                              {interview.rating != null && (
                                <div className="flex items-center gap-0.5 ml-auto">
                                  {renderStars(interview.rating)}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-[#ececec] leading-relaxed">
                              {interview.feedback}
                            </p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          {interview.status === "scheduled" && (
                            <>
                              <Button
                                size="sm"
                                className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white text-xs h-7 px-3"
                                onClick={() => setToast(`Vergaderlink geopend voor ${interview.candidateName}`)}
                              >
                                Join
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-[#2d2d2d] text-[#8e8e8e] hover:bg-[#2d2d2d] text-xs h-7 px-3"
                                onClick={() => setToast(`Interview wordt herplannen voor ${interview.candidateName}`)}
                              >
                                Herplannen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-[#2d2d2d] text-red-400 hover:bg-red-500/10 text-xs h-7 px-3"
                                onClick={() => handleCancelInterview(interview)}
                              >
                                Annuleren
                              </Button>
                            </>
                          )}
                          {interview.status === "completed" && !interview.feedback && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-[#2d2d2d] text-[#10a37f] hover:bg-[#10a37f]/10 text-xs h-7 px-3 gap-1"
                              onClick={() => handleOpenFeedback(interview.id)}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Feedback toevoegen
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-[#ececec]">
              Feedback Toevoegen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[#8e8e8e]">Beoordeling</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-0.5 transition-colors"
                  >
                    <Star
                      className={`h-6 w-6 ${
                        star <= feedbackRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-[#2d2d2d] hover:text-[#8e8e8e]"
                      }`}
                    />
                  </button>
                ))}
                {feedbackRating > 0 && (
                  <span className="text-xs text-[#8e8e8e] ml-2">{feedbackRating}/5</span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[#8e8e8e]">Feedback</Label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Schrijf uw feedback over dit interview..."
                className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[#2d2d2d] text-[#8e8e8e] hover:bg-[#2d2d2d]"
              onClick={() => setFeedbackDialogOpen(false)}
            >
              Annuleren
            </Button>
            <Button
              className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white"
              onClick={handleSubmitFeedback}
            >
              Feedback Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#2d2d2d] text-[#ececec] px-5 py-3 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}
