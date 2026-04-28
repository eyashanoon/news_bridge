import os

BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8080/api")
BACKEND_TOKEN = os.getenv("BACKEND_TOKEN", "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxMCIsInR5cGUiOiJSRUdJU1RFUkVEIiwicm9sZXMiOltdLCJpYXQiOjE3NzcwMzI4MzQsImV4cCI6MTc3NzExOTIzNCwiZW1haWwiOiJzMTIxMTYyNzRAc3R1Lm5hamFoLmVkdSIsImNyZWF0ZWRBdCI6MTc3NzAzMjIyOTM4Nn0.aEc8LK3fDTOPrY-chbv0LKEmpPzthO3ImQksJV421ivSBbdPCPrFcXAAsCRu71kHfvaYMo_CeKTjT6l1fnbrXw")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:3b")
