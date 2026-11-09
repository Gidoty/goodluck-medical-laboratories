import { ButtonLink } from "@/components/ButtonLink";

export default function NotFound() {
  return (
    <section className="bg-bricks px-5 py-32 text-center text-white sm:px-8">
      <p className="eyebrow text-orange">Error 404</p>
      <h1 className="mt-3 text-6xl font-extrabold uppercase sm:text-8xl">Page not found</h1>
      <p className="mx-auto mt-6 max-w-md text-white/70">
        The page you are looking for has moved or does not exist.
      </p>
      <div className="mt-10">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </section>
  );
}
