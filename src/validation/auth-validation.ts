import {z} from "zod";

export const registerSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Name must be at least 2 characters long").max(100),
        email: z.email("Invalid email address").min(1).max(100),
        password: z.string().min(8, "Password must be at least 8 characters long").max(100).
            regex(/[A-Z]/, "Password must contain at least one uppercase letter").
            regex(/[a-z]/, "Password must contain at least one lowercase letter").
            regex(/[0-9]/, "Password must contain at least one number")
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.email("Invalid email address").min(1).max(100),
        password: z.string().min(1, 'Password is required')
    })
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];