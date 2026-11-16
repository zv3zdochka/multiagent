import json, os
from urllib.request import Request, urlopen

class RouterAIError(RuntimeError):
    pass

class RouterAIClient:
    def __init__(self):
        self.base_url = os.getenv("ROUTERAI_BASE_URL", "https://routerai.ru/api/v1").rstrip("/")
        self.model = os.getenv("ROUTERAI_MODEL", "inclusionai/ling-3.0-flash")
        self.api_key = os.getenv("ROUTERAI_API_KEY", "")
    def complete(self, system: str, data: dict) -> str:
        if not self.api_key:
            raise RouterAIError("ROUTERAI_API_KEY не задан")
        body = json.dumps({"model": self.model, "temperature": 0, "messages":[{"role":"system","content":system},{"role":"user","content":json.dumps(data, ensure_ascii=False)}]}).encode()
        request = Request(self.base_url + "/chat/completions", data=body, headers={"Authorization":"Bearer "+self.api_key,"Content-Type":"application/json"})
        try:
            with urlopen(request, timeout=60) as response:
                payload = json.load(response)
        except Exception as error:
            raise RouterAIError(str(error)) from error
        return payload["choices"][0]["message"]["content"]
