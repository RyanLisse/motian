"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { WizardStepLinking } from "@/components/candidate-wizard/wizard-step-linking";
import { WizardStepProfile } from "@/components/candidate-wizard/wizard-step-profile";
import type { WizardIntakeResult } from "@/components/candidate-wizard/types";
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
  const [intakeResult, setIntakeResult] = useState<WizardIntakeResult | null>(null);

  const handleProfileSubmit = (result: WizardIntakeResult) => {
    setIntakeResult(result);
    setStep("linking");
  };

  const handleLinkingComplete = () => {
    setOpen(false);
    setStep("profile");
    setIntakeResult(null);
    router.refresh();
  };

  const handleLinkingSkip = () => {
    setOpen(false);
    setStep("profile");
    setIntakeResult(null);
    router.refresh();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep("profile");
      setIntakeResult(null);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {step === "profile" ? "Kandidaat intake" : "Review & koppelen"}
          </DialogTitle>
          <DialogDescription>
            {step === "profile"
              ? "Start via CV upload of handmatige intake en bouw direct een matchbaar kandidaatprofiel op."
              : "Beoordeel het profiel, bekijk de topmatches en koppel direct door naar screening."}
          </DialogDescription>
        </DialogHeader>
        {step === "profile" && (
          <WizardStepProfile onSubmit={handleProfileSubmit} onCancel={() => setOpen(false)} />
        )}
        {step === "linking" && intakeResult && (
          <WizardStepLinking
            intake={intakeResult}
            onComplete={handleLinkingComplete}
            onSkip={handleLinkingSkip}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
