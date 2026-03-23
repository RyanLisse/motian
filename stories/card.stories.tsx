import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Kaartcontainer met optionele header (titel, beschrijving, actie), content en footer. Gebruikt voor blokken op dashboards en formulieren.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Vacaturekaart</CardTitle>
        <CardDescription>Korte omschrijving van de vacature of sectie.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Hier staat de hoofdinhoud van de kaart. Bijvoorbeeld een samenvatting of formuliervelden.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm">
          Annuleren
        </Button>
        <Button size="sm">Opslaan</Button>
      </CardFooter>
    </Card>
  ),
};

export const HeaderOnly: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Alleen titel</CardTitle>
        <CardDescription>Optionele beschrijving onder de titel.</CardDescription>
      </CardHeader>
    </Card>
  ),
};
