import json
class ChatAgent:
    def __init__(self, client): self.client=client
    def plan(self, question, history):
        raw=self.client.complete("Верни JSON intent research, answer_directly или clarify. Для research укажи target, sources и focus. Отвечай на языке вопроса.", {"question":question,"history":history})
        return json.loads(raw.strip().strip("`"))
