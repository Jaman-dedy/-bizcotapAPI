// src/auth/interfaces/auth.interfaces.ts
import { User, UserRole } from '@prisma/client';

export interface UserLoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
}

export interface UserRegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
  companyId?: number;
}