/**
 * Bundles List Route Tests (app.bundles._index.tsx)
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
}));

vi.mock("~/models/bundle.server", () => ({
  getBundlesByShop: vi.fn(),
  updateBundleStatus: vi.fn(),
  deleteBundle: vi.fn(),
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
import { getShopByDomain } from "~/models/shop.server";
import { getBundlesByShop, updateBundleStatus, deleteBundle } from "~/models/bundle.server";
import { loader, action } from "~/routes/app.bundles._index";
import BundlesList from "~/routes/app.bundles._index";

const renderWithPolaris = (component: React.ReactElement) => {
  return render(<PolarisTestProvider>{component}</PolarisTestProvider>);
};

describe("Bundles List Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoaderData = {
      bundles: [],
    };
  });

  // ============================================================================
  // LOADER TESTS
  // ============================================================================

  describe("loader", () => {
    it("should load bundles for shop", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue({
        id: "shop-1",
        shopDomain: "test.myshopify.com",
      } as never);

      vi.mocked(getBundlesByShop).mockResolvedValue([
        {
          id: "bundle-1",
          name: "Summer Bundle",
          status: "ACTIVE",
          discountType: "PERCENTAGE",
          discountValue: 15,
          requireAll: true,
          products: [
            { productTitle: "T-Shirt" },
            { productTitle: "Shorts" },
          ],
        },
      ] as never);

      const request = new Request("http://localhost/app/bundles");
      const response = await loader({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.bundles).toHaveLength(1);
      expect(data.bundles[0].name).toBe("Summer Bundle");
      expect(data.bundles[0].productCount).toBe(2);
    });

    it("should return 404 if shop not found", async () => {
      vi.mocked(authenticate.admin).mockResolvedValue({
        session: { shop: "test.myshopify.com" },
      } as never);

      vi.mocked(getShopByDomain).mockResolvedValue(null);

      const request = new Request("http://localhost/app/bundles");

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
      vi.mocked(updateBundleStatus).mockResolvedValue({ id: "bundle-1" } as never);

      const formData = new FormData();
      formData.append("action", "updateStatus");
      formData.append("bundleId", "bundle-1");
      formData.append("status", "ACTIVE");

      const request = new Request("http://localhost/app/bundles", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(updateBundleStatus).toHaveBeenCalledWith("bundle-1", "ACTIVE");
    });

    it("should handle delete action", async () => {
      vi.mocked(deleteBundle).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("bundleId", "bundle-1");

      const request = new Request("http://localhost/app/bundles", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(deleteBundle).toHaveBeenCalledWith("bundle-1");
    });

    it("should handle unknown action", async () => {
      const formData = new FormData();
      formData.append("action", "unknown");

      const request = new Request("http://localhost/app/bundles", {
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

  describe("BundlesList component", () => {
    it("should render page title", () => {
      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Bundle Discounts")).toBeInTheDocument();
    });

    it("should render subtitle", () => {
      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Create product bundles with special discounts")).toBeInTheDocument();
    });

    it("should render empty state when no bundles", () => {
      mockLoaderData = { bundles: [] };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Create your first product bundle")).toBeInTheDocument();
    });

    it("should render bundle in table", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Summer Bundle",
            status: "ACTIVE",
            discountType: "PERCENTAGE",
            discountValue: 20,
            productCount: 3,
            products: ["T-Shirt", "Shorts", "Sunglasses"],
            requireAll: true,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Summer Bundle")).toBeInTheDocument();
      expect(screen.getByText("Active")).toBeInTheDocument();
      expect(screen.getByText("20% off")).toBeInTheDocument();
      expect(screen.getByText("3 products")).toBeInTheDocument();
      expect(screen.getByText("T-Shirt + Shorts + Sunglasses")).toBeInTheDocument();
    });

    it("should show fixed amount discount format", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Value Bundle",
            status: "ACTIVE",
            discountType: "FIXED_AMOUNT",
            discountValue: 10,
            productCount: 2,
            products: ["Product A", "Product B"],
            requireAll: false,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("$10 off")).toBeInTheDocument();
    });

    it("should show require all vs mix & match", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "All Required",
            status: "ACTIVE",
            discountType: "PERCENTAGE",
            discountValue: 15,
            productCount: 2,
            products: ["A", "B"],
            requireAll: true,
          },
          {
            id: "bundle-2",
            name: "Mix Match",
            status: "ACTIVE",
            discountType: "PERCENTAGE",
            discountValue: 10,
            productCount: 3,
            products: ["C", "D", "E"],
            requireAll: false,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Must buy all")).toBeInTheDocument();
      expect(screen.getByText("Mix & match")).toBeInTheDocument();
    });

    it("should show +N more for bundles with more than 3 products", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Large Bundle",
            status: "ACTIVE",
            discountType: "PERCENTAGE",
            discountValue: 25,
            productCount: 5,
            products: ["A", "B", "C"],
            requireAll: true,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    });

    it("should render action buttons", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Test Bundle",
            status: "DRAFT",
            discountType: "PERCENTAGE",
            discountValue: 10,
            productCount: 2,
            products: ["A", "B"],
            requireAll: true,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Activate")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("should show pause button for active bundles", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Active Bundle",
            status: "ACTIVE",
            discountType: "PERCENTAGE",
            discountValue: 15,
            productCount: 2,
            products: ["A", "B"],
            requireAll: true,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Pause")).toBeInTheDocument();
    });

    it("should navigate to create bundle on button click", () => {
      mockLoaderData = { bundles: [] };

      renderWithPolaris(<BundlesList />);

      const createButtons = screen.getAllByText("Create Bundle");
      fireEvent.click(createButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith("/app/bundles/new");
    });

    it("should navigate to edit bundle on edit click", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Test Bundle",
            status: "ACTIVE",
            discountType: "PERCENTAGE",
            discountValue: 10,
            productCount: 2,
            products: ["A", "B"],
            requireAll: true,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      const editButton = screen.getByText("Edit");
      fireEvent.click(editButton);

      expect(mockNavigate).toHaveBeenCalledWith("/app/bundles/bundle-1");
    });

    it("should show different status badges", () => {
      mockLoaderData = {
        bundles: [
          {
            id: "bundle-1",
            name: "Draft Bundle",
            status: "DRAFT",
            discountType: "PERCENTAGE",
            discountValue: 10,
            productCount: 2,
            products: ["A", "B"],
            requireAll: true,
          },
          {
            id: "bundle-2",
            name: "Paused Bundle",
            status: "PAUSED",
            discountType: "PERCENTAGE",
            discountValue: 15,
            productCount: 2,
            products: ["C", "D"],
            requireAll: false,
          },
        ],
      };

      renderWithPolaris(<BundlesList />);

      expect(screen.getByText("Draft")).toBeInTheDocument();
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });
  });
});
