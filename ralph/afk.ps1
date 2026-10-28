# PowerShell entry for ralph/afk.sh.
# Usage: .\ralph\afk.ps1 <iterations>
param([Parameter(Mandatory)][int]$Iterations)
& "$PSScriptRoot\git-bash.ps1" "$PSScriptRoot/afk.sh" $Iterations
exit $LASTEXITCODE
