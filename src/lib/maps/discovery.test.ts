import { describe, expect, it } from "vitest";
import { discoveryQuery, discoveryKey, suggestedSpecialty } from "./discovery";
describe("practice specialty discovery", () => {
 it("broadens the specialty term instead of searching for a literal practice name", () => { expect(discoveryQuery("Pediatrician")).toBe("pediatrics"); expect(discoveryQuery("Pediatricians near Plano")).toBe("pediatrics near Plano"); expect(discoveryQuery("Paediatrician")).toBe("pediatrics"); });
 it("preserves specific practice names and other specialties", () => { expect(discoveryQuery("Cook Children's Frisco")).toBe("Cook Children's Frisco"); expect(discoveryQuery("Cardiology")).toBe("Cardiology"); });
 it("suggests an editable specialty without calling every pediatric result a physician", () => { expect(suggestedSpecialty("Pediatrician","Pediatric Dentistry")).toBe("Pediatric Dentistry"); expect(suggestedSpecialty("Pediatrician","Pediatrics Plus")).toBe("Pediatrics"); expect(suggestedSpecialty("Pediatrician","Pediatric Therapy")).toBe("Pediatric Therapy"); expect(suggestedSpecialty("Dr Smith","Dr Smith")).toBe(""); });
 it("uses the office name and street address to track saved results", () => { expect(discoveryKey({name:"Clinic",street:"123 Main",zip:"75034"})).toBe(discoveryKey({name:" CLINIC ",street:"123 MAIN",zip:"75034"})); });
});
