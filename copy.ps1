
$sourceDir = "C:\Users\eyash\Downloads\newswebpage (1)\newswebpage\src\main\java\com\newsbridge\newswebpage"
$destDir = "C:\Users\eyash\GP\backend\src\main\java\com\example\newscrawler"

function Convert-File {
    param ($in, $out)
    $text = Get-Content $in -Raw
    
    $text = $text -replace "package com\.newsbridge\.newswebpage\.model;", "package com.example.newscrawler.entity;"
    $text = $text -replace "package com\.newsbridge\.newswebpage\.repository;", "package com.example.newscrawler.repository;"
    $text = $text -replace "package com\.newsbridge\.newswebpage\.service;", "package com.example.newscrawler.service;"
    $text = $text -replace "package com\.newsbridge\.newswebpage\.controller;", "package com.example.newscrawler.controller;"
    $text = $text -replace "package com\.newsbridge\.newswebpage\.dto;", "package com.example.newscrawler.dto;"
    
    $text = $text -replace "import com\.newsbridge\.newswebpage\.model", "import com.example.newscrawler.entity"
    $text = $text -replace "import com\.newsbridge\.newswebpage\.repository", "import com.example.newscrawler.repository"
    $text = $text -replace "import com\.newsbridge\.newswebpage\.service", "import com.example.newscrawler.service"
    $text = $text -replace "import com\.newsbridge\.newswebpage\.dto", "import com.example.newscrawler.dto"
    
    $text = $text -replace "\bUser(?=\s+user|\.class|Repository)\b", "AppUser"
    $text = $text -replace "private AppAppUser", "private AppUser"
    $text = $text -replace "<AppAppUser>", "<AppUser>"
    $text = $text -replace "UserRepository", "AppUserRepository"
    $text = $text -replace "userRepository", "appUserRepository"
    
    if ($out -match "Post\.java") {
        $text = $text -replace "private int numImages;", "private int numImages;`r`n    @ManyToOne`r`n    private Article article;"
    }
    
    Set-Content $out $text
    Write-Host "Processed $out"
}

Get-ChildItem "$sourceDir\model\*.java" | Where-Object { $_.Name -ne "User.java" } | ForEach-Object { Convert-File $_.FullName "$destDir\entity\$($_.Name)" }
Get-ChildItem "$sourceDir\repository\*.java" | Where-Object { $_.Name -ne "UserRepository.java" } | ForEach-Object { Convert-File $_.FullName "$destDir\repository\$($_.Name)" }
Get-ChildItem "$sourceDir\service\*.java" | Where-Object { $_.Name -ne "UserService.java" } | ForEach-Object { Convert-File $_.FullName "$destDir\service\$($_.Name)" }
Get-ChildItem "$sourceDir\controller\*.java" | ForEach-Object { Convert-File $_.FullName "$destDir\controller\$($_.Name)" }
Get-ChildItem "$sourceDir\dto\*.java" | ForEach-Object { Convert-File $_.FullName "$destDir\dto\$($_.Name)" }

