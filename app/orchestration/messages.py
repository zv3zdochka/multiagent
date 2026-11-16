from dataclasses import dataclass, field
@dataclass
class AgentMessage:
    sender:str; recipient:str; type:str; payload:dict; message_id:str
@dataclass
class Trace:
    events:list[dict]=field(default_factory=list)
    def add(self,sender,recipient,event,payload=None): self.events.append({"sender":sender,"recipient":recipient,"event":event,"payload":payload or {}})
