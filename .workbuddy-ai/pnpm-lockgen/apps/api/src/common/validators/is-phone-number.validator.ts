import { parsePhoneNumberFromString } from "libphonenumber-js";
import { registerDecorator, type ValidationOptions } from "class-validator";

export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isValidPhoneNumber",
      target: object.constructor,
      propertyName,
      options: {
        message: "$property must be a valid international phone number (e.g. +919876543210)",
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") {
            return false;
          }

          const phone = parsePhoneNumberFromString(value.trim());
          return phone?.isValid() ?? false;
        },
      },
    });
  };
}
