; Extra installer steps for Flightroom.
;
; Flightroom used to be GearCheck, an Electron app. GearCheck's own updater
; downloads this installer and runs it with "--updated /S" (plus "--force-run"
; when you pressed Restart). After Flightroom is installed, the old GearCheck
; program is removed so there is one app, one shortcut. Its data folder
; (%APPDATA%\GearCheck) is kept: Flightroom copies your gear, groups, settings
; and culling folders from it the first time it starts.

!macro NSIS_HOOK_POSTINSTALL
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\gearcheck\Uninstall GearCheck.exe"
  ${AndIf} "$INSTDIR" != "$LOCALAPPDATA\Programs\gearcheck"
    ; _?= makes the uninstaller run in place, so ExecWait really waits for it.
    nsExec::Exec 'taskkill /F /IM "GearCheck.exe"'
    Pop $0
    Sleep 1000
    ExecWait '"$LOCALAPPDATA\Programs\gearcheck\Uninstall GearCheck.exe" /S /currentuser _?=$LOCALAPPDATA\Programs\gearcheck' $0
    RMDir /r "$LOCALAPPDATA\Programs\gearcheck"
    Delete "$DESKTOP\GearCheck.lnk"
    Delete "$SMPROGRAMS\GearCheck.lnk"
  ${EndIf}
  ; GearCheck's "Restart" button asks for the app to be opened after installing.
  ${GetOptions} $CMDLINE "--force-run" $R0
  ${IfNot} ${Errors}
    nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" ""
  ${EndIf}
!macroend
