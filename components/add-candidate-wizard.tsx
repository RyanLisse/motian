"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WizardStepLinking } from "@/components/candidate-wizard/wizard-step-linking";
import { WizardStepProfile } from "@/components/candidate-wizard/wizard-step-profile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Step = "profile" | "linking" | "done";

export function AddCandidateWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("profile");
  const [candidateId, setCandidateId] = useState<string | null>(null);

  const handleProfileSubmit = (id: string) => {
    setCandidateId(id);
    setStep("linking");
  };

  const handleLinkingComplete = () => {
    setOpen(false);
    setStep("profile");
    setCandidateId(null);
    router.refresh();
  };

  const handleLinkingSkip = () => {
    setOpen(false);
    setStep("profile");
    setCandidateId(null);
    router.refresh();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep("profile");
      setCandidateId(null);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Kandidaat toevoegen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "profile" ? "Kandidaat toevoegen" : "Vacatures koppelen"}
          </DialogTitle>
          <DialogDescription>
            {step === "profile"
              ? "Voeg een nieuwe kandidaat toe. Daarna kun je direct passende vacatures koppelen."
              : "Selecteer de vacatures waaraan je deze kandidaat wilt koppelen."}
          </DialogDescription>
        </DialogHeader>
        {step === "profile" && (
          <WizardStepProfile onSubmit={handleProfileSubmit} onCancel={() => setOpen(false)} />
        )}
        {step === "linking" && candidateId && (
          <WizardStepLinking
            candidateId={candidateId}
            onComplete={handleLinkingComplete}
            onSkip={handleLinkingSkip}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
