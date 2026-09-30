"""Payment boundary: a real provider must verify settlements before granting paid access.

No local 'mark paid' endpoint, card storage, synthetic earnings or client-trusted receipts.
Future adapters must implement idempotent checkout, signed webhook verification,
refunds and connected-account payouts against the Marketplace ledger.
"""
class PaymentsUnavailable(ValueError):
    pass

class UnconfiguredProvider:
    name = 'unconfigured'
    def checkout(self, order):
        raise PaymentsUnavailable('Payments are not configured yet. No charge was made.')
    def refund(self, transaction):
        raise PaymentsUnavailable('Refunds require a configured payment provider.')
    def payout(self, seller):
        raise PaymentsUnavailable('Seller payouts are not configured yet.')

def provider():
    return UnconfiguredProvider()
