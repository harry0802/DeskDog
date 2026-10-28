# Run a Ralph script with Git Bash. Plain `bash` in PowerShell can resolve to
# WSL's bash, which has no /c/... paths or cygpath, so find Git's own bash.
$gitRoot = Split-Path (Split-Path (Split-Path (git --exec-path)))
$bash = Join-Path $gitRoot "bin\bash.exe"
if (-not (Test-Path $bash)) { $bash = "C:\Program Files\Git\bin\bash.exe" }
if (-not (Test-Path $bash)) {
  Write-Error "Git Bash not found. Install Git for Windows, or run the .sh script from Git Bash."
  exit 1
}

& $bash @args
exit $LASTEXITCODE
