import Image from "next/image";
import type { Img } from "@/lib/media";

/** Masonry-style photo wall. Captions are the alt text. */
export function Gallery({ items }: { items: (Img & { caption?: string })[] }) {
  return (
    <div className="columns-2 gap-3 sm:gap-4 lg:columns-3">
      {items.map((img) => (
        <figure key={img.src} className="reveal group relative mb-3 break-inside-avoid overflow-hidden bg-charcoal sm:mb-4">
          <Image
            src={img.src}
            alt={img.alt}
            width={img.w}
            height={img.h}
            sizes="(min-width: 1024px) 400px, 50vw"
            className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
          />
          {img.caption ? (
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-4 pb-3 pt-10 font-display text-lg font-bold uppercase tracking-wide text-white">
              {img.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
