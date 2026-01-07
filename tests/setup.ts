import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock window.matchMedia for Polaris components
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

// Mock Shopify session storage
vi.mock("@shopify/shopify-app-session-storage-prisma", () => ({
  PrismaSessionStorage: vi.fn().mockImplementation(() => ({
    storeSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteSessions: vi.fn(),
    findSessionsByShop: vi.fn(),
  })),
}));
