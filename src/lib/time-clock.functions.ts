import { createServerFn } from "@tanstack/react-start";
import { getClockState, clockIn, clockOut } from "@/lib/time-clock.server";

type Input = { token: string; accessToken: string };

function validate(input: unknown): Input {
  const data = input as Partial<Input> | undefined;
  const token = (data?.token ?? "").trim();
  const accessToken = (data?.accessToken ?? "").trim();
  if (!token) throw new Error("Deze QR-code is niet geldig");
  if (!accessToken) throw new Error("Je sessie is verlopen. Log opnieuw in.");
  return { token, accessToken };
}

export const fetchClockState = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => getClockState(data));

export const doClockIn = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => clockIn(data));

export const doClockOut = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => clockOut(data));
