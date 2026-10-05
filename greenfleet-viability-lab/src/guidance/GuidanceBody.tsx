import Link from "next/link";
import { GLOSSARY } from "@/content/glossary";
import type { GuidanceContent } from "./types";

const H = "mt-4 text-xs font-semibold uppercase tracking-wide text-forest-800";

/** The readable form of one guidance entry. Pure presentation, so it can be rendered anywhere. */
export function GuidanceBody({ content, onNavigate }: { content: GuidanceContent; onNavigate?: () => void }) {
  const terms = (content.relatedTerms ?? []).map((k) => GLOSSARY[k]).filter((t): t is NonNullable<typeof t> => !!t);
  return (
    <div className="text-sm leading-relaxed text-navy-800">
      <p className="text-slate-700">{content.shortDescription}</p>
      {content.whatYouAreDoing && (<><h3 className={H}>What you are doing</h3><p>{content.whatYouAreDoing}</p></>)}
      {content.whatYouNeed && content.whatYouNeed.length > 0 && (<><h3 className={H}>What you need</h3><ul className="list-disc space-y-0.5 pl-5">{content.whatYouNeed.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      {content.whyItMatters && (<><h3 className={H}>Why it matters</h3><p>{content.whyItMatters}</p></>)}
      {content.whatGreenFleetDoes && (<><h3 className={H}>What GreenFleet does</h3><p>{content.whatGreenFleetDoes}</p></>)}
      {content.definitions && content.definitions.length > 0 && (
        <>
          <h3 className={H}>In plain English</h3>
          <dl className="space-y-2">{content.definitions.map((d) => <div key={d.term}><dt className="font-semibold text-navy-950">{d.term}</dt><dd>{d.text}</dd></div>)}</dl>
        </>
      )}
      {terms.length > 0 && (
        <>
          <h3 className={H}>Terms on this page</h3>
          <dl className="space-y-2">{terms.map((d) => <div key={d.term}><dt className="font-semibold text-navy-950">{d.term}</dt><dd>{d.text}</dd></div>)}</dl>
        </>
      )}
      {content.tips && content.tips.length > 0 && (<><h3 className={H}>Tips</h3><ul className="list-disc space-y-0.5 pl-5">{content.tips.map((x) => <li key={x}>{x}</li>)}</ul></>)}
      {content.warnings && content.warnings.length > 0 && (
        <>
          <h3 className={H}>Keep in mind</h3>
          <ul className="space-y-1.5">{content.warnings.map((x) => <li key={x} className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950">{x}</li>)}</ul>
        </>
      )}
      {content.whatHappensNext && (<><h3 className={H}>What happens next</h3><p>{content.whatHappensNext}</p></>)}
      {content.links && content.links.length > 0 && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
          {content.links.map((l) => <Link key={l.href + l.label} href={l.href} onClick={onNavigate} className="font-semibold text-forest-800 underline underline-offset-2">{l.label}</Link>)}
        </p>
      )}
    </div>
  );
}
