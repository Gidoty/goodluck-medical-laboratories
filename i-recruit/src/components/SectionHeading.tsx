export function SectionHeading({
  eyebrow,
  title,
  children,
  tone = "light",
  align = "left",
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  tone?: "light" | "dark";
  align?: "left" | "center";
}) {
  const dark = tone === "dark";
  return (
    <div className={`reveal max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      <p className={`eyebrow ${dark ? "text-orange" : "text-orange-ink"}`}>{eyebrow}</p>
      <h2
        className={`mt-3 text-4xl font-extrabold uppercase leading-[0.98] sm:text-5xl lg:text-6xl ${
          dark ? "text-white" : "text-charcoal"
        }`}
      >
        {title}
      </h2>
      <span className={`mt-5 block h-1 w-16 bg-orange ${align === "center" ? "mx-auto" : ""}`} />
      {children ? (
        <p className={`mt-6 text-lg ${dark ? "text-white/75" : "text-muted"}`}>{children}</p>
      ) : null}
    </div>
  );
}
