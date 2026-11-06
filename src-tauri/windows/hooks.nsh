!macro NSIS_HOOK_PREINSTALL
  nsExec::Exec `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $$_.ExecutablePath -eq '$INSTDIR\backend.exe' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force }"`
  Pop $0
  Sleep 800
!macroend
