import os
from app.providers.routerai_client import RouterAIClient

def test_defaults(monkeypatch):
    monkeypatch.delenv('ROUTERAI_BASE_URL',raising=False); monkeypatch.delenv('ROUTERAI_MODEL',raising=False)
    c=RouterAIClient(); assert c.base_url=='https://routerai.ru/api/v1'; assert c.model=='inclusionai/ling-3.0-flash'
