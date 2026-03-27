import type React from "react";

export type Role = "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
  group?: string;
  matchPrefix?: string;
}

export interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix?: string;
}

export interface NavSection {
  group: string | null;
  items: NavItem[];
}

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string | null;
}
