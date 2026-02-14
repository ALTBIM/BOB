import { describe, expect, it } from "vitest";
import { parseLuadoEmail } from "../parser.js";

describe("Luado parser", () => {
  it("computes end_local from duration when Avsluttes is missing", () => {
    const mail = `
Luado-jobb Nr. 90001
Kjøper: Test Kunde
Type jobb: Flyttehjelp
Adresse: Eksempelveien 1, 0123 Oslo
Starttid: 14.02.2026 kl. 09:00
Varighet: 10 time
Betaling: Kr 4 962
`;

    const parsed = parseLuadoEmail(mail);
    expect(parsed).not.toBeNull();
    expect(parsed?.orderId).toBe("90001");
    expect(parsed?.startLocal).toBe("2026-02-14T09:00:00");
    expect(parsed?.endLocal).toBe("2026-02-14T19:00:00");
    expect(parsed?.addressPostalCode).toBe("0123");
    expect(parsed?.addressCity).toBe("Oslo");
  });
});
