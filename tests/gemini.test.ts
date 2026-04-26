import { describe, expect, it } from "vitest";
import { parseCoachResult } from "../src/coach/gemini.js";

describe("parseCoachResult", () => {
  it("parses structured Gemini JSON", () => {
    const result = parseCoachResult(`{
      "status": "intervene",
      "summary": "인증 테스트가 반복 실패 중이에요.",
      "risk": "컨텍스트가 82% 찼어요.",
      "recommendation": "새 세션으로 분리하세요.",
      "pet_message": "멍! 지금 끊어가는 게 좋아요."
    }`);

    expect(result.status).toBe("intervene");
    expect(result.petMessage).toContain("멍");
  });

  it("falls back to a safe result when JSON is invalid", () => {
    const result = parseCoachResult("not json");

    expect(result.status).toBe("watch");
    expect(result.petMessage).toContain("상태를 확인");
  });
});
