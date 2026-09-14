#!/bin/bash
echo "Installing requirements..."
pip3 install -r requirements.txt
pip3 install pyinstaller

echo "Building VerifyFlow app..."
pyinstaller --noconfirm --onefile --windowed --name "VerifyFlow" gui_main.py

echo "Build complete! You can find VerifyFlow in the 'dist' directory."
