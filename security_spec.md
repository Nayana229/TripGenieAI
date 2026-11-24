# TripGenie AI — Security Specification

## 1. Data Invariants

1. **Private User Profile Isolation**: A document at `/users/{userId}` can only be read, created, or updated by the verified authenticated user whose `request.auth.uid == userId`. No user can list `/users`.
2. **Trip Ownership Integrity**: Every `/trips/{tripId}` document must carry `userId == request.auth.uid`, an immutable `userId` and `createdAt`, server-verified timestamps (`request.time`), and strict key/type/size bounds matching `firebase-blueprint.json`.
3. **Master Gate on Chat Messages**: Every `/trips/{tripId}/messages/{messageId}` document requires verifying via `get()` that the parent `/trips/{tripId}` exists and `parent.data.userId == request.auth.uid`.
4. **No Shadow Fields or Unbounded Arrays**: All writes reject unknown fields via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update. Arrays (`preferences`, `itinerary.days`) are strictly size-bounded.
5. **Verified Identity**: Write operations require `request.auth != null && request.auth.token.email_verified == true`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)

1. Unauthenticated read or write on `/trips/trip_1`.
2. Unverified email user attempting to create `/trips/trip_1`.
3. Spoofed `userId` (`userId: "victim-uid"`) when authenticated as `"attacker-uid"`.
4. Shadow field injection (`isAdmin: true` or `extraField: "x"`) on `/users/{uid}` or `/trips/{tripId}`.
5. Mutating immutable `userId` or `createdAt` during a `/trips/{tripId}` update.
6. Client-forged timestamp (`createdAt: "2020-01-01T00:00:00Z"`) instead of `request.time`.
7. Malformed document ID (`tripId: "../../etc/passwd"` or 1.5KB string) failing `isValidId()`.
8. Blanket `list` query on `/trips` without filtering `where("userId", "==", uid)`.
9. Reading another user's `/users/{otherUid}` document (PII email isolation violation).
10. Writing a message to `/trips/{otherUsersTripId}/messages/{msgId}` (Master Gate violation).
11. Passing `travellers: 999` or `totalBudget: -100` out of numeric range.
12. Passing > 12 items in `preferences` array or > 14 items in `itinerary.days` array.
