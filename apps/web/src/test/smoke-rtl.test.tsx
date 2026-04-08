import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/** Minimální kontrola Testing Library + jsdom (bez závislosti na routeru). */
describe("Testing Library smoke", () => {
  it("renderuje text", () => {
    render(<span data-testid="x">Pristav</span>);
    expect(screen.getByTestId("x")).toHaveTextContent("Pristav");
  });
});
