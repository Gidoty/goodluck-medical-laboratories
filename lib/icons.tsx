import {
  Microscope,
  Waves,
  Bug,
  FlaskConical,
  Droplets,
  Home,
  HeartPulse,
  Dna,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  microscope: Microscope,
  ultrasound: Waves,
  microbiology: Bug,
  pathology: FlaskConical,
  haematology: Droplets,
  home: Home,
  heart: HeartPulse,
  dna: Dna,
  shield: ShieldCheck,
};

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? Microscope;
}
