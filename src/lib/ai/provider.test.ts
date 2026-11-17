import {afterEach,it,expect,vi} from "vitest";
import {modelJson} from "./provider";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it("uses the requested OpenAI model without storing prompts and parses Responses messages",async()=>{
 vi.stubEnv("OPENAI_API_KEY","fixture-only");vi.stubEnv("AI_PROVIDER","openai");
 const fetch=vi.fn().mockResolvedValue(Response.json({status:"completed",output:[{type:"reasoning"},{type:"message",content:[{type:"output_text",text:'{"opener":"Ask about the requested resource."}'}]}]}));vi.stubGlobal("fetch",fetch);
 expect(await modelJson("Return JSON opener from these facts.","visit_brief")).toEqual({opener:"Ask about the requested resource."});
 const [url,init]=fetch.mock.calls[0];expect(url).toBe("https://api.openai.com/v1/responses");const body=JSON.parse(init.body);expect(body.model).toBe("gpt-5-nano");expect(body.store).toBe(false);expect(body.max_output_tokens).toBe(1200);expect(body.tools).toBeUndefined();
});
it("rejects partial responses, invalid JSON, refusals and provider failures",async()=>{
 vi.stubEnv("OPENAI_API_KEY","fixture-only");vi.stubEnv("AI_PROVIDER","openai");
 const fetch=vi.fn().mockResolvedValueOnce(Response.json({status:"incomplete",output:[]})).mockResolvedValueOnce(Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:"bad JSON"}]}]})).mockResolvedValueOnce(Response.json({status:"completed",output:[{type:"message",content:[{type:"refusal",refusal:"No"}]}]})).mockResolvedValueOnce(new Response("provider private error",{status:429})).mockRejectedValueOnce(Error("private transcript"));vi.stubGlobal("fetch",fetch);
 for(let i=0;i<5;i++)expect(await modelJson("JSON facts","visit_brief")).toBeNull();expect(fetch).toHaveBeenCalledTimes(5);
});
it("keeps deterministic behavior without credentials and rejects unbounded inputs",async()=>{
 vi.stubEnv("AI_PROVIDER","openai");vi.stubEnv("OPENAI_API_KEY","");const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
 expect(await modelJson("JSON facts","daily_briefing")).toBeNull();expect(await modelJson("x".repeat(12001),"visit_brief")).toBeNull();expect(await modelJson("JSON","unapproved_feature")).toBeNull();expect(fetch).not.toHaveBeenCalled();
});
it("supports an explicitly selected Gemini provider without a key in the URL",async()=>{
 vi.stubEnv("AI_PROVIDER","gemini");vi.stubEnv("GEMINI_API_KEY","fixture-only");const fetch=vi.fn().mockResolvedValue(Response.json({candidates:[{content:{parts:[{text:'{"text":"Visit the planned offices."}'}]}}]}));vi.stubGlobal("fetch",fetch);
 expect(await modelJson("Return JSON text","daily_briefing")).toEqual({text:"Visit the planned offices."});expect(fetch.mock.calls[0][0]).not.toContain("fixture-only");
});
