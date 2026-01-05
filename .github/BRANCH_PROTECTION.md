# Branch Protection Rules

This document outlines the recommended branch protection rules for the KinConnect repository to ensure code quality and prevent accidental changes to production code.

## Main Branch Protection

### Settings for `main` Branch

#### Required Settings

1. **Require pull request reviews before merging**
   - ✅ Required number of approvals: **1**
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require review from Code Owners (if CODEOWNERS file exists)
   - ⚠️ Restrict who can dismiss pull request reviews

2. **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - **Required status checks:**
     - `test / Run Tests & Linting`
     - `test / Lint Firebase Functions`
     - `test / TypeScript Type Check`
     - `security-audit / NPM Security Audit`
     - `codeql-analysis / CodeQL Security Analysis`

3. **Require conversation resolution before merging**
   - ✅ All conversations must be resolved before merging

4. **Require signed commits**
   - ⚠️ Optional but recommended for enhanced security
   - Requires developers to sign commits with GPG keys

5. **Require linear history**
   - ✅ Prevent merge commits (enforce squash or rebase merging)
   - Keeps commit history clean and linear

6. **Include administrators**
   - ✅ Apply rules to administrators too
   - Ensures consistent process for all team members

7. **Restrict pushes**
   - ✅ Restrict who can push to matching branches
   - ⚠️ Only designated release managers should have direct push access

8. **Allow force pushes**
   - ❌ **DISABLED** - Prevent force pushes and deletions
   - Protects against accidental history rewrites

9. **Allow deletions**
   - ❌ **DISABLED** - Prevent branch deletion
   - Ensures main branch cannot be deleted accidentally

## Additional Branch Patterns

### Development Branch (`develop`)

If using a Git Flow or similar branching strategy:

1. **Require pull request reviews**: 1 approval
2. **Require status checks**: Same as main
3. **Allow force pushes**: ❌ Disabled
4. **Allow deletions**: ❌ Disabled

### Release Branches (`release/*`)

1. **Require pull request reviews**: 2 approvals
2. **Require status checks**: All checks must pass
3. **Restrict who can push**: Release managers only
4. **Allow force pushes**: ❌ Disabled
5. **Allow deletions**: ✅ Enabled (after merge)

### Feature Branches (`feature/*`, `fix/*`, `chore/*`)

- No protection rules needed
- These are temporary branches that will be deleted after merging
- Developers have full control over their feature branches

## Configuring Branch Protection Rules

### Via GitHub UI

1. Go to **Settings** > **Branches** in your repository
2. Click **Add rule** under "Branch protection rules"
3. Enter branch name pattern (e.g., `main`)
4. Configure settings as outlined above
5. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
# Protect main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{
    "strict": true,
    "contexts": [
      "test / Run Tests & Linting",
      "test / Lint Firebase Functions",
      "test / TypeScript Type Check",
      "security-audit / NPM Security Audit"
    ]
  }' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  }' \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

## Rulesets (Modern Alternative)

GitHub now offers Repository Rulesets as a more flexible alternative to branch protection rules:

### Creating a Ruleset

1. Go to **Settings** > **Rules** > **Rulesets**
2. Click **New ruleset** > **New branch ruleset**
3. Configure:
   - **Name**: `main-protection`
   - **Enforcement status**: Active
   - **Target branches**: Include `main`
   
### Recommended Rules for Main Branch

- ✅ Restrict deletions
- ✅ Require linear history
- ✅ Require deployments to succeed
- ✅ Require status checks to pass
  - All CI/CD workflows must pass
- ✅ Require pull request before merging
  - Required approvals: 1
  - Dismiss stale reviews
  - Require approval of most recent reviewable push
- ✅ Block force pushes

## Bypass Permissions

Define who can bypass protection rules (use sparingly):

### Recommended Bypass Permissions
- **Repository administrators**: Only in emergency situations
- **GitHub Apps**: Dependabot for automated updates
- **Service accounts**: CI/CD automation (if needed)

### Audit Bypass Actions
- Regularly review bypass actions in repository audit log
- Enable alerts for bypass events
- Document all bypass actions with justification

## Code Owners (Optional)

Create a `.github/CODEOWNERS` file to automatically request reviews:

```
# Global owners
* @kinconnect-team

# Frontend code
/client/** @frontend-team

# Backend/Functions
/functions/** @backend-team
/shared/** @backend-team

# Infrastructure
/.github/** @devops-team
/firestore.rules @backend-team @security-team
/firestore.indexes.json @backend-team

# Documentation
*.md @tech-writers
```

## Status Check Timeout

Configure timeout for status checks:
- **Default**: 60 minutes
- **Recommended**: 30 minutes for CI/CD workflows
- **Reason**: Prevents stuck workflows from blocking merges

## Required Workflows

Configure required workflows that must run:
1. `test.yml` - Always required
2. `security.yml` - Required for dependency changes
3. `deploy.yml` - Not required (runs after merge)

## Merge Methods

Allowed merge methods for pull requests:

### Recommended Configuration
- ✅ **Allow squash merging** (Recommended default)
  - Keeps commit history clean
  - Single commit per feature/fix
- ⚠️ **Allow merge commits** (Optional)
  - Preserves full branch history
  - Use for complex features
- ❌ **Allow rebase merging** (Disabled)
  - Can cause confusion with commit history
  - Better to use squash for most cases

### Default Merge Message
- **Squash**: Pull request title and description
- **Merge commit**: Pull request title

## Monitoring and Enforcement

### Regular Reviews
- Review protection rules quarterly
- Update required status checks as workflows change
- Audit bypass permissions and usage

### Metrics to Track
- Number of bypassed protections
- PR approval times
- Failed status checks before merge attempts
- Time to merge (from PR creation)

### Alerts
Set up notifications for:
- Branch protection rule changes
- Bypass events
- Failed required status checks
- Unprotected branches created

## Troubleshooting

### Common Issues

#### Pull request can't be merged
- **Check**: All required status checks passed?
- **Check**: Required approvals received?
- **Check**: All conversations resolved?
- **Check**: Branch up to date with base branch?

#### Status check not appearing
- **Solution**: Workflow must run at least once
- **Solution**: Check workflow name matches exactly
- **Solution**: Ensure workflow triggers on pull_request event

#### Administrator can't push
- **Expected**: If "Include administrators" is enabled
- **Solution**: Follow same PR process or temporarily disable rule
- **Best Practice**: Administrators should follow same process

## Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Repository Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [CODEOWNERS File](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [Required Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
