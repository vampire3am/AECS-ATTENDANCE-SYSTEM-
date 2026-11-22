import { z } from 'zod';
export const enrollmentCodeInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .superRefine((value, ctx) => {
      if (/^AECS-?\d{6,10}$/.test(value)) {
        ctx.addIssue({
          code: 'custom',
          message:
            'That is your student ID. Ask AECS for your private course/batch check-in code, shown under “Enrollment & check-in code” in the admin student list.',
        });
        return;
      }
      if (!/^AECS-[A-F0-9]{20}$/.test(value))
        ctx.addIssue({
          code: 'custom',
          message:
            'Enter the full private check-in code: AECS- followed by 20 letters and numbers. Use Copy code in your enrollment details.',
        });
    }),
});
