#!/usr/bin/env python3
"""Update Keycloak client redirect URIs + enable Google IdP on production."""
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = os.environ.get("KC_BASE", "https://aidr.id.vn/auth")
ADMIN_USER = os.environ["KC_ADMIN_USER"]
ADMIN_PASS = os.environ["KC_ADMIN_PASSWORD"]
GOOGLE_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]


def req(method, url, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None
    if data is not None:
        body = json.dumps(data).encode()
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=60) as resp:
        raw = resp.read()
        if not raw:
            return None
        return json.loads(raw.decode())


def form_post(url, form):
    data = urllib.parse.urlencode(form).encode()
    r = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main():
    token = form_post(
        f"{BASE}/realms/master/protocol/openid-connect/token",
        {
            "client_id": "admin-cli",
            "username": ADMIN_USER,
            "password": ADMIN_PASS,
            "grant_type": "password",
        },
    )["access_token"]

    clients = req(
        "GET",
        f"{BASE}/admin/realms/aidr/clients?clientId=aidr-fe",
        token=token,
    )
    if not clients:
        print("aidr-fe client not found", file=sys.stderr)
        sys.exit(1)
    client = clients[0]
    cid = client["id"]
    client["redirectUris"] = [
        "https://aidr.id.vn/*",
        "https://www.aidr.id.vn/*",
        "http://localhost:5173/*",
    ]
    client["webOrigins"] = [
        "https://aidr.id.vn",
        "https://www.aidr.id.vn",
        "http://localhost:5173",
    ]
    client["attributes"] = client.get("attributes") or {}
    client["attributes"]["post.logout.redirect.uris"] = "https://aidr.id.vn/*##https://www.aidr.id.vn/*"
    req("PUT", f"{BASE}/admin/realms/aidr/clients/{cid}", data=client, token=token)
    print("client aidr-fe redirect URIs updated")

    idp = {
        "alias": "google",
        "providerId": "google",
        "enabled": True,
        "updateProfileFirstLoginMode": "missing",
        "trustEmail": True,
        "storeToken": False,
        "addReadTokenRoleOnCreate": False,
        "authenticateByDefault": False,
        "linkOnly": False,
        "firstBrokerLoginFlowAlias": "first broker login",
        "config": {
            "clientId": GOOGLE_ID,
            "clientSecret": GOOGLE_SECRET,
            "defaultScope": "openid email profile",
            "syncMode": "IMPORT",
        },
    }
    try:
        req(
            "PUT",
            f"{BASE}/admin/realms/aidr/identity-provider/instances/google",
            data=idp,
            token=token,
        )
        print("google IdP updated")
    except Exception as e:
        # create if missing
        print("update failed, trying create:", e)
        req(
            "POST",
            f"{BASE}/admin/realms/aidr/identity-provider/instances",
            data=idp,
            token=token,
        )
        print("google IdP created")

    print("KEYCLOAK_OK")


if __name__ == "__main__":
    main()
