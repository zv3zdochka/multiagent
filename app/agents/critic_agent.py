import re
class CriticAgent:
    def check(self, answer, sources):
        tags=set(re.findall(r"\[([UG]\d+)\]",answer))
        valid={"U1"} | {f"G{i}" for i in range(1, len(sources.get("go",[]))+1)}
        return {"grounded": not tags or tags <= valid, "unsupported_claims": sorted(tags-valid), "missing_citations": []}
