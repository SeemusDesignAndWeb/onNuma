# Event Signup Security Audit

## Date: 2024
## Component: Public Event Signup (`/event/[token]`)

### ✅ Security Measures Currently Implemented

1. **CSRF Protection**
   - ✅ CSRF token validation using `verifyCsrfToken()`
   - ✅ Token included in form and validated on submission
   - Status: **SECURE**

2. **Token Validation**
   - ✅ Validates event/occurrence token exists before allowing signup
   - ✅ Verifies token belongs to valid event
   - Status: **SECURE**

3. **Input Validation**
   - ✅ Email validation using `isValidEmail()`
   - ✅ Required field validation (name, email, occurrenceId)
   - ✅ Occurrence validation (checks occurrence belongs to event)
   - Status: **PARTIALLY SECURE** (see issues below)

4. **Business Logic Protection**
   - ✅ Duplicate signup prevention (same email for same occurrence)
   - ✅ Capacity validation (prevents overbooking)
   - ✅ Occurrence must belong to the event
   - Status: **SECURE**

5. **Data Storage**
   - ✅ Using fileStore (no SQL injection risk)
   - ✅ Email normalized (trimmed and lowercased)
   - ✅ Name trimmed
   - Status: **SECURE**

### ⚠️ Security Issues Found

1. **Missing Rate Limiting**
   - **Risk**: HIGH - Vulnerable to spam/abuse attacks
   - **Impact**: Could fill up events with fake signups, exhaust email quota
   - **Current State**: No rate limiting implemented
   - **Recommendation**: Implement IP-based rate limiting (similar to contact form)

2. **No Name Length Validation**
   - **Risk**: MEDIUM - Could store extremely long names
   - **Impact**: Database bloat, potential display issues, DoS
   - **Current State**: No maximum length check
   - **Recommendation**: Add max length validation (e.g., 200 characters)

3. **No Guest Count Bounds Checking**
   - **Risk**: MEDIUM - Could accept negative or extremely large numbers
   - **Impact**: Data integrity issues, potential overflow
   - **Current State**: Only uses `parseInt()` with no bounds
   - **Recommendation**: Validate guestCount is between 0 and reasonable max (e.g., 50)

4. **No Input Sanitization for Name**
   - **Risk**: MEDIUM - XSS if name is displayed without sanitization
   - **Impact**: Cross-site scripting attacks
   - **Current State**: Name stored as-is (only trimmed)
   - **Recommendation**: Sanitize name field or use HTML escaping when displaying

5. **No Spam Detection**
   - **Risk**: MEDIUM - Vulnerable to automated spam signups
   - **Impact**: Fake signups, email spam
   - **Current State**: No spam detection
   - **Recommendation**: Add basic spam detection (similar to contact form)

6. **No Minimum Form Time Check**
   - **Risk**: LOW - Could indicate bot submissions
   - **Impact**: Automated spam submissions
   - **Current State**: No timing validation
   - **Recommendation**: Add minimum form completion time (e.g., 2-3 seconds)

7. **No IP-based Abuse Tracking**
   - **Risk**: MEDIUM - Can't track repeat offenders
   - **Impact**: Difficult to identify and block abusive users
   - **Current State**: No IP tracking
   - **Recommendation**: Log IP addresses for abuse tracking (with privacy considerations)

### 🔒 Recommended Security Enhancements

#### Priority 1 (High Priority)
1. **Add Rate Limiting**
   - Limit signups per IP address (e.g., 5 per hour)
   - Prevent rapid-fire submissions

2. **Add Name Length Validation**
   - Maximum 200 characters
   - Prevent DoS through extremely long inputs

3. **Add Guest Count Bounds**
   - Minimum: 0
   - Maximum: 50 (or configurable)
   - Validate before processing

#### Priority 2 (Medium Priority)
4. **Add Input Sanitization**
   - Sanitize name field before storage
   - Or ensure proper HTML escaping when displaying

5. **Add Basic Spam Detection**
   - Check for suspicious patterns in name/email
   - Similar to contact form spam detection

#### Priority 3 (Low Priority)
6. **Add Form Timing Validation**
   - Require minimum time between page load and submission
   - Helps detect automated bots

7. **Add IP Logging (Privacy-Conscious)**
   - Log IP addresses for abuse tracking
   - Consider GDPR/privacy implications
   - Auto-block after X violations

### 📋 Implementation Checklist

- [ ] Add rate limiting middleware
- [ ] Add name length validation (max 200 chars)
- [ ] Add guest count bounds (0-50)
- [ ] Add name sanitization or HTML escaping
- [ ] Add spam detection
- [ ] Add form timing validation
- [ ] Add IP logging (with privacy notice)
- [ ] Test all security measures
- [ ] Update documentation

### 🔍 Additional Security Considerations

1. **Token Security**
   - ✅ Tokens are long and random (good)
   - ⚠️ Consider token expiration dates
   - ⚠️ Consider rate limiting token generation

2. **Email Security**
   - ✅ Email is validated
   - ⚠️ Consider email verification before confirming signup
   - ⚠️ Consider CAPTCHA for high-risk events

3. **Data Privacy**
   - ⚠️ Ensure GDPR compliance for storing personal data
   - ⚠️ Consider data retention policies
   - ⚠️ Add privacy notice on signup form

4. **Monitoring & Logging**
   - ⚠️ Add logging for failed signup attempts
   - ⚠️ Monitor for suspicious patterns
   - ⚠️ Alert on rate limit violations

