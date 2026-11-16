from mcp_server.quickgo_tools import quickgo_search_annotations, quickgo_get_terms
ASPECTS={"function":"molecular_function","process":"biological_process","location":"cellular_component"}
class GeneOntologyAgent:
    def run(self, accession, focus):
        out=[]
        for category in focus:
            aspect=ASPECTS.get(category)
            if not aspect: continue
            rows=quickgo_search_annotations(accession,aspect)
            unique={r["goId"]:r for r in rows if "NOT" not in (r.get("qualifier") or "").split("|")}
            selected=list(unique.values())[:4]
            names={x["id"]:x["name"] for x in quickgo_get_terms([x["goId"] for x in selected])}
            out.extend({"go_id":x["goId"],"term":names.get(x["goId"],x["goId"]),"evidence":x.get("goEvidence") or x.get("evidenceCode"),"aspect":category} for x in selected)
        return out
