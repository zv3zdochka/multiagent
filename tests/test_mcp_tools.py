import json
from mcp_server.server import handle

def test_tools_list():
    names=[x["name"] for x in handle({"id":1,"method":"tools/list"})["result"]["tools"]]
    assert names == ["uniprot_search","uniprot_get_entry","quickgo_search_annotations","quickgo_get_terms"]
