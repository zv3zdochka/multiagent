import json
from mcp_server.uniprot_tools import uniprot_search, uniprot_get_entry
class UniProtAgent:
    def run(self, target):
        rows=uniprot_search(target,"gene")
        if not rows: rows=uniprot_search(target,"protein")
        if not rows: return {"query":target,"entries":[]}
        entry=uniprot_get_entry(rows[0]["primaryAccession"])
        return {"query":target,"accession":entry["primaryAccession"],"organism":"Homo sapiens","entry":entry}
