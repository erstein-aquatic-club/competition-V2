import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

// Stub CSS imports
vi.mock("@/index.css", () => ({}));

// Stub image assets
vi.mock("@assets/logo-eac.png", () => ({ default: "logo-eac.png" }));

// Stub framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === "string") {
          return ({
            children,
            ...rest
          }: {
            children?: React.ReactNode;
            [key: string]: unknown;
          }) => {
            const { initial, animate, exit, transition, whileHover, whileTap, ...htmlProps } = rest;
            const safeProps: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(htmlProps)) {
              if (typeof v !== "object" || v === null) {
                safeProps[k] = v;
              }
            }
            // Use createElement to avoid JSX issues
            const React = require("react");
            return React.createElement(prop, safeProps, children);
          };
        }
        return undefined;
      },
    },
  ),
}));

// Provide a minimal IntersectionObserver stub
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

// Provide minimal ResizeObserver stub
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// Stub window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Stub scrollTo
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Stub HTMLElement.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
