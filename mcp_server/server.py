import json, sys
from .uniprot_tools import uniprot_search, uniprot_get_entry
from .quickgo_tools import quickgo_search_annotations, quickgo_get_terms

TOOLS = {"uniprot_search": uniprot_search, "uniprot_get_entry": uniprot_get_entry, "quickgo_search_annotations": quickgo_search_annotations, "quickgo_get_terms": quickgo_get_terms}

def handle(message):
    method, params, request_id = message.get("method"), message.get("params", {}), message.get("id")
    if method == "initialize":
        result = {"protocolVersion":"2025-03-26","capabilities":{"tools":{}},"serverInfo":{"name":"proteome-mcp","version":"1.0.0"}}
    elif method == "tools/list":
        result = {"tools":[{"name":name,"description":func.__doc__ or name,"inputSchema":{"type":"object"}} for name,func in TOOLS.items()]}
    elif method == "tools/call":
        value = TOOLS[params["name"]](**params.get("arguments", {}))
        result = {"content":[{"type":"text","text":json.dumps(value, ensure_ascii=False)}]}
    else:
        return {"jsonrpc":"2.0","id":request_id,"error":{"code":-32601,"message":"Method not found"}}
    return {"jsonrpc":"2.0","id":request_id,"result":result}

def main():
    for line in sys.stdin:
        try:
            print(json.dumps(handle(json.loads(line)), ensure_ascii=False), flush=True)
        except Exception as error:
            print(json.dumps({"jsonrpc":"2.0","id":None,"error":{"code":-32000,"message":str(error)}}), flush=True)

if __name__ == "__main__":
    main()
