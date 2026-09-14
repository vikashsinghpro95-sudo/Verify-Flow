@echo off
echo Installing requirements...
pip install -r requirements.txt
pip install pyinstaller

echo Building VerifyFlow.exe...
pyinstaller --noconfirm --onefile --windowed --name "VerifyFlow" gui_main.py

echo Build complete! You can find VerifyFlow.exe in the 'dist' directory.
pause
