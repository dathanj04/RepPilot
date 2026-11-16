import {expect,it} from "vitest";
import {matchesZipFilter,validZipFilter} from "./zip-filter";
it("filters one or multiple ZIPs while matching ZIP+4 records",()=>{expect(matchesZipFilter('75068-1234','75034, 75068')).toBe(true);expect(matchesZipFilter('75034','75068;75034')).toBe(true);expect(matchesZipFilter('75201','75068 75034')).toBe(false);});
it("keeps all records on clear and does not silently accept partial ZIPs",()=>{expect(matchesZipFilter('','')).toBe(true);expect(validZipFilter('7506')).toBe(false);expect(matchesZipFilter('75068','7506')).toBe(false);expect(validZipFilter('75068, abc')).toBe(false);});
