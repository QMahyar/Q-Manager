#!/usr/bin/env python3
import asyncio
import contextlib
import json
import sys
import traceback
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Tuple
from telethon import TelegramClient, events, errors
from telethon.errors import SessionPasswordNeededError

# Realistic default connection identity. Without this, Telethon reports the
# device as "Telethon", which is a trivial fingerprint for a userbot. These are
# overridden per-install by the config passed on argv.
DEFAULT_DEVICE_MODEL = "Desktop"
DEFAULT_SYSTEM_VERSION = "Windows 10"
DEFAULT_APP_VERSION = "5.3.1 x64"
DEFAULT_LANG_CODE = "en"


@dataclass
class ConnectionConfig:
    device_model: str = DEFAULT_DEVICE_MODEL
    system_version: str = DEFAULT_SYSTEM_VERSION
    app_version: str = DEFAULT_APP_VERSION
    lang_code: str = DEFAULT_LANG_CODE
    proxy_url: Optional[str] = None

    @staticmethod
    def from_json(raw: str) -> "ConnectionConfig":
        cfg = ConnectionConfig()
        if not raw:
            return cfg
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            sys.stderr.write("[telethon-worker] Invalid connection config JSON; using defaults.\n")
            sys.stderr.flush()
            return cfg
        # Only override when a non-empty value is supplied.
        for key in ("device_model", "system_version", "app_version", "lang_code"):
            val = data.get(key)
            if isinstance(val, str) and val.strip():
                setattr(cfg, key, val.strip())
        proxy = data.get("proxy_url")
        if isinstance(proxy, str) and proxy.strip():
            cfg.proxy_url = proxy.strip()
        return cfg


def _parse_proxy(proxy_url: Optional[str]) -> Tuple[Optional[Any], Optional[Any]]:
    """Parse a proxy URL into Telethon's (connection, proxy) kwargs.

    Returns (connection, proxy):
      - SOCKS5/SOCKS4/HTTP -> (None, ('socks5', host, port, True, user, pass))
      - MTProto            -> (ConnectionTcpMTProxyRandomizedIntermediate,
                               (host, port, secret))
      - None / unparseable -> (None, None)

    Accepts mtproto://host:port?secret=HEX and Telegram's own
    tg://proxy?server=host&port=port&secret=HEX share link.
    """
    if not proxy_url:
        return None, None

    from urllib.parse import urlparse, parse_qs, unquote

    raw = proxy_url.strip()
    lower = raw.lower()

    # MTProto
    if lower.startswith("mtproto://") or lower.startswith("tg://proxy"):
        try:
            from telethon.network import ConnectionTcpMTProxyRandomizedIntermediate
        except Exception:
            sys.stderr.write("[telethon-worker] MTProto proxy requested but connection class unavailable.\n")
            sys.stderr.flush()
            return None, None
        parsed = urlparse(raw)
        qs = parse_qs(parsed.query)
        # tg://proxy uses server/port query params; mtproto:// uses netloc host:port.
        host = (qs.get("server", [None])[0]) or (parsed.hostname)
        port_str = (qs.get("port", [None])[0]) or (str(parsed.port) if parsed.port else None)
        secret = qs.get("secret", [None])[0]
        if secret:
            secret = unquote(secret)
        if not (host and port_str and secret):
            sys.stderr.write("[telethon-worker] Incomplete MTProto proxy (need host, port, secret).\n")
            sys.stderr.flush()
            return None, None
        try:
            port = int(port_str)
        except ValueError:
            return None, None
        return ConnectionTcpMTProxyRandomizedIntermediate, (host, port, secret)

    # SOCKS / HTTP via PySocks. urlparse needs a scheme it recognizes; map ours.
    parsed = urlparse(raw)
    scheme = parsed.scheme.lower()
    proxy_type = {
        "socks5": "socks5",
        "socks4": "socks4",
        "http": "http",
        "https": "http",
    }.get(scheme)
    if not proxy_type or not parsed.hostname or not parsed.port:
        sys.stderr.write(f"[telethon-worker] Unsupported/invalid proxy URL: {raw}\n")
        sys.stderr.flush()
        return None, None
    username = unquote(parsed.username) if parsed.username else None
    password = unquote(parsed.password) if parsed.password else None
    # Telethon proxy tuple: (type, host, port, rdns, username, password)
    proxy_tuple = (proxy_type, parsed.hostname, parsed.port, True, username, password)
    return None, proxy_tuple


@dataclass
class WorkerState:
    api_id: int
    api_hash: str
    session_path: str
    conn_config: ConnectionConfig = field(default_factory=ConnectionConfig)
    phone: Optional[str] = None
    client: Optional[TelegramClient] = None
    authorized: bool = False
    user: Optional[Dict[str, Any]] = None
    should_exit: bool = False
    # Guards lazy client creation so concurrently-dispatched commands don't each
    # build their own TelegramClient. Initialized in main() (needs a running loop).
    client_lock: Optional[asyncio.Lock] = None


async def write_response(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


async def enqueue_event(queue: asyncio.Queue, payload: Dict[str, Any]) -> None:
    try:
        queue.put_nowait(payload)
    except asyncio.QueueFull:
        # Drop oldest event to prevent unbounded growth
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        queue.put_nowait(payload)
        sys.stderr.write("[telethon-worker] Event queue full; dropped oldest event.\n")
        sys.stderr.flush()


async def event_writer(queue: asyncio.Queue) -> None:
    while True:
        event = await queue.get()
        await write_response({"event": event})


def _build_message_payload(event_type: str, message) -> Dict[str, Any]:
    """Build an outgoing message event payload, tolerating a buttons failure.

    `message.buttons` is a lazy Telethon property that can raise (it may need to
    resolve the bot entity / hit the network). If it does, we still emit the
    message with an empty button list rather than letting the exception bubble
    up — Telethon would otherwise swallow it and drop the entire event.
    """
    try:
        buttons = _serialize_buttons(message)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.stderr.write("[telethon-worker] Failed to serialize buttons; emitting with none.\n")
        sys.stderr.flush()
        buttons = []
    return {
        "type": event_type,
        "message": {
            "id": message.id,
            "chat_id": message.chat_id,
            "sender_id": message.sender_id or 0,
            "text": message.raw_text or "",
            "is_outgoing": bool(message.out),
            "buttons": buttons,
        },
    }


def _serialize_buttons(message) -> List[List[Dict[str, Any]]]:
    rows: List[List[Dict[str, Any]]] = []
    if message.buttons:
        for row in message.buttons:
            row_items = []
            for button in row:
                btn_type = "unknown"
                data = None
                url = None
                if hasattr(button, "data") and button.data is not None:
                    btn_type = "callback"
                    data = button.data.hex()
                elif hasattr(button, "url") and button.url:
                    btn_type = "url"
                    url = button.url
                else:
                    # Reply keyboard button - just text
                    btn_type = "text"
                row_items.append({
                    "text": button.text,
                    "type": btn_type,
                    "data": data,
                    "url": url,
                })
            rows.append(row_items)
    return rows


def build_error(request_id: str, message: str) -> Dict[str, Any]:
    return {"id": request_id, "ok": False, "error": message}


def build_error_with_payload(request_id: str, message: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": request_id, "ok": False, "error": message, "payload": payload}


def build_ok(request_id: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"id": request_id, "ok": True, "payload": payload or {}}


def auth_state(state: WorkerState) -> Dict[str, Any]:
    if state.authorized and state.user:
        return {
            "state": "ready",
            "user_id": state.user.get("id"),
            "first_name": state.user.get("first_name", ""),
            "last_name": state.user.get("last_name", ""),
            "phone": state.user.get("phone", ""),
        }
    if state.phone:
        return {"state": "waiting_code", "phone_number": state.phone}
    return {"state": "waiting_phone_number"}


async def ensure_client(state: WorkerState, event_queue: asyncio.Queue) -> TelegramClient:
    if state.client:
        return state.client

    # Double-checked locking: commands are now dispatched concurrently, so guard
    # client creation to avoid building two TelegramClients for one worker.
    lock = state.client_lock
    if lock is not None:
        await lock.acquire()
    try:
        if state.client:
            return state.client

        cfg = state.conn_config
        connection, proxy = _parse_proxy(cfg.proxy_url)
        client_kwargs: Dict[str, Any] = {
            "device_model": cfg.device_model,
            "system_version": cfg.system_version,
            "app_version": cfg.app_version,
            "lang_code": cfg.lang_code,
            "system_lang_code": cfg.lang_code,
        }
        if connection is not None:
            client_kwargs["connection"] = connection
        if proxy is not None:
            client_kwargs["proxy"] = proxy

        client = TelegramClient(state.session_path, state.api_id, state.api_hash, **client_kwargs)
        await client.connect()

        # Start client to ensure proper initialization
        if await client.is_user_authorized():
            await client.start()

        @client.on(events.NewMessage)
        async def on_new_message(event):
            try:
                await enqueue_event(event_queue, _build_message_payload("message", event.message))
            except Exception:
                # Never let a handler exception propagate — Telethon would
                # silently swallow it and we'd lose visibility into the failure.
                traceback.print_exc(file=sys.stderr)

        @client.on(events.MessageEdited)
        async def on_message_edited(event):
            try:
                await enqueue_event(
                    event_queue, _build_message_payload("message_edited", event.message)
                )
            except Exception:
                traceback.print_exc(file=sys.stderr)

        state.client = client
        state.authorized = await client.is_user_authorized()
        if state.authorized:
            me = await client.get_me()
            state.user = {
                "id": me.id,
                "first_name": me.first_name or "",
                "last_name": me.last_name or "",
                "phone": me.phone or "",
            }
        return client
    finally:
        if lock is not None:
            lock.release()


async def handle_command(state: WorkerState, request: Dict[str, Any], event_queue: asyncio.Queue) -> None:
    request_id = request.get("id") or ""
    command = request.get("command")
    payload = request.get("payload") or {}

    try:
        if command == "state":
            await write_response(build_ok(request_id, auth_state(state)))
            return

        client = await ensure_client(state, event_queue)

        if command == "send_phone":
            phone = payload.get("phone")
            if not phone:
                await write_response(build_error(request_id, "Phone number required"))
                return
            try:
                await client.send_code_request(phone)
            except errors.FloodWaitError as e:
                await write_response(build_error_with_payload(request_id, "FLOOD_WAIT", {"code": "FLOOD_WAIT", "seconds": e.seconds}))
                return
            state.phone = phone
            await write_response(build_ok(request_id, auth_state(state)))
            return

        if command == "send_code":
            code = payload.get("code")
            if not code or not state.phone:
                await write_response(build_error(request_id, "Code and phone required"))
                return
            try:
                await client.sign_in(state.phone, code)
            except SessionPasswordNeededError:
                # Get password hint from Telegram
                password_info = await client.get_password()
                hint = password_info.hint if password_info and password_info.hint else ""
                await write_response(build_ok(request_id, {"state": "waiting_password", "password_hint": hint}))
                return
            except errors.FloodWaitError as e:
                await write_response(build_error_with_payload(request_id, "FLOOD_WAIT", {"code": "FLOOD_WAIT", "seconds": e.seconds}))
                return
            state.authorized = await client.is_user_authorized()
            if state.authorized:
                me = await client.get_me()
                state.user = {
                    "id": me.id,
                    "first_name": me.first_name or "",
                    "last_name": me.last_name or "",
                    "phone": me.phone or "",
                }
            await write_response(build_ok(request_id, auth_state(state)))
            return

        if command == "send_password":
            password = payload.get("password")
            if not password:
                await write_response(build_error(request_id, "Password required"))
                return
            try:
                await client.sign_in(password=password)
            except errors.FloodWaitError as e:
                await write_response(build_error_with_payload(request_id, "FLOOD_WAIT", {"code": "FLOOD_WAIT", "seconds": e.seconds}))
                return
            state.authorized = await client.is_user_authorized()
            if state.authorized:
                me = await client.get_me()
                state.user = {
                    "id": me.id,
                    "first_name": me.first_name or "",
                    "last_name": me.last_name or "",
                    "phone": me.phone or "",
                }
            await write_response(build_ok(request_id, auth_state(state)))
            return

        if command == "list_groups":
            groups = []
            async for dialog in client.iter_dialogs():
                entity = dialog.entity
                if dialog.is_group:
                    group_type = "supergroup" if getattr(entity, "megagroup", False) else "group"
                    groups.append({
                        "id": dialog.id,
                        "title": dialog.name,
                        "group_type": group_type,
                    })
            await write_response(build_ok(request_id, {"groups": groups}))
            return

        if command == "send_message":
            chat_id = payload.get("chat_id")
            text = payload.get("text")
            if chat_id is None or not text:
                await write_response(build_error(request_id, "chat_id and text required"))
                return
            try:
                await client.send_message(int(chat_id), text)
            except errors.FloodWaitError as e:
                await write_response(build_error_with_payload(request_id, "FLOOD_WAIT", {"code": "FLOOD_WAIT", "seconds": e.seconds}))
                return
            except errors.SlowModeWaitError as e:
                await write_response(build_error_with_payload(request_id, "SLOWMODE_WAIT", {"code": "SLOWMODE_WAIT", "seconds": e.seconds}))
                return
            except (errors.AuthKeyDuplicatedError, errors.SessionRevokedError) as e:
                await write_response(build_error_with_payload(request_id, "AUTH_REVOKED", {"code": "AUTH_REVOKED", "message": str(e)}))
                return
            await write_response(build_ok(request_id, {}))
            return

        if command == "click_button":
            chat_id = payload.get("chat_id")
            message_id = payload.get("message_id")
            data = payload.get("data")
            text = payload.get("text")
            
            if chat_id is None or message_id is None:
                await write_response(build_error(request_id, "chat_id and message_id required"))
                return
            
            try:
                # Handle callback buttons (data present) vs text buttons.
                # Use `is not None` so an empty-but-present data string is still
                # treated as a callback rather than silently falling through.
                if data is not None:
                    await client.send_callback(int(chat_id), int(message_id), bytes.fromhex(data))
                elif text:
                    # Reply keyboard button - send text as message
                    await client.send_message(int(chat_id), text)
                else:
                    await write_response(build_error(request_id, "Either data or text must be provided"))
                    return
            except errors.FloodWaitError as e:
                await write_response(build_error_with_payload(request_id, "FLOOD_WAIT", {"code": "FLOOD_WAIT", "seconds": e.seconds}))
                return
            except errors.SlowModeWaitError as e:
                await write_response(build_error_with_payload(request_id, "SLOWMODE_WAIT", {"code": "SLOWMODE_WAIT", "seconds": e.seconds}))
                return
            except (errors.AuthKeyDuplicatedError, errors.SessionRevokedError) as e:
                await write_response(build_error_with_payload(request_id, "AUTH_REVOKED", {"code": "AUTH_REVOKED", "message": str(e)}))
                return
            
            await write_response(build_ok(request_id, {}))
            return

        if command == "start_updates":
            await write_response(build_ok(request_id, {"status": "listening"}))
            return

        if command == "shutdown":
            if state.client:
                await state.client.disconnect()
            await write_response(build_ok(request_id, {}))
            # Signal the main loop to exit so the process terminates promptly
            # instead of waiting to be force-killed.
            state.should_exit = True
            return

        await write_response(build_error(request_id, f"Unknown command: {command}"))
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        await write_response(build_error(request_id, str(exc)))


async def main() -> None:
    if len(sys.argv) < 4:
        sys.stderr.write("Usage: telethon_worker.py <api_id> <api_hash> <session_path> [config_json]\n")
        sys.exit(1)

    api_id = int(sys.argv[1])
    api_hash = sys.argv[2]
    session_path = sys.argv[3]
    # Optional 4th arg: JSON connection config (device identity + proxy).
    conn_config = ConnectionConfig.from_json(sys.argv[4] if len(sys.argv) > 4 else "")

    state = WorkerState(
        api_id=api_id,
        api_hash=api_hash,
        session_path=session_path,
        conn_config=conn_config,
    )
    state.client_lock = asyncio.Lock()

    EVENT_QUEUE_SIZE = 200
    event_queue: asyncio.Queue = asyncio.Queue(maxsize=EVENT_QUEUE_SIZE)
    event_task = asyncio.create_task(event_writer(event_queue))

    # Track in-flight command tasks. Commands are dispatched concurrently so a
    # slow one (e.g. list_groups iterating every dialog) does not block reading
    # and handling the next stdin line, which would otherwise let the Rust caller
    # hit its request timeout while the worker is still busy.
    pending: "set[asyncio.Task]" = set()

    loop = asyncio.get_running_loop()
    while not state.should_exit:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        try:
            request = json.loads(line.strip())
        except json.JSONDecodeError:
            continue

        task = asyncio.create_task(handle_command(state, request, event_queue))
        pending.add(task)
        task.add_done_callback(pending.discard)

        # Shutdown must take effect deterministically: let it run to completion
        # (disconnect + ack) and then stop reading.
        if request.get("command") == "shutdown":
            await task
            break

    # Let any still-running command tasks finish writing their responses.
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)

    event_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await event_task


if __name__ == "__main__":
    asyncio.run(main())
