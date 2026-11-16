from app.orchestration.orchestrator import Orchestrator
class Client:
    def __init__(self): self.calls=0
    def complete(self,system,data):
        self.calls+=1
        return '{"intent":"research","target":"SOD1","sources":["uniprot","gene_ontology"],"focus":["function"]}' if self.calls==1 else 'SOD1 работает [U1].'

def test_plan_and_critic(monkeypatch):
    from app.orchestration import orchestrator
    monkeypatch.setattr(orchestrator.UniProtAgent,'run',lambda self,target:{"accession":"P00441","entry":{}})
    monkeypatch.setattr(orchestrator.GeneOntologyAgent,'run',lambda self,a,f:[{"go_id":"GO:1"}])
    result=Orchestrator(Client()).run('Что делает SOD1?')
    assert result['accession']=='P00441'
    assert result['quality']['grounded']
