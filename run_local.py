import json, os, sys
from app.orchestration.orchestrator import Orchestrator
if __name__ == "__main__":
    question=" ".join(sys.argv[1:]) or input("Вопрос: ")
    print(json.dumps(Orchestrator(__import__('app.providers.routerai_client',fromlist=['RouterAIClient']).RouterAIClient()).run(question),ensure_ascii=False,indent=2))
