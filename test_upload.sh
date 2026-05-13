#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
echo "Token: ${TOKEN:0:30}..."
echo "--- Testing upload endpoint ---"
curl -s -w "\nHTTP_STATUS: %{http_code}\n" -X POST http://localhost/api/studies/upload -H "Authorization: Bearer $TOKEN"
