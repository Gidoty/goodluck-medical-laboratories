export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-bricks edge-slant-bottom relative overflow-hidden pb-28 pt-20 text-white sm:pb-32 sm:pt-28">
      <div
        aria-hidden
        className="absolute bottom-0 right-0 h-[34vw] max-h-[420px] min-h-40 w-[34vw] max-w-[420px] min-w-40 bg-orange"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 right-0 h-[22vw] max-h-[280px] min-h-24 w-[22vw] max-w-[280px] min-w-24 bg-orange-deep"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <p className="eyebrow hero-in text-orange">{eyebrow}</p>
        <h1 className="hero-in mt-4 max-w-4xl text-5xl font-extrabold uppercase leading-[0.95] sm:text-7xl lg:text-8xl" style={{ animationDelay: "80ms" }}>
          {title}
        </h1>
        {children ? (
          <p className="hero-in mt-7 max-w-2xl text-lg text-white/75 sm:text-xl" style={{ animationDelay: "160ms" }}>
            {children}
          </p>
        ) : null}
      </div>
    </section>
  );
}
