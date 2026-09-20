@echo off
echo Starting KisanGuard Backend...
cd /d "%~dp0backend"
python -m uvicorn app.main:app --reload --reload-dir app --reload-dir ..\Rag_Chatbot --host 0.0.0.0 --port 8000
