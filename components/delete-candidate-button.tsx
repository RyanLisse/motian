"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteCandidateButton({
  candidateId,
  candidateName,
}: {
  candidateId: string;
  candidateName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Weet je zeker dat je "${candidateName}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/kandidaten/${candidateId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/kandidaten");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4 mr-1.5" />
      {deleting ? "Verwijderen…" : "Verwijderen"}
    </Button>
  );
}
