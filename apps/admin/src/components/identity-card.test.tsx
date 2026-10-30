import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IdentityCard } from "@/components/identity-card";
import type { IdentityBlock } from "@/lib/caregivers";
import {
  IDENTITY_DUPLICATE,
  IDENTITY_EXHAUSTED,
  IDENTITY_FAILED,
  IDENTITY_NAME_MISMATCH,
  IDENTITY_NO_ATTEMPTS,
  IDENTITY_PASSED,
  IDENTITY_STUCK,
  OTHER_CAREGIVER_ID,
} from "@/test/identity-fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function show(identity: IdentityBlock, canDecide = true) {
  render(<IdentityCard identity={identity} profileStatus="under_review" canDecide={canDecide} onDecide={vi.fn()} onReset={vi.fn()} />);
}

const attempts = () => screen.getAllByRole("listitem").filter((li) => li.textContent?.startsWith("Attempt "));

describe("IdentityCard", () => {
  it("shows a duplicate-identity review: reason in words, scores with the pass mark, and the link to the other caregiver", () => {
    show(IDENTITY_DUPLICATE);
    expect(screen.getByTestId("review-reason")).toHaveTextContent("The same ID number already passed for another account.");
    expect(screen.getByRole("link", { name: "Open that caregiver" })).toHaveAttribute("href", `/caregivers/applications/${OTHER_CAREGIVER_ID}`);
    const [attempt] = attempts();
    expect(attempt).toHaveTextContent("Attempt 1");
    expect(attempt).toHaveTextContent("Needs review");
    expect(attempt).toHaveTextContent("ID typeNIN");
    expect(attempt).toHaveTextContent("Face match score92 (pass mark 85)");
    expect(attempt).toHaveTextContent("Liveness score90");
    expect(attempt).toHaveTextContent("NameMatches the profile");
    expect(attempt).toHaveTextContent("Date of birthMatches the profile");
    expect(attempt).toHaveTextContent("Decided byThe system");
    expect(screen.getByText("Attempts used: 1 of 3", { exact: false })).toBeInTheDocument();
  });

  it("says a provider reference is missing when it is null, and shows it when the provider sent one", () => {
    show(IDENTITY_DUPLICATE);
    expect(screen.getByText("No reference supplied")).toBeInTheDocument();
  });

  it("shows the provider reference when there is one", () => {
    const withRef: IdentityBlock = { ...IDENTITY_NAME_MISMATCH, attempts: [{ ...IDENTITY_NAME_MISMATCH.attempts[0]!, provider_reference: "REF-PLACEHOLDER-1" }] };
    show(withRef);
    expect(screen.getByText("REF-PLACEHOLDER-1")).toBeInTheDocument();
    expect(screen.queryByText("No reference supplied")).not.toBeInTheDocument();
  });

  it("shows a name mismatch as a difference, not as a failure", () => {
    show(IDENTITY_NAME_MISMATCH);
    expect(screen.getByTestId("review-reason")).toHaveTextContent("The name on the ID differs from the profile");
    expect(attempts()[0]).toHaveTextContent("NameDiffers from the profile");
    expect(attempts()[0]).toHaveTextContent("Date of birthMatches the profile");
    expect(screen.queryByRole("link", { name: "Open that caregiver" })).not.toBeInTheDocument();
  });

  it("lists attempts newest first with each attempt's reasons, and states that nothing is stored", () => {
    show(IDENTITY_EXHAUSTED);
    expect(attempts().map((a) => a.textContent?.slice(0, 9))).toEqual(["Attempt 3", "Attempt 2", "Attempt 1"]);
    expect(attempts()[0]).toHaveTextContent("The selfie does not match the ID photo.");
    expect(attempts()[0]).toHaveTextContent("Three clean failures in a row.");
    expect(attempts()[1]).toHaveTextContent("Failed");
    expect(attempts()[0]).toHaveTextContent("Liveness scoreNot reported");
    expect(attempts()[0]).toHaveTextContent("ID typeNot reported");
    expect(attempts()[0]).toHaveTextContent("NameNot compared");
    expect(screen.getByText("Attempts used: 3 of 3", { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/does not keep ID numbers or images/)).toBeInTheDocument();
  });

  it("keeps the reason code in a tooltip, and shows a code it does not know as it is", () => {
    const unknown: IdentityBlock = { ...IDENTITY_NAME_MISMATCH, attempts: [{ ...IDENTITY_NAME_MISMATCH.attempts[0]!, reason_codes: ["name_mismatch", "brand_new_code"] }] };
    show(unknown);
    const list = within(attempts()[0]!).getAllByRole("listitem");
    expect(list[0]).toHaveAttribute("title", "name_mismatch");
    expect(list[1]).toHaveTextContent("brand_new_code");
  });

  it("says plainly that nothing has been started", () => {
    show(IDENTITY_NO_ATTEMPTS);
    expect(screen.getByText(/has not started the identity check/)).toBeInTheDocument();
    expect(screen.queryByTestId("review-reason")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /Identity attempts/ })).not.toBeInTheDocument();
  });

  it("shows an attempt the provider has not answered as waiting", () => {
    show(IDENTITY_STUCK);
    expect(attempts()[0]).toHaveTextContent("FinishedWaiting for the provider");
    expect(attempts()[0]).toHaveTextContent("Decided byNot decided");
  });

  it("shows a passed attempt and the verified status, with no review reason", () => {
    show(IDENTITY_PASSED);
    expect(screen.queryByTestId("review-reason")).not.toBeInTheDocument();
    expect(attempts()[0]).toHaveTextContent("Passed");
  });

  it("never shows an ID number or image control", () => {
    show(IDENTITY_DUPLICATE);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/\b\d{11}\b/)).not.toBeInTheDocument();
  });

  describe("buttons", () => {
    it("offers Mark verified / Mark failed to a decider, and Allow another attempt only when can_reset", () => {
      show(IDENTITY_EXHAUSTED);
      expect(screen.getByRole("button", { name: "Mark verified" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark failed" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Allow another attempt" })).toBeInTheDocument();
    });

    it("offers Allow another attempt for a failed caregiver", () => {
      show(IDENTITY_FAILED);
      expect(screen.getByRole("button", { name: "Allow another attempt" })).toBeInTheDocument();
    });

    it.each([
      ["a review that is not exhausted", IDENTITY_DUPLICATE],
      ["a verified caregiver", IDENTITY_PASSED],
      ["a caregiver who has not started", IDENTITY_NO_ATTEMPTS],
    ])("hides Allow another attempt for %s", (_name, identity) => {
      show(identity);
      expect(screen.queryByRole("button", { name: "Allow another attempt" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark verified" })).toBeInTheDocument();
    });

    it("shows no action at all to a reader without caregivers.approve, even when can_reset is true", () => {
      show(IDENTITY_EXHAUSTED, false);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(attempts()).toHaveLength(3);
    });
  });
});
