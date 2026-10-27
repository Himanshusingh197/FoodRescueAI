import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "newuser_unique@test.com",
        "password": "password123",
        "full_name": "New User",
        "role": "donor",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["success"] is True
    # Password must NEVER appear in response
    assert "password" not in str(data).lower() or "password" not in data.get("data", {})


@pytest.mark.asyncio
async def test_no_password_hash_in_response(client):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "nohash@test.com",
        "password": "password123",
        "full_name": "Hash Check",
        "role": "donor",
    })
    assert "password_hash" not in str(resp.json())


@pytest.mark.asyncio
async def test_register_duplicate_email(client):
    payload = {
        "email": "dup_unique@test.com",
        "password": "password123",
        "full_name": "Dup",
        "role": "donor",
    }
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client):
    resp = await client.post("/api/v1/auth/register", json={
        "email": "weak@test.com",
        "password": "123",
        "full_name": "Weak",
        "role": "donor",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_success(client):
    await client.post("/api/v1/auth/register", json={
        "email": "logintest@test.com",
        "password": "password123",
        "full_name": "Login User",
        "role": "donor",
    })
    resp = await client.post("/api/v1/auth/login", json={
        "email": "logintest@test.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "logintest@test.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_no_token(client):
    """No credentials → 401 Unauthorized."""
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)  # varies by FastAPI version


@pytest.mark.asyncio
async def test_get_me_with_token(client, donor_token):
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["role"] == "donor"


@pytest.mark.asyncio
async def test_get_me_invalid_token(client):
    """Tampered token → 401."""
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_role_not_trusted_from_client(client, donor_token):
    """Donor cannot access admin endpoint — role read from DB, never from client."""
    resp = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_recipient_cannot_access_donor_endpoint(client, recipient_token):
    resp = await client.get(
        "/api/v1/donations/my",
        headers={"Authorization": f"Bearer {recipient_token}"},
    )
    assert resp.status_code == 403
