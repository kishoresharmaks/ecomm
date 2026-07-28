import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { IsValidPhoneNumber } from "./is-phone-number.validator";

class PhoneFixtureDto {
  @IsValidPhoneNumber()
  phone!: string;
}

async function validatePhone(phone: unknown) {
  const dto = new PhoneFixtureDto();
  dto.phone = phone as string;
  return validate(dto);
}

describe("IsValidPhoneNumber", () => {
  it("accepts valid E.164 international numbers", async () => {
    await expect(validatePhone("+14155552671")).resolves.toHaveLength(0);
    await expect(validatePhone("+919876543210")).resolves.toHaveLength(0);
  });

  it("rejects local-only, empty, and non-string phone values", async () => {
    await expect(validatePhone("9876543210")).resolves.toHaveLength(1);
    await expect(validatePhone("")).resolves.toHaveLength(1);
    await expect(validatePhone(9876543210)).resolves.toHaveLength(1);
  });
});
