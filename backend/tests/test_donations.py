import pytest
from datetime import datetime, timedelta, timezone


def future_iso(hours=48):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def start_iso(hours=1):
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


VALID_DONATION = {
    "food_name": "Dal Rice Test",
    "food_category": "cooked_meals",
    "quantity": 10.0,
    "unit": "kg",
    "storage_condition": "hot",
    "pickup_address": "123 Test Street",
    "pickup_city": "Test City",
    "pickup_latitude": 30.7,
    "pickup_longitude": 76.7,
    "collection_start_time": start_iso(),
    "pickup_deadline": future_iso(),
    "is_vegetarian": True,
    "is_vegan": False,
    "is_halal": False,
    "is_kosher": False,
    "donor_confirms_accuracy": True,
}


@pytest.mark.asyncio
async def test_create_donation_without_org(client, donor_token):
    """Donor with no registered org gets 400."""
    resp = await client.post(
        "/api/v1/donations",
        json=VALID_DONATION,
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    # 400 = no org registered, 403 = unverified org
    assert resp.status_code in [400, 403]


@pytest.mark.asyncio
async def test_past_deadline_rejected(client, donor_token):
    """Past pickup_deadline must be rejected by Pydantic validator."""
    data = {**VALID_DONATION, "pickup_deadline": "2020-01-01T00:00:00+00:00"}
    resp = await client.post(
        "/api/v1/donations",
        json=data,
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_donor_confirms_accuracy_required(client, donor_token):
    """donor_confirms_accuracy=False must be rejected."""
    data = {**VALID_DONATION, "donor_confirms_accuracy": False}
    resp = await client.post(
        "/api/v1/donations",
        json=data,
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_donations_requires_auth(client):
    """Unauthenticated list → 401 or 403."""
    resp = await client.get("/api/v1/donations")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_list_donations_authenticated(client, donor_token):
    """Authenticated user can list donations."""
    resp = await client.get(
        "/api/v1/donations",
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body
    assert "total" in body


@pytest.mark.asyncio
async def test_recipient_cannot_create_donation(client, recipient_token):
    """Recipients are forbidden from creating donations."""
    resp = await client.post(
        "/api/v1/donations",
        json=VALID_DONATION,
        headers={"Authorization": f"Bearer {recipient_token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_donation_not_found(client, donor_token):
    """Non-existent donation ID returns 404 or 422."""
    resp = await client.get(
        "/api/v1/donations/000000000000000000000000",
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code in [404, 422]


@pytest.mark.asyncio
async def test_zero_quantity_rejected(client, donor_token):
    """Quantity must be > 0."""
    data = {**VALID_DONATION, "quantity": 0}
    resp = await client.post(
        "/api/v1/donations",
        json=data,
        headers={"Authorization": f"Bearer {donor_token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_my_donations_donor_only(client, recipient_token):
    """GET /donations/my is restricted to donors."""
    resp = await client.get(
        "/api/v1/donations/my",
        headers={"Authorization": f"Bearer {recipient_token}"},
    )
    assert resp.status_code == 403
