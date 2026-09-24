import httpx
import json

BASE = "http://localhost:8000"


def dev_login(client, email):
    r = client.post(f"{BASE}/auth/login/dev", json={"email": email})
    r.raise_for_status()
    return r.json()


if __name__ == "__main__":
    with httpx.Client() as client:
        for email in ["holder@trustvault.example"]:
            data = dev_login(client, email)
            token = data["access_token"]
            me = client.get(
                f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"}
            )
            print(email, "->", json.dumps(me.json(), indent=2))