import { Bookmark } from "lucide-react";
import type { Metadata } from "next";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Saved Scenarios" };

export default function ScenariosPage() {
  return (
    <>
      <PageHeader
        help="scenarios"
        eyebrow="Library"
        title="Saved scenarios"
        description="Keep named versions of an assessment, for example a fuel-price shock or a cheaper tariff, and compare them side by side."
        action={<Button disabled>Save current as scenario</Button>}
      />
      <Card>
        <CardBody>
          <EmptyState
            icon={Bookmark}
            title="No saved scenarios yet"
            action={<ButtonLink href="/assessment/business" variant="secondary">Go to New Assessment</ButtonLink>}
          >
            Saving and comparing scenarios is added in a later development batch. Your current assessment is already stored in this browser.
          </EmptyState>
        </CardBody>
      </Card>
    </>
  );
}
