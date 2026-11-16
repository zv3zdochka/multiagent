import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = "https://rest.uniprot.org"

def _get(path, params):
    request = Request(BASE + path + "?" + urlencode(params), headers={"Accept":"application/json"})
    with urlopen(request, timeout=20) as response:
        return json.load(response)

def uniprot_search(query: str, field: str = "gene", size: int = 6) -> list[dict]:
    field_name = "gene_exact" if field == "gene" else "protein_name"
    data = _get("/uniprotkb/search", {"query": f'organism_id:9606 AND reviewed:true AND {field_name}:"{query}"', "size": size})
    return data.get("results", [])

def uniprot_get_entry(accession: str) -> dict:
    request = Request(f"{BASE}/uniprotkb/{accession}.json", headers={"Accept":"application/json"})
    with urlopen(request, timeout=20) as response:
        return json.load(response)
