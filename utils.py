from typing import Dict, List


def generate_swot_strategies(swot: Dict) -> Dict[str, List[str]]:
    strengths = [c.get("text", "") for c in swot.get("strengths", []) if c.get("text")]
    weaknesses = [c.get("text", "") for c in swot.get("weaknesses", []) if c.get("text")]
    opportunities = [c.get("text", "") for c in swot.get("opportunities", []) if c.get("text")]
    threats = [c.get("text", "") for c in swot.get("threats", []) if c.get("text")]

    def pairwise(a: List[str], b: List[str]) -> List[str]:
        out: List[str] = []
        for x in a:
            for y in b:
                out.append(f"{x} × {y}")
        return out

    return {
        "SO": pairwise(strengths, opportunities),
        "ST": pairwise(strengths, threats),
        "WO": pairwise(weaknesses, opportunities),
        "WT": pairwise(weaknesses, threats),
    }


