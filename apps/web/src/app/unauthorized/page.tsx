"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";

export default function UnauthorizedPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Nemáte přístup</h1>
        <p className="text-gray-500 text-sm mb-6">Tato stránka není pro vaši roli dostupná.</p>
        {user && (
          <Link href={ROLE_DEFAULT_ROUTES[user.role]} className="btn-primary">
            Zpět na dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
