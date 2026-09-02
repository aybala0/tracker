#!/usr/bin/env python3
"""Local-only script: scrapes your real Amazon order history via the
amazon-orders library and pushes it to finance_tracker's backend, which
matches it against uncategorized "amazon"-labeled bank transactions and
splits each match into per-item inbox rows.

This has to run locally rather than as a Vercel function: amazon-orders
needs your real Amazon login (and 2FA), and Amazon will flag repeated
automated logins from a datacenter IP. Run it yourself whenever you want
fresh Amazon item matches.

Usage:
    python scripts/amazon_sync.py [--time-filter last30|months-3|year-YYYY] [--dry-run]

Requires in .env (project root):
    AMAZON_EMAIL, AMAZON_PASSWORD       - your real Amazon login
    AMAZON_OTP_SECRET_KEY               - optional, only if 2FA is on and you
                                           have the TOTP secret; otherwise the
                                           library will prompt you for a code
                                           interactively on first login
    APP_PASSWORD                        - finance_tracker's own app password
    APP_URL                             - e.g. http://localhost:3311 or your
                                           deployed URL
"""
import argparse
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def login_to_backend(api_base: str, app_password: str) -> requests.Session:
    session = requests.Session()
    resp = session.post(f"{api_base}/api/auth/login", json={"password": app_password}, timeout=15)
    resp.raise_for_status()
    return session


def fetch_amazon_orders(time_filter: str):
    from amazonorders.session import AmazonSession
    from amazonorders.orders import AmazonOrders

    email = os.environ["AMAZON_EMAIL"]
    password = os.environ["AMAZON_PASSWORD"]
    otp_secret = os.environ.get("AMAZON_OTP_SECRET_KEY")

    amazon_session = AmazonSession(email, password, otp_secret_key=otp_secret)
    amazon_session.login()

    amazon_orders = AmazonOrders(amazon_session)
    return amazon_orders.get_order_history(time_filter=time_filter, full_details=True)


def to_payload(orders) -> list[dict]:
    payload = []
    for order in orders:
        if order.cancelled or not order.items:
            continue
        items = [
            {"name": item.title, "price": item.price, "quantity": item.quantity or 1}
            for item in order.items
            if item.price is not None
        ]
        if not items:
            continue
        payload.append(
            {
                "orderId": order.order_number,
                "orderDate": order.order_placed_date.isoformat(),
                "items": items,
                "grandTotal": order.grand_total,
            }
        )
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--time-filter",
        default="months-3",
        help='Amazon history window: "last30", "months-3", or "year-YYYY" (default: months-3)',
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch and print orders without pushing to the backend")
    args = parser.parse_args()

    api_base = os.environ.get("APP_URL")
    app_password = os.environ.get("APP_PASSWORD")
    if not args.dry_run and (not api_base or not app_password):
        print("APP_URL and APP_PASSWORD must be set in .env", file=sys.stderr)
        sys.exit(1)

    print(f"Fetching Amazon order history ({args.time_filter})...")
    orders = fetch_amazon_orders(args.time_filter)
    payload = to_payload(orders)
    print(f"Fetched {len(orders)} orders, {len(payload)} usable (have items with prices).")

    if args.dry_run:
        for o in payload:
            print(f"  {o['orderId']} {o['orderDate']} ${o['grandTotal']} - {len(o['items'])} items")
        return

    if not payload:
        print("Nothing to import.")
        return

    session = login_to_backend(api_base, app_password)
    resp = session.post(f"{api_base}/api/amazon/import-orders", json={"orders": payload}, timeout=60)
    resp.raise_for_status()
    result = resp.json()
    print(
        f"Imported {result['imported']} orders. "
        f"Matched {result['matched']} bank charges, created {result['itemsCreated']} inbox item rows "
        f"({result['skipped']} ambiguous charges skipped)."
    )


if __name__ == "__main__":
    main()
