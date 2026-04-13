import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import RouteGuard from "@/components/RouteGuard";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// We mock useAuth at the module level; individual tests override the return
// value via mockReturnValue.
const mockUseAuth = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Role = "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";

function makeAuth(opts: {
  user?: { id: number; email: string; name: string; role: Role } | null;
  isLoading?: boolean;
}) {
  return {
    user: opts.user ?? null,
    isLoading: opts.isLoading ?? false,
    accessToken: null,
    login: vi.fn(),
    complete2FA: vi.fn(),
    useBackupCode: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  };
}

const mockClientUser = {
  id: 5,
  email: "klient@pristav.cz",
  name: "Martin Svoboda",
  role: "CLIENT" as Role,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockReplace.mockClear();
  mockUseAuth.mockClear();
});

describe("RouteGuard", () => {
  describe("stav načítání", () => {
    it("zobrazí spinner a ne děti, když isLoading=true", () => {
      mockUseAuth.mockReturnValue(makeAuth({ isLoading: true, user: null }));

      render(
        <RouteGuard allowedRoles={["CLIENT"]}>
          <p>Obsah stránky</p>
        </RouteGuard>,
      );

      // Spinner is rendered via an element with animate-spin class
      expect(document.querySelector(".animate-spin")).toBeTruthy();
      expect(screen.queryByText("Obsah stránky")).toBeNull();
    });

    it("nevolá router.replace, když isLoading=true", () => {
      mockUseAuth.mockReturnValue(makeAuth({ isLoading: true, user: null }));

      render(
        <RouteGuard allowedRoles={["CLIENT"]}>
          <p>Obsah stránky</p>
        </RouteGuard>,
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe("nepřihlášený uživatel", () => {
    it("přesměruje na /login", () => {
      mockUseAuth.mockReturnValue(makeAuth({ user: null, isLoading: false }));

      render(
        <RouteGuard allowedRoles={["CLIENT"]}>
          <p>Obsah stránky</p>
        </RouteGuard>,
      );

      expect(mockReplace).toHaveBeenCalledWith("/login");
    });

    it("nezobrazí obsah ani spinner", () => {
      mockUseAuth.mockReturnValue(makeAuth({ user: null, isLoading: false }));

      const { container } = render(
        <RouteGuard allowedRoles={["CLIENT"]}>
          <p>Tajný obsah</p>
        </RouteGuard>,
      );

      expect(screen.queryByText("Tajný obsah")).toBeNull();
      // Component returns null when user is null — container should be empty
      expect(container.querySelector(".animate-spin")).toBeNull();
    });
  });

  describe("špatná role", () => {
    it("přesměruje na /unauthorized, když role nesedí", () => {
      mockUseAuth.mockReturnValue(
        makeAuth({
          user: { ...mockClientUser, role: "CLIENT" },
          isLoading: false,
        }),
      );

      render(
        <RouteGuard allowedRoles={["ADMIN"]}>
          <p>Admin sekce</p>
        </RouteGuard>,
      );

      expect(mockReplace).toHaveBeenCalledWith("/unauthorized");
    });

    it("nezobrazí obsah pro špatnou roli", () => {
      mockUseAuth.mockReturnValue(
        makeAuth({
          user: { ...mockClientUser, role: "CLIENT" },
          isLoading: false,
        }),
      );

      render(
        <RouteGuard allowedRoles={["ADMIN"]}>
          <p>Admin sekce</p>
        </RouteGuard>,
      );

      expect(screen.queryByText("Admin sekce")).toBeNull();
    });
  });

  describe("správná role", () => {
    it("zobrazí děti při správné roli", () => {
      mockUseAuth.mockReturnValue(
        makeAuth({ user: mockClientUser, isLoading: false }),
      );

      render(
        <RouteGuard allowedRoles={["CLIENT"]}>
          <p>Klientský obsah</p>
        </RouteGuard>,
      );

      expect(screen.getByText("Klientský obsah")).toBeTruthy();
    });

    it("nevolá router.replace pro správnou roli", () => {
      mockUseAuth.mockReturnValue(
        makeAuth({ user: mockClientUser, isLoading: false }),
      );

      render(
        <RouteGuard allowedRoles={["CLIENT"]}>
          <p>Klientský obsah</p>
        </RouteGuard>,
      );

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it("zobrazí obsah, když je role v poli více povolených rolí", () => {
      mockUseAuth.mockReturnValue(
        makeAuth({
          user: { ...mockClientUser, role: "EMPLOYEE" },
          isLoading: false,
        }),
      );

      render(
        <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
          <p>Zaměstnanecký obsah</p>
        </RouteGuard>,
      );

      expect(screen.getByText("Zaměstnanecký obsah")).toBeTruthy();
    });
  });

  describe("bez omezení rolí", () => {
    it("zobrazí obsah přihlášenému uživateli bez allowedRoles", () => {
      mockUseAuth.mockReturnValue(
        makeAuth({ user: mockClientUser, isLoading: false }),
      );

      render(
        <RouteGuard>
          <p>Veřejný obsah</p>
        </RouteGuard>,
      );

      expect(screen.getByText("Veřejný obsah")).toBeTruthy();
    });
  });
});
