"""Replaceable exchange-rate adapter. Sends currency codes only, never user records."""
import json
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from urllib.request import Request, urlopen

CURRENCIES = ('AUD','MYR','JPY','USD','EUR','GBP','SGD','NZD','CNY','KRW','THB','IDR')


def get_latest_rates(base_currency):
    if base_currency not in CURRENCIES:
        raise ValueError('Unsupported currency.')
    url = 'https://api.frankfurter.dev/v2/rates?base=' + base_currency + '&quotes=' + ','.join(c for c in CURRENCIES if c != base_currency)
    try:
        with urlopen(Request(url, headers={'User-Agent':'StudentHelperPortal/1.0','Accept':'application/json'}), timeout=15) as response:
            raw = response.read(100001)
        if len(raw) > 100000:
            raise ValueError('Oversized rate response')
        rows = json.loads(raw, parse_float=Decimal)
        if not isinstance(rows, list):
            raise ValueError('Invalid response')
        rates = {}
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError('Invalid rate entry')
            if row.get('base') != base_currency or row.get('quote') not in CURRENCIES:
                raise ValueError('Unexpected currency')
            rate = Decimal(str(row['rate']))
            if not rate.is_finite() or not 0 < rate < 100000000:
                raise ValueError('Invalid rate')
            rates[row['quote']] = {'rate': str(rate), 'rate_date': date.fromisoformat(row['date']).isoformat()}
        if set(rates) != set(CURRENCIES) - {base_currency}:
            raise ValueError('Incomplete rates')
        return {'base':base_currency,'rates':rates,'provider':'Frankfurter v2','fetched_at':datetime.now(timezone.utc).isoformat()}
    except (OSError, ValueError, KeyError, TypeError, InvalidOperation) as exc:
        raise ValueError('Could not update rates. Previously cached rates are unchanged. Try again when connected.') from exc
