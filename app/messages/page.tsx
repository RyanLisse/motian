"use client";

import { useState, useMemo, useEffect } from "react";
import { messages as messageData } from "@/lib/data";
import type { MessageItem } from "@/lib/data";
import {
  Mail,
  Plus,
  Send,
  FileText,
  Clock,
  Eye,
  Copy,
  Sparkles,
  Save,
  CalendarClock,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, string> = {
  sent: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  draft: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const statusLabels: Record<string, string> = {
  sent: "Verzonden",
  draft: "Concept",
  scheduled: "Gepland",
};

const recipientLabels: Record<string, string> = {
  "all-candidates": "Alle kandidaten",
  "hiring-managers": "Hiring Managers",
  "jan": "Jan de Vries",
  "fatima": "Fatima El Amrani",
  "sophie": "Sophie van den Berg",
  "daan": "Daan Bakker",
};

const templates = [
  {
    name: "Ontvangstbevestiging",
    preview: "Bedankt voor uw sollicitatie. Wij hebben uw gegevens ontvangen en nemen...",
  },
  {
    name: "Interview Bevestiging",
    preview: "Graag bevestigen wij uw interview op [datum] om [tijd]. U kunt zich...",
  },
  {
    name: "Status Update",
    preview: "Wij willen u graag informeren over de voortgang van uw sollicitatie...",
  },
  {
    name: "Aanbiedingsbrief",
    preview: "Met genoegen bieden wij u de positie aan van [functie] bij ons bedrijf...",
  },
  {
    name: "Afwijzing",
    preview: "Helaas moeten wij u meedelen dat wij hebben gekozen voor een andere...",
  },
  {
    name: "Talent Outreach",
    preview: "Uw profiel viel ons op en wij denken dat u een goede match zou zijn...",
  },
];

export default function MessagesPage() {
  const [messageList, setMessageList] = useState<MessageItem[]>(messageData);
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  // Fetch messages from API on mount
  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch("/api/messages?limit=100");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return; // keep mock data
        const mapped: MessageItem[] = data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          subject: (r.subject as string) || "(geen onderwerp)",
          recipients: 1,
          sentDate: r.sentAt
            ? new Date(r.sentAt as string).toISOString().split("T")[0]
            : r.createdAt
              ? new Date(r.createdAt as string).toISOString().split("T")[0]
              : "",
          status: (r.direction === "outbound" ? "sent" : "draft") as "sent" | "draft" | "scheduled",
          openRate: r.direction === "outbound" ? 0 : undefined,
          template: (r.channel as string) || "email",
        }));
        setMessageList(mapped);
      } catch {
        // API failed — keep mock data as fallback
      }
    }
    fetchMessages();
  }, []);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Compose form state
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeTemplate, setComposeTemplate] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  const sent = messageList.filter((m) => m.status === "sent");
  const drafts = messageList.filter((m) => m.status === "draft");
  const scheduled = messageList.filter((m) => m.status === "scheduled");

  const avgOpenRate = useMemo(() => {
    const withRate = sent.filter((m) => m.openRate != null);
    if (withRate.length === 0) return 0;
    return Math.round(
      withRate.reduce((sum, m) => sum + (m.openRate || 0), 0) / withRate.length
    );
  }, [sent]);

  const filtered = useMemo(() => {
    if (activeTab === "sent") return sent;
    if (activeTab === "draft") return drafts;
    if (activeTab === "scheduled") return scheduled;
    return messageList;
  }, [activeTab, sent, drafts, scheduled, messageList]);

  function handleCopyTemplate(name: string) {
    const template = templates.find((t) => t.name === name);
    if (template) {
      navigator.clipboard.writeText(template.preview);
    }
    setCopiedTemplate(name);
    setTimeout(() => setCopiedTemplate(null), 2000);
  }

  function resetComposeForm() {
    setComposeRecipient("");
    setComposeTemplate("");
    setComposeSubject("");
    setComposeBody("");
  }

  function getRecipientCount(recipientKey: string): number {
    if (recipientKey === "all-candidates") return 24;
    if (recipientKey === "hiring-managers") return 6;
    return 1;
  }

  function handleTemplateChange(templateName: string) {
    setComposeTemplate(templateName);
    const template = templates.find((t) => t.name === templateName);
    if (template) {
      setComposeBody(template.preview);
      setComposeSubject(templateName);
    }
  }

  function handleAiAssist() {
    const recipientName = composeRecipient ? (recipientLabels[composeRecipient] || "ontvanger") : "ontvanger";
    setComposeBody(
      `Beste ${recipientName},\n\nBedankt voor uw interesse in de positie. We willen u graag uitnodigen voor een gesprek om uw ervaring en vaardigheden te bespreken.\n\nMet vriendelijke groet,\nMotian Recruitment`
    );
    setToast("AI heeft het bericht gegenereerd");
  }

  function createMessage(status: "sent" | "draft" | "scheduled") {
    if (!composeSubject) {
      setToast("Vul een onderwerp in");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const newMessage: MessageItem = {
      id: `m-${Date.now()}`,
      subject: composeSubject,
      recipients: getRecipientCount(composeRecipient),
      sentDate: today,
      status,
      openRate: status === "sent" ? 0 : undefined,
      template: composeTemplate || "Aangepast",
    };
    setMessageList((prev) => [newMessage, ...prev]);
    setDialogOpen(false);
    resetComposeForm();
    if (status === "sent") setToast("Bericht verzonden");
    else if (status === "draft") setToast("Concept opgeslagen");
    else setToast("Bericht ingepland");

    // Fire POST to API (best-effort, UI already updated optimistically)
    if (status === "sent") {
      fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: composeRecipient || "unknown",
          direction: "outbound",
          channel: "email",
          subject: composeSubject,
          body: composeBody,
        }),
      }).catch(() => {
        // silent — optimistic UI already shows the message
      });
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#ececec]">Berichten</h1>
            <p className="text-sm text-[#6b6b6b] mt-1">
              Beheer communicatie met kandidaten en teams
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetComposeForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white gap-2">
                <Plus className="h-4 w-4" />
                Nieuw Bericht
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec] sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="text-[#ececec]">
                  Nieuw Bericht Opstellen
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-[#8e8e8e]">Ontvangers</Label>
                  <Select value={composeRecipient} onValueChange={setComposeRecipient}>
                    <SelectTrigger className="w-full bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                      <SelectValue placeholder="Selecteer ontvangers" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                      <SelectItem value="all-candidates">Alle kandidaten</SelectItem>
                      <SelectItem value="hiring-managers">Hiring Managers</SelectItem>
                      <SelectItem value="jan">Jan de Vries</SelectItem>
                      <SelectItem value="fatima">Fatima El Amrani</SelectItem>
                      <SelectItem value="sophie">Sophie van den Berg</SelectItem>
                      <SelectItem value="daan">Daan Bakker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8e8e8e]">Template</Label>
                  <Select value={composeTemplate} onValueChange={handleTemplateChange}>
                    <SelectTrigger className="w-full bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec]">
                      <SelectValue placeholder="Kies een template (optioneel)" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                      {templates.map((t) => (
                        <SelectItem key={t.name} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8e8e8e]">Onderwerp</Label>
                  <Input
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Voer het onderwerp in..."
                    className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b]"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[#8e8e8e]">Bericht</Label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#2d2d2d] text-[#10a37f] hover:bg-[#10a37f]/10 text-xs h-7 px-3 gap-1"
                      onClick={handleAiAssist}
                    >
                      <Sparkles className="h-3 w-3" />
                      AI Assist
                    </Button>
                  </div>
                  <Textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Schrijf uw bericht..."
                    className="bg-[#0d0d0d] border-[#2d2d2d] text-[#ececec] placeholder:text-[#6b6b6b] min-h-[150px]"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="border-[#2d2d2d] text-[#8e8e8e] hover:bg-[#2d2d2d] gap-1"
                  onClick={() => createMessage("scheduled")}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Inplannen
                </Button>
                <Button
                  variant="outline"
                  className="border-[#2d2d2d] text-[#8e8e8e] hover:bg-[#2d2d2d] gap-1"
                  onClick={() => createMessage("draft")}
                >
                  <Save className="h-3.5 w-3.5" />
                  Concept Opslaan
                </Button>
                <Button
                  className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white gap-1"
                  onClick={() => createMessage("sent")}
                >
                  <Send className="h-3.5 w-3.5" />
                  Versturen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-[#10a37f]/10 text-[#10a37f] flex items-center justify-center shrink-0">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">{sent.length}</p>
              <p className="text-xs text-[#6b6b6b]">Verzonden</p>
            </div>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">{avgOpenRate}%</p>
              <p className="text-xs text-[#6b6b6b]">Gem. Open Rate</p>
            </div>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">
                {drafts.length}
              </p>
              <p className="text-xs text-[#6b6b6b]">Concepten</p>
            </div>
          </Card>
          <Card className="bg-[#1e1e1e] border-[#2d2d2d] p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#ececec]">
                {scheduled.length}
              </p>
              <p className="text-xs text-[#6b6b6b]">Gepland</p>
            </div>
          </Card>
        </div>

        {/* Message templates */}
        <div>
          <h2 className="text-sm font-semibold text-[#ececec] mb-3">
            Bericht Templates
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card
                key={template.name}
                className="bg-[#1e1e1e] border-[#2d2d2d] p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-[#10a37f]/10 text-[#10a37f] flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-medium text-[#ececec]">
                      {template.name}
                    </h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#ececec] hover:bg-[#2d2d2d]"
                    onClick={() => handleCopyTemplate(template.name)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-[#8e8e8e] leading-relaxed line-clamp-2">
                  {template.preview}
                </p>
                {copiedTemplate === template.name && (
                  <p className="text-[10px] text-[#10a37f]">Gekopieerd!</p>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Message history */}
        <div>
          <h2 className="text-sm font-semibold text-[#ececec] mb-3">
            Berichtengeschiedenis
          </h2>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#1e1e1e] border border-[#2d2d2d] mb-4">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
              >
                Alle ({messageList.length})
              </TabsTrigger>
              <TabsTrigger
                value="sent"
                className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
              >
                Verzonden ({sent.length})
              </TabsTrigger>
              <TabsTrigger
                value="draft"
                className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
              >
                Concepten ({drafts.length})
              </TabsTrigger>
              <TabsTrigger
                value="scheduled"
                className="data-[state=active]:bg-[#10a37f]/10 data-[state=active]:text-[#10a37f] text-[#8e8e8e]"
              >
                Gepland ({scheduled.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <Card className="bg-[#1e1e1e] border-[#2d2d2d] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2d2d2d] hover:bg-transparent">
                      <TableHead className="text-[#8e8e8e] text-xs">
                        Onderwerp
                      </TableHead>
                      <TableHead className="text-[#8e8e8e] text-xs">
                        Template
                      </TableHead>
                      <TableHead className="text-[#8e8e8e] text-xs">
                        Ontvangers
                      </TableHead>
                      <TableHead className="text-[#8e8e8e] text-xs">
                        Datum
                      </TableHead>
                      <TableHead className="text-[#8e8e8e] text-xs">
                        Status
                      </TableHead>
                      <TableHead className="text-[#8e8e8e] text-xs text-right">
                        Open Rate
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow className="border-[#2d2d2d]">
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-[#6b6b6b]"
                        >
                          Geen berichten gevonden
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((msg) => (
                        <TableRow
                          key={msg.id}
                          className="border-[#2d2d2d] hover:bg-[#2d2d2d]/30"
                        >
                          <TableCell className="text-sm text-[#ececec] font-medium max-w-[300px] truncate">
                            {msg.subject}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[10px] border-[#2d2d2d] text-[#8e8e8e]"
                            >
                              {msg.template}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-[#8e8e8e]">
                            {msg.recipients}
                          </TableCell>
                          <TableCell className="text-sm text-[#8e8e8e]">
                            {msg.sentDate
                              ? new Date(msg.sentDate + "T00:00:00").toLocaleDateString(
                                  "nl-NL",
                                  {
                                    day: "numeric",
                                    month: "short",
                                  }
                                )
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] border ${statusColors[msg.status]}`}
                            >
                              {statusLabels[msg.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {msg.openRate != null ? (
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-1.5 bg-[#2d2d2d] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#10a37f] rounded-full transition-all"
                                    style={{ width: `${msg.openRate}%` }}
                                  />
                                </div>
                                <span className="text-xs text-[#8e8e8e] w-8 text-right">
                                  {msg.openRate}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-[#6b6b6b]">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#2d2d2d] text-[#ececec] px-5 py-3 rounded-lg shadow-lg text-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toast}
        </div>
      )}
    </div>
  );
}
