import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-semibold text-forest-700">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-navy-950">This page does not exist</h1>
        <p className="mt-2 text-slate-600">Check the address, or return to the workspace.</p>
        <div className="mt-6 flex justify-center gap-3">
          <ButtonLink href="/overview">Go to overview</ButtonLink>
          <ButtonLink href="/" variant="secondary">Home</ButtonLink>
        </div>
      </div>
    </main>
  );
}
