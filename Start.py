import customtkinter as ctk
import webview
import subprocess
import threading
import requests
import time
import sys
import os

# Configure CustomTkinter
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class LauncherWindow(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("VerifyFlow Launcher")
        self.geometry("400x250")
        self.resizable(False, False)
        
        # Center window on screen
        self.update_idletasks()
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f"{width}x{height}+{x}+{y}")

        self.label_title = ctk.CTkLabel(self, text="VerifyFlow", font=("Segoe UI", 28, "bold"), text_color="#3B82F6")
        self.label_title.pack(pady=(40, 10))

        self.label_status = ctk.CTkLabel(self, text="Starting backend server...", font=("Segoe UI", 14))
        self.label_status.pack(pady=(0, 20))

        self.progressbar = ctk.CTkProgressBar(self, width=300)
        self.progressbar.pack(pady=(0, 20))
        self.progressbar.set(0)
        self.progressbar.start()

        self.node_process = None
        
        # Start server background thread
        threading.Thread(target=self.start_and_wait_for_server, daemon=True).start()

    def start_and_wait_for_server(self):
        try:
            # Check if server is already running (e.g., from npm run dev)
            try:
                if requests.get("http://127.0.0.1:5555", timeout=1).status_code == 200:
                    self.update_status("Server already running! Launching app...")
                    self.after(0, self.launch_webview)
                    return
            except requests.ConnectionError:
                pass # Server not running, proceed to start it

            # Start the node server
            env = os.environ.copy()
            env["PORT"] = "5555"
            
            script_path = os.path.join(os.path.dirname(__file__), "server", "server.js")
            
            self.node_process = subprocess.Popen(
                ["node", script_path],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            self.update_status("Waiting for server to be ready...")
            
            # Poll 127.0.0.1:5555
            url = "http://127.0.0.1:5555"
            retries = 0
            max_retries = 30 # 15 seconds max wait
            
            while retries < max_retries:
                try:
                    res = requests.get(url, timeout=1)
                    if res.status_code == 200:
                        self.update_status("Server ready! Launching app...")
                        time.sleep(1)
                        self.after(0, self.launch_webview)
                        return
                except requests.ConnectionError:
                    pass
                
                time.sleep(0.5)
                retries += 1
                
            self.update_status("Failed to start server (Timeout).")
            self.progressbar.stop()
            
        except Exception as e:
            self.update_status(f"Error: {str(e)}")
            self.progressbar.stop()

    def update_status(self, text):
        self.after(0, lambda: self.label_status.configure(text=text))

    def launch_webview(self):
        # Destroy the CustomTkinter launcher window completely
        self.destroy()
        
        # Open PyQtWebEngine (Chromium) to bypass Apple's strict SSL rules
        try:
            from PyQt6.QtWidgets import QApplication, QMainWindow
            from PyQt6.QtWebEngineWidgets import QWebEngineView
            from PyQt6.QtCore import QUrl

            class WebWindow(QMainWindow):
                def __init__(self, node_proc):
                    super().__init__()
                    self.node_process = node_proc
                    self.setWindowTitle('VerifyFlow - Email Verification')
                    self.resize(1200, 800)
                    self.setMinimumSize(800, 600)
                    self.browser = QWebEngineView()
                    self.browser.setUrl(QUrl("http://127.0.0.1:5555"))
                    self.setCentralWidget(self.browser)

                def closeEvent(self, event):
                    # When PyQt window closes, cleanup Node server
                    if self.node_process:
                        self.node_process.terminate()
                        try:
                            self.node_process.wait(timeout=3)
                        except subprocess.TimeoutExpired:
                            self.node_process.kill()
                    event.accept()

            qt_app = QApplication(sys.argv)
            win = WebWindow(self.node_process)
            win.show()
            sys.exit(qt_app.exec())
            
        except ImportError as e:
            print("Failed to load PyQt6-WebEngine:", e)
            self.cleanup()

    def cleanup(self):
        if self.node_process:
            self.node_process.terminate()
            try:
                self.node_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.node_process.kill()
        sys.exit(0)

if __name__ == "__main__":
    app = LauncherWindow()
    app.mainloop()
