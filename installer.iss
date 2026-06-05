; Xdeck EFB — Inno Setup installer
; Requires: Inno Setup 6.x (https://jrsoftware.org/isdl.php)

#define AppName "Xdeck EFB"
#define AppVersion "0.1.0"
#define AppCodename "Orion"
#define AppPublisher "Xdeck"
#define AppURL "https://github.com/plen-maker/SkyBound"
#define AppExeName "Xdeck EFB.exe"

[Setup]
AppId={{A3F2B8C1-4D5E-6F7A-8B9C-0D1E2F3A4B5C}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppCodename} · v{#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}/releases
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=
OutputDir=installer_output
OutputBaseFilename=Xdeck-EFB-Setup-{#AppCodename}
SetupIconFile=assets\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=120
DisableWelcomePage=no
DisableDirPage=no
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Visual styling
WizardImageFile=assets\installer_banner.bmp
WizardSmallImageFile=assets\installer_icon.bmp

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "hungarian"; MessagesFile: "compiler:Languages\Hungarian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Indítás Windowssal együtt"; GroupDescription: "Indítási beállítások:"; Flags: unchecked

[Files]
; Main EXE — downloaded from GitHub by the download script, or bundled
Source: "dist\Xdeck EFB.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "assets\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "{#AppName}"; ValueData: """{app}\{#AppExeName}"""; Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /f /im ""{#AppExeName}"""; Flags: runhidden

[Messages]
WelcomeLabel1=Üdvözöl az [name] telepítője
WelcomeLabel2=Ez a varázsló telepíti az [name/ver] verziót a számítógépedre.%n%nXdeck EFB — Electronic Flight Bag MSFS 2020/2024-hez.%n%nBezárás előtt ajánlott bezárni a futó alkalmazásokat.
FinishedHeadingLabel=Az [name] telepítése befejeződött
FinishedLabel=Az [name] telepítése sikeresen befejeződött.%n%nAz alkalmazást az Asztalon lévő ikonnal vagy a Start menüből indíthatod.
