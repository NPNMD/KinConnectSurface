# CI/CD Pipeline Documentation

This document provides comprehensive information about the KinConnect GitHub Actions CI/CD pipeline.

## Overview

The KinConnect project uses GitHub Actions for continuous integration and deployment. The pipeline consists of four main workflows:

1. **Test & Lint** ([`test.yml`](workflows/test.yml)) - Automated testing and code quality
2. **Deploy to Firebase** ([`deploy.yml`](workflows/deploy.yml)) - Automated deployment
3. **Security Audit** ([`security.yml`](workflows/security.yml)) - Security vulnerability scanning
4. **Dependabot** ([`dependabot.yml`](../dependabot.yml)) - Automated dependency updates

## Workflow Details

### 1. Test & Lint Workflow

**File**: `.github/workflows/test.yml`

**Triggers**:
- Push to `main` branch
- Pull requests to `main` branch

**Jobs**:

#### a. Run Tests & Linting
- Sets up Node.js 18.x
- Caches npm dependencies for faster builds
- Installs dependencies for root and functions
- Runs ESLint for code quality
- Executes tests with coverage reporting
- Fails if coverage is below 70%
- Uploads coverage reports to GitHub artifacts

#### b. Lint Firebase Functions
- Separately lints Firebase Functions code
- Ensures backend code quality

#### c. TypeScript Type Check
- Validates TypeScript types across the project
- Checks both root and functions directories

**Artifacts**:
- Coverage reports (retained for 30 days)

**Status Checks**:
All three jobs must pass for the workflow to succeed.

---

### 2. Deploy to Firebase Workflow

**File**: `.github/workflows/deploy.yml`

**Triggers**:
- Push to `main` branch (deploys to staging)
- Manual workflow dispatch (choose staging or production)

**Jobs**:

#### a. Run Tests First
- Reuses the test workflow
- Ensures all tests pass before deployment

#### b. Deploy to Staging
- **Runs**: Automatically on push to main
- **Environment**: `staging`
- **Steps**:
  1. Build client with staging environment variables
  2. Deploy Firestore security rules
  3. Deploy Firestore indexes
  4. Deploy Firebase Functions
  5. Deploy to Firebase Hosting
  6. Generate deployment summary

#### c. Deploy to Production
- **Runs**: Only on manual trigger with production environment selected
- **Environment**: `production` (requires manual approval)
- **Steps**: Same as staging plus:
  - Creates a release tag
  - Generates release notes

**Environment URLs**:
- Staging: https://kinconnect-staging.web.app
- Production: https://kinconnect.web.app

**Required Secrets**:
See [`SECRETS.md`](SECRETS.md) for full list.

---

### 3. Security Audit Workflow

**File**: `.github/workflows/security.yml`

**Triggers**:
- Weekly schedule (Mondays at 9:00 AM UTC)
- Changes to `package.json` or `package-lock.json`
- Pull requests affecting dependencies
- Manual workflow dispatch

**Jobs**:

#### a. NPM Security Audit
- Audits root dependencies
- Audits functions dependencies
- Checks for critical/high severity vulnerabilities
- Uploads audit report as artifact
- Creates GitHub issue if critical vulnerabilities found

#### b. Dependency Review (PR only)
- Reviews dependency changes in pull requests
- Fails on high severity vulnerabilities
- Blocks problematic licenses (GPL-3.0, AGPL-3.0)

#### c. CodeQL Security Analysis
- Performs automated code security scanning
- Detects common security vulnerabilities
- Runs security and quality queries
- Results available in Security tab

**Artifacts**:
- Security audit reports (retained for 90 days)

**Alerts**:
- Creates issues for critical vulnerabilities found in scheduled scans
- Labels: `security`, `priority-high`

---

### 4. Dependabot Configuration

**File**: `.github/dependabot.yml`

**Purpose**: Automated dependency updates

**Update Schedule**:
- Weekly updates (Mondays at 9:00 AM)
- Separate configurations for:
  - Root npm packages
  - Functions npm packages
  - GitHub Actions

**Behavior**:
- Opens pull requests for dependency updates
- Maximum 10 PRs for npm, 5 for GitHub Actions
- Auto-labels PRs with `dependencies` and context labels
- Ignores major version updates (requires manual review)
- Uses semantic commit messages

**PR Naming**:
- Root deps: `chore(deps): update dependency-name`
- Functions: `chore(deps-functions): update dependency-name`
- Actions: `chore(ci): update action-name`

---

## Workflow Diagrams

### Development Flow

```
Developer pushes to main
         ↓
    Test Workflow Runs
         ↓
  ┌─────┴─────┐
  │           │
Tests      Linting
  │           │
  └─────┬─────┘
        ↓
   All Pass?
        ↓
  Deploy Staging
```

### Production Deployment Flow

```
Manual Trigger (Production)
         ↓
    Test Workflow Runs
         ↓
    All Pass?
         ↓
   Approval Required
         ↓
  Deploy Production
         ↓
   Create Release Tag
```

### Security Workflow

```
Weekly Schedule / Dependency Change
         ↓
    NPM Audit
         ↓
  Critical Found?
    ┌────┴────┐
   Yes        No
    │          │
Create      Success
Issue
```

---

## Environment Configuration

### Staging Environment

- **Name**: `staging`
- **Protection**: None (auto-deploys)
- **URL**: https://kinconnect-staging.web.app
- **Purpose**: Testing before production

### Production Environment

- **Name**: `production`
- **Protection**: Required reviewers (manual approval)
- **URL**: https://kinconnect.web.app
- **Purpose**: Live application

### Setting Up Environments

1. Go to **Settings** > **Environments** in GitHub
2. Create `staging` environment
3. Create `production` environment
4. For production:
   - Enable "Required reviewers"
   - Add team members who can approve deployments
   - Add deployment branch rule: `main` only
5. Add environment-specific secrets to each

---

## Required Secrets

### Repository Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `FIREBASE_TOKEN` | Firebase CI token | `firebase login:ci` |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Firebase Console |

### Environment Secrets

#### Staging

- `STAGING_FIREBASE_API_KEY`
- `STAGING_FIREBASE_AUTH_DOMAIN`
- `STAGING_FIREBASE_STORAGE_BUCKET`
- `STAGING_FIREBASE_MESSAGING_SENDER_ID`
- `STAGING_FIREBASE_APP_ID`

#### Production

- `PROD_FIREBASE_API_KEY`
- `PROD_FIREBASE_AUTH_DOMAIN`
- `PROD_FIREBASE_STORAGE_BUCKET`
- `PROD_FIREBASE_MESSAGING_SENDER_ID`
- `PROD_FIREBASE_APP_ID`

See [`SECRETS.md`](SECRETS.md) for complete details.

---

## Branch Protection Rules

Recommended settings for the `main` branch:

- ✅ Require pull request reviews (1 approval)
- ✅ Require status checks to pass:
  - `test / Run Tests & Linting`
  - `test / Lint Firebase Functions`
  - `test / TypeScript Type Check`
  - `security-audit / NPM Security Audit`
- ✅ Require conversation resolution
- ✅ Require linear history
- ❌ Allow force pushes (disabled)
- ❌ Allow deletions (disabled)

See [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md) for complete details.

---

## Monitoring and Maintenance

### Viewing Workflow Runs

1. Go to the **Actions** tab in GitHub
2. Select a workflow from the left sidebar
3. View run history, logs, and artifacts

### Checking Coverage Reports

1. Go to **Actions** > Select a test workflow run
2. Scroll to **Artifacts** section
3. Download `coverage-report`
4. Open `index.html` in browser

### Reviewing Security Reports

1. Go to **Security** tab
2. Select **Code scanning alerts** for CodeQL results
3. Or download audit reports from workflow artifacts

### Weekly Maintenance

- Review Dependabot PRs
- Check security audit results
- Monitor deployment success rates
- Review failed workflows

---

## Troubleshooting

### Test Workflow Failures

#### Coverage Below Threshold
```
Error: Coverage 65% is below 70% threshold
```
**Solution**: Add more tests or adjust threshold in `test.yml`

#### Lint Errors
```
Error: ESLint found issues
```
**Solution**: Run `npm run lint -- --fix` locally and commit

#### Type Check Errors
```
Error: TypeScript compilation failed
```
**Solution**: Run `npx tsc --noEmit` locally and fix type errors

### Deployment Workflow Failures

#### Authentication Error
```
Error: Invalid Firebase token
```
**Solution**: 
1. Run `firebase login:ci` locally
2. Update `FIREBASE_TOKEN` secret
3. Re-run workflow

#### Build Error
```
Error: Missing environment variable
```
**Solution**: Verify all Firebase config secrets are set for the environment

#### Deployment Timeout
```
Error: Deployment exceeded timeout
```
**Solution**: Check Firebase Functions logs and increase timeout if needed

### Security Workflow Issues

#### False Positives
```
Multiple vulnerabilities found in dev dependencies
```
**Solution**: 
1. Review the audit report
2. Run `npm audit fix` for safe updates
3. Document accepted risks for dev dependencies

#### CodeQL Scanning Errors
```
Error: CodeQL analysis failed
```
**Solution**: Check CodeQL logs; may need to exclude certain files

### Dependabot Issues

#### PR Conflicts
```
Dependabot PR has merge conflicts
```
**Solution**: 
1. Close the PR
2. Dependabot will recreate it automatically
3. Or manually resolve conflicts

#### Too Many PRs
```
Reached open PR limit
```
**Solution**: 
1. Review and merge safe updates
2. Close outdated PRs
3. Adjust `open-pull-requests-limit` if needed

---

## Performance Optimization

### Caching Strategy

The workflows use caching to speed up builds:

```yaml
- uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      node_modules
      functions/node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Cache Key**: Based on package-lock.json hash
**Benefits**: Faster dependency installation (5-10x speedup)

### Parallel Jobs

The test workflow runs three jobs in parallel:
- Main tests and linting
- Functions linting
- TypeScript type checking

This reduces total workflow time by ~40%.

### Conditional Execution

Workflows use smart triggers to avoid unnecessary runs:
- Security audit: Only on dependency changes or weekly
- Deployment: Only after tests pass
- Type check: Skipped if no TypeScript changes

---

## Best Practices

### For Developers

1. **Before Pushing**:
   - Run tests locally: `npm test`
   - Check linting: `npm run lint`
   - Verify types: `npx tsc --noEmit`

2. **Pull Requests**:
   - Wait for all status checks to pass
   - Review coverage reports
   - Address security findings

3. **Merging**:
   - Use squash merging to keep history clean
   - Include meaningful commit messages
   - Delete feature branches after merge

### For Maintainers

1. **Weekly Tasks**:
   - Review Dependabot PRs
   - Check security audit results
   - Monitor deployment success rates

2. **Monthly Tasks**:
   - Review and update dependencies
   - Audit failed workflow runs
   - Optimize workflow performance

3. **Quarterly Tasks**:
   - Review and update branch protection rules
   - Audit secret rotation
   - Update documentation

---

## Workflow Badges

Add these badges to your README to show workflow status:

```markdown
[![Test & Lint](https://github.com/YOUR_USERNAME/kinconnect/workflows/Test%20%26%20Lint/badge.svg)](https://github.com/YOUR_USERNAME/kinconnect/actions/workflows/test.yml)
[![Deploy to Firebase](https://github.com/YOUR_USERNAME/kinconnect/workflows/Deploy%20to%20Firebase/badge.svg)](https://github.com/YOUR_USERNAME/kinconnect/actions/workflows/deploy.yml)
[![Security Audit](https://github.com/YOUR_USERNAME/kinconnect/workflows/Security%20Audit/badge.svg)](https://github.com/YOUR_USERNAME/kinconnect/actions/workflows/security.yml)
```

Replace `YOUR_USERNAME` with your GitHub username or organization name.

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase CI/CD Documentation](https://firebase.google.com/docs/cli#cli-ci-systems)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)

---

## Support

For issues with the CI/CD pipeline:

1. Check the **Actions** tab for workflow logs
2. Review this documentation
3. Check [`SECRETS.md`](SECRETS.md) for secret configuration
4. Check [`BRANCH_PROTECTION.md`](BRANCH_PROTECTION.md) for branch rules
5. Create an issue with the `ci/cd` label

---

**Last Updated**: 2026-01-05  
**Maintained by**: KinConnect DevOps Team
