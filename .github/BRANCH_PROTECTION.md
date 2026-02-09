# Branch Protection Rules

This document outlines the recommended branch protection rules for the Q Manager repository.

## Recommended Settings for `main` Branch

To ensure code quality and prevent accidental pushes to the main branch, configure the following settings in GitHub:

### Navigation
Go to: **Settings** → **Branches** → **Add branch protection rule**

### Rule Configuration

#### Branch name pattern
```
main
```

#### Protection Rules

**1. Require a pull request before merging**
- ✅ Enable
- Required approvals: **1**
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require review from Code Owners (optional, if CODEOWNERS file exists)

**2. Require status checks to pass before merging**
- ✅ Enable
- ✅ Require branches to be up to date before merging
- Required status checks (add these):
  - `Test Frontend`
  - `Check Rust Code (ubuntu-latest)`
  - `Check Rust Code (windows-latest)`
  - `Lint`

**3. Require conversation resolution before merging**
- ✅ Enable
- Ensures all PR comments are resolved before merge

**4. Require signed commits** (optional but recommended)
- ⚠️ Optional - Enable if you want to enforce GPG signed commits

**5. Require linear history**
- ✅ Enable
- Prevents merge commits, enforces rebase or squash

**6. Include administrators**
- ⚠️ Optional - Apply rules to administrators too

**7. Restrict who can push to matching branches**
- ⚠️ Optional - Restrict push access to specific users/teams

**8. Allow force pushes**
- ❌ Disable (not recommended for main branch)

**9. Allow deletions**
- ❌ Disable (not recommended for main branch)

---

## Setting Up Branch Protection (Step-by-Step)

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Branches** in the left sidebar
4. Click **Add branch protection rule**
5. Set **Branch name pattern** to `main`
6. Configure the checkboxes as outlined above
7. Click **Create** or **Save changes**

---

## Additional Recommendations

### For `develop` Branch (if using Gitflow)

If you adopt a Gitflow workflow with a `develop` branch:

- Apply similar rules but with slightly relaxed requirements
- Allow administrators to bypass PR requirements
- Require at least 1 approval for PRs to `develop`

### CODEOWNERS File

Create a `.github/CODEOWNERS` file to automatically request reviews from specific people:

```
# Default owner for everything
* @QMahyar

# Rust backend
/src-tauri/ @QMahyar

# Frontend
/src/ @QMahyar

# CI/CD workflows
/.github/ @QMahyar

# Documentation
*.md @QMahyar
```

### Status Checks

Ensure all CI workflows are passing before enabling status check requirements:

1. Push a commit to a feature branch
2. Verify all GitHub Actions workflows run successfully
3. Then enable the status check requirements

---

## Benefits

✅ **Prevents accidental commits** - No direct pushes to `main`  
✅ **Ensures code review** - All changes go through PRs  
✅ **Maintains quality** - CI checks must pass  
✅ **Clean history** - Linear commit history with no merge commits  
✅ **Collaboration** - Forces discussion on all code changes  

---

## Testing Branch Protection

After setting up:

1. Try to push directly to `main`:
   ```bash
   git checkout main
   git commit --allow-empty -m "test"
   git push
   ```
   **Expected:** Push should be rejected ✅

2. Create a PR and verify:
   - Status checks run automatically
   - Merge button is disabled until checks pass
   - At least 1 approval is required

---

## Maintenance

Review and update branch protection rules:
- **Quarterly** - Review and adjust as team grows
- **After CI changes** - Update required status checks
- **When adding collaborators** - Adjust review requirements

---

For more information, see [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
