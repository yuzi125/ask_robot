npm run build
rd /s /q ..\docker\nginx\ava
mkdir ..\docker\nginx\ava
xcopy .\dist\* ..\docker\nginx\ava\ /E
rd /s /q .\dist
