from dataclasses import dataclass
from typing import Any

@dataclass
class ToolResult:
    data: Any
    source: str
    url: str | None = None
