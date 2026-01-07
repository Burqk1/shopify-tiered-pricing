/**
 * TierBuilder Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TierBuilder, type Tier } from "~/components/TierBuilder";
import { PolarisTestProvider } from "@shopify/polaris";

// Wrapper for Polaris components
const renderWithPolaris = (component: React.ReactElement) => {
  return render(
    <PolarisTestProvider>{component}</PolarisTestProvider>
  );
};

describe("TierBuilder", () => {
  const defaultTiers: Tier[] = [
    { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10 },
  ];

  it("should render initial tiers", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    expect(screen.getByText("Tier 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("should show preview text", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    // Use getAllByText since the patterns appear in both tier preview and tip section
    const itemsElements = screen.getAllByText(/5-9 items/);
    expect(itemsElements.length).toBeGreaterThan(0);
    const discountElements = screen.getAllByText(/10% off/);
    expect(discountElements.length).toBeGreaterThan(0);
  });

  it("should show unlimited preview for null maxQuantity", () => {
    const onChange = vi.fn();
    const tiersWithUnlimited: Tier[] = [
      { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20 },
    ];

    renderWithPolaris(<TierBuilder tiers={tiersWithUnlimited} onChange={onChange} />);

    expect(screen.getByText(/10\+ items/)).toBeInTheDocument();
  });

  it("should show fixed amount preview", () => {
    const onChange = vi.fn();
    const fixedTiers: Tier[] = [
      { minQuantity: 3, maxQuantity: null, valueType: "FIXED_AMOUNT", value: 5 },
    ];

    renderWithPolaris(<TierBuilder tiers={fixedTiers} onChange={onChange} />);

    expect(screen.getByText(/\$5 off each/)).toBeInTheDocument();
  });

  it("should call onChange when minQuantity changes", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    const minInput = screen.getByDisplayValue("5");
    fireEvent.change(minInput, { target: { value: "10" } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ minQuantity: 10 }),
    ]);
  });

  it("should call onChange when maxQuantity changes", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    const maxInput = screen.getByDisplayValue("9");
    fireEvent.change(maxInput, { target: { value: "15" } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ maxQuantity: 15 }),
    ]);
  });

  it("should call onChange when discount value changes", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    const valueInput = screen.getByDisplayValue("10");
    fireEvent.change(valueInput, { target: { value: "25" } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ value: 25 }),
    ]);
  });

  it("should add new tier with calculated minQuantity", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    const addButton = screen.getByRole("button", { name: /add another tier/i });
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith([
      defaultTiers[0],
      expect.objectContaining({
        minQuantity: 10, // maxQuantity(9) + 1
        maxQuantity: null,
        valueType: "PERCENTAGE",
        value: 0,
      }),
    ]);
  });

  it("should not show delete button for single tier", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    expect(screen.queryByRole("button", { name: /remove tier/i })).not.toBeInTheDocument();
  });

  it("should show delete button for multiple tiers", () => {
    const onChange = vi.fn();
    const multipleTiers: Tier[] = [
      { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10 },
      { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20 },
    ];

    renderWithPolaris(<TierBuilder tiers={multipleTiers} onChange={onChange} />);

    const deleteButtons = screen.getAllByRole("button", { name: /remove tier/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it("should remove tier when delete button clicked", () => {
    const onChange = vi.fn();
    const multipleTiers: Tier[] = [
      { minQuantity: 5, maxQuantity: 9, valueType: "PERCENTAGE", value: 10 },
      { minQuantity: 10, maxQuantity: null, valueType: "PERCENTAGE", value: 20 },
    ];

    renderWithPolaris(<TierBuilder tiers={multipleTiers} onChange={onChange} />);

    const deleteButtons = screen.getAllByRole("button", { name: /remove tier/i });
    fireEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledWith([multipleTiers[1]]);
  });

  it("should update message field", () => {
    const onChange = vi.fn();
    renderWithPolaris(<TierBuilder tiers={defaultTiers} onChange={onChange} />);

    const messageInput = screen.getByPlaceholderText(/buy 10\+/i);
    fireEvent.change(messageInput, { target: { value: "Special offer!" } });

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ message: "Special offer!" }),
    ]);
  });
});
