import { expect,it } from "vitest";
import { complianceFeatureAvailable } from "./compliance-access";
import { canReviewCompliance } from "../permissions";
import { CATERING_REVIEW_ROLES } from "./catering";
it("gives the full Business compliance feature throughout a valid trial",()=>{expect(complianceFeatureAvailable('individual',14)).toBe(true);expect(complianceFeatureAvailable('individual',1)).toBe(true);});
it("locks Individual and unknown tiers outside the trial",()=>{for(const plan of ['individual','unknown',null]) expect(complianceFeatureAvailable(plan,null)).toBe(false);expect(complianceFeatureAvailable('individual',0)).toBe(false);});
it("supports Business and legacy Business subscription records",()=>{for(const plan of ['business','basic','enterprise'])expect(complianceFeatureAvailable(plan,null)).toBe(true);});
it("restricts review decisions to account administrators",()=>{expect(canReviewCompliance('ORG_ADMIN')).toBe(true);for(const role of ['REP','MANAGER','COMPLIANCE_ADMIN'])expect(canReviewCompliance(role)).toBe(false);expect([...CATERING_REVIEW_ROLES]).toEqual(['ORG_ADMIN']);});
