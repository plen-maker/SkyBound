; Xdeck EFB — Inno Setup 6
#define AppName     "Xdeck EFB"
#define AppVersion  "0.1.0"
#define AppCodename "Orion"
#define AppExeName  "Xdeck-EFB.exe"

[Setup]
AppId={{B2C4D6E8-1A3F-4B7C-9D0E-2F4A6B8C0D1E}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppCodename} v{#AppVersion}
AppPublisher=Xdeck
AppPublisherURL=https://simapp-99f40.web.app
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=installer_out
OutputBaseFilename=Xdeck-EFB-Setup-{#AppCodename}
SetupIconFile=installer_assets\icon.ico
WizardImageFile=installer_assets\installer_banner.bmp
WizardSmallImageFile=installer_assets\installer_icon.bmp
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#AppExeName}
MinVersion=10.0

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create Desktop shortcut"; GroupDescription: "Options:"; Flags: unchecked
Name: "autostart";   Description: "Launch on Windows startup"; GroupDescription: "Options:"; Flags: unchecked

[Files]
Source: "dist\Xdeck-EFB.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "installer_assets\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}";  Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "{#AppName}"; \
  ValueData: """{app}\{#AppExeName}"""; \
  Flags: uninsdeletevalue; Tasks: autostart

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Launch {#AppName}"; \
  Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "taskkill"; Parameters: "/f /im ""{#AppExeName}"""; \
  Flags: runhidden waituntilterminated

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel1.Caption := 'Welcome to Xdeck EFB';
  WizardForm.WelcomeLabel2.Caption :=
    'Xdeck EFB is an Electronic Flight Bag for MSFS 2020/2024.' +
    Chr(13)+Chr(10)+Chr(13)+Chr(10) +
    'This will install Xdeck EFB on your computer.' +
    Chr(13)+Chr(10)+Chr(13)+Chr(10) +
    'Release: Orion v0.1.0';
end;
