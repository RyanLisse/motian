"use client";

import { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Bell,
  Users,
  Shield,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Types ──────────────────────────────────────────

interface TeamMember {
  initials: string;
  name: string;
  email: string;
  role: string;
}

// ── Default state ──────────────────────────────────

const defaultTeam: TeamMember[] = [
  { initials: "RK", name: "Ravi Kumar", email: "ravi@motian.nl", role: "admin" },
  { initials: "SJ", name: "Sophie Jansen", email: "sophie@motian.nl", role: "hiring_manager" },
  { initials: "MB", name: "Milan de Boer", email: "milan@motian.nl", role: "recruiter" },
];

const roleLabels: Record<string, string> = {
  admin: "Admin",
  hiring_manager: "Hiring Manager",
  recruiter: "Recruiter",
  interviewer: "Interviewer",
};

// ── Defaults for reset ─────────────────────────────

const DEFAULTS: {
  skillWeight: string;
  relevanceWeight: string;
  qualityWeight: string;
  autoReject: boolean;
  biasFree: boolean;
  notifNewApplication: boolean;
  notifInterview: boolean;
  notifPhaseChange: boolean;
  notifWeekly: boolean;
  twoFactor: boolean;
  avgCompliance: boolean;
  auditLogging: boolean;
  apiKey: string;
} = {
  skillWeight: "40",
  relevanceWeight: "35",
  qualityWeight: "25",
  autoReject: false,
  biasFree: true,
  notifNewApplication: true,
  notifInterview: true,
  notifPhaseChange: true,
  notifWeekly: false,
  twoFactor: false,
  avgCompliance: true,
  auditLogging: true,
  apiKey: "mtk_live_a3f8c1d9e4b7…",
};

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "mtk_live_";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Page ───────────────────────────────────────────

export default function SettingsPage() {
  // AI config
  const [skillWeight, setSkillWeight] = useState(DEFAULTS.skillWeight);
  const [relevanceWeight, setRelevanceWeight] = useState(DEFAULTS.relevanceWeight);
  const [qualityWeight, setQualityWeight] = useState(DEFAULTS.qualityWeight);
  const [autoReject, setAutoReject] = useState(DEFAULTS.autoReject);
  const [biasFree, setBiasFree] = useState(DEFAULTS.biasFree);

  // Notifications
  const [notifNewApplication, setNotifNewApplication] = useState(DEFAULTS.notifNewApplication);
  const [notifInterview, setNotifInterview] = useState(DEFAULTS.notifInterview);
  const [notifPhaseChange, setNotifPhaseChange] = useState(DEFAULTS.notifPhaseChange);
  const [notifWeekly, setNotifWeekly] = useState(DEFAULTS.notifWeekly);

  // Team
  const [team, setTeam] = useState<TeamMember[]>(defaultTeam);

  // Security
  const [twoFactor, setTwoFactor] = useState(DEFAULTS.twoFactor);
  const [avgCompliance, setAvgCompliance] = useState(DEFAULTS.avgCompliance);
  const [auditLogging, setAuditLogging] = useState(DEFAULTS.auditLogging);
  const [apiKey, setApiKey] = useState(DEFAULTS.apiKey);
  const [showKey, setShowKey] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Saved tracking
  const [saved, setSaved] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── Handlers ────────────────────────────────────

  function handleSave() {
    setSaved(true);
    setToast("Instellingen opgeslagen");
  }

  function handleCancel() {
    setSkillWeight(DEFAULTS.skillWeight);
    setRelevanceWeight(DEFAULTS.relevanceWeight);
    setQualityWeight(DEFAULTS.qualityWeight);
    setAutoReject(DEFAULTS.autoReject);
    setBiasFree(DEFAULTS.biasFree);
    setNotifNewApplication(DEFAULTS.notifNewApplication);
    setNotifInterview(DEFAULTS.notifInterview);
    setNotifPhaseChange(DEFAULTS.notifPhaseChange);
    setNotifWeekly(DEFAULTS.notifWeekly);
    setTwoFactor(DEFAULTS.twoFactor);
    setAvgCompliance(DEFAULTS.avgCompliance);
    setAuditLogging(DEFAULTS.auditLogging);
    setTeam([...defaultTeam]);
    setApiKey(DEFAULTS.apiKey);
    setSaved(false);
    setToast("Wijzigingen ongedaan gemaakt");
  }

  function handleRegenerateKey() {
    setApiKey(generateApiKey());
    setShowKey(true);
    setToast("API key opnieuw gegenereerd");
  }

  function handleCopyKey() {
    navigator.clipboard.writeText(apiKey);
    setToast("API key gekopieerd naar klembord");
  }

  function handleInviteSubmit() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    const initials = inviteName
      .trim()
      .split(" ")
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);
    const newMember: TeamMember = {
      initials,
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      role: "recruiter",
    };
    setTeam((prev) => [...prev, newMember]);
    setInviteName("");
    setInviteEmail("");
    setInviteOpen(false);
    setToast(`${newMember.name} uitgenodigd`);
  }

  function handleRoleChange(email: string, newRole: string) {
    setTeam((prev) =>
      prev.map((m) => (m.email === email ? { ...m, role: newRole } : m))
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-[#ececec]">Instellingen</h1>
          <p className="text-sm text-[#6b6b6b] mt-1">
            Platform configuratie en voorkeuren
          </p>
        </div>

        {/* ─── 1. AI Configuratie ─────────────────────── */}
        <SectionCard
          icon={<SlidersHorizontal className="h-5 w-5" />}
          iconColor="text-[#10a37f]"
          iconBg="bg-[#10a37f]/10"
          title="AI Configuratie"
          description="Pas de AI-scoring en screening parameters aan"
        >
          <div className="space-y-5">
            {/* Weight selectors */}
            <div className="grid gap-4 sm:grid-cols-3">
              <WeightSelect
                label="Skill Match Weight"
                value={skillWeight}
                onChange={setSkillWeight}
                options={["30", "40", "50"]}
              />
              <WeightSelect
                label="Relevance Weight"
                value={relevanceWeight}
                onChange={setRelevanceWeight}
                options={["25", "35", "45"]}
              />
              <WeightSelect
                label="Quality Weight"
                value={qualityWeight}
                onChange={setQualityWeight}
                options={["15", "25", "35"]}
              />
            </div>

            <Separator className="bg-[#2d2d2d]" />

            {/* Toggles */}
            <ToggleRow
              label="Auto-reject onder drempel"
              description="Kandidaten onder de minimale score automatisch afwijzen"
              checked={autoReject}
              onCheckedChange={setAutoReject}
            />
            <ToggleRow
              label="Bias-vrije screening"
              description="Verwijder naam, leeftijd en geslacht uit de initiële beoordeling"
              checked={biasFree}
              onCheckedChange={setBiasFree}
            />
          </div>
        </SectionCard>

        {/* ─── 2. Notificaties ───────────────────────── */}
        <SectionCard
          icon={<Bell className="h-5 w-5" />}
          iconColor="text-amber-400"
          iconBg="bg-amber-400/10"
          title="Notificaties"
          description="Beheer wanneer je meldingen ontvangt"
        >
          <div className="space-y-4">
            <ToggleRow
              label="Nieuwe sollicitatie ontvangen"
              description="Melding bij elke nieuwe sollicitatie"
              checked={notifNewApplication}
              onCheckedChange={setNotifNewApplication}
            />
            <ToggleRow
              label="Interview herinneringen"
              description="Herinnering 1 uur voor een gepland interview"
              checked={notifInterview}
              onCheckedChange={setNotifInterview}
            />
            <ToggleRow
              label="Kandidaat fase wijzigingen"
              description="Melding wanneer een kandidaat naar een nieuwe fase gaat"
              checked={notifPhaseChange}
              onCheckedChange={setNotifPhaseChange}
            />
            <ToggleRow
              label="Wekelijkse samenvatting"
              description="Elke maandag een overzicht van de afgelopen week"
              checked={notifWeekly}
              onCheckedChange={setNotifWeekly}
            />
          </div>
        </SectionCard>

        {/* ─── 3. Team ───────────────────────────────── */}
        <SectionCard
          icon={<Users className="h-5 w-5" />}
          iconColor="text-[#10a37f]"
          iconBg="bg-[#10a37f]/10"
          title="Team"
          description="Beheer teamleden en rechten"
        >
          <div className="space-y-3">
            {team.map((member) => (
              <div
                key={member.email}
                className="flex items-center gap-3 p-3 rounded-lg bg-[#171717] border border-[#2d2d2d]"
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-full bg-[#10a37f]/20 text-[#10a37f] flex items-center justify-center text-xs font-semibold shrink-0">
                  {member.initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#ececec] truncate">
                    {member.name}
                  </p>
                  <p className="text-xs text-[#6b6b6b] truncate">{member.email}</p>
                </div>

                {/* Role selector */}
                <Select
                  value={member.role}
                  onValueChange={(val) => handleRoleChange(member.email, val)}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                    <SelectItem value="recruiter">Recruiter</SelectItem>
                    <SelectItem value="interviewer">Interviewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full mt-2 border-dashed border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] hover:border-[#10a37f] bg-transparent"
              onClick={() => setInviteOpen(true)}
            >
              + Uitnodigen
            </Button>
          </div>
        </SectionCard>

        {/* ─── 4. Beveiliging & Compliance ───────────── */}
        <SectionCard
          icon={<Shield className="h-5 w-5" />}
          iconColor="text-red-400"
          iconBg="bg-red-400/10"
          title="Beveiliging & Compliance"
          description="Beveiligingsinstellingen en AVG-compliance"
        >
          <div className="space-y-4">
            <ToggleRow
              label="Twee-factor authenticatie (2FA)"
              description="Vereis 2FA voor alle teamleden"
              checked={twoFactor}
              onCheckedChange={setTwoFactor}
            />
            <ToggleRow
              label="AVG compliance modus"
              description="Automatische dataminimalisatie en bewaartermijnen"
              checked={avgCompliance}
              onCheckedChange={setAvgCompliance}
            />
            <ToggleRow
              label="Audit logging"
              description="Log alle gebruikersacties voor compliance"
              checked={auditLogging}
              onCheckedChange={setAuditLogging}
            />

            <Separator className="bg-[#2d2d2d]" />

            {/* API Key */}
            <div>
              <Label className="text-[#ececec] text-sm mb-2">API Key</Label>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 relative">
                  <Input
                    readOnly
                    value={showKey ? apiKey : "mtk_live_••••••••••••"}
                    className="bg-[#171717] border-[#2d2d2d] text-[#8e8e8e] text-sm font-mono pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#ececec]"
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#ececec]"
                      onClick={handleCopyKey}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] bg-transparent shrink-0"
                  onClick={handleRegenerateKey}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Opnieuw genereren
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ─── Bottom actions ────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <Button
            variant="outline"
            className="border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] bg-transparent"
            onClick={handleCancel}
          >
            Wijzigingen annuleren
          </Button>
          <Button
            className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white"
            onClick={handleSave}
          >
            Opslaan
          </Button>
        </div>
      </div>

      {/* ─── Invite Dialog ──────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-[#1e1e1e] border-[#2d2d2d] text-[#ececec]">
          <DialogHeader>
            <DialogTitle className="text-[#ececec]">Teamlid uitnodigen</DialogTitle>
            <DialogDescription className="text-[#6b6b6b]">
              Voer de naam en het e-mailadres in van het nieuwe teamlid.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-[#8e8e8e]">Naam</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Volledige naam"
                className="mt-1.5 bg-[#171717] border-[#2d2d2d] text-[#ececec] text-sm placeholder:text-[#6b6b6b]"
              />
            </div>
            <div>
              <Label className="text-xs text-[#8e8e8e]">E-mail</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="naam@bedrijf.nl"
                className="mt-1.5 bg-[#171717] border-[#2d2d2d] text-[#ececec] text-sm placeholder:text-[#6b6b6b]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] bg-transparent"
              onClick={() => setInviteOpen(false)}
            >
              Annuleren
            </Button>
            <Button
              className="bg-[#10a37f] hover:bg-[#0d8c6d] text-white"
              onClick={handleInviteSubmit}
              disabled={!inviteName.trim() || !inviteEmail.trim()}
            >
              Uitnodigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Toast notification ─────────────────────── */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-lg bg-[#1e1e1e] border border-[#2d2d2d] text-sm text-[#ececec] shadow-lg shadow-black/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────

function SectionCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-[#1e1e1e] border-[#2d2d2d]">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
          >
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#ececec]">{title}</h2>
            <p className="text-xs text-[#6b6b6b] mt-0.5">{description}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#ececec]">{label}</p>
        <p className="text-xs text-[#6b6b6b] mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0 data-[state=checked]:bg-[#10a37f]"
      />
    </div>
  );
}

function WeightSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <Label className="text-xs text-[#8e8e8e] mb-1.5">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-9 bg-[#171717] border-[#2d2d2d] text-[#ececec] text-sm mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#1e1e1e] border-[#2d2d2d]">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}%
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
