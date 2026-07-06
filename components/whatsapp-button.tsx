"use client";

import { MessageCircle } from "lucide-react";
import { SITE } from "@/lib/site";

export function WhatsAppButton() {
  return (
    <a
      href={SITE.whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-[1000] flex items-center gap-2 rounded-full bg-[#25D366] py-3 pl-3 pr-3 text-white shadow-[0_10px_28px_-8px_rgba(37,211,102,0.65)] transition-all hover:pr-5 sm:bottom-6 sm:right-6"
      aria-label="Chat with us on WhatsApp"
    >
      <span className="pulse-ring flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
        <MessageCircle className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 sm:group-hover:max-w-xs [a:hover>&]:ml-0 [a:hover>&]:max-w-xs">
        Chat with us
      </span>
    </a>
  );
}
