; Xdeck EFB — Inno Setup 6
#define AppName     "Xdeck EFB"
#define AppVersion  "0.1.0"
#define AppCodename "Orion"
#define AppExeName  "Xdeck EFB.exe"
#define ReleaseURL  "https://github.com/plen-maker/SkyBound/releases/latest/download"

[Setup]
AppId={{B2C4D6E8-1A3F-4B7C-9D0E-2F4A6B8C0D1E}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppCodename} v{#AppVersion}
AppPublisher=Xdeck
AppPublisherURL=https://github.com/plen-maker/SkyBound
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
Name: "bridge";      Description: "Install SimBridge (Node.js, required for live data)"; GroupDescription: "Components:"; Flags: checkedonce

[Files]
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
var
  DownloadPage: TDownloadWizardPage;

procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel1.Caption := 'Welcome to Xdeck EFB';
  WizardForm.WelcomeLabel2.Caption :=
    'Xdeck EFB is an Electronic Flight Bag for Microsoft Flight Simulator 2020/2024.' +
    #13#10 + #13#10 +
    'This installer will:' + #13#10 +
    '  • Download and install Xdeck EFB' + #13#10 +
    '  • Optionally install the SimBridge' + #13#10 +
    '  • Set up desktop shortcut and startup options' +
    #13#10 + #13#10 +
    'Release: Orion v0.1.0';

  DownloadPage := CreateDownloadPage(
    'Downloading Xdeck EFB',
    'Please wait while the files are downloaded...',
    nil
  );
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  BridgeURL: String;
begin
  Result := True;
  if CurPageID = wpReady then begin
    DownloadPage.Clear;
    DownloadPage.Add(
      '{#ReleaseURL}/Xdeck EFB.exe',
      'Xdeck EFB.exe', ''
    );
    if WizardIsTaskSelected('bridge') then begin
      BridgeURL := 'https://github.com/plen-maker/SkyBound/archive/refs/heads/main.zip';
      DownloadPage.Add(BridgeURL, 'bridge.zip', '');
    end;
    DownloadPage.Show;
    try
      try
        DownloadPage.Download;
        Result := True;
      except
        if DownloadPage.AbortedByUser then
          Log('Aborted')
        else
          SuppressibleMsgBox(AddPeriod(GetExceptionMessage), mbCriticalError, MB_OK, IDOK);
        Result := False;
      end;
    finally
      DownloadPage.Hide;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ExePath, BridgeZip, BridgeDir: String;
  ResultCode: Integer;
begin
  if CurStep = ssInstall then begin
    ExePath := ExpandConstant('{tmp}\Xdeck EFB.exe');
    if FileExists(ExePath) then
      FileCopy(ExePath, ExpandConstant('{app}\Xdeck EFB.exe'), False);

    if WizardIsTaskSelected('bridge') then begin
      BridgeZip := ExpandConstant('{tmp}\bridge.zip');
      BridgeDir := ExpandConstant('{app}\bridge');
      if FileExists(BridgeZip) then begin
        CreateDir(BridgeDir);
        Exec('powershell.exe',
          '-NoProfile -Command "Expand-Archive -Path ''' +
          BridgeZip + ''' -DestinationPath ''' + BridgeDir + ''' -Force"',
          '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      end;
    end;
  end;

  if CurStep = ssPostInstall then begin
    if WizardIsTaskSelected('bridge') then begin
      if not FileExists(ExpandConstant('{app}\bridge\.env')) then begin
        SaveStringToFile(
          ExpandConstant('{app}\bridge\.env'),
          'SKYBOUND_SESSION=your-session-code' + #13#10 +
          'SIMBRIEF_USERNAME=your-simbrief-username' + #13#10 +
          'FIREBASE_SERVICE_ACCOUNT=./serviceAccountKey.json' + #13#10 +
          'SIM_MODE=simconnect' + #13#10,
          False
        );
      end;
    end;
  end;
end;
