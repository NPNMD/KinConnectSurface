# Family Invitation Access Level System - Technical Design Document

## Executive Summary

This document provides a comprehensive technical design for implementing differentiated access levels in the family invitation system. The current system has a solid foundation with race condition fixes and multi-patient support, but lacks access level differentiation - all invitations receive the same hardcoded "limited" permissions.

**Goal:** Add two distinct access levels (Full Access and View Only) with proper permission enforcement across the entire application.

---

## 1. Current System Analysis

### Strengths
- ✅ Race condition fixes with sessionStorage backup
- ✅ Multi-patient support for family members
- ✅ Dual-storage pattern (users + family_calendar_access)
- ✅ Comprehensive invitation flow with email notifications
- ✅ FamilyContext with role detection and permission helpers

### Gaps
- ❌ No access level differentiation in invitation creation
- ❌ Hardcoded "limited" permissions for all invitations
- ❌ No UI for patients to manage family member access levels
- ❌ Inconsistent permission enforcement across features
- ❌ No view-only mode indicators for family members

---

## 2. Access Level System Design

### 2.1 Access Level Definitions

#### **Full Access (Level 9)**
Complete control equivalent to patient's own access.

**Permissions:**
```typescript
{
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canClaimResponsibility: true,
  canManageFamily: true,              // Can invite others
  canViewMedicalDetails: true,
  canReceiveNotifications: true
}
accessLevel: 'full'
```

**Capabilities:**
- View all dashboard data
- Create/edit/delete medications
- Manage calendar events
- Invite other family members
- Claim transportation responsibilities
- Access all medical details

#### **View Only Access**
Read-only access to dashboard, medications, and calendar.

**Permissions:**
```typescript
{
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canClaimResponsibility: false,
  canManageFamily: false,             // Cannot invite others
  canViewMedicalDetails: true,
  canReceiveNotifications: true
}
accessLevel: 'limited'
```

**Capabilities:**
- View dashboard (read-only)
- View medications (cannot modify)
- View calendar events (cannot create/modify)
- Cannot invite other family members
- Cannot claim responsibilities

### 2.2 Permission Mapping Matrix

| Feature | Full Access | View Only |
|---------|-------------|-----------|
| View patient data | ✅ | ✅ |
| Add/Edit medications | ✅ | ❌ |
| Create/Edit calendar events | ✅ | ❌ |
| Invite family members | ✅ | ❌ |
| Claim responsibilities | ✅ | ❌ |
| View providers/facilities | ✅ | ✅ |
| Add/Edit providers | ✅ | ❌ |

---

## 3. Database Schema Updates

### 3.1 No Breaking Changes Required

The existing `family_calendar_access` schema already supports the required fields. Only the invitation creation logic needs updating.

### 3.2 Permission Derivation Function

```typescript
function derivePermissionsFromAccessLevel(
  accessLevel: 'full' | 'limited' | 'emergency_only'
): FamilyCalendarAccess['permissions'] {
  
  switch (accessLevel) {
    case 'full':
      return {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canClaimResponsibility: true,
        canManageFamily: true,
        canViewMedicalDetails: true,
        canReceiveNotifications: true
      };
      
    case 'limited':
      return {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canClaimResponsibility: false,
        canManageFamily: false,
        canViewMedicalDetails: true,
        canReceiveNotifications: true
      };
      
    default:
      return {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canClaimResponsibility: false,
        canManageFamily: false,
        canViewMedicalDetails: false,
        canReceiveNotifications: false
      };
  }
}
```

---

## 4. API Endpoint Changes

### 4.1 Invitation Creation Endpoint

**Endpoint:** `POST /invitations/send`

**Updated Request:**
```typescript
{
  email: string;
  patientName: string;
  message?: string;
  accessLevel: 'full' | 'limited';  // NEW: Required field
}
```

**Implementation:**
```typescript
app.post('/invitations/send', authenticate, async (req, res) => {
  const {
    email,
    patientName,
    message,
    accessLevel = 'limited',  // Default to limited
  } = req.body;
  
  // Validate accessLevel
  if (!['full', 'limited'].includes(accessLevel)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid access level'
    });
  }
  
  // Derive permissions from access level
  const permissions = derivePermissionsFromAccessLevel(accessLevel);
  
  // Create family access record with derived permissions
  const familyAccessData = {
    patientId: senderUserId,
    permissions,
    accessLevel,
    // ... rest of fields
  };
  
  // ... rest of logic
});
```

### 4.2 Update Access Level Endpoint

**NEW Endpoint:** `PATCH /family-access/:accessId/access-level`

```typescript
app.patch('/family-access/:accessId/access-level', authenticate, async (req, res) => {
  const { accessId } = req.params;
  const { accessLevel } = req.body;
  const userId = (req as any).user.uid;
  
  // Get access record
  const accessDoc = await firestore
    .collection('family_calendar_access')
    .doc(accessId)
    .get();
    
  const accessData = accessDoc.data();
  
  // Verify user is the patient
  if (accessData.patientId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Only the patient can modify access levels'
    });
  }
  
  // Derive new permissions
  const newPermissions = derivePermissionsFromAccessLevel(accessLevel);
  
  // Update record
  await accessDoc.ref.update({
    accessLevel,
    permissions: newPermissions,
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  res.json({ success: true });
});
```

### 4.3 Permission Validation Middleware

```typescript
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user.uid;
    const patientId = req.params.patientId || req.body.patientId;
    
    // Patient always has full access
    if (userId === patientId) {
      return next();
    }
    
    // Check family access
    const familyAccess = await firestore
      .collection('family_calendar_access')
      .where('familyMemberId', '==', userId)
      .where('patientId', '==', patientId)
      .where('status', '==', 'active')
      .get();
      
    if (familyAccess.empty) {
      return res.status(403).json({
        success: false,
        error: 'No access to this patient'
      });
    }
    
    const access = familyAccess.docs[0].data();
    
    if (!access.permissions[permission]) {
      return res.status(403).json({
        success: false,
        error: `Permission denied: ${permission} required`,
        accessLevel: access.accessLevel
      });
    }
    
    next();
  };
}
```

---

## 5. UI Component Design

### 5.1 Access Level Selector Component

```typescript
interface AccessLevelSelectorProps {
  value: 'full' | 'limited';
  onChange: (level: 'full' | 'limited') => void;
}

export function AccessLevelSelector({ value, onChange }: AccessLevelSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Access Level
      </label>
      
      {/* Full Access Option */}
      <div
        className={`border-2 rounded-lg p-4 cursor-pointer ${
          value === 'full' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        }`}
        onClick={() => onChange('full')}
      >
        <div className="flex items-start">
          <input
            type="radio"
            checked={value === 'full'}
            onChange={() => onChange('full')}
            className="mt-1"
          />
          <div className="ml-3">
            <div className="font-semibold">Full Access (Level 9)</div>
            <p className="text-sm text-gray-600 mt-1">
              Complete control of medications, calendar, and can invite others
            </p>
          </div>
        </div>
      </div>
      
      {/* View Only Option */}
      <div
        className={`border-2 rounded-lg p-4 cursor-pointer ${
          value === 'limited' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
        }`}
        onClick={() => onChange('limited')}
      >
        <div className="flex items-start">
          <input
            type="radio"
            checked={value === 'limited'}
            onChange={() => onChange('limited')}
            className="mt-1"
          />
          <div className="ml-3">
            <div className="font-semibold">View Only</div>
            <p className="text-sm text-gray-600 mt-1">
              Can view dashboard, medications, and calendar but cannot make changes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 Patient Family Management Page

```typescript
export function PatientFamilyManagement() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  
  const handleAccessLevelChange = async (memberId: string, newLevel: string) => {
    await apiClient.patch(`/family-access/${memberId}/access-level`, {
      accessLevel: newLevel
    });
    await fetchFamilyMembers();
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Family Members</h1>
      
      {familyMembers.map(member => (
        <div key={member.id} className="bg-white border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{member.familyMemberName}</h3>
              <p className="text-sm text-gray-600">{member.familyMemberEmail}</p>
            </div>
            
            {member.status === 'active' && (
              <select
                value={member.accessLevel}
                onChange={(e) => handleAccessLevelChange(member.id, e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="full">Full Access</option>
                <option value="limited">View Only</option>
              </select>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 5.3 Permission Gate Component

```typescript
interface PermissionGateProps {
  permission: keyof FamilyCalendarAccess['permissions'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ permission, children, fallback }: PermissionGateProps) {
  const { hasPermission } = useFamily();
  
  if (!hasPermission(permission)) {
    return fallback || null;
  }
  
  return <>{children}</>;
}

// Usage:
<PermissionGate permission="canCreate">
  <button onClick={handleAdd}>Add Medication</button>
</PermissionGate>
```

### 5.4 View-Only Banner

```typescript
export function ViewOnlyBanner() {
  const { activePatientAccess, userRole } = useFamily();
  
  if (userRole !== 'family_member' || activePatientAccess?.accessLevel !== 'limited') {
    return null;
  }
  
  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
      <div className="flex items-center">
        <Eye className="w-5 h-5 text-blue-400 mr-3" />
        <div>
          <p className="text-sm font-medium text-blue-800">View-Only Access</p>
          <p className="text-xs text-blue-600 mt-1">
            You can view information but cannot make changes
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Permission Enforcement Strategy

### 6.1 Client-Side Enforcement

**FamilyContext Enhancement:**
```typescript
const canEditPatientData = (): boolean => {
  return hasPermission('canEdit') || hasPermission('canCreate') || hasPermission('canDelete');
};

const canManageFamilyMembers = (): boolean => {
  return hasPermission('canManageFamily');
};
```

**UI Patterns:**
1. Conditional rendering for edit buttons
2. Disabled state for restricted actions
3. Permission gate components
4. View-only indicators

### 6.2 Server-Side Enforcement

**Every mutation endpoint must validate permissions:**
```typescript
app.post('/medications', authenticate, async (req, res) => {
  const userId = (req as any).user.uid;
  const { patientId } = req.body;
  
  // Patient check
  if (userId === patientId) {
    // Proceed
    return;
  }
  
  // Family access check
  const access = await getFamilyAccess(userId, patientId);
  
  if (!access?.permissions.canCreate) {
    return res.status(403).json({
      success: false,
      error: 'Permission denied: canCreate required',
      accessLevel: access?.accessLevel
    });
  }
  
  // Proceed with operation
});
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Add access level selection to invitation flow

**Tasks:**
1. Create `derivePermissionsFromAccessLevel()` utility
2. Update `/invitations/send` endpoint
3. Create `AccessLevelSelector` component
4. Update invitation form
5. Test invitation creation

**Deliverables:**
- Working access level selector
- Backend stores selected access level
- Permissions derived correctly

### Phase 2: Patient Management UI (Week 2)
**Goal:** Enable patients to manage family member access

**Tasks:**
1. Create `PatientFamilyManagement` page
2. Implement access level change endpoint
3. Add remove family member functionality
4. Add audit logging

**Deliverables:**
- Patient can view family members
- Patient can change access levels
- Patient can remove members
- Changes are logged

### Phase 3: Permission Enforcement (Week 3)
**Goal:** Enforce permissions across all features

**Tasks:**
1. Create `PermissionGate` component
2. Create `ViewOnlyBanner` component
3. Update Dashboard with permission gates
4. Update Medications page
5. Update Calendar page
6. Add server-side validation

**Deliverables:**
- View-only UI for limited access
- Server rejects unauthorized operations
- Clear error messages

### Phase 4: Polish & Edge Cases (Week 4)
**Goal:** Handle edge cases and improve UX

**Tasks:**
1. Add real-time permission updates
2. Handle mid-session access changes
3. Add access level indicators
4. Improve error messages
5. Comprehensive testing
6. Documentation

**Deliverables:**
- Smooth UX for all scenarios
- Complete test coverage
- User documentation

---

## 8. Migration Strategy

### 8.1 Existing Data
- All existing records have `accessLevel: 'limited'`
- No database migration needed
- Existing family members keep current access
- Patients can update via new UI

### 8.2 Rollout Strategy
1. **Backend Deployment:** Deploy updated endpoints
2. **UI Deployment:** Deploy access level selector
3. **Permission Enforcement:** Enable validation
4. **Full Rollout:** Enable for all users

### 8.3 Rollback Plan
- Disable access level selector
- Disable permission enforcement
- Revert to previous behavior
- No data loss

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Permission derivation function
- Permission helper methods
- Component rendering

### 9.2 Integration Tests
- Invitation with full access
- Invitation with view-only access
- Access level changes
- Permission validation

### 9.3 E2E Tests
- Full access flow (can edit)
- View-only flow (cannot edit)
- Access level change flow
- Patient management flow

### 9.4 Test Scenarios
1. Patient invites with full access → Family member can edit
2. Patient invites with view-only → Family member cannot edit
3. Patient changes access level → Permissions update
4. Patient removes member → Access revoked

---

## 10. Security Considerations

### 10.1 Defense in Depth
1. Client-side: Hide UI elements (UX only)
2. API: Validate permissions (primary security)
3. Database: Security rules (defense in depth)
4. Audit: Log all access attempts

### 10.2 Audit Trail
Log all permission-based actions:
- Permission checks
- Access level changes
- Permission denials
- Unauthorized attempts

---

## 11. API Reference

### POST /invitations/send
```json
{
  "email": "family@example.com",
  "patientName": "John Doe",
  "accessLevel": "full" | "limited"
}
```

### PATCH /family-access/:accessId/access-level
```json
{
  "accessLevel": "full" | "limited"
}
```

### GET /family-access/patient/:patientId
Returns list of family members with access levels

---

## Summary

This design provides a complete blueprint for implementing differentiated access levels:

✅ **Preserves existing functionality** - No breaking changes
✅ **Adds two clear access levels** - Full Access and View Only
✅ **Enforces permissions consistently** - Client and server validation
✅ **Provides patient control** - UI for managing access
✅ **Maintains security** - Defense in depth with audit logging
✅ **Enables gradual rollout** - Phased implementation

Implementation: 4 phases over 4 weeks, each delivering incremental value while maintaining system stability.