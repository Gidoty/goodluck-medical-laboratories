import { redirect } from "next/navigation";
import { FIRST_STEP } from "@/domain/steps";

export default function AssessmentIndex() {
  redirect(`/assessment/${FIRST_STEP}`);
}
