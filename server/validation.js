import { z } from 'zod';

const text = (max = 5000) => z.string().trim().max(max);
const url = z.string().trim().max(2048).refine((value) => value === '' || /^https?:\/\//i.test(value), 'Must be an HTTP or HTTPS URL');

export const portfolioSchema = z.object({
  personal: z.object({
    name: text(120), tagline: text(250), typewriterLines: z.array(text(250)).max(30).optional(), bio: text(5000),
    email: z.string().trim().email().max(254), github: url, linkedin: url, college: text(250),
    internship: z.object({ company: text(250), role: text(250) }).passthrough().optional(),
  }).passthrough(),
  projects: z.array(z.object({ id: z.string().min(1).max(100), title: text(250), subtitle: text(500), description: text(5000), techStack: z.array(text(100)).max(50), github: url, live: url, featured: z.boolean() }).passthrough()).max(100),
  skills: z.array(z.object({ name: text(150), category: text(100), level: z.number().int().min(0).max(100) }).passthrough()).max(200),
  experience: z.array(z.object({ id: z.string().min(1).max(100), role: text(250), company: text(250), duration: text(250), description: text(5000), current: z.boolean() }).passthrough()).max(100),
  theme: z.object({ preset: z.enum(['amber', 'cyan', 'violet', 'emerald', 'rose']), mode: z.enum(['dark', 'light']), showPercentage: z.boolean() }).passthrough(),
}).strict();

export const loginSchema = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(1024) }).strict();
export const passwordSchema = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(12).max(1024) }).strict();
