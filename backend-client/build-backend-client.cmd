npm run build
rd /s /q ..\docker\nginx\backend
mkdir ..\docker\nginx\backend
xcopy .\dist\* ..\docker\nginx\backend\ /E
rd /s /q .\dist
