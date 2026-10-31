<#
  Kök'ün iOS imza dosyalarını Windows'ta hazırlar, Mac gerektirmez.

    .\scripts\ios-imza.ps1 hazirla   Özel anahtarı ve Apple'a yüklenecek imza.csr dosyasını üretir.
    .\scripts\ios-imza.ps1 tamamla   Apple'dan inen dosyalardan GitHub secret değerlerini üretir.
    .\scripts\ios-imza.ps1 kopyala   Secret değerlerini sırayla panoya kopyalar.

  Dosyalar proje dışındaki kok-imza klasöründe durur, depoya girmez.
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('hazirla', 'tamamla', 'kopyala')]
  [string]$Adim,

  # Belgeler klasörü OneDrive'a eşitlenebildiği için özel anahtar orada tutulmuyor.
  [string]$Klasor = (Join-Path $env:USERPROFILE 'kok-imza')
)

$ErrorActionPreference = 'Stop'

$anahtar = Join-Path $Klasor 'imza.key'
$csr = Join-Path $Klasor 'imza.csr'
$secretKlasoru = Join-Path $Klasor 'github-secrets'

function Get-OpenSsl {
  $bulunan = Get-Command openssl -ErrorAction SilentlyContinue
  if ($bulunan) { return $bulunan.Source }
  $gitKoku = Split-Path (Split-Path (Get-Command git).Source)
  $adaylar = @("$gitKoku\mingw64\bin\openssl.exe", "$gitKoku\usr\bin\openssl.exe")
  $yol = $adaylar | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $yol) { throw 'OpenSSL bulunamadı. Git for Windows kurulu olmalı.' }
  return $yol
}

function Get-TekDosya([string]$Desen, [string]$Aciklama) {
  $indirilenler = Join-Path $env:USERPROFILE 'Downloads'
  $dosya = @($Klasor, $indirilenler) |
    Where-Object { Test-Path $_ } |
    ForEach-Object { Get-ChildItem -Path $_ -Filter $Desen -File } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if (-not $dosya) { throw "$Aciklama bulunamadı ($Desen). Dosyayı İndirilenler veya $Klasor klasörüne koy." }
  Write-Host "$Aciklama kullanılıyor: $($dosya.FullName)"
  return $dosya
}

function Set-Secret([string]$Ad, [string]$Deger) {
  [IO.File]::WriteAllText((Join-Path $secretKlasoru "$Ad.txt"), $Deger)
}

function Invoke-Hazirla {
  # Sertifika bu anahtara bağlıdır; üzerine yazılırsa Apple'daki sertifika işe yaramaz.
  if (Test-Path $anahtar) { throw "imza.key zaten var, korunuyor: $anahtar" }
  New-Item -ItemType Directory -Force -Path $Klasor | Out-Null
  $openssl = Get-OpenSsl
  & $openssl genrsa -out $anahtar 2048
  if ($LASTEXITCODE -ne 0) { throw 'Özel anahtar üretilemedi.' }
  & $openssl req -new -key $anahtar -out $csr -subj '/CN=Kok Takip/C=TR'
  if ($LASTEXITCODE -ne 0) { throw 'CSR dosyası üretilemedi.' }
  Write-Output "Hazır. Apple'a yükleyeceğin dosya: $csr"
}

function Invoke-Tamamla {
  if (-not (Test-Path $anahtar)) { throw 'imza.key yok. Önce hazirla adımını çalıştır.' }
  $sertifika = Get-TekDosya '*.cer' 'Apple sertifikası'
  $profil = Get-TekDosya '*.mobileprovision' 'Provisioning profili'
  $apiAnahtari = Get-TekDosya 'AuthKey_*.p8' 'App Store Connect API anahtarı'

  $openssl = Get-OpenSsl
  $pem = Join-Path $Klasor 'imza.pem'
  $p12 = Join-Path $Klasor 'imza.p12'
  $parola = [guid]::NewGuid().ToString('N')

  & $openssl x509 -inform DER -in $sertifika.FullName -out $pem
  if ($LASTEXITCODE -ne 0) { throw 'Sertifika okunamadı. Apple''dan indirilen .cer dosyasını kullan.' }

  # macOS, OpenSSL 3'ün varsayılan .p12 şifrelemesini okuyamaz; eski biçim açıkça seçiliyor.
  & $openssl pkcs12 -export -inkey $anahtar -in $pem -out $p12 -password "pass:$parola" `
    -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
  if ($LASTEXITCODE -ne 0) { throw 'Sertifika bu anahtarla eşleşmedi. CSR olarak imza.csr yüklendiğinden emin ol.' }

  New-Item -ItemType Directory -Force -Path $secretKlasoru | Out-Null
  Set-Secret 'IOS_P12_BASE64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($p12)))
  Set-Secret 'IOS_P12_PASSWORD' $parola
  Set-Secret 'IOS_PROFILE_BASE64' ([Convert]::ToBase64String([IO.File]::ReadAllBytes($profil.FullName)))
  Set-Secret 'ASC_KEY_ID' ($apiAnahtari.BaseName -replace '^AuthKey_', '')
  Set-Secret 'ASC_KEY_P8' ([IO.File]::ReadAllText($apiAnahtari.FullName))
  Write-Output "Hazır. Şimdi kopyala adımını çalıştır. Değerler: $secretKlasoru"
}

function Invoke-Kopyala {
  if (-not (Test-Path $secretKlasoru)) { throw 'Secret dosyaları yok. Önce tamamla adımını çalıştır.' }
  Write-Output 'GitHub deposunda Settings > Secrets and variables > Actions > New repository secret sayfasını aç.'
  foreach ($ad in 'IOS_P12_BASE64', 'IOS_P12_PASSWORD', 'IOS_PROFILE_BASE64', 'ASC_KEY_ID', 'ASC_KEY_P8') {
    Set-Clipboard -Value ([IO.File]::ReadAllText((Join-Path $secretKlasoru "$ad.txt")))
    Read-Host "$ad panoya kopyalandı. Bu adla secret oluşturup yapıştır, sonra Enter'a bas" | Out-Null
  }
  Set-Clipboard -Value ' '
  Write-Output 'Pano temizlendi. Son olarak ASC_ISSUER_ID secret''ını App Store Connect''teki Issuer ID ile ekle.'
}

switch ($Adim) {
  'hazirla' { Invoke-Hazirla }
  'tamamla' { Invoke-Tamamla }
  'kopyala' { Invoke-Kopyala }
}
