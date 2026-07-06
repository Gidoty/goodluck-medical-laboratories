import { z } from "zod";

export const appointmentSchema = z.object({
  patientName: z.string().min(2, "Enter your full name"),
  patientEmail: z.string().email("Enter a valid email address"),
  patientPhone: z.string().min(7, "Enter a valid phone number"),
  serviceId: z.string().min(1, "Select a service"),
  preferredDate: z.string().min(1, "Select a preferred date"),
  preferredTime: z.string().min(1, "Select a preferred time"),
  notes: z.string().optional(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;

export const inquirySchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  subject: z.string().min(2, "Enter a subject"),
  message: z.string().min(10, "Message should be at least 10 characters"),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export const registerSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(7, "Enter a valid phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const TIME_SLOTS = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
];
