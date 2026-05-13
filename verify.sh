#!/bin/bash
LOGIN=$(curl -s -X POST http://localhost/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "TOKEN=$TOKEN"
echo "=== PATIENTS ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/patients | head -c 500
echo
echo "=== REPORTS ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/reports | head -c 500
echo
echo "=== ACCESS_REQUESTS ==="
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/patients/access-requests | head -c 500
echo
echo "=== CONTAINERS ==="
cd /root/bksys2/deploy/deploy && docker compose ps --format "table {{.Name}}\t{{.Status}}"
echo
echo "VERIFY_COMPLETE"
