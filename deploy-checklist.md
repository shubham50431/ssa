# Version 5 — Production Deployment Checklist

## Before going live
- [ ] Buy/connect the official domain.
- [ ] Choose a Node.js hosting provider or VPS.
- [ ] Set `NODE_ENV=production`.
- [ ] Generate a strong random `SESSION_SECRET`.
- [ ] Configure HTTPS.
- [ ] Set `COOKIE_SECURE=true` only when HTTPS is active.
- [ ] Change all demo passwords.
- [ ] Create regular database backups.
- [ ] Configure secure document storage.
- [ ] Configure a real payment gateway and verify webhooks.
- [ ] Configure email/SMS/WhatsApp provider credentials.
- [ ] Verify official university affiliations, course approvals and admission claims.
- [ ] Test admission, login, document upload, payment and receipt workflows.

## Suggested launch sequence
1. Deploy staging copy.
2. Test with dummy student data.
3. Perform security review.
4. Configure production domain and HTTPS.
5. Restore/seed production database.
6. Create real admin accounts.
7. Run a controlled pilot with a few students.
8. Launch publicly.

## Important
Do not publish demo credentials or use the demo database for real student data.
