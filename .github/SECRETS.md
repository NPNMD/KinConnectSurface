# GitHub Secrets Configuration

This document lists all required GitHub secrets for the KinConnect CI/CD pipeline.

## Required Secrets

### Firebase Deployment

#### `FIREBASE_TOKEN`
- **Description**: Firebase CI token for deployment
- **How to generate**: Run `firebase login:ci` locally and copy the token
- **Required for**: All deployment workflows
- **Scope**: Repository secret

#### `FIREBASE_PROJECT_ID`
- **Description**: Firebase project ID (e.g., kinconnect-prod)
- **Example**: `kinconnect-12345`
- **Required for**: Deployment workflows
- **Scope**: Repository secret

### Staging Environment

#### `STAGING_FIREBASE_API_KEY`
- **Description**: Firebase API key for staging environment
- **Source**: Firebase Console > Project Settings > General > Web API Key
- **Required for**: Staging deployments
- **Scope**: Environment secret (staging)

#### `STAGING_FIREBASE_AUTH_DOMAIN`
- **Description**: Firebase Auth domain for staging
- **Example**: `kinconnect-staging.firebaseapp.com`
- **Required for**: Staging deployments
- **Scope**: Environment secret (staging)

#### `STAGING_FIREBASE_STORAGE_BUCKET`
- **Description**: Firebase Storage bucket for staging
- **Example**: `kinconnect-staging.appspot.com`
- **Required for**: Staging deployments
- **Scope**: Environment secret (staging)

#### `STAGING_FIREBASE_MESSAGING_SENDER_ID`
- **Description**: Firebase Cloud Messaging sender ID for staging
- **Source**: Firebase Console > Project Settings > Cloud Messaging
- **Required for**: Staging deployments
- **Scope**: Environment secret (staging)

#### `STAGING_FIREBASE_APP_ID`
- **Description**: Firebase App ID for staging
- **Source**: Firebase Console > Project Settings > General
- **Required for**: Staging deployments
- **Scope**: Environment secret (staging)

### Production Environment

#### `PROD_FIREBASE_API_KEY`
- **Description**: Firebase API key for production environment
- **Source**: Firebase Console > Project Settings > General > Web API Key
- **Required for**: Production deployments
- **Scope**: Environment secret (production)

#### `PROD_FIREBASE_AUTH_DOMAIN`
- **Description**: Firebase Auth domain for production
- **Example**: `kinconnect.firebaseapp.com`
- **Required for**: Production deployments
- **Scope**: Environment secret (production)

#### `PROD_FIREBASE_STORAGE_BUCKET`
- **Description**: Firebase Storage bucket for production
- **Example**: `kinconnect.appspot.com`
- **Required for**: Production deployments
- **Scope**: Environment secret (production)

#### `PROD_FIREBASE_MESSAGING_SENDER_ID`
- **Description**: Firebase Cloud Messaging sender ID for production
- **Source**: Firebase Console > Project Settings > Cloud Messaging
- **Required for**: Production deployments
- **Scope**: Environment secret (production)

#### `PROD_FIREBASE_APP_ID`
- **Description**: Firebase App ID for production
- **Source**: Firebase Console > Project Settings > General
- **Required for**: Production deployments
- **Scope**: Environment secret (production)

### Automatic Secrets

#### `GITHUB_TOKEN`
- **Description**: Automatically provided by GitHub Actions
- **Required for**: Creating releases, commenting on PRs
- **Scope**: Automatically available in workflows
- **Note**: No configuration needed

## Setting Up Secrets

### Repository Secrets

1. Go to your repository on GitHub
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add each secret with its name and value

### Environment Secrets

1. Go to **Settings** > **Environments**
2. Create environments: `staging` and `production`
3. For production, enable **Required reviewers** for manual approval
4. Add environment-specific secrets to each environment

## Security Best Practices

- ✅ Never commit secrets to the repository
- ✅ Rotate secrets regularly (every 90 days recommended)
- ✅ Use environment-specific secrets for different deployment targets
- ✅ Limit access to secrets using environment protection rules
- ✅ Review secret access logs regularly
- ✅ Use GitHub's secret scanning to detect leaked secrets
- ❌ Never log secrets in workflows
- ❌ Never use secrets in pull requests from forks
- ❌ Don't share secrets between unrelated projects

## Verifying Secret Configuration

Run this command to verify secrets are properly configured (without revealing values):

```bash
gh secret list
```

Or check via GitHub UI:
1. Repository **Settings** > **Secrets and variables** > **Actions**
2. Verify all required secrets are present
3. Check environment-specific secrets in each environment

## Troubleshooting

### Deployment fails with authentication error
- Verify `FIREBASE_TOKEN` is valid (regenerate if expired)
- Check Firebase project ID matches `FIREBASE_PROJECT_ID`

### Build fails with missing environment variables
- Ensure all Firebase config secrets are set for the target environment
- Verify secret names match exactly (case-sensitive)

### Secret not available in workflow
- Check if the workflow has proper environment specified
- Verify secret scope (repository vs environment)
- Ensure workflow has necessary permissions

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Firebase CI Documentation](https://firebase.google.com/docs/cli#cli-ci-systems)
- [Environment Protection Rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
