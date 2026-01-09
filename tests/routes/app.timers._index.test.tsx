/**
 * Timers List Route Tests (app.timers._index.tsx)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PolarisTestProvider } from "@shopify/polaris";

// Mock dependencies
vi.mock("~/shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("~/models/shop.server", () => ({
  getShopByDomain: vi.fn(),
  getLocaleSettings: vi.fn(),
}));

vi.mock("~/models/timer.server", () => ({
  getTimersByShop: vi.fn(),
  updateTimerStatus: vi.fn(),
  deleteTimer: vi.fn(),
}));

// Mock Remix hooks
const mockNavigate = vi.fn();
const mockSubmit = vi.fn();
let mockLoaderData: Record<string, unknown> = {};

vi.mock("@remix-run/react", async () => {
  const actual = await vi.importActual("@remix-run/react");
  return {
    ...actual,
    useLoaderData: () => mockLoaderData,
    useNavigate: () => mockNavigate,
    useSubmit: () => mockSubmit,
  };
});

import { authenticate } from "~/shopify.server";
import { getShopByDomain, getLocaleSettings } from "~/models/shop.server";
import { getTimersByShop, updateTimerStatus, deleteTimer } from "~/models/timer.server";
import { loader, action } from "~/routes/app.timers._index";
import TimersList from "~/routes/app.timers._index";
import { mockTranslations, mockLocaleSettings } from "../helpers/mock-translations";

const renderWithPolaris = (component: React.ReactElement) => {
  return render(<PolarisTestProvider>{component}</PolarisTestProvider>);
};

describe("Timers List Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLocaleSettings).mockResolvedValue(mockLocaleSettings);
    mockLoaderData = {
      timers: [],
      t: mockTranslations,
    };
  });

  // ============================================================================
  // LOADER TESTS
  // ============================================================================

  describe("loader", () => {
    it("should load timers for shop", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
      } as never);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      vi.mocked(getTimersByShop).mockResolvedValue([
        {
          id: "timer-1",
          name: "Sale Timer",
          status: "ACTIVE",
          endTime: futureDate,
          title: "Sale ends in:",
          style: "default",
          showOn: "ALL_PAGES",
        },
      ] as never);

      const request = new Request("http://localhost/app/timers");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.timers).toHaveLength(1);
      expect(data.timers[0].name).toBe("Sale Timer");
      expect(data.timers[0].isExpired).toBe(false);
    });

    it("should mark expired timers", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
      } as never);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      vi.mocked(getTimersByShop).mockResolvedValue([
        {
          id: "timer-1",
          name: "Expired Timer",
          status: "ACTIVE",
          endTime: pastDate,
          title: "Sale ended",
          style: "default",
          showOn: "ALL_PAGES",
        },
      ] as never);

      const request = new Request("http://localhost/app/timers");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.timers[0].isExpired).toBe(true);
    });

    it("should return 404 if shop not found", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue(null);

      const request = new Request("http://localhost/app/timers");

      await expect(loader({ request, params: {}, context: {} })).rejects.toThrow();
    });
  });

  // ============================================================================
  // ACTION TESTS
  // ============================================================================

  describe("action", () => {
    beforeEach(() => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);
    });

    it("should handle updateStatus action", async () => {
      vi.mocked(updateTimerStatus).mockResolvedValue({ id: "timer-1" } as never);

      const formData = new FormData();
      formData.append("action", "updateStatus");
      formData.append("timerId", "timer-1");
      formData.append("status", "ACTIVE");

      const request = new Request("http://localhost/app/timers", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean };

      expect(data.success).toBe(true);
      expect(updateTimerStatus).toHaveBeenCalledWith("timer-1", "ACTIVE");
    });

    it("should handle delete action", async () => {
      vi.mocked(deleteTimer).mockResolvedValue({ id: "timer-1" } as never);

      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("timerId", "timer-1");

      const request = new Request("http://localhost/app/timers", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json() as { success?: boolean };

      expect(data.success).toBe(true);
      expect(deleteTimer).toHaveBeenCalledWith("timer-1");
    });

    it("should handle unknown action", async () => {
      const formData = new FormData();
      formData.append("action", "unknown");

      const request = new Request("http://localhost/app/timers", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================================
  // COMPONENT RENDER TESTS
  // ============================================================================

  describe("TimersList component", () => {
    it("should render page title", () => {
      renderWithPolaris(<TimersList />);

      expect(screen.getByText(mockTranslations.timersPage.title)).toBeInTheDocument();
    });

    it("should render empty state when no timers", () => {
      mockLoaderData = { timers: [], t: mockTranslations };

      renderWithPolaris(<TimersList />);

      expect(screen.getByText(mockTranslations.timersPage.noTimersDesc)).toBeInTheDocument();
    });

    it("should render timer in table", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Flash Sale",
            status: "ACTIVE",
            endTime: futureDate.toISOString(),
            title: "Sale ends in:",
            style: "default",
            showOn: "ALL_PAGES",
            isExpired: false,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      expect(screen.getByText("Flash Sale")).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.timersPage.statusActive)).toBeInTheDocument();
      expect(screen.getByText("Sale ends in:")).toBeInTheDocument();
    });

    it("should show expired badge for expired timers", () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Old Sale",
            status: "ACTIVE",
            endTime: pastDate.toISOString(),
            title: "Ended",
            style: "default",
            showOn: "ALL_PAGES",
            isExpired: true,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      expect(screen.getAllByText(mockTranslations.timersPage.expired).length).toBeGreaterThan(0);
    });

    it("should show remaining time for active timers", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      futureDate.setHours(futureDate.getHours() + 5);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Active Sale",
            status: "ACTIVE",
            endTime: futureDate.toISOString(),
            title: "Sale ends:",
            style: "default",
            showOn: "PRODUCT_PAGES",
            isExpired: false,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      // Should show days remaining
      expect(screen.getByText(/remaining/)).toBeInTheDocument();
    });

    it("should render action buttons", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Test Timer",
            status: "DRAFT",
            endTime: futureDate.toISOString(),
            title: "Title",
            style: "default",
            showOn: "ALL_PAGES",
            isExpired: false,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      expect(screen.getByText(mockTranslations.common.edit)).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.timersPage.resume)).toBeInTheDocument();
      expect(screen.getByText(mockTranslations.common.delete)).toBeInTheDocument();
    });

    it("should show pause button for active timers", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Active Timer",
            status: "ACTIVE",
            endTime: futureDate.toISOString(),
            title: "Title",
            style: "default",
            showOn: "ALL_PAGES",
            isExpired: false,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      expect(screen.getByText(mockTranslations.timersPage.pause)).toBeInTheDocument();
    });

    it("should navigate to create timer on button click", () => {
      mockLoaderData = { timers: [], t: mockTranslations };

      renderWithPolaris(<TimersList />);

      const createButtons = screen.getAllByText(mockTranslations.timersPage.createTimer);
      fireEvent.click(createButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith("/app/timers/new");
    });

    it("should navigate to edit timer on edit click", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Test Timer",
            status: "ACTIVE",
            endTime: futureDate.toISOString(),
            title: "Title",
            style: "default",
            showOn: "ALL_PAGES",
            isExpired: false,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      const editButton = screen.getByText(mockTranslations.common.edit);
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith("/app/timers/timer-1");
    });

    it("should render multiple timers", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockLoaderData = {
        timers: [
          {
            id: "timer-1",
            name: "Timer One",
            status: "ACTIVE",
            endTime: futureDate.toISOString(),
            title: "Title 1",
            style: "default",
            showOn: "ALL_PAGES",
            isExpired: false,
          },
          {
            id: "timer-2",
            name: "Timer Two",
            status: "DRAFT",
            endTime: futureDate.toISOString(),
            title: "Title 2",
            style: "modern",
            showOn: "PRODUCT_PAGES",
            isExpired: false,
          },
        ],
        t: mockTranslations,
      };

      renderWithPolaris(<TimersList />);

      expect(screen.getByText("Timer One")).toBeInTheDocument();
      expect(screen.getByText("Timer Two")).toBeInTheDocument();
    });
  });
});
