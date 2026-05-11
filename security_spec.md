# Security Specification - Elite Society

## Data Invariants
1. A user cannot access member sections (Directory, Events, Chat) unless their `status` is 'approved'.
2. Users can only update their own profile fields, except for `role` and `status` (Admin only).
3. Messages can only be read/written by participants of a `ChatRoom`.
4. Events are visible only to approved members.
5. Admins have full read/write access to all collections (for moderation).

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a profile for another `userId`.
2. **Privilege Escalation**: Approved user attempting to change their `role` to 'admin'.
3. **Self-Approval**: Pending user attempting to change their own `status` to 'approved'.
4. **Member Gate Bypass**: User with status 'pending' trying to read `/events`.
5. **Unauthorized Message Reading**: User A trying to read messages in a room where they are not a participant.
6. **Ghost Field Injection**: Adding `isVerified: true` to a profile update.
7. **Document ID Poisoning**: Creating an event with a 10KB junk string as ID.
8. **Relational Sync Break**: Creating an attendee record for an event that doesn't exist.
9. **Orphaned Writes**: Creating a message in a room that hasn't been created yet.
10. **Admin Impersonation**: Attempting to delete someone else's profile without being an admin.
11. **Referral Bypass**: Trying to mark an invite as `usedBy` someone else's ID.
12. **Content Exhaustion**: Sending a message with a 2MB text body.

## Red Team Checklist
- [ ] Root deny-all present.
- [ ] `isValidUserProfile` enforces strict keys and types.
- [ ] `isValidEvent` enforces strict keys and types.
- [ ] `isValidId` applied to all document ID path variables.
- [ ] `hasOnly` used in all `update` branches.
- [ ] `get()` lookups used to verify membership before sub-resource access.
- [ ] No blanket `isSignedIn()` reads for sensitive data.
- [ ] PII isolated (or strictly guarded).
