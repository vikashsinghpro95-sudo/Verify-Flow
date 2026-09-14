import sys
import os
import csv
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QPushButton, QLabel, QTableWidget, QTableWidgetItem, QTabWidget,
    QFileDialog, QHeaderView, QProgressBar, QMessageBox
)
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QFont, QIcon

import database
import verifier

class VerificationWorker(QThread):
    progress_updated = pyqtSignal(int, int) # processed, total
    job_completed = pyqtSignal()
    log_updated = pyqtSignal(str)

    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path

    def run(self):
        self.log_updated.emit(f"Loading {self.file_path}...")
        emails = set()
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                for row in reader:
                    for cell in row:
                        if '@' in cell:
                            emails.add(cell.strip())
                            break
        except Exception as e:
            self.log_updated.emit(f"Error reading file: {e}")
            return

        unique_emails = list(emails)
        total = len(unique_emails)
        self.log_updated.emit(f"Found {total} unique emails. Starting verification...")

        conn = database.get_connection()
        cursor = conn.cursor()
        
        job_name = f"Job {os.path.basename(self.file_path)}"
        cursor.execute("INSERT INTO verification_jobs (name, filename, total_count, status) VALUES (?, ?, ?, 'RUNNING')",
                       (job_name, os.path.basename(self.file_path), total))
        job_id = cursor.lastrowid
        conn.commit()

        processed = 0
        del_c, risk_c, undel_c, unk_c = 0, 0, 0, 0

        for email in unique_emails:
            res = verifier.verify_email_address(email)
            
            cursor.execute('''INSERT INTO emails (job_id, original_email, normalized_email, domain)
                              VALUES (?, ?, ?, ?)''', 
                           (job_id, email, res['normalized_email'], res['domain']))
            email_id = cursor.lastrowid

            cursor.execute('''INSERT INTO verification_results (
                email_id, syntax_valid, domain_valid, mx_valid, mx_host, disposable,
                role_based, free_provider, provider, catch_all, smtp_checked,
                smtp_status, smtp_code, smtp_message, confidence_score, status, risk_reasons
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
                email_id, res['syntaxValid'], res['domainValid'], res['mxValid'], res['mxHost'],
                res['disposable'], res['roleBased'], res['freeProvider'], res['provider'],
                res['catchAll'], res['smtpChecked'], res['smtpStatus'], res['smtpCode'],
                res['smtpMessage'], res['score'], res['status'], res['reasons']
            ))

            if res['status'] == 'DELIVERABLE': del_c += 1
            elif res['status'] == 'RISKY': risk_c += 1
            elif res['status'] == 'UNDELIVERABLE': undel_c += 1
            else: unk_c += 1

            processed += 1
            if processed % 10 == 0 or processed == total:
                conn.commit()
                self.progress_updated.emit(processed, total)
                self.log_updated.emit(f"Verified {processed}/{total}: {email} -> {res['status']}")

        cursor.execute('''UPDATE verification_jobs 
                          SET status='COMPLETED', processed_count=?, deliverable_count=?, 
                              risky_count=?, undeliverable_count=?, unknown_count=?, completed_at=CURRENT_TIMESTAMP
                          WHERE id=?''', (processed, del_c, risk_c, undel_c, unk_c, job_id))
        conn.commit()
        conn.close()

        self.log_updated.emit("Job completed successfully!")
        self.job_completed.emit()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("VerifyFlow - Premium Email Verification")
        self.setMinimumSize(1000, 700)
        
        database.init_db()

        self.setStyleSheet("""
            QMainWindow { background-color: #121212; color: #FFFFFF; }
            QTabWidget::pane { border: 1px solid #333333; background: #1E1E1E; border-radius: 8px; }
            QTabBar::tab { background: #2A2A2A; color: #A0A0A0; padding: 10px 20px; border-radius: 4px; margin-right: 2px; }
            QTabBar::tab:selected { background: #3B82F6; color: #FFFFFF; font-weight: bold; }
            QPushButton { background-color: #3B82F6; color: white; padding: 10px 20px; border-radius: 6px; font-weight: bold; border: none; }
            QPushButton:hover { background-color: #2563EB; }
            QPushButton:disabled { background-color: #555555; color: #888888; }
            QTableWidget { background-color: #1E1E1E; color: #E0E0E0; gridline-color: #333333; border: none; }
            QHeaderView::section { background-color: #2A2A2A; color: #FFFFFF; padding: 8px; border: 1px solid #333333; }
            QLabel { color: #E0E0E0; font-size: 14px; }
            QProgressBar { border: 1px solid #333; border-radius: 5px; text-align: center; color: white; background: #2A2A2A; }
            QProgressBar::chunk { background-color: #10B981; }
        """)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 20, 20, 20)

        # Header
        header = QLabel("VerifyFlow Engine")
        header.setStyleSheet("font-size: 24px; font-weight: bold; color: #3B82F6;")
        main_layout.addWidget(header)

        # Tabs
        self.tabs = QTabWidget()
        main_layout.addWidget(self.tabs)

        self.init_upload_tab()
        self.init_results_tab()

        self.worker = None

    def init_upload_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        info = QLabel("Upload a CSV file containing emails to begin verification.")
        layout.addWidget(info)

        self.btn_select = QPushButton("Select CSV File")
        self.btn_select.clicked.connect(self.select_file)
        layout.addWidget(self.btn_select, alignment=Qt.AlignCenter)

        self.lbl_file = QLabel("No file selected")
        self.lbl_file.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.lbl_file)

        self.btn_start = QPushButton("Start Verification")
        self.btn_start.setEnabled(False)
        self.btn_start.clicked.connect(self.start_verification)
        layout.addWidget(self.btn_start, alignment=Qt.AlignCenter)

        self.progress = QProgressBar()
        self.progress.setValue(0)
        layout.addWidget(self.progress)

        self.log_display = QLabel("Waiting for job...")
        self.log_display.setStyleSheet("color: #A0A0A0; font-family: monospace; background: #000; padding: 10px; border-radius: 5px;")
        self.log_display.setWordWrap(True)
        layout.addWidget(self.log_display)
        
        layout.addStretch()
        self.tabs.addTab(tab, "Upload & Verify")

    def init_results_tab(self):
        self.results_tab = QWidget()
        layout = QVBoxLayout(self.results_tab)

        top_layout = QHBoxLayout()
        self.btn_refresh = QPushButton("Refresh Data")
        self.btn_refresh.clicked.connect(self.load_results)
        top_layout.addWidget(self.btn_refresh)
        
        self.btn_export = QPushButton("Export Deliverable")
        self.btn_export.clicked.connect(self.export_csv)
        self.btn_export.setStyleSheet("background-color: #10B981;")
        top_layout.addWidget(self.btn_export)
        
        layout.addLayout(top_layout)

        self.table = QTableWidget(0, 5)
        self.table.setHorizontalHeaderLabels(["Email", "Status", "Score", "Reason", "Date"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        layout.addWidget(self.table)

        self.tabs.addTab(self.results_tab, "Results & Export")

    def select_file(self):
        options = QFileDialog.Options()
        file_path, _ = QFileDialog.getOpenFileName(self, "Select CSV", "", "CSV Files (*.csv);;All Files (*)", options=options)
        if file_path:
            self.selected_file = file_path
            self.lbl_file.setText(f"Selected: {os.path.basename(file_path)}")
            self.btn_start.setEnabled(True)

    def start_verification(self):
        if not hasattr(self, 'selected_file'): return
        
        self.btn_select.setEnabled(False)
        self.btn_start.setEnabled(False)
        self.progress.setValue(0)
        
        self.worker = VerificationWorker(self.selected_file)
        self.worker.progress_updated.connect(self.update_progress)
        self.worker.log_updated.connect(self.update_log)
        self.worker.job_completed.connect(self.on_job_completed)
        self.worker.start()

    def update_progress(self, processed, total):
        pct = int((processed / total) * 100)
        self.progress.setValue(pct)

    def update_log(self, msg):
        self.log_display.setText(msg)

    def on_job_completed(self):
        self.btn_select.setEnabled(True)
        self.btn_start.setEnabled(True)
        QMessageBox.information(self, "Complete", "Verification Job Completed Successfully!")
        self.load_results()

    def load_results(self):
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.original_email, r.status, r.confidence_score, r.risk_reasons, r.verified_at
            FROM verification_results r
            JOIN emails e ON r.email_id = e.id
            ORDER BY r.id DESC LIMIT 1000
        ''')
        rows = cursor.fetchall()
        conn.close()

        self.table.setRowCount(0)
        for row_data in rows:
            row_idx = self.table.rowCount()
            self.table.insertRow(row_idx)
            for col_idx, item in enumerate(row_data):
                self.table.setItem(row_idx, col_idx, QTableWidgetItem(str(item)))

    def export_csv(self):
        options = QFileDialog.Options()
        file_path, _ = QFileDialog.getSaveFileName(self, "Save Export", "deliverable_emails.csv", "CSV Files (*.csv)", options=options)
        if not file_path: return

        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT e.original_email, r.confidence_score
            FROM verification_results r
            JOIN emails e ON r.email_id = e.id
            WHERE r.status = 'DELIVERABLE'
        ''')
        rows = cursor.fetchall()
        conn.close()

        try:
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Email", "Score"])
                writer.writerows(rows)
            QMessageBox.information(self, "Export Successful", f"Exported {len(rows)} deliverable emails.")
        except Exception as e:
            QMessageBox.critical(self, "Export Error", str(e))

if __name__ == '__main__':
    app = QApplication(sys.argv)
    
    # Set a modern font
    font = QFont("Segoe UI", 10)
    app.setFont(font)
    
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())
