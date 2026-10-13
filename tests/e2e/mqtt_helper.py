"""Helper tipis di atas paho-mqtt untuk tes E2E: connect sinkron dengan timeout,
dan observasi disconnect (dipakai untuk memverifikasi penolakan ACL).
"""
import threading
import time
from dataclasses import dataclass, field

import paho.mqtt.client as mqtt


@dataclass
class MqttSession:
    client: mqtt.Client
    connected_event: threading.Event = field(default_factory=threading.Event)
    disconnected_event: threading.Event = field(default_factory=threading.Event)
    connect_reason_code: int | None = None
    disconnect_reason_code: int | None = None
    received_messages: list[tuple[str, bytes]] = field(default_factory=list)

    def wait_connected(self, timeout: float = 5.0) -> bool:
        return self.connected_event.wait(timeout)

    def wait_disconnected(self, timeout: float = 5.0) -> bool:
        return self.disconnected_event.wait(timeout)

    def close(self) -> None:
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception:
            pass


def connect(
    host: str,
    port: int,
    client_id: str,
    username: str,
    password: str,
    connect_timeout: float = 5.0,
) -> MqttSession:
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
    client.username_pw_set(username, password)

    session = MqttSession(client=client)

    def on_connect(c, userdata, flags, reason_code, properties):
        code = getattr(reason_code, "value", reason_code)
        session.connect_reason_code = code
        if code == 0:
            session.connected_event.set()

    def on_disconnect(c, userdata, flags, reason_code, properties):
        session.disconnect_reason_code = getattr(reason_code, "value", reason_code)
        session.disconnected_event.set()

    def on_message(c, userdata, msg):
        session.received_messages.append((msg.topic, msg.payload))

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message

    client.connect(host, port, keepalive=30)
    client.loop_start()
    session.wait_connected(connect_timeout)
    return session


def publish_and_wait(session: MqttSession, topic: str, payload: str, qos: int = 1, settle: float = 1.0) -> None:
    session.disconnected_event.clear()
    session.client.publish(topic, payload, qos=qos)
    time.sleep(settle)
