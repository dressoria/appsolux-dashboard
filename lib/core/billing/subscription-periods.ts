import "@/lib/security/server-only";

export type SubscriptionPeriod = {
  startsAt: Date;
  endsAt: Date;
};

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setFullYear(result.getFullYear() + years);
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
}

export function calculateSubscriptionPeriod(
  startDate: Date,
  interval: "MONTHLY" | "YEARLY",
): SubscriptionPeriod {
  const startsAt = new Date(startDate);
  startsAt.setHours(0, 0, 0, 0);

  const endsAt = interval === "MONTHLY"
    ? addMonths(startsAt, 1)
    : addYears(startsAt, 1);

  return { startsAt, endsAt };
}

export function calculateRenewalPeriod(
  existingPeriodEndsAt: Date | null | undefined,
  interval: "MONTHLY" | "YEARLY",
  now: Date = new Date(),
): SubscriptionPeriod {
  const effectiveStart =
    existingPeriodEndsAt && existingPeriodEndsAt.getTime() > now.getTime()
      ? existingPeriodEndsAt
      : now;

  return calculateSubscriptionPeriod(effectiveStart, interval);
}
