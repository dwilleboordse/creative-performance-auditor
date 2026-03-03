# Creative Performance Auditor

Internal tool by D-DOUBLEU MEDIA.

Drop any ad account CSV export. Get instant classification of every ad: Scale, Iterate, Watch, or Kill.

## Setup

1. Deploy to Vercel (connect this repo)
2. Add environment variable: `ANTHROPIC_API_KEY`
3. Redeploy

## CSV Format

Export from Meta/TikTok/Google Ads Manager with these columns:

| Column | Required |
|--------|----------|
| Ad Name | Yes |
| Spend | Yes |
| Revenue | Yes |
| ROAS | Yes |
| CTR | Yes |
| Hook Rate | Optional |
| Hold Rate | Optional |
| CPC | Optional |
| CPM | Optional |
| Impressions | Optional |
| Purchases | Optional |
