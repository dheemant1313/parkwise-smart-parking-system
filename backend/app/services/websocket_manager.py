"""Real-Time WebSocket Connection Manager for Live Slot & Gate Telemetry."""
from typing import List
from fastapi import WebSocket


class TelemetryConnectionManager:
    def __init__(self) -> None:
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_event(self, event_type: str, payload: dict) -> None:
        dead_connections: List[WebSocket] = []
        message = {"event": event_type, "data": payload}
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        for dead in dead_connections:
            self.disconnect(dead)


ws_manager = TelemetryConnectionManager()
