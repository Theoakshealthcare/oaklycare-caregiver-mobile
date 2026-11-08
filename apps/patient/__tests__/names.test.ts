import { firstNameAndInitial, firstNameOf } from "../src/domain/names";

describe("firstNameAndInitial (the 'Who can see my vitals' screen only)", () => {
  it("shows the first name and the first letter of the last name", () => {
    expect(firstNameAndInitial("Adamu Titilayo")).toBe("Adamu T.");
    expect(firstNameAndInitial("Grace Placeholder")).toBe("Grace P.");
  });

  it("shows a single word as it is", () => {
    expect(firstNameAndInitial("Grace")).toBe("Grace");
    expect(firstNameAndInitial("  grace ")).toBe("grace");
  });

  it("handles extra spaces and lowercase input", () => {
    expect(firstNameAndInitial("  adamu    titilayo  ")).toBe("Adamu T.");
    expect(firstNameAndInitial("adamu\ttitilayo")).toBe("Adamu T.");
  });

  it("uses the last word for the initial and skips a middle name", () => {
    expect(firstNameAndInitial("Ada Grace Okonkwo")).toBe("Ada O.");
  });

  it("drops a leading title like the first-name helper does", () => {
    expect(firstNameAndInitial("Dr. Adamu Titilayo")).toBe("Adamu T.");
    expect(firstNameAndInitial("Dr. Adamu")).toBe("Adamu");
    expect(firstNameAndInitial("Nurse")).toBe("Nurse");
  });

  it("never throws on an empty name", () => {
    expect(firstNameAndInitial("")).toBe("");
    expect(firstNameAndInitial("   ")).toBe("");
  });
});

describe("firstNameOf stays the first name everywhere else", () => {
  it("is just the first name", () => {
    expect(firstNameOf("Adamu Titilayo")).toBe("Adamu");
    expect(firstNameOf("Dr. John Smith")).toBe("John");
    expect(firstNameOf("Cora")).toBe("Cora");
  });
});
