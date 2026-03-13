import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Přihlášení",
  description: "Přihlaste se do klientského portálu Přístav Radosti.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
