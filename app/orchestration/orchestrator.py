from app.agents.chat_agent import ChatAgent
from app.agents.uniprot_agent import UniProtAgent
from app.agents.gene_ontology_agent import GeneOntologyAgent
from app.agents.answer_agent import AnswerAgent
from app.agents.critic_agent import CriticAgent
from app.orchestration.messages import Trace
class Orchestrator:
    def __init__(self,client): self.chat=ChatAgent(client); self.up=UniProtAgent(); self.go=GeneOntologyAgent(); self.answer=AnswerAgent(client); self.critic=CriticAgent()
    def run(self,question,history=""):
        trace=Trace(); plan=self.chat.plan(question,history); trace.add("chat_agent","orchestrator","plan",plan)
        if plan.get("intent") != "research": return {"answer":plan.get("answer",plan.get("question","Уточните вопрос.")),"trace":trace.events,"quality":{}}
        up=self.up.run(plan["target"]); trace.add("orchestrator","uniprot_agent","protein_context",{"accession":up.get("accession")})
        if not up.get("accession"): return {"answer":"Запись белка не найдена.","trace":trace.events,"quality":{}}
        go=self.go.run(up["accession"],plan.get("focus",["function"])); trace.add("uniprot_agent","gene_ontology_agent","evidence",{"count":len(go)})
        text=self.answer.run(question,plan,up,go); quality=self.critic.check(text,{"go":go}); trace.add("answer_agent","critic_agent","grounding_check",quality)
        return {"answer":text,"trace":trace.events,"quality":quality,"accession":up["accession"]}
