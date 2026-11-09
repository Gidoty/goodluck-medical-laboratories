import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site";

export function WhatsAppFloat() {
  return (
    <a
      href={whatsappLink("Hello I-Recruit, I would like to make an enquiry.")}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with I-Recruit on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-orange text-ink shadow-[0_10px_30px_-6px_rgb(0_0_0/0.5)] transition-transform hover:scale-105 hover:bg-orange-deep hover:text-white sm:h-auto sm:w-auto sm:gap-2 sm:px-5 sm:py-3.5"
    >
      <MessageCircle className="h-6 w-6" aria-hidden />
      <span className="hidden font-display text-lg font-bold uppercase tracking-wider sm:inline">WhatsApp</span>
    </a>
  );
}
