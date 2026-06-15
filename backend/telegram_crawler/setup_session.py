"""One-time Telegram session setup.

Run this script ONCE from the telegram_crawler directory before starting
the crawler server for the first time:

    cd backend/telegram_crawler
    python setup_session.py

You will be prompted for:
  - Your phone number in international format  (e.g. +972501234567)
  - The OTP code Telegram sends to your app / SMS

A  .session  file is saved permanently.  The server auto-authenticates from
then on — you will never be prompted again unless you delete the session file.

Prerequisites
─────────────
1. Go to  https://my.telegram.org/apps  →  "API development tools"
2. Create an app (any name, platform = "Other")
3. Copy the api_id (integer) and api_hash (string) into your .env file:

       TELEGRAM_API_ID=1234567
       TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890

4. Install telethon if you haven't yet:

       pip install telethon
"""
import asyncio
import os
import sys

from dotenv import load_dotenv

load_dotenv()

API_ID   = os.getenv("TELEGRAM_API_ID", "")
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
SESSION  = os.getenv("TELEGRAM_SESSION_PATH", "telegram_session")

if not API_ID or not API_HASH:
    print(
        "ERROR: TELEGRAM_API_ID and TELEGRAM_API_HASH are not set in .env\n"
        "Get them from https://my.telegram.org/apps"
    )
    sys.exit(1)

try:
    from telethon import TelegramClient
except ImportError:
    print("ERROR: telethon is not installed.\nRun:  pip install telethon")
    sys.exit(1)


async def main() -> None:
    print(f"Connecting to Telegram (session file: {SESSION}.session) …\n")
    client = TelegramClient(SESSION, int(API_ID), API_HASH)
    await client.start()          # prompts phone + OTP interactively
    me = await client.get_me()
    name = me.first_name + (f" (@{me.username})" if me.username else "")
    print(f"\nAuthenticated as: {name}")
    print(f"Session saved to: {SESSION}.session")
    print(
        "\nYou can now start the crawler server — it will auto-login "
        "on every startup without prompting."
    )
    await client.disconnect()


asyncio.run(main())
