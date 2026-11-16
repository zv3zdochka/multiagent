import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://www.ebi.ac.uk/QuickGO/services"

def _get(url):
    request = Request(url, headers={"Accept":"application/json"})
    with urlopen(request, timeout=20) as response:
        return json.load(response)

def quickgo_search_annotations(accession: str, aspect: str, limit: int = 50) -> list[dict]:
    data = _get(BASE + "/annotation/search?" + urlencode({"geneProductId": "UniProtKB:"+accession, "aspect": aspect, "limit": limit}))
    return data.get("results", [])

def quickgo_get_terms(go_ids: list[str]) -> list[dict]:
    return _get(BASE + "/ontology/go/terms/" + ",".join(go_ids)).get("results", [])
