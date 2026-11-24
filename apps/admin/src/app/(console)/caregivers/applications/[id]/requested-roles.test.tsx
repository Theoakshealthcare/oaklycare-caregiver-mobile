import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ApplicationDetail } from "@/lib/caregivers";
import { jsonResponse, stubFetch, withAuth } from "@/test/helpers";
import { IDENTITY_PASSED, NEEDS_REVIEW_ID, detailWith } from "@/test/identity-fixtures";

import { ApplicationDetailView } from "./detail";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const GET = `GET /api/v1/admin/caregivers/${NEEDS_REVIEW_ID}`;
const SKILLS = `PUT /api/v1/admin/caregivers/${NEEDS_REVIEW_ID}/skills`;
const DECIDER = ["caregivers.read", "caregivers.approve"];
const READER = ["caregivers.read"];

// Shapes follow backend capture admin/951 (requested, nothing confirmed), 952 (no request) and 954 (after confirming).
const withRequest = (requested: ApplicationDetail["requested_skills"], skills: ApplicationDetail["skills"] = []): ApplicationDetail => ({
  ...detailWith(IDENTITY_PASSED),
  requested_skills: requested,
  skills,
});

const skillsSection = async () => within((await screen.findByRole("heading", { name: "Skills" })).closest("section") as HTMLElement);

describe("caregiver detail: what the caregiver asked for", () => {
  it("shows 'Requested by the caregiver: Nurse, Caregiver' from requested_skills", async () => {
    stubFetch({ [GET]: () => jsonResponse(withRequest(["nurse", "caregiver"])) });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    expect(await screen.findByTestId("requested-roles")).toHaveTextContent("Requested by the caregiver: Nurse, Caregiver");
  });

  it("hides the line when nothing was requested (an older caregiver)", async () => {
    stubFetch({ [GET]: () => jsonResponse(withRequest([])) });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    await screen.findByRole("heading", { name: "Skills" });
    expect(screen.queryByTestId("requested-roles")).not.toBeInTheDocument();
    expect(screen.queryByText(/Requested by the caregiver/)).not.toBeInTheDocument();
  });

  it("tolerates a response without the field", async () => {
    const legacy: Partial<ApplicationDetail> = withRequest([]);
    delete legacy.requested_skills;
    stubFetch({ [GET]: () => jsonResponse(legacy) });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    await screen.findByRole("heading", { name: "Skills" });
    expect(screen.queryByTestId("requested-roles")).not.toBeInTheDocument();
  });

  it("a reader sees the requested line too, with no editor to confirm anything", async () => {
    stubFetch({ [GET]: () => jsonResponse(withRequest(["doctor"])) });
    render(withAuth(READER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    expect(await screen.findByTestId("requested-roles")).toHaveTextContent("Doctor");
    expect(screen.queryByRole("button", { name: "Save skills" })).not.toBeInTheDocument();
  });
});

describe("skills editor: requested roles are pre-selected, confirming is the admin's click", () => {
  it("opens with the requested roles tagged 'requested' and sends nothing until Save skills", async () => {
    const calls = stubFetch({ [GET]: () => jsonResponse(withRequest(["nurse", "caregiver"])) });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const section = await skillsSection();
    expect(await section.findByLabelText("Skill 1 service type")).toHaveValue("nurse");
    expect(section.getByLabelText("Skill 2 service type")).toHaveValue("caregiver");
    expect(section.getByTestId("requested-tag-0")).toHaveTextContent("requested");
    expect(section.getByTestId("requested-tag-1")).toHaveTextContent("requested");
    expect(section.getByTestId("requested-prefill")).toHaveTextContent("Nothing is confirmed until you press Save skills");
    expect(section.getByRole("button", { name: "Save skills" })).toBeEnabled();
    expect(calls.filter((c) => c.key === SKILLS)).toHaveLength(0);
  });

  it("Save skills confirms exactly the pre-selected roles, one click", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(withRequest(["nurse", "caregiver"])),
      [SKILLS]: () => jsonResponse([{ service_type: "nurse", sub_specialty: null }, { service_type: "caregiver", sub_specialty: null }]),
    });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const section = await skillsSection();
    await user.click(await section.findByRole("button", { name: "Save skills" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Skills saved."));
    expect(calls.find((c) => c.key === SKILLS)?.body).toEqual({
      skills: [
        { service_type: "nurse", sub_specialty: null },
        { service_type: "caregiver", sub_specialty: null },
      ],
    });
  });

  it("the admin can remove a requested role before confirming (only Nurse is sent)", async () => {
    const user = userEvent.setup();
    const calls = stubFetch({
      [GET]: () => jsonResponse(withRequest(["nurse", "doctor"])),
      [SKILLS]: () => jsonResponse([{ service_type: "nurse", sub_specialty: null }]),
    });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const section = await skillsSection();
    await user.click(await section.findByRole("button", { name: "Remove skill 2" }));
    await user.click(section.getByRole("button", { name: "Save skills" }));
    await waitFor(() => expect(calls.find((c) => c.key === SKILLS)?.body).toEqual({ skills: [{ service_type: "nurse", sub_specialty: null }] }));
  });

  it("does not pre-select when skills are already confirmed, and shows no 'requested' tag on a confirmed role", async () => {
    stubFetch({ [GET]: () => jsonResponse(withRequest(["nurse", "doctor"], [{ service_type: "nurse", sub_specialty: null }])) });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const section = await skillsSection();
    expect(await section.findByLabelText("Skill 1 service type")).toHaveValue("nurse");
    expect(section.queryByLabelText("Skill 2 service type")).not.toBeInTheDocument();
    expect(section.queryByTestId("requested-tag-0")).not.toBeInTheDocument();
    expect(section.queryByTestId("requested-prefill")).not.toBeInTheDocument();
    expect(section.getByRole("button", { name: "Save skills" })).toBeDisabled();
    // The line still says what was asked for.
    expect(screen.getByTestId("requested-roles")).toHaveTextContent("Nurse, Doctor");
  });

  it("with no request the editor starts empty and Save skills stays off, as before", async () => {
    stubFetch({ [GET]: () => jsonResponse(withRequest([])) });
    render(withAuth(DECIDER, <ApplicationDetailView id={NEEDS_REVIEW_ID} />));
    const section = await skillsSection();
    expect(await section.findByText(/No skills yet/)).toBeInTheDocument();
    expect(section.queryByTestId("requested-prefill")).not.toBeInTheDocument();
    expect(section.getByRole("button", { name: "Save skills" })).toBeDisabled();
  });
});
