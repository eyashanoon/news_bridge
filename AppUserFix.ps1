
$files = Get-ChildItem -Recurse -File "C:\Users\eyash\GP\backend\src\main\java\com\example\newscrawler" | Where-Object { $_.Name -match "Post|Feed|Reaction|Interaction|Preference" }
foreach ($file in $files) {
    if ($file.Name -notmatch "UserStatus.java|UserRole.java") {
        $text = Get-Content $file.FullName -Raw
        $text = $text -replace "\bUser(?!\w)", "AppUser"
        $text = $text -replace "AppAppUser", "AppUser"
        $text = $text -replace "AppUserPreference", "UserPreference"
        $text = $text -replace "AppAppUserRepository", "AppUserRepository"
        $text = $text -replace "AppUserRepository", "AppUserRepository"
        Set-Content $file.FullName $text
    }
}

