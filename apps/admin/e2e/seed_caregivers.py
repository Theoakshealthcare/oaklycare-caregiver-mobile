"""Seed two caregivers for the Playwright e2e through the real API (and one DB read for the OTP).

Run it with the BACKEND's Python environment, against the running docker stack:

    cd <backend repo>
    poetry run python <this file> --db-url postgresql://oakly:oakly@127.0.0.1:5432/oakly

It prints one JSON line: {"approvable": "<full name>", "unmet": "<full name>"}.
Both caregivers finish onboarding (profile, one licence upload, consents), so they sit in
`under_review`. Nothing is verified: the e2e does the document, identity and background decisions and
the skills itself, so the console is exercised end to end. The second caregiver is left untouched so
the e2e can hit the 409 "unmet requirements" case. Placeholder data only.
"""

import argparse
import json
import sys
import uuid

import httpx
import psycopg2

PNG_1X1 = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c6360000002000001e221bc330000000049454e44ae426082"
)
PASSWORD = "E2e-Placeholder-Pass-91!"


def onboard(http: httpx.Client, db, email: str, name: str, phone: str) -> None:
    def call(method: str, path: str, **kw) -> httpx.Response:
        r = http.request(method, path, **kw)
        if r.status_code >= 300:
            sys.exit(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
        return r

    call("POST", "/api/v1/auth/register", json={
        "email": email, "password": PASSWORD, "full_name": name, "phone_number": phone, "user_type": "caregiver"})
    with db.cursor() as cur:
        cur.execute("SELECT verification_code FROM users WHERE email = %s", (email,))
        (code,) = cur.fetchone()
    call("POST", "/api/v1/auth/verify-email", json={"email": email, "code": code})
    token = call("POST", "/api/v1/auth/login/mobile", json={"email_or_phone": email, "password": PASSWORD}).json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    call("PUT", "/api/v1/caregiver/profile/step1", headers=auth, json={
        "date_of_birth": "1990-01-01", "gender": "female", "state": "Lagos",
        "address": "1 Placeholder Street, Lekki", "emergency_contact_phone": "+2340000000999"})
    call("PUT", "/api/v1/caregiver/profile/step2", headers=auth, json={
        "specialization": "Elderly Care", "years_of_experience": 5, "preferred_work_hours": "weekdays",
        "service_areas": ["Personal Care", "Medication Reminders"]})
    call("POST", "/api/v1/caregiver/documents/upload", headers=auth, data={"document_type": "license"},
         files={"file": ("license.png", PNG_1X1, "image/png")})
    call("PUT", "/api/v1/caregiver/consent", headers=auth, json={
        "terms_accepted": True, "privacy_policy_accepted": True, "background_check_consent": True})


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--base-url", default="http://127.0.0.1:8000")
    p.add_argument("--db-url", default="postgresql://oakly:oakly@127.0.0.1:5432/oakly")
    args = p.parse_args()
    tag = uuid.uuid4().hex[:6]
    db = psycopg2.connect(args.db_url)
    db.autocommit = True
    names = {"approvable": f"E2E Approvable {tag}", "unmet": f"E2E Unmet {tag}"}
    with httpx.Client(base_url=args.base_url, timeout=30) as http:
        for i, (key, name) in enumerate(names.items()):
            onboard(http, db, f"e2e-{tag}-{key}@example.com", name, f"+2340001{int(tag, 16) % 10000:04d}{i:02d}")
    print(json.dumps(names))


if __name__ == "__main__":
    main()
