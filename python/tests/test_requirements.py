from rail402_x402.types import PaymentRequirements, to_atomic


def test_to_atomic():
    assert to_atomic("0.05") == "50000"
    assert to_atomic("1") == "1000000"
    assert to_atomic("1.5") == "1500000"
    assert to_atomic("0") == "0"
    assert to_atomic("0.000001") == "1"
    assert to_atomic(0.05) == "50000"


def test_create_requirements_defaults_to_base():
    req = PaymentRequirements.create("0.05", "0xabc")
    assert req.network == "base"
    assert req.chain_id == 8453
    assert req.amount_atomic == "50000"
    d = req.to_dict()
    assert d["type"] == "x402_payment_required"
    assert d["payTo"] == "0xabc"


def test_create_requirements_sepolia():
    req = PaymentRequirements.create(1, "0xabc", network="base-sepolia")
    assert req.chain_id == 84532
    assert req.amount_atomic == "1000000"
