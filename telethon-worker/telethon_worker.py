#!/usr/bin/env python3
import asyncio
import json
import sys
import traceback
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from telethon import TelegramClient, events, errors
from telethon.errors import SessionPasswordNeededError

@dataclass
class WorkerState:
    api_id: int
    api_hash: str
    session_path: str
    phone: Optional[str] = None
    client: Optional[TelegramClient] = None
    authorized: bool = False
    user: Optional[Dict[str, Any]] = None


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


async def event_writer(queue: asyncio.Queue) -> None:
    while True:
        event = await queue.get()
        await write_response({"event": event})


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
    client = TelegramClient(state.session_path, state.api_id, state.api_hash)
    await client.connect()
    
    # Start client to ensure proper initialization
    if await client.is_user_authorized():
        await client.start()

    @client.on(events.NewMessage)
    async def on_new_message(event):
        message = event.message
        payload = {
            "type": "message",
            "message": {
                "id": message.id,
                "chat_id": message.chat_id,
                "sender_id": message.sender_id or 0,
                "text": message.raw_text or "",
                "is_outgoing": bool(message.out),
                "buttons": _serialize_buttons(message),
            },
        }
        await enqueue_event(event_queue, payload)

    @client.on(events.MessageEdited)
    async def on_message_edited(event):
        message = event.message
        payload = {
            "type": "message_edited",
            "message": {
                "id": message.id,
                "chat_id": message.chat_id,
                "sender_id": message.sender_id or 0,
                "text": message.raw_text or "",
                "is_outgoing": bool(message.out),
                "buttons": _serialize_buttons(message),
            },
        }
        await enqueue_event(event_queue, payload)

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
                # Handle callback buttons (data present) vs text buttons
                if data:
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
            return

        await write_response(build_error(request_id, f"Unknown command: {command}"))
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        await write_response(build_error(request_id, str(exc)))


async def main() -> None:
    if len(sys.argv) < 4:
        sys.stderr.write("Usage: telethon_worker.py <api_id> <api_hash> <session_path>\n")
        sys.exit(1)

    api_id = int(sys.argv[1])
    api_hash = sys.argv[2]
    session_path = sys.argv[3]

    state = WorkerState(api_id=api_id, api_hash=api_hash, session_path=session_path)

    EVENT_QUEUE_SIZE = 200
    event_queue: asyncio.Queue = asyncio.Queue(maxsize=EVENT_QUEUE_SIZE)
    event_task = asyncio.create_task(event_writer(event_queue))

    loop = asyncio.get_event_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        try:
            request = json.loads(line.strip())
        except json.JSONDecodeError:
            continue
        await handle_command(state, request, event_queue)

    event_task.cancel()


if __name__ == "__main__":
    asyncio.run(main())
