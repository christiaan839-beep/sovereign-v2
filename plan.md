1. **Fix Smoke Tests (Publishable Key Validation):**
   - The CI logs show: `Error: Publishable key not valid.` during the `npm start` step in `.github/workflows/ci.yml`.
   - The memory states: `When providing mock values for NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in tests or CI, use a valid base64-encoded suffix (e.g., pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk). Arbitrary dummy strings like pk_test_smoke_dummy will cause the Next.js server startup to fail with a 'Publishable key not valid' error.`
   - Fix: Replace `pk_test_smoke_dummy` with `pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk` in `.github/workflows/ci.yml` using `replace_with_git_merge_diff`.

2. **Verify changes:**
   - Use `grep pk_test_ .github/workflows/ci.yml` to verify the replacement.

3. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
   - Run the pre-commit script to run all final verifications.

4. **Submit PR:**
   - Submit the changes using the exact title `🎨 Palette: [UX improvement]`.
