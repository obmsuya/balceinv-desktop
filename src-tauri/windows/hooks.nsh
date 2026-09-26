!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process -Name backend -ErrorAction SilentlyContinue | Where-Object { $$_.Path -eq '$INSTDIR\backend.exe' } | Stop-Process -Force"`
  Pop $0
  Sleep 800
!macroend
