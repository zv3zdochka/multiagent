class AnswerAgent:
    def __init__(self, client): self.client=client
    def run(self, question, plan, uniprot, go):
        records={"U1":uniprot,"GO":go}
        return self.client.complete("Ответь на языке вопроса. Используй только records. После фактов ставь [U1] или [G1]. Не выдумывай источники.", {"question":question,"records":records})
