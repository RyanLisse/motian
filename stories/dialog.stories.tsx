"use client";

import type { Meta, StoryObj } from "@storybook/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Modal dialoog met trigger, overlay en content. Gebruikt voor bevestigingen, formulieren in een laag en korte flows.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Closed: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialoog</Button>
      </DialogTrigger>
    </Dialog>
  ),
};

export const Open: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Open dialoog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialoogtitel</DialogTitle>
          <DialogDescription>
            Korte uitleg of vraag. De gebruiker kan sluiten via de X of de knop.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Annuleren</Button>
          <Button>Bevestigen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
