param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\..\backend\cmd\server\rsrc_windows_amd64.syso')
)
$ErrorActionPreference = 'Stop'

$tauriConfig = Get-Content (Join-Path $PSScriptRoot '..\tauri.conf.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$versionText = $tauriConfig.version
$versionNumbers = (@($versionText.Split('.')) + @('0', '0', '0'))[0..3] -join ','
$iconPath = (Resolve-Path (Join-Path $PSScriptRoot '..\icons\icon.ico')).Path.Replace('\', '\\')

$resourceCompilerPath = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\rc.exe" |
    Sort-Object FullName | Select-Object -Last 1 -ExpandProperty FullName
if (-not $resourceCompilerPath) { throw 'rc.exe not found: install the Windows 10/11 SDK.' }

$workDirectory = Join-Path ([IO.Path]::GetTempPath()) "balce-backend-resources-$PID"
New-Item -ItemType Directory -Force $workDirectory | Out-Null
$utf8WithoutBom = New-Object Text.UTF8Encoding $false

$manifestText = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity type="win32" name="Faltasi.BalceInventory.Backend" version="1.0.0.0" processorArchitecture="amd64"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>
'@
[IO.File]::WriteAllText((Join-Path $workDirectory 'backend.manifest'), $manifestText, $utf8WithoutBom)

$resourceScriptText = @"
#pragma code_page(65001)
1 ICON "$iconPath"
1 24 "backend.manifest"
1 VERSIONINFO
FILEVERSION $versionNumbers
PRODUCTVERSION $versionNumbers
FILEOS 0x40004
FILETYPE 0x1
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "040904B0"
    BEGIN
      VALUE "CompanyName", "$($tauriConfig.bundle.publisher)"
      VALUE "FileDescription", "$($tauriConfig.productName) local server"
      VALUE "FileVersion", "$versionText"
      VALUE "InternalName", "backend"
      VALUE "LegalCopyright", "$($tauriConfig.bundle.copyright)"
      VALUE "OriginalFilename", "backend.exe"
      VALUE "ProductName", "$($tauriConfig.productName)"
      VALUE "ProductVersion", "$versionText"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x409, 1200
  END
END
"@
$resourceScriptPath = Join-Path $workDirectory 'backend.rc'
[IO.File]::WriteAllText($resourceScriptPath, $resourceScriptText, $utf8WithoutBom)

$compiledResourcePath = Join-Path $workDirectory 'backend.res'
& $resourceCompilerPath /nologo /fo $compiledResourcePath $resourceScriptPath
if ($LASTEXITCODE -ne 0) { throw "rc.exe failed with exit code $LASTEXITCODE" }

$resolvedOutputPath = [IO.Path]::GetFullPath($OutputPath)
go run (Join-Path $PSScriptRoot 'res2syso.go') $compiledResourcePath $resolvedOutputPath
if ($LASTEXITCODE -ne 0) { throw "res2syso.go failed with exit code $LASTEXITCODE" }

Remove-Item -Recurse -Force $workDirectory
Write-Output "backend.exe resources $versionText ($($tauriConfig.bundle.publisher)) written to $resolvedOutputPath"
